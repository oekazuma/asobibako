import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PromptLayer from './PromptLayer.svelte';
import { Prompts } from './prompts.svelte';
import { createWorld } from './world';

describe('PromptLayer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('引き直すと残りの数が減り、使い切るとボタンが消える', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, { reroll: 2 });
    w.pending = 1;
    const prompts = new Prompts(w);
    prompts.next(null);
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PromptLayer, { target, props: { prompts, finger: null } });
    flushSync();
    const reroll = () => [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('引き直す'));
    expect(reroll()?.textContent).toContain('引き直す 2');
    reroll()!.click();
    flushSync();
    expect(reroll()?.textContent).toContain('引き直す 1');
    reroll()!.click();
    flushSync();
    expect(reroll()).toBeUndefined();
    unmount(app);
    prompts.stop();
  });

  it('除外を押したまま飛ばすと、次のレベルアップは除外の状態から始まらない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, { skip: 1, banish: 1 });
    w.pending = 2;
    const prompts = new Prompts(w);
    prompts.next(null);
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PromptLayer, { target, props: { prompts, finger: null } });
    flushSync();
    const button = (text: string) => [...target.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
    button('除外')!.click();
    flushSync();
    button('飛ばす')!.click();
    flushSync();
    expect(prompts.options).not.toBeNull();
    expect(target.querySelector('[aria-label="レベルアップ"]')?.classList.contains('banishing')).toBe(false);
    unmount(app);
    prompts.stop();
  });
});
