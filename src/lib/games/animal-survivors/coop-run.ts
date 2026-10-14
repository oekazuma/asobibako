import type { AchievementDef } from './achievements';
import { ANIMALS } from './animals';
import { overtimeRun } from './overtime';
import { record, type Records } from './records';
import { STAGES } from './stages';
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

const ANIMAL_IDS: readonly unknown[] = ANIMALS.map((a) => a.id);
const STAGE_IDS: readonly unknown[] = STAGES.map((s) => s.id);
/** 記録に足す数。欠けた値・文字・負の数を足すと、保存し直したときに parseRecords が 0 に戻す */
const n = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strs = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
const opt = (v: unknown, ok: (x: unknown) => boolean) => v === undefined || ok(v);

function coopOk(c: unknown): boolean {
  return (
    obj(c) &&
    [c.links, c.carries, c.bonus].every(n) &&
    Array.isArray(c.heroes) &&
    c.heroes.length === 2 &&
    c.heroes.every((h) => obj(h) && ANIMAL_IDS.includes(h.animal) && n(h.raises))
  );
}

/** record()・図鑑・実績が足し算と鍵と数え上げに使う値だけを見る。見せるだけの値は見ない */
function summaryOk(s: unknown): boolean {
  if (!obj(s) || !obj(s.heat) || !obj(s.book)) return false;
  const { heat, book } = s;
  return (
    ANIMAL_IDS.includes(s.animal) &&
    STAGE_IDS.includes(s.stage) &&
    typeof s.cleared === 'boolean' &&
    [s.time, s.level, s.kills, s.coins, s.opened, heat.level, heat.bet].every(n) &&
    [s.killsBefore, s.lavaKills, s.tideKills, s.shrines].every((v) => opt(v, n)) &&
    strs(s.bosses) &&
    strs(s.evolved) &&
    opt(s.relics, strs) &&
    opt(s.tickets, (t) => Array.isArray(t) && t.every(n)) &&
    Array.isArray(s.weapons) &&
    s.weapons.every((o) => obj(o) && typeof o.id === 'string' && n(o.level) && opt(o.lb, n)) &&
    opt(s.overtime, (o) => obj(o) && n(o.secs)) &&
    opt(s.daily, (d) => obj(d) && typeof d.date === 'string' && n(d.bonus)) &&
    obj(book.kills) &&
    Object.values(book.kills).every(n) &&
    [book.elites, book.chiefs, book.forms, book.items].every(strs) &&
    Array.isArray(book.bosses) &&
    book.bosses.every((b) => obj(b) && typeof b.id === 'string' && n(b.secs)) &&
    opt(s.coop, coopOk)
  );
}

/** 相手の端末から届いたまとめ。形が違えば null（記録に入れると、コインや最長の秒が 0 に戻る） */
export function runOf(v: unknown): HeroRun | null {
  return obj(v) && summaryOk(v.part) && summaryOk(v.full) ? (v as unknown as HeroRun) : null;
}
