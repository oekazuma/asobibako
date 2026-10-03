# Animal Survivors ボスとヌシの登場演出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ボスが出たときにゲームを止めてカメラで見せ、二つ名つきの名前を出す。ヌシは止めずに帯と矢印で場所を知らせる。

**Architecture:** ボスとヌシが出たときに World が出来事（`bossIntro`・`chief`）を積み、`Prompts` がボスの登場（`intro`）を 3 択と同じ「止める画面」として持つ。登場は端末の時間で進め、`Prompts.focus()` がカメラの寄る先を返し、`draw()` がその位置へカメラを動かす。名前の札とヌシの帯は `PromptLayer` が出す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-entrance-design.md`

## Global Constraints

- 画面は揺らさない。新しいドット絵は描かない（土ぼこりの輪・きらめき・矢印は今の描き方を使う）。
- コンポーネントは 200 行未満、props は 6 つまで。Play.svelte は 198 行なので、行を増やさない形で配線する。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。テストは長い時間を 1 フレームずつ進めない。

## Review Focus

- 登場のあいだは step が進まず、3 択・宝箱・一時停止が開かない。登場の途中で画面が隠れても、終わってから一時停止が開く。Task 1 のテスト。
- 登場が終わったあと、移動の指が残っていてもスティックが壊れない（登場のあいだに置いた指は無視される）。Task 1。
- 面の主の 2 体で登場が 2 回起きない。延長戦のボスでは起きない。Task 1 のテスト。
- 動きを減らす設定ではカメラを動かさない。Task 1 のテスト。
- ヌシの矢印が HUD と重ならない（宝の地図の矢印と同じ範囲に置く）、横向きでも向きが合う。Task 2 の headless の撮影。

---

### Task 1: 登場のしくみ

**Files:** Create `intro.test.ts`。Modify `enemies.ts`（`EnemyDef.epithet`）、`world.ts`（`GameEvent` に `bossIntro` と `chief`、`spawnChiefs`）、`bosses.ts`（`spawnBosses` が延長戦でない行で `bossIntro` を 1 時刻に 1 回）、`prompts.svelte.ts`（`intro`、`next(finger, dt)`、`focus(w)`、`busy`）。

**Interfaces:**

- `GameEvent`: `{ type: 'bossIntro'; ids: number[] }`（出たボスの入れ物の番号）、`{ type: 'chief'; i: number }`
- `Prompts.intro: { ids: number[]; t: number; still: boolean } | null`、`INTRO = 2.4`
- `Prompts.next(finger: number | null, dt = 0)`、`Prompts.focus(w: World): { x: number; y: number } | null`
- `Prompts.introName: { epithet: string; name: string } | null`（札に出す文字）

- [ ] テストを書く（`intro.test.ts`）: ボスが出ると `intro` が始まり `busy`。`next` に dt を 2.4 秒ぶん渡すと終わる。そのあいだ step を呼んでも時計が進まない（Play は busy で step を呼ばないので、Prompts の状態で確かめる）。`focus` が 0 秒で自分、1.2 秒でボス、2.4 秒で null。`still`（動きを減らす）では null。面の主は 1 回で `ids` が 2 つ、札の名前は「面の主」。延長戦のボスでは起きない。6 体に二つ名。登場が始まったときに残っていた指は lock で止める。
- [ ] FAIL → 実装 → PASS。Commit `Pause for Animal Survivors' boss entrances`。

### Task 2: 描画と音

**Files:** Create `BossIntro.svelte`。Modify `draw.ts`（`draw()` の引数に寄る先と登場の時間、カメラを動かす）、`draw-boss.ts`（土ぼこりの輪と縁の光）、`draw-events.ts`（ヌシの矢印、宝の地図の矢印と描き方を共用）、`PromptLayer.svelte`（札、ヌシの帯）、`effects.ts`・`sounds.ts`（地響き、王冠のきらめき）、`Play.svelte`（`next` に dt、`draw` に寄る先。行は増やさない）。

- [ ] headless で、寄る途中・札・面の主・ヌシの帯と矢印（縦と横向き）を撮る。Commit `Draw Animal Survivors' boss entrances and chief arrows`。

### Task 3: 仕上げ

- [ ] CLAUDE.md、`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
