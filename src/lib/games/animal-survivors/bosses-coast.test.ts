import { describe, expect, it } from 'vitest';
import { RING_DY } from './bosses';
import { CRAB, OCTOPUS } from './bosses-coast';
import { ENEMIES } from './enemies';
import { WADE, wadeFactor } from './tide';
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

  it('突進中に当たると、歩いているときより強く当たる', () => {
    const hit = (state: number) => {
      const w = quiet();
      w.player.x = 0;
      w.player.y = 0;
      const c = crab(w, 5);
      c.def = { ...c.def, speed: 0 };
      c.cd = 1e6;
      c.state = state;
      c.wait = 1e6;
      const before = w.player.hp;
      step(w, still, 1 / 60);
      return before - w.player.hp;
    };
    expect(hit(0)).toBe(ENEMIES.crabKing.atk);
    expect(hit(2)).toBe(CRAB.dashAtk);
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

describe('大ダコ', () => {
  const octopus = (w: World, x = 120) => {
    const e = makeEnemy(ENEMIES.octopus, x, 0, 1e6);
    w.enemies.push(e);
    return e;
  };
  const inks = (w: World) => w.shallows.filter((s) => s.ink && s.life > 0);

  it('墨の弾と小さな手下を出す', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    octopus(w);
    const kinds = new Set<string>();
    for (let i = 0; i < 60 * 5; i++) {
      step(w, still, 1 / 60);
      for (const h of w.hazards) if (h.alive) kinds.add(h.kind);
    }
    expect(kinds.has('web')).toBe(true);
    expect(w.enemies.some((e) => e.alive && e.def.id === 'jelly')).toBe(true);
  });

  it('墨だまりは 1 秒の予告のあとに狙われている動物の位置へ置かれ、中の自分は遅くなる', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    const o = octopus(w);
    let warned = false;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 60 * 12 && !inks(w).length; i++) {
      step(w, still, 1 / 60);
      const warn = w.hazards.find((h) => h.alive && h.ink);
      if (warn && !warned) {
        warned = true;
        expect(warn.delay).toBeCloseTo(OCTOPUS.inkWarn, 1);
        x = warn.x;
        y = warn.y;
        // 予告のあとに動物が動いても、墨だまりは予告の位置に落ちる
        w.player.x += 60;
      }
      if (warned && !inks(w).length) expect(w.shallows.some((s) => s.ink && s.life > 0)).toBe(false);
    }
    expect(warned).toBe(true);
    const pool = inks(w)[0];
    expect(pool.r).toBe(OCTOPUS.inkR);
    expect([pool.x, pool.y]).toEqual([x, y + RING_DY]);
    // 大ダコは離れて回り込むので、本体の足もとではなく予告を出したときに狙われていた位置に置かれる
    expect(Math.hypot(pool.x - w.player.x, pool.y - RING_DY - w.player.y)).toBeGreaterThan(50);
    expect(Math.hypot(pool.x - o.x, pool.y - o.y)).toBeGreaterThan(OCTOPUS.inkR);
    expect(wadeFactor(w, w.player.x, w.player.y)).toBe(1);
    expect(wadeFactor(w, pool.x, pool.y)).toBe(WADE);
    expect(o.alive).toBe(true);
  });

  it('墨だまりは 5 秒で消え、大ダコが倒れても残りの時間で消える', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    const o = octopus(w);
    for (let i = 0; i < 60 * 12 && !inks(w).length; i++) step(w, still, 1 / 60);
    const pool = inks(w)[0];
    expect(pool.life).toBeLessThanOrEqual(OCTOPUS.inkLife);
    o.alive = false;
    run(w, 2);
    expect(pool.life).toBeGreaterThan(0);
    expect(wadeFactor(w, pool.x, pool.y)).toBe(WADE);
    run(w, OCTOPUS.inkLife);
    expect(pool.life).toBeLessThanOrEqual(0);
    expect(wadeFactor(w, pool.x, pool.y)).toBe(1);
  });

  it('墨の予告のあいだに倒れたら予告ごと消えて、墨だまりは出ない', () => {
    const w = quiet();
    const o = octopus(w);
    for (let i = 0; i < 60 * 12 && !w.hazards.some((h) => h.alive && h.ink); i++) step(w, still, 1 / 60);
    o.alive = false;
    run(w, 2);
    expect(inks(w)).toHaveLength(0);
  });

  it('rage の行では墨だまりの間隔が短くなる', () => {
    const count = (rage?: number) => {
      const w = quiet();
      w.player.invuln = 1e6;
      const e = makeEnemy(rage ? { ...ENEMIES.octopus, rage } : ENEMIES.octopus, 120, 0, 1e6);
      w.enemies.push(e);
      let n = 0;
      let prev = 0;
      for (let i = 0; i < 60 * 30; i++) {
        step(w, still, 1 / 60);
        const now = w.shallows.filter((s) => s.ink && s.life > OCTOPUS.inkLife - 0.05).length;
        if (now > prev) n++;
        prev = now;
      }
      return n;
    };
    expect(count(2)).toBeGreaterThan(count());
  });
});
