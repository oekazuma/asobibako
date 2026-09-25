import type { TrickId } from './types';

export type VoiceAction = TrickId | 'call' | 'praise';

export interface Heard {
  /** 名前を呼ばれたペット。呼ばれなければ null（いまのペットに言う） */
  petId: string | null;
  action: VoiceAction;
}

/**
 * 聞き取りの揺れをならす。カタカナはひらがなに、濁点・半濁点は外し（「おいで」が「置いて」と聞こえる）、
 * 長音・小さい「っ」・記号・空白は捨てる（「おすわーりっ！」も「おすわり」になる）
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .normalize('NFD')
    .replace(/[゙゚]/g, '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}]|[ーっ〜]/gu, '');
}

/** 並びが優先の順。芸 → よぶ → ほめる（「おいで、おすわり」はおすわり） */
const WORDS = Object.entries({
  sit: ['おすわり', 'すわれ', 'すわって', 'お座り', '座', 'おさわり', 'お触り'],
  down: ['ふせ', '伏せ', '臥せ', '布施'],
  paw: ['おて', 'お手', '御手', '大手', 'ぱんち'],
  roll: ['ごろん', 'ごろごろ', 'ころがれ', 'ころがって', '転'],
  jump: ['じゃんぷ', 'ちゃんぷ', 'とべ', 'とんで', 'はねて', '跳', '飛'],
  beg: ['ちんちん', 'おねがい', 'お願い', 'たって', '立って', '立て'],
  spin: ['おまわり', 'お回り', 'まわって', 'まわれ', '回って', '回れ', 'くるりん', 'くるくる', 'くるっと'],
  high: ['はいたっち', 'たっち'],
  bow: ['おじぎ', 'お辞儀', 'のびー', 'のびて', '伸び', 'ぺこり'],
  dead: ['しんだふり', '死んだふり', '死んだ振り', 'ばたんきゅ'],
  call: ['おいで', 'こっち', 'きて', '来', 'お出で', '置いて'],
  praise: ['いいこ', 'いい子', '良い子', 'よしよし', '良し良し', 'えらい', '偉い', 'じょうず', '上手', 'すごい']
} satisfies Record<VoiceAction, string[]>).map(
  ([action, words]) => [action as VoiceAction, words.map(normalize)] as const
);

/** 用意した名前がひらがな・漢字で聞き取られたとき用の読み。ひとが付けた名前はかなだけで照らす */
const NAME_KANJI: Record<string, string[]> = {
  タマ: ['玉'],
  ハナ: ['花'],
  モモ: ['桃'],
  サクラ: ['桜'],
  ソラ: ['空'],
  マメ: ['豆'],
  ハチ: ['八', '蜂'],
  ムギ: ['麦'],
  ヨル: ['夜'],
  クロ: ['黒'],
  ギン: ['銀'],
  トラ: ['虎'],
  サバ: ['鯖'],
  スミ: ['墨'],
  シマ: ['縞', '島'],
  キナコ: ['きな粉'],
  コタロウ: ['小太郎'],
  ジジ: ['爺']
};

const KANJI = new Map(Object.entries(NAME_KANJI).map(([name, kanji]) => [normalize(name), kanji.map(normalize)]));

/** ペットの名前と、声で覚えさせた呼び名 */
export interface Named {
  id: string;
  name: string;
  calls?: readonly string[];
}

function findPet(text: string, pets: readonly Named[]) {
  let best: { id: string; key: string } | null = null;
  for (const p of pets) {
    const name = normalize(p.name);
    for (const key of [name, ...(KANJI.get(name) ?? []), ...(p.calls ?? []).map(normalize)]) {
      if (key && text.includes(key) && (!best || key.length > best.key.length)) best = { id: p.id, key };
    }
  }
  return best;
}

/** 聞き取った文字を命令にする。名前だけなら呼ぶ。何も当たらなければ null */
export function parse(text: string, pets: readonly Named[]): Heard | null {
  let rest = normalize(text);
  const pet = findPet(rest, pets);
  // 名前の中の言葉（オテンバ の「おて」など）を命令と取りちがえないよう、名前の分は消してから探す
  if (pet) rest = rest.replace(pet.key, ' ');
  const hit = WORDS.find(([, words]) => words.some((w) => rest.includes(w)));
  if (!hit && !pet) return null;
  return { petId: pet?.id ?? null, action: hit ? hit[0] : 'call' };
}

export const MAX_CALLS = 8;
/** 名前を呼ぶ回数。本家にならって 3 回で覚える */
export const CALLS_TO_LEARN = 3;

/**
 * 名前を呼んだ声を、呼び名として覚える形にする。「おいで」などの命令と「ちゃん」「くん」は外す
 * （呼び名に命令が混ざると、あとでその命令が名前として当たってしまう）。
 * かな 1 字は何にでも当たるので覚えない。長すぎるものは名前でなく文なので覚えない
 */
export function callKey(text: string): string | null {
  let key = normalize(text);
  for (const [, words] of WORDS) for (const w of words) if (w.length > 1) key = key.replaceAll(w, '');
  key = key.replace(/(ちゃん|くん|さん|たん)+$/, '');
  if (!key || key.length > 12) return null;
  return key.length >= 2 || /\p{Script=Han}/u.test(key) ? key : null;
}

/** いまの呼び名に、1 回分の聞き取りの候補（よさそうな順）を足す。上の候補ほど残りやすい */
export function addCalls(calls: readonly string[], alts: readonly string[]): string[] {
  const keys = alts.map(callKey).filter((k): k is string => k !== null);
  return [...new Set([...calls, ...keys.slice(0, 3)])].slice(0, MAX_CALLS);
}
