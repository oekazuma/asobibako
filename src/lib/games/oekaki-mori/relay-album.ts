import type { Entry } from './relay';
import { UNKNOWN } from './relay';
import { who } from './looks';
import { render } from './strokes';

/** 列の幅。リレー 1 本を 1 列にして、列を横に並べる */
const COL = 360;
const GAP = 32;
const PAD = 48;
const HEAD = 140;
const TEXT = 80;
/** app.css の --line・--paper と同じ色 */
const LINE = '#5b4a42';
const PAPER = '#fffaf2';
const FONT = '"Hiragino Maru Gothic ProN", "Hiragino Sans", sans-serif';

type Cell = { x: number; y: number; w: number; h: number };

/** リレーごとの列に、言葉のこまと絵のこまを上から積む */
export function relayLayout(columns: Entry[][]): { width: number; height: number; cells: Cell[][] } {
  let tallest = 0;
  const cells = columns.map((entries, c) => {
    const x = PAD + c * (COL + GAP);
    let y = HEAD;
    const col = entries.map((e) => {
      const h = e.kind === 'draw' ? COL : TEXT;
      const cell = { x, y, w: COL, h };
      y += h + GAP / 2;
      return cell;
    });
    tallest = Math.max(tallest, y - HEAD);
    return col;
  });
  return {
    width: PAD * 2 + columns.length * COL + Math.max(0, columns.length - 1) * GAP,
    height: HEAD + tallest + PAD,
    cells
  };
}

function words(e: Entry, looks: Record<number, string>): string {
  if (e.kind === 'prompt') return `おだい「${e.text}」`;
  if (e.kind === 'guess') return `${who(e.by, looks)}「${e.text ?? UNKNOWN}」`;
  return '';
}

/** 全部のリレーを横に並べた 1 枚を描き、PNG の data URL で返す */
export function relayAlbum(columns: Entry[][], looks: Record<number, string>): string {
  const { width, height, cells } = relayLayout(columns);
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
  ctx.fillText('おえかきリレー', width / 2, 70);
  const sheet = document.createElement('canvas');
  sheet.width = sheet.height = COL;
  columns.forEach((entries, c) =>
    entries.forEach((e, i) => {
      const { x, y, w, h } = cells[c][i];
      if (e.kind === 'draw') {
        const g = sheet.getContext('2d');
        if (g) render(g, e.strokes);
        ctx.drawImage(sheet, x, y, w, h);
        ctx.lineWidth = 4;
        ctx.strokeStyle = LINE;
        ctx.strokeRect(x, y, w, h);
        return;
      }
      ctx.fillStyle = LINE;
      ctx.font = `800 34px ${FONT}`;
      ctx.fillText(words(e, looks), x + w / 2, y + h / 2, w - 16);
    })
  );
  return canvas.toDataURL('image/png');
}
