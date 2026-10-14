import { MAX_STEPS } from '$lib/coloring/paint';
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';

/** 1 回の塗り。戻すときに、いまの色がこの塗りのままかを after で確かめる */
export interface Dab {
  seat: Seat;
  region: number;
  before: string | null;
  after: string;
}

/** 親だけが持つ。子には Change だけを配る */
export interface Shared {
  colors: Record<number, string>;
  dabs: Dab[];
}

/** 全員に配る色の変化。color が null なら塗っていない白に戻す */
export interface Change {
  region: number;
  color: string | null;
}

export const shared = (): Shared => ({ colors: {}, dabs: [] });

/** 配った線画にある場所の番号か。NaN は JSON で null になり、子の端末では場所 0 を塗ってしまう */
const isRegion = (v: unknown, count: number): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < count;
/** パレットの色の形か。形の違う色は「できた！」で全員のぬりえちょうに残る */
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v);

export function paintBy(s: Shared, seat: Seat, region: number, color: string): Change | null {
  if (region < 0 || s.colors[region] === color) return null;
  s.dabs.push({ seat, region, before: s.colors[region] ?? null, after: color });
  // 親が遊ぶあいだ持ち続けるので、ひとりのぬりえと同じ数だけ戻せるようにして増え続けないようにする
  if (s.dabs.length > MAX_STEPS) s.dabs.shift();
  s.colors[region] = color;
  return { region, color };
}

/** 子から届いた塗りを、配った線画とパレットの形か確かめてから塗る */
export function paintFrom(s: Shared, seat: Seat, m: Message, count: number): Change | null {
  const { region, color } = m;
  return isRegion(region, count) && isColor(color) ? paintBy(s, seat, region, color) : null;
}

/** 親から届いた色の変化を入れた新しい表を返す。形が違えば表をそのまま返す */
export function recolor(colors: Record<number, string>, m: Message, count: number): Record<number, string> {
  const { region, color } = m;
  if (!isRegion(region, count) || (color !== null && !isColor(color))) return colors;
  const next = { ...colors };
  if (isColor(color)) next[region] = color;
  else delete next[region];
  return next;
}

/** 押した人の塗りを新しい順に見て、ほかの人が上から塗っていたら捨てて前を見る（押しても何も起きない、を減らす） */
export function undoBy(s: Shared, seat: Seat): Change | null {
  for (let i = s.dabs.length - 1; i >= 0; i--) {
    const dab = s.dabs[i];
    if (dab.seat !== seat) continue;
    s.dabs.splice(i, 1);
    // 同じ場所にあとから塗った手順が残っていれば、見えているのはその塗り。色が同じでも、戻すとその人の塗りを消してしまう
    if (s.colors[dab.region] !== dab.after || s.dabs.slice(i).some((d) => d.region === dab.region)) continue;
    if (dab.before === null) delete s.colors[dab.region];
    else s.colors[dab.region] = dab.before;
    return { region: dab.region, color: dab.before };
  }
  return null;
}
