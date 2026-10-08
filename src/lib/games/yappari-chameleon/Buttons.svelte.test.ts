import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Buttons from './Buttons.svelte';
import type { Play } from './play.svelte';

function fake(over: Partial<Play> = {}) {
  return {
    mode: 'walk',
    cling: null,
    nearWall: false,
    spoit: false,
    shadow: true,
    held: { up: false, down: false },
    jump: vi.fn(),
    release: vi.fn(),
    togglePaint: vi.fn(),
    toggleEye: vi.fn(),
    toggleSpoit: vi.fn(),
    toggleShadow: vi.fn(),
    undo: vi.fn(),
    ...over
  } as unknown as Play;
}

const labels = (t: HTMLElement) => [...t.querySelectorAll('.column button')].map((b) => b.textContent?.trim());

describe('Buttons', () => {
  it('歩くときはジャンプ・ペイントモード・フリーカメラ', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play: fake(), onquit: () => {} } });
    flushSync();
    expect(labels(target)).toEqual(['ジャンプ', 'ペイントモード', 'フリーカメラ']);
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
    expect(labels(target)).toEqual(['上がる', '下がる', '張り付き解除', 'ペイントモード']);
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
});
