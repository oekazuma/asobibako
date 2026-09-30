import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PhotoMaker from './PhotoMaker.svelte';

const photo = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('./photo', () => ({ readPhoto: photo.read }));
vi.mock('./lineart', () => ({ lineArt: () => new Uint8Array(16) }));

const settle = async () => {
  for (let i = 0; i < 5; i++) await tick();
  flushSync();
};

async function choose(target: HTMLElement) {
  const input = target.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.jpg')], configurable: true });
  // Svelte は change を根元でまとめて受けるので、泡立てて届ける
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  return input;
}

describe('PhotoMaker', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    photo.read.mockReset();
  });

  it('読めなかった写真を選んだら、前の線画を消して「これで ぬる」を出さない', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PhotoMaker, { target, props: { onmake: () => {}, onback: () => {} } });
    photo.read.mockResolvedValueOnce(new Uint8ClampedArray(16));
    await choose(target);
    expect(target.textContent).toContain('これで ぬる');
    photo.read.mockRejectedValueOnce(new Error('bad'));
    await choose(target);
    expect(target.textContent).toContain('この しゃしんは つかえませんでした');
    expect(target.textContent).not.toContain('これで ぬる');
    unmount(app);
  });

  it('選んだあとは入力を空にして、同じ写真をもう一度選べるようにする', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PhotoMaker, { target, props: { onmake: () => {}, onback: () => {} } });
    photo.read.mockResolvedValueOnce(new Uint8ClampedArray(16));
    const input = await choose(target);
    expect(input.value).toBe('');
    unmount(app);
  });
});
