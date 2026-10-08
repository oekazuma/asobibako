import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import PaintPanel from './PaintPanel.svelte';
import type { Play } from './play.svelte';

function fake() {
  const play = {
    brush: { radius: 0.05, color: [1, 0, 0], opacity: 1, metal: 0, rough: 0.85 },
    previous: [0, 0, 1],
    recent: [[0, 1, 0]],
    spoit: false,
    setColor: vi.fn(),
    toggleSpoit: vi.fn()
  };
  return play as unknown as Play;
}

const show = (play: Play) => {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(PaintPanel, { target, props: { play } });
  flushSync();
  return { target, app };
};

const slide = (target: HTMLElement, label: string, value: number) => {
  const input = target.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
  input.value = String(value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
};

describe('PaintPanel', () => {
  it('本家の並び（円盤・縦の 2 本・RGBA と HSV・見本・艶・3D スポイト）で出す', () => {
    const { target, app } = show(fake());
    const order = [...target.querySelectorAll('[data-part]')].map((e) => e.getAttribute('data-part'));
    expect(order).toEqual(['disk', 'pair', 'rgba', 'hsv', 'swatches', 'gloss', 'spoit']);
    for (const l of ['彩度', '明るさ', 'R', 'G', 'B', 'A', 'H', 'S', 'V', 'メタリック', 'ラフネス'])
      expect(target.querySelector(`input[aria-label="${l}"]`), l).not.toBe(null);
    unmount(app);
  });

  it('見本を押すと、その色で setColor を呼ぶ', () => {
    const play = fake();
    const { target, app } = show(play);
    (target.querySelector('[data-swatch="#c62828"]') as HTMLButtonElement).click();
    expect(play.setColor).toHaveBeenCalledWith([198 / 255, 40 / 255, 40 / 255]);
    unmount(app);
  });

  it('前の色を押すと、前の色を今の色にする', () => {
    const play = fake();
    const { target, app } = show(play);
    (target.querySelector('button.previous') as HTMLButtonElement).click();
    expect(play.setColor).toHaveBeenCalledWith([0, 0, 1]);
    unmount(app);
  });

  it('R を動かすと筆の色が、A を動かすと筆の不透明度が変わる', () => {
    const play = fake();
    const { target, app } = show(play);
    slide(target, 'R', 0.5);
    expect(play.brush.color[0]).toBeCloseTo(0.5);
    slide(target, 'A', 0.4);
    expect(play.brush.opacity).toBeCloseTo(0.4);
    unmount(app);
  });

  it('縦の明るさのスライダーは V と同じ値を動かす', () => {
    const play = fake();
    const { target, app } = show(play);
    slide(target, '明るさ', 0.5);
    expect(Math.max(...play.brush.color)).toBeCloseTo(0.5);
    unmount(app);
  });

  it('メタリックのスライダーは筆の艶を変える', () => {
    const play = fake();
    const { target, app } = show(play);
    slide(target, 'メタリック', 1);
    expect(play.brush.metal).toBe(1);
    unmount(app);
  });

  it('いちばん下の 3D スポイトを押すとスポイトにする', () => {
    const play = fake();
    const { target, app } = show(play);
    (target.querySelector('[data-part="spoit"]') as HTMLButtonElement).click();
    expect(play.toggleSpoit).toHaveBeenCalled();
    unmount(app);
  });

  it('たたむと中身を隠す', () => {
    const { target, app } = show(fake());
    (target.querySelector('button.fold') as HTMLButtonElement).click();
    flushSync();
    expect(target.querySelector('[data-swatch]')).toBe(null);
    unmount(app);
  });
});
