import { brood, circle, hazard } from './bosses';
import { ENEMIES } from './enemies';
import { makeEnemy, MAX_ENEMIES, type Enemy, type World } from './world';

export const BOAR = {
  every: 2.5,
  warn: 1,
  speed: 260,
  /** 突進の長さ（ドット）。画面の幅より長く、端から端まで走る */
  length: 320,
  charges: 3,
  rest: 2,
  dashAtk: 34,
  mudEvery: 0.12,
  mudR: 14,
  mudLife: 3,
  /** 突進にかかる秒 */
  time: 320 / 260
};

export const EAGLE = {
  keep: 130,
  every: 4.5,
  warn: 1.2,
  r: 40,
  dmg: 30,
  feathers: 8,
  featherSpeed: 100,
  featherLife: 2.5,
  featherR: 4,
  featherDmg: 10
};

export const TREE = {
  every: 3.2,
  warn: 1,
  roots: 4,
  /** 根っこを出す、自分からの広がり（ドット） */
  spread: 50,
  r: 16,
  dmg: 26,
  brood: 3
};

export const SNAKE = {
  segments: 10,
  /** 節どうしの間（ドット） */
  gap: 9,
  every: 4,
  warn: 0.8,
  lungeSpeed: 220,
  lungeTime: 0.5,
  lungeLength: 110
};

const STILL = { vx: 0, vy: 0 };

/**
 * 大イノシシ。state 0 追う・1 突進の予告・2 突進・5 休む。
 * 3 回続けて突進し、突進のたびに自分のいる向きへ向き直す。通ったあとに土ぼこりを残す
 */
export function boar(w: World, i: number, e: Enemy, ux: number, uy: number, dt: number) {
  if (e.state === 0) {
    e.cd -= dt;
    if (e.cd > 0) return { vx: ux * e.def.speed, vy: uy * e.def.speed };
    e.turn = 0;
    aim(w, i, e, ux, uy);
    return STILL;
  }
  e.wait -= dt;
  if (e.state === 1) {
    if (e.wait <= 0) {
      e.state = 2;
      e.wait = BOAR.time;
      e.phase = 0;
    }
    return STILL;
  }
  if (e.state === 2) {
    e.phase -= dt;
    if (e.phase <= 0) {
      e.phase = BOAR.mudEvery;
      hazard(w, {
        kind: 'mud',
        owner: -1,
        x: e.x,
        y: e.y,
        vx: 0,
        vy: 0,
        r: BOAR.mudR,
        delay: 0,
        life: BOAR.mudLife,
        dmg: 0
      });
    }
    if (e.wait > 0) return { vx: e.dx * BOAR.speed, vy: e.dy * BOAR.speed };
    e.turn += 1;
    if (e.turn < BOAR.charges) aim(w, i, e, ux, uy);
    else {
      e.state = 5;
      e.wait = BOAR.rest;
    }
    return STILL;
  }
  if (e.wait <= 0) {
    e.state = 0;
    e.cd = BOAR.every / (e.def.rage ?? 1);
  }
  return STILL;
}

/** 突進の向きを自分へ決め、矢印の予告を出す */
function aim(w: World, i: number, e: Enemy, ux: number, uy: number) {
  e.state = 1;
  e.wait = BOAR.warn;
  e.dx = ux;
  e.dy = uy;
  hazard(w, {
    kind: 'dash',
    owner: i,
    x: e.x,
    y: e.y,
    vx: ux,
    vy: uy,
    r: BOAR.length,
    delay: BOAR.warn,
    life: 0,
    dmg: 0
  });
}

/** 大ワシ。state 0 回り込む・4 空にいる（影の予告のあと、予告の場所へ急降下して羽根をばらまく） */
export function eagle(w: World, i: number, e: Enemy, ux: number, uy: number, d: number, dt: number) {
  if (e.state === 4) {
    e.wait -= dt;
    if (e.wait > 0) return STILL;
    e.x = e.dx;
    e.y = e.dy;
    e.state = 0;
    e.cd = EAGLE.every / (e.def.rage ?? 1);
    for (let k = 0; k < EAGLE.feathers; k++) {
      const a = (k / EAGLE.feathers) * Math.PI * 2;
      hazard(w, {
        kind: 'feather',
        owner: -1,
        x: e.x,
        y: e.y,
        vx: Math.cos(a) * EAGLE.featherSpeed,
        vy: Math.sin(a) * EAGLE.featherSpeed,
        r: EAGLE.featherR,
        delay: 0,
        life: EAGLE.featherLife,
        dmg: EAGLE.featherDmg
      });
    }
    return STILL;
  }
  e.cd -= dt;
  if (e.cd > 0) return circle(e, ux, uy, d, EAGLE.keep);
  const p = w.player;
  e.state = 4;
  e.wait = EAGLE.warn;
  e.dx = p.x;
  e.dy = p.y;
  hazard(w, {
    kind: 'pounce',
    owner: i,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    r: EAGLE.r,
    delay: EAGLE.warn,
    life: 0.3,
    dmg: EAGLE.dmg
  });
  return STILL;
}

/** 大木のおばけ。ゆっくり近づき、自分の近くに根っこを生やす。2 回に 1 回、実を落として手下を出す */
export function tree(w: World, i: number, e: Enemy, ux: number, uy: number, dt: number) {
  e.cd -= dt;
  if (e.cd > 0) return { vx: ux * e.def.speed, vy: uy * e.def.speed };
  e.cd = TREE.every / (e.def.rage ?? 1);
  const p = w.player;
  for (let k = 0; k < TREE.roots; k++) {
    // 1 本は自分の足もと、残りは近くのばらばらの場所
    const a = w.rand() * Math.PI * 2;
    const r = k === 0 ? 0 : TREE.spread * (0.4 + w.rand() * 0.6);
    hazard(w, {
      kind: 'root',
      owner: i,
      x: p.x + Math.cos(a) * r,
      y: p.y + Math.sin(a) * r,
      vx: 0,
      vy: 0,
      r: TREE.r,
      delay: TREE.warn,
      life: 0.5,
      dmg: TREE.dmg
    });
  }
  e.turn += 1;
  if (e.turn % 2 === 0) brood(w, e, TREE.brood);
  return STILL;
}

/** 大ヘビの体の節を出す。節は頭の番号（turn）と順番（state）を持ち、頭の通った道に並ぶ */
export function spawnSegments(w: World, head: number): void {
  const e = w.enemies[head];
  const def = ENEMIES.snakeSeg;
  // 出たときは頭のうしろにまっすぐ道を敷き、節がはじめから並んでいるようにする
  e.trail = [];
  for (let k = SNAKE.segments; k >= 0; k--) e.trail.push(e.x - k * SNAKE.gap, e.y);
  for (let k = 1; k <= SNAKE.segments; k++) {
    const free = w.enemies.findIndex((o) => !o.alive);
    const at = free >= 0 ? free : w.enemies.length < MAX_ENEMIES ? w.enemies.length : -1;
    if (at < 0) break;
    const s = makeEnemy(def, e.x - k * SNAKE.gap, e.y, 1);
    s.turn = head;
    s.state = k;
    w.enemies[at] = s;
  }
}

/** 大ヘビ。state 0 くねりながら追う・1 噛みつきの予告・2 噛みつきの突進。体は頭の通った道をなぞる */
export function snake(w: World, i: number, e: Enemy, ux: number, uy: number, dt: number) {
  let v: { vx: number; vy: number } = STILL;
  if (e.state === 0) {
    e.cd -= dt;
    const s = Math.sin(e.t * 2.5) * 0.7;
    v = { vx: (ux - uy * s) * e.def.speed, vy: (uy + ux * s) * e.def.speed };
    if (e.cd <= 0) {
      e.state = 1;
      e.wait = SNAKE.warn;
      e.dx = ux;
      e.dy = uy;
      hazard(w, {
        kind: 'dash',
        owner: i,
        x: e.x,
        y: e.y,
        vx: ux,
        vy: uy,
        r: SNAKE.lungeLength,
        delay: SNAKE.warn,
        life: 0,
        dmg: 0
      });
    }
  } else {
    e.wait -= dt;
    if (e.state === 1 && e.wait <= 0) {
      e.state = 2;
      e.wait = SNAKE.lungeTime;
    } else if (e.state === 2) {
      if (e.wait > 0) v = { vx: e.dx * SNAKE.lungeSpeed, vy: e.dy * SNAKE.lungeSpeed };
      else {
        e.state = 0;
        e.cd = SNAKE.every / (e.def.rage ?? 1);
      }
    }
  }
  follow(w, i, e);
  return v;
}

/** 頭の位置を道として覚え、節を道の上の決まった間に置く */
function follow(w: World, i: number, e: Enemy) {
  const trail = (e.trail ??= []);
  const last = trail.length ? { x: trail[trail.length - 2], y: trail[trail.length - 1] } : null;
  if (!last || Math.hypot(e.x - last.x, e.y - last.y) >= 1) trail.push(e.x, e.y);
  // 節の数と間の分だけ覚えておけば足りる
  const keep = (SNAKE.segments + 2) * SNAKE.gap * 2 + 8;
  if (trail.length > keep) trail.splice(0, trail.length - keep);
  for (const s of w.enemies) {
    if (!s.alive || !s.def.part || s.turn !== i) continue;
    const at = pointBack(trail, s.state * SNAKE.gap);
    if (at) {
      s.x = at.x;
      s.y = at.y;
    }
  }
}

/** 道の終わり（頭）から len ドット戻った点。道が短ければ道のはじめ */
function pointBack(trail: number[], len: number): { x: number; y: number } | null {
  if (trail.length < 2) return null;
  let x = trail[trail.length - 2];
  let y = trail[trail.length - 1];
  for (let j = trail.length - 4; j >= 0; j -= 2) {
    const px = trail[j];
    const py = trail[j + 1];
    const d = Math.hypot(x - px, y - py);
    if (d >= len) {
      const k = len / d;
      return { x: x + (px - x) * k, y: y + (py - y) * k };
    }
    len -= d;
    x = px;
    y = py;
  }
  return { x, y };
}
