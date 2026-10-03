import type { ArcanaId } from '../arcana';
import type { Art } from '../pixels';
import { ITEM_ART } from './items';

/** 札の印。合う印のある札は武器やパッシブの印を使い回し、無い札だけ描いた */
const DRAWN: Record<string, Art> = {
  gamble: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '.kkkkkkkkkk.',
        '.kwwwwwwwwk.',
        '.kwkkwwwwwk.',
        '.kwkkwwwwwk.',
        '.kwwwkkwwwk.',
        '.kwwwkkwwwk.',
        '.kwwwwwkkwk.',
        '.kwwwwwkkwk.',
        '.kIIIIIIIIk.',
        '.kkkkkkkkkk.',
        '............'
      ]
    ]
  },
  cursed: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '..kkkkkkkk..',
        '.kvvvvvvvvk.',
        '.kvqqqqqqvk.',
        'kkkkkkkkkkkk',
        'kvvvvyyvvvvk',
        'kvvvvyyvvvvk',
        'knnnnnnnnnnk',
        'kvvvvvvvvvvk',
        'knnnnnnnnnnk',
        'kkkkkkkkkkkk',
        '............'
      ]
    ]
  },
  glass: {
    w: 12,
    h: 12,
    frames: [
      [
        '............',
        '........kk..',
        '.......kjjk.',
        '......kjwjjk',
        '.....kjwjjk.',
        '....kjjjjk..',
        '...kJjjjk...',
        '..kJJjjk....',
        '.kkJJJk.....',
        'kTTkkk......',
        'kTtTk.......',
        '.kkk........'
      ]
    ]
  },
  last: {
    w: 12,
    h: 12,
    frames: [
      [
        '.....kk.....',
        '....kssk....',
        '....kswk....',
        '....kswk....',
        '....kswk....',
        '....kswk....',
        '..kkkkkkkk..',
        '..kYyyyyYk..',
        '....krrk....',
        '....kRrk....',
        '....kyyk....',
        '.....kk.....'
      ]
    ]
  },
  blood: {
    w: 12,
    h: 12,
    frames: [
      [
        '.....kk.....',
        '....krrk....',
        '....krrk....',
        '...krrrrk...',
        '...krprrk...',
        '..krprrrrk..',
        '.krprrrrrrk.',
        '.krrrrrrrRk.',
        '.krrrrrrRRk.',
        '..krrrRRRk..',
        '...kkkkkk...',
        '............'
      ]
    ]
  }
};

export const ARCANA_ART: Record<ArcanaId, Art> = {
  fang: ITEM_ART['passive-fang'],
  swift: ITEM_ART['passive-paws'],
  wisdom: ITEM_ART['passive-nose'],
  clover: ITEM_ART['passive-clover'],
  shadow: ITEM_ART['passive-twin'],
  sand: ITEM_ART.clock,
  spring: ITEM_ART['passive-heart'],
  eye: ITEM_ART['passive-claw'],
  gamble: DRAWN.gamble,
  armor: ITEM_ART['passive-fur'],
  cursed: DRAWN.cursed,
  greedy: ITEM_ART['upgrade-greed'],
  glass: DRAWN.glass,
  last: DRAWN.last,
  horde: ITEM_ART.skull,
  blood: DRAWN.blood
};
