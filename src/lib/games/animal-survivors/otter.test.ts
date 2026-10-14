import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { BOUNCE_REACH, power } from './arms';
import { choices } from './choices';
import { collect } from './drops';
import { ENEMIES } from './enemies';
import { emptyRecords, parseRecords } from './records';
import { RELICS } from './relics';
import { trySpecial } from './specials';
import { WEAPONS, weaponStats } from './weapons';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const otterWorld = () => {
  const w = createWorld('otter', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.propCd = 9999;
  w.metalAt = -1;
  w.player.invuln = 9999;
  w.stats.crit = 0;
  return w;
};
const alive = (w: ReturnType<typeof otterWorld>) => w.shots.filter((s) => s.alive);

/** 最初の 1 投げだけを飛ばして、その弾が消えるまで進める */
function oneThrow(w: ReturnType<typeof otterWorld>) {
  let fired = false;
  // 敵が歩いて寄ってくる前に投げさせる
  w.weapons[0].cd = 0;
  for (let i = 0; i < 30 * 6; i++) {
    step(w, { x: 0, y: 0 }, 1 / 30);
    if (!fired && alive(w).length > 0) {
      fired = true;
      w.weapons[0].cd = 999;
    }
    if (fired && alive(w).length === 0) return;
  }
  throw new Error('弾が消えない');
}

describe('ラッコ', () => {
  it('最強の段で、貝ころがしを持ち、海岸のクリアで仲間になる', () => {
    const a = animal('otter');
    expect(a.tier).toBe(4);
    expect(a.forms).toEqual(['ラッコ', '貝わりラッコ', 'おやかたラッコ']);
    expect(a.weapon).toBe('shellRoll');
    expect(a.special).toBe('shellRollSp');
    expect(a.bonus).toEqual({ luck: 0.1 });
    expect(ACHIEVEMENTS.find((d) => d.id === 'coastClear')?.animal).toBe('otter');
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['coastClear'] }));
    expect(r.unlocked).toContain('otter');
  });

  it('貝ころがしは Lv1 で 2 回、Lv5 で 5 回跳ねる', () => {
    const def = WEAPONS.shellRoll;
    expect(def.kind).toBe('bounce');
    expect(weaponStats(def, 1).pierce).toBe(2);
    expect(weaponStats(def, 5).pierce).toBe(5);
  });

  it('跳ねる先は近くの別の敵で、同じ敵には 1 回の投げで 1 回だけ当たる', () => {
    const w = otterWorld();
    const near = [20, 40, 60].map((x) => makeEnemy(ENEMIES.crab, w.player.x + x, w.player.y, 1e6));
    w.enemies.push(...near);
    oneThrow(w);
    const lost = near.map((e) => 1e6 - e.hp);
    // 会心は 0 に固定してあるので、1 発のダメージは武器の Lv1 の値から決まる。2 回当たれば 2 倍になって落ちる
    const one = power(w, WEAPONS.shellRoll.base.damage).dmg;
    for (const l of lost) expect(Math.min(Math.abs(l), Math.abs(l - one))).toBeCloseTo(0, 6);
    expect(lost.filter((l) => l > 0).length).toBeGreaterThanOrEqual(2);
    expect(w.dealt.shellRoll.damage).toBeCloseTo(lost.reduce((a, b) => a + b, 0));
  });

  it('跳ねる回数が尽きたら、近くに敵がいても消える', () => {
    const w = otterWorld();
    // Lv1 は 2 回跳ねるので 3 体まで。4 体めには当たらない
    const row = [20, 40, 60, 80].map((x) => makeEnemy(ENEMIES.crab, w.player.x + x, w.player.y, 1e6));
    w.enemies.push(...row);
    oneThrow(w);
    expect(row.filter((e) => e.hp < 1e6)).toHaveLength(3);
  });

  it('跳ね返ったあと、先の敵が消えても、60 ドットより遠い敵までは飛んでいかない', () => {
    const w = otterWorld();
    const [a, b, c] = [20, 60, 150].map((x) => makeEnemy(ENEMIES.crab, w.player.x + x, w.player.y, 1e6));
    w.enemies.push(a, b, c);
    let fired = false;
    w.weapons[0].cd = 0;
    for (let i = 0; i < 30 * 6; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      const shell = alive(w)[0];
      if (!fired && shell) {
        fired = true;
        w.weapons[0].cd = 999;
      }
      // 1 体めに当たって b へ向きを変えた直後に、b を消す
      if (shell?.hits.length === 1) b.alive = false;
      if (fired && !shell) break;
    }
    expect(a.hp).toBeLessThan(1e6);
    expect(c.hp).toBe(1e6);
    expect(alive(w)).toHaveLength(0);
  });

  it('敵が 1 体だけ、または 60 ドットより遠いときは、跳ねずに消える', () => {
    const w = otterWorld();
    const first = makeEnemy(ENEMIES.crab, w.player.x + 20, w.player.y, 1e6);
    const far = makeEnemy(ENEMIES.crab, w.player.x + 20 + BOUNCE_REACH + 30, w.player.y, 1e6);
    w.enemies.push(first, far);
    oneThrow(w);
    expect(first.hp).toBeLessThan(1e6);
    expect(far.hp).toBe(1e6);
    expect(alive(w)).toHaveLength(0);
  });

  it('貝ころがしは、ほかの動物の 3 択に出ない', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 200; i++) {
      w.pending = 1;
      for (const c of choices(w)) expect('id' in c ? c.id : '').not.toBe('shellRoll');
    }
  });

  it('3 段階めで Lv5 にすると真珠ころがしに入れ替わる', () => {
    const w = otterWorld();
    w.form = 2;
    w.weapons[0].level = 5;
    expect(trySpecial(w)).toBe(true);
    expect(w.weapons[0].id).toBe('shellRollSp');
    expect(WEAPONS.shellRollSp).toMatchObject({ special: true, from: 'shellRoll', kind: 'bounce' });
  });

  it('真珠ころがしは跳ねるたびに小さな波（炎の区域）を残す', () => {
    const w = otterWorld();
    w.form = 2;
    w.weapons[0].level = 5;
    trySpecial(w);
    w.enemies.push(...[20, 40, 60].map((x) => makeEnemy(ENEMIES.crab, w.player.x + x, w.player.y, 1e6)));
    oneThrow(w);
    expect(w.effects.filter((f) => f.kind === 'flame').length).toBeGreaterThanOrEqual(2);
  });
});

describe('白い真珠', () => {
  it('海岸にあり、持つと玉を引き寄せる範囲が 1.2 倍になる', () => {
    expect(RELICS.find((r) => r.id === 'pearl')).toMatchObject({ stage: 'coast', dist: 1500 });
    const gemAt = (w: ReturnType<typeof otterWorld>) => {
      const g = { alive: true, x: w.player.x + 36, y: w.player.y - 4, value: 1, pulled: false };
      w.gems.push(g);
      collect(w, 1 / 60);
      return g.pulled;
    };
    expect(gemAt(otterWorld())).toBe(false);
    const w = otterWorld();
    w.relics.push('pearl');
    expect(gemAt(w)).toBe(true);
  });
});
