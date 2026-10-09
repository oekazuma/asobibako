import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { rng } from './textures';

/** 1 試合で残すしぶきの数。超えたら古いものから消す */
export const SPLATS = 60;
const TRAIL_SECS = 0.3;
const BITS_SECS = 1.5;
const NOTE_SECS = 2;
const TRAIL_POINTS = 28;

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function splatTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (g) => {
    const r = rng(17);
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2;
      const d = i < 6 ? r() * 40 : 50 + r() * 70;
      g.fillStyle = i % 3 ? '#ffffff' : `hsl(${Math.floor(r() * 360)} 90% 58%)`;
      g.beginPath();
      g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, i < 6 ? 30 + r() * 30 : 4 + r() * 10, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function noteTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (g) => {
    g.font = 'bold 100px "Hiragino Mincho ProN", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#000';
    g.fillStyle = '#fff';
    g.strokeText('♪', 64, 68);
    g.fillText('♪', 64, 68);
  });
}

interface Aging<T> {
  o: T;
  age: number;
}

export class Effects {
  readonly #scene: THREE.Scene;
  readonly #splatMat = new THREE.MeshBasicMaterial({
    map: splatTexture(),
    transparent: true,
    depthWrite: false,
    // 面に重ねるので、同じ深さでちらつかないよう手前へ寄せる
    polygonOffset: true,
    polygonOffsetFactor: -4
  });
  readonly #splatGeo = new THREE.PlaneGeometry(0.45, 0.45);
  readonly #bitGeo = new THREE.IcosahedronGeometry(0.045, 0);
  readonly #noteMat = new THREE.SpriteMaterial({ map: noteTexture(), transparent: true, depthTest: false });
  #trails: Aging<THREE.Points>[] = [];
  #splats: THREE.Mesh[] = [];
  #bits: Aging<{ mesh: THREE.Mesh; v: THREE.Vector3 }[]>[] = [];
  #notes: Aging<{ sprite: THREE.Sprite; y: number }>[] = [];

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
  }

  trail(o: V3, ends: V3[]): void {
    const pos = new Float32Array(ends.length * TRAIL_POINTS * 3);
    const col = new Float32Array(pos.length);
    const c = new THREE.Color();
    let k = 0;
    for (const end of ends)
      for (let i = 0; i < TRAIL_POINTS; i++, k += 3) {
        const t = (i + Math.random() * 0.5) / TRAIL_POINTS;
        for (let a = 0; a < 3; a++) pos[k + a] = o[a] + (end[a] - o[a]) * t + (Math.random() - 0.5) * 0.04;
        c.setHSL(Math.random(), 0.9, 0.6);
        col.set([c.r, c.g, c.b], k);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, depthWrite: false })
    );
    this.#scene.add(points);
    this.#trails.push({ o: points, age: 0 });
  }

  splat(p: V3, n: V3): void {
    const m = new THREE.Mesh(this.#splatGeo, this.#splatMat);
    m.position.set(p[0] + n[0] * 0.004, p[1] + n[1] * 0.004, p[2] + n[2] * 0.004);
    m.lookAt(p[0] + n[0], p[1] + n[1], p[2] + n[2]);
    m.rotateZ(Math.random() * Math.PI * 2);
    m.scale.setScalar(0.7 + Math.random() * 0.6);
    this.#scene.add(m);
    this.#splats.push(m);
    if (this.#splats.length > SPLATS) this.#splats.shift()!.removeFromParent();
  }

  get splats(): number {
    return this.#splats.length;
  }

  shatter(at: V3, colors: RGB[]): void {
    const bits = colors.map((c) => {
      const mesh = new THREE.Mesh(
        this.#bitGeo,
        new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.6, transparent: true })
      );
      mesh.position.set(
        at[0] + (Math.random() - 0.5) * 0.3,
        at[1] + (Math.random() - 0.3) * 0.6,
        at[2] + (Math.random() - 0.5) * 0.3
      );
      mesh.scale.setScalar(0.6 + Math.random() * 0.9);
      this.#scene.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * 2.2, 1.5 + Math.random() * 2.5, Math.sin(a) * 2.2).multiplyScalar(
        0.5 + Math.random() * 0.7
      );
      return { mesh, v };
    });
    this.#bits.push({ o: bits, age: 0 });
  }

  note(at: V3): void {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 2;
    const sprite = new THREE.Sprite(this.#noteMat.clone());
    sprite.position.set(at[0] + Math.cos(a) * d, at[1] + 1.3, at[2] + Math.sin(a) * d);
    sprite.scale.setScalar(0.45);
    // 壁の向こうの口笛も見えるよう深さを見ずに最後に描く
    sprite.renderOrder = 30;
    this.#scene.add(sprite);
    this.#notes.push({ o: { sprite, y: sprite.position.y }, age: 0 });
  }

  clear(): void {
    for (const m of this.#splats) m.removeFromParent();
    this.#splats = [];
  }

  step(dt: number): void {
    this.#trails = this.#trails.filter((t) => {
      t.age += dt;
      (t.o.material as THREE.PointsMaterial).opacity = 1 - t.age / TRAIL_SECS;
      if (t.age < TRAIL_SECS) return true;
      t.o.removeFromParent();
      t.o.geometry.dispose();
      (t.o.material as THREE.Material).dispose();
      return false;
    });
    this.#bits = this.#bits.filter((b) => {
      b.age += dt;
      for (const { mesh, v } of b.o) {
        v.y -= 9.8 * dt;
        mesh.position.addScaledVector(v, dt);
        mesh.rotation.x += dt * 6;
        (mesh.material as THREE.MeshStandardMaterial).opacity = Math.min(1, (BITS_SECS - b.age) * 3);
      }
      if (b.age < BITS_SECS) return true;
      for (const { mesh } of b.o) {
        mesh.removeFromParent();
        (mesh.material as THREE.Material).dispose();
      }
      return false;
    });
    this.#notes = this.#notes.filter((n) => {
      n.age += dt;
      n.o.sprite.position.y = n.o.y + n.age * 0.25;
      n.o.sprite.material.opacity = Math.min(1, (NOTE_SECS - n.age) * 2);
      if (n.age < NOTE_SECS) return true;
      n.o.sprite.removeFromParent();
      n.o.sprite.material.dispose();
      return false;
    });
  }

  dispose(): void {
    this.step(Infinity);
    this.clear();
    this.#splatMat.map?.dispose();
    this.#splatMat.dispose();
    this.#splatGeo.dispose();
    this.#bitGeo.dispose();
    this.#noteMat.map?.dispose();
    this.#noteMat.dispose();
  }
}
