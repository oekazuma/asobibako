# Animal Survivors 1 面のボスと育ちの見直し Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 育ちを 15 分ごろまでのばして埋まったあとのごほうびを足し、ボスを強くし、1 面に大きくて怖い新しいボスを 4 体足す。

**Architecture:** 育ちは `drops.ts`・`chest.ts`・`choices.ts` の数字と 3 択の埋め草で直す。新しい 4 体の動きは `bosses-forest.ts` に置き、敵の表の `ai` で選ぶ（雪山の 2 体と同じ形）。大ヘビの体は World に節の並びを持ち、当たりは頭と同じボスの体力を減らす。絵は `art/bosses-forest.ts`。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest、scratchpad のボット、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-forest-bosses-design.md`

## Global Constraints

- 絵は描く前に見本を見せて止まる（新しい 4 体、狼の顔、パッシブの鼻・毛皮・ひげ）。
- コンポーネントは 200 行未満、props は 6 つまで。Play.svelte は 198 行。
- テストは 1 つ 5 秒の制限に収まるよう、長い時間を 1 フレームずつ進めない。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。

## Review Focus

- 大ヘビの体の節が、押し合い・遠くの敵の置き直し・十字架・図鑑の数え方でふつうの敵として扱われない（節は敵の入れ物に入れない）。Task 4 のテスト。
- 大ワシが空にいるあいだ、武器・体当たり・ツタの足止めが当たらない（大雪男と同じ `airborne()`）。Task 4 のテスト。
- 大イノシシの画面を横切る突進が、自分のいない向きへ出たときに画面の外へ出たまま戻らない、にならない。Task 4 のテスト。
- 全部埋まったあとのごほうびで、その回だけの強化が `stats()` を作り直しても消えない（パッシブを取ったときと育ったとき）。Task 2 のテスト。
- 墓地と雪山のボスの並びと延長戦は変わらない。Task 4 のテスト。

---

### Task 1: 絵の見本（止まる）

- [ ] scratchpad の台本で、大木のおばけ（48）・大イノシシ（40）・大ワシ（48）・大ヘビ（頭 24・節 16）と、狼の 3 段階・パッシブの鼻・毛皮・ひげを描き、森の地面の上に並べた見本を送って止まる。

### Task 2: 育ち

**Files:** Modify `drops.ts`（`xpNeed`）、`chest.ts`（`chestSize`、上げるものがないときのごほうび）、`choices.ts`（埋まったあとの 3 枚 `power`・`vigor`・`gold`）、`world.ts`（`World.extra: Partial<Stats>`、その回だけの強化）、`passives.ts`（`stats()` に足す）、`LevelUp.svelte`・`ChestOpen.svelte`（札の文と絵）。

- [ ] テストを書く: 全部埋まると 3 択が 3 枚のごほうびになる。攻撃 +5% が重なり、パッシブを取っても育っても残る。最大 HP +10 と全回復。コイン +20。宝箱も上げるものがなければごほうび。
- [ ] FAIL → 実装 → PASS。ボットで 10:00 の埋まった割合と全部埋まる時刻を測り、`xpNeed` と `chestSize` を決める。Commit。

### Task 3: ボスの強さ

**Files:** Modify `bosses.ts`（`BOSS_HP`、巨大ベア・女王グモの間と数）。

- [ ] ボットで、店を半分にしたときのボスを倒すまでの秒を測り、40〜70 秒に合わせる。墓地と雪山はずれを見る。Commit。

### Task 4: 新しい 4 体の動き

**Files:** Create `bosses-forest.ts`、`forest-bosses.test.ts`。Modify `enemies.ts`（4 体と手下、`epithet`）、`stages/forest.ts`（森の `bosses` を 6 体の並びに、墓地と雪山は `bossRun` のまま）、`overtime.ts`（面のボスを順に）、`world.ts`（大ヘビの節 `World.snake`）、`bosses.ts`（`moveBoss` の振り分け、`Hazard` の種類）、`bosses-snow.ts`（`airborne()` を大ワシにも）。

- [ ] テストを書く: 森の並びと二つ名、延長戦の順、墓地と雪山は同じ。大イノシシの予告と 3 回の突進と休み、土ぼこりで遅くなる、画面の外へ出たまま戻らないことがない。大ワシの影の予告・急降下・羽根 8 本、空では当たらない。大木のおばけの根っこの予告と当たり、実から手下。大ヘビの頭を体がなぞる、節に当たると体力が減る、節に触れると痛い、節は敵の数に入らない。
- [ ] FAIL → 実装 → PASS。Commit。

### Task 5: 描画

**Files:** Create `art/bosses-forest.ts`。Modify `draw-boss.ts`（予告・大ヘビの体）、`draw.ts`。

- [ ] 承認した見本の絵を入れ、headless で 4 体の登場と攻撃を撮る。Commit。

### Task 6: 仕上げ

- [ ] ボットで、店を半分と全部の 1 面のクリアの割合を測り、spec に「## 8. 調整の結果」を書く。CLAUDE.md、`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
