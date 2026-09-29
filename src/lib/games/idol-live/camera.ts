import type { P } from './pose';

/**
 * カメラ。世界の点 (fx, fy) を画面の (横の中央, 高さの ay) に置き、zoom 倍で写し、roll だけ傾ける。
 * 曲の時刻だけで決まり、指の出来によって動かない（ノーツが指の下で逃げないように）。
 * スペシャルをきめたときの寄りだけは、ノーツを出さない APPEAL のあいだに収める
 */
export interface Camera {
  fx: number;
  fy: number;
  zoom: number;
  ay: number;
  roll: number;
}

export const WIDE: Camera = { fx: 0, fy: 0, zoom: 1, ay: 0.74, roll: 0 };
const OPENING: Camera = { fx: 0, fy: -0.55, zoom: 1.45, ay: 0.55, roll: 0 };
export const CLOSE: Camera = { fx: 0, fy: -0.72, zoom: 1.75, ay: 0.44, roll: -0.05 };
/** 曲が終わったあと。けっかを下半分に重ねるので、全身を画面の上半分に引いて写す */
export const CURTAIN: Camera = { fx: 0, fy: -0.5, zoom: 0.72, ay: 0.3, roll: 0 };

export function mix(a: Camera, b: Camera, u: number): Camera {
  const l = (k: keyof Camera) => a[k] + (b[k] - a[k]) * u;
  return { fx: l('fx'), fy: l('fy'), zoom: l('zoom'), ay: l('ay'), roll: l('roll') };
}

export const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));

/** 曲の頭は顔のアップから始めて、最初のノーツが出るまでに全身へ引く */
export function baseCamera(beat: number): Camera {
  return mix(OPENING, WIDE, ease(beat / 5));
}

/** スペシャルをきめたあと、カメラが顔に寄って戻るまで（拍）。このあいだはノーツを出さない */
export const APPEAL = 2.6;

/** スペシャルをきめてからの拍 d での、顔への寄り 0..1。最後のスペシャルは曲の終わりまで寄ったまま */
export function appeal(d: number, last: boolean): number {
  if (d < 0) return 0;
  if (d < 0.8) return ease(d / 0.8);
  if (last || d < 1.8) return 1;
  return 1 - ease((d - 1.8) / (APPEAL - 1.8));
}

/** 盤面の大きさ（ピクセル）での、世界 1 の長さ。縦長の iPad では背が画面の半分より少し大きく、細長い画面は幅で決める */
export const unit = (w: number, h: number) => Math.min(h * 0.52, w / 1.3);

export function toScreen(c: Camera, w: number, h: number, [x, y]: P): P {
  const k = unit(w, h) * c.zoom;
  const [dx, dy] = [(x - c.fx) * k, (y - c.fy) * k];
  const [co, si] = [Math.cos(c.roll), Math.sin(c.roll)];
  return [w / 2 + dx * co - dy * si, h * c.ay + dx * si + dy * co];
}

export function toWorld(c: Camera, w: number, h: number, [sx, sy]: P): P {
  const k = unit(w, h) * c.zoom;
  const [dx, dy] = [sx - w / 2, sy - h * c.ay];
  const [co, si] = [Math.cos(-c.roll), Math.sin(-c.roll)];
  return [c.fx + (dx * co - dy * si) / k, c.fy + (dx * si + dy * co) / k];
}
