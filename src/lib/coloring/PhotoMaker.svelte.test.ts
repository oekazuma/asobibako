import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PhotoMaker from './PhotoMaker.svelte';

const photo = vi.hoisted(() => ({ open: vi.fn(), pixels: vi.fn(() => new Uint8ClampedArray(16)) }));
const art = vi.hoisted(() => ({
  edge: vi.fn(() => new Uint8Array(16)),
  ink: vi.fn(() => new Uint8Array(16)),
  walls: vi.fn(() => new Uint8Array(16))
}));
vi.mock('./photo', () => ({ openPhoto: photo.open, cropPixels: photo.pixels }));
vi.mock('./lineart', () => ({ lineArt: art.edge, inkArt: art.ink }));
vi.mock('./walls', () => ({ colorWalls: art.walls }));
vi.mock('./CropView.svelte', async () => ({ default: (await import('./test/CropStub.svelte')).default }));

const settle = async () => {
  for (let i = 0; i < 5; i++) await tick();
  flushSync();
};

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(PhotoMaker, { target, props: { onmake: () => {}, onback: () => {} } });
  flushSync();
  const press = async (label: string) => {
    const b = [...target.querySelectorAll<HTMLButtonElement>('button')].find((x) => x.textContent?.trim() === label);
    if (!b) throw new Error(`no button ${label}`);
    b.click();
    await settle();
  };
  return { app, target, press };
}

async function choose(target: HTMLElement) {
  const input = target.querySelector<HTMLInputElement>('input[type=file]')!;
  Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.jpg')], configurable: true });
  // Svelte は change を根元でまとめて受けるので、泡立てて届ける
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await settle();
  return input;
}

const bitmap = () => ({ width: 400, height: 200, close: vi.fn() });

describe('PhotoMaker', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    photo.open.mockReset();
    art.edge.mockClear();
    art.ink.mockClear();
    art.walls.mockClear();
  });

  it('写真を選ぶと切り取る画面になり、「これで せんを つくる」で線画と「これで ぬる」が出る', async () => {
    const { app, target, press } = show();
    photo.open.mockResolvedValueOnce(bitmap());
    await choose(target);
    expect(target.querySelector('.crop-stub')).not.toBeNull();
    expect(target.textContent).not.toContain('これで ぬる');
    await press('これで せんを つくる');
    expect(target.textContent).toContain('これで ぬる');
    unmount(app);
  });

  it('はじめは「えの せん」で黒い線を拾い、「しゃしんの りんかく」で変わり目を拾う', async () => {
    const { app, target, press } = show();
    photo.open.mockResolvedValueOnce(bitmap());
    await choose(target);
    await press('これで せんを つくる');
    expect(art.ink).toHaveBeenCalled();
    expect(art.edge).not.toHaveBeenCalled();
    await press('しゃしんの りんかく');
    expect(art.edge).toHaveBeenCalled();
    unmount(app);
  });

  it('「きりとりなおす」で切り取る画面に戻る', async () => {
    const { app, target, press } = show();
    photo.open.mockResolvedValueOnce(bitmap());
    await choose(target);
    await press('これで せんを つくる');
    await press('きりとりなおす');
    expect(target.querySelector('.crop-stub')).not.toBeNull();
    expect(target.textContent).not.toContain('これで ぬる');
    unmount(app);
  });

  it('読めなかった写真を選んだら、前の写真を消して知らせる', async () => {
    const { app, target, press } = show();
    const first = bitmap();
    photo.open.mockResolvedValueOnce(first);
    await choose(target);
    await press('これで せんを つくる');
    photo.open.mockRejectedValueOnce(new Error('bad'));
    await choose(target);
    expect(target.textContent).toContain('この しゃしんは つかえませんでした');
    expect(target.textContent).not.toContain('これで ぬる');
    expect(target.querySelector('.crop-stub')).toBeNull();
    expect(first.close).toHaveBeenCalled();
    unmount(app);
  });

  it('選んだあとは入力を空にして、同じ写真をもう一度選べるようにする', async () => {
    const { app, target } = show();
    photo.open.mockResolvedValueOnce(bitmap());
    const input = await choose(target);
    expect(input.value).toBe('');
    unmount(app);
  });

  it('閉じたら、読んだ写真のメモリを放す', async () => {
    const { app, target } = show();
    const bmp = bitmap();
    photo.open.mockResolvedValueOnce(bmp);
    await choose(target);
    unmount(app);
    expect(bmp.close).toHaveBeenCalled();
  });
  it('「いろで わける」は、黒い線に色の境目を重ねる', async () => {
    const { app, target, press } = show();
    photo.open.mockResolvedValueOnce(bitmap());
    await choose(target);
    await press('これで せんを つくる');
    expect(art.walls).not.toHaveBeenCalled();
    await press('いろで わける');
    expect(art.walls).toHaveBeenCalled();
    expect(art.ink).toHaveBeenCalledTimes(2);
    unmount(app);
  });
  it('「いろで わける」で線の量を動かしても、色の境目は作り直さない（1 回 0.4 秒ほどかかる）', async () => {
    vi.useFakeTimers();
    try {
      const { app, target, press } = show();
      photo.open.mockResolvedValueOnce(bitmap());
      await choose(target);
      await press('これで せんを つくる');
      await press('いろで わける');
      const slider = target.querySelector<HTMLInputElement>('.slider input[type=range]')!;
      slider.value = '0.8';
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      vi.advanceTimersByTime(200);
      await settle();
      expect(art.walls).toHaveBeenCalledTimes(1);
      expect(art.ink).toHaveBeenCalledTimes(3);
      unmount(app);
    } finally {
      vi.useRealTimers();
    }
  });

  it('線の量を動かした直後に「きりとりなおす」を押しても、前の線画に戻らない', async () => {
    vi.useFakeTimers();
    try {
      const { app, target, press } = show();
      photo.open.mockResolvedValueOnce(bitmap());
      await choose(target);
      await press('これで せんを つくる');
      const slider = target.querySelector<HTMLInputElement>('.slider input[type=range]')!;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
      await press('きりとりなおす');
      vi.advanceTimersByTime(200);
      await settle();
      expect(target.querySelector('.crop-stub')).not.toBeNull();
      expect(target.textContent).not.toContain('これで ぬる');
      unmount(app);
    } finally {
      vi.useRealTimers();
    }
  });

  it('写真を読んでいるあいだに閉じたら、読み終えた写真をすぐ放す', async () => {
    const { app, target } = show();
    const bmp = bitmap();
    let resolve!: (b: unknown) => void;
    photo.open.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const input = target.querySelector<HTMLInputElement>('input[type=file]')!;
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'a.jpg')], configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    unmount(app);
    resolve(bmp);
    await settle();
    expect(bmp.close).toHaveBeenCalled();
  });
});
