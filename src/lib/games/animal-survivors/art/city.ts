import type { Art } from '../pixels';

/** 夜の街の地面（16 ドットのタイル。アスファルトは 4 コマを場所で選び、dirt は 8% のタイルに散る側溝のふた）と飾り。アスファルトの色だけ pal で足す */
export const CITY_ART: {
  grass: Art;
  dirt: Art;
  decor: Record<'manhole' | 'line' | 'can' | 'leaf', Art>;
} = {
  grass: {
    w: 16,
    h: 16,
    frames: [
      [
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaAaaa',
        'aaaaaaaaaaAaaaaa',
        'aaAaaaaaaaaaaaaa',
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
        'aaaaaaaaaaaaaeaa'
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
        'aaaAaaaaaaaaaaae',
        'aaaaAAaaaaaaaaaa',
        'aaaAaaAAaaaaaaaa',
        'aaaAaaaAaaaaaaaa',
        'aaaeaAaaaAaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa'
      ],
      [
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaAaaaaa',
        'aaaaaaaAaaeaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaAaAaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaeaaaaaaaaaa',
        'aeaaaaaaaaAaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaAaaaaaaaa',
        'AaaaaAaaaaaaaaaa',
        'aaaaaaaaaaaaaaea',
        'aaaeaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa'
      ],
      [
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaeaaaaaaaaaaa',
        'aaaaaaaAaaaaaaaa',
        'aaaaaaAaaaaaaaaa',
        'aaaaaaaaaaaAaaaa',
        'aaaaaaaaaaaaaaAa',
        'aaeaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaA',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaAaaaaaaaaA',
        'aaaaaaaaaaaaaaea',
        'aaaaaaaaaaaaaaaa',
        'aeaaaaaaaaaeaaaa',
        'aaaaaaaaAAaaaaaa'
      ]
    ],
    pal: { a: '#3c4357', A: '#323849', e: '#525a70' }
  },
  dirt: {
    w: 16,
    h: 16,
    frames: [
      [
        'aaaaaaaaaaaaaaaa',
        'aaaaaaAaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaaaaa',
        'aAggggggggggggaa',
        'aaSkSkSkSkSkSSaa',
        'aaSkSkSkSkSkSSaa',
        'aaSkSkSkSkSkSSaa',
        'aaSkSkSkSkSkSSaa',
        'aaSkSkSkSkSkSSaa',
        'aaSkSkSkSkSkSSaa',
        'aAGGGGGGGGGGGGaa',
        'aaAAAAAAAAAAAAaa',
        'aaaaaaaaaaaaaaaa',
        'aaaaaaaaaaaaeaaa',
        'aaaaaaaaaaaaaaaa'
      ]
    ],
    pal: { a: '#3c4357', A: '#323849', e: '#525a70' }
  },
  decor: {
    manhole: {
      w: 14,
      h: 10,
      frames: [
        [
          '...kkkkkkkk...',
          '..kSggggggSk..',
          '.kSSgGssGsSgk.',
          'kSGsGsGsGsGsSk',
          'SSGGsGsGsGsGSS',
          'SSGsGsGsGsGsSS',
          'kSGGGGsGGsGGSk',
          '.kSSGGGGGGSSk.',
          '..kSSSSSSSSk..',
          '...kkkkkkkk...'
        ]
      ]
    },
    line: {
      w: 16,
      h: 5,
      frames: [['kkkkkkkk..kkkkkk', 'kwwwwiwwkkwiwwwk', 'kiwwwwwwiwwwwiwk', 'kkkkkkkkkkkkkkkk', '................']]
    },
    can: {
      w: 9,
      h: 6,
      frames: [['.kkkkkk..', 'kswrrrrkk', 'ksrwwrrks', 'kSrrrrRkS', '.kkkkkkkk', '.........']]
    },
    leaf: {
      w: 8,
      h: 7,
      frames: [['.kk..kk.', 'kyykkyyk', 'kyyyyyYk', '.kyyyYk.', '..kyYk..', '...kYk..', '....kk..']]
    }
  }
};

/** 街灯。足もとの台の下の端が立っている場所 */
export const STREET_LIGHT_ART: Art = {
  w: 14,
  h: 32,
  frames: [
    [
      '....kkk.......',
      '.kkkGSSkkk....',
      'kGGGGGGGSSk...',
      'kGGGGGGGGSk...',
      'kywwyyyGkSk...',
      '.kyyYYkkkSSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '........kgSk..',
      '.......kGGGGk.',
      '.......kGgGGk.',
      '......kGGGGGGk',
      '.....kGGGGGGGk',
      '......kGGGGGGk',
      '.......kkkkkk.'
    ]
  ]
};
