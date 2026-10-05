# アニマルサバイバー ふたり協力プレイ 試作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2 台の iPad を QR でつなぎ、2 匹が森で同時に動いて敵を倒し、経験値が共通でたまる試作を作る。

**Architecture:** 自分の動物にかかわる値を `Hero` にまとめ、`World` は `heroes` と今の 1 匹を指す `cur` を持つ。`w.player` などの今の読み口は `heroes[cur]` を指す読み書きの口（accessor）として残すので、1 人のときの動きと今のテストは変わらない。動物ごとの処理は `cur` を切り替えて 1 匹ずつ回す。親の端末だけが `World` を進め、子は自分の位置を送り、親から 1 秒に 20 回届く様子（`snap`）を描く。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest、WebRTC（`src/lib/net`）、playwright-core の headless Chrome

**Spec:** `docs/superpowers/specs/2026-10-05-animal-survivors-coop-design.md`（「試作の範囲」まで）

## Global Constraints

- 1 人で遊ぶときは今と同じに動く。今あるテストは書き換えずに通す（2 匹の新しいテストは足す）。
- 2 人まで。親がゲームを進め、子は自分の位置と向きを送る。当たり・ダメージ・拾った品は親が決める。
- 経験値とレベルは 2 匹で共通。試作では、子の動物の 3 択は親の端末が 1 つめの候補を自動で選ぶ。
- 試作では起こす動き・宝箱の各自の中身・ボスの登場と育つ瞬間の演出（子の端末）・延長戦・リザルトと記録・切れたときの扱いを入れない。
- アニマルサバイバーの知らせには `COOP_VERSION` を付け、版が違えばつながったあとすぐに知らせる。
- コンポーネントは 200 行未満。コメントは非自明な WHY だけ。絵文字は使わない。`pnpm verify` が通ること。

## Review Focus

- `cur` を切り替えたまま戻し忘れると、そのあとの処理（HUD・3 択・記録）が子の動物を指す。どの処理も抜けたあと `cur` が 0 に戻ることを Task 2 のテストで固める。
- 2 匹が同じ武器を持つと、同じ敵への当たりの時計（`Enemy.hit`）を取り合って片方が当たらない。Task 2 のテストで固める。
- 倒れた動物（`down`）は、武器を撃たず、敵に追われず、品を拾わない。Task 2 のテストで固める。
- `snap` を読んだ子の端末の画面は、親の様子と同じ位置に敵を描く。種類（強化個体・ヌシ）も同じ。Task 4 のテストで固める。
- 子の端末で、親の知らせが届く前や途中で落ちても描画が止まらない。Task 5 のテストで固める。

---

### Task 1: `Hero` にまとめて、今の読み口を `heroes[cur]` に向ける

**Files:**

- Create: `src/lib/games/animal-survivors/heroes.ts`
- Modify: `src/lib/games/animal-survivors/world.ts`（`World` に `heroes`・`cur` を足し、`createWorld` が `makeHero` で 1 匹を作る）
- Test: `src/lib/games/animal-survivors/heroes.test.ts`

**Interfaces:**

- Produces（`heroes.ts`）
  - `HERO_KEYS`（`Hero` に移す `World` の項目の名前の並び）
  - `interface Hero`（`HERO_KEYS` の項目と `down: boolean`）
  - `bindHeroes(w: World): void`（`HERO_KEYS` の項目を `w.heroes[w.cur]` の読み書きにする）
- Produces（`world.ts`）
  - `makeHero(id: AnimalId, ranks: Ranks, mods: ModId[], gear: GearKey[]): Hero`
  - `addHero(w: World, id: AnimalId, ranks?: Ranks, gear?: GearKey[]): number`（足した番号）
  - `World.heroes: Hero[]`、`World.cur: number`

`HERO_KEYS` は次の 20 項目。

```ts
export const HERO_KEYS = [
  'animal',
  'form',
  'stats',
  'boost',
  'fx',
  'worn',
  'greed',
  'rerolls',
  'revives',
  'rebirths',
  'skips',
  'banishes',
  'banished',
  'player',
  'weapons',
  'passives',
  'dealt',
  'evolvedNow',
  'drainLeft',
  'pending'
] as const;
```

- [ ] **Step 1: 失敗するテストを書く**

```ts
// heroes.test.ts
import { describe, expect, it } from 'vitest';
import { addHero, createWorld } from './world';

const VIEW = { w: 260, h: 380 };

describe('Hero', () => {
  it('1 匹のときは今の読み口がその 1 匹を指し、書いたものもその 1 匹に入る', () => {
    const w = createWorld('dog', 1, VIEW);
    expect(w.heroes).toHaveLength(1);
    expect(w.cur).toBe(0);
    expect(w.player).toBe(w.heroes[0].player);
    w.weapons = [];
    expect(w.heroes[0].weapons).toEqual([]);
    w.pending = 2;
    expect(w.heroes[0].pending).toBe(2);
  });

  it('2 匹めは自分の動物・能力・武器を持ち、cur を変えると読み口がそちらを指す', () => {
    const w = createWorld('dog', 1, VIEW);
    const i = addHero(w, 'cat', { might: 3 });
    expect(i).toBe(1);
    w.cur = 1;
    expect(w.animal.id).toBe('cat');
    expect(w.weapons[0].id).toBe(w.heroes[1].animal.weapon);
    expect(w.player).not.toBe(w.heroes[0].player);
    expect(w.stats.might).toBeGreaterThan(w.heroes[0].stats.might);
    w.cur = 0;
    expect(w.animal.id).toBe('dog');
  });
});
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/heroes.test.ts`
Expected: FAIL（`addHero` が無い、`w.heroes` が undefined）

- [ ] **Step 3: `heroes.ts` を作る**

```ts
import type { World } from './world';

/** 自分の動物にかかわる World の項目。2 匹で遊ぶときは 1 匹ずつ持つ */
export const HERO_KEYS = [/* 上の 20 項目 */] as const;
export type HeroKey = (typeof HERO_KEYS)[number];
export type Hero = Pick<World, HeroKey> & { down: boolean };

/**
 * 今の読み口（w.player・w.weapons など 270 か所ほど）を書き換えずに 2 匹にするため、
 * 項目を w.heroes[w.cur] への読み書きにする。動物ごとの処理は cur を切り替えて回す
 */
export function bindHeroes(w: World): void {
  for (const k of HERO_KEYS)
    Object.defineProperty(w, k, {
      get: () => w.heroes[w.cur][k],
      set: (v) => ((w.heroes[w.cur] as Record<HeroKey, unknown>)[k] = v),
      enumerable: true,
      configurable: true
    });
}
```

- [ ] **Step 4: `world.ts` を直す**
  - `World` に `heroes: Hero[];` と `cur: number;` を足す（`HERO_KEYS` の項目の宣言は残す）。
  - `createWorld` の中で、動物・能力・装備・道具・`player`・`weapons`・`passives`・`dealt`・`evolvedNow`・`drainLeft`・`pending` を作っている部分を `makeHero` に移す。`makeHero` は `down: false` を付けて返す。
  - `createWorld` は残りの項目と `heroes: [makeHero(id, ranks, mods, gear)]`・`cur: 0` で `w` を作り（型は `as World` で通す）、`bindHeroes(w)` を呼んでから、今と同じく `challenge.card` を `takeArcana` する。
  - `addHero(w, id, ranks = {}, gear = [])` は `w.heroes.push(makeHero(id, ranks, w.mods, gear))` して番号を返す。2 匹めの `player` は 1 匹めの 24 ドット右に置く。

- [ ] **Step 5: 新しいテストと今のテスト全部が通るのを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS（今の 900 件ほどと新しい 2 件）

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/animal-survivors/heroes.ts src/lib/games/animal-survivors/heroes.test.ts src/lib/games/animal-survivors/world.ts
git commit -m "Bundle each Animal Survivors hero and point the old fields at the current one"
```

### Task 2: 2 匹で `step` を回す

**Files:**

- Modify: `heroes.ts`（下の助け関数）
- Modify: `world.ts`（`step`・`moveEnemy` の呼び方・`touch`・`hurtPlayer`・`ZONE_HIT`）
- Modify: `arms.ts`（`fire`・`hits`・`strike`・`flameTurn` の武器の引き方）
- Modify: `zones.ts`（`updateZones` の武器の引き方）
- Modify: `drops.ts`（`collect`・`gainXp`・`grow`）
- Modify: `bosses.ts`・`bosses-snow.ts`・`eruption.ts`（自分に当てる 5 か所）
- Modify: `draw-arms.ts`（`isGold`・`kindOf`）
- Test: `src/lib/games/animal-survivors/coop-world.test.ts`

**Interfaces:**

- Consumes: Task 1 の `Hero`・`bindHeroes`・`addHero`・`World.cur`
- Produces（`heroes.ts`）
  - `HERO_SLOTS = 6`、`MAX_HEROES = 2`
  - `heroOf(slot: number): number`（`Math.floor(slot / HERO_SLOTS)`）
  - `weaponAt(w: World, slot: number): (Owned & { cd: number }) | undefined`
  - `nearestHero(w: World, x: number, y: number): number`（倒れていない中でいちばん近い番号。全員倒れていれば 0）
  - `eachHero(w: World, fn: (i: number) => void): void`（倒れていない動物ごとに `cur` を切り替えて呼び、最後に元の `cur` に戻す）
  - `anyPending(w: World): boolean`

決まりは次のとおり。

- 武器の枠の番号（`Shot.slot`・`Effect.slot`・ゾーンの `slot`）は、動物をまたいで重ならない通しの番号 `cur * HERO_SLOTS + 枠` にする。`world.ts` の `ZONE_HIT` は `HERO_SLOTS * MAX_HEROES`（12）にし、`Enemy.hit` の長さは今と同じ `ZONE_HIT * 2`。
- `w.weapons[slot]` で武器を引いている 5 か所（`arms.ts:179`・`arms.ts:429`・`zones.ts:88`・`draw-arms.ts:14`・`draw-arms.ts:15`）は `weaponAt(w, slot)` にする。
- `step` の止まる条件の `w.pending > 0` は `anyPending(w)` にする。
- `step` の自分の動きは今どおり `heroes[0]` だけを `input` で動かす。2 匹め以降の位置は外から書く（Task 5）。
- 無敵・被弾・攻撃の格好・遅さの時計、回復、`drainLeft` の戻りは `eachHero` で 1 匹ずつ進める。
- 敵を動かす前に `w.cur = nearestHero(w, e.x, e.y)` にし、遠くの敵の置き直しとランタンを消す距離も、その近いほうの動物から測る。敵のループのあとで `w.cur = 0` に戻す（ボスの動きは `w.player` を見るので、これで近いほうを狙う）。
- ふつうの敵が出る位置は、倒れていない動物を順番に回して決める（`step` の出現のループで、1 体ごとに `cur` を次の動物にしてから `spawn` を呼び、ループのあとで 0 に戻す）。ボス・ヌシ・出来事は 1 匹めのまわりのまま。
- `touch(w)` は `eachHero(w, () => touch(w))` にする。ボスと溶岩が自分に当たる 5 か所（`bosses.ts:277,305,334`・`bosses-snow.ts:180`・`eruption.ts:85`）は、当たりを確かめる部分を `eachHero` で包む。
- `fire(w, dt)` は `eachHero(w, () => fire(w, dt))` にし、`fire` の中で `launch` に渡す枠を `slot + w.cur * HERO_SLOTS` にする。
- `hits` の弾・効果のループと `updateZones` のループは、1 つずつ `w.cur = heroOf(o.slot)` にしてから処理し、ループのあとで 0 に戻す（ダメージ表・吸血の回復・回る羽根の中心が持ち主になる）。
- `collect` は、玉と品の 1 つずつで `w.cur = nearestHero(w, g.x, g.y)` にしてから吸い寄せと拾いを確かめ、最後に 0 に戻す。経験値は `w.xp` に入るので共通。
- `gainXp` のレベルアップは全員の `pending` を 1 ずつ増やし、育つ Lv（`GROW_AT - fx.grow`）は `eachHero` で 1 匹ずつ見る。
- `hurtPlayer` で HP が尽きたとき、動物が 2 匹以上なら、店の復活・よみがえりなど今の起き上がりを全部見たあとで `down = true`・`hp = 0` にし、全員が倒れたときだけ `w.over = 'dead'` にする。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// coop-world.test.ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { addHero, createWorld, hurtPlayer, makeEnemy, step } from './world';

const VIEW = { w: 260, h: 380 };
const still = { x: 0, y: 0 };

function two() {
  const w = createWorld('dog', 5, VIEW);
  addHero(w, 'dog');
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  w.heroes[0].player.x = 0;
  w.heroes[1].player.x = 200;
  for (const h of w.heroes) h.stats.crit = 0;
  return w;
}

describe('2 匹の World', () => {
  it('敵は近いほうの動物を追い、step のあとは cur が 0 に戻る', () => {
    const w = two();
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 170, 0, 1000));
    step(w, still, 1 / 60);
    expect(w.enemies[0].x).toBeGreaterThan(170);
    expect(w.cur).toBe(0);
  });

  it('2 匹が同じ武器でも、同じ敵にそれぞれ当たる', () => {
    const w = two();
    w.heroes[1].player.x = 20;
    w.enemies.push(makeEnemy({ ...ENEMIES.caterpillar, speed: 0, heavy: 1 }, 10, 40, 1000));
    for (let i = 0; i < 60; i++) step(w, still, 1 / 60);
    expect(Object.keys(w.heroes[0].dealt)).not.toHaveLength(0);
    expect(Object.keys(w.heroes[1].dealt)).not.toHaveLength(0);
  });

  it('経験値は共通で、レベルが上がると 2 匹ともに 3 択が 1 つたまる', () => {
    const w = two();
    w.gems.push({ alive: true, x: 0, y: 0, value: 999, pulled: true } as never);
    step(w, still, 1 / 60);
    expect(w.level).toBeGreaterThan(1);
    expect(w.heroes[0].pending).toBeGreaterThan(0);
    expect(w.heroes[1].pending).toBe(w.heroes[0].pending);
  });

  it('1 匹が倒れても続き、倒れた子は撃たず追われず、2 匹とも倒れたら終わる', () => {
    const w = two();
    w.cur = 1;
    w.heroes[1].revives = 0;
    w.heroes[1].rebirths = 0;
    hurtPlayer(w, 99999);
    w.cur = 0;
    expect(w.heroes[1].down).toBe(true);
    expect(w.over).toBeNull();
    w.enemies.push(makeEnemy(ENEMIES.caterpillar, 190, 0, 1000));
    step(w, still, 1 / 60);
    expect(w.enemies[0].x).toBeLessThan(190);
    w.heroes[0].revives = 0;
    w.heroes[0].rebirths = 0;
    hurtPlayer(w, 99999);
    expect(w.over).toBe('dead');
  });
});
```

`gems` の要素の形は `drops.ts` の `Gem` に合わせて直してよい（`as never` を外して正しい形にする）。

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop-world.test.ts`
Expected: FAIL（2 匹めの敵・当たり・pending・down が上の決まりどおりでない）

- [ ] **Step 3: `heroes.ts` に助け関数を足し、上の決まりどおりに各ファイルを直す**

```ts
export const HERO_SLOTS = 6;
export const MAX_HEROES = 2;
export const heroOf = (slot: number) => Math.floor(slot / HERO_SLOTS);
export const weaponAt = (w: World, slot: number) => w.heroes[heroOf(slot)]?.weapons[slot % HERO_SLOTS];
export const anyPending = (w: World) => w.heroes.some((h) => h.pending > 0);

export function nearestHero(w: World, x: number, y: number): number {
  let best = 0;
  let bd = Infinity;
  w.heroes.forEach((h, i) => {
    if (h.down) return;
    const d = (h.player.x - x) ** 2 + (h.player.y - y) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

export function eachHero(w: World, fn: (i: number) => void): void {
  const was = w.cur;
  try {
    w.heroes.forEach((h, i) => {
      if (h.down) return;
      w.cur = i;
      fn(i);
    });
  } finally {
    w.cur = was;
  }
}
```

`choices.ts` の `SLOTS`（6）と `HERO_SLOTS` が同じ数であることは、`coop-world.test.ts` に 1 行のテストで固める。

- [ ] **Step 4: 新しいテストと今のテスト全部が通るのを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/games/animal-survivors
git commit -m "Run Animal Survivors with two heroes: nearest chase, per-hero weapons, shared XP and downs"
```

### Task 3: 自分でない動物も描く

**Files:**

- Modify: `src/lib/games/animal-survivors/draw.ts`（`draw` の中で `player(ctx, w, now)` を呼ぶところ）

**Interfaces:**

- Consumes: `World.heroes`・`World.cur`

`draw` は今どおり `w.player`（`cur` の動物）にカメラを合わせる。描く順は `draw.ts` に足す `heroOrder(w): number[]`（`cur` でない動物を先に、`cur` を最後に）で決め、`draw` は `player(ctx, w, now)` を呼ぶところで、その順に `w.cur` を切り替えて描き、最後に元の `cur` に戻す。倒れた動物は `ctx.globalAlpha = 0.5` で描く。

- [ ] **Step 1: 失敗するテストを書く**（`draw.test.ts` に足す）

```ts
it('自分でない動物を先に、自分を最後に描く', () => {
  const w = createWorld('dog', 1, { w: 260, h: 380 });
  expect(heroOrder(w)).toEqual([0]);
  addHero(w, 'cat');
  expect(heroOrder(w)).toEqual([1, 0]);
  w.cur = 1;
  expect(heroOrder(w)).toEqual([0, 1]);
});
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/draw.test.ts`
Expected: FAIL

- [ ] **Step 3: 直す**（上の説明どおり）
- [ ] **Step 4: 通るのを確かめる**（同じコマンドで PASS）
- [ ] **Step 5: Commit**

```bash
git add src/lib/games/animal-survivors/draw.ts src/lib/games/animal-survivors/draw.test.ts
git commit -m "Draw the other Animal Survivors hero too"
```

### Task 4: 様子（`snap`）を作って読む

**Files:**

- Create: `src/lib/games/animal-survivors/snap.ts`
- Test: `src/lib/games/animal-survivors/snap.test.ts`

**Interfaces:**

- Consumes: `World`・`Hero`・`ENEMIES`・`eliteOf`・`chiefOf`
- Produces
  - `COOP_VERSION = 1`
  - `type Snap`（JSON にできる形）
  - `makeSnap(w: World, events: GameEvent[]): Snap`
  - `applySnap(view: World, s: Snap): void`（子の端末の描くための `World` に書き込む。`view.cur` の動物の位置は書かない）
  - `lerpSnap(view: World, a: Snap, b: Snap, t: number): void`（`a` を書いたあと、敵・弾・ほかの動物の位置を `b` へ `t` だけ寄せる）

`Snap` の中身は次のとおり。配列は生きているものだけを、決まった順の数の列にする（項目の名前を毎回送らないため）。数は小数 1 けたに丸める。

| 項目              | 列の中身                                                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`               | `time`・`level`・`xp`・`kills`・`coins`・`freeze`・`festival`                                                                                                                          |
| `heroes`          | 動物ごとに `animal.id`・`form`・`x`・`y`・`hp`・`stats.maxHp`・`stats.speed`・`facing`・`moving`・`invuln`・`hurt`・`attack`・`down`・武器の `[id, level]` の並び・`pending`           |
| `enemies`         | `def.id`・強化個体か（1）ヌシか（2）ふつう（0）・`x`・`y`・`t`・`flash`・`state`・`wait`・`dx`・`dy`・`hp`・`maxHp`（ボスの札に使う）。`draw.ts` の `enemies` が読む項目をすべて入れる |
| `shots`           | `kind`・`slot`・`x`・`y`・`vx`・`vy`・`angle`・`r`・`age`・`life`                                                                                                                      |
| `effects`         | `kind`・`slot`・`x`・`y`・`r`・`age`・`life`・`angle`                                                                                                                                  |
| `gems`・`items`   | 玉は `x`・`y`・`value`、品は `kind`・`x`・`y`・`tier`・`life`                                                                                                                          |
| `hazards`・`lava` | `draw-boss.ts`・`draw-volcano.ts` が読む項目                                                                                                                                           |
| `events`          | 前の `snap` からの `GameEvent`（`fx.take` に渡す。`kill`・`hurt`・`pickup`・`coin`・`heal` など）                                                                                      |

列に入れる項目は、実装のときに `draw.ts`・`draw-arms.ts`・`draw-boss.ts`・`draw-volcano.ts`・`draw-events.ts`・`hud.ts` が読む項目を grep で洗い出して決める。描くのに要る項目が欠けていれば、その描き方の部分で絵が出ない。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// snap.test.ts
import { describe, expect, it } from 'vitest';
import { ENEMIES } from './enemies';
import { applySnap, makeSnap } from './snap';
import { addHero, chiefOf, createWorld, eliteOf, makeEnemy } from './world';

const VIEW = { w: 260, h: 380 };

describe('snap', () => {
  it('読んだ側の敵・弾・玉・ほかの動物が、親と同じ位置と種類になる', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.enemies.push(
      makeEnemy(ENEMIES.caterpillar, 10, 20, 50),
      makeEnemy(eliteOf(ENEMIES.caterpillar), 30, 40, 50),
      makeEnemy(chiefOf(ENEMIES.caterpillar), -5, 7, 50)
    );
    w.heroes[0].player.x = 12.34;
    const s = JSON.parse(JSON.stringify(makeSnap(w, [])));
    const view = createWorld('cat', 2, VIEW);
    addHero(view, 'dog');
    view.cur = 1;
    applySnap(view, s);
    const alive = view.enemies.filter((e) => e.alive);
    expect(alive.map((e) => [e.x, e.y, !!e.def.elite, !!e.def.chief])).toEqual([
      [10, 20, false, false],
      [30, 40, true, false],
      [-5, 7, false, true]
    ]);
    expect(view.heroes[0].player.x).toBeCloseTo(12.3);
    expect(view.heroes[0].animal.id).toBe('dog');
  });

  it('自分の動物の位置は書き換えない（自分の端末で動かしている）', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.heroes[1].player.x = 500;
    const view = createWorld('cat', 2, VIEW);
    addHero(view, 'dog');
    view.cur = 1;
    view.heroes[1].player.x = 7;
    applySnap(view, makeSnap(w, []));
    expect(view.heroes[1].player.x).toBe(7);
  });

  it('いちばん多いときでも 1 回 25KB に収まる', () => {
    const w = createWorld('dog', 1, VIEW);
    for (let i = 0; i < 400; i++) w.enemies.push(makeEnemy(ENEMIES.caterpillar, i * 1.37, i * 2.11, 50));
    for (let i = 0; i < 400; i++) w.gems.push({ alive: true, x: i, y: -i, value: 1, pulled: false } as never);
    expect(JSON.stringify(makeSnap(w, [])).length).toBeLessThan(25_000);
  });
});
```

`gems` の形は Task 2 で合わせた `Gem` の形にする。

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/snap.test.ts`
Expected: FAIL（`./snap` が無い）

- [ ] **Step 3: `snap.ts` を書く**

`applySnap` は、`view` の配列を `snap` の数で作り直さず、今ある要素を使い回して足りないぶんだけ足し、残りは `alive = false` にする（毎回 400 個を作り直すと iPad で重い）。敵の `def` は `def.id` と種類の数から引き、`eliteOf`・`chiefOf` の結果は `def.id` ごとに控える。知らない `def.id` は飛ばす。`view.heroes` の数が `snap` より少なければ `addHero` で足す。

- [ ] **Step 4: 通るのを確かめる**（同じコマンドで PASS）
- [ ] **Step 5: Commit**

```bash
git add src/lib/games/animal-survivors/snap.ts src/lib/games/animal-survivors/snap.test.ts
git commit -m "Pack and unpack the Animal Survivors co-op snapshot"
```

### Task 5: 親と子のつなぎ（`coop.ts`）

**Files:**

- Create: `src/lib/games/animal-survivors/coop.ts`
- Test: `src/lib/games/animal-survivors/coop.test.ts`

**Interfaces:**

- Consumes: `Party`（`act`・`onAct`・`tell`・`onTell`）、Task 4 の `makeSnap`・`applySnap`・`lerpSnap`・`COOP_VERSION`、Task 2 の `addHero`・`anyPending`、`choices`・`apply`（`choices.ts`）
- Produces
  - `class CoopHost`
    - `constructor(party: Party, w: World)`
    - `ready: boolean`（子の `hi` が届いて 2 匹めがいる）
    - `before(): void`（`step` の前に呼ぶ。届いた子の位置を `heroes[1].player` に書き、子の 3 択を自動で選ぶ）
    - `after(dt: number): void`（`step` のあとに呼ぶ。出来事をためて、50ms ごとに `snap` を送る）
    - `start(): void`（`start` を送る）
  - `class CoopGuest`
    - `constructor(party: Party, me: { animal: AnimalId; ranks: Ranks; gear: GearKey[] })`
    - `view: World | null`（`start` が届いたら作る）
    - `move(input: { x: number; y: number }, dt: number): void`（自分の動物を動かし、30 回 / 秒まで位置を送る）
    - `frame(now: number): void`（届いた `snap` を 100ms 遅らせて `lerpSnap` で描く用意をする）
    - `mismatch: boolean`
  - 知らせの形

| 向き    | `t`        | 中身                                                   |
| ------- | ---------- | ------------------------------------------------------ |
| 子 → 親 | `hi`       | `v`（`COOP_VERSION`）・`animal`・`ranks`・`gear`       |
| 親 → 子 | `start`    | `seed`・`stage`・`animal`（親の動物）・`ranks`・`gear` |
| 子 → 親 | `move`     | `x`・`y`・`facing`・`aimX`・`aimY`・`moving`           |
| 親 → 子 | `snap`     | Task 4 の `Snap`                                       |
| 親 → 子 | `mismatch` | なし                                                   |

子の 3 択は、親の `before` が `heroes[1].pending` の数だけ `cur = 1` で `choices(w)` の 1 つめを `apply` し、`cur` を 0 に戻す（試作だけの決まり）。

子の `move` は、自分の `view.heroes[view.cur]` の位置を `BASE_SPEED * speed` で動かす（`speed` は `snap` で届いた自分の `stats.speed`）。親の端末では、受け取った位置をそのまま使う。

- [ ] **Step 1: 失敗するテストを書く**

手元でつなぐ管は、`src/lib/net/party.svelte.test.ts` の `pipes()`（2 本の `Pipe` を返し、送ったものを JSON にして相手へ渡す）と `settle()` を `coop.test.ts` に写して使う。`pair()` は `const [a, b] = pipes(); const host = Party.host(); const guest = Party.guest(b); await host.add(a);` で 2 つの `Party` を返す。

```ts
const VIEW = { w: 260, h: 380 };

it('子の hi で 2 匹めが入り、子の位置が親の World に届き、snap で子の画面に敵が出る', async () => {
  const { host, guest } = await pair();
  const w = createWorld('dog', 1, VIEW);
  w.stage = { ...w.stage, waves: [] };
  const h = new CoopHost(host, w);
  const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
  await settle();
  expect(h.ready).toBe(true);
  h.start();
  await settle();
  expect(g.view?.heroes).toHaveLength(2);
  w.enemies.push(makeEnemy(ENEMIES.caterpillar, 40, 0, 50));
  g.move({ x: 1, y: 0 }, 0.5);
  await settle();
  h.before();
  step(w, { x: 0, y: 0 }, 1 / 60);
  h.after(0.06);
  await settle();
  expect(w.heroes[1].player.x).toBeGreaterThan(20);
  g.frame(performance.now() + 1000);
  expect(g.view!.enemies.some((e) => e.alive)).toBe(true);
});

it('版がちがう子には mismatch を返して 2 匹めを入れない', async () => {
  const { host, guest } = await pair();
  const w = createWorld('dog', 1, VIEW);
  const h = new CoopHost(host, w);
  const told: string[] = [];
  guest.onTell((m) => told.push(m.t));
  guest.act({ t: 'hi', v: 0, animal: 'cat', ranks: {}, gear: [] });
  await settle();
  expect(h.ready).toBe(false);
  expect(w.heroes).toHaveLength(1);
  expect(told).toContain('mismatch');
});

it('snap が届く前の子の画面でも frame が投げない', async () => {
  const { host, guest } = await pair();
  const h = new CoopHost(host, createWorld('dog', 1, VIEW));
  const g = new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
  await settle();
  h.start();
  await settle();
  expect(() => g.frame(performance.now())).not.toThrow();
});

it('子の 3 択は親が自動で選び、pending が残らず、cur が 0 に戻る', async () => {
  const { host, guest } = await pair();
  const w = createWorld('dog', 1, VIEW);
  const h = new CoopHost(host, w);
  new CoopGuest(guest, { animal: 'cat', ranks: {}, gear: [] });
  await settle();
  w.heroes[1].pending = 2;
  const owned = w.heroes[1].weapons.length + w.heroes[1].passives.length;
  h.before();
  expect(w.heroes[1].pending).toBe(0);
  expect(w.heroes[1].weapons.length + w.heroes[1].passives.length).toBeGreaterThan(owned);
  expect(w.cur).toBe(0);
});
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop.test.ts`
Expected: FAIL（`./coop` が無い）

- [ ] **Step 3: `coop.ts` を書く**
- [ ] **Step 4: 通るのを確かめる**（同じコマンドで PASS）
- [ ] **Step 5: Commit**

```bash
git add src/lib/games/animal-survivors/coop.ts src/lib/games/animal-survivors/coop.test.ts
git commit -m "Connect the Animal Survivors host and guest over the party link"
```

### Task 6: 「ふたりで遊ぶ」の画面

**Files:**

- Create: `src/lib/games/animal-survivors/CoopRoom.svelte`（QR でつなぎ、子が入るのを待ち、親の「はじめる」で始める）
- Create: `src/lib/games/animal-survivors/CoopPlay.svelte`（親と子の遊ぶ画面。キャンバス・スティック・ループ）
- Modify: `MenuLinks.svelte`（「ふたりで遊ぶ」を足す。`data-menu="coop"`）、`CharSelect.svelte` と `Survivors.svelte`（`'coop'` の画面）
- Test: `src/lib/games/animal-survivors/coop-room.svelte.test.ts`

**Interfaces:**

- Consumes: `Handshake.svelte`（`role`・`onlink`・`onfail`）、`Party.host()`・`Party.guest(link)`・`party.add(link)`、Task 5 の `CoopHost`・`CoopGuest`
- Produces: `CoopRoom.svelte` の props `{ records: Records; onback: () => void }`

画面の流れは次のとおり。

1. 「なかまを よぶ」「なかまに はいる」の 2 つのボタン（おえかきのもりの `Lobby.svelte` と同じ言い方）。押すと `Handshake` を出す。
2. 親は子が入ると「はじめる」を出す。子は「親が はじめるのを まっています」を出す。動物は、どちらもキャラ選択で選んでいた子（記録の `animal`）で遊ぶ。ステージは森、釜は 2.0、アルカナなし。
3. 親の「はじめる」で `CoopHost.start()` を呼び、2 人とも `CoopPlay` に進む。
4. `CoopPlay` は `Play.svelte` と同じく `BoardInput`・`Stick`・`animate` を使う。親は `before` → `step` → `after` → `draw` と `Prompts`（自分の 3 択）を回す。子は `move` → `frame` → `draw(view)` を回し、`anyPending(view)` か `view` が無いあいだは「まっています」の帯を出す。
5. 試作では、終わったら（`over`）2 人とも「おわり」と「もどる」を出し、記録には入れない。

- [ ] **Step 1: 失敗するテストを書く**

```ts
it('メニューのふたりで遊ぶから開き、よぶとはいるを出す', () => {
  const opened: string[] = [];
  const target = document.body.appendChild(document.createElement('div'));
  const menu = mount(CharSelect, {
    target,
    props: { records: emptyRecords(), onpick: () => {}, onquit: () => {}, onopen: (s: string) => opened.push(s) }
  });
  flushSync();
  (target.querySelector('[data-menu="coop"]') as HTMLButtonElement).click();
  expect(opened).toEqual(['coop']);
  unmount(menu);
  const room = mount(CoopRoom, { target, props: { records: emptyRecords(), onback: () => {} } });
  flushSync();
  const labels = [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
  expect(labels).toContain('なかまを よぶ');
  expect(labels).toContain('なかまに はいる');
  unmount(room);
});
```

`$lib/audio.svelte` は、`gacharoom.svelte.test.ts` と同じく `vi.mock` で差し替える。

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop-room.svelte.test.ts`
Expected: FAIL

- [ ] **Step 3: 画面を作る**
- [ ] **Step 4: 通るのを確かめる**（同じコマンドで PASS。`pnpm verify` も通す）
- [ ] **Step 5: Commit**

```bash
git add -A src/lib/games/animal-survivors
git commit -m "Add the Animal Survivors co-op room and play screen"
```

### Task 7: 2 ページで通して確かめる

**Files:**

- Create（リポジトリの外）: scratchpad の `coop-play.mjs`

**Interfaces:**

- Consumes: 開発サーバー `http://localhost:5173/asobibako/games/animal-survivors`、おえかきのもりで使った 2 ページと偽カメラの形（scratchpad の `net-play.mjs`）

- [ ] **Step 1:** headless Chrome の同じ context に 2 ページを開き、偽カメラで QR を渡してつなぐ。片方で「なかまを よぶ」、もう片方で「なかまに はいる」。
- [ ] **Step 2:** 親で「はじめる」を押し、30 秒遊ばせる。両方のページでスティックを動かし、親の World で 2 匹の位置が動くこと、子のページで敵・玉・相棒が描かれていることを、両方の画面を撮って確かめる。
- [ ] **Step 3:** 子のページで `snap` の大きさの平均と最大、届く間隔、`JSON.parse` にかかった時間を測って書き出す（1 回 25KB 未満、間隔 50ms 前後を目安にする）。
- [ ] **Step 4:** 結果と画像を見て、描かれていないもの・ずれているものがあれば直し、Task 4〜6 のテストに足してから直す。
- [ ] **Step 5:** CLAUDE.md のアニマルサバイバーの段落に、協力プレイの形（`Hero` と `cur`、`snap`、`coop.ts`、試作の範囲）を足し、`pnpm verify` を通して commit する。

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors co-op prototype"
```
