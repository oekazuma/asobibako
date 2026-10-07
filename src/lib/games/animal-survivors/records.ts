import { ACHIEVEMENTS, grant, type AchievementDef } from './achievements';
import { ARCANA, openArcana, type ArcanaId } from './arcana';
import { addBook, emptyBook, parseBook, type Book } from './book';
import { betOf, maxHeat, snap, type Heat } from './cauldron';
import { ANIMALS, type AnimalId } from './animals';
import { makeDaily, MODS, todayKey, type Daily, type ModId } from './daily';
import { gearRecords } from './gacha';
import type { GearKey, Slot } from './gear';
import { WEAPONS } from './weapons';
import { RELIC_IDS, type RelicId } from './relics';
import { STAGES } from './stages';
import { ENEMIES, type BossId } from './enemies';
import { UPGRADES, type Ranks } from './upgrades';
import type { RunSummary } from './world';

export interface Records {
  /** いちばん長い生存時間（秒） */
  best: number;
  /** 撃破数の合計 */
  kills: number;
  bosses: BossId[];
  clears: number;
  unlocked: AnimalId[];
  /** もちもののコイン */
  coins: number;
  /** 店の品ごとの段 */
  ranks: Ranks;
  /** 達成した実績の id */
  achieved: string[];
  /** クリアした動物 */
  clearedBy: AnimalId[];
  /** 開けた宝箱の合計 */
  chests: number;
  /** 作った進化形 */
  evolved: string[];
  relics: RelicId[];
  /** 出した初めての説明（端末ごと） */
  tips: TipId[];
  /** クリアした面 */
  stages: string[];
  /** 前に遊んだ面 */
  stage: string;
  /** 最後に遊んだ動物（キャラ選択で選んだ状態にする） */
  animal: AnimalId;
  /** 面の主を 2 体とも倒した面 */
  finales: string[];
  /** 図鑑 */
  book: Book;
  /** 面ごとの、延長戦をいちばん長く生き延びた秒 */
  overtime: Record<string, number>;
  /** 今日のお題。その日に初めてキャラ選択を開いたときに作る（同じ日に仲間が増えても変えない） */
  daily: Daily | null;
  /** お題をクリアした日の数 */
  dailyDays: number;
  /** ステージごとにクリアしたいちばん高い釜の強さ */
  heat: Record<string, number>;
  /** 最後に選んだ釜の強さ */
  heatLast: number;
  /** 溶岩の池で倒した数の合計 */
  lavaKills: number;
  /** 装備の持ち物（品とレア度の組ごとの数）・つけている品・ガチャ券（銅・銀・金）・伝説が出ていない回数 */
  bag: Partial<Record<GearKey, number>>;
  worn: Record<Slot, GearKey | null>;
  tickets: [number, number, number];
  pity: number;
  /** 鍵を付けた品。売るとまとめて売るから守る */
  locks: GearKey[];
  /** 動物ごとの、いちばん長く生き延びた秒と、クリアしたいちばん高い釜の強さ（クリアしていなければ無い） */
  byAnimal: Partial<Record<AnimalId, AnimalBest>>;
  /** 2 人で遊んだ記録（端末ごと） */
  coop: CoopRecords;
}

export interface AnimalBest {
  time: number;
  heat?: number;
}

export const RECORDS_KEY = 'asobibako:animal-survivors';
const STARTERS: AnimalId[] = ['dog', 'cat', 'wolf'];
/** ボスを足したら記録にも残るよう、敵の表から作る */
const BOSSES: BossId[] = Object.values(ENEMIES).flatMap((d) => (d.boss ? [d.boss] : []));

export function emptyRecords(): Records {
  return {
    best: 0,
    kills: 0,
    bosses: [],
    clears: 0,
    unlocked: [...STARTERS],
    coins: 0,
    ranks: {},
    achieved: [],
    clearedBy: [],
    chests: 0,
    evolved: [],
    relics: [],
    tips: [],
    stages: [],
    stage: 'forest',
    animal: 'dog',
    finales: [],
    book: emptyBook(),
    overtime: {},
    daily: null,
    dailyDays: 0,
    heat: {},
    heatLast: 2,
    lavaKills: 0,
    bag: {},
    worn: { head: null, body: null, charm: null },
    tickets: [0, 0, 0],
    pity: 0,
    locks: [],
    byAnimal: {},
    coop: emptyCoop()
  };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
const list = <T extends string>(v: unknown, known: readonly T[]): T[] =>
  Array.isArray(v) ? known.filter((k) => v.includes(k)) : [];

export interface CoopRecords {
  runs: number;
  clears: number;
  /** 2 人で遊んだ回のいちばん長い生存の秒 */
  best: number;
  raises: number;
  links: number;
  carries: number;
  /** 組んだ 2 匹（pairKey） */
  pairs: string[];
}

const emptyCoop = (): CoopRecords => ({ runs: 0, clears: 0, best: 0, raises: 0, links: 0, carries: 0, pairs: [] });

/** 組み合わせの名前。どちらが親でも同じ組になるよう、id の並びを決める */
export const pairKey = (a: AnimalId, b: AnimalId) => (a <= b ? `${a}+${b}` : `${b}+${a}`);

function coopOf(v: unknown, ids: AnimalId[]): CoopRecords {
  if (!v || typeof v !== 'object') return emptyCoop();
  const c = v as Record<string, unknown>;
  const known = (p: unknown) => {
    if (typeof p !== 'string') return false;
    const [a, b] = p.split('+');
    return ids.includes(a as AnimalId) && ids.includes(b as AnimalId) && p === pairKey(a as AnimalId, b as AnimalId);
  };
  return {
    runs: Math.floor(num(c.runs)),
    clears: Math.floor(num(c.clears)),
    best: num(c.best),
    raises: Math.floor(num(c.raises)),
    links: Math.floor(num(c.links)),
    carries: Math.floor(num(c.carries)),
    pairs: Array.isArray(c.pairs) ? [...new Set(c.pairs.filter(known) as string[])] : []
  };
}

/** 壊れた保存や型の違う値は既定値にする。犬・猫・狼はいつも選べる */
const STAGE_IDS = STAGES.map((s) => s.id);

/** 面を覚える前の保存は、クリアの回数があれば森をクリアしている */
function stagesOf(raw: Record<string, unknown>): string[] {
  const got = list(raw.stages, STAGE_IDS);
  return num(raw.clears) >= 1 && !got.includes('forest') ? ['forest', ...got] : got;
}

export function parseRecords(text: string | null): Records {
  let raw: Record<string, unknown> = {};
  try {
    const v: unknown = text ? JSON.parse(text) : null;
    if (v && typeof v === 'object' && !Array.isArray(v)) raw = v as Record<string, unknown>;
  } catch {
    // 壊れた保存は空の記録として読む
  }
  const ids = ANIMALS.map((a) => a.id);
  const achieved = list(
    raw.achieved,
    ACHIEVEMENTS.map((a) => a.id)
  );
  // 実績のごほうびの動物はあとから付け替えることがあり、達成済みの実績は二度と動物を渡さないので、読むたびに足す
  const owed = ACHIEVEMENTS.flatMap((a) => (a.animal && achieved.includes(a.id) ? [a.animal] : []));
  const unlocked = [...list(raw.unlocked, ids), ...owed];
  const unlockedIds = ids.filter((id) => STARTERS.includes(id) || unlocked.includes(id));
  return {
    best: num(raw.best),
    kills: num(raw.kills),
    bosses: list(raw.bosses, BOSSES),
    clears: num(raw.clears),
    unlocked: unlockedIds,
    coins: Math.floor(num(raw.coins)),
    ranks: ranksOf(raw.ranks),
    achieved,
    clearedBy: list(raw.clearedBy, ids),
    chests: Math.floor(num(raw.chests)),
    evolved: list(
      raw.evolved,
      Object.keys(WEAPONS).filter((id) => WEAPONS[id].evolved)
    ),
    relics: list(raw.relics, RELIC_IDS),
    tips: list(raw.tips, TIP_IDS),
    stages: stagesOf(raw),
    stage: typeof raw.stage === 'string' && STAGE_IDS.includes(raw.stage) ? raw.stage : 'forest',
    animal: ids.includes(raw.animal as AnimalId) ? (raw.animal as AnimalId) : 'dog',
    finales: list(raw.finales, STAGE_IDS),
    book: parseBook(raw.book, list(raw.bosses, BOSSES), unlockedIds, STARTERS),
    overtime: overtimeOf(raw.overtime),
    daily: dailyOf(raw.daily, ids),
    dailyDays: Math.floor(num(raw.dailyDays)),
    heat: heatOf(raw.heat),
    heatLast: isNum(raw.heatLast) ? snap(raw.heatLast) : 2,
    lavaKills: Math.floor(num(raw.lavaKills)),
    byAnimal: byAnimalOf(raw.byAnimal, ids),
    coop: coopOf(raw.coop, ids),
    ...gearRecords(raw)
  };
}

function dailyOf(v: unknown, ids: AnimalId[]): Daily | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as Record<string, unknown>;
  const mods = Array.isArray(d.mods) ? d.mods : [];
  const ok =
    typeof d.date === 'string' &&
    ids.includes(d.animal as AnimalId) &&
    STAGE_IDS.includes(d.stage as string) &&
    mods.length === 2 &&
    mods[0] !== mods[1] &&
    mods.every((m) => typeof m === 'string' && m in MODS);
  return ok
    ? {
        date: d.date as string,
        animal: d.animal as AnimalId,
        stage: d.stage as string,
        mods: mods as ModId[],
        cleared: d.cleared === true,
        ...(isNum(d.heat) && { heat: snap(d.heat) }),
        ...(ARCANA.some((a) => a.id === d.card) && { card: d.card as ArcanaId })
      }
    : null;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function byAnimalOf(v: unknown, ids: AnimalId[]): Records['byAnimal'] {
  const out: Records['byAnimal'] = {};
  if (!v || typeof v !== 'object') return out;
  for (const id of ids) {
    const b = (v as Record<string, unknown>)[id];
    if (!b || typeof b !== 'object' || !isNum((b as AnimalBest).time)) continue;
    const { time, heat } = b as AnimalBest;
    out[id] = { time: Math.max(0, time), ...(isNum(heat) && { heat: snap(heat) }) };
  }
  return out;
}

function heatOf(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object') return out;
  for (const id of STAGE_IDS) {
    const h = (v as Record<string, unknown>)[id];
    if (isNum(h)) out[id] = snap(h);
  }
  return out;
}

function overtimeOf(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!v || typeof v !== 'object') return out;
  for (const id of STAGE_IDS) {
    const n = Math.floor(num((v as Record<string, unknown>)[id]));
    if (n > 0) out[id] = n;
  }
  return out;
}

/** 知らない品と数でない段は読み飛ばし、段は 0〜最大の整数にする */
function ranksOf(v: unknown): Ranks {
  const out: Ranks = {};
  if (!v || typeof v !== 'object') return out;
  for (const d of UPGRADES) {
    const n = Math.min(d.max, Math.floor(num((v as Record<string, unknown>)[d.id])));
    if (n > 0) out[d.id] = n;
  }
  return out;
}

/** 1 回の結果で記録を足し、その回に達成した実績を返す。解放は取り消さない */
export function record(r: Records, run: RunSummary): AchievementDef[] {
  r.best = Math.max(r.best, run.time);
  const mine = r.byAnimal[run.animal];
  r.byAnimal[run.animal] = {
    time: Math.max(mine?.time ?? 0, run.time),
    ...((run.cleared || mine?.heat !== undefined) && {
      heat: Math.max(mine?.heat ?? 0, run.cleared ? run.heat.level : 0)
    })
  };
  r.kills += run.kills - (run.killsBefore ?? 0);
  for (const b of run.bosses) if (!r.bosses.includes(b)) r.bosses.push(b);
  if (run.cleared) {
    r.clears += 1;
    r.coins += run.heat.bet;
    r.heat[run.stage] = Math.max(r.heat[run.stage] ?? 0, run.heat.level);
    if (!r.clearedBy.includes(run.animal)) r.clearedBy.push(run.animal);
  }
  r.chests += run.opened;
  r.lavaKills += run.lavaKills ?? 0;
  r.tickets = r.tickets.map((n, i) => n + (run.tickets?.[i] ?? 0)) as Records['tickets'];
  r.coins += run.coins;
  if (run.cleared && !r.stages.includes(run.stage)) r.stages.push(run.stage);
  r.stage = run.stage;
  r.animal = run.animal;
  if (run.finale && !r.finales.includes(run.stage)) r.finales.push(run.stage);
  for (const id of run.evolved) if (!r.evolved.includes(id)) r.evolved.push(id);
  for (const id of run.relics ?? []) if (!r.relics.includes(id)) r.relics.push(id);
  if (run.overtime) r.overtime[run.stage] = Math.max(r.overtime[run.stage] ?? 0, run.overtime.secs);
  const d = r.daily;
  if (run.cleared && run.daily && d && d.date === run.daily.date && !d.cleared) {
    d.cleared = true;
    r.dailyDays += 1;
    r.coins += run.daily.bonus;
    run.daily.paid = true;
  }
  const c = run.coop;
  if (c) {
    const o = r.coop;
    // 延長戦の 2 回めの記録（killsBefore がある）は、回とクリアを 10:00 の記録で数えてある
    if (run.killsBefore === undefined) {
      o.runs += 1;
      if (run.cleared && c.together) o.clears += 1;
    }
    o.best = Math.max(o.best, run.time);
    o.raises += c.heroes.reduce((n, h) => n + h.raises, 0);
    o.links += c.links;
    o.carries += c.carries;
    const key = pairKey(c.heroes[0].animal, c.heroes[1].animal);
    if (!o.pairs.includes(key)) o.pairs.push(key);
  }
  run.bookCoins = addBook(r, run);
  r.coins += run.bookCoins;
  return grant(r, run);
}

/** はじめるときに賭けを引く。足りなければ払える強さまで下げる（最後に選んだ強さには、下げる前の強さを覚える） */
export function payHeat(r: Records, h: number): Heat {
  const level = snap(h) <= 2 ? snap(h) : Math.min(snap(h), maxHeat(r.coins));
  const bet = betOf(level);
  r.coins -= bet;
  r.heatLast = snap(h);
  return { level, bet };
}

/** 保存が使えない端末（プライベートブラウズなど）では空の記録を返す */
export function loadRecords(): Records {
  try {
    return parseRecords(localStorage.getItem(RECORDS_KEY));
  } catch {
    return emptyRecords();
  }
}

export function saveRecords(r: Records): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
  } catch {
    // 保存できなくても遊び続けられるようにする
  }
}

export type TipId = 'union' | 'relic' | 'shrine' | 'limit';
const TIP_IDS: TipId[] = ['union', 'relic', 'shrine', 'limit'];

/** 初めての説明をまだ出していなければ、出したことを記録に書いて true（端末ごと） */
export function firstTip(id: TipId): boolean {
  const r = loadRecords();
  if (r.tips.includes(id)) return false;
  r.tips.push(id);
  saveRecords(r);
  return true;
}

/** 拾った遺物をすぐ記録へ書く（倒れた回・アプリが閉じた回でも残るように、回の終わりを待たない） */
export function keepRelic(id: RelicId): void {
  const r = loadRecords();
  if (r.relics.includes(id)) return;
  r.relics.push(id);
  saveRecords(r);
}

/** 面の after（先にクリアする面）をクリアしていれば選べる。知らない面は選べない */
export function canPlay(r: Records, stage: string): boolean {
  const s = STAGES.find((o) => o.id === stage);
  return !!s && (!s.after || r.stages.includes(s.after));
}

/** 今日のお題。日付が変わっていたら、仲間と選べる面から作り直す */
export function ensureDaily(r: Records, now: Date): Daily {
  const date = todayKey(now);
  if (r.daily?.date !== date)
    r.daily = makeDaily(
      date,
      r.unlocked,
      STAGES.filter((s) => canPlay(r, s.id)).map((s) => s.id),
      openArcana(r.achieved)
    );
  return r.daily;
}
