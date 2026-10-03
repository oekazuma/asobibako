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
  dead: () => sweep(400, 80, 900, 0.1),
  warning: () => {
    for (let i = 0; i < 3; i++) tone(220, 300, 'square', 0.07, i * 500);
  },
  /** ボスの登場の地響き。低い音と土の音 */
  rumble: () => {
    noise(700, 0.12);
    tone(55, 700, 'square', 0.09);
    tone(41, 900, 'square', 0.07, 150);
  },
  bossdown: () => {
    noise(400, 0.12);
    for (const [i, f] of [392, 523, 659, 784, 1047].entries()) tone(f, 220, 'square', 0.05, 200 + i * 110);
  },
  coin: () => {
    tone(1568, 50, 'square', 0.04);
    tone(2093, 120, 'square', 0.04, 50);
  },
  revive: () => {
    for (const [i, f] of [392, 523, 784, 1047].entries()) tone(f, 180, 'triangle', 0.09, i * 80);
  },
  swarm: () => sweep(200, 600, 300, 0.07),
  cross: () => {
    noise(300, 0.1);
    for (const [i, f] of [784, 1047, 1319, 1568].entries()) tone(f, 200, 'triangle', 0.08, i * 60);
  },
  freeze: () => sweep(1600, 300, 600, 0.07),
  evolve: () => {
    for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) tone(f, 160, 'square', 0.06, i * 90);
  },
  chest: () => {
    for (const [i, f] of [659, 880, 1175].entries()) tone(f, 120, 'triangle', 0.09, i * 90);
  }
};
