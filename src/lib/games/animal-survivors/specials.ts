import { baseOf } from './evolutions';
import { MAX_LEVEL, WEAPONS } from './weapons';
import type { World } from './world';

/**
 * 3 段階めに育っていて、最初の武器（ふつうの進化形も）が Lv5 なら、その枠を専用進化形にする。
 * 育つとき・武器が上がるとき・ふつうに進化したときのどれからも呼ぶ。入れ替えたら true
 */
export function trySpecial(w: World): boolean {
  if (w.form < 2) return false;
  const { weapon, special } = w.animal;
  const own = w.weapons.find((o) => baseOf(o.id) === weapon);
  if (!own || own.id === special) return false;
  if (!WEAPONS[own.id].evolved && own.level < MAX_LEVEL) return false;
  own.id = special;
  own.level = MAX_LEVEL;
  own.cd = 0;
  if (!w.evolvedNow.includes(special)) w.evolvedNow.push(special);
  w.events.push({ type: 'special', id: special });
  return true;
}
