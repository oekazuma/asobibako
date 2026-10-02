import { animal, type Animal, type AnimalId } from './animals';
import { fire, hits, type Effect, type Shot } from './arms';
import { moveBoss, spawnBosses, updateHazards, type Hazard } from './bosses';
import { CLEAR_COINS, collect, dropFrom, type Gem, type Item } from './drops';
import { ENEMIES, type BossId, type EnemyDef } from './enemies';
import { Grid } from './grid';
import { stats, type Stats } from './passives';
import { rng, type Rng } from './rng';
import { FOREST, spawnRate, type Stage } from './stages/forest';
import { perks, type Ranks } from './upgrades';
import { WEAPONS } from './weapons';

export interface Enemy {
  alive: boolean;
  def: EnemyDef;
  x: number;
  y: number;
  /** 吹き飛ばしの速さ（px/秒）。毎秒 1e-4 倍に減る */
  kx: number;
  ky: number;
  hp: number;
  flash: number;
  t: number;
  phase: number;
  /** 突進の段階。0 追う、1 ためる、2 走る。巨大ベアは 3 が地ならしの予告 */
  state: number;
  wait: number;
  dx: number;
  dy: number;
  /** ボスの次の攻撃までの秒 */
  cd: number;
  /** ツタで足止めされている残り秒 */
  root: number;
  /** ボスの攻撃の数え（巨大ベアは突進と地ならしの交互、女王グモは子グモまでの秒） */
  turn: number;
  /** 武器の枠ごとに、最後に当たった時刻 */
  hit: Float64Array;
  /** まっすぐ飛ぶ残りの秒（群れ）。0 になったら消え、倒した数には入らない */
  drift: number;
}

export interface Player {
  x: number;
  y: number;
  hp: number;
  facing: 1 | -1;
  aimX: number;
  aimY: number;
  invuln: number;
  moving: boolean;
  attack: number;
  hurt: number;
  /** 糸の玉で足が遅くなっている残り秒 */
  slow: number;
}

export interface Owned {
  id: string;
  level: number;
}

export type GameEvent =
  | { type: 'hit'; x: number; y: number; dmg: number; crit: boolean }
  | { type: 'kill'; x: number; y: number; enemy: string }
  | { type: 'pickup'; value: number }
  | { type: 'heal'; amount: number }
  | { type: 'magnet' }
  | { type: 'hurt'; dmg: number }
  | { type: 'fire'; weapon: string }
  | { type: 'levelup' }
  | { type: 'clear' }
  | { type: 'dead' }
  | { type: 'warning'; boss: BossId }
  | { type: 'bossdown'; x: number; y: number }
  | { type: 'chest' }
  | { type: 'coin'; value: number }
  | { type: 'revive' }
  | { type: 'evolve'; id: string }
  | { type: 'swarm'; text: string };

export interface World {
  rand: Rng;
  time: number;
  stage: Stage;
  animal: Animal;
  stats: Stats;
  /** 店の強化。パッシブを取って stats を作り直すときにも足す */
  boost: Partial<Stats>;
  /** コインに掛ける倍率 */
  greed: number;
  /** 残りの 3 択の引き直しと復活 */
  rerolls: number;
  revives: number;
  player: Player;
  weapons: (Owned & { cd: number })[];
  passives: Owned[];
  enemies: Enemy[];
  shots: Shot[];
  effects: Effect[];
  gems: Gem[];
  items: Item[];
  /** ボスの予告と飛び道具 */
  hazards: Hazard[];
  level: number;
  xp: number;
  xpTotal: number;
  kills: number;
  /** まだ選んでいない 3 択の数。0 より大きいあいだ step は進まない */
  pending: number;
  /** まだ開けていない宝箱の数。0 より大きいあいだ step は進まない */
  chests: number;
  /** その回に倒したボス */
  bossKills: BossId[];
  /** この回のコイン。強欲を掛けた値で、端数も持つ */
  coins: number;
  /** この回に開けた宝箱 */
  opened: number;
  /** この回に作った進化形 */
  evolvedNow: string[];
  /** 今当たって戻せる HP。毎秒 DRAIN × 最大 HP ずつ、その量まで戻る */
  drainLeft: number;
  /** 次に出すステージの出来事の番号 */
  eventNext: number;
  /** 次に出すボスの番号と、予告を出したボスの数 */
  bossNext: number;
  warned: number;
  over: null | 'dead' | 'clear';
  /** 仮想画面の大きさ（px）。出現と回し直しの距離に使う */
  view: { w: number; h: number };
  events: GameEvent[];
  spawnAcc: number[];
  grid: Grid;
}

export const MAX_ENEMIES = 400;
/** 当たって戻せる HP は 1 秒に最大 HP のこの割合まで（大群に当てて一瞬で満タンにならないように） */
export const DRAIN = 0.03;
export const BASE_SPEED = 60;
/** 糸の玉に当たったときの速さの倍率 */
export const SLOW = 0.85;
const BEAR_DASH_ATK = 30;
const REVIVE_INVULN = 2;
const REVIVE_REACH = 80;
const REVIVE_PUSH = 400;

export function createWorld(id: AnimalId, seed: number, view: { w: number; h: number }, ranks: Ranks = {}): World {
  const a = animal(id);
  const k = perks(ranks);
  const s = stats(a, [], k.boost);
  return {
    rand: rng(seed),
    time: 0,
    stage: FOREST,
    animal: a,
    stats: s,
    boost: k.boost,
    greed: k.greed,
    rerolls: k.rerolls,
    revives: k.revives,
    player: {
      x: 0,
      y: 0,
      hp: s.maxHp,
      facing: 1,
      aimX: 1,
      aimY: 0,
      invuln: 0,
      moving: false,
      attack: 0,
      hurt: 0,
      slow: 0
    },
    weapons: [{ id: a.weapon, level: 1, cd: 0.3 }],
    passives: [],
    enemies: [],
    shots: [],
    effects: [],
    gems: [],
    items: [],
    hazards: [],
    level: 1,
    xp: 0,
    xpTotal: 0,
    kills: 0,
    pending: 0,
    chests: 0,
    bossKills: [],
    coins: 0,
    opened: 0,
    evolvedNow: [],
    drainLeft: s.maxHp * DRAIN,
    eventNext: 0,
    bossNext: 0,
    warned: 0,
    over: null,
    view,
    events: [],
    spawnAcc: FOREST.waves.map(() => 0),
    grid: new Grid()
  };
}

export function makeEnemy(def: EnemyDef, x: number, y: number, hp: number): Enemy {
  return {
    alive: true,
    def,
    x,
    y,
    kx: 0,
    ky: 0,
    hp,
    flash: 0,
    t: 0,
    phase: 0,
    state: 0,
    wait: 0,
    dx: 0,
    dy: 0,
    cd: 2,
    turn: 0,
    root: 0,
    hit: new Float64Array(6).fill(-1),
    drift: 0
  };
}

/** 自分を中心にした、画面の外の輪の上。動いていれば進む先から来やすくする */
export function spawnPoint(w: World, out = { x: 0, y: 0 }) {
  const p = w.player;
  const r = Math.hypot(w.view.w, w.view.h) / 2 + 24;
  const a =
    p.moving && w.rand() < 0.6 ? Math.atan2(p.aimY, p.aimX) + (w.rand() - 0.5) * Math.PI : w.rand() * Math.PI * 2;
  out.x = p.x + Math.cos(a) * r;
  out.y = p.y + Math.sin(a) * r;
  return out;
}

/** source はダメージを出した武器の id（当たって回復とダメージ表に使う） */
export function damageEnemy(
  w: World,
  i: number,
  dmg: number,
  kx: number,
  ky: number,
  crit = false,
  source?: string
): void {
  const e = w.enemies[i];
  if (!e.alive) return;
  const heal = source ? (WEAPONS[source]?.drain ?? 0) : 0;
  if (heal > 0 && w.drainLeft > 0) {
    const amt = Math.min(heal, w.drainLeft);
    w.drainLeft -= amt;
    w.player.hp = Math.min(w.stats.maxHp, w.player.hp + amt);
  }
  e.hp -= dmg;
  e.flash = 0.12;
  e.kx += kx * (1 - e.def.heavy);
  e.ky += ky * (1 - e.def.heavy);
  w.events.push({ type: 'hit', x: e.x, y: e.y - e.def.r, dmg, crit });
  if (e.hp > 0) return;
  e.alive = false;
  w.kills += 1;
  w.events.push({ type: 'kill', x: e.x, y: e.y, enemy: e.def.id });
  if (e.def.boss) {
    w.bossKills.push(e.def.boss);
    w.events.push({ type: 'bossdown', x: e.x, y: e.y });
  }
  dropFrom(w, e);
}

/** 強化個体の表。元の表は書き換えない */
export function eliteOf(def: EnemyDef): EnemyDef {
  return { ...def, hp: def.hp * 8, xp: def.xp * 5, r: def.r * 1.6, heavy: Math.max(def.heavy, 0.6), elite: true };
}

/** 入れ物に敵を 1 体置く。体力はそのときの toughness を掛ける。400 体を使い切っていれば null */
export function addEnemy(w: World, def: EnemyDef, x: number, y: number): Enemy | null {
  const hp = def.hp * w.stage.toughness(w.time);
  const free = w.enemies.find((e) => !e.alive);
  if (free) Object.assign(free, makeEnemy(def, x, y, hp), { hit: free.hit.fill(-1) });
  else if (w.enemies.length < MAX_ENEMIES) w.enemies.push(makeEnemy(def, x, y, hp));
  else return null;
  const e = free ?? w.enemies[w.enemies.length - 1];
  e.phase = w.rand() * Math.PI * 2;
  return e;
}

function spawn(w: World, base: EnemyDef) {
  const chance = w.stage.elite(w.time);
  const def = chance > 0 && !base.boss && base.id !== 'spiderling' && w.rand() < chance ? eliteOf(base) : base;
  const at = spawnPoint(w);
  addEnemy(w, def, at.x, at.y);
}

const SWARM_SPEED = 1.5;

/** 時刻になったステージの出来事を出す。群れと輪は同時に出せる数の上限とは別に出す */
export function spawnEvents(w: World): void {
  const list = w.stage.events;
  while (w.eventNext < list.length && list[w.eventNext].at <= w.time) {
    const ev = list[w.eventNext++];
    const def = ENEMIES[ev.enemy];
    const p = w.player;
    const r = Math.hypot(w.view.w, w.view.h) / 2 + 24;
    if (ev.kind === 'ring') {
      for (let i = 0; i < ev.count; i++) {
        const a = (i / ev.count) * Math.PI * 2;
        if (!addEnemy(w, def, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r)) break;
      }
    } else {
      // 画面の外の片側に、進む向きと直角に帯になって並び、反対側へ抜ける
      const a = w.rand() * Math.PI * 2;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const life = (2 * r + 60) / (def.speed * SWARM_SPEED);
      for (let i = 0; i < ev.count; i++) {
        const side = (i / Math.max(1, ev.count - 1) - 0.5) * r * 1.6;
        const back = w.rand() * 40;
        const e = addEnemy(w, def, p.x - dx * (r + back) - dy * side, p.y - dy * (r + back) + dx * side);
        if (!e) break;
        Object.assign(e, { dx, dy, drift: life });
      }
    }
    w.events.push({ type: 'swarm', text: ev.text });
  }
}

function moveEnemy(w: World, i: number, dt: number) {
  const e = w.enemies[i];
  if (e.drift > 0) {
    e.drift -= dt;
    if (e.drift <= 0) e.alive = false;
    e.x += e.dx * e.def.speed * SWARM_SPEED * dt;
    e.y += e.dy * e.def.speed * SWARM_SPEED * dt;
    e.t += dt;
    e.flash -= dt;
    return;
  }
  const p = w.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  const sp = e.def.speed;
  let vx = ux * sp;
  let vy = uy * sp;
  const move = e.def.move;
  if (move === 'boss') ({ vx, vy } = moveBoss(w, i, dt));
  else if (move === 'wave' || move === 'snake') {
    const s = move === 'wave' ? Math.sin(e.t * 6 + e.phase) * 0.8 : Math.sin(e.t * 3 + e.phase) * 0.5;
    vx += -uy * s * sp;
    vy += ux * s * sp;
  } else if (move === 'leap') {
    // 3 秒ごとに 0.4 秒止まり、そのときの向きへ 4 倍の速さで 0.35 秒跳ぶ
    if (e.state === 0) {
      e.cd -= dt;
      if (e.cd <= 0) {
        e.state = 1;
        e.wait = 0.4;
      }
    } else {
      e.wait -= dt;
      if (e.wait <= 0 && e.state === 1) {
        e.state = 2;
        e.wait = 0.35;
        e.dx = ux;
        e.dy = uy;
      } else if (e.wait <= 0) {
        e.state = 0;
        e.cd = 3;
      }
    }
    if (e.state === 1) vx = vy = 0;
    else if (e.state === 2) {
      vx = e.dx * sp * 4;
      vy = e.dy * sp * 4;
    }
  } else if (move === 'charge') {
    if (e.state === 0 && d < 60) {
      e.state = 1;
      e.wait = 0.6;
      e.dx = ux;
      e.dy = uy;
    }
    if (e.state > 0) {
      e.wait -= dt;
      if (e.wait <= 0) {
        e.state = e.state === 1 ? 2 : 0;
        e.wait = e.state === 2 ? 0.8 : 0;
      }
      vx = e.state === 2 ? e.dx * sp * 4 : 0;
      vy = e.state === 2 ? e.dy * sp * 4 : 0;
    }
  }
  // 足止めのあいだも動き方（ボスの攻撃の時計）は進め、位置だけを止める
  if (e.root > 0) {
    e.root -= dt;
    vx = vy = 0;
    e.kx = e.ky = 0;
  }
  const decay = Math.pow(1e-4, dt);
  e.x += (vx + e.kx) * dt;
  e.y += (vy + e.ky) * dt;
  e.kx *= decay;
  e.ky *= decay;
  e.t += dt;
  e.flash -= dt;
}

const near: number[] = [];

/** 重なった敵を半分ずつ押し返し、団子にならないようにする。比べるのは近い 4 体まで */
function separate(w: World) {
  const es = w.enemies;
  for (let i = 0; i < es.length; i++) {
    const a = es[i];
    if (!a.alive) continue;
    let n = 0;
    for (const j of w.grid.near(a.x, a.y, a.def.r * 2, near)) {
      if (j === i) continue;
      const b = es[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.def.r + b.def.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min) continue;
      const d = Math.sqrt(d2) || 0.01;
      // ボスは押されず、相手だけが重なりの分だけ下がる
      const ka = a.def.boss ? 0 : b.def.boss ? 1 : 0.5;
      const kb = b.def.boss ? 0 : a.def.boss ? 1 : 0.5;
      const over = (min - d) / d;
      a.x -= dx * over * ka;
      a.y -= dy * over * ka;
      b.x += dx * over * kb;
      b.y += dy * over * kb;
      if (++n >= 4) break;
    }
  }
}

function touch(w: World) {
  const p = w.player;
  if (p.invuln > 0) return;
  let atk = 0;
  for (const i of w.grid.near(p.x, p.y, 24, near)) {
    const e = w.enemies[i];
    if (!e.alive) continue;
    const r = e.def.r + 5;
    if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 >= r * r) continue;
    // ボスは時間で強くならない。突進中の巨大ベアは強く当たる
    const base = e.def.boss
      ? e.def.boss === 'bear' && e.state === 2
        ? BEAR_DASH_ATK
        : e.def.atk
      : e.def.atk * w.stage.fury(w.time);
    atk = Math.max(atk, base);
  }
  if (atk > 0) hurtPlayer(w, atk);
}

/** 自分にダメージを与え、少し無敵にする。防御を引き、最低 1 */
export function hurtPlayer(w: World, raw: number): void {
  const p = w.player;
  const dmg = Math.max(1, Math.round(raw - w.stats.armor));
  p.hp -= dmg;
  p.invuln = 0.5;
  p.hurt = 0.3;
  w.events.push({ type: 'hurt', dmg });
  if (p.hp > 0) return;
  if (w.revives > 0) {
    w.revives -= 1;
    p.hp = Math.round(w.stats.maxHp / 2);
    p.invuln = REVIVE_INVULN;
    for (const e of w.enemies) {
      if (!e.alive || e.def.boss) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > REVIVE_REACH) continue;
      e.kx += (dx / d) * REVIVE_PUSH;
      e.ky += (dy / d) * REVIVE_PUSH;
    }
    w.events.push({ type: 'revive' });
    return;
  }
  p.hp = 0;
  w.over = 'dead';
  w.events.push({ type: 'dead' });
}

export function step(w: World, input: { x: number; y: number }, dt: number): void {
  w.events.length = 0;
  if (w.over || w.pending > 0 || w.chests > 0) return;
  w.time += dt;
  if (w.time >= w.stage.length) {
    for (const e of w.enemies) {
      if (!e.alive) continue;
      e.alive = false;
      w.kills += 1;
      w.events.push({ type: 'kill', x: e.x, y: e.y, enemy: e.def.id });
    }
    w.coins += CLEAR_COINS * w.greed;
    w.over = 'clear';
    w.events.push({ type: 'clear' });
    return;
  }

  const p = w.player;
  const speed = BASE_SPEED * w.stats.speed * (p.slow > 0 ? SLOW : 1);
  p.moving = input.x !== 0 || input.y !== 0;
  p.x += input.x * speed * dt;
  p.y += input.y * speed * dt;
  if (p.moving) {
    const len = Math.hypot(input.x, input.y);
    p.aimX = input.x / len;
    p.aimY = input.y / len;
    if (input.x !== 0) p.facing = input.x > 0 ? 1 : -1;
  }
  p.invuln -= dt;
  p.hurt -= dt;
  p.attack -= dt;
  p.slow -= dt;
  p.hp = Math.min(w.stats.maxHp, p.hp + w.stats.regen * dt);
  w.drainLeft = Math.min(w.stats.maxHp * DRAIN, w.drainLeft + w.stats.maxHp * DRAIN * dt);

  let alive = 0;
  for (const e of w.enemies) if (e.alive) alive++;
  const cap = w.stage.cap(w.time);
  w.stage.waves.forEach((wave, i) => {
    if (alive >= cap) return;
    w.spawnAcc[i] += spawnRate(wave, w.time) * dt;
    while (w.spawnAcc[i] >= 1 && alive < cap) {
      w.spawnAcc[i] -= 1;
      spawn(w, ENEMIES[wave.enemy]);
      alive++;
    }
  });
  spawnBosses(w);
  spawnEvents(w);

  const far = Math.hypot(w.view.w, w.view.h) * 0.9;
  w.grid.clear();
  w.enemies.forEach((e, i) => {
    if (!e.alive) return;
    moveEnemy(w, i, dt);
    if (e.drift <= 0 && (e.x - p.x) ** 2 + (e.y - p.y) ** 2 > far * far) {
      const at = spawnPoint(w);
      e.x = at.x;
      e.y = at.y;
    }
    w.grid.add(i, e.x, e.y);
  });
  separate(w);
  touch(w);
  updateHazards(w, dt);
  if (w.over) return;

  fire(w, dt);
  hits(w, dt);
  collect(w, dt);
}

export interface RunSummary {
  animal: AnimalId;
  cleared: boolean;
  time: number;
  level: number;
  kills: number;
  xp: number;
  weapons: Owned[];
  passives: Owned[];
  bosses: BossId[];
  coins: number;
  opened: number;
  evolved: string[];
}

export function summary(w: World): RunSummary {
  return {
    animal: w.animal.id,
    cleared: w.over === 'clear',
    time: w.time,
    level: w.level,
    kills: w.kills,
    xp: w.xpTotal,
    weapons: w.weapons.map(({ id, level }) => ({ id, level })),
    passives: w.passives.map(({ id, level }) => ({ id, level })),
    bosses: [...w.bossKills],
    coins: Math.floor(w.coins),
    opened: w.opened,
    evolved: [...w.evolvedNow]
  };
}
