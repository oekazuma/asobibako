import { describe, expect, it } from 'vitest';
import { score } from '$lib/music/tune';
import { pick, trackOf } from './bgm';
import { SONGS } from './songs';

describe('BGM', () => {
  it('フェーズで曲を変え、紹介は隠れタイムの曲、答え合わせはロビーの曲', () => {
    expect(trackOf('lobby')).toBe('lobby');
    expect(trackOf('intro')).toBe('hide');
    expect(trackOf('hide')).toBe('hide');
    expect(trackOf('search')).toBe('search');
    expect(trackOf('reveal')).toBe('lobby');
  });

  it('3 曲とも楽譜として読め（小節の長さとコードの数がそろう）、8 小節ある', () => {
    for (const t of Object.values(SONGS)) {
      const sc = score(t.song);
      expect(sc.chords).toHaveLength(8);
      expect(sc.notes).toHaveLength(8 * sc.perBar);
    }
  });

  it('ペイントモードのあいだは同じ曲を小さくして流し続ける', () => {
    const walk = pick('hide', 'walk');
    const paint = pick('hide', 'paint');
    // Loop は曲が替わったときだけ頭から流し直すので、同じ曲なら大きさだけが変わる
    expect(paint.song).toBe(walk.song);
    expect(paint.gain).toBeGreaterThan(0);
    expect(paint.gain).toBeLessThan(walk.gain);
    expect(pick('search', 'eye')).toEqual(pick('search', 'walk'));
    expect(pick('search', 'walk').song).not.toBe(walk.song);
  });
});
