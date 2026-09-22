import { describe, expect, it } from 'vitest';
import { createState, FIRE, MONEY, step, type GameState } from './engine';

const still = { x: 0, y: 0 };

function wait(state: GameState, seconds: number) {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) events.push(...step(state, 1 / 60, still, () => 0.5));
  return events;
}

describe('snow-camp engine', () => {
  it('近くの動物は自動で攻撃して倒し、肉を落とす', () => {
    const state = createState(1, () => 0.5);
    state.animals = [{ kind: 'bear', x: 0.8, y: 1.3, hp: 2, tx: 0.8, ty: 1.3, flash: 0 }];
    state.hero = { x: 0.8, y: 1.35 };
    const events = wait(state, 1.5);
    expect(events).toContainEqual({ type: 'kill', kind: 'bear' });
    expect(state.carry + state.drops.length).toBe(3);
  });

  it('持てる数までしか肉を拾わない', () => {
    const state = createState(1, () => 0.5);
    state.animals = [];
    state.hero = { x: 0.5, y: 0.5 };
    state.drops = Array.from({ length: 8 }, () => ({ x: 0.5, y: 0.5 }));
    wait(state, 0.1);
    expect(state.carry).toBe(5);
    expect(state.drops.length).toBe(3);
  });

  it('肉をたき火に渡すと焼けて、食べた人がお金を置き、拾うと持ち金になる', () => {
    const state = createState(1, () => 0.5);
    state.animals = [];
    state.carry = 2;
    state.hero = { ...FIRE };
    wait(state, 6);
    expect(state.carry).toBe(0);
    expect(state.coins).toBe(8);
    state.hero = { ...MONEY };
    wait(state, 0.1);
    expect(state.wallet).toBe(8);
  });

  it('パッドにお金を入れきると強くなり、家を建てるとクリア', () => {
    const state = createState(1, () => 0.5);
    state.animals = [];
    const bag = state.pads.find((p) => p.id === 'bag')!;
    state.wallet = 100;
    state.hero = { x: bag.x, y: bag.y };
    wait(state, 2);
    expect(state.cap).toBeGreaterThan(5);

    const home = state.pads.find((p) => p.id === 'home')!;
    state.wallet = home.cost;
    state.hero = { x: home.x, y: home.y };
    const events = wait(state, 3);
    expect(events).toContainEqual({ type: 'clear' });
    expect(state.result).toBe('clear');
  });
});
