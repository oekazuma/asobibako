import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { idle, newBody, step, type Body, type Box, type Level } from '../move';
import { levelOf, mansion, placeOf, SIZES, SPAWNS, type Piece } from './layout';
import { LOBBY } from './lobby';
import { place, SETS } from './props';
import { DOORWAYS, KITCHEN, LAUNDRY, roomPieces, STUDY } from './rooms';

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

  it('ガスボンベは 2 本並べて、肉の棚の横に置く', () => {
    const q = roomPieces();
    const racks = q.filter((r) => r.kind === 'meat-rack');
    const gas = q.filter((g) => g.kind === 'gas');
    expect(gas).toHaveLength(2);
    for (const g of gas)
      expect(Math.min(...racks.map((r) => Math.hypot(g.at[0] - r.at[0], g.at[2] - r.at[2])))).toBeLessThan(1.6);
  });

  const boxOf = (q: Piece): Box | null => {
    const s = SIZES[q.kind];
    if (!s) return null;
    const [w, h, d] = q.turn % 2 ? [s[2], s[1], s[0]] : s;
    return { min: [q.at[0] - w / 2, q.at[1], q.at[2] - d / 2], max: [q.at[0] + w / 2, q.at[1] + h, q.at[2] + d / 2] };
  };
  // 並べた本棚のようにぴったり付いた箱は重なりに数えない
  const hits = (a: Box, b: Box) => [0, 1, 2].every((i) => a.min[i] < b.max[i] - 1e-6 && b.min[i] < a.max[i] - 1e-6);

  it('3 部屋の動かない家具は、戸口の通り道をふさがず、互いに重ならない', () => {
    const boxes = roomPieces()
      .map(boxOf)
      .filter((b): b is Box => b !== null);
    for (const [i, a] of boxes.entries()) {
      for (const door of DOORWAYS) expect(hits(a, door), `${a.min}`).toBe(false);
      for (const b of boxes.slice(i + 1)) expect(hits(a, b), `${a.min} と ${b.min}`).toBe(false);
    }
  });

  it('3 部屋の動かない家具は、動く物のどの置き場所の候補にも、人の出る場所にも重ならない（選ばれなかった候補も）', () => {
    const fixed = roomPieces()
      .map(boxOf)
      .filter((b): b is Box => b !== null);
    const bad: string[] = [];
    for (const set of SETS)
      for (const slot of set.slots)
        for (const unit of set.units)
          for (const q of unit) {
            const a = boxOf(place(slot, q));
            if (a) for (const b of fixed) if (hits(a, b)) bad.push(`${q.kind} ${slot.at} と ${b.min}`);
          }
    // 体の半径 0.2m ぶん広げた箱で見る
    for (const where of Object.values(SPAWNS))
      for (const at of Object.values(where)) {
        const a: Box = { min: [at[0] - 0.2, 0, at[2] - 0.2], max: [at[0] + 0.2, 1, at[2] + 0.2] };
        for (const b of fixed) if (hits(a, b)) bad.push(`出る場所 ${at} と ${b.min}`);
      }
    expect(bad).toEqual([]);
  });

  it('本家の画面にある家具がそろう', () => {
    const kinds = (name: string) =>
      new Set(
        roomPieces()
          .filter((q) => placeOf(q.at) === name)
          .map((q) => q.kind)
      );
    expect([...kinds('書斎')]).toEqual(
      expect.arrayContaining(['bookshelf', 'desk', 'globe', 'bust', 'post', 'painting'])
    );
    expect([...kinds('キッチン')]).toEqual(
      expect.arrayContaining([
        'counter',
        'sink',
        'plates',
        'meat-rack',
        'gas',
        'duct',
        'caution',
        'drain',
        'vent',
        'range',
        'pot-rack',
        'pots',
        'board'
      ])
    );
    expect([...kinds('ランドリー')]).toEqual(
      expect.arrayContaining([
        'washer',
        'clothesline',
        'beam',
        'tube-light',
        'towel-table',
        'wood-shelf',
        'extinguisher',
        'vacuum',
        'jerrycan',
        'poster-blue'
      ])
    );
  });
});
