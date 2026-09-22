import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StubGame from '$lib/test/StubGame.svelte';
import StubHowto from '$lib/test/StubHowto.svelte';
import GameShell from './GameShell.svelte';

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
  players: 2 as const,
  Thumb: StubHowto,
  load: async () => ({ Game: StubGame, Howto: StubHowto })
};

/** happy-dom に PointerEvent がなければ MouseEvent に pointerId を生やす */
function pointer(type: string, pointerId: number, pointerType = 'touch') {
  const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  const e = new Ctor(type, { bubbles: true });
  Object.defineProperty(e, 'pointerId', { value: pointerId });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  return e;
}

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(GameShell, { target, props: { meta, Game: StubGame, Howto: StubHowto } });
  flushSync();
  const pad = (p: 1 | 2) => target.querySelector(`button.half.p${p}`) as HTMLButtonElement;
  const playing = () => target.querySelector('[data-testid="game"]') !== null;
  return { app, pad, playing };
}

describe('GameShell', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('片方だけでは始まらず、両方が押して 550ms で始まる', () => {
    const { app, pad, playing } = show();
    pad(1).dispatchEvent(pointer('pointerdown', 1));
    flushSync();
    vi.advanceTimersByTime(1000);
    flushSync();
    expect(playing()).toBe(false);
    pad(2).dispatchEvent(pointer('pointerdown', 2));
    flushSync();
    vi.advanceTimersByTime(549);
    flushSync();
    expect(playing()).toBe(false);
    vi.advanceTimersByTime(1);
    flushSync();
    expect(playing()).toBe(true);
    unmount(app);
  });

  it('550ms のあいだに片方が離すと始まらない', () => {
    const { app, pad, playing } = show();
    pad(1).dispatchEvent(pointer('pointerdown', 1));
    pad(2).dispatchEvent(pointer('pointerdown', 2));
    flushSync();
    vi.advanceTimersByTime(300);
    pad(2).dispatchEvent(pointer('pointerup', 2));
    flushSync();
    vi.advanceTimersByTime(1000);
    flushSync();
    expect(playing()).toBe(false);
    unmount(app);
  });

  it('同じパッドに 2 本置いて 1 本離しても、押したままと数える', () => {
    const { app, pad, playing } = show();
    pad(1).dispatchEvent(pointer('pointerdown', 1));
    pad(1).dispatchEvent(pointer('pointerdown', 2));
    pad(2).dispatchEvent(pointer('pointerdown', 3));
    flushSync();
    pad(1).dispatchEvent(pointer('pointerup', 1));
    flushSync();
    vi.advanceTimersByTime(550);
    flushSync();
    expect(playing()).toBe(true);
    unmount(app);
  });

  it('マウスなら片方だけで始まる', () => {
    const { app, pad, playing } = show();
    pad(1).dispatchEvent(pointer('pointerdown', 1, 'mouse'));
    flushSync();
    vi.advanceTimersByTime(550);
    flushSync();
    expect(playing()).toBe(true);
    unmount(app);
  });
});
