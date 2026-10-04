import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CharSelect from './CharSelect.svelte';
import Daily from './Daily.svelte';
import type { Daily as DailyData } from './daily';
import { emptyRecords } from './records';
import Result from './Result.svelte';
import { createWorld, summary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const daily: DailyData = {
  date: '2026-10-03',
  animal: 'cat',
  stage: 'forest',
  mods: ['noShop', 'growth'],
  cleared: false
};

function show<P extends Record<string, unknown>>(c: Component<P>, props: P) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(c, { target, props });
  flushSync();
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
  return { target, app, button };
}

describe('今日のお題の画面', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('キャラ選択の札に動物・面・しばり・ごほうびを出し、押すとお題の画面を開く', () => {
    const opened: string[] = [];
    const records = { ...emptyRecords(), daily };
    const { app, button } = show(CharSelect, {
      records,
      onpick: () => {},
      onquit: () => {},
      onopen: (s: string) => opened.push(s),
      onrepeat: () => {}
    });
    const card = button('今日のお題');
    expect(card.textContent).toContain('猫');
    expect(card.textContent).toContain('森');
    expect(card.textContent).toContain('店の強化なし');
    expect(card.textContent).toContain('経験値 2 倍');
    expect(card.textContent).toContain('+500');
    card.click();
    button('パワーアップ').click();
    button('実績').click();
    button('図鑑').click();
    expect(opened).toEqual(['daily', 'shop', 'trophies', 'book']);
    unmount(app);
  });

  it('クリアした日の札は「クリア済み」', () => {
    const records = { ...emptyRecords(), daily: { ...daily, cleared: true } };
    const { app, button } = show(CharSelect, {
      records,
      onpick: () => {},
      onquit: () => {},
      onopen: () => {},
      onrepeat: () => {}
    });
    expect(button('今日のお題').textContent).toContain('クリア済み');
    unmount(app);
  });

  it('お題の画面はしばりの中身とごほうびを出し、「挑戦する」と「もどる」', () => {
    const calls: string[] = [];
    const { target, app, button } = show(Daily, {
      daily,
      onstart: () => calls.push('start'),
      onback: () => calls.push('back')
    });
    expect(target.textContent).toContain('パワーアップが効かない');
    expect(target.textContent).toContain('500 コイン');
    button('挑戦する').click();
    button('もどる').click();
    expect(calls).toEqual(['start', 'back']);
    unmount(app);
  });

  it('リザルトは、その日の初クリアでごほうびを入れた回だけ「お題クリア」を出す', () => {
    const w = createWorld('cat', 1, { w: 260, h: 380 }, {}, 'forest', {
      challenge: {
        date: daily.date,
        bonus: 500,
        mods: daily.mods
      }
    });
    w.over = 'clear';
    const props = { got: [], total: 0, locked: false, onagain: () => {}, onselect: () => {} };
    const paid = summary(w);
    paid.daily!.paid = true;
    const a = show(Result, { ...props, run: paid });
    expect(a.target.textContent).toContain('お題クリア +500');
    unmount(a.app);
    const b = show(Result, { ...props, run: summary(w) });
    expect(b.target.textContent).not.toContain('お題クリア');
    unmount(b.app);
  });
});
