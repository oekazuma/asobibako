# アニマルサバイバー 地形の障害物 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 4 ステージに、自分とふつうの敵が通れない障害物を位置のハッシュで置き、描く。

**Architecture:** DOM を使わない `obstacles.ts` が区画（160 ドット）ごとの障害物と、丸を外へ押し出す `pushOut()` を持つ。World は自分の移動のあと・敵の押し合いのあと・出る位置と落ちる品を決めるときに `pushOut()` を呼ぶ。描くのは `draw.ts` で、自分より奥の障害物は敵より先に、手前の障害物は自分のあとに描く。

**Tech Stack:** TypeScript、vitest、canvas 2D、playwright（画面の確かめ）

**Spec:** `docs/superpowers/specs/2026-10-05-animal-survivors-obstacles-design.md`

## Global Constraints

- 置くステージは今の 4 ステージ（森・夜の墓地・雪山・火山）。新しいステージは足さない
- 置き方は位置から決まるハッシュで、毎回同じ場所（協力プレイでも 2 台で同じ）
- 160 ドットごとの区画に、およそ 4 区画に 1 つ。始めの位置のまわり（半径 80 ドット）には置かない
- 通れないのは自分とふつうの敵（ヌシを含む）。弾・炎・輪などの武器、ボス、群れ（`drift`）、きらきらハリネズミ、ランタン、大ヘビの体の節は通り抜ける
- 吹雪で流されても障害物の中には入らない
- 経験値の玉・落ちた品・宝箱・ランタン・宝の地図の宝箱・敵が出る位置は、中に来たら外へずらす
- 障害物と重なる飾りは描かない
- 絵は利用者が見本で承認した 8 枚（`scratchpad/obs/gen.mjs` の形）をそのまま使う
- コードコメントは非自明な WHY だけ（`~/.claude/CLAUDE.md`）。コンポーネントは 200 行未満
- 大群の中で点滅を使わない（湯気の 2 コマは点滅ではなく形の入れ替え）

## Review Focus

- 敵の群れが障害物に押しつけられたとき、押し合い（`separate`）で中へ押し込まれて毎フレーム出入りしてガタつかない（押し出しを `separate` のあとに 1 回だけ置く。Task 2 のテスト）
- 2 つの障害物のすき間に自分が挟まって動けなくならない（隣の区画どうしの障害物の外側の間は自分の直径より広い。Task 1 のテスト）
- 協力プレイの子の端末で、子の動物が障害物の中へ入ってから親に戻される見え方にならない（子の `move` でも押し出す。Task 3 のテスト）
- ボスの宝箱や玉が障害物の中に落ちて拾えない（Task 2 のテスト）
- 宝の地図の宝箱が障害物の中に置かれて 30 秒で拾えない（Task 2 のテスト）

---

## ファイルの分け方

| ファイル                                                       | 役目                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/lib/games/animal-survivors/obstacles.ts`（新）            | 区画のハッシュ・障害物の種類と当たりの丸・`obstacleAt` / `obstaclesNear` / `pushOut`。`hash` を `draw.ts` から移す |
| `src/lib/games/animal-survivors/obstacles.test.ts`（新）       | 置き方と押し出しの単体テスト                                                                                       |
| `src/lib/games/animal-survivors/obstacles-world.test.ts`（新） | World に入れたときのテスト                                                                                         |
| `src/lib/games/animal-survivors/world.ts`                      | 自分・敵・出る位置の押し出し                                                                                       |
| `src/lib/games/animal-survivors/drops.ts`                      | 玉と品の落ちる位置の押し出し                                                                                       |
| `src/lib/games/animal-survivors/events.ts`                     | 宝の地図の宝箱の位置の押し出し                                                                                     |
| `src/lib/games/animal-survivors/coop.ts`                       | 子の端末の `move` の押し出し                                                                                       |
| `src/lib/games/animal-survivors/art/obstacles.ts`（新）        | 8 枚の絵（見本の格子をそのまま）                                                                                   |
| `src/lib/games/animal-survivors/draw-obstacles.ts`（新）       | 障害物を奥と手前に分けて描く                                                                                       |
| `src/lib/games/animal-survivors/draw.ts`                       | `hash` を obstacles から読み直す・飾りを飛ばす・描く順に入れる                                                     |
| `src/lib/games/animal-survivors/pixels.test.ts`                | 新しい絵を検査に足す                                                                                               |
| `CLAUDE.md`                                                    | アニマルサバイバーの段落に障害物の 1〜2 文                                                                         |

---

### Task 1: obstacles.ts（置き方と押し出し）

**Files:**

- Create: `src/lib/games/animal-survivors/obstacles.ts`
- Create: `src/lib/games/animal-survivors/obstacles.test.ts`
- Modify: `src/lib/games/animal-survivors/draw.ts:67-72`（`hash` を移して読み直す）

**Interfaces:**

- Produces。
  - `type Ground = 'forest' | 'graveyard' | 'snow' | 'volcano'`（`Stage['art']` と同じ）
  - `type ObstacleId = 'boulder' | 'log' | 'bigTomb' | 'fence' | 'icy' | 'snowTree' | 'lavaRock' | 'steamRock'`
  - `interface Obstacle { x: number; y: number; kind: ObstacleId }`（x, y は足もとの真ん中）
  - `const SHAPES: Record<ObstacleId, { circles: readonly (readonly [dx: number, dy: number, r: number])[]; foot: number }>`（foot は絵の下の端を y から何ドット下に置くか）
  - `const CELL = 160`、`const PLAYER_R = 6`
  - `function hash(x: number, y: number): number`（`draw.ts` から移す。`draw.ts` は `export { hash } from './obstacles'` で今の読み口を残す）
  - `function obstacleAt(g: Ground, cx: number, cy: number): Obstacle | null`
  - `function obstaclesNear(g: Ground, x: number, y: number, r: number, out: Obstacle[]): Obstacle[]`（丸 (x, y, r) に当たりの丸がかかる障害物）
  - `function pushOut(g: Ground, o: { x: number; y: number }, r: number): void`

- [ ] **Step 1: 失敗するテストを書く**

`obstacles.test.ts`。

```ts
import { describe, expect, it } from 'vitest';
import { CELL, obstacleAt, obstaclesNear, PLAYER_R, pushOut, SHAPES, type Ground, type Obstacle } from './obstacles';

const GROUNDS: Ground[] = ['forest', 'graveyard', 'snow', 'volcano'];
const inside = (g: Ground, x: number, y: number, r: number) =>
  obstaclesNear(g, x, y, r, []).some((o) =>
    SHAPES[o.kind].circles.some(([dx, dy, cr]) => Math.hypot(x - o.x - dx, y - o.y - dy) < r + cr - 0.01)
  );

describe('障害物の置き方', () => {
  it('同じ区画は何度聞いても同じ障害物', () => {
    for (const g of GROUNDS)
      for (let c = -5; c <= 5; c++) expect(obstacleAt(g, c, c * 2)).toEqual(obstacleAt(g, c, c * 2));
  });

  it('始めの位置から 80 ドットの中には当たりの丸がかからない', () => {
    for (const g of GROUNDS) expect(obstaclesNear(g, 0, 0, 80, [])).toEqual([]);
  });

  it('およそ 4 区画に 1 つ（40 × 40 区画で 18〜32%）', () => {
    for (const g of GROUNDS) {
      let n = 0;
      for (let cx = -20; cx < 20; cx++) for (let cy = -20; cy < 20; cy++) if (obstacleAt(g, cx, cy)) n++;
      expect(n / 1600).toBeGreaterThan(0.18);
      expect(n / 1600).toBeLessThan(0.32);
    }
  });

  it('ステージごとに 2 種類が出て、ほかのステージの種類は出ない', () => {
    const want: Record<Ground, string[]> = {
      forest: ['boulder', 'log'],
      graveyard: ['bigTomb', 'fence'],
      snow: ['icy', 'snowTree'],
      volcano: ['lavaRock', 'steamRock']
    };
    for (const g of GROUNDS) {
      const seen = new Set<string>();
      for (let cx = -20; cx < 20; cx++) for (let cy = -20; cy < 20; cy++) seen.add(obstacleAt(g, cx, cy)?.kind ?? '');
      seen.delete('');
      expect([...seen].sort()).toEqual([...want[g]].sort());
    }
  });

  it('隣どうしの障害物のあいだは、自分が通れる（自分の直径より広い）', () => {
    for (const g of GROUNDS) {
      const all: Obstacle[] = [];
      for (let cx = -15; cx < 15; cx++)
        for (let cy = -15; cy < 15; cy++) {
          const o = obstacleAt(g, cx, cy);
          if (o) all.push(o);
        }
      for (const a of all)
        for (const b of all) {
          if (a === b) continue;
          for (const [ax, ay, ar] of SHAPES[a.kind].circles)
            for (const [bx, by, br] of SHAPES[b.kind].circles)
              expect(Math.hypot(a.x + ax - b.x - bx, a.y + ay - b.y - by) - ar - br).toBeGreaterThan(PLAYER_R * 2);
        }
    }
  });
});

describe('押し出し', () => {
  it('中に置いた丸は当たりの丸の外へ出る', () => {
    for (const g of GROUNDS)
      for (let cx = -6; cx < 6; cx++)
        for (let cy = -6; cy < 6; cy++) {
          const o = obstacleAt(g, cx, cy);
          if (!o) continue;
          for (const [dx, dy] of SHAPES[o.kind].circles) {
            const p = { x: o.x + dx + 0.5, y: o.y + dy + 0.3 };
            pushOut(g, p, PLAYER_R);
            expect(inside(g, p.x, p.y, PLAYER_R)).toBe(false);
          }
        }
  });

  it('外の丸は動かさない', () => {
    const p = { x: 3, y: 4 };
    pushOut('forest', p, PLAYER_R);
    expect(p).toEqual({ x: 3, y: 4 });
  });

  it('斜めにぶつかると、沿って滑って向こうへ抜ける', () => {
    for (const g of GROUNDS) {
      let o: Obstacle | null = null;
      for (let c = 2; !o; c++) o = obstacleAt(g, c, 0);
      const s = SHAPES[o.kind];
      const reach = Math.max(...s.circles.map(([dx, dy, r]) => Math.hypot(dx, dy) + r));
      const p = { x: o.x - reach - 20, y: o.y - 2 };
      for (let i = 0; i < 400; i++) {
        p.x += 1;
        p.y += 0.15;
        pushOut(g, p, PLAYER_R);
      }
      expect(p.x).toBeGreaterThan(o.x + reach);
    }
  });
});

describe('区画の大きさ', () => {
  it('区画は 160 ドット', () => expect(CELL).toBe(160));
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/obstacles.test.ts`
Expected: FAIL（`./obstacles` が無い）

- [ ] **Step 3: 実装する**

`obstacles.ts`。

```ts
/** 地形の障害物。位置のハッシュで決まるので、毎回同じ場所に出て、協力プレイの 2 台でもそろう */

export type Ground = 'forest' | 'graveyard' | 'snow' | 'volcano';
export type ObstacleId = 'boulder' | 'log' | 'bigTomb' | 'fence' | 'icy' | 'snowTree' | 'lavaRock' | 'steamRock';
export interface Obstacle {
  x: number;
  y: number;
  kind: ObstacleId;
}

export const CELL = 160;
const CHANCE = 0.25;
/** 区画の中で置く範囲。隣の区画の障害物とのあいだを自分が通れる広さに保つ */
const EDGE = 40;
const CLEAR = 80;
export const PLAYER_R = 6;

/** 当たりの丸（足もとの真ん中から）と、絵の下の端の位置。横に長い絵は丸を並べて形に合わせる */
export const SHAPES: Record<ObstacleId, { circles: readonly (readonly [number, number, number])[]; foot: number }> = {
  boulder: {
    circles: [
      [-8, 0, 10],
      [5, -1, 14]
    ],
    foot: 8
  },
  log: {
    circles: [
      [-12, 0, 9],
      [0, 0, 9],
      [12, 0, 9]
    ],
    foot: 7
  },
  bigTomb: { circles: [[0, 0, 13]], foot: 6 },
  fence: {
    circles: [
      [-17, 0, 7],
      [-6, 0, 7],
      [6, 0, 7],
      [17, 0, 7]
    ],
    foot: 5
  },
  icy: {
    circles: [
      [-6, 0, 12],
      [7, 0, 11]
    ],
    foot: 6
  },
  snowTree: { circles: [[0, 0, 13]], foot: 6 },
  lavaRock: {
    circles: [
      [-8, 0, 11],
      [8, 0, 11],
      [0, -3, 13]
    ],
    foot: 6
  },
  steamRock: { circles: [[0, 0, 15]], foot: 6 }
};

const KINDS: Record<Ground, readonly [ObstacleId, ObstacleId]> = {
  forest: ['boulder', 'log'],
  graveyard: ['bigTomb', 'fence'],
  snow: ['icy', 'snowTree'],
  volcano: ['lavaRock', 'steamRock']
};

const REACH = Math.max(...Object.values(SHAPES).flatMap((s) => s.circles.map(([dx, dy, r]) => Math.hypot(dx, dy) + r)));

/** 座標から決まる 0..1 */
export function hash(x: number, y: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function obstacleAt(g: Ground, cx: number, cy: number): Obstacle | null {
  // 飾りの並びと重ならないよう、地面と飾りとは別の値でハッシュを取る
  if (hash(cx * 13 + 5, cy * 11 + 7) >= CHANCE) return null;
  const x = cx * CELL + EDGE + hash(cx * 17 + 1, cy * 3 + 9) * (CELL - EDGE * 2);
  const y = cy * CELL + EDGE + hash(cx * 5 + 2, cy * 19 + 4) * (CELL - EDGE * 2);
  if (Math.hypot(x, y) < CLEAR + REACH) return null;
  return { x, y, kind: KINDS[g][hash(cx * 7 + 3, cy * 23 + 1) < 0.5 ? 0 : 1] };
}

export function obstaclesNear(g: Ground, x: number, y: number, r: number, out: Obstacle[]): Obstacle[] {
  out.length = 0;
  for (let cx = Math.floor((x - r - REACH) / CELL); cx <= Math.floor((x + r + REACH) / CELL); cx++)
    for (let cy = Math.floor((y - r - REACH) / CELL); cy <= Math.floor((y + r + REACH) / CELL); cy++) {
      const o = obstacleAt(g, cx, cy);
      if (o && SHAPES[o.kind].circles.some(([dx, dy, cr]) => Math.hypot(x - o.x - dx, y - o.y - dy) < r + cr))
        out.push(o);
    }
  return out;
}

const found: Obstacle[] = [];

/** 丸を障害物の外へ出す。向かう速さだけが消えて沿う速さは残るので、動きながら呼ぶと回り込む */
export function pushOut(g: Ground, o: { x: number; y: number }, r: number): void {
  // 1 つの障害物の丸どうしが重なっているので、1 回では隣の丸の中に残ることがある
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const ob of obstaclesNear(g, o.x, o.y, r, found))
      for (const [dx, dy, cr] of SHAPES[ob.kind].circles) {
        const ex = o.x - ob.x - dx;
        const ey = o.y - ob.y - dy;
        const d = Math.hypot(ex, ey);
        const min = r + cr;
        if (d >= min) continue;
        // 真ん中に重なったときは下へ出す（向きが決まらないので）
        const k = d === 0 ? 0 : min / d;
        o.x = ob.x + dx + (d === 0 ? 0 : ex * k);
        o.y = ob.y + dy + (d === 0 ? min : ey * k);
        moved = true;
      }
    if (!moved) return;
  }
}
```

`draw.ts` の 67〜72 行の `hash` の定義を消し、先頭の import に足す。

```ts
import { hash } from './obstacles';
export { hash };
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/obstacles.test.ts src/lib/games/animal-survivors/draw.test.ts`
Expected: PASS（すき間のテストが落ちたら `EDGE` を 44 まで上げる。上げた値と理由を台帳に書く）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/obstacles.ts src/lib/games/animal-survivors/obstacles.test.ts src/lib/games/animal-survivors/draw.ts
git commit -m "Place Animal Survivors obstacles by position hash and push bodies out of them"
```

---

### Task 2: World に入れる（自分・敵・出る位置・玉と品・宝の地図）

**Files:**

- Modify: `src/lib/games/animal-survivors/world.ts`（`spawnPoint` 457〜466 行、`step` の自分の移動 905〜920 行と `separate(w)` の直後 984 行あたり）
- Modify: `src/lib/games/animal-survivors/drops.ts`（`dropGem` 155 行、`dropItem` 178 行）
- Modify: `src/lib/games/animal-survivors/events.ts`（`startEvent` の宝の地図 22〜38 行）
- Create: `src/lib/games/animal-survivors/obstacles-world.test.ts`

**Interfaces:**

- Consumes: `pushOut`、`obstaclesNear`、`obstacleAt`、`SHAPES`、`PLAYER_R`（Task 1）
- Produces: なし（World の動きだけ変わる）

- [ ] **Step 1: 失敗するテストを書く**

`obstacles-world.test.ts`。

```ts
import { describe, expect, it } from 'vitest';
import { dropGem } from './drops';
import { ENEMIES } from './enemies';
import { startEvent } from './events';
import { obstacleAt, obstaclesNear, PLAYER_R, SHAPES, type Obstacle } from './obstacles';
import { createWorld, makeEnemy, spawnPoint, step, type World } from './world';

const VIEW = { w: 260, h: 380 };

function quiet(stage = 'forest'): World {
  const w = createWorld('dog', 1, VIEW, {}, stage);
  w.stage = { ...w.stage, waves: [], bosses: [], chiefs: [], events: [] };
  w.metalAt = -1;
  w.propCd = 1e9;
  return w;
}

function firstObstacle(w: World): Obstacle {
  for (let c = 1; ; c++) {
    const o = obstacleAt(w.stage.art, c, 0);
    if (o) return o;
  }
}

const inside = (w: World, x: number, y: number, r: number) =>
  obstaclesNear(w.stage.art, x, y, r, []).some((o) =>
    SHAPES[o.kind].circles.some(([dx, dy, cr]) => Math.hypot(x - o.x - dx, y - o.y - dy) < r + cr - 0.01)
  );

describe('World の障害物', () => {
  it('自分は障害物に向かって歩いても中に入らない', () => {
    const w = quiet();
    const o = firstObstacle(w);
    Object.assign(w.player, { x: o.x - 60, y: o.y });
    for (let i = 0; i < 120; i++) {
      step(w, { x: 1, y: 0 }, 1 / 30);
      expect(inside(w, w.player.x, w.player.y, PLAYER_R)).toBe(false);
    }
  });

  it('吹雪で流されても中に入らない', () => {
    const w = quiet('snow');
    const o = firstObstacle(w);
    Object.assign(w.player, { x: o.x - 40, y: o.y });
    Object.assign(w.storm, { left: 100, wx: 1, wy: 0, next: 99 });
    for (let i = 0; i < 300; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      expect(inside(w, w.player.x, w.player.y, PLAYER_R)).toBe(false);
    }
  });

  it('ふつうの敵は中に入らず、ボスは通り抜ける', () => {
    const w = quiet();
    const o = firstObstacle(w);
    Object.assign(w.player, { x: o.x + 80, y: o.y });
    const foe = makeEnemy(ENEMIES.caterpillar, o.x - 50, o.y, 1e6);
    const boss = makeEnemy(ENEMIES.bear, o.x - 50, o.y + 0.5, 1e9);
    w.enemies.push(foe, boss);
    let bossIn = false;
    for (let i = 0; i < 200; i++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      expect(inside(w, foe.x, foe.y, foe.def.r)).toBe(false);
      bossIn ||= inside(w, boss.x, boss.y, 1);
    }
    expect(bossIn).toBe(true);
  });

  it('群れに押されても、敵は障害物の中に残らない（押し合いのあとに押し出す）', () => {
    const w = quiet();
    const o = firstObstacle(w);
    Object.assign(w.player, { x: o.x + 70, y: o.y });
    for (let i = 0; i < 30; i++)
      w.enemies.push(makeEnemy(ENEMIES.caterpillar, o.x - 40 - (i % 6) * 4, o.y + (i % 5) * 4 - 8, 1e6));
    for (let k = 0; k < 120; k++) {
      step(w, { x: 0, y: 0 }, 1 / 30);
      for (const e of w.enemies) if (e.alive) expect(inside(w, e.x, e.y, e.def.r)).toBe(false);
    }
  });

  it('敵の出る位置は障害物の中にならない', () => {
    const w = quiet();
    for (let i = 0; i < 2000; i++) {
      w.player.x = i * 37;
      w.player.y = (i % 50) * 41;
      const at = spawnPoint(w);
      expect(inside(w, at.x, at.y, 12)).toBe(false);
    }
  });

  it('障害物の中に落ちた玉は外へずれる', () => {
    const w = quiet();
    const o = firstObstacle(w);
    dropGem(w, o.x, o.y, 5);
    const g = w.gems.find((x) => x.alive)!;
    expect(inside(w, g.x, g.y, 4)).toBe(false);
  });

  it('宝の地図の宝箱は障害物の中に置かれない', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const w = createWorld('dog', seed, VIEW, {}, 'graveyard');
      startEvent(w, { at: 0, kind: 'treasure' } as never);
      expect(inside(w, w.treasure!.x, w.treasure!.y, 8)).toBe(false);
    }
  });
});
```

`ENEMIES.bear` と `ENEMIES.caterpillar` の id は `enemies.ts` を見て、名前が違えば台帳に書いて合わせる。`startEvent` の引数の型は `stages/forest.ts` の `StageEvent` を見て合わせる。

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/obstacles-world.test.ts`
Expected: 「出る位置」「玉」「宝箱」「自分」「敵」が FAIL（ボスが通るテストはまだ通る）

- [ ] **Step 3: 実装する**

`world.ts` の import に `import { PLAYER_R, pushOut } from './obstacles';` を足す。

`spawnPoint` の `return out;` の前。

```ts
pushOut(w.stage.art, out, 16);
```

`step` の吹雪で流したあと（`if (p.moving) {` の前）。

```ts
pushOut(w.stage.art, p, PLAYER_R);
```

`separate(w);` の直後。

```ts
// 押し合いのあとに出す。前だと群れに押し込まれた敵が毎フレーム出入りしてガタつく
for (const e of w.enemies) if (e.alive && blocked(e)) pushOut(w.stage.art, e, e.def.r);
```

`separate` の上に。

```ts
/** 障害物で止まる敵。ボス・群れ・ランタン・大ヘビの体・きらきらハリネズミは通り抜ける */
const blocked = (e: Enemy) => !e.def.boss && !e.def.prop && !e.def.part && !e.def.metal && e.drift <= 0;
```

`drops.ts` の import に `import { pushOut } from './obstacles';` を足し、`dropGem` の先頭。

```ts
const at = { x, y };
pushOut(w.stage.art, at, 4);
({ x, y } = at);
```

`dropItem` の `Object.assign(it, ...)` の前に同じ 3 行（半径 6）。

`events.ts` の宝の地図で `w.treasure = it;` の前。

```ts
pushOut(w.stage.art, it, 8);
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/obstacles-world.test.ts`
Expected: PASS

- [ ] **Step 5: 全体のテストを回す**

Run: `pnpm test:run > /tmp/as-test.txt 2>&1; tail -30 /tmp/as-test.txt`
Expected: PASS。前から通っていたテストが落ちたら、自分や敵が障害物にぶつかる位置で試しているかを見る。そうなら、そのテストの座標を障害物の無い始めの位置のまわり（80 ドット以内）へ寄せるか、`quiet()` と同じ `waves: []` の組で動かす量を減らす。障害物を切る口は本体に足さない。直したテストは台帳に 1 行ずつ書く

- [ ] **Step 6: コミット**

```bash
git add -A src/lib/games/animal-survivors
git commit -m "Block the player and normal enemies with obstacles and keep drops and spawns out of them"
```

---

### Task 3: 協力プレイの子の端末

**Files:**

- Modify: `src/lib/games/animal-survivors/coop.ts:384-410`（`CoopGuest.move`）
- Modify: `src/lib/games/animal-survivors/coop.test.ts`

**Interfaces:**

- Consumes: `pushOut`、`PLAYER_R`、`obstacleAt`、`SHAPES`、`obstaclesNear`（Task 1）

- [ ] **Step 1: 失敗するテストを書く**

`coop.test.ts` の `describe('協力プレイのつなぎ'` の中に足す（`started()` を使う）。

```ts
it('子の端末で動かした子の動物も、障害物の中に入らない', async () => {
  const { g } = await started();
  const v = g.view!;
  const me = v.heroes[v.cur].player;
  let o = null;
  for (let c = 1; !o; c++) o = obstacleAt(v.stage.art, c, 0);
  Object.assign(me, { x: o.x - 60, y: o.y });
  for (let i = 0; i < 120; i++) {
    g.move({ x: 1, y: 0 }, 1 / 30);
    const hit = obstaclesNear(v.stage.art, me.x, me.y, PLAYER_R, []).some((ob) =>
      SHAPES[ob.kind].circles.some(
        ([dx, dy, r]) => Math.hypot(me.x - ob.x - dx, me.y - ob.y - dy) < PLAYER_R + r - 0.01
      )
    );
    expect(hit).toBe(false);
  }
});
```

import に `import { obstacleAt, obstaclesNear, PLAYER_R, SHAPES } from './obstacles';` を足す。

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop.test.ts -t 障害物`
Expected: FAIL

- [ ] **Step 3: 実装する**

`coop.ts` の import に `import { PLAYER_R, pushOut } from './obstacles';`。`move` の吹雪のブロックのあと（`if (p.moving) {` の前）。

```ts
pushOut(v.stage.art, p, PLAYER_R);
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/coop.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/coop.ts src/lib/games/animal-survivors/coop.test.ts
git commit -m "Keep the co-op guest's own animal out of obstacles on its device"
```

---

### Task 4: 絵と描き方

**Files:**

- Create: `src/lib/games/animal-survivors/art/obstacles.ts`
- Create: `src/lib/games/animal-survivors/draw-obstacles.ts`
- Modify: `src/lib/games/animal-survivors/draw.ts`（`ground()` の飾り 160〜172 行、`draw()` 413〜430 行）
- Modify: `src/lib/games/animal-survivors/pixels.test.ts`

**Interfaces:**

- Consumes: `obstacleAt`、`obstaclesNear`、`SHAPES`、`CELL`、`ObstacleId`、`Obstacle`（Task 1）
- Produces。
  - `OBSTACLE_ART: Record<ObstacleId, Art>`（steamRock だけ 2 コマ、ほかは 1 コマ。色は `pal` で `a #3b3537`・`A #24201f`・`x #5a5355`・`e #7c5a50`・`E #4c3530`・`f #a8857a`）
  - `inView(g: Ground, cx: number, cy: number, w: number, h: number, out: Obstacle[]): Obstacle[]`（画面にかかる障害物を y の小さい順）
  - `drawObstacles(ctx, list: Obstacle[], now: number, q: (v: number) => number): void`

- [ ] **Step 1: 絵のファイルを書き出す**

見本の格子（scratchpad の `obs/obs.json`）から書き出す。scratchpad の `obs/to-ts.mjs`。

```js
import { readFileSync, writeFileSync } from 'node:fs';
const O = JSON.parse(readFileSync(new URL('./obs.json', import.meta.url)));
const pal = { a: '#3b3537', A: '#24201f', x: '#5a5355', e: '#7c5a50', E: '#4c3530', f: '#a8857a' };
const body = Object.entries(O)
  .map(([k, frames]) => {
    const used = Object.fromEntries(
      Object.entries(pal).filter(([c]) => frames.some((f) => f.some((r) => r.includes(c))))
    );
    const p = Object.keys(used).length ? `,\n    pal: ${JSON.stringify(used)}` : '';
    return `  ${k}: {\n    w: ${frames[0][0].length},\n    h: ${frames[0].length},\n    frames: ${JSON.stringify(frames)}${p}\n  }`;
  })
  .join(',\n');
writeFileSync(
  process.argv[2],
  `import type { Art } from '../pixels';\nimport type { ObstacleId } from '../obstacles';\n\n/** 障害物の絵。黒い溶岩の岩と湯気の出る岩だけは、色の表に無い黒と赤茶を pal で足す */\nexport const OBSTACLE_ART: Record<ObstacleId, Art> = {\n${body}\n};\n`
);
```

Run: `node <scratchpad>/obs/to-ts.mjs src/lib/games/animal-survivors/art/obstacles.ts && pnpm prettier --write src/lib/games/animal-survivors/art/obstacles.ts`
Expected: ファイルができ、8 つの絵が入る

- [ ] **Step 2: 絵の検査に足して通ることを見る**

`pixels.test.ts` の import に `import { OBSTACLE_ART } from './art/obstacles';`、`all` の末尾に `...Object.entries(OBSTACLE_ART)`、`describe('ドット絵の格子'` に。

```ts
it('障害物の絵は 8 枚で、湯気の出る岩だけ 2 コマ', () => {
  expect(Object.keys(OBSTACLE_ART)).toHaveLength(8);
  for (const [id, a] of Object.entries(OBSTACLE_ART)) expect(a.frames).toHaveLength(id === 'steamRock' ? 2 : 1);
});
```

Run: `pnpm vitest run src/lib/games/animal-survivors/pixels.test.ts`
Expected: PASS（Step 1 の前にこのテストを足して走らせると FAIL を見られる。順番は Step 2 のテストを書く → FAIL を見る → Step 1 の書き出し → PASS）

- [ ] **Step 3: 画面にかかる障害物の並びのテストを書く**

`obstacles.test.ts` に足す。

```ts
import { inView } from './draw-obstacles';

describe('画面にかかる障害物', () => {
  it('画面の外の障害物は入らず、奥（y の小さい）から並ぶ', () => {
    const list = inView('forest', -800, -800, 1600, 1600, []);
    expect(list.length).toBeGreaterThan(5);
    for (let i = 1; i < list.length; i++) expect(list[i].y).toBeGreaterThanOrEqual(list[i - 1].y);
    expect(inView('forest', -60, -60, 120, 120, [])).toEqual([]);
  });
});
```

Run: `pnpm vitest run src/lib/games/animal-survivors/obstacles.test.ts -t 画面`
Expected: FAIL（`./draw-obstacles` が無い）

- [ ] **Step 4: 描き方を書く**

`draw-obstacles.ts`。

```ts
import { OBSTACLE_ART } from './art/obstacles';
import { CELL, obstacleAt, SHAPES, type Ground, type Obstacle } from './obstacles';
import { bake } from './pixels';

/** 絵は足もとより上へ伸びるので、画面の上の外にある障害物も拾う */
const OVER = 48;

export function inView(g: Ground, cx: number, cy: number, w: number, h: number, out: Obstacle[]): Obstacle[] {
  out.length = 0;
  for (let gx = Math.floor((cx - OVER) / CELL); gx <= Math.floor((cx + w + OVER) / CELL); gx++)
    for (let gy = Math.floor((cy - OVER) / CELL); gy <= Math.floor((cy + h + OVER * 2) / CELL); gy++) {
      const o = obstacleAt(g, gx, gy);
      if (o && o.x > cx - OVER && o.x < cx + w + OVER && o.y > cy - OVER && o.y < cy + h + OVER * 2) out.push(o);
    }
  return out.sort((a, b) => a.y - b.y);
}

export function drawObstacles(
  ctx: CanvasRenderingContext2D,
  list: Obstacle[],
  now: number,
  q: (v: number) => number
): void {
  for (const o of list) {
    const art = OBSTACLE_ART[o.kind];
    const s = SHAPES[o.kind];
    ctx.fillStyle = 'rgb(0 0 0 / 0.22)';
    ctx.beginPath();
    ctx.ellipse(q(o.x), q(o.y + s.foot - 1), art.w * 0.42, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // 湯気だけゆっくり 2 コマを入れ替える（明滅ではなく形が揺れる）
    const frame = art.frames.length > 1 ? Math.floor(now / 500) % art.frames.length : 0;
    ctx.drawImage(bake(art, frame), q(o.x - art.w / 2), q(o.y + s.foot - art.h));
  }
}
```

- [ ] **Step 5: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/obstacles.test.ts`
Expected: PASS

- [ ] **Step 6: draw.ts に入れる**

`draw.ts` の import に `import { drawObstacles, inView } from './draw-obstacles';` と `import { obstaclesNear } from './obstacles';`、ファイルの上に `const seen: Obstacle[] = []; const back: Obstacle[] = []; const front: Obstacle[] = [];`（`Obstacle` の型も import）。

`ground()` の飾りの `const art = decor[kind];` の前に、x と y を先に出して重なる飾りを飛ばす。

```ts
const x = gx * C + 8 + Math.floor(hash(gx, gy * 3) * 32);
const y = gy * C + 16 + Math.floor(hash(gx * 3, gy) * 28);
if (obstaclesNear(w.stage.art, x, y, 8, seen).length) continue;
```

（下にある同じ 2 行の `const x` / `const y` は消す）

`draw()` の `ground(ctx, w, cx, cy, v);` のあと。

```ts
// 自分より奥の障害物は敵より先に、手前の障害物は自分のあとに描き、奥行きを合わせる
back.length = front.length = 0;
for (const o of inView(w.stage.art, cx, cy, v.w, v.h, seen)) (o.y < p.y ? back : front).push(o);
drawObstacles(ctx, back, now, q);
```

`w.cur = me;` の `}` のあと（自分を描いたあと、弾の前）。

```ts
drawObstacles(ctx, front, now, q);
```

- [ ] **Step 7: 画面で確かめる（見え方と foot の合わせ）**

scratchpad の今の playwright の台本（`ux-tour.mjs` か `boss-play.mjs`）と同じ形で、`pnpm dev` の画面を headless Chrome（`channel: 'chrome'`）で開き、4 つのステージで遊びはじめて、自分を障害物の上・下・左右に当てたところを撮る（タッチの代わりに World へ入力を送れない場合は、キーボードの矢印で動かす）。見ること。

- 障害物の上側に立つと自分が絵の後ろに隠れ、下側では前に出る
- 自分の足もとと当たりの縁が合っている（合わなければ `SHAPES` の `foot` と丸を 1〜3 ドットずつ直し、Task 1 のテストを回し直す）
- 飾りが障害物に重ならない
- 湯気が点滅に見えない

直した値は台帳に書く。撮った 1 枚を利用者に送るのは Task 6 でまとめて。

- [ ] **Step 8: コミット**

```bash
git add src/lib/games/animal-survivors/art/obstacles.ts src/lib/games/animal-survivors/draw-obstacles.ts src/lib/games/animal-survivors/draw.ts src/lib/games/animal-survivors/pixels.test.ts src/lib/games/animal-survivors/obstacles.test.ts src/lib/games/animal-survivors/obstacles.ts
git commit -m "Draw the obstacles with depth and skip decor under them"
```

---

### Task 5: ボットで確かめる（中に入らない・バランス）

**Files:**

- Create（scratchpad、リポジトリには入れない）: `<scratchpad>/sim/obstacles.sim.ts`

**Interfaces:**

- Consumes: `createWorld`・`step`・`openChest`・`apply`・`choices`（今の `boss.sim.ts` と同じ）、`obstaclesNear`・`SHAPES`・`PLAYER_R`

- [ ] **Step 1: シミュレーションを書く**

`<scratchpad>/sim/boss.sim.ts` を写して `obstacles.sim.ts` にし、次を変える。

- `process.env.OFF === '1'` のときは先頭で `vi.mock('<repo>/src/lib/games/animal-survivors/obstacles', async (orig) => ({ ...(await orig()), obstaclesNear: (_g, _x, _y, _r, out) => ((out.length = 0), out), obstacleAt: () => null }))` で障害物を消す
- ボットは障害物を避ける力を足す（人も避けるので）: `obstaclesNear(w.stage.art, p.x, p.y, 30, [])` の丸ごとに、離れる向きへ `(30 + cr - d) / 30 * 2` の力を足す
- 1 フレームごとに、自分（`PLAYER_R`）・`blocked` の敵（ボス・ランタン・節・ハリネズミ・群れでない敵）・吸い寄せられていない玉（半径 4）・品（半径 6）が障害物の中にいないかを数え、`inside` として結果に入れる
- 結果は `obs-<stage>-<on|off>.json` に `{ animal, seed, cleared, time, inside }`

- [ ] **Step 2: 回す**

4 ステージ × 障害物あり・なしを、店を半分（`RANKS=half`）、動物 `dog,fox,panda`、`SEEDS=6` で回す（ステージは `STAGE=forest|graveyard|snow|volcano`）。

Run（1 本の例）: `cd <scratchpad>/sim && RANKS=half STAGE=forest OUT=obs-forest-on.json pnpm -C <repo> exec vitest run --config <scratchpad>/sim/vitest.config.mjs --root <scratchpad>/sim obstacles.sim.ts`
Expected: 8 つの JSON ができる

- [ ] **Step 3: 比べて決める**

- `inside` がどの回も 0（0 でなければ Task 2 に戻り、入ったものの種類を探して直す。直したらテストを足す）
- クリアの割合の差がどのステージも 15 ポイント以内なら、そのまま。超えたら `CHANCE` を 0.2 に下げて回し直す（それでも超えたら利用者に数字を見せて聞く）
- 数字と決めたことを台帳に書く

- [ ] **Step 4: コミット**

`CHANCE` を変えたときだけ。

```bash
git add src/lib/games/animal-survivors/obstacles.ts
git commit -m "Tune the obstacle density from the bot runs"
```

---

### Task 6: 文書と仕上げ

**Files:**

- Modify: `CLAUDE.md`（アニマルサバイバーの段落。面の説明の「面は地面と飾りの絵（`art`）…」の文のあと）

- [ ] **Step 1: CLAUDE.md に書く**

足す文。

```
面には通れない障害物（`obstacles.ts`。森は大岩と倒木、墓地は大きな墓石と崩れた柵、雪山は氷の岩と雪の積もった木、火山は黒い溶岩の岩と湯気の出る岩、絵は `art/obstacles.ts`）が 160 ドットの区画におよそ 4 つに 1 つ、位置のハッシュで毎回同じ場所に出る（協力プレイの 2 台でもそろう。始めの位置から 80 ドットには置かない）。当たりは種類ごとの丸の並び（`SHAPES`）で、自分（子の端末の `move` も）と、ボス・群れ・ランタン・大ヘビの体・きらきらハリネズミでない敵を `pushOut()` で外へ出す（敵は押し合いのあとに出す。前だと群れに押し込まれて毎フレーム出入りする）。武器は通り抜ける。敵の出る位置・落ちる玉と品・宝の地図の宝箱は中に来たら外へずらし、重なる飾りは描かない。自分より奥の障害物は敵より先に、手前は自分のあとに描く（`draw-obstacles.ts`）。
```

- [ ] **Step 2: まとめて確かめる**

Run: `pnpm verify > /tmp/as-verify.txt 2>&1; tail -40 /tmp/as-verify.txt`
Expected: lint / check / test / vitals / build がすべて通る

- [ ] **Step 3: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors obstacles"
```

- [ ] **Step 4: 枝全体の見直し（opus）と、Critical / Important の直し**

- [ ] **Step 5: 画面の写真（Task 4 Step 7 のもの）を利用者に送り、main への push を聞く**
