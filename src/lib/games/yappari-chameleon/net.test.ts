import { describe, expect, it } from 'vitest';
import { chunks, DAB_LEN, dabMessages, DabOutbox, lerpMe, packDabs, splice, unpackDabs, type Me } from './net';
import { PaintLog, type Dab } from './paint';

const dabAt = (i: number): Dab => ({
  p: [i * 0.0123, 1.23456, -0.5],
  n: [0, 0.6, 0.8],
  r: 0.05,
  c: [0.25, (i % 10) / 10, 1],
  a: 0.3,
  m: 0,
  ro: 0.85
});
const many = (n: number) => Array.from({ length: n }, (_, i) => dabAt(i));

describe('吹き付けの数の列', () => {
  it('詰めて戻すと同じ列になる（位置は 0.1mm、色は 1/1000 まで）', () => {
    const dabs = many(5);
    const back = unpackDabs(packDabs(dabs));
    expect(back).toHaveLength(5);
    back.forEach((d, i) => {
      expect(d.p[0]).toBeCloseTo(dabs[i].p[0], 4);
      expect(d.p[1]).toBeCloseTo(1.2346, 4);
      expect(d.c).toEqual(dabs[i].c);
      expect(d.ro).toBe(0.85);
    });
    expect(packDabs(dabs)).toHaveLength(5 * DAB_LEN);
  });

  it('32KB ごとに分けても、つなげれば元の列に戻り、吹き付けの途中では切らない', () => {
    const flat = packDabs(many(3000));
    const parts = chunks(flat);
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) {
      expect(JSON.stringify({ t: 'dabs', seat: 3, at: 99999, d: p }).length).toBeLessThanOrEqual(32 * 1024);
      expect(p.length % DAB_LEN).toBe(0);
    }
    expect(parts.flat()).toEqual(flat);
  });

  it('分けた知らせは at が続き、順に入れると元の列になる', () => {
    const dabs = many(3000);
    const log: Dab[] = [];
    for (const m of dabMessages(2, 0, packDabs(dabs))) splice(log, m.at as number, unpackDabs(m.d as number[]));
    expect(log).toHaveLength(3000);
    expect(log[2999].c).toEqual(dabs[2999].c);
  });

  it('空の列は 1 つの知らせで、相手の列を at の長さまで縮める', () => {
    expect(dabMessages(2, 0, [])).toEqual([{ t: 'dabs', seat: 2, at: 0, d: [] }]);
  });
});

describe('splice', () => {
  it('足すだけなら append、縮めたら rebuild、先へ飛んだ知らせは捨てる', () => {
    const log = [1, 2, 3];
    expect(splice(log, 3, [4])).toBe('append');
    expect(splice(log, 2, [9])).toBe('rebuild');
    expect(log).toEqual([1, 2, 9]);
    expect(splice(log, 5, [7])).toBeNull();
    expect(log).toEqual([1, 2, 9]);
  });
});

describe('DabOutbox', () => {
  it('増えた分だけを送り、もどすで縮んだら縮んだ所から送り直す', () => {
    const log = new PaintLog();
    const out = new DabOutbox();
    log.begin();
    log.add(many(3));
    expect(out.take(log)).toMatchObject({ at: 0 });
    expect(out.take(log)).toBeNull();
    log.begin();
    log.add(many(2));
    expect(out.take(log)?.at).toBe(3);
    // もどしてすぐ同じ長さまで塗り足しても、縮んだことは伝わる
    log.undo();
    log.begin();
    log.add(many(2));
    const sent = out.take(log)!;
    expect(sent.at).toBe(3);
    expect(sent.d).toHaveLength(2 * DAB_LEN);
    log.clear();
    expect(out.take(log)).toEqual({ at: 0, d: [] });
  });

  it('親から受け取った列は送り直さない', () => {
    const log = new PaintLog();
    const out = new DabOutbox();
    log.dabs = many(4);
    out.adopt(log);
    expect(out.take(log)).toBeNull();
  });
});

describe('lerpMe', () => {
  const me = (x: number, yaw: number, pose: string): Me => ({
    ms: 0,
    pos: [x, 0, 0],
    yaw,
    cling: null,
    pose,
    crouch: false,
    paint: false,
    look: [yaw, 0],
    eye: null
  });

  it('位置と向きはあいだを取り、ポーズは近いほう。向きは近い回り方でつなぐ', () => {
    const m = lerpMe(me(0, 3, 'stand'), me(2, -3, 'lie'), 0.75);
    expect(m.pos[0]).toBeCloseTo(1.5);
    expect(m.pose).toBe('lie');
    expect(Math.abs(Math.atan2(Math.sin(m.yaw), Math.cos(m.yaw)))).toBeGreaterThan(3);
  });
});
