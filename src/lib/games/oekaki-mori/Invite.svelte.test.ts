import { flushSync, mount, tick, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import type { Link } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import Invite from './Invite.svelte';

type Shake = { onlink: (link: Link) => Promise<void>; onfail: (text: string) => void };
const shakes = vi.hoisted(() => [] as Shake[]);
// QR とカメラの手順は描かず、渡された口だけを控える
vi.mock('$lib/net/Handshake.svelte', () => ({ default: (_: unknown, props: Shake) => void shakes.push(props) }));

function show(onlink: (link: Link) => Promise<Seat | null | 'mismatch'> = vi.fn()) {
  shakes.length = 0;
  const props = $state({ away: [2] as Seat[], open: true, onlink, looks: {} });
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Invite, { target, props });
  flushSync();
  const alert = () => target.querySelector('[role="alert"]')?.textContent ?? null;
  return { target, props, alert, done: () => unmount(app) };
}

describe('Invite', () => {
  it('つなげなかったら理由を出し、手順を作り直す（「つないでいます…」のまま残さない）', () => {
    const { alert, done } = show();
    shakes[0].onfail('つながりませんでした');
    flushSync();
    expect(alert()).toBe('つながりませんでした');
    expect(shakes).toHaveLength(2);
    done();
  });

  it('閉じたあとに届いた結果は、次に開いたときに出さない', async () => {
    let answer: (seat: null) => void = () => {};
    const { props, target, alert, done } = show(vi.fn(() => new Promise<null>((r) => (answer = r))));
    const pending = shakes[0].onlink({} as Link);
    target.querySelector<HTMLButtonElement>('.pill')!.click();
    flushSync();
    answer(null);
    await pending;
    shakes[0].onfail('つながりませんでした');
    props.open = true;
    await tick();
    expect(alert()).toBeNull();
    expect(shakes).toHaveLength(2);
    done();
  });

  it('迎えられなかった（null）ときは閉じずに理由を出し、手順を作り直す', async () => {
    const { props, alert, done } = show(vi.fn(async () => null));
    await shakes[0].onlink({} as Link);
    flushSync();
    expect(props.open).toBe(true);
    expect(alert()).toBe('つながりませんでした。もういちど ためしてね');
    expect(shakes).toHaveLength(2);
    done();
  });

  it('待っているあいだは、帯に遊びを終えるまでの残りの秒を出す', () => {
    const props = $state({ away: [2] as Seat[], open: false, onlink: vi.fn(), looks: {}, wait: 42 });
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Invite, { target, props });
    flushSync();
    const band = () => target.querySelector('.lost')?.textContent ?? '';
    expect(band()).toContain('あと 42 びょう');
    props.wait = 0;
    flushSync();
    expect(band()).not.toContain('びょう');
    unmount(app);
  });
});
