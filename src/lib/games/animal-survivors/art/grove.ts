import type { Art } from '../pixels';

/** 魔法の森の地面（16 ドットのタイル。苔は 4 コマを場所で選び、dirt は 8% のタイルに散る花の群れ）と飾り。苔の色だけ pal で足す */
export const GROVE_ART: {
  grass: Art;
  dirt: Art;
  decor: Record<'mushroom' | 'flower' | 'root' | 'mote', Art>;
} = {
  grass: {
    w: 16,
    h: 16,
    frames: [
      [
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaAaaa',
        'aaaaaaaaaaeaaaaa',
        'aaAaeaaaaaaaaaaa',
        'aaAaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaAaaaaeaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaAaaaa',
        'aaaaAeaaaaAaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaeaaaAaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaAaa'
      ],
      [
        'aaAaaaaaaaaaaaAa',
        'aaaaaaaaaaaaaeaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaeaaaAaA',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaeaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaeeeaaaaaaaaA',
        'aaaeeeeeaaaaaaaa',
        'aaaAAAAAaaaaaaaa',
        'aaaAaaaaaaaaaaea',
        'aaaeaAaaaAaaaaaa',
        'aaaaaaaaaaaaaaea',
        'aaaaaaaaaaaaaaaa'
      ],
      [
        'eaaaaaaaaaaaaaaa',
        'aAaaaaaaAaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaeeeaaaa',
        'aaaaaaaaeeeeeaaa',
        'AaaaaaAaaAAAAaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaAaaaaaaa',
        'aaaaaaAaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaeaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaeaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaAa',
        'aaaaaaaAaaaaAaaa',
        'aaaaaeaaaaaaaaAa'
      ],
      [
        'aaaaaaaaaaaaaAaa',
        'aaaaaaaaaaaaaaaa',
        'aaaeeaaaaaaaaaaa',
        'aaeeeeaaaaaaaaaa',
        'aaAAAAaaaaaaaaaa',
        'aaaeaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'AaaaaaaaaAaaaaaa',
        'AAaaaaaaAaaaaaaa',
        'aaaaaaaaeaAAaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaeeeaAa',
        'aaaaaaaaaeeeeeaA',
        'aaaaaaaaaAAAAAaa',
        'aaaaaaaaaaaaeaaa',
        'aaaaaaeaaaaaaaaa'
      ]
    ],
    pal: { a: '#3f7d55', A: '#336947', e: '#55966a' }
  },
  dirt: {
    w: 16,
    h: 16,
    frames: [
      [
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaea',
        'aAaaaaaaaaaaaaaa',
        'aaaaaaawaaaaaaaa',
        'aaaaaawywaaaaaaa',
        'aaaaaaawaaLapaaa',
        'aaLaaLaaaaapwpaa',
        'aaaapaaaaaaapaaa',
        'aaapypaaaqaaaaaa',
        'aaaapaaLqyqaLaaa',
        'aaaLaaaaaqaaaLaa',
        'aaaaLaaaaLawdaaa',
        'aaaqdaLaLawywaaa',
        'aaqwqaaadaawaaaa',
        'aaaqaaaaaaaaaaAa',
        'aaaaaaaaaaaaaaaa'
      ]
    ],
    pal: { a: '#3f7d55', A: '#336947', e: '#55966a' }
  },
  decor: {
    mushroom: {
      w: 11,
      h: 9,
      frames: [
        [
          '..kkkk.....',
          '.kowook....',
          'koooowok...',
          'kYYYYYYkkk.',
          '.kkckkkowok',
          '..kck.kYYYk',
          '..kck..kck.',
          '..kck..kck.',
          '...k....k..'
        ]
      ]
    },
    flower: {
      w: 8,
      h: 6,
      frames: [['.p......', 'pyp..q..', '.p..qwq.', '.L...q..', '.Ll.lL..', '..LlL...']]
    },
    root: {
      w: 18,
      h: 8,
      frames: [
        [
          '..................',
          '......kkk.........',
          '...kkktttbbkk.....',
          '..ktbtttttttlk....',
          '.kttTbbbTTTlLtkk..',
          'ktTTkktkkkkkTTttk.',
          'TTkkkTTk....kkTTTk',
          'kk...kk.......kkk.'
        ]
      ]
    },
    mote: {
      w: 7,
      h: 5,
      frames: [['..j....', '.jwj...', '..j..y.', '......y', '.y.....']]
    }
  }
};

/** 妖精の輪（半径 30 の円に並んだキノコ）。絵の中心が輪の中心で、中は透明 */
export const FAIRY_RING_ART: Art = {
  w: 68,
  h: 72,
  frames: [
    [
      '....................................................................',
      '....................................................................',
      '.....................................kkk............................',
      '....................................kvwvk...........................',
      '.....................kkk...........kvvvvwk..........................',
      '....................khwhk..........kVVVVVk..........................',
      '...................khhhhwk..........kkckk...........................',
      '...................kJJJJJkAdAAAAdAAAAkckAA..........................',
      '....................kkckkAAAdAAAAdAAAAkAAAAdA.y....kkk..............',
      '.....................kckdAAAAdAAAAdAAAAdAAAAdAA...kpwpk.............',
      '...................AdAkAAdA...j..........AAAAdAAAkppppwk............',
      '.................AAAAdAA....................AAdAAkRRRRRk............',
      '................AdAAA..........................dAAkkckk.............',
      '..............jAAAd..............................AAkck..............',
      '.........kkk.AdAAA................................AAkAd.............',
      '........kpwpkAAdA..................................AAAAd............',
      '.......kppppwkA......................................AAAd...........',
      '.......kRRRRRk........................................AAAd..........',
      '........kkckk..........................................AAAd.........',
      '.........kck............................................AAA.........',
      '........AAkA............................................AAAA.kkk....',
      '.......AAAA.............................................jAAAkhwhk...',
      '.......dAA................................................Akhhhhwk..',
      '......AAd..................................................kJJJJJk..',
      '......AAA..................................................dkkckk...',
      '.....dAA....................................................dkck....',
      '.....AdA....................................................Adk.....',
      '....AAAdy...................................................AAdA....',
      '...kkkA......................................................AAd....',
      '..kvwvk......................................................AAA....',
      '.kvvvvwk.....................................................AAAA...',
      '.kVVVVVk......................................................AAA...',
      '..kkckk.......................................................dAA...',
      '...kck........................................................AdA...',
      '...AkA........................................................AAd.j.',
      '...AAd........................................................AAA...',
      '...AAA........................................................Akkk..',
      '...AAA........................................................kvwvk.',
      '...dAA.......................................................kvvvvwk',
      '...AdA.......................................................kVVVVVk',
      '...AAd........................................................kkckk.',
      '...AAA........................................................Akck..',
      '..jAAA........................................................dAk...',
      '...dAA........................................................AdA...',
      '...Adkkk......................................................AAd...',
      '...Akhwhk....................................................AAAA...',
      '...khhhhwk...................................................dAA....',
      '...kJJJJJk...................................................AdA....',
      '....kkckk...................................................AAAd....',
      '.....kck....................................................yAA.....',
      '.....dkA.................................................kkkdAA.....',
      '......dAA...............................................kpwpkd......',
      '......AdA..............................................kppppwk......',
      '.......AdA.............................................kRRRRRk......',
      '.......AAdA.............................................kkckk.......',
      '........AAdAj...........................................Akck........',
      '.........AAd...kkk......................................dAk.........',
      '.........AAAd.kpwpk....................................AAdA.........',
      '..........AAAkppppwk..................................AAAA..........',
      '...........AAkRRRRRk.................................AdAA...........',
      '............AAkkckk..........................kkk...AAAAd............',
      '.............AAkck..........................khwhk.AdAAA.............',
      '..............AAkdA..........kkk...........khhhhwkAAdA..............',
      '................AAdAA.......kvwvk..........kJJJJJkAA..j.............',
      '.................AAdAAAA...kvvvvwk..........kkckkdA.................',
      '...................AdAAAAdAkVVVVVk.......AAAAkckA...................',
      '.....................dAAAAdAkkckkAAAdAjAAdAAAAk.....................',
      '.......................AAAAdAkckdAAAAdAAAAdAA.......................',
      '......................y...AAdAkAAdAAAAdAAA..........................',
      '....................................................................',
      '....................................................................',
      '....................................................................'
    ]
  ],
  pal: { a: '#3f7d55', A: '#336947', e: '#55966a', V: '#7d48b8', h: '#9fe8c8' }
};
