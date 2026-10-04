import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Gacha from './Gacha.svelte';
import type { PullWay } from './gacha';
import { emptyRecords } from './records';

const card = (way: string) => document.querySelector(`[data-way="${way}"]`) as HTMLButtonElement;

describe('引き方のカード', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('券 3 枚とコイン 2 枚のカードが並び、券の数・伝説の確率・引けない理由を出す', () => {
    const r = { ...emptyRecords(), coins: 3300, tickets: [3, 0, 1] as [number, number, number], pity: 12 };
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Gacha, { target, props: { r, onpull: () => null } });
    flushSync();
    const ways = [...document.querySelectorAll('[data-way]')].map((b) => b.getAttribute('data-way'));
    expect(ways).toEqual(['bronze', 'silver', 'gold', 'coin', 'ten']);
    expect(card('bronze').textContent).toContain('×3');
    expect(card('bronze').textContent).toContain('伝説 3%');
    expect(card('gold').textContent).toContain('伝説 50%');
    expect(card('silver').disabled).toBe(true);
    expect(card('silver').textContent).toContain('券がない');
    expect(card('ten').disabled).toBe(true);
    expect(card('ten').textContent).toContain('コインが あと 1,200');
    expect(card('ten').textContent).toContain('レア以上 1 つ確定');
    expect(card('coin').disabled).toBe(false);
    expect(document.body.textContent).toContain('あと 38 回');
    expect(card('coin').getAttribute('aria-label')).toBe('コインで引く（500）');
    expect(card('ten').getAttribute('aria-label')).toContain('コインが あと 1,200');
    expect(card('bronze').getAttribute('aria-label')).toBe('銅の券で引く（3 枚）');
    unmount(app);
  });

  it('押したカードの引き方で引く', () => {
    const got: PullWay[] = [];
    const r = { ...emptyRecords(), coins: 600, tickets: [1, 0, 0] as [number, number, number] };
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Gacha, { target, props: { r, onpull: (w: PullWay) => (got.push(w), null) } });
    flushSync();
    card('bronze').click();
    card('coin').click();
    expect(got).toEqual(['bronze', 'coin']);
    unmount(app);
  });
});
