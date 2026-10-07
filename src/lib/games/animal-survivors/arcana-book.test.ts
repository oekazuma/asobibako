import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { ARCANA, arcanaOf } from './arcana';
import { entries } from './book-view';
import { emptyRecords, parseRecords } from './records';

describe('札の図鑑と開く実績', () => {
  it('開く実績はどれも実績の表にある', () => {
    for (const a of ARCANA) if (a.unlock) expect(ACHIEVEMENTS.some((d) => d.id === a.unlock)).toBe(true);
    expect(arcanaOf('heat5')?.id).toBe('shadow');
  });

  it('図鑑の札のタブは 16 枚で、開いた札は効果、まだの札は開く実績を出す', () => {
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['heat5'] }));
    const list = entries(r, 'arcana');
    expect(list).toHaveLength(16);
    const shadow = list.find((e) => e.key === 'shadow')!;
    expect(shadow.known).toBe(true);
    expect(shadow.detail.join()).toContain('弾と攻撃の数 +1');
    const glass = list.find((e) => e.key === 'glass')!;
    expect(glass.known).toBe(false);
    expect(glass.hint).toContain('武器 3 つを Lv5 にする');
  });

  it('遺物のタブは 8 つで、持っている遺物だけ名前が出る', () => {
    const r = emptyRecords();
    r.relics = ['lamp'];
    const list = entries(r, 'relics');
    expect(list).toHaveLength(8);
    expect(list.filter((e) => e.known).map((e) => e.name)).toEqual(['魔法のランプ']);
  });
});
