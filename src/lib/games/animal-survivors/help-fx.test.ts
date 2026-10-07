import { describe, expect, it, vi } from 'vitest';
import { Effects } from './effects';
import { addHero, createWorld } from './world';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  toggleMute: () => {},
  bus: () => null,
  tone: () => {},
  sweep: () => {},
  noise: () => {}
}));

describe('起き上がる演出', () => {
  it('白く光るのは起きた本人の画面だけで、起こした側の画面は光らない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    addHero(w, 'cat');
    const fx = new Effects();
    w.events.push({ type: 'raised', who: 1, by: 0 });
    fx.take(w);
    expect(fx.flash).toBe(0);
    w.cur = 1;
    fx.take(w);
    expect(fx.flash).toBeGreaterThan(0);
  });
});
