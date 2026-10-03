import { describe, expect, it } from 'vitest';
import { ARCANA } from './arcana';
import { ENEMIES } from './enemies';
import { Prompts } from './prompts.svelte';
import { FOREST } from './stages/forest';
import { GRAVEYARD } from './stages/graveyard';
import { createWorld, damageEnemy, makeEnemy } from './world';

const VIEW = { w: 274, h: 394 };
const ALL = ARCANA.map((a) => a.id);

describe('札を選ぶ画面', () => {
  it('はじめに 3 枚を出し、選ぶと閉じて持つ', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL });
    const p = new Prompts(w);
    p.next(null);
    expect(p.cards).toHaveLength(3);
    expect(p.busy).toBe(true);
    p.pickCard(p.cards![0], null);
    expect(p.cards).toBeNull();
    expect(w.arcana).toHaveLength(1);
    expect(w.arcanaPending).toBe(0);
    p.stop();
  });

  it('4:00 と 8:00 のボスの行だけに印がある', () => {
    for (const s of [FOREST, GRAVEYARD]) expect(s.bosses.filter((b) => b.arcana).map((b) => b.at)).toEqual([240, 480]);
  });

  it('印のボスを倒すと札が先、宝箱があとに出る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL });
    w.arcanaPending = 0;
    const p = new Prompts(w);
    w.enemies.push(makeEnemy({ ...ENEMIES.spiderQueen, arcana: true }, 50, 0, 10));
    damageEnemy(w, w.enemies.length - 1, 99, 0, 0);
    w.chests = 1;
    p.next(null);
    expect(p.cards).not.toBeNull();
    expect(p.rewards).toBeNull();
    p.pickCard(p.cards![0], null);
    expect(p.rewards).not.toBeNull();
    p.stop();
  });

  it('3 枚持っていれば印のボスを倒しても出さず、候補が 0 枚なら待ちを捨てる', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ['fang'] });
    const p = new Prompts(w);
    p.next(null);
    p.pickCard('fang', null);
    w.arcanaPending = 1;
    p.next(null);
    expect(p.cards).toBeNull();
    expect(w.arcanaPending).toBe(0);
    p.stop();
  });
});
