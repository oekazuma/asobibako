import { noise, tone } from '$lib/audio.svelte';

export const sounds = {
  ink: () => tone(900 + Math.random() * 200, 20, 'sine', 0.02),
  go: () => {
    tone(523, 90);
    tone(784, 160, 'triangle', 0.12, 80);
  },
  buzz: () => tone(180 + Math.random() * 40, 90, 'sawtooth', 0.025),
  bump: () => tone(700, 30, 'square', 0.03),
  /** 線が落ちて当たったときのドスン。power は 0..1 の当たりの強さ */
  land: (power: number) => {
    noise(70, 0.06 + power * 0.14);
    tone(110 + power * 40, 120, 'sine', 0.05 + power * 0.12);
  },
  stung: () => {
    noise(200, 0.2);
    tone(300, 400, 'sawtooth', 0.08);
  }
};
