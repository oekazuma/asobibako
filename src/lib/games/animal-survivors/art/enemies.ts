import type { Art } from '../pixels';

/** 右向き（自分のほうを向くよう、描くときに反転する）。2 コマで歩くか羽ばたく */
export const ENEMY_ART: Record<'rat' | 'bat' | 'snake' | 'caterpillar' | 'boar', Art> = {
  rat: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '......k.....',
        'k....kpk....',
        'pk.kkkppkkk.',
        'pkkggggggggk',
        'kpgggggggkgk',
        '.kgggggggGGp',
        '.kGccccGGkwk',
        '..kkkGkkk...',
        '...kGkkGk...',
        '....k..k....',
        '............'
      ],
      [
        '............',
        '......k.....',
        'k....kpk....',
        'pk.kkkppkkk.',
        'pkkggggggggk',
        'kpgggggggkgk',
        '.kgggggggGGp',
        '.kGccccGGkwk',
        '..kkkGkkk...',
        '..kGkk.kGk..',
        '...k....k...',
        '............'
      ]
    ]
  },
  bat: {
    w: 14,
    h: 12,
    frames: [
      [
        '..............',
        '.kk..k..k..kk.',
        'kUvkkGkkGkkvUk',
        '.kUvkkGGkkvUk.',
        '..kvvGGGGvvk..',
        '..kUvGyGyvUk..',
        '...kUGGGGUk...',
        '....kGwkwk....',
        '.....kkkk.....',
        '..............',
        '..............',
        '..............'
      ],
      [
        '..............',
        '.....k..k.....',
        '....kGkkGk....',
        '.....kGGk.....',
        '....kGGGGk....',
        '....kGyGyk....',
        '..kkvGGGGvk...',
        '.kvvvGwkwvvk..',
        'kvvUUkkkkUUvk.',
        'kUUkk....kkUUk',
        '.kk........kk.',
        '..............'
      ]
    ]
  },
  snake: {
    w: 14,
    h: 12,
    frames: [
      [
        '..............',
        '.........kkk..',
        '........klllk.',
        '.......klllklk',
        '.......klllLLr',
        '.......klllkk.',
        '..kkk..klLlk..',
        '.klllkkkllLk..',
        'kllLlllLllk...',
        'kLLyyyyylLk...',
        '.kkyyyyyLk....',
        '...kkkkkk.....'
      ],
      [
        '..............',
        '.........kkk..',
        '........klllk.',
        '.......klllklk',
        '.......klllLLr',
        '.......klllkk.',
        '......kklLlk..',
        '.kkkkkllllLk..',
        'kllLlllLllk...',
        'kLlyyyyyLLk...',
        '.kLyyyyykk....',
        '..kkkkkk......'
      ]
    ]
  },
  caterpillar: {
    w: 16,
    h: 12,
    frames: [
      [
        '................',
        '...............k',
        '.............k..',
        '............kok.',
        '..kk...kkk.koowk',
        '.kllkkklllkoookk',
        'kllylllllylooook',
        'kLllllylllllyrrk',
        '.kLLlllLLLllLkk.',
        '..kkLLLkkkLLk...',
        '....kkk...kk....',
        '................'
      ],
      [
        '................',
        '...............k',
        '.............k..',
        '............kok.',
        '....kkk...kkoowk',
        '..kklllkkkloookk',
        '.kllllylllloyook',
        'kllylllllyllrrrk',
        'kLllLLLlllLLkkk.',
        '.kLLkkkLLLkk....',
        '..kk...kkk......',
        '................'
      ]
    ]
  },
  boar: {
    w: 20,
    h: 14,
    frames: [
      [
        '.............k......',
        '............kTk.....',
        '...k.kkkkkkkkTk.....',
        '...BkBTBTBTBkTTk....',
        '..kTTTTTTTTTTTTTk...',
        '.kTTTTTTTTTTTTTkTkk.',
        '.kTTTTTTTTTTTTTTTppk',
        '.kBTTTTTTTTTTTTTpkkk',
        '..kBttttttttTTTTBrrk',
        '...kTTBttTTBBTBBwkk.',
        '...kBBkBBBBkBBkkww..',
        '...kBBkBBBBkBBk.....',
        '....kk.kkkk.kk......',
        '....................'
      ],
      [
        '.............k......',
        '............kTk.....',
        '...k.kkkkkkkkTk.....',
        '...BkBTBTBTBkTTk....',
        '..kTTTTTTTTTTTTTk...',
        '.kTTTTTTTTTTTTTkTkk.',
        '.kTTTTTTTTTTTTTTTppk',
        '.kBTTTTTTTTTTTTTpkkk',
        '..ktttttttttBTTTBrrk',
        '..kBTBttBBTTkTTBwkk.',
        '..kBBkBBkkBBkBBkww..',
        '..kBBkBBkkBBkBBk....',
        '...kk.kk..kk.kk.....',
        '....................'
      ]
    ]
  }
};
