import { ENEMIES } from './enemies';
import { makeEnemy, MAX_ENEMIES, spawnPoint, type World } from './world';

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

export const moveBoss: (w: World, i: number, dt: number) => { vx: number; vy: number } = () => ({ vx: 0, vy: 0 });

export const updateHazards: (w: World, dt: number) => void = () => {};
