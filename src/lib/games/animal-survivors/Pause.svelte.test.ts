import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Pause from './Pause.svelte';
import type { RunSummary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const run: RunSummary = {
  animal: 'dog',
  cleared: false,
  time: 125,
  level: 7,
  kills: 80,
  xp: 0,
  weapons: [{ id: 'woof', level: 2 }],
  passives: [],
  bosses: [],
  coins: 12,
  opened: 0
};

function show() {
  const calls: string[] = [];
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Pause, {
    target,
    props: {
      run,
      onresume: () => calls.push('resume'),
      onrestart: () => calls.push('restart'),
      onquit: () => calls.push('quit')
    }
  });
  flushSync();
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
  return { target, app, calls, button };
}

describe('Pause', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('つづけるはすぐ効く', () => {
    const { app, calls, button } = show();
    button('つづける').click();
    expect(calls).toEqual(['resume']);
    unmount(app);
  });

  it('やめるは確かめてから効き、確かめは出て 350ms は効かない', () => {
    const { target, app, calls, button } = show();
    button('やめる').click();
    flushSync();
    expect(calls).toEqual([]);
    expect(target.textContent).toContain('本当にやめますか');
    expect(target.querySelector('.as-locked')).not.toBeNull();
    vi.advanceTimersByTime(400);
    flushSync();
    expect(target.querySelector('.as-locked')).toBeNull();
    button('やめる').click();
    expect(calls).toEqual(['quit']);
    unmount(app);
  });

  it('確かめで「つづける」を押すとメニューに戻る', () => {
    const { target, app, calls, button } = show();
    button('最初からやり直す').click();
    flushSync();
    vi.advanceTimersByTime(400);
    flushSync();
    button('つづける').click();
    flushSync();
    expect(calls).toEqual([]);
    expect(target.textContent).toContain('ポーズ');
    unmount(app);
  });
});
