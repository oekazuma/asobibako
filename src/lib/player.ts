/** 1 = 手前（画面下）、2 = 向かい（画面上、180 度回転して表示する） */
export type Player = 1 | 2;

/** 盤面の高さに対する 0..1 の y が、どちらのプレイヤーの陣地か */
export const sideOf = (y: number): Player => (y >= 0.5 ? 1 : 2);
