import type { Art } from '../pixels';

/** キャラ選択のメニューのアイコン。盾と本は深い色を差し色（pal）で足す */
export const MENU_ART: Record<string, Art> = {
  gacha: {
    w: 16,
    h: 17,
    frames: [
      [
        '.....kkkkkk.....',
        '....kjjjjjjk....',
        '...kjjwjjrrjk...',
        '..kjjwyyjrrjjk..',
        '..kjjjyyjjjjjk..',
        '.kjjjjjjuujjjjk.',
        '.kjjjrrjuujjjjk.',
        '..kjjrrjjjjjjk..',
        '..kjlljyyjppjk..',
        '...klljyyjppk...',
        '...kRRRRRRRRk...',
        '..krrwwrrrrrrk..',
        '..krwwwwrrrrrk..',
        '..krwwSwrkkkrk..',
        '..krrwwrrkkkrk..',
        '..kRRRRRRRRRRk..',
        '...kkkkkkkkkk...'
      ]
    ]
  },
  gear: {
    w: 18,
    h: 17,
    frames: [
      [
        '..............k...',
        '.............ksk..',
        '............kswk..',
        '...........kswk...',
        '..........kswk....',
        '......kkkkswkkkk..',
        '.....kYYYswYYYYYk.',
        '..k..kYAswAAAAAYk.',
        '.kyk.kYswEyyEEAYk.',
        '..kykkswEywyyEAYk.',
        '...kyswAEyyyyAAYk.',
        '...kkSkYAEyyAAYk..',
        '..kBkkykYAEAAYk...',
        '.kBk..k.kYAAYk....',
        'kYk......kYYk.....',
        '.k........kk......',
        '..................'
      ]
    ],
    pal: { A: '#1d2f6b', E: '#2b4a9a' }
  },
  trophy: {
    w: 12,
    h: 12,
    frames: [
      [
        '...kkkkkk...',
        '.kkyyyyyykk.',
        'kykywyyyykyk',
        'kokywyyyykok',
        '.koyyyyyyok.',
        '..kyyyyyok..',
        '..kooyyok...',
        '...kkYYk....',
        '...kkYYkk...',
        '..kBBBBBBk..',
        '..kBBBBBBk..',
        '...kkkkkk...'
      ]
    ]
  },
  book: {
    w: 16,
    h: 17,
    frames: [
      [
        '..kkkkkkkkkkk...',
        '.kQQRRRRRRRRRk..',
        '.kQQRYYYYYYYRwk.',
        '.kQQRYyyyyyYRwk.',
        '.kYYRYYYYYYYRwk.',
        '.kQQRRRRRRRRRwk.',
        '.kQQRRRyRyRRRwk.',
        '.kQQRyRRRRRyRwk.',
        '.kQQRRRRRRRRRwk.',
        '.kQQRRRyyyRRRwk.',
        '.kYYRRyyyyyRRwk.',
        '.kQQRRRRyRRRRwk.',
        '.kQQRRRRRRRRRwk.',
        '.kQQRRRRRRRRRwk.',
        '..kkswwwwwwwwwk.',
        '....kbbbbbbbbbk.',
        '.....kkkkkkkkk..'
      ]
    ],
    pal: { Q: '#55121f' }
  }
};
