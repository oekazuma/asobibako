import { describe, expect, it } from 'vitest';
import {
  CALM_ON,
  createState,
  expression,
  FILL_S,
  germPos,
  HEAD,
  lift,
  needFor,
  painWithoutCare,
  rub,
  select,
  step,
  touch,
  TRASH,
  type GameState,
  type Stage
} from './engine';

export const stageOf = (over: Partial<Stage>): Stage => ({
  animal: 'bear',
  tools: ['brush'],
  symptoms: [],
  pain0: 0,
  painRate: 0.05,
  shots: 0,
  ...over
});

/** 先端を (x, y) のまわりで小さく回し、こすった距離を稼ぐ */
export function scrub(state: GameState, x: number, y: number, seconds: number) {
  const events = [];
  events.push(...touch(state, x, y));
  for (let t = 0; t < seconds; t += 1 / 60) {
    const a = t * Math.PI * 6;
    events.push(...rub(state, x + Math.cos(a) * 0.01, y + Math.sin(a) * 0.01, 1 / 60));
    events.push(...step(state, 1 / 60));
  }
  return events;
}

describe('dentist engine: ブラシ', () => {
  it('汚れはこすった距離だけ減り、なくなるとキラッと光ってクリア', () => {
    const state = createState(stageOf({ symptoms: [{ type: 'plaque', tooth: 2, amount: 0.3 }] }));
    const { x, y } = state.teeth[2];
    const first = scrub(state, x, y, 0.5);
    const plaque = state.symptoms[0];
    expect(plaque.type === 'plaque' && plaque.left).toBeLessThan(0.3);
    expect(first.some((e) => e.type === 'cleaned')).toBe(false);
    const rest = scrub(state, x, y, 3);
    expect(rest.some((e) => e.type === 'cleaned')).toBe(true);
    expect(needFor(state.symptoms[0])).toBeNull();
    expect(state.result).toBe('clear');
  });

  it('歯のないところをこすっても何も起きない', () => {
    const state = createState(stageOf({ symptoms: [{ type: 'plaque', tooth: 2, amount: 0.3 }] }));
    const events = scrub(state, 0.05, 0.05, 1);
    expect(events.filter((e) => e.type !== 'progress')).toEqual([]);
    expect(state.result).toBeNull();
  });

  it('その面にない道具は選べない', () => {
    const state = createState(stageOf({ tools: ['brush'] }));
    expect(select(state, 'drill')).toBe(false);
    expect(state.tool).toBe('brush');
  });

  it('何も治らないあいだ idle が増え、治ると 0 に戻る', () => {
    const state = createState(stageOf({ symptoms: [{ type: 'plaque', tooth: 2, amount: 5 }] }));
    for (let t = 0; t < 2; t += 1 / 60) step(state, 1 / 60);
    expect(state.idle).toBeGreaterThan(1.9);
    scrub(state, state.teeth[2].x, state.teeth[2].y, 0.2);
    expect(state.idle).toBeLessThan(0.1);
  });

  it('表情はメーターと結果で変わる', () => {
    const state = createState(stageOf({ symptoms: [{ type: 'plaque', tooth: 2, amount: 5 }] }));
    expect(expression(state)).toBe('calm');
    state.pain = 0.55;
    expect(expression(state)).toBe('nervous');
    state.result = 'clear';
    expect(expression(state)).toBe('happy');
  });
});

const cavityStage = (kind: 'normal' | 'quick' | 'boss' = 'normal', germs = 2) =>
  stageOf({
    tools: ['drill', 'tweezers', 'filling'],
    symptoms: [{ type: 'cavity', tooth: 3, depth: 0.5, germs, kind }]
  });

/** つまんだ先端を dest へまっすぐ運び、着いたら離す */
function carry(state: GameState, from: [number, number], dest: [number, number], seconds = 2) {
  const events = [...touch(state, ...from)];
  for (let t = 0; t < seconds; t += 1 / 60) {
    const k = Math.min(1, t / (seconds * 0.5));
    events.push(...rub(state, from[0] + (dest[0] - from[0]) * k, from[1] + (dest[1] - from[1]) * k, 1 / 60));
    events.push(...step(state, 1 / 60));
  }
  events.push(...lift(state, ...dest));
  return events;
}

describe('dentist engine: 虫歯', () => {
  it('削るとバイキンが出て、ゴミ箱に捨てると穴になり、詰めると治る', () => {
    const state = createState(cavityStage());
    const { x, y } = state.teeth[3];
    const drilled = scrub(state, x, y, 1);
    expect(drilled.some((e) => e.type === 'drilled')).toBe(true);
    expect(state.germs).toHaveLength(2);
    select(state, 'tweezers');
    for (const g of [...state.germs]) {
      const events = carry(state, germPos(g, state.time), [TRASH.x, TRASH.y]);
      expect(events.some((e) => e.type === 'byebye')).toBe(true);
    }
    expect(state.symptoms[0].type === 'cavity' && state.symptoms[0].stage).toBe('hole');
    select(state, 'filling');
    const filled = scrub(state, x, y, FILL_S + 0.2);
    expect(filled.some((e) => e.type === 'filled')).toBe(true);
    expect(state.result).toBe('clear');
  });

  it('ゴミ箱の外で離したバイキンは穴へ戻る', () => {
    const state = createState(cavityStage('normal', 1));
    scrub(state, state.teeth[3].x, state.teeth[3].y, 1);
    select(state, 'tweezers');
    const g = state.germs[0];
    const events = carry(state, germPos(g, state.time), [0.2, 1.0], 1);
    expect(events.some((e) => e.type === 'escape')).toBe(true);
    for (let t = 0; t < 2; t += 1 / 60) step(state, 1 / 60);
    expect(Math.hypot(g.x - g.hx, g.y - g.hy)).toBeLessThan(0.002);
    expect(g.gone).toBe(false);
  });

  it('バイキンが残っている穴に詰め物を当てると、順番ちがいを知らせて詰まらない', () => {
    const state = createState(cavityStage());
    const { x, y } = state.teeth[3];
    scrub(state, x, y, 1);
    select(state, 'filling');
    const events = scrub(state, x, y, 1);
    expect(events).toContainEqual(expect.objectContaining({ type: 'order' }));
    expect(state.symptoms[0].type === 'cavity' && state.symptoms[0].stage).toBe('germs');
  });

  it('虫歯にブラシを当てると、ドリルを使うよう知らせる', () => {
    const state = createState(
      stageOf({
        tools: ['brush', 'drill'],
        symptoms: [{ type: 'cavity', tooth: 3, depth: 0.5, germs: 1, kind: 'normal' }]
      })
    );
    const events = touch(state, state.teeth[3].x, state.teeth[3].y);
    expect(events).toContainEqual(expect.objectContaining({ type: 'wrong', need: 'drill' }));
  });

  it('おやぶんはピンセットにゆっくりしかついてこない', () => {
    const state = createState(cavityStage('boss', 1));
    scrub(state, state.teeth[3].x, state.teeth[3].y, 1);
    select(state, 'tweezers');
    const g = state.germs[0];
    touch(state, ...germPos(g, state.time));
    rub(state, TRASH.x, TRASH.y, 1 / 60);
    expect(Math.hypot(g.x - TRASH.x, g.y - TRASH.y)).toBeGreaterThan(0.2);
  });

  it('すばしっこいバイキンは穴のまわりを動き回る', () => {
    const state = createState(cavityStage('quick', 1));
    scrub(state, state.teeth[3].x, state.teeth[3].y, 1);
    const g = state.germs[0];
    const xs = new Set<number>();
    for (let t = 0; t < 1; t += 0.1) xs.add(Math.round(germPos(g, t)[0] * 1000));
    expect(xs.size).toBeGreaterThan(3);
  });
});

describe('dentist engine: ぐらぐらと痛み', () => {
  const pull = (state: GameState, i: number) => {
    const t = state.teeth[i];
    const away = t.row === 'upper' ? 1 : -1;
    const events = [...touch(state, t.x, t.y)];
    for (let k = 1; k <= 30; k++) events.push(...rub(state, t.x, t.y + away * k * 0.006, 1 / 60));
    events.push(...lift(state, t.x, t.y));
    return events;
  };

  it('ぐらぐらの歯は歯ぐきと反対へ引っぱると抜ける', () => {
    const state = createState(stageOf({ tools: ['pliers'], symptoms: [{ type: 'loose', tooth: 8 }] }));
    const events = pull(state, 8);
    expect(events).toContainEqual(expect.objectContaining({ type: 'pulled', tooth: 8 }));
    expect(state.teeth[8].gone).toBe(true);
    step(state, 1 / 60);
    expect(state.result).toBe('clear');
  });

  it('健康な歯はペンチでつかめない', () => {
    const state = createState(stageOf({ tools: ['pliers'], symptoms: [{ type: 'loose', tooth: 8 }] }));
    const events = pull(state, 2);
    expect(events).toContainEqual(expect.objectContaining({ type: 'slip' }));
    expect(state.teeth[2].gone).toBe(false);
  });

  it('麻酔していない虫歯を削り続けると泣く', () => {
    const state = createState(
      stageOf({
        tools: ['drill'],
        painRate: 0.7,
        symptoms: [{ type: 'cavity', tooth: 3, depth: 5, germs: 1, kind: 'normal' }]
      })
    );
    const events = scrub(state, state.teeth[3].x, state.teeth[3].y, 3);
    expect(events).toContainEqual({ type: 'cry' });
    expect(state.result).toBe('cried');
  });

  it('注射した歯と両どなりは削っても痛くない', () => {
    const state = createState(
      stageOf({
        tools: ['shot', 'drill'],
        painRate: 0.7,
        shots: 1,
        symptoms: [{ type: 'cavity', tooth: 3, depth: 1.5, germs: 1, kind: 'normal' }]
      })
    );
    const t = state.teeth[3];
    touch(state, t.x, t.y);
    lift(state, t.x, t.y);
    expect([2, 3, 4].map((i) => state.teeth[i].numb)).toEqual([true, true, true]);
    expect(state.teeth[5].numb).toBe(false);
    expect(state.shots).toBe(0);
    select(state, 'drill');
    scrub(state, t.x, t.y, 2);
    expect(state.pain).toBe(0);
  });

  it('よしよしで頭をなでるとメーターが下がり、6 割でなだめ始めて 3 割まで続ける', () => {
    // 症状が 1 つもないとすぐクリアになるので、触らない虫歯を 1 つ置く
    const state = createState(
      stageOf({
        tools: ['pat', 'drill'],
        pain0: CALM_ON,
        symptoms: [{ type: 'cavity', tooth: 2, depth: 5, germs: 1, kind: 'normal' }]
      })
    );
    step(state, 1 / 60);
    expect(state.calming).toBe(true);
    scrub(state, HEAD.x, HEAD.y, 0.3);
    expect(state.pain).toBeLessThan(CALM_ON);
    expect(state.calming).toBe(true);
    scrub(state, HEAD.x, HEAD.y, 3);
    expect(state.pain).toBeLessThan(0.3);
    expect(state.calming).toBe(false);
  });

  it('painWithoutCare は怖がりの分と、削る・抜く作業の痛みを足す', () => {
    expect(
      painWithoutCare(
        stageOf({
          pain0: 0.5,
          painRate: 0.7,
          symptoms: [
            { type: 'cavity', tooth: 1, depth: 1, germs: 1, kind: 'normal' },
            { type: 'loose', tooth: 8 }
          ]
        })
      )
    ).toBeCloseTo(0.5 + 0.7 * 1.5);
  });
});
