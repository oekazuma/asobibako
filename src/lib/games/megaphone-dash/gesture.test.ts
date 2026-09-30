import { describe, expect, it } from 'vitest';
import { Gestures } from './gesture';

describe('Gestures', () => {
  it('触れただけなら撃つだけ', () => {
    const g = new Gestures();
    expect(g.down(1, 100, 100)).toEqual(['shoot']);
    expect(g.move(1, 110, 95)).toEqual([]);
    expect(g.up(1, 110, 95)).toEqual([]);
  });

  it('横へ 30px で 1 レーン、続けてずらすと続けて動く', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 131, 100)).toEqual(['right']);
    expect(g.move(1, 150, 100)).toEqual([]);
    expect(g.move(1, 162, 100)).toEqual(['right']);
    expect(g.move(1, 100, 100)).toEqual(['left', 'left']);
  });

  it('1 フレームで大きく動いたぶんをまとめて返す', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 35, 100)).toEqual(['left', 'left']);
  });

  it('上へ 30px で跳ぶのは 1 本の指につき 1 回', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 100, 69)).toEqual(['jump']);
    expect(g.move(1, 100, 20)).toEqual([]);
  });

  it('縦は最初に触れた位置から測る', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 131, 100)).toEqual(['right']);
    expect(g.move(1, 131, 60)).toEqual(['jump']);
  });

  it('斜めはずれの大きい向きを取る', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 140, 65)).toEqual(['right']);
    const h = new Gestures();
    h.down(1, 100, 100);
    expect(h.move(1, 132, 50)).toEqual(['jump']);
  });

  it('跳んだあとは、上へずれたままでも横でレーンを移れる', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 100, 50)).toEqual(['jump']);
    expect(g.move(1, 140, 50)).toEqual(['right']);
  });

  it('横が大きいスワイプは、少し上へ流れても跳ばない', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 160, 68)).toEqual(['right', 'right']);
    expect(g.move(1, 165, 66)).toEqual([]);
  });

  it('下へのずれは何もしない', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.move(1, 100, 200)).toEqual([]);
  });

  it('速いフリックは離したときに拾う', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.up(1, 170, 100)).toEqual(['right', 'right']);
  });

  it('2 本の指を別々に見分け、押さえている指は動かさない', () => {
    const g = new Gestures();
    g.down(1, 100, 100);
    expect(g.down(2, 300, 300)).toEqual(['shoot']);
    expect(g.move(1, 102, 101)).toEqual([]);
    expect(g.move(2, 340, 300)).toEqual(['right']);
    expect(g.up(2, 340, 300)).toEqual([]);
    expect(g.move(1, 60, 100)).toEqual(['left']);
  });

  it('知らない指の move と up は何も返さない', () => {
    const g = new Gestures();
    expect(g.move(9, 0, 0)).toEqual([]);
    expect(g.up(9, 0, 0)).toEqual([]);
  });
});
