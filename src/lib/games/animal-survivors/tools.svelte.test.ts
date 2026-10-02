import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { animal } from './animals';
import { fire } from './arms';
import { choices } from './choices';
import { PASSIVES, stats } from './passives';
import { Prompts } from './prompts.svelte';
import { perks } from './upgrades';
import { createWorld } from './world';

const VIEW = { w: 260, h: 380 };

describe('新しい能力', () => {
  it('ふたごの毛玉は数、ながいしっぽは時間、四つ葉は運を足す', () => {
    const s = stats(animal('dog'), [
      { id: 'twin', level: 2 },
      { id: 'tail', level: 3 },
      { id: 'clover', level: 1 }
    ]);
    expect(s.amount).toBe(2);
    expect(s.duration).toBeCloseTo(1.3);
    expect(s.luck).toBeCloseTo(0.2);
    expect(PASSIVES.twin.max).toBe(2);
  });

  it('数は撃つ数に足し、時間は効く時間に掛ける', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [{ id: 'woof', level: 1, cd: 0 }];
    w.stats.amount = 1;
    w.stats.duration = 2;
    fire(w, 1 / 60);
    const shots = w.shots.filter((o) => o.alive);
    expect(shots).toHaveLength(2);
    expect(shots[0].life).toBeCloseTo(1.2 * 2);
  });

  it('最大の Lv のパッシブは 3 択に出ない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.passives = [{ id: 'twin', level: 2 }];
    for (let i = 0; i < 60; i++)
      for (const c of choices(w)) expect(c.kind === 'passive' && c.id === 'twin').toBe(false);
  });

  it('運が 1 なら必ず 4 択、0 なら 3 択', () => {
    const w = createWorld('dog', 1, VIEW);
    expect(choices(w)).toHaveLength(3);
    w.stats.luck = 1;
    expect(choices(w)).toHaveLength(4);
  });

  it('店の数・時間・運・飛ばす・除外が始めの値に入る', () => {
    const p = perks({ amount: 1, duration: 2, luck: 1, skip: 2, banish: 3 });
    expect(p.boost).toMatchObject({ amount: 1, duration: 0.1, luck: 0.05 });
    expect([p.skips, p.banishes]).toEqual([2, 3]);
    const w = createWorld('dog', 1, VIEW, { skip: 2, banish: 3 });
    expect([w.skips, w.banishes]).toEqual([2, 3]);
  });
});

describe('飛ばすと除外', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('飛ばすと何も取らずに 3 択を閉じ、残りが減る', () => {
    const w = createWorld('dog', 1, VIEW, { skip: 1 });
    w.pending = 1;
    const p = new Prompts(w);
    p.next(null);
    const level = w.weapons[0].level;
    p.skip(null);
    expect(p.options).toBeNull();
    expect([w.pending, w.skips, p.tools.skips]).toEqual([0, 0, 0]);
    expect(w.weapons[0].level).toBe(level);
    w.pending = 1;
    p.next(null);
    p.skip(null);
    expect(p.options).not.toBeNull();
    p.stop();
  });

  it('除外した札はその回のあいだ出ず、引き直しになり、残りが減る', () => {
    const w = createWorld('dog', 1, VIEW, { banish: 1 });
    w.pending = 1;
    const p = new Prompts(w);
    p.next(null);
    const c = p.options![0];
    p.banish(c, null);
    expect([w.pending, w.banishes, p.tools.banishes]).toEqual([1, 0, 0]);
    expect(p.options).not.toBeNull();
    const key = (x: { kind: string; id?: string }) => `${x.kind}:${x.id ?? ''}`;
    for (let i = 0; i < 60; i++)
      for (const o of choices(w)) if (c.kind !== 'meat' && c.kind !== 'bag') expect(key(o)).not.toBe(key(c));
    p.stop();
  });
});
