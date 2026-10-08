import { describe, expect, it, vi } from 'vitest';
import { pushRecent } from './color';
import type { Level } from './move';
import { RADIUS } from './move';
import type { Dab } from './paint';
import { Play } from './play.svelte';
import type { World } from './world3d';

vi.mock('$lib/audio.svelte', () => ({
  tone: vi.fn(),
  sweep: vi.fn(),
  noise: vi.fn(),
  sfx: { start: vi.fn(), finish: vi.fn() }
}));

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
    xray: vi.fn(),
    snapCamera: vi.fn(),
    holdBrush: vi.fn(),
    dollCenter: () => [0, 1, 0],
    pickBody: () => null,
    cursor: vi.fn()
  } as unknown as World;
}

const run = (p: Play, frames: number) => {
  for (let i = 0; i < frames; i++) p.frame(1 / 60, i * 16);
};

const secs = (p: Play, t: number) => run(p, Math.round(t * 60));

function clinging() {
  const p = new Play(fakeWorld(), 70);
  p.body.pos = [0, 0, 5 - RADIUS - 0.05];
  secs(p, 0.2);
  p.jump();
  secs(p, 0.1);
  return p;
}

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

  it('壁に張り付いたままポーズを変えても、壁から外れない', () => {
    const p = clinging();
    p.held.up = true;
    secs(p, 0.5);
    p.held.up = false;
    const y = p.body.pos[1];
    p.setPose('curl');
    secs(p, 1);
    expect(p.body.cling?.kind).toBe('wall');
    expect(p.body.pos[1]).toBeCloseTo(y, 5);
    expect(p.pose).toBe('curl');
  });

  it('張り付いたままペイントとフリーカメラに出入りしても、張り付いたまま', () => {
    const p = clinging();
    p.togglePaint();
    secs(p, 1);
    p.togglePaint();
    p.toggleEye();
    secs(p, 1);
    p.toggleEye();
    secs(p, 0.2);
    expect(p.body.cling?.kind).toBe('wall');
  });

  it('天井にいるままフリーカメラに出入りしても、天井にいる', () => {
    const p = clinging();
    p.held.up = true;
    secs(p, 4);
    p.held.up = false;
    expect(p.body.cling?.kind).toBe('ceiling');
    p.toggleEye();
    secs(p, 1);
    p.toggleEye();
    secs(p, 0.2);
    expect(p.body.cling?.kind).toBe('ceiling');
  });

  it('回転ロックのあいだは、歩いても向きが変わらず、その場で回転で向きだけが変わる', () => {
    const p = new Play(fakeWorld(), 70);
    secs(p, 0.2);
    p.toggleLock();
    p.held.turn = 1;
    secs(p, 0.5);
    p.held.turn = 0;
    expect(p.body.yaw).toBeGreaterThan(0.5);
    const yaw = p.body.yaw;
    const x = p.body.pos[0];
    p.pointer('down', 1, 100, 400, 1000);
    p.pointer('move', 1, 170, 400, 1000);
    secs(p, 0.5);
    expect(p.body.yaw).toBeCloseTo(yaw, 5);
    expect(Math.abs(p.body.pos[0] - x) + Math.abs(p.body.pos[2])).toBeGreaterThan(0.3);
  });

  it('壁に張り付くと回るボタンが消えるので、押していた回転を残さない', () => {
    const p = clinging();
    p.held.turn = 1;
    secs(p, 0.1);
    expect(p.held.turn).toBe(0);
  });

  it('モードを替えると輪と回転も捨てる', () => {
    const p = new Play(fakeWorld(), 70);
    p.held.turn = -1;
    p.openWheel(3);
    p.togglePaint();
    expect(p.held.turn).toBe(0);
    expect(p.wheel).toBeNull();
  });

  it('輪で選んだポーズを人形に当てる', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.setPose('lie');
    expect(w.poses.to).toHaveBeenCalledWith(expect.objectContaining({ id: 'lie' }));
    p.setPose('stand');
    expect(p.pose).toBe('stand');
  });

  it('隠れタイムの時計は 60 秒から減り、0 で止まって 1 度だけ知らせる', async () => {
    const { sfx } = await import('$lib/audio.svelte');
    const p = new Play(fakeWorld(), 70);
    vi.mocked(sfx.finish).mockClear();
    p.startTimer();
    expect(p.timer).toBe(60);
    expect(p.timerRuns).toBe(1);
    secs(p, 59);
    expect(p.timer).toBeGreaterThan(0);
    expect(sfx.finish).not.toHaveBeenCalled();
    secs(p, 2);
    expect(p.timer).toBe(null);
    expect(sfx.finish).toHaveBeenCalledTimes(1);
  });

  it('時計は止められる', () => {
    const p = new Play(fakeWorld(), 70);
    p.startTimer();
    secs(p, 1);
    p.stopTimer();
    expect(p.timer).toBe(null);
  });
});
