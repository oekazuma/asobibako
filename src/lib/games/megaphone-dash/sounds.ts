import { noise, sfx, sweep, tone } from '$lib/audio.svelte';

/** ドレミの上がっていく音階。コンボが伸びるほど 1 音ずつ高くなり、また下から回る */
const SCALE = [523, 587, 659, 784, 880, 1047, 1175, 1319];

export const sounds = {
  hit: (combo: number, many: number) => {
    const f = SCALE[combo % SCALE.length] * (combo >= SCALE.length * 2 ? 1.5 : 1);
    tone(f, 90, 'triangle', 0.09);
    // まとめて巻きこんだときは和音を重ねて、大きな手ごたえにする
    if (many >= 3) tone(f * 1.25, 110, 'triangle', 0.07, 30);
    if (many >= 6) tone(f * 1.5, 140, 'square', 0.04, 60);
  },
  drop: () => sweep(600, 250, 260, 0.06),
  bump: () => {
    noise(160, 0.28);
    sweep(260, 80, 220, 0.1);
  },
  gauge: () => {
    tone(880, 90, 'square', 0.05);
    tone(1319, 160, 'square', 0.05, 90);
  },
  shout: () => {
    noise(500, 0.35);
    sweep(180, 900, 450, 0.14);
    tone(523, 300, 'square', 0.06, 120);
    tone(784, 400, 'square', 0.06, 200);
  },
  zone: () => {
    tone(784, 100);
    tone(1047, 180, 'triangle', 0.12, 100);
  },
  goal: () => sfx.finish(),
  timeout: () => {
    tone(392, 180);
    tone(330, 180, 'triangle', 0.14, 170);
    tone(262, 380, 'triangle', 0.14, 340);
  }
};
