import { eachHero } from './heroes';
import { hurtPlayer, damageEnemy, type World } from './world';

/** 割れ目の予告から溶岩が噴き出すまでの秒、池が残る秒、池が当たる間隔 */
export const CRACK_WARN = 1.2;
export const POOL_LIFE = 6;
export const POOL_TICK = 0.5;
/** 池が自分に当たる強さと、敵に当たる強さ（敵には時刻の硬さを掛ける） */
export const POOL_DMG = 12;
const POOL_HIT = 6;
/** 噴火とボスの池が重なっても描く数と当たりの計算を増やしすぎない */
export const MAX_LAVA = 24;
const ERUPT_WARN = 3;

/** warn が 0 より大きいあいだは割れ目の予告、0 を切ると池 */
export interface Lava {
  x: number;
  y: number;
  r: number;
  warn: number;
  life: number;
  tick: number;
}

export interface Eruption {
  /** 次の stage.eruptions の番号 */
  next: number;
  /** 噴いている残り秒 */
  left: number;
  /** 次の割れ目までの秒 */
  cd: number;
  warned: boolean;
}

export const quietEarth = (): Eruption => ({ next: 0, left: 0, cd: 0, warned: false });

export function addLava(w: World, x: number, y: number, r: number, warn = CRACK_WARN): void {
  const lava = { x, y, r, warn, life: POOL_LIFE, tick: 0 };
  const free = w.lava.findIndex((l) => l.life <= 0);
  if (free >= 0) w.lava[free] = lava;
  else if (w.lava.length < MAX_LAVA) w.lava.push(lava);
  else {
    let k = 0;
    for (let i = 1; i < w.lava.length; i++) if (w.lava[i].life < w.lava[k].life) k = i;
    w.lava[k] = lava;
  }
}

/** 時刻になったら噴かせ、3 秒前に帯を出す。噴いているあいだ自分のまわりに割れ目を置く */
export function stepEruption(w: World, dt: number): void {
  const s = w.eruption;
  s.left = Math.max(0, s.left - dt);
  const next = w.stage.eruptions[s.next];
  if (next && !s.warned && w.time >= next.at - ERUPT_WARN) {
    s.warned = true;
    w.events.push({ type: 'swarm', text: '噴火が来る！' });
  }
  if (next && w.time >= next.at) {
    s.left = next.len;
    s.next += 1;
    s.warned = false;
    s.cd = 0;
  }
  if (s.left <= 0) return;
  s.cd -= dt;
  if (s.cd > 0) return;
  s.cd = 0.9 + w.rand() * 0.3;
  const a = w.rand() * Math.PI * 2;
  const d = 30 + w.rand() * 60;
  addLava(w, w.player.x + Math.cos(a) * d, w.player.y + Math.sin(a) * d, 18 + w.rand() * 8);
}

/** 割れ目を噴かせ、池の中の自分と敵に当てる。ボス・ランタン・大ヘビの体・ハリネズミには当てない */
export function updateLava(w: World, dt: number): void {
  for (const l of w.lava) {
    if (l.life <= 0) continue;
    if (l.warn > 0) {
      l.warn -= dt;
      continue;
    }
    l.life -= dt;
    l.tick -= dt;
    if (l.life <= 0 || l.tick > 0) continue;
    l.tick = POOL_TICK;
    eachHero(w, () => {
      const q = w.player;
      if (q.invuln <= 0 && (q.x - l.x) ** 2 + (q.y - l.y) ** 2 < l.r * l.r) hurtPlayer(w, POOL_DMG, 'lava');
    });
    if (w.over) return;
    const hit = POOL_HIT * w.stage.toughness(w.time);
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (!e.alive || e.def.boss || e.def.prop || e.def.part || e.def.metal) continue;
      if ((e.x - l.x) ** 2 + (e.y - l.y) ** 2 >= (l.r + e.def.r) ** 2) continue;
      damageEnemy(w, i, hit, 0, 0);
      if (!e.alive) w.lavaKills += 1;
    }
  }
}
