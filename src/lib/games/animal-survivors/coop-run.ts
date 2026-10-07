import type { AchievementDef } from './achievements';
import { overtimeRun } from './overtime';
import { record, type Records } from './records';
import { summary, type RunSummary, type World } from './world';

/** 動物ごとの記録に入れるまとめ（part）と、延長戦のとき画面に見せる回の合計（full） */
export interface HeroRun {
  part: RunSummary;
  full: RunSummary;
}

/**
 * i 番めの動物のまとめ。コイン・券・倒した数・図鑑は 2 人で共通の World の値で、武器と能力はその動物のもの。
 * 賭けは親だけが払うので、子のまとめでは戻さない
 */
export function heroRun(w: World, i: number): HeroRun {
  const was = w.cur;
  w.cur = i;
  try {
    const full = summary(w);
    const part = w.overtime ? overtimeRun(w) : full;
    const noBet = (r: RunSummary) => (i === 0 ? r : { ...r, heat: { ...r.heat, bet: 0 } });
    return { part: noBet(part), full: noBet(full) };
  } finally {
    w.cur = was;
  }
}

/**
 * 記録に入れて、画面に見せるまとめと達成した実績を返す。延長戦の 2 回めは first（10:00 の回）に足して見せる。
 * 1 人で遊ぶときの Survivors の over と同じ並び
 */
export function recordRun(
  r: Records,
  { part, full }: HeroRun,
  first: RunSummary | null,
  got: AchievementDef[] = []
): { run: RunSummary; got: AchievementDef[] } {
  const now = record(r, part);
  const run: RunSummary = {
    ...(first ? full : part),
    bookCoins: (first?.bookCoins ?? 0) + (part.bookCoins ?? 0),
    tickets: (first?.tickets ?? [0, 0, 0]).map((n, i) => n + (part.tickets?.[i] ?? 0)),
    lost: part.lost
  };
  // 延長戦の 2 回めに見せる回の合計（full）は延長戦の中で作ったので、10:00 で入れたボーナスを足して見せる
  const bonus = first?.coop?.bonus;
  if (bonus && run.coop) {
    run.coins += bonus;
    run.coop = { ...run.coop, bonus };
  }
  if (run.overtime) run.overtime.best = r.overtime[run.stage];
  return { run, got: first ? [...got, ...now] : now };
}
