import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { spawnBosses } from './bosses';
import { collect } from './drops';
import { ENEMIES } from './enemies';
import { emptyRecords } from './records';
import { FOREST } from './stages/forest';
import { GRAVEYARD } from './stages/graveyard';
import {
  addEnemy,
  chiefOf,
  createWorld,
  damageEnemy,
  makeEnemy,
  MAX_ENEMIES,
  METAL_LIFE,
  spawnChiefs,
  spawnEvents,
  spawnMetal,
  step,
  summary,
  type World
} from './world';

const VIEW = { w: 274, h: 394 };

function quiet(): World {
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.spawnAcc = [];
  w.weapons = [];
  w.metalAt = -1;
  return w;
}

const alive = (w: World) => w.enemies.filter((e) => e.alive);

describe('1 分ごとの出来事', () => {
  it.each([FOREST, GRAVEYARD])('$name の出来事は 13〜16 個、75 秒より空かず、ボスとヌシの時刻を避ける', (s) => {
    expect(s.events.length).toBeGreaterThanOrEqual(13);
    expect(s.events.length).toBeLessThanOrEqual(16);
    let last = 0;
    for (const ev of s.events) {
      expect(ev.at - last).toBeGreaterThan(0);
      expect(ev.at - last).toBeLessThanOrEqual(75);
      last = ev.at;
      for (const t of [...s.bosses.map((b) => b.at), ...s.chiefs.map((c) => c.at)])
        expect(Math.abs(ev.at - t)).toBeGreaterThanOrEqual(15);
      expect(ENEMIES[ev.enemy]).toBeDefined();
    }
  });

  it('elites は金色の強化個体を片側からまとめて出す', () => {
    const w = quiet();
    w.stage.events = [{ at: 0, kind: 'elites', enemy: 'snake', count: 4, text: 'ヘビの精鋭が来た！' }];
    spawnEvents(w);
    const es = alive(w);
    expect(es).toHaveLength(4);
    expect(es.every((e) => e.def.elite && e.def.id === 'snake' && e.drift === 0)).toBe(true);
    expect(w.events).toContainEqual({ type: 'swarm', text: 'ヘビの精鋭が来た！' });
  });

  it('lanterns は自分の周りに 8 個のランタンを出す（ふだんの上限とは別）', () => {
    const w = quiet();
    w.stage.events = [{ at: 0, kind: 'lanterns', enemy: 'lantern', count: 8, text: 'ランタンが灯った！' }];
    spawnEvents(w);
    const es = alive(w);
    expect(es).toHaveLength(8);
    for (const e of es) {
      expect(e.def.prop).toBe(true);
      expect(e.hp).toBe(1);
      expect(Math.hypot(e.x, e.y)).toBeLessThan(VIEW.h / 2);
    }
  });
});

describe('ヌシ', () => {
  it('表の時刻に 3 倍の大きさで出て、帯に名前を出す', () => {
    const w = quiet();
    w.stage.chiefs = [{ at: 120, enemy: 'caterpillar', hp: 450 }];
    w.time = 119;
    spawnChiefs(w);
    expect(alive(w)).toHaveLength(0);
    w.time = 120;
    spawnChiefs(w);
    spawnChiefs(w);
    const [e] = alive(w);
    expect(alive(w)).toHaveLength(1);
    expect(e.def.chief).toBe(true);
    expect(e.def.r).toBe(ENEMIES.caterpillar.r * 3);
    expect(e.def.xp).toBe(ENEMIES.caterpillar.xp * 20);
    expect(e.def.heavy).toBe(1);
    expect(e.hp).toBe(450);
    expect(w.events).toContainEqual({ type: 'swarm', text: 'ヌシイモムシが現れた！' });
  });

  it('墓地のヌシも面の表の敵で出る', () => {
    expect(GRAVEYARD.chiefs.map((c) => c.enemy).every((id) => ['zombie', 'skeleton', 'ghost'].includes(id))).toBe(true);
    expect(FOREST.chiefs.map((c) => c.at)).toEqual([120, 240, 420, 540, 720]);
  });

  it('大きな体の縁に触れても痛い', () => {
    const w = quiet();
    w.propCd = 9999;
    w.player.x = 7.9;
    w.enemies[0] = makeEnemy(chiefOf(ENEMIES.croc), 37.9, 0, 999);
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.events.some((e) => e.type === 'hurt')).toBe(true);
  });

  it('倒すと宝箱を落とす', () => {
    const w = quiet();
    w.stage.chiefs = [{ at: 0, enemy: 'boar', hp: 10 }];
    spawnChiefs(w);
    damageEnemy(w, 0, 99, 0, 0);
    expect(w.items.some((o) => o.alive && o.kind === 'chest')).toBe(true);
  });

  it('十字架でヌシは残る', () => {
    const w = quiet();
    w.stage.chiefs = [{ at: 0, enemy: 'boar', hp: 10 }];
    spawnChiefs(w);
    w.enemies[0].x = 20;
    addEnemy(w, ENEMIES.rat, -20, 0);
    w.items.push({ alive: true, kind: 'cross', x: 0, y: 4, pulled: true });
    collect(w, 1 / 60);
    expect(alive(w).map((e) => e.def.chief ?? false)).toEqual([true]);
  });
});

describe('入れ物が埋まっているとき', () => {
  it('新しいヌシやボスは、遠くのヌシやきらきらハリネズミの枠を使わない', () => {
    const w = quiet();
    for (let i = 0; i < MAX_ENEMIES; i++) addEnemy(w, ENEMIES.rat, 10 + i * 0.01, 0);
    w.enemies[0] = makeEnemy(chiefOf(ENEMIES.croc), 5000, 0, 100);
    w.enemies[1] = makeEnemy(ENEMIES.metal, 4000, 0, 12);
    w.stage.chiefs = [{ at: 0, enemy: 'boar', hp: 10 }];
    spawnChiefs(w);
    w.metalAt = 0;
    spawnMetal(w);
    expect(w.enemies[0].def.id).toBe('croc');
    expect(w.enemies[1].def.metal).toBe(true);
    expect(w.enemies.filter((e) => e.alive && e.def.chief)).toHaveLength(2);
    expect(w.enemies.filter((e) => e.alive && e.def.metal)).toHaveLength(2);
  });
});

describe('面の主', () => {
  it.each([FOREST, GRAVEYARD])('$name は 13:00 に 2 体のボスが体力 1.5 倍でいっしょに出る', (s) => {
    const w = createWorld('dog', 1, VIEW, {}, s.id);
    w.stage = { ...w.stage, waves: [], events: [], chiefs: [] };
    w.metalAt = -1;
    const finale = s.bosses.filter((b) => b.at === 780);
    expect(finale.map((b) => b.id)).toEqual(s.bosses.filter((b) => b.at < 780).map((b) => b.id));
    w.bossNext = w.warned = s.bosses.findIndex((b) => b.at === 780);
    w.time = 777;
    spawnBosses(w);
    expect(w.events.filter((e) => e.type === 'warning')).toEqual([
      { type: 'warning', boss: finale[0].id, title: '面の主' }
    ]);
    w.time = 780;
    spawnBosses(w);
    const bosses = alive(w).filter((e) => e.def.boss);
    expect(bosses.map((e) => e.def.id)).toEqual(finale.map((b) => b.id));
    for (const e of bosses) expect(e.hp).toBe(ENEMIES[e.def.id].hp * 1.5);
    expect(w.warned).toBe(s.bosses.length);
  });
});

describe('実績', () => {
  it('「ボスを 2 体とも倒す」は面の主で同じボスを 2 回倒しても満ちない', () => {
    const a = ACHIEVEMENTS.find((d) => d.id === 'bothBosses')!;
    const run = summary(createWorld('dog', 1, VIEW));
    expect(a.done(emptyRecords(), { ...run, bosses: ['bear', 'bear'] })).toBe(false);
    expect(a.done(emptyRecords(), { ...run, bosses: ['bear', 'spiderQueen'] })).toBe(true);
  });
});

describe('きらきらハリネズミ', () => {
  it('種で 3 割ほどの回に、3〜12 分のどこかで出る', () => {
    let n = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const w = createWorld('dog', seed, VIEW);
      if (w.metalAt < 0) continue;
      n++;
      expect(w.metalAt).toBeGreaterThanOrEqual(180);
      expect(w.metalAt).toBeLessThanOrEqual(720);
    }
    expect(n).toBeGreaterThanOrEqual(250);
    expect(n).toBeLessThanOrEqual(350);
  });

  function hog() {
    const w = quiet();
    w.metalAt = 200;
    w.time = 200;
    spawnMetal(w);
    spawnMetal(w);
    expect(alive(w)).toHaveLength(1);
    expect(w.events).toContainEqual({ type: 'swarm', text: 'なにかがキラッと光った…' });
    return w;
  }

  it('どんな攻撃でも 1 しか減らない', () => {
    const w = hog();
    const e = w.enemies[0];
    expect(e.hp).toBe(12);
    damageEnemy(w, 0, 500, 0, 0);
    expect(e.hp).toBe(11);
    expect(e.alive).toBe(true);
  });

  it('自分から離れる向きへ逃げる', () => {
    const w = hog();
    const e = w.enemies[0];
    e.x = 40;
    e.y = 0;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(e.x).toBeGreaterThan(40);
  });

  it('ゲームの時間で 20 秒たつと去り、倒した数に入らない', () => {
    const w = hog();
    const e = w.enemies[0];
    e.x = 40;
    w.pending = 1;
    for (let i = 0; i < 60 * 30; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(e.alive).toBe(true);
    w.pending = 0;
    const metal = () => w.enemies.some((o) => o.alive && o.def.metal);
    for (let i = 0; i < 60 * (METAL_LIFE - 1); i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(metal()).toBe(true);
    for (let i = 0; i < 60 * 2; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(metal()).toBe(false);
    expect(w.kills).toBe(0);
  });

  it('倒すと大きな経験値の玉とコイン 100 枚ぶんを落とし、まとめと実績に入る', () => {
    const w = hog();
    for (let i = 0; i < 12; i++) damageEnemy(w, 0, 1, 0, 0);
    expect(w.enemies[0].alive).toBe(false);
    expect(w.gems.filter((g) => g.alive).reduce((t, g) => t + g.value, 0)).toBeGreaterThanOrEqual(300);
    expect(w.items.filter((o) => o.alive && o.kind === 'purse')).toHaveLength(2);
    const run = summary(w);
    expect(run.metal).toBe(true);
    const a = ACHIEVEMENTS.find((d) => d.id === 'metal')!;
    expect(a.coins).toBe(200);
    expect(a.done(emptyRecords(), run)).toBe(true);
    expect(a.done(emptyRecords(), { ...run, metal: false })).toBe(false);
  });

  it('十字架では 1 減るだけ', () => {
    const w = hog();
    const e = w.enemies[0];
    e.x = 20;
    e.y = 0;
    w.items.push({ alive: true, kind: 'cross', x: 0, y: 4, pulled: true });
    collect(w, 1 / 60);
    expect(e.alive).toBe(true);
    expect(e.hp).toBe(11);
  });
});
