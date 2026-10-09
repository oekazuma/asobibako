import type { V3 } from '$lib/sculpt';
import type { Box, Level } from './move';
import type { Me } from './net';
import { poseById } from './poses';
import { capsules, placement } from './shots';

/** 張り付いた体が、張り付いた面からこの深さ以上入ったら埋まっている（m） */
export const CLING_DEPTH = 0.1;

const inside = (p: V3, b: Box) =>
  p[0] > b.min[0] && p[0] < b.max[0] && p[1] > b.min[1] && p[1] < b.max[1] && p[2] > b.min[2] && p[2] < b.max[2];

/** p が箱のふちから、部屋の側の向き n と逆へ入った深さ（n のいちばん大きい軸で測る） */
function depthIn(p: V3, box: Box, n: V3): number {
  const i = [0, 1, 2].reduce((a, k) => (Math.abs(n[k]) > Math.abs(n[a]) ? k : a), 0);
  return n[i] > 0 ? box.max[i] - p[i] : p[i] - box.min[i];
}

/**
 * 頭の中心か、胴の 3 つの円すいの軸の真ん中が、家具まで含めた屋敷の箱の中にあれば埋まっている。
 * 張り付いた体は面に触れているので、張り付いた面から CLING_DEPTH 以上入ったときだけ埋まりにする
 */
export function embedded(lv: Level, b: Pick<Me, 'pos' | 'yaw' | 'cling' | 'pose'>): boolean {
  const c = capsules(poseById(b.pose), placement(b));
  const points: V3[] = [
    c[0].a,
    ...c.slice(1, 4).map((k): V3 => [(k.a[0] + k.b[0]) / 2, (k.a[1] + k.b[1]) / 2, (k.a[2] + k.b[2]) / 2])
  ];
  const cling = b.cling;
  if (!cling) return points.some((p) => lv.boxes.some((box) => inside(p, box)));
  const n: V3 = cling.kind === 'wall' ? [cling.nx, 0, cling.nz] : [0, -1, 0];
  return points.some((p) => lv.boxes.some((box) => inside(p, box) && depthIn(p, box, n) >= CLING_DEPTH));
}
