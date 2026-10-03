import { trySpecial } from './specials';
import { MAX_LEVEL, WEAPONS } from './weapons';
import type { World } from './world';

export interface Evolution {
  from: string;
  /** 対のパッシブ。Lv は問わない */
  with: string;
  to: string;
}

export const EVOLUTIONS: Evolution[] = [
  { from: 'woof', with: 'fang', to: 'woofEvo' },
  { from: 'paw', with: 'claw', to: 'pawEvo' },
  { from: 'howl', with: 'roar', to: 'howlEvo' },
  { from: 'boomerang', with: 'paws', to: 'boomerangEvo' },
  { from: 'feather', with: 'whisker', to: 'featherEvo' },
  { from: 'thunder', with: 'drum', to: 'thunderEvo' },
  { from: 'fish', with: 'nose', to: 'fishEvo' },
  { from: 'claw', with: 'fur', to: 'clawEvo' },
  { from: 'dash', with: 'paws', to: 'dashEvo' },
  { from: 'acorn', with: 'leaf', to: 'acornEvo' },
  { from: 'flame', with: 'heart', to: 'flameEvo' },
  { from: 'vine', with: 'leaf', to: 'vineEvo' }
];

/** 進化形の id を元の武器の id にする（描き分けと、元の武器を 3 択に出さないため）。元の武器はそのまま */
export function baseOf(id: string): string {
  return WEAPONS[id]?.from ?? EVOLUTIONS.find((e) => e.to === id)?.from ?? id;
}

/** 今の宝箱で進化できる組。持っている順の最初の 1 つ */
export function evolvable(w: World): Evolution | undefined {
  for (const o of w.weapons) {
    if (o.level < MAX_LEVEL) continue;
    const e = EVOLUTIONS.find((x) => x.from === o.id);
    if (e && w.passives.some((p) => p.id === e.with)) return e;
  }
  return undefined;
}

export function evolve(w: World, e: Evolution): void {
  const own = w.weapons.find((o) => o.id === e.from);
  if (!own) return;
  own.id = e.to;
  own.cd = 0;
  w.evolvedNow.push(e.to);
  w.events.push({ type: 'evolve', id: e.to });
  trySpecial(w);
}
