import type { Art } from '../pixels';

/** 弾・玉・拾うもの・武器とパッシブのアイコン。アイコンの名前は weapon-<id> と passive-<id> */
export const ITEM_ART: Record<string, Art> = {
  bone: {
    w: 8,
    h: 8,
    frames: [['....kk..', '...kwwk.', '...kwwwk', '.kkkccck', 'kwwwkkk.', 'kcwwk...', '.kcck...', '..kk....']]
  },
  fish: {
    w: 10,
    h: 7,
    frames: [['..........', '.kkkkkkk..', 'kuuuuwuuk.', 'kuuuuukuk.', 'kUUUUUUUk.', '.kkkkkkk..', '..........']]
  },
  feather: {
    w: 8,
    h: 8,
    frames: [['...kk...', '..kwwk..', '..kwsk..', '.kwwwwk.', '.kswssk.', '..kswk..', '...ksk..', '...ksk..']]
  },
  meat: {
    w: 10,
    h: 10,
    frames: [
      [
        '...kk.....',
        '..krrk....',
        '.krrprk...',
        'krrprrrk..',
        'krrrrrrk..',
        'kRrrrrrk..',
        '.kRRRRwkk.',
        '..kkkkkwwk',
        '......kwwk',
        '.......kk.'
      ]
    ]
  },
  magnet: {
    w: 10,
    h: 10,
    frames: [
      [
        '...kkkk...',
        '..krrrrk..',
        '.krrRRrrk.',
        'krrRkkRrrk',
        'krrk..krrk',
        'krrk..krrk',
        'krrk..krrk',
        'kSSk..kSSk',
        '.kk....kk.',
        '..........'
      ]
    ]
  },
  skull: {
    w: 8,
    h: 8,
    frames: [['..kkkk..', '.kwwwwk.', 'kwwwwwwk', 'kwkwwkwk', '.kwwwwk.', '.kwwwwk.', '.kwkkwk.', '..kkkk..']]
  },
  chest: {
    w: 12,
    h: 10,
    frames: [
      [
        '............',
        '.kkkkkkkkkk.',
        'kbbbbbbbbbbk',
        'kbbbbbbbbbbk',
        'kkkkkyykkkkk',
        'kbbbbyybbbbk',
        'kbbbbbbbbbbk',
        'kbbbbbbbbbbk',
        'kBBBBBBBBBBk',
        '.kkkkkkkkkk.'
      ]
    ]
  },
  'weapon-woof': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '......kk....',
        '.....kwwk...',
        '.....kwwwk..',
        '...kkkccck..',
        '..kwwwkkk...',
        '..kcwwk.....',
        '...kcck.....',
        '....kk......',
        '............',
        '............'
      ]
    ]
  },
  'weapon-paw': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '....kk.kk...',
        '..kkppkppk..',
        '.kpkrrkrrkk.',
        '.kprkkkkkppk',
        '.krkkppkkrrk',
        '..kkppppkkk.',
        '..kppppppk..',
        '..krrpprrk..',
        '...kkrrkk...',
        '.....kk.....',
        '............'
      ]
    ]
  },
  'weapon-howl': {
    w: 12,
    h: 12,
    frames: [
      [
        '..kuuk......',
        '...kkuk.....',
        '..kuukuk....',
        '...kuukuk...',
        '.kkukukuk...',
        'kwwuuuuuk...',
        'kwwuuuuuk...',
        '.kkukukuk...',
        '...kuukuk...',
        '..kuukuk....',
        '...kkuk.....',
        '..kuuk......'
      ]
    ]
  },
  'weapon-boomerang': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '........kk..',
        '......kkwwk.',
        '.....kwwwwk.',
        '....kwwccck.',
        '...kwwckkk..',
        '..kwwck.....',
        '..kwwk......',
        '.kwwwk......',
        '.kccck......',
        '..kkk.......',
        '............'
      ]
    ]
  },
  'weapon-feather': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '.....kk.....',
        '....kwwk....',
        '....kwsk....',
        '...kwwwwk...',
        '...kswssk...',
        '....kswk....',
        '.....ksk....',
        '.....ksk....',
        '......k.....',
        '............'
      ]
    ]
  },
  'weapon-thunder': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '......k.....',
        '.....kyk....',
        '....kyyk....',
        '...kyyykk...',
        '...kyyyyYk..',
        '..kYYyyYk...',
        '...kkyYk....',
        '....kyk.....',
        '...kyYk.....',
        '...kYk......',
        '....k.......'
      ]
    ]
  },
  'weapon-fish': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '............',
        '....kkkk....',
        '..kkuuuuk...',
        '.kuuuuwuuk..',
        '.kUUuuukUk..',
        '..kkUUUUk...',
        '....kkkk....',
        '............',
        '............',
        '............'
      ]
    ]
  },
  'passive-heart': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '..kkkkkkkk..',
        '.krrrrrrrrk.',
        '.krwwrrrrrk.',
        'kRrrrrrrrrRk',
        '.kRrrrrrrRk.',
        '..krrrrrrk..',
        '..kRrrrrRk..',
        '...kRrrRk...',
        '....kRRk....',
        '.....kk.....',
        '............'
      ]
    ]
  },
  'passive-fang': {
    w: 12,
    h: 12,
    frames: [
      [
        '..kkkkkkkk..',
        '.kwwwwwwwwk.',
        '.kswwwwwwsk.',
        '..kwwwwwwk..',
        '..kswwwwsk..',
        '...kwwwwk...',
        '...kswwsk...',
        '....kwwk....',
        '....kwwk....',
        '....kssk....',
        '.....kk.....',
        '............'
      ]
    ]
  },
  'passive-drum': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '.....kk.....',
        '..kkkcckkk..',
        '.krccccccrk.',
        '.krrccccrrk.',
        '.krrrrrrrrk.',
        '.kryrrryrrk.',
        '.krrryrrryk.',
        '.krrrrrrrrk.',
        '.kRRRrrRRRk.',
        '..kkkRRkkk..',
        '.....kk.....'
      ]
    ]
  },
  'passive-paws': {
    w: 12,
    h: 12,
    frames: [
      [
        '........k...',
        '......kkbkk.',
        '.....kBkbBBk',
        '......kkbkk.',
        '...k..kbbbk.',
        '.kkbkkkBBBk.',
        'kBBbkBkkkk..',
        '.kkbkk......',
        '.kbbbk......',
        '.kBBBk......',
        '..kkk.......',
        '............'
      ]
    ]
  },
  'passive-fur': {
    w: 12,
    h: 12,
    frames: [
      [
        '...k..k..k..',
        '..kbkkbkkb..',
        '.kcbcbcbcbc.',
        'kbbbbbbbbbbk',
        'kssbbbbbbssk',
        'kssssssssssk',
        'kSssspspssSk',
        '.kSssspssSk.',
        '..ksspppsk..',
        '..kSssssSk..',
        '...kSssSk...',
        '....kssk....'
      ]
    ]
  },
  'passive-nose': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '..........s.',
        '...kk....s.s',
        '..kbbkk...s.',
        '.kBbbbbk...s',
        'kBBBbkbkkw..',
        'kBBBbbccckk.',
        'kBBBbccccck.',
        '.kBBBBccck..',
        '..kkkkkkk...',
        '............'
      ]
    ]
  },
  'passive-roar': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '......k.....',
        '....kkyk....',
        '...kyyykk.w.',
        '..kyyyyyyk..',
        '.kyyyyyyyk.w',
        '.kYyyyyyyk.w',
        '..kYyyyYYk..',
        '...kYYykk.w.',
        '....kkYk....',
        '......k.....',
        '............'
      ]
    ]
  },
  'passive-claw': {
    w: 12,
    h: 12,
    frames: [
      [
        '.kk.kk.kk...',
        'kswkswkswk..',
        '.kwkkwkkwk..',
        '.kwwkwwkwwk.',
        '.kwwkwwkwwk.',
        '.kswkswkswk.',
        '..kwkkwkkwk.',
        '..kwwkwwkwwk',
        '..kswkswkswk',
        '...kwkkwkkwk',
        '...kskkskksk',
        '....k..k..k.'
      ]
    ]
  },
  'passive-leaf': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '..kkkk......',
        '.kllllk.....',
        '.klllllk....',
        '.kllllllk...',
        '.kLllllLlk..',
        '..kLllLlllk.',
        '...kLLllllk.',
        '....LLllllk.',
        '...T.kLLLLk.',
        '..T...kkkk..',
        '............'
      ]
    ]
  },
  'passive-whisker': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '...k....k...',
        '..kok..kok..',
        '..kookkook..',
        '..kooooook..',
        '..kooooook..',
        'kkookoookokk',
        '.koooopoook.',
        '..kowwowwk..',
        'kk.kooook.kk',
        '....kkkk....',
        '............'
      ]
    ]
  },
  gem0: {
    w: 5,
    h: 5,
    frames: [
      ['..k..', '.wuk.', 'kUuUk', '.kUk.', '..k..'],
      ['..k..', '.kwk.', 'kUuUk', '.kUk.', '..k..']
    ]
  },
  gem1: {
    w: 6,
    h: 6,
    frames: [
      ['..kk..', '.kllk.', 'klwllk', 'kLllLk', '.kLLk.', '..kk..'],
      ['..kk..', '.kllk.', 'kllwlk', 'kLllLk', '.kLLk.', '..kk..']
    ]
  },
  gem2: {
    w: 7,
    h: 7,
    frames: [
      ['...k...', '..krk..', '.kwrrk.', 'kRrrrRk', '.kRrRk.', '..kRk..', '...k...'],
      ['...k...', '..krk..', '.krwrk.', 'kRrrrRk', '.kRrRk.', '..kRk..', '...k...']
    ]
  },
  web: {
    w: 8,
    h: 8,
    frames: [['..kkkk..', '.kwwswk.', 'kwswwswk', 'kwwsswwk', 'kswsswsk', 'kwswwswk', '.kwwswk.', '..kkkk..']]
  },
  'weapon-claw': {
    w: 12,
    h: 12,
    frames: [
      [
        '....k..k..k.',
        '...krkkrkkrk',
        '..krrkrrkrrk',
        '..krrkrrkrrk',
        '..krwkrwkrw.',
        '.krrkrrkrrk.',
        '.krrkrrkrrk.',
        '.krwkrwkrw..',
        'krrkrrkrrk..',
        'krrkrrkrrk..',
        'krkkrkkrk...',
        '.k..k..k....'
      ]
    ]
  },
  'weapon-dash': {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '.......k....',
        '......kyk...',
        'www...kyyk..',
        '....kkkyyyk.',
        '.wwkyyyyyyyk',
        '.wwkYYYyyyYk',
        '....kkkyyYk.',
        'www...kyYk..',
        '......kYk...',
        '.......k....',
        '............'
      ]
    ]
  },
  'weapon-acorn': {
    w: 12,
    h: 12,
    frames: [
      [
        '.....kk.....',
        '..kkkBTkkk..',
        '.kBBBBBBBBk.',
        'kBBBBtBtBBBk',
        'kBBBBBBBBBBk',
        '.kBBBBBBBBk.',
        '.kttcBBtttk.',
        '.kttctttttk.',
        '.kTttttttTk.',
        '..kTttttTk..',
        '...kTTTTk...',
        '....kkkk....'
      ]
    ]
  },
  'weapon-flame': {
    w: 12,
    h: 12,
    frames: [
      [
        '.....k......',
        '....kok.....',
        '...kook.....',
        '..koyyyk....',
        '..koyyyok...',
        '.kooyyyyok..',
        '.kooyyyyok..',
        '..koyyyyk...',
        '...koywok...',
        '....kkwk....',
        '............',
        '............'
      ]
    ]
  },
  'weapon-vine': {
    w: 12,
    h: 12,
    frames: [
      [
        '......kk....',
        '.....kLLk...',
        '...kkkLLk...',
        '..kllkkLLk..',
        '.kLlllkLLk..',
        '..kLdlLLk...',
        '..kkkLLkkkk.',
        '.kLLLLLllllk',
        '.kLLkkkLLdLk',
        '.kLk...kkkk.',
        'kLLk........',
        'kLLk........'
      ]
    ]
  },
  acorn: {
    w: 6,
    h: 6,
    frames: [['.kkTk.', 'kBBBBk', 'kBBBBk', 'kttttk', 'kTttTk', '.kttk.']]
  },
  flame: {
    w: 10,
    h: 12,
    frames: [
      [
        '....k.....',
        '...kok....',
        '..kook....',
        '..koyyk...',
        '.koyyyok..',
        '.koyyyok..',
        '.koyyyok..',
        '..koyyok..',
        '..koyyk...',
        '...kkk....',
        '..........',
        '..........'
      ],
      [
        '.....k....',
        '....kok...',
        '....kook..',
        '...kyyok..',
        '..koyyyok.',
        '..koyyyok.',
        '..koyyyok.',
        '..koyyok..',
        '...kyyok..',
        '....kkk...',
        '..........',
        '..........'
      ]
    ]
  },
  vine: {
    w: 12,
    h: 14,
    frames: [
      [
        '............',
        '............',
        '............',
        '............',
        '............',
        '....kkk.....',
        '...kLLLk....',
        '...kLLLk....',
        '....kLLLkk..',
        '....kLLLlLk.',
        '...kLLLkLk..',
        '...kLLk.k...',
        '...kkddkk...',
        '..kddddddk..'
      ],
      [
        '............',
        '.....kk.....',
        '....kLLkkk..',
        '....kLLlllk.',
        '..kkkkLLLLk.',
        '.klllLLLkk..',
        'kLlllLLk....',
        '.kLLLLLkkk..',
        '..kkkLLlllk.',
        '....kLLLllLk',
        '...kLLLkLLk.',
        '...kLLk.kk..',
        '...kkddkk...',
        '..kddddddk..'
      ]
    ]
  }
};
