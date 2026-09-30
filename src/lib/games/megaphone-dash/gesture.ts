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
    // 横か縦かは、いまのレーンの起点からのずれで、ループの前に一度だけ決める
    const lateral = t.jumped || Math.abs(x - t.x) >= up;
    while (lateral && Math.abs(x - t.x) >= SWIPE) {
      const dir = Math.sign(x - t.x);
      t.x += dir * SWIPE;
      out.push(dir > 0 ? 'right' : 'left');
    }
    if (!t.jumped && up >= SWIPE && up > Math.abs(x - t.x0)) {
      t.jumped = true;
      // 跳ぶまでの横のずれは、跳んだあとのレーン移動に数えない
      t.x = x;
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
