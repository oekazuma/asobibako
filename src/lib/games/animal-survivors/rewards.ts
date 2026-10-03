import { itemArt } from './art/evolved';
import { ITEM_ART } from './art/items';
import { GOLD, POWER, VIGOR } from './choices';

/** 全部埋まったあとのごほうびの札の見せ方（3 択と宝箱で共用） */
export function reward(kind: 'power' | 'vigor' | 'gold') {
  if (kind === 'power')
    return {
      art: itemArt('passive-fang'),
      name: '力のみなもと',
      tag: '',
      text: `攻撃 +${Math.round(POWER * 100)}%（この回だけ）`,
      evo: false
    };
  if (kind === 'vigor')
    return {
      art: itemArt('passive-heart'),
      name: '元気のみなもと',
      tag: '',
      text: `最大 HP +${VIGOR} と全回復`,
      evo: false
    };
  return { art: ITEM_ART.coin, name: 'コインの袋', tag: '', text: `コイン +${GOLD}`, evo: false };
}
