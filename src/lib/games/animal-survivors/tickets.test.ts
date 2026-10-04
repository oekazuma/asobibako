import { describe, expect, it } from 'vitest';
import { collect, dropFrom } from './drops';
import { ENEMIES } from './enemies';
import { startOvertime, overtimeRun } from './overtime';
import { emptyRecords, record } from './records';
import { addEnemy, createWorld, step, summary } from './world';

const VIEW = { w: 274, h: 394 };
const finale = () => ENEMIES.bear;

function bossDown(w: ReturnType<typeof createWorld>, isFinale: boolean) {
  const e = addEnemy(w, { ...finale(), finale: isFinale }, w.player.x, w.player.y)!;
  e.alive = false;
  dropFrom(w, e);
}

describe('ガチャ券', () => {
  it('ステージの主は毎回券を落とし、足もとで拾うと帯を出す', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { heat: { level: 9, bet: 0 } });
    bossDown(w, true);
    const t = w.items.find((it) => it.alive && it.kind === 'ticket')!;
    expect(t).toBeTruthy();
    t.x = w.player.x;
    t.y = w.player.y;
    collect(w, 0.016);
    expect(w.tickets.reduce((a, b) => a + b, 0)).toBe(1);
    expect(w.events.some((e) => e.type === 'swarm' && e.text.endsWith('を拾った！'))).toBe(true);
  });

  it('ボスとヌシの券は 1/4 で、券の乱数は loot から引く', () => {
    const w = createWorld('dog', 1, VIEW);
    const before = w.rand;
    w.loot = () => 0.3;
    bossDown(w, false);
    expect(w.items.some((it) => it.alive && it.kind === 'ticket')).toBe(false);
    w.loot = () => 0.2;
    bossDown(w, false);
    expect(w.items.some((it) => it.alive && it.kind === 'ticket')).toBe(true);
    expect(w.rand).toBe(before);
  });

  it('クリアで持ち帰り、倒れたら失う', () => {
    const r = emptyRecords();
    const win = createWorld('dog', 1, VIEW);
    win.tickets = [2, 1, 0];
    win.over = 'clear';
    const s = summary(win);
    expect(s.tickets).toEqual([2, 1, 0]);
    expect(s.lost).toEqual([0, 0, 0]);
    record(r, s);
    expect(r.tickets).toEqual([2, 1, 0]);
    const lose = createWorld('dog', 1, VIEW);
    lose.tickets = [1, 0, 1];
    lose.over = 'dead';
    const d = summary(lose);
    expect(d.tickets).toEqual([0, 0, 0]);
    expect(d.lost).toEqual([1, 0, 1]);
    record(r, d);
    expect(r.tickets).toEqual([2, 1, 0]);
  });

  it('延長戦で倒れると延長戦のぶんだけ失い、引き上げれば持ち帰る', () => {
    const w = createWorld('dog', 1, VIEW);
    w.tickets = [1, 0, 0];
    w.time = w.stage.length;
    w.over = 'clear';
    startOvertime(w);
    w.tickets = [2, 1, 0];
    w.over = 'dead';
    const dead = overtimeRun(w);
    expect(dead.tickets).toEqual([0, 0, 0]);
    expect(dead.lost).toEqual([1, 1, 0]);
    w.overtime!.retreat = true;
    const kept = overtimeRun(w);
    expect(kept.tickets).toEqual([1, 1, 0]);
    expect(kept.lost).toEqual([0, 0, 0]);
  });

  it('ステージの主は 2 体いても確定の券は 1 枚だけ', () => {
    const w = createWorld('dog', 1, VIEW);
    w.loot = () => 0.3;
    w.finaleKills = 1;
    bossDown(w, true);
    w.finaleKills = 2;
    bossDown(w, true);
    expect(w.items.filter((it) => it.alive && it.kind === 'ticket')).toHaveLength(1);
  });

  it('10:00 のクリアで、地面に残っている券も持ち帰る', () => {
    const w = createWorld('dog', 1, VIEW);
    w.items.push({ alive: true, kind: 'ticket', x: 300, y: 300, pulled: false, tier: 1 });
    w.time = w.stage.length - 0.001;
    step(w, { x: 0, y: 0 }, 0.01);
    expect(w.over).toBe('clear');
    expect(summary(w).tickets).toEqual([0, 1, 0]);
  });
});
