import { describe, expect, it } from 'vitest';
import { limitStats, limitTotal, statsFor } from './limit';
import { MAX_LEVEL, WEAPONS, weaponStats } from './weapons';
import { fire, hits } from './arms';
import { openChest } from './chest';
import { apply, choices } from './choices';
import { ENEMIES } from './enemies';
import { maxOf } from './passives';
import { createWorld, makeEnemy, summary, type World } from './world';

describe('限界突破の能力', () => {
  it('ダメージ・待ち時間・大きさ・数はどの武器にも、速さは動く攻撃、時間は残る攻撃だけ', () => {
    expect(statsFor(WEAPONS.woof)).toEqual(['damage', 'cooldown', 'area', 'speed', 'amount']);
    expect(statsFor(WEAPONS.flame)).toEqual(['damage', 'cooldown', 'area', 'duration', 'amount']);
    expect(statsFor(WEAPONS.feather)).toEqual(['damage', 'cooldown', 'area', 'speed', 'duration', 'amount']);
    expect(statsFor(WEAPONS.howl)).toEqual(['damage', 'cooldown', 'area', 'amount']);
  });

  it('合体武器は 2 つの部品の種類から選ぶ', () => {
    // 炎の疾走はダッシュ（動く）と炎（残る）
    expect(statsFor(WEAPONS.flameUn)).toEqual(['damage', 'cooldown', 'area', 'speed', 'duration', 'amount']);
  });

  it('上げた回数を一定の幅で掛け、待ち時間は掛け算で縮む', () => {
    const s = weaponStats(WEAPONS.woof, 5);
    const t = limitStats(s, { damage: 3, cooldown: 2, area: 1, speed: 1, duration: 1, amount: 2 });
    expect(t.damage).toBeCloseTo(s.damage * 1.6);
    expect(t.cooldown).toBeCloseTo(s.cooldown * 0.93 ** 2);
    expect(t.area).toBeCloseTo(s.area * 1.1);
    expect(t.speed).toBeCloseTo(s.speed * 1.12);
    expect(t.duration).toBeCloseTo(s.duration * 1.12);
    expect(t.amount).toBe(s.amount + 2);
    expect(limitStats(s, undefined)).toEqual(s);
  });

  it('合計の回数', () => {
    expect(limitTotal({ damage: 3, amount: 2 })).toBe(5);
    expect(limitTotal(undefined)).toBe(0);
  });
});

const VIEW = { w: 260, h: 380 };

/** 武器もパッシブも全部埋まった World */
function full(weapons = ['woof', 'paw', 'howl', 'boomerang', 'acorn', 'dash']): World {
  const w = createWorld('dog', 1, VIEW);
  w.weapons = weapons.map((id) => ({ id, level: MAX_LEVEL, cd: 0 }));
  // 宝箱で先に進化が起きないよう、武器と対にならないパッシブで埋める
  w.passives = ['heart', 'drum', 'fur', 'nose', 'whisker', 'tail'].map((id) => ({ id, level: maxOf(id) }));
  // 武器 1 つの組でも枠が空いていないことにする（新しい武器の札を出さない）
  if (weapons.length < 6) w.mods.push('oneWeapon');
  return w;
}

describe('限界突破の札', () => {
  it('全部埋まると、3 択は持っている武器の限界突破と最大 HP の札だけになる', () => {
    const w = full();
    for (let i = 0; i < 50; i++)
      for (const c of choices(w)) {
        expect(['limit', 'vigor']).toContain(c.kind);
        if (c.kind === 'limit') expect(w.weapons.map((o) => o.id)).toContain(c.id);
      }
  });

  it('同じ 3 択に同じ武器の同じ能力は 2 枚出ない', () => {
    const w = full(['woof']);
    for (let i = 0; i < 50; i++) {
      const keys = choices(w).map((c) => (c.kind === 'limit' ? `${c.id}:${c.stat}` : c.kind));
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('数の札はほかの能力より出にくい', () => {
    const w = full();
    const count: Record<string, number> = {};
    for (let i = 0; i < 3000; i++)
      for (const c of choices(w)) if (c.kind === 'limit') count[c.stat] = (count[c.stat] ?? 0) + 1;
    expect(count.amount).toBeLessThan(count.damage * 0.5);
  });

  it('選ぶと、その武器のその能力の回数が 1 つ上がり、札には上げる前の回数が出る', () => {
    const w = full(['woof']);
    w.pending = 2;
    const pick = () => choices(w).find((c) => c.kind === 'limit' && c.stat === 'damage');
    // 札は乱数で決まるので、ダメージの札が出るまで引き直す（出ないまま 200 回なら落とす）
    let c = pick();
    for (let i = 0; i < 200 && !c; i++) c = pick();
    expect(c).toBeDefined();
    expect(c).toMatchObject({ id: 'woof', stat: 'damage', now: 0 });
    apply(w, c!);
    expect(w.weapons[0].limit?.damage).toBe(1);
    c = pick();
    for (let i = 0; i < 200 && !c; i++) c = pick();
    expect(c).toMatchObject({ now: 1 });
  });

  it('上げたダメージは撃った弾に効き、合体武器の 2 つめの部品にも効く', () => {
    const shotDamage = (limit?: { damage: number }) => {
      const w = full(['howlUn']);
      w.weapons[0] = { id: 'howlUn', level: MAX_LEVEL, cd: 0, cd2: 0, limit };
      w.enemies.push(makeEnemy(ENEMIES.caterpillar, 30, 0, 1e9));
      w.grid.clear();
      w.enemies.forEach((e, i) => w.grid.add(i, e.x, e.y));
      w.stats.crit = 0;
      fire(w, 1 / 60);
      hits(w, 1 / 60);
      return w.dealt.howlUn?.damage ?? 0;
    };
    expect(shotDamage({ damage: 5 })).toBeCloseTo(shotDamage() * 2, 0);
  });

  it('全部埋まった宝箱の中身も限界突破（か最大 HP）になる', () => {
    const w = full();
    w.chests = 1;
    for (const r of openChest(w)) expect(['limit', 'vigor']).toContain(r.kind);
  });

  it('攻撃 +5% とコイン +20 の札はもう出ない', () => {
    const w = full();
    for (let i = 0; i < 100; i++) for (const c of choices(w)) expect(['power', 'gold']).not.toContain(c.kind);
  });

  it('リザルトと一時停止のまとめに、武器ごとの上げた回数の合計が入る', () => {
    const w = full(['woof']);
    w.weapons[0].limit = { damage: 3, amount: 1 };
    expect(summary(w).weapons[0].lb).toBe(4);
  });
});
