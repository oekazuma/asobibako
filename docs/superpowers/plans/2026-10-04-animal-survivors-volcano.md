# Animal Survivors 火山 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 雪山のあとに開く 4 つめのステージ「火山」を足す。敵 7 種の入れ替え、溶岩の池が自分にも敵にも当たる噴火、新しい動きのボス 2 体（溶岩の巨人・不死鳥）、地面の絵、曲、実績 3 つ。

**Architecture:** 火山の表は雪山と同じく森の表を写して敵を入れ替える（`stages/volcano.ts`）。噴火と溶岩は `eruption.ts` が `World.lava`（割れ目と池）として持ち、step の中で進める。ボスの動きは `bosses-volcano.ts` で、地ならしと岩も同じ `addLava` で池を残す。不死鳥のよみがえりは `damageEnemy` が倒す手前で見る。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、scratchpad のボットとドット絵の道具

**Spec:** `docs/superpowers/specs/2026-10-04-animal-survivors-volcano-design.md`

## Global Constraints

- 新しい絵は使う前に見本を見せる。敵・ボス・地面の 3 回に分け、決まるまでその絵を使うタスクに進まない。動物とちがい敵は怖めでよいが、見た目の水準は今の敵とそろえる。
- 火山の時刻は森の表を写す（10 分）。強さは森の 1.3 倍、上限 1.2 倍、コイン 2.5。
- 噴火の時計は step の中で進め、3 択・一時停止・時計の品で止まる。
- コンポーネントは 200 行未満。コメントは非自明な WHY だけ。`pnpm verify` が通ること。

## Review Focus

- 溶岩の池でボスやランタン・大ヘビの節が倒れない（Task 5 のテスト）。
- 不死鳥のよみがえりの途中で、十字架・クリアの一掃・延長戦の切り替えが来ても、倒した数・ボスの記録・ボスの曲が二重にならない（Task 7 のテスト）。
- 時計の品で止まっているあいだ、池が当たらず、割れ目も噴かない（Task 5 のテスト）。
- 池が増えすぎない（噴火 20 秒とボスの池が重なっても数に上限）（Task 5 のテスト）。
- 古い記録で、火山を選べない・選んでも壊れない（Task 4 のテスト）。

---

### Task 1: 敵 7 種の絵の見本（利用者に見せて止まる）

- [ ] scratchpad の道具（[[pixel-art-tooling]] の形。`art/enemies.ts` の森の 7 種を読んで形と大きさを合わせる）で、トカゲ・火の玉・溶岩ヘビ・岩ムシ・火イノシシ・炎グモ・岩ワニを 2 コマずつ描き、森の 7 種と並べた PNG を `SendUserFile` で見せる。
- [ ] 決まった絵を `art/enemies.ts` に足す（`pixels.test.ts` が幅・行数・パレットを確かめる）。直しを言われたら直して見せ直す。

### Task 2: ボス 2 体の絵の見本（利用者に見せて止まる）

- [ ] 溶岩の巨人（40 ドット前後、歩き 2 コマ）と不死鳥（同じくらい、羽ばたき 2 コマ）を描き、大イノシシ・大ワシと並べて見せる。不死鳥のよみがえりの光る版は `goldArt` のように色を変えて作る。
- [ ] 決まった絵を `art/bosses-volcano.ts` に入れ、`BOSS_ART` に足す。

### Task 3: 地面と飾り・溶岩の絵の見本（利用者に見せて止まる）

- [ ] 16 ドットのタイル（黒い岩の地面 4 コマ・溶岩の割れ目の土）と飾り（黒い岩・溶岩の割れ目・煙を上げる岩・骨・小さな火）、溶岩の池（丸く広がる 3 段）と割れ目の予告を描き、雪山の地面と並べて見せる。
- [ ] 決まった絵を `art/volcano.ts`（`VOLCANO_ART`、雪山の `SNOW_ART` と同じ形）に入れる。

### Task 4: 火山の表・敵・地面・曲・ステージの一覧

**Files:**

- Create: `stages/volcano.ts`
- Modify: `stages/forest.ts`（`Stage['art']` に `'volcano'`、`eruptions: { at: number; len: number }[]`、森・墓地・雪山は `[]`）、`stages/index.ts`、`enemies.ts`（7 種。動き・体力・経験値は森の対応する敵と同じ数で、名前と絵だけ変える）、`draw.ts`（`GROUNDS.volcano`）、`StageSelect.svelte`（`LOOK.volcano`）、`songs.ts`（`volcano`）、`Survivors.svelte` の曲の型、`achievements.ts`（「火山をクリア」）、`records.ts` のステージの id
- Test: `src/lib/games/animal-survivors/volcano.test.ts`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { canPlay, emptyRecords, parseRecords } from './records';
import { STAGES } from './stages';
import { FOREST } from './stages/forest';
import { SNOW } from './stages/snow';
import { VOLCANO } from './stages/volcano';
import { createWorld } from './world';

describe('火山の表', () => {
  it('雪山のあとに並び、雪山をクリアすると選べる', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow', 'volcano']);
    expect(canPlay(emptyRecords(), 'volcano')).toBe(false);
    expect(canPlay({ ...emptyRecords(), stages: ['forest', 'graveyard', 'snow'] }, 'volcano')).toBe(true);
  });

  it('時刻は森と同じで、森より 1.3 倍強く、コインは 2.5 倍', () => {
    expect(VOLCANO.length).toBe(FOREST.length);
    expect(VOLCANO.bosses.map((b) => b.at)).toEqual(SNOW.bosses.map((b) => b.at));
    expect(VOLCANO.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(VOLCANO.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.3);
    expect(VOLCANO.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.3);
    expect(VOLCANO.coin).toBe(2.5);
    expect(VOLCANO.eruptions.map((e) => e.at)).toEqual([95, 215, 335, 455]);
  });

  it('敵とボスはどれも敵の表にあり、森の 7 種と同じ動き方', () => {
    for (const w of VOLCANO.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of VOLCANO.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    const pairs: [string, string][] = [
      ['rat', 'lizard'],
      ['bat', 'fireball'],
      ['snake', 'lavasnake'],
      ['caterpillar', 'rockworm'],
      ['boar', 'fireboar'],
      ['spider', 'flamespider'],
      ['croc', 'rockcroc']
    ];
    for (const [from, to] of pairs) {
      expect(ENEMIES[to].hp).toBe(ENEMIES[from].hp);
      expect(ENEMIES[to].xp).toBe(ENEMIES[from].xp);
    }
  });

  it('古い記録でも読め、火山の世界を作れる', () => {
    const r = parseRecords(JSON.stringify({ stages: ['forest', 'snow', 'volcano', 'nope'], stage: 'volcano' }));
    expect(r.stages).toContain('volcano');
    expect(r.stage).toBe('volcano');
    expect(createWorld('dog', 1, { w: 274, h: 394 }, {}, 'volcano').stage).toBe(VOLCANO);
  });
});
```

- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。曲は `songs.ts` の雪山の曲の形で、低いベースと速い 8 ビートの 1 曲を書く（音は dev サーバーで鳴らして確かめる）。
- [ ] **Step 5: Commit** `Add Animal Survivors' volcano stage table, enemies and ground`

### Task 5: 噴火と溶岩の池

**Files:**

- Create: `eruption.ts`、`draw-volcano.ts`
- Modify: `world.ts`（`World.lava: Lava[]`、`World.eruption`、step の中で `stepEruption(w, dt)` と `updateLava(w, dt)`、`World.lavaKills`）、`draw.ts`（地面のあと・敵の前に `drawLava`）、`prompts.svelte.ts`（帯は今の `swarm` の知らせを使う）
- Test: `src/lib/games/animal-survivors/eruption.test.ts`

**Interfaces:**

- Produces:
  - `export interface Lava { x: number; y: number; r: number; warn: number; life: number; tick: number }`（`warn` が 0 より大きいあいだは割れ目の予告、0 を切ると池）
  - `addLava(w: World, x: number, y: number, r: number, warn = CRACK_WARN): void`（入れ物は `MAX_LAVA` まで。あふれたら残りのいちばん短い池を置き換える）
  - `stepEruption(w: World, dt: number): void`、`updateLava(w: World, dt: number): void`
  - 定数 `CRACK_WARN = 1.2`、`POOL_LIFE = 6`、`POOL_TICK = 0.5`、`POOL_DMG`（自分へ）、`MAX_LAVA = 24`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { addLava, CRACK_WARN, MAX_LAVA, POOL_LIFE, POOL_TICK, stepEruption, updateLava } from './eruption';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const quiet = () => {
  const w = createWorld('dog', 1, VIEW, {}, 'volcano');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};

describe('噴火', () => {
  it('3 秒前に帯を出し、噴火のあいだ自分のまわりに割れ目を置く', () => {
    const w = quiet();
    w.time = 91;
    for (let i = 0; i < 30 * 5; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.events.some((e) => e.type === 'swarm' && e.text === '噴火が来る！') || w.eruption.warned).toBe(true);
    for (let i = 0; i < 30 * 5; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.lava.length).toBeGreaterThan(2);
    for (const l of w.lava) expect(Math.hypot(l.x - w.player.x, l.y - w.player.y)).toBeLessThan(140);
  });

  it('割れ目は 1.2 秒で池になり、池は 6 秒で消える', () => {
    const w = quiet();
    addLava(w, 200, 200, 20);
    updateLava(w, CRACK_WARN - 0.01);
    expect(w.lava[0].warn).toBeGreaterThan(0);
    updateLava(w, 0.02);
    expect(w.lava[0].warn).toBeLessThanOrEqual(0);
    updateLava(w, POOL_LIFE + 0.1);
    expect(w.lava.filter((l) => l.life > 0)).toHaveLength(0);
  });

  it('池は中の自分と敵に当たり、ボス・ランタン・大ヘビの節には当てない', () => {
    const w = quiet();
    w.player.invuln = 0;
    addLava(w, 0, 0, 30, 0);
    w.enemies.push(makeEnemy(ENEMIES.lizard, 5, 0, 1));
    w.enemies.push(makeEnemy(ENEMIES.lavaGiant, -5, 0, 999));
    w.enemies.push(makeEnemy(ENEMIES.lantern, 0, 5, 1));
    w.enemies.push(makeEnemy(ENEMIES.snakeSeg, 0, -5, 999));
    const hp = w.player.hp;
    updateLava(w, POOL_TICK + 0.01);
    expect(w.player.hp).toBeLessThan(hp);
    expect(w.enemies[0].alive).toBe(false);
    expect(w.lavaKills).toBe(1);
    expect(w.enemies[1].hp).toBe(999);
    expect(w.enemies[2].alive).toBe(true);
    expect(w.enemies[3].hp).toBe(999);
  });

  it('時計の品で止まっているあいだは当たらず、割れ目も噴かない', () => {
    const w = quiet();
    w.freeze = 5;
    addLava(w, 0, 0, 30);
    for (let i = 0; i < 30 * 3; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.lava[0].warn).toBeGreaterThan(0);
  });

  it('池は上限までで、あふれたら残りの短い池を置き換える', () => {
    const w = quiet();
    for (let i = 0; i < MAX_LAVA + 5; i++) addLava(w, i * 10, 0, 10, 0);
    expect(w.lava.length).toBe(MAX_LAVA);
  });

  it('噴火の時計は step の中で進むので、step を呼ばなければ減らない', () => {
    const w = quiet();
    w.time = 95;
    stepEruption(w, 1 / 30);
    const left = w.eruption.left;
    expect(left).toBeGreaterThan(0);
    expect(w.eruption.left).toBe(left);
  });
});
```

- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。`stepEruption` は `stepStorm` と同じ形（3 秒前に `w.events.push({ type: 'swarm', text: '噴火が来る！' })`、時刻で `left = len`、吹いているあいだ 0.9〜1.2 秒ごとに `addLava(w, p.x + cos·d, p.y + sin·d, 18〜26)`、d は 30〜90 ドット）。`updateLava` は `warn` を減らし、池の `tick` が尽きるたびに中の自分（無敵でなければ `hurtPlayer(w, POOL_DMG)`）と中の敵（`boss`・`prop`・`part`・`metal` は除く）に `damageEnemy(w, i, POOL_HIT * w.stage.toughness(w.time), 0, 0)` し、倒れたら `w.lavaKills += 1`。止まっているあいだ（`w.freeze > 0`）は呼ばない。描き方は `draw-volcano.ts` の `drawLava`（割れ目は予告の明滅、池は広がって縮む 3 段）。
- [ ] **Step 5: 画面を撮る**（headless で 1:35 に時刻を飛ばし、噴火の割れ目と池を撮る）
- [ ] **Step 6: Commit** `Add Animal Survivors' volcano eruptions and lava pools`

### Task 6: 溶岩の巨人

**Files:**

- Create: `bosses-volcano.ts`
- Modify: `enemies.ts`（`lavaGiant`、`ai: 'giant'`、`BossId`）、`bosses.ts`（`moveBoss` の分岐）
- Test: `src/lib/games/animal-survivors/bosses-volcano.test.ts`

- [ ] **Step 1: テストを書く**。巨人を置いて 12 秒動かすと、地ならしの予告（`slam`）と岩（`rock` の飛び道具）が両方出て、地ならしが当たったあとに輪の中に池が、岩が落ちたところに小さな池が `w.lava` に増える。巨人は押し合いで押されない（今のボスと同じ）。
- [ ] **Step 2〜4**。地ならしは巨大ベアの `slam` の形を使い回し（予告 1.2 秒、半径 60）、当たった時点で `addLava(w, x, y, 50, 0)`。岩は女王グモの飛び道具の形で 1 個ずつ投げ、0.9 秒で落ちたところに予告の輪（`slam` の小さいもの）と `addLava(w, x, y, 20, 0)`。地ならしと岩を交互に 3.5 秒ごと（`rage` で割る）。
- [ ] **Step 5: Commit** `Add Animal Survivors' lava giant`

### Task 7: 不死鳥

**Files:**

- Modify: `bosses-volcano.ts`、`enemies.ts`（`phoenix`、`ai: 'phoenix'`）、`world.ts`（`damageEnemy` が倒す手前で `rebirth(w, e)` を見る、`Enemy.reborn?: boolean`）、`bosses-snow.ts` の `airborne()`（よみがえり中も当たらない）
- Test: `bosses-volcano.test.ts` に足す

- [ ] **Step 1: テストを書く**。不死鳥は 12 秒のあいだに空へ上がり（`airborne()` が true のあいだがある）、急降下の予告と火の羽根の予告を両方出す。体力を削り切ると倒れずに体力半分でよみがえり、`bossdown` も倒した数も増えず、帯（`swarm` の知らせ「よみがえった！」）が出る。よみがえっている 1.5 秒は `airborne()` で当たらない。もう一度削り切ると倒れ、`w.bossKills` に 1 回だけ入る。十字架とクリアの一掃でもよみがえらずに消え、`swept` は 1 回。
- [ ] **Step 2〜4**。急降下は大ワシの動きを使い回し（`bosses-forest.ts` の `eagle` の形）、羽根は自分のまわり 5 か所に予告の円（`meteor` の形の小さい予告）を 1 秒出して当てる。よみがえりは `damageEnemy` の `hp <= 0` のところで `if (e.def.ai === 'phoenix' && !e.reborn) { e.reborn = true; e.hp = e.def.hp / 2; e.state = REBORN; e.cd = 1.5; w.events.push(...); return; }`。
- [ ] **Step 5: 画面を撮る**（headless でボスの時刻に飛ばし、巨人の池と、不死鳥の急降下・よみがえりを撮る）
- [ ] **Step 6: Commit** `Add Animal Survivors' phoenix with one rebirth`

### Task 8: 実績

**Files:**

- Modify: `achievements.ts`（`volcanoClear`「火山をクリア」は Task 4 で入れたもの、`volcanoBosses`「溶岩の巨人と不死鳥を倒す」、`lava300`「溶岩の池で敵を 300 体倒す」は記録の `lavaKills` の合計で `progress` を持つ）、`records.ts`（`lavaKills`）、`world.ts` の `summary`（`lavaKills`）
- Test: `achievements` のテストに足す（実績の数を固めているテストは 46 に）

- [ ] TDD で足す。古い記録は `lavaKills` 0 で読む。Commit `Add Animal Survivors' volcano achievements`

### Task 9: ボットで合わせる

- [ ] `sim/boss.sim.ts` で `STAGE=volcano` を店半分・全部で測り、雪山（店半分 12/18 前後）より少し低いクリアの割合になるよう、`stages/volcano.ts` の強さの倍率と、ボス 2 体の体力、噴火の池のダメージを合わせる。spec に「## 8. 調整の結果」。Commit。

### Task 10: 仕上げ

- [ ] CLAUDE.md の Animal Survivors の段落に火山（噴火・2 体のボス・よみがえり）を足す。`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
