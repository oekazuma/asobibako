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

const raven = (w: World, def: Partial<typeof ENEMIES.raven> = {}) => {
  const e = makeEnemy({ ...ENEMIES.raven, ...def }, 120, 0, 1e6);
  w.enemies.push(e);
  return e;
};

const crows = (w: World) => w.enemies.filter((e) => e.alive && e.def.id === 'crow');

/** 動かしながら出た帯の文を溜める（events は step のたびに空になる） */
function runLogged(w: World, seconds: number) {
  const seen: string[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(w, still, 1 / 60);
    for (const ev of w.events) if (ev.type === 'swarm') seen.push(ev.text);
  }
  return seen;
}

describe('巨大カラス', () => {
  it('大ワシと同じ影の予告と急降下と羽根を出す', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    raven(w);
    const kinds = new Set<string>();
    for (let i = 0; i < 60 * 15; i++) {
      step(w, still, 1 / 60);
      for (const h of w.hazards) if (h.alive) kinds.add(h.kind);
    }
    expect(kinds.has('pounce')).toBe(true);
    expect(kinds.has('feather')).toBe(true);
  });

  it('空にいるあいだは武器も体当たりも当たらない', () => {
    const w = quiet();
    const e = raven(w);
    e.state = 4;
    e.wait = 1e6;
    expect(airborne(e)).toBe(true);
  });

  it('急降下 2 回に 1 回、帯を出して 1 秒たつまで群れは出ず、そのあとカラスが 8 体出る', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    const e = raven(w);
    e.turn = 1;
    e.state = 4;
    e.wait = 0.01;
    e.dx = 0;
    e.dy = 0;
    const seen = runLogged(w, 0.1);
    expect(e.state).toBe(0);
    expect(seen).toEqual(['カラスの群れが来る！']);
    expect(crows(w).length).toBe(0);
    run(w, 0.8);
    expect(crows(w).length).toBe(0);
    run(w, 0.3);
    const flock = crows(w);
    expect(flock.length).toBe(8);
    expect(flock.every((c) => c.drift > 0)).toBe(true);
  });

  it('1 回目の急降下のあとでは群れを呼ばない', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    const e = raven(w);
    e.state = 4;
    e.wait = 0.01;
    const seen = runLogged(w, 2);
    expect(e.turn).toBe(1);
    expect(seen).toEqual([]);
    expect(crows(w).length).toBe(0);
  });

  it('帯が出てから 1 秒のあいだに倒すと群れは出ない', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    const e = raven(w);
    e.turn = 1;
    e.state = 4;
    e.wait = 0.01;
    run(w, 0.5);
    e.alive = false;
    run(w, 2);
    expect(crows(w).length).toBe(0);
  });

  it('止まっているあいだは 1 秒の時計も止まる', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    const e = raven(w);
    e.turn = 1;
    e.state = 4;
    e.wait = 0.01;
    run(w, 0.5);
    w.freeze = 2;
    run(w, 1.5);
    expect(crows(w).length).toBe(0);
    run(w, 1.5);
    expect(crows(w).length).toBe(8);
  });

  it('群れのカラスは追わずにまっすぐ進み、抜けたら消える', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    const e = raven(w);
    e.cd = 1e6;
    e.turn = 1;
    e.state = 4;
    e.wait = 0.01;
    run(w, 1.3);
    const flock = crows(w);
    const [dx, dy] = [flock[0].dx, flock[0].dy];
    run(w, 1);
    expect([flock[0].dx, flock[0].dy]).toEqual([dx, dy]);
    run(w, 20);
    expect(crows(w).length).toBe(0);
  });

  it('呼ぶ群れは同時に出せる数の上限（入れ物の 400 体）を越えない', () => {
    const w = quiet();
    w.player.invuln = 1e6;
    for (let i = 0; i < 396; i++) w.enemies.push(makeEnemy(ENEMIES.sewerRat, 5000 + i, 0, 1e6));
    const e = raven(w);
    e.turn = 1;
    e.state = 4;
    e.wait = 0.01;
    run(w, 1.3);
    expect(w.enemies.length).toBeLessThanOrEqual(400);
  });
});
