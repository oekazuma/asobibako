import { noise, tone } from '$lib/audio.svelte';

const later = (ms: number, play: () => void) => setTimeout(play, ms);

/** コンテストの合図と観客の声。はく手は短いノイズを散らして重ね、声援は高さの違う音を揺らして重ねる */
export const contestSounds = {
  beep: () => tone(880, 160, 'square', 0.06),
  go: () => tone(1320, 480, 'square', 0.07),
  /** ホイッスル。近い高さを 2 つ重ねると、うなりでピリピリ震える */
  whistle: () => {
    tone(2900, 520, 'sine', 0.07);
    tone(2965, 520, 'sine', 0.06);
  },
  /** power 0..1 で、はく手の数と長さが増える */
  applause: (power: number) => {
    const n = Math.round(12 + 40 * power);
    const span = 500 + 1300 * power;
    for (let i = 0; i < n; i++)
      later(Math.random() * span, () => noise(18 + Math.random() * 18, 0.025 + Math.random() * 0.04));
    if (power < 0.6) return;
    for (let i = 0; i < 6; i++) tone(320 + Math.random() * 260, 700, 'sawtooth', 0.008, Math.random() * 200);
  },
  /** 結果発表のドラムロール */
  drum: (ms: number) => {
    for (let at = 0; at < ms; at += 45) later(at, () => noise(30, 0.03 + (0.03 * at) / ms));
  },
  reveal: () => {
    noise(120, 0.08);
    tone(523, 180, 'triangle', 0.1);
    tone(784, 260, 'triangle', 0.1, 90);
  },
  fanfare: () => {
    for (const [f, at] of [
      [523, 0],
      [523, 150],
      [523, 300],
      [659, 450],
      [784, 700]
    ])
      tone(f, 200, 'square', 0.05, at);
    tone(1047, 700, 'square', 0.05, 900);
    tone(784, 700, 'triangle', 0.08, 900);
  },
  miss: () => {
    tone(330, 160, 'triangle', 0.08);
    tone(262, 300, 'triangle', 0.08, 150);
  }
};
