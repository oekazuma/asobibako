import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Handshake from './Handshake.svelte';

const hooks = vi.hoisted(() => ({
  stop: () => {},
  camera: null as null | ((stream: unknown) => void),
  read: null as null | ((text: string) => void),
  accept: null as null | ((link: unknown) => void),
  reject: null as null | ((error: unknown) => void),
  closed: 0
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
  host: async () => ({
    code: 'O:test',
    accept: () =>
      new Promise((resolve, reject) => {
        hooks.accept = resolve;
        hooks.reject = reject;
      }),
    close: () => hooks.closed++
  }),
  join: async () => ({ code: 'A:test', link: new Promise(() => {}), close: () => hooks.closed++ }),
  isAnswer: () => true,
  isOffer: () => true
}));

const settle = async () => {
  for (let i = 0; i < 5; i++) await tick();
  flushSync();
};

function show(role: 'host' | 'guest' = 'host') {
  const stop = vi.fn();
  hooks.stop = stop;
  const onlink = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const onfail = vi.fn();
  const app = mount(Handshake, { target, props: { role, onlink, onfail } });
  flushSync();
  // video.srcObject は MediaStream しか受けないので、本物に止める口だけ差し替える
  const stream = Object.assign(new MediaStream(), { getTracks: () => [{ stop }] });
  return { app, target, onlink, onfail, stop, stream };
}

describe('Handshake', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    hooks.camera = hooks.read = hooks.accept = null;
    hooks.reject = null;
    hooks.closed = 0;
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

  it('親の QR を見せたままやめたら、つながる前の接続を閉じる', async () => {
    const { app, stream } = show();
    hooks.camera!(stream);
    await settle();
    expect(hooks.closed).toBe(0);
    unmount(app);
    expect(hooks.closed).toBe(1);
  });

  it('子が読み取ったあと、親が読む前にやめたら、子の接続を閉じる', async () => {
    const { app, stream } = show('guest');
    hooks.camera!(stream);
    await settle();
    hooks.read!('O:offer');
    await settle();
    unmount(app);
    expect(hooks.closed).toBe(1);
  });

  it('つながって渡した接続は、そのあとやめても閉じない', async () => {
    const { app, target, onlink, stream } = show();
    hooks.camera!(stream);
    await settle();
    target.querySelector<HTMLButtonElement>('button.gold')!.click();
    await settle();
    hooks.read!('A:answer');
    await settle();
    const link = { close: vi.fn() };
    hooks.accept!(link);
    await settle();
    expect(onlink).toHaveBeenCalledWith(link);
    unmount(app);
    expect(hooks.closed).toBe(0);
    expect(link.close).not.toHaveBeenCalled();
  });

  it('カメラを切り替えているあいだにやめたら、あとから開いたカメラを閉じる', async () => {
    const { app, target, stream } = show();
    hooks.camera!(stream);
    await settle();
    target.querySelector<HTMLButtonElement>('button.gold')!.click();
    await settle();
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('カメラを きりかえ'))!.click();
    await settle();
    unmount(app);
    const stop = vi.fn();
    hooks.camera!(Object.assign(new MediaStream(), { getTracks: () => [{ stop }] }));
    await settle();
    expect(stop).toHaveBeenCalled();
  });

  it('やめたあとに読み取りが失敗しても、失敗を知らせない', async () => {
    const { app, target, onfail, stream } = show();
    hooks.camera!(stream);
    await settle();
    target.querySelector<HTMLButtonElement>('button.gold')!.click();
    await settle();
    hooks.read!('A:answer');
    await settle();
    unmount(app);
    hooks.reject!(new Error('timeout'));
    await settle();
    expect(onfail).not.toHaveBeenCalled();
  });
});
