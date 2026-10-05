import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CoopPlay from './CoopPlay.svelte';
import { createWorld } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));

const frames = (n: number) =>
  new Promise<void>((done) => {
    const tick = (k: number) => (k ? requestAnimationFrame(() => tick(k - 1)) : done());
    tick(n);
  });

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

  it('終わりの画面は、指が離れるまで押せない', async () => {
    const world = createWorld('dog', 1, { w: 260, h: 380 });
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(CoopPlay, { target, props: { world, onend: () => {} } });
    flushSync();
    dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
    world.over = 'dead';
    await frames(3);
    flushSync();
    const panel = target.querySelector('[aria-label="おわり"]')!;
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('as-locked')).toBe(true);
    unmount(app);
  });
});
