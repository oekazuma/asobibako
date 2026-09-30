import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './templates';

describe('TEMPLATES', () => {
  it('8 枚で、id が重ならず、名前とパスがある', () => {
    expect(TEMPLATES).toHaveLength(8);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(8);
    for (const t of TEMPLATES) {
      expect(t.name, t.id).not.toBe('');
      expect(t.d, t.id).toMatch(/^M/);
    }
  });
});
