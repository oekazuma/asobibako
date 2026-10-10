import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import CpuSetup from './CpuSetup.svelte';
import { CPU_DEFAULT, type CpuChoice } from './cpu/levels';

function show() {
  const choice = $state<CpuChoice>({ ...CPU_DEFAULT });
  const onstart = vi.fn();
  const onclose = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(CpuSetup, { target, props: { choice, onstart, onclose } });
  flushSync();
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
  const click = (text: string) => {
    button(text).click();
    flushSync();
  };
  return { target, choice, onstart, onclose, button, click, done: () => unmount(app) };
}

describe('CpuSetup', () => {
  it('役・CPU の人数・モード・強さを漢字まじりの言葉で出す', () => {
    const { target, done } = show();
    expect(target.querySelector('[aria-label="CPU の設定"]')).not.toBeNull();
    for (const word of [
      'CPU の設定',
      '役',
      '隠れる',
      '探す',
      'CPU の人数',
      'ゲームモード',
      '通常',
      '増え鬼',
      '強さ',
      '弱い',
      '普通',
      '強い',
      'ゲームを始める'
    ])
      expect(target.textContent).toContain(word);
    done();
  });

  it('隠れるでは増え鬼を押せず、探すにすると押せる。隠れるへ戻すと通常に戻す', () => {
    const { choice, button, click, done } = show();
    expect(button('増え鬼').disabled).toBe(true);
    click('探す');
    expect(button('増え鬼').disabled).toBe(false);
    expect(button('通常').getAttribute('aria-pressed')).toBe('true');
    expect(button('増え鬼').getAttribute('aria-pressed')).toBe('false');
    click('増え鬼');
    expect(choice.mode).toBe('infect');
    expect(button('通常').getAttribute('aria-pressed')).toBe('false');
    expect(button('増え鬼').getAttribute('aria-pressed')).toBe('true');
    click('隠れる');
    expect(choice).toMatchObject({ side: 'hide', mode: 'normal' });
    done();
  });

  it('選んだものを choice に書き、ゲームを始めるで onstart、閉じるで onclose', () => {
    const { choice, click, onstart, onclose, done } = show();
    click('探す');
    click('2');
    click('強い');
    expect({ ...choice }).toEqual({ side: 'seek', count: 2, mode: 'normal', strength: 'strong' });
    click('ゲームを始める');
    expect(onstart).toHaveBeenCalledTimes(1);
    click('閉じる');
    expect(onclose).toHaveBeenCalledTimes(1);
    done();
  });
});
