import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import GrowPlate from './GrowPlate.svelte';
import PromptLayer from './PromptLayer.svelte';
import { Prompts } from './prompts.svelte';
import { createWorld } from './world';

describe('演出の小さい直し', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ヌシの帯が出ているあいだ、ほかの帯は下にずらす', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    const prompts = new Prompts(w, false);
    w.events = [{ type: 'rush' }];
    prompts.take();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PromptLayer, { target, props: { prompts, finger: null, onanswer: () => {} } });
    flushSync();
    expect(target.querySelector('.notice')?.classList.contains('below')).toBe(false);
    w.events = [{ type: 'chief', i: 0, name: 'ヌシイノシシ' }];
    prompts.take();
    flushSync();
    expect(target.querySelector('.notice')?.classList.contains('below')).toBe(true);
    unmount(app);
    prompts.stop();
  });

  it('2 段育ったときの札は、強くなったぶんを 2 段ぶん出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(GrowPlate, { target, props: { from: '子犬', to: '勇者の犬', steps: 2 } });
    flushSync();
    expect(target.textContent).toContain('攻撃 +20%・最大 HP +40');
    unmount(app);
  });
});
