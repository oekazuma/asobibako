import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Choice } from './choices';
import LevelUp from './LevelUp.svelte';

const options: Choice[] = [{ kind: 'meat' }, { kind: 'bag' }];

function show(rerolls: number) {
  const calls: string[] = [];
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(LevelUp, {
    target,
    props: { options, locked: false, rerolls, onpick: () => calls.push('pick'), onreroll: () => calls.push('reroll') }
  });
  flushSync();
  const reroll = () => [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('引き直す'));
  return { app, calls, reroll };
}

describe('LevelUp', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('リロールが残っていれば「引き直す（のこり N）」を出し、押すと onreroll', () => {
    const { app, calls, reroll } = show(2);
    expect(reroll()?.textContent).toContain('のこり 2');
    reroll()!.click();
    expect(calls).toEqual(['reroll']);
    unmount(app);
  });

  it('残りが無ければ出さない', () => {
    const { app, reroll } = show(0);
    expect(reroll()).toBeUndefined();
    unmount(app);
  });

  it('R キーでも引き直す', () => {
    const { app, calls } = show(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    expect(calls).toEqual(['reroll']);
    unmount(app);
  });
});
