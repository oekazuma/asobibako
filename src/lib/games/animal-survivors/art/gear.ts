import type { Art } from '../pixels';

/** 装備のアイコン（12 ドット、名前は品の id）とガチャ券（ticket0〜2 が銅・銀・金） */
export const GEAR_ART: Record<string, Art> = {
  hachimaki: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '............',
        '.kkkkkkkkk..',
        'kwwwwrwwwwk.',
        'kwwwrrrwwwk.',
        'kwwwrrrwwwk.',
        'kssssRsssswk',
        '.kkkkkkkkkwk',
        '.........kws',
        '.........ksk',
        '..........k.'
      ]
    ]
  },
  goggles: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '...k....k...',
        '.kkSk..kSkk.',
        'kSuuSkkSuSSk',
        'BSwuuSSuwuSB',
        'BSuuuGGuuuSB',
        'kGuuGkkGuGGk',
        '.kkGk..kGkk.',
        '...k....k...',
        '............',
        '............'
      ]
    ]
  },
  straw: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '....kkkk....',
        '...kcccck...',
        '..kcwcccck..',
        '..kcccccck..',
        '.kkcccccckk.',
        'kccrrrrrrrck',
        'bccccccccccb',
        'kbbbbbbbbbbk',
        '.kkkkkkkkkk.',
        '............'
      ]
    ]
  },
  wizard: {
    w: 12,
    h: 12,
    frames: [
      [
        '........k...',
        '.......kvk..',
        '......kvvk..',
        '.....kyvvk..',
        '....kyyyvk..',
        '....kvyvvk..',
        '...kvvvvvvk.',
        '.kkyyyyyyyk.',
        'kvvvvvvvvvvk',
        'kvvvvvvvvvvk',
        '.kkvvvvvvkk.',
        '...kkkkkk...'
      ]
    ]
  },
  oni: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '..k......k..',
        '.kyk....kyk.',
        '.kYYk..kYYk.',
        '.kyk....kyk.',
        '.kyyk..kyyk.',
        '.kYYk..kYYk.',
        '.kyyykkyyyk.',
        'krrrrrrrrrrk',
        'kRRRRRRRRRRk',
        '.kkkkkkkkkk.'
      ]
    ]
  },
  flower: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '.....kk.....',
        '....kyyk....',
        '.kkklyolkkk.',
        'kppLLLLLLppk',
        'kpykkkkkkpyk',
        'kllkkkkkkllk',
        'kLLwwllwwLLk',
        '.kksyLLsykk.',
        '...kkkkkk...',
        '............'
      ]
    ]
  },
  knight: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '.kkk....kkk.',
        'ksssk..ksssk',
        'SsssskkssssS',
        'kSswssssssSk',
        '.ksssyysssk.',
        '.kssyyyyssk.',
        '.ksssyysssk.',
        '.ksssyysssk.',
        '.kssssssssk.',
        '.kSSSSSSSSk.',
        '..kkkkkkkk..'
      ]
    ]
  },
  muffler: {
    w: 12,
    h: 12,
    frames: [
      [
        '.......kkkk.',
        '......kuuuuk',
        '......kuuuuk',
        '..kkkkkwwwwk',
        '.krrrrkuuuuk',
        'krRRRRRuuuuk',
        'krRprrRwwwwk',
        'kRRrrrruuuuk',
        'krRrrruuuuuk',
        'kRRrrRuwkwk.',
        '.kkRRkkk.k..',
        '...kk.......'
      ]
    ]
  },
  cloak: {
    w: 12,
    h: 12,
    frames: [
      [
        '....kkkk....',
        '...krrrrk...',
        '...kyyyyk...',
        '..krrryrrk..',
        '..krrrRrrk..',
        '..krrrRrrk..',
        '.krrrrRrrrk.',
        '.krrrrRrrrk.',
        '.krrorRrork.',
        'kRRRyRRRyRRk',
        '.kkkkkMkkkk.',
        '......k.....'
      ]
    ]
  },
  scarf: {
    w: 12,
    h: 12,
    frames: [
      [
        '.kkk........',
        'kwwwk.......',
        '.kkkkkk.....',
        'kooorrrk....',
        'kooorrrk.kkk',
        'krrrRRrkkoor',
        '.kkkkkooorrk',
        '.kk..krrokk.',
        'kwwk..kkoook',
        '.kkk.koorrrr',
        'kwwwkkrrkkkk',
        '.kkk..kk....'
      ]
    ]
  },
  leaf: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '.kkk...kkkk.',
        'klllkkkllllk',
        'LllllLlllllL',
        'kLLllLlllLLk',
        '.kklLLLllkk.',
        '..kllLlllk..',
        '..klLLLllk..',
        '..kllLlllk..',
        '..kllLlllk..',
        '..kLLLLLLk..',
        '...kkkkkk...'
      ]
    ]
  },
  shell: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '............',
        '...kkkkkk...',
        '..kLLLLLLk..',
        '.kLLLwLLLLk.',
        'kLLLLllLLLLk',
        'kLLlllllLlLk',
        'kLLLLllLLLLk',
        'kLLLlLLLlLLk',
        'kcccccccccck',
        'kbbbbbbbbbbk',
        '.kkkkkkkkkk.'
      ]
    ]
  },
  cat: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '...k...k....',
        '..kokkkwkkk.',
        '.kwowwwwwwwk',
        '.kwwwwwwwwwk',
        '.kwwkwwkwwwk',
        '.kwpwwwwpkk.',
        '..krrrrrrk..',
        '.kwwwyywwk..',
        '.kwwwwwwok..',
        '..kwwwwwok..',
        '...kkkkkk...'
      ]
    ]
  },
  clover: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '...kk..kk...',
        '..kllkkllk..',
        '.klwllllllk.',
        '.kLllllllLk.',
        '..klllLllk..',
        '..kllLLllk..',
        '.kllllllllk.',
        '.kLllLLLlLk.',
        '..kLLkkLLk..',
        '...kk..kLk..',
        '........kLk.'
      ]
    ]
  },
  owl: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '..k......k..',
        '.ktkkkkkktk.',
        '..kttttttk..',
        '..kwwttwwk..',
        '.ktwkwwkwtk.',
        '.ktwwyywwtk.',
        '.kttccccttk.',
        '.kttccccttk.',
        '..ktcccctk..',
        '..ktcccctk..',
        '...kkkkkk...'
      ]
    ]
  },
  necklace: {
    w: 12,
    h: 12,
    frames: [
      [
        'kYk.......kY',
        'kYk.......kY',
        '.kYk.....kYk',
        '.kYYk...kYYk',
        '..kkYkkkYkk.',
        '...krrrrk...',
        '..krrrrrrk..',
        '.krrrRRrrrk.',
        '.krrrkkrrrk.',
        '.krrrkkrrrk.',
        '.kssskkrsssk',
        '.kSSSkkRSSSk'
      ]
    ]
  },
  hourglass: {
    w: 12,
    h: 12,
    frames: [
      [
        '..kkkkkkkk..',
        '.kBBBBBBBBk.',
        '..kjjjjjjk..',
        '...kjyyjk...',
        '....kjjk....',
        '....kjjk....',
        '....kjyk....',
        '....kyyk....',
        '...kyyyyk...',
        '..kjyyyyjk..',
        '.kBBBBBBBBk.',
        '..kkkkkkkk..'
      ]
    ]
  },
  feather: {
    w: 12,
    h: 12,
    frames: [
      [
        '........k...',
        '......kkrk..',
        '.....krroYk.',
        '....krryYrk.',
        '...krroYoRk.',
        '...kroyYrk..',
        '..krroYrRk..',
        '..krrYrRk...',
        '..kRYRRk....',
        '..kkYkk.....',
        '.kYYk.......',
        '..kk........'
      ]
    ]
  },
  ticket0: {
    w: 12,
    h: 8,
    frames: [
      [
        'kkkkkkkkkkkk',
        'bbbbbbbbbbbb',
        'bbbBbbbwbbbb',
        'kbbbbwwwwwbk',
        'kbbBbbwwwbbk',
        'bbbbbbbwbbbb',
        'bbbBbbbbbbbb',
        'kkkkkkkkkkkk'
      ]
    ]
  },
  ticket1: {
    w: 12,
    h: 8,
    frames: [
      [
        'kkkkkkkkkkkk',
        'ssssssssssss',
        'sssSssswssss',
        'ksssswwwwwsk',
        'kssSsswwwssk',
        'ssssssswssss',
        'sssSssssssss',
        'kkkkkkkkkkkk'
      ]
    ]
  },
  ticket2: {
    w: 12,
    h: 8,
    frames: [
      [
        'kkkkkkkkkkkk',
        'yyyyyyyyyyyy',
        'yyyYyyywyyyy',
        'kyyyywwwwwyk',
        'kyyYyywwwyyk',
        'yyyyyyywyyyy',
        'yyyYyyyyyyyy',
        'kkkkkkkkkkkk'
      ]
    ]
  }
};
