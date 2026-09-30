/** 指をこれだけ（盤面の中のピクセル）ずらすと 1 レーン移る・跳ぶ */
export const SWIPE = 30;

export type Gesture = 'shoot' | 'left' | 'right' | 'jump';

interface Track {
  /** 横の起点。1 レーン移るたびにその向きへ SWIPE ずらす */
  x: number;
  /** 最初に触れた位置。縦のずれと、斜めの向きの見分けはここから測る */
  x0: number;
  y: number;
  jumped: boolean;
}

/** 指 1 本ごとに、触れた瞬間の「撃つ」と、そのあとのスワイプを見分ける */
export class Gestures {
  readonly #tracks = new Map<number, Track>();

  down(id: number, x: number, y: number): Gesture[] {
    this.#tracks.set(id, { x, x0: x, y, jumped: false });
    return ['shoot'];
  }

  move(id: number, x: number, y: number): Gesture[] {
    const t = this.#tracks.get(id);
    if (!t) return [];
    const out: Gesture[] = [];
    const up = t.y - y;
    const side = Math.abs(x - t.x0);
    // 跳んだあとの指は上へずれたままなので、横だけで見る
    while (Math.abs(x - t.x) >= SWIPE && (t.jumped || side >= up)) {
      const dir = Math.sign(x - t.x);
      t.x += dir * SWIPE;
      out.push(dir > 0 ? 'right' : 'left');
    }
    if (!t.jumped && up >= SWIPE && up > side) {
      t.jumped = true;
      out.push('jump');
    }
    return out;
  }

  up(id: number, x: number, y: number): Gesture[] {
    const out = this.move(id, x, y);
    this.#tracks.delete(id);
    return out;
  }
}
