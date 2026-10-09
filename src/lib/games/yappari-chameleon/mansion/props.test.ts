import { describe, expect, it } from 'vitest';
import { idle, newBody, step, type Body, type Box, type Level } from '../move';
import { levelOf, mansion, SIZES, SPAWNS, type Piece } from './layout';
import { ART, arrange, artOf, place, propPieces, SETS } from './props';
import { DOORWAYS } from './rooms';

const boxOf = (q: Piece): Box | null => {
  const s = SIZES[q.kind];
  if (!s) return null;
  const [w, h, d] = q.turn % 2 ? [s[2], s[1], s[0]] : s;
  return { min: [q.at[0] - w / 2, q.at[1], q.at[2] - d / 2], max: [q.at[0] + w / 2, q.at[1] + h, q.at[2] + d / 2] };
};
const hits = (a: Box, b: Box) => [0, 1, 2].every((i) => a.min[i] < b.max[i] - 1e-6 && b.min[i] < a.max[i] - 1e-6);
const SEEDS = [null, ...Array.from({ length: 200 }, (_, i) => i + 1)];

/** 種の置き方で、動く物 1 つずつの当たりの箱（同じ物の部品はまとめる） */
function units(seed: number | null): Box[][] {
  const slots = arrange(seed);
  return SETS.flatMap((set, k) =>
    set.units.map((unit, i) => unit.map((q) => boxOf(place(slots[k][i], q))).filter((b): b is Box => b !== null))
  );
}

describe('小物の置き方', () => {
  it('同じ種は同じ置き方で、種によって置き方が変わる', () => {
    expect(arrange(7)).toEqual(arrange(7));
    expect(SEEDS.slice(1, 20).some((s) => JSON.stringify(arrange(s)) !== JSON.stringify(arrange(null)))).toBe(true);
  });

  it('既定の置き方は候補の頭から順に置き、どの組も候補の数より少なく置く', () => {
    const slots = arrange(null);
    SETS.forEach((set, k) => {
      expect(set.slots.length).toBeGreaterThan(set.units.length);
      expect(slots[k]).toEqual(set.slots.slice(0, set.units.length));
    });
  });

  it('1 つの組の中で同じ候補を 2 回使わない', () => {
    for (const seed of SEEDS)
      for (const chosen of arrange(seed)) expect(new Set(chosen).size, `${seed}`).toBe(chosen.length);
  });

  it('置いた物は、壁・動かない家具・戸口の通り道・始める場所・ほかの動く物に重ならない', () => {
    const m = mansion();
    const fixed = levelOf({ ...m, pieces: m.pieces.slice(0, m.pieces.length - m.moving) }).boxes;
    const spawns: Box[] = Object.values(SPAWNS).flatMap((row) =>
      Object.values(row).map((at): Box => ({
        min: [at[0] - 0.3, 0, at[2] - 0.3],
        max: [at[0] + 0.3, 1.15, at[2] + 0.3]
      }))
    );
    const still = [...fixed, ...DOORWAYS, ...spawns];
    // 組み合わせが数百万になるので、1 つずつ expect すると 4 秒かかる。重なりだけを集めてまとめて見る
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const all = units(seed);
      for (const [i, unit] of all.entries())
        for (const a of unit) {
          for (const b of still) if (hits(a, b)) bad.push(`${seed} ${a.min} と ${b.min}`);
          for (const other of all.slice(i + 1))
            for (const b of other) if (hits(a, b)) bad.push(`${seed} ${a.min} と ${b.min}`);
        }
    }
    expect(bad).toEqual([]);
  });

  it('動く物の部品の数と並びは、種が変わっても同じ（3D は作り直さずに動かす）', () => {
    const kinds = (s: number | null) => propPieces(s).map((q) => q.kind);
    expect(kinds(1)).toEqual(kinds(null));
    expect(kinds(99)).toEqual(kinds(null));
    const m = mansion(5);
    expect(m.pieces.slice(m.pieces.length - m.moving)).toEqual(propPieces(5));
  });

  it('候補の向きで、物の中の位置も回す', () => {
    const q: Piece = { kind: 'chair', at: [0, 0, -0.9], turn: 0 };
    expect(place({ at: [1, 0, 1], turn: 1 }, q)).toMatchObject({ at: [1 - 0.9, 0, 1], turn: 1 });
    expect(place({ at: [1, 0, 1], turn: 2 }, q).at).toEqual([1, 0, 1.9]);
  });

  it('額の絵柄は種で決まり、既定は 0, 1, 2… の順', () => {
    expect(artOf(null, 3)).toEqual([0, 1, 2]);
    expect(artOf(5, 3)).toEqual(artOf(5, 3));
    for (const k of artOf(8, 20)) expect(k >= 0 && k < ART).toBe(true);
    expect(mansion(5).arts).toEqual(artOf(5, 3));
  });

  it('同じ種なら、端末ごとに作る当たりが同じ', () => {
    expect(JSON.stringify(levelOf(mansion(42)))).toBe(JSON.stringify(levelOf(mansion(42))));
  });

  it('どの置き方でも、戸口から 3 部屋の中ほどまで歩ける', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const lv: Level = levelOf(mansion(seed));
      const go = (from: [number, number, number], x: number, z: number): Body => {
        const b = newBody(from);
        for (let i = 0; i < 60; i++) step(b, idle(), lv, 1 / 60);
        for (let t = 0; t < 30; t += 1 / 60) {
          const dx = x - b.pos[0];
          const dz = z - b.pos[2];
          const d = Math.hypot(dx, dz);
          if (d < 0.05) break;
          step(b, { ...idle(), x: dx / Math.max(d, 1), z: dz / Math.max(d, 1) }, lv, 1 / 60);
        }
        return b;
      };
      expect(go([5, 0, 6], 9.5, 6).pos[0], `${seed} 書斎`).toBeGreaterThan(9.4);
      expect(go([-16, 0, 5], -16, 9.5).pos[2], `${seed} キッチン`).toBeGreaterThan(9.4);
      expect(go([-15, 0, 5], -15, 0).pos[2], `${seed} ランドリー`).toBeLessThan(0.1);
    }
  });
});
