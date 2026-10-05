import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CoopOverlay from './CoopOverlay.svelte';
import CoopPlay from './CoopPlay.svelte';
import { createWorld, summary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));

describe('ふたりで遊ぶ画面', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('✕ を 2 回押すと抜けられる（相手がいなくなっても閉じ込められない）', () => {
    let ended = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(CoopPlay, {
      target,
      props: { world: createWorld('dog', 1, { w: 260, h: 380 }), onend: () => (ended += 1) }
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
    const props = { me: 'guest' as const, side: null, world, paused: null, waiting: '', busy: false, onend: () => {} };
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
});
