import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  /** 拍の半ばの予告と、拍そのもの */
  tick: () => tone(660, 50, 'square', 0.05),
  beat: () => tone(990, 80, 'square', 0.08),
  choose: () => tone(1320, 40, 'triangle', 0.06),
  charge: () => sweep(300, 900, 180, 0.07),
  hit: () => noise(260, 0.28),
  block: () => {
    tone(1800, 120, 'square', 0.06);
    tone(2400, 160, 'square', 0.04, 40);
  },
  clash: () => {
    noise(120, 0.15);
    tone(1500, 200, 'sawtooth', 0.05);
  },
  empty: () => tone(140, 160, 'sawtooth', 0.07)
};
