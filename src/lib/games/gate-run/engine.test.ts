import { describe, expect, it } from 'vitest';
import { aimAt, apply, autoplay, createState, step, steer, type GameState, type Item } from './engine';
import meta from './meta';

const run = (state: GameState, seconds: number) => {
  for (let t = 0; t < seconds && !state.result; t += 1 / 60) step(state, 1 / 60);
};

const enemy = (at: number, hp: number, x = 0.5): Item => ({ type: 'enemy', at, x, hp, boss: false, done: false });
const boss = (at: number, hp: number): Item => ({ type: 'enemy', at, x: 0.5, hp, boss: true, done: false });

describe('gate-run engine', () => {
  it('門の計算', () => {
    expect(apply({ kind: 'add', n: 5 }, 10)).toBe(15);
    expect(apply({ kind: 'mul', n: 3 }, 10)).toBe(30);
    expect(apply({ kind: 'add', n: -20 }, 10)).toBe(0);
  });

  it('同じレベルは同じコースになる', () => {
    expect(createState(3).items).toEqual(createState(3).items);
  });

  it('門は撃っている側の数だけ上がり、×の門は撃てない', () => {
    const state = createState(1);
    state.items = [
      { type: 'gates', at: 1, left: { kind: 'add', n: -10 }, right: { kind: 'mul', n: 2 }, heat: [0, 0], done: false }
    ];
    steer(state, 0.2);
    step(state, 1);
    const gates = state.items[0] as Extract<Item, { type: 'gates' }>;
    expect(gates.left.n).toBeGreaterThan(-10);
    steer(state, 0.8);
    expect(aimAt(state)).toBeNull();
  });

  it('敵は歩いてきて、撃ち切れなければぶつかって同じ数ずつ減る', () => {
    const state = createState(1);
    state.items = [enemy(0.5, 20), boss(50, 1)];
    state.count = 30;
    run(state, 3);
    expect(state.items[0].done).toBe(true);
    expect(state.count).toBeLessThan(30);
    expect(state.count).toBeGreaterThan(10);
  });

  it('樽を撃ち壊すとごほうびが出る', () => {
    const state = createState(1);
    state.items = [
      { type: 'barrel', at: 1, x: 0.5, hp: 2, max: 2, reward: { kind: 'power' }, done: false },
      { type: 'barrel', at: 1.2, x: 0.5, hp: 2, max: 2, reward: { kind: 'add', n: 10 }, done: false },
      boss(50, 1)
    ];
    run(state, 2);
    expect(state.power).toBeGreaterThan(1);
    expect(state.count).toBe(20);
  });

  it('ボスを倒せばクリア、群れがいなくなればしっぱい', () => {
    const win = createState(1);
    win.items = [boss(1, 5)];
    run(win, 10);
    expect(win.result).toBe('clear');
    const lose = createState(1);
    lose.items = [enemy(0.3, 200), boss(50, 1)];
    run(lose, 10);
    expect(lose.result).toBe('fail');
  });

  it('門を多くなるほうへ選び、樽を撃ちに寄れば、どの面もクリアできる', () => {
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

  it('レベルが上がるほど、コースは長くなり、樽が混ざる', () => {
    for (let level = 2; level <= meta.levels; level++)
      expect(createState(level).length, `level ${level}`).toBeGreaterThanOrEqual(createState(level - 1).length - 0.5);
    expect(createState(1).items.some((item) => item.type === 'barrel')).toBe(false);
    expect(createState(meta.levels).items.filter((item) => item.type === 'barrel').length).toBeGreaterThan(2);
  });
});
