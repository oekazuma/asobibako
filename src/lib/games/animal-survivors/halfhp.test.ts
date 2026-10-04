import { describe, expect, it } from 'vitest';
import { takeArcana } from './arcana';
import { levelUp } from './choices';
import { gainXp, xpNeed } from './drops';
import { createWorld, type World } from './world';

const VIEW = { w: 274, h: 394 };

/** 大きな心臓を取り、1 段階育つまで経験値を入れる */
function rebuild(w: World) {
  levelUp(w, { kind: 'passive', id: 'heart', level: 1 });
  let need = 0;
  for (let l = w.level; l < 10; l++) need += xpNeed(l);
  gainXp(w, need / w.stats.growth + 0.01);
}

describe('最大 HP 半分のあとに能力を作り直す', () => {
  it('いちかばちかの半分は、パッシブを取って育っても半分のまま', () => {
    const plain = createWorld('dog', 1, VIEW);
    const w = createWorld('dog', 1, VIEW);
    takeArcana(w, 'gamble');
    rebuild(plain);
    rebuild(w);
    expect(w.form).toBe(1);
    expect(w.stats.maxHp).toBeCloseTo(plain.stats.maxHp / 2);
  });

  it('お題の HP 半分といちかばちかが重なると 4 分の 1 のまま', () => {
    const plain = createWorld('dog', 1, VIEW);
    const w = createWorld('dog', 1, VIEW, {}, 'forest', {
      challenge: { date: 'x', bonus: 0, mods: ['halfHp', 'noTools'], card: 'gamble' }
    });
    rebuild(plain);
    rebuild(w);
    expect(w.stats.maxHp).toBeCloseTo(plain.stats.maxHp / 4);
  });
});
