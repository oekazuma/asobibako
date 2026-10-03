import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { emptyRecords, parseRecords } from './records';
import { choices } from './choices';
import { ENEMIES } from './enemies';
import { trySpecial } from './specials';
import { createWorld, hurtPlayer, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };

describe('火の鳥のひな', () => {
  it('最強の段で、火の羽根を持ち、火山のクリアで仲間になる', () => {
    const a = animal('chick');
    expect(a.tier).toBe(4);
    expect(a.forms).toEqual(['火の鳥のひな', '炎の若鳥', '火の鳥']);
    expect(a.weapon).toBe('fireFeather');
    expect(ACHIEVEMENTS.find((d) => d.id === 'volcanoClear')?.animal).toBe('chick');
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['volcanoClear'] }));
    expect(r.unlocked).toContain('chick');
  });

  it('倒れると一度だけ HP 半分でよみがえり、店の復活はそのあとに残る', () => {
    const w = createWorld('chick', 1, VIEW, { revive: 1 });
    w.stats.armor = 0;
    expect(w.rebirths).toBe(1);
    hurtPlayer(w, 1e9);
    expect(w.over).toBe(null);
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp / 2));
    expect(w.player.invuln).toBeGreaterThanOrEqual(2);
    expect(w.rebirths).toBe(0);
    expect(w.revives).toBe(1);
    expect(w.events.some((e) => e.type === 'swarm' && e.text === 'よみがえった！')).toBe(true);
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe(null);
    expect(w.revives).toBe(0);
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe('dead');
  });

  it('お題の HP 半分でも、その回の最大 HP の半分で戻る', () => {
    const w = createWorld('chick', 1, VIEW, {}, 'forest', { challenge: { date: 'x', bonus: 0, mods: ['halfHp'] } });
    hurtPlayer(w, 1e9);
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp / 2));
  });

  it('ほかの動物はよみがえらない', () => {
    const w = createWorld('drake', 1, VIEW);
    expect(w.rebirths).toBe(0);
    hurtPlayer(w, 1e9);
    expect(w.over).toBe('dead');
  });
});

describe('火の羽根', () => {
  const quiet = (id: 'chick' | 'dog', mods: 'oneWeapon'[] = []) => {
    const w = createWorld(id, 1, VIEW, {}, 'forest', mods.length ? { challenge: { date: 'x', bonus: 0, mods } } : {});
    w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
    w.propCd = 9999;
    w.metalAt = -1;
    w.player.invuln = 9999;
    return w;
  };

  it('ほかの動物の 3 択には出ない', () => {
    const w = quiet('dog');
    for (let i = 0; i < 200; i++) {
      w.pending = 1;
      for (const c of choices(w)) expect('id' in c ? c.id : '').not.toBe('fireFeather');
    }
  });

  it('折り返すところ（自分から離れた所）に炎を置き、羽根 1 枚につき 1 回だけ', () => {
    const w = quiet('chick');
    w.enemies.push(makeEnemy(ENEMIES.rat, 80, 0, 1e9));
    let most = 0;
    let far = false;
    for (let i = 0; i < 60 * 10; i++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      const flames = w.effects.filter((e) => e.alive && e.kind === 'flame');
      most = Math.max(most, flames.length);
      far ||= flames.some((e) => Math.hypot(e.x - w.player.x, e.y - w.player.y) > 30);
    }
    expect(far).toBe(true);
    // 2 枚ずつ 1.5 秒ごと、炎は 1.5 秒で消えるので、同時に 4 つほどまで
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(6);
  });

  it('3 段階めで Lv5 にすると火の鳥の翼に入れ替わる', () => {
    const w = quiet('chick');
    w.form = 2;
    w.weapons[0].level = 5;
    trySpecial(w);
    expect(w.weapons[0].id).toBe('fireFeatherSp');
  });

  it('お題の「武器は 1 つだけ」でも最初の武器として動く', () => {
    const w = quiet('chick', ['oneWeapon']);
    w.enemies.push(makeEnemy(ENEMIES.rat, 60, 0, 1e9));
    for (let i = 0; i < 60 * 3; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.weapons.map((o) => o.id)).toEqual(['fireFeather']);
    expect(w.shots.some((o) => o.alive || o.age > 0)).toBe(true);
  });
});
