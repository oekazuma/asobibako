import { describe, expect, it } from 'vitest';
import { apply, createState, step, steer, type GameState } from './engine';

/** 門ごとに多くなるほうへ寄せて最後まで走る */
function playBest(state: GameState) {
  for (let t = 0; t < 120 && !state.result; t += 1 / 60) {
    const next = state.items.find((item) => !item.done && item.type === 'gates');
    if (next?.type === 'gates')
      steer(state, apply(next.left, state.count) >= apply(next.right, state.count) ? 0.2 : 0.8);
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

  it('多いほうの門を選び続ければ、どのレベルもクリアできる', () => {
    for (let level = 1; level <= 30; level++) expect(playBest(createState(level)), `level ${level}`).toBe('clear');
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

  it('群れがいなくなったらしっぱい', () => {
    const state = createState(1);
    state.items = [{ type: 'enemy', at: 0.1, x: 0.5, n: 50, done: false }];
    for (let i = 0; i < 200 && !state.result; i++) step(state, 1 / 60);
    expect(state.result).toBe('fail');
  });
});
