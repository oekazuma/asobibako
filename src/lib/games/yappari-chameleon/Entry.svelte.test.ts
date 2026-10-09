import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Entry from './Entry.svelte';

function show(props: Record<string, unknown> = {}) {
  const target = document.body.appendChild(document.createElement('div'));
  const onsolo = vi.fn();
  const app = mount(Entry, { target, props: { onhost: vi.fn(), onparty: vi.fn(), onsolo, ...props } });
  flushSync();
  const buttons = () => [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
  return { target, onsolo, buttons, done: () => unmount(app) };
}

describe('Entry', () => {
  it('なかまを呼ぶ・なかまに入る・ひとりで試すの 3 つと、短い遊び方を出す', () => {
    const { target, buttons, onsolo, done } = show();
    const [call, join, solo] = buttons();
    expect(call).toMatch(/^なかまを呼ぶ/);
    expect(join).toMatch(/^なかまに入る/);
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
    done();
  });
});
