import { describe, expect, it } from 'vitest';
import { typed } from './typing';

describe('typed', () => {
  it('知らせの字をその人の欄に入れ、空の字なら欄を消す', () => {
    expect(typed({}, 2, 'り')).toEqual({ 2: 'り' });
    expect(typed({ 2: 'り', 3: '●' }, 2, '')).toEqual({ 3: '●' });
  });
});
