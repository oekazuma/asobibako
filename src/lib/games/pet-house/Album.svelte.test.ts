import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Album from './Album.svelte';
import { newSave, type Save } from './engine';

const saveImage = vi.fn();
vi.mock('$lib/share', () => ({ saveImage: (...args: unknown[]) => saveImage(...args) }));

describe('アルバム', () => {
  let target: HTMLElement;
  let app: ReturnType<typeof mount>;

  beforeEach(() => {
    saveImage.mockClear();
    const save: Save = { ...newSave(Date.now()), photos: ['data:image/jpeg;base64,AAAA'] };
    target = document.body.appendChild(document.createElement('div'));
    app = mount(Album, { target, props: { save } });
    flushSync();
  });

  afterEach(() => {
    unmount(app);
    document.body.innerHTML = '';
  });

  it('写真を押してから「ほぞん」を押すと saveImage が呼ばれる', () => {
    target.querySelector<HTMLButtonElement>('.thumb')!.click();
    flushSync();
    const buttons = [...target.querySelectorAll('button')];
    buttons.find((b) => b.textContent?.includes('ほぞん'))!.click();
    expect(saveImage).toHaveBeenCalledWith('data:image/jpeg;base64,AAAA', 'asobibako-pet-1.jpg');
  });
});
