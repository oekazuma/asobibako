import { PALETTE } from './art/palette';

export interface Art {
  w: number;
  h: number;
  /** コマごとに h 本、長さ w の文字列。'.' は透明 */
  frames: string[][];
  /** この絵だけの差し色。PALETTE より優先する */
  pal?: Record<string, string>;
}

export type BakeMode = 'normal' | 'flip' | 'white' | 'flipWhite';

export function problems(name: string, art: Art, palette: Record<string, string>): string[] {
  const out: string[] = [];
  art.frames.forEach((rows, i) => {
    if (rows.length !== art.h) out.push(`${name}[${i}] の行数が ${rows.length}`);
    rows.forEach((row, y) => {
      if (row.length !== art.w) out.push(`${name}[${i}] ${y + 1} 行目の幅が ${row.length}`);
      for (const ch of new Set(row))
        if (ch !== '.' && !(ch in palette) && !(art.pal && ch in art.pal))
          out.push(`${name}[${i}] に色のない文字 ${ch}`);
    });
  });
  return out;
}

const baked = new WeakMap<Art, Map<string, HTMLCanvasElement>>();

/** 1 ドット = 1 画素で焼く。拡大は描く側が整数倍で行う。white は当たったときの白い点滅 */
export function bake(art: Art, frame = 0, mode: BakeMode = 'normal'): HTMLCanvasElement {
  let cache = baked.get(art);
  if (!cache) baked.set(art, (cache = new Map()));
  const key = `${frame}:${mode}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = art.w;
  c.height = art.h;
  const ctx = c.getContext('2d')!;
  const flip = mode === 'flip' || mode === 'flipWhite';
  const white = mode === 'white' || mode === 'flipWhite';
  art.frames[frame].forEach((row, y) => {
    for (let x = 0; x < art.w; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle = white ? '#ffffff' : (art.pal?.[ch] ?? PALETTE[ch]);
      ctx.fillRect(flip ? art.w - 1 - x : x, y, 1, 1);
    }
  });
  cache.set(key, c);
  return c;
}
