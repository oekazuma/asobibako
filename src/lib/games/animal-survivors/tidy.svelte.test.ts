import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import LevelUp from './LevelUp.svelte';

describe('埋め草だけの 3 択', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('引き直しても同じ札しか出ないので、引き直すと除外は出さず、飛ばすは残す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(LevelUp, {
      target,
      props: {
        options: [{ kind: 'meat' }, { kind: 'vigor' }, { kind: 'bag' }],
        locked: false,
        tools: { rerolls: 2, skips: 1, banishes: 1 },
        onpick: () => {},
        ontool: () => {},
        onbanish: () => {}
      }
    });
    flushSync();
    expect(target.textContent).not.toContain('引き直す');
    expect(target.textContent).not.toContain('除外');
    expect(target.textContent).toContain('飛ばす');
    unmount(app);
  });
});
