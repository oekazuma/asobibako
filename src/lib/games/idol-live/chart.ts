import { scoreOf, type Song } from '$lib/music/tune';
import type { Theme } from './outfits';
import { joints, poseAt, POSES, groove, tip, type Key, type P, type PoseId } from './pose';

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
export type Mark = 'R' | 'L' | 'chest' | 'feet' | 'holdR' | 'holdL' | 'slideR' | 'slideL' | 'special';
export type Move = [beat: number, pose: PoseId, mark?: Mark, len?: number, to?: PoseId];

export type Scene = 'intro' | 'verse' | 'bridge' | 'chorus' | 'break' | 'finale';

export interface Section {
  from: number;
  scene: Scene;
  /** アイドルが歌う（口を動かす）区間 */
  sing: boolean;
}

/** 曲 1 つぶんの書きもの。時刻はすべて曲の頭からの拍で書く */
export interface SongDef {
  id: string;
  title: string;
  /** 曲の雰囲気。同じテーマの衣装を着るとボーナス */
  theme: Theme;
  bpm: number;
  music: Song;
  sections: Section[];
  moves: Move[];
  /** 遊べるようになるファンの数 */
  fans: number;
}

export type Level = 'easy' | 'normal';

/** ノーツの半径（世界）。スペシャルは体ごと囲む */
export const RADIUS = 0.075;
export const SPECIAL_RADIUS = 0.3;
/** ノーツが出てから叩くまで（拍）。スペシャルは早めに見せる */
export const APPROACH = 2.2;
export const SPECIAL_APPROACH = 3;
const SLIDE_STEPS = 16;
/** 手の先からノーツまで。指さしは指した先の少し遠くに置く */
const REACH = 0.07;
const POINT_REACH = 0.13;

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

/** 8 分音符ごとに鳴っている旋律の音（出だしの位置と長さ）。口を動かすのに使う */
interface Sounding {
  start: number;
  steps: number;
  midi: number;
}

/**
 * 曲 1 つ。ふりつけから、拍ごとのかっこう・ノーツ（むずかしさごと）・口の動きを出す。
 * 秒と拍の行き来はここの beat（1 拍の秒）で行う
 */
export class Track {
  readonly def: SongDef;
  readonly beat: number;
  /** 曲の長さ（拍） */
  readonly length: number;
  readonly keys: Key[];
  readonly charts: Record<Level, Note[]>;
  /** スペシャルの拍 */
  readonly specials: number[];
  readonly #sounding: Sounding[] = [];

  constructor(def: SongDef) {
    this.def = def;
    this.beat = 60 / def.bpm;
    const notes = scoreOf(def.music).notes;
    this.length = notes.length / 2;
    let cur: Sounding | null = null;
    notes.forEach((n, i) => {
      if (n) cur = { start: i, ...n };
      this.#sounding[i] = cur && i < cur.start + cur.steps ? cur : { start: i, steps: 0, midi: 0 };
    });
    // 曲が終わったら、手を振る・ハート・両手を広げるをくり返すカーテンコール
    const bow: PoseId[] = ['waveR', 'waveL', 'heart', 'spread'];
    const curtain = Array.from({ length: 64 }, (_, i): Move => [this.length + 2 * i, bow[i % bow.length]]);
    this.keys = keysOf([...def.moves, ...curtain]);
    const all = this.#notes(def.moves);
    this.charts = { easy: thin(all, this.beat), normal: all };
    this.specials = def.moves.filter((m) => m[2] === 'special').map((m) => m[0]);
  }

  sectionAt(beat: number): Section {
    let s = this.def.sections[0];
    for (const x of this.def.sections) if (beat >= x.from) s = x;
    return s;
  }

  /** その拍のアイドルのかっこう（ノリも足したもの）。描くのもノーツの位置も、これを使う */
  figure(beat: number) {
    return groove(poseAt(this.keys, beat), beat, beat < 0 ? 0 : GROOVE[this.sectionAt(beat).scene]);
  }

  /** 歌っている口の開き 0..1。音の出だしで大きく開き、のばすあいだは少しふるえ、音の切れ目で閉じる */
  voice(beat: number): number {
    if (beat < 0 || !this.sectionAt(beat).sing) return 0;
    const step = beat * 2;
    const n = this.#sounding[Math.floor(step)];
    if (!n?.steps) return 0;
    const u = step - n.start;
    if (u > n.steps - 0.25) return 0;
    const vowel = 0.55 + 0.45 * (((n.midi * 7) % 5) / 4);
    return vowel * Math.min(1, u * 6) * (n.steps > 2 ? 0.85 + 0.15 * Math.sin(u * 9) : 1);
  }

  #place(mark: Mark, beat: number): { at: P; shape: Shape } {
    const b = joints(this.figure(beat));
    const side = mark.endsWith('L') ? 0 : 1;
    switch (mark) {
      case 'chest':
        return { at: [(b.hand[0][0] + b.hand[1][0]) / 2, (b.hand[0][1] + b.hand[1][1]) / 2 - 0.02], shape: 'heart' };
      case 'feet':
        return { at: [b.hip[0], -0.04], shape: 'star' };
      case 'special':
        return { at: [b.hip[0], b.hip[1] - 0.2], shape: 'star' };
      default:
        return {
          at: tip(b, side, b.pose[side ? 'gripR' : 'gripL'] === 'point' ? POINT_REACH : REACH),
          shape: 'circle'
        };
    }
  }

  #notes(moves: Move[]): Note[] {
    return moves.flatMap(([beat, , mark, len = 0]): Note[] => {
      if (!mark) return [];
      const { at, shape } = this.#place(mark, beat);
      const kind: Kind =
        mark === 'special' ? 'special' : mark.startsWith('hold') ? 'hold' : mark.startsWith('slide') ? 'slide' : 'tap';
      const side = mark.endsWith('L') ? 0 : 1;
      const path =
        kind === 'slide'
          ? Array.from({ length: SLIDE_STEPS + 1 }, (_, i) =>
              tip(joints(this.figure(beat + (len * i) / SLIDE_STEPS)), side, REACH)
            )
          : [];
      const hand = mark === 'chest' || mark === 'feet' || kind === 'special' ? null : side;
      return [{ kind, t: beat * this.beat, end: (beat + len) * this.beat, x: at[0], y: at[1], path, shape, hand }];
    });
  }
}

/** かんたん。前に残したノーツの終わりから 2 拍あかないノーツを抜く。ふりつけは同じで、スペシャルは残す */
export function thin(notes: Note[], beat: number): Note[] {
  const out: Note[] = [];
  for (const n of notes) {
    const prev = out.at(-1);
    if (n.kind === 'special' || !prev || n.t - prev.end >= 2 * beat - 1e-6) out.push(n);
  }
  return out;
}
