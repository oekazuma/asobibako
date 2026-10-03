import { describe, expect, it } from 'vitest';
import { BOOK } from './book';
import { spawnBosses } from './bosses';
import { apply } from './choices';
import { collect, gainXp, xpNeed } from './drops';
import { ENEMIES } from './enemies';
import { chiefOf, createWorld, damageEnemy, eliteOf, makeEnemy, spawnMetal, summary, type World } from './world';

const VIEW = { w: 274, h: 394 };

function quiet(): World {
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [], events: [], chiefs: [], storms: [] };
  w.weapons = [];
  w.metalAt = -1;
  return w;
}

describe('図鑑の表', () => {
  it('敵 20・ボス 7・姿 27・品 9', () => {
    expect(BOOK.enemies).toHaveLength(20);
    expect(BOOK.bosses).toHaveLength(7);
    expect(BOOK.bosses).toContain('metal');
    expect(BOOK.forms).toHaveLength(27);
    expect(BOOK.forms).toContain('drake:2');
    expect(BOOK.items).toEqual(['meat', 'pouch', 'purse', 'magnet', 'goldMagnet', 'cross', 'clock', 'chest', 'bag']);
    for (const id of BOOK.enemies) expect(ENEMIES[id]).toBeDefined();
  });
});

describe('その回の図鑑の分', () => {
  it('倒した敵は元の id で数え、強化個体とヌシは印にも入る', () => {
    const w = quiet();
    w.enemies[0] = makeEnemy(ENEMIES.rat, 500, 0, 1);
    w.enemies[1] = makeEnemy(eliteOf(ENEMIES.rat), 500, 0, 1);
    w.enemies[2] = makeEnemy(chiefOf(ENEMIES.boar), 500, 0, 1);
    for (const i of [0, 1, 2]) damageEnemy(w, i, 99, 0, 0);
    const b = summary(w).book;
    expect(b.kills).toEqual({ rat: 2, boar: 1 });
    expect(b.elites).toEqual(['rat']);
    expect(b.chiefs).toEqual(['boar']);
  });

  it('十字架で倒した敵も数える', () => {
    const w = quiet();
    w.enemies[0] = makeEnemy(ENEMIES.bat, 20, 0, 99);
    w.grid.add(0, 20, 0);
    w.items.push({ alive: true, kind: 'cross', x: 0, y: 4, pulled: true });
    collect(w, 1 / 60);
    expect(summary(w).book.kills).toEqual({ bat: 1 });
    expect(summary(w).book.items).toEqual(['cross']);
  });

  it('ボスは出てから倒すまでの秒が入り、2 回めと面の主も同じ id、きらきらハリネズミも載る', () => {
    const w = quiet();
    w.time = 180;
    spawnBosses(w);
    const i = w.enemies.findIndex((e) => e.alive && e.def.boss);
    w.time = 222.5;
    damageEnemy(w, i, 1e9, 0, 0);
    w.metalAt = 0;
    spawnMetal(w);
    const m = w.enemies.findIndex((e) => e.alive && e.def.metal);
    w.time = 230;
    for (let k = 0; k < 12; k++) damageEnemy(w, m, 1, 0, 0);
    expect(summary(w).book.bosses).toEqual([
      { id: 'bear', secs: 42.5 },
      { id: 'metal', secs: 7.5 }
    ]);
    // 面の主の写しの def も元のボスの id
    const c = makeEnemy({ ...ENEMIES.spiderQueen, hp: 1, finale: true, rage: 1.5 }, 0, 0, 1);
    w.enemies[5] = c;
    c.born = 229;
    damageEnemy(w, 5, 9, 0, 0);
    expect(summary(w).book.bosses.at(-1)).toEqual({ id: 'spiderQueen', secs: 1 });
  });

  it('育った段階までの姿と、拾った品と、選んだ経験値の袋', () => {
    const w = quiet();
    let need = 0;
    for (let l = 1; l < 10; l++) need += xpNeed(l);
    gainXp(w, need);
    w.items.push(
      { alive: true, kind: 'meat', x: 0, y: 4, pulled: true },
      { alive: true, kind: 'chest', x: 0, y: 0, pulled: false }
    );
    collect(w, 1 / 60);
    apply(w, { kind: 'bag' });
    const b = summary(w).book;
    expect(b.forms).toEqual(['dog:0', 'dog:1']);
    expect(b.items.sort()).toEqual(['bag', 'chest', 'meat']);
  });
});
