import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RECORDS_KEY } from './records';
import Survivors from './Survivors.svelte';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));
vi.mock('$lib/music/loop', () => ({
  Loop: class {
    play() {}
    tick() {}
    stop() {}
    warm() {}
  }
}));

const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

describe('日付をまたいだ今日のお題', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('キャラ選択を開いたまま日付が変わっても、お題の画面は今日のお題を出す', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 23, 50));
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Survivors, { target, props: { level: 1, onfinish: () => {}, onquit: () => {} } });
    flushSync();
    expect(JSON.parse(localStorage.getItem(RECORDS_KEY)!).daily.date).toBe('2026-10-03');
    vi.setSystemTime(new Date(2026, 9, 4, 0, 10));
    button('今日のお題').click();
    flushSync();
    expect(document.body.textContent).toContain('2026/10/04');
    unmount(app);
  });

  it('お題の画面を開いたまま日付が変わったら、「挑戦する」で始めずに今日のお題を見せる', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 3, 23, 50));
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Survivors, { target, props: { level: 1, onfinish: () => {}, onquit: () => {} } });
    flushSync();
    button('今日のお題').click();
    flushSync();
    vi.setSystemTime(new Date(2026, 9, 4, 0, 10));
    button('挑戦する').click();
    flushSync();
    expect(document.body.textContent).toContain('2026/10/04');
    expect(button('挑戦する')).toBeDefined();
    unmount(app);
  });
});
