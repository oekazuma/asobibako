import { describe, expect, it } from 'vitest';
import { openChest } from './chest';
import { apply, choices } from './choices';
import { gainXp, xpNeed } from './drops';
import { maxOf, PASSIVES, stats } from './passives';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { createWorld, type World } from './world';

const VIEW = { w: 274, h: 394 };

/** 武器もパッシブも全部上限まで取った World */
function full(): World {
  const w = createWorld('dog', 1, VIEW);
  const ids = Object.keys(WEAPONS).filter((id) => !WEAPONS[id].evolved && !WEAPONS[id].exclusive);
  w.weapons = ids.slice(0, 6).map((id) => ({ id, level: MAX_LEVEL, cd: 0 }));
  w.passives = Object.keys(PASSIVES)
    .slice(0, 6)
    .map((id) => ({ id, level: maxOf(id) }));
  w.stats = stats(w.animal, w.passives, w.boost, w.form);
  return w;
}

describe('全部埋まったあとの札', () => {
  it('3 択は限界突破と最大 HP の札だけ', () => {
    const w = full();
    for (const c of choices(w)) expect(['limit', 'vigor']).toContain(c.kind);
  });

  it('最大 HP +10 は重なり、パッシブを取っても育っても残る', () => {
    const w = full();
    const base = w.stats.maxHp;
    apply(w, { kind: 'vigor' });
    apply(w, { kind: 'vigor' });
    expect(w.stats.maxHp).toBeCloseTo(base + 20);
    w.passives.pop();
    apply(w, { kind: 'passive', id: Object.keys(PASSIVES)[6], level: 1 });
    expect(w.stats.maxHp).toBeGreaterThanOrEqual(base + 20 - 1e-9);
    w.level = 9;
    w.xp = xpNeed(9) - 1;
    gainXp(w, 5);
    expect(w.form).toBe(1);
    expect(w.stats.maxHp).toBeGreaterThanOrEqual(base + 20);
  });

  it('最大 HP +10 と全回復', () => {
    const w = full();
    const max = w.stats.maxHp;
    w.player.hp = 1;
    apply(w, { kind: 'vigor' });
    expect(w.stats.maxHp).toBe(max + 10);
    expect(w.player.hp).toBe(max + 10);
  });

  it('宝箱も上げるものがなければ、ごほうびから選ぶ', () => {
    const w = full();
    for (let i = 0; i < 5; i++) {
      w.chests = 1;
      // Lv5 の武器と対のパッシブがあれば 1 つめは進化に、合体の組がそろっていればまとめになる
      for (const r of openChest(w)) expect(['limit', 'vigor', 'evolve', 'union']).toContain(r.kind);
    }
  });
});
