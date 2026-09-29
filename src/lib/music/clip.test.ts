import { afterEach, describe, expect, it, vi } from 'vitest';
import { Clip } from './clip';

/** 鳴らしはじめた時刻と位置だけを覚える AudioContext の代わり */
function fakeContext() {
  const starts: { when: number; pos: number }[] = [];
  const stops: number[] = [];
  const node = () => ({
    gain: { value: 0, setTargetAtTime: () => {} },
    buffer: null,
    connect: (to: unknown) => to,
    start: (when: number, pos = 0) => starts.push({ when, pos }),
    stop: (at: number) => stops.push(at)
  });
  const ctx = {
    currentTime: 10,
    createGain: node,
    createBufferSource: node,
    createDelay: node,
    createConvolver: node,
    createWaveShaper: node,
    sampleRate: 8000,
    destination: node(),
    createBuffer: (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) }),
    decodeAudioData: async () => ({ duration: 60 })
  };
  return { ctx: ctx as unknown as BaseAudioContext & { currentTime: number }, starts, stops };
}

afterEach(() => vi.unstubAllGlobals());

describe('音源ファイルの曲', () => {
  it('読みこめたら時計の位置から流し、ミュートで止め、戻すといまの位置から流し直す', async () => {
    vi.stubGlobal('fetch', async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }));
    const fake = fakeContext();
    const clip = new Clip('song.mp3', 0.75);
    clip.tick(fake.ctx, -2, 0);
    await new Promise((r) => setTimeout(r, 0));
    clip.tick(fake.ctx, -2, 0);
    // 時計の -2 秒は音源の -1.25 秒。1.25 秒後に頭から鳴らしはじめる
    expect(fake.starts).toEqual([{ when: 11.25, pos: 0 }]);
    clip.tick(fake.ctx, -1.9, 0);
    expect(fake.starts).toHaveLength(1);
    clip.tick(undefined, 5, 0);
    expect(fake.stops).toHaveLength(1);
    clip.tick(fake.ctx, 5, 0.1);
    expect(fake.starts[1]).toEqual({ when: 10, pos: 5.85 });
  });
});
