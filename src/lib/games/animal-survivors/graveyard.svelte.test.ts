import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { FOREST } from './stages/forest';
import { GRAVEYARD } from './stages/graveyard';
import { STAGES, stageOf } from './stages';
import { Prompts } from './prompts.svelte';
import { coinsOf, createWorld, damageEnemy, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };

function quiet(): World {
  const w = createWorld('dog', 1, VIEW, {}, 'graveyard');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [] };
  w.spawnAcc = [];
  w.weapons = [];
  w.propCd = 9999;
  w.player.invuln = 9999;
  return w;
}

describe('面の表', () => {
  it('森と墓地が並び、墓地の敵とボスはどれも敵の表にある', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard']);
    for (const w of GRAVEYARD.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of GRAVEYARD.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    for (const e of GRAVEYARD.events) expect(ENEMIES[e.enemy]).toBeDefined();
    const at = GRAVEYARD.events.map((e) => e.at);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    for (const b of GRAVEYARD.bosses) for (const t of at) expect(Math.abs(t - b.at)).toBeGreaterThan(20);
    expect(stageOf('nope')).toBe(FOREST);
  });

  it('墓地は森より 1.1 倍強く、コインは 1.5 倍', () => {
    for (const t of [0, 300, 899]) {
      expect(GRAVEYARD.toughness(t)).toBeCloseTo(FOREST.toughness(t) * 1.1);
      expect(GRAVEYARD.fury(t)).toBeCloseTo(FOREST.fury(t) * 1.1);
    }
    const w = createWorld('dog', 1, VIEW, {}, 'graveyard');
    expect(w.stage).toBe(GRAVEYARD);
    expect(w.spawnAcc).toHaveLength(GRAVEYARD.waves.length);
    w.coins = 10;
    expect(coinsOf(w)).toBe(15);
  });
});

describe('墓地のボス', () => {
  it('かぼちゃ大王は種を撃ち、ちびかぼちゃを呼ぶ', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.pumpkin, 80, 0, ENEMIES.pumpkin.hp));
    let seed = false;
    for (let i = 0; i < 60 * 12; i++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      seed ||= w.hazards.some((h) => h.alive && h.kind === 'web' && h.art === 'seed');
    }
    expect(seed).toBe(true);
    expect(w.enemies.some((e) => e.alive && e.def.id === 'pumpkinling')).toBe(true);
    expect(w.enemies.some((e) => e.alive && e.def.id === 'spiderling')).toBe(false);
  });

  it('ガイコツの騎士は突進と地ならしを使う', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.knight, 80, 0, ENEMIES.knight.hp));
    const kinds = new Set<string>();
    for (let i = 0; i < 60 * 12; i++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      for (const h of w.hazards) if (h.alive) kinds.add(h.kind);
    }
    expect(kinds).toEqual(new Set(['dash', 'slam']));
  });
});

describe('墓地のボスの WARNING と曲', () => {
  it('3 分の前にガイコツの騎士の WARNING が出てボスの曲になり、倒すと戻る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'graveyard');
    w.stage = { ...w.stage, waves: [], events: [] };
    w.spawnAcc = [];
    w.weapons = [];
    w.propCd = 9999;
    w.player.invuln = 9999;
    const p = new Prompts(w);
    w.time = 176;
    let warned = '';
    for (let i = 0; i < 60 * 5; i++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      p.take();
      if (p.warning) warned = p.warning.name;
    }
    expect(warned).toBe('ガイコツの騎士');
    expect(p.boss).toBe(true);
    const i = w.enemies.findIndex((e) => e.alive && e.def.id === 'knight');
    damageEnemy(w, i, 99999, 0, 0);
    p.take();
    expect(p.boss).toBe(false);
    expect(w.bossKills).toEqual(['knight']);
    p.stop();
  });
});
