import type { World } from './world';

/** 決着したあとと、3 択・宝箱の画面のあいだは開かない（どちらもすでに止まっていて、重ねると押し間違える） */
export function canPause(w: World, busy: boolean): boolean {
  return !w.over && !busy;
}
