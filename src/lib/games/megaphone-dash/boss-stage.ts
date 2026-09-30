import * as THREE from 'three';
import { bossModel, gridTexture, type BossModel } from './boss3d';
import { BOSS_AHEAD, type Drop, type RunEvent, type RunState } from './engine';

/** トンネルの長さ（m）。走る子を真ん中あたりに置いて、一緒に進める */
const TUNNEL = 160;
/** ボスの大きさ。画面の上の半分を占めるくらいにして、迫力を出す */
const SIZE = 1.8;

/**
 * ボスの場面。赤い格子のトンネルでまわりを包み、ボスを浮かべ、ふまん玉の落ちる場所に印を出す。
 * 3D の場面（world3d）はこれに出来事を渡して、毎フレーム update を呼ぶだけ
 */
export class BossStage {
  readonly #scene: THREE.Scene;
  readonly #boss: BossModel;
  readonly #tunnel = new THREE.Group();
  readonly #tunnelMats: THREE.MeshBasicMaterial[] = [];
  readonly #texture = gridTexture();
  readonly #rings = new Map<Drop, THREE.Mesh>();
  readonly #ringGeo = new THREE.RingGeometry(0.45, 0.65, 32);
  readonly #ringMat = new THREE.MeshBasicMaterial({
    color: '#ff2a3d',
    transparent: true,
    opacity: 0.9,
    depthWrite: false
  });
  /** トンネルの濃さ（0 で無し、1 で包む）と、その向かう先 */
  #fog = 0;
  #fogTo = 0;
  #flash = 0;
  /** 倒れてから消えるまでの経過（負なら生きている） */
  #dying = -1;
  #x = 0;
  #t = 0;

  constructor(scene: THREE.Scene, width: number) {
    this.#scene = scene;
    this.#boss = bossModel();
    this.#boss.group.visible = false;
    // 赤黒い場面の中でも顔が見えるよう、正面から明かりを当てる
    const light = new THREE.PointLight('#ffd6de', 40, 14, 1.6);
    light.position.set(0, -0.3, 3.5);
    this.#boss.group.add(light);
    scene.add(this.#boss.group);
    const wall = (w: number, h: number, pos: THREE.Vector3, rot: THREE.Euler) => {
      const t = this.#texture.clone();
      t.repeat.set(w / 2, h / 2);
      t.needsUpdate = true;
      const m = new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        opacity: 0,
        fog: false,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      this.#tunnelMats.push(m);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
      mesh.position.copy(pos);
      mesh.rotation.copy(rot);
      this.#tunnel.add(mesh);
    };
    const half = width / 2;
    wall(TUNNEL, 3.2, new THREE.Vector3(-half, 1.6, 0), new THREE.Euler(0, Math.PI / 2, 0));
    wall(TUNNEL, 3.2, new THREE.Vector3(half, 1.6, 0), new THREE.Euler(0, -Math.PI / 2, 0));
    wall(width, TUNNEL, new THREE.Vector3(0, 3.2, 0), new THREE.Euler(Math.PI / 2, 0, 0));
    wall(width, TUNNEL, new THREE.Vector3(0, 0.01, 0), new THREE.Euler(-Math.PI / 2, 0, 0));
    this.#tunnel.visible = false;
    // トンネルは半透明で、中の人や障害物より先に描く
    this.#tunnel.renderOrder = -0.5;
    scene.add(this.#tunnel);
  }

  /** 場面の色をボスの場面へ寄せる割合（0..1） */
  get mood(): number {
    return this.#fog;
  }

  /** シェーダーの準備のあいだだけ、隠してあるボスとトンネルを見せる */
  reveal(): void {
    this.#boss.group.visible = true;
    this.#tunnel.visible = true;
  }

  conceal(): void {
    this.#boss.group.visible = false;
    this.#tunnel.visible = false;
  }

  handle(e: RunEvent): void {
    if (e.type === 'boss-in') {
      this.#fogTo = 1;
      this.#boss.group.visible = true;
      this.#boss.group.scale.setScalar(0.01);
    } else if (e.type === 'boss-hit') this.#flash = e.big ? 1 : Math.max(this.#flash, 0.45);
    else if (e.type === 'boss-down') {
      this.#dying = 0;
      this.#fogTo = 0;
    }
  }

  update(s: RunState, dt: number): void {
    this.#t += dt;
    const b = s.boss;
    this.#fog += (this.#fogTo - this.#fog) * Math.min(1, dt * 2.5);
    this.#tunnel.visible = this.#fog > 0.01;
    for (const m of this.#tunnelMats) m.opacity = this.#fog;
    this.#tunnel.position.set(0, 0, -s.z - 40);
    this.#flash = Math.max(0, this.#flash - dt * 3);
    this.#boss.skin.emissiveIntensity = this.#flash * 0.9;
    this.#boss.eyes.emissiveIntensity = 1.4 + Math.sin(this.#t * 8) * 0.4;
    const g = this.#boss.group;
    if (b && b.phase !== 'wait' && g.visible) {
      this.#x += (b.x - this.#x) * Math.min(1, dt * 4);
      const hitShake = this.#flash * 0.15;
      g.position.set(
        this.#x + (Math.random() - 0.5) * hitShake,
        2.4 + Math.sin(this.#t * 2.2) * 0.25,
        -(s.z + BOSS_AHEAD)
      );
      g.rotation.z = Math.sin(this.#t * 1.3) * 0.08;
      if (this.#dying < 0) g.scale.setScalar(Math.min(SIZE, g.scale.x + dt * 4));
      else {
        // 倒れたら、ふくらんで回りながら消える
        this.#dying += dt;
        const k = this.#dying / 0.9;
        g.scale.setScalar(SIZE * (1 + k * 0.8));
        g.rotation.y += dt * 12;
        if (k >= 1) g.visible = false;
      }
    }
    this.#syncRings(b?.drops ?? []);
  }

  #syncRings(drops: Drop[]) {
    for (const [d, ring] of this.#rings)
      if (!drops.includes(d)) {
        this.#scene.remove(ring);
        this.#rings.delete(d);
      }
    for (const d of drops) {
      let ring = this.#rings.get(d);
      if (!ring) {
        ring = new THREE.Mesh(this.#ringGeo, this.#ringMat);
        ring.rotation.x = -Math.PI / 2;
        this.#rings.set(d, ring);
        this.#scene.add(ring);
      }
      ring.position.set(d.x, 0.03, -d.z);
      ring.scale.setScalar(1 + Math.sin(this.#t * 14) * 0.12);
    }
  }

  dispose(): void {
    this.#boss.dispose();
    this.#texture.dispose();
    this.#tunnel.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    for (const m of this.#tunnelMats) {
      m.map?.dispose();
      m.dispose();
    }
    this.#ringGeo.dispose();
    this.#ringMat.dispose();
  }
}
