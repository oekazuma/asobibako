import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import type { Box, Cling } from '../move';
import type { Light, Piece, Slab } from './layout';

/** 屋敷と控室から離した 16m 四方・高さ 6m のロビー。出口は無い */
export const LOBBY = { min: [-8, 0, -68] as V3, max: [8, 6, -52] as V3 };
/** まん中の赤い丸い台。乗るとハンター希望になる */
export const PODIUM = { at: [0, 0, -60] as V3, r: 1.2, h: 0.3 };
const T = 0.3;

export function lobbySlabs(): Slab[] {
  const [x0, , z0] = LOBBY.min;
  const [x1, h, z1] = LOBBY.max;
  return [
    { min: [x0, -1, z0], max: [x1, 0, z1], mat: 'splashFloor', face: 'y+' },
    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'splashCeiling', face: 'y-' },
    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'splash', face: 'z+' },
    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'splash', face: 'z-', shift: 0.25, flip: true },
    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'splash', face: 'x+', shift: 0.5 },
    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'splash', face: 'x-', shift: 0.75, flip: true }
  ];
}

/**
 * 丸い台の当たり。乗れる高さ（STEP と同じ）の箱を 5 つ重ねて、角がどれも半径 1.2m の円の上に乗る多角形にする
 * （角が円の外へ出ると、見えない所で体が台に当たる）
 */
export function podiumBoxes(): Box[] {
  const [cx, , cz] = PODIUM.at;
  return [
    [1.18, 0.22],
    [0.22, 1.18],
    [1.04, 0.6],
    [0.6, 1.04],
    [0.85, 0.85]
  ].map(([w, d]) => ({ min: [cx - w, 0, cz - d], max: [cx + w, PODIUM.h, cz + d] }));
}

/** 壁 1 面に 4 つずつの白いアーチ。壁の内側の面に、部屋の中を向けて置く */
function arches(): Piece[] {
  const [x0, , z0] = LOBBY.min;
  const [x1, , z1] = LOBBY.max;
  return [2, 6, 10, 14].flatMap((d): Piece[] => [
    { kind: 'lobby-arch', at: [x0 + d, 0, z0], turn: 0 },
    { kind: 'lobby-arch', at: [x0 + d, 0, z1], turn: 2 },
    { kind: 'lobby-arch', at: [x0, 0, z0 + d], turn: 1 },
    { kind: 'lobby-arch', at: [x1, 0, z0 + d], turn: 3 }
  ]);
}

export function lobbyPieces(): Piece[] {
  return [
    ...arches(),
    { kind: 'podium', at: PODIUM.at, turn: 0 },
    // 本家のロビーの端の水色の台（本家はこのそばでマップの設定を開く。こちらは画面のボタンで開く）
    { kind: 'pedestal', at: [6.6, 0, -66.6], turn: 0 }
  ];
}

export const lobbyLights = (): Light[] => [{ at: [0, 5.4, -60], color: '#ffffff', power: 14, reach: 20 }];

/** 壁の厚みまで含めたロビーの中か */
export function inLobby(p: V3): boolean {
  return [0, 1, 2].every((i) => p[i] >= LOBBY.min[i] - T && p[i] <= LOBBY.max[i] + T);
}

/** 台の南に並び、北（+z）の台を向いて出る */
export const LOBBY_SPAWNS: Record<Seat, V3> = { 1: [0, 0, -64.5], 2: [-1.5, 0, -64.5], 3: [1.5, 0, -64.5] };

/**
 * 台の上にいる。足もとが台の上面より上（跳んでいる最中も）で、体の中心が台の円の内側。
 * 体の円は縁から少しはみ出しても上面に立てるので、立っている高さではなく中心で決める
 */
export function onPodium(b: { pos: V3; cling: Cling | null }): boolean {
  const [x, y, z] = b.pos;
  const [cx, , cz] = PODIUM.at;
  return !b.cling && y >= PODIUM.h - 0.05 && Math.hypot(x - cx, z - cz) < PODIUM.r;
}
