import { describe, expect, it } from 'vitest';
import { keyVector, padVector, pick, stickVector } from './input';

describe('入力', () => {
  it('WASD と矢印キーは同じ向き、斜めは長さ 1', () => {
    expect(keyVector(new Set(['KeyW']))).toEqual({ x: 0, y: -1 });
    expect(keyVector(new Set(['ArrowLeft']))).toEqual({ x: -1, y: 0 });
    const d = keyVector(new Set(['KeyD', 'ArrowDown']));
    expect(Math.hypot(d.x, d.y)).toBeCloseTo(1);
    expect(keyVector(new Set(['KeyA', 'KeyD']))).toEqual({ x: 0, y: 0 });
  });

  it('スティックは遊びの中では 0、半径の外では長さ 1', () => {
    expect(stickVector(3, 0, 40)).toEqual({ x: 0, y: 0 });
    expect(stickVector(20, 0, 40).x).toBeCloseTo(0.5);
    expect(stickVector(0, 400, 40)).toEqual({ x: 0, y: 1 });
  });

  it('パッドは遊び 0.2', () => {
    expect(padVector([0.1, 0.1])).toEqual({ x: 0, y: 0 });
    expect(padVector([1, 0]).x).toBeCloseTo(1);
    expect(padVector(undefined)).toEqual({ x: 0, y: 0 });
  });

  it('指とキーを同時に使ったら指を優先する', () => {
    expect(pick({ x: 0, y: 1 }, { x: 1, y: 0 })).toEqual({ x: 0, y: 1 });
    expect(pick({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
  });
});
