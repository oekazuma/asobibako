import { describe, expect, it } from 'vitest';
import { BASE_SPEED, course, LEVELS, ROW_GAP, rule, RUNUP } from './course';

const levels = Array.from({ length: LEVELS }, (_, i) => i + 1);

describe('course', () => {
  it('どの列にも通れるレーンが残る', () => {
    for (const level of levels) {
      const rows = new Map<number, number>();
      for (const b of course(level).blocks) rows.set(b.z, (rows.get(b.z) ?? 0) + 1);
      for (const n of rows.values()) expect(n).toBeLessThanOrEqual(2);
    }
  });

  it('列どうしは ROW_GAP 以上あく', () => {
    for (const level of levels) {
      const zs = [...new Set(course(level).blocks.map((b) => b.z))].sort((a, b) => a - b);
      for (let i = 1; i < zs.length; i++) expect(zs[i] - zs[i - 1]).toBeGreaterThanOrEqual(ROW_GAP);
    }
  });

  it('1〜2 面は低いバリケードが 1 レーンずつだけ', () => {
    for (const level of [1, 2]) {
      const blocks = course(level).blocks;
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.every((b) => b.kind === 'low')).toBe(true);
      expect(new Set(blocks.map((b) => b.z)).size).toBe(blocks.length);
    }
  });

  it('あとの面ほど高い障害物が混ざる', () => {
    expect(course(12).blocks.some((b) => b.kind === 'high')).toBe(true);
  });

  it('同じ面は毎回同じ道になる', () => {
    expect(course(7)).toEqual(course(7));
    expect(course(7)).not.toEqual(course(8));
  });

  it('障害物と通行人は助走のあと、道のりの中に置く', () => {
    for (const level of levels) {
      const c = course(level);
      for (const p of [...c.blocks, ...c.walkers]) {
        expect(p.z).toBeGreaterThanOrEqual(RUNUP);
        expect(p.z).toBeLessThanOrEqual(c.length - 10);
        expect([0, 1, 2]).toContain(p.lane);
      }
    }
  });

  it('通行人は同じレーンの障害物から 4 m 以上離す', () => {
    for (const level of levels) {
      const c = course(level);
      for (const w of c.walkers)
        for (const b of c.blocks) if (b.lane === w.lane) expect(Math.abs(b.z - w.z)).toBeGreaterThanOrEqual(4);
    }
  });

  it('ボスは 5・10・15 面だけで、あとの面ほど強い', () => {
    expect(levels.filter((n) => rule(n).boss).sort((a, b) => a - b)).toEqual([5, 10, 15]);
    expect(rule(5).boss!.kinds).toEqual(['low']);
    expect(rule(15).boss!.hp).toBeGreaterThan(rule(5).boss!.hp);
  });

  it('制限時間とランクの基準は面ごとに決めてある', () => {
    for (const level of levels) {
      expect(rule(level).time).toBeGreaterThan(20);
      expect(rule(level).best).toBeGreaterThan(0);
    }
    expect(rule(5).time).toBeGreaterThan(rule(4).time);
  });

  it('どの面も、よけるだけの速さ（×1.0）で着ける時間がある', () => {
    for (const level of levels) {
      const r = rule(level);
      expect(r.time).toBeGreaterThanOrEqual((r.length / BASE_SPEED) * 1.05);
    }
  });

  it('範囲外の面の番号は端に丸める', () => {
    expect(rule(0)).toEqual(rule(1));
    expect(rule(99)).toEqual(rule(LEVELS));
  });
});
