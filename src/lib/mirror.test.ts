// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { restoreIfEmpty, snapshot, type Store } from './mirror';

function memory(): Store & { text?: string } {
  const s: Store & { text?: string } = {
    get: async () => s.text,
    set: async (text) => void (s.text = text)
  };
  return s;
}

afterEach(() => localStorage.clear());

describe('mirror', () => {
  it('記録が消えたら、起動したときに控えから全部戻す', async () => {
    localStorage.setItem('asobibako:pet-house', '{"money":120}');
    localStorage.setItem('asobibako:doodle-worm:stock', '[{"id":"a"}]');
    const store = memory();
    await snapshot('v1', store);
    localStorage.clear();
    expect(await restoreIfEmpty(store)).toBe(true);
    expect(localStorage.getItem('asobibako:pet-house')).toBe('{"money":120}');
    expect(localStorage.getItem('asobibako:doodle-worm:stock')).toBe('[{"id":"a"}]');
  });

  it('記録が残っていれば戻さず、空の記録で控えを上書きしない', async () => {
    const store = memory();
    localStorage.setItem('asobibako:reached:maze', '5');
    await snapshot('v1', store);
    const kept = store.text;
    localStorage.setItem('asobibako:reached:maze', '9');
    expect(await restoreIfEmpty(store)).toBe(false);
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('9');
    localStorage.clear();
    await snapshot('v2', store);
    expect(store.text).toBe(kept);
  });

  it('控えが開けずに止まっても、待ちすぎずに起動を続ける', async () => {
    const stuck: Store = { get: () => new Promise(() => {}), set: async () => {} };
    const started = Date.now();
    expect(await restoreIfEmpty(stuck, 50)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
