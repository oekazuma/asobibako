import { describe, expect, it } from 'vitest';
import { sideOf } from '$lib/player';
import { BOMB_R, CATCH_R, createState, moveHeld, step, throwBomb, tryCatch, type GameState } from './engine';

const fixed = (v: number) => () => v;

/** 手前（プレイヤー 1）の陣地に止まっている爆弾がある状態 */
function withBombAt(x: number, y: number, fuse = 100): GameState {
  const state = createState(1, fixed(0.9));
  state.bomb = { x, y, vx: 0, vy: 0, age: 0, fuse, heldBy: null };
  return state;
}

const run = (state: GameState, seconds: number, dt = 1 / 60) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) {
    const ev = step(state, dt, fixed(0.5));
    if (ev) events.push(ev);
  }
  return events;
};

describe('bomb-relay engine', () => {
  it('自分の陣地にある爆弾だけを、指が触れていればつかめる', () => {
    const state = withBombAt(0.5, 0.75);
    expect(tryCatch(state, 2, 0.5, 0.75)).toBe(false); // 相手の陣地の爆弾
    expect(tryCatch(state, 1, 0.5, 0.4)).toBe(false); // 遠い
    expect(tryCatch(state, 1, 0.52, 0.77)).toBe(true);
    expect(state.bomb?.heldBy).toBe(1);
  });

  it('持ったまま相手の陣地へは運べない', () => {
    const state = withBombAt(0.5, 0.75);
    tryCatch(state, 1, 0.5, 0.75);
    moveHeld(state, 0.5, 0.1);
    expect(sideOf(state.bomb!.y)).toBe(1);
    expect(state.bomb!.y).toBeCloseTo(0.5 + BOMB_R);
  });

  it('メーターは持っているあいだだけたまり、古い爆弾ほど速くたまる', () => {
    const cold = withBombAt(0.5, 0.75);
    run(cold, 1);
    expect(cold.meters[1]).toBe(0);

    tryCatch(cold, 1, 0.5, 0.75);
    run(cold, 1);
    const hot = withBombAt(0.5, 0.75);
    hot.bomb!.age = 8;
    tryCatch(hot, 1, 0.5, 0.75);
    run(hot, 1);
    expect(cold.meters[1]).toBeGreaterThan(0);
    expect(hot.meters[1]).toBeGreaterThan(cold.meters[1] * 2);
  });

  it('爆発した側のメーターは半分になり、次の爆弾はその側へ落ちる', () => {
    const state = withBombAt(0.5, 0.25, 0.5);
    state.meters = { 1: 0.4, 2: 0.6 };
    const events = run(state, 0.6);
    expect(events).toContainEqual(expect.objectContaining({ type: 'boom', side: 2 }));
    expect(state.meters).toEqual({ 1: 0.4, 2: 0.3 });

    run(state, 2);
    expect(state.bomb).not.toBeNull();
    expect(sideOf(state.bomb!.y)).toBe(2);
  });

  it('メーターが満タンになったら 1 回だけ勝利を知らせ、それ以降は進まない', () => {
    const state = withBombAt(0.5, 0.75);
    state.meters[1] = 0.99;
    tryCatch(state, 1, 0.5, 0.75);
    const events = run(state, 1);
    expect(events).toEqual([{ type: 'win', player: 1 }]);
    expect(state.winner).toBe(1);
  });

  it('しっかりはじけば相手の陣地に届き、弱いと自分の陣地に残る', () => {
    const strong = withBombAt(0.5, 0.75);
    tryCatch(strong, 1, 0.5, 0.75);
    throwBomb(strong, 0, -2.5);
    run(strong, 2);
    expect(sideOf(strong.bomb!.y)).toBe(2);

    const weak = withBombAt(0.5, 0.75);
    tryCatch(weak, 1, 0.5, 0.75);
    throwBomb(weak, 0, -0.4);
    run(weak, 2);
    expect(sideOf(weak.bomb!.y)).toBe(1);
  });

  it('最強で投げても、奥の壁で跳ね返って投げた側まで戻りはしない', () => {
    const state = withBombAt(0.5, 0.6);
    tryCatch(state, 1, 0.5, 0.6);
    throwBomb(state, 0, -100);
    run(state, 3);
    expect(sideOf(state.bomb!.y)).toBe(2);
  });

  it('プレイヤー 2 も自陣でメーターを満タンにすれば勝てる', () => {
    const state = withBombAt(0.5, 0.25);
    state.meters[2] = 0.99;
    tryCatch(state, 2, 0.5, 0.25);
    const events = run(state, 1);
    expect(events).toEqual([{ type: 'win', player: 2 }]);
    expect(state.winner).toBe(2);
  });

  it.each([0.6, 1, 1.7])('aspect %f でもつかめる範囲は高さを 1 とした単位の円', (aspect) => {
    const near = createState(aspect, fixed(0.9));
    near.bomb = { x: 0.5, y: 0.75, vx: 0, vy: 0, age: 0, fuse: 100, heldBy: null };
    expect(tryCatch(near, 1, 0.5 + (CATCH_R * 0.9) / aspect, 0.75)).toBe(true);

    const far = createState(aspect, fixed(0.9));
    far.bomb = { x: 0.5, y: 0.75, vx: 0, vy: 0, age: 0, fuse: 100, heldBy: null };
    expect(tryCatch(far, 1, 0.5 + (CATCH_R * 1.1) / aspect, 0.75)).toBe(false);
  });
});
