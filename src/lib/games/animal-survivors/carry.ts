import { addCoins } from './drops';
import { pushOut } from './obstacles';
import { BASE_SPEED, type World } from './world';

/** 協力プレイの重い宝箱。ax・ay は祭壇、near は宝箱に寄っている動物 */
export interface Carry {
  x: number;
  y: number;
  ax: number;
  ay: number;
  life: number;
  near: boolean[];
}

export const CARRY_LIFE = 60;
export const CARRY_REACH = 36;
/** ふつうに歩く速さに対する、運ぶ速さ */
export const CARRY_SPEED = 0.55;
export const CARRY_COINS = 50;
/** 宝箱の真ん中がこの半径に入ったら届いた */
export const ALTAR_R = 16;
/** 障害物から押し出すときの宝箱の半径（2 倍で描く宝箱の見た目に合わせる） */
export const CARRY_R = 14;
export const CARRY_TEXT = '重い宝箱だ！\n2 匹で祭壇まで運ぼう';
const CHEST_NEAR = 120;
const CHEST_FAR = 160;
const ALTAR_NEAR = 250;
const ALTAR_FAR = 300;

export const coopCarry = (w: World) => w.heroes.length > 1 && w.heroes.every((h) => !h.gone);

function mid(w: World): { x: number; y: number } {
  const [a, b] = w.heroes;
  return { x: (a.player.x + b.player.x) / 2, y: (a.player.y + b.player.y) / 2 };
}

/** 2 匹のまん中から少し先に宝箱、その先に祭壇を置く */
export function startCarry(w: World): void {
  const m = mid(w);
  const a = w.rand() * Math.PI * 2;
  const d = CHEST_NEAR + w.rand() * (CHEST_FAR - CHEST_NEAR);
  const chest = { x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d };
  pushOut(w.stage.art, chest, CARRY_R);
  const b = w.rand() * Math.PI * 2;
  const e = ALTAR_NEAR + w.rand() * (ALTAR_FAR - ALTAR_NEAR);
  const altar = { x: chest.x + Math.cos(b) * e, y: chest.y + Math.sin(b) * e };
  pushOut(w.stage.art, altar, ALTAR_R);
  w.carry = { x: chest.x, y: chest.y, ax: altar.x, ay: altar.y, life: CARRY_LIFE, near: w.heroes.map(() => false) };
}

/** step の中で呼ぶ（3 択・宝箱・一時停止では進まない）。時計で止まっているあいだは残りの秒を減らさない */
export function stepCarry(w: World, dt: number): void {
  const c = w.carry;
  if (!c) return;
  if (w.freeze <= 0) c.life -= dt;
  if (c.life <= 0) {
    w.carry = null;
    w.events.push({ type: 'swarm', text: '宝箱が沈んでしまった…' });
    return;
  }
  c.near = w.heroes.map((h) => !h.down && !h.gone && Math.hypot(h.player.x - c.x, h.player.y - c.y) <= CARRY_REACH);
  if (c.near.length > 1 && c.near.every(Boolean)) {
    const m = mid(w);
    const dx = m.x - c.x;
    const dy = m.y - c.y;
    const len = Math.hypot(dx, dy);
    const go = Math.min(len, BASE_SPEED * CARRY_SPEED * dt);
    if (len > 0) {
      c.x += (dx / len) * go;
      c.y += (dy / len) * go;
      pushOut(w.stage.art, c, CARRY_R);
    }
  }
  if (Math.hypot(c.x - c.ax, c.y - c.ay) > ALTAR_R) return;
  // 倒れていても運んだ 2 匹ともの手柄なので、抜けた動物にだけは渡さない
  for (const h of w.heroes) {
    if (h.gone) continue;
    h.chests += 1;
    h.big += 1;
  }
  addCoins(w, CARRY_COINS);
  w.carried += 1;
  w.carry = null;
  w.events.push({ type: 'swarm', text: '祭壇に届いた！\n2 匹に宝箱' });
}
