import { sprite, stamp, type Particles } from '$lib/fx';
import { radius, type Bug, type BugKind } from './engine';

/**
 * 1 回描いた虫の絵。iPad では 1 匹が 120px 前後になるので、縮小だけで済むよう 192px で描く。
 * 歩く足は 2 コマを交互に使う
 */
const body = (kind: BugKind, frame: number) =>
  sprite(`bug:${kind}:${frame}`, 192, (c) => {
    c.translate(0.5, 0.5);
    drawLegs(c, 0.36, frame);
    drawBody(c, kind, 0.36);
  });

/**
 * 虫は最大 36 匹が同時に動くので、DOM の要素ではなく 1 枚の canvas にまとめて描く。
 * 要素ごとに動かすと、影や合成のせいで描画が 1 秒に数回まで落ちた
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  bugs: Bug[],
  particles: Particles,
  width: number,
  height: number,
  now: number
) {
  ctx.clearRect(0, 0, width, height);
  particles.draw(ctx);
  // 飛んでいる虫はほかの虫より手前に描く
  for (const flying of [false, true]) {
    for (const bug of bugs) {
      if ((bug.flight !== null) !== flying) continue;
      const r = radius(bug) * height;
      const lift = bug.flight ? 1 + Math.sin(bug.flight.t * Math.PI) * 0.7 : 1;
      ctx.save();
      ctx.translate(bug.x * width, bug.y * height);
      ctx.scale(lift, lift);
      if (flying) {
        ctx.fillStyle = 'rgb(43 45 66 / 0.18)';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.9, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.rotate(bug.heading + Math.PI / 2);
      // 虫ごとに足の動きをずらし、全員がそろって足踏みしないようにする
      const frame = flying ? 0 : Math.floor(now / 90 + bug.id * 0.37) % 2;
      stamp(ctx, body(bug.kind, frame), 0, 0, r / 0.36);
      ctx.restore();
      if (bug.kind === 'beetle') drawHp(ctx, bug, width, height, r);
    }
  }
}

/** 左右 3 本ずつの足。コマごとに、左の前と後ろ・右の中が前へ出る組と、その逆の組が入れ替わる */
function drawLegs(ctx: CanvasRenderingContext2D, r: number, frame: number) {
  ctx.strokeStyle = '#2b2d42';
  ctx.lineWidth = r * 0.11;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    for (const [i, y] of [-0.3, 0.1, 0.5].entries()) {
      const swing = ((i + (side > 0 ? 1 : 0) + frame) % 2 ? 1 : -1) * r * 0.16;
      const splay = (i - 1) * r * 0.28;
      ctx.beginPath();
      ctx.moveTo(side * r * 0.5, r * y);
      ctx.lineTo(side * r * 0.9, r * y + splay * 0.5 + swing);
      ctx.lineTo(side * r * 1.08, r * y + splay + swing * 1.4);
      ctx.stroke();
    }
    // 触角
    ctx.beginPath();
    ctx.moveTo(side * r * 0.12, -r * 0.9);
    ctx.quadraticCurveTo(side * r * 0.2, -r * 1.2, side * r * 0.48, -r * 1.28);
    ctx.stroke();
  }
}

function drawBody(ctx: CanvasRenderingContext2D, kind: BugKind, r: number) {
  const beetle = kind === 'beetle';
  // 頭（とカブトムシの角）
  ctx.fillStyle = '#2b2d42';
  ctx.beginPath();
  ctx.arc(0, -r * 0.62, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  if (beetle) {
    ctx.beginPath();
    ctx.roundRect(-r * 0.12, -r * 1.25, r * 0.24, r * 0.6, r * 0.12);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 0.15, -r * 0.84, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  // 白いふちの甲羅。左右で色を変えて羽の合わせ目を見せる
  ctx.beginPath();
  ctx.ellipse(0, r * 0.12, r * 0.78, r * 0.86, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, r * 0.12, r * 0.66, r * 0.74, 0, 0, Math.PI * 2);
  ctx.fillStyle = beetle ? '#8a4b2a' : '#3b9d4a';
  ctx.fill();
  // 右半分の濃い色と合わせ目は、甲羅の楕円の中だけに塗る
  ctx.save();
  ctx.clip();
  ctx.fillStyle = beetle ? '#6e3a1f' : '#2c7d39';
  ctx.fillRect(0, r * 0.12 - r * 0.74, r * 0.66, r * 1.48);
  ctx.fillStyle = 'rgb(0 0 0 / 0.18)';
  ctx.fillRect(-r * 0.03, r * 0.12 - r * 0.74, r * 0.06, r * 1.48);
  ctx.restore();
}

/** 残り回数は回さずに描く */
function drawHp(ctx: CanvasRenderingContext2D, bug: Bug, width: number, height: number, r: number) {
  ctx.save();
  ctx.font = `800 ${Math.round(r * 0.8)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(3, r * 0.18);
  ctx.strokeStyle = '#2b2d42';
  ctx.fillStyle = '#fff';
  ctx.strokeText(String(bug.hp), bug.x * width, bug.y * height + r * 0.1);
  ctx.fillText(String(bug.hp), bug.x * width, bug.y * height + r * 0.1);
  ctx.restore();
}
