/** 育つ演出の前半（白い影の入れ替わり）の秒 */
export const SWAP = 1.4;
/** はじける光の秒 */
const BURST = 0.2;
/** 影の入れ替わりの間。はじめはゆっくり、はじける直前は速い */
const SLOW = 0.3;
const FAST = 0.04;
const DARK = 0.6;

export interface GrowFrame {
  form: 'old' | 'new';
  /** 白い影で描く */
  white: boolean;
  /** まわりの暗さ 0..1 */
  dark: number;
  /** はじける光の強さ 0..1 */
  burst: number;
}

/** 育つ演出の t 秒の見え方。still は動きを減らす設定（入れ替わりと光を出さない） */
export function growFrame(t: number, still: boolean): GrowFrame {
  if (still) return { form: 'new', white: false, dark: 0, burst: 0 };
  if (t < SWAP) {
    // 入れ替わりの間が SLOW から FAST へまっすぐ縮むときの、t までに入れ替わった回数
    const k = (FAST - SLOW) / SWAP;
    const n = Math.floor(Math.log((SLOW + k * t) / SLOW) / k);
    return { form: n % 2 ? 'new' : 'old', white: true, dark: Math.min(1, t / 0.3) * DARK, burst: 0 };
  }
  if (t < SWAP + BURST) return { form: 'new', white: true, dark: DARK, burst: 1 - (t - SWAP) / BURST };
  return { form: 'new', white: false, dark: DARK * Math.max(0, 1 - (t - SWAP - BURST)), burst: 0 };
}
