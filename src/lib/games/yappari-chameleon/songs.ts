import type { Song } from '$lib/music/tune';
import type { Track } from './bgm';

/** 本家の曲は使わず、雰囲気だけを寄せて作る。効果音が聞こえるよう gain は小さめ */
export const SONGS: Record<Track, { song: Song; bpm: number; gain: number }> = {
  /** ロビーと答え合わせ。明るく弾む */
  lobby: {
    bpm: 112,
    gain: 0.5,
    song: {
      beats: 4,
      lead: 'mallet',
      style: 'bounce',
      melody: `c5 . e5 . g5 . e5 . | f5 . a5 . g5 - . . | e5 . d5 . c5 . d5 . | e5 - g5 - . . . . |
        a5 . g5 . f5 . e5 . | d5 . f5 . e5 - c5 . | d5 . e5 . f5 . d5 . | c5 - - - . . . .`,
      chords: 'C F C C F Dm G C'
    }
  },
  /** 隠れタイム。足音のような行進に、短調の笛で軽い緊張 */
  hide: {
    bpm: 100,
    gain: 0.45,
    song: {
      beats: 4,
      lead: 'flute',
      style: 'march',
      melody: `a4 . c5 . e5 - d5 . | c5 . b4 . a4 - . . | f4 . a4 . c5 - b4 . | g#4 - b4 - e5 - . . |
        a4 . c5 . e5 . a5 . | g5 . f5 . e5 - . . | d5 . c5 . b4 . g#4 . | a4 - - - . . . .`,
      chords: 'Am Am F E Am C E Am'
    }
  },
  /** 探索。低い音から刻む短調の 8 ビートで張りつめる */
  search: {
    bpm: 136,
    gain: 0.5,
    song: {
      beats: 4,
      lead: 'chip',
      style: 'drive',
      melody: `d4 . d4 f4 a4 . d5 . | c5 . a4 . f4 - e4 . | d4 . f4 . a#4 - a4 g4 | a4 - - - c#5 - . . |
        d5 . c5 . a#4 . a4 . | g4 . a4 . f4 - d4 . | e4 . g4 . a#4 . c#5 . | d5 - - - . . . .`,
      chords: 'Dm Dm A# A Dm Gm A Dm'
    }
  }
};
