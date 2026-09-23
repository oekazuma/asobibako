import { ANIMALS, GERM_R, teethFor, type AnimalId, type Expression, type GermKind, type Tooth } from './animals';

export type ToolId = 'brush' | 'drill' | 'tweezers' | 'filling' | 'pliers' | 'shot' | 'pat';

export type SymptomDef =
  | { type: 'plaque'; tooth: number; amount: number }
  | { type: 'cavity'; tooth: number; depth: number; germs: number; kind: GermKind }
  | { type: 'loose'; tooth: number };

export interface Stage {
  animal: AnimalId;
  /** トレイに並べる道具。その面で使うものだけ */
  tools: ToolId[];
  symptoms: SymptomDef[];
  /** 最初のいたいメーター。怖がりの患者さんは最初からたまっている */
  pain0: number;
  /** 麻酔していない虫歯を 1 秒削ったときに増えるメーター */
  painRate: number;
  /** 注射の回数。Infinity は無制限 */
  shots: number;
}

export type Symptom =
  | { type: 'plaque'; tooth: number; left: number; total: number }
  | {
      type: 'cavity';
      tooth: number;
      stage: 'decay' | 'germs' | 'hole' | 'done';
      drill: number;
      total: number;
      germs: number;
      kind: GermKind;
      fill: number;
    }
  | { type: 'loose'; tooth: number; pull: number; done: boolean };

export interface Germ {
  id: number;
  kind: GermKind;
  /** 出てきた虫歯（symptoms の番号） */
  cavity: number;
  x: number;
  y: number;
  hx: number;
  hy: number;
  held: boolean;
  gone: boolean;
  born: number;
}

export type Grip = { kind: 'germ'; id: number } | { kind: 'tooth'; symptom: number; y0: number; base: number };

export interface GameState {
  stage: Stage;
  teeth: Tooth[];
  symptoms: Symptom[];
  germs: Germ[];
  tool: ToolId;
  pain: number;
  shots: number;
  /** 痛がる顔を続ける残りの秒 */
  hurting: number;
  /** よしよしでなだめている最中。CALM_ON でなだめ始め、CALM_OFF まで下げる */
  calming: boolean;
  grip: Grip | null;
  /** 道具の先端の直前の位置。こすった距離を出す */
  last: { x: number; y: number } | null;
  /** 治療が進まないまま過ぎた秒 */
  idle: number;
  time: number;
  result: 'clear' | 'cried' | null;
  nextId: number;
}

type At = { x: number; y: number };
export type DentistEvent =
  | ({ type: 'progress'; tool: ToolId } & At)
  | ({ type: 'cleaned' | 'drilled' | 'filled' | 'numb' | 'grab' | 'escape' | 'byebye' | 'slip' | 'ouch' | 'pat' } & At)
  | ({ type: 'pulled'; tooth: number } & At)
  | ({ type: 'wrong'; need: ToolId } & At)
  | ({ type: 'order' } & At)
  | { type: 'cry' | 'clear' };

export const WORLD_H = 1.3;
/** 道具の先端は指の少し上。指で先端が隠れないようにする */
export const TIP = 0.07;
/** よしよしでなでる頭の範囲 */
export const HEAD = { x: 0.5, y: 0.4, r: 0.11 };
export const TRASH = { x: 0.87, y: 1.17, r: 0.085 };
export const FILL_S = 0.6;
const HIT = 0.008;
const GRAB = 0.05;
/** ぐらぐらの歯を抜くのに引っぱる長さ */
const PULL = 0.12;
const RETURN_SPEED = 1.2;
/** おやぶんはピンセットに逆らい、この速さでしかついてこない */
const BOSS_SPEED = 0.35;
const QUICK_SWAY = 0.03;
/** 健康な歯を削ると、虫歯よりこれだけ速くメーターがたまる */
const HEALTHY_PAIN = 2.5;
const SLIP_PAIN = 0.04;
/** 歯を 1 本抜ききると、painRate のこの割合だけメーターがたまる */
const PULL_PAIN = 0.5;
const PAT_GAIN = 1.2;
export const CALM_ON = 0.6;
const CALM_OFF = 0.3;
const HURT_S = 0.35;

export function createState(stage: Stage): GameState {
  const symptoms: Symptom[] = stage.symptoms.map((s) => {
    if (s.type === 'plaque') return { type: 'plaque', tooth: s.tooth, left: s.amount, total: s.amount };
    if (s.type === 'loose') return { type: 'loose', tooth: s.tooth, pull: 0, done: false };
    return {
      type: 'cavity',
      tooth: s.tooth,
      stage: 'decay',
      drill: s.depth,
      total: s.depth,
      germs: s.germs,
      kind: s.kind,
      fill: FILL_S
    };
  });
  return {
    stage,
    teeth: teethFor(ANIMALS[stage.animal]),
    symptoms,
    germs: [],
    tool: stage.tools[0],
    pain: stage.pain0,
    shots: stage.shots,
    hurting: 0,
    calming: false,
    grip: null,
    last: null,
    idle: 0,
    time: 0,
    result: null,
    nextId: 1
  };
}

export function select(state: GameState, tool: ToolId): boolean {
  if (!state.stage.tools.includes(tool) || state.grip !== null) return false;
  state.tool = tool;
  return true;
}

/** 治すのに次に要る道具。治りきった症状は null */
export function needFor(s: Symptom): ToolId | null {
  if (s.type === 'plaque') return s.left > 0 ? 'brush' : null;
  if (s.type === 'loose') return s.done ? null : 'pliers';
  if (s.stage === 'decay') return 'drill';
  if (s.stage === 'germs') return 'tweezers';
  if (s.stage === 'hole') return 'filling';
  return null;
}

export function toothAt(state: GameState, x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  state.teeth.forEach((t, i) => {
    if (t.gone || Math.abs(x - t.x) > t.w / 2 + HIT || Math.abs(y - t.y) > t.h / 2 + HIT) return;
    const d = Math.hypot(x - t.x, y - t.y);
    if (d < bestD) [best, bestD] = [i, d];
  });
  return best;
}

/** その歯のまだ治っていない症状 */
export function symptomOn(state: GameState, tooth: number): Symptom | undefined {
  return state.symptoms.find((s) => s.tooth === tooth && needFor(s) !== null);
}

/** すばしっこいバイキンは、穴にいるあいだ左右に逃げ回る */
export function germPos(g: Germ, time: number): [number, number] {
  const home = Math.hypot(g.x - g.hx, g.y - g.hy) < 0.002;
  if (g.kind !== 'quick' || g.held || !home) return [g.x, g.y];
  return [g.x + Math.sin(time * 5 + g.id) * QUICK_SWAY, g.y];
}

function neighbors(state: GameState, i: number): number[] {
  const per = state.teeth.length / 2;
  const row = Math.floor(i / per);
  return [i - 1, i, i + 1].filter((j) => j >= 0 && j < state.teeth.length && Math.floor(j / per) === row);
}

function progress(state: GameState, events: DentistEvent[], tool: ToolId, x: number, y: number) {
  state.idle = 0;
  events.push({ type: 'progress', tool, x, y });
}

function hurt(state: GameState, amount: number, tooth: number, events: DentistEvent[]) {
  const t = state.teeth[tooth];
  if (!(amount > 0) || t.numb) return;
  state.pain = Math.min(1, state.pain + amount);
  state.hurting = HURT_S;
  events.push({ type: 'ouch', x: t.x, y: t.y });
}

function germAt(state: GameState, x: number, y: number): Germ | undefined {
  let best: Germ | undefined;
  let bestD = Infinity;
  for (const g of state.germs) {
    if (g.gone) continue;
    const [gx, gy] = germPos(g, state.time);
    const d = Math.hypot(x - gx, y - gy);
    if (d < GERM_R[g.kind] + GRAB && d < bestD) [best, bestD] = [g, d];
  }
  return best;
}

/** 先端の近くにバイキンがいれば、つまんで持ち上げる */
function grabGerm(state: GameState, x: number, y: number, events: DentistEvent[]): boolean {
  const germ = germAt(state, x, y);
  if (!germ) return false;
  [germ.x, germ.y] = germPos(germ, state.time);
  germ.held = true;
  state.grip = { kind: 'germ', id: germ.id };
  events.push({ type: 'grab', x, y });
  return true;
}

export function touch(state: GameState, x: number, y: number): DentistEvent[] {
  const events: DentistEvent[] = [];
  if (state.result) return events;
  state.last = { x, y };
  const tool = state.tool;
  if (tool === 'pat') return events;
  if (tool === 'tweezers' && grabGerm(state, x, y, events)) return events;
  const i = toothAt(state, x, y);
  if (i < 0) return events;
  const tooth = state.teeth[i];
  const s = symptomOn(state, i);
  if (tool === 'shot') {
    if (state.shots <= 0) return events;
    for (const j of neighbors(state, i)) state.teeth[j].numb = true;
    state.shots -= 1;
    events.push({ type: 'numb', x: tooth.x, y: tooth.y });
    return events;
  }
  if (tool === 'pliers') {
    if (s?.type === 'loose') {
      state.grip = { kind: 'tooth', symptom: state.symptoms.indexOf(s), y0: y, base: s.pull };
      events.push({ type: 'grab', x, y });
      return events;
    }
    hurt(state, SLIP_PAIN, i, events);
    events.push({ type: 'slip', x, y });
  }
  const need = s ? needFor(s) : null;
  if (!need || need === tool) return events;
  if (s?.type === 'cavity' && s.stage === 'germs' && tool === 'filling') events.push({ type: 'order', x, y });
  else events.push({ type: 'wrong', need, x, y });
  return events;
}

export function rub(state: GameState, x: number, y: number, dt: number): DentistEvent[] {
  const events: DentistEvent[] = [];
  if (state.result || !state.last) return events;
  const dist = Math.hypot(x - state.last.x, y - state.last.y);
  state.last = { x, y };
  const tool = state.tool;
  const grip = state.grip;
  if (tool === 'pat') {
    if (dist > 0 && Math.hypot(x - HEAD.x, y - HEAD.y) < HEAD.r) {
      state.pain = Math.max(0, state.pain - dist * PAT_GAIN);
      state.idle = 0;
      events.push({ type: 'pat', x, y });
    }
    return events;
  }
  // 小さい子はバイキンの上に指を置くより、ピンセットを持ったまま指をすべらせて近づけることが多い
  if (tool === 'tweezers' && grip === null) {
    grabGerm(state, x, y, events);
    return events;
  }
  if (grip?.kind === 'germ') {
    const g = state.germs.find((germ) => germ.id === grip.id)!;
    if (g.kind === 'boss') {
      const d = Math.hypot(x - g.x, y - g.y);
      const k = Math.min(1, (BOSS_SPEED * dt) / Math.max(d, 1e-9));
      g.x += (x - g.x) * k;
      g.y += (y - g.y) * k;
    } else [g.x, g.y] = [x, y];
    return events;
  }
  if (grip?.kind === 'tooth') {
    const s = state.symptoms[grip.symptom];
    if (s.type !== 'loose') return events;
    const tooth = state.teeth[s.tooth];
    const away = tooth.row === 'upper' ? 1 : -1;
    const p = Math.min(1, Math.max(0, grip.base + ((y - grip.y0) * away) / PULL));
    if (p > s.pull) {
      hurt(state, (p - s.pull) * state.stage.painRate * PULL_PAIN, s.tooth, events);
      s.pull = p;
      progress(state, events, 'pliers', tooth.x, tooth.y);
    }
    if (s.pull >= 1) {
      s.done = true;
      tooth.gone = true;
      state.grip = null;
      events.push({ type: 'pulled', tooth: s.tooth, x: tooth.x, y: tooth.y });
    }
    return events;
  }
  const i = toothAt(state, x, y);
  if (i < 0) return events;
  const tooth = state.teeth[i];
  const s = symptomOn(state, i);
  if (tool === 'brush' && s?.type === 'plaque' && dist > 0) {
    s.left = Math.max(0, s.left - dist);
    progress(state, events, tool, x, y);
    if (s.left === 0) events.push({ type: 'cleaned', x: tooth.x, y: tooth.y });
  } else if (tool === 'drill') {
    const decay = s?.type === 'cavity' && s.stage === 'decay' ? s : null;
    hurt(state, state.stage.painRate * dt * (decay ? 1 : HEALTHY_PAIN), i, events);
    if (decay) {
      decay.drill = Math.max(0, decay.drill - dt);
      progress(state, events, tool, x, y);
      if (decay.drill === 0) {
        decay.stage = 'germs';
        const cavity = state.symptoms.indexOf(decay);
        for (let k = 0; k < decay.germs; k++) {
          const hx = tooth.x + (k - (decay.germs - 1) / 2) * 0.04;
          state.germs.push({
            id: state.nextId++,
            kind: decay.kind,
            cavity,
            x: hx,
            y: tooth.y,
            hx,
            hy: tooth.y,
            held: false,
            gone: false,
            born: state.time
          });
        }
        events.push({ type: 'drilled', x: tooth.x, y: tooth.y });
      }
    }
  } else if (tool === 'filling' && s?.type === 'cavity' && s.stage === 'hole') {
    s.fill = Math.max(0, s.fill - dt);
    progress(state, events, tool, x, y);
    if (s.fill === 0) {
      s.stage = 'done';
      events.push({ type: 'filled', x: tooth.x, y: tooth.y });
    }
  }
  return events;
}

export function lift(state: GameState, x: number, y: number): DentistEvent[] {
  const events: DentistEvent[] = [];
  const grip = state.grip;
  state.grip = null;
  state.last = null;
  if (grip?.kind !== 'germ') return events;
  const g = state.germs.find((germ) => germ.id === grip.id)!;
  g.held = false;
  if (Math.hypot(g.x - TRASH.x, g.y - TRASH.y) < TRASH.r) {
    g.gone = true;
    state.idle = 0;
    events.push({ type: 'byebye', x: TRASH.x, y: TRASH.y });
    const cavity = state.symptoms[g.cavity];
    if (cavity.type === 'cavity' && state.germs.every((other) => other.cavity !== g.cavity || other.gone))
      cavity.stage = 'hole';
  } else events.push({ type: 'escape', x, y });
  return events;
}

export function step(state: GameState, dt: number): DentistEvent[] {
  const events: DentistEvent[] = [];
  if (state.result) return events;
  state.time += dt;
  state.idle += dt;
  state.hurting = Math.max(0, state.hurting - dt);
  for (const g of state.germs) {
    if (g.gone || g.held) continue;
    const d = Math.hypot(g.hx - g.x, g.hy - g.y);
    const k = Math.min(1, (RETURN_SPEED * dt) / Math.max(d, 1e-9));
    g.x += (g.hx - g.x) * k;
    g.y += (g.hy - g.y) * k;
  }
  if (state.stage.tools.includes('pat')) {
    if (state.pain >= CALM_ON) state.calming = true;
    else if (state.pain < CALM_OFF) state.calming = false;
  }
  if (state.pain >= 1) {
    state.result = 'cried';
    state.grip = null;
    events.push({ type: 'cry' });
  } else if (state.symptoms.every((s) => needFor(s) === null) && state.germs.every((g) => g.gone)) {
    state.result = 'clear';
    events.push({ type: 'clear' });
  }
  return events;
}

export function expression(state: GameState): Expression {
  if (state.result === 'cried') return 'cry';
  if (state.result === 'clear') return 'happy';
  if (state.hurting > 0) return 'hurt';
  if (state.pain >= 0.5) return 'nervous';
  return 'calm';
}

/** 注射もよしよしも使わずに治したときにたまるメーター。1 以上なら痛みへの手当てが要る面 */
export function painWithoutCare(stage: Stage): number {
  let work = 0;
  for (const s of stage.symptoms) {
    if (s.type === 'cavity') work += s.depth;
    if (s.type === 'loose') work += PULL_PAIN;
  }
  return stage.pain0 + stage.painRate * work;
}
