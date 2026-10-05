import { describe, expect, it, vi } from 'vitest';
import { Effects } from './effects';
import { ownEvent } from './heroes';
import { addHero, createWorld } from './world';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  toggleMute: () => {},
  bus: () => null,
  tone: () => {},
  sweep: () => {},
  noise: () => {}
}));

const VIEW = { w: 260, h: 380 };

describe('協力プレイの出来事の持ち主', () => {
  it('2 匹のときの出来事には持ち主が付き、1 匹のときは付かない', () => {
    const one = createWorld('dog', 1, VIEW);
    one.events.push({ type: 'levelup' });
    expect(one.events[0]).toEqual({ type: 'levelup' });
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.cur = 1;
    w.events.push({ type: 'hurt', dmg: 3 });
    w.cur = 0;
    expect(w.events[0]).toEqual({ type: 'hurt', dmg: 3, hero: 1 });
    expect(ownEvent(w, w.events[0])).toBe(false);
    expect(ownEvent(w, { type: 'levelup' })).toBe(true);
  });

  it('相棒の被弾では自分の画面の縁を光らせない', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    const fx = new Effects();
    w.cur = 1;
    w.events.push({ type: 'hurt', dmg: 3 });
    w.cur = 0;
    fx.take(w);
    expect(fx.hurt).toBe(0);
    w.events.length = 0;
    w.events.push({ type: 'hurt', dmg: 3 });
    fx.take(w);
    expect(fx.hurt).toBeGreaterThan(0);
  });
});
