import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import type { Task } from './relay';
import RelayPlay from './RelayPlay.svelte';

vi.mock('$lib/audio.svelte', () => ({ wake: () => {} }));

function show(task: Task, done: Seat[] = []) {
  const view = { phase: 'play', step: 0, steps: 4, left: 40, done };
  const ondone = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(RelayPlay, {
    target,
    props: { task, view, me: 1, onink: () => {}, ondone, ontype: () => {} }
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

  // できたを押したあとも盤面が残ると、描き足した線が次の人に届かず、見えている絵と食い違う
  it('できたを押した人には、まっていますを出す', () => {
    const { app, target } = show({ kind: 'draw', word: 'りんご' }, [1]);
    expect(target.textContent).toContain('まっています');
    expect([...target.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'できた')).toBe(false);
    unmount(app);
  });
});
