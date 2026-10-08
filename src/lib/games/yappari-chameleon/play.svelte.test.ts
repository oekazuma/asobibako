import { describe, expect, it, vi } from 'vitest';
import { pushRecent } from './color';
import type { Level } from './move';
import type { Dab } from './paint';
import { Play } from './play.svelte';
import type { World } from './world3d';

// 床（y = 0）・奥の壁（z = 5）・天井（y = 3）
const level: Level = {
  boxes: [
    { min: [-10, -1, -10], max: [10, 0, 10] },
    { min: [-10, 0, 5], max: [10, 3, 5.3] },
    { min: [-10, 3, -10], max: [10, 3.3, 10] }
  ],
  ramps: [],
  spawn: [0, 0, 0]
};

function fakeWorld() {
  return {
    level,
    camera: { position: { x: 0, y: 2.9, z: 1 } },
    rig: { mesh: { receiveShadow: true }, paint: { rebuild: vi.fn(), apply: vi.fn() } },
    poses: { step: vi.fn(), to: vi.fn() },
    placeDoll: vi.fn(),
    follow: vi.fn(),
    eye: vi.fn(),
    render: vi.fn(),
    dollCenter: () => [0, 1, 0],
    pickBody: () => null,
    cursor: vi.fn()
  } as unknown as World;
}

const run = (p: Play, frames: number) => {
  for (let i = 0; i < frames; i++) p.frame(1 / 60, i * 16);
};

describe('Play', () => {
  it('押したままの下がるが、床まで下りて張り付きが終わっても残らず、張り付き直しても滑り落ちない', () => {
    const p = new Play(fakeWorld(), 70);
    p.body.pos = [0, 0.5, 5 - 0.2 - 0.05];
    p.jump();
    run(p, 2);
    expect(p.cling).toBe('wall');
    p.held.down = true;
    run(p, 120);
    expect(p.body.cling).toBeNull();
    expect(p.held.down).toBe(false);
    p.jump();
    run(p, 2);
    expect(p.cling).toBe('wall');
    const y = p.body.pos[1];
    run(p, 60);
    expect(p.body.cling).not.toBeNull();
    expect(p.body.pos[1]).toBeCloseTo(y, 5);
  });

  it('モードを替えると、押しているボタンとスポイトを捨てる', () => {
    const p = new Play(fakeWorld(), 70);
    p.held.up = true;
    p.spoit = true;
    p.togglePaint();
    expect(p.held.up).toBe(false);
    expect(p.spoit).toBe(false);
  });

  it('天井にいてもフリーカメラはカメラの真下の床から歩き出し、そこで跳べる', () => {
    const p = new Play(fakeWorld(), 70);
    p.toggleEye();
    expect(p.ghost.pos[1]).toBe(0);
    run(p, 3);
    p.jump();
    run(p, 6);
    expect(p.ghost.pos[1]).toBeGreaterThan(0.1);
    expect(p.ghost.cling).toBeNull();
  });

  it('フリーカメラは壁際で跳んでも張り付かない', () => {
    const w = fakeWorld();
    w.camera.position.z = 5 - 0.2 - 0.05;
    const p = new Play(w, 70);
    p.toggleEye();
    run(p, 3);
    p.jump();
    run(p, 6);
    expect(p.ghost.cling).toBeNull();
  });

  it('最近の色から選んだ色は、塗りの記録の色と配列を共有しない', () => {
    const p = new Play(fakeWorld(), 70);
    const dab = { p: [0, 0, 0], n: [0, 1, 0], r: 0.05, c: [1, 0, 0], a: 1, m: 0, ro: 0.85 } as Dab;
    p.log.add([dab]);
    p.recent = pushRecent([], dab.c);
    p.setColor(p.recent[0]);
    // スライダーが筆の色を配列の中で書き換えても、記録した塗りと最近の色は変わらない
    p.brush.color[0] = 0.3;
    expect(dab.c).toEqual([1, 0, 0]);
    expect(p.recent[0]).toEqual([1, 0, 0]);
  });
});
