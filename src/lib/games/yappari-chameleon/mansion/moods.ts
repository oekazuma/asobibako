import type { V3 } from '$lib/sculpt';
import { fromHex, linearToSrgb, srgbToLinear, type RGB } from '../color';
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

/** 日の光の色。日は真上から当たる（world3d の日の位置と向き先は同じ x・z） */
export const SUN_COLOR = '#fff1dc';

/**
 * 映り込み（強さ 1 あたり）の、法線の y の 2 次の式の係数。環境の画像（RoomEnvironment）は上が明るいので向きで変わる。
 * 大広間で白い面を向きごとに描いて測った明るさから、日と半球の光のぶんを引いて決めた
 */
const ENV = [1, 0.63, 0.22];

const linear = (hex: string): RGB => fromHex(hex).map(srgbToLinear) as RGB;

/** 光の前の色が白い面が、法線の y が up のときに受ける光（線形の RGB、three の拡散の式に合わせる）。点光源と影は数えない */
export function irradiance(m: Mood, up: number): RGB {
  const sun = linear(SUN_COLOR);
  const sky = linear(m.sky);
  const ground = linear(m.ground);
  const w = 0.5 * up + 0.5;
  const env = m.env * (ENV[0] + ENV[1] * up + ENV[2] * up * up);
  return sun.map(
    (s, i) => (m.sun * Math.max(0, up) * s + m.fill * (ground[i] + (sky[i] - ground[i]) * w)) / Math.PI + env
  ) as RGB;
}

/**
 * 法線の y が from の面に見えている光の前の色 c（sRGB）を、法線の y が to の面に塗って同じ明るさに見せる色。
 * 上を向く床は日を受けて明るく、横を向く体は受けないので、そのまま塗ると暗く見える。白より明るくは塗れないので、1 を超えるぶんは色合いを保って下げる
 */
export function relight(c: RGB, m: Mood, from: number, to: number): RGB {
  const a = irradiance(m, from);
  const b = irradiance(m, to);
  const lit = c.map((v, i) => (srgbToLinear(v) * a[i]) / b[i]);
  const top = Math.max(1, ...lit);
  return lit.map((v) => linearToSrgb(v / top)) as RGB;
}

// 日の影は屋敷だけを覆うので、影の外のロビーでは上を向いた面が日で白く飛ぶ
const LOBBY_MOOD: Mood = { ...DAY, sun: 0 };

export const moodAt = (at: V3): Mood => (inLobby(at) ? LOBBY_MOOD : (MOODS[placeOf(at)] ?? DAY));

/**
 * 今の明るさを目標へ寄せる割合。戸口をまたいだ瞬間に跳ぶと目立つので 0.3 秒ほどで移すが、
 * 日が 0 の部屋（ロビー）へ入るときは、日の影の外で上を向いた面が白く飛ぶので、すぐに切る
 */
export const blendK = (to: Mood, elapsedMs: number | null): number =>
  elapsedMs === null || to.sun === 0 ? 1 : 1 - Math.exp(-elapsedMs / 300);
