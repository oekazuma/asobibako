# Animal Survivors 日替わりお題 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日付ごとに動物・面・しばり 2 つを決めた「今日のお題」を出し、その日の初クリアでしばりに応じたコインを渡す。

**Architecture:** しばりの表・お題の作り方・ごほうびの計算は DOM を使わない `daily.ts` に置く。`createWorld` がしばりの id を受けて、面の表の写し・店の強化・能力の足し算・World の旗（`World.mods`）で効かせる。お題は記録（`Records.daily`）に日付ごとに残し、`record()` がクリアした回のまとめ（`RunSummary.daily`）を見てごほうびを足す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、playwright-core の headless Chrome、scratchpad のボット

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-daily-design.md`

## Global Constraints

- 新しい絵は描かない（今の動物・面・品の絵を使う）。
- コンポーネントは 200 行未満、props は 6 つまで。全角スペースと絵文字は使わない。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。
- テストは 1 つ 5 秒の制限に収まるよう、長い時間を 1 フレームずつ進めない（時刻を飛ばす）。

## Review Focus

- 同じ日のあいだに仲間や面が増えても、お題が変わらない（記録に残したものを使う）。日付が変わったら作り直す。Task 1 と Task 2 のテスト。
- ごほうびが 2 度入らない（2 回めのクリア、延長戦の 2 回めの記録、日をまたいで遊んだ回）。Task 2 のテスト。
- 面の表の元（`FOREST` など）と敵の表（`ENEMIES`）を書き換えない。お題の回のあとにふつうの回を遊ぶと、しばりが残っていない。Task 1 のテスト。
- 肉が出ないしばりで、3 択の埋め草・宝箱の上げるものが無いときも肉を出さない（経験値の袋にする）。Task 1 のテスト。
- お題の回の「もう一度」とやり直しは同じお題、キャラ選択から選んだ回はしばりなし。Task 3 のテスト。

---

### Task 1: しばりとお題

**Files:** Create `daily.ts`、`daily.test.ts`。Modify `world.ts`（`createWorld` の 6 つめの引数 `mods: string[] = []`、`World.mods`・`World.daily`、`summary` の `daily`）、`drops.ts`（肉）、`chest.ts`（肉）、`choices.ts`（肉の埋め草、武器は最初の 1 つだけ）。

**Interfaces:**

- `MODS: Record<ModId, { name: string; text: string; coins: number; good?: boolean }>`
- `type Daily = { date: string; animal: AnimalId; stage: string; mods: ModId[]; cleared: boolean }`
- `todayKey(now: Date): string`（端末の日付の `YYYY-MM-DD`）
- `makeDaily(date: string, animals: AnimalId[], stages: string[]): Daily`（日付から作った乱数で選ぶ）
- `dailyBonus(d: Daily): number`（`(200 + しばりのコイン) × 面の coin` を 10 単位に丸め、200 以上）
- `World.mods: ModId[]`、`World.daily: { date: string; bonus: number } | null`、`RunSummary.daily?: { date: string; bonus: number; paid?: boolean }`

- [ ] テストを書く（`daily.test.ts`）: 同じ日付と候補なら同じお題、日付で変わる。動物と面は候補から。しばり 2 つは重ならず、1 つめは `good` でない。ごほうびの計算。しばりがそれぞれ効く（`tough`・`fury`・`swarm`・`bossHp` は写した面の表で、`FOREST` は変わらない。`noShop` は店の強化が入らない。`noMeat` はランタン・敵・宝箱・3 択の埋め草で肉が出ない。`halfHp` は最大 HP が半分。`oneWeapon` は 3 択に新しい武器が出ない。`noTools` は道具が 0。`growth` と `might`）。
- [ ] FAIL → 実装 → PASS。Commit `Add Animal Survivors' daily challenge modifiers`。

### Task 2: 記録とごほうび

**Files:** Modify `records.ts`（`Records.daily: Daily | null`、`dailyDays`、`ensureDaily(r, now)` で日付が違えば作り直す、`record()` がごほうびを足す）、`achievements.ts`（`daily1`・`daily7`）。Test `daily.test.ts`。

- [ ] テストを書く: 同じ日に仲間が増えてもお題は同じ、次の日は作り直す。クリアした回だけごほうびが入り、2 回めと延長戦の 2 回めの記録と前の日のお題の回では入らない。`run.daily.paid` が立つ。壊れた `daily` は捨てる。実績。
- [ ] FAIL → 実装 → PASS。Commit `Pay Animal Survivors' daily challenge bonus once per day`。

### Task 3: 画面

**Files:** Create `DailyCard.svelte`、`Daily.svelte`、`daily.svelte.test.ts`。Modify `CharSelect.svelte`（`onshop`・`ontrophies`・`onbook` を `onopen(screen)` 1 つにまとめ、お題の札を出す）、`Survivors.svelte`（画面 `daily`、`pick` にしばりとお題、ふつうの回はしばりを外す）、`Play.svelte`（`createWorld` にしばりを渡す）、`Result.svelte`（「お題クリア +N」）。

- [ ] テストを書く: 札に動物・面・しばり・ごほうび、クリア済みの表示。お題の画面の「挑戦する」と「もどる」。リザルトのごほうびの行。
- [ ] FAIL → 実装 → PASS。headless でキャラ選択の札・お題の画面・リザルトを iPad の縦と iPhone の幅で撮る。Commit `Show Animal Survivors' daily challenge`。

### Task 4: ボットでコインを確かめ、仕上げる

- [ ] ボットで、店を半分、犬・キツネ・パンダの森で、しばり 1 つずつのクリアの割合を測る（しばりなしと比べる）。クリアの割合が下がるしばりほどコインが多くなるよう表を直し、spec に「## 7. 調整の結果」を書く。
- [ ] CLAUDE.md、`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
