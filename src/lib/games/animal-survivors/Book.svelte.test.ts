import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { BOOK } from './book';
import Book from './Book.svelte';
import { emptyRecords } from './records';

function show(edit: (r: ReturnType<typeof emptyRecords>) => void = () => {}) {
  const r = emptyRecords();
  edit(r);
  const back: number[] = [];
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Book, { target, props: { records: r, onback: () => back.push(1) } });
  flushSync();
  const tab = (name: string) =>
    [...target.querySelectorAll('[role="tab"]')].find((b) => b.textContent?.includes(name)) as HTMLButtonElement;
  const cards = () => [...target.querySelectorAll('.book-card')] as HTMLButtonElement[];
  return { app, target, tab, cards, back };
}

describe('Book', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('4 つのタブがあり、敵の格子は 20 枚で、載った数を出す', () => {
    const { app, target, tab, cards } = show((r) => (r.book.enemies = { rat: 12 }));
    for (const n of ['敵', 'ボス', '動物', '品']) expect(tab(n)).toBeDefined();
    expect(cards()).toHaveLength(BOOK.enemies.length);
    expect(target.textContent).toContain(`1 / ${BOOK.enemies.length}`);
    unmount(app);
  });

  it('載ったものは名前、載っていないものは影と ？？？', () => {
    const { app, cards } = show((r) => (r.book.enemies = { rat: 12 }));
    const [rat, bat] = cards();
    expect(rat.classList.contains('unknown')).toBe(false);
    expect(rat.getAttribute('aria-label')).toBe('ネズミ');
    expect(bat.classList.contains('unknown')).toBe(true);
    expect(bat.getAttribute('aria-label')).toBe('？？？');
    unmount(app);
  });

  it('札を押すと記録の帯を出し、ボスはいちばん速い秒を出す', () => {
    const { app, target, tab, cards } = show((r) => {
      r.book.enemies = { rat: 1234 };
      r.book.elites = ['rat'];
      r.book.bosses = { bear: 3 };
      r.book.fastest = { bear: 31.4 };
    });
    cards()[0].click();
    flushSync();
    expect(target.querySelector('.detail')?.textContent).toContain('1,234');
    expect(target.querySelector('.detail')?.textContent).toContain('強化個体');
    tab('ボス').click();
    flushSync();
    expect(cards()).toHaveLength(BOOK.bosses.length);
    cards()[0].click();
    flushSync();
    expect(target.querySelector('.detail')?.textContent).toContain('3 回');
    expect(target.querySelector('.detail')?.textContent).toContain('31.4 秒');
    unmount(app);
  });

  it('動物は 27 の姿、品は 9 つで、もどるを押せる', () => {
    const { app, tab, cards, back, target } = show((r) => (r.book.forms = ['dog:0', 'dog:1']));
    tab('動物').click();
    flushSync();
    expect(cards()).toHaveLength(27);
    expect(cards()[1].getAttribute('aria-label')).toBe('わんぱく犬');
    tab('品').click();
    flushSync();
    expect(cards()).toHaveLength(9);
    (target.querySelector('.back') as HTMLButtonElement).click();
    expect(back).toEqual([1]);
    unmount(app);
  });
});
