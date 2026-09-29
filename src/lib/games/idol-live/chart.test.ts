import { describe, expect, it } from 'vitest';
import { scoreOf } from '$lib/music/tune';
import { APPEAL, baseCamera, toScreen, toWorld, unit, WIDE } from './camera';
import { APPROACH, RADIUS, SPECIAL_APPROACH, type Level, type Note } from './chart';
import { SONGS, trackOf } from './songs';

const points = (n: Note) => (n.kind === 'slide' ? n.path : [[n.x, n.y] as [number, number]]);

describe.each(SONGS.flatMap((s) => (['easy', 'normal'] as Level[]).map((l) => [s.id, l] as const)))(
  '%s の %s の譜面',
  (id, level) => {
    const track = trackOf(id);
    const B = track.beat;
    const notes = track.charts[level];
    const plain = notes.filter((n) => n.kind !== 'special');
    const shown = (n: Note): [number, number] => [
      n.t - (n.kind === 'special' ? SPECIAL_APPROACH : APPROACH) * B,
      n.end + 0.22
    ];

    it('曲の長さが小節の区切りにそろい、区間とふりつけが曲の中に収まる', () => {
      expect(scoreOf(track.def.music).notes.length % 8).toBe(0);
      for (const m of track.def.moves) expect(m[0]).toBeLessThan(track.length);
      expect(track.specials.length).toBeGreaterThan(0);
    });

    it.each([
      ['iPad', 820, 1180],
      ['iPhone', 390, 844]
    ])('%s の縦長の画面で、どのノーツも画面の中（上の隅のボタンと下の客席を避けた所）に出る', (_, w, h) => {
      for (const n of plain) {
        const cam = baseCamera(shown(n)[0] / B);
        for (const p of points(n))
          for (const c of [cam, WIDE]) {
            const [x, y] = toScreen(c, w, h, p);
            const r = RADIUS * unit(w, h);
            const at = `${n.t / B} 拍の ${n.kind}`;
            expect(x, at).toBeGreaterThan(r * 0.8);
            expect(x, at).toBeLessThan(w - r * 0.8);
            expect(y, at).toBeGreaterThan(h * 0.13);
            expect(y, at).toBeLessThan(h * 0.84);
          }
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
          expect(d, `${a.t / B} 拍と ${b.t / B} 拍`).toBeGreaterThan(RADIUS * 2);
        }
    });

    it('スペシャルのあと顔に寄っているあいだは、ほかのノーツを出さない', () => {
      for (const s of track.specials)
        for (const n of plain) {
          const [a, b] = shown(n).map((t) => t / B);
          expect(b <= s || a >= s + APPEAL, `${n.t / B} 拍`).toBe(true);
        }
    });

    it('スライドは指でなぞれるくらい長い', () => {
      for (const n of notes.filter((n) => n.kind === 'slide')) {
        let len = 0;
        for (let i = 1; i < n.path.length; i++)
          len += Math.hypot(n.path[i][0] - n.path[i - 1][0], n.path[i][1] - n.path[i - 1][1]);
        expect(len, `${n.t / B} 拍`).toBeGreaterThan(0.2);
      }
    });

    it('かんたんは、ノーツのあいだが 2 拍以上あく', () => {
      if (level !== 'easy') return;
      for (let i = 1; i < notes.length; i++)
        if (notes[i].kind !== 'special') expect(notes[i].t - notes[i - 1].end).toBeGreaterThan(2 * B - 1e-6);
    });
  }
);

it('画面と世界の座標は行き来できる', () => {
  const c = { fx: 0.1, fy: -0.6, zoom: 1.7, ay: 0.4, roll: -0.05 };
  const [x, y] = toWorld(c, 820, 1180, toScreen(c, 820, 1180, [0.3, -0.8]));
  expect(x).toBeCloseTo(0.3);
  expect(y).toBeCloseTo(-0.8);
});
