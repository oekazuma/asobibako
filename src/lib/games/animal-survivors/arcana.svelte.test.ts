import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { ARCANA } from './arcana';
import Pause from './Pause.svelte';
import PromptLayer from './PromptLayer.svelte';
import { Prompts } from './prompts.svelte';
import { emptyRecords, RECORDS_KEY } from './records';
import Result from './Result.svelte';
import Survivors from './Survivors.svelte';
import Trophy from './Trophy.svelte';
import { createWorld, summary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));
vi.mock('$lib/music/loop', () => ({
  Loop: class {
    play() {}
    tick() {}
    stop() {}
    warm() {}
  }
}));

const VIEW = { w: 260, h: 380 };
const ALL = ARCANA.map((a) => a.id);
const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

describe('札の画面', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('はじめに 3 枚の札が出て、引き換えの札は悪いところも出し、押すと持つ', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL });
    const prompts = new Prompts(w);
    prompts.next(null);
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PromptLayer, { target, props: { prompts, finger: null, onanswer: () => {} } });
    flushSync();
    const cards = [...target.querySelectorAll<HTMLButtonElement>('[data-card]')];
    expect(cards).toHaveLength(3);
    expect(target.textContent).toContain('ただし');
    const id = cards[0].dataset.card;
    cards[0].click();
    flushSync();
    expect(w.arcana).toEqual([id]);
    expect(target.querySelector('[data-card]')).toBeNull();
    unmount(app);
    prompts.stop();
  });

  it('一時停止とリザルトに持っている札を出す', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL });
    w.arcana = ['fang', 'gamble'];
    const run = summary(w);
    const target = document.body.appendChild(document.createElement('div'));
    const pause = mount(Pause, {
      target,
      props: { run, finger: null, onresume: () => {}, onrestart: () => {}, onquit: () => {} }
    });
    flushSync();
    expect(target.textContent).toContain('大きな牙');
    expect(target.textContent).toContain('いちかばちか');
    unmount(pause);
    const result = mount(Result, {
      target,
      props: { run, got: [], total: 0, locked: false, onagain: () => {}, onselect: () => {} }
    });
    flushSync();
    expect(target.textContent).toContain('いちかばちか');
    unmount(result);
  });

  it('札を開く実績には「NEW! ○○の札」を出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Trophy, { target, props: { a: ACHIEVEMENTS.find((a) => a.id === 'heat5')! } });
    flushSync();
    expect(target.textContent).toContain('NEW! ふたつめの影の札');
    unmount(app);
  });

  it('釜ではじめると札を選ぶ画面が出て、お題の回では出ない', async () => {
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...emptyRecords(), coins: 0 }));
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Survivors, { target, props: { level: 1, onfinish: () => {}, onquit: () => {} } });
    flushSync();
    (document.querySelector('[data-animal="dog"]') as HTMLButtonElement).click();
    flushSync();
    (document.querySelector('[data-stage="forest"]') as HTMLButtonElement).click();
    flushSync();
    (document.querySelector('[data-start]') as HTMLButtonElement).click();
    flushSync();
    // 札はゲームのループの中で出すので、何フレームか回るのを待つ
    await new Promise((r) => setTimeout(r, 200));
    flushSync();
    expect(document.querySelectorAll('[data-card]').length).toBe(3);
    unmount(app);
    document.body.innerHTML = '';
    const again = mount(Survivors, {
      target: document.body,
      props: { level: 1, onfinish: () => {}, onquit: () => {} }
    });
    flushSync();
    button('今日のお題').click();
    flushSync();
    button('挑戦する').click();
    flushSync();
    await new Promise((r) => setTimeout(r, 200));
    flushSync();
    expect(document.querySelector('[data-card]')).toBeNull();
    unmount(again);
  });
});
