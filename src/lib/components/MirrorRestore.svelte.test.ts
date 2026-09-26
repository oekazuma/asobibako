import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Backup } from '$lib/backup';

let found: Backup | null = null;
vi.mock('$lib/mirror', () => ({ peek: () => Promise.resolve(found) }));

const reload = vi.fn();
let apps: ReturnType<typeof mount>[] = [];

async function open(): Promise<HTMLElement> {
  const { default: MirrorRestore } = await import('./MirrorRestore.svelte');
  const target = document.body.appendChild(document.createElement('div'));
  apps.push(mount(MirrorRestore, { target }));
  flushSync();
  return target;
}

describe('この端末の控え', () => {
  let target: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('location', { ...location, reload });
    found = null;
    apps = [];
  });

  afterEach(() => {
    for (const app of apps) unmount(app);
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    reload.mockClear();
  });

  it('控えが無ければ、まだ無いと伝え「控えから戻す」は出さない', async () => {
    target = await open();
    await vi.waitFor(() => expect(target.textContent).toContain('まだ控えがありません'));
    expect(target.querySelector('button')).toBeNull();
  });

  it('控えがあれば日付と本数を見せ、戻すと置き換えて読み直す', async () => {
    found = { app: 'asobibako', version: 'v', at: '2026-09-01', data: { 'asobibako:reached:maze': '5' } };
    localStorage.setItem('asobibako:reached:maze', '9');
    target = await open();
    await vi.waitFor(() => expect(target.textContent).toContain('2026-09-01'));
    expect(target.textContent).toContain('1 本のゲームの記録・1 件');

    target.querySelector<HTMLButtonElement>('button')!.click();
    flushSync();
    expect(target.querySelector('.confirm')?.textContent).toContain('に控え）');

    const [, a, b] = target.querySelector('.gate b')!.textContent!.match(/(\d+) × (\d+)/)!;
    const answer = target.querySelector<HTMLInputElement>('.gate input')!;
    answer.value = String(Number(a) * Number(b));
    answer.dispatchEvent(new Event('input', { bubbles: true }));
    target.querySelector<HTMLInputElement>('.agree input')!.click();
    flushSync();

    target.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await tick();
    expect(reload).toHaveBeenCalled();
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('5');
  });

  it('やめると確認のフォームが消え、記録は変わらない', async () => {
    found = { app: 'asobibako', version: 'v', at: '2026-09-01', data: { 'asobibako:reached:maze': '5' } };
    localStorage.setItem('asobibako:reached:maze', '9');
    target = await open();
    await vi.waitFor(() => expect(target.querySelector('button')).not.toBeNull());

    target.querySelector<HTMLButtonElement>('button')!.click();
    flushSync();
    expect(target.querySelector('.confirm')).not.toBeNull();

    target.querySelector<HTMLButtonElement>('.confirm button[type=button]')!.click();
    flushSync();
    expect(target.querySelector('.confirm')).toBeNull();
    expect(localStorage.getItem('asobibako:reached:maze')).toBe('9');
  });
});
