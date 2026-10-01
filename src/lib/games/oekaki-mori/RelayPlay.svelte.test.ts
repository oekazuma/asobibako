import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from './relay';
import RelayPlay from './RelayPlay.svelte';

vi.mock('$lib/audio.svelte', () => ({ wake: () => {} }));
const view = { phase: 'play', step: 0, steps: 4, left: 40, done: [] };

function show(task: Task) {
  const ondone = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(RelayPlay, {
    target,
    props: { task, view, looks: {}, onink: () => {}, ondone, ontype: () => {} }
  });
  flushSync();
  return { app, target, ondone };
}

describe('RelayPlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('描くだんは言葉を見せ、できたで知らせる', () => {
    const { app, target, ondone } = show({ kind: 'draw', word: 'りんご' });
    expect(target.textContent).toContain('りんご');
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'できた')!.click();
    expect(ondone).toHaveBeenCalledWith();
    unmount(app);
  });

  it('当てるだんは 50 音盤の答えを知らせ、待つときは待つと出す', () => {
    const a = show({ kind: 'guess', strokes: [] });
    const press = (label: string) =>
      [...a.target.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!.click();
    press('い');
    flushSync();
    press('ぬ');
    flushSync();
    press('こたえる');
    expect(a.ondone).toHaveBeenCalledWith('いぬ');
    unmount(a.app);
    const b = show({ kind: 'wait' });
    expect(b.target.textContent).toContain('まっています');
    unmount(b.app);
  });
});
