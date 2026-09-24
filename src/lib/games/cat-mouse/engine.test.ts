import { describe, expect, it } from 'vitest';
import {
  CAT_R,
  createState,
  type GameState,
  GUARD_R,
  GUARD_S,
  HOLES,
  POTS,
  ROUND_S,
  step,
  STICK_R,
  updateSticks
} from './engine';

/** 始まりの間を飛ばして走れる状態にする */
function playing(cat: 1 | 2 = 1): GameState {
  const state = createState(1, cat, () => 0.5);
  while (state.phase !== 'play') step(state, 0.1);
  return state;
}

const run = (state: GameState, seconds: number) => {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) events.push(...step(state, 1 / 60));
  return events;
};

describe('cat-mouse', () => {
  it('はじめの間はスティックを倒しても動かない', () => {
    const state = createState(1, 1);
    updateSticks(state, [{ id: 1, side: 1, x: 0.5, y: 0.8 }]);
    updateSticks(state, [{ id: 1, side: 1, x: 0.5, y: 0.7 }]);
    step(state, 0.5);
    expect(state.runners[1].y).toBe(0.8);
  });

  it('指をずらした向きへ走り、向きもそちらを向く', () => {
    const state = playing();
    updateSticks(state, [{ id: 7, side: 1, x: 0.5, y: 0.9 }]);
    updateSticks(state, [{ id: 7, side: 1, x: 0.5 + STICK_R, y: 0.9 }]);
    run(state, 0.5);
    expect(state.runners[1].x).toBeGreaterThan(0.6);
    expect(state.runners[1].face).toBeCloseTo(90);
  });

  it('大きく動かした指を戻すと、すぐ逆へ走る（中心が指についてくる）', () => {
    const state = playing();
    updateSticks(state, [{ id: 7, side: 1, x: 0.3, y: 0.9 }]);
    updateSticks(state, [{ id: 7, side: 1, x: 0.8, y: 0.9 }]);
    updateSticks(state, [{ id: 7, side: 1, x: 0.8 - STICK_R * 1.5, y: 0.9 }]);
    const stick = state.sticks[1]!;
    expect(stick.x).toBeLessThan(stick.ox);
  });

  it('各プレイヤーの先に置いた指だけがスティックになる', () => {
    const state = playing();
    updateSticks(state, [
      { id: 1, side: 1, x: 0.2, y: 0.9 },
      { id: 2, side: 1, x: 0.8, y: 0.9 },
      { id: 3, side: 2, x: 0.5, y: 0.1 }
    ]);
    expect(state.sticks[1]?.id).toBe(1);
    expect(state.sticks[2]?.id).toBe(3);
  });

  it('ネコがネズミに触れると捕まえて、次の回で役が入れ替わる', () => {
    const state = playing(1);
    state.runners[1].y = state.runners[2].y + CAT_R;
    const events = step(state, 1 / 60);
    expect(events).toContainEqual({ type: 'caught' });
    run(state, 2);
    expect(state.cat).toBe(2);
    expect(state.round).toBe(2);
    expect(state.phase).toBe('ready');
  });

  it('ネズミがチーズを食べると点が入り、次のチーズが出る', () => {
    const state = playing(1);
    state.cheese = { x: state.runners[2].x, y: state.runners[2].y };
    const events = step(state, 1 / 60);
    expect(events).toContainEqual({ type: 'cheese', player: 2 });
    expect(state.scores[2]).toBe(1);
    expect(state.cheese).not.toEqual({ x: state.runners[2].x, y: state.runners[2].y });
  });

  it('時間まで逃げきると、その回が終わる', () => {
    const state = playing();
    expect(run(state, ROUND_S + 0.1)).toContainEqual({ type: 'escape' });
  });

  it('後攻のネズミが相手の合計を超えたら、その場で勝つ', () => {
    const state = playing(1);
    state.round = 2;
    state.scores = { 1: 1, 2: 1 };
    state.cat = 2;
    state.cheese = { x: state.runners[1].x, y: state.runners[1].y };
    expect(step(state, 1 / 60)).toContainEqual({ type: 'win', player: 1 });
    // 同点の時点では決まらない
    const tied = playing(1);
    tied.round = 2;
    tied.cat = 2;
    tied.scores = { 1: 1, 2: 2 };
    tied.cheese = { x: tied.runners[1].x, y: tied.runners[1].y };
    expect(step(tied, 1 / 60).some((e) => e.type === 'win')).toBe(false);
  });

  it('2 回を終えて同点なら延長し、差がつけば多いほうが勝つ', () => {
    const state = playing(1);
    state.round = 2;
    state.scores = { 1: 1, 2: 1 };
    state.runners[1].y = state.runners[2].y + CAT_R;
    run(state, 2);
    expect(state.winner).toBeNull();
    expect(state.round).toBe(3);

    const decided = playing(1);
    decided.round = 2;
    decided.scores = { 1: 1, 2: 3 };
    decided.runners[1].y = decided.runners[2].y + CAT_R;
    expect(run(decided, 2)).toContainEqual({ type: 'win', player: 2 });
  });

  /** プレイヤー p を、今いる位置から (dx, dy) の向きへ全速で走らせ続ける */
  const drive = (state: GameState, p: 1 | 2, dx: number, dy: number) => {
    const r = state.runners[p];
    updateSticks(state, [{ id: p, side: p, x: r.x, y: r.y, ox: r.x, oy: r.y }]);
    updateSticks(state, [{ id: p, side: p, x: r.x + dx * STICK_R, y: r.y + dy * STICK_R, ox: r.x, oy: r.y }]);
  };

  it('植木鉢は通り抜けられない', () => {
    const state = playing();
    const pot = POTS[0];
    Object.assign(state.runners[2], { x: pot.x, y: pot.y - 0.25 });
    Object.assign(state.runners[1], { x: 0.9, y: 0.95 });
    drive(state, 2, 0, 1);
    run(state, 1.5);
    const r = state.runners[2];
    expect(Math.hypot(r.x - pot.x, r.y - pot.y)).toBeGreaterThanOrEqual(pot.r);
  });

  it('ネズミは壁の穴から反対の穴へ抜けるが、ネコは抜けない', () => {
    const state = playing(1);
    const [a, b] = HOLES;
    Object.assign(state.runners[2], { x: 0.15, y: a.y });
    Object.assign(state.runners[1], { x: 0.5, y: 0.95 });
    drive(state, 2, -1, 0);
    run(state, 0.5);
    expect(state.runners[2].x).toBeGreaterThan(0.8);
    expect(Math.abs(state.runners[2].y - b.y)).toBeLessThan(0.05);

    const cat = playing(1);
    Object.assign(cat.runners[1], { x: 0.15, y: a.y });
    Object.assign(cat.runners[2], { x: 0.9, y: 0.95 });
    drive(cat, 1, -1, 0);
    run(cat, 1);
    expect(cat.runners[1].x).toBeLessThan(0.2);
  });

  it('ネコがチーズのそばに居座ると、チーズはネコから離れた場所へ逃げる', () => {
    let seed = 1;
    const state = createState(1, 1, () => (seed = (seed * 16807) % 2147483647) / 2147483647);
    while (state.phase !== 'play') step(state, 0.1);
    Object.assign(state.runners[1], { x: state.cheese.x, y: state.cheese.y });
    const before = { ...state.cheese };
    const events = run(state, GUARD_S + 0.2);
    expect(events).toContainEqual({ type: 'hop' });
    expect(state.cheese).not.toEqual(before);
    const cat = state.runners[1];
    expect(Math.hypot(state.cheese.x - cat.x, state.cheese.y - cat.y)).toBeGreaterThan(GUARD_R);
  });
});
