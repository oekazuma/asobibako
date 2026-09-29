import { PerspectiveCamera, Vector3 } from 'three';
import type { Note, Scene, Track, V3 } from './chart';
import type { Placed } from './judge';

/**
 * カメラワーク。曲の区間ごとに撮り方（全身・バストアップ・顔のアップ・ななめ・ローアングル・回りこみ）を並べ、
 * あいだはなめらかにつなぐ。カメラは曲の時刻だけで決まり、指の出来では動かない（ノーツが指の下で逃げないように）。
 * スペシャルをきめたときの顔への寄りだけは、ノーツを出さない APPEAL のあいだに重ねる
 */

/** yaw は正面からの回りこみ（右が正）、height はカメラの高さ、dist は見る点からの距離、look は見る点の高さ */
export interface Shot {
  yaw: number;
  height: number;
  dist: number;
  look: number;
  fov: number;
  /** 両手を広げても左右が画面に入るよう、この半幅（メートル）を写す。0 なら寄ったまま */
  frame: number;
}

const shot = (yaw: number, height: number, dist: number, look: number, fov: number, frame: number): Shot => ({
  yaw,
  height,
  dist,
  look,
  fov,
  frame
});

/** ノーツを出すあいだの撮り方は、手の届くところを必ず写す（frame > 0） */
export const SHOTS = {
  face: shot(0.18, 1.4, 0.85, 1.4, 30, 0),
  /** スペシャルをきめたときの寄り。顔とキメのポーズが入る */
  appeal: shot(0.25, 1.36, 1.35, 1.3, 32, 0),
  bust: shot(0.3, 1.32, 1.5, 1.28, 32, 0),
  full: shot(0, 1.0, 4.0, 0.88, 34, 0.95),
  diagR: shot(0.5, 1.15, 4.0, 0.9, 34, 0.95),
  diagL: shot(-0.5, 1.15, 4.0, 0.9, 34, 0.95),
  low: shot(0.15, 0.25, 3.8, 1.0, 38, 0.95),
  lowL: shot(-0.45, 0.3, 3.8, 1.0, 38, 0.95),
  orbitL: shot(-0.6, 1.05, 4.0, 0.9, 34, 0.95),
  orbitR: shot(0.6, 1.05, 4.0, 0.9, 34, 0.95),
  wide: shot(0, 1.7, 6.0, 1.05, 40, 1.4),
  /** 曲のあと。けっかを下半分に重ねるので、全身を画面の上半分に写す */
  curtain: shot(0, 1.3, 6.2, 0.15, 36, 0)
};

type Key = [beat: number, shot: Shot];

/** 区間ごとの撮り方の並び。拍は区間の頭から */
const PLAN: Record<Scene, Key[]> = {
  intro: [
    [0, SHOTS.face],
    [2.5, SHOTS.bust],
    [5.5, SHOTS.full]
  ],
  verse: [
    [0, SHOTS.full],
    [8, SHOTS.diagR],
    [16, SHOTS.full],
    [24, SHOTS.diagL]
  ],
  bridge: [
    [0, SHOTS.low],
    [8, SHOTS.lowL],
    [15, SHOTS.full]
  ],
  chorus: [
    [0, SHOTS.full],
    [4, SHOTS.orbitL],
    [12, SHOTS.orbitR],
    [16, SHOTS.low],
    [22, SHOTS.diagR],
    [28, SHOTS.full]
  ],
  break: [
    [0, SHOTS.wide],
    [6, SHOTS.full]
  ],
  finale: [[0, SHOTS.full]]
};

/** 曲 1 つぶんの撮り方の並び。曲のあとは全身を引いて写す */
export function timeline(track: Track): Key[] {
  const keys: Key[] = [];
  for (const s of track.def.sections) for (const [b, sh] of PLAN[s.scene]) keys.push([s.from + b, sh]);
  keys.push([track.length, SHOTS.full], [track.length + 2, SHOTS.curtain]);
  return keys.sort((a, b) => a[0] - b[0]);
}

const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));

export function mix(a: Shot, b: Shot, u: number): Shot {
  const l = (k: keyof Shot) => a[k] + (b[k] - a[k]) * u;
  return { yaw: l('yaw'), height: l('height'), dist: l('dist'), look: l('look'), fov: l('fov'), frame: l('frame') };
}

/** 拍 beat の撮り方。となりの撮り方のあいだを、区間いっぱいにゆっくり移る */
export function shotAt(keys: Key[], beat: number): Shot {
  if (beat <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [a, b] = [keys[i], keys[i + 1]];
    if (beat < b[0]) return mix(a[1], b[1], ease((beat - a[0]) / (b[0] - a[0])));
  }
  return keys[keys.length - 1][1];
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

/**
 * 撮り方をカメラに当てる。aspect は画面の幅 / 高さ。細長い画面では、frame の半幅が入るまで離れる。
 * x は立ち位置（横へ動いても追いかける）
 */
export function aimCamera(cam: PerspectiveCamera, s: Shot, aspect: number, x = 0): PerspectiveCamera {
  const half = Math.tan((s.fov * Math.PI) / 360);
  const need = s.frame > 0 ? s.frame / (half * aspect) : 0;
  const d = Math.max(s.dist, need);
  // 離れたぶん、見上げ・見下ろしの角度が変わらないよう高さの差も伸ばす
  const k = d / s.dist;
  cam.fov = s.fov;
  cam.aspect = aspect;
  cam.position.set(x * 0.5 + Math.sin(s.yaw) * d, s.look + (s.height - s.look) * k, Math.cos(s.yaw) * d);
  cam.lookAt(x * 0.5, s.look, 0);
  cam.near = 0.05;
  cam.far = 60;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return cam;
}

const v = new Vector3();
/** 世界の点を、幅 w・高さ h の画面のピクセルへ */
export function project(cam: PerspectiveCamera, [x, y, z]: V3, w: number, h: number): [number, number] {
  v.set(x, y, z).project(cam);
  return [(v.x * 0.5 + 0.5) * w, (0.5 - v.y * 0.5) * h];
}

/** 拍 beat のカメラ。specials はきめたスペシャルの拍（顔に寄る） */
export function cameraAt(
  cam: PerspectiveCamera,
  track: Track,
  keys: Key[],
  beat: number,
  aspect: number,
  specials: number[] = []
) {
  let s = shotAt(keys, beat);
  // 曲が終わったら、寄りを戻してカーテンコールの撮り方へ
  const after = 1 - ease((beat - track.length) / 2);
  for (const sp of specials) s = mix(s, SHOTS.appeal, appeal(beat - sp, sp === track.specials.at(-1)) * after);
  return aimCamera(cam, s, aspect, track.figure(beat).x);
}

/** 画面の大きさでのノーツの半径（ピクセル） */
export const radiusOf = (w: number, h: number) => Math.min(w, h * 0.75) * 0.055;

/**
 * ノーツを画面のピクセルに置く。叩く拍のカメラで手の位置を写すので、そのときアイドルの手はノーツに重なる。
 * スライドの道は、道の各点の拍のカメラで写す
 */
export function place(track: Track, notes: Note[], w: number, h: number): Placed[] {
  const cam = new PerspectiveCamera();
  const keys = timeline(track);
  const at = (p: V3, t: number) => project(cameraAt(cam, track, keys, t / track.beat, w / h), p, w, h);
  return notes.map((n) => {
    const [x, y] = at(n.at, n.t);
    const path = n.path.map((p, i) => at(p, n.t + ((n.end - n.t) * i) / Math.max(1, n.path.length - 1)));
    return { kind: n.kind, t: n.t, end: n.end, x, y, path, shape: n.shape, hand: n.hand };
  });
}
