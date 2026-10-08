import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { PoseAnimator, type DollRig } from './doll3d';
import { rayDistance, RADIUS, type Body, type Level } from './move';
import { readPick } from './textures';

/** 一人称の縦の視野。本家の 16:9 の画面での横 105 度と同じ見え方 */
export const EYE_FOV = 72;

export interface Built {
  group: THREE.Group;
  level: Level;
}

/** 体の厚みの半分。張り付いたときに壁や天井と体の間を空けない */
const HALF_DEPTH = 0.12;

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
    top.position.set(3, 10, 2);
    top.castShadow = true;
    top.shadow.mapSize.set(2048, 2048);
    top.shadow.camera.left = top.shadow.camera.bottom = -14;
    top.shadow.camera.right = top.shadow.camera.top = 14;
    top.shadow.bias = -0.0004;
    top.shadow.normalBias = 0.02;
    this.scene.add(top, top.target);
    this.rig = rig(this.renderer);
    this.poses = new PoseAnimator(this.rig);
    this.scene.add(this.rig.root);
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
    root.rotation.order = 'YXZ';
    root.rotation.set(0, b.yaw, 0);
    root.position.set(b.pos[0], b.pos[1], b.pos[2]);
    if (b.cling?.kind === 'wall') {
      root.position.x -= b.cling.nx * (RADIUS - HALF_DEPTH);
      root.position.z -= b.cling.nz * (RADIUS - HALF_DEPTH);
    } else if (b.cling?.kind === 'ceiling') {
      // 背中を天井に付け、前を下へ向ける
      root.rotation.x = Math.PI / 2;
      root.position.y = b.pos[1] - HALF_DEPTH;
    }
    root.updateMatrixWorld(true);
  }

  /** 体の真ん中（ペイントのカメラが回る中心）。ポーズで変わるので骨の外接球から出す */
  dollCenter(): V3 {
    const m = this.rig.mesh;
    m.computeBoundingSphere();
    const c = m.boundingSphere!.center.clone().applyMatrix4(m.matrixWorld);
    return [c.x, c.y, c.z];
  }

  /** target のまわりを回る三人称のカメラ。壁の向こうへ行かないよう、手前で止める */
  follow(target: V3, yaw: number, pitch: number, dist: number, fov: number): void {
    const dir: V3 = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    const d = Math.max(0.3, Math.min(dist, rayDistance(this.level, target, dir, dist) - 0.15));
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(target[0] + dir[0] * d, target[1] + dir[1] * d, target[2] + dir[2] * d);
    this.camera.lookAt(target[0], target[1], target[2]);
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
    return this.#cast(x, y, [this.rig.mesh]);
  }

  spoit(x: number, y: number): { color: RGB; metal: number; rough: number } | null {
    const hit = this.#cast(x, y, [this.rig.mesh, ...(this.#stage ? [this.#stage] : [])]);
    if (!hit) return null;
    if (hit.object === this.rig.mesh) return hit.uv ? this.rig.paint.read(hit.uv) : null;
    const m = (hit.object as THREE.Mesh).material;
    return readPick(Array.isArray(m) ? m[0] : m, hit.uv);
  }

  project(p: V3): { x: number; y: number } {
    const v = new THREE.Vector3(...p).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.#w, y: ((1 - v.y) / 2) * this.#h };
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.#environment?.dispose();
    this.rig.paint.dispose();
    this.renderer.dispose();
  }
}
