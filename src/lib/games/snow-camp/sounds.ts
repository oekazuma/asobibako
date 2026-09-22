import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  hit: () => noise(60, 0.1),
  kill: () => sweep(700, 200, 180, 0.08),
  pickup: () => tone(990, 50, 'triangle', 0.06),
  deposit: () => tone(520, 40, 'triangle', 0.05),
  pay: () => tone(1568, 90, 'triangle', 0.07),
  collect: () => {
    tone(1319, 60);
    tone(1760, 120, 'triangle', 0.12, 50);
  },
  spend: () => tone(1175 + Math.random() * 100, 25, 'square', 0.03),
  upgrade: () => {
    tone(784, 90);
    tone(988, 90, 'triangle', 0.14, 80);
    tone(1319, 200, 'triangle', 0.14, 160);
  }
};
