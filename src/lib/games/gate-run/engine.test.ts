import { describe, expect, it } from 'vitest';
import { autoplay, createState, foes, step, steer, type GameState, type Item } from './engine';
import meta from './meta';

const run = (state: GameState, seconds: number) => {
  for (let t = 0; t < seconds && !state.result; t += 1 / 60) step(state, 1 / 60);
};

const enemy = (at: number, hp: number, x = 0.5): Item => ({ type: 'enemy', at, x, hp, done: false });
const gate = (at: number, n: number, right: boolean): Item => ({
  type: 'gate',
  at,
  x0: right ? 0.51 : 0.02,
  x1: right ? 0.98 : 0.49,
  n,
  heat: 0,
  done: false
});

describe('gate-run engine', () => {
  it('同じレベルは同じコースになる', () => {
    expect(createState(3).items).toEqual(createState(3).items);
  });

  it('門は撃たれた側だけ数が上がり、くぐるとその数だけ増える', () => {
    const state = createState(1);
    state.items = [gate(1.5, -10, false), gate(1.5, 5, true), enemy(50, 1)];
    state.count = 10;
    steer(state, 0.25);
    run(state, 2.5);
    const [left, right] = state.items as Extract<Item, { type: 'gate' }>[];
    expect(left.n).toBeGreaterThan(-10);
    expect(right.n).toBe(5);
    run(state, 1);
    expect(state.count).toBe(10 + left.n);
  });

  it('群れの幅が広いと、並んだ樽をいっしょに撃てる', () => {
    const state = createState(1);
    const barrel = (x: number): Item => ({
      type: 'barrel',
      at: 1,
      x,
      hp: 1000,
      max: 1000,
      reward: { kind: 'power' },
      done: false
    });
    state.items = [barrel(0.4), barrel(0.6), enemy(50, 1)];
    state.count = 100;
    step(state, 0.5);
    for (const item of state.items.slice(0, 2)) expect((item as { hp: number }).hp).toBeLessThan(1000);
  });

  it('樽を撃ち壊すとごほうびが出る', () => {
    const state = createState(1);
    state.items = [
      { type: 'barrel', at: 1, x: 0.5, hp: 1, max: 1, reward: { kind: 'power' }, done: false },
      { type: 'barrel', at: 1.2, x: 0.5, hp: 1, max: 1, reward: { kind: 'add', n: 10 }, done: false },
      enemy(50, 1)
    ];
    state.count = 5;
    run(state, 2);
    expect(state.power).toBeGreaterThan(1);
    expect(state.count).toBe(15);
  });

  it('敵は歩いてきて、撃ち切れなければぶつかって同じ数ずつ減る', () => {
    const state = createState(1);
    state.items = [enemy(0.5, 20), enemy(50, 1)];
    state.count = 30;
    run(state, 3);
    expect(state.items[0].done).toBe(true);
    expect(state.count).toBeLessThan(30);
    expect(state.count).toBeGreaterThan(10);
  });

  it('敵がいなくなればクリア、群れがいなくなればしっぱい', () => {
    const win = createState(1);
    win.items = [enemy(1, 3)];
    win.count = 10;
    run(win, 10);
    expect(win.result).toBe('clear');
    expect(foes(win)).toBe(0);
    const lose = createState(1);
    lose.items = [enemy(0.3, 200)];
    run(lose, 10);
    expect(lose.result).toBe('fail');
  });

  it('門を多いほうへ選び、樽を撃ちに寄れば、どの面もクリアできる', () => {
    for (let level = 1; level <= meta.levels; level++)
      expect(autoplay(createState(level)), `level ${level}`).toBe('clear');
  });

  it('最初の 2 面は、まっすぐ走るだけでもクリアできる', () => {
    for (const level of [1, 2]) {
      const state = createState(level);
      run(state, 240);
      expect(state.result, `level ${level}`).toBe('clear');
    }
  });

  it('同じコースの面はない', () => {
    const courses = new Set(Array.from({ length: meta.levels }, (_, i) => JSON.stringify(createState(i + 1).items)));
    expect(courses.size).toBe(meta.levels);
  });

  it('レベルが上がるほど、コースは長くなり、敵は多くなる', () => {
    for (let level = 2; level <= meta.levels; level++)
      expect(createState(level).length, `level ${level}`).toBeGreaterThanOrEqual(createState(level - 1).length - 0.5);
    expect(foes(createState(meta.levels))).toBeGreaterThan(foes(createState(1)) * 3);
    expect(createState(1).items.some((item) => item.type === 'barrel')).toBe(false);
  });
});
