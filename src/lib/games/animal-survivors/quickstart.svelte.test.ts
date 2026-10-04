import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { betOf } from './cauldron';
import Pause from './Pause.svelte';
import { emptyRecords, RECORDS_KEY } from './records';
import Survivors from './Survivors.svelte';
import { createWorld, summary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {}, bus: () => null }));
vi.mock('$lib/music/loop', () => ({
  Loop: class {
    play() {}
    tick() {}
    stop() {}
    warm() {}
  }
}));

const coins = () => JSON.parse(localStorage.getItem(RECORDS_KEY)!).coins as number;
function open(extra: object) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...emptyRecords(), ...extra }));
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Survivors, { target, props: { level: 1, onfinish: () => {}, onquit: () => {} } });
  flushSync();
  return app;
}
const quick = () => document.querySelector('[data-again]') as HTMLButtonElement | null;

describe('前回と同じではじめる', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('前回の組を出し、押すと賭けを引いて札を選ぶところまで進む', async () => {
    const app = open({
      best: 300,
      coins: 1000,
      unlocked: ['dog', 'cat', 'wolf', 'fox'],
      animal: 'fox',
      stage: 'forest',
      heatLast: 4.5
    });
    expect(quick()?.textContent).toContain('キツネ・森・釜 4.5');
    quick()!.click();
    flushSync();
    expect(coins()).toBe(1000 - betOf(4.5));
    await new Promise((r) => setTimeout(r, 200));
    flushSync();
    expect(document.querySelectorAll('[data-card]').length).toBe(3);
    unmount(app);
  });

  it('コインが足りなければ下げて始め、遊び始めに帯で知らせる', async () => {
    const app = open({ best: 300, coins: 100, animal: 'dog', stage: 'forest', heatLast: 9 });
    quick()!.click();
    flushSync();
    await new Promise((r) => setTimeout(r, 100));
    flushSync();
    expect(document.body.textContent).toContain('コインが足りないので');
    unmount(app);
  });

  it('初めて遊ぶときと、前回のステージが選べないときは出さない', () => {
    let app = open({});
    expect(quick()).toBeNull();
    unmount(app);
    document.body.innerHTML = '';
    app = open({ best: 300, stage: 'snow' });
    expect(quick()).toBeNull();
    unmount(app);
  });
});

describe('一時停止の札', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('持っている札の良いところと悪いところを出す', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, {}, 'forest', { arcana: ['gamble'] });
    w.arcana = ['gamble'];
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Pause, {
      target,
      props: { run: summary(w), finger: null, onresume: () => {}, onrestart: () => {}, onquit: () => {} }
    });
    flushSync();
    expect(target.textContent).toContain('攻撃 +50%');
    expect(target.textContent).toContain('最大 HP 半分');
    unmount(app);
  });
});
