import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CharSelect from './CharSelect.svelte';
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
    (target.querySelector('[data-menu="coop"]') as HTMLButtonElement).click();
    expect(opened).toEqual(['coop']);
    unmount(menu);
    const room = mount(CoopRoom, { target, props: { onback: () => {} } });
    flushSync();
    const labels = [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
    expect(labels).toContain('なかまを よぶ');
    expect(labels).toContain('なかまに はいる');
    unmount(room);
  });
});
