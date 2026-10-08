import { describe, expect, it } from 'vitest';
import { startCarry, stepCarry } from './carry';
import { limitGain } from './limit';
import { obstacleAt } from './obstacles';
import { COOP_MIN_SECS, emptyRecords, record } from './records';
import { shrineAt, touchShrines } from './shrines';
import { addHero, createWorld, summary } from './world';

const VIEW = { w: 260, h: 380 };

describe('小さな点', () => {
  it('重い宝箱を障害物へ押しつけても、行ったり来たりしない', () => {
    const w = createWorld('dog', 3, VIEW);
    addHero(w, 'cat');
    startCarry(w);
    const c = w.carry!;
    let o = null;
    for (let k = 1; !o; k++) o = obstacleAt(w.stage.art, k, 0);
    Object.assign(c, { x: o.x - 30, y: o.y });
    const xs: number[] = [];
    for (let i = 0; i < 120; i++) {
      w.heroes[0].player.x = w.heroes[1].player.x = c.x + 20;
      w.heroes[0].player.y = c.y - 5;
      w.heroes[1].player.y = c.y + 5;
      stepCarry(w, 1 / 30);
      xs.push(c.x);
    }
    const back = xs.slice(60).filter((x, i, a) => i > 0 && x < a[i - 1] - 0.01).length;
    expect(back).toBe(0);
  });

  it('60 秒より短い 2 人の回は、遊んだ回数と組み合わせに数えない', () => {
    const r = emptyRecords();
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.time = COOP_MIN_SECS - 1;
    record(r, summary(w));
    expect(r.coop.runs).toBe(0);
    expect(r.coop.pairs).toEqual([]);
  });

  it('祠めぐりは、祠を使った動物ごとに数える', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    let s = null;
    for (let c = 1; !s; c++) s = shrineAt('forest', c, 0);
    w.heroes[0].player.x = s.x;
    w.heroes[0].player.y = s.y;
    touchShrines(w);
    expect(summary(w).shrines).toBe(1);
    w.cur = 1;
    expect(summary(w).shrines).toBe(0);
    w.cur = 0;
  });

  it('回る武器の待ち時間の札は、回り終えてからの待ち時間と書く', () => {
    expect(limitGain('cooldown', 0, 'orbit')).toContain('回り終えてから');
    expect(limitGain('cooldown', 0, 'shot')).not.toContain('回り終えてから');
  });
});
