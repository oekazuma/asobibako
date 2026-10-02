import type { Art } from '../pixels';

/** 夜の墓地の地面（森と同じ 16 ドットのタイル。芝は 4 コマを場所で選ぶ）と飾り */
export const GRAVE_ART: {
  grass: Art;
  dirt: Art;
  decor: Record<'tomb' | 'cross' | 'deadtree' | 'candle' | 'bones', Art>;
} = {
  grass: {
    w: 16,
    h: 16,
    frames: [
      [
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnvNnnnnnnnnnn',
        'nnnnNnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnvNnnnn',
        'nnnnnnnnnnNnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'vNnnnnnnnnnnnnnn',
        'Nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn'
      ],
      [
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnvNnn',
        'nnnnnnnnnnnnNnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnvNnnn',
        'nnnnnnnnnnvNnnnn',
        'nnnnnnnnnnNnnnnn',
        'nnnnvNnnnnnnnnnn',
        'nnnnNnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn'
      ],
      [
        'nnnnnnnnnnvNnnnn',
        'nnnnnnnnnnNnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnvNnnnn',
        'nvNnnnnnnnNnnnnn',
        'nNnnnnnnnnnnnnnn',
        'nnnnnvNnnnnnnnnn',
        'nnnnnNnnnnnnnnnn',
        'nnnnnnnnnnnnnvNn',
        'nnnnnnnnnnnnnNnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn'
      ],
      [
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnvNnvNnnnnwvNnn',
        'nnNnnNnnnnnnNnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnvNnnnnn',
        'nnnnnynnnNnnnvNn',
        'nnnnnnnnnnnnnNnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnvNn',
        'nnnnnnnnnnnnnNnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn'
      ]
    ]
  },
  dirt: {
    w: 16,
    h: 16,
    frames: [
      [
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnmnmnnnnnn',
        'nnnnnnmnmmmnmnnn',
        'nnnmmmmmmmnmnnnn',
        'nnmnmmMmmnmmnnnn',
        'nmnmnmmnmmmmnmnn',
        'nnnnmmmmmmmnmnnn',
        'nnnmnmmmnmnmnnnn',
        'nnnnnnnnmnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn',
        'nnnnnnnnnnnnnnnn'
      ]
    ]
  },
  decor: {
    tomb: {
      w: 12,
      h: 14,
      frames: [
        [
          '...kkkkkk...',
          '..kqqsssssk.',
          '.kqssssssssk',
          '.kqssssSsssk',
          '.kqssSSSSssk',
          '.kqssssSsssk',
          '.kqssssSsssk',
          '.kqsssssssSk',
          '.kqsssssssSk',
          '.ksssssssSSk',
          '.kSSSSSSSSSk',
          'kkkkkkkkkkkk',
          'kMmmmmmmmmMk',
          '.kkkkkkkkkk.'
        ]
      ]
    },
    cross: {
      w: 10,
      h: 14,
      frames: [
        [
          '....kk....',
          '...ktTk...',
          '...ktTk...',
          '.kkktTkkk.',
          'ktttttTTTk',
          'kTTTTTTTTk',
          '.kkktTkkk.',
          '...ktTk...',
          '...ktTk...',
          '...ktTk...',
          '...ktTk...',
          '..kMmmMk..',
          '.kMmmmmMk.',
          '..kkkkkk..'
        ]
      ]
    },
    deadtree: {
      w: 16,
      h: 18,
      frames: [
        [
          '..k.......k.....',
          '.kTk..k..kTk....',
          '..kTkkTk.kTk..k.',
          '...kTTk..kTk.kTk',
          '....kTk..kTkkTk.',
          '....kTTkkTTTTk..',
          '.....kTTTTkkk...',
          '......kTTTk.....',
          '......kTTTk.....',
          '......kTTk......',
          '......kTTk......',
          '.....kTTTk......',
          '.....kTTTk......',
          '.....kTTTTk.....',
          '....kTTTTTk.....',
          '...kTTkTTTTk....',
          '..kTk.kTk.kTk...',
          '..kk...k...kk...'
        ]
      ]
    },
    candle: {
      w: 8,
      h: 10,
      frames: [
        [
          '..y.....',
          '.yYy..y.',
          '..k..yYy',
          '.kwk..k.',
          '.kwk.kwk',
          '.kck.kwk',
          '.kck.kck',
          '.kck.kck',
          'kcccccck',
          '.kkkkkk.'
        ]
      ]
    },
    bones: {
      w: 10,
      h: 6,
      frames: [['.kk....kk.', 'kqqkkkkqqk', '.kqqqqqqk.', '.kqqqqqSk.', 'kqqkkkkqSk', '.kk....kk.']]
    }
  }
};
