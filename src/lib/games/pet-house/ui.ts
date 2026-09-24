import type { IconName } from '$lib/icons';
import type { AccessoryId, FoodId, ToyId } from './types';

export const ITEM_ICON: Record<FoodId | ToyId, IconName> = {
  dogfood: 'bowl',
  catfood: 'bowl',
  treat: 'meat',
  ball: 'ball',
  frisbee: 'frisbee',
  wand: 'wand',
  mouse: 'mouse'
};

/** アクセサリーの絵の代わりに出す色の丸 */
export const ACCESSORY_COLOR: Record<AccessoryId, string> = {
  'collar-red': '#ff5d6c',
  'collar-blue': '#4aa3ff',
  ribbon: '#ff9fc8',
  hat: '#ffd45c',
  bandana: '#7ad67a'
};
