# アニマルサバイバー 2 匹で運ぶ重い宝箱 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 協力プレイでは宝の地図の出来事を重い宝箱に変え、2 匹がそばにいるときだけ祭壇へ動き、届くと 2 匹とも中身 3 つの宝箱とコイン 50 枚をもらえるようにする。

**Architecture:** ルールは新しい `carry.ts`（`World.carry` の置く・運ぶ・届く・消える）に置き、`events.ts` の `startEvent` が協力プレイの宝の地図をそちらへ回す。中身 3 つは動物ごとの数 `big`（`HERO_KEYS`）を `openChest` が見る。`step` は時計の品のあとに `stepCarry` を呼ぶ。協力プレイは snap に `carry` を足して `COOP_VERSION` を 5 にする。絵は `draw-carry.ts`（宝箱・祭壇・輪・向き）と `draw-events.ts`（画面の端の矢印）。

**Tech Stack:** TypeScript、Svelte 5、vitest、playwright-core（画面の撮影）

**Spec:** `docs/superpowers/specs/2026-10-09-animal-survivors-carry-design.md`

## Global Constraints

- 1 人で遊ぶときは何も変えない（宝の地図のまま）
- 2 匹のまん中から 120〜160 ドット先に宝箱、そこからさらに 250〜300 ドット先に祭壇。どちらも障害物の外
- 帯「重い宝箱だ！ 2 匹で祭壇まで運ぼう」
- 2 匹がどちらも立っていて宝箱から 36 ドット以内のあいだだけ、2 匹のまん中へ向かって動く。速さはふつうに歩く速さの 5.5 割。障害物には入らない
- 宝箱のまわりの輪は、寄っている動物 1 匹ごとに半分ずつ光る
- 祭壇に届くと 2 匹それぞれに中身 3 つの宝箱が 1 つずつ、コインが 50 枚
- 出てから 60 秒で「宝箱が沈んでしまった…」と消える。時計の品で止まっているあいだは減らない
- 宝箱は今の宝箱の絵を 2 倍、祭壇は地面の光る輪（新しいドット絵は作らない）
- 画面の外は端の矢印に宝箱か祭壇の印と残り秒。運んでいるあいだは宝箱から祭壇への小さな矢印
- `COOP_VERSION` は 5
- コードコメントは非自明な WHY だけ。大群の中で点滅させない

## Review Focus

- 運んでいる途中で子が抜けた（`gone`）ら、宝箱はもう動かず、60 秒で消える（固まらない・落ちない。Task 1 のテスト）
- 祭壇に届いた瞬間に片方が倒れていても、2 匹とも宝箱をもらう（Task 1 のテスト）
- 中身 3 つの数は宝箱 1 つぶんだけ効き、次のふつうの宝箱は元の割合に戻る（Task 1 のテスト）
- 協力プレイでは宝の地図の矢印（`w.treasure`）が出ない（Task 1 のテスト）
- 子の画面の宝箱と連携の技の絵は 2 つの様子のあいだでなめらかに動き、同じ様子から何度つないでも値がずれない（届いた様子を書き換えない。Task 2 のテスト）

---

### Task 1: 運ぶ決まり

**Files:**

- Create: `src/lib/games/animal-survivors/carry.ts`
- Modify: `src/lib/games/animal-survivors/world.ts`（`World.carry`・`World.big`、`createWorld`、`makeHero`、`step`）
- Modify: `src/lib/games/animal-survivors/heroes.ts`（`HERO_KEYS` に `big`）
- Modify: `src/lib/games/animal-survivors/events.ts`（`startEvent` が帯の文を返す）
- Modify: `src/lib/games/animal-survivors/chest.ts`（`openChest` が `big` を見る）
- Test: `src/lib/games/animal-survivors/carry.test.ts`

**Interfaces:**

- Produces（`carry.ts`）
  - `interface Carry { x: number; y: number; ax: number; ay: number; life: number; near: boolean[] }`
  - 定数 `CARRY_LIFE = 60`・`CARRY_REACH = 36`・`CARRY_SPEED = 0.55`・`CARRY_COINS = 50`・`ALTAR_R = 16`・`CARRY_R = 14`
  - `CARRY_TEXT = '重い宝箱だ！\n2 匹で祭壇まで運ぼう'`
  - `coopCarry(w: World): boolean`（2 匹そろっている協力プレイ）
  - `startCarry(w: World): void`
  - `stepCarry(w: World, dt: number): void`
- Produces（`events.ts`）: `startEvent(w, ev): string | undefined`（帯の文を差し替えるときは返す）
- Produces（`world.ts`）: `World.carry: Carry | null`、`World.big: number`（`HERO_KEYS`）

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/carry.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { ALTAR_R, CARRY_COINS, CARRY_LIFE, CARRY_REACH, CARRY_TEXT, startCarry, stepCarry } from './carry';
import { openChest } from './chest';
import { startEvent } from './events';
import { obstacleAt, SHAPES, SQUASH } from './obstacles';
import { addHero, createWorld, step, type World } from './world';

const VIEW = { w: 260, h: 380 };
const TREASURE = { at: 0, kind: 'treasure' as const, enemy: '', count: 0, text: '宝の地図' };

function duo(): World {
  const w = createWorld('dog', 3, VIEW);
  addHero(w, 'cat');
  w.stage = { ...w.stage, waves: [] };
  w.spawnAcc = [];
  return w;
}

/** 宝箱のそばに 2 匹を置く */
function hold(w: World, dx = 10) {
  const c = w.carry!;
  w.heroes[0].player.x = c.x - dx;
  w.heroes[0].player.y = c.y;
  w.heroes[1].player.x = c.x + dx;
  w.heroes[1].player.y = c.y;
}

describe('重い宝箱の出方', () => {
  it('1 匹のときは宝の地図のまま', () => {
    const w = createWorld('dog', 3, VIEW);
    expect(startEvent(w, TREASURE)).toBeUndefined();
    expect(w.treasure).not.toBeNull();
    expect(w.carry).toBeNull();
  });

  it('2 匹のときは重い宝箱になり、宝の地図の宝箱は出ず、帯の文が変わる', () => {
    const w = duo();
    expect(startEvent(w, TREASURE)).toBe(CARRY_TEXT);
    expect(w.treasure).toBeNull();
    const c = w.carry!;
    const mx = (w.heroes[0].player.x + w.heroes[1].player.x) / 2;
    const my = (w.heroes[0].player.y + w.heroes[1].player.y) / 2;
    const d = Math.hypot(c.x - mx, c.y - my);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(175);
    const a = Math.hypot(c.ax - c.x, c.ay - c.y);
    expect(a).toBeGreaterThan(235);
    expect(a).toBeLessThan(315);
    expect(c.life).toBe(CARRY_LIFE);
  });
});

describe('運び方', () => {
  it('2 匹がそばにいるときだけ、2 匹のまん中へ向かって動く', () => {
    const w = duo();
    startCarry(w);
    const c = w.carry!;
    hold(w);
    w.heroes[0].player.y = w.heroes[1].player.y = c.y - 20;
    const y0 = c.y;
    stepCarry(w, 0.1);
    expect(c.y).toBeLessThan(y0);
    expect(c.near).toEqual([true, true]);
    w.heroes[1].player.x = c.x + CARRY_REACH + 20;
    const y1 = c.y;
    stepCarry(w, 0.1);
    expect(c.y).toBe(y1);
    expect(c.near).toEqual([true, false]);
  });

  it('片方が倒れていると動かない', () => {
    const w = duo();
    startCarry(w);
    const c = w.carry!;
    hold(w);
    w.heroes[0].player.y = w.heroes[1].player.y = c.y - 20;
    w.heroes[1].down = true;
    const y0 = c.y;
    stepCarry(w, 0.1);
    expect(c.y).toBe(y0);
  });

  it('祭壇に届くと、2 匹とも中身 3 つの宝箱をもらい、コインが入る（片方が倒れていても）', () => {
    const w = duo();
    startCarry(w);
    const c = w.carry!;
    c.x = c.ax + ALTAR_R / 2;
    c.y = c.ay;
    hold(w);
    w.heroes[1].down = true;
    const coins = w.coins;
    stepCarry(w, 0.01);
    expect(w.carry).toBeNull();
    expect(w.heroes.map((h) => h.chests)).toEqual([1, 1]);
    expect(w.heroes.map((h) => h.big)).toEqual([1, 1]);
    expect(w.coins - coins).toBe(CARRY_COINS);
  });

  it('中身 3 つの数は宝箱 1 つぶんだけ効く', () => {
    const w = duo();
    w.big = 1;
    w.chests = 2;
    // 引いた割合が 5 つなら 5 つのまま（重い宝箱で減らさない）
    expect(openChest(w).length).toBeGreaterThanOrEqual(3);
    expect(w.big).toBe(0);
  });

  it('60 秒で沈んで消え、時計の品で止まっているあいだは減らない', () => {
    const w = duo();
    startCarry(w);
    w.freeze = 5;
    stepCarry(w, 1);
    expect(w.carry!.life).toBe(CARRY_LIFE);
    w.freeze = 0;
    w.carry!.life = 0.5;
    w.events.length = 0;
    stepCarry(w, 1);
    expect(w.carry).toBeNull();
    expect(w.events.some((e) => e.type === 'swarm' && e.text.includes('沈んで'))).toBe(true);
  });

  it('子が抜けたら動かず、そのまま時間で消える', () => {
    const w = duo();
    startCarry(w);
    hold(w);
    w.heroes[1].gone = w.heroes[1].down = true;
    const x0 = w.carry!.x;
    for (let i = 0; i < 10; i++) stepCarry(w, 0.1);
    expect(w.carry!.x).toBe(x0);
    stepCarry(w, CARRY_LIFE);
    expect(w.carry).toBeNull();
  });

  it('step の中で進む（3 択や宝箱を開けているあいだは止まる）', () => {
    const w = duo();
    startCarry(w);
    const life = w.carry!.life;
    step(w, { x: 0, y: 0 }, 0.5);
    expect(w.carry!.life).toBeCloseTo(life - 0.5);
    w.heroes[0].pending = 1;
    step(w, { x: 0, y: 0 }, 0.5);
    expect(w.carry!.life).toBeCloseTo(life - 0.5);
  });

  it('障害物に向かって運んでも、宝箱は障害物の中に入らない', () => {
    const w = duo();
    startCarry(w);
    const c = w.carry!;
    let o = null;
    for (let k = 1; !o; k++) o = obstacleAt(w.stage.art, k, 0);
    Object.assign(c, { x: o.x - 80, y: o.y });
    for (let i = 0; i < 200; i++) {
      w.heroes[0].player.x = w.heroes[1].player.x = c.x + 20;
      w.heroes[0].player.y = c.y - 5;
      w.heroes[1].player.y = c.y + 5;
      stepCarry(w, 1 / 30);
      const inside = SHAPES[o.kind].circles.some(
        ([dx, dy, r]) => Math.hypot(c.x - o.x - dx, (c.y - o.y - dy) / SQUASH) < r + 14 - 0.01
      );
      expect(inside).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/carry.test.ts`
Expected: FAIL（`./carry` が無い）

- [ ] **Step 3: 実装する**

`src/lib/games/animal-survivors/carry.ts`

```ts
import { addCoins } from './drops';
import { pushOut } from './obstacles';
import { BASE_SPEED, type World } from './world';

/** 協力プレイの重い宝箱。ax・ay は祭壇、near は宝箱に寄っている動物 */
export interface Carry {
  x: number;
  y: number;
  ax: number;
  ay: number;
  life: number;
  near: boolean[];
}

export const CARRY_LIFE = 60;
export const CARRY_REACH = 36;
/** ふつうに歩く速さに対する、運ぶ速さ */
export const CARRY_SPEED = 0.55;
export const CARRY_COINS = 50;
/** 宝箱の真ん中がこの半径に入ったら届いた */
export const ALTAR_R = 16;
/** 障害物から押し出すときの宝箱の半径（2 倍で描く宝箱の見た目に合わせる） */
export const CARRY_R = 14;
export const CARRY_TEXT = '重い宝箱だ！\n2 匹で祭壇まで運ぼう';
const CHEST_NEAR = 120;
const CHEST_FAR = 160;
const ALTAR_NEAR = 250;
const ALTAR_FAR = 300;

export const coopCarry = (w: World) => w.heroes.length > 1 && w.heroes.every((h) => !h.gone);

function mid(w: World): { x: number; y: number } {
  const [a, b] = w.heroes;
  return { x: (a.player.x + b.player.x) / 2, y: (a.player.y + b.player.y) / 2 };
}

/** 2 匹のまん中から少し先に宝箱、その先に祭壇を置く */
export function startCarry(w: World): void {
  const m = mid(w);
  const a = w.rand() * Math.PI * 2;
  const d = CHEST_NEAR + w.rand() * (CHEST_FAR - CHEST_NEAR);
  const chest = { x: m.x + Math.cos(a) * d, y: m.y + Math.sin(a) * d };
  pushOut(w.stage.art, chest, CARRY_R);
  const b = w.rand() * Math.PI * 2;
  const e = ALTAR_NEAR + w.rand() * (ALTAR_FAR - ALTAR_NEAR);
  const altar = { x: chest.x + Math.cos(b) * e, y: chest.y + Math.sin(b) * e };
  pushOut(w.stage.art, altar, ALTAR_R);
  w.carry = { x: chest.x, y: chest.y, ax: altar.x, ay: altar.y, life: CARRY_LIFE, near: w.heroes.map(() => false) };
}

/** step の中で呼ぶ（3 択・宝箱・一時停止では進まない）。時計で止まっているあいだは残りの秒を減らさない */
export function stepCarry(w: World, dt: number): void {
  const c = w.carry;
  if (!c) return;
  if (w.freeze <= 0) c.life -= dt;
  if (c.life <= 0) {
    w.carry = null;
    w.events.push({ type: 'swarm', text: '宝箱が沈んでしまった…' });
    return;
  }
  c.near = w.heroes.map((h) => !h.down && !h.gone && Math.hypot(h.player.x - c.x, h.player.y - c.y) <= CARRY_REACH);
  if (c.near.length > 1 && c.near.every(Boolean)) {
    const m = mid(w);
    const dx = m.x - c.x;
    const dy = m.y - c.y;
    const len = Math.hypot(dx, dy);
    const go = Math.min(len, BASE_SPEED * CARRY_SPEED * dt);
    if (len > 0) {
      c.x += (dx / len) * go;
      c.y += (dy / len) * go;
      pushOut(w.stage.art, c, CARRY_R);
    }
  }
  if (Math.hypot(c.x - c.ax, c.y - c.ay) > ALTAR_R) return;
  // 倒れていても運んだ 2 匹ともの手柄なので、抜けた動物にだけは渡さない
  for (const h of w.heroes) {
    if (h.gone) continue;
    h.chests += 1;
    h.big += 1;
  }
  addCoins(w, CARRY_COINS);
  w.carry = null;
  w.events.push({ type: 'swarm', text: '祭壇に届いた！\n2 匹に宝箱' });
}
```

`world.ts`

1. import に `import { stepCarry, type Carry } from './carry';` を足す。
2. `World` の `treasure: Item | null;` の下に足す。

```ts
/** 協力プレイの重い宝箱（2 匹で祭壇まで運ぶ） */
carry: Carry | null;
/** 次に開ける宝箱を中身 3 つにする数（運んだ重い宝箱のぶん） */
big: number;
```

3. `createWorld` の `treasure: null,` の下に `carry: null,` を足す。
4. `makeHero` の `chests: 0,` の下に `big: 0,` を足す。
5. `step` の次のところに足す。

```ts
if (w.freeze <= 0) {
  stepEvents(w, dt);
  stepEruption(w, dt);
}
stepCarry(w, dt);
```

`heroes.ts` の `HERO_KEYS` の `'chests',` の下に `'big',` を足す。

`events.ts`

1. import に `import { coopCarry, CARRY_TEXT, startCarry } from './carry';` を足す。
2. `startEvent` の形を `export function startEvent(w: World, ev: StageEvent): string | undefined {` にし、頭に足す。

```ts
// 2 匹のときの宝の地図は、2 匹がそろっていないと動かない重い宝箱にする
if (ev.kind === 'treasure' && coopCarry(w)) {
  startCarry(w);
  return CARRY_TEXT;
}
```

`world.ts` の `spawnEvents` の次を変える。

```ts
if (ev.kind === 'treasure' || ev.kind === 'meteor' || ev.kind === 'festival') {
  const text = startEvent(w, ev) ?? ev.text;
  w.events.push({ type: 'swarm', text });
  continue;
}
```

`chest.ts` の `openChest` の `if (has(w, 'cursed')) n = Math.max(3, n) as 3 | 5;` の下に足す。

```ts
if (w.big > 0) {
  w.big -= 1;
  n = Math.max(3, n) as 3 | 5;
}
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/carry.test.ts`
Expected: PASS

Run: `pnpm test:run src/lib/games/animal-survivors && pnpm check`
Expected: 全部 PASS、型のエラーなし（World の形を比べるテストが落ちたら、期待に `carry: null` と `big: 0` を足す）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/carry.ts src/lib/games/animal-survivors/carry.test.ts src/lib/games/animal-survivors/world.ts src/lib/games/animal-survivors/heroes.ts src/lib/games/animal-survivors/events.ts src/lib/games/animal-survivors/chest.ts
git commit -m "Turn the co-op treasure map into a heavy chest two heroes carry to an altar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 協力プレイの通信

**Files:**

- Modify: `src/lib/games/animal-survivors/snap.ts`
- Test: `src/lib/games/animal-survivors/snap.test.ts`、`src/lib/games/animal-survivors/coop.test.ts`

**Interfaces:**

- Consumes: Task 1 の `Carry`・`World.carry`
- Produces: `Snap.carry: Carry | null`、`COOP_VERSION = 5`

- [ ] **Step 1: 失敗するテストを書く**

`snap.test.ts` の `describe('snap', ...)` の中に足す。

```ts
it('重い宝箱と祭壇と残り秒を運び、宝箱は 2 つの様子のあいだでなめらかに動く', () => {
  const w = createWorld('dog', 1, VIEW);
  addHero(w, 'cat');
  w.carry = { x: 10, y: 20, ax: 300, ay: 40, life: 42, near: [true, false] };
  const a = JSON.parse(JSON.stringify(makeSnap(w, [])));
  w.carry.x = 20;
  const b = JSON.parse(JSON.stringify(makeSnap(w, [])));
  const view = guestView();
  applySnap(view, a);
  expect(view.carry).toEqual({ x: 10, y: 20, ax: 300, ay: 40, life: 42, near: [true, false] });
  lerpSnap(view, a, b, 0.5);
  expect(view.carry!.x).toBeCloseTo(15);
  // 毎フレーム同じ 2 つからつなぐので、届いた様子を書き換えると次のフレームでずれる
  lerpSnap(view, a, b, 0.5);
  expect(view.carry!.x).toBeCloseTo(15);
  w.carry = null;
  applySnap(view, JSON.parse(JSON.stringify(makeSnap(w, []))));
  expect(view.carry).toBeNull();
});
```

`coop.test.ts` の版を見るテストを置き換える。

```ts
it('snap の形を変えたので、つなぎ方の版は 5（古い版の端末とはつながない）', () => {
  expect(COOP_VERSION).toBe(5);
});
```

`snap.test.ts` の「子の画面の技の絵は、届いた 2 つの様子のあいだで進み具合をつなぐ」の `expect(view.link.shows[0].t).toBeCloseTo(0.2);` の下に足す。

```ts
lerpSnap(view, a, b, 0.5);
expect(view.link.shows[0].t).toBeCloseTo(0.2);
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/snap.test.ts src/lib/games/animal-survivors/coop.test.ts`
Expected: FAIL（`view.carry` が届かない、版が 4、技の絵の 2 回めのつなぎが 0.25 にずれる）

- [ ] **Step 3: 実装する**

`snap.ts`

1. import に `import type { Carry } from './carry';` を足す。
2. `COOP_VERSION` を `5` にする。
3. `Snap` の `link: Link;` の下に `carry: Carry | null;` を足す。
4. `makeSnap` の `link: ...,` の下に `carry: w.carry && { ...w.carry, near: [...w.carry.near] },` を足す。
5. `applySnap` の `view.link = s.link;` を次に置き換える（つなぐときに `view` の値を書き換えるので、届いた様子の写しにする）。

```ts
view.link = { ...s.link, shows: s.link.shows.map((o) => ({ ...o })) };
view.carry = s.carry && { ...s.carry };
```

6. `lerpSnap` の技の絵をつなぐところの下に足す。

```ts
if (view.carry && a.carry && b.carry) {
  view.carry.x = a.carry.x + (b.carry.x - a.carry.x) * t;
  view.carry.y = a.carry.y + (b.carry.y - a.carry.y) * t;
}
```

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/snap.test.ts src/lib/games/animal-survivors/coop.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/snap.ts src/lib/games/animal-survivors/snap.test.ts src/lib/games/animal-survivors/coop.test.ts
git commit -m "Carry the heavy chest in co-op snaps

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 宝箱・祭壇・矢印の絵

**Files:**

- Create: `src/lib/games/animal-survivors/draw-carry.ts`
- Modify: `src/lib/games/animal-survivors/draw-events.ts`（`carryArrows`）
- Modify: `src/lib/games/animal-survivors/draw.ts`（呼び出し）

**Interfaces:**

- Consumes: `World.carry`、`CARRY_REACH`・`ALTAR_R`
- Produces: `drawCarry(ctx: CanvasRenderingContext2D, w: World, now: number): void`、`carryArrows(ctx, w, vw, vh, top, now): void`

- [ ] **Step 1: 絵を書く**

`src/lib/games/animal-survivors/draw-carry.ts`

```ts
import { ITEM_ART } from './art/items';
import { PALETTE } from './art/palette';
import { ALTAR_R, CARRY_REACH } from './carry';
import { pulse } from './draw-boss';
import { bake } from './pixels';
import type { World } from './world';

/** 重い宝箱と祭壇（地面の高さで、敵より先に描く）。光はなめらかに強めて弱める */
export function drawCarry(ctx: CanvasRenderingContext2D, w: World, now: number): void {
  const c = w.carry;
  if (!c) return;
  const glow = 0.45 + 0.35 * pulse(now);
  ctx.globalAlpha = glow * 0.35;
  ctx.fillStyle = PALETTE.y;
  ctx.beginPath();
  ctx.ellipse(c.ax, c.ay, ALTAR_R + 6, (ALTAR_R + 6) * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = glow;
  ctx.strokeStyle = PALETTE.y;
  ctx.lineWidth = 2;
  ctx.stroke();
  // 寄っている動物 1 匹ごとに輪の半分を光らせ、2 匹目が要ることを見せる
  const r = CARRY_REACH * 0.7;
  c.near.forEach((on, k) => {
    ctx.globalAlpha = on ? 1 : 0.4;
    ctx.strokeStyle = on ? PALETTE.y : PALETTE.w;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 6, r, r * 0.55, 0, k * Math.PI + Math.PI / 2, (k + 1) * Math.PI + Math.PI / 2);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  const a = ITEM_ART.chest;
  ctx.drawImage(bake(a), Math.round(c.x - a.w), Math.round(c.y - a.h * 2 + 6), a.w * 2, a.h * 2);
  if (c.near.length > 1 && c.near.every(Boolean)) {
    const ang = Math.atan2(c.ay - c.y, c.ax - c.x);
    const arrow = ITEM_ART.arrow;
    ctx.save();
    ctx.translate(Math.round(c.x + Math.cos(ang) * 26), Math.round(c.y + Math.sin(ang) * 26));
    ctx.rotate(ang);
    ctx.drawImage(bake(arrow), -Math.floor(arrow.w / 2), -Math.floor(arrow.h / 2));
    ctx.restore();
  }
}
```

`draw-events.ts` の `treasureArrow` の上に足す（`edgeArrow`・`pulse`・`HURRY` は同じファイルにある）。

```ts
/** 画面の外の重い宝箱と祭壇への矢印。宝箱か祭壇の印と残り秒を画面の内側へ添える */
export function carryArrows(
  ctx: CanvasRenderingContext2D,
  w: World,
  vw: number,
  vh: number,
  top: number,
  now: number
): void {
  const c = w.carry;
  if (!c) return;
  const s = String(Math.ceil(c.life));
  ctx.globalAlpha = c.life > HURRY ? 1 : 0.45 + 0.55 * pulse(now);
  const box = edgeArrow(ctx, w, c, vw, vh, top);
  if (box) {
    const art = ITEM_ART.chest;
    const y = box.y > vh / 2 ? box.y - 6 - art.h - 7 : box.y + 6;
    ctx.drawImage(bake(art), box.x - Math.floor(art.w / 2), y);
    text(ctx, s, box.x - Math.round(textWidth(s) / 2), y + art.h + 1, PALETTE.y);
  }
  const altar = edgeArrow(ctx, w, { x: c.ax, y: c.ay }, vw, vh, top);
  if (altar) {
    const y = altar.y > vh / 2 ? altar.y - 12 : altar.y + 10;
    ctx.strokeStyle = PALETTE.y;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(altar.x, y, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
```

`HURRY` が `treasureArrow` の上で定義されているので、`carryArrows` は `HURRY` の定義の下に置く。

`draw.ts`

1. import に `import { drawCarry } from './draw-carry';` を足し、`draw-events` の import に `carryArrows` を足す。
2. `pickups(ctx, w, now);` の下に `drawCarry(ctx, w, now);` を足す。
3. `treasureArrow(ctx, w, v.w, v.h, top, now);` の下に `carryArrows(ctx, w, v.w, v.h, top, now);` を足す。

- [ ] **Step 2: 型と見た目の規則を通す**

Run: `pnpm check && pnpm lint`
Expected: エラーなし

- [ ] **Step 3: 全部のテストを通す**

Run: `pnpm test:run src/lib/games/animal-survivors`
Expected: 全部 PASS

- [ ] **Step 4: コミット**

```bash
git add src/lib/games/animal-survivors/draw-carry.ts src/lib/games/animal-survivors/draw-events.ts src/lib/games/animal-survivors/draw.ts
git commit -m "Draw the heavy chest, the altar, the carry ring and their edge arrows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 説明と画面の確かめ

**Files:**

- Modify: `CLAUDE.md`
- Create: `<scratchpad>/carry/shot.mjs`（commit しない）

- [ ] **Step 1: CLAUDE.md に足す**

アニマルサバイバーの段落の、宝の地図を説明している文（「間に合わなければ「宝箱が消えてしまった…」の帯を出し、」）の直後に足す。

```text
協力プレイで 2 匹がそろっているときは、宝の地図の代わりに重い宝箱（`carry.ts` の `World.carry`）を 2 匹のまん中から 120〜160 ドット先に、祭壇をそこからさらに 250〜300 ドット先に置き、2 匹とも立っていて宝箱から 36 ドット以内にいるあいだだけ宝箱が 2 匹のまん中へ歩く速さの 5.5 割で動く（障害物には入らない）。祭壇に届くと 2 匹それぞれに中身 3 つの宝箱（動物ごとの `big` を `openChest` が見る）とコイン 50 枚、60 秒で間に合わなければ沈んで消える（時計の品では減らない）。絵は `draw-carry.ts`（今の宝箱の 2 倍と地面の光る輪、寄っている動物ごとに半分光る輪）と、画面の端の `carryArrows`。
```

- [ ] **Step 2: 2 ページの通しで撮る**

`<scratchpad>/help/shot.mjs` を `<scratchpad>/carry/shot.mjs` に写し、つないで始めるところまではそのままにして、そのあとを次に置き換える。`CoopPlay.svelte` に一時的な口（`const world = given;` の下に `(globalThis as any).__w = world; // TEMP-OBS`）を入れる。

```js
// 親の World で重い宝箱を出す
await host.evaluate(async () => {
  const w = globalThis.__w;
  w.stage = { ...w.stage, waves: [] };
  for (const h of w.heroes) h.stats.maxHp = h.player.hp = 1e9;
  const { startCarry } = await import('/asobibako/src/lib/games/animal-survivors/carry.ts');
  startCarry(w);
});
await host.waitForTimeout(600);
await host.screenshot({ path: `${OUT}/1-host-spawn.png` });
// 2 匹を宝箱のそばへ（子の動物は子の World にも置く）
const near = await host.evaluate(() => {
  const w = globalThis.__w;
  const c = w.carry;
  w.heroes[0].player.x = c.x - 12;
  w.heroes[0].player.y = c.y;
  return { x: c.x + 12, y: c.y };
});
await guest.evaluate((p) => {
  const v = globalThis.__w;
  Object.assign(v.heroes[v.cur].player, p);
}, near);
await host.waitForTimeout(800);
await host.screenshot({ path: `${OUT}/2-host-carry.png` });
await guest.screenshot({ path: `${OUT}/2-guest-carry.png` });
// 祭壇の手前まで寄せてから届ける
await host.evaluate(() => {
  const w = globalThis.__w;
  const c = w.carry;
  c.x = c.ax;
  c.y = c.ay;
});
await host.waitForTimeout(800);
await host.screenshot({ path: `${OUT}/3-host-done.png` });
await guest.screenshot({ path: `${OUT}/3-guest-done.png` });
await browser.close();
```

撮り終えたら `sed -i '' '/TEMP-OBS/d' src/lib/games/animal-survivors/CoopPlay.svelte` で口を外す。

- [ ] **Step 3: 全体を通す**

Run: `pnpm verify`
Expected: exit 0

- [ ] **Step 4: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors heavy chest

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
