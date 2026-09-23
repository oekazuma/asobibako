import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  select: () => tone(660, 50, 'triangle', 0.08),
  brush: () => noise(60, 0.05),
  drill: () => tone(820 + Math.random() * 60, 70, 'square', 0.03),
  ouch: () => sweep(520, 380, 160, 0.06),
  drilled: () => {
    tone(300, 80, 'square', 0.06);
    tone(200, 120, 'triangle', 0.1, 60);
  },
  grab: () => tone(990, 40, 'triangle', 0.08),
  escape: () => sweep(600, 300, 200, 0.06),
  byebye: () => {
    tone(784, 90);
    tone(988, 90, 'triangle', 0.14, 90);
    tone(1319, 260, 'triangle', 0.14, 180);
  },
  filled: () => sweep(300, 700, 180, 0.08),
  pulled: () => {
    noise(90, 0.15);
    tone(880, 120, 'triangle', 0.12, 60);
  },
  numb: () => {
    tone(1200, 60, 'sine', 0.06);
    tone(1600, 90, 'sine', 0.06, 60);
  },
  pat: () => tone(520 + Math.random() * 80, 60, 'sine', 0.05),
  sparkle: () => {
    tone(1568, 80, 'sine', 0.08);
    tone(2093, 140, 'sine', 0.08, 70);
  },
  wrong: () => {
    tone(330, 90, 'square', 0.05);
    tone(262, 140, 'square', 0.05, 90);
  },
  cry: () => sweep(700, 300, 600, 0.1)
};
