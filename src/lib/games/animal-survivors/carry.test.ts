import { describe, expect, it } from 'vitest';
import { ALTAR_R, CARRY_COINS, CARRY_LIFE, CARRY_REACH, CARRY_TEXT, startCarry, stepCarry } from './carry';
import { openChest } from './chest';
import { startEvent } from './events';
import { obstacleAt, SHAPES, SQUASH } from './obstacles';
import { addHero, createWorld, step, type World } from './world';

const VIEW = { w: 260, h: 380 };
const TREASURE = { at: 0, kind: 'treasure' as const, enemy: '', count: 0, text: '宝の地図' };

function duo(): World {
  const w = createWorld('dog', 3, VIEW);
  addHero(w, 'cat');
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  return w;
}

/** 宝箱のそばに 2 匹を置く */
function hold(w: World, dx = 10) {
  const c = w.carry!;
  w.heroes[0].player.x = c.x - dx;
  w.heroes[0].player.y = c.y;
  w.heroes[1].player.x = c.x + dx;
  w.heroes[1].player.y = c.y;
}

describe('重い宝箱の出方', () => {
  it('1 匹のときは宝の地図のまま', () => {
    const w = createWorld('dog', 3, VIEW);
    expect(startEvent(w, TREASURE)).toBeUndefined();
    expect(w.treasure).not.toBeNull();
    expect(w.carry).toBeNull();
  });

  it('2 匹のときは重い宝箱になり、宝の地図の宝箱は出ず、帯の文が変わる', () => {
    const w = duo();
    expect(startEvent(w, TREASURE)).toBe(CARRY_TEXT);
    expect(w.treasure).toBeNull();
    const c = w.carry!;
    const mx = (w.heroes[0].player.x + w.heroes[1].player.x) / 2;
    const my = (w.heroes[0].player.y + w.heroes[1].player.y) / 2;
    const d = Math.hypot(c.x - mx, c.y - my);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(175);
    const a = Math.hypot(c.ax - c.x, c.ay - c.y);
    expect(a).toBeGreaterThan(235);
    expect(a).toBeLessThan(315);
    expect(c.life).toBe(CARRY_LIFE);
  });
});

describe('運び方', () => {
  it('2 匹がそばにいるときだけ、2 匹のまん中へ向かって動く', () => {
    const w = duo();
    startCarry(w);
    const c = w.carry!;
    hold(w);
    w.heroes[0].player.y = w.heroes[1].player.y = c.y - 20;
    const y0 = c.y;
    stepCarry(w, 0.1);
    expect(c.y).toBeLessThan(y0);
    expect(c.near).toEqual([true, true]);
    w.heroes[1].player.x = c.x + CARRY_REACH + 20;
    const y1 = c.y;
    stepCarry(w, 0.1);
    expect(c.y).toBe(y1);
    expect(c.near).toEqual([true, false]);
  });

  it('片方が倒れていると動かない', () => {
    const w = duo();
    startCarry(w);
    const c = w.carry!;
    hold(w);
    w.heroes[0].player.y = w.heroes[1].player.y = c.y - 20;
    w.heroes[1].down = true;
    const y0 = c.y;
    stepCarry(w, 0.1);
    expect(c.y).toBe(y0);
  });

  it('祭壇に届くと、2 匹とも中身 3 つの宝箱をもらい、コインが入る（片方が倒れていても）', () => {
    const w = duo();
    startCarry(w);
    const c = w.carry!;
    c.x = c.ax + ALTAR_R / 2;
    c.y = c.ay;
    hold(w);
    w.heroes[1].down = true;
    const coins = w.coins;
    stepCarry(w, 0.01);
    expect(w.carry).toBeNull();
    expect(w.heroes.map((h) => h.chests)).toEqual([1, 1]);
    expect(w.heroes.map((h) => h.big)).toEqual([1, 1]);
    expect(w.coins - coins).toBe(CARRY_COINS);
  });

  it('中身 3 つの数は宝箱 1 つぶんだけ効く', () => {
    const w = duo();
    w.big = 1;
    w.chests = 2;
    // 引いた割合が 5 つなら 5 つのまま（重い宝箱で減らさない）
    expect(openChest(w).length).toBeGreaterThanOrEqual(3);
    expect(w.big).toBe(0);
  });

  it('60 秒で沈んで消え、時計の品で止まっているあいだは減らない', () => {
    const w = duo();
    startCarry(w);
    w.freeze = 5;
    stepCarry(w, 1);
    expect(w.carry!.life).toBe(CARRY_LIFE);
    w.freeze = 0;
    w.carry!.life = 0.5;
    w.events.length = 0;
    stepCarry(w, 1);
    expect(w.carry).toBeNull();
    expect(w.events.some((e) => e.type === 'swarm' && e.text.includes('沈んで'))).toBe(true);
  });

  it('子が抜けたら動かず、そのまま時間で消える', () => {
    const w = duo();
    startCarry(w);
    hold(w);
    w.heroes[1].gone = w.heroes[1].down = true;
    const x0 = w.carry!.x;
    for (let i = 0; i < 10; i++) stepCarry(w, 0.1);
    expect(w.carry!.x).toBe(x0);
    stepCarry(w, CARRY_LIFE);
    expect(w.carry).toBeNull();
  });

  it('step の中で進む（3 択や宝箱を開けているあいだは止まる）', () => {
    const w = duo();
    startCarry(w);
    const life = w.carry!.life;
    step(w, { x: 0, y: 0 }, 0.5);
    expect(w.carry!.life).toBeCloseTo(life - 0.5);
    w.heroes[0].pending = 1;
    step(w, { x: 0, y: 0 }, 0.5);
    expect(w.carry!.life).toBeCloseTo(life - 0.5);
  });

  it('障害物に向かって運んでも、宝箱は障害物の中に入らない', () => {
    const w = duo();
    startCarry(w);
    const c = w.carry!;
    let o = null;
    for (let k = 1; !o; k++) o = obstacleAt(w.stage.art, k, 0);
    Object.assign(c, { x: o.x - 80, y: o.y });
    for (let i = 0; i < 200; i++) {
      w.heroes[0].player.x = w.heroes[1].player.x = c.x + 20;
      w.heroes[0].player.y = c.y - 5;
      w.heroes[1].player.y = c.y + 5;
      stepCarry(w, 1 / 30);
      const inside = SHAPES[o.kind].circles.some(
        ([dx, dy, r]) => Math.hypot(c.x - o.x - dx, (c.y - o.y - dy) / SQUASH) < r + 14 - 0.01
      );
      expect(inside).toBe(false);
    }
  });
});
