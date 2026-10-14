import { describe, expect, it } from 'vitest';
import { TouchPad } from './touch';

const W = 1000;

describe('TouchPad 歩く', () => {
  it('左の指はスティック、右の指は見回しになり、同時に使える', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0);
    t.down(2, 800, 500, W, 0);
    t.move(1, 100, 450, 10);
    t.move(2, 830, 490, 10);
    expect(t.stick.y).toBeCloseTo(-0.5);
    expect(t.stick.active).toBe(true);
    expect(t.takeLook()).toEqual({ dx: 30, dy: -10 });
    expect(t.takeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it('スティックは半径で倒し切り、それ以上は 1 のまま', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0);
    t.move(1, 400, 500, 10);
    expect(t.stick.x).toBeCloseTo(1);
  });

  it('スティックの指を離すか取り消されると止まる', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0);
    t.move(1, 150, 500, 10);
    t.up(1);
    expect(t.stick).toMatchObject({ x: 0, y: 0, active: false });
  });

  it('右に新しく置いた指が見回しを引き継ぎ、前の指は見回さない', () => {
    const t = new TouchPad(100);
    t.down(2, 800, 500, W, 0);
    t.down(3, 900, 500, W, 0);
    t.move(3, 950, 500, 10);
    t.move(2, 700, 500, 10);
    expect(t.takeLook()).toEqual({ dx: 50, dy: 0 });
  });

  it('離した知らせが届かなかった見回しの指が残っても、次に置いた指で見回せる', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0);
    t.down(2, 800, 500, W, 0);
    t.down(3, 820, 400, W, 0);
    t.move(3, 860, 380, 10);
    expect(t.takeLook()).toEqual({ dx: 40, dy: -20 });
    expect(t.stick.active).toBe(true);
  });

  it('スティックを使っているとき、左にもう 1 本置くと見回しになる', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0);
    t.down(2, 200, 300, W, 0);
    t.move(2, 220, 300, 10);
    expect(t.takeLook().dx).toBe(20);
  });

  it('スティックの指を離した知らせが届かなくても、ほかの指の無いタッチを左に置けばその指がスティックになる', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0, false, true);
    t.move(1, 100, 400, 10);
    t.down(2, 200, 500, W, 20, false, true);
    expect(t.stick).toMatchObject({ x: 0, y: 0, active: true, ox: 200, oy: 500 });
    t.move(2, 200, 450, 30);
    t.move(1, 100, 300, 40);
    expect(t.stick.y).toBeCloseTo(-0.5);
    expect(t.takeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it('ほかの指を押しているときのタッチは、左に置いても今までどおり見回しになる', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0, false, true);
    t.down(2, 200, 300, W, 10, false, false);
    t.move(2, 220, 300, 20);
    expect(t.takeLook().dx).toBe(20);
    expect(t.stick.active).toBe(true);
  });
});

describe('TouchPad 塗る', () => {
  const paint = () => {
    const t = new TouchPad(100);
    t.setMode('paint');
    return t;
  };

  it('1 本指は 80ms たつと塗り始め、動かすと塗り、離すと終わる', () => {
    const t = paint();
    expect(t.down(1, 500, 500, W, 0)).toEqual([]);
    expect(t.tick(50)).toEqual([]);
    expect(t.tick(80)).toEqual([{ kind: 'start', x: 500, y: 500 }]);
    expect(t.move(1, 510, 500, 90)).toEqual([{ kind: 'move', x: 510, y: 500 }]);
    expect(t.up(1)).toEqual([{ kind: 'end', x: 510, y: 500 }]);
  });

  it('6px 動けば 80ms を待たずに塗り始める', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    expect(t.move(1, 507, 500, 20)).toEqual([
      { kind: 'start', x: 500, y: 500 },
      { kind: 'move', x: 507, y: 500 }
    ]);
  });

  it('80ms のうちに 2 本めが来たら塗らず、2 本指でカメラを回す', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    expect(t.down(2, 600, 500, W, 40)).toEqual([]);
    expect(t.tick(200)).toEqual([]);
    t.move(1, 520, 500, 210);
    t.move(2, 620, 500, 210);
    const o = t.takeOrbit();
    expect(o.dx).toBeCloseTo(20);
    expect(o.zoom).toBeCloseTo(1);
  });

  it('塗り始めたあとで 2 本めが来たら、描きかけを取り消す', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    t.tick(100);
    expect(t.down(2, 600, 500, W, 150)).toEqual([{ kind: 'cancel' }]);
  });

  it('つまむとズームの比が出る', () => {
    const t = paint();
    t.down(1, 400, 500, W, 0);
    t.down(2, 600, 500, W, 10);
    t.move(1, 300, 500, 20);
    t.move(2, 700, 500, 20);
    expect(t.takeOrbit().zoom).toBeCloseTo(2);
  });

  it('2 本指のあと 1 本だけ離しても、残った指では塗らない', () => {
    const t = paint();
    t.down(1, 400, 500, W, 0);
    t.down(2, 600, 500, W, 10);
    t.up(2);
    expect(t.move(1, 450, 500, 300)).toEqual([]);
    expect(t.tick(400)).toEqual([]);
    t.up(1);
    t.down(3, 500, 500, W, 500);
    expect(t.tick(600)).toEqual([{ kind: 'start', x: 500, y: 500 }]);
  });

  it('モードを変えると指を全部忘れ、描きかけは取り消す', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    t.tick(100);
    expect(t.setMode('walk')).toEqual([{ kind: 'cancel' }]);
    expect(t.move(1, 600, 500, 200)).toEqual([]);
  });

  it('待機中の指をキャンセルすると何も出ない', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    expect(t.cancel(1)).toEqual([]);
  });

  it('塗っている途中の指をキャンセルするとキャンセル出す', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    t.tick(100);
    expect(t.cancel(1)).toEqual([{ kind: 'cancel' }]);
  });

  it('2 本指のあと離した知らせが 1 本届かなくても、ほかの指の無いタッチなら塗れる', () => {
    const t = paint();
    t.down(1, 400, 500, W, 0, false, true);
    t.down(2, 600, 500, W, 10);
    t.up(2);
    expect(t.down(3, 500, 500, W, 500, false, true)).toEqual([]);
    expect(t.tick(600)).toEqual([{ kind: 'start', x: 500, y: 500 }]);
  });

  it('塗っている指を離した知らせが届かないまま次のタッチが来たら、描きかけは取り消さずに最後の位置で終える', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0, false, true);
    t.tick(100);
    t.move(1, 520, 500, 110);
    expect(t.down(2, 300, 300, W, 500, false, true)).toEqual([{ kind: 'end', x: 520, y: 500 }]);
    expect(t.tick(600)).toEqual([{ kind: 'start', x: 300, y: 300 }]);
  });
});

describe('TouchPad 塗るモードで体の外から始めた指', () => {
  const paint = () => {
    const t = new TouchPad(100);
    t.setMode('paint');
    return t;
  };

  it('塗らず、なぞった分が見回しのずれになる', () => {
    const t = paint();
    expect(t.down(1, 500, 500, W, 0, true)).toEqual([]);
    expect(t.move(1, 530, 480, 10)).toEqual([]);
    expect(t.tick(500)).toEqual([]);
    expect(t.up(1)).toEqual([]);
    expect(t.takeLook()).toEqual({ dx: 30, dy: -20 });
    expect(t.takeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it('体の上から始めた指は今までどおり塗り、見回しは動かない', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    expect(t.move(1, 520, 500, 10)).toEqual([
      { kind: 'start', x: 500, y: 500 },
      { kind: 'move', x: 520, y: 500 }
    ]);
    expect(t.takeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it('2 本めが来たら 2 本指のカメラになり、1 本めのなぞりはもう見回しに足さない', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0, true);
    t.move(1, 510, 500, 10);
    t.down(2, 600, 500, W, 20);
    t.move(1, 530, 500, 30);
    t.move(2, 630, 500, 30);
    expect(t.takeLook()).toEqual({ dx: 10, dy: 0 });
    const o = t.takeOrbit();
    expect(o.dx).toBeCloseTo(25);
    expect(o.zoom).toBeCloseTo(100 / 90);
  });

  it('2 本指のあと残った指では、見回しも塗りもしない', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0, true);
    t.down(2, 600, 500, W, 20);
    t.up(2);
    t.move(1, 560, 500, 40);
    expect(t.takeLook()).toEqual({ dx: 0, dy: 0 });
    expect(t.tick(500)).toEqual([]);
  });

  it('取り消された指のあとに、体の上から始めた指で塗れる', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0, true);
    t.cancel(1);
    t.down(2, 500, 500, W, 100);
    expect(t.tick(200)).toEqual([{ kind: 'start', x: 500, y: 500 }]);
  });
});
