import { describe, expect, it } from 'vitest';
import { collect, dropLoot, RUSH } from './drops';
import { ENEMIES } from './enemies';
import { createWorld, damageEnemy, eliteOf, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };

function quiet(): World {
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.spawnAcc = [];
  w.weapons = [];
  w.metalAt = -1;
  return w;
}

describe('落ちる品の量', () => {
  it('ふつうの敵が肉を落とすのは 0.3% ほど', () => {
    const w = quiet();
    let meat = 0;
    for (let i = 0; i < 20000; i++) {
      w.items.length = 0;
      w.gems.length = 0;
      w.enemies[0] = makeEnemy(ENEMIES.rat, 0, 0, 1);
      damageEnemy(w, 0, 9, 0, 0);
      meat += w.items.filter((o) => o.kind === 'meat').length;
    }
    expect(meat / 20000).toBeGreaterThan(0.002);
    expect(meat / 20000).toBeLessThan(0.004);
  });

  it('ランタンの中身の肉は 2 割ほど', () => {
    const w = quiet();
    let meat = 0;
    for (let i = 0; i < 4000; i++) {
      w.items.length = 0;
      dropLoot(w, 0, 0);
      if (w.items[0].kind === 'meat') meat++;
    }
    expect(meat / 4000).toBeGreaterThan(0.16);
    expect(meat / 4000).toBeLessThan(0.24);
  });
});

describe('金の磁石', () => {
  const share = (luck: number) => {
    const w = quiet();
    w.stats.luck = luck;
    let n = 0;
    for (let i = 0; i < 8000; i++) {
      w.items.length = 0;
      dropLoot(w, 0, 0);
      if (w.items[0].kind === 'goldMagnet') n++;
    }
    return n / 8000;
  };

  it('ランタンから 3% ほど出て、運で出やすくなる', () => {
    expect(share(0)).toBeGreaterThan(0.02);
    expect(share(0)).toBeLessThan(0.045);
    expect(share(1)).toBeGreaterThan(share(0) * 1.5);
  });

  it('強化個体が 5% ほど落とす', () => {
    const w = quiet();
    let n = 0;
    for (let i = 0; i < 6000; i++) {
      w.items.length = 0;
      w.enemies[0] = makeEnemy(eliteOf(ENEMIES.rat), 0, 0, 1);
      damageEnemy(w, 0, 9, 0, 0);
      n += w.items.filter((o) => o.kind === 'goldMagnet').length;
    }
    expect(n / 6000).toBeGreaterThan(0.035);
    expect(n / 6000).toBeLessThan(0.065);
  });

  it('拾うと画面のコインが全部集まり、コインラッシュが始まる（経験値の玉は引き寄せない）', () => {
    const w = quiet();
    w.gems.push({ alive: true, x: 300, y: 0, value: 1, pulled: false });
    w.items.push(
      { alive: true, kind: 'coin', x: 200, y: 0, pulled: false },
      { alive: true, kind: 'purse', x: -200, y: 0, pulled: false },
      { alive: true, kind: 'pouch', x: 0, y: 200, pulled: false },
      { alive: true, kind: 'meat', x: 0, y: -200, pulled: false },
      { alive: true, kind: 'goldMagnet', x: 0, y: 4, pulled: true }
    );
    collect(w, 1 / 60);
    expect(w.items.slice(0, 4).map((o) => o.pulled)).toEqual([true, true, true, false]);
    expect(w.gems[0].pulled).toBe(false);
    expect(w.rush).toBe(RUSH);
    expect(w.events).toContainEqual({ type: 'rush' });
  });

  it('コインラッシュのあいだは倒した敵の 1 割がコインを落とし、勝手に集まる', () => {
    const w = quiet();
    w.rush = RUSH;
    let coins = 0;
    for (let i = 0; i < 4000; i++) {
      w.items.length = 0;
      w.enemies[0] = makeEnemy(ENEMIES.rat, 0, 0, 1);
      damageEnemy(w, 0, 9, 0, 0);
      const c = w.items.filter((o) => o.kind === 'coin');
      coins += c.length;
      expect(c.every((o) => o.pulled)).toBe(true);
    }
    // ふだんのコイン 3% に、ラッシュの 1 割が足される
    expect(coins / 4000).toBeGreaterThan(0.1);
    expect(coins / 4000).toBeLessThan(0.16);
  });

  it('コインラッシュはゲームの時間で 15 秒続き、3 択のあいだは減らない', () => {
    const w = quiet();
    w.propCd = 9999;
    w.player.invuln = 9999;
    w.rush = RUSH;
    w.pending = 1;
    for (let i = 0; i < 60 * 20; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.rush).toBe(RUSH);
    w.pending = 0;
    for (let i = 0; i < 60 * 14; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.rush).toBeGreaterThan(0);
    for (let i = 0; i < 60 * 2; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.rush).toBe(0);
  });
});
