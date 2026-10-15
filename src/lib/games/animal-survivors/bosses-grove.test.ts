import { describe, expect, it } from 'vitest';
import { moveBoss, updateHazards } from './bosses';
import { STAG } from './bosses-grove';
import { inFan } from './bosses-snow';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, type World } from './world';

const VIEW = { w: 274, h: 394 };

function arena(rage?: number): World {
  const w = createWorld('dog', 2, VIEW, {}, 'forest');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.weapons = [];
  w.metalAt = -1;
  w.player.hp = w.stats.maxHp = 1e6;
  w.enemies[0] = makeEnemy(rage ? { ...ENEMIES.stag, rage } : ENEMIES.stag, 120, 0, 1e6);
  return w;
}

const tick = (w: World, seconds: number, on?: () => void) => {
  const hurt: number[] = [];
  for (let k = 0; k < Math.round(seconds * 60); k++) {
    moveBoss(w, 0, 1 / 60);
    updateHazards(w, 1 / 60);
    on?.();
    for (const e of w.events) if (e.type === 'hurt') hurt.push(e.dmg);
    w.events.length = 0;
    w.player.invuln -= 1 / 60;
  }
  return hurt;
};

/** 角ふりの予告を出す直前（突進のあとの休みが明ける）にする */
function sweepNow(w: World) {
  w.enemies[0].state = 5;
  w.enemies[0].wait = 0;
  tick(w, 1 / 60);
  return w.hazards.find((h) => h.alive && h.kind === 'breath')!;
}

describe('森の大ジカ', () => {
  it('突進の矢印の予告を出して 3 回続けて突進し、そのあと角ふりを使う', () => {
    const w = arena();
    const e = w.enemies[0];
    const states: number[] = [];
    tick(w, 15, () => {
      if (states[states.length - 1] !== e.state) states.push(e.state);
    });
    // 突進は予告(1)と突進(2)を 3 組続け、休み(5)のあと角ふり(6)へ入る
    expect(states.join('')).toContain('12121256');
    expect(w.hazards.some((h) => h.kind === 'dash')).toBe(true);
  });

  it('角ふりの予告は 1 秒、いちばん近い動物の向きの扇で出る', () => {
    const w = arena();
    const fan = sweepNow(w);
    expect(fan.owner).toBe(0);
    expect(fan.delay).toBeGreaterThan(STAG.warn - 0.1);
    expect([fan.vx, fan.vy]).toEqual([-1, 0]);
    expect(fan.r).toBe(STAG.length);
  });

  it('扇の中の自分にだけ当たり、遅くならない', () => {
    for (const [x, y, hit] of [
      [60, 0, true],
      [120, 80, false]
    ] as const) {
      const w = arena();
      sweepNow(w);
      w.player.x = x;
      w.player.y = y;
      const warned = tick(w, STAG.warn - 0.1);
      expect(warned).toEqual([]);
      const hurt = tick(w, 0.6);
      expect(hurt).toEqual(hit ? [STAG.dmg] : []);
      expect(w.player.slow).toBe(0);
    }
  });

  it('扇の向きは予告を置いたときに決まり、自分が動いても変わらない', () => {
    const w = arena();
    const fan = sweepNow(w);
    w.player.x = 120;
    w.player.y = 100;
    tick(w, 0.5);
    expect([fan.vx, fan.vy]).toEqual([-1, 0]);
    expect(inFan(fan, 120, 100)).toBe(false);
  });

  it('角ふりの予告のあいだに倒されると扇ごと消える', () => {
    const w = arena();
    sweepNow(w);
    w.enemies[0].alive = false;
    tick(w, 0.1);
    expect(w.hazards.some((h) => h.alive && h.kind === 'breath')).toBe(false);
  });

  it('rage の行では攻撃の間が短くなる', () => {
    for (const rage of [1, 2]) {
      const w = arena(rage);
      sweepNow(w);
      tick(w, STAG.warn + STAG.time + 0.1);
      const e = w.enemies[0];
      expect(e.state).toBe(0);
      expect(e.cd).toBeLessThan(STAG.every / rage);
      expect(e.cd).toBeGreaterThan(STAG.every / rage - 0.3);
    }
  });
});
