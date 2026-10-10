import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Lobby from './Lobby.svelte';
import { Match } from './match.svelte';
import { SETTINGS_KEY } from './prefs';
import type { Session } from './session.svelte';

function show(host: boolean, members = [1, 2]) {
  const start = vi.fn();
  const session = { party: { host, members }, match: new Match(() => 1), start } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Lobby, { target, props: { session, oninvite: vi.fn() } });
  flushSync();
  const button = (text: string) => [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  return { target, start, button, done: () => unmount(app) };
}

afterEach(() => localStorage.clear());

describe('Lobby', () => {
  it('子には「ホストが始めるのを待っています」だけを出す', () => {
    const { target, button, done } = show(false);
    expect(target.textContent).toContain('ホストが始めるのを待っています');
    expect(button('マップの設定')).toBeUndefined();
    done();
  });

  it('親はマップの設定を開いて変え、ゲームを始めると設定を覚えて始める', () => {
    const { target, start, button, done } = show(true);
    button('マップの設定')!.click();
    flushSync();
    expect(target.querySelector('[aria-label="マップの設定"]')).not.toBeNull();
    for (const label of [
      'ゲームモード',
      'ハンターの人数',
      'ハンター待機時間（秒）',
      '探索時間（秒）',
      '答え合わせ時間（秒）',
      '強制挑発間隔（秒）',
      'ハンターに見逃しランキングを表示'
    ])
      expect(target.textContent).toContain(label);
    button('通常')!.click();
    flushSync();
    button('ゲームを始める')!.click();
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'normal', hide: 120, search: 300, taunt: 0 }));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).mode).toBe('normal');
    done();
  });

  it('1 人のあいだはゲームを始められない', () => {
    const { target, button, done } = show(true, [1]);
    button('マップの設定')!.click();
    flushSync();
    expect(button('ゲームを始める')!.disabled).toBe(true);
    expect(target.textContent).toContain('2人以上');
    done();
  });

  it('ダブルではハンターの人数を薄くして押せなくし、見逃しランキングはオフにできる', () => {
    const { target, start, button, done } = show(true, [1, 2, 3]);
    button('マップの設定')!.click();
    flushSync();
    button('ダブル')!.click();
    flushSync();
    expect(target.querySelector('.row.dim')?.textContent).toContain('ハンターの人数');
    expect(button('＋')!.disabled).toBe(true);
    button('オフ')!.click();
    flushSync();
    button('ゲームを始める')!.click();
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'double', overlook: false }));
    done();
  });
});
