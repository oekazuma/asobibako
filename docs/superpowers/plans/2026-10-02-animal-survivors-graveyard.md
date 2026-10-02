# Animal Survivors 夜の墓地 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2 面め「夜の墓地」を、面を選ぶ画面・墓地の表・敵 3 種とボス 2 体・墓地の曲・記録と実績つきで足す。

**Architecture:** 面の表を `stages/` に並べ（`STAGES`）、`createWorld` が面の id で表を選ぶ。描画は面の `art` で地面と飾りを選ぶ。ボスは敵の表の `ai` で今の 2 つの動きを使い回し、手下と飛び道具の絵も表に持つ。記録に `stages`（クリアした面）と `stage`（前の面）を足す。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、Web Audio、vitest、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-02-animal-survivors-graveyard-design.md`

## Global Constraints

- 森の強さと見た目は変えない（森の表の数値・絵・曲はそのまま）。
- 新しい絵は描く前に見本を見せて止まる（2 回）。墓地の曲は WAV で聞いてもらって止まる。
- 色の表（`art/palette.ts`）は足すだけ。今の文字の色は変えない。
- コンポーネントは 200 行未満、props は 6 つまで。全角スペースは使わない。絵文字は使わない。
- 記録は `asobibako:animal-survivors` に足す。古い保存は `clears` が 1 以上なら森をクリアしたことにする。
- コードコメントは非自明な WHY だけ。docs は最新の仕様だけ。
- `pnpm verify` が通ること。

## Review Focus

- 墓地で遊んだあとに「もう一度」と「最初からやり直す」。同じ動物・同じ面で始まる。Task 6 の headless。
- 墓地のボスの WARNING の名前と、ボスの曲の切り替え。森と同じに働く。Task 4 のテスト。
- 森をクリアしていない古い保存。墓地は影で押せない。Task 5 のテスト。
- 墓地で倒した `pumpkin`・`knight` が、森の実績（巨大ベア・女王グモ）を誤って満たさない。Task 5 のテスト。
- 面を選ぶ画面を開いたまま隠れて戻る・ミュート。曲はキャラ選択の曲のまま。Task 7。

---

### Task 1: 地面・飾り・敵 3 種の絵（見本で止まる）

**Files:**

- Modify: `src/lib/games/animal-survivors/art/palette.ts`（夜の色を足す）
- Create: `src/lib/games/animal-survivors/art/graveyard.ts`（`GRAVE_ART`: `grass`（4 コマ）・`dirt`・`decor`（`tomb`・`cross`・`deadtree`・`candle`・`bones`））
- Modify: `src/lib/games/animal-survivors/art/enemies.ts`（`ghost`・`skeleton`・`zombie`、2 コマ）
- Test: `src/lib/games/animal-survivors/pixels.test.ts`

- [ ] **Step 1:** pixels.test.ts の `all` に `GRAVE_ART` の絵を足し、`it('墓地の地面・飾り・敵 3 種の絵がある')` で `GRAVE_ART.grass.frames` が 4 コマ、`decor` の 5 つ、`ENEMY_ART.ghost`・`skeleton`・`zombie` が 2 コマであることを確かめる。
- [ ] **Step 2:** `pnpm vitest run src/lib/games/animal-survivors/pixels.test.ts` → FAIL（`./art/graveyard` が無い）。
- [ ] **Step 3:** palette.ts に夜の地面の色を足す: `n: '#3a3256'`（芝）・`N: '#272040'`（芝の影）・`m: '#5a4e3c'`（土）・`M: '#3e3528'`（土の影）・`q: '#d8d0e8'`（骨・墓石の明るいところ）。森の `LLLL…` と同じ形で、墓地の芝 4 コマ（`n` 地に `N` の草）と土（`m`/`M`）、飾り 5 つ（墓石 12×14、十字の墓 10×14、枯れ木 16×20、ろうそく 8×10、骨 10×6）、敵 3 種（おばけ 14×14 は白と紫で下が揺れる、ガイコツ 14×16、ゾンビ 14×16 は緑の肌）を手で打つ。`problems()` の確かめが全部の絵に効く。
- [ ] **Step 4:** `pnpm vitest run src/lib/games/animal-survivors/pixels.test.ts` → PASS。
- [ ] **Step 5:** scratchpad の台本（`lantern-sheet.sim.ts` と同じ形）で、墓地の地面を 6×4 タイル敷いた上に飾り 5 つと敵 3 種の 2 コマを並べ、比べるために森のネズミと木も並べた PNG を作る。Read で見てから利用者に送り、止まる。
- [ ] **Step 6:** Commit `Draw Animal Survivors' graveyard ground, decor, and three new enemies`。

### Task 2: ボス 2 体・ちびかぼちゃ・種の絵（見本で止まる）

**Files:**

- Modify: `src/lib/games/animal-survivors/art/bosses.ts`（`pumpkin`（2 コマ、36×32）・`knight`（3 コマ、36×36。3 コマ目は剣を振り上げる）・`pumpkinling`（2 コマ、10×10））
- Modify: `src/lib/games/animal-survivors/art/items.ts`（`seed` 8×8）
- Test: `src/lib/games/animal-survivors/pixels.test.ts`

- [ ] **Step 1:** pixels.test.ts に `it('墓地のボス・ちびかぼちゃ・種の絵がある')`（`BOSS_ART.pumpkin` 2 コマ、`knight` 3 コマ、`pumpkinling` 2 コマ、`ITEM_ART.seed`）。
- [ ] **Step 2:** FAIL を確かめる。
- [ ] **Step 3:** 手で打つ。かぼちゃ大王は橙のかぼちゃに目と口がくり抜かれ、中が黄色く光り、小さな王冠。ガイコツの騎士は骨の体に錆びた兜と剣と盾。ちびかぼちゃは目の付いた小さなかぼちゃ。種は白い種に黒い縁。
- [ ] **Step 4:** PASS を確かめる。
- [ ] **Step 5:** 森のボス 2 体と並べた見本を作って送り、止まる。
- [ ] **Step 6:** Commit `Draw Animal Survivors' graveyard bosses, pumpkinlings, and seeds`。

### Task 3: 面の表と墓地のしくみ

**Files:**

- Create: `src/lib/games/animal-survivors/stages/graveyard.ts`, `src/lib/games/animal-survivors/stages/index.ts`
- Modify: `stages/forest.ts`（`Stage` に `art`・`coin`・`song`・`unlock`）、`enemies.ts`（敵 4 種とボス 2 体、`ai`・`minion`・`shot`）、`bosses.ts`、`world.ts`、`draw.ts`、`draw-boss.ts`、`effects.ts`
- Test: `src/lib/games/animal-survivors/graveyard.test.ts`（新）

**Interfaces:**

- Produces:
  - `Stage.art: 'forest' | 'graveyard'`、`Stage.coin: number`、`Stage.song: 'field' | 'grave'`、`Stage.unlock?: string`
  - `STAGES: Stage[]`、`stageOf(id: string): Stage`
  - `EnemyDef.ai?: 'bear' | 'queen'`、`EnemyDef.minion?: string`、`EnemyDef.shot?: string`（飛び道具の ITEM_ART の名前）
  - `BossId = 'bear' | 'spiderQueen' | 'pumpkin' | 'knight'`
  - `createWorld(id, seed, view, ranks = {}, stage = 'forest')`
  - `Hazard.art?: string`

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { FOREST } from './stages/forest';
import { GRAVEYARD } from './stages/graveyard';
import { STAGES, stageOf } from './stages';
import { coinsOf, createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };

describe('面の表', () => {
  it('森と墓地が並び、墓地の敵とボスはどれも敵の表にある', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard']);
    for (const w of GRAVEYARD.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of GRAVEYARD.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    for (const e of GRAVEYARD.events) expect(ENEMIES[e.enemy]).toBeDefined();
    const at = GRAVEYARD.events.map((e) => e.at);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    for (const b of GRAVEYARD.bosses) for (const t of at) expect(Math.abs(t - b.at)).toBeGreaterThan(20);
    expect(stageOf('nope')).toBe(FOREST);
  });

  it('墓地は森より 1.3 倍強く、コインは 1.5 倍', () => {
    for (const t of [0, 300, 899]) {
      expect(GRAVEYARD.toughness(t)).toBeCloseTo(FOREST.toughness(t) * 1.3);
      expect(GRAVEYARD.fury(t)).toBeCloseTo(FOREST.fury(t) * 1.3);
    }
    const w = createWorld('dog', 1, VIEW, {}, 'graveyard');
    expect(w.stage).toBe(GRAVEYARD);
    w.coins = 10;
    expect(coinsOf(w)).toBe(15);
  });
});

describe('墓地のボス', () => {
  function boss(id: 'pumpkin' | 'knight') {
    const w = createWorld('dog', 1, VIEW, {}, 'graveyard');
    w.stage = { ...w.stage, waves: [], bosses: [], events: [] };
    w.spawnAcc = [];
    w.weapons = [];
    w.player.invuln = 9999;
    w.enemies.push(makeEnemy(ENEMIES[id], 80, 0, ENEMIES[id].hp));
    for (let i = 0; i < 60 * 12; i++) step(w, { x: 0, y: 0 }, 1 / 60);
    return w;
  }

  it('かぼちゃ大王は種を撃ち、ちびかぼちゃを呼ぶ', () => {
    const w = boss('pumpkin');
    expect(w.enemies.some((e) => e.alive && e.def.id === 'pumpkinling')).toBe(true);
    expect(w.enemies.some((e) => e.alive && e.def.id === 'spiderling')).toBe(false);
  });

  it('ガイコツの騎士は突進と地ならしを使う', () => {
    const w = createWorld('dog', 1, VIEW, {}, 'graveyard');
    w.stage = { ...w.stage, waves: [], bosses: [], events: [] };
    w.spawnAcc = [];
    w.weapons = [];
    w.player.invuln = 9999;
    w.enemies.push(makeEnemy(ENEMIES.knight, 80, 0, ENEMIES.knight.hp));
    const kinds = new Set<string>();
    for (let i = 0; i < 60 * 12; i++) {
      step(w, { x: 0, y: 0 }, 1 / 60);
      for (const h of w.hazards) if (h.alive) kinds.add(h.kind);
    }
    expect(kinds).toEqual(new Set(['dash', 'slam']));
  });
});
```

かぼちゃ大王の種が `seed` の絵で出ることは `w.hazards` の `art` で確かめる（`boss('pumpkin')` の途中で `kind === 'web' && art === 'seed'`）。

- [ ] **Step 2:** `pnpm vitest run src/lib/games/animal-survivors/graveyard.test.ts` → FAIL。
- [ ] **Step 3: 実装する**
  - `stages/forest.ts`: `Stage` に 4 つの項目を足し、`FOREST` に `art: 'forest', coin: 1, song: 'field'`。
  - `stages/graveyard.ts`: 森の表を写し、`id: 'graveyard'`・`name: '夜の墓地'`・`art: 'graveyard'`・`coin: 1.5`・`song: 'grave'`・`unlock: '森をクリアすると行ける'`、出現表は rat→ghost、snake→skeleton、caterpillar→zombie（boar・croc はそのまま、spider・bat も）、`bosses: [{ at: 300, id: 'pumpkin' }, { at: 600, id: 'knight' }]`、`toughness`・`fury` は `FOREST` の 1.3 倍、`cap` は 1.15 倍（`Math.round`）、出来事は spec の表。
  - `stages/index.ts`: `export const STAGES = [FOREST, GRAVEYARD]; export const stageOf = (id: string) => STAGES.find((s) => s.id === id) ?? FOREST;`
  - `enemies.ts`: `BossId` に `'pumpkin' | 'knight'`、`EnemyDef` に `ai`・`minion`・`shot`。`bear` に `ai: 'bear'`、`spiderQueen` に `ai: 'queen', minion: 'spiderling', shot: 'web'`。spec の表のとおり `ghost`・`skeleton`・`zombie`・`pumpkinling`・`pumpkin`（`ai: 'queen', minion: 'pumpkinling', shot: 'seed'`）・`knight`（`ai: 'bear'`）を足す。
  - `bosses.ts`: `moveBoss` は `e.def.ai === 'bear' ? bear(...) : queen(...)`。`queen` の手下は `ENEMIES[e.def.minion ?? 'spiderling']`、糸の玉の `hazard` に `art: e.def.shot`。`Hazard` に `art?: string`。
  - `world.ts`: `createWorld` に `stage = 'forest'` を足して `stageOf(stage)` を使い、`spawnAcc` も選んだ面の `waves` から作る。`touch` の `e.def.boss === 'bear' && e.state === 2` を `e.def.ai === 'bear' && e.state === 2` にする。`spawn` の強化個体を除く `base.id !== 'spiderling'` を `base.id !== 'spiderling' && base.id !== 'pumpkinling'` にする。`coinsOf` は `Math.floor(w.coins * w.greed * w.stage.coin + 1e-9)`。
  - `draw.ts`: `ART` に新しい敵とボスが入る（`ENEMY_ART`・`BOSS_ART` から）。巨大ベアの地ならしのコマ（`e.def.boss === 'bear' && e.state === 3`）を `e.def.ai === 'bear' && e.state === 3` にする。地面と飾りは `w.stage.art` で `FOREST_ART` と `GRAVE_ART` を選び、飾りの出方の表（`DECOR`）も面ごとに持つ（墓地: 0.55 で無し、0.72 骨、0.84 ろうそく、0.92 十字の墓、0.97 墓石、1 枯れ木）。影を付けるのは木・岩・切り株・墓石・十字の墓・枯れ木。
  - `draw-boss.ts`: `ITEM_ART.web` を `ITEM_ART[h.art ?? 'web']` にする。
  - `effects.ts`: `BODY` に `ghost: PALETTE.w`、`skeleton: PALETTE.q`、`zombie: PALETTE.l`、`pumpkinling: PALETTE.o`、`pumpkin: PALETTE.o`、`knight: PALETTE.q`。
- [ ] **Step 4:** `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check` → PASS（森のテストはそのまま通る）。
- [ ] **Step 5:** Commit `Add Animal Survivors' graveyard stage table, enemies, and bosses that reuse the forest bosses' moves`。

### Task 4: 墓地のボスの WARNING と曲

**Files:**

- Modify: `src/lib/games/animal-survivors/prompts.svelte.ts`（WARNING の名前はボスの表から引くので変えない見込み）
- Test: `src/lib/games/animal-survivors/graveyard.test.ts`

- [ ] **Step 1:** テストを足す: 墓地の世界で `w.time = 297` から進めて、`warning` の出来事の `boss` が `pumpkin`、`Prompts.take()` の `warning.name` が「かぼちゃ大王」、`Prompts.boss` が true になる。かぼちゃ大王を倒すと false。
- [ ] **Step 2:** 走らせる。通るなら（今のしくみがそのまま効くなら）実装は要らず、テストだけを残す。落ちたら直す。
- [ ] **Step 3:** Commit `Check Animal Survivors' graveyard boss warnings and boss song switching`。

### Task 5: 記録・実績・解放

**Files:**

- Modify: `src/lib/games/animal-survivors/records.ts`, `achievements.ts`, `world.ts`（`RunSummary.stage`）
- Test: `src/lib/games/animal-survivors/graveyard.test.ts`

**Interfaces:**

- Produces: `Records.stages: string[]`、`Records.stage: string`、`RunSummary.stage: string`、`canPlay(r: Records, stage: string): boolean`、実績 `graveClear`・`graveBosses`

- [ ] **Step 1:** テストを足す。
  - 森をクリアすると `stages` に `forest` が入り、`canPlay(r, 'graveyard')` が true。
  - 古い保存（`clears: 1`、`stages` 無し）は森をクリアしたことになる。`clears: 0` なら墓地は false。
  - 墓地をクリアすると `graveClear`、`pumpkin` と `knight` を倒すと `graveBosses`。
  - `pumpkin` と `knight` だけ倒しても `bear`・`queen` の実績は入らない。
  - `stage` は前に遊んだ面を覚え、知らない id は `forest` で読む。
- [ ] **Step 2:** FAIL を確かめる。
- [ ] **Step 3:** 実装する。
  - `RunSummary.stage = w.stage.id`。
  - `Records` に `stages`・`stage`、`emptyRecords` で `stages: [], stage: 'forest'`。`parseRecords` は `stages: list(raw.stages, STAGES ids)` に、`clears >= 1` なら `forest` を足す。`stage` は知っている面の id か `forest`。
  - `record()` で `if (run.cleared && !r.stages.includes(run.stage)) r.stages.push(run.stage);` と `r.stage = run.stage`。`BOSSES` に `pumpkin`・`knight`。
  - `canPlay(r, id)`: `id === 'forest' || r.stages.includes('forest')`。
  - 実績の末尾に `{ id: 'graveClear', name: '夜の墓地をクリア', coins: 300, done: (r) => r.stages.includes('graveyard') }` と `{ id: 'graveBosses', name: '墓地の 2 体のボスを倒す', coins: 200, done: (r) => r.bosses.includes('pumpkin') && r.bosses.includes('knight') }`。実績の数の確かめ（progress.test.ts）を 27 にする。
- [ ] **Step 4:** PASS を確かめる。
- [ ] **Step 5:** Commit `Record Animal Survivors' cleared stages and unlock the graveyard after the forest`。

### Task 6: 面を選ぶ画面

**Files:**

- Create: `src/lib/games/animal-survivors/StageSelect.svelte`
- Modify: `src/lib/games/animal-survivors/Survivors.svelte`, `Play.svelte`
- Test: `src/lib/games/animal-survivors/StageSelect.svelte.test.ts`（新）

**Interfaces:**

- Produces: `StageSelect.svelte` の props `{ records: Records; onpick: (id: string) => void; onback: () => void }`、`Play.svelte` の props の `animal` を `{ animal: AnimalId; stage: string }` にまとめた `run` に変える（props を 6 つに保つ）

- [ ] **Step 1:** テストを書く: 森しかクリアしていない記録で墓地のカードが押せ、まだの記録では `disabled` で「森をクリアすると行ける」を出す。前に遊んだ面のカードに印（`aria-current="true"`）。押すと `onpick('graveyard')`。
- [ ] **Step 2:** FAIL を確かめる。
- [ ] **Step 3:** 実装する。`StageSelect.svelte` は `as-screen`・`as-panel` で、面ごとのカードに地面のタイルを 3×2 並べた絵と名前・「コイン ×1.5」などを出す。`Survivors.svelte` は動物を選んだら `screen = 'stage'` にし、面を選んだら遊ぶ。`start()` は動物と面の両方を覚え、「もう一度」とやり直しは同じ組で始める。`Play.svelte` は `createWorld(..., ranks, stage)` で面を選ぶ。
- [ ] **Step 4:** `pnpm vitest run src/lib/games/animal-survivors/ && pnpm check && pnpm vitals --diff` → PASS。
- [ ] **Step 5:** headless で、キャラ選択 → 面を選ぶ（森だけ、墓地も）→ 墓地で遊ぶ（地面と敵）→ やめる → もう一度（墓地のまま）を撮る。iPhone の幅でも撮る。
- [ ] **Step 6:** Commit `Choose Animal Survivors' stage after the character and remember the last one`。

### Task 7: 墓地の曲（WAV で止まる）

**Files:**

- Modify: `src/lib/games/animal-survivors/songs.ts`, `songs.test.ts`, `Survivors.svelte`

- [ ] **Step 1:** songs.test.ts に、`grave` の楽譜が読め、`style` が `drive`、テンポが森より遅いことを足す。FAIL を確かめる。
- [ ] **Step 2:** `SONGS.grave`（短調、16 小節、テンポ 132）を書く。
- [ ] **Step 3:** PASS を確かめ、`songs-wav.mjs` で WAV に書き出して送り、止まる。
- [ ] **Step 4:** `Survivors.svelte` の遊んでいる最中の曲を `SONGS[field.song === 'boss' ? 'boss' : stageOf(stage).song]` にする。
- [ ] **Step 5:** Commit `Play a graveyard song in Animal Survivors' night stage`。

### Task 8: ボットで確かめて、文書を最新にする

- [ ] **Step 1:** scratchpad の `sim/survivors.sim.ts` に `STAGE` を足し、墓地で強化なしと全部最大を 7 匹 × 2 つの選び方 × 6 回回す。墓地の強化なしの生存の中央値が森（709〜900 秒）より短く、全部最大でクリアできること。どちらかに大きく外れたら、墓地の倍率（1.3）を直す。
- [ ] **Step 2:** CLAUDE.md の Animal Survivors の段落に、面を選ぶ画面・`stages/` の表と `STAGES`・面の `art`/`coin`/`song`・`ai`/`minion`/`shot`・記録の `stages`/`stage` を足す。spec に「## 8. 調整の結果」を書く。
- [ ] **Step 3:** `pnpm verify` → PASS。Commit `Check Animal Survivors' graveyard with the bot and document it`。
- [ ] **Step 4:** 別の係（最も強いモデル）にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
