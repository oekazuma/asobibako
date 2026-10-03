import { describe, expect, it } from 'vitest';
import { openChest } from './chest';
import { choices } from './choices';
import { dailyBonus, makeDaily, MODS, todayKey, type ModId } from './daily';
import { dropLoot } from './drops';
import { FOREST } from './stages/forest';
import { UPGRADES } from './upgrades';
import { overtimeRun, startOvertime } from './overtime';
import { emptyRecords, ensureDaily, parseRecords, record } from './records';
import { createWorld, summary, type World } from './world';

const VIEW = { w: 274, h: 394 };
const MAX = Object.fromEntries(UPGRADES.map((d) => [d.id, d.max]));
const withMods = (mods: ModId[], ranks = {}, stage = 'forest') =>
  createWorld('dog', 1, VIEW, ranks, stage, { date: '2026-10-03', bonus: 500, mods });

describe('お題の作り方', () => {
  it('日付は端末の日付の YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('同じ日付と候補なら同じお題で、日付が変わると変わる。動物と面は候補から', () => {
    const animals = ['dog', 'cat', 'wolf', 'fox'] as const;
    const a = makeDaily('2026-10-03', [...animals], ['forest', 'graveyard']);
    expect(makeDaily('2026-10-03', [...animals], ['forest', 'graveyard'])).toEqual(a);
    const days = Array.from({ length: 30 }, (_, i) =>
      makeDaily(`2026-11-${String(i + 1).padStart(2, '0')}`, [...animals], ['forest', 'graveyard'])
    );
    expect(new Set(days.map((d) => `${d.animal}-${d.stage}-${d.mods.join()}`)).size).toBeGreaterThan(20);
    for (const d of days) {
      expect(animals).toContain(d.animal);
      expect(['forest', 'graveyard']).toContain(d.stage);
      expect(d.mods).toHaveLength(2);
      expect(d.mods[0]).not.toBe(d.mods[1]);
      expect(MODS[d.mods[0]].good).toBeFalsy();
      expect(d.cleared).toBe(false);
    }
  });

  it('ごほうびは (200 + しばりのコイン) × 面の倍率を 10 単位に丸め、200 を下回らない', () => {
    const d = { date: 'x', animal: 'dog' as const, cleared: false };
    expect(dailyBonus({ ...d, stage: 'forest', mods: ['noShop', 'tough'] })).toBe(700);
    expect(dailyBonus({ ...d, stage: 'graveyard', mods: ['swarm', 'noTools'] })).toBe(680);
    expect(dailyBonus({ ...d, stage: 'snow', mods: ['noShop', 'oneWeapon'] })).toBe(1600);
    expect(dailyBonus({ ...d, stage: 'forest', mods: ['noTools', 'growth'] })).toBe(200);
  });
});

describe('しばり', () => {
  it('敵が強いしばりは写した面の表で効き、元の表は変わらない', () => {
    const w = withMods(['tough', 'fury']);
    expect(w.stage.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.3);
    expect(w.stage.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.4);
    const s = withMods(['swarm', 'bossHp']);
    expect(s.stage.waves[0].rate[1]).toBeCloseTo(FOREST.waves[0].rate[1] * 1.4);
    expect(s.stage.bosses[0].hp).toBeCloseTo((FOREST.bosses[0].hp ?? 1) * 1.6);
    expect(FOREST.toughness(300)).toBeCloseTo(1 + (300 / 900) * 6.5);
    expect(FOREST.bosses[0].hp).toBe(0.6);
    expect(createWorld('dog', 1, VIEW).stage).toBe(FOREST);
  });

  it('店の強化なしは店の強化も道具も入らない', () => {
    const plain = createWorld('dog', 1, VIEW, MAX);
    const w = withMods(['noShop'], MAX);
    expect(w.stats.maxHp).toBeLessThan(plain.stats.maxHp);
    expect(w.revives).toBe(0);
    expect(w.greed).toBe(1);
  });

  it('HP 半分・道具なし・経験値 2 倍・攻撃 +30%', () => {
    const plain = createWorld('dog', 1, VIEW, MAX);
    const w = withMods(['halfHp', 'noTools'], MAX);
    expect(w.stats.maxHp).toBeCloseTo(plain.stats.maxHp / 2);
    expect(w.player.hp).toBeCloseTo(w.stats.maxHp);
    expect([w.rerolls, w.skips, w.banishes]).toEqual([0, 0, 0]);
    const g = withMods(['growth', 'might']);
    expect(g.stats.growth).toBeCloseTo(2);
    expect(g.stats.might).toBeCloseTo(createWorld('dog', 1, VIEW).stats.might + 0.3);
  });

  it('肉が出ないしばりでは、ランタン・宝箱・3 択の埋め草にも肉が出ない', () => {
    const w = withMods(['noMeat']);
    for (let i = 0; i < 300; i++) dropLoot(w, i, 0);
    expect(w.items.some((o) => o.alive && o.kind === 'meat')).toBe(false);
    w.weapons = [{ id: w.weapons[0].id, level: 5, cd: 0 }];
    w.passives = [];
    for (let i = 0; i < 5; i++) {
      w.chests = 1;
      expect(openChest(w).some((r) => r.kind === 'meat')).toBe(false);
    }
    // 武器もパッシブも取りきって候補が無いとき
    w.weapons = [];
    w.banished = [];
    w.passives = [];
    const all = choices(w, 40);
    expect(all.some((c) => c.kind === 'meat')).toBe(false);
  });

  it('武器は最初の 1 つだけのしばりでは、3 択に新しい武器が出ない', () => {
    const w = withMods(['oneWeapon']);
    for (let i = 0; i < 30; i++)
      for (const c of choices(w)) if (c.kind === 'weapon') expect(c.id).toBe(w.weapons[0].id);
  });

  it('お題の回のまとめに日付とごほうび、ふつうの回には無い', () => {
    expect(summary(withMods(['tough'])).daily).toEqual({ date: '2026-10-03', bonus: 500 });
    expect(summary(createWorld('dog', 1, VIEW)).daily).toBeUndefined();
    expect(createWorld('dog', 1, VIEW).mods).toEqual([]);
  });
});

const DAY = new Date(2026, 9, 3, 10);
const NEXT = new Date(2026, 9, 4, 10);

/** その日のお題でクリアした回 */
function clearedRun(r: ReturnType<typeof emptyRecords>): World {
  const d = r.daily!;
  const w = createWorld(d.animal, 1, VIEW, {}, d.stage, { date: d.date, bonus: dailyBonus(d), mods: d.mods });
  w.over = 'clear';
  return w;
}

describe('お題の記録', () => {
  it('同じ日に仲間が増えてもお題は同じで、次の日は作り直す', () => {
    const r = emptyRecords();
    const d = ensureDaily(r, DAY);
    expect(d.date).toBe('2026-10-03');
    expect(['dog', 'cat', 'wolf']).toContain(d.animal);
    expect(d.stage).toBe('forest');
    r.unlocked.push('fox');
    r.stages.push('forest');
    expect(ensureDaily(r, DAY)).toBe(d);
    expect(ensureDaily(r, NEXT).date).toBe('2026-10-04');
  });

  it('その日に初めてクリアした回だけごほうびが入り、2 回めは入らない', () => {
    const r = emptyRecords();
    ensureDaily(r, DAY);
    const w = clearedRun(r);
    const first = summary(w);
    const before = r.coins;
    record(r, first);
    expect(first.daily?.paid).toBe(true);
    expect(r.daily!.cleared).toBe(true);
    expect(r.dailyDays).toBe(1);
    expect(r.coins - before - first.coins).toBeGreaterThanOrEqual(dailyBonus(r.daily!));
    const again = summary(clearedRun(r));
    const mid = r.coins;
    record(r, again);
    expect(again.daily?.paid).toBeUndefined();
    expect(r.coins - mid).toBe(again.coins + (again.bookCoins ?? 0));
    expect(r.dailyDays).toBe(1);
  });

  it('倒れた回、延長戦の 2 回めの記録、前の日のお題の回では入らない', () => {
    const r = emptyRecords();
    ensureDaily(r, DAY);
    const dead = clearedRun(r);
    dead.over = 'dead';
    record(r, summary(dead));
    expect(r.daily!.cleared).toBe(false);
    const w = clearedRun(r);
    record(r, summary(w));
    startOvertime(w);
    w.over = 'dead';
    const ot = overtimeRun(w);
    record(r, ot);
    expect(ot.daily?.paid).toBeUndefined();
    expect(r.dailyDays).toBe(1);
    const old = clearedRun(r);
    ensureDaily(r, NEXT);
    const run = summary(old);
    record(r, run);
    expect(run.daily?.paid).toBeUndefined();
    expect(r.daily!.cleared).toBe(false);
  });

  it('壊れたお題は捨て、正しいお題は読み戻す', () => {
    const good = { date: '2026-10-03', animal: 'cat', stage: 'forest', mods: ['tough', 'growth'], cleared: true };
    expect(parseRecords(JSON.stringify({ daily: good, dailyDays: 3 })).daily).toEqual(good);
    expect(parseRecords(JSON.stringify({ daily: good, dailyDays: 3 })).dailyDays).toBe(3);
    for (const bad of [{ ...good, mods: ['nope', 'tough'] }, { ...good, stage: 'moon' }, { ...good, animal: 7 }, 'x'])
      expect(parseRecords(JSON.stringify({ daily: bad })).daily).toBeNull();
    expect(emptyRecords().daily).toBeNull();
  });

  it('お題を 1 日と 7 日クリアすると実績', () => {
    const r = emptyRecords();
    ensureDaily(r, DAY);
    expect(record(r, summary(clearedRun(r))).map((a) => a.id)).toContain('daily1');
    r.dailyDays = 6;
    ensureDaily(r, NEXT);
    expect(record(r, summary(clearedRun(r))).map((a) => a.id)).toContain('daily7');
  });
});
