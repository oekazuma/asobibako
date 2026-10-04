import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { betOf } from './cauldron';
import { emptyRecords, RECORDS_KEY } from './records';
import Survivors from './Survivors.svelte';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));
vi.mock('$lib/music/loop', () => ({
  Loop: class {
    play() {}
    tick() {}
    stop() {}
    warm() {}
  }
}));

const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
const coins = () => JSON.parse(localStorage.getItem(RECORDS_KEY)!).coins as number;

function open() {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...emptyRecords(), coins: 1000 }));
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Survivors, { target, props: { level: 1, onfinish: () => {}, onquit: () => {} } });
  flushSync();
  return app;
}

describe('釜を通る流れ', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('ステージを選ぶと釜が出て、はじめると賭けを引いて保存する', () => {
    const app = open();
    (document.querySelector('[data-animal="dog"]') as HTMLButtonElement).click();
    flushSync();
    (document.querySelector('[data-go]') as HTMLButtonElement).click();
    flushSync();
    (document.querySelector('[data-stage="forest"]') as HTMLButtonElement).click();
    flushSync();
    expect(document.body.textContent).toContain('まじょの釜');
    for (let i = 0; i < 25; i++) (document.querySelector('[aria-label="強くする"]') as HTMLButtonElement).click();
    flushSync();
    (document.querySelector('[data-start]') as HTMLButtonElement).click();
    flushSync();
    expect(coins()).toBe(1000 - betOf(4.5));
    expect(JSON.parse(localStorage.getItem(RECORDS_KEY)!).heatLast).toBe(4.5);
    expect(document.body.textContent).not.toContain('まじょの釜');
    unmount(app);
  });

  it('やり直すときにコインが足りなければ、払える強さで始めて帯で知らせる', async () => {
    const app = open();
    (document.querySelector('[data-animal="dog"]') as HTMLButtonElement).click();
    flushSync();
    (document.querySelector('[data-go]') as HTMLButtonElement).click();
    flushSync();
    (document.querySelector('[data-stage="forest"]') as HTMLButtonElement).click();
    flushSync();
    for (let i = 0; i < 25; i++) (document.querySelector('[aria-label="強くする"]') as HTMLButtonElement).click();
    flushSync();
    (document.querySelector('[data-start]') as HTMLButtonElement).click();
    flushSync();
    const saved = JSON.parse(localStorage.getItem(RECORDS_KEY)!);
    localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...saved, coins: betOf(3) }));
    (document.querySelector('.as-pause') as HTMLButtonElement).click();
    flushSync();
    button('最初からやり直す').click();
    flushSync();
    // 確かめの画面は出てから 350ms 押せない
    await new Promise((r) => setTimeout(r, 400));
    [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'やり直す')!.click();
    flushSync();
    await new Promise((r) => setTimeout(r, 100));
    flushSync();
    // やり直す前にその回を記録するので、図鑑のコインが少し入って 3.0 より少し上まで払えることがある
    const lowered = document.body.textContent?.match(/コインが足りないので 釜 (\d\.\d) で始めます/);
    expect(Number(lowered?.[1])).toBeGreaterThanOrEqual(3);
    expect(Number(lowered?.[1])).toBeLessThan(4.5);
    unmount(app);
  });

  it('お題の回は釜を通らず、賭けもしない', () => {
    const app = open();
    button('今日のお題').click();
    flushSync();
    button('挑戦する').click();
    flushSync();
    expect(document.body.textContent).not.toContain('まじょの釜');
    expect(coins()).toBe(1000);
    unmount(app);
  });
});

describe('キャラ選択の最初の子', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('保存された記録の、最後に遊んだ動物を選んだ状態で開く', () => {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ ...emptyRecords(), unlocked: ['dog', 'cat', 'wolf', 'fox'], animal: 'fox' })
    );
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Survivors, { target, props: { level: 1, onfinish: () => {}, onquit: () => {} } });
    flushSync();
    expect(document.querySelector('.detail')?.textContent).toContain('キツネ');
    unmount(app);
  });
});
