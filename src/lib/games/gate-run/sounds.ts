import { noise, tone } from '$lib/audio.svelte';

export const sounds = {
  good: () => {
    tone(784, 80);
    tone(1175, 140, 'triangle', 0.12, 60);
  },
  bad: () => tone(220, 200, 'sawtooth', 0.07),
  bump: () => tone(1320, 30, 'square', 0.03),
  pop: () => noise(30, 0.04),
  loot: () => {
    tone(660, 70);
    tone(990, 70, 'triangle', 0.12, 60);
    tone(1320, 160, 'triangle', 0.12, 120);
  },
  hit: () => noise(40, 0.05),
  fail: () => tone(150, 500, 'sawtooth', 0.08)
};
