import { describe, expect, it, vi } from 'vitest';
import { obstaclesNear, type Ground } from './obstacles';
import { relicSpot, RELICS } from './relics';
import { shrineAt, shrinesNear } from './shrines';
import { STAGES } from './stages';
import { openChest } from './chest';
import { collect } from './drops';
import { startEvent } from './events';
import { keepRelic, loadRecords, record } from './records';
import { hasRelic } from './relics';
import { createWorld, hurtPlayer, spawnProps, summary, type World } from './world';

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
