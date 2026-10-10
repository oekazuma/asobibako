import type { V3 } from '$lib/sculpt';
import type { SurfacePoint } from './senses';
import type { Spot } from './spots';

/**
 * 大広間の床の点。入口の 3 席と大広間の見回す点から、大階段の横板（最初の段で高さ 1.25m）の手前を通って見え、
 * どの種の置き方でも動く物が間に入らない（hunter.test の「的の点は」のテストが見る）
 */
export const OPEN: V3 = [3.5, 0, 5.2];

/** spot の体のまわりの、背 h・半径 r の筒の点 */
export function tube(spot: Pick<Spot, 'pos'>, n = 3000, r = 0.15, h = 1.15): SurfacePoint[] {
  return Array.from({ length: n }, (_, i) => {
    const a = i * 2.39996;
    const rest: V3 = [r * Math.cos(a), (i / n) * h, r * Math.sin(a)];
    return {
      rest,
      normal: [Math.cos(a), 0, Math.sin(a)],
      up: 0,
      world: [spot.pos[0] + rest[0], spot.pos[1] + rest[1], spot.pos[2] + rest[2]]
    };
  });
}
