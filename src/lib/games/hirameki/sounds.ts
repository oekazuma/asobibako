import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  pick: () => tone(660, 50, 'triangle', 0.08),
  wrong: () => {
    tone(330, 120, 'square', 0.05);
    tone(247, 260, 'square', 0.05, 130);
  },
  /** 考え中の刻み。k が進むほど高くなる（間隔は Verdict が詰めていく） */
  tick: (k: number) => {
    tone(520 + k * 40, 45, 'square', 0.035);
    noise(35, 0.04);
  },
  /** ナゾ解明。上がっていく音のあとに和音 */
  solved: () => {
    [523, 659, 784].forEach((f, i) => tone(f, 130, 'triangle', 0.12, i * 110));
    [659, 784, 1047].forEach((f) => tone(f, 700, 'triangle', 0.1, 360));
  },
  miss: () => {
    sweep(440, 200, 700, 0.08);
    tone(196, 500, 'triangle', 0.1, 300);
  },
  pour: () => {
    sweep(300, 700, 380, 0.06);
    noise(300, 0.03);
  },
  boat: () => {
    noise(160, 0.05);
    sweep(260, 180, 400, 0.05);
  }
};
