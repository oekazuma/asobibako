import { describe, expect, it } from 'vitest';
import { moveBoss, updateHazards } from './bosses';
import { DRAGON, inFan } from './bosses-snow';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, type World } from './world';

const VIEW = { w: 274, h: 394 };

function arena(at = 0): World {
  const w = createWorld('dog', 2, VIEW, {}, 'snow');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [], storms: [] };
  w.weapons = [];
  w.metalAt = -1;
  w.player.hp = w.stats.maxHp = 1e6;
  w.enemies[at] = makeEnemy(ENEMIES.dragon, 100, 0, 5000);
  return w;
}

const tick = (w: World, i: number, seconds: number) => {
  const hurt: number[] = [];
  for (let k = 0; k < Math.round(seconds * 60); k++) {
    moveBoss(w, i, 1 / 60);
    updateHazards(w, 1 / 60);
    for (const e of w.events) if (e.type === 'hurt') hurt.push(e.dmg);
    w.events.length = 0;
    w.player.invuln -= 1 / 60;
  }
  return hurt;
};

describe('氷の竜', () => {
  it('氷の柱は自分の位置とまわり 4 か所に予告を出し、1 秒後に円の中だけが痛い', () => {
    const w = arena();
    w.enemies[0].cd = 0;
    tick(w, 0, 1 / 60);
    const marks = w.hazards.filter((h) => h.alive && h.kind === 'pillar');
    expect(marks).toHaveLength(5);
    expect(marks.some((h) => h.x === 0 && h.y === 0)).toBe(true);
    for (const h of marks) expect(Math.hypot(h.x, h.y)).toBeCloseTo(h.x === 0 && h.y === 0 ? 0 : DRAGON.pillarSpread);
    // 柱と柱のあいだに逃げれば当たらない
    w.player.x = DRAGON.pillarSpread / 2;
    w.player.y = DRAGON.pillarSpread / 2;
    expect(tick(w, 0, DRAGON.pillarWarn + 0.2)).toEqual([]);
  });

  it('氷の柱の円の中にいると痛い', () => {
    const w = arena();
    w.enemies[0].cd = 0;
    tick(w, 0, 1 / 60);
    expect(tick(w, 0, DRAGON.pillarWarn + 0.2)).toContain(DRAGON.pillarDmg);
  });

  it('冷たい息は扇の予告のあと 1 秒吐き、扇の中では痛くて遅くなり、外では当たらない', () => {
    for (const [x, y, hit] of [
      [0, 0, true],
      [0, 80, false]
    ] as const) {
      const w = arena();
      const e = w.enemies[0];
      e.turn = 1;
      e.cd = 0;
      tick(w, 0, 1 / 60);
      const fan = w.hazards.find((h) => h.alive && h.kind === 'breath')!;
      expect(fan.owner).toBe(0);
      expect(tick(w, 0, DRAGON.breathWarn - 0.05)).toEqual([]);
      w.player.x = x;
      w.player.y = y;
      const hurt = tick(w, 0, DRAGON.breathTime);
      expect(hurt.length >= 2).toBe(hit);
      expect(w.player.slow > 0).toBe(hit);
      tick(w, 0, 0.3);
      expect(w.hazards.some((h) => h.alive && h.kind === 'breath')).toBe(false);
    }
  });

  it('inFan は扇の角度と長さの中だけ', () => {
    const h = { x: 0, y: 0, vx: 1, vy: 0, r: DRAGON.breathLength };
    expect(inFan(h, 50, 0)).toBe(true);
    expect(inFan(h, 50, 25)).toBe(true);
    expect(inFan(h, 50, 40)).toBe(false);
    expect(inFan(h, -50, 0)).toBe(false);
    expect(inFan(h, DRAGON.breathLength + 5, 0)).toBe(false);
  });

  it('竜が倒れたら息が消え、ほかのボスが倒れても消えない', () => {
    const w = arena(1);
    w.enemies[0] = makeEnemy(ENEMIES.yeti, 400, 400, 5000);
    const e = w.enemies[1];
    e.turn = 1;
    e.cd = 0;
    tick(w, 1, 1 / 60);
    w.enemies[0].alive = false;
    tick(w, 1, 0.1);
    expect(w.hazards.some((h) => h.alive && h.kind === 'breath')).toBe(true);
    e.alive = false;
    tick(w, 1, 0.1);
    expect(w.hazards.some((h) => h.alive && h.kind === 'breath')).toBe(false);
  });

  it('近づくと下がり、離れると寄る', () => {
    const w = arena();
    const e = w.enemies[0];
    e.cd = 99;
    e.x = 40;
    const v = moveBoss(w, 0, 1 / 60);
    expect(v.vx).toBeGreaterThan(0);
    e.x = 400;
    expect(moveBoss(w, 0, 1 / 60).vx).toBeLessThan(0);
  });
});
