import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { bakePose, PoseAnimator, type DollRig } from './doll3d';
import { cameraReach, settleDist, type Body, type DistState, type Level } from './move';
import { brushModel, disposeModel, inHand } from './gun';
import { placement, type Placeable } from './shots';
import { readPick } from './textures';
import { seeThrough, XRAY } from './xray';

/** 一人称の縦の視野。本家の 16:9 の画面での横 105 度と同じ見え方 */
export const EYE_FOV = 72;

export interface Built {
  group: THREE.Group;
  level: Level;
  glow?: (on: boolean) => void;
  sunless?: (at: V3) => boolean;
  /** 試合の小物の置き方にする（3D は作り直さずに動かす）。新しい当たりを返す */
  arrange?: (seed: number | null) => Level;
}

/**
 * カメラの線の太さ。体は壁から RADIUS 離れて歩くので、同じ太さにすると壁ぎわを歩くあいだ縁の線がずっと壁をかすめて、距離が潰れる
 */
const CAM_RADIUS = 0.12;
const SUN = 1.6;

/** 体の根元を、張り付き（壁から離す・天井で寝かせる）も込みで置く。ほかの人の体も同じ置き方にする */
export function placeRoot(root: THREE.Object3D, b: Placeable): void {
  const p = placement(b);
  root.rotation.order = 'YXZ';
  root.rotation.set(p.tilt, p.yaw, 0);
  root.position.set(...p.at);
  root.updateMatrixWorld(true);
}

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
  readonly rig: DollRig;
  readonly poses: PoseAnimator;
  /** 一人称の手と銃の場面。屋敷の深さを消してから重ねて描くので、壁に近づいても銃が壁に埋まらない */
  readonly overlay = new THREE.Scene();
  /** overlay の中で、描く直前にカメラへ合わせる枠 */
  readonly hand = new THREE.Group();
  level: Level = { boxes: [], ramps: [], spawn: [0, 0, 0] };
  #stage: THREE.Group | null = null;
  #built: Built | null = null;
  #sun = new THREE.DirectionalLight('#fff1dc', SUN);
  #environment: THREE.WebGLRenderTarget | null = null;
  #ray = new THREE.Raycaster();
  #cursor = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 48),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false })
  );
  #ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62, 0.68, 64),
    new THREE.MeshBasicMaterial({
      color: '#e0302a',
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  #brush = brushModel();
  #baked = -1;
  #center = new THREE.Vector3();
  #ease: DistState = { dist: 2.4, wait: 0 };
  #snap = false;
  #w = 1;
  #h = 1;

  constructor(canvas: HTMLCanvasElement, rig: (r: THREE.WebGLRenderer) => DollRig, onRestore: () => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, stencil: true });
    // 遊ぶ端末（iPad Air 2025）の力に合わせた固定値
    this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.#buildEnvironment();
    // iOS が裏に回したときに失うと、環境光の画像も塗りのテクスチャも空になる。戻ったら作り直す
    canvas.addEventListener('webglcontextrestored', () => {
      // 古い画像の GL の物は文脈ごと消えているので、片付けずに手放す（片付けると別の文脈の物を消そうとして警告が出る）
      this.#environment = null;
      this.#buildEnvironment();
      onRestore();
    });
    this.scene.background = new THREE.Color('#1d1a17');
    this.scene.add(new THREE.HemisphereLight('#fff4e0', '#5a4a3a', 1.1));
    const top = this.#sun;
    // 屋敷の全体（x −24〜18、z −7〜17）を 1 枚の影で覆う
    top.position.set(-3, 20, 5);
    top.target.position.set(-3, 0, 5);
    top.castShadow = true;
    top.shadow.mapSize.set(2048, 2048);
    top.shadow.camera.left = -21;
    top.shadow.camera.right = 21;
    top.shadow.camera.top = 12;
    top.shadow.camera.bottom = -12;
    // 奥行きの範囲を光の高さ（20m）の前後に絞る。既定の far 500 だと bias の -0.0004 が 20cm にもなって影が浮く
    top.shadow.camera.near = 1;
    top.shadow.camera.far = 30;
    top.shadow.bias = -0.0004;
    top.shadow.normalBias = 0.02;
    this.scene.add(top, top.target);
    this.rig = rig(this.renderer);
    this.poses = new PoseAnimator(this.rig);
    this.scene.add(this.rig.root);
    this.#cursor.visible = false;
    this.#cursor.renderOrder = 10;
    this.scene.add(this.#cursor);
    this.#ring.visible = false;
    this.scene.add(this.#ring);
    inHand(this.rig.bones['forearm.r'], this.#brush, 'brush');
    this.overlay.visible = false;
    this.overlay.add(new THREE.HemisphereLight('#fff4e0', '#5a4a3a', 2), this.hand);
  }

  #buildEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.#environment?.dispose();
    this.#environment = pmrem.fromScene(env, 0.04);
    this.scene.environment = this.#environment.texture;
    this.scene.environmentIntensity = 0.45;
    env.dispose();
    pmrem.dispose();
  }

  setStage(b: Built): void {
    this.#built = b;
    this.#stage?.removeFromParent();
    this.#stage = b.group;
    this.level = b.level;
    this.scene.add(b.group);
    b.group.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) for (const one of Array.isArray(m) ? m : [m]) seeThrough(one);
    });
  }

  resize(w: number, h: number): void {
    this.#w = w;
    this.#h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  placeDoll(b: Body & { pose?: string }): void {
    const root = this.rig.root;
    placeRoot(root, b);
    const ring = this.#ring;
    ring.visible = !!b.cling;
    if (b.cling?.kind === 'wall') {
      // ポーズで面から離した根元ではなく、面に付けたときの位置に出す。輪は張り付いた面の印
      const [x, , z] = placement({ pos: b.pos, yaw: b.yaw, cling: b.cling }).at;
      ring.position.set(x, b.pos[1] + 0.58, z);
      ring.lookAt(ring.position.x + b.cling.nx, ring.position.y, ring.position.z + b.cling.nz);
    } else if (b.cling?.kind === 'ceiling') {
      // 天井では体が横たわるので、輪は足もとではなく体の真ん中に置く
      const mid = root.localToWorld(new THREE.Vector3(0, 0.58, 0));
      ring.position.set(mid.x, b.pos[1] - 0.02, mid.z);
      ring.lookAt(mid.x, b.pos[1] - 1, mid.z);
    }
  }

  /** 隠れる側が塗っているのが見えるよう、ペイントモードのあいだだけ右手に絵筆を持つ */
  holdBrush(on: boolean): void {
    this.#brush.visible = on;
  }

  podium(on: boolean): void {
    this.#built?.glow?.(on);
  }

  /** 小物を種の置き方へ動かし、当たりも入れ替える */
  arrange(seed: number | null): void {
    const a = this.#built?.arrange;
    if (a) this.level = a(seed);
  }

  /** 今のポーズの当たり用の体。骨が動いたときだけ焼き直す（焼くのに 8ms ほどかかる） */
  #body(): THREE.Mesh {
    if (this.poses.version !== this.#baked) {
      this.#baked = this.poses.version;
      this.#center.copy(bakePose(this.rig));
    }
    return this.rig.pick;
  }

  /** 体の真ん中（ペイントのカメラが回る中心）。ポーズで変わるので骨で曲げた形から出す */
  dollCenter(): V3 {
    this.#body();
    const c = this.#center.clone().applyMatrix4(this.rig.mesh.matrixWorld);
    return [c.x, c.y, c.z];
  }

  /** target のまわりを回る三人称のカメラ。壁の向こうへ行かないよう、手前で止める */
  follow(target: V3, yaw: number, pitch: number, dist: number, fov: number, dt: number, from?: V3): void {
    const dir: V3 = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    // 太さを持った線で測る。細い線だと壁をかすめる角度で当たったり外れたりして、寄り引きを繰り返す
    const { limit, blocked } = cameraReach(this.level, target, dir, dist, from, CAM_RADIUS);
    settleDist(this.#ease, limit, blocked, dt, this.#snap);
    this.#snap = false;
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    const d = this.#ease.dist;
    this.camera.position.set(target[0] + dir[0] * d, target[1] + dir[1] * d, target[2] + dir[2] * d);
    this.camera.lookAt(target[0], target[1], target[2]);
  }

  /** 今の三人称の見る中心からカメラまでの距離 */
  get dist(): number {
    return this.#ease.dist;
  }

  /** 三人称の距離のなめらかさを捨て、次の follow で目標の距離へ飛ぶ（フリーカメラへ出入りするとき） */
  snapCamera(): void {
    this.#snap = true;
  }

  eye(pos: V3, yaw: number, pitch: number): void {
    this.camera.fov = EYE_FOV;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(...pos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(-pitch, yaw + Math.PI, 0);
  }

  #cast(x: number, y: number, list: THREE.Object3D[]): THREE.Intersection | null {
    this.#ray.setFromCamera(new THREE.Vector2((x / this.#w) * 2 - 1, -(y / this.#h) * 2 + 1), this.camera);
    return this.#ray.intersectObjects(list, true)[0] ?? null;
  }

  pickBody(x: number, y: number): THREE.Intersection | null {
    return this.#cast(x, y, [this.#body()]);
  }

  /** 体の上の当たりに、面に沿った筆の半径の輪を置く。指の下が見えないタッチで、塗る所と大きさを見せる */
  cursor(hit: THREE.Intersection | null, radius: number): void {
    const c = this.#cursor;
    c.visible = !!hit?.normal;
    if (!hit?.normal) return;
    const n = hit.normal.clone().transformDirection(hit.object.matrixWorld);
    c.position.copy(hit.point).addScaledVector(n, 0.004);
    c.lookAt(hit.point.clone().add(n));
    c.scale.setScalar(radius);
  }

  spoit(x: number, y: number): { color: RGB; metal: number; rough: number } | null {
    const hit = this.#cast(x, y, [this.#body(), ...(this.#stage ? [this.#stage] : [])]);
    if (!hit) return null;
    if (hit.object === this.rig.pick) return hit.uv ? this.rig.paint.read(hit.uv) : null;
    const m = (hit.object as THREE.Mesh).material;
    // 壁や床の箱は面ごとに別の材質なので、当たった面の材質を読む
    return readPick(Array.isArray(m) ? m[hit.face?.materialIndex ?? 0] : m, hit.uv);
  }

  project(p: V3): { x: number; y: number } {
    const v = new THREE.Vector3(...p).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.#w, y: ((1 - v.y) / 2) * this.#h };
  }

  /** 画面の位置。カメラの後ろなら null（名前の札を出さない） */
  screen(p: V3): { x: number; y: number } | null {
    const v = new THREE.Vector3(...p).applyMatrix4(this.camera.matrixWorldInverse);
    return v.z < -this.camera.near ? this.project(p) : null;
  }

  // 自分の画面の位置（描画の画素、左下が原点）と、自分までの深さ
  xray(on: boolean): void {
    XRAY.on.value = on ? 1 : 0;
    if (!on) return;
    this.camera.updateMatrixWorld();
    const c = new THREE.Vector3(...this.dollCenter());
    const dist = -c.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
    const pr = this.renderer.getPixelRatio();
    const s = this.project([c.x, c.y, c.z]);
    const perMeter = (this.#h * pr) / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) / Math.max(dist, 0.1);
    XRAY.center.value.set(s.x * pr, (this.#h - s.y) * pr);
    XRAY.radius.value = 0.7 * perMeter;
    XRAY.depth.value = dist - 0.3;
  }

  render(): void {
    this.rig.paint.flush();
    // 日の影は屋敷だけを覆うので、影の外のロビーでは上を向いた面が日で白く飛ぶ。ロビーにカメラがあるあいだは日を消す
    // （光を足し引きすると材質の shader を作り直して止まるので、強さで消す）
    const c = this.camera.position;
    this.#sun.intensity = this.#built?.sunless?.([c.x, c.y, c.z]) ? 0 : SUN;
    this.renderer.render(this.scene, this.camera);
    if (!this.overlay.visible) return;
    this.hand.position.copy(this.camera.position);
    this.hand.quaternion.copy(this.camera.quaternion);
    const r = this.renderer;
    r.autoClear = false;
    r.clearDepth();
    r.render(this.overlay, this.camera);
    r.autoClear = true;
  }

  dispose(): void {
    if (this.#stage) disposeModel(this.#stage);
    XRAY.on.value = 0;
    this.#environment?.dispose();
    this.rig.paint.dispose();
    this.#cursor.geometry.dispose();
    this.#cursor.material.dispose();
    this.#ring.geometry.dispose();
    this.#ring.material.dispose();
    disposeModel(this.#brush);
    disposeModel(this.overlay);
    this.renderer.dispose();
    // iOS は WebGL の文脈の数に上限があり、ゲームを開閉するたびに残すと古いものから失われていく
    this.renderer.forceContextLoss();
  }
}
