import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  pull: () => sweep(400, 1200, 160, 0.08),
  coin: () => tone(1568 + Math.random() * 400, 60, 'triangle', 0.05),
  hiss: () => noise(200, 0.08),
  burn: () => {
    noise(500, 0.25);
    sweep(600, 80, 500, 0.1);
  }
};
