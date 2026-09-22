import { emoji } from '$lib/fx';
import { FIRE, HUNT_BOTTOM, MONEY, TABLE, WORLD_H, WORLD_W, type GameState, type PadId } from './engine';

const PAD_LOOK: Record<PadId, { icon: string; text: string }> = {
  bag: { icon: '🎒', text: 'もてる数' },
  power: { icon: '🗡️', text: 'つよさ' },
  fire: { icon: '🔥', text: 'やく早さ' },
  home: { icon: '🏠', text: 'いえ' }
};

/** 木の位置は毎回同じにする。キャンプと狩り場の真ん中は空けておく */
const TREES = Array.from({ length: 26 }, (_, i) => {
  const x = ((i * 0.6180339) % 1) * WORLD_W;
  const y = ((i * 0.4142135 + 0.13) % 1) * HUNT_BOTTOM;
  return { x, y, s: 0.09 + (i % 3) * 0.02 };
}).filter((t) => t.x < 0.25 || t.x > WORLD_W - 0.25 || t.y < 0.25);

export interface Effect {
  x: number;
  y: number;
  t: number;
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.font = "800 100px 'Hiragino Maru Gothic ProN', system-ui";
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 24;
  ctx.strokeStyle = '#fff';
  ctx.strokeText(s, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

/** ctx は画面のピクセル。scale は雪原の 1 がピクセルいくつか、cam は画面の真ん中に映す雪原の位置 */
export function paint(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  w: number,
  h: number,
  cam: { x: number; y: number; scale: number },
  effects: Effect[],
  now: number
) {
  ctx.save();
  ctx.translate(w / 2 - cam.x * cam.scale, h / 2 - cam.y * cam.scale);
  ctx.scale(cam.scale, cam.scale);

  ctx.fillStyle = '#eef6ff';
  ctx.fillRect(0, 0, WORLD_W, HUNT_BOTTOM + 0.1);
  ctx.fillStyle = '#fff4e2';
  ctx.fillRect(0, HUNT_BOTTOM + 0.1, WORLD_W, WORLD_H);
  // 柵。真ん中を狩り場への出入り口にする
  ctx.fillStyle = '#b07a4f';
  ctx.fillRect(0, HUNT_BOTTOM + 0.08, WORLD_W / 2 - 0.2, 0.02);
  ctx.fillRect(WORLD_W / 2 + 0.2, HUNT_BOTTOM + 0.08, WORLD_W / 2 - 0.2, 0.02);

  for (const pad of state.pads) {
    const look = PAD_LOOK[pad.id];
    const home = pad.id === 'home';
    const pw = home ? 0.26 : 0.2;
    const ph = home ? 0.2 : 0.15;
    ctx.fillStyle = home ? 'rgb(255 194 51 / 0.35)' : 'rgb(31 155 255 / 0.18)';
    ctx.strokeStyle = home ? '#e39a00' : '#1f9bff';
    ctx.lineWidth = 0.008;
    ctx.beginPath();
    ctx.roundRect(pad.x - pw / 2, pad.y - ph / 2, pw, ph, 0.03);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = home ? 'rgb(255 194 51 / 0.8)' : 'rgb(31 155 255 / 0.5)';
    ctx.fillRect(pad.x - pw / 2, pad.y + ph / 2 - 0.02, (pw * pad.paid) / pad.cost, 0.02);
    emoji(ctx, look.icon, pad.x, pad.y - 0.025, home ? 0.09 : 0.06);
    text(ctx, `💰${pad.cost - pad.paid}`, pad.x, pad.y + 0.04, 0.035, '#2b2d42');
    if (pad.level > 0 && !home)
      text(ctx, `Lv${pad.level + 1}`, pad.x + pw / 2 - 0.03, pad.y - ph / 2, 0.028, '#0b6fcc');
  }

  ctx.fillStyle = '#8a5a3b';
  ctx.fillRect(TABLE.x - 0.08, TABLE.y - 0.03, 0.16, 0.06);
  for (let i = 0; i < Math.min(state.meals, 6); i++)
    emoji(ctx, '🍲', TABLE.x - 0.05 + (i % 3) * 0.05, TABLE.y - 0.01 - Math.floor(i / 3) * 0.03, 0.045);
  for (let i = 0; i < state.guests; i++)
    emoji(ctx, state.meals > 0 && i === 0 ? '😋' : '🥶', TABLE.x + 0.14 + i * 0.09, TABLE.y, 0.08);

  emoji(ctx, '🪵', FIRE.x, FIRE.y + 0.03, 0.08);
  const flicker = 1 + Math.sin(now * 12) * 0.06 + (state.cooking > 0 ? 0.15 : 0);
  emoji(ctx, '🔥', FIRE.x, FIRE.y - 0.02, 0.1 * flicker);
  if (state.cooking > 0) text(ctx, `🍖×${state.cooking}`, FIRE.x, FIRE.y - 0.11, 0.035, '#d02c3e');

  for (let i = 0; i < Math.min(state.coins, 30); i++) {
    ctx.beginPath();
    ctx.ellipse(
      MONEY.x + ((i % 5) - 2) * 0.022,
      MONEY.y + 0.02 - Math.floor(i / 5) * 0.012,
      0.014,
      0.008,
      0,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = '#ffc233';
    ctx.fill();
    ctx.strokeStyle = '#e39a00';
    ctx.lineWidth = 0.003;
    ctx.stroke();
  }
  text(ctx, state.coins > 0 ? `💰${state.coins}` : 'おかね', MONEY.x, MONEY.y + 0.07, 0.032, '#e39a00');

  for (const drop of state.drops) emoji(ctx, '🍖', drop.x, drop.y, 0.055);

  // 下にあるものほど手前に描く
  const bodies: { y: number; draw: () => void }[] = [
    ...TREES.map((t) => ({ y: t.y, draw: () => emoji(ctx, '🌲', t.x, t.y, t.s) })),
    ...state.animals.map((a) => ({
      y: a.y,
      draw: () => {
        ctx.globalAlpha = a.flash > 0 ? 0.5 : 1;
        emoji(ctx, a.kind === 'bear' ? '🐻' : '🐰', a.x, a.y, a.kind === 'bear' ? 0.12 : 0.075);
        ctx.globalAlpha = 1;
      }
    })),
    {
      y: state.hero.y,
      draw: () => {
        const { x, y } = state.hero;
        for (let i = 0; i < Math.min(state.carry, 12); i++) emoji(ctx, '🍖', x, y - 0.07 - i * 0.022, 0.045);
        emoji(ctx, '🧑', x, y, 0.1);
        if (state.carry >= state.cap) text(ctx, 'MAX', x, y + 0.07, 0.03, '#d02c3e');
      }
    }
  ];
  bodies.sort((a, b) => a.y - b.y).forEach((b) => b.draw());

  for (const e of effects) emoji(ctx, '💥', e.x, e.y - (now - e.t) * 0.2, 0.06);
  ctx.restore();
}
