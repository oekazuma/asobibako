import { biquad, click, hiss, pluck, RATE, ring, toBuffer, wave, white } from './synth';

/**
 * 本物の楽器に近い音色。打つ楽器は板や棒の倍音の比（整数倍ではない）で減衰の違うサイン波を重ね、
 * 打った瞬間の短いノイズを足す。のばす楽器は数秒ぶんを書いておき、鳴らす側が楽譜の長さで切る。
 * 同じ高さの音は ctx ごとに 1 度だけ計算して使い回す
 */

type Make = (d: Float32Array, sr: number, f: number) => void;

/** 高い音ほど早く消える（小さい板・短い弦）。440Hz で 1 */
const shorter = (f: number, k = 0.5) => (440 / f) ** k;

const DEFS = {
  /** マリンバ。基音と 4 倍・10 倍近くの倍音、フェルトのばちの柔らかいトン */
  marimba: {
    sec: 1.3,
    make: (d, sr, f) => {
      const s = shorter(f, 0.6);
      ring(d, sr, 0, f, 1, 0.45 * s);
      ring(d, sr, 0, f * 3.93, 0.22, 0.09 * s);
      ring(d, sr, 0, f * 9.54, 0.06, 0.03 * s);
      hiss(d, sr, 0, 0.006, 200, 2500, 0.2);
    }
  },
  /** 木琴。3 倍（12 度上）の倍音が強く、マリンバより明るく短い */
  xylo: {
    sec: 0.9,
    make: (d, sr, f) => {
      const s = shorter(f, 0.6);
      ring(d, sr, 0, f, 1, 0.22 * s);
      ring(d, sr, 0, f * 3.0, 0.7, 0.1 * s);
      ring(d, sr, 0, f * 6.24, 0.35, 0.04 * s);
      ring(d, sr, 0, f * 10.3, 0.15, 0.015 * s);
      click(d, sr, 0, 0.2, 2500, 7000, 0.002);
    }
  },
  /** 鉄琴・鈴。金属の棒の倍音（2.76・5.40・8.93 倍）が長く残る */
  glock: {
    sec: 1.8,
    make: (d, sr, f) => {
      const s = shorter(f, 0.4);
      ring(d, sr, 0, f, 1, 0.9 * s);
      ring(d, sr, 0, f * 2.756, 0.35, 0.3 * s);
      ring(d, sr, 0, f * 5.404, 0.18, 0.12 * s);
      ring(d, sr, 0, f * 8.933, 0.08, 0.05 * s);
      click(d, sr, 0, 0.06, 4000, 9000, 0.0015);
    }
  },
  /** ハンドベル。基音のすぐ隣の音でゆっくりうなり、3 倍の音が鐘らしさを出す */
  bell: {
    sec: 2.4,
    make: (d, sr, f) => {
      const s = shorter(f, 0.35);
      ring(d, sr, 0, f, 1, 1.3 * s);
      ring(d, sr, 0, f * 1.0023, 0.5, 1.3 * s);
      ring(d, sr, 0, f * 3.01, 0.4, 0.55 * s);
      ring(d, sr, 0, f * 4.23, 0.16, 0.25 * s);
      ring(d, sr, 0, f * 5.42, 0.1, 0.15 * s);
      click(d, sr, 0, 0.05, 3000, 8000, 0.002);
    }
  },
  /** オルゴール。櫛の歯（片持ちの棒）の倍音 6.27 倍と、歯をはじくピンの小さいチッ */
  box: {
    sec: 2.2,
    make: (d, sr, f) => {
      const s = shorter(f, 0.5);
      ring(d, sr, 0, f, 1, 1.1 * s);
      ring(d, sr, 0, f * 1.0015, 0.25, 0.9 * s);
      ring(d, sr, 0, f * 6.27, 0.2, 0.08 * s);
      ring(d, sr, 0, f * 17.55, 0.05, 0.02 * s);
      click(d, sr, 0, 0.05, 5000, 11000, 0.001);
    }
  },
  /** ハープ風の弦 */
  harp: {
    sec: 1.6,
    make: (d, sr, f) => pluck(d, sr, f, 0.9, 1.4 * shorter(f, 0.3), 0.45)
  },
  /** ウッドベース風。暗くはじいて、胴の低い響きを足す */
  bass: {
    sec: 1.6,
    make: (d, sr, f) => {
      pluck(d, sr, f, 0.8, 1.3, 0.25);
      ring(d, sr, 0, f, 0.5, 0.35);
    }
  },
  /** しずく。はじめ少し低くて、すっと本当の高さへ上がる水の粒のような丸い音 */
  drop: {
    sec: 1,
    make: (d, sr, f) => {
      const s = shorter(f, 0.5);
      const n = Math.min(d.length, Math.ceil(0.9 * s * 7 * sr));
      let ph = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const k = 1 - 0.12 * Math.exp(-t / 0.012);
        d[i] += Math.sin(ph) * Math.exp(-t / (0.35 * s)) * Math.min(1, t / 0.002);
        ph += (2 * Math.PI * f * k) / sr;
      }
      ring(d, sr, 0, f * 2, 0.12, 0.08 * s);
    }
  },
  /**
   * やわらかいパッド。少しずつずらした 2 声の、上の倍音ほど小さい音をゆっくり立ち上げる（弦や声のまとまり）
   */
  pad: {
    sec: 3.3,
    sr: 16000,
    make: (d, sr, f) => {
      for (const det of [0.997, 1.003])
        for (let h = 1; h <= 4; h++) {
          const fh = f * det * h;
          if (fh > sr * 0.45) break;
          const a = 0.5 / h ** 1.8;
          const ph0 = Math.random() * 6.28;
          for (let i = 0; i < d.length; i++) d[i] += a * Math.sin(ph0 + (2 * Math.PI * fh * i) / sr);
        }
      shape(d, sr, 0.25, 3.3);
    }
  },
  /** 笛。基音に弱い倍音と息のノイズ、少し遅れてかかるビブラート */
  flute: {
    sec: 2.6,
    sr: 24000,
    make: (d, sr, f) => {
      const bp = biquad('bp', sr, f * 2, 2);
      let ph = 0;
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const vib = 1 + 0.006 * Math.min(1, Math.max(0, (t - 0.25) / 0.3)) * Math.sin(2 * Math.PI * 5.2 * t);
        ph += (2 * Math.PI * f * vib) / sr;
        const chiff = 0.25 * Math.exp(-t / 0.04);
        d[i] = Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.07 * Math.sin(3 * ph) + bp.run(white()) * (0.18 + chiff);
      }
      shape(d, sr, 0.06, 2.6);
    }
  },
  /** 小太鼓をブラシでたたいたシャッ。高さはないので f は使わない */
  snare: {
    sec: 0.08,
    make: (d, sr) => {
      hiss(d, sr, 0, 0.06, 1800, 8000, 0.5, (u) => Math.exp(-u * 4), 0.3);
      ring(d, sr, 0, 200, 0.25, 0.012);
    }
  },
  /** ホルン風のやわらかいラッパ。吹きはじめは暗く、息が通ると上の倍音が開く */
  horn: {
    sec: 1.8,
    sr: 24000,
    make: (d, sr, f) => {
      const hs = Array.from({ length: 10 }, (_, i) => i + 1).filter((h) => f * h < sr * 0.45);
      const ph = Math.random();
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        const e = Math.min(1, t / 0.035);
        let v = 0;
        for (const h of hs) v += (e ** (1 + 0.6 * (h - 1)) / h ** 1.2) * Math.sin(2 * Math.PI * (f * h * t + ph * h));
        d[i] = v * 0.7;
      }
      shape(d, sr, 0.02, 1.8);
    }
  }
} satisfies Record<string, { sec: number; sr?: number; make: Make }>;

export type Instrument = keyof typeof DEFS;

/** のばす楽器の立ち上がりと、終わりへ向けたゆるい減り */
function shape(d: Float32Array, sr: number, attack: number, sec: number) {
  for (let i = 0; i < d.length; i++) {
    const t = i / sr;
    d[i] *= Math.min(1, t / attack) * (1 - 0.35 * (t / sec)) * Math.min(1, (sec - t) / 0.05);
  }
}

const cache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/**
 * 楽器の 1 音の AudioBuffer。高さは 1Hz 単位で丸めて使い回す。
 * ponytail: 捨てずに持ち続ける（1 曲で数十音、全部の曲で数 MB）。増えすぎたら古いものから捨てる
 */
export function note(ctx: BaseAudioContext, name: Instrument, f: number): AudioBuffer {
  const m = cache.get(ctx) ?? cache.set(ctx, new Map()).get(ctx)!;
  const key = `${name}:${Math.round(f)}`;
  let b = m.get(key);
  if (!b) m.set(key, (b = toBuffer(ctx, renderNote(name, f), rateOf(name))));
  return b;
}

const rateOf = (name: Instrument) => (DEFS[name] as { sr?: number }).sr ?? RATE;

/** 楽器の 1 音を計算して返す */
export function renderNote(name: Instrument, f: number): Float32Array {
  const d = wave(DEFS[name].sec, rateOf(name));
  (DEFS[name].make as Make)(d, rateOf(name), f);
  return d;
}

export const INSTRUMENTS = Object.keys(DEFS) as Instrument[];
