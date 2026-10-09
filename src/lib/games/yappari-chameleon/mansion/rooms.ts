import type { V3 } from '$lib/sculpt';
import type { Box } from '../move';
import type { Light, Piece, Slab } from './layout';

/** 部屋の中（床の上の空き） */
export const STUDY = { min: [7.3, 0, 1] as V3, max: [17.3, 4, 11] as V3 };
export const KITCHEN = { min: [-21, 0, 7.05] as V3, max: [-11, 3.5, 15.05] as V3 };
export const LAUNDRY = { min: [-20, 0, -5.05] as V3, max: [-10, 3.5, 2.95] as V3 };
/** 戸口の高さ。幅は 1.5m（大広間と廊下の戸口と同じ） */
export const DOOR_H = 2.4;
/**
 * 戸口と、その両側 1.2m の通り道。動く物を置かない（props.test.ts が見る）。
 * 大広間の西（廊下へ）・東（書斎へ）、廊下の北（キッチンへ）・南（ランドリーへ）
 */
export const DOORWAYS: Box[] = [
  { min: [-8.5, 0, 4.25], max: [-5.8, DOOR_H, 5.75] },
  { min: [5.8, 0, 5.25], max: [8.5, DOOR_H, 6.75] },
  { min: [-16.75, 0, 5.55], max: [-15.25, DOOR_H, 8.25] },
  { min: [-15.75, 0, 1.75], max: [-14.25, DOOR_H, 4.45] }
];
const T = 0.3;

/** 西の壁は大広間の東の壁の裏。床は戸口の下（x 7〜7.3）まで伸ばす */
function study(): Slab[] {
  const [x0, , z0] = STUDY.min;
  const [x1, h, z1] = STUDY.max;
  return [
    { min: [x0 - T, -1, z0], max: [x1, 0, z1], mat: 'planks', face: 'y+' },
    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'coffer', face: 'y-' },
    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'woodPanel', face: 'z+' },
    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'woodPanel', face: 'z-' },
    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'woodPanel', face: 'x-' }
  ];
}

/** 南の壁は廊下の北の壁の裏 */
function kitchen(): Slab[] {
  const [x0, , z0] = KITCHEN.min;
  const [x1, h, z1] = KITCHEN.max;
  return [
    { min: [x0, -1, z0 - T], max: [x1, 0, z1], mat: 'blueHex', face: 'y+' },
    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'white', face: 'y-' },
    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'whiteTile', face: 'z-' },
    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'whiteTile', face: 'x+' },
    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'whiteTile', face: 'x-' }
  ];
}

/** 北の壁は廊下の南の壁の裏 */
function laundry(): Slab[] {
  const [x0, , z0] = LAUNDRY.min;
  const [x1, h, z1] = LAUNDRY.max;
  return [
    { min: [x0, -1, z0], max: [x1, 0, z1 + T], mat: 'checker', face: 'y+' },
    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'woodPanel', face: 'y-' },
    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'brick', face: 'z+' },
    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'brick', face: 'x+' },
    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'brick', face: 'x-' }
  ];
}

export const roomSlabs = (): Slab[] => [...study(), ...kitchen(), ...laundry()];

const p = (kind: Piece['kind'], at: V3, turn: Piece['turn'] = 0, span?: number): Piece => ({ kind, at, turn, span });

/** 動かない家具。書斎は北と東の壁一面の本棚と、南の壁の額 2 枚 */
export function roomPieces(): Piece[] {
  return [
    ...Array.from({ length: 8 }, (_, k) => p('bookshelf', [7.9 + 1.2 * k, 0, 10.8], 2)),
    ...Array.from({ length: 7 }, (_, k) => p('bookshelf', [17.1, 0, 1.9 + 1.2 * k], 3)),
    p('painting', [11.5, 1.8, 1.0]),
    p('painting', [14.0, 1.8, 1.0])
  ];
}

/** 書斎は机の上のランプの暖色、キッチンは白い天井灯、ランドリーは少し暗め */
export const roomLights = (): Light[] => [
  { at: [12.3, 2.4, 6], color: '#ffd59a', power: 12, reach: 12 },
  // 天井のダクト（x −16.3〜−15.7）の中に入らないよう、少し東へ寄せる
  { at: [-14, 3.1, 11], color: '#f2f6ff', power: 8, reach: 13 },
  { at: [-15, 3.2, -1], color: '#ffe2c4', power: 7, reach: 11 }
];
