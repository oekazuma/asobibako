import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Ink } from './strokes';
import BoardHarness from './test/BoardHarness.svelte';

// 指を置くと音を起こすが、テストの環境には AudioContext が無い
vi.mock('$lib/audio.svelte', () => ({ wake: () => {} }));

describe('Board', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // 描く時間が終わっても指を置いたままだと、描く人の絵にだけ線が足され、ほかの人の絵と食い違う
  it('ペンが無くなったら、置いたままの指で線を足さない', () => {
    const inks: Ink[] = [];
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(BoardHarness, { target, props: { onink: (i: Ink) => inks.push(i) } });
    flushSync();
    const board = target.querySelector('.board')!;
    const at = (type: string, x: number) =>
      board.dispatchEvent(
        new PointerEvent(type, { pointerId: 3, pointerType: 'touch', clientX: x, clientY: 10, bubbles: true })
      );
    at('pointerdown', 10);
    target.querySelector<HTMLButtonElement>('.drop-pen')!.click();
    flushSync();
    at('pointerup', 50);
    expect(inks.map((i) => i.k)).toEqual(['start']);
    unmount(app);
  });
});
