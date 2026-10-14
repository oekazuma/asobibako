import { describe, expect, it } from 'vitest';
import { nearestHero } from './heroes';
import { addHero, createWorld } from './world';

const VIEW = { w: 260, h: 380 };

describe('Hero', () => {
  it('1 匹のときは今の読み口がその 1 匹を指し、書いたものもその 1 匹に入る', () => {
    const w = createWorld('dog', 1, VIEW);
    expect(w.heroes).toHaveLength(1);
    expect(w.cur).toBe(0);
    expect(w.player).toBe(w.heroes[0].player);
    w.weapons = [];
    expect(w.heroes[0].weapons).toEqual([]);
    w.pending = 2;
    expect(w.heroes[0].pending).toBe(2);
  });

  it('2 匹めは自分の動物・能力・武器を持ち、cur を変えると読み口がそちらを指す', () => {
    const w = createWorld('dog', 1, VIEW);
    const i = addHero(w, 'cat', { might: 3 });
    expect(i).toBe(1);
    w.cur = 1;
    expect(w.animal.id).toBe('cat');
    expect(w.weapons[0].id).toBe(w.heroes[1].animal.weapon);
    expect(w.player).not.toBe(w.heroes[0].player);
    expect(w.stats.might).toBeGreaterThan(w.heroes[0].stats.might);
    w.cur = 0;
    expect(w.animal.id).toBe('dog');
  });
});

describe('いちばん近い動物', () => {
  it('同じ近さなら番号の小さい動物を選び、倒れた動物は飛ばし、全員倒れていれば 0', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    addHero(w, 'cat');
    w.heroes[0].player.x = w.heroes[1].player.x = 10;
    w.heroes[0].player.y = w.heroes[1].player.y = 0;
    expect(nearestHero(w, 0, 0)).toBe(0);
    w.heroes[0].down = true;
    expect(nearestHero(w, 0, 0)).toBe(1);
    w.heroes[1].down = true;
    expect(nearestHero(w, 0, 0)).toBe(0);
  });
});
