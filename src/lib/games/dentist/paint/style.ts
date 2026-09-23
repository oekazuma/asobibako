/** ゆるかわの細いふち線。キャラクターも道具もこの色と太さでそろえる */
export const LINE = '#5b4a42';
export const LW = 0.008;

export function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

/** いまのパスを塗ってふち線を引く */
export function ink(ctx: CanvasRenderingContext2D, fill: string, width = LW): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = LINE;
  ctx.stroke();
}
