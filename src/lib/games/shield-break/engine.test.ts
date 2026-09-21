import { describe, expect, it } from 'vitest';
import { choose, createState, LIFE, SHIELD, step, type GameState } from './engine';

const idle = { 1: false, 2: false };

/** 次の拍まで進めて、その拍の結果を返す */
function beat(state: GameState, guarding = idle) {
  const events = step(state, state.timer, guarding);
  const found = events.find((e) => e.type === 'beat');
  if (!found || found.type !== 'beat') throw new Error('拍が来ない');
  return found.outcome;
}

describe('shield-break engine', () => {
  it('エネルギーがないと攻撃は選べない', () => {
    const state = createState();
    expect(choose(state, 1, 'attack')).toEqual([{ type: 'empty', player: 1 }]);
    expect(state.pending[1]).toBeNull();
  });

  it('ためてから攻撃すると、ガードしていない相手の体力が減る', () => {
    const state = createState();
    choose(state, 1, 'charge');
    beat(state);
    expect(state.energy[1]).toBe(1);
    choose(state, 1, 'attack');
    choose(state, 2, 'charge');
    const outcome = beat(state);
    expect(outcome.hit[2]).toBe(true);
    expect(state.life[2]).toBe(LIFE - 1);
    expect(state.energy).toEqual({ 1: 0, 2: 1 });
  });

  it('拍の瞬間に指を置いていればガードになり、盾が 1 減って体力は減らない', () => {
    const state = createState();
    state.energy[1] = 1;
    choose(state, 1, 'attack');
    const outcome = beat(state, { 1: false, 2: true });
    expect(outcome.blocked[2]).toBe(true);
    expect(state.shield[2]).toBe(SHIELD - 1);
    expect(state.life[2]).toBe(LIFE);
  });

  it('盾が尽きるとガードしても当たる', () => {
    const state = createState();
    state.energy[1] = 1;
    state.shield[2] = 0;
    choose(state, 1, 'attack');
    expect(beat(state, { 1: false, 2: true }).hit[2]).toBe(true);
  });

  it('スワイプした指を置いたままでも攻撃が出る', () => {
    const state = createState();
    state.energy[1] = 1;
    choose(state, 1, 'attack');
    expect(beat(state, { 1: true, 2: false }).act[1]).toBe('attack');
  });

  it('攻撃どうしは相打ちで、どちらも減らない', () => {
    const state = createState();
    state.energy = { 1: 1, 2: 1 };
    choose(state, 1, 'attack');
    choose(state, 2, 'attack');
    const outcome = beat(state);
    expect(outcome.hit).toEqual({ 1: false, 2: false });
    expect(state.energy).toEqual({ 1: 0, 2: 0 });
  });

  it('体力が尽きたら、結果を見せたあとに勝ちが決まる', () => {
    const state = createState();
    state.energy[1] = 1;
    state.life[2] = 1;
    choose(state, 1, 'attack');
    beat(state);
    expect(state.winner).toBe(1);
    expect(step(state, 5, idle)).toEqual([{ type: 'win', player: 1 }]);
  });
});
