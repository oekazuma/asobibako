import { icon, shadow, sprite, stamp } from '$lib/fx';
import type { Seg } from '$lib/segments';
import { BEE_LOOK, BEE_R, DOG_R, LINE, type GameState, type Pet, type Zone } from './engine';

const bee = (frame: 0 | 1, fast: boolean) =>
  sprite(`bee:${frame}:${fast ? 'fast' : 'normal'}`, 96, (c) => {
    // 右向き。羽は 2 枚の絵を入れ替えて羽ばたかせる
    c.fillStyle = 'rgb(220 240 255 / 0.85)';
    c.strokeStyle = 'rgb(120 150 180 / 0.6)';
    c.lineWidth = 0.02;
    const lift = frame === 0 ? -0.1 : 0.04;
    for (const dx of [-0.08, 0.06]) {
      c.beginPath();
      c.ellipse(0.46 + dx, 0.3 + lift, 0.13, 0.2, dx * 3, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    const body = c.createRadialGradient(0.45, 0.5, 0.05, 0.5, 0.56, 0.3);
    // 速いハチは橙にして見分けられるようにする。canvas の filter は iOS で重く、古い Safari では効かない
    body.addColorStop(0, fast ? '#ffd27a' : '#fff07a');
    body.addColorStop(1, fast ? '#f27200' : '#f2a900');
    c.fillStyle = body;
    c.beginPath();
    c.ellipse(0.48, 0.58, 0.3, 0.21, 0, 0, Math.PI * 2);
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = '#2b2d42';
    for (const x of [0.3, 0.45]) c.fillRect(x, 0.3, 0.07, 0.6);
    c.restore();
    c.fillStyle = '#2b2d42';
    c.beginPath();
    c.moveTo(0.16, 0.58);
    c.lineTo(0.06, 0.54);
    c.lineTo(0.16, 0.64);
    c.fill();
    c.beginPath();
    c.arc(0.7, 0.52, 0.05, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(0.71, 0.5, 0.018, 0, Math.PI * 2);
    c.fill();
  });

/** 頭は icons.ts の顔を上に重ねるので、ここでは首から下を正面向きのおすわりで描く */
const FUR = {
  dog: { fur: '#f2d2a9', dark: '#8a5a3b', belly: '#fff', collar: '#ff4d5e' },
  cat: { fur: '#ffc98a', dark: '#e8893a', belly: '#fff4e6', collar: '#4db5ff' }
};

const petBody = (kind: Pet['kind']) =>
  sprite(`pet-body:${kind}`, 128, (c) => {
    const { fur, dark, belly, collar } = FUR[kind];
    c.lineCap = 'round';
    c.strokeStyle = dark;
    c.lineWidth = kind === 'cat' ? 0.07 : 0.09;
    c.beginPath();
    if (kind === 'cat') {
      c.moveTo(0.66, 0.86);
      c.bezierCurveTo(0.95, 0.9, 0.98, 0.6, 0.86, 0.42);
    } else {
      c.moveTo(0.66, 0.78);
      c.quadraticCurveTo(0.9, 0.74, 0.86, 0.5);
    }
    c.stroke();
    c.fillStyle = fur;
    for (const x of [0.28, 0.72]) {
      c.beginPath();
      c.ellipse(x, 0.82, 0.11, 0.1, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.ellipse(0.5, 0.63, 0.22, 0.3, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = belly;
    c.beginPath();
    c.ellipse(0.5, 0.7, 0.12, 0.18, 0, 0, Math.PI * 2);
    c.fill();
    if (kind === 'cat') {
      c.strokeStyle = dark;
      c.lineWidth = 0.03;
      for (const y of [0.55, 0.66]) {
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(0.5 + side * 0.21, y);
          c.lineTo(0.5 + side * 0.14, y + 0.03);
          c.stroke();
        }
      }
    }
    c.fillStyle = belly;
    c.strokeStyle = 'rgb(43 45 66 / 0.25)';
    c.lineWidth = 0.015;
    for (const x of [0.41, 0.59]) {
      c.beginPath();
      c.ellipse(x, 0.9, 0.075, 0.05, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }
    c.fillStyle = collar;
    c.beginPath();
    c.roundRect(0.32, 0.36, 0.36, 0.06, 0.03);
    c.fill();
    c.fillStyle = '#ffc233';
    c.beginPath();
    c.arc(0.5, 0.44, 0.035, 0, Math.PI * 2);
    c.fill();
  });

/**
 * 当たりの円（半径 DOG_R、中心 pet.y）の上端に耳の先をそろえる。線はその円の上に乗るので、
 * 頭を高く描くと乗った線が耳を切ってしまう
 */
function pet(ctx: CanvasRenderingContext2D, p: Pet, state: GameState, now: number) {
  const near = !state.result && state.bees.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < DOG_R * 3);
  const mood = state.result === 'stung' ? '-hurt' : state.result === 'clear' ? '-happy' : near ? '-scared' : '';
  const x = p.x + (near ? Math.sin(now * 60) * 0.006 : 0);
  const y = p.y - (state.result === 'clear' ? Math.abs(Math.sin(now * 8 + p.x * 3)) * 0.04 : 0);
  shadow(ctx, p.x, p.y + 0.063, DOG_R * 0.9, 0.22);
  stamp(ctx, petBody(p.kind), x, y + 0.02, 0.1);
  icon(ctx, `${p.kind}${mood}`, x, y - 0.032, 0.09);
}

const hive = () =>
  sprite('hive', 128, (c) => {
    c.strokeStyle = '#8a5a3b';
    c.lineWidth = 0.05;
    c.beginPath();
    c.moveTo(0.5, 0);
    c.lineTo(0.5, 0.12);
    c.stroke();
    const layers = [0.2, 0.36, 0.52, 0.68];
    layers.forEach((y, i) => {
      const w = [0.22, 0.34, 0.38, 0.3][i];
      const g = c.createLinearGradient(0, y - 0.1, 0, y + 0.1);
      g.addColorStop(0, '#ffd166');
      g.addColorStop(1, '#e08e0b');
      c.fillStyle = g;
      c.beginPath();
      c.ellipse(0.5, y, w, 0.11, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#c47a06';
      c.lineWidth = 0.015;
      c.stroke();
    });
    c.fillStyle = '#4a2c0a';
    c.beginPath();
    c.ellipse(0.5, 0.56, 0.08, 0.06, 0, 0, Math.PI * 2);
    c.fill();
  });

/**
 * 空と遠くの丘。盤面そのもののピクセルで描く。飾りの雲は置かない（雲は線を引けない場所の印なので、
 * ただの飾りの雲があると、どの雲に引けないのかわからなくなる）
 */
export function backdrop(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#62c3ff');
  sky.addColorStop(0.7, '#d7f1ff');
  sky.addColorStop(1, '#f2fbff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b9e6a3';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.8);
  for (let x = 0; x <= w; x += w / 24) ctx.lineTo(x, h * 0.74 + Math.sin((x / w) * 7) * h * 0.03);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();
}

function platform(ctx: CanvasRenderingContext2D, seg: Seg, ground: boolean) {
  const [x1, y1, x2, y2] = seg;
  if (ground) {
    const soil = ctx.createLinearGradient(0, y1, 0, y1 + 0.4);
    soil.addColorStop(0, '#9b6b43');
    soil.addColorStop(1, '#6e4526');
    ctx.fillStyle = soil;
    ctx.fillRect(-2, y1, 5, 3);
    ctx.fillStyle = '#5cc44f';
    ctx.fillRect(-2, y1 - LINE, 5, LINE * 2.4);
    ctx.fillStyle = '#7fe06b';
    for (let x = -1; x < 2; x += 0.03) {
      ctx.beginPath();
      ctx.moveTo(x, y1 - LINE);
      ctx.lineTo(x + 0.012, y1 - LINE - 0.022);
      ctx.lineTo(x + 0.024, y1 - LINE);
      ctx.fill();
    }
    return;
  }
  ctx.lineCap = 'round';
  for (const [width, color, dy] of [
    [LINE * 2 + 0.02, '#6e4526', 0.006],
    [LINE * 2, '#9b6b43', 0],
    [LINE * 1.1, '#5cc44f', -LINE * 0.6]
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x1, y1 + dy);
    ctx.lineTo(x2, y2 + dy);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  }
}

function stroke(ctx: CanvasRenderingContext2D, state: GameState) {
  const pts = state.stroke;
  if (pts.length === 0) return;
  const path = (dx: number, dy: number) => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x + dx, pts[0].y + dy);
    for (const p of pts) ctx.lineTo(p.x + dx, p.y + dy);
    if (pts.length === 1) ctx.lineTo(pts[0].x + dx + 0.001, pts[0].y + dy);
  };
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path(0.006, 0.01);
  ctx.lineWidth = LINE * 2 + 0.01;
  ctx.strokeStyle = 'rgb(43 45 66 / 0.18)';
  ctx.stroke();
  path(0, 0);
  ctx.strokeStyle = '#fff';
  ctx.stroke();
  ctx.lineWidth = LINE * 2;
  ctx.strokeStyle = '#2b2d42';
  ctx.stroke();
  path(-0.003, -0.004);
  ctx.lineWidth = LINE * 0.5;
  ctx.strokeStyle = 'rgb(255 255 255 / 0.25)';
  ctx.stroke();
}

/** 線を引けない雲。もこもこの縁と、斜めの線で示す */
function cloudZone(ctx: CanvasRenderingContext2D, z: Zone, now: number) {
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0, 0.05);
  ctx.fillStyle = 'rgb(255 255 255 / 0.7)';
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgb(160 170 200 / 0.35)';
  ctx.lineWidth = 0.012;
  const shift = (now * 0.02) % 0.06;
  for (let x = z.x0 - (z.y1 - z.y0) + shift; x < z.x1; x += 0.06) {
    ctx.beginPath();
    ctx.moveTo(x, z.y1);
    ctx.lineTo(x + (z.y1 - z.y0), z.y0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgb(255 255 255 / 0.85)';
  for (let x = z.x0 + 0.04; x < z.x1; x += 0.08) {
    ctx.beginPath();
    ctx.arc(x, z.y0, 0.035, 0, Math.PI * 2);
    ctx.arc(x + 0.04, z.y1, 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** ctx は engine の座標（幅 1）がそのまま描ける変換にしておく */
export function paint(ctx: CanvasRenderingContext2D, state: GameState, now: number) {
  const { level } = state;
  level.walls.forEach((wall, i) => platform(ctx, wall, i === level.walls.length - 1));

  for (const z of level.noDraw) cloudZone(ctx, z, now);

  for (const h of level.hives) {
    const sway = Math.sin(now * 2 + h.x * 5) * 0.004;
    stamp(ctx, hive(), h.x + sway, h.y, 0.17);
  }

  stroke(ctx, state);

  for (const p of level.pets) pet(ctx, p, state, now);

  for (const b of state.bees) {
    const frame = Math.floor(now * 30 + b.x * 40) % 2 === 0 ? 0 : 1;
    ctx.save();
    ctx.translate(b.x, b.y);
    // 左へ飛ぶときは裏返して、上下さかさまにならないようにする
    if (b.vx < 0) ctx.scale(-1, 1);
    ctx.rotate(Math.atan2(b.vy, Math.abs(b.vx)) * 0.6);
    const look = BEE_LOOK[b.kind];
    stamp(ctx, bee(frame, b.kind === 'fast'), 0, 0, BEE_R * 3.4 * look.r);
    ctx.restore();
  }
}
