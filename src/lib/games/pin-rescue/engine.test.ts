import { describe, expect, it } from 'vitest';
import { createState, pinAt, pull, step, type GameState } from './engine';
import { LEVELS } from './levels';

function run(state: GameState, seconds: number) {
  for (let t = 0; t < seconds && !state.result; t += 1 / 60) step(state, 1 / 60);
}

describe('pin-rescue engine', () => {
  it('ピンを抜かなければ、金はピンの上に留まる', () => {
    const state = createState(LEVELS[0]);
    run(state, 2);
    expect(state.result).toBeNull();
    expect(Math.max(...state.particles.map((p) => p.y))).toBeLessThan(0.55);
  });

  it('1 面はピンを抜けば金が届いてクリア', () => {
    const state = createState(LEVELS[0]);
    pull(state, 0);
    run(state, 6);
    expect(state.result).toBe('clear');
  });

  it('2 面でマグマのピンを抜くと勇者が焼ける', () => {
    const state = createState(LEVELS[1]);
    pull(state, 1);
    run(state, 6);
    expect(state.result).toBe('burned');
  });

  it('3 面は、マグマ・ななめ・金の順に抜けばクリア', () => {
    const state = createState(LEVELS[2]);
    pull(state, 1);
    run(state, 3);
    pull(state, 2);
    run(state, 0.5);
    pull(state, 0);
    run(state, 6);
    expect(state.result).toBe('clear');
  });

  it('4 面は、水でマグマを石にしてから抜けばクリア', () => {
    const state = createState(LEVELS[3]);
    pull(state, 0);
    run(state, 3);
    expect(state.particles.some((p) => p.kind === 'lava')).toBe(false);
    pull(state, 2);
    run(state, 1.5);
    pull(state, 1);
    run(state, 6);
    expect(state.result).toBe('clear');
  });

  it('指の近くのピンを選ぶ', () => {
    const state = createState(LEVELS[1]);
    expect(pinAt(state, 0.2, 0.53)).toBe(0);
    expect(pinAt(state, 0.8, 0.51)).toBe(1);
    expect(pinAt(state, 0.5, 1.2)).toBe(-1);
  });
});
