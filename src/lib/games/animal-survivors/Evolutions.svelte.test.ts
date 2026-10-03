import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Evolutions from './Evolutions.svelte';

describe('Evolutions', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('12 行あり、作った進化形だけ名前を出し、ほかは ？？？', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Evolutions, { target, props: { evolved: ['woofEvo'] } });
    flushSync();
    expect(target.querySelectorAll('.pairs li')).toHaveLength(12);
    expect(target.textContent).toContain('ホネのあられ');
    expect(target.textContent).not.toContain('ネコ百烈拳');
    expect(target.textContent).toContain('？？？');
    expect(target.textContent).toContain('するどい牙');
    unmount(app);
  });

  it('専用進化形は数に入れず、9 匹の専用進化の表に出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Evolutions, { target, props: { evolved: ['woofEvo', 'woofSp'] } });
    flushSync();
    expect(target.querySelector('.head')?.textContent).toContain('進化 1 / 12');
    expect(target.querySelectorAll('.specials li')).toHaveLength(9);
    expect(target.textContent).toContain('勇者のホネ');
    expect(target.textContent).not.toContain('竜王の業火');
    unmount(app);
  });
});
