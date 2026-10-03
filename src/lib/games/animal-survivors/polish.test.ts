import { describe, expect, it } from 'vitest';
import { apply } from './choices';
import { collect, gainXp, xpNeed } from './drops';
import { ENEMIES } from './enemies';
import { overtimeRun, startOvertime } from './overtime';
import { emptyRecords, record } from './records';
import { chiefOf, createWorld, hurtPlayer, makeEnemy, step, summary } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

describe('復活の押しのけ', () => {
  it('ヌシ・ランタン・ハリネズミは押さない（ふつうの敵は押す）', () => {
    const w = createWorld('dog', 1, VIEW, { revive: 1 });
    w.weapons = [];
    const kinds = [ENEMIES.rat, chiefOf(ENEMIES.boar), ENEMIES.lantern, ENEMIES.metal];
    kinds.forEach((d, i) => (w.enemies[i] = makeEnemy(d, 20, 0, 99999)));
    w.player.hp = 1;
    w.player.invuln = 0;
    hurtPlayer(w, 999);
    expect(w.over).toBeNull();
    expect(w.enemies[0].kx).toBeGreaterThan(0);
    for (const e of w.enemies.slice(1, 4)) expect(e.kx).toBe(0);
  });
});

describe('延長戦と体数の実績', () => {
  it('15:00 までと延長戦を合わせて 3000 体で「1 回で 3000 体倒す」、撃破の合計は二重にしない', () => {
    const w = createWorld('dog', 1, VIEW);
    w.time = 900 - 1e-6;
    w.weapons = [];
    w.player.hp = w.stats.maxHp = 1e9;
    w.kills = 2500;
    step(w, still, 1 / 60);
    const r = emptyRecords();
    record(r, summary(w));
    expect(r.achieved).not.toContain('run3000');
    startOvertime(w);
    w.kills += 600;
    w.over = 'dead';
    const got = record(r, overtimeRun(w)).map((a) => a.id);
    expect(got).toContain('run3000');
    expect(r.kills).toBe(w.kills);
  });
});

describe('お題の HP 半分', () => {
  it('育つ・パッシブで増えるぶんも半分', () => {
    const plain = createWorld('dog', 1, VIEW);
    const half = createWorld('dog', 1, VIEW, {}, 'forest', { date: 'x', bonus: 0, mods: ['halfHp'] });
    for (const w of [plain, half]) {
      w.level = 9;
      w.xp = xpNeed(9) - 1;
      gainXp(w, 5);
      w.pending = 0;
      apply(w, { kind: 'passive', id: 'heart', level: 1 });
    }
    expect(half.stats.maxHp).toBeCloseTo(plain.stats.maxHp / 2);
  });
});

describe('延長戦のコインの数字', () => {
  it('浮かぶ数字は倍率を掛けた数', () => {
    const w = createWorld('dog', 1, VIEW);
    w.time = 900 - 1e-6;
    w.weapons = [];
    step(w, still, 1 / 60);
    startOvertime(w);
    w.time = 1030;
    w.events.length = 0;
    w.items.push({ alive: true, kind: 'pouch', x: w.player.x, y: w.player.y, pulled: true });
    collect(w, 1 / 60);
    const coin = w.events.find((e) => e.type === 'coin');
    expect(coin).toMatchObject({ value: 20 });
  });
});
