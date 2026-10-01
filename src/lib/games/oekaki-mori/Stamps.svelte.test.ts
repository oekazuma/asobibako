import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Stamps from './Stamps.svelte';

describe('Stamps', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('送れるときだけボタンを出し、押すとそのスタンプを送る', () => {
    const onsend = vi.fn();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Stamps, { target, props: { stamps: [], looks: {}, canSend: true, onsend } });
    flushSync();
    target.querySelector<HTMLButtonElement>('button[aria-label="いいね"]')!.click();
    expect(onsend).toHaveBeenCalledWith('like');
    unmount(app);
    const app2 = mount(Stamps, { target, props: { stamps: [], looks: {}, canSend: false, onsend } });
    flushSync();
    expect(target.querySelector('button[aria-label="いいね"]')).toBeNull();
    unmount(app2);
  });
});
