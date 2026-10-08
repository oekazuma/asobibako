# アニマルサバイバー 総点検 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 協力プレイが終盤に切れる不具合と、数の上限が無いことによる重さを直し、延長戦・限界突破・釜 9.0・夜の墓地の 4:00 のバランスをボットで測って直し、あと回しの小さな点 11 件を直す。

**Architecture:** 重さは `snap.ts`（送る範囲を子のまわりに絞り、数を抑える）・`zones.ts`（枠ごとの上限）・`draw.ts` / `draw-arms.ts`（画面の外を描かない）で直す。バランスは、限界突破の回数の効き方を `limit.ts` の 1 つの関数に、延長戦の伸び方を `overtime.ts` の 1 つの関数に、釜を `cauldron.ts` の 3 つの値に、夜の墓地を `bossRun` の引数に寄せ、その値をボットで決める。小さな点はそれぞれの場所で直す。

**Tech Stack:** TypeScript、Svelte 5、vitest、playwright-core（測定と撮影）

**Spec:** `docs/superpowers/specs/2026-10-09-animal-survivors-audit-design.md`

## Global Constraints

- 協力プレイの様子は、子の画面のまわり（画面の対角線ぶんの余白）の弾・効果・品・玉だけを送り、ダメージの数字は 60 個まで。1 回の大きさは 256KB を超えない
- 地面に残る炎とツタは、武器の枠 1 つにつき同時に 48 個まで。超えたら古いものから消す
- 弾・コイン・玉・品は画面の中（少しの余白つき）だけ描く
- 湯気の出る岩は 0.5 秒ごとに絵を入れ替える
- 延長戦の伸び方は 1 分ごとの掛け算。全部そろえたうまいボットで延長戦 20〜30 分（中央値）で倒れる。延長戦のコインの倍率は 4 倍まで
- 限界突破は同じ能力を上げるほど上がり幅が小さく、10:00 までのクリアの割合は今と同じくらい
- 夜の墓地の 4:00 のボスの体力を下げ、店半分で夜の墓地のクリアの割合が雪山と同じくらい
- 釜 9.0 は、全部そろえたうまいボットでクリアがおよそ 6〜7 割、適当なボットで 3 割ほど。賭けは 9.0 で 6000 枚くらい
- 店・装備・ガチャの値段は今回は変えない
- 小さな点 11 件（spec の表のとおり）
- コードコメントは非自明な WHY だけ。コンポーネントは 200 行未満。大群の中で点滅させない。1 人で遊ぶときの 10 分の回の手ざわりを変えない（炎とツタの上限・画面の外を描かないのは見た目が変わらない）

## Review Focus

- 炎とツタの上限で消えるのは、その枠のいちばん古いものだけで、ほかの枠や合わせ技の上限（`TWIST_ZONES`）は変わらない（Task 2 のテスト）
- 子の画面のまわりから外れた弾や品は、子の画面では消えたままになり、また近づけば出る（行の番号で写すので、消えた番号を生き返らせない。Task 1 のテスト）
- 限界突破の札の「今 +N → +N+1」の文が、頭打ちのあとの実際の上がり幅と合っている（Task 3 のテスト）
- 釜 9.0 の賭けを上げても、持っているコインを超えては上げられず、足りなければ払える強さまで下げる今の決まりのまま（Task 3 のテスト）
- 延長戦のコインの倍率が 4 倍で止まっても、HUD の倍率の字と記録のコインが合っている（Task 3 のテスト）

---

### Task 1: 協力プレイの様子を小さくする

**Files:**

- Modify: `src/lib/games/animal-survivors/snap.ts`
- Test: `src/lib/games/animal-survivors/snap-size.test.ts`

**Interfaces:**

- Produces（`snap.ts`）: `SNAP_HITS = 60`、`SNAP_ROWS = 600`、`near(w: World, x: number, y: number): boolean`（子のまわりか）

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/snap-size.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { applySnap, makeSnap, SNAP_HITS } from './snap';
import { addHero, createWorld, type GameEvent, type World } from './world';

const VIEW = { w: 274, h: 394 };

/** 終盤の重い様子。弾・効果・玉・品を何千と散らし、ダメージの数字を 800 個積む */
function heavy(): { w: World; events: GameEvent[] } {
  const w = createWorld('dog', 1, VIEW);
  addHero(w, 'cat');
  w.heroes[1].player.x = 0;
  w.heroes[1].player.y = 0;
  for (let i = 0; i < 1200; i++) {
    const x = ((i * 37) % 4000) - 2000;
    const y = ((i * 53) % 4000) - 2000;
    w.shots.push({
      alive: true,
      kind: 'shot',
      slot: 0,
      x,
      y,
      vx: 1,
      vy: 0,
      angle: 0,
      r: 3,
      age: 0,
      life: 1,
      hit: []
    } as never);
    w.effects.push({
      alive: true,
      kind: 'flame',
      slot: 0,
      x,
      y,
      age: 0,
      life: 3,
      r: 10,
      angle: 0,
      born: 0,
      dmg: 1,
      knock: 0
    } as never);
    w.gems.push({ alive: true, x, y, value: 1, pulled: false } as never);
    w.items.push({ alive: true, kind: 'coin', x, y, pulled: false } as never);
  }
  const events: GameEvent[] = Array.from({ length: 800 }, (_, i) => ({ type: 'hit', x: i, y: i, dmg: 5, crit: false }));
  events.push({ type: 'levelup' });
  return { w, events };
}

describe('協力プレイの様子の大きさ', () => {
  it('終盤の重い様子でも 256KB を十分に下回る', () => {
    const { w, events } = heavy();
    const bytes = JSON.stringify(makeSnap(w, events)).length;
    expect(bytes).toBeLessThan(200_000);
  });

  it('ダメージの数字は 60 個までにし、ほかの出来事は落とさない', () => {
    const { w, events } = heavy();
    const s = makeSnap(w, events);
    expect(s.events.filter((e) => e.type === 'hit')).toHaveLength(SNAP_HITS);
    expect(s.events.some((e) => e.type === 'levelup')).toBe(true);
  });

  it('子のまわりのものは送り、遠いものは送らない', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.heroes[1].player.x = 1000;
    w.heroes[1].player.y = 0;
    w.gems.push({ alive: true, x: 1010, y: 0, value: 1, pulled: false } as never);
    w.gems.push({ alive: true, x: -3000, y: 0, value: 1, pulled: false } as never);
    const s = makeSnap(w, []);
    expect(s.gems.map((r) => r[0])).toEqual([0]);
  });

  it('送らなかった玉は子の画面で消え、近づけばまた出る', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.gems.push({ alive: true, x: 0, y: 0, value: 1, pulled: false } as never);
    const view = createWorld('dog', 1, VIEW);
    addHero(view, 'cat');
    view.cur = 1;
    applySnap(view, JSON.parse(JSON.stringify(makeSnap(w, []))));
    expect(view.gems[0].alive).toBe(true);
    w.heroes[1].player.x = 5000;
    applySnap(view, JSON.parse(JSON.stringify(makeSnap(w, []))));
    expect(view.gems[0].alive).toBe(false);
    w.heroes[1].player.x = 0;
    applySnap(view, JSON.parse(JSON.stringify(makeSnap(w, []))));
    expect(view.gems[0].alive).toBe(true);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/snap-size.test.ts`
Expected: FAIL（`SNAP_HITS` が無い、大きさが 200KB を超える）

- [ ] **Step 3: 実装する**

`snap.ts`

1. `COOP_VERSION` の下に足す。

```ts
/** ダメージの数字は子の画面でも 60 個までしか出せない（effects.ts の MAX_NUMBERS）ので、それより多くは送らない */
export const SNAP_HITS = 60;
/** 種類ごとに送る行の上限。1 回の大きさをデータチャンネルの上限（256KB）より十分に下に保つ */
export const SNAP_ROWS = 600;

/** 子の動物のまわり（画面の半分に、画面の対角線ぶんの余白）にあるか。1 人のときはいつも true */
export function near(w: World, x: number, y: number): boolean {
  const g = w.heroes[1];
  if (!g) return true;
  const pad = Math.hypot(w.view.w, w.view.h);
  return Math.abs(x - g.player.x) < w.view.w / 2 + pad && Math.abs(y - g.player.y) < w.view.h / 2 + pad;
}
```

2. `makeSnap` の `rows` を次に置き換える（弾・効果・玉・品は子のまわりだけ、近い順に `SNAP_ROWS` まで。敵は今のまま全部）。

```ts
const rows = <T extends { alive: boolean }>(list: T[], row: (o: T) => Row) =>
  list.flatMap((o, i) => (o.alive ? [[i, ...row(o)]] : []));
const around = <T extends { alive: boolean; x: number; y: number }>(list: T[], row: (o: T) => Row) => {
  const g = w.heroes[1]?.player;
  const picked = list.flatMap((o, i) => (o.alive && near(w, o.x, o.y) ? [i] : []));
  if (g && picked.length > SNAP_ROWS)
    picked.sort(
      (a, b) => (list[a].x - g.x) ** 2 + (list[a].y - g.y) ** 2 - ((list[b].x - g.x) ** 2 + (list[b].y - g.y) ** 2)
    );
  return picked.slice(0, SNAP_ROWS).map((i) => [i, ...row(list[i])]);
};
let hits = 0;
const sent = events.filter((e) => e.type !== 'hit' || hits++ < SNAP_HITS);
```

3. `shots: rows(w.shots, ...)`・`effects: rows(w.effects, ...)`・`gems: rows(w.gems, ...)`・`items: rows(w.items, ...)` の `rows` を `around` にする。`events` を `events: sent` にする。

宝の地図の宝箱（`treasure`）は品の行の番号で送るので、遠くて送らなかった回は子の画面で `null` になる（今の `applySnap` の `view.items[s.treasure] ?? null` のまま）。協力プレイでは宝の地図は重い宝箱に変わるので出ない。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/snap-size.test.ts src/lib/games/animal-survivors/snap.test.ts src/lib/games/animal-survivors/coop.test.ts`
Expected: PASS（今の snap のテストで、遠い場所に置いたものを送る前提のものが落ちたら、その位置を子のそばへ寄せる）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/snap.ts src/lib/games/animal-survivors/snap-size.test.ts
git commit -m "Send only what is near the guest in co-op snaps and cap damage numbers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 炎とツタの上限・画面の外を描かない・湯気の岩

**Files:**

- Modify: `src/lib/games/animal-survivors/zones.ts`（`ZONE_CAP`）
- Modify: `src/lib/games/animal-survivors/draw.ts`（`pickups` と `shots` に画面の範囲）
- Modify: `src/lib/games/animal-survivors/draw-arms.ts`（`shots` に画面の範囲）
- Modify: `src/lib/games/animal-survivors/draw-obstacles.ts`（湯気のコマ）
- Test: `src/lib/games/animal-survivors/audit-draw.test.ts`

**Interfaces:**

- Produces: `ZONE_CAP = 48`（`zones.ts`）、`inView(x: number, y: number, cx: number, cy: number, vw: number, vh: number, pad?: number): boolean` と `steamFrame(now: number, n: number): number`（`draw-obstacles.ts`。名前が同じ `inView` が既にあれば `onScreen` とする）

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/audit-draw.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { onScreen, steamFrame } from './draw-obstacles';
import { ZONE_CAP, flameAt, vineAt } from './zones';
import { createWorld } from './world';

const stats = { damage: 1, cooldown: 1, amount: 1, area: 1, speed: 1, pierce: 1, duration: 3, knockback: 0 };

describe('炎とツタの上限', () => {
  it('枠ごとに 48 個までで、超えたら同じ枠のいちばん古いものから消え、ほかの枠は消えない', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    vineAt(w, 3, 0, 0, 1, stats);
    for (let i = 0; i < ZONE_CAP + 5; i++) {
      w.time = i;
      flameAt(w, 1, i, 0, 1, stats);
    }
    const mine = w.effects.filter((f) => f.alive && f.slot === 1);
    expect(mine).toHaveLength(ZONE_CAP);
    expect(Math.min(...mine.map((f) => f.born))).toBe(5);
    expect(w.effects.filter((f) => f.alive && f.slot === 3)).toHaveLength(1);
  });
});

describe('画面の範囲', () => {
  it('画面の中と余白の中だけ描く', () => {
    expect(onScreen(10, 10, 0, 0, 260, 380)).toBe(true);
    expect(onScreen(-20, 10, 0, 0, 260, 380)).toBe(true);
    expect(onScreen(-80, 10, 0, 0, 260, 380)).toBe(false);
    expect(onScreen(10, 500, 0, 0, 260, 380)).toBe(false);
  });
});

describe('湯気の出る岩', () => {
  it('0.5 秒ごとに絵を入れ替える（now は秒）', () => {
    expect(steamFrame(0.1, 2)).toBe(0);
    expect(steamFrame(0.6, 2)).toBe(1);
    expect(steamFrame(1.1, 2)).toBe(0);
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/audit-draw.test.ts`
Expected: FAIL（`ZONE_CAP`・`onScreen`・`steamFrame` が無い）

- [ ] **Step 3: 実装する**

`zones.ts`

1. `ROOT` の下に足す。

```ts
/** 地面に残る炎とツタの、武器の枠 1 つあたりの上限。合体と限界突破で 1000 を超えて重くなったため */
export const ZONE_CAP = 48;
```

2. `zone()` の `const free = w.effects.findIndex((f) => !f.alive);` の上に足す。

```ts
let count = 0;
let oldest: Effect | null = null;
for (const f of w.effects) {
  if (!f.alive || f.slot !== slot || (f.kind !== 'flame' && f.kind !== 'vine')) continue;
  count++;
  if (!oldest || f.born < oldest.born) oldest = f;
}
if (count >= ZONE_CAP && oldest) oldest.alive = false;
```

`draw-obstacles.ts`

1. 足す。

```ts
/** 描く範囲（画面の左上 cx・cy と大きさ）に、絵の大きさぶんの余白を足した中か */
export function onScreen(x: number, y: number, cx: number, cy: number, vw: number, vh: number, pad = 48): boolean {
  return x > cx - pad && x < cx + vw + pad && y > cy - pad && y < cy + vh + pad;
}

/** 湯気の 2 コマを入れ替える番号（now は秒）。ゆっくり入れ替えて、明滅ではなく形の揺れに見せる */
export const steamFrame = (now: number, n: number) => (n > 1 ? Math.floor(now / 0.5) % n : 0);
```

2. 湯気のコマの行を `const frame = steamFrame(now, art.frames.length);` にする（上のコメントの行は消す）。

`draw.ts`

1. `pickups` の形を `function pickups(ctx: CanvasRenderingContext2D, w: World, now: number, cx: number, cy: number, v: ViewSize)` にし、玉と品のそれぞれの頭で `if (!onScreen(g.x, g.y, cx, cy, v.w, v.h)) continue;`（品は `it.x`・`it.y`）を足す。呼び出しを `pickups(ctx, w, now, cx, cy, v);` にする。
2. `shots(ctx, w, q);` を `shots(ctx, w, q, cx, cy, v.w, v.h);` にする。
3. import に `onScreen` を足す。

`draw-arms.ts` の `shots` の形を `export function shots(ctx: CanvasRenderingContext2D, w: World, q: Snap, cx: number, cy: number, vw: number, vh: number): void` にし、`if (!o.alive) continue;` を `if (!o.alive || !onScreen(o.x, o.y, cx, cy, vw, vh)) continue;` にする（import に `onScreen`）。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/audit-draw.test.ts && pnpm check`
Expected: PASS、型のエラーなし

Run: `pnpm test:run src/lib/games/animal-survivors`
Expected: 全部 PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/zones.ts src/lib/games/animal-survivors/draw.ts src/lib/games/animal-survivors/draw-arms.ts src/lib/games/animal-survivors/draw-obstacles.ts src/lib/games/animal-survivors/audit-draw.test.ts
git commit -m "Cap flames and vines per slot, skip drawing off-screen shots and pickups, and fix the steam frames

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: バランスの口（値はまだ仮）

**Files:**

- Modify: `src/lib/games/animal-survivors/limit.ts`（`limitCount`・`LIMIT_SOFT`）
- Modify: `src/lib/games/animal-survivors/choice-view.ts`（限界突破の札の文）
- Modify: `src/lib/games/animal-survivors/overtime.ts`（`OT_GROW`・`otScale`）
- Modify: `src/lib/games/animal-survivors/drops.ts`（`OVERTIME_MAX`）
- Modify: `src/lib/games/animal-survivors/cauldron.ts`（`HP_AT9`・`ATK_AT9`・`MAX_BET` を export）
- Modify: `src/lib/games/animal-survivors/stages/forest.ts`、`stages/graveyard.ts`（`bossRun` の 4:00 の体力）
- Test: `src/lib/games/animal-survivors/audit-balance.test.ts`

**Interfaces:**

- Produces
  - `limit.ts`: `LIMIT_SOFT`、`limitCount(n: number): number`（頭打ちのあとの効く回数。`n / (1 + n / LIMIT_SOFT)`）
  - `overtime.ts`: `OT_GROW`、`otScale(t: number, from: number): number`（`OT_GROW ** ((t - from) / 60)`）
  - `drops.ts`: `OVERTIME_MAX = 4`
  - `cauldron.ts`: `HP_AT9`・`ATK_AT9`・`MAX_BET`
  - `bossRun(a, b, title, hp4 = 0.6)`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/audit-balance.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { cardInfo } from './choice-view';
import { betOf, MAX_BET } from './cauldron';
import { OVERTIME_MAX, overtimeRate } from './drops';
import { LIMIT_SOFT, limitCount, limitStats, STEP } from './limit';
import { otScale } from './overtime';
import { STAGES } from './stages';
import { createWorld } from './world';

describe('限界突破の頭打ち', () => {
  it('少ない回数ではほぼそのまま、上げるほど伸びが小さくなり、上限を超えない', () => {
    expect(limitCount(0)).toBe(0);
    expect(limitCount(1)).toBeGreaterThan(0.85);
    for (let n = 1; n < 200; n++)
      expect(limitCount(n + 1) - limitCount(n)).toBeLessThan(limitCount(n) - limitCount(n - 1) + 1e-9);
    expect(limitCount(10_000)).toBeLessThan(LIMIT_SOFT);
  });

  it('ダメージの倍率は頭打ちの回数で掛ける', () => {
    const s = { damage: 10, cooldown: 1, amount: 1, area: 1, speed: 1, pierce: 1, duration: 1, knockback: 0 };
    expect(limitStats(s, { damage: 20 }).damage).toBeCloseTo(10 * (1 + STEP.damage * limitCount(20)));
  });

  it('札の文は、次の 1 回で実際に上がるぶんを出す', () => {
    const c = { kind: 'limit' as const, id: 'woof', stat: 'damage' as const, now: 30 };
    const gain = Math.round(STEP.damage * (limitCount(31) - limitCount(30)) * 100);
    expect(cardInfo(c).text).toContain(`+${gain}%`);
  });
});

describe('延長戦', () => {
  it('伸び方は 1 分ごとの掛け算', () => {
    expect(otScale(600, 600)).toBe(1);
    expect(otScale(720, 600) / otScale(660, 600)).toBeCloseTo(otScale(660, 600));
  });

  it('コインの倍率は 4 倍で止まる', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 });
    w.overtime = { from: 600, base: {} as never, coins: 0, retreat: false };
    w.time = 600 + 60 * 60;
    expect(overtimeRate(w)).toBe(OVERTIME_MAX);
  });
});

describe('釜と夜の墓地', () => {
  it('9.0 の賭けは MAX_BET', () => {
    expect(betOf(9)).toBe(MAX_BET);
  });

  it('夜の墓地の 4:00 のボスの体力は、ほかの面の 4:00 より低い', () => {
    const hp4 = (id: string) => STAGES.find((s) => s.id === id)!.bosses.find((b) => b.at === 240)!.hp!;
    expect(hp4('graveyard')).toBeLessThan(hp4('snow'));
  });
});
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/audit-balance.test.ts`
Expected: FAIL（`limitCount`・`otScale`・`OVERTIME_MAX`・`MAX_BET` の export が無い）

- [ ] **Step 3: 実装する（値は仮。Task 4 でボットで決める）**

`limit.ts`

1. `COOL_FLOOR` の下に足す。

```ts
/** 頭打ちの強さ。上げた回数 n は n / (1 + n / LIMIT_SOFT) 回ぶんだけ効く（延長戦で上限なく強くなるのを止める） */
export const LIMIT_SOFT = 10;
export const limitCount = (n: number) => n / (1 + n / LIMIT_SOFT);
```

2. `limitStats` の中の `n('damage')` などの回数を、すべて `limitCount(n('…'))` にする（数 `amount` だけは `Math.floor(limitCount(n('amount')))`）。

`choice-view.ts` の限界突破の札の文を次にする（import に `limitCount, STEP` を足す）。

```ts
      text: `${limitGain(c.stat, c.now)}（今 +${c.now} → +${c.now + 1}）`,
```

`limit.ts` に足す（`LIMIT_TEXT` の下）。

```ts
/** 次の 1 回で実際に上がるぶんの文（頭打ちのあとの伸び） */
export function limitGain(stat: LimitStat, now: number): string {
  const d = limitCount(now + 1) - limitCount(now);
  if (stat === 'amount') return `数 +${Math.floor(limitCount(now + 1)) - Math.floor(limitCount(now))}`;
  if (stat === 'cooldown') return `待ち時間 −${pct(1 - (1 - STEP.cooldown) ** d)}`;
  const name = { damage: 'ダメージ', area: '大きさ', speed: '速さ', duration: '時間' }[stat];
  return `${name} +${pct(STEP[stat] * d)}`;
}
```

`choice-view.ts` の import は `limitGain` にする（`LIMIT_TEXT` を使うところがほかに無ければ外す）。

`overtime.ts`

1. `RAMP` を次に置き換える。

```ts
/** 延長戦の敵の硬さと攻撃に、1 分ごとに掛ける倍率（足し算だと全部そろえた動物がいつまでも倒れなかった） */
export const OT_GROW = 1.25;
export const otScale = (t: number, from: number) => OT_GROW ** (Math.max(0, t - from) / 60);
```

2. `ramp` を `const ramp = (f: (t: number) => number) => (t: number) => f(t) * otScale(t, from);` にする。

`drops.ts`

1. `OVERTIME_STEP` の下に `export const OVERTIME_MAX = 4;` を足す。
2. `overtimeRate` を `Math.min(OVERTIME_MAX, 1 + OVERTIME_STEP * Math.floor((w.time - w.overtime.from) / 60))` にする（延長戦でないときは今のまま 1）。

`cauldron.ts`

1. `const MAX_BET = 1500;` を `export const MAX_BET = 6000;` にする。
2. `export const HP_AT9 = 4;` と `export const ATK_AT9 = 2.5;` を足し、`hpMul` を `bend(h, 0.6, HP_AT9)`、`atkMul` を `bend(h, 0.7, ATK_AT9)` にする。

`stages/forest.ts` の `bossRun` を `(a: BossId, b: BossId, title: string, hp4 = 0.6)` にし、4:00 の行の `hp: 0.6` を `hp: hp4` にする。`stages/graveyard.ts` の呼び出しを `bossRun('knight', 'pumpkin', '墓地の主', 0.4)` にする。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/audit-balance.test.ts`
Expected: PASS

Run: `pnpm test:run src/lib/games/animal-survivors && pnpm check`
Expected: 全部 PASS（値を固めていたテスト（`RAMP`・限界突破の倍率・釜の倍率・賭け）が落ちたら、定数から読む形に直す）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/limit.ts src/lib/games/animal-survivors/choice-view.ts src/lib/games/animal-survivors/overtime.ts src/lib/games/animal-survivors/drops.ts src/lib/games/animal-survivors/cauldron.ts src/lib/games/animal-survivors/stages/forest.ts src/lib/games/animal-survivors/stages/graveyard.ts src/lib/games/animal-survivors/audit-balance.test.ts
git commit -m "Soften limit break, make overtime grow per minute, cap its coin rate, toughen heat 9 and ease the graveyard 4:00 boss

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: ボットで値を決める

**Files:**

- Modify（値だけ）: `limit.ts` の `LIMIT_SOFT`、`overtime.ts` の `OT_GROW`、`cauldron.ts` の `HP_AT9`・`ATK_AT9`・`MAX_BET`、`stages/graveyard.ts` の `hp4`
- 使う: scratchpad の `balance/run.sim.ts`・`balance/econ.sim.ts`・`balance/sum.mjs`・`balance/tables.mjs`（測定の係が作ったボット。うまい `smart` と適当な `casual`）

- [ ] **Step 1: ボットの台本を確かめる**

`<scratchpad>/balance/run.sim.ts` を読み、環境変数で ステージ・釜・店・装備・遺物・ボット・延長戦の上限 を選べることを確かめる。値を試すときは、[[balance-sim-harness]] の「案を並べて試すときは src/lib を scratchpad/var/<名前> に写して、それぞれの sim から読む」形で、写しの定数だけを `sed` で変える（リポジトリの値は決まってから 1 回だけ直す）。

- [ ] **Step 2: 測る**

それぞれ seeds 1..12。

1. 限界突破（`LIMIT_SOFT` を 6・10・15 で）: 全部そろえた smart・森と墓地・釜 2.0 の 10:00 のクリアの割合（今と比べて 1〜2 回の揺れの中）と、延長戦で 1 つの武器のダメージの倍率。
2. 延長戦（`OT_GROW` を 1.15・1.2・1.25・1.3 で、限界突破は 1 で決めた値）: 全部そろえた smart・4 ステージ・釜 2.0・延長戦の上限 60 分の、延長戦の秒の中央値（20〜30 分に入る値を選ぶ）と、1 回のコイン。
3. 釜 9.0（`HP_AT9` 3.5・4・4.5、`ATK_AT9` 2.2・2.5・2.8）: 全部そろえた smart と casual・4 ステージの 10:00 のクリアの割合（smart 6〜7 割、casual 3 割ほど）。
4. 夜の墓地の 4:00（`hp4` 0.3・0.4・0.5）: 店半分の smart と casual・墓地と雪山・釜 2.0 のクリアの割合（墓地が雪山と同じくらい）。

結果は `<scratchpad>/balance/audit-<名前>.json` に残す。

- [ ] **Step 3: 値を入れる**

決めた値をリポジトリの定数に入れる。ledger に、試した値ごとの数字を 1 行ずつ残す（例 `Task 4: OT_GROW 1.2 → smart veteran OT median 27 min (forest 25, grave 29, snow 26, volcano 28)`）。

- [ ] **Step 4: テストを通す**

Run: `pnpm test:run src/lib/games/animal-survivors`
Expected: 全部 PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors/limit.ts src/lib/games/animal-survivors/overtime.ts src/lib/games/animal-survivors/cauldron.ts src/lib/games/animal-survivors/stages/graveyard.ts
git commit -m "Tune overtime, limit break, heat 9 and the graveyard 4:00 boss with bots

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

（値を変えなかった定数は、ledger に「仮の値のまま」と数字を残す）

---

### Task 5: 小さな点（協力プレイまわり）

**Files:**

- Modify: `hud.ts`（ゲージの色・相棒の有無）、`draw-boss.ts`（`barsTop` の相棒の有無）、`link.ts`（`Link.calm`）、`draw.ts`（技のあとの半透明）、`draw-events.ts`（右端の矢印をボタンの高さから外す）、`prompts.svelte.ts`（帯の時計）
- Test: `src/lib/games/animal-survivors/audit-coop.test.ts`

**Interfaces:**

- Produces: `hasMate(w: World): boolean`（`heroes.ts`。抜けていない相棒がいる）、`Link.calm: number`（技のあと半透明にしない秒）、`BUTTON_BAND = 28`（`draw-events.ts`）

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/audit-coop.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { barsTop } from './draw-boss';
import { BUTTON_BAND, edgeAt } from './draw-events';
import { hasMate } from './heroes';
import { fireLink, LINK_INVULN } from './link';
import { Prompts } from './prompts.svelte';
import { addHero, createWorld } from './world';

const VIEW = { w: 260, h: 380 };

describe('協力プレイまわりの小さな点', () => {
  it('相棒が抜けたら、ボスの体力バーは 1 人のときの位置に戻る', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    expect(hasMate(w)).toBe(true);
    w.heroes[1].gone = w.heroes[1].down = true;
    expect(hasMate(w)).toBe(false);
    expect(barsTop(w, 24)).toBe(24 + 22);
  });

  it('連携の技のあとは、当たらないあいだも半透明にしない秒を持つ', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    fireLink(w);
    expect(w.link.calm).toBeGreaterThanOrEqual(LINK_INVULN);
  });

  it('右端の矢印は、いっしょに！のボタンの高さを避ける', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    const at = edgeAt(w, { x: w.player.x + 2000, y: w.player.y }, VIEW.w, VIEW.h, 24)!;
    expect(Math.abs(at.y - VIEW.h / 2)).toBeGreaterThanOrEqual(BUTTON_BAND);
  });

  it('止めている 1 秒のあいだに一時停止しても、帯は消えない（ゲームが進んだぶんだけ時計を進める）', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    const p = new Prompts(w);
    w.link.fuse = 0.8;
    w.events.push({ type: 'link', a: 'dog', b: 'cat', name: 'X' });
    p.take();
    for (let i = 0; i < 300; i++) p.next(null, 1 / 60);
    expect(p.link).not.toBeNull();
  });
});
```

（`prompts.svelte.ts` を読むので、ファイル名は `audit-coop.svelte.test.ts` にする）

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/audit-coop.svelte.test.ts`
Expected: FAIL（`hasMate`・`BUTTON_BAND`・`calm` が無い、帯が消える）

- [ ] **Step 3: 実装する**

`heroes.ts` に足す。

```ts
/** 抜けていない相棒がいる（自分の端末から見て） */
export const hasMate = (w: World) => w.heroes.some((h, k) => k !== w.cur && !h.gone);
```

`draw-boss.ts` の `barsTop` の `w.heroes.length > 1` を `hasMate(w)` にする。`hud.ts` の連携のゲージと相棒の行の `w.heroes.length > 1` も `hasMate(w)` にし、ゲージの色を `linkReady(w) ? PALETTE.y : PALETTE.Y` にする（コメントは「満タンで使えるときだけ明るい黄色」）。

`link.ts`

1. `Link` に `/** 技のあと、当たらないあいだも半透明にしない秒（被弾の無敵と見分ける） */ calm: number;` を足し、`calmLink()` に `calm: 0` を足す。
2. `fireLink` の終わり（`finally` の上）に `w.link.calm = LINK_INVULN;` を足す。
3. `stepLink` の止めていないときの `l.cool = ...` の下に `l.calm = Math.max(0, l.calm - dt);` を足す。

`draw.ts` の `ctx.globalAlpha = heroAlpha(p.invuln, moment, w.heroes[w.cur].down);` を `heroAlpha(p.invuln, moment || w.link.calm > 0, w.heroes[w.cur].down)` にする。

`draw-events.ts`

1. 足す。

```ts
/** 協力プレイの右端の真ん中にある「いっしょに！」のボタンの、上下の半分の高さ（矢印を重ねない） */
export const BUTTON_BAND = 28;
```

2. `edgeAt` の返す前に、`hasMate(w)` で右の端（`at.x >= vw - 15`）かつ `Math.abs(at.y - vh / 2) < BUTTON_BAND` なら、`at.y = vh / 2 + (at.y < vh / 2 ? -BUTTON_BAND : BUTTON_BAND)` にする。

`prompts.svelte.ts`

1. `#seen = { fuse: 0, time: 0 };` を足す。
2. `next()` の帯の時計を次にする（一時停止のあいだはゲームの時刻も止めの秒も動かないので、帯の時計も進めない）。

```ts
if (this.link) {
  const w = this.#w;
  const moved = w.link.fuse !== this.#seen.fuse || w.time !== this.#seen.time;
  this.#seen = { fuse: w.link.fuse, time: w.time };
  if (moved) this.link.t += dt;
  if (this.link.t >= LINK_FUSE + LINK_SHOW) this.link = null;
}
```

テストの 300 フレームのあいだは `w.link.fuse` も `w.time` も変えないので、帯は残る。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/audit-coop.svelte.test.ts src/lib/games/animal-survivors/link.svelte.test.ts src/lib/games/animal-survivors/link-hud.test.ts`
Expected: PASS（`link.svelte.test.ts` の「止めと絵のぶんが過ぎたら消す」は、`w.time` を進めてから `next` を呼ぶ形に直す）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Tidy co-op details: gauge colour, no fade after the link move, arrows off the button, plate on pause, boss bars after a guest leaves

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 小さな点（重い宝箱・記録・祠・札の文）

**Files:**

- Modify: `carry.ts`（揺れ）、`draw-carry.ts` と `draw.ts`（宝箱を足もとの順で描く）、`CoopStats.svelte`（じぶん）、`records.ts`（短い回）、`heroes.ts` と `shrines.ts` と `world.ts`（祠を動物ごとに数える）、`limit.ts`（回る武器の待ち時間の文）
- Test: `src/lib/games/animal-survivors/audit-small.test.ts`、`src/lib/games/animal-survivors/coop-stats.svelte.test.ts`

**Interfaces:**

- Produces: `Hero.shrines`（`HERO_KEYS` の `shrineCount`。その動物が使った祠の数）、`drawCarryChest(ctx, w, q)`（`draw-carry.ts`。宝箱と向きの矢印だけ）、`COOP_MIN_SECS = 60`（`records.ts`）

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/games/animal-survivors/audit-small.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { startCarry, stepCarry } from './carry';
import { limitGain } from './limit';
import { obstacleAt } from './obstacles';
import { COOP_MIN_SECS, emptyRecords, record } from './records';
import { shrineAt, touchShrines } from './shrines';
import { addHero, createWorld, summary } from './world';

const VIEW = { w: 260, h: 380 };

describe('小さな点', () => {
  it('重い宝箱を障害物へ押しつけても、行ったり来たりしない', () => {
    const w = createWorld('dog', 3, VIEW);
    addHero(w, 'cat');
    startCarry(w);
    const c = w.carry!;
    let o = null;
    for (let k = 1; !o; k++) o = obstacleAt(w.stage.art, k, 0);
    Object.assign(c, { x: o.x - 30, y: o.y });
    const xs: number[] = [];
    for (let i = 0; i < 120; i++) {
      w.heroes[0].player.x = w.heroes[1].player.x = c.x + 20;
      w.heroes[0].player.y = c.y - 5;
      w.heroes[1].player.y = c.y + 5;
      stepCarry(w, 1 / 30);
      xs.push(c.x);
    }
    const back = xs.slice(60).filter((x, i, a) => i > 0 && x < a[i - 1] - 0.01).length;
    expect(back).toBe(0);
  });

  it('60 秒より短い 2 人の回は、遊んだ回数と組み合わせに数えない', () => {
    const r = emptyRecords();
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    w.time = COOP_MIN_SECS - 1;
    record(r, summary(w));
    expect(r.coop.runs).toBe(0);
    expect(r.coop.pairs).toEqual([]);
  });

  it('祠めぐりは、祠を使った動物ごとに数える', () => {
    const w = createWorld('dog', 1, VIEW);
    addHero(w, 'cat');
    let s = null;
    for (let c = 1; !s; c++) s = shrineAt('forest', c, 0);
    w.heroes[0].player.x = s.x;
    w.heroes[0].player.y = s.y;
    touchShrines(w);
    expect(summary(w).shrines).toBe(1);
    w.cur = 1;
    expect(summary(w).shrines).toBe(0);
    w.cur = 0;
  });

  it('回る武器の待ち時間の札は、回り終えてからの待ち時間と書く', () => {
    expect(limitGain('cooldown', 0, 'orbit')).toContain('回り終えてから');
    expect(limitGain('cooldown', 0, 'shot')).not.toContain('回り終えてから');
  });
});
```

`coop-stats.svelte.test.ts` の「2 匹の数と称号、連携の技と運んだ数を出す」に足す。

```ts
expect(target.querySelector('[aria-current="true"]')?.textContent).toContain('じぶん');
```

- [ ] **Step 2: 落ちることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/audit-small.test.ts src/lib/games/animal-survivors/coop-stats.svelte.test.ts`
Expected: FAIL

- [ ] **Step 3: 実装する**

`carry.ts` の運ぶところを次にする（押し出しで少ししか進めないときは、前の位置にとどまる）。

```ts
if (len > 0) {
  const was = { x: c.x, y: c.y };
  c.x += (dx / len) * go;
  c.y += (dy / len) * go;
  pushOut(w.stage.art, c, CARRY_R);
  // 2 つの障害物のあいだで押し出しが行き来すると揺れて見えるので、ほとんど進めないなら動かさない
  if (Math.hypot(c.x - was.x, c.y - was.y) < go * 0.3) Object.assign(c, was);
}
```

`draw-carry.ts`: `drawCarry` から宝箱と向きの矢印を `drawCarryChest(ctx, w, q)` に分ける（`drawCarry` は祭壇と輪だけ）。`draw.ts`: `enemies()` に `chest?: { feet: number; draw: () => void }` を足し、`byFeet` の並びを描くループで、足もとがその `feet` を超える最初のものの前に一度だけ `chest.draw()` を呼ぶ（最後まで呼ばれなければループのあとで呼ぶ）。`draw()` から `w.carry ? { feet: w.carry.y + 6, draw: () => drawCarryChest(ctx, w, q) } : undefined` を渡す。

`CoopStats.svelte`: 自分の列（`i === coop.me`）に `aria-current="true"` を付け、名前の下に `<small>じぶん</small>` を出す。

`records.ts`

1. `export const COOP_MIN_SECS = 60;`（60 秒より短い回は、すぐ抜けて組み合わせを稼げるので数えない）を足す。
2. `record()` の `if (c) {` を `if (c && run.time >= COOP_MIN_SECS) {` にする。

`heroes.ts` の `HERO_KEYS` に `'shrineCount'` を足し、`world.ts` の `World` に `/** その動物が使った祠の数 */ shrineCount: number;`、`makeHero` に `shrineCount: 0` を足す。`shrines.ts` の `touchShrines` の `w.shrinesUsed.push(s.key);` の下に `w.shrineCount += 1;` を足す。`summary()` の `shrines: w.shrinesUsed.length` を `shrines: w.shrineCount` にする。

`limit.ts` の `limitGain` に 3 つめの引数 `kind?: WeaponKind` を足し、待ち時間で `kind === 'orbit'` なら `回り終えてからの待ち時間 −…` と書く。`choice-view.ts` から `limitGain(c.stat, c.now, WEAPONS[c.id].kind)` で呼ぶ。

- [ ] **Step 4: 通ることを見る**

Run: `pnpm vitest run src/lib/games/animal-survivors/audit-small.test.ts src/lib/games/animal-survivors/coop-stats.svelte.test.ts`
Expected: PASS

Run: `pnpm test:run src/lib/games/animal-survivors && pnpm check && pnpm lint`
Expected: 全部 PASS（短い回のテストで 60 秒より短い 2 人の回を記録しているものは、`w.time` を 60 秒以上にする）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/animal-survivors
git commit -m "Tidy small points: steady heavy chest, chest drawn by its feet, me label, short co-op runs, per-hero shrines, orbit cooldown text

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 説明と確かめ

**Files:**

- Modify: `CLAUDE.md`
- 使う: scratchpad の `perf/`（測定の係の台本）・`records/shot.mjs`

- [ ] **Step 1: CLAUDE.md を直す**

アニマルサバイバーの段落の、次の数字と決まりを今の値に直す（`grep` で見つけて書き換える）。

- 延長戦の `RAMP`（足し算）の文を、`OT_GROW` の掛け算と、延長戦のコインの倍率が `OVERTIME_MAX` で止まることに
- 限界突破の上がり幅の文に、`limitCount` の頭打ち（`LIMIT_SOFT`）を
- 釜の「9.0 で 1500 枚」を `MAX_BET` の値に
- 夜の墓地の 4:00 の体力（`bossRun` の 4 つめの引数）
- 合わせ技の上限の文の近くに、地面の炎とツタの枠ごとの上限 `ZONE_CAP`
- snap の「敵 400 体と玉 400 個でも 25KB 未満」を、子のまわりだけ・ダメージの数字 60 個まで・種類ごと `SNAP_ROWS` までにした文に
- 祠めぐりを動物ごとに数えること、60 秒より短い 2 人の回は記録しないこと

- [ ] **Step 2: 重さを測り直す**

`<scratchpad>/perf/run-all.mjs` で、直す前と同じ場面（a〜f、WebKit と Chrome、倍率 6）を測り直し、直す前の表と並べる。協力プレイの様子の大きさ（いちばん重い場面で 200KB 未満）も記録する。

- [ ] **Step 3: 画面を撮る**

`<scratchpad>/records/shot.mjs` を写し、協力プレイの終盤（合体武器と限界突破を持たせ、敵を多く）・連携のゲージ（満タン）・ふたりの活躍（じぶん）を撮る。

- [ ] **Step 4: 全体を通す**

Run: `pnpm verify`
Expected: exit 0

- [ ] **Step 5: コミット**

```bash
git add CLAUDE.md
git commit -m "Describe the Animal Survivors audit changes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
