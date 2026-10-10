import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { embedded } from '../embed';
import { levelOf, mansion, placeOf, SIZES, type Piece } from '../mansion/layout';
import { place, SETS } from '../mansion/props';
import { EYE_HEIGHT, idle, newBody, step, wallNear, type Box } from '../move';
import { poseById } from '../poses';
import { capsules, placement } from '../shots';
import { SKILLS } from './levels';
import { NODES, ROOMS } from './paths';
import { pickSpot, shifted, SHIFT, SPOTS, viewOf, type Spot } from './spots';

const boxOf = (q: Piece): Box | null => {
  const s = SIZES[q.kind];
  if (!s) return null;
  const [w, h, d] = q.turn % 2 ? [s[2], s[1], s[0]] : s;
  return { min: [q.at[0] - w / 2, q.at[1], q.at[2] - d / 2], max: [q.at[0] + w / 2, q.at[1] + h, q.at[2] + d / 2] };
};
const hits = (a: Box, b: Box) => [0, 1, 2].every((i) => a.min[i] < b.max[i] - 1e-6 && b.min[i] < a.max[i] - 1e-6);
const inside = (p: V3, b: Box) => [0, 1, 2].every((i) => p[i] > b.min[i] && p[i] < b.max[i]);
const SEEDS = [null, ...Array.from({ length: 30 }, (_, i) => i + 1)];
const name = (s: Spot) => `${placeOf(s.pos)} ${s.pos.map((v) => v.toFixed(2)).join(',')} ${s.pose}`;
const caps = (s: Spot) => capsules(poseById(s.pose), placement(s));
/**
 * 候補と、slack の半分の刻み（SHIFT でも 0.125m）でずらした全部の置き方。体を包む箱はどの向きにも 0.3m より大きいので、
 * この刻みで調べれば、刻みのあいだのずれで初めてかかる箱は無い
 */
const STEPS = [-1, -0.5, 0, 0.5, 1];
const ALL = SPOTS.flatMap((s) => STEPS.flatMap((a) => STEPS.map((b) => shifted(s, a, b))));

/** 体の当たりの円すいを包む箱 */
function hull(s: Spot): Box {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const k of caps(s))
    for (const p of [k.a, k.b])
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i] - k.r);
        max[i] = Math.max(max[i], p[i] + k.r);
      }
  return { min, max };
}

describe('隠れ場所の候補', () => {
  const m = mansion();
  const fixed = levelOf({ ...m, pieces: m.pieces.slice(0, m.pieces.length - m.moving) });

  it('屋敷の 6 部屋にあり、どの部屋にも段 0 と段 1 の候補がある。ポーズは本家の輪のもの', () => {
    const rooms = ROOMS.map((r) => r.name);
    for (const s of SPOTS) {
      expect(rooms, name(s)).toContain(placeOf(s.pos));
      expect(poseById(s.pose).id, name(s)).toBe(s.pose);
    }
    for (const r of rooms)
      for (const tier of [0, 1])
        expect(
          SPOTS.some((s) => placeOf(s.pos) === r && s.tier === tier),
          `${r} ${tier}`
        ).toBe(true);
    expect(SPOTS.filter((s) => s.tier === 2).every((s) => s.cling)).toBe(true);
    expect(SPOTS.filter((s) => s.tier < 2).every((s) => !s.cling)).toBe(true);
    expect(SPOTS.filter((s) => s.cling?.kind === 'ceiling').every((s) => s.pose === 'curl')).toBe(true);
    expect(SPOTS.every((s) => s.slack >= 0 && s.slack <= SHIFT)).toBe(true);
  });

  it('ずらしても同じ部屋にある', () => {
    for (const s of SPOTS)
      for (const a of STEPS) for (const b of STEPS) expect(placeOf(shifted(s, a, b).pos), name(s)).toBe(placeOf(s.pos));
  });

  it('どの種の置き方でも、どれだけずらしても埋まらない', () => {
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const lv = levelOf(mansion(seed));
      for (const s of ALL) if (embedded(lv, s)) bad.push(`${seed} ${name(s)}`);
    }
    expect(bad).toEqual([]);
  });

  it('ずらしても、動く物の置き場所の候補のどれにもかからない', () => {
    const boxes = SETS.flatMap((set) =>
      set.slots.flatMap((slot) => set.units.flatMap((unit) => unit.map((q) => boxOf(place(slot, q)))))
    ).filter((b): b is Box => b !== null);
    const bad = ALL.filter((s) => boxes.some((b) => hits(hull(s), b))).map(name);
    expect(bad).toEqual([]);
  });

  it('ずらしても、壁や動かない家具の中に体の当たりの軸が入らない', () => {
    const bad: string[] = [];
    for (const s of ALL)
      for (const k of caps(s)) {
        const mid: V3 = [(k.a[0] + k.b[0]) / 2, (k.a[1] + k.b[1]) / 2, (k.a[2] + k.b[2]) / 2];
        if ([k.a, k.b, mid].some((p) => fixed.boxes.some((b) => inside(p, b)))) bad.push(name(s));
      }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('置いてもその場から動かず、張り付きはそのまま。壁の張り付きは壁を向く', () => {
    const lv = levelOf(mansion());
    const bad: string[] = [];
    for (const s of ALL) {
      const b = { ...newBody(s.pos), yaw: s.yaw, cling: s.cling, ground: !s.cling };
      for (let i = 0; i < 10; i++) step(b, idle(), lv, 1 / 30);
      const moved = Math.hypot(b.pos[0] - s.pos[0], b.pos[1] - s.pos[1], b.pos[2] - s.pos[2]);
      if (moved > 0.01 || b.cling?.kind !== s.cling?.kind) bad.push(name(s));
      if (s.cling?.kind === 'wall') {
        expect(wallNear(b, lv, s.cling), name(s)).not.toBeNull();
        expect(s.yaw).toBeCloseTo(Math.atan2(-s.cling.nx, -s.cling.nz));
      }
    }
    expect(bad).toEqual([]);
  });

  it('見られる位置は、その部屋の戸口あたりの網の点の目の高さ', () => {
    for (const s of SPOTS) {
      const v = viewOf(s);
      const node = Object.values(NODES).find((n) => n[0] === v[0] && n[2] === v[2]);
      expect(node, name(s)).toBeDefined();
      expect(v[1]).toBeCloseTo(node![1] + EYE_HEIGHT);
    }
  });

  it('同じ種なら同じ置き方、CPU の 1 人めと 2 人めは別々の部屋で、強さの段の候補を slack までずらして選ぶ', () => {
    for (const skill of [SKILLS.weak, SKILLS.normal, SKILLS.strong])
      for (let seed = 1; seed <= 50; seed++) {
        const a = pickSpot(seed, 0, skill.tiers, () => 0.3);
        const b = pickSpot(seed, 1, skill.tiers, () => 0.3);
        expect(pickSpot(seed, 0, skill.tiers, () => 0.3)).toEqual(a);
        expect(placeOf(a.pos)).not.toBe(placeOf(b.pos));
        for (const s of [a, b]) {
          expect(skill.tiers).toContain(s.tier);
          // どれかの候補から、どの向きにも slack までしかずれていない
          const near = (o: Spot) =>
            o.pose === s.pose && o.pos.every((v, i) => Math.abs(v - s.pos[i]) <= o.slack + 1e-9);
          expect(SPOTS.some(near), name(s)).toBe(true);
        }
      }
    const moved = new Set(Array.from({ length: 20 }, (_, i) => pickSpot(i + 1, 0, [0], () => 0).pos.join(',')));
    expect(moved.size).toBeGreaterThan(1);
  });
});
