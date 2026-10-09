import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { embedded } from './embed';
import type { Cling, Level } from './move';
import { AIM, poseById, POSES, STAND } from './poses';
import { capsules, placement } from './shots';

// 床（y = 0）・奥の壁（z = 5〜5.3）・天井（y = 3）・ソファくらいの箱
const level: Level = {
  boxes: [
    { min: [-10, -1, -10], max: [10, 0, 10] },
    { min: [-10, 0, 5], max: [10, 3, 5.3] },
    { min: [-10, 3, -10], max: [10, 3.3, 10] },
    { min: [-6, 0, -0.45], max: [-4, 0.85, 0.45] }
  ],
  ramps: [],
  spawn: [0, 0, 0]
};
const ALL = [STAND, AIM, ...POSES];
const wall: Cling = { kind: 'wall', nx: 0, nz: -1 };
const ceiling: Cling = { kind: 'ceiling' };
const at = (pos: V3, pose: string, yaw = 0, cling: Cling | null = null) => ({ pos, yaw, cling, pose });

describe('埋まりすぎ', () => {
  it('部屋のまん中では、どのポーズでも埋まらない', () => {
    for (const p of ALL) expect(embedded(level, at([0, 0, 0], p.id)), p.id).toBe(false);
  });

  it('床で壁に向いて立つだけなら埋まらず、寝そべる・丸まるで胴や頭が壁に入ると埋まる', () => {
    expect(embedded(level, at([0, 0, 4.8], 'stand'))).toBe(false);
    expect(embedded(level, at([0, 0, 4.8], 'lie'))).toBe(true);
    expect(embedded(level, at([0, 0, 4.8], 'curl'))).toBe(true);
  });

  it('家具の中に立てば埋まる', () => {
    expect(embedded(level, at([-5, 0, 0], 'stand'))).toBe(true);
  });

  it('壁や天井に張り付いた体は、どのポーズでも埋まらない（壁で丸まる・前屈・寝そべる、天井で反る・ブリッジ・丸まるも）', () => {
    for (const p of ALL) {
      expect(embedded(level, at([0, 0.8, 4.8], p.id, 0, wall)), `壁 ${p.id}`).toBe(false);
      expect(embedded(level, at([0, 3, 0], p.id, 1.2, ceiling)), `天井 ${p.id}`).toBe(false);
    }
  });

  it('張り付いたまま壁の中へ押し込まれ、胴の軸の真ん中が面から 0.15m 奥へ入ると埋まる', () => {
    const mids = (z: number) =>
      capsules(poseById('stand'), placement({ pos: [0, 0.8, z], yaw: 0, cling: wall, pose: 'stand' }))
        .slice(1, 4)
        .map((c) => (c.a[2] + c.b[2]) / 2);
    // 正しく張り付いた体の胴の真ん中から、面（z = 5）の 0.15m 奥まで押し込む
    const pushed = 4.8 + (5.15 - Math.max(...mids(4.8)));
    expect(Math.max(...mids(pushed))).toBeCloseTo(5.15, 6);
    expect(embedded(level, at([0, 0.8, pushed], 'stand', 0, wall))).toBe(true);
    expect(embedded(level, at([0, 0.8, pushed - 0.1], 'stand', 0, wall))).toBe(false);
  });
});
