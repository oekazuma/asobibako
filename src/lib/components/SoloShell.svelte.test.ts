import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hooks } from '$lib/test/hooks';
import StubGame from '$lib/test/StubGame.svelte';
import StubHowto from '$lib/test/StubHowto.svelte';
import SoloShell from './SoloShell.svelte';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  sfx: { start: () => {}, finish: () => {} },
  toggleMute: () => {},
  wake: () => {}
}));

const meta = {
  id: 'stub',
  name: 'スタブ',
  description: '',
  minutes: '1分',
  players: 1 as const,
  levels: 10,
  load: async () => ({ Game: StubGame, Howto: StubHowto })
};

function show(extra: { levelName?: string } = {}) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(SoloShell, { target, props: { meta: { ...meta, ...extra }, Game: StubGame, Howto: StubHowto } });
  flushSync();
  return { target, app };
}

const start = (target: HTMLElement) => {
  (target.querySelector('button.go') as HTMLButtonElement).click();
  flushSync();
};

describe('SoloShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('onfinish(true) を 2 回呼んでもレベルは 1 つしか進まない', () => {
    const { target, app } = show();
    start(target);
    expect(hooks.level).toBe(1);
    hooks.solo!(true);
    hooks.solo!(true);
    flushSync();
    expect(localStorage.getItem('asobibako:reached:stub')).toBe('2');
    expect(target.textContent).toContain('つぎは レベル 2');
    unmount(app);
  });

  it('遊んでいる最中でなければ onfinish は無視される', () => {
    const { target, app } = show();
    start(target);
    const finish = hooks.solo!;
    (target.querySelector('button.quit') as HTMLButtonElement).click();
    flushSync();
    finish(true);
    flushSync();
    expect(localStorage.getItem('asobibako:reached:stub')).toBeNull();
    expect(target.querySelector('button.go')).not.toBeNull();
    unmount(app);
  });

  it.each([
    ['5.5', 5],
    ['abc', 1],
    ['9999', 10],
    ['0', 1]
  ])('保存された値 %s は 1..levels の整数 %i に直す', (stored, level) => {
    localStorage.setItem('asobibako:reached:stub', stored);
    const { target, app } = show();
    expect(target.textContent).toContain(`レベル ${level}`);
    unmount(app);
  });

  it('100 面だったころの到達レベルは、今の面数で同じくらいのところへ読み替える', () => {
    localStorage.setItem('asobibako:level:stub', '37');
    const { target, app } = show();
    expect(target.textContent).toContain('レベル 4');
    unmount(app);
  });

  it('最後のレベルをクリアすると levels + 1 を保存し、ぜんぶクリアと出す', () => {
    localStorage.setItem('asobibako:reached:stub', '10');
    const { target, app } = show();
    start(target);
    hooks.solo!(true);
    flushSync();
    expect(localStorage.getItem('asobibako:reached:stub')).toBe('11');
    expect(target.textContent).toContain('ぜんぶクリア');
    unmount(app);
  });

  it('レベルの一覧から、たどり着いたところまでの面を選んで始める', () => {
    localStorage.setItem('asobibako:reached:stub', '5');
    const { target, app } = show();
    (target.querySelector('button.level') as HTMLButtonElement).click();
    flushSync();
    const cell = (n: number) => target.querySelector(`button[aria-label="レベル ${n}"]`) as HTMLButtonElement;
    expect(target.querySelectorAll('button.cell')).toHaveLength(10);
    expect(target.querySelectorAll('button.cleared')).toHaveLength(4);
    expect(cell(5).disabled).toBe(false);
    expect(cell(6).disabled).toBe(true);
    cell(3).click();
    flushSync();
    expect(hooks.level).toBe(3);
    unmount(app);
  });

  it('ぜんぶクリアすると最後のレベルもクリア済みになる', () => {
    localStorage.setItem('asobibako:reached:stub', '11');
    const { target, app } = show();
    (target.querySelector('button.level') as HTMLButtonElement).click();
    flushSync();
    expect(target.querySelectorAll('button.cleared')).toHaveLength(10);
    unmount(app);
  });

  it('↻ で同じレベルをやり直す', () => {
    const { target, app } = show();
    start(target);
    hooks.hint!('x');
    flushSync();
    expect(target.querySelector('.hint')).not.toBeNull();
    const before = hooks.hint;
    (target.querySelector('button.retry') as HTMLButtonElement).click();
    flushSync();
    expect(hooks.level).toBe(1);
    expect(hooks.hint).not.toBe(before);
    expect(target.querySelector('.hint')).toBeNull();
    expect(target.querySelector('[data-testid="game"]')).not.toBeNull();
    unmount(app);
  });

  it('onhint の文字が吹き出しに出て、空文字で消える', () => {
    const { target, app } = show();
    start(target);
    hooks.hint!('たき火へ はこぼう');
    flushSync();
    expect(target.querySelector('.hint')?.textContent).toBe('たき火へ はこぼう');
    hooks.hint!('');
    flushSync();
    expect(target.querySelector('.hint')).toBeNull();
    unmount(app);
  });

  it('levelName があれば、タイトル・一覧・結果で「レベル」の代わりにその呼び方を使う', () => {
    const { target, app } = show({ levelName: 'ナゾ' });
    expect(target.textContent).toContain('ナゾ 1');
    (target.querySelector('button.level') as HTMLButtonElement).click();
    flushSync();
    expect(target.textContent).toContain('ナゾを えらぼう');
    (target.querySelector('button[aria-label="ナゾ 1"]') as HTMLButtonElement).click();
    flushSync();
    hooks.solo!(true);
    flushSync();
    expect(target.textContent).toContain('つぎは ナゾ 2');
    expect(target.textContent).not.toContain('レベル');
    unmount(app);
  });
});
