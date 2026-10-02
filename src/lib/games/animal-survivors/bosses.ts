import { rolled, yeti } from './bosses-snow';
import { ENEMIES } from './enemies';
import { hurtPlayer, makeEnemy, MAX_ENEMIES, spawnPoint, type Enemy, type World } from './world';

export interface Hazard {
  alive: boolean;
  kind: 'slam' | 'dash' | 'web' | 'ball' | 'pounce';
  /** 予告の持ち主（ボスの enemies の番号）。web は -1 */
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 予告の残り秒。0 を切ったら当たる（web は 0 で始まる） */
  delay: number;
  /** 当たったあとに見せる残り秒。web は飛ぶ残り秒 */
  life: number;
  /** web の絵（ITEM_ART の名前）。無ければ糸の玉 */
  art?: string;
  dmg: number;
}

/** ボスの体力に掛ける面の硬さを弱める（そのままだと序盤のボスに 2 分かかる） */
export const BOSS_HP = 0.7;

/** ボスが出る何秒前に WARNING を出すか */
export const WARN_AHEAD = 3;

/** 敵の枠を 1 つ用意する。空きがなければ、自分からいちばん遠いふつうの敵の枠を使う（ボス・ヌシ・きらきらハリネズミは消さない） */
export function slot(w: World): number {
  const free = w.enemies.findIndex((e) => !e.alive);
  if (free >= 0) return free;
  if (w.enemies.length < MAX_ENEMIES) return w.enemies.length;
  let best = 0;
  let bd = -1;
  w.enemies.forEach((e, i) => {
    if (e.def.boss || e.def.chief || e.def.metal) return;
    const d = (e.x - w.player.x) ** 2 + (e.y - w.player.y) ** 2;
    if (d > bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

/** 同じ時刻のボスは WARNING を 1 回だけ出し、いっしょに出す */
export function spawnBosses(w: World): void {
  const list = w.stage.bosses;
  while (w.warned < list.length && w.time >= list[w.warned].at - WARN_AHEAD) {
    const b = list[w.warned];
    if (list[w.warned - 1]?.at !== b.at)
      w.events.push({ type: 'warning', boss: b.id, ...(b.title && { title: b.title }) });
    w.warned += 1;
  }
  while (w.bossNext < list.length && w.time >= list[w.bossNext].at) {
    const b = list[w.bossNext++];
    const def = ENEMIES[b.id];
    const at = spawnPoint(w);
    const hp = def.hp * (b.hp ?? 1) * w.stage.toughness(b.at) * BOSS_HP;
    // 体力のバーは def.hp を満タンとして描くので、表も出たときの体力にそろえる
    w.enemies[slot(w)] = makeEnemy({ ...def, hp, ...(b.rage && { rage: b.rage }) }, at.x, at.y, hp);
  }
}

const BEAR = {
  every: 4,
  dashWarn: 0.7,
  dashTime: 0.9,
  dashSpeed: 210,
  dashLength: 120,
  slamWarn: 1,
  slamR: 56,
  slamDmg: 28
};
const QUEEN = {
  keep: 110,
  webEvery: 3,
  webs: 5,
  webSpread: (15 * Math.PI) / 180,
  webSpeed: 90,
  webLife: 3,
  webR: 4,
  webDmg: 6,
  slow: 1,
  broodEvery: 8,
  brood: 4
};
const STILL = { vx: 0, vy: 0 };

export function hazard(w: World, h: Omit<Hazard, 'alive'>) {
  const free = w.hazards.find((o) => !o.alive);
  if (free) Object.assign(free, h, { alive: true });
  else w.hazards.push({ ...h, alive: true });
}

/** 巨大ベア。state 0 追う・1 突進の予告・2 突進・3 地ならしの予告 */
function bear(w: World, i: number, e: Enemy, ux: number, uy: number, dt: number) {
  if (e.state === 0) {
    e.cd -= dt;
    if (e.cd > 0) return { vx: ux * e.def.speed, vy: uy * e.def.speed };
    if (e.turn % 2 === 0) {
      e.state = 1;
      e.wait = BEAR.dashWarn;
      e.dx = ux;
      e.dy = uy;
      hazard(w, {
        kind: 'dash',
        owner: i,
        x: e.x,
        y: e.y,
        vx: ux,
        vy: uy,
        r: BEAR.dashLength,
        delay: BEAR.dashWarn,
        life: 0,
        dmg: 0
      });
    } else {
      e.state = 3;
      e.wait = BEAR.slamWarn;
      hazard(w, {
        kind: 'slam',
        owner: i,
        x: e.x,
        y: e.y,
        vx: 0,
        vy: 0,
        r: BEAR.slamR,
        delay: BEAR.slamWarn,
        life: 0.3,
        dmg: BEAR.slamDmg
      });
    }
    e.turn += 1;
    return STILL;
  }
  e.wait -= dt;
  if (e.state === 1) {
    if (e.wait <= 0) {
      e.state = 2;
      e.wait = BEAR.dashTime;
    }
    return STILL;
  }
  if (e.wait <= 0) {
    e.state = 0;
    e.cd = BEAR.every / (e.def.rage ?? 1);
  }
  return e.state === 2 ? { vx: e.dx * BEAR.dashSpeed, vy: e.dy * BEAR.dashSpeed } : STILL;
}

/** 女王グモ。少し離れた所を保って回り込み、糸の玉を撃ち、子グモを生む */
function queen(w: World, e: Enemy, ux: number, uy: number, d: number, dt: number) {
  e.cd -= dt;
  if (e.cd <= 0) {
    e.cd = QUEEN.webEvery / (e.def.rage ?? 1);
    const a0 = Math.atan2(uy, ux);
    for (let k = 0; k < QUEEN.webs; k++) {
      const a = a0 + (k - (QUEEN.webs - 1) / 2) * QUEEN.webSpread;
      hazard(w, {
        kind: 'web',
        owner: -1,
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * QUEEN.webSpeed,
        vy: Math.sin(a) * QUEEN.webSpeed,
        r: QUEEN.webR,
        delay: 0,
        life: QUEEN.webLife,
        dmg: QUEEN.webDmg,
        art: e.def.shot
      });
    }
  }
  e.turn -= dt;
  if (e.turn <= 0) {
    e.turn = QUEEN.broodEvery / (e.def.rage ?? 1);
    brood(w, e, QUEEN.brood);
  }
  // 近づきすぎたら下がり、遠ければ寄り、いつも横へ回り込む
  const radial = Math.max(-1, Math.min(1, (d - QUEEN.keep) / 30));
  const side = Math.sin(e.phase) >= 0 ? 1 : -1;
  const vx = ux * radial - uy * side;
  const vy = uy * radial + ux * side;
  const len = Math.hypot(vx, vy) || 1;
  return { vx: (vx / len) * e.def.speed, vy: (vy / len) * e.def.speed };
}

/** ボスのまわりに手下を n 匹出す。入れ物が埋まっていれば出せるだけ */
export function brood(w: World, e: Enemy, n: number): void {
  const def = ENEMIES[e.def.minion ?? 'spiderling'];
  for (let k = 0; k < n; k++) {
    const free = w.enemies.findIndex((o) => !o.alive);
    const at = free >= 0 ? free : w.enemies.length < MAX_ENEMIES ? w.enemies.length : -1;
    if (at < 0) break;
    const a = (k / n) * Math.PI * 2;
    w.enemies[at] = makeEnemy(def, e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, def.hp);
  }
}

export function moveBoss(w: World, i: number, dt: number): { vx: number; vy: number } {
  const e = w.enemies[i];
  const dx = w.player.x - e.x;
  const dy = w.player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  if (e.def.ai === 'bear') return bear(w, i, e, dx / d, dy / d, dt);
  if (e.def.ai === 'yeti') return yeti(w, i, e, dx / d, dy / d, dt);
  return queen(w, e, dx / d, dy / d, d, dt);
}

export function updateHazards(w: World, dt: number): void {
  const p = w.player;
  for (const h of w.hazards) {
    if (!h.alive) continue;
    if (h.kind === 'web' || h.kind === 'ball') {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.life -= dt;
      if (h.kind === 'ball') h.r = rolled(h.life);
      if (h.life <= 0) h.alive = false;
      else if (p.invuln <= 0 && (h.x - p.x) ** 2 + (h.y - p.y) ** 2 < (h.r + 6) ** 2) {
        h.alive = false;
        if (h.kind === 'web') p.slow = QUEEN.slow;
        hurtPlayer(w, h.dmg);
      }
      continue;
    }
    const owner = w.enemies[h.owner];
    // 予告のあいだに持ち主が倒れたら、予告ごと消す
    if (h.delay > 0 && !(owner?.alive && owner.def.boss)) {
      h.alive = false;
      continue;
    }
    if (h.kind === 'dash') {
      h.delay -= dt;
      if (!owner.alive || owner.state !== 1) h.alive = false;
      continue;
    }
    if (h.delay > 0) {
      h.delay -= dt;
      if (h.delay <= 0 && p.invuln <= 0 && (p.x - h.x) ** 2 + (p.y - h.y) ** 2 < h.r ** 2) hurtPlayer(w, h.dmg);
    } else {
      h.life -= dt;
      if (h.life <= 0) h.alive = false;
    }
  }
}
