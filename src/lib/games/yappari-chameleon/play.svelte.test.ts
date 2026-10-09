import { describe, expect, it, vi } from 'vitest';
import { pushRecent } from './color';
import type { Level } from './move';
import { RADIUS } from './move';
import type { Dab } from './paint';
import { CROUCH, Play } from './play.svelte';
import type { World } from './world3d';

vi.mock('./doll3d', () => ({
  restHit: () => ({ p: [0, 1, 0], n: [0, 0, 1] })
}));

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

function fakeWorld(onBody = false) {
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
    pickBody: () => (onBody ? { object: {}, point: {}, normal: {} } : null),
    cursor: vi.fn(),
    dist: 2.25
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

const sprayed = async () => {
  const { noise } = await import('$lib/audio.svelte');
  return vi.mocked(noise);
};

/** ペイントモードで 1 本の指を置き、塗り始める時間まで待って離す */
function stroke(p: Play, id = 1) {
  p.pointer('down', id, 400, 300, 1000);
  p.frame(1 / 60, performance.now() + 200);
  p.pointer('move', id, 410, 300, 1000);
  p.pointer('up', id, 410, 300, 1000);
}

describe('Play の塗り', () => {
  it('3D スポイト中の取り消し（2 本めの指）は、前の筆を消さない', () => {
    const w = fakeWorld(true);
    const p = new Play(w, 70);
    p.togglePaint();
    stroke(p);
    expect(p.canUndo).toBe(true);
    vi.mocked(w.rig.paint.rebuild).mockClear();
    p.toggleSpoit();
    p.pointer('down', 1, 400, 300, 1000);
    p.frame(1 / 60, performance.now() + 200);
    p.pointer('down', 2, 500, 300, 1000);
    expect(p.canUndo).toBe(true);
    expect(p.log.dabs.length).toBeGreaterThan(0);
    expect(w.rig.paint.rebuild).not.toHaveBeenCalled();
  });

  it('体を外した 1 回のタップは、取り消しの 1 本にも吹き付けの音にもならない', async () => {
    const noise = await sprayed();
    noise.mockClear();
    const p = new Play(fakeWorld(false), 70);
    p.togglePaint();
    stroke(p);
    expect(p.canUndo).toBe(false);
    expect(noise).not.toHaveBeenCalled();
  });

  it('体に当たらないまま取り消された筆は、塗りを作り直さない', () => {
    const w = fakeWorld(false);
    const p = new Play(w, 70);
    p.togglePaint();
    p.pointer('down', 1, 400, 300, 1000);
    p.frame(1 / 60, performance.now() + 200);
    p.pointer('down', 2, 500, 300, 1000);
    expect(w.rig.paint.rebuild).not.toHaveBeenCalled();
  });

  it('体に当たった筆が取り消されたら、その筆だけ消して作り直す', () => {
    const w = fakeWorld(true);
    const p = new Play(w, 70);
    p.togglePaint();
    stroke(p);
    const kept = p.log.dabs.length;
    p.pointer('down', 1, 400, 300, 1000);
    p.frame(1 / 60, performance.now() + 200);
    p.pointer('move', 1, 420, 300, 1000);
    expect(p.log.dabs.length).toBeGreaterThan(kept);
    p.pointer('down', 2, 500, 300, 1000);
    expect(p.log.dabs).toHaveLength(kept);
    expect(w.rig.paint.rebuild).toHaveBeenCalledTimes(1);
  });

  it('塗っている途中に 3D スポイトを入れると、その筆はそこで終えて残る', () => {
    const p = new Play(fakeWorld(true), 70);
    p.togglePaint();
    p.pointer('down', 1, 400, 300, 1000);
    p.frame(1 / 60, performance.now() + 200);
    p.pointer('move', 1, 420, 300, 1000);
    const dabs = p.log.dabs.length;
    p.toggleSpoit();
    expect(p.spoit).toBe(true);
    p.pointer('move', 1, 440, 300, 1000);
    expect(p.log.dabs).toHaveLength(dabs);
    expect(p.canUndo).toBe(true);
    expect(p.recent).toHaveLength(1);
  });

  it('interrupt は塗りかけの筆を取り消し、押しているボタンも捨てる', () => {
    const w = fakeWorld(true);
    const p = new Play(w, 70);
    p.togglePaint();
    stroke(p);
    const kept = p.log.dabs.length;
    p.pointer('down', 1, 400, 300, 1000);
    p.frame(1 / 60, performance.now() + 200);
    p.pointer('move', 1, 420, 300, 1000);
    p.hold('up', true);
    p.hold('down', true);
    p.turn(1);
    p.interrupt();
    expect(p.log.dabs).toHaveLength(kept);
    expect(p.held).toEqual({ up: false, down: false, turn: 0 });
    expect(p.mode).toBe('paint');
  });
});

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

  it('ポーズを変えた次のフレームから、人形は行き先のポーズで置き、体の位置は変えない', () => {
    const p = clinging();
    const pos = [...p.body.pos];
    p.setPose('lie');
    p.frame(1 / 60, 0);
    expect(p.world.placeDoll).toHaveBeenLastCalledWith(
      expect.objectContaining({ pose: 'lie', cling: expect.objectContaining({ kind: 'wall' }) })
    );
    expect(p.body.pos).toEqual(pos);
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

describe('Play のカメラ', () => {
  const follows = (w: World) => vi.mocked(w.follow).mock.calls;
  const last = (w: World) => follows(w).at(-1)!;

  it('ペイントモードに入っても、向き・高さ・距離・画角は歩きのまま', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.camYaw = 1.1;
    p.camPitch = 0.6;
    secs(p, 0.1);
    vi.mocked(w.snapCamera).mockClear();
    p.togglePaint();
    expect([p.orbitYaw, p.orbitPitch, p.orbitDist]).toEqual([1.1, 0.6, 2.25]);
    secs(p, 0.1);
    expect(last(w).slice(1, 5)).toEqual([1.1, 0.6, 2.25, 60]);
    expect(w.snapCamera).not.toHaveBeenCalled();
  });

  it('張り付いていても天井でも、入るときに向きを変えない', () => {
    const p = clinging();
    p.camYaw = 0.7;
    p.togglePaint();
    expect(p.orbitYaw).toBe(0.7);
    expect(p.orbitPitch).toBe(p.camPitch);
  });

  it('見る中心は歩きの位置から体の真ん中へなめらかに移り、戻るときも飛ばない', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    secs(p, 0.1);
    const walk = last(w)[0];
    p.togglePaint();
    p.frame(1 / 60, 0);
    const first = last(w)[0];
    expect(first[1]).toBeCloseTo(walk[1], 1);
    secs(p, 0.5);
    expect(last(w)[0][1]).toBeCloseTo(1, 1);
    p.togglePaint();
    p.frame(1 / 60, 0);
    expect(last(w)[0][1]).toBeCloseTo(1, 1);
    secs(p, 0.6);
    expect(last(w)[0][1]).toBeCloseTo(walk[1], 1);
  });

  it('ペイントを出ると、回した向きと高さを歩きのカメラが引き継ぐ', () => {
    const p = new Play(fakeWorld(), 70);
    p.togglePaint();
    p.orbitYaw = 2;
    p.orbitPitch = 1.25;
    p.togglePaint();
    expect([p.camYaw, p.camPitch]).toEqual([2, 1.2]);
  });

  it('フリーカメラに出入りするときだけ距離を飛ばす', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.toggleEye();
    p.toggleEye();
    expect(w.snapCamera).toHaveBeenCalledTimes(2);
    vi.mocked(w.snapCamera).mockClear();
    p.interrupt();
    p.togglePaint();
    p.interrupt();
    expect(w.snapCamera).not.toHaveBeenCalled();
  });

  it('体の外から始めた 1 本指はカメラを回し、塗らない', () => {
    const p = new Play(fakeWorld(false), 70);
    p.togglePaint();
    const yaw = p.orbitYaw;
    const pitch = p.orbitPitch;
    p.pointer('down', 1, 400, 300, 1000);
    p.pointer('move', 1, 500, 340, 1000);
    p.frame(1 / 60, performance.now() + 200);
    p.pointer('up', 1, 500, 340, 1000);
    expect(p.orbitYaw).toBeCloseTo(yaw - 100 * 0.005);
    expect(p.orbitPitch).toBeCloseTo(pitch + 40 * 0.005);
    expect(p.canUndo).toBe(false);
    expect(p.log.dabs).toHaveLength(0);
  });

  it('体の上から始めた 1 本指は塗り、カメラは回さない', () => {
    const p = new Play(fakeWorld(true), 70);
    p.togglePaint();
    const yaw = p.orbitYaw;
    stroke(p);
    expect(p.canUndo).toBe(true);
    expect(p.orbitYaw).toBe(yaw);
  });

  it('3D スポイトのあいだは、体の外から始めた指も離した所で色を取る', () => {
    const w = fakeWorld(false);
    vi.mocked(w as unknown as { spoit: () => unknown }).spoit = vi.fn(() => ({
      color: [0, 1, 0],
      metal: 0,
      rough: 0.5
    })) as never;
    const p = new Play(w, 70);
    p.togglePaint();
    p.toggleSpoit();
    const yaw = p.orbitYaw;
    p.pointer('down', 1, 400, 300, 1000);
    p.frame(1 / 60, performance.now() + 200);
    p.pointer('move', 1, 410, 300, 1000);
    p.frame(1 / 60, performance.now() + 400);
    p.pointer('up', 1, 410, 300, 1000);
    expect(p.brush.color).toEqual([0, 1, 0]);
    expect(p.orbitYaw).toBe(yaw);
  });

  it('天井に張り付いているあいだは、カメラを人形の下に保ち、見回しも下向きの範囲に収める', () => {
    const p = clinging();
    p.held.up = true;
    secs(p, 4);
    p.held.up = false;
    expect(p.body.cling?.kind).toBe('ceiling');
    p.camPitch = 0.4;
    secs(p, 1);
    expect(p.camPitch).toBeLessThanOrEqual(-0.25 + 1e-3);
    // 上へ向けようと指を動かしても、下向きの範囲から出ない
    p.pointer('down', 1, 800, 300, 1000);
    p.pointer('move', 1, 800, 300 - 2000, 1000);
    secs(p, 0.1);
    expect(p.camPitch).toBeLessThanOrEqual(-0.25 + 1e-3);
    p.pointer('move', 1, 800, 300 + 4000, 1000);
    secs(p, 0.1);
    expect(p.camPitch).toBeGreaterThanOrEqual(-1.2 - 1e-6);
    p.pointer('up', 1, 800, 300, 1000);
  });

  it('天井の範囲へ寄せ終えたあとは、指で上下に見回せる（範囲のふちで固まらない）', () => {
    const p = clinging();
    p.held.up = true;
    secs(p, 4);
    p.held.up = false;
    p.camPitch = 0.4;
    secs(p, 3);
    expect(p.camPitch).toBe(-0.25);
    p.pointer('down', 1, 800, 300, 1000);
    p.pointer('move', 1, 800, 300 - 60, 1000);
    secs(p, 0.1);
    expect(p.camPitch).toBeCloseTo(-0.55, 5);
    p.pointer('up', 1, 800, 300, 1000);
  });

  it('天井から落ちて範囲の外から戻ったあとも、指で上下に見回せる', () => {
    const p = clinging();
    p.held.up = true;
    secs(p, 4);
    p.held.up = false;
    p.pointer('down', 1, 800, 300, 1000);
    p.pointer('move', 1, 800, 300 - 400, 1000);
    secs(p, 0.1);
    p.pointer('up', 1, 800, 300, 1000);
    expect(p.camPitch).toBeCloseTo(-1.2, 5);
    p.release();
    secs(p, 3);
    expect(p.body.cling).toBeNull();
    expect(p.camPitch).toBe(-0.5);
    p.pointer('down', 2, 800, 300, 1000);
    p.pointer('move', 2, 800, 300 + 60, 1000);
    secs(p, 0.1);
    expect(p.camPitch).toBeCloseTo(-0.2, 5);
  });

  it('天井から離れたら、見回しの範囲は元に戻る', () => {
    const p = clinging();
    p.held.up = true;
    secs(p, 4);
    p.held.up = false;
    p.release();
    secs(p, 1);
    expect(p.body.cling).toBeNull();
    p.pointer('down', 1, 800, 300, 1000);
    p.pointer('move', 1, 800, 300 + 400, 1000);
    secs(p, 0.1);
    expect(p.camPitch).toBeCloseTo(1.2, 5);
  });

  it('ペイントに入るとき、つぶれた距離は引き継がず、使える最小の距離から始める', () => {
    const w = fakeWorld();
    (w as unknown as { dist: number }).dist = 0.8;
    const p = new Play(w, 70);
    p.togglePaint();
    expect(p.orbitDist).toBe(1.2);
  });
});

describe('Play の役', () => {
  it('ハンターになると、その場所から一人称で歩き、フリーカメラのボタンでは抜けない', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.hunt([2, 0, 1], 0.5);
    expect(p.role).toBe('hunter');
    expect(p.mode).toBe('eye');
    expect(p.ghost.pos).toEqual([2, 0, 1]);
    expect(p.eyeYaw).toBe(0.5);
    p.toggleEye();
    expect(p.mode).toBe('eye');
    p.unhunt();
    expect(p.role).toBe('hider');
    expect(p.mode).toBe('walk');
  });

  it('しゃがむと目の高さを下げる', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.hunt([0, 0, 0], 0);
    secs(p, 0.5);
    const stand = vi.mocked(w.eye).mock.lastCall![0][1];
    p.crouch = true;
    p.frame(1 / 60, 0);
    expect(vi.mocked(w.eye).mock.lastCall![0][1]).toBeCloseTo(stand - CROUCH, 5);
  });

  it('観戦では見ている人のまわりを回り、その人がいなければフリーカメラで歩く', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.spectate();
    p.watch = [3, 0.6, 2];
    vi.mocked(w.follow).mockClear();
    p.frame(1 / 60, 0);
    expect(vi.mocked(w.follow).mock.lastCall![0]).toEqual([3, 0.6, 2]);
    // スティックを倒しても、見ている人のまわりを回るだけで足は動かない
    const at = [...p.ghost.pos];
    p.pointer('down', 3, 200, 300, 1000);
    p.pointer('move', 3, 200, 100, 1000);
    secs(p, 0.5);
    p.pointer('up', 3, 200, 100, 1000);
    expect(p.ghost.pos).toEqual(at);
    p.freeCam();
    vi.mocked(w.eye).mockClear();
    p.frame(1 / 60, 0);
    expect(w.eye).toHaveBeenCalled();
  });

  it('観戦で下へ大きく引いても、すぐ逆へ引けば向きが変わる', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.spectate();
    p.watch = [3, 0.6, 2];
    p.pointer('down', 1, 800, 300, 1000);
    p.pointer('move', 1, 800, 300 + 800, 1000);
    secs(p, 0.1);
    p.pointer('move', 1, 800, 300 + 800 - 60, 1000);
    secs(p, 0.1);
    p.pointer('up', 1, 800, 300, 1000);
    expect(vi.mocked(w.follow).mock.lastCall![2]).toBeCloseTo(1.2 - 0.3, 5);
    p.freeCam();
    expect(p.eyePitch).toBeLessThanOrEqual(1.2);
  });

  it('隠れる人でなければペイントモードに入れない', () => {
    const p = new Play(fakeWorld(), 70);
    p.hunt([0, 0, 0], 0);
    p.togglePaint();
    expect(p.mode).toBe('eye');
  });

  it('ペイントから観戦に入ると、見ていた向きを引き継ぎ、仰角は水平に戻す', () => {
    const p = new Play(fakeWorld(), 70);
    p.togglePaint();
    p.orbitYaw = 1.1;
    p.eyePitch = 0.9;
    p.spectate();
    expect(p.eyeYaw).toBe(1.1);
    expect(p.eyePitch).toBe(0);
  });
});

describe('Play の止める', () => {
  it('止めているあいだは、スティックを倒しても歩かず、塗りも付かない', () => {
    const p = new Play(fakeWorld(true), 70);
    secs(p, 0.2);
    p.frozen = true;
    p.pointer('down', 1, 100, 400, 1000);
    p.pointer('move', 1, 170, 400, 1000);
    secs(p, 0.5);
    expect(Math.abs(p.body.pos[0]) + Math.abs(p.body.pos[2])).toBeLessThan(1e-6);
    p.pointer('up', 1, 170, 400, 1000);
    p.togglePaint();
    stroke(p, 2);
    expect(p.log.dabs).toHaveLength(0);
    p.frozen = false;
    stroke(p, 3);
    expect(p.log.dabs.length).toBeGreaterThan(0);
  });
});
