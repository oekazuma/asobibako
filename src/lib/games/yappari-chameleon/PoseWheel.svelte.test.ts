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

  // happy-dom は矩形を 0 で返すので、輪を中心 (590, 410)・直径 400 に見せる
  function wheelAt(play: Play) {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 390,
      top: 210,
      width: 400,
      height: 400
    } as DOMRect);
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PoseWheel, { target, props: { play } });
    flushSync();
    return { target, app };
  }
  const touch = (type: string, x: number, y: number) =>
    window.dispatchEvent(new PointerEvent(type, { pointerId: 7, clientX: x, clientY: y }));
  const held = () => ({ ...fake(), wheel: { id: 7 } }) as unknown as Play;

  it('指を置いたまま輪に入って項目へ滑らせて離すと、その項目に決まる', () => {
    const play = held();
    const { target, app } = wheelAt(play);
    touch('pointermove', 1110, 410);
    touch('pointermove', 590, 410);
    touch('pointermove', 590, 290);
    flushSync();
    expect(target.querySelectorAll('.item')[0].classList.contains('lit')).toBe(true);
    touch('pointerup', 590, 290);
    expect(play.setPose).toHaveBeenCalledWith('curl');
    unmount(app);
    vi.restoreAllMocks();
  });

  it('輪の外（ボタンの上）で揺れて離しても選ばず、開いたままにする', () => {
    const play = held();
    const { app } = wheelAt(play);
    touch('pointermove', 1110, 400);
    touch('pointermove', 1115, 395);
    touch('pointerup', 1115, 395);
    expect(play.setPose).not.toHaveBeenCalled();
    expect(play.openWheel).toHaveBeenCalledWith(null);
    unmount(app);
    vi.restoreAllMocks();
  });

  it('輪に入ってから外へ出て離すと、何も選ばない', () => {
    const play = held();
    const { app } = wheelAt(play);
    touch('pointermove', 590, 290);
    touch('pointermove', 590, 120);
    touch('pointerup', 590, 120);
    expect(play.setPose).not.toHaveBeenCalled();
    expect(play.openWheel).toHaveBeenCalledWith(null);
    unmount(app);
    vi.restoreAllMocks();
  });

  it('中心の近くで離すと選ばず、開いたまま項目を押せる状態にする', () => {
    const play = held();
    const { app } = wheelAt(play);
    touch('pointerup', 595, 415);
    expect(play.setPose).not.toHaveBeenCalled();
    expect(play.openWheel).toHaveBeenCalledWith(null);
    unmount(app);
    vi.restoreAllMocks();
  });

  it('pointercancel では項目を選ばず、開いたままにする', () => {
    const play = held();
    const { app } = wheelAt(play);
    touch('pointermove', 590, 290);
    touch('pointercancel', 590, 290);
    expect(play.setPose).not.toHaveBeenCalled();
    expect(play.openWheel).toHaveBeenCalledWith(null);
    unmount(app);
    vi.restoreAllMocks();
  });

  it('‹ は前のページへ戻る', () => {
    const { target, app } = wheelAt(fake());
    (target.querySelector('button.prev') as HTMLButtonElement).click();
    flushSync();
    expect(target.querySelector('.item')?.textContent?.trim()).toBe('片足立ち');
    (target.querySelector('button.prev') as HTMLButtonElement).click();
    flushSync();
    expect(target.querySelector('.item')?.textContent?.trim()).toBe('丸まる');
    unmount(app);
    vi.restoreAllMocks();
  });
});
