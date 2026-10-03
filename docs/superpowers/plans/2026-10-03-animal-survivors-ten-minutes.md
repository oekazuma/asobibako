# Animal Survivors 10 分の面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1 回を 15 分から 10 分にし、いまの流れを 3 分の 2 に縮め、1 回でもらえるコインは今と同じくらいに保つ。

**Architecture:** 墓地と雪山は 1 面の表を写して作っているので、時刻は 1 面の表（`stages/forest.ts`）と各面の `length`、雪山の吹雪を書きかえる。延長戦・クリアの判定・ボスの登場は面の長さから決まるのでそのまま動く。コインは `coinsOf` に 1.5 倍を掛ける。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、scratchpad のボット

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-ten-minutes-design.md`

## Global Constraints

- 時刻はコードに 3 分の 2 を掛ける式で書かず、10 分の値を直接書く（docs と同じく最新の仕様だけ）。
- テストは長い時間を 1 フレームずつ進めない（5 秒の制限）。
- コードコメントは非自明な WHY だけ。`pnpm verify` が通ること。

## Review Focus

- 延長戦（10:00 から）・お題・図鑑・実績が、面の長さ 900 を前提にした数字を残していない。Task 1 と Task 2 のテスト。
- 古い記録（15 分で遊んだ `best` や延長戦の秒）を読んでも壊れない。Task 2 のテスト。
- コインの 1.5 倍が、図鑑・お題・実績のごほうびにまで掛からない。Task 2 のテスト。

---

### Task 1: 時刻を縮める

**Files:** Modify `stages/forest.ts`（長さ 600、ボス・面の主・ヌシ・出来事・出現の波・`cap`・`toughness`・`elite`・`fury`）、`stages/graveyard.ts`・`snow.ts`（長さ、吹雪）、`world.ts`（きらきらハリネズミの時刻）、時刻を使っているテスト。

- [ ] テストを書く: 面の長さ 600、ボスとヌシと出来事の時刻、10:00 のクリア、延長戦が 10:00 から、10:00 の硬さがいまの 15:00 と同じ。
- [ ] FAIL → 実装 → PASS。今のテストの時刻を 10 分に合わせる。Commit。

### Task 2: コイン・実績・文

**Files:** Modify `world.ts`（`coinsOf` の 1.5 倍）、`achievements.ts`（3 分・6 分・10 分でクリア）、`Howto.svelte`・`meta.ts`・コメント。

- [ ] テストを書く: 拾ったコインと延長戦のコインに 1.5 倍、図鑑・お題・実績には掛からない。実績の条件。古い記録を読める。
- [ ] FAIL → 実装 → PASS。Commit。

### Task 3: ボットで合わせる

- [ ] 3 つの面の店なし・半分・全部で、クリアの割合・全部埋まる時刻・ボスを倒すまでの秒・1 回のコイン・撃破数を測る。店を半分で 9 分ごろに全部埋まるよう育ちを、面の主（9:00）を 10:00 までに倒せる回がそこそこあるよう面の主の体力を、撃破数の実績を合わせる。spec に「## 7. 調整の結果」を書く。Commit。

### Task 4: 仕上げ

- [ ] CLAUDE.md、`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
