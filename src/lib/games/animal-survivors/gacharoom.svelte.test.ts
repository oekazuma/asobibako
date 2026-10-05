import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CharSelect from './CharSelect.svelte';
import GachaRoom from './GachaRoom.svelte';
import { emptyRecords, loadRecords, RECORDS_KEY } from './records';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const card = (way: string) => document.querySelector(`[data-way="${way}"]`) as HTMLButtonElement;
const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

function open(extra: object) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...emptyRecords(), ...extra }));
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(GachaRoom, { target, props: { onback: () => {} } });
  flushSync();
  return app;
}

describe('ガチャの画面', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('コインで引くと持ち物が増え、足りなければ押せない', () => {
    const app = open({ coins: 500 });
    card('coin').click();
    flushSync();
    const r = loadRecords();
    expect(r.coins).toBe(0);
    expect(Object.values(r.bag).reduce((a, b) => a + (b ?? 0), 0)).toBe(1);
    expect(card('coin').disabled).toBe(true);
    expect(document.body.textContent).toContain('あと 49 回');
    unmount(app);
  });

  it('かくりつで、レア度ごとと品ごとの確率を見せ、券を切り替えられる', () => {
    const app = open({});
    button('かくりつ').click();
    flushSync();
    expect(document.querySelectorAll('[data-odds-item]').length).toBe(18);
    expect(document.body.textContent).toContain('0.167%');
    expect(document.body.textContent).toContain('80%');
    expect(document.body.textContent).toContain('50 回');
    (document.querySelector('[data-tab="2"]') as HTMLButtonElement).click();
    flushSync();
    expect(document.body.textContent).toContain('2.778%');
    unmount(app);
  });
});

describe('キャラ選択のメニュー', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('ガチャ・パワーアップ・装備・実績・図鑑の順に並び、ガチャは券の数を出して開ける', () => {
    const opened: string[] = [];
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(CharSelect, {
      target,
      props: {
        records: { ...emptyRecords(), tickets: [2, 1, 0] },
        onpick: () => {},
        onquit: () => {},
        onopen: (s: string) => opened.push(s)
      }
    });
    flushSync();
    const order = [...target.querySelectorAll('[data-menu]')].map((b) => b.getAttribute('data-menu'));
    expect(order).toEqual(['gacha', 'coop', 'shop', 'gear', 'trophies', 'book']);
    const g = target.querySelector('[data-menu="gacha"]') as HTMLButtonElement;
    expect(g.textContent).toContain('×2');
    g.click();
    expect(opened).toEqual(['gacha']);
    unmount(app);
  });
});
