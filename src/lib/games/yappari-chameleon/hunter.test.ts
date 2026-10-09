import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { MUZZLE } from './gun';
import { HunterView } from './hunter';
import type { World } from './world3d';

// 銃の見た目は canvas の模様を使うので、位置の計算だけを確かめるときは空の組に替える
vi.mock('./gun', async (orig) => ({ ...(await orig<typeof import('./gun')>()), gunModel: () => new THREE.Group() }));

describe('HunterView', () => {
  it('銃口は、カメラが原点で -z を向き跳ねていなければ、構えた位置の y 回転した銃口になる', () => {
    const world = {
      hand: new THREE.Group(),
      overlay: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera()
    } as unknown as World;
    const m = new HunterView(world).muzzle();
    const want = new THREE.Vector3(...MUZZLE)
      .applyEuler(new THREE.Euler(0, 0.05, 0))
      .add(new THREE.Vector3(0.17, -0.17, -0.38));
    expect(m[0]).toBeCloseTo(want.x, 6);
    expect(m[1]).toBeCloseTo(want.y, 6);
    expect(m[2]).toBeCloseTo(want.z, 6);
  });
});
