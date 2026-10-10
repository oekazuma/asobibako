// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { CPU_DEFAULT } from './cpu/levels';
import { CPU_KEY, readCpu, readSettings, saveCpu, saveSettings, SETTINGS_KEY } from './prefs';
import { DEFAULTS } from './referee';

afterEach(() => localStorage.clear());

describe('マップの設定', () => {
  it('覚えた設定を読み、無ければ既定', () => {
    expect(readSettings()).toEqual(DEFAULTS);
    saveSettings({ ...DEFAULTS, mode: 'normal', hide: 120, taunt: 30 });
    expect(readSettings()).toMatchObject({ mode: 'normal', hide: 120, taunt: 30 });
  });

  it('前の既定の 60 秒のまま覚えていた隠れる時間は 120 秒に読み、新しく選んだ 60 秒はそのまま読む', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULTS, hide: 60 }));
    expect(readSettings().hide).toBe(120);
    saveSettings({ ...DEFAULTS, hide: 60 });
    expect(readSettings().hide).toBe(60);
  });

  it('壊れた値や範囲の外の値は、既定か範囲の中に直す', () => {
    localStorage.setItem(SETTINGS_KEY, '{');
    expect(readSettings()).toEqual(DEFAULTS);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ hide: 5, search: 'x' }));
    expect(readSettings()).toEqual(DEFAULTS);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ hide: 5, reveal: 999 }));
    expect(readSettings()).toMatchObject({ hide: 30, reveal: 120 });
  });

  it('ダブルと見逃しランキングの設定も覚え、前の版の保存は見逃しランキングをオンで読む', () => {
    saveSettings({ ...DEFAULTS, mode: 'double', overlook: false });
    expect(readSettings()).toMatchObject({ mode: 'double', overlook: false });
    // JSON は undefined の項目を書かないので、前の版の保存と同じく overlook の無い形になる
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULTS, overlook: undefined, v: 2 }));
    expect(readSettings().overlook).toBe(true);
  });
});

describe('CPU の設定', () => {
  it('覚えた設定を読み、無ければ既定', () => {
    expect(readCpu()).toEqual(CPU_DEFAULT);
    saveCpu({ side: 'seek', count: 2, mode: 'infect', strength: 'strong' });
    expect(readCpu()).toEqual({ side: 'seek', count: 2, mode: 'infect', strength: 'strong' });
  });

  it('隠れるでは増え鬼を読まず、知らない値や壊れた値は既定に戻す', () => {
    localStorage.setItem(CPU_KEY, JSON.stringify({ side: 'hide', count: 2, mode: 'infect', strength: 'weak' }));
    expect(readCpu()).toEqual({ side: 'hide', count: 2, mode: 'normal', strength: 'weak' });
    localStorage.setItem(CPU_KEY, JSON.stringify({ side: 'x', count: 3, mode: 'double', strength: 'max' }));
    expect(readCpu()).toEqual(CPU_DEFAULT);
    localStorage.setItem(CPU_KEY, 'null');
    expect(readCpu()).toEqual(CPU_DEFAULT);
    localStorage.setItem(CPU_KEY, '{');
    expect(readCpu()).toEqual(CPU_DEFAULT);
  });
});
