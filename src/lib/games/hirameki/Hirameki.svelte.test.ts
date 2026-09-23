import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Hirameki from './Hirameki.svelte';

vi.mock('./sounds', () => ({
  sounds: new Proxy({}, { get: () => () => {} })
}));

vi.mock('./puzzles', () => {
  const base = { title: 'テスト', text: 'いくつ？', hints: ['1', '2', '3'], why: '3 だから' };
  return {
    PUZZLES: [
      { ...base, kind: 'number', answer: 3, unit: '個' },
      {
        ...base,
        kind: 'lines',
        dots: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 0, y: 2 }
        ],
        pegs: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 0, y: 2 },
          { x: 2, y: 2 }
        ],
        segments: 2
      },
      { ...base, kind: 'word', tiles: ['ね', 'こ', 'い', 'ぬ', 'こ'], answer: ['ねこ'] },
      {
        ...base,
        kind: 'slide',
        cols: 3,
        rows: 1,
        blocks: [{ x: 0, y: 0, w: 1, h: 1, label: '主役' }],
        target: 0,
        goal: { x: 2, y: 0 }
      },
      {
        ...base,
        kind: 'place',
        cols: 2,
        rows: 2,
        count: 2,
        blocked: [3],
        goal: (cells: ReadonlySet<number>) => cells.has(0) && cells.has(1)
      },
      { ...base, kind: 'ice', cols: 3, rows: 3, rocks: [{ x: 2, y: 0 }], start: { x: 0, y: 0 }, goal: { x: 2, y: 2 } }
    ]
  };
});

/** 答えてから結果が出るまでの考え中 */
const THINK = 1600;

function show(level = 1) {
  const onfinish = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Hirameki, { target, props: { level, onfinish } });
  flushSync();
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === text || b.getAttribute('aria-label') === text
    )!;
  const press = (...texts: string[]) => {
    for (const text of texts) {
      button(text).click();
      flushSync();
    }
  };
  const wait = (ms: number) => {
    vi.advanceTimersByTime(ms);
    flushSync();
  };
  return { target, app, onfinish, button, press, wait };
}

describe('Hirameki', () => {
  beforeEach(() => vi.useFakeTimers());

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('入力するまで答えられない', () => {
    const { app, button } = show();
    expect(button('答える').disabled).toBe(true);
    unmount(app);
  });

  it('正解なら解き方を見せ、「次へ」で onfinish(true)', () => {
    const { target, app, onfinish, press, wait } = show();
    press('3', '答える');
    expect(target.textContent).not.toContain('3 だから');
    wait(THINK);
    expect(target.textContent).toContain('ナゾ解明！');
    expect(target.textContent).toContain('3 だから');
    expect(onfinish).not.toHaveBeenCalled();
    press('次へ');
    expect(onfinish).toHaveBeenCalledExactlyOnceWith(true);
    unmount(app);
  });

  it('間違いは「残念…」を見せてから onfinish(false)', () => {
    const { target, app, onfinish, press, wait } = show();
    // 考え中に もう一度押しても、判定は 1 回だけ
    press('4', '答える', '答える');
    wait(THINK);
    expect(target.textContent).toContain('残念…');
    expect(onfinish).not.toHaveBeenCalled();
    wait(1200);
    expect(onfinish).toHaveBeenCalledExactlyOnceWith(false);
    unmount(app);
  });

  it('途中で作り直されたら、あとから onfinish を呼ばない', () => {
    const { app, onfinish, press } = show();
    press('4', '答える');
    unmount(app);
    vi.advanceTimersByTime(5000);
    expect(onfinish).not.toHaveBeenCalled();
  });

  it('lines は segments + 1 個の点を置くと答えられ、1 本戻せる', () => {
    const { target, app, onfinish, button, press, wait } = show(2);
    // 同じ点を続けて押しても 1 つと数える
    press('点 4', '点 4', '点 1');
    expect(target.textContent).toContain('残り 1 本');
    press('1 本戻す', '1 本戻す', '点 2', '点 1', '点 3');
    expect(target.textContent).toContain('残り 0 本');
    expect(button('答える').disabled).toBe(false);
    press('答える');
    wait(THINK);
    press('次へ');
    expect(onfinish).toHaveBeenCalledExactlyOnceWith(true);
    unmount(app);
  });

  it('word はタイルを 1 回ずつ押して言葉にし、1 字消せる', () => {
    const { target, app, onfinish, button, press, wait } = show(3);
    expect(button('答える').disabled).toBe(true);
    press('い', '1 字消す', 'ね', 'こ');
    // 押したタイルは もう押せない。同じ字のタイルがもう 1 枚あればそちらは押せる
    expect([...target.querySelectorAll<HTMLButtonElement>('.tile')].map((t) => t.disabled)).toEqual([
      true,
      true,
      false,
      false,
      false
    ]);
    press('答える');
    wait(THINK);
    press('次へ');
    expect(onfinish).toHaveBeenCalledExactlyOnceWith(true);
    unmount(app);
  });

  it('slide はブロックを指でドラッグした向きへ何ますでもすべらせ、出口に着けば正解', () => {
    const { target, app, onfinish, button, press, wait } = show(4);
    // 盤は幅 300 の 3 ます。1 ますは 100
    const board = target.querySelector<HTMLElement>('.board')!;
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 300, 100));
    const block = button('主役');
    const pointer = (type: string, x: number) =>
      block.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: x, clientY: 50, bubbles: true }));
    pointer('pointerdown', 50);
    pointer('pointermove', 260);
    pointer('pointerup', 260);
    flushSync();
    expect(target.textContent).toContain('手数 1');
    wait(400);
    wait(800);
    expect(target.textContent).toContain('ナゾ解明！');
    press('次へ');
    expect(onfinish).toHaveBeenCalledExactlyOnceWith(true);
    unmount(app);
  });

  it('place は count 個まで置け、置き終えたら答えられる', () => {
    const { target, app, onfinish, button, press, wait } = show(5);
    expect(button('ます 2-2').disabled).toBe(true);
    press('ます 1-2', 'ます 1-1', 'ます 2-1');
    // 3 つ目は置けない。置いた駒を押せば外せる
    expect(target.textContent).toContain('置いた数 2 / 2');
    press('ます 1-2', 'ます 2-1', '答える');
    wait(THINK);
    press('次へ');
    expect(onfinish).toHaveBeenCalledExactlyOnceWith(true);
    unmount(app);
  });

  it('ice は矢印で岩か端まで滑り、滑っている間は次を受けず、出口に入れば正解', () => {
    const { target, app, onfinish, press, wait } = show(6);
    // 上は盤の端で動けないので手数に入らない
    press('上へ', '下へ', '右へ');
    expect(target.textContent).toContain('手数 1');
    wait(2 * 110);
    press('右へ');
    expect(target.textContent).toContain('手数 2');
    wait(2 * 110);
    wait(300);
    wait(800);
    expect(target.textContent).toContain('ナゾ解明！');
    press('次へ');
    expect(onfinish).toHaveBeenCalledExactlyOnceWith(true);
    unmount(app);
  });
});
