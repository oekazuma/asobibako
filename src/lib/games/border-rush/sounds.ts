import { tone } from '$lib/audio.svelte';

export const sounds = {
  tap: () => tone(660, 90),
  hold: () => {
    tone(520, 90);
    tone(780, 160, 'triangle', 0.14, 70);
  },
  contest: () => {
    tone(990, 120, 'square', 0.1);
    tone(1320, 180, 'square', 0.08, 90);
  }
};
