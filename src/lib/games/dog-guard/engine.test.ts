import { describe, expect, it } from 'vitest';
import { MAX_LEVEL } from '$lib/levels';
import { addPoint, createState, finishStroke, step, type GameState } from './engine';
import { levelFor } from './levels';

function run(state: GameState, seed = 1) {
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 30 && state.phase === 'defend'; t += 1 / 60) step(state, 1 / 60, rand);
  return state.result;
}

const levels = Array.from({ length: MAX_LEVEL }, (_, i) => [i + 1] as const);

describe('dog-guard engine', () => {
  it.each(levels)('%i 面は、用意した線でクリアでき、線がなければ刺される', (n) => {
    const stage = levelFor(n);
    for (const seed of [1, 7, 42]) {
      const state = createState(stage);
      for (const p of stage.solution) addPoint(state, p.x, p.y);
      expect(finishStroke(state)).toBe(true);
      expect(run(state, seed), `seed ${seed}`).toBe('clear');
    }
    const bare = createState(stage);
    addPoint(bare, 0.02, 0.05);
    addPoint(bare, 0.06, 0.05);
    finishStroke(bare);
    expect(run(bare)).toBe('stung');
  });

  it('100 面に同じ面はない', () => {
    const stages = new Set(levels.map(([n]) => JSON.stringify(levelFor(n))));
    expect(stages.size).toBe(MAX_LEVEL);
  });

  it('レベルが上がるほど、ハチは多く速く、守る時間は長く、インクのゆとりは少ない', () => {
    for (let n = 2; n <= MAX_LEVEL; n++) {
      const [a, b] = [levelFor(n - 1), levelFor(n)];
      expect(b.bees, `level ${n}`).toBeGreaterThanOrEqual(a.bees);
      expect(b.speed).toBeGreaterThan(a.speed);
      expect(b.duration).toBeGreaterThanOrEqual(a.duration);
      expect(b.fast).toBeGreaterThanOrEqual(a.fast);
      expect(b.big).toBeGreaterThanOrEqual(a.big);
      expect(b.hives.length).toBeGreaterThanOrEqual(a.hives.length);
    }
  });

  it('洞窟の面は、インクが足りずドームで覆えない', () => {
    const state = createState(levelFor(6));
    expect(levelFor(6).kind).toBe('cave');
    const { x, y } = state.level.dogs[0];
    for (let a = 0; a <= Math.PI; a += 0.05) addPoint(state, x - Math.cos(a) * 0.18, y + 0.07 - Math.sin(a) * 0.18);
    expect(state.ink).toBe(0);
  });

  it('雲の中や、雲をまたぐ線は引けない', () => {
    const state = createState(levelFor(24));
    const zone = state.level.noDraw[0];
    const mid = (zone.x0 + zone.x1) / 2;
    expect(addPoint(state, mid, (zone.y0 + zone.y1) / 2)).toBe(false);
    addPoint(state, mid, zone.y0 - 0.05);
    expect(addPoint(state, mid, zone.y1 + 0.05)).toBe(false);
  });
});
