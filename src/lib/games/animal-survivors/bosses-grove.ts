import { hazard, queen } from './bosses';
import { boar } from './bosses-forest';
import type { Enemy, World } from './world';

/** 突進中の体当たりの強さは BOAR.dashAtk を world.ts の touch() が見る */
export const STAG = {
  every: 2.5,
  warn: 1,
  /** 扇が当たりを出している秒。1 回だけ当てるので breathTick より短くする */
  time: 0.2,
  length: 130,
  dmg: 24
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
  // 遅くしないのは breathe が竜だけに付けるため
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

/** 魔女。魔法陣の円は巨大ベアの地ならし（半径 56）より小さく、3 つ並べて逃げ道を残す。dmg は女王グモの糸の玉（6）では 3 つ避ける意味がないので地ならしに寄せた */
export const WITCH = {
  every: 6,
  delays: [1, 1.4, 1.8],
  r: 40,
  /** 左右の円の中心を動物の位置から離す距離。r より大きく、魔女から見て手前・奥へ逃げれば 3 つとも外れる */
  gap: 64,
  dmg: 24
};

/**
 * 女王グモの動きに、魔法陣を合間に挟む。state 0 は女王グモの動き（wait は魔法陣までの経過秒）、state 1 は魔法陣の予告（立ち止まる）。
 * 女王グモの cd・turn、円運動の phase は queen と circle が読むので触らず、経過秒だけ wait に持つ
 */
export function witch(w: World, i: number, e: Enemy, ux: number, uy: number, d: number, dt: number) {
  if (e.state === 0) {
    e.wait += dt;
    if (e.wait < WITCH.every / (e.def.rage ?? 1)) return queen(w, e, ux, uy, d, dt);
    e.state = 1;
    e.wait = WITCH.delays[WITCH.delays.length - 1];
    const p = w.player;
    // 直角にずらすのは、魔女のほうへ寄るか離れるかで 3 つとも外れるようにするため
    WITCH.delays.forEach((delay, k) => {
      const side = k === 0 ? 0 : k === 1 ? 1 : -1;
      hazard(w, {
        kind: 'slam',
        owner: i,
        x: p.x - uy * side * WITCH.gap,
        y: p.y + ux * side * WITCH.gap,
        vx: 0,
        vy: 0,
        r: WITCH.r,
        delay,
        life: 0.3,
        dmg: WITCH.dmg
      });
    });
    return STILL;
  }
  e.wait -= dt;
  if (e.wait <= 0) {
    e.state = 0;
    e.wait = 0;
  }
  return STILL;
}
