import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { games } from '$lib/games';
import { load } from './+page';
import Page from './+page.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

it('2だいで あそぶ を押すと、QR でつなぐ画面を読み込んで出す', async () => {
  const meta = games.find((game) => 'net' in game && game.net)!;
  const data = await load({ params: { id: meta.id } } as never);
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Page, { target, props: { data } as never });
  flushSync();
  expect(target.textContent).not.toContain('さきに QR を だす');
  target.querySelector<HTMLButtonElement>('button.pair')!.click();
  await vi.waitFor(() => {
    flushSync();
    expect(target.textContent).toContain('さきに QR を だす');
  });
  unmount(app);
});
