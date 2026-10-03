# Animal Survivors 図鑑 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 敵・ボス・動物の姿・品を集める図鑑を足し、新しく載るたびにコインを渡す。

**Architecture:** 載せる表とごほうびの計算は DOM を使わない `book.ts` に置く。その回の記録は World に足してまとめ（`RunSummary.book`）に写し、`record()` が `book.ts` の `addBook()` で記録へ足す。画面は `Book.svelte` と札の `BookCard.svelte`。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-book-design.md`

## Global Constraints

- 新しい絵は描かない（今の敵・ボス・動物・品の絵を使い、影は CSS で黒くする）。
- コンポーネントは 200 行未満、props は 6 つまで。全角スペースと絵文字は使わない。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。

## Review Focus

- やり直し・やめる・倒れた・クリアのどれで終わっても、その回の図鑑の分が 1 回だけ記録に入る（`record()` は決着で 1 度だけ呼ばれる前提を確かめる）。Task 2 のテスト。
- 強化個体とヌシは元の敵の id で数える（`eliteOf`・`chiefOf` は id を変えない）。ボスの 2 回めと面の主（def の写し）も同じボスとして数える。Task 1 のテスト。
- 時刻を飛ばしたテストや、面の主で 2 体いっしょに倒したとき、ボスを倒すまでの秒が出た時刻から数えられる（同じボスが 2 体いても取り違えない）。Task 1 のテスト。
- 古い記録や壊れた記録から、コインが急に増えない。Task 2 のテスト。
- 図鑑の画面が iPhone の幅でも横にはみ出さない。Task 3 の headless の撮影。

---

### Task 1: その回の記録と載せる表

**Files:** Create `book.ts`、`book.test.ts`。Modify `world.ts`（`World.killsBy`・`elitesDown`・`chiefsDown`・`bossTimes`・`picked`・`bornAt`、`RunSummary.book`）、`bosses.ts`（ボスの出た時刻）、`drops.ts`（拾った品）、`choices.ts`（経験値の袋）。

**Interfaces:**

- `BOOK = { enemies: string[]; bosses: string[]; forms: string[]; items: string[] }`
- `RunBook = { kills: Record<string, number>; elites: string[]; chiefs: string[]; bosses: { id: string; secs: number }[]; forms: string[]; items: string[] }`
- `Enemy.born`（出た時刻。ボスを倒すまでの秒に使う）

- [ ] テストを書く（`book.test.ts`）: 表の数。敵を倒すと元の id で数え、強化個体とヌシは印にも入る。ボスを倒すとそのボスが出てからの秒が入り、2 回めと面の主も同じ id。育った段階まで（`dog:0`〜`dog:2`）。拾った品（宝箱は拾ったとき、経験値の袋は選んだとき）。
- [ ] FAIL → 実装 → PASS。Commit `Track Animal Survivors' book entries during a run`。

### Task 2: 記録に足す・ごほうび・実績

**Files:** Modify `book.ts`（`addBook(r, run): number`、`emptyBook()`、`parseBook()`）、`records.ts`、`achievements.ts`（4 つ）。Test `book.test.ts`。

- [ ] テストを書く: 新しく載った分だけコイン（敵 10・品 10・姿 30・ボス 50）、同じものは 2 度出さない。倒した数は足し、速い秒は小さいほうを残す。古い記録から倒したボスと仲間の 1 段階めが載り、そのときコインは出ない。壊れた値は捨てる。種類ごとに全部そろうと実績（各 300）。
- [ ] FAIL → 実装 → PASS。Commit `Fill Animal Survivors' book from each run with coin rewards`。

### Task 3: 図鑑の画面

**Files:** Create `Book.svelte`、`BookCard.svelte`、`Book.svelte.test.ts`。Modify `Survivors.svelte`（画面 `book`）、`CharSelect.svelte`（ボタン）、`Result.svelte`（図鑑のコイン）。

- [ ] テストを書く: 4 つのタブ、載ったものは絵と名前、載っていないものは影と「？？？」、札を押すと記録の帯、もどる。
- [ ] FAIL → 実装 → PASS。headless で iPad の縦と iPhone の幅を撮る。Commit `Show Animal Survivors' book`。

### Task 4: 仕上げ

- [ ] CLAUDE.md、`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
