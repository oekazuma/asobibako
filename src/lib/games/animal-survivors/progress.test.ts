import { describe, expect, it } from 'vitest';
import { animal } from './animals';
import { stats } from './passives';
import { emptyRecords, parseRecords } from './records';
import { UPGRADES, buy, perks, price } from './upgrades';
import { ACHIEVEMENTS, grant } from './achievements';
import { record } from './records';
import type { RunSummary } from './world';

const run = (o: Partial<RunSummary> = {}): RunSummary => ({
  animal: 'dog',
  cleared: false,
  time: 30,
  level: 1,
  kills: 0,
  xp: 0,
  weapons: [],
  passives: [],
  bosses: [],
  coins: 0,
  opened: 0,
  ...o
});

describe('店', () => {
  it('11 品あり、値段は基本の値段 × 次の段', () => {
    expect(UPGRADES.map((d) => d.id)).toEqual([
      'might',
      'maxHp',
      'speed',
      'armor',
      'regen',
      'magnet',
      'growth',
      'crit',
      'greed',
      'reroll',
      'revive'
    ]);
    const might = UPGRADES[0];
    expect(price(might, 0)).toBe(might.base);
    expect(price(might, 2)).toBe(might.base * 3);
  });

  it('買うとコインが減って段が上がる。足りない・最大の段なら何も変わらない', () => {
    const r = emptyRecords();
    r.coins = UPGRADES[0].base;
    expect(buy(r, 'might')).toBe(true);
    expect(r).toMatchObject({ coins: 0, ranks: { might: 1 } });
    expect(buy(r, 'might')).toBe(false);
    expect(r).toMatchObject({ coins: 0, ranks: { might: 1 } });
    r.coins = 1e6;
    r.ranks.revive = 1;
    expect(buy(r, 'revive')).toBe(false);
    expect(r.coins).toBe(1e6);
  });

  it('段が強さ・強欲・リロール・復活になる', () => {
    const p = perks({ might: 2, maxHp: 1, armor: 3, greed: 5, reroll: 2, revive: 1 });
    expect(p.boost.might).toBeCloseTo(0.1);
    expect(p.boost.maxHp).toBe(10);
    expect(p.boost.armor).toBe(3);
    expect(p.greed).toBeCloseTo(1.5);
    expect(p.rerolls).toBe(2);
    expect(p.revives).toBe(1);
    expect(perks({})).toEqual({ boost: {}, greed: 1, rerolls: 0, revives: 0 });
  });

  it('強化は動物の基本の値に足し、とくいとパッシブはその上に重なる', () => {
    const s = stats(animal('fox'), [{ id: 'fang', level: 1 }], { might: 0.1, crit: 0.04 });
    expect(s.might).toBeCloseTo(1 + 0.1 + 0.1);
    expect(s.crit).toBeCloseTo(0.05 + 0.1 + 0.04);
  });
});

describe('記録の拡張', () => {
  it('古い保存は足した項目を 0 と空で読み、解放した動物は残る', () => {
    const r = parseRecords(JSON.stringify({ best: 400, kills: 10, bosses: [], clears: 0, unlocked: ['fox'] }));
    expect(r).toMatchObject({ coins: 0, ranks: {}, achieved: [], clearedBy: [], chests: 0 });
    expect(r.unlocked).toContain('fox');
  });

  it('壊れた値は読み飛ばすか 0 にし、段は最大で止める', () => {
    const r = parseRecords(
      JSON.stringify({
        coins: -5,
        ranks: { might: 9, speed: 'x', revive: 1, nope: 3, armor: 2.7 },
        achieved: ['survive1', 7, 'nope'],
        clearedBy: ['dog', 'dragon'],
        chests: 'many'
      })
    );
    expect(r.coins).toBe(0);
    expect(r.ranks).toEqual({ might: 5, armor: 2, revive: 1 });
    expect(r.clearedBy).toEqual(['dog']);
    expect(r.chests).toBe(0);
  });
});

describe('実績', () => {
  it('23 個あり、id は重ならない', () => {
    expect(ACHIEVEMENTS).toHaveLength(23);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(23);
  });

  it('1 回の結果で記録を足し、達成した実績のコインと動物を渡す。同じ実績は 2 度渡さない', () => {
    const r = emptyRecords();
    const got = record(r, run({ time: 320, kills: 120, coins: 40 }));
    expect(got.map((a) => a.id)).toEqual(['survive1', 'survive5', 'run100']);
    expect(r.coins).toBe(40 + 10 + 50 + 20);
    expect(r.unlocked).toContain('fox');
    expect(record(r, run({ time: 320, kills: 120 }))).toEqual([]);
  });

  it('ごほうびで 7 匹がそろうと、同じ判定の中で「7 匹がそろう」も達成する', () => {
    const r = emptyRecords();
    r.unlocked = ['dog', 'cat', 'wolf', 'fox', 'bear', 'rabbit'];
    const got = record(r, run({ time: 900, cleared: true }));
    expect(got.map((a) => a.id)).toContain('clear');
    expect(got.map((a) => a.id)).toContain('allAnimals');
    expect(r.unlocked).toHaveLength(7);
  });

  it('動物ごとのクリアと宝箱の合計を数える', () => {
    const r = emptyRecords();
    record(r, run({ animal: 'cat', cleared: true, time: 900, opened: 4 }));
    record(r, run({ animal: 'cat', cleared: true, time: 900, opened: 6 }));
    expect(r.clearedBy).toEqual(['cat']);
    expect(r.chests).toBe(10);
    expect(r.achieved).toContain('chests10');
  });

  it('店の判定（run なし）では 1 回の実績を見ない', () => {
    const r = emptyRecords();
    r.ranks = { might: 5 };
    expect(grant(r, null).map((a) => a.id)).toEqual(['firstBuy', 'oneMax']);
  });

  it('合計の実績は途中経過を持つ', () => {
    const r = emptyRecords();
    r.kills = 1234;
    const total = ACHIEVEMENTS.find((a) => a.id === 'total3000')!;
    expect(total.progress!(r)).toEqual([1234, 3000]);
  });

  it('保存の知らない実績の id は読み飛ばす', () => {
    expect(parseRecords(JSON.stringify({ achieved: ['survive1', 'nope', 3] })).achieved).toEqual(['survive1']);
  });
});
