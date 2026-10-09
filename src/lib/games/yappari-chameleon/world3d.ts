import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { bakePose, PoseAnimator, type DollRig } from './doll3d';
import { cameraReach, settleDist, type Body, type DistState, type Level } from './move';
import { placement } from './shots';
import { finish, rainbowMottle, readPick } from './textures';
import { seeThrough, XRAY } from './xray';

/** 一人称の縦の視野。本家の 16:9 の画面での横 105 度と同じ見え方 */
export const EYE_FOV = 72;

export interface Built {
  group: THREE.Group;
  level: Level;
}

/**
 * カメラの線の太さ。体は壁から RADIUS 離れて歩くので、同じ太さにすると壁ぎわを歩くあいだ縁の線がずっと壁をかすめて、距離が潰れる
 */
const CAM_RADIUS = 0.12;

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
  readonly rig: DollRig;
  readonly poses: PoseAnimator;
  level: Level = { boxes: [], ramps: [], spawn: [0, 0, 0] };
  #stage: THREE.Group | null = null;
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
  #brush = new THREE.Group();
  #baked = -1;
  #center = new THREE.Vector3();
  #ease: DistState = { dist: 2.4, wait: 0 };
  #snap = false;
  #w = 1;
  #h = 1;

  constructor(canvas: HTMLCanvasElement, rig: (r: THREE.WebGLRenderer) => DollRig, onRestore: () => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
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
    const top = new THREE.DirectionalLight('#fff1dc', 1.6);
    // 屋敷の全体（x −24〜8、z −1〜13）を 1 枚の影で覆う
    top.position.set(-8, 20, 6);
    top.target.position.set(-8, 0, 6);
    top.castShadow = true;
    top.shadow.mapSize.set(2048, 2048);
    top.shadow.camera.left = -17;
    top.shadow.camera.right = 17;
    top.shadow.camera.top = 8;
    top.shadow.camera.bottom = -8;
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
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.014, 0.36, 12),
      finish({ pattern: rainbowMottle(), rough: 0.5 }, [0.08, 0.36])
    );
    const ferrule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.014, 0.05, 12),
      finish({ tint: '#c9a227', metal: 1, rough: 0.35 }, [0.1, 0.05])
    );
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.07, 12),
      finish({ tint: '#2b2420', rough: 0.9 }, [0.1, 0.07])
    );
    ferrule.position.y = 0.2;
    tip.position.y = 0.26;
    this.#brush.add(handle, ferrule, tip);
    // 手の楕円体（doll.ts の [-0.538, 0.616, 0]）を、前腕の骨の付け根 [-0.354, 0.745, 0] からの差で指す。穂先を下にして腰のわきへ垂らす（横へ寝かせると床に付く）
    this.#brush.position.set(-0.184, -0.129, 0.03);
    this.#brush.rotation.set(Math.PI - 0.5, 0, 0.2);
    this.#brush.visible = false;
    this.rig.bones['forearm.r'].add(this.#brush);
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

  placeDoll(b: Body): void {
    const root = this.rig.root;
    const p = placement(b);
    root.rotation.order = 'YXZ';
    root.rotation.set(p.tilt, p.yaw, 0);
    root.position.set(...p.at);
    root.updateMatrixWorld(true);
    const ring = this.#ring;
    ring.visible = !!b.cling;
    if (b.cling?.kind === 'wall') {
      ring.position.set(root.position.x, b.pos[1] + 0.58, root.position.z);
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
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.#stage?.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        (m as THREE.MeshStandardMaterial).map?.dispose();
        m.dispose();
      }
    });
    XRAY.on.value = 0;
    this.#environment?.dispose();
    this.rig.paint.dispose();
    this.#cursor.geometry.dispose();
    this.#cursor.material.dispose();
    this.#ring.geometry.dispose();
    this.#ring.material.dispose();
    this.#brush.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      (o.material as THREE.MeshStandardMaterial).map?.dispose();
      o.material.dispose();
    });
    this.renderer.dispose();
    // iOS は WebGL の文脈の数に上限があり、ゲームを開閉するたびに残すと古いものから失われていく
    this.renderer.forceContextLoss();
  }
}
