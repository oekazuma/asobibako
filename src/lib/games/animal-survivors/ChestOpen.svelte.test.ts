import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChestOpen from './ChestOpen.svelte';

const played = vi.hoisted(() => [] as string[]);
vi.mock('./sounds', () => ({ sounds: { evolve: () => played.push('evolve') } }));

describe('ChestOpen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    played.length = 0;
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('進化を見せたときに進化の音を鳴らす', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(ChestOpen, {
      target,
      props: {
        rewards: [{ kind: 'evolve', from: 'woof', id: 'woofEvo' }, { kind: 'meat' }],
        locked: false,
        onclose: () => {}
      }
    });
    flushSync();
    expect(played).toEqual([]);
    vi.advanceTimersByTime(700);
    flushSync();
    expect(played).toEqual(['evolve']);
    vi.advanceTimersByTime(1000);
    expect(played).toEqual(['evolve']);
    unmount(app);
  });
});
