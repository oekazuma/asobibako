import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { layAtlas } from './atlas';
import { buildDoll } from './doll';
import { makeDoll, PoseAnimator } from './doll3d';
import { FORESTOCK, HAND_LEFT, inHand, MUZZLE } from './gun';
import { AIM } from './poses';

const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;
const surface = buildDoll(0.02);
const atlas = layAtlas(surface.pos, surface.idx, 2048);

describe('inHand', () => {
  it('構えたポーズでは、銃口が水平に前を向き、上が真上で、左手が先台に届く', () => {
    const rig = makeDoll(renderer, surface, atlas);
    const gun = new THREE.Object3D();
    inHand(rig.bones['forearm.r'], gun, 'gun');
    new PoseAnimator(rig).snap(AIM);
    rig.root.updateMatrixWorld(true);

    const q = gun.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
    const front = gun.localToWorld(new THREE.Vector3(...MUZZLE)).sub(gun.localToWorld(new THREE.Vector3()));
    expect(up.y).toBeGreaterThan(0.8);
    expect(front.normalize().z).toBeGreaterThan(0.9);

    const left = rig.bones['forearm.l'].localToWorld(new THREE.Vector3(...HAND_LEFT));
    expect(left.distanceTo(gun.localToWorld(new THREE.Vector3(...FORESTOCK)))).toBeLessThan(0.12);
  });
});
