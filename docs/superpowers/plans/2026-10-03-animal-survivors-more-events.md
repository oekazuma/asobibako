# Animal Survivors 出来事の種類を増やす Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 面の出来事に宝の地図・流れ星・お祭りを足し、危なさと引き換えのごほうびを増やす。

**Architecture:** 出来事の始まりは今の `spawnEvents` に種類を足し、続く時間のある出来事の時計（宝箱の残り・流れ星・お祭り）は新しい `events.ts` の `stepEvents()` が step の中で進める（3 択と一時停止では進まない）。流れ星の予告と当たりは `Hazard` に `meteor` を足し、今の予告と同じ流れに乗せる。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-more-events-design.md`

## Global Constraints

- 新しい絵は描く前に見本を見せて止まる（星・矢印・紙ふぶき）。
- 色の表は足すだけ。コンポーネントは 200 行未満、props は 6 つまで。全角スペースと絵文字は使わない。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。

## Review Focus

- 宝の地図の宝箱が、遠くの敵の置き直しや入れ物のあふれで消えたり、ほかの宝箱（ボス・ヌシ・強化個体）の寿命まで縮めたりしない。Task 2 のテスト。
- お祭りの 2 倍がボスの大袋・宝箱のコイン・クリアのコインにまで掛かって増えすぎない（拾ったコインと経験値の玉だけ）。Task 2 のテスト。
- 流れ星の跡の玉が、玉の上限（400）を超えたときに消えず、今の「遠い玉に値を足す」に乗る。Task 2 のテスト。
- 時計（品）で止まっているあいだ、流れ星もお祭りも宝の地図の時計も進まない。止まっているあいだに落ちかけの星が当たらない。Task 2 のテスト。
- 宝の地図の矢印が、横向きの iPad（盤面を回している）でも宝箱の向きを指す。Task 3 の headless の撮影。

---

### Task 1: 星・矢印・紙ふぶきの絵（見本で止まる）

**Files:** Modify `art/items.ts`（`meteor` 12×12、`arrow` 9×9、`confetti` 4 色の小さな紙）。Test `pixels.test.ts`。

- [ ] scratchpad の台本で描き、見本を送って止まる。承認ののち Commit `Draw Animal Survivors' meteor, treasure arrow, and confetti`。

### Task 2: 3 つの出来事のしくみ

**Files:** Create `events.ts`、`more-events.test.ts`。Modify `stages/forest.ts`（種類と表）、`world.ts`（`World.treasure`・`meteors`・`festival`、step から `stepEvents`）、`bosses.ts`（`meteor` の予告と当たり）、`drops.ts`（宝箱の寿命 `Item.life?`、お祭りの 2 倍）、`prompts.svelte.ts`（帯）。

**Interfaces:**

- `StageEvent.kind` に `'treasure' | 'meteor' | 'festival'`（`enemy` と `count` は使わないので `''` と 0）
- `World.treasure: Item | null`（宝の地図の宝箱）、`World.meteors: { left: number; next: number }`、`World.festival: number`
- `Item.life?: number`（宝の地図の宝箱だけ持つ。0 で消える）
- `stepEvents(w, dt)`、`TREASURE_LIFE = 30`、`METEOR_TIME = 10`、`METEOR_EVERY = 0.5`、`FESTIVAL = 20`

- [ ] テストを書く（`more-events.test.ts`）:
  - 森の表に 6 行が表の時刻で入り、ボスとヌシから 20 秒以上離れている。墓地と雪山にも同じ時刻で入っている。
  - 宝の地図: 宝箱が 350〜450 ドット離れて置かれ、`World.treasure` が指す。30 秒で消える。たどり着けば `chests` が増える。`pending` が 1 のあいだは寿命が減らない。ほかの宝箱は寿命を持たない。
  - 流れ星: 10 秒で 20 個の予告が出て、1.2 秒後に円の中の自分だけが痛い。円の中の敵が削れる。跡に経験値の玉。玉が 400 個あるときは遠い玉に値が足される。時計で止まっているあいだは予告が出ず、出ている予告も落ちない。
  - お祭り: 20 秒のあいだ玉の経験値とコイン 1 枚が 2 倍、ふつうの敵の出る数が 2 倍、ボスの大袋と宝箱のコインは変わらない。20 秒で戻る。
  - 帯の文。
- [ ] FAIL → 実装 → PASS。Commit `Add treasure maps, meteor showers, and festivals to Animal Survivors' stages`。

### Task 3: 描画と音

**Files:** Create `draw-events.ts`。Modify `draw.ts`（呼ぶ）、`draw-boss.ts`（流れ星の予告と落下）、`effects.ts`・`sounds.ts`（音）。

- [ ] 矢印は画面の端（HUD と重ならない内側）に宝箱の向きで置き、下に残り秒を 3×5 のドット字で出す。宝箱が画面の中なら出さない。
- [ ] 流れ星は予告の円（黄色）と、落ちる 0.3 秒前から斜め上から降る星の絵。お祭りは縁に紙ふぶき（40 枚）。
- [ ] headless で 3 つの出来事と、横向き（1180×820）の矢印を撮る。Commit `Draw Animal Survivors' treasure arrow, meteors, and festival confetti`。

### Task 4: ボットで確かめ、文書を最新にする

- [ ] ボットで森と墓地の強化なし・店を半分を測り、今（森 26/84・78/84、墓地 7/84・55/84）から大きくずれたら、流れ星の痛さかお祭りの敵の数で整える。
- [ ] CLAUDE.md と spec（「## 6. 調整の結果」）、`pnpm verify`、Commit。
- [ ] 別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
