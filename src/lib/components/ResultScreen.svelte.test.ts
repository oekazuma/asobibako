import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ResultScreen from './ResultScreen.svelte';

describe('ResultScreen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('勝った側にだけ紙吹雪と光線が出る', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(ResultScreen, { target, props: { winner: 2, wins: { 1: 0, 2: 1 }, onagain: () => {} } });
    flushSync();
    expect(target.querySelectorAll('.half.p2 .confetti')).toHaveLength(24);
    expect(target.querySelector('.half.p2 .rays')).not.toBeNull();
    expect(target.querySelectorAll('.half.p1 .confetti')).toHaveLength(0);
    expect(target.querySelector('.half.p1 .rays')).toBeNull();
    unmount(app);
  });
});
