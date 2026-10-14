import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BoardInput, toBoardPoint } from './board-input';

describe('toBoardPoint', () => {
  const box = { left: 0, top: 0, right: 1024, width: 1024, height: 768 };

  it('回していなければ画面の左上が盤面の左上', () => {
    expect(toBoardPoint(0, 0, box, false)).toEqual([0, 0]);
    expect(toBoardPoint(1024, 768, box, false)).toEqual([1, 1]);
  });

  it('時計回りに 90 度回していれば、画面の右上が盤面の左上、画面の左下が盤面の右下', () => {
    expect(toBoardPoint(1024, 0, box, true)).toEqual([0, 0]);
    expect(toBoardPoint(0, 768, box, true)).toEqual([1, 1]);
    // 盤面の上半分（向かいのプレイヤー）は画面の右半分、下半分（手前）は左半分
    expect(toBoardPoint(900, 384, box, true)[1]).toBeLessThan(0.5);
    expect(toBoardPoint(100, 384, box, true)[1]).toBeGreaterThan(0.5);
  });
});

/** 画面上の点だけを持つ指。座標の変換は clientX と clientY しか見ない */
const point = (clientX: number, clientY: number) => ({ clientX, clientY }) as PointerEvent;

describe('BoardInput の大きさの見張り', () => {
  let box: { left: number; top: number; right: number; width: number; height: number };
  let change: (() => void) | undefined;
  const stubMedia = () => ({
    matches: false,
    addEventListener: vi.fn((_type: string, f: () => void) => (change = f)),
    removeEventListener: vi.fn()
  });
  let media: ReturnType<typeof stubMedia>;
  /** 回しても大きさの変わらない盤面。外接矩形だけが回る */
  const board = (offsetWidth = 600, offsetHeight = 800) =>
    ({ getBoundingClientRect: () => box, offsetWidth, offsetHeight }) as unknown as HTMLElement;

  beforeEach(() => {
    box = { left: 0, top: 0, right: 600, width: 600, height: 800 };
    change = undefined;
    media = stubMedia();
    vi.stubGlobal('matchMedia', () => media);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('盤面の大きさが変わらなくても、横向きに回したら測り直して指の座標を回す', () => {
    const input = new BoardInput();
    const onResize = vi.fn();
    input.observe(board(), onResize);
    expect(input.at(point(150, 200))).toEqual([0.25, 0.25]);
    // 回すと外接矩形は横長になり、盤面の上辺が画面の右に来る
    box = { left: 0, top: 0, right: 800, width: 800, height: 600 };
    media.matches = true;
    change?.();
    expect(input.at(point(600, 150))).toEqual([0.25, 0.25]);
    expect(onResize).toHaveBeenCalledTimes(2);
  });

  it('見張りをやめたら、向きの知らせも外す', () => {
    const stop = new BoardInput().observe(board(), () => {});
    stop();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', change);
  });

  it('幅か高さが 0 のあいだは onResize を呼ばない', () => {
    const onResize = vi.fn();
    new BoardInput().observe(board(0, 800), onResize);
    new BoardInput().observe(board(600, 0), onResize);
    expect(onResize).not.toHaveBeenCalled();
  });
});
