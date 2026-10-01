import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import {
  addInk,
  assignee,
  createRelay,
  finish,
  GUESS_S,
  leave,
  next,
  pageOf,
  rejoin,
  taskOf,
  tick,
  UNKNOWN,
  type Relay
} from './relay';

const WORDS = ['いぬ', 'ねこ', 'くま', 'うし', 'さる', 'たこ', 'かに', 'いか'];
const fixed = () => 0;
const relay = (players: Seat[] = [1, 2, 3]) => createRelay(players, fixed, WORDS, 'short', null);
/** 全員を「できた」にして、だんを進める */
const allDone = (s: Relay, text = 'くま') => {
  for (const seat of s.present) finish(s, seat, text);
  tick(s, 0, fixed, WORDS, {});
};

describe('relay', () => {
  it('人数ぶんのリレーを、ちがうお題で始める', () => {
    const s = relay();
    expect(s.chains).toHaveLength(3);
    expect(new Set(s.chains.map((c) => c.start)).size).toBe(3);
    expect(s.steps).toBe(4);
  });

  it('どのだんも、1 人がちょうど 1 本のリレーを受け持つ', () => {
    for (const players of [
      [1, 2],
      [1, 2, 3]
    ] as Seat[][]) {
      const s = relay(players);
      for (let step = 0; step < s.steps; step++) {
        const seats = s.chains.map((_, c) => assignee(s, c, step));
        expect(new Set(seats).size).toBe(players.length);
      }
    }
  });

  it('描くだんは言葉、当てるだんは前の絵を受け持つ人に渡す', () => {
    const s = relay([1, 2]);
    expect(taskOf(s, 1)).toEqual({ kind: 'draw', word: s.chains[0].start });
    addInk(s, 1, { k: 'start', color: '#000', size: 0.01, x: 0.1, y: 0.1 });
    allDone(s);
    const task = taskOf(s, 2);
    expect(task.kind).toBe('guess');
    expect(task.kind === 'guess' && task.strokes).toHaveLength(1);
  });

  it('線は受け持ったリレーのこまにだけたまる', () => {
    const s = relay([1, 2]);
    addInk(s, 2, { k: 'start', color: '#000', size: 0.01, x: 0.5, y: 0.5 });
    const drawn = s.chains.map((c) => (c.entries[0].kind === 'draw' ? c.entries[0].strokes.length : -1));
    expect(drawn).toEqual([0, 1]);
  });

  it('全員がそろうか時間が切れたら次のだんへ進み、最後のあとはふりかえりに入る', () => {
    const s = relay([1, 2]);
    finish(s, 1);
    tick(s, 0, fixed, WORDS, {});
    expect(s.step).toBe(0);
    finish(s, 2);
    tick(s, 0, fixed, WORDS, {});
    expect(s.step).toBe(1);
    tick(s, GUESS_S + 1, fixed, WORDS, {});
    expect(s.step).toBe(2);
    allDone(s);
    allDone(s);
    expect(s.phase).toBe('reveal');
  });

  it('当てる時間が切れたら打ちかけの字を答えにし、何も無ければわからなかったにして新しいお題を配る', () => {
    const s = relay([1, 2]);
    allDone(s);
    tick(s, GUESS_S + 1, fixed, WORDS, { 2: 'りん' });
    const guesses = s.chains.map((c) => c.entries[1]);
    expect(guesses[0]).toEqual({ kind: 'guess', by: 2, text: 'りん' });
    expect(guesses[1]).toEqual({ kind: 'guess', by: 1, text: null });
    expect(taskOf(s, 1)).toEqual({ kind: 'draw', word: 'りん' });
    const fresh = taskOf(s, 2);
    expect(fresh.kind === 'draw' && WORDS.includes(fresh.word)).toBe(true);
    expect(s.chains[1].entries[2].kind).toBe('prompt');
    expect(UNKNOWN).toContain('わからなかった');
  });

  it('抜けた人のこまは埋めて進め、1 人になったらふりかえりに入る', () => {
    const s = relay();
    finish(s, 1);
    finish(s, 2);
    leave(s, 3);
    tick(s, 0, fixed, WORDS, {});
    expect(s.step).toBe(1);
    leave(s, 2);
    expect(s.phase).toBe('reveal');
  });

  it('戻った人は次のだんから受け持ち、そのだんでは待つ', () => {
    const s = relay();
    leave(s, 3);
    rejoin(s, 3);
    expect(taskOf(s, 3)).toEqual({ kind: 'wait' });
    finish(s, 1);
    finish(s, 2);
    tick(s, 0, fixed, WORDS, {});
    expect(taskOf(s, 3).kind).toBe('guess');
  });

  it('ふりかえりは最初のお題からこまを順にめくり、全部のリレーのあとに done になる', () => {
    const s = relay([1, 2]);
    for (let i = 0; i < s.steps; i++) allDone(s);
    expect(pageOf(s)).toEqual({ chain: 0, index: 0, entry: { kind: 'prompt', text: s.chains[0].start }, last: false });
    for (let i = 0; i < 4; i++) next(s);
    expect(pageOf(s)?.last).toBe(true);
    next(s);
    expect(pageOf(s)?.chain).toBe(1);
    for (let i = 0; i < 5; i++) next(s);
    expect(s.phase).toBe('done');
  });
});
