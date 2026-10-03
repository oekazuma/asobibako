import { describe, expect, it } from 'vitest';
import { updateHazards, type Hazard } from './bosses';
import { collect, dropGem, MAX_GEMS } from './drops';
import { ENEMIES } from './enemies';
import { FESTIVAL, METEOR_EVERY, METEOR_TIME, TREASURE_LIFE } from './events';
import { Prompts } from './prompts.svelte';
import { FOREST } from './stages/forest';
import { GRAVEYARD } from './stages/graveyard';
import { SNOW } from './stages/snow';
import { createWorld, damageEnemy, eliteOf, makeEnemy, spawnEvents, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };
const NEW = ['treasure', 'meteor', 'festival'];

function quiet(kind?: string): World {
  const w = createWorld('dog', 3, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], chiefs: [], storms: [], events: [] };
  if (kind)
    w.stage.events = FOREST.events
      .filter((e) => e.kind === kind)
      .slice(0, 1)
      .map((e) => ({ ...e, at: 0 }));
  w.spawnAcc = [];
  w.weapons = [];
  w.metalAt = -1;
  w.propCd = 1e9;
  w.player.hp = w.stats.maxHp = 1e6;
  return w;
}

describe('新しい出来事の表', () => {
  it('森に 6 行が表の時刻で入り、ボスとヌシから 13 秒以上離れている', () => {
    const rows = FOREST.events.filter((e) => NEW.includes(e.kind));
    expect(rows.map((e) => [e.kind, e.at])).toEqual([
      ['meteor', 47],
      ['treasure', 167],
      ['festival', 287],
      ['meteor', 347],
      ['festival', 407],
      ['treasure', 467]
    ]);
    for (const e of rows)
      for (const t of [...FOREST.bosses.map((b) => b.at), ...FOREST.chiefs.map((c) => c.at)])
        expect(Math.abs(e.at - t)).toBeGreaterThanOrEqual(13);
  });

  it('墓地と雪山にも同じ時刻で入っている', () => {
    for (const s of [GRAVEYARD, SNOW])
      expect(s.events.filter((e) => NEW.includes(e.kind)).map((e) => e.at)).toEqual([47, 167, 287, 347, 407, 467]);
  });
});

describe('宝の地図', () => {
  it('遠くに宝箱を置いて帯を出し、30 秒で消える', () => {
    const w = quiet('treasure');
    spawnEvents(w);
    const t = w.treasure!;
    expect(t.kind).toBe('chest');
    const d = Math.hypot(t.x - w.player.x, t.y - w.player.y);
    expect(d).toBeGreaterThanOrEqual(350);
    expect(d).toBeLessThanOrEqual(450);
    expect(w.events).toContainEqual({ type: 'swarm', text: '宝の地図を見つけた！' });
    for (let i = 0; i < 60 * (TREASURE_LIFE - 1); i++) step(w, still, 1 / 60);
    expect(t.alive).toBe(true);
    for (let i = 0; i < 60 * 2; i++) step(w, still, 1 / 60);
    expect(t.alive).toBe(false);
    expect(w.treasure).toBeNull();
  });

  it('たどり着けば宝箱が開き、3 択のあいだは時計が進まない', () => {
    const w = quiet('treasure');
    spawnEvents(w);
    const t = w.treasure!;
    w.pending = 1;
    for (let i = 0; i < 60 * 40; i++) step(w, still, 1 / 60);
    expect(t.alive).toBe(true);
    w.pending = 0;
    w.player.x = t.x;
    w.player.y = t.y;
    step(w, still, 1 / 60);
    expect(w.chests).toBe(1);
    w.chests = 0;
    step(w, still, 1 / 60);
    expect(w.treasure).toBeNull();
  });

  it('時計で止まっているあいだに拾っても、空いた場所に入った品を宝の地図の宝箱と取り違えない', () => {
    const w = quiet('treasure');
    spawnEvents(w);
    const t = w.treasure!;
    w.freeze = 10;
    w.player.x = t.x;
    w.player.y = t.y;
    step(w, still, 1 / 60);
    expect(w.chests).toBe(1);
    expect(w.treasure).toBeNull();
    w.chests = 0;
    w.enemies[0] = makeEnemy(eliteOf(ENEMIES.rat), 0, 0, 1);
    damageEnemy(w, 0, 9, 0, 0);
    for (const o of w.items) expect(o.life).toBeUndefined();
  });

  it('ほかの宝箱は寿命を持たず消えない', () => {
    const w = quiet();
    w.items.push({ alive: true, kind: 'chest', x: 300, y: 0, pulled: false });
    for (let i = 0; i < 60 * 60; i++) step(w, still, 1 / 60);
    expect(w.items[0].alive).toBe(true);
  });
});

describe('流れ星', () => {
  it('10 秒で 20 個の予告が出て、1.2 秒後に円の中だけが痛く、敵も削り、跡に経験値の玉を残す', () => {
    const w = quiet('meteor');
    spawnEvents(w);
    let marks = 0;
    const seen = new Set<Hazard>();
    for (let i = 0; i < 60 * (METEOR_TIME + 2); i++) {
      // 跡の玉でレベルが上がっても止まらないよう、3 択は開いたら閉じる
      w.pending = 0;
      step(w, still, 1 / 60);
      for (const h of w.hazards)
        if (h.alive && h.kind === 'meteor' && !seen.has(h)) {
          seen.add(h);
          marks++;
        }
      // 使い回された予告も数えるため、落ちたら印を外す
      for (const h of seen) if (!h.alive) seen.delete(h);
    }
    expect(marks).toBe(METEOR_TIME / METEOR_EVERY);
    expect(w.gems.filter((g) => g.alive).length).toBeGreaterThan(0);
  });

  it('円の中にいると痛く、中の敵が削れ、外は無事', () => {
    const w = quiet();
    w.player.invuln = 0;
    w.enemies[0] = makeEnemy(ENEMIES.croc, 10, 0, 9999);
    w.enemies[1] = makeEnemy(ENEMIES.croc, 200, 0, 9999);
    w.hazards.push({
      alive: true,
      kind: 'meteor',
      owner: -1,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 22,
      delay: 0.01,
      life: 0.3,
      dmg: 20
    });
    const before = w.player.hp;
    updateHazards(w, 1 / 60);
    expect(w.player.hp).toBeLessThan(before);
    expect(w.enemies[0].hp).toBeLessThan(9999);
    expect(w.enemies[1].hp).toBe(9999);
    expect(w.gems.some((g) => g.alive && Math.hypot(g.x, g.y) < 1)).toBe(true);
  });

  it('玉が 400 個あるときは遠い玉に値を足す', () => {
    const w = quiet();
    for (let i = 0; i < MAX_GEMS; i++) dropGem(w, 500 + i, 0, 1);
    w.hazards.push({
      alive: true,
      kind: 'meteor',
      owner: -1,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 22,
      delay: 0.01,
      life: 0.3,
      dmg: 20
    });
    updateHazards(w, 1 / 60);
    expect(w.gems.filter((g) => g.alive)).toHaveLength(MAX_GEMS);
    expect(Math.max(...w.gems.map((g) => g.value))).toBeGreaterThan(1);
  });

  it('時計で止まっているあいだは降らず、出ている予告も落ちない', () => {
    const w = quiet('meteor');
    spawnEvents(w);
    step(w, still, 0.6);
    const n = w.hazards.filter((h) => h.alive).length;
    w.freeze = 5;
    for (let i = 0; i < 60 * 3; i++) step(w, still, 1 / 60);
    expect(w.hazards.filter((h) => h.alive)).toHaveLength(n);
    expect(w.hazards.every((h) => !h.alive || h.delay > 0)).toBe(true);
  });
});

describe('お祭り', () => {
  it('20 秒のあいだ、玉の経験値とコイン 1 枚が 2 倍になり、大袋は変わらない', () => {
    const w = quiet('festival');
    spawnEvents(w);
    expect(w.festival).toBe(FESTIVAL);
    w.gems.push({ alive: true, x: 0, y: 0, value: 3, pulled: true });
    w.items.push(
      { alive: true, kind: 'coin', x: 0, y: 4, pulled: true },
      { alive: true, kind: 'purse', x: 0, y: 4, pulled: true }
    );
    const xp = w.xpTotal;
    collect(w, 1 / 60);
    expect(w.xpTotal - xp).toBeCloseTo(6);
    expect(w.coins).toBe(2 + 50);
  });

  it('お祭りのあいだはふつうの敵の出る数が 2 倍で、20 秒で戻る', () => {
    const count = (fest: boolean) => {
      const w = createWorld('dog', 3, VIEW);
      w.stage = { ...w.stage, bosses: [], chiefs: [], events: [], storms: [] };
      w.metalAt = -1;
      w.weapons = [];
      w.player.hp = w.stats.maxHp = 1e9;
      w.time = 100;
      if (fest) w.festival = FESTIVAL;
      for (let i = 0; i < 60 * 5; i++) step(w, still, 1 / 60);
      return w.enemies.filter((e) => e.alive && !e.def.prop).length;
    };
    expect(count(true)).toBeGreaterThan(count(false) * 1.6);
    const w = quiet('festival');
    spawnEvents(w);
    for (let i = 0; i < 60 * (FESTIVAL + 1); i++) step(w, still, 1 / 60);
    expect(w.festival).toBe(0);
  });

  it('帯の文', () => {
    const w = quiet('festival');
    const p = new Prompts(w);
    spawnEvents(w);
    p.take();
    expect(p.notice?.text).toBe('お祭りだ！ 経験値とコイン 2 倍');
  });
});
