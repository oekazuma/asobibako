import { describe, expect, it } from 'vitest';
import { scoreOf } from '$lib/music/tune';
import {
  APPEAL,
  APPROACH,
  baseCamera,
  NOTES,
  RADIUS,
  SPECIAL_APPROACH,
  SPECIALS,
  toScreen,
  toWorld,
  WIDE,
  type Note
} from './chart';
import { WINDOW } from './judge';
import { BEAT, LENGTH, SONG } from './song';

const points = (n: Note) => (n.kind === 'slide' ? n.path : [[n.x, n.y] as [number, number]]);
const shown = (n: Note): [number, number] => [
  n.t - (n.kind === 'special' ? SPECIAL_APPROACH : APPROACH) * BEAT,
  n.end + WINDOW.good
];

describe('譜面', () => {
  it('曲の長さと小節が楽譜と合う', () => {
    expect(scoreOf(SONG).notes.length).toBe(LENGTH * 2);
  });

  it.each([
    ['iPad', 820, 1180],
    ['iPhone', 390, 844]
  ])('%s の縦長の画面で、どのノーツも画面の中（上の隅のボタンと下の客席を避けた所）に出る', (_, w, h) => {
    for (const n of NOTES.filter((n) => n.kind !== 'special')) {
      const cam = baseCamera(shown(n)[0] / BEAT);
      for (const p of points(n)) {
        for (const c of [cam, WIDE]) {
          const [x, y] = toScreen(c, w, h, p);
          const r = RADIUS * (w / 1.3 < h * 0.46 ? w / 1.3 : h * 0.46);
          expect(x, `${n.t / BEAT} 拍の ${n.kind}`).toBeGreaterThan(r * 0.8);
          expect(x, `${n.t / BEAT} 拍の ${n.kind}`).toBeLessThan(w - r * 0.8);
          expect(y, `${n.t / BEAT} 拍の ${n.kind}`).toBeGreaterThan(h * 0.13);
          expect(y, `${n.t / BEAT} 拍の ${n.kind}`).toBeLessThan(h * 0.84);
        }
      }
    }
  });

  it('同時に見えているノーツどうしは重ならない', () => {
    const plain = NOTES.filter((n) => n.kind !== 'special');
    for (let i = 0; i < plain.length; i++)
      for (let j = i + 1; j < plain.length; j++) {
        const [a, b] = [plain[i], plain[j]];
        const [a0, a1] = shown(a);
        const [b0, b1] = shown(b);
        if (b0 >= a1 || a0 >= b1) continue;
        const d = Math.min(
          ...points(a).flatMap(([ax, ay]) => points(b).map(([bx, by]) => Math.hypot(ax - bx, ay - by)))
        );
        expect(d, `${a.t / BEAT} 拍と ${b.t / BEAT} 拍`).toBeGreaterThan(RADIUS * 2);
      }
  });

  it('スペシャルのあと顔に寄っているあいだは、ほかのノーツを出さない', () => {
    for (const s of SPECIALS)
      for (const n of NOTES.filter((n) => n.kind !== 'special')) {
        const [a, b] = shown(n).map((t) => t / BEAT);
        expect(b <= s || a >= s + APPEAL, `${n.t / BEAT} 拍`).toBe(true);
      }
  });

  it('スライドは指でなぞれるくらい長い', () => {
    for (const n of NOTES.filter((n) => n.kind === 'slide')) {
      let len = 0;
      for (let i = 1; i < n.path.length; i++)
        len += Math.hypot(n.path[i][0] - n.path[i - 1][0], n.path[i][1] - n.path[i - 1][1]);
      expect(len, `${n.t / BEAT} 拍`).toBeGreaterThan(0.2);
    }
  });

  it('画面と世界の座標は行き来できる', () => {
    const c = { fx: 0.1, fy: -0.6, zoom: 1.7, ay: 0.4, roll: -0.05 };
    const [x, y] = toWorld(c, 820, 1180, toScreen(c, 820, 1180, [0.3, -0.8]));
    expect(x).toBeCloseTo(0.3);
    expect(y).toBeCloseTo(-0.8);
  });
});
