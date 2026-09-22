import { describe, expect, it } from 'vitest';
import { createState, step, STUN_S, type GameState } from './engine';

const calm = () => {
  const state = createState(() => 0.5);
  state.calmFor = 1000;
  return state;
};

/** seconds 秒のあいだ、1 秒あたり rate[p] だけ引き続ける */
const haul = (state: GameState, seconds: number, rate: { 1: number; 2: number }, dt = 1 / 60) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...step(state, dt, { 1: rate[1] * dt, 2: rate[2] * dt }));
  return events;
};

describe('fish-pull engine', () => {
  it('ほどよく引き続ければ、相手が引かないうちに釣り上げられる', () => {
    const state = calm();
    const events = haul(state, 6, { 1: 0.8, 2: 0 });
    expect(events).toContainEqual({ type: 'catch', player: 1 });
    expect(events.some((e) => e.type === 'snap')).toBe(false);
    expect(state.winner).toBe(1);
  });

  it('同じ強さで引き合えば、魚は真ん中から動かない', () => {
    const state = calm();
    haul(state, 3, { 1: 0.6, 2: 0.6 });
    expect(state.fish.y).toBeCloseTo(0.5, 2);
  });

  it('暴れているときに強く引くと糸が切れ、しばらく引けず、魚は相手側へ逃げる', () => {
    const state = calm();
    state.thrash = 1.2;
    state.thrashDir = 1;
    const events = haul(state, 0.6, { 1: 1.2, 2: 0 });
    expect(events).toContainEqual({ type: 'snap', player: 1 });
    expect(state.stunned[1]).toBeGreaterThan(0);
    expect(state.fish.v).toBeLessThan(0.2);

    const y = state.fish.y;
    haul(state, 0.3, { 1: 5, 2: 0 });
    expect(state.fish.y).toBeLessThanOrEqual(y + 0.05);
  });

  it('糸が切れても、時間がたてばまた引ける', () => {
    const state = calm();
    state.stunned[1] = STUN_S;
    haul(state, STUN_S + 0.1, { 1: 0, 2: 0 });
    expect(state.stunned[1]).toBe(0);
  });

  it('手を休めれば張りはゆるむ', () => {
    const state = calm();
    state.tension[2] = 0.9;
    haul(state, 1, { 1: 0, 2: 0 });
    expect(state.tension[2]).toBeLessThan(0.5);
  });

  it('落ち着いた魚も、時間がたつと暴れ出す', () => {
    const state = createState(() => 0.5);
    const events = haul(state, 5, { 1: 0, 2: 0 });
    expect(events).toContainEqual({ type: 'thrash' });
  });

  it('向かい側も、相手が引かないうちに釣り上げられる', () => {
    const state = calm();
    const events = haul(state, 6, { 1: 0, 2: 0.8 });
    expect(events).toContainEqual({ type: 'catch', player: 2 });
    expect(state.winner).toBe(2);
  });

  it('釣り上げたあとは進まない', () => {
    const state = calm();
    haul(state, 6, { 1: 0.8, 2: 0 });
    const y = state.fish.y;
    expect(haul(state, 1, { 1: 0, 2: 5 })).toEqual([]);
    expect(state.fish.y).toBe(y);
  });
});
