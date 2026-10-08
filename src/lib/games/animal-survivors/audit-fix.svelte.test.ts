import { describe, expect, it } from 'vitest';
import { LINK_FUSE, LINK_SHOW } from './link';
import { Prompts } from './prompts.svelte';
import { makeSnap, SNAP_HITS } from './snap';
import { addHero, createWorld, type GameEvent } from './world';

const VIEW = { w: 274, h: 394 };

describe('子の画面の連携の帯', () => {
  it('様子が 1 秒に 20 回しか届かなくても、ゲームの時間で 1.8 秒たてば消える', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.time = 100;
    const p = new Prompts(w);
    w.events.push({ type: 'link', a: 'dog', b: 'cat', name: 'X' });
    p.take();
    // 3 フレームに 1 回だけ、届いた様子でゲームの時刻が 0.05 秒ずつ進む
    for (let f = 0; f < 3 * Math.ceil((LINK_FUSE + LINK_SHOW) / 0.05) + 3; f++) {
      if (f % 3 === 0) w.time += 0.05;
      p.next(null, 1 / 60);
    }
    expect(p.link).toBeNull();
  });
});

describe('協力プレイのダメージの数字', () => {
  it('子のまわりのダメージの数字だけを、新しいほうから 60 個送る', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.heroes[1].player.x = 0;
    w.heroes[1].player.y = 0;
    const far: GameEvent[] = Array.from({ length: 100 }, () => ({ type: 'hit', x: 5000, y: 0, dmg: 1, crit: false }));
    const mine: GameEvent[] = Array.from({ length: 80 }, (_, i) => ({ type: 'hit', x: i, y: 0, dmg: 1, crit: false }));
    const s = makeSnap(w, [...far, ...mine]);
    const hits = s.events.filter((e) => e.type === 'hit') as { x: number }[];
    expect(hits).toHaveLength(SNAP_HITS);
    expect(hits.every((e) => e.x < 100)).toBe(true);
    expect(hits[0].x).toBe(80 - SNAP_HITS);
  });
});

describe('遠くても送る品', () => {
  it('遺物・宝箱・ガチャ券は、子から遠くても送る（古い地図の矢印と、歩いて拾う品のため）', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.heroes[1].player.x = 0;
    w.items = [];
    for (const kind of ['relic', 'chest', 'ticket', 'coin'] as const)
      w.items.push({
        alive: true,
        kind,
        x: 3000,
        y: 0,
        pulled: false,
        ...(kind === 'relic' && { relic: 'map' })
      } as never);
    const s = makeSnap(w, []);
    expect(s.items.map((r) => r[0])).toEqual([0, 1, 2]);
  });
});
