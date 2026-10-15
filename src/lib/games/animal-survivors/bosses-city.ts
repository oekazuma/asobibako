import { bear, BEAR, hazard } from './bosses';
import { eagle } from './bosses-forest';
import { ENEMIES } from './enemies';
import { swarm, type Enemy, type World } from './world';

/** 下水の大ワニ。巨大ベアの突進と地ならしの合間に、マンホールもぐりを使う。出てきたときの強さは巨大ベアの地ならし（BEAR は循環 import で定数の評価時には使えないので、置くときに読む） */
export const GATOR = { every: 5, dive: 1, warn: 1, surface: 0.4, r: 36 };
const STILL = { vx: 0, vy: 0 };

/**
 * 巨大ベアの state（0〜3）に、5 潜っている・6 出てくる場所の予告・7 顔を出す、を足す。
 * もぐりまでの経過秒は phase に持つ（ベアの攻撃が割り込んでも途切れない）。
 * 予告の円は始めた瞬間の動物の位置（dx・dy）に置いて動かさず、大ワニはそこへ出てくる
 */
export function gator(w: World, i: number, e: Enemy, ux: number, uy: number, dt: number) {
  if (e.state >= 5) {
    e.wait -= dt;
    if (e.wait > 0) return STILL;
    if (e.state === 5) {
      const p = w.player;
      e.state = 6;
      e.wait = GATOR.warn;
      e.dx = p.x;
      e.dy = p.y;
      hazard(w, {
        kind: 'slam',
        owner: i,
        x: p.x,
        y: p.y,
        vx: 0,
        vy: 0,
        r: GATOR.r,
        delay: GATOR.warn,
        life: 0.3,
        dmg: BEAR.slamDmg
      });
    } else if (e.state === 6) {
      e.x = e.dx;
      e.y = e.dy;
      e.state = 7;
      e.wait = GATOR.surface;
    } else {
      e.state = 0;
      e.cd = BEAR.every / (e.def.rage ?? 1);
    }
    return STILL;
  }
  if (e.state === 0) {
    e.phase += dt;
    if (e.phase >= GATOR.every / (e.def.rage ?? 1)) {
      e.phase = 0;
      e.state = 5;
      e.wait = GATOR.dive;
      return STILL;
    }
  }
  return bear(w, i, e, ux, uy, dt);
}

/** 巨大カラスが群れを呼んでから、カラスが出るまでの秒 */
export const RAVEN = { callDelay: 1, flock: 8 };

/**
 * 巨大カラス。動きは大ワシそのままで、急降下 2 回に 1 回、帯を出して 1 秒後にカラスの群れを呼ぶ。
 * 呼んだあとの待ちは phase に負の値（-残り秒）で持つ。addEnemy が入れる 0 以上の乱数の初期値と区別できる
 */
export function raven(w: World, i: number, e: Enemy, ux: number, uy: number, d: number, dt: number) {
  if (e.phase < 0) {
    e.phase += dt;
    if (e.phase >= 0) {
      e.phase = 0;
      swarm(w, ENEMIES.crow, RAVEN.flock);
    }
  }
  const diving = e.state === 4;
  const move = eagle(w, i, e, ux, uy, d, dt);
  if (diving && e.state === 0 && ++e.turn % 2 === 0) {
    w.events.push({ type: 'swarm', text: 'カラスの群れが来る！' });
    e.phase = -RAVEN.callDelay;
  }
  return move;
}
