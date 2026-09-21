import { sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  hit: () => tone(420, 40, 'square', 0.06),
  send: () => sweep(500, 1500, 140, 0.06),
  land: () => tone(160, 50, 'triangle', 0.05),
  /** 残り 5 秒からの秒読み */
  count: (last: boolean) => tone(last ? 1320 : 880, last ? 260 : 90, 'triangle', 0.14)
};
