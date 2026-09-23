import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Memo from './Memo.svelte';

/** いま canvas に見えている線の点（消すたびに空になる） */
let drawn: [number, number][] = [];

vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
  () =>
    ({
      scale() {},
      beginPath() {},
      moveTo() {},
      stroke() {},
      lineTo: (x: number, y: number) => drawn.push([x, y]),
      clearRect: () => (drawn = [])
    }) as never
);

function show() {
  const target = document.createElement('div');
  document.body.append(target);
  const app = mount(Memo, { target, props: { active: true } });
  flushSync();
  const canvas = target.querySelector('canvas')!;
  Object.defineProperties(canvas, { offsetWidth: { value: 100 }, offsetHeight: { value: 100 } });
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, width: 100, height: 100 }) as DOMRect;
  const fire = (type: string, pointerId: number, pointerType: string, x: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { pointerId, pointerType, clientX: x, clientY: x, bubbles: true }));
  const press = (text: string) => [...target.querySelectorAll('button')].find((b) => b.textContent === text)!.click();
  return { app, fire, press };
}

const xs = () => drawn.map(([x]) => Math.round(x));

describe('Memo', () => {
  afterEach(() => {
    drawn = [];
    document.body.replaceChildren();
  });

  it('ペンが着いたら、先に置かれた手のひらの線を消し、それからは指で書かせない', () => {
    const { app, fire } = show();
    fire('pointerdown', 1, 'touch', 10);
    fire('pointermove', 1, 'touch', 20);
    expect(xs()).toContain(20);

    fire('pointerdown', 2, 'pen', 50);
    fire('pointermove', 2, 'pen', 60);
    fire('pointermove', 1, 'touch', 30);
    fire('pointerdown', 3, 'touch', 5);
    fire('pointermove', 3, 'touch', 8);
    expect(xs().every((x) => x >= 50)).toBe(true);
    expect(xs()).toContain(60);
    unmount(app);
  });

  it('もどすは最後の 1 本だけ、消すは全部を消す', () => {
    const { app, fire, press } = show();
    fire('pointerdown', 1, 'pen', 10);
    fire('pointerup', 1, 'pen', 10);
    fire('pointerdown', 1, 'pen', 70);
    fire('pointerup', 1, 'pen', 70);
    press('もどす');
    expect(xs()).toContain(10);
    expect(xs()).not.toContain(70);
    press('消す');
    expect(drawn).toEqual([]);
    unmount(app);
  });
});
