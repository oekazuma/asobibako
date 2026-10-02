# Animal Survivors 3 段階の成長と濃い展開 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 動物が Lv10 と Lv25 で見た目ごと育ち、面の中では 1 分ごとの出来事・2 分おきのヌシ・13:00 の面の主・レアなきらきらハリネズミが起きるようにする。

**Architecture:** 動物の絵を段階の配列にし、`World.form` で選ぶ。育つのは `gainXp` のレベルアップの中で、足し分は `stats()` に渡す。展開は面の表（`events`・`chiefs`・面の主）と、敵の表の `chiefOf`・`metal` で足す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-growth-pacing-design.md`

## Global Constraints

- 新しい絵は描く前に見本を見せて止まる（犬 → 残り 6 匹を 2〜3 匹ずつ → ハリネズミと王冠）。
- 1 段階めの絵（今の絵）とキャラ選択は変えない。当たり判定の大きさも変えない。
- 色の表は足すだけ。コンポーネントは 200 行未満、props は 6 つまで。全角スペースと絵文字は使わない。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。

## Review Focus

- Lv10 と Lv25 を一度に越える（経験値の袋・宝箱）。2 段とも育ち、演出が重ならず、強さが 2 回ぶん入る。Task 3 のテスト。
- 育ったあとにパッシブを取る・進化する。育ちの足し分が残る。Task 3 のテスト。
- 一時停止や 3 択のあいだにきらきらハリネズミの 20 秒が過ぎない（ゲームの時間で数える）。Task 5 のテスト。
- 十字架・時計・群れの出来事ときらきらハリネズミ・ヌシ。十字架ではヌシと面の主は残り、ハリネズミは 1 減るだけ。Task 5 のテスト。
- 墓地の小ボスと面の主の名前の帯。Task 5 のテスト。

---

### Task 1: 犬の 3 段階の絵（見本で止まる）

- [ ] `art/animals.ts` の型を `{ walk, attack, hurt }` から `{ forms: [Pose, Pose, Pose] }`（`Pose = { walk: Art; attack: Art; hurt: Art }`）にする準備として、まず犬だけ `dogForms`（2 段階め 20×20、3 段階め 24×24）を足す。歩く 4 コマは体の型に足の型を 3 つ重ねて作る（今の絵と同じく、2 コマめと 4 コマめは体を 1 ドット上げる）。scratchpad の台本で 3 段階を並べた見本を作って送り、止まる。
- [ ] テストは pixels.test.ts の `problems()` が新しい絵にも効くようにする。
- [ ] Commit `Draw Animal Survivors' dog in three growth forms`。

### Task 2: 残り 6 匹の 2・3 段階めの絵（2〜3 匹ずつ見本で止まる）

- [ ] 猫・狼・キツネ、クマ・ウサギ・パンダの順に、犬と同じ作り方で描いて見本を送り、止まる。
- [ ] `ANIMAL_ART` を全部の動物で `forms` に切りかえ、今の絵を `forms[0]` に入れる。描画・キャラ選択・リザルト・ダッシュの分身の絵の参照を `forms[0]`（キャラ選択）と `forms[w.form]`（遊んでいる最中）に直す。
- [ ] テスト: 7 匹とも 3 段階あり、大きさが 16・20・24。Commit `Draw Animal Survivors' remaining animals in three growth forms`。

### Task 3: 育つしくみ

**Interfaces:** `World.form: 0 | 1 | 2`、`GROW_AT = [10, 25]`、`GameEvent` に `{ type: 'grow'; form: 1 | 2 }`、`Animal.forms: [string, string, string]`、`RunSummary.form`

- [ ] テストを書く（`growth.test.ts`）: 経験値で Lv10 に届くと `form` が 1・HP 全快・攻撃 +10%・最大 HP +20、Lv25 で 2。一度に越えても 2 回育つ。パッシブを取って `stats` を作り直しても足し分が残る。`summary(w).form`。
- [ ] FAIL を確かめる。
- [ ] 実装: `drops.ts` の `gainXp` で Lv が上がるたびに `GROW_AT` を見て `w.form` を上げ、`grow` を出し、HP を全快する。育ちの足し分は `World.boost` とは別の `growth()`（`{ might: 0.1 × form, maxHp: 20 × form }`）を `stats()` の足し分に足す（`createWorld` と `levelUp` と育つときの 3 か所で同じ関数を使う）。`animals.ts` に段階の名前。
- [ ] `draw.ts`・`draw-arms.ts` は `ANIMAL_ART[id].forms[w.form]` を使う。大きくなっても足もとがそろうよう、描く位置は足の下の行を合わせる。
- [ ] `effects.ts`: `grow` で光と粒と音。`prompts.svelte.ts` の `notice` に「子犬は わんぱく犬に育った！」。`Result.svelte` はいちばん育った姿。
- [ ] PASS。headless で Lv9 から育つ瞬間と 3 段階めを撮る。Commit `Grow Animal Survivors' animals at Lv10 and Lv25 with a little more power`。

### Task 4: きらきらハリネズミとヌシの王冠の絵（見本で止まる）

- [ ] `art/enemies.ts` に `metal`（銀のハリネズミ 2 コマ、光の点つき）、`art/items.ts` に `crown`（王冠 8×6）。見本を送り、止まる。Commit `Draw Animal Survivors' sparkling hedgehog and the chiefs' crown`。

### Task 5: 濃い展開

**Interfaces:** `Stage.chiefs: { at: number; enemy: string }[]`、`Stage.finale: number`（面の主の時刻）、`StageEvent.kind` に `'elites' | 'lanterns'`、`chiefOf(def)`、`EnemyDef.chief?`、`EnemyDef.metal?`、`World.metalAt`（出る時刻、出ない回は -1）

- [ ] テストを書く（`pacing.test.ts`）:
  - 森と墓地の出来事が 13〜16 個で、間が 75 秒以下、時刻の順、ボスとヌシの時刻を避ける。
  - `elites` で強化個体が 3〜5 体、`lanterns` でランタンが 8 個（上限の 5 とは別）。
  - ヌシが表の時刻に 3 倍の大きさ・体力 30 倍で出て、倒すと宝箱を落とす。帯の名前。
  - 13:00 に面の 2 体のボスが出て、体力は 1.5 倍、WARNING の名前は「面の主」。
  - きらきらハリネズミ: 1000 個の種で出る回が 25〜35%、時刻は 180〜720 秒。1 しか減らない。自分から離れる。ゲームの時間で 20 秒たつと去る（倒した数に入らない）。倒すと経験値の玉とコイン 100。十字架では 1 減るだけ。
  - 十字架でヌシは残る。
- [ ] FAIL を確かめる。
- [ ] 実装する（`world.ts` の `spawnEvents` に 2 種類、`spawnChiefs`、`spawnMetal`、`damageEnemy` の `metal` は 1 だけ、`moveEnemy` の `metal` は逃げる、`bosses.ts` の面の主、`drops.ts` のハリネズミとヌシの落とし物、描画は `chief` を 3 倍で王冠、`metal` は光の粒）。面の表を 1 分ごとに書き直す。実績 `metal` を足す。
- [ ] PASS。headless でヌシ・面の主・ハリネズミを撮る。Commit `Pack Animal Survivors' stages with minute events, chiefs, a finale, and a rare sparkling hedgehog`。

### Task 6: ボットで確かめて、文書を最新にする

- [ ] ボットで森と墓地の強化なしを測り、今（森 39〜43/84、墓地 11/84）から大きくずれたら、ふつうの敵の出る数で整える。
- [ ] CLAUDE.md と spec（「## 6. 調整の結果」）を直し、`pnpm verify`、Commit。
- [ ] 別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
