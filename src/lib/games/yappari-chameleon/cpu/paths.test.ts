import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { levelOf, mansion, placeOf, PLACES, SPAWNS } from '../mansion/layout';
import { place, SETS } from '../mansion/props';
import { idle, newBody, step, WALK, type Body, type Level } from '../move';
import { EDGES, NODES, nearest, ROOMS, route } from './paths';

/** 動く物を、どの種でも置かれうる候補の全部に同時に置いた屋敷。ここを歩ければ、どの種の置き方でも歩ける */
function worst(): Level {
  const m = mansion();
  const fixed = m.pieces.slice(0, m.pieces.length - m.moving);
  const every = SETS.flatMap((set) =>
    set.slots.flatMap((slot) => set.units.flatMap((unit) => unit.map((q) => place(slot, q))))
  );
  return levelOf({ ...m, pieces: [...fixed, ...every] });
}

const DT = 1 / 30;
const flat = (b: Body, to: V3) => Math.hypot(to[0] - b.pos[0], to[2] - b.pos[2]);

/** from から to へまっすぐ歩かせる。歩く速さで掛かる時間に 3 秒足しても着かなければ、着いていない体のまま返す */
function walk(lv: Level, from: V3, to: V3): Body {
  const b = newBody(from);
  for (let i = 0; i < 5; i++) step(b, idle(), lv, DT);
  const limit = Math.hypot(to[0] - from[0], to[2] - from[2]) / WALK + 3;
  for (let t = 0; t < limit && flat(b, to) >= 0.2; t += DT) {
    const dx = to[0] - b.pos[0];
    const dz = to[2] - b.pos[2];
    const d = Math.hypot(dx, dz);
    step(b, { ...idle(), x: dx / d, z: dz / d }, lv, DT);
  }
  return b;
}

describe('道順の網', () => {
  const lv = worst();

  it('どの点も、置いた体が押されず床に立てる', () => {
    const bad: string[] = [];
    for (const [name, at] of Object.entries(NODES)) {
      const b = newBody(at);
      for (let i = 0; i < 10; i++) step(b, idle(), lv, DT);
      if (Math.hypot(b.pos[0] - at[0], b.pos[1] - at[1], b.pos[2] - at[2]) > 0.02) bad.push(name);
    }
    expect(bad).toEqual([]);
  });

  it('どの種の置き方でも、全部の辺を両向きに歩ける', () => {
    const bad: string[] = [];
    for (const [a, b] of EDGES)
      for (const [p, q] of [
        [a, b],
        [b, a]
      ] as const) {
        const body = walk(lv, NODES[p], NODES[q]);
        if (flat(body, NODES[q]) > 0.25 || Math.abs(body.pos[1] - NODES[q][1]) > 0.35) bad.push(`${p} → ${q}`);
      }
    expect(bad).toEqual([]);
  });

  it('探索の入口の 3 席から、入口の点へ歩ける', () => {
    for (const at of Object.values(SPAWNS.entrance))
      expect(flat(walk(lv, at, NODES.entrance), NODES.entrance)).toBeLessThan(0.25);
  });

  it('入口から屋敷の全部の部屋へ道があり、部屋ごとに見回す点を部屋の中に持つ', () => {
    const rooms = PLACES.map((p) => p.name).filter((n) => n !== '控室' && n !== 'ロビー');
    expect(ROOMS.map((r) => r.name).sort()).toEqual([...rooms].sort());
    for (const r of ROOMS) {
      expect(placeOf(NODES[r.look]), r.name).toBe(r.name);
      const path = route('entrance', r.look);
      expect(path[0]).toBe('entrance');
      expect(path.at(-1)).toBe(r.look);
      for (let i = 1; i < path.length; i++)
        expect(
          EDGES.some(([a, b]) => (a === path[i - 1] && b === path[i]) || (b === path[i - 1] && a === path[i])),
          `${path[i - 1]} → ${path[i]}`
        ).toBe(true);
    }
  });

  it('通れない辺を避けて道を選び、着けなければ空。同じ点なら 1 つ', () => {
    expect(route('hall', 'kitchen', new Set(['corridor>kitchenDoor']))).toEqual([]);
    expect(route('hall', 'hall')).toEqual(['hall']);
    expect(route('studySouth', 'studyEast', new Set(['studySouth>studyEast']))).toEqual([
      'studySouth',
      'studyDoor',
      'studyNorth',
      'studyEast'
    ]);
  });

  it('近い点は同じ部屋から選ぶ（壁の向こうの点を選ばない）', () => {
    expect(nearest([-16, 0, 7.3])).toBe('kitchen');
    expect(nearest([0, 3.5, 11.5])).toMatch(/^(stairTop|galleryWest|galleryEast)$/);
    expect(nearest(SPAWNS.entrance[2])).toBe('entrance');
  });
});
