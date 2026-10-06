import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { heroOf, PART_B, SLOT_COUNT, weaponAt } from './heroes';
import { addHero, createWorld, makeEnemy, ZONE_HIT } from './world';
import { fire, hits } from './arms';
import { partDef, WEAPONS } from './weapons';
import { partsOf, unitable, unite, UNIONS } from './unions';
import { step } from './world';
import { openChest } from './chest';
import { choices } from './choices';
import { ACHIEVEMENTS } from './achievements';
import { emptyRecords } from './records';

const VIEW = { w: 260, h: 380 };

describe('合体武器の枠の番号', () => {
  it('2 つめの部品の番号は、1 つめと同じ動物と枠を指す', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.heroes[1].weapons.push({ id: 'howl', level: 1, cd: 0 });
    for (const slot of [0, 1, 7]) {
      expect(heroOf(slot + PART_B)).toBe(heroOf(slot));
      expect(weaponAt(w, slot + PART_B)).toBe(weaponAt(w, slot));
    }
    expect(PART_B).toBe(SLOT_COUNT);
  });

  it('当たりの時計は、2 つめの部品と炎・ツタのぶんまで分かれている', () => {
    const e = makeEnemy(ENEMIES.caterpillar, 0, 0, 10);
    expect(ZONE_HIT).toBe(SLOT_COUNT * 2);
    expect(e.hit).toHaveLength(ZONE_HIT * 2);
  });
});

const quiet = () => {
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], chiefs: [], events: [] };
  w.metalAt = -1;
  w.propCd = 1e9;
  return w;
};

describe('まとめる決まり', () => {
  it('6 組で、ふつうの 12 種の武器が 1 つずつ入り、動物だけの武器は入らない', () => {
    const all = UNIONS.flatMap((u) => u.parts).sort();
    expect(UNIONS).toHaveLength(6);
    expect(new Set(all).size).toBe(12);
    for (const id of all) expect(WEAPONS[id].exclusive).toBeFalsy();
    for (const u of UNIONS) expect(partsOf(u.to)).toEqual(u.parts);
  });

  it('2 つとも Lv5 ならまとめられ、片方が Lv4 ならまとめられない', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howl', level: 5, cd: 0 },
      { id: 'thunder', level: 4, cd: 0 }
    ];
    expect(unitable(w)).toBeUndefined();
    w.weapons[1].level = 5;
    expect(unitable(w)?.to).toBe('howlUn');
  });

  it('進化形もまとめられるが、専用進化形はまとめない', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howlEvo', level: 5, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 }
    ];
    expect(unitable(w)?.to).toBe('howlUn');
    w.weapons[0].id = 'howlSp';
    expect(unitable(w)).toBeUndefined();
  });

  it('まとめると 1 つめの枠に入り、2 つめの枠は空き、うしろの武器が詰まる', () => {
    const w = quiet();
    w.weapons = [
      { id: 'woof', level: 3, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 },
      { id: 'fish', level: 2, cd: 0 },
      { id: 'howl', level: 5, cd: 0 }
    ];
    unite(w, unitable(w)!);
    expect(w.weapons.map((o) => o.id)).toEqual(['woof', 'howlUn', 'fish']);
    expect(w.weapons[1].level).toBe(5);
    expect(w.evolvedNow).toContain('howlUn');
  });

  it('まとめた枠の弾と効果は消え、うしろの枠の弾と効果は番号が 1 つ詰まる', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howl', level: 5, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 },
      { id: 'fish', level: 2, cd: 0 }
    ];
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 40, 0, 1e9));
    fire(w, 1);
    const fishShots = () => w.shots.filter((o) => o.alive && o.slot % 6 === 2).length;
    expect(fishShots()).toBeGreaterThan(0);
    unite(w, unitable(w)!);
    expect(w.shots.filter((o) => o.alive && o.slot % 6 === 1).length).toBeGreaterThan(0);
    expect(w.shots.some((o) => o.alive && o.slot % 6 === 2)).toBe(false);
    expect(w.effects.some((f) => f.alive && f.slot % 6 === 0)).toBe(false);
  });

  it('部品は元の武器の進化形を写し、ダメージだけ 1.15 倍', () => {
    const d = WEAPONS.howlUn;
    expect(partDef(d, 0).kind).toBe('ring');
    expect(partDef(d, 1).kind).toBe('strike');
    expect(partDef(d, 0).base.damage).toBeCloseTo(WEAPONS.howlEvo.base.damage * 1.15);
    expect(partDef(d, 1).base.cooldown).toBe(WEAPONS.thunderEvo.base.cooldown);
  });
});

describe('合体武器を撃つ', () => {
  it('1 つの枠から 2 つの部品の攻撃が出て、2 つめは PART_B を足した番号になる', () => {
    const w = quiet();
    w.weapons = [{ id: 'howlUn', level: 5, cd: 0, cd2: 0 }];
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30, 0, 1e9));
    w.grid.clear();
    w.enemies.forEach((e, i) => w.grid.add(i, e.x, e.y));
    fire(w, 1 / 60);
    expect(w.effects.some((f) => f.alive && f.kind === 'ring' && f.slot === 0)).toBe(true);
    expect(w.effects.some((f) => f.alive && f.kind === 'bolt' && f.slot === PART_B)).toBe(true);
    expect(w.weapons[0].cd).toBeGreaterThan(0);
    expect(w.weapons[0].cd2).toBeGreaterThan(0);
  });

  it('2 つの部品の待ち時間は別々に進む', () => {
    const w = quiet();
    w.weapons = [{ id: 'howlUn', level: 5, cd: 5, cd2: 0 }];
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30, 0, 1e9));
    fire(w, 1 / 60);
    expect(w.effects.some((f) => f.alive && f.kind === 'ring')).toBe(false);
    expect(w.effects.some((f) => f.alive && f.kind === 'bolt')).toBe(true);
  });

  it('合体武器を持って 30 秒遊んでも落ちない', () => {
    const w = quiet();
    w.stage = createWorld('dog', 1, VIEW).stage;
    w.weapons = Object.values(UNIONS).map((u) => ({ id: u.to, level: 5, cd: 0, cd2: 0 }));
    w.stats.maxHp = w.player.hp = 1e9;
    for (let i = 0; i < 900; i++) step(w, { x: Math.cos(i / 40), y: Math.sin(i / 40) }, 1 / 30);
    expect(w.kills).toBeGreaterThan(0);
  });
});

function arena(id: string, foes: [number, number][]) {
  const w = quiet();
  w.weapons = [{ id, level: 5, cd: 0, cd2: 99 }];
  for (const [x, y] of foes) w.enemies.push(makeEnemy(ENEMIES.caterpillar, x, y, 1e9));
  const tick = (n: number) => {
    for (let i = 0; i < n; i++) {
      w.grid.clear();
      w.enemies.forEach((e, k) => e.alive && w.grid.add(k, e.x, e.y));
      fire(w, 1 / 30);
      hits(w, 1 / 30);
      w.time += 1 / 30;
    }
  };
  return { w, tick };
}

describe('合わせ技', () => {
  it('雷鳴の遠吠え: 輪を出すと、輪の中の敵へ雷が落ちる（雷撃の部品は待ち時間中でも）', () => {
    const { w, tick } = arena('howlUn', [
      [20, 0],
      [-30, 10]
    ]);
    tick(1);
    expect(w.effects.filter((f) => f.alive && f.kind === 'bolt' && f.slot === PART_B).length).toBeGreaterThan(0);
  });

  it('芽吹きの森: どんぐりが当たった敵の足もとにツタが生える', () => {
    const { w, tick } = arena('acornUn', [[25, -6]]);
    tick(20);
    expect(w.effects.some((f) => f.alive && f.kind === 'vine' && f.slot === PART_B)).toBe(true);
  });

  it('炎の疾走: 分身が駆け抜けた道に炎が並ぶ', () => {
    const { w, tick } = arena('flameUn', [[120, 0]]);
    tick(15);
    expect(w.effects.filter((f) => f.alive && f.kind === 'flame' && f.slot === PART_B).length).toBeGreaterThan(2);
  });

  it('しびれ爪: 引っかいた敵が動けなくなり、ボスは止めない', () => {
    const { w, tick } = arena('pawUn', [[14, -6]]);
    const boss = makeEnemy(ENEMIES.bear, -14, -6, 1e9);
    w.enemies.push(boss);
    tick(2);
    expect(w.enemies[0].root).toBeGreaterThan(0);
    expect(boss.root).toBeLessThanOrEqual(0);
  });

  it('骨の魚群: 魚が弾けると、骨が 4 本その場所から飛ぶ', () => {
    const { w, tick } = arena('woofUn', [[60, 0]]);
    w.weapons[0] = { id: 'woofUn', level: 5, cd: 99, cd2: 0 };
    let bones = 0;
    for (let i = 0; i < 60 && bones < 4; i++) {
      tick(1);
      bones = w.shots.filter((o) => o.alive && o.kind === 'shot' && o.slot === 0).length;
    }
    expect(bones).toBeGreaterThanOrEqual(4);
  });

  it('風のブーメラン: 戻ったブーメランが自分のまわりを回る', () => {
    const { w, tick } = arena('featherUn', [[50, 0]]);
    let circled = false;
    for (let i = 0; i < 120 && !circled; i++) {
      tick(1);
      circled = w.shots.some((o) => o.alive && o.kind === 'orbit' && o.slot === 0);
    }
    expect(circled).toBe(true);
  });
});

describe('宝箱と 3 択', () => {
  it('組がそろって宝箱を開けると、中身の 1 つがまとめになる', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howl', level: 5, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 }
    ];
    w.chests = 1;
    const got = openChest(w);
    expect(got[0]).toEqual({ kind: 'union', parts: ['howl', 'thunder'], id: 'howlUn' });
    expect(w.weapons.map((o) => o.id)).toEqual(['howlUn']);
  });

  it('進化とまとめが両方できるときは進化が先で、中身が 3 つ以上ならまとめも同じ宝箱で起きる', () => {
    const w = quiet();
    w.weapons = [
      { id: 'howl', level: 5, cd: 0 },
      { id: 'thunder', level: 5, cd: 0 }
    ];
    w.passives = [{ id: 'roar', level: 1 }];
    w.chests = 1;
    // 宝箱の中身が 1 つになる割合から引くので、1 にすると必ず 3 つ以上
    w.fx.chest = 1;
    const got = openChest(w);
    expect(got[0]).toEqual({ kind: 'evolve', from: 'howl', id: 'howlEvo' });
    expect(got[1]).toEqual({ kind: 'union', parts: ['howl', 'thunder'], id: 'howlUn' });
  });

  it('まとめたあと、元の武器は 3 択に新しい武器として出ない', () => {
    const w = quiet();
    w.weapons = [{ id: 'howlUn', level: 5, cd: 0, cd2: 0 }];
    for (let i = 0; i < 50; i++) {
      const ids = choices(w).map((c) => ('id' in c ? c.id : ''));
      expect(ids).not.toContain('howl');
      expect(ids).not.toContain('thunder');
    }
  });

  it('専用進化より先に最初の武器をまとめた回は、専用進化が起きない', () => {
    const w = quiet();
    w.form = 2;
    w.weapons = [
      { id: 'woof', level: 5, cd: 0 },
      { id: 'fish', level: 5, cd: 0 }
    ];
    unite(w, unitable(w)!);
    w.chests = 1;
    openChest(w);
    expect(w.weapons.some((o) => o.id === 'woofSp')).toBe(false);
  });

  it('はじめての合体と 6 種すべての合体の実績がある', () => {
    const r = emptyRecords();
    const one = ACHIEVEMENTS.find((a) => a.id === 'union1')!;
    const all = ACHIEVEMENTS.find((a) => a.id === 'unionAll')!;
    expect(one.done(r, undefined as never)).toBe(false);
    r.evolved.push('howlUn');
    expect(one.done(r, undefined as never)).toBe(true);
    expect(all.done(r, undefined as never)).toBe(false);
    r.evolved.push(...UNIONS.map((u) => u.to));
    expect(all.done(r, undefined as never)).toBe(true);
  });
});
