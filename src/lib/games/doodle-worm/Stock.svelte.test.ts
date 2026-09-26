import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Stock from './Stock.svelte';
import type { Doodle } from './stock';

const saveImage = vi.fn();
vi.mock('$lib/share', () => ({ saveImage: (...args: unknown[]) => saveImage(...args) }));
vi.mock('./paint', () => ({
  portrait: () => 'data:image/png;base64,AA==',
  picture: () => 'data:image/png;base64,BB=='
}));

describe('ずかんのシート', () => {
  let target: HTMLElement;
  let app: ReturnType<typeof mount>;
  const oncall = vi.fn();
  const doodles: Doodle[] = [{ id: 'a', strokes: [] }];

  beforeEach(() => {
    saveImage.mockClear();
    oncall.mockClear();
    target = document.body.appendChild(document.createElement('div'));
    app = mount(Stock, {
      target,
      props: {
        doodles,
        oncall,
        onremove: vi.fn(),
        onstar: vi.fn(),
        onclear: vi.fn(),
        onparade: vi.fn(),
        onclose: vi.fn()
      }
    });
    flushSync();
  });

  afterEach(() => {
    unmount(app);
    document.body.innerHTML = '';
  });

  it('「えを ほぞん」を押してから絵を押すと saveImage が呼ばれ、oncall は呼ばれない', () => {
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('えを ほぞん'))!.click();
    flushSync();
    target.querySelector<HTMLButtonElement>('.card')!.click();
    expect(saveImage).toHaveBeenCalledWith('data:image/png;base64,BB==', 'asobibako-doodle-1.png');
    expect(oncall).not.toHaveBeenCalled();
  });

  it('ふだんは絵を押すと oncall が呼ばれ、saveImage は呼ばれない', () => {
    target.querySelector<HTMLButtonElement>('.card')!.click();
    expect(oncall).toHaveBeenCalledWith(doodles[0]);
    expect(saveImage).not.toHaveBeenCalled();
  });
});
