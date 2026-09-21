import { noise, sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  /** 脈に合わせて鳴らす。熱いほど高く速くなるので、見ていなくても危なさが伝わる */
  tick: (heat: number) => tone(700 + 900 * heat, 28, 'square', 0.03 + 0.04 * heat),
  catch: () => tone(300, 90, 'triangle', 0.14),
  throw: () => sweep(420, 1300, 150, 0.08),
  boom: () => {
    noise(750, 0.35);
    sweep(160, 40, 550, 0.25);
  }
};
