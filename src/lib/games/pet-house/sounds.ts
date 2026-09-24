import { noise, sweep, tone } from '$lib/audio.svelte';

/** sweep() は遅らせて鳴らせないので、音節をつなぐときはタイマーで後ろへずらす */
const later = (ms: number, play: () => void) => setTimeout(play, ms);

/**
 * 高さを段々に変えた短い音を重ねて、1 つの声の抑揚にする。
 * steps は [周波数, 始まる ms]。倍音のある波形を重ねると、正弦波の sweep だけより声らしくなる
 */
function voice(steps: [number, number][], len: number, type: OscillatorType, gain: number) {
  for (const [f, at] of steps) tone(f, len, type, gain, at);
}

/** ワン。一気に上がって落ちる短い 1 音に、息のノイズを混ぜる */
function wan(base: number, gain: number) {
  noise(35, gain * 0.5);
  sweep(base * 0.8, base * 1.5, 45, gain);
  later(40, () => sweep(base * 1.5, base * 0.7, 120, gain));
  voice(
    [
      [base, 0],
      [base * 1.35, 25],
      [base * 1.25, 60],
      [base, 95],
      [base * 0.8, 125]
    ],
    60,
    'sawtooth',
    gain * 0.35
  );
}

export const sounds = {
  bark: () => {
    wan(420, 0.12);
    later(230, () => wan(440, 0.1));
  },
  smallBark: () => {
    wan(760, 0.08);
    later(170, () => wan(800, 0.07));
  },
  /** ニャー。「ニ」で細く上がり、「ャー」で長く下がる */
  meow: () => {
    sweep(520, 880, 160, 0.08);
    later(150, () => sweep(880, 560, 380, 0.09));
    voice(
      [
        [540, 0],
        [680, 60],
        [820, 120],
        [860, 180],
        [800, 250],
        [720, 330],
        [630, 420]
      ],
      110,
      'triangle',
      0.035
    );
  },
  /** ゴロゴロ。低い音を 25 回/秒ほど小刻みに */
  purr: () => {
    for (let i = 0; i < 28; i++) tone(52 + (i % 2) * 6, 32, 'sawtooth', i % 7 < 4 ? 0.06 : 0.04, i * 38);
  },
  eat: () => {
    for (const at of [0, 140, 290]) later(at, () => noise(45, 0.08));
    tone(180, 60, 'square', 0.03, 140);
  },
  drink: () => {
    for (const at of [0, 160, 320]) later(at, () => sweep(320, 780, 70, 0.07));
  },
  sparkle: () => {
    for (const [f, at] of [
      [1568, 0],
      [2093, 60],
      [2637, 120],
      [3136, 180]
    ])
      tone(f, 160, 'sine', 0.05, at);
  },
  throw: () => {
    sweep(260, 900, 220, 0.07);
    noise(160, 0.04);
  },
  catch: () => {
    tone(660, 60, 'square', 0.05);
    tone(990, 120, 'triangle', 0.1, 50);
  },
  coin: () => {
    tone(988, 80, 'square', 0.05);
    tone(1319, 260, 'square', 0.05, 80);
  },
  learned: () => {
    for (const [f, at] of [
      [523, 0],
      [659, 110],
      [784, 220],
      [1047, 330]
    ])
      tone(f, 160, 'triangle', 0.12, at);
    tone(1047, 420, 'triangle', 0.1, 480);
    tone(1319, 420, 'triangle', 0.08, 480);
  },
  shutter: () => {
    noise(40, 0.15);
    tone(2400, 20, 'square', 0.04);
    later(90, () => noise(60, 0.1));
  },
  pop: () => sweep(380, 1250, 80, 0.1),
  /** 泡がはじける、ぷくぷく。高さを散らした短い音を 3 つ */
  foam: () => {
    for (let i = 0; i < 3; i++) tone(900 + Math.random() * 900, 45, 'sine', 0.035, i * 55 + Math.random() * 20);
  },
  /** シャワーのお湯。出しているあいだ 0.1 秒ごとに重ねて鳴らすと、ざーっと流れる音になる */
  shower: () => noise(160, 0.05),
  /** タオルでふく、ふきふき */
  towel: () => {
    noise(90, 0.04);
    later(110, () => noise(70, 0.03));
  },
  /** ぶるぶるっ。水を飛ばすしぶきの音を、体を振る速さで刻む */
  shake: () => {
    for (let i = 0; i < 12; i++) later(i * 105, () => noise(70, 0.09 - i * 0.005));
    for (let i = 0; i < 12; i++) tone(95 + (i % 2) * 20, 90, 'triangle', 0.05, i * 105);
  },
  /** 猫がいやがる、ニャッ。低く短く下がる */
  grumble: () => {
    sweep(640, 380, 220, 0.09);
    tone(300, 160, 'sawtooth', 0.02, 40);
  },
  /** おさんぽの足音。歩道を踏む短いこすれ */
  step: () => {
    noise(28, 0.035);
    tone(140, 30, 'sine', 0.03);
  },
  /** においをかぐ。鼻を鳴らす短い息を 3 回 */
  sniff: () => {
    for (const at of [0, 110, 220]) later(at, () => noise(55, 0.06));
  },
  /** おしっこ。細く長いノイズ */
  pee: () => {
    for (let i = 0; i < 9; i++) later(i * 150, () => noise(170, 0.025));
  },
  plop: () => {
    sweep(300, 110, 140, 0.1);
    later(120, () => noise(40, 0.05));
  },
  /** ほかの犬とあいさつ。高い 2 音が弾む */
  greet: () => {
    tone(784, 110, 'triangle', 0.09);
    tone(1175, 180, 'triangle', 0.09, 110);
  }
};
