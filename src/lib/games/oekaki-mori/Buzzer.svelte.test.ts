import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { View } from './engine';
import Buzzer from './Buzzer.svelte';

const base: View = {
  mode: 'hayaoshi',
  phase: 'draw',
  turn: 0,
  turns: 6,
  drawer: 1,
  players: [1, 2, 3],
  scores: { 1: 0, 2: 0, 3: 0 },
  left: 50,
  word: null,
  mask: '',
  solved: [],
  buzzer: null,
  answerLeft: 0,
  options: null,
  out: []
};

function show(view: Partial<View>, me: 2 | 3 = 2) {
  const act = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Buzzer, { target, props: { view: { ...base, ...view }, me, act } });
  flushSync();
  return { app, target, act };
}

describe('Buzzer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('描く時間のあいだは「はやおし！」で buzz を送る', () => {
    const { app, target, act } = show({});
    target
      .querySelector<HTMLButtonElement>('button.buzz')!
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(act).toHaveBeenCalledWith({ t: 'buzz' });
    unmount(app);
  });

  it('おてつきの人と、ほかの人が答えているあいだは押せない', () => {
    const out = show({ out: [2] });
    expect(out.target.querySelector<HTMLButtonElement>('button.buzz')!.disabled).toBe(true);
    unmount(out.app);
    const busy = show({ buzzer: 3, answerLeft: 4 });
    expect(busy.target.textContent).toContain('3P が こたえています');
    expect(busy.target.querySelector('button.buzz')).toBeNull();
    unmount(busy.app);
  });

  it('答える番の人には候補を出し、押した番号を answer で送る', () => {
    const { app, target, act } = show({ buzzer: 2, answerLeft: 5, options: ['ねこ', 'いぬ', 'ぞう', 'さる'] });
    const buttons = [...target.querySelectorAll<HTMLButtonElement>('button.option')];
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['ねこ', 'いぬ', 'ぞう', 'さる']);
    buttons[2].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(act).toHaveBeenCalledWith({ t: 'answer', index: 2 });
    unmount(app);
  });

  // iOS は、はやおしを押した指を離した位置に現れた候補へ合成 click を送る。pointerdown を伴わない click では答えない
  it('click だけでは答えない', () => {
    const { app, target, act } = show({ buzzer: 2, answerLeft: 5, options: ['ねこ', 'いぬ', 'ぞう', 'さる'] });
    target.querySelector<HTMLButtonElement>('button.option')!.click();
    expect(act).not.toHaveBeenCalled();
    unmount(app);
  });
});
