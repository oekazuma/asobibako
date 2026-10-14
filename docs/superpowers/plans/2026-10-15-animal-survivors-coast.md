# Animal Survivors 海岸 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 火山のあとに開く 5 つめのステージ「海岸」（敵 7 種の入れ替え、浅瀬で自分だけ遅くなる満ち潮、ボス 2 体、遺物 2 つ、曲、実績 3 つ）と、海岸のクリアで仲間になる 11 匹めの動物「ラッコ」（専用の武器「貝ころがし」と専用進化「真珠ころがし」）を足す。

**Architecture:** 海岸の表は火山と同じく森の表を写して敵を入れ替える（`stages/coast.ts`）。満ち潮は `tide.ts` が `World.shallows`（浅瀬と墨だまり）として持ち、火山の `eruption.ts` と同じく step の中で進める。浅瀬の中の遅さは `tide.ts` の `wadeFactor()` 1 つで決め、親の World の移動と子の端末の移動（`coop.ts` の `CoopGuest.move`）の両方が使う。ボスは今の動き方の型（`ai`）を使い回し、技を足す分を `bosses-coast.ts` に置く。貝ころがしは新しい武器の種類 `bounce` で、跳ねる回数は武器の `pierce` を使う。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、scratchpad のボットとドット絵の道具、headless Chrome（playwright-core）

**Spec:** `docs/superpowers/specs/2026-10-15-animal-survivors-coast-design.md`

## Global Constraints

- 新しい絵は使う前に見本を見せる。敵・ボス・地面とラッコの 3 回に分け、決まるまでその絵を使うタスクに進まない。見た目の水準は今の敵と動物にそろえる。ラッコは黒い丸目とほっぺのかわいい顔。
- 海岸の時刻は森の表を写す（10 分）。硬さと攻撃は森の 1.6 倍（Task 10 でボットに合わせて直す）、同時に出る数の上限は森の 1.2 倍、コイン 3 倍。開くのは火山のクリア（`after: 'volcano'`）。
- 満ち潮は 95・215・335・455 秒に 20 秒ずつ。3 秒前に帯「潮が満ちてくる！」。浅瀬は 8 秒残り、同時に 24 個まで。中の自分は 5 割の速さ、敵は遅くならない。ダメージは無い。ボス・ランタン・重い宝箱は影響を受けない。
- 満ち潮の時計は step の中で進め、3 択・一時停止・時計の品で止まる。
- ラッコの id は `otter`、名前は ラッコ・貝わりラッコ・おやかたラッコ、段は最強（`tier: 4`）、とくいは運 +0.1。
- 貝ころがしは Lv1 で 2 回、Lv5 で 5 回跳ねる。跳ねる先は 60 ドット以内のいちばん近い別の敵で、同じ敵には 1 回の投げで 1 回だけ当たる。
- 協力プレイの知らせの形が変わるので `COOP_VERSION` を 5 から 6 に上げる。
- コンポーネントは 200 行未満。コメントは非自明な WHY だけを日本語で（変更履歴・チケット番号は書かない）。テスト名は日本語の文。`pnpm verify` が通ること。
- コミットは英語の命令形 1 文。Co-Authored-By などの署名の行は付けない。push はしない。

## Review Focus

- 浅瀬が重なったところでも遅さは 5 割で、二重に遅くならない。渦巻き貝を持つと 7.5 割になる（Task 5 のテスト）。
- 子の端末でも、浅瀬の中の自分の動物が親と同じ遅さになる（子の動きは子の端末で計算する）（Task 5 のテスト）。
- 時計の品で止まっているあいだ、満ち潮の時計も浅瀬の残り時間も進まない（Task 5 のテスト）。
- 貝ころがしが、敵が 1 体しかいないとき・跳ねる先が 60 ドットより遠いとき・跳ねる先が倒れたばかりのときに、止まらず・同じ敵に 2 回当たらず・消える（Task 8 のテスト）。
- 前に火山をクリアした古い記録で海岸を選べ、壊れた記録でも海岸の世界を作れる（Task 4 のテスト）。

---

### Task 1: 敵 7 種の絵の見本（利用者に見せて止まる）

- [ ] scratchpad の道具（`art/*.ts` の 1 文字 1 色の格子を node で直接読み、zlib で PNG にする。`art/enemies.ts` の森の 7 種を読んで形と大きさを合わせる）で、カニ・カモメ・ウミヘビ・ヤドカリ・セイウチ・クラゲ・陸ザメを 2 コマずつ描き、森の 7 種と火山の 7 種と並べた PNG を `SendUserFile` で見せる。
- [ ] 決まった絵を `art/enemies.ts` に足す（`pixels.test.ts` が幅・行数・パレットを確かめる）。直しを言われたら直して見せ直す。

### Task 2: ボス 2 体の絵の見本（利用者に見せて止まる）

- [ ] 大ダコ（40 ドット前後、うねる 2 コマ）と巨大ガニ（同じくらい、横歩き 2 コマ）を描き、溶岩の巨人・不死鳥と並べて見せる。
- [ ] 決まった絵を `art/bosses-coast.ts` に入れ、`BOSS_ART` に足す。

### Task 3: 地面と飾り・浅瀬・ラッコ・アイコンの絵の見本（利用者に見せて止まる）

- [ ] 16 ドットのタイル（砂浜 4 コマ・波打ちぎわ）と飾り（貝・ヒトデ・海藻・小石）、障害物 2 種（岩場・打ち上げられた小舟。`art/obstacles.ts` の形）、浅瀬（にじむ 3 段）と墨だまり、ラッコの 3 段階（16・20・24 ドットの歩き 4 コマ・攻撃・やられ。`art/animals.ts` と `art/grown.ts` の形）、貝ころがし・真珠ころがしの印（12 ドット、真珠ころがしは金色に赤い王冠）、遺物 2 つ（渦巻き貝・白い真珠）の印を描く。火山の地面・竜の子と火の鳥のひなの 3 段階と並べて見せる。
- [ ] 決まった絵を `art/coast.ts`（`COAST_ART`、火山の `VOLCANO_ART` と同じ形）、`art/obstacles.ts`、`art/animals.ts`・`art/grown.ts`（`otter`）、`art/items.ts`（`weapon-shellRoll`・`weapon-shellRollSp`・遺物）に入れる。

### Task 4: 海岸の表・敵・地面・障害物・曲・ステージの一覧

**Files:**

- Create: `src/lib/games/animal-survivors/stages/coast.ts`
- Modify: `stages/forest.ts`（`Stage['art']` に `'coast'`、`Stage` に `tides: { at: number; len: number }[]`、森・墓地・雪山・火山は `[]`）、`stages/index.ts`（`STAGES` の最後に `COAST`）、`enemies.ts`（7 種。動き・体力・経験値は森の対応する敵と同じ数で、名前と絵だけ変える）、`obstacles.ts`（`coast` の 2 種の形 `SHAPES`）、`draw.ts`（`GROUNDS.coast`）、`StageSelect.svelte`（`LOOK.coast`）、`songs.ts`（`coast`、明るく軽い 1 曲。火山の曲の形）、`Survivors.svelte` の曲の型、`achievements.ts`（`coastClear`「海岸をクリア」、動物はまだ付けない）、`records.ts` のステージの id
- Test: `src/lib/games/animal-survivors/coast.test.ts`

**Interfaces:**

- Produces: `COAST: Stage`（`stages/coast.ts`）、`Stage.tides`、敵の id `crab`・`gull`・`seasnake`・`hermit`・`walrus`・`jelly`・`landshark`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { canPlay, emptyRecords, parseRecords } from './records';
import { STAGES } from './stages';
import { COAST } from './stages/coast';
import { FOREST } from './stages/forest';
import { VOLCANO } from './stages/volcano';
import { createWorld } from './world';

describe('海岸の表', () => {
  it('火山のあとに並び、火山をクリアすると選べる', () => {
    expect(STAGES.map((s) => s.id)).toEqual(['forest', 'graveyard', 'snow', 'volcano', 'coast']);
    expect(canPlay(emptyRecords(), 'coast')).toBe(false);
    expect(canPlay({ ...emptyRecords(), stages: ['forest', 'graveyard', 'snow', 'volcano'] }, 'coast')).toBe(true);
  });

  it('時刻は森と同じで、森より 1.6 倍強く、コインは 3 倍、満ち潮は 4 回', () => {
    expect(COAST.length).toBe(FOREST.length);
    expect(COAST.bosses.map((b) => b.at)).toEqual(VOLCANO.bosses.map((b) => b.at));
    expect(COAST.events.map((e) => e.at)).toEqual(FOREST.events.map((e) => e.at));
    expect(COAST.toughness(300)).toBeCloseTo(FOREST.toughness(300) * 1.6);
    expect(COAST.fury(300)).toBeCloseTo(FOREST.fury(300) * 1.6);
    expect(COAST.coin).toBe(3);
    expect(COAST.tides.map((t) => [t.at, t.len])).toEqual([
      [95, 20],
      [215, 20],
      [335, 20],
      [455, 20]
    ]);
    expect(VOLCANO.tides).toEqual([]);
  });

  it('敵とボスはどれも敵の表にあり、森の 7 種と同じ動き方', () => {
    for (const w of COAST.waves) expect(ENEMIES[w.enemy]).toBeDefined();
    for (const b of COAST.bosses) expect(ENEMIES[b.id].boss).toBe(b.id);
    const pairs: [string, string][] = [
      ['rat', 'crab'],
      ['bat', 'gull'],
      ['snake', 'seasnake'],
      ['caterpillar', 'hermit'],
      ['boar', 'walrus'],
      ['spider', 'jelly'],
      ['croc', 'landshark']
    ];
    for (const [from, to] of pairs) {
      expect(ENEMIES[to].hp).toBe(ENEMIES[from].hp);
      expect(ENEMIES[to].xp).toBe(ENEMIES[from].xp);
    }
  });

  it('古い記録でも読め、海岸の世界を作れる', () => {
    const r = parseRecords(JSON.stringify({ stages: ['forest', 'volcano', 'coast', 'nope'], stage: 'coast' }));
    expect(r.stages).toContain('coast');
    expect(r.stage).toBe('coast');
    expect(createWorld('dog', 1, { w: 274, h: 394 }, {}, 'coast').stage).toBe(COAST);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/coast.test.ts` → `stages/coast` が無いので FAIL。
- [ ] **Step 3: 実装する**。`stages/coast.ts` は `stages/volcano.ts` と同じ形で、`SWAP` を上の 7 組に、`HARDER = 1.6`、`coin: 3`、`song: 'coast'`、`unlock: '火山をクリアすると行ける'`、`after: 'volcano'`、`eruptions: []`、`tides` を上の 4 つ、`bosses: bossRun('crabKing', 'octopus', '海岸の主')`（ボスの id は Task 6・7 で敵の表に入れる。このタスクでは `enemies.ts` に仮の行として 2 体を、巨大ベアと女王グモの数で入れておく）。障害物は `obstacles.ts` の面ごとの表に岩場と小舟を足す。
- [ ] **Step 4: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/` → PASS。ステージや実績の数を固めているテスト（`achievements` の数、`StageSelect` の並び）は 5 面と実績 1 つ増えに直す。
- [ ] **Step 5: Commit** `Add Animal Survivors' coast stage table, enemies and ground`

### Task 5: 満ち潮と浅瀬

**Files:**

- Create: `src/lib/games/animal-survivors/tide.ts`、`src/lib/games/animal-survivors/draw-coast.ts`
- Modify: `world.ts`（`World.shallows: Shallow[]`、`World.tide: Tide`、step の中で `stepTide(w, dt)` と `updateShallows(w, dt)`、自分の速さの式（今の `p.slow > 0 ? SLOW : 1` の隣）に `wadeFactor(w, p.x, p.y)` を掛ける、`World.tideKills`）、`draw.ts`（地面のあと・敵の前に `drawShallows`）、`snap.ts`（`shallows` を火山の `lava` と同じく様子に載せる、`COOP_VERSION` を 6）、`coop.ts`（`CoopGuest.move` の速さの式にも `wadeFactor(v, p.x, p.y)` を掛ける）、`relics.ts`（`RelicId` に `conch`、`RELICS` に渦巻き貝 `r('conch', '渦巻き貝', '浅瀬と墨だまりで遅くなる割合が半分になる', 'coast', 1.3, 700)`）
- Test: `src/lib/games/animal-survivors/tide.test.ts`

**Interfaces:**

- Produces:
  - `export interface Shallow { x: number; y: number; r: number; grow: number; life: number; ink: boolean }`（`grow` が 0 より大きいあいだは水がにじむ予告で、まだ遅くしない）
  - `addShallow(w: World, x: number, y: number, r: number, opts?: { life?: number; grow?: number; ink?: boolean }): void`（入れ物は `MAX_SHALLOWS` まで。あふれたら残りのいちばん短いものを置き換える）
  - `stepTide(w: World, dt: number): void`、`updateShallows(w: World, dt: number): void`
  - `wadeFactor(w: World, x: number, y: number): number`（浅瀬か墨だまりの中なら `WADE`、渦巻き貝を持てば `1 - (1 - WADE) / 2`、外なら 1）
  - 定数 `TIDE_WARN = 3`、`SHALLOW_GROW = 0.8`、`SHALLOW_LIFE = 8`、`WADE = 0.5`、`MAX_SHALLOWS = 24`
  - `export interface Tide { next: number; left: number; cd: number; warned: boolean }`、`lowTide(): Tide`（`eruption.ts` の `quietEarth` と同じ形）

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { CoopGuest } from './coop';
import {
  addShallow,
  MAX_SHALLOWS,
  SHALLOW_GROW,
  SHALLOW_LIFE,
  stepTide,
  updateShallows,
  WADE,
  wadeFactor
} from './tide';
import { createWorld, step } from './world';

const VIEW = { w: 274, h: 394 };
const quiet = () => {
  const w = createWorld('dog', 1, VIEW, {}, 'coast');
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.weapons = [];
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};

describe('満ち潮', () => {
  it('3 秒前に帯を出し、満ち潮のあいだ自分のまわりに浅瀬を足す', () => {
    const w = quiet();
    w.time = 91;
    let warned = false;
    for (let i = 0; i < 30 * 5; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      warned ||= w.events.some((e) => e.type === 'swarm' && e.text === '潮が満ちてくる！');
    }
    expect(warned).toBe(true);
    for (let i = 0; i < 30 * 5; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.shallows.length).toBeGreaterThan(2);
    for (const s of w.shallows) expect(Math.hypot(s.x - w.player.x, s.y - w.player.y)).toBeLessThan(140);
  });

  it('浅瀬はにじむあいだは遅くせず、そのあと 8 秒で消える', () => {
    const w = quiet();
    addShallow(w, 0, 0, 30);
    expect(wadeFactor(w, 0, 0)).toBe(1);
    updateShallows(w, SHALLOW_GROW + 0.01);
    expect(wadeFactor(w, 0, 0)).toBe(WADE);
    updateShallows(w, SHALLOW_LIFE + 0.1);
    expect(wadeFactor(w, 0, 0)).toBe(1);
  });

  it('重なった浅瀬でも遅さは 5 割のままで、渦巻き貝を持つと 7.5 割', () => {
    const w = quiet();
    addShallow(w, 0, 0, 30, { grow: 0 });
    addShallow(w, 5, 0, 30, { grow: 0 });
    expect(wadeFactor(w, 0, 0)).toBe(WADE);
    w.relics.push('conch');
    expect(wadeFactor(w, 0, 0)).toBe(0.75);
  });

  it('浅瀬の中の自分は遅くなり、敵は遅くならない', () => {
    const w = quiet();
    addShallow(w, 0, 0, 200, { grow: 0 });
    const x = w.player.x;
    step(w, { x: 1, y: 0 }, 1 / 30);
    const inWater = w.player.x - x;
    w.shallows.length = 0;
    const x2 = w.player.x;
    step(w, { x: 1, y: 0 }, 1 / 30);
    expect(inWater).toBeCloseTo((w.player.x - x2) * WADE, 3);
  });

  it('時計の品で止まっているあいだは、満ち潮の時計も浅瀬の残りも進まない', () => {
    const w = quiet();
    w.freeze = 5;
    addShallow(w, 0, 0, 30);
    for (let i = 0; i < 30 * 3; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.shallows[0].grow).toBeGreaterThan(0);
  });

  it('浅瀬は上限までで、あふれたら残りの短いものを置き換える', () => {
    const w = quiet();
    for (let i = 0; i < MAX_SHALLOWS + 5; i++) addShallow(w, i * 10, 0, 10, { grow: 0 });
    expect(w.shallows.length).toBe(MAX_SHALLOWS);
  });

  it('満ち潮の時計は step の中で進むので、step を呼ばなければ減らない', () => {
    const w = quiet();
    w.time = 95;
    stepTide(w, 1 / 30);
    const left = w.tide.left;
    expect(left).toBeGreaterThan(0);
    expect(w.tide.left).toBe(left);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/tide.test.ts` → `tide` が無いので FAIL。
- [ ] **Step 3: 実装する**。`stepTide` は `eruption.ts` の `stepEruption` と同じ形（3 秒前に `w.events.push({ type: 'swarm', text: '潮が満ちてくる！' })`、時刻で `left = len`、満ちているあいだ 0.9〜1.2 秒ごとに `addShallow(w, p.x + cos·d, p.y + sin·d, 22〜34)`、d は 30〜90 ドット。乱数は `w.rand()`）。`updateShallows` は `grow` を減らし、`grow <= 0` のものの `life` を減らす。止まっているあいだ（`w.freeze > 0`）は両方とも呼ばない。`wadeFactor` は `grow <= 0 && life > 0` で中にある浅瀬が 1 つでもあれば遅くする（数で重ねない）。自分の移動の式の 1 か所と、子の端末の `CoopGuest.move` の 1 か所に掛ける（遅さを親から送らず、子は届いた `shallows` で自分で計算する）。描き方は `draw-coast.ts` の `drawShallows`（火山の `draw-volcano.ts` の `drawLava` と同じく大きさごとにドット絵を作って控え、墨だまりは黒っぽい色）。`World.tideKills` は、満ち潮のあいだ（`w.tide.left > 0`）に倒した敵の数を `damageEnemy` の倒したところで足す。
- [ ] **Step 4: 協力プレイのテストを足す**。`coop.test.ts` の既存の `started()` を使い、親の World に `addShallow(w, 子の位置, 200, { grow: 0 })` してから様子を 1 回送る（`h.after(SNAP_EVERY)`）。子の `g.move({ x: 1, y: 0 }, 1 / 30)` で進む量が、浅瀬が無いときの `WADE` 倍になる。`COOP_VERSION` が 6 で、版 5 の子を断ることを今の版ちがいのテストの形で確かめる。
- [ ] **Step 5: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/` → PASS。
- [ ] **Step 6: 画面を撮る**（headless の Chrome で 1:35 に時刻を飛ばし、浅瀬がにじんで広がるところと、浅瀬の中を歩くところを撮る。`pnpm dev --port 5197 --strictPort`、終わったら止める）
- [ ] **Step 7: Commit** `Add Animal Survivors' coast tides and shallows`

### Task 6: 巨大ガニ

**Files:**

- Create: `src/lib/games/animal-survivors/bosses-coast.ts`
- Modify: `enemies.ts`（`crabKing` を本物の数と `ai: 'crab'` に。`ai` の型に `'crab'`、`BossId`）、`bosses.ts`（`moveBoss` の分岐）
- Test: `src/lib/games/animal-survivors/bosses-coast.test.ts`

- [ ] **Step 1: テストを書く**。巨大ガニを自分の右 120 ドットに置き、12 秒動かす。予告の矢印（巨大ベアの突進の `Hazard`）が出て、突進の向きは必ず左右（`Math.abs(vy)` がほぼ 0）。はさみの地ならしの予告の輪が 2 つ同時に出て、予告のあと輪の中の自分にだけ当たる（輪の外では HP が減らない）。巨大ガニは押し合いで押されない（今のボスと同じ）。`rage` の行では攻撃の間が短くなる（同じ秒数で攻撃の回数が増える）。
- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。突進は巨大ベアの突進を使い回し、向きを自分のいる側の左右に固定する。はさみの地ならしは巨大ベアの `slam` の形を使い回し、カニの左右 40 ドットに半径 36 の予告を 1.2 秒ずつ同時に置く。突進とはさみを交互に 3.5 秒ごと（`rage` で割る）。
- [ ] **Step 5: Commit** `Add Animal Survivors' giant crab`

### Task 7: 大ダコ

**Files:**

- Modify: `bosses-coast.ts`、`enemies.ts`（`octopus` を本物の数と `ai: 'octopus'` に、手下 `minion` は小ダコ `babyOctopus`、飛び道具の絵 `shot` は墨の弾）、`bosses.ts`（`moveBoss` の分岐）
- Test: `bosses-coast.test.ts` に足す

- [ ] **Step 1: テストを書く**。大ダコを置いて 12 秒動かすと、墨の弾（女王グモの飛び道具の形）と小ダコの手下と、墨だまりの予告が出る。予告のあと `w.shallows` に `ink: true` のものが増え、その中では `wadeFactor` が `WADE` になる。墨だまりは 5 秒で消える。大ダコが倒れても、出ていた墨だまりは残りの時間で消える（持ち主を見ない）。
- [ ] **Step 2〜4**（落ちる → 実装 → 通る）。動きは女王グモの `queen` の分岐を呼び、それと交互に、自分の位置に半径 40 の予告の円（流れ星の予告の形）を 1 秒出してから `addShallow(w, x, y, 40, { grow: 0, life: 5, ink: true })` を置く。
- [ ] **Step 5: 画面を撮る**（headless でボスの時刻に飛ばし、巨大ガニの横の突進とはさみ、大ダコの墨だまりを撮る）
- [ ] **Step 6: Commit** `Add Animal Survivors' giant octopus with ink pools`

### Task 8: ラッコと貝ころがし・真珠ころがし

**Files:**

- Modify: `animals.ts`（`AnimalId` に `otter`、行を足す。`tier: 4`、`forms: ['ラッコ', '貝わりラッコ', 'おやかたラッコ']`、`weapon: 'shellRoll'`、`special: 'shellRollSp'`、`bonus: { luck: 0.1 }`。能力の数は Task 10 で合わせる仮の値で、竜の子と同じにしておく）、`weapons.ts`（`WeaponKind` に `'bounce'`、`shellRoll` と `shellRollSp`、`EXCLUSIVE` に `shellRoll`）、`arms.ts`（`bounce` の動き方）、`draw-arms.ts`（貝の絵）、`achievements.ts`（`coastClear` に `animal: 'otter'`）、`relics.ts`（`RelicId` に `pearl`、`RELICS` に白い真珠 `r('pearl', '白い真珠', '経験値の玉を引き寄せる範囲が 2 割広がる', 'coast', -2.6, 1500)`）、`drops.ts`（玉を引き寄せる範囲 `32 * w.stats.magnet * (1 + w.fx.gemReach)` に、白い真珠を持てば 1.2 を掛ける）
- Test: `src/lib/games/animal-survivors/otter.test.ts`

**Interfaces:**

- Consumes: `WeaponStats.pierce`（跳ねる回数として使う）、`hasRelic(w, id)`
- Produces: 武器の id `shellRoll`・`shellRollSp`、`WeaponKind` の `'bounce'`、`BOUNCE_REACH = 60`（`arms.ts`）

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { animal } from './animals';
import { BOUNCE_REACH } from './arms';
import { choices } from './choices';
import { ENEMIES } from './enemies';
import { emptyRecords, parseRecords } from './records';
import { WEAPONS } from './weapons';
import { createWorld, makeEnemy, step } from './world';

const VIEW = { w: 274, h: 394 };
const otterWorld = () => {
  const w = createWorld('otter', 1, VIEW);
  w.stage = { ...w.stage, waves: [], bosses: [], events: [], chiefs: [] };
  w.propCd = 9999;
  w.metalAt = -1;
  return w;
};

describe('ラッコ', () => {
  it('最強の段で、貝ころがしを持ち、海岸のクリアで仲間になる', () => {
    const a = animal('otter');
    expect(a.tier).toBe(4);
    expect(a.forms).toEqual(['ラッコ', '貝わりラッコ', 'おやかたラッコ']);
    expect(a.weapon).toBe('shellRoll');
    expect(a.bonus).toEqual({ luck: 0.1 });
    expect(ACHIEVEMENTS.find((d) => d.id === 'coastClear')?.animal).toBe('otter');
    const r = parseRecords(JSON.stringify({ ...emptyRecords(), achieved: ['coastClear'] }));
    expect(r.unlocked).toContain('otter');
  });

  it('貝ころがしは Lv1 で 2 回、Lv5 で 5 回跳ねる', () => {
    const def = WEAPONS.shellRoll;
    expect(def.kind).toBe('bounce');
    expect(def.base.pierce).toBe(2);
    expect(def.base.pierce + def.ups.reduce((n, u) => n + (u.pierce ?? 0), 0)).toBe(5);
  });

  it('跳ねる先は近くの別の敵で、同じ敵には 1 回の投げで 1 回だけ当たる', () => {
    const w = otterWorld();
    const near = [20, 40, 60].map((x) => makeEnemy(ENEMIES.crab, w.player.x + x, w.player.y, 1e6));
    w.enemies.push(...near);
    for (let i = 0; i < 30 * 2; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    const hitCounts = near.map((e) => w.dealt.shellRoll && e.hp < 1e6);
    expect(hitCounts.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });

  it('敵が 1 体だけ、または 60 ドットより遠いときは、跳ねずに消える', () => {
    const w = otterWorld();
    w.enemies.push(makeEnemy(ENEMIES.crab, w.player.x + 20, w.player.y, 1e6));
    w.enemies.push(makeEnemy(ENEMIES.crab, w.player.x + 20 + BOUNCE_REACH + 30, w.player.y, 1e6));
    for (let i = 0; i < 30 * 2; i++) step(w, { x: 0, y: 0 }, 1 / 30);
    expect(w.enemies[1].hp).toBe(1e6);
    expect(w.shots.filter((s) => s.alive).length).toBeLessThan(10);
  });

  it('貝ころがしは、ほかの動物の 3 択に出ない', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 200; i++) {
      expect(choices(w).some((c) => c.kind === 'weapon' && c.id === 'shellRoll')).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 落ちることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/otter.test.ts` → `otter` が無いので FAIL。テストの `w.dealt`・`w.shots`・`choices()` の戻りの形は今のコードに合わせて直してよい（確かめる中身は変えない）。
- [ ] **Step 3: 実装する**。`bounce` は `arms.ts` の `shot` の撃ち方でいちばん近い敵へ投げ、当たったら当てた敵の番号を弾に覚え（`Shot.hitIds`）、`BOUNCE_REACH` 以内で覚えていないいちばん近い生きた敵へ向きを変え、跳ねた回数が `pierce` に届いたら消える。跳ねる先がいなければ消える。`shellRollSp` は `sp(...)` の形で跳ねる回数と強さを上げ、跳ねるたびに小さな当たり（`zones.ts` の小さな区域を 1 回だけ）を置く。図鑑の姿・「全部の動物がそろう」の実績など、動物の数を固めたテストは 11 匹に直す。
- [ ] **Step 4: 専用進化のテストを足す**。3 段階めに育ったラッコで `shellRoll` を Lv5 にすると `shellRollSp` に入れ替わる（`trySpecial`）。白い真珠を持つと、玉を引き寄せる範囲が 1.2 倍になる（`drops.ts` の範囲で確かめる）。
- [ ] **Step 5: 通ることを確かめる** Run: `pnpm exec vitest run src/lib/games/animal-survivors/` → PASS。
- [ ] **Step 6: Commit** `Add Animal Survivors' otter with the bouncing shell roll`

### Task 9: 実績とキャラ選択の 3 段

**Files:**

- Modify: `achievements.ts`（`coastBosses`「大ダコと巨大ガニを倒す」、`tide500`「満ち潮のあいだに敵を 500 体倒す」は記録の `tideKills` の合計で `progress` を持つ）、`records.ts`（`tideKills`、古い記録は 0）、`world.ts` の `summary`（`tideKills`）、`trophy-groups.ts`（「ステージ」と「ボス」の見出しに足す）、`CharSelect.svelte`（11 匹で 5 列 × 3 段。今の `grid-template-columns: repeat(5, 1fr)` のまま 3 段めが左から詰まることを確かめ、要るなら行の高さを詰める）
- Test: `achievements` のテストに足す（実績の数を固めているテストは 3 つ増やす）、`charselect.svelte.test.ts` に「11 匹のタイルが出る」を足す

- [ ] TDD で足す（落ちる → 実装 → 通る）。古い記録は `tideKills` 0 で読む。
- [ ] headless の Chrome（iPad Air の縦の大きさ 820 × 1180）でキャラ選択を撮り、3 段のタイル・詳しい札・「この子で出発」がスクロールなしで収まることを確かめる。収まらなければタイルを小さくする。
- [ ] Commit `Add Animal Survivors' coast achievements and a third row of animals`

### Task 10: ボットで合わせる

- [ ] scratchpad のボット（`sim/boss.sim.ts`。浅瀬を溶岩の池と同じく避けるように足す）で `STAGE=coast` を店半分・全部、犬・キツネ・パンダを 6 回ずつ遊ばせ、火山（店半分 12/18 前後）より少し低いクリアの割合になるよう、`stages/coast.ts` の `HARDER`、ボス 2 体の体力、`WADE` を合わせる。
- [ ] `ANIMALS=otter,drake,chick` で店なし・半分の森と海岸を比べ、ラッコが竜の子・火の鳥のひなと同じくらいになるよう、`animals.ts` の数と `shellRoll` の数値を合わせる。
- [ ] spec に「## 11. 調整の結果」（表と、なぜその値にしたか）を足す。Commit `Tune Animal Survivors' coast and otter with bot runs`

### Task 11: 仕上げ

- [ ] `src/lib/games/animal-survivors/CLAUDE.md` の最初の段落の面の一覧に海岸を足し、`docs/stages.md`（海岸と満ち潮）・`docs/bosses.md`（巨大ガニと大ダコ）・`docs/animals.md`（11 匹めのラッコと貝ころがし）・`docs/coop.md`（浅瀬を様子に載せる、`COOP_VERSION` 6）に今の仕様として書き足す（経緯は書かない）。
- [ ] `pnpm verify` → exit 0。Commit `Describe Animal Survivors' coast and otter`
- [ ] 別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ merge して push してよいかを利用者に聞く。
