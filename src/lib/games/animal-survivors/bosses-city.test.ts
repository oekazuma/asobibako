import { describe, expect, it } from 'vitest';
import { airborne } from './bosses-snow';
import { BEAR } from './bosses';
import { GATOR } from './bosses-city';
import { ENEMIES } from './enemies';
import { createWorld, damageEnemy, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

function quiet(): World {
  const w = createWorld('dog', 1, VIEW, {}, 'city');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [], tides: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  w.player.hp = w.stats.maxHp = 1e6;
  w.items.length = 0;
  return w;
}

const gator = (w: World, x = 120, def: Partial<typeof ENEMIES.gator> = {}) => {
  const e = makeEnemy({ ...ENEMIES.gator, ...def }, x, 0, 1e6);
  w.enemies.push(e);
  return e;
};

const run = (w: World, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(w, still, 1 / 60);
};

/** 潜ってすぐ予告を出す大ワニ。ふつうの攻撃は封じ、体当たりも無くして、予告の当たりだけを見る */
function diving(w: World, x = 120) {
  const e = gator(w, x, { atk: 0 });
  e.cd = 1e6;
  e.phase = GATOR.every;
  return e;
}

const warning = (w: World) => w.hazards.find((h) => h.alive && h.kind === 'slam');

describe('下水の大ワニ', () => {
  it('巨大ベアと同じ突進の矢印と地ならしの輪を出す', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    const e = gator(w);
    e.phase = -1e6;
    const kinds = new Set<string>();
    for (let i = 0; i < 60 * 15; i++) {
      step(w, still, 1 / 60);
      for (const h of w.hazards) if (h.alive) kinds.add(h.kind);
    }
    expect(kinds.has('dash')).toBe(true);
    expect(kinds.has('slam')).toBe(true);
  });

  it('潜っているあいだは武器も体当たりも当たらない', () => {
    const w = quiet();
    w.player.x = 0;
    w.player.y = 0;
    const e = gator(w, 0);
    e.cd = 1e6;
    e.state = 5;
    e.wait = 1e6;
    expect(airborne(e)).toBe(true);
    const before = w.player.hp;
    damageEnemy(w, 0, 500, 0, 0);
    run(w, 0.5);
    expect(e.hp).toBe(1e6);
    expect(w.player.hp).toBe(before);
  });

  it('潜って 1 秒たつと自分の位置に半径 36 の予告の円を 1 秒出す', () => {
    const w = quiet();
    w.player.x = 30;
    w.player.y = -20;
    const e = diving(w);
    run(w, 0.2);
    expect(e.state).toBe(5);
    expect(warning(w)).toBeUndefined();
    run(w, GATOR.dive - 0.2 + 0.05);
    const ring = warning(w)!;
    expect(ring).toBeDefined();
    expect(e.state).toBe(6);
    expect(airborne(e)).toBe(true);
    expect(ring.r).toBe(36);
    expect(ring.delay).toBeGreaterThan(0.9);
    expect([ring.x, ring.y]).toEqual([30, -20]);
  });

  it('円の中に残った自分にだけ当たる。円の場所は予告を置いたときの位置で、自分が動いても動かない', () => {
    const w = quiet();
    const e = diving(w);
    run(w, GATOR.dive + 0.1);
    const ring = warning(w)!;
    const at = [ring.x, ring.y];
    w.player.x += 60;
    const before = w.player.hp;
    run(w, GATOR.warn + 0.2);
    expect([ring.x, ring.y]).toEqual(at);
    expect([e.x, e.y]).toEqual(at);
    expect(e.state).toBe(7);
    expect(airborne(e)).toBe(false);
    expect(w.player.hp).toBe(before);
  });

  it('円の中の自分には当たる', () => {
    const w = quiet();
    diving(w);
    run(w, GATOR.dive + 0.1);
    const before = w.player.hp;
    run(w, GATOR.warn - 0.2);
    expect(w.player.hp).toBe(before);
    run(w, 0.4);
    expect(before - w.player.hp).toBe(BEAR.slamDmg);
  });

  it('出てきてしばらくすると歩いて追う', () => {
    const w = quiet();
    const e = diving(w);
    run(w, GATOR.dive + GATOR.warn + GATOR.surface + 0.3);
    expect(e.state).toBe(0);
  });

  it('潜る間隔は rage の行で短くなり、同じ秒数で潜る回数が増える', () => {
    const dives = (rage?: number) => {
      const w = quiet();
      w.player.invuln = 1e6;
      const e = gator(w, 120, rage ? { rage } : {});
      e.cd = 1e6;
      let n = 0;
      let prev = e.state;
      for (let i = 0; i < 60 * 40; i++) {
        step(w, still, 1 / 60);
        if (e.state === 5 && prev !== 5) n++;
        prev = e.state;
      }
      return n;
    };
    expect(dives(2)).toBeGreaterThan(dives());
  });
});
