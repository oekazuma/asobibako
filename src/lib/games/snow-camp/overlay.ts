import { label } from '$lib/fx';
import { FIRE, MONEY, type GameState } from './engine';

/** 3D の上に重ねる文字。to は雪原の (x, y, 高さ) を画面の位置と倍率へ写す */
export function overlay(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  to: (x: number, y: number, z: number) => [number, number, number]
) {
  for (const pad of state.pads) {
    const home = pad.id === 'home';
    const [x, y, k] = to(pad.x, pad.y, home ? 0.27 : 0.2);
    label(ctx, `${pad.cost - pad.paid}`, x, y, k * 0.045, '#e39a00');
    if (pad.level > 0 && !home) label(ctx, `Lv${pad.level + 1}`, x, y - k * 0.045, k * 0.03, '#0b6fcc');
    const [bx, by, bk] = to(pad.x, pad.y + (home ? 0.09 : 0.07), 0.05);
    const width = bk * (home ? 0.22 : 0.16);
    ctx.fillStyle = 'rgb(255 255 255 / 0.75)';
    ctx.fillRect(bx - width / 2, by, width, bk * 0.014);
    ctx.fillStyle = home ? '#ff8a00' : '#0b6fcc';
    ctx.fillRect(bx - width / 2, by, (width * pad.paid) / pad.cost, bk * 0.014);
  }
  if (state.cooking > 0) {
    const [x, y, k] = to(FIRE.x, FIRE.y, 0.18);
    label(ctx, `やいてる ${state.cooking}`, x, y, k * 0.032, '#d02c3e');
  }
  const [mx, my, mk] = to(MONEY.x, MONEY.y, 0.07);
  label(ctx, state.coins > 0 ? `${state.coins}` : 'おかね', mx, my, mk * 0.036, '#e39a00');
  if (state.carry >= state.cap) {
    const [x, y, k] = to(state.hero.x, state.hero.y, -0.02);
    label(ctx, 'MAX', x, y, k * 0.032, '#d02c3e');
  }
}
