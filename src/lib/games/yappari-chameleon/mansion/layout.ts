import type { V3 } from '$lib/sculpt';
import type { Box, Level, Ramp } from '../move';

export type Mat = 'woodPanel' | 'marble' | 'coffer' | 'checker' | 'greenDamask' | 'wainscot' | 'cream' | 'rail';
export type Face = 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';

export interface Slab {
  min: V3;
  max: V3;
  mat: Mat;
  face: Face;
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
  | 'stairs';

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
  stairs: null
};

export interface Mansion {
  slabs: Slab[];
  pieces: Piece[];
  ramps: Ramp[];
  spawn: V3;
  lights: { at: V3; color: string; power: number; reach: number }[];
}

const HALL_H = 7;
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
    { min: [7, 0, 0], max: [7 + T, HALL_H, 12], mat: 'woodPanel', face: 'x-' },
    { min: [-7 - T, 0, 0], max: [-7, HALL_H, 4.25], mat: 'woodPanel', face: 'x+' },
    { min: [-7 - T, 0, 5.75], max: [-7, HALL_H, 12], mat: 'woodPanel', face: 'x+' },
    { min: [-7 - T, 2.4, 4.25], max: [-7, HALL_H, 5.75], mat: 'woodPanel', face: 'x+' },
    // 2 階の回廊の床。下に影を落とす
    { min: [-7, FLOOR2 - 0.2, 9], max: [7, FLOOR2, 12], mat: 'woodPanel', face: 'y+', shadow: true },
    { min: [-7, FLOOR2, 8.95], max: [-1.3, FLOOR2 + 0.9, 9.05], mat: 'rail', face: 'z-', shadow: true },
    { min: [1.3, FLOOR2, 8.95], max: [7, FLOOR2 + 0.9, 9.05], mat: 'rail', face: 'z-', shadow: true }
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

function corridor(): Slab[] {
  const x0 = -23;
  const x1 = -7;
  return [
    { min: [x0, -1, 3.25], max: [x1, 0, 6.75], mat: 'checker', face: 'y+' },
    { min: [x0, CORR_H, 3.25], max: [x1, CORR_H + T, 6.75], mat: 'cream', face: 'y-' },
    { min: [x0, 0, 6.75], max: [x1, 1, 6.75 + T], mat: 'wainscot', face: 'z-' },
    { min: [x0, 1, 6.75], max: [x1, CORR_H, 6.75 + T], mat: 'greenDamask', face: 'z-' },
    { min: [x0, 0, 3.25 - T], max: [x1, 1, 3.25], mat: 'wainscot', face: 'z+' },
    { min: [x0, 1, 3.25 - T], max: [x1, CORR_H, 3.25], mat: 'greenDamask', face: 'z+' },
    { min: [x0 - T, 0, 3.25], max: [x0, 1, 6.75], mat: 'wainscot', face: 'x+' },
    { min: [x0 - T, 1, 3.25], max: [x0, CORR_H, 6.75], mat: 'greenDamask', face: 'x+' }
  ];
}

const p = (kind: Kind, at: V3, turn: Piece['turn'] = 0, span?: number): Piece => ({ kind, at, turn, span });

function pieces(): Piece[] {
  return [
    p('stairs', [0, 0, 3.5]),
    p('rug', [4, 0, 3]),
    p('piano', [4, 0, 3], 1),
    p('table-white', [-4, 0, 2.5]),
    p('chair', [-4, 0, 1.6]),
    p('chair', [-4, 0, 3.4], 2),
    p('chair', [-4.9, 0, 2.5], 1),
    p('chair', [-3.1, 0, 2.5], 3),
    p('table-red', [-4.5, 0, 7]),
    p('chair', [-4.5, 0, 6.1]),
    p('chair', [-4.5, 0, 7.9], 2),
    p('column', [-5, 0, 8.75]),
    p('column', [-2.2, 0, 8.75]),
    p('column', [2.2, 0, 8.75]),
    p('column', [5, 0, 8.75]),
    p('ribbons', [-3.6, 0, 8.9]),
    p('ribbons', [3.6, 0, 8.9]),
    p('balloons', [-6.2, 0, 0.8]),
    p('balloons', [6.2, 0, 11.2]),
    p('balloons', [-6, FLOOR2, 11.2]),
    p('balloon', [1.8, 0, 1.2]),
    p('balloon', [2.4, 0, 1.5]),
    p('balloon', [-1.5, 0, 10.5]),
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
    p('sconce', [-15, 2, 6.75], 2),
    p('sconce', [-20, 2, 6.75], 2),
    p('sconce', [-12.5, 2, 3.25]),
    p('sconce', [-17.5, 2, 3.25]),
    p('vase', [-8.2, 0, 6.3]),
    p('poster', [-11, 1.6, 6.75], 2),
    p('sofa', [-14, 0, 6.25], 2),
    p('painting', [-17.5, 1.7, 6.75], 2),
    p('bench', [-20, 0, 3.5]),
    p('balloon', [-12, 0, 4]),
    p('balloon', [-12.5, 0, 4.3]),
    p('balloon', [-18, 0, 5.8]),
    p('bookshelf', [-22.75, 0, 5], 1),
    p('bunting', [-10, 3, 5], 1, 3.5),
    p('bunting', [-14, 3, 5], 1, 3.5),
    p('bunting', [-18, 3, 5], 1, 3.5)
  ];
}

export function mansion(): Mansion {
  const all = pieces();
  return {
    slabs: [...hall(), ...corridor()],
    pieces: all,
    ramps: [STAIR],
    spawn: [0, 0, 1.5],
    lights: [
      ...all.filter((q) => q.kind === 'chandelier').map((q) => ({ at: q.at, color: '#ffd9a0', power: 14, reach: 14 })),
      ...all
        .filter((q) => q.kind === 'sconce')
        .map((q) => ({
          at: [q.at[0], q.at[1] + 0.2, q.at[2] + (q.turn === 2 ? -0.3 : 0.3)] as V3,
          color: '#ffcf8a',
          power: 3,
          reach: 7
        }))
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
  return { boxes, shell, ramps: m.ramps, spawn: m.spawn };
}
