import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Link } from '$lib/net/link';
import CharSelect from './CharSelect.svelte';
import CoopPick from './CoopPick.svelte';
import CoopRoom from './CoopRoom.svelte';
import { emptyRecords } from './records';

type Shake = { onlink: (link: Link) => Promise<void>; onfail: (text: string) => void };
const shakes = vi.hoisted(() => [] as Shake[]);
// QR とカメラの手順は描かず、渡された口だけを控える
vi.mock('$lib/net/Handshake.svelte', () => ({ default: (_: unknown, props: Shake) => void shakes.push(props) }));
vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));

describe('ふたりで遊ぶ', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('メニューのふたりで遊ぶから開き、よぶとはいるを出す', () => {
    const opened: string[] = [];
    const target = document.body.appendChild(document.createElement('div'));
    const menu = mount(CharSelect, {
      target,
      props: { records: emptyRecords(), onpick: () => {}, onquit: () => {}, onopen: (s: string) => opened.push(s) }
    });
    flushSync();
    // iPad だけのものではないので、端末の名前で限らない
    expect(target.querySelector('[data-menu="coop"]')!.textContent).not.toContain('iPad');
    (target.querySelector('[data-menu="coop"]') as HTMLButtonElement).click();
    expect(opened).toEqual(['coop']);
    unmount(menu);
    const room = mount(CoopRoom, { target, props: { onback: () => {} } });
    flushSync();
    const labels = [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(labels).toContain('なかまを よぶ');
    expect(labels).toContain('なかまに はいる');
    expect(target.textContent).not.toContain('iPad');
    unmount(room);
  });

  it('つながったあとの動物選びは、仲間の子だけを選べ、選んだ子で決める', () => {
    const picked: string[] = [];
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(CoopPick, {
      target,
      props: {
        records: { ...emptyRecords(), unlocked: ['dog', 'cat'], animal: 'cat' },
        onpick: (id: string) => picked.push(id)
      }
    });
    flushSync();
    expect((target.querySelector('[data-animal="fox"]') as HTMLButtonElement).disabled).toBe(true);
    (target.querySelector('[data-animal="dog"]') as HTMLButtonElement).click();
    flushSync();
    (target.querySelector('[data-go]') as HTMLButtonElement).click();
    expect(picked).toEqual(['dog']);
    unmount(app);
  });

  it('最初の子を迎えそこねたら、動物選びへ進まず、理由を出して よぶ・はいる に戻る', async () => {
    shakes.length = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const room = mount(CoopRoom, { target, props: { onback: () => {} } });
    flushSync();
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'なかまを よぶ')!.click();
    flushSync();
    const gone = { send: () => {}, on: () => () => {}, closed: Promise.resolve(), close: () => {} };
    await shakes[0].onlink(gone as unknown as Link);
    flushSync();
    expect(target.querySelector('[data-animal]')).toBeNull();
    expect(target.textContent).toContain('つながりませんでした');
    expect([...target.querySelectorAll('button')].map((b) => b.textContent?.trim())).toContain('なかまを よぶ');
    unmount(room);
  });
});
