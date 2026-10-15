import { describe, expect, it } from 'vitest';
import { moveBoss, updateHazards } from './bosses';
import { STAG, WITCH } from './bosses-grove';
import { inFan } from './bosses-snow';
import { ENEMIES } from './enemies';
import { addHero, createWorld, makeEnemy, step, type World } from './world';

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

function witchArena(rage?: number): World {
  const w = arena();
  w.enemies[0] = makeEnemy(rage ? { ...ENEMIES.witch, rage } : ENEMIES.witch, 120, 0, 1e6);
  return w;
}

const circles = (w: World) => w.hazards.filter((h) => h.alive && h.kind === 'slam');

/** 魔法陣の予告を出す直前（魔女が動き出してから魔法陣までの時間が過ぎる）にして、1 フレーム進める */
function circlesNow(w: World) {
  w.enemies[0].wait = WITCH.every;
  tick(w, 1 / 60);
  return circles(w);
}

describe('魔女', () => {
  it('女王グモの魔法の弾といたずら妖精の手下を出す', () => {
    const w = witchArena();
    let shots = 0;
    tick(w, 15, () => {
      shots = Math.max(shots, w.hazards.filter((h) => h.alive && h.kind === 'web' && h.art === 'spell').length);
    });
    expect(shots).toBeGreaterThan(0);
    expect(w.enemies.some((e) => e.alive && e.def.id === 'pixie')).toBe(true);
  });

  it('魔法陣は 0.4 秒ずつずれた 3 つの円を、動物のいる所と左右に置く', () => {
    const w = witchArena();
    w.player.x = 10;
    w.player.y = 0;
    const rings = circlesNow(w);
    expect(rings).toHaveLength(3);
    expect(rings.map((h) => Math.round(h.delay * 10) / 10)).toEqual([...WITCH.delays]);
    expect(rings.every((h) => h.owner === 0 && h.r === WITCH.r && h.dmg === WITCH.dmg)).toBe(true);
    expect([rings[0].x, rings[0].y]).toEqual([10, 0]);
    // 魔女から動物へ向かう線に直角の左右へ離れ、その線の上は円に掛からない
    expect(rings[1].x).toBeCloseTo(rings[2].x, 5);
    expect(rings[1].y).toBeCloseTo(-rings[2].y, 5);
    expect(Math.abs(rings[1].y)).toBeCloseTo(WITCH.gap, 5);
    expect(WITCH.gap).toBeGreaterThan(WITCH.r);
  });

  it('円は置いたときの場所から動かず、予告のあと円の中の自分にだけ当たる', () => {
    const w = witchArena();
    w.player.x = 10;
    w.player.y = 0;
    const rings = circlesNow(w);
    const [x, y] = [rings[0].x, rings[0].y];
    // 60 ドット離れた所では 1 つめの円に掛からない（左右の円は 1 つめより遅い）
    w.player.x = 10 - 60;
    const hurt = tick(w, WITCH.delays[0] + 0.1);
    expect(hurt).toEqual([]);
    expect([rings[0].x, rings[0].y]).toEqual([x, y]);
    w.player.x = x;
    w.player.y = y;
    w.player.invuln = 0;
    expect(tick(w, 0.2)).toEqual([]);
    w.player.x = rings[1].x;
    w.player.y = rings[1].y;
    expect(tick(w, 0.6)).toEqual([WITCH.dmg]);
  });

  it('魔法陣のあいだに魔女が倒されると、出ていない円は消える', () => {
    const w = witchArena();
    circlesNow(w);
    tick(w, 1.1);
    w.enemies[0].alive = false;
    tick(w, 0.1);
    // 1.0 秒の円はもう当たって残り火を出しているだけで、まだ出ていない 2 つが消える
    expect(circles(w).filter((h) => h.delay > 0)).toHaveLength(0);
  });

  it('魔法陣が終わると女王グモの動きへ戻り、rage の行では間が短くなる', () => {
    for (const rage of [1, 2]) {
      const w = witchArena(rage);
      const e = w.enemies[0];
      e.wait = WITCH.every / rage;
      tick(w, 1 / 60);
      expect(e.state).toBe(1);
      tick(w, WITCH.delays[2] + 0.1);
      expect(e.state).toBe(0);
      expect(e.wait).toBeLessThan(0.2);
      e.wait = WITCH.every / rage - 0.1;
      tick(w, 0.05);
      expect(e.state).toBe(0);
      tick(w, 0.1);
      expect(e.state).toBe(1);
    }
  });

  it('協力プレイでは、いちばん近い生きている動物のまわりに置く', () => {
    const w = createWorld('dog', 2, VIEW, {}, 'forest');
    addHero(w, 'cat');
    w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
    w.spawnAcc = [];
    w.heroes[0].player.x = 200;
    w.heroes[0].player.y = 0;
    w.heroes[1].player.x = -50;
    w.heroes[1].player.y = 30;
    w.enemies[0] = makeEnemy(ENEMIES.witch, 0, 0, 1e6);
    w.enemies[0].wait = WITCH.every;
    step(w, { x: 0, y: 0 }, 1 / 60);
    let rings = circles(w);
    expect(rings).toHaveLength(3);
    expect(Math.hypot(rings[0].x + 50, rings[0].y - 30)).toBeLessThan(10);

    // 近いほうが倒れていれば、遠いほうを狙う
    w.hazards.length = 0;
    w.heroes[1].down = true;
    w.enemies[0].state = 0;
    w.enemies[0].wait = WITCH.every;
    step(w, { x: 0, y: 0 }, 1 / 60);
    rings = circles(w);
    expect(rings).toHaveLength(3);
    expect(Math.hypot(rings[0].x - w.heroes[0].player.x, rings[0].y - w.heroes[0].player.y)).toBeLessThan(10);
  });
});
