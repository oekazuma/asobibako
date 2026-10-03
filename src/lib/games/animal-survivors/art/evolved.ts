import { goldOf, type Art } from '../pixels';
import { ITEM_ART } from './items';
import { PALETTE } from './palette';

const golds = new WeakMap<Art, Art>();

/** 線（k）は残し、ほかの色を明るさに応じた金色にする。文字はそのままで pal で色だけ差し替える。毎フレーム描く弾にも使うので控える */
export function goldArt(art: Art): Art {
  const had = golds.get(art);
  if (had) return had;
  const pal: Record<string, string> = {};
  for (const f of art.frames)
    for (const row of f) for (const ch of row) if (ch !== '.') pal[ch] ??= goldOf(art.pal?.[ch] ?? PALETTE[ch]);
  const g = { ...art, pal };
  golds.set(art, g);
  return g;
}

/** 右上の 3×3 に白い星（＋の形）を置く。明るい地でも見えるよう四隅は線の色にする。星の文字は * で、色は pal で白にする */
function star(art: Art): Art {
  const w = art.w;
  const put = (r: string, x: number, ch: string) => r.slice(0, x) + ch + r.slice(x + 1);
  const frames = art.frames.map((f) =>
    f.map((row, y) =>
      y > 2 ? row : put(put(put(row, w - 3, y === 1 ? '*' : 'k'), w - 2, '*'), w - 1, y === 1 ? '*' : 'k')
    )
  );
  return { ...art, frames, pal: { ...art.pal, '*': '#ffffff' } };
}

/** 専用進化形の印。右上の 3×3 に赤い王冠を置く（ふつうの進化形の白い星と見分ける） */
function crown(art: Art): Art {
  const w = art.w;
  const rows = ['^k^', '^^^', 'kkk'];
  const frames = art.frames.map((f) => f.map((row, y) => (y > 2 ? row : row.slice(0, w - 3) + rows[y])));
  return { ...art, frames, pal: { ...art.pal, '^': '#ff5a4a' } };
}

const made = new Map<string, Art>();

/** ITEM_ART を引く。進化形のアイコン（weapon-<id>Evo）は元の武器の絵から作って控える */
export function itemArt(key: string): Art {
  const have = ITEM_ART[key];
  if (have) return have;
  let a = made.get(key);
  if (!a && key.startsWith('weapon-') && key.endsWith('Evo')) {
    a = star(goldArt(ITEM_ART[key.slice(0, -3)]));
    made.set(key, a);
  } else if (!a && key.startsWith('weapon-') && key.endsWith('Sp')) {
    a = crown(goldArt(ITEM_ART[key.slice(0, -2)]));
    made.set(key, a);
  }
  if (!a) throw new Error(`絵が無い: ${key}`);
  return a;
}
