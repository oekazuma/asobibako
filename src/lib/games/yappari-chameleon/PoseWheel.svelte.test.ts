import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import PoseWheel from './PoseWheel.svelte';
import type { Play } from './play.svelte';

function fake() {
  return {
    pose: 'stand',
    wheel: { id: null },
    setPose: vi.fn(),
    openWheel: vi.fn(),
    closeWheel: vi.fn()
  } as unknown as Play;
}

describe('PoseWheel', () => {
  it('1 ページめに 6 種、矢印で次の 6 種が出る', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PoseWheel, { target, props: { play: fake() } });
    flushSync();
    const names = () => [...target.querySelectorAll('.item')].map((b) => b.textContent?.trim());
    expect(names()).toEqual(['丸まる', '寝そべる', 'しゃがむ', 'あぐら', 'ブリッジ', 'Tポーズ']);
    (target.querySelector('button.next') as HTMLButtonElement).click();
    flushSync();
    expect(names()).toEqual(['片足立ち', '寄りかかる', '開脚', '前屈', 'ワシ', 'のけぞり']);
    unmount(app);
  });

  it('項目を押すとそのポーズにして閉じ、× で立ち姿に戻す', () => {
    const play = fake();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PoseWheel, { target, props: { play } });
    flushSync();
    (target.querySelectorAll('.item')[0] as HTMLButtonElement).click();
    expect(play.setPose).toHaveBeenCalledWith('curl');
    expect(play.closeWheel).toHaveBeenCalled();
    (target.querySelector('button.clear') as HTMLButtonElement).click();
    expect(play.setPose).toHaveBeenCalledWith('stand');
    unmount(app);
  });

  it('指を置いたまま項目へ滑らせて離すと、その項目に決まる', () => {
    const play = { ...fake(), wheel: { id: 7 } } as unknown as Play;
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PoseWheel, { target, props: { play } });
    flushSync();
    // happy-dom の矩形は 0 なので、中心 (0, 0) から真上（項目 0）へ 100px
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: 0, clientY: -100 }));
    flushSync();
    expect(target.querySelectorAll('.item')[0].classList.contains('lit')).toBe(true);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 0, clientY: -100 }));
    expect(play.setPose).toHaveBeenCalledWith('curl');
    unmount(app);
  });

  it('中心の近くで離すと選ばず、開いたまま項目を押せる状態にする', () => {
    const play = { ...fake(), wheel: { id: 7 } } as unknown as Play;
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PoseWheel, { target, props: { play } });
    flushSync();
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: 5, clientY: 5 }));
    expect(play.setPose).not.toHaveBeenCalled();
    expect(play.openWheel).toHaveBeenCalledWith(null);
    unmount(app);
  });
});
