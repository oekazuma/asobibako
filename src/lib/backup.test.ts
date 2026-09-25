// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backupDue,
  backupFile,
  exportAll,
  importAll,
  markBackedUp,
  parseBackup,
  summarize,
  type Backup
} from './backup';

const file = (data: Record<string, unknown>) => JSON.stringify({ app: 'asobibako', version: 'v', at: 'd', data });

describe('backup', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('書き出し → 消去 → 読み込みで asobibako: のキーだけが元に戻り、端末ごとの控えは触らない', () => {
    localStorage.setItem('asobibako:reached:maze', '5');
    localStorage.setItem('asobibako:level:snake', '40');
    localStorage.setItem('asobibako:muted', '1');
    localStorage.setItem('asobibako:last-error', 'old-error');
    localStorage.setItem('asobibako:gate', 'old-gate');
    localStorage.setItem('asobibako:graphics', 'low');
    localStorage.setItem('other', 'keep');
    const b = parseBackup(exportAll('123-abc'));
    expect(b.version).toBe('123-abc');
    expect(Object.keys(b.data).sort()).toEqual(['asobibako:level:snake', 'asobibako:muted', 'asobibako:reached:maze']);
    expect(summarize(b)).toMatchObject({ games: 2, keys: 3 });

    localStorage.clear();
    localStorage.setItem('asobibako:reached:stale', '9');
    localStorage.setItem('asobibako:last-error', 'new-error');
    localStorage.setItem('asobibako:gate', 'new-gate');
    localStorage.setItem('asobibako:graphics', 'high');
    localStorage.setItem('other', 'keep');
    expect(importAll(b)).toBe(true);
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('5');
    expect(localStorage.getItem('asobibako:reached:stale')).toBeNull();
    expect(localStorage.getItem('asobibako:last-error')).toBe('new-error');
    expect(localStorage.getItem('asobibako:gate')).toBe('new-gate');
    expect(localStorage.getItem('asobibako:graphics')).toBe('high');
    expect(localStorage.getItem('other')).toBe('keep');
  });

  it('共有シート用の File は日付入りの名前と型を持ち、中身は書き出しと同じ', async () => {
    const f = backupFile('123-abc');
    expect(f.name).toMatch(/^asobibako-\d{4}-\d{2}-\d{2}\.json$/);
    expect(f.type).toBe('application/json');
    // happy-dom は File.text を持たないため Response 経由で読む
    expect(parseBackup(await new Response(f).text()).version).toBe('123-abc');
  });

  it('形が違うファイルは受け付けない', () => {
    expect(() => parseBackup('{')).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'kakikaki', version: 'v', at: 'd', data: {} }))).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'asobibako', data: {} }))).toThrow();
    expect(() => parseBackup(file({ evil: 'x' }))).toThrow();
    expect(() => parseBackup(file({ 'asobibako:muted': 1 }))).toThrow();
    expect(() => parseBackup(file({ 'asobibako:gate': '{}' }))).toThrow();
    expect(() => parseBackup(file({ 'asobibako:last-error': '{}' }))).toThrow();
    expect(() => parseBackup(file({ 'asobibako:graphics': 'high' }))).toThrow();
    expect(parseBackup(file({})).data).toEqual({});
  });

  it('キー数・大きさが常識外のファイルは受け付けない', () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < 401; i++) data[`asobibako:x${i}`] = 'v';
    expect(() => parseBackup(file(data))).toThrow();
    expect(() => parseBackup('a'.repeat(1024 * 1024 + 1))).toThrow();
  });

  it('途中で容量超過しても元の記録に戻り false を返す', () => {
    localStorage.setItem('asobibako:reached:maze', 'orig-maze');
    localStorage.setItem('asobibako:muted', 'orig-muted');
    const b: Backup = {
      app: 'asobibako',
      version: 'v',
      at: 'd',
      data: { 'asobibako:reached:maze': 'new-maze', 'asobibako:reached:snake': 'new-snake' }
    };
    // happy-dom では Storage.prototype への spy がインスタンスの呼び出しに効かないため、インスタンス自身に spy する
    const original = localStorage.setItem.bind(localStorage);
    let calls = 0;
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (++calls === 2) throw new DOMException('quota', 'QuotaExceededError');
      original(key, value);
    });

    expect(importAll(b)).toBe(false);
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('orig-maze');
    expect(localStorage.getItem('asobibako:muted')).toBe('orig-muted');
    expect(localStorage.getItem('asobibako:reached:snake')).toBeNull();
  });

  it('写真やずかんで 1MB を超えた書き出しも読み込める', () => {
    const big = 'x'.repeat(3 * 1024 * 1024);
    expect(parseBackup(file({ 'asobibako:pet-house:photos': big })).data['asobibako:pet-house:photos']).toBe(big);
  });

  it('記録があるのに書き出していないか、最後の書き出しが 7 日より前なら書き出しを勧める', () => {
    expect(backupDue('2026-09-26')).toBe(false);
    localStorage.setItem('asobibako:reached:maze', '5');
    expect(backupDue('2026-09-26')).toBe(true);
    markBackedUp();
    const at = localStorage.getItem('asobibako:backup-at')!;
    expect(backupDue(at)).toBe(false);
    localStorage.setItem('asobibako:backup-at', '2026-09-18');
    expect(backupDue('2026-09-25')).toBe(false);
    expect(backupDue('2026-09-26')).toBe(true);
  });
});
