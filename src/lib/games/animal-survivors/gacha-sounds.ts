import { noise, sweep, tone } from '$lib/audio.svelte';
import type { GachaEvent } from './gacha-show';

const SOUNDS: Record<GachaEvent, () => void> = {
  click: () => tone(1800, 18, 'square', 0.025),
  roll: () => {
    for (let i = 0; i < 6; i++) tone(320 - i * 20, 40, 'triangle', 0.04, i * 70);
  },
  glow: () => {
    for (const [i, f] of [1568, 2093, 2637].entries()) tone(f, 120, 'triangle', 0.035, i * 60);
  },
  storm: () => {
    noise(900, 0.14);
    tone(55, 900, 'sawtooth', 0.08);
    sweep(2000, 200, 500, 0.05);
  },
  crack: () => {
    noise(60, 0.12);
    tone(2400, 60, 'square', 0.04, 300);
    noise(80, 0.14);
  },
  pop0: () => {
    noise(40, 0.08);
    tone(660, 90, 'triangle', 0.07);
  },
  pop1: () => {
    noise(40, 0.08);
    for (const [i, f] of [784, 988, 1175].entries()) tone(f, 200, 'triangle', 0.07, 40 + i * 50);
  },
  pop2: () => {
    noise(80, 0.12);
    for (const [i, f] of [523, 659, 784, 1047, 1319].entries()) tone(f, 260, 'square', 0.05, 60 + i * 110);
    tone(1047, 700, 'triangle', 0.06, 640);
    tone(1319, 700, 'triangle', 0.05, 640);
  }
};

export const playGacha = (e: GachaEvent) => SOUNDS[e]();
