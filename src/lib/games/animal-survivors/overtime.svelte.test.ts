import { flushSync, mount, unmount, type Component } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OvertimeAsk from './OvertimeAsk.svelte';
import Pause from './Pause.svelte';
import { Prompts } from './prompts.svelte';
import { emptyRecords } from './records';
import Result from './Result.svelte';
import StageSelect from './StageSelect.svelte';
import { createWorld, type RunSummary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const run: RunSummary = {
  animal: 'dog',
  cleared: false,
  time: 1105,
  level: 40,
  kills: 9000,
  xp: 0,
  weapons: [],
  passives: [],
  bosses: [],
  coins: 300,
  opened: 0,
  evolved: [],
  stage: 'forest',
  form: 2,
  metal: false,
  finale: false,
  book: { kills: {}, elites: [], chiefs: [], bosses: [], forms: [], items: [] },
  dealt: [],
  overtime: { secs: 205, coins: 40, halved: true, best: 250 }
};

function show<P extends Record<string, unknown>>(c: Component<P>, props: P) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(c, { target, props });
  flushSync();
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
  return { target, app, button };
}

describe('延長戦の画面', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('10:00 の選ぶ画面は「生存成功！」ときまりと 2 つのボタンで、答えを返す', () => {
    const got: boolean[] = [];
    const { target, app, button } = show(OvertimeAsk, { locked: false, onanswer: (go: boolean) => got.push(go) });
    expect(target.querySelector('h2')?.textContent).toBe('生存成功！');
    expect(target.textContent).toContain('半分');
    button('延長戦へ').click();
    button('おわる').click();
    expect(got).toEqual([true, false]);
    unmount(app);
  });

  it('押せないあいだは枠に as-locked が付く', () => {
    const { target, app } = show(OvertimeAsk, { locked: true, onanswer: () => {} });
    expect(target.querySelector('.as-locked')).not.toBeNull();
    unmount(app);
  });

  it('Prompts.ask のあいだは busy で、出たときの指の合成 click を止める', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    const p = new Prompts(w);
    p.ask(3);
    expect(p.asking).toBe(true);
    expect(p.busy).toBe(true);
    expect(p.lock.active).toBe(true);
    p.answered();
    expect(p.busy).toBe(false);
    p.stop();
  });

  it('延長戦の一時停止は「引き上げる」で、確かめに全部もらえると書く', () => {
    const calls: string[] = [];
    const { target, app, button } = show(Pause, {
      run,
      finger: null,
      onresume: () => {},
      onrestart: () => {},
      onquit: () => calls.push('quit')
    });
    expect(button('やめる')).toBeUndefined();
    button('引き上げる').click();
    flushSync();
    vi.advanceTimersByTime(400);
    flushSync();
    expect(target.textContent).toContain('延長戦のコインは全部もらえます');
    button('引き上げる').click();
    expect(calls).toEqual(['quit']);
    unmount(app);
  });

  it('延長戦のリザルトは見出しと延長戦の時間・半分になったコイン・面の最高を出す', () => {
    const { target, app } = show(Result, {
      run,
      got: [],
      total: 1000,
      locked: false,
      onagain: () => {},
      onselect: () => {}
    });
    expect(target.querySelector('h2')?.textContent).toBe('延長戦 終了');
    expect(target.textContent).toContain('03:25');
    expect(target.textContent).toContain('延長戦 +40');
    expect(target.textContent).toContain('倒れたので半分');
    expect(target.textContent).toContain('この面の最高 04:10');
    unmount(app);
  });

  it('面を選ぶ画面の札に延長戦の最高を出す', () => {
    const records = { ...emptyRecords(), overtime: { forest: 250 } };
    const { target, app } = show(StageSelect, { records, onpick: () => {}, onback: () => {} });
    expect(target.querySelector('[data-stage="forest"]')?.textContent).toContain('延長 04:10');
    expect(target.querySelector('[data-stage="graveyard"]')?.textContent).not.toContain('延長');
    unmount(app);
  });
});
