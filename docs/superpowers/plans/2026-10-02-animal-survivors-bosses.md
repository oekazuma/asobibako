# Animal Survivors ボス Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animal Survivors に 5 分の巨大ベアと 10 分の女王グモ、WARNING の予告、倒したときの宝箱を足す。

**Architecture:** ボスは今の `Enemy` に攻撃の状態を足したもので、動き方と攻撃は `bosses.ts`、予告と飛び道具は `World.hazards`、宝箱の中身は `chest.ts` が DOM を使わずに持つ。画面は `draw-boss.ts`（予告・飛び道具・ボスの HP の棒）と、HTML の `BossWarning.svelte`・`ChestOpen.svelte` を `Play.svelte` に重ねる。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest（unit project）、playwright-core（scratchpad の確認用）

**Spec:** `docs/superpowers/specs/2026-10-02-animal-survivors-bosses-design.md`（もとの `docs/superpowers/specs/2026-10-02-animal-survivors-design.md` も読む）

## 止まるところ

| どこで          | 何を見せるか                       | 次へ進む条件                   |
| --------------- | ---------------------------------- | ------------------------------ |
| Task 1 の終わり | ボス・子グモ・糸の玉の見本のシート | 利用者が「この絵でよい」と言う |
| Task 6 の終わり | ボスの入った版                     | main へ push してよいかを聞く  |

## Global Constraints

- 置き場所は `src/lib/games/animal-survivors/`。ルールのファイル（`bosses.ts`・`chest.ts`・`world.ts` など）は DOM を使わない。
- ボスは 2 体。`stages/forest.ts` の `bosses: [{ at: 300, id: 'bear' }, { at: 600, id: 'spiderQueen' }]`。WARNING は出る 3 秒前。
- 巨大ベアは HP 2400・半径 15・触れて 20・速さ 28・4 秒ごとに突進（予告 0.7 秒、矢印の長さ 120、210 px/秒で 0.9 秒、走っているあいだに触れて 30）と地ならし（予告 1 秒、輪の半径 56、28 のダメージ）を交互に。
- 女王グモは HP 6000・半径 16・触れて 25・自分から 110 px を保って 38 px/秒で回り込む。2.5 秒ごとに糸の玉 5 発（真ん中は自分へ、15° 間隔、90 px/秒、3 秒、半径 4、8 のダメージと 2 秒間の速さ 0.6 倍）。6 秒ごとに子グモ 6 匹（HP 8・速さ 62・攻撃 6・半径 4・経験値 1・追う）。
- ボスの HP には `toughness` を掛けない。ボスは吹き飛ばされず（`heavy: 1`）、押し合いで押されない。
- 倒したら白い光 0.25 秒・経験値 25 の赤い玉 10 個（半径 24 にばらまく）・宝箱 1 つ。宝箱は吸い寄せられない。
- 宝箱は 1（6 割）・3（3 割）・5（1 割）つを、持っている Lv5 未満のものから 1 Lv ずつ上げる。無くなったら肉（HP 30%）と袋（経験値 +25）。宝箱と 3 択が重なったら宝箱が先。
- 画面は揺らさない。コンポーネントは 200 行未満、`<main>` は書かない、絵文字は使わない。
- 各 Task の終わりに `pnpm test:run`・`pnpm check`・`pnpm lint`・`pnpm vitals --diff` を通して commit する。commit の末尾は `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

- ボスが出るとき敵が上限（400 体）で埋まっている。ボスは必ず出ること（遠くのふつうの敵の枠を使う）。Task 2 のテスト。
- 宝箱を拾った同じフレームで Lv も上がった。宝箱を開けてから 3 択が出ること。Task 4 のテスト。
- ボスが 2 体同時にいる。HP の棒が 2 本、攻撃もそれぞれ動くこと。Task 3 のテスト（2 体の攻撃）と Task 5 の撮影。
- 突進の途中でボスが倒れた。予告の矢印や輪が残らないこと（持ち主のいない予告は消す）。Task 3 のテスト。
- 15:00 のクリアでボスが残っている。ボスも倒れ、宝箱は落とさないこと。Task 4 のテスト。

---

## ファイルの地図

| ファイル                   | 変えること                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `art/bosses.ts`（新）      | 巨大ベア（40×36、3 コマ）・女王グモ（44×36、2 コマ）・子グモ（10×8、2 コマ）                                 |
| `art/items.ts`             | 糸の玉 `web`（6×6）                                                                                          |
| `enemies.ts`               | `Move` に `'boss'`、`EnemyDef` に `boss?`、子グモと 2 体のボスの表                                           |
| `stages/forest.ts`         | `Stage.bosses`                                                                                               |
| `bosses.ts`（新）          | `Hazard`、`moveBoss()`、`updateHazards()`、`spawnBosses()`                                                   |
| `world.ts`                 | `Enemy.cd`・`turn`、`Player.slow`、`World.hazards`・`chests`・`bossNext`、出来事、押し合い・接触・止める条件 |
| `drops.ts`                 | ボスを倒したときの玉と宝箱、宝箱は吸い寄せない                                                               |
| `chest.ts`（新）           | `openChest()`                                                                                                |
| `draw-boss.ts`（新）       | 予告・飛び道具・ボスの HP の棒                                                                               |
| `draw.ts`                  | ボスの絵とコマ、`draw-boss.ts` を呼ぶ、白い光                                                                |
| `effects.ts`・`sounds.ts`  | 警告・撃破・宝箱の音と、撃破の粒と白い光                                                                     |
| `BossWarning.svelte`（新） | WARNING の帯                                                                                                 |
| `ChestOpen.svelte`（新）   | 宝箱を開ける画面                                                                                             |
| `Play.svelte`              | 帯と宝箱を重ね、宝箱を先に開ける                                                                             |

テストは `bosses.test.ts`（新）と既存の `pixels.test.ts`。

---

### Task 1: ボスの絵と見本シート

**Files:**

- Create: `art/bosses.ts`
- Modify: `art/items.ts`（`web` を足す）、`pixels.test.ts`（ボスの絵も検査に入れる）
- Create (scratchpad、commit しない): `<scratchpad>/png.mjs`・`sketch.mjs`・`gen-bosses.mjs`・`boss-sheet.mjs`

**Interfaces:**

- Produces: `BOSS_ART: Record<'bear' | 'spiderQueen' | 'spiderling', Art>`（bear は `frames[0..1]` が歩き、`frames[2]` が地ならし）、`ITEM_ART.web`

**絵の決まり**

| 絵       | 大きさ | コマ               | 見分けるところ                                                                     |
| -------- | ------ | ------------------ | ---------------------------------------------------------------------------------- |
| 巨大ベア | 40×36  | 歩き 2・地ならし 1 | こげ茶の大きな体、丸い耳、クリームの鼻先、怒った目、白い爪。地ならしは両手を上げる |
| 女王グモ | 44×36  | 2（足を交互に）    | 紫と黒の大きな腹に赤い模様、8 本の足、赤い目がいくつも、小さな冠                   |
| 子グモ   | 10×8   | 2                  | 女王と同じ色の小さなクモ                                                           |
| 糸の玉   | 6×6    | 1                  | 白とうす灰の丸                                                                     |

- 右向きに描く（描くときに自分の側を向くよう反転する）。外側に `k` の線、色は `PALETTE` の中から。ボスは、ふつうの敵とひと目で分かる大きさと色にする。
- 作り方は [[pixel-art-tooling]] のメモのとおり。node で `art/*.ts` を直接読み、zlib で PNG に書く道具（`png.mjs`）と、楕円・三角を塗って外側の線と影を付ける下書きの道具（`sketch.mjs`）を scratchpad に作り直し、`gen-bosses.mjs` で格子を書き出して目や爪は手で打つ。

- [ ] **Step 1: 検査のテストを足す**

`pixels.test.ts` の `all` に `...Object.entries(BOSS_ART)` を足し、次のテストを足す。

```ts
it('巨大ベアは 3 コマ、女王グモと子グモは 2 コマ', () => {
  expect(BOSS_ART.bear.frames).toHaveLength(3);
  expect(BOSS_ART.spiderQueen.frames).toHaveLength(2);
  expect(BOSS_ART.spiderling.frames).toHaveLength(2);
  expect(ITEM_ART.web).toBeDefined();
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/pixels.test.ts`
Expected: FAIL（`./art/bosses` が無い）

- [ ] **Step 3: 絵を描く**

道具を作り直して `art/bosses.ts` と `ITEM_ART.web` を書き出す。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/pixels.test.ts`
Expected: PASS

- [ ] **Step 5: 見本シートを撮る**

`boss-sheet.mjs` で次の 2 枚を作り、Read で見て決まりを満たすまで直す。

1. ボス 3 種の全コマと白い点滅の版を 6 倍で並べたもの。
2. 森の地面に、狼と、巨大ベア・女王グモ・子グモ数匹・糸の玉・ネズミ数匹を置いたゲーム画面ふうの 1 枚（3 倍）。

- [ ] **Step 6: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Draw Animal Survivors' bosses: the giant bear, the spider queen, spiderlings, and web balls"
```

- [ ] **Step 7: 利用者に見せて止まる**

`SendUserFile` で 2 枚を送り、この絵でよいかを聞く。承認されるまで Task 2 へ進まない。

---

### Task 2: ボスの表と出かた

**Files:**

- Modify: `enemies.ts`、`stages/forest.ts`、`world.ts`
- Create: `bosses.ts`（この Task では型と `spawnBosses` と空の `moveBoss`・`updateHazards`）
- Test: `bosses.test.ts`

**Interfaces:**

- Consumes: `World`、`makeEnemy`、`spawnPoint`、`ENEMIES`
- Produces:

```ts
// enemies.ts
export type Move = 'chase' | 'wave' | 'snake' | 'charge' | 'boss';
export type BossId = 'bear' | 'spiderQueen';
export interface EnemyDef {
  /* 既存 */ boss?: BossId;
}
// ENEMIES に spiderling・bear・spiderQueen を足す

// stages/forest.ts
export interface Stage {
  /* 既存 */ bosses: { at: number; id: BossId }[];
}

// world.ts
export interface Enemy {
  /* 既存 */ cd: number;
  turn: number;
}
export interface Player {
  /* 既存 */ slow: number;
}
export interface World {
  /* 既存 */ hazards: Hazard[];
  chests: number;
  bossNext: number;
  warned: number;
}
export type GameEvent =
  /* 既存 */ { type: 'warning'; boss: BossId } | { type: 'bossdown'; x: number; y: number } | { type: 'chest' };

// bosses.ts
export interface Hazard {
  alive: boolean;
  kind: 'slam' | 'dash' | 'web';
  /** 予告の持ち主（ボスの enemies の番号）。web は -1 */
  owner: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 予告の残り秒。0 になったら当たる（web は 0 で始まる） */
  delay: number;
  /** 当たったあとに見せる残り秒、web は飛ぶ残り秒 */
  life: number;
  dmg: number;
}
export const WARN_AHEAD = 3;
export function spawnBosses(w: World): void; // 予告の出来事と、時刻が来たボスを置く
export function moveBoss(w: World, i: number, dt: number): { vx: number; vy: number };
export function updateHazards(w: World, dt: number): void;
```

**表の数値**

| id            | name     | hp   | speed | atk | r   | xp  | move  | heavy | boss          |
| ------------- | -------- | ---- | ----- | --- | --- | --- | ----- | ----- | ------------- |
| `spiderling`  | 子グモ   | 8    | 62    | 6   | 4   | 1   | chase | 0     |               |
| `bear`        | 巨大ベア | 2400 | 28    | 20  | 15  | 0   | boss  | 1     | `bear`        |
| `spiderQueen` | 女王グモ | 6000 | 38    | 25  | 16  | 0   | boss  | 1     | `spiderQueen` |

**`spawnBosses(w)` の決まり**

- `w.bossNext` は次に出すボスの番号、`w.warned` は予告を出した数。
- `w.warned === w.bossNext` で `time >= at - WARN_AHEAD` なら `warning` を出して `warned += 1`。
- `time >= at` なら、`spawnPoint()` にボスを置き（HP は表のまま）、`bossNext += 1`。
- 敵の枠が `MAX_ENEMIES` で埋まっていたら、自分からいちばん遠いボスでない敵の枠を使う。
- `step` の出現の処理のすぐあとで呼ぶ。

**`world.ts` の変更**

- `createWorld` は `hazards: []`、`chests: 0`、`bossNext: 0`、`warned: 0`、`player.slow: 0`。`makeEnemy` は `cd: 2`、`turn: 0`。
- `step` は `w.pending > 0 || w.chests > 0` で止まる。自分の速さは `p.slow > 0` なら 0.6 倍、`slow` を dt だけ減らす。
- `moveEnemy` は `def.move === 'boss'` なら `moveBoss(w, i, dt)` の速さを使う（ノックバックの足し算と `t`・`flash` の進め方は共通）。
- `separate` はボスを押さない。片方がボスなら、もう片方だけを重なりの分だけ押し返す。
- `touch` は突進中の巨大ベア（`state === 2`）の攻撃を 30 にする。
- 15:00 のクリアでボスも倒れる（今のまま全員倒れる。宝箱は落とさない）。

- [ ] **Step 1: テストを書く**

```ts
// bosses.test.ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { createWorld, makeEnemy, MAX_ENEMIES, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

/** ふつうの出現を止め、武器も外した世界 */
function quiet(id: 'dog' | 'wolf' = 'dog'): World {
  const w = createWorld(id, 4, VIEW);
  w.weapons = [];
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  w.player.hp = w.stats.maxHp = 1e6;
  return w;
}

const run = (w: World, seconds: number, input = still) => {
  const events: string[] = [];
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    step(w, input, 1 / 60);
    for (const e of w.events) events.push(e.type);
  }
  return events;
};

describe('ボスの出かた', () => {
  it('5 分の 3 秒前に予告が出て、5 分に巨大ベアが画面の外に出る', () => {
    const w = quiet();
    w.time = 296;
    expect(run(w, 1.5)).toContain('warning');
    expect(w.enemies.some((e) => e.alive && e.def.boss)).toBe(false);
    run(w, 2.6);
    const bear = w.enemies.find((e) => e.alive && e.def.boss === 'bear')!;
    expect(bear).toBeDefined();
    expect(bear.hp).toBe(2400);
  });

  it('10 分には女王グモが出る（倒していない巨大ベアは残る）', () => {
    const w = quiet();
    w.time = 296;
    run(w, 5);
    w.time = 598;
    run(w, 3);
    const bosses = w.enemies.filter((e) => e.alive && e.def.boss).map((e) => e.def.boss);
    expect(bosses.sort()).toEqual(['bear', 'spiderQueen']);
  });

  it('敵の枠が埋まっていてもボスは出る', () => {
    const w = quiet();
    for (let i = 0; i < MAX_ENEMIES; i++) w.enemies.push(makeEnemy({ ...ENEMIES.rat, speed: 0 }, 2000 + i, 0, 6));
    w.time = 299.99;
    run(w, 0.1);
    expect(w.enemies).toHaveLength(MAX_ENEMIES);
    expect(w.enemies.some((e) => e.alive && e.def.boss === 'bear')).toBe(true);
  });

  it('ボスは押し合いで押されない', () => {
    const w = quiet();
    const bear = makeEnemy({ ...ENEMIES.bear, speed: 0 }, 100, 0, 2400);
    w.enemies.push(bear, makeEnemy({ ...ENEMIES.rat, speed: 0 }, 105, 0, 6));
    w.time = 10;
    run(w, 0.2);
    expect(bear.x).toBeCloseTo(100, 0);
    expect(Math.hypot(w.enemies[1].x - 100, w.enemies[1].y)).toBeGreaterThan(15);
  });
});
```

（`ENEMIES.bear` の `speed: 0` は動かさないための上書き。`moveBoss` がまだ空なので、この Task では止まっている。）

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/bosses.test.ts`
Expected: FAIL（`ENEMIES.bear` が無い・予告が出ない）

- [ ] **Step 3: 書く**

上の表と決まりのとおりに `enemies.ts`・`stages/forest.ts`・`world.ts` を変え、`bosses.ts` に型・`WARN_AHEAD`・`spawnBosses` を書く。`moveBoss` はこの Task では `{ vx: 0, vy: 0 }` を返し、`updateHazards` は何もしない。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS（既存のテストも）

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' boss table and schedule: a warning 3 seconds ahead, the bear at 5:00 and the spider queen at 10:00"
```

---

### Task 3: ボスの攻撃

**Files:**

- Modify: `bosses.ts`（`moveBoss`・`updateHazards` を中身にする）、`world.ts`（`step` から `updateHazards` を呼ぶ）
- Test: `bosses.test.ts`

**Interfaces:**

- Consumes: Task 2 のすべて、`spawnPoint`、`makeEnemy`、`ENEMIES.spiderling`
- Produces: Task 2 の `moveBoss`・`updateHazards` の中身

**巨大ベア（`state`: 0 追う・1 突進の予告・2 突進・3 地ならしの予告）**

- state 0: 自分へ 28 px/秒。`cd -= dt`、0 以下で `turn` が偶数なら state 1、奇数なら state 3 にし、`turn += 1`。
- state 1: そのときの自分への向きを `dx, dy` に覚え、`kind: 'dash'`・`owner: i`・`delay: 0.7`・`r: 120`（矢印の長さ）の予告を置き、`wait = 0.7`。止まる。`wait` が 0 で state 2、`wait = 0.9`。
- state 2: `dx, dy` に 210 px/秒。`wait` が 0 で state 0、`cd = 4`。
- state 3: `kind: 'slam'`・`owner: i`・`delay: 1`・`r: 56`・`dmg: 28` の予告をボスの位置に置き、`wait = 1`。止まる。`wait` が 0 で state 0、`cd = 4`。

**女王グモ**

- 自分との距離が 110 より遠ければ近づき、近ければ離れ、その向きに直角の向きを足して回り込む（38 px/秒）。
- `cd` は糸の玉の待ち時間（2.5 秒）。0 以下で、自分のいる向きを真ん中に 15° ずつ 5 発（-30°・-15°・0°・15°・30°）、`kind: 'web'`・`owner: -1`・`delay: 0`・`life: 3`・`r: 4`・`dmg: 8`・速さ 90。
- `turn` を子グモの待ち時間に使い（6 秒）、0 以下で女王グモの周り半径 20 に子グモを 6 匹（HP 8）置く。敵の枠の上限に数え、空きがなければ生まない。

**`updateHazards(w, dt)`**

- `slam`: `delay` を減らし、0 を切った瞬間に自分が `r` 以内なら `dmg` を受ける（無敵の時間に関係なく当たり、当たったら `invuln = 0.5`・`hurt` を出す）。そのあと `life = 0.3` だけ衝撃波として見せて消える。
- `dash`: 見せるだけ。持ち主が `state !== 1` になったら消える。
- `web`: 飛んで `life` が 0 で消える。自分から `r + 6` 以内に入ったら、無敵でなければ `dmg` を受け、`player.slow = 2`、消える。
- 持ち主が生きていない `slam` と `dash` は消える。
- 自分へのダメージは `world.ts` の `touch` と同じ書き方（`armor` を引き、最低 1、0 で `dead`）。`hurtPlayer(w, dmg)` として `world.ts` から export して両方で使う。

- [ ] **Step 1: テストを足す**

```ts
describe('ボスの攻撃', () => {
  const placeBoss = (w: World, id: 'bear' | 'spiderQueen', x: number, y = 0) => {
    const e = makeEnemy(ENEMIES[id], x, y, ENEMIES[id].hp);
    w.enemies.push(e);
    return e;
  };

  it('巨大ベアの地ならしは、予告のあいだは当たらず、予告が終わると輪の中に当たる', () => {
    const w = quiet();
    const bear = placeBoss(w, 'bear', 40);
    bear.cd = 0;
    bear.turn = 1; // 奇数なので地ならし
    w.time = 10;
    run(w, 0.5);
    expect(w.hazards.some((h) => h.alive && h.kind === 'slam')).toBe(true);
    const before = w.player.hp;
    run(w, 0.3);
    expect(w.player.hp).toBe(before);
    run(w, 0.4);
    expect(w.player.hp).toBe(before - 28);
  });

  it('巨大ベアの突進は、予告の矢印を出して止まり、そのあと速く走る', () => {
    const w = quiet();
    const bear = placeBoss(w, 'bear', 200);
    bear.cd = 0;
    w.time = 10;
    run(w, 0.3);
    expect(w.hazards.some((h) => h.alive && h.kind === 'dash')).toBe(true);
    const x0 = bear.x;
    run(w, 0.3);
    expect(bear.x).toBeCloseTo(x0, 0);
    run(w, 0.5);
    expect(x0 - bear.x).toBeGreaterThan(60);
    expect(w.hazards.some((h) => h.alive && h.kind === 'dash')).toBe(false);
  });

  it('女王グモの糸の玉に当たると 2 秒遅くなる', () => {
    const w = quiet();
    const q = placeBoss(w, 'spiderQueen', 110);
    q.cd = 0;
    q.turn = 99;
    w.time = 10;
    run(w, 1.5);
    q.cd = 99; // 2 回目の玉が当たらないように
    expect(w.player.slow).toBeGreaterThan(0);
    w.player.x = 0;
    const x0 = w.player.x;
    step(w, { x: 1, y: 0 }, 1 / 60);
    expect(w.player.x - x0).toBeCloseTo((60 * 0.6) / 60, 3);
    run(w, 2.1);
    expect(w.player.slow).toBeLessThanOrEqual(0);
  });

  it('女王グモは 6 秒ごとに子グモを 6 匹生む', () => {
    const w = quiet();
    const q = placeBoss(w, 'spiderQueen', 110);
    q.cd = 99;
    q.turn = 0;
    w.time = 10;
    run(w, 0.1);
    expect(w.enemies.filter((e) => e.alive && e.def.id === 'spiderling')).toHaveLength(6);
    q.cd = 99;
    run(w, 5.5);
    expect(w.enemies.filter((e) => e.def.id === 'spiderling').length).toBe(6);
    q.cd = 99;
    run(w, 0.6);
    expect(w.enemies.filter((e) => e.def.id === 'spiderling').length).toBe(12);
  });

  it('予告の途中で巨大ベアが倒れたら、予告は消える', () => {
    const w = quiet();
    const bear = placeBoss(w, 'bear', 40);
    bear.cd = 0;
    bear.turn = 1;
    w.time = 10;
    run(w, 0.3);
    bear.alive = false;
    run(w, 0.1);
    expect(w.hazards.some((h) => h.alive)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/bosses.test.ts`
Expected: FAIL（攻撃が無い）

- [ ] **Step 3: 書く**

上の決まりのとおりに書く。`step` では `separate`・`touch` のあとに `updateHazards(w, dt)` を呼び、`w.over` なら戻る。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Give Animal Survivors' bosses their attacks: the bear's telegraphed charge and ground slam, the spider queen's slowing webs and spiderlings"
```

---

### Task 4: 倒したときと宝箱

**Files:**

- Modify: `drops.ts`、`world.ts`（`damageEnemy` で `bossdown` を出す）
- Create: `chest.ts`
- Test: `bosses.test.ts`

**Interfaces:**

- Consumes: `apply`（`choices.ts`）、`gainXp`、`MAX_LEVEL`
- Produces:

```ts
// drops.ts
export interface Item {
  /* kind に 'chest' を足す */
}
// chest.ts
export type Reward = { kind: 'weapon' | 'passive'; id: string; level: number } | { kind: 'meat' } | { kind: 'bag' };
export function chestSize(r: number): 1 | 3 | 5; // r < 0.6 → 1、< 0.9 → 3、それ以外 5
export function openChest(w: World): Reward[]; // w.chests を 1 減らし、当てたものを返す
```

**決まり**

- `damageEnemy` でボスが倒れたら `bossdown`（位置つき）を出す。`dropFrom` はボスなら、経験値 25 の玉を半径 24 の円周上に 10 個と、宝箱を倒れた所に置く（肉・磁石の抽選はしない）。
- `collect` は宝箱を吸い寄せず、自分から 10 px 以内に入ったら拾う。拾ったら `w.chests += 1`、`chest` を出す。
- `openChest` は `chestSize(w.rand())` 個ぶん、持っている武器とパッシブのうち Lv5 未満のものをでたらめに選び、`apply(w, { kind, id, level: level + 1 })` と同じ形で 1 Lv 上げる（`apply` は `pending` を 1 減らすので、宝箱では `pending` を戻すか、上げる処理を `apply` から `levelUp(w, c)` に分けて両方から呼ぶ。分けるほうにする）。上げられるものが無ければ、まだ入れていなければ `meat`、次は `bag` を入れ、それも入れたら残りは `bag` を繰り返す。
- Lv が上がって `pending` が増えたら（袋の経験値）、宝箱のあとに 3 択が出る。

- [ ] **Step 1: テストを足す**

```ts
import { chestSize, openChest } from './chest';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { PASSIVES } from './passives';

describe('倒したときと宝箱', () => {
  it('ボスを倒すと bossdown が出て、赤い玉 10 個と宝箱が落ちる', () => {
    const w = quiet();
    w.weapons = [{ id: 'woof', level: 1, cd: 0 }];
    // 近くで倒すと赤い玉がすぐ吸い寄せられるので、取得範囲（32）より遠くで倒す
    const bear = makeEnemy({ ...ENEMIES.bear, speed: 0 }, 150, 0, 1);
    w.enemies.push(bear);
    w.time = 10;
    expect(run(w, 1.2)).toContain('bossdown');
    expect(w.gems.filter((g) => g.alive && g.value === 25)).toHaveLength(10);
    expect(w.items.filter((it) => it.alive && it.kind === 'chest')).toHaveLength(1);
  });

  it('宝箱は吸い寄せられず、歩いて取ると止まる', () => {
    const w = quiet();
    w.items.push({ alive: true, kind: 'chest', x: 30, y: 0, pulled: false });
    w.time = 10;
    run(w, 0.5);
    expect(w.items[0].x).toBe(30);
    const events = run(w, 1, { x: 1, y: 0 });
    expect(events).toContain('chest');
    expect(w.chests).toBe(1);
    const t = w.time;
    run(w, 0.5);
    expect(w.time).toBe(t);
  });

  it('宝箱の大きさは 6 割が 1、3 割が 3、1 割が 5', () => {
    expect(chestSize(0)).toBe(1);
    expect(chestSize(0.59)).toBe(1);
    expect(chestSize(0.6)).toBe(3);
    expect(chestSize(0.89)).toBe(3);
    expect(chestSize(0.95)).toBe(5);
  });

  it('宝箱は Lv5 を超えて上げず、上げるものが無ければ肉と袋になる', () => {
    const w = quiet();
    w.weapons = Object.keys(WEAPONS)
      .slice(0, 6)
      .map((id) => ({ id, level: MAX_LEVEL, cd: 0 }));
    w.passives = [{ id: 'heart', level: 4 }];
    w.chests = 1;
    w.rand = () => 0.99; // 5 つ
    const got = openChest(w);
    expect(got).toHaveLength(5);
    expect(got[0]).toEqual({ kind: 'passive', id: 'heart', level: 5 });
    expect(got.slice(1).map((r) => r.kind)).toEqual(['meat', 'bag', 'bag', 'bag']);
    expect(w.passives[0].level).toBe(5);
    expect(w.chests).toBe(0);
    expect(Object.keys(PASSIVES)).toContain('heart');
  });

  it('宝箱を開けるあいだは 3 択を出さず、袋で上がった Lv は宝箱のあとに 3 択になる', () => {
    const w = quiet();
    w.chests = 1;
    w.pending = 1;
    const t = w.time;
    step(w, still, 1 / 60);
    expect(w.time).toBe(t);
    openChest(w);
    expect(w.chests).toBe(0);
    expect(w.pending).toBeGreaterThanOrEqual(1);
  });

  it('15:00 のクリアではボスも倒れ、宝箱は落とさない', () => {
    const w = quiet();
    w.enemies.push(makeEnemy(ENEMIES.bear, 100, 0, 2400));
    w.time = 899.99;
    run(w, 0.05);
    expect(w.over).toBe('clear');
    expect(w.items.some((it) => it.alive && it.kind === 'chest')).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/bosses.test.ts`
Expected: FAIL（`./chest` が無い）

- [ ] **Step 3: 書く**

`choices.ts` の `apply` から 1 Lv 上げる処理を `levelUp(w, c)` に分けて export し（`apply` は `pending` を減らしてから `levelUp` を呼ぶ）、`chest.ts` から使う。`drops.ts` と `world.ts` は上の決まりのとおり。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Drop red gems and a treasure chest when an Animal Survivors boss falls; the chest raises 1, 3, or 5 owned items"
```

---

### Task 5: 画面

**Files:**

- Create: `draw-boss.ts`、`BossWarning.svelte`、`ChestOpen.svelte`
- Modify: `draw.ts`、`effects.ts`、`sounds.ts`、`Play.svelte`

**Interfaces:**

- Consumes: Task 1〜4 のすべて、`Lock`、`PixelIcon`、`retro.css`
- Produces:

```ts
// draw-boss.ts
export function hazardsBelow(ctx: CanvasRenderingContext2D, w: World, q: (v: number) => number): void; // 床の予告（輪と矢印）。敵より先に描く
export function hazardsAbove(ctx: CanvasRenderingContext2D, w: World, q: (v: number) => number): void; // 糸の玉と衝撃波
export function bossBars(ctx: CanvasRenderingContext2D, w: World, v: ViewSize, top: number): void;
```

**描き方**

- ボスの絵は `draw.ts` の敵と同じ流れで描く（y の順に並べ、自分の側を向き、白い点滅）。絵は `ENEMY_ART` か `BOSS_ART` から id で引く。巨大ベアは `state === 3` のとき 3 コマ目、それ以外は `frameAt(e.t * 4, 2)`。影は横幅 `r * 2.2`。
- 地ならしの予告は、赤の 25% の円を `(1 - delay / 1)` の割合で半径 `r` まで広げ、縁を赤の 70% の線（太さ 2）で描く。当たったあとの `life` のあいだは、白と橙の輪が外へ広がって薄くなる。
- 突進の予告は、ボスから `dx, dy` の向きへ長さ 120 の赤い帯（幅 10、20% → 50% と点滅）と、先に矢じり。
- 糸の玉は `ITEM_ART.web` を描く。
- ボスの HP の棒は、HUD の HP の棒の下（`top + 22`、2 体目は `top + 32`）に、`BOSS` の字と幅 `v.w - 60` の紫の棒。
- 撃破の白い光は `fx.flash`（0.25 秒）で、画面全体を白の `flash / 0.25 * 0.7` で塗る。

**演出と音**

| 出来事   | 見た目                                       | 音                                                |
| -------- | -------------------------------------------- | ------------------------------------------------- |
| warning  | `BossWarning` の帯を 3 秒                    | 低い警告音を 3 回（`square`、0.5 秒ごと）         |
| bossdown | 白い光 0.25 秒、ボスの色と白と黄の粒を 60 個 | ファンファーレ（`sounds.clear` と同じ形で別の音） |
| chest    | なし（`ChestOpen` が開く）                   | 宝箱の音（上がる 3 音）                           |

**`BossWarning.svelte`**

- props: `{ name: string }`。画面の上から 30% の位置に、赤と黒の斜めの縞の帯（高さ `min(12cqh, 90px)`）が左から入り、`WARNING!` を大きく、その下に `{name}が出現！`。帯は 0.3 秒ずつ点滅する。`pointer-events: none`。`prefers-reduced-motion` では点滅も入り方もやめる。

**`ChestOpen.svelte`**

- props: `{ rewards: Reward[]; locked: boolean; onclose: () => void }`。`as-screen` の暗い地に `as-panel`。見出し `TREASURE!`、宝箱の絵（`PixelIcon` の `ITEM_ART.chest`）が 0.5 秒揺れてから、上がったものを 0.25 秒ずつ順に出す（アイコン・名前・`Lv N`。肉は「HP を 30% 回復」、袋は「経験値 +25」）。全部出たら「OK」の `as-card`。Enter キーと 1 キーでも閉じる。`locked` のあいだは押せない。

**`Play.svelte`**

- 毎フレーム `step` のあとに `world.events` から `warning` を拾い、`warning = BOSS_NAME[id]` にして 3 秒後に `null` に戻す（`{#key}` で帯を作り直す）。
- `world.chests > 0` で宝箱を開けていなければ、`rewards = openChest(world)`・`lock.begin(stick?.id ?? null)`。`ChestOpen` の `onclose` で、まだ `chests` が残っていれば次を開け、なければ `rewards = null`。
- 3 択を出す条件に `!rewards && world.chests === 0` を足す。
- 帯と宝箱の画面は 3 択と同じく盤面の外に置く。200 行を超えそうなら、3 択・宝箱・帯の切り替えを `Overlays.svelte` に分ける。

- [ ] **Step 1: 書く**

上の決まりのとおりに書き、Svelte のファイルは `npx -y @sveltejs/mcp svelte-autofixer` で確かめる。

- [ ] **Step 2: headless Chrome で撮る**

scratchpad の台本で、`page.clock` を 4:55 相当まで進めたいので、ページの中で直接世界を作らずに、遊んで進める（狼で、敵をよけて玉を拾う簡単なボットを `page.evaluate` で入れ、3 択は 1 枚目を選ぶ）。撮るもの: WARNING の帯、巨大ベアの地ならしの予告と突進の矢印、女王グモと子グモと糸の玉、ボスの HP の棒、撃破の白い光、宝箱の画面。WebKit（`pw.webkit.launch()`）でも 1 枚撮る。ボスと子グモと敵 400 体の場面で、`requestAnimationFrame` の間隔が 16.7ms 前後に保たれることを WebKit と Chrome で確かめる。

- [ ] **Step 3: 確かめて commit**

Run: `pnpm test:run && pnpm check && pnpm lint && pnpm vitals --diff`
Expected: すべて通る

```bash
git add src/lib/games/animal-survivors
git commit -m "Show Animal Survivors' bosses: the WARNING banner, telegraphs, webs, boss health bars, the knockout flash, and the treasure chest screen"
```

---

### Task 6: 強さの調整と文書

**Files:**

- Modify: 数値（`enemies.ts`・`bosses.ts`）、`CLAUDE.md`、`docs/superpowers/specs/2026-10-02-animal-survivors-bosses-design.md`
- Create (scratchpad): `<scratchpad>/sim/vitest.config.mjs`・`survivors.sim.ts`（[[balance-sim-harness]] の形。前のセッションの scratchpad は消えているので作り直す）

- [ ] **Step 1: ボットで測る**

前回と同じボット（敵から 70 px 以内なら離れる向き、危ないときは 90 px 以内の玉、安全なら遠くの玉へ。3 択はでたらめと武器を先に。予告の輪の中にいたら輪の外へ逃げる向きも足す）で、3 匹 × 2 通り × 8 種を 900 秒まで回し、生存時間・Lv・ボスを倒すまでの時間（出てから倒れるまで）の中央値を出す。

- [ ] **Step 2: 数値を直す**

目安は、巨大ベアと女王グモを、出てからそれぞれ 40〜90 秒で倒せること、でたらめに選んだときの生存時間の中央値が 8〜13 分に入ること。直したら `bosses.test.ts` の数値の期待も合わせる。

- [ ] **Step 3: 文書を書く**

`CLAUDE.md` の Animal Survivors の段落に、ボス（`bosses.ts`・`World.hazards`・予告が終わってから当たる・押されない・宝箱の `chest.ts`・宝箱を 3 択より先に開ける）を足す。設計書は決めた数値に直す。

- [ ] **Step 4: まとめて確かめて commit**

Run: `pnpm verify`
Expected: すべて通る

```bash
git add -A src/lib/games/animal-survivors CLAUDE.md docs
git commit -m "Tune Animal Survivors' bosses with the bot and document them"
```

- [ ] **Step 5: 利用者に渡して止まる**

全体のレビュー（別の係、最も強いモデル）を通してから、main へ push してよいかを聞く。
