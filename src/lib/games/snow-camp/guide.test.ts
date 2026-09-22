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

  it('置かれたお金はキャンプにいるあいだに拾い、狩りの途中では呼び戻さない', () => {
    const state = fresh();
    state.coins = 4;
    state.hero.y = 1.0;
    expect(objective(state).kind).toBe('hunt');
    state.hero.y = 2.0;
    expect(objective(state)).toMatchObject({ kind: 'money', ...MONEY });
  });

  it('たき火が埋まっているあいだは、肉を持ったまま狩りを続ける', () => {
    const state = fresh();
    state.carry = 2;
    state.cooking = 2;
    expect(objective(state).kind).toBe('hunt');
  });

  it('家までの残りが大きければ払えるパッドへ、小さければ家へ。家が建つだけあれば家へ', () => {
    const state = fresh();
    state.animals = [];
    state.wallet = 10;
    const home = state.pads.find((p) => p.id === 'home')!;
    home.cost = 300;
    expect(objective(state)).toMatchObject({ kind: 'pad', x: state.pads[0].x });
    home.cost = 50;
    expect(objective(state)).toMatchObject({ kind: 'home', text: '家に おかねを いれよう' });
    state.wallet = 50;
    expect(objective(state)).toMatchObject({ kind: 'home', text: '家を 建てよう！' });
  });
});
