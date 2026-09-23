// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { menuTab, recentGames, rememberGame, setMenuTab } from './recent';

describe('recent', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('開いた順に先頭へ入り、重複せず、3 本まで', () => {
    for (const id of ['a', 'b', 'a', 'c', 'd']) rememberGame(id);
    expect(recentGames()).toEqual(['d', 'c', 'a']);
  });

  it('保存がなければ空', () => {
    expect(recentGames()).toEqual([]);
  });

  it('壊れた値は空として読む', () => {
    localStorage.setItem('table-duel:recent', '{');
    expect(recentGames()).toEqual([]);
    localStorage.setItem('table-duel:recent', '{"a":1}');
    expect(recentGames()).toEqual([]);
    localStorage.setItem('table-duel:recent', '[1,"a",null]');
    expect(recentGames()).toEqual(['a']);
  });

  it('タブは保存がなければ ひとりで、選んだ側を覚える', () => {
    expect(menuTab()).toBe(1);
    setMenuTab(2);
    expect(menuTab()).toBe(2);
    localStorage.setItem('table-duel:menu-tab', 'x');
    expect(menuTab()).toBe(1);
  });

  it('保存が使えなければ覚えずに動く', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => rememberGame('a')).not.toThrow();
    expect(() => setMenuTab(2)).not.toThrow();
    expect(recentGames()).toEqual([]);
    expect(menuTab()).toBe(1);
  });
});
