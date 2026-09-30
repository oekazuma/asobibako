import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlayHarness from './test/PlayHarness.svelte';

vi.mock('./Board.svelte', async () => ({ default: (await import('./test/SheetStub.svelte')).default }));

describe('Play', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ターンが変わったら、50 音盤の打ちかけの字を消す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PlayHarness, { target });
    flushSync();
    const key = [...target.querySelectorAll<HTMLButtonElement>('.keys .key')].find((b) => b.textContent === 'ね')!;
    key.click();
    flushSync();
    expect(target.querySelector('.typed')?.textContent).toBe('ね');
    target.querySelector<HTMLButtonElement>('.next-turn')!.click();
    flushSync();
    expect(target.querySelector('.typed')?.textContent).not.toBe('ね');
    unmount(app);
  });
});
