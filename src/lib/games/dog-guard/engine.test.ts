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
    const stage = levels.map(([n]) => levelFor(n)).findLast((s) => s.kind === 'open2')!;
    for (const pet of stage.pets) {
      const state = createState(stage);
      for (let a = 0; a <= Math.PI; a += 0.1)
        addPoint(state, pet.x - Math.cos(a) * 0.17, pet.y + 0.07 - Math.sin(a) * 0.17);
      finishStroke(state);
      expect(run(state)).toBe('stung');
    }
  });

  it('型が 4 つそろってからは、同じ型が 4 面のうちに 2 度出ない', () => {
    const kinds = levels.map(([n]) => levelFor(n).kind);
    for (let i = 7; i < kinds.length; i++) expect(kinds.slice(i - 3, i), `level ${i + 1}`).not.toContain(kinds[i]);
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

  it('線の外に回り込める隙間があれば、ハチはそこから入ってくる', () => {
    const stage = levelFor(5);
    expect(stage.kind).toBe('platform');
    const [x1, y, x2] = stage.walls[0];
    const { x } = stage.pets[0];
    // 足場の上の猫を覆い、右端は足場の外で地面まで下ろす。足場の下を通って右の隙間から上がれば届く
    const out = x2 + 0.12;
    const state = createState({ ...stage, ink: 5 });
    addPoint(state, Math.max(x1 + 0.02, x - 0.15), y - 0.02);
    for (let a = 0; a <= Math.PI / 2; a += 0.05)
      addPoint(state, x + (out - x) * (1 - Math.cos(a)) - 0.15 * Math.cos(a), y - 0.02 - 0.2 * Math.sin(a));
    for (let py = y - 0.2; py <= GROUND - 0.01; py += 0.02) addPoint(state, out, py);
    finishStroke(state);
    expect(run(state)).toBe('stung');
  });

  it('洞窟の面は、インクが足りずドームで覆えない', () => {
    expect(levelFor(3).kind).toBe('cave');
    expect(levelFor(3).ink).toBeLessThan(Math.PI * 0.18);
  });

  it('雲のテントの面は、犬の上をまるく囲めない', () => {
    const stage = levels.map(([n]) => levelFor(n)).find((s) => s.kind === 'tent')!;
    const pet = stage.pets[0];
    expect(drawable(stage, pet.x, pet.y - 0.18)).toBe(false);
    expect(drawable(stage, pet.x, pet.y - 0.11)).toBe(true);
  });

  it('角のすきまの面は、屋根の上だけふさいでも横から入られる', () => {
    const stage = levels.map(([n]) => levelFor(n)).find((s) => s.kind === 'corner')!;
    const [a, b] = stage.solution;
    const state = createState(stage);
    addPoint(state, a.x, a.y);
    addPoint(state, b.x, b.y);
    finishStroke(state);
    expect(run(state)).toBe('stung');
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

  it('落ちた線は着地したときだけ land を出し、はじめから乗っている線は出さない', () => {
    const lands = (state: GameState) => {
      const frames: number[] = [];
      for (let f = 0; f < 180; f++) if (step(state, 1 / 60).some((e) => e.type === 'land')) frames.push(f);
      return frames;
    };
    const air = createState({ ...levelFor(1), bees: 0 });
    const far = air.level.pets[0].x > 0.5 ? 0.05 : 0.7;
    addPoint(air, far, 0.6);
    addPoint(air, far + 0.2, 0.6);
    finishStroke(air);
    const frames = lands(air);
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.at(-1)! - frames[0]).toBeLessThan(10);

    const stage = levelFor(1);
    const resting = createState({ ...stage, bees: 0 });
    for (const p of stage.solution) addPoint(resting, p.x, p.y);
    finishStroke(resting);
    expect(lands(resting)).toEqual([]);
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

  it('壁はまたげず、線はその手前で止まる', () => {
    const state = createState(levelFor(5));
    const [x1, y] = state.level.walls[0];
    addPoint(state, x1 + 0.05, y - 0.05);
    addPoint(state, x1 + 0.05, y + 0.05);
    for (const p of state.stroke) expect(p.y).toBeLessThan(y);
    expect(drawable(state.level, 0.5, GROUND + 0.02)).toBe(false);
  });

  it.each([
    ['真ん中', 0],
    ['少し上', -0.02],
    ['地面ぞい', 0.07]
  ])('指が犬の%sを横切っても線は途切れず、縁に沿って回り込む', (_, dy) => {
    const state = createState(levelFor(1));
    const pet = state.level.pets[0];
    for (let x = pet.x - 0.2; x <= pet.x + 0.2; x += 0.01) addPoint(state, x, pet.y + dy);
    expect(state.stroke.at(-1)!.x).toBeCloseTo(pet.x + 0.2, 1);
    for (const p of state.stroke) expect(drawable(state.level, p.x, p.y), `${p.x}, ${p.y}`).toBe(true);
  });

  it('雲に入った指は雲のふちをなぞり、雲の中に線は入らない', () => {
    const stage = levels.map(([n]) => levelFor(n)).find((s) => s.kind === 'side')!;
    const state = createState(stage);
    const zone = state.level.noDraw[0];
    // 洞窟の中の犬を、線で囲めない
    const pet = stage.pets[0];
    expect(drawable(stage, pet.x - 0.12, pet.y)).toBe(false);
    expect(drawable(stage, pet.x + 0.12, pet.y)).toBe(false);
    const y = (zone.y0 + zone.y1) / 2;
    const from = zone.x0 < 0.05 ? zone.x1 + 0.05 : zone.x0 - 0.05;
    const to = zone.x0 < 0.05 ? zone.x1 - 0.1 : zone.x0 + 0.1;
    addPoint(state, from, y);
    for (let k = 1; k <= 20; k++) addPoint(state, from + ((to - from) * k) / 20, y - 0.05 * Math.sin(k));
    expect(state.stroke.length).toBeGreaterThan(1);
    for (const p of state.stroke) expect(drawable(state.level, p.x, p.y)).toBe(true);
  });
});
