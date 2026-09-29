// 絵柄。どれも同じ線（Stroke）を描き方だけ変えて見せる。毎フレーム画面の子を全部描き直すので、
// iPad で重い shadowBlur と filter は使わず、模様は 1 度作った小さな canvas を使い回す
import type { Point, Stroke } from './engine';

/** 描いている途中の線の太さ */
export const PEN = 0.012;

export interface Look {
  id: string;
  name: string;
  /** 盤面とずかんのカードの地（CSS の background） */
  bg: string;
  /** 写真アプリに保存するときの地 */
  paper: string;
  /** 目の色。無ければ体の色に合わせて黒か白 */
  eye?: string;
  /**
   * trace が作るパスを、この絵柄で塗って描く。影をずらすなど、座標を変えてパスを作り直せるよう関数で受ける。
   * 線の端は丸いままにして返す（フレームの頭で 1 度しか丸くしないため）
   */
  ink(ctx: CanvasRenderingContext2D, trace: () => void, color: string, filled: boolean, width: number): void;
}

/** 2 つの #rrggbb を t（0..1）で混ぜる */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [a, b].map((h) => parseInt(h.slice(1), 16));
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
}

/** 黒やちゃいろのような暗い色 */
export function dark(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  return (n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 < 110;
}

/** 小さな canvas に描いた模様を、盤面の単位で cell の大きさに並べる */
function tile(px: number, cell: number, paint: (ctx: CanvasRenderingContext2D) => void): () => CanvasPattern | null {
  let made: CanvasPattern | null = null;
  return () => {
    if (made) return made;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    paint(ctx);
    made = ctx.createPattern(canvas, 'repeat');
    made?.setTransform(new DOMMatrix().scale(cell / px));
    return made;
  };
}

/** 編み目。V の字が縦に並ぶメリヤス編み。色を持たない明暗だけなので、どの色の上にも重ねられる */
const knit = tile(48, 0.022, (ctx) => {
  ctx.lineCap = 'round';
  for (const [color, dy] of [
    ['rgb(0 0 0 / 0.18)', 3],
    ['rgb(255 255 255 / 0.35)', 0]
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    for (const [x, y] of [
      [12, 0],
      [36, 24],
      [12, 48],
      [36, -24]
    ]) {
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 4 + dy);
      ctx.lineTo(x, y + 20 + dy);
      ctx.lineTo(x + 10, y + 4 + dy);
      ctx.stroke();
    }
  }
});

const CRAYON_PAPER = '#fffcf2';

/** クレヨンのかすれ。紙の色の点を散らし、色の上に重ねて紙の目を透かす */
const grain = tile(64, 0.05, (ctx) => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  ctx.fillStyle = CRAYON_PAPER;
  for (let i = 0; i < 700; i++) {
    ctx.globalAlpha = 0.3 + rand() * 0.7;
    ctx.fillRect(Math.floor(rand() * 64), Math.floor(rand() * 64), 1 + Math.floor(rand() * 2), 1);
  }
});

const RIM = 'rgb(43 45 66 / 0.25)';

const plain: Look = {
  id: 'plain',
  name: 'ペン',
  bg: '#fff4f6',
  paper: '#ffffff',
  ink(ctx, trace, color, filled, width) {
    trace();
    ctx.fillStyle = ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (filled) ctx.fill();
    ctx.stroke();
    if (!filled) return;
    // しろで塗っても地から浮くように
    ctx.strokeStyle = RIM;
    ctx.lineWidth = PEN * 0.4;
    ctx.stroke();
  }
};

const yarn: Look = {
  id: 'yarn',
  name: 'けいと',
  bg: `repeating-linear-gradient(90deg, rgb(140 90 40 / 0.07) 0 2px, transparent 2px 6px),
    repeating-linear-gradient(0deg, rgb(140 90 40 / 0.07) 0 2px, transparent 2px 6px), #f4e4c8`,
  paper: '#f4e4c8',
  ink(ctx, trace, color, filled, width) {
    // 毛糸は細くすると糸に見えないので太らせる。塗った形のふちは 1 本の毛糸
    const w = filled ? width * 1.6 : Math.max(width, PEN * 1.8);
    trace();
    if (filled) {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fillStyle = knit() ?? color;
      ctx.fill();
    }
    ctx.strokeStyle = mix(color, '#2b2d42', 0.35);
    ctx.lineWidth = w * 1.25;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    // 撚り。明るい短い帯を糸に沿って並べる
    ctx.lineCap = 'butt';
    ctx.setLineDash([w * 0.3, w * 0.4]);
    ctx.strokeStyle = 'rgb(255 255 255 / 0.4)';
    ctx.lineWidth = w * 0.6;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
  }
};

const crayon: Look = {
  id: 'crayon',
  name: 'クレヨン',
  bg: CRAYON_PAPER,
  paper: CRAYON_PAPER,
  ink(ctx, trace, color, filled, width) {
    const w = width * 1.4;
    // 少しずらしてもう 1 度なぞり、ふちをがたつかせる
    ctx.save();
    ctx.translate(w * 0.2, -w * 0.15);
    trace();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    ctx.restore();
    trace();
    const rough = grain();
    if (filled) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (rough) {
        ctx.fillStyle = rough;
        ctx.fill();
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.stroke();
    if (!rough) return;
    ctx.strokeStyle = rough;
    ctx.stroke();
  }
};

const NIGHT = '#1d1a45';

const neon: Look = {
  id: 'neon',
  name: 'ネオン',
  bg: `linear-gradient(rgb(255 255 255 / 0.05) 1px, transparent 1px) 0 0 / 28px 28px,
    linear-gradient(90deg, rgb(255 255 255 / 0.05) 1px, transparent 1px) 0 0 / 28px 28px, ${NIGHT}`,
  paper: NIGHT,
  eye: '#fff',
  ink(ctx, trace, color, filled, width) {
    // 暗い地に溶けないよう、くろやちゃいろは明るくして光らせる
    const c = dark(color) ? mix(color, '#ffffff', 0.6) : color;
    trace();
    ctx.fillStyle = ctx.strokeStyle = c;
    if (filled) {
      ctx.globalAlpha = 0.3;
      ctx.fill();
    }
    // 光のにじみは太さに足す幅で持つ。太さに掛けると、ふくらんだしっぽのまわりが光の帯になる
    for (const [alpha, glow] of [
      [0.15, PEN * 2.6],
      [0.3, PEN * 1.2]
    ]) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = width + glow;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.strokeStyle = 'rgb(255 255 255 / 0.8)';
    ctx.lineWidth = width * 0.35;
    ctx.stroke();
  }
};

const paper: Look = {
  id: 'paper',
  name: 'きりがみ',
  bg: '#d6ecee',
  paper: '#d6ecee',
  ink(ctx, trace, color, filled, width) {
    // 切り抜いた紙のまわりの白いふちと、右下へ落ちる影。後から描く紙の影が先の紙に落ちて重なって見える
    const edge = filled ? PEN * 2 : width + PEN * 1.1;
    ctx.save();
    ctx.translate(PEN * 0.35, PEN * 0.55);
    trace();
    ctx.fillStyle = ctx.strokeStyle = 'rgb(30 60 70 / 0.22)';
    ctx.lineWidth = edge;
    if (filled) ctx.fill();
    ctx.stroke();
    ctx.restore();
    trace();
    ctx.fillStyle = ctx.strokeStyle = '#fff';
    ctx.lineWidth = edge;
    if (filled) ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle = color;
    if (filled) {
      ctx.fill();
      return;
    }
    ctx.lineWidth = width;
    ctx.stroke();
  }
};

/** 先頭が最初の絵柄 */
export const LOOKS: readonly Look[] = [plain, yarn, crayon, neon, paper];

export const LOOK_KEY = 'asobibako:doodle-worm:look';

export function loadLook(): Look {
  try {
    return LOOKS.find((l) => l.id === localStorage.getItem(LOOK_KEY)) ?? LOOKS[0];
  } catch {
    return LOOKS[0];
  }
}

export function saveLook(look: Look): void {
  try {
    localStorage.setItem(LOOK_KEY, look.id);
  } catch {
    // 使えない環境では覚えない
  }
}

const oval = (cx: number, cy: number, rx: number, ry: number, color: string): Stroke => ({
  color,
  pts: Array.from({ length: 25 }, (_, i): Point => {
    const t = (i / 24) * Math.PI * 2;
    return [cx + Math.cos(t) * rx, cy + Math.sin(t) * ry];
  })
});

/** ずかんが空のとき、絵柄を選ぶ画面に出す見本。まるい体に足が 2 つ */
export const SAMPLE: Stroke[] = [
  oval(0, 0, 0.08, 0.08, '#ffb3d1'),
  oval(-0.045, 0.09, 0.035, 0.022, '#f04438'),
  oval(0.045, 0.09, 0.035, 0.022, '#f04438')
];
