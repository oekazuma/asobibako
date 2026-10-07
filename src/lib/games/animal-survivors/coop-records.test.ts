import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { emptyRecords, pairKey, parseRecords, record } from './records';
import { startCarry, stepCarry } from './carry';
import { heroRun } from './coop-run';
import { startOvertime } from './overtime';
import { overtimeRun } from './overtime';
import { addHero, createWorld, DUO_BONUS, step, summary, type World } from './world';

const VIEW = { w: 260, h: 380 };

function duo(): World {
  const w = createWorld('dog', 5, VIEW);
  addHero(w, 'cat');
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  return w;
}

describe('その回の 2 人の数', () => {
  it('1 人の回のまとめには coop が入らない', () => {
    expect(summary(createWorld('dog', 1, VIEW)).coop).toBeUndefined();
  });

  it('2 匹それぞれの倒した数・ダメージ・起こした回数と、連携の技・運んだ数が入る', () => {
    const w = duo();
    w.heroes[0].dealt = { woof: { damage: 120.4, kills: 7 }, howl: { damage: 30, kills: 2 } };
    w.heroes[1].dealt = { paw: { damage: 50, kills: 3 } };
    w.heroes[1].down = true;
    w.heroes[1].player.hp = 0;
    w.heroes[0].player.x = 190;
    w.heroes[1].player.x = 200;
    for (let i = 0; i < 200 && w.heroes[1].down; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    w.link.uses = 2;
    startCarry(w);
    const c = w.carry!;
    c.x = c.ax;
    c.y = c.ay;
    stepCarry(w, 0.01);
    const s = summary(w);
    expect(s.coop).toEqual({
      me: 0,
      heroes: [
        { animal: 'dog', kills: 9, damage: 150, raises: 1 },
        { animal: 'cat', kills: 3, damage: 50, raises: 0 }
      ],
      links: 2,
      carries: 1,
      bonus: 0
    });
  });

  it('子の端末のまとめでは me が 1 になる', () => {
    const w = duo();
    expect(heroRun(w, 1).part.coop?.me).toBe(1);
  });
});

describe('ふたりのボーナス', () => {
  it('2 人でクリアしたときだけ、その回のコインに 2 割と銅の券 1 枚が足される', () => {
    const w = duo();
    w.coins = 1000;
    w.over = 'clear';
    const base = summary(createWorldClear());
    const s = summary(w);
    expect(s.coop!.bonus).toBe(Math.floor((s.coins - s.coop!.bonus) * DUO_BONUS));
    expect(s.coop!.bonus).toBeGreaterThan(0);
    expect(s.tickets![0]).toBe(w.tickets[0] + 1);
    expect(base.coop).toBeUndefined();
  });

  it('倒れた回・子が抜けた回・延長戦の 2 回めにはボーナスが無い', () => {
    const dead = duo();
    dead.coins = 1000;
    dead.over = 'dead';
    expect(summary(dead).coop!.bonus).toBe(0);
    const left = duo();
    left.coins = 1000;
    left.heroes[1].gone = left.heroes[1].down = true;
    left.over = 'clear';
    expect(summary(left).coop!.bonus).toBe(0);
    const ot = duo();
    ot.coins = 1000;
    ot.over = 'clear';
    startOvertime(ot);
    ot.over = 'dead';
    expect(overtimeRun(ot).coop!.bonus).toBe(0);
  });

  it('子のボーナスは子の強欲で掛けた子のコインから出す', () => {
    const w = duo();
    w.coins = 1000;
    w.heroes[1].greed = 2;
    w.over = 'clear';
    const host = heroRun(w, 0).part;
    const guest = heroRun(w, 1).part;
    expect(guest.coop!.bonus).toBeGreaterThan(host.coop!.bonus);
  });

  it('延長戦の 2 回めのまとめは、連携の技と起こした回数を延長戦のぶんだけ持つ', () => {
    const w = duo();
    w.link.uses = 2;
    w.heroes[0].raises = 1;
    w.over = 'clear';
    startOvertime(w);
    w.link.uses = 3;
    w.heroes[0].raises = 4;
    w.over = 'dead';
    const c = overtimeRun(w).coop!;
    expect(c.links).toBe(1);
    expect(c.heroes[0].raises).toBe(3);
  });
});

function createWorldClear(): World {
  const w = createWorld('dog', 1, VIEW);
  w.coins = 1000;
  w.over = 'clear';
  return w;
}

describe('記録の「ふたり」', () => {
  it('回ごとに遊んだ回数・クリア・最長・起こした回数・連携・運んだ数・組み合わせが増える', () => {
    const r = emptyRecords();
    const w = duo();
    w.time = 300;
    w.link.uses = 2;
    w.heroes[0].raises = 1;
    w.heroes[1].raises = 2;
    w.carried = 1;
    record(r, summary(w));
    expect(r.coop).toEqual({
      runs: 1,
      clears: 0,
      best: 300,
      raises: 3,
      links: 2,
      carries: 1,
      pairs: [pairKey('dog', 'cat')]
    });
    const v = createWorld('cat', 2, VIEW);
    addHero(v, 'dog');
    v.over = 'clear';
    v.time = 600;
    record(r, summary(v));
    expect(r.coop.runs).toBe(2);
    expect(r.coop.clears).toBe(1);
    expect(r.coop.best).toBe(600);
    expect(r.coop.pairs).toHaveLength(1);
  });

  it('1 人の回では増えない', () => {
    const r = emptyRecords();
    record(r, summary(createWorld('dog', 1, VIEW)));
    expect(r.coop.runs).toBe(0);
  });

  it('延長戦の 2 回めの記録では、遊んだ回数とクリアを 2 度数えない', () => {
    const r = emptyRecords();
    const w = duo();
    w.link.uses = 2;
    w.over = 'clear';
    w.time = 600;
    record(r, summary(w));
    startOvertime(w);
    w.link.uses = 3;
    w.time = 700;
    w.over = 'dead';
    record(r, overtimeRun(w));
    expect(r.coop.runs).toBe(1);
    expect(r.coop.clears).toBe(1);
    expect(r.coop.links).toBe(3);
    expect(r.coop.best).toBe(700);
  });

  it('古い記録と壊れた欄は、0 と空で読み、知らない組み合わせは捨てる', () => {
    expect(parseRecords(JSON.stringify({ coins: 5 })).coop).toEqual(emptyRecords().coop);
    const r = parseRecords(
      JSON.stringify({ coop: { runs: 'x', clears: 2, pairs: ['cat+dog', 'dog+ufo', 3], best: -1 } })
    );
    expect(r.coop).toEqual({ ...emptyRecords().coop, clears: 2, pairs: ['cat+dog'] });
  });

  it('組み合わせは並びの順によらない', () => {
    expect(pairKey('dog', 'cat')).toBe(pairKey('cat', 'dog'));
    expect(pairKey('dog', 'dog')).toBe('dog+dog');
  });
});

describe('協力の実績', () => {
  const done = (id: string, r = emptyRecords()) => ACHIEVEMENTS.find((a) => a.id === id)!.done(r, null);

  it('5 つの条件', () => {
    const r = emptyRecords();
    expect(['coopClear', 'coopLink10', 'coopRaise10', 'coopCarry5', 'coopPairs10'].map((id) => done(id, r))).toEqual([
      false,
      false,
      false,
      false,
      false
    ]);
    r.coop = {
      runs: 3,
      clears: 1,
      best: 600,
      raises: 10,
      links: 10,
      carries: 5,
      pairs: Array.from({ length: 10 }, (_, i) => `p${i}`)
    };
    expect(['coopClear', 'coopLink10', 'coopRaise10', 'coopCarry5', 'coopPairs10'].map((id) => done(id, r))).toEqual([
      true,
      true,
      true,
      true,
      true
    ]);
  });
});
