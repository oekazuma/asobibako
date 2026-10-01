import { describe, expect, it } from 'vitest';
import { TEMPLATES } from './templates';

describe('TEMPLATES', () => {
  it('24 枚で、id と名前が重ならず、名前とパスがある', () => {
    expect(TEMPLATES).toHaveLength(24);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(24);
    expect(new Set(TEMPLATES.map((t) => t.name)).size).toBe(24);
    for (const t of TEMPLATES) {
      expect(t.name, t.id).not.toBe('');
      expect(t.d, t.id).toMatch(/^M/);
    }
  });
});
