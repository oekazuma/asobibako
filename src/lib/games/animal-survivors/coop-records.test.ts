import { describe, expect, it } from 'vitest';
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
