import { GEAR, keyOf, parseKey, SLOTS, type GearKey, type Rarity } from './gear';
import type { Records } from './records';

export type Ticket = 0 | 1 | 2;
export const TICKET_NAME = ['銅の券', '銀の券', '金の券'] as const;
/** 券ごとの、ふつう・レア・伝説の割合。コインで引くのは銅の券と同じ */
export const ODDS: [number, number, number][] = [
  [0.8, 0.17, 0.03],
  [0, 0.85, 0.15],
  [0, 0.5, 0.5]
];
export const PULL_COINS = 500;
export const TEN_COINS = 4500;
export const PITY = 50;
export const BAG_MAX = 40;
export const SELL = [50, 200, 800];
export type PullWay = 'bronze' | 'silver' | 'gold' | 'coin' | 'ten';

const WAY_TICKET: Partial<Record<PullWay, Ticket>> = { bronze: 0, silver: 1, gold: 2 };

/** 釜の強さから、落ちる券が銅・銀・金になる割合。2.0 以下は銅だけ、9.0 で 3・5・2 割 */
export function ticketOdds(heat: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, (heat - 2) / 7));
  return [1 - 0.7 * t, 0.5 * t, 0.2 * t];
}

export function rollTicket(heat: number, r: number): Ticket {
  const [b, s] = ticketOdds(heat);
  return r < b ? 0 : r < b + s ? 1 : 2;
}

export const bagCount = (r: Records) => Object.values(r.bag).reduce((t, n) => t + (n ?? 0), 0);

const sizeOf = (way: PullWay) => (way === 'ten' ? 10 : 1);

export function canPull(r: Records, way: PullWay): boolean {
  if (bagCount(r) + sizeOf(way) > BAG_MAX) return false;
  const t = WAY_TICKET[way];
  if (t !== undefined) return r.tickets[t] > 0;
  return r.coins >= (way === 'ten' ? TEN_COINS : PULL_COINS);
}

function add(r: Records, k: GearKey, n: number) {
  const v = (r.bag[k] ?? 0) + n;
  if (v > 0) r.bag[k] = v;
  else {
    delete r.bag[k];
    for (const s of SLOTS) if (r.worn[s] === k) r.worn[s] = null;
  }
}

/** 1 回ぶん。レア度を決める乱数、品を選ぶ乱数の順に引く */
function once(r: Records, odds: [number, number, number], rand: () => number): GearKey {
  const x = rand();
  let rarity: Rarity = x < odds[0] ? 0 : x < odds[0] + odds[1] ? 1 : 2;
  if (r.pity >= PITY - 1) rarity = 2;
  r.pity = rarity === 2 ? 0 : r.pity + 1;
  return keyOf(GEAR[Math.floor(rand() * GEAR.length)].id, rarity);
}

/** 払えて持ち物に入りきるときだけ引いて払う。引けなければ何もせず null */
export function pull(r: Records, way: PullWay, rand: () => number): GearKey[] | null {
  if (!canPull(r, way)) return null;
  const t = WAY_TICKET[way];
  if (t !== undefined) r.tickets[t] -= 1;
  else r.coins -= way === 'ten' ? TEN_COINS : PULL_COINS;
  const odds = ODDS[t ?? 0];
  const got = Array.from({ length: sizeOf(way) }, () => once(r, odds, rand));
  if (way === 'ten' && got.every((k) => k.endsWith(':0'))) got[9] = keyOf(parseKey(got[9])!.def.id, 1);
  for (const k of got) add(r, k, 1);
  return got;
}

export function merge(r: Records, key: GearKey): GearKey | null {
  const p = parseKey(key);
  if (!p || p.rarity === 2 || (r.bag[key] ?? 0) < 3) return null;
  const up = keyOf(p.def.id, (p.rarity + 1) as Rarity);
  add(r, key, -3);
  add(r, up, 1);
  return up;
}

export function sell(r: Records, key: GearKey): number {
  const p = parseKey(key);
  if (!p || !r.bag[key]) return 0;
  add(r, key, -1);
  r.coins += SELL[p.rarity];
  return SELL[p.rarity];
}

export function equip(r: Records, key: GearKey): void {
  const p = parseKey(key);
  if (p && r.bag[key]) r.worn[p.def.slot] = key;
}

export const wornKeys = (r: Records) => SLOTS.flatMap((s) => (r.worn[s] ? [r.worn[s]] : []));

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** 壊れた値・知らない鍵・持っていない品・場所の違う品は捨てる */
export function gearRecords(raw: Record<string, unknown>): Pick<Records, 'bag' | 'worn' | 'tickets' | 'pity'> {
  const bag: Records['bag'] = {};
  if (raw.bag && typeof raw.bag === 'object')
    for (const [k, v] of Object.entries(raw.bag)) {
      const p = parseKey(k);
      if (!p || !count(v)) continue;
      const key = keyOf(p.def.id, p.rarity);
      bag[key] = (bag[key] ?? 0) + count(v);
    }
  const worn: Records['worn'] = { head: null, body: null, charm: null };
  const w = raw.worn && typeof raw.worn === 'object' ? (raw.worn as Record<string, unknown>) : {};
  for (const s of SLOTS) {
    const p = typeof w[s] === 'string' ? parseKey(w[s]) : null;
    const k = p && keyOf(p.def.id, p.rarity);
    if (k && bag[k] && p.def.slot === s) worn[s] = k;
  }
  const t = Array.isArray(raw.tickets) ? raw.tickets : [];
  return { bag, worn, tickets: [count(t[0]), count(t[1]), count(t[2])], pity: Math.min(PITY - 1, count(raw.pity)) };
}
