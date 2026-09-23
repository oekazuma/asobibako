import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateApp } from './pwa';

class FakeWorker extends EventTarget {
  state = 'installing';
  become(state: string) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

const reload = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('location', { ...location, reload });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  reload.mockClear();
});

describe('updateApp', () => {
  it('新しい worker が activated になったら読み直す', async () => {
    const worker = new FakeWorker();
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: async () => ({ update: async () => {}, installing: worker, waiting: null }) }
    });
    const done = updateApp();
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).not.toHaveBeenCalled();
    worker.become('activated');
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('30 秒たっても状態が変わらなければ見切って読み直す', async () => {
    const worker = new FakeWorker();
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: async () => ({ update: async () => {}, installing: worker, waiting: null }) }
    });
    const done = updateApp();
    await vi.advanceTimersByTimeAsync(30_000);
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('Service Worker がなければ table-duel- と asobibako- のキャッシュだけ消して読み直す', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('navigator', { serviceWorker: undefined });
    vi.stubGlobal('caches', {
      keys: async () => ['table-duel-a', 'other', 'asobibako-b'],
      delete: async (k: string) => {
        deleted.push(k);
        return true;
      }
    });
    await updateApp();
    expect(deleted).toEqual(['table-duel-a', 'asobibako-b']);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
