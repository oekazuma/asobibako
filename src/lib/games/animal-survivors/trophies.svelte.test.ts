import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyRecords, RECORDS_KEY } from './records';
import Trophies from './Trophies.svelte';
import { TROPHY_GROUPS } from './trophy-groups';

describe('実績の画面', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('見出しごとに達成の数を出し、仲間がもらえる実績には顔を付ける（まだの子は影）', () => {
    localStorage.setItem(
      RECORDS_KEY,
      JSON.stringify({ ...emptyRecords(), achieved: ['survive1', 'clear'], unlocked: ['dog', 'cat', 'wolf', 'fox'] })
    );
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Trophies, { target, props: { onback: () => {} } });
    flushSync();
    const heads = [...target.querySelectorAll('h3.group')].map((h) => h.textContent?.replace(/\s+/g, ' ').trim());
    expect(heads).toHaveLength(TROPHY_GROUPS.length);
    expect(heads[0]).toBe('生き延びる 2 / 6');
    expect(target.querySelectorAll('li.got')).toHaveLength(2);
    const fox = target.querySelector('[data-reward="fox"]')!;
    expect(fox.classList.contains('shadow')).toBe(false);
    expect(target.querySelector('[data-reward="bear"]')!.classList.contains('shadow')).toBe(true);
    unmount(app);
  });
});
