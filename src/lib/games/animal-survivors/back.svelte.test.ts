import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Book from './Book.svelte';
import Cauldron from './Cauldron.svelte';
import Daily from './Daily.svelte';
import GachaRoom from './GachaRoom.svelte';
import Gear from './Gear.svelte';
import { emptyRecords } from './records';
import Shop from './Shop.svelte';
import StageSelect from './StageSelect.svelte';
import Trophies from './Trophies.svelte';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));

const r = emptyRecords();
const SCREENS: [string, Component<never>, object][] = [
  ['ステージ', StageSelect as Component<never>, { records: r, onpick: () => {} }],
  ['釜', Cauldron as Component<never>, { coins: 0, start: 2, stage: 'forest', onstart: () => {} }],
  ['パワーアップ', Shop as Component<never>, {}],
  ['実績', Trophies as Component<never>, {}],
  ['図鑑', Book as Component<never>, { records: r }],
  ['装備', Gear as Component<never>, {}],
  ['ガチャ', GachaRoom as Component<never>, {}],
  [
    'お題',
    Daily as Component<never>,
    {
      daily: { date: '2026-10-05', animal: 'cat', stage: 'forest', mods: ['noShop', 'growth'], cleared: false },
      onstart: () => {}
    }
  ]
];

describe('もどる', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it.each(SCREENS)('%s の画面は、スクロールする枠の外の「もどる」で戻り、下には置かない', (_, screen, props) => {
    let back = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(screen, { target, props: { ...props, onback: () => (back += 1) } as never });
    flushSync();
    const buttons = [...target.querySelectorAll('button')].filter((b) => b.textContent?.includes('もどる'));
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('.as-screen')).toBeNull();
    buttons[0].click();
    expect(back).toBe(1);
    unmount(app);
  });
});
