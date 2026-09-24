import { describe, expect, it } from 'vitest';
import { apply, bestX, createState, cutBy, joinBy, step, steer, type GameState, type Item } from './engine';
import meta from './meta';

/** 門ごとに多くなるほうへ、ノコギリや柵はよけ、道の仲間は拾いに寄せて最後まで走る */
function playBest(state: GameState) {
  for (let t = 0; t < 180 && !state.result; t += 1 / 60) {
    const next = state.items.find((item) => !item.done && item.type !== 'enemy');
    if (next?.type === 'gates')
      steer(state, apply(next.left, state.count) >= apply(next.right, state.count) ? 0.2 : 0.8);
    else if (next) steer(state, bestX(next, state.count));
    step(state, 1 / 60);
  }
  return state.result;
}

describe('gate-run engine', () => {
  it('門の計算', () => {
    expect(apply({ kind: '+', n: 5 }, 10)).toBe(15);
    expect(apply({ kind: 'x', n: 3 }, 10)).toBe(30);
    expect(apply({ kind: '-', n: 20 }, 10)).toBe(0);
    expect(apply({ kind: '÷', n: 2 }, 11)).toBe(5);
  });

  it('同じレベルは同じコースになる', () => {
    expect(createState(3).items).toEqual(createState(3).items);
  });

  it('多いほうの門を選び続ければ、どの面もクリアできる', () => {
    for (let level = 1; level <= meta.levels; level++)
      expect(playBest(createState(level)), `level ${level}`).toBe('clear');
  });

  it('同じコースの面はない', () => {
    const courses = new Set(Array.from({ length: meta.levels }, (_, i) => JSON.stringify(createState(i + 1).items)));
    expect(courses.size).toBe(meta.levels);
  });

  it('レベルが上がるほど、コースは長く、城は強くなる', () => {
    for (let level = 2; level <= meta.levels; level++) {
      const [a, b] = [createState(level - 1), createState(level)];
      expect(b.items.length, `level ${level}`).toBeGreaterThanOrEqual(a.items.length);
    }
    expect(createState(meta.levels).items.length).toBeGreaterThan(createState(1).items.length * 2);
  });

  it('最初の 2 面は、門を選ばずにまっすぐ走ってもクリアできる', () => {
    for (const level of [1, 2]) {
      const state = createState(level);
      for (let t = 0; t < 120 && !state.result; t += 1 / 60) step(state, 1 / 60);
      expect(state.result, `level ${level}`).toBe('clear');
    }
  });

  it('敵とぶつかると止まって、同じ数ずつ減る', () => {
    const state = createState(1);
    state.items = [{ type: 'enemy', at: 0.1, x: 0.5, n: 4, done: false }];
    state.count = 10;
    for (let i = 0; i < 60; i++) step(state, 1 / 60);
    expect(state.count).toBe(6);
  });

  it('ノコギリに触れた幅だけ減り、よければ減らない', () => {
    const saw: Item = { type: 'saw', at: 1, x: 0.5, amp: 0, freq: 0, done: false };
    expect(cutBy(saw, 0.5, 20)).toBeGreaterThan(0);
    expect(cutBy(saw, 0.86, 20)).toBe(0);
  });

  it('柵はすき間からはみ出た分だけ減り、道の仲間は触れれば増える', () => {
    const wall: Item = { type: 'wall', at: 1, gap: 0.3, width: 0.4, done: false };
    expect(cutBy(wall, 0.3, 20)).toBe(0);
    expect(cutBy(wall, 0.8, 20)).toBe(20);
    const ally: Item = { type: 'ally', at: 1, x: 0.7, n: 10, done: false };
    expect(joinBy(ally, 0.7, 5)).toBe(10);
    expect(joinBy(ally, 0.2, 5)).toBe(0);
  });

  it('あとの面ほど、仲間・ノコギリ・柵が混ざる', () => {
    const kinds = new Set(createState(30).items.map((item) => item.type));
    expect(kinds).toEqual(new Set(['gates', 'enemy', 'ally', 'saw', 'wall']));
    expect(createState(1).items.every((item) => item.type === 'gates' || item.type === 'enemy')).toBe(true);
  });

  it('群れがいなくなったらしっぱい', () => {
    const state = createState(1);
    state.items = [{ type: 'enemy', at: 0.1, x: 0.5, n: 50, done: false }];
    for (let i = 0; i < 200 && !state.result; i++) step(state, 1 / 60);
    expect(state.result).toBe('fail');
  });
});
