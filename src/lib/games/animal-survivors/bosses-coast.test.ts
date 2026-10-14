import { describe, expect, it } from 'vitest';
import { CRAB } from './bosses-coast';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

function quiet(): World {
  const w = createWorld('dog', 1, VIEW, {}, 'coast');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [], tides: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  w.player.hp = w.stats.maxHp = 1e6;
  w.items.length = 0;
  return w;
}

const crab = (w: World, x: number, y = 0, rage?: number) => {
  const e = makeEnemy(rage ? { ...ENEMIES.crabKing, rage } : ENEMIES.crabKing, x, y, 1e6);
  w.enemies.push(e);
  return e;
};

const run = (w: World, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(w, still, 1 / 60);
};

describe('巨大ガニ', () => {
  it('突進の向きは自分のいる側の左右で、斜めには走らない', () => {
    const w = quiet();
    const c = crab(w, 120, 40);
    c.cd = 0;
    const dirs: number[][] = [];
    for (let i = 0; i < 60 * 12; i++) {
      step(w, still, 1 / 60);
      for (const h of w.hazards) if (h.alive && h.kind === 'dash') dirs.push([h.vx, h.vy]);
    }
    expect(dirs.length).toBeGreaterThan(0);
    for (const [vx, vy] of dirs) {
      expect(Math.abs(vy)).toBeLessThan(1e-6);
      expect(vx).toBe(-1);
    }
  });

  it('はさみの地ならしは左右に輪を 2 つ同時に出し、予告のあとに輪の中の自分にだけ当たる', () => {
    const w = quiet();
    const c = crab(w, 40);
    c.cd = 0;
    c.turn = 1;
    run(w, 0.5);
    const rings = w.hazards.filter((h) => h.alive && h.kind === 'slam');
    expect(rings).toHaveLength(2);
    expect(rings.map((h) => h.x).sort((a, b) => a - b)).toEqual([c.x - CRAB.clawGap, c.x + CRAB.clawGap]);
    expect(rings[0].delay).toBeCloseTo(rings[1].delay);
    const before = w.player.hp;
    run(w, 0.3);
    expect(w.player.hp).toBe(before);
    run(w, 0.6);
    expect(w.player.hp).toBe(before - CRAB.clawDmg);
  });

  it('はさみの輪の外にいる自分には当たらない', () => {
    const w = quiet();
    const c = crab(w, 40, 0);
    w.player.x = 40;
    w.player.y = 60;
    c.cd = 0;
    c.turn = 1;
    const before = w.player.hp;
    run(w, 1.6);
    expect(w.hazards.some((h) => h.kind === 'slam')).toBe(true);
    expect(w.player.hp).toBe(before);
  });

  it('はさみの予告のあいだに倒れたら輪も消える', () => {
    const w = quiet();
    const c = crab(w, 40);
    c.cd = 0;
    c.turn = 1;
    run(w, 0.3);
    c.alive = false;
    run(w, 0.1);
    expect(w.hazards.some((h) => h.alive)).toBe(false);
  });

  it('巨大ガニは押し合いで押されない', () => {
    const w = quiet();
    const c = makeEnemy({ ...ENEMIES.crabKing, speed: 0 }, 100, 0, 1e6);
    w.enemies.push(c, makeEnemy({ ...ENEMIES.rat, speed: 0 }, 105, 0, 6));
    w.time = 10;
    run(w, 0.2);
    expect(c.x).toBeCloseTo(100, 0);
  });

  it('攻撃の間は rage の行で短くなり、同じ秒数で攻撃の回数が増える', () => {
    const attacks = (rage?: number) => {
      const w = quiet();
      w.player.invuln = 1e6;
      const c = crab(w, 120, 0, rage);
      c.cd = 0;
      run(w, 20);
      return c.turn;
    };
    expect(attacks(2)).toBeGreaterThan(attacks());
  });
});
