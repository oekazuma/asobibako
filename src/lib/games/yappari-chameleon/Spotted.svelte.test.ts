import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import { Match } from './match.svelte';
import { DEFAULTS, newMatch, view } from './referee';
import Spotted from './Spotted.svelte';

describe('Spotted', () => {
  it('見落とされた場所の名前は、CPU なら CPU N で出す', () => {
    const match = new Match(
      () => 1,
      () => ({ 2: 'cpu' })
    );
    match.receive({
      ...view(newMatch()),
      phase: 'reveal',
      settings: DEFAULTS,
      hid: [1, 2],
      roles: { 1: 'hunter', 2: 'hider' }
    });
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Spotted, { target, props: { match } });
    flushSync();
    expect(target.textContent).toContain('CPU 1');
    expect(target.textContent).toContain('プレイヤー1');
    unmount(app);
  });
});
