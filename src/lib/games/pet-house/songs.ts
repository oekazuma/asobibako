/**
 * BGM の楽譜。melody は 8 分音符 1 つを 1 語にして小節を | で区切る（音名とオクターブ、`-` は前の音をのばす、`.` は休み）。
 * chords は 1 小節に 1 つのコード。伴奏の刻み方は style が決める
 */
export type Lead = 'box' | 'mallet' | 'bubble' | 'brass' | 'flute';
export type Style = 'waltz' | 'bounce' | 'march' | 'gentle';

export interface Song {
  beats: 3 | 4;
  lead: Lead;
  style: Style;
  melody: string;
  chords: string;
}

export const SONGS = {
  /** 部屋。オルゴールのワルツ */
  room: {
    beats: 3,
    lead: 'box',
    style: 'waltz',
    melody: `e5 - g5 - c6 - | b5 - a5 - e5 - | f5 - a5 - c6 - | d6 - - - b5 - |
      c6 - b5 - a5 g5 | a5 - e5 - c5 - | d5 - f5 - a5 g5 | g5 - - - . . |
      a5 - c6 - f6 - | e6 - d6 - c6 - | d6 - f5 - a5 - | g5 - b5 - d6 - |
      e6 - d6 c6 - g5 | a5 - c6 - e5 - | d5 - g5 - b5 d6 | c6 - - - . .`,
    chords: 'C Am F G C Am F G F C Dm G C Am G C'
  },
  /** 公園とおさんぽ。はねる木琴 */
  park: {
    beats: 4,
    lead: 'mallet',
    style: 'bounce',
    melody: `g5 . e5 g5 c6 . g5 . | a5 . f5 a5 c6 - . . | b5 . g5 b5 d6 . b5 . | c6 - g5 - e5 - . . |
      e5 . a5 . c6 . a5 . | f5 . a5 . c6 . d6 . | d6 - b5 - g5 . a5 b5 | d6 - - - . . . . |
      e6 . d6 . c6 . g5 . | a5 . c6 . f6 - e6 . | d6 . b5 . g5 . b5 d6 | c6 - a5 - e5 - . . |
      f5 . a5 c6 f6 . e6 d6 | d6 . c6 b5 a5 . g5 . | e5 g5 c6 e6 d6 . b5 . | c6 - . . . . . .`,
    chords: 'C F G C Am F G G C F G Am F G C C'
  },
  /** おふろ。ぷくぷくの泡 */
  bath: {
    beats: 4,
    lead: 'bubble',
    style: 'bounce',
    melody: `c5 . e5 . g5 g5 . . | a5 g5 e5 . c5 . . . | d5 . f5 . b5 b5 . . | c6 b5 g5 . d5 . . . |
      a5 . a5 . c6 . a5 . | g5 . f5 . a5 - . . | g5 . e5 . c5 . e5 . | d5 - - - . . . . |
      e5 e5 g5 . c6 . g5 . | a5 . e5 . c5 . e5 . | f5 f5 a5 . c6 . a5 . | g5 . b5 . d6 - . . |
      e6 . c6 . g5 . e5 . | f5 . a5 . c6 . f5 . | d5 . g5 . b5 . d6 . | c6 - . . c5 . . .`,
    chords: 'C C G G F F C G C Am F G C F G C'
  },
  /** コンテスト。行進曲。競技のあいだは同じ曲をテンポを上げて流す */
  contest: {
    beats: 4,
    lead: 'brass',
    style: 'march',
    melody: `g4 . c5 . e5 . g5 . | c6 - g5 . e5 . g5 . | a5 . c6 . a5 . f5 . | g5 - - . d5 . g5 . |
      e5 . g5 . c6 . e6 . | e6 - c6 . a5 . c6 . | d6 . a5 . f#5 . a5 . | g5 - - - b5 - d6 - |
      e6 . e6 . e6 . d6 c6 | g5 - - . e5 . g5 . | a5 . a5 . c6 . a5 . | f5 - - . a5 . c6 . |
      d6 . d6 . d6 . e6 d6 | b5 - g5 . a5 . b5 . | c6 . g5 . e5 . g5 . | c6 - - - . . . .`,
    chords: 'C C F G C Am D G C C F F G G C C'
  },
  /** ふれあいひろば。のどかな笛 */
  plaza: {
    beats: 4,
    lead: 'flute',
    style: 'gentle',
    melody: `e5 - - g5 c6 - - . | b5 - g5 - e5 - - . | a5 - - c6 f5 - a5 - | g5 - - - - - . . |
      a5 - c6 - f6 - e6 - | e6 - d6 - c6 - g5 - | f5 - a5 - d6 - c6 - | b5 - - - - - . . |
      e5 - g5 - c6 - e6 - | d6 - b5 - g5 - - . | a5 - c6 - f6 - - e6 | e6 - - - c6 - . . |
      c6 - e6 - a5 - c6 - | a5 - f5 - c6 - a5 - | g5 - b5 - d6 - b5 - | c6 - - - - - . .`,
    chords: 'C Em F C F C Dm G C Em F C Am F G C'
  },
  /** しつけのリズムあそび。拍がわかりやすいよう、4 分音符ごとに伴奏がはずむ */
  lesson: {
    beats: 4,
    lead: 'mallet',
    style: 'bounce',
    melody: `e5 . g5 . c6 . g5 . | d6 . b5 . g5 - . . | c6 . a5 . e5 . a5 . | f5 . a5 . c6 - . . |
      e5 g5 c6 . e6 . c6 . | d6 . b5 . g5 . b5 . | a5 . c6 . f6 . e6 d6 | d6 - - - . . . . |
      e6 . c6 . a5 . c6 . | c6 . a5 . f5 . a5 . | g5 . e5 . c6 . e6 . | d6 . b5 . g5 - . . |
      a5 . c6 . f6 . a5 . | b5 . d6 . g5 . b5 . | c6 . e6 . g5 . e5 . | c6 - - - . . . .`,
    chords: 'C G Am F C G F G Am F C G F G C C'
  },
  /** しつけのリズムあそびの 2 曲目。オルゴールで少しゆっくり */
  lesson2: {
    beats: 4,
    lead: 'box',
    style: 'bounce',
    melody: `d5 . g5 . b5 . g5 . | a5 . f#5 . d5 - . . | e5 . g5 . b5 . e6 . | c6 - b5 . a5 - . . |
      b5 . d6 . g6 . d6 . | c6 . a5 . f#5 . a5 . | e5 . g5 . c6 . e6 . | d6 - - - . . . . |
      g5 . b5 . e6 . b5 . | a5 . c6 . e6 - . . | d6 . b5 . g5 . b5 . | a5 . d6 . f#5 - . . |
      e5 g5 c6 . e6 . c6 . | d6 . c6 . a5 . f#5 . | g5 . b5 . d6 . b5 . | g5 - - - . . . .`,
    chords: 'G D Em C G D C D Em C G D C D G G'
  }
} satisfies Record<string, Song>;

export type SongId = keyof typeof SONGS;
