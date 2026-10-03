import { describe, expect, it } from 'vitest';
import { animal } from './animals';
import { stats } from './passives';
import { emptyRecords, parseRecords } from './records';
import { UPGRADES, buy, perks, price } from './upgrades';
import { ACHIEVEMENTS, grant } from './achievements';
import { canPlay, record } from './records';
import { createWorld, damageEnemy, eliteOf, hurtPlayer, makeEnemy, step, summary, type RunSummary } from './world';
import { collect } from './drops';
import { openChest } from './chest';
import { levelUp } from './choices';
import { ENEMIES } from './enemies';

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
  evolved: [],
  dealt: [],
  stage: 'forest',
  form: 0,
  metal: false,
  finale: false,
  book: { kills: {}, elites: [], chiefs: [], bosses: [], forms: [], items: [] },
  ...o
});

describe('店', () => {
  it('16 品あり、値段は基本の値段 × 次の段', () => {
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
      'revive',
      'amount',
      'duration',
      'luck',
      'skip',
      'banish'
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
    expect(perks({})).toEqual({ boost: {}, greed: 1, rerolls: 0, revives: 0, skips: 0, banishes: 0 });
  });

  it('強化は動物の基本の値に足し、とくいとパッシブはその上に重なる', () => {
    const s = stats(animal('fox'), [{ id: 'fang', level: 1 }], { might: 0.1, crit: 0.04 });
    expect(s.might).toBeCloseTo(1.05 + 0.1 + 0.1);
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
  it('33 個あり、id は重ならない', () => {
    expect(ACHIEVEMENTS).toHaveLength(33);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(33);
  });

  it('1 回の結果で記録を足し、達成した実績のコインと動物を渡す。同じ実績は 2 度渡さない', () => {
    const r = emptyRecords();
    const got = record(r, run({ time: 320, kills: 120, coins: 40 }));
    expect(got.map((a) => a.id)).toEqual(['survive1', 'survive5', 'run100']);
    expect(r.coins).toBe(40 + 10 + 50 + 20);
    expect(r.unlocked).not.toContain('fox');
    expect(record(r, run({ time: 320, kills: 120 }))).toEqual([]);
  });

  it('ごほうびで 9 匹がそろうと、同じ判定の中で「9 匹がそろう」も達成する', () => {
    const r = emptyRecords();
    r.unlocked = ['dog', 'cat', 'wolf', 'fox', 'bear', 'rabbit', 'panda', 'tiger'];
    const got = record(r, run({ time: 900, cleared: true, stage: 'snow' }));
    expect(got.map((a) => a.id)).toContain('snowClear');
    expect(got.map((a) => a.id)).toContain('allAnimals');
    expect(r.unlocked).toHaveLength(9);
  });

  it('もう仲間の動物は、実績を後から達成しても新しく仲間になったことにしない', () => {
    const r = parseRecords(JSON.stringify({ best: 400, unlocked: ['fox'] }));
    const got = record(r, run({ time: 900, cleared: true }));
    expect(got.map((a) => a.id)).toContain('clear');
    expect(got.flatMap((a) => (a.animal ? [a.animal] : []))).toEqual([]);
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

  it('進化を記録し、はじめての進化と 12 種すべての実績を渡す', () => {
    const r = emptyRecords();
    const got = record(r, run({ evolved: ['woofEvo'] }));
    expect(r.evolved).toEqual(['woofEvo']);
    expect(got.map((a) => a.id)).toContain('evolve1');
    const all = ACHIEVEMENTS.find((a) => a.id === 'evolveAll')!;
    expect(all.progress!(r)).toEqual([1, 12]);
    expect(parseRecords(JSON.stringify({ evolved: ['woofEvo', 'nope', 'woofEvo'] })).evolved).toEqual(['woofEvo']);
  });

  it('保存の知らない実績の id は読み飛ばす', () => {
    expect(parseRecords(JSON.stringify({ achieved: ['survive1', 'nope', 3] })).achieved).toEqual(['survive1']);
  });
});

const VIEW = { w: 260, h: 380 };

describe('ゲームの中の積み上げ', () => {
  it('店の段が始めの強さ・強欲・リロール・復活に入る', () => {
    const w = createWorld('dog', 1, VIEW, { maxHp: 2, greed: 1, reroll: 2, revive: 1 });
    expect(w.stats.maxHp).toBe(animal('dog').hp + 20);
    expect(w.player.hp).toBe(w.stats.maxHp);
    expect(w.greed).toBeCloseTo(1.1);
    expect([w.rerolls, w.revives]).toEqual([2, 1]);
  });

  it('レベルアップでパッシブを取っても店の強化は残る', () => {
    const w = createWorld('dog', 1, VIEW, { might: 2 });
    levelUp(w, { kind: 'passive', id: 'fang', level: 1 });
    expect(w.stats.might).toBeCloseTo(animal('dog').might + 0.1 + 0.1);
  });

  it('強化個体は必ずコインを 5 枚、ボスは大袋を落とす', () => {
    const w = createWorld('dog', 1, VIEW);
    w.enemies.push(makeEnemy(eliteOf(ENEMIES.rat), 100, 0, 1));
    damageEnemy(w, 0, 99, 0, 0);
    expect(w.items.filter((i) => i.alive && i.kind === 'coin')).toHaveLength(5);
    w.enemies.push(makeEnemy(ENEMIES.bear, 100, 0, 1));
    damageEnemy(w, 1, 99, 0, 0);
    expect(w.items.filter((i) => i.alive && i.kind === 'purse')).toHaveLength(1);
  });

  it('コインを拾うと強欲を掛けて数え、出来事を出す', () => {
    const w = createWorld('dog', 1, VIEW, { greed: 5 });
    w.items.push({ alive: true, kind: 'coin', x: 0, y: 0, pulled: false });
    w.items.push({ alive: true, kind: 'purse', x: 0, y: 0, pulled: false });
    collect(w, 1 / 60);
    expect(summary(w).coins).toBe(Math.floor(51 * 1.5));
    expect(w.events.filter((e) => e.type === 'coin')).toHaveLength(2);
  });

  it('強欲は合計に掛けるので、1 枚ずつ拾っても端数で減らない', () => {
    const w = createWorld('dog', 1, VIEW, { greed: 1 });
    for (let i = 0; i < 10; i++) w.items.push({ alive: true, kind: 'coin', x: 0, y: 0, pulled: false });
    collect(w, 1 / 60);
    expect(summary(w).coins).toBe(11);
  });

  it('宝箱を開けると 10 枚と開けた数、クリアで 100 枚', () => {
    const w = createWorld('dog', 1, VIEW);
    w.chests = 1;
    openChest(w);
    expect([summary(w).coins, w.opened]).toEqual([10, 1]);
    w.time = w.stage.length;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(summary(w).coins).toBe(110);
  });

  it('復活は 1 回だけ効き、HP 半分・2 秒の無敵・周りを吹き飛ばす', () => {
    const w = createWorld('dog', 1, VIEW, { revive: 1 });
    w.enemies.push(makeEnemy(ENEMIES.rat, 20, 0, 10));
    hurtPlayer(w, 999);
    expect(w.over).toBeNull();
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp / 2));
    expect(w.player.invuln).toBe(2);
    expect(w.enemies[0].kx).toBeGreaterThan(0);
    expect(w.events.some((e) => e.type === 'revive')).toBe(true);
    w.player.invuln = 0;
    hurtPlayer(w, 999);
    expect(w.over).toBe('dead');
  });
});

describe('面の記録と解放', () => {
  it('森をクリアすると墓地が選べ、前に遊んだ面を覚える', () => {
    const r = emptyRecords();
    expect(canPlay(r, 'graveyard')).toBe(false);
    record(r, run({ cleared: true, time: 900 }));
    expect(r.stages).toEqual(['forest']);
    expect(canPlay(r, 'graveyard')).toBe(true);
    record(r, run({ stage: 'graveyard', time: 100 }));
    expect(r.stage).toBe('graveyard');
  });

  it('古い保存はクリアがあれば森をクリアしたことにし、知らない面は森で読む', () => {
    expect(parseRecords(JSON.stringify({ clears: 1 })).stages).toEqual(['forest']);
    expect(canPlay(parseRecords(JSON.stringify({ clears: 0 })), 'graveyard')).toBe(false);
    expect(parseRecords(JSON.stringify({ stage: 'moon' })).stage).toBe('forest');
  });

  it('墓地のクリアと 2 体のボスの実績。墓地のボスは森の実績を満たさない', () => {
    const r = emptyRecords();
    const got = record(r, run({ stage: 'graveyard', cleared: true, time: 900, bosses: ['pumpkin', 'knight'] }));
    const ids = got.map((a) => a.id);
    expect(ids).toContain('graveClear');
    expect(ids).toContain('graveBosses');
    expect(ids).not.toContain('bear');
    expect(ids).not.toContain('queen');
  });
});
