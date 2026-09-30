import { sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  right: () => {
    tone(784, 120);
    tone(1047, 220, 'triangle', 0.14, 110);
  },
  close: () => tone(523, 160, 'sine', 0.12),
  wrong: () => tone(247, 110, 'square', 0.05),
  turn: () => sweep(440, 880, 220)
};
