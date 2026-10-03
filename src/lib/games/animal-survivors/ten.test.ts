import { describe, expect, it } from 'vitest';
import { startOvertime } from './overtime';
import { FINALE, FOREST } from './stages/forest';
import { GRAVEYARD } from './stages/graveyard';
import { SNOW } from './stages/snow';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { collect, overtimeCoins } from './drops';
import { entries } from './book-view';
import { emptyRecords, parseRecords, record } from './records';
import { coinsOf, createWorld, step, summary } from './world';

const VIEW = { w: 274, h: 394 };

describe('10 分の面', () => {
  it('3 つの面はどれも 10 分', () => {
    for (const s of [FOREST, GRAVEYARD, SNOW]) expect(s.length).toBe(600);
  });

  it('ボスは 2・4・6・8 分、面の主は 9 分、ヌシは 1・3・5・7 分', () => {
    expect(FINALE).toBe(540);
    for (const s of [FOREST, GRAVEYARD, SNOW]) {
      expect(s.bosses.map((b) => b.at)).toEqual([120, 240, 360, 480, 540, 540]);
      expect(s.chiefs.map((c) => c.at)).toEqual([60, 180, 300, 420]);
    }
  });

  it('出来事はすべて 10 分のうちに起き、雪山の吹雪も 10 分のうちに 4 回', () => {
    expect(FOREST.events).toHaveLength(16);
    for (const e of FOREST.events) expect(e.at).toBeLessThan(600);
    expect(SNOW.storms.map((s) => s.at)).toEqual([95, 215, 335, 455]);
    for (const w of FOREST.waves) expect(w.to).toBeLessThanOrEqual(600);
  });

  it('敵の硬さと攻撃は、同じ時刻なら 15 分だったときと同じくらい', () => {
    expect(FOREST.toughness(600)).toBeCloseTo(5.2);
    expect(FOREST.fury(600)).toBeCloseTo(1.9);
    expect(FOREST.cap(480)).toBe(400);
    expect(FOREST.elite(150)).toBe(0);
    expect(FOREST.elite(170)).toBeGreaterThan(0);
  });

  it('10:00 でクリアし、延長戦は 10:00 から', () => {
    const w = createWorld('dog', 1, VIEW);
    w.weapons = [];
    w.player.hp = w.stats.maxHp = 1e9;
    w.time = 600 - 1e-6;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(w.over).toBe('clear');
    startOvertime(w);
    expect(w.overtime?.from).toBe(600);
    expect(w.stage.bosses[FOREST.bosses.length].at).toBe(660);
  });

  it('きらきらハリネズミは 2〜8 分のどこか', () => {
    for (let seed = 1; seed < 200; seed++) {
      const at = createWorld('dog', seed, VIEW).metalAt;
      if (at >= 0) {
        expect(at).toBeGreaterThanOrEqual(120);
        expect(at).toBeLessThanOrEqual(480);
      }
    }
  });
});

describe('10 分の面のコインと実績', () => {
  it('拾ったコインと延長戦のコインは 1.5 倍で数える（遊ぶ時間が 3 分の 2 になるぶん）', () => {
    const w = createWorld('dog', 1, VIEW);
    w.coins = 10;
    expect(coinsOf(w)).toBe(15);
    w.weapons = [];
    w.player.hp = w.stats.maxHp = 1e9;
    w.time = 600 - 1e-6;
    step(w, { x: 0, y: 0 }, 1 / 60);
    startOvertime(w);
    w.overtime!.coins = 10;
    expect(overtimeCoins(w)).toBe(15);
  });

  it('図鑑とお題のごほうびには 1.5 倍を掛けない', () => {
    const r = emptyRecords();
    const w = createWorld('dog', 1, VIEW);
    const run = summary(w);
    run.book.kills = { rat: 1 };
    const before = r.coins;
    record(r, run);
    expect(r.coins - before - run.coins).toBe((run.bookCoins ?? 0) + achievedCoins(r));
    // 倒したネズミ（10）と犬の 1 段階め（30）。図鑑のコインは 1.5 倍にしない
    expect(run.bookCoins).toBe(40);
  });

  it('生き延びる実績は 1・3・6 分、クリアは 10 分', () => {
    const byId = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
    expect(byId.survive5.name).toBe('3 分生き延びる');
    expect(byId.survive10.name).toBe('6 分生き延びる');
    expect(byId.clear.name).toBe('10 分生き延びてクリア');
    const r = emptyRecords();
    r.best = 180;
    expect(byId.survive5.done(r, null)).toBe(true);
    r.best = 359;
    expect(byId.survive10.done(r, null)).toBe(false);
  });

  it('15 分で遊んだころの記録もそのまま読める', () => {
    const r = parseRecords(JSON.stringify({ best: 900, clears: 3, overtime: { forest: 400 } }));
    expect(r.best).toBe(900);
    expect(r.overtime.forest).toBe(400);
  });
});

/** その記録で達成済みの実績のコインの合計 */
function achievedCoins(r: ReturnType<typeof emptyRecords>) {
  return ACHIEVEMENTS.filter((a) => r.achieved.includes(a.id)).reduce((t, a) => t + a.coins, 0);
}

describe('10 分の面のコインの見せ方', () => {
  it.each([
    ['pouch', 15],
    ['purse', 75]
  ] as const)('%s を拾うと浮かぶ数と HUD のコインの増え方が同じ', (kind, coins) => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
    w.items.push({ alive: true, kind, x: w.player.x, y: w.player.y, pulled: false });
    const before = coinsOf(w);
    collect(w, 1 / 60);
    expect(coinsOf(w) - before).toBe(coins);
    expect(w.events).toContainEqual({ type: 'coin', value: coins });
  });

  it('図鑑の小袋と大袋は実際に入る枚数を書く', () => {
    const items = entries(emptyRecords(), 'items');
    expect(items.find((e) => e.key === 'pouch')!.detail.join()).toContain('コイン 15 枚');
    expect(items.find((e) => e.key === 'purse')!.detail.join()).toContain('コイン 75 枚');
  });
});

describe('ステージの主の呼び方', () => {
  it('9:00 の 2 体はステージの名前で「森の主」「墓地の主」「雪山の主」と呼ぶ', () => {
    for (const [s, title] of [
      [FOREST, '森の主'],
      [GRAVEYARD, '墓地の主'],
      [SNOW, '雪山の主']
    ] as const)
      expect(s.bosses.filter((b) => b.at === FINALE).map((b) => b.title)).toEqual([title, title]);
    expect(ACHIEVEMENTS.find((a) => a.id === 'forestFinale')?.name).toBe('森の主を倒す');
    expect(animal('bear').unlock).toBe('森の主を倒すと仲間になる');
  });
});
