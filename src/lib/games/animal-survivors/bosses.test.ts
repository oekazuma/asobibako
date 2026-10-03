import { describe, expect, it } from 'vitest';
import { chestSize, openChest } from './chest';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { PASSIVES } from './passives';
import { BOSS_HP } from './bosses';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, MAX_ENEMIES, SLOW, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

/** ふつうの出現を止め、武器も外した世界 */
function quiet(id: 'dog' | 'wolf' = 'dog'): World {
  const w = createWorld(id, 4, VIEW);
  w.weapons = [];
  w.stage = { ...w.stage, waves: [], events: [] };
  w.spawnAcc = [];
  w.player.hp = w.stats.maxHp = 1e6;
  return w;
}

const run = (w: World, seconds: number, input = still) => {
  const events: string[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(w, input, 1 / 60);
    for (const e of w.events) events.push(e.type);
  }
  return events;
};

describe('ボスの出かた', () => {
  it('3 分の 3 秒前に予告が出て、3 分に巨大ベアが画面の外に出る', () => {
    const w = quiet();
    w.time = 176;
    expect(run(w, 1.5)).toContain('warning');
    expect(w.enemies.some((e) => e.alive && e.def.boss)).toBe(false);
    run(w, 2.6);
    const bear = w.enemies.find((e) => e.alive && e.def.boss === 'bear')!;
    expect(bear).toBeDefined();
    expect(bear.hp).toBeCloseTo(ENEMIES.bear.hp * 0.6 * w.stage.toughness(180) * BOSS_HP);
  });

  it('6 分には女王グモが出る（倒していない巨大ベアは残る）', () => {
    const w = quiet();
    w.time = 176;
    run(w, 5);
    w.time = 358;
    run(w, 3);
    const bosses = w.enemies.filter((e) => e.alive && e.def.boss).map((e) => e.def.boss);
    expect(bosses.sort()).toEqual(['bear', 'spiderQueen']);
  });

  it('敵の枠が埋まっていてもボスは出る', () => {
    const w = quiet();
    for (let i = 0; i < MAX_ENEMIES; i++) w.enemies.push(makeEnemy({ ...ENEMIES.rat, speed: 0 }, 2000 + i, 0, 6));
    w.time = 179.99;
    run(w, 0.1);
    expect(w.enemies).toHaveLength(MAX_ENEMIES);
    expect(w.enemies.some((e) => e.alive && e.def.boss === 'bear')).toBe(true);
  });

  it('ボスは押し合いで押されない', () => {
    const w = quiet();
    const bear = makeEnemy({ ...ENEMIES.bear, speed: 0 }, 100, 0, 2400);
    w.enemies.push(bear, makeEnemy({ ...ENEMIES.rat, speed: 0 }, 105, 0, 6));
    w.time = 10;
    run(w, 0.2);
    expect(bear.x).toBeCloseTo(100, 0);
    expect(Math.hypot(w.enemies[1].x - 100, w.enemies[1].y)).toBeGreaterThan(15);
  });
});
describe('ボスの攻撃', () => {
  const placeBoss = (w: World, id: 'bear' | 'spiderQueen', x: number, y = 0) => {
    const e = makeEnemy(ENEMIES[id], x, y, ENEMIES[id].hp);
    w.enemies.push(e);
    return e;
  };

  it('巨大ベアの地ならしは、予告のあいだは当たらず、予告が終わると輪の中に当たる', () => {
    const w = quiet();
    const bear = placeBoss(w, 'bear', 40);
    bear.cd = 0;
    bear.turn = 1; // 奇数なので地ならし
    w.time = 10;
    run(w, 0.5);
    expect(w.hazards.some((h) => h.alive && h.kind === 'slam')).toBe(true);
    const before = w.player.hp;
    run(w, 0.3);
    expect(w.player.hp).toBe(before);
    run(w, 0.4);
    expect(w.player.hp).toBe(before - 28);
  });

  it('無敵のあいだ（復活の直後など）は地ならしも当たらない', () => {
    const w = quiet();
    const bear = placeBoss(w, 'bear', 40);
    bear.cd = 0;
    bear.turn = 1;
    w.time = 10;
    run(w, 0.5);
    const before = w.player.hp;
    w.player.invuln = 2;
    run(w, 0.7);
    expect(w.player.hp).toBe(before);
  });

  it('巨大ベアの突進は、予告の矢印を出して止まり、そのあと速く走る', () => {
    const w = quiet();
    const bear = placeBoss(w, 'bear', 200);
    bear.cd = 0;
    w.time = 10;
    run(w, 0.3);
    expect(w.hazards.some((h) => h.alive && h.kind === 'dash')).toBe(true);
    const x0 = bear.x;
    run(w, 0.3);
    expect(bear.x).toBeCloseTo(x0, 0);
    run(w, 0.5);
    expect(x0 - bear.x).toBeGreaterThan(60);
    expect(w.hazards.some((h) => h.alive && h.kind === 'dash')).toBe(false);
  });

  it('女王グモの糸の玉に当たると 2 秒遅くなる', () => {
    const w = quiet();
    const q = placeBoss(w, 'spiderQueen', 110);
    q.cd = 0;
    q.turn = 99;
    w.time = 10;
    run(w, 1.5);
    q.cd = 99; // 2 回目の玉が当たらないように
    expect(w.player.slow).toBeGreaterThan(0);
    w.player.x = 0;
    const x0 = w.player.x;
    step(w, { x: 1, y: 0 }, 1 / 60);
    expect(w.player.x - x0).toBeCloseTo((60 * SLOW) / 60, 3);
    run(w, 2.1);
    expect(w.player.slow).toBeLessThanOrEqual(0);
  });

  it('女王グモは 8 秒ごとに子グモを 4 匹生む', () => {
    const w = quiet();
    const q = placeBoss(w, 'spiderQueen', 110);
    q.cd = 99;
    q.turn = 0;
    w.time = 10;
    run(w, 0.1);
    expect(w.enemies.filter((e) => e.alive && e.def.id === 'spiderling')).toHaveLength(4);
    q.cd = 99;
    run(w, 7.5);
    expect(w.enemies.filter((e) => e.def.id === 'spiderling').length).toBe(4);
    q.cd = 99;
    run(w, 0.6);
    expect(w.enemies.filter((e) => e.def.id === 'spiderling').length).toBe(8);
  });

  it('突進の予告の最後のフレームで巨大ベアが倒れても、矢印は残らない', () => {
    const w = quiet();
    const bear = placeBoss(w, 'bear', 200);
    bear.cd = 0;
    bear.turn = 0;
    w.time = 10;
    // 矢印の残り時間がベアの待ち時間より 1 フレーム先に切れる瞬間を待つ
    for (let i = 0; i < 60; i++) {
      step(w, still, 1 / 60);
      const dash = w.hazards.find((h) => h.alive && h.kind === 'dash');
      if (dash && dash.delay <= 0 && bear.state === 1) break;
    }
    bear.alive = false;
    run(w, 0.1);
    expect(w.hazards.some((h) => h.alive && h.kind === 'dash')).toBe(false);
  });

  it('予告の途中で巨大ベアが倒れたら、予告は消える', () => {
    const w = quiet();
    const bear = placeBoss(w, 'bear', 40);
    bear.cd = 0;
    bear.turn = 1;
    w.time = 10;
    run(w, 0.3);
    bear.alive = false;
    run(w, 0.1);
    expect(w.hazards.some((h) => h.alive)).toBe(false);
  });
});

describe('倒したときと宝箱', () => {
  it('ボスを倒すと bossdown が出て、赤い玉 10 個と宝箱が落ちる', () => {
    const w = quiet();
    w.weapons = [{ id: 'woof', level: 1, cd: 0 }];
    // 近くで倒すと赤い玉がすぐ吸い寄せられるので、取得範囲（32）より遠くで倒す
    const bear = makeEnemy({ ...ENEMIES.bear, speed: 0 }, 150, 0, 1);
    w.enemies.push(bear);
    w.time = 10;
    expect(run(w, 1.2)).toContain('bossdown');
    expect(w.gems.filter((g) => g.alive && g.value === 25)).toHaveLength(10);
    expect(w.items.filter((it) => it.alive && it.kind === 'chest')).toHaveLength(1);
  });

  it('宝箱は吸い寄せられず、歩いて取ると止まる', () => {
    const w = quiet();
    w.items.push({ alive: true, kind: 'chest', x: 30, y: 0, pulled: false });
    w.time = 10;
    run(w, 0.5);
    expect(w.items[0].x).toBe(30);
    const events = run(w, 1, { x: 1, y: 0 });
    expect(events).toContain('chest');
    expect(w.chests).toBe(1);
    const t = w.time;
    run(w, 0.5);
    expect(w.time).toBe(t);
  });

  it('宝箱の大きさは 8.5 割が 1、1.3 割が 3、0.2 割が 5', () => {
    expect(chestSize(0)).toBe(1);
    expect(chestSize(0.84)).toBe(1);
    expect(chestSize(0.85)).toBe(3);
    expect(chestSize(0.97)).toBe(3);
    expect(chestSize(0.99)).toBe(5);
  });

  it('宝箱は Lv5 を超えて上げず、上げるものが無ければごほうびになる', () => {
    const w = quiet();
    w.weapons = Object.keys(WEAPONS)
      .slice(0, 6)
      .map((id) => ({ id, level: MAX_LEVEL, cd: 0 }));
    w.passives = [{ id: 'heart', level: 4 }];
    w.chests = 1;
    w.rand = () => 0.99; // 5 つ
    const got = openChest(w);
    expect(got).toHaveLength(5);
    expect(got[0]).toEqual({ kind: 'passive', id: 'heart', level: 5 });
    for (const r of got.slice(1)) expect(['power', 'vigor', 'gold']).toContain(r.kind);
    expect(w.passives[0].level).toBe(5);
    expect(w.chests).toBe(0);
    expect(Object.keys(PASSIVES)).toContain('heart');
  });

  it('宝箱を開けるあいだは 3 択を出さず、袋で上がった Lv は宝箱のあとに 3 択になる', () => {
    const w = quiet();
    w.chests = 1;
    w.pending = 1;
    const t = w.time;
    step(w, still, 1 / 60);
    expect(w.time).toBe(t);
    openChest(w);
    expect(w.chests).toBe(0);
    expect(w.pending).toBeGreaterThanOrEqual(1);
  });

  it('15:00 のクリアではボスも倒れ、宝箱は落とさない', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.bear, 100, 0, 2400));
    w.time = 899.99;
    run(w, 0.05);
    expect(w.over).toBe('clear');
    expect(w.items.some((it) => it.alive && it.kind === 'chest')).toBe(false);
  });
});
