import { describe, expect, it } from 'vitest';
import { dab, FLOW, PaintLog, spacing, Stroke, UNDO, type Brush, type Hit } from './paint';

const brush: Brush = { radius: 0.02, color: [1, 0, 0], opacity: 0.8, metal: 0, rough: 0.85 };
const at = (x: number): Hit => ({ p: [x, 1, 0], n: [0, 0, 1] });

describe('Stroke', () => {
  it('最初の点に 1 つ置き、そのあとは間隔ごとに置く', () => {
    const s = new Stroke(brush);
    const out = [...s.to(at(0)), ...s.to(at(0.1))];
    expect(out).toHaveLength(Math.floor(0.1 / spacing(0.02)) + 1);
    expect(out[1].p[0]).toBeCloseTo(spacing(0.02), 6);
  });

  it('細かく分けてなぞっても、一度になぞったのと同じ場所に置く', () => {
    const a = new Stroke(brush);
    const one = [...a.to(at(0)), ...a.to(at(0.1))].map((d) => d.p[0]);
    const b = new Stroke(brush);
    const many = [...b.to(at(0))];
    for (let i = 1; i <= 50; i++) many.push(...b.to(at(i * 0.002)));
    expect(many.map((d) => d.p[0])).toHaveLength(one.length);
    many.forEach((d, i) => expect(d.p[0]).toBeCloseTo(one[i], 6));
  });

  it('遠くへ飛んだら、あいだを埋めずにそこへ 1 つ置く', () => {
    const s = new Stroke(brush);
    s.to(at(0));
    const out = s.to(at(0.5));
    expect(out).toHaveLength(1);
    expect(out[0].p[0]).toBeCloseTo(0.5);
  });

  it('1 回の濃さは不透明度の FLOW 倍で、色と艶は筆のまま', () => {
    const d = dab(at(0), brush);
    expect(d.a).toBeCloseTo(0.8 * FLOW);
    expect(d.c).toEqual([1, 0, 0]);
    expect(d.ro).toBe(0.85);
    expect(d.r).toBe(0.02);
  });
});

describe('PaintLog', () => {
  const stroke = (log: PaintLog, n: number) => {
    log.begin();
    log.add(Array.from({ length: n }, () => dab(at(0), brush)));
  };

  it('もどすで最後のひと筆の前に戻る', () => {
    const log = new PaintLog();
    stroke(log, 3);
    stroke(log, 5);
    expect(log.undo()).toBe(true);
    expect(log.dabs).toHaveLength(3);
    expect(log.undo()).toBe(true);
    expect(log.dabs).toHaveLength(0);
    expect(log.undo()).toBe(false);
  });

  it('もどせるのは新しい 30 本まで', () => {
    const log = new PaintLog();
    for (let i = 0; i < UNDO + 5; i++) stroke(log, 1);
    let n = 0;
    while (log.undo()) n++;
    expect(n).toBe(UNDO);
    expect(log.dabs).toHaveLength(5);
  });

  it('描きかけの取り消しは、もどせる本数を減らさない', () => {
    const log = new PaintLog();
    for (let i = 0; i < UNDO; i++) stroke(log, 1);
    stroke(log, 4);
    expect(log.cancel()).toBe(true);
    expect(log.dabs).toHaveLength(UNDO);
    let n = 0;
    while (log.undo()) n++;
    expect(n).toBe(UNDO);
  });

  it('消すと何も残らない', () => {
    const log = new PaintLog();
    stroke(log, 2);
    log.clear();
    expect(log.dabs).toHaveLength(0);
    expect(log.canUndo).toBe(false);
  });
});
