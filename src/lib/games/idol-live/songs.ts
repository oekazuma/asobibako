import type { Song } from '$lib/music/tune';
import { Track, type Move, type SongDef } from './chart';
import type { PoseId } from './dance';

/**
 * 遊べる曲。1 曲ごとに、楽譜（書き方は $lib/music/tune の Song）・区間・ふりつけとノーツを持つ。
 * 曲は末尾に足す（記録は曲の id で覚える）
 */

/** サビのふりつけ。m が -1 なら左右を入れかえる */
const chorus = (m: 1 | -1, at: number): Move[] => {
  const [R, L] = m > 0 ? (['R', 'L'] as const) : (['L', 'R'] as const);
  const side = (id: string) => `${id}${m > 0 ? 'R' : 'L'}` as PoseId;
  const other = (id: string) => `${id}${m > 0 ? 'L' : 'R'}` as PoseId;
  return [
    [at, 'spread', 'special'],
    [at + 1.5, side('appeal')],
    [at + 5, side('reach'), R],
    [at + 6, other('reach'), L],
    [at + 7, 'heart', 'chest'],
    [at + 8, side('low'), `slide${R}`, 2, side('up')],
    [at + 12, other('up'), `hold${L}`, 2],
    [at + 14, 'idle'],
    [at + 16, 'crouch'],
    [at + 17, 'jump'],
    [at + 18, 'land', 'feet'],
    [at + 20, side('reach'), R],
    [at + 21, other('reach'), L],
    [at + 22, side('point'), R],
    [at + 23, 'heart', 'chest'],
    [at + 24, side('step'), `slide${L}`, 2, other('step')],
    [at + 27, 'heart', 'chest'],
    [at + 28, side('up'), `hold${R}`, 3]
  ];
};

const KIRAMEKI_MOVES: Move[] = [
  // 前奏。手をふって、手のひらへ 4 つ
  [0, 'idle'],
  [2, 'waveR'],
  [4, 'waveL'],
  [6, 'heart'],
  [8, 'reachR', 'R'],
  [10, 'reachL', 'L'],
  [12, 'pointR', 'R'],
  [14, 'pointL', 'L'],
  // A メロ
  [16, 'reachR', 'R'],
  [18, 'reachL', 'L'],
  [20, 'heart', 'chest'],
  [22, 'idle'],
  [24, 'stepR', 'R'],
  [26, 'stepL', 'L'],
  [28, 'crouch'],
  [29, 'jump'],
  [30, 'land', 'feet'],
  [32, 'lowR', 'slideR', 2, 'upR'],
  [36, 'reachL', 'L'],
  [38, 'pointL', 'L'],
  [40, 'heart', 'chest'],
  [42, 'pointR', 'R'],
  [44, 'upR', 'holdR', 3],
  // B メロ。1 拍ずつに増やして、ステージを横切る
  [48, 'reachR', 'R'],
  [49, 'reachL', 'L'],
  [50, 'pointR', 'R'],
  [51, 'heart', 'chest'],
  [52, 'stepR', 'slideL', 2, 'stepL'],
  [56, 'pointR', 'R'],
  [57, 'pointL', 'L'],
  [58, 'heart', 'chest'],
  [60, 'upL', 'holdL', 2],
  [62, 'crouch'],
  ...chorus(1, 64),
  // 間奏
  [96, 'waveL', 'L'],
  [98, 'waveR', 'R'],
  [100, 'stepR', 'R'],
  [101, 'stepL', 'L'],
  [102, 'crouch'],
  ...chorus(-1, 104),
  // 後奏。最後のスペシャルで両手を広げる
  [136, 'reachR', 'R'],
  [137, 'reachL', 'L'],
  [138, 'heart', 'chest'],
  [140, 'spread', 'special'],
  [142, 'waveR']
];

/** サビは 2 回歌う */
const KIRAMEKI_CHORUS = `c6 - c6 - d6 - c6 a5 | b5 - g5 - d6 - b5 - | b5 - g5 - e5 - g5 b5 | c6 - - - a5 - . . |
    a5 - c6 - f6 - e6 - | d6 - c6 - b5 - d6 - | e6 - - - d6 - c6 - | c6 - - - - - . .`;

/** 声は笛の音色で歌う。前奏 4・A 8・B 4・サビ 8・間奏 2・サビ 8・後奏 2 小節 */
const KIRAMEKI_MUSIC: Song = {
  beats: 4,
  lead: 'flute',
  style: 'pop',
  melody: `a5 - g5 a5 c6 - a5 - | g5 - d5 - g5 a5 b5 - | c6 - - - g5 - e5 - | g5 - - - . . . . |
    e5 - e5 g5 c6 - g5 - | d5 - d5 g5 b5 - a5 g5 | a5 - a5 g5 e5 - c5 - | e5 - g5 - b4 - . . |
    f5 - a5 - c6 - a5 g5 | g5 - e5 - c5 - e5 g5 | a5 - g5 - f5 - e5 f5 | g5 - - - - - . . |
    c6 - b5 - a5 - e5 - | b5 - a5 - g5 - e5 - | a5 - c6 - f6 - e6 d6 | d6 - - - . . . . |
    ${KIRAMEKI_CHORUS} |
    a5 . c6 . f6 . e6 . | d6 . b5 . g5 - . . |
    ${KIRAMEKI_CHORUS} |
    a5 - g5 - f5 - e5 - | c5 - - - - - - -`,
  chords: 'F G C C C G Am Em F C F G Am Em F G F G Em Am F G C C F G F G Em Am F G C C F C'
};

const KIRAMEKI: SongDef = {
  id: 'kirameki',
  title: 'きらめきステップ',
  theme: 'pop',
  bpm: 132,
  music: KIRAMEKI_MUSIC,
  sections: [
    { from: 0, scene: 'intro', sing: false },
    { from: 16, scene: 'verse', sing: true },
    { from: 48, scene: 'bridge', sing: true },
    { from: 64, scene: 'chorus', sing: true },
    { from: 96, scene: 'break', sing: false },
    { from: 104, scene: 'chorus', sing: true },
    { from: 136, scene: 'finale', sing: true }
  ],
  moves: KIRAMEKI_MOVES,
  fans: 0
};

const MIDNIGHT_MUSIC: Song = {
  beats: 4,
  lead: 'flute',
  style: 'pop',
  melody: `a5 - e5 a5 c6 - b5 a5 | f5 - a5 - c6 - a5 - | g5 - b5 - d6 - b5 - | a5 - - - . . . . |
    e5 - e5 - a5 - g5 e5 | g5 - - - b4 - . . | f5 - f5 - a5 - g5 f5 | e5 - - - c5 - . . |
    d5 - f5 - a5 - c6 - | b5 - a5 - e5 - . . | g#5 - - - e5 - g#5 - | b5 - - - - - . . |
    a5 - a5 - c6 - a5 - | b5 - b5 - d6 - b5 - | g5 - b5 - e6 - d6 c6 | c6 - b5 - . . . . |
    c6 - c6 - a5 - c6 d6 | d6 - b5 - g5 - . . | e6 - d6 - b5 - g5 - | a5 - - - . . . . |
    f5 - a5 - d6 - c6 - | b5 - d6 - g6 - f6 - | e6 - - - c6 - b5 - | g#5 - - - b5 - . . |
    a5 - e5 - a5 - c6 - | a5 - - - - - - -`,
  chords: 'Am F G Am Am Em F C Dm Am E E F G Em Am F G Em Am Dm G C E Am Am'
};

const MIDNIGHT_MOVES: Move[] = [
  // 前奏。指さしで客席を見わたす
  [0, 'idle'],
  [2, 'pointR'],
  [4, 'pointL'],
  [6, 'crouch'],
  [8, 'stepR', 'R'],
  [10, 'stepL', 'L'],
  [12, 'pointR', 'R'],
  [14, 'pointL', 'L'],
  // A メロ。のばす音ごとに手を高く上げる
  [16, 'reachR', 'R'],
  [18, 'reachL', 'L'],
  [20, 'upR', 'holdR', 2],
  [24, 'pointL', 'L'],
  [26, 'pointR', 'R'],
  [28, 'upL', 'holdL', 2],
  [32, 'lowR', 'slideR', 2, 'upR'],
  [36, 'reachL', 'L'],
  [38, 'heart', 'chest'],
  [40, 'crouch'],
  [41, 'jump'],
  [42, 'land', 'feet'],
  [44, 'upR', 'holdR', 3],
  // B メロ
  [48, 'pointR', 'R'],
  [49, 'pointL', 'L'],
  [50, 'heart', 'chest'],
  [52, 'stepL', 'slideR', 2, 'stepR'],
  [56, 'reachL', 'L'],
  [57, 'reachR', 'R'],
  [58, 'heart', 'chest'],
  [60, 'crouch'],
  ...chorus(-1, 64),
  // 後奏
  [96, 'reachR', 'R'],
  [97, 'reachL', 'L'],
  [98, 'heart', 'chest'],
  [100, 'spread', 'special'],
  [102, 'waveR']
];

const MIDNIGHT: SongDef = {
  id: 'midnight',
  title: 'ミッドナイトスター',
  theme: 'cool',
  bpm: 120,
  music: MIDNIGHT_MUSIC,
  sections: [
    { from: 0, scene: 'intro', sing: false },
    { from: 16, scene: 'verse', sing: true },
    { from: 48, scene: 'bridge', sing: true },
    { from: 64, scene: 'chorus', sing: true },
    { from: 96, scene: 'finale', sing: true }
  ],
  moves: MIDNIGHT_MOVES,
  fans: 500
};

export const SONGS: SongDef[] = [KIRAMEKI, MIDNIGHT];

const tracks = new Map<string, Track>();
/** 曲のふりつけとノーツは、はじめて使うときに組み立てる */
export const trackOf = (id: string): Track =>
  tracks.get(id) ?? tracks.set(id, new Track(SONGS.find((s) => s.id === id) ?? SONGS[0])).get(id)!;
