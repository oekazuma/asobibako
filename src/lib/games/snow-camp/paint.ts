import { emoji, label, shadow, stamp } from '$lib/fx';
import { FIRE, HUNT_BOTTOM, MONEY, TABLE, WORLD_H, WORLD_W, type GameState, type Pad, type PadId } from './engine';
import { fireGlow, pine } from './sprites';

const PAD_ICON: Record<PadId, string> = { bag: '🎒', power: '🗡️', fire: '🔥', home: '🏠' };

/** 木の位置は毎回同じにする。キャンプと狩り場の真ん中は空けておく */
const TREES = Array.from({ length: 30 }, (_, i) => {
  const x = ((i * 0.6180339) % 1) * WORLD_W;
  const y = ((i * 0.4142135 + 0.13) % 1) * HUNT_BOTTOM;
  return { x, y, s: 0.12 + (i % 3) * 0.03 };
}).filter((t) => t.x < 0.25 || t.x > WORLD_W - 0.25 || t.y < 0.22);

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

/** 雪原の地面とキャンプの床。動かないので、大きさが変わったときだけ別の canvas に描いておく */
export function ground(ctx: CanvasRenderingContext2D) {
  const snow = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  snow.addColorStop(0, '#f4f9ff');
  snow.addColorStop(1, '#e3eefb');
  ctx.fillStyle = snow;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  // 雪の吹きだまりと、きらめき
  for (let i = 0; i < 40; i++) {
    const x = ((i * 0.7548776) % 1) * WORLD_W;
    const y = ((i * 0.5698403) % 1) * HUNT_BOTTOM;
    ctx.fillStyle = 'rgb(180 205 235 / 0.14)';
    ctx.beginPath();
    ctx.ellipse(x, y, 0.08 + (i % 4) * 0.02, 0.025, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = i % 3 ? 'rgb(255 255 255 / 0.9)' : 'rgb(170 200 240 / 0.5)';
    ctx.fillRect(((i * 0.618) % 1) * WORLD_W, ((i * 0.382 + i * 0.001) % 1) * WORLD_H, 0.006, 0.006);
  }
  const top = HUNT_BOTTOM + 0.1;
  ctx.fillStyle = '#c48a5a';
  ctx.beginPath();
  ctx.roundRect(0.05, top + 0.04, WORLD_W - 0.1, WORLD_H - top - 0.06, 0.05);
  ctx.fill();
  ctx.strokeStyle = 'rgb(120 70 30 / 0.25)';
  ctx.lineWidth = 0.004;
  for (let y = top + 0.1; y < WORLD_H - 0.04; y += 0.07) {
    ctx.beginPath();
    ctx.moveTo(0.07, y);
    ctx.lineTo(WORLD_W - 0.07, y);
    ctx.stroke();
  }
  // 柵。真ん中を狩り場への出入り口にする
  for (let x = 0.04; x < WORLD_W; x += 0.08) {
    if (Math.abs(x - WORLD_W / 2) < 0.2) continue;
    ctx.fillStyle = '#8a5a3b';
    ctx.fillRect(x - 0.012, top - 0.05, 0.024, 0.08);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x, top - 0.05, 0.016, 0.008, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#a0704b';
  ctx.fillRect(0, top - 0.025, WORLD_W / 2 - 0.2, 0.014);
  ctx.fillRect(WORLD_W / 2 + 0.2, top - 0.025, WORLD_W / 2 - 0.2, 0.014);
}

function pad(ctx: CanvasRenderingContext2D, p: Pad, wallet: number, now: number) {
  const home = p.id === 'home';
  const pw = home ? 0.26 : 0.2;
  const ph = home ? 0.2 : 0.15;
  // 払えるお金を持っているパッドは、呼んでいるように少し弾ませる
  const lift = wallet > 0 ? Math.abs(Math.sin(now * 4 + p.x * 3)) * 0.008 : 0;
  const [face, edge] = home ? ['#ffd45c', '#e39a00'] : ['#7cc8ff', '#1f7fd1'];
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.roundRect(p.x - pw / 2, p.y - ph / 2 + 0.014, pw, ph, 0.03);
  ctx.fill();
  const g = ctx.createLinearGradient(0, p.y - ph / 2, 0, p.y + ph / 2);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.25, face);
  g.addColorStop(1, face);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(p.x - pw / 2, p.y - ph / 2 - lift, pw, ph, 0.03);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.006;
  ctx.stroke();
  ctx.fillStyle = 'rgb(255 255 255 / 0.5)';
  ctx.fillRect(p.x - pw / 2 + 0.02, p.y + ph / 2 - 0.035 - lift, pw - 0.04, 0.016);
  ctx.fillStyle = home ? '#ff8a00' : '#0b6fcc';
  ctx.fillRect(p.x - pw / 2 + 0.02, p.y + ph / 2 - 0.035 - lift, ((pw - 0.04) * p.paid) / p.cost, 0.016);
  emoji(ctx, PAD_ICON[p.id], p.x, p.y - 0.03 - lift, home ? 0.09 : 0.065);
  label(ctx, `💰${p.cost - p.paid}`, p.x, p.y + 0.028 - lift, 0.034, '#2b2d42');
  if (p.level > 0 && !home) label(ctx, `Lv${p.level + 1}`, p.x + pw / 2 - 0.02, p.y - ph / 2 - lift, 0.03, '#0b6fcc');
}

/** ctx は画面のピクセル。bg は ground() を cam.scale で描いたもの */
export function paint(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
  cam: Camera,
  bg: HTMLCanvasElement | undefined,
  now: number,
  moving: boolean
) {
  ctx.save();
  ctx.translate(w / 2 - cam.x * cam.scale, h / 2 - cam.y * cam.scale);
  if (bg) ctx.drawImage(bg, 0, 0, WORLD_W * cam.scale, WORLD_H * cam.scale);
  ctx.scale(cam.scale, cam.scale);

  for (const p of state.pads) pad(ctx, p, state.wallet, now);

  ctx.fillStyle = '#8a5a3b';
  ctx.beginPath();
  ctx.roundRect(TABLE.x - 0.09, TABLE.y - 0.035, 0.18, 0.07, 0.015);
  ctx.fill();
  ctx.fillStyle = '#b07a4f';
  ctx.fillRect(TABLE.x - 0.08, TABLE.y - 0.03, 0.16, 0.02);
  for (let i = 0; i < Math.min(state.meals, 6); i++)
    emoji(ctx, '🍲', TABLE.x - 0.05 + (i % 3) * 0.05, TABLE.y - 0.012 - Math.floor(i / 3) * 0.03, 0.05);
  for (let i = 0; i < state.guests; i++) {
    const x = TABLE.x + 0.15 + i * 0.09;
    shadow(ctx, x, TABLE.y + 0.035, 0.03);
    const shiver = state.meals > 0 && i === 0 ? 0 : Math.sin(now * 40 + i) * 0.003;
    emoji(ctx, state.meals > 0 && i === 0 ? '😋' : '🥶', x + shiver, TABLE.y, 0.08);
  }

  ctx.globalCompositeOperation = 'lighter';
  const flicker = 1 + Math.sin(now * 11) * 0.05 + Math.sin(now * 17) * 0.04;
  stamp(ctx, fireGlow(), FIRE.x, FIRE.y, (0.42 + (state.cooking > 0 ? 0.12 : 0)) * flicker);
  ctx.globalCompositeOperation = 'source-over';
  emoji(ctx, '🪵', FIRE.x, FIRE.y + 0.03, 0.09);
  emoji(ctx, '🔥', FIRE.x, FIRE.y - 0.02, 0.11 * flicker + (state.cooking > 0 ? 0.02 : 0));
  if (state.cooking > 0) label(ctx, `🍖×${state.cooking}`, FIRE.x, FIRE.y - 0.12, 0.036, '#d02c3e');

  for (let i = 0; i < Math.min(state.coins, 30); i++) {
    const x = MONEY.x + ((i % 5) - 2) * 0.022;
    const y = MONEY.y + 0.02 - Math.floor(i / 5) * 0.011;
    const g = ctx.createLinearGradient(0, y - 0.008, 0, y + 0.008);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(1, '#e39a00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, 0.015, 0.008, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  label(ctx, state.coins > 0 ? `💰${state.coins}` : 'おかね', MONEY.x, MONEY.y + 0.07, 0.034, '#e39a00');

  for (const drop of state.drops) {
    shadow(ctx, drop.x, drop.y + 0.02, 0.022);
    emoji(ctx, '🍖', drop.x, drop.y - Math.abs(Math.sin(now * 5 + drop.x * 9)) * 0.008, 0.06);
  }

  // 下にあるものほど手前に描く
  const bodies: { y: number; draw: () => void }[] = [
    ...TREES.map((t) => ({ y: t.y, draw: () => stamp(ctx, pine(), t.x, t.y - t.s * 0.4, t.s) })),
    ...state.animals.map((a) => ({
      y: a.y,
      draw: () => {
        const big = a.kind === 'bear';
        const size = big ? 0.13 : 0.08;
        const bob = Math.abs(Math.sin(now * (big ? 5 : 9) + a.x * 7)) * size * 0.08;
        shadow(ctx, a.x, a.y + size * 0.42, size * 0.4);
        ctx.globalAlpha = a.flash > 0 ? 0.55 : 1;
        emoji(ctx, big ? '🐻' : '🐰', a.x, a.y - bob, size);
        ctx.globalAlpha = 1;
        if (big && a.hp < 4) {
          ctx.fillStyle = 'rgb(43 45 66 / 0.3)';
          ctx.fillRect(a.x - 0.04, a.y - size * 0.62, 0.08, 0.012);
          ctx.fillStyle = '#ff4d5e';
          ctx.fillRect(a.x - 0.04, a.y - size * 0.62, (0.08 * a.hp) / 4, 0.012);
        }
      }
    })),
    {
      y: state.hero.y,
      draw: () => {
        const { x, y } = state.hero;
        shadow(ctx, x, y + 0.045, 0.04, 0.22);
        const bob = moving ? Math.abs(Math.sin(now * 12)) * 0.012 : 0;
        for (let i = 0; i < Math.min(state.carry, 12); i++) emoji(ctx, '🍖', x, y - 0.07 - i * 0.022 - bob, 0.048);
        emoji(ctx, '🧑', x, y - bob, 0.1);
        if (state.carry >= state.cap) label(ctx, 'MAX', x, y + 0.075, 0.032, '#d02c3e');
      }
    }
  ];
  bodies.sort((a, b) => a.y - b.y).forEach((b) => b.draw());
  ctx.restore();
}
