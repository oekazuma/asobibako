// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backupFile, exportAll, importAll, parseBackup, summarize, type Backup } from './backup';

const file = (data: Record<string, unknown>) => JSON.stringify({ app: 'asobibako', version: 'v', at: 'd', data });

describe('backup', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('書き出し → 消去 → 読み込みで table-duel: のキーだけが元に戻り、端末ごとの控えは触らない', () => {
    localStorage.setItem('table-duel:reached:maze', '5');
    localStorage.setItem('table-duel:level:snake', '40');
    localStorage.setItem('table-duel:muted', '1');
    localStorage.setItem('table-duel:last-error', 'old-error');
    localStorage.setItem('table-duel:gate', 'old-gate');
    localStorage.setItem('other', 'keep');
    const b = parseBackup(exportAll('123-abc'));
    expect(b.version).toBe('123-abc');
    expect(Object.keys(b.data).sort()).toEqual([
      'table-duel:level:snake',
      'table-duel:muted',
      'table-duel:reached:maze'
    ]);
    expect(summarize(b)).toMatchObject({ games: 2, keys: 3 });

    localStorage.clear();
    localStorage.setItem('table-duel:reached:stale', '9');
    localStorage.setItem('table-duel:last-error', 'new-error');
    localStorage.setItem('table-duel:gate', 'new-gate');
    localStorage.setItem('other', 'keep');
    expect(importAll(b)).toBe(true);
    expect(localStorage.getItem('table-duel:reached:maze')).toBe('5');
    expect(localStorage.getItem('table-duel:reached:stale')).toBeNull();
    expect(localStorage.getItem('table-duel:last-error')).toBe('new-error');
    expect(localStorage.getItem('table-duel:gate')).toBe('new-gate');
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
    expect(() => parseBackup(file({ 'table-duel:muted': 1 }))).toThrow();
    expect(() => parseBackup(file({ 'table-duel:gate': '{}' }))).toThrow();
    expect(() => parseBackup(file({ 'table-duel:last-error': '{}' }))).toThrow();
    expect(parseBackup(file({})).data).toEqual({});
  });

  it('キー数・大きさが常識外のファイルは受け付けない', () => {
    const data: Record<string, string> = {};
    for (let i = 0; i < 401; i++) data[`table-duel:x${i}`] = 'v';
    expect(() => parseBackup(file(data))).toThrow();
    expect(() => parseBackup('a'.repeat(1024 * 1024 + 1))).toThrow();
  });

  it('途中で容量超過しても元の記録に戻り false を返す', () => {
    localStorage.setItem('table-duel:reached:maze', 'orig-maze');
    localStorage.setItem('table-duel:muted', 'orig-muted');
    const b: Backup = {
      app: 'asobibako',
      version: 'v',
      at: 'd',
      data: { 'table-duel:reached:maze': 'new-maze', 'table-duel:reached:snake': 'new-snake' }
    };
    // happy-dom では Storage.prototype への spy がインスタンスの呼び出しに効かないため、インスタンス自身に spy する
    const original = localStorage.setItem.bind(localStorage);
    let calls = 0;
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (++calls === 2) throw new DOMException('quota', 'QuotaExceededError');
      original(key, value);
    });

    expect(importAll(b)).toBe(false);
    expect(localStorage.getItem('table-duel:reached:maze')).toBe('orig-maze');
    expect(localStorage.getItem('table-duel:muted')).toBe('orig-muted');
    expect(localStorage.getItem('table-duel:reached:snake')).toBeNull();
  });
});
