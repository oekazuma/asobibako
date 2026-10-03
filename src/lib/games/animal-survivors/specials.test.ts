import { describe, expect, it } from 'vitest';
import { ANIMALS, animal } from './animals';
import { apply, choices, levelUp } from './choices';
import { gainXp, xpNeed } from './drops';
import { baseOf } from './evolutions';
import { emptyRecords, parseRecords, record } from './records';
import { trySpecial } from './specials';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { fire } from './arms';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, summary, type World } from './world';

const VIEW = { w: 274, h: 394 };
const toLevel = (w: World, level: number) => {
  let need = -w.xp;
  for (let l = w.level; l < level; l++) need += xpNeed(l);
  gainXp(w, need / w.stats.growth);
};
const specials = (w: World) => w.events.filter((e) => e.type === 'special');

describe('専用進化', () => {
  it('9 匹とも専用進化形があり、元の武器へ戻せて、上がらない', () => {
    for (const a of ANIMALS) {
      const d = WEAPONS[a.special];
      expect(d.special).toBe(true);
      expect(d.evolved).toBe(true);
      expect(d.ups).toEqual([]);
      expect(baseOf(a.special)).toBe(a.weapon);
    }
  });

  it('3 段階めに育ってから最初の武器が Lv5 になると起きる', () => {
    const w = createWorld('dog', 1, VIEW);
    toLevel(w, 25);
    expect(w.form).toBe(2);
    expect(w.weapons[0].id).toBe('woof');
    for (let l = 2; l <= MAX_LEVEL; l++) levelUp(w, { kind: 'weapon', id: 'woof', level: l });
    expect(w.weapons[0].id).toBe('woofSp');
    expect(specials(w)).toEqual([{ type: 'special', id: 'woofSp' }]);
  });

  it('最初の武器が Lv5 になってから 3 段階めに育つと起きる', () => {
    const w = createWorld('cat', 1, VIEW);
    w.weapons[0].level = MAX_LEVEL;
    toLevel(w, 24);
    expect(w.weapons[0].id).toBe('paw');
    toLevel(w, 25);
    expect(w.weapons[0].id).toBe('pawSp');
    expect(specials(w)).toHaveLength(1);
  });

  it('一度に 2 段育ち、武器も Lv5 のときでも 1 回だけ', () => {
    const w = createWorld('wolf', 1, VIEW);
    w.weapons[0].level = MAX_LEVEL;
    toLevel(w, 30);
    expect(w.form).toBe(2);
    expect(specials(w)).toHaveLength(1);
    expect(trySpecial(w)).toBe(false);
  });

  it('ふつうの進化形を持っていても専用進化形に入れ替わり、武器の数は変わらない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [
      { id: 'woofEvo', level: MAX_LEVEL, cd: 0 },
      { id: 'thunder', level: 2, cd: 0 }
    ];
    toLevel(w, 25);
    expect(w.weapons.map((o) => o.id)).toEqual(['woofSp', 'thunder']);
  });

  it('2 段階めでは起きない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons[0].level = MAX_LEVEL;
    toLevel(w, 24);
    expect(trySpecial(w)).toBe(false);
    expect(w.weapons[0].id).toBe('woof');
  });

  it('専用進化形・元の武器・ふつうの進化形は 3 択に出ない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [{ id: 'woofSp', level: MAX_LEVEL, cd: 0 }];
    for (let i = 0; i < 200; i++)
      for (const c of choices(w)) if (c.kind === 'weapon') expect(['woof', 'woofEvo', 'woofSp']).not.toContain(c.id);
    apply(w, { kind: 'meat' });
    expect(w.weapons[0].id).toBe('woofSp');
  });

  it('専用進化形は、同じ型のふつうの進化形より段の目安の倍率だけ強い', () => {
    const factor = { 1: 1.2, 2: 1.35, 3: 1.5, 4: 1.7 };
    for (const a of ANIMALS) {
      const evo = WEAPONS[`${a.weapon}Evo`];
      const sp = WEAPONS[a.special];
      if (!evo || evo.kind !== sp.kind) continue;
      expect(sp.base.damage / evo.base.damage).toBeCloseTo(factor[a.tier], 1);
    }
    // ふつうの進化が無いトラと竜の子は、Lv5 の最初の武器より大きく強い
    for (const id of ['tiger', 'drake'] as const) {
      const a = animal(id);
      const base = WEAPONS[a.weapon];
      const lv5 = base.base.damage + base.ups.reduce((t, u) => t + (u.damage ?? 0), 0);
      expect(WEAPONS[a.special].base.damage / lv5).toBeGreaterThan(factor[a.tier]);
    }
  });

  it('作った専用進化形は記録の進化の表に残り、読み直しても消えない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons[0].level = MAX_LEVEL;
    toLevel(w, 25);
    const r = emptyRecords();
    record(r, summary(w));
    expect(r.evolved).toContain('woofSp');
    expect(parseRecords(JSON.stringify(r)).evolved).toContain('woofSp');
    expect(animal('dog').special).toBe('woofSp');
  });

  it('ねこまたの百裂ひっかきは上下左右の敵に当たる', () => {
    const w = createWorld('cat', 1, VIEW);
    w.stage = { ...w.stage, waves: [] };
    w.weapons = [{ id: 'pawSp', level: MAX_LEVEL, cd: 0 }];
    w.stats.crit = 0;
    for (const [x, y] of [
      [25, -6],
      [-25, -6],
      [0, -31],
      [0, 19]
    ])
      w.enemies.push(makeEnemy(ENEMIES.croc, x, y, 999));
    w.grid.clear();
    w.enemies.forEach((e, i) => w.grid.add(i, e.x, e.y));
    fire(w, 1 / 60);
    expect(w.enemies.map((e) => e.hp < 999)).toEqual([true, true, true, true]);
  });

  it('竜王の業火は扇の先に焼け跡の炎を残す', () => {
    const w = createWorld('drake', 1, VIEW);
    w.stage = { ...w.stage, waves: [] };
    w.weapons = [{ id: 'breathSp', level: MAX_LEVEL, cd: 0 }];
    w.enemies.push(makeEnemy(ENEMIES.croc, 60, -6, 9999));
    w.grid.clear();
    w.enemies.forEach((e, i) => w.grid.add(i, e.x, e.y));
    fire(w, 1 / 60);
    const flames = w.effects.filter((f) => f.alive && f.kind === 'flame');
    expect(flames.length).toBeGreaterThan(0);
    // 竜の子は弾 +1 で扇が 4 つになり、いちばん外の扇は横を向く
    expect(flames.every((f) => f.x > 0)).toBe(true);
    expect(flames.some((f) => f.x > 40)).toBe(true);
  });
});
