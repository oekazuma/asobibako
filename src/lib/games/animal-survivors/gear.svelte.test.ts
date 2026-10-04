import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAIN } from './cauldron';
import Gear from './Gear.svelte';
import Pause from './Pause.svelte';
import { emptyRecords, loadRecords, RECORDS_KEY } from './records';
import Result from './Result.svelte';
import type { RunSummary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

function open(extra: object) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...emptyRecords(), ...extra }));
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Gear, { target, props: { onback: () => {} } });
  flushSync();
  return app;
}

const run = (extra: Partial<RunSummary>): RunSummary => ({
  animal: 'dog',
  heat: PLAIN,
  cleared: false,
  time: 125,
  level: 7,
  kills: 80,
  xp: 0,
  weapons: [{ id: 'woof', level: 2 }],
  passives: [],
  bosses: [],
  coins: 12,
  opened: 0,
  evolved: [],
  stage: 'forest',
  form: 0,
  metal: false,
  finale: false,
  dealt: [],
  book: { kills: {}, elites: [], chiefs: [], bosses: [], forms: [], items: [] },
  ...extra
});

describe('装備の画面', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('品を押して「つける」と、その場所に入って保存する', () => {
    const app = open({ bag: { 'owl:1': 1 } });
    (document.querySelector('[data-gear="owl:1"]') as HTMLButtonElement).click();
    flushSync();
    expect(document.body.textContent).toContain('知恵のふくろう');
    expect(document.body.textContent).toContain('育つ Lv が 1 早い');
    button('つける').click();
    flushSync();
    expect(loadRecords().worn.charm).toBe('owl:1');
    unmount(app);
  });

  it('3 つそろうと合成でき、売るとコインになる', () => {
    const app = open({ bag: { 'oni:0': 3 } });
    (document.querySelector('[data-gear="oni:0"]') as HTMLButtonElement).click();
    flushSync();
    button('合成').click();
    flushSync();
    expect(loadRecords().bag).toEqual({ 'oni:1': 1 });
    (document.querySelector('[data-gear="oni:1"]') as HTMLButtonElement).click();
    flushSync();
    button('売る').click();
    flushSync();
    // 1 回めは確かめるだけで、もう一度押すと売る
    expect(loadRecords().coins).toBe(0);
    button('本当に売る').click();
    flushSync();
    expect(loadRecords().coins).toBe(200);
    unmount(app);
  });

  it('最強をつけるで、場所ごとにいちばん高いレア度の品をつけて保存する', () => {
    const app = open({ bag: { 'oni:0': 1, 'goggles:2': 1, 'knight:1': 1, 'cat:0': 1 } });
    button('最強をつける').click();
    flushSync();
    expect(loadRecords().worn).toEqual({ head: 'goggles:2', body: 'knight:1', charm: 'cat:0' });
    unmount(app);
  });

  it('コインで引くと持ち物が増え、足りなければ押せない', () => {
    const app = open({ coins: 500 });
    button('ガチャ').click();
    flushSync();
    button('コインで引く').click();
    flushSync();
    const r = loadRecords();
    expect(r.coins).toBe(0);
    expect(Object.values(r.bag).reduce((a, b) => a + (b ?? 0), 0)).toBe(1);
    expect(button('コインで引く').disabled).toBe(true);
    expect(document.body.textContent).toContain('伝説まであと');
    unmount(app);
  });
});

describe('遊ぶ回の画面', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('一時停止につけている装備の名前を出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Pause, {
      target,
      props: {
        run: run({ gear: ['knight:2'] }),
        finger: null,
        onresume: () => {},
        onquit: () => {},
        onrestart: () => {}
      }
    });
    flushSync();
    expect(document.body.textContent).toContain('騎士のよろい');
    unmount(app);
  });

  it('リザルトに持ち帰った券と持ち帰れなかった券を出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Result, {
      target,
      props: {
        run: run({ tickets: [1, 0, 0], lost: [0, 1, 0] }),
        got: [],
        total: 0,
        locked: false,
        onagain: () => {},
        onselect: () => {}
      }
    });
    flushSync();
    expect(document.querySelector('[data-kept]')?.textContent).toContain('銅の券');
    expect(document.querySelector('[data-lost]')?.textContent).toContain('銀の券');
    unmount(app);
  });

  it('やめるの確かめで、拾った券は持ち帰れないと言う', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Pause, {
      target,
      props: { run: run({ lost: [1, 0, 0] }), finger: null, onresume: () => {}, onquit: () => {}, onrestart: () => {} }
    });
    flushSync();
    button('やめる').click();
    flushSync();
    expect(document.body.textContent).toContain('拾った券は持ち帰れません');
    unmount(app);
  });
});
