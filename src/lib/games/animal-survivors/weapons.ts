export type WeaponKind =
  'shot' | 'swipe' | 'ring' | 'boomerang' | 'orbit' | 'strike' | 'homing' | 'nova' | 'trail' | 'snare' | 'cone';

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
  /** shot の弾の半径（px）。無ければ 4 */
  size?: number;
  /** 進化形。3 択と宝箱の候補に出ず、それ以上は上がらない */
  evolved?: boolean;
  /** 動物の専用進化形。3 段階めに育ち最初の武器が Lv5 になると、その武器（ふつうの進化形も）と入れ替わる */
  special?: boolean;
  /** 専用進化形の元の武器 */
  from?: string;
  /** その動物だけの武器。ほかの動物の 3 択に出ず、ふつうの進化も無い */
  exclusive?: boolean;
  /** 当たるたびに戻す HP。1 秒に戻せる量には上限がある（world.ts の DRAIN） */
  drain?: number;
  /** ブーメランが折り返すところに炎を置く（火の羽根） */
  flameTurn?: boolean;
}

export const MAX_LEVEL = 5;
const EXCLUSIVE = ['tigerClaw', 'breath', 'fireFeather'];

const w = (
  id: string,
  name: string,
  blurb: string,
  kind: WeaponKind,
  [damage, cooldown, amount, area, speed, pierce, duration, knockback]: number[],
  ups: Partial<WeaponStats>[],
  size?: number
): WeaponDef => ({
  id,
  name,
  blurb,
  kind,
  base: { damage, cooldown, amount, area, speed, pierce, duration, knockback },
  ups,
  ...(size && { size })
});

const evo = (
  id: string,
  name: string,
  blurb: string,
  kind: WeaponKind,
  stats: number[],
  extra: { drain?: number; size?: number } = {}
): WeaponDef => ({
  ...w(id, name, blurb, kind, stats, [], extra.size),
  evolved: true,
  ...(extra.drain && { drain: extra.drain })
});

/** 段が上の動物ほど強い専用進化形。ダメージはふつうの進化形のおよそ 1.2・1.35・1.5 倍（トラと竜の子は Lv5 の最初の武器の 1.6〜1.7 倍） */
const sp = (
  id: string,
  from: string,
  name: string,
  blurb: string,
  kind: WeaponKind,
  stats: number[],
  extra: { drain?: number; size?: number } = {}
): WeaponDef => ({ ...evo(id, name, blurb, kind, stats, extra), special: true, from });

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
      '近くの敵をすばやく引っかく',
      'swipe',
      [10, 0.5, 1, 1.3, 0, 99, 0.15, 60],
      [{ damage: 3 }, { area: 0.25 }, { amount: 1 }, { damage: 3, cooldown: -0.1 }]
    ),
    w(
      'howl',
      '遠吠え',
      '周りに衝撃の輪を広げ、敵を吹き飛ばす',
      'ring',
      [10, 3, 1, 1, 0, 99, 0.45, 60],
      [{ damage: 4 }, { area: 0.3 }, { cooldown: -0.4 }, { damage: 6, area: 0.2 }]
    ),
    w(
      'boomerang',
      '骨ブーメラン',
      '近い敵へ飛んで戻る。敵を貫く',
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
    ),
    w(
      'claw',
      '爪',
      '近い敵の側を、細長く速い 3 本の爪で裂く',
      'swipe',
      [8, 0.45, 1, 1.1, 0, 99, 0.12, 30],
      [{ damage: 2 }, { amount: 1 }, { area: 0.2 }, { damage: 3, cooldown: -0.1 }]
    ),
    w(
      'dash',
      'ダッシュアタック',
      '分身が近い敵の方へ駆け抜け、通り道の敵を吹き飛ばす',
      'shot',
      [20, 2.4, 1, 1, 260, 99, 0.5, 150],
      [{ damage: 6 }, { cooldown: -0.4 }, { amount: 1 }, { damage: 8, area: 0.3 }],
      8
    ),
    w(
      'acorn',
      'どんぐりショット',
      'どんぐりを全方向へ一度に撃ち出す',
      'nova',
      [8, 1.6, 6, 1, 130, 1, 1.4, 30],
      [{ amount: 2 }, { damage: 3 }, { amount: 2, pierce: 1 }, { cooldown: -0.4, damage: 3 }]
    ),
    w(
      'flame',
      '野生の炎',
      '歩いた跡に炎が残り、上の敵を焼き続ける',
      'trail',
      [5, 0.3, 1, 1, 0, 99, 2, 0],
      [{ damage: 2 }, { duration: 1 }, { area: 0.3 }, { damage: 3, duration: 1 }]
    ),
    w(
      'vine',
      'ツタ',
      '敵の足もとからツタが生え、足止めして削る',
      'snare',
      [6, 3, 2, 1, 0, 99, 2.5, 0],
      [{ amount: 1 }, { damage: 3 }, { duration: 1, area: 0.3 }, { amount: 2 }]
    ),
    w(
      'tigerClaw',
      'トラの爪',
      '前と後ろを大きく 2 回裂く重い爪',
      'swipe',
      [20, 0.8, 2, 1.6, 0, 99, 0.18, 60],
      [{ damage: 4 }, { area: 0.2 }, { cooldown: -0.15 }, { damage: 6 }]
    ),
    w(
      'breath',
      '竜の息',
      'いちばん近い敵の向きへ扇形の炎を吐き、中の敵をまとめて焼く',
      'cone',
      [18, 1.4, 1, 1, 0, 99, 0.35, 20],
      [{ damage: 4 }, { area: 0.25 }, { cooldown: -0.2 }, { amount: 1, damage: 6 }]
    ),
    {
      ...w(
        'fireFeather',
        '火の羽根',
        'まわりへ羽根を投げて戻す。折り返すところに小さな炎を残す',
        'boomerang',
        [14, 1.5, 2, 1, 160, 99, 1.4, 40],
        [{ damage: 3 }, { amount: 1 }, { area: 0.25 }, { damage: 4, amount: 1 }]
      ),
      flameTurn: true
    },
    evo('woofEvo', 'ホネのあられ', '骨を 4 本ずつ投げ、敵を貫く', 'shot', [18, 0.5, 4, 1.2, 220, 3, 1.4, 50]),
    evo(
      'pawEvo',
      'ネコ百烈拳',
      '前と後ろを同時に引っかき、当たると少し回復',
      'swipe',
      [20, 0.35, 2, 1.6, 0, 99, 0.15, 70],
      {
        drain: 1
      }
    ),
    evo('howlEvo', '月夜の大遠吠え', 'とても大きな輪で、強く吹き飛ばす', 'ring', [28, 2, 1, 2.2, 0, 99, 0.6, 140]),
    evo(
      'boomerangEvo',
      'つむじブーメラン',
      '3 本が飛んで戻り、どこまでも貫く',
      'boomerang',
      [24, 1.2, 3, 1.4, 170, 99, 1.6, 60]
    ),
    evo('featherEvo', '風切り羽の舞', '羽根が増え、ずっと回り続ける', 'orbit', [16, 0.1, 6, 1.4, 4.2, 99, 5, 40]),
    evo('thunderEvo', '雷雲の嵐', '画面の敵へ雷を次々と落とす', 'strike', [40, 0.9, 5, 1.6, 0, 99, 0.25, 30]),
    evo('fishEvo', 'サカナの群れ', '5 匹の魚が追いかけて弾ける', 'homing', [26, 0.9, 5, 1.6, 150, 1, 2.5, 40]),
    evo('clawEvo', '大熊の爪', '大きく重い爪で裂き、当たると少し回復', 'swipe', [24, 0.35, 3, 1.5, 0, 99, 0.12, 60], {
      drain: 1
    }),
    evo('dashEvo', 'はやて突進', '分身が速く多く駆け抜け、敵を貫く', 'shot', [40, 1.2, 3, 1.4, 340, 99, 0.6, 200], {
      size: 10
    }),
    evo('acornEvo', 'どんぐりの大樹', 'どんぐりを全方向へ倍の数で撃ち出す', 'nova', [16, 1, 16, 1.3, 150, 3, 1.6, 40]),
    evo('flameEvo', '燃える心臓', '太く長く残る炎で焼き、当たると少し回復', 'trail', [12, 0.2, 1, 1.8, 0, 99, 4, 0], {
      drain: 0.5
    }),
    evo('vineEvo', '森の守り', '広く長く絡むツタで足止めする', 'snare', [14, 2, 6, 1.6, 0, 99, 4, 0]),
    sp('woofSp', 'woof', '勇者のホネ', '骨を 6 本ずつ、敵を貫いて投げる', 'shot', [22, 0.45, 6, 1.3, 240, 99, 1.4, 60]),
    sp(
      'pawSp',
      'paw',
      'ねこまたの百裂ひっかき',
      '全方向を連続で引っかき、当たると少し回復',
      'swipe',
      [24, 0.3, 6, 1.7, 0, 99, 0.15, 70],
      {
        drain: 1
      }
    ),
    sp('howlSp', 'howl', '月の大狼の咆哮', '画面を覆う輪で強く吹き飛ばす', 'ring', [34, 1.6, 1, 3.2, 0, 99, 0.7, 200]),
    sp('flameSp', 'flame', '九尾の狐火', '9 つの火の玉が敵を追う', 'homing', [30, 0.9, 9, 1.4, 160, 1, 2.5, 30]),
    sp(
      'clawSp',
      'claw',
      '横綱の張り手',
      '巨大な張り手で遠くまで吹き飛ばし、当たると少し回復',
      'swipe',
      [32, 0.4, 2, 2.2, 0, 99, 0.15, 260],
      {
        drain: 1
      }
    ),
    sp(
      'dashSp',
      'dash',
      '月の兎の流星',
      '分身が流れ星のように何本も駆け抜ける',
      'shot',
      [54, 0.9, 5, 1.5, 380, 99, 0.6, 220],
      {
        size: 10
      }
    ),
    sp('vineSp', 'vine', '達人の竹林', '広い竹林で足止めして削る', 'snare', [21, 1.6, 9, 2, 0, 99, 5, 0]),
    {
      ...sp(
        'fireFeatherSp',
        'fireFeather',
        '火の鳥の翼',
        '羽根を 5 枚ずつ投げ、折り返すところに大きな炎を残す',
        'boomerang',
        [40, 1.0, 5, 1.6, 200, 99, 1.6, 60]
      ),
      flameTurn: true
    },
    sp('tigerClawSp', 'tigerClaw', '雷虎の牙', '4 方向を雷の爪で裂く', 'swipe', [48, 0.6, 4, 1.8, 0, 99, 0.2, 90]),
    sp(
      'breathSp',
      'breath',
      '竜王の業火',
      '大きな扇の炎を 3 つ吐き、焼け跡が残る',
      'cone',
      [48, 0.9, 3, 1.6, 0, 99, 0.45, 40]
    )
  ].map((d) => [d.id, EXCLUSIVE.includes(d.id) ? { ...d, exclusive: true } : d])
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
