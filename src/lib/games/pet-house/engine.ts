import { BREED_IDS, BREEDS } from './breeds';
import type { AccessoryId, BreedId, ContestId, FoodId, Kind, PetAction, Stat, ToyId, TrickId } from './types';
import { MAX_CALLS } from './voice';
import {
  DECOR,
  decorGain,
  decorPrice,
  NATURAL_ROOM,
  repairDecor,
  ROOM_PARTS,
  type DecorId,
  type RoomLook
} from './decor';

/**
 * わんにゃんハウスの決まりごと。DOM も three も使わない。
 * ステータスは 0..100、なかよし（love）は 0..5 の小数でハートの数は切り捨て
 */

export interface Pet {
  id: string;
  breed: BreedId;
  name: string;
  stats: Record<Stat, number>;
  love: number;
  /** 芸ごとに、成功してほめた回数 */
  tricks: Partial<Record<TrickId, number>>;
  accessory: AccessoryId | null;
  /** 声で覚えさせた呼び名（voice.ts の callKey の形）。自分で付けた名前が漢字などで聞き取られても当てるため */
  calls?: string[];
}

export interface Save {
  pets: Pet[];
  current: string;
  money: number;
  food: Record<FoodId, number>;
  toys: ToyId[];
  accessories: AccessoryId[];
  /** 減りをここまで反映した時刻（ms）。tick が遊んだぶん進める */
  seen: number;
  /** おこづかいを最後にもらったローカルの日付 YYYY-MM-DD */
  allowanceDay: string;
  photos: string[];
  /**
   * コンテストごとに、1 位をとった階級の数（0..CONTEST_RANKS）。次に出られる階級もこれで決まり、
   * 部屋の棚にはとった階級のトロフィーを並べる
   */
  contest: Record<ContestId, number>;
  /** 買った部屋の部位（decor.ts の「部位:テーマ」）。ナチュラルは入れない */
  decor: string[];
  /** いまの部屋の見た目 */
  room: RoomLook;
  /** 押したスタンプ（stamps.ts の id）。押した順 */
  stamps: string[];
  /** スタンプのために数える回数。days は遊んだ日数（連続でなくてよい） */
  counters: Record<CounterId, number>;
}

export const COUNTERS = [
  'stroke',
  'meal',
  'bath',
  'walk',
  'photo',
  'found',
  'greet',
  'poop',
  'leap',
  'fetch',
  'nap',
  'napTogether',
  'days'
] as const;
export type CounterId = (typeof COUNTERS)[number];

export const STORAGE_KEY = 'asobibako:pet-house';
/**
 * 写真は本体と別のキーに置く。本体は操作のたびに書くので軽く保ち、
 * 写真で容量があふれてもペットとお金の保存は巻き添えにしない
 */
export const PHOTOS_KEY = 'asobibako:pet-house:photos';
export const MAX_PETS = 3;
export const MAX_PHOTOS = 6;
export const ALLOWANCE = 500;
export const TRICK_REWARD = 300;

const HOUR = 3600;
/** 1 時間あたりの減り。おなかは 6 時間ほどで空になる */
const DECAY: Record<Stat, number> = { food: 100 / 6, water: 100 / 5, clean: 100 / 12, energy: 100 / 10 };
/** 閉じていたあいだはここより下げない。子どもが戻ってきて悲しくならないように */
export const FLOOR = 20;
/** 閉じていたあいだは寝ていたことにして、げんきは 1 時間にこれだけ戻る */
const AWAY_REST = 30;
/** 寝ているあいだ 1 秒に戻るげんき。25 から 1 分ほどで満タン近くになる */
const REST_RATE = 1.3;
/** 投げっこ 1 回ぶんのげんき。満タンから 15〜20 回でベッドへ行く */
const PLAY_COST = 4.5;
/** なで 1 秒ぶんのなかよし。最初のハートは 20〜40 秒で届き（速くこすると 1 秒に 2 秒ぶん進む）、ハートが増えるほどゆっくりになる */
const STROKE_RATE = 1 / 40;
const BRUSH_CLEAN = 8;

const FOODS: readonly FoodId[] = ['dogfood', 'catfood', 'treat'];
const TOYS: readonly ToyId[] = ['ball', 'frisbee', 'wand', 'mouse'];
const ACCESSORIES: readonly AccessoryId[] = ['collar-red', 'collar-blue', 'ribbon', 'hat', 'bandana'];
const STATS: readonly Stat[] = ['food', 'water', 'clean', 'energy'];
export const CONTEST_IDS: readonly ContestId[] = ['frisbee', 'wand', 'agility', 'obedience'];
/** ビギナー・オープン・エキスパート・マスター・チャンピオン */
export const CONTEST_RANKS = 5;

export const kindOf = (breed: BreedId): Kind => BREEDS[breed].kind;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function day(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function newSave(now: number): Save {
  return {
    pets: [],
    current: '',
    money: 1000,
    food: { dogfood: 5, catfood: 5, treat: 3 },
    toys: ['ball', 'wand'],
    accessories: [],
    seen: now,
    // 初日はおこづかいを出さない。最初のお金がそのぶん
    allowanceDay: day(now),
    photos: [],
    contest: { frisbee: 0, wand: 0, agility: 0, obedience: 0 },
    decor: [],
    room: { ...NATURAL_ROOM },
    stamps: [],
    counters: newCounters()
  };
}

const newCounters = () =>
  Object.fromEntries(COUNTERS.map((c) => [c, c === 'days' ? 1 : 0])) as Record<CounterId, number>;

/** スタンプのために 1 つ数える */
export function count(save: Save, key: CounterId, n = 1): void {
  save.counters[key] = Math.min(999999, save.counters[key] + n);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number, lo: number, hi: number) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : fallback;
const pick = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T);

function repairPet(raw: unknown, taken: Set<string>): Pet | null {
  if (!isObj(raw) || !pick(BREED_IDS, raw.breed)) return null;
  let id = typeof raw.id === 'string' && raw.id ? raw.id : 'pet';
  while (taken.has(id)) id += '+';
  taken.add(id);
  const stats = isObj(raw.stats) ? raw.stats : {};
  const tricks = isObj(raw.tricks) ? raw.tricks : {};
  const calls = (Array.isArray(raw.calls) ? raw.calls : [])
    .filter((c): c is string => typeof c === 'string' && c.length > 0 && c.length <= 12)
    .slice(0, MAX_CALLS);
  return {
    id,
    breed: raw.breed,
    name: typeof raw.name === 'string' && raw.name ? raw.name.slice(0, 12) : 'ポチ',
    stats: Object.fromEntries(STATS.map((s) => [s, num(stats[s], 80, 0, 100)])) as Record<Stat, number>,
    love: num(raw.love, 0, 0, 5),
    tricks: Object.fromEntries(
      TRICKS.filter((t) => typeof tricks[t.id] === 'number').map((t) => [t.id, Math.floor(num(tricks[t.id], 0, 0, 99))])
    ),
    accessory: pick(ACCESSORIES, raw.accessory) ? raw.accessory : null,
    ...(calls.length ? { calls } : {})
  };
}

/** 読めない・壊れているときは null。形が古いだけなら足りない項目を補って返す */
export function loadSave(): Save | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text === null) return null;
    const raw: unknown = JSON.parse(text);
    if (!isObj(raw)) return null;
    const now = Date.now();
    const base = newSave(now);
    const taken = new Set<string>();
    const pets = (Array.isArray(raw.pets) ? raw.pets : [])
      .map((p) => repairPet(p, taken))
      .filter((p): p is Pet => p !== null)
      .slice(0, MAX_PETS);
    const food = isObj(raw.food) ? raw.food : {};
    const contest = isObj(raw.contest) ? raw.contest : {};
    const counters = isObj(raw.counters) ? raw.counters : {};
    const list = <T extends string>(all: readonly T[], v: unknown): T[] =>
      Array.isArray(v) ? all.filter((id) => v.includes(id)) : [];
    return {
      pets,
      current: pets.some((p) => p.id === raw.current) ? (raw.current as string) : (pets[0]?.id ?? ''),
      money: Math.floor(num(raw.money, base.money, 0, 999999)),
      food: Object.fromEntries(FOODS.map((f) => [f, Math.floor(num(food[f], base.food[f], 0, 999))])) as Record<
        FoodId,
        number
      >,
      toys: list(TOYS, [...base.toys, ...(Array.isArray(raw.toys) ? raw.toys : [])]),
      accessories: list(ACCESSORIES, raw.accessories),
      seen: num(raw.seen, now, 0, now),
      allowanceDay: typeof raw.allowanceDay === 'string' ? raw.allowanceDay : base.allowanceDay,
      photos: loadPhotos(),
      contest: Object.fromEntries(
        CONTEST_IDS.map((c) => [c, Math.floor(num(contest[c], 0, 0, CONTEST_RANKS))])
      ) as Record<ContestId, number>,
      ...repairDecor(raw.decor, raw.room),
      stamps: Array.isArray(raw.stamps)
        ? [...new Set(raw.stamps.filter((v): v is string => typeof v === 'string' && v.length <= 32))]
        : [],
      counters: Object.fromEntries(
        COUNTERS.map((c) => [c, Math.floor(num(counters[c], c === 'days' ? 1 : 0, 0, 999999))])
      ) as Record<CounterId, number>
    };
  } catch {
    return null;
  }
}

function loadPhotos(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PHOTOS_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string').slice(0, MAX_PHOTOS) : [];
  } catch {
    return [];
  }
}

/** 写真を除いた本体を書く。写真は writePhotos で撮ったときだけ書く */
export function writeSave(save: Save): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...save, photos: undefined }));
  } catch {
    // プライベートブラウズでは残せない。遊ぶのには困らない
  }
}

/** 容量が足りなければ古い写真から減らし、残せたぶんに save.photos もそろえる（読み直して枚数が変わらないように） */
export function writePhotos(save: Save): void {
  for (let n = save.photos.length; n >= 0; n--) {
    try {
      if (n === 0) localStorage.removeItem(PHOTOS_KEY);
      else localStorage.setItem(PHOTOS_KEY, JSON.stringify(save.photos.slice(0, n)));
      if (n < save.photos.length) save.photos = save.photos.slice(0, n);
      return;
    } catch {
      // 1 枚減らしてもう一度
    }
  }
}

/** 閉じていたあいだの減りとおこづかい。開いたときと画面が前面に戻ったときに呼ぶ */
export function catchUp(save: Save, now: number): { allowance: number } {
  const hours = Math.max(0, now - save.seen) / 1000 / HOUR;
  for (const pet of save.pets) {
    for (const s of STATS) {
      const v = pet.stats[s];
      pet.stats[s] =
        s === 'energy' ? Math.min(100, v + AWAY_REST * hours) : Math.max(Math.min(v, FLOOR), v - DECAY[s] * hours);
    }
  }
  save.seen = now;
  const today = day(now);
  if (save.allowanceDay === today) return { allowance: 0 };
  save.allowanceDay = today;
  save.money += ALLOWANCE;
  count(save, 'days');
  return { allowance: ALLOWANCE };
}

/** 遊んでいるあいだの減り。寝ているペットのげんきは画面が rest() で戻す */
export function tick(save: Save, seconds: number): void {
  for (const pet of save.pets) {
    for (const s of STATS) pet.stats[s] = Math.max(0, pet.stats[s] - (DECAY[s] * seconds) / HOUR);
  }
  save.seen += seconds * 1000;
}

export function rest(pet: Pet, seconds: number): void {
  pet.stats.energy = Math.min(100, pet.stats.energy + REST_RATE * seconds);
}

/** 投げっこ・飛びつき・プレゼント 1 つぶんを 1 とする。公園を歩くあいだは秒 / 20 くらいで呼ぶ */
export function play(pet: Pet, amount = 1): void {
  pet.stats.energy = Math.max(0, pet.stats.energy - PLAY_COST * amount);
  grow(pet, 0.04 * amount);
}

/** ハート n 個からは (1 + 2n) 倍かかる。最初はすぐ届き、5 つそろうのは毎日遊んで 1 週間ほど */
function grow(pet: Pet, amount: number): void {
  pet.love = Math.min(5, pet.love + amount / (1 + 2 * Math.floor(pet.love)));
}

export function adoptPrice(save: Save): number {
  return [0, 4000, 5000][save.pets.length] ?? Infinity;
}

export function adopt(save: Save, breed: BreedId, name: string): Pet | 'money' | 'full' {
  if (save.pets.length >= MAX_PETS) return 'full';
  const price = adoptPrice(save);
  if (save.money < price) return 'money';
  let n = save.pets.length + 1;
  while (save.pets.some((p) => p.id === `pet${n}`)) n++;
  const pet: Pet = {
    id: `pet${n}`,
    breed,
    name: name.trim().slice(0, 12) || 'ポチ',
    stats: { food: 80, water: 80, clean: 100, energy: 100 },
    love: 0,
    tricks: {},
    accessory: null
  };
  save.money -= price;
  save.pets.push(pet);
  save.current = pet.id;
  return pet;
}

/** お皿 1 杯を食べきったとき。食べものの在庫はお皿に入れるときに画面が減らす */
export function eat(pet: Pet, food: FoodId): void {
  const own = food === 'treat' || (food === 'dogfood') === (kindOf(pet.breed) === 'dog');
  const gain = food === 'treat' ? 15 : own ? 45 : 25;
  const hungry = pet.stats.food < 60;
  pet.stats.food = Math.min(100, pet.stats.food + gain);
  grow(pet, food === 'treat' ? 0.2 : hungry ? 0.1 : 0.03);
}

export function drink(pet: Pet): void {
  pet.stats.water = Math.min(100, pet.stats.water + 40);
  grow(pet, 0.03);
}

/** amount はこすった秒数、weight はなでた所の好き嫌い（petting.ts の strokeWeight） */
export function stroke(pet: Pet, amount: number, weight = 1): void {
  grow(pet, amount * STROKE_RATE * weight);
}

/** amount はブラシでこすった秒数。0 から 12 秒ほどでぴかぴか */
export function brush(pet: Pet, amount: number): void {
  pet.stats.clean = Math.min(100, pet.stats.clean + BRUSH_CLEAN * amount);
  grow(pet, (amount * STROKE_RATE) / 2);
}

/** おふろのシャワーで泡を流しているあいだ。progress は流した割合 0..1 で、流すほど汚れが落ちる */
export function wash(pet: Pet, progress: number): void {
  pet.stats.clean = Math.max(pet.stats.clean, 100 * clamp(progress, 0, 1));
}

/** おふろを最後まで入ったとき。ぴかぴかになり、なかよしも少し */
export function bathe(pet: Pet): void {
  pet.stats.clean = 100;
  grow(pet, 0.15);
}

export function hearts(pet: Pet): number {
  return clamp(Math.floor(pet.love), 0, 5);
}

export type Mood = 'hungry' | 'thirsty' | 'dirty' | 'sleepy' | 'happy' | 'ok';
/** これより低いと困った顔をする */
export const LOW = 30;
/** げんきがこれより低いと寝に行く */
export const SLEEPY = 25;

export function mood(pet: Pet): Mood {
  const s = pet.stats;
  if (s.energy < SLEEPY) return 'sleepy';
  if (s.food < LOW) return 'hungry';
  if (s.water < LOW) return 'thirsty';
  if (s.clean < LOW) return 'dirty';
  return STATS.every((k) => s[k] >= 60) ? 'happy' : 'ok';
}

export interface ShopItem {
  id: FoodId | ToyId | AccessoryId | DecorId;
  type: 'food' | 'toy' | 'accessory' | 'room';
  name: string;
  price: number;
  count?: number;
  /** 片方だけ向け */
  kind?: Kind;
}

export const SHOP: ShopItem[] = [
  { id: 'dogfood', type: 'food', name: 'ドッグフード', price: 200, count: 5, kind: 'dog' },
  { id: 'catfood', type: 'food', name: 'キャットフード', price: 200, count: 5, kind: 'cat' },
  { id: 'treat', type: 'food', name: 'おやつ', price: 300, count: 5 },
  { id: 'ball', type: 'toy', name: 'ボール', price: 500 },
  { id: 'frisbee', type: 'toy', name: 'フリスビー', price: 800, kind: 'dog' },
  { id: 'wand', type: 'toy', name: 'ねこじゃらし', price: 500, kind: 'cat' },
  { id: 'mouse', type: 'toy', name: 'ねずみの おもちゃ', price: 600, kind: 'cat' },
  { id: 'collar-red', type: 'accessory', name: 'あかい くびわ', price: 600 },
  { id: 'collar-blue', type: 'accessory', name: 'あおい くびわ', price: 600 },
  { id: 'ribbon', type: 'accessory', name: 'リボン', price: 800 },
  { id: 'bandana', type: 'accessory', name: 'バンダナ', price: 1000 },
  { id: 'hat', type: 'accessory', name: 'ぼうし', price: 1200 },
  ...DECOR.map((d) => ({ id: d.id, type: 'room' as const, name: d.name, price: d.price }))
];

export const itemName = (id: ShopItem['id']) => SHOP.find((i) => i.id === id)?.name ?? '';

export function buy(save: Save, id: ShopItem['id']): 'ok' | 'money' | 'owned' {
  const item = SHOP.find((i) => i.id === id);
  if (!item) return 'owned';
  if (item.type === 'room') return buyDecor(save, id as DecorId);
  if (item.type === 'toy' && save.toys.includes(id as ToyId)) return 'owned';
  if (item.type === 'accessory' && save.accessories.includes(id as AccessoryId)) return 'owned';
  if (save.money < item.price) return 'money';
  save.money -= item.price;
  if (item.type === 'food') save.food[id as FoodId] += item.count ?? 1;
  else if (item.type === 'toy') save.toys.push(id as ToyId);
  else save.accessories.push(id as AccessoryId);
  return 'ok';
}

/** 買った部位はすぐ部屋に使う */
function buyDecor(save: Save, id: DecorId): 'ok' | 'money' | 'owned' {
  const item = DECOR.find((d) => d.id === id)!;
  const gain = decorGain(save.decor, item);
  if (!gain.length) return 'owned';
  const price = decorPrice(save.decor, item);
  if (save.money < price) return 'money';
  save.money -= price;
  save.decor.push(...gain);
  for (const part of item.part ? [item.part] : ROOM_PARTS) save.room[part] = item.theme;
  return 'ok';
}

export interface Trick {
  id: TrickId;
  dog: string;
  /** 猫の呼び名。猫が覚えない芸には無い */
  cat?: string;
  action: PetAction;
  /** 覚えきるまでにほめる回数 */
  steps: number;
  /** 猫が覚えきるまでの回数。無ければ steps */
  catSteps?: number;
}

export const TRICKS: Trick[] = [
  { id: 'sit', dog: 'おすわり', cat: 'おすわり', action: 'sit', steps: 4 },
  { id: 'down', dog: 'ふせ', cat: 'ふせ', action: 'down', steps: 5 },
  { id: 'paw', dog: 'おて', cat: 'ねこパンチ', action: 'paw', steps: 5 },
  { id: 'roll', dog: 'ごろん', cat: 'ごろん', action: 'roll', steps: 6 },
  { id: 'jump', dog: 'ジャンプ', cat: 'ジャンプ', action: 'jump', steps: 5 },
  { id: 'beg', dog: 'ちんちん', action: 'beg', steps: 6 },
  { id: 'spin', dog: 'おまわり', cat: 'くるりん', action: 'spin', steps: 5, catSteps: 7 },
  { id: 'high', dog: 'ハイタッチ', cat: 'ハイタッチ', action: 'high', steps: 6, catSteps: 8 },
  { id: 'bow', dog: 'おじぎ', cat: 'のびー', action: 'bow', steps: 5, catSteps: 7 },
  { id: 'dead', dog: 'しんだふり', action: 'dead', steps: 6 }
];

const trickOf = (id: TrickId) => TRICKS.find((t) => t.id === id) ?? TRICKS[0];

/** その種類が覚えられる芸。猫は犬より少ない */
export const tricksFor = (kind: Kind) => TRICKS.filter((t) => kind === 'dog' || t.cat);

export const trickName = (t: Trick, kind: Kind) => (kind === 'dog' ? t.dog : (t.cat ?? t.dog));

export const trickSteps = (t: Trick, kind: Kind) => (kind === 'cat' ? (t.catSteps ?? t.steps) : t.steps);

/** 覚えた度合い 0..1 */
export function trickProgress(pet: Pet, trick: TrickId): number {
  return Math.min(1, (pet.tricks[trick] ?? 0) / trickSteps(trickOf(trick), kindOf(pet.breed)));
}

/** 覚えはじめでも 3 回に 1 回は成功し、ほめるほど上がる。覚えきればほぼ失敗しない。猫が覚えない芸はできない */
export function trickChance(pet: Pet, trick: TrickId): number {
  if (!tricksFor(kindOf(pet.breed)).some((t) => t.id === trick)) return 0;
  const p = trickProgress(pet, trick);
  if (p >= 1) return 0.95;
  const sleepy = pet.stats.energy < SLEEPY ? 0.1 : 0;
  return clamp(0.3 + 0.5 * p + 0.02 * hearts(pet) - sleepy, 0.1, 0.9);
}

/** 成功した直後にほめたとき。覚えきった瞬間だけ learned。お金は画面が TRICK_REWARD を足す */
export function praise(pet: Pet, trick: TrickId): { learned: boolean } {
  grow(pet, 0.05);
  const steps = trickSteps(trickOf(trick), kindOf(pet.breed));
  const count = pet.tricks[trick] ?? 0;
  if (count >= steps) return { learned: false };
  pet.tricks[trick] = count + 1;
  return { learned: count + 1 >= steps };
}

export type Present = { money: number } | { food: FoodId; count: number } | { item: ShopItem };

/** プレゼント 1 つでおみせの品が出る割合。道に 3 つあるおさんぽ 1 回で 1 割ほど */
const RARE = 0.035;
/** おみせの品を全部持っているときに、代わりに出すコイン */
const RARE_MONEY = 150;

/**
 * おさんぽ・公園のプレゼントの中身を決めて save に足す。ごはんとおやつが中心で、コインは少し。
 * 公園では見ているだけでも拾うので、稼ぎの中心はコンテスト・芸・おこづかいに残す。
 * まれに、まだ持っていないおもちゃかアクセサリー（いる種類のペット向け）がただで出る
 */
export function findPresent(save: Save, rng: () => number): Present {
  const r = rng();
  const kinds = save.pets.map((p) => kindOf(p.breed));
  if (r < RARE) {
    const left = SHOP.filter(
      (i) =>
        (i.type === 'toy'
          ? !save.toys.includes(i.id as ToyId)
          : i.type === 'accessory' && !save.accessories.includes(i.id as AccessoryId)) &&
        (!i.kind || kinds.includes(i.kind))
    );
    const item = left[Math.floor(rng() * left.length)];
    if (!item) {
      save.money += RARE_MONEY;
      return { money: RARE_MONEY };
    }
    if (item.type === 'toy') save.toys.push(item.id as ToyId);
    else save.accessories.push(item.id as AccessoryId);
    return { item };
  }
  if (r < RARE + 0.25) {
    const money = [30, 50, 50, 80][Math.floor(rng() * 4)];
    save.money += money;
    return { money };
  }
  const kind = kinds[Math.floor(rng() * kinds.length)] ?? 'dog';
  const food: FoodId = rng() < 0.5 ? 'treat' : kind === 'dog' ? 'dogfood' : 'catfood';
  const count = 2 + Math.floor(rng() * 2);
  save.food[food] += count;
  return { food, count };
}

export function addPhoto(save: Save, url: string): void {
  save.photos = [url, ...save.photos].slice(0, MAX_PHOTOS);
}
