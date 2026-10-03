# Animal Survivors キャラの段と専用進化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 動物を 9 匹（基本 3・中 3・強 2・最強 1）にして段ごとに強さと解放の重さを変え、3 段階めまで育てた動物だけの専用進化を足す。

**Architecture:** 動物の表に `tier` と `special` を持たせ、解放は実績の条件を書き換える。専用進化は `specials.ts` の 1 か所が「3 段階め・最初の武器 Lv5」を見て入れ替え、`gainXp`（育つとき）と `levelUp`（武器が上がるとき）の両方から呼ぶ。竜の息は新しい武器の型 `cone` として `arms.ts` に足す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-roster-tiers-design.md`

## Global Constraints

- 新しい絵は描く前に見本を見せて止まる（トラと竜の子の 3 段階と武器のアイコン・炎）。
- かわいさを残す（黒い丸目とほっぺ）。1 段階めの今の 7 匹の絵は変えない。
- すでに仲間になっている動物は取り上げない。
- 色の表は足すだけ。コンポーネントは 200 行未満、props は 6 つまで。全角スペースと絵文字は使わない。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。

## Review Focus

- 育つのと最初の武器が Lv5 になるのが同じフレーム（宝箱で一度に上がる・経験値の袋で 2 段育つ）でも、専用進化は 1 回だけ。Task 4 のテスト。
- ふつうの進化形を持っている、または宝箱の中身がふつうの進化を選んだ直後でも、専用進化形へ正しく入れ替わり、武器の枠の数が変わらない。Task 4 のテスト。
- 竜の息の扇は、狙う敵がいないとき・敵が真上にいるときも壊れない（向きが NaN にならない）。Task 3 のテスト。
- 古い記録（`finales` が無い、解放済みの動物がある、知らない動物 id がある）を読んでも壊れず、解放は残る。Task 2 のテスト。
- キャラ選択の 9 枚が iPad の縦でも 1 画面に収まり、鍵の文が読める。Task 2 の headless の撮影。

---

### Task 1: トラと竜の子の絵（見本で止まる）

**Files:** Modify `art/animals.ts`（`AnimalId` と 1 段階め）、`art/grown.ts`（2・3 段階め）、`art/items.ts`（`weapon-tigerClaw`・`weapon-breath`・炎の粒 `ember`）。Test `pixels.test.ts`。

- [ ] scratchpad の `formgen.py`（`beast()`）で、トラ（橙に黒いしま、白い口もと。2 段階めは白虎＝白地に黒いしま、3 段階めは雷虎＝金のしまと稲妻の印）と竜の子（緑の体に黄色いお腹、小さな角。2 段階めの若竜は小さな翼、3 段階めの竜王は大きな翼と王冠のような角）を 16・20・24 ドットで描く。1 段階めは歩く 4 コマ・攻撃・被弾。
- [ ] 武器のアイコン 2 つ（14×14 前後）と炎の粒を描く。
- [ ] 見本を送って止まる。承認ののち、`pixels.test.ts` が 9 匹 × 3 段階を見ることを確かめて Commit `Draw Animal Survivors' tiger and dragon cub`。

### Task 2: 段・値・解放の条件・キャラ選択

**Files:** Modify `animals.ts`、`achievements.ts`、`records.ts`（`finales`、`STARTERS`）、`world.ts`（`RunSummary.finale`）、`bosses.ts`（面の主を倒したことを数える）、`CharSelect.svelte`（★）。Create `tiers.test.ts`。

**Interfaces:**

- `Animal.tier: 1 | 2 | 3 | 4`、`Animal.special: string`（専用進化形の武器 id）
- `AnimalId` に `'tiger' | 'dragon'`（竜の子の id は `dragon` だとボスの `dragon` と重なるので `drake` にする）
- `Records.finales: string[]`（面の主を 2 体とも倒した面の id）、`RunSummary.finale: boolean`
- 実績 `survive5`→`forestClear`（キツネ）、`bear`→`forestFinale`（クマ）、`total3000`→`total20000`（ウサギ）、`clear`→`graveClear` にパンダ、`yeti` 撃破（トラ）、`snowClear` に竜の子

- [ ] テストを書く（`tiers.test.ts`）:
  - 9 匹で、段は基本 3・中 3・強 2・最強 1。犬・猫・狼だけが最初から選べる。
  - 段ごとの解放の条件（記録を作って `record()` を通し、出てくる動物）。
  - 古い記録 `{ unlocked: ['fox','panda','nope'] }` を読むと、キツネとパンダは残り、知らない id は捨てる。`finales` が無い記録は空で読む。
  - 面の主を 2 体とも倒した回は `summary(w).finale` が true。
- [ ] FAIL → 実装 → PASS。実績の id を変えると、達成済みの記録（`achieved`）の古い id は数えなくなるので、実績の id は変えずに条件と文と動物だけを書き換える（Ruling に残す）。
- [ ] キャラ選択に★の数を出す。headless で 9 枚を撮り、iPad の縦と iPhone の幅で収まるか確かめる。
- [ ] Commit `Rank Animal Survivors' animals in four tiers with stage-based unlocks`。

### Task 3: トラの爪と竜の息

**Files:** Modify `weapons.ts`（`tigerClaw` は `swipe`、`breath` は新しい型 `cone`）、`arms.ts`（`cone` の当たり）、`draw-arms.ts`（炎の扇）。Create `cone.test.ts`。

**Interfaces:**

- `WeaponKind` に `'cone'`。`cone` は `area` を扇の長さの倍率、`amount` を扇の数（向きをずらして重ねる）に使い、`duration` のあいだ `ZONE_TICK` ごとに扇の中の敵へ当てる
- `inFan()` は `bosses-snow.ts` のものを使う

- [ ] テストを書く（`cone.test.ts`）: 扇の中の敵にだけ当たる。敵がいなければ向いている向きに吐く（NaN にならない）。敵が真上（距離 0）でも当たる。トラの爪は前と後ろの両方に当たる。
- [ ] FAIL → 実装 → PASS。headless で竜の息を撮る。Commit `Give Animal Survivors' tiger a heavy claw and the dragon cub a fire breath`。

### Task 4: 専用進化

**Files:** Create `specials.ts`、`specials.test.ts`。Modify `weapons.ts`（9 つの専用進化形。`special: true`）、`drops.ts`（育ったあと）、`choices.ts`（武器が上がったあと、3 択から外す）、`evolutions.ts`（`baseOf` が専用進化形も元へ返す）、`art/evolved.ts`（王冠を重ねたアイコン）、`hud.ts`（♛）、`prompts.svelte.ts`（帯）、`effects.ts`（演出）、`records.ts`（作った専用進化形は `evolved` に残す）。

**Interfaces:**

- `trySpecial(w: World): boolean`。`w.form === 2` で、`w.weapons` の中に `baseOf(id) === w.animal.weapon` かつ Lv5（ふつうの進化形も含む）の枠があれば、その枠の id を `w.animal.special` にし、`{ type: 'special'; id }` を出す。もう専用進化形なら何もしない
- `GameEvent` に `{ type: 'special'; id: string }`

- [ ] テストを書く（`specials.test.ts`）:
  - 育つのが先（Lv25 に育ってから武器を Lv5 に）と、武器 Lv5 が先（Lv5 にしてから Lv25 に育つ）の両方で 1 回だけ起きる。
  - ふつうの進化形を持っていても専用進化形に入れ替わり、武器の数は変わらない。
  - 同じフレームで 2 段育ち武器も Lv5 になる（宝箱で一度に上がる）場合も 1 回。
  - 専用進化形と元の武器・ふつうの進化形は 3 択に出ない。
  - 段が上の動物ほど専用進化形のダメージが大きい（基本 < 中 < 強 < 最強）。
  - 帯「勇者の犬の 専用進化！」。
- [ ] FAIL → 実装 → PASS。headless で専用進化の瞬間を撮る。Commit `Awaken each Animal Survivors animal's own special evolution`。

### Task 5: ボットで段を整え、文書を最新にする

- [ ] ボットで 9 匹の強化なしの森を測り、生存とクリアが段の順（基本 < 中 < 強 < 最強）になるよう値を整える。竜の子が強すぎて 15 分が退屈にならないよう、クリアの割合は 9 割までにする。
- [ ] CLAUDE.md の Animal Survivors の段落と spec（「## 7. 調整の結果」）を直し、`pnpm verify`、Commit。
- [ ] 別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
