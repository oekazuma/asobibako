import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import {
  answer,
  ANSWER_S,
  buzz,
  create,
  drawer,
  LENGTHS,
  guess,
  leave,
  READY_S,
  rejoin,
  REVEAL_S,
  start,
  tick,
  view,
  type Quiz
} from './engine';

const WORDS = ['ぞう', 'きりん', 'らいおん', 'ねこ', 'いぬ', 'さる', 'くま', 'かば', 'うし', 'うま', 'ぶた', 'やぎ'];
/** 決まった順に出る乱数（お題の決め方・候補の並び・ヒントの位置を固定する） */
const fixed = () => 0;

function game(players: Seat[] = [1, 2, 3]): Quiz {
  return create(players, fixed, WORDS);
}

function hayaoshi(players: Seat[] = [1, 2, 3]): Quiz {
  return create(players, fixed, WORDS, 'hayaoshi');
}

/** いまの描く人に描き始めさせ、お題を返す */
function go(s: Quiz): string {
  expect(start(s, drawer(s))).toBe(true);
  return s.word;
}

const run = (s: Quiz, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.25) tick(s, 0.25, fixed, WORDS);
};

describe('create', () => {
  it('1P から描き、全員が 2 回ずつ描く順番を作り、お題を 1 つ決めて準備の時間にする', () => {
    const s = game();
    expect(s.order).toEqual([1, 2, 3, 1, 2, 3]);
    expect(drawer(s)).toBe(1);
    expect(s.phase).toBe('ready');
    expect(s.left).toBe(READY_S);
    expect(WORDS).toContain(s.word);
    expect(s.scores).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});

describe('start', () => {
  it('描く人だけが、準備のあいだにだけ始められる', () => {
    const s = game();
    expect(start(s, 2)).toBe(false);
    expect(start(s, 1)).toBe(true);
    expect(s.phase).toBe('draw');
    expect(s.left).toBe(LENGTHS.normal.draw.egokoro);
    expect(start(s, 1)).toBe(false);
  });

  it('押さないまま準備の時間が過ぎたら描く時間が始まる', () => {
    const s = game();
    run(s, READY_S + 0.25);
    expect(s.phase).toBe('draw');
  });
});

describe('guess（エゴコロクイズ）', () => {
  it('当てた順に 3 点・2 点、描いた人は 1 人につき 2 点', () => {
    const s = game();
    const word = go(s);
    expect(guess(s, 3, word)).toBe('right');
    expect(s.scores).toEqual({ 1: 2, 2: 0, 3: 3 });
    expect(guess(s, 2, word)).toBe('right');
    expect(s.scores).toEqual({ 1: 4, 2: 2, 3: 3 });
  });

  it('全員が当てたらすぐ答えを見せる時間になり、そのあとの答えは受け付けない', () => {
    const s = game([1, 2]);
    const word = go(s);
    expect(guess(s, 2, word)).toBe('right');
    expect(s.phase).toBe('reveal');
    expect(s.left).toBe(REVEAL_S);
    expect(guess(s, 2, word)).toBeNull();
  });

  it('描く人・当てた人・遊んでいない人・描く時間の外の答えは受け付けない', () => {
    const s = game();
    expect(guess(s, 2, s.word)).toBeNull();
    const word = go(s);
    expect(guess(s, 1, word)).toBeNull();
    expect(guess(s, 3, word)).toBe('right');
    expect(guess(s, 3, word)).toBeNull();
    const two = game([1, 2]);
    go(two);
    expect(guess(two, 3, two.word)).toBeNull();
  });

  it('おしい・はずれでは点も順番も変わらない', () => {
    const s = game();
    const word = go(s);
    expect(word).toBe('ぞう');
    expect(guess(s, 2, 'はずれ')).toBe('wrong');
    expect(guess(s, 2, 'そう')).toBe('close');
    expect(s.solved).toEqual([]);
    expect(s.scores).toEqual({ 1: 0, 2: 0, 3: 0 });
  });

  it('はやおし検定では guess を受け付けない', () => {
    const s = hayaoshi();
    const word = go(s);
    expect(guess(s, 2, word)).toBeNull();
  });
});

describe('tick', () => {
  it('残り 45 秒で 1 文字目、残り 20 秒でもう 1 文字を見せる', () => {
    const s = create([1, 2], fixed, ['らいおん', 'きりん']);
    go(s);
    run(s, LENGTHS.normal.draw.egokoro - 45 - 0.5);
    expect(s.hints).toEqual([]);
    run(s, 1);
    expect(s.hints).toEqual([0]);
    run(s, 25);
    expect(s.hints).toHaveLength(2);
    expect(s.hints[1]).toBeGreaterThan(0);
  });

  it('2 文字のお題は 2 つ目のヒントを出さない', () => {
    const s = create([1, 2], fixed, ['ねこ', 'いぬ']);
    go(s);
    run(s, LENGTHS.normal.draw.egokoro - 1);
    expect(s.hints).toEqual([0]);
  });

  it('時間切れで答えを見せ、3 秒後に次の人の番になる', () => {
    const s = game();
    go(s);
    run(s, LENGTHS.normal.draw.egokoro + 0.5);
    expect(s.phase).toBe('reveal');
    run(s, REVEAL_S);
    expect(s.phase).toBe('ready');
    expect(s.turn).toBe(1);
    expect(drawer(s)).toBe(2);
    expect(s.solved).toEqual([]);
    expect(s.hints).toEqual([]);
  });

  it('全員が 2 回描いたら done になり、同じお題は出さない', () => {
    const s = game([1, 2]);
    const seen: string[] = [];
    while (s.phase !== 'done') {
      seen.push(go(s));
      run(s, LENGTHS.normal.draw.egokoro + REVEAL_S + 1);
    }
    expect(s.turn).toBe(4);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('buzz と answer（はやおし検定）', () => {
  it('描く時間は 60 秒で、字数のヒントは出さない', () => {
    const s = hayaoshi();
    go(s);
    expect(s.left).toBe(LENGTHS.normal.draw.hayaoshi);
    run(s, 50);
    expect(s.hints).toEqual([]);
    expect(view(s, 2).mask).toBe('');
  });

  it('最初に押した人だけが答える番になり、そのあいだほかの人と描く人は押せない', () => {
    const s = hayaoshi();
    go(s);
    expect(buzz(s, 1, fixed, WORDS)).toBe(false);
    expect(buzz(s, 2, fixed, WORDS)).toBe(true);
    expect(buzz(s, 3, fixed, WORDS)).toBe(false);
    expect(s.buzzer).toBe(2);
    expect(s.answerLeft).toBe(ANSWER_S);
  });

  it('候補は 4 つでお題が 1 つだけ入り、答えている本人の見え方にだけ入る', () => {
    const s = hayaoshi();
    const word = go(s);
    buzz(s, 2, fixed, WORDS);
    expect(s.options).toHaveLength(4);
    expect(new Set(s.options).size).toBe(4);
    expect(s.options.filter((o) => o === word)).toHaveLength(1);
    expect(view(s, 2).options).toEqual(s.options);
    expect(view(s, 3).options).toBeNull();
    expect(view(s, 3).buzzer).toBe(2);
    expect(JSON.stringify(view(s, 3))).not.toContain(word);
  });

  it('正解で点が入ってターンが終わり、点は押したときの残り秒で決まる', () => {
    for (const [wait, points] of [
      [0, 3],
      [25, 2],
      [45, 1]
    ] as const) {
      const s = hayaoshi();
      const word = go(s);
      run(s, wait);
      buzz(s, 3, fixed, WORDS);
      expect(answer(s, 3, s.options.indexOf(word))).toBe('right');
      expect(s.scores).toEqual({ 1: 2, 2: 0, 3: points });
      expect(s.phase).toBe('reveal');
      expect(s.solved).toEqual([3]);
    }
  });

  it('外れはおてつきで、その人はもう押せず、ほかの人は押せる', () => {
    const s = hayaoshi();
    const word = go(s);
    buzz(s, 2, fixed, WORDS);
    const wrong = s.options.findIndex((o) => o !== word);
    expect(answer(s, 2, wrong)).toBe('wrong');
    expect(s.out).toEqual([2]);
    expect(s.buzzer).toBeNull();
    expect(buzz(s, 2, fixed, WORDS)).toBe(false);
    expect(buzz(s, 3, fixed, WORDS)).toBe(true);
    expect(s.phase).toBe('draw');
  });

  it('答えている本人以外と、候補にない番号の答えは受け付けない', () => {
    const s = hayaoshi();
    go(s);
    buzz(s, 2, fixed, WORDS);
    expect(answer(s, 3, 0)).toBeNull();
    expect(answer(s, 2, 9)).toBeNull();
    expect(s.buzzer).toBe(2);
  });

  it('5 秒のうちに選ばなければおてつきになる', () => {
    const s = hayaoshi();
    go(s);
    buzz(s, 2, fixed, WORDS);
    run(s, ANSWER_S + 0.25);
    expect(s.out).toEqual([2]);
    expect(s.buzzer).toBeNull();
  });

  it('答える時間が切れた回の tick は、時間切れになった人を返す（ほかの回は null）', () => {
    const s = hayaoshi();
    go(s);
    buzz(s, 2, fixed, WORDS);
    expect(tick(s, 1, fixed, WORDS)).toBeNull();
    expect(tick(s, ANSWER_S, fixed, WORDS)).toBe(2);
    expect(tick(s, 1, fixed, WORDS)).toBeNull();
  });

  it('当てる人が全員おてつきになるとターンが終わる', () => {
    const s = hayaoshi();
    const word = go(s);
    for (const seat of [2, 3] as const) {
      buzz(s, seat, fixed, WORDS);
      answer(
        s,
        seat,
        s.options.findIndex((o) => o !== word)
      );
    }
    expect(s.phase).toBe('reveal');
    expect(s.scores).toEqual({ 1: 0, 2: 0, 3: 0 });
  });

  it('答えている途中で描く時間が切れたら、答えを待たずにターンを終える', () => {
    const s = hayaoshi();
    go(s);
    run(s, LENGTHS.normal.draw.hayaoshi - 1);
    buzz(s, 2, fixed, WORDS);
    run(s, 1.5);
    expect(s.phase).toBe('reveal');
    expect(s.buzzer).toBeNull();
  });
});

describe('leave', () => {
  it('描いている人が抜けたら、答えを見せずに次の人の番へ移り、その人の番は飛ばす', () => {
    const s = game();
    go(s);
    leave(s, 1, fixed, WORDS);
    expect(s.players).toEqual([2, 3]);
    expect(s.phase).toBe('ready');
    expect(drawer(s)).toBe(2);
    expect(s.order.slice(s.turn)).toEqual([2, 3, 2, 3]);
  });

  it('描く人が準備のあいだに抜けても、次の人の番へ移る', () => {
    const s = game();
    leave(s, 1, fixed, WORDS);
    expect(s.phase).toBe('ready');
    expect(drawer(s)).toBe(2);
  });

  it('当てる人が抜けて残りが全員当てていたら、答えを見せる', () => {
    const s = game();
    const word = go(s);
    guess(s, 2, word);
    leave(s, 3, fixed, WORDS);
    expect(s.phase).toBe('reveal');
  });

  it('答えている人が抜けたら、ほかの人が押せる', () => {
    const s = hayaoshi();
    go(s);
    buzz(s, 2, fixed, WORDS);
    leave(s, 2, fixed, WORDS);
    expect(s.buzzer).toBeNull();
    expect(s.phase).toBe('draw');
    expect(buzz(s, 3, fixed, WORDS)).toBe(true);
  });

  it('1 人になったら done。抜けた人の点は残す', () => {
    const s = game([1, 2]);
    const word = go(s);
    guess(s, 2, word);
    leave(s, 2, fixed, WORDS);
    expect(s.phase).toBe('done');
    expect(s.scores[2]).toBe(3);
  });
});

describe('view', () => {
  it('当てていない人にはお題を渡さず、字数の○とヒントの字だけを渡す', () => {
    const s = create([1, 2, 3], fixed, ['らいおん', 'きりん']);
    const word = go(s);
    expect(view(s, 1).word).toBe(word);
    expect(view(s, 2).word).toBeNull();
    expect(view(s, 2).mask).toBe('○○○○');
    expect(JSON.stringify(view(s, 2))).not.toContain(word);
    run(s, LENGTHS.normal.draw.egokoro - 44);
    expect(view(s, 3).mask).toBe('ら○○○');
    guess(s, 2, word);
    expect(view(s, 2).word).toBe(word);
    expect(view(s, 3).word).toBeNull();
  });

  it('準備のあいだ、お題は描く人にだけ渡す', () => {
    const s = game();
    expect(view(s, 1).word).toBe(s.word);
    expect(view(s, 2).word).toBeNull();
    expect(JSON.stringify(view(s, 2))).not.toContain(s.word);
  });

  it('答えを見せる時間は全員にお題を渡し、残り秒は切り上げる', () => {
    const s = game();
    go(s);
    run(s, LENGTHS.normal.draw.egokoro + 0.5);
    expect(view(s, 3).word).toBe(s.word);
    expect(Number.isInteger(view(s, 3).left)).toBe(true);
  });
});

describe('rejoin', () => {
  it('抜けた人が戻ったら当てる人として加え、点数は抜ける前のまま、描く番は戻さない', () => {
    const s = game();
    const word = go(s);
    guess(s, 3, word);
    leave(s, 3, fixed, WORDS);
    const order = [...s.order];
    rejoin(s, 3);
    expect(s.players).toEqual([1, 2, 3]);
    expect(s.scores[3]).toBe(3);
    expect(s.order).toEqual(order);
  });

  it('終わった遊びや、いる人には何もしない', () => {
    const s = game([1, 2]);
    leave(s, 2, fixed, WORDS);
    rejoin(s, 2);
    expect(s.players).toEqual([1]);
    const t = game();
    rejoin(t, 2);
    expect(t.players).toEqual([1, 2, 3]);
  });

  it('遊びの途中から来た人は 0 点で加わる', () => {
    const s = game([1, 2]);
    rejoin(s, 3);
    expect(s.players).toEqual([1, 2, 3]);
    expect(s.scores[3]).toBe(0);
  });
});

describe('length', () => {
  it('みじかめは 1 回ずつ 60 秒、ながめは 3 回ずつ 120 秒', () => {
    const short = create([1, 2], fixed, WORDS, 'egokoro', 'short');
    expect(short.order).toEqual([1, 2]);
    go(short);
    expect(short.left).toBe(60);
    const long = create([1, 2], fixed, WORDS, 'hayaoshi', 'long');
    expect(long.order).toEqual([1, 2, 1, 2, 1, 2]);
    go(long);
    expect(long.left).toBe(80);
  });

  // 描く時間が長さで変わるので、はやおしの点は残り秒ではなく描く時間に対する割合で決める
  it('はやおし検定の点は、描く時間の 2/3 以上残っていれば 3 点、1/3 以上なら 2 点', () => {
    const s = create([1, 2], fixed, WORDS, 'hayaoshi', 'long');
    go(s);
    run(s, 80 / 3 + 1);
    buzz(s, 2, fixed, WORDS);
    answer(s, 2, s.options.indexOf(s.word));
    expect(s.scores[2]).toBe(2);
  });
});
