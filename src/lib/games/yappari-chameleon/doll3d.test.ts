import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { layAtlas } from './atlas';
import { buildDoll } from './doll';
import { bakePose, makeDoll, PoseAnimator, restHit } from './doll3d';
import { poseById } from './poses';

// 塗りの描き先は GPU に作るので、ここでは何もしない描画器で足りる
const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;

// 面の細かさを粗くしても升は 12px 以上要るので、実際の 2048 で敷く
const surface = buildDoll(0.02);
const atlas = layAtlas(surface.pos, surface.idx, 2048);

function rig() {
  const r = makeDoll(renderer, surface, atlas);
  return { r, poses: new PoseAnimator(r) };
}

const shoot = (r: ReturnType<typeof rig>['r'], x: number, y: number, z: number, to: THREE.Vector3) => {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, z), to.sub(new THREE.Vector3(x, y, z)).normalize());
  return ray.intersectObject(r.pick)[0];
};

describe('bakePose', () => {
  it('ポーズを変えて焼き直すと、体の真ん中と当たりが今の形に移る', () => {
    const { r, poses } = rig();
    const stand = bakePose(r).clone();
    expect(stand.y).toBeGreaterThan(0.4);
    poses.snap(poseById('lie'));
    const lie = bakePose(r);
    expect(lie.y).toBeLessThan(0.3);
    // 寝そべった体の上から落とした線が当たり、立っていたときの頭の高さには何も無い
    expect(shoot(r, 0, 2, lie.z, new THREE.Vector3(0, 0, lie.z))).toBeDefined();
    expect(shoot(r, 0, 1.1, 2, new THREE.Vector3(0, 1.1, 0))).toBeUndefined();
  });

  it('当たった面は休みの形の位置に引ける（面の並びが体と同じ）', () => {
    const { r, poses } = rig();
    poses.snap(poseById('lie'));
    const c = bakePose(r);
    const hit = shoot(r, 0, 2, c.z, new THREE.Vector3(0, 0, c.z))!;
    const rest = restHit(r, hit)!;
    expect(rest).not.toBeNull();
    // 寝そべった体の上の面は、立った体では前（+z）を向く面で、高さは寝そべった高さより高い
    expect(rest.p[1]).toBeGreaterThan(0.4);
    expect(Math.hypot(...rest.n)).toBeCloseTo(1, 3);
  });

  it('骨が動くたびに version が増え、止まっているあいだは増えない', () => {
    const { poses } = rig();
    poses.to(poseById('lie'));
    const v = poses.version;
    poses.step(1 / 60);
    expect(poses.version).toBe(v + 1);
    for (let i = 0; i < 400; i++) poses.step(1 / 60);
    const settled = poses.version;
    poses.step(1 / 60);
    expect(poses.version).toBe(settled);
  });
});
