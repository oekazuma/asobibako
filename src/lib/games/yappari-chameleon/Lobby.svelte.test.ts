import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Crew } from './cpu/crew';
import Lobby from './Lobby.svelte';
import { Match } from './match.svelte';
import { CPU_KEY, SETTINGS_KEY } from './prefs';
import type { Session } from './session.svelte';

function show(host: boolean, members = [1, 2]) {
  const start = vi.fn();
  const session = { party: { host, members }, match: new Match(() => 1), start } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Lobby, { target, props: { session, oninvite: vi.fn() } });
  flushSync();
  const button = (text: string) => [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  return { target, start, button, done: () => unmount(app) };
}

afterEach(() => localStorage.clear());

describe('Lobby', () => {
  it('子には「ホストが始めるのを待っています」だけを出す', () => {
    const { target, button, done } = show(false);
    expect(target.textContent).toContain('ホストが始めるのを待っています');
    expect(button('マップの設定')).toBeUndefined();
    done();
  });

  it('親はマップの設定を開いて変え、ゲームを始めると設定を覚えて始める', () => {
    const { target, start, button, done } = show(true);
    button('マップの設定')!.click();
    flushSync();
    expect(target.querySelector('[aria-label="マップの設定"]')).not.toBeNull();
    for (const label of [
      'ゲームモード',
      'ハンターの人数',
      'ハンター待機時間（秒）',
      '探索時間（秒）',
      '答え合わせ時間（秒）',
      '強制挑発間隔（秒）',
      'ハンターに見逃しランキングを表示'
    ])
      expect(target.textContent).toContain(label);
    button('通常')!.click();
    flushSync();
    button('ゲームを始める')!.click();
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'normal', hide: 120, search: 300, taunt: 0 }));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).mode).toBe('normal');
    done();
  });

  it('1 人のあいだはゲームを始められない', () => {
    const { target, button, done } = show(true, [1]);
    button('マップの設定')!.click();
    flushSync();
    expect(button('ゲームを始める')!.disabled).toBe(true);
    expect(target.textContent).toContain('2人以上');
    done();
  });

  it('ダブルではハンターの人数を薄くして押せなくし、見逃しランキングはオフにできる', () => {
    const { target, start, button, done } = show(true, [1, 2, 3]);
    button('マップの設定')!.click();
    flushSync();
    button('ダブル')!.click();
    flushSync();
    expect(target.querySelector('.row.dim')?.textContent).toContain('ハンターの人数');
    expect(button('＋')!.disabled).toBe(true);
    button('オフ')!.click();
    flushSync();
    button('ゲームを始める')!.click();
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'double', overlook: false }));
    done();
  });
});

describe('CPU と遊ぶのロビー', () => {
  function showCpu(members = [1, 2]) {
    const play = vi.fn();
    const start = vi.fn();
    const looks = { 2: 'cpu' };
    const session = {
      party: { host: true, members, looks },
      match: new Match(
        () => 1,
        () => looks
      ),
      start
    } as unknown as Session;
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Lobby, { target, props: { session, crew: { play } as unknown as Crew, oninvite: vi.fn() } });
    flushSync();
    const button = (text: string) =>
      [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
    const click = (text: string) => {
      button(text).click();
      flushSync();
    };
    return { target, play, start, button, click, done: () => unmount(app) };
  }

  it('顔ぶれを CPU の名前で出し、CPU の設定を出して、なかまを呼ぶを出さない', () => {
    const { target, button, done } = showCpu();
    expect(target.textContent).toContain('プレイヤー1・CPU 1（2/3人）');
    expect(button('CPU の設定')).toBeDefined();
    expect(button('なかまを呼ぶ')).toBeUndefined();
    done();
  });

  it('CPU の設定で選んで始めると、覚えて crew.play に渡す（session.start は使わない）', () => {
    const { click, play, start, done } = showCpu();
    click('CPU の設定');
    click('探す');
    click('増え鬼');
    click('強い');
    click('ゲームを始める');
    expect(play).toHaveBeenCalledWith(
      { side: 'seek', count: 1, mode: 'infect', strength: 'strong' },
      expect.objectContaining({ hide: 120 })
    );
    expect(start).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(CPU_KEY)!).side).toBe('seek');
    done();
  });

  it('マップの設定から始めても crew.play に渡し、ゲームモードとハンターの人数の行を出さない', () => {
    const { target, click, play, start, done } = showCpu();
    click('マップの設定');
    expect(target.textContent).not.toContain('ゲームモード');
    expect(target.textContent).not.toContain('ハンターの人数');
    click('ゲームを始める');
    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ side: 'hide' }),
      expect.objectContaining({ hide: 120 })
    );
    expect(start).not.toHaveBeenCalled();
    done();
  });

  it('CPU が席に着き終わる前でも、マップの設定の人数は CPU の席を数えて始められる', () => {
    const { target, button, click, play, done } = showCpu([1]);
    click('マップの設定');
    expect(button('ゲームを始める').disabled).toBe(false);
    expect(target.textContent).not.toContain('2人以上');
    click('ゲームを始める');
    expect(play).toHaveBeenCalledTimes(1);
    done();
  });
});
