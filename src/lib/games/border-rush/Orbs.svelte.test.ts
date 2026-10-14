import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Orb } from './engine';
import Orbs from './Orbs.svelte';

const hold: Orb = { id: 7, kind: 'hold', owner: 1, x: 0.5, y: 0.7, bornAt: 0 };

function show() {
  const onrelease = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Orbs, { target, props: { orbs: [hold], holding: [], ongrab: () => {}, onrelease } });
  flushSync();
  const orb = target.querySelector('button.orb') as HTMLButtonElement;
  const fire = (type: string, pointerId: number) =>
    orb.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', bubbles: true }));
  return { app, onrelease, fire };
}

describe('Orbs', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('長押しの玉の上でほかの指を離しても、押さえている指の長押しは終わらない', () => {
    const { app, onrelease, fire } = show();
    fire('pointerdown', 1);
    fire('pointerdown', 2);
    fire('pointerup', 2);
    expect(onrelease).not.toHaveBeenCalled();
    fire('pointerup', 1);
    expect(onrelease).toHaveBeenCalledExactlyOnceWith(7);
    unmount(app);
  });

  it('押さえている指を OS に取り上げられたら長押しを終える', () => {
    const { app, onrelease, fire } = show();
    fire('pointerdown', 1);
    fire('pointercancel', 1);
    expect(onrelease).toHaveBeenCalledExactlyOnceWith(7);
    unmount(app);
  });
});
