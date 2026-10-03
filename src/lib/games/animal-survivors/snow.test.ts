import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { ENEMIES } from './enemies';
import { canPlay, emptyRecords, parseRecords } from './records';
import { SONGS } from './songs';
import { STAGES, stageOf } from './stages';
import { FOREST } from './stages/forest';
import { SNOW } from './stages/snow';
import { createWorld, summary } from './world';

describe('雪山の面の表', () => {
  it('森・墓地・雪山の順に並び、雪山は墓地のあとでコイン 2 倍', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow']);
    expect(stageOf('snow')).toBe(SNOW);
    expect(SNOW.coin).toBe(2);
    expect(SNOW.after).toBe('graveyard');
    expect(SNOW.art).toBe('snow');
    expect(SNOW.song).toBe('snow');
  });

  it('敵とボスはすべて敵の表にあり、森の敵は 1 体も出ない', () => {
    const ids = [
      ...SNOW.waves.map((w) => w.enemy),
      ...SNOW.events.flatMap((e) => (e.enemy ? [e.enemy] : [])),
      ...SNOW.chiefs.map((c) => c.enemy),
      ...SNOW.bosses.map((b) => b.id)
    ];
    for (const id of ids) expect(ENEMIES[id]).toBeDefined();
    const forest = ['rat', 'bat', 'snake', 'caterpillar', 'boar', 'spider', 'croc'];
    expect(ids.filter((id) => forest.includes(id))).toEqual([]);
    expect([...new Set(SNOW.bosses.map((b) => b.id))]).toEqual(['yeti', 'dragon']);
  });

  it('出来事・ヌシ・ボスの時刻は森と同じ', () => {
    expect(SNOW.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(SNOW.chiefs.map((c) => c.at)).toEqual(FOREST.chiefs.map((c) => c.at));
    expect(SNOW.bosses.map((b) => b.at)).toEqual(FOREST.bosses.map((b) => b.at));
  });

  it('雪の敵は入れ替える前の敵と同じ動き方', () => {
    const pairs: [string, string][] = [
      ['rat', 'penguin'],
      ['bat', 'snowsprite'],
      ['snake', 'seal'],
      ['caterpillar', 'snowman'],
      ['boar', 'reindeer'],
      ['spider', 'hare'],
      ['croc', 'polar']
    ];
    for (const [from, to] of pairs) expect(ENEMIES[to].move).toBe(ENEMIES[from].move);
    expect(ENEMIES.yeti.ai).toBe('yeti');
    expect(ENEMIES.dragon.ai).toBe('dragon');
  });

  it('雪山だけ吹雪の表があり、ボスとヌシの時刻にかからない', () => {
    expect(SNOW.storms.map((s) => s.at)).toEqual([150, 330, 510, 690]);
    for (const s of STAGES) if (s.id !== 'snow') expect(s.storms).toEqual([]);
    for (const st of SNOW.storms)
      for (const t of [...SNOW.bosses.map((b) => b.at), ...SNOW.chiefs.map((c) => c.at)])
        expect(t < st.at - 3 || t > st.at + st.len).toBe(true);
  });

  it('雪山の曲がある', () => {
    expect(SONGS.snow.song.melody.length).toBeGreaterThan(0);
  });
});

describe('雪山を選べる条件', () => {
  it('森は最初から、墓地は森のクリアで、雪山は墓地のクリアで選べる', () => {
    const r = emptyRecords();
    expect(STAGES.map((s) => canPlay(r, s.id))).toEqual([true, false, false]);
    r.stages = ['forest'];
    expect(STAGES.map((s) => canPlay(r, s.id))).toEqual([true, true, false]);
    r.stages = ['forest', 'graveyard'];
    expect(STAGES.map((s) => canPlay(r, s.id))).toEqual([true, true, true]);
    expect(canPlay(r, 'nope')).toBe(false);
  });

  it('古い保存や知らない面の id があっても雪山は開かない', () => {
    const r = parseRecords(JSON.stringify({ stages: ['forest', 'nope'], stage: 'snow' }));
    expect(canPlay(r, 'snow')).toBe(false);
    expect(r.stages).toEqual(['forest']);
  });

  it('雪山で遊ぶと雪山の世界になり、まとめにも雪山が入る', () => {
    const w = createWorld('dog', 1, { w: 274, h: 394 }, {}, 'snow');
    expect(w.stage).toBe(SNOW);
    expect(summary(w).stage).toBe('snow');
  });
});

describe('雪山の記録', () => {
  it('大雪男と氷の竜を倒した記録は読み直しても残る', () => {
    const r = parseRecords(JSON.stringify({ bosses: ['yeti', 'dragon', 'bear'] }));
    expect([...r.bosses].sort()).toEqual(['bear', 'dragon', 'yeti']);
  });

  it('墓地と雪山のヌシの表は森のヌシと同じ数', () => {
    expect(SNOW.chiefs.every((c) => ENEMIES[c.enemy])).toBe(true);
    expect(stageOf('graveyard').chiefs.every((c) => ENEMIES[c.enemy])).toBe(true);
  });
});

describe('雪山の実績', () => {
  it('雪山のクリアと、雪山の 2 体のボス', () => {
    const clear = ACHIEVEMENTS.find((a) => a.id === 'snowClear')!;
    const bosses = ACHIEVEMENTS.find((a) => a.id === 'snowBosses')!;
    expect([clear.coins, bosses.coins]).toEqual([400, 300]);
    const r = emptyRecords();
    expect(clear.done(r, null)).toBe(false);
    r.stages = ['forest', 'graveyard', 'snow'];
    expect(clear.done(r, null)).toBe(true);
    r.bosses = ['yeti'];
    expect(bosses.done(r, null)).toBe(false);
    r.bosses = ['yeti', 'dragon'];
    expect(bosses.done(r, null)).toBe(true);
  });
});
