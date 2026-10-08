import { itemArt } from './art/evolved';
import { ITEM_ART } from './art/items';
import type { Reward } from './chest';
import { VIGOR, type Choice } from './choices';
import { limitGain } from './limit';
import { PASSIVES } from './passives';
import { upText, WEAPONS } from './weapons';

/** 3 択と宝箱の札の絵・名前・印・文 */
export function cardInfo(c: Choice | Reward) {
  if (c.kind === 'weapon') {
    const d = WEAPONS[c.id];
    const fresh = c.level === 1;
    return {
      art: itemArt(`weapon-${c.id}`),
      name: d.name,
      tag: fresh ? 'NEW' : `Lv ${c.level}`,
      text: fresh ? d.blurb : upText(d, c.level),
      evo: ('evo' in c && c.evo) || false
    };
  }
  if (c.kind === 'passive') {
    const d = PASSIVES[c.id];
    return {
      art: itemArt(`passive-${c.id}`),
      name: d.name,
      tag: c.level === 1 ? 'NEW' : `Lv ${c.level}`,
      text: d.blurb,
      evo: ('evo' in c && c.evo) || false
    };
  }
  if (c.kind === 'limit')
    return {
      art: itemArt(`weapon-${c.id}`),
      name: WEAPONS[c.id].name,
      tag: '限界突破',
      text: `${limitGain(c.stat, c.now)}（今 +${c.now} → +${c.now + 1}）`,
      evo: false
    };
  if (c.kind === 'meat') return { art: ITEM_ART.meat, name: '肉', tag: '', text: 'HP を 30% 回復', evo: false };
  if (c.kind === 'vigor')
    return {
      art: itemArt('passive-heart'),
      name: '元気のみなもと',
      tag: '',
      text: c.heal !== false ? `最大 HP +${VIGOR} と全回復` : `最大 HP +${VIGOR}`,
      evo: false
    };
  return { art: ITEM_ART.chest, name: '経験値の袋', tag: '', text: '経験値 +25', evo: false };
}

/** 同じ武器の別の能力が並んでも重ならない key */
export const cardKey = (c: Choice) =>
  c.kind === 'limit' ? `limit-${c.id}-${c.stat}` : c.kind + ('id' in c ? c.id : '');
