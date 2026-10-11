import type { V3 } from '$lib/sculpt';
import { placeOf } from '../mansion/layout';
import { EYE_HEIGHT, RADIUS, type Cling } from '../move';
import { scaleOf, type BodyType } from '../referee';
import { rng } from '../rng';
import type { Skill } from './levels';
import { NODES, type Node } from './paths';
import { SEEN } from './spot-seen';

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
  /** 背にする面への向き（長さ 1、体から面へ）。体の色はこの向きの先の面から写す */
  back: V3;
  /** その部屋の網の点から強い CPU の目で見た目立ちの平均（0..1、pnpm spots が体型ごとに測った spot-seen.ts の値） */
  seen: number;
  scale?: number;
}

type Row = Omit<Spot, 'seen' | 'scale'>;

/** spot-seen.ts の表のキー */
export const spotKey = (s: Pick<Spot, 'pos' | 'pose' | 'cling' | 'back'>): string => {
  const cling = s.cling?.kind === 'wall' ? `wall ${s.cling.nx + 0},${s.cling.nz + 0}` : (s.cling?.kind ?? 'floor');
  return `${s.pos.map((v) => v.toFixed(2)).join(',')} ${s.pose} ${cling} ${s.back.map((v) => v + 0).join(',')}`;
};

/** ずらす量の上限（m） */
export const SHIFT = 0.25;

const PI = Math.PI;
const N: V3 = [0, 0, 1];
const S: V3 = [0, 0, -1];
const E: V3 = [1, 0, 0];
const W: V3 = [-1, 0, 0];
const DOWN: V3 = [0, -1, 0];
const floor = (
  x: number,
  y: number,
  z: number,
  yaw: number,
  pose: string,
  tier: 0 | 1,
  back: V3,
  slack = SHIFT
): Row => ({ pos: [x, y, z], yaw, cling: null, pose, tier, slack, back });
const wall = (x: number, y: number, z: number, nx: number, nz: number, pose = 'stand', slack = SHIFT): Row => ({
  pos: [x, y, z],
  yaw: Math.atan2(-nx, -nz),
  cling: { kind: 'wall', nx, nz },
  pose,
  tier: 2,
  slack,
  back: [-nx, 0, -nz]
});
const ceiling = (x: number, y: number, z: number, slack = SHIFT): Row => ({
  pos: [x, y, z],
  yaw: 0,
  cling: { kind: 'ceiling' },
  pose: 'curl',
  tier: 2,
  slack,
  back: [0, 1, 0]
});

/**
 * 部屋ごとの候補。本家の定番の隠れ方に寄せ、本棚の前で立ち、天井で丸まり、壁の隅で寝そべり、家具の陰で丸まる。
 * どの種の置き方でも、slack までずらしても、埋まらず動く物の置き場所の候補にかからない（spots.test.ts が見る）
 */
const ROWS: Row[] = [
  // 大広間
  floor(-6.5, 0, 3.2, PI / 2, 'stand', 0, W), // 西の壁ぎわ、廊下への戸口の南
  floor(6.4, 0, 10.3, -PI / 2, 'cross', 0, E, 0.05), // 回廊の下の北東の隅
  floor(5.6, 0, 3.0, -PI / 2, 'curl', 1, DOWN, 0.2), // ピアノの東の陰
  floor(-5.6, 0, 9.3, PI, 'stand', 1, W, 0.15), // 回廊の下、西の円柱のうしろ
  wall(-3.0, 1.5, 0.2, 0, 1, 'lean'), // 入口の南の壁
  wall(6.8, 2.0, 2.0, -1, 0), // 東の壁、ピアノの南
  ceiling(2.5, 7, 6.0), // 大階段の東の天井
  floor(-2.3, 0, 10.95, PI, 'stand', 0, N, 0.05), // 木の壁の前で立つ
  floor(-4.55, 0, 11.7, PI, 'cross', 1, N, 0.05), // 木の壁の前であぐら
  floor(-6.55, 0, 9.7, PI / 2, 'crouch', 1, W), // 木の壁の前でしゃがむ
  floor(1.45, 0, 9.7, 1.73, 'lie', 1, DOWN), // 大階段の東の奥の大理石の床で寝そべる
  wall(-1.55, 1.8, 11.8, 0, -1, 'lie'), // 木の壁に張り付いて寝そべる
  wall(-4.05, 1.2, 11.8, 0, -1, 'lie', 0.15), // 木の壁に張り付いて寝そべる
  // 2 階の回廊
  floor(3.0, 3.5, 11.6, PI, 'stand', 0, N, 0.2), // 東の垂れ幕の下の壁ぎわ
  floor(-5.0, 3.5, 11.5, PI, 'curl', 1, DOWN), // 西の奥の隅
  floor(-2.5, 3.5, 11.6, PI / 2, 'lie', 1, DOWN, 0.15), // 北の壁ぎわで寝そべる
  floor(6.2, 3.5, 10.95, -PI / 2, 'stand', 0, E, 0.05), // 木の壁の前で立つ
  floor(0.2, 3.5, 11.2, PI, 'stand', 0, N), // 木の壁の前で立つ
  floor(1.95, 3.5, 11.7, PI, 'crouch', 1, N, 0.05), // 木の壁の前でしゃがむ
  floor(-3.3, 3.5, 10.7, -2.18, 'lie', 1, DOWN), // 回廊の床で寝そべる
  wall(0.2, 4.7, 11.8, 0, -1, 'stand'), // 木の壁に張り付いて立つ
  wall(6.8, 5.3, 10.45, -1, 0, 'lie'), // 木の壁に張り付いて寝そべる
  ceiling(-3.3, 7, 11.45, 0.15), // 格天井
  // 緑の廊下
  floor(-11.0, 0, 3.6, 0, 'stand', 0, S, 0.15), // 南の壁ぎわ、ランドリーの戸口の東
  floor(-21.8, 0, 6.3, PI / 2, 'crouch', 0, N, 0.1), // 西の端の北の隅
  floor(-22.3, 0, 5.0, PI / 2, 'stand', 1, W, 0.05), // 西の端の本棚の前
  floor(-8.9, 0, 6.3, PI, 'curl', 1, DOWN, 0.2), // 東の端の花瓶の横
  wall(-12.5, 1.6, 6.55, 0, -1), // 北の壁、ポスターの西
  ceiling(-19.0, 3.5, 5.0), // 西よりの天井
  floor(-13.8, 0, 3.95, 0, 'stand', 0, S), // 腰板の壁の前で立つ
  floor(-18.05, 0, 3.95, 0, 'stand', 0, S), // 腰板の壁の前で立つ
  floor(-7.8, 0, 3.7, -PI / 2, 'crouch', 1, E, 0.05), // 木の壁の前でしゃがむ
  floor(-22.55, 0, 3.7, PI / 2, 'cross', 1, W, 0.05), // 腰板の壁の前であぐら
  floor(-16.05, 0, 4.7, -2.5, 'curl', 1, DOWN), // 市松の床で丸まる
  wall(-22.8, 0.6, 5.95, 1, 0, 'lie', 0.05), // 腰板の壁に張り付いて寝そべる
  wall(-14.3, 1.2, 6.55, 0, -1, 'curl'), // 腰板の壁に張り付いて丸まる
  // 書斎
  floor(9.0, 0, 4.6, 0, 'stand', 0, E), // 南西の柱の西。柱は細く近くに面が無いので、見られる位置から見た向こうの色で塗る
  floor(15.6, 0, 3.2, PI, 'cross', 0, DOWN), // 地球儀の北
  floor(11.0, 0, 10.35, PI, 'stand', 1, N, 0.05), // 北の壁の本棚の前
  floor(16.5, 0, 8.6, PI, 'curl', 1, DOWN, 0.15), // 肘掛け椅子の北の陰
  wall(13.0, 1.6, 1.2, 0, 1), // 南の壁、2 つの窓のあいだ
  ceiling(12.25, 4, 3.0), // 机の南の天井
  floor(12.5, 0, 1.95, 0, 'stand', 0, S), // 木の壁の前で立つ
  floor(8.25, 0, 3.45, PI / 2, 'stand', 0, W, 0), // 木の壁の前で立つ
  floor(15.25, 0, 1.45, 0, 'cross', 1, S), // 木の壁の前であぐら
  floor(7.75, 0, 7.2, PI / 2, 'crouch', 1, W), // 木の壁の前でしゃがむ
  floor(15.25, 0, 5.95, 0.95, 'lie', 1, DOWN, 0.15), // 板の床で寝そべる
  wall(17.1, 2.4, 8.95, -1, 0, 'curl', 0.2), // 本棚の上の壁に張り付いて丸まる。プチは足が本棚の天板より下へ出るので、ずらすのは 0.2m まで
  wall(7.5, 1.8, 7.45, 1, 0, 'stand'), // 木の壁に張り付いて立つ
  // キッチン
  floor(-12.0, 0, 14.6, PI, 'stand', 0, N), // 北東の隅、鍋の棚の北
  floor(-19.0, 0, 9.5, PI / 2, 'crouch', 0, W), // 肉の棚の東。西の壁まで 1.5m より遠いので、見られる位置から見た向こうの色で塗る
  floor(-14.2, 0, 11.0, PI / 2, 'curl', 1, DOWN), // 島の台の東の陰
  floor(-20.25, 0, 11.1, PI / 2, 'stand', 1, W, 0.1), // 2 つの肉の棚のあいだ
  wall(-11.2, 1.5, 8.5, -1, 0, 'lean'), // 東の壁、レンジの南
  ceiling(-18.5, 3.5, 11.5), // 流しの南の天井
  floor(-17.55, 0, 8, 0, 'stand', 0, S, 0.05), // 南のタイルの壁の前で立つ
  floor(-13.55, 0, 14, PI, 'cross', 0, N), // タイルの壁の前であぐら
  floor(-14.3, 0, 14.75, PI, 'cross', 1, N, 0.05), // タイルの壁の前であぐら
  floor(-20.05, 0, 7.5, 0, 'stand', 1, S, 0.15), // 南のタイルの壁の前で立つ
  floor(-14.3, 0, 13, 0.29, 'curl', 1, DOWN), // 六角タイルの床で丸まる
  wall(-12.05, 1.2, 14.85, 0, -1, 'stand'), // タイルの壁に張り付いて立つ
  wall(-11.2, 0.6, 12.5, -1, 0, 'lie'), // タイルの壁に張り付いて寝そべる
  // ランドリー
  floor(-11.4, 0, 2.4, PI, 'stand', 0, N), // 北東の隅、廊下の壁の下
  floor(-13.4, 0, -1.8, 0, 'cross', 0, E, 0.2), // タオルの台の東、東の物を背に
  floor(-18.1, 0, -4.1, 0, 'curl', 1, DOWN, 0.05), // 南の洗濯機の前の隅
  floor(-14.5, 0, -3.7, 0, 'stand', 1, S), // タオルの台の南
  wall(-19.8, 1.6, -2.0, 1, 0), // 西の壁、木の棚の南
  ceiling(-15.0, 3.5, -3.6), // 洗濯ひもの南の天井
  floor(-19.05, 0, -2.1, PI / 2, 'stand', 0, W, 0), // ダマスクの壁の前で立つ
  floor(-13.55, 0, 2.15, PI, 'cross', 0, N, 0.05), // 北のダマスクの壁の前であぐら
  floor(-19.55, 0, 1.65, PI / 2, 'stand', 1, W, 0.05), // ダマスクの壁の前で立つ
  floor(-10.3, 0, 0.65, -PI / 2, 'cross', 1, E, 0.05), // ダマスクの壁の前であぐら
  floor(-12.55, 0, 1.9, -1.06, 'lie', 1, DOWN, 0.05), // 市松の床で寝そべる
  wall(-19.8, 1.8, -0.35, 1, 0, 'stand'), // ダマスクの壁に張り付いて立つ
  wall(-19.8, 1.2, -3.1, 1, 0, 'stand') // ダマスクの壁に張り付いて立つ
];

/** 壁の候補は通常の体の半径だけ壁から離れているので、小さい体では半径の差だけ壁へ寄せる（離れたままだと面から浮く） */
function fit(row: Row, scale: number): Row {
  if (row.cling?.kind !== 'wall') return row;
  const k = RADIUS * (1 - scale);
  const [x, y, z] = row.pos;
  return { ...row, pos: [x - row.cling.nx * k, y, z - row.cling.nz * k] };
}

// 測っていない候補は、いちばん目立つものとして扱う（spots.test.ts が測り忘れを見る）。表のキーは体型によらず通常の体の候補
const spotsOf = (body: BodyType): Spot[] => {
  const scale = scaleOf(body);
  return ROWS.map((r) => ({ ...fit(r, scale), seen: SEEN[body][spotKey(r)] ?? 1, scale }));
};

/** どちらも ROWS と同じ並び（pnpm spots が番号で通常の体の候補のキーを引く） */
export const SPOTS_OF: Record<BodyType, Spot[]> = { normal: spotsOf('normal'), petit: spotsOf('petit') };
export const SPOTS = SPOTS_OF.normal;

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
 * 試合の種で部屋の順を決め、CPU の何人めか（index）でその順の別々の部屋を取り、部屋の中の候補は、強さの段の候補を
 * 体型の表で目立たないほうから skill.pick の割合（少なくとも 1 つ）だけ残して rand で選ぶ。ずれは種と index から決める
 */
export function pickSpot(
  seed: number,
  index: number,
  skill: Pick<Skill, 'tiers' | 'pick'>,
  rand: () => number,
  body: BodyType = 'normal'
): Spot {
  const ok = SPOTS_OF[body].filter((s) => skill.tiers.includes(s.tier));
  const rooms = [...new Set(ok.map((s) => placeOf(s.pos)))];
  const r = rng(seed);
  for (let i = rooms.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
  }
  const here = ok.filter((s) => placeOf(s.pos) === rooms[index % rooms.length]).sort((a, b) => a.seen - b.seen);
  const best = here.slice(0, Math.max(1, Math.floor(here.length * skill.pick)));
  const spot = best[Math.floor(rand() * best.length)];
  const k = rng(seed + 7919 * (index + 1));
  return shifted(spot, k() * 2 - 1, k() * 2 - 1);
}
