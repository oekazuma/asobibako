import { describe, expect, it } from 'vitest';
import { gainXp, xpNeed } from './drops';
import { growFrame } from './grow';
import { GROW, Prompts } from './prompts.svelte';
import { createWorld, type World } from './world';

const VIEW = { w: 274, h: 394 };

/** Lv9 で、あと少しで Lv10（育つ）になる World */
function nearGrow(): World {
  const w = createWorld('dog', 1, VIEW);
  w.level = 9;
  w.xp = xpNeed(9) - 1;
  return w;
}

describe('育つ瞬間', () => {
  it('育つと演出が始まり、終わるまで busy で、そのあとレベルアップの 3 択が開く', () => {
    const w = nearGrow();
    const p = new Prompts(w, false);
    gainXp(w, 5);
    p.take();
    expect(p.evolve).toMatchObject({ from: '子犬', to: 'わんぱく犬', form: 1 });
    expect(p.busy).toBe(true);
    p.next(null, 0.5);
    expect(p.options).toBeNull();
    p.next(null, GROW);
    expect(p.evolve).toBeNull();
    expect(p.options).not.toBeNull();
    p.stop();
  });

  it('育った帯「〜に育った！」は出さない', () => {
    const w = nearGrow();
    const p = new Prompts(w, false);
    gainXp(w, 5);
    p.take();
    expect(p.notice).toBeNull();
    p.stop();
  });

  it('3 択や宝箱が開いているあいだに育ったら、閉じるまで進まない', () => {
    const w = nearGrow();
    const p = new Prompts(w, false);
    w.chests = 1;
    p.next(null, 0);
    expect(p.rewards).not.toBeNull();
    gainXp(w, 5);
    p.take();
    p.next(null, GROW + 1);
    expect(p.evolve?.t).toBe(0);
    p.close(null);
    expect(p.rewards).toBeNull();
    expect(p.options).toBeNull();
    p.next(null, GROW + 0.1);
    expect(p.evolve).toBeNull();
    p.stop();
  });

  it('ボスの登場と重なったら、ボスの登場が先', () => {
    const w = nearGrow();
    const p = new Prompts(w, false);
    w.enemies[0] = {
      ...w.enemies[0],
      alive: true,
      def: { ...w.enemies[0]?.def, name: '巨大ベア' }
    } as World['enemies'][0];
    w.events.push({ type: 'bossIntro', ids: [0] });
    gainXp(w, 5);
    p.take();
    p.next(null, 1);
    expect(p.intro).not.toBeNull();
    expect(p.evolve?.t).toBe(0);
    p.next(null, 2);
    expect(p.intro).toBeNull();
    p.next(null, 1);
    expect(p.evolve?.t).toBeCloseTo(1);
    p.stop();
  });

  it('1 フレームで 2 段育つと演出は 1 回で、最後の姿まで見せる', () => {
    const w = createWorld('dog', 1, VIEW);
    const p = new Prompts(w, false);
    w.events.push({ type: 'grow', form: 1 }, { type: 'grow', form: 2 });
    p.take();
    expect(p.evolve).toMatchObject({ from: '子犬', to: w.animal.forms[2], form: 2 });
    p.stop();
  });

  it('決着したフレームに育っても演出を始めない', () => {
    const w = nearGrow();
    const p = new Prompts(w, false);
    gainXp(w, 5);
    w.over = 'dead';
    p.take();
    expect(p.evolve).toBeNull();
    p.stop();
  });

  it('動きを減らす設定では 1.2 秒で終わる', () => {
    const w = nearGrow();
    const p = new Prompts(w, true);
    gainXp(w, 5);
    p.take();
    p.next(null, 1.25);
    expect(p.evolve).toBeNull();
    p.stop();
  });
});

describe('見せる姿', () => {
  const swaps = (from: number, to: number) => {
    let n = 0;
    let last = growFrame(from, false).form;
    for (let t = from; t < to; t += 0.005) {
      const f = growFrame(t, false).form;
      if (f !== last) n++;
      last = f;
    }
    return n;
  };

  it('はじめは前の姿と新しい姿の白い影が入れ替わり、だんだん速くなる', () => {
    expect(growFrame(0, false)).toMatchObject({ form: 'old', white: true });
    expect(swaps(0.7, 1.4)).toBeGreaterThan(swaps(0, 0.7) * 2);
  });

  it('1.4 秒で光がはじけ、1.6 秒からは新しい姿で、暗さは戻っていく', () => {
    expect(growFrame(1.41, false).burst).toBeGreaterThan(0.8);
    expect(growFrame(1.7, false)).toMatchObject({ form: 'new', white: false, burst: 0 });
    expect(growFrame(2.5, false).dark).toBeLessThan(growFrame(1.7, false).dark);
  });

  it('動きを減らす設定では、白い影もはじける光も出さない', () => {
    for (const t of [0, 0.5, 1.41, 2])
      expect(growFrame(t, true)).toEqual({ form: 'new', white: false, dark: 0, burst: 0 });
  });
});
