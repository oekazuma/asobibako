import { describe, expect, it } from 'vitest';
import { ANIMALS } from './animals';
import { apply } from './choices';
import { gainXp, GROW_AT, xpNeed } from './drops';
import { createWorld, summary, type World } from './world';

const VIEW = { w: 260, h: 380 };
const toLevel = (w: World, level: number) => {
  let need = -w.xp;
  for (let l = w.level; l < level; l++) need += xpNeed(l);
  gainXp(w, need / w.stats.growth);
};

describe('育つ', () => {
  it('Lv10 で 2 段階め、Lv25 で 3 段階めに育つ', () => {
    const w = createWorld('dog', 1, VIEW);
    expect(GROW_AT).toEqual([10, 25]);
    toLevel(w, 9);
    expect(w.form).toBe(0);
    toLevel(w, 10);
    expect(w.form).toBe(1);
    expect(w.events.filter((e) => e.type === 'grow')).toEqual([{ type: 'grow', form: 1 }]);
    toLevel(w, 25);
    expect(w.form).toBe(2);
  });

  it('育つと攻撃 +10%・最大 HP +20 が入り、HP が全快する', () => {
    const w = createWorld('dog', 1, VIEW);
    const { might, maxHp } = w.stats;
    w.player.hp = 10;
    toLevel(w, 10);
    expect(w.stats.might).toBeCloseTo(might + 0.1);
    expect(w.stats.maxHp).toBe(maxHp + 20);
    expect(w.player.hp).toBe(w.stats.maxHp);
  });

  it('一度に Lv10 と Lv25 を越えても 2 回育ち、強さが 2 回ぶん入る', () => {
    const w = createWorld('dog', 1, VIEW);
    const { might, maxHp } = w.stats;
    toLevel(w, 26);
    expect(w.form).toBe(2);
    expect(w.events.filter((e) => e.type === 'grow')).toEqual([
      { type: 'grow', form: 1 },
      { type: 'grow', form: 2 }
    ]);
    expect(w.stats.might).toBeCloseTo(might + 0.2);
    expect(w.stats.maxHp).toBe(maxHp + 40);
  });

  it('育ったあとにパッシブを取っても足し分が残る', () => {
    const w = createWorld('dog', 1, VIEW, { might: 1 });
    toLevel(w, 10);
    const { might } = w.stats;
    apply(w, { kind: 'passive', id: 'heart', level: 1 });
    expect(w.stats.might).toBeCloseTo(might);
    apply(w, { kind: 'passive', id: 'fang', level: 1 });
    expect(w.stats.might).toBeCloseTo(might + 0.1);
  });

  it('まとめにいちばん育った段階が入る', () => {
    const w = createWorld('cat', 1, VIEW);
    expect(summary(w).form).toBe(0);
    toLevel(w, 10);
    expect(summary(w).form).toBe(1);
  });

  it('7 匹とも段階の名前が 3 つある', () => {
    for (const a of ANIMALS) expect(a.forms).toHaveLength(3);
    expect(ANIMALS.find((a) => a.id === 'dog')?.forms).toEqual(['子犬', 'わんぱく犬', '勇者の犬']);
  });
});
