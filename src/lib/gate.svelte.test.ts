import { beforeEach, describe, expect, it } from 'vitest';
import { Gate, MAX_FAILS } from './gate.svelte';
import { today } from './today';

describe('Gate', () => {
  beforeEach(() => localStorage.clear());

  it('正解で通過、不正解は回数を保存し 3 回でロック', () => {
    const g = new Gate(() => 0);
    expect([g.a, g.b]).toEqual([3, 3]);
    expect(g.submit('8')).toBe(false);
    expect([g.fails, g.wrong, g.left]).toEqual([1, true, MAX_FAILS - 1]);
    expect(g.submit(9)).toBe(true);
    expect(g.passed).toBe(true);

    g.submit(1);
    g.submit(1);
    expect(g.locked).toBe(true);
    // 別インスタンスでも同じ日の回数を引き継ぎ、正解でも通さない
    const h = new Gate(() => 0);
    expect(h.locked).toBe(true);
    expect(h.submit(9)).toBe(false);
  });

  it('日付が違う・壊れた保存値は無視する', () => {
    localStorage.setItem('asobibako:gate', JSON.stringify({ date: '2000-01-01', fails: 3 }));
    expect(new Gate().locked).toBe(false);
    localStorage.setItem('asobibako:gate', '{broken');
    expect(new Gate().fails).toBe(0);
    localStorage.setItem('asobibako:gate', JSON.stringify({ date: today(), fails: 'abc' }));
    expect(new Gate().fails).toBe(0);
  });
});
