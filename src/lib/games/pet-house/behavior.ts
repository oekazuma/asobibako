import { kindOf, LOW, SLEEPY, TRICKS, type Pet } from './engine';
import type { Cry } from './cries';
import type { Layout, Perch, RoomLayout, Spot } from './layout';
import type { FoodId, PetAction, Scene, ToyId, TrickId } from './types';
import type { Wand } from './wand';

/**
 * ペットの頭の中（状態機械）と、投げたおもちゃの物理。DOM も three も使わない。
 * 単位はメートルと秒で、heading は 0 で +z（カメラの方）を向き、進む向きは (sin, cos)
 */

export interface Toy {
  kind: ToyId;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** 咥えている Pet.id */
  holder: string | null;
  still: boolean;
}

export interface WorldView {
  scene: Scene;
  layout: Layout;
  /** 0..1。部屋だけ */
  bowls: { food: FoodId | null; foodLeft: number; waterLeft: number };
  toy: Toy | null;
  /** ねこじゃらしのふさ（y は床からの高さ）。指で動かしているあいだだけ。rig は描くための揺れ */
  wand: { x: number; z: number; y?: number; moving: boolean; rig?: Wand } | null;
  presents: { id: number; x: number; z: number }[];
  /** 画面で選んでいるペット。ほかの子はカメラのすぐ前（front のまわり）に居座らない */
  current?: string;
  /** 部屋のソファとベッドの面。テーマで高さと広さが変わるので、毎フレーム id で引き直す */
  perches?: Perch[];
}

type Mode = 'idle' | 'go' | 'eat' | 'drink' | 'sleep' | 'chase' | 'carry' | 'stalk' | 'pounce' | 'act' | 'held' | 'hop';
type Goal = 'wander' | 'food' | 'water' | 'bed' | 'front' | 'spot' | 'present' | 'beg' | 'perch';

/** 飛び乗り・飛び降り。着いたら then の動きに戻る。under は影を落とす面の高さ */
interface Hop {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
  /** 向きを変え終えてからの秒。負のあいだは行く先へ向きを変えている */
  k: number;
  onto: Perch['id'] | null;
  then: { mode: Mode; pose: PetAction; t: number };
  under: number;
  air: boolean;
}

export interface Actor {
  petId: string;
  x: number;
  z: number;
  /** 床からの高さ。ソファやベッドの上ではその面の高さ */
  y: number;
  /** 乗っている面。飛んでいるあいだは飛び立った面のまま */
  perch: Perch['id'] | null;
  /** goal 'perch' の行き先と、着いたらすること */
  seat: { id: Perch['id']; then: 'call' | 'sit' | 'down' | 'sleep' } | null;
  hop: Hop | null;
  heading: number;
  action: PetAction;
  /** 足の振りの速さ 0..1 */
  speed: number;
  /** しっぽ 0..1 */
  wag: number;
  /** 首の左右 -1..1 */
  look: number;
  carrying: ToyId | null;
  /** 寝ているあいだ true。画面はこのあいだ engine の rest() でげんきを戻す */
  asleep: boolean;
  mode: Mode;
  goal: Goal;
  /** いまの動きの残り秒 */
  t: number;
  tx: number;
  tz: number;
  /** 進む速さ m/s。向きを変えながら加減速するので、目標の速さとは別に持つ */
  v: number;
  /** 止まっているときのかっこう */
  pose: PetAction;
  /** 目で追う点 */
  gaze: Spot | null;
  /** act のあいだ首をかしげる（芸の失敗） */
  puzzled: boolean;
  /** 芸を見せるあいだはカメラの方を向く */
  show: boolean;
  /** 向きを変えている速さ rad/s。その場で回るときも足を動かすのに使う */
  spin: number;
  next: 'idle' | 'carry' | 'stalk';
  aim: 'wand' | 'toy';
  present: number | null;
  /** 追うかどうかをもう決めたおもちゃ。投げるたびに新しい Toy になる */
  seen: Toy | null;
  /** ねこじゃらしで遊ぶか。指を離すと null に戻って次に振られたとき決め直す */
  wandPlay: boolean | null;
  /** 起こされてから、また眠くなるまでの秒 */
  awake: number;
  bark: number;
  clock: number;
  queue: BehaviorEvent[];
}

export type Command =
  /** to があれば front ではなくその点へ来る（床をタップして呼ぶ）。perch があればその面の上の to へ飛び乗る */
  | { type: 'call'; to?: Spot; perch?: Perch['id'] }
  | { type: 'trick'; trick: TrickId; success: boolean }
  | { type: 'stroke' }
  | { type: 'brush' }
  | { type: 'wake' };

export type BehaviorEvent =
  | { type: 'ate'; petId: string; food: FoodId }
  | { type: 'drank'; petId: string }
  | { type: 'fetched'; petId: string }
  | { type: 'caught'; petId: string }
  /** 飛びかかった瞬間 */
  | { type: 'leap'; petId: string }
  | { type: 'found'; petId: string; present: number }
  /** cry が無ければ、そのときの気分（おなか・のど・ねむけ）で鳴き方を決める */
  | { type: 'voice'; petId: string; cry?: Cry }
  | { type: 'sleep'; petId: string }
  | { type: 'wake'; petId: string };

const G = 9.8;
/** 地面に触れている高さ（半径）・弾み・転がりの減り（1/秒）・空気で浮く強さ */
const TOY: Record<ToyId, { r: number; bounce: number; roll: number; lift: number }> = {
  ball: { r: 0.05, bounce: 0.55, roll: 0.7, lift: 0 },
  frisbee: { r: 0.015, bounce: 0.05, roll: 5, lift: 2.6 },
  mouse: { r: 0.03, bounce: 0.2, roll: 1.1, lift: 0 },
  wand: { r: 0.03, bounce: 0, roll: 5, lift: 0 }
};

const BODY = 0.16;
const GAP = 0.34;
const WALK = { dog: 0.45, cat: 0.35 };
const RUN = { dog: 1.5, cat: 1.3 };
const MOUTH = { dog: 0.29, cat: 0.21 };
/** 寝ているところから起きる、げんきの高さ */
const RESTED = 90;
/** 自分からお皿へ行く目安。子どもが入れたらすぐ食べに行くよう高めにしてある */
const PECKISH = 80;
const THIRSTY = 70;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const dist = (a: Spot, b: Spot) => Math.hypot(a.x - b.x, a.z - b.z);
const angleTo = (a: Spot, b: Spot) => Math.atan2(b.x - a.x, b.z - a.z);
const between = (rng: () => number, a: number, b: number) => a + (b - a) * rng();
const isRoom = (l: Layout): l is RoomLayout => 'bed' in l;
/** 選ばれていない子が入らない、カメラのすぐ前の帯。ここにいると奥の子に重なって画面をふさぐ */
const FRONT_BAND = 0.5;
const aside = (a: Actor, c: Ctx) =>
  c.world.current !== undefined && a.petId !== c.world.current && a.z > c.world.layout.front.z - FRONT_BAND;
/** 止めたねこじゃらしを身をかがめて見つめる秒。過ぎたら寄って飛びつく */
const CROUCH = 1.5;
/** ふさがこれより高いと、かがまずに前足で打つか跳びつく */
const HIGH = 0.2;
/** ねずみのおもちゃの前で、身をかがめてから前足でちょいちょいし、跳ぶまでの秒 */
const MOUSE_PLAY = 1.7;

export function createActor(pet: Pet, at: Spot): Actor {
  return {
    petId: pet.id,
    x: at.x,
    z: at.z,
    y: 0,
    perch: null,
    seat: null,
    hop: null,
    heading: 0,
    action: 'stand',
    speed: 0,
    wag: 0.3,
    look: 0,
    carrying: null,
    asleep: false,
    mode: 'idle',
    goal: 'wander',
    t: 1,
    tx: at.x,
    tz: at.z,
    v: 0,
    pose: 'stand',
    gaze: null,
    puzzled: false,
    show: false,
    spin: 0,
    next: 'idle',
    aim: 'toy',
    present: null,
    seen: null,
    wandPlay: null,
    awake: 0,
    bark: 12,
    clock: 0,
    queue: []
  };
}

function act(a: Actor, pose: PetAction, t: number, next: Actor['next'] = 'idle', puzzled = false) {
  a.mode = 'act';
  a.pose = pose;
  a.t = t;
  a.next = next;
  a.puzzled = puzzled;
  a.show = false;
}

function wakeUp(a: Actor) {
  if (!a.asleep) return;
  a.asleep = false;
  a.awake = 30;
  a.queue.push({ type: 'wake', petId: a.petId });
  a.mode = 'idle';
  a.pose = 'stand';
  a.t = 1;
}

export function command(actor: Actor, pet: Pet, cmd: Command): void {
  const hop = actor.hop;
  apply(actor, cmd);
  // 跳んでいるあいだの言いつけは、着いてからの動きにする
  if (hop && actor.mode !== 'hop') {
    hop.then = { mode: actor.mode, pose: actor.pose, t: actor.t };
    actor.mode = 'hop';
  }
}

function apply(a: Actor, cmd: Command) {
  if (cmd.type === 'wake') return wakeUp(a);
  if (a.mode === 'eat' || a.mode === 'drink') return;
  if (cmd.type === 'stroke' || cmd.type === 'brush') {
    // 寝ているあいだはなでても起きない
    if (a.asleep) return;
    if (a.mode !== 'held') a.next = a.carrying ? 'carry' : 'idle';
    a.mode = 'held';
    a.pose = cmd.type === 'stroke' ? 'happy' : 'stand';
    a.t = 0.6;
    return;
  }
  if (cmd.type === 'call') {
    wakeUp(a);
    if (a.carrying) return;
    a.mode = 'go';
    a.goal = cmd.perch ? 'perch' : cmd.to ? 'spot' : 'front';
    if (cmd.perch) a.seat = { id: cmd.perch, then: 'call' };
    const to = cmd.to ?? a;
    [a.tx, a.tz] = [to.x, to.z];
    a.t = 15;
    return;
  }
  if (a.asleep || a.carrying) return;
  const trick = TRICKS.find((t) => t.id === cmd.trick);
  if (cmd.success && trick) act(a, trick.action, 1.6);
  else act(a, 'stand', 1.3, 'idle', true);
  a.show = true;
  a.gaze = null;
}

export function throwToy(
  kind: ToyId,
  from: { x: number; y: number; z: number },
  v: { x: number; y: number; z: number }
): Toy {
  return {
    kind,
    x: from.x,
    y: Math.max(from.y, TOY[kind].r),
    z: from.z,
    vx: v.x,
    vy: v.y,
    vz: v.z,
    holder: null,
    still: false
  };
}

function moveToy(toy: Toy, layout: Layout, dt: number) {
  if (toy.holder || toy.still) return;
  const c = TOY[toy.kind];
  const hs = Math.hypot(toy.vx, toy.vz);
  if (toy.y > c.r + 0.001) {
    // フリスビーは速く飛んでいるあいだ空気に支えられ、ゆっくり落ちる
    toy.vy -= (G - Math.min(G * 0.8, c.lift * hs)) * dt;
    const drag = Math.exp(-(c.lift ? 0.25 : 0.08) * dt);
    toy.vx *= drag;
    toy.vz *= drag;
  } else {
    const f = Math.exp(-c.roll * dt) * Math.max(0, 1 - (0.2 * dt) / Math.max(hs, 1e-6));
    toy.vx *= f;
    toy.vz *= f;
  }
  toy.x += toy.vx * dt;
  toy.y += toy.vy * dt;
  toy.z += toy.vz * dt;
  if (toy.y <= c.r) {
    toy.y = c.r;
    if (toy.vy < 0) {
      toy.vy = -toy.vy * c.bounce;
      if (toy.vy < 0.4) toy.vy = 0;
      toy.vx *= 0.85;
      toy.vz *= 0.85;
    }
  }
  const b = layout.bounds;
  if (toy.x < b.x0 || toy.x > b.x1) {
    toy.x = clamp(toy.x, b.x0, b.x1);
    toy.vx *= -0.3;
  }
  if (toy.z < b.z0 || toy.z > b.z1) {
    toy.z = clamp(toy.z, b.z0, b.z1);
    toy.vz *= -0.3;
  }
  for (const k of layout.blocks) {
    const d = dist(toy, k);
    if (d >= k.r || d === 0) continue;
    const nx = (toy.x - k.x) / d;
    const nz = (toy.z - k.z) / d;
    toy.x = k.x + nx * k.r;
    toy.z = k.z + nz * k.r;
    const dot = toy.vx * nx + toy.vz * nz;
    if (dot < 0) {
      toy.vx -= 1.4 * dot * nx;
      toy.vz -= 1.4 * dot * nz;
    }
  }
  if (toy.y <= c.r && toy.vy === 0 && Math.hypot(toy.vx, toy.vz) < 0.04) {
    toy.still = true;
    toy.vx = toy.vz = 0;
  }
}

/** 追いかける先。飛んでいれば落ちる所、転がっていれば少し先 */
function toyGoal(toy: Toy, layout: Layout): Spot {
  if (toy.y <= TOY[toy.kind].r + 0.001) return { x: toy.x + toy.vx * 0.4, z: toy.z + toy.vz * 0.4 };
  const ghost = { ...toy };
  for (let i = 0; i < 180 && ghost.y > TOY[toy.kind].r + 0.001; i++) moveToy(ghost, layout, 1 / 60);
  return ghost;
}

/** ブロックが行く手をふさいでいれば、その脇を通る点を返す */
function around(a: Actor, tx: number, tz: number, layout: Layout): Spot {
  const dx = tx - a.x;
  const dz = tz - a.z;
  const len2 = dx * dx + dz * dz;
  let best: Spot = { x: tx, z: tz };
  let first = 1;
  for (const k of layout.blocks) {
    const s = len2 ? ((k.x - a.x) * dx + (k.z - a.z) * dz) / len2 : 0;
    if (s <= 0 || s >= first) continue;
    const cx = a.x + dx * s - k.x;
    const cz = a.z + dz * s - k.z;
    const need = k.r + BODY + 0.08;
    const d = Math.hypot(cx, cz);
    if (d >= need) continue;
    // ちょうど真ん中に向かっているときは右へよける
    const [nx, nz] = d > 1e-3 ? [cx / d, cz / d] : [dz / Math.sqrt(len2), -dx / Math.sqrt(len2)];
    first = s;
    best = { x: k.x + nx * need * 1.15, z: k.z + nz * need * 1.15 };
  }
  return best;
}

function accelerate(a: Actor, target: number, dt: number) {
  a.v += clamp(target - a.v, -4 * dt, 2.8 * dt);
}

function turn(a: Actor, want: number, dt: number): number {
  const diff = wrap(want - a.heading);
  const rate = 3 + 4 * clamp(a.v / 1.5, 0, 1);
  const step = clamp(diff, -rate * dt, rate * dt);
  a.heading = wrap(a.heading + step);
  a.spin = dt > 0 ? Math.abs(step) / dt : 0;
  return Math.abs(wrap(want - a.heading));
}

/** 目標へ向きを変えながら進む。止まるべき所まで来たら true */
function steer(a: Actor, target: Spot, maxV: number, dt: number, layout: Layout, arrive = 0.08): boolean {
  const d = dist(a, target);
  if (d < arrive) {
    accelerate(a, 0, dt);
    return true;
  }
  // 面の上はソファの当たりの丸の中にあるので、よけずにまっすぐ進む
  const way = a.perch ? target : around(a, target.x, target.z, layout);
  const diff = wrap(angleTo(a, way) - a.heading);
  turn(a, angleTo(a, way), dt);
  // 大きく向きを変えるあいだは足を緩め、その場で回りこむ
  accelerate(a, Math.min(maxV, d * 2.2 + 0.08) * Math.max(0, Math.cos(diff)), dt);
  return false;
}

function collide(a: Actor, layout: Layout, actors: Actor[], perch: Perch | undefined) {
  if (a.hop) return;
  for (const k of perch ? [] : layout.blocks) {
    const need = k.r + BODY;
    const d = dist(a, k);
    if (d >= need) continue;
    const [nx, nz] = d > 1e-6 ? [(a.x - k.x) / d, (a.z - k.z) / d] : [0, 1];
    a.x = k.x + nx * need;
    a.z = k.z + nz * need;
  }
  if (!a.asleep) {
    for (const o of actors) {
      // ソファの上の子と床の子は高さが違うので重なってよい
      if (o === a || o.hop || Math.abs(o.y - a.y) > 0.2) continue;
      const d = dist(a, o);
      if (d >= GAP) continue;
      const [nx, nz] = d > 1e-6 ? [(a.x - o.x) / d, (a.z - o.z) / d] : [1, 0];
      const push = (GAP - d) * (o.asleep ? 1 : 0.5);
      a.x += nx * push;
      a.z += nz * push;
    }
  }
  if (perch) {
    a.x = clamp(a.x, perch.x - perch.w, perch.x + perch.w);
    a.z = clamp(a.z, perch.z - perch.d, perch.z + perch.d);
    return;
  }
  const b = layout.bounds;
  a.x = clamp(a.x, b.x0, b.x1);
  a.z = clamp(a.z, b.z0, b.z1);
  // 範囲に戻すとブロックへめりこむことがあるので、もう一度外へ出してから範囲に収める。
  // 角で両方を満たせないときは、壁の外に立つより家具の端に重なるほうが目立たない
  for (const k of layout.blocks) {
    const d = dist(a, k);
    if (d < k.r + BODY && d > 1e-6) {
      a.x = k.x + ((a.x - k.x) / d) * (k.r + BODY);
      a.z = k.z + ((a.z - k.z) / d) * (k.r + BODY);
    }
  }
  a.x = clamp(a.x, b.x0, b.x1);
  a.z = clamp(a.z, b.z0, b.z1);
}

interface Ctx {
  pet: Pet;
  dog: boolean;
  world: WorldView;
  actors: Actor[];
  rng: () => number;
  events: BehaviorEvent[];
  camera: Spot;
}

export const eats = (dog: boolean, food: FoodId | null) => food === 'treat' || food === (dog ? 'dogfood' : 'catfood');

/** お皿の横に立つ位置。横から食べるとカメラから顔が見える */
function besideBowl(bowl: Spot, layout: Layout): Spot {
  const mid = (layout.bounds.x0 + layout.bounds.x1) / 2;
  return { x: bowl.x + (bowl.x > mid ? -0.25 : 0.25), z: bowl.z };
}

function wanderSpot(a: Actor, c: Ctx): Spot {
  const b = c.world.layout.bounds;
  const reach = c.world.scene === 'park' ? 3 : 2;
  let p: Spot = { x: a.x, z: a.z };
  for (let i = 0; i < 6; i++) {
    p = {
      x: clamp(a.x + between(c.rng, -reach, reach), b.x0, b.x1),
      z: clamp(a.z + between(c.rng, -reach, reach), b.z0, b.z1)
    };
    const free =
      c.world.layout.blocks.every((k) => dist(p, k) > k.r + BODY + 0.1) &&
      c.actors.every((o) => o === a || dist(p, { x: o.tx, z: o.tz }) > GAP * 1.5);
    if (free && !aside({ ...a, ...p }, c)) break;
  }
  if (aside({ ...a, ...p }, c)) p.z = c.world.layout.front.z - FRONT_BAND - between(c.rng, 0.3, 0.9);
  return p;
}

function go(a: Actor, goal: Goal, to: Spot) {
  a.mode = 'go';
  a.goal = goal;
  a.tx = to.x;
  a.tz = to.z;
  // 先に誰かが座っていると着けないことがあるので、いつかはあきらめる
  a.t = 15;
}

/** おなか・のど・眠気・おもちゃ・プレゼントのうち、いま始めるものがあれば始めて true */
function needs(a: Actor, c: Ctx): boolean {
  const { pet, world, actors } = c;
  const s = pet.stats;
  const room = isRoom(world.layout) ? world.layout : null;
  const busy = (goal: Goal, mode: Mode) =>
    actors.some((o) => o !== a && ((o.mode === 'go' && o.goal === goal) || o.mode === mode));
  if (s.energy < SLEEPY && a.awake <= 0) {
    const bed = room && nest(a, c);
    if (bed) goPerch(a, c, bed, 'sleep');
    else if (room) {
      const i = actors.filter((o) => o !== a && o.asleep).length;
      go(a, 'bed', { x: room.bed.x + i * 0.35, z: room.bed.z + i * 0.2 });
    } else fallAsleep(a, c);
    return true;
  }
  if (room) {
    const hungry = s.food < PECKISH && world.bowls.foodLeft > 0.05 && eats(c.dog, world.bowls.food);
    const thirsty = s.water < THIRSTY && world.bowls.waterLeft > 0.05;
    if (hungry && (!thirsty || s.food <= s.water) && !busy('food', 'eat')) {
      go(a, 'food', besideBowl(room.food, room));
      return true;
    }
    if (thirsty && !busy('water', 'drink')) {
      go(a, 'water', besideBowl(room.water, room));
      return true;
    }
  }
  const toy = world.toy;
  if (toy && !toy.holder && a.seen !== toy) {
    a.seen = toy;
    const chasing = actors.some((o) => o.mode === 'chase' || o.mode === 'carry');
    // ねずみは猫のおもちゃなので、犬はときどきしか追わない（追うと先に咥えて猫の出番がなくなる）
    const want = c.dog
      ? toy.kind !== 'wand' &&
        (!toy.still || dist(toy, world.layout.front) > 0.5) &&
        (toy.kind !== 'mouse' || c.rng() < 0.3)
      : toy.kind === 'mouse' || (!toy.still && c.rng() < { mouse: 1, ball: 0.3, frisbee: 0.1, wand: 0 }[toy.kind]);
    if (want && !chasing) {
      a.mode = 'chase';
      a.t = 12;
      return true;
    }
  }
  const wand = world.wand;
  if (wand?.moving && a.wandPlay === null) a.wandPlay = c.rng() < (c.dog ? 0.4 : 0.95);
  if (wand && a.wandPlay) {
    a.mode = 'stalk';
    a.t = CROUCH;
    return true;
  }
  const sense = c.dog ? 1.8 : 1;
  const near = world.presents.find(
    (p) => dist(a, p) < sense && !actors.some((o) => o !== a && o.mode === 'go' && o.present === p.id)
  );
  if (near) {
    a.present = near.id;
    go(a, 'present', near);
    return true;
  }
  return false;
}

function fallAsleep(a: Actor, c: Ctx) {
  a.mode = 'sleep';
  a.asleep = true;
  a.pose = 'sleep';
  a.gaze = null;
  c.events.push({ type: 'sleep', petId: a.petId });
}

const perchOf = (w: WorldView, id: Perch['id'] | null) => (id ? w.perches?.find((p) => p.id === id) : undefined);
/** 飛び乗る前に立つ、面の前の床の点までの距離。ソファの当たりの丸の外になる */
const REACH = 0.5;
const inside = (p: Perch, at: Spot): Spot => ({
  x: clamp(at.x, p.x - p.w, p.x + p.w),
  z: clamp(at.z, p.z - p.d, p.z + p.d)
});
/** その面に乗っている・乗りに行く・跳んでいるほかの子の数と、乗れる数 */
const crowd = (p: Perch, a: Actor, c: Ctx) =>
  c.actors.filter(
    (o) =>
      o !== a &&
      (o.perch === p.id || o.hop?.onto === p.id || (o.mode === 'go' && o.goal === 'perch' && o.seat?.id === p.id))
  ).length;
const seats = (p: Perch) => Math.floor((2 * p.w) / GAP) + 1;

/** 眠いときに寝る面。乗っていればそこで、なければ空いているベッドかソファ。猫は高いソファをよく選ぶ */
function nest(a: Actor, c: Ctx): Perch | undefined {
  const here = perchOf(c.world, a.perch);
  if (here) return here;
  const free = (c.world.perches ?? []).filter((p) => crowd(p, a, c) < seats(p));
  const sofa = free.find((p) => p.id === 'sofa');
  const bed = free.find((p) => p.id === 'bed');
  return sofa && (!bed || c.rng() < (c.dog ? 0.25 : 0.5)) ? sofa : bed;
}

function goPerch(a: Actor, c: Ctx, p: Perch, then: NonNullable<Actor['seat']>['then'], at?: Spot) {
  const spot =
    at ?? (a.perch === p.id ? a : { x: between(c.rng, p.x - p.w, p.x + p.w), z: between(c.rng, p.z - p.d, p.z + p.d) });
  a.seat = { id: p.id, then };
  go(a, 'perch', spot);
}

function startHop(a: Actor, to: Spot & { y: number }, onto: Perch['id'] | null) {
  a.hop = {
    x0: a.x,
    y0: a.y,
    z0: a.z,
    x1: to.x,
    y1: to.y,
    z1: to.z,
    k: -1,
    onto,
    then: { mode: a.mode, pose: a.pose, t: a.t },
    under: a.y,
    air: false
  };
  a.mode = 'hop';
}

/** 床でしかできない動き。面の上でこれになったら、先に飛び降りる */
const grounded = (a: Actor) =>
  a.mode === 'go'
    ? a.goal !== 'perch' || a.seat?.id !== a.perch
    : a.mode === 'act'
      ? a.pose === 'jump' || a.pose === 'roll'
      : a.mode === 'chase' ||
        a.mode === 'carry' ||
        a.mode === 'stalk' ||
        a.mode === 'pounce' ||
        a.mode === 'eat' ||
        a.mode === 'drink';

/** 乗るときだけ、見上げて身をかがめる秒 */
const HOP_CROUCH = 0.35;
/** jump のかっこうの 1 回の秒と、そのうち宙にいる割合（pose.ts の jump と合わせる） */
const HOP = { time: 0.95, up: 0.15, down: 0.7 };

function hopping(a: Actor, h: Hop, c: Ctx, dt: number) {
  if (h.k < 0) {
    a.pose = 'stand';
    if (!faceThen(a, angleTo(a, { x: h.x1, z: h.z1 }), dt)) return;
    [h.k, h.x0, h.z0, a.v] = [0, a.x, a.z, 0];
  }
  h.k += dt;
  const crouch = h.y1 > h.y0 ? HOP_CROUCH : 0;
  if (h.k < crouch) return void (a.pose = 'pounce');
  a.pose = 'jump';
  const u = (h.k - crouch) / HOP.time;
  const s = clamp((u - HOP.up) / (HOP.down - HOP.up), 0, 1);
  if (s > 0 && !h.air) {
    h.air = true;
    c.events.push({ type: 'leap', petId: a.petId });
  }
  // 横は等速、高さは放物線。jump のかっこうが自分でも跳ねるぶん、弧は低めでよい
  a.x = h.x0 + (h.x1 - h.x0) * s;
  a.z = h.z0 + (h.z1 - h.z0) * s;
  a.y = h.y0 + (h.y1 - h.y0) * s + (h.y1 > h.y0 ? 0.5 : 0.2) * s * (1 - s);
  h.under = s < 0.5 ? h.y0 : h.y1;
  if (u < 1) return;
  a.hop = null;
  a.perch = h.onto;
  a.y = h.y1;
  [a.mode, a.pose, a.t] = [h.then.mode, h.then.pose, h.then.t];
}

/** goal 'perch'。床にいれば面の前まで歩いて飛び乗り、面の上ではその点まで歩いて落ち着く */
function toPerch(a: Actor, c: Ctx, dt: number, speed: number) {
  const seat = a.seat;
  const p = seat && perchOf(c.world, seat.id);
  if (!seat || !p) return decide(a, c);
  const to = inside(p, { x: a.tx, z: a.tz });
  if (a.perch !== p.id) {
    if (!steer(a, { x: to.x, z: p.z + p.d + REACH }, speed, dt, c.world.layout)) return;
    return startHop(a, { ...to, y: p.y }, p.id);
  }
  if (!steer(a, to, WALK.cat * 0.6, dt, c.world.layout, 0.05)) return;
  if (!faceThen(a, angleTo(a, c.camera), dt)) return;
  a.mode = 'idle';
  a.gaze = null;
  if (seat.then === 'sleep') return fallAsleep(a, c);
  if (seat.then === 'call') {
    c.events.push({ type: 'voice', petId: a.petId, cry: 'happy' });
    a.gaze = c.camera;
  }
  a.pose = seat.then === 'down' ? 'down' : 'sit';
  a.t = seat.then === 'call' ? 4 : between(c.rng, 4, c.dog ? 8 : 14);
}

function choose(options: [number, () => void][], rng: () => number) {
  let r = rng() * options.reduce((s, [w]) => s + w, 0);
  for (const [w, pick] of options) {
    r -= w;
    if (r <= 0) return pick();
  }
  options[0][1]();
}

/** 面の上でひまなとき。座る・伏せる・少し動く・飛び降りる。犬はすぐ降りたがる */
function perched(a: Actor, c: Ctx, p: Perch) {
  const { rng, dog } = c;
  const tired = c.pet.stats.energy < 45;
  choose(
    [
      [dog ? 0.35 : 0.12, () => go(a, 'wander', wanderSpot(a, c))],
      [0.3, () => ((a.pose = 'sit'), (a.t = between(rng, 3, 7)))],
      [tired ? 0.5 : dog ? 0.15 : 0.35, () => ((a.pose = 'down'), (a.t = between(rng, 6, dog ? 10 : 16)))],
      [0.15, () => ((a.pose = 'stand'), (a.gaze = c.camera), (a.t = between(rng, 2, 4)))],
      [0.1, () => goPerch(a, c, p, dog ? 'sit' : 'down')]
    ],
    rng
  );
}

function decide(a: Actor, c: Ctx) {
  const { rng, world, pet, dog } = c;
  const room = isRoom(world.layout) ? world.layout : null;
  a.gaze = null;
  a.mode = 'idle';
  if (room && pet.stats.food < LOW && world.bowls.foodLeft <= 0.05 && rng() < 0.3) {
    go(a, 'beg', besideBowl(room.food, room));
    return;
  }
  const here = perchOf(world, a.perch);
  if (here) return perched(a, c, here);
  if (aside(a, c)) return go(a, 'wander', wanderSpot(a, c));
  const tired = pet.stats.energy < 45;
  const park = world.scene === 'park';
  const options: [number, () => void][] = [
    [dog ? (park ? 0.5 : 0.35) : 0.2, () => go(a, 'wander', wanderSpot(a, c))],
    [dog ? 0.2 : 0.3, () => ((a.pose = 'sit'), (a.t = between(rng, 3, 7)))],
    [tired ? 0.4 : dog ? 0.1 : 0.25, () => ((a.pose = 'down'), (a.t = between(rng, 5, dog ? 10 : 14)))],
    [dog ? 0.2 : 0.15, () => ((a.pose = 'stand'), (a.gaze = c.camera), (a.t = between(rng, 2, 4)))],
    [
      dog ? 0.03 : 0.02,
      () => {
        a.pose = 'stand';
        a.gaze = c.camera;
        a.t = 1.2;
        c.events.push({ type: 'voice', petId: a.petId });
      }
    ]
  ];
  if (park && world.presents.length) {
    const p = world.presents.reduce((m, q) => (dist(a, q) < dist(a, m) ? q : m));
    options.push([dog ? 0.3 : 0.15, () => ((a.present = p.id), go(a, 'present', p))]);
  }
  // 猫は高い所が好きでよくソファに乗る。子犬はたまに
  const sofa = perchOf(world, 'sofa');
  if (sofa && crowd(sofa, a, c) < seats(sofa))
    options.push([dog ? 0.04 : 0.14, () => goPerch(a, c, sofa, dog || rng() < 0.4 ? 'sit' : 'down')]);
  choose(options, rng);
}

function faceThen(a: Actor, want: number, dt: number): boolean {
  accelerate(a, 0, dt);
  return turn(a, want, dt) < 0.3;
}

function runMode(a: Actor, c: Ctx, dt: number) {
  const { world, pet, dog, events } = c;
  const layout = world.layout;
  const room = isRoom(layout) ? layout : null;
  const kind = dog ? 'dog' : 'cat';
  const tired = pet.stats.energy < 40;
  const run = tired ? 0.9 : RUN[kind];
  const walk = WALK[kind] * (tired ? 0.8 : 1);
  const toy = world.toy;
  a.t -= dt;
  if (a.hop) return hopping(a, a.hop, c, dt);
  const perch = perchOf(world, a.perch);
  if (!perch) a.perch = null;
  a.y = perch?.y ?? 0;
  if (perch && grounded(a)) return startHop(a, { x: inside(perch, a).x, z: perch.z + perch.d + REACH, y: 0 }, null);
  switch (a.mode) {
    case 'idle':
      accelerate(a, 0, dt);
      // 座ったり伏せたりしているあいだは体を回さず、首だけで追う
      if (a.gaze && a.pose === 'stand') turn(a, angleTo(a, a.gaze), dt * 0.5);
      if (needs(a, c)) return;
      if (toy && !toy.still && !toy.holder) a.gaze = toy;
      else if (world.wand?.moving) a.gaze = world.wand;
      // 選んだ子を呼んだら、その行き先のそばにいるほかの子は場所をあける
      if (
        aside(a, c) &&
        c.actors.some((o) => o.petId === world.current && o.mode === 'go' && (o.goal === 'front' || o.goal === 'spot'))
      )
        return go(a, 'wander', wanderSpot(a, c));
      if (a.t <= 0) decide(a, c);
      return;
    case 'go': {
      a.pose = 'stand';
      if (a.t <= 0) return decide(a, c);
      const idly = a.goal === 'perch' && (a.seat?.then === 'sit' || a.seat?.then === 'down');
      if ((a.goal === 'wander' || a.goal === 'beg' || idly) && needs(a, c)) return;
      if (a.goal === 'perch') {
        const far = a.seat?.then === 'call' && dist(a, { x: a.tx, z: a.tz }) > 1.2;
        return toPerch(a, c, dt, far ? run : walk);
      }
      if (a.goal === 'front') [a.tx, a.tz] = [layout.front.x, layout.front.z];
      if (a.goal === 'present') {
        const p = world.presents.find((q) => q.id === a.present);
        if (!p) return decide(a, c);
        a.tx = p.x;
        a.tz = p.z;
        if (dist(a, p) < 0.25) {
          world.presents.splice(world.presents.indexOf(p), 1);
          events.push(
            { type: 'found', petId: a.petId, present: p.id },
            { type: 'voice', petId: a.petId, cry: 'happy' }
          );
          return act(a, 'happy', 1.2);
        }
      }
      const far = dist(a, { x: a.tx, z: a.tz }) > 1.2;
      const hurry = a.goal === 'present' ? dog : (a.goal === 'front' || a.goal === 'spot') && far;
      if (!steer(a, { x: a.tx, z: a.tz }, hurry ? run : walk, dt, layout, a.goal === 'present' ? 0.2 : 0.08)) return;
      switch (a.goal) {
        case 'wander':
          a.mode = 'idle';
          a.t = between(c.rng, 0.5, 1.5);
          return;
        case 'bed':
          return fallAsleep(a, c);
        case 'front':
        case 'spot':
          if (!faceThen(a, angleTo(a, c.camera), dt)) return;
          events.push({ type: 'voice', petId: a.petId, cry: 'happy' });
          a.mode = 'idle';
          a.pose = 'sit';
          a.gaze = c.camera;
          a.t = 4;
          return;
        case 'beg':
          if (!faceThen(a, angleTo(a, c.camera), dt)) return;
          events.push({ type: 'voice', petId: a.petId, cry: 'sweet' });
          return act(a, 'sit', 3);
        case 'food':
        case 'water': {
          if (!room) return decide(a, c);
          const bowl = a.goal === 'food' ? room.food : room.water;
          const left = a.goal === 'food' ? world.bowls.foodLeft : world.bowls.waterLeft;
          if (left <= 0.05) return decide(a, c);
          if (!faceThen(a, angleTo(a, bowl), dt)) return;
          a.mode = a.goal === 'food' ? 'eat' : 'drink';
          a.pose = 'eat';
          a.t = a.goal === 'food' ? 4 : 3;
          return;
        }
      }
      return;
    }
    case 'eat':
    case 'drink': {
      accelerate(a, 0, dt);
      const bowls = world.bowls;
      if (a.mode === 'eat') bowls.foodLeft = Math.max(0, bowls.foodLeft - dt / 4);
      else bowls.waterLeft = Math.max(0, bowls.waterLeft - (0.35 * dt) / 3);
      if (a.t > 0 && (a.mode === 'drink' || bowls.foodLeft > 0)) return;
      if (a.mode === 'drink') events.push({ type: 'drank', petId: a.petId });
      else if (bowls.food) events.push({ type: 'ate', petId: a.petId, food: bowls.food });
      a.mode = 'idle';
      a.pose = 'sit';
      a.t = between(c.rng, 1.5, 3);
      return;
    }
    case 'sleep':
      accelerate(a, 0, dt);
      if (pet.stats.energy >= RESTED) {
        wakeUp(a);
        a.awake = 0;
      }
      return;
    case 'chase': {
      if (!toy || toy.holder || a.t <= 0) return decide(a, c);
      a.pose = 'stand';
      a.gaze = toy;
      const r = TOY[toy.kind].r;
      const flying = toy.y > r + 0.02;
      const reach = dist(a, toy);
      if (dog && flying && reach < 0.32 && toy.y < 0.55) {
        grab(a, toy);
        events.push({ type: 'caught', petId: a.petId });
        return act(a, 'jump', 0.5, 'carry');
      }
      if (!dog && !flying && reach < 0.45) {
        a.aim = 'toy';
        a.mode = 'pounce';
        a.t = toy.kind === 'mouse' ? MOUSE_PLAY : 0.6;
        return;
      }
      steer(a, toyGoal(toy, layout), run, dt, layout, 0);
      if (dog && !flying && reach < MOUTH.dog + 0.04) grab(a, toy);
      return;
    }
    case 'carry': {
      if (!toy || toy.holder !== a.petId) {
        a.carrying = null;
        return decide(a, c);
      }
      a.pose = 'stand';
      a.gaze = null;
      const there = steer(a, layout.front, dist(a, layout.front) > 0.8 ? run : walk, dt, layout, 0.1);
      if (!there && a.t > 0) return;
      if (!faceThen(a, angleTo(a, c.camera), dt)) return;
      toy.holder = null;
      toy.still = true;
      toy.x = a.x + Math.sin(a.heading) * MOUTH.dog;
      toy.z = a.z + Math.cos(a.heading) * MOUTH.dog;
      toy.y = TOY[toy.kind].r;
      toy.vx = toy.vy = toy.vz = 0;
      a.carrying = null;
      events.push({ type: 'fetched', petId: a.petId }, { type: 'voice', petId: a.petId, cry: 'proud' });
      a.mode = 'idle';
      a.pose = 'sit';
      a.gaze = c.camera;
      a.t = 2.5;
      return;
    }
    case 'stalk': {
      const wand = world.wand;
      if (!wand || !a.wandPlay) return decide(a, c);
      a.gaze = wand;
      const d = dist(a, wand);
      const y = wand.y ?? 0;
      // 犬は寄って 1 度じゃれたら飽きる
      if (dog) {
        a.pose = 'stand';
        if (d > 0.5) return void steer(a, wand, walk * 0.7, dt, layout, 0);
        a.wandPlay = false;
        return act(a, y > HIGH ? 'jump' : 'paw', 0.8);
      }
      if (y > HIGH) {
        a.t = CROUCH;
        a.pose = 'stand';
        if (d > 0.35) return void steer(a, wand, walk, dt, layout, 0);
        if (!faceThen(a, angleTo(a, wand), dt)) return;
        a.aim = 'wand';
        if (c.rng() < 0.5) return act(a, 'paw', 0.7, 'stalk');
        events.push({ type: 'leap', petId: a.petId });
        return act(a, 'jump', 0.95, 'stalk');
      }
      if (wand.moving || d >= 0.7) a.t = CROUCH;
      else if (a.t > 0) {
        a.t = Math.min(a.t, CROUCH);
        a.pose = dog ? 'stand' : 'down';
        return void faceThen(a, angleTo(a, wand), dt);
      }
      a.pose = 'stand';
      if (d < 0.55) {
        // 止めたふさには前足でちょいと手を出す。足元にあると跳べないので、手を出すだけにする
        if (!wand.moving && (d < 0.2 || (d < 0.4 && c.rng() < 0.4))) return act(a, 'paw', 0.7, 'stalk');
        a.aim = 'wand';
        a.mode = 'pounce';
        a.t = between(c.rng, 0.7, 1.3) + 0.35;
        return;
      }
      steer(a, wand, walk * 0.8, dt, layout, 0);
      return;
    }
    case 'pounce': {
      const target = a.aim === 'wand' ? world.wand : toy;
      if (!target) return decide(a, c);
      a.pose = 'pounce';
      a.gaze = target;
      // 身をかがめてお尻を振るあいだは止まり、最後の 0.35 秒で跳ぶ。ねずみは跳ぶ前に前足でちょいちょいする
      if (a.t > 0.35) {
        if (a.aim === 'toy' && toy?.kind === 'mouse' && a.t < MOUSE_PLAY - 0.5 && Math.floor(a.t * 5) % 2)
          a.pose = 'paw';
        return void faceThen(a, angleTo(a, target), dt);
      }
      if (a.t + dt > 0.35) events.push({ type: 'leap', petId: a.petId });
      turn(a, angleTo(a, target), dt);
      a.v = Math.min(1.8, dist(a, target) / Math.max(a.t, 0.05));
      if (a.t > 0) return;
      a.v = 0;
      if (dist(a, target) < 0.3) {
        events.push({ type: 'caught', petId: a.petId });
        if (a.aim === 'toy' && toy) {
          toy.vx = toy.vz = 0;
          toy.still = toy.y <= TOY[toy.kind].r + 0.001;
        }
        return a.aim === 'wand' ? bite(a, c) : act(a, 'sit', 1.2);
      }
      // ねずみを逃したら、もう一度ねらいなおす
      if (a.aim === 'toy' && toy?.kind === 'mouse') a.seen = null;
      return act(a, 'stand', 0.8, a.aim === 'wand' ? 'stalk' : 'idle');
    }
    case 'act':
    case 'held': {
      accelerate(a, 0, dt);
      if (a.show) turn(a, angleTo(a, c.camera), dt);
      if (a.mode === 'act' && a.pose === 'jump' && a.next === 'stalk' && a.t <= 0 && world.wand) {
        if (dist(a, world.wand) < 0.35) {
          events.push({ type: 'caught', petId: a.petId });
          return bite(a, c);
        }
      }
      if (a.t > 0) return;
      a.puzzled = false;
      if (a.next === 'idle') {
        a.mode = 'idle';
        a.t = between(c.rng, 1, 2.5);
        // 芸のあとは座って、ほめられるのを待つ
        if (a.pose !== 'down') a.pose = 'sit';
      } else {
        a.mode = a.next;
        a.t = 15;
      }
      return;
    }
  }
}

/** 捕まえたふさを、少し噛むか、抱えて転がる */
function bite(a: Actor, c: Ctx) {
  a.aim = 'wand';
  act(a, c.rng() < 0.4 ? 'roll' : 'eat', 1.2, 'stalk');
}

/** ねこじゃらしのふさが通り抜けない、胴と頭の球 */
export function wandBalls(actors: Actor[]): { x: number; y: number; z: number; r: number }[] {
  return actors.flatMap((a) => [
    { x: a.x, y: a.y + 0.13, z: a.z, r: 0.1 },
    { x: a.x + Math.sin(a.heading) * 0.16, y: a.y + 0.2, z: a.z + Math.cos(a.heading) * 0.16, r: 0.07 }
  ]);
}

/** ふさを噛んでいる子の口の位置。ねこじゃらしの揺れはそのあいだふさをここに留める */
export function wandBite(actors: Actor[]): { x: number; y: number; z: number } | null {
  const a = actors.find(
    (o) => o.mode === 'act' && o.aim === 'wand' && o.next === 'stalk' && (o.pose === 'eat' || o.pose === 'roll')
  );
  if (!a) return null;
  return { x: a.x + Math.sin(a.heading) * MOUTH.cat, y: 0.05, z: a.z + Math.cos(a.heading) * MOUTH.cat };
}

function grab(a: Actor, toy: Toy) {
  toy.holder = a.petId;
  toy.still = false;
  toy.vx = toy.vy = toy.vz = 0;
  a.carrying = toy.kind;
  a.mode = 'carry';
  a.t = 15;
}

function outputs(a: Actor, c: Ctx, dt: number) {
  const free = a.mode === 'idle' || a.mode === 'go' || a.mode === 'chase' || a.mode === 'carry' || a.mode === 'stalk';
  const moving = free && (a.v > 0.04 || a.spin > 1);
  a.action = !moving ? a.pose : a.v > 0.8 ? 'run' : 'walk';
  a.speed = moving ? clamp(a.v / 1.5, 0.2, 1) : 0;
  a.spin = 0;
  const h = Math.floor(c.pet.love);
  const lively = a.mode === 'held' || a.pose === 'happy' || a.mode === 'carry' || a.mode === 'chase';
  const want = a.asleep
    ? 0
    : c.dog
      ? lively
        ? 1
        : 0.3 + 0.08 * h + (a.gaze === c.camera ? 0.2 : 0)
      : lively || a.mode === 'stalk' || a.mode === 'pounce'
        ? 0.5
        : 0.1 + 0.04 * h;
  a.wag += clamp(want - a.wag, -2 * dt, 2 * dt);
  const look = a.puzzled
    ? Math.sin(a.clock * 5) * 0.8
    : a.gaze && !moving
      ? clamp(wrap(angleTo(a, a.gaze) - a.heading) / 1.2, -1, 1)
      : 0;
  a.look += clamp(look - a.look, -3 * dt, 3 * dt);
}

export function think(actors: Actor[], pets: Pet[], world: WorldView, dt: number, rng: () => number): BehaviorEvent[] {
  const events: BehaviorEvent[] = [];
  const cam = world.layout.camera;
  const camera = { x: cam.x, z: cam.z };
  if (world.toy) moveToy(world.toy, world.layout, dt);
  for (const a of actors) {
    const pet = pets.find((p) => p.id === a.petId);
    if (!pet) continue;
    const dog = kindOf(pet.breed) === 'dog';
    const c: Ctx = { pet, dog, world, actors, rng, events, camera };
    events.push(...a.queue.splice(0));
    a.clock += dt;
    a.awake = Math.max(0, a.awake - dt);
    if (!world.wand) a.wandPlay = null;
    runMode(a, c, dt);
    a.x += Math.sin(a.heading) * a.v * dt;
    a.z += Math.cos(a.heading) * a.v * dt;
    collide(a, world.layout, actors, perchOf(world, a.perch));
    outputs(a, c, dt);
    a.bark -= dt;
    if (a.bark <= 0) {
      a.bark = between(rng, dog ? 30 : 45, dog ? 70 : 90);
      if (a.mode === 'idle') events.push({ type: 'voice', petId: a.petId });
    }
    const toy = world.toy;
    if (toy && toy.holder === a.petId) {
      const m = MOUTH[dog ? 'dog' : 'cat'];
      toy.x = a.x + Math.sin(a.heading) * m;
      toy.z = a.z + Math.cos(a.heading) * m;
      toy.y = dog ? 0.2 : 0.14;
    }
  }
  return events;
}
