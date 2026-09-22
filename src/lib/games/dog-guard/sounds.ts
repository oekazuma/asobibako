import { noise, tone } from '$lib/audio.svelte';

export const sounds = {
  ink: () => tone(900 + Math.random() * 200, 20, 'sine', 0.02),
  go: () => {
    tone(523, 90);
    tone(784, 160, 'triangle', 0.12, 80);
  },
  buzz: () => tone(180 + Math.random() * 40, 90, 'sawtooth', 0.025),
  bump: () => tone(700, 30, 'square', 0.03),
  stung: () => {
    noise(200, 0.2);
    tone(300, 400, 'sawtooth', 0.08);
  }
};
