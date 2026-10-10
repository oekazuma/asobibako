import { describe, expect, it } from 'vitest';
import { levelOf, mansion, placeOf } from '../mansion/layout';
import { DEFAULTS, newMatch, view, type View } from '../referee';
import { rng } from '../rng';
import { HiderBrain, PAINT_SECS, RAYS_PER_STEP, SETTLE, thin } from './hider';
import { tube } from './fixtures';
import { SKILLS, type Strength } from './levels';
import type { Ctx, Senses, SurfacePoint } from './senses';
import { SPOTS, viewOf, type Spot } from './spots';

const lv = levelOf(mansion());
const open = SPOTS.find((s) => s.tier === 0 && placeOf(s.pos) === '大広間')!;
const clung = SPOTS.find((s) => s.cling?.kind === 'wall')!;

/** 見られる位置より上を向く線の先は赤、下は青の面。聞かれた数を rays に数える */
function canvas(points: () => SurfacePoint[] | null, rays = { n: 0 }): Senses {
  return {
    visible: () => 0,
    colorAt: (_o, d) => {
      rays.n++;
      return { color: d[1] > 0 ? [1, 0, 0] : [0, 0, 1], metal: 0.1, rough: 0.7, up: 0 };
    },
    surface: points
  };
}

function ctx(senses: Senses | null, phase: View['phase'] = 'hide'): Ctx {
  return {
    me: 2,
    view: { ...view(newMatch()), phase, settings: DEFAULTS, roles: { 1: 'hunter', 2: 'hider' } },
    level: lv,
    bodies: new Map(),
    senses,
    now: 0,
    act: () => {}
  };
}

function run(b: HiderBrain, c: Ctx, secs: number, each?: () => void) {
  for (let t = 0; t < secs - 1e-9; t += 1 / 60) {
    c.now += 1000 / 60;
    b.step(c, 1 / 60);
    each?.();
  }
}

const brain = (s: Strength, spot: Spot = open) => new HiderBrain(spot, SKILLS[s], rng(4));

describe('隠れる CPU', () => {
  it('置いてから SETTLE 秒は塗らず、そのあと塗り終えて done になる', () => {
    const b = brain('normal');
    const c = ctx(canvas(() => tube(open)));
    run(b, c, SETTLE - 0.1);
    expect(b.log.dabs).toEqual([]);
    run(b, c, 25);
    expect(b.done).toBe(true);
    expect(b.log.dabs.length).toBeGreaterThan(100);
    expect(b.painting).toBe(false);
  });

  it('見られる位置から体を通した先の面の色で、強さの段の筆で吹く', () => {
    const b = brain('strong');
    run(b, ctx(canvas(() => tube(open))), 25);
    expect(viewOf(open)[1]).toBeCloseTo(1);
    const high = b.log.dabs.filter((d) => d.p[1] > 1.1);
    const low = b.log.dabs.filter((d) => d.p[1] < 0.9);
    expect(high.length).toBeGreaterThan(0);
    expect(high.every((d) => d.c[0] > 0.95 && d.c[2] < 0.05)).toBe(true);
    expect(low.every((d) => d.c[2] > 0.95 && d.c[0] < 0.05)).toBe(true);
    expect(b.log.dabs[0]).toMatchObject({ r: SKILLS.strong.brush, a: SKILLS.strong.alpha, m: 0.1, ro: 0.7 });
  });

  it('弱いは大きな筆で数が少なく、色がずれ、塗り残す', () => {
    const points = tube(open);
    const weak = brain('weak');
    const strong = brain('strong');
    run(weak, ctx(canvas(() => points)), 25);
    run(strong, ctx(canvas(() => points)), 25);
    expect(weak.log.dabs.length).toBeLessThan(strong.log.dabs.length / 4);
    expect(weak.log.dabs.length).toBeLessThan(thin(points, SKILLS.weak.brush * 0.8).length);
    const off = (b: HiderBrain) => {
      const list = b.log.dabs.map((d) => Math.min(Math.abs(d.c[0] - 1) + d.c[2], d.c[0] + Math.abs(d.c[2] - 1)));
      return list.reduce((a, v) => a + v, 0) / list.length;
    };
    expect(off(weak)).toBeGreaterThan(0.04);
    expect(off(strong)).toBeLessThan(0.02);
  });

  it('3D の体がまだ無いあいだ（surface が null）と、目の口が無いあいだは待つ', () => {
    let ready = false;
    const b = brain('normal');
    const c = ctx(canvas(() => (ready ? tube(open) : null)));
    run(b, c, 3);
    expect(b.log.dabs).toEqual([]);
    ready = true;
    run(b, c, 25);
    expect(b.done).toBe(true);
    const blind = brain('normal');
    run(blind, ctx(null), 5);
    expect(blind.log.dabs).toEqual([]);
  });

  it('面の色は 1 コマに RAYS_PER_STEP 回までしか聞かない', () => {
    const rays = { n: 0 };
    const b = brain('strong');
    const c = ctx(canvas(() => tube(open), rays));
    let before = 0;
    let most = 0;
    run(b, c, 15, () => {
      most = Math.max(most, rays.n - before);
      before = rays.n;
    });
    expect(rays.n).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(RAYS_PER_STEP);
  });

  it('点が多くても、置いてから SETTLE + PAINT_SECS 秒で塗り終える（隠れタイムの最短 30 秒に収める）', () => {
    const b = brain('strong');
    const big = tube(open, 40000, 0.5, 3);
    run(b, ctx(canvas(() => big)), SETTLE + PAINT_SECS + 0.5);
    expect(b.done).toBe(true);
    expect(b.log.dabs.length).toBeGreaterThan(150 * PAINT_SECS);
  });

  it('隠れタイムでなくなったら塗るのをやめる', () => {
    const b = brain('strong');
    const c = ctx(canvas(() => tube(open)));
    run(b, c, SETTLE + 1);
    const n = b.log.dabs.length;
    expect(n).toBeGreaterThan(0);
    c.view = { ...c.view, phase: 'search' };
    run(b, c, 5);
    expect(b.log.dabs.length).toBe(n);
    expect(b.painting).toBe(false);
  });

  it('体は場所のポーズと張り付きのまま送り、塗るあいだは筆を持つ', () => {
    const b = brain('normal', clung);
    const c = ctx(canvas(() => tube(clung)));
    expect(b.me(5)).toMatchObject({
      ms: 5,
      pos: clung.pos,
      yaw: clung.yaw,
      cling: clung.cling,
      pose: clung.pose,
      eye: null
    });
    run(b, c, SETTLE + 0.5);
    expect(b.me(0).paint).toBe(true);
  });

  it('上を向く床の色を横を向く体の面に塗るときは、日の当たり方の差のぶん明るくする', () => {
    const b = brain('strong');
    const floor: Senses = {
      visible: () => 0,
      colorAt: () => ({ color: [0.3, 0.3, 0.3], metal: 0, rough: 0.8, up: 1 }),
      surface: () => tube(open)
    };
    run(b, ctx(floor), 25);
    expect(b.done).toBe(true);
    expect(b.log.dabs.every((d) => d.c[1] > 0.45)).toBe(true);
  });
});
