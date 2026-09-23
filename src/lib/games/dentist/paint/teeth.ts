import type { Tooth } from '../animals';
import type { GameState, Symptom } from '../engine';
import { FILL_S } from '../engine';
import { ink, oval } from './style';

/** 角の丸い歯の輪郭 */
export function toothPath(t: Tooth): Path2D {
  const p = new Path2D();
  p.roundRect(t.x - t.w / 2, t.y - t.h / 2, t.w, t.h, t.w * 0.42);
  return p;
}

/** 症状を重ねる前の白い歯。ふちは顔の線より淡くして、口の中を明るく見せる */
export function drawToothBase(ctx: CanvasRenderingContext2D, t: Tooth): void {
  const path = toothPath(t);
  ctx.fillStyle = '#fff';
  ctx.fill(path);
  ctx.lineWidth = 0.006;
  ctx.strokeStyle = '#d8c8c0';
  ctx.stroke(path);
}

const BLOBS = [
  [-0.18, 0.1, 0.22, 0.17],
  [0.16, 0.2, 0.18, 0.14],
  [-0.02, 0.28, 0.14, 0.1]
] as const;

/** 1 本の歯に症状は 1 つ。治りきった症状も、詰め物の跡を描くのに使う */
function symptomOf(g: GameState, i: number): Symptom | undefined {
  return g.symptoms.find((s) => s.tooth === i);
}

/**
 * 口の中の歯を症状ごと描く。ぐらぐらの歯は歯ぐきを支点に揺らし、引っぱった分だけずらす。
 * still（prefers-reduced-motion）では震えを止め、同じ振れ幅の固定した傾きだけでぐらぐら感を出す
 */
export function drawTeeth(ctx: CanvasRenderingContext2D, g: GameState, still: boolean): void {
  g.teeth.forEach((t, i) => {
    if (t.gone) return;
    const s = symptomOf(g, i);
    ctx.save();
    if (s?.type === 'loose') {
      const away = t.row === 'upper' ? 1 : -1;
      const gum = t.row === 'upper' ? t.y - t.h / 2 : t.y + t.h / 2;
      const amp = 0.05 + s.pull * 0.1;
      ctx.translate(t.x, gum + away * s.pull * 0.05);
      ctx.rotate(still ? amp : Math.sin(g.time * 16) * amp);
      ctx.translate(-t.x, -gum);
    }
    drawToothBase(ctx, t);
    const path = toothPath(t);
    ctx.clip(path);
    if (t.numb) {
      ctx.fillStyle = 'rgb(160 215 255 / 0.35)';
      ctx.fill(path);
    }
    if (s?.type === 'plaque' && s.left > 0) {
      ctx.globalAlpha = Math.min(1, 0.25 + (s.left / s.total) * 0.75);
      ctx.fillStyle = s.total > 1 ? '#c9a23a' : '#e7c24a';
      for (const [dx, dy, rx, ry] of BLOBS) {
        oval(ctx, t.x + dx * t.w, t.y + dy * t.h, rx * t.w * (s.total > 1 ? 1.3 : 1), ry * t.h);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (s?.type === 'cavity') {
      const cy = t.y + (t.row === 'upper' ? 0.12 : -0.12) * t.h;
      if (s.stage === 'decay') {
        const k = 0.6 + (s.drill / s.total) * 0.4;
        oval(ctx, t.x, cy, t.w * 0.3 * k, t.w * 0.26 * k);
        ctx.fillStyle = '#a9764a';
        ctx.fill();
        oval(ctx, t.x, cy, t.w * 0.2 * k, t.w * 0.17 * k);
        ctx.fillStyle = '#5c3c28';
        ctx.fill();
      } else if (s.stage === 'germs' || s.stage === 'hole') {
        oval(ctx, t.x, cy, t.w * 0.3, t.w * 0.2);
        ctx.fillStyle = '#5c3c28';
        ctx.fill();
        if (s.stage === 'hole' && s.fill < FILL_S) {
          const k = 1 - s.fill / FILL_S;
          oval(ctx, t.x, cy, t.w * 0.3 * k, t.w * 0.2 * k);
          ctx.fillStyle = '#f4f6fa';
          ctx.fill();
        }
      } else {
        oval(ctx, t.x, cy, t.w * 0.32, t.w * 0.22);
        ink(ctx, '#e8edf5', 0.004);
        oval(ctx, t.x - t.w * 0.08, cy - t.w * 0.06, t.w * 0.08, t.w * 0.04);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
    }
    ctx.restore();
  });
}
