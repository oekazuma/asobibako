import { describe, expect, it } from 'vitest';
import { LOOKS, lookOf, who } from './looks';

describe('looks', () => {
  it('動物は 8 つで、名前はひらがな', () => {
    expect(LOOKS).toHaveLength(8);
    expect(lookOf('rabbit')?.name).toBe('うさぎ');
    expect(lookOf('dragon')).toBeUndefined();
  });

  it('who は動物の名前を返し、届いていない番号には番号を返す', () => {
    expect(who(2, { 2: 'cat' })).toBe('ねこ');
    expect(who(3, { 2: 'cat' })).toBe('3P');
  });
});
