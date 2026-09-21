import { sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  grab: () => tone(520, 50, 'triangle', 0.1),
  good: () => {
    tone(660, 90);
    tone(990, 140, 'triangle', 0.14, 70);
  },
  bad: () => tone(140, 220, 'sawtooth', 0.1),
  /** お題が変わったことは、見ていなくても音で気づけるようにする */
  target: () => {
    tone(1320, 80, 'sine', 0.12);
    tone(1760, 120, 'sine', 0.1, 90);
  },
  steal: () => sweep(700, 200, 200, 0.1)
};
