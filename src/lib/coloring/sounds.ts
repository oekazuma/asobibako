import { tone } from '$lib/audio.svelte';

export const sounds = {
  fill: () => tone(620 + Math.random() * 240, 90, 'sine', 0.1),
  undo: () => tone(330, 80, 'triangle', 0.08),
  done: () => {
    tone(784, 110);
    tone(1047, 200, 'triangle', 0.14, 100);
  }
};
