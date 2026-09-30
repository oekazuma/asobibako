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

  function board(onink: (i: Ink) => void) {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(BoardHarness, { target, props: { onink } });
    flushSync();
    const el = target.querySelector('.board')!;
    const fire = (type: string, id: number, kind: string, extra: PointerEvent[] = []) => {
      const e = new PointerEvent(type, { pointerId: id, pointerType: kind, clientX: 5, clientY: 5, bubbles: true });
      Object.defineProperty(e, 'getCoalescedEvents', { value: () => extra });
      el.dispatchEvent(e);
    };
    return { app, fire };
  }

  // 手のひらが先に触れると、手のひらが描く指になって Pencil で描けない
  it('指で描いている途中にペンが触れたら、指の線を取り消してペンの線にする', () => {
    const inks: Ink[] = [];
    const { app, fire } = board((i) => inks.push(i));
    fire('pointerdown', 1, 'touch');
    fire('pointerdown', 2, 'pen');
    expect(inks.map((i) => i.k)).toEqual(['start', 'undo', 'start']);
    unmount(app);
  });

  it('一度ペンが触れたら、指では描かない。手のひらが離れてもペンの線は続く', () => {
    const inks: Ink[] = [];
    const { app, fire } = board((i) => inks.push(i));
    fire('pointerdown', 2, 'pen');
    fire('pointerdown', 1, 'touch');
    fire('pointerup', 1, 'touch');
    fire('pointermove', 2, 'pen');
    fire('pointerup', 2, 'pen');
    expect(inks.map((i) => i.k)).toEqual(['start', 'add']);
    unmount(app);
  });

  // Pencil は 1 秒に 240 回ほど位置を送るが、pointermove は 1 フレームに 1 回にまとめられる
  it('pointermove にまとめられた間の点まで拾う', () => {
    const inks: Ink[] = [];
    const { app, fire } = board((i) => inks.push(i));
    fire('pointerdown', 2, 'pen');
    const at = (x: number) => new PointerEvent('pointermove', { pointerId: 2, clientX: x, clientY: 5 });
    fire('pointermove', 2, 'pen', [at(10), at(20), at(30)]);
    fire('pointerup', 2, 'pen');
    const added = inks.filter((i) => i.k === 'add');
    expect(added).toHaveLength(1);
    expect(added[0].k === 'add' && added[0].pts.length).toBe(8);
    unmount(app);
  });
});
