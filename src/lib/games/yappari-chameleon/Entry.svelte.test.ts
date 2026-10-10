import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Entry from './Entry.svelte';
import { CPU_KEY } from './prefs';

function show(props: Record<string, unknown> = {}) {
  const target = document.body.appendChild(document.createElement('div'));
  const onsolo = vi.fn();
  const oncpu = vi.fn();
  const app = mount(Entry, { target, props: { onhost: vi.fn(), onparty: vi.fn(), onsolo, oncpu, ...props } });
  flushSync();
  const buttons = () => [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
  const click = (text: string) => {
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!.click();
    flushSync();
  };
  return { target, onsolo, oncpu, buttons, click, done: () => unmount(app) };
}

afterEach(() => localStorage.clear());

describe('Entry', () => {
  it('なかまを呼ぶ・なかまに入る・CPU と遊ぶ・ひとりで試すの 4 つと、短い遊び方を出す', () => {
    const { target, buttons, onsolo, done } = show();
    const [call, join, cpu, solo] = buttons();
    expect(call).toMatch(/^なかまを呼ぶ/);
    expect(join).toMatch(/^なかまに入る/);
    expect(cpu).toBe('CPU と遊ぶ');
    expect(solo).toBe('ひとりで試す');
    expect(target.textContent).toContain('自分の iPad の画面は見せないでね');
    target.querySelector<HTMLButtonElement>('.solo')!.click();
    expect(onsolo).toHaveBeenCalledTimes(1);
    done();
  });

  it('切れた子には理由と「もう一度つなぐ」を出す', () => {
    const { target, buttons, done } = show({ note: 'ホストとの接続が切れました', was: 2 });
    expect(target.textContent).toContain('ホストとの接続が切れました');
    expect(buttons()[0]).toContain('もう一度つなぐ');
    // 親が戻らなくても、ほかの人と遊び直せる
    expect(buttons().slice(1)).toEqual([
      expect.stringMatching(/^なかまを呼ぶ/),
      expect.stringMatching(/^なかまに入る/),
      'CPU と遊ぶ',
      'ひとりで試す'
    ]);
    done();
  });

  it('CPU と遊ぶを押すと CPU の設定を出し、選んで始めると覚えて oncpu に渡す', () => {
    const { target, click, oncpu, done } = show();
    click('CPU と遊ぶ');
    expect(target.querySelector('[aria-label="CPU の設定"]')).not.toBeNull();
    click('探す');
    click('増え鬼');
    click('2');
    click('強い');
    click('ゲームを始める');
    const want = { side: 'seek', count: 2, mode: 'infect', strength: 'strong' };
    expect(oncpu).toHaveBeenCalledWith(want);
    expect(JSON.parse(localStorage.getItem(CPU_KEY)!)).toEqual(want);
    expect(target.querySelector('[aria-label="CPU の設定"]')).toBeNull();
    done();
  });

  it('CPU の設定は閉じるで閉じ、前に選んだものを出す', () => {
    localStorage.setItem(CPU_KEY, JSON.stringify({ side: 'seek', count: 2, mode: 'normal', strength: 'weak' }));
    const { target, click, oncpu, done } = show();
    click('CPU と遊ぶ');
    expect(target.querySelector('button.on')?.textContent?.trim()).toBe('探す');
    click('閉じる');
    expect(target.querySelector('[aria-label="CPU の設定"]')).toBeNull();
    expect(oncpu).not.toHaveBeenCalled();
    done();
  });
});
