import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { pushRecent } from './color';
import { restHit } from './doll3d';
import { floorBelow, idle, newBody, step, wallNear, type Body } from './move';
import { PaintLog, Stroke, type Brush, type Dab } from './paint';
import { poseById, STAND } from './poses';
import { sounds } from './sounds';
import { TouchPad, type Mode, type PaintEvent } from './touch';
import type { World } from './world3d';

const LOOK = 0.005;
const ORBIT = 0.006;
const EYE_HEIGHT = 1.0;
export const CROUCH = 0.45;
const CAM_PITCH_MIN = -0.5;
const CAM_PITCH_MAX = 1.2;
/** 天井では見る中心が天井の 0.4m 下なので、上から見ると天井にぶつかって距離がつぶれる。人形の下から見上げる範囲に収める */
const CEILING_PITCH_MIN = -1.2;
const CEILING_PITCH_MAX = -0.25;
/** ペイントに入るとき、壁でつぶれた距離を引き継ぐと人形に寄りすぎるので、ここより近くは始めない */
const PAINT_DIST_MIN = 1.2;
/** 見る中心が切り替わったときのずれが 1/e になる時間。0.3 秒でほぼ収まる */
const SLIDE_SECS = 0.1;

/** hider は隠れる人（1 人で試すときも）。hunter と watch（観戦）は一人称の作りで歩き、フリーカメラのボタンでは抜けない */
export type PlayRole = 'hider' | 'hunter' | 'watch';

export class Play {
  mode = $state<Mode>('walk');
  role = $state<PlayRole>('hider');
  crouch = $state(false);
  /** 観戦で見ている人の体の真ん中。毎フレーム入れ直す。null ならフリーカメラで歩く */
  watch: V3 | null = null;
  brush = $state<Brush>({ radius: 0.05, color: [1, 1, 1], opacity: 1, metal: 0, rough: 0.85 });
  previous = $state<RGB>([1, 1, 1]);
  recent = $state<RGB[]>([]);
  spoit = $state(false);
  shadow = $state(true);
  canUndo = $state(false);
  cling = $state<'wall' | 'ceiling' | null>(null);
  /** 壁際にいる。ジャンプのボタンを本家の言葉の「よじ登り」にする */
  nearWall = $state(false);
  /** 隠れタイムの残り秒 */
  timer = $state<number | null>(null);
  /** 始めた回数。中央の「隠れタイム」を出し直すのに使う */
  timerRuns = $state(0);
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
  /** 取り消し列の 1 本を始めたか。体に当たるまで始めないので、体を外した指は何も残さない */
  #began = false;
  #jump = false;
  #release = false;
  #cursorUntil = 0;
  /** 見る中心を、モードが変わる前の位置から新しい位置へなめらかに移すためのずれ */
  #slide: V3 = [0, 0, 0];
  #shown: V3 | null = null;
  #slideNext = false;

  constructor(world: World, stickRadius: number) {
    this.world = world;
    this.pad = new TouchPad(stickRadius);
    this.body = newBody(world.level.spawn);
    this.ghost = newBody(world.level.spawn);
    world.placeDoll(this.body);
  }

  /** ボタンを押しているあいだだけ上がる・下がる・回る */
  hold(key: 'up' | 'down', on: boolean): void {
    this.held[key] = on;
  }

  turn(dir: number): void {
    this.held.turn = dir;
  }

  tune(patch: Partial<Brush>): void {
    Object.assign(this.brush, patch);
  }

  startTimer(): void {
    this.timer = 60;
    this.timerRuns++;
    sounds.button();
  }

  stopTimer(): void {
    this.timer = null;
  }

  jump(): void {
    this.#jump = true;
  }

  release(): void {
    this.#release = true;
  }

  togglePaint(): void {
    if (this.role !== 'hider') return;
    if (this.mode === 'paint') {
      this.camYaw = this.orbitYaw;
      this.camPitch = Math.min(CAM_PITCH_MAX, Math.max(CAM_PITCH_MIN, this.orbitPitch));
      this.#setMode('walk');
      return;
    }
    // 見ている向き・高さ・距離をそのまま引き継ぐ。塗る手を止めずに済み、見る中心だけが体の真ん中へ移る
    this.orbitYaw = this.camYaw;
    this.orbitPitch = this.camPitch;
    this.orbitDist = Math.min(3.5, Math.max(PAINT_DIST_MIN, this.world.dist));
    this.#setMode('paint');
  }

  toggleEye(): void {
    if (this.role !== 'hider') return;
    if (this.mode === 'eye') return this.#setMode('walk');
    this.#ghostFromCamera();
    this.eyeYaw = this.camYaw;
    this.eyePitch = 0;
    this.#setMode('eye');
  }

  /** 三人称のカメラのいる所から歩き出す（壁の外へは出ない位置）。天井や壁の高い所にいても、カメラの真下の床から */
  #ghostFromCamera() {
    const c = this.world.camera.position;
    this.ghost = newBody([c.x, floorBelow(this.world.level, c.x, c.z, c.y), c.z]);
  }

  placeAt(at: V3, yaw = 0): void {
    this.body = newBody(at);
    this.body.yaw = yaw;
  }

  /** ハンターになる。置いてきた体も同じ所へ移す（張り付いたまま残さない） */
  hunt(at: V3, yaw: number): void {
    this.role = 'hunter';
    this.crouch = false;
    this.watch = null;
    this.placeAt(at, yaw);
    this.ghost = newBody(at);
    this.eyeYaw = yaw;
    this.eyePitch = 0;
    this.#setMode('eye');
  }

  /** 観戦に入る。見る人は毎フレーム watch に入れる */
  spectate(): void {
    this.role = 'watch';
    this.crouch = false;
    this.#ghostFromCamera();
    this.eyeYaw = this.mode === 'eye' ? this.eyeYaw : this.mode === 'paint' ? this.orbitYaw : this.camYaw;
    this.eyePitch = 0;
    this.#setMode('eye');
  }

  freeCam(): void {
    this.watch = null;
    this.#ghostFromCamera();
  }

  unhunt(): void {
    this.role = 'hider';
    this.crouch = false;
    this.watch = null;
    if (this.mode !== 'walk') this.#setMode('walk');
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
    // 塗っている指があるまま切り替えても、スポイト中は move と end が筆に届かないので、ここで筆を終える
    if (this.spoit && this.#stroke) this.#endStroke();
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
    sounds.pick();
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
    if (m !== this.mode) {
      if (m === 'eye' || this.mode === 'eye') {
        this.world.snapCamera();
        this.#shown = null;
      } else this.#slideNext = true;
    }
    this.mode = m;
    this.stick = { ...this.pad.stick };
  }

  pointer(kind: 'down' | 'move' | 'up' | 'cancel', id: number, x: number, y: number, width: number): void {
    const now = performance.now();
    // 体の外に置いた指は塗らずにカメラを回す。スポイトは外でも離した所で色を取るので塗る道を通す。測るのは置いたときの 1 回だけ
    const orbit = kind === 'down' && this.mode === 'paint' && !this.spoit && !this.world.pickBody(x, y);
    const events =
      kind === 'down'
        ? this.pad.down(id, x, y, width, now, orbit)
        : kind === 'move'
          ? this.pad.move(id, x, y, now)
          : kind === 'cancel'
            ? this.pad.cancel(id)
            : this.pad.up(id);
    for (const e of events) this.#paint(e);
    this.stick = { ...this.pad.stick };
  }

  #endStroke() {
    if (this.#stroke) this.recent = pushRecent(this.recent, this.#stroke.brush.color);
    this.#stroke = null;
    this.#began = false;
    this.world.cursor(null, 0);
    this.canUndo = this.log.canUndo;
  }

  #paint(e: PaintEvent) {
    if (e.kind === 'cancel') {
      // スポイト中や体を外したままの筆は取り消し列に入っていないので、前の筆を消さない
      const began = this.#began;
      this.#stroke = null;
      this.#began = false;
      this.world.cursor(null, 0);
      if (began && this.log.cancel()) this.rebuildPaint();
      this.canUndo = this.log.canUndo;
      return;
    }
    if (this.spoit) {
      if (e.kind === 'end') this.spoitAt(e.x, e.y);
      return;
    }
    if (e.kind === 'start') this.#stroke = new Stroke({ ...this.brush, color: [...this.brush.color] });
    const hit = this.#stroke && this.world.pickBody(e.x, e.y);
    const rest = hit && restHit(this.world.rig, hit);
    this.world.cursor(e.kind === 'end' ? null : hit, this.brush.radius);
    if (this.#stroke && rest) {
      if (!this.#began) {
        this.#began = true;
        this.log.begin();
        sounds.spray();
      }
      this.applyDabs(this.#stroke.to(rest));
    }
    if (e.kind === 'end') this.#endStroke();
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

  /** 見る中心。モードが変わった直後は直前に見ていた位置から始め、desired へ寄せる */
  #focus(desired: V3, dt: number): V3 {
    const prev = this.#shown;
    if (this.#slideNext && prev) this.#slide = [prev[0] - desired[0], prev[1] - desired[1], prev[2] - desired[2]];
    this.#slideNext = false;
    const [sx, sy, sz] = this.#slide;
    const keep = Math.exp(-dt / SLIDE_SECS);
    this.#slide = [sx * keep, sy * keep, sz * keep];
    return (this.#shown = [desired[0] + sx, desired[1] + sy, desired[2] + sz]);
  }

  frame(dt: number, now: number): void {
    if (this.timer !== null) {
      this.timer = Math.max(0, this.timer - dt);
      if (this.timer === 0) {
        this.timer = null;
        sounds.done();
      }
    }
    for (const e of this.pad.tick(now)) this.#paint(e);
    const w = this.world;
    if (this.mode === 'walk') {
      const look = this.pad.takeLook();
      this.camYaw -= look.dx * LOOK;
      const [lo, hi] =
        this.body.cling?.kind === 'ceiling' ? [CEILING_PITCH_MIN, CEILING_PITCH_MAX] : [CAM_PITCH_MIN, CAM_PITCH_MAX];
      const fit = (v: number) => Math.min(hi, Math.max(lo, v));
      // 張り付いた瞬間に向きが飛ばないよう、範囲の外にいるあいだは指を受けずに、なめらかに範囲へ寄せる
      if (this.camPitch < lo || this.camPitch > hi) {
        const to = fit(this.camPitch);
        // 指数で寄せるだけでは浮動小数点で範囲のふちに届かず、範囲の外のまま指を受けなくなるので、近づいたら合わせる
        this.camPitch =
          Math.abs(to - this.camPitch) < 1e-3 ? to : this.camPitch + (to - this.camPitch) * (1 - Math.exp(-dt * 8));
      } else this.camPitch = fit(this.camPitch + look.dy * LOOK);
      step(this.body, this.#input(this.camYaw), w.level, dt);
    } else if (this.mode === 'eye') {
      const look = this.pad.takeLook();
      this.eyeYaw -= look.dx * LOOK;
      // 観戦は三人称の範囲で止める。はみ出した分を溜めると、逆へ動かしても反応しなくなる
      const [lo, hi] = this.watch ? [CAM_PITCH_MIN, CAM_PITCH_MAX] : [-1.3, 1.3];
      this.eyePitch = Math.min(hi, Math.max(lo, this.eyePitch + look.dy * LOOK));
      // 壁際で跳ぶと張り付いてしまうので、ふつうの跳び上がりのときだけ通す
      const jump = this.#jump && wallNear(this.ghost, w.level) === null;
      if (!this.watch) step(this.ghost, { ...this.#input(this.eyeYaw), jump }, w.level, dt);
    } else {
      const o = this.pad.takeOrbit();
      const look = this.pad.takeLook();
      this.orbitYaw -= o.dx * ORBIT + look.dx * LOOK;
      this.orbitPitch = Math.min(1.3, Math.max(-1.0, this.orbitPitch + o.dy * ORBIT + look.dy * LOOK));
      this.orbitDist = Math.min(3.5, Math.max(0.5, this.orbitDist / o.zoom));
    }
    this.#jump = this.#release = false;
    // 押していたボタンは張り付きが終わると消えて pointerup が届かないので、離れたあとに残さない
    if (!this.body.cling) this.held.up = this.held.down = false;
    // 回るボタンも壁では消える
    if (this.body.cling?.kind === 'wall') this.held.turn = 0;
    const clung = this.body.cling?.kind ?? null;
    if (clung && !this.cling) sounds.cling();
    this.cling = clung;
    this.nearWall = !this.body.cling && wallNear(this.body, w.level) !== null;
    w.placeDoll(this.body);
    w.poses.step(dt);
    // 部屋の中と分かっている点（天井では pos が天井の高さなので下へ下げる）。カメラを殻の外へ出さない線の始点
    const inside: V3 = [
      this.body.pos[0],
      this.body.pos[1] + (this.body.cling?.kind === 'ceiling' ? -0.4 : 0.4),
      this.body.pos[2]
    ];
    if (this.mode === 'walk') {
      const lift = this.body.cling?.kind === 'ceiling' ? -0.4 : 0.85;
      const t: V3 = [this.body.pos[0], this.body.pos[1] + lift, this.body.pos[2]];
      w.follow(this.#focus(t, dt), this.camYaw, this.camPitch, 2.4, 60, dt, inside);
    } else if (this.mode === 'paint')
      w.follow(this.#focus(w.dollCenter(), dt), this.orbitYaw, this.orbitPitch, this.orbitDist, 60, dt, inside);
    else if (this.watch) w.follow(this.watch, this.eyeYaw, this.eyePitch, 2.4, 60, dt, this.watch);
    else {
      const eye = EYE_HEIGHT - (this.crouch ? CROUCH : 0);
      w.eye([this.ghost.pos[0], this.ghost.pos[1] + eye, this.ghost.pos[2]], this.eyeYaw, this.eyePitch);
    }
    if (this.mode !== 'paint' || (!this.#stroke && now > this.#cursorUntil)) w.cursor(null, 0);
    // 張り付いているあいだは体が面に載っているので、その面を透かすと穴があくだけになる
    w.xray(this.mode !== 'eye' && !this.body.cling);
    w.holdBrush(this.mode === 'paint');
    w.render();
  }
}
