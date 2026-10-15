import { hazard } from './bosses';
import { boar } from './bosses-forest';
import type { Enemy, World } from './world';

/** 大イノシシの数から始める。dashAtk は突進中の体当たりの強さ（BOAR は循環 import で定数の評価時には使えないので数を写す） */
export const STAG = {
  every: 2.5,
  warn: 1,
  /** 扇が当たりを出している秒。1 回だけ当てるので breathTick より短くする */
  time: 0.2,
  length: 130,
  dmg: 24,
  dashAtk: 34
};

const STILL = { vx: 0, vy: 0 };

/**
 * 森の大ジカ。大イノシシ（boar の state 0・1・2・5）に、6 角ふりの予告を足す。
 * 3 回突進した休みが明けたとき、追う代わりに角ふりへ入る。
 * 角ふりの残り秒は wait に持つ（boar はこの state のあいだ呼ばないので、wait を取り合わない）
 */
export function stag(w: World, i: number, e: Enemy, ux: number, uy: number, dt: number) {
  if (e.state === 6) {
    e.wait -= dt;
    if (e.wait <= 0) {
      e.state = 0;
      e.cd = STAG.every / (e.def.rage ?? 1);
    }
    return STILL;
  }
  const resting = e.state === 5;
  const move = boar(w, i, e, ux, uy, dt);
  if (!(resting && e.state === 0)) return move;
  e.state = 6;
  e.wait = STAG.warn + STAG.time;
  // 竜の息の扇を使い回す。向きは置いたときの動物の向きで、あとで動いても変わらない（遅くしないのは breathe が竜だけに付ける）
  hazard(w, {
    kind: 'breath',
    owner: i,
    x: e.x,
    y: e.y,
    vx: ux,
    vy: uy,
    r: STAG.length,
    delay: STAG.warn,
    life: STAG.time,
    dmg: STAG.dmg,
    tick: 0
  });
  return STILL;
}
