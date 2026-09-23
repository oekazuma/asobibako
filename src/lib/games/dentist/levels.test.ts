import { describe, expect, it } from 'vitest';
import { advice } from './advice';
import { ANIMALS } from './animals';
import {
  createState,
  lift,
  needFor,
  painWithoutCare,
  rub,
  select,
  step,
  symptomOn,
  toothAt,
  touch,
  TRASH,
  type GameState
} from './engine';
import { introduces, LEVELS } from './levels';

const DT = 1 / 60;

/**
 * advice() に従う子どもの代わり。careless は注射とよしよしを使わない（痛みへの手当てを忘れる子）。
 * 指は advice の場所に置いて小さく回すか、ピンセットならゴミ箱へ、ペンチなら歯ぐきと反対へ動かす
 */
function play(state: GameState, careless = false, limit = 240) {
  let down = false;
  let at: [number, number] = [0, 0];
  const release = () => {
    if (down) lift(state, ...at);
    down = false;
  };
  for (let frame = 0; frame < limit / DT && !state.result; frame++) {
    if (careless) state.calming = false;
    let a = advice(state);
    if (a && careless && a.tool === 'shot') {
      const s = symptomOn(state, toothAt(state, a.x, a.y));
      a = { ...a, tool: s ? needFor(s)! : 'drill' };
    }
    if (!a) {
      step(state, DT);
      continue;
    }
    if (a.tool !== state.tool) {
      release();
      select(state, a.tool);
    }
    if (a.tool === 'shot') {
      touch(state, a.x, a.y);
      lift(state, a.x, a.y);
    } else if (a.tool === 'tweezers' || a.tool === 'pliers') {
      if (state.grip === null) {
        release();
        at = [a.x, a.y];
        touch(state, ...at);
        down = true;
      } else if (a.tool === 'tweezers') {
        const d = Math.hypot(TRASH.x - at[0], TRASH.y - at[1]);
        const k = Math.min(1, (1.5 * DT) / Math.max(d, 1e-9));
        at = [at[0] + (TRASH.x - at[0]) * k, at[1] + (TRASH.y - at[1]) * k];
        rub(state, ...at, DT);
        const held = state.germs.find((g) => g.held)!;
        if (Math.hypot(held.x - TRASH.x, held.y - TRASH.y) < TRASH.r * 0.5) release();
      } else {
        const tooth = state.teeth[toothAt(state, a.x, a.y)];
        at = [at[0], at[1] + (tooth.row === 'upper' ? 1 : -1) * 0.004];
        rub(state, ...at, DT);
      }
    } else {
      const g = state.time * Math.PI * 6;
      at = [a.x + Math.cos(g) * 0.01, a.y + Math.sin(g) * 0.01];
      if (!down) touch(state, ...at);
      down = true;
      rub(state, ...at, DT);
    }
    step(state, DT);
  }
  return state.result;
}

describe('dentist levels', () => {
  it('面は 20', () => {
    expect(LEVELS).toHaveLength(20);
  });

  it('同じ面はない', () => {
    expect(new Set(LEVELS.map((s) => JSON.stringify(s))).size).toBe(LEVELS.length);
  });

  it.each(LEVELS.map((s, i) => [i + 1, s] as const))(
    '%i 面の症状は 1 本の歯に 1 つで、歯の番号は口の中にある',
    (_, s) => {
      const teeth = s.symptoms.map((d) => d.tooth);
      expect(new Set(teeth).size).toBe(teeth.length);
      for (const t of teeth) expect(t).toBeLessThan(ANIMALS[s.animal].per * 2);
    }
  );

  it.each(LEVELS.map((s, i) => [i + 1, s] as const))('%i 面は、次にやることに従えばクリアできる', (_, s) => {
    expect(play(createState(s))).toBe('clear');
  });

  it.each(
    LEVELS.map((s, i) => [i + 1, s] as const).filter(([, s]) => s.tools.includes('shot') || s.tools.includes('pat'))
  )('%i 面は、注射もよしよしも使わないと泣く', (_, s) => {
    expect(painWithoutCare(s)).toBeGreaterThanOrEqual(1);
    expect(play(createState(s), true)).toBe('cried');
  });

  it('痛みを覚える前の面は、ふつうに治せば泣かない', () => {
    for (const s of LEVELS.slice(0, 6)) expect(painWithoutCare(s)).toBeLessThan(1);
  });

  it('道具は面が進むにつれて 1 つずつ増え、初めて出る面で手本を見せる', () => {
    expect(introduces(1)).toEqual(['brush']);
    expect(introduces(3)).toEqual(['drill', 'tweezers', 'filling']);
    expect(introduces(7)).toEqual(['shot']);
    expect(introduces(8)).toEqual(['pat']);
    expect(introduces(20)).toEqual([]);
  });
});
