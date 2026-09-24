import type { IconName } from '$lib/icons';
import type { RoomPart, RoomTheme } from './decor';
import type { FoodId, ToyId } from './types';

export const ITEM_ICON: Record<FoodId | ToyId, IconName> = {
  dogfood: 'bowl',
  catfood: 'bowl',
  treat: 'meat',
  ball: 'ball',
  frisbee: 'frisbee',
  wand: 'wand',
  mouse: 'mouse'
};

const dotsOn = (base: string, dot: string, size = 14) =>
  `radial-gradient(${dot} 22%, transparent 24%) 0 0 / ${size}px ${size}px, radial-gradient(${dot} 22%, transparent 24%) ${size / 2}px ${size / 2}px / ${size}px ${size}px, ${base}`;
const stripes = (a: string, b: string, deg = 90, w = 8) =>
  `repeating-linear-gradient(${deg}deg, ${a} 0 ${w}px, ${b} ${w}px ${w * 2}px)`;

/** おみせの「へや」の見本。部位ごとの CSS の背景で、絵のかわりに色と模様を見せる */
export const ROOM_SWATCH: Record<RoomTheme, Record<RoomPart, string>> = {
  natural: {
    wall: '#eee8de',
    floor: stripes('#b86a36', '#a95e2e'),
    rug: `repeating-linear-gradient(45deg, #a93a2e 0 6px, #ece0c6 6px 12px, #24395a 12px 15px, #ece0c6 15px 21px)`,
    sofa: '#7f9d72',
    bed: '#c77b62',
    curtain: '#f4f1ea',
    view: 'linear-gradient(#cfe6f6 60%, #b9d7a4 60%)'
  },
  pink: {
    wall: dotsOn(stripes('#f9cfdc', '#fbdbe5', 90, 6), '#ffffff'),
    floor: stripes('#f1d3cb', '#e8c3ba', 45),
    rug: dotsOn('#f7b3ca', '#ffe3ec', 8),
    sofa: dotsOn('#f4a6c0', '#ee6f9a', 18),
    bed: 'radial-gradient(#fff0f5 40%, #f59ab8 42%)',
    curtain: `linear-gradient(90deg, #f6a8c2 0 25%, #fff 25% 75%, #f6a8c2 75%)`,
    view: 'linear-gradient(#c9d8ff, #f6d6f2 55%, #ffe4ec)'
  },
  wafu: {
    wall: 'linear-gradient(#d9c7a0 70%, #6b4a2e 70% 76%, #d7b88c 76%)',
    floor: stripes('#c8c47a', '#b9b56c', 0, 3),
    rug: dotsOn('#233a66', '#3f5f95', 12),
    sofa: 'linear-gradient(#e8dcc2 50%, #2c3e6b 50%)',
    bed: '#8a2f3a',
    curtain: `linear-gradient(90deg, #fbf6ea 0 30%, #c9a877 30% 34%, #fbf6ea 34% 64%, #c9a877 64% 68%, #fbf6ea 68%)`,
    view: 'linear-gradient(#c9d2dc 55%, #f7f9fb 55%)'
  },
  nordic: {
    wall: '#a9b7ba',
    floor: stripes('#dcc6a3', '#cfb68f', 90, 12),
    rug: `repeating-linear-gradient(45deg, #efe8da 0 8px, #2d2a28 8px 10px), #efe8da`,
    sofa: '#cfcac1',
    bed: '#8f8e8a',
    curtain: '#eee8dc',
    view: 'linear-gradient(#a9c9e2 50%, #5d8fb3 50%)'
  },
  castle: {
    wall: dotsOn('#6f1a28', '#d6aa5a', 16),
    floor: `repeating-conic-gradient(#ece3d2 0 25%, #2f3b36 0 50%) 0 0 / 20px 20px`,
    rug: 'radial-gradient(#d8ac52 25%, #1f2a4d 27% 40%, #8a1624 42%)',
    sofa: 'radial-gradient(#5c0f1c 15%, #8a1a2c 18%) 0 0 / 12px 12px',
    bed: 'radial-gradient(#d9b25e 40%, #8a1a2c 42%)',
    curtain: `linear-gradient(90deg, #8a1a2c 0 30%, #d8a94a 30% 34%, #efe2c4 34% 66%, #d8a94a 66% 70%, #8a1a2c 70%)`,
    view: 'radial-gradient(circle at 70% 30%, #fff4cf 12%, transparent 14%), linear-gradient(#0e1638, #2b3a78)'
  }
};
