import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import { create, drawer, DRAW_S, guess, leave, pick, PICK_S, REVEAL_S, tick, view, type Egokoro } from './engine';

const WORDS = ['ぞう', 'きりん', 'らいおん', 'ねこ', 'いぬ', 'さる', 'くま', 'かば', 'うし', 'うま', 'ぶた', 'やぎ'];
/** 決まった順に出る乱数（お題の選び方とヒントの位置を固定する） */
const fixed = () => 0;

function game(players: Seat[] = [1, 2, 3]): Egokoro {
  return create(players, fixed, WORDS);
}

/** いまの描く人にお題 index を選ばせ、そのお題を返す */
function choose(s: Egokoro, index = 0): string {
  expect(pick(s, drawer(s), index)).toBe(true);
  return s.word;
}

const run = (s: Egokoro, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.25) tick(s, 0.25, fixed, WORDS);
};

describe('create', () => {
  it('1P から描き、全員が 2 回ずつ描く順番を作る', () => {
    const s = game();
    expect(s.order).toEqual([1, 2, 3, 1, 2, 3]);
    expect(drawer(s)).toBe(1);
    expect(s.phase).toBe('pick');
    expect(s.choices).toHaveLength(2);
    expect(s.scores).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});

describe('pick', () => {
  it('描く人だけが、お題を選ぶ時間にだけ選べる', () => {
    const s = game();
    expect(pick(s, 2, 0)).toBe(false);
    expect(pick(s, 1, 5)).toBe(false);
    expect(pick(s, 1, 1)).toBe(true);
    expect(s.word).toBe(s.choices[1]);
    expect(s.phase).toBe('draw');
    expect(s.left).toBe(DRAW_S);
    expect(pick(s, 1, 0)).toBe(false);
  });

  it('選ばないまま時間が過ぎたら 1 つ目の候補にする', () => {
    const s = game();
    run(s, PICK_S + 0.5);
    expect(s.phase).toBe('draw');
    expect(s.word).toBe(s.choices[0]);
  });
});

describe('guess', () => {
  it('当てた順に 3 点・2 点、描いた人は 1 人につき 2 点', () => {
    const s = game();
    const word = choose(s);
    expect(guess(s, 3, word)).toBe('right');
    expect(s.scores).toEqual({ 1: 2, 2: 0, 3: 3 });
    expect(guess(s, 2, word)).toBe('right');
    expect(s.scores).toEqual({ 1: 4, 2: 2, 3: 3 });
  });

  it('全員が当てたらすぐ答えを見せる時間になり、そのあとの答えは受け付けない', () => {
    const s = game([1, 2]);
    const word = choose(s);
    expect(guess(s, 2, word)).toBe('right');
    expect(s.phase).toBe('reveal');
    expect(s.left).toBe(REVEAL_S);
    expect(guess(s, 2, word)).toBeNull();
  });

  it('描く人・当てた人・遊んでいない人・描く時間の外の答えは受け付けない', () => {
    const s = game();
    expect(guess(s, 2, 'ぞう')).toBeNull();
    const word = choose(s);
    expect(guess(s, 1, word)).toBeNull();
    expect(guess(s, 3 as Seat, word)).toBe('right');
    expect(guess(s, 3, word)).toBeNull();
    const two = game([1, 2]);
    choose(two);
    expect(guess(two, 3, 'ぞう')).toBeNull();
  });

  it('おしい・はずれでは点も順番も変わらない', () => {
    const s = game();
    const word = choose(s);
    const near = word === 'ぞう' ? 'そう' : 'x';
    expect(guess(s, 2, 'はずれ')).toBe('wrong');
    if (word === 'ぞう') expect(guess(s, 2, near)).toBe('close');
    expect(s.solved).toEqual([]);
    expect(s.scores).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});

describe('tick', () => {
  it('残り 45 秒で 1 文字目、残り 20 秒でもう 1 文字を見せる', () => {
    const s = create([1, 2], fixed, ['らいおん', 'きりん']);
    choose(s);
    run(s, DRAW_S - 45 - 0.5);
    expect(s.hints).toEqual([]);
    run(s, 1);
    expect(s.hints).toEqual([0]);
    run(s, 25);
    expect(s.hints).toHaveLength(2);
    expect(s.hints[1]).toBeGreaterThan(0);
  });

  it('2 文字のお題は 2 つ目のヒントを出さない', () => {
    const s = create([1, 2], fixed, ['ねこ', 'いぬ']);
    choose(s);
    run(s, DRAW_S - 1);
    expect(s.hints).toEqual([0]);
  });

  it('時間切れで答えを見せ、3 秒後に次の人の番になる', () => {
    const s = game();
    choose(s);
    run(s, DRAW_S + 0.5);
    expect(s.phase).toBe('reveal');
    run(s, REVEAL_S);
    expect(s.phase).toBe('pick');
    expect(s.turn).toBe(1);
    expect(drawer(s)).toBe(2);
    expect(s.solved).toEqual([]);
    expect(s.hints).toEqual([]);
  });

  it('全員が 2 回描いたら done になり、同じお題は出さない', () => {
    const s = game([1, 2]);
    const seen: string[] = [];
    while (s.phase !== 'done') {
      seen.push(...s.choices);
      choose(s);
      run(s, DRAW_S + REVEAL_S + 1);
    }
    expect(s.turn).toBe(4);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('leave', () => {
  it('描いている人が抜けたら、答えを見せずに次の人の番へ移り、その人の番は飛ばす', () => {
    const s = game();
    choose(s);
    leave(s, 1, fixed, WORDS);
    expect(s.players).toEqual([2, 3]);
    expect(s.phase).toBe('pick');
    expect(drawer(s)).toBe(2);
    expect(s.order.slice(s.turn)).toEqual([2, 3, 2, 3]);
  });

  it('当てる人が抜けて残りが全員当てていたら、答えを見せる', () => {
    const s = game();
    const word = choose(s);
    guess(s, 2, word);
    leave(s, 3, fixed, WORDS);
    expect(s.phase).toBe('reveal');
  });

  it('1 人になったら done。抜けた人の点は残す', () => {
    const s = game([1, 2]);
    const word = choose(s);
    guess(s, 2, word);
    leave(s, 2, fixed, WORDS);
    expect(s.phase).toBe('done');
    expect(s.scores[2]).toBe(3);
  });
});

describe('view', () => {
  it('当てていない人にはお題を渡さず、字数の○とヒントの字だけを渡す', () => {
    const s = create([1, 2, 3], fixed, ['らいおん', 'きりん']);
    const word = choose(s);
    expect(view(s, 1).word).toBe(word);
    expect(view(s, 2).word).toBeNull();
    expect(view(s, 2).mask).toBe('○○○○');
    expect(JSON.stringify(view(s, 2))).not.toContain(word);
    run(s, DRAW_S - 44);
    expect(view(s, 3).mask).toBe('ら○○○');
    guess(s, 2, word);
    expect(view(s, 2).word).toBe(word);
    expect(view(s, 3).word).toBeNull();
  });

  it('お題を選ぶあいだ、候補は描く人にだけ渡す', () => {
    const s = game();
    expect(view(s, 1).choices).toEqual(s.choices);
    expect(view(s, 2).choices).toBeNull();
    expect(JSON.stringify(view(s, 2))).not.toContain(s.choices[0]);
  });

  it('答えを見せる時間は全員にお題を渡し、残り秒は切り上げる', () => {
    const s = game();
    choose(s);
    run(s, DRAW_S + 0.5);
    expect(view(s, 3).word).toBe(s.word);
    expect(Number.isInteger(view(s, 3).left)).toBe(true);
  });
});
