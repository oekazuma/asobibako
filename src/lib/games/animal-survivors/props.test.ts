import { describe, expect, it } from 'vitest';
import { fire } from './arms';
import { collect, dropLoot } from './drops';
import { ENEMIES } from './enemies';
import { LANTERNS, addEnemy, createWorld, damageEnemy, makeEnemy, spawnProps, step } from './world';

const VIEW = { w: 274, h: 394 };

function quiet() {
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], events: [] };
  w.spawnAcc = [];
  w.weapons = [];
  return w;
}

describe('ランタン', () => {
  it('武器はランタンを狙わず、敵へ向けて撃つ', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.lantern, 10, 0, 1), makeEnemy(ENEMIES.rat, -100, 0, 6));
    w.weapons = [{ id: 'woof', level: 1, cd: 0 }];
    fire(w, 1 / 60);
    expect(w.shots.find((o) => o.alive)!.vx).toBeLessThan(0);
  });

  it('遅い時刻でも 1 回で壊れ、品を落とし、倒した数とダメージ表に入らない', () => {
    const w = quiet();
    w.time = 800;
    spawnProps(w, 10);
    const i = w.enemies.findIndex((e) => e.alive && e.def.prop);
    expect(w.enemies[i].hp).toBe(1);
    damageEnemy(w, i, 5, 0, 0, false, 'woof');
    expect(w.enemies[i].alive).toBe(false);
    expect(w.kills).toBe(0);
    expect(w.dealt).toEqual({});
    expect(w.items.filter((o) => o.alive)).toHaveLength(1);
    expect(w.gems.filter((g) => g.alive)).toHaveLength(0);
  });

  it(`自分の周りに ${LANTERNS} 個まで出し、動かず、押されず、離れたら消える`, () => {
    const w = quiet();
    w.player.invuln = 9999;
    for (let i = 0; i < 60 * 40; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    const props = w.enemies.filter((e) => e.alive && e.def.prop);
    expect(props.length).toBeGreaterThan(0);
    expect(props.length).toBeLessThanOrEqual(LANTERNS);
    const at = props.map((e) => [e.x, e.y]);
    const rat = addEnemy(w, ENEMIES.rat, props[0].x, props[0].y)!;
    rat.x += 1;
    for (let i = 0; i < 30; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(props.map((e) => [e.x, e.y])).toEqual(at);
    for (let i = 0; i < 60 * 30; i++) step(w, { x: 1, y: 0 }, 1 / 60);
    const far = Math.hypot(VIEW.w, VIEW.h);
    for (const e of w.enemies)
      if (e.alive && e.def.prop) expect(Math.hypot(e.x - w.player.x, e.y - w.player.y)).toBeLessThan(far);
  });
});

describe('ランタンの品', () => {
  it('十字架は画面の中のボス以外の敵を倒し、ボスとランタンは残る', () => {
    const w = quiet();
    w.enemies.push(
      makeEnemy(ENEMIES.rat, 30, 0, 6),
      makeEnemy(ENEMIES.croc, -40, 20, 120),
      makeEnemy(ENEMIES.bear, 50, 0, 700),
      makeEnemy(ENEMIES.lantern, 0, 40, 1),
      makeEnemy(ENEMIES.rat, 2000, 0, 6)
    );
    w.items.push({ alive: true, kind: 'cross', x: 0, y: 0, pulled: false });
    collect(w, 1 / 60);
    expect(w.enemies.map((e) => e.alive)).toEqual([false, false, true, true, true]);
    expect(w.kills).toBe(2);
    expect(w.events.some((e) => e.type === 'cross')).toBe(true);
  });

  it('時計で 6 秒のあいだ敵が止まり、当たっても痛くない', () => {
    const w = quiet();
    const rat = makeEnemy(ENEMIES.rat, 3, 0, 6);
    w.enemies.push(rat);
    w.items.push({ alive: true, kind: 'clock', x: 0, y: 0, pulled: false });
    collect(w, 1 / 60);
    const hp = w.player.hp;
    for (let i = 0; i < 60 * 5.5; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect([rat.x, w.player.hp]).toEqual([3, hp]);
    for (let i = 0; i < 60 * 1; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('小袋はコイン 10 枚', () => {
    const w = quiet();
    w.items.push({ alive: true, kind: 'pouch', x: 0, y: 0, pulled: false });
    collect(w, 1 / 60);
    expect(w.coins).toBe(10);
  });

  it('運が高いと十字架と時計が出やすい', () => {
    const rate = (luck: number) => {
      const w = quiet();
      w.stats.luck = luck;
      let rare = 0;
      for (let i = 0; i < 4000; i++) {
        w.items.length = 0;
        dropLoot(w, 0, 0);
        if (w.items[0].kind === 'cross' || w.items[0].kind === 'clock') rare++;
      }
      return rare / 4000;
    };
    expect(rate(0)).toBeGreaterThan(0.15);
    expect(rate(0)).toBeLessThan(0.25);
    expect(rate(1)).toBeGreaterThan(rate(0) + 0.08);
  });

  it('止まっているあいだの吹き飛ばしはためず、時計が切れても飛ばない', () => {
    const w = quiet();
    w.player.invuln = 9999;
    const croc = makeEnemy(ENEMIES.croc, 60, 0, 9999);
    w.enemies.push(croc);
    w.freeze = 2;
    for (let i = 0; i < 60; i++) {
      damageEnemy(w, 0, 1, 500, 0);
      step(w, { x: 0, y: 0 }, 1 / 60);
    }
    for (let i = 0; i < 90; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(croc.x).toBeLessThan(80);
  });

  it('ランタンは灯りのコマが進む', () => {
    const w = quiet();
    const lantern = makeEnemy(ENEMIES.lantern, 40, 0, 1);
    w.enemies.push(lantern);
    for (let i = 0; i < 30; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(lantern.t).toBeGreaterThan(0.4);
  });
});
