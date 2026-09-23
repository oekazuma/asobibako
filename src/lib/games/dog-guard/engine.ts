import { closest, crosses, pushOut, type Seg } from '$lib/segments';
import { fall, makeLineBody, type Hit, type LineBody } from './line-physics';
import { fields, toward, type Field } from './nav';

/** 座標は幅 1・高さ WORLD_H の固定の箱で、y は下向き。画面にはこの箱ごと拡大して収める */
export const WORLD_H = 1.4;
export const GROUND = 1.32;
export const DOG_R = 0.06;
export const BEE_R = 0.018;
export const LINE = 0.012;
/** 犬のまわりのこの距離には線を引けない（犬ごと線で押しつぶさないため） */
const KEEP_OUT = DOG_R + 0.03;
const MIN_STEP = 0.012;
const ACCEL = 1.6;
const JITTER = 1.2;
/** ハチの道のりを引き直す間隔（秒）。落ちている線を毎フレーム数え直すと、長い面のテストが重くなる */
const REROUTE = 0.2;

export type Point = { x: number; y: number };
export type Pet = Point & { kind: 'dog' | 'cat' };
/** 線を引けない場所（雲） */
export interface Zone {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export type BeeKind = 'normal' | 'fast' | 'big';

export interface Level {
  pets: Pet[];
  hives: Point[];
  walls: Seg[];
  noDraw: Zone[];
  /** 引ける線の長さ */
  ink: number;
  bees: number;
  speed: number;
  /** 守りきる秒数と、ハチが出そろうまでの秒数 */
  duration: number;
  spawn: number;
  /** 速いハチと大きいハチの割合 */
  fast: number;
  big: number;
  /** 線を引く前に出す、その面のひとこと */
  tip: string;
}

/** ハチの種類ごとの大きさ・速さ・曲がりやすさの倍率 */
export const BEE_LOOK: Record<BeeKind, { r: number; speed: number; accel: number }> = {
  normal: { r: 1, speed: 1, accel: 1 },
  fast: { r: 0.9, speed: 1.45, accel: 1.6 },
  big: { r: 1.7, speed: 0.75, accel: 0.8 }
};

export interface Bee {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: BeeKind;
  /** 狙うペットの番号。いちばん近いペットを狙わせると、巣から遠いペットがまったく狙われない */
  target: number;
}

export interface GameState {
  level: Level;
  phase: 'draw' | 'defend' | 'done';
  /** 引いている線。指を離したあとは落ちる線の点そのもの */
  stroke: Point[];
  /** 落ちる線。指を離すまでは null */
  body: LineBody | null;
  /** ハチが当たる線の線分。線が動くのでフレームごとに作り直す */
  segs: Seg[];
  ink: number;
  /** ペットごとの、線と壁をよけた道のり。落ちる線に合わせて引き直す */
  paths: Field[];
  /** 壁だけをよけた道のり。線で閉じられたペットへも、線のそばまでは回り込ませる */
  ways: Field[];
  routed: number;
  bees: Bee[];
  spawned: number;
  time: number;
  result: 'clear' | 'stung' | null;
}

export type GuardEvent =
  | { type: 'spawn' }
  | { type: 'bump'; x: number; y: number }
  | { type: 'stung'; x: number; y: number }
  | { type: 'land'; hits: Hit[] }
  | { type: 'clear' };

// ponytail: 道のりは普通のハチの太さで数える。大きいハチは通れない隙間へ向かって押しつけるだけになる。困ったら種類ごとに道のりを持つ
const route = (level: Level, segs: readonly Seg[]) =>
  fields([...segs, ...level.walls], LINE + BEE_R, WORLD_H, level.pets);

export function createState(level: Level): GameState {
  const ways = route(level, []);
  return {
    level,
    phase: 'draw',
    stroke: [],
    body: null,
    segs: [],
    ink: level.ink,
    paths: ways,
    ways,
    routed: 0,
    bees: [],
    spawned: 0,
    time: 0,
    result: null
  };
}

/** そこに線を引いてよいか。犬のすぐまわり・雲の中・地面の中はだめ */
export function drawable(level: Level, x: number, y: number): boolean {
  if (y > GROUND) return false;
  if (level.pets.some((d) => Math.hypot(x - d.x, y - d.y) < KEEP_OUT)) return false;
  return !level.noDraw.some((z) => x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1);
}

/** 引けない場所に入った点を、いちばん近い引ける場所へ寄せる。犬のまわりは円の外、雲は近い辺、地面の中は地面の上 */
function nudge(level: Level, x: number, y: number): [number, number] {
  for (const d of level.pets) {
    const r = Math.hypot(x - d.x, y - d.y);
    if (r >= KEEP_OUT) continue;
    const [ux, uy] = r < 1e-9 ? [0, -1] : [(x - d.x) / r, (y - d.y) / r];
    // ちょうど縁の上だと丸め誤差で円の内側に入るので、わずかに外へ出す
    x = d.x + ux * KEEP_OUT * 1.0001;
    y = d.y + uy * KEEP_OUT * 1.0001;
  }
  for (const z of level.noDraw) {
    if (!(x > z.x0 && x < z.x1 && y > z.y0 && y < z.y1)) continue;
    const gaps = [x - z.x0, z.x1 - x, y - z.y0, z.y1 - y];
    const side = gaps.indexOf(Math.min(...gaps));
    if (side === 0) x = z.x0;
    else if (side === 1) x = z.x1;
    else if (side === 2) y = z.y0;
    else y = z.y1;
  }
  return [x, Math.min(y, GROUND)];
}

/**
 * 指へ向けてずらす向き（ラジアン）。まっすぐ進めないとき（指が犬の真向かい・地面ぞい）は斜めに回り込む。
 * 下へ回ると犬の円と地面のすきまに挟まって抜けられないので、上向きを先に試す
 */
const TURNS = [0, 0.5, 1, 1.5];

/**
 * last が犬の円の縁にいて、指とのあいだをその円がさえぎっていれば、円に沿って上を回る 1 歩。
 * 指へ近づく向きだけで選ぶと、円と地面のすきまに入った線は、上へ回るのに一度遠ざかれず抜けられない
 */
function aroundPet(level: Level, last: Point, x: number, y: number): [number, number] | null {
  const pet = level.pets.find((d) => {
    if (Math.hypot(last.x - d.x, last.y - d.y) > KEEP_OUT * 1.05 || Math.hypot(x - d.x, y - d.y) < KEEP_OUT)
      return false;
    const [cx, cy] = closest([last.x, last.y, x, y], d.x, d.y);
    return Math.hypot(cx - d.x, cy - d.y) < KEEP_OUT * 0.995;
  });
  if (!pet) return null;
  // y が下向きなので、角度を増やすと左から上を通って右へ回る
  const a = Math.atan2(last.y - pet.y, last.x - pet.x) + (x > pet.x ? 1 : -1) * (MIN_STEP / KEEP_OUT);
  return [pet.x + Math.cos(a) * KEEP_OUT * 1.0001, pet.y + Math.sin(a) * KEEP_OUT * 1.0001];
}

/** last から指 (x, y) へ 1 歩ぶん進めた、引ける点。進めなければ null */
function advance(level: Level, last: Point, x: number, y: number): [number, number] | null {
  const d = Math.hypot(x - last.x, y - last.y);
  if (d < MIN_STEP) return null;
  // 指が犬の円の中にあるあいだは縁で待つ。指へ寄せると円に沿って下へ垂れ、線にひげが残る
  const near = (c: Point, p: Point, k: number) => Math.hypot(p.x - c.x, p.y - c.y) < KEEP_OUT * k;
  if (level.pets.some((pet) => near(pet, { x, y }, 1) && near(pet, last, 1.05))) return null;
  const around = aroundPet(level, last, x, y);
  if (around) {
    const [nx, ny] = around;
    const ok = drawable(level, nx, ny) && !level.walls.some((w) => crosses(w, [last.x, last.y, nx, ny]));
    return ok ? around : null;
  }
  const step = d <= MIN_STEP * 2 ? d : MIN_STEP;
  const a = Math.atan2(y - last.y, x - last.x);
  const angles = TURNS.flatMap((t) => (t === 0 ? [a] : [a - t, a + t].sort((p, q) => Math.sin(p) - Math.sin(q))));
  for (const b of angles) {
    const [nx, ny] = nudge(level, last.x + Math.cos(b) * step, last.y + Math.sin(b) * step);
    const moved = Math.hypot(nx - last.x, ny - last.y);
    // 寄せた先が元の場所に戻ったり、円の反対側へ飛んだり（線が犬の上を横切る）、指から遠ざかるならほかの向きを試す
    if (moved < MIN_STEP / 4 || moved > step * 3 || Math.hypot(x - nx, y - ny) >= d) continue;
    if (!drawable(level, nx, ny)) continue;
    // 壁をまたぐ線は、落ちるときに壁と交わったまま抜けられずはじき飛ばされるので引かせない
    if (level.walls.some((w) => crosses(w, [last.x, last.y, nx, ny]))) continue;
    return [nx, ny];
  }
  return null;
}

/**
 * 指の位置へ向けて線を小刻みにのばす。指が犬のまわりや雲に入っても止めず、その縁に沿って回り込ませる
 * （線は 1 本しか引けないので、指がかすめただけで途切れるとそのまま失敗になる）。壁はまたがせずそこで止める
 */
export function addPoint(state: GameState, x: number, y: number): boolean {
  if (state.phase !== 'draw') return false;
  const { level, stroke } = state;
  if (stroke.length === 0) {
    const [px, py] = nudge(level, x, y);
    if (!drawable(level, px, py)) return false;
    stroke.push({ x: px, y: py });
    return true;
  }
  let added = false;
  for (let k = 0; k < 400 && state.ink > 0; k++) {
    const last = stroke[stroke.length - 1];
    const next = advance(level, last, x, y);
    if (!next) break;
    const moved = Math.hypot(next[0] - last.x, next[1] - last.y);
    const t = Math.min(1, state.ink / moved);
    stroke.push({ x: last.x + (next[0] - last.x) * t, y: last.y + (next[1] - last.y) * t });
    state.ink = Math.max(0, state.ink - moved);
    added = true;
  }
  return added;
}

/** 指を離したら線が落ちはじめ、ハチが出てくる。短すぎる線は引き直させる */
export function finishStroke(state: GameState): boolean {
  if (state.phase !== 'draw') return false;
  if (state.stroke.length < 2) {
    state.stroke = [];
    return false;
  }
  state.body = makeLineBody(state.stroke, state.level.walls, petBalls(state.level), LINE);
  state.stroke = state.body.pts;
  state.segs = strokeSegs(state);
  state.paths = route(state.level, state.segs);
  state.phase = 'defend';
  return true;
}

const petBalls = (level: Level) => level.pets.map((p) => ({ ...p, r: DOG_R }));

function strokeSegs(state: GameState): Seg[] {
  const segs: Seg[] = [];
  for (let i = 1; i < state.stroke.length; i++) {
    const a = state.stroke[i - 1];
    const b = state.stroke[i];
    segs.push([a.x, a.y, b.x, b.y]);
  }
  return segs;
}

function collide(bee: Bee, segs: Seg[], r: number): boolean {
  let bumped = false;
  for (const seg of segs) {
    const out = pushOut(seg, LINE, bee.x, bee.y, r);
    if (!out) continue;
    const nx = out[0] - bee.x;
    const ny = out[1] - bee.y;
    const n = Math.hypot(nx, ny) || 1;
    const dot = (bee.vx * nx + bee.vy * ny) / n;
    if (dot < 0) {
      bee.vx -= (1.6 * dot * nx) / n;
      bee.vy -= (1.6 * dot * ny) / n;
    }
    [bee.x, bee.y] = out;
    bumped = true;
  }
  return bumped;
}

/** 何匹目のハチがどの種類か。割合どおりに、面ごとに毎回同じ並びで混ぜる */
function kindOf(level: Level, i: number): BeeKind {
  const u = (i * 0.6180339 + 0.31) % 1;
  if (u < level.fast) return 'fast';
  if (u < level.fast + level.big) return 'big';
  return 'normal';
}

export function step(state: GameState, dt: number, rand: () => number = Math.random): GuardEvent[] {
  if (state.phase !== 'defend') return [];
  const events: GuardEvent[] = [];
  const { level } = state;
  state.time += dt;
  if (state.body && fall(state.body, dt, level.walls, petBalls(level), LINE)) {
    state.segs = strokeSegs(state);
    if (state.time - state.routed >= REROUTE) {
      state.paths = route(level, state.segs);
      state.routed = state.time;
    }
    if (state.body.hits.length > 0) events.push({ type: 'land', hits: state.body.hits });
  }

  const due = Math.min(level.bees, Math.ceil((state.time / level.spawn) * level.bees));
  while (state.spawned < due) {
    const hive = level.hives[state.spawned % level.hives.length];
    const kind = kindOf(level, state.spawned);
    state.bees.push({
      x: hive.x,
      y: hive.y,
      vx: (rand() - 0.5) * 0.4,
      vy: (rand() - 0.5) * 0.4,
      kind,
      target: Math.floor(state.spawned / level.hives.length) % level.pets.length
    });
    state.spawned += 1;
    events.push({ type: 'spawn' });
  }

  for (const bee of state.bees) {
    const look = BEE_LOOK[bee.kind];
    const r = BEE_R * look.r;
    const max = level.speed * look.speed;
    const dog = level.pets[bee.target];
    const dx = dog.x - bee.x;
    const dy = dog.y - bee.y;
    const d = Math.hypot(dx, dy) || 1;
    const [ux, uy] = toward(state.paths[bee.target], bee.x, bee.y) ??
      toward(state.ways[bee.target], bee.x, bee.y) ?? [dx / d, dy / d];
    bee.vx += (ux * ACCEL * look.accel + (rand() - 0.5) * JITTER) * dt;
    bee.vy += (uy * ACCEL * look.accel + (rand() - 0.5) * JITTER) * dt;
    const v = Math.hypot(bee.vx, bee.vy);
    if (v > max) {
      bee.vx *= max / v;
      bee.vy *= max / v;
    }
    // 速いハチが細い線をすり抜けないよう、3 回に分けて動かして当てる
    for (let k = 0; k < 3; k++) {
      bee.x += (bee.vx * dt) / 3;
      bee.y += (bee.vy * dt) / 3;
      const hit = collide(bee, state.segs, r);
      collide(bee, level.walls, r);
      if (hit && rand() < 0.04) events.push({ type: 'bump', x: bee.x, y: bee.y });
    }
    bee.x = Math.min(1 - r, Math.max(r, bee.x));
    bee.y = Math.min(WORLD_H - r, Math.max(r, bee.y));
    const stung = level.pets.find((g) => Math.hypot(g.x - bee.x, g.y - bee.y) < DOG_R + r);
    if (stung) {
      state.phase = 'done';
      state.result = 'stung';
      return [...events, { type: 'stung', x: stung.x, y: stung.y }];
    }
  }

  if (state.time >= level.duration) {
    state.phase = 'done';
    state.result = 'clear';
    events.push({ type: 'clear' });
  }
  return events;
}
