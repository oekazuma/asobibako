import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '$lib/levels';
import { createState, pinAt, pull, step, type GameState } from './engine';
import { LEVELS, tierFor } from './levels';

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
      expect(state.result).toMatch(/^(burned|stuck)$/);
    }
  );

  it('100 面に同じ面はない', () => {
    expect(new Set(LEVELS.map((level) => JSON.stringify(level))).size).toBe(LEVELS.length);
  });

  it('面は 100 ある', () => {
    expect(LEVELS).toHaveLength(MAX_LEVEL);
  });

  it('レベルが上がるほど、型は難しくなり、要る金の割合も上がる', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(tierFor(i + 1), `level ${i + 1}`).toBeGreaterThanOrEqual(tierFor(i));
      expect(LEVELS[i].need).toBeGreaterThan(LEVELS[i - 1].need);
    }
    expect(LEVELS[99].pins.length).toBeGreaterThan(LEVELS[0].pins.length);
  });

  it('水がマグマに触れると、マグマは残らず石になる', () => {
    const level = LEVELS.find((l) => l.pools.some((p) => p.kind === 'water'))!;
    const state = createState(level);
    pull(state, level.solution[0]);
    run(state, 3);
    expect(state.particles.some((p) => p.kind === 'lava')).toBe(false);
  });

  it('遅いフレームでもサブステップは上限までしか進まない', () => {
    const state = createState(LEVELS[0]);
    pull(state, LEVELS[0].solution[0]);
    const before = state.particles.map((p) => p.y);
    step(state, 0.05);
    const slow = state.particles.map((p) => p.y);
    const fast = createState(LEVELS[0]);
    pull(fast, LEVELS[0].solution[0]);
    step(fast, 6 / 240);
    expect(slow).toEqual(fast.particles.map((p) => p.y));
    expect(slow.some((y, i) => y !== before[i])).toBe(true);
  });

  it('指の近くのピンを選ぶ', () => {
    const state = createState(LEVELS[0]);
    const [x1, y1, x2] = state.level.pins[0].seg;
    expect(pinAt(state, (x1 + x2) / 2, y1 + 0.01)).toBe(0);
    expect(pinAt(state, 0.5, 1.2)).toBe(-1);
  });
});
