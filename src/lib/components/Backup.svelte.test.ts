import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Backup from './Backup.svelte';

const reload = vi.fn();

async function choose(target: HTMLElement, text: string) {
  const input = target.querySelector<HTMLInputElement>('input[type=file]')!;
  const file = new File([text], 'asobibako.json', { type: 'application/json' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => expect(target.querySelector('.confirm, .err')).not.toBeNull());
  flushSync();
}

describe('バックアップ', () => {
  let target: HTMLElement;
  let app: ReturnType<typeof mount>;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('location', { ...location, reload });
    target = document.body.appendChild(document.createElement('div'));
    app = mount(Backup, { target });
    flushSync();
  });

  afterEach(() => {
    unmount(app);
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    reload.mockClear();
  });

  it('読み込んだファイルの中身を見せ、計算と確認のあとで置き換えて読み直す', async () => {
    localStorage.setItem('asobibako:reached:stale', '9');
    const data = { 'asobibako:reached:maze': '5', 'asobibako:muted': '1' };
    await choose(target, JSON.stringify({ app: 'asobibako', version: 'v', at: '2026-09-01', data }));
    expect(target.querySelector('.confirm')?.textContent).toContain(
      '1 本のゲームの記録・2 件（2026-09-01 に書き出し）'
    );

    const go = target.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(go.disabled).toBe(true);
    const [, a, b] = target.querySelector('.gate b')!.textContent!.match(/(\d+) × (\d+)/)!;
    const answer = target.querySelector<HTMLInputElement>('.gate input')!;
    answer.value = String(Number(a) * Number(b));
    answer.dispatchEvent(new Event('input', { bubbles: true }));
    target.querySelector<HTMLInputElement>('.agree input')!.click();
    flushSync();
    expect(go.disabled).toBe(false);

    go.click();
    await tick();
    expect(reload).toHaveBeenCalled();
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('5');
    expect(localStorage.getItem('asobibako:reached:stale')).toBeNull();
  });

  it('別のファイルは読み込めないと伝え、記録に触らない', async () => {
    localStorage.setItem('asobibako:reached:maze', '5');
    await choose(target, '{"app":"kakikaki"}');
    expect(target.querySelector('.err')?.textContent).toContain('読み込めませんでした');
    expect(target.querySelector('.confirm')).toBeNull();
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('5');
  });
});
