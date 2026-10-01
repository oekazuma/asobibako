import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Link } from '$lib/net/link';
import Lobby from './Lobby.svelte';
import { handshake } from './test/handshake-hold';

vi.mock('$lib/net/Handshake.svelte', async () => ({ default: (await import('./test/HandshakeStub.svelte')).default }));

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

  // 子の hello を待つあいだにロビーへ戻ると、もう一度「なかまを よぶ」を押せて親が 2 つできてしまう
  it('つながった子の hello を待つあいだは、QR の手順の画面のままにする', () => {
    const onparty = vi.fn();
    const { app, target } = show({ onparty });
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('なかまを よぶ'))!.click();
    flushSync();
    const silent = { send: () => {}, on: () => () => {}, closed: new Promise(() => {}), close: () => {} };
    handshake.onlink!(silent as unknown as Link);
    flushSync();
    expect(target.querySelector('.stub-handshake')).not.toBeNull();
    expect(onparty).not.toHaveBeenCalled();
    unmount(app);
  });
});
