import * as THREE from 'three';
import { coin, meat } from './models';

/**
 * 雪原の細かい演出。ルールには関わらない。
 * 足あと・たき火の煙・飛んでいくお肉やお金を、決まった数の部品を使い回して出す
 */
interface Flyer {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  t: number;
  dur: number;
  delay: number;
}

const FOOTPRINTS = 48;
const SMOKE = 10;

export class Details {
  readonly group = new THREE.Group();
  readonly #prints: THREE.Mesh[] = [];
  #printAt = 0;
  #last = new THREE.Vector2();
  #side = 1;
  readonly #printGeo: THREE.CircleGeometry;
  readonly #smoke: THREE.Mesh[] = [];
  #smokeT = 0;
  readonly #flyers: Flyer[] = [];

  constructor() {
    const geo = new THREE.CircleGeometry(0.009, 12);
    this.#printGeo = geo;
    for (let i = 0; i < FOOTPRINTS; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#9fb6d6', transparent: true, opacity: 0 }));
      m.rotation.x = -Math.PI / 2;
      m.scale.set(1, 1.6, 1);
      m.position.y = 0.004;
      this.#prints.push(m);
      this.group.add(m);
    }
    for (let i = 0; i < SMOKE; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#d7dde8', transparent: true, opacity: 0, roughness: 1 })
      );
      m.userData.age = 1;
      this.#smoke.push(m);
      this.group.add(m);
    }
  }

  /** 雪原に出ているときだけ、左右交互に足あとを残す */
  step(x: number, z: number, onSnow: boolean) {
    if (!onSnow || this.#last.distanceTo(new THREE.Vector2(x, z)) < 0.045) return;
    const dir = new THREE.Vector2(x, z).sub(this.#last).normalize();
    this.#last.set(x, z);
    const m = this.#prints[this.#printAt++ % FOOTPRINTS];
    this.#side *= -1;
    m.position.set(x - dir.y * 0.012 * this.#side, 0.004, z + dir.x * 0.012 * this.#side);
    m.rotation.z = -Math.atan2(dir.x, dir.y);
    (m.material as THREE.MeshBasicMaterial).opacity = 0.55;
  }

  /** from から to へ、弧を描いて飛ばす。着いたら消える */
  fly(kind: 'meat' | 'coin', from: THREE.Vector3, to: THREE.Vector3, delay = 0) {
    const obj = kind === 'meat' ? meat(0.8) : coin();
    obj.position.copy(from);
    obj.visible = delay === 0;
    this.group.add(obj);
    this.#flyers.push({ obj, from: from.clone(), to: to.clone(), t: 0, dur: 0.35, delay });
  }

  update(dt: number, fire: THREE.Vector3, cooking: boolean) {
    for (const m of this.#prints) {
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, mat.opacity - dt * 0.18);
    }

    this.#smokeT -= dt;
    if (this.#smokeT <= 0) {
      this.#smokeT = cooking ? 0.25 : 0.5;
      const m = this.#smoke.find((s) => s.userData.age >= 1);
      if (m) {
        m.userData.age = 0;
        m.position.set(fire.x + (Math.random() - 0.5) * 0.02, fire.y + 0.12, fire.z);
      }
    }
    for (const m of this.#smoke) {
      if (m.userData.age >= 1) continue;
      m.userData.age += dt / 2.2;
      const a = m.userData.age as number;
      m.position.y += dt * 0.08;
      m.position.x += Math.sin(a * 6) * dt * 0.02;
      m.scale.setScalar(0.6 + a * 1.8);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.55 * (1 - a);
    }

    for (let i = this.#flyers.length - 1; i >= 0; i--) {
      const f = this.#flyers[i];
      if (f.delay > 0) {
        f.delay -= dt;
        f.obj.visible = f.delay <= 0;
        continue;
      }
      f.t += dt / f.dur;
      const t = Math.min(1, f.t);
      f.obj.position.lerpVectors(f.from, f.to, t);
      f.obj.position.y += Math.sin(t * Math.PI) * 0.12;
      f.obj.rotation.y += dt * 12;
      if (t >= 1) {
        this.group.remove(f.obj);
        this.#flyers.splice(i, 1);
      }
    }
  }

  /** 足あと・煙は面ごとに geometry/material を作るので、次の面のために解放する */
  dispose(): void {
    this.#printGeo.dispose();
    for (const m of this.#prints) (m.material as THREE.Material).dispose();
    for (const m of this.#smoke) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  }
}
