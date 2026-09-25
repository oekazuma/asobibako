import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/audio.svelte', () => ({ sink: () => undefined }));

const { SFX } = await import('./sounds');
const { CONTEST_SFX } = await import('./contest-sounds');
const { INSTRUMENTS, renderNote } = await import('./instruments');
const { RATE } = await import('./synth');

/** 作ったノードの数と、書いた波形と、鳴らした大きさだけを覚える AudioContext の代わり */
function fakeContext() {
  const made = { nodes: 0 };
  const plays: { data: Float32Array; gain: number }[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    cancelScheduledValues: () => {}
  });
  const node = () => {
    made.nodes++;
    const n = {
      gain: param(),
      frequency: param(),
      playbackRate: param(),
      buffer: null as { data: Float32Array } | null,
      curve: null,
      normalize: true,
      onended: null,
      connect: (to: unknown) => {
        const g = to as { gain?: { value: number } };
        if (n.buffer && g.gain) plays.push({ data: n.buffer.data, gain: g.gain.value });
        return to;
      },
      disconnect: () => {},
      start: () => {},
      stop: () => {}
    };
    return n;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    destination: node(),
    createGain: node,
    createBufferSource: node,
    createWaveShaper: node,
    createConvolver: node,
    createBuffer: (ch: number, n: number) => {
      const data = Array.from({ length: ch }, () => new Float32Array(n));
      return { data: data[0], getChannelData: (i: number) => data[i] };
    }
  } as unknown as BaseAudioContext;
  return { ctx, made, plays };
}

/** 引数がいる音には、いちばん重い引数を渡す */
const ARGS: Record<string, unknown[]> = {
  throw: ['frisbee'],
  beat: [true],
  rustle: [1],
  step: ['floor', false],
  land: ['sofa'],
  bounce: ['floor', 3, 'ball'],
  applause: [1],
  drum: [2600]
};

function check(name: string, play: (o: { ctx: BaseAudioContext; out: AudioNode; t: number }, ...a: unknown[]) => void) {
  const { ctx, made, plays } = fakeContext();
  const out = ctx.createGain();
  // 出口と響きの送り口は ctx ごとに 1 度だけ作るので、1 度鳴らしてから数える
  play({ ctx, out, t: 0 }, ...(ARGS[name] ?? []));
  made.nodes = 0;
  plays.length = 0;
  play({ ctx, out, t: 0 }, ...(ARGS[name] ?? []));
  expect(made.nodes, `${name} のノード`).toBeLessThanOrEqual(24);
  expect(plays.length, `${name} が鳴らない`).toBeGreaterThan(0);
  for (const p of plays) {
    let peak = 0;
    for (const v of p.data) {
      expect(Number.isFinite(v), `${name} に NaN`).toBe(true);
      peak = Math.max(peak, Math.abs(v));
    }
    expect(peak, `${name} が無音`).toBeGreaterThan(1e-3);
    expect(peak * p.gain, `${name} が割れる`).toBeLessThan(0.6);
  }
}

// 波形を JS で計算するので、CI の遅いマシンでは 1 つの音に 5 秒を超えることがある
describe('効果音', { timeout: 30_000 }, () => {
  it.each(Object.keys(SFX))('%s はノードを作りすぎず、無音でも NaN でもなく、割れない', (name) =>
    check(name, SFX[name as keyof typeof SFX] as never)
  );
  it.each(Object.keys(CONTEST_SFX))('コンテストの %s も同じ', (name) =>
    check(name, CONTEST_SFX[name as keyof typeof CONTEST_SFX] as never)
  );
});

describe('楽器', { timeout: 30_000 }, () => {
  it.each(INSTRUMENTS)('%s は低い音から高い音まで、鳴って NaN が出ない', (name) => {
    for (const f of [82, 262, 784, 2093]) {
      const d = renderNote(name, f);
      let peak = 0;
      for (const v of d) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak, `${name} ${f}Hz`).toBeGreaterThan(0.05);
      expect(peak, `${name} ${f}Hz`).toBeLessThan(3);
    }
  });

  it('打つ楽器は鳴らしたあと消えていく（ずっと鳴り続けない）', () => {
    for (const name of ['marimba', 'xylo', 'glock', 'bell', 'box', 'harp'] as const) {
      const d = renderNote(name, 523);
      const rms = (from: number, to: number) => {
        let s = 0;
        for (let i = from; i < to; i++) s += d[i] * d[i];
        return Math.sqrt(s / (to - from));
      };
      const w = Math.round(RATE * 0.05);
      expect(rms(d.length - w, d.length), name).toBeLessThan(rms(0, w) * 0.3);
    }
  });
});
