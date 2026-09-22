import { closest, pushOut, type Seg } from '$lib/segments';

/**
 * 座標は幅 1・高さ WORLD_H の固定の箱で、y は下向き。画面にはこの箱ごと拡大して収める。
 * 粒は Verlet 積分で動かし、壁・ピン・粒どうしの重なりを位置で解く
 */
export const WORLD_H = 1.4;
export const R = 0.02;
export const WALL = 0.014;
export const HERO_R = 0.065;

export type Kind = 'gold' | 'lava' | 'water' | 'rock';

export interface Pool {
  kind: Exclude<Kind, 'rock'>;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Pin {
  seg: Seg;
  /** つまみのある端。0 なら seg の始点、1 なら終点。抜くときはこちらへ引く */
  handle: 0 | 1;
}

export interface Level {
  walls: Seg[];
  pins: Pin[];
  pools: Pool[];
  hero: { x: number; y: number };
  /** クリアに要る金の割合 */
  need: number;
}

export interface Particle {
  x: number;
  y: number;
  px: number;
  py: number;
  kind: Kind;
  /** 石に触れていた時間。水が触れた面から、マグマの奥へ冷え固まっていく */
  cool: number;
}

export interface GameState {
  level: Level;
  particles: Particle[];
  pulled: boolean[];
  /** 最後にピンを抜いてからの秒。全部抜いても決まらないときの見切りに使う */
  idle: number;
  gold: number;
  /** 勇者のまわりに届いた金の粒 */
  collected: number;
  result: 'clear' | 'burned' | 'stuck' | null;
}

const SUB_DT = 1 / 240;
const GRAVITY = 2.4;
const DAMP = 0.996;
const ITERATIONS = 2;
/**
 * 床からこの高さまで落ち、勇者から横にこの距離の内側にある金を、受け取った数に数える。
 * 金は床いっぱいに広がるので、勇者のすぐそばだけを数えると足りなくなる
 */
const FLOOR_BAND = 0.3;
const ROOM = 0.42;
const STUCK_S = 5;
const COOL_S = 0.05;

export function createState(level: Level): GameState {
  const particles: Particle[] = [];
  const gap = R * 2.05;
  for (const pool of level.pools) {
    for (let y = pool.y1 - R; y >= pool.y0 + R; y -= gap) {
      for (let x = pool.x0 + R; x <= pool.x1 - R; x += gap)
        particles.push({ x, y, px: x, py: y, kind: pool.kind, cool: 0 });
    }
  }
  return {
    level,
    particles,
    pulled: level.pins.map(() => false),
    idle: 0,
    gold: particles.filter((p) => p.kind === 'gold').length,
    collected: 0,
    result: null
  };
}

/** クリアに要る金の粒の数 */
export const needed = (state: GameState) => Math.ceil(state.gold * state.level.need);

export function pull(state: GameState, index: number): boolean {
  if (state.result || state.pulled[index]) return false;
  state.pulled[index] = true;
  state.idle = 0;
  return true;
}

function solids(state: GameState): Seg[] {
  return [...state.level.walls, ...state.level.pins.filter((_, i) => !state.pulled[i]).map((pin) => pin.seg)];
}

/** 水とマグマは触れた粒どうしが石になる。それだけでは石の層が残りを隔ててしまうので、石に触れたマグマも冷えて石になる */
function react(a: Particle, b: Particle) {
  const kinds = a.kind + b.kind;
  if (kinds === 'lavawater' || kinds === 'waterlava') a.kind = b.kind = 'rock';
  else if (kinds === 'lavarock' || kinds === 'rocklava') {
    const lava = a.kind === 'lava' ? a : b;
    lava.cool += SUB_DT;
    if (lava.cool > COOL_S) lava.kind = 'rock';
  }
}

function substep(state: GameState, segs: Seg[]) {
  const ps = state.particles;
  const g = GRAVITY * SUB_DT * SUB_DT;
  for (const p of ps) {
    const vx = (p.x - p.px) * DAMP;
    const vy = (p.y - p.py) * DAMP;
    p.px = p.x;
    p.py = p.y;
    p.x += vx;
    p.y += vy + g;
  }
  const { x: hx, y: hy } = state.level.hero;
  for (let it = 0; it < ITERATIONS; it++) {
    // ponytail: 粒どうしは総当たり。面の粒は 150 個ほどなので足りる。増やすなら格子で近傍だけ見る
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i];
      for (let j = i + 1; j < ps.length; j++) {
        const b = ps[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const push = (2 * R - d) / d / 2;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
        react(a, b);
      }
    }
    for (const p of ps) {
      for (const seg of segs) {
        const out = pushOut(seg, WALL, p.x, p.y, R);
        if (out) [p.x, p.y] = out;
      }
      const hd = Math.hypot(p.x - hx, p.y - hy);
      if (hd < HERO_R + R && hd > 0) {
        if (p.kind === 'lava') state.result = 'burned';
        p.x = hx + ((p.x - hx) / hd) * (HERO_R + R);
        p.y = hy + ((p.y - hy) / hd) * (HERO_R + R);
      }
      p.x = Math.min(1 - R, Math.max(R, p.x));
      p.y = Math.min(WORLD_H - R, Math.max(R, p.y));
    }
  }
}

export function step(state: GameState, dt: number): void {
  if (state.result) return;
  const segs = solids(state);
  const n = Math.min(12, Math.round(dt / SUB_DT));
  for (let i = 0; i < n && !state.result; i++) substep(state, segs);
  if (state.result) return;
  const { x } = state.level.hero;
  state.collected = state.particles.filter(
    (p) => p.kind === 'gold' && p.y > WORLD_H - FLOOR_BAND && Math.abs(p.x - x) < ROOM
  ).length;
  if (state.collected >= needed(state)) state.result = 'clear';
  state.idle += dt;
  if (state.pulled.every(Boolean) && state.idle > STUCK_S) state.result = 'stuck';
}

/** 指から一番近い、まだ抜いていないピン。遠すぎれば -1 */
export function pinAt(state: GameState, x: number, y: number, reach = 0.07): number {
  let best = -1;
  let bestD = reach;
  state.level.pins.forEach((pin, i) => {
    if (state.pulled[i]) return;
    const [cx, cy] = closest(pin.seg, x, y);
    const d = Math.hypot(x - cx, y - cy);
    if (d < bestD) [best, bestD] = [i, d];
  });
  return best;
}
