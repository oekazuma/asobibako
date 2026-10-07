import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { HALVES, inHalf, linkName } from './link-halves';
import { fireLink, LINK_BOSS, LINK_INVULN } from './link';
import { addHero, createWorld, makeEnemy, type World } from './world';

const VIEW = { w: 260, h: 380 };

/** 2 匹を (0,0) と (20,0) に置いた、敵のいない World */
function pair(a: 'wolf' | 'dog' | 'cat' = 'wolf', b: 'wolf' | 'dog' | 'cat' = 'wolf'): World {
  const w = createWorld(a, 1, VIEW);
  addHero(w, b);
  w.stage = { ...w.stage, waves: [] };
  w.heroes[0].player.x = 0;
  w.heroes[0].player.y = 0;
  w.heroes[1].player.x = 20;
  w.heroes[1].player.y = 0;
  return w;
}

describe('半分の形', () => {
  it('10 匹ぶんの半分がある', () => {
    expect(Object.keys(HALVES).sort()).toEqual(
      ['bear', 'cat', 'chick', 'dog', 'drake', 'fox', 'panda', 'rabbit', 'tiger', 'wolf'].sort()
    );
  });

  it('輪は半径と敵の大きさまで、帯は向きと長さと幅の中、扇は開きの中だけ当たる', () => {
    expect(inHalf({ kind: 'ring', r: 100 }, 0, 0, 0, 105, 0, 8)).toBe(true);
    expect(inHalf({ kind: 'ring', r: 100 }, 0, 0, 0, 120, 0, 8)).toBe(false);
    const beam = { kind: 'beams' as const, angles: [0], len: 200, width: 20 };
    expect(inHalf(beam, 0, 0, 0, 150, 5, 4)).toBe(true);
    expect(inHalf(beam, 0, 0, 0, 150, 30, 4)).toBe(false);
    expect(inHalf(beam, 0, 0, Math.PI / 2, 0, 150, 4)).toBe(true);
    expect(inHalf(beam, 0, 0, 0, -50, 0, 4)).toBe(false);
    const cone = { kind: 'cone' as const, spread: Math.PI / 2, len: 200 };
    expect(inHalf(cone, 0, 0, 0, 100, 30, 4)).toBe(true);
    expect(inHalf(cone, 0, 0, 0, 0, 100, 4)).toBe(false);
  });

  it('名前は 2 つの半分を並べ、同じ動物どうしはダブル', () => {
    expect(linkName('wolf', 'cat')).toBe(`${HALVES.wolf.name} × ${HALVES.cat.name}`);
    expect(linkName('dog', 'dog')).toBe(`ダブル${HALVES.dog.name}`);
  });
});

describe('技の当たり', () => {
  it('当たったふつうの敵とヌシは倒れ、外の敵は残る', () => {
    const w = pair();
    w.enemies.push(
      makeEnemy(ENEMIES.croc, 100, 0, 9999),
      makeEnemy({ ...ENEMIES.boar, chief: true }, -60, 40, 99999),
      makeEnemy(ENEMIES.croc, 600, 0, 50)
    );
    fireLink(w);
    expect(w.enemies.map((e) => e.alive)).toEqual([false, false, true]);
  });

  it('ボスは 2 匹の半分が両方当たっても、最大 HP の 1 割だけ減る', () => {
    const w = pair();
    const max = 1000;
    w.enemies.push(makeEnemy({ ...ENEMIES.bear, hp: max }, 40, 0, max));
    fireLink(w);
    expect(w.enemies[0].hp).toBeCloseTo(max * (1 - LINK_BOSS));
  });

  it('大ヘビの体の節をいくつ巻き込んでも、頭の体力は 1 割だけ減る', () => {
    const w = pair();
    const max = 2000;
    w.enemies.push(makeEnemy({ ...ENEMIES.bigSnake, hp: max }, 30, 0, max));
    for (let k = 1; k <= 5; k++) {
      const seg = makeEnemy(ENEMIES.snakeSeg, 30 + k * 10, 0, 1);
      seg.turn = 0;
      w.enemies.push(seg);
    }
    fireLink(w);
    expect(w.enemies[0].hp).toBeCloseTo(max * (1 - LINK_BOSS));
  });

  it('出したあと、2 匹とも 2 秒は攻撃が当たらず、絵が 2 つ出る', () => {
    const w = pair('dog', 'cat');
    fireLink(w);
    for (const h of w.heroes) expect(h.player.invuln).toBeGreaterThanOrEqual(LINK_INVULN);
    expect(w.link.shows.map((s) => s.animal)).toEqual(['dog', 'cat']);
  });

  it('倒れている動物の半分は出ない', () => {
    const w = pair('dog', 'cat');
    w.heroes[1].down = true;
    fireLink(w);
    expect(w.link.shows.map((s) => s.animal)).toEqual(['dog']);
  });
});
