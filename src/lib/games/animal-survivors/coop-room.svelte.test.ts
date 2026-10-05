import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CharSelect from './CharSelect.svelte';
import CoopPick from './CoopPick.svelte';
import CoopRoom from './CoopRoom.svelte';
import { emptyRecords } from './records';

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
});
