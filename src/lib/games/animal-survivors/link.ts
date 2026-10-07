import type { AnimalId } from './animals';
import { eachHero } from './heroes';
import { HALVES, inHalf } from './link-halves';
import { damageEnemy, type World } from './world';

export interface LinkShow {
  hero: number;
  animal: AnimalId;
  x: number;
  y: number;
  angle: number;
  /** 出てからの秒（LINK_SHOW で消す） */
  t: number;
}

/** 協力プレイの連携の技。2 匹で共通に 1 つ持つ */
export interface Link {
  charge: number;
  need: number;
  uses: number;
  /** 次に使えるまでの秒 */
  cool: number;
  /** 2 人が押したゲームの時刻（押していなければ NEVER） */
  press: [number, number];
  /** 2 人がそろった。次の step で止めを始める（押しは step の外で起き、step は出来事を消してから進むので、出来事は step の中で積む） */
  armed: boolean;
  /** 技を出す前に止めている残りの秒 */
  fuse: number;
  /** 技の当たりを入れているあいだ（技で倒した敵ではたまらない） */
  firing: boolean;
  shows: LinkShow[];
}

export const LINK_NEAR = 80;
export const LINK_WINDOW = 1.5;
export const LINK_COOL = 45;
export const LINK_FUSE = 1;
export const LINK_INVULN = 2;
export const LINK_BOSS = 0.1;
export const LINK_SHOW = 0.8;
export const LINK_BASE = 300;
export const LINK_GROW = 1.6;
/** JSON で送れるよう -Infinity の代わりに使う */
export const NEVER = -1e9;

export function calmLink(): Link {
  return {
    charge: 0,
    need: LINK_BASE,
    uses: 0,
    cool: 0,
    press: [NEVER, NEVER],
    armed: false,
    fuse: 0,
    firing: false,
    shows: []
  };
}

/** 技を向ける向き。いちばん近い敵、いなければ進む向き */
function aim(w: World, x: number, y: number, ax: number, ay: number): number {
  let best = Infinity;
  let angle = Math.atan2(ay, ax);
  for (const e of w.enemies) {
    if (!e.alive || e.def.prop || e.def.part) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < best) {
      best = d;
      angle = Math.atan2(e.y - y, e.x - x);
    }
  }
  return angle;
}

/** 2 匹の半分を同時に当てる。ボスは 2 つの半分が両方当たっても 1 回だけ */
export function fireLink(w: World): void {
  const bosses = new Set<number>();
  w.link.firing = true;
  try {
    eachHero(w, (k) => {
      const h = w.heroes[k];
      const p = h.player;
      const angle = aim(w, p.x, p.y, p.aimX, p.aimY);
      const shape = HALVES[h.animal.id].shape;
      w.link.shows.push({ hero: k, animal: h.animal.id, x: p.x, y: p.y, angle, t: 0 });
      w.enemies.forEach((e, i) => {
        // 節に当てると頭へ回るので、頭だけを数える
        if (!e.alive || e.def.part || !inHalf(shape, p.x, p.y, angle, e.x, e.y, e.def.r)) return;
        if (e.def.boss) {
          if (bosses.has(i)) return;
          bosses.add(i);
          damageEnemy(w, i, e.def.hp * LINK_BOSS, 0, 0);
        } else damageEnemy(w, i, e.hp, 0, 0);
      });
      p.invuln = Math.max(p.invuln, LINK_INVULN);
    });
  } finally {
    w.link.firing = false;
  }
}
