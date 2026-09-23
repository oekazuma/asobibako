import { describe, expect, it } from 'vitest';
import { createState, expression, needFor, rub, select, step, touch, type GameState, type Stage } from './engine';

export const stageOf = (over: Partial<Stage>): Stage => ({
  animal: 'bear',
  tools: ['brush'],
  symptoms: [],
  pain0: 0,
  painRate: 0.05,
  shots: 0,
  ...over
});

/** 先端を (x, y) のまわりで小さく回し、こすった距離を稼ぐ */
export function scrub(state: GameState, x: number, y: number, seconds: number) {
  const events = [];
  events.push(...touch(state, x, y));
  for (let t = 0; t < seconds; t += 1 / 60) {
    const a = t * Math.PI * 6;
    events.push(...rub(state, x + Math.cos(a) * 0.01, y + Math.sin(a) * 0.01, 1 / 60));
    events.push(...step(state, 1 / 60));
  }
  return events;
}

describe('dentist engine: ブラシ', () => {
  it('汚れはこすった距離だけ減り、なくなるとキラッと光ってクリア', () => {
    const state = createState(stageOf({ symptoms: [{ type: 'plaque', tooth: 2, amount: 0.3 }] }));
    const { x, y } = state.teeth[2];
    const first = scrub(state, x, y, 0.5);
    const plaque = state.symptoms[0];
    expect(plaque.type === 'plaque' && plaque.left).toBeLessThan(0.3);
    expect(first.some((e) => e.type === 'cleaned')).toBe(false);
    const rest = scrub(state, x, y, 3);
    expect(rest.some((e) => e.type === 'cleaned')).toBe(true);
    expect(needFor(state.symptoms[0])).toBeNull();
    expect(state.result).toBe('clear');
  });

  it('歯のないところをこすっても何も起きない', () => {
    const state = createState(stageOf({ symptoms: [{ type: 'plaque', tooth: 2, amount: 0.3 }] }));
    const events = scrub(state, 0.05, 0.05, 1);
    expect(events.filter((e) => e.type !== 'progress')).toEqual([]);
    expect(state.result).toBeNull();
  });

  it('その面にない道具は選べない', () => {
    const state = createState(stageOf({ tools: ['brush'] }));
    expect(select(state, 'drill')).toBe(false);
    expect(state.tool).toBe('brush');
  });

  it('何も治らないあいだ idle が増え、治ると 0 に戻る', () => {
    const state = createState(stageOf({ symptoms: [{ type: 'plaque', tooth: 2, amount: 5 }] }));
    for (let t = 0; t < 2; t += 1 / 60) step(state, 1 / 60);
    expect(state.idle).toBeGreaterThan(1.9);
    scrub(state, state.teeth[2].x, state.teeth[2].y, 0.2);
    expect(state.idle).toBeLessThan(0.1);
  });

  it('表情はメーターと結果で変わる', () => {
    const state = createState(stageOf({ symptoms: [{ type: 'plaque', tooth: 2, amount: 5 }] }));
    expect(expression(state)).toBe('calm');
    state.pain = 0.55;
    expect(expression(state)).toBe('nervous');
    state.result = 'clear';
    expect(expression(state)).toBe('happy');
  });
});
