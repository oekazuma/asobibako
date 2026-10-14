/** 見せる三角形を升のふちから縮める画素と、吹き付けの三角形をそこから広げる画素 */
export const GAP = 2;
export const GROW = 1.5;
/** 三角形を囲む球の半径に足す余白（m）。float の丸めで角が球のふちからはみ出しても、届く吹き付けを飛ばさない */
const BOUND_PAD = 0.001;

export interface Atlas {
  corner: Uint32Array;
  uv: Float32Array;
  paintUv: Float32Array;
  paintPos: Float32Array;
  /** 吹き付けの三角形ごとの、角を全部含む球（中心の xyz と半径）。頂点シェーダーが三角形ごと飛ばせるよう 3 つの角に同じ値を持つ */
  paintBound: Float32Array;
  cell: number;
}

/** 直角二等辺三角形の内心の重み。角 0 が直角で、向かいの辺の長さ（√2 : 1 : 1）に比例する */
const W = [Math.SQRT2, 1, 1].map((w) => w / (2 + Math.SQRT2));

/**
 * 三角形を 2 つずつ正方形の升に入れて並べる。升の中の形は元の三角形の形によらず同じなので、
 * 画素の細かさは三角形ごとに少し違うが、吹き付けは 3D の距離で描くので模様はゆがまない
 */
export function layAtlas(pos: Float32Array, idx: Uint32Array, size: number): Atlas {
  const tris = idx.length / 3;
  const per = Math.ceil(Math.sqrt(Math.ceil(tris / 2)));
  const cell = size / per;
  if (cell < 12) throw new Error(`atlas cell ${cell.toFixed(1)}px is too small`);
  const inr = (cell * (2 - Math.SQRT2)) / 2;
  const show = (inr - GAP) / inr;
  const paint = (inr - GAP + GROW) / inr;
  const out: Atlas = {
    corner: new Uint32Array(idx),
    uv: new Float32Array(tris * 6),
    paintUv: new Float32Array(tris * 6),
    paintPos: new Float32Array(tris * 9),
    paintBound: new Float32Array(tris * 12),
    cell
  };
  for (let t = 0; t < tris; t++) {
    const c = t >> 1;
    const ox = (c % per) * cell;
    const oy = Math.floor(c / per) * cell;
    const base =
      t & 1
        ? [
            [cell, cell],
            [0, cell],
            [cell, 0]
          ]
        : [
            [0, 0],
            [cell, 0],
            [0, cell]
          ];
    const ix = W[0] * base[0][0] + W[1] * base[1][0] + W[2] * base[2][0];
    const iy = W[0] * base[0][1] + W[1] * base[1][1] + W[2] * base[2][1];
    const i3 = [0, 1, 2].map((j) => W.reduce((s, w, k) => s + w * pos[idx[t * 3 + k] * 3 + j], 0));
    for (let k = 0; k < 3; k++) {
      const at = t * 3 + k;
      const [bx, by] = base[k];
      out.uv[at * 2] = (ox + ix + (bx - ix) * show) / size;
      out.uv[at * 2 + 1] = (oy + iy + (by - iy) * show) / size;
      out.paintUv[at * 2] = (ox + ix + (bx - ix) * paint) / size;
      out.paintUv[at * 2 + 1] = (oy + iy + (by - iy) * paint) / size;
      for (let j = 0; j < 3; j++) out.paintPos[at * 3 + j] = i3[j] + (pos[idx[at] * 3 + j] - i3[j]) * (paint / show);
    }
    const pp = (k: number, j: number) => out.paintPos[(t * 3 + k) * 3 + j];
    const mid = [0, 1, 2].map((j) => (pp(0, j) + pp(1, j) + pp(2, j)) / 3);
    let r = 0;
    for (let k = 0; k < 3; k++) r = Math.max(r, Math.hypot(pp(k, 0) - mid[0], pp(k, 1) - mid[1], pp(k, 2) - mid[2]));
    for (let k = 0; k < 3; k++) out.paintBound.set([mid[0], mid[1], mid[2], r + BOUND_PAD], (t * 3 + k) * 4);
  }
  return out;
}
