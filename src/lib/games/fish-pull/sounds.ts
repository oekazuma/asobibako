import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  /** たぐった長さに合わせて、リールを巻く音を刻む */
  reel: (player: 1 | 2) => tone(player === 1 ? 880 : 740, 18, 'square', 0.03),
  thrash: () => {
    noise(380, 0.14);
    tone(260, 120, 'triangle', 0.08);
  },
  snap: () => sweep(1200, 110, 260, 0.14)
};
