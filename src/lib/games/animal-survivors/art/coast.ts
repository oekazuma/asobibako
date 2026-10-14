import type { Art } from '../pixels';

/** 海岸の地面（16 ドットのタイル。砂浜は 4 コマを場所で選び、dirt は 8% のタイルに散る潮だまり）と飾り。砂の濃い粒だけ pal で足す */
export const COAST_ART: {
  grass: Art;
  dirt: Art;
  decor: Record<'shell' | 'starfish' | 'seaweed' | 'pebble', Art>;
} = {
  grass: {
    w: 16,
    h: 16,
    frames: [
      [
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'wccccccccccccccc',
        'cccccccccecccecc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'ccceeccccccccccc',
        'cccccccccccccccc',
        'ccccccccccccccec',
        'cccccccccccccccc',
        'ccccccccccccccwc',
        'cccccccccccccccc',
        'cccccccccceccccc'
      ],
      [
        'cccccccccccccccc',
        'cccwcccccccccccc',
        'cccccccccecceccc',
        'eccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccceccc',
        'cccccccccccccccc',
        'eccccccccccccccc',
        'cccccwcccccccccc',
        'cccccccccccccccc',
        'cceeeecccccccccc',
        'ccceeccccccccccc',
        'cccccccccccccccc'
      ],
      [
        'cccccccceccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'eccccccccccccccc',
        'cccccccccccecccc',
        'ccccccccccccccce',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccecccccccccc',
        'cccccccccecccccc',
        'ccccccccccwccccc',
        'cccccccccccccccw',
        'cccccccccccccccc'
      ],
      [
        'cccccccccccccccc',
        'cecccccccccccccc',
        'cccccccccccccccc',
        'cccccceeeecccccc',
        'ccccccceeccccccc',
        'eeeecceccccccccc',
        'ceeccccccccccccc',
        'cccccccceccccccc',
        'ccccccwccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccccccccccccccc',
        'ccccccccccccccwc',
        'cccccccecccceccc',
        'ccccccccccccccec'
      ]
    ],
    pal: { e: '#e2c088' }
  },
  dirt: {
    w: 16,
    h: 16,
    frames: [
      [
        'cccccccccccccccc',
        'cccccccccccccccc',
        'cccecccccccccccc',
        'cccccceeeecccccc',
        'ccceeeeeeeeeeccc',
        'cceeJJJJJJJJeecc',
        'ceewwjjjjjJJweec',
        'ceJjjjjjjjjJJJec',
        'eeJjjjjjjjjJJJee',
        'ceJJJjjjjJJJJJec',
        'ceeJJJJJJJJJJeec',
        'cceeJJJJJJwwwecc',
        'ccceewweeeeeeccc',
        'cccccceeeecccccc',
        'cccccccccccccecc',
        'cccccccccccccccc'
      ]
    ],
    pal: { e: '#e2c088' }
  },
  decor: {
    shell: {
      w: 10,
      h: 8,
      frames: [
        ['....kk....', '..kkppkk..', '.kpwpwpwk.', 'kppwpwpwpk', 'kppwpwpwpk', 'krrwpwprrk', '.kkrrrrkk.', '...kkkk...']
      ]
    },
    starfish: {
      w: 11,
      h: 10,
      frames: [
        [
          '.....k.....',
          '....kok....',
          '....kok....',
          'kkkkoookkkk',
          '.kooyyyook.',
          '..koooook..',
          '...koook...',
          '..kookook..',
          '.kook.kook.',
          '.kkk...kkk.'
        ]
      ]
    },
    seaweed: {
      w: 12,
      h: 9,
      frames: [
        [
          '...k....k...',
          '..kLk..kLk..',
          '..kLk.kLLk.k',
          '.kLLkkLdk.kL',
          'kLdLLLdLkkLk',
          'kLLdLLLLLLdk',
          '.kdLLdLLdLk.',
          '..kkdkkLkk..',
          '....k..k....'
        ]
      ]
    },
    pebble: {
      w: 8,
      h: 6,
      frames: [['..kkkk..', '.kssssk.', 'kswssssk', 'SssssssS', 'kSssssSk', '.kSSSSk.']]
    }
  }
};
