export type Move = 'chase' | 'wave' | 'snake' | 'charge' | 'leap' | 'boss' | 'still' | 'flee';
export type BossId = 'bear' | 'spiderQueen' | 'pumpkin' | 'knight';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  /** px/秒 */
  speed: number;
  atk: number;
  /** 当たり判定の半径（px） */
  r: number;
  xp: number;
  move: Move;
  /** ノックバックを減らす割合（0..1） */
  heavy: number;
  /** ボスなら、動き方を決める bosses.ts の id */
  boss?: BossId;
  /** 強化個体（金色で大きく、HP と経験値が多い） */
  elite?: boolean;
  /** 壊せる物（ランタン）。狙われず、数えられず、品を落とす */
  prop?: boolean;
  /** ボスの動き方（bosses.ts）。巨大ベア型は突進と地ならし、女王グモ型は飛び道具と手下 */
  ai?: 'bear' | 'queen';
  /** 女王グモ型が呼ぶ手下の id */
  minion?: string;
  /** 女王グモ型の飛び道具の絵（ITEM_ART の名前） */
  shot?: string;
  /** 2 回めのボスと面の主。攻撃の間をこの値で割る */
  rage?: number;
  /** ヌシ（3 倍の大きさで王冠を載せたふつうの敵）。十字架で消えず、押されない */
  chief?: boolean;
  /** きらきらハリネズミ。どんな攻撃でも 1 しか減らず、逃げて、しばらくで去る */
  metal?: boolean;
}

const e = (
  id: string,
  name: string,
  [hp, speed, atk, r, xp]: number[],
  move: Move,
  heavy: number,
  boss?: BossId
): EnemyDef => ({ id, name, hp, speed, atk, r, xp, move, heavy, ...(boss && { boss }) });

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(
  (
    [
      e('rat', 'ネズミ', [6, 40, 5, 5, 1], 'chase', 0),
      e('bat', 'コウモリ', [4, 58, 4, 5, 1], 'wave', 0),
      e('snake', 'ヘビ', [14, 34, 8, 6, 2], 'snake', 0.2),
      e('caterpillar', 'イモムシ', [40, 20, 10, 7, 5], 'chase', 0.6),
      e('boar', 'イノシシ', [70, 26, 18, 8, 8], 'charge', 0.8),
      e('spider', 'クモ', [18, 36, 9, 6, 3], 'leap', 0.2),
      e('croc', 'ワニ', [120, 16, 16, 9, 10], 'chase', 0.9),
      e('spiderling', '子グモ', [8, 50, 6, 4, 1], 'chase', 0),
      // ボスの HP には toughness を掛けない（出る時刻が決まっているので表の値がそのまま強さになる）
      { ...e('bear', '巨大ベア', [700, 28, 20, 15, 0], 'boss', 1, 'bear'), ai: 'bear' },
      {
        ...e('spiderQueen', '女王グモ', [900, 38, 25, 16, 0], 'boss', 1, 'spiderQueen'),
        ai: 'queen',
        minion: 'spiderling',
        shot: 'web'
      },
      e('ghost', 'おばけ', [8, 52, 6, 6, 1], 'wave', 0),
      e('skeleton', 'ガイコツ', [26, 36, 11, 7, 3], 'chase', 0.3),
      e('zombie', 'ゾンビ', [80, 18, 16, 8, 8], 'chase', 0.7),
      e('pumpkinling', 'ちびかぼちゃ', [10, 46, 7, 5, 1], 'chase', 0),
      {
        ...e('pumpkin', 'かぼちゃ大王', [800, 36, 26, 16, 0], 'boss', 1, 'pumpkin'),
        ai: 'queen',
        minion: 'pumpkinling',
        shot: 'seed'
      },
      { ...e('knight', 'ガイコツの騎士', [1300, 30, 26, 15, 0], 'boss', 1, 'knight'), ai: 'bear' },
      { ...e('lantern', 'ランタン', [1, 0, 0, 6, 0], 'still', 1), prop: true },
      { ...e('metal', 'きらきらハリネズミ', [12, 50, 0, 6, 0], 'flee', 0.5), metal: true }
    ] satisfies EnemyDef[]
  ).map((d) => [d.id, d])
);

/** いちばん大きな敵の当たり判定の半径（ヌシは 3 倍）。格子で近くを探すときに足す */
export const MAX_R = Math.max(...Object.values(ENEMIES).map((d) => d.r)) * 3;
