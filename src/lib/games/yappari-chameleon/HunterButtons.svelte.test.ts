import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import HunterButtons from './HunterButtons.svelte';
import type { Session } from './session.svelte';

describe('HunterButtons', () => {
  it('撃ったあとの待ちのあいだは「うつ」を押せず、しゃがむは押すたびに切り替わる', () => {
    const session = $state({ cool: 0, play: { crouch: false, jump: vi.fn() }, shoot: vi.fn(), toggleCrouch: () => {} });
    session.toggleCrouch = () => (session.play.crouch = !session.play.crouch);
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(HunterButtons, { target, props: { session: session as unknown as Session } });
    flushSync();
    const shoot = target.querySelector<HTMLButtonElement>('.shoot')!;
    expect(shoot.disabled).toBe(false);
    shoot.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(session.shoot).toHaveBeenCalledTimes(1);
    session.cool = 1;
    flushSync();
    expect(shoot.disabled).toBe(true);
    const crouch = [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('しゃがむ'))!;
    crouch.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    flushSync();
    expect(crouch.getAttribute('aria-pressed')).toBe('true');
    unmount(app);
  });

  it('右の列のいちばん上に TPS視点、三人称のあいだは FPS視点', () => {
    const session = $state({
      cool: 0,
      play: { crouch: false, tps: false, jump: vi.fn(), toggleTps: () => {} },
      shoot: vi.fn(),
      toggleCrouch: vi.fn()
    });
    session.play.toggleTps = () => (session.play.tps = !session.play.tps);
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(HunterButtons, { target, props: { session: session as unknown as Session } });
    flushSync();
    const first = () => target.querySelector('.column button')!;
    expect(first().textContent).toContain('TPS視点');
    first().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    flushSync();
    expect(first().textContent).toContain('FPS視点');
    unmount(app);
  });
});
