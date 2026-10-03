import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { betOf } from './cauldron';
import Cauldron from './Cauldron.svelte';
import Result from './Result.svelte';
import StageSelect from './StageSelect.svelte';
import { emptyRecords } from './records';
import { createWorld, summary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

describe('釜の画面', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('強さと賭けを出し、+0.1 で上がり、はじめるで選んだ強さを返す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const got: number[] = [];
    const app = mount(Cauldron, {
      target,
      props: { coins: 5000, start: 2, stage: 'forest', onstart: (h) => got.push(h), onback: () => {} }
    });
    flushSync();
    expect(target.textContent).toContain('2.0');
    for (let i = 0; i < 25; i++) (target.querySelector('[aria-label="強くする"]') as HTMLButtonElement).click();
    flushSync();
    expect(target.textContent).toContain('4.5');
    expect(target.textContent).toContain(String(betOf(4.5)));
    (target.querySelector('[data-start]') as HTMLButtonElement).click();
    expect(got).toEqual([4.5]);
    unmount(app);
  });

  it('持っているコインより上には上げられない', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Cauldron, {
      target,
      props: { coins: 0, start: 2, stage: 'forest', onstart: () => {}, onback: () => {} }
    });
    flushSync();
    const up = target.querySelector('[aria-label="強くする"]') as HTMLButtonElement;
    expect(up.disabled).toBe(true);
    unmount(app);
  });

  it('ステージの札にクリアしたいちばん高い強さを出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const records = { ...emptyRecords(), heat: { forest: 6.5 } };
    const app = mount(StageSelect, { target, props: { records, onpick: () => {}, onback: () => {} } });
    flushSync();
    expect(target.querySelector('[data-stage="forest"]')!.textContent).toContain('釜 6.5');
    unmount(app);
  });

  it('リザルトに賭けが戻ったか戻らないかを出す', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, {}, 'forest', { heat: { level: 4.5, bet: 320 } });
    w.over = 'dead';
    const target = document.body.appendChild(document.createElement('div'));
    const props = { run: summary(w), got: [], total: 0, locked: false, onagain: () => {}, onselect: () => {} };
    const app = mount(Result, { target, props });
    flushSync();
    expect(target.textContent).toContain('賭けた 320 は戻らない');
    unmount(app);
  });

  it('延長戦で倒れた回は、10:00 のクリアで戻った賭けを「戻った」と出す', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, {}, 'forest', { heat: { level: 4.5, bet: 320 } });
    w.over = 'dead';
    const run = { ...summary(w), overtime: { secs: 30, coins: 0, halved: true } };
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Result, {
      target,
      props: { run, got: [], total: 0, locked: false, onagain: () => {}, onselect: () => {} }
    });
    flushSync();
    expect(target.textContent).toContain('賭けた 320 が戻った');
    unmount(app);
  });
});
