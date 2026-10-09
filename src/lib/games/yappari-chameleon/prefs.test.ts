// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { readSettings, saveSettings, SETTINGS_KEY } from './prefs';
import { DEFAULTS } from './referee';

afterEach(() => localStorage.clear());

describe('マップの設定', () => {
  it('覚えた設定を読み、無ければ既定', () => {
    expect(readSettings()).toEqual(DEFAULTS);
    saveSettings({ ...DEFAULTS, mode: 'normal', hide: 120, taunt: 30 });
    expect(readSettings()).toMatchObject({ mode: 'normal', hide: 120, taunt: 30 });
  });

  it('壊れた値や範囲の外の値は、既定か範囲の中に直す', () => {
    localStorage.setItem(SETTINGS_KEY, '{');
    expect(readSettings()).toEqual(DEFAULTS);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ hide: 5, search: 'x' }));
    expect(readSettings()).toEqual(DEFAULTS);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ hide: 5, reveal: 999 }));
    expect(readSettings()).toMatchObject({ hide: 30, reveal: 120 });
  });
});
