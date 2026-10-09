import { rng } from './rng';
import { make, type Pattern } from './textures';

const PAINTS = ['#e2262b', '#f6c21c', '#3fae3a', '#8a3fc4'];

/**
 * 本家のロビーの赤・黄・緑・紫の大きなペンキのしぶき。粒は 8px 以上なので、1 枚 8m の模様で 6cm 以上になる。
 * 模様は繰り返して貼るので、はみ出したしぶきは反対の端にも描いて継ぎ目で切れないようにする
 */
function splats(g: CanvasRenderingContext2D, seed: number, w: number, h: number, count: number, drip: boolean) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const cx = r() * w;
    const cy = r() * h;
    const big = 50 + r() * 90;
    const dots = Array.from({ length: 14 }, () => {
      const a = r() * Math.PI * 2;
      const d = big * (0.8 + r() * 0.9);
      return [Math.cos(a) * d, Math.sin(a) * d, 8 + r() * big * 0.35];
    });
    // 垂れるのは壁だけ。床と天井では向きが無いので垂らさない
    const drips = drip
      ? Array.from({ length: 3 }, () => [-big * 0.5 + r() * big, 10 + r() * 8, big * (0.8 + r() * 1.4)])
      : [];
    g.fillStyle = PAINTS[i % PAINTS.length];
    for (const ox of [-w, 0, w])
      for (const oy of [-h, 0, h]) {
        const x = cx + ox;
        const y = cy + oy;
        g.beginPath();
        g.arc(x, y, big, 0, Math.PI * 2);
        for (const [dx, dy, rr] of dots) {
          g.moveTo(x + dx + rr, y + dy);
          g.arc(x + dx, y + dy, rr, 0, Math.PI * 2);
        }
        g.fill();
        for (const [dx, dw, dl] of drips) {
          g.beginPath();
          g.roundRect(x + dx, y, dw, dl, dw / 2);
          g.fill();
        }
      }
  }
}

/**
 * ロビーの壁。白地に白いアーチの浮き彫り（影とハイライトの線）と、ペンキのしぶき。
 * 1 枚が 8m × 6m で、線は 3cm 以上
 */
export function splashWall(): Pattern {
  return make('splash-wall', 1024, 768, [8, 6], (g) => {
    g.fillStyle = '#f4f2ee';
    g.fillRect(0, 0, 1024, 768);
    for (const cx of [256, 768]) {
      for (const [color, dx] of [
        ['rgb(0 0 0 / 0.14)', 4],
        ['rgb(255 255 255 / 0.95)', -4]
      ] as const) {
        g.strokeStyle = color;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(cx - 200 + dx, 768);
        g.lineTo(cx - 200 + dx, 330);
        g.arc(cx + dx, 330, 200, Math.PI, 0);
        g.lineTo(cx + 200 + dx, 768);
        g.stroke();
      }
    }
    splats(g, 83, 1024, 768, 9, true);
  });
}

/** ロビーの床。白黒の市松（1 枡 0.5m）にしぶき。1 枚が 8m 四方 */
export function splashFloor(): Pattern {
  return make('splash-floor', 1024, 1024, [8, 8], (g) => {
    for (let i = 0; i < 16; i++)
      for (let j = 0; j < 16; j++) {
        g.fillStyle = (i + j) % 2 ? '#1d1c1b' : '#efebe2';
        g.fillRect(i * 64, j * 64, 64, 64);
      }
    splats(g, 89, 1024, 1024, 6, false);
  });
}

/** ロビーの天井。白地にしぶき。1 枚が 8m 四方 */
export function splashCeiling(): Pattern {
  return make('splash-ceiling', 1024, 1024, [8, 8], (g) => {
    g.fillStyle = '#f4f2ee';
    g.fillRect(0, 0, 1024, 1024);
    splats(g, 97, 1024, 1024, 5, false);
  });
}

/** 筆の字の線。0..1 の枠の中の折れ線で、y は下向き */
const LETTERS: Record<string, [number, number][][]> = {
  H: [
    [
      [0, 0],
      [0, 1]
    ],
    [
      [1, 0],
      [1, 1]
    ],
    [
      [0, 0.5],
      [1, 0.48]
    ]
  ],
  U: [
    [
      [0, 0],
      [0, 0.7],
      [0.15, 0.95],
      [0.5, 1],
      [0.85, 0.95],
      [1, 0.7],
      [1, 0]
    ]
  ],
  N: [
    [
      [0, 1],
      [0, 0],
      [1, 1],
      [1, 0]
    ]
  ],
  T: [
    [
      [-0.15, 0],
      [1.15, 0.02]
    ],
    [
      [0.5, 0],
      [0.5, 1]
    ]
  ],
  E: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1]
    ],
    [
      [0, 0.5],
      [0.8, 0.5]
    ]
  ],
  R: [
    [
      [0, 1],
      [0, 0],
      [0.7, 0],
      [0.95, 0.12],
      [0.95, 0.38],
      [0.7, 0.5],
      [0, 0.5]
    ],
    [
      [0.45, 0.5],
      [1, 1]
    ]
  ]
};

/**
 * ロビーの台の上面。赤地に白いペンキの筆の字で HUNTER。1 枚が台の差し渡し 2.4m で、字の線は 4cm 以上。
 * 始める場所から低い角度で見るので、字は台の円に収まるいっぱいの大きさにする
 */
export function hunterSign(): Pattern {
  return make('hunter-sign', 512, 512, [2.4, 2.4], (g) => {
    const r = rng(71);
    g.fillStyle = '#a3170f';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = g.fillStyle = '#ffffff';
    g.lineCap = g.lineJoin = 'round';
    const [lw, lh, gap, top] = [60, 150, 14, 175];
    const left = (512 - (lw * 6 + gap * 5)) / 2;
    [...'HUNTER'].forEach((ch, k) => {
      const ox = left + k * (lw + gap);
      for (const line of LETTERS[ch]) {
        const pts = line.map(([x, y]) => [ox + x * lw + (r() - 0.5) * 4, top + y * lh + (r() - 0.5) * 4]);
        // 筆は置いたところが太く、払うにつれて細くなる。短い区間ごとに太さを変えて描く
        const steps = pts.slice(1).map((p, i) => Math.ceil(Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) / 4));
        const total = steps.reduce((a, b) => a + b, 0);
        let n = 0;
        pts.slice(1).forEach((p, i) => {
          const [x0, y0] = pts[i];
          for (let s = 0; s < steps[i]; s++, n++) {
            g.lineWidth = 24 * (1.1 - 0.45 * (n / total)) + (r() - 0.5) * 3;
            g.beginPath();
            g.moveTo(x0 + ((p[0] - x0) * s) / steps[i], y0 + ((p[1] - y0) * s) / steps[i]);
            g.lineTo(x0 + ((p[0] - x0) * (s + 1)) / steps[i], y0 + ((p[1] - y0) * (s + 1)) / steps[i]);
            g.stroke();
          }
        });
      }
      // 字の下から垂れたペンキ。先は丸いしずく
      if (r() < 0.7) {
        const x = ox + r() * lw;
        const len = 20 + r() * 40;
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(x, top + lh - 4);
        g.lineTo(x, top + lh + len);
        g.stroke();
        g.beginPath();
        g.arc(x, top + lh + len, 7, 0, Math.PI * 2);
        g.fill();
      }
    });
  });
}

/** 書斎の茶色の木の床。幅 15cm の板を長さ方向にずらして張る。継ぎ目と木目は 2cm 以上 */
export function planks(): Pattern {
  return make('planks', 512, 512, [1.2, 1.2], (g) => {
    const r = rng(89);
    for (let i = 0; i < 8; i++) {
      const y = i * 64;
      let x = -r() * 200;
      while (x < 512) {
        const len = 180 + r() * 160;
        g.fillStyle = `hsl(26 ${40 + r() * 10}% ${26 + r() * 8}%)`;
        g.fillRect(x, y, len, 64);
        g.strokeStyle = 'rgb(255 230 200 / 0.07)';
        g.lineWidth = 9;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.moveTo(x, y + 14 + k * 16);
          g.lineTo(x + len, y + 16 + k * 16);
          g.stroke();
        }
        g.strokeStyle = 'rgb(0 0 0 / 0.35)';
        g.strokeRect(x, y, len, 64);
        x += len;
      }
    }
  });
}

/** キッチンの白いタイルの壁。15cm 角に灰色の目地（2.3cm） */
export function whiteTile(): Pattern {
  return make('white-tile', 256, 256, [0.6, 0.6], (g) => {
    const r = rng(97);
    g.fillStyle = '#b9bcbf';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = `hsl(200 8% ${92 + r() * 5}%)`;
        g.fillRect(x * 64 + 5, y * 64 + 5, 54, 54);
      }
  });
}

/**
 * キッチンの青い六角タイルの床。差し渡し 20cm、目地 2.3cm。縦にとがった六角を、横 √3R・縦 3R の周期で
 * 2 周期ぶん描いて継ぎ目なく繰り返す（横の周期は 0.7 画素ずれるが、目に見えない）
 */
export function blueHex(): Pattern {
  const R = 46;
  const w = Math.sqrt(3) * R;
  return make('blue-hex', 160, 276, [0.348, 0.6], (g) => {
    const r = rng(101);
    g.fillStyle = '#e8eef2';
    g.fillRect(0, 0, 160, 276);
    for (let k = -1; k <= 4; k++)
      for (let i = -1; i <= 3; i++) {
        const cx = i * w + (k % 2 ? w / 2 : 0);
        const cy = k * 1.5 * R;
        g.fillStyle = `hsl(208 ${55 + r() * 15}% ${38 + r() * 10}%)`;
        g.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = Math.PI / 6 + (s * Math.PI) / 3;
          g.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
        }
        g.fill();
      }
  });
}

/** ランドリーの赤いれんがの壁。25 × 7cm のれんがを半分ずつずらして積み、目地は 2cm */
export function brick(): Pattern {
  return make('brick', 256, 256, [1.08, 1.08], (g) => {
    const r = rng(103);
    g.fillStyle = '#8f8379';
    g.fillRect(0, 0, 256, 256);
    const course = 256 / 12;
    for (let j = 0; j < 12; j++)
      for (let i = -1; i <= 4; i++) {
        const x = i * 64 + (j % 2 ? 32 : 0);
        g.fillStyle = `hsl(${4 + r() * 10} ${55 + r() * 15}% ${32 + r() * 10}%)`;
        g.fillRect(x + 2.5, j * course + 2.5, 59, course - 5);
      }
  });
}
