# Animal Survivors 釜 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ステージを選んだあとの「まじょの釜」で強さ 0.0〜9.0 を選び、2.0 より上はコインを賭けて、強い敵と多いコイン・豪華な宝箱に挑めるようにする。

**Architecture:** 強さから倍率と賭けを出す純粋な `cauldron.ts` を作り、`createWorld` が受けた強さで面の表を写す（体力・攻撃・ヌシの体力・コインの倍率）。宝箱の割合は `chest.ts` が `w.heat` から引く。賭けの引き落としは `records.ts` の `payHeat()`、戻しは `record()`。画面は `Cauldron.svelte` を足し、`Survivors.svelte` がステージを選ぶ画面とプレイのあいだに挟む。

**Tech Stack:** SvelteKit（Svelte 5 runes）、TypeScript、vitest（unit と dom）、scratchpad のボット

**Spec:** `docs/superpowers/specs/2026-10-04-animal-survivors-cauldron-design.md`

## Global Constraints

- 強さは 0.0〜9.0 の 0.1 刻み。2.0 が今の難しさで、2.0 では今とまったく同じ表・宝箱・コインになる。
- 賭けは 2.0 より上だけ。持っているコインを超えない。コインは負にならない。
- 日替わりお題の回は釜を出さず、強さ 2.0・賭け 0。
- 図鑑・お題・実績のごほうびに強さのコインの倍率を掛けない。
- 新しい絵（釜）は作る前に見本を利用者に見せて、決まるまで使わない。
- コンポーネントは 200 行未満、props は 6 つまで。コードコメントは非自明な WHY だけ。`pnpm verify` が通ること。

## Review Focus

- 「もう一度」や「やり直し」のときにコインが足りない → 払える強さまで下げて始まる（Task 2 の `payHeat` のテスト）。
- 強さの表示が 4.499999 のように崩れない（Task 1 の `snap` と `heatLabel` のテスト）。
- 延長戦のあとの 2 回めの記録で賭けを二重に戻さない（Task 2 のテスト）。
- お題の回で釜を通らず賭けもしない（Task 3 の dom テスト）。
- 古い記録（`heat` が無い）を読める（Task 2 のテスト）。

---

### Task 1: 強さの倍率と、遊ぶ世界への反映

**Files:**

- Create: `src/lib/games/animal-survivors/cauldron.ts`
- Modify: `world.ts`（`createWorld` の 7 つめの引数、`World.heat`、`summary` の `heat`）、`chest.ts`（`chestSize` に割合を渡す）
- Test: `src/lib/games/animal-survivors/cauldron.test.ts`

**Interfaces:**

- Produces:
  - `export interface Heat { level: number; bet: number }`
  - `export const PLAIN: Heat = { level: 2, bet: 0 }`
  - `snap(h: number): number`（0..9 に収め 0.1 に丸める）
  - `heatLabel(h: number): string`（`'4.5'`）
  - `hpMul(h)`, `atkMul(h)`, `coinMul(h)`, `betOf(h)`, `chestOdds(h): { one: number; three: number }`
  - `maxHeat(coins: number): number`（払える最大の強さ）
  - `heatStage(s: Stage, h: number): Stage`
  - `createWorld(id, seed, view, ranks, stageId, challenge?, heat: Heat = PLAIN)`、`World.heat: Heat`、`RunSummary.heat: Heat`
  - `chestSize(r: number, odds = chestOdds(2)): 1 | 3 | 5`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { atkMul, betOf, chestOdds, coinMul, heatLabel, heatStage, hpMul, maxHeat, PLAIN, snap } from './cauldron';
import { chestSize } from './chest';
import { FOREST } from './stages/forest';
import { coinsOf, createWorld, summary } from './world';

const VIEW = { w: 274, h: 394 };

describe('釜の強さ', () => {
  it('2.0 は今と同じで、賭けない', () => {
    for (const f of [hpMul, atkMul, coinMul]) expect(f(2)).toBeCloseTo(1, 9);
    expect(betOf(2)).toBe(0);
    expect(betOf(2.1)).toBe(10);
    expect(heatStage(FOREST, 2)).toBe(FOREST);
    expect(chestOdds(2)).toEqual({ one: 0.85, three: 0.98 });
  });

  it('0.0 はやさしくコインが半分、9.0 は強くコイン 4 倍で 1500 枚賭ける', () => {
    expect([hpMul(0), atkMul(0), coinMul(0), betOf(0)]).toEqual([0.6, 0.7, 0.5, 0]);
    expect(hpMul(9)).toBeCloseTo(2.75);
    expect(atkMul(9)).toBeCloseTo(1.8);
    expect(coinMul(9)).toBeCloseTo(4);
    expect(betOf(9)).toBe(1500);
    expect(chestOdds(9).one).toBeCloseTo(0.5);
    expect(chestOdds(9).three).toBeCloseTo(0.85);
  });

  it('上げるほど賭けは増え、10 枚刻み', () => {
    let prev = 0;
    for (let k = 21; k <= 90; k++) {
      const b = betOf(k / 10);
      expect(b).toBeGreaterThanOrEqual(prev);
      expect(b % 10).toBe(0);
      prev = b;
    }
  });

  it('強さは 0.1 刻みに丸め、表示は 1 桁', () => {
    expect(snap(4.4999999)).toBe(4.5);
    expect(snap(-1)).toBe(0);
    expect(snap(12)).toBe(9);
    expect(heatLabel(0.1 + 0.2)).toBe('0.3');
    expect(heatLabel(2)).toBe('2.0');
  });

  it('払える最大の強さは、賭けが持っているコイン以下になるところ', () => {
    expect(maxHeat(0)).toBe(2);
    expect(maxHeat(99999)).toBe(9);
    const h = maxHeat(300);
    expect(betOf(h)).toBeLessThanOrEqual(300);
    expect(betOf(snap(h + 0.1))).toBeGreaterThan(300);
  });

  it('写した表は体力・ヌシ・攻撃・コインに掛かり、元の表は変わらない', () => {
    const s = heatStage(FOREST, 9);
    expect(s.toughness(300)).toBeCloseTo(FOREST.toughness(300) * hpMul(9));
    expect(s.fury(300)).toBeCloseTo(FOREST.fury(300) * atkMul(9));
    expect(s.chiefs[0].hp).toBeCloseTo(FOREST.chiefs[0].hp * hpMul(9));
    expect(s.coin).toBeCloseTo(FOREST.coin * coinMul(9));
    expect(FOREST.toughness(300)).toBeCloseTo(1 + (300 / 600) * 4.2);
  });

  it('createWorld は強さを持ち、コインに倍率が掛かり、まとめに入る', () => {
    const heat = { level: 4.5, bet: betOf(4.5) };
    const w = createWorld('dog', 1, VIEW, {}, 'forest', undefined, heat);
    expect(w.heat).toEqual(heat);
    w.coins = 100;
    expect(coinsOf(w)).toBe(Math.floor(100 * 1.5 * coinMul(4.5) + 1e-9));
    expect(summary(w).heat).toEqual(heat);
    expect(createWorld('dog', 1, VIEW).heat).toEqual(PLAIN);
  });

  it('宝箱の中身の数は渡した割合で決まる', () => {
    const odds = chestOdds(9);
    expect(chestSize(0.49, odds)).toBe(1);
    expect(chestSize(0.51, odds)).toBe(3);
    expect(chestSize(0.9, odds)).toBe(5);
    expect(chestSize(0.9)).toBe(3);
  });
});
```

- [ ] **Step 2: 落ちるのを見る**

Run: `pnpm exec vitest run --project unit src/lib/games/animal-survivors/cauldron.test.ts`
Expected: FAIL（`./cauldron` が無い）

- [ ] **Step 3: `cauldron.ts` を書く**

```ts
import type { Stage } from './stages/forest';

/** 釜の強さと、始めるときに賭けたコイン */
export interface Heat {
  level: number;
  bet: number;
}

export const PLAIN: Heat = { level: 2, bet: 0 };
export const HEAT_MAX = 9;
const MAX_BET = 1500;

export const snap = (h: number) => Math.min(HEAT_MAX, Math.max(0, Math.round(h * 10) / 10));
export const heatLabel = (h: number) => snap(h).toFixed(1);

/** 2.0 までと 2.0 からで別の傾きにする（2.0 が今の難しさ） */
const bend = (h: number, at0: number, at9: number) =>
  h <= 2 ? at0 + ((1 - at0) * h) / 2 : 1 + ((at9 - 1) * (h - 2)) / 7;

export const hpMul = (h: number) => bend(h, 0.6, 2.75);
export const atkMul = (h: number) => bend(h, 0.7, 1.8);
export const coinMul = (h: number) => bend(h, 0.5, 4);

/** 賭けは上のほうで急に増える。2.0 を少しでも越えたら賭けがあることを見せるため、最低 10 枚 */
export const betOf = (h: number) => (h <= 2 ? 0 : Math.max(10, Math.round((MAX_BET * ((h - 2) / 7) ** 1.5) / 10) * 10));

/** 宝箱の中身が 1 つになる割合と、3 つまでになる割合（残りが 5 つ） */
export function chestOdds(h: number): { one: number; three: number } {
  const t = Math.max(0, (h - 2) / 7);
  return { one: 0.85 - 0.35 * t, three: 0.98 - 0.13 * t };
}

export function maxHeat(coins: number): number {
  let h = 2;
  while (h < HEAT_MAX && betOf(snap(h + 0.1)) <= coins) h = snap(h + 0.1);
  return h;
}

export function heatStage(s: Stage, h: number): Stage {
  if (h === 2) return s;
  const hp = hpMul(h);
  const atk = atkMul(h);
  return {
    ...s,
    coin: s.coin * coinMul(h),
    toughness: (t) => s.toughness(t) * hp,
    fury: (t) => s.fury(t) * atk,
    chiefs: s.chiefs.map((c) => ({ ...c, hp: c.hp * hp }))
  };
}
```

- [ ] **Step 4: `world.ts` と `chest.ts` を変える**

`createWorld` に `heat: Heat = PLAIN` を足し、`const stage = heatStage(modStage(stageOf(stageId), mods), heat.level);`、返す World に `heat`。`World` の型に `/** 釜の強さと賭け */ heat: Heat;`、`RunSummary` に `heat: Heat;`、`summary()` に `heat: w.heat`。`chest.ts` は

```ts
export function chestSize(r: number, odds = chestOdds(2)): 1 | 3 | 5 {
  return r < odds.one ? 1 : r < odds.three ? 3 : 5;
}
```

にして、`openChest` は `chestSize(w.rand(), chestOdds(w.heat.level))`。

- [ ] **Step 5: 通るのを見る・全体**

Run: `pnpm exec vitest run --project unit src/lib/games/animal-survivors` → PASS。型の崩れは `pnpm check`。

- [ ] **Step 6: Commit** `Add Animal Survivors' cauldron heat curves and apply them to the world`

### Task 2: 賭けと記録・実績

**Files:**

- Modify: `records.ts`（`heat`・`heatLast`、`payHeat`、`record()`）、`achievements.ts`（2 つ）
- Test: `src/lib/games/animal-survivors/cauldron-records.test.ts`

**Interfaces:**

- Consumes: `Heat`, `betOf`, `maxHeat`, `snap`（Task 1）、`RunSummary.heat`
- Produces:
  - `Records.heat: Record<string, number>`（ステージごとのクリアしたいちばん高い強さ）、`Records.heatLast: number`
  - `payHeat(r: Records, h: number): Heat`（払える強さに下げて引き落とし、`heatLast` を覚える）
  - 実績 id `heat5`・`heat9`

- [ ] **Step 1: テストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { betOf } from './cauldron';
import { emptyRecords, parseRecords, payHeat, record } from './records';
import { createWorld, summary } from './world';

const VIEW = { w: 274, h: 394 };
const runAt = (level: number, cleared: boolean) => {
  const w = createWorld('dog', 1, VIEW, {}, 'forest', undefined, { level, bet: betOf(level) });
  w.time = cleared ? 600 : 200;
  w.over = cleared ? 'clear' : 'dead';
  return summary(w);
};

describe('釜の賭け', () => {
  it('はじめるときに賭けを引き、最後の強さを覚える', () => {
    const r = { ...emptyRecords(), coins: 1000 };
    const heat = payHeat(r, 4.5);
    expect(heat).toEqual({ level: 4.5, bet: betOf(4.5) });
    expect(r.coins).toBe(1000 - betOf(4.5));
    expect(r.heatLast).toBe(4.5);
  });

  it('コインが足りなければ払える強さまで下げ、負にならない', () => {
    const r = { ...emptyRecords(), coins: 100 };
    const heat = payHeat(r, 9);
    expect(heat.level).toBeLessThan(9);
    expect(r.coins).toBeGreaterThanOrEqual(0);
    expect(heat.bet).toBeLessThanOrEqual(100);
    const z = { ...emptyRecords(), coins: 0 };
    expect(payHeat(z, 1.5)).toEqual({ level: 1.5, bet: 0 });
  });

  it('クリアで賭けが戻り、ステージのいちばん高い強さを覚える', () => {
    const r = { ...emptyRecords(), coins: 0 };
    const run = runAt(4.5, true);
    record(r, run);
    expect(r.coins).toBe(run.coins + betOf(4.5) + (run.bookCoins ?? 0) + achieved(r));
    expect(r.heat.forest).toBe(4.5);
    record(r, runAt(3, true));
    expect(r.heat.forest).toBe(4.5);
  });

  it('倒れたら賭けは戻らず、強さも記録しない', () => {
    const r = { ...emptyRecords(), coins: 0 };
    const run = runAt(4.5, false);
    record(r, run);
    expect(r.coins).toBe(run.coins + (run.bookCoins ?? 0) + achieved(r));
    expect(r.heat.forest).toBeUndefined();
  });

  it('延長戦の終わりの記録では賭けを戻さない', () => {
    const r = { ...emptyRecords(), coins: 0 };
    const run = { ...runAt(4.5, false), overtime: { secs: 30, coins: 0, halved: false } };
    const before = r.coins;
    record(r, run);
    expect(r.coins - before).toBe(run.coins + (run.bookCoins ?? 0) + achieved(r));
  });

  it('古い記録は heat が空、heatLast が 2.0 で読め、壊れた値は捨てる', () => {
    const r = parseRecords(JSON.stringify({ coins: 5 }));
    expect(r.heat).toEqual({});
    expect(r.heatLast).toBe(2);
    const bad = parseRecords(JSON.stringify({ heat: { forest: 'x', snow: 99, graveyard: 3.3 }, heatLast: -4 }));
    expect(bad.heat).toEqual({ snow: 9, graveyard: 3.3 });
    expect(bad.heatLast).toBe(0);
  });

  it('釜 5.0 以上・9.0 でクリアの実績', () => {
    const r = emptyRecords();
    const a5 = ACHIEVEMENTS.find((a) => a.id === 'heat5')!;
    const a9 = ACHIEVEMENTS.find((a) => a.id === 'heat9')!;
    expect(a5.done(r)).toBe(false);
    r.heat.snow = 5;
    expect(a5.done(r)).toBe(true);
    expect(a9.done(r)).toBe(false);
    r.heat.forest = 9;
    expect(a9.done(r)).toBe(true);
  });
});

function achieved(r: ReturnType<typeof emptyRecords>) {
  return ACHIEVEMENTS.filter((a) => r.achieved.includes(a.id)).reduce((t, a) => t + a.coins, 0);
}
```

- [ ] **Step 2: 落ちるのを見る**（`payHeat` が無い）

- [ ] **Step 3: 実装**

`Records` に `/** ステージごとにクリアしたいちばん高い釜の強さ */ heat: Record<string, number>;` と `/** 最後に選んだ釜の強さ */ heatLast: number;`。`emptyRecords` は `heat: {}, heatLast: 2`。`parseRecords` は `heat` を「数のものだけ `snap`」、`heatLast` は数なら `snap`、それ以外 2。

```ts
/** はじめるときに賭けを引く。足りなければ払える強さまで下げる */
export function payHeat(r: Records, h: number): Heat {
  const level = snap(h) <= 2 ? snap(h) : Math.min(snap(h), maxHeat(r.coins));
  const bet = betOf(level);
  r.coins -= bet;
  r.heatLast = level;
  return { level, bet };
}
```

`record()` の `if (run.cleared) {…}` の中に `r.coins += run.heat.bet; r.heat[run.stage] = Math.max(r.heat[run.stage] ?? 0, run.heat.level);`（延長戦の終わりの記録は `overtimeRun()` が `cleared: false` なので入らない。テストで確かめる）。`achievements.ts` に

```ts
{ id: 'heat5', name: '釜 5.0 以上でクリア', coins: 300, done: (r) => Object.values(r.heat).some((v) => v >= 5) },
{ id: 'heat9', name: '釜 9.0 でクリア', coins: 1000, done: (r) => Object.values(r.heat).some((v) => v >= 9) },
```

- [ ] **Step 4: 通るのを見る**（`--project unit src/lib/games/animal-survivors`）。実績の数を固めているテスト（41 個）があれば 43 に直す。

- [ ] **Step 5: Commit** `Charge and refund Animal Survivors' cauldron bets and record the highest cleared heat`

### Task 3: 釜の絵の見本（利用者に見せて止まる）

- [ ] 釜の 24〜32 ドットの絵を、火の色 3 つ（青・紫・赤）で scratchpad に作り、[[pixel-art-tooling]] の形で PNG にして `SendUserFile` で見せる。かわいい見た目（黒い丸目とほっぺのある釜、などの案を 2 つ）にする。
- [ ] 利用者が決めるまで Task 4 に進まない。決まった絵を `art/cauldron.ts` に入れる。

### Task 4: 釜の画面と流れ

**Files:**

- Create: `art/cauldron.ts`、`Cauldron.svelte`
- Modify: `Survivors.svelte`（`screen` に `'cauldron'`、`pick.heat`、`begin(h)`）、`Play.svelte`（`createWorld` に `choice.heat`）、`StageSelect.svelte`（札に「釜 6.5」）、`Result.svelte`（賭けの行）
- Test: `src/lib/games/animal-survivors/cauldron.svelte.test.ts`

**Interfaces:**

- Consumes: `payHeat`, `Records.heat`, `Records.heatLast`, `betOf`, `maxHeat`, `hpMul`, `atkMul`, `coinMul`, `chestOdds`, `heatLabel`, `snap`, `PLAIN`
- Produces: `Cauldron.svelte` の props `{ coins: number; start: number; stage: string; onstart: (h: number) => void; onback: () => void }`

- [ ] **Step 1: dom テストを書く**

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { betOf } from './cauldron';
import Cauldron from './Cauldron.svelte';
import Result from './Result.svelte';
import StageSelect from './StageSelect.svelte';
import { emptyRecords } from './records';
import { createWorld, summary } from './world';

vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

describe('釜の画面', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('強さと賭けを出し、+0.1 で上がり、はじめるで選んだ強さを返す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const got: number[] = [];
    const app = mount(Cauldron, {
      target,
      props: { coins: 5000, start: 2, stage: 'forest', onstart: (h) => got.push(h), onback: () => {} }
    });
    flushSync();
    expect(target.textContent).toContain('2.0');
    for (let i = 0; i < 25; i++) (target.querySelector('[aria-label="強くする"]') as HTMLButtonElement).click();
    flushSync();
    expect(target.textContent).toContain('4.5');
    expect(target.textContent).toContain(String(betOf(4.5)));
    (target.querySelector('[data-start]') as HTMLButtonElement).click();
    expect(got).toEqual([4.5]);
    unmount(app);
  });

  it('持っているコインより上には上げられない', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Cauldron, {
      target,
      props: { coins: 0, start: 2, stage: 'forest', onstart: () => {}, onback: () => {} }
    });
    flushSync();
    const up = target.querySelector('[aria-label="強くする"]') as HTMLButtonElement;
    expect(up.disabled).toBe(true);
    unmount(app);
  });

  it('ステージの札にクリアしたいちばん高い強さを出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const records = { ...emptyRecords(), heat: { forest: 6.5 } };
    const app = mount(StageSelect, { target, props: { records, onpick: () => {}, onback: () => {} } });
    flushSync();
    expect(target.querySelector('[data-stage="forest"]')!.textContent).toContain('釜 6.5');
    unmount(app);
  });

  it('リザルトに賭けが戻ったか戻らないかを出す', () => {
    const w = createWorld('dog', 1, { w: 260, h: 380 }, {}, 'forest', undefined, { level: 4.5, bet: 320 });
    w.over = 'dead';
    const target = document.body.appendChild(document.createElement('div'));
    const props = { run: summary(w), got: [], total: 0, locked: false, onagain: () => {}, onselect: () => {} };
    const app = mount(Result, { target, props });
    flushSync();
    expect(target.textContent).toContain('賭けた 320 は戻らない');
    unmount(app);
  });
});
```

（お題の回が釜を通らないことは、`Survivors.svelte` の `daily()` が `start()` を直に呼ぶ形のままにし、`begin` を通らないことを Step 3 のコードで保つ。`Survivors` を mount する既存の dom テストがあれば、そこで「お題を始めると釜の見出しが出ない」を足す。）

- [ ] **Step 2: 落ちるのを見る**

- [ ] **Step 3: 実装**
  - `Cauldron.svelte`。`as-screen` と `as-panel` の枠、✕（`onback`）、`PixelIcon` の釜（強さ 0〜3.9 は青、4〜6.9 は紫、7〜9 は赤の版）、大きな `heatLabel(h)`、`<input type="range" min="0" max={maxHeat(coins)} step="0.1">` と −0.1（`aria-label="弱くする"`）・+0.1（`aria-label="強くする"`、`h >= maxHeat(coins)` で disabled）、敵の体力 `×hpMul`・攻撃 `×atkMul`・コイン `×coinMul`・宝箱の 3 つ以上の割合、賭けるコインと持っているコイン、`data-start` の「はじめる」。`h` は `$state(snap(Math.min(start, maxHeat(coins))))`（`start` が 2 以下ならそのまま）。
  - `Survivors.svelte`。`pick` に `heat?: Heat`。`StageSelect` の `onpick` は `(id) => { pick = { ...pick, stage: id }; screen = 'cauldron'; }`。`begin(h)` は `const r = loadRecords(); pick = { ...pick, heat: payHeat(r, h) }; saveRecords(r); records = r; start(pick.stage);`。釜は `<Cauldron coins={records.coins} start={records.heatLast} stage={pick.stage} onstart={begin} onback={() => (screen = 'stage')} />`。プレイの `onrestart` とリザルトの `onagain` は、お題の回なら `start(pick.stage)`、そうでなければ `begin(pick.heat?.level ?? 2)`。`daily()` は `pick` を作り直すので `heat` は無い（PLAIN）。
  - `Play.svelte`。`createWorld(…, choice.challenge, choice.heat)`、`choice` の型に `heat?: Heat`。
  - `StageSelect.svelte`。`{#if records.heat[s.id] !== undefined}<span class="info">釜 {heatLabel(records.heat[s.id])}</span>{/if}`。
  - `Result.svelte`。`run.heat.level !== 2` のとき 1 行。賭けがあればクリアで「釜 4.5 クリア 賭けた 320 が戻った」、倒れたら「釜 4.5 賭けた 320 は戻らない」、賭けが無ければ「釜 1.5」。

- [ ] **Step 4: 通るのを見る**（`pnpm exec vitest run src/lib/games/animal-survivors`）。`pnpm verify`。
- [ ] **Step 5: 画面を撮る**。dev サーバーで、キャラ選択 → ステージ → 釜を headless の Chrome（[[headless-play-harness]]）と webkit で縦・横を撮り、つまみが指で動くことを確かめる（iOS の Safari は `touch-action: none` の中の range も動くか。動かなければ ±0.1 だけにして range を外す Ruling を書く）。
- [ ] **Step 6: Commit** `Add Animal Survivors' cauldron screen between the stage picker and play`

### Task 5: ボットで合わせる

- [ ] scratchpad の `sim/boss.sim.ts` に `HEAT` を env で受けて `createWorld(…, undefined, { level: HEAT, bet: 0 })` に渡す。森・墓地・雪山の店半分と全部で、強さ 2.0・4.0・6.0・9.0 のクリアの割合と 1 回のコインを測る。
- [ ] 店を全部買って 9.0 の森が 18 回中 2〜4 回クリア、強さを上げるほど「クリアの割合 × 勝ったときのコイン − 賭け」がおおむね増えるよう、`bend` の端の値（2.75・1.8・4）と `MAX_BET` を合わせる。spec に「## 8. 調整の結果」を書く。Commit。

### Task 6: 仕上げ

- [ ] CLAUDE.md の Animal Survivors の段落に釜（流れ・強さで変わるもの・賭け・記録・実績）を足す。`pnpm verify`、Commit。別の係にブランチ全体を見てもらい、Critical と Important を直してから、main へ push してよいかを聞く。
