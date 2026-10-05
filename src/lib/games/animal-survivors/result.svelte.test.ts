import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import Result from './Result.svelte';
import { createWorld, summary } from './world';

describe('リザルト', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('実績はいくつ取っても 1 つの枠にまとめ、もう一度とキャラ選択へはスクロールする枠の外の下に置く', () => {
    const run = summary(createWorld('dog', 1, { w: 260, h: 380 }));
    const got = ACHIEVEMENTS.slice(0, 6);
    let again = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Result, {
      target,
      props: { run, got, total: 0, locked: false, onagain: () => (again += 1), onselect: () => {} }
    });
    flushSync();
    expect(target.querySelectorAll('.trophy')).toHaveLength(1);
    expect(target.querySelector('.trophy')!.textContent).toContain('実績達成 6');
    for (const a of got) expect(target.querySelector('.trophy')!.textContent).toContain(a.name);
    const bar = target.querySelector('[data-bar]')!;
    expect(bar.closest('.as-screen')).toBeNull();
    const first = bar.querySelector('button')!;
    expect(first.textContent).toBe('もう一度');
    expect(first.classList.contains('as-go')).toBe(true);
    first.click();
    expect(again).toBe(1);
    unmount(app);
  });
});
