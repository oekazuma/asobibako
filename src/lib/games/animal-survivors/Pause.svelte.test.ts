import { PLAIN } from './cauldron';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Pause from './Pause.svelte';
import type { RunSummary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const run: RunSummary = {
  animal: 'dog',
  heat: PLAIN,
  cleared: false,
  time: 125,
  level: 7,
  kills: 80,
  xp: 0,
  weapons: [{ id: 'woof', level: 2 }],
  passives: [],
  bosses: [],
  coins: 12,
  opened: 0,
  evolved: [],
  stage: 'forest',
  form: 0,
  metal: false,
  finale: false,
  book: { kills: {}, elites: [], chiefs: [], bosses: [], forms: [], items: [] },
  dealt: []
};

function show(finger: number | null = null) {
  const calls: string[] = [];
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Pause, {
    target,
    props: {
      run,
      finger,
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

  it('音のボタンは、押すと何が起きるかを言う', () => {
    const { app, button } = show();
    expect(button('音を消す')).toBeDefined();
    expect(button('音 オン')).toBeUndefined();
    unmount(app);
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

  it('スティックの指が残っていれば、その指が離れたあとも 350ms は押せない', () => {
    const { target, app, button } = show(7);
    expect(target.querySelector('.as-locked')).not.toBeNull();
    vi.advanceTimersByTime(400);
    flushSync();
    button('やめる').click();
    flushSync();
    vi.advanceTimersByTime(400);
    flushSync();
    expect(target.querySelector('.as-locked')).toBeNull();
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7 }));
    flushSync();
    expect(target.querySelector('.as-locked')).not.toBeNull();
    unmount(app);
  });

  it('進化形の Lv は ★ で出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Pause, {
      target,
      props: {
        run: { ...run, weapons: [{ id: 'woofEvo', level: 5 }] },
        finger: null,
        onresume: () => {},
        onrestart: () => {},
        onquit: () => {}
      }
    });
    flushSync();
    expect(target.querySelector('.lv')?.textContent).toBe('★');
    unmount(app);
  });
});
