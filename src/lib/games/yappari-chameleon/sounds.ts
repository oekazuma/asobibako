import { noise, sfx, sweep, tone } from '$lib/audio.svelte';

/** 本家に声は無いので、効果音だけにする */
export const sounds = {
  spray: () => noise(120, 0.05),
  cling: () => tone(140, 70, 'sine', 0.2),
  pick: () => sweep(500, 1100, 120, 0.1),
  done: () => sfx.finish(),
  button: () => tone(660, 40, 'triangle', 0.08)
};
