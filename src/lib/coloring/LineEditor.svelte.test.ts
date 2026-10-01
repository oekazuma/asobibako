import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LineEditor from './LineEditor.svelte';
import { SIZE } from './regions';

vi.mock('$lib/audio.svelte', () => ({ wake: () => {} }));

function show() {
  const onedit = vi.fn();
  const onundo = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(LineEditor, {
    target,
    props: { mask: new Uint8Array(SIZE * SIZE), onedit, onundo, canUndo: true }
  });
  flushSync();
  const sheet = target.querySelector('.editor')!;
  const fire = (type: string, x: number) =>
    sheet.dispatchEvent(
      new PointerEvent(type, { pointerId: 1, pointerType: 'touch', clientX: x * 100, clientY: 50, bubbles: true })
    );
  const press = (label: string) => {
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!.click();
    flushSync();
  };
  return { app, onedit, onundo, fire, press };
}

describe('LineEditor', () => {
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

  // 道具を選ばないうちに触っても、線画を変えない（押しまちがいで線を消さない）
  it('道具を選ぶまでは、なぞっても直さない', () => {
    const { app, onedit, fire } = show();
    fire('pointerdown', 0.2);
    fire('pointermove', 0.5);
    fire('pointerup', 0.5);
    expect(onedit).not.toHaveBeenCalled();
    unmount(app);
  });

  it('せんを たす・けす で、なぞった線をその道具の直しとして知らせ、1つ もどすで戻す', () => {
    const { app, onedit, onundo, fire, press } = show();
    press('せんを たす');
    fire('pointerdown', 0.2);
    fire('pointermove', 0.5);
    fire('pointerup', 0.6);
    expect(onedit).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'add' }));
    expect(onedit.mock.lastCall![0].pts.length).toBeGreaterThanOrEqual(4);
    press('せんを けす');
    fire('pointerdown', 0.3);
    fire('pointerup', 0.3);
    expect(onedit).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'erase' }));
    press('1つ もどす');
    expect(onundo).toHaveBeenCalled();
    unmount(app);
  });
});
