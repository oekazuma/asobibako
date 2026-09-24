import { closest, pushOut, type Seg } from '$lib/segments';

/**
 * 座標は幅 1・高さ WORLD_H の固定の箱で、y は下向き。画面にはこの箱ごと拡大して収める。
 * 粒は Verlet 積分で動かし、壁・ピン・粒どうしの重なりを位置で解く
 */
export const WORLD_H = 1.4;
export const R = 0.02;
export const WALL = 0.014;
export const HERO_R = 0.065;
export const PRINCESS_R = 0.06;
export const MONSTER_R = 0.07;

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
  /** いれば、勇者が歩いて姫のもとへたどり着けばクリア。金は集めなくてよい */
  princess?: { x: number; y: number };
  /** 勇者へ向かって歩いてくる怪物。マグマに触れるとたおれる。全部たおさないとクリアにならない */
  monsters?: { x: number; y: number }[];
  /** クリアに要る金の割合 */
  need: number;
}

/** 壁とピンの上を歩き、落ちる体。粒とはぶつからず、粒のほうを押しのける */
export interface Walker {
  x: number;
  y: number;
  vy: number;
  r: number;
  alive: boolean;
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
  hero: Walker;
  princess: Walker | null;
  monsters: Walker[];
  particles: Particle[];
  pulled: boolean[];
  /** 最後にピンを抜いてからの秒。全部抜いても決まらないときの見切りに使う */
  idle: number;
  gold: number;
  /** 勇者のまわりに届いた金の粒 */
  collected: number;
  /** burned はマグマ、eaten は怪物にやられた */
  result: 'clear' | 'burned' | 'eaten' | 'stuck' | null;
  /** まだ進めていない時間（秒）。フレームが遅れても刻みを増やさず、余りを次に持ち越す */
  acc: number;
}

const SUB_DT = 1 / 240;
// 遅いフレームで刻みを 3 倍にすると次も遅れる。上限を超えた分は捨てて、時間のほうを遅らせる
const MAX_SUBSTEPS = 6;
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
const HERO_SPEED = 0.16;
const MONSTER_SPEED = 0.12;

const walker = (at: { x: number; y: number }, r: number): Walker => ({ x: at.x, y: at.y, vy: 0, r, alive: true });

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
    hero: walker(level.hero, HERO_R),
    princess: level.princess ? walker(level.princess, PRINCESS_R) : null,
    monsters: (level.monsters ?? []).map((m) => walker(m, MONSTER_R)),
    particles,
    pulled: level.pins.map(() => false),
    idle: 0,
    gold: particles.filter((p) => p.kind === 'gold').length,
    collected: 0,
    result: null,
    acc: 0
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
  const bodies = [state.hero, state.princess, ...state.monsters].filter((w): w is Walker => !!w?.alive);
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
      for (const w of bodies) {
        const d = Math.hypot(p.x - w.x, p.y - w.y);
        if (d >= w.r + R || d === 0) continue;
        if (p.kind === 'lava') touchLava(state, w);
        p.x = w.x + ((p.x - w.x) / d) * (w.r + R);
        p.y = w.y + ((p.y - w.y) / d) * (w.r + R);
      }
      p.x = Math.min(1 - R, Math.max(R, p.x));
      p.y = Math.min(WORLD_H - R, Math.max(R, p.y));
    }
  }
}

/** マグマは勇者と姫をやけどさせ、怪物をたおす */
function touchLava(state: GameState, w: Walker) {
  if (state.monsters.includes(w)) w.alive = false;
  else state.result = 'burned';
}

/** 目当ての x へ横に歩き、重さで落ちる。壁とまだ抜いていないピンにぶつかる。動いた横の距離を返す */
function walk(w: Walker, targetX: number | null, speed: number, segs: Seg[], dt: number): number {
  const x0 = w.x;
  w.vy += GRAVITY * dt;
  w.y += w.vy * dt;
  if (targetX !== null && Math.abs(targetX - w.x) > 0.005) w.x += Math.sign(targetX - w.x) * speed * dt;
  for (const seg of segs) {
    const out = pushOut(seg, WALL, w.x, w.y, w.r);
    if (!out) continue;
    // 上へ押し戻されたら床に立っている
    if (out[1] < w.y && w.vy > 0) w.vy = 0;
    [w.x, w.y] = out;
  }
  if (w.y > WORLD_H - w.r) [w.y, w.vy] = [WORLD_H - w.r, 0];
  w.x = Math.min(1 - w.r, Math.max(w.r, w.x));
  return Math.abs(w.x - x0);
}

const touching = (a: Walker, b: Walker) => a.alive && b.alive && Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r;

/** 勇者は姫がいれば姫へ、怪物は勇者へ歩く。怪物に触れたらやられ、姫に触れたらクリア */
function move(state: GameState, segs: Seg[], dt: number): number {
  const { hero, princess } = state;
  let moved = walk(hero, princess?.alive ? princess.x : null, HERO_SPEED, segs, dt);
  if (princess) walk(princess, null, 0, segs, dt);
  for (const m of state.monsters) if (m.alive) moved += walk(m, hero.x, MONSTER_SPEED, segs, dt);
  if (state.monsters.some((m) => touching(m, hero) || (princess && touching(m, princess)))) state.result = 'eaten';
  else if (princess && touching(hero, princess)) state.result = 'clear';
  return moved;
}

export function step(state: GameState, dt: number): void {
  if (state.result) return;
  const segs = solids(state);
  state.acc = Math.min(MAX_SUBSTEPS * SUB_DT, state.acc + dt);
  // 1/60 ÷ 1/240 は浮動小数で 4 にわずかに届かないことがあるので、少し足してから切り捨てる
  const n = Math.floor(state.acc / SUB_DT + 1e-6);
  state.acc -= n * SUB_DT;
  let moved = 0;
  for (let i = 0; i < n && !state.result; i++) {
    substep(state, segs);
    if (!state.result) moved += move(state, segs, SUB_DT);
  }
  if (state.result) return;
  const { x } = state.hero;
  state.collected = state.particles.filter(
    (p) => p.kind === 'gold' && p.y > WORLD_H - FLOOR_BAND && Math.abs(p.x - x) < ROOM
  ).length;
  const cleared = !state.princess && state.collected >= needed(state) && state.monsters.every((m) => !m.alive);
  if (cleared) state.result = 'clear';
  // 誰かが歩いているあいだは、まだ決着を見切らない
  state.idle = moved > 1e-4 ? 0 : state.idle + dt;
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
