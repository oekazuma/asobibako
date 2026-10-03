import { describe, expect, it } from 'vitest';
import { ARCANA, arcanaOffer, desperate, healRate, openArcana, regenRate, takeArcana } from './arcana';
import { openChest } from './chest';
import { noMeat } from './drops';
import { FOREST } from './stages/forest';
import { damageEnemy, createWorld, makeEnemy, summary } from './world';
import { ENEMIES } from './enemies';

const VIEW = { w: 274, h: 394 };
const ALL = ARCANA.map((a) => a.id);
const world = () => createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL });

describe('札の表', () => {
  it('16 枚で、うれしい札と引き換えの札が 8 枚ずつ、8 枚は実績で開く', () => {
    expect(ARCANA).toHaveLength(16);
    expect(ARCANA.filter((a) => a.trade)).toHaveLength(8);
    expect(ARCANA.filter((a) => a.unlock)).toHaveLength(8);
    for (const a of ARCANA) expect(!!a.bad).toBe(a.trade);
  });

  it('開いている札は、最初の 8 枚と達成した実績の札', () => {
    expect(openArcana([])).toHaveLength(8);
    expect(openArcana(['heat5'])).toContain('shadow');
    expect(openArcana(['heat5'])).toHaveLength(9);
  });
});

describe('はじめの札と候補', () => {
  it('札を渡すとはじめの 1 枚を待ち、渡さなければ待たない', () => {
    expect(world().arcanaPending).toBe(1);
    expect(createWorld('dog', 1, VIEW).arcanaPending).toBe(0);
    expect(
      createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL, challenge: { date: 'x', bonus: 0, mods: [] } })
        .arcanaPending
    ).toBe(0);
  });

  it('候補は持っていない 3 枚で、引き換えが 1 枚だけ入る', () => {
    const w = world();
    for (let i = 0; i < 50; i++) {
      const o = arcanaOffer(w);
      expect(new Set(o).size).toBe(3);
      expect(o.filter((id) => ARCANA.find((a) => a.id === id)!.trade)).toHaveLength(1);
    }
    takeArcana(w, 'fang');
    for (let i = 0; i < 20; i++) expect(arcanaOffer(w)).not.toContain('fang');
  });

  it('開いた札が足りなければある分だけ、3 枚持てば出さない', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ['fang', 'gamble'] });
    expect(arcanaOffer(w).sort()).toEqual(['fang', 'gamble']);
    const v = world();
    for (const id of ['fang', 'swift', 'wisdom'] as const) takeArcana(v, id);
    expect(arcanaOffer(v)).toEqual([]);
  });
});

describe('札の効き方', () => {
  it('うれしい札は能力に足し、作り直しても残る', () => {
    const w = world();
    const s = { ...w.stats };
    takeArcana(w, 'fang');
    takeArcana(w, 'shadow');
    expect(w.stats.area).toBeCloseTo(s.area + 0.2);
    expect(w.stats.amount).toBe(s.amount + 1);
    w.form = 1;
    w.stats = { ...w.stats, area: 0 };
    takeArcana(w, 'wisdom');
    expect(w.stats.area).toBeCloseTo(s.area + 0.2);
  });

  it('いちかばちかは攻撃 +50% と最大 HP 半分で、HP は最大を超えない', () => {
    const w = world();
    const s = { ...w.stats };
    takeArcana(w, 'gamble');
    expect(w.stats.might).toBeCloseTo(s.might * 1.5);
    expect(w.stats.maxHp).toBeCloseTo(s.maxHp / 2);
    expect(w.player.hp).toBeLessThanOrEqual(w.stats.maxHp);
  });

  it('命の泉は最大 HP と今の HP を 30 増やし、少しずつ回復する', () => {
    const w = world();
    const hp = w.player.hp;
    takeArcana(w, 'spring');
    expect(w.player.hp).toBe(hp + 30);
    expect(w.stats.regen).toBeGreaterThan(0);
  });

  it('敵を増やす札は面の表を写して掛け算にする', () => {
    const w = world();
    takeArcana(w, 'greedy');
    takeArcana(w, 'horde');
    expect(w.stage.waves[0].rate[1]).toBeCloseTo(FOREST.waves[0].rate[1] * 1.3 * 1.5);
    expect(FOREST.waves[0].rate[1]).toBe(createWorld('dog', 1, VIEW).stage.waves[0].rate[1]);
  });

  it('宝の呪いは宝箱がいつも 3 つ以上で、肉が出ない', () => {
    const w = world();
    takeArcana(w, 'cursed');
    w.weapons = [{ id: w.weapons[0].id, level: 1, cd: 0 }];
    w.chests = 1;
    const out = openChest(w);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(noMeat(w)).toBe(true);
    expect(w.mods).toEqual([]);
  });

  it('背水の陣は HP が減るほど攻撃が上がり、回復が半分', () => {
    const w = world();
    takeArcana(w, 'last');
    w.player.hp = w.stats.maxHp;
    expect(desperate(w)).toBe(1);
    w.player.hp = 1;
    expect(desperate(w)).toBeCloseTo(1 + 0.8 * (1 - 1 / w.stats.maxHp));
    expect(regenRate(w)).toBe(0.5);
    expect(healRate(w)).toBe(0.5);
    expect(desperate(createWorld('dog', 1, VIEW))).toBe(1);
  });

  it('血の契約は 20 体倒すたびに HP 1 回復し、少しずつの回復はしない', () => {
    const w = world();
    takeArcana(w, 'blood');
    w.player.hp = 10;
    for (let i = 0; i < 20; i++) {
      w.enemies.push(makeEnemy(ENEMIES.rat, 500 + i, 500, 1));
      damageEnemy(w, w.enemies.length - 1, 99, 0, 0);
    }
    expect(w.player.hp).toBe(11);
    expect(regenRate(w)).toBe(0);
    expect(noMeat(w)).toBe(true);
  });

  it('まとめに持っている札が入る', () => {
    const w = world();
    takeArcana(w, 'eye');
    expect(summary(w).arcana).toEqual(['eye']);
  });
});
