import type { Art } from '../pixels';

/** 地面は上から見ているので、浅瀬と墨だまりは縦につぶした楕円にする（draw-volcano.ts の池と同じ） */
const SQUASH = 1.6;
/** にじむ段（0..2）。0.8 秒で 0 → 1 → 2 と進み、2 が満ちた浅瀬 */
const shallows = new Map<string, Art>();
const inks = new Map<number, Art>();

/** 浅瀬。段 0 は濡れた砂の輪に水の点、段 1 はまだらに水、段 2 は水面と縁の白い泡 */
export function shallowArt(r: number, stage: 0 | 1 | 2): Art {
  const key = `${r}:${stage}`;
  const hit = shallows.get(key);
  if (hit) return hit;
  const w = r * 2 + 4;
  const h = Math.ceil((r * 2) / SQUASH) + 4;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - w / 2, (y + 0.5 - h / 2) * SQUASH);
      const k = d / r;
      const n = (x * 7 + y * 13) % 9;
      const m = (x * 5 + y * 11) % 7;
      if (stage === 0) row += k <= 1 ? (k < 0.6 && n === 0 ? 'J' : k > 0.8 || m === 0 ? 'e' : '.') : '.';
      else if (stage === 1)
        row += k <= 1 ? (k < 0.5 ? (n === 0 ? 'j' : 'J') : k < 0.8 ? (n < 5 ? 'J' : 'e') : m < 3 ? 'J' : 'e') : '.';
      else
        row +=
          k <= 1
            ? k < 0.55 && n === 0
              ? 'w'
              : k < 0.7
                ? 'j'
                : k < 0.88
                  ? 'J'
                  : (x + y) % 3
                    ? 'w'
                    : 'J'
            : d <= r + 1 && (x + y) % 2
              ? 'e'
              : '.';
    }
    rows.push(row);
  }
  const art = { w, h, frames: [rows], pal: { e: '#d9b67c' } };
  shallows.set(key, art);
  return art;
}

/** 大ダコの墨だまり。黒い墨に紫の光、縁はにじんだ点 */
export function inkArt(r: number): Art {
  const hit = inks.get(r);
  if (hit) return hit;
  const w = r * 2 + 4;
  const h = Math.ceil((r * 2) / SQUASH) + 4;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x + 0.5 - w / 2, (y + 0.5 - h / 2) * SQUASH);
      const k = d / r;
      const n = (x * 7 + y * 13) % 9;
      row +=
        d <= r
          ? k < 0.6 && n === 0
            ? 'v'
            : k < 0.45 && n === 4
              ? 'q'
              : k < 0.85
                ? 'N'
                : 'n'
          : d <= r + 1.5 && (x * 3 + y) % 4 === 0
            ? 'N'
            : '.';
    }
    rows.push(row);
  }
  const art = { w, h, frames: [rows] };
  inks.set(r, art);
  return art;
}
