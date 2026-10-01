import { icon } from '$lib/fx';
import type { Seat } from '$lib/net/party.svelte';
import { lookOf } from './looks';
import type { Drawing } from './Result.svelte';
import { render } from './strokes';

const WIDTH = 1080;
const PAD = 48;
const GAP = 32;
/** 上の見出しと順位の高さ */
const HEAD = 300;
/** 絵の下のお題と描いた人の高さ */
const CAPTION = 64;
/** app.css の --pastel-p1〜p3・--line・--paper と同じ色 */
const COLORS: Record<number, string> = { 1: '#8ec9ff', 2: '#ff9fb3', 3: '#9fe0a6' };
const LINE = '#5b4a42';
const PAPER = '#fffaf2';
const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';

export interface Cell {
  x: number;
  y: number;
  size: number;
}

/** 絵の数に合わせた画像の大きさと、絵を置く位置（3 枚以下は 1 列、4 枚からは 2 列） */
export function layout(n: number): { width: number; height: number; cells: Cell[] } {
  const cols = n <= 3 ? 1 : 2;
  const size = (WIDTH - PAD * 2 - GAP * (cols - 1)) / cols;
  const rows = Math.ceil(n / cols);
  const cells = Array.from({ length: n }, (_, i) => ({
    x: PAD + (i % cols) * (size + GAP),
    y: HEAD + Math.floor(i / cols) * (size + CAPTION + GAP),
    size
  }));
  return { width: WIDTH, height: HEAD + rows * (size + CAPTION + GAP) + PAD, cells };
}

function face(ctx: CanvasRenderingContext2D, seat: Seat, look: string | undefined, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = COLORS[seat];
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  const found = lookOf(look);
  if (found) icon(ctx, found.id, x, y, r * 1.5);
}

/** その回の順位と絵を 1 枚に描き、PNG の data URL で返す */
export function album(
  gallery: Drawing[],
  ranking: { seat: Seat; points: number; rank: number }[],
  looks: Record<number, string>
): string {
  const { width, height, cells } = layout(gallery.length);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = LINE;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText('おえかきのもり', width / 2, 80);
  ctx.font = `800 40px ${FONT}`;
  const step = width / (ranking.length + 1);
  ranking.forEach((r, i) => {
    const x = step * (i + 1);
    face(ctx, r.seat, looks[r.seat], x, 175, 44);
    ctx.fillStyle = LINE;
    ctx.fillText(`${r.rank}い ${r.points}てん`, x, 255);
  });
  const sheet = document.createElement('canvas');
  ctx.textAlign = 'left';
  gallery.forEach((d, i) => {
    const { x, y, size } = cells[i];
    sheet.width = sheet.height = Math.round(size);
    const g = sheet.getContext('2d');
    if (g) render(g, d.strokes);
    ctx.drawImage(sheet, x, y, size, size);
    ctx.lineWidth = 4;
    ctx.strokeStyle = LINE;
    ctx.strokeRect(x, y, size, size);
    face(ctx, d.by, looks[d.by], x + 30, y + size + 34, 26);
    ctx.fillStyle = LINE;
    ctx.fillText(`「${d.word}」`, x + 64, y + size + 36);
  });
  return canvas.toDataURL('image/png');
}
