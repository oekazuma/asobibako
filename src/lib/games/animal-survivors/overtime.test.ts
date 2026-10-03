import { describe, expect, it } from 'vitest';
import { openChest } from './chest';
import { CHEST_COINS, collect, overtimeCoins, overtimeRate } from './drops';
import { overtimeRun, startOvertime } from './overtime';
import { Prompts } from './prompts.svelte';
import { emptyRecords, parseRecords, record } from './records';
import { ENEMIES } from './enemies';
import { makeEnemy } from './world';
import { FOREST } from './stages/forest';
import { coinsOf, createWorld, step, summary, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

/** 15:00 でクリアしたところ。武器を外し、倒れないようにしてある */
function cleared(): World {
  const w = createWorld('dog', 3, VIEW);
  w.weapons = [];
  w.metalAt = -1;
  w.propCd = 1e9;
  w.player.hp = w.stats.maxHp = 1e9;
  w.time = 900 - 1e-6;
  step(w, still, 1 / 60);
  return w;
}

function run(w: World, secs: number, dt = 1 / 30) {
  for (let i = 0; i < secs / dt; i++) {
    w.pending = 0;
    w.chests = 0;
    step(w, still, dt);
  }
}

function coinAt(w: World) {
  w.items.push({ alive: true, kind: 'coin', x: w.player.x, y: w.player.y, pulled: true });
  collect(w, 1 / 60);
}

describe('延長戦を始める', () => {
  it('15:00 を過ぎても止まらず敵が出続け、面の表の元は変わらない', () => {
    const w = cleared();
    expect(w.over).toBe('clear');
    startOvertime(w);
    expect(w.over).toBeNull();
    run(w, 10);
    expect(w.over).toBeNull();
    expect(w.time).toBeGreaterThan(909);
    expect(w.enemies.filter((e) => e.alive && !e.def.prop).length).toBeGreaterThan(20);
    expect(FOREST.length).toBe(900);
    expect(FOREST.bosses).toHaveLength(6);
  });

  it('16:00 と 17:00 に面の 2 体が交互に出て、3 秒前に WARNING が出る', () => {
    const w = cleared();
    startOvertime(w);
    const warned: string[] = [];
    for (let i = 0; i < 125 * 30; i++) {
      w.pending = 0;
      w.chests = 0;
      step(w, still, 1 / 30);
      for (const e of w.events) if (e.type === 'warning') warned.push(`${e.boss}@${Math.round(w.time)}`);
    }
    expect(warned).toEqual(['bear@957', 'spiderQueen@1017']);
    const bosses = w.enemies.filter((e) => e.alive && e.def.boss).map((e) => e.def.id);
    expect(bosses).toEqual(expect.arrayContaining(['bear', 'spiderQueen']));
  });

  it('延長戦では硬さと攻撃の強さの伸びが強まる（15:00 では同じ）', () => {
    const w = cleared();
    startOvertime(w);
    expect(w.stage.toughness(900)).toBeCloseTo(FOREST.toughness(900));
    expect(w.stage.toughness(1200)).toBeGreaterThan(FOREST.toughness(1200));
    expect(w.stage.fury(1200)).toBeGreaterThan(FOREST.fury(1200));
  });
});

describe('延長戦のコイン', () => {
  it('倍率は 1 分ごとに 0.5 ずつ上がり、延長戦でなければ 1', () => {
    const w = cleared();
    expect(overtimeRate(w)).toBe(1);
    startOvertime(w);
    w.time = 930;
    expect(overtimeRate(w)).toBe(1);
    w.time = 960;
    expect(overtimeRate(w)).toBe(1.5);
    w.time = 1030;
    expect(overtimeRate(w)).toBe(2);
  });

  it('拾ったコインと宝箱のコインは倍率を掛けて延長戦のぶんに入り、15:00 までのコインは変わらない', () => {
    const w = cleared();
    const before = w.coins;
    startOvertime(w);
    w.time = 1030;
    coinAt(w);
    w.chests = 1;
    openChest(w);
    expect(w.coins).toBe(before);
    expect(w.overtime!.coins).toBe(2 * (1 + CHEST_COINS));
  });

  it('倒れると延長戦のぶんは半分、引き上げれば全部', () => {
    const w = cleared();
    startOvertime(w);
    w.overtime!.coins = 11;
    expect(overtimeCoins(w)).toBe(11);
    w.over = 'dead';
    expect(overtimeCoins(w)).toBe(5);
    w.overtime!.retreat = true;
    expect(overtimeCoins(w)).toBe(11);
  });

  it('画面と記録のコインは 15:00 までと延長戦のぶんの合計', () => {
    const w = cleared();
    const before = coinsOf(w);
    startOvertime(w);
    w.overtime!.coins = 10;
    w.over = 'dead';
    expect(coinsOf(w)).toBe(before + 5);
    expect(summary(w).overtime).toEqual({ secs: 0, coins: 5, halved: true });
  });
});

describe('延長戦の 2 回めの記録', () => {
  it('倒した数・宝箱・図鑑は延長戦の差だけで、クリアは数えない', () => {
    const w = cleared();
    w.killsBy = { rat: 50 };
    w.kills = 50;
    w.opened = 2;
    w.bossTimes = [{ id: 'bear', secs: 40 }];
    startOvertime(w);
    w.killsBy.rat += 7;
    w.killsBy.bat = 3;
    w.kills += 10;
    w.opened += 1;
    w.bossTimes.push({ id: 'spiderQueen', secs: 50 });
    w.time = 1000;
    w.overtime!.coins = 8;
    w.over = 'dead';
    const r = overtimeRun(w);
    expect(r.cleared).toBe(false);
    expect(r.finale).toBe(false);
    expect(r.kills).toBe(10);
    expect(r.opened).toBe(1);
    expect(r.coins).toBe(4);
    expect(r.book.kills).toEqual({ rat: 7, bat: 3 });
    expect(r.book.bosses).toEqual([{ id: 'spiderQueen', secs: 50 }]);
    expect(r.overtime).toEqual({ secs: 100, coins: 4, halved: true });
  });
});

describe('延長戦の記録', () => {
  it('15:00 と延長戦の 2 回の記録で、クリアは 1 回、倒した数とコインは合計どおり', () => {
    const w = cleared();
    w.kills = 500;
    const r = emptyRecords();
    record(r, summary(w));
    const first = r.coins;
    startOvertime(w);
    w.kills += 40;
    w.time = 1100;
    w.overtime!.coins = 20;
    w.over = 'dead';
    record(r, overtimeRun(w));
    expect(r.clears).toBe(1);
    expect(r.kills).toBe(540);
    expect(r.coins - first).toBeGreaterThanOrEqual(10);
    expect(r.overtime).toEqual({ forest: 200 });
  });

  it('面ごとの最高は長いほうを残し、壊れた値は捨てる', () => {
    const r = parseRecords(JSON.stringify({ overtime: { forest: 120, snow: 'x', nope: 50, graveyard: -3 } }));
    expect(r.overtime).toEqual({ forest: 120 });
    const w = cleared();
    startOvertime(w);
    w.time = 960;
    w.over = 'dead';
    record(r, overtimeRun(w));
    expect(r.overtime.forest).toBe(120);
    expect(emptyRecords().overtime).toEqual({});
  });

  it('延長戦で 5 分と 10 分生き延びると実績', () => {
    const w = cleared();
    startOvertime(w);
    const r = emptyRecords();
    w.time = 900 + 300;
    w.over = 'dead';
    expect(record(r, overtimeRun(w)).map((a) => a.id)).toContain('overtime5');
    expect(r.achieved).not.toContain('overtime10');
    w.time = 900 + 600;
    expect(record(r, overtimeRun(w)).map((a) => a.id)).toContain('overtime10');
  });
});

describe('延長戦の曲', () => {
  it('15:00 の一掃で消えたボスがいても、延長戦のあいだボス戦の曲のままにならない', () => {
    const w = createWorld('dog', 3, VIEW);
    w.weapons = [];
    w.metalAt = -1;
    w.player.hp = w.stats.maxHp = 1e9;
    w.time = 900 - 1e-6;
    w.warned = w.bossNext = w.stage.bosses.length;
    // 6 体のうち 5 体は倒し、面の主の 1 体が 15:00 まで残った
    w.bossKills = ['bear', 'spiderQueen', 'bear', 'spiderQueen', 'bear'];
    w.enemies[0] = makeEnemy(ENEMIES.bear, 30, 0, 9999);
    const p = new Prompts(w);
    step(w, still, 1 / 60);
    expect(w.over).toBe('clear');
    startOvertime(w);
    step(w, still, 1 / 60);
    p.take();
    expect(p.boss).toBe(false);
    p.stop();
  });
});
