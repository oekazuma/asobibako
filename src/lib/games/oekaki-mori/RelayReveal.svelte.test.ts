import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Entry } from './relay';
import RelayReveal from './RelayReveal.svelte';

const pages: { chain: number; index: number; entry: Entry; last: boolean }[] = [
  { chain: 0, index: 0, entry: { kind: 'prompt', text: 'りんご' }, last: false },
  { chain: 0, index: 1, entry: { kind: 'draw', by: 1, strokes: [] }, last: false },
  { chain: 0, index: 2, entry: { kind: 'guess', by: 2, text: 'とまと' }, last: true }
];

function show(host: boolean, finished = false) {
  const onnext = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(RelayReveal, {
    target,
    props: { pages, finished, host, looks: {}, onnext, onagain: () => {}, onsave: () => {} }
  });
  flushSync();
  return { app, target, onnext };
}

describe('RelayReveal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('リレーの最後で、最初と最後の言葉を大きく出し、親だけがつぎを押せる', () => {
    const host = show(true);
    expect(host.target.textContent).toContain('さいしょは「りんご」');
    expect(host.target.textContent).toContain('さいごは「とまと」');
    [...host.target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'つぎ')!.click();
    expect(host.onnext).toHaveBeenCalled();
    unmount(host.app);
    const guest = show(false);
    expect([...guest.target.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'つぎ')).toBe(false);
    unmount(guest.app);
  });

  it('全部めくったら、しゃしんに ほぞん を出す', () => {
    const { app, target } = show(false, true);
    expect(target.textContent).toContain('しゃしんに ほぞん');
    unmount(app);
  });
});
