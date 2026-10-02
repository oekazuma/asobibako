# Animal Survivors 一時停止と積み上げ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 遊んでいる最中の隅の ✕ と ↻ を一時停止のメニューに置きかえ、コイン・店（永久強化）・実績で遊ぶたびに積み上がるようにする。

**Architecture:** 共通の `SoloShell` に `meta.ownMenu` と `onquit` を足し、Animal Survivors だけが自分のメニューを持つ。店と実績は DOM を使わない `upgrades.ts`・`achievements.ts` の表と関数で、記録は今の `records.ts`（`asobibako:animal-survivors`）に足す。ゲームの中のコイン・リロール・復活は `world.ts` と `drops.ts` と `prompts.svelte.ts` に足し、画面は `Pause`・`Shop`・`Trophies` の 3 つを新しく作る。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest（unit は node、`*.svelte.test.ts` は happy-dom）、playwright-core の headless Chrome（scratchpad の台本）

**Spec:** `docs/superpowers/specs/2026-10-02-animal-survivors-progress-design.md`

## Global Constraints

- 直すのは Animal Survivors だけ。ほかの 1 人用ゲームの隅のボタンは今のまま（`ownMenu` が無ければ今と同じ）。
- 記録は `asobibako:animal-survivors` の 1 つのキーに足す（バックアップと控えにそのまま入る）。古い保存は足した項目を 0 と空で読み、解放した動物は残す。
- 強化なしの強さ（動物・武器・パッシブ・敵の数値）は変えない。
- 確かめの画面は出てから 350ms 押せない（`Lock`）。
- コンポーネントは 200 行未満（`architecture/component-size`、抑制コメントは使わない）。`SoloShell.svelte` は今 198 行。
- 絵文字は使わない。ドット絵は `art/*.ts` の 1 文字 = 1 色の格子で、色は `art/palette.ts` だけ。新しい絵は描く前に見本を見せて止まる。
- 盤面の中の大きさは `cqw` / `cqh` か `%`（`dvh` は使わない）。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。
- `pnpm verify` が通ること。

## Review Focus

- 一時停止のメニューを開いたまま画面が隠れて戻った。メニューは開いたまま、時計は進まない。Task 7 の headless で確かめる。
- レベルアップや宝箱の画面が出ているときに Esc / P を押した・画面が隠れた。メニューは重ならず、選び終えたあとに隠れていたならメニューを開く。Task 7 のテスト（`Pause` を開く条件の関数）。
- 「やめる」の確かめを素早く 2 回押した。350ms のあいだは決まらない。Task 7 の DOM テスト。
- 店で最大の段・足りないコインの品を押した。コインも段も変わらない。Task 3 のテスト。
- 実績のごほうびで動物がそろい、同じ判定の中で「7 匹がそろう」も達成する。Task 4 のテスト（くり返し判定）。

---

### Task 1: 絵の見本（コイン・大袋・3 つのアイコン）

**Files:**

- Modify: `src/lib/games/animal-survivors/art/items.ts`
- Test: `src/lib/games/animal-survivors/pixels.test.ts`

**Interfaces:**

- Produces: `ITEM_ART.coin`（8×8、2 フレームで回って光る）、`ITEM_ART.purse`（10×10、ボスの大袋）、`ITEM_ART['upgrade-greed']`・`['upgrade-reroll']`・`['upgrade-revive']`（12×12、パッシブのアイコンと同じ大きさ）

- [ ] **Step 1: 失敗するテストを書く**

`pixels.test.ts` の ITEM_ART の確かめの `describe` に足す。

```ts
it('コイン・大袋・店のアイコンがある', () => {
  for (const k of ['coin', 'purse', 'upgrade-greed', 'upgrade-reroll', 'upgrade-revive'])
    expect(ITEM_ART[k]).toBeDefined();
  expect(ITEM_ART.coin.frames).toHaveLength(2);
  expect([ITEM_ART['upgrade-greed'].w, ITEM_ART['upgrade-greed'].h]).toEqual([12, 12]);
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/pixels.test.ts`
Expected: FAIL（`coin` が undefined）

- [ ] **Step 3: 絵を手で打つ**

`ITEM_ART` の末尾に 5 つ足す。色は PALETTE のキーだけ（コインは `y`/`Y`/`w`/`k`、大袋は `t`/`T`/`y`、強欲はコインの山、リロールは 2 本の矢印の輪（`u`/`U`）、復活は羽の付いたハート（`r`/`R`/`w`））。`pixels.test.ts` の既存の `problems()` の確かめ（行の長さ・知らない色）が全部の絵に効く。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/pixels.test.ts`
Expected: PASS

- [ ] **Step 5: 見本を撮って止まる**

scratchpad に `progress-sheet.mjs` を作り（`roster-sheet.mjs` と同じ形。`png.mjs` の `Img`・`put` で ITEM_ART の 5 つを 8 倍で並べ、比べるため `passive-heart`・`meat`・`chest` も並べる）、`node` で PNG にして Read で見て、利用者に見せて「この絵で進めてよいか」を聞いて止まる。直しが入ったら Step 3 に戻る。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/animal-survivors/art/items.ts src/lib/games/animal-survivors/pixels.test.ts
git commit -m "Draw Animal Survivors' coin, purse, and shop icons"
```

### Task 2: 共通のシェルの `ownMenu` と `onquit`

**Files:**

- Modify: `src/lib/games.ts`
- Modify: `src/lib/components/SoloShell.svelte`
- Modify: `src/lib/test/StubGame.svelte`, `src/lib/test/hooks.ts`
- Test: `src/lib/components/SoloShell.svelte.test.ts`

**Interfaces:**

- Produces: `SoloMeta.ownMenu?: boolean`、`SoloProps.onquit?: () => void`、`hooks.quit?: () => void`

- [ ] **Step 1: 失敗するテストを書く**

`SoloShell.svelte.test.ts` の `show()` の引数の型に `ownMenu?: boolean` を足し、`describe` に足す。

```ts
it('ownMenu のゲームでは遊んでいるあいだ隅の ✕ と ↻ を出さず、onquit でタイトルへ戻る', () => {
  const { target, app } = show({ ownMenu: true });
  start(target);
  expect(target.querySelector('[aria-label="やめる"]')).toBeNull();
  expect(target.querySelector('[aria-label="やりなおし"]')).toBeNull();
  hooks.quit!();
  flushSync();
  expect(target.querySelector('button.go')).not.toBeNull();
  unmount(app);
});

it('ownMenu でなければ今までどおり隅のボタンを出す', () => {
  const { target, app } = show();
  start(target);
  expect(target.querySelector('[aria-label="やめる"]')).not.toBeNull();
  expect(target.querySelector('[aria-label="やりなおし"]')).not.toBeNull();
  unmount(app);
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/components/SoloShell.svelte.test.ts`
Expected: FAIL（`hooks.quit` が undefined、ボタンが残る）

- [ ] **Step 3: 実装する**

`src/lib/games.ts` の `SoloProps` に足す。

```ts
  /** ゲームが自分の画面から抜けるとき（meta.ownMenu のゲームの「タイトルへ」）に呼ぶ */
  onquit?: () => void;
```

`SoloMeta` に足す。

```ts
  /** 遊んでいるあいだの隅の ✕ と ↻ を出さない。ゲームが自分で一時停止やタイトルへ戻る口を持つ（長い 1 回を押し間違いで失わないため） */
  ownMenu?: boolean;
```

`src/lib/test/hooks.ts` の型に `quit?: () => void;` を足し、`StubGame.svelte` の props に `onquit` を足して `hooks.quit = onquit;` を写す。

`SoloShell.svelte` の遊んでいる最中の部分を次にする。

```svelte
{#key round}
  <Game {level} onfinish={finish} onhint={(text) => (hint = text)} onquit={() => (screen = 'title')} />
{/key}
```

```svelte
{#if !meta.ownMenu}
  <!-- 遊んでいる途中でもやめられるよう、小さく隅に置く。一覧ではなくタイトルへ戻る -->
  <button class="round corner quit" onclick={() => (screen = 'title')} aria-label="やめる">✕</button>
  <button class="round corner retry" onclick={retry} aria-label="やりなおし">↻</button>
{/if}
```

`pnpm vitals --diff` で 200 行を越えたら、`<style>` の `.retry` の `font-size: 24px;` を `.retry` のセレクタの行と同じ規則に残したまま、`.back,\n  .quit` の 2 行の規則と `.quit` の規則を 1 つにまとめる（`.quit { left: …; opacity: 0.7; }` と `.back { left: …; }` に分けて行を減らす）など、見た目を変えずに CSS の行を詰める。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/components/SoloShell.svelte.test.ts && pnpm vitals --diff`
Expected: PASS、vitals の警告なし

- [ ] **Step 5: Commit**

```bash
git add src/lib/games.ts src/lib/components/SoloShell.svelte src/lib/components/SoloShell.svelte.test.ts src/lib/test/StubGame.svelte src/lib/test/hooks.ts
git commit -m "Let solo games own their menu instead of the shell's corner buttons"
```

### Task 3: 店の表と記録の拡張

**Files:**

- Create: `src/lib/games/animal-survivors/upgrades.ts`
- Modify: `src/lib/games/animal-survivors/records.ts`
- Modify: `src/lib/games/animal-survivors/passives.ts`
- Test: `src/lib/games/animal-survivors/progress.test.ts`（新）

**Interfaces:**

- Consumes: `Stats`・`StatKey`（`passives.ts`）
- Produces:
  - `type UpgradeId = 'might' | 'maxHp' | 'speed' | 'armor' | 'regen' | 'magnet' | 'growth' | 'crit' | 'greed' | 'reroll' | 'revive'`
  - `interface UpgradeDef { id: UpgradeId; name: string; blurb: string; max: number; base: number; stat?: StatKey; per: number; icon: string }`
  - `UPGRADES: UpgradeDef[]`、`type Ranks = Partial<Record<UpgradeId, number>>`
  - `price(d: UpgradeDef, rank: number): number`
  - `interface Perks { boost: Partial<Stats>; greed: number; rerolls: number; revives: number }`、`perks(ranks: Ranks): Perks`
  - `buy(r: Records, id: UpgradeId): boolean`
  - `Records` に `coins: number; ranks: Ranks; achieved: string[]; clearedBy: AnimalId[]; chests: number`
  - `stats(a, passives, boost: Partial<Stats> = {})`

- [ ] **Step 1: 失敗するテストを書く**

`progress.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import { animal } from './animals';
import { stats } from './passives';
import { emptyRecords, parseRecords } from './records';
import { UPGRADES, buy, perks, price } from './upgrades';

describe('店', () => {
  it('11 品あり、値段は基本の値段 × 次の段', () => {
    expect(UPGRADES.map((d) => d.id)).toEqual([
      'might',
      'maxHp',
      'speed',
      'armor',
      'regen',
      'magnet',
      'growth',
      'crit',
      'greed',
      'reroll',
      'revive'
    ]);
    const might = UPGRADES[0];
    expect(price(might, 0)).toBe(might.base);
    expect(price(might, 2)).toBe(might.base * 3);
  });

  it('買うとコインが減って段が上がる。足りない・最大の段なら何も変わらない', () => {
    const r = emptyRecords();
    r.coins = UPGRADES[0].base;
    expect(buy(r, 'might')).toBe(true);
    expect(r).toMatchObject({ coins: 0, ranks: { might: 1 } });
    expect(buy(r, 'might')).toBe(false);
    expect(r).toMatchObject({ coins: 0, ranks: { might: 1 } });
    r.coins = 1e6;
    r.ranks.revive = 1;
    expect(buy(r, 'revive')).toBe(false);
    expect(r.coins).toBe(1e6);
  });

  it('段が強さ・強欲・リロール・復活になる', () => {
    const p = perks({ might: 2, maxHp: 1, armor: 3, greed: 5, reroll: 2, revive: 1 });
    expect(p.boost.might).toBeCloseTo(0.1);
    expect(p.boost.maxHp).toBe(10);
    expect(p.boost.armor).toBe(3);
    expect(p.greed).toBeCloseTo(1.5);
    expect(p.rerolls).toBe(2);
    expect(p.revives).toBe(1);
    expect(perks({})).toEqual({ boost: {}, greed: 1, rerolls: 0, revives: 0 });
  });

  it('強化は動物の基本の値に足し、とくいとパッシブはその上に重なる', () => {
    const s = stats(animal('fox'), [{ id: 'fang', level: 1 }], { might: 0.1, crit: 0.04 });
    expect(s.might).toBeCloseTo(1 + 0.1 + 0.1);
    expect(s.crit).toBeCloseTo(0.05 + 0.1 + 0.04);
  });
});

describe('記録の拡張', () => {
  it('古い保存は足した項目を 0 と空で読み、解放した動物は残る', () => {
    const r = parseRecords(JSON.stringify({ best: 400, kills: 10, bosses: [], clears: 0, unlocked: ['fox'] }));
    expect(r).toMatchObject({ coins: 0, ranks: {}, achieved: [], clearedBy: [], chests: 0 });
    expect(r.unlocked).toContain('fox');
  });

  it('壊れた値は読み飛ばすか 0 にし、段は最大で止める', () => {
    const r = parseRecords(
      JSON.stringify({
        coins: -5,
        ranks: { might: 9, speed: 'x', revive: 1, nope: 3, armor: 2.7 },
        achieved: ['survive1', 7, 'nope'],
        clearedBy: ['dog', 'dragon'],
        chests: 'many'
      })
    );
    expect(r.coins).toBe(0);
    expect(r.ranks).toEqual({ might: 5, revive: 1, armor: 2 });
    expect(r.clearedBy).toEqual(['dog']);
    expect(r.chests).toBe(0);
  });
});
```

（`achieved` の知らない id の読み飛ばしは、実績の表ができる Task 4 で確かめる。この Task では文字列だけを残す。）

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/progress.test.ts`
Expected: FAIL（`./upgrades` が無い）

- [ ] **Step 3: `upgrades.ts` を作る**

```ts
import type { StatKey, Stats } from './passives';
import type { Records } from './records';

export type UpgradeId =
  'might' | 'maxHp' | 'speed' | 'armor' | 'regen' | 'magnet' | 'growth' | 'crit' | 'greed' | 'reroll' | 'revive';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  blurb: string;
  max: number;
  /** 1 段めの値段。n 段めは base × n */
  base: number;
  /** 強さに足すもの。無い品（強欲・リロール・復活）は perks() が別に読む */
  stat?: StatKey;
  /** 1 段ごとの量 */
  per: number;
  /** ITEM_ART の名前 */
  icon: string;
}

export type Ranks = Partial<Record<UpgradeId, number>>;

const u = (
  id: UpgradeId,
  name: string,
  blurb: string,
  max: number,
  base: number,
  stat: StatKey | undefined,
  per: number,
  icon: string
): UpgradeDef => ({ id, name, blurb, max, base, stat, per, icon });

export const UPGRADES: UpgradeDef[] = [
  u('might', '攻撃', '攻撃力 +5%', 5, 60, 'might', 0.05, 'passive-fang'),
  u('maxHp', '最大 HP', '最大 HP +10', 5, 60, 'maxHp', 10, 'passive-heart'),
  u('speed', '速さ', '移動速度 +4%', 5, 60, 'speed', 0.04, 'passive-paws'),
  u('armor', '防御', '受けるダメージ -1', 3, 150, 'armor', 1, 'passive-fur'),
  u('regen', '回復', '毎秒 HP +0.1 回復', 5, 60, 'regen', 0.1, 'passive-leaf'),
  u('magnet', '拾う範囲', 'アイテムを拾う範囲 +10%', 5, 40, 'magnet', 0.1, 'passive-whisker'),
  u('growth', '経験値', '経験値 +5%', 5, 60, 'growth', 0.05, 'passive-nose'),
  u('crit', '会心', '会心率 +2%', 5, 60, 'crit', 0.02, 'passive-claw'),
  u('greed', '強欲', 'コイン +10%', 5, 50, undefined, 0.1, 'upgrade-greed'),
  u('reroll', 'リロール', '3 択の引き直し +1 回', 3, 200, undefined, 1, 'upgrade-reroll'),
  u('revive', '復活', '倒れたとき 1 回だけ HP 半分で起き上がる', 1, 800, undefined, 1, 'upgrade-revive')
];

export function price(d: UpgradeDef, rank: number): number {
  return d.base * (rank + 1);
}

export interface Perks {
  boost: Partial<Stats>;
  /** コインに掛ける倍率 */
  greed: number;
  rerolls: number;
  revives: number;
}

export function perks(ranks: Ranks): Perks {
  const out: Perks = { boost: {}, greed: 1, rerolls: 0, revives: 0 };
  for (const d of UPGRADES) {
    const n = ranks[d.id] ?? 0;
    if (!n) continue;
    if (d.stat) out.boost[d.stat] = (out.boost[d.stat] ?? 0) + d.per * n;
    else if (d.id === 'greed') out.greed += d.per * n;
    else if (d.id === 'reroll') out.rerolls += n;
    else out.revives += n;
  }
  return out;
}

/** コインが足りて最大の段でなければ買う。買えたら true */
export function buy(r: Records, id: UpgradeId): boolean {
  const d = UPGRADES.find((o) => o.id === id);
  const rank = r.ranks[id] ?? 0;
  if (!d || rank >= d.max || r.coins < price(d, rank)) return false;
  r.coins -= price(d, rank);
  r.ranks[id] = rank + 1;
  return true;
}
```

- [ ] **Step 4: `passives.ts` の `stats()` に `boost` を足す**

```ts
export function stats(a: Animal, passives: { id: string; level: number }[], boost: Partial<Stats> = {}): Stats {
```

`a.bonus` を足す行の前に足す。

```ts
for (const [k, v] of Object.entries(boost) as [StatKey, number][]) s[k] += v;
```

- [ ] **Step 5: `records.ts` を広げる**

`Records` に足す。

```ts
  /** もちもののコイン */
  coins: number;
  /** 店の品ごとの段 */
  ranks: Ranks;
  /** 達成した実績の id */
  achieved: string[];
  /** クリアした動物 */
  clearedBy: AnimalId[];
  /** 開けた宝箱の合計 */
  chests: number;
```

`emptyRecords()` に `coins: 0, ranks: {}, achieved: [], clearedBy: [], chests: 0` を足す。`parseRecords` の返り値に足す。

```ts
    coins: Math.floor(num(raw.coins)),
    ranks: ranksOf(raw.ranks),
    achieved: Array.isArray(raw.achieved) ? raw.achieved.filter((v): v is string => typeof v === 'string') : [],
    clearedBy: list(raw.clearedBy, ids),
    chests: Math.floor(num(raw.chests))
```

```ts
/** 知らない品と数でない段は読み飛ばし、段は 0〜最大の整数にする */
function ranksOf(v: unknown): Ranks {
  const out: Ranks = {};
  if (!v || typeof v !== 'object') return out;
  for (const d of UPGRADES) {
    const n = Math.min(d.max, Math.floor(num((v as Record<string, unknown>)[d.id])));
    if (n > 0) out[d.id] = n;
  }
  return out;
}
```

`import { UPGRADES, type Ranks } from './upgrades';` を足す。

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/`
Expected: PASS（roster.test.ts の `emptyRecords` の比べ方が `toEqual` で落ちたら、足した 5 項目を期待値に足す）

- [ ] **Step 7: Commit**

```bash
git add src/lib/games/animal-survivors/{upgrades,records,passives}.ts src/lib/games/animal-survivors/progress.test.ts src/lib/games/animal-survivors/roster.test.ts
git commit -m "Add Animal Survivors' shop table and keep coins and ranks in the records"
```

### Task 4: 実績の表と判定

**Files:**

- Create: `src/lib/games/animal-survivors/achievements.ts`
- Modify: `src/lib/games/animal-survivors/records.ts`, `src/lib/games/animal-survivors/world.ts`（`RunSummary` に `coins`・`opened`）
- Test: `src/lib/games/animal-survivors/progress.test.ts`, `src/lib/games/animal-survivors/roster.test.ts`

**Interfaces:**

- Consumes: `Records`（Task 3）、`UPGRADES`（Task 3）、`RunSummary`
- Produces:
  - `RunSummary` に `coins: number`（この回の枚数、強欲とクリアのボーナス込みの整数）と `opened: number`（開けた宝箱）。`summary()` は `Math.floor(w.coins)` と `w.opened` を入れる（`World.coins`・`World.opened` は Task 5 で足す。この Task では `World` に `coins: number; opened: number` を足して `createWorld` で 0 にするだけ）
  - `interface AchievementDef { id: string; name: string; coins: number; animal?: AnimalId; done: (r: Records, run: RunSummary | null) => boolean; progress?: (r: Records) => [number, number] }`
  - `ACHIEVEMENTS: AchievementDef[]`（23 個）
  - `grant(r: Records, run: RunSummary | null): AchievementDef[]`
  - `record(r, run): AchievementDef[]`（今の `AnimalId[]` から変える）

- [ ] **Step 1: 失敗するテストを書く**

`progress.test.ts` に足す（`RunSummary` を作る `run()` を足す）。

```ts
import { ACHIEVEMENTS, grant } from './achievements';
import { record } from './records';
import type { RunSummary } from './world';

const run = (o: Partial<RunSummary> = {}): RunSummary => ({
  animal: 'dog',
  cleared: false,
  time: 30,
  level: 1,
  kills: 0,
  xp: 0,
  weapons: [],
  passives: [],
  bosses: [],
  coins: 0,
  opened: 0,
  ...o
});

describe('実績', () => {
  it('23 個あり、id は重ならない', () => {
    expect(ACHIEVEMENTS).toHaveLength(23);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(23);
  });

  it('1 回の結果で記録を足し、達成した実績のコインと動物を渡す。同じ実績は 2 度渡さない', () => {
    const r = emptyRecords();
    const got = record(r, run({ time: 320, kills: 120, coins: 40 }));
    expect(got.map((a) => a.id)).toEqual(['survive1', 'survive5', 'run100']);
    expect(r.coins).toBe(40 + 10 + 50 + 20);
    expect(r.unlocked).toContain('fox');
    expect(record(r, run({ time: 320, kills: 120 }))).toEqual([]);
  });

  it('ごほうびで 7 匹がそろうと、同じ判定の中で「7 匹がそろう」も達成する', () => {
    const r = emptyRecords();
    r.unlocked = ['dog', 'cat', 'wolf', 'fox', 'bear', 'rabbit'];
    r.kills = 0;
    const got = record(r, run({ time: 900, cleared: true, kills: 0 }));
    expect(got.map((a) => a.id)).toContain('clear');
    expect(got.map((a) => a.id)).toContain('allAnimals');
    expect(r.unlocked).toHaveLength(7);
  });

  it('動物ごとのクリアと宝箱の合計を数える', () => {
    const r = emptyRecords();
    record(r, run({ animal: 'cat', cleared: true, time: 900, opened: 4 }));
    record(r, run({ animal: 'cat', cleared: true, time: 900, opened: 6 }));
    expect(r.clearedBy).toEqual(['cat']);
    expect(r.chests).toBe(10);
    expect(r.achieved).toContain('chests10');
  });

  it('店の判定（run なし）では 1 回の実績を見ない', () => {
    const r = emptyRecords();
    r.ranks = { might: 5 };
    expect(grant(r, null).map((a) => a.id)).toEqual(['firstBuy', 'oneMax']);
  });

  it('合計の実績は途中経過を持つ', () => {
    const r = emptyRecords();
    r.kills = 1234;
    const total = ACHIEVEMENTS.find((a) => a.id === 'total3000')!;
    expect(total.progress!(r)).toEqual([1234, 3000]);
  });

  it('保存の知らない実績の id は読み飛ばす', () => {
    expect(parseRecords(JSON.stringify({ achieved: ['survive1', 'nope', 3] })).achieved).toEqual(['survive1']);
  });
});
```

`roster.test.ts` の `record()` の期待（今は解放した動物の配列）は、返り値の `animal` を拾う形に直す。例: `expect(record(r, s).flatMap((a) => (a.animal ? [a.animal] : []))).toEqual(['fox'])`。`run` を作るところには `coins: 0, opened: 0` を足す。world.test.ts の `summary` の期待にも `coins: 0, opened: 0` を足す。

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/`
Expected: FAIL（`./achievements` が無い）

- [ ] **Step 3: `achievements.ts` を作る**

```ts
import { ANIMALS, type AnimalId } from './animals';
import type { Records } from './records';
import { UPGRADES } from './upgrades';
import { MAX_LEVEL } from './weapons';
import type { RunSummary } from './world';

export interface AchievementDef {
  id: string;
  name: string;
  coins: number;
  animal?: AnimalId;
  /** run は 1 回が終わったときだけ渡る（店で買ったときは null） */
  done: (r: Records, run: RunSummary | null) => boolean;
  /** 合計の実績の [今, 目標] */
  progress?: (r: Records) => [number, number];
}

const maxed = (r: Records) => UPGRADES.filter((d) => (r.ranks[d.id] ?? 0) >= d.max).length;
const lv5 = (run: RunSummary | null) => run?.weapons.filter((o) => o.level >= MAX_LEVEL).length ?? 0;

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'survive1', name: '1 分生き延びる', coins: 10, done: (r) => r.best >= 60 },
  { id: 'survive5', name: '5 分生き延びる', coins: 50, animal: 'fox', done: (r) => r.best >= 300 },
  { id: 'survive10', name: '10 分生き延びる', coins: 100, done: (r) => r.best >= 600 },
  { id: 'clear', name: '15 分生き延びてクリア', coins: 200, animal: 'panda', done: (r) => r.clears >= 1 },
  { id: 'run100', name: '1 回で 100 体倒す', coins: 20, done: (_, run) => (run?.kills ?? 0) >= 100 },
  { id: 'run1000', name: '1 回で 1000 体倒す', coins: 100, done: (_, run) => (run?.kills ?? 0) >= 1000 },
  { id: 'run3000', name: '1 回で 3000 体倒す', coins: 200, done: (_, run) => (run?.kills ?? 0) >= 3000 },
  {
    id: 'total3000',
    name: '合計 3000 体倒す',
    coins: 100,
    animal: 'rabbit',
    done: (r) => r.kills >= 3000,
    progress: (r) => [r.kills, 3000]
  },
  {
    id: 'total30000',
    name: '合計 30000 体倒す',
    coins: 300,
    done: (r) => r.kills >= 30000,
    progress: (r) => [r.kills, 30000]
  },
  { id: 'bear', name: '巨大ベアを倒す', coins: 100, animal: 'bear', done: (r) => r.bosses.includes('bear') },
  { id: 'queen', name: '女王グモを倒す', coins: 150, done: (r) => r.bosses.includes('spiderQueen') },
  { id: 'bothBosses', name: '1 回でボスを 2 体とも倒す', coins: 200, done: (_, run) => (run?.bosses.length ?? 0) >= 2 },
  { id: 'lv20', name: 'Lv20 になる', coins: 30, done: (_, run) => (run?.level ?? 0) >= 20 },
  { id: 'lv50', name: 'Lv50 になる', coins: 150, done: (_, run) => (run?.level ?? 0) >= 50 },
  { id: 'weapon5', name: '武器を 1 つ Lv5 にする', coins: 50, done: (_, run) => lv5(run) >= 1 },
  { id: 'weapons5', name: '武器 3 つを Lv5 にする', coins: 150, done: (_, run) => lv5(run) >= 3 },
  {
    id: 'allAnimals',
    name: '7 匹がそろう',
    coins: 200,
    done: (r) => r.unlocked.length >= ANIMALS.length,
    progress: (r) => [r.unlocked.length, ANIMALS.length]
  },
  {
    id: 'clear3',
    name: '3 匹でクリア',
    coins: 150,
    done: (r) => r.clearedBy.length >= 3,
    progress: (r) => [r.clearedBy.length, 3]
  },
  {
    id: 'clear7',
    name: '7 匹すべてでクリア',
    coins: 500,
    done: (r) => r.clearedBy.length >= ANIMALS.length,
    progress: (r) => [r.clearedBy.length, ANIMALS.length]
  },
  {
    id: 'chests10',
    name: '宝箱を合計 10 個開ける',
    coins: 50,
    done: (r) => r.chests >= 10,
    progress: (r) => [r.chests, 10]
  },
  { id: 'firstBuy', name: 'はじめてのパワーアップ', coins: 20, done: (r) => Object.values(r.ranks).some((n) => n > 0) },
  { id: 'oneMax', name: 'どれか 1 品を最大の段に', coins: 100, done: (r) => maxed(r) >= 1 },
  {
    id: 'allMax',
    name: '全部の品を最大の段に',
    coins: 500,
    done: (r) => maxed(r) >= UPGRADES.length,
    progress: (r) => [maxed(r), UPGRADES.length]
  }
];

/** まだの実績を達成にしてコインと動物を渡し、表の順に返す。ごほうびの動物で次の実績が満ちることがあるので、増えなくなるまで見る */
export function grant(r: Records, run: RunSummary | null): AchievementDef[] {
  const out: AchievementDef[] = [];
  for (let more = true; more;) {
    more = false;
    for (const a of ACHIEVEMENTS) {
      if (r.achieved.includes(a.id) || !a.done(r, run)) continue;
      r.achieved.push(a.id);
      r.coins += a.coins;
      if (a.animal && !r.unlocked.includes(a.animal)) r.unlocked.push(a.animal);
      out.push(a);
      more = true;
    }
  }
  return ACHIEVEMENTS.filter((a) => out.includes(a));
}
```

- [ ] **Step 4: `records.ts` の `record()` を実績に移す**

`UNLOCK` を消し、`record()` を次にする。`parseRecords` の `achieved` は `ACHIEVEMENTS` の id だけを残す（`list(raw.achieved, ACHIEVEMENTS.map((a) => a.id))`）。

```ts
/** 1 回の結果で記録を足し、その回に達成した実績を返す。解放は取り消さない */
export function record(r: Records, run: RunSummary): AchievementDef[] {
  r.best = Math.max(r.best, run.time);
  r.kills += run.kills;
  for (const b of run.bosses) if (!r.bosses.includes(b)) r.bosses.push(b);
  if (run.cleared) {
    r.clears += 1;
    if (!r.clearedBy.includes(run.animal)) r.clearedBy.push(run.animal);
  }
  r.chests += run.opened;
  r.coins += run.coins;
  return grant(r, run);
}
```

`achievements.ts` と `records.ts` は互いに型だけを import する（`records.ts` は `ACHIEVEMENTS` と `grant` を値で、`achievements.ts` は `Records` を型で使う）。

`world.ts` の `World` に `coins: number;`（この回のコイン。強欲を掛けた値で端数を持つ）と `opened: number;`（開けた宝箱）を足し、`createWorld` で 0 にする。`RunSummary` に `coins: number; opened: number;` を足し、`summary()` で `coins: Math.floor(w.coins), opened: w.opened` を入れる。

`Survivors.svelte` の `fresh = record(r, run);` は型が変わるので、この Task では `fresh = record(r, run).flatMap((a) => (a.animal ? [a.animal] : []));` にしておく（実績の帯は Task 8）。

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check`
Expected: PASS、型エラーなし

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Add Animal Survivors' achievements and grant them from the records"
```

### Task 5: ゲームの中のコイン・リロール・復活

**Files:**

- Modify: `src/lib/games/animal-survivors/world.ts`, `drops.ts`, `chest.ts`, `choices.ts`, `prompts.svelte.ts`
- Test: `src/lib/games/animal-survivors/progress.test.ts`, `src/lib/games/animal-survivors/prompts.svelte.test.ts`

**Interfaces:**

- Consumes: `Ranks`・`perks()`（Task 3）、`World.coins`・`World.opened`（Task 4）
- Produces:
  - `createWorld(id, seed, view, ranks: Ranks = {})`
  - `World.boost: Partial<Stats>`、`World.greed: number`、`World.rerolls: number`、`World.revives: number`
  - `Item['kind']` に `'coin' | 'purse'`
  - `GameEvent` に `{ type: 'coin'; value: number }` と `{ type: 'revive' }`
  - `Prompts.reroll(finger: number | null): void`、`Prompts.rerolls`（残りを見せるための getter）
  - `CLEAR_COINS = 100`、`CHEST_COINS = 10`（`drops.ts` から export）

- [ ] **Step 1: 失敗するテストを書く**

`progress.test.ts` に足す。

```ts
import { createWorld, hurtPlayer, makeEnemy, step, summary, damageEnemy } from './world';
import { collect } from './drops';
import { openChest } from './chest';
import { ENEMIES } from './enemies';
import { eliteOf } from './world';

const VIEW = { w: 260, h: 380 };

describe('ゲームの中の積み上げ', () => {
  it('店の段が始めの強さ・強欲・リロール・復活に入る', () => {
    const w = createWorld('dog', 1, VIEW, { maxHp: 2, greed: 1, reroll: 2, revive: 1 });
    expect(w.stats.maxHp).toBe(animal('dog').hp + 20);
    expect(w.player.hp).toBe(w.stats.maxHp);
    expect(w.greed).toBeCloseTo(1.1);
    expect([w.rerolls, w.revives]).toEqual([2, 1]);
  });

  it('レベルアップでパッシブを取っても店の強化は残る', () => {
    const w = createWorld('dog', 1, VIEW, { might: 2 });
    levelUp(w, { kind: 'passive', id: 'fang', level: 1 });
    expect(w.stats.might).toBeCloseTo(animal('dog').might + 0.1 + 0.1);
  });

  it('強化個体は必ずコインを 5 枚、ボスは大袋を落とす', () => {
    const w = createWorld('dog', 1, VIEW);
    w.enemies.push(makeEnemy(eliteOf(ENEMIES.rat), 100, 0, 1));
    damageEnemy(w, 0, 99, 0, 0);
    expect(w.items.filter((i) => i.alive && i.kind === 'coin')).toHaveLength(5);
    w.enemies.push(makeEnemy(ENEMIES.bear, 100, 0, 1));
    damageEnemy(w, 1, 99, 0, 0);
    expect(w.items.filter((i) => i.alive && i.kind === 'purse')).toHaveLength(1);
  });

  it('コインを拾うと強欲を掛けて数え、出来事を出す', () => {
    const w = createWorld('dog', 1, VIEW, { greed: 5 });
    w.items.push({ alive: true, kind: 'coin', x: 0, y: 0, pulled: false });
    w.items.push({ alive: true, kind: 'purse', x: 0, y: 0, pulled: false });
    collect(w, 1 / 60);
    expect(w.coins).toBeCloseTo(51 * 1.5);
    expect(w.events.filter((e) => e.type === 'coin')).toHaveLength(2);
  });

  it('宝箱を開けると 10 枚と開けた数、クリアで 100 枚', () => {
    const w = createWorld('dog', 1, VIEW);
    w.chests = 1;
    openChest(w);
    expect([w.coins, w.opened]).toEqual([10, 1]);
    w.time = w.stage.length;
    step(w, { x: 0, y: 0 }, 1 / 60);
    expect(summary(w).coins).toBe(110);
  });

  it('復活は 1 回だけ効き、HP 半分・2 秒の無敵・周りを吹き飛ばす', () => {
    const w = createWorld('dog', 1, VIEW, { revive: 1 });
    w.enemies.push(makeEnemy(ENEMIES.rat, 20, 0, 10));
    hurtPlayer(w, 999);
    expect(w.over).toBeNull();
    expect(w.player.hp).toBe(Math.round(w.stats.maxHp / 2));
    expect(w.player.invuln).toBe(2);
    expect(w.enemies[0].kx).toBeGreaterThan(0);
    expect(w.events.some((e) => e.type === 'revive')).toBe(true);
    w.player.invuln = 0;
    hurtPlayer(w, 999);
    expect(w.over).toBe('dead');
  });
});
```

（`levelUp` を `./choices` から import する。）

`prompts.svelte.test.ts` に足す。

```ts
it('リロールは残りがあるときだけ 3 択を引き直し、残りを減らす', () => {
  const w = createWorld('dog', 1, { w: 260, h: 380 }, { reroll: 1 });
  w.pending = 1;
  const p = new Prompts(w);
  p.next(null);
  const first = p.options;
  p.reroll(null);
  expect(w.rerolls).toBe(0);
  expect(p.options).not.toBe(first);
  const second = p.options;
  p.reroll(null);
  expect(p.options).toBe(second);
  p.stop();
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/`
Expected: FAIL（`createWorld` が 4 つめの引数を見ない、`coin` が無い など）

- [ ] **Step 3: `world.ts` に足す**

- `import { perks, type Ranks } from './upgrades';`
- `World` に `boost: Partial<Stats>; greed: number; rerolls: number; revives: number;`
- `GameEvent` に `| { type: 'coin'; value: number } | { type: 'revive' }`
- `createWorld(id, seed, view, ranks: Ranks = {})` の中で `const k = perks(ranks); const s = stats(a, [], k.boost);` とし、返り値に `boost: k.boost, greed: k.greed, rerolls: k.rerolls, revives: k.revives` を足す。
- `hurtPlayer` の `if (p.hp > 0) return;` のあとを次にする。

```ts
if (w.revives > 0) {
  w.revives -= 1;
  p.hp = Math.round(w.stats.maxHp / 2);
  p.invuln = REVIVE_INVULN;
  for (const e of w.enemies) {
    if (!e.alive || e.def.boss) continue;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > REVIVE_REACH) continue;
    e.kx += (dx / d) * REVIVE_PUSH;
    e.ky += (dy / d) * REVIVE_PUSH;
  }
  w.events.push({ type: 'revive' });
  return;
}
```

定数は `const REVIVE_INVULN = 2; const REVIVE_REACH = 80; const REVIVE_PUSH = 400;`。

- クリアの分岐（`w.over = 'clear';` の前）に `w.coins += CLEAR_COINS * w.greed;` を足す（`CLEAR_COINS` は `drops.ts` から import）。

- [ ] **Step 4: `drops.ts` に足す**

- `Item['kind']` を `'meat' | 'magnet' | 'chest' | 'coin' | 'purse'` にする。
- `export const CLEAR_COINS = 100; export const CHEST_COINS = 10; const PURSE = 50; const ELITE_COINS = 5; const COIN_CHANCE = 0.03;`
- `dropFrom` のボスの分岐で、宝箱の前に `dropItem(w, 'purse', e.x + 12, e.y);`。ふつうの敵の分岐の最後に次を足す。

```ts
if (e.def.elite)
  for (let i = 0; i < ELITE_COINS; i++) {
    const a = (i / ELITE_COINS) * Math.PI * 2;
    dropItem(w, 'coin', e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8);
  }
else if (w.rand() < COIN_CHANCE) dropItem(w, 'coin', e.x - 4, e.y);
```

- `collect` の `if (it.kind === 'meat') {…} else {…磁石…}` の前に足す。

```ts
if (it.kind === 'coin' || it.kind === 'purse') {
  const value = it.kind === 'coin' ? 1 : PURSE;
  w.coins += value * w.greed;
  w.events.push({ type: 'coin', value });
  continue;
}
```

（`dropFrom` で乱数を引く回数が増えると、同じ種の回の流れが変わる。ふつうの敵は `COIN_CHANCE` の 1 回だけ足す。world.test.ts などで種と結果を固めたテストが落ちたら、期待値ではなく乱数を引く順を見直す。肉と磁石の判定より後で引けば、肉と磁石の出方は変わらない。）

- [ ] **Step 5: `chest.ts`・`choices.ts`・`prompts.svelte.ts`**

`openChest` の先頭（`w.chests = …` の次）に `w.opened += 1; w.coins += CHEST_COINS * w.greed;`。

`choices.ts` の `levelUp` の `w.stats = stats(w.animal, w.passives);` を `w.stats = stats(w.animal, w.passives, w.boost);` にする。

`Prompts` に足す。

```ts
  get rerolls(): number {
    return this.#w.rerolls;
  }

  /** 3 択を引き直す。引き直した札も出た直後の合成 click を捨てる */
  reroll(finger: number | null): void {
    const w = this.#w;
    if (!this.options || w.rerolls <= 0) return;
    w.rerolls -= 1;
    this.options = choices(w);
    this.lock.begin(finger);
  }
```

`rerolls` は `$state` でない値を読むので、画面は `options` が変わったときに読み直す（`reroll` は必ず `options` を変える）。

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Drop coins and give Animal Survivors' runs the shop's rerolls and revive"
```

### Task 6: コインの見え方とリロールのボタン

**Files:**

- Modify: `src/lib/games/animal-survivors/draw.ts`, `hud.ts`, `effects.ts`, `sounds.ts`, `LevelUp.svelte`, `Play.svelte`
- Test: `src/lib/games/animal-survivors/LevelUp.svelte.test.ts`（新）

**Interfaces:**

- Consumes: `World.coins`、`ITEM_ART.coin`・`purse`（Task 1）、`Prompts.reroll`・`rerolls`（Task 5）
- Produces: `LevelUp` の props に `rerolls: number; onreroll: () => void`

- [ ] **Step 1: 失敗するテストを書く**

`LevelUp.svelte.test.ts`（描画は node のテストで canvas が無いので、HUD と床のコインは Step 5 の headless で見る）:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { Choice } from './choices';
import LevelUp from './LevelUp.svelte';

const options: Choice[] = [{ kind: 'meat' }, { kind: 'bag' }];

function show(rerolls: number) {
  const calls: string[] = [];
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(LevelUp, {
    target,
    props: { options, locked: false, rerolls, onpick: () => calls.push('pick'), onreroll: () => calls.push('reroll') }
  });
  flushSync();
  const reroll = () => [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('引き直す'));
  return { app, calls, reroll };
}

describe('LevelUp', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('リロールが残っていれば「引き直す（のこり N）」を出し、押すと onreroll', () => {
    const { app, calls, reroll } = show(2);
    expect(reroll()?.textContent).toContain('のこり 2');
    reroll()!.click();
    expect(calls).toEqual(['reroll']);
    unmount(app);
  });

  it('残りが無ければ出さない', () => {
    const { app, reroll } = show(0);
    expect(reroll()).toBeUndefined();
    unmount(app);
  });

  it('R キーでも引き直す', () => {
    const { app, calls } = show(1);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    expect(calls).toEqual(['reroll']);
    unmount(app);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/LevelUp.svelte.test.ts`
Expected: FAIL（引き直すボタンが無い）

- [ ] **Step 3: 実装する**

- `draw.ts` の床の品を描く行で、コインは 2 フレームを時間で回す: `sprite(ctx, ITEM_ART[it.kind], it.kind === 'coin' ? Math.floor(now * 6) % 2 : 0, …)`。
- `hud.ts` の撃破数の下（`top + 11` の行の右寄せ）に、コインの絵と `Math.floor(w.coins)` を出す。

```ts
const coins = String(Math.floor(w.coins));
const cx = v.w - 6 - textWidth(coins);
text(ctx, coins, cx, top + 11, PALETTE.y);
ctx.drawImage(bake(ITEM_ART.coin), cx - 10, top + 9);
```

- `sounds.ts` に足す。

```ts
  coin: () => {
    tone(1568, 50, 'square', 0.04);
    tone(2093, 120, 'square', 0.04, 50);
  },
  revive: () => {
    for (const [i, f] of [392, 523, 784, 1047].entries()) tone(f, 180, 'triangle', 0.09, i * 80);
  },
```

- `effects.ts` の `take` に足す。コインは大群で一度に拾うことがあるので、`hit` と同じく 1 フレームに 1 回にまとめる（`let coin = false;` を足し、最後に `if (coin) sounds.coin();`）。

```ts
      } else if (e.type === 'coin') {
        coin = true;
        if (e.value > 1) this.#number(`+${e.value}`, w.player.x, w.player.y - 14, PALETTE.y, 2);
      } else if (e.type === 'revive') {
        this.flash = 0.3;
        const p = w.player;
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          this.#bit(p.x, p.y, Math.cos(a) * 140, Math.sin(a) * 140, 0.6, i % 2 ? PALETTE.r : PALETTE.w, 3);
        }
        sounds.revive();
```

- `LevelUp.svelte` の props に `rerolls: number; onreroll: () => void` を足し、カードの並びの下に足す。

```svelte
{#if rerolls > 0}
  <button class="as-card reroll" onclick={onreroll}>引き直す（のこり {rerolls}）</button>
{/if}
```

```css
.reroll {
  justify-content: center;
  background: #d6e8ff;
  font-size: min(4cqw, 2.4cqh, 20px);
}
```

キーボードは R で引き直す（`key()` の先頭で `if (!locked && event.key.toLowerCase() === 'r' && rerolls > 0) { event.preventDefault(); onreroll(); return; }`）。

- `Play.svelte` の `<LevelUp …>` に `rerolls={prompts.rerolls}` と `onreroll={() => prompts.reroll(stick?.id ?? null)}` を足す。`createWorld` の呼び出しは Task 7 で店の段を渡す（この Task では今のまま）。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check && pnpm vitals --diff`
Expected: PASS

- [ ] **Step 5: headless で撮る**

`Play.svelte` に一時的に `(window as any).__w = world;` を入れ（commit しない）、scratchpad の台本で犬で始めて、自分の周りに `coin` を 3 枚・`purse` を 1 つ置いた画面と、拾ったあと（HUD のコインの数が 53 になる）を撮って Read で見る。床のコインが回って見えること、HUD の数が撃破数と重ならないことを確かめ、フックを外す。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Show Animal Survivors' coins and offer rerolls on level-up"
```

### Task 7: 一時停止のメニュー

**Files:**

- Create: `src/lib/games/animal-survivors/Pause.svelte`
- Create: `src/lib/games/animal-survivors/pause.ts`（メニューを開いてよいかの純粋な関数）
- Modify: `src/lib/games/animal-survivors/Play.svelte`, `Survivors.svelte`, `CharSelect.svelte`, `meta.ts`
- Test: `src/lib/games/animal-survivors/pause.test.ts`（新）, `src/lib/games/animal-survivors/Pause.svelte.test.ts`（新）

**Interfaces:**

- Consumes: `onquit`（Task 2）、`Lock`、`loadRecords`（`ranks`）
- Produces:
  - `canPause(w: World, busy: boolean): boolean`（`!w.over && !busy`）
  - `Pause.svelte` の props `{ run: RunSummary; onresume: () => void; onrestart: () => void; onquit: () => void }`
  - `Play.svelte` の props `{ animal; ranks: Ranks; onover; onend; onrestart }`
  - `CharSelect.svelte` の props に `onquit: () => void`
  - `meta.ts` に `ownMenu: true`

- [ ] **Step 1: 失敗するテストを書く**

`pause.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canPause } from './pause';
import { createWorld } from './world';

describe('一時停止', () => {
  it('決着したあと・3 択や宝箱が出ているあいだは開かない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    expect(canPause(w, false)).toBe(true);
    expect(canPause(w, true)).toBe(false);
    w.over = 'dead';
    expect(canPause(w, false)).toBe(false);
  });
});
```

`Pause.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Pause from './Pause.svelte';
import type { RunSummary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

const run: RunSummary = {
  animal: 'dog',
  cleared: false,
  time: 125,
  level: 7,
  kills: 80,
  xp: 0,
  weapons: [{ id: 'bone', level: 2 }],
  passives: [],
  bosses: [],
  coins: 12,
  opened: 0
};

function show() {
  const calls: string[] = [];
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Pause, {
    target,
    props: {
      run,
      onresume: () => calls.push('resume'),
      onrestart: () => calls.push('restart'),
      onquit: () => calls.push('quit')
    }
  });
  flushSync();
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement;
  return { target, app, calls, button };
}

describe('Pause', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('つづけるはすぐ効く', () => {
    const { app, calls, button } = show();
    button('つづける').click();
    expect(calls).toEqual(['resume']);
    unmount(app);
  });

  it('やめるは確かめてから効き、確かめは出て 350ms は効かない', () => {
    const { target, app, calls, button } = show();
    button('やめる').click();
    flushSync();
    expect(calls).toEqual([]);
    expect(target.textContent).toContain('本当にやめますか');
    expect(target.querySelector('.as-locked')).not.toBeNull();
    vi.advanceTimersByTime(400);
    flushSync();
    expect(target.querySelector('.as-locked')).toBeNull();
    button('やめる').click();
    expect(calls).toEqual(['quit']);
    unmount(app);
  });

  it('確かめで「つづける」を押すとメニューに戻る', () => {
    const { target, app, calls, button } = show();
    button('最初からやり直す').click();
    flushSync();
    vi.advanceTimersByTime(400);
    flushSync();
    button('つづける').click();
    flushSync();
    expect(calls).toEqual([]);
    expect(target.textContent).toContain('ポーズ');
    unmount(app);
  });
});
```

（happy-dom では `pointer-events: none` で click は止まらないので、350ms の確かめは `.as-locked` が付いていることで見る。実際に止まるのは CSS の `.as-locked .as-card { pointer-events: none }`。）

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/pause.test.ts src/lib/games/animal-survivors/Pause.svelte.test.ts`
Expected: FAIL（ファイルが無い）

- [ ] **Step 3: `pause.ts` と `Pause.svelte` を作る**

`pause.ts`:

```ts
import type { World } from './world';

/** 決着したあとと、3 択・宝箱の画面のあいだは開かない（どちらもすでに止まっていて、重ねると押し間違える） */
export function canPause(w: World, busy: boolean): boolean {
  return !w.over && !busy;
}
```

`Pause.svelte`:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { audio, toggleMute } from '$lib/audio.svelte';
  import { ITEM_ART } from './art/items';
  import { clock } from './hud';
  import { Lock } from './lock.svelte';
  import PixelIcon from './PixelIcon.svelte';
  import type { RunSummary } from './world';

  let {
    run,
    onresume,
    onrestart,
    onquit
  }: { run: RunSummary; onresume: () => void; onrestart: () => void; onquit: () => void } = $props();

  let asking = $state<'restart' | 'quit' | null>(null);
  // 確かめの「やめる」はメニューの「やめる」と近い位置に出るので、2 度押しで決まらないよう少し止める
  const lock = new Lock();
  onDestroy(() => lock.stop());

  function ask(what: 'restart' | 'quit') {
    asking = what;
    lock.begin(null);
  }

  const owned = $derived([
    ...run.weapons.map((o) => ({ ...o, key: `weapon-${o.id}` })),
    ...run.passives.map((o) => ({ ...o, key: `passive-${o.id}` }))
  ]);
</script>

<div class="veil">
  {#if asking}
    <section class="as-panel" class:as-locked={lock.active} aria-label="確かめ">
      <h2 class="as-title">{asking === 'quit' ? 'やめる？' : 'やり直す？'}</h2>
      <p class="note">
        {asking === 'quit' ? '本当にやめますか？' : '本当に最初からやり直しますか？'}<br
        />ここまでのコインと記録は残ります
      </p>
      <button class="as-card danger" onclick={asking === 'quit' ? onquit : onrestart}
        >{asking === 'quit' ? 'やめる' : 'やり直す'}</button
      >
      <button class="as-card" onclick={() => (asking = null)}>つづける</button>
    </section>
  {:else}
    <section class="as-panel" aria-label="ポーズ">
      <h2 class="as-title">ポーズ</h2>
      <p class="now">{clock(run.time)}　Lv.{run.level}　コイン {run.coins}</p>
      <ul class="owned" aria-label="取った武器とパッシブ">
        {#each owned as o (o.key)}
          <li class="slot">
            <PixelIcon art={ITEM_ART[o.key]} size="min(8cqw, 4.6cqh, 40px)" /><span class="lv">{o.level}</span>
          </li>
        {/each}
      </ul>
      <button class="as-card" onclick={onresume}>つづける</button>
      <button class="as-card" onclick={toggleMute}>音 {audio.muted ? 'オフ' : 'オン'}</button>
      <button class="as-card" onclick={() => ask('restart')}>最初からやり直す</button>
      <button class="as-card" onclick={() => ask('quit')}>やめる</button>
    </section>
  {/if}
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: grid;
    place-items: center;
    padding: 16px;
    background: rgb(20 10 30 / 0.7);
  }

  .as-card {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }

  .danger {
    background: #ffb4a8;
  }

  .now,
  .note {
    margin: 0;
    text-align: center;
    font-size: min(4cqw, 2.4cqh, 20px);
  }

  .owned {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    justify-content: center;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .slot {
    position: relative;
    padding: 3px;
    background: #1f1530;
  }

  .lv {
    position: absolute;
    right: 2px;
    bottom: 0;
    color: #ffd84a;
    font-size: min(3cqw, 1.8cqh, 14px);
    text-shadow: 1px 1px 0 #24151f;
  }
</style>
```

- [ ] **Step 4: `Play.svelte` に一時停止をつなぐ**

- props を `{ animal, ranks, onover, onend, onrestart }: { animal: AnimalId; ranks: Ranks; onover: (w: World) => void; onend: () => void; onrestart: () => void }` にし、`createWorld(animal, Date.now() % 2 ** 31, { w: view.w, h: view.h }, ranks)` にする。
- `let paused = false;` を `let menu = $state(false);` と `let hidden = false;` に分ける。`frame` の止める条件を `!prompts.busy && !menu && !hidden` にする。
- `let ended = false;` を足し、`frame` の決着の判定を `if (world.over && !ended) { ended = true; onover(world); endTimer = setTimeout(onend, …); }` にする。
- 開く・閉じる・やめる・やり直す:

```ts
function pause() {
  if (!canPause(world, prompts.busy)) return;
  menu = true;
  stick = null;
  keys.clear();
}

/** やめるとやり直すは倒れたときと同じに記録する（コインを失わないため） */
function leave(again: boolean) {
  if (ended) return;
  ended = true;
  world.over = 'dead';
  onover(world);
  if (again) onrestart();
  else onend();
}
```

- `keydown` の先頭に `if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); if (menu) menu = false; else pause(); return; }` を足す。
- `onvisibilitychange` を `hidden = document.hidden; if (hidden) pause();` にする（3 択が出ていれば開かず、そのまま止まっている）。
- 盤面の外（`{#if prompts.warning}` の前）に足す。

```svelte
{#if !menu && !prompts.busy && !world.over}
  <button class="as-pause" onclick={pause} aria-label="一時停止">Ⅱ</button>
{/if}
{#if menu}
  <Pause
    run={summary(world)}
    onresume={() => (menu = false)}
    onrestart={() => leave(true)}
    onquit={() => leave(false)}
  />
{/if}
```

`world.over` は `$state` でないので、`ended` を `$state` にして `{#if !menu && !prompts.busy && !ended}` で見る。

```css
.as-pause {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  left: max(12px, env(safe-area-inset-left));
  z-index: 5;
  width: 48px;
  height: 48px;
  border: 3px solid #24151f;
  background: #fff3d6;
  box-shadow: 0 4px 0 #8a6a4a;
  color: #24151f;
  font: inherit;
  font-size: 22px;
  font-weight: 800;
}
```

`Play.svelte` が 200 行を越えたら、`.as-pause` の CSS を `retro.css` に移す（`as-` の名前なので他のゲームに効かない）。

- [ ] **Step 5: `Survivors.svelte`・`CharSelect.svelte`・`meta.ts`**

`meta.ts` に `ownMenu: true,` を足す。

`Survivors.svelte`:

- `let { onquit }: SoloProps = $props();`（`_props` をやめる）
- `let ranks = $state<Ranks>({});` を足し、`onMount` と `over()` で `loadRecords().ranks` を入れる。
- `<Play {animal} {ranks} onover={over} onend={end} onrestart={() => start(animal)} />`
- `<CharSelect {unlocked} onpick={start} onquit={() => onquit?.()} />`

`CharSelect.svelte` に、パネルの外（`.as-screen` の中、パネルの前）へ足す。

```svelte
<button class="round corner back" onclick={onquit} aria-label="タイトルへ戻る">✕</button>
<button class="round corner mute" onclick={toggleMute} aria-label="ミュート" aria-pressed={audio.muted}>
  <Icon name={audio.muted ? 'mute' : 'speaker'} size="26px" />
</button>
```

```css
.corner {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  z-index: 5;
}

.back {
  left: max(12px, env(safe-area-inset-left));
}

.mute {
  right: max(12px, env(safe-area-inset-right));
}
```

（`.round` は `app.css` の共通の丸いボタン。`as-screen` はスクロールするので、隅のボタンも一緒に流れる。上の余白は `as-screen` の padding が取ってある。）

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ src/lib/components/ && pnpm check && pnpm vitals --diff && pnpm lint`
Expected: PASS

- [ ] **Step 7: headless で通しを撮る**

`pnpm dev` が `5173` で動いている前提で、scratchpad の `pause-flow.mjs`（`roster-ui.mjs` と同じ形。`page.clock` で時間を止めて進める）で次を確かめて撮る。

1. タイトル → キャラ選択に ✕ と音のボタンがあり、ステージの隅に「やめる」「やりなおし」が無い。
2. 犬で始めて 2 秒進め、「一時停止」を押す → メニューが出る。さらに 5 秒進めても `clock` の表示（メニューの `.now`）が変わらない。
3. 「つづける」→ メニューが消え、時間が進む。
4. Esc → メニューが出る。`document.hidden` を `Object.defineProperty` で true にして `visibilitychange` を投げ、false に戻して投げる → メニューが開いたまま。
5. 「やめる」→ 確かめ → 400ms 進めて「やめる」→ リザルトが出て、localStorage の記録の `best` が入っている。
6. 「もう一度」で始め、メニュー → 「最初からやり直す」→ 確かめ → 「やり直す」→ リザルトを出さず、時間が 0 から進む。
7. キャラ選択の ✕ でタイトルへ戻る。

- [ ] **Step 8: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Pause Animal Survivors from its own menu and confirm before quitting"
```

### Task 8: 店と実績の画面、リザルトの帯

**Files:**

- Create: `src/lib/games/animal-survivors/Shop.svelte`, `src/lib/games/animal-survivors/Trophies.svelte`
- Modify: `src/lib/games/animal-survivors/Survivors.svelte`, `CharSelect.svelte`, `Result.svelte`
- Test: `src/lib/games/animal-survivors/Shop.svelte.test.ts`（新）

**Interfaces:**

- Consumes: `UPGRADES`・`price`・`buy`（Task 3）、`ACHIEVEMENTS`・`grant`（Task 4）、`loadRecords`・`saveRecords`
- Produces:
  - `Shop.svelte` の props `{ onback: () => void }`（中で記録を読み、買うたびに保存する）
  - `Trophies.svelte` の props `{ onback: () => void }`
  - `CharSelect.svelte` の props に `coins: number; trophies: [number, number]; onshop: () => void; ontrophies: () => void`
  - `Result.svelte` の props の `fresh: AnimalId[]` を `got: AchievementDef[]; coins: number; total: number` にする

- [ ] **Step 1: 失敗するテストを書く**

`Shop.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RECORDS_KEY, emptyRecords, loadRecords } from './records';
import Shop from './Shop.svelte';
import { UPGRADES } from './upgrades';

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Shop, { target, props: { onback: () => {} } });
  flushSync();
  const card = (id: string) => target.querySelector(`[data-upgrade="${id}"]`) as HTMLButtonElement;
  return { target, app, card };
}

describe('Shop', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => (document.body.innerHTML = ''));

  it('買うとコインが減って段が上がり、保存され、はじめての買い物の実績が入る', () => {
    const r = emptyRecords();
    r.coins = UPGRADES[0].base;
    localStorage.setItem(RECORDS_KEY, JSON.stringify(r));
    const { target, app, card } = show();
    card('might').click();
    flushSync();
    const saved = loadRecords();
    expect(saved.ranks.might).toBe(1);
    expect(saved.achieved).toContain('firstBuy');
    expect(saved.coins).toBe(20);
    expect(target.textContent).toContain('はじめてのパワーアップ');
    unmount(app);
  });

  it('足りない品は押せない', () => {
    const { app, card } = show();
    expect(card('revive').disabled).toBe(true);
    unmount(app);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/Shop.svelte.test.ts`
Expected: FAIL（ファイルが無い）

- [ ] **Step 3: `Shop.svelte` を作る**

```svelte
<script lang="ts">
  import { grant, type AchievementDef } from './achievements';
  import { ITEM_ART } from './art/items';
  import PixelIcon from './PixelIcon.svelte';
  import { loadRecords, saveRecords } from './records';
  import { UPGRADES, buy, price, type UpgradeId } from './upgrades';

  let { onback }: { onback: () => void } = $props();

  let r = $state(loadRecords());
  let got = $state<AchievementDef[]>([]);

  function purchase(id: UpgradeId) {
    if (!buy(r, id)) return;
    got = grant(r, null);
    saveRecords($state.snapshot(r));
  }
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="パワーアップ">
    <h2 class="as-title">パワーアップ</h2>
    <p class="purse">
      <PixelIcon art={ITEM_ART.coin} size="min(5cqw, 3cqh, 26px)" />
      {r.coins.toLocaleString('ja-JP')}
    </p>
    {#each got as a (a.id)}
      <p class="as-trophy">実績達成！ {a.name}　+{a.coins}</p>
    {/each}
    <div class="grid">
      {#each UPGRADES as d (d.id)}
        {@const rank = r.ranks[d.id] ?? 0}
        {@const full = rank >= d.max}
        <button
          class="as-card item"
          data-upgrade={d.id}
          disabled={full || r.coins < price(d, rank)}
          onclick={() => purchase(d.id)}
        >
          <PixelIcon art={ITEM_ART[d.icon]} size="min(9cqw, 5cqh, 48px)" />
          <span class="body">
            <b>{d.name}</b>
            <span class="pips">{'■'.repeat(rank)}{'□'.repeat(d.max - rank)}</span>
            <span class="blurb">{d.blurb}</span>
            <span class="price">{full ? 'MAX' : `${price(d, rank).toLocaleString('ja-JP')} コイン`}</span>
          </span>
        </button>
      {/each}
    </div>
    <button class="as-card back" onclick={onback}>もどる</button>
  </section>
</div>

<style>
  .purse {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: center;
    margin: 0;
    color: #ffd84a;
    font-size: min(5cqw, 3cqh, 26px);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 230px), 1fr));
    gap: 8px;
  }

  .item:disabled {
    cursor: default;
    opacity: 0.55;
  }

  .body {
    display: grid;
    gap: 2px;
    font-size: min(3.2cqw, 1.9cqh, 16px);
  }

  .pips {
    color: #d8463c;
    letter-spacing: 0.1em;
  }

  .blurb {
    color: #5d3a2a;
  }

  .price {
    color: #a3501c;
  }

  .back {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }
</style>
```

`retro.css` に、実績の帯（店とリザルトで共用）と、押せないカードを光らせない規則を足す。

```css
.as-card:disabled:hover {
  background: inherit;
}

.as-trophy {
  margin: 0;
  padding: 6px 12px;
  border: 3px solid #ffd84a;
  background: #3a2a14;
  color: #fff3d6;
  text-align: center;
  font-size: min(4cqw, 2.4cqh, 20px);
}
```

（`.as-card:disabled:hover` の `inherit` で `.closed` のような個別の地の色が消えるときは、`.as-card:not(:disabled):hover, .as-card:focus-visible` に今の規則を書き換える。）

- [ ] **Step 4: `Trophies.svelte` を作る**

```svelte
<script lang="ts">
  import { ACHIEVEMENTS } from './achievements';
  import { animal } from './animals';
  import { loadRecords } from './records';

  let { onback }: { onback: () => void } = $props();

  const r = loadRecords();
  const done = ACHIEVEMENTS.filter((a) => r.achieved.includes(a.id)).length;
  const n = (v: number) => Math.floor(v).toLocaleString('ja-JP');
</script>

<div class="as-screen">
  <section class="as-panel" aria-label="実績">
    <h2 class="as-title">実績</h2>
    <p class="count">{done} / {ACHIEVEMENTS.length} 達成</p>
    <ul>
      {#each ACHIEVEMENTS as a (a.id)}
        {@const got = r.achieved.includes(a.id)}
        {@const p = a.progress?.(r)}
        <li class:got>
          <span class="mark">{got ? '✓' : ''}</span>
          <span class="name">{a.name}</span>
          <span class="reward">+{a.coins}{a.animal ? `・${animal(a.animal).name}` : ''}</span>
          {#if p && !got}<span class="progress">{n(Math.min(p[0], p[1]))} / {n(p[1])}</span>{/if}
        </li>
      {/each}
    </ul>
    <button class="as-card back" onclick={onback}>もどる</button>
  </section>
</div>

<style>
  .count {
    margin: 0;
    text-align: center;
    color: #ffd84a;
    font-size: min(5cqw, 3cqh, 26px);
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    grid-template-columns: 1.4em 1fr auto;
    gap: 2px 8px;
    align-items: center;
    padding: 6px 10px;
    background: #1f1530;
    color: #8a7aa8;
    font-size: min(3.6cqw, 2.1cqh, 18px);
  }

  li.got {
    background: #3a2a14;
    color: #fff3d6;
  }

  .mark {
    color: #8fd14f;
  }

  .reward {
    color: #ffd84a;
  }

  .progress {
    grid-column: 2 / -1;
    font-size: 0.85em;
  }

  .back {
    justify-content: center;
    font-size: min(4.6cqw, 2.8cqh, 24px);
  }
</style>
```

（「✓」は文字で、絵文字ではない。端末で絵文字に化けたら `Icon.svelte` の既存のチェックの形か、`■` に替える。）

- [ ] **Step 5: `Survivors.svelte`・`CharSelect.svelte`・`Result.svelte` をつなぐ**

`Survivors.svelte`:

- `screen` に `'shop' | 'trophies'` を足す。
- `let records = $state(emptyRecords());` に寄せ、`unlocked`・`ranks` は `records` から読む（`onMount` と `over()` と画面を戻すたびに `records = loadRecords()`）。
- `over(w)` で `got = record(r, run); saveRecords(r); records = r;`。`let got = $state<AchievementDef[]>([]);`（`fresh` をやめる）。
- 画面:

```svelte
{#if screen === 'select'}
  <CharSelect
    unlocked={records.unlocked}
    coins={records.coins}
    trophies={[records.achieved.length, ACHIEVEMENTS.length]}
    onpick={start}
    onquit={() => onquit?.()}
    onshop={() => (screen = 'shop')}
    ontrophies={() => (screen = 'trophies')}
  />
{:else if screen === 'shop'}
  <Shop onback={back} />
{:else if screen === 'trophies'}
  <Trophies onback={back} />
{:else if screen === 'play'}
```

`function back() { records = loadRecords(); screen = 'select'; }`

`CharSelect.svelte` のパネルの最後（動物のカードの後）に足す。

```svelte
<div class="links">
  <button class="as-card link" onclick={onshop}>
    <PixelIcon art={ITEM_ART.coin} size="min(5cqw, 3cqh, 26px)" /> パワーアップ（{coins.toLocaleString('ja-JP')}）
  </button>
  <button class="as-card link" onclick={ontrophies}>実績 {trophies[0]} / {trophies[1]}</button>
</div>
```

```css
.links {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.link {
  justify-content: center;
  font-size: min(3.8cqw, 2.2cqh, 19px);
}
```

`Result.svelte`:

- props の `fresh` を `got: AchievementDef[]; coins: number; total: number` にする。
- 今の `{#each fresh as id (id)}` の NEW の帯は `{#each got.filter((a) => a.animal) as a (a.id)}` から `a.animal` で出す。
- その下に `<p class="coins">+{coins} コイン（もちもの {total.toLocaleString('ja-JP')}）</p>` と `{#each got as a (a.id)}<p class="as-trophy">実績達成！ {a.name}　+{a.coins}</p>{/each}` を足す。
- 実績がたくさん並ぶと縦にあふれるので、`.as-screen` のスクロールに任せる（`place-items: center` の grid は中身が高いと上から並ぶ）。
- `Survivors` から `<Result {run} {got} coins={run.coins} total={records.coins} …>` を渡す。

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check && pnpm vitals --diff && pnpm lint`
Expected: PASS

- [ ] **Step 7: headless で撮る**

scratchpad の `progress-ui.mjs` で次を確かめて撮る（iPad 820×1180 と iPhone 390×844）。

1. コイン 1000 の記録を入れてキャラ選択 → 「パワーアップ（1,000）」「実績 0 / 23」。
2. 店で攻撃を買う → 940 に減り、■□□□□、「実績達成！ はじめてのパワーアップ +20」。
3. 店で復活は押せない（`disabled`）。
4. 実績の画面 → 「1 / 23 達成」、合計 3000 体の途中経過。
5. 犬で始めて `window.__w`（一時的なフック。commit しない）で時間を 301 秒・HP 1 にして倒れる → リザルトに「NEW! キツネ」「+N コイン（もちもの …）」「実績達成！ 1 分生き延びる」「実績達成！ 5 分生き延びる」。
6. 390×844 で店と実績がスクロールで最後まで押せる。

- [ ] **Step 8: Commit**

```bash
git add src/lib/games/animal-survivors/
git commit -m "Add Animal Survivors' shop and achievements screens and show them on the result"
```

### Task 9: ボットで確かめて、文書を最新にする

**Files:**

- Modify: `src/lib/games/animal-survivors/upgrades.ts`（数値を直すときだけ）
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/specs/2026-10-02-animal-survivors-progress-design.md`（直した数値と「調整の結果」）

- [ ] **Step 1: ボットで測る**

scratchpad の `sim/survivors.sim.ts`（[[balance-sim-harness]] の形）を、`createWorld(animal, seed, VIEW, ranks)` を受けるように直し、次の 2 つを 7 匹 × 2 つの選び方 × 8 種で回す。

- `ranks = {}`（強化なし）。生存の中央値が前の結果（新しい 4 匹は 10.4〜15 分、今の 3 匹は 9.4〜15 分）から変わらないこと。コインの乱数を足したぶんの揺れはあるが、中央値が 1 分以上ずれたら乱数を引く順を見直す。
- `ranks` を全部最大。生存の中央値と、1 回のコインの中央値を記録する。
- コインの中央値（強化なし）× 30 回が、全部の値段の合計（今の表で 9,650）と実績のコインの合計（3,570）の差に近いこと。大きく外れたら `base` を一律に掛け直す。

- [ ] **Step 2: 文書を直す**

`CLAUDE.md` の Animal Survivors の段落に、一時停止（`meta.ownMenu`・`Pause.svelte`・やめる/やり直すは記録してから・確かめは `Lock`）・コイン（`coin`/`purse`、強欲は合計に掛ける）・店（`upgrades.ts`、`stats()` の `boost`）・実績（`achievements.ts`、`grant()` は増えなくなるまで見る、動物の解放は実績のごほうび）を足し、`record()` の説明を実績に合わせる。`SoloShell` の段落に `meta.ownMenu` と `onquit` を足す。spec は数値を直したら合わせ、「## 8. 調整の結果」に測った数を書く。

- [ ] **Step 3: まとめて確かめる**

Run: `pnpm verify`
Expected: 全部 PASS

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/superpowers/specs/2026-10-02-animal-survivors-progress-design.md src/lib/games/animal-survivors/upgrades.ts
git commit -m "Check Animal Survivors' shop with the bot and document the pause menu and progression"
```

- [ ] **Step 5: 全体を見てもらう**

別の係（最も強いモデル）にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
