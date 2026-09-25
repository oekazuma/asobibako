import { describe, expect, it } from 'vitest';
import { TRICKS } from './engine';
import { chart, lessons, MOTION, Play, rankOf, SongClock, type Note, type RhythmEvent } from './rhythm';
import type { TrickId } from './types';

const BPM = 100;

/** 指 1 本で、そのノーツの動きを off 秒ずらしてする。動きの形は shape で替えられる */
function perform(play: Play, i: number, off = 0, shape?: Note['motion']): RhythmEvent[] {
  const n = play.notes[i];
  const t = n.t + off;
  const out = play.press(i, t, 200, 400);
  const m = shape ?? n.motion;
  const at = (k: number, x: number, y: number) => out.push(...play.drag(i, t + k * 0.2, x, y));
  if (m === 'down' || m === 'up' || m === 'side')
    for (let k = 1; k <= 5; k++)
      at(k / 5, 200 + (m === 'side' ? k * 16 : 0), 400 + (m === 'down' ? k * 16 : m === 'up' ? -k * 16 : 0));
  if (m === 'circle')
    for (let k = 1; k <= 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      at(k / 40, 200 + Math.sin(a) * 50, 350 + Math.cos(a) * 50);
    }
  const end = m === 'hold' ? n.t + n.len : t + 0.2;
  out.push(...play.release(i, end, 200, 400));
  return out;
}

const hitOf = (events: RhythmEvent[], note: number) => events.find((e) => e.type === 'hit' && e.note === note);

const playAll = (trick: TrickId, off: (i: number) => number = () => 0) => {
  const c = chart(trick, BPM);
  const play = new Play(c);
  c.notes.forEach((_, i) => perform(play, i, off(i)));
  play.advance(c.length);
  return play;
};

describe('譜面', () => {
  it('どの芸にも、その芸の動きのノーツが混ざり、曲は 30〜45 秒', () => {
    for (const t of TRICKS) {
      const c = chart(t.id, BPM);
      expect(c.notes.some((n) => n.trick && n.motion === MOTION[t.id])).toBe(true);
      expect(c.notes.some((n) => !n.trick && n.motion === 'tap')).toBe(true);
      expect(c.length).toBeGreaterThanOrEqual(30);
      expect(c.length).toBeLessThanOrEqual(45);
      expect(c.notes.at(-1)!.t + c.notes.at(-1)!.len).toBeLessThan(c.length);
    }
  });

  it('ノーツは 0.5 秒より詰まらず、ぐるっと・長押しのあとは 1.2 秒あく', () => {
    for (const trick of ['spin', 'dead', 'sit'] as TrickId[]) {
      const { notes } = chart(trick, BPM);
      for (let i = 1; i < notes.length; i++) {
        const prev = notes[i - 1];
        expect(notes[i].t - prev.t).toBeGreaterThanOrEqual(0.5);
        if (prev.motion === 'circle' || prev.motion === 'hold')
          expect(notes[i].t - prev.t).toBeGreaterThanOrEqual(1.19);
      }
    }
  });

  it('フレーズは 4〜8 ノーツで、最後が芸の動き', () => {
    const { notes } = chart('roll', BPM);
    const phrases = [...new Set(notes.map((n) => n.phrase))].map((p) => notes.filter((n) => n.phrase === p));
    for (const list of phrases) {
      expect(list.length).toBeGreaterThanOrEqual(4);
      expect(list.length).toBeLessThanOrEqual(8);
      expect(list.at(-1)!.last && list.at(-1)!.trick).toBe(true);
    }
  });
});

describe('判定', () => {
  it('ぴったりはすごい、±150ms まではいいね、±250ms まではおしい。おしいでもコンボはつながる', () => {
    const play = new Play(chart('paw', BPM));
    const grade = (i: number, off: number) => hitOf(perform(play, i, off), i);
    expect(grade(0, 0.02)).toMatchObject({ grade: 'great', broke: false });
    expect(grade(1, -0.12)).toMatchObject({ grade: 'good' });
    expect(grade(2, 0.14)).toMatchObject({ grade: 'good' });
    expect(grade(3, -0.22)).toMatchObject({ grade: 'near', broke: false });
    expect(play.combo).toBe(4);
  });

  it('幅の外で押しても何も起きず、叩かずに過ぎたら miss でコンボが切れる', () => {
    const c = chart('paw', BPM);
    const play = new Play(c);
    perform(play, 0);
    expect(play.press(9, c.notes[1].t - 0.35, 0, 0)).toEqual([]);
    expect(play.combo).toBe(1);
    const out = play.advance(c.notes[1].t + 0.3);
    expect(out).toContainEqual({ type: 'hit', note: 1, grade: 'miss', broke: true });
    expect(play.combo).toBe(0);
    expect(play.maxCombo).toBe(1);
  });

  it('スワイプは向きが合えば押した時刻の判定、ちがう向き・タップだけならおしいでコンボが切れる', () => {
    const c = chart('sit', BPM);
    const g = c.notes.findIndex((n) => n.trick);
    const hit = (shape?: Note['motion']) => hitOf(perform(new Play(c), g, 0.1, shape), g);
    expect(hit()).toMatchObject({ grade: 'good', broke: false });
    expect(hit('up')).toMatchObject({ grade: 'near', broke: true });
    expect(hit('tap')).toMatchObject({ grade: 'near', broke: true });
    const roll = chart('roll', BPM);
    const r = roll.notes.findIndex((n) => n.trick);
    expect(hitOf(perform(new Play(roll), r, 0, 'side'), r)).toMatchObject({ grade: 'great' });
    expect(hitOf(perform(new Play(roll), r, 0, 'down'), r)).toMatchObject({ broke: true });
  });

  it('ぐるっとは 1 周近く回したときだけ、長押しは終わりまで押さえたときだけ', () => {
    const spin = chart('spin', BPM);
    const s = spin.notes.findIndex((n) => n.trick);
    expect(hitOf(perform(new Play(spin), s), s)).toMatchObject({ grade: 'great', broke: false });
    expect(hitOf(perform(new Play(spin), s, 0, 'side'), s)).toMatchObject({ broke: true });
    const dead = chart('dead', BPM);
    const d = dead.notes.findIndex((n) => n.trick);
    expect(hitOf(perform(new Play(dead), d), d)).toMatchObject({ grade: 'great', broke: false });
    const early = new Play(dead);
    early.press(1, dead.notes[d].t, 0, 0);
    expect(hitOf(early.release(1, dead.notes[d].t + 0.2, 0, 0), d)).toMatchObject({ grade: 'near', broke: true });
  });

  it('フレーズをつなげきると、その最後で芸をする', () => {
    const c = chart('jump', BPM);
    const play = new Play(c);
    const events = c.notes.slice(0, 4).flatMap((_, i) => perform(play, i));
    expect(events.at(-1)).toEqual({ type: 'phrase', phrase: 0, ok: true });
    const broken = new Play(c);
    perform(broken, 0);
    const later = c.notes.slice(2, 4).flatMap((_, k) => perform(broken, k + 2));
    expect(later.at(-1)).toEqual({ type: 'phrase', phrase: 0, ok: false });
  });
});

describe('成績', () => {
  it('ぴったりなら S で一気に覚え、ずれるほどランクと進む回数が下がる', () => {
    const s = playAll('sit').result();
    expect(s).toMatchObject({ rank: 'S', miss: 0, ratio: 1 });
    expect(s.maxCombo).toBe(chart('sit', BPM).notes.length);
    expect(lessons(s)).toBeGreaterThanOrEqual(8);
    const good = playAll('sit', () => 0.12).result();
    expect(good.rank).toBe('B');
    expect(good.good).toBe(chart('sit', BPM).notes.length);
    // 実機で音と指のずれを見積もる平均
    expect(good.offset).toBeCloseTo(0.12);
    expect(s.offset).toBeCloseTo(0);
    const none = new Play(chart('sit', BPM));
    none.advance(99);
    expect(none.result()).toMatchObject({ rank: 'C', miss: none.notes.length, score: 0 });
    expect(lessons(none.result())).toBe(1);
  });

  it('A は 2〜3 回、B は 1〜2 回、C は 1 回', () => {
    expect([0.95, 0.85, 0.76, 0.7, 0.55, 0.2].map((r) => [rankOf(r), lessons({ rank: rankOf(r), ratio: r })])).toEqual([
      ['S', 99],
      ['A', 3],
      ['A', 2],
      ['B', 2],
      ['B', 1],
      ['C', 1]
    ]);
  });
});

describe('曲の時計', () => {
  it('音が無くても performance の時計で進み、途中でミュートを切り替えても飛ばない', () => {
    const c = new SongClock();
    expect(c.read(null, 100)).toBe(0);
    expect(c.read(null, 100.5)).toBeCloseTo(0.5);
    // 音が鳴りはじめた。AudioContext の時計は performance と無関係な値から始まる
    expect(c.read(3, 100.52)).toBeCloseTo(0.52);
    expect(c.read(3.1, 100.62)).toBeCloseTo(0.62);
    // ミュートした
    expect(c.read(null, 100.64)).toBeCloseTo(0.64);
    expect(c.read(null, 100.7)).toBeCloseTo(0.7);
  });

  it('画面が隠れて読めなかったあいだは止まっている', () => {
    const c = new SongClock();
    c.read(null, 10);
    c.read(null, 11);
    expect(c.read(null, 30)).toBeCloseTo(1);
    expect(c.read(null, 30.2)).toBeCloseTo(1.2);
  });

  it('音なし（ctx が無い）でも、見た目の時計でぴったり叩けば S になる', () => {
    const ch = chart('beg', BPM);
    const play = new Play(ch);
    const clock = new SongClock();
    const start = 5000;
    let w = start;
    clock.read(null, w);
    ch.notes.forEach((n, i) => {
      // 画面のフレームごとに読む（60 回/秒）。ノーツが輪に重なったフレームで押す
      for (; w < start + n.t; w += 1 / 60) play.advance(clock.read(null, w));
      w = start + n.t;
      play.press(i, clock.read(null, w), 200, 400);
      for (let k = 1; k <= 4; k++) play.drag(i, clock.read(null, (w += 0.03)), 200, 400 - k * 15);
      play.release(i, clock.read(null, (w += 0.03)), 200, 340);
    });
    play.advance(clock.read(null, start + ch.length));
    expect(play.result().rank).toBe('S');
  });
});
