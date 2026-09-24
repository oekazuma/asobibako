import { CONTEST_RANKS, SLEEPY, TRICKS, kindOf, type Pet, type Save } from './engine';
import type { Layout, Spot } from './layout';
import type { ContestId, Kind, TrickId } from './types';

/**
 * コンテストの決まりごと（点・順位・賞金・階級・ほかの出場者の作り点・アジリティのコース）。
 * DOM も three も使わない。会場の 3D は scene-contest.ts、進行は contest-play.svelte.ts
 */

export const RANKS = ['ビギナー', 'オープン', 'エキスパート', 'マスター', 'チャンピオン'] as const;
/** 階級ごとのトロフィーと札の色（銅・銀・金・プラチナ・クリスタル） */
export const RANK_COLOR = ['#c27a45', '#c7ccd4', '#e9b93c', '#8fb8e8', '#e58ad0'] as const;

export interface Contest {
  id: ContestId;
  name: string;
  kinds: Kind[];
  /** 点の単位。アジリティだけタイムで、少ないほどよい */
  unit: 'てん' | 'かい' | 'びょう';
  lower: boolean;
  /** 制限時間（秒）。しつけ大会はラウンドで進むので使わない */
  seconds: number;
  how: string;
}

export const CONTESTS: Contest[] = [
  {
    id: 'frisbee',
    name: 'フリスビー',
    kinds: ['dog'],
    unit: 'てん',
    lower: false,
    seconds: 45,
    how: 'フリスビーを ゆびで はじいて なげよう。とおくで とるほど、くうちゅうで とると もっと たかい てん'
  },
  {
    id: 'wand',
    name: 'ねこじゃらし',
    kinds: ['cat'],
    unit: 'かい',
    lower: false,
    seconds: 40,
    how: 'ねこじゃらしを ゆびで うごかそう。とびついた かいすうで きそうよ'
  },
  {
    id: 'agility',
    name: 'アジリティ',
    kinds: ['dog', 'cat'],
    unit: 'びょう',
    lower: true,
    seconds: 60,
    how: 'いきたい ところを ゆびで さそう。やじるしの じゅんに ハードル・トンネル・ポールを とおって ゴールへ'
  },
  {
    id: 'obedience',
    name: 'しつけ',
    kinds: ['dog', 'cat'],
    unit: 'てん',
    lower: false,
    seconds: 0,
    how: 'しんぱんが いった げいの ボタンを すぐに おそう。おぼえた げいほど じょうずに できるよ'
  }
];

export const contestOf = (id: ContestId): Contest => CONTESTS.find((c) => c.id === id) ?? CONTESTS[0];

/** 出るのにいるげんきと、出ると減るげんき。出たあとも眠くならない（SLEEPY より上に残る）ように決めてある */
export const ENTRY_COST = 20;
export const ENTRY_ENERGY = SLEEPY + ENTRY_COST + 5;

export function entry(pet: Pet, id: ContestId): 'ok' | 'kind' | 'tired' {
  if (!contestOf(id).kinds.includes(kindOf(pet.breed))) return 'kind';
  return pet.stats.energy < ENTRY_ENERGY ? 'tired' : 'ok';
}

/** いま出られるいちばん上の階級 */
export const topRank = (save: Save, id: ContestId): number => Math.min(save.contest[id], CONTEST_RANKS - 1);

/** 1 位の賞金。おみせは 200〜1200 コイン、おこづかいは 1 日 500 コイン。上の階級ほど大きく伸ばして目標にする */
export const PRIZE = [600, 1200, 2000, 3500, 5000];
const SHARE = [1, 0.5, 0.25, 0.1];

export function prize(rank: number, place: number): number {
  return Math.round(PRIZE[rank] * (SHARE[place - 1] ?? SHARE[SHARE.length - 1]));
}

/**
 * 賞金を足し、いまの階級で 1 位なら次の階級を開けてトロフィーを増やす（棚はとった階級の数だけ並ぶ）。
 * 前に勝った階級でもう一度 1 位になっても、賞金だけ
 */
export function award(
  save: Save,
  id: ContestId,
  rank: number,
  place: number
): { money: number; trophy: boolean; next: number | null } {
  // 勝ち越した階級の出直しで稼ぎ続けられると、おこづかい（1 日 500）やおみせの値段と釣り合わなくなる
  const money = rank < save.contest[id] ? Math.round(prize(rank, place) / 2) : prize(rank, place);
  save.money += money;
  const trophy = place === 1 && save.contest[id] === rank;
  if (trophy) save.contest[id] = rank + 1;
  return { money, trophy, next: trophy && rank + 1 < CONTEST_RANKS ? rank + 1 : null };
}

/**
 * ほかの出場者の点の幅（階級ごと）。子どもが最初の挑戦でビギナーに勝てるくらいから始め、
 * チャンピオンは上手に遊んでやっと届く
 */
export const RIVALS: Record<ContestId, [number, number][]> = {
  // 45 秒で 4〜6 回投げられ、1 回は 50〜90 点ほど
  frisbee: [
    [60, 150],
    [140, 230],
    [220, 310],
    [300, 380],
    [370, 450]
  ],
  wand: [
    [3, 6],
    [5, 8],
    [7, 10],
    [9, 12],
    [11, 14]
  ],
  // 休んだペットで門を 1 つもやり直さずに走ると 8 秒ほど。指でさして走らせる子どもには、その 1.5 倍でも速い
  agility: [
    [22, 32],
    [18, 25],
    [15, 20],
    [13, 17],
    [11, 14]
  ],
  // 覚えていない芸は 3 回に 1 回しかできないので、ビギナーはしつける前でも勝てることがある幅にする
  obedience: [
    [8, 30],
    [25, 50],
    [42, 68],
    [58, 80],
    [72, 94]
  ]
};

const NAMES: Record<Kind, string[]> = {
  dog: [
    'ハナ',
    'コタロウ',
    'モモ',
    'ソラ',
    'チョコ',
    'マロン',
    'ハチ',
    'ココ',
    'リキ',
    'ムギ',
    'サクラ',
    'ゴン',
    'ジロウ'
  ],
  cat: [
    'タマ',
    'クロ',
    'シロ',
    'トラ',
    'ルナ',
    'レオ',
    'キナコ',
    'ミルク',
    'ミー',
    'チャチャ',
    'コテツ',
    'ハナ',
    'モモ'
  ]
};

export interface Entry {
  name: string;
  score: number;
  you: boolean;
}

/** ほかの 3 匹。名前はペットと同じ種類から、自分の名前とかぶらないように選ぶ */
export function rivals(id: ContestId, rank: number, kind: Kind, avoid: string, rng: () => number): Entry[] {
  const pool = NAMES[kind].filter((n) => n !== avoid);
  const [lo, hi] = RIVALS[id][rank];
  const out: Entry[] = [];
  for (let i = 0; i < 3; i++) {
    const name = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    const raw = lo + (hi - lo) * rng();
    out.push({ name, score: id === 'agility' ? Math.round(raw * 10) / 10 : Math.round(raw), you: false });
  }
  return out;
}

/** よい順。同じ点なら自分を上にする */
export function standings(entries: Entry[], lower: boolean): Entry[] {
  return [...entries].sort((a, b) => (lower ? a.score - b.score : b.score - a.score) || Number(b.you) - Number(a.you));
}

export function scoreText(id: ContestId, score: number): string {
  return id === 'agility' ? `${score.toFixed(1)}びょう` : `${score}${contestOf(id).unit}`;
}

/** フリスビー 1 投の点。front からの距離（メートル）と、空中でとったか */
export function throwPoints(meters: number, air: boolean): number {
  return Math.round(Math.max(0, meters) * 10) + (air ? 30 : 0);
}

/** しつけ大会の 1 問の点。できたら 10 点、言われてから 1 秒以内なら 20 点まで上がる */
export function trickPoints(ok: boolean, seconds: number): number {
  if (!ok) return 0;
  return 10 + Math.round(10 * Math.min(1, Math.max(0, (4 - seconds) / 3)));
}

export const OBEDIENCE_ROUNDS = 5;

/** しつけ大会で審判が言う芸。同じ芸は続けない */
export function orders(rng: () => number, n = OBEDIENCE_ROUNDS): TrickId[] {
  const out: TrickId[] = [];
  while (out.length < n) {
    const t = TRICKS[Math.floor(rng() * TRICKS.length)].id;
    if (t !== out[out.length - 1]) out.push(t);
  }
  return out;
}

// --- 会場とアジリティのコース（メートル。x が右、z が手前） ---

export const ARENA: Layout = {
  bounds: { x0: -3.3, x1: 3.3, z0: -11, z1: 1.2 },
  front: { x: 0, z: 0.9 },
  blocks: [],
  camera: { x: 0, y: 0.95, z: 2.9, lookX: 0, lookY: 0.25, lookZ: -0.6, fov: 44 }
};

export type GateKind = 'hurdle' | 'tunnel' | 'poles' | 'goal';

/** a から b への線分を横切ると通ったことになる */
export interface Gate {
  kind: GateKind;
  a: Spot;
  b: Spot;
}

export const GATE_NAME: Record<GateKind, string> = {
  hurdle: 'ハードル',
  tunnel: 'トンネル',
  poles: 'ポール',
  goal: 'ゴール'
};

/**
 * コースはぜんぶ奥へ向かって進む。カメラはペットのうしろから奥を向いて追うので、
 * 手前へ戻る門を置くと、指でさす先がカメラのうしろになってしまう
 */
/** トンネルは z にそって置く。中にいるあいだは伏せて進む */
export const TUNNEL = { x: -1.2, z0: -3.6, z1: -2.0, r: 0.3 };
/**
 * ポールは奥へ一列。1 本めは左、2 本めは右…と、ポールの外側を交互に抜ける。
 * 門はポールから抜ける側へのばした線分なので、反対側を大きく回っても数えない
 */
export const POLES = { x: 0.3, zs: [-4.4, -5.4, -6.4, -7.4] };

export const COURSE: Gate[] = [
  { kind: 'hurdle', a: { x: -0.55, z: -0.8 }, b: { x: 0.55, z: -0.8 } },
  { kind: 'tunnel', a: { x: TUNNEL.x - TUNNEL.r, z: -2.8 }, b: { x: TUNNEL.x + TUNNEL.r, z: -2.8 } },
  ...POLES.zs.map((z, i): Gate => {
    // ポールのすぐ内側（20cm）をかすめても通ったことにする。指でさして走らせると、ぴったり外側は難しい
    const side = i % 2 ? 1 : -1;
    return { kind: 'poles', a: { x: POLES.x - side * 0.2, z }, b: { x: POLES.x + side * 1.4, z } };
  }),
  { kind: 'hurdle', a: { x: 0.45, z: -8.6 }, b: { x: 1.55, z: -8.6 } },
  { kind: 'goal', a: { x: -0.6, z: -9.9 }, b: { x: 1.2, z: -9.9 } }
];

export const inTunnel = (p: Spot): boolean => Math.abs(p.x - TUNNEL.x) < TUNNEL.r && p.z > TUNNEL.z0 && p.z < TUNNEL.z1;

const cross = (o: Spot, a: Spot, b: Spot) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);

/** p から q へ動いたあいだに、門の線分をまたいだか */
export function crossed(p: Spot, q: Spot, g: Gate): boolean {
  const d1 = cross(g.a, g.b, p);
  const d2 = cross(g.a, g.b, q);
  const d3 = cross(p, q, g.a);
  const d4 = cross(p, q, g.b);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** 門の線分までの距離 */
export function gateDistance(p: Spot, g: Gate): number {
  const dx = g.b.x - g.a.x;
  const dz = g.b.z - g.a.z;
  const t = Math.min(1, Math.max(0, ((p.x - g.a.x) * dx + (p.z - g.a.z) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p.x - g.a.x - dx * t, p.z - g.a.z - dz * t);
}

/** アジリティのタイム。時間内にゴールできなければ、残した門 1 つにつき 5 秒足す */
export function agilityTime(seconds: number, left: number): number {
  const t = left > 0 ? contestOf('agility').seconds + 5 * left : seconds;
  return Math.round(t * 10) / 10;
}
