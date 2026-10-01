import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LineFix from './LineFix.svelte';
import { SIZE } from './regions';
import { editor } from './test/editor-hold';

vi.mock('./LineEditor.svelte', async () => ({ default: (await import('./test/EditorStub.svelte')).default }));

describe('LineFix', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('直した線画で塗りに戻り、やめるなら何も変えずに戻る', () => {
    const onmake = vi.fn();
    const onback = vi.fn();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(LineFix, { target, props: { mask: new Uint8Array(SIZE * SIZE), onmake, onback } });
    flushSync();
    editor.onedit!({ kind: 'add', pts: [0.5, 0.5], width: 6 });
    flushSync();
    const press = (label: string) =>
      [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!.click();
    press('これで ぬる');
    const made = onmake.mock.calls[0][0] as Uint8Array;
    expect(made[(SIZE / 2) * SIZE + SIZE / 2]).toBe(1);
    press('やめる');
    expect(onback).toHaveBeenCalled();
    unmount(app);
  });
});
