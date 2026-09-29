import { assets } from '$app/paths';
import type { Level } from './dance';

/** ダンスの曲。自前の曲の楽譜の書き方は $lib/music/tune の Song */
export const LEVELS: Level[] = [
  {
    id: 'kirakira',
    name: 'きらきら ステップ',
    bpm: 104,
    source: {
      kind: 'synth',
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
    jacket: { colors: ['#ffb3d1', '#ffd84d'], icon: 'star' }
  },
  {
    id: 'hajikete',
    name: 'はじけて ダンス',
    bpm: 120,
    source: {
      kind: 'synth',
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
    jacket: { colors: ['#f5913e', '#f04438'], icon: 'bolt' }
  },
  {
    id: 'starlight',
    name: 'スターライト パレード',
    bpm: 136,
    source: {
      kind: 'synth',
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
    },
    jacket: { colors: ['#3d2c8d', '#a974f2'], icon: 'moon' }
  },
  {
    id: 'poyopoyo',
    name: 'ぽよぽよ ピクニック',
    bpm: 150,
    source: {
      kind: 'synth',
      song: {
        beats: 4,
        lead: 'chip',
        style: 'bounce',
        melody: `d5 . g5 . b5 . d6 b5 | c6 . e6 . c6 . g5 . | a5 . f#5 . a5 . d6 c6 | b5 - g5 - d5 - . . |
          e5 . g5 . b5 . e6 d6 | c6 . b5 . a5 . g5 . | f#5 . a5 . d6 . e6 f#6 | f#6 - - - d6 - - - |
          g5 b5 d6 . g5 b5 d6 . | e6 . d6 . c6 . e6 . | d6 . c6 . a5 . f#5 . | g5 - b5 - e6 - . . |
          e6 . e6 . d6 . c6 . | a5 . d6 . f#6 . e6 . | d6 b5 g5 b5 d6 - g6 - | g6 - - - . . . .`,
        chords: 'G C D G Em C D D G C D Em C D G G'
      }
    },
    jacket: { colors: ['#b3ec3a', '#ff7eb6'], icon: 'heart' }
  },
  {
    id: 'shining-star',
    name: 'シャイニングスター',
    bpm: 158,
    source: {
      kind: 'file',
      url: `${assets}/music/maou_short_14_shining_star.mp3`,
      offset: 0.7537,
      // ♩=158 の拍に合わせて、音源の波形の立ち上がりを 8 分音符ごとに測った値
      strengths:
        '90111231123127614065795165661831729095531819343471559651425482736279044727464536716256224235565791616434191956377136601344766115800661056597949081315342802054133549742576355255346229303274627242519551663617481544888243618361625062745855094917214765525083437461744135581646052276428241315171405162655918391731534361349941745165336157762245473721732636783837464736462637366626664525383619285450351534062551312112222220111111111111111111000110111111001'
    },
    jacket: { colors: ['#1f9bff', '#ff4d8d'], icon: 'star' },
    credit: '音楽：魔王魂（うた：詩歩）'
  }
];
