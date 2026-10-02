import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { FOREST } from './stages/forest';
import { MAX_ENEMIES, createWorld, spawnEvents, step } from './world';

const VIEW = { w: 274, h: 394 };

function quiet() {
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [] };
  w.spawnAcc = [];
  w.weapons = [];
  return w;
}

describe('群れの大波', () => {
  it('森の出来事は時刻の順で、ボスの時刻を避ける', () => {
    const at = FOREST.events.map((e) => e.at);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    for (const b of FOREST.bosses) for (const t of at) expect(Math.abs(t - b.at)).toBeGreaterThan(20);
  });

  it('横切る群れは同じ向きにまっすぐ進み、抜けたら消えて倒した数に入らない', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 1, kind: 'swarm', enemy: 'bat', count: 20, text: 'コウモリの大群！' }] };
    w.time = 1;
    spawnEvents(w);
    const flock = w.enemies.filter((e) => e.alive);
    expect(flock).toHaveLength(20);
    expect(new Set(flock.map((e) => `${e.dx.toFixed(3)},${e.dy.toFixed(3)}`)).size).toBe(1);
    expect(w.events.some((e) => e.type === 'swarm')).toBe(true);
    w.player.invuln = 999;
    for (let i = 0; i < 60 * 20; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.enemies.filter((e) => e.alive && !e.def.prop)).toHaveLength(0);
    expect(w.kills).toBe(0);
  });

  it('迫る輪は自分を囲んで出る', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 1, kind: 'ring', enemy: 'rat', count: 40, text: 'ネズミに囲まれた！' }] };
    w.time = 1;
    spawnEvents(w);
    const ring = w.enemies.filter((e) => e.alive);
    expect(ring).toHaveLength(40);
    const d = ring.map((e) => Math.hypot(e.x - w.player.x, e.y - w.player.y));
    expect(Math.max(...d) - Math.min(...d)).toBeLessThan(1);
    const quads = new Set(ring.map((e) => `${e.x > w.player.x}${e.y > w.player.y}`));
    expect(quads.size).toBe(4);
  });

  it('入れ物が足りなければ出せる分だけ出し、落ちない', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 1, kind: 'ring', enemy: 'rat', count: MAX_ENEMIES + 50, text: '' }] };
    w.time = 1;
    spawnEvents(w);
    expect(w.enemies.length).toBe(MAX_ENEMIES);
    expect(() => step(w, { x: 0, y: 0 }, 1 / 60)).not.toThrow();
  });

  it('同じ出来事は 1 度だけ', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 1, kind: 'ring', enemy: 'rat', count: 5, text: '' }] };
    w.time = 1;
    spawnEvents(w);
    spawnEvents(w);
    expect(w.enemies.filter((e) => e.alive)).toHaveLength(5);
  });

  it('体力はそのときの toughness を掛ける', () => {
    const w = quiet();
    w.stage = { ...w.stage, events: [{ at: 600, kind: 'ring', enemy: 'rat', count: 1, text: '' }] };
    w.time = 600;
    spawnEvents(w);
    expect(w.enemies[0].hp).toBeCloseTo(ENEMIES.rat.hp * w.stage.toughness(600));
  });
});
