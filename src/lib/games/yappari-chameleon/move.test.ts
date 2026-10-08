import { describe, expect, it } from 'vitest';
import { floorBelow, idle, newBody, rayDistance, RADIUS, step, type Input, type Level } from './move';
import type { V3 } from '$lib/sculpt';
import { HEIGHT } from './doll';

// 床（y = 0）・奥の壁（z = 5）・天井（y = 3）・低い台（高さ 1）・段（高さ 0.2）・坂（z が増えると 0 → 1.5）
const level: Level = {
  boxes: [
    { min: [-10, -1, -10], max: [10, 0, 10] },
    { min: [-10, 0, 5], max: [10, 3, 5.3] },
    { min: [-10, 3, -10], max: [10, 3.3, 10] },
    { min: [3, 0, -3], max: [5, 1, -1] },
    { min: [-3, 0, -3], max: [-2, 0.2, -2] }
  ],
  ramps: [{ min: [-8, 0, -6], max: [-6, 1.5, -2], rise: 'z+' }],
  spawn: [0, 0, 0]
};

const go = (b: ReturnType<typeof newBody>, inp: Partial<Input>, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) step(b, { ...idle(), ...inp }, level, 1 / 60);
};

describe('move', () => {
  it('床に立つ', () => {
    const b = newBody([0, 0.5, 0]);
    go(b, {}, 1);
    expect(b.pos[1]).toBeCloseTo(0, 3);
    expect(b.ground).toBe(true);
  });

  it('壁に向かって歩くと、壁の手前で半径だけ離れて止まる', () => {
    const b = newBody([0, 0, 3]);
    go(b, { z: 1 }, 3);
    expect(b.pos[2]).toBeCloseTo(5 - RADIUS, 2);
  });

  it('低い段は上れ、高い台は上れない', () => {
    const b = newBody([-2.5, 0, -4]);
    go(b, { z: 1 }, 0.8);
    expect(b.pos[1]).toBeCloseTo(0.2, 2);
    const c = newBody([4, 0, -4.5]);
    go(c, { z: 1 }, 2);
    expect(c.pos[1]).toBeCloseTo(0, 2);
    expect(c.pos[2]).toBeCloseTo(-3 - RADIUS, 2);
  });

  it('坂を上ると高くなる', () => {
    const b = newBody([-7, 0, -6.5]);
    go(b, { z: 1 }, 2);
    expect(b.pos[1]).toBeGreaterThan(1.2);
  });

  it('跳んで、また床に降りる', () => {
    const b = newBody([0, 0, 0]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    go(b, {}, 0.15);
    expect(b.pos[1]).toBeGreaterThan(0.3);
    go(b, {}, 1.5);
    expect(b.pos[1]).toBeCloseTo(0, 3);
  });

  it('壁際で跳ぶと壁に張り付き、壁のほうを向く', () => {
    const b = newBody([0, 0, 5 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    expect(b.cling).toEqual({ kind: 'wall', nx: 0, nz: -1 });
    expect(Math.sin(b.yaw)).toBeCloseTo(0, 3);
    expect(Math.cos(b.yaw)).toBeCloseTo(1, 3);
  });

  it('張り付いたまま何もしなければ落ちず、上がり続けると天井に張り付く', () => {
    const b = newBody([0, 0, 5 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    go(b, {}, 2);
    expect(b.cling?.kind).toBe('wall');
    expect(b.ground).toBe(false);
    go(b, { up: true }, 0.5);
    const y = b.pos[1];
    go(b, {}, 1);
    expect(b.pos[1]).toBeCloseTo(y, 5);
    go(b, { up: true }, 4);
    expect(b.cling).toEqual({ kind: 'ceiling' });
    expect(b.pos[1]).toBeCloseTo(3, 3);
  });

  it('壁から天井へ移ると体を返し、頭が壁の中へ入らない', () => {
    const b = newBody([0, 0, 5 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    go(b, { up: true }, 4);
    expect(b.cling).toEqual({ kind: 'ceiling' });
    expect(Math.cos(b.yaw)).toBeCloseTo(-1, 5);
    expect(b.pos[2] + Math.cos(b.yaw) * HEIGHT).toBeLessThan(5 - 0.3);
  });

  it('天井から「はなす」で床へ落ちる', () => {
    const b = newBody([0, 0, 5 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    go(b, { up: true }, 4);
    step(b, { ...idle(), release: true }, level, 1 / 60);
    expect(b.cling).toBe(null);
    go(b, {}, 2);
    expect(b.pos[1]).toBeCloseTo(0, 3);
  });

  it('低い台の側面に張り付いて上がり切ると、台の上に立つ', () => {
    const b = newBody([4, 0, -3 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    expect(b.cling?.kind).toBe('wall');
    go(b, { up: true }, 2);
    go(b, {}, 0.5);
    expect(b.cling).toBe(null);
    expect(b.pos[1]).toBeCloseTo(1, 2);
  });

  it('張り付いたまま「さがる」で床まで下りると、張り付きが外れる', () => {
    const b = newBody([0, 0, 5 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    go(b, { up: true }, 0.5);
    go(b, { down: true }, 1.5);
    expect(b.cling).toBe(null);
    expect(b.pos[1]).toBeCloseTo(0, 3);
  });

  it('向きロックのあいだは横へ歩いても向きが変わらず、回るボタンで向きだけ変わる', () => {
    const b = newBody([0, 0, 0]);
    go(b, { lock: true, x: 1 }, 1);
    expect(b.yaw).toBeCloseTo(0, 5);
    expect(b.pos[0]).toBeGreaterThan(1);
    go(b, { lock: true, turn: 1 }, 0.5);
    expect(b.yaw).toBeGreaterThan(0.5);
  });

  it('その場で回転は、回転ロックしていなくても効く', () => {
    const b = newBody([0, 0, 0]);
    go(b, { turn: 1 }, 0.5);
    expect(b.yaw).toBeGreaterThan(0.5);
  });

  it('ロックしていなければ、歩く向きへ体が向く', () => {
    const b = newBody([0, 0, 0]);
    go(b, { x: 1 }, 1);
    expect(Math.sin(b.yaw)).toBeCloseTo(1, 2);
  });

  it('カメラの線は壁で止まる', () => {
    expect(rayDistance(level, [0, 1, 0], [0, 0, 1], 10)).toBeCloseTo(5, 5);
    expect(rayDistance(level, [0, 1, 0], [1, 0, 0], 2)).toBe(2);
  });

  it('カメラの線は殻だけに当たり、柱の箱は通り抜ける', () => {
    const pillar = { min: [-0.3, 0, 1] as V3, max: [0.3, 3, 1.6] as V3 };
    const lv = { ...level, boxes: [...level.boxes, pillar], shell: level.boxes };
    expect(rayDistance({ ...level, boxes: lv.boxes }, [0, 1, 0], [0, 0, 1], 10)).toBeCloseTo(1, 5);
    expect(rayDistance(lv, [0, 1, 0], [0, 0, 1], 10)).toBeCloseTo(5, 5);
  });

  it('外へ落ちたら始めの場所へ戻る', () => {
    const b = newBody([0, -20, 0]);
    go(b, {}, 0.1);
    expect(b.pos).toEqual([0, 0, 0]);
  });

  it('壁に張り付いて横へ移動するときに垂直な壁に当たると止まる', () => {
    const levelWithPerp: Level = {
      boxes: [
        { min: [-10, -1, -10], max: [10, 0, 10] },
        { min: [-10, 0, 5], max: [10, 3, 5.3] },
        { min: [-10, 3, -10], max: [10, 3.3, 10] },
        { min: [3, 0, 4], max: [3.3, 3, 5] }
      ],
      ramps: [{ min: [-8, 0, -6], max: [-6, 1.5, -2], rise: 'z+' }],
      spawn: [0, 0, 0]
    };
    const goPerp = (b: ReturnType<typeof newBody>, inp: Partial<Input>, secs: number) => {
      for (let t = 0; t < secs; t += 1 / 60) step(b, { ...idle(), ...inp }, levelWithPerp, 1 / 60);
    };
    const b = newBody([2, 0, 5 - RADIUS - 0.05]);
    goPerp(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, levelWithPerp, 1 / 60);
    expect(b.cling?.kind).toBe('wall');
    goPerp(b, { x: 1 }, 3);
    expect(b.pos[0]).toBeLessThanOrEqual(3 - RADIUS + 0.01);
    expect(b.cling).toEqual({ kind: 'wall', nx: 0, nz: -1 });
  });

  it('天井の下を横へ移動するときに垂直な壁に当たると止まる', () => {
    const levelWithPerp: Level = {
      boxes: [
        { min: [-10, -1, -10], max: [10, 0, 10] },
        { min: [-10, 0, 5], max: [10, 3, 5.3] },
        { min: [-10, 3, -10], max: [10, 3.3, 10] },
        { min: [3, 0, 4], max: [3.3, 3, 5] }
      ],
      ramps: [{ min: [-8, 0, -6], max: [-6, 1.5, -2], rise: 'z+' }],
      spawn: [0, 0, 0]
    };
    const goPerp = (b: ReturnType<typeof newBody>, inp: Partial<Input>, secs: number) => {
      for (let t = 0; t < secs; t += 1 / 60) step(b, { ...idle(), ...inp }, levelWithPerp, 1 / 60);
    };
    const b = newBody([2, 0, 5 - RADIUS - 0.05]);
    goPerp(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, levelWithPerp, 1 / 60);
    goPerp(b, { up: true }, 4);
    expect(b.cling).toEqual({ kind: 'ceiling' });
    goPerp(b, { x: 1 }, 3);
    expect(b.pos[0]).toBeLessThanOrEqual(3 - RADIUS + 0.01);
    expect(b.cling).toEqual({ kind: 'ceiling' });
  });

  it('floorBelow は真下の床の高さを返し、天井や高い所からは床へ下ろす', () => {
    expect(floorBelow(level, 0, 0, 2.9)).toBe(0);
    expect(floorBelow(level, 4, -2, 2.9)).toBe(1);
    expect(floorBelow(level, 4, -2, 0.5)).toBe(0);
    expect(floorBelow(level, 99, 99, 2)).toBe(2);
  });
});
