import { sink } from '$lib/audio.svelte';
import { note } from './instruments';
import { decay, type At } from './sounds';
import { biquad, hiss, logRand, play, rand, RATE, ring, sfxOut, shot, thump, wave, white } from './synth';

/**
 * コンテストの合図と観客の声。はく手は手拍子の粒を人数ぶん散らし、歓声はのこぎり波の声を母音の帯域に通す。
 * ホイッスルは中の玉が回って高さと強さが細かく震える音、ドラムロールは小太鼓を細かく打つ
 */

/** 観客の「わー」。高さの違う声を、あの母音の 2 つの帯域に通して重ねる */
function cheer(d: Float32Array, sr: number, voices: number) {
  for (let v = 0; v < voices; v++) {
    const f0 = rand(220, 440);
    const at = rand(0, 0.25);
    const len = rand(0.7, 1.1);
    const f1 = biquad('bp', sr, rand(750, 900), 3);
    const f2 = biquad('bp', sr, rand(1150, 1350), 4);
    const i0 = Math.round(at * sr);
    const n = Math.min(d.length - i0, Math.round(len * sr));
    let ph = 0;
    let step = 0;
    let env = 0;
    for (let j = 0; j < n; j++) {
      // 高さと大きさは 64 サンプルごとに決めれば足りる（毎サンプル計算すると iPad で 1 フレームを越える）
      if (j % 64 === 0) {
        const u = j / n;
        step = (f0 * (1 + 0.08 * u + 0.01 * Math.sin(j / 600))) / sr;
        env = 0.08 * Math.min(1, u / 0.1) * (1 - u) ** 1.2;
      }
      ph += step;
      const src = 2 * (ph % 1) - 1 + 0.3 * white();
      d[i0 + j] += (f1.run(src) + 0.6 * f2.run(src)) * env;
    }
  }
}

/**
 * 手拍子の粒。手のひらの空気が鳴る帯域は人ごとに違うので、帯域の違う 24 個を 1 度だけ作り、人に割り当てて足す
 * （何百回もその場でノイズを絞ると iPad で 1 フレームを越える）
 */
let claps: Float32Array[] | null = null;
function clapBank() {
  return (claps ??= Array.from({ length: 24 }, () => {
    const c = wave(rand(0.008, 0.016));
    hiss(c, RATE, 0, 1, rand(600, 1200), rand(2500, 6000), 1, decay(5));
    return c;
  }));
}

function applauseFill(d: Float32Array, sr: number, power: number, span: number) {
  const people = Math.round(8 + 22 * power);
  const bank = clapBank();
  for (let p = 0; p < people; p++) {
    const c = bank[p % bank.length];
    const rate = rand(3.5, 6);
    for (let at = rand(0, 0.15); at < span; at += (1 / rate) * rand(0.85, 1.15)) {
      const u = at / span;
      const k = Math.min(1, u / 0.1) * (u > 0.6 ? (1 - u) / 0.4 : 1) * rand(0.1, 0.22);
      const i0 = Math.round(at * sr);
      for (let j = 0; j < c.length && i0 + j < d.length; j++) d[i0 + j] += c[j] * k;
    }
  }
  hiss(d, sr, 0, span, 300, 2500, 0.03 * power, (u) => Math.sin(Math.PI * u));
  if (power >= 0.6) cheer(d, sr, 6);
}

/** 本物のホイッスル。中の玉が回るあいだ、高さと強さが 1 秒に 35 回ほど震え、息のノイズが混じる */
function whistleFill(d: Float32Array, sr: number) {
  const bp = biquad('bp', sr, 2900, 3);
  let ph = 0;
  const n = Math.round(0.55 * sr);
  for (let i = 0; i < n && i < d.length; i++) {
    const t = i / sr;
    const trill = Math.sin(2 * Math.PI * 34 * t);
    ph += (2 * Math.PI * 2900 * (1 + 0.025 * trill)) / sr;
    const env = Math.min(1, t / 0.02) * Math.min(1, (0.55 - t) / 0.06);
    d[i] += env * ((0.8 + 0.2 * trill) * (Math.sin(ph) + 0.1 * Math.sin(2 * ph)) + 0.4 * bp.run(white()));
  }
}

/** 小太鼓のロール。打つ間隔を少し揺らし、だんだん強く */
function rollFill(d: Float32Array, sr: number) {
  const sec = d.length / sr;
  for (let at = 0; at < sec - 0.05; at += rand(0.04, 0.05)) {
    const k = (0.4 + 0.6 * (at / sec)) * rand(0.8, 1);
    thump(d, sr, at, 190, 0.35 * k, 0.02, 0.2);
    hiss(d, sr, at, 0.04, 1500, 7000, 0.45 * k, (u) => Math.exp(-u * 4), 0.3);
    hiss(d, sr, at, 0.02, 300, 1500, 0.15 * k, (u) => 1 - u);
  }
}

/** シンバル。金属の高い響きをいくつか重ねたシャーン */
function cymbalFill(d: Float32Array, sr: number) {
  hiss(d, sr, 0, 0.7, 3000, 12000, 0.3, (u) => Math.exp(-u * 5), 0.1);
  for (let i = 0; i < 6; i++) ring(d, sr, 0, logRand(3000, 9000), 0.03, rand(0.15, 0.35));
}

const inst = (o: At, name: 'xylo' | 'bell' | 'glock' | 'marimba', f: number, gain: number, dt = 0) =>
  play(o.ctx, o.out, o.t + dt, note(o.ctx, name, f), gain, { wet: 0.25 });

/** ホルンで楽譜の長さだけ吹く */
const horn = (o: At, f: number, dt: number, dur: number, gain: number) =>
  play(o.ctx, o.out, o.t + dt, note(o.ctx, 'horn', f), gain, { end: o.t + dt + dur, release: 0.1, wet: 0.3 });

export const CONTEST_SFX = {
  beep: (o: At) => inst(o, 'xylo', 880, 0.05),
  go: (o: At) => {
    inst(o, 'bell', 1318.5, 0.038);
    inst(o, 'glock', 2637, 0.015);
  },
  whistle: (o: At) => shot(o.ctx, o.out, o.t, 0.6, whistleFill, 0.074, { wet: 0.2 }),
  /** power 0..1 で、はく手の人数と長さが増え、大きいと歓声も上がる */
  applause: (o: At, power: number) => {
    const span = 0.8 + 1.4 * power;
    shot(o.ctx, o.out, o.t, span + 0.1, (d, sr) => applauseFill(d, sr, power, span), 0.8, { wet: 0.3 });
  },
  drum: (o: At, ms: number) => shot(o.ctx, o.out, o.t, ms / 1000, rollFill, 0.06, { wet: 0.2 }),
  reveal: (o: At) => {
    shot(o.ctx, o.out, o.t, 0.8, cymbalFill, 0.12, { wet: 0.3 });
    inst(o, 'marimba', 523.25, 0.06);
    inst(o, 'marimba', 783.99, 0.06, 0.09);
  },
  fanfare: (o: At) => {
    for (const [f, at] of [
      [523.25, 0],
      [523.25, 0.15],
      [523.25, 0.3],
      [659.25, 0.45],
      [783.99, 0.7]
    ])
      horn(o, f, at, 0.14, 0.06);
    horn(o, 1046.5, 0.9, 0.7, 0.055);
    horn(o, 783.99, 0.9, 0.7, 0.05);
    horn(o, 523.25, 0.9, 0.7, 0.045);
    inst(o, 'glock', 2093, 0.03, 0.9);
  },
  miss: (o: At) => {
    inst(o, 'marimba', 329.63, 0.04);
    inst(o, 'marimba', 261.63, 0.04, 0.15);
  }
};

type Args<K extends keyof typeof CONTEST_SFX> = (typeof CONTEST_SFX)[K] extends (o: At, ...a: infer A) => void
  ? A
  : never;

export const contestSounds = Object.fromEntries(
  Object.entries(CONTEST_SFX).map(([k, f]) => [
    k,
    (...a: unknown[]) => {
      const ctx = sink();
      if (ctx) (f as (o: At, ...a: unknown[]) => void)({ ctx, out: sfxOut(ctx), t: ctx.currentTime + 0.005 }, ...a);
    }
  ])
) as { [K in keyof typeof CONTEST_SFX]: (...a: Args<K>) => void };
