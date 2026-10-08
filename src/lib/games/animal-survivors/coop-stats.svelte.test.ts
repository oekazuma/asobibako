import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CoopBook from './CoopBook.svelte';
import CoopStats from './CoopStats.svelte';
import { titles } from './coop-stats';
import { emptyRecords } from './records';
import Result from './Result.svelte';
import { addHero, createWorld, summary, type CoopRun } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));

const run = (over: Partial<CoopRun> = {}): CoopRun => ({
  me: 0,
  heroes: [
    { animal: 'dog', kills: 120, damage: 5000, raises: 0 },
    { animal: 'cat', kills: 90, damage: 7000, raises: 2 }
  ],
  links: 3,
  carries: 1,
  together: true,
  bonus: 0,
  ...over
});

function show<P extends Record<string, unknown>>(C: Component<P>, props: P) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(C, { target, props });
  flushSync();
  return { target, app };
}

describe('称号', () => {
  it('多いほうに付き、同じ数なら付かない', () => {
    expect(titles(run())).toEqual([['いちばん倒した'], ['いちばんダメージ', 'いちばん助けた']]);
    const tie = run();
    tie.heroes[1] = { ...tie.heroes[1], kills: 120, raises: 0 };
    expect(titles(tie)).toEqual([[], ['いちばんダメージ']]);
  });
});

describe('ふたりの活躍', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('2 匹の数と称号、連携の技と運んだ数を出す', () => {
    const { target, app } = show(CoopStats, { coop: run() });
    const text = target.textContent ?? '';
    expect(text).toContain('ふたりの活躍');
    expect(text).toContain('120');
    expect(text).toContain('7,000');
    expect(text).toContain('いちばん助けた');
    expect(text).toContain('連携の技 3');
    expect(text).toContain('重い宝箱 1');
    expect(target.querySelector('[aria-current="true"]')?.textContent).toContain('じぶん');
    unmount(app);
  });

  it('リザルトには 2 人の回だけ出し、ボーナスがあれば「ふたりのボーナス」を出す', () => {
    const solo = createWorld('dog', 1, { w: 260, h: 380 });
    solo.over = 'dead';
    const base = { got: [], total: 0, locked: false, onagain: () => {}, onselect: () => {} };
    const a = show(Result, { ...base, run: summary(solo) });
    expect(a.target.textContent).not.toContain('ふたりの活躍');
    unmount(a.app);
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    addHero(w, 'cat');
    w.coins = 1000;
    w.over = 'clear';
    const b = show(Result, { ...base, run: summary(w) });
    expect(b.target.textContent).toContain('ふたりの活躍');
    expect(b.target.textContent).toContain('ふたりのボーナス');
    unmount(b.app);
  });
});

describe('ふたりの記録帳', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('遊んだ回数・クリア・最長と、組んだ組み合わせの数を出す', () => {
    const coop = { ...emptyRecords().coop, runs: 4, clears: 1, best: 615, pairs: ['cat+dog', 'dog+wolf'] };
    const { target, app } = show(CoopBook, { coop });
    const text = target.textContent ?? '';
    expect(text).toContain('4');
    expect(text).toContain('10:15');
    expect(text).toContain('2 / 55');
    expect(target.querySelectorAll('[data-pair]')).toHaveLength(2);
    unmount(app);
  });
});
