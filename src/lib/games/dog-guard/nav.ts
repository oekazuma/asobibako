import { closest, type Seg } from '$lib/segments';

const CELL = 0.0125;

/** 盤面をマスに分けて、目当ての点まで何マスで行けるかを持つ。-1 は壁の中か、たどり着けないマス */
export interface Field {
  cols: number;
  rows: number;
  dist: Int32Array;
}

/**
 * 線分から clear 以内のマスをふさいで、targets のそれぞれへの道のりを数える。
 * まっすぐ向かうだけのハチは足場や線の裏で止まり、回り込めばすぐの隙間にも入らないため
 */
export function fields(
  segs: readonly Seg[],
  clear: number,
  height: number,
  targets: readonly { x: number; y: number }[]
): Field[] {
  const cols = Math.ceil(1 / CELL);
  const rows = Math.ceil(height / CELL);
  const blocked = new Uint8Array(cols * rows);
  for (const seg of segs) {
    const [c0, c1] = span(Math.min(seg[0], seg[2]) - clear, Math.max(seg[0], seg[2]) + clear, cols);
    const [r0, r1] = span(Math.min(seg[1], seg[3]) - clear, Math.max(seg[1], seg[3]) + clear, rows);
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const [x, y] = [(c + 0.5) * CELL, (r + 0.5) * CELL];
        const [px, py] = closest(seg, x, y);
        if (Math.hypot(x - px, y - py) < clear) blocked[r * cols + c] = 1;
      }
  }
  return targets.map((t) => {
    const dist = new Int32Array(cols * rows).fill(-1);
    const start = cell(t.x, cols) + cell(t.y, rows) * cols;
    const queue = [start];
    dist[start] = 0;
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i];
      const [c, r] = [at % cols, Math.floor(at / cols)];
      for (const [nc, nr] of [
        [c - 1, r],
        [c + 1, r],
        [c, r - 1],
        [c, r + 1]
      ]) {
        const next = nr * cols + nc;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || blocked[next] || dist[next] >= 0) continue;
        dist[next] = dist[at] + 1;
        queue.push(next);
      }
    }
    return { cols, rows, dist };
  });
}

const cell = (v: number, n: number) => Math.min(n - 1, Math.max(0, Math.floor(v / CELL)));
const span = (a: number, b: number, n: number) => [cell(a, n), cell(b, n)];

/** (x, y) から道のりが縮む向き（長さ 1）。着いているか、道がなければ null */
export function toward(f: Field, x: number, y: number): [number, number] | null {
  const [c, r] = [cell(x, f.cols), cell(y, f.rows)];
  let best = f.dist[r * f.cols + c];
  let to: [number, number] | null = null;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const [nc, nr] = [c + dc, r + dr];
      if (nc < 0 || nr < 0 || nc >= f.cols || nr >= f.rows) continue;
      const d = f.dist[nr * f.cols + nc];
      if (d < 0 || (best >= 0 && d >= best)) continue;
      best = d;
      to = [(nc + 0.5) * CELL - x, (nr + 0.5) * CELL - y];
    }
  if (!to) return null;
  const n = Math.hypot(to[0], to[1]) || 1;
  return [to[0] / n, to[1] / n];
}
