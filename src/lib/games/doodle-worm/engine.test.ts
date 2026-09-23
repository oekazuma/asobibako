import { describe, expect, it } from 'vitest';
import { hatch, isBody, isLoop, random, step, type Point, type World } from './engine';

const ring = (cx: number, cy: number, r: number, turns = 1): Point[] =>
  Array.from({ length: 20 }, (_, i) => {
    const t = (i / 19) * Math.PI * 2 * turns;
    return [cx + Math.cos(t) * r, cy + Math.sin(t) * r];
  });

const line = (x0: number, y0: number, x1: number, y1: number): Point[] =>
  Array.from({ length: 10 }, (_, i) => [x0 + ((x1 - x0) * i) / 9, y0 + ((y1 - y0) * i) / 9]);

describe('isLoop', () => {
  it('まるは頭になり、線や小さな点はならない', () => {
    expect(isLoop(ring(0.5, 0.5, 0.08))).toBe(true);
    expect(isLoop(line(0.1, 0.1, 0.5, 0.2))).toBe(false);
    expect(isLoop(ring(0.5, 0.5, 0.01))).toBe(false);
  });

  it('閉じきっていなくても、4 分の 3 周以上回っていれば頭になる', () => {
    expect(isLoop(ring(0.5, 0.5, 0.08, 0.8))).toBe(true);
    expect(isLoop(ring(0.5, 0.5, 0.08, 0.5))).toBe(false);
  });

  it('短すぎる線は胴体にならない', () => {
    expect(isBody(line(0.1, 0.1, 0.12, 0.1))).toBe(false);
    expect(isBody(line(0.1, 0.1, 0.4, 0.1))).toBe(true);
  });
});

describe('hatch', () => {
  it('胴体をどちら向きに描いても、尻尾から頭の向きへ進む', () => {
    const head = { color: 'y', pts: ring(0.3, 0.5, 0.08) };
    for (const body of [line(0.38, 0.5, 0.7, 0.5), line(0.7, 0.5, 0.38, 0.5)]) {
      const c = hatch(head, { color: 'g', pts: body });
      expect(c.dx).toBeCloseTo(-1);
      expect(c.dy).toBeCloseTo(0);
    }
  });
});

describe('step', () => {
  it('這って画面の外へ出たら消える', () => {
    const world: World = { aspect: 0.75, creatures: [random(0.75, () => 0.5)] };
    for (let i = 0; i < 600 && world.creatures.length; i++) step(world, 0.05);
    expect(world.creatures).toHaveLength(0);
  });
});
