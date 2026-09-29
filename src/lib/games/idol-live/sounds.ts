import { sink } from '$lib/audio.svelte';
import { note, type Instrument } from '$lib/music/instruments';
import { hiss, play, rand, sfxOut, shot, thump } from '$lib/music/synth';
import type { Grade } from './judge';

/** 効果音。叩いた音は鉄琴と木琴、歓声は帯域を絞った粒のあるノイズに拍手の粒を重ねる */

type Out = { ctx: BaseAudioContext; out: AudioNode; t: number };

function go(fn: (o: Out) => void) {
  const ctx = sink();
  if (ctx) fn({ ctx, out: sfxOut(ctx), t: ctx.currentTime + 0.005 });
}

const inst = (o: Out, name: Instrument, f: number, gain: number, dt = 0) =>
  play(o.ctx, o.out, o.t + dt, note(o.ctx, name, f), gain, { wet: 0.25 });

/** 客席の「わーっ」。power 0..1 */
function roar(o: Out, power: number, sec = 1.8) {
  shot(
    o.ctx,
    o.out,
    o.t,
    sec,
    (d, sr) => {
      hiss(d, sr, 0, sec, 350, 2800, 0.5, (u) => Math.min(1, u * 8) * (1 - u) ** 1.5, 0.5);
      // 拍手と指笛の粒
      for (let i = 0; i < 30 * power; i++) hiss(d, sr, rand(0, sec * 0.8), 0.02, 1200, 6000, 0.5, (u) => 1 - u);
      thump(d, sr, 0, 90, 0.3, 0.15);
    },
    0.16 * power,
    { wet: 0.4 }
  );
}

export const sounds = {
  hit: (g: Grade) =>
    go((o) => {
      if (g === 'miss') return;
      inst(o, 'glock', g === 'perfect' ? 2093 : g === 'great' ? 1568 : 1319, 0.05);
      if (g === 'perfect') inst(o, 'glock', 3136, 0.014, 0.03);
    }),
  /** ホールドとスライドの終わり。上へ駆け上がる */
  sweep: () => go((o) => [1319, 1568, 2093, 2637].forEach((f, i) => inst(o, 'glock', f, 0.03, i * 0.045))),
  special: () =>
    go((o) => {
      [1047, 1319, 1568, 2093].forEach((f, i) => inst(o, 'bell', f, 0.035, i * 0.07));
      roar(o, 1, 2.4);
    }),
  cheer: (power: number) => go((o) => roar(o, power)),
  /** ライブの終わりの大歓声 */
  finale: () =>
    go((o) => {
      roar(o, 1, 3.5);
      [1047, 1319, 1568, 2093, 2637].forEach((f, i) => inst(o, 'bell', f, 0.03, 0.2 + i * 0.09));
    })
};
