import * as THREE from 'three';
import { LANES } from './course';
import {
  BOSS_AHEAD,
  JUMP_TIME,
  speed,
  type Drop,
  type Obstacle,
  type RunEvent,
  type RunState,
  type Walker
} from './engine';
import {
  barricade,
  boss,
  CAMERA,
  cheer,
  fence,
  gate,
  LANE_W,
  pole,
  runner,
  SEG,
  street,
  walker,
  warnRing,
  wave,
  type Figure
} from './models';

/** 町並みの区間の数。SEG × この数が見える奥行きになる（先は霧で消す） */
const SEGS = 7;
/** 通行人と障害物は、この距離より先と、後ろのこの距離より手前だけ組み立てておく */
const AHEAD = 110;
// すれ違ったものはすぐ消す。カメラと走る子のあいだに残ると画面の下を大きくふさぐ
const BEHIND = 1.5;
/** 後ろをついて走るファンの見える数 */
const FANS = 20;
/** 音の輪が飛ぶ速さ（m/s）と、消えるまでの秒 */
const WAVE_SPEED = 40;
const WAVE_LIFE = 0.35;

const near = new THREE.Vector3();
const far = new THREE.Vector3();

const laneX = (lane: number) => (lane - (LANES - 1) / 2) * LANE_W;

/** 走る子の足の振り。振る速さは走る速さに合わせる */
function swing(fig: Figure, phase: number, amount: number) {
  const a = Math.sin(phase) * amount;
  fig.legs[0].rotation.x = a;
  fig.legs[1].rotation.x = -a;
  fig.arms[0].rotation.x = -a * 0.8;
  fig.arms[1].rotation.x = a * 0.8;
}

export class RunWorld {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 140);
  readonly #sun = new THREE.DirectionalLight('#fff4e0', 2.4);
  readonly #hero = runner();
  #heroX = laneX(1);
  #phase = 0;
  #t = 0;
  #made = 0;
  readonly #segments: THREE.Group[] = [];
  readonly #walkers = new Map<Walker, Figure>();
  readonly #blocks = new Map<Obstacle, THREE.Group>();
  readonly #fans: Figure[] = [];
  readonly #rings = new Map<Drop, THREE.Mesh>();
  readonly #waves: { mesh: THREE.Mesh; age: number }[] = [];
  readonly #boss = boss();
  #bossX = laneX(1);
  readonly #gate = gate();

  constructor(canvas: HTMLCanvasElement, s: RunState) {
    // デフォルメのローポリなので、iPad の dpr 2 + MSAA は見た目に効かず描画だけ重い
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color('#a9d6f5');
    this.scene.fog = new THREE.Fog('#cfe6f7', 45, 105);
    this.scene.add(new THREE.HemisphereLight('#eaf6ff', '#b9b2a6', 2.2));
    this.#sun.castShadow = true;
    this.#sun.shadow.mapSize.set(1024, 1024);
    const c = this.#sun.shadow.camera;
    c.left = c.bottom = -10;
    c.right = c.top = 10;
    c.near = 1;
    c.far = 30;
    this.scene.add(this.#sun, this.#sun.target);
    for (let i = 0; i < SEGS; i++) {
      const seg = street(i);
      this.#segments.push(seg);
      this.scene.add(seg);
    }
    this.#boss.group.visible = false;
    this.#gate.group.visible = false;
    this.scene.add(this.#hero.group, this.#boss.group, this.#gate.group);
    this.update(s, 0);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** シェーダーの準備。済むまで走り出さない */
  precompile(): Promise<unknown> {
    // compileAsync は見えているものしか準備しない。隠してある校門とボスもこのときだけ見せる（次の update で戻る）
    this.#gate.group.visible = true;
    this.#boss.group.visible = true;
    // 音の輪と警告の輪は transparent で別のシェーダーになる。最初の 1 発と最初の落下物で初めて作るとそこで止まるので、先に作らせる
    const probes = [wave(), warnRing()];
    for (const m of probes) {
      m.position.copy(this.#hero.group.position);
      this.scene.add(m);
    }
    const drop = () => this.scene.remove(...probes);
    const done = this.renderer.compileAsync(this.scene, this.camera);
    done.then(drop, drop);
    return done;
  }

  handle(e: RunEvent): void {
    if (e.type === 'shot') {
      const mesh = wave();
      mesh.position.set(this.#heroX, 0.9, this.#hero.group.position.z - 0.6);
      this.scene.add(mesh);
      this.#waves.push({ mesh, age: 0 });
      return;
    }
    if (e.type !== 'hit') return;
    const fig = this.#walkers.get(e.walker);
    if (!fig) return;
    this.#walkers.delete(e.walker);
    if (this.#fans.length >= FANS) {
      this.scene.remove(fig.group);
      return;
    }
    cheer(fig);
    fig.group.scale.setScalar(0.75);
    this.#fans.push(fig);
  }

  update(s: RunState, dt: number): void {
    this.#t += dt;
    const v = speed(s);
    this.#phase += dt * (4 + v * 1.4);
    const z = -s.z;
    this.#heroX += (laneX(s.lane) - this.#heroX) * Math.min(1, dt * 14);
    const air = s.air > 0 ? 1 - s.air / JUMP_TIME : 0;
    const hero = this.#hero;
    hero.group.position.set(this.#heroX, air > 0 ? 3.6 * air * (1 - air) : 0, z);
    hero.group.rotation.z = s.stumble > 0 ? Math.sin(this.#t * 30) * 0.2 : 0;
    swing(hero, this.#phase, s.result ? 0 : air > 0 ? 0.3 : 0.9);

    const camX = this.#heroX * 0.6;
    this.camera.position.set(camX, CAMERA.up, z + CAMERA.back);
    this.camera.lookAt(camX, CAMERA.lookUp, z - CAMERA.look);
    this.#sun.position.set(this.#heroX + 4, 12, z + 4);
    this.#sun.target.position.set(this.#heroX, 0, z - 6);

    const base = Math.floor(s.z / SEG) - 1;
    this.#segments.forEach((seg, i) => {
      const k = base + ((((i - base) % SEGS) + SEGS) % SEGS);
      seg.position.z = -k * SEG;
    });

    this.#syncWalkers(s);
    this.#syncBlocks(s);
    this.#fans.forEach((fig, i) => {
      // 走る子とカメラのあいだに入ると画面の下をふさぐので、左右の脇に寄せて並べる
      const side = i % 2 ? 1 : -1;
      const col = Math.floor(i / 2);
      const tx = this.#heroX + side * (0.9 + (col % 3) * 0.45);
      const tz = z + 0.2 + Math.floor(col / 3) * 0.7;
      const p = fig.group.position;
      const k = Math.min(1, dt * 6);
      p.set(p.x + (tx - p.x) * k, Math.abs(Math.sin(this.#phase + i)) * 0.12, p.z + (tz - p.z) * k);
      swing(fig, this.#phase + i, 0.8);
    });

    const b = s.boss;
    this.#boss.group.visible = b?.phase === 'fight';
    if (b?.phase === 'fight') {
      this.#bossX += (laneX(b.lane) - this.#bossX) * Math.min(1, dt * 4);
      this.#boss.group.position.set(this.#bossX, 2.2 + Math.sin(this.#t * 2) * 0.25, z - BOSS_AHEAD);
    }
    this.#syncRings(b?.drops ?? []);
    for (const w of this.#waves) {
      w.age += dt;
      w.mesh.position.z -= WAVE_SPEED * dt;
      w.mesh.scale.setScalar(1 + w.age * 4);
      if (w.age > WAVE_LIFE) this.scene.remove(w.mesh);
    }
    this.#waves.splice(0, this.#waves.length, ...this.#waves.filter((w) => w.age <= WAVE_LIFE));

    this.#gate.group.visible = Number.isFinite(s.goal);
    if (Number.isFinite(s.goal)) this.#gate.group.position.z = -s.goal;
  }

  #syncWalkers(s: RunState) {
    for (const w of s.walkers) {
      if (w.fan) continue;
      const ahead = w.z - s.z;
      let fig = this.#walkers.get(w);
      if (ahead > AHEAD || ahead < -BEHIND) {
        if (fig) {
          this.scene.remove(fig.group);
          this.#walkers.delete(w);
        }
        continue;
      }
      if (!fig) {
        fig = walker(this.#made++);
        this.#walkers.set(w, fig);
        this.scene.add(fig.group);
      }
      // 同じレーンですれ違う通行人は、ぶつからずに脇へよけてくれる
      const dodge = w.lane === s.lane && ahead < 3 ? (1 - Math.max(0, ahead) / 3) * 0.8 * (w.lane === 0 ? 1 : -1) : 0;
      fig.group.position.set(laneX(w.lane) + dodge, 0, -w.z);
      swing(fig, this.#phase * 0.5 + w.z, 0.5);
    }
  }

  #syncBlocks(s: RunState) {
    for (const o of s.blocks) {
      const ahead = o.z - s.z;
      let g = this.#blocks.get(o);
      if (ahead > AHEAD || ahead < -BEHIND) {
        if (g) {
          this.scene.remove(g);
          this.#blocks.delete(o);
        }
        continue;
      }
      if (!g) {
        g = o.kind === 'low' ? barricade() : o.look ? pole() : fence();
        this.#blocks.set(o, g);
        this.scene.add(g);
      }
      g.position.set(laneX(o.lane), 0, -o.z);
      // ぶつかったものは倒れて見せる
      g.rotation.x = o.hit ? -0.5 : 0;
    }
  }

  #syncRings(drops: Drop[]) {
    for (const [d, ring] of this.#rings)
      if (!drops.includes(d)) {
        this.scene.remove(ring);
        this.#rings.delete(d);
      }
    for (const d of drops) {
      let ring = this.#rings.get(d);
      if (!ring) {
        ring = warnRing();
        this.#rings.set(d, ring);
        this.scene.add(ring);
      }
      ring.position.set(laneX(d.lane), 0.03, -d.z);
      ring.scale.setScalar(1 + Math.sin(this.#t * 12) * 0.12);
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  /** レーン・距離・高さ（m）を、画面のピクセルと、そこでの 1 m あたりのピクセル数へ */
  project(lane: number, dist: number, height: number, w: number, h: number): [number, number, number] {
    const p = near.set(laneX(lane), height, -dist).project(this.camera);
    const q = far.set(laneX(lane) + 1, height, -dist).project(this.camera);
    return [((p.x + 1) / 2) * w, ((1 - p.y) / 2) * h, (Math.abs(q.x - p.x) / 2) * w];
  }

  dispose(): void {
    // mat() の material と geometry はモジュールで共有していて次の面でも使うので、ここで作った看板だけ捨てる
    this.#gate.dispose();
    this.renderer.dispose();
    // dispose() だけではコンテキストが残り、Safari は十数個で古いものを失う
    this.renderer.forceContextLoss();
  }
}
