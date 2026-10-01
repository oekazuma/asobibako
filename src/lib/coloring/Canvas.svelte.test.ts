import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Canvas from './Canvas.svelte';
import { label, SIZE } from './regions';

// 本物の描き方は canvas の描画が要るので、描くところだけ差し替える
const { fillImage } = vi.hoisted(() => ({ fillImage: vi.fn() }));
vi.mock('./art', () => ({ compose: () => {}, fillImage }));
vi.mock('$lib/audio.svelte', () => ({ wake: () => {} }));

/** 真ん中に縦の線を引いた線画。左と右で別の場所になる */
function halves() {
  const mask = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = SIZE / 2 - 2; x < SIZE / 2 + 2; x++) mask[y * SIZE + x] = 1;
  return label(mask);
}

function show() {
  const regions = halves();
  const onfill = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Canvas, {
    target,
    props: { art: { kind: 'photo', mask: new Uint8Array(0) }, regions, colors: {}, onfill }
  });
  flushSync();
  const sheet = target.querySelector('.sheet')!;
  const fire = (type: string, id: number, x: number) =>
    sheet.dispatchEvent(
      new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x * 100, clientY: 50, bubbles: true })
    );
  const side = (x: number) => regions.labels[(SIZE / 2) * SIZE + Math.floor(x * SIZE)];
  return { app, target, onfill, fire, side };
}

describe('Canvas', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('1 本指のタップは、指を離したときにその場所を塗る', () => {
    const { app, onfill, fire, side } = show();
    fire('pointerdown', 1, 0.6);
    expect(onfill).not.toHaveBeenCalled();
    fire('pointerup', 1, 0.6);
    expect(onfill).toHaveBeenCalledWith(side(0.6));
    unmount(app);
  });

  it('2 本指でつまんでいるあいだは塗らず、拡大したあとのタップは拡大した場所を塗る', () => {
    const { app, target, onfill, fire, side } = show();
    fire('pointerdown', 1, 0.4);
    fire('pointerdown', 2, 0.6);
    fire('pointermove', 1, 0.5);
    fire('pointermove', 2, 0.9);
    fire('pointerup', 1, 0.5);
    fire('pointerup', 2, 0.9);
    flushSync();
    expect(onfill).not.toHaveBeenCalled();
    expect(target.textContent).toContain('もとに もどす');
    fire('pointerdown', 3, 0.6);
    fire('pointerup', 3, 0.6);
    expect(onfill).toHaveBeenCalledWith(side(0.45));
    expect(side(0.45)).not.toBe(side(0.6));
    unmount(app);
  });

  // 塗りの画像を作り直すのは 1 回で 2.4MB を書くので、つまんで見え方が変わるだけなら作り直さない
  it('つまんでいるあいだは、塗りの画像を作り直さない', () => {
    // 大きさの無い盤面には描かないので、描くところまで進むように大きさと描き先を与える
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(100);
    const { app, fire } = show();
    const before = fillImage.mock.calls.length;
    expect(before).toBeGreaterThan(0);
    fire('pointerdown', 1, 0.4);
    fire('pointerdown', 2, 0.6);
    fire('pointermove', 2, 0.8);
    flushSync();
    fire('pointermove', 2, 0.9);
    flushSync();
    expect(fillImage.mock.calls.length).toBe(before);
    unmount(app);
  });

  it('指が大きく動いたら塗らない', () => {
    const { app, onfill, fire } = show();
    fire('pointerdown', 1, 0.2);
    fire('pointermove', 1, 0.3);
    fire('pointerup', 1, 0.3);
    expect(onfill).not.toHaveBeenCalled();
    unmount(app);
  });
});
