import type { V3 } from '$lib/sculpt';
import { placeOf } from '../mansion/layout';
import { EYE_HEIGHT, type Cling } from '../move';
import { rng } from '../rng';
import { NODES, type Node } from './paths';

/** 隠れる CPU の置き場所。pos・yaw・cling は Body と同じ（壁なら面から RADIUS の 0.2m で壁を向き、天井なら天井の高さ） */
export interface Spot {
  pos: V3;
  yaw: number;
  cling: Cling | null;
  pose: string;
  /** 0 は床に立つ・座る、1 は壁ぎわ・家具の陰、2 は壁や天井の張り付き */
  tier: 0 | 1 | 2;
  /** 試合ごとにずらしてよい量（m）。壁や家具のすぐそばの候補は小さい */
  slack: number;
}

/** ずらす量の上限（m） */
export const SHIFT = 0.25;

const PI = Math.PI;
const floor = (x: number, y: number, z: number, yaw: number, pose: string, tier: 0 | 1, slack = SHIFT): Spot => ({
  pos: [x, y, z],
  yaw,
  cling: null,
  pose,
  tier,
  slack
});
const wall = (x: number, y: number, z: number, nx: number, nz: number, pose = 'stand'): Spot => ({
  pos: [x, y, z],
  yaw: Math.atan2(-nx, -nz),
  cling: { kind: 'wall', nx, nz },
  pose,
  tier: 2,
  slack: SHIFT
});
const ceiling = (x: number, y: number, z: number): Spot => ({
  pos: [x, y, z],
  yaw: 0,
  cling: { kind: 'ceiling' },
  pose: 'curl',
  tier: 2,
  slack: SHIFT
});

/**
 * 部屋ごとの候補。本家の定番の隠れ方に寄せ、本棚の前で立ち、天井で丸まり、壁の隅で寝そべり、家具の陰で丸まる。
 * どの種の置き方でも、slack までずらしても、埋まらず動く物の置き場所の候補にかからない（spots.test.ts が見る）
 */
export const SPOTS: Spot[] = [
  // 大広間
  floor(-6.5, 0, 3.2, PI / 2, 'stand', 0), // 西の壁ぎわ、廊下への戸口の南
  floor(6.4, 0, 10.3, -PI / 2, 'cross', 0, 0.05), // 回廊の下の北東の隅
  floor(5.6, 0, 3.0, -PI / 2, 'curl', 1, 0.2), // ピアノの東の陰
  floor(-5.6, 0, 9.3, PI, 'stand', 1, 0.15), // 回廊の下、西の円柱のうしろ
  wall(-3.0, 1.5, 0.2, 0, 1, 'lean'), // 入口の南の壁
  wall(6.8, 2.0, 2.0, -1, 0), // 東の壁、ピアノの南
  ceiling(2.5, 7, 6.0), // 大階段の東の天井
  // 2 階の回廊
  floor(3.0, 3.5, 11.6, PI, 'stand', 0, 0.2), // 東の垂れ幕の下の壁ぎわ
  floor(-5.0, 3.5, 11.5, PI, 'curl', 1), // 西の奥の隅
  floor(-2.5, 3.5, 11.6, PI / 2, 'lie', 1, 0.15), // 北の壁ぎわで寝そべる
  // 緑の廊下
  floor(-11.0, 0, 3.6, 0, 'stand', 0, 0.15), // 南の壁ぎわ、ランドリーの戸口の東
  floor(-21.8, 0, 6.3, PI / 2, 'crouch', 0, 0.1), // 西の端の北の隅
  floor(-22.3, 0, 5.0, PI / 2, 'stand', 1, 0.05), // 西の端の本棚の前
  floor(-8.9, 0, 6.3, PI, 'curl', 1, 0.2), // 東の端の花瓶の横
  wall(-12.5, 1.6, 6.55, 0, -1), // 北の壁、ポスターの西
  ceiling(-19.0, 3.5, 5.0), // 西よりの天井
  // 書斎
  floor(9.0, 0, 4.6, 0, 'stand', 0), // 南西の柱の西
  floor(15.6, 0, 3.2, PI, 'cross', 0), // 地球儀の北
  floor(11.0, 0, 10.35, PI, 'stand', 1, 0.05), // 北の壁の本棚の前
  floor(16.5, 0, 8.6, PI, 'curl', 1, 0.15), // 肘掛け椅子の北の陰
  wall(13.0, 1.6, 1.2, 0, 1), // 南の壁、2 つの窓のあいだ
  ceiling(12.25, 4, 3.0), // 机の南の天井
  // キッチン
  floor(-12.0, 0, 14.6, PI, 'stand', 0), // 北東の隅、鍋の棚の北
  floor(-19.0, 0, 9.5, PI / 2, 'crouch', 0), // 肉の棚の東
  floor(-14.2, 0, 11.0, PI / 2, 'curl', 1), // 島の台の東の陰
  floor(-20.25, 0, 11.1, PI / 2, 'stand', 1, 0.1), // 2 つの肉の棚のあいだ
  wall(-11.2, 1.5, 8.5, -1, 0, 'lean'), // 東の壁、レンジの南
  ceiling(-18.5, 3.5, 11.5), // 流しの南の天井
  // ランドリー
  floor(-11.4, 0, 2.4, PI, 'stand', 0), // 北東の隅、廊下の壁の下
  floor(-13.4, 0, -1.8, 0, 'cross', 0, 0.2), // タオルの台の東
  floor(-18.1, 0, -4.1, 0, 'curl', 1, 0.05), // 南の洗濯機の前の隅
  floor(-14.5, 0, -3.7, 0, 'stand', 1), // タオルの台の南
  wall(-19.8, 1.6, -2.0, 1, 0), // 西の壁、木の棚の南
  ceiling(-15.0, 3.5, -3.6) // 洗濯ひもの南の天井
];

/** spot を a・b（−1〜1）× spot.slack だけずらす。床と天井は x と z、壁は壁に沿った横と高さ（面からの距離は変えない） */
export function shifted(spot: Spot, a: number, b: number): Spot {
  const [x, y, z] = spot.pos;
  const k = spot.slack;
  if (spot.cling?.kind === 'wall') {
    const { nx, nz } = spot.cling;
    return { ...spot, pos: [x - nz * a * k, y + b * k, z + nx * a * k] };
  }
  return { ...spot, pos: [x + a * k, y, z + b * k] };
}

/** 部屋ごとの「見られる位置」。ハンターが入ってくる戸口あたり（大広間は探索の入口） */
const VIEWS: Record<string, Node> = {
  大広間: 'entrance',
  '2階の回廊': 'stairTop',
  緑の廊下: 'corridorEast',
  書斎: 'studyDoor',
  キッチン: 'kitchen',
  ランドリー: 'laundry'
};

export function viewOf(spot: Spot): V3 {
  const [x, y, z] = NODES[VIEWS[placeOf(spot.pos)]];
  return [x, y + EYE_HEIGHT, z];
}

/**
 * 試合の種で部屋の順を決め、CPU の何人めか（index）でその順の別々の部屋を取り、部屋の中の候補は rand で選ぶ。
 * ずれは種と index から決める
 */
export function pickSpot(seed: number, index: number, tiers: readonly number[], rand: () => number): Spot {
  const ok = SPOTS.filter((s) => tiers.includes(s.tier));
  const rooms = [...new Set(ok.map((s) => placeOf(s.pos)))];
  const r = rng(seed);
  for (let i = rooms.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
  }
  const here = ok.filter((s) => placeOf(s.pos) === rooms[index % rooms.length]);
  const spot = here[Math.floor(rand() * here.length)];
  const k = rng(seed + 7919 * (index + 1));
  return shifted(spot, k() * 2 - 1, k() * 2 - 1);
}
