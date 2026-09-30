import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Lobby from './Lobby.svelte';

vi.mock('$lib/net/Handshake.svelte', async () => ({ default: (await import('./test/SheetStub.svelte')).default }));

function show(props: Record<string, unknown> = {}) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Lobby, { target, props: { party: null, onparty: () => {}, onstart: () => {}, ...props } });
  flushSync();
  return { app, target };
}

describe('Lobby', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('よぶ・はいるのカードと、ひとりで ぬりえへの入り口を出し、れんしゅうは出さない', () => {
    const { app, target } = show();
    expect(target.textContent).toContain('なかまを よぶ');
    expect(target.textContent).toContain('なかまに はいる');
    expect(target.querySelector('a[href$="/games/nurie"]')?.textContent).toContain('ひとりで ぬりえ');
    expect(target.textContent).not.toContain('れんしゅう');
    unmount(app);
  });

  it('つながりが切れた子には、もういちど つなぐ を出す', () => {
    const { app, target } = show({ retry: true, note: 'つながりが きれました' });
    expect(target.textContent).toContain('もういちど つなぐ');
    unmount(app);
  });
});
