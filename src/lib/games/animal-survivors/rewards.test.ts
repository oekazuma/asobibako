import { describe, expect, it } from 'vitest';
import { openChest } from './chest';
import { apply, choices } from './choices';
import { gainXp, xpNeed } from './drops';
import { maxOf, PASSIVES, stats } from './passives';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { coinsOf, createWorld, type World } from './world';

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

describe('全部埋まったあとのごほうび', () => {
  it('3 択は攻撃アップ・最大 HP アップ・コインの 3 枚', () => {
    const w = full();
    expect(choices(w).map((c) => c.kind)).toEqual(['power', 'vigor', 'gold']);
  });

  it('攻撃 +5% は重なり、パッシブを取っても育っても残る', () => {
    const w = full();
    const base = w.stats.might;
    apply(w, { kind: 'power' });
    apply(w, { kind: 'power' });
    expect(w.stats.might).toBeCloseTo(base + 0.1);
    w.passives.pop();
    apply(w, { kind: 'passive', id: Object.keys(PASSIVES)[6], level: 1 });
    expect(w.stats.might).toBeGreaterThanOrEqual(base + 0.1 - 1e-9);
    w.level = 9;
    w.xp = xpNeed(9) - 1;
    gainXp(w, 5);
    expect(w.form).toBe(1);
    expect(w.stats.might).toBeCloseTo(base + 0.1 + 0.1);
  });

  it('最大 HP +10 と全回復', () => {
    const w = full();
    const max = w.stats.maxHp;
    w.player.hp = 1;
    apply(w, { kind: 'vigor' });
    expect(w.stats.maxHp).toBe(max + 10);
    expect(w.player.hp).toBe(max + 10);
  });

  it('コイン +20', () => {
    const w = full();
    const before = coinsOf(w);
    apply(w, { kind: 'gold' });
    expect(coinsOf(w)).toBe(before + 20);
  });

  it('宝箱も上げるものがなければ、ごほうびから選ぶ', () => {
    const w = full();
    for (let i = 0; i < 5; i++) {
      w.chests = 1;
      // Lv5 の武器と対のパッシブがあれば 1 つめは進化に、合体の組がそろっていればまとめになる
      for (const r of openChest(w)) expect(['power', 'vigor', 'gold', 'evolve', 'union']).toContain(r.kind);
    }
  });
});
