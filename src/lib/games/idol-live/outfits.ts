import type { Level } from './chart';
import type { Rank } from './judge';

/** 衣装と、ライブの記録（ファンの数・ハイスコア）の保存 */

export type Theme = 'cute' | 'cool' | 'pop' | 'elegant';
export type Slot = 'top' | 'bottom' | 'shoes' | 'acc';
/** 部位ごとに、どのテーマの服を着ているか（1 テーマに 1 部位 1 着） */
export type Coord = Record<Slot, Theme>;

export const SLOTS: { id: Slot; name: string }[] = [
  { id: 'top', name: 'トップス' },
  { id: 'bottom', name: 'ボトムス' },
  { id: 'shoes', name: 'シューズ' },
  { id: 'acc', name: 'アクセ' }
];

export const THEMES: Record<Theme, { name: string; color: string }> = {
  cute: { name: 'キュート', color: '#ff6fa5' },
  cool: { name: 'クール', color: '#4f7bff' },
  pop: { name: 'ポップ', color: '#ffae00' },
  elegant: { name: 'エレガント', color: '#a57bff' }
};

export const THEME_ORDER: Theme[] = ['cute', 'cool', 'pop', 'elegant'];

export const NAMES: Record<Theme, Record<Slot, string>> = {
  cute: {
    top: 'ハートリボンの ブラウス',
    bottom: 'フリルの スカート',
    shoes: 'いちごの おくつ',
    acc: 'おおきな リボン'
  },
  cool: { top: 'ミッドナイト ジャケット', bottom: 'プリーツ スカート', shoes: 'ロングブーツ', acc: 'ヘッドセット' },
  pop: { top: 'スターの Tシャツ', bottom: 'バルーン スカート', shoes: 'ハイカット スニーカー', acc: 'ほしの ヘアピン' },
  elegant: { top: 'パールの ドレス', bottom: 'ロング スカート', shoes: 'ガラスの パンプス', acc: 'ティアラ' }
};

/** 着られるようになるファンの数。エレガントは、ライブでファンを増やすと 1 つずつ手に入る */
export function need(theme: Theme, slot: Slot): number {
  if (theme !== 'elegant') return 0;
  return { acc: 300, top: 900, bottom: 1800, shoes: 3000 }[slot];
}

export const owned = (theme: Theme, slot: Slot, fans: number) => fans >= need(theme, slot);

/** 曲と同じテーマの服 1 つにつき 5% */
export const BONUS = 0.05;
export const bonusOf = (c: Coord, theme: Theme) => SLOTS.filter((s) => c[s.id] === theme).length * BONUS;

/** ライブで増えるファン。スコアの 1/100 */
export const fansOf = (score: number) => Math.round(score / 100);

/** before 人から after 人に増えて、新しく着られるようになった服 */
export function unlockedBetween(before: number, after: number): { theme: Theme; slot: Slot }[] {
  return THEME_ORDER.flatMap((theme) =>
    SLOTS.filter((s) => {
      const n = need(theme, s.id);
      return n > before && n <= after;
    }).map((s) => ({ theme, slot: s.id }))
  );
}

/** 曲とむずかしさごとのいちばんよい記録 */
export interface Best {
  score: number;
  rank: Rank;
}

export interface Save {
  coord: Coord;
  fans: number;
  lives: number;
  level: Level;
  song: string;
  /** キーは「曲:むずかしさ」 */
  records: Record<string, Best>;
}

const KEY = 'asobibako:idol-live';
const FIRST_SONG = 'kirameki';
const FRESH: Save = {
  coord: { top: 'cute', bottom: 'cute', shoes: 'cute', acc: 'cute' },
  fans: 0,
  lives: 0,
  level: 'normal',
  song: FIRST_SONG,
  records: {}
};

export const recordKey = (song: string, level: Level) => `${song}:${level}`;

const isTheme = (v: unknown): v is Theme => typeof v === 'string' && v in THEMES;
const isRank = (v: unknown): v is Rank => typeof v === 'string' && ['S', 'A', 'B', 'C'].includes(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

/** songs は遊べる曲の id。知らない曲を選んでいた保存は、はじめの曲に戻す */
export function load(songs: string[] = [FIRST_SONG]): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return structuredClone(FRESH);
    const fans = num(raw.fans);
    const coord = { ...FRESH.coord };
    for (const s of SLOTS) {
      const v = raw.coord?.[s.id];
      if (isTheme(v) && owned(v, s.id, fans)) coord[s.id] = v;
    }
    const records: Record<string, Best> = {};
    for (const [k, v] of Object.entries(raw.records ?? {})) {
      const b = v as Partial<Best>;
      if (isRank(b?.rank) && num(b.score)) records[k] = { score: num(b.score), rank: b.rank };
    }
    // むずかしさを選べるようになる前の保存は、1 曲目の「ふつう」の記録
    if (num(raw.best) && isRank(raw.bestRank))
      records[recordKey(FIRST_SONG, 'normal')] ??= { score: num(raw.best), rank: raw.bestRank };
    return {
      coord,
      fans,
      lives: num(raw.lives),
      level: raw.level === 'easy' ? 'easy' : 'normal',
      song: songs.includes(raw.song) ? raw.song : FIRST_SONG,
      records
    };
  } catch {
    return structuredClone(FRESH);
  }
}

export function store(s: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // プライベートブラウズでは残せないが、遊ぶことはできる
  }
}

/** 記録を更新する。スコアとランクはそれぞれよいほうを残す。スコアを更新したら true */
export function record(s: Save, score: number, rank: Rank): boolean {
  const k = recordKey(s.song, s.level);
  const old = s.records[k];
  s.records[k] = {
    score: Math.max(old?.score ?? 0, score),
    rank: old && 'SABC'.indexOf(old.rank) < 'SABC'.indexOf(rank) ? old.rank : rank
  };
  return score > (old?.score ?? 0);
}
