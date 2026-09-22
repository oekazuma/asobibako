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

  it.each(LEVELS.map((level, i) => [i + 1, level] as const))('%i 面は、用意した抜き順でクリアできる', (_, level) => {
    const state = createState(level);
    for (const i of level.solution) {
      pull(state, i);
      run(state, 2.5);
    }
    run(state, 6);
    expect(state.result).toBe('clear');
  });

  it.each(LEVELS.map((level, i) => [i + 1, level] as const).filter(([, level]) => level.trap))(
    '%i 面は、考えずに全部抜くと失敗する',
    (_, level) => {
      const state = createState(level);
      level.pins.forEach((_, i) => pull(state, i));
      run(state, 8);
      expect(state.result).not.toBe('clear');
    }
  );

  it('あとの面ほどピンが多い', () => {
    const pins = LEVELS.slice(0, 8).map((level) => level.pins.length);
    expect(pins[7]).toBeGreaterThan(pins[0]);
    for (let i = 1; i < pins.length; i++) expect(pins[i]).toBeGreaterThanOrEqual(pins[i - 1] - 1);
  });

  it('水がマグマに触れると、マグマは残らず石になる', () => {
    const state = createState(LEVELS[3]);
    pull(state, 0);
    run(state, 3);
    expect(state.particles.some((p) => p.kind === 'lava')).toBe(false);
  });

  it('指の近くのピンを選ぶ', () => {
    const state = createState(LEVELS[1]);
    expect(pinAt(state, 0.2, 0.53)).toBe(0);
    expect(pinAt(state, 0.8, 0.51)).toBe(1);
    expect(pinAt(state, 0.5, 1.2)).toBe(-1);
  });
});
