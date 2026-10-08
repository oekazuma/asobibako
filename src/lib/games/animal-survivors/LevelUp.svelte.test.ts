import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Choice } from './choices';
import LevelUp from './LevelUp.svelte';
import { limitGain } from './limit';

const options: Choice[] = [{ kind: 'weapon', id: 'paw', level: 1 }, { kind: 'meat' }];

function show(tools = { rerolls: 0, skips: 0, banishes: 0 }, opts: Choice[] = options) {
  const calls: string[] = [];
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(LevelUp, {
    target,
    props: {
      options: opts,
      locked: false,
      tools,
      onpick: (c: Choice) => calls.push(`pick:${c.kind}`),
      ontool: (t: 'reroll' | 'skip') => calls.push(t),
      onbanish: (c: Choice) => calls.push(`banish:${c.kind}`)
    }
  });
  flushSync();
  const button = (text: string) => [...target.querySelectorAll('button')].find((b) => b.textContent?.includes(text));
  return { app, calls, button, target };
}

describe('LevelUp', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('残りがある道具だけを、残りの回数と一緒に出す', () => {
    const { app, button } = show({ rerolls: 2, skips: 1, banishes: 0 });
    expect(button('引き直す')?.textContent).toContain('2');
    expect(button('飛ばす')?.textContent).toContain('1');
    expect(button('除外')).toBeUndefined();
    unmount(app);
  });

  it('引き直すと飛ばすは押すとすぐ効く', () => {
    const { app, calls, button } = show({ rerolls: 1, skips: 1, banishes: 0 });
    button('引き直す')!.click();
    button('飛ばす')!.click();
    expect(calls).toEqual(['reroll', 'skip']);
    unmount(app);
  });

  it('除外を押してから札を押すとその札を除外し、もう一度押すとやめる', () => {
    const { app, calls, button, target } = show({ rerolls: 0, skips: 0, banishes: 1 });
    button('除外')!.click();
    flushSync();
    expect(target.querySelector('[aria-label="レベルアップ"]')?.classList.contains('banishing')).toBe(true);
    button('除外')!.click();
    flushSync();
    button('ネコパンチ')!.click();
    expect(calls).toEqual(['pick:weapon']);
    button('除外')!.click();
    flushSync();
    button('ネコパンチ')!.click();
    expect(calls).toEqual(['pick:weapon', 'banish:weapon']);
    unmount(app);
  });

  it('R キーでも引き直す', () => {
    const { app, calls } = show({ rerolls: 1, skips: 0, banishes: 0 });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    expect(calls).toEqual(['reroll']);
    unmount(app);
  });

  it('進化に使う札に「進化」の印を出す', () => {
    const { app, target } = show(undefined, [{ kind: 'passive', id: 'fang', level: 1, evo: true }]);
    expect(target.querySelector('.evo')?.textContent).toBe('進化');
    unmount(app);
  });

  it('限界突破の札は、武器の名前・能力・回数を出し、同じ武器の札が並んでも出せ、引き直すも出る', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const options = [
      { kind: 'limit' as const, id: 'woof', stat: 'damage' as const, now: 3 },
      { kind: 'limit' as const, id: 'woof', stat: 'cooldown' as const, now: 0 },
      { kind: 'vigor' as const }
    ];
    const app = mount(LevelUp, {
      target,
      props: {
        options,
        locked: false,
        tools: { rerolls: 2, skips: 0, banishes: 3 },
        onpick: () => {},
        ontool: () => {},
        onbanish: () => {}
      }
    });
    flushSync();
    const text = target.textContent ?? '';
    expect(text).toContain('ワンワンショット');
    expect(text).toContain(limitGain('damage', 3));
    expect(text).toContain('+3 → +4');
    expect(text).toContain('待ち時間 −7%');
    expect(text).toContain('引き直す 2');
    expect(text).not.toContain('除外');
    unmount(app);
  });
});
