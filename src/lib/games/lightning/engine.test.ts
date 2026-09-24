import { describe, expect, it } from 'vitest';
import { answer, createState, GOAL, step, touch, type GameState } from './engine';

function going(command: GameState['command']): GameState {
  const state = createState(() => 0);
  state.phase = 'go';
  state.command = command;
  state.timer = 2;
  return state;
}

describe('lightning engine', () => {
  it('待ち時間が過ぎると指示が出る', () => {
    const state = createState(() => 0.5);
    expect(step(state, 10, () => 0.5)).toEqual([{ type: 'go' }]);
    expect(state.phase).toBe('go');
  });

  it('指示どおりのジェスチャで点が入る', () => {
    const state = going('hold');
    expect(answer(state, 2, 'hold')).toEqual([{ type: 'score', player: 2 }]);
    expect(state.score[2]).toBe(1);
  });

  it('間違えるとその指示の間は答えられず、相手はまだ取れる', () => {
    const state = going('up');
    answer(state, 1, 'down');
    expect(answer(state, 1, 'up')).toEqual([]);
    expect(answer(state, 2, 'up')).toEqual([{ type: 'score', player: 2 }]);
  });

  it('点を取ると、指示から答えるまでの秒数が残る', () => {
    const state = going('tap');
    answer(state, 1, 'tap');
    expect(state.reaction).toBeCloseTo(state.limit - 2);
  });

  it('逆向きの矢印は反対にスワイプすると点になる', () => {
    const state = going('up');
    state.reverse = true;
    answer(state, 1, 'up');
    expect(answer(state, 2, 'down')).toEqual([{ type: 'score', player: 2 }]);
  });

  it('勝ちが近づくと答えられる時間が縮み、逆向きの矢印が混ざる', () => {
    const state = createState(() => 0);
    step(state, 10, () => 0.99);
    const calm = state.limit;
    expect(state.reverse).toBe(false);

    const hot = createState(() => 0);
    hot.score[2] = GOAL - 1;
    hot.command = 'tap';
    // ドクロを避け、矢印（up）を選び、逆向きにする
    const rolls = [0.99, 0.4, 0];
    step(hot, 10, () => rolls.shift() ?? 0);
    expect(hot.command).toBe('up');
    expect(hot.reverse).toBe(true);
    expect(hot.limit).toBeLessThan(calm);
  });

  it('2 人とも間違えたら誰の点にもならない', () => {
    const state = going('tap');
    answer(state, 1, 'two');
    const events = answer(state, 2, 'hold');
    expect(events).toContainEqual({ type: 'timeout' });
    expect(state.score).toEqual({ 1: 0, 2: 0 });
  });

  it('合図の前に触るとお手つきで、その指示には答えられない', () => {
    const state = createState(() => 0);
    expect(touch(state, 1)).toEqual([{ type: 'early', player: 1 }]);
    step(state, 10, () => 0.9);
    expect(answer(state, 1, state.command as 'tap')).toEqual([]);
  });

  it('ドクロに触れると相手の点', () => {
    const state = going('skull');
    touch(state, 1);
    expect(state.score).toEqual({ 1: 0, 2: 1 });
  });

  it('GOAL 点目を取ると、結果を見せたあとに勝ちが決まる', () => {
    const state = going('tap');
    state.score[1] = GOAL - 1;
    answer(state, 1, 'tap');
    expect(state.winner).toBe(1);
    expect(step(state, 5)).toEqual([{ type: 'win', player: 1 }]);
  });

  it('向かい側も GOAL 点目で勝てる', () => {
    const state = going('tap');
    state.score[2] = GOAL - 1;
    answer(state, 2, 'tap');
    expect(state.winner).toBe(2);
    expect(step(state, 5)).toEqual([{ type: 'win', player: 2 }]);
  });
});
