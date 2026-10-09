import { describe, expect, it } from 'vitest';
import { renderNote } from './instruments';
import { Loop } from './loop';
import { voices, type Song } from './tune';

const A: Song = {
  beats: 4,
  lead: 'chip',
  style: 'drive',
  melody: 'c5 . e5 . g5 . e5 . | d5 - - - b4 - . .',
  chords: 'C G'
};
const B: Song = {
  beats: 4,
  lead: 'chip',
  style: 'drive',
  melody: 'a4 . c5 . e5 . c5 . | e5 - - - . . . .',
  chords: 'Am E'
};

/** 鳴らした音の時刻と、高さ（楽器の音は高さごとに作る AudioBuffer の番号）だけを覚える AudioContext の代わり */
function fakeContext() {
  let buffers = 0;
  const starts: { t: number; f: number }[] = [];
  const param = () => {
    const p = {
      value: 0,
      setValueAtTime: (v: number) => void (p.value = v),
      linearRampToValueAtTime: () => {},
      exponentialRampToValueAtTime: () => {},
      cancelScheduledValues: () => {}
    };
    return p;
  };
  const node = () => {
    const n = {
      gain: param(),
      frequency: param(),
      Q: param(),
      delayTime: param(),
      playbackRate: param(),
      type: '',
      buffer: null as { id: number } | null,
      connect: (to: unknown) => to,
      disconnect: () => {},
      start: (t = 0) => starts.push({ t, f: n.frequency.value || (n.buffer?.id ?? 0) }),
      stop: () => {}
    };
    return n;
  };
  const ctx = {
    currentTime: 0,
    state: 'running',
    sampleRate: 8000,
    destination: node(),
    createGain: node,
    createOscillator: node,
    createBiquadFilter: node,
    createDelay: node,
    createBufferSource: node,
    createWaveShaper: node,
    createConvolver: node,
    createBuffer: (_c: number, n: number) => {
      ctx.made += 1;
      return { id: ++buffers, getChannelData: () => new Float32Array(n) };
    },
    made: 0
  };
  return { ctx: ctx as unknown as BaseAudioContext & { currentTime: number }, starts };
}

/** sec 秒ぶん 60Hz で tick し、そのあいだに始まった音を返す */
function run(loop: Loop, fake: ReturnType<typeof fakeContext>, sec: number) {
  const from = fake.starts.length;
  for (let i = 0; i < sec * 60; i++) {
    fake.ctx.currentTime += 1 / 60;
    loop.tick();
  }
  return fake.starts.slice(from);
}

describe('ピコピコ音の楽器', () => {
  it('どれも音が出て、太鼓はすぐ消える', () => {
    for (const name of ['pulse', 'tri', 'kick', 'hat'] as const) {
      const d = renderNote(name, 220);
      expect(d.some((v) => Math.abs(v) > 0.05)).toBe(true);
      expect(d.every(Number.isFinite)).toBe(true);
    }
    const kick = renderNote('kick', 0);
    expect(Math.abs(kick[kick.length - 1])).toBeLessThan(0.01);
  });
});

describe('Loop', () => {
  it('曲を流し、別の曲に替えると替わり、null で止まる', () => {
    const fake = fakeContext();
    const loop = new Loop(() => fake.ctx);
    loop.play(A, 140, 1);
    expect(run(loop, fake, 2).length).toBeGreaterThan(10);
    expect(loop.song).toBe(A);
    loop.play(B, 160, 1);
    run(loop, fake, 0.1);
    expect(loop.song).toBe(B);
    loop.play(null, 0, 0);
    run(loop, fake, 0.1);
    expect(run(loop, fake, 1).filter((s) => s.t > fake.ctx.currentTime + 0.6)).toEqual([]);
  });

  it('ミュートのあいだは鳴らさず、戻すと今の曲を頭から流す', () => {
    const fake = fakeContext();
    let muted = false;
    const loop = new Loop(() => (muted ? undefined : fake.ctx));
    loop.play(A, 140, 1);
    run(loop, fake, 1);
    muted = true;
    loop.play(B, 160, 1);
    const at = fake.ctx.currentTime;
    expect(run(loop, fake, 2).filter((s) => s.t > at + 0.6)).toEqual([]);
    muted = false;
    run(loop, fake, 0.5);
    expect(loop.song).toBe(B);
  });

  it('同じ曲で大きさだけ変えても頭から流し直さない', () => {
    const fake = fakeContext();
    const loop = new Loop(() => fake.ctx);
    loop.play(A, 140, 1);
    run(loop, fake, 1);
    const before = loop.step;
    loop.play(A, 140, 0.4);
    run(loop, fake, 0.05);
    expect(loop.step).toBeGreaterThanOrEqual(before);
  });

  it('warm した曲の音は、鳴らす前に 1 つずつ作っておく', () => {
    const fake = fakeContext();
    const loop = new Loop(() => fake.ctx);
    const before = (fake.ctx as unknown as { made: number }).made;
    loop.warm(B);
    run(loop, fake, 1);
    expect((fake.ctx as unknown as { made: number }).made).toBeGreaterThan(before + 3);
    expect(fake.starts).toEqual([]);
  });
});

describe('voices', () => {
  const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);
  const has = (song: Song, name: string, m: number) =>
    voices(song).some(([i, f]) => i === name && Math.abs(f - hz(m)) < 1e-6);

  it('行進曲と弾む曲は、伴奏の根音と 5 度の低い音・コードのはじく音・行進曲の小太鼓も先に作る', () => {
    const march: Song = { ...B, lead: 'flute', style: 'march' };
    // Am の根音 A2（45）と 5 度 E2（40）、コードの音は G3..F#4 に置いた A3・C4・E4
    for (const song of [march, { ...march, style: 'bounce' } as Song]) {
      expect(has(song, 'bass', 45)).toBe(true);
      expect(has(song, 'bass', 40)).toBe(true);
      for (const m of [57, 60, 64]) expect(has(song, 'harp', m)).toBe(true);
    }
    expect(voices(march).some(([i]) => i === 'snare')).toBe(true);
    expect(voices({ ...march, style: 'bounce' }).some(([i]) => i === 'snare')).toBe(false);
  });
});
