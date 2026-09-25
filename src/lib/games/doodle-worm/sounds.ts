import { sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  line: () => tone(660, 60, 'sine', 0.06),
  hatch: () => {
    sweep(300, 900, 180, 0.1);
    tone(1175, 160, 'triangle', 0.08, 160);
  },
  boing: () => sweep(260, 780, 220, 0.1),
  undo: () => tone(220, 90, 'sine', 0.06)
};
