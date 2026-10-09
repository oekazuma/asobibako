import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { idle, newBody, step, type Body, type Level } from '../move';
import { levelOf, mansion, placeOf } from './layout';
import { LOBBY } from './lobby';
import { KITCHEN, LAUNDRY, STUDY } from './rooms';

const m = mansion();
const lv: Level = levelOf(m);

function walk(b: Body, x: number, z: number) {
  for (let t = 0; t < 30; t += 1 / 60) {
    const dx = x - b.pos[0];
    const dz = z - b.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    step(b, { ...idle(), x: dx / Math.max(d, 1), z: dz / Math.max(d, 1) }, lv, 1 / 60);
  }
}

const settle = (b: Body) => {
  for (let i = 0; i < 60; i++) step(b, idle(), lv, 1 / 60);
};

const inside = (p: V3, r: { min: V3; max: V3 }) =>
  p[0] >= r.min[0] && p[0] <= r.max[0] && p[2] >= r.min[2] && p[2] <= r.max[2];

describe('屋敷の 3 部屋', () => {
  it('大広間の東の戸口から書斎へ入れる', () => {
    const b = newBody([5, 0, 6]);
    settle(b);
    walk(b, 9, 6);
    expect(b.pos[0]).toBeGreaterThan(8.9);
    expect(b.pos[1]).toBeCloseTo(0, 3);
  });

  it('廊下の北の戸口からキッチンへ、南の戸口からランドリーへ入れる', () => {
    const k = newBody([-16, 0, 5]);
    settle(k);
    walk(k, -16, 9.5);
    expect(k.pos[2]).toBeGreaterThan(9.4);
    const l = newBody([-15, 0, 5]);
    settle(l);
    walk(l, -15, 0);
    expect(l.pos[2]).toBeLessThan(0.1);
  });

  it('戸口の横の壁は抜けられず、部屋の奥の壁から外へ出られない', () => {
    const b = newBody([-13, 0, 5]);
    settle(b);
    walk(b, -13, 9);
    expect(b.pos[2]).toBeLessThan(6.75);
    const k = newBody([-16, 0, 10]);
    settle(k);
    walk(k, -16, 30);
    expect(k.pos[2]).toBeLessThan(KITCHEN.max[2]);
    const s = newBody([12, 0, 3]);
    settle(s);
    walk(s, 30, 3);
    expect(s.pos[0]).toBeLessThan(STUDY.max[0]);
    const l = newBody([-15, 0, 0]);
    settle(l);
    walk(l, -15, -20);
    expect(l.pos[2]).toBeGreaterThan(LAUNDRY.min[2]);
  });

  it('戸口の上は 2.4m の高さでふさがっている（戸口の上へは跳んで抜けられない）', () => {
    const lintel = lv.boxes.filter((b) => b.min[1] === 2.4);
    expect(lintel.length).toBeGreaterThanOrEqual(3);
  });

  it('点光源は部屋ごとに 1〜2 個', () => {
    for (const r of [STUDY, KITCHEN, LAUNDRY, LOBBY]) {
      const n = m.lights.filter((l) => inside(l.at, r)).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it('部屋の名前', () => {
    expect(placeOf([0, 0, 5])).toBe('大広間');
    expect(placeOf([0, 3.5, 10.5])).toBe('2階の回廊');
    expect(placeOf([-15, 0, 5])).toBe('緑の廊下');
    expect(placeOf([12, 0, 6])).toBe('書斎');
    expect(placeOf([-16, 0, 10])).toBe('キッチン');
    expect(placeOf([-15, 0, -1])).toBe('ランドリー');
    expect(placeOf([0, 0, -60])).toBe('ロビー');
    expect(placeOf([0, 0, -30])).toBe('控室');
  });
});
