import { describe, expect, it } from 'vitest';
import { sideOf } from '$lib/player';
import { bugAt, BUG_R, counts, createState, DURATION_S, step, tap, type Bug, type GameState } from './engine';

const place = (state: GameState, kind: Bug['kind'], x: number, y: number): Bug => {
  const bug: Bug = {
    id: state.bugs.length + 1000,
    kind,
    x,
    y,
    heading: 0,
    hp: kind === 'beetle' ? 3 : 1,
    flight: null
  };
  state.bugs.push(bug);
  return bug;
};

const run = (state: GameState, seconds: number, dt = 1 / 60) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...step(state, dt, () => 0.5));
  return events;
};

describe('bug-rush engine', () => {
  it('叩いた虫は相手の陣地へ飛んでいき、着いたら相手の数になる', () => {
    const state = createState(1);
    state.spawnIn = 1000;
    const bug = place(state, 'bug', 0.5, 0.8);
    expect(tap(state, bug.id)).toEqual({ type: 'send', to: 2 });
    expect(counts(state)).toEqual({ 1: 0, 2: 1 });
    const events = run(state, 0.6);
    expect(events).toContainEqual({ type: 'land', side: 2 });
    expect(sideOf(bug.y)).toBe(2);
  });

  it('飛んでいる虫は叩けない', () => {
    const state = createState(1);
    const bug = place(state, 'bug', 0.5, 0.8);
    tap(state, bug.id);
    expect(tap(state, bug.id)).toBeNull();
  });

  it('カブトムシは 3 回叩いて飛び、残れば 3 匹ぶんに数える', () => {
    const state = createState(1);
    state.spawnIn = 1000;
    const beetle = place(state, 'beetle', 0.5, 0.2);
    expect(counts(state)).toEqual({ 1: 0, 2: 3 });
    expect(tap(state, beetle.id)).toEqual({ type: 'hit' });
    expect(tap(state, beetle.id)).toEqual({ type: 'hit' });
    expect(tap(state, beetle.id)).toEqual({ type: 'send', to: 1 });
    expect(counts(state)).toEqual({ 1: 3, 2: 0 });
  });

  it('歩いている虫は、境界線を越えて相手の陣地へは入らない', () => {
    const state = createState(1);
    state.spawnIn = 1000;
    const bug = place(state, 'bug', 0.5, 0.6);
    bug.heading = -Math.PI / 2; // 境界線へまっすぐ向かう
    run(state, 5);
    expect(sideOf(bug.y)).toBe(1);
  });

  it('時間切れで、自分の陣地の虫が少ないほうが勝つ', () => {
    const state = createState(1);
    state.spawnIn = 1000;
    place(state, 'bug', 0.3, 0.8);
    place(state, 'bug', 0.3, 0.2);
    place(state, 'bug', 0.6, 0.2);
    const events = run(state, DURATION_S + 0.1);
    expect(events).toContainEqual({ type: 'end', winner: 1 });
  });

  it('同じ数なら延長し、差がついたところで決まる', () => {
    const state = createState(1);
    state.spawnIn = 1000;
    const a = place(state, 'bug', 0.3, 0.8);
    place(state, 'bug', 0.3, 0.2);
    expect(run(state, DURATION_S + 0.5)).toEqual([]);
    expect(state.winner).toBeNull();
    tap(state, a.id);
    const events = run(state, 0.1);
    expect(events).toContainEqual({ type: 'end', winner: 1 });
  });

  it('真ん中の巣から、時間とともに虫が湧く', () => {
    const state = createState(1);
    run(state, 3);
    expect(state.bugs.length).toBeGreaterThan(4);
  });

  it('指の位置からいちばん近い、叩ける虫を探す（飛んでいる虫は除く）', () => {
    const state = createState(1);
    const near = place(state, 'bug', 0.5, 0.8);
    place(state, 'bug', 0.56, 0.8);
    expect(bugAt(state, 0.51, 0.8)?.id).toBe(near.id);
    expect(bugAt(state, 0.2, 0.3)).toBeNull();
    tap(state, near.id);
    expect(bugAt(state, 0.5, 0.8)?.id).not.toBe(near.id);
  });

  it('時間切れで、プレイヤー 2 側の虫が少なければプレイヤー 2 が勝つ', () => {
    const state = createState(1);
    state.spawnIn = 1000;
    place(state, 'bug', 0.3, 0.8);
    place(state, 'bug', 0.6, 0.8);
    place(state, 'bug', 0.3, 0.2);
    const events = run(state, DURATION_S + 0.1);
    expect(events).toContainEqual({ type: 'end', winner: 2 });
  });

  it.each([0.6, 1, 1.7])('aspect %f でも bugAt の当たりは高さを 1 とした単位の円', (aspect) => {
    const state = createState(aspect);
    place(state, 'bug', 0.5, 0.8);
    expect(bugAt(state, 0.5 + (BUG_R * 1.3) / aspect, 0.8)).not.toBeNull();
    expect(bugAt(state, 0.5 + (BUG_R * 1.6) / aspect, 0.8)).toBeNull();
  });

  it('虫は無限に湧かず、上限で止まる', () => {
    const state = createState(1);
    run(state, 60);
    expect(state.bugs.length).toBeLessThanOrEqual(36);
  });

  it('歩いている虫は、左右の外周の内側に留まる', () => {
    const state = createState(1);
    state.spawnIn = 1000;
    const bug = place(state, 'bug', 0.06, 0.8);
    bug.heading = Math.PI;
    run(state, 3);
    expect(bug.x).toBeGreaterThanOrEqual(0.06 - 1e-9);
  });
});
