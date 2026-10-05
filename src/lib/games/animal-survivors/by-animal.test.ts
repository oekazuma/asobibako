import { describe, expect, it } from 'vitest';
import { betOf } from './cauldron';
import { emptyRecords, parseRecords, record } from './records';
import { createWorld, summary } from './world';

const VIEW = { w: 274, h: 394 };
const runOf = (animal: 'dog' | 'cat', level: number, time: number, cleared: boolean) => {
  const w = createWorld(animal, 1, VIEW, {}, 'forest', { heat: { level, bet: betOf(level) } });
  w.time = time;
  w.over = cleared ? 'clear' : 'dead';
  return summary(w);
};

describe('動物ごとの記録', () => {
  it('動物ごとに、いちばん長く生き延びた秒と、クリアしたいちばん高い釜の強さを覚える', () => {
    const r = { ...emptyRecords(), coins: 9000 };
    record(r, runOf('dog', 3, 250, false));
    expect(r.byAnimal.dog).toEqual({ time: 250 });
    record(r, runOf('dog', 3.5, 600, true));
    record(r, runOf('dog', 2, 600, true));
    record(r, runOf('dog', 2, 100, false));
    expect(r.byAnimal.dog).toEqual({ time: 600, heat: 3.5 });
    expect(r.byAnimal.cat).toBeUndefined();
  });

  it('読み込むときは、知らない動物と壊れた値を捨てる', () => {
    const r = parseRecords(
      JSON.stringify({ byAnimal: { dog: { time: 300, heat: 4 }, cat: { time: 'x' }, nope: { time: 9 }, wolf: 5 } })
    );
    expect(r.byAnimal).toEqual({ dog: { time: 300, heat: 4 } });
    expect(parseRecords(null).byAnimal).toEqual({});
  });
});
