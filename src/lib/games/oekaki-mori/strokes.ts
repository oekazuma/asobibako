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

/** canvas の画素の幅を 1 として描く。盤面は正方形なので高さも同じ */
export function render(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  const w = ctx.canvas.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, ctx.canvas.height);
  ctx.setTransform(w, 0, 0, w, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const { color, size, pts } of strokes) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    // 点 1 つだけの線（タップ）も丸く見せる
    if (pts.length === 2) ctx.lineTo(pts[0] + 0.0001, pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  }
}
