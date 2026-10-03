import { animal, type AnimalId } from './animals';
import { ANIMAL_ART } from './art/animals';
import { BOSS_ART } from './art/bosses';
import { ENEMY_ART } from './art/enemies';
import { goldArt } from './art/evolved';
import { ITEM_ART } from './art/items';
import { BOOK } from './book';
import { ENEMIES } from './enemies';
import type { Art } from './pixels';
import type { Records } from './records';

export type Tab = keyof typeof BOOK;

export interface Entry {
  key: string;
  art: Art;
  name: string;
  known: boolean;
  /** 札を押したときに出す記録の行 */
  detail: string[];
}

const ITEMS: Record<string, [string, string, Art]> = {
  meat: ['肉', 'HP を 30 回復', ITEM_ART.meat],
  pouch: ['コインの小袋', 'コイン 10 枚', ITEM_ART.pouch],
  purse: ['コインの大袋', 'コイン 50 枚。ボスときらきらハリネズミが落とす', ITEM_ART.purse],
  magnet: ['磁石', '経験値の玉を全部引き寄せる', ITEM_ART.magnet],
  goldMagnet: ['金の磁石', 'コインを全部引き寄せ、コインラッシュが始まる', goldArt(ITEM_ART.magnet)],
  cross: ['十字架', '画面の中の敵を倒す', ITEM_ART.cross],
  clock: ['時計', '10 秒のあいだ敵が止まる', ITEM_ART.clock],
  chest: ['宝箱', '持っているものを強くする', ITEM_ART.chest],
  bag: ['経験値の袋', '3 択が尽きたときに出る。経験値 +25', ITEM_ART.gem2]
};

const n = (v: number) => Math.floor(v).toLocaleString('ja-JP');
const art = (id: string): Art => (ENEMY_ART as Record<string, Art>)[id] ?? (BOSS_ART as Record<string, Art>)[id];

export function entries(r: Records, tab: Tab): Entry[] {
  const b = r.book;
  if (tab === 'enemies')
    return BOOK.enemies.map((id) => ({
      key: id,
      art: art(id),
      name: ENEMIES[id].name,
      known: (b.enemies[id] ?? 0) > 0,
      detail: [
        `倒した数 ${n(b.enemies[id] ?? 0)}`,
        ...(b.elites.includes(id) ? ['金色の強化個体を倒した'] : []),
        ...(b.chiefs.includes(id) ? ['王冠のヌシを倒した'] : [])
      ]
    }));
  if (tab === 'bosses')
    return BOOK.bosses.map((id) => ({
      key: id,
      art: art(id),
      name: ENEMIES[id].name,
      known: (b.bosses[id] ?? 0) > 0,
      detail: [
        `倒した ${n(b.bosses[id] ?? 0)} 回`,
        ...(b.fastest[id] ? [`いちばん速く ${b.fastest[id].toFixed(1)} 秒`] : [])
      ]
    }));
  if (tab === 'forms')
    return BOOK.forms.map((key) => {
      const [id, f] = key.split(':') as [AnimalId, string];
      const a = animal(id);
      return {
        key,
        art: ANIMAL_ART[id].forms[Number(f)].walk,
        name: a.forms[Number(f)],
        known: b.forms.includes(key),
        detail: [`${a.name}の ${Number(f) + 1} 段階め`]
      };
    });
  return BOOK.items.map((key) => ({
    key,
    art: ITEMS[key][2],
    name: ITEMS[key][0],
    known: b.items.includes(key),
    detail: [ITEMS[key][1]]
  }));
}
