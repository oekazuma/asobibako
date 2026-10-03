import type { Art } from '../pixels';

/** 右向き（自分のほうを向くよう、描くときに反転する）。2 コマで歩くか羽ばたく */
export const ENEMY_ART: Record<
  | 'rat'
  | 'bat'
  | 'snake'
  | 'caterpillar'
  | 'boar'
  | 'spider'
  | 'croc'
  | 'lantern'
  | 'ghost'
  | 'skeleton'
  | 'zombie'
  | 'metal'
  | 'penguin'
  | 'snowsprite'
  | 'seal'
  | 'snowman'
  | 'reindeer'
  | 'hare'
  | 'polar'
  | 'snowling'
  | 'lizard'
  | 'fireball'
  | 'lavasnake'
  | 'rockworm'
  | 'fireboar'
  | 'flamespider'
  | 'rockcroc',
  Art
> = {
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
  },
  /** きらきらハリネズミ。逃げるので、描くときは自分と反対を向かせる */
  metal: {
    w: 16,
    h: 12,
    frames: [
      [
        '.y....k.........',
        'ywyk.ksk.k......',
        '.ykskswsksk..y..',
        '.kswskqsswskywy.',
        '.ksqsssqsqsk.y..',
        'ksssqsssssqskk..',
        'kssssqsssscccck.',
        'ksqsssqsqcccwkck',
        'kssqsssssccckkck',
        '.kssssssscccccpk',
        '..kSSSSSSSkcckk.',
        '...kkTTkkTTkk...'
      ],
      [
        '......k....y....',
        '...k.ksk.kywy...',
        '..kskswsksky....',
        '.kswskqsswsk..y.',
        '.ksqsssqsqsk.ywy',
        'ksssqsssssqskky.',
        'kssssqsssscccck.',
        'ksqsssqsqcccwkck',
        'kssqsssssccckkck',
        '.kssssssscccccpk',
        '..kSSSSSSSkcckk.',
        '...kTTkkkkTTk...'
      ]
    ]
  },
  penguin: {
    w: 12,
    h: 12,
    frames: [
      [
        '.....kkk....',
        '....knnnk...',
        '...knnnnnk..',
        '..knnnwwwnk.',
        '.knnnnwkknk.',
        '.knnnnwkkYYk',
        '.knnnnnnwnk.',
        '.knnnwwwwk..',
        '.knnnwwwwk..',
        '..knnwwwwk..',
        '...kYYwwYYk.',
        '....kkkkkk..'
      ],
      [
        '......kk....',
        '....kknnkk..',
        '...knnnnnnk.',
        '..knnnwwwnk.',
        '..knnnwkwkk.',
        '..knnnnkwkYk',
        '.knnnnnnwnk.',
        '..knnnwwwnk.',
        '..knnnwwwnk.',
        '..knnnwwwk..',
        '...knYYwYYk.',
        '....kkkkkk..'
      ]
    ]
  },
  snowsprite: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '......k.....',
        '....kkwk....',
        '...kwjwjk..k',
        'k.kwwwwwwkkj',
        'jkwwwwwwwwjk',
        'kjwwwkwkwwjk',
        '.kwwpwwwpwk.',
        '..kjjjjjjk..',
        '...kjjjjk...',
        '....kkkk....',
        '............'
      ],
      [
        '......k.....',
        '.....kwk....',
        '...kkjwjk...',
        '.kkwwwwwwkk.',
        'kjwwwwwwwwjk',
        'jkwwwkwkwwjk',
        'kkwwpwwwpwkj',
        '..kwwwwwwk.k',
        '..kjjjjjjk..',
        '...kkkkkk...',
        '............',
        '............'
      ]
    ]
  },
  seal: {
    w: 14,
    h: 12,
    frames: [
      [
        '..............',
        '..............',
        '........kkkk..',
        '.......kssssk.',
        '...kkkkssssssk',
        '.kksssssswkssk',
        'ksssssssskkwwk',
        'ssssssssssswwk',
        'SSSsssssssssk.',
        'SSSSSSSSSSSk..',
        'kkkSSSSSSkk...',
        '...kkkkkSk....'
      ],
      [
        '..............',
        '.........kk...',
        '........ksskk.',
        '.......ksssssk',
        '..kkkkksswkssk',
        '.kssssssskkssk',
        'ksssssssssswwk',
        'ssssssssssssk.',
        'SSSSSSSSSSSk..',
        'kkSSSSSSSSk...',
        '..kkkkkkSk....',
        '........k.....'
      ]
    ]
  },
  snowman: {
    w: 14,
    h: 16,
    frames: [
      [
        '.....kkkkk....',
        '....knnnnnk...',
        '....knnnnnk...',
        '...knnnnnnnk..',
        '...kwwkwkIk...',
        '..kwwwkwkIIk..',
        'k..kwwwwwook..',
        'Tk.krrrrrrrk.k',
        'kTkwwwwwwrIkkT',
        '.kTwwwwwwRIkTk',
        '.kwwwwwkwwIIk.',
        '.kwwwwwwwwIIk.',
        '.kwwwwwkwwIIk.',
        '..kIIIIIIIIk..',
        '...kIIIIIIk...',
        '....kkkkkk....'
      ],
      [
        '.....kkkkk....',
        '....knnnnnk...',
        '....knnnnnk...',
        '...knnnnnnnk..',
        '...kwwkwkIk...',
        '..kwwwkwkIIk..',
        '...kwwwwwook..',
        '...krrrrrrrk..',
        '..kwwwwwwrIk..',
        '.kkwwwwwwRIkk.',
        'kTTwwwwkwwIITk',
        'TkwwwwwwwwIIkT',
        'kkwwwwwkwwIIkk',
        '..kIIIIIIIIk..',
        '...kIIIIIIk...',
        '....kkkkkk....'
      ]
    ]
  },
  reindeer: {
    w: 20,
    h: 16,
    frames: [
      [
        '.............k.k....',
        '............kTkTkk..',
        '...........kTkTkTTk.',
        '............kkTbTk..',
        '............kbbbbbk.',
        '.....kkkkkkkkbbkcckk',
        '..kkkbbbbbbbbbbkccrr',
        '.kwwbbbbbbbbbbbbbckk',
        '.kwwbbbbbbbbbbbkkk..',
        '..kbbbbbbbbbbbbk....',
        '...kcccccccccck.....',
        '....kcccccccck......',
        '...kBkBkkkkBkBk.....',
        '...kBkBk..kBkBk.....',
        '...kBkBk..kBkBk.....',
        '....k.k....k.k......'
      ],
      [
        '.............k.k....',
        '............kTkTkk..',
        '...........kTkTkTTk.',
        '............kkTbTk..',
        '............kbbbbbk.',
        '.....kkkkkkkkbbkcckk',
        '..kkkbbbbbbbbbbkccrr',
        '.kwwbbbbbbbbbbbbbckk',
        '.kwwbbbbbbbbbbbkkk..',
        '..kbbbbbbbbbbbbk....',
        '...kcccccccccck.....',
        '....kcccccccck......',
        '....kBkBkkBkBk......',
        '....kBkBkkBkBk......',
        '....kBkBkkBkBk......',
        '.....k.k..k.k.......'
      ]
    ]
  },
  hare: {
    w: 14,
    h: 12,
    frames: [
      [
        '.........k....',
        '........kwk...',
        '........kpwk..',
        '........kwwk..',
        '...kkkkkwwwwk.',
        '.kkwwwwwwwkwwk',
        'kwwwwwwwwwkwwk',
        'kwwwwwwwwwwwpk',
        'kwwwwwwwwwwkk.',
        '.kwwwwwwwwk...',
        '..kIIIIIIk....',
        '...kIkkkIk....'
      ],
      [
        '........kwk...',
        '........kpwk..',
        '........kwwk..',
        '....kkkkkwwwk.',
        '..kkwwwwwwkwwk',
        '.kwwwwwwwwkwwk',
        'kwwwwwwwwwwwpk',
        'kwwwwwwwwwwkk.',
        '.kwwwwwwwwk...',
        '.kIIIIIIIIk...',
        '..kIIIIIkIk...',
        '...kkkkk.k....'
      ]
    ]
  },
  polar: {
    w: 24,
    h: 14,
    frames: [
      [
        '........................',
        '.................k......',
        '.......kkkkkkk..kwkkk...',
        '....kkkwwwwwwwkkwIwwwk..',
        '...kwwwwwwwwwwwwwwwwwwk.',
        '..kwwwwwwwwwwwwwwwwkwwwk',
        '.kwwwwwwwwwwwwwwwwkkwwwk',
        '.kwwwwwwwwwwwwwwwwwwwwkk',
        '.kwwwwwwwwwwwwwwwwwwwwk.',
        '..kwwwwwwwwwwwwwwwkkkk..',
        '...kIIIIIIIIIIIIIk......',
        '...kIIkIIIIIIIIkIIk.....',
        '...kIIkIIkkkkIIkIIk.....',
        '....kk.kk....kk.kk......'
      ],
      [
        '........................',
        '.................k......',
        '.......kkkkkkk..kwkkk...',
        '....kkkwwwwwwwkkwIwwwk..',
        '...kwwwwwwwwwwwwwwwwwwk.',
        '..kwwwwwwwwwwwwwwwwkwwwk',
        '.kwwwwwwwwwwwwwwwwkkwwwk',
        '.kwwwwwwwwwwwwwwwwwwwwkk',
        '.kwwwwwwwwwwwwwwwwwwwwk.',
        '..kwwwwwwwwwwwwwwwkkkk..',
        '...kIIIIIIIIIIIIIk......',
        '....kIIIIIIIIIkIIk......',
        '....kIIkIIkkIIkIIk......',
        '.....kk.kk..kk.kk.......'
      ]
    ]
  },
  snowling: {
    w: 10,
    h: 10,
    frames: [
      [
        '....kwk...',
        '...kuuk...',
        '..kuuuuk..',
        '..kuuuuk..',
        'kkwwwwwIkk',
        'TwwwkwkIIT',
        'kTwwwwwoTk',
        'kwwwwwwIIk',
        '.kIIIIIIk.',
        '..kkIIkk..'
      ],
      [
        '...kuwk...',
        '..kuuuuk..',
        '..kuuuuk..',
        'kkwwwwwIkk',
        'TwwwkwkIIT',
        'kTwwwwwoTk',
        'kwwwwwwIIk',
        '.kIIIIIIk.',
        '..kIIIIk..',
        '...kkkk...'
      ]
    ]
  },
  lizard: {
    w: 14,
    h: 12,
    frames: [
      [
        '..............',
        '..............',
        '..............',
        '..............',
        '....kkkkkkkkk.',
        '...koyoyoyoook',
        '...koooooookwk',
        'kkkooyyyyyrrkk',
        'rrrrorooorkk..',
        'kkkkokkkkkok..',
        '...kRk...kRk..',
        '....k.....k...'
      ],
      [
        '..............',
        '..............',
        '..............',
        '..............',
        '....kkkkkkkkk.',
        '...koyoyoyoook',
        '...koooooookwk',
        'kkkooyyyyyrrkk',
        'rrrrrryoyrkk..',
        'kkkkkkokok....',
        '.....kRkRk....',
        '......k.k.....'
      ]
    ]
  },
  fireball: {
    w: 12,
    h: 13,
    frames: [
      [
        '............',
        '......k.....',
        '.....krk....',
        '....kkrkk...',
        '...krrrrrk..',
        '..krroorrok.',
        '.krroooorrk.',
        '.krokyyokrk.',
        '.kroyyyyork.',
        '.kroyykyork.',
        '..kroyyork..',
        '...krrrrk...',
        '....kkkk....'
      ],
      [
        '............',
        '............',
        '......k..k..',
        '...kkkrkkrk.',
        '..krrrrrkok.',
        '..krroorrrk.',
        '.krroooorrrk',
        '.krokyyokrk.',
        '.kroyyyyork.',
        '.kroyykyork.',
        '..kroyyork..',
        '...krrrrk...',
        '....kkkk....'
      ]
    ]
  },
  lavasnake: {
    w: 14,
    h: 12,
    frames: [
      [
        '..............',
        '..............',
        '..........kkk.',
        '.........krrrk',
        '.........krryR',
        '....kkk..krrRk',
        'kk.krrrk.krRk.',
        'rrkrrrrrkkrk..',
        'rrrryRryrrRk..',
        'RryrRkRrryk...',
        'kRRRk.kRRk....',
        '.kkk...kk.....'
      ],
      [
        '..............',
        '..............',
        '..........kkk.',
        '.........krrrk',
        '.........krryR',
        '.kkk..kkkkrrRk',
        'krrrkkrrrkrRk.',
        'rryrrkrrrrrk..',
        'rrRrrrryRyRk..',
        'RRkRyrrkkkk...',
        'kk.kRRRk......',
        '....kkk.......'
      ]
    ]
  },
  rockworm: {
    w: 16,
    h: 12,
    frames: [
      [
        '................',
        '................',
        '................',
        '............kk..',
        '.kk....kk..kssk.',
        'ksskkkksskkssssk',
        'kswsGsGswGssGyyk',
        'ksssGwGssGwsGssk',
        'kSSSosoSSossoSSr',
        '.kkkGSGkkGSSGkkk',
        '....kkk..kkkk...',
        '................'
      ],
      [
        '................',
        '................',
        '................',
        '............kk..',
        '....kk....kkssk.',
        '.kkksskkkksssssk',
        'ksskGwGssGwsGyyk',
        'kswsGsGswGssGssk',
        'ksssoSossoSSoSSr',
        'kSSSGkGSSGkkGkkk',
        '.kkkk.kkkk..k...',
        '................'
      ]
    ]
  },
  fireboar: {
    w: 20,
    h: 14,
    frames: [
      [
        '....................',
        '....................',
        '......k...k.........',
        '....kkrkkkykk.......',
        '...krkykrkrkykk.....',
        '...krkrBrBrkrkrk....',
        '...koBoBoBoBokokk...',
        '..kBBBBBBBBBBBBBBk..',
        '.kBBBBBBBBBBBBBByBk.',
        '.kBBBBBBBBBBBBBBpppk',
        '..kBBBBBBBBBBBBBBpk.',
        '...kBBBBBBBBkkBkkkwk',
        '..kBkkkBkkBk.kBk..k.',
        '..kBk.kBkkBk.kBk....'
      ],
      [
        '....................',
        '....................',
        '....k...k...........',
        '...krkkkykk...k.....',
        '...kykrkrkykkkrk....',
        '...krkrBrBrkrkrk....',
        '...koBoBoBoBokokk...',
        '..kBBBBBBBBBBBBBBk..',
        '.kBBBBBBBBBBBBBByBk.',
        '.kBBBBBBBBBBBBBBpppk',
        '..kBBBBBBBBBBBBBBpk.',
        '...kBBBBBBBBkkBkkkwk',
        '...kBkBkkkkBkBk...k.',
        '...kBkBk..kBkBk.....'
      ]
    ]
  },
  flamespider: {
    w: 16,
    h: 14,
    frames: [
      [
        '................',
        '................',
        '.......kk.......',
        '...k..kRRk...k..',
        '..kRkkRRRRk.kRk.',
        '.krkrkRyRykkrkrk',
        '.krkRRRRRRRkRkrk',
        'kRrRkRRooRRrkRrR',
        '.krkRRooyoRrRkrk',
        '.krrkMRooRMRkrrk',
        'krrRRkMMMMkkRRrr',
        'krrkk.kkkk..kkrr',
        'krRk.........kRr',
        'kRk...........kR'
      ],
      [
        '................',
        '................',
        '.......kk.......',
        '......kRRk......',
        '...k.kRRRRk..k..',
        '..kRkkRyRyk.kRk.',
        '.krkrRRRRRRkrkrk',
        'kRrRRRRooRRrRRrR',
        '.kRkkRooyoRrkkRk',
        'kRkrRMRooRMRRrkR',
        '.krRkkMMMMkkkRrk',
        '.kRk..kkkk...kRk',
        'krk...........kr',
        'kRk...........kR'
      ]
    ]
  },
  rockcroc: {
    w: 26,
    h: 12,
    frames: [
      [
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '...kkkkkkkkkkk.kkkkk......',
        '..kssSssSssSsskssSySkkkkk.',
        '.kSSSSSSSSSSSSSSSSSSSSSSSk',
        'kSSSoSSoSSoSSoSSoSSSSSSSSk',
        'GGGGSSSSSSSSSSSSSGGkwkwkwk',
        'kkkkroorrrrrroorrkk.k.k.k.',
        '....kSSkkkkkkSSkk.........',
        '....kGGk....kGGk..........'
      ],
      [
        '..........................',
        '..........................',
        '..........................',
        '..........................',
        '...kkkkkkkkkkk.kkkkk......',
        '..kssSssSssSsskssSySkkkkk.',
        '.kSSSSSSSSSSSSSSSSSSSSSSSk',
        'kSSSoSSoSSoSSoSSoSSSSSSSSk',
        'GGGGSSSSSSSSSSSSSGGkwkwkwk',
        'kkkkrroorrrroorrrkk.k.k.k.',
        '....kkSSkkkkSSkkk.........',
        '.....kGGk..kGGk...........'
      ]
    ]
  }
};
