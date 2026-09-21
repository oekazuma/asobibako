import { describe, expect, it } from 'vitest';
import { clampMallet, createState, GOAL, MALLETS_PER_PLAYER, step, updateMallets, type GameState } from './engine';

const run = (state: GameState, seconds: number, dt = 1 / 60) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...step(state, dt));
  return events;
};

describe('hockey engine', () => {
  it('左右の壁では跳ね返る', () => {
    const state = createState(1);
    state.puck = { x: 0.1, y: 0.5, vx: -1, vy: 0 };
    run(state, 0.3);
    expect(state.puck.vx).toBeGreaterThan(0);
  });

  it('ゴールの口に入れば相手の得点、口の外の奥の壁では跳ね返る', () => {
    const state = createState(1);
    state.puck = { x: 0.5, y: 0.2, vx: 0, vy: -2 };
    const events = run(state, 0.5);
    expect(events).toContainEqual({ type: 'goal', scorer: 1 });
    expect(state.scores).toEqual({ 1: 1, 2: 0 });

    const wall = createState(1);
    wall.puck = { x: 0.1, y: 0.2, vx: 0, vy: -2 };
    run(wall, 0.3);
    expect(wall.scores).toEqual({ 1: 0, 2: 0 });
    expect(wall.puck.vy).toBeGreaterThan(0);
  });

  it('失点した側の陣地にパックを置き、少し待ってから再開する', () => {
    const state = createState(1);
    state.puck = { x: 0.5, y: 0.8, vx: 0, vy: 2 };
    run(state, 0.3);
    expect(state.scores[2]).toBe(1);
    expect(state.puck.y).toBeGreaterThan(0.5);
    expect(state.pause).toBeGreaterThan(0);
  });

  it('振ったマレットに当たると、パックは相手の方へ飛ぶ', () => {
    const state = createState(1);
    state.puck = { x: 0.5, y: 0.7, vx: 0, vy: 0 };
    updateMallets(state, [{ id: 1, side: 1, x: 0.5, y: 0.85 }], 1 / 60);
    updateMallets(state, [{ id: 1, side: 1, x: 0.5, y: 0.78 }], 1 / 60);
    const events = step(state, 1 / 60);
    expect(events.some((e) => e.type === 'hit')).toBe(true);
    expect(state.puck.vy).toBeLessThan(-1);
  });

  it('速いパックでも止まっているマレットをすり抜けない', () => {
    const state = createState(1);
    state.puck = { x: 0.5, y: 0.6, vx: 0, vy: 2.8 };
    updateMallets(state, [{ id: 1, side: 1, x: 0.5, y: 0.9 }], 1 / 60);
    updateMallets(state, [{ id: 1, side: 1, x: 0.5, y: 0.9 }], 1 / 60);
    run(state, 0.3, 1 / 30);
    expect(state.scores[2]).toBe(0);
    expect(state.puck.vy).toBeLessThan(0);
  });

  it('マレットは自分の陣地から出られない', () => {
    const state = createState(1);
    const [, y1] = clampMallet(state, 1, 0.5, 0.1);
    const [, y2] = clampMallet(state, 2, 0.5, 0.9);
    expect(y1).toBeGreaterThan(0.5);
    expect(y2).toBeLessThan(0.5);
  });

  it('マレットは 1 人 1 本。先に置いた指だけがマレットになる', () => {
    const state = createState(1);
    updateMallets(
      state,
      [
        { id: 1, side: 1, x: 0.2, y: 0.8 },
        { id: 2, side: 1, x: 0.5, y: 0.8 },
        { id: 3, side: 1, x: 0.8, y: 0.8 },
        { id: 4, side: 2, x: 0.5, y: 0.2 },
        { id: 5, side: 2, x: 0.8, y: 0.2 }
      ],
      1 / 60
    );
    expect(MALLETS_PER_PLAYER).toBe(1);
    expect(state.mallets.map((m) => m.id)).toEqual([1, 4]);
  });

  it('マレットの指を離すと、同じ陣地に残っている指が次のマレットになる', () => {
    const state = createState(1);
    updateMallets(
      state,
      [
        { id: 1, side: 1, x: 0.2, y: 0.8 },
        { id: 2, side: 1, x: 0.8, y: 0.8 }
      ],
      1 / 60
    );
    updateMallets(state, [{ id: 2, side: 1, x: 0.8, y: 0.8 }], 1 / 60);
    expect(state.mallets.map((m) => m.id)).toEqual([2]);
    // 新しくマレットになった指は、その場に置いたのと同じ扱いで、勢いは持たない
    expect(state.mallets[0].vx).toBe(0);
    expect(state.mallets[0].vy).toBe(0);
  });

  it(`${GOAL} 点で勝ち、それ以降は動かない`, () => {
    const state = createState(1);
    state.scores[1] = GOAL - 1;
    state.puck = { x: 0.5, y: 0.2, vx: 0, vy: -2 };
    const events = run(state, 0.5);
    expect(events).toContainEqual({ type: 'win', player: 1 });
    expect(state.winner).toBe(1);
    const at = { ...state.puck };
    run(state, 0.5);
    expect(state.puck).toEqual(at);
  });
});
