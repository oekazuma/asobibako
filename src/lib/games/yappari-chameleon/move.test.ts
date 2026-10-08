import { describe, expect, it } from 'vitest';
import {
  floorBelow,
  idle,
  newBody,
  cameraReach,
  easeDist,
  settleDist,
  rayDistance,
  RADIUS,
  step,
  thickRayDistance,
  type Input,
  type Level
} from './move';
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

  it('太い線は、中心の線が外れる壁のかどにも当たる', () => {
    // 中心の線は x = 0.1 を通って 1 の先の柱（x 0.2〜1）をかすめて外れるが、半径 0.2 の線は掛かる
    const lv: Level = { boxes: [], shell: [{ min: [0.2, 0, 3], max: [1, 3, 4] }], ramps: [], spawn: [0, 0, 0] };
    expect(rayDistance(lv, [0.1, 1, 0], [0, 0, 1], 10)).toBe(10);
    expect(thickRayDistance(lv, [0.1, 1, 0], [0, 0, 1], 10, 0.2)).toBeCloseTo(3, 5);
  });

  it('太い線は、斜めに見下ろす向きでも上下左右に広がる', () => {
    const lv: Level = { boxes: [], shell: [{ min: [-5, -1, -5], max: [5, 0, 5] }], ramps: [], spawn: [0, 0, 0] };
    const d: V3 = [0, -Math.sin(0.3), -Math.cos(0.3)];
    // 向きに直角な下の端が先に床へ当たる
    expect(thickRayDistance(lv, [0, 1, 0], d, 10, 0.2)).toBeLessThan(rayDistance(lv, [0, 1, 0], d, 10));
  });

  it('太い線の縁の線は、始点が箱の中にあるとき無かったことにする（壁に張り付いた体のすぐ横）', () => {
    // 始点は壁の面から 0.12。壁へ 0.2 ずれた縁の線は壁の中から始まるが、0 にはしない
    const lv: Level = { boxes: [], shell: [{ min: [-5, 0, 12], max: [5, 3, 12.3] }], ramps: [], spawn: [0, 0, 0] };
    expect(thickRayDistance(lv, [0, 1, 11.88], [1, 0, 0], 3, 0.2)).toBe(3);
    expect(thickRayDistance(lv, [0, 1, 11.88], [0, 0, -1], 3, 0.2)).toBe(3);
  });

  it('真上や真下を向く線でも太さを持つ', () => {
    const lv: Level = { boxes: [], shell: [{ min: [0.1, 3, -1], max: [1, 4, 1] }], ramps: [], spawn: [0, 0, 0] };
    expect(thickRayDistance(lv, [0, 0, 0], [0, 1, 0], 10, 0.2)).toBeCloseTo(3, 5);
  });

  it('距離は縮むときは速く、壁に押さえられなくなってしばらく待ってから、ゆっくり伸びる', () => {
    const s = { dist: 2, wait: 0 };
    easeDist(s, 1, true, 1 / 60);
    expect(s.dist).toBeCloseTo(1.5, 5);
    for (let i = 0; i < 60; i++) easeDist(s, 1, true, 1 / 60);
    expect(s.dist).toBeCloseTo(1, 3);
    // 押さえが外れても待つあいだは伸びない
    for (let i = 0; i < 15; i++) easeDist(s, 2, false, 1 / 60);
    expect(s.dist).toBeCloseTo(1, 3);
    for (let i = 0; i < 60; i++) easeDist(s, 2, false, 1 / 60);
    expect(s.dist).toBeGreaterThan(1.5);
    expect(s.dist).toBeLessThan(2);
  });

  it('壁に押さえられていない距離の変え方（つまみのズーム）は待たずに伸びる', () => {
    const s = { dist: 1, wait: 0 };
    easeDist(s, 2, false, 1 / 60);
    expect(s.dist).toBeGreaterThan(1.05);
  });

  it('縁で当たったり外れたりを 3 周期繰り返しても、距離は戻らず縮んだまま', () => {
    const s = { dist: 2, wait: 0 };
    let up = 0;
    for (let i = 0; i < 60; i++) {
      const before = s.dist;
      const hit = i % 20 < 10;
      easeDist(s, hit ? 1.2 : 2, hit, 1 / 60);
      if (s.dist > before + 1e-6) up++;
    }
    expect(up).toBe(0);
  });

  describe('壁に張り付いた体のそばのカメラ', () => {
    // 部屋（x -5〜5、z 0〜5）の奥の壁は z = 5〜5.3。体の中心は壁の面から 0.12 手前
    const wall: Level = { boxes: [], shell: [{ min: [-5, 0, 5], max: [5, 3, 5.3] }], ramps: [], spawn: [0, 0, 0] };
    const target: V3 = [0, 1, 4.88];
    const inWall = (d: number, dir: V3) => {
      const z = target[2] + dir[2] * d;
      return z > 5 && z < 5.3 && Math.abs(target[0] + dir[0] * d) < 5;
    };

    it('壁へ向けても、0.3 の下限より壁の手前に留まるほうを選ぶ', () => {
      const dir: V3 = [0, 0, 1];
      const r = cameraReach(wall, target, dir, 2.4, [0, 1.4, 4.88], 0.12);
      expect(r.limit).toBeLessThan(0.3);
      const s = { dist: 2.25, wait: 0 };
      // 急に壁へ向いた 1 フレーム目から、壁の中へは入らない
      for (let i = 0; i < 10; i++) {
        const d = settleDist(s, r.limit, r.blocked, 1 / 60);
        expect(inWall(d, dir)).toBe(false);
        expect(d).toBeGreaterThan(0);
      }
    });

    it('向きを変えた直後に目標が 1m 以上縮んでも、その 1 フレームで壁の手前に収まる', () => {
      const s = { dist: 2.25, wait: 0 };
      const free = cameraReach(wall, target, [0, 0, -1], 2.4, [0, 1.4, 4.88], 0.12);
      expect(settleDist(s, free.limit, free.blocked, 1 / 60)).toBeCloseTo(2.25, 3);
      const dir: V3 = [Math.sin(0.5), 0, Math.cos(0.5)];
      const hit = cameraReach(wall, target, dir, 2.4, [0, 1.4, 4.88], 0.12);
      const d = settleDist(s, hit.limit, hit.blocked, 1 / 60);
      expect(d).toBeLessThanOrEqual(Math.max(0.05, hit.limit) + 1e-9);
      expect(inWall(d, dir)).toBe(false);
    });

    it('壁に当たらない向きでは、今までどおり 0.3 の下限と通常の距離', () => {
      const r = cameraReach(wall, target, [0, 0, -1], 2.4, undefined, 0.12);
      expect(r.limit).toBeCloseTo(2.25, 5);
      expect(r.blocked).toBe(false);
    });
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
