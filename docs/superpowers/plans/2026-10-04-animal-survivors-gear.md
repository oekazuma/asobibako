# Animal Survivors 装備とガチャ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 回の中で拾うガチャ券とコインで引くガチャから、3 か所につける装備（18 種 × レア度 3 段）を手に入れ、能力と特別な効き目で回をまたいで強くなれるようにする。

**Architecture:** 品の表と能力・効き目の計算は `gear.ts`、持ち物・券・天井・合成・売る・つけるは `gacha.ts`（記録の 4 つの項目を読み書きする純粋な関数）に置く。`createWorld` は `Options.gear`（つけている品の鍵）を受けて能力を `boost` に足し、効き目の数を `World.fx` に置き、各ファイルの差しこみ口がそれを読む。券は `drops.ts` の品（`ticket`）として落ち、`summary`・`overtimeRun` が持ち帰る分と失う分に分けて `record()` が足す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest（unit は node、`*.svelte.test.ts` は happy-dom）、scratchpad のボットとドット絵の道具

**Spec:** `docs/superpowers/specs/2026-10-04-animal-survivors-gear-design.md`

## Global Constraints

- 券は 3 種類。銅 80・17・3%、銀 0・85・15%、金 0・50・50%（ふつう・レア・伝説）。
- 9:00 のステージの主は毎回 1 枚、ボスとヌシは 1/4 で券を落とす。券の種類は釜 2.0 以下は銅だけ、9.0 で銅 30%・銀 50%・金 20%、そのあいだは直線。
- 券はクリアと延長戦の引き上げで持ち帰り、倒れたとき・やめる・やり直しでは失う。
- コインで 1 回 500 枚、10 連 4500 枚（1 つ以上はレア以上）。天井 50 回。持ち物 40 個まで。
- 合成は同じ品・同じレア度 3 つで 1 段上（伝説は合成できない）。売ると 50・200・800 枚。
- 能力の量は、伝説が店のその品の最大の半分、レアは 0.65 倍、ふつうは 0.4 倍。効き目は伝説がレアの 2 倍、ふつうは無し。
- お題のしばり「店の強化なし」の日は装備も効かない。
- 絵は使う前に見本を見せる。12 ドットのアイコン。レア度は枠の色（白・青・金）。
- コンポーネントは 200 行未満。コメントは非自明な WHY だけ。`pnpm verify` が通ること。
- 新しい乱数は `w.rand` から引かず、`World.loot`（別の種）から引く（同じ種の回の流れを変えないため）。

## Review Focus

- 持ち物が 38 個のときの 10 連は、何も払わずに断る（途中まで引いて払わない）。Task 3 のテストで固める。
- つけている品を売る・合成で数が 0 になると、その場所は空く（無い品をつけたままにしない）。Task 3 のテストで固める。
- 延長戦で倒れても、10:00 のクリアで持ち帰った券は残り、延長戦のぶんだけ失う。リザルトの「持ち帰れなかった」は延長戦のぶんだけ。Task 5 のテストで固める。
- 古い保存（装備の項目が無い・型が壊れている・知らない品の鍵）は空で読み、知らない鍵は捨てる。Task 3 のテストで固める。
- 耐火のマントの伝説で溶岩のダメージが 0 のとき、HP も無敵も変えず、被弾の点滅も出さない。不死鳥の羽根は 1 回だけ。Task 4 のテストで固める。

## File Structure

| ファイル                                                                                                                          | 役目                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `gear.ts`（新しい）                                                                                                               | 品の表 `GEAR`、鍵 `GearKey`、量 `statAmount`・`fxAmount`、文 `statText`・`fxText`、つけた品から `gearOf()`                            |
| `gacha.ts`（新しい）                                                                                                              | 券の割合・釜からの券、持ち物の数、`pull`・`merge`・`sell`・`equip`・`wornKeys`、記録の読み `gearRecords`                              |
| `art/gear.ts`（新しい）                                                                                                           | 18 種のアイコンと 3 種の券（`GEAR_ART`）                                                                                              |
| `records.ts`                                                                                                                      | `bag`・`worn`・`tickets`・`pity` を持ち、読み、`record()` で券を足す                                                                  |
| `world.ts`                                                                                                                        | `Options.gear`、`World.fx`・`worn`・`tickets`・`loot`、ボスへの攻撃、`hurtPlayer` の出どころと軽くする量、羽根の起き上がり、`summary` |
| `arms.ts`・`drops.ts`・`chest.ts`・`choices.ts`・`bosses.ts`・`bosses-snow.ts`・`eruption.ts`・`overtime.ts`・`draw.ts`           | 効き目の差しこみ口と、券の落ち方・拾い方・描き方                                                                                      |
| `GearIcon.svelte`・`GearRow.svelte`・`GearDetail.svelte`・`Bag.svelte`・`Gear.svelte`・`Gacha.svelte`・`Capsule.svelte`（新しい） | 装備の画面とガチャ                                                                                                                    |
| `RunKit.svelte`（新しい）                                                                                                         | リザルトの札・装備・券の列（Result.svelte を 200 行未満に保つため、今の ArcanaRow の行と入れ替える）                                  |
| `CharSelect.svelte`・`Survivors.svelte`・`Pause.svelte`・`Result.svelte`                                                          | 入り口と見せる場所                                                                                                                    |

---

### Task 1: 絵の見本（利用者に見せて止まる）

**Files:**

- Create: `src/lib/games/animal-survivors/art/gear.ts`
- Test: `src/lib/games/animal-survivors/pixels.test.ts`（今の、表の幅・行数を確かめるテストに `GEAR_ART` を足す）

- [ ] **Step 1:** scratchpad の道具（`chick/g.py` の G、`sheet.py`）で、18 種のアイコン（12 × 12）と銅・銀・金の券（12 × 8）を描く。品は表の順（ハチマキ・ゴーグル・麦わら帽子・とんがり帽子・鬼のツノ・花の冠・よろい・マフラー・マント・スカーフ・葉っぱの服・甲羅・招き猫・四つ葉・ふくろう・首飾り・砂時計・羽根）。白・青・金の枠に入れて 4 倍で並べた PNG を `SendUserFile` で見せ、利用者の返事を待つ。直しを言われたら描き直して見せ直す。
- [ ] **Step 2:** 決まった絵を `art/gear.ts` に `export const GEAR_ART: Record<string, Art>` として入れる。名前は品の id（`hachimaki` など）と `ticket0`・`ticket1`・`ticket2`。色は `art/palette.ts` の文字だけを使う。
- [ ] **Step 3:** `pixels.test.ts` の表を回すテストに `GEAR_ART` を足し、`pnpm exec vitest run src/lib/games/animal-survivors/pixels.test.ts` が通ることを確かめる。
- [ ] **Step 4: Commit** `git add src/lib/games/animal-survivors/art/gear.ts src/lib/games/animal-survivors/pixels.test.ts && git commit -m "Draw Animal Survivors' gear icons and gacha tickets"`（署名の行を付ける）

### Task 2: 品の表と能力・効き目

**Files:**

- Create: `src/lib/games/animal-survivors/gear.ts`
- Test: `src/lib/games/animal-survivors/gear.test.ts`

**Interfaces:**

- Produces:
  - `type Slot = 'head' | 'body' | 'charm'`、`type Rarity = 0 | 1 | 2`、`type GearId`（18 種）、`type GearKey = \`${GearId}:${Rarity}\``
  - `type FxKey = 'bossDmg' | 'critDmg' | 'gemReach' | 'fourth' | 'oni' | 'loot' | 'bossGuard' | 'wind' | 'lavaGuard' | 'invuln' | 'meat' | 'shell' | 'gold' | 'chest' | 'grow' | 'magnetLoot' | 'freeze' | 'feather'`、`type GearFx = Record<FxKey, number>`
  - `interface GearDef { id: GearId; name: string; slot: Slot; stat: StatKey | 'greed'; amount: number; fx: FxKey; fxRare: number; fxText: (v: number) => string }`
  - `GEAR: GearDef[]`、`SLOTS: Slot[]`、`SLOT_NAME: Record<Slot, string>`、`RARITY_NAME`、`gearDef(id)`、`keyOf(id, rarity): GearKey`、`parseKey(k: string): { def: GearDef; rarity: Rarity } | null`
  - `noFx(): GearFx`、`statAmount(def, rarity): number`、`fxAmount(def, rarity): number`、`statText(def, rarity): string`、`fxText(def, rarity): string | null`
  - `gearOf(keys: GearKey[]): { boost: Partial<Stats>; greed: number; fx: GearFx }`、`addBoost(a: Partial<Stats>, b: Partial<Stats>): Partial<Stats>`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { fxAmount, fxText, GEAR, gearDef, gearOf, keyOf, parseKey, SLOTS, statAmount, statText } from './gear';

describe('装備の表', () => {
  it('3 か所に 6 種ずつ、id は重ならない', () => {
    expect(GEAR).toHaveLength(18);
    for (const s of SLOTS) expect(GEAR.filter((g) => g.slot === s)).toHaveLength(6);
    expect(new Set(GEAR.map((g) => g.id)).size).toBe(18);
  });

  it('伝説は店の最大の半分、レアは 0.65 倍、ふつうは 0.4 倍', () => {
    const h = gearDef('hachimaki');
    expect(statAmount(h, 2)).toBeCloseTo(0.125);
    expect(statAmount(h, 1)).toBeCloseTo(0.125 * 0.65);
    expect(statAmount(h, 0)).toBeCloseTo(0.05);
  });

  it('効き目はふつうに無く、伝説はレアの 2 倍', () => {
    const h = gearDef('hachimaki');
    expect(fxAmount(h, 0)).toBe(0);
    expect(fxAmount(h, 1)).toBeCloseTo(0.15);
    expect(fxAmount(h, 2)).toBeCloseTo(0.3);
    expect(fxText(h, 0)).toBe(null);
    expect(fxText(h, 2)).toBe('ボスとヌシへの攻撃 +30%');
  });

  it('能力の文は割合と数を分けて書く', () => {
    expect(statText(gearDef('hachimaki'), 0)).toBe('攻撃 +5%');
    expect(statText(gearDef('muffler'), 2)).toBe('最大 HP +25');
    expect(statText(gearDef('knight'), 2)).toBe('防御 +1.5');
  });

  it('鍵は品とレア度で、知らない鍵は読まない', () => {
    expect(keyOf('owl', 1)).toBe('owl:1');
    expect(parseKey('owl:1')?.def.id).toBe('owl');
    expect(parseKey('owl:3')).toBe(null);
    expect(parseKey('dragon:1')).toBe(null);
  });

  it('つけた品の能力・コイン・効き目を足し合わせる', () => {
    const g = gearOf(['hachimaki:2', 'knight:1', 'cat:2']);
    expect(g.boost.might).toBeCloseTo(0.125);
    expect(g.boost.armor).toBeCloseTo(1.5 * 0.65);
    expect(g.greed).toBeCloseTo(0.25);
    expect(g.fx.bossDmg).toBeCloseTo(0.3);
    expect(g.fx.bossGuard).toBeCloseTo(0.15);
    expect(g.fx.gold).toBeCloseTo(2);
    expect(g.fx.feather).toBe(0);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gear.test.ts`
Expected: FAIL（`./gear` が無い）

- [ ] **Step 3: 実装する**

```ts
import type { StatKey, Stats } from './passives';

export type Slot = 'head' | 'body' | 'charm';
export type Rarity = 0 | 1 | 2;
export type GearId =
  | 'hachimaki'
  | 'goggles'
  | 'straw'
  | 'wizard'
  | 'oni'
  | 'flower'
  | 'knight'
  | 'muffler'
  | 'cloak'
  | 'scarf'
  | 'leaf'
  | 'shell'
  | 'cat'
  | 'clover'
  | 'owl'
  | 'necklace'
  | 'hourglass'
  | 'feather';
export type GearKey = `${GearId}:${Rarity}`;
export type FxKey =
  | 'bossDmg'
  | 'critDmg'
  | 'gemReach'
  | 'fourth'
  | 'oni'
  | 'loot'
  | 'bossGuard'
  | 'wind'
  | 'lavaGuard'
  | 'invuln'
  | 'meat'
  | 'shell'
  | 'gold'
  | 'chest'
  | 'grow'
  | 'magnetLoot'
  | 'freeze'
  | 'feather';
export type GearFx = Record<FxKey, number>;

/** amount は伝説の能力の量（店のその品の最大の半分）。fxRare はレアの効き目の量で、伝説は 2 倍 */
export interface GearDef {
  id: GearId;
  name: string;
  slot: Slot;
  stat: StatKey | 'greed';
  amount: number;
  fx: FxKey;
  fxRare: number;
  fxText: (v: number) => string;
}

export const SLOTS: Slot[] = ['head', 'body', 'charm'];
export const SLOT_NAME: Record<Slot, string> = { head: 'あたま', body: 'からだ', charm: 'おまもり' };
export const RARITY_NAME = ['ふつう', 'レア', '伝説'] as const;
const SCALE = [0.4, 0.65, 1];

const pct = (v: number) => `${Math.round(v * 100)}%`;
const g = (
  id: GearId,
  name: string,
  slot: Slot,
  stat: GearDef['stat'],
  amount: number,
  fx: FxKey,
  fxRare: number,
  fxText: (v: number) => string
): GearDef => ({ id, name, slot, stat, amount, fx, fxRare, fxText });

export const GEAR: GearDef[] = [
  g('hachimaki', '勇者のハチマキ', 'head', 'might', 0.125, 'bossDmg', 0.15, (v) => `ボスとヌシへの攻撃 +${pct(v)}`),
  g('goggles', '鷹のゴーグル', 'head', 'crit', 0.05, 'critDmg', 0.25, (v) => `会心のダメージ +${pct(v)}`),
  g('straw', '麦わら帽子', 'head', 'area', 0.12, 'gemReach', 0.2, (v) => `経験値の玉を拾う範囲 +${pct(v)}`),
  g('wizard', 'とんがり帽子', 'head', 'duration', 0.125, 'fourth', 0.1, (v) => `3 択が 4 択になる割合 +${pct(v)}`),
  g('oni', '鬼のツノ', 'head', 'might', 0.125, 'oni', 0.15, (v) => `HP が半分より下のあいだ攻撃 +${pct(v)}`),
  g('flower', '花の冠', 'head', 'luck', 0.125, 'loot', 0.5, (v) => `ランタンから十字架・時計・金の磁石 +${pct(v)}`),
  g(
    'knight',
    '騎士のよろい',
    'body',
    'armor',
    1.5,
    'bossGuard',
    0.15,
    (v) => `ボスとヌシから受けるダメージ −${pct(v)}`
  ),
  g('muffler', '毛糸のマフラー', 'body', 'maxHp', 25, 'wind', 0.5, (v) => `吹雪で流される量 −${pct(v)}`),
  g('cloak', '耐火のマント', 'body', 'maxHp', 25, 'lavaGuard', 0.5, (v) => `溶岩の池のダメージ −${pct(v)}`),
  g('scarf', '風のスカーフ', 'body', 'speed', 0.1, 'invuln', 0.3, (v) => `当たったあとの無敵 +${v} 秒`),
  g('leaf', '葉っぱの服', 'body', 'regen', 0.25, 'meat', 0.5, (v) => `肉で戻る HP +${pct(v)}`),
  g('shell', '甲羅', 'body', 'armor', 1.5, 'shell', 0.25, (v) => `飛んでくる攻撃のダメージ −${pct(v)}`),
  g('cat', '招き猫', 'charm', 'greed', 0.25, 'gold', 1, (v) => `金の磁石が出る割合 ${v + 1} 倍`),
  g(
    'clover',
    '四つ葉のお守り',
    'charm',
    'luck',
    0.125,
    'chest',
    0.1,
    (v) => `宝箱の中身が 3 つ以上になる割合 +${pct(v)}`
  ),
  g('owl', '知恵のふくろう', 'charm', 'growth', 0.125, 'grow', 1, (v) => `育つ Lv が ${v} 早い`),
  g(
    'necklace',
    '磁石の首飾り',
    'charm',
    'magnet',
    0.25,
    'magnetLoot',
    1,
    (v) => `ランタンから磁石が出る割合 ${v + 1} 倍`
  ),
  g('hourglass', '砂時計', 'charm', 'duration', 0.125, 'freeze', 3, (v) => `時計で止まる時間 +${v} 秒`),
  g(
    'feather',
    '不死鳥の羽根',
    'charm',
    'regen',
    0.25,
    'feather',
    0.25,
    (v) => `倒れたとき 1 回だけ HP ${pct(v)} で起き上がる`
  )
];

export const gearDef = (id: GearId) => GEAR.find((d) => d.id === id)!;
export const keyOf = (id: GearId, r: Rarity) => `${id}:${r}` as GearKey;

export function parseKey(k: string): { def: GearDef; rarity: Rarity } | null {
  const [id, r] = k.split(':');
  const def = GEAR.find((d) => d.id === id);
  const rarity = Number(r);
  return def && (rarity === 0 || rarity === 1 || rarity === 2) ? { def, rarity } : null;
}

export function noFx(): GearFx {
  return Object.fromEntries(GEAR.map((d) => [d.fx, 0])) as GearFx;
}

export const statAmount = (d: GearDef, r: Rarity) => d.amount * SCALE[r];
export const fxAmount = (d: GearDef, r: Rarity) => (r === 0 ? 0 : d.fxRare * r);

const LABEL: Record<GearDef['stat'], string> = {
  might: '攻撃',
  crit: '会心',
  area: '攻撃の範囲',
  duration: '効く時間',
  luck: '運',
  maxHp: '最大 HP',
  armor: '防御',
  speed: '速さ',
  regen: '毎秒の回復',
  magnet: '拾う範囲',
  growth: '経験値',
  greed: 'コイン',
  haste: '攻撃の間',
  amount: '数'
};
const PLAIN = new Set<GearDef['stat']>(['maxHp', 'armor', 'regen', 'amount']);

export function statText(d: GearDef, r: Rarity): string {
  const v = statAmount(d, r);
  return `${LABEL[d.stat]} +${PLAIN.has(d.stat) ? Math.round(v * 100) / 100 : pct(v)}`;
}

export const fxText = (d: GearDef, r: Rarity) => (r === 0 ? null : d.fxText(fxAmount(d, r)));

export function addBoost(a: Partial<Stats>, b: Partial<Stats>): Partial<Stats> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b) as [keyof Stats, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}

export function gearOf(keys: GearKey[]): { boost: Partial<Stats>; greed: number; fx: GearFx } {
  const out = { boost: {} as Partial<Stats>, greed: 0, fx: noFx() };
  for (const k of keys) {
    const p = parseKey(k);
    if (!p) continue;
    const v = statAmount(p.def, p.rarity);
    if (p.def.stat === 'greed') out.greed += v;
    else out.boost[p.def.stat] = (out.boost[p.def.stat] ?? 0) + v;
    out.fx[p.def.fx] += fxAmount(p.def, p.rarity);
  }
  return out;
}
```

（`fxAmount` の `d.fxRare * r` は、レア 1 で 1 倍・伝説 2 で 2 倍になる。prettier が整える）

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gear.test.ts`
Expected: PASS（6 件）

- [ ] **Step 5: Commit** `git add src/lib/games/animal-survivors/gear.ts src/lib/games/animal-survivors/gear.test.ts && git commit -m "Add Animal Survivors' gear table"`

### Task 3: 持ち物・券・ガチャ・合成・売る・つける

**Files:**

- Create: `src/lib/games/animal-survivors/gacha.ts`
- Modify: `src/lib/games/animal-survivors/records.ts`（`Records` に 4 つ、`emptyRecords`・`parseRecords`）
- Test: `src/lib/games/animal-survivors/gacha.test.ts`

**Interfaces:**

- Consumes: Task 2 の `GEAR`・`GearKey`・`keyOf`・`parseKey`・`Rarity`・`Slot`・`SLOTS`
- Produces:
  - `Records` に `bag: Partial<Record<GearKey, number>>`、`worn: Record<Slot, GearKey | null>`、`tickets: [number, number, number]`、`pity: number`
  - `type Ticket = 0 | 1 | 2`、`TICKET_NAME`、`ODDS`、`PULL_COINS = 500`、`TEN_COINS = 4500`、`PITY = 50`、`BAG_MAX = 40`、`SELL = [50, 200, 800]`
  - `type PullWay = 'bronze' | 'silver' | 'gold' | 'coin' | 'ten'`
  - `ticketOdds(heat: number): [number, number, number]`、`rollTicket(heat: number, r: number): Ticket`
  - `bagCount(r: Records): number`、`canPull(r: Records, way: PullWay): boolean`、`pull(r: Records, way: PullWay, rand: () => number): GearKey[] | null`
  - `merge(r: Records, key: GearKey): GearKey | null`、`sell(r: Records, key: GearKey): number`、`equip(r: Records, key: GearKey): void`、`wornKeys(r: Records): GearKey[]`
  - `gearRecords(raw: Record<string, unknown>): Pick<Records, 'bag' | 'worn' | 'tickets' | 'pity'>`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import {
  BAG_MAX,
  bagCount,
  canPull,
  equip,
  merge,
  pull,
  PULL_COINS,
  rollTicket,
  sell,
  ticketOdds,
  wornKeys
} from './gacha';
import { emptyRecords, parseRecords } from './records';

const fixed = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe('ガチャ券', () => {
  it('釜 2.0 以下は銅だけ、9.0 は銅 3 割・銀 5 割・金 2 割', () => {
    expect(ticketOdds(1)).toEqual([1, 0, 0]);
    const o = ticketOdds(9);
    expect(o[0]).toBeCloseTo(0.3);
    expect(o[1]).toBeCloseTo(0.5);
    expect(o[2]).toBeCloseTo(0.2);
    expect(rollTicket(9, 0.1)).toBe(0);
    expect(rollTicket(9, 0.5)).toBe(1);
    expect(rollTicket(9, 0.95)).toBe(2);
  });
});

describe('ガチャ', () => {
  it('コインで引くと 500 枚払って持ち物が 1 つ増える', () => {
    const r = { ...emptyRecords(), coins: 600 };
    const got = pull(r, 'coin', fixed(0.5, 0));
    expect(got).toEqual(['hachimaki:0']);
    expect(r.coins).toBe(600 - PULL_COINS);
    expect(r.bag['hachimaki:0']).toBe(1);
    expect(r.pity).toBe(1);
  });

  it('券で引くとその券を 1 枚使い、銀の券はレア以上', () => {
    const r = { ...emptyRecords(), tickets: [0, 1, 0] as [number, number, number] };
    const got = pull(r, 'silver', fixed(0, 0))!;
    expect(got[0].endsWith(':1')).toBe(true);
    expect(r.tickets).toEqual([0, 0, 0]);
    expect(pull(r, 'silver', fixed(0))).toBe(null);
  });

  it('伝説が出ないまま 50 回めは伝説で、天井を数え直す', () => {
    const r = { ...emptyRecords(), coins: 500, pity: 49 };
    const got = pull(r, 'coin', fixed(0, 0))!;
    expect(got[0].endsWith(':2')).toBe(true);
    expect(r.pity).toBe(0);
  });

  it('10 連は 4500 枚で 10 こ、ふつうだけなら最後をレアにする', () => {
    const r = { ...emptyRecords(), coins: 4500 };
    const got = pull(r, 'ten', fixed(0, 0))!;
    expect(got).toHaveLength(10);
    expect(got.filter((k) => !k.endsWith(':0'))).toHaveLength(1);
    expect(r.coins).toBe(0);
  });

  it('持ち物が上限を越える 10 連は何も払わずに断る', () => {
    const r = { ...emptyRecords(), coins: 9999, bag: { 'owl:0': BAG_MAX - 2 } };
    expect(canPull(r, 'ten')).toBe(false);
    expect(pull(r, 'ten', fixed(0))).toBe(null);
    expect(r.coins).toBe(9999);
    expect(bagCount(r)).toBe(BAG_MAX - 2);
  });
});

describe('持ち物', () => {
  it('同じ品・同じレア度 3 つで 1 段上へ。伝説は合成できない', () => {
    const r = { ...emptyRecords(), bag: { 'owl:0': 4, 'owl:2': 3 } };
    expect(merge(r, 'owl:0')).toBe('owl:1');
    expect(r.bag).toEqual({ 'owl:0': 1, 'owl:1': 1, 'owl:2': 3 });
    expect(merge(r, 'owl:0')).toBe(null);
    expect(merge(r, 'owl:2')).toBe(null);
  });

  it('売るとコインになり、最後の 1 つを売るとつけていた場所は空く', () => {
    const r = { ...emptyRecords(), bag: { 'knight:1': 1 } };
    equip(r, 'knight:1');
    expect(wornKeys(r)).toEqual(['knight:1']);
    expect(sell(r, 'knight:1')).toBe(200);
    expect(r.coins).toBe(200);
    expect(r.worn.body).toBe(null);
    expect(r.bag['knight:1']).toBeUndefined();
  });

  it('つけている品を合成して数が 0 になると、その場所は空く', () => {
    const r = { ...emptyRecords(), bag: { 'oni:0': 3 } };
    equip(r, 'oni:0');
    merge(r, 'oni:0');
    expect(r.worn.head).toBe(null);
  });

  it('つけるとその品の場所に入り、同じ場所の前の品は外れる', () => {
    const r = { ...emptyRecords(), bag: { 'oni:0': 1, 'hachimaki:2': 1 } };
    equip(r, 'oni:0');
    equip(r, 'hachimaki:2');
    expect(r.worn).toEqual({ head: 'hachimaki:2', body: null, charm: null });
  });
});

describe('記録の読み', () => {
  it('古い保存は空で読み、壊れた値と知らない鍵を捨てる', () => {
    const empty = parseRecords(JSON.stringify({ best: 10 }));
    expect(empty.bag).toEqual({});
    expect(empty.worn).toEqual({ head: null, body: null, charm: null });
    expect(empty.tickets).toEqual([0, 0, 0]);
    expect(empty.pity).toBe(0);
    const r = parseRecords(
      JSON.stringify({
        bag: { 'owl:1': 2, 'dragon:1': 5, 'oni:7': 1, 'cat:0': -3 },
        worn: { head: 'owl:1', body: 'cloak:2', charm: 'owl:1' },
        tickets: [2, 'x', 1],
        pity: 12.7
      })
    );
    expect(r.bag).toEqual({ 'owl:1': 2 });
    // 持っていない品と、場所の違う品はつけない
    expect(r.worn).toEqual({ head: null, body: null, charm: 'owl:1' });
    expect(r.tickets).toEqual([2, 0, 1]);
    expect(r.pity).toBe(12);
  });
});
```

（`fixed(0.5, 0)` は、レア度を決める 1 つめの乱数 0.5 がふつう（0.8 未満）、品を選ぶ 2 つめの 0 が表の先頭のハチマキになる並び。実装の乱数の引き方はこの順にする）

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha.test.ts`
Expected: FAIL（`./gacha` が無い）

- [ ] **Step 3: 実装する**

`records.ts` の `Records` に足す。

```ts
/** 装備の持ち物（品とレア度の組ごとの数）・つけている品・ガチャ券（銅・銀・金）・伝説が出ていない回数 */
bag: Partial<Record<GearKey, number>>;
worn: Record<Slot, GearKey | null>;
tickets: [number, number, number];
pity: number;
```

`emptyRecords()` に `bag: {}, worn: { head: null, body: null, charm: null }, tickets: [0, 0, 0], pity: 0`、`parseRecords()` の返り値の最後に `...gearRecords(raw)` を足す（import は `import { gearRecords } from './gacha';` と `import type { GearKey, Slot } from './gear';`）。

`gacha.ts`:

```ts
import { GEAR, keyOf, parseKey, SLOTS, type GearKey, type Rarity, type Slot } from './gear';
import type { Records } from './records';

export type Ticket = 0 | 1 | 2;
export const TICKET_NAME = ['銅の券', '銀の券', '金の券'] as const;
/** 券ごとの、ふつう・レア・伝説の割合。コインで引くのは銅の券と同じ */
export const ODDS: [number, number, number][] = [
  [0.8, 0.17, 0.03],
  [0, 0.85, 0.15],
  [0, 0.5, 0.5]
];
export const PULL_COINS = 500;
export const TEN_COINS = 4500;
export const PITY = 50;
export const BAG_MAX = 40;
export const SELL = [50, 200, 800];
export type PullWay = 'bronze' | 'silver' | 'gold' | 'coin' | 'ten';

const WAY_TICKET: Partial<Record<PullWay, Ticket>> = { bronze: 0, silver: 1, gold: 2 };

/** 釜の強さから、落ちる券が銅・銀・金になる割合。2.0 以下は銅だけ、9.0 で 3・5・2 割 */
export function ticketOdds(heat: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, (heat - 2) / 7));
  return [1 - 0.7 * t, 0.5 * t, 0.2 * t];
}

export function rollTicket(heat: number, r: number): Ticket {
  const [b, s] = ticketOdds(heat);
  return r < b ? 0 : r < b + s ? 1 : 2;
}

export const bagCount = (r: Records) => Object.values(r.bag).reduce((t, n) => t + (n ?? 0), 0);

const sizeOf = (way: PullWay) => (way === 'ten' ? 10 : 1);

export function canPull(r: Records, way: PullWay): boolean {
  if (bagCount(r) + sizeOf(way) > BAG_MAX) return false;
  const t = WAY_TICKET[way];
  if (t !== undefined) return r.tickets[t] > 0;
  return r.coins >= (way === 'ten' ? TEN_COINS : PULL_COINS);
}

function add(r: Records, k: GearKey, n: number) {
  const v = (r.bag[k] ?? 0) + n;
  if (v > 0) r.bag[k] = v;
  else {
    delete r.bag[k];
    for (const s of SLOTS) if (r.worn[s] === k) r.worn[s] = null;
  }
}

/** 1 回ぶん。レア度を決める乱数、品を選ぶ乱数の順に引く */
function once(r: Records, odds: [number, number, number], rand: () => number): GearKey {
  const x = rand();
  let rarity: Rarity = x < odds[0] ? 0 : x < odds[0] + odds[1] ? 1 : 2;
  if (r.pity >= PITY - 1) rarity = 2;
  r.pity = rarity === 2 ? 0 : r.pity + 1;
  return keyOf(GEAR[Math.floor(rand() * GEAR.length)].id, rarity);
}

/** 払えて持ち物に入りきるときだけ引いて払う。引けなければ何もせず null */
export function pull(r: Records, way: PullWay, rand: () => number): GearKey[] | null {
  if (!canPull(r, way)) return null;
  const t = WAY_TICKET[way];
  if (t !== undefined) r.tickets[t] -= 1;
  else r.coins -= way === 'ten' ? TEN_COINS : PULL_COINS;
  const odds = ODDS[t ?? 0];
  const got = Array.from({ length: sizeOf(way) }, () => once(r, odds, rand));
  if (way === 'ten' && got.every((k) => k.endsWith(':0'))) got[9] = keyOf(parseKey(got[9])!.def.id, 1);
  for (const k of got) add(r, k, 1);
  return got;
}

export function merge(r: Records, key: GearKey): GearKey | null {
  const p = parseKey(key);
  if (!p || p.rarity === 2 || (r.bag[key] ?? 0) < 3) return null;
  const up = keyOf(p.def.id, (p.rarity + 1) as Rarity);
  add(r, key, -3);
  add(r, up, 1);
  return up;
}

export function sell(r: Records, key: GearKey): number {
  const p = parseKey(key);
  if (!p || !r.bag[key]) return 0;
  add(r, key, -1);
  r.coins += SELL[p.rarity];
  return SELL[p.rarity];
}

export function equip(r: Records, key: GearKey): void {
  const p = parseKey(key);
  if (p && r.bag[key]) r.worn[p.def.slot] = key;
}

export const wornKeys = (r: Records) => SLOTS.flatMap((s) => (r.worn[s] ? [r.worn[s]] : []));

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/** 壊れた値・知らない鍵・持っていない品・場所の違う品は捨てる */
export function gearRecords(raw: Record<string, unknown>): Pick<Records, 'bag' | 'worn' | 'tickets' | 'pity'> {
  const bag: Records['bag'] = {};
  if (raw.bag && typeof raw.bag === 'object')
    for (const [k, v] of Object.entries(raw.bag)) if (parseKey(k) && count(v)) bag[k as GearKey] = count(v);
  const worn: Records['worn'] = { head: null, body: null, charm: null };
  const w = raw.worn && typeof raw.worn === 'object' ? (raw.worn as Record<string, unknown>) : {};
  for (const s of SLOTS) {
    const k = w[s];
    if (typeof k === 'string' && bag[k as GearKey] && parseKey(k)?.def.slot === s) worn[s as Slot] = k as GearKey;
  }
  const t = Array.isArray(raw.tickets) ? raw.tickets : [];
  return { bag, worn, tickets: [count(t[0]), count(t[1]), count(t[2])], pity: Math.min(PITY - 1, count(raw.pity)) };
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gacha.test.ts src/lib/games/animal-survivors/gear.test.ts`
Expected: PASS。続けて `pnpm exec vitest run src/lib/games/animal-survivors` で今のテストが落ちないこと（記録の項目を足しただけ）。

- [ ] **Step 5: Commit** `git add src/lib/games/animal-survivors/gacha.ts src/lib/games/animal-survivors/gacha.test.ts src/lib/games/animal-survivors/records.ts && git commit -m "Add Animal Survivors' gear bag, gacha and records"`

### Task 4: 装備を遊ぶ回に効かせる

**Files:**

- Modify: `world.ts`（`Options.gear`、`World.fx`・`worn`、`createWorld`、`damageEnemy`、`touch`、`hurtPlayer`、吹雪の流され方）、`arms.ts`（`power`）、`drops.ts`（`dropLoot`・`dropFrom` の強化個体の金の磁石・`collect` の玉と肉と時計・`gainXp` の育つ Lv）、`chest.ts`（`openChest`）、`choices.ts`（`choices` の 4 択）、`bosses.ts`・`bosses-snow.ts`・`eruption.ts`（`hurtPlayer` の出どころ）
- Test: `src/lib/games/animal-survivors/gear-world.test.ts`

**Interfaces:**

- Consumes: Task 2 の `gearOf`・`addBoost`・`noFx`・`GearFx`・`GearKey`
- Produces:
  - `Options.gear?: GearKey[]`、`World.fx: GearFx`、`World.worn: GearKey[]`
  - `type Hurt = 'touch' | 'boss' | 'shot' | 'lava'`、`hurtPlayer(w: World, raw: number, from: Hurt = 'touch'): void`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { chestSize } from './chest';
import { ENEMIES } from './enemies';
import { addEnemy, createWorld, damageEnemy, hurtPlayer } from './world';

const VIEW = { w: 274, h: 394 };
const wear = (...gear: string[]) => createWorld('dog', 1, VIEW, {}, 'forest', { gear: gear as never });

describe('装備の能力', () => {
  it('能力は boost に、コインは greed に足す', () => {
    const plain = createWorld('dog', 1, VIEW);
    const w = wear('hachimaki:2', 'cat:2');
    expect(w.stats.might).toBeCloseTo(plain.stats.might + 0.125);
    expect(w.boost.might).toBeCloseTo(0.125);
    expect(w.greed).toBeCloseTo(plain.greed + 0.25);
    expect(w.worn).toEqual(['hachimaki:2', 'cat:2']);
  });

  it('お題の「店の強化なし」の日は装備も効かない', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', {
      gear: ['hachimaki:2'],
      challenge: { date: 'x', bonus: 0, mods: ['noShop', 'halfHp'] }
    });
    expect(w.boost.might ?? 0).toBe(0);
    expect(w.fx.bossDmg).toBe(0);
  });
});

describe('装備の効き目', () => {
  it('ハチマキはボスへの攻撃を強くし、ふつうの敵は変えない', () => {
    const w = wear('hachimaki:2');
    const boss = addEnemy(w, ENEMIES.bear, 50, 0)!;
    const mob = addEnemy(w, ENEMIES[w.stage.waves[0].enemy], -50, 0)!;
    boss.hp = mob.hp = 1000;
    damageEnemy(w, w.enemies.indexOf(boss), 100, 0, 0);
    damageEnemy(w, w.enemies.indexOf(mob), 100, 0, 0);
    expect(1000 - boss.hp).toBeCloseTo(130);
    expect(1000 - mob.hp).toBeCloseTo(100);
  });

  it('よろいはボスの攻撃を、甲羅は飛んでくる攻撃を軽くする', () => {
    const w = wear('knight:2', 'shell:2');
    w.stats.armor = 0;
    const hp = w.player.hp;
    hurtPlayer(w, 20, 'boss');
    expect(hp - w.player.hp).toBe(Math.round(20 * 0.7));
    w.player.hp = hp;
    hurtPlayer(w, 20, 'shot');
    expect(hp - w.player.hp).toBe(Math.round(20 * 0.7 * 0.5));
  });

  it('マントの伝説では溶岩で減らず、無敵にもならず、被弾も出さない', () => {
    const w = wear('cloak:2');
    const hp = w.player.hp;
    hurtPlayer(w, 12, 'lava');
    expect(w.player.hp).toBe(hp);
    expect(w.player.invuln).toBe(0);
    expect(w.events.some((e) => e.type === 'hurt')).toBe(false);
  });

  it('スカーフは当たったあとの無敵を延ばす', () => {
    const w = wear('scarf:2');
    hurtPlayer(w, 1);
    expect(w.player.invuln).toBeCloseTo(0.5 + 0.6);
  });

  it('羽根は店の復活のあとに 1 回だけ起き上がらせる', () => {
    const w = createWorld('dog', 1, VIEW, { revive: 1 }, 'forest', { gear: ['feather:2'] });
    w.stats.armor = 0;
    hurtPlayer(w, 1e9);
    expect(w.revives).toBe(0);
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe(null);
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp * 0.5));
    w.player.invuln = 0;
    hurtPlayer(w, 1e9);
    expect(w.over).toBe('dead');
  });

  it('四つ葉は宝箱の中身が 1 つになる割合を減らす', () => {
    expect(chestSize(0.8, { one: 0.85 - 0.2, three: 0.98 })).toBe(3);
  });

  it('ふくろうは育つ Lv を早める', async () => {
    const { gainXp, xpNeed } = await import('./drops');
    const w = wear('owl:2');
    let need = 0;
    for (let l = 1; l < 8; l++) need += xpNeed(l);
    gainXp(w, need / w.stats.growth + 0.01);
    expect(w.level).toBe(8);
    expect(w.form).toBe(1);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gear-world.test.ts`
Expected: FAIL（`gear` を受けない・`fx` が無い）

- [ ] **Step 3: 実装する**

`world.ts`:

- `Options` に `/** つけている装備 */ gear?: GearKey[];`。`World` に `/** 装備の効き目 */ fx: GearFx;` と `/** つけている装備（リザルトと一時停止に出す） */ worn: GearKey[];`。
- `createWorld` で `const { challenge, heat = PLAIN, arcana = [], note, gear = [] } = opts;`、`const worn = mods.includes('noShop') ? [] : gear;`、`const g = gearOf(worn);`、`const boost = addBoost(k.boost, g.boost);`、`stats(a, [], boost, 0, hpScale(mods))`、返り値は `boost`、`greed: k.greed + g.greed`、`fx: g.fx`、`worn: [...worn]`。
- `damageEnemy` の大ヘビの節の `return` のあと、`if (e.def.metal) dmg = 1;` の前に `if (e.def.boss || e.def.chief) dmg *= 1 + w.fx.bossDmg;`。
- `touch` は一番強い当たりの相手を覚え、`if (atk > 0) hurtPlayer(w, atk, boss ? 'boss' : 'touch');`（`boss` は `e.def.boss || e.def.chief || e.def.part`）。
- `hurtPlayer`:

```ts
export type Hurt = 'touch' | 'boss' | 'shot' | 'lava';

export function hurtPlayer(w: World, raw: number, from: Hurt = 'touch'): void {
  const f = w.fx;
  const scale =
    (from === 'boss' || from === 'shot' ? 1 - f.bossGuard : 1) *
    (from === 'shot' ? 1 - f.shell : 1) *
    (from === 'lava' ? 1 - f.lavaGuard : 1);
  // 伝説のマントで溶岩が 0 になったときは、当たっていないことにする（無敵の点滅で動きが止まって見えないように）
  if (scale <= 0) return;
  const p = w.player;
  const dmg = Math.max(1, Math.round(raw * scale * atkMul(w.heat.level) - w.stats.armor));
  p.hp -= dmg;
  p.invuln = 0.5 + f.invuln;
  ...（今のまま。店の復活の if の後ろに羽根を足す）
  if (f.feather > 0) {
    p.hp = Math.round(w.stats.maxHp * f.feather);
    f.feather = 0;
    p.invuln = REVIVE_INVULN;
    w.events.push({ type: 'swarm', text: '不死鳥の羽根で起き上がった！' }, { type: 'revive' });
    return;
  }
```

- 吹雪の流され方: `p.x += w.storm.wx * BASE_SPEED * STORM_PUSH * (1 - w.fx.wind) * dt;`（y も同じ）。

`arms.ts` の `power`:

```ts
const oni = w.player.hp < w.stats.maxHp / 2 ? 1 + w.fx.oni : 1;
return { dmg: base * w.stats.might * desperate(w) * oni * (crit ? 2 + w.fx.critDmg : 1), crit };
```

`drops.ts`:

- `dropLoot` の重み: `o[1] * (o[2] ? 1 + w.stats.luck + w.fx.loot : 1) * (o[0] === 'goldMagnet' ? 1 + w.fx.gold : o[0] === 'magnet' ? 1 + w.fx.magnetLoot : 1)`。
- `dropFrom` の強化個体: `w.rand() < ELITE_GOLD * (1 + w.fx.gold)`。
- `collect`: 玉は `if (!g.alive || !pull(w, g, reach * (1 + w.fx.gemReach), dt)) continue;`、時計は `w.freeze = FREEZE + w.fx.freeze;`、肉は `MEAT_HEAL * healRate(w) * (1 + w.fx.meat)`。
- `gainXp`: `if (GROW_AT.some((l) => l - w.fx.grow === w.level)) grow(w);`。

`chest.ts` の `openChest`: `const o = chestOdds(w.heat.level); let n = chestSize(w.rand(), { one: Math.max(0, o.one - w.fx.chest), three: o.three });`。

`choices.ts`: 既定の引数を `n = 3 + fourth(w)` にし、`const fourth = (w: World) => { const c = w.stats.luck + w.fx.fourth; return c > 0 && w.rand() < c ? 1 : 0; };`（0 のときは乱数を引かない今の形を保つ）。

出どころ: `bosses.ts` の飛ぶ玉（web・ball・feather の `hurtPlayer(w, h.dmg)`）は `'shot'`、予告のあと当たるもの（334 行の `hurtPlayer`）は `'boss'`、流れ星（`land`）はそのまま。`bosses-snow.ts` の息は `'boss'`。`eruption.ts` の池は `'lava'`。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors`
Expected: PASS（新しい 9 件と今のテスト全部）

- [ ] **Step 5: Commit** `git commit -am "Let Animal Survivors' gear change the run"`（新しいテストを `git add` してから）

### Task 5: ガチャ券を落とし、拾い、持ち帰る

**Files:**

- Modify: `drops.ts`（`Item` の `ticket` と `tier`、`dropTicket`、`dropFrom`、`dropItem`、`collect`）、`world.ts`（`World.tickets`・`loot`、`RunSummary` の `tickets`・`lost`・`gear`、`summary`）、`overtime.ts`（`base.tickets`、`overtimeRun`）、`records.ts`（`record()`）、`draw.ts`（券の絵）、`Survivors.svelte`（延長戦の 2 回めのまとめ）
- Test: `src/lib/games/animal-survivors/tickets.test.ts`

**Interfaces:**

- Consumes: Task 3 の `rollTicket`・`Ticket`・`TICKET_NAME`、Task 1 の `GEAR_ART`
- Produces:
  - `World.tickets: [number, number, number]`、`World.loot: Rng`
  - `RunSummary.tickets?: number[]`（持ち帰る券）、`RunSummary.lost?: number[]`（失った券）、`RunSummary.gear?: GearKey[]`
  - `TICKET_CHANCE = 0.25`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { collect, dropFrom } from './drops';
import { ENEMIES } from './enemies';
import { startOvertime, overtimeRun } from './overtime';
import { emptyRecords, record } from './records';
import { addEnemy, createWorld, summary } from './world';

const VIEW = { w: 274, h: 394 };
const finale = () => ENEMIES.bear;

function bossDown(w: ReturnType<typeof createWorld>, isFinale: boolean) {
  const e = addEnemy(w, { ...finale(), finale: isFinale }, w.player.x, w.player.y)!;
  e.alive = false;
  dropFrom(w, e);
}

describe('ガチャ券', () => {
  it('ステージの主は毎回券を落とし、足もとで拾うと帯を出す', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { heat: { level: 9, bet: 0 } });
    bossDown(w, true);
    const t = w.items.find((it) => it.alive && it.kind === 'ticket')!;
    expect(t).toBeTruthy();
    t.x = w.player.x;
    t.y = w.player.y;
    collect(w, 0.016);
    expect(w.tickets.reduce((a, b) => a + b, 0)).toBe(1);
    expect(w.events.some((e) => e.type === 'swarm' && e.text.endsWith('を拾った！'))).toBe(true);
  });

  it('ボスとヌシの券は 1/4 で、券の乱数は loot から引く', () => {
    const w = createWorld('dog', 1, VIEW);
    const before = w.rand;
    w.loot = () => 0.3;
    bossDown(w, false);
    expect(w.items.some((it) => it.alive && it.kind === 'ticket')).toBe(false);
    w.loot = () => 0.2;
    bossDown(w, false);
    expect(w.items.some((it) => it.alive && it.kind === 'ticket')).toBe(true);
    expect(w.rand).toBe(before);
  });

  it('クリアで持ち帰り、倒れたら失う', () => {
    const r = emptyRecords();
    const win = createWorld('dog', 1, VIEW);
    win.tickets = [2, 1, 0];
    win.over = 'clear';
    const s = summary(win);
    expect(s.tickets).toEqual([2, 1, 0]);
    expect(s.lost).toEqual([0, 0, 0]);
    record(r, s);
    expect(r.tickets).toEqual([2, 1, 0]);
    const lose = createWorld('dog', 1, VIEW);
    lose.tickets = [1, 0, 1];
    lose.over = 'dead';
    const d = summary(lose);
    expect(d.tickets).toEqual([0, 0, 0]);
    expect(d.lost).toEqual([1, 0, 1]);
    record(r, d);
    expect(r.tickets).toEqual([2, 1, 0]);
  });

  it('延長戦で倒れると延長戦のぶんだけ失い、引き上げれば持ち帰る', () => {
    const w = createWorld('dog', 1, VIEW);
    w.tickets = [1, 0, 0];
    w.time = w.stage.length;
    w.over = 'clear';
    startOvertime(w);
    w.tickets = [2, 1, 0];
    w.over = 'dead';
    const dead = overtimeRun(w);
    expect(dead.tickets).toEqual([0, 0, 0]);
    expect(dead.lost).toEqual([1, 1, 0]);
    w.overtime!.retreat = true;
    const kept = overtimeRun(w);
    expect(kept.tickets).toEqual([1, 1, 0]);
    expect(kept.lost).toEqual([0, 0, 0]);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/tickets.test.ts`
Expected: FAIL（`ticket` が無い）

- [ ] **Step 3: 実装する**

`world.ts`: `World` に `/** その回に拾ったガチャ券（銅・銀・金） */ tickets: [number, number, number];` と `/** 券を落とすかと券の種類の乱数（ふつうの乱数の並びを変えないため別の種） */ loot: Rng;`。`createWorld` で `tickets: [0, 0, 0]`、`loot: rng(seed + 0x5bd1e995)`。`RunSummary` に

```ts
  /** 持ち帰るガチャ券と、倒れて失ったガチャ券（銅・銀・金） */
  tickets?: number[];
  lost?: number[];
  /** つけていた装備 */
  gear?: GearKey[];
```

`summary` に `tickets: w.over === 'clear' ? [...w.tickets] : [0, 0, 0]`、`lost: w.over === 'clear' ? [0, 0, 0] : [...w.tickets]`、`gear: [...w.worn]`。

`overtime.ts`: `base` に `tickets: [...w.tickets]`（`World.overtime.base` の型にも足す）。`overtimeRun` に

```ts
  const got = w.tickets.map((n, i) => n - base.tickets[i]);
  const keep = w.overtime!.retreat;
  ...
    tickets: keep ? got : [0, 0, 0],
    lost: keep ? [0, 0, 0] : got,
```

`drops.ts`:

- `Item['kind']` に `'ticket'`、`Item` に `/** ガチャ券の種類 */ tier?: Ticket;`。`dropItem` の `delete it.life;` の隣に `delete it.tier;`。
- `export const TICKET_CHANCE = 0.25;` と

```ts
function dropTicket(w: World, x: number, y: number) {
  dropItem(w, 'ticket', x, y);
  w.items.find((it) => it.alive && it.kind === 'ticket' && it.x === x && it.y === y)!.tier = rollTicket(
    w.heat.level,
    w.loot()
  );
}
```

（`dropItem` が置いた品を返すように変えてもよい。そのほうが短ければそうする）

- `dropFrom` のボスの枝の `return` の前に `if (e.def.finale || w.loot() < TICKET_CHANCE) dropTicket(w, e.x - 12, e.y);`、ヌシの行に `if (e.def.chief && w.loot() < TICKET_CHANCE) dropTicket(w, e.x - 10, e.y);`。
- `collect` で宝箱と同じく吸い寄せずに拾う。

```ts
if (it.kind === 'ticket') {
  if ((it.x - w.player.x) ** 2 + (it.y - w.player.y) ** 2 < CHEST_PICK ** 2) {
    it.alive = false;
    w.tickets[it.tier ?? 0] += 1;
    w.events.push({ type: 'swarm', text: `${TICKET_NAME[it.tier ?? 0]}を拾った！` });
  }
  continue;
}
```

`records.ts` の `record()`: `r.tickets = r.tickets.map((n, i) => n + (run.tickets?.[i] ?? 0)) as Records['tickets'];`。

`draw.ts` の品: `it.kind === 'ticket' ? GEAR_ART[\`ticket${it.tier ?? 0}\`] : it.kind === 'goldMagnet' ? ... : ITEM_ART[it.kind]`。

`Survivors.svelte` の `over()` の `run = { ... }` に、延長戦の 2 回めは 1 回めの持ち帰りと足し、失ったのは延長戦のぶんだけにする。

```ts
      tickets: (first?.tickets ?? [0, 0, 0]).map((n, i) => n + (part.tickets?.[i] ?? 0)),
      lost: part.lost,
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 5: Commit** `git commit -m "Drop Animal Survivors' gacha tickets from bosses and keep them on clear"`（変えたファイルと新しいテストを `git add` してから）

### Task 6: 装備の画面とガチャの画面

**Files:**

- Create: `GearIcon.svelte`（品のアイコンとレア度の枠）、`GearRow.svelte`（鍵の並び。名前を出すかを `named` で選ぶ）、`GearDetail.svelte`（詳しい札と「つける・合成・売る」）、`Bag.svelte`（持ち物の格子。場所ごとに並べ、同じ組は 1 マスに数）、`Gear.svelte`（装備の画面。記録を読み書きする）、`Gacha.svelte`（引き方 5 つ・天井の残り・引いた品）、`Capsule.svelte`（カプセルが割れて光の色を見せる 1 こ）、`RunKit.svelte`（札・装備・券の列）
- Modify: `CharSelect.svelte`（下の段に「装備」、つけている 3 つのアイコン）、`Survivors.svelte`（`screen` に `'gear'`、`start()` で `pick.gear`）、`Pause.svelte`（`GearRow`）、`Result.svelte`（`ArcanaRow` の行を `RunKit` に入れ替える）
- Test: `src/lib/games/animal-survivors/gear.svelte.test.ts`

**Interfaces:**

- Consumes: Task 2・3 の関数、Task 1 の `GEAR_ART`、Task 5 の `RunSummary.tickets`・`lost`・`gear`
- Produces: `Gear.svelte` の props `{ onback: () => void }`（`Shop.svelte` と同じ形。自分で `loadRecords`・`saveRecords` する）、CharSelect の `onopen` に `'gear'`

- [ ] **Step 1: テストを書く**

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAIN } from './cauldron';
import Gear from './Gear.svelte';
import Pause from './Pause.svelte';
import { emptyRecords, loadRecords, RECORDS_KEY } from './records';
import Result from './Result.svelte';
import type { RunSummary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;

function open(extra: object) {
  localStorage.setItem(RECORDS_KEY, JSON.stringify({ ...emptyRecords(), ...extra }));
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Gear, { target, props: { onback: () => {} } });
  flushSync();
  return app;
}

const run = (extra: Partial<RunSummary>): RunSummary => ({
  animal: 'dog',
  heat: PLAIN,
  cleared: false,
  time: 125,
  level: 7,
  kills: 80,
  xp: 0,
  weapons: [{ id: 'woof', level: 2 }],
  passives: [],
  bosses: [],
  coins: 12,
  opened: 0,
  evolved: [],
  stage: 'forest',
  form: 0,
  metal: false,
  finale: false,
  dealt: [],
  book: { kills: {}, elites: [], chiefs: [], bosses: [], forms: [], items: [] },
  ...extra
});

describe('装備の画面', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('品を押して「つける」と、その場所に入って保存する', () => {
    const app = open({ bag: { 'owl:1': 1 } });
    (document.querySelector('[data-gear="owl:1"]') as HTMLButtonElement).click();
    flushSync();
    expect(document.body.textContent).toContain('知恵のふくろう');
    expect(document.body.textContent).toContain('育つ Lv が 1 早い');
    button('つける').click();
    flushSync();
    expect(loadRecords().worn.charm).toBe('owl:1');
    unmount(app);
  });

  it('3 つそろうと合成でき、売るとコインになる', () => {
    const app = open({ bag: { 'oni:0': 3 } });
    (document.querySelector('[data-gear="oni:0"]') as HTMLButtonElement).click();
    flushSync();
    button('合成').click();
    flushSync();
    expect(loadRecords().bag).toEqual({ 'oni:1': 1 });
    (document.querySelector('[data-gear="oni:1"]') as HTMLButtonElement).click();
    flushSync();
    button('売る').click();
    flushSync();
    expect(loadRecords().coins).toBe(200);
    unmount(app);
  });

  it('コインで引くと持ち物が増え、足りなければ押せない', () => {
    const app = open({ coins: 500 });
    button('ガチャ').click();
    flushSync();
    button('コインで引く').click();
    flushSync();
    const r = loadRecords();
    expect(r.coins).toBe(0);
    expect(Object.values(r.bag).reduce((a, b) => a + (b ?? 0), 0)).toBe(1);
    expect(button('コインで引く').disabled).toBe(true);
    expect(document.body.textContent).toContain('伝説まであと');
    unmount(app);
  });
});

describe('遊ぶ回の画面', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('一時停止につけている装備の名前を出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Pause, {
      target,
      props: { run: run({ gear: ['knight:2'] }), onresume: () => {}, onquit: () => {}, onrestart: () => {} }
    });
    flushSync();
    expect(document.body.textContent).toContain('騎士のよろい');
    unmount(app);
  });

  it('リザルトに持ち帰った券と持ち帰れなかった券を出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Result, {
      target,
      props: {
        run: run({ tickets: [1, 0, 0], lost: [0, 1, 0] }),
        got: [],
        total: 0,
        locked: false,
        onagain: () => {},
        onselect: () => {}
      }
    });
    flushSync();
    expect(document.querySelector('[data-kept]')?.textContent).toContain('銅の券');
    expect(document.querySelector('[data-lost]')?.textContent).toContain('銀の券');
    unmount(app);
  });
});
```

（Pause と Result の props の名前は、今の `$props()` に合わせて直す。足りない props があれば今のテスト `Pause.svelte.test.ts` の渡し方を写す）

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors/gear.svelte.test.ts`
Expected: FAIL（`Gear.svelte` が無い）

- [ ] **Step 3: 実装する**

- `GearIcon.svelte`: `{ key: GearKey; size: string }`。`PixelIcon` に `GEAR_ART[def.id]` を渡し、枠の色をレア度で `#f4ead7`・`#4a8fe0`・`#ffd84a` にする。
- `GearRow.svelte`: `{ keys: GearKey[]; named?: boolean }`。空なら何も出さない。`named` で名前とレア度を横に出す（一時停止）。
- `Bag.svelte`: `{ bag: Records['bag']; worn: Records['worn']; onpick: (k: GearKey) => void }`。`SLOTS` ごとに見出しと、`GEAR` の順・レア度の高い順に並べたボタン（`data-gear={key}`、数が 2 以上なら右下に ×N、つけている品に印）。
- `GearDetail.svelte`: `{ key: GearKey; count: number; worn: boolean; onequip; onmerge; onsell; onclose }`。名前・レア度・場所・`statText`・`fxText`・「つける」（つけていれば「つけている」で押せない）・「合成」（3 つ未満か伝説なら押せない）・「売る（N コイン）」。
- `Gacha.svelte`: `{ r: Records; onsave: () => void }`。券ごとの枚数、`PITY - r.pity` の「伝説まであと N 回」、引き方 5 つのボタン（`canPull` で押せるか。持ち物がいっぱいなら「持ち物がいっぱい」）。押すと `pull(r, way, Math.random)` して `onsave()`、引いた品を `Capsule` で並べる。
- `Capsule.svelte`: `{ key: GearKey; delay: number }`。カプセルが落ちて割れ、レア度の色で光ってから `GearIcon` と名前を出す CSS のアニメ（`--spring`）。`@media (prefers-reduced-motion: reduce)` ではアニメを止めて品をそのまま出す。
- `Gear.svelte`: `Shop.svelte` と同じく `let r = $state(loadRecords())`、`saveRecords($state.snapshot(r))`。上にコインと券、3 か所の枠（`SLOT_NAME`、つけている品の `GearIcon` か「なし」）、「ガチャ」ボタンで `Gacha` を開閉、下に `Bag`、品を選ぶと `GearDetail`、「もどる」。
- `RunKit.svelte`: `{ run: RunSummary }`。`ArcanaRow`、`GearRow`、券の行（持ち帰った券 `data-kept`、持ち帰れなかった券 `data-lost` は線で消す）。0 枚の行は出さない。
- `Result.svelte`: `import ArcanaRow` を `import RunKit` に、`<ArcanaRow cards={run.arcana ?? []} />` を `<RunKit {run} />` に入れ替える（行数を増やさない）。
- `Pause.svelte`: `ArcanaRow` の下に `<GearRow keys={run.gear ?? []} named />`。
- `CharSelect.svelte`: `onopen` の型に `'gear'` を足し、下の段に `<button class="as-card link" onclick={() => onopen('gear')}>装備 <GearRow keys={wornKeys(records)} /></button>` を足す（図鑑の行と並べ、`grid-column` を合わせる）。
- `Survivors.svelte`: `screen` の型に `'gear'`、`{:else if screen === 'gear'}<Gear onback={back} />`、`start()` の `pick = { ...pick, stage }` を `pick = { ...pick, stage, gear: wornKeys(records) }` にする（お題の回も同じ。店の強化なしの日は `createWorld` が外す）。

各コンポーネントは 200 行未満。Survivors が 200 行に届くときは、`screen` の型を 1 行の `type Screen` にまとめるなどで行を減らす（振る舞いは変えない）。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm exec vitest run src/lib/games/animal-survivors`
Expected: PASS。`wc -l src/lib/games/animal-survivors/*.svelte | sort -n | tail -5` で 200 行未満。

- [ ] **Step 5: 画面を撮る**

headless の Chrome（scratchpad の `qs-shot.mjs` の形）で、記録に持ち物と券を入れて、装備の画面・詳しい札・ガチャの 10 連の途中と終わり・キャラ選択の「装備」・一時停止・リザルト（券あり）を iPad と iPhone の大きさで撮る。カプセルの CSS のアニメは `waitForTimeout` で実時間を待つ。崩れがあれば直す。

- [ ] **Step 6: Commit** `git commit -m "Add Animal Survivors' gear and gacha screens"`（新しいファイルと変えたファイルを `git add` してから）

### Task 7: ボットで強さを確かめて仕上げる

- [ ] **Step 1:** scratchpad の `sim/boss.sim.ts` に env `GEAR`（`hachimaki:2,knight:2,owl:2` のような並び）を足し、`createWorld` の `opts.gear` に渡す。`STAGE=graveyard` と `STAGE=volcano` で、店半分・店半分に伝説 3 つ・店を全部、の 3 つを 12 回ずつ流してクリアの割合を比べる。伝説 3 つが店を全部より強ければ、`gear.ts` の `amount` を下げて流し直す。
- [ ] **Step 2:** spec に「## 9. 調整の結果」を足す（比べた表と、変えた数）。
- [ ] **Step 3:** CLAUDE.md の Animal Survivors の段落に装備とガチャ（券の落ち方と持ち帰り、ガチャの値段と天井、3 か所・合成・売る、効き目の差しこみ口、お題との関係、`gear.ts`・`gacha.ts`）を足す。
- [ ] **Step 4:** `pnpm verify` を通して Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
