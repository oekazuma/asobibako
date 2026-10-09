import { describe, expect, it } from 'vitest';
import { idle, newBody, step, type Body, type Level } from '../move';
import { levelOf, mansion, SPAWNS } from './layout';
import { inLobby, LOBBY, onPodium, PODIUM, podiumBoxes } from './lobby';

const lv: Level = levelOf(mansion());

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

describe('ロビーの部屋', () => {
  it('始める場所から台へ歩くと、台の上面に上がってハンター希望になる', () => {
    const b = newBody(SPAWNS.lobby[1]);
    settle(b);
    expect(onPodium(b)).toBe(false);
    walk(b, PODIUM.at[0], PODIUM.at[2]);
    expect(b.pos[1]).toBeCloseTo(PODIUM.h, 3);
    expect(onPodium(b)).toBe(true);
  });

  it('台の縁に半分だけ乗った人（上面に立っていても中心が円の外）はハンター希望にならない', () => {
    const edge = newBody([PODIUM.at[0] + 1.3, 0, PODIUM.at[2]]);
    settle(edge);
    expect(edge.pos[1]).toBeCloseTo(PODIUM.h, 3);
    expect(onPodium(edge)).toBe(false);
    const inner = newBody([PODIUM.at[0] + 1.1, 0, PODIUM.at[2]]);
    settle(inner);
    expect(onPodium(inner)).toBe(true);
  });

  it('跳んでいる最中も台の上なら希望のまま、張り付いていたら外す', () => {
    const [cx, , cz] = PODIUM.at;
    expect(onPodium({ pos: [cx, 1.2, cz], cling: null })).toBe(true);
    expect(onPodium({ pos: [cx, 0, cz + 3], cling: null })).toBe(false);
    expect(onPodium({ pos: [cx, 1.2, cz], cling: { kind: 'ceiling' } })).toBe(false);
  });

  it('ロビーからは出られず、壁を上っても天井に張り付くだけ', () => {
    const b = newBody(SPAWNS.lobby[2]);
    settle(b);
    walk(b, 0, 0);
    expect(b.pos[2]).toBeLessThan(LOBBY.max[2]);
    walk(b, -20, -60);
    expect(b.pos[0]).toBeGreaterThan(LOBBY.min[0]);
    step(b, { ...idle(), jump: true }, lv, 1 / 60);
    expect(b.cling?.kind).toBe('wall');
    for (let i = 0; i < 60 * 8; i++) step(b, { ...idle(), up: true }, lv, 1 / 60);
    expect(b.cling).toEqual({ kind: 'ceiling' });
    expect(b.pos[1]).toBeCloseTo(LOBBY.max[1], 2);
  });

  it('ロビーの壁はカメラの殻に入り、台の当たりは入らない', () => {
    const shell = lv.shell ?? [];
    expect(shell.some((b) => b.min[2] === LOBBY.min[2] - 0.3 && b.max[2] === LOBBY.min[2])).toBe(true);
    expect(shell.some((b) => b.max[1] === PODIUM.h)).toBe(false);
  });

  it('台の当たりの角は見える台の円からはみ出さない', () => {
    const [cx, , cz] = PODIUM.at;
    for (const b of podiumBoxes())
      for (const x of [b.min[0], b.max[0]])
        for (const z of [b.min[2], b.max[2]]) expect(Math.hypot(x - cx, z - cz)).toBeLessThan(PODIUM.r + 0.01);
  });

  it('日を消すのはロビーの中だけ', () => {
    expect(inLobby([0, 1.5, -66])).toBe(true);
    expect(inLobby(SPAWNS.hall[1])).toBe(false);
    expect(inLobby(SPAWNS.room[1])).toBe(false);
  });
});
