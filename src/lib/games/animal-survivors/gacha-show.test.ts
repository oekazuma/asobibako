import { describe, expect, it } from 'vitest';
import {
  angleDelta,
  closing,
  CRACK,
  cue,
  DROP,
  dropTime,
  glowOf,
  GUARD,
  handleDelta,
  makeShow,
  OPEN_TIME,
  SPIN,
  STORM,
  tap,
  tick,
  TURN,
  turn,
  skip,
  type Phase,
  type Show
} from './gacha-show';
import type { GearKey } from './gear';

const run = (s: ReturnType<typeof makeShow>, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) tick(s, 1 / 60);
};

describe('ガチャの段取り', () => {
  it('時計回りに 4 分の 3 回すと回り始め、逆に回しても戻るだけで始まらない', () => {
    const s = makeShow(['owl:1']);
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
    const s = makeShow(['owl:1']);
    turn(s, TURN);
    run(s, SPIN + 0.05);
    expect(s.phase).toBe('drop');
    run(s, DROP + 0.05);
    expect(s.phase).toBe('wait');
  });

  it('待っているときに押すと割れて、割れ終えると品を見せ、もう一度押すと終わる', () => {
    const s = makeShow(['owl:1']);
    turn(s, TURN);
    run(s, SPIN + DROP + 0.1);
    tap(s);
    expect(s.phase).toBe('open');
    run(s, OPEN_TIME[1] + 0.05);
    expect(s.phase).toBe('show');
    run(s, GUARD + 0.05);
    tap(s);
    expect(s.phase).toBe('done');
  });

  it('回っているときと転がっているときに押すと、押すのを待つところまで早送りする', () => {
    const s = makeShow(['owl:1']);
    turn(s, TURN);
    tap(s);
    expect(s.phase).toBe('wait');
  });

  it('押した直後は次の押しを受けない（指を離した合成 click で進みすぎない）', () => {
    const s = makeShow(['owl:1']);
    turn(s, TURN);
    run(s, SPIN + DROP + 0.1);
    tap(s);
    run(s, OPEN_TIME[1] + 0.01);
    expect(s.phase).toBe('show');
    tap(s);
    expect(s.phase).toBe('show');
  });

  it('とばすとすぐ品を見せる', () => {
    const s = makeShow(['owl:1']);
    skip(s);
    expect(s.phase).toBe('show');
  });

  it('中心から見た角度の差は、時計回りが正で -π〜π', () => {
    // 画面の座標は y が下向きなので、右から下へ回るのが時計回り
    expect(angleDelta(0, 0, 1, 0, 0, 1)).toBeCloseTo(Math.PI / 2);
    expect(angleDelta(0, 0, 0, 1, 1, 0)).toBeCloseTo(-Math.PI / 2);
    expect(Math.abs(angleDelta(0, 0, -1, 0.01, -1, -0.01))).toBeLessThan(0.1);
  });

  it('終わってもすぐは閉じず、押した指の合成 click が裏のボタンに届かないぶん待ってから閉じる', () => {
    const s = makeShow(['owl:1']);
    skip(s);
    run(s, GUARD + 0.05);
    tap(s);
    expect(s.phase).toBe('done');
    expect(closing(s)).toBe(false);
    run(s, GUARD + 0.05);
    expect(closing(s)).toBe(true);
  });

  it('ハンドルの真ん中を上下にこすっても回り始めない', () => {
    const s = makeShow(['owl:1']);
    const h = { x: 100, y: 100 };
    let prev = { x: 100, y: 40 };
    for (let k = 0; k < 400; k++) {
      const y = 40 + ((k * 8) % 120);
      const next = { x: 100 + ((k * 7) % 5) - 2, y };
      turn(s, handleDelta(h, prev, next));
      prev = next;
    }
    expect(s.phase).toBe('ready');
  });

  it('1 回の動きで回る角度には上限があり、ふちを回せば回り始める', () => {
    const h = { x: 0, y: 0 };
    expect(Math.abs(handleDelta(h, { x: 60, y: 0 }, { x: -60, y: 1 }))).toBeLessThanOrEqual(0.5);
    const s = makeShow(['owl:1']);
    let prev = { x: 60, y: 0 };
    for (let a = 0.1; a <= Math.PI * 1.6; a += 0.1) {
      const next = { x: Math.cos(a) * 60, y: Math.sin(a) * 60 };
      turn(s, handleDelta(h, prev, next));
      prev = next;
    }
    expect(s.phase).toBe('spin');
  });
});

function skipTo(s: Show, phase: Phase) {
  turn(s, TURN);
  for (let i = 0; i < 60 * 10 && s.phase !== phase; i++) tick(s, 1 / 60);
}

const ten = (k: GearKey = 'owl:0'): GearKey[] => Array.from({ length: 10 }, () => k);

describe('確定演出と昇格', () => {
  it('伝説があれば 4 回に 1 回は最初の伝説が昇格になり、それ以外は昇格しない', () => {
    expect(makeShow(['owl:2'], () => 0.1).upgrade).toBe(0);
    expect(makeShow(['owl:2'], () => 0.5).upgrade).toBe(-1);
    expect(makeShow(['owl:1'], () => 0.1).upgrade).toBe(-1);
    const g = ten();
    g[3] = 'cat:2';
    g[7] = 'oni:2';
    expect(makeShow(g, () => 0.1).upgrade).toBe(3);
  });

  it('昇格するカプセルはレアとして数え、ひびが入るまで青く光る', () => {
    const s = makeShow(['owl:2'], () => 0.1);
    expect(cue(s)).toBe(1);
    expect(glowOf(s, 0)).toBe(1);
    turn(s, TURN);
    run(s, SPIN + 0.05);
    expect(s.phase).toBe('drop');
    run(s, dropTime(1) + 0.05);
    tap(s);
    expect(s.phase).toBe('crack');
    expect(s.events).toContain('crack');
    run(s, CRACK + 0.05);
    expect(glowOf(s, 0)).toBe(2);
    expect(s.phase).toBe('open');
  });

  it('昇格でない伝説があれば、回し終えたあとに稲妻が落ちる', () => {
    const s = makeShow(['owl:2'], () => 0.9);
    expect(cue(s)).toBe(2);
    turn(s, TURN);
    run(s, SPIN + 0.05);
    expect(s.phase).toBe('storm');
    expect(s.events).toContain('storm');
    run(s, STORM + 0.05);
    expect(s.phase).toBe('drop');
  });

  it('レア以上が転がり出たらキラキラの出来事、割れる瞬間はレア度ごとの出来事', () => {
    const s = makeShow(['owl:1']);
    turn(s, TURN);
    const seen: string[] = [];
    for (let t = 0; t < SPIN + dropTime(1) + 0.1; t += 1 / 60) {
      tick(s, 1 / 60);
      seen.push(...s.events.splice(0));
    }
    expect(seen).toContain('roll');
    expect(seen).toContain('glow');
    tap(s);
    expect(s.events).toContain('pop1');
  });

  it('回すとカチカチの出来事を出す', () => {
    const s = makeShow(['owl:0']);
    turn(s, 0.3);
    turn(s, 0.3);
    turn(s, 0.3);
    expect(s.events.filter((e) => e === 'click').length).toBe(1);
  });
});

describe('10 連', () => {
  it('転がり出るのに 1 こより長くかかり、押すと左から順に割れて、全部割れたら並べる', () => {
    const s = makeShow(ten());
    turn(s, TURN);
    run(s, SPIN + dropTime(1) + 0.05);
    expect(s.phase).toBe('drop');
    run(s, dropTime(10) - dropTime(1));
    expect(s.phase).toBe('wait');
    tap(s);
    expect(s.phase).toBe('open');
    run(s, OPEN_TIME[0] * 10 + 0.5);
    expect(s.opened).toBe(10);
    expect(s.phase).toBe('list');
  });

  it('伝説のカプセルは割れるのに長くかかる', () => {
    const g = ten();
    g[1] = 'cat:2';
    const s = makeShow(g, () => 0.9);
    skipTo(s, 'wait');
    tap(s);
    run(s, OPEN_TIME[0] + 0.02);
    expect(s.opened).toBe(1);
    run(s, OPEN_TIME[0] + 0.02);
    expect(s.opened).toBe(1);
    run(s, OPEN_TIME[2] - OPEN_TIME[0]);
    expect(s.opened).toBe(2);
  });

  it('割っている途中で押すと、今のカプセルだけを早送りする', () => {
    const s = makeShow(ten());
    skipTo(s, 'wait');
    tap(s);
    run(s, GUARD + 0.01);
    tap(s);
    run(s, 1 / 60);
    expect(s.opened).toBe(1);
  });

  it('とばすと割れていないものも全部割れて並べる', () => {
    const s = makeShow(ten());
    skipTo(s, 'wait');
    tap(s);
    run(s, OPEN_TIME[0] * 3);
    skip(s);
    expect(s.opened).toBe(10);
    expect(s.phase).toBe('list');
  });
});
