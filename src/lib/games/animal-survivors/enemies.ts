export type Move = 'chase' | 'wave' | 'snake' | 'charge';

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
}

const e = (id: string, name: string, [hp, speed, atk, r, xp]: number[], move: Move, heavy: number): EnemyDef => ({
  id,
  name,
  hp,
  speed,
  atk,
  r,
  xp,
  move,
  heavy
});

export const ENEMIES: Record<string, EnemyDef> = Object.fromEntries(
  [
    e('rat', 'ネズミ', [6, 40, 5, 5, 1], 'chase', 0),
    e('bat', 'コウモリ', [4, 58, 4, 5, 1], 'wave', 0),
    e('snake', 'ヘビ', [14, 34, 8, 6, 2], 'snake', 0.2),
    e('caterpillar', 'イモムシ', [40, 20, 10, 7, 5], 'chase', 0.6),
    e('boar', 'イノシシ', [70, 26, 18, 8, 8], 'charge', 0.8)
  ].map((d) => [d.id, d])
);
