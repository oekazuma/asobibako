import { describe, expect, it } from 'vitest';
import { fire, hits } from './arms';
import { collect } from './drops';
import { ENEMIES } from './enemies';
import { limitStats } from './limit';
import { obstacleAt } from './obstacles';
import { MAX_LEVEL, WEAPONS, weaponStats } from './weapons';
import { addHero, chiefOf, createWorld, makeEnemy, step, type World } from './world';

const VIEW = { w: 260, h: 380 };

function quiet(stage = 'forest'): World {
  const w = createWorld('dog', 1, VIEW, {}, stage);
  w.stage = { ...w.stage, waves: [], bosses: [], chiefs: [], events: [] };
  w.metalAt = -1;
  w.propCd = 1e9;
  w.items.length = 0;
  return w;
}

describe('合わせ技のツタと炎の数', () => {
  it('芽吹きの森のツタは、合体武器 1 つにつき同時に 24 本まで', () => {
    const w = quiet();
    w.weapons = [{ id: 'acornUn', level: MAX_LEVEL, cd: 0, cd2: 99, limit: { amount: 40 } }];
    for (let i = 0; i < 60; i++)
      w.enemies.push(makeEnemy(ENEMIES.caterpillar, Math.cos(i) * 40, Math.sin(i) * 40, 1e9));
    for (let k = 0; k < 90; k++) {
      w.grid.clear();
      w.enemies.forEach((e, i) => w.grid.add(i, e.x, e.y));
      fire(w, 1 / 30);
      hits(w, 1 / 30);
      w.time += 1 / 30;
    }
    expect(w.effects.filter((f) => f.alive && f.kind === 'vine').length).toBeLessThanOrEqual(24);
  });
});

describe('限界突破の待ち時間の下限', () => {
  it('何回上げても、待ち時間は元の 4 割より短くならない', () => {
    const s = weaponStats(WEAPONS.woof, MAX_LEVEL);
    expect(limitStats(s, { cooldown: 100 }).cooldown).toBeCloseTo(s.cooldown * 0.4);
  });
});

describe('吹雪とヌシ', () => {
  it('倒れた動物は吹雪で流されない', () => {
    const w = quiet('snow');
    addHero(w, 'cat');
    w.heroes[0].down = true;
    Object.assign(w.storm, { left: 100, wx: 1, wy: 0, next: 99 });
    const x0 = w.player.x;
    step(w, { x: 0, y: 0 }, 1);
    expect(w.player.x).toBe(x0);
  });

  it('大きなヌシも、隣り合う障害物のすき間を通れる（押し出しの丸は半径 16 まで）', () => {
    const w = quiet();
    let o = null;
    for (let c = 1; !o; c++) o = obstacleAt(w.stage.art, c, 0);
    const chief = makeEnemy(chiefOf(ENEMIES.croc), o.x, o.y, 1e9);
    w.enemies.push(chief);
    Object.assign(w.player, { x: o.x + 200, y: o.y });
    step(w, { x: 0, y: 0 }, 1 / 30);
    // 半径 16 の丸で押し出したなら、障害物の中心からの距離は大きくても 16 + 当たりの丸
    expect(Math.hypot(chief.x - o.x, (chief.y - o.y) / 0.55)).toBeLessThan(16 + 24 + 1);
  });
});

describe('遠くの品', () => {
  it('どちらの動物からも遠い品は消え、宝箱・券・遺物・大袋と、片方の近くの品は残る', () => {
    const w = quiet();
    addHero(w, 'cat');
    w.heroes[1].player.x = 5000;
    const far = 3 * Math.hypot(VIEW.w, VIEW.h) + 50;
    const keep = ['chest', 'ticket', 'relic', 'purse'] as const;
    w.items.push(
      { alive: true, kind: 'coin', x: -far, y: 0, pulled: false },
      { alive: true, kind: 'meat', x: 5000, y: 30, pulled: false },
      ...keep.map((kind) => ({
        alive: true,
        kind,
        x: -far,
        y: 0,
        pulled: false,
        relic: kind === 'relic' ? ('map' as const) : undefined
      }))
    );
    collect(w, 1 / 30);
    expect(w.items[0].alive).toBe(false);
    expect(w.items[1].alive).toBe(true);
    for (const it of w.items.slice(2)) expect(it.alive).toBe(true);
  });
});
