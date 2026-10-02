export type WeaponKind = 'shot' | 'swipe' | 'ring' | 'boomerang' | 'orbit' | 'strike' | 'homing';

export interface WeaponStats {
  damage: number;
  cooldown: number;
  amount: number;
  /** 倍率。基本の大きさは arms.ts が武器の種類ごとに持つ */
  area: number;
  /** shot・boomerang・homing は px/秒、orbit は回る速さ（ラジアン/秒） */
  speed: number;
  pierce: number;
  duration: number;
  knockback: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  blurb: string;
  kind: WeaponKind;
  base: WeaponStats;
  /** Lv2 から Lv5 へ上げるときに足すもの */
  ups: Partial<WeaponStats>[];
}

export const MAX_LEVEL = 5;

const w = (
  id: string,
  name: string,
  blurb: string,
  kind: WeaponKind,
  [damage, cooldown, amount, area, speed, pierce, duration, knockback]: number[],
  ups: Partial<WeaponStats>[]
): WeaponDef => ({
  id,
  name,
  blurb,
  kind,
  base: { damage, cooldown, amount, area, speed, pierce, duration, knockback },
  ups
});

export const WEAPONS: Record<string, WeaponDef> = Object.fromEntries(
  [
    w(
      'woof',
      'ワンワンショット',
      'いちばん近い敵へ骨を投げる',
      'shot',
      [10, 0.9, 1, 1, 170, 1, 1.2, 40],
      [{ damage: 2 }, { amount: 1 }, { cooldown: -0.15 }, { amount: 1, pierce: 1 }]
    ),
    w(
      'paw',
      'ネコパンチ',
      '向いている側をすばやく引っかく',
      'swipe',
      [9, 0.6, 1, 1, 0, 99, 0.15, 60],
      [{ damage: 3 }, { area: 0.25 }, { amount: 1 }, { damage: 3, cooldown: -0.1 }]
    ),
    w(
      'howl',
      '遠吠え',
      '周りに衝撃の輪を広げ、敵を吹き飛ばす',
      'ring',
      [12, 2.2, 1, 1, 0, 99, 0.45, 140],
      [{ damage: 4 }, { area: 0.3 }, { cooldown: -0.4 }, { damage: 6, area: 0.2 }]
    ),
    w(
      'boomerang',
      '骨ブーメラン',
      '向いている側へ飛んで戻る。敵を貫く',
      'boomerang',
      [12, 1.6, 1, 1, 150, 99, 1.4, 50],
      [{ damage: 2.4 }, { amount: 1 }, { area: 0.25 }, { damage: 3, amount: 1 }]
    ),
    w(
      'feather',
      '羽根の嵐',
      '体の周りを羽根が回る',
      'orbit',
      [7, 3.5, 2, 1, 3.2, 99, 3, 30],
      [{ amount: 1 }, { damage: 3 }, { duration: 1, area: 0.2 }, { amount: 1, speed: 0.8 }]
    ),
    w(
      'thunder',
      '雷撃',
      '画面の中の敵へ雷を落とす',
      'strike',
      [22, 2, 1, 1, 0, 99, 0.2, 0],
      [{ amount: 1 }, { damage: 8 }, { amount: 1, area: 0.3 }, { cooldown: -0.4, damage: 8 }]
    ),
    w(
      'fish',
      '魚ミサイル',
      '近い敵を追いかけ、当たると弾ける',
      'homing',
      [14, 1.4, 1, 1, 120, 1, 2.5, 30],
      [{ damage: 4 }, { amount: 1 }, { area: 0.4 }, { amount: 1, cooldown: -0.2 }]
    )
  ].map((d) => [d.id, d])
);

const LABEL: Record<keyof WeaponStats, string> = {
  damage: 'ダメージ',
  cooldown: '待ち時間',
  amount: '発射数',
  area: '大きさ',
  speed: '速さ',
  pierce: '貫通',
  duration: '時間',
  knockback: 'ふきとばし'
};

export function weaponStats(def: WeaponDef, level: number): WeaponStats {
  const s = { ...def.base };
  for (const up of def.ups.slice(0, level - 1))
    for (const [k, v] of Object.entries(up) as [keyof WeaponStats, number][]) s[k] += v;
  return s;
}

/** level へ上げたときに増えるもの。amount・pierce は数、ほかは Lv1 に対する割合で書く */
export function upText(def: WeaponDef, level: number): string {
  const up = def.ups[level - 2];
  return (Object.entries(up) as [keyof WeaponStats, number][])
    .map(([k, v]) => {
      if (k === 'amount' || k === 'pierce') return `${LABEL[k]} +${v}`;
      if (k === 'cooldown') return `${LABEL[k]} -${Math.round((-v / def.base.cooldown) * 100)}%`;
      if (k === 'area') return `${LABEL[k]} +${Math.round(v * 100)}%`;
      return `${LABEL[k]} +${Math.round((v / def.base[k]) * 100)}%`;
    })
    .join('・');
}
