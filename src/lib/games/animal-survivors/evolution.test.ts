import { describe, expect, it } from 'vitest';
import { openChest } from './chest';
import { choices } from './choices';
import { EVOLUTIONS, baseOf, evolvable } from './evolutions';
import { PASSIVES } from './passives';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { DRAIN, createWorld, damageEnemy, makeEnemy, step, summary } from './world';
import { ENEMIES } from './enemies';

const VIEW = { w: 260, h: 380 };

describe('進化の表', () => {
  it('12 組あり、武器はどれも 1 度だけ、数・時間・運のほかのパッシブはどれも 1 組以上で使う', () => {
    expect(EVOLUTIONS).toHaveLength(12);
    const base = Object.keys(WEAPONS).filter((id) => !WEAPONS[id].evolved);
    expect(EVOLUTIONS.map((e) => e.from).sort()).toEqual(base.sort());
    // 数・時間・運のパッシブは進化に使わない（武器 1 つにつき 1 組で 12 組が埋まっている）
    const own = Object.keys(PASSIVES).filter((id) => !['twin', 'tail', 'clover'].includes(id));
    for (const id of own) expect(EVOLUTIONS.some((e) => e.with === id)).toBe(true);
    for (const e of EVOLUTIONS) {
      expect(WEAPONS[e.to].evolved).toBe(true);
      expect(WEAPONS[e.to].kind).toBe(WEAPONS[e.from].kind);
      expect(WEAPONS[e.to].ups).toEqual([]);
      expect(baseOf(e.to)).toBe(e.from);
    }
    expect(baseOf('woof')).toBe('woof');
  });
});

describe('宝箱での進化', () => {
  function ready() {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [{ id: 'woof', level: MAX_LEVEL, cd: 0 }];
    w.passives = [{ id: 'fang', level: 1 }];
    return w;
  }

  it('Lv5 の武器と対のパッシブがあれば、宝箱の 1 つめで進化して同じ枠に入る', () => {
    const w = ready();
    expect(evolvable(w)?.to).toBe('woofEvo');
    w.chests = 1;
    const got = openChest(w);
    expect(got[0]).toEqual({ kind: 'evolve', from: 'woof', id: 'woofEvo' });
    expect(w.weapons[0]).toMatchObject({ id: 'woofEvo', level: MAX_LEVEL });
    expect(summary(w).evolved).toEqual(['woofEvo']);
    expect(w.events.some((e) => e.type === 'evolve')).toBe(true);
  });

  it('対のパッシブが無い・Lv5 でない武器は進化しない', () => {
    const w = ready();
    w.passives = [];
    expect(evolvable(w)).toBeUndefined();
    w.passives = [{ id: 'fang', level: 1 }];
    w.weapons[0].level = MAX_LEVEL - 1;
    expect(evolvable(w)).toBeUndefined();
  });

  it('進化できる武器が 2 つあれば、持っている順の最初の 1 つだけ', () => {
    const w = ready();
    w.weapons.push({ id: 'paw', level: MAX_LEVEL, cd: 0 });
    w.passives.push({ id: 'claw', level: 1 });
    w.chests = 1;
    openChest(w);
    expect(w.weapons.map((o) => o.id)).toEqual(['woofEvo', 'paw']);
    expect(evolvable(w)?.to).toBe('pawEvo');
  });

  it('進化形と、進化した元の武器は 3 択に出ない', () => {
    const w = ready();
    w.weapons[0].id = 'woofEvo';
    for (let i = 0; i < 40; i++)
      for (const c of choices(w)) {
        if (c.kind !== 'weapon') continue;
        expect(WEAPONS[c.id].evolved).toBeFalsy();
        expect(c.id).not.toBe('woof');
      }
  });

  it('進化に使う札には印が付く', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [{ id: 'woof', level: 2, cd: 0 }];
    w.passives = [];
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++)
      for (const c of choices(w)) if ((c.kind === 'passive' || c.kind === 'weapon') && c.evo) seen.add(c.id);
    expect([...seen]).toEqual(['fang']);
    w.passives = [{ id: 'fang', level: 1 }];
    const marks = new Set<string>();
    for (let i = 0; i < 60; i++)
      for (const c of choices(w)) if ((c.kind === 'passive' || c.kind === 'weapon') && c.evo) marks.add(c.id);
    expect(marks.has('woof')).toBe(true);
  });
});

describe('当たって回復', () => {
  it('drain のある武器で当てると HP が戻り、1 秒に最大 HP の 3% まで', () => {
    const w = createWorld('dog', 1, VIEW);
    w.player.hp = 10;
    for (let i = 0; i < 50; i++) w.enemies.push(makeEnemy(ENEMIES.rat, 10, 0, 999));
    for (let i = 0; i < 50; i++) damageEnemy(w, i, 1, 0, 0, false, 'pawEvo');
    expect(w.player.hp).toBeCloseTo(10 + w.stats.maxHp * DRAIN);
    w.stage = { ...w.stage, waves: [], bosses: [] };
    w.spawnAcc = [];
    w.weapons = [];
    w.enemies.length = 0;
    for (let i = 0; i < 60; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.drainLeft).toBeCloseTo(w.stats.maxHp * DRAIN);
  });

  it('drain の無い武器では戻らない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.player.hp = 10;
    w.enemies.push(makeEnemy(ENEMIES.rat, 10, 0, 999));
    damageEnemy(w, 0, 1, 0, 0, false, 'woof');
    expect(w.player.hp).toBe(10);
  });
});

describe('ダメージ表', () => {
  it('武器ごとにダメージ（残りの HP を越えない）と倒した数を数え、多い順に並べる', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 3; i++) w.enemies.push(makeEnemy(ENEMIES.rat, 10, 0, 10));
    damageEnemy(w, 0, 25, 0, 0, false, 'woof');
    damageEnemy(w, 1, 4, 0, 0, false, 'paw');
    damageEnemy(w, 2, 30, 0, 0, false, 'paw');
    expect(summary(w).dealt).toEqual([
      { id: 'paw', damage: 14, kills: 1 },
      { id: 'woof', damage: 10, kills: 1 }
    ]);
  });

  it('クリアの一掃はどの武器にも数えない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.enemies.push(makeEnemy(ENEMIES.rat, 10, 0, 10));
    w.time = w.stage.length;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(summary(w).dealt).toEqual([]);
  });
});
