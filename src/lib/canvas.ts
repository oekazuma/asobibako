/**
 * 絵文字を中心 (x, y)、高さ size で描く。
 * 盤面の座標のまま 1px 未満のフォントを指定すると、Safari は文字の寸法を丸めて中心がずれるので、
 * 100px で描いてから縮める
 */
export function emoji(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.font = '100px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
