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

  it('引き直すと「のこり N」が減り、使い切るとボタンが消える', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, { reroll: 2 });
    w.pending = 1;
    const prompts = new Prompts(w);
    prompts.next(null);
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PromptLayer, { target, props: { prompts, finger: null } });
    flushSync();
    const reroll = () => [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('引き直す'));
    expect(reroll()?.textContent).toContain('のこり 2');
    reroll()!.click();
    flushSync();
    expect(reroll()?.textContent).toContain('のこり 1');
    reroll()!.click();
    flushSync();
    expect(reroll()).toBeUndefined();
    unmount(app);
    prompts.stop();
  });
});
