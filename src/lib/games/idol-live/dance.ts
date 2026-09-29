/**
 * アイドルのかっこう（3D）。腕と脚は「手と足をどこへ置くか」で書き、関節の曲がりは rig.ts が逆運動学で解く。
 * 座標はメートル。y が上、z が客席の向き、x は客席から見て右が正。L は客席から見て左の手足
 */

export type Grip = 'open' | 'fist' | 'point' | 'v' | 'heart';
export type Face = 'smile' | 'happy' | 'wink' | 'star' | 'focus' | 'sing';

/** a は真下から外へ開く角度（π/2 で真横、π で真上、負で体の前を内へ）、f は前へ出す角度、r は伸ばしぐあい（1 でまっすぐ） */
export interface Arm {
  a: number;
  f: number;
  r: number;
}

/** 腰の真下からのずれ（x は外へ、z は前へ）と、足を上げる高さ */
export interface Foot {
  x: number;
  z: number;
  lift: number;
}

export interface Pose {
  /** 立ち位置 */
  x: number;
  z: number;
  /** 体ごとの向き（正で客席から見て右を向く）。1 回転は 2π */
  spin: number;
  air: number;
  /** 腰を落とす深さ */
  crouch: number;
  /** 上体を横へ（正で頭が客席から見て右へ）・ひねる・前へ曲げる */
  lean: number;
  twist: number;
  bow: number;
  /** 首をかしげる・振り向く・うなずく */
  tilt: number;
  turn: number;
  nod: number;
  armL: Arm;
  armR: Arm;
  footL: Foot;
  footR: Foot;
  /** 手を振る大きさ 0..1。拍の上でもとの位置に戻るので、振っている手にもノーツを置ける */
  swayL: number;
  swayR: number;
  gripL: Grip;
  gripR: Grip;
  face: Face;
}

const arm = (a: number, f = 0, r = 1): Arm => ({ a, f, r });
const foot = (x = 0, z = 0, lift = 0): Foot => ({ x, z, lift });

export const BASE: Pose = {
  x: 0,
  z: 0,
  spin: 0,
  air: 0,
  crouch: 0,
  lean: 0,
  twist: 0,
  bow: 0,
  tilt: 0,
  turn: 0,
  nod: 0,
  armL: arm(0.18, 0.08, 0.97),
  armR: arm(0.18, 0.08, 0.97),
  footL: foot(0.01, 0.02),
  footR: foot(0.01, 0.02),
  swayL: 0,
  swayR: 0,
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
    spin: -p.spin,
    lean: -p.lean,
    twist: -p.twist,
    tilt: -p.tilt,
    turn: -p.turn,
    armL: p.armR,
    armR: p.armL,
    footL: p.footR,
    footR: p.footL,
    swayL: p.swayR,
    swayR: p.swayL,
    gripL: p.gripR,
    gripR: p.gripL
  };
}

/** 手を腰に当てる */
const HIP_HAND = arm(0.55, -0.35, 0.5);
/** 両手で胸の前にハート */
const HEART = arm(-0.8, 1.14, 0.56);

const RIGHT = {
  reach: pose({
    x: 0.03,
    lean: 0.1,
    tilt: 0.12,
    turn: 0.35,
    armR: arm(2.3, 0.35),
    armL: arm(0.45, 0.15, 0.85),
    footR: foot(0.1, 0.05),
    face: 'happy'
  }),
  point: pose({ lean: 0.04, tilt: 0.06, turn: 0.55, twist: 0.2, armR: arm(1.5, 0.6), gripR: 'point', armL: HIP_HAND }),
  up: pose({
    lean: 0.06,
    tilt: 0.14,
    turn: 0.15,
    nod: -0.12,
    armR: arm(2.85, 0.25),
    armL: arm(0.35, 0.25, 0.8),
    face: 'sing'
  }),
  low: pose({ lean: 0.03, turn: 0.3, twist: 0.1, armR: arm(0.95, 0.35), armL: arm(0.3, 0.1, 0.9), footR: foot(0.06) }),
  step: pose({
    x: 0.18,
    lean: 0.05,
    turn: 0.45,
    twist: -0.15,
    armR: arm(1.85, 0.3),
    armL: arm(0.5, 0.2, 0.8),
    footR: foot(0.12, 0.04),
    footL: foot(-0.02, -0.06)
  }),
  wave: pose({
    lean: 0.04,
    tilt: 0.1,
    turn: 0.25,
    armR: arm(2.4, 0.4, 0.85),
    armL: arm(0.3, 0.15, 0.9),
    swayR: 1,
    face: 'happy'
  }),
  appeal: pose({
    lean: -0.07,
    tilt: -0.16,
    turn: 0.25,
    twist: 0.15,
    // ピースを右の目の横へ
    armR: arm(2.95, 0.58, 0.42),
    gripR: 'v',
    armL: HIP_HAND,
    footL: foot(0.02, -0.12, 0.22),
    face: 'wink'
  })
};

export const POSES = {
  idle: BASE,
  heart: pose({ armL: HEART, armR: HEART, gripL: 'heart', gripR: 'heart', tilt: 0.1, bow: 0.05, face: 'happy' }),
  crouch: pose({
    crouch: 0.1,
    bow: 0.12,
    armL: arm(0.5, 0.8, 0.5),
    armR: arm(0.5, 0.8, 0.5),
    gripL: 'fist',
    gripR: 'fist',
    footL: foot(0.05),
    footR: foot(0.05),
    face: 'focus'
  }),
  jump: pose({
    air: 0.16,
    armL: arm(2.6, 0.2),
    armR: arm(2.6, 0.2),
    footL: foot(0.03, -0.1, 0.14),
    footR: foot(0.03, -0.1, 0.14),
    nod: -0.1,
    face: 'happy'
  }),
  land: pose({
    crouch: 0.08,
    armL: arm(1.35, 0.3),
    armR: arm(1.35, 0.3),
    footL: foot(0.1),
    footR: foot(0.1),
    face: 'happy'
  }),
  /** くるりと 1 回転（key の turn で回す）。腕を広げてスカートとツインテールをひるがえす */
  twirl: pose({ armL: arm(1.25, 0.2), armR: arm(1.25, 0.2), tilt: 0.1, footL: foot(0.02, 0, 0.05), face: 'happy' }),
  spread: pose({
    armL: arm(2.3, 0.3),
    armR: arm(2.3, 0.3),
    footL: foot(0.07),
    footR: foot(0.07),
    nod: -0.12,
    face: 'star'
  }),
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
  /** その key へ移るあいだに、体ごと 1 回転する */
  turn?: boolean;
}

const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);
const mixArm = (a: Arm, b: Arm, u: number): Arm => ({
  a: lerp(a.a, b.a, u),
  f: lerp(a.f, b.f, u),
  r: lerp(a.r, b.r, u)
});
const mixFoot = (a: Foot, b: Foot, u: number): Foot => ({
  x: lerp(a.x, b.x, u),
  z: lerp(a.z, b.z, u),
  lift: lerp(a.lift, b.lift, u)
});

export function blend(a: Pose, b: Pose, u: number): Pose {
  const n = (
    k: 'x' | 'z' | 'spin' | 'air' | 'crouch' | 'lean' | 'twist' | 'bow' | 'tilt' | 'turn' | 'nod' | 'swayL' | 'swayR'
  ) => lerp(a[k], b[k], u);
  const near = u < 0.5 ? a : b;
  return {
    x: n('x'),
    z: n('z'),
    spin: n('spin'),
    air: n('air'),
    crouch: n('crouch'),
    lean: n('lean'),
    twist: n('twist'),
    bow: n('bow'),
    tilt: n('tilt'),
    turn: n('turn'),
    nod: n('nod'),
    armL: mixArm(a.armL, b.armL, u),
    armR: mixArm(a.armR, b.armR, u),
    footL: mixFoot(a.footL, b.footL, u),
    footR: mixFoot(a.footR, b.footR, u),
    swayL: n('swayL'),
    swayR: n('swayR'),
    gripL: near.gripL,
    gripR: near.gripR,
    face: near.face
  };
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
    if (b.glide)
      return step(blend(a.pose, b.pose, smooth(clamp((beat - a.beat) / span))), a.pose, b.pose, beat - a.beat, span);
    const d = Math.min(span, b.turn ? 1 : 0.5);
    const u = clamp((beat - (b.beat - d)) / d);
    const p = step(blend(a.pose, b.pose, smooth(u)), a.pose, b.pose, u * d, d);
    // 回り終わりは 2π なので、次のかっこう（向き 0）へそのままつながる
    return b.turn ? { ...p, spin: p.spin + 2 * Math.PI * smooth(u) } : p;
  }
  return keys[keys.length - 1].pose;
}

/** 横へ動くあいだは、1 拍に 1 歩ずつ足を上げる（すべって見えないように）。上げるのは進む向きと逆の足から */
function step(p: Pose, a: Pose, b: Pose, t: number, span: number): Pose {
  const dx = b.x - a.x;
  if (Math.abs(dx) < 0.05 || t <= 0 || t >= span) return p;
  const steps = Math.max(1, Math.round(span));
  const phase = (t / span) * steps;
  const lift = 0.1 * Math.sin(Math.PI * (phase % 1));
  const left = (Math.floor(phase) % 2 === 0) === dx > 0;
  return left
    ? { ...p, footL: { ...p.footL, lift: p.footL.lift + lift } }
    : { ...p, footR: { ...p.footR, lift: p.footR.lift + lift } };
}

/** 拍ごとにひざを沈め、2 拍で首と上体を左右に揺らす。手を振るのは 1 拍に 1 往復で、拍の上ではもとの位置。amount は 0..1 */
export function groove(p: Pose, beat: number, amount: number): Pose {
  const wave = 0.45 * Math.sin(2 * Math.PI * beat);
  const waved = {
    ...p,
    armL: { ...p.armL, a: p.armL.a + p.swayL * wave },
    armR: { ...p.armR, a: p.armR.a - p.swayR * wave }
  };
  if (!amount || p.air > 0.01) return waved;
  const pulse = 0.5 + 0.5 * Math.cos(2 * Math.PI * beat);
  const sway = Math.sin(Math.PI * beat);
  return {
    ...waved,
    crouch: p.crouch + 0.025 * amount * pulse,
    tilt: p.tilt + 0.07 * amount * sway,
    lean: p.lean + 0.03 * amount * sway,
    nod: p.nod + 0.05 * amount * pulse
  };
}
