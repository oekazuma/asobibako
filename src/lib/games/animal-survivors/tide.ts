import { nextPlacer } from './heroes';
import { hasRelic } from './relics';
import type { World } from './world';

/** にじんで広がる秒、残る秒、満ちる前に帯を出す秒 */
export const SHALLOW_GROW = 0.8;
export const SHALLOW_LIFE = 8;
export const TIDE_WARN = 3;
/** 浅瀬と墨だまりの中の自分の速さ */
export const WADE = 0.5;
/** 墨だまりと重なっても描く数と判定を増やしすぎない */
export const MAX_SHALLOWS = 24;

/** grow が 0 より大きいあいだは水がにじむ予告で、まだ遅くしない。ink は大ダコの墨だまり */
export interface Shallow {
  x: number;
  y: number;
  r: number;
  grow: number;
  life: number;
  ink: boolean;
}

export interface Tide {
  /** 次の stage.tides の番号 */
  next: number;
  /** 満ちている残り秒 */
  left: number;
  /** 次の浅瀬までの秒 */
  cd: number;
  warned: boolean;
  /** 次に置く動物を選ぶ回数（生きている動物を順に回す） */
  turn: number;
}

export const lowTide = (): Tide => ({ next: 0, left: 0, cd: 0, warned: false, turn: 0 });

export function addShallow(
  w: World,
  x: number,
  y: number,
  r: number,
  opts: { life?: number; grow?: number; ink?: boolean } = {}
): void {
  const s = { x, y, r, grow: opts.grow ?? SHALLOW_GROW, life: opts.life ?? SHALLOW_LIFE, ink: opts.ink ?? false };
  const free = w.shallows.findIndex((o) => o.life <= 0);
  if (free >= 0) w.shallows[free] = s;
  else if (w.shallows.length < MAX_SHALLOWS) w.shallows.push(s);
  else {
    let k = 0;
    for (let i = 1; i < w.shallows.length; i++) if (w.shallows[i].life < w.shallows[k].life) k = i;
    w.shallows[k] = s;
  }
}

/** 時刻になったら潮を満たし、3 秒前に帯を出す。満ちているあいだ自分のまわりに浅瀬を置く */
export function stepTide(w: World, dt: number): void {
  const s = w.tide;
  s.left = Math.max(0, s.left - dt);
  const next = w.stage.tides[s.next];
  if (next && !s.warned && w.time >= next.at - TIDE_WARN) {
    s.warned = true;
    w.events.push({ type: 'swarm', text: '潮が満ちてくる！' });
  }
  if (next && w.time >= next.at) {
    s.left = next.len;
    s.next += 1;
    s.warned = false;
    s.cd = 0;
  }
  if (s.left <= 0) return;
  s.cd -= dt;
  if (s.cd > 0) return;
  const p = nextPlacer(w, s)?.player;
  if (!p) return;
  s.cd = 0.9 + w.rand() * 0.3;
  const a = w.rand() * Math.PI * 2;
  const d = 30 + w.rand() * 60;
  addShallow(w, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 22 + w.rand() * 12);
}

/** にじみ終えた浅瀬の残りを減らす */
export function updateShallows(w: World, dt: number): void {
  for (const s of w.shallows) {
    if (s.life <= 0) continue;
    if (s.grow > 0) s.grow -= dt;
    else s.life -= dt;
  }
}

/** 自分の速さに掛ける割合。重なっても数では重ねない。敵とボスは遅くならないので、自分の移動だけが呼ぶ */
export function wadeFactor(w: World, x: number, y: number): number {
  for (const s of w.shallows)
    if (s.grow <= 0 && s.life > 0 && (x - s.x) ** 2 + (y - s.y) ** 2 < s.r * s.r)
      return hasRelic(w, 'conch') ? 1 - (1 - WADE) / 2 : WADE;
  return 1;
}
