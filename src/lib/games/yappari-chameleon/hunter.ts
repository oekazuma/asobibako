import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import { disposeModel, gunModel, MUZZLE } from './gun';
import type { World } from './world3d';

const KICK_SECS = 0.25;
const REST: V3 = [0.17, -0.17, -0.38];

export class HunterView {
  readonly #world: World;
  readonly #gun = gunModel();
  #kick = 0;

  constructor(world: World) {
    this.#world = world;
    const hand = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.85 });
    const right = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), hand);
    const left = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), hand);
    right.position.set(0.005, -0.075, 0.08);
    left.position.set(-0.01, -0.05, -0.2);
    this.#gun.add(right, left);
    this.#gun.position.set(...REST);
    this.#gun.rotation.y = 0.05;
    world.hand.add(this.#gun);
  }

  set visible(on: boolean) {
    this.#world.overlay.visible = on;
  }

  get visible(): boolean {
    return this.#world.overlay.visible;
  }

  fire(): void {
    this.#kick = KICK_SECS;
  }

  /** 弾の筋は画面の右下の銃口から引く。overlay は描く直前にカメラへ合わせるので、カメラの今の向きで測る */
  muzzle(): V3 {
    const cam = this.#world.camera;
    const p = new THREE.Vector3(...MUZZLE)
      .applyEuler(this.#gun.rotation)
      .add(this.#gun.position)
      .applyQuaternion(cam.quaternion)
      .add(cam.position);
    return [p.x, p.y, p.z];
  }

  dispose(): void {
    this.#gun.removeFromParent();
    disposeModel(this.#gun);
  }

  step(dt: number): void {
    this.#kick = Math.max(0, this.#kick - dt);
    const k = this.#kick / KICK_SECS;
    this.#gun.rotation.x = k * 0.35;
    this.#gun.position.z = REST[2] + k * 0.05;
  }
}
