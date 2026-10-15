import { CELL, hash, obstaclesNear, type Ground } from './obstacles';
import { hasRelic } from './relics';
import type { World } from './world';

/** 暗くなる・戻るのにかける秒、前もって帯を出す秒 */
export const FADE = 1;
export const BLACKOUT_WARN = 3;
/** 明るい輪の半径（ドット）。動物のまわり、街灯の下 */
export const HERO_LIGHT = 70;
export const LAMP_LIGHT = 50;
/** 輪のふちをぼかす幅（ドット）と、暗いところの濃さ */
export const EDGE_BLUR = 12;
export const DARK = 0.85;

export interface Blackout {
  /** 次の stage.blackouts の番号 */
  next: number;
  /** 停電している残り秒 */
  left: number;
  warned: boolean;
  /** 0..1 の暗さ。left > 0 のあいだ 1 へ、そうでなければ 0 へ FADE 秒で寄る */
  dark: number;
}

export const lightsOn = (): Blackout => ({ next: 0, left: 0, warned: false, dark: 0 });

export const lightRadius = (w: World): number => (hasRelic(w, 'torch') ? HERO_LIGHT * 1.5 : HERO_LIGHT);

/** 時刻になったら停電にし、3 秒前に帯を出す。暗さの移り変わりもここで進める */
export function stepBlackout(w: World, dt: number): void {
  const s = w.blackout;
  s.left = Math.max(0, s.left - dt);
  const next = w.stage.blackouts[s.next];
  if (next && !s.warned && w.time >= next.at - BLACKOUT_WARN) {
    s.warned = true;
    w.events.push({ type: 'swarm', text: '停電だ！' });
  }
  if (next && w.time >= next.at) {
    // 途中から始まる回でも、残りの秒だけ暗くする
    s.left = Math.max(0, next.at + next.len - w.time);
    s.next += 1;
    s.warned = false;
  }
  s.dark = s.left > 0 ? Math.min(1, s.dark + dt / FADE) : Math.max(0, s.dark - dt / FADE);
}

export interface StreetLight {
  x: number;
  y: number;
}

export const LIGHT_CHANCE = 1 / 6;
const EDGE = 30;
const CLEAR = 120;

/** 祠と同じ作りで、ハッシュの種だけ別。街灯は夜の街の面にしか置かない */
export function streetLightAt(g: Ground, cx: number, cy: number): StreetLight | null {
  if (g !== 'city') return null;
  if (hash(cx * 19 + 23, cy * 37 + 5) >= LIGHT_CHANCE) return null;
  const x = cx * CELL + EDGE + hash(cx * 47 + 3, cy * 5 + 19) * (CELL - EDGE * 2);
  const y = cy * CELL + EDGE + hash(cx * 13 + 17, cy * 41 + 6) * (CELL - EDGE * 2);
  if (Math.hypot(x, y) < CLEAR || obstaclesNear(g, x, y, 12, []).length) return null;
  return { x, y };
}

export function streetLightsNear(g: Ground, x: number, y: number, r: number, out: StreetLight[]): StreetLight[] {
  out.length = 0;
  for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++)
    for (let cy = Math.floor((y - r) / CELL); cy <= Math.floor((y + r) / CELL); cy++) {
      const s = streetLightAt(g, cx, cy);
      if (s && Math.hypot(s.x - x, s.y - y) < r) out.push(s);
    }
  return out;
}
