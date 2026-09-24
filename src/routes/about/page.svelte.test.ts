import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Page from './+page.svelte';

describe('アプリについて', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('一覧へ戻るリンクと、更新・状態・データの欄を出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Page, { target });
    flushSync();
    const back = [...target.querySelectorAll('a')].find((a) => a.textContent?.trim() === 'もどる')!;
    expect(back.getAttribute('href')).toMatch(/\/$/);
    expect([...target.querySelectorAll('h2')].map((h) => h.textContent)).toEqual([
      '更新',
      'アプリの状態',
      'がしつ',
      'データについて',
      'バックアップ'
    ]);
    expect(target.querySelector('.update')).not.toBeNull();
    expect(target.querySelectorAll('.status li')).toHaveLength(3);
    unmount(app);
  });
});
