import { describe, expect, it } from 'vitest';
import { ANIMAL_ART } from './art/animals';
import { BOSS_ART } from './art/bosses';
import { ENEMY_ART } from './art/enemies';
import { FOREST_ART } from './art/forest';
import { ITEM_ART } from './art/items';
import { goldArt, itemArt } from './art/evolved';
import { PALETTE } from './art/palette';
import { goldOf, problems, type Art } from './pixels';

const all: [string, Art][] = [
  ...Object.entries(ANIMAL_ART).flatMap(([id, a]) =>
    Object.entries(a).map(([k, art]) => [`${id}.${k}`, art] as [string, Art])
  ),
  ...Object.entries(ENEMY_ART),
  ...Object.entries(BOSS_ART),
  ...Object.entries(ITEM_ART),
  ['grass', FOREST_ART.grass],
  ['dirt', FOREST_ART.dirt],
  ...Object.entries(FOREST_ART.decor)
];

describe('ドット絵の格子', () => {
  it('problems は幅のずれと知らない文字と行数のずれを見つける', () => {
    expect(problems('bad', { w: 2, h: 2, frames: [['k.', 'kkk']] }, { k: '#000' })).toEqual(['bad[0] 2 行目の幅が 3']);
    expect(problems('x', { w: 1, h: 1, frames: [['z']] }, { k: '#000' })).toEqual(['x[0] に色のない文字 z']);
    expect(problems('n', { w: 1, h: 2, frames: [['k']] }, { k: '#000' })).toEqual(['n[0] の行数が 1']);
  });

  it.each(all)('%s はすべてのコマが正しい', (name, art) => {
    expect(problems(name, art, PALETTE)).toEqual([]);
  });

  it('動物の歩きは 4 コマ、敵は 2 コマ', () => {
    for (const a of Object.values(ANIMAL_ART)) expect(a.walk.frames).toHaveLength(4);
    for (const e of Object.values(ENEMY_ART)) expect(e.frames).toHaveLength(2);
  });

  it('巨大ベアは 3 コマ、女王グモと子グモは 2 コマ', () => {
    expect(BOSS_ART.bear.frames).toHaveLength(3);
    expect(BOSS_ART.spiderQueen.frames).toHaveLength(2);
    expect(BOSS_ART.spiderling.frames).toHaveLength(2);
    expect(ITEM_ART.web).toBeDefined();
  });

  it('新しい武器と敵の絵がある', () => {
    for (const k of [
      'weapon-claw',
      'weapon-dash',
      'weapon-acorn',
      'weapon-flame',
      'weapon-vine',
      'acorn',
      'flame',
      'vine'
    ])
      expect(ITEM_ART[k]).toBeDefined();
    expect(ITEM_ART.flame.frames).toHaveLength(2);
    expect(ITEM_ART.vine.frames).toHaveLength(2);
    expect(ENEMY_ART.spider.frames).toHaveLength(2);
    expect(ENEMY_ART.croc.frames).toHaveLength(2);
  });

  it('金色の版は線を残し、明るい色ほど明るい金色にする', () => {
    expect(goldOf(PALETTE.k)).toBe(PALETTE.k);
    const dark = goldOf('#303030');
    const light = goldOf('#f0f0f0');
    expect(dark).not.toBe(light);
    expect([dark, light].every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
  });

  it('コイン・大袋・店のアイコンがある', () => {
    for (const k of ['coin', 'purse', 'upgrade-greed', 'upgrade-reroll', 'upgrade-revive'])
      expect(ITEM_ART[k]).toBeDefined();
    expect(ITEM_ART.coin.frames).toHaveLength(2);
    expect([ITEM_ART['upgrade-greed'].w, ITEM_ART['upgrade-greed'].h]).toEqual([12, 12]);
  });

  it('進化形のアイコンは元の絵と同じ大きさで、色だけ金色になり、右上に星がある', () => {
    const base = ITEM_ART['weapon-woof'];
    const evo = itemArt('weapon-woofEvo');
    expect([evo.w, evo.h]).toEqual([base.w, base.h]);
    expect(itemArt('weapon-woofEvo')).toBe(evo);
    expect(evo.frames[0][1][base.w - 2]).toBe('*');
    expect(problems('weapon-woofEvo', evo, { ...PALETTE, ...evo.pal })).toEqual([]);
    expect(itemArt('meat')).toBe(ITEM_ART.meat);
  });

  it('goldArt は線を残して明るい色を金色にする', () => {
    const g = goldArt(ITEM_ART.bone);
    expect(g.pal?.k).toBe(PALETTE.k);
    expect(g.pal?.w).not.toBe(PALETTE.w);
    expect(goldArt(ITEM_ART.bone)).toBe(g);
  });

  it('新しいパッシブ 3 つと、飛ばす・除外のアイコンがある', () => {
    for (const k of ['passive-twin', 'passive-tail', 'passive-clover', 'upgrade-skip', 'upgrade-banish'])
      expect(ITEM_ART[k]).toBeDefined();
  });

  it('ランタンと、小袋・十字架・時計の絵がある', () => {
    expect(ENEMY_ART.lantern.frames).toHaveLength(2);
    for (const k of ['pouch', 'cross', 'clock']) expect(ITEM_ART[k]).toBeDefined();
  });

  it('7 匹ぶんの絵がある', () => {
    expect(Object.keys(ANIMAL_ART).sort()).toEqual(['bear', 'cat', 'dog', 'fox', 'panda', 'rabbit', 'wolf']);
  });
});
