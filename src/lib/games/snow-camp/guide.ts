import { FIRE, HUNT_BOTTOM, MONEY, type GameState } from './engine';

export interface Objective {
  text: string;
  x: number;
  y: number;
  /** 行き先の種類。目印や吹き出しの色を変えるのに使う */
  kind: 'hunt' | 'pick' | 'fire' | 'money' | 'pad' | 'home';
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function nearest<T extends { x: number; y: number }>(list: T[], from: { x: number; y: number }): T | undefined {
  return list.reduce<T | undefined>(
    (best, item) => (!best || dist(item, from) < dist(best, from) ? item : best),
    undefined
  );
}

/**
 * いま何をすればよいかを 1 つだけ選ぶ。遊びの流れ（狩る → 拾う → 焼く → お金を拾う → 払う）の、
 * 先に片づけたほうがよいものから順に見る
 */
export function objective(state: GameState): Objective {
  const { hero } = state;
  if (state.carry >= state.cap) return { text: 'いっぱい！ たき火へ はこぼう', ...FIRE, kind: 'fire' };
  const drop = nearest(state.drops, hero);
  if (drop) return { text: 'おにくを ひろおう', x: drop.x, y: drop.y, kind: 'pick' };
  // 1 匹ごとに往復させると狩りの時間が道のりに消えるので、たき火が空きそうなときだけ戻らせる
  if (state.carry > 0 && state.cooking <= 1) return { text: 'おにくを たき火へ はこぼう', ...FIRE, kind: 'fire' };
  // 狩りの途中でお金のために呼び戻さない
  if (state.coins > 0 && hero.y > HUNT_BOTTOM) return { text: 'おかねを ひろおう', ...MONEY, kind: 'money' };
  if (state.wallet > 0) {
    const home = state.pads.find((p) => p.id === 'home')!;
    const cheap = state.pads
      .filter((p) => p.id !== 'home' && p.cost - p.paid <= state.wallet)
      .sort((a, b) => a.cost - a.paid - (b.cost - b.paid))[0];
    if (state.wallet >= home.cost - home.paid) return { text: '家を 建てよう！', x: home.x, y: home.y, kind: 'home' };
    if (cheap) return { text: 'パッドに のって つよくなろう', x: cheap.x, y: cheap.y, kind: 'pad' };
    return { text: '家に おかねを いれよう', x: home.x, y: home.y, kind: 'home' };
  }
  const prey = nearest(state.animals, hero);
  if (prey) return { text: 'どうぶつに ちかづいて たおそう', x: prey.x, y: prey.y, kind: 'hunt' };
  return { text: 'どうぶつを さがそう', x: hero.x, y: 0.6, kind: 'hunt' };
}
