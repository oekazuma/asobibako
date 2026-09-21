import { tone } from '$lib/audio.svelte';

export const sounds = {
  flip: () => tone(520, 40, 'square', 0.04),
  score: () => {
    tone(880, 90);
    tone(1320, 160, 'triangle', 0.14, 70);
  },
  fault: () => tone(130, 260, 'sawtooth', 0.08)
};
