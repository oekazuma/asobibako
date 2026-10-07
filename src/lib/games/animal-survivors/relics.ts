import { pushOut, type Ground } from './obstacles';

export type RelicId = 'map' | 'lamp' | 'watch' | 'bell' | 'flake' | 'mirror' | 'orb' | 'shard';

export interface RelicDef {
  id: RelicId;
  name: string;
  blurb: string;
  stage: string;
  /** 始めの位置から見た向き（ラジアン）と距離（ドット） */
  angle: number;
  dist: number;
}

const r = (id: RelicId, name: string, blurb: string, stage: string, angle: number, dist: number): RelicDef => ({
  id,
  name,
  blurb,
  stage,
  angle,
  dist
});

export const RELICS: RelicDef[] = [
  r('map', '古い地図', '遠くにある、まだ拾っていない遺物にも矢印が出る', 'forest', -0.6, 700),
  r('lamp', '魔法のランプ', '自分のまわりに灯るランタンが 1 つ増える', 'forest', 2.4, 1500),
  r('watch', '古い懐中時計', '時計の品で敵が止まる時間が 2 秒のびる', 'graveyard', 1.1, 700),
  r('bell', '銀の鈴', '宝の地図の宝箱が 10 秒長く残る', 'graveyard', -2.3, 1500),
  r('flake', '雪の結晶', '1 回ごとに、3 択の引き直しが 1 回ふえる', 'snow', 0.4, 700),
  r('mirror', '氷の鏡', '祠のご利益が 1.5 倍長く続く', 'snow', -1.8, 1500),
  r('orb', '炎の宝玉', '宝箱の中身が 3 つ以上になる割合が 1 割上がる', 'volcano', 2.0, 700),
  r('shard', '黒曜石のかけら', '溶岩の池から受けるダメージが半分になる', 'volcano', -0.9, 1500)
];

export const RELIC_IDS = RELICS.map((d) => d.id);

/** 置き場所。障害物に重なるときは外へずらす（障害物も位置で決まるので、毎回同じ場所になる） */
export function relicSpot(def: RelicDef, g: Ground): { x: number; y: number } {
  const at = { x: Math.cos(def.angle) * def.dist, y: Math.sin(def.angle) * def.dist };
  pushOut(g, at, 8);
  return at;
}
