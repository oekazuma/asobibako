import type { World } from './world';

/** 決着したあとと、3 択・宝箱の画面のあいだは開かない（どちらもすでに止まっていて、重ねると押し間違える） */
export function canPause(w: World, busy: boolean): boolean {
  return !w.over && !busy;
}

/** 3 択や宝箱のあいだに画面が隠れたときの一時停止を覚えておき、選び終えたら開く */
export class PendingPause {
  #wanted = false;

  /** 画面が隠れたとき。今開けるなら true、開けなければ覚える */
  hide(w: World, busy: boolean): boolean {
    if (canPause(w, busy)) return true;
    this.#wanted = !w.over;
    return false;
  }

  /** 毎フレーム呼ぶ。覚えていた一時停止を今開くなら true */
  due(w: World, busy: boolean): boolean {
    if (!this.#wanted || !canPause(w, busy)) return false;
    this.#wanted = false;
    return true;
  }
}
