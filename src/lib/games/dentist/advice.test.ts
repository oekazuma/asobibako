import { describe, expect, it } from 'vitest';
import { advice, ORDER_TEXT, spent, wrongText } from './advice';
import { createState, HEAD, touch, TRASH, type Stage } from './engine';

const stage = (over: Partial<Stage>): Stage => ({
  animal: 'bear',
  tools: ['brush'],
  symptoms: [],
  pain0: 0,
  painRate: 0.05,
  shots: 0,
  ...over
});

describe('dentist advice', () => {
  it('汚れにはブラシ、虫歯にはドリル、ぐらぐらにはペンチを、その歯の位置で指す', () => {
    for (const [def, tool] of [
      [{ type: 'plaque', tooth: 2, amount: 1 }, 'brush'],
      [{ type: 'cavity', tooth: 2, depth: 1, germs: 1, kind: 'normal' }, 'drill'],
      [{ type: 'loose', tooth: 2 }, 'pliers']
    ] as const) {
      const state = createState(stage({ tools: ['brush', 'drill', 'pliers'], symptoms: [def] }));
      expect(advice(state)).toMatchObject({ tool, x: state.teeth[2].x, y: state.teeth[2].y });
    }
  });

  it('注射が使えて麻酔していなければ、削る前に注射を指す', () => {
    const state = createState(
      stage({
        tools: ['shot', 'drill'],
        shots: Infinity,
        symptoms: [{ type: 'cavity', tooth: 2, depth: 1, germs: 1, kind: 'normal' }]
      })
    );
    expect(advice(state)?.tool).toBe('shot');
    state.teeth[2].numb = true;
    expect(advice(state)?.tool).toBe('drill');
  });

  it('バイキンが出ていればピンセット、つまんでいればゴミ箱を指す', () => {
    const state = createState(stage({ tools: ['tweezers'] }));
    state.germs.push({
      id: 1,
      kind: 'normal',
      cavity: 0,
      x: 0.4,
      y: 0.7,
      hx: 0.4,
      hy: 0.7,
      held: false,
      gone: false,
      born: 0
    });
    expect(advice(state)).toMatchObject({ tool: 'tweezers', x: 0.4, y: 0.7 });
    state.tool = 'tweezers';
    touch(state, 0.4, 0.7);
    expect(advice(state)).toMatchObject({ tool: 'tweezers', x: TRASH.x, y: TRASH.y });
  });

  it('なだめている最中はよしよしを指す。ただし歯を引っぱっている途中は邪魔しない', () => {
    const state = createState(stage({ tools: ['pat', 'pliers'], symptoms: [{ type: 'loose', tooth: 2 }] }));
    state.calming = true;
    expect(advice(state)).toMatchObject({ tool: 'pat', x: HEAD.x, y: HEAD.y });
    state.grip = { kind: 'tooth', symptom: 0, y0: 0, base: 0 };
    expect(advice(state)?.tool).toBe('pliers');
  });

  it('効かない道具と順番ちがいのひとこと', () => {
    expect(wrongText('drill')).toBe('むしばには ドリルだよ');
    expect(ORDER_TEXT).toBe('さきに バイキンを すてよう');
  });

  it('汚れがなくなったブラシと、注射の残りがない注射は、もう使わない道具になる', () => {
    const state = createState(
      stage({
        tools: ['brush', 'shot', 'drill', 'pat'],
        shots: 1,
        symptoms: [{ type: 'cavity', tooth: 2, depth: 1, germs: 1, kind: 'normal' }]
      })
    );
    expect(spent(state)).toEqual(['brush']);
    state.shots = 0;
    expect(spent(state)).toEqual(['brush', 'shot']);
  });

  it('治りきったら何も指さない', () => {
    const state = createState(stage({}));
    state.result = 'clear';
    expect(advice(state)).toBeNull();
  });
});
