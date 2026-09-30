export const PENS = [
  { hex: '#2b2d42', name: 'くろ' },
  { hex: '#f04438', name: 'あか' },
  { hex: '#63a8f7', name: 'あお' },
  { hex: '#3bb54a', name: 'みどり' },
  { hex: '#ffd84d', name: 'きいろ' },
  { hex: '#f5913e', name: 'オレンジ' },
  { hex: '#f25ea6', name: 'ピンク' },
  { hex: '#8a5a3c', name: 'ちゃいろ' }
] as const;

/** 盤面の幅に対する線の太さ（ほそい・ふつう・ふとい） */
export const SIZES = [0.008, 0.018, 0.04] as const;

/** 盤面の地は白なので、消しゴムは白い太い線で塗る */
export const ERASER = { color: '#ffffff', size: 0.06 };

/** 送る座標を小数 4 けた（盤面の 1 万分の 1。画素より細かい）に丸め、知らせを小さくする */
export const snap = (v: number): number => Math.round(v * 1e4) / 1e4;

export interface Stroke {
  color: string;
  size: number;
  /** 盤面に対する 0..1 の x, y を交互に並べる。送る量を減らすため組にしない */
  pts: number[];
}

export type Ink =
  | { k: 'start'; color: string; size: number; x: number; y: number }
  | { k: 'add'; pts: number[] }
  | { k: 'undo' }
  | { k: 'clear' };

export function apply(strokes: Stroke[], ink: Ink): Stroke[] {
  switch (ink.k) {
    case 'start':
      return [...strokes, { color: ink.color, size: ink.size, pts: [ink.x, ink.y] }];
    case 'add': {
      const last = strokes.at(-1);
      if (!last) return strokes;
      return [...strokes.slice(0, -1), { ...last, pts: [...last.pts, ...ink.pts] }];
    }
    case 'undo':
      return strokes.slice(0, -1);
    case 'clear':
      return [];
  }
}

/**
 * 1 本の線を、from 番目の点（描き終えた点の数）から終わりまで描く。点どうしは中点を通る 2 次曲線でつなぐ。
 * 描き足すときは 1 つ前の中点から描き直し、前に描いた末端の直線との継ぎ目を曲線で覆う
 */
function trace(ctx: CanvasRenderingContext2D, { color, size, pts }: Stroke, from: number): void {
  const n = pts.length / 2;
  const mid = (i: number): [number, number] => [
    (pts[2 * i] + pts[2 * i + 2]) / 2,
    (pts[2 * i + 1] + pts[2 * i + 3]) / 2
  ];
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.beginPath();
  // 点 1 つだけの線（タップ）も丸く見せる
  if (n === 1) {
    ctx.moveTo(pts[0], pts[1]);
    ctx.lineTo(pts[0] + 0.0001, pts[1]);
    ctx.stroke();
    return;
  }
  const first = Math.max(1, from - 1);
  const [sx, sy] = first === 1 ? [pts[0], pts[1]] : mid(first - 1);
  ctx.moveTo(sx, sy);
  for (let i = first; i < n - 1; i++) {
    const [mx, my] = mid(i);
    ctx.quadraticCurveTo(pts[2 * i], pts[2 * i + 1], mx, my);
  }
  ctx.lineTo(pts[2 * n - 2], pts[2 * n - 1]);
  ctx.stroke();
}

/** 盤面の幅を 1 とする座標で描けるようにする。盤面は正方形なので高さも同じ */
function frame(ctx: CanvasRenderingContext2D): void {
  const w = ctx.canvas.width;
  ctx.setTransform(w, 0, 0, w, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** canvas の画素の幅を 1 として全部描き直す */
export function render(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  frame(ctx);
  for (const stroke of strokes) trace(ctx, stroke, 0);
}

/** 最後の線に足された点だけを描き足す。from は前に描き終えた点の数 */
export function renderTail(ctx: CanvasRenderingContext2D, stroke: Stroke, from: number): void {
  frame(ctx);
  trace(ctx, stroke, from);
}
