import { describe, expect, it } from 'vitest';
import { onScreen, steamFrame } from './draw-obstacles';
import { ZONE_CAP, flameAt, vineAt } from './zones';
import { createWorld } from './world';

const stats = { damage: 1, cooldown: 1, amount: 1, area: 1, speed: 1, pierce: 1, duration: 3, knockback: 0 };

describe('炎とツタの上限', () => {
  it('枠ごとに 48 個までで、超えたら同じ枠のいちばん古いものから消え、ほかの枠は消えない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    vineAt(w, 3, 0, 0, 1, stats);
    for (let i = 0; i < ZONE_CAP + 5; i++) {
      w.time = i;
      flameAt(w, 1, i, 0, 1, stats);
    }
    const mine = w.effects.filter((f) => f.alive && f.slot === 1);
    expect(mine).toHaveLength(ZONE_CAP);
    expect(Math.min(...mine.map((f) => f.born))).toBe(5);
    expect(w.effects.filter((f) => f.alive && f.slot === 3)).toHaveLength(1);
  });
});

describe('画面の範囲', () => {
  it('画面の中と余白の中だけ描く', () => {
    expect(onScreen(10, 10, 0, 0, 260, 380)).toBe(true);
    expect(onScreen(-20, 10, 0, 0, 260, 380)).toBe(true);
    expect(onScreen(-80, 10, 0, 0, 260, 380)).toBe(false);
    expect(onScreen(10, 500, 0, 0, 260, 380)).toBe(false);
  });
});

describe('湯気の出る岩', () => {
  it('0.5 秒ごとに絵を入れ替える（now は秒）', () => {
    expect(steamFrame(0.1, 2)).toBe(0);
    expect(steamFrame(0.6, 2)).toBe(1);
    expect(steamFrame(1.1, 2)).toBe(0);
  });
});
