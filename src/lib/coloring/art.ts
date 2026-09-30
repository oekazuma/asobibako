import { SIZE, type Regions } from './regions';
import { LINE, type Template } from './templates';

export type Art =
  { kind: 'template'; template: Template; path: Path2D; mask: Uint8Array } | { kind: 'photo'; mask: Uint8Array };

const UNIT = SIZE / 100;
const INK = '#3b2f2a';
const INK_RGB = [59, 47, 42] as const;

function canvas(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

export function templateArt(template: Template): Art {
  const path = new Path2D(template.d);
  const c = canvas(SIZE);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(UNIT, 0, 0, UNIT, 0, 0);
  ctx.lineWidth = LINE * 0.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(path);
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const mask = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] > 96 ? 1 : 0;
  return { kind: 'template', template, path, mask };
}

export const photoArt = (mask: Uint8Array): Art => ({ kind: 'photo', mask });

const buffers = new WeakMap<CanvasRenderingContext2D, ImageData>();

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * 塗りの画像を SIZE の canvas に置く。線の画素は、写真なら線の色、テンプレートなら白にする
 * （テンプレートは上から太い線を描いて隠すので、塗りが線の下まで届き、線と塗りのあいだに白いすき間が出ない）
 */
export function fillImage(ctx: CanvasRenderingContext2D, regions: Regions, colors: Record<number, string>, art: Art) {
  // 塗るたびに 2.4MB の画素を取り直さないよう、canvas ごとに 1 枚を使い回す
  let img = buffers.get(ctx);
  if (!img) buffers.set(ctx, (img = ctx.createImageData(SIZE, SIZE)));
  const d = img.data;
  const table = new Map(Object.entries(colors).map(([k, hex]) => [Number(k), rgb(hex)]));
  const line = art.kind === 'photo' ? INK_RGB : [255, 255, 255];
  for (let i = 0; i < SIZE * SIZE; i++) {
    const l = regions.labels[i];
    const c = l < 0 ? line : (table.get(l) ?? [255, 255, 255]);
    d[i * 4] = c[0];
    d[i * 4 + 1] = c[1];
    d[i * 4 + 2] = c[2];
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

/** 塗り（SIZE の canvas）を px の大きさに広げ、テンプレートならその上に線をなめらかに描く */
export function compose(ctx: CanvasRenderingContext2D, fill: HTMLCanvasElement, art: Art, px: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fill, 0, 0, px, px);
  if (art.kind !== 'template') return;
  ctx.setTransform(px / 100, 0, 0, px / 100, 0, 0);
  ctx.lineWidth = LINE;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke(art.path);
}

/** 書き出しとぬりえちょうの見本に使う data URL */
export function snapshot(art: Art, regions: Regions, colors: Record<number, string>, px: number, type = 'image/png') {
  const fill = canvas(SIZE);
  fillImage(fill.getContext('2d')!, regions, colors, art);
  const out = canvas(px);
  compose(out.getContext('2d')!, fill, art, px);
  return out.toDataURL(type, 0.85);
}
