import { describe, expect, it } from 'vitest';
import { addPoint, createState, DEFEND_S, finishStroke, step, type GameState } from './engine';
import { levelFor } from './levels';

function run(state: GameState) {
  let seed = 1;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < DEFEND_S + 1 && state.phase === 'defend'; t += 1 / 60) step(state, 1 / 60, rand);
  return state.result;
}

/** 犬を半円のドームで覆う線 */
function dome(state: GameState, r: number) {
  const { x, y } = state.level.dog;
  for (let a = 0; a <= Math.PI; a += 0.05) addPoint(state, x - Math.cos(a) * r, y + 0.07 - Math.sin(a) * r);
}

describe('dog-guard engine', () => {
  it('何も守らなければ、ハチに刺される', () => {
    const state = createState(levelFor(1));
    addPoint(state, 0.05, 0.5);
    addPoint(state, 0.1, 0.5);
    finishStroke(state);
    expect(run(state)).toBe('stung');
  });

  it('犬をドームで覆えば、時間いっぱい守りきれる', () => {
    for (const n of [1, 2, 4, 5]) {
      const state = createState(levelFor(n));
      dome(state, 0.18);
      finishStroke(state);
      expect(run(state), `level ${n}`).toBe('clear');
    }
  });

  it('犬に近すぎるところには線を引けない', () => {
    const state = createState(levelFor(1));
    const { x, y } = state.level.dog;
    expect(addPoint(state, x, y)).toBe(false);
  });

  it('インクが切れたら線は伸びない', () => {
    const state = createState(levelFor(1));
    addPoint(state, 0.05, 0.1);
    addPoint(state, 0.95, 0.1);
    addPoint(state, 0.95, 0.6);
    expect(state.ink).toBeGreaterThan(0);
    addPoint(state, 0.05, 0.6);
    expect(state.ink).toBe(0);
    expect(addPoint(state, 0.05, 0.5)).toBe(false);
  });

  it('点が 1 つだけの線では始まらない', () => {
    const state = createState(levelFor(1));
    addPoint(state, 0.3, 0.3);
    expect(finishStroke(state)).toBe(false);
    expect(state.phase).toBe('draw');
  });
});
