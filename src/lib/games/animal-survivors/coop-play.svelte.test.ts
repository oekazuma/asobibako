import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CoopOverlay from './CoopOverlay.svelte';
import { createWorld, summary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));

describe('ふたりで遊ぶ画面', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('✕ を 2 回押すと抜けられる（相手がいなくなっても閉じ込められない）', () => {
    let ended = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const base = {
      me: 'guest' as const,
      side: null,
      paused: null,
      waiting: '',
      busy: false,
      result: null,
      locked: false
    };
    const app = mount(CoopOverlay, {
      target,
      props: { ...base, world: createWorld('dog', 1, { w: 260, h: 380 }), onend: () => {}, onquit: () => (ended += 1) }
    });
    flushSync();
    const quit = target.querySelector('[data-quit]') as HTMLButtonElement;
    quit.click();
    flushSync();
    expect(ended).toBe(0);
    expect(quit.textContent).toContain('やめる？');
    quit.click();
    expect(ended).toBe(1);
    unmount(app);
  });

  it('リザルトは、指が離れるまで押せず、子の端末ではもう一度を押せない', () => {
    const world = createWorld('dog', 1, { w: 260, h: 380 });
    world.over = 'dead';
    const target = document.body.appendChild(document.createElement('div'));
    const props = {
      me: 'guest' as const,
      side: null,
      world,
      paused: null,
      waiting: '',
      busy: false,
      onend: () => {},
      onquit: () => {}
    };
    const app = mount(CoopOverlay, {
      target,
      props: { ...props, result: { run: summary(world), got: [] }, locked: true }
    });
    flushSync();
    const bar = target.querySelector('[data-bar]')!;
    expect(bar.classList.contains('as-locked')).toBe(true);
    const again = bar.querySelector('button')!;
    expect(again.disabled).toBe(true);
    expect(again.textContent).toContain('おやを まっています');
    unmount(app);
  });
  it('画面が隠れたら一時停止を頼み、選ぶ画面が出ているあいだは頼まない', () => {
    let asked = 0;
    const side = { pause: () => (asked += 1) } as never;
    const target = document.body.appendChild(document.createElement('div'));
    const props = {
      me: 'guest' as const,
      side,
      world: createWorld('dog', 1, { w: 260, h: 380 }),
      paused: null,
      waiting: '',
      result: null,
      locked: false,
      busy: false,
      onend: () => {},
      onquit: () => {}
    };
    const app = mount(CoopOverlay, { target, props });
    flushSync();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(asked).toBe(1);
    unmount(app);
    const busyApp = mount(CoopOverlay, { target, props: { ...props, busy: true } });
    flushSync();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(asked).toBe(1);
    unmount(busyApp);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });
});
