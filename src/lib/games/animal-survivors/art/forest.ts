import type { Art } from '../pixels';

/** 森の地面（16 ドットのタイル。草は 4 コマを場所で選ぶ）と飾り */
export const FOREST_ART: { grass: Art; dirt: Art; decor: Record<'flower' | 'tuft' | 'tree' | 'rock' | 'stump', Art> } =
  {
    grass: {
      w: 16,
      h: 16,
      frames: [
        [
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLldLLLLLLLLLL',
          'LLLLdLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLldLLLL',
          'LLLLLLLLLLdLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'ldLLLLLLLLLLLLLL',
          'dLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL'
        ],
        [
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLldLL',
          'LLLLLLLLLLLLdLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLldLLL',
          'LLLLLLLLLLldLLLL',
          'LLLLLLLLLLdLLLLL',
          'LLLLldLLLLLLLLLL',
          'LLLLdLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL'
        ],
        [
          'LLLLLLLLLLldLLLL',
          'LLLLLLLLLLdLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLldLLLL',
          'LldLLLLLLLdLLLLL',
          'LdLLLLLLLLLLLLLL',
          'LLLLLldLLLLLLLLL',
          'LLLLLdLLLLLLLLLL',
          'LLLLLLLLLLLLLldL',
          'LLLLLLLLLLLLLdLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL'
        ],
        [
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLldLldLLLLwldLL',
          'LLdLLdLLLLLLdLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLldLLLLL',
          'LLLLLyLLLdLLLldL',
          'LLLLLLLLLLLLLdLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLldL',
          'LLLLLLLLLLLLLdLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL'
        ]
      ]
    },
    dirt: {
      w: 16,
      h: 16,
      frames: [
        [
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLdLdLLLLLL',
          'LLLLLLdLdddLdLLL',
          'LLLdddddddLdLLLL',
          'LLdLddlddLddLLLL',
          'LdLdLddLddddLdLL',
          'LLLLdddddddLdLLL',
          'LLLdLdddLdLdLLLL',
          'LLLLLLLLdLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL',
          'LLLLLLLLLLLLLLLL'
        ]
      ]
    },
    decor: {
      flower: {
        w: 8,
        h: 8,
        frames: [['..kkk...', '.kwwwk..', '.kwywk..', '.kwywk..', '.kwwwk..', '..kkLk..', '..kLk...', '..kLk...']]
      },
      tuft: {
        w: 12,
        h: 8,
        frames: [
          [
            '............',
            '....l...l...',
            '....l.l.l...',
            '..l.d.l.d...',
            '..l.d.d.d.l.',
            '.ddddddddll.',
            '.dddddddddd.',
            '.dddddddddd.'
          ]
        ]
      },
      tree: {
        w: 32,
        h: 40,
        frames: [
          [
            '............kklLLLkk............',
            '...........klllllLLLk...........',
            '.........kklllllllLLLkk.........',
            '.......kklllllllllLLLLLkk.......',
            '......kllllllllllllLLLLLLk......',
            '.....klllllllllllllLLLLLLLk.....',
            '.....klllllllllllllLLLLLLLk.....',
            '....kLlllllllllllllLLLLLLLLk....',
            '....kLlllllllllllllLLLLLLLLk....',
            '....kdLlllllllllldLLLLLLLLdk....',
            '....kdLllllllllllldllLLLLLdk....',
            '.....kLLllllllllllllllLLLLk.....',
            '.....kLLLLlllllLLlllllLLLLk.....',
            '.....kllllLLLdLLLlllllLLLLk.....',
            '....klllllLLLLdLLLlllLLLLLLk....',
            '...kLlllllLLLLLLLLLdLLLLLLLLk...',
            '..kLLlllllLLLLLLLLLLdLLLLLLLLk..',
            '..kLLlllllLLLLLLLLLLLLLLLLLLLk..',
            '..kLLLLLLLdLLLLLLLLLLLLLLLLLLk..',
            '..kLLLLLLLLdLLLLLLLLLLLLLLLLLk..',
            '..kdLLLLLLLLLLLLLLLLLLdLLLLLdk..',
            '..kddLLLLLLLLLLLLLLLLLLdLLLddk..',
            '...kddLdLLLLddddddddLLdLLLddk...',
            '....kddddddddddddddddddddddk....',
            '.....kddddddkkkkkkkkddddddk.....',
            '......kkkkkk.kkkkkk.kkkkkk......',
            '............kTTTTTTk............',
            '............kTTTTTTk............',
            '............kTTTTTTk............',
            '............kTTTTTTk............',
            '............kTTTTTTk............',
            '............kTTTTTTk............',
            '............kTTTTTTk............',
            '............kTTTTTTk............',
            '............kTTTTTTk............',
            '............kTTTTTTk............',
            '...........kBTTTTTTBk...........',
            '..........kBkBBBBBBkBk..........',
            '...........k.kkkkkk.k...........',
            '................................'
          ]
        ]
      },
      rock: {
        w: 16,
        h: 12,
        frames: [
          [
            '................',
            '................',
            '....kkkkkkk.....',
            '..kkssssssskk...',
            '.kssswwssssssk..',
            '.ksswssssssssk..',
            'kssssssssSssssk.',
            'kSssssssssSssssk',
            '.kssssssssssssSk',
            '.kSSsssssssssSk.',
            '..kkSSSSSSSSSk..',
            '....kkkkkkkkk...'
          ]
        ]
      },
      stump: {
        w: 14,
        h: 12,
        frames: [
          [
            '..............',
            '....kkkkkk....',
            '..kkttttttkk..',
            '.kttttBtBtttk.',
            '.ktttBBBttttk.',
            '.kTTttttttTTk.',
            '.kTTTTTTTTTTk.',
            '.kTTTTTTTTTTk.',
            '.kTTTTTTTTTTk.',
            '.kBBBBBBBBBBk.',
            '..kkkkkkkkkk..',
            '..............'
          ]
        ]
      }
    }
  };
