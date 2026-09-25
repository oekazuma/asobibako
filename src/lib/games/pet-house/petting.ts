import type { Cry } from './cries';
import type { Kind, PetAction } from './types';

/** なでた体の場所。world3d.ts の pickPart が骨の位置から決める */
export type Part = 'head' | 'chin' | 'cheek' | 'back' | 'belly' | 'rear' | 'tail' | 'paw';

/** 同じ所をなで続けたときに 1 度だけ起きる反応。画面は吹き出しと鳴き声にする */
export type Feel = 'like' | 'melt' | 'tickle' | 'swat' | 'flick' | 'turn' | 'enough';

/** 好きな度合い。1 がふつうで、大きいほどよくなかよしが増える。DISLIKE 未満は苦手 */
const LIKE: Record<Kind, Record<Part, number>> = {
  dog: { head: 1.2, chin: 1.4, cheek: 1.2, back: 1.3, belly: 1.6, rear: 1, tail: 0, paw: 0.6 },
  cat: { head: 1.3, chin: 1.8, cheek: 1.7, back: 1.1, belly: 0, rear: 0.8, tail: 0, paw: 0.4 }
};
const DISLIKE = 0.2;
/** 犬がおなかを見せてくれる、なかよし（ハート）の数 */
const TRUST = 2;
/**
 * 猫のおなかは、ハートが少ないうちだけ苦手、そのあとはがまん、なかよしならおなかを見せる。
 * 子どもが遊ぶので、猫が怒ってばかりに見えないようにする
 */
const CAT_BEAR = 1;
const CAT_TRUST = 3;
/** 苦手な所をなで続けて、「また あとでね」と離れていくまでの秒 */
export const ENOUGH = 3.5;
/** 好きな所をなで続けて、とろけはじめるまでの秒。なかよしほど早い */
export const meltAt = (love: number) => 3.2 - 0.3 * Math.floor(love);

export function liking(kind: Kind, love: number, part: Part): number {
  if (kind === 'dog' && part === 'belly' && love < TRUST) return 0;
  if (kind === 'cat' && part === 'belly') return love >= CAT_TRUST ? 1.2 : love >= CAT_BEAR ? 0.5 : 0;
  return LIKE[kind][part];
}

export const dislikes = (kind: Kind, love: number, part: Part) => liking(kind, love, part) < DISLIKE;

/** engine.ts の stroke に渡す重さ。とろけているあいだはさらに増える */
export function strokeWeight(kind: Kind, love: number, part: Part, s: number): number {
  const like = liking(kind, love, part);
  return like < DISLIKE ? 0 : like * (s >= meltAt(love) ? 1.5 : 1);
}

/** 同じ所を s 秒なで続けたときのかっこう */
export function rubPose(kind: Kind, love: number, part: Part, s: number): PetAction {
  const cat = kind === 'cat';
  if (dislikes(kind, love, part)) {
    if (cat && part === 'belly' && s < 0.5) return 'swat';
    return cat && part === 'tail' ? 'flick' : 'stand';
  }
  if (cat && part === 'back') return 'arch';
  switch (part) {
    case 'paw':
      return 'paw';
    case 'belly':
      return cat && love < CAT_TRUST ? 'stand' : 'belly';
    case 'head':
    case 'chin':
    case 'cheek':
    case 'back':
      return 'bliss';
    default:
      return 'stand';
  }
}

/** なで続けた秒が from から to へ進んだあいだに起きた反応 */
export function feelOf(kind: Kind, love: number, part: Part, from: number, to: number): Feel | null {
  const past = (t: number) => from < t && to >= t;
  if (dislikes(kind, love, part)) {
    if (past(ENOUGH)) return 'enough';
    if (!past(0.3)) return null;
    if (part === 'tail') return kind === 'dog' ? 'turn' : 'flick';
    return kind === 'cat' && part === 'belly' ? 'swat' : 'tickle';
  }
  if (past(meltAt(love)) && liking(kind, love, part) >= 1) return 'melt';
  if (part === 'belly' && past(0.3)) return 'tickle';
  if (past(0.8) && liking(kind, love, part) >= 1.2) return 'like';
  return null;
}

export const FEEL: Record<Feel, { say: string; cry: Record<Kind, Cry> }> = {
  like: { say: 'そこ すき！', cry: { dog: 'happy', cat: 'sweet' } },
  melt: { say: 'きもちいい〜', cry: { dog: 'sweet', cat: 'purr' } },
  tickle: { say: 'くすぐったい！', cry: { dog: 'happy', cat: 'answer' } },
  swat: { say: 'えいっ', cry: { dog: 'answer', cat: 'answer' } },
  flick: { say: 'しっぽは ひみつ', cry: { dog: 'answer', cat: 'answer' } },
  turn: { say: 'なあに？', cry: { dog: 'happy', cat: 'sweet' } },
  enough: { say: 'また あとでね', cry: { dog: 'sweet', cat: 'sweet' } }
};

/** なで方の発見をうながすヒント。まだなでていない好きな所を 1 つ選んで出す */
export const TRY: Record<Kind, Part[]> = { dog: ['chin', 'back', 'belly', 'head'], cat: ['chin', 'cheek', 'head'] };
export const PART_NAME: Record<Part, string> = {
  head: 'あたま',
  chin: 'あご',
  cheek: 'ほっぺ',
  back: 'せなか',
  belly: 'おなか',
  rear: 'おしり',
  tail: 'しっぽ',
  paw: 'まえあし'
};
