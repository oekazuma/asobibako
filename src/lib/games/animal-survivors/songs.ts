import type { Song } from '$lib/music/tune';

/** 画面ごとの BGM。書き方は $lib/music/tune の Song。効果音が聞こえるよう gain は小さめ */
export const SONGS: Record<'menu' | 'field' | 'grave' | 'snow' | 'boss', { song: Song; bpm: number; gain: number }> = {
  /** キャラ選択・店・実績・リザルト。軽く弾む */
  menu: {
    bpm: 110,
    gain: 0.9,
    song: {
      beats: 4,
      lead: 'chip',
      style: 'bounce',
      melody: `c5 . e5 . g5 - e5 . | a4 . c5 . e5 - . . | f4 . a4 . c5 . a4 . | g4 - b4 - d5 - . . |
        e5 . g5 . c6 . g5 . | a5 . e5 . c5 - . . | d5 . f5 . a5 . f5 . | g5 - - - . . . .`,
      chords: 'C Am F G C Am F G'
    }
  },
  /** 森。8 ビートで走る */
  field: {
    bpm: 140,
    gain: 0.55,
    song: {
      beats: 4,
      lead: 'chip',
      style: 'drive',
      melody: `e4 . g4 . c5 - b4 g4 | d5 - b4 . g4 . d4 . | c5 . e5 . a4 - g4 e4 | f4 - a4 . c5 - . . |
        e4 g4 c5 e5 d5 . c5 . | b4 . g4 . d5 - . . | a4 . c5 . f5 - e5 d5 | d5 - - - b4 - . . |
        a4 . c5 . e5 . c5 . | f5 - e5 d5 c5 - a4 . | g4 . c5 . e5 - g5 . | f5 . d5 . b4 - g4 . |
        a4 c5 f5 . e5 . c5 . | d5 . b4 . g4 a4 b4 d5 | c5 - e5 - g5 - e5 . | c5 - - - . . . .`,
      chords: 'C G Am F C G F G Am F C G F G C C'
    }
  },
  /** 夜の墓地。短調の 8 ビートで、森より少しゆっくり */
  grave: {
    bpm: 132,
    gain: 0.55,
    song: {
      beats: 4,
      lead: 'chip',
      style: 'drive',
      melody: `d4 . f4 . a4 - g4 f4 | e4 . f4 . d4 - . . | a#3 . d4 . f4 - e4 d4 | c#4 - e4 - a4 - . . |
        d5 . c5 . a4 . f4 . | g4 . a4 . f4 - . . | g4 . a#4 . d5 - c5 a#4 | a4 - - - c#5 - . . |
        d5 . d5 . f5 . e5 d5 | c5 . a4 . f4 . a4 . | g4 . c5 . e5 - d5 c5 | c#5 . a4 . e4 - . . |
        a#4 a4 g4 . d5 . a#4 . | a4 g4 f4 . d4 . f4 . | e4 . a4 . c#5 . e5 . | d5 - - - . . . .`,
      chords: 'Dm Dm A# A Dm Dm Gm A Dm F C A Gm Dm A Dm'
    }
  },
  /** 雪山。鉄琴の音で、明るいが少し寂しい */
  snow: {
    bpm: 136,
    gain: 0.55,
    song: {
      beats: 4,
      lead: 'mallet',
      style: 'drive',
      melody: `e5 . b4 . g4 . b4 . | c5 - b4 . a4 . g4 . | a4 . c5 . e5 . d5 c5 | b4 - - - . . . . |
        g4 . b4 . d5 . g5 . | f#5 . e5 . d5 - b4 . | c5 . e5 . a5 - g5 f#5 | g5 - - - d5 - . . |
        e5 . e5 . g5 . f#5 e5 | d5 . b4 . g4 . b4 . | c5 . a4 . f#4 . a4 . | b4 - g4 - e4 - . . |
        c5 e5 g5 . f#5 . e5 . | d5 . f#5 . a5 - g5 . | f#5 . d5 . b4 - a4 . | g4 - - - . . . .`,
      chords: 'Em C Am B G D Am G Em G Am B C D D G'
    }
  },
  /** ボス。短調で速い */
  boss: {
    bpm: 160,
    gain: 0.6,
    song: {
      beats: 4,
      lead: 'chip',
      style: 'drive',
      melody: `a4 . a4 c5 e5 . a4 . | g4 . a4 . c5 b4 a4 . | f4 . a4 c5 f5 . e5 . | d5 . b4 . g4 - . . |
        a4 . c5 . e5 . a5 . | g5 . e5 . c5 . a4 . | g#4 . b4 . e5 - d5 . | b4 - - - g#4 - . . |
        e5 . e5 . f5 e5 d5 c5 | c5 . a4 . f4 . a4 . | d5 . d5 . e5 d5 c5 b4 | b4 . g4 . e4 - . . |
        a4 c5 f5 . e5 . c5 . | b4 d5 g5 . f5 . d5 . | e5 . g#5 . b5 - g#5 . | e5 - - - . . . .`,
      chords: 'Am Am F G Am Am E E Am F G Em F G E E'
    }
  }
};
