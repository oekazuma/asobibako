import type { Art } from '../pixels';

/** 右向き（自分のほうを向くよう、描くときに反転する）。2 コマで歩くか羽ばたく */
export const ENEMY_ART: Record<'rat' | 'bat' | 'snake' | 'caterpillar' | 'boar' | 'spider' | 'croc' | 'lantern', Art> =
  {
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
    },
    spider: {
      w: 16,
      h: 14,
      frames: [
        [
          'kGGkkGGk.kGkkGGk',
          '.kkGGkGGkkGkkGGk',
          '...kkGkkGkGkkGk.',
          '...kkkGkGkGkGk..',
          '..kTTTTTGkGkGk..',
          '.kTTTTTTTGGGGk..',
          'kTTToToTTGGGGrk.',
          'kkTTTTTTTGGGGrk.',
          '.kkoToTTTGGGGk..',
          '..kkkkTkGkGkGk..',
          '...kkkGkGkGkGk..',
          '...kkGkkGkGkkGkk',
          '..kGGkkGk.kGkkGG',
          '...kk..k...k..kk'
        ],
        [
          '..kGk.kGk.kGk.kG',
          '...kGkkGk.kGkkGk',
          '....kGkkGkGkkGk.',
          '...kkkGkGkGkGk..',
          '..kTTTTTGkGkGk..',
          '.kTTTTTTTGGGGk..',
          'kTTToToTTGGGGrk.',
          'kkTTTTTTTGGGGrk.',
          '.kkoToTTTGGGGk..',
          '..kkkkTkGkGkGk..',
          '...kkkGkGkGkGk..',
          '.kkkkGkkGkGkkGk.',
          'kGGGGGGGkkGkkGGk',
          '.kkkkkkk..k..kk.'
        ]
      ]
    },
    croc: {
      w: 26,
      h: 12,
      frames: [
        [
          '..........................',
          '..........................',
          '...............kkkkk......',
          '.......kkkkkkkkLLkyLkkkkk.',
          '....kkkLLLLLLLLLLLLwLwLLLk',
          '..kkdLdLdLdLdLdLLkkkkkkkLL',
          '.kLLLLLLLLLLLLLLLLwLwLwLLL',
          'kLLLLLLLLLLLLLLLLLLLLLLLLL',
          'kdddddLccccccccccdLLdddddd',
          '.kkkkkddkddkkkkddkddkkkkkk',
          '......kk.kk....kk.kk......',
          '..........................'
        ],
        [
          '..........................',
          '..........................',
          '...............kkkkk......',
          '.......kkkkkkkkLLkyLkkkkk.',
          '....kkkLLLLLLLLLLLLwLwLLLk',
          '..kkdLdLdLdLdLdLLkkkkkkkLL',
          '.kLLLLLLLLLLLLLLLLwLwLwLLL',
          'kLLLLLLLLLLLLLLLLLLLLLLLLL',
          'kddddLLccccccccccddLLddddd',
          '.kkkkddkkkddkkddkkkddkkkkk',
          '.....kk...kk..kk...kk.....',
          '..........................'
        ]
      ]
    },
    lantern: {
      w: 10,
      h: 14,
      frames: [
        [
          '...kkkk...',
          '..kTTTTk..',
          '.kTTTTTTk.',
          '..kyyyyk..',
          '..kywwyk..',
          '..kyyyyk..',
          '..kTTTTk..',
          '...kttk...',
          '...kttk...',
          '...kttk...',
          '...kttk...',
          '..kttttk..',
          '.kTTTTTTk.',
          '..kkkkkk..'
        ],
        [
          '...kkkk...',
          '..kTTTTk..',
          '.kTTTTTTk.',
          '..kYyyYk..',
          '..kyywyk..',
          '..kYyyYk..',
          '..kTTTTk..',
          '...kttk...',
          '...kttk...',
          '...kttk...',
          '...kttk...',
          '..kttttk..',
          '.kTTTTTTk.',
          '..kkkkkk..'
        ]
      ]
    },
    ghost: {
      w: 12,
      h: 12,
      frames: [
        [
          '...kkkkkk...',
          '..kwwwwwwk..',
          '.kwwwwwwwwk.',
          '.kwkwwwwkwk.',
          '.kwkwwwwkwk.',
          '.kwwwwwwwwk.',
          '.kwwwkkwwwk.',
          '.kwwwkkwwqk.',
          '.kwwwwwwqqk.',
          '.kqwwwwqqqk.',
          '.kqkqqkqqkk.',
          '..k.kk.kk...'
        ],
        [
          '...kkkkkk...',
          '..kwwwwwwk..',
          '.kwwwwwwwwk.',
          '.kwkwwwwkwk.',
          '.kwkwwwwkwk.',
          '.kwwwwwwwwk.',
          '.kwwwkkwwwk.',
          '.kwwwkkwwqk.',
          '.kwwwwwwqqk.',
          '.kqwwwwqqqk.',
          '.kkqqkqqkqk.',
          '...kk.kk.k..'
        ]
      ]
    },
    skeleton: {
      w: 12,
      h: 16,
      frames: [
        [
          '...kkkkk....',
          '..kqqqqqk...',
          '.kqqqqqqqk..',
          '.kqkkqkkqk..',
          '.kqkkqkkqk..',
          '.kqqqkqqqk..',
          '..kqkqkqk...',
          '...kkkkk....',
          '..k.kqk.k...',
          '.kqkqqqkqk..',
          '.kqkkqkkqk..',
          '...kqqqk....',
          '...kqkqk....',
          '..kqk.kqk...',
          '..kqk.kqk...',
          '..kk...kk...'
        ],
        [
          '...kkkkk....',
          '..kqqqqqk...',
          '.kqqqqqqqk..',
          '.kqkkqkkqk..',
          '.kqkkqkkqk..',
          '.kqqqkqqqk..',
          '..kqkqkqk...',
          '...kkkkk....',
          '..k.kqk.k...',
          '.kqkqqqkqk..',
          '.kqkkqkkqk..',
          '...kqqqk....',
          '...kqkqk....',
          '...kqkqk....',
          '..kqk..kqk..',
          '.kk.....kk..'
        ]
      ]
    },
    zombie: {
      w: 12,
      h: 16,
      frames: [
        [
          '...kkkkk....',
          '..klllllk...',
          '.kllllllLk..',
          '.klkklkkLk..',
          '.kllllllLk..',
          '.klkkkklLk..',
          '..kLLLLLk...',
          '.kkTTTTTkk..',
          'kllTTvTTllk.',
          'kLkTTTTTkLk.',
          '.k.kTTvTk.k.',
          '...kTTTTk...',
          '...kUUUUk...',
          '...kUkkUk...',
          '..kUk..kUk..',
          '..kk....kk..'
        ],
        [
          '...kkkkk....',
          '..klllllk...',
          '.kllllllLk..',
          '.klkklkkLk..',
          '.kllllllLk..',
          '.klkkkklLk..',
          '..kLLLLLk...',
          '.kkTTTTTkk..',
          'kllTTvTTllk.',
          'kLkTTTTTkLk.',
          '.k.kTTvTk.k.',
          '...kTTTTk...',
          '...kUUUUk...',
          '..kUk.kUk...',
          '..kLk.kLk...',
          '..kk...kk...'
        ]
      ]
    }
  };
