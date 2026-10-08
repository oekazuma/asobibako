import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Buttons from './Buttons.svelte';
import type { Play } from './play.svelte';

function fake(over: Partial<Play> = {}) {
  const held = { up: false, down: false, turn: 0 };
  return {
    mode: 'walk',
    cling: null,
    nearWall: false,
    spoit: false,
    shadow: true,
    pose: 'stand',
    lock: false,
    held,
    hold: (key: 'up' | 'down', on: boolean) => (held[key] = on),
    turn: (dir: number) => (held.turn = dir),
    openWheel: vi.fn(),
    toggleLock: vi.fn(),
    jump: vi.fn(),
    release: vi.fn(),
    togglePaint: vi.fn(),
    toggleEye: vi.fn(),
    toggleSpoit: vi.fn(),
    toggleShadow: vi.fn(),
    undo: vi.fn(),
    interrupt: vi.fn(),
    ...over
  } as unknown as Play;
}

const labels = (t: HTMLElement) => [...t.querySelectorAll('.column button')].map((b) => b.textContent?.trim());

describe('Buttons', () => {
  it('歩くときはジャンプ・ポーズ・ペイントモード・フリーカメラ・回転ロック', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play: fake(), onquit: () => {} } });
    flushSync();
    expect(labels(target)).toEqual(['ジャンプ', 'ポーズ', 'ペイントモード', 'フリーカメラ', '回転ロック']);
    unmount(app);
  });

  it('壁際ではジャンプを本家の言葉の「よじ登り」と呼ぶ', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play: fake({ nearWall: true }), onquit: () => {} } });
    flushSync();
    expect(labels(target)[0]).toBe('よじ登り');
    unmount(app);
  });

  it('張り付いているあいだは、上がる・下がるを押しているあいだだけ held が立つ', () => {
    const play = fake({ cling: 'wall' });
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play, onquit: () => {} } });
    flushSync();
    expect(labels(target)).toEqual(['上がる', '下がる', '張り付き解除', 'ポーズ', 'ペイントモード']);
    const up = target.querySelectorAll('.column button')[0];
    // Svelte は pointerdown を根元でまとめて受けるので、泡立てて送る
    up.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(play.held.up).toBe(true);
    up.dispatchEvent(new PointerEvent('pointerleave'));
    expect(play.held.up).toBe(false);
    unmount(app);
  });

  it('ペイント中は 3D スポイト・元に戻す・影・ペイントモード', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play: fake({ mode: 'paint' }), onquit: () => {} } });
    flushSync();
    expect(labels(target)).toEqual(['3D スポイト', '元に戻す', '影', 'ペイントモード']);
    unmount(app);
  });

  it('回るボタンは歩くときと天井にだけあり、押しているあいだだけ turn が立つ（左が 1）', () => {
    const play = fake();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play, onquit: () => {} } });
    flushSync();
    const [left, right] = target.querySelectorAll('.spin button');
    left.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(play.held.turn).toBe(1);
    left.dispatchEvent(new PointerEvent('pointerleave'));
    expect(play.held.turn).toBe(0);
    right.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(play.held.turn).toBe(-1);
    unmount(app);

    for (const over of [{ cling: 'wall' as const }, { mode: 'paint' as const }, { mode: 'eye' as const }]) {
      const t = document.body.appendChild(document.createElement('div'));
      const a = mount(Buttons, { target: t, props: { play: fake(over), onquit: () => {} } });
      flushSync();
      expect(t.querySelector('.spin')).toBeNull();
      unmount(a);
    }
    const t = document.body.appendChild(document.createElement('div'));
    const a = mount(Buttons, { target: t, props: { play: fake({ cling: 'ceiling' }), onquit: () => {} } });
    flushSync();
    expect(t.querySelectorAll('.spin button')).toHaveLength(2);
    unmount(a);
  });

  it('ジャンプ・よじ登り・回転ロックは click ではなく pointerdown で受ける（別の指を置いたまま押せる）', () => {
    for (const over of [{}, { mode: 'eye' as const }, { nearWall: true }]) {
      const play = fake(over);
      const target = document.body.appendChild(document.createElement('div'));
      const app = mount(Buttons, { target, props: { play, onquit: () => {} } });
      flushSync();
      const jump = target.querySelector('.column button')!;
      jump.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      jump.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(play.jump).toHaveBeenCalledTimes(1);
      unmount(app);
    }
    const play = fake();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play, onquit: () => {} } });
    flushSync();
    const lock = [...target.querySelectorAll('.column button')].find((b) => b.textContent?.includes('回転ロック'))!;
    lock.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    lock.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(play.toggleLock).toHaveBeenCalledTimes(1);
    unmount(app);
  });

  it('ポーズのボタンは押した指の番号で輪を開く', () => {
    const play = fake();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play, onquit: () => {} } });
    flushSync();
    const pose = [...target.querySelectorAll('.column button')].find((b) => b.textContent?.includes('ポーズ'))!;
    pose.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 4 }));
    expect(play.openWheel).toHaveBeenCalledWith(4);
    unmount(app);
  });

  describe('✕ の確かめ', () => {
    const open = (play = fake()) => {
      const onquit = vi.fn();
      const target = document.body.appendChild(document.createElement('div'));
      const app = mount(Buttons, { target, props: { play, onquit } });
      flushSync();
      const ask = () => {
        target.querySelector<HTMLButtonElement>('.quit')!.click();
        flushSync();
      };
      const dialog = () => target.querySelector('[role="dialog"]');
      const pick = (label: string) =>
        [...target.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(
          (b) => b.textContent?.trim() === label
        )!;
      return { target, app, onquit, ask, dialog, pick, play };
    };

    it('✕ を押しても、確かめるだけでタイトルへは戻らず、押している指を捨てる', () => {
      const t = open();
      expect(t.dialog()).toBeNull();
      t.ask();
      expect(t.dialog()?.textContent).toContain('タイトルへ戻ると、塗った体は消えます。');
      expect(t.onquit).not.toHaveBeenCalled();
      expect(t.play.interrupt).toHaveBeenCalled();
      unmount(t.app);
    });

    it('出てから 350ms は押せず、過ぎたら つづける で閉じ、戻る は押さない', () => {
      vi.useFakeTimers();
      const t = open();
      t.ask();
      t.pick('戻る').click();
      t.pick('つづける').click();
      flushSync();
      expect(t.onquit).not.toHaveBeenCalled();
      expect(t.dialog()).not.toBeNull();
      vi.advanceTimersByTime(350);
      flushSync();
      t.pick('つづける').click();
      flushSync();
      expect(t.dialog()).toBeNull();
      expect(t.onquit).not.toHaveBeenCalled();
      vi.useRealTimers();
      unmount(t.app);
    });

    it('戻る を押すと onquit を 1 回だけ呼ぶ', () => {
      vi.useFakeTimers();
      const t = open();
      t.ask();
      vi.advanceTimersByTime(350);
      flushSync();
      t.pick('戻る').click();
      flushSync();
      expect(t.onquit).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
      unmount(t.app);
    });
  });
});
