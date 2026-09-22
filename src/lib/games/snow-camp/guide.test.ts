import { describe, expect, it } from 'vitest';
import { createState, FIRE, MONEY } from './engine';
import { objective } from './guide';

const fresh = () => createState(1, () => 0.5);

describe('snow-camp guide', () => {
  it('はじめは近くの動物をたおしに行く', () => {
    const state = fresh();
    expect(objective(state).kind).toBe('hunt');
  });

  it('落ちた肉があれば拾いに行き、持っていればたき火へ', () => {
    const state = fresh();
    state.drops = [{ x: 0.4, y: 0.4 }];
    expect(objective(state)).toMatchObject({ kind: 'pick', x: 0.4, y: 0.4 });
    state.drops = [];
    state.carry = 2;
    expect(objective(state)).toMatchObject({ kind: 'fire', ...FIRE });
  });

  it('置かれたお金は、ほかの何よりも先に拾いに行く', () => {
    const state = fresh();
    state.carry = 3;
    state.coins = 4;
    expect(objective(state)).toMatchObject({ kind: 'money', ...MONEY });
  });

  it('お金を持っていれば、払えるパッドへ。家が建つだけあれば家へ', () => {
    const state = fresh();
    state.animals = [];
    state.wallet = 10;
    expect(objective(state)).toMatchObject({ kind: 'pad', x: state.pads[0].x });
    state.wallet = 50;
    expect(objective(state).kind).toBe('home');
  });
});
