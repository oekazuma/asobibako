import { bus } from '$lib/audio.svelte';
import { BREEDS } from './breeds';
import type { PetFx } from './effects';
import type { BreedId } from './types';

/**
 * 子犬・子猫の鳴き声。のこぎり波（声帯）と息のノイズを、母音の高さに合わせた bandpass 3 つ（フォルマント）に通し、
 * 音の高さと母音を 1 声のあいだに動かして「ワン」「ニャー」に聞かせる。
 * 組み立て（render）は ctx と出口を受け取るので、OfflineAudioContext でも同じ声を書き出せる
 */

export type Cry = 'happy' | 'sweet' | 'answer' | 'yawn' | 'sleep' | 'bath' | 'proud' | 'grumble' | 'purr';

/** 母音のフォルマント（Hz）。子どもの声に近い高めの値で、体の小さい種類ほど size で上へずらす */
const VOWEL = {
  a: [900, 1500, 2900],
  i: [380, 2600, 3500],
  u: [400, 1000, 2500],
  e: [550, 2000, 2900],
  o: [550, 950, 2700],
  n: [300, 1400, 2700]
} as const;
type Vowel = keyof typeof VOWEL;
const Q = [7, 9, 11];
const LEVEL = [1.6, 1.1, 0.55];

interface Syl {
  at: number;
  ms: number;
  /** base に掛ける高さ。1 声の長さに等間隔に並べ、あいだは直線でつなぐ */
  pitch: number[];
  vowel: Vowel[];
  gain: number;
  breath?: number;
  /** 声帯の音の量。寝息は息がほとんど */
  voiced?: number;
}

/**
 * 種類ごとの声。f は声の高さ（Hz）、size はフォルマントの倍率、len は長さの倍率。
 * 高い声は倍音がフォルマントの山から外れて小さく聞こえるので、gain で書き出した大きさをそろえてある
 */
const VOICE: Record<BreedId, { f: number; size: number; len: number; gain: number }> = {
  shiba: { f: 600, size: 1, len: 1, gain: 1 },
  beagle: { f: 520, size: 0.92, len: 1.2, gain: 1 },
  poodle: { f: 760, size: 1.15, len: 0.8, gain: 1.4 },
  mike: { f: 800, size: 1, len: 1, gain: 2.2 },
  kuro: { f: 720, size: 0.95, len: 1.2, gain: 1.9 },
  saba: { f: 880, size: 1.08, len: 0.85, gain: 2.4 }
};

const wan = (at: number, ms: number, top = 1.4, gain = 1): Syl => ({
  at,
  ms,
  pitch: [0.8, top, top * 0.9, 0.75],
  vowel: ['u', 'a', 'a', 'n'],
  gain,
  breath: 0.2
});

function dog(cry: Cry, l: number, rnd: () => number): Syl[] {
  switch (cry) {
    case 'happy': {
      const n = rnd() < 0.5 ? 2 : 3;
      return Array.from({ length: n }, (_, i) => wan(i * 0.19 * l, 140 * l, 1.4 + i * 0.05, 1 - i * 0.1));
    }
    case 'answer':
      return [wan(0, 190 * l, 1.55, 1.1)];
    case 'sweet':
      return [{ at: 0, ms: 750 * l, pitch: [1.2, 1.6, 1.55, 1.3, 1], vowel: ['u', 'u', 'u', 'n', 'n'], gain: 0.8 }];
    case 'proud':
      return [
        { at: 0, ms: 110 * l, pitch: [0.7, 0.9, 0.7], vowel: ['u', 'a', 'u'], gain: 0.6, breath: 0.5 },
        wan(0.17 * l, 180 * l, 1.5, 1.1)
      ];
    case 'bath':
      return [wan(0, 110 * l, 1.7, 0.9), wan(0.15 * l, 110 * l, 1.8, 0.9), wan(0.3 * l, 160 * l, 1.6)];
    case 'grumble':
      return [{ at: 0, ms: 420 * l, pitch: [0.5, 0.55, 0.5], vowel: ['u', 'o', 'u'], gain: 0.7, breath: 0.4 }];
    default:
      return shared(cry, l);
  }
}

function cat(cry: Cry, l: number): Syl[] {
  switch (cry) {
    case 'happy':
    case 'proud':
      return [{ at: 0, ms: 480 * l, pitch: [0.85, 1.2, 1.3, 1.1, 0.9], vowel: ['i', 'e', 'a', 'a', 'o'], gain: 0.9 }];
    case 'sweet':
      return [
        {
          at: 0,
          ms: 850 * l,
          pitch: [0.9, 1.25, 1.35, 1.25, 1.05, 0.85],
          vowel: ['n', 'i', 'a', 'a', 'a', 'n'],
          gain: 0.85
        }
      ];
    case 'answer':
      return [{ at: 0, ms: 260 * l, pitch: [0.9, 1, 1.4], vowel: ['n', 'i', 'a'], gain: 1.5 }];
    case 'grumble':
    case 'bath':
      return [{ at: 0, ms: 150 * l, pitch: [1.25, 1, 0.7], vowel: ['n', 'a', 'a'], gain: 0.6, breath: 0.35 }];
    default:
      return shared(cry, l);
  }
}

/** あくびと寝息は犬も猫も同じ形で、高さだけが違う */
function shared(cry: Cry, l: number): Syl[] {
  if (cry === 'yawn')
    return [
      {
        at: 0,
        ms: 950 * l,
        pitch: [1.1, 1.5, 1.2, 0.8, 0.6],
        vowel: ['i', 'a', 'a', 'o', 'u'],
        gain: 0.7,
        breath: 0.6,
        voiced: 0.6
      }
    ];
  return [
    { at: 0, ms: 700, pitch: [0.3, 0.3], vowel: ['u', 'o'], gain: 0.25, breath: 1, voiced: 0.05 },
    { at: 0.9, ms: 1000, pitch: [0.3, 0.25], vowel: ['o', 'u'], gain: 0.3, breath: 1, voiced: 0.1 }
  ];
}

const noises = new WeakMap<BaseAudioContext, AudioBuffer>();

function whiteNoise(ctx: BaseAudioContext): AudioBuffer {
  let b = noises.get(ctx);
  if (b) return b;
  b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noises.set(ctx, b);
  return b;
}

function curve(p: AudioParam, pts: readonly number[], at: number, len: number) {
  p.setValueAtTime(pts[0], at);
  for (let i = 1; i < pts.length; i++) p.linearRampToValueAtTime(pts[i], at + (len * i) / (pts.length - 1));
}

function syllable(ctx: BaseAudioContext, out: AudioNode, t0: number, s: Syl, f: number, size: number, gain: number) {
  const at = t0 + s.at;
  const len = s.ms / 1000;
  const end = at + len;
  const src = ctx.createGain();
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  curve(
    osc.frequency,
    s.pitch.map((k) => k * f),
    at,
    len
  );
  const voiced = ctx.createGain();
  voiced.gain.value = s.voiced ?? 1;
  osc.connect(voiced).connect(src);
  osc.start(at);
  osc.stop(end + 0.02);
  if (s.breath) {
    const n = ctx.createBufferSource();
    n.buffer = whiteNoise(ctx);
    const g = ctx.createGain();
    g.gain.value = s.breath;
    n.connect(g).connect(src);
    n.start(at, Math.random() * 0.5);
    n.stop(end + 0.02);
  }
  const amp = ctx.createGain();
  const peak = s.gain * gain;
  amp.gain.setValueAtTime(0, at);
  amp.gain.linearRampToValueAtTime(peak, at + Math.min(0.025, len * 0.2));
  amp.gain.setValueAtTime(peak, at + len * 0.5);
  amp.gain.exponentialRampToValueAtTime(0.0001, end);
  for (let i = 0; i < 3; i++) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = Q[i];
    curve(
      bp.frequency,
      s.vowel.map((v) => VOWEL[v][i] * size),
      at,
      len
    );
    const g = ctx.createGain();
    g.gain.value = LEVEL[i];
    src.connect(bp).connect(g).connect(amp);
  }
  amp.connect(out);
}

/**
 * ゴロゴロ。25 回/秒ほどの低いのこぎり波（1 回ごとに息の強さで脈打つ）を低い音だけ残して、
 * 吸う・吐くの 2 回で大きさを揺らす
 */
function purr(ctx: BaseAudioContext, out: AudioNode, t0: number, gain: number): number {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(24, t0);
  osc.frequency.linearRampToValueAtTime(27, t0 + 0.5);
  osc.frequency.linearRampToValueAtTime(23, t0 + 1.1);
  const n = ctx.createBufferSource();
  n.buffer = whiteNoise(ctx);
  const ng = ctx.createGain();
  ng.gain.value = 0.25;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.Q.value = 2;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain * 0.7, t0 + 0.15);
  amp.gain.linearRampToValueAtTime(gain * 0.4, t0 + 0.5);
  amp.gain.linearRampToValueAtTime(gain, t0 + 0.7);
  amp.gain.linearRampToValueAtTime(0, t0 + 1.1);
  osc.connect(lp);
  n.connect(ng).connect(lp);
  lp.connect(amp).connect(out);
  osc.start(t0);
  n.start(t0);
  osc.stop(t0 + 1.15);
  n.stop(t0 + 1.15);
  return 1.1;
}

/** 声の大きさ。効果音（tone の 0.14 前後）と並んで聞こえる大きさ */
const GAIN = 0.2;

/** ctx の時刻 t0 から鳴らし、鳴り終わるまでの秒を返す */
export function render(
  ctx: BaseAudioContext,
  out: AudioNode,
  t0: number,
  breed: BreedId,
  cry: Cry,
  rnd: () => number = Math.random
): number {
  const v = VOICE[breed];
  const isDog = BREEDS[breed].kind === 'dog';
  if (cry === 'purr') {
    if (isDog) cry = 'sweet';
    else return purr(ctx, out, t0, GAIN * 0.55);
  }
  // 同じ子でも毎回少しずつ高さを変える。いつも同じ高さだと録音を流しているように聞こえる
  const f = v.f * (0.96 + rnd() * 0.08);
  const syl = isDog ? dog(cry, v.len, rnd) : cat(cry, v.len);
  for (const s of syl) syllable(ctx, out, t0, s, f, v.size, GAIN * v.gain);
  return Math.max(...syl.map((s) => s.at + s.ms / 1000));
}

const LABEL: Record<'dog' | 'cat', Record<Cry, string>> = {
  dog: {
    happy: 'ワンワン！',
    answer: 'ワン！',
    sweet: 'クゥーン',
    proud: 'ワフッ！',
    bath: 'ワンワン！',
    grumble: 'ウゥ…',
    yawn: 'ふぁ〜',
    sleep: '',
    purr: 'クゥーン'
  },
  cat: {
    happy: 'ミャー',
    proud: 'ミャー',
    sweet: 'ニャーン',
    answer: 'ニャ？',
    grumble: 'ニャッ！',
    bath: 'ニャッ！',
    yawn: 'ふぁ〜',
    sleep: '',
    purr: 'ゴロゴロ'
  }
};

/** 鳴っている声の終わる時刻。重なるのは 2 声まで、次の声は前の声の出だしから少しあける */
const busy: number[] = [];
let lastStart = -1;
const MAX_VOICES = 2;
const GAP = 0.3;

/**
 * 鳴かせて、ふきだしに出す文字を返す。ほかの声で混んでいて鳴かなかったときは ''
 * （声が聞こえないのに文字だけ出ると合わない）。ミュート中は音なしで文字だけ返す
 */
export function speak(breed: BreedId, cry: Cry): string {
  const label = LABEL[BREEDS[breed].kind][cry];
  const ctx = bus();
  if (!ctx) return label;
  const now = ctx.currentTime;
  for (let i = busy.length - 1; i >= 0; i--) if (busy[i] <= now) busy.splice(i, 1);
  if (busy.length >= MAX_VOICES || now - lastStart < GAP) return '';
  lastStart = now;
  busy.push(now + render(ctx, ctx.destination, now + 0.01, breed, cry));
  return label;
}

/** 鳴かせて、鳴いたら頭の上（at）にふきだしの文字を浮かべる */
export function speakAt(fx: PetFx, breed: BreedId, cry: Cry, [x, y]: [number, number]): void {
  const label = speak(breed, cry);
  if (label) fx.text(label, x, y - 34, BREEDS[breed].kind === 'dog' ? '#ff8a3d' : '#ff5fa2', 26);
}
