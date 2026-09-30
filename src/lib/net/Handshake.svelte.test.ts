import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Handshake from './Handshake.svelte';

const hooks = vi.hoisted(() => ({
  stop: () => {},
  camera: null as null | ((stream: unknown) => void),
  read: null as null | ((text: string) => void),
  accept: null as null | ((link: unknown) => void)
}));

vi.mock('./camera', () => ({
  openCamera: () => new Promise((resolve) => (hooks.camera = resolve)),
  closeCamera: (stream?: { getTracks: () => { stop: () => void }[] }) => {
    for (const track of stream?.getTracks() ?? []) track.stop();
  },
  scan: (_video: unknown, _match: unknown, onread: (text: string) => void) => {
    hooks.read = onread;
    return () => {};
  }
}));

vi.mock('./link', () => ({
  host: async () => ({ code: 'O:test', accept: () => new Promise((resolve) => (hooks.accept = resolve)) }),
  join: async () => ({ code: 'A:test', link: new Promise(() => {}) }),
  isAnswer: () => true,
  isOffer: () => true
}));

const settle = async () => {
  for (let i = 0; i < 5; i++) await tick();
  flushSync();
};

function show() {
  const stop = vi.fn();
  hooks.stop = stop;
  const onlink = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Handshake, { target, props: { role: 'host', onlink, onfail: vi.fn() } });
  flushSync();
  // video.srcObject は MediaStream しか受けないので、本物に止める口だけ差し替える
  const stream = Object.assign(new MediaStream(), { getTracks: () => [{ stop }] });
  return { app, target, onlink, stop, stream };
}

describe('Handshake', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    hooks.camera = hooks.read = hooks.accept = null;
  });

  it('カメラが開く前にやめたら、開いたカメラをすぐ閉じる', async () => {
    const { app, stop, stream } = show();
    unmount(app);
    hooks.camera!(stream);
    await settle();
    expect(stop).toHaveBeenCalled();
  });

  it('読み取ったあとにやめたら、あとからつながっても知らせずに切る', async () => {
    const { app, target, onlink, stream } = show();
    hooks.camera!(stream);
    await settle();
    target.querySelector<HTMLButtonElement>('button.gold')!.click();
    await settle();
    hooks.read!('A:answer');
    await settle();
    unmount(app);
    const link = { close: vi.fn() };
    hooks.accept!(link);
    await settle();
    expect(onlink).not.toHaveBeenCalled();
    expect(link.close).toHaveBeenCalled();
  });
});
