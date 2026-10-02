import { describe, expect, it } from 'vitest';
import { score } from '$lib/music/tune';
import { SONGS } from './songs';

describe('BGM の楽譜', () => {
  it('3 曲とも小節とコードが読め、森は 16 小節', () => {
    for (const { song } of Object.values(SONGS)) expect(() => score(song)).not.toThrow();
    expect(score(SONGS.field.song).chords).toHaveLength(16);
    expect(SONGS.boss.bpm).toBeGreaterThan(SONGS.field.bpm);
  });
});
