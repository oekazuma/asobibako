import { describe, expect, it } from 'vitest';
import { createState, GOAL, isGo, MEMO_S, press, step } from './engine';

describe('feint-master engine', () => {
  it('ヒントを覚えている間に押しても何も起きない', () => {
    const state = createState();
    expect(press(state, 1)).toEqual([]);
    expect(state.phase).toBe('memo');
  });

  it('2 人は色と形の別々の半分を教えられ、回ごとに入れ替わる', () => {
    const state = createState();
    expect(state.know).toEqual({ 1: 'color', 2: 'shape' });
    state.phase = 'show';
    state.timer = 0;
    step(state, 0.1);
    expect(state.know).toEqual({ 1: 'shape', 2: 'color' });
  });

  it('正解の合図で押すと点、違う合図で押すと相手の点', () => {
    const state = createState(() => 0);
    step(state, MEMO_S, () => 0);
    expect(isGo(state)).toBe(true);
    expect(press(state, 2)).toEqual([{ type: 'score', player: 2 }]);

    const miss = createState(() => 0);
    step(miss, MEMO_S, () => 0.99);
    expect(isGo(miss)).toBe(false);
    press(miss, 2);
    expect(miss.score).toEqual({ 1: 1, 2: 0 });
  });

  it('しばらく正解が出なければ、必ず正解が出る', () => {
    const state = createState(() => 0);
    let flips = 0;
    step(state, MEMO_S, () => 0.99);
    while (!isGo(state) && flips < 20) {
      step(state, 5, () => 0.99);
      flips += 1;
    }
    expect(isGo(state)).toBe(true);
    expect(flips).toBeLessThanOrEqual(5);
  });

  it('GOAL 点目のあと、結果を見せてから勝ちが決まる', () => {
    const state = createState(() => 0);
    state.score[1] = GOAL - 1;
    step(state, MEMO_S, () => 0);
    press(state, 1);
    expect(state.winner).toBe(1);
    expect(step(state, 5)).toEqual([{ type: 'win', player: 1 }]);
  });

  it('向かい側も GOAL 点目のあとに勝ちが決まる', () => {
    const state = createState(() => 0);
    state.score[2] = GOAL - 1;
    step(state, MEMO_S, () => 0);
    press(state, 2);
    expect(state.winner).toBe(2);
    expect(step(state, 5)).toEqual([{ type: 'win', player: 2 }]);
  });
});
