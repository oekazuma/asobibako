import { describe, expect, it } from 'vitest';
import { BAND, COLORS, createState, drop, EDGE_X, GOAL, grab, moveChip, step, type GameState } from './engine';

const seq = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

function stateWith(target: (typeof COLORS)[number]): GameState {
  const state = createState(1, 0, seq(0.3, 0.7, 0.1, 0.9, 0.5));
  state.target = target;
  return state;
}

const chipOf = (state: GameState, color: (typeof COLORS)[number]) => {
  const chip = state.chips.find((c) => c.color === color && !c.chameleon);
  if (chip) return chip;
  state.chips[0].color = color;
  state.chips[0].chameleon = false;
  return state.chips[0];
};

describe('color-grab engine', () => {
  it('玉は中央の帯に出て、お題の色がいつも 2 個以上ある', () => {
    for (let r = 0; r < 20; r++) {
      const state = createState(0.75, 0);
      expect(state.chips).toHaveLength(6);
      for (const chip of state.chips) {
        expect(chip.y).toBeGreaterThan(BAND[0]);
        expect(chip.y).toBeLessThan(BAND[1]);
        expect(chip.x).toBeGreaterThan(EDGE_X);
        expect(chip.x).toBeLessThan(1 - EDGE_X);
      }
      expect(state.chips.filter((c) => c.color === state.target && !c.chameleon).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('お題と同じ色を自分の陣地に置くと +1、帯の中で離せば何も起きない', () => {
    const state = stateWith('red');
    const chip = chipOf(state, 'red');
    grab(state, chip.id, 1);
    moveChip(state, chip.id, 0.5, 0.5);
    expect(drop(state, chip.id)).toBeNull();

    grab(state, chip.id, 1);
    moveChip(state, chip.id, 0.5, 0.9);
    expect(drop(state, chip.id)).toMatchObject({ type: 'claim', player: 1, good: true });
    expect(state.scores[1]).toBe(1);
  });

  it('違う色を相手の陣地に押し込むと相手の点が減る（0 未満にはならない）', () => {
    const state = stateWith('red');
    state.scores[2] = 1;
    for (let i = 0; i < 2; i++) {
      const chip = chipOf(state, 'blue');
      grab(state, chip.id, 1);
      moveChip(state, chip.id, 0.5, 0.1);
      expect(drop(state, chip.id)).toMatchObject({ type: 'claim', player: 2, good: false });
    }
    expect(state.scores[2]).toBe(0);
  });

  it('つかまれている玉は、ほかの指ではつかめない', () => {
    const state = stateWith('red');
    const chip = state.chips[0];
    expect(grab(state, chip.id, 1)).toBe(true);
    expect(grab(state, chip.id, 2)).toBe(false);
  });

  it('お題は時間で必ず別の色に変わり、変わった直後も取れる玉が 2 個以上ある', () => {
    for (let r = 0; r < 20; r++) {
      const state = createState(1, 0);
      const before = state.target;
      const event = step(state, 60_000);
      expect(event).toMatchObject({ type: 'target' });
      expect(state.target).not.toBe(before);
      expect(state.chips.filter((c) => c.color === state.target && !c.chameleon).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('カメレオン玉は、つかまれていても色が変わり続ける', () => {
    const state = stateWith('red');
    const chip = state.chips[0];
    chip.chameleon = true;
    chip.color = 'red';
    chip.recolorAt = 100;
    grab(state, chip.id, 1);
    step(state, 100);
    expect(chip.color).toBe('blue');
  });

  it(`${GOAL} 点で勝ち、それ以降は点が動かない`, () => {
    const state = stateWith('red');
    state.scores[1] = GOAL - 1;
    const chip = chipOf(state, 'red');
    grab(state, chip.id, 1);
    moveChip(state, chip.id, 0.5, 0.9);
    expect(drop(state, chip.id)).toEqual({ type: 'win', player: 1 });

    const next = chipOf(state, 'red');
    grab(state, next.id, 1);
    moveChip(state, next.id, 0.5, 0.1);
    expect(drop(state, next.id)).toBeNull();
    expect(state.scores[2]).toBe(0);
  });

  it('取った玉のぶん、帯の玉は補充される', () => {
    const state = stateWith('red');
    const chip = chipOf(state, 'red');
    grab(state, chip.id, 1);
    moveChip(state, chip.id, 0.5, 0.9);
    drop(state, chip.id);
    expect(state.chips).toHaveLength(5);
    step(state, 1);
    expect(state.chips).toHaveLength(6);
  });
});
