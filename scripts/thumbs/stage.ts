import type { Page } from 'playwright-core';

export interface Clip {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Point = readonly [number, number];

/**
 * 台本から使う操作。座標は撮影する画面の CSS px。
 * 2 人が同時に触るゲームがあるので、指は pointerId で区別して 1 本ずつ送る
 */
export class Stage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  touch(id: number, type: 'down' | 'move' | 'up', x: number, y: number): Promise<void> {
    return this.page.evaluate(
      ([id, type, x, y]) => {
        const target = document.elementFromPoint(x, y) ?? document.body;
        const event = new PointerEvent(`pointer${type}`, {
          pointerId: id,
          pointerType: 'touch',
          isPrimary: id === 1,
          clientX: x,
          clientY: y,
          bubbles: true,
          cancelable: true,
          composed: true
        });
        // timeStamp は実時間になるので、はじく速さ（fingers.ts の velocity）が毎回ぶれる。ページの時計に合わせる
        Object.defineProperty(event, 'timeStamp', { value: performance.now() });
        target.dispatchEvent(event);
      },
      [id, type, x, y] as const
    );
  }

  /** 時計を ms だけ進める。requestAnimationFrame も止めてあるので、ここでだけゲームが動く */
  wait(ms: number): Promise<void> {
    return this.page.clock.runFor(ms);
  }

  async tap(id: number, x: number, y: number): Promise<void> {
    await this.touch(id, 'down', x, y);
    await this.wait(50);
    await this.touch(id, 'up', x, y);
  }

  /** path の点を順にたどって、ms かけて 16ms ごとに指を動かす。up はしない（持ったままの場面を撮れるように） */
  async drag(id: number, path: readonly Point[], ms: number): Promise<void> {
    await this.touch(id, 'down', ...path[0]);
    const steps = Math.max(1, Math.round(ms / 16));
    const legs = path.length - 1;
    for (let i = 1; i <= steps; i++) {
      const k = (i / steps) * legs;
      const j = Math.min(legs - 1, Math.floor(k));
      const [[x0, y0], [x1, y1]] = [path[j], path[j + 1]];
      await this.touch(id, 'move', x0 + (x1 - x0) * (k - j), y0 + (y1 - y0) * (k - j));
      await this.wait(16);
    }
  }

  /**
   * DOM のボタンを押す。止めた時計のもとでは Playwright の click が要素の静止待ちで進まないので、click を直に送る。
   * detail が 0 の click になり、指の pointerdown で選ぶボタン（はいしゃさんの道具など）もキーボード操作として受ける
   */
  press(selector: string): Promise<void> {
    return this.page.locator(selector).dispatchEvent('click');
  }

  /** selector に合う要素の中心（DOM の順） */
  centers(selector: string): Promise<Point[]> {
    return this.page.$$eval(selector, (els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2] as const;
      })
    );
  }

  /** 1 人用。タイトルで選ばれているレベル（Scene.level で入れた到達レベル）で始める */
  async startSolo(): Promise<void> {
    await this.press('button.go');
    await this.wait(600);
  }

  /** 2 人用。タイトルで両側を同時に押さえ、GameShell が始める 550ms より長く待つ */
  async startDuel(): Promise<void> {
    const [a, b] = await Promise.all(
      ['button.half.p1', 'button.half.p2'].map(async (selector) => {
        const r = (await this.page.locator(selector).boundingBox())!;
        return [r.x + r.width / 2, r.y + r.height / 2] as const;
      })
    );
    await this.touch(1, 'down', ...a);
    await this.touch(2, 'down', ...b);
    await this.wait(700);
    await this.touch(1, 'up', ...a);
    await this.touch(2, 'up', ...b);
    await this.wait(600);
  }
}
