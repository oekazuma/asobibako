import { rng } from './rng';
import { make, oilPainting, type Pattern } from './textures';

const PAINTS = ['#e2262b', '#f6c21c', '#3fae3a', '#8a3fc4'];

/**
 * 本家のロビーの赤・黄・緑・紫の大きなペンキのしぶき。粒は 8px 以上なので、壁（1m が 96 画素）では約 8cm、床と天井（1m が 128 画素）では約 6cm 以上になる。
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
 * ロビーの壁。白地にペンキのしぶき。1 枚が壁 1 面の 16m × 6m（1m が 96 画素。屋敷の模様の画素の上限に収める）で、線は 3cm 以上。
 * 白いアーチは浮き出させた形で別に置く（lobby.ts）。壁ごとに模様をずらし裏返して、同じしぶきが並ばないようにする
 */
export function splashWall(): Pattern {
  return make('splash-wall', 1536, 576, [16, 6], (g) => {
    g.fillStyle = '#f4f2ee';
    g.fillRect(0, 0, 1536, 576);
    splats(g, 83, 1536, 576, 16, true);
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

/** 書斎の磨いた赤茶の床。幅 10cm の細い板を長さをふぞろいにずらして張る。板ごとの明るさの差は ±8% までで、継ぎ目と木目は 2cm 以上 */
export function planks(): Pattern {
  return make('planks', 512, 512, [1.2, 1.2], (g) => {
    const r = rng(89);
    const h = 512 / 12;
    for (let i = 0; i < 12; i++) {
      const y = i * h;
      let x = -r() * 200;
      while (x < 512) {
        const len = 150 + r() * 200;
        g.fillStyle = `hsl(14 ${40 + r() * 12}% ${22 + r() * 16}%)`;
        g.fillRect(x, y, len, h);
        g.strokeStyle = 'rgb(255 220 190 / 0.08)';
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(x, y + h * 0.4);
        g.lineTo(x + len, y + h * 0.45);
        g.stroke();
        g.strokeStyle = 'rgb(20 6 2 / 0.45)';
        g.strokeRect(x, y, len, h);
        x += len;
      }
    }
  });
}

/** 書斎の壁の大きな額縁の羽目板（幅 1.5m・高さ 2m）。濃い茶の枠に、一段下がった鏡板と浮き彫りの縁。溝と縁は 2cm 以上 */
export function framedPanel(): Pattern {
  return make('framed-panel', 512, 683, [1.5, 2], (g) => {
    const r = rng(47);
    g.fillStyle = '#3a1a0c';
    g.fillRect(0, 0, 512, 683);
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `hsl(20 50% ${14 + r() * 6}% / 0.6)`;
      g.lineWidth = 9 + r() * 4;
      const x = r() * 512;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= 683; y += 40) g.lineTo(x + Math.sin(y / 90 + k) * 5, y);
      g.stroke();
    }
    g.fillStyle = '#2c1409';
    g.fillRect(52, 52, 408, 579);
    g.strokeStyle = '#6e4220';
    g.lineWidth = 10;
    g.strokeRect(70, 70, 372, 543);
    g.strokeStyle = '#150904';
    g.lineWidth = 12;
    g.strokeRect(46, 46, 420, 591);
  });
}

/**
 * キッチンの白いタイルの壁。20cm 角のタイルに、溝の輪と、面取りした真ん中の四角の浮き模様（本家の暗い角の壁）。
 * 目地・溝・面取りはどれも 2cm（屋敷の線は 2cm 以上）。本家の 15cm 角では溝と面取りが収まらないので大きくした。
 * 面は灰緑がかった白にする。本家のキッチンは薄暗く、真っ白だと照明で飛んで部屋が明るすぎる
 */
export function whiteTile(): Pattern {
  return make('white-tile', 512, 512, [0.6, 0.6], (g) => {
    const r = rng(97);
    const cm = 512 / 60;
    const t = 20 * cm;
    g.fillStyle = '#9aa09a';
    g.fillRect(0, 0, 512, 512);
    g.lineWidth = 2 * cm;
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 3; i++) {
        const [x0, y0] = [i * t + cm, j * t + cm];
        const side = t - 2 * cm;
        g.fillStyle = `hsl(105 ${4 + r() * 3}% ${72 + r() * 4}%)`;
        g.fillRect(x0, y0, side, side);
        g.strokeStyle = 'rgb(60 70 60 / 0.16)';
        g.strokeRect(x0 + 3 * cm, y0 + 3 * cm, side - 6 * cm, side - 6 * cm);
        // 真ん中の四角の面取り。上と左は明るく、下と右は暗い
        const [a, b] = [x0 + 6 * cm, x0 + side - 6 * cm];
        const [c, d] = [y0 + 6 * cm, y0 + side - 6 * cm];
        for (const [path, color] of [
          [[a, d, a, c, b, c], 'rgb(255 255 255 / 0.25)'],
          [[b, c, b, d, a, d], 'rgb(40 50 40 / 0.16)']
        ] as const) {
          g.strokeStyle = color;
          g.beginPath();
          g.moveTo(path[0], path[1]);
          g.lineTo(path[2], path[3]);
          g.lineTo(path[4], path[5]);
          g.stroke();
        }
      }
  });
}

/**
 * キッチンの六角のモザイクタイルの床。タイルの差し渡し 7.7cm で、目地は暗く 2cm（屋敷の線は 2cm 以上。
 * 本家の 5〜6cm にすると目地が半分を占めるので、少し大きくした）。色はティールからコバルトまでむらがある。
 * 縦にとがった六角を横 √3R・縦 3R の周期で 8 × 4 周期描き、色は周期の中の位置で決めて継ぎ目でも同じ色にする
 */
export const HEX = { r: 0.05, grout: 0.02 };
export function blueHex(): Pattern {
  const px = 640;
  const R = HEX.r * px;
  const w = Math.sqrt(3) * R;
  const tile = R - (HEX.grout * px) / Math.sqrt(3);
  const colors = ['#1f6f8f', '#2f86a8', '#3a9cc0', '#25708a', '#2a5f7a', '#253942'];
  const r = rng(101);
  const pick = Array.from({ length: 64 }, () => colors[Math.floor(r() * colors.length)]);
  return make('blue-hex', Math.round(8 * w), 8 * 1.5 * R, [8 * Math.sqrt(3) * HEX.r, 12 * HEX.r], (g) => {
    g.fillStyle = '#24414b';
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    for (let k = -1; k <= 8; k++)
      for (let i = -1; i <= 8; i++) {
        const cx = i * w + (k % 2 ? w / 2 : 0);
        const cy = k * 1.5 * R;
        g.fillStyle = pick[(((k % 8) + 8) % 8) * 8 + (((i % 8) + 8) % 8)];
        g.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = Math.PI / 6 + (s * Math.PI) / 3;
          g.lineTo(cx + Math.cos(a) * tile, cy + Math.sin(a) * tile);
        }
        g.fill();
      }
  });
}

/** ランドリーと書斎の暗い木の天井。幅 15cm の板に強い木目（2cm 以上）と板の継ぎ目 */
export function darkPlanks(): Pattern {
  return make('dark-planks', 512, 512, [1.2, 1.2], (g) => {
    const r = rng(103);
    for (let i = 0; i < 8; i++) {
      const base = 28 + r() * 6;
      g.fillStyle = `hsl(20 18% ${base}%)`;
      g.fillRect(i * 64, 0, 64, 512);
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = `hsl(18 20% ${base - 6 + r() * 4}% / 0.8)`;
        g.lineWidth = 9 + r() * 6;
        g.beginPath();
        const x0 = i * 64 + 8 + r() * 48;
        g.moveTo(x0, 0);
        for (let y = 0; y <= 512; y += 32) g.lineTo(x0 + Math.sin(y / 60 + k * 2) * 6, y);
        g.stroke();
      }
      g.fillStyle = '#0e0907';
      g.fillRect(i * 64, 0, 9, 512);
    }
  });
}

/** 額の油絵の筆の跡（色の薄い楕円を重ねる） */
function strokes(g: CanvasRenderingContext2D, r: () => number, hue: number, n = 220) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `hsl(${hue + r() * 25} ${15 + r() * 20}% ${20 + r() * 45}% / 0.12)`;
    g.beginPath();
    g.ellipse(r() * 512, r() * 384, 6 + r() * 14, 3 + r() * 6, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
}

/** 黒い上着に白い襟の人の胸から上（書斎の肖像画）。目と口は 2cm 以上 */
function portrait(): Pattern {
  return make('art-portrait', 512, 384, [1.2, 0.9], (g) => {
    const r = rng(107);
    const bg = g.createRadialGradient(256, 150, 30, 256, 190, 300);
    bg.addColorStop(0, '#5a4330');
    bg.addColorStop(1, '#1f1610');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#16141a';
    g.beginPath();
    g.ellipse(256, 384, 170, 150, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#efe8dc';
    g.beginPath();
    g.moveTo(216, 250);
    g.lineTo(256, 320);
    g.lineTo(296, 250);
    g.fill();
    g.fillStyle = '#d6ac86';
    g.beginPath();
    g.ellipse(256, 165, 58, 74, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2a1e';
    g.beginPath();
    g.ellipse(256, 115, 64, 40, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#2a1d14';
    for (const x of [234, 278]) {
      g.beginPath();
      g.arc(x, 165, 6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(244, 205, 24, 9);
    strokes(g, r, 25);
  });
}

/** 空と丘と川と 1 本の木の風景 */
function landscape(): Pattern {
  return make('art-landscape', 512, 384, [1.2, 0.9], (g) => {
    const r = rng(109);
    const sky = g.createLinearGradient(0, 0, 0, 230);
    sky.addColorStop(0, '#6f93b4');
    sky.addColorStop(1, '#e9dcb8');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#7f8f6a';
    g.beginPath();
    g.moveTo(0, 230);
    g.quadraticCurveTo(140, 150, 300, 220);
    g.quadraticCurveTo(420, 180, 512, 210);
    g.lineTo(512, 384);
    g.lineTo(0, 384);
    g.fill();
    g.fillStyle = '#4f6b3c';
    g.beginPath();
    g.moveTo(0, 300);
    g.quadraticCurveTo(220, 250, 512, 290);
    g.lineTo(512, 384);
    g.lineTo(0, 384);
    g.fill();
    g.fillStyle = '#9db7c9';
    g.beginPath();
    g.moveTo(180, 384);
    g.quadraticCurveTo(250, 320, 330, 300);
    g.lineTo(350, 304);
    g.quadraticCurveTo(280, 330, 250, 384);
    g.fill();
    g.fillStyle = '#3d2b1c';
    g.fillRect(392, 190, 14, 110);
    g.fillStyle = '#35502c';
    g.beginPath();
    g.arc(399, 180, 48, 0, Math.PI * 2);
    g.fill();
    strokes(g, r, 80);
  });
}

/** 机の上の青い花瓶と花と果物 */
function stillLife(): Pattern {
  return make('art-still-life', 512, 384, [1.2, 0.9], (g) => {
    const r = rng(113);
    g.fillStyle = '#2f3a2a';
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#5a3d26';
    g.fillRect(0, 280, 512, 104);
    g.strokeStyle = '#4f7a3a';
    g.lineWidth = 9;
    for (const [x, y] of [
      [190, 120],
      [235, 100],
      [265, 130],
      [210, 85],
      [255, 70]
    ]) {
      g.beginPath();
      g.moveTo(220, 170);
      g.lineTo(x, y);
      g.stroke();
    }
    for (const [x, y, c] of [
      [190, 120, '#c94f4f'],
      [235, 100, '#e7c95a'],
      [265, 130, '#e7e1d0'],
      [210, 85, '#c94f4f'],
      [255, 70, '#d98a3a']
    ] as const) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, 24, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#3c5f8a';
    g.fillRect(200, 150, 40, 60);
    g.beginPath();
    g.ellipse(220, 240, 52, 60, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b8432f';
    for (const [x, y, s] of [
      [360, 300, 30],
      [410, 312, 26]
    ]) {
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#e7c95a';
    g.beginPath();
    g.ellipse(318, 316, 30, 20, 0.3, 0, Math.PI * 2);
    g.fill();
    strokes(g, r, 60);
  });
}

/** 額の絵柄（mansion/props.ts の ART 枚） */
export function artwork(k: number): Pattern {
  return [oilPainting, portrait, landscape, stillLife][k % 4]();
}
