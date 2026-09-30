import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { View } from './engine';
import TopBar from './TopBar.svelte';

const view: View = {
  mode: 'hayaoshi',
  phase: 'draw',
  turn: 0,
  turns: 6,
  drawer: 1,
  players: [1, 2, 3],
  scores: { 1: 0, 2: 0, 3: 0 },
  left: 50,
  word: 'ぞう',
  mask: '',
  solved: [],
  buzzer: 2,
  answerLeft: 4,
  options: null,
  out: [3]
};

describe('TopBar', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // 描く人の下の段は道具なので、だれが答えているかは上の帯でしか分からない
  it('はやおし検定では、答えている人とおてつきの人に印を付ける', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(TopBar, { target, props: { view, me: 1 } });
    flushSync();
    const chips = [...target.querySelectorAll('.scores li')];
    expect(chips[1].classList.contains('answering')).toBe(true);
    expect(chips[2].classList.contains('out')).toBe(true);
    expect(chips[0].classList.contains('answering')).toBe(false);
    unmount(app);
  });

  it('打っている字を、その人の丸に出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(TopBar, {
      target,
      props: { view: { ...view, mode: 'egokoro' }, me: 1, typing: { 2: 'りん' } }
    });
    flushSync();
    const chips = [...target.querySelectorAll('.scores li')];
    expect(chips[1].querySelector('.typing')?.textContent).toBe('りん');
    expect(chips[2].querySelector('.typing')).toBeNull();
    unmount(app);
  });
});
