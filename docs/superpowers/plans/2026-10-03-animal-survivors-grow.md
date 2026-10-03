# Animal Survivors 育つ瞬間の溜め Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 育つ瞬間にゲームを止め、白い影の入れ替わりと光で「進化した！」を見せ、名前の札で強くなったことを伝える。

**Architecture:** World の `grow` の出来事を `Prompts` が受け、ボスの登場と同じ「止める画面」として `evolve` を持つ。時間から見せる姿・暗さ・光を返す純粋な関数は `grow.ts` に置き、`draw()` はそれを描くだけにする。札は `PromptLayer` が出す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-grow-design.md`

## Global Constraints

- 画面は揺らさない。新しいドット絵は描かない（白い影は今の `sprite` の白い版を使う）。
- コンポーネントは 200 行未満、props は 6 つまで。Play.svelte は 198 行なので行を増やさない。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。

## Review Focus

- 1 フレームで 2 段育ったとき（経験値の大玉）、演出が 1 回で最後の姿まで見せる（前の帯の「2 段めだけ」の問題を引き継がない）。Task 1 のテスト。
- 演出の途中で画面が隠れても、終わってから一時停止が開く（`PendingPause`）。Task 1。
- 宝箱の中身（経験値の袋）で育ったとき、宝箱の画面を閉じてから演出が始まる。Task 1 のテスト。
- 倒れた（決着した）フレームに育っても、演出でリザルトが遅れない。Task 1 のテスト。
- 動きを減らす設定で、入れ替わりの点滅が出ない。Task 1 のテスト。

---

### Task 1: 演出のしくみ

**Files:** Create `grow.ts`、`grow.test.ts`。Modify `prompts.svelte.ts`（`evolve: { from: string; to: string; form: 1 | 2; t: number } | null`、`GROW = 2.6`、`next()` の順、`busy`、帯をやめる）。

**Interfaces:**

- `growFrame(t: number, still: boolean): { form: 'old' | 'new'; white: boolean; dark: number; burst: number }`（`dark` は 0..1 の暗さ、`burst` は 0..1 のはじける光の強さ）
- `Prompts.evolve`、`Prompts.still`（読み取り）

- [ ] テストを書く（`grow.test.ts`）: 育つと `evolve` が始まり `busy`、2.6 秒で終わり、そのあと 3 択が開く。経験値の袋と宝箱で育つときは、閉じるまで進まない。ボスの登場が先。2 段育つと 1 回で、`to` が最後の姿。決着したフレームでは始めない。`growFrame` の入れ替わりが速くなり、1.6 秒からは新しい姿、`still` では白い影もはじける光も出ない。帯が出ない。
- [ ] FAIL → 実装 → PASS。Commit `Pause for Animal Survivors' growth moments`。

### Task 2: 描画と音

**Files:** Create `GrowPlate.svelte`。Modify `draw.ts`（暗さ・白い影・はじける輪と光の筋）、`PromptLayer.svelte`（札）、`effects.ts`・`sounds.ts`（音、光の粒をやめる）。

- [ ] headless で、影の入れ替わり・はじける瞬間・札（iPad の縦と iPhone の幅）を撮る。Commit `Draw Animal Survivors' growth moments`。

### Task 3: 仕上げ

- [ ] CLAUDE.md、`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
