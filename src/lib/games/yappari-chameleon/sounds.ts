import { bus, noise, sfx, sweep, tone } from '$lib/audio.svelte';
import type { V3 } from '$lib/sculpt';

/** rel は聞く人のカメラから見た位置（右が +x、前が −z） */
function whistle(rel: V3): void {
  const ctx = bus();
  if (!ctx) return;
  const pan = new PannerNode(ctx, {
    panningModel: 'equalpower',
    distanceModel: 'inverse',
    refDistance: 2,
    maxDistance: 40,
    rolloffFactor: 1,
    positionX: rel[0],
    positionY: rel[1],
    positionZ: rel[2]
  });
  pan.connect(ctx.destination);
  for (const [i, [from, to]] of [
    [1100, 1500],
    [1400, 1900]
  ].entries()) {
    const at = ctx.currentTime + i * 0.16;
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: from });
    const amp = new GainNode(ctx, { gain: 0 });
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + 0.14);
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(0.18, at + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
    osc.connect(amp).connect(pan);
    osc.start(at);
    osc.stop(at + 0.16);
  }
}

/** 本家に声は無いので、効果音だけにする */
export const sounds = {
  spray: () => noise(120, 0.05),
  cling: () => tone(140, 70, 'sine', 0.2),
  pick: () => sweep(500, 1100, 120, 0.1),
  done: () => sfx.finish(),
  button: () => tone(660, 40, 'triangle', 0.08),
  // 本家は銃声を小さくした版がある（「銃声怖っ」）。短く小さめに
  shot: () => noise(90, 0.12),
  shatter: () => {
    noise(260, 0.16);
    sweep(900, 220, 300, 0.07);
  },
  found: () => sweep(500, 1300, 220, 0.1),
  intro: () => sfx.start(),
  phase: () => tone(523, 180, 'triangle', 0.1),
  whistle
};
