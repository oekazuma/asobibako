import { describe, expect, it, vi } from 'vitest';
import { Effects } from './effects';
import { text } from './font';
import { createWorld, type World } from './world';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  toggleMute: () => {},
  bus: () => null,
  tone: () => {},
  sweep: () => {},
  noise: () => {}
}));

vi.mock('./font', () => ({ text: vi.fn(() => 0) }));

const VIEW = { w: 274, h: 394 };

function kills(w: World, n: number) {
  w.events.length = 0;
  for (let i = 0; i < n; i++) w.events.push({ type: 'kill', x: i, y: 0, enemy: 'rat' });
}

function drawn(fx: Effects): number {
  const ctx = { globalAlpha: 1, fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() };
  fx.draw(ctx as unknown as CanvasRenderingContext2D, 1);
  return ctx.fillRect.mock.calls.length;
}

describe('倒した敵の粒', () => {
  it('600 粒で頭打ちになり、消えた粒の場所を使い回し、同じ場所を 2 度は渡さない', () => {
    const w = createWorld('dog', 1, VIEW);
    const fx = new Effects();
    kills(w, 100);
    fx.take(w);
    expect(drawn(fx)).toBe(600);
    fx.update(1);
    expect(drawn(fx)).toBe(0);
    kills(w, 10);
    fx.take(w);
    fx.take(w);
    expect(drawn(fx)).toBe(160);
    fx.update(1);
    fx.update(1);
    kills(w, 100);
    fx.take(w);
    expect(drawn(fx)).toBe(600);
  });
});

describe('ダメージの数字', () => {
  it('1 フレームに 200 回当たっても、後ろの 60 個を古い順に出す', () => {
    const w = createWorld('dog', 1, VIEW);
    const fx = new Effects();
    for (let i = 1; i <= 200; i++) w.events.push({ type: 'hit', x: 0, y: 0, dmg: i, crit: false });
    fx.take(w);
    vi.mocked(text).mockClear();
    drawn(fx);
    expect(vi.mocked(text).mock.calls.map((c) => c[1])).toEqual(Array.from({ length: 60 }, (_, i) => String(141 + i)));
  });
});
