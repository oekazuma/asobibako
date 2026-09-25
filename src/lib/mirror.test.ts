// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Store } from './mirror';

function memory(): Store & { text?: string } {
  const s: Store & { text?: string } = {
    get: async () => s.text,
    set: async (text) => void (s.text = text)
  };
  return s;
}

const file = (data: Record<string, string>) => JSON.stringify({ app: 'asobibako', version: 'v', at: 'd', data });

// verified と last はモジュール変数なので、テストごとに読み直して前のテストの状態を持ち越さない
let m: typeof import('./mirror');
beforeEach(async () => {
  localStorage.clear();
  vi.resetModules();
  m = await import('./mirror');
});
afterEach(() => vi.unstubAllGlobals());

describe('mirror', () => {
  it('記録が消えたら、起動したときに控えから全部戻す', async () => {
    localStorage.setItem('asobibako:pet-house', '{"money":120}');
    localStorage.setItem('asobibako:doodle-worm:stock', '[{"id":"a"}]');
    const store = memory();
    expect(await m.restoreIfEmpty(store)).toBe(false);
    await m.snapshot('v1', store);
    localStorage.clear();
    expect(await m.restoreIfEmpty(store)).toBe(true);
    expect(localStorage.getItem('asobibako:pet-house')).toBe('{"money":120}');
    expect(localStorage.getItem('asobibako:doodle-worm:stock')).toBe('[{"id":"a"}]');
  });

  it('記録が残っていれば戻さず、空の記録で控えを上書きしない', async () => {
    const store = memory();
    localStorage.setItem('asobibako:reached:maze', '5');
    expect(await m.restoreIfEmpty(store)).toBe(false);
    await m.snapshot('v1', store);
    const kept = store.text;
    localStorage.setItem('asobibako:reached:maze', '9');
    expect(await m.restoreIfEmpty(store)).toBe(false);
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('9');
    localStorage.clear();
    await m.snapshot('v2', store);
    expect(store.text).toBe(kept);
  });

  it('控えが開けずに止まっても、待ちすぎずに起動を続ける', async () => {
    const stuck: Store = { get: () => new Promise(() => {}), set: async () => {} };
    const started = Date.now();
    expect(await m.restoreIfEmpty(stuck, 50)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('読み切れないうちは控えを上書きしない', async () => {
    const set = vi.fn(async () => {});
    const stuck: Store = { get: () => new Promise(() => {}), set };
    expect(await m.restoreIfEmpty(stuck, 50)).toBe(false);
    localStorage.setItem('asobibako:reached:maze', '1');
    await m.snapshot('v', stuck);
    expect(set).not.toHaveBeenCalled();
  });

  it('見切ったあと遅れて届いた控えで戻し、読み直す', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...location, reload });
    let release!: (text: string) => void;
    const store: Store = {
      get: () => new Promise((r) => (release = r)),
      set: async () => {}
    };
    expect(await m.restoreIfEmpty(store, 20)).toBe(false);
    localStorage.setItem('asobibako:recent', '["maze"]');
    release(file({ 'asobibako:pet-house': '{"money":1}' }));
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
    expect(localStorage.getItem('asobibako:pet-house')).toBe('{"money":1}');
    expect(localStorage.getItem('asobibako:recent')).toBeNull();
  });

  it('前の起動で読み切れなかったら、記録が少しあっても次の起動で戻す', async () => {
    localStorage.setItem('asobibako:restore-pending', '1');
    localStorage.setItem('asobibako:pet-house', '{"new":true}');
    const store: Store = { get: async () => file({ 'asobibako:pet-house': '{"old":true}' }), set: async () => {} };
    expect(await m.restoreIfEmpty(store)).toBe(true);
    expect(localStorage.getItem('asobibako:pet-house')).toBe('{"old":true}');
    expect(localStorage.getItem('asobibako:restore-pending')).toBeNull();
  });

  it('最近のゲームだけが残っていても戻す', async () => {
    localStorage.setItem('asobibako:recent', '["maze"]');
    const store: Store = { get: async () => file({ 'asobibako:reached:maze': '5' }), set: async () => {} };
    expect(await m.restoreIfEmpty(store)).toBe(true);
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('5');
  });

  it('控えが無い端末では、読み終えたら普通に写す', async () => {
    const set = vi.fn(async () => {});
    const store: Store = { get: async () => undefined, set };
    expect(await m.restoreIfEmpty(store)).toBe(false);
    localStorage.setItem('asobibako:reached:maze', '1');
    await m.snapshot('v', store);
    expect(set).toHaveBeenCalled();
  });

  it('控えが読めなかった起動では上書きせず、印を残す', async () => {
    const set = vi.fn(async () => {});
    const store: Store = { get: () => Promise.reject(new Error('fail')), set };
    expect(await m.restoreIfEmpty(store)).toBe(false);
    expect(localStorage.getItem('asobibako:restore-pending')).toBe('1');
    localStorage.setItem('asobibako:reached:maze', '1');
    await m.snapshot('v', store);
    expect(set).not.toHaveBeenCalled();
  });
});
