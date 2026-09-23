import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StubGame from '$lib/test/StubGame.svelte';
import StubHowto from '$lib/test/StubHowto.svelte';
import SoloTitle from './SoloTitle.svelte';

const meta = {
  id: 'stub',
  name: 'スタブ',
  description: '',
  minutes: '1分',
  players: 1 as const,
  levels: 100,
  load: async () => ({ Game: StubGame, Howto: StubHowto })
};

function show(level: number, best: number) {
  const target = document.body.appendChild(document.createElement('div'));
  const props = $state({ meta, Howto: StubHowto, best, level, onlevels: () => {}, onstart: () => {} });
  const app = mount(SoloTitle, { target, props });
  flushSync();
  const button = (label: string) => target.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  const fire = (el: HTMLElement, type: string) => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    flushSync();
  };
  return { app, props, button, fire };
}

describe('SoloTitle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('タップで 1 つ進む', () => {
    const { app, props, button, fire } = show(3, 10);
    fire(button('次のレベル'), 'pointerdown');
    fire(button('次のレベル'), 'pointerup');
    fire(button('次のレベル'), 'click');
    expect(props.level).toBe(4);
    unmount(app);
  });

  it('長押しすると 400ms 後から 90ms ごとに進み、離すと止まる', () => {
    const { app, props, button, fire } = show(1, 100);
    fire(button('次のレベル'), 'pointerdown');
    vi.advanceTimersByTime(399);
    flushSync();
    expect(props.level).toBe(1);
    vi.advanceTimersByTime(1 + 90 * 4);
    flushSync();
    expect(props.level).toBe(6);
    fire(button('次のレベル'), 'pointerup');
    fire(button('次のレベル'), 'click');
    vi.advanceTimersByTime(1000);
    flushSync();
    expect(props.level).toBe(6);
    unmount(app);
  });

  it('ぜんぶクリアしていても最後のレベルより先へは行かない', () => {
    const { app, props, button } = show(100, 101);
    expect(button('次のレベル').disabled).toBe(true);
    expect(props.level).toBe(100);
    unmount(app);
  });

  it('端に着いたら止まり、best より先へは行かない', () => {
    const { app, props, button, fire } = show(8, 10);
    fire(button('次のレベル'), 'pointerdown');
    vi.advanceTimersByTime(400 + 90 * 10);
    flushSync();
    expect(props.level).toBe(10);
    unmount(app);
  });
});
