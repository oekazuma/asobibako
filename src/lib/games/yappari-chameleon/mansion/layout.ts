import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import type { Box, Level, Ramp } from '../move';
import { LOBBY, LOBBY_SPAWNS, lobbyLights, lobbyPieces, lobbySlabs, podiumBoxes } from './lobby';
import { artOf, propPieces } from './props';
import { roomLights, roomPieces, roomSlabs } from './rooms';

export type Mat =
  | 'woodPanel'
  | 'marble'
  | 'coffer'
  | 'checker'
  | 'greenDamask'
  | 'wainscot'
  | 'cream'
  | 'rail'
  | 'white'
  | 'splash'
  | 'splashFloor'
  | 'splashCeiling'
  | 'planks'
  | 'whiteTile'
  | 'blueHex'
  | 'brick';
export type Face = 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';

export interface Slab {
  min: V3;
  max: V3;
  mat: Mat;
  face: Face;
  /** 面の裏（face の向きの反対）の材質。大広間と廊下の壁の裏が、となりの部屋の壁になる */
  back?: Mat;
  shadow?: boolean;
}

export type Kind =
  | 'piano'
  | 'rug'
  | 'table-white'
  | 'table-red'
  | 'chair'
  | 'column'
  | 'sofa'
  | 'bench'
  | 'bookshelf'
  | 'vase'
  | 'balloons'
  | 'balloon'
  | 'horse'
  | 'chandelier'
  | 'sconce'
  | 'painting'
  | 'poster'
  | 'ribbons'
  | 'bunting'
  | 'banner'
  | 'stairs'
  | 'podium'
  | 'pedestal'
  | 'post'
  | 'desk'
  | 'globe'
  | 'bust'
  | 'folding-chair'
  | 'book-pile'
  | 'counter'
  | 'sink'
  | 'plates'
  | 'meat-rack'
  | 'gas'
  | 'duct'
  | 'caution'
  | 'box'
  | 'bucket'
  | 'washer'
  | 'clothesline'
  | 'towels'
  | 'cart'
  | 'drain'
  | 'vent';

export interface Piece {
  kind: Kind;
  at: V3;
  turn: 0 | 1 | 2 | 3;
  span?: number;
}

/** 当たりの幅（x）・高さ（y）・奥行（z）。turn が奇数なら幅と奥行を入れ替える。null は当たらない飾り */
export const SIZES: Record<Kind, V3 | null> = {
  piano: [1.5, 1.0, 2.0],
  rug: null,
  'table-white': [1.2, 0.76, 1.2],
  'table-red': [1.2, 0.76, 1.2],
  chair: [0.45, 0.95, 0.45],
  column: [0.5, 3.3, 0.5],
  sofa: [2.0, 0.85, 0.9],
  bench: [1.6, 0.46, 0.45],
  bookshelf: [1.2, 2.2, 0.4],
  vase: [0.6, 1.1, 0.6],
  balloons: [0.8, 1.7, 0.8],
  balloon: [0.45, 0.45, 0.45],
  horse: [1.4, 1.7, 0.6],
  chandelier: null,
  sconce: null,
  painting: null,
  poster: null,
  ribbons: null,
  bunting: null,
  banner: null,
  stairs: null,
  // 当たりは solids の八角形
  podium: null,
  pedestal: [0.9, 1.0, 0.9],
  post: [0.35, 4, 0.35],
  desk: [1.6, 0.76, 0.8],
  globe: [0.6, 1.1, 0.6],
  bust: [0.45, 1.6, 0.45],
  'folding-chair': [0.45, 0.85, 0.45],
  'book-pile': [0.4, 0.35, 0.3],
  counter: [2.0, 0.9, 0.7],
  sink: [2.0, 0.9, 0.7],
  plates: null,
  'meat-rack': [1.6, 2.0, 0.5],
  gas: [0.35, 1.1, 0.35],
  duct: null,
  caution: null,
  box: [0.6, 0.45, 0.45],
  bucket: [0.3, 0.3, 0.3],
  washer: [0.65, 0.85, 0.65],
  clothesline: null,
  towels: [0.5, 0.5, 0.4],
  cart: [0.8, 0.9, 0.55],
  drain: null,
  vent: null
};

export interface Light {
  at: V3;
  color: string;
  power: number;
  reach: number;
}

export interface Mansion {
  slabs: Slab[];
  pieces: Piece[];
  ramps: Ramp[];
  spawn: V3;
  /** 見えない当たり（丸い台の八角形）。カメラの殻には入れない */
  solids: Box[];
  lights: Light[];
  /** pieces の最後の動く物の数（種で位置と向きだけが変わる） */
  moving: number;
  /** 額の絵柄（pieces の painting の順） */
  arts: number[];
}

const HALL_H = 7;
const GAP = 0.01;
const FLOOR2 = 3.5;
const CORR_H = 3.5;
const T = 0.3;
const STAIR: Ramp = { min: [-1.25, 0, 3.5], max: [1.25, FLOOR2, 9], rise: 'z+' };

function hall(): Slab[] {
  const s: Slab[] = [
    { min: [-7, -1, 0], max: [7, 0, 12], mat: 'marble', face: 'y+' },
    { min: [-7, HALL_H, 0], max: [7, HALL_H + T, 12], mat: 'coffer', face: 'y-' },
    { min: [-7, 0, -T], max: [7, HALL_H, 0], mat: 'woodPanel', face: 'z+' },
    { min: [-7, 0, 12], max: [7, HALL_H, 12 + T], mat: 'woodPanel', face: 'z-' },
    { min: [7, 0, 0], max: [7 + T, HALL_H, 5.25], mat: 'woodPanel', face: 'x-', back: 'woodPanel' },
    { min: [7, 0, 6.75], max: [7 + T, HALL_H, 12], mat: 'woodPanel', face: 'x-', back: 'woodPanel' },
    { min: [7, 2.4, 5.25], max: [7 + T, HALL_H, 6.75], mat: 'woodPanel', face: 'x-', back: 'woodPanel' },
    { min: [-7 - T, 0, 0], max: [-7, HALL_H, 4.25], mat: 'woodPanel', face: 'x+' },
    { min: [-7 - T, 0, 5.75], max: [-7, HALL_H, 12], mat: 'woodPanel', face: 'x+' },
    { min: [-7 - T, 2.4, 4.25], max: [-7, HALL_H, 5.75], mat: 'woodPanel', face: 'x+' },
    // 2 階の回廊の床。下に影を落とす。床と手すりの端が左右の壁の面と重なるとちらつくので、壁から 1cm 離す
    { min: [-7 + GAP, FLOOR2 - 0.2, 9], max: [7 - GAP, FLOOR2, 12], mat: 'woodPanel', face: 'y+', shadow: true },
    { min: [-7 + GAP, FLOOR2, 8.95], max: [-1.3, FLOOR2 + 0.9, 9.05], mat: 'rail', face: 'z-', shadow: true },
    { min: [1.3, FLOOR2, 8.95], max: [7 - GAP, FLOOR2 + 0.9, 9.05], mat: 'rail', face: 'z-', shadow: true }
  ];
  // 大階段の横の板。坂の高さに手すりの 0.9m を足した段々にし、横から入れず下にももぐれなくする
  const parts = 10;
  const len = (STAIR.max[2] - STAIR.min[2]) / parts;
  for (let k = 0; k < parts; k++) {
    const z0 = STAIR.min[2] + k * len;
    const top = (FLOOR2 * (k + 1)) / parts + 0.9;
    s.push({ min: [-1.4, 0, z0], max: [-1.25, top, z0 + len], mat: 'rail', face: 'x-', shadow: true });
    s.push({ min: [1.25, 0, z0], max: [1.4, top, z0 + len], mat: 'rail', face: 'x+', shadow: true });
  }
  return s;
}

/** 北の壁にキッチンへ、南の壁にランドリーへの戸口。壁は腰板とダマスクの 2 段で、裏はとなりの部屋の壁 */
function corridor(): Slab[] {
  const x0 = -23;
  const x1 = -7;
  const wall = (z0: number, face: Face, back: Mat, door: [number, number]): Slab[] => [
    ...[
      [x0, door[0]],
      [door[1], x1]
    ].flatMap(([a, b]): Slab[] => [
      { min: [a, 0, z0], max: [b, 1, z0 + T], mat: 'wainscot', face, back },
      { min: [a, 1, z0], max: [b, CORR_H, z0 + T], mat: 'greenDamask', face, back }
    ]),
    { min: [door[0], 2.4, z0], max: [door[1], CORR_H, z0 + T], mat: 'greenDamask', face, back }
  ];
  return [
    { min: [x0, -1, 3.25], max: [x1, 0, 6.75], mat: 'checker', face: 'y+' },
    { min: [x0, CORR_H, 3.25], max: [x1, CORR_H + T, 6.75], mat: 'cream', face: 'y-' },
    ...wall(6.75, 'z-', 'whiteTile', [-16.75, -15.25]),
    ...wall(3.25 - T, 'z+', 'brick', [-15.75, -14.25]),
    { min: [x0 - T, 0, 3.25], max: [x0, 1, 6.75], mat: 'wainscot', face: 'x+' },
    { min: [x0 - T, 1, 3.25], max: [x0, CORR_H, 6.75], mat: 'greenDamask', face: 'x+' }
  ];
}

/** 屋敷から 28m 離し、壁で屋敷が見えないようにした 4m 四方の小部屋。出口は無い */
export const ROOM = { min: [-2, 0, -32] as V3, max: [2, 3, -28] as V3 };

function room(): Slab[] {
  const [x0, , z0] = ROOM.min;
  const [x1, h, z1] = ROOM.max;
  return [
    { min: [x0, -1, z0], max: [x1, 0, z1], mat: 'woodPanel', face: 'y+' },
    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'white', face: 'y-' },
    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'white', face: 'z+' },
    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'white', face: 'z-' },
    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'white', face: 'x+' },
    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'white', face: 'x-' }
  ];
}

/** 屋敷に扉の形は無いので、探索のハンターは大広間の南の壁の前から北を向いて入る */
export const SPAWNS: Record<'hall' | 'room' | 'entrance' | 'lobby', Record<Seat, V3>> = {
  hall: { 1: [0, 0, 1.5], 2: [-1, 0, 1.5], 3: [1, 0, 1.5] },
  room: { 1: [0, 0, -30.8], 2: [-0.9, 0, -29.3], 3: [0.9, 0, -29.3] },
  entrance: { 1: [0, 0, 0.6], 2: [-0.8, 0, 0.6], 3: [0.8, 0, 0.6] },
  lobby: LOBBY_SPAWNS
};

const p = (kind: Kind, at: V3, turn: Piece['turn'] = 0, span?: number): Piece => ({ kind, at, turn, span });

function pieces(): Piece[] {
  return [
    p('stairs', [0, 0, 3.5]),
    p('rug', [4, 0, 3]),
    p('piano', [4, 0, 3], 1),
    p('column', [-5, 0, 8.75]),
    p('column', [-2.2, 0, 8.75]),
    p('column', [2.2, 0, 8.75]),
    p('column', [5, 0, 8.75]),
    p('ribbons', [-3.6, 0, 8.9]),
    p('ribbons', [3.6, 0, 8.9]),
    p('balloons', [-6, FLOOR2, 11.2]),
    p('chandelier', [-4, 5.6, 5]),
    p('chandelier', [0, 5.6, 6]),
    p('chandelier', [4, 5.6, 5]),
    // 三角旗は部屋や廊下を横切って張る（縦に張ると、正面から旗が隠れてひもだけが線に見える）
    p('bunting', [0, 5, 4], 0, 14),
    p('bunting', [0, 5.4, 7.5], 0, 14),
    p('horse', [5.2, FLOOR2, 11], 2),
    p('banner', [-3, FLOOR2 + 1.1, 11.95], 2),
    p('banner', [3, FLOOR2 + 1.1, 11.95], 2),
    p('sconce', [-10, 2, 6.75], 2),
    p('sconce', [-14.5, 2, 6.75], 2),
    p('sconce', [-20, 2, 6.75], 2),
    p('sconce', [-12.5, 2, 3.25]),
    p('sconce', [-17.5, 2, 3.25]),
    p('vase', [-8.2, 0, 6.3]),
    p('poster', [-11, 1.6, 6.75], 2),
    p('painting', [-19, 1.7, 6.75], 2),
    p('bookshelf', [-22.75, 0, 5], 1),
    p('bunting', [-10, 3, 5], 1, 3.5),
    p('bunting', [-14, 3, 5], 1, 3.5),
    p('bunting', [-18, 3, 5], 1, 3.5)
  ];
}

/** seed が null なら既定の置き方（ロビーとひとりで試す）。試合では親が配った種で、どの端末も同じ置き方になる */
export function mansion(seed: number | null = null): Mansion {
  const moving = propPieces(seed);
  const all = [...pieces(), ...roomPieces(), ...lobbyPieces(), ...moving];
  return {
    slabs: [...hall(), ...corridor(), ...room(), ...roomSlabs(), ...lobbySlabs()],
    pieces: all,
    ramps: [STAIR],
    spawn: [0, 0, 1.5],
    solids: podiumBoxes(),
    moving: moving.length,
    arts: artOf(seed, all.filter((q) => q.kind === 'painting').length),
    lights: [
      { at: [0, 2.6, -30], color: '#fff4e0', power: 6, reach: 8 },
      ...all.filter((q) => q.kind === 'chandelier').map((q) => ({ at: q.at, color: '#ffd9a0', power: 14, reach: 14 })),
      ...all
        .filter((q) => q.kind === 'sconce')
        .map((q) => ({
          at: [q.at[0], q.at[1] + 0.2, q.at[2] + (q.turn === 2 ? -0.3 : 0.3)] as V3,
          color: '#ffcf8a',
          power: 3,
          reach: 7
        })),
      ...roomLights(),
      ...lobbyLights()
    ]
  };
}

export function levelOf(m: Mansion): Level {
  const boxes: Box[] = m.slabs.map((s) => ({ min: s.min, max: s.max }));
  // カメラは家具や手すりを通り抜ける（家具が人形を隠し、透かし窓で見えるように）。殻は部屋の床・天井・壁だけ
  const shell: Box[] = m.slabs.filter((s) => s.mat !== 'rail').map((s) => ({ min: s.min, max: s.max }));
  for (const q of m.pieces) {
    const size = SIZES[q.kind];
    if (!size) continue;
    const [w, h, d] = q.turn % 2 ? [size[2], size[1], size[0]] : size;
    boxes.push({
      min: [q.at[0] - w / 2, q.at[1], q.at[2] - d / 2],
      max: [q.at[0] + w / 2, q.at[1] + h, q.at[2] + d / 2]
    });
  }
  boxes.push(...m.solids);
  return { boxes, shell, ramps: m.ramps, spawn: m.spawn };
}

/** 答え合わせの「見落とされた場所」に出す部屋の名前。上から順に調べる（回廊は大広間の中の 2 階） */
export const PLACES: { name: string; min: V3; max: V3 }[] = [
  { name: '2階の回廊', min: [-7, 3, 9], max: [7, 7, 12] },
  { name: '大広間', min: [-7, -1, 0], max: [7, 7, 12] },
  { name: '緑の廊下', min: [-23, -1, 3.25], max: [-7, 4, 6.75] },
  { name: '書斎', min: [7, -1, 1], max: [17.3, 4.3, 11] },
  { name: 'キッチン', min: [-21, -1, 6.75], max: [-11, 3.8, 15.05] },
  { name: 'ランドリー', min: [-20, -1, -5.05], max: [-10, 3.8, 3.25] },
  { name: '控室', min: [ROOM.min[0], -1, ROOM.min[2]], max: [ROOM.max[0], ROOM.max[1] + 0.3, ROOM.max[2]] },
  { name: 'ロビー', min: [LOBBY.min[0], -1, LOBBY.min[2]], max: [LOBBY.max[0], LOBBY.max[1] + 0.3, LOBBY.max[2]] }
];

export function placeOf(at: V3): string {
  const hit = PLACES.find(({ min, max }) => at.every((v, i) => v >= min[i] && v <= max[i]));
  return hit?.name ?? '屋敷';
}
