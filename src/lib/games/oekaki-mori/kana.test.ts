import { describe, expect, it } from 'vitest';
import { COLUMNS, cycle, judge, plain } from './kana';

describe('COLUMNS', () => {
  it('10 列 5 マスで、清音 45 字と を・ん がある', () => {
    expect(COLUMNS).toHaveLength(10);
    for (const column of COLUMNS) expect(column).toHaveLength(5);
    const keys = COLUMNS.flat().filter(Boolean);
    expect(keys).toHaveLength(46);
    expect(keys).toContain('を');
    expect(keys).toContain('ん');
  });
});

describe('cycle', () => {
  it('か行は濁点と行き来する', () => {
    expect(cycle('か')).toBe('が');
    expect(cycle('が')).toBe('か');
  });

  it('は行は濁点、半濁点、もとの字の順', () => {
    expect(cycle('は')).toBe('ば');
    expect(cycle('ば')).toBe('ぱ');
    expect(cycle('ぱ')).toBe('は');
  });

  it('つは濁点、小さい字、もとの字の順', () => {
    expect(cycle('つ')).toBe('づ');
    expect(cycle('づ')).toBe('っ');
    expect(cycle('っ')).toBe('つ');
  });

  it('や行とあ行は小さい字と行き来する', () => {
    expect(cycle('や')).toBe('ゃ');
    expect(cycle('ゃ')).toBe('や');
    expect(cycle('あ')).toBe('ぁ');
  });

  it('変えられない字と「ー」はそのまま', () => {
    expect(cycle('ん')).toBe('ん');
    expect(cycle('ま')).toBe('ま');
    expect(cycle('ー')).toBe('ー');
  });
});

describe('plain', () => {
  it('濁点・半濁点を外し、小さい字を大きくする', () => {
    expect(plain('ぎゅうにゅう')).toBe('きゆうにゆう');
    expect(plain('ぱんだ')).toBe('はんた');
    expect(plain('けーき')).toBe('けーき');
  });
});

describe('judge', () => {
  it('同じ並びはせいかい', () => {
    expect(judge('ぞう', 'ぞう')).toBe('right');
  });

  it('濁点や小さい字だけが違うのはおしい', () => {
    expect(judge('ぞう', 'そう')).toBe('close');
    expect(judge('しょうぼうしゃ', 'しようほうしや')).toBe('close');
  });

  it('それ以外ははずれ', () => {
    expect(judge('ぞう', 'きりん')).toBe('wrong');
    expect(judge('ぞう', '')).toBe('wrong');
  });
});
