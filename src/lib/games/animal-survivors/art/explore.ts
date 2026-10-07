import type { Art } from '../pixels';
import type { RelicId } from '../relics';
import type { ShrineKind } from '../shrines';

/** 遺物（12 ドット）。地面でも図鑑でも同じ絵。黒曜石のかけらだけ、色の表に無い黒を pal で足す */
export const RELIC_ART: Record<RelicId, Art> = {
  map: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '.kkkkkkkkkk.',
        'ktcccccccctk',
        'ktcccccccctk',
        'ktcTcTccrctk',
        'ktccTcTrcctk',
        'ktccccrcrctk',
        'ktcccccrcctk',
        'ktcccccccctk',
        'kTttttttttTk',
        '.kkkkkkkkkk.',
        '............'
      ]
    ]
  },
  lamp: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '.....k......',
        '....kyk.....',
        '....kyk...kk',
        '...kyyyk.kyY',
        'kkkkyyykkyYk',
        'yYyywyyyyYk.',
        'ykywyyyyyk..',
        'YYYYyyyYYk..',
        'kkkkYYYkk...',
        '....kkk.....',
        '............'
      ]
    ]
  },
  watch: {
    w: 12,
    h: 12,
    frames: [
      [
        '.....kk.....',
        '....kYYk....',
        '...kkYYkk...',
        '..kYYYYYYk..',
        '.kYYywwwYYk.',
        '.kYwwwkwwYk.',
        'kYYywwkwwYYk',
        'kYYwwwkkkYYk',
        '.kYwwwwwwYk.',
        '.kYYwwwwYYk.',
        '..kYYYYYYk..',
        '...kkYYkk...'
      ]
    ]
  },
  bell: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '....kkkk....',
        '...kssssk...',
        '...kswssk...',
        '..kswsssk...',
        '..kswssssk..',
        '..kswssssk..',
        '.ksssssssk..',
        'ksssssssssk.',
        'kSSSSSSSSSSk',
        '.kkkkYYkkkk.',
        '.....kk.....'
      ]
    ]
  },
  flake: {
    w: 12,
    h: 12,
    frames: [
      [
        '.....kk.....',
        '....kjjk....',
        '.kk.kjwk.kk.',
        'kjjkkjjkkjjk',
        '.kwjjjjjjjw.',
        '..kkjjjjkk..',
        '..kkjjwjkk..',
        '.kjjjjjjjjk.',
        'kjwkkjjkkjwk',
        '.kk.kjjk.kk.',
        '....kjwk....',
        '.....kk.....'
      ]
    ]
  },
  mirror: {
    w: 12,
    h: 12,
    frames: [
      [
        '....kkkk....',
        '...kYYYYk...',
        '..kYjjjjYk..',
        '.kYYjwjjYYk.',
        '.kYjwwjjjYk.',
        '.kYjjjjjjYk.',
        '.kYYjjjJYYk.',
        '..kYjjJJYk..',
        '...kYTTYk...',
        '....kTTk....',
        '....kTTk....',
        '....kTTk....'
      ]
    ]
  },
  orb: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '....kkkk....',
        '...krrrrk...',
        '..krrrrrrk..',
        '.krrwrorrrk.',
        '.krwrororrk.',
        'kRrrooyorrRk',
        '.krrooyorrk.',
        '.kRrooyorRk.',
        '..kRrrrrRk..',
        '...kRRRRk...',
        '....kkkk....'
      ]
    ]
  },
  shard: {
    w: 12,
    h: 12,
    frames: [
      [
        '.....kk.....',
        '....kaAk....',
        '...kaqAAk...',
        '..kaavAAAk..',
        '.kaaaaAAAAk.',
        '.kaavaAAAAk.',
        '.kaavaaAAk..',
        '.kaaaaaAAk..',
        '..kaaaavAk..',
        '..kaaaaak...',
        '..kaaaaak...',
        '...kkkkk....'
      ]
    ],
    pal: { a: '#3b3537', A: '#24201f' }
  }
};

/** 祠。屋根と箱は共通で、中の玉の色が種類 */
export const SHRINE_ART: Record<ShrineKind, Art> = {
  power: {
    w: 22,
    h: 26,
    frames: [
      [
        '......................',
        '......................',
        '..........kY..........',
        '.........kYRY.........',
        '........kRRRRk........',
        '......kkRRRRRRkk......',
        '.....kRRRRRRRRRRk.....',
        '...kkRRRRRRRRRRRRkk...',
        '..kRRRRRRRRRRRRRRRRk..',
        '.kRRRRRRRRRRRRRRRRRRk.',
        'kRRRRRRRRRRRRRRRRRRRRk',
        'kRRRRRRRRRRRRRRRRRRRk.',
        '.kkkkttMMMMMMMMttkkk..',
        '....kttMMrrrMMMttk....',
        '....kttMrwrrrMMttk....',
        '....kttMrrrrrMMttk....',
        '....kttMrrrrRMMttk....',
        '....kttMMrrRMMMttk....',
        '....kttMMMMMMMMttk....',
        '....kttMMMMMMMMttk....',
        '..kkkttttttttttttkkk..',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kSSSSSSSSSSSSSSSSSSk.',
        '..kkkkkkkkkkkkkkkkkk..'
      ]
    ]
  },
  wind: {
    w: 22,
    h: 26,
    frames: [
      [
        '......................',
        '......................',
        '..........kY..........',
        '.........kYRY.........',
        '........kRRRRk........',
        '......kkRRRRRRkk......',
        '.....kRRRRRRRRRRk.....',
        '...kkRRRRRRRRRRRRkk...',
        '..kRRRRRRRRRRRRRRRRk..',
        '.kRRRRRRRRRRRRRRRRRRk.',
        'kRRRRRRRRRRRRRRRRRRRRk',
        'kRRRRRRRRRRRRRRRRRRRk.',
        '.kkkkttMMMMMMMMttkkk..',
        '....kttMMlllMMMttk....',
        '....kttMlwlllMMttk....',
        '....kttMlllllMMttk....',
        '....kttMllllLMMttk....',
        '....kttMMllLMMMttk....',
        '....kttMMMMMMMMttk....',
        '....kttMMMMMMMMttk....',
        '..kkkttttttttttttkkk..',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kSSSSSSSSSSSSSSSSSSk.',
        '..kkkkkkkkkkkkkkkkkk..'
      ]
    ]
  },
  wisdom: {
    w: 22,
    h: 26,
    frames: [
      [
        '......................',
        '......................',
        '..........kY..........',
        '.........kYRY.........',
        '........kRRRRk........',
        '......kkRRRRRRkk......',
        '.....kRRRRRRRRRRk.....',
        '...kkRRRRRRRRRRRRkk...',
        '..kRRRRRRRRRRRRRRRRk..',
        '.kRRRRRRRRRRRRRRRRRRk.',
        'kRRRRRRRRRRRRRRRRRRRRk',
        'kRRRRRRRRRRRRRRRRRRRk.',
        '.kkkkttMMMMMMMMttkkk..',
        '....kttMMuuuMMMttk....',
        '....kttMuwuuuMMttk....',
        '....kttMuuuuuMMttk....',
        '....kttMuuuuUMMttk....',
        '....kttMMuuUMMMttk....',
        '....kttMMMMMMMMttk....',
        '....kttMMMMMMMMttk....',
        '..kkkttttttttttttkkk..',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kSSSSSSSSSSSSSSSSSSk.',
        '..kkkkkkkkkkkkkkkkkk..'
      ]
    ]
  },
  treasure: {
    w: 22,
    h: 26,
    frames: [
      [
        '......................',
        '......................',
        '..........kY..........',
        '.........kYRY.........',
        '........kRRRRk........',
        '......kkRRRRRRkk......',
        '.....kRRRRRRRRRRk.....',
        '...kkRRRRRRRRRRRRkk...',
        '..kRRRRRRRRRRRRRRRRk..',
        '.kRRRRRRRRRRRRRRRRRRk.',
        'kRRRRRRRRRRRRRRRRRRRRk',
        'kRRRRRRRRRRRRRRRRRRRk.',
        '.kkkkttMMMMMMMMttkkk..',
        '....kttMMyyyMMMttk....',
        '....kttMywyyyMMttk....',
        '....kttMyyyyyMMttk....',
        '....kttMyyyyYMMttk....',
        '....kttMMyyYMMMttk....',
        '....kttMMMMMMMMttk....',
        '....kttMMMMMMMMttk....',
        '..kkkttttttttttttkkk..',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kSSSSSSSSSSSSSSSSSSk.',
        '..kkkkkkkkkkkkkkkkkk..'
      ]
    ]
  },
  heal: {
    w: 22,
    h: 26,
    frames: [
      [
        '......................',
        '......................',
        '..........kY..........',
        '.........kYRY.........',
        '........kRRRRk........',
        '......kkRRRRRRkk......',
        '.....kRRRRRRRRRRk.....',
        '...kkRRRRRRRRRRRRkk...',
        '..kRRRRRRRRRRRRRRRRk..',
        '.kRRRRRRRRRRRRRRRRRRk.',
        'kRRRRRRRRRRRRRRRRRRRRk',
        'kRRRRRRRRRRRRRRRRRRRk.',
        '.kkkkttMMMMMMMMttkkk..',
        '....kttMMpppMMMttk....',
        '....kttMpwpppMMttk....',
        '....kttMpppppMMttk....',
        '....kttMpppprMMttk....',
        '....kttMMpprMMMttk....',
        '....kttMMMMMMMMttk....',
        '....kttMMMMMMMMttk....',
        '..kkkttttttttttttkkk..',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kssssssssssssssssssk.',
        '.kSSSSSSSSSSSSSSSSSSk.',
        '..kkkkkkkkkkkkkkkkkk..'
      ]
    ]
  }
};
