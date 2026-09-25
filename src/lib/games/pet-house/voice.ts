import type { TrickId } from './types';

/** 芸のほかに声で頼めること。release は「まて」をおしまいにする「よし」 */
export type Order =
  | 'sleep'
  | 'wake'
  | 'feed'
  | 'water'
  | 'sofa'
  | 'bed'
  | 'stay'
  | 'release'
  | 'fetch'
  | 'play'
  | 'walk'
  | 'home'
  | 'bath'
  | 'photo'
  | 'scold';

export type VoiceAction = TrickId | 'call' | 'praise' | Order;

export interface Heard {
  /** 名前を呼ばれたペット。呼ばれなければ null（いまのペットに言う） */
  petId: string | null;
  action: VoiceAction;
}

/** カタカナをひらがなに、長音・小さい「っ」・記号・空白を捨てる。濁点は残す */
function fold(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/[^\p{L}\p{N}]|[ーっ〜]/gu, '');
}

/**
 * 聞き取りの揺れをならす。カタカナはひらがなに、濁点・半濁点は外し（「おいで」が「置いて」と聞こえる）、
 * 長音・小さい「っ」・記号・空白は捨てる（「おすわーりっ！」も「おすわり」になる）。
 * 1 字は 1 字のままなので、fold した文字と同じ位置で照らせる
 */
export function normalize(text: string): string {
  return fold(text)
    .normalize('NFD')
    .replace(/[゙゚]/g, '')
    .normalize('NFC');
}

/**
 * 並びが優先の順。「まて」は芸より先（「おすわり、まて」はまて）、芸はほかの頼みより先（「はねて」の「ねて」はジャンプ）、
 * おきるは呼ぶより先（「おきて」に「きて」が入っている）、ほめる（よしよし）は「よし」より先。
 * 呼ぶ・ほめるはいちばんあと（「おいで、おすわり」はおすわり、「ソファに おいで」はソファ）
 */
const WORDS = Object.entries({
  stay: ['まて', 'まって', '待て', '待って', 'すてい', 'ストップ', 'とまれ', '止まれ', 'とまって'],
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
  wake: ['おきて', '起きて', 'おきろ', '起きろ', 'おはよう', 'おはよ', 'お早う'],
  sleep: ['ねんね', 'おやすみ', 'お休み', 'ねて', 'ねよう', 'ねなさい', 'ねむって', '寝', '眠'],
  scold: ['だめ', '駄目', 'こら', 'やめて', 'いけません'],
  fetch: [
    'もってこい',
    '持ってこい',
    '持って来い',
    '持って来て',
    '取って来い',
    'とってこい',
    '取ってこい',
    'とってきて',
    '取ってきて',
    'もってきて',
    '持ってきて',
    'ボール',
    'フリスビー',
    'ねずみ',
    '投げ'
  ],
  photo: ['ちーず', 'しゃしん', '写真', 'カメラ'],
  bath: ['おふろ', 'ふろ', '風呂'],
  walk: ['おさんぽ', 'さんぽ', '散歩', 'こうえん', '公園'],
  play: ['あそぼ', 'あそんで', '遊'],
  home: ['おうち', 'お家', 'かえろ', 'かえる', '帰'],
  feed: ['ごはん', 'ご飯', '御飯', 'まんま', 'えさ', '餌'],
  water: ['おみず', 'お水', 'みず', '水'],
  sofa: ['ソファ', 'そふぁ'],
  bed: ['ベッド', 'ベット', 'ねどこ'],
  call: ['おいで', 'こっち', 'きて', '来', 'お出で', '置いて'],
  praise: ['いいこ', 'いい子', '良い子', 'よしよし', '良し良し', 'えらい', '偉い', 'じょうず', '上手', 'すごい'],
  release: ['よし', '良し', 'よーし', 'おっけー', 'いいよ']
} satisfies Record<VoiceAction, string[]>).map(
  ([action, words]) => [action as VoiceAction, words.map(normalize)] as const
);

/** しつけのシートに出す「こえで できること」。say はどれもその action に聞き取れる（voice.test.ts が確かめる） */
export const HELP: { say: string[]; does: string; action: VoiceAction }[] = [
  { say: ['ねんね', 'おやすみ'], does: 'ベッドや ソファで ねる', action: 'sleep' },
  { say: ['おきて', 'おはよう'], does: 'のびを して おきる', action: 'wake' },
  { say: ['まて'], does: 'すわって じっと まつ', action: 'stay' },
  { say: ['よし'], does: '「まて」を おしまいに する', action: 'release' },
  { say: ['ごはん'], does: 'おさらに ごはんを いれる', action: 'feed' },
  { say: ['おみず'], does: 'おさらに おみずを いれる', action: 'water' },
  { say: ['ソファ'], does: 'ソファに とびのる', action: 'sofa' },
  { say: ['ベッド'], does: 'ベッドに とびのる', action: 'bed' },
  { say: ['とってこい', 'ボール'], does: 'おもちゃを なげて もってくる', action: 'fetch' },
  { say: ['あそぼ'], does: 'おおはしゃぎ', action: 'play' },
  { say: ['おさんぽ', 'こうえん'], does: 'おでかけ', action: 'walk' },
  { say: ['おうち かえろう'], does: 'おうちへ かえる', action: 'home' },
  { say: ['おふろ'], does: 'おふろに はいる', action: 'bath' },
  { say: ['はい チーズ'], does: 'こっちを むいて しゃしん', action: 'photo' },
  { say: ['だめ', 'こら'], does: 'いたずらを やめる', action: 'scold' },
  { say: ['おいで'], does: 'かけよって くる', action: 'call' },
  { say: ['いいこ'], does: 'ほめる', action: 'praise' },
  { say: ['おすわり'], does: 'げい（げいの なまえで）', action: 'sit' }
];

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
  ジジ: ['爺'],
  ゴマ: ['胡麻'],
  アズキ: ['小豆'],
  コテツ: ['小鉄', '虎徹'],
  スミレ: ['菫'],
  ノリ: ['海苔'],
  クルミ: ['胡桃'],
  ハル: ['春'],
  シロ: ['白'],
  ダイ: ['大'],
  ミカン: ['蜜柑'],
  ユズ: ['柚子'],
  コハク: ['琥珀'],
  ムサシ: ['武蔵'],
  アオ: ['青'],
  マル: ['丸'],
  モチ: ['餅'],
  ダンゴ: ['団子'],
  フク: ['福']
};

const KANJI = new Map(Object.entries(NAME_KANJI).map(([name, kanji]) => [normalize(name), kanji.map(normalize)]));

/** ペットの名前と、声で覚えさせた呼び名 */
export interface Named {
  id: string;
  name: string;
  calls?: readonly string[];
}

/** 聞こえた名前の候補。長い順（ココア と ココ なら ココア が先） */
function findPets(text: string, pets: readonly Named[]): { id: string; key: string }[] {
  const found: { id: string; key: string }[] = [];
  for (const p of pets) {
    const name = normalize(p.name);
    for (const key of [name, ...(KANJI.get(name) ?? []), ...(p.calls ?? []).map(normalize)])
      if (key && text.includes(key)) found.push({ id: p.id, key });
  }
  return found.sort((a, b) => b.key.length - a.key.length);
}

/**
 * 濁点を外すと取りちがえる言葉は、濁点つきの文字（raw）でも照らす。
 * ならすと「ペット」も「ベッド」になるので、ベッドは濁点まで合っているときだけ受ける
 */
const VOICED: Partial<Record<VoiceAction, string[]>> = { bed: ['べど', 'べと', 'ねどこ'] };

/** 「ここまで」「そこまで」の「まで」は、ならすと「まて」になる */
function until(raw: string, i: number): boolean {
  return raw.startsWith('まで', i) && 'こそあど'.includes(raw[i - 1] ?? '');
}

function heard(action: VoiceAction, word: string, text: string, raw: string): boolean {
  const voiced = VOICED[action];
  if (voiced) return text.includes(word) && voiced.some((w) => raw.includes(w));
  for (let i = text.indexOf(word); i >= 0; i = text.indexOf(word, i + 1)) if (!until(raw, i)) return true;
  return false;
}

function order(text: string, raw: string): { action: VoiceAction; word: string } | null {
  for (const [action, words] of WORDS) {
    const word = words.find((w) => heard(action, w, text, raw));
    if (word) return { action, word };
  }
  return null;
}

/** 「ねてない」「たべないで」のような打ち消しは、頼みごとではない */
const NEGATED = /ない(て|よ|の)?$/;

/**
 * 聞き取った文字を命令にする。名前だけなら呼ぶ。何も当たらなければ null。
 * 名前の中の言葉（オテンバ の「おて」）を命令と取りちがえないよう、名前の分は消してから命令を探す。
 * 消すと命令が崩れる名前（「ココ あそぼ」の ココア）は飛ばして短い名前を試し、
 * 命令の中にまるごと入っている名前（「おやすみ」の スミ）は名前として聞かない
 */
export function parse(text: string, pets: readonly Named[]): Heard | null {
  const raw = fold(text);
  const all = normalize(text);
  if (NEGATED.test(all)) return null;
  const found = findPets(all, pets);
  for (const p of found) {
    // raw と位置をそろえるため、名前は同じ字数の空白で消す
    const hit = order(all.replace(p.key, ' '.repeat(p.key.length)), raw);
    if (hit) return { petId: p.id, action: hit.action };
  }
  const whole = order(all, raw);
  if (whole && found.every((p) => whole.word.includes(p.key))) return { petId: null, action: whole.action };
  return found.length ? { petId: found[0].id, action: 'call' } : null;
}

export const MAX_CALLS = 8;
/** 名前を呼ぶ回数。本家にならって 3 回で覚える */
export const CALLS_TO_LEARN = 3;

/**
 * 名前といっしょに言いがちな言葉。呼ぶ言葉と 3 字以上の命令だけにする。
 * 2 字の命令（まて・よし・ため）まで外すと、マテオ・ヨシコのような名前が崩れて覚えられない
 */
const SUFFIX = /(ちゃん|くん|さん|たん)+$/;
const STRIP = WORDS.flatMap(([action, words]) =>
  words.filter((w) => w.length > 2 || (action === 'call' && w.length > 1))
);

/**
 * 名前を呼んだ声を、呼び名として覚える形にする。「おいで」などの命令と「ちゃん」「くん」は外す
 * （呼び名に命令が混ざると、あとでその命令が名前として当たってしまう）。
 * かな 1 字は何にでも当たるので覚えない。長すぎるものは名前でなく文なので覚えない
 */
export function callKey(text: string): string | null {
  // 「ヨシコちゃん」の「こちゃ」を「こっち」と取らないよう、先にも外す
  let key = normalize(text).replace(SUFFIX, '');
  for (const w of STRIP) key = key.replaceAll(w, '');
  key = key.replace(SUFFIX, '');
  if (!key || key.length > 12) return null;
  return key.length >= 2 || /\p{Script=Han}/u.test(key) ? key : null;
}

/** いまの呼び名に、1 回分の聞き取りの候補（よさそうな順）を足す。上の候補ほど残りやすい */
export function addCalls(calls: readonly string[], alts: readonly string[]): string[] {
  const keys = alts.map(callKey).filter((k): k is string => k !== null);
  return [...new Set([...calls, ...keys.slice(0, 3)])].slice(0, MAX_CALLS);
}
