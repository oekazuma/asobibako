import { describe, expect, it } from 'vitest';
import { applySnap, makeSnap, SNAP_HITS } from './snap';
import { addHero, createWorld, type GameEvent, type World } from './world';

const VIEW = { w: 274, h: 394 };

/** 終盤の重い様子。弾・効果・玉・品を何千と散らし、ダメージの数字を 800 個積む */
function heavy(): { w: World; events: GameEvent[] } {
  const w = createWorld('dog', 1, VIEW);
  addHero(w, 'cat');
  w.heroes[1].player.x = 0;
  w.heroes[1].player.y = 0;
  for (let i = 0; i < 1200; i++) {
    const x = ((i * 37) % 4000) - 2000;
    const y = ((i * 53) % 4000) - 2000;
    w.shots.push({
      alive: true,
      kind: 'shot',
      slot: 0,
      x,
      y,
      vx: 1,
      vy: 0,
      angle: 0,
      r: 3,
      age: 0,
      life: 1,
      hit: []
    } as never);
    w.effects.push({
      alive: true,
      kind: 'flame',
      slot: 0,
      x,
      y,
      age: 0,
      life: 3,
      r: 10,
      angle: 0,
      born: 0,
      dmg: 1,
      knock: 0
    } as never);
    w.gems.push({ alive: true, x, y, value: 1, pulled: false } as never);
    w.items.push({ alive: true, kind: 'coin', x, y, pulled: false } as never);
  }
  const events: GameEvent[] = Array.from({ length: 800 }, (_, i) => ({ type: 'hit', x: i, y: i, dmg: 5, crit: false }));
  events.push({ type: 'levelup' });
  return { w, events };
}

describe('協力プレイの様子の大きさ', () => {
  it('終盤の重い様子でも 256KB を十分に下回る', () => {
    const { w, events } = heavy();
    const bytes = JSON.stringify(makeSnap(w, events)).length;
    expect(bytes).toBeLessThan(200_000);
  });

  it('ダメージの数字は 60 個までにし、ほかの出来事は落とさない', () => {
    const { w, events } = heavy();
    const s = makeSnap(w, events);
    expect(s.events.filter((e) => e.type === 'hit')).toHaveLength(SNAP_HITS);
    expect(s.events.some((e) => e.type === 'levelup')).toBe(true);
  });

  it('子のまわりのものは送り、遠いものは送らない', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.heroes[1].player.x = 1000;
    w.heroes[1].player.y = 0;
    w.gems.push({ alive: true, x: 1010, y: 0, value: 1, pulled: false } as never);
    w.gems.push({ alive: true, x: -3000, y: 0, value: 1, pulled: false } as never);
    const s = makeSnap(w, []);
    expect(s.gems.map((r) => r[0])).toEqual([0]);
  });

  it('送らなかった玉は子の画面で消え、近づけばまた出る', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.gems.push({ alive: true, x: 0, y: 0, value: 1, pulled: false } as never);
    const view = createWorld('dog', 1, VIEW);
    addHero(view, 'cat');
    view.cur = 1;
    applySnap(view, JSON.parse(JSON.stringify(makeSnap(w, []))));
    expect(view.gems[0].alive).toBe(true);
    w.heroes[1].player.x = 5000;
    applySnap(view, JSON.parse(JSON.stringify(makeSnap(w, []))));
    expect(view.gems[0].alive).toBe(false);
    w.heroes[1].player.x = 0;
    applySnap(view, JSON.parse(JSON.stringify(makeSnap(w, []))));
    expect(view.gems[0].alive).toBe(true);
  });
});
