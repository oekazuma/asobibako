import { describe, expect, it } from 'vitest';
import { spawnBosses } from './bosses';
import { ENEMIES } from './enemies';
import { startOvertime } from './overtime';
import { INTRO, Prompts } from './prompts.svelte';
import { FINALE } from './stages/forest';
import { createWorld, spawnChiefs, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

/** at 秒のボスが出る直前の World。ほかの敵とボスの行は済ませてある */
function before(at: number): World {
  const w = createWorld('dog', 2, VIEW);
  w.weapons = [];
  w.metalAt = -1;
  w.propCd = 1e9;
  w.player.hp = w.stats.maxHp = 1e9;
  w.stage = { ...w.stage, events: [], chiefs: [], waves: [] };
  w.spawnAcc = [];
  const i = w.stage.bosses.findIndex((b) => b.at >= at);
  w.bossNext = w.warned = i;
  w.time = at - 0.01;
  return w;
}

function bossAppears(at: number, still = false) {
  const w = before(at);
  const p = new Prompts(w, still);
  step(w, { x: 0, y: 0 }, 1 / 30);
  p.take();
  return { w, p };
}

describe('ボスの登場', () => {
  it('ボスが出ると登場が始まり、終わるまで busy', () => {
    const { w, p } = bossAppears(180);
    expect(p.intro?.name).toBe('巨大ベア');
    expect(p.intro?.epithet).toBe('森の暴れん坊');
    expect(p.busy).toBe(true);
    p.next(null, INTRO - 0.1);
    expect(p.busy).toBe(true);
    p.next(null, 0.2);
    expect(p.intro).toBeNull();
    expect(p.busy).toBe(false);
    expect(w.enemies.some((e) => e.alive && e.def.boss === 'bear')).toBe(true);
    p.stop();
  });

  it('登場のあいだは 3 択が開かず、終わってから開く', () => {
    const { w, p } = bossAppears(180);
    w.pending = 1;
    p.next(null, 0.5);
    expect(p.options).toBeNull();
    p.next(null, INTRO);
    expect(p.options).not.toBeNull();
    p.stop();
  });

  it('カメラは 0 秒で自分、0.6〜1.8 秒でボス、終わりは自分へ戻る', () => {
    const { w, p } = bossAppears(180);
    const boss = w.enemies.find((e) => e.alive && e.def.boss)!;
    expect(p.focus(w)).toEqual({ x: w.player.x, y: w.player.y });
    p.next(null, 1.2);
    const at = p.focus(w)!;
    expect(at.x).toBeCloseTo(boss.x);
    expect(at.y).toBeCloseTo(boss.y);
    p.next(null, INTRO - 1.2 - 0.001);
    const back = p.focus(w)!;
    expect(Math.hypot(back.x - w.player.x, back.y - w.player.y)).toBeLessThan(1);
    p.stop();
  });

  it('動きを減らす設定ではカメラを動かさず、札だけを短く出す', () => {
    const { w, p } = bossAppears(180, true);
    expect(p.intro).not.toBeNull();
    p.next(null, 1);
    expect(p.focus(w)).toBeNull();
    p.next(null, 0.3);
    expect(p.intro).toBeNull();
    p.stop();
  });

  it('面の主は 2 体で 1 回、札は「面の主」と 2 体の名前で、カメラは 2 体のあいだ', () => {
    const { w, p } = bossAppears(FINALE);
    expect(p.intro?.ids).toHaveLength(2);
    expect(p.intro?.epithet).toBe('面の主');
    expect(p.intro?.name).toBe('巨大ベア・女王グモ');
    const [a, b] = p.intro!.ids.map((i) => w.enemies[i]);
    p.next(null, 1.2);
    expect(p.focus(w)!.x).toBeCloseTo((a.x + b.x) / 2);
    p.stop();
  });

  it('延長戦のボスでは登場が起きない', () => {
    const w = before(900);
    w.time = 900 - 1e-6;
    step(w, still, 1 / 60);
    startOvertime(w);
    w.time = 959.99;
    const p = new Prompts(w, false);
    spawnBosses(w);
    w.time = 960.01;
    spawnBosses(w);
    p.take();
    expect(w.enemies.some((e) => e.alive && e.def.boss)).toBe(true);
    expect(p.intro).toBeNull();
    p.stop();
  });

  it('6 体のボスに二つ名がある', () => {
    const bosses = Object.values(ENEMIES).filter((d) => d.boss);
    expect(bosses).toHaveLength(6);
    for (const d of bosses) expect(d.epithet?.length).toBeGreaterThan(0);
  });
});

describe('ヌシの登場', () => {
  it('ヌシが出ると大きな帯が出る', () => {
    const w = createWorld('dog', 2, VIEW);
    w.stage = { ...w.stage, chiefs: [{ at: 0, enemy: 'boar', hp: 600 }] };
    const p = new Prompts(w, false);
    spawnChiefs(w);
    p.take();
    expect(p.chief?.text).toBe('ヌシイノシシ');
    expect(p.notice).toBeNull();
    p.stop();
  });
});
