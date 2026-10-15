import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { BEAM_LEN, BEAM_W } from './arms';
import { choices } from './choices';
import { ENEMIES } from './enemies';
import { emptyRecords, parseRecords } from './records';
import { trySpecial } from './specials';
import { WEAPONS } from './weapons';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const unicornWorld = () => {
  const w = createWorld('unicorn', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};
const run = (w: ReturnType<typeof unicornWorld>, secs: number) => {
  for (let i = 0; i < Math.round(secs * 30); i++) step(w, { x: 0, y: 0 }, 1 / 30);
};

describe('ユニコーン', () => {
  it('最強の段で、虹のビームを持ち、魔法の森のクリアで仲間になる', () => {
    const a = animal('unicorn');
    expect(a.tier).toBe(4);
    expect(a.forms).toEqual(['子どものユニコーン', '虹のユニコーン', '星のユニコーン']);
    expect(a.weapon).toBe('rainbowBeam');
    expect(a.special).toBe('rainbowBeamSp');
    expect(a.bonus).toEqual({ speed: 0.1 });
    expect(ACHIEVEMENTS.find((d) => d.id === 'groveClear')?.animal).toBe('unicorn');
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['groveClear'] }));
    expect(r.unlocked).toContain('unicorn');
  });

  it('虹のビームは Lv1 で 1 本、Lv5 で 3 本', () => {
    const def = WEAPONS.rainbowBeam;
    expect(def.kind).toBe('beam');
    expect(def.base.amount).toBe(1);
    expect(def.base.amount + def.ups.reduce((n, u) => n + (u.amount ?? 0), 0)).toBe(3);
  });

  it('線にかかる敵にだけ、1 回ずつ当たる', () => {
    const w = unicornWorld();
    w.weapons[0].cd = 0;
    const p = w.player;
    const a = makeEnemy(ENEMIES.shroomling, p.x + 40, p.y, 1e6);
    const b = makeEnemy(ENEMIES.shroomling, p.x + BEAM_LEN - 10, p.y + 2, 1e6);
    const off = makeEnemy(ENEMIES.shroomling, p.x + 60, p.y + BEAM_W + 30, 1e6);
    const past = makeEnemy(ENEMIES.shroomling, p.x + BEAM_LEN + 40, p.y, 1e6);
    w.enemies.push(a, b, off, past);
    step(w, { x: 0, y: 0 }, 1 / 30);
    expect(a.hp).toBeLessThan(1e6);
    expect(b.hp).toBeLessThan(1e6);
    expect(off.hp).toBe(1e6);
    expect(past.hp).toBe(1e6);
    const once = 1e6 - a.hp;
    run(w, 0.2);
    expect(1e6 - a.hp).toBe(once);
  });

  it('空にいるボスは狙わず、ほかに敵がいなければ撃たない', () => {
    const w = unicornWorld();
    w.weapons[0].cd = 0;
    const e = makeEnemy(ENEMIES.raven, w.player.x + 40, w.player.y, 1e6);
    e.state = 4;
    w.enemies.push(e);
    e.wait = 1e6;
    run(w, 0.5);
    expect(e.hp).toBe(1e6);
    expect(w.effects.some((f) => f.alive && f.kind === 'beam')).toBe(false);
  });

  it('虹のビームは、ほかの動物の 3 択に出ない', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 200; i++) {
      w.pending = 1;
      for (const c of choices(w)) expect('id' in c ? c.id : '').not.toBe('rainbowBeam');
    }
  });

  it('3 段階めで Lv5 にすると虹の大砲に入れ替わる', () => {
    const w = unicornWorld();
    w.form = 2;
    w.weapons[0].level = 5;
    expect(trySpecial(w)).toBe(true);
    expect(w.weapons[0].id).toBe('rainbowBeamSp');
    expect(WEAPONS.rainbowBeamSp).toMatchObject({ special: true, from: 'rainbowBeam', kind: 'beam' });
  });

  it('虹の大砲は、200 ドット先の線の上の敵にも当たる', () => {
    const w = unicornWorld();
    w.form = 2;
    w.weapons[0].level = 5;
    trySpecial(w);
    w.weapons[0].cd = 0;
    const near = makeEnemy(ENEMIES.shroomling, w.player.x + 40, w.player.y - 6, 1e6);
    const far = makeEnemy(ENEMIES.shroomling, w.player.x + 200, w.player.y - 6, 1e6);
    near.root = far.root = 99;
    w.enemies.push(near, far);
    step(w, { x: 0, y: 0 }, 1 / 30);
    expect(far.hp).toBeLessThan(1e6);
  });
});
