import { describe, expect, it } from 'vitest';
import { apply, choices } from './choices';
import { openChest } from './chest';
import { walkClock } from './draw';
import { collect } from './drops';
import { ENEMIES } from './enemies';
import { glyphOf } from './font';
import { maxOf } from './passives';
import { startOvertime } from './overtime';
import { reward } from './rewards';
import { createWorld, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
function quiet(w: World) {
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.propCd = 9999;
  w.metalAt = -1;
  w.player.invuln = 9999;
  return w;
}

describe('空にいるボスを雷とツタが狙わない', () => {
  for (const id of ['thunder', 'vine']) {
    it(`${id} は空にいる大ワシしかいなければ撃たない`, () => {
      const w = quiet(createWorld('dog', 1, VIEW));
      w.weapons = [{ id, level: 1, cd: 0 }];
      const eagle = makeEnemy(ENEMIES.bigEagle, 40, 0, 999);
      eagle.state = 4;
      eagle.wait = 99;
      w.enemies.push(eagle);
      step(w, { x: 0, y: 0 }, 1 / 60);
      expect(w.effects.filter((e) => e.alive && (e.kind === 'bolt' || e.kind === 'vine'))).toHaveLength(0);
    });
  }
});

describe('肉が出ないお題の元気のみなもと', () => {
  const filled = (mods: 'noMeat'[]) => {
    const w = createWorld(
      'dog',
      1,
      VIEW,
      {},
      'forest',
      mods.length ? { challenge: { date: 'x', bonus: 0, mods } } : {}
    );
    w.weapons = ['woof', 'paw', 'howl', 'boomerang', 'feather', 'thunder'].map((id) => ({ id, level: 5, cd: 9 }));
    w.passives = ['heart', 'fang', 'drum', 'paws', 'fur', 'nose'].map((id) => ({ id, level: maxOf(id) }));
    return w;
  };

  it('肉が出ないときは全回復せず最大 HP +10 だけで、札もそう書く', () => {
    const w = filled(['noMeat']);
    const vigor = choices(w).find((c) => c.kind === 'vigor')!;
    w.player.hp = 10;
    apply(w, vigor);
    expect(w.player.hp).toBe(10);
    expect(reward('vigor', false).text).not.toContain('全回復');
    expect(reward('vigor').text).toContain('全回復');
  });

  it('ふつうの回は全回復する', () => {
    const w = filled([]);
    const vigor = choices(w).find((c) => c.kind === 'vigor')!;
    w.player.hp = 10;
    apply(w, vigor);
    expect(w.player.hp).toBe(w.stats.maxHp);
  });

  it('宝箱のごほうびも同じ', () => {
    const w = filled(['noMeat']);
    for (let i = 0; i < 40; i++) {
      w.chests = 1;
      for (const r of openChest(w)) if (r.kind === 'vigor') expect(r.heal).toBe(false);
    }
  });
});

describe('延長戦で浮かぶコインの数', () => {
  it('端数は切り捨てて、入る枚数より多く見せない', () => {
    const w = quiet(createWorld('dog', 1, VIEW));
    w.time = 600 - 1e-6;
    w.weapons = [];
    step(w, { x: 0, y: 0 }, 1 / 60);
    startOvertime(w);
    w.time = 660;
    w.events.length = 0;
    w.items.push({ alive: true, kind: 'pouch', x: w.player.x, y: w.player.y, pulled: true });
    collect(w, 1 / 60);
    expect(w.events.find((e) => e.type === 'coin')).toMatchObject({ value: 22 });
  });
});

describe('登場の札のあいだの歩く絵', () => {
  it('登場しているボスだけ歩く絵を進め、ほかのボスとふつうの敵は止める', () => {
    const boss = makeEnemy(ENEMIES.bear, 0, 0, 1);
    const other = makeEnemy(ENEMIES.knight, 0, 0, 1);
    const rat = makeEnemy(ENEMIES.rat, 0, 0, 1);
    boss.t = other.t = rat.t = 3;
    expect(walkClock(boss, true, 1.5)).toBe(4.5);
    expect(walkClock(other, false, 1.5)).toBe(3);
    expect(walkClock(rat, false, 1.5)).toBe(3);
  });
});

describe('Lv の字', () => {
  it('小文字の v は U とも V ともちがう形', () => {
    expect(glyphOf('v')).not.toBe(glyphOf('V'));
    expect(glyphOf('v')).not.toBe(glyphOf('U'));
    expect(glyphOf('L')).toBe(glyphOf('l'));
  });
});
