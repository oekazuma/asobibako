import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  cheese: () => {
    tone(880, 70, 'square', 0.06);
    tone(1320, 110, 'square', 0.06, 70);
  },
  caught: () => {
    noise(180, 0.15);
    sweep(700, 160, 320, 0.14);
  },
  escape: () => {
    tone(660, 110);
    tone(880, 110, 'triangle', 0.14, 110);
    tone(1175, 220, 'triangle', 0.14, 220);
  },
  swap: () => sweep(300, 900, 260, 0.1),
  hop: () => sweep(500, 1400, 180, 0.08),
  count: () => tone(520, 90, 'square', 0.06)
};
