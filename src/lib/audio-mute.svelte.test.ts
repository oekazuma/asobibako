import { afterEach, describe, expect, it, vi } from 'vitest';

/** 鳴らしたノードの音量とつなぎ先を覚える、最小の AudioContext の代わり */
class FakeContext {
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = { name: 'destination' };
  gains: { gain: { value: number; setValueAtTime: (v: number) => void }; to?: unknown }[] = [];
  createGain() {
    const g = {
      gain: {
        value: 1,
        setValueAtTime(v: number) {
          g.gain.value = v;
        },
        exponentialRampToValueAtTime() {}
      },
      to: undefined as unknown,
      connect(to: unknown) {
        g.to = to;
        return to;
      }
    };
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    return {
      type: '',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect: (to: unknown) => to,
      start() {},
      stop() {}
    };
  }
  resume() {}
}

describe('効果音のミュート', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    localStorage.clear();
  });

  it('予約した音もミュートで止まる（効果音は 1 つの出口を通り、その音量を 0 にする）', async () => {
    vi.stubGlobal('AudioContext', FakeContext);
    const a = await import('./audio.svelte');
    a.wake();
    a.tone(440, 100, 'square', 0.1, 1500);
    const ctx = a.bus() as unknown as FakeContext;
    const out = ctx.gains.find((g) => g.to === ctx.destination);
    expect(out).toBeDefined();
    expect(ctx.gains.filter((g) => g !== out).every((g) => g.to === out)).toBe(true);
    a.toggleMute();
    expect(out!.gain.value).toBe(0);
    a.toggleMute();
    expect(out!.gain.value).toBe(1);
  });
});
