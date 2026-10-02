import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { createWorld, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

/** ほかの敵とボスを出さず、武器を 1 つだけ持たせた世界 */
function only(weapon: string, level = 1): World {
  const w = createWorld('dog', 5, VIEW);
  w.weapons = weapon ? [{ id: weapon, level, cd: 0 }] : [];
  w.stage = { ...w.stage, waves: [], bosses: [] };
  w.spawnAcc = [];
  w.stats.crit = 0;
  w.player.hp = w.stats.maxHp = 1e6;
  return w;
}

const run = (w: World, seconds: number, input = still) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(w, input, 1 / 60);
};

/** 動かず吹き飛ばされない的 */
const target = (x: number, y: number) => makeEnemy({ ...ENEMIES.caterpillar, speed: 0, heavy: 1 }, x, y, 1000);

describe('新しい武器', () => {
  it('5 つともレベル 5 までの上げ幅を持つ', () => {
    for (const id of ['claw', 'dash', 'acorn', 'flame', 'vine']) expect(WEAPONS[id].ups).toHaveLength(MAX_LEVEL - 1);
  });

  it('爪は近い敵の側を裂く', () => {
    const w = only('claw');
    w.enemies.push(target(-20, 0));
    step(w, still, 1 / 60);
    expect(w.enemies[0].hp).toBe(992);
  });

  it('ダッシュは一直線に並んだ敵をまとめて貫き、同じ敵には 1 回だけ当たる', () => {
    const w = only('dash');
    w.enemies.push(target(30, 0), target(60, 0), target(90, 0));
    run(w, 0.6);
    expect(w.enemies.map((e) => e.hp)).toEqual([980, 980, 980]);
  });

  it('どんぐりは全方向に等間隔で 6 発出る', () => {
    const w = only('acorn');
    w.enemies.push(target(200, 0));
    step(w, still, 1 / 60);
    const angles = w.shots
      .filter((o) => o.alive)
      .map((o) => Math.atan2(o.vy, o.vx))
      .sort((a, b) => a - b);
    expect(angles).toHaveLength(6);
    for (let i = 1; i < angles.length; i++) expect(angles[i] - angles[i - 1]).toBeCloseTo(Math.PI / 3, 5);
  });
});
describe('炎とツタ', () => {
  it('炎は足もとに残り、上の敵を 0.5 秒ごとに削る（重なった炎でも 1 回）', () => {
    const w = only('flame');
    w.enemies.push(target(0, 0));
    run(w, 1.2);
    expect(w.enemies[0].hp).toBe(985);
    expect(w.effects.filter((f) => f.alive && f.kind === 'flame').length).toBeGreaterThan(1);
  });

  it('炎は歩いたあとに残り、時間がたつと消える', () => {
    const w = only('flame');
    run(w, 0.1);
    run(w, 1, { x: 1, y: 0 });
    expect(w.effects.some((f) => f.alive && f.kind === 'flame' && Math.abs(f.x) < 2)).toBe(true);
    run(w, 2.5, { x: 1, y: 0 });
    expect(w.effects.some((f) => f.alive && f.kind === 'flame' && Math.abs(f.x) < 2)).toBe(false);
  });

  it('ツタの中の敵は動けず、削られる', () => {
    const w = only('vine');
    const rat = makeEnemy(ENEMIES.rat, 100, 0, 1000);
    w.enemies.push(rat);
    run(w, 1);
    // 1 フレーム目は動いてからツタが生えるので、2 ドットまでは許す
    expect(Math.abs(rat.x - 100)).toBeLessThan(2);
    expect(rat.hp).toBeLessThan(1000);
  });

  it('ツタで足止めされた巨大ベアは動かないが、攻撃の時計は進む', () => {
    const w = only('vine');
    const bear = makeEnemy(ENEMIES.bear, 100, 0, 1e6);
    bear.cd = 0.5;
    w.enemies.push(bear);
    run(w, 1);
    expect(Math.abs(bear.x - 100)).toBeLessThan(2);
    expect(bear.state).not.toBe(0);
  });

  it('画面に敵がいなければ、ツタは撃たずに待つ', () => {
    const w = only('vine');
    run(w, 0.5);
    expect(w.effects.some((f) => f.alive && f.kind === 'vine')).toBe(false);
    expect(w.weapons[0].cd).toBeLessThan(1);
  });
});
