import { sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  head: () => tone(660, 90, 'sine', 0.1),
  hatch: () => {
    sweep(300, 900, 180, 0.1);
    tone(1175, 160, 'triangle', 0.08, 160);
  },
  miss: () => tone(220, 90, 'sine', 0.06)
};
