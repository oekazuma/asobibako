import { scoreOf, type Song } from '$lib/music/tune';
import type { Theme } from './outfits';

/** ライブの曲。時刻はすべて曲の頭からの拍（1 拍 = BEAT 秒）で書き、秒に直すのは使う側 */

export const BPM = 132;
export const BEAT = 60 / BPM;
export const TITLE = 'きらめきステップ';
/** 曲の雰囲気。同じテーマの衣装を着るとボーナス */
export const THEME: Theme = 'pop';

/** サビは 2 回歌う */
const CHORUS = `c6 - c6 - d6 - c6 a5 | b5 - g5 - d6 - b5 - | b5 - g5 - e5 - g5 b5 | c6 - - - a5 - . . |
    a5 - c6 - f6 - e6 - | d6 - c6 - b5 - d6 - | e6 - - - d6 - c6 - | c6 - - - - - . .`;

/** 声は笛の音色で歌う。前奏 4・A 8・B 4・サビ 8・間奏 2・サビ 8・後奏 2 小節 */
export const SONG: Song = {
  beats: 4,
  lead: 'flute',
  style: 'pop',
  melody: `a5 - g5 a5 c6 - a5 - | g5 - d5 - g5 a5 b5 - | c6 - - - g5 - e5 - | g5 - - - . . . . |
    e5 - e5 g5 c6 - g5 - | d5 - d5 g5 b5 - a5 g5 | a5 - a5 g5 e5 - c5 - | e5 - g5 - b4 - . . |
    f5 - a5 - c6 - a5 g5 | g5 - e5 - c5 - e5 g5 | a5 - g5 - f5 - e5 f5 | g5 - - - - - . . |
    c6 - b5 - a5 - e5 - | b5 - a5 - g5 - e5 - | a5 - c6 - f6 - e6 d6 | d6 - - - . . . . |
    ${CHORUS} |
    a5 . c6 . f6 . e6 . | d6 . b5 . g5 - . . |
    ${CHORUS} |
    a5 - g5 - f5 - e5 - | c5 - - - - - - -`,
  chords: 'F G C C C G Am Em F C F G Am Em F G F G Em Am F G C C F G F G Em Am F G C C F C'
};

export type Scene = 'intro' | 'verse' | 'bridge' | 'chorus' | 'break' | 'finale';

export interface Section {
  from: number;
  scene: Scene;
  /** アイドルが歌う（口を動かす）区間 */
  sing: boolean;
}

export const SECTIONS: Section[] = [
  { from: 0, scene: 'intro', sing: false },
  { from: 16, scene: 'verse', sing: true },
  { from: 48, scene: 'bridge', sing: true },
  { from: 64, scene: 'chorus', sing: true },
  { from: 96, scene: 'break', sing: false },
  { from: 104, scene: 'chorus', sing: true },
  { from: 136, scene: 'finale', sing: true }
];

/** 曲の長さ（拍） */
export const LENGTH = 144;

export function sectionAt(beat: number): Section {
  let s = SECTIONS[0];
  for (const x of SECTIONS) if (beat >= x.from) s = x;
  return s;
}

/** 8 分音符ごとに、鳴っている旋律の音（出だしの位置と長さ）。口を動かすのに使う */
const sounding = (() => {
  const notes = scoreOf(SONG).notes;
  const out: { start: number; steps: number; midi: number }[] = [];
  let cur: (typeof out)[number] | null = null;
  notes.forEach((n, i) => {
    if (n) cur = { start: i, ...n };
    out[i] = cur && i < cur.start + cur.steps ? cur : { start: i, steps: 0, midi: 0 };
  });
  return out;
})();

/** 歌っている口の開き 0..1。音の出だしで大きく開き、のばすあいだは少しふるえ、音の切れ目で閉じる */
export function voice(beat: number): number {
  if (beat < 0 || !sectionAt(beat).sing) return 0;
  const step = beat * 2;
  const n = sounding[Math.floor(step)];
  if (!n?.steps) return 0;
  const u = step - n.start;
  if (u > n.steps - 0.25) return 0;
  const vowel = 0.55 + 0.45 * (((n.midi * 7) % 5) / 4);
  return vowel * Math.min(1, u * 6) * (n.steps > 2 ? 0.85 + 0.15 * Math.sin(u * 9) : 1);
}
