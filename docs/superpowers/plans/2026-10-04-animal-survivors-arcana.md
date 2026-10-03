# Animal Survivors アルカナ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** その回だけルールを変える札 16 枚を、はじめに 1 枚と 4:00・8:00 のボスのあとに 3 枚から選べるようにする（3 枚まで、1 枚は引き換えの札）。

**Architecture:** 札の表・開いている札・候補・取ったときの効き方は DOM を使わない `arcana.ts` に置く。`createWorld` の後ろの引数を `{ challenge, heat, arcana }` の 1 つにまとめ、`arcana` に開いている札を渡すと、はじめの 1 枚を待つ（`World.arcanaPending`）。ボスの行の印で倒したときに 1 枚足す。画面は `Prompts` が宝箱より先に出す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest（unit と dom）、scratchpad のボット

**Spec:** `docs/superpowers/specs/2026-10-04-animal-survivors-arcana-design.md`

## Global Constraints

- 札は 16 枚（うれしい 8・引き換え 8）。8 枚は実績で開き、開いているかは達成済みの実績から決める（記録に新しく残さない）。
- 持てるのは 3 枚まで。候補は持っていない開いた札から 3 枚、引き換えが残っていれば 1 枚は引き換え。
- お題の回と延長戦では札を出さない。札を渡さない `createWorld` は今とまったく同じ。
- 新しい絵は使う前に見本を見せる。コンポーネントは 200 行未満・props 6 つまで。コメントは非自明な WHY だけ。`pnpm verify` が通ること。

## Review Focus

- 札の候補が 0 枚（全部持った・開いた札が少ない）のとき、画面が空のまま止まらない（Task 2 のテスト）。
- 最大 HP が変わる札（いちかばちか・命の泉）を取ったとき、HP が最大を超えず、育ちやパッシブで作り直しても倍率が残る（Task 1 のテスト）。
- 敵の出る数を増やす札を 2 枚取ると掛け算になり、お題の「敵が多い」とも同じ写し方（Task 1 のテスト）。
- 宝箱とボスの札が同じフレームに重なっても、札 → 宝箱の順で 1 回ずつ出る（Task 2 のテスト）。
- 古い記録で、前に達成した実績の札が開いている（Task 3 のテスト）。

---

### Task 1: 札の表と効き方、`createWorld` の引数

**Files:**

- Create: `src/lib/games/animal-survivors/arcana.ts`
- Modify: `world.ts`（`createWorld(id, seed, view, ranks, stageId, opts: Options = {})`、`World.arcana`・`arcanaPool`・`arcanaPending`、`hurtPlayer` の回復の倍率、敵を倒したときの血の契約）、`arms.ts:68`（背水の陣）、`drops.ts`（`noMeat`、肉の回復）、`chest.ts`（宝の呪い）、`choices.ts`・`drops.ts` の `stats(...)` を `hpScaleOf(w)` に、`daily.ts`（敵を増やす写しを `swarmStage` に分ける）、`createWorld` を 6〜7 個の引数で呼ぶテスト（`polish`・`cauldron`・`progress`・`daily.svelte`・`snow`・`daily`・`cauldron-records`・`PromptLayer.svelte`・`cauldron.svelte`）と `Play.svelte`
- Test: `src/lib/games/animal-survivors/arcana.test.ts`

**Interfaces:**

- Produces:
  - `export type ArcanaId = 'fang' | 'swift' | 'wisdom' | 'clover' | 'shadow' | 'sand' | 'spring' | 'eye' | 'gamble' | 'armor' | 'cursed' | 'greedy' | 'glass' | 'last' | 'horde' | 'blood'`
  - `export interface ArcanaDef { id: ArcanaId; name: string; good: string; bad?: string; trade: boolean; unlock?: string }`（`unlock` は開く実績の id）
  - `export const ARCANA: ArcanaDef[]`
  - `openArcana(achieved: string[]): ArcanaId[]`
  - `arcanaOffer(w: World): ArcanaId[]`
  - `takeArcana(w: World, id: ArcanaId): void`
  - `has(w: World, id: ArcanaId): boolean`、`hpScaleOf(w)`、`regenRate(w)`、`healRate(w)`、`desperate(w)`
  - `export interface Options { challenge?: Challenge; heat?: Heat; arcana?: ArcanaId[] }`（`Survivors` の `pick` がそのまま入る形）
  - `swarmStage(s: Stage, k: number): Stage`（`daily.ts`）
  - `RunSummary.arcana?: ArcanaId[]`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ARCANA, arcanaOffer, desperate, healRate, openArcana, regenRate, takeArcana } from './arcana';
import { openChest } from './chest';
import { noMeat } from './drops';
import { FOREST } from './stages/forest';
import { damageEnemy, createWorld, makeEnemy, summary } from './world';
import { ENEMIES } from './enemies';

const VIEW = { w: 274, h: 394 };
const ALL = ARCANA.map((a) => a.id);
const world = () => createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL });

describe('札の表', () => {
  it('16 枚で、うれしい札と引き換えの札が 8 枚ずつ、8 枚は実績で開く', () => {
    expect(ARCANA).toHaveLength(16);
    expect(ARCANA.filter((a) => a.trade)).toHaveLength(8);
    expect(ARCANA.filter((a) => a.unlock)).toHaveLength(8);
    for (const a of ARCANA) expect(!!a.bad).toBe(a.trade);
  });

  it('開いている札は、最初の 8 枚と達成した実績の札', () => {
    expect(openArcana([])).toHaveLength(8);
    expect(openArcana(['heat5'])).toContain('shadow');
    expect(openArcana(['heat5'])).toHaveLength(9);
  });
});

describe('はじめの札と候補', () => {
  it('札を渡すとはじめの 1 枚を待ち、渡さなければ待たない', () => {
    expect(world().arcanaPending).toBe(1);
    expect(createWorld('dog', 1, VIEW).arcanaPending).toBe(0);
    expect(
      createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL, challenge: { date: 'x', bonus: 0, mods: [] } })
        .arcanaPending
    ).toBe(0);
  });

  it('候補は持っていない 3 枚で、引き換えが 1 枚だけ入る', () => {
    const w = world();
    for (let i = 0; i < 50; i++) {
      const o = arcanaOffer(w);
      expect(new Set(o).size).toBe(3);
      expect(o.filter((id) => ARCANA.find((a) => a.id === id)!.trade)).toHaveLength(1);
    }
    takeArcana(w, 'fang');
    for (let i = 0; i < 20; i++) expect(arcanaOffer(w)).not.toContain('fang');
  });

  it('開いた札が足りなければある分だけ、3 枚持てば出さない', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ['fang', 'gamble'] });
    expect(arcanaOffer(w).sort()).toEqual(['fang', 'gamble']);
    const v = world();
    for (const id of ['fang', 'swift', 'wisdom'] as const) takeArcana(v, id);
    expect(arcanaOffer(v)).toEqual([]);
  });
});

describe('札の効き方', () => {
  it('うれしい札は能力に足し、作り直しても残る', () => {
    const w = world();
    const s = { ...w.stats };
    takeArcana(w, 'fang');
    takeArcana(w, 'shadow');
    expect(w.stats.area).toBeCloseTo(s.area + 0.2);
    expect(w.stats.amount).toBe(s.amount + 1);
    w.form = 1;
    w.stats = { ...w.stats, area: 0 };
    takeArcana(w, 'wisdom');
    expect(w.stats.area).toBeCloseTo(s.area + 0.2);
  });

  it('いちかばちかは攻撃 +50% と最大 HP 半分で、HP は最大を超えない', () => {
    const w = world();
    const s = { ...w.stats };
    takeArcana(w, 'gamble');
    expect(w.stats.might).toBeCloseTo(s.might * 1.5);
    expect(w.stats.maxHp).toBeCloseTo(s.maxHp / 2);
    expect(w.player.hp).toBeLessThanOrEqual(w.stats.maxHp);
  });

  it('命の泉は最大 HP と今の HP を 30 増やし、少しずつ回復する', () => {
    const w = world();
    const hp = w.player.hp;
    takeArcana(w, 'spring');
    expect(w.player.hp).toBe(hp + 30);
    expect(w.stats.regen).toBeGreaterThan(0);
  });

  it('敵を増やす札は面の表を写して掛け算にする', () => {
    const w = world();
    takeArcana(w, 'greedy');
    takeArcana(w, 'horde');
    expect(w.stage.waves[0].rate[1]).toBeCloseTo(FOREST.waves[0].rate[1] * 1.3 * 1.5);
    expect(FOREST.waves[0].rate[1]).toBe(createWorld('dog', 1, VIEW).stage.waves[0].rate[1]);
  });

  it('宝の呪いは宝箱がいつも 3 つ以上で、肉が出ない', () => {
    const w = world();
    takeArcana(w, 'cursed');
    w.weapons = [{ id: w.weapons[0].id, level: 1, cd: 0 }];
    w.chests = 1;
    const out = openChest(w);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(noMeat(w)).toBe(true);
    expect(w.mods).toEqual([]);
  });

  it('背水の陣は HP が減るほど攻撃が上がり、回復が半分', () => {
    const w = world();
    takeArcana(w, 'last');
    w.player.hp = w.stats.maxHp;
    expect(desperate(w)).toBe(1);
    w.player.hp = 1;
    expect(desperate(w)).toBeCloseTo(1 + 0.8 * (1 - 1 / w.stats.maxHp));
    expect(regenRate(w)).toBe(0.5);
    expect(healRate(w)).toBe(0.5);
    expect(desperate(createWorld('dog', 1, VIEW))).toBe(1);
  });

  it('血の契約は 20 体倒すたびに HP 1 回復し、少しずつの回復はしない', () => {
    const w = world();
    takeArcana(w, 'blood');
    w.player.hp = 10;
    for (let i = 0; i < 20; i++) {
      w.enemies.push(makeEnemy(ENEMIES.rat, 500 + i, 500, 1));
      damageEnemy(w, w.enemies.length - 1, 99, 0, 0);
    }
    expect(w.player.hp).toBe(11);
    expect(regenRate(w)).toBe(0);
    expect(noMeat(w)).toBe(true);
  });

  it('まとめに持っている札が入る', () => {
    const w = world();
    takeArcana(w, 'eye');
    expect(summary(w).arcana).toEqual(['eye']);
  });
});
```

- [ ] **Step 2: 落ちるのを見る**（`./arcana` が無い）

- [ ] **Step 3: 実装**
  - `arcana.ts` に表（spec 2 章の名前・良いところ・悪いところ・開く実績。`shadow: heat5`・`sand: overtime5`・`spring: snowClear`・`eye: metal`・`glass: weapons5`・`last: overtime10`・`horde: run3000`・`blood: daily7`）。効き方は `takeArcana` の `switch`。足し算の能力は `w.boost` に足す（速さと攻撃は動物の基本の値に割合を掛けて足す。`speed: w.animal.speed * 0.15` のように）。`greedy` は `w.greed *= 1.5`、`greedy`・`horde` は `w.stage = swarmStage(w.stage, 1.3 | 1.5)`。足したあと `w.stats = stats(w.animal, w.passives, w.boost, w.form, hpScaleOf(w))`、`spring` は HP を 30 足し、最後に `w.player.hp = Math.min(w.player.hp, w.stats.maxHp)`。
  - `hpScaleOf(w) = hpScale(w.mods) * (has(w, 'gamble') ? 0.5 : 1)`。`stats(...)` を呼んでいる 3 か所（`choices.ts:87,95`、`drops.ts:137`）をこれに替える。
  - `noMeat(w)` は `w.mods.includes('noMeat') || has(w, 'cursed') || has(w, 'blood')`。
  - `regenRate(w)`（`blood` で 0、`last` で 0.5）を `world.ts` の回復（`p.hp + w.stats.regen * regenRate(w) * dt`）に、`healRate(w)`（`last` で 0.5）を肉の回復に掛ける。
  - `desperate(w)` は `has(w, 'last') ? 1 + 0.8 * (1 - p.hp / maxHp) : 1` で、`arms.ts:68` の `dmg` に掛ける。
  - 血の契約は敵を倒して `w.kills` を数えたところで `if (has(w, 'blood') && w.kills % 20 === 0) w.player.hp = Math.min(w.stats.maxHp, w.player.hp + 1)`。
  - 宝の呪いは `openChest` の `let n = chestSize(...)` のあとで `if (has(w, 'cursed')) n = Math.max(3, n) as 3 | 5`。
  - `createWorld(id, seed, view, ranks = {}, stageId = 'forest', opts: Options = {})`。中で `const { challenge, heat = PLAIN, arcana = [] } = opts;`。`arcana: [], arcanaPool: arcana, arcanaPending: arcana.length && !challenge ? 1 : 0`。`summary` に `arcana: [...w.arcana]`。
  - 呼んでいるところの書き換えは機械的に。`createWorld(a, b, c, d, e, X)` → `{ challenge: X }`、`createWorld(a, b, c, d, e, undefined, H)` → `{ heat: H }`。`Play.svelte` は `createWorld(pick.animal, Date.now() % 2 ** 31, view, ranks, pick.stage, pick)`。scratchpad のボット（`sim/boss.sim.ts`・`daily.sim.ts`）も直す。
  - `daily.ts` の `modStage` の swarm の部分を `swarmStage(s, k)` に出して使う。
- [ ] **Step 4: 通るのを見る**（`pnpm exec vitest run src/lib/games/animal-survivors`、`pnpm check`）
- [ ] **Step 5: Commit** `Add Animal Survivors' arcana table and effects`

### Task 2: ボスのあとの札と、選ぶ画面の出し入れ

**Files:**

- Modify: `stages/forest.ts`（`Stage['bosses']` の行に `arcana?: true`。`bossRun` の 240・480 の行と、森の女王グモ・大ワシの行）、`bosses.ts`（出すときに def に `arcana` の印）、`enemies.ts`（`EnemyDef.arcana?: boolean`）、`drops.ts`（ボスを倒したとき `if (e.def.arcana && w.arcana.length + w.arcanaPending < 3 && w.arcanaPool.length) w.arcanaPending += 1`）、`prompts.svelte.ts`（`cards`）
- Test: `src/lib/games/animal-survivors/arcana-prompts.test.ts`

**Interfaces:**

- Consumes: `arcanaOffer`, `takeArcana`（Task 1）
- Produces: `Prompts.cards: ArcanaId[] | null`、`Prompts.pickCard(id: ArcanaId, finger: number | null): void`、`busy` に `cards` を含める

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ARCANA } from './arcana';
import { ENEMIES } from './enemies';
import { Prompts } from './prompts.svelte';
import { FOREST } from './stages/forest';
import { GRAVEYARD } from './stages/graveyard';
import { createWorld, damageEnemy, makeEnemy } from './world';

const VIEW = { w: 274, h: 394 };
const ALL = ARCANA.map((a) => a.id);

describe('札を選ぶ画面', () => {
  it('はじめに 3 枚を出し、選ぶと閉じて持つ', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL });
    const p = new Prompts(w);
    p.next(null);
    expect(p.cards).toHaveLength(3);
    expect(p.busy).toBe(true);
    p.pickCard(p.cards![0], null);
    expect(p.cards).toBeNull();
    expect(w.arcana).toHaveLength(1);
    expect(w.arcanaPending).toBe(0);
    p.stop();
  });

  it('4:00 と 8:00 のボスの行だけに印がある', () => {
    for (const s of [FOREST, GRAVEYARD]) expect(s.bosses.filter((b) => b.arcana).map((b) => b.at)).toEqual([240, 480]);
  });

  it('印のボスを倒すと札が先、宝箱があとに出る', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ALL });
    w.arcanaPending = 0;
    const p = new Prompts(w);
    w.enemies.push(makeEnemy({ ...ENEMIES.spiderQueen, arcana: true }, 50, 0, 10));
    damageEnemy(w, w.enemies.length - 1, 99, 0, 0);
    w.chests = 1;
    p.next(null);
    expect(p.cards).not.toBeNull();
    expect(p.rewards).toBeNull();
    p.pickCard(p.cards![0], null);
    expect(p.rewards).not.toBeNull();
    p.stop();
  });

  it('3 枚持っていれば印のボスを倒しても出さず、候補が 0 枚なら待ちを捨てる', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'forest', { arcana: ['fang'] });
    const p = new Prompts(w);
    p.next(null);
    p.pickCard('fang', null);
    w.arcanaPending = 1;
    p.next(null);
    expect(p.cards).toBeNull();
    expect(w.arcanaPending).toBe(0);
    p.stop();
  });
});
```

- [ ] **Step 2: 落ちるのを見る**
- [ ] **Step 3: 実装**。`Prompts.next()` の `if (w.chests > 0)` の前に

```ts
if (w.arcanaPending > 0) {
  const offer = arcanaOffer(w);
  if (offer.length) {
    this.cards = offer;
    this.lock.begin(finger);
    return;
  }
  w.arcanaPending = 0;
}
```

`pickCard` は `takeArcana(w, id); w.arcanaPending -= 1; this.cards = null; this.next(finger);`。`busy` に `this.cards !== null`。

- [ ] **Step 4: 通るのを見る** → **Step 5: Commit** `Offer Animal Survivors' arcana at the start and after the 4:00 and 8:00 bosses`

### Task 3: 開く実績と図鑑の札のタブ

**Files:**

- Modify: `achievements.ts`（`AchievementDef.arcana?: ArcanaId` は持たせず、`ARCANA` の `unlock` から引く）、`book-view.ts`（`Tab` に `'arcana'`、札の entries）、`Book.svelte`（タブを足し、数は `list.length` から）、`Trophy.svelte` か `Result.svelte`（実績の札に「NEW! ○○の札」）
- Test: `src/lib/games/animal-survivors/arcana-book.test.ts`

**Interfaces:**

- Consumes: `ARCANA`, `openArcana`
- Produces: `entries(r, 'arcana')`、`arcanaOf(achievementId: string): ArcanaDef | undefined`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { ARCANA, arcanaOf } from './arcana';
import { entries } from './book-view';
import { emptyRecords, parseRecords } from './records';

describe('札の図鑑と開く実績', () => {
  it('開く実績はどれも実績の表にある', () => {
    for (const a of ARCANA) if (a.unlock) expect(ACHIEVEMENTS.some((d) => d.id === a.unlock)).toBe(true);
    expect(arcanaOf('heat5')?.id).toBe('shadow');
  });

  it('図鑑の札のタブは 16 枚で、開いた札は効果、まだの札は開く実績を出す', () => {
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['heat5'] }));
    const list = entries(r, 'arcana');
    expect(list).toHaveLength(16);
    const shadow = list.find((e) => e.key === 'shadow')!;
    expect(shadow.known).toBe(true);
    expect(shadow.detail.join()).toContain('弾と攻撃の数 +1');
    const glass = list.find((e) => e.key === 'glass')!;
    expect(glass.known).toBe(false);
    expect(glass.detail.join()).toContain('武器 3 つを Lv5 にする');
  });
});
```

- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。リザルトの実績の札は `Trophy.svelte` が `a.animal` で「NEW!」を出している形にならい、`arcanaOf(a.id)` があれば「NEW! ○○の札」を足す。
- [ ] **Step 5: Commit** `Show Animal Survivors' arcana in the book and announce unlocked cards`

### Task 4: 札の印の見本（利用者に見せて止まる）

- [ ] 16 枚の印を決める。今ある `ITEM_ART` の武器とパッシブの印で合うものは使い回し（例: 大きな牙 → 爪、早足のお守り → 速さのパッシブ、知恵の実 → 経験値のパッシブ、四つ葉の冠 → 四つ葉）、足りないもの（いちかばちか・宝の呪い・欲ばりの壺・ガラスの大砲・背水の陣・血の契約 など）を 12 ドットで描く。札の枠（うれしい札は金、引き換えは紫）に入れた見本を 16 枚並べた PNG を `SendUserFile` で見せる。
- [ ] 利用者が決めるまで Task 5 に進まない。決まった印を `art/arcana.ts` に入れ、`pixels.test.ts` の一覧に足す。

### Task 5: 選ぶ画面・一時停止・リザルト・流れ

**Files:**

- Create: `ArcanaPick.svelte`、`ArcanaRow.svelte`（持っている札を小さく並べる。一時停止とリザルトで共用）、`art/arcana.ts`
- Modify: `PromptLayer.svelte`（`prompts.cards` で `ArcanaPick`、盤面の外。`locked={prompts.lock.active}`）、`Pause.svelte`・`Result.svelte`（`ArcanaRow`）、`Survivors.svelte`（`begin` で `pick = { ...pick, heat, arcana: openArcana(r.achieved) }`）
- Test: `src/lib/games/animal-survivors/arcana.svelte.test.ts`

- [ ] **Step 1: dom テストを書く**。`ArcanaPick` に 3 枚を渡すと、名前と良いところ・悪いところ（引き換えの札は赤の行）が出て、押すと `onpick(id)` が返る。`locked` のあいだは押しても返らない。`ArcanaRow` は名前を並べる。`Survivors` を mount し、キャラ → ステージ → 釜 → はじめる のあとで札を選ぶ画面が出ること、お題の回では出ないこと（`cauldron-flow.svelte.test.ts` の形）。
- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。`pnpm verify`。
- [ ] **Step 5: 画面を撮る**（headless の Chrome と webkit、縦・横、はじめの札・ボスのあとの札・一時停止・リザルト）。
- [ ] **Step 6: Commit** `Add Animal Survivors' arcana pick screen and show owned cards`

### Task 6: ボットで合わせる

- [ ] `sim/boss.sim.ts` に `CARD` を env で受け、はじめに `takeArcana(w, CARD)` して森と墓地の店半分を測る（16 枚 + 札なし）。クリアの割合と 1 回のコインを並べ、引き換えの札がうれしい札より飛び抜けて強い・弱いものの数を直す。spec に「## 7. 調整の結果」を書く。Commit。

### Task 7: 仕上げ

- [ ] CLAUDE.md の Animal Survivors の段落にアルカナを足す（`createWorld` の引数がまとめになったことも）。`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
