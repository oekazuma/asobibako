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

export interface Save {
  coord: Coord;
  fans: number;
  best: number;
  bestRank: Rank | null;
  lives: number;
}

const KEY = 'asobibako:idol-live';
const FRESH: Save = {
  coord: { top: 'cute', bottom: 'cute', shoes: 'cute', acc: 'cute' },
  fans: 0,
  best: 0,
  bestRank: null,
  lives: 0
};

const isTheme = (v: unknown): v is Theme => typeof v === 'string' && v in THEMES;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

export function load(): Save {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return structuredClone(FRESH);
    const fans = num(raw.fans);
    const coord = { ...FRESH.coord };
    for (const s of SLOTS) {
      const v = raw.coord?.[s.id];
      if (isTheme(v) && owned(v, s.id, fans)) coord[s.id] = v;
    }
    const bestRank = ['S', 'A', 'B', 'C'].includes(raw.bestRank) ? (raw.bestRank as Rank) : null;
    return { coord, fans, best: num(raw.best), bestRank, lives: num(raw.lives) };
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

/** よいほうのランク */
export const better = (a: Rank | null, b: Rank): Rank => (a && 'SABC'.indexOf(a) < 'SABC'.indexOf(b) ? a : b);
