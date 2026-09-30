import { describe, expect, it } from 'vitest';
import { overflow, pack, unpack } from './book';

describe('pack と unpack', () => {
  it('線画を 1 画素 1 ビットに詰めて、元に戻せる', () => {
    const mask = new Uint8Array(20).map((_, i) => (i % 3 === 0 ? 1 : 0));
    const bits = pack(mask);
    expect(bits.length).toBe(3);
    expect(unpack(bits, 20)).toEqual(mask);
  });
});

describe('overflow', () => {
  it('上限を超えたぶんを、古いものから消す', () => {
    const works = Array.from({ length: 32 }, (_, i) => ({ id: `w${i}`, updated: i }));
    expect(overflow(works, 30).sort()).toEqual(['w0', 'w1']);
  });

  it('上限以内なら何も消さない', () => {
    expect(overflow([{ id: 'a', updated: 1 }], 30)).toEqual([]);
  });
});
