import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { HALVES, inHalf, linkName } from './link-halves';
import {
  fireLink,
  LINK_BASE,
  LINK_BOSS,
  LINK_COOL,
  LINK_FUSE,
  LINK_GROW,
  LINK_INVULN,
  LINK_WINDOW,
  linkReady,
  linkState,
  pressLink
} from './link';
import { addHero, createWorld, damageEnemy, makeEnemy, step, type World } from './world';

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

/** i 番の敵を 1 体倒す */
function kill(w: World, def = ENEMIES.caterpillar): void {
  w.enemies.push(makeEnemy(def, 500, 500, 1));
  damageEnemy(w, w.enemies.length - 1, 99, 0, 0);
}

/** ゲージを満たす */
function fill(w: World): void {
  w.link.charge = w.link.need;
}

describe('ゲージ', () => {
  it('2 匹が近いときに倒した敵だけでたまり、ヌシとボスは多めに入る', () => {
    const w = pair();
    kill(w);
    expect(w.link.charge).toBe(1);
    w.heroes[1].player.x = 200;
    kill(w);
    expect(w.link.charge).toBe(1);
    w.heroes[1].player.x = 20;
    kill(w, { ...ENEMIES.boar, chief: true });
    const chief = w.link.charge - 1;
    kill(w, { ...ENEMIES.bear, hp: 1 });
    const boss = w.link.charge - 1 - chief;
    expect(chief).toBeGreaterThan(1);
    expect(boss).toBeGreaterThan(chief);
  });

  it('1 匹のとき、片方が倒れているとき、抜けたときはたまらない', () => {
    const solo = createWorld('dog', 1, VIEW);
    kill(solo);
    expect(solo.link.charge).toBe(0);
    const w = pair();
    w.heroes[1].down = true;
    kill(w);
    w.heroes[1].down = false;
    w.heroes[1].gone = true;
    kill(w);
    expect(w.link.charge).toBe(0);
  });

  it('要る量を超えてはたまらない', () => {
    const w = pair();
    w.link.charge = w.link.need - 1;
    kill(w, { ...ENEMIES.bear, hp: 1 });
    expect(w.link.charge).toBe(w.link.need);
  });
});

describe('せーの', () => {
  it('満タンでないと押せず、1 匹のときもボタンは出ない', () => {
    const w = pair();
    expect(linkState(w, 0)).toBe('none');
    expect(pressLink(w, 0)).toBe(false);
    const solo = createWorld('dog', 1, VIEW);
    solo.link.charge = solo.link.need;
    expect(linkReady(solo)).toBe(false);
  });

  it('先に押した人は待っていて、相手には相棒が押したと出る', () => {
    const w = pair();
    fill(w);
    expect(linkState(w, 0)).toBe('ready');
    pressLink(w, 0);
    expect(linkState(w, 0)).toBe('waiting');
    expect(linkState(w, 1)).toBe('partner');
  });

  it('1.5 秒以内にそろうと 1 秒止めてから技が出て、要る量が増え、45 秒は使えない', () => {
    const w = pair();
    w.enemies.push(makeEnemy(ENEMIES.croc, 60, 0, 9999));
    fill(w);
    pressLink(w, 0);
    w.time += LINK_WINDOW - 0.1;
    expect(pressLink(w, 1)).toBe(true);
    const t0 = w.time;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.events.some((e) => e.type === 'link')).toBe(true);
    for (let i = 0; i < 30; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.time).toBe(t0);
    expect(w.enemies[0].alive).toBe(true);
    for (let i = 0; i < 40; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.enemies[0].alive).toBe(false);
    expect(w.link.need).toBe(Math.round(LINK_BASE * LINK_GROW));
    fill(w);
    expect(linkReady(w)).toBe(false);
    w.link.cool = 0;
    expect(linkReady(w)).toBe(true);
    expect(LINK_COOL).toBeGreaterThanOrEqual(45);
    expect(LINK_FUSE).toBe(1);
  });

  it('間に合わなければ出ず、満タンのまま押し直せる', () => {
    const w = pair();
    fill(w);
    pressLink(w, 0);
    w.time += LINK_WINDOW + 0.1;
    pressLink(w, 1);
    expect(w.link.armed).toBe(false);
    expect(linkState(w, 0)).toBe('partner');
    expect(pressLink(w, 0)).toBe(true);
    expect(w.link.armed).toBe(true);
  });

  it('技で倒した敵ではたまらない', () => {
    const w = pair();
    for (let k = 0; k < 20; k++) w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30 + k, 0, 50));
    fill(w);
    pressLink(w, 0);
    pressLink(w, 1);
    for (let i = 0; i < 80; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.enemies.every((e) => !e.alive)).toBe(true);
    expect(w.link.charge).toBe(0);
  });

  it('止めているあいだにもう一度押しても 2 回は出ない', () => {
    const w = pair();
    fill(w);
    pressLink(w, 0);
    pressLink(w, 1);
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(pressLink(w, 0)).toBe(false);
    expect(pressLink(w, 1)).toBe(false);
    for (let i = 0; i < 80; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.link.uses).toBe(1);
    expect(w.link.shows.length).toBeLessThanOrEqual(2);
  });

  it('片方が押したあとに相棒が倒れたらボタンは消え、起き上がったあとに古い押しでは出ない', () => {
    const w = pair();
    fill(w);
    pressLink(w, 0);
    w.heroes[1].down = true;
    expect(linkState(w, 0)).toBe('none');
    expect(linkState(w, 1)).toBe('none');
    w.time += LINK_WINDOW + 1;
    w.heroes[1].down = false;
    pressLink(w, 1);
    expect(w.link.armed).toBe(false);
  });
});

describe('終わったあと', () => {
  it('決着したあとは満タンでも押せない（届くのが遅れた子の押しでゲージを失わない）', () => {
    const w = pair();
    fill(w);
    w.over = 'clear';
    expect(linkReady(w)).toBe(false);
    expect(pressLink(w, 1)).toBe(false);
    expect(w.link.charge).toBe(w.link.need);
  });
});
