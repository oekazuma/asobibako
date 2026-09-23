import { describe, expect, it } from 'vitest';
import meta from './meta';
import { addPoint, createState, drawable, finishStroke, GROUND, LINE, step, type GameState } from './engine';
import { levelFor } from './levels';

function run(state: GameState, seed = 1) {
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let t = 0; t < 30 && state.phase === 'defend'; t += 1 / 60) step(state, 1 / 60, rand);
  return state.result;
}

const levels = Array.from({ length: meta.levels }, (_, i) => [i + 1] as const);

describe('dog-guard engine', () => {
  it.each(levels)(
    '%i 面は、用意した線でクリアでき、線がなければ刺される',
    (n) => {
      const stage = levelFor(n);
      for (const seed of [1, 7, 42]) {
        const state = createState(stage);
        for (const p of stage.solution) addPoint(state, p.x, p.y);
        expect(finishStroke(state)).toBe(true);
        expect(run(state, seed), `seed ${seed}`).toBe('clear');
      }
      for (const seed of [1, 7, 42]) {
        const bare = createState(stage);
        addPoint(bare, 0.02, 0.05);
        addPoint(bare, 0.06, 0.05);
        finishStroke(bare);
        expect(run(bare, seed), `bare seed ${seed}`).toBe('stung');
      }
    },
    15000
  );

  it('2 ひきの面は、片方だけ守っても刺される', () => {
    const stage = levelFor(25);
    expect(stage.pets).toHaveLength(2);
    for (const pet of stage.pets) {
      const state = createState(stage);
      for (let a = 0; a <= Math.PI; a += 0.1)
        addPoint(state, pet.x - Math.cos(a) * 0.17, pet.y + 0.07 - Math.sin(a) * 0.17);
      finishStroke(state);
      expect(run(state)).toBe('stung');
    }
  });

  it('同じ面はない', () => {
    const stages = new Set(levels.map(([n]) => JSON.stringify(levelFor(n))));
    expect(stages.size).toBe(meta.levels);
  });

  it('レベルが上がるほど、ハチは多く速く、守る時間は長く、インクのゆとりは少ない', () => {
    for (let n = 2; n <= meta.levels; n++) {
      const [a, b] = [levelFor(n - 1), levelFor(n)];
      expect(b.bees, `level ${n}`).toBeGreaterThanOrEqual(a.bees);
      expect(b.speed).toBeGreaterThan(a.speed);
      expect(b.duration).toBeGreaterThanOrEqual(a.duration);
      expect(b.fast).toBeGreaterThanOrEqual(a.fast);
      expect(b.big).toBeGreaterThanOrEqual(a.big);
      expect(b.hives.length).toBeGreaterThanOrEqual(a.hives.length);
    }
  });

  it('洞窟の面は、インクが足りずドームで覆えない', () => {
    expect(levelFor(3).kind).toBe('cave');
    expect(levelFor(3).ink).toBeLessThan(Math.PI * 0.18);
  });

  it('指を離すと線分ができ、そのあとは点を足せない', () => {
    const state = createState(levelFor(1));
    addPoint(state, 0.2, 0.5);
    addPoint(state, 0.4, 0.5);
    expect(state.segs).toEqual([]);
    expect(finishStroke(state)).toBe(true);
    expect(state.segs.length).toBeGreaterThan(1);
    expect(addPoint(state, 0.6, 0.5)).toBe(false);
  });

  it('宙に引いた線は落ちて、地面や足場の上で止まる', () => {
    const ground = createState({ ...levelFor(1), bees: 0 });
    const { x } = ground.level.pets[0];
    const far = x > 0.5 ? 0.05 : 0.7;
    addPoint(ground, far, 0.5);
    addPoint(ground, far + 0.2, 0.5);
    finishStroke(ground);
    run(ground);
    for (const p of ground.stroke) expect(p.y).toBeCloseTo(GROUND - 2 * LINE, 2);

    const stage = levelFor(5);
    expect(stage.kind).toBe('platform');
    const [x1, y, x2] = stage.walls[0];
    const high = createState({ ...stage, bees: 0 });
    addPoint(high, x1 + 0.01, y - 0.3);
    addPoint(high, x2 - 0.01, y - 0.3);
    finishStroke(high);
    run(high);
    for (const p of high.stroke) expect(p.y).toBeLessThan(y);
  });

  it('片側が重い線は、支えから外れて倒れる', () => {
    const state = createState({ ...levelFor(1), bees: 0 });
    const pet = state.level.pets[0];
    const dir = pet.x > 0.5 ? -1 : 1;
    addPoint(state, pet.x - dir * 0.05, pet.y - 0.1);
    addPoint(state, pet.x + dir * 0.35, pet.y - 0.1);
    finishStroke(state);
    run(state);
    expect(state.stroke.at(-1)!.y).toBeCloseTo(GROUND - 2 * LINE, 2);
  });

  it('壁をまたぐ線や、地面の中には引けない', () => {
    const state = createState(levelFor(5));
    const [x1, y] = state.level.walls[0];
    expect(addPoint(state, x1 + 0.05, y - 0.05)).toBe(true);
    expect(addPoint(state, x1 + 0.05, y + 0.05)).toBe(false);
    expect(drawable(state.level, 0.5, GROUND + 0.02)).toBe(false);
  });

  it('雲の中や、雲をまたぐ線は引けない', () => {
    const state = createState(levelFor(11));
    expect(levelFor(11).kind).toBe('side');
    const zone = state.level.noDraw[0];
    const mid = (zone.x0 + zone.x1) / 2;
    expect(addPoint(state, mid, (zone.y0 + zone.y1) / 2)).toBe(false);
    addPoint(state, mid, zone.y0 - 0.05);
    expect(addPoint(state, mid, zone.y1 + 0.05)).toBe(false);
  });
});
