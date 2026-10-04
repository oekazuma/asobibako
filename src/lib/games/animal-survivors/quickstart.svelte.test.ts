import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

function open(extra: object) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...emptyRecords(), ...extra }));
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Survivors, { target, props: { level: 1, onfinish: () => {}, onquit: () => {} } });
  flushSync();
  return app;
}

describe('キャラ選択', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('前回と同じではじめるは出さず、目立つボタンは出発だけ', () => {
    const app = open({ best: 300, coins: 1000, animal: 'dog', stage: 'forest', heatLast: 4.5 });
    expect(document.querySelector('[data-again]')).toBeNull();
    expect(document.body.textContent).not.toContain('前回と同じ');
    expect(document.querySelectorAll('.as-panel [data-go]').length).toBe(1);
    unmount(app);
  });

  it('上から、子を選ぶタイル・出発・今日のお題・メニューの順に並ぶ', () => {
    const app = open({ best: 300 });
    const order = ['[data-animal]', '[data-go]', '[data-daily]', '[data-menu="gacha"]'].map((q) =>
      document.querySelector(q)!
    );
    for (let i = 1; i < order.length; i++)
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
