import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import CpuSetup from './CpuSetup.svelte';
import { CPU_DEFAULT, type CpuChoice } from './cpu/levels';
import type { BodyType } from './referee';

function show() {
  const choice = $state<CpuChoice>({ ...CPU_DEFAULT });
  const onstart = vi.fn();
  const onclose = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const props = $state({ choice, body: 'normal' as BodyType, onstart, onclose });
  const app = mount(CpuSetup, { target, props });
  flushSync();
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
  const click = (text: string) => {
    button(text).click();
    flushSync();
  };
  /** 行の見出しの行の中のボタン（「通常」はゲームモードと体型の両方にある） */
  const inRow = (row: string, text: string) => {
    const r = [...target.querySelectorAll('.row')].find((r) => r.querySelector('span')?.textContent?.trim() === row)!;
    return [...r.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
  };
  return { target, choice, props, onstart, onclose, button, click, inRow, done: () => unmount(app) };
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
    expect({ ...choice }).toEqual({ side: 'seek', count: 2, mode: 'normal', strength: 'strong', petit: false });
    click('ゲームを始める');
    expect(onstart).toHaveBeenCalledTimes(1);
    click('閉じる');
    expect(onclose).toHaveBeenCalledTimes(1);
    done();
  });

  it('プチカメレオンは既定で許可しないで、そのあいだは体型を通常のまま押せない。許可すると体型を選べる', () => {
    const { choice, props, click, inRow, done } = show();
    expect(inRow('プチカメレオン', '許可しない').getAttribute('aria-pressed')).toBe('true');
    expect(inRow('体型', 'プチカメレオン').disabled).toBe(true);
    expect(inRow('体型', '通常').getAttribute('aria-pressed')).toBe('true');
    click('許可する');
    expect(choice.petit).toBe(true);
    inRow('体型', 'プチカメレオン').click();
    flushSync();
    expect(props.body).toBe('petit');
    expect(inRow('体型', 'プチカメレオン').getAttribute('aria-pressed')).toBe('true');
    click('許可しない');
    expect(choice.petit).toBe(false);
    expect(inRow('体型', '通常').getAttribute('aria-pressed')).toBe('true');
    done();
  });
});
