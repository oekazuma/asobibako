import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GameMeta } from '$lib/games';
import StubGame from '$lib/test/StubGame.svelte';
import StubHowto from '$lib/test/StubHowto.svelte';
import GameCard from './GameCard.svelte';

const solo = {
  id: 'stub',
  name: 'スタブ',
  description: '',
  minutes: '1分',
  players: 1 as const,
  levels: 100,
  load: async () => ({ Game: StubGame, Howto: StubHowto })
};

function show(game: GameMeta = solo) {
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

  it('カードは thumbs/<id>.webp の画像を出す', () => {
    const { target, app } = show();
    expect(target.querySelector('img')?.getAttribute('src')).toMatch(/\/thumbs\/stub\.webp$/);
    unmount(app);
  });

  it('遊んだことがなければ到達レベルは出さない', () => {
    const { target, app } = show();
    expect(target.querySelector('.reached')).toBeNull();
    unmount(app);
  });

  it('到達レベルを出す', () => {
    localStorage.setItem('table-duel:reached:stub', '37');
    const { target, app } = show();
    expect(target.querySelector('.reached')?.textContent?.trim()).toBe('Lv 37');
    unmount(app);
  });

  it('最後のレベルをクリアしていれば ぜんぶクリア', () => {
    localStorage.setItem('table-duel:reached:stub', '101');
    const { target, app } = show();
    expect(target.querySelector('.reached')?.textContent?.trim()).toBe('ぜんぶクリア');
    expect(target.querySelector('.reached')?.classList.contains('done')).toBe(true);
    unmount(app);
  });

  it('2 人用のカードには出さない', () => {
    localStorage.setItem('table-duel:reached:stub', '37');
    const { target, app } = show({ ...solo, players: 2 as const });
    expect(target.querySelector('.reached')).toBeNull();
    unmount(app);
  });
});
