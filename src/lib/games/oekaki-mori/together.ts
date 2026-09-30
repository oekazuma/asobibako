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

export function paintBy(s: Shared, seat: Seat, region: number, color: string): Change | null {
  if (region < 0 || s.colors[region] === color) return null;
  s.dabs.push({ seat, region, before: s.colors[region] ?? null, after: color });
  s.colors[region] = color;
  return { region, color };
}

/** 押した人の塗りを新しい順に見て、ほかの人が上から塗っていたら捨てて前を見る（押しても何も起きない、を減らす） */
export function undoBy(s: Shared, seat: Seat): Change | null {
  for (let i = s.dabs.length - 1; i >= 0; i--) {
    const dab = s.dabs[i];
    if (dab.seat !== seat) continue;
    s.dabs.splice(i, 1);
    if (s.colors[dab.region] !== dab.after) continue;
    if (dab.before === null) delete s.colors[dab.region];
    else s.colors[dab.region] = dab.before;
    return { region: dab.region, color: dab.before };
  }
  return null;
}
