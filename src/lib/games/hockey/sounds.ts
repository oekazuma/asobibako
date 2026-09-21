import { noise, tone } from '$lib/audio.svelte';

export const sounds = {
  /** 強く打つほど高く大きく鳴る */
  hit: (speed: number) => tone(260 + 240 * Math.min(speed, 3), 45, 'square', 0.05 + 0.04 * Math.min(speed, 3)),
  wall: () => tone(180, 35, 'triangle', 0.06),
  goal: () => {
    noise(260, 0.12);
    tone(784, 120, 'triangle', 0.14, 60);
    tone(1047, 220, 'triangle', 0.14, 180);
  }
};
