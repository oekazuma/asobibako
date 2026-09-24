/**
 * ねこじゃらしの揺れ。単位はメートルと秒で、y は床からの高さ。
 * 指が決めるのは「竿の先がまっすぐなら来る所」（hand）で、しなる竿の先（tip）はそこへばねで引かれて遅れ、行きすぎて揺れる。
 * 竿の先からひもを質点の鎖（位置の Verlet と長さの拘束）で垂らし、最後の 2 つをふさの根元（重い玉）と羽根の先にする。
 * 羽根の先は軽くて風を強く受けるので、振ると根元より遅れてなびき、床ではうしろへ引きずられる
 */

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export interface Wand {
  hand: V3;
  tip: V3;
  tipV: V3;
  /** 0 が竿の先、POM がふさの根元、最後が羽根の先 */
  nodes: V3[];
  prev: V3[];
  /** ふさの根元の速さ m/s */
  speed: number;
}

const STRING = 0.34;
const FEATHER = 0.13;
const LINKS = 5;
export const POM = LINKS;
const TAIL = LINKS + 1;
export const POM_R = 0.02;
/** 節の長さ・重さの逆数・空気の抵抗（1/秒）・床に触れる半径 */
const LEN = (i: number) => (i === TAIL ? FEATHER : STRING / LINKS);
const INV = (i: number) => (i === 0 ? 0 : i === POM ? 1 : i === TAIL ? 2.5 : 4);
const DRAG = (i: number) => (i === POM ? 1.5 : i === TAIL ? 3 : 1.6);
const RADIUS = (i: number) => (i === POM ? POM_R : 0.006);
const G = 9.8;
/** 竿のしなり。低めの減衰で、止めたあと数回ふるえる */
const ROD_W = 20;
const ROD_Z = 0.3;
/** 床に置いたときひもを少したるませ、ふさを床へ寝かせる */
const SLACK = 0.1;

const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const copy = (p: V3): V3 => ({ ...p });

function goalOf(t: V3): V3 {
  return v3(t.x, t.y + STRING + POM_R - SLACK * Math.max(0, 1 - t.y / 0.1), t.z);
}

/** ふさを at に置いた、揺れていないねこじゃらし */
export function createWand(at: V3): Wand {
  const hand = goalOf(at);
  const nodes: V3[] = [];
  for (let i = 0; i <= TAIL; i++) {
    const down = Math.min(i, LINKS) * (STRING / LINKS) + (i === TAIL ? FEATHER : 0);
    nodes.push(v3(hand.x, Math.max(RADIUS(i), hand.y - down), hand.z));
  }
  return { hand, tip: copy(hand), tipV: v3(0, 0, 0), nodes, prev: nodes.map(copy), speed: 0 };
}

/** ふさとひもが入りこまない球（ペットの胴と頭） */
export interface Ball extends V3 {
  r: number;
}

/**
 * target はふさを持っていきたい所（y が 0 なら床の上で引きずる）。
 * bite を渡すと、そのあいだふさの根元をそこ（猫の口）に留める
 */
export function stepWand(w: Wand, target: V3, dt: number, bite: V3 | null = null, balls: Ball[] = []): void {
  dt = Math.min(dt, 0.1);
  if (!(dt > 0)) return;
  const goal = goalOf(target);
  const n = Math.ceil(dt / (1 / 120));
  const h = dt / n;
  const start = copy(w.nodes[POM]);
  for (let s = 0; s < n; s++) {
    const k = 1 - Math.exp(-14 * h);
    w.hand.x += (goal.x - w.hand.x) * k;
    w.hand.y += (goal.y - w.hand.y) * k;
    w.hand.z += (goal.z - w.hand.z) * k;
    for (const a of ['x', 'y', 'z'] as const) {
      w.tipV[a] += (ROD_W * ROD_W * (w.hand[a] - w.tip[a]) - 2 * ROD_Z * ROD_W * w.tipV[a]) * h;
      w.tip[a] += w.tipV[a] * h;
    }
    if (bite) tug(w, bite);
    integrate(w, h, bite, balls);
  }
  const p = w.nodes[POM];
  w.speed = Math.hypot(p.x - start.x, p.y - start.y, p.z - start.z) / dt;
}

/**
 * 噛まれたふさがひもの長さより遠いと、竿の先をそちらへしならせて届かせる。
 * 伸びたひもを拘束で一気に戻すと、離したとたんにふさが跳ね飛ぶため。離すと竿のばねで戻って揺れる
 */
function tug(w: Wand, bite: V3) {
  const t = w.tip;
  const d = Math.hypot(t.x - bite.x, t.y - bite.y, t.z - bite.z);
  const max = STRING * 0.95;
  if (d <= max) return;
  const k = max / d;
  t.x = bite.x + (t.x - bite.x) * k;
  t.y = bite.y + (t.y - bite.y) * k;
  t.z = bite.z + (t.z - bite.z) * k;
  w.tipV = v3(0, 0, 0);
}

function integrate(w: Wand, h: number, bite: V3 | null, balls: Ball[]) {
  const { nodes, prev } = w;
  nodes[0] = copy(w.tip);
  prev[0] = copy(w.tip);
  for (let i = 1; i < nodes.length; i++) {
    const p = nodes[i];
    const q = prev[i];
    const keep = Math.exp(-DRAG(i) * h);
    const vx = (p.x - q.x) * keep;
    const vy = (p.y - q.y) * keep;
    const vz = (p.z - q.z) * keep;
    prev[i] = copy(p);
    p.x += vx;
    p.y += vy - G * h * h;
    p.z += vz;
  }
  if (bite) {
    nodes[POM] = copy(bite);
    prev[POM] = copy(bite);
  }
  const inv = (i: number) => (bite && i === POM ? 0 : INV(i));
  for (let it = 0; it < 8; it++) {
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1];
      const b = nodes[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const d = Math.hypot(dx, dy, dz);
      const wa = inv(i - 1);
      const wb = inv(i);
      if (d < 1e-9 || wa + wb === 0) continue;
      // ひもは縮まない向きには逆らわない（たるむ）。羽根は軸があるので両向きに保つ
      if (i !== TAIL && d < LEN(i)) continue;
      const f = (d - LEN(i)) / d / (wa + wb);
      a.x += dx * f * wa;
      a.y += dy * f * wa;
      a.z += dz * f * wa;
      b.x -= dx * f * wb;
      b.y -= dy * f * wb;
      b.z -= dz * f * wb;
    }
    push(w, balls, bite);
    floor(w, it === 7);
  }
}

/** 体に当たった節を球の外へ押し出す。ふさが猫の背中に埋まらず、なでるように滑る */
function push(w: Wand, balls: Ball[], bite: V3 | null) {
  for (const b of balls)
    for (let i = 1; i < w.nodes.length; i++) {
      if (bite && i === POM) continue;
      const p = w.nodes[i];
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const dz = p.z - b.z;
      const d = Math.hypot(dx, dy, dz);
      if (d >= b.r || d < 1e-6) continue;
      const k = b.r / d;
      p.x = b.x + dx * k;
      p.y = b.y + dy * k;
      p.z = b.z + dz * k;
    }
}

/** 床に触れた節は沈まず、横の動きをこすれで失う（引きずる） */
function floor(w: Wand, rub: boolean) {
  for (let i = 1; i < w.nodes.length; i++) {
    const p = w.nodes[i];
    const r = RADIUS(i);
    if (p.y > r + 1e-6) continue;
    const q = w.prev[i];
    p.y = r;
    q.y = Math.max(q.y, r);
    if (!rub) continue;
    q.x = p.x - (p.x - q.x) * 0.93;
    q.z = p.z - (p.z - q.z) * 0.93;
  }
}
