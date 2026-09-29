/**
 * アイドルの骨組みとかっこう。座標はステージの上の「世界」で、足もとの中央が原点、y は下が正、背の高さがほぼ 1。
 * 描くのも、ノーツを手の先に置くのも、ここの joints() を使うので、手を伸ばした先にノーツが来る
 */

export type P = [number, number];
export type Grip = 'open' | 'fist' | 'point' | 'v' | 'heart';
export type Face = 'smile' | 'happy' | 'wink' | 'star' | 'focus' | 'sing';

/**
 * 腕の a は真下を 0 に外へ開く角度（π/2 で真横、π で真上）、e はひじから先をさらに回す角度（負で内へ曲げる）。
 * 脚の h は太ももを外へ開く角度、k はひざから下を内へ戻す角度。L は画面の左側
 */
export interface Pose {
  x: number;
  /** 跳んだ高さ */
  air: number;
  /** 上体の傾き。正で頭が右へ */
  lean: number;
  head: number;
  /** 顔の向き -1..1（右が正）。目や前髪を少しずらして振り向いたように見せる */
  turn: number;
  aL: number;
  eL: number;
  aR: number;
  eR: number;
  hL: number;
  kL: number;
  hR: number;
  kR: number;
  gripL: Grip;
  gripR: Grip;
  face: Face;
}

export const THIGH = 0.2;
export const SHIN = 0.19;
/** 足首から床まで（靴の高さ） */
export const FOOT = 0.03;
export const UPPER = 0.12;
export const FORE = 0.11;
const SHOULDER: P = [0.068, -0.215];
const NECK = -0.23;
const HEAD = 0.12;
const HIP = 0.042;

const BASE: Pose = {
  x: 0,
  air: 0,
  lean: 0,
  head: 0,
  turn: 0,
  aL: 0.25,
  eL: 0.15,
  aR: 0.25,
  eR: 0.15,
  hL: 0.06,
  kL: 0.06,
  hR: 0.06,
  kR: 0.06,
  gripL: 'open',
  gripR: 'open',
  face: 'smile'
};

const pose = (p: Partial<Pose>): Pose => ({ ...BASE, ...p });

/** 左右を入れかえる（右手のふりから左手のふりを作る） */
export function mirror(p: Pose): Pose {
  return {
    ...p,
    x: -p.x,
    lean: -p.lean,
    head: -p.head,
    turn: -p.turn,
    aL: p.aR,
    eL: p.eR,
    aR: p.aL,
    eR: p.eL,
    hL: p.hR,
    kL: p.kR,
    hR: p.hL,
    kR: p.kL,
    gripL: p.gripR,
    gripR: p.gripL,
    face: p.face === 'wink' ? 'wink' : p.face
  };
}

/** 手を腰に当てる */
const HIP_HAND = { a: 0.9, e: -2.25 };

const RIGHT = {
  reach: pose({
    x: 0.03,
    lean: 0.12,
    head: 0.1,
    turn: 0.4,
    aR: 2.35,
    eR: 0,
    aL: 0.45,
    eL: 0.5,
    hR: 0.22,
    kR: 0.2,
    face: 'happy'
  }),
  point: pose({ lean: 0.05, head: 0.08, turn: 0.6, aR: 1.55, eR: 0, gripR: 'point', aL: HIP_HAND.a, eL: HIP_HAND.e }),
  up: pose({ lean: 0.06, head: 0.12, turn: 0.2, aR: 2.95, eR: 0.05, aL: 0.35, eL: 0.3, face: 'sing' }),
  low: pose({ lean: 0.02, turn: 0.3, aR: 0.95, eR: 0, aL: 0.35, hR: 0.14 }),
  step: pose({
    x: 0.16,
    lean: 0.06,
    head: 0.06,
    turn: 0.5,
    aR: 1.9,
    eR: 0,
    aL: 0.5,
    eL: 0.4,
    hR: 0.25,
    kR: 0.15,
    hL: 0.02,
    kL: 0.02
  }),
  wave: pose({ lean: 0.04, head: 0.1, turn: 0.3, aR: 2.3, eR: 0.5, aL: 0.3, face: 'happy' }),
  appeal: pose({
    lean: -0.08,
    head: -0.15,
    turn: 0.3,
    aR: 1,
    eR: 2.3,
    gripR: 'v',
    aL: HIP_HAND.a,
    eL: HIP_HAND.e,
    hL: 0.35,
    kL: 1.4,
    face: 'wink'
  })
};

export const POSES = {
  idle: BASE,
  heart: pose({ aL: 0.5, eL: -2.7, aR: 0.5, eR: -2.7, gripL: 'heart', gripR: 'heart', head: 0.08, face: 'happy' }),
  crouch: pose({
    hL: 0.45,
    kL: 0.9,
    hR: 0.45,
    kR: 0.9,
    aL: 0.7,
    eL: -2,
    aR: 0.7,
    eR: -2,
    gripL: 'fist',
    gripR: 'fist',
    face: 'focus'
  }),
  jump: pose({ air: 0.14, hL: 0.3, kL: 1.3, hR: 0.3, kR: 1.3, aL: 2.7, eL: 0.1, aR: 2.7, eR: 0.1, face: 'happy' }),
  land: pose({ hL: 0.5, kL: 0.85, hR: 0.5, kR: 0.85, aL: 1.4, eL: 0.2, aR: 1.4, eR: 0.2, face: 'happy' }),
  spread: pose({ aL: 2.4, eL: 0.05, aR: 2.4, eR: 0.05, hL: 0.2, kL: 0.1, hR: 0.2, kR: 0.1, face: 'star' }),
  reachR: RIGHT.reach,
  reachL: mirror(RIGHT.reach),
  pointR: RIGHT.point,
  pointL: mirror(RIGHT.point),
  upR: RIGHT.up,
  upL: mirror(RIGHT.up),
  lowR: RIGHT.low,
  lowL: mirror(RIGHT.low),
  stepR: RIGHT.step,
  stepL: mirror(RIGHT.step),
  waveR: RIGHT.wave,
  waveL: mirror(RIGHT.wave),
  appealR: RIGHT.appeal,
  appealL: mirror(RIGHT.appeal)
} satisfies Record<string, Pose>;

export type PoseId = keyof typeof POSES;

export interface Key {
  beat: number;
  pose: Pose;
  /** 前のかっこうから、あいだの拍をまるごと使ってなめらかに移る（スライドとホールドの動き） */
  glide?: boolean;
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);

export function blend(a: Pose, b: Pose, u: number): Pose {
  const out = { ...(u < 0.5 ? a : b) };
  for (const k of Object.keys(a) as (keyof Pose)[]) {
    const x = a[k];
    if (typeof x === 'number') (out[k] as number) = lerp(x, b[k] as number, u);
  }
  return out;
}

/**
 * keys の拍でそのかっこうに着く。ふだんは着く前の半拍で素早く移り、拍の上でぴたりと止まる（ダンスのキメ）。
 * glide の key へは、あいだの拍をまるごと使って動く
 */
export function poseAt(keys: Key[], beat: number): Pose {
  if (beat <= keys[0].beat) return keys[0].pose;
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, b] = [keys[i], keys[i + 1]];
    if (beat >= b.beat) continue;
    const span = b.beat - a.beat;
    if (b.glide) return blend(a.pose, b.pose, smooth(clamp((beat - a.beat) / span)));
    const d = Math.min(span, 0.5);
    return blend(a.pose, b.pose, smooth(clamp((beat - (b.beat - d)) / d)));
  }
  return keys[keys.length - 1].pose;
}

/** 拍ごとにひざを沈め、2 拍で首と上体を左右に揺らす。amount は 0..1 */
export function groove(p: Pose, beat: number, amount: number): Pose {
  if (!amount || p.air > 0.01) return p;
  const pulse = 0.5 + 0.5 * Math.cos(2 * Math.PI * beat);
  const sway = Math.sin(Math.PI * beat);
  return {
    ...p,
    hL: p.hL + 0.1 * amount * pulse,
    kL: p.kL + 0.22 * amount * pulse,
    hR: p.hR + 0.1 * amount * pulse,
    kR: p.kR + 0.22 * amount * pulse,
    head: p.head + 0.06 * amount * sway,
    lean: p.lean + 0.025 * amount * sway
  };
}

export interface Body {
  hip: P;
  neck: P;
  head: P;
  /** 頭の傾き（上体の傾き + 首） */
  tilt: number;
  lean: number;
  turn: number;
  shoulder: [P, P];
  elbow: [P, P];
  hand: [P, P];
  /** ひじから先の向き（世界の角度、atan2） */
  fore: [number, number];
  hipJ: [P, P];
  knee: [P, P];
  ankle: [P, P];
  pose: Pose;
}

const rot = ([x, y]: P, t: number): P => [x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t)];
const add = (a: P, b: P, k = 1): P => [a[0] + b[0] * k, a[1] + b[1] * k];
/** 側 s（左 -1・右 +1）で、真下から外へ a だけ開いた向き */
const dir = (s: number, a: number): P => [s * Math.sin(a), Math.cos(a)];

/** かっこうから関節の位置を出す。腰の高さは、床に近いほうの足が床に着くように決める */
export function joints(p: Pose): Body {
  const legs = ([-1, 1] as const).map((s) => {
    const [h, k] = s < 0 ? [p.hL, p.kL] : [p.hR, p.kR];
    const knee = add([s * HIP, 0], dir(s, h), THIGH);
    return { knee, ankle: add(knee, dir(s, h - k), SHIN) };
  });
  const hipY = -Math.max(legs[0].ankle[1], legs[1].ankle[1]) - FOOT - p.air;
  const hip: P = [p.x, hipY];
  const at = (v: P) => add(hip, rot(v, p.lean));
  const neck = at([0, NECK]);
  const tilt = p.lean + p.head;
  const head = add(neck, rot([0, -HEAD], tilt));
  const arms = ([-1, 1] as const).map((s) => {
    const [a, e] = s < 0 ? [p.aL, p.eL] : [p.aR, p.eR];
    const shoulder = at([s * SHOULDER[0], SHOULDER[1]]);
    const elbow = add(shoulder, rot(dir(s, a), p.lean), UPPER);
    const f = rot(dir(s, a + e), p.lean);
    return { shoulder, elbow, hand: add(elbow, f, FORE), fore: Math.atan2(f[1], f[0]) };
  });
  const leg = (i: number, k: 'knee' | 'ankle') => add(legs[i][k], hip);
  return {
    hip,
    neck,
    head,
    tilt,
    lean: p.lean,
    turn: p.turn,
    shoulder: [arms[0].shoulder, arms[1].shoulder],
    elbow: [arms[0].elbow, arms[1].elbow],
    hand: [arms[0].hand, arms[1].hand],
    fore: [arms[0].fore, arms[1].fore],
    hipJ: [add(hip, [-HIP, 0]), add(hip, [HIP, 0])],
    knee: [leg(0, 'knee'), leg(1, 'knee')],
    ankle: [leg(0, 'ankle'), leg(1, 'ankle')],
    pose: p
  };
}

/** 手の先 reach だけ伸ばした点（ノーツを置く所）。side は 0 が左手、1 が右手 */
export function tip(b: Body, side: 0 | 1, reach: number): P {
  const a = b.fore[side];
  return add(b.hand[side], [Math.cos(a), Math.sin(a)], reach);
}
