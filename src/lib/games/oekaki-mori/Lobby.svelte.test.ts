import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Link } from '$lib/net/link';
import { PROTOCOL } from '$lib/net/party.svelte';
import Lobby from './Lobby.svelte';
import { handshake } from './test/handshake-hold';

vi.mock('$lib/net/Handshake.svelte', async () => ({ default: (await import('./test/HandshakeStub.svelte')).default }));

const settle = () => new Promise((r) => setTimeout(r));

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

  it('最初の子を迎えそこねたら、誰もいない仲間でロビーを進めず、理由を出して よぶ・はいる に戻る', async () => {
    const onparty = vi.fn();
    const { app, target } = show({ onparty });
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('なかまを よぶ'))!.click();
    flushSync();
    const gone = { send: () => {}, on: () => () => {}, closed: Promise.resolve(), close: () => {} };
    handshake.onlink!(gone as unknown as Link);
    await settle();
    flushSync();
    expect(onparty).not.toHaveBeenCalled();
    expect(target.textContent).toContain('つながりませんでした');
    expect(target.textContent).toContain('なかまを よぶ');
    unmount(app);
  });

  it('子の hello を待つあいだに やめる を押したら、あとから迎えても進まない', async () => {
    const onparty = vi.fn();
    const { app, target } = show({ onparty });
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('なかまを よぶ'))!.click();
    flushSync();
    let hello: (m: unknown) => void = () => {};
    const pipe = {
      send: () => {},
      on: (l: (m: unknown) => void) => ((hello = l), () => {}),
      closed: new Promise(() => {}),
      close: () => {}
    };
    handshake.onlink!(pipe as unknown as Link);
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('やめる'))!.click();
    flushSync();
    hello({ t: 'hello', v: PROTOCOL, was: null, look: null });
    await settle();
    expect(onparty).not.toHaveBeenCalled();
    unmount(app);
  });
});
