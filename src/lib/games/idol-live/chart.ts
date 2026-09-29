import { joints, poseAt, POSES, groove, tip, type Key, type P, type PoseId } from './pose';
import { BEAT, sectionAt, type Scene } from './song';

/**
 * ふりつけと譜面。ふりつけの 1 手ごとに、そのかっこうに着く拍と、手の先に出すノーツを書く。
 * ノーツの位置は、その拍のアイドルの手（足・胸）の位置から出すので、手を伸ばした先にノーツが来る
 */

export type Kind = 'tap' | 'hold' | 'slide' | 'special';
export type Shape = 'circle' | 'heart' | 'star';

export interface Note {
  kind: Kind;
  /** 叩く時刻（秒） */
  t: number;
  /** ホールドとスライドの終わり（秒）。ほかは t */
  end: number;
  /** 世界の座標 */
  x: number;
  y: number;
  /** スライドの道。t から end まで等しい時間おきに手の先をたどった点 */
  path: P[];
  shape: Shape;
  /** ノーツを出した手（0 が左、1 が右）。胸・足もと・スペシャルは null */
  hand: 0 | 1 | null;
}

/** 右手・左手の先、胸（両手のハート）、足もと、スライド・ホールド（手と拍数）、スペシャル */
type Mark = 'R' | 'L' | 'chest' | 'feet' | 'holdR' | 'holdL' | 'slideR' | 'slideL' | 'special';
type Move = [beat: number, pose: PoseId, mark?: Mark, len?: number, to?: PoseId];

/** ノーツの半径（世界）。スペシャルは体ごと囲む */
export const RADIUS = 0.075;
export const SPECIAL_RADIUS = 0.3;
/** ノーツが出てから叩くまで（拍）。スペシャルは早めに見せる */
export const APPROACH = 2.2;
export const SPECIAL_APPROACH = 3;
/** スペシャルをきめたあと、カメラが顔に寄って戻るまで（拍）。このあいだはノーツを出さない */
export const APPEAL = 2.6;
const SLIDE_STEPS = 16;
/** 手の先からノーツまで。指さしは指した先の少し遠くに置く */
const REACH = 0.07;
const POINT_REACH = 0.13;

const CHORUS = (m: 1 | -1, at: number): Move[] => {
  const [R, L] = m > 0 ? (['R', 'L'] as const) : (['L', 'R'] as const);
  const side = (id: string) => `${id}${m > 0 ? 'R' : 'L'}` as PoseId;
  const other = (id: string) => `${id}${m > 0 ? 'L' : 'R'}` as PoseId;
  return [
    [at, 'spread', 'special'],
    [at + 1.5, side('appeal')],
    [at + 5, side('reach'), R],
    [at + 6, other('reach'), L],
    [at + 7, 'heart', 'chest'],
    [at + 8, side('low'), `slide${R}`, 2, side('up')],
    [at + 12, other('up'), `hold${L}`, 2],
    [at + 14, 'idle'],
    [at + 16, 'crouch'],
    [at + 17, 'jump'],
    [at + 18, 'land', 'feet'],
    [at + 20, side('reach'), R],
    [at + 21, other('reach'), L],
    [at + 22, side('point'), R],
    [at + 23, 'heart', 'chest'],
    [at + 24, side('step'), `slide${L}`, 2, other('step')],
    [at + 27, 'heart', 'chest'],
    [at + 28, side('up'), `hold${R}`, 3]
  ];
};

const MOVES: Move[] = [
  // 前奏。手をふって、手のひらへ 4 つ
  [0, 'idle'],
  [2, 'waveR'],
  [4, 'waveL'],
  [6, 'heart'],
  [8, 'reachR', 'R'],
  [10, 'reachL', 'L'],
  [12, 'pointR', 'R'],
  [14, 'pointL', 'L'],
  // A メロ
  [16, 'reachR', 'R'],
  [18, 'reachL', 'L'],
  [20, 'heart', 'chest'],
  [22, 'idle'],
  [24, 'stepR', 'R'],
  [26, 'stepL', 'L'],
  [28, 'crouch'],
  [29, 'jump'],
  [30, 'land', 'feet'],
  [32, 'lowR', 'slideR', 2, 'upR'],
  [36, 'reachL', 'L'],
  [38, 'pointL', 'L'],
  [40, 'heart', 'chest'],
  [42, 'pointR', 'R'],
  [44, 'upR', 'holdR', 3],
  // B メロ。1 拍ずつに増やして、ステージを横切る
  [48, 'reachR', 'R'],
  [49, 'reachL', 'L'],
  [50, 'pointR', 'R'],
  [51, 'heart', 'chest'],
  [52, 'stepR', 'slideL', 2, 'stepL'],
  [56, 'pointR', 'R'],
  [57, 'pointL', 'L'],
  [58, 'heart', 'chest'],
  [60, 'upL', 'holdL', 2],
  [62, 'crouch'],
  ...CHORUS(1, 64),
  // 間奏
  [96, 'waveL', 'L'],
  [98, 'waveR', 'R'],
  [100, 'stepR', 'R'],
  [101, 'stepL', 'L'],
  [102, 'crouch'],
  ...CHORUS(-1, 104),
  // 後奏。最後のスペシャルで両手を広げる
  [136, 'reachR', 'R'],
  [137, 'reachL', 'L'],
  [138, 'heart', 'chest'],
  [140, 'spread', 'special'],
  [142, 'waveR']
];

/** 区間ごとのノリ（拍ごとにひざを沈める深さ） */
const GROOVE: Record<Scene, number> = { intro: 0.6, verse: 0.8, bridge: 0.9, chorus: 1, break: 1, finale: 0.8 };

function keysOf(moves: Move[]): Key[] {
  const keys: Key[] = [];
  moves.forEach(([beat, id, mark, len = 0, to], i) => {
    keys.push({ beat, pose: POSES[id] });
    const next = moves[i + 1]?.[0] ?? Infinity;
    if (mark?.startsWith('hold')) keys.push({ beat: beat + len, pose: POSES[id], glide: true });
    else if (mark?.startsWith('slide') && to) keys.push({ beat: beat + len, pose: POSES[to], glide: true });
    // 間があくときは、きめたかっこうのまま固まらず、ふつうの立ち姿に戻る
    else if (next - beat >= 3) keys.push({ beat: beat + 1.5, pose: POSES.idle });
  });
  return keys;
}

export const KEYS = keysOf(MOVES);

/** その拍のアイドルのかっこう（ノリも足したもの）。描くのもノーツの位置も、これを使う */
export function figure(beat: number) {
  return groove(poseAt(KEYS, beat), beat, beat < 0 ? 0 : GROOVE[sectionAt(beat).scene]);
}

function place(mark: Mark, beat: number): { at: P; shape: Shape } {
  const b = joints(figure(beat));
  const side = mark.endsWith('L') ? 0 : 1;
  switch (mark) {
    case 'chest':
      return { at: [(b.hand[0][0] + b.hand[1][0]) / 2, (b.hand[0][1] + b.hand[1][1]) / 2 - 0.02], shape: 'heart' };
    case 'feet':
      return { at: [b.hip[0], -0.04], shape: 'star' };
    case 'special':
      return { at: [b.hip[0], b.hip[1] - 0.2], shape: 'star' };
    default:
      return { at: tip(b, side, b.pose[side ? 'gripR' : 'gripL'] === 'point' ? POINT_REACH : REACH), shape: 'circle' };
  }
}

export function notesOf(moves: Move[]): Note[] {
  return moves.flatMap(([beat, , mark, len = 0]): Note[] => {
    if (!mark) return [];
    const { at, shape } = place(mark, beat);
    const kind: Kind =
      mark === 'special' ? 'special' : mark.startsWith('hold') ? 'hold' : mark.startsWith('slide') ? 'slide' : 'tap';
    const side = mark.endsWith('L') ? 0 : 1;
    const path =
      kind === 'slide'
        ? Array.from({ length: SLIDE_STEPS + 1 }, (_, i) =>
            tip(joints(figure(beat + (len * i) / SLIDE_STEPS)), side, REACH)
          )
        : [];
    const hand = mark === 'chest' || mark === 'feet' || kind === 'special' ? null : side;
    return [{ kind, t: beat * BEAT, end: (beat + len) * BEAT, x: at[0], y: at[1], path, shape, hand }];
  });
}

export const NOTES = notesOf(MOVES);

/** スペシャルの拍 */
export const SPECIALS = MOVES.filter((m) => m[2] === 'special').map((m) => m[0]);

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

export function mix(a: Camera, b: Camera, u: number): Camera {
  const l = (k: keyof Camera) => a[k] + (b[k] - a[k]) * u;
  return { fx: l('fx'), fy: l('fy'), zoom: l('zoom'), ay: l('ay'), roll: l('roll') };
}

const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));

/** 曲の頭は顔のアップから始めて、最初のノーツが出るまでに全身へ引く */
export function baseCamera(beat: number): Camera {
  return mix(OPENING, WIDE, ease(beat / 5));
}

/** スペシャルをきめてからの拍 d での、顔への寄り 0..1。最後のスペシャルは曲の終わりまで寄ったまま */
export function appeal(d: number, last: boolean): number {
  if (d < 0) return 0;
  if (d < 0.8) return ease(d / 0.8);
  if (last || d < 1.8) return 1;
  return 1 - ease((d - 1.8) / (APPEAL - 1.8));
}

/** 盤面の大きさ（ピクセル）での、世界 1 の長さ。縦長の iPad では背が画面の半分ほど、細長い画面は幅で決める */
export const unit = (w: number, h: number) => Math.min(h * 0.46, w / 1.3);

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
