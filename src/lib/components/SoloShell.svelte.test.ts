import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hooks } from '$lib/test/hooks';
import StubGame from '$lib/test/StubGame.svelte';
import StubHowto from '$lib/test/StubHowto.svelte';
import SoloShell from './SoloShell.svelte';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  sfx: { start: () => {}, finish: () => {} },
  toggleMute: () => {},
  wake: () => {}
}));

const meta = {
  id: 'stub',
  name: 'スタブ',
  description: '',
  minutes: '1分',
  players: 1 as const,
  Thumb: StubHowto,
  load: async () => ({ Game: StubGame, Howto: StubHowto })
};

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(SoloShell, { target, props: { meta, Game: StubGame, Howto: StubHowto } });
  flushSync();
  return { target, app };
}

const start = (target: HTMLElement) => {
  (target.querySelector('button.go') as HTMLButtonElement).click();
  flushSync();
};

describe('SoloShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('onfinish(true) を 2 回呼んでもレベルは 1 つしか進まない', () => {
    const { target, app } = show();
    start(target);
    expect(hooks.level).toBe(1);
    hooks.solo!(true);
    hooks.solo!(true);
    flushSync();
    expect(localStorage.getItem('table-duel:level:stub')).toBe('2');
    expect(target.textContent).toContain('つぎは レベル 2');
    unmount(app);
  });

  it('遊んでいる最中でなければ onfinish は無視される', () => {
    const { target, app } = show();
    start(target);
    const finish = hooks.solo!;
    (target.querySelector('button.quit') as HTMLButtonElement).click();
    flushSync();
    finish(true);
    flushSync();
    expect(localStorage.getItem('table-duel:level:stub')).toBeNull();
    expect(target.querySelector('button.go')).not.toBeNull();
    unmount(app);
  });

  it.each([
    ['5.5', 5],
    ['abc', 1],
    ['9999', 100],
    ['0', 1]
  ])('保存された値 %s は 1..100 の整数 %i に直す', (stored, level) => {
    localStorage.setItem('table-duel:level:stub', stored);
    const { target, app } = show();
    expect(target.textContent).toContain(`レベル ${level}`);
    unmount(app);
  });

  it('レベル 100 をクリアすると ALL_CLEAR を保存し、ぜんぶクリアと出す', () => {
    localStorage.setItem('table-duel:level:stub', '100');
    const { target, app } = show();
    start(target);
    hooks.solo!(true);
    flushSync();
    expect(localStorage.getItem('table-duel:level:stub')).toBe('101');
    expect(target.textContent).toContain('ぜんぶクリア');
    unmount(app);
  });

  it('↻ で同じレベルをやり直す', () => {
    const { target, app } = show();
    start(target);
    const before = hooks.solo;
    (target.querySelector('button.retry') as HTMLButtonElement).click();
    flushSync();
    expect(hooks.level).toBe(1);
    expect(hooks.solo).not.toBe(before);
    expect(target.querySelector('[data-testid="game"]')).not.toBeNull();
    unmount(app);
  });

  it('onhint の文字が吹き出しに出て、空文字で消える', () => {
    const { target, app } = show();
    start(target);
    hooks.hint!('たき火へ はこぼう');
    flushSync();
    expect(target.querySelector('.hint')?.textContent).toBe('たき火へ はこぼう');
    hooks.hint!('');
    flushSync();
    expect(target.querySelector('.hint')).toBeNull();
    unmount(app);
  });
});
