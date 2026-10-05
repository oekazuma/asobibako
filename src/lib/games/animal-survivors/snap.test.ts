import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { applySnap, lerpSnap, makeSnap } from './snap';
import { addHero, chiefOf, createWorld, eliteOf, makeEnemy } from './world';

const VIEW = { w: 260, h: 380 };

function guestView() {
  const view = createWorld('cat', 2, VIEW);
  addHero(view, 'dog');
  view.cur = 1;
  return view;
}

describe('snap', () => {
  it('読んだ側の敵・ほかの動物が、親と同じ位置と種類になる', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.enemies.push(
      makeEnemy(ENEMIES.caterpillar, 10, 20, 50),
      makeEnemy(eliteOf(ENEMIES.caterpillar), 30, 40, 50),
      makeEnemy(chiefOf(ENEMIES.caterpillar), -5, 7, 50)
    );
    w.heroes[0].player.x = 12.34;
    const s = JSON.parse(JSON.stringify(makeSnap(w, [])));
    const view = guestView();
    applySnap(view, s);
    const alive = view.enemies.filter((e) => e.alive);
    expect(alive.map((e) => [e.x, e.y, !!e.def.elite, !!e.def.chief])).toEqual([
      [10, 20, false, false],
      [30, 40, true, false],
      [-5, 7, false, true]
    ]);
    expect(view.heroes[0].player.x).toBeCloseTo(12.3);
    expect(view.heroes[0].animal.id).toBe('dog');
    expect(view.heroes[1].animal.id).toBe('cat');
  });

  it('前の様子より敵が減ったら、残りは消える', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 10, 20, 50), makeEnemy(ENEMIES.caterpillar, 1, 2, 50));
    const view = guestView();
    applySnap(view, makeSnap(w, []));
    w.enemies[1].alive = false;
    applySnap(view, makeSnap(w, []));
    expect(view.enemies.filter((e) => e.alive)).toHaveLength(1);
  });

  it('自分の動物の位置は書き換えないが、HP と武器は親の値にする', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.heroes[1].player.x = 500;
    w.heroes[1].player.hp = 33;
    w.heroes[1].weapons.push({ id: 'howl', level: 2, cd: 0 });
    const view = guestView();
    view.heroes[1].player.x = 7;
    applySnap(view, makeSnap(w, []));
    expect(view.heroes[1].player.x).toBe(7);
    expect(view.heroes[1].player.hp).toBe(33);
    expect(view.heroes[1].weapons.map((o) => o.id)).toContain('howl');
  });

  it('時刻・レベル・経験値と出来事を渡す', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.time = 61.25;
    w.level = 4;
    w.xp = 3;
    const view = guestView();
    applySnap(view, makeSnap(w, [{ type: 'levelup' }]));
    expect([view.time, view.level, view.xp]).toEqual([61.3, 4, 3]);
    expect(view.events).toEqual([{ type: 'levelup' }]);
  });

  it('2 つの様子のあいだを、番号の同じ敵の位置でつなぐ', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 0, 0, 50));
    const a = makeSnap(w, []);
    w.enemies[0].x = 10;
    const b = makeSnap(w, []);
    const view = guestView();
    lerpSnap(view, a, b, 0.5);
    expect(view.enemies[0].x).toBe(5);
  });

  it('いちばん多いときでも 1 回 25KB に収まる', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    for (let i = 0; i < 400; i++) w.enemies.push(makeEnemy(ENEMIES.caterpillar, i * 1.37, i * 2.11, 50));
    for (let i = 0; i < 400; i++) w.gems.push({ alive: true, x: i, y: -i, value: 1, pulled: false });
    expect(JSON.stringify(makeSnap(w, [])).length).toBeLessThan(25_000);
  });
});
