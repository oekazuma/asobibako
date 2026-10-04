import { describe, expect, it } from 'vitest';
import { takeArcana } from './arcana';
import { attackWait } from './arms';
import { createWorld } from './world';

const VIEW = { w: 274, h: 394 };

describe('ガラスの大砲', () => {
  it('持っていなければ待ち時間は今のまま', () => {
    expect(attackWait(createWorld('dog', 1, VIEW), 1)).toBeCloseTo(1);
  });

  it('ガラスの大砲だけなら待ち時間は 6 割', () => {
    const w = createWorld('dog', 1, VIEW);
    takeArcana(w, 'glass');
    expect(attackWait(w, 1)).toBeCloseTo(0.6);
  });

  it('はやい鼓動 Lv5 と時の砂で下限に届いていても、さらに 6 割にする', () => {
    const w = createWorld('dog', 1, VIEW);
    w.passives.push({ id: 'drum', level: 5 });
    takeArcana(w, 'sand');
    expect(attackWait(w, 1)).toBeCloseTo(0.5);
    takeArcana(w, 'glass');
    expect(attackWait(w, 1)).toBeCloseTo(0.3);
  });
});
