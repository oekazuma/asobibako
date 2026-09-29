import { beforeEach, describe, expect, it } from 'vitest';
import { bonusOf, load, record, store, unlockedBetween } from './outfits';

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  Object.assign(globalThis, {
    localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) }
  });
});

describe('衣装と記録', () => {
  it('保存して読み直せる', () => {
    const s = load();
    s.fans = 1000;
    s.coord.acc = 'elegant';
    s.coord.top = 'pop';
    store(s);
    expect(load()).toEqual(s);
  });

  it('壊れた保存や、まだ持っていない服は、はじめの服に戻す', () => {
    mem.set('asobibako:idol-live', '{"coord":{"top":"elegant","bottom":"zzz"},"fans":-5}');
    const s = load();
    expect(s.coord).toEqual({ top: 'cute', bottom: 'cute', shoes: 'cute', acc: 'cute' });
    expect(s.fans).toBe(0);
    mem.set('asobibako:idol-live', '{');
    expect(load().fans).toBe(0);
  });

  it('曲とむずかしさごとに、よいほうのスコアとランクを残す', () => {
    const s = load();
    expect(record(s, 5000, 'B')).toBe(true);
    s.level = 'easy';
    expect(record(s, 3000, 'A')).toBe(true);
    s.level = 'normal';
    expect(record(s, 4000, 'A')).toBe(false);
    expect(s.records).toEqual({
      'kirameki:normal': { score: 5000, rank: 'A' },
      'kirameki:easy': { score: 3000, rank: 'A' }
    });
  });

  it('むずかしさを選べる前の記録は 1 曲目の「ふつう」に入る。知らない曲は 1 曲目に戻す', () => {
    mem.set('asobibako:idol-live', '{"best":1234,"bestRank":"B","song":"nazo"}');
    const s = load(['kirameki']);
    expect(s.records).toEqual({ 'kirameki:normal': { score: 1234, rank: 'B' } });
    expect(s.song).toBe('kirameki');
    expect(s.level).toBe('normal');
  });

  it('曲と同じテーマの服 1 つにつき 5%', () => {
    expect(bonusOf({ top: 'pop', bottom: 'pop', shoes: 'cute', acc: 'pop' }, 'pop')).toBeCloseTo(0.15);
  });

  it('ファンが増えて越えた分だけ服が手に入る', () => {
    expect(unlockedBetween(0, 250)).toEqual([]);
    expect(unlockedBetween(250, 1000)).toEqual([
      { theme: 'elegant', slot: 'top' },
      { theme: 'elegant', slot: 'acc' }
    ]);
  });
});
