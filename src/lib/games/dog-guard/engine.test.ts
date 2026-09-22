import { describe, expect, it } from 'vitest';
import { addPoint, createState, finishStroke, step, type GameState } from './engine';
import { levelFor, LEVELS } from './levels';

function run(state: GameState, seed = 1) {
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 30 && state.phase === 'defend'; t += 1 / 60) step(state, 1 / 60, rand);
  return state.result;
}

/** 用意した面と、3 周目までの難しくなった面 */
const levels = Array.from({ length: LEVELS.length * 3 }, (_, i) => [i + 1] as const);

describe('dog-guard engine', () => {
  it.each(levels)('%i 面は、用意した線でクリアできる', (n) => {
    for (const seed of [1, 7, 42]) {
      const state = createState(levelFor(n));
      for (const p of levelFor(n).solution) addPoint(state, p.x, p.y);
      expect(finishStroke(state)).toBe(true);
      expect(run(state, seed), `seed ${seed}`).toBe('clear');
    }
  });

  it.each(levels)('%i 面は、線がなければ刺される', (n) => {
    const state = createState(levelFor(n));
    addPoint(state, 0.02, 0.05);
    addPoint(state, 0.06, 0.05);
    finishStroke(state);
    expect(run(state)).toBe('stung');
  });

  it('洞窟の面は、インクが足りずドームで覆えない', () => {
    const state = createState(levelFor(3));
    const { x, y } = state.level.dogs[0];
    for (let a = 0; a <= Math.PI; a += 0.05) addPoint(state, x - Math.cos(a) * 0.18, y + 0.07 - Math.sin(a) * 0.18);
    expect(state.ink).toBe(0);
    expect(state.stroke.at(-1)!.x).toBeLessThan(x + 0.15);
  });

  it('雲の中や、雲をまたぐ線は引けない', () => {
    const state = createState(levelFor(6));
    expect(addPoint(state, 0.4, 0.7)).toBe(false);
    addPoint(state, 0.4, 0.4);
    expect(addPoint(state, 0.4, 0.98)).toBe(false);
  });

  it('一周するとハチが増え、速くなり、インクが減る', () => {
    const first = levelFor(1);
    const again = levelFor(LEVELS.length + 1);
    expect(again.bees).toBeGreaterThan(first.bees);
    expect(again.speed).toBeGreaterThan(first.speed);
    expect(again.ink).toBeLessThan(first.ink);
  });
});
