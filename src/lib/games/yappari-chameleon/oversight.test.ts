import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import type { Level } from './move';
import { bodyPoints, forward, inView, rate, REACH, sight, still, type Viewer } from './oversight';

const open: Level = { boxes: [{ min: [-40, -1, -40], max: [40, 0, 40] }], ramps: [], spawn: [0, 0, 0] };
const walled: Level = {
  boxes: [...open.boxes, { min: [-5, 0, 4], max: [5, 3, 4.3] }],
  ramps: [],
  spawn: [0, 0, 0]
};
const eye: Viewer = { eye: [0, 1, 0], look: [0, 0] };
const deg = (a: number) => (a * Math.PI) / 180;
/** 目から見て yaw・pitch（度）の向きに d 進んだ点 */
const toward = (yaw: number, pitch: number, d: number): V3 => {
  const f = forward([deg(yaw), deg(pitch)]);
  return [f[0] * d, 1 + f[1] * d, f[2] * d];
};

describe('見落としポイントの視野', () => {
  it('yaw 0 は +z、yaw 90 度は +x、pitch は下向きが正', () => {
    expect(forward([0, 0])[2]).toBeCloseTo(1);
    expect(forward([Math.PI / 2, 0])[0]).toBeCloseTo(1);
    expect(forward([0, 0.3])[1]).toBeLessThan(0);
  });

  it('横は半角 52 度、縦は半角 36 度の中だけ。後ろは見えない', () => {
    expect(inView(eye, toward(0, 0, 5))).toBe(true);
    expect(inView(eye, toward(50, 0, 5))).toBe(true);
    expect(inView(eye, toward(-50, 0, 5))).toBe(true);
    expect(inView(eye, toward(55, 0, 5))).toBe(false);
    expect(inView(eye, toward(0, 34, 5))).toBe(true);
    expect(inView(eye, toward(0, -38, 5))).toBe(false);
    expect(inView(eye, [0, 1, -5])).toBe(false);
  });

  it('見下ろしているハンターは、足もとの前の人を視野に入れ、目の高さの正面は外す', () => {
    const down: Viewer = { eye: [0, 2, 0], look: [0, deg(40)] };
    expect(inView(down, [0, 0, 2])).toBe(true);
    expect(inView(down, [0, 2, 6])).toBe(false);
  });

  it('壁の向こうと 15m より遠い所は見えず、見える点のうち近いほうの距離を返す', () => {
    expect(
      sight(open, eye, [
        [0, 1, 6],
        [0, 1, 5]
      ])
    ).toBeCloseTo(5);
    expect(sight(walled, eye, [[0, 1, 6]])).toBeNull();
    expect(sight(open, eye, [[0, 1, REACH + 0.5]])).toBeNull();
    expect(sight(open, eye, [[0, 1, -3]])).toBeNull();
  });

  it('届きは既定で 15m、渡せば延ばせる', () => {
    expect(sight(open, eye, [toward(0, 0, 20)])).toBeNull();
    expect(sight(open, eye, [toward(0, 0, 20)], 30)).toBeCloseTo(20);
  });

  it('点は 1 秒に 10 × (1 − 距離 / 15)。近いほど多い', () => {
    expect(rate(0)).toBe(10);
    expect(rate(7.5)).toBeCloseTo(5);
    expect(rate(15)).toBe(0);
    expect(rate(3)).toBeGreaterThan(rate(9));
  });

  it('直前 0.2 秒に 5cm より動いていなければ止まっている', () => {
    expect(still([0, 0, 0], [0.03, 0, 0.03])).toBe(true);
    expect(still([0, 0, 0], [0.06, 0, 0])).toBe(false);
  });

  it('体の点は胴の真ん中と頭で、立っていれば頭が上', () => {
    const [mid, head] = bodyPoints({ pos: [0, 0, 0], yaw: 0, cling: null, pose: 'stand' });
    expect(mid[1]).toBeCloseTo(0.7025, 3);
    expect(head[1]).toBeCloseTo(1.045, 3);
  });
});
