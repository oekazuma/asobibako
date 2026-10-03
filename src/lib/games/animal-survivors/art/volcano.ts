import type { Art } from '../pixels';

/** 火山の地面（森と同じ 16 ドットのタイル。岩は 4 コマを場所で選ぶ）と飾り。溶岩の池と割れ目は大きさが毎回ちがうので draw-volcano.ts が描く */
export const VOLCANO_ART: {
  grass: Art;
  dirt: Art;
  decor: Record<'basalt' | 'spire' | 'crack' | 'smoke' | 'ember', Art>;
} = {
  grass: {
    w: 16,
    h: 16,
    frames: [
      [
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMmMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMmMMMM',
        'MMMMMMMMMMMMMMMM',
        'MmMMMMMMMMMMMMMM',
        'MMMMmMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMTMMMMMm',
        'MMMMMMMMMTMMmMMM',
        'MMMMTMMMMMMMMMMM',
        'MMMMTMMMMmMMMMMM'
      ],
      [
        'MMMMMMMMMMMMTMMm',
        'MMMMMMMMMMMMTMMM',
        'MMMMmMMMMMMMMMMM',
        'MMMMMMmMmMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMTMMMMMm',
        'MMMMMMMMMTMMmMMM',
        'MMMMMMMMMMMMMMMm',
        'MMMMMMMMMMMMMMMM'
      ],
      [
        'MMMMMMMMMMMMMMTM',
        'MMMMMMMMMMMMMMTM',
        'MmMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMTMMMMMMM',
        'MmMMMMMMTMMMMMMM',
        'MMMMMMMMmMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMmMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMmMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMmMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMmMMMM',
        'MMMMMMMMMMMMMMMM'
      ],
      [
        'MMmMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMmMMMMmMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMmMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMm',
        'MMMMMMMMMMMMMMMM',
        'MMMTMMMMMMMMMMMM',
        'MMMTMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMTMMMMMMMMMMMMM',
        'MMTMMMMMMMMMMMMM',
        'MMMMMMMMMMMmMMMm'
      ]
    ]
  },
  dirt: {
    w: 16,
    h: 16,
    frames: [
      [
        'MMMMMmMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMmMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMrrrMMMMMrrrrMM',
        'rrooorrMMrooyorr',
        'ooMMMyorroMMMMoo',
        'MMmMMMMooMMMMMMM',
        'MMMMMMMMMMMMMMmM',
        'MmMMMMMMMMMMMMMM',
        'MMMMMMMMMMMMMMMM',
        'MMMMMMMMMMmMMMMM',
        'MMMMMMMMMMMMMMMM'
      ]
    ]
  },
  decor: {
    basalt: {
      w: 12,
      h: 10,
      frames: [
        [
          '............',
          '.....kk.....',
          '..kkkGGkkk..',
          '.kSSSSSSGGk.',
          'kGSsSSSSGGGk',
          'kGSSSSSSGGGk',
          'kGGGSSGGGGGk',
          'kGGGGGGGGGGk',
          '.kGGGGGGGGk.',
          '..kkkGGkkk..'
        ]
      ]
    },
    spire: {
      w: 12,
      h: 22,
      frames: [
        [
          '............',
          '............',
          '.....kk.....',
          '....kNNk....',
          '....kNGk....',
          '...kNNNNk...',
          '...kNnNNk...',
          '...kNnNNk...',
          '...kNnNNk...',
          '..kNNnnNNk..',
          '..kNNNnNNk..',
          '..kNNNnNNk..',
          '..kNNNnNNk..',
          '..kNNNnNNk..',
          '.kNNNNnoNNk.',
          '.kNNNnnoNNk.',
          '.kNNNnNoNNk.',
          '.kNNNnNyNNk.',
          'kNNNNnNoNNNk',
          'kNNNNNNoNNNk',
          'kNNNNNNNNNNk',
          '.kkkkkkkkkk.'
        ]
      ]
    },
    crack: {
      w: 16,
      h: 7,
      frames: [
        [
          '................',
          '.........kkkk...',
          '...kkk..krrrrkk.',
          '.kkrrrkkrkoyoork',
          'kroooooyoookkkk.',
          '.kkkkkkkkkk.....',
          '................'
        ]
      ]
    },
    smoke: {
      w: 12,
      h: 16,
      frames: [
        [
          '....kgk.....',
          '...kgggk....',
          '....kgkgk...',
          '.....kgggk..',
          '.....kgggk..',
          '....kgggk...',
          '...kggggk...',
          '...kggggk...',
          '...kkggkk...',
          '..kGGGGGGk..',
          '.kGGooooGGk.',
          'kGGGooyoGGGk',
          'kGGGGGGGGGGk',
          '.kGGGGGGGGk.',
          '..kGGGGGGk..',
          '...kkkkkk...'
        ]
      ]
    },
    ember: {
      w: 9,
      h: 9,
      frames: [
        [
          '.........',
          '....k.k..',
          '...kokrk.',
          '..krokk..',
          '..koyok..',
          '.krooork.',
          '.krooork.',
          '..krrrk..',
          '...kkk...'
        ]
      ]
    }
  }
};
