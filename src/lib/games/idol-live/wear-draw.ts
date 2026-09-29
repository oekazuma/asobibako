import type { Theme } from './outfits';
import type { Body, P } from './pose';

/**
 * 衣装の絵。テーマ 4 つ × 部位 4 つ。座標は世界の単位（背の高さがほぼ 1）。
 * トップスは上体の枠（腰が原点）、スカートは腰の枠、靴と靴下は世界、アクセは頭の枠（頭の中心が原点）で描く
 */

export const LINE = '#6b3a4f';
export const LW = 0.0065;
export const SKIN = '#ffe9dc';
const WHITE = '#ffffff';

type Ctx = CanvasRenderingContext2D;

export function shape(ctx: Ctx, fill: string | CanvasGradient, path: () => void, line = true) {
  ctx.beginPath();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
  if (!line) return;
  ctx.lineWidth = LW;
  ctx.strokeStyle = LINE;
  ctx.stroke();
}

/** ふちどりした太い線（腕・脚・袖） */
export function limb(ctx: Ctx, pts: P[], width: number, color: string) {
  ctx.beginPath();
  ctx.moveTo(...pts[0]);
  for (const p of pts.slice(1)) ctx.lineTo(...p);
  ctx.lineWidth = width + LW * 2;
  ctx.strokeStyle = LINE;
  ctx.stroke();
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

export function star(ctx: Ctx, x: number, y: number, r: number, inner = 0.45, n = 5, rot = 0) {
  ctx.moveTo(x + Math.sin(rot) * r, y - Math.cos(rot) * r);
  for (let i = 1; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const k = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.sin(a) * k, y - Math.cos(a) * k);
  }
  ctx.closePath();
}

export function heart(ctx: Ctx, x: number, y: number, r: number) {
  ctx.moveTo(x, y + r * 0.9);
  ctx.bezierCurveTo(x - r * 1.3, y + r * 0.1, x - r * 0.9, y - r * 1, x, y - r * 0.35);
  ctx.bezierCurveTo(x + r * 0.9, y - r * 1, x + r * 1.3, y + r * 0.1, x, y + r * 0.9);
  ctx.closePath();
}

/** 胴。bottom は裾の高さ */
export function torso(ctx: Ctx, bottom = -0.03) {
  ctx.moveTo(-0.042, -0.232);
  ctx.quadraticCurveTo(-0.062, -0.228, -0.074, -0.21);
  ctx.quadraticCurveTo(-0.07, -0.14, -0.05, -0.085);
  ctx.lineTo(-0.056, bottom);
  ctx.lineTo(0.056, bottom);
  ctx.lineTo(0.05, -0.085);
  ctx.quadraticCurveTo(0.07, -0.14, 0.074, -0.21);
  ctx.quadraticCurveTo(0.062, -0.228, 0.042, -0.232);
  ctx.quadraticCurveTo(0, -0.212, -0.042, -0.232);
  ctx.closePath();
}

/** 裾や襟のフリル。a から b へ、半円を n 個 */
function scallop(ctx: Ctx, a: P, b: P, n: number, fill: string) {
  const r = Math.hypot(b[0] - a[0], b[1] - a[1]) / n / 2;
  shape(ctx, fill, () => {
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      ctx.moveTo(a[0] + (b[0] - a[0]) * u + r, a[1] + (b[1] - a[1]) * u);
      ctx.arc(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, r, 0, Math.PI * 2);
    }
  });
}

function bow(ctx: Ctx, x: number, y: number, r: number, color: string, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  shape(ctx, color, () => {
    for (const s of [-1, 1]) {
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * r * 1.1, -r * 1.1, s * r * 1.2, 0);
      ctx.quadraticCurveTo(s * r * 1.1, r * 0.9, 0, 0);
    }
  });
  shape(ctx, color, () => {
    for (const s of [-1, 1]) {
      ctx.moveTo(s * r * 0.1, r * 0.1);
      ctx.lineTo(s * r * 0.7, r * 1.2);
      ctx.lineTo(s * r * 0.3, r * 1.1);
      ctx.closePath();
    }
  });
  shape(ctx, color, () => ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2));
  ctx.restore();
}

function clipped(ctx: Ctx, clip: () => void, draw: () => void) {
  ctx.save();
  ctx.beginPath();
  clip();
  ctx.clip();
  draw();
  ctx.restore();
}

// --- トップス（上体の枠） ---

export const TOPS: Record<Theme, (ctx: Ctx) => void> = {
  cute: (ctx) => {
    shape(ctx, '#ff9cc4', () => torso(ctx));
    scallop(ctx, [-0.056, -0.03], [0.056, -0.03], 6, WHITE);
    for (const s of [-1, 1])
      shape(ctx, WHITE, () => ctx.ellipse(s * 0.024, -0.222, 0.03, 0.015, s * 0.3, 0, Math.PI * 2));
    bow(ctx, 0, -0.2, 0.03, '#ff4f8b');
  },
  cool: (ctx) => {
    shape(ctx, '#2d3a78', () => torso(ctx));
    shape(ctx, WHITE, () => {
      ctx.moveTo(-0.034, -0.23);
      ctx.lineTo(0, -0.13);
      ctx.lineTo(0.034, -0.23);
      ctx.closePath();
    });
    shape(ctx, '#5fd0ff', () => {
      ctx.moveTo(0, -0.218);
      ctx.lineTo(-0.011, -0.2);
      ctx.lineTo(0, -0.14);
      ctx.lineTo(0.011, -0.2);
      ctx.closePath();
    });
    ctx.strokeStyle = '#d7dce8';
    ctx.lineWidth = 0.006;
    ctx.beginPath();
    ctx.moveTo(-0.036, -0.232);
    ctx.lineTo(0, -0.128);
    ctx.lineTo(0.036, -0.232);
    ctx.moveTo(-0.054, -0.036);
    ctx.lineTo(0.054, -0.036);
    ctx.stroke();
    for (const s of [-1, 1]) shape(ctx, '#d7dce8', () => ctx.roundRect(s * 0.07 - 0.02, -0.225, 0.04, 0.016, 0.006));
  },
  pop: (ctx) => {
    shape(ctx, '#ffd43b', () => torso(ctx));
    clipped(
      ctx,
      () => torso(ctx),
      () => {
        ctx.fillStyle = '#35c9e0';
        ctx.fillRect(-0.1, -0.165, 0.2, 0.018);
        ctx.fillRect(-0.1, -0.05, 0.2, 0.02);
      }
    );
    shape(ctx, WHITE, () => star(ctx, 0, -0.1, 0.03));
    ctx.strokeStyle = '#35c9e0';
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    ctx.moveTo(-0.04, -0.229);
    ctx.quadraticCurveTo(0, -0.207, 0.04, -0.229);
    ctx.stroke();
  },
  elegant: (ctx) => {
    shape(ctx, '#c9b0ff', () => torso(ctx));
    ctx.strokeStyle = '#a58ae8';
    ctx.lineWidth = 0.004;
    ctx.beginPath();
    for (const x of [-0.022, 0, 0.022]) {
      ctx.moveTo(x, -0.17);
      ctx.lineTo(x * 1.1, -0.035);
    }
    ctx.stroke();
    scallop(ctx, [-0.05, -0.225], [0.05, -0.225], 7, WHITE);
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      const x = -0.036 + 0.072 * u;
      shape(ctx, '#fffaf0', () => ctx.arc(x, -0.228 + 0.024 * Math.sin(Math.PI * u), 0.0065, 0, Math.PI * 2));
    }
    bow(ctx, 0, -0.06, 0.022, WHITE);
  }
};

// --- 袖と手袋（世界） ---

interface Sleeve {
  /** 上腕の付け根から、上腕の長さのどこまでを袖にするか */
  upper: [string, number] | null;
  fore: string | null;
  /** ふくらんだ肩 */
  puff: string | null;
  cuff: string | null;
}

export const SLEEVES: Record<Theme, Sleeve> = {
  cute: { upper: null, fore: null, puff: '#ff9cc4', cuff: WHITE },
  cool: { upper: ['#2d3a78', 1], fore: '#2d3a78', puff: null, cuff: '#d7dce8' },
  pop: { upper: ['#ffd43b', 0.55], fore: null, puff: null, cuff: '#35c9e0' },
  elegant: { upper: null, fore: WHITE, puff: 'rgba(214, 196, 255, 0.92)', cuff: '#e9ddff' }
};

const at = (a: P, b: P, u: number): P => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];

/** 片腕。skin の腕の上に袖を重ねる */
export function arm(ctx: Ctx, b: Body, i: 0 | 1, theme: Theme) {
  const [s, e, h] = [b.shoulder[i], b.elbow[i], b.hand[i]];
  const sl = SLEEVES[theme];
  limb(ctx, [s, e, h], 0.032, SKIN);
  if (sl.fore) limb(ctx, [e, at(e, h, 0.82)], 0.034, sl.fore);
  if (sl.upper) limb(ctx, [s, at(s, e, sl.upper[1])], 0.04, sl.upper[0]);
  if (sl.cuff && sl.upper && !sl.fore) limb(ctx, [at(s, e, sl.upper[1] - 0.08), at(s, e, sl.upper[1])], 0.042, sl.cuff);
  if (sl.cuff && sl.fore) limb(ctx, [at(e, h, 0.74), at(e, h, 0.82)], 0.038, sl.cuff);
  if (sl.puff) {
    const c = at(s, e, 0.25);
    shape(ctx, sl.puff, () => ctx.arc(c[0], c[1], 0.036, 0, Math.PI * 2));
    if (sl.cuff && !sl.fore) limb(ctx, [at(s, e, 0.5), at(s, e, 0.56)], 0.036, sl.cuff);
  }
}

// --- スカート（腰の枠。flare は 0..1 のひるがえり） ---

export const SKIRTS: Record<Theme, (ctx: Ctx, flare: number) => void> = {
  cute: (ctx, f) => {
    const tier = (top: number, bottom: number, w: number, color: string) =>
      shape(ctx, color, () => {
        ctx.moveTo(-0.058, top);
        ctx.lineTo(0.058, top);
        ctx.quadraticCurveTo(w * 0.9, (top + bottom) / 2, w, bottom);
        ctx.quadraticCurveTo(0, bottom + 0.02, -w, bottom);
        ctx.quadraticCurveTo(-w * 0.9, (top + bottom) / 2, -0.058, top);
      });
    tier(0.0, 0.112, 0.13 + 0.04 * f, '#ffb8d4');
    scallop(ctx, [-0.12 - 0.04 * f, 0.114], [0.12 + 0.04 * f, 0.114], 9, WHITE);
    tier(-0.055, 0.05, 0.105 + 0.03 * f, '#ff9cc4');
    shape(ctx, '#ff4f8b', () => ctx.roundRect(-0.058, -0.06, 0.116, 0.02, 0.008));
  },
  cool: (ctx, f) => {
    const w = 0.12 + 0.035 * f;
    const outline = () => {
      ctx.moveTo(-0.058, -0.05);
      ctx.lineTo(0.058, -0.05);
      ctx.lineTo(w, 0.1);
      ctx.lineTo(-w, 0.1);
      ctx.closePath();
    };
    shape(ctx, '#2d3a78', outline);
    ctx.strokeStyle = '#1c2552';
    ctx.lineWidth = 0.004;
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const u = i / 6 - 0.5;
      ctx.moveTo(u * 0.116, -0.04);
      ctx.lineTo(u * 2 * w, 0.1);
    }
    ctx.stroke();
    clipped(ctx, outline, () => {
      ctx.fillStyle = '#d7dce8';
      ctx.fillRect(-0.2, 0.078, 0.4, 0.009);
    });
    shape(ctx, '#1c2552', () => ctx.roundRect(-0.06, -0.062, 0.12, 0.018, 0.006));
    shape(ctx, '#d7dce8', () => ctx.roundRect(-0.014, -0.064, 0.028, 0.022, 0.005));
  },
  pop: (ctx, f) => {
    const w = 0.125 + 0.03 * f;
    const outline = () => {
      ctx.moveTo(-0.058, -0.055);
      ctx.lineTo(0.058, -0.055);
      ctx.bezierCurveTo(w * 1.05, -0.01, w * 1.05, 0.085, w * 0.72, 0.1);
      ctx.quadraticCurveTo(0, 0.12, -w * 0.72, 0.1);
      ctx.bezierCurveTo(-w * 1.05, 0.085, -w * 1.05, -0.01, -0.058, -0.055);
    };
    shape(ctx, '#43d1e3', outline);
    clipped(ctx, outline, () => {
      ctx.fillStyle = WHITE;
      for (let i = 0; i < 12; i++) {
        const x = -0.11 + (i % 4) * 0.07 + (Math.floor(i / 4) % 2) * 0.035;
        const y = -0.03 + Math.floor(i / 4) * 0.045;
        ctx.beginPath();
        ctx.arc(x, y, 0.009, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    shape(ctx, '#ffd43b', () => ctx.roundRect(-0.06, -0.064, 0.12, 0.018, 0.008));
  },
  elegant: (ctx, f) => {
    const layer = (hem: number, w: number, color: string, line: boolean) =>
      shape(
        ctx,
        color,
        () => {
          ctx.moveTo(-0.058, -0.055);
          ctx.lineTo(0.058, -0.055);
          ctx.quadraticCurveTo(w * 0.8, hem * 0.4, w, hem);
          for (let i = 1; i <= 6; i++) {
            const x = w - (2 * w * i) / 6;
            ctx.quadraticCurveTo(x + w / 6, hem + 0.022, x, hem);
          }
          ctx.quadraticCurveTo(-w * 0.8, hem * 0.4, -0.058, -0.055);
        },
        line
      );
    layer(0.33, 0.17 + 0.05 * f, 'rgba(255, 255, 255, 0.55)', false);
    layer(0.29, 0.15 + 0.045 * f, '#c9b0ff', true);
    shape(ctx, WHITE, () => ctx.roundRect(-0.06, -0.066, 0.12, 0.018, 0.008));
  }
};

// --- 靴下・ブーツと靴（世界） ---

export function legwear(ctx: Ctx, b: Body, i: 0 | 1, theme: Theme) {
  const [k, a, h] = [b.knee[i], b.ankle[i], b.hipJ[i]];
  if (theme === 'cute') limb(ctx, [at(k, a, 0.05), a], 0.046, WHITE);
  if (theme === 'cool') {
    limb(ctx, [at(h, k, 0.75), k, a], 0.05, '#2d3a78');
    const m = at(k, a, 0.45);
    shape(ctx, '#d7dce8', () => ctx.roundRect(m[0] - 0.018, m[1] - 0.006, 0.036, 0.012, 0.004));
  }
  if (theme === 'pop') limb(ctx, [at(k, a, 0.72), a], 0.046, WHITE);
  if (theme === 'elegant') {
    ctx.globalAlpha = 0.35;
    limb(ctx, [h, k, a], 0.044, '#b89cff');
    ctx.globalAlpha = 1;
  }
}

export function shoe(ctx: Ctx, a: P, s: -1 | 1, theme: Theme) {
  const [x, y] = [a[0] + s * 0.006, a[1] + 0.016];
  const toe = (color: string, rx = 0.032, ry = 0.02) =>
    shape(ctx, color, () => ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2));
  switch (theme) {
    case 'cute':
      toe('#ff5c93');
      limb(
        ctx,
        [
          [x - 0.022, y - 0.012],
          [x + 0.022, y - 0.012]
        ],
        0.005,
        '#ff5c93'
      );
      shape(ctx, WHITE, () => heart(ctx, x, y - 0.002, 0.008));
      return;
    case 'cool':
      toe('#232d63', 0.033, 0.022);
      shape(ctx, '#11163a', () => ctx.roundRect(x - 0.034, y + 0.012, 0.068, 0.01, 0.004));
      return;
    case 'pop':
      toe(WHITE, 0.034, 0.022);
      shape(ctx, '#ffd43b', () => ctx.ellipse(x, y + 0.004, 0.024, 0.014, 0, 0, Math.PI * 2));
      shape(ctx, '#35c9e0', () => ctx.roundRect(x - 0.035, y + 0.012, 0.07, 0.009, 0.004));
      return;
    case 'elegant':
      toe('#b89cff', 0.028, 0.018);
      shape(ctx, '#fffaf0', () => ctx.arc(x, y - 0.006, 0.007, 0, Math.PI * 2));
  }
}

// --- アクセ（頭の枠。s はツインテールの根元の側） ---

export const TAILS: P = [0.105, -0.085];

export const ACCS: Record<Theme, { tie: (ctx: Ctx, s: -1 | 1) => void; head: (ctx: Ctx) => void }> = {
  cute: {
    tie: (ctx, s) => bow(ctx, s * TAILS[0], TAILS[1], 0.05, '#ff4f8b', s * 0.35),
    head: () => {}
  },
  cool: {
    tie: (ctx, s) => shape(ctx, '#2d3a78', () => ctx.arc(s * TAILS[0], TAILS[1], 0.018, 0, Math.PI * 2)),
    head: (ctx) => {
      ctx.lineCap = 'round';
      limb(
        ctx,
        [
          [-0.118, 0.02],
          [-0.08, 0.075],
          [-0.035, 0.078]
        ],
        0.007,
        '#3a3f55'
      );
      shape(ctx, '#ff6fa5', () => ctx.arc(-0.033, 0.078, 0.009, 0, Math.PI * 2));
      shape(ctx, '#3a3f55', () => ctx.ellipse(-0.12, 0.012, 0.016, 0.026, 0, 0, Math.PI * 2));
      shape(ctx, '#5fd0ff', () => ctx.arc(-0.12, 0.012, 0.007, 0, Math.PI * 2));
    }
  },
  pop: {
    tie: (ctx, s) => shape(ctx, '#35c9e0', () => ctx.arc(s * TAILS[0], TAILS[1], 0.022, 0, Math.PI * 2)),
    head: (ctx) => {
      shape(ctx, '#ffd43b', () => star(ctx, -0.07, -0.075, 0.026, 0.45, 5, -0.3));
      shape(ctx, '#ff6fa5', () => star(ctx, -0.035, -0.1, 0.017, 0.45, 5, 0.2));
    }
  },
  elegant: {
    tie: (ctx, s) => {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        shape(ctx, '#fffaf0', () =>
          ctx.arc(s * TAILS[0] + Math.cos(a) * 0.016, TAILS[1] + Math.sin(a) * 0.016, 0.008, 0, Math.PI * 2)
        );
      }
    },
    head: (ctx) => {
      shape(ctx, '#ffd86b', () => {
        ctx.moveTo(-0.055, -0.108);
        ctx.lineTo(-0.045, -0.14);
        ctx.lineTo(-0.025, -0.122);
        ctx.lineTo(0, -0.158);
        ctx.lineTo(0.025, -0.122);
        ctx.lineTo(0.045, -0.14);
        ctx.lineTo(0.055, -0.108);
        ctx.quadraticCurveTo(0, -0.12, -0.055, -0.108);
      });
      shape(ctx, '#ff6fa5', () => ctx.arc(0, -0.13, 0.009, 0, Math.PI * 2));
      for (const s of [-1, 1]) shape(ctx, '#8ec9ff', () => ctx.arc(s * 0.03, -0.12, 0.006, 0, Math.PI * 2));
    }
  }
};
