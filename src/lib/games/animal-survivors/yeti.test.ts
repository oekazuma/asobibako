import { describe, expect, it } from 'vitest';
import { moveBoss, updateHazards } from './bosses';
import { YETI } from './bosses-snow';
import { ENEMIES } from './enemies';
import { createWorld, damageEnemy, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };

function arena(): World {
  const w = createWorld('dog', 2, VIEW, {}, 'snow');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [], storms: [] };
  w.spawnAcc = [];
  w.weapons = [];
  w.metalAt = -1;
  w.propCd = 1e9;
  w.player.hp = w.stats.maxHp = 1e6;
  w.enemies[0] = makeEnemy(ENEMIES.yeti, 100, 0, 5000);
  return w;
}

const tick = (w: World, seconds: number) => {
  const hurt: number[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    moveBoss(w, 0, 1 / 60);
    updateHazards(w, 1 / 60);
    for (const e of w.events) if (e.type === 'hurt') hurt.push(e.dmg);
    w.events.length = 0;
  }
  return hurt;
};

describe('大雪男', () => {
  it('雪玉を自分へ転がし、転がるほど大きくなり、4 秒で溶ける', () => {
    const w = arena();
    w.player.y = 300;
    w.enemies[0].cd = 0;
    tick(w, 1 / 60);
    const ball = w.hazards.find((h) => h.alive && h.kind === 'ball')!;
    expect(ball).toBeDefined();
    expect(ball.vy).toBeGreaterThan(0);
    expect(ball.r).toBeCloseTo(YETI.ballR[0], 0);
    tick(w, 2);
    expect(ball.r).toBeGreaterThan(YETI.ballR[0] + 2);
    tick(w, 2.2);
    // 溶けた雪玉の枠は次の予告に使い回されるので、生きている雪玉が無いことで見る
    expect(w.hazards.some((h) => h.alive && h.kind === 'ball')).toBe(false);
  });

  it('雪玉に当たると痛い', () => {
    const w = arena();
    w.player.invuln = 0;
    w.enemies[0].cd = 0;
    expect(tick(w, 2.5)).toContain(YETI.ballDmg);
  });

  it('飛びかかりは自分のいた位置に 1 秒予告し、跳んでいるあいだは攻撃も体当たりも当たらない', () => {
    const w = arena();
    w.player.invuln = 1e9;
    const e = w.enemies[0];
    e.turn = 1;
    e.cd = 0;
    tick(w, 1 / 60);
    const mark = w.hazards.find((h) => h.alive && h.kind === 'pounce')!;
    expect([mark.x, mark.y]).toEqual([0, 0]);
    expect(mark.r).toBe(YETI.pounceR);
    const hp = e.hp;
    damageEnemy(w, 0, 999, 0, 0);
    expect(e.hp).toBe(hp);
    // 大雪男の真上に立っていても体当たりを受けない
    w.player.invuln = 0;
    w.player.x = e.x;
    w.player.y = e.y;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.events.some((o) => o.type === 'hurt')).toBe(false);
  });

  it('着地は予告の円の中だけが痛く、ちび雪だるまが 3 匹出る', () => {
    for (const [px, hit] of [
      [20, true],
      [YETI.pounceR + 10, false]
    ] as const) {
      const w = arena();
      const e = w.enemies[0];
      e.turn = 1;
      e.cd = 0;
      tick(w, 1 / 60);
      w.player.x = px;
      w.player.invuln = 0;
      const hurt = tick(w, YETI.pounceWarn + 0.1);
      expect(hurt.includes(YETI.pounceDmg)).toBe(hit);
      expect([Math.round(e.x), Math.round(e.y)]).toEqual([0, 0]);
      expect(w.enemies.filter((o) => o.alive && o.def.id === 'snowling')).toHaveLength(YETI.brood);
    }
  });

  it('予告のあいだに大雪男が倒れたら予告が消える', () => {
    const w = arena();
    const e = w.enemies[0];
    e.turn = 1;
    e.cd = 0;
    tick(w, 1 / 60);
    e.alive = false;
    w.player.invuln = 0;
    expect(tick(w, 1.5)).toEqual([]);
    expect(w.hazards.some((h) => h.alive && h.kind === 'pounce')).toBe(false);
  });

  it('雪玉と飛びかかりを交互に使う', () => {
    const w = arena();
    w.player.invuln = 1e9;
    const kinds: string[] = [];
    for (let i = 0; i < 60 * 20; i++) {
      const before = new Set(w.hazards.filter((h) => h.alive));
      tick(w, 1 / 60);
      for (const h of w.hazards) if (h.alive && !before.has(h)) kinds.push(h.kind);
      w.player.x = w.enemies[0].x - 80;
    }
    expect(kinds.slice(0, 4)).toEqual(['ball', 'pounce', 'ball', 'pounce']);
  });
});
