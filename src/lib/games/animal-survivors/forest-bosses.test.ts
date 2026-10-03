import { describe, expect, it } from 'vitest';
import { slot, spawnBosses } from './bosses';
import { BOAR, EAGLE, SNAKE, TREE } from './bosses-forest';
import { airborne } from './bosses-snow';
import { ENEMIES } from './enemies';
import { startOvertime } from './overtime';
import { FINALE, FOREST } from './stages/forest';
import { GRAVEYARD } from './stages/graveyard';
import { SNOW } from './stages/snow';
import { createWorld, damageEnemy, step, type Enemy, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

/** 敵の出現と出来事を止め、id のボスを 1 体だけ (x, y) に出した World */
function withBoss(id: string, x = 120, y = 0): { w: World; i: number; e: Enemy } {
  const w = createWorld('dog', 4, VIEW);
  w.stage = { ...w.stage, waves: [], events: [], chiefs: [], bosses: [{ at: 0, id: id as 'bear' }] };
  w.spawnAcc = [];
  w.weapons = [];
  w.metalAt = -1;
  w.propCd = 1e9;
  w.player.hp = w.stats.maxHp = 1e9;
  w.time = 0.01;
  spawnBosses(w);
  const i = w.enemies.findIndex((e) => e.alive && e.def.id === id);
  const e = w.enemies[i];
  e.x = x;
  e.y = y;
  e.cd = 0;
  return { w, i, e };
}

function run(w: World, secs: number, dt = 1 / 30) {
  for (let t = 0; t < secs; t += dt) step(w, still, dt);
}

describe('1 面のボスの並び', () => {
  it('3:00 巨大ベア・6:00 女王グモ・9:00 大イノシシ・12:00 大ワシ、面の主は大木のおばけと大ヘビ', () => {
    expect(FOREST.bosses.map((b) => [b.at, b.id, b.title ?? ''])).toEqual([
      [180, 'bear', ''],
      [360, 'spiderQueen', ''],
      [540, 'bigBoar', ''],
      [720, 'bigEagle', ''],
      [FINALE, 'oldTree', '面の主'],
      [FINALE, 'bigSnake', '面の主']
    ]);
  });

  it('新しい 4 体に二つ名がある', () => {
    for (const id of ['bigBoar', 'bigEagle', 'oldTree', 'bigSnake'])
      expect(ENEMIES[id].epithet?.length).toBeGreaterThan(0);
  });

  it('墓地と雪山は 2 体が交互に出る並びのまま', () => {
    for (const s of [GRAVEYARD, SNOW]) {
      const ids = s.bosses.map((b) => b.id);
      expect(new Set(ids).size).toBe(2);
      expect(ids[0]).toBe(ids[2]);
    }
  });

  it('延長戦は 1 面の 6 体を順に出す', () => {
    const w = createWorld('dog', 1, VIEW);
    w.time = 900 - 1e-6;
    w.weapons = [];
    step(w, still, 1 / 60);
    startOvertime(w);
    const ot = w.stage.bosses.slice(FOREST.bosses.length, FOREST.bosses.length + 7).map((b) => b.id);
    expect(ot).toEqual(['bear', 'spiderQueen', 'bigBoar', 'bigEagle', 'oldTree', 'bigSnake', 'bear']);
  });
});

describe('大イノシシ', () => {
  it('予告のあと 3 回続けて突進し、休んでからまた自分へ向かってくる', () => {
    const { w, e } = withBoss('bigBoar');
    step(w, still, 1 / 30);
    expect(w.hazards.some((h) => h.alive && h.kind === 'dash')).toBe(true);
    let charges = 0;
    let last = e.state;
    for (let t = 0; t < (BOAR.warn + BOAR.time) * BOAR.charges + 0.5; t += 1 / 30) {
      step(w, still, 1 / 30);
      if (e.state === 2 && last !== 2) charges++;
      last = e.state;
    }
    expect(charges).toBe(BOAR.charges);
    run(w, BOAR.rest + 3);
    expect(Math.hypot(e.x - w.player.x, e.y - w.player.y)).toBeLessThan(400);
  });

  it('突進のあとに土ぼこりを残し、その中は遅くなる', () => {
    const { w } = withBoss('bigBoar');
    run(w, BOAR.warn + BOAR.time);
    const mud = w.hazards.find((h) => h.alive && h.kind === 'mud');
    expect(mud).toBeDefined();
    w.player.x = mud!.x;
    w.player.y = mud!.y;
    w.player.slow = 0;
    step(w, still, 1 / 30);
    expect(w.player.slow).toBeGreaterThan(0);
  });
});

describe('大ワシ', () => {
  it('影の予告を出して空へ上がり、そのあいだは攻撃が当たらない', () => {
    const { w, i, e } = withBoss('bigEagle');
    step(w, still, 1 / 30);
    expect(airborne(e)).toBe(true);
    const shadow = w.hazards.find((h) => h.alive && h.kind === 'pounce');
    expect(shadow).toMatchObject({ x: w.player.x, y: w.player.y });
    const hp = e.hp;
    damageEnemy(w, i, 100, 0, 0);
    expect(e.hp).toBe(hp);
  });

  it('降りると予告の場所に立ち、羽根を 8 方向にばらまく', () => {
    const { w, e } = withBoss('bigEagle');
    run(w, EAGLE.warn + 0.1);
    expect(airborne(e)).toBe(false);
    expect(Math.hypot(e.x - w.player.x, e.y - w.player.y)).toBeLessThan(2);
    expect(w.hazards.filter((h) => h.alive && h.kind === 'feather')).toHaveLength(EAGLE.feathers);
  });
});

describe('大木のおばけ', () => {
  it('自分の近くに根っこの予告を出し、予告が終わると中にいれば痛い', () => {
    const { w } = withBoss('oldTree', 80, 0);
    step(w, still, 1 / 30);
    const roots = w.hazards.filter((h) => h.alive && h.kind === 'root');
    expect(roots).toHaveLength(TREE.roots);
    for (const h of roots) expect(Math.hypot(h.x - w.player.x, h.y - w.player.y)).toBeLessThan(TREE.spread + 1);
    w.player.invuln = 0;
    const hp = w.player.hp;
    run(w, TREE.warn + 0.1);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('2 回に 1 回、実を落としておばけの手下を出す', () => {
    const { w, e } = withBoss('oldTree', 80, 0);
    const before = w.enemies.filter((o) => o.alive && o.def.id === 'ghost').length;
    for (let k = 0; k < 2; k++) {
      e.cd = 0;
      step(w, still, 1 / 30);
    }
    expect(w.enemies.filter((o) => o.alive && o.def.id === 'ghost').length).toBe(before + TREE.brood);
  });
});

describe('大ヘビ', () => {
  const segs = (w: World) => w.enemies.filter((o) => o.alive && o.def.part);

  it('頭といっしょに体の節が出て、体は頭の通った道をなぞる', () => {
    const { w, e } = withBoss('bigSnake', 200, 0);
    expect(segs(w)).toHaveLength(SNAKE.segments);
    run(w, 3);
    const s = segs(w).sort((a, b) => a.state - b.state);
    expect(Math.hypot(s[0].x - e.x, s[0].y - e.y)).toBeLessThan(SNAKE.gap * 2);
    for (let k = 1; k < s.length; k++)
      expect(Math.hypot(s[k].x - s[k - 1].x, s[k].y - s[k - 1].y)).toBeLessThan(SNAKE.gap * 2);
  });

  it('体の節に当たると頭の体力が減り、節は倒れず数にも入らない', () => {
    const { w, e } = withBoss('bigSnake', 200, 0);
    const j = w.enemies.findIndex((o) => o.alive && o.def.part);
    const hp = e.hp;
    damageEnemy(w, j, 50, 0, 0);
    expect(e.hp).toBe(hp - 50);
    expect(w.enemies[j].alive).toBe(true);
    expect(w.kills).toBe(0);
  });

  it('同じ武器の同じ一撃が体の節にいくつ当たっても、頭の体力は 1 回分しか減らない', () => {
    const { w, e } = withBoss('bigSnake', 200, 0);
    const hp = e.hp;
    w.enemies.forEach((o, j) => {
      if (o.alive && o.def.part) damageEnemy(w, j, 10, 0, 0, false, 'woof');
    });
    expect(e.hp).toBe(hp - 10);
    step(w, still, 1 / 60);
    const j = w.enemies.findIndex((o) => o.alive && o.def.part);
    damageEnemy(w, j, 10, 0, 0, false, 'woof');
    expect(e.hp).toBe(hp - 20);
  });

  it('体の節に触れると痛い', () => {
    const { w } = withBoss('bigSnake', 200, 0);
    w.player.invuln = 1;
    step(w, still, 1 / 60);
    const s = segs(w)[3];
    w.player.x = s.x;
    w.player.y = s.y;
    w.player.invuln = 0;
    const hp = w.player.hp;
    step(w, still, 1 / 60);
    expect(w.player.hp).toBeLessThan(hp);
  });

  it('頭を倒すと体も消え、体の枠は使い回されない', () => {
    const { w, i, e } = withBoss('bigSnake', 200, 0);
    w.enemies.length = Math.max(w.enemies.length, 400);
    for (let k = 0; k < 400; k++)
      if (!w.enemies[k]?.alive)
        w.enemies[k] = { ...w.enemies[i], def: ENEMIES.rat, alive: true, x: 5000, y: 0 } as Enemy;
    const at = slot(w);
    expect(w.enemies[at].def.part).toBeFalsy();
    damageEnemy(w, i, e.hp + 1, 0, 0);
    expect(segs(w)).toHaveLength(0);
    expect(w.kills).toBe(1);
  });
});
