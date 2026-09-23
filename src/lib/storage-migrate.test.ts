// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateStorage } from './storage-migrate';

describe('migrateStorage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('table-duel: のキーを asobibako: へ移し、旧名を消す。ほかのキーには触らない', () => {
    localStorage.setItem('table-duel:reached:maze', '5');
    localStorage.setItem('table-duel:muted', '1');
    localStorage.setItem('other', 'keep');
    migrateStorage();
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('5');
    expect(localStorage.getItem('asobibako:muted')).toBe('1');
    expect(localStorage.getItem('table-duel:reached:maze')).toBeNull();
    expect(localStorage.getItem('table-duel:muted')).toBeNull();
    expect(localStorage.getItem('other')).toBe('keep');
  });

  it('新しい名前がすでにあれば上書きしない', () => {
    localStorage.setItem('table-duel:reached:maze', '5');
    localStorage.setItem('asobibako:reached:maze', '9');
    migrateStorage();
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('9');
    expect(localStorage.getItem('table-duel:reached:maze')).toBeNull();
  });

  it('localStorage が使えなくても投げない', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => migrateStorage()).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('容量超過で書けなければ旧名を残す', () => {
    localStorage.setItem('table-duel:reached:maze', '5');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => migrateStorage()).not.toThrow();
    expect(localStorage.getItem('table-duel:reached:maze')).toBe('5');
  });
});
