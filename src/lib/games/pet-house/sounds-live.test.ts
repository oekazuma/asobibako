import { beforeEach, describe, expect, it, vi } from 'vitest';

const sinkMock = vi.fn();
const busMock = vi.fn();
vi.mock('$lib/audio.svelte', () => ({ sink: sinkMock, bus: busMock }));

const { sounds } = await import('./sounds');

/** 作られたかどうかだけ分かればよい最小の AudioContext の代わり（sounds.test.ts の fakeContext を簡略化） */
function fakeContext() {
  const node = () => ({
    gain: {
      value: 0,
      setValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
      linearRampToValueAtTime: () => {}
    },
    frequency: { value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
    playbackRate: { value: 0 },
    buffer: null,
    curve: null,
    normalize: true,
    onended: null,
    connect: (to: unknown) => to,
    disconnect: () => {},
    start: () => {},
    stop: () => {}
  });
  const createGain = vi.fn(node);
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    destination: node(),
    createGain,
    createBufferSource: vi.fn(node),
    createWaveShaper: vi.fn(node),
    createConvolver: vi.fn(node),
    createBuffer: (ch: number, n: number) => {
      const data = Array.from({ length: ch }, () => new Float32Array(n));
      return { getChannelData: (i: number) => data[i] };
    }
  } as unknown as BaseAudioContext;
  return { ctx, createGain };
}

describe('止まっているあいだのフレーム音', () => {
  beforeEach(() => {
    sinkMock.mockReset();
    busMock.mockReset();
  });

  it('bus() が undefined のときフレームの足音は鳴らないが、タッチの音は sink() で鳴る', () => {
    const { ctx, createGain } = fakeContext();
    sinkMock.mockReturnValue(ctx);
    busMock.mockReturnValue(undefined);

    sounds.step('floor', false);
    expect(createGain).not.toHaveBeenCalled();

    sounds.coin();
    expect(createGain).toHaveBeenCalled();
  });

  it('bus() も動いているときはフレームの足音も鳴る', () => {
    const { ctx, createGain } = fakeContext();
    sinkMock.mockReturnValue(ctx);
    busMock.mockReturnValue(ctx);

    sounds.step('floor', false);
    expect(createGain).toHaveBeenCalled();
  });
});
