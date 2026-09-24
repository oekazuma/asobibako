import type { Player } from '$lib/player';

/**
 * 座標は x が盤面の幅、y が高さに対する 0..1。
 * 距離と速さは高さを 1 とした単位に揃え、縦長・横長どちらでも同じ手触りにする
 */
export interface Runner {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 向いている角度（時計回り、上が 0）。止まっても最後に走った向きを保つ */
  face: number;
  /** 穴から出たばかりの残り秒。そのあいだは穴に入らない */
  tunnel: number;
}

/** 指を置いた位置が中心のスティック。ずらした向きと量で走る */
export interface Stick {
  id: number;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

export interface Finger {
  id: number;
  side: Player;
  x: number;
  y: number;
  /** 指を置いた位置。なければ初めて見た位置をスティックの中心にする */
  ox?: number;
  oy?: number;
}

export type Phase = 'ready' | 'play' | 'end';

export interface GameState {
  aspect: number;
  /** この回にネコを操るプレイヤー。もう片方がネズミ */
  cat: Player;
  round: number;
  runners: Record<Player, Runner>;
  sticks: Record<Player, Stick | null>;
  cheese: { x: number; y: number };
  /** ネコがチーズのそばに居座っている秒。GUARD_S を超えるとチーズが逃げる */
  guard: number;
  /** ネズミのときに食べたチーズの合計 */
  scores: Record<Player, number>;
  timeLeft: number;
  phase: Phase;
  /** ready と end の残り秒 */
  pause: number;
  /** end のとき、捕まって終わったか */
  caught: boolean;
  winner: Player | null;
  random: () => number;
}

export type CatMouseEvent =
  | { type: 'cheese'; player: Player }
  | { type: 'hop' }
  | { type: 'caught' }
  | { type: 'escape' }
  | { type: 'round' }
  | { type: 'go' }
  | { type: 'win'; player: Player };

export const ROUND_S = 20;
export const CAT_R = 0.065;
export const MOUSE_R = 0.04;
export const CHEESE_R = 0.035;
/** 指をこれだけずらすと全速になる */
export const STICK_R = 0.07;

/** ネコは速いが曲がりにくく、ネズミは遅いがすぐ向きを変えられる。ここがバランスのつまみ */
const CAT_SPEED = 0.56;
const CAT_ACCEL = 2.4;
const MOUSE_SPEED = 0.5;
const MOUSE_ACCEL = 12;
/** 体が少し重なるまでは捕まえたことにしない（ぎりぎりでかわせたように見せる） */
const CATCH_DIST = CAT_R + MOUSE_R * 0.4;
const READY_S = 1.8;
const END_S = 1.6;
const DEAD_ZONE = 0.012;

/**
 * 床の植木鉢。ネコもネズミも通れないが、小回りのきくネズミはまわりを回って逃げられる。
 * 穴は左右の壁にひとつずつで、ネズミだけが入れて反対の穴から出る。
 * どちらも盤面を 180 度回すと重なる位置に置き、上下のプレイヤーで有利不利が出ないようにする
 */
export const POTS = [
  { x: 0.26, y: 0.36, r: 0.075 },
  { x: 0.74, y: 0.64, r: 0.075 }
] as const;
export const HOLES = [
  { x: 0, y: 0.3 },
  { x: 1, y: 0.7 }
] as const;
/** 穴の口の高さ（半分） */
export const HOLE_R = 0.05;
const TUNNEL_S = 0.8;
/** ネコがチーズのこの距離の内側に GUARD_S 秒いると、チーズはネコから離れた場所へ逃げる。居座ってネズミに 1 点も取らせない手を封じる */
export const GUARD_R = 0.2;
export const GUARD_S = 1.5;

const other = (p: Player): Player => (p === 1 ? 2 : 1);
const dist = (state: GameState, a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot((a.x - b.x) * state.aspect, a.y - b.y);

export function createState(aspect: number, cat: Player, random: () => number = Math.random): GameState {
  const state: GameState = {
    aspect,
    cat,
    round: 1,
    runners: { 1: runner(1), 2: runner(2) },
    sticks: { 1: null, 2: null },
    cheese: { x: 0.5, y: 0.5 },
    guard: 0,
    scores: { 1: 0, 2: 0 },
    timeLeft: ROUND_S,
    phase: 'ready',
    pause: READY_S,
    caught: false,
    winner: null,
    random
  };
  placeCheese(state);
  return state;
}

/** それぞれ自分の陣地の真ん中から、相手のほうを向いて始める */
function runner(player: Player): Runner {
  return { x: 0.5, y: player === 1 ? 0.8 : 0.2, vx: 0, vy: 0, face: player === 1 ? 0 : 180, tunnel: 0 };
}

/** チーズはネズミから離れた、ネコのすぐそばでない場所に出す。見つからなければ最後の候補で妥協する */
export function placeCheese(state: GameState, awayFromCat = 0.2): void {
  const mouse = state.runners[other(state.cat)];
  const cat = state.runners[state.cat];
  const margin = 0.08;
  let spot = { x: 0.5, y: 0.5 };
  for (let i = 0; i < 30; i++) {
    spot = {
      x: margin + state.random() * (1 - margin * 2),
      y: margin + state.random() * (1 - margin * 2)
    };
    const clear = POTS.every((pot) => dist(state, spot, pot) > pot.r + CHEESE_R + 0.03);
    if (clear && dist(state, spot, mouse) > 0.35 && dist(state, spot, cat) > awayFromCat) break;
  }
  state.cheese = spot;
  state.guard = 0;
}

/** 各プレイヤーの先に置いた指だけをスティックにする。離せば、同じ陣地に残る次の指が新しいスティックになる */
export function updateSticks(state: GameState, fingers: Iterable<Finger>): void {
  const next: Record<Player, Stick | null> = { 1: null, 2: null };
  for (const f of fingers) {
    if (next[f.side]) continue;
    const before = state.sticks[f.side];
    const stick =
      before?.id === f.id
        ? { ...before, x: f.x, y: f.y }
        : { id: f.id, ox: f.ox ?? f.x, oy: f.oy ?? f.y, x: f.x, y: f.y };
    // 指を大きく動かしたら中心をついてこさせ、逆へ振ったときにすぐ向きが変わるようにする
    const dx = (stick.x - stick.ox) * state.aspect;
    const dy = stick.y - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) {
      stick.ox = stick.x - (dx / d) * (STICK_R / state.aspect);
      stick.oy = stick.y - (dy / d) * STICK_R;
    }
    next[f.side] = stick;
  }
  state.sticks = next;
}

function run(state: GameState, player: Player, dt: number) {
  const r = state.runners[player];
  const isCat = player === state.cat;
  const top = isCat ? CAT_SPEED : MOUSE_SPEED;
  const accel = isCat ? CAT_ACCEL : MOUSE_ACCEL;
  const stick = state.sticks[player];
  let wx = 0;
  let wy = 0;
  if (stick) {
    const dx = (stick.x - stick.ox) * state.aspect;
    const dy = stick.y - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > DEAD_ZONE) {
      const k = (Math.min(d, STICK_R) / STICK_R) * top;
      wx = (dx / d) * k;
      wy = (dy / d) * k;
    }
  }
  // 速さを目標へ近づける量を加速度で抑える
  const ex = wx - r.vx;
  const ey = wy - r.vy;
  const e = Math.hypot(ex, ey);
  const most = accel * dt;
  const k = e > most ? most / e : 1;
  r.vx += ex * k;
  r.vy += ey * k;
  if (Math.hypot(r.vx, r.vy) > 0.05) r.face = (Math.atan2(r.vx, -r.vy) * 180) / Math.PI;

  const rad = isCat ? CAT_R : MOUSE_R;
  r.x += (r.vx * dt) / state.aspect;
  r.y += r.vy * dt;
  const rx = rad / state.aspect;
  if (r.x < rx || r.x > 1 - rx) {
    r.x = Math.min(1 - rx, Math.max(rx, r.x));
    r.vx = 0;
  }
  if (r.y < rad || r.y > 1 - rad) {
    r.y = Math.min(1 - rad, Math.max(rad, r.y));
    r.vy = 0;
  }
  for (const pot of POTS) {
    const dx = (r.x - pot.x) * state.aspect;
    const dy = r.y - pot.y;
    const d = Math.hypot(dx, dy);
    const reach = pot.r + rad;
    if (d >= reach || d === 0) continue;
    r.x = pot.x + (dx / d) * (reach / state.aspect);
    r.y = pot.y + (dy / d) * reach;
    // 鉢に向かう速さだけ消して、ふちに沿って滑らせる
    const into = (r.vx * dx + r.vy * dy) / d;
    if (into < 0) [r.vx, r.vy] = [r.vx - (into * dx) / d, r.vy - (into * dy) / d];
  }
  r.tunnel = Math.max(0, r.tunnel - dt);
  if (isCat || r.tunnel > 0) return;
  HOLES.forEach((hole, i) => {
    const atWall = hole.x === 0 ? r.x <= rx + 0.005 : r.x >= 1 - rx - 0.005;
    if (!atWall || Math.abs(r.y - hole.y) > HOLE_R) return;
    const out = HOLES[1 - i];
    r.x = out.x === 0 ? rx + 0.01 : 1 - rx - 0.01;
    r.y = out.y;
    r.vx = (out.x === 0 ? 1 : -1) * Math.abs(r.vx);
    r.tunnel = TUNNEL_S;
  });
}

function nextRound(state: GameState, events: CatMouseEvent[]) {
  state.round += 1;
  state.cat = other(state.cat);
  state.runners = { 1: runner(1), 2: runner(2) };
  state.timeLeft = ROUND_S;
  state.phase = 'ready';
  state.pause = READY_S;
  state.caught = false;
  placeCheese(state);
  events.push({ type: 'round' });
}

function endRound(state: GameState, caught: boolean, events: CatMouseEvent[]) {
  state.phase = 'end';
  state.pause = END_S;
  state.caught = caught;
  events.push({ type: caught ? 'caught' : 'escape' });
}

/** 役を 1 回ずつ終えるたびに合計を比べる。同点なら、もう 1 回ずつ続ける */
function decide(state: GameState, events: CatMouseEvent[]) {
  const [a, b] = [state.scores[1], state.scores[2]];
  if (state.round % 2 === 0 && a !== b) {
    state.winner = a > b ? 1 : 2;
    events.push({ type: 'win', player: state.winner });
  } else nextRound(state, events);
}

export function step(state: GameState, dt: number): CatMouseEvent[] {
  const events: CatMouseEvent[] = [];
  if (state.winner !== null) return events;
  if (state.phase !== 'play') {
    state.pause -= dt;
    if (state.pause > 0) return events;
    if (state.phase === 'ready') {
      state.phase = 'play';
      events.push({ type: 'go' });
    } else decide(state, events);
    return events;
  }

  const mouse = other(state.cat);
  run(state, state.cat, dt);
  run(state, mouse, dt);

  if (dist(state, state.runners[mouse], state.cheese) < MOUSE_R + CHEESE_R) {
    state.scores[mouse] += 1;
    events.push({ type: 'cheese', player: mouse });
    // 後攻のネズミが相手の合計を超えたら、その時点で勝ちが決まる
    if (state.round % 2 === 0 && state.scores[mouse] > state.scores[state.cat]) {
      state.winner = mouse;
      events.push({ type: 'win', player: mouse });
      return events;
    }
    placeCheese(state);
  }

  const near = dist(state, state.runners[state.cat], state.cheese) < GUARD_R;
  state.guard = near ? state.guard + dt : Math.max(0, state.guard - dt);
  if (state.guard > GUARD_S) {
    placeCheese(state, 0.45);
    events.push({ type: 'hop' });
  }

  if (dist(state, state.runners[mouse], state.runners[state.cat]) < CATCH_DIST) {
    endRound(state, true, events);
    return events;
  }

  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    endRound(state, false, events);
  }
  return events;
}
