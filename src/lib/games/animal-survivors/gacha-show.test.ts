import { describe, expect, it } from 'vitest';
import { angleDelta, DROP, GUARD, makeShow, OPEN, SPIN, tap, tick, TURN, turn, skip } from './gacha-show';

const run = (s: ReturnType<typeof makeShow>, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) tick(s, 1 / 60);
};

describe('ガチャの段取り', () => {
  it('時計回りに 4 分の 3 回すと回り始め、逆に回しても戻るだけで始まらない', () => {
    const s = makeShow('owl:1');
    turn(s, -1);
    expect(s.angle).toBe(0);
    turn(s, TURN * 0.5);
    turn(s, -TURN * 0.25);
    expect(s.phase).toBe('ready');
    expect(s.angle).toBeCloseTo(TURN * 0.25);
    turn(s, TURN * 0.8);
    expect(s.phase).toBe('spin');
  });

  it('回り終えるとカプセルが転がり、止まったら押すのを待つ', () => {
    const s = makeShow('owl:1');
    turn(s, TURN);
    run(s, SPIN + 0.05);
    expect(s.phase).toBe('drop');
    run(s, DROP + 0.05);
    expect(s.phase).toBe('wait');
  });

  it('待っているときに押すと割れて、割れ終えると品を見せ、もう一度押すと終わる', () => {
    const s = makeShow('owl:1');
    turn(s, TURN);
    run(s, SPIN + DROP + 0.1);
    tap(s);
    expect(s.phase).toBe('open');
    run(s, OPEN + 0.05);
    expect(s.phase).toBe('show');
    run(s, GUARD + 0.05);
    tap(s);
    expect(s.phase).toBe('done');
  });

  it('回っているときと転がっているときに押すと、押すのを待つところまで早送りする', () => {
    const s = makeShow('owl:1');
    turn(s, TURN);
    tap(s);
    expect(s.phase).toBe('wait');
  });

  it('押した直後は次の押しを受けない（指を離した合成 click で進みすぎない）', () => {
    const s = makeShow('owl:1');
    turn(s, TURN);
    run(s, SPIN + DROP + 0.1);
    tap(s);
    run(s, OPEN + 0.01);
    expect(s.phase).toBe('show');
    tap(s);
    expect(s.phase).toBe('show');
  });

  it('とばすとすぐ品を見せる', () => {
    const s = makeShow('owl:1');
    skip(s);
    expect(s.phase).toBe('show');
  });

  it('中心から見た角度の差は、時計回りが正で -π〜π', () => {
    // 画面の座標は y が下向きなので、右から下へ回るのが時計回り
    expect(angleDelta(0, 0, 1, 0, 0, 1)).toBeCloseTo(Math.PI / 2);
    expect(angleDelta(0, 0, 0, 1, 1, 0)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(angleDelta(0, 0, -1, 0.01, -1, -0.01))).toBeLessThan(0.1);
  });
});
