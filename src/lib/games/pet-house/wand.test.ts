import { describe, expect, it } from 'vitest';
import { createWand, POM, POM_R, stepWand, type Wand } from './wand';

const DT = 1 / 60;
const run = (w: Wand, seconds: number, at: (t: number) => { x: number; y: number; z: number }, t0 = 0) => {
  for (let t = t0; t < t0 + seconds; t += DT) stepWand(w, at(t), DT);
};
const swing = (t: number) => ({ x: Math.sin(t * 7) * 0.5, y: 0, z: Math.cos(t * 5) * 0.3 });

describe('pet-house wand', () => {
  it('振るのを止めると 2 秒ほど揺れて落ち着き、やがて手の真下で止まる', () => {
    const w = createWand({ x: 0, y: 0.3, z: 0 });
    run(w, 3, (t) => ({ ...swing(t), y: 0.3 }));
    const stop = { x: 0.2, y: 0.3, z: 0 };
    run(w, 0.5, () => stop);
    expect(w.speed).toBeGreaterThan(0.15);
    run(w, 2, () => stop);
    expect(w.speed).toBeLessThan(0.15);
    run(w, 8, () => stop);
    expect(w.speed).toBeLessThan(0.005);
    const p = w.nodes[POM];
    expect(Math.hypot(p.x - stop.x, p.z - stop.z)).toBeLessThan(0.01);
    expect(Math.abs(p.y - stop.y)).toBeLessThan(0.03);
  });

  it('床の上ではふさが床に寝て、どの節も床より下へ行かない', () => {
    const w = createWand({ x: 0, y: 0, z: 0 });
    let low = Infinity;
    for (let t = 0; t < 6; t += DT) {
      stepWand(w, swing(t), DT);
      for (const p of w.nodes) low = Math.min(low, p.y);
    }
    expect(low).toBeGreaterThanOrEqual(0);
    run(w, 4, () => ({ x: 0, y: 0, z: 0 }));
    expect(w.nodes[POM].y).toBeLessThan(POM_R + 0.01);
  });

  it('速く振ると床のふさが跳ね上がる', () => {
    const w = createWand({ x: 0, y: 0, z: 0 });
    let high = 0;
    for (let t = 0; t < 2; t += DT) {
      stepWand(w, { x: Math.sin(t * 14) * 0.6, y: 0, z: 0 }, DT);
      high = Math.max(high, w.nodes[POM].y);
    }
    expect(high).toBeGreaterThan(0.08);
  });

  it('噛まれて引っぱられたふさは、離しても跳ね飛ばない', () => {
    const w = createWand({ x: 0, y: 0, z: 0 });
    for (let t = 0; t < 1.2; t += DT) stepWand(w, { x: 0, y: 0, z: 0 }, DT, { x: 0.6, y: 0.05, z: 0.3 });
    let high = 0;
    for (let t = 0; t < 2; t += DT) {
      stepWand(w, { x: 0, y: 0, z: 0 }, DT);
      high = Math.max(high, w.nodes[POM].y);
    }
    expect(high).toBeLessThan(w.hand.y + 0.1);
  });

  it('dt が 0 や大きすぎても、急に飛んでも NaN にならない', () => {
    const w = createWand({ x: 0, y: 0, z: 0 });
    const far = [
      { x: 3, y: 0.7, z: -2 },
      { x: -3, y: 0, z: 1 }
    ];
    for (let i = 0; i < 200; i++) stepWand(w, far[i % 2], [0, 0.25, 1 / 60, 1e-4][i % 4]);
    stepWand(w, { x: 0, y: 0, z: 0 }, 1 / 60, { x: 0.5, y: 0.05, z: 0.5 });
    for (const p of [...w.nodes, w.tip, w.hand]) for (const v of [p.x, p.y, p.z]) expect(Number.isFinite(v)).toBe(true);
    expect(Number.isFinite(w.speed)).toBe(true);
    for (const p of w.nodes.slice(1)) expect(p.y).toBeGreaterThanOrEqual(0);
  });
});
