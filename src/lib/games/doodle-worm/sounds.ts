import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  line: () => tone(660, 60, 'sine', 0.06),
  hatch: () => {
    sweep(300, 900, 180, 0.1);
    tone(1175, 160, 'triangle', 0.08, 160);
  },
  boing: () => sweep(260, 780, 220, 0.1),
  parade: () => {
    for (const [i, f] of [523, 659, 784, 1047].entries()) tone(f, i === 3 ? 260 : 120, 'triangle', 0.08, i * 130);
  },
  undo: () => tone(220, 90, 'sine', 0.06),
  tap: () => tone(1320, 40, 'sine', 0.05),
  cheer: () => tone(880 + Math.random() * 220, 50, 'triangle', 0.05),
  go: () => {
    tone(523, 120, 'square', 0.06);
    tone(1047, 260, 'square', 0.06, 130);
  },
  hit: () => {
    noise(90, 0.12);
    tone(180, 90, 'square', 0.06);
  },
  special: () => {
    sweep(200, 1400, 260, 0.12);
    noise(260, 0.2);
  },
  dodge: () => sweep(900, 1800, 120, 0.06),
  ready: () => tone(1568, 140, 'triangle', 0.08),
  win: () => {
    for (const [i, f] of [784, 988, 1175, 1568].entries()) tone(f, i === 3 ? 360 : 130, 'triangle', 0.1, i * 120);
  }
};
