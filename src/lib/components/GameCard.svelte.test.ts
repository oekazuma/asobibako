import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import StubHowto from '$lib/test/StubHowto.svelte';
import GameCard from './GameCard.svelte';

const solo = {
  id: 'stub',
  name: 'スタブ',
  description: '',
  minutes: '1分',
  players: 1 as const,
  Thumb: StubHowto,
  load: async () => ({ Game: StubHowto, Howto: StubHowto })
};

function show(game = solo) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(GameCard, { target, props: { game } });
  flushSync();
  return { target, app };
}

describe('GameCard', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('遊んだことがなければ到達レベルは出さない', () => {
    const { target, app } = show();
    expect(target.querySelector('.reached')).toBeNull();
    unmount(app);
  });

  it('到達レベルを出す', () => {
    localStorage.setItem('table-duel:level:stub', '37');
    const { target, app } = show();
    expect(target.querySelector('.reached')?.textContent?.trim()).toBe('レベル 37');
    unmount(app);
  });

  it('100 をクリアしていれば ぜんぶクリア', () => {
    localStorage.setItem('table-duel:level:stub', '101');
    const { target, app } = show();
    expect(target.querySelector('.reached')?.textContent?.trim()).toBe('ぜんぶクリア');
    expect(target.querySelector('.reached')?.classList.contains('done')).toBe(true);
    unmount(app);
  });

  it('2 人用のカードには出さない', () => {
    localStorage.setItem('table-duel:level:stub', '37');
    const { target, app } = show({ ...solo, players: 2 as const });
    expect(target.querySelector('.reached')).toBeNull();
    unmount(app);
  });
});
