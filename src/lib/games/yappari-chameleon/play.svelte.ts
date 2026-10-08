import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { pushRecent } from './color';
import { restHit } from './doll3d';
import { floorBelow, idle, newBody, step, wallNear, type Body } from './move';
import { PaintLog, Stroke, type Brush, type Dab } from './paint';
import { poseById, STAND } from './poses';
import { TouchPad, type Mode, type PaintEvent } from './touch';
import type { World } from './world3d';

const LOOK = 0.005;
const ORBIT = 0.006;
const EYE_HEIGHT = 1.0;

export class Play {
  mode = $state<Mode>('walk');
  brush = $state<Brush>({ radius: 0.05, color: [1, 1, 1], opacity: 1, metal: 0, rough: 0.85 });
  previous = $state<RGB>([1, 1, 1]);
  recent = $state<RGB[]>([]);
  spoit = $state(false);
  shadow = $state(true);
  canUndo = $state(false);
  cling = $state<'wall' | 'ceiling' | null>(null);
  /** 壁際にいる。ジャンプのボタンを本家の言葉の「よじ登り」にする */
  nearWall = $state(false);
  pose = $state('stand');
  lock = $state(false);
  /** 開いた輪。`id` は開いた指（軽く押して開いたら null） */
  wheel = $state<{ id: number | null } | null>(null);
  stick = $state({ x: 0, y: 0, active: false, ox: 0, oy: 0 });
  readonly held = { up: false, down: false, turn: 0 };
  readonly world: World;
  readonly pad: TouchPad;
  readonly log = new PaintLog();
  body: Body;
  ghost: Body;
  camYaw = 0;
  camPitch = 0.25;
  eyeYaw = 0;
  eyePitch = 0;
  orbitYaw = Math.PI;
  orbitPitch = 0.15;
  orbitDist = 1.6;
  #stroke: Stroke | null = null;
  #jump = false;
  #release = false;
  #cursorUntil = 0;

  constructor(world: World, stickRadius: number) {
    this.world = world;
    this.pad = new TouchPad(stickRadius);
    this.body = newBody(world.level.spawn);
    this.ghost = newBody(world.level.spawn);
    world.placeDoll(this.body);
  }

  jump(): void {
    this.#jump = true;
  }

  release(): void {
    this.#release = true;
  }

  togglePaint(): void {
    this.#setMode(this.mode === 'paint' ? 'walk' : 'paint');
    if (this.mode === 'paint') {
      // 壁に張り付いた体は背中が部屋を向く。壁や天井の裏から見ないよう、部屋の側（天井では下）に回る
      const on = this.body.cling?.kind;
      this.orbitYaw = on === 'wall' ? this.body.yaw : this.body.yaw + Math.PI;
      this.orbitPitch = on === 'ceiling' ? -0.9 : 0.15;
      this.orbitDist = 1.6;
    }
  }

  toggleEye(): void {
    if (this.mode === 'eye') return this.#setMode('walk');
    // 三人称のカメラのいる所から歩き出す（壁の外へは出ない位置）
    const c = this.world.camera.position;
    // 天井や壁の高い所にいても、カメラの真下の床から歩き出す
    this.ghost = newBody([c.x, floorBelow(this.world.level, c.x, c.z, c.y), c.z]);
    this.eyeYaw = this.camYaw;
    this.eyePitch = 0;
    this.#setMode('eye');
  }

  setPose(id: string): void {
    const p = id === STAND.id ? STAND : poseById(id);
    this.pose = p.id;
    this.world.poses.to(p);
  }

  toggleLock(): void {
    this.lock = !this.lock;
  }

  openWheel(id: number | null): void {
    this.wheel = { id };
  }

  closeWheel(): void {
    this.wheel = null;
  }

  toggleSpoit(): void {
    this.spoit = !this.spoit;
  }

  toggleShadow(): void {
    this.shadow = !this.shadow;
    this.world.rig.mesh.receiveShadow = this.shadow;
  }

  undo(): void {
    if (this.log.undo()) this.world.rig.paint.rebuild(this.log.dabs);
    this.canUndo = this.log.canUndo;
  }

  setColor(c: RGB): void {
    this.previous = this.brush.color;
    this.brush.color = [...c];
  }

  /** 大きさを変えたあと、画面の (x, y) の体の上に筆の輪を 1 秒出す */
  showCursor(x: number, y: number): void {
    this.#cursorUntil = performance.now() + 1000;
    this.world.cursor(this.world.pickBody(x, y), this.brush.radius);
  }

  rebuildPaint(): void {
    this.world.rig.paint.rebuild(this.log.dabs);
  }

  applyDabs(dabs: Dab[]): void {
    if (!dabs.length) return;
    this.log.add(dabs);
    this.world.rig.paint.apply(dabs);
  }

  spoitAt(x: number, y: number): void {
    const got = this.world.spoit(x, y);
    this.spoit = false;
    if (!got) return;
    this.setColor(got.color);
    this.brush.metal = got.metal;
    this.brush.rough = got.rough;
  }

  /** 縦持ちで止めるときなど、押している指とボタンの状態を捨てる */
  interrupt(): void {
    this.#setMode(this.mode);
  }

  #setMode(m: Mode) {
    for (const e of this.pad.setMode(m)) this.#paint(e);
    this.spoit = false;
    this.held.up = this.held.down = false;
    this.held.turn = 0;
    this.wheel = null;
    this.mode = m;
    this.stick = { ...this.pad.stick };
  }

  pointer(kind: 'down' | 'move' | 'up' | 'cancel', id: number, x: number, y: number, width: number): void {
    const now = performance.now();
    const events =
      kind === 'down'
        ? this.pad.down(id, x, y, width, now)
        : kind === 'move'
          ? this.pad.move(id, x, y, now)
          : kind === 'cancel'
            ? this.pad.cancel(id)
            : this.pad.up(id);
    for (const e of events) this.#paint(e);
    this.stick = { ...this.pad.stick };
  }

  #paint(e: PaintEvent) {
    if (e.kind === 'cancel') {
      this.#stroke = null;
      this.world.cursor(null, 0);
      if (this.log.cancel()) this.rebuildPaint();
      this.canUndo = this.log.canUndo;
      return;
    }
    if (this.spoit) {
      if (e.kind === 'end') this.spoitAt(e.x, e.y);
      return;
    }
    if (e.kind === 'start') {
      this.log.begin();
      this.#stroke = new Stroke({ ...this.brush, color: [...this.brush.color] });
    }
    const hit = this.#stroke && this.world.pickBody(e.x, e.y);
    const rest = hit && restHit(this.world.rig, hit);
    this.world.cursor(e.kind === 'end' ? null : hit, this.brush.radius);
    if (this.#stroke && rest) this.applyDabs(this.#stroke.to(rest));
    if (e.kind === 'end') {
      if (this.#stroke) this.recent = pushRecent(this.recent, this.#stroke.brush.color);
      this.#stroke = null;
      this.canUndo = this.log.canUndo;
    }
  }

  #input(yaw: number) {
    const s = this.pad.stick;
    const len = Math.hypot(s.x, s.y);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    // 画面の右は、カメラの向き (sin, cos) を右へ 90 度回した (−cos, sin)
    return {
      ...idle(),
      x: fx * -s.y + -fz * s.x,
      z: fz * -s.y + fx * s.x,
      run: len > 0.85,
      jump: this.#jump,
      release: this.#release,
      up: this.held.up,
      down: this.held.down,
      lock: this.lock,
      turn: this.held.turn
    };
  }

  frame(dt: number, now: number): void {
    for (const e of this.pad.tick(now)) this.#paint(e);
    const w = this.world;
    if (this.mode === 'walk') {
      const look = this.pad.takeLook();
      this.camYaw -= look.dx * LOOK;
      this.camPitch = Math.min(1.2, Math.max(-0.5, this.camPitch + look.dy * LOOK));
      step(this.body, this.#input(this.camYaw), w.level, dt);
    } else if (this.mode === 'eye') {
      const look = this.pad.takeLook();
      this.eyeYaw -= look.dx * LOOK;
      this.eyePitch = Math.min(1.3, Math.max(-1.3, this.eyePitch + look.dy * LOOK));
      // 壁際で跳ぶと張り付いてしまうので、ふつうの跳び上がりのときだけ通す
      const jump = this.#jump && wallNear(this.ghost, w.level) === null;
      step(this.ghost, { ...this.#input(this.eyeYaw), jump }, w.level, dt);
    } else {
      const o = this.pad.takeOrbit();
      this.orbitYaw -= o.dx * ORBIT;
      this.orbitPitch = Math.min(1.3, Math.max(-1.0, this.orbitPitch + o.dy * ORBIT));
      this.orbitDist = Math.min(3.5, Math.max(0.5, this.orbitDist / o.zoom));
    }
    this.#jump = this.#release = false;
    // 押していたボタンは張り付きが終わると消えて pointerup が届かないので、離れたあとに残さない
    if (!this.body.cling) this.held.up = this.held.down = false;
    // 回るボタンも壁では消える
    if (this.body.cling?.kind === 'wall') this.held.turn = 0;
    this.cling = this.body.cling?.kind ?? null;
    this.nearWall = !this.body.cling && wallNear(this.body, w.level) !== null;
    w.placeDoll(this.body);
    w.poses.step(dt);
    if (this.mode === 'walk') {
      const lift = this.body.cling?.kind === 'ceiling' ? -0.4 : 0.85;
      const t: V3 = [this.body.pos[0], this.body.pos[1] + lift, this.body.pos[2]];
      w.follow(t, this.camYaw, this.camPitch, 2.4, 60);
    } else if (this.mode === 'paint') w.follow(w.dollCenter(), this.orbitYaw, this.orbitPitch, this.orbitDist, 45);
    else w.eye([this.ghost.pos[0], this.ghost.pos[1] + EYE_HEIGHT, this.ghost.pos[2]], this.eyeYaw, this.eyePitch);
    if (this.mode !== 'paint' || (!this.#stroke && now > this.#cursorUntil)) w.cursor(null, 0);
    w.xray(this.mode !== 'eye');
    w.holdBrush(this.mode === 'paint');
    w.render();
  }
}
