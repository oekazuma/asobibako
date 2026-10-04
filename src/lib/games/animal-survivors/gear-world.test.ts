import { describe, expect, it } from 'vitest';
import { openChest } from './chest';
import { ENEMIES } from './enemies';
import { addEnemy, createWorld, damageEnemy, hurtPlayer } from './world';

const VIEW = { w: 274, h: 394 };
const wear = (...gear: string[]) => createWorld('dog', 1, VIEW, {}, 'forest', { gear: gear as never });

describe('装備の能力', () => {
  it('能力は boost に、コインは greed に足す', () => {
    const plain = createWorld('dog', 1, VIEW);
    const w = wear('hachimaki:2', 'cat:2');
    expect(w.stats.might).toBeCloseTo(plain.stats.might + 0.125);
    expect(w.boost.might).toBeCloseTo(0.125);
    expect(w.greed).toBeCloseTo(plain.greed + 0.25);
    expect(w.worn).toEqual(['hachimaki:2', 'cat:2']);
  });

  it('お題の「店の強化なし」の日は装備も効かない', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', {
      gear: ['hachimaki:2'],
      challenge: { date: 'x', bonus: 0, mods: ['noShop', 'halfHp'] }
    });
    expect(w.boost.might ?? 0).toBe(0);
    expect(w.fx.bossDmg).toBe(0);
  });
});

describe('装備の効き目', () => {
  it('ハチマキはボスへの攻撃を強くし、ふつうの敵は変えない', () => {
    const w = wear('hachimaki:2');
    const boss = addEnemy(w, ENEMIES.bear, 50, 0)!;
    const mob = addEnemy(w, ENEMIES[w.stage.waves[0].enemy], -50, 0)!;
    boss.hp = mob.hp = 1000;
    damageEnemy(w, w.enemies.indexOf(boss), 100, 0, 0);
    damageEnemy(w, w.enemies.indexOf(mob), 100, 0, 0);
    expect(1000 - boss.hp).toBeCloseTo(130);
    expect(1000 - mob.hp).toBeCloseTo(100);
  });

  it('よろいはボスの攻撃を、甲羅は飛んでくる攻撃を軽くする', () => {
    const w = wear('knight:2', 'shell:2');
    w.stats.armor = 0;
    const hp = w.player.hp;
    hurtPlayer(w, 20, 'boss');
    expect(hp - w.player.hp).toBe(Math.round(20 * 0.7));
    w.player.hp = hp;
    hurtPlayer(w, 20, 'shot');
    expect(hp - w.player.hp).toBe(Math.round(20 * 0.7 * 0.5));
  });

  it('マントの伝説では溶岩で減らず、無敵にもならず、被弾も出さない', () => {
    const w = wear('cloak:2');
    const hp = w.player.hp;
    hurtPlayer(w, 12, 'lava');
    expect(w.player.hp).toBe(hp);
    expect(w.player.invuln).toBe(0);
    expect(w.events.some((e) => e.type === 'hurt')).toBe(false);
  });

  it('スカーフは当たったあとの無敵を延ばす', () => {
    const w = wear('scarf:2');
    hurtPlayer(w, 1);
    expect(w.player.invuln).toBeCloseTo(0.5 + 0.6);
  });

  it('羽根は店の復活のあとに 1 回だけ起き上がらせる', () => {
    const w = createWorld('dog', 1, VIEW, { revive: 1 }, 'forest', { gear: ['feather:2'] });
    w.stats.armor = 0;
    hurtPlayer(w, 1e9);
    expect(w.revives).toBe(0);
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe(null);
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp * 0.5));
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe('dead');
  });

  it('四つ葉は宝箱の中身が 1 つになる割合を減らす', () => {
    const plain = createWorld('dog', 1, VIEW);
    const w = wear('clover:2');
    plain.rand = w.rand = () => 0.7;
    plain.chests = w.chests = 1;
    expect(openChest(plain)).toHaveLength(1);
    expect(openChest(w)).toHaveLength(3);
  });

  it('ふくろうは育つ Lv を早める', async () => {
    const { gainXp, xpNeed } = await import('./drops');
    const w = wear('owl:2');
    let need = 0;
    for (let l = 1; l < 8; l++) need += xpNeed(l);
    gainXp(w, need / w.stats.growth + 0.01);
    expect(w.level).toBe(8);
    expect(w.form).toBe(1);
  });

  it('ゴーグルの伝説は会心のダメージを 1.5 倍にする', async () => {
    const { power } = await import('./arms');
    const w = wear('goggles:2');
    w.rand = () => 0;
    expect(power(w, 100).dmg).toBeCloseTo(100 * w.stats.might * 2 * 1.5);
  });
});
