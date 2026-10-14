import { describe, expect, it } from 'vitest';
import { heroRun, recordRun, runOf } from './coop-run';
import { startOvertime } from './overtime';
import { emptyRecords } from './records';
import { addHero, createWorld, summary } from './world';

const VIEW = { w: 260, h: 380 };

function cleared() {
  const w = createWorld('dog', 1, VIEW, {}, 'forest', { heat: { level: 4, bet: 120 } });
  addHero(w, 'cat');
  w.time = w.stage.length;
  w.over = 'clear';
  return w;
}

describe('協力プレイの記録', () => {
  it('子のぶんのまとめは子の動物の武器と、2 人で共通のコイン・倒した数で、賭けは入らない', () => {
    const w = cleared();
    w.heroes[1].weapons.push({ id: 'howl', level: 3, cd: 0 });
    w.coins = 50;
    w.kills = 300;
    const { part } = heroRun(w, 1);
    expect(part.animal).toBe('cat');
    expect(part.weapons.map((o) => o.id)).toContain('howl');
    expect([part.coins, part.kills]).toEqual([summary(w).coins, 300]);
    expect(part.heat.bet).toBe(0);
    expect(heroRun(w, 0).part.heat.bet).toBe(120);
    expect(w.cur).toBe(0);
  });

  it('延長戦の 2 回めの記録で、子の倒した数を 2 重に入れず、見せるまとめは回の合計', () => {
    const w = cleared();
    w.kills = 500;
    const r = emptyRecords();
    const first = recordRun(r, heroRun(w, 1), null);
    startOvertime(w);
    w.kills += 40;
    w.time += 200;
    w.over = 'dead';
    const end = recordRun(r, heroRun(w, 1), first.run);
    expect(r.kills).toBe(540);
    expect(r.clears).toBe(1);
    expect(end.run.kills).toBe(540);
    expect(end.run.animal).toBe('cat');
  });
  it('子のまとめにも、その回に拾った遺物が入る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest');
    addHero(w, 'cat');
    w.relicsNow.push('map');
    expect(heroRun(w, 1).part.relics).toEqual(['map']);
  });

  it('相手の端末から届いたまとめは、正しい形なら通し、欠けた数や知らない面は断る', () => {
    const w = cleared();
    const sent = () => JSON.parse(JSON.stringify(heroRun(w, 1)));
    expect(runOf(sent())).not.toBeNull();
    startOvertime(w);
    w.over = 'dead';
    expect(runOf(sent())).not.toBeNull();
    const noCoins = sent();
    delete noCoins.part.coins;
    expect(runOf(noCoins)).toBeNull();
    const text = sent();
    text.full.kills = '9999';
    expect(runOf(text)).toBeNull();
    const proto = sent();
    proto.part.stage = '__proto__';
    expect(runOf(proto)).toBeNull();
    expect(runOf(null)).toBeNull();
  });
});
