import { ANIMALS } from './animals';
import { ENEMIES } from './enemies';

/** 図鑑に載せるもの。敵は面のふつうの敵とボスの手下、ボスはボスときらきらハリネズミ */
export const BOOK = {
  enemies: Object.values(ENEMIES)
    .filter((d) => !d.prop && !d.boss && !d.metal && !d.part)
    .map((d) => d.id),
  bosses: [...Object.values(ENEMIES).flatMap((d) => (d.boss ? [d.boss as string] : [])), 'metal'],
  forms: ANIMALS.flatMap((a) => [0, 1, 2].map((f) => `${a.id}:${f}`)),
  items: ['meat', 'pouch', 'purse', 'magnet', 'goldMagnet', 'cross', 'clock', 'chest', 'bag']
};

/** その回に図鑑へ足すもの */
export interface RunBook {
  kills: Record<string, number>;
  elites: string[];
  chiefs: string[];
  bosses: { id: string; secs: number }[];
  forms: string[];
  items: string[];
}

/** 新しく載ったときのコイン */
const REWARD = { enemy: 10, item: 10, form: 30, boss: 50 };

export interface Book {
  /** 敵の id → 倒した数 */
  enemies: Record<string, number>;
  elites: string[];
  chiefs: string[];
  /** ボスの id → 倒した回数 */
  bosses: Record<string, number>;
  /** ボスの id → 出てから倒すまでのいちばん速い秒 */
  fastest: Record<string, number>;
  forms: string[];
  items: string[];
}

export const emptyBook = (): Book => ({
  enemies: {},
  elites: [],
  chiefs: [],
  bosses: {},
  fastest: {},
  forms: [],
  items: []
});

const pos = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const ids = (v: unknown, known: string[]) => (Array.isArray(v) ? known.filter((k) => v.includes(k)) : []);
const counts = (v: unknown, known: string[]) => {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object')
    for (const k of known) {
      const n = pos((v as Record<string, unknown>)[k]);
      if (n > 0) out[k] = n;
    }
  return out;
};

/**
 * 保存から読む。図鑑より前の記録（`book` が無い）でも分かるもの（倒したボス、解放した動物の 1 段階め）は載せる。
 * そのときはコインを渡さない（読んだだけでコインが増えないように）
 */
export function parseBook(raw: unknown, bosses: string[], unlocked: string[], starters: string[]): Book {
  const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const book: Book = {
    enemies: counts(b.enemies, BOOK.enemies),
    elites: ids(b.elites, BOOK.enemies),
    chiefs: ids(b.chiefs, BOOK.enemies),
    bosses: counts(b.bosses, BOOK.bosses),
    fastest: counts(b.fastest, BOOK.bosses),
    forms: ids(b.forms, BOOK.forms),
    items: ids(b.items, BOOK.items)
  };
  if (raw !== undefined) return book;
  for (const id of bosses) book.bosses[id] = 1;
  for (const id of unlocked) if (!starters.includes(id)) book.forms.push(`${id}:0`);
  return book;
}

/** その回の分を図鑑に足し、新しく載ったぶんのコインを返す */
export function addBook(r: { book: Book }, run: { book: RunBook }): number {
  const b = r.book;
  const got = run.book;
  let coins = 0;
  for (const [id, n] of Object.entries(got.kills)) {
    if (!BOOK.enemies.includes(id)) continue;
    if (!b.enemies[id]) coins += REWARD.enemy;
    b.enemies[id] = (b.enemies[id] ?? 0) + n;
  }
  for (const id of got.elites) if (!b.elites.includes(id)) b.elites.push(id);
  for (const id of got.chiefs) if (!b.chiefs.includes(id)) b.chiefs.push(id);
  for (const { id, secs } of got.bosses) {
    if (!BOOK.bosses.includes(id)) continue;
    if (!b.bosses[id]) coins += REWARD.boss;
    b.bosses[id] = (b.bosses[id] ?? 0) + 1;
    b.fastest[id] = Math.min(b.fastest[id] ?? Infinity, Math.round(secs * 10) / 10);
  }
  for (const f of got.forms)
    if (BOOK.forms.includes(f) && !b.forms.includes(f)) {
      b.forms.push(f);
      coins += REWARD.form;
    }
  for (const k of got.items)
    if (BOOK.items.includes(k) && !b.items.includes(k)) {
      b.items.push(k);
      coins += REWARD.item;
    }
  return coins;
}
