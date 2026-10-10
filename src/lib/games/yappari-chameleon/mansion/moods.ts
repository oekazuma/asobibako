import type { V3 } from '$lib/sculpt';
import { placeOf } from './layout';
import { inLobby } from './lobby';

/** カメラのいる部屋の明るさ。どれも shader の uniform なので、部屋を移っても材質を作り直さない */
export interface Mood {
  /** 上からの日。影を落とすのはこの光だけで、部屋の天井は日を遮らないので、部屋ごとの暗さはこの強さで作る */
  sun: number;
  /** 半球の光の空の色・床の色・強さ */
  sky: string;
  ground: string;
  fill: number;
  /** 映り込みの環境の強さ */
  env: number;
  exposure: number;
}

/** 大広間・緑の廊下・控室 */
export const DAY: Mood = { sun: 1.6, sky: '#fff4e0', ground: '#5a4a3a', fill: 1.1, env: 0.45, exposure: 1 };

/** 本家の画面の明るさに寄せた部屋ごとの値。隠れる・探すが見えなくならないよう、本家より少し明るくしてある */
export const MOODS: Record<string, Mood> = {
  キッチン: { sun: 0.4, sky: '#b8c8c0', ground: '#26332f', fill: 0.45, env: 0.3, exposure: 0.72 },
  ランドリー: { sun: 0.3, sky: '#d8c8c0', ground: '#2a1814', fill: 0.42, env: 0.2, exposure: 0.95 },
  書斎: { sun: 0.5, sky: '#ffd9b0', ground: '#3a2214', fill: 0.6, env: 0.6, exposure: 1.0 }
};

// 日の影は屋敷だけを覆うので、影の外のロビーでは上を向いた面が日で白く飛ぶ
const LOBBY_MOOD: Mood = { ...DAY, sun: 0 };

export const moodAt = (at: V3): Mood => (inLobby(at) ? LOBBY_MOOD : (MOODS[placeOf(at)] ?? DAY));

/**
 * 今の明るさを目標へ寄せる割合。戸口をまたいだ瞬間に跳ぶと目立つので 0.3 秒ほどで移すが、
 * 日が 0 の部屋（ロビー）へ入るときは、日の影の外で上を向いた面が白く飛ぶので、すぐに切る
 */
export const blendK = (to: Mood, elapsedMs: number | null): number =>
  elapsedMs === null || to.sun === 0 ? 1 : 1 - Math.exp(-elapsedMs / 300);
