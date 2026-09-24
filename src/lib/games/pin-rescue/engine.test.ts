import { describe, expect, it } from 'vitest';
import meta from './meta';
import { createState, HERO_R, pinAt, pull, step, type GameState, type Level } from './engine';
import { LEVELS } from './levels';

function run(state: GameState, seconds: number) {
  for (let t = 0; t < seconds && !state.result; t += 1 / 60) step(state, 1 / 60);
}

describe('pin-rescue engine', () => {
  it('ピンを抜かなければ、金はピンの上に留まる', () => {
    const state = createState(LEVELS[0]);
    run(state, 2);
    expect(state.result).toBeNull();
    expect(Math.max(...state.particles.map((p) => p.y))).toBeLessThan(0.55);
  });

  it.each(LEVELS.map((level, i) => [i + 1, level] as const))('%i 面は、用意した抜き順でクリアできる', (_, level) => {
    const state = createState(level);
    for (const i of level.solution) {
      pull(state, i);
      run(state, 2.5);
    }
    run(state, 6);
    expect(state.result).toBe('clear');
  });

  it.each(LEVELS.map((level, i) => [i + 1, level] as const).filter(([, level]) => level.trap))(
    '%i 面は、考えずに全部抜くと失敗する',
    (_, level) => {
      const state = createState(level);
      level.pins.forEach((_, i) => pull(state, i));
      run(state, 8);
      expect(state.result).toMatch(/^(burned|eaten|stuck)$/);
    }
  );

  it('同じ面はない', () => {
    expect(new Set(LEVELS.map((level) => JSON.stringify(level))).size).toBe(LEVELS.length);
  });

  it('面の数は一覧に出す数と同じ', () => {
    expect(LEVELS).toHaveLength(meta.levels);
  });

  it('レベルが上がるほど、要る金の割合も上がる', () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].need).toBeGreaterThan(LEVELS[i - 1].need);
  });

  it('水がマグマに触れると、マグマは残らず石になる', () => {
    const level = LEVELS.find((l) => l.pools.some((p) => p.kind === 'water'))!;
    const state = createState(level);
    pull(state, level.solution[0]);
    run(state, 3);
    expect(state.particles.some((p) => p.kind === 'lava')).toBe(false);
  });

  it('遅いフレームでもサブステップは上限までしか進まない', () => {
    const state = createState(LEVELS[0]);
    pull(state, LEVELS[0].solution[0]);
    const before = state.particles.map((p) => p.y);
    step(state, 0.05);
    const slow = state.particles.map((p) => p.y);
    const fast = createState(LEVELS[0]);
    pull(fast, LEVELS[0].solution[0]);
    step(fast, 6 / 240);
    expect(slow).toEqual(fast.particles.map((p) => p.y));
    expect(slow.some((y, i) => y !== before[i])).toBe(true);
  });

  it('指の近くのピンを選ぶ', () => {
    const state = createState(LEVELS[0]);
    const [x1, y1, x2] = state.level.pins[0].seg;
    expect(pinAt(state, (x1 + x2) / 2, y1 + 0.01)).toBe(0);
    expect(pinAt(state, 0.5, 1.2)).toBe(-1);
  });

  describe('怪物と姫', () => {
    const FLOOR = 1.4 - HERO_R;
    /** 仕切りの向こうの姫。抜かないかぎり、たどり着いてクリアにはならない */
    const HIME = { x: 0.9, y: 1.34 };
    /** 勇者は左の床。右の部屋との仕切りがピン 0 */
    const room = (extra: Partial<Level>): Level => ({
      walls: [],
      pins: [{ seg: [0.5, 0.9, 0.5, 1.42], handle: 0 }],
      pools: [],
      hero: { x: 0.15, y: FLOOR },
      need: 0.5,
      ...extra
    });

    it('仕切りを抜くと、怪物が歩いてきて勇者がやられる', () => {
      const state = createState(room({ monsters: [{ x: 0.85, y: FLOOR }] }));
      run(state, 2);
      expect(state.result).toBeNull();
      pull(state, 0);
      run(state, 8);
      expect(state.result).toBe('eaten');
    });

    it('マグマに触れた怪物はたおれ、生きている怪物がいるうちは金がそろってもクリアにならない', () => {
      const lava: Level['pools'][number] = { kind: 'lava', x0: 0.72, y0: 0.9, x1: 0.98, y1: 1.1 };
      const gold: Level['pools'][number] = { kind: 'gold', x0: 0.02, y0: 1.0, x1: 0.3, y1: 1.2 };
      const alive = createState(room({ monsters: [{ x: 0.85, y: FLOOR }], pools: [gold], need: 0.1 }));
      run(alive, 3);
      expect(alive.result).toBeNull();

      const burned = createState(room({ monsters: [{ x: 0.85, y: FLOOR }], pools: [gold, lava], need: 0.1 }));
      run(burned, 3);
      expect(burned.monsters[0].alive).toBe(false);
      expect(burned.result).toBe('clear');
    });

    it('仕切りを抜くと勇者が姫のもとへ歩き、たどり着けばクリア', () => {
      const state = createState(room({ princess: { x: 0.85, y: 1.4 - 0.06 } }));
      run(state, 2);
      expect(state.result).toBeNull();
      pull(state, 0);
      run(state, 8);
      expect(state.result).toBe('clear');
    });

    it('姫にマグマがかかると失敗', () => {
      const lava: Level['pools'][number] = { kind: 'lava', x0: 0.72, y0: 1.0, x1: 0.98, y1: 1.2 };
      const state = createState(room({ princess: { x: 0.85, y: 1.4 - 0.06 }, pools: [lava] }));
      run(state, 3);
      expect(state.result).toBe('burned');
    });

    it('毒ガスは昇り、上にいる怪物をたおす。勇者が触れると失敗', () => {
      const gas: Level['pools'][number] = { kind: 'gas', x0: 0.72, y0: 1.2, x1: 0.98, y1: 1.38 };
      const shelf: Level = room({ walls: [[0.6, 0.9, 1.0, 0.9]], monsters: [{ x: 0.85, y: 0.9 - 0.014 - 0.07 }] });
      const up = createState({ ...shelf, walls: [], pools: [gas], monsters: [{ x: 0.85, y: 0.8 }] });
      run(up, 3);
      expect(up.monsters[0].alive).toBe(false);
      const hero = createState(room({ pools: [{ ...gas, x0: 0.05, x1: 0.3 }], princess: HIME }));
      run(hero, 3);
      expect(hero.result).toBe('gassed');
    });

    it('上から落ちてきた岩は怪物をたおす', () => {
      const rock: Level['pools'][number] = { kind: 'rock', x0: 0.72, y0: 0.3, x1: 0.98, y1: 0.5 };
      const state = createState(room({ monsters: [{ x: 0.85, y: FLOOR }], pools: [rock] }));
      run(state, 3);
      expect(state.monsters[0].alive).toBe(false);
    });

    it('頭まで水に沈んだままだと息が切れる', () => {
      const water: Level['pools'][number] = { kind: 'water', x0: 0.02, y0: 1.0, x1: 0.48, y1: 1.4 };
      const state = createState(room({ pools: [water], princess: HIME }));
      run(state, 4);
      expect(state.result).toBe('drowned');
    });

    it('爆弾はマグマで爆発し、近くの壁と怪物をこわす。勇者が近いと巻きこまれる', () => {
      const lava: Level['pools'][number] = { kind: 'lava', x0: 0.64, y0: 0.5, x1: 0.76, y1: 0.6 };
      const level = room({
        walls: [[0.55, 1.0, 1.0, 1.0]],
        pools: [lava],
        princess: HIME,
        monsters: [{ x: 0.92, y: 1.0 - 0.014 - 0.07 }],
        bombs: [{ x: 0.7, y: 1.0 - 0.014 - 0.045 }]
      });
      const state = createState(level);
      run(state, 3);
      expect(state.blasts).toHaveLength(1);
      expect(state.brokenWalls[0]).toBe(true);
      expect(state.monsters[0].alive).toBe(false);

      const near = createState({ ...level, hero: { x: 0.62, y: FLOOR }, princess: { x: 0.1, y: 1.34 }, monsters: [] });
      run(near, 3);
      expect(near.result).toBe('burned');
    });
  });
});
