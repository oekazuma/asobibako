import { describe, expect, it } from 'vitest';
import { ANIMALS, animal } from './animals';
import { ENEMIES } from './enemies';
import { emptyRecords, parseRecords, record } from './records';
import { createWorld, damageEnemy, makeEnemy, summary, type RunSummary } from './world';

const run = (o: Partial<RunSummary> = {}): RunSummary => ({
  ...summary(createWorld('dog', 1, { w: 274, h: 394 })),
  ...o
});

/** その記録の回で新しく仲間になった動物 */
const joined = (r: ReturnType<typeof emptyRecords>, o: Partial<RunSummary>) =>
  record(r, run(o)).flatMap((a) => (a.animal ? [a.animal] : []));

describe('キャラの段', () => {
  it('10 匹で、基本 3・中 3・強 2・最強 2', () => {
    expect(ANIMALS).toHaveLength(10);
    const by = (t: number) => ANIMALS.filter((a) => a.tier === t).map((a) => a.id);
    expect(by(1)).toEqual(['dog', 'cat', 'wolf']);
    expect(by(2).sort()).toEqual(['bear', 'fox', 'rabbit']);
    expect(by(3).sort()).toEqual(['panda', 'tiger']);
    expect(by(4)).toEqual(['drake', 'chick']);
    expect(emptyRecords().unlocked).toEqual(['dog', 'cat', 'wolf']);
  });

  it('段が上がるほど攻撃と体力の合計が大きい', () => {
    const power = (t: number) => {
      const list = ANIMALS.filter((a) => a.tier === t);
      // よみがえりは、もう一度 HP の半分で立ち上がれるぶんとして数える
      return list.reduce((s, a) => s + a.might * a.hp * (1 + 0.5 * (a.rebirths ?? 0)), 0) / list.length;
    };
    expect(power(2)).toBeGreaterThan(power(1));
    expect(power(3)).toBeGreaterThan(power(2));
    expect(power(4)).toBeGreaterThan(power(3));
    expect(animal('tiger').weapon).toBe('tigerClaw');
    expect(animal('drake').weapon).toBe('breath');
  });
});

describe('解放の条件', () => {
  it('5 分生き延びたり巨大ベアを倒したりしただけでは、もう仲間は増えない', () => {
    const r = emptyRecords();
    expect(joined(r, { time: 320, bosses: ['bear'], kills: 4000 })).toEqual([]);
  });

  it('森をクリアでキツネ、森の面の主でクマ、合計 2 万体でウサギ', () => {
    const r = emptyRecords();
    expect(joined(r, { cleared: true, time: 900 })).toEqual(['fox']);
    expect(joined(r, { finale: true })).toEqual(['bear']);
    expect(joined(r, { kills: 20000 })).toEqual(['rabbit']);
  });

  it('墓地をクリアでパンダ、大雪男を倒すとトラ、雪山をクリアで竜の子', () => {
    const r = emptyRecords();
    r.stages = ['forest'];
    r.clears = 1;
    r.unlocked.push('fox');
    r.achieved.push('clear');
    expect(joined(r, { cleared: true, time: 900, stage: 'graveyard' })).toEqual(['panda']);
    expect(joined(r, { bosses: ['yeti'], stage: 'snow' })).toEqual(['tiger']);
    expect(joined(r, { cleared: true, time: 900, stage: 'snow' })).toEqual(['drake']);
  });

  it('面の主を 2 体とも倒すと、その面が記録の finales に入る', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 });
    w.stage = { ...w.stage, waves: [], events: [], chiefs: [] };
    const finale = w.stage.bosses.filter((b) => b.title);
    finale.forEach((b, i) => (w.enemies[i] = makeEnemy({ ...ENEMIES[b.id], finale: true }, 0, 0, 1)));
    damageEnemy(w, 0, 9, 0, 0);
    expect(summary(w).finale).toBe(false);
    damageEnemy(w, 1, 9, 0, 0);
    expect(summary(w).finale).toBe(true);
    const r = emptyRecords();
    record(r, summary(w));
    expect(r.finales).toEqual(['forest']);
  });

  it('達成済みの実績に後から付いた動物は、読み込んだときに仲間になる', () => {
    const r = parseRecords(JSON.stringify({ achieved: ['snowClear', 'graveClear'] }));
    expect(r.unlocked).toContain('drake');
    expect(r.unlocked).toContain('panda');
  });

  it('古い記録で仲間になっていた動物は残り、知らない id は捨て、finales が無くても読める', () => {
    const r = parseRecords(JSON.stringify({ unlocked: ['fox', 'panda', 'nope'] }));
    expect(r.unlocked.sort()).toEqual(['cat', 'dog', 'fox', 'panda', 'wolf']);
    expect(r.finales).toEqual([]);
  });
});
