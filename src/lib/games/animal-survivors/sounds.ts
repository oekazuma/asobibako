import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  hit: () => noise(25, 0.03),
  kill: () => tone(880, 30, 'square', 0.025),
  pickup: (chain: number) => tone(1200 + Math.min(chain, 20) * 40, 40, 'square', 0.03),
  levelup: () => {
    tone(523, 120, 'square', 0.05);
    tone(659, 120, 'square', 0.05, 90);
    tone(784, 240, 'square', 0.05, 180);
  },
  hurt: () => tone(160, 120, 'sawtooth', 0.08),
  magnet: () => sweep(300, 1400, 400, 0.06),
  heal: () => {
    tone(660, 80, 'triangle', 0.08);
    tone(990, 160, 'triangle', 0.08, 70);
  },
  clear: () => {
    for (const [i, f] of [523, 659, 784, 1047].entries()) tone(f, 260, 'square', 0.05, i * 140);
  },
  dead: () => sweep(400, 80, 900, 0.1)
};
