import { kindOf, LOW, SLEEPY, TRICKS, type Pet } from './engine';
import type { Cry } from './cries';
import type { Layout, Perch, RoomLayout, Spot } from './layout';
import { dislikes, feelOf, rubPose, type Feel, type Part } from './petting';
import {
  bodyOf,
  capOf,
  capsule,
  free,
  friendly,
  gap,
  pickPal,
  refuses,
  SNUG,
  snuggleSpots,
  type Body,
  type Pal,
  type PalKind
} from './social';
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
  /** 夜の深さ 0..1（daytime.ts）。夜は早めに眠くなり、ひまなときによくあくびをする */
  night?: number;
}

type Mode =
  | 'idle'
  | 'go'
  | 'eat'
  | 'drink'
  | 'sleep'
  | 'chase'
  | 'carry'
  | 'stalk'
  | 'pounce'
  | 'act'
  | 'held'
  | 'hop'
  | 'offer'
  | 'tease'
  | 'social';
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
  next: 'idle' | 'carry' | 'stalk' | 'chase';
  aim: 'wand' | 'toy';
  present: number | null;
  /** 追うかどうかをもう決めたおもちゃ。投げるたびに新しい Toy になる */
  seen: Toy | null;
  /** ねこじゃらしで遊ぶか。指を離すと null に戻って次に振られたとき決め直す */
  wandPlay: boolean | null;
  /** 起こされてから、また眠くなるまでの秒 */
  awake: number;
  /** 汚れがひどいとき、次に体をかいてよい clock */
  itchAt: number;
  bark: number;
  clock: number;
  queue: BehaviorEvent[];
  /** なでられている所と、そこを続けてなでられた秒。手が止まって held が終わると null */
  rub: { part: Part; s: number } | null;
  /** 苦手な所をなでられて離れていくあいだの秒。このあいだはなでても寄ってこない */
  shy: number;
  /** 猫がおもちゃを前足で転がす残りの回数。まだ遊びはじめていなければ -1 */
  play: number;
  /** 持ってきたおもちゃを渡す前に、いちど「とってごらん」と逃げる */
  tease: boolean;
  /** 体の大きさ。押しのけ合いと、並んで寝る位置に使う */
  body: Body;
  /** ほかの子とのかかわり（mode 'social'）。くっつき寝では寝に行くあいだも持つ */
  pal: Pal | null;
  /** 次に自分からほかの子を誘ってよい clock */
  palAt: number;
  /** 最後に言いつけ（なでる・芸・呼ぶ）を受けた clock。プレイヤーと遊んでいる子は誘われない */
  toldAt: number;
  /** 「ねんね」と言われた。眠くなくても、次にひまになったらベッドかソファへ寝に行く */
  bedtime: boolean;
  /** 「まて」のあいだ。その場で座ってカメラを見て、なでても t が尽きるまで動かない */
  stay: boolean;
  /** 「あそぼ」のあと、はしゃいで走りまわる残りの回数 */
  romp: number;
}

export type Command =
  /**
   * to があれば front ではなくその点へ来る（床をタップして呼ぶ）。perch があればその面の上の to へ飛び乗り、
   * then で乗ったあとにすること（ベッドなら寝る・伏せる）を決める。無ければこちらを見て座る
   */
  | { type: 'call'; to?: Spot; perch?: Perch['id']; then?: 'sleep' | 'down' }
  | { type: 'trick'; trick: TrickId; success: boolean }
  /** part があれば、その所の好き嫌いで反応する。amount はこのフレームになでた秒 */
  /** at はなでている指の、頭の高さでの床の上の位置。頭や顔なら、そちらへ頭を寄せる */
  | { type: 'stroke'; part?: Part; amount?: number; at?: Spot }
  | { type: 'brush' }
  /** stretch なら、起きたあとのびをする（声の「おきて」） */
  | { type: 'wake'; stretch?: boolean }
  /** 寝に行く。brief なら眠くないので、少し横になるだけ */
  | { type: 'sleep'; brief?: boolean }
  /** t 秒その場で待つ */
  | { type: 'stay'; t: number }
  /** いたずらをやめて、しゅんとする */
  | { type: 'scold' }
  /** おじぎで誘って走りまわる */
  | { type: 'play' }
  /** カメラの方を向いて座る（写真） */
  | { type: 'face' };

export type BehaviorEvent =
  | { type: 'ate'; petId: string; food: FoodId }
  | { type: 'drank'; petId: string }
  /** 持ち主の前まで持ってきた。ふだんの場面では、このあとくわえたまま受け取ってもらうのを待つ */
  | { type: 'fetched'; petId: string }
  /** 猫が前足でおもちゃを転がした・抱えた */
  | { type: 'played'; petId: string }
  /** 受け取ってもらえなかったおもちゃを足元に置いて、投げてと催促した */
  | { type: 'urge'; petId: string }
  | { type: 'caught'; petId: string }
  /** 飛びかかった瞬間 */
  | { type: 'leap'; petId: string }
  | { type: 'found'; petId: string; present: number }
  /** cry が無ければ、そのときの気分（おなか・のど・ねむけ）で鳴き方を決める */
  | { type: 'voice'; petId: string; cry?: Cry }
  | { type: 'sleep'; petId: string }
  | { type: 'wake'; petId: string }
  | { type: 'petted'; petId: string; feel: Feel }
  /** ほかの子とのかかわり。invite は誘った、refuse はいやがった、done は遊び・毛づくろいが終わった */
  | { type: 'social'; petId: string; with: string; kind: PalKind | 'invite' | 'refuse' | 'done' };

/** おまわりは 1 周で 1.6 秒 */
export const SPIN_RATE = (Math.PI * 2) / 1.6;
/** 芸を見せる秒。しんだふりは少し長く倒れたままでいてから起きる */
const TRICK_TIME: Partial<Record<PetAction, number>> = { spin: 1.6, dead: 2.8 };

const G = 9.8;
/** 地面に触れている高さ（半径）・弾み・転がりの減り（1/秒）・空気で浮く強さ */
const TOY: Record<ToyId, { r: number; bounce: number; roll: number; lift: number }> = {
  ball: { r: 0.05, bounce: 0.55, roll: 0.7, lift: 0 },
  frisbee: { r: 0.015, bounce: 0.05, roll: 5, lift: 2.6 },
  mouse: { r: 0.03, bounce: 0.2, roll: 1.1, lift: 0 },
  wand: { r: 0.03, bounce: 0, roll: 5, lift: 0 }
};
/** お皿（props.ts の bowl）のふちの半径と高さ。おもちゃはこの円柱を通れない */
const BOWL = { r: 0.122, h: 0.064 };
/**
 * お皿から部屋の内側へのびる帯（長さ・半幅）。食べる子が立って顔を入れる所なので、
 * ここに止まりかけたおもちゃは、ゆるい坂を転がるように帯の外へ出ていく
 */
const BOWL_LANE = { len: 0.55, half: 0.2, push: 0.8 };

const BODY = 0.16;
const GAP = 0.34;
const WALK = { dog: 0.45, cat: 0.35 };
const RUN = { dog: 1.5, cat: 1.3 };
const MOUTH = { dog: 0.29, cat: 0.21 };
/** きれいがこれより下だと、ときどき体をかく */
const ITCHY = 10;
/** 寝ているところから起きる、げんきの高さ */
export const RESTED = 90;
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
/** 持ってきたおもちゃをくわえて見上げ、受け取ってもらうのを待つ秒 */
const OFFER = 5;
/** 猫が前足でおもちゃに届く距離 */
const PAW_REACH = 0.28;
/** 持ち主がおもちゃを受け取れる場面。大会や広場では遊びのモードがおもちゃを扱う */
const handing = (w: WorldView) => w.scene === 'room' || w.scene === 'park';
/** おもちゃにかかわっているあいだ。ほかの子は同じおもちゃを追わず、画面も手元へ戻さない */
export const playing = (a: Actor) =>
  a.mode === 'chase' ||
  a.mode === 'carry' ||
  a.mode === 'offer' ||
  a.mode === 'tease' ||
  (a.mode === 'pounce' && a.aim === 'toy') ||
  (a.mode === 'act' && (a.next === 'chase' || a.next === 'carry'));

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
    itchAt: 8,
    bark: 12,
    clock: 0,
    queue: [],
    rub: null,
    shy: 0,
    play: -1,
    tease: false,
    body: bodyOf(pet.breed),
    pal: null,
    palAt: 6,
    toldAt: -99,
    bedtime: false,
    stay: false,
    romp: 0
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

/** 寝起きののび（前足をのばしてあくび → 後ろ足をのばす）の秒 */
const STRETCH = 2.6;

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
  actor.toldAt = actor.clock;
  // 言いつけはほかの子とのかかわりより先。相手は mingle で気づいて離れる
  actor.pal = null;
  if (actor.mode === 'social') actor.mode = 'idle';
  apply(actor, cmd);
  if (cmd.type === 'stroke' && cmd.part && actor.mode === 'held') rubbed(actor, pet, cmd.part, cmd.amount ?? 0, cmd.at);
  // 跳んでいるあいだの言いつけは、着いてからの動きにする
  if (hop && actor.mode !== 'hop') {
    hop.then = { mode: actor.mode, pose: actor.pose, t: actor.t };
    actor.mode = 'hop';
  }
}

function rubbed(a: Actor, pet: Pet, touched: Part, amount: number, at?: Spot) {
  const kind = kindOf(pet.breed);
  // おなかをなでているあいだは、転がったり身をよじったりして指の下が背中になっても、おなかをなで続けたことにする
  const part = a.rub?.part === 'belly' && touched === 'back' ? 'belly' : touched;
  const from = a.rub?.part === part ? a.rub.s : 0;
  const s = from + amount;
  a.rub = { part, s };
  a.pose = rubPose(kind, pet.love, part, s);
  if (!from) a.gaze = null;
  // 指が体の真上に近いと向きが定まらず首が左右に揺れるので、少し離れているときだけ寄せる
  const face = part === 'head' || part === 'chin' || part === 'cheek';
  if (at && face && dist(a, at) > 0.1 && !dislikes(kind, pet.love, part)) a.gaze = at;
  // 猫はしっぽをさわられているあいだ、いやがってしっぽを大きく振る
  if (kind === 'cat' && part === 'tail') a.wag = 1;
  const feel = feelOf(kind, pet.love, part, from, s);
  if (!feel) return;
  a.queue.push({ type: 'petted', petId: a.petId, feel });
  // 振り返って、さわられたしっぽを見る
  if (feel === 'turn') a.gaze = { x: a.x - Math.sin(a.heading), z: a.z - Math.cos(a.heading) };
  if (feel === 'enough' || (feel === 'tickle' && dislikes(kind, pet.love, part))) {
    a.shy = feel === 'enough' ? 5 : 1;
    a.t = 0;
  }
}

/** なでる人（カメラ）から遠ざかる向きへ d だけ行った所 */
function away(a: Actor, c: Ctx, d: number): Spot {
  const b = c.world.layout.bounds;
  const dir = angleTo(c.camera, a) + between(c.rng, -0.7, 0.7);
  return offBowls(c.world.layout, {
    x: clamp(a.x + Math.sin(dir) * d, b.x0, b.x1),
    z: clamp(a.z + Math.cos(dir) * d, b.z0, b.z1)
  });
}

/** 行き先がお皿のそばなら、お皿から体ひとつぶん離す。お皿は体を押し返すので、そのままでは着けない */
function offBowls(layout: Layout, p: Spot): Spot {
  if (!isRoom(layout)) return p;
  const need = BOWL.r + 0.3;
  for (const k of [layout.food, layout.water]) {
    const d = dist(p, k);
    if (d >= need) continue;
    const [nx, nz] = d > 1e-6 ? [(p.x - k.x) / d, (p.z - k.z) / d] : [-1, 0];
    p = { x: clamp(k.x + nx * need, layout.bounds.x0, layout.bounds.x1), z: k.z + nz * need };
  }
  return p;
}

function apply(a: Actor, cmd: Command) {
  if (cmd.type === 'wake') {
    const slept = a.asleep;
    wakeUp(a);
    if (!slept || !cmd.stretch) return;
    act(a, 'stretch', STRETCH);
    a.show = true;
    return;
  }
  if (a.mode === 'eat' || a.mode === 'drink') return;
  if (cmd.type === 'stroke' || cmd.type === 'brush') {
    // 寝ているあいだはなでても起きない。「まて」のあいだはなでても待つ
    if (a.asleep || a.stay || (cmd.type === 'stroke' && a.shy > 0)) return;
    if (a.mode !== 'held') a.next = a.carrying ? 'carry' : 'idle';
    a.mode = 'held';
    a.pose = cmd.type === 'stroke' ? 'happy' : 'stand';
    a.t = 0.6;
    return;
  }
  if (cmd.type === 'scold') return scolded(a);
  if (cmd.type === 'call') {
    wakeUp(a);
    [a.stay, a.bedtime] = [false, false];
    if (a.carrying) return;
    a.mode = 'go';
    a.goal = cmd.perch ? 'perch' : cmd.to ? 'spot' : 'front';
    if (cmd.perch) a.seat = { id: cmd.perch, then: cmd.then ?? 'call' };
    const to = cmd.to ?? a;
    [a.tx, a.tz] = [to.x, to.z];
    a.t = 15;
    return;
  }
  if (a.asleep || a.carrying) return;
  // 「まて」のあいだに撮る写真は、待ったまま撮る
  if (cmd.type === 'face' && a.stay) return;
  [a.stay, a.bedtime, a.romp] = [false, false, 0];
  if (cmd.type === 'sleep') {
    if (cmd.brief) return act(a, 'sleep', 3);
    // 眠いときと同じ道（needs）で、ベッドかソファ、公園ならその場で寝る
    [a.bedtime, a.awake, a.mode, a.t] = [true, 0, 'idle', 0];
    return;
  }
  if (cmd.type === 'stay') {
    [a.stay, a.mode, a.t, a.gaze] = [true, 'idle', cmd.t, null];
    a.pose = a.pose === 'down' ? 'down' : 'sit';
    return;
  }
  if (cmd.type === 'play') {
    act(a, 'bow', 1.2);
    [a.show, a.romp] = [true, 4];
    return;
  }
  if (cmd.type === 'face') {
    act(a, a.pose === 'down' ? 'down' : 'sit', 1.8);
    [a.show, a.gaze] = [true, null];
    return;
  }
  const trick = cmd.type === 'trick' ? TRICKS.find((t) => t.id === cmd.trick) : undefined;
  if (cmd.success && trick) act(a, trick.action, TRICK_TIME[trick.action] ?? 1.6);
  else act(a, 'stand', 1.3, 'idle', true);
  a.show = true;
  a.gaze = null;
}

/** おもちゃの持ち逃げ・苦手な所をさわられて離れる・追いかけっこをやめて、座ってしゅんとする。咥えたおもちゃは画面が床に落とす */
function scolded(a: Actor) {
  if (a.asleep) return;
  [a.carrying, a.shy, a.tease, a.wandPlay, a.play] = [null, 0, false, false, -1];
  [a.stay, a.bedtime, a.romp, a.pal] = [false, false, 0, null];
  act(a, 'sad', 2.2);
  [a.show, a.gaze] = [true, null];
}

/** 「だめ」でやめさせることをしている */
export const naughty = (a: Actor): boolean =>
  a.shy > 0 ||
  a.mode === 'tease' ||
  a.mode === 'chase' ||
  a.mode === 'stalk' ||
  a.mode === 'pounce' ||
  (a.mode === 'social' && (a.pal?.kind === 'play' || a.pal?.kind === 'rival'));

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

/** 床のおもちゃがお皿の帯の中なら、部屋の真ん中へ向かう x の向き（±1）。外なら 0 */
function bowlLane(toy: Toy, layout: Layout): number {
  if (!isRoom(layout) || toy.y > TOY[toy.kind].r + 0.001) return 0;
  const mid = (layout.bounds.x0 + layout.bounds.x1) / 2;
  for (const k of [layout.food, layout.water]) {
    const side = Math.sign(mid - k.x) || 1;
    const d = (toy.x - k.x) * side;
    if (d >= 0 && d < BOWL_LANE.len && Math.abs(toy.z - k.z) < BOWL_LANE.half) return side;
  }
  return 0;
}

/** お皿にぶつかったら、横からは跳ね返り、上からはふちに弾んで外へこぼれる。oy は動く前の高さ */
function bumpBowls(toy: Toy, room: RoomLayout, oy: number) {
  const c = TOY[toy.kind];
  const reach = BOWL.r + c.r;
  for (const k of [room.food, room.water]) {
    const d = dist(toy, k);
    if (d >= reach || toy.y - c.r >= BOWL.h) continue;
    const mid = (room.bounds.x0 + room.bounds.x1) / 2;
    const nx = d > 1e-6 ? (toy.x - k.x) / d : Math.sign(mid - k.x) || 1;
    const nz = d > 1e-6 ? (toy.z - k.z) / d : 0;
    const out = toy.vx * nx + toy.vz * nz;
    if (oy - c.r >= BOWL.h - 0.001) {
      toy.y = BOWL.h + c.r;
      if (toy.vy < 0) toy.vy = -toy.vy * c.bounce;
      if (out < 0.6) {
        toy.vx += (0.6 - out) * nx;
        toy.vz += (0.6 - out) * nz;
      }
    } else {
      toy.x = k.x + nx * reach;
      toy.z = k.z + nz * reach;
      if (out < 0) {
        toy.vx -= 1.4 * out * nx;
        toy.vz -= 1.4 * out * nz;
      }
    }
  }
}

function moveToy(toy: Toy, layout: Layout, dt: number) {
  if (toy.holder) return;
  const lane = bowlLane(toy, layout);
  if (toy.still && !lane) return;
  toy.still = false;
  const c = TOY[toy.kind];
  const oy = toy.y;
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
    toy.vx += lane * BOWL_LANE.push * dt;
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
  if (isRoom(layout)) bumpBowls(toy, layout, oy);
  if (!lane && toy.y <= c.r && toy.vy === 0 && Math.hypot(toy.vx, toy.vz) < 0.04) {
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
    const me = capOf(a);
    for (const o of actors) {
      // ソファの上の子と床の子は高さが違うので重なってよい
      if (o === a || o.hop || Math.abs(o.y - a.y) > 0.2) continue;
      const pal = a.pal?.with === o.petId ? a.pal : o.pal?.with === a.petId ? o.pal : null;
      // くっついて寝に行く子は寝ている相手に体を寄せる。鼻を寄せる・なめるあいだは少し重なってよい
      if (pal?.kind === 'snuggle') continue;
      const g = gap(me, capOf(o));
      const d = g.d + (pal ? 0.05 : 0);
      if (d >= 0) continue;
      const push = -d * (o.asleep ? 1 : 0.5);
      a.x += g.nx * push;
      a.z += g.nz * push;
    }
  }
  if (!perch && isRoom(layout)) {
    const me = capOf(a);
    for (const k of [layout.food, layout.water]) {
      // 食べる・飲む子は、食べ終えてほかへ行くまで自分のお皿へ顔を入れてよい
      const mine = k === layout.food ? a.goal === 'food' || a.goal === 'beg' : a.goal === 'water';
      if (mine && a.mode !== 'social') continue;
      const g = gap(me, { seg: [k.x, k.z, k.x, k.z], r: BOWL.r });
      if (g.d >= 0) continue;
      a.x -= g.nx * g.d;
      a.z -= g.nz * g.d;
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
  return offBowls(c.world.layout, p);
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
  if ((a.bedtime || s.energy < SLEEPY + 15 * (world.night ?? 0)) && a.awake <= 0) {
    if (snuggle(a, c)) return true;
    const bed = room && nest(a, c);
    if (bed) goPerch(a, c, bed, 'sleep');
    else if (room) go(a, 'bed', clearNear(a, c, room.bed));
    else fallAsleep(a, c);
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
    // ほかの子が食べて（飲んで）いるあいだは、少し離れて順番を待つ
    const wait = hungry && busy('food', 'eat') ? room.food : thirsty && busy('water', 'drink') ? room.water : null;
    if (wait && a.mode === 'idle') {
      const at = besideBowl(wait, room);
      const q = { x: at.x + Math.sign(at.x - wait.x) * 0.5, z: at.z + 0.3 };
      if (dist(a, q) > 0.25) {
        go(a, 'wander', q);
        return true;
      }
    }
  }
  const toy = world.toy;
  // 猫は遠くを転がっていくボールには構わず、そばまで転がってきたら遊ぶかどうか決める
  const far = !c.dog && toy?.kind === 'ball' && !toy.still && dist(a, toy) > 1.5;
  if (toy && !toy.holder && a.seen !== toy && !far) {
    a.seen = toy;
    const others = actors.filter((o) => o !== a && playing(o));
    // 犬同士は、先に追いだした子のあとから別の子も追って取り合う
    const rival =
      c.dog &&
      others.length === 1 &&
      others[0].mode === 'chase' &&
      !others[0].body.cat &&
      toy.kind !== 'mouse' &&
      !toy.still &&
      c.rng() < 0.6;
    // ねずみは猫のおもちゃなので、犬はときどきしか追わない（追うと先に咥えて猫の出番がなくなる）
    const want = c.dog
      ? toy.kind !== 'wand' &&
        (!toy.still || dist(toy, world.layout.front) > 0.5) &&
        (toy.kind !== 'mouse' || c.rng() < 0.3)
      : toy.kind === 'mouse' ||
        (toy.kind === 'ball' && c.rng() < (!toy.still ? 0.8 : dist(a, toy) < 1 ? 0.3 : 0)) ||
        (toy.kind === 'frisbee' && !toy.still && c.rng() < 0.1);
    if (want && (!others.length || rival)) {
      a.mode = 'chase';
      a.t = 12;
      a.play = -1;
      a.tease = !rival && c.dog && handing(world) && c.rng() < 0.12;
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
  a.bedtime = false;
  a.mode = 'sleep';
  a.asleep = true;
  a.pose = 'sleep';
  a.gaze = null;
  c.events.push({ type: 'sleep', petId: a.petId });
  const pal = a.pal;
  a.pal = null;
  if (pal?.kind === 'snuggle') c.events.push({ type: 'social', petId: a.petId, with: pal.with, kind: 'snuggle' });
  settle(a, c, pal?.kind === 'snuggle' ? pal.with : undefined);
}

/**
 * 寝つくとき、寝ころんだ体がほかの寝ている子に重ならない所までずれる。寝ている子どうしは押しのけ合わないので、
 * ここで 1 度だけ直す。起きている子は寝ている子に押しのけられる
 */
function settle(a: Actor, c: Ctx, snug?: string) {
  const perch = perchOf(c.world, a.perch);
  const b = perch
    ? { x0: perch.x - perch.w, x1: perch.x + perch.w, z0: perch.z - perch.d, z1: perch.z + perch.d }
    : c.world.layout.bounds;
  for (let i = 0; i < 6; i++) {
    let moved = false;
    for (const o of c.actors) {
      if (o === a || !o.asleep || o.hop || Math.abs(o.y - a.y) > 0.2) continue;
      const g = gap(capOf(a), capOf(o));
      const d = g.d + (o.petId === snug ? SNUG : 0);
      if (d >= -0.005) continue;
      a.x = clamp(a.x - g.nx * d, b.x0, b.x1);
      a.z = clamp(a.z - g.nz * d, b.z0, b.z1);
      moved = true;
    }
    if (!moved) return;
  }
}

/** 寝ころんだ a がほかの子と重ならない、near のそばの床 */
function clearNear(a: Actor, c: Ctx, near: Spot): Spot {
  const b = c.world.layout.bounds;
  let best = near;
  let room = -Infinity;
  for (let i = 0; i < 10; i++) {
    const ang = between(c.rng, 0, Math.PI * 2);
    const r = i ? 0.2 + i * 0.06 : 0;
    const q = { x: clamp(near.x + Math.sin(ang) * r, b.x0, b.x1), z: clamp(near.z + Math.cos(ang) * r, b.z0, b.z1) };
    const me = capsule(a.body, q, a.heading, true);
    const m = Math.min(
      ...c.actors.filter((o) => o !== a).map((o) => gap(me, capsule(o.body, whereTo(o), o.heading, true)).d)
    );
    if (m > room) [best, room] = [q, m];
    if (m >= 0) break;
  }
  return best;
}

/** 行こうとしている所。着いた先で重ならないよう、歩いている子はその行き先で見る */
const whereTo = (o: Actor): Spot =>
  o.hop ? { x: o.hop.x1, z: o.hop.z1 } : o.mode === 'go' || o.pal?.kind === 'snuggle' ? { x: o.tx, z: o.tz } : o;

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

/** 面の上の、乗っている・乗りに行く子から離れた所。面の上ではカメラの方を向いて横に並ぶ */
function roomOn(p: Perch, a: Actor, c: Ctx): Spot {
  const r = capsule(a.body, a, 0, true).r;
  const others = c.actors.filter(
    (o) =>
      o !== a &&
      (o.perch === p.id || o.hop?.onto === p.id || (o.mode === 'go' && o.goal === 'perch' && o.seat?.id === p.id))
  );
  let best: Spot = p;
  let room = -Infinity;
  for (let i = 0; i < 8; i++) {
    const q = { x: between(c.rng, p.x - p.w, p.x + p.w), z: between(c.rng, p.z - p.d, p.z + p.d) };
    const m = Math.min(...others.map((o) => Math.abs(q.x - whereTo(o).x) - r - capsule(o.body, o, 0, true).r));
    if (m > room) [best, room] = [q, m];
    if (m >= 0) break;
  }
  return best;
}

function goPerch(a: Actor, c: Ctx, p: Perch, then: NonNullable<Actor['seat']>['then'], at?: Spot) {
  const spot = at ?? (a.perch === p.id ? a : roomOn(p, a, c));
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
        a.mode === 'offer' ||
        a.mode === 'tease' ||
        a.mode === 'stalk' ||
        a.mode === 'pounce' ||
        a.mode === 'eat' ||
        a.mode === 'drink' ||
        (a.mode === 'social' && (a.pal?.kind === 'play' || a.pal?.kind === 'rival'));

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
  a.pal = null;
  a.mode = 'idle';
  [a.stay, a.romp] = [false, 0];
  if (room && pet.stats.food < LOW && world.bowls.foodLeft <= 0.05 && rng() < 0.3) {
    go(a, 'beg', besideBowl(room.food, room));
    return;
  }
  // 汚れがいちばんひどいと、ひまなときに 10〜20 秒に 1 回ほど体をかくか、ぶるっと振る
  if (pet.stats.clean < ITCHY && a.clock >= a.itchAt) {
    a.itchAt = a.clock + between(rng, 10, 20);
    return act(a, rng() < 0.65 ? 'scratch' : 'shake', 1.8);
  }
  if ((world.scene === 'room' || world.scene === 'park') && a.clock >= a.palAt && befriend(a, c)) return;
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
    ],
    [
      0.12 * (world.night ?? 0),
      () => {
        a.pose = 'sit';
        a.t = between(rng, 2, 4);
        c.events.push({ type: 'voice', petId: a.petId, cry: 'yawn' });
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
      if (a.stay) {
        a.gaze = c.camera;
        faceThen(a, angleTo(a, c.camera), dt);
        if (a.t <= 0) decide(a, c);
        return;
      }
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
      const hurry = a.goal === 'present' ? dog : a.romp > 0 || ((a.goal === 'front' || a.goal === 'spot') && far);
      if (!steer(a, { x: a.tx, z: a.tz }, hurry ? run : walk, dt, layout, a.goal === 'present' ? 0.2 : 0.08)) return;
      switch (a.goal) {
        case 'wander':
          if (a.romp > 0 && --a.romp > 0) return go(a, 'wander', wanderSpot(a, c));
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
        act(a, 'stretch', STRETCH);
      }
      return;
    case 'chase': {
      const first = toy?.holder && toy.holder !== a.petId ? c.actors.find((o) => o.petId === toy.holder) : undefined;
      if (dog && first && !first.body.cat) return contest(a, first, c);
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
      if (!dog && !flying && a.play >= 0) return dribble(a, c, toy, dt, run);
      if (!dog && !flying && reach < 0.45) {
        a.play = Math.round(between(c.rng, 6, 10));
        if (toy.kind !== 'mouse') return dribble(a, c, toy, dt, run);
        a.aim = 'toy';
        a.mode = 'pounce';
        a.t = MOUSE_PLAY;
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
      if (a.tease && dist(a, layout.front) < 1.2) {
        a.tease = false;
        const p = away(a, c, 0.9);
        [a.tx, a.tz, a.t, a.mode] = [p.x, p.z, 3, 'tease'];
        events.push({ type: 'voice', petId: a.petId, cry: 'happy' });
        return;
      }
      const there = steer(a, layout.front, dist(a, layout.front) > 0.8 ? run : walk, dt, layout, 0.1);
      if (!there && a.t > 0) return;
      if (!faceThen(a, angleTo(a, c.camera), dt)) return;
      events.push({ type: 'fetched', petId: a.petId }, { type: 'voice', petId: a.petId, cry: 'proud' });
      a.pose = 'sit';
      a.gaze = c.camera;
      if (handing(world)) {
        a.mode = 'offer';
        a.t = OFFER;
        return;
      }
      drop(a, toy, 0);
      a.mode = 'idle';
      a.t = 2.5;
      return;
    }
    case 'tease': {
      if (!toy || toy.holder !== a.petId) {
        a.carrying = null;
        return decide(a, c);
      }
      a.pose = 'stand';
      if (!steer(a, { x: a.tx, z: a.tz }, run, dt, layout, 0.15) && a.t > 0) return;
      if (!faceThen(a, angleTo(a, c.camera), dt)) return;
      // おじぎのかっこうで「とってごらん」と誘ってから、また持ってくる
      a.gaze = c.camera;
      return act(a, 'bow', 1.2, 'carry');
    }
    case 'offer': {
      accelerate(a, 0, dt);
      // 画面が指で受け取ると、view.toy が消える
      if (!toy || toy.holder !== a.petId) {
        a.carrying = null;
        return act(a, 'happy', 1.2);
      }
      if (a.t > 0) return;
      drop(a, toy, 0.25);
      // 足元のおもちゃを、ほかの子が新しく投げたものと思って追わないように
      for (const o of c.actors) o.seen = toy;
      events.push({ type: 'urge', petId: a.petId }, { type: 'voice', petId: a.petId, cry: 'happy' });
      // 鼻先で押し出すかっこう
      return act(a, 'eat', 0.6);
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
          if (a.play > 0) return bat(a, c, toy);
          toy.vx = toy.vz = 0;
          toy.still = toy.y <= TOY[toy.kind].r + 0.001;
        }
        return a.aim === 'wand' ? bite(a, c) : act(a, 'sit', 1.2);
      }
      // ねずみを逃したら、もう一度ねらいなおす
      if (a.aim === 'toy' && toy?.kind === 'mouse') a.seen = null;
      return act(a, 'stand', 0.8, a.aim === 'wand' ? 'stalk' : a.play > 0 ? 'chase' : 'idle');
    }
    case 'social':
      return mingle(a, c, dt, run, walk);
    case 'act':
    case 'held': {
      accelerate(a, 0, dt);
      if (a.mode === 'act' && a.pose === 'spin') a.heading = wrap(a.heading + SPIN_RATE * dt);
      else if (a.show) turn(a, angleTo(a, c.camera), dt);
      if (a.mode === 'act' && a.pose === 'jump' && a.next === 'stalk' && a.t <= 0 && world.wand) {
        if (dist(a, world.wand) < 0.35) {
          events.push({ type: 'caught', petId: a.petId });
          return bite(a, c);
        }
      }
      if (a.t > 0) return;
      a.puzzled = false;
      if (a.mode === 'held') {
        a.rub = null;
        if (a.shy > 0 && !a.carrying) return go(a, 'wander', away(a, c, a.shy > 2 ? 1.1 : 0.35));
      }
      if (a.next === 'idle' && a.romp > 0) return go(a, 'wander', wanderSpot(a, c));
      if (a.next === 'idle') {
        a.mode = 'idle';
        a.t = between(c.rng, 1, 2.5);
        // 芸のあとは座って、ほめられるのを待つ。うっとりしていた子も座り、閉じた目は models.ts がゆっくり開く
        if (a.pose !== 'down') a.pose = 'sit';
      } else {
        a.mode = a.next;
        a.t = 15;
      }
      return;
    }
  }
}

/** 猫がおもちゃを前足で転がしては追う。触る回数を使いきると飽きて離れていく */
function dribble(a: Actor, c: Ctx, toy: Toy, dt: number, run: number) {
  if (a.play <= 0) {
    a.play = -1;
    return go(a, 'wander', wanderSpot(a, c));
  }
  const layout = c.world.layout;
  const d = dist(a, toy);
  if (d > PAW_REACH) return void steer(a, toyGoal(toy, layout), clamp(d * 2, 0.35, run), dt, layout, PAW_REACH - 0.05);
  if (!faceThen(a, angleTo(a, toy), dt)) return;
  const r = c.rng();
  if (toy.kind === 'ball' && r < 0.15) {
    // 両前足で抱えて転がる。あいだは think がボールを胸元に留める
    a.play--;
    c.events.push({ type: 'played', petId: a.petId });
    return act(a, 'roll', 1.4, 'chase');
  }
  if (r < 0.35) {
    // 見つめてお尻を振ってから飛びつき、捕まえたらまた前足で転がす
    a.aim = 'toy';
    a.mode = 'pounce';
    a.t = between(c.rng, 0.8, 1.3) + 0.35;
    return;
  }
  bat(a, c, toy);
}

/** 前足でちょいと押す。ボールは物理でそのまま転がっていく */
function bat(a: Actor, c: Ctx, toy: Toy) {
  const dir = a.heading + between(c.rng, -0.6, 0.6);
  const v = between(c.rng, 0.5, 0.95);
  toy.vx = Math.sin(dir) * v;
  toy.vz = Math.cos(dir) * v;
  toy.still = false;
  a.play--;
  c.events.push({ type: 'played', petId: a.petId });
  act(a, 'paw', 0.45, 'chase');
}

/** くわえているおもちゃを口の先の床に置く。push は鼻で前へ押し出す速さ */
function drop(a: Actor, toy: Toy, push: number) {
  toy.holder = null;
  toy.x = a.x + Math.sin(a.heading) * MOUTH.dog;
  toy.z = a.z + Math.cos(a.heading) * MOUTH.dog;
  toy.y = TOY[toy.kind].r;
  toy.vx = Math.sin(a.heading) * push;
  toy.vz = Math.cos(a.heading) * push;
  toy.vy = 0;
  toy.still = !push;
  a.carrying = null;
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

// ---- ほかの子とのかかわり（mode 'social'）。相手と種類は social.ts が選ぶ ----

const fwd = (a: Actor, d: number): Spot => ({ x: a.x + Math.sin(a.heading) * d, z: a.z + Math.cos(a.heading) * d });
/** 頭のあたり。鼻を寄せる・なめる先 */
const headOf = (a: Actor) => fwd(a, a.body.fore * 0.75);
const touching = (a: Actor, o: Actor, by = 0.03) => gap(capOf(a), capOf(o)).d < by;

/** ひまなときに、ほかの子を誘う。誘えたら true */
function befriend(a: Actor, c: Ctx): boolean {
  a.palAt = a.clock + between(c.rng, 3, 6);
  if (!free(a)) return false;
  const plan = pickPal(a, c.actors, c.pet.stats.energy < 45, c.rng);
  if (!plan) return false;
  const { o, kind } = plan;
  a.pal = { kind, with: o.petId, lead: true, phase: 'meet', rounds: 0, bumped: false };
  o.pal = { kind, with: a.petId, lead: false, phase: 'wait', rounds: 0, bumped: false };
  for (const x of [a, o]) [x.mode, x.t, x.gaze] = ['social', 8, null];
  return true;
}

/** かかわりをやめて、ひまな子に戻る */
function part(a: Actor, c: Ctx, look?: Spot) {
  a.pal = null;
  a.mode = 'idle';
  if (a.pose !== 'down') a.pose = 'sit';
  a.gaze = look ?? null;
  a.t = between(c.rng, 1.5, 3);
  a.palAt = a.clock + between(c.rng, 10, 25);
}

/** 眠いとき、寝ている仲よしのとなり（床・ソファ）へ体を寄せに行く。行けたら true */
function snuggle(a: Actor, c: Ctx): boolean {
  const w = c.world;
  if (w.scene !== 'room' && w.scene !== 'park') return false;
  for (const f of c.actors) {
    if (f === a || f.hop || dist(a, f) > 4 || !(f.asleep || bedward(f))) continue;
    if (c.rng() > 0.3 + 0.3 * (friendly(a.body) + friendly(f.body))) continue;
    if (a.perch && a.perch !== f.perch) continue;
    const pal: Pal = { kind: 'snuggle', with: f.petId, lead: true, phase: 'nestle', rounds: 0, bumped: false };
    const p = perchOf(w, f.asleep ? f.perch : f.goal === 'perch' ? (f.seat?.id ?? null) : null);
    if (!p && !f.asleep) {
      // 床へ寝に行く子には、ついて行って寝つくのを待つ
      a.pal = { ...pal, phase: 'follow' };
      [a.mode, a.t] = ['social', 15];
      return true;
    }
    if (p && a.perch !== p.id && crowd(p, a, c) >= seats(p)) continue;
    // 面の上ではカメラの方を向いて寝る
    const at = whereTo(f);
    const ghost = f.asleep ? f : { ...f, ...(p ? inside(p, at) : at), heading: angleTo(at, c.camera) };
    const spot = snuggleSpots(a, ghost, c.rng)
      .map((q) => (p ? inside(p, q) : q))
      .find((q) => fits(a, c, q, f, ghost, !p));
    if (!spot) continue;
    a.pal = pal;
    if (p) goPerch(a, c, p, 'sleep', spot);
    else [a.mode, a.tx, a.tz, a.t] = ['social', spot.x, spot.z, 12];
    return true;
  }
  return false;
}

/** 寝に行くところ */
const bedward = (f: Actor) => f.mode === 'go' && (f.goal === 'bed' || (f.goal === 'perch' && f.seat?.then === 'sleep'));

/**
 * q で f と向きをそろえて寝ころんだとき、床からはみ出さず、f には触れる程度で、ほかの子と重ならないか。
 * ghost は f が寝つく所と向き
 */
function fits(a: Actor, c: Ctx, q: Spot, f: Actor, ghost = f, floor = !f.perch): boolean {
  const l = c.world.layout;
  const b = l.bounds;
  if (floor && (q.x < b.x0 || q.x > b.x1 || q.z < b.z0 || q.z > b.z1)) return false;
  if (floor && l.blocks.some((k) => dist(q, k) < k.r + BODY)) return false;
  const me = capsule(a.body, q, ghost.heading, true);
  return c.actors.every((o) => {
    if (o === a) return true;
    const d = gap(me, o === f ? capOf({ ...ghost, asleep: true }) : capsule(o.body, whereTo(o), o.heading, true)).d;
    return o === f ? d > -SNUG - 0.02 : d >= 0;
  });
}

/** 先に追いだした子がボールを咥えたら、そのあとを追いかける */
function contest(a: Actor, o: Actor, c: Ctx) {
  a.pal = { kind: 'rival', with: o.petId, lead: true, phase: 'follow', rounds: 0, bumped: false };
  a.mode = 'social';
  a.t = between(c.rng, 2.5, 4.5);
  c.events.push({ type: 'social', petId: a.petId, with: o.petId, kind: 'rival' });
}

/** 走って逃げる先。追う子から離れる向きへ 1m ほど */
function fleeSpot(a: Actor, from: Actor, c: Ctx): Spot {
  const b = c.world.layout.bounds;
  let q: Spot = a;
  for (let i = 0; i < 8; i++) {
    const dir = angleTo(from, a) + between(c.rng, -1, 1) + (i > 3 ? Math.PI / 2 : 0);
    const d = between(c.rng, 0.9, 1.4);
    q = {
      x: clamp(a.x + Math.sin(dir) * d, b.x0 + 0.2, b.x1 - 0.2),
      z: clamp(a.z + Math.cos(dir) * d, b.z0 + 0.2, b.z1 - 0.2)
    };
    if (
      dist(q, a) > 0.6 &&
      c.world.layout.blocks.every((k) => dist(q, k) > k.r + BODY + 0.1) &&
      !aside({ ...a, ...q }, c)
    )
      return offBowls(c.world.layout, q);
  }
  if (aside({ ...a, ...q }, c)) q.z = c.world.layout.front.z - FRONT_BAND - 0.3;
  return offBowls(c.world.layout, q);
}

function runAway(a: Actor, from: Actor, c: Ctx) {
  const q = fleeSpot(a, from, c);
  [a.tx, a.tz] = [q.x, q.z];
}

function mingle(a: Actor, c: Ctx, dt: number, run: number, walk: number) {
  const p = a.pal;
  const o = p && c.actors.find((x) => x.petId === p.with);
  if (!p || !o) return part(a, c);
  const layout = c.world.layout;
  if (p.kind === 'rival') {
    const toy = c.world.toy;
    const holds = toy?.holder === o.petId && (o.mode === 'carry' || o.mode === 'tease' || o.mode === 'act');
    if (!holds || a.t <= 0 || dist(o, layout.front) < 1) return part(a, c, o);
    a.pose = 'stand';
    a.gaze = toy;
    // 咥えた子のお尻のすぐ後ろを、少し横にずれて追う
    const back = fwd(o, -(o.body.aft + a.body.fore + 0.12));
    const side = Math.cos(o.heading) * 0.15;
    return void steer(a, { x: back.x + side, z: back.z - Math.sin(o.heading) * 0.15 }, run, dt, layout, 0.1);
  }
  if (p.kind === 'snuggle') {
    if (p.phase === 'follow') {
      if (!o.asleep) {
        if (!bedward(o) || a.t <= 0) return part(a, c);
        a.pose = 'stand';
        return void steer(a, whereTo(o), walk, dt, layout, 0.7);
      }
      const spot = snuggleSpots(a, o, c.rng).find((q) => fits(a, c, q, o));
      if (!spot) return part(a, c);
      [a.tx, a.tz, a.t, p.phase] = [spot.x, spot.z, 10, 'nestle'];
    }
    // 相手が起きたら、ふつうに寝る所を探しなおす
    if (!o.asleep) return part(a, c);
    a.pose = 'stand';
    if (!steer(a, { x: a.tx, z: a.tz }, walk, dt, layout, 0.05) && a.t > 0) return;
    if (!faceThen(a, o.heading, dt) && a.t > -2) return;
    return fallAsleep(a, c);
  }
  // 相手が言いつけや自分の用事で離れたら、こちらもやめる。面から飛び降りているあいだは待つ
  const busy = o.mode === 'hop' ? o.hop?.then.mode !== 'social' : o.mode !== 'social';
  if (busy || o.pal?.with !== a.petId) return part(a, c);
  const q = o.pal;
  a.gaze = headOf(o);
  const done = () => {
    c.events.push({ type: 'social', petId: a.petId, with: o.petId, kind: 'done' });
    part(a, c, o);
    part(o, c, a);
  };
  switch (p.phase) {
    case 'wait':
      if (a.t <= 0) return part(a, c);
      // 毛づくろいされる子は、座ったり伏せたりしたまま待つ
      if (p.kind === 'groom' && (a.pose === 'sit' || a.pose === 'down')) return void accelerate(a, 0, dt);
      a.pose = 'stand';
      return void faceThen(a, angleTo(a, o), dt);
    case 'meet': {
      if (a.t <= 0) return part(a, c);
      a.pose = 'stand';
      const play = p.kind === 'play';
      const d = dist(a, o) || 1;
      const to = play ? { x: o.x + ((a.x - o.x) / d) * 0.75, z: o.z + ((a.z - o.z) / d) * 0.75 } : headOf(o);
      const reach = play ? 0.1 : a.body.fore + (p.kind === 'greet' ? 0.06 : o.body.w);
      if (!steer(a, to, walk * (play ? 1.3 : 1), dt, layout, reach) && !touching(a, o)) return;
      if (!faceThen(a, angleTo(a, headOf(o)), dt)) return;
      if (p.kind === 'greet') {
        [p.phase, q.phase, a.t, o.t] = ['sniff', 'sniff', 2.4, 2.4];
        c.events.push({ type: 'social', petId: a.petId, with: o.petId, kind: 'greet' });
      } else if (p.kind === 'groom') {
        [p.phase, q.phase, a.t, o.t] = ['lick', 'licked', 3.6, 3.8];
        a.pose = 'groom';
        if (o.pose !== 'down') o.pose = 'bliss';
        c.events.push({ type: 'social', petId: a.petId, with: o.petId, kind: 'groom' });
      } else {
        // 犬はおじぎ、猫は前足でちょいちょいして誘う
        [p.phase, a.t, o.t] = ['invite', 1.3, 3];
        a.pose = a.body.cat ? 'paw' : 'bow';
        c.events.push({ type: 'social', petId: a.petId, with: o.petId, kind: 'invite' });
      }
      return;
    }
    case 'sniff':
      a.pose = 'sniff';
      accelerate(a, 0, dt);
      if (a.t <= 0) part(a, c, o);
      return;
    case 'lick':
      a.pose = 'groom';
      accelerate(a, 0, dt);
      turn(a, angleTo(a, headOf(o)), dt * 0.5);
      if (a.t <= 0) done();
      return;
    case 'licked':
      accelerate(a, 0, dt);
      if (a.t <= 0) part(a, c, o);
      return;
    case 'invite':
      accelerate(a, 0, dt);
      if (a.t > 0) return;
      if (o.body.cat && refuses(o.body, c.rng)) {
        c.events.push({ type: 'social', petId: o.petId, with: a.petId, kind: 'refuse' });
        o.pal = null;
        go(o, 'wander', fleeSpot(o, a, c));
        o.palAt = o.clock + between(c.rng, 15, 30);
        part(a, c);
        // 首をかしげて見送る
        return act(a, 'stand', 1.3, 'idle', true);
      }
      [p.phase, q.phase, a.t, o.t] = ['answer', 'answer', 3, 0.9];
      o.pose = o.body.cat ? 'paw' : 'bow';
      p.rounds = q.rounds = 2 + Math.floor(c.rng() * 2);
      return;
    case 'answer':
      accelerate(a, 0, dt);
      if (a.t > 0 || p.lead) return;
      // 誘われた子が先に逃げ、誘った子が追う
      runAway(a, o, c);
      [p.phase, q.phase, a.t, o.t, q.bumped] = ['flee', 'chase', 4, 5, false];
      return;
    case 'flee': {
      a.pose = 'stand';
      const there = steer(a, { x: a.tx, z: a.tz }, run * 0.7, dt, layout, 0.15);
      if (!there && a.t > 0) return;
      if (--p.rounds <= 0) return done();
      q.rounds = p.rounds;
      // 追いかけっこの役を入れかえる
      runAway(o, a, c);
      [p.phase, q.phase, a.t, o.t, p.bumped] = ['chase', 'flee', 5, 4, false];
      return;
    }
    case 'chase':
      a.pose = 'stand';
      if (a.t <= 0) return done();
      // 追いついたら 1 回だけ軽くとびつく（猫は前足で打つ）
      if (!p.bumped && touching(a, o, 0.12)) {
        p.bumped = true;
        [p.phase, a.t, a.v] = ['jump', a.body.cat ? 0.6 : 0.95, 0];
        a.pose = a.body.cat ? 'paw' : 'jump';
        c.events.push({ type: 'leap', petId: a.petId });
        return;
      }
      return void steer(a, o, run * 0.8, dt, layout, a.body.fore + o.body.aft);
    case 'jump':
      accelerate(a, 0, dt);
      if (a.t <= 0) [p.phase, a.t] = ['chase', 5];
      return;
    default:
      return part(a, c);
  }
}

function outputs(a: Actor, c: Ctx, dt: number) {
  const free =
    a.mode === 'idle' ||
    a.mode === 'go' ||
    a.mode === 'chase' ||
    a.mode === 'carry' ||
    a.mode === 'stalk' ||
    a.mode === 'tease' ||
    a.mode === 'social';
  const moving = free && (a.v > 0.04 || a.spin > 1);
  a.action = !moving ? a.pose : a.v > 0.8 ? 'run' : 'walk';
  a.speed = moving ? clamp(a.v / 1.5, 0.2, 1) : 0;
  a.spin = 0;
  const h = Math.floor(c.pet.love);
  const lively =
    a.mode === 'held' ||
    a.pose === 'happy' ||
    a.mode === 'carry' ||
    a.mode === 'chase' ||
    a.mode === 'offer' ||
    a.mode === 'social';
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
    a.shy = Math.max(0, a.shy - dt);
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
    if (toy && !toy.holder && a.mode === 'act' && a.next === 'chase' && a.pose === 'roll') {
      toy.x = a.x + Math.sin(a.heading) * 0.12;
      toy.z = a.z + Math.cos(a.heading) * 0.12;
      toy.vx = toy.vz = 0;
      toy.still = true;
    }
  }
  return events;
}
