import { noise, tone } from '$lib/audio.svelte';

export const sounds = {
  good: () => {
    tone(784, 80);
    tone(1175, 140, 'triangle', 0.12, 60);
  },
  bad: () => tone(220, 200, 'sawtooth', 0.07),
  hit: () => noise(40, 0.05),
  fail: () => tone(150, 500, 'sawtooth', 0.08)
};
