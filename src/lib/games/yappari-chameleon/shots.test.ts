import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { layAtlas } from './atlas';
import { BONES, buildDoll } from './doll';
import { makeDoll, PoseAnimator } from './doll3d';
import { levelOf, mansion } from './mansion/layout';
import { newBody, type Body, type Level } from './move';
import { AIM, POSES, poseById, STAND } from './poses';
import { capsules, fire, frames, placement, rayCapsule, rayLevel, rays, SPREAD, type Target } from './shots';

const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;
const surface = buildDoll(0.02);
const atlas = layAtlas(surface.pos, surface.idx, 2048);

/** 床（y = 0）と、z = 2〜2.3 の壁だけの部屋 */
const room: Level = {
  boxes: [
    { min: [-10, -1, -10], max: [10, 0, 10] },
    { min: [-10, 0, 2], max: [10, 3, 2.3] }
  ],
  ramps: [],
  spawn: [0, 0, 0]
};

const body = (pos: V3, extra: Partial<Body> = {}): Body => ({ ...newBody(pos), ...extra });
const target = (seat: number, b: Body, pose = STAND): Target => ({ seat, caps: capsules(pose, placement(b)) });
const toward = (o: V3, p: V3): V3 => {
  const v: V3 = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const hitSeats = (lv: Level, o: V3, at: V3, t: Target[]) =>
  fire(lv, o, toward(o, at), t)
    .map((r) => r.seat)
    .filter((s) => s !== null);

describe('frames', () => {
  it('骨の置き方は、three の骨（PoseAnimator と placeDoll）と同じ所に来る', () => {
    const rig = makeDoll(renderer, surface, atlas);
    const poses = new PoseAnimator(rig);
    const places = [
      body([1, 0, 2], { yaw: 0.7 }),
      body([0, 1.5, 4.8], { yaw: Math.PI, cling: { kind: 'wall', nx: 0, nz: -1 } }),
      body([2, 3, 1], { yaw: -1.2, cling: { kind: 'ceiling' } })
    ];
    for (const pose of [STAND, AIM, ...POSES])
      for (const b of places) {
        poses.snap(pose);
        const p = placement(b);
        rig.root.rotation.order = 'YXZ';
        rig.root.rotation.set(p.tilt, p.yaw, 0);
        rig.root.position.set(...p.at);
        rig.root.updateMatrixWorld(true);
        const f = frames(pose, p);
        for (const bone of BONES) {
          const want = rig.bones[bone].getWorldPosition(new THREE.Vector3());
          expect(f[bone].p[0], `${pose.id} ${bone}`).toBeCloseTo(want.x, 5);
          expect(f[bone].p[1], `${pose.id} ${bone}`).toBeCloseTo(want.y, 5);
          expect(f[bone].p[2], `${pose.id} ${bone}`).toBeCloseTo(want.z, 5);
        }
      }
  });
});

describe('rayCapsule', () => {
  it('筒の横・端の丸み・球に当たり、外れた線と後ろの体には当たらない', () => {
    const cap = { a: [0, 0, 0] as V3, b: [0, 1, 0] as V3, r: 0.1 };
    expect(rayCapsule([-1, 0.5, 0], [1, 0, 0], cap)).toBeCloseTo(0.9);
    expect(rayCapsule([0, 2, 0], [0, -1, 0], cap)).toBeCloseTo(0.9);
    expect(rayCapsule([-1, 0.5, 0.2], [1, 0, 0], cap)).toBeNull();
    expect(rayCapsule([1, 0.5, 0], [1, 0, 0], cap)).toBeNull();
    expect(rayCapsule([0, 0, -1], [0, 0, 1], { a: [0, 0, 0], b: [0, 0, 0], r: 0.1 })).toBeCloseTo(0.9);
    // 上の端の丸みを斜めにかすめる（中心 (0,1,0) の球に y = 1.05 の高さから入る）
    expect(rayCapsule([-1, 1.05, 0], [1, 0, 0], cap)).toBeCloseTo(1 - Math.sqrt(0.1 ** 2 - 0.05 ** 2));
  });
});

describe('rayLevel', () => {
  it('入った面の向きを返し、立っている床（始点を含む箱）は数えない', () => {
    expect(rayLevel(room, [0, 1, 0], [0, 0, 1], 60)).toEqual({ t: 2, n: [0, 0, -1] });
    expect(rayLevel(room, [0, 1, 0], [0, -1, 0], 60)).toEqual({ t: 1, n: [0, 1, 0] });
    expect(rayLevel({ ...room, boxes: [{ min: [-1, -1, -1], max: [1, 1, 1] }] }, [0, 0, 0], [0, 0, 1], 60)).toBeNull();
  });

  it('坂は表面より下が中身で、斜めの面の向きを返し、表面の上は抜ける', () => {
    const ramp: Level = { boxes: [], ramps: [{ min: [-1, 0, 0], max: [1, 2, 4], rise: 'z+' }], spawn: [0, 0, 0] };
    // 真上から: z = 2 の表面の高さは 1
    const down = rayLevel(ramp, [0, 3, 2], [0, -1, 0], 60);
    expect(down?.t).toBeCloseTo(2);
    expect(down?.n[1]).toBeGreaterThan(0.8);
    expect(down?.n[2]).toBeLessThan(0);
    // 低い側の端から段の側面へ
    expect(rayLevel(ramp, [0, 0.2, -2], [0, 0, 1], 60)?.t).toBeCloseTo(2 + 0.2 * 2);
    // 表面より上を水平に通る線は当たらない
    expect(rayLevel(ramp, [0, 2.5, -2], [0, 0, 1], 60)).toBeNull();
    const down2: Level = { ...ramp, ramps: [{ min: [-1, 0, 0], max: [1, 2, 4], rise: 'z-' }] };
    expect(rayLevel(down2, [0, 3, 2], [0, -1, 0], 60)?.t).toBeCloseTo(2);
    expect(rayLevel(down2, [0, 3, 3], [0, -1, 0], 60)?.t).toBeCloseTo(2.5);
  });
});

describe('fire', () => {
  it('5 本は十字の向きと、上下左右へ 2 度ずつ開いた線', () => {
    const d = rays([0, 0, 1]);
    expect(d).toHaveLength(5);
    for (const v of d.slice(1)) expect(Math.acos(v[2])).toBeCloseTo(SPREAD, 6);
  });

  it('急な見上げでも 5 本の十字は回らず、左右の線は同じ高さ', () => {
    const pitch = 1.25;
    const d: V3 = [0, Math.sin(pitch), Math.cos(pitch)];
    const [, left, right, up, down] = rays(d);
    expect(left[1]).toBeCloseTo(right[1], 9);
    expect(left[0]).toBeCloseTo(-right[0], 9);
    expect(up[1]).toBeGreaterThan(d[1]);
    expect(down[1]).toBeLessThan(d[1]);
    expect(up[0]).toBeCloseTo(0, 9);
    expect(down[0]).toBeCloseTo(0, 9);
  });

  it('立った体の胸を撃てば当たり、頭の上を撃てば外れる', () => {
    const t = [target(2, body([0, 0, 0]))];
    expect(hitSeats(room, [0, 1, -5], [0, 0.7, 0], t)).toContain(2);
    expect(hitSeats(room, [0, 1, -5], [0, 1.45, 0], t)).toEqual([]);
  });

  it('5 本のうち 1 本でも当たれば当たる（中心の線は外れ、横の線だけが入る）', () => {
    // 5m 先で 2 度の開きは 0.17m。中心の線は細い柱の 0.2m 横を抜け、左へ開いた線が柱に入る
    const pole: Target = { seat: 2, caps: [{ a: [0, 0, 0], b: [0, 2, 0], r: 0.1 }] };
    const rs = fire(room, [0.2, 1, -5], [0, 0, 1], [pole]);
    expect(rs[0].seat).toBeNull();
    expect(rs.filter((r) => r.seat === 2)).toHaveLength(1);
  });

  it('壁の向こうの体には当たらず、壁にしぶきの向きを返す', () => {
    const t = [target(2, body([0, 0, 4]))];
    const rs = fire(room, [0, 1, 0], toward([0, 1, 0], [0, 0.7, 4]), t);
    expect(rs.every((r) => r.seat === null)).toBe(true);
    expect(rs[0].n).toEqual([0, 0, -1]);
    expect(rs[0].end[2]).toBeCloseTo(2);
  });

  it('家具（ピアノ）の陰の体には当たらない。カメラの殻にない家具も弾は止める', () => {
    const lv = levelOf(mansion());
    const t = [target(2, body([4, 0, 4.4]), poseById('curl'))];
    expect(hitSeats(lv, [4, 1, 0.6], [4, 0.3, 4.4], t)).toEqual([]);
    // 同じ体を、ピアノの上から見下ろせば当たる
    expect(hitSeats(lv, [4, 2.6, 6.5], [4, 0.3, 4.4], t)).toContain(2);
  });

  it('大階段の裏に隠れた体には、階段の手前から撃っても当たらない', () => {
    const lv = levelOf(mansion());
    const t = [target(2, body([0, 0, 9.5]))];
    expect(hitSeats(lv, [0, 1, 1], [0, 0.7, 9.5], t)).toEqual([]);
  });

  it('寝そべった体は低い所で当たり、立ったときの頭の高さには何も無い', () => {
    const lie = poseById('lie');
    const b = body([0, 0, 0]);
    const t = [target(2, b, lie)];
    const mid = frames(lie, placement(b)).spine.p;
    expect(mid[1]).toBeLessThan(0.3);
    expect(hitSeats(room, [0, 2.5, mid[2]], [mid[0], 0, mid[2]], t)).toContain(2);
    expect(hitSeats(room, [0, 1.05, -5], [0, 1.05, 0], t)).toEqual([]);
  });

  it('壁や天井に張り付いた体にも当たる', () => {
    const wall = body([0, 1.2, 1.8 - 0.2], { yaw: Math.PI, cling: { kind: 'wall', nx: 0, nz: -1 } });
    const chest = frames(STAND, placement(wall)).chest.p;
    expect(hitSeats(room, [0, 1.5, -3], chest, [target(2, wall)])).toContain(2);
    const ceiling = body([0, 3, 0], { cling: { kind: 'ceiling' } });
    const c = frames(STAND, placement(ceiling)).chest.p;
    expect(c[1]).toBeGreaterThan(2.6);
    expect(hitSeats(room, [0, 0.5, -3], c, [target(3, ceiling)])).toContain(3);
  });

  it('手前の人に当たった線は、後ろの人に届かない', () => {
    const t = [target(2, body([0, 0, 0])), target(3, body([0, 0, 1]))];
    const rs = fire(room, [0, 0.7, -3], [0, 0, 1], t);
    expect(rs[0].seat).toBe(2);
  });
});
