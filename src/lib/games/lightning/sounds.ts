import { sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  go: () => tone(1320, 120, 'square', 0.08),
  score: () => {
    tone(880, 90);
    tone(1320, 160, 'triangle', 0.14, 70);
  },
  miss: () => tone(130, 220, 'sawtooth', 0.08),
  timeout: () => sweep(600, 300, 200, 0.06)
};
