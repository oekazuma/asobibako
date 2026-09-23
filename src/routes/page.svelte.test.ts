import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { games } from '$lib/games';
import Page from './+page.svelte';

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Page, { target });
  flushSync();
  const tab = (name: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement;
  const names = (selector: string) => [...target.querySelectorAll(`${selector} h3`)].map((h) => h.textContent?.trim());
  return { target, app, tab, names };
}

const named = (players: 1 | 2) => games.filter((game) => game.players === players).map((game) => game.name);

describe('一覧', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('はじめは ひとりで のゲームだけを並べる', () => {
    const { app, tab, names } = show();
    expect(tab('ひとりで').getAttribute('aria-pressed')).toBe('true');
    expect(tab('ふたりで').getAttribute('aria-pressed')).toBe('false');
    expect(names('.cards')).toEqual(named(1));
    unmount(app);
  });

  it('タブを押すとその側だけを並べ、次に開いたときも覚えている', () => {
    const first = show();
    first.tab('ふたりで').click();
    flushSync();
    expect(first.names('.cards')).toEqual(named(2));
    unmount(first.app);

    const again = show();
    expect(again.tab('ふたりで').getAttribute('aria-pressed')).toBe('true');
    expect(again.names('.cards')).toEqual(named(2));
    unmount(again.app);
  });

  it('登場の動きは開いたときだけで、タブを替えたら流さない', () => {
    const { app, target, tab } = show();
    const main = target.querySelector('main')!;
    expect(main.classList.contains('intro')).toBe(true);
    tab('ふたりで').click();
    flushSync();
    expect(main.classList.contains('intro')).toBe(false);
    unmount(app);
  });

  it('遊んだゲームがなければ さいきん の段を出さない', () => {
    const { target, app } = show();
    expect(target.querySelector('.recent')).toBeNull();
    unmount(app);
  });

  it('さいきん遊んだゲームを新しい順に出し、もうないゲームは飛ばす', () => {
    localStorage.setItem('table-duel:recent', JSON.stringify(['hockey', 'gone', 'pin-rescue']));
    const { app, names } = show();
    expect(names('.recent')).toEqual(['ホッケー', 'ピンぬき']);
    unmount(app);
  });
});
