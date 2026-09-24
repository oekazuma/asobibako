import { describe, expect, it } from 'vitest';
import {
  agilityTime,
  award,
  COURSE,
  crossed,
  entry,
  ENTRY_COST,
  ENTRY_ENERGY,
  orders,
  prize,
  RANKS,
  RIVALS,
  rivals,
  standings,
  throwPoints,
  topRank,
  trickPoints
} from './contest';
import { adopt, CONTEST_RANKS, newSave, SLEEPY, type Pet } from './engine';
import type { ContestId } from './types';

function seq(...xs: number[]) {
  let i = 0;
  return () => xs[i++ % xs.length];
}

const IDS: ContestId[] = ['frisbee', 'wand', 'agility', 'obedience'];

describe('contest', () => {
  it('1 位で次の階級が開いてトロフィーが増え、前に勝った階級では賞金が半分', () => {
    const save = newSave(0);
    const money = save.money;
    expect(topRank(save, 'frisbee')).toBe(0);
    expect(award(save, 'frisbee', 0, 1)).toEqual({ money: 600, trophy: true, next: 1 });
    expect(save.contest.frisbee).toBe(1);
    expect(topRank(save, 'frisbee')).toBe(1);
    expect(award(save, 'frisbee', 0, 1)).toEqual({ money: 300, trophy: false, next: null });
    expect(award(save, 'frisbee', 1, 2)).toEqual({ money: 600, trophy: false, next: null });
    expect(save.contest.frisbee).toBe(1);
    expect(save.money).toBe(money + 1500);
    // チャンピオンで勝つと棚は 5 つ、そのあともチャンピオンに出られる
    save.contest.frisbee = 4;
    expect(award(save, 'frisbee', 4, 1)).toMatchObject({ money: 5000, trophy: true, next: null });
    expect(save.contest.frisbee).toBe(CONTEST_RANKS);
    expect(topRank(save, 'frisbee')).toBe(4);
  });

  it('賞金は階級が上がるほど増え、順位が下がるほど減り、ビギナー 1 位はおみせの品 1〜2 個ぶん', () => {
    expect(prize(0, 1)).toBe(600);
    expect(prize(4, 1)).toBe(5000);
    for (let r = 0; r < RANKS.length; r++)
      for (let p = 1; p < 4; p++) {
        expect(prize(r, p)).toBeGreaterThan(prize(r, p + 1));
        if (r) expect(prize(r, p)).toBeGreaterThan(prize(r - 1, p));
      }
    expect(prize(0, 4)).toBeGreaterThan(0);
  });

  it('作り点は階級の幅に入り、上の階級ほど手ごわい。名前は自分とかぶらない', () => {
    for (const id of IDS) {
      const lower = id === 'agility';
      for (let r = 0; r < RANKS.length; r++) {
        const [lo, hi] = RIVALS[id][r];
        for (const e of rivals(id, r, 'dog', 'ハナ', Math.random)) {
          expect(e.score).toBeGreaterThanOrEqual(lo);
          expect(e.score).toBeLessThanOrEqual(hi);
          expect(e.name).not.toBe('ハナ');
        }
        if (r) {
          const [plo, phi] = RIVALS[id][r - 1];
          expect(lower ? lo < plo && hi < phi : lo > plo && hi > phi).toBe(true);
        }
      }
    }
    const names = rivals('wand', 0, 'cat', 'タマ', seq(0, 0.5, 0.99)).map((e) => e.name);
    expect(new Set(names).size).toBe(3);
  });

  it('順位は点の多い順（アジリティは少ない順）で、同じ点なら自分が上', () => {
    const you = { name: 'ポチ', score: 50, you: true };
    const others = [
      { name: 'A', score: 50, you: false },
      { name: 'B', score: 70, you: false },
      { name: 'C', score: 20, you: false }
    ];
    expect(standings([...others, you], false).map((e) => e.name)).toEqual(['B', 'ポチ', 'A', 'C']);
    expect(standings([...others, you], true).map((e) => e.name)).toEqual(['C', 'ポチ', 'A', 'B']);
  });

  it('出るにはげんきがいり、出たあとも眠くならない。種類の合わない種目には出られない', () => {
    const save = newSave(0);
    const dog = adopt(save, 'shiba', 'ポチ') as Pet;
    expect(ENTRY_ENERGY - ENTRY_COST).toBeGreaterThan(SLEEPY);
    expect(entry(dog, 'frisbee')).toBe('ok');
    expect(entry(dog, 'wand')).toBe('kind');
    dog.stats.energy = ENTRY_ENERGY - 1;
    expect(entry(dog, 'agility')).toBe('tired');
  });

  it('フリスビーは遠く・空中ほど高く、しつけは早く出すほど高い', () => {
    expect(throwPoints(6, false)).toBe(60);
    expect(throwPoints(6, true)).toBeGreaterThan(throwPoints(8, false));
    expect(throwPoints(-1, false)).toBe(0);
    expect(trickPoints(false, 0.5)).toBe(0);
    expect(trickPoints(true, 0.5)).toBe(20);
    expect(trickPoints(true, 2.5)).toBe(15);
    expect(trickPoints(true, 9)).toBe(10);
  });

  it('しつけの芸は同じものを続けない', () => {
    const o = orders(seq(0, 0, 0.3, 0.3, 0.9), 5);
    expect(o).toHaveLength(5);
    for (let i = 1; i < o.length; i++) expect(o[i]).not.toBe(o[i - 1]);
  });

  it('コースの門は、線分をまたいだときだけ通ったことになる', () => {
    const hurdle = COURSE[0];
    expect(crossed({ x: 0, z: 0 }, { x: 0, z: -1.5 }, hurdle)).toBe(true);
    expect(crossed({ x: 0, z: -1.5 }, { x: 0, z: 0 }, hurdle)).toBe(true);
    // 横をまわると通らない
    expect(crossed({ x: 1, z: 0 }, { x: 1, z: -1.5 }, hurdle)).toBe(false);
    expect(crossed({ x: 0, z: 0 }, { x: 0, z: -0.5 }, hurdle)).toBe(false);
    expect(COURSE.at(-1)?.kind).toBe('goal');
  });

  it('アジリティは時間内なら実タイム、ゴールできなければ制限時間に残りの門のぶんを足す', () => {
    expect(agilityTime(23.456, 0)).toBe(23.5);
    expect(agilityTime(60, 2)).toBe(70);
  });
});
