import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { addBook, BOOK } from './book';
import { emptyRecords, parseRecords, record } from './records';
import { spawnBosses } from './bosses';
import { apply } from './choices';
import { collect, gainXp, xpNeed } from './drops';
import { ENEMIES } from './enemies';
import {
  chiefOf,
  createWorld,
  damageEnemy,
  eliteOf,
  makeEnemy,
  spawnMetal,
  summary,
  type RunSummary,
  type World
} from './world';

const VIEW = { w: 274, h: 394 };

function quiet(): World {
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [], events: [], chiefs: [], storms: [] };
  w.weapons = [];
  w.metalAt = -1;
  return w;
}

describe('図鑑の表', () => {
  it('敵 27・ボス 13・姿 27・品 9', () => {
    expect(BOOK.enemies).toHaveLength(27);
    expect(BOOK.bosses).toHaveLength(13);
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

describe('図鑑を記録に足す', () => {
  const run = (book: Partial<RunSummary['book']>): RunSummary => ({
    ...summary(createWorld('dog', 1, VIEW)),
    book: { kills: {}, elites: [], chiefs: [], bosses: [], forms: [], items: [], ...book }
  });

  it('新しく載った分だけコインが入り、同じものは 2 度出さない', () => {
    const r = emptyRecords();
    const a = run({
      kills: { rat: 3, bat: 1 },
      bosses: [{ id: 'bear', secs: 50 }],
      forms: ['dog:0', 'dog:1'],
      items: ['meat']
    });
    expect(addBook(r, a)).toBe(10 * 2 + 50 + 30 * 2 + 10);
    expect(addBook(r, a)).toBe(0);
    expect(r.book.enemies).toEqual({ rat: 6, bat: 2 });
    expect(r.book.bosses).toEqual({ bear: 2 });
  });

  it('いちばん速い秒は小さいほうを残し、強化個体とヌシの印は重ならない', () => {
    const r = emptyRecords();
    addBook(r, run({ bosses: [{ id: 'bear', secs: 50 }], elites: ['rat'], chiefs: ['boar'] }));
    addBook(
      r,
      run({
        bosses: [
          { id: 'bear', secs: 70 },
          { id: 'bear', secs: 31 }
        ],
        elites: ['rat']
      })
    );
    expect(r.book.fastest).toEqual({ bear: 31 });
    expect(r.book.elites).toEqual(['rat']);
    expect(r.book.chiefs).toEqual(['boar']);
  });

  it('record() は図鑑のコインを記録のコインに足し、まとめに数を残す', () => {
    const r = emptyRecords();
    const s = run({ kills: { rat: 1 } });
    record(r, s);
    expect(s.bookCoins).toBe(10);
    expect(r.coins).toBeGreaterThanOrEqual(10);
  });

  it('古い記録から倒したボスと仲間の 1 段階めが載り、そのときコインは出ない', () => {
    const r = parseRecords(JSON.stringify({ bosses: ['bear', 'pumpkin'], unlocked: ['fox'], coins: 5 }));
    expect(r.book.bosses).toEqual({ bear: 1, pumpkin: 1 });
    // 最初から選べる 3 匹は記録からは育てたか分からないので、遊んだときに載せる
    expect(r.book.forms).toEqual(['fox:0']);
    expect(r.coins).toBe(5);
    expect(addBook(r, run({ bosses: [{ id: 'bear', secs: 40 }], forms: ['fox:0'] }))).toBe(0);
  });

  it('図鑑のある記録で、あとから仲間になった動物の 1 段階めはただで載らず、遊んだときにコインが出る', () => {
    const r = parseRecords(JSON.stringify({ unlocked: ['fox'], book: { forms: ['dog:0'] } }));
    expect(r.book.forms).toEqual(['dog:0']);
    expect(addBook(r, run({ forms: ['fox:0'] }))).toBe(30);
  });

  it('壊れた値と知らない id は捨てる', () => {
    const r = parseRecords(
      JSON.stringify({
        book: {
          enemies: { rat: 3, nope: 9, bat: -1, snake: 'x' },
          fastest: { bear: 12, x: 1 },
          items: ['meat', 7, 'zzz']
        }
      })
    );
    expect(r.book.enemies).toEqual({ rat: 3 });
    expect(r.book.fastest).toEqual({ bear: 12 });
    expect(r.book.items).toEqual(['meat']);
  });

  it('種類ごとに全部そろうと実績', () => {
    const r = emptyRecords();
    const ids = ['bookEnemies', 'bookBosses', 'bookForms', 'bookItems'];
    const got = (o: ReturnType<typeof emptyRecords>) =>
      ACHIEVEMENTS.filter((a) => ids.includes(a.id) && a.done(o, null)).map((a) => a.id);
    expect(got(r)).toEqual([]);
    r.book.enemies = Object.fromEntries(BOOK.enemies.map((id) => [id, 1]));
    r.book.items = [...BOOK.items];
    expect(got(r)).toEqual(['bookEnemies', 'bookItems']);
    for (const id of ids) expect(ACHIEVEMENTS.find((a) => a.id === id)?.coins).toBe(300);
  });
});
