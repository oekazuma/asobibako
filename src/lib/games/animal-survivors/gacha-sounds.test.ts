import { describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
vi.mock('$lib/audio.svelte', () => ({
  tone: () => calls.push('tone'),
  sweep: () => calls.push('sweep'),
  noise: () => calls.push('noise')
}));
const { playGacha } = await import('./gacha-sounds');

describe('ガチャの音', () => {
  it('どの出来事も音を出し、伝説の割れる音はレアより音の数が多い', () => {
    const count = (e: Parameters<typeof playGacha>[0]) => {
      calls.length = 0;
      playGacha(e);
      return calls.length;
    };
    for (const e of ['click', 'roll', 'glow', 'storm', 'crack', 'pop0', 'pop1', 'pop2'] as const)
      expect(count(e)).toBeGreaterThan(0);
    expect(count('pop2')).toBeGreaterThan(count('pop1'));
    expect(count('pop1')).toBeGreaterThan(count('pop0'));
  });
});
