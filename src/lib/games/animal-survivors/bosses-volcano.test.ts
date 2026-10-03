import { describe, expect, it } from 'vitest';
import { airborne } from './bosses-snow';
import { RING_DY } from './bosses';
import { GIANT, PHOENIX } from './bosses-volcano';
import { ENEMIES } from './enemies';
import { createWorld, damageEnemy, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
function quiet(): World {
  const w = createWorld('dog', 1, VIEW, {}, 'volcano');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [], eruptions: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  w.player.invuln = 9999;
  return w;
}

describe('溶岩の巨人', () => {
  it('地ならしと岩投げを交互に使い、当たったところに溶岩の池を残す', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.lavaGiant, 60, 0, ENEMIES.lavaGiant.hp));
    const radii = new Set<number>();
    let pools = 0;
    for (let i = 0; i < 60 * 12; i++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      for (const h of w.hazards) if (h.alive && h.kind === 'slam') radii.add(h.r);
      pools = Math.max(pools, w.lava.filter((l) => l.life > 0 && l.warn <= 0).length);
    }
    expect(radii).toContain(GIANT.slamR);
    expect(radii).toContain(GIANT.rockR);
    expect(pools).toBeGreaterThan(1);
    expect(w.lava.some((l) => l.r === GIANT.slamLava)).toBe(true);
  });

  it('地ならしの予告のあいだに巨人が倒れたら、池は残らない', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.lavaGiant, 60, 0, ENEMIES.lavaGiant.hp));
    for (let i = 0; i < 60 * 3; i++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      if (w.hazards.some((h) => h.alive && h.kind === 'slam')) break;
    }
    w.enemies[w.enemies.length - 1].alive = false;
    for (let i = 0; i < 60 * 2; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.lava.filter((l) => l.life > 0)).toHaveLength(0);
  });
});

describe('不死鳥', () => {
  const add = (w: World) => {
    w.enemies.push(makeEnemy({ ...ENEMIES.phoenix }, 80, 0, ENEMIES.phoenix.hp));
    return w.enemies.length - 1;
  };

  it('空に上がって急降下の予告を出し、火の羽根の予告も降らせる', () => {
    const w = quiet();
    const i = add(w);
    let flew = false;
    const kinds = new Set<string>();
    for (let k = 0; k < 60 * 12; k++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      flew ||= airborne(w.enemies[i]);
      for (const h of w.hazards) if (h.alive) kinds.add(`${h.kind}:${h.r}`);
    }
    expect(flew).toBe(true);
    expect(kinds).toContain(`pounce:${PHOENIX.r}`);
    expect(kinds).toContain(`slam:${PHOENIX.featherR}`);
  });

  it('一度だけ体力半分でよみがえり、そのあいだは当たらず、2 度めで倒れて 1 回だけ数える', () => {
    const w = quiet();
    const i = add(w);
    const e = w.enemies[i];
    const kills = w.kills;
    damageEnemy(w, i, 1e9, 0, 0);
    expect(e.alive).toBe(true);
    expect(e.hp).toBeCloseTo(ENEMIES.phoenix.hp / 2);
    expect(w.bossKills).toEqual([]);
    expect(w.kills).toBe(kills);
    expect(w.events.some((ev) => ev.type === 'swarm' && ev.text === '不死鳥がよみがえった！')).toBe(true);
    expect(airborne(e)).toBe(true);
    for (let k = 0; k < 60 * 2; k++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(airborne(e)).toBe(false);
    damageEnemy(w, i, 1e9, 0, 0);
    expect(e.alive).toBe(false);
    expect(w.bossKills).toEqual(['phoenix']);
  });

  it('クリアの一掃ではよみがえらずに消える', () => {
    const w = quiet();
    const i = add(w);
    w.time = w.stage.length - 1e-6;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.enemies[i].alive).toBe(false);
    expect(w.swept).toBe(1);
  });
});

describe('ボスの池の位置', () => {
  it('地ならしと岩の池は、予告の輪を描いたところ（足もと）に出る', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.lavaGiant, 60, 0, ENEMIES.lavaGiant.hp));
    let at: { x: number; y: number } | null = null;
    for (let i = 0; i < 60 * 6 && !w.lava.some((l) => l.life > 0); i++) {
      const h = w.hazards.find((o) => o.alive && o.kind === 'slam' && o.delay > 0 && o.delay <= 1 / 60);
      if (h) at = { x: h.x, y: h.y };
      step(w, { x: 0, y: 0 }, 1 / 60);
    }
    expect(at).not.toBeNull();
    expect(w.lava.some((l) => l.x === at!.x && l.y === at!.y + RING_DY)).toBe(true);
  });
});
