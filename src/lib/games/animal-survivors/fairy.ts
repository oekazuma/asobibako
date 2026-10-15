import { healRate } from './arcana';
import { nextPlacer } from './heroes';
import { obstaclesNear, PLAYER_R } from './obstacles';
import { hasRelic } from './relics';
import { damageEnemy, type World } from './world';

export const RING_R = 30;
/** 動物から輪までの距離の幅（ドット） */
export const RING_NEAR = 60;
export const RING_FAR = 120;
export const CHARGE = 3;
export const CHARGE_DUST = 2;
/** ヌシとボスに与える、最大 HP に対する割合 */
export const BOSS_CUT = 0.1;
export const MOON_HEAL = 0.3;
export const BURST_SECS = 0.6;
/** 置き場所が障害物にかかったときにやり直す回数 */
const TRIES = 12;
/** ためはじめたときにこれより遠い動物は留めない（遠くの相棒を引き寄せない） */
const HOLD_REACH = 8;

export interface Ring {
  x: number;
  y: number;
  r: number;
}

export interface Fairy {
  /** 次の stage.rings の番号 */
  next: number;
  /** 輪が残る秒 */
  left: number;
  ring: Ring | null;
  /** ためた秒。0 ならためていない */
  charge: number;
  /** 次に置く動物を選ぶ回数（生きている動物を順に回す） */
  turn: number;
  /** 満ちた光の残り秒 */
  burst: number;
  /** 満ちた光の中心。輪は満ちたときに消えるので別に覚える */
  bx: number;
  by: number;
}

export const calmGrove = (): Fairy => ({ next: 0, left: 0, ring: null, charge: 0, turn: 0, burst: 0, bx: 0, by: 0 });

export const chargeTime = (w: World): number => (hasRelic(w, 'dust') ? CHARGE_DUST : CHARGE);

function place(w: World, life: number): void {
  const p = nextPlacer(w, w.fairy)?.player;
  if (!p) return;
  for (let i = 0; i < TRIES; i++) {
    const a = w.rand() * Math.PI * 2;
    const d = RING_NEAR + w.rand() * (RING_FAR - RING_NEAR);
    const x = p.x + Math.cos(a) * d;
    const y = p.y + Math.sin(a) * d;
    // 輪の端に立つ動物が障害物に押し出されて輪の外へ出ないよう、動物の半径ぶん余白を取る
    if (obstaclesNear(w.stage.art, x, y, RING_R + PLAYER_R, []).length) continue;
    w.fairy.ring = { x, y, r: RING_R };
    w.fairy.left = life;
    w.events.push({ type: 'swarm', text: '妖精の輪が現れた！' });
    return;
  }
}

/** 満ちた輪。画面の半分の範囲のふつうの敵を倒し、ヌシとボスは最大 HP の一部を削る */
function burst(w: World, ring: Ring): void {
  const f = w.fairy;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    const d = e.def;
    if (!e.alive || d.prop || d.part || d.metal) continue;
    if (Math.abs(e.x - ring.x) > w.view.w / 2 || Math.abs(e.y - ring.y) > w.view.h / 2) continue;
    // ヌシとボスは倒れうるので、倒した数はあとの生死で数える
    damageEnemy(w, i, d.boss || d.chief ? e.max * BOSS_CUT : e.hp, 0, 0);
    if (!e.alive) w.fairyKills += 1;
  }
  if (hasRelic(w, 'moon'))
    w.heroes.forEach((h, i) => {
      if (h.down || h.gone) return;
      const before = h.player.hp;
      h.player.hp = Math.min(h.stats.maxHp, before + h.stats.maxHp * MOON_HEAL * healRate(w));
      const amount = Math.round(h.player.hp - before);
      if (amount > 0) w.events.push({ type: 'heal', amount, hero: i });
    });
  f.bx = ring.x;
  f.by = ring.y;
  f.burst = BURST_SECS;
  f.ring = null;
  f.charge = 0;
  // 持ち主を付けないので、2 台とも光る
  w.events.push({ type: 'fairy' });
}

/** 時刻になったら輪を置き、中に入った動物がいればためる。時計の品で止まるので、呼ぶ側が freeze を見る */
export function stepFairy(w: World, dt: number): void {
  const f = w.fairy;
  const next = w.stage.rings[f.next];
  if (next && w.time >= next.at) {
    f.next += 1;
    place(w, next.len);
  }
  const ring = f.ring;
  if (!ring) return;
  // ためはじめたら閉じ込めているので、満ちるまで消さない
  if (f.charge <= 0) f.left -= dt;
  if (f.left <= 0) {
    f.ring = null;
    return;
  }
  // ためはじめたら、中の動物が全員出ても戻さない（閉じ込めるので出られない）
  const inside = w.heroes.some(
    (h) => !h.down && !h.gone && Math.hypot(h.player.x - ring.x, h.player.y - ring.y) <= ring.r
  );
  if (f.charge > 0 || inside) f.charge += dt;
  if (f.charge >= chargeTime(w)) burst(w, ring);
}

/** ためているあいだ、輪のそばの動物を輪の内側へ戻す。倒れた動物は呼ぶ側が動かさない */
export function holdInRing(w: World, p: { x: number; y: number }): void {
  const ring = w.fairy.ring;
  if (!ring || w.fairy.charge <= 0) return;
  const dx = p.x - ring.x;
  const dy = p.y - ring.y;
  const d = Math.hypot(dx, dy);
  if (d <= ring.r - 2 || d > ring.r + HOLD_REACH) return;
  p.x = ring.x + (dx / d) * (ring.r - 2);
  p.y = ring.y + (dy / d) * (ring.r - 2);
}
