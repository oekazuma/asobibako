import { describe, expect, it } from 'vitest';
import { scoreOf } from '$lib/music/tune';
import { APPROACH, SPECIAL_APPROACH, type Level } from './chart';
import type { Placed } from './judge';
import { APPEAL, place, radiusOf } from './shots';
import { SONGS, trackOf } from './songs';

const SIZES = [
  ['iPad', 820, 1180],
  ['iPhone', 390, 844]
] as const;

describe.each(
  SONGS.flatMap((s) =>
    (['easy', 'normal'] as Level[]).flatMap((l) => SIZES.map(([name, w, h]) => [s.id, l, name, w, h] as const))
  )
)('%s の %s の譜面（%s）', (id, level, _, w, h) => {
  const track = trackOf(id);
  const B = track.beat;
  const placed = place(track, track.charts[level], w, h);
  const plain = placed.filter((n) => n.kind !== 'special');
  const r = radiusOf(w, h);
  const points = (n: Placed) => (n.kind === 'slide' ? n.path : [[n.x, n.y] as [number, number]]);
  const shown = (n: Placed): [number, number] => [
    n.t - (n.kind === 'special' ? SPECIAL_APPROACH : APPROACH) * B,
    n.end + 0.22
  ];

  it('曲の長さが小節の区切りにそろい、ふりつけが曲の中に収まる', () => {
    expect(scoreOf(track.def.music).notes.length % 8).toBe(0);
    for (const m of track.def.moves) expect(m[0]).toBeLessThan(track.length);
  });

  it('どのノーツも画面の中（上の隅のボタンと、いちばん下を避けた所）に出る', () => {
    for (const n of plain)
      for (const [x, y] of points(n)) {
        const at = `${(n.t / B).toFixed(1)} 拍の ${n.kind}`;
        expect(x, at).toBeGreaterThan(r);
        expect(x, at).toBeLessThan(w - r);
        expect(y, at).toBeGreaterThan(h * 0.13);
        expect(y, at).toBeLessThan(h * 0.9);
      }
  });

  it('同時に見えているノーツどうしは重ならない', () => {
    for (let i = 0; i < plain.length; i++)
      for (let j = i + 1; j < plain.length; j++) {
        const [a, b] = [plain[i], plain[j]];
        const [a0, a1] = shown(a);
        const [b0, b1] = shown(b);
        if (b0 >= a1 || a0 >= b1) continue;
        const d = Math.min(
          ...points(a).flatMap(([ax, ay]) => points(b).map(([bx, by]) => Math.hypot(ax - bx, ay - by)))
        );
        expect(d, `${(a.t / B).toFixed(1)} 拍と ${(b.t / B).toFixed(1)} 拍`).toBeGreaterThan(r * 2);
      }
  });

  it('スペシャルのあと顔に寄っているあいだは、ほかのノーツを出さない', () => {
    for (const s of track.specials)
      for (const n of plain) {
        const [a, b] = shown(n).map((t) => t / B);
        expect(b <= s || a >= s + APPEAL, `${(n.t / B).toFixed(1)} 拍`).toBe(true);
      }
  });

  it('スライドは指でなぞれるくらい長い', () => {
    for (const n of plain.filter((n) => n.kind === 'slide')) {
      let len = 0;
      for (let i = 1; i < n.path.length; i++)
        len += Math.hypot(n.path[i][0] - n.path[i - 1][0], n.path[i][1] - n.path[i - 1][1]);
      expect(len, `${(n.t / B).toFixed(1)} 拍`).toBeGreaterThan(r * 3);
    }
  });

  it('かんたんは、ノーツのあいだが 2 拍以上あく', () => {
    if (level !== 'easy') return;
    const all = track.charts.easy;
    for (let i = 1; i < all.length; i++)
      if (all[i].kind !== 'special') expect(all[i].t - all[i - 1].end).toBeGreaterThan(2 * B - 1e-6);
  });
});
