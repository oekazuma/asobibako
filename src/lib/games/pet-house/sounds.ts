import { noise, sweep, tone } from '$lib/audio.svelte';

/** sweep() は遅らせて鳴らせないので、音をつなぐときはタイマーで後ろへずらす */
const later = (ms: number, play: () => void) => setTimeout(play, ms);

export const sounds = {
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
  /** リズムあそびでノーツを叩いた、ぽん。ぴったりは高く */
  beat: (great: boolean) => {
    tone(great ? 1568 : 1175, 110, 'sine', 0.07);
    noise(25, 0.05);
  },
  /** スタンプを押す、ぽんっ。落ちてきて台紙に当たる音のあとに、覚えたときのファンファーレ */
  stamp: () => {
    later(180, () => {
      sweep(240, 70, 110, 0.16);
      noise(50, 0.12);
    });
    later(300, sounds.learned);
  },
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
  },
  /** ねこじゃらしの羽根がこすれる、しゅっ。k は振る強さ 0..1 */
  rustle: (k: number) => {
    for (let i = 0; i < 3; i++) later(i * 35 + Math.random() * 15, () => noise(22, 0.006 + 0.014 * k));
  },
  /** 猫が飛びかかる、とんっ。床を蹴る低い音に爪のこすれを重ねる */
  leap: () => {
    sweep(170, 70, 130, 0.1);
    noise(40, 0.04);
    later(70, () => noise(30, 0.025));
  }
};
