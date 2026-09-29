import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { POSES, type PoseId } from './dance';
import { Rig, SIZE } from './rig';

describe('骨組み', () => {
  it.each(Object.keys(POSES) as PoseId[])('%s で、腕と脚の骨の長さが変わらず、跳ばなければ足が床にある', (id) => {
    const rig = new Rig();
    const p = POSES[id];
    rig.apply(p);
    for (const s of ['L', 'R'] as const) {
      expect(rig.at(`upper${s}`).distanceTo(rig.at(`fore${s}`))).toBeCloseTo(SIZE.upper, 3);
      expect(rig.at(`fore${s}`).distanceTo(rig.at(`hand${s}`))).toBeCloseTo(SIZE.fore, 3);
      expect(rig.at(`thigh${s}`).distanceTo(rig.at(`shin${s}`))).toBeCloseTo(SIZE.thigh, 3);
      expect(rig.at(`shin${s}`).distanceTo(rig.at(`foot${s}`))).toBeCloseTo(SIZE.shin, 3);
      const f = s === 'L' ? p.footL : p.footR;
      if (!p.air && !f.lift) expect(rig.at(`foot${s}`).y).toBeCloseTo(SIZE.ankle, 2);
    }
  });

  it('右手を伸ばすと右手が頭より高く右へ、ハートは両手が胸の前で近づく', () => {
    const rig = new Rig();
    rig.apply(POSES.reachR);
    const hand = rig.at('handR');
    expect(hand.x).toBeGreaterThan(0.3);
    expect(hand.y).toBeGreaterThan(rig.at('head').y);
    rig.apply(POSES.heart);
    const [l, r] = [rig.at('handL'), rig.at('handR')];
    expect(l.distanceTo(r)).toBeLessThan(0.12);
    expect((l.z + r.z) / 2).toBeGreaterThan(0.12);
  });

  it('ひじは体のうしろ・外へ逃げ、胴に食いこまない', () => {
    const rig = new Rig();
    rig.apply(POSES.heart);
    const e = rig.at('foreR');
    expect(e.x).toBeGreaterThan(0.12);
    expect(new Vector3(e.x, 0, e.z).length()).toBeGreaterThan(0.13);
  });
});
