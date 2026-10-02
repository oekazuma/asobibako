import { ENEMIES } from './enemies';
import { hurtPlayer, makeEnemy, MAX_ENEMIES, spawnPoint, type Enemy, type World } from './world';

export interface Hazard {
  alive: boolean;
  kind: 'slam' | 'dash' | 'web';
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

/** ボスが出る何秒前に WARNING を出すか */
export const WARN_AHEAD = 3;

/** 敵の枠を 1 つ用意する。空きがなければ、自分からいちばん遠いボスでない敵の枠を使う */
function slot(w: World): number {
  const free = w.enemies.findIndex((e) => !e.alive);
  if (free >= 0) return free;
  if (w.enemies.length < MAX_ENEMIES) return w.enemies.length;
  let best = 0;
  let bd = -1;
  w.enemies.forEach((e, i) => {
    if (e.def.boss) return;
    const d = (e.x - w.player.x) ** 2 + (e.y - w.player.y) ** 2;
    if (d > bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

export function spawnBosses(w: World): void {
  const next = w.stage.bosses[w.bossNext];
  if (!next) return;
  if (w.warned === w.bossNext && w.time >= next.at - WARN_AHEAD) {
    w.warned += 1;
    w.events.push({ type: 'warning', boss: next.id });
  }
  if (w.time < next.at) return;
  w.bossNext += 1;
  const def = ENEMIES[next.id];
  const at = spawnPoint(w);
  w.enemies[slot(w)] = makeEnemy(def, at.x, at.y, def.hp);
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

function hazard(w: World, h: Omit<Hazard, 'alive'>) {
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
    e.cd = BEAR.every;
  }
  return e.state === 2 ? { vx: e.dx * BEAR.dashSpeed, vy: e.dy * BEAR.dashSpeed } : STILL;
}

/** 女王グモ。少し離れた所を保って回り込み、糸の玉を撃ち、子グモを生む */
function queen(w: World, e: Enemy, ux: number, uy: number, d: number, dt: number) {
  e.cd -= dt;
  if (e.cd <= 0) {
    e.cd = QUEEN.webEvery;
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
    e.turn = QUEEN.broodEvery;
    const def = ENEMIES[e.def.minion ?? 'spiderling'];
    for (let k = 0; k < QUEEN.brood; k++) {
      const free = w.enemies.findIndex((o) => !o.alive);
      const at = free >= 0 ? free : w.enemies.length < MAX_ENEMIES ? w.enemies.length : -1;
      if (at < 0) break;
      const a = (k / QUEEN.brood) * Math.PI * 2;
      w.enemies[at] = makeEnemy(def, e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, def.hp);
    }
  }
  // 近づきすぎたら下がり、遠ければ寄り、いつも横へ回り込む
  const radial = Math.max(-1, Math.min(1, (d - QUEEN.keep) / 30));
  const side = Math.sin(e.phase) >= 0 ? 1 : -1;
  const vx = ux * radial - uy * side;
  const vy = uy * radial + ux * side;
  const len = Math.hypot(vx, vy) || 1;
  return { vx: (vx / len) * e.def.speed, vy: (vy / len) * e.def.speed };
}

export function moveBoss(w: World, i: number, dt: number): { vx: number; vy: number } {
  const e = w.enemies[i];
  const dx = w.player.x - e.x;
  const dy = w.player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  return e.def.ai === 'bear' ? bear(w, i, e, dx / d, dy / d, dt) : queen(w, e, dx / d, dy / d, d, dt);
}

export function updateHazards(w: World, dt: number): void {
  const p = w.player;
  for (const h of w.hazards) {
    if (!h.alive) continue;
    if (h.kind === 'web') {
      h.x += h.vx * dt;
      h.y += h.vy * dt;
      h.life -= dt;
      if (h.life <= 0) h.alive = false;
      else if (p.invuln <= 0 && (h.x - p.x) ** 2 + (h.y - p.y) ** 2 < (h.r + 6) ** 2) {
        h.alive = false;
        p.slow = QUEEN.slow;
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
