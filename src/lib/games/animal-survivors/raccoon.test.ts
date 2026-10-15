import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { LOB_R, LOB_SECS, power } from './arms';
import { choices } from './choices';
import { ENEMIES } from './enemies';
import { emptyRecords, parseRecords } from './records';
import { greedOf, RELICS } from './relics';
import { trySpecial } from './specials';
import { WEAPONS, weaponStats } from './weapons';
import { coinsOf, createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const raccoonWorld = () => {
  const w = createWorld('raccoon', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.propCd = 9999;
  w.metalAt = -1;
  w.weapons[0].cd = 0;
  w.stats.crit = 0;
  return w;
};
const run = (w: ReturnType<typeof raccoonWorld>, secs: number) => {
  for (let i = 0; i < Math.round(secs * 30); i++) step(w, { x: 0, y: 0 }, 1 / 30);
};
/** 動かない的。歩いて寄ってくる敵だと落ちる所が変わる */
const still = (w: ReturnType<typeof raccoonWorld>, dx: number, dy = 0) => {
  const e = makeEnemy(ENEMIES.sewerRat, w.player.x + dx, w.player.y + dy, 1e6);
  e.root = 99;
  w.enemies.push(e);
  return e;
};
const special = (w: ReturnType<typeof raccoonWorld>) => {
  w.form = 2;
  w.weapons[0].level = 5;
  expect(trySpecial(w)).toBe(true);
  w.weapons[0].cd = 0;
};

describe('アライグマ', () => {
  it('最強の段で、ガラクタ投げを持ち、夜の街のクリアで仲間になる', () => {
    const a = animal('raccoon');
    expect(a.tier).toBe(4);
    expect(a.forms).toEqual(['アライグマ', '夜回りアライグマ', '街の親分アライグマ']);
    expect(a.weapon).toBe('junkToss');
    expect(a.special).toBe('junkTossSp');
    expect(a.bonus).toEqual({ area: 0.1 });
    expect(ACHIEVEMENTS.find((d) => d.id === 'cityClear')?.animal).toBe('raccoon');
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['cityClear'] }));
    expect(r.unlocked).toContain('raccoon');
  });

  it('ガラクタ投げは Lv1 で 1 個、Lv5 で 3 個', () => {
    const def = WEAPONS.junkToss;
    expect(def.kind).toBe('lob');
    expect(def.base.amount).toBe(1);
    expect(def.base.amount + def.ups.reduce((n, u) => n + (u.amount ?? 0), 0)).toBe(3);
  });

  it('落ちる前は当たらず、落ちたら輪の中の敵にまとめて 1 回だけ当たる', () => {
    const w = raccoonWorld();
    const a = still(w, 50);
    const b = still(w, 50 + LOB_R / 2);
    const far = still(w, 50 + LOB_R * 3);
    run(w, LOB_SECS / 2);
    expect(a.hp).toBe(1e6);
    run(w, LOB_SECS);
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
    expect(far.hp).toBe(1e6);
    const once = 1e6 - a.hp;
    run(w, 0.3);
    expect(1e6 - a.hp).toBe(once);
  });

  it('投げたあとに敵が倒れても、落ちる所は変わらず、止まらない', () => {
    const w = raccoonWorld();
    const a = still(w, 50);
    run(w, 0.2);
    a.alive = false;
    run(w, LOB_SECS * 2);
    expect(w.player.hp).toBeGreaterThan(0);
  });

  it('近い敵から順に投げ、敵が足りなければ同じ敵へ投げる', () => {
    const w = raccoonWorld();
    w.weapons[0].level = 5;
    const near = still(w, 40);
    const mid = still(w, 80);
    still(w, 120);
    run(w, 1 / 30);
    const lobs = w.shots.filter((s) => s.alive && s.kind === 'lob');
    expect(lobs).toHaveLength(3);
    const end = (s: (typeof lobs)[number]) => s.x + s.vx * (s.life - s.age);
    const ends = lobs.map(end).sort((p, q) => p - q);
    expect(ends[0]).toBeCloseTo(near.x, 1);
    expect(ends[1]).toBeCloseTo(mid.x, 1);
    const solo = raccoonWorld();
    solo.weapons[0].level = 5;
    const only = still(solo, 60);
    run(solo, 1 / 30);
    for (const s of solo.shots.filter((o) => o.alive && o.kind === 'lob'))
      expect(s.x + s.vx * (s.life - s.age)).toBeCloseTo(only.x, 1);
    expect(solo.shots.filter((o) => o.alive && o.kind === 'lob')).toHaveLength(3);
  });

  it('画面の外の敵へは投げない', () => {
    const w = raccoonWorld();
    still(w, VIEW.w);
    run(w, 1 / 30);
    expect(w.shots.some((s) => s.alive && s.kind === 'lob')).toBe(false);
  });

  it('缶は決めた落ちる点にぴったり落ちる', () => {
    const w = raccoonWorld();
    const e = still(w, 100, 30);
    run(w, 1 / 30);
    w.weapons[0].cd = 999;
    let ring: { x: number; y: number } | undefined;
    for (let i = 0; i < 30 && !ring; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      ring = w.effects.find((f) => f.alive && f.kind === 'dust');
    }
    expect(ring?.x).toBeCloseTo(e.x, 6);
    expect(ring?.y).toBeCloseTo(e.y, 6);
  });

  it('同じ敵に 3 つの缶が重なって落ちると、3 つぶん当たる', () => {
    const w = raccoonWorld();
    w.weapons[0].level = 5;
    const e = still(w, 50);
    run(w, 1 / 30);
    w.weapons[0].cd = 999;
    run(w, LOB_SECS + 0.1);
    const s = weaponStats(WEAPONS.junkToss, 5);
    expect(1e6 - e.hp).toBeCloseTo(3 * power(w, s.damage).dmg, 6);
  });

  it('輪の半径は 24 ドット × 範囲で、敵の大きさまで含めて当たる', () => {
    const w = raccoonWorld();
    still(w, 50);
    run(w, 1 / 30);
    w.weapons[0].cd = 999;
    const reach = LOB_R * w.stats.area + ENEMIES.sewerRat.r;
    const inside = still(w, 50 + reach - 1);
    const outside = still(w, 50, reach + 1);
    run(w, LOB_SECS + 0.1);
    expect(inside.hp).toBeLessThan(1e6);
    expect(outside.hp).toBe(1e6);
  });

  it('敵がいなければ投げない', () => {
    const w = raccoonWorld();
    run(w, 1);
    expect(w.shots.some((s) => s.alive)).toBe(false);
    expect(w.weapons[0].cd).toBeLessThan(0.3);
  });

  it('ガラクタ投げは、ほかの動物の 3 択に出ない', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 200; i++) {
      w.pending = 1;
      for (const c of choices(w)) expect('id' in c ? c.id : '').not.toBe('junkToss');
    }
  });

  it('3 段階めで Lv5 にすると打ち上げ花火に入れ替わる', () => {
    const w = raccoonWorld();
    special(w);
    expect(w.weapons[0].id).toBe('junkTossSp');
    expect(WEAPONS.junkTossSp).toMatchObject({ special: true, from: 'junkToss', kind: 'lob' });
  });

  it('打ち上げ花火は、落ちたあと 8 方向へ火花が出て、輪の外 40 ドットの敵にも当たる', () => {
    const w = raccoonWorld();
    special(w);
    w.weapons[0].level = 5;
    const target = still(w, 50);
    // 投げる先は 1 回目の投げで決まるので、輪の外の敵は投げたあとに置く
    run(w, 1 / 30);
    w.weapons[0].cd = 999;
    const outside = still(w, 50 + LOB_R * 1.5 * w.stats.area + 40);
    run(w, LOB_SECS + 0.1);
    const sparks = w.shots.filter((s) => s.alive && s.kind === 'shot').length;
    expect(sparks).toBeGreaterThan(0);
    expect(sparks % 8).toBe(0);
    run(w, 0.5);
    expect(target.hp).toBeLessThan(1e6);
    expect(outside.hp).toBeLessThan(1e6);
  });

  it('ふつうのガラクタ投げは火花を出さない', () => {
    const w = raccoonWorld();
    still(w, 50);
    run(w, 1 / 30);
    w.weapons[0].cd = 999;
    run(w, LOB_SECS + 0.1);
    expect(w.shots.some((s) => s.alive && s.kind === 'shot')).toBe(false);
  });
});

describe('金の招き猫', () => {
  it('夜の街にあり、持つとコインが 1 割増える', () => {
    expect(RELICS.find((r) => r.id === 'luckyCat')).toMatchObject({ stage: 'city', dist: 1500 });
    const w = raccoonWorld();
    const g = greedOf(w);
    w.relics.push('luckyCat');
    expect(greedOf(w)).toBeCloseTo(g * 1.1);
  });

  it('その回のコインに 1 割が乗る', () => {
    const w = raccoonWorld();
    w.coins = 1000;
    const before = coinsOf(w);
    w.relics.push('luckyCat');
    expect(coinsOf(w)).toBeGreaterThanOrEqual(Math.floor(before * 1.1) - 1);
    expect(coinsOf(w)).toBeLessThanOrEqual(Math.ceil(before * 1.1) + 1);
    expect(coinsOf(w)).toBeGreaterThan(before);
  });
});
