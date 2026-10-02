# Animal Survivors 3 面め「雪山」 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 墓地をクリアすると選べる 3 面め「雪山」を足す。敵 7 種は雪の顔ぶれ、ときどき吹雪が来て、ボスは新しい動きの大雪男と氷の竜。

**Architecture:** 面の表 `stages/snow.ts` は森の表を写して敵を入れ替え、`storms` を持つ。吹雪は `storm.ts` が World の時計で進め、`step` が風を自分と敵の移動に足す。新しいボスの動きは `bosses-snow.ts` に置き、`moveBoss` が `ai` で振り分ける。予告と弾は今の `Hazard` に種類を足す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、Web Audio（`$lib/music`）、vitest、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-03-animal-survivors-snow-design.md`

## Global Constraints

- 新しい絵は描く前に見本を見せて止まる（地面と飾り → 敵 7 種とちび雪だるま → ボス 2 体と弾）。
- かわいさを残す（黒い丸目、怖い目にしない）。
- 色の表は足すだけ。コンポーネントは 200 行未満、props は 6 つまで。全角スペースと絵文字は使わない。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。`pnpm verify` が通ること。
- 森と墓地の遊び方・強さは変えない。

## Review Focus

- 一時停止・3 択・宝箱・時計（敵が止まる）のあいだに吹雪の残りが減らない、風で流されない。Task 5 のテスト。
- 吹雪の 20 秒とボスの攻撃・予告が重なっても、予告の位置がずれない（予告は地面に置く）。Task 6・7 のテスト。
- 大雪男が跳んでいるあいだは武器も体当たりも当たらず、着地の前に倒されることもない。十字架でも消えない。Task 6 のテスト。
- 氷の竜の息の扇は竜が倒れたら消え、ほかのボスの予告の持ち主と取り違えない（`owner` の番号）。Task 7 のテスト。
- 古い記録（`stages` に `snow` が無い・知らない面の id がある）でも雪山が開かず、壊れない。Task 4 のテスト。

---

### Task 1: 雪の地面と飾りの絵（見本で止まる）

**Files:** Create `art/snow.ts`。Modify `draw.ts`（`GROUNDS` に `snow`）。Test `pixels.test.ts`。

- [ ] `art/snow.ts` に `SNOW_ART = { grass, dirt, decor: { drift, pine, rock, ice, tuft } }`（形は `art/graveyard.ts` の `GRAVE_ART` と同じ）。地は白と薄い青（`w`・`q`・`s`）、踏まれた雪は `s`・`S`。
- [ ] scratchpad の台本で、森・墓地と並べた見本（地面の 1 面と飾り全部）を作って送り、止まる。
- [ ] `pixels.test.ts` の `all` に `snow.grass`・`snow.dirt`・飾りを足す。`draw.ts` の `GROUNDS.snow`（`shadowed: ['pine', 'rock']`）。
- [ ] Commit `Draw Animal Survivors' snowfield ground and decor`。

### Task 2: 雪の敵 7 種とちび雪だるまの絵（見本で止まる）

**Files:** Modify `art/enemies.ts`。Test `pixels.test.ts`（敵は 2 コマ）。

- [ ] `penguin`（12×12）・`snowsprite`（12×12、羽ばたく雪ん子）・`seal`（14×12）・`snowman`（14×16）・`reindeer`（20×16）・`hare`（14×12）・`polar`（24×14）・`snowling`（10×10）。右向き、2 コマ、黒い丸目。
- [ ] 見本を送り、止まる。Commit `Draw Animal Survivors' snow enemies`。

### Task 3: 大雪男と氷の竜と弾の絵（見本で止まる）

**Files:** Modify `art/bosses.ts`・`art/items.ts`。Test `pixels.test.ts`。

- [ ] `yeti`（32×32、歩く 2 コマと跳ぶ 1 コマ）・`dragon`（36×28、羽ばたく 2 コマ）。`items` に `snowball`（12×12、描くときに大きさを変える）・`icicle`（10×16）。息は描画で扇を塗る（絵は持たない）。
- [ ] 見本を送り、止まる。Commit `Draw Animal Survivors' yeti, ice dragon, and their attacks`。

### Task 4: 雪山の面の表・敵の表・選べる条件・曲・実績

**Files:** Create `stages/snow.ts`、`snow.test.ts`。Modify `stages/forest.ts`（`Stage.art`・`song` の型、`after`、`storms`）、`stages/index.ts`、`stages/graveyard.ts`（`after: 'forest'`）、`enemies.ts`、`records.ts`（`canPlay`）、`achievements.ts`、`songs.ts`、`Survivors.svelte`（曲の型）、`StageSelect.svelte`（3 枚め）、`world.ts`（`BossId` の追加に追従）。

**Interfaces:**

- `Stage.after?: string`（先にクリアする面）、`Stage.storms: { at: number; len: number }[]`（森・墓地は `[]`）、`Stage.art: 'forest' | 'graveyard' | 'snow'`、`Stage.song: 'field' | 'grave' | 'snow'`
- `canPlay(r, stage)`: `!stageOf(stage).after || r.stages.includes(stageOf(stage).after)`。知らない id は `false`
- `BossId` に `'yeti' | 'dragon'`、`EnemyDef.ai` に `'yeti' | 'dragon'`
- `SNOW: Stage`（`coin: 2`、`after: 'graveyard'`、`toughness: (t) => FOREST.toughness(t) * HARDER`、`HARDER` はボットで決める。始めは 1.3）

- [ ] テストを書く（`snow.test.ts`）:
  - `STAGES` が森・墓地・雪山の順。雪山の敵（waves・events・chiefs・bosses）がすべて敵の表にあり、出来事とヌシの時刻が森と同じ。
  - `canPlay`: 何も無い記録は森だけ、`stages: ['forest']` で墓地まで、`['forest','graveyard']` で雪山まで。`'nope'` は false。
  - 古い保存 `{ stages: ['forest', 'nope'] }` を `parseRecords` に通しても雪山は開かない。
  - 実績 `snowClear`（400）と `snowBosses`（300）。
  - 雪山の曲が `SONGS.snow` にある。
- [ ] FAIL を確かめる。
- [ ] 実装する。敵の表に `penguin`（ネズミの値）・`snowsprite`（コウモリ）・`seal`（ヘビ）・`snowman`（イモムシ）・`reindeer`（イノシシ）・`hare`（クモ）・`polar`（ワニ）・`snowling`（[10, 46, 7, 5, 1]、chase）と、ボス `yeti`（[1100, 30, 26, 16, 0]、`ai: 'yeti'`、`minion: 'snowling'`、`shot: 'snowball'`）・`dragon`（[1500, 40, 28, 18, 0]、`ai: 'dragon'`、`shot: 'icicle'`）。ボスの動きは Task 6・7 まで `moveBoss` の既定（女王グモ型）に落ちる。
- [ ] `StageSelect.svelte` は `canPlay` と `s.unlock` の文で鍵を出す（今の形のまま 3 枚になる）。`draw.ts` の `GROUNDS` は Task 1 で足したもの。
- [ ] PASS、`pnpm check`。Commit `Add Animal Survivors' snow mountain stage after the graveyard`。

### Task 5: 吹雪

**Files:** Create `storm.ts`、`storm.test.ts`。Modify `world.ts`（`World.storm`、`step`）、`prompts.svelte.ts`（帯）、`draw.ts` か新しい `draw-storm.ts`（かすみと雪）、`effects.ts`（風の音）。

**Interfaces:**

- `World.storm: { next: number; left: number; wx: number; wy: number }`（`next` は次の `storms` の番号、`left` は残り秒、風は単位ベクトル）
- `stepStorm(w, dt)`: 予告（`at - 3` で `{ type: 'swarm', text: '吹雪が来る！' }`）、始まりで風を乱数で決めて `left = len`、`left` を減らす
- `STORM_PUSH = 0.2`（自分が流される速さ、ふつうの速さに対する割合）、`STORM_WIND = 0.4`（敵の速さの変わり幅）
- `windFactor(w, vx, vy): number`（敵の速さに掛ける 1 ± 0.4）

- [ ] テストを書く（`storm.test.ts`）:
  - 表の時刻の 3 秒前に帯、時刻に始まり 20 秒で終わる。
  - 吹雪のあいだ、止まっていても自分が風下へ 0.2 × ふつうの速さで流れる。
  - 風下へ進む敵は速く、風上へ進む敵は遅い。ボス・ランタン・群れ（`drift`）は変わらない。
  - `pending` が 1（3 択）や `chests` が 1 のあいだ step を回しても `left` が減らない。時計（`freeze`）のあいだは流されない。
  - 森と墓地は吹雪が来ない。
- [ ] FAIL → 実装 → PASS。描画はかすみ（白、不透明度 0.35）と、風の向きに流れる雪の線（ドットで 60 本）。HUD は描いたあとで上に重ねる。headless で吹雪を撮る。
- [ ] Commit `Blow blizzards across Animal Survivors' snow mountain`。

### Task 6: 大雪男

**Files:** Create `bosses-snow.ts`、`yeti.test.ts`。Modify `bosses.ts`（`moveBoss` の振り分け、`Hazard.kind` に `'ball' | 'pounce'`、`updateHazards`）、`world.ts`（跳んでいるあいだは当たらない）、`arms.ts`（同）、`draw-boss.ts`（影と雪玉）。

**Interfaces:**

- `YETI = { every: 4, ballSpeed: 70, ballR: [6, 14], ballLife: 4, ballDmg: 24, pounceWarn: 1, pounceR: 48, pounceDmg: 30, brood: 3 }`
- `Enemy.state` 4 が跳んでいるあいだ。`airborne(e): boolean`（`e.def.ai === 'yeti' && e.state === 4`）を `world.ts` に置き、`touch`・`within`（arms）・`zones`・`clearScreen` が飛ばす
- `Hazard.kind === 'ball'` は `owner: -1` で動いて大きくなり、`'pounce'` は地面に置いた予告（`x, y` は自分のいた位置）

- [ ] テストを書く（`yeti.test.ts`）:
  - 雪玉が自分へ向かって転がり、半径が 6 から 14 へ大きくなり、当たると痛く、4 秒で消える。
  - 飛びかかりは自分のいた位置に予告を 1 秒出し、そのあいだ大雪男は当たり判定がない（武器・体当たり・十字架）。着地で半径 48 の中だけ痛く、ちび雪だるまが 3 匹出る。
  - 予告のあいだに大雪男が倒れたら（`alive` を false にする）予告が消える。
  - 交互に使う（雪玉 → 飛びかかり → 雪玉）。
- [ ] FAIL → 実装 → PASS。headless で 2 つの攻撃を撮る。Commit `Teach Animal Survivors' yeti to roll snowballs and pounce`。

### Task 7: 氷の竜

**Files:** Modify `bosses-snow.ts`、`bosses.ts`（`Hazard.kind` に `'pillar' | 'breath'`）、`draw-boss.ts`（円と柱、扇と息）。Create `dragon.test.ts`。

**Interfaces:**

- `DRAGON = { keep: 120, every: 3.5, pillarWarn: 1, pillarR: 18, pillarSpread: 40, pillarDmg: 22, breathWarn: 0.8, breathTime: 1, breathAngle: Math.PI / 3, breathLength: 120, breathDmg: 8, breathTick: 0.25 }`
- `'breath'` の予告は持ち主の番号（`owner`）と向き（`vx, vy`）を持ち、`inFan(h, x, y): boolean`

- [ ] テストを書く（`dragon.test.ts`）:
  - 氷の柱は自分の位置とそのまわり 4 か所に予告を出し、1 秒後に円の中にいるときだけ痛い。
  - 息は自分へ向いた扇の予告 0.8 秒のあと、1 秒のあいだ扇の中にいると 0.25 秒ごとに痛く、遅くなる（`player.slow`）。扇の外では当たらない。
  - 竜が倒れたら息の予告と息が消える。持ち主の番号が別のボスと取り違えられない（面の主で 2 体いるとき）。
  - 少し離れた所を保つ（近づくと下がる）。
- [ ] FAIL → 実装 → PASS。headless で 2 つの攻撃と面の主を撮る。Commit `Teach Animal Survivors' ice dragon icicles and frost breath`。

### Task 8: ボットで強さを決め、文書を最新にする

- [ ] ボットで雪山の強化なしと店の半分を測り、強化なしが墓地（12/84）より少なく、店の半分で 60/84 以上になるよう `HARDER` を決める。
- [ ] CLAUDE.md の Animal Survivors の段落と spec（「## 7. 調整の結果」）を直し、`pnpm verify`、Commit。
- [ ] 別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
