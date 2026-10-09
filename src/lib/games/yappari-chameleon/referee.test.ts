import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import {
  DEFAULTS,
  fit,
  hiding,
  hit,
  join,
  leave,
  newMatch,
  pickHunters,
  ready,
  shoot,
  start,
  tick,
  toot,
  view,
  wish,
  type Match,
  type Settings
} from './referee';

const ALL: Seat[] = [1, 2, 3];
/** 乱数は 0 に寄せる（並べ替えで最後の人が先頭に来る） */
const zero = () => 0;

function begun(settings: Partial<Settings> = {}, wishes: Seat[] = [3]): Match {
  const m = newMatch();
  for (const s of wishes) wish(m, s, true);
  start(m, ALL, { ...DEFAULTS, hide: 60, ...settings }, zero);
  return m;
}

/** dt を小さく刻んで secs 秒進め、吹いた人を集める */
function run(m: Match, secs: number): Seat[] {
  const toots: Seat[] = [];
  for (let t = 0; t < secs - 1e-9; t += 0.1) toots.push(...tick(m, 0.1));
  return toots;
}

describe('fit', () => {
  it('範囲の外の値を収め、ハンターは人数−1 まで、強制挑発は 0 か 5〜120', () => {
    const s = fit({ mode: 'normal', hunters: 5, hide: 10, search: 9999, reveal: 30, taunt: 3 }, 3);
    expect(s).toEqual({ mode: 'normal', hunters: 2, hide: 30, search: 600, reveal: 30, taunt: 5 });
    expect(fit({ ...DEFAULTS, hunters: 2, taunt: 0 }, 2)).toMatchObject({ hunters: 1, taunt: 0 });
  });
});

describe('pickHunters', () => {
  it('希望した人から選び、足りなければ残りから足す', () => {
    expect(pickHunters([3], ALL, 1, Math.random)).toEqual([3]);
    const two = pickHunters([2], ALL, 2, Math.random);
    expect(two).toContain(2);
    expect(two).toHaveLength(2);
    expect(pickHunters([], ALL, 1, zero)).toHaveLength(1);
  });
});

describe('フェーズの流れ', () => {
  it('紹介 3 秒 → 隠れタイム → 探索 → 答え合わせ → ロビーと時計どおりに進む', () => {
    const m = begun({ hide: 30, search: 60, reveal: 10 });
    expect(m.phase).toBe('intro');
    expect(m.roles).toEqual({ 1: 'hider', 2: 'hider', 3: 'hunter' });
    run(m, 3);
    expect(m.phase).toBe('hide');
    expect(m.left).toBe(30);
    run(m, 30);
    expect(m.phase).toBe('search');
    run(m, 60);
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('chameleon');
    run(m, 10);
    expect(m.phase).toBe('lobby');
    expect(m.roles).toEqual({});
  });

  it('もうええよは、いる人の全員がそろうと隠れタイムと答え合わせを飛ばす。探索中は数えない', () => {
    const m = begun();
    run(m, 3);
    ready(m, 1, ALL);
    ready(m, 2, ALL);
    ready(m, 2, ALL);
    expect(m.ready).toEqual([1, 2]);
    expect(m.phase).toBe('hide');
    ready(m, 3, ALL);
    expect(m.phase).toBe('search');
    expect(m.ready).toEqual([]);
    ready(m, 1, ALL);
    expect(m.ready).toEqual([]);
  });

  it('切れた人はもうええよの数から外れ、残りがそろっていればすぐ飛ぶ', () => {
    const m = begun();
    run(m, 3);
    ready(m, 1, ALL);
    ready(m, 3, ALL);
    leave(m, 2, [1, 3]);
    expect(m.phase).toBe('search');
  });
});

describe('発見と勝ち負け', () => {
  it('通常では全員見つかればハンターの勝ちで、見つかった人は観戦（隠れる人のまま）', () => {
    const m = begun({ mode: 'normal' });
    run(m, 3 + 60);
    expect(hit(m, 1)).toBe(true);
    expect(hit(m, 1)).toBe(false);
    expect(m.roles[1]).toBe('hider');
    expect(m.phase).toBe('search');
    hit(m, 2);
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('hunter');
  });

  it('通常では 1 人でも残って時間切れならカメレオンの勝ち', () => {
    const m = begun({ mode: 'normal', search: 60 });
    run(m, 3 + 60);
    hit(m, 1);
    run(m, 60);
    expect(m.winner).toBe('chameleon');
  });

  it('増え鬼では見つかった人がその場でハンターになり、全員見つかれば最初のハンターの勝ち', () => {
    const m = begun({ mode: 'infect' });
    run(m, 3 + 60);
    hit(m, 2);
    expect(m.roles[2]).toBe('hunter');
    expect(m.first).toEqual([3]);
    hit(m, 1);
    expect(m.winner).toBe('hunter');
  });

  it('探索中でなければ発見にならない（答え合わせで撃ってもしぶきだけ）', () => {
    const m = begun();
    run(m, 3);
    expect(hit(m, 1)).toBe(false);
  });
});

describe('切れた人', () => {
  it('ハンターが全員抜けると、隠れタイムでも隠れる人の勝ちで答え合わせへ', () => {
    const m = begun();
    run(m, 4);
    leave(m, 3, [1, 2]);
    expect(m.roles[3]).toBe('out');
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('chameleon');
  });

  it('切れた隠れる人は役を残し（体は撃てば見つかる）、戻っても隠れる人のまま。途中で来た人は観戦', () => {
    const m = begun({ mode: 'normal' });
    run(m, 3 + 60);
    leave(m, 2, [1, 3]);
    expect(m.roles[2]).toBe('hider');
    expect(hit(m, 2)).toBe(true);
    join(m, 2);
    expect(m.roles[2]).toBe('hider');
    const n = begun({}, [3]);
    delete n.roles[2];
    join(n, 2);
    expect(n.roles[2]).toBe('out');
  });
});

describe('撃つ間隔', () => {
  it('2.0 秒より早い撃ちと、ハンターでない人の撃ちを捨てる', () => {
    const m = begun();
    run(m, 3 + 60);
    expect(shoot(m, 1)).toBe(false);
    expect(shoot(m, 3)).toBe(true);
    run(m, 1);
    expect(shoot(m, 3)).toBe(false);
    run(m, 0.9);
    expect(shoot(m, 3)).toBe(true);
  });

  it('同じ時刻に 2 人のハンターが撃っても、それぞれの間隔で数える', () => {
    const m = begun({ hunters: 2 }, [2, 3]);
    run(m, 3 + 60);
    expect([shoot(m, 2), shoot(m, 3)]).toEqual([true, true]);
  });
});

describe('口笛と強制挑発', () => {
  it('強制挑発は間隔ごとに見つかっていない隠れる人の全員が吹き、自分で吹くとその人の時計が巻き戻る', () => {
    const m = begun({ taunt: 10 });
    run(m, 3 + 60);
    expect(run(m, 7)).toEqual([]);
    expect(toot(m, 1)).toBe(true);
    expect(run(m, 3).sort()).toEqual([2]);
    expect(run(m, 7).sort()).toEqual([1]);
    hit(m, 2);
    expect(view(m).taunts[2]).toBeUndefined();
    expect(run(m, 10)).toEqual([1]);
  });

  it('強制挑発の秒は隠れタイムから出し、探索のあいだだけ減り、答え合わせでは止まる。間隔が 0 なら 0', () => {
    const m = begun({ taunt: 5, search: 60 });
    expect(view(m).taunts).toEqual({ 1: 5, 2: 5 });
    expect(run(m, 3 + 60)).toEqual([]);
    expect(view(m).taunts).toEqual({ 1: 5, 2: 5 });
    run(m, 58);
    expect(m.phase).toBe('search');
    run(m, 2);
    expect(m.phase).toBe('reveal');
    const frozen = view(m).taunts;
    expect(frozen[1]).toBeGreaterThan(0);
    run(m, 5);
    expect(view(m).taunts).toEqual(frozen);
    expect(view(begun()).taunts).toEqual({ 1: 0, 2: 0 });
  });

  it('口笛は 1 秒あけて吹け、ハンターと見つかった人は吹けない。ロビーでは全員が吹ける', () => {
    const lobby = newMatch();
    expect(toot(lobby, 3)).toBe(true);
    const m = begun();
    run(m, 3);
    expect(toot(m, 1)).toBe(true);
    expect(toot(m, 1)).toBe(false);
    run(m, 1);
    expect(toot(m, 1)).toBe(true);
    expect(toot(m, 3)).toBe(false);
  });

  it('隠れている人の数は見つかった人を除く', () => {
    const m = begun();
    run(m, 63);
    hit(m, 1);
    expect(hiding(m)).toEqual([2]);
  });
});
