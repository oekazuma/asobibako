import { describe, expect, it, vi } from 'vitest';
import { obstaclesNear, type Ground } from './obstacles';
import { relicSpot, RELICS } from './relics';
import { BLESS_SECS, shrineAt, shrinesNear, touchShrines, type Shrine } from './shrines';
import { STAGES } from './stages';
import { openChest } from './chest';
import { collect } from './drops';
import { startEvent } from './events';
import { keepRelic, loadRecords, record, saveRecords } from './records';
import { hasRelic } from './relics';
import { addHero, createWorld, hurtPlayer, spawnProps, step, summary, type World } from './world';
import { power } from './arms';

const GROUNDS: Ground[] = ['forest', 'graveyard', 'snow', 'volcano'];

describe('遺物の置き場所', () => {
  it('ステージごとに 2 つで、全部で 8 つ', () => {
    expect(RELICS).toHaveLength(8);
    for (const s of STAGES) expect(RELICS.filter((r) => r.stage === s.id)).toHaveLength(2);
  });

  it('1 つめは 700 ドット、2 つめは 1500 ドットほど離れ、障害物の中に無い', () => {
    for (const s of STAGES) {
      const [a, b] = RELICS.filter((r) => r.stage === s.id).map((r) => relicSpot(r, s.art));
      expect(Math.hypot(a.x, a.y)).toBeGreaterThan(650);
      expect(Math.hypot(a.x, a.y)).toBeLessThan(760);
      expect(Math.hypot(b.x, b.y)).toBeGreaterThan(1430);
      expect(Math.hypot(b.x, b.y)).toBeLessThan(1570);
      for (const p of [a, b]) expect(obstaclesNear(s.art, p.x, p.y, 8, [])).toEqual([]);
    }
  });

  it('毎回同じ場所', () => {
    for (const r of RELICS) expect(relicSpot(r, 'forest')).toEqual(relicSpot(r, 'forest'));
  });
});

describe('祠の置き方', () => {
  it('およそ 10 区画に 1 つ（40 × 40 区画で 6〜15%）、5 種が出る', () => {
    for (const g of GROUNDS) {
      let n = 0;
      const kinds = new Set<string>();
      for (let cx = -20; cx < 20; cx++)
        for (let cy = -20; cy < 20; cy++) {
          const s = shrineAt(g, cx, cy);
          if (!s) continue;
          n++;
          kinds.add(s.kind);
        }
      expect(n / 1600).toBeGreaterThan(0.06);
      expect(n / 1600).toBeLessThan(0.15);
      expect(kinds.size).toBe(5);
    }
  });

  it('始めの位置から 120 ドットの中と、障害物の上には無い', () => {
    for (const g of GROUNDS) {
      expect(shrinesNear(g, 0, 0, 120, [])).toEqual([]);
      for (let cx = -15; cx < 15; cx++)
        for (let cy = -15; cy < 15; cy++) {
          const s = shrineAt(g, cx, cy);
          if (s) expect(obstaclesNear(g, s.x, s.y, 12, [])).toEqual([]);
        }
    }
  });

  it('区画の番号は祠ごとに違い、毎回同じ', () => {
    const keys = new Set<number>();
    for (let cx = -10; cx < 10; cx++)
      for (let cy = -10; cy < 10; cy++) {
        const s = shrineAt('forest', cx, cy);
        if (!s) continue;
        expect(keys.has(s.key)).toBe(false);
        keys.add(s.key);
        expect(shrineAt('forest', cx, cy)).toEqual(s);
      }
  });
});

const VIEW = { w: 260, h: 380 };

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    }
  };
}

const walkTo = (w: World, x: number, y: number) => {
  w.player.x = x;
  w.player.y = y;
  collect(w, 1 / 30);
};

describe('遺物を拾う', () => {
  it('まだ持っていない遺物だけを、決まった場所に置く', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { relics: ['map'] });
    const placed = w.items.filter((it) => it.alive && it.kind === 'relic').map((it) => it.relic);
    expect(placed).toEqual(['lamp']);
  });

  it('上を歩くと拾い、その回の効き目がすぐ出て、まとめに入る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest');
    const it = w.items.find((o) => o.kind === 'relic' && o.relic === 'map')!;
    walkTo(w, it.x, it.y);
    expect(it.alive).toBe(false);
    expect(hasRelic(w, 'map')).toBe(true);
    expect(w.events).toContainEqual({ type: 'relic', id: 'map' });
    expect(summary(w).relics).toEqual(['map']);
  });

  it('記録にすぐ書け、回の終わりの record() も古い写しで消さない', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const stale = loadRecords();
    keepRelic('map');
    expect(loadRecords().relics).toEqual(['map']);
    const w = createWorld('dog', 1, VIEW, {}, 'forest');
    const it = w.items.find((o) => o.kind === 'relic' && o.relic === 'map')!;
    walkTo(w, it.x, it.y);
    w.over = 'dead';
    record(stale, summary(w));
    // 回の終わりは手元の写しを保存する。写しが遺物を持っていなくても、回のまとめから足して消さない
    saveRecords(stale);
    expect(loadRecords().relics).toEqual(['map']);
    vi.unstubAllGlobals();
  });

  it('魔法のランプでランタンが 6 つまで灯る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { relics: ['lamp'] });
    for (let i = 0; i < 40; i++) spawnProps(w, 3);
    expect(w.enemies.filter((e) => e.alive && e.def.prop).length).toBe(6);
  });

  it('古い懐中時計で時計の品の止まる時間が 2 秒のびる', () => {
    const a = createWorld('dog', 1, VIEW, {}, 'graveyard');
    const b = createWorld('dog', 1, VIEW, {}, 'graveyard', { relics: ['watch'] });
    for (const w of [a, b]) {
      w.items.push({ alive: true, kind: 'clock', x: w.player.x, y: w.player.y, pulled: false });
      collect(w, 1 / 30);
    }
    expect(b.freeze - a.freeze).toBeCloseTo(2);
  });

  it('銀の鈴で宝の地図の宝箱が 10 秒長く残る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'graveyard', { relics: ['bell'] });
    startEvent(w, { at: 0, kind: 'treasure', enemy: '', count: 0, text: '' });
    expect(w.treasure!.life).toBe(40);
  });

  it('雪の結晶で引き直しが 1 回ふえ、その回に拾っても 1 回ふえる', () => {
    const a = createWorld('dog', 1, VIEW, {}, 'snow');
    const b = createWorld('dog', 1, VIEW, {}, 'snow', { relics: ['flake'] });
    expect(b.rerolls - a.rerolls).toBe(1);
    const it = a.items.find((o) => o.kind === 'relic' && o.relic === 'flake')!;
    const before = a.rerolls;
    walkTo(a, it.x, it.y);
    expect(a.rerolls).toBe(before + 1);
  });

  it('炎の宝玉で宝箱の中身が 1 つになる割合が 1 割下がる', () => {
    const count = (relics: 'orb'[]) => {
      let ones = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const w = createWorld('dog', seed, VIEW, {}, 'volcano', { relics });
        w.chests = 1;
        if (openChest(w).length === 1) ones++;
      }
      return ones / 400;
    };
    expect(count([]) - count(['orb'])).toBeGreaterThan(0.06);
  });

  it('黒曜石のかけらで溶岩の池のダメージが半分になる', () => {
    const a = createWorld('dog', 1, VIEW, {}, 'volcano');
    const b = createWorld('dog', 1, VIEW, {}, 'volcano', { relics: ['shard'] });
    for (const w of [a, b]) {
      w.player.hp = 100;
      hurtPlayer(w, 20, 'lava');
    }
    expect(100 - b.player.hp).toBeCloseTo((100 - a.player.hp) / 2, 0);
  });
});

function shrineOf(kind: string): Shrine {
  for (let c = 1; c < 400; c++)
    for (const [cx, cy] of [
      [c, 0],
      [0, c],
      [-c, 0],
      [0, -c],
      [c, c]
    ]) {
      const s = shrineAt('forest', cx, cy);
      if (s?.kind === kind) return s;
    }
  throw new Error(kind);
}

const quiet = (relics: 'mirror'[] = []) => {
  const w = createWorld('dog', 1, VIEW, {}, 'forest', { relics });
  w.stage = { ...w.stage, waves: [], bosses: [], chiefs: [], events: [] };
  w.metalAt = -1;
  w.propCd = 1e9;
  return w;
};

describe('祠', () => {
  it('力の祠: 触れると 30 秒攻撃 +30% で、祠は消える', () => {
    const w = quiet();
    const s = shrineOf('power');
    Object.assign(w.player, { x: s.x, y: s.y });
    const before = power(w, 10).dmg;
    touchShrines(w);
    expect(w.blessing.might).toBe(BLESS_SECS);
    expect(w.shrinesUsed).toContain(s.key);
    w.stats.crit = 0;
    expect(power(w, 10).dmg).toBeCloseTo(before * 1.3);
    w.blessing.might = 0;
    touchShrines(w);
    expect(w.blessing.might).toBe(0);
  });

  it('風の祠で速くなり、知恵の祠で拾う経験値が 2 倍', () => {
    const w = quiet();
    const wind = shrineOf('wind');
    Object.assign(w.player, { x: wind.x, y: wind.y });
    touchShrines(w);
    const x0 = w.player.x;
    step(w, { x: 1, y: 0 }, 0.1);
    expect(w.player.x - x0).toBeCloseTo(60 * w.stats.speed * 1.3 * 0.1, 1);
    const wis = shrineOf('wisdom');
    Object.assign(w.player, { x: wis.x, y: wis.y });
    touchShrines(w);
    // Lv が上がると xp は引かれるので、合計で見る
    const xp = w.xpTotal;
    w.gems.push({ alive: true, x: w.player.x, y: w.player.y, value: 5, pulled: false });
    collect(w, 1 / 30);
    expect(w.xpTotal - xp).toBe(10 * w.stats.growth);
  });

  it('宝の祠はその場に宝箱、癒しの祠は全快', () => {
    const w = quiet();
    const t = shrineOf('treasure');
    Object.assign(w.player, { x: t.x, y: t.y });
    touchShrines(w);
    expect(w.items.some((it) => it.alive && it.kind === 'chest')).toBe(true);
    const h = shrineOf('heal');
    w.player.hp = 1;
    Object.assign(w.player, { x: h.x, y: h.y });
    touchShrines(w);
    expect(w.player.hp).toBe(w.stats.maxHp);
  });

  it('ご利益の時計は step で減り、続けて触れると残りがのび、氷の鏡で 1.5 倍', () => {
    const w = quiet(['mirror']);
    const s = shrineOf('power');
    Object.assign(w.player, { x: s.x, y: s.y });
    touchShrines(w);
    expect(w.blessing.might).toBe(BLESS_SECS * 1.5);
    step(w, { x: 0, y: 0 }, 1);
    expect(w.blessing.might).toBeCloseTo(BLESS_SECS * 1.5 - 1);
  });

  it('2 匹が同じフレームで触れても、ご利益は 1 匹だけで、祠は 1 回で消える', () => {
    const w = quiet();
    addHero(w, 'cat');
    const s = shrineOf('power');
    for (const h of w.heroes) Object.assign(h.player, { x: s.x, y: s.y });
    step(w, { x: 0, y: 0 }, 1 / 60);
    const got = w.heroes.filter((h) => h.blessing.might > 0).length;
    expect(got).toBe(1);
    expect(w.shrinesUsed.filter((k) => k === s.key)).toHaveLength(1);
  });
});

describe('見直しで直したこと', () => {
  it('肉が出ない回は、癒しの祠で回復しない', () => {
    const w = quiet();
    w.mods.push('noMeat');
    const h = shrineOf('heal');
    w.player.hp = 1;
    Object.assign(w.player, { x: h.x, y: h.y });
    touchShrines(w);
    expect(w.player.hp).toBe(1);
  });

  it('道具なしの回は、雪の結晶で引き直しがふえない', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'snow');
    w.mods.push('noTools');
    w.rerolls = 0;
    const it = w.items.find((o) => o.kind === 'relic' && o.relic === 'flake')!;
    walkTo(w, it.x, it.y);
    expect(w.rerolls).toBe(0);
  });

  it('雪の結晶を持っていれば、協力プレイの 2 匹めにも引き直しが 1 回ふえる', () => {
    const a = createWorld('dog', 1, VIEW, {}, 'snow');
    const b = createWorld('dog', 1, VIEW, {}, 'snow', { relics: ['flake'] });
    addHero(a, 'cat');
    addHero(b, 'cat');
    expect(b.heroes[1].rerolls - a.heroes[1].rerolls).toBe(1);
  });

  it('時計の品で止まっているあいだは、ご利益の時計も減らない', () => {
    const w = quiet();
    w.blessing.might = 10;
    w.freeze = 5;
    step(w, { x: 0, y: 0 }, 1);
    expect(w.blessing.might).toBe(10);
  });
});
