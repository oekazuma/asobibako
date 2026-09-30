import { noise, sfx, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  shot: () => sweep(520, 880, 90, 0.05),
  /** コンボが伸びるほど音を上げる */
  hit: (combo = 1) => {
    const f = 660 * 2 ** (Math.min(combo, 24) / 24);
    tone(f, 90, 'triangle', 0.1);
    tone(f * 1.5, 120, 'triangle', 0.08, 60);
  },
  miss: () => tone(330, 160, 'sine', 0.06),
  jump: () => sweep(400, 900, 140, 0.06),
  bump: () => {
    noise(140, 0.25);
    sweep(300, 90, 200, 0.1);
  },
  bossIn: () => {
    tone(196, 300, 'square', 0.06);
    tone(147, 500, 'square', 0.06, 280);
  },
  bossHit: () => {
    sweep(900, 400, 80, 0.06);
    noise(60, 0.12);
  },
  bossDown: () => sfx.finish(),
  throw: () => sweep(700, 250, 400, 0.05),
  timeout: () => {
    tone(392, 180);
    tone(330, 180, 'triangle', 0.14, 170);
    tone(262, 380, 'triangle', 0.14, 340);
  }
};
