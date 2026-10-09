import { describe, expect, it } from 'vitest';
import { idle, newBody, RADIUS, step, type Body, type Box, type Level } from '../move';
import { levelOf, mansion, ROOM, SPAWNS } from './layout';
import { LOBBY } from './lobby';

const m = mansion();
const lv: Level = levelOf(m);

/** 目的の場所（x, z）へまっすぐ歩く。着くか 30 秒たったら止める */
function walk(b: Body, x: number, z: number) {
  for (let t = 0; t < 30; t += 1 / 60) {
    const dx = x - b.pos[0];
    const dz = z - b.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    step(b, { ...idle(), x: dx / Math.max(d, 1), z: dz / Math.max(d, 1) }, lv, 1 / 60);
  }
}

const settle = (b: Body) => {
  for (let i = 0; i < 60; i++) step(b, idle(), lv, 1 / 60);
};

describe('mansion', () => {
  it('始めの場所は、どの当たりの箱にも入っていない', () => {
    const [x, , z] = m.spawn;
    for (const box of lv.boxes)
      if (box.max[1] > 0.3 && box.min[1] < 1.15)
        expect(
          x > box.min[0] - RADIUS && x < box.max[0] + RADIUS && z > box.min[2] - RADIUS && z < box.max[2] + RADIUS
        ).toBe(false);
  });

  it('大広間から出入口を通って、緑の廊下の奥の本棚の前まで歩ける', () => {
    const b = newBody(m.spawn);
    settle(b);
    walk(b, -2, 1.5);
    walk(b, -2, 5);
    walk(b, -21, 5);
    expect(b.pos[0]).toBeLessThan(-20.9);
    walk(b, -24, 5);
    expect(b.pos[0]).toBeGreaterThan(-22.6);
  });

  it('大階段を上ると 2 階の回廊に立つ', () => {
    const b = newBody([0, 0, 3]);
    settle(b);
    walk(b, 0, 10);
    expect(b.pos[1]).toBeCloseTo(3.5, 1);
    expect(b.pos[2]).toBeGreaterThan(9.8);
  });

  it('回廊の手すりは越えられない', () => {
    const b = newBody([3, 3.5, 10.5]);
    settle(b);
    walk(b, 3, 7);
    expect(b.pos[2]).toBeGreaterThan(9.2);
    expect(b.pos[1]).toBeCloseTo(3.5, 1);
  });

  it('大階段の横からは入れず、階段の下にももぐれない', () => {
    const b = newBody([-3, 0, 6]);
    settle(b);
    walk(b, 0, 6);
    expect(b.pos[0]).toBeLessThan(-1.4);
  });

  it('家具はどれも大広間か緑の廊下かロビーの中にある', () => {
    for (const p of m.pieces) {
      const [x, , z] = p.at;
      const hall = x >= -7 && x <= 7 && z >= 0 && z <= 12;
      const corridor = x >= -23 && x <= -7 && z >= 3.25 && z <= 6.75;
      const lobby = x >= LOBBY.min[0] && x <= LOBBY.max[0] && z >= LOBBY.min[2] && z <= LOBBY.max[2];
      expect(hall || corridor || lobby, `${p.kind} ${p.at}`).toBe(true);
    }
  });

  it('カメラの殻は部屋の壁を含み、家具や手すりの箱を含まない', () => {
    const shell = lv.shell ?? [];
    const same = (a: Box, b: Box) => a.min.every((v, i) => v === b.min[i]) && a.max.every((v, i) => v === b.max[i]);
    const walls = m.slabs.filter((s) => s.mat === 'woodPanel' || s.mat === 'greenDamask');
    for (const w of walls) expect(shell.some((b) => same(b, w))).toBe(true);
    for (const s of m.slabs.filter((s) => s.mat === 'rail')) expect(shell.some((b) => same(b, s))).toBe(false);
    const pieceBoxes = lv.boxes.slice(m.slabs.length);
    expect(pieceBoxes.length).toBeGreaterThan(10);
    for (const pb of pieceBoxes) expect(shell.some((b) => same(b, pb))).toBe(false);
  });

  it('回廊の下の北の壁に張り付いて上がると、回廊の裏の天井に張り付く', () => {
    const b = newBody([3, 0, 12 - RADIUS - 0.05]);
    settle(b);
    step(b, { ...idle(), jump: true }, lv, 1 / 60);
    expect(b.cling?.kind).toBe('wall');
    for (let i = 0; i < 60 * 6; i++) step(b, { ...idle(), up: true }, lv, 1 / 60);
    expect(b.cling).toEqual({ kind: 'ceiling' });
    expect(b.pos[1]).toBeCloseTo(3.3, 2);
    expect(b.pos[2] + Math.cos(b.yaw) * 1.15).toBeLessThan(12 - 0.3);
  });

  it('始める場所はどれも当たりの箱に入らず、控室の場所は控室の中', () => {
    for (const where of ['hall', 'room', 'entrance', 'lobby'] as const)
      for (const at of Object.values(SPAWNS[where])) {
        const b = newBody(at);
        settle(b);
        expect(b.pos[0], `${where} ${at}`).toBeCloseTo(at[0], 3);
        expect(b.pos[2], `${where} ${at}`).toBeCloseTo(at[2], 3);
        expect(b.pos[1], `${where} ${at}`).toBeCloseTo(0, 3);
      }
    for (const at of Object.values(SPAWNS.room)) {
      expect(at[0] > ROOM.min[0] && at[0] < ROOM.max[0] && at[2] > ROOM.min[2] && at[2] < ROOM.max[2]).toBe(true);
    }
  });

  it('控室からは出られず、壁を上っても天井に張り付くだけ', () => {
    const b = newBody(SPAWNS.room[1]);
    settle(b);
    walk(b, 0, 0);
    expect(b.pos[2]).toBeLessThan(ROOM.max[2]);
    walk(b, 9, -30);
    expect(b.pos[0]).toBeLessThan(ROOM.max[0]);
    step(b, { ...idle(), jump: true }, lv, 1 / 60);
    expect(b.cling?.kind).toBe('wall');
    for (let i = 0; i < 60 * 5; i++) step(b, { ...idle(), up: true }, lv, 1 / 60);
    expect(b.cling).toEqual({ kind: 'ceiling' });
    expect(b.pos[1]).toBeCloseTo(ROOM.max[1], 2);
  });

  it('控室の壁はカメラの殻に入る（控室の中から屋敷は見えない）', () => {
    const shell = lv.shell ?? [];
    expect(shell.some((b) => b.min[2] === ROOM.min[2] - 0.3 && b.max[2] === ROOM.min[2])).toBe(true);
  });
});
