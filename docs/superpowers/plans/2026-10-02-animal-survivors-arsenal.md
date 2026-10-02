# Animal Survivors 武器と敵の追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Animal Survivors に武器 5 つ（爪・ダッシュアタック・どんぐりショット・野生の炎・ツタ）、敵 2 種（クモ・ワニ）、強化個体を足す。

**Architecture:** 武器は `weapons.ts` の表に足し、爪とダッシュは今の `swipe` と `shot`、どんぐりは新しい `nova` を `arms.ts` に、炎とツタは新しい `trail`・`snare` を `zones.ts` に置く。敵は `enemies.ts` の表と `world.ts` の `leap` の動き、強化個体は出すときに表を写して強くする。描き方は `draw.ts` と `bake()` の金色の版。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、canvas 2D、vitest（unit project）、playwright-core（scratchpad の確認用）

**Spec:** `docs/superpowers/specs/2026-10-02-animal-survivors-arsenal-design.md`

## 止まるところ

| どこで          | 何を見せるか                                         | 次へ進む条件                   |
| --------------- | ---------------------------------------------------- | ------------------------------ |
| Task 1 の終わり | 新しいアイコン・弾・炎・ツタ・クモ・ワニ・金色の見本 | 利用者が「この絵でよい」と言う |
| Task 6 の終わり | 入った版                                             | main へ push してよいかを聞く  |

## Global Constraints

- 置き場所は `src/lib/games/animal-survivors/`。ルールのファイルは DOM を使わない。コンポーネントは 200 行未満、絵文字は使わない。
- 武器の数値は spec の表のとおり（`claw` 8/0.45/1/1.1/0/99/0.12/30、`dash` 20/2.4/1/1/260/99/0.5/150、`acorn` 8/1.6/6/1/130/1/1.4/30、`flame` 5/0.3/1/1/0/99/2/0、`vine` 6/3/2/1/0/99/2.5/0。並びは damage・cooldown・amount・area・speed・pierce・duration・knockback）。
- 炎とツタは 0.5 秒ごとに当てる。炎の半径 10、ツタの半径 12、ダッシュの弾の半径 8、どんぐりの半径 3（どれも `area` 倍）。ツタの中の敵は足止め（0.2 秒ずつ延びる）。ボスも足止めされる。
- クモ 18/36/9/6/3/`leap`/0.2、ワニ 120/16/16/9/10/`chase`/0.9（hp・speed・atk・r・xp・move・heavy）。クモは 3 秒ごとに 0.4 秒止まり、4 倍の速さで 0.35 秒跳ぶ。
- 出現表にクモ（420〜900、0.4 → 2.5）とワニ（480〜900、0.2 → 1）。強化個体は 240 秒から 2%。HP 8 倍・経験値 10 倍・半径 1.6 倍・heavy は 0.6 以上、ボスと子グモはならない。倒すと 10% で宝箱。金色の版を 2 倍で描く。
- 各 Task の終わりに `pnpm test:run`・`pnpm check`・`pnpm lint`・`pnpm vitals --diff` を通して commit する。commit の末尾は `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

- ツタで足止めされたボス。突進中の巨大ベアもその場で止まり、予告と攻撃の流れが壊れないこと（足止めのあいだは動く速さだけを 0 にし、攻撃の時計は進める）。Task 3 のテスト。
- 画面の中に敵がいないときのツタ。待ち時間を使わずに待つこと。Task 3 のテスト。
- 強化個体を出すときに表を写す。元の表（`ENEMIES`）を書き換えないこと。Task 4 のテスト。
- 炎が重なった場所の敵。武器の枠ごとに 0.5 秒に 1 回だけ当たること。Task 3 のテスト。
- ダッシュの弾がボスに当たる。何体でも貫いても、同じ敵には 1 回だけ当たること（今の `Shot.hits`）。Task 2 のテスト。

---

### Task 1: 新しい絵と見本シート

**Files:**

- Modify: `art/items.ts`（`weapon-claw`・`weapon-dash`・`weapon-acorn`・`weapon-flame`・`weapon-vine` の 12×12 アイコン、`acorn` 6×6、`flame` 10×12 の 2 コマ、`vine` 12×14 の 2 コマ）、`art/enemies.ts`（`spider` 14×12 の 2 コマ、`croc` 24×12 の 2 コマ）、`pixels.ts`（金色の版）、`pixels.test.ts`
- Create (scratchpad): 生成の道具と `arsenal-sheet.mjs`

**Interfaces:**

- Produces: `ITEM_ART` の 10 項目、`ENEMY_ART.spider`・`ENEMY_ART.croc`、`BakeMode` に `'gold' | 'flipGold'`、`export function goldOf(hex: string): string`（純粋。明るさで金色の 3 段に置き換える。線の色はそのまま）

**絵の決まり**

- クモは子グモと同じく上から見た形で、色は茶と黒（紫の女王の仲間と見分ける）。8 本の足と赤い目。
- ワニは横から見た形で、緑の長い体と白い歯、4 本の短い足。2 コマで足を動かす。
- 炎は橙と黄の炎の形で 2 コマで揺れる。ツタは地面から伸びる緑のつるで、1 コマ目は短く、2 コマ目は伸びる。どんぐりは茶色の帽子つきの実。
- アイコンは、爪（3 本の白い爪痕）・ダッシュ（走る足跡と速さの線）・どんぐり・炎・ツタの葉。どれも何の絵か分かる形にする（利用者の基準）。

- [ ] **Step 1: テストを足す**

```ts
// pixels.test.ts に足す
import { goldOf } from './pixels';

it('新しい武器と敵の絵がある', () => {
  for (const k of [
    'weapon-claw',
    'weapon-dash',
    'weapon-acorn',
    'weapon-flame',
    'weapon-vine',
    'acorn',
    'flame',
    'vine'
  ])
    expect(ITEM_ART[k]).toBeDefined();
  expect(ITEM_ART.flame.frames).toHaveLength(2);
  expect(ITEM_ART.vine.frames).toHaveLength(2);
  expect(ENEMY_ART.spider.frames).toHaveLength(2);
  expect(ENEMY_ART.croc.frames).toHaveLength(2);
});

it('金色の版は線を残し、明るい色ほど明るい金色にする', () => {
  expect(goldOf(PALETTE.k)).toBe(PALETTE.k);
  const dark = goldOf('#303030');
  const light = goldOf('#f0f0f0');
  expect(dark).not.toBe(light);
  expect([dark, light].every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/pixels.test.ts`
Expected: FAIL（絵と `goldOf` が無い）

- [ ] **Step 3: 絵と `goldOf` を書く**

`goldOf` は、色の明るさ（`0.299R + 0.587G + 0.114B`）が 0.33 未満なら `#b8860b`、0.66 未満なら `#ffc233`、それ以上なら `#fff1a8`。`PALETTE.k` はそのまま返す。`bake()` の `gold` と `flipGold` は、塗る色を `goldOf(色)` にする。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/pixels.test.ts`
Expected: PASS

- [ ] **Step 5: 見本シートを撮る**

新しい絵の全部と、ネズミ・イノシシ・クモ・ワニの金色の版（`goldOf` を当てて 2 倍）を並べた 1 枚と、森の地面に炎の跡・ツタ・どんぐり・分身（白く半透明の犬）・クモ・ワニ・金色のイノシシを置いたゲーム画面ふうの 1 枚を撮り、何の絵か分かるまで直す。

- [ ] **Step 6: commit して見せて止まる**

```bash
git add src/lib/games/animal-survivors
git commit -m "Draw Animal Survivors' new weapons and enemies: claw, dash, acorn, flame, and vine icons, spiders, crocodiles, and golden elites"
```

`SendUserFile` で 2 枚を送り、承認されるまで Task 2 へ進まない。

---

### Task 2: 爪・ダッシュ・どんぐり

**Files:**

- Modify: `weapons.ts`、`arms.ts`
- Test: `arsenal.test.ts`（新）

**Interfaces:**

- Produces: `WEAPONS.claw`・`dash`・`acorn`・`flame`・`vine`（この Task で 5 つとも表に足す。`flame` と `vine` の動きは Task 3）、`WeaponKind` に `'nova' | 'trail' | 'snare'`、`WeaponDef.size?: number`（`shot` の弾の半径。無ければ 4）

**決まり**

- `launch` の `shot` は半径を `(def.size ?? SIZE.shot) * area` にする（`launch` に `def` を渡す）。
- `nova` は、近い敵の向き（いなければ進む向き）を始めに、`amount` 発を `2π / amount` ずつずらして撃つ。弾の種類は `shot`、半径 3。
- この Task では `trail` と `snare` の `launch` は `false` を返す（撃たない）。

- [ ] **Step 1: テストを書く**

```ts
// arsenal.test.ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { MAX_LEVEL, WEAPONS } from './weapons';
import { createWorld, makeEnemy, step, type World } from './world';

const VIEW = { w: 274, h: 394 };
const still = { x: 0, y: 0 };

/** ほかの敵とボスを出さず、武器を 1 つだけ持たせた世界 */
export function only(weapon: string, level = 1): World {
  const w = createWorld('dog', 5, VIEW);
  w.weapons = weapon ? [{ id: weapon, level, cd: 0 }] : [];
  w.stage = { ...w.stage, waves: [], bosses: [] };
  w.spawnAcc = [];
  w.stats.crit = 0;
  w.player.hp = w.stats.maxHp = 1e6;
  return w;
}

export const run = (w: World, seconds: number, input = still) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) step(w, input, 1 / 60);
};

/** 動かず吹き飛ばされない的 */
export const target = (x: number, y: number) => makeEnemy({ ...ENEMIES.caterpillar, speed: 0, heavy: 1 }, x, y, 1000);

describe('新しい武器', () => {
  it('5 つともレベル 5 までの上げ幅を持つ', () => {
    for (const id of ['claw', 'dash', 'acorn', 'flame', 'vine']) expect(WEAPONS[id].ups).toHaveLength(MAX_LEVEL - 1);
  });

  it('爪は近い敵の側を裂く', () => {
    const w = only('claw');
    w.enemies.push(target(-20, 0));
    step(w, still, 1 / 60);
    expect(w.enemies[0].hp).toBe(992);
  });

  it('ダッシュは一直線に並んだ敵をまとめて貫き、同じ敵には 1 回だけ当たる', () => {
    const w = only('dash');
    w.enemies.push(target(30, 0), target(60, 0), target(90, 0));
    run(w, 0.6);
    expect(w.enemies.map((e) => e.hp)).toEqual([980, 980, 980]);
  });

  it('どんぐりは全方向に等間隔で 6 発出る', () => {
    const w = only('acorn');
    w.enemies.push(target(200, 0));
    step(w, still, 1 / 60);
    const angles = w.shots
      .filter((o) => o.alive)
      .map((o) => Math.atan2(o.vy, o.vx))
      .sort((a, b) => a - b);
    expect(angles).toHaveLength(6);
    for (let i = 1; i < angles.length; i++) expect(angles[i] - angles[i - 1]).toBeCloseTo(Math.PI / 3, 5);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/arsenal.test.ts`
Expected: FAIL（`WEAPONS.claw` が無い）

- [ ] **Step 3: 書く**

5 つの武器を spec の表どおりに `weapons.ts` に足す（`dash` は `size: 8`）。`arms.ts` に `nova` を足し、`shot` の半径を `def.size` から取る。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS（`choices` のテストは武器が 12 になっても通ること）

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' claw, dash attack, and acorn shot"
```

---

### Task 3: 炎とツタ

**Files:**

- Create: `zones.ts`
- Modify: `arms.ts`（`Effect.kind` に `'flame' | 'vine'`、`launch` の `trail`・`snare`、`hits` から `updateZones` を呼ぶ）、`world.ts`（`Enemy.root`、足止めのあいだは動く速さを 0）
- Test: `arsenal.test.ts`

**Interfaces:**

- Produces:

```ts
// zones.ts
export const ZONE_TICK = 0.5;
export function dropFlame(w: World, slot: number, s: WeaponStats, area: number): void;
export function growVines(w: World, slot: number, s: WeaponStats, area: number): boolean; // 画面に敵がいなければ false
export function updateZones(w: World): void; // 炎とツタの中の敵に当て、ツタの中の敵を足止めする
// world.ts
export interface Enemy {
  /* 既存 */ root: number;
}
```

**決まり**

- 炎は `Effect` の `kind: 'flame'`、半径 `10 * area`、`life = duration`、`dmg = damage`。
- ツタは画面の中のでたらめな敵 `amount` 体（重ならない）の位置に `kind: 'vine'`、半径 `12 * area`、`life = duration`。
- `updateZones` は、生きている炎とツタの中（`r + 敵の半径`）にいる敵に、`w.time - e.hit[slot] >= ZONE_TICK` なら `power(w, dmg)` を当てて `e.hit[slot] = w.time`（吹き飛ばしは 0）。ツタの中なら `e.root = 0.2`。
- `moveEnemy` は `e.root > 0` なら動く速さとノックバックを 0 にし、`root` を dt だけ減らす。ボスの攻撃の時計（`cd`・`wait`）は進める（`moveBoss` は呼び、返った速さだけ捨てる）。

- [ ] **Step 1: テストを足す**

```ts
describe('炎とツタ', () => {
  it('炎は足もとに残り、上の敵を 0.5 秒ごとに削る（重なった炎でも 1 回）', () => {
    const w = only('flame');
    w.enemies.push(target(0, 0));
    run(w, 1.2);
    expect(w.enemies[0].hp).toBe(985);
    expect(w.effects.filter((f) => f.alive && f.kind === 'flame').length).toBeGreaterThan(1);
  });

  it('炎は歩いたあとに残り、時間がたつと消える', () => {
    const w = only('flame');
    run(w, 0.1);
    run(w, 1, { x: 1, y: 0 });
    expect(w.effects.some((f) => f.alive && f.kind === 'flame' && Math.abs(f.x) < 2)).toBe(true);
    run(w, 2.5, { x: 1, y: 0 });
    expect(w.effects.some((f) => f.alive && f.kind === 'flame' && Math.abs(f.x) < 2)).toBe(false);
  });

  it('ツタの中の敵は動けず、削られる', () => {
    const w = only('vine');
    const rat = makeEnemy(ENEMIES.rat, 100, 0, 1000);
    w.enemies.push(rat);
    run(w, 1);
    // 1 フレーム目は動いてからツタが生えるので、2 ドットまでは許す
    expect(Math.abs(rat.x - 100)).toBeLessThan(2);
    expect(rat.hp).toBeLessThan(1000);
  });

  it('ツタで足止めされた巨大ベアは動かないが、攻撃の時計は進む', () => {
    const w = only('vine');
    const bear = makeEnemy(ENEMIES.bear, 100, 0, 1e6);
    bear.cd = 0.5;
    w.enemies.push(bear);
    run(w, 1);
    expect(Math.abs(bear.x - 100)).toBeLessThan(2);
    expect(bear.state).not.toBe(0);
  });

  it('画面に敵がいなければ、ツタは撃たずに待つ', () => {
    const w = only('vine');
    run(w, 0.5);
    expect(w.effects.some((f) => f.alive && f.kind === 'vine')).toBe(false);
    expect(w.weapons[0].cd).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/arsenal.test.ts`
Expected: FAIL（炎とツタが出ない）

- [ ] **Step 3: 書く**

上の決まりのとおり。`makeEnemy` は `root: 0`。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' wild flame trail and rooting vines"
```

---

### Task 4: クモ・ワニ・強化個体

**Files:**

- Modify: `enemies.ts`、`stages/forest.ts`、`world.ts`、`drops.ts`
- Test: `arsenal.test.ts`

**Interfaces:**

- Produces: `ENEMIES.spider`・`ENEMIES.croc`、`Move` に `'leap'`、`EnemyDef.elite?: boolean`、`Stage.elite: (t: number) => number`、`export function eliteOf(def: EnemyDef): EnemyDef`（world.ts）

**決まり**

- `leap`: state 0 で追い、`cd -= dt`、0 以下で state 1・`wait = 0.4`（止まる）。0 で state 2・`wait = 0.35`、そのときの自分への向きを `dx, dy` に覚えて 4 倍の速さ。0 で state 0・`cd = 3`。
- `eliteOf(def)` は `{ ...def, hp: def.hp * 8, xp: def.xp * 10, r: def.r * 1.6, heavy: Math.max(def.heavy, 0.6), elite: true }`。
- `spawn` は、`def.boss` でも `spiderling` でもなく、`w.rand() < w.stage.elite(w.time)` なら `eliteOf(def)` で出す（HP には今の `toughness` も掛ける）。
- `dropFrom` は、強化個体なら玉のあとに `w.rand() < 0.1` で宝箱を置く。

- [ ] **Step 1: テストを足す**

```ts
import { dropFrom } from './drops';
import { FOREST, spawnRate } from './stages/forest';
import { eliteOf } from './world';

describe('クモ・ワニ・強化個体', () => {
  it('クモは止まってから跳ぶ', () => {
    const w = only('');
    const spider = makeEnemy(ENEMIES.spider, 300, 0, 100);
    spider.cd = 0.1;
    w.enemies.push(spider);
    run(w, 0.2);
    const x0 = spider.x;
    run(w, 0.2);
    expect(spider.x).toBeCloseTo(x0, 0);
    run(w, 0.4);
    expect(x0 - spider.x).toBeGreaterThan(30);
  });

  it('クモは 7 分から、ワニは 8 分から出る', () => {
    const wave = (id: string) => FOREST.waves.find((v) => v.enemy === id)!;
    expect(spawnRate(wave('spider'), 419)).toBe(0);
    expect(spawnRate(wave('spider'), 420)).toBeGreaterThan(0);
    expect(spawnRate(wave('croc'), 479)).toBe(0);
    expect(spawnRate(wave('croc'), 480)).toBeGreaterThan(0);
  });

  it('強化個体は 4 分から 2%', () => {
    expect(FOREST.elite(239)).toBe(0);
    expect(FOREST.elite(240)).toBeCloseTo(0.02);
  });

  it('強化個体は表を写して強くし、元の表は変えない', () => {
    const e = eliteOf(ENEMIES.rat);
    expect(e).toMatchObject({ hp: 48, xp: 10, elite: true });
    expect(e.r).toBeCloseTo(8);
    expect(e.heavy).toBe(0.6);
    expect(ENEMIES.rat.hp).toBe(6);
    expect(ENEMIES.rat.elite).toBeUndefined();
  });

  it('確率に当たった敵は強化個体で出る。ボスはならない', () => {
    const w = only('');
    w.stage = { ...w.stage, elite: () => 1, waves: [{ from: 0, to: 900, enemy: 'rat', rate: [5, 5] }] };
    w.spawnAcc = [0];
    run(w, 1);
    const rats = w.enemies.filter((e) => e.alive);
    expect(rats.length).toBeGreaterThan(2);
    expect(rats.every((e) => e.def.elite)).toBe(true);
  });

  it('強化個体を倒すと 10% で宝箱を落とす', () => {
    const w = only('');
    const e = makeEnemy(eliteOf(ENEMIES.rat), 50, 0, 1);
    w.rand = () => 0.05;
    dropFrom(w, e);
    expect(w.items.some((it) => it.alive && it.kind === 'chest')).toBe(true);
    const v = only('');
    v.rand = () => 0.5;
    dropFrom(v, e);
    expect(v.items.some((it) => it.alive && it.kind === 'chest')).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors/arsenal.test.ts`
Expected: FAIL（`ENEMIES.spider` が無い）

- [ ] **Step 3: 書く**

上の決まりのとおり。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run --project unit src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 5: commit**

```bash
git add src/lib/games/animal-survivors
git commit -m "Add Animal Survivors' leaping spiders, crocodiles, and golden elites that may drop chests"
```

---

### Task 5: 描き方

**Files:**

- Modify: `draw.ts`（必要なら弾とエフェクトの描画を `draw-arms.ts` に分ける）、`effects.ts`（`BODY` の色にクモとワニ）

**決まり**

- 強化個体は `bake(art, frame, flip ? 'flipGold' : 'gold')` を 2 倍で描き（白い点滅のときは白い版を 2 倍）、影も 2 倍の幅にする。
- 弾は持ち主の武器（`w.weapons[o.slot]?.id`）で描き分ける。`acorn` はどんぐり、`dash` は自分の動物の歩きの絵の白い版を、進む向きに反転して `globalAlpha` 0.6 で描く。今の骨・魚・羽根はそのまま。
- 引っかきのエフェクトは、持ち主が `claw` なら 3 本の細い線（白、太さ 1、少しずつずらす）で描く。
- 炎は `ITEM_ART.flame` を `frameAt(now * 8 + f.x, 2)` で、残り時間の最後の 0.3 秒は薄くする。ツタは `ITEM_ART.vine`（生えて 0.2 秒は 1 コマ目、そのあと 2 コマ目）。炎とツタは敵より先（床）に描く。

- [ ] **Step 1: 書く**

- [ ] **Step 2: headless Chrome で撮る**

Play.svelte に一時的に `window.__w = world` を入れて（commit しない）、新しい武器を全部 Lv3 で持たせ、`w.time` を 500 にし、強化個体の確率を 0.3 にした世界で 20 秒遊ばせ、炎の跡・ツタ・どんぐり・分身・爪・クモ・ワニ・金色の敵を撮る。WebKit でも 1 枚撮る。敵 400 体と全部の武器の場面で、`requestAnimationFrame` の間隔が 16.7ms 前後に保たれることを WebKit と Chrome で測る。

- [ ] **Step 3: 確かめて commit**

Run: `pnpm test:run && pnpm check && pnpm lint && pnpm vitals --diff`

```bash
git add src/lib/games/animal-survivors
git commit -m "Draw Animal Survivors' new weapons, spiders, crocodiles, and golden elites"
```

---

### Task 6: 強さの確かめと文書

- [ ] **Step 1: ボットで測る**

scratchpad の `sim/survivors.sim.ts`（前のボス追加で作ったもの）を 3 匹 × 2 通り × 8 種で回し、生存時間・Lv・ボスを倒すまでの時間の中央値を出す。生存時間の中央値が前回（10〜12 分）から 2 分以上動いたら、新しい武器か敵の数値を直す。直したら `arsenal.test.ts` の数値も合わせる。

- [ ] **Step 2: 文書を書く**

`CLAUDE.md` の Animal Survivors の段落に、新しい武器の種類（`nova`・`trail`・`snare`、炎とツタは `zones.ts`、足止めの `Enemy.root`）と強化個体（`eliteOf`・金色の版）を足す。spec は直した数値に合わせる。

- [ ] **Step 3: まとめて確かめて commit**

Run: `pnpm verify`

```bash
git add -A src/lib/games/animal-survivors CLAUDE.md docs
git commit -m "Check Animal Survivors' new weapons and enemies with the bot and document them"
```

- [ ] **Step 4: レビューして止まる**

別の係（最も強いモデル）にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
