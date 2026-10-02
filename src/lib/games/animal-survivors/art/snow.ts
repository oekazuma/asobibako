import type { Art } from '../pixels';

/** 雪山の地面（森と同じ 16 ドットのタイル。雪は 4 コマを場所で選ぶ）と飾り */
export const SNOW_ART: {
  grass: Art;
  dirt: Art;
  decor: Record<'pine' | 'rock' | 'ice' | 'drift' | 'tuft', Art>;
} = {
  grass: {
    w: 16,
    h: 16,
    frames: [
      [
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiwiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiIIiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiIIiiiiiiiiiii',
        'iiiiwiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'IiiiiiiiiiiiiiiI',
        'iiiiiiiiiiiiIIii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiIwiiiii'
      ],
      [
        'wiiiiiiiiiwiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiIIiiiiiiiiii',
        'iiiiiiiwiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiIIii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'IIiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'IIiiiiiiiiiiiiiI',
        'iiiiiiiiiiiiiiii'
      ],
      [
        'iwiiiiiiiiiiiiii',
        'iiiiiiIIiiiiiiii',
        'iIIiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiIIiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiwiiiii',
        'iiiiiIIiiiiiiiii',
        'iiiiiiiiiiiwIiii',
        'iiiiiiiiiiiiiiii'
      ],
      [
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'wiiiiiiiiiiiiiiI',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiIIiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiwiiiiiiiiiii',
        'IiiiiiiiiiiiiiiI',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'IiiiwiiiiiiiiiiI',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiIIiiiiiiii'
      ]
    ]
  },
  dirt: {
    w: 16,
    h: 16,
    frames: [
      [
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiIiiii',
        'iiiiiIiiiiiIIiii',
        'iiiiiIIiiiiIIiIi',
        'iiiiiIIiiIiiiIIi',
        'iiiIiiiiIIiiiIIi',
        'iiIIiiiiIIiiiiii',
        'iiIIiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii',
        'iiiiiiiiiiiiiiii'
      ]
    ]
  },
  decor: {
    pine: {
      w: 16,
      h: 22,
      frames: [
        [
          '.......kk.......',
          '......kwwk......',
          '......kwwk......',
          '.....kddDDk.....',
          '.....kddDDk.....',
          '....kddwwDDk....',
          '....kddwwDDk....',
          '...kwwddDDiik...',
          '...kwdddDDDik...',
          '....kddwwDDk....',
          '...kdddwwDDDk...',
          '..kdddddDDDDDk..',
          '..kwddddDDDDik..',
          '.kwwddddDDDDiik.',
          '..kkddddDDDDkk..',
          '..kdddddDDDDDk..',
          '.kddddddDDDDDDk.',
          '.kwdddddDDDDDik.',
          'kwwdddddDDDDDiik',
          '.kkkkkkTTkkkkkk.',
          '......kTTk......',
          '.......kk.......'
        ]
      ]
    },
    rock: {
      w: 12,
      h: 10,
      frames: [
        [
          '............',
          '............',
          '...kkkkkk...',
          '.kkwwwwwwkk.',
          'kwwwwwwwwwwk',
          'kssssssssssk',
          'kssssssssssk',
          'kssssssssssk',
          '.kSSSSSSSSk.',
          '..kkkSSkkk..'
        ]
      ]
    },
    ice: {
      w: 10,
      h: 9,
      frames: [
        [
          '.....kk...',
          '....kwjk..',
          '..kkkjJk..',
          '.kwjkjJkk.',
          '.kjJkjJwjk',
          '.kjJkjJjJk',
          '.kjJkjJjJk',
          '.kjJkjJjJk',
          '..kk.kkkk.'
        ]
      ]
    },
    /** 雪と同じ色なので黒いふちを付けず、下の影だけで盛り上がりを見せる */
    drift: {
      w: 16,
      h: 7,
      frames: [
        [
          '................',
          '................',
          '....wwwwwwww....',
          '..wwwwwwwwwwww..',
          '.wwwwwwwwwwwwww.',
          '.IIIIIIIIIIIIII.',
          '.IIIIIIIIIIIIII.'
        ]
      ]
    },
    /** 雪から出た小枝と赤い実 */
    tuft: {
      w: 9,
      h: 9,
      frames: [
        [
          '.k...kwk.',
          'kwk..krrk',
          'krrk.kTk.',
          '.kTkkkTk.',
          '..kTTTk..',
          '...kTk...',
          '..kkTkk..',
          '.kiiiiik.',
          '..kkkkk..'
        ]
      ]
    }
  }
};
