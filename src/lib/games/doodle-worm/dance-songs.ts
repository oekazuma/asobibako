import type { Level } from './dance';

/** ダンスの曲。やさしい順。楽譜の書き方は $lib/music/tune の Song */
export const LEVELS: Level[] = [
  {
    id: 'kirakira',
    name: 'きらきら ステップ',
    stars: 1,
    bpm: 104,
    lead: 1.4,
    bars: ['x...x...', 'x...x...', 'x.x.x...', 'H---....'],
    song: {
      beats: 4,
      lead: 'glock',
      style: 'pop',
      melody: `e5 - g5 - c6 - g5 - | d6 - b5 - g5 - b5 - | c6 - a5 - e5 - a5 - | a5 - c6 - f5 - - - |
        e5 g5 c6 - e6 - c6 - | d6 - b5 - d6 - g5 - | a5 - c6 - a5 - f5 - | g5 - - - . . . . |
        c6 - e6 - g6 - e6 - | d6 - b5 - g5 - d6 - | e6 - c6 - a5 - c6 - | a5 - f5 - a5 - c6 - |
        f6 - e6 - d6 - c6 - | b5 - d6 - g6 - f6 - | e6 - c6 - g5 - e5 - | c6 - - - . . . .`,
      chords: 'C G Am F C G F G C G Am F F G C C'
    }
  },
  {
    id: 'hajikete',
    name: 'はじけて ダンス',
    stars: 2,
    bpm: 120,
    lead: 1.15,
    bars: ['x.x.x.x.', 'x.x.H---', 'x.xxx.x.', 'H---x.x.'],
    song: {
      beats: 4,
      lead: 'glock',
      style: 'pop',
      melody: `a5 . a5 c6 e6 . c6 a5 | a5 . f5 a5 c6 - a5 . | b5 . g5 b5 d6 . b5 g5 | c6 - e6 - g6 - . . |
        e6 . e6 d6 c6 . a5 c6 | c6 . a5 c6 f6 - . . | d6 . d6 c6 b5 . g5 b5 | g#5 - b5 - e6 - . . |
        a5 c6 e6 . g6 . e6 c6 | f6 . e6 . c6 . a5 . | g5 b5 d6 . g6 . d6 b5 | c6 - . e6 g6 - . . |
        a5 . c6 . f6 . e6 . | d6 . b5 . g5 . b5 d6 | e6 - d6 - c6 - g5 - | c6 - - - . . . .`,
      chords: 'Am F G C Am F G E Am F G C F G C C'
    }
  },
  {
    id: 'starlight',
    name: 'スターライト パレード',
    stars: 3,
    bpm: 136,
    lead: 0.95,
    bars: ['x.xxx.x.', 'xxx.H---', 'x.x.xxx.', 'H---xx.x'],
    song: {
      beats: 4,
      lead: 'glock',
      style: 'pop',
      melody: `c6 . a5 . c6 . f6 . | d6 . b5 . d6 . g6 . | e6 - d6 - b5 - g5 - | a5 - c6 - e6 - . . |
        f6 . e6 . c6 . a5 . | b5 . d6 . g6 . f6 . | e6 - - - g5 - c6 - | e6 - - - . . . . |
        a5 c6 f6 . a5 c6 f6 . | b5 d6 g6 . b5 d6 g6 . | g6 . e6 . b5 . e6 . | e6 . c6 . a5 . c6 . |
        d6 . f6 . a5 . d6 . | b5 . d6 . g6 - f6 - | e6 - c6 - g5 - e6 - | c6 - - - . . . .`,
      chords: 'F G Em Am F G C C F G Em Am Dm G C C'
    }
  }
];
