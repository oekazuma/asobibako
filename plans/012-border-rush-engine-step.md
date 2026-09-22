# Plan 012: border-rush のルールを engine の `step()` に移す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 012 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/games/border-rush src/lib/audio.svelte.ts src/lib/board-input.ts`
> `engine.test.ts` は 002 で変わっている **はず**（2P 勝利と境界端のテスト）。それ以外の差分があれば
> 「Current state」と見比べる。

## Status

| 項目       | 値                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                                            |
| Effort     | M                                                                                                             |
| Risk       | MED（出現周期の実装が `setInterval` から `animate` の dt 積算に変わる。手触りが変わっていないかを目視で見る） |
| Depends on | 002                                                                                                           |
| Category   | tech-debt                                                                                                     |
| Planned at | commit `b4b0196`, 2026-09-22                                                                                  |

## Why this matters

border-rush（せめぎあい）は 12 ゲームの中で唯一、ルールの半分をコンポーネントに持っている。

- 玉の出現周期（340 ms）、1 人あたりの上限（3）、奪い合い玉の確率（0.16）、長押し玉の割合（0.28）、
  長押しの完了（700 ms のタイマー）が `BorderRush.svelte` にあり、`engine.ts` に `step()` がない
- そのため `engine.test.ts` は `pop` / `zone` / `expire` しか検証できず、出現のバランスは一度も
  テストされていない
- `engine.ts:32` の `let nextId = 1` はモジュール変数で、テストや対戦をまたいで増え続ける。ほかの
  engine は state にすべてを持つ
- `setInterval` + `Date.now()` で動く唯一のゲームで、`$lib/loop.ts` の `animate` を使わない。
  `wake()` と `setPointerCapture` の try/catch を自前で持つ
- 玉の音 3 つ（`tap` / `hold` / `contest`）が共有の `src/lib/audio.svelte.ts` の `sfx` に置かれている。
  名前は border-rush の `OrbKind` そのもので、ほかの 11 ゲームは自分の `sounds.ts` に持つ

CLAUDE.md は「ルールは engine に閉じて vitest で検証」と言い、003 でその手本を hockey に差し替えた。
この計画で border-rush も同じ形にする。

## Current state

- `src/lib/games/border-rush/engine.ts` — 83 行。`createState()`、`zone()`、`spawnOrb()`、`expire()`、`pop()`
- `src/lib/games/border-rush/BorderRush.svelte` — 130 行。ルール + 描画 + 配線
- `src/lib/games/border-rush/Orbs.svelte` — 玉のボタン。`ongrab(event, orb, by)` / `onrelease(id)` を受ける
- `src/lib/games/border-rush/engine.test.ts` — 002 で 2P 勝利と境界端の 2 件が足された前提
- `src/lib/audio.svelte.ts:75-94` — `sfx = { tap, hold, contest, start, finish }`。`tap`/`hold`/`contest` の
  利用者は `BorderRush.svelte:35` の `sfx[orb.kind]()` だけ（`grep -rn "sfx\.\(tap\|hold\|contest\)\|sfx\[" src/` で確かめる）
- `src/lib/loop.ts` — `animate(frame)`。`frame(dt秒, now)` を rAF で回し、戻り値で止める

`engine.ts:22-36`（現状）

```ts
export const GAIN: Record<OrbKind, number> = { tap: 0.03, hold: 0.075, contest: 0.1 };
export const HOLD_MS = 700;
export const ORB_LIFE_MS = 2600;

const WIN_MARGIN = 0.06;
/** 画面端側の余白。玉の半径に加えて Safe Area ぶんを逃がす */
const OUTER = 0.08;
/** 境界線側の余白。玉の半径と同じにして、線ぎりぎりまで玉が出るようにする */
const INNER = 0.045;

let nextId = 1;

export function createState(): GameState {
  return { border: 0.5, orbs: [], winner: null };
}
```

`engine.ts:42-62`（現状。`spawnOrb` と `expire`）

```ts
export function spawnOrb(state, kind, owner, now, rand = Math.random): Orb {
  let y = state.border;
  if (owner !== null) {
    const [lo, hi] = zone(state, owner);
    y = hi > lo ? lo + rand() * (hi - lo) : (lo + hi) / 2;
  }
  const orb: Orb = { id: nextId++, kind, owner, x: 0.12 + rand() * 0.76, y, bornAt: now };
  state.orbs.push(orb);
  return orb;
}

export function expire(state: GameState, now: number): void {
  state.orbs = state.orbs.filter((o) => now - o.bornAt < ORB_LIFE_MS);
}
```

`BorderRush.svelte:10-32`（現状。コンポーネント側のルール）

```ts
const MAX_PER_PLAYER = 3;
const SPAWN_MS = 340;
const CONTEST_CHANCE = 0.16;

const game = $state(createState());
let holding = $state<number[]>([]);

const holdTimers: Record<number, ReturnType<typeof setTimeout>> = {};

function addOrb(owner: Player | null) {
  const kind = owner === null ? 'contest' : Math.random() < 0.28 ? 'hold' : 'tap';
  spawnOrb(game, kind, owner, Date.now());
}

function tick() {
  if (game.winner !== null) return;
  expire(game, Date.now());
  for (const p of [1, 2] as const) {
    if (game.orbs.filter((o) => o.owner === p).length < MAX_PER_PLAYER) addOrb(p);
  }
  if (!game.orbs.some((o) => o.owner === null) && Math.random() < CONTEST_CHANCE) addOrb(null);
}
```

`BorderRush.svelte:34-58`（現状。取る・長押し）

```ts
function take(orb: Orb, by: Player) {
  if (!pop(game, orb.id, by)) return;
  sfx[orb.kind]();
  if (game.winner !== null) {
    sfx.finish();
    onfinish(game.winner);
  }
}

function startHold(orb: Orb, by: Player) {
  if (orb.id in holdTimers) return;
  holding.push(orb.id);
  holdTimers[orb.id] = setTimeout(() => {
    endHold(orb.id);
    take(orb, by);
  }, HOLD_MS);
}

function endHold(id: number) {
  if (id in holdTimers) {
    clearTimeout(holdTimers[id]);
    delete holdTimers[id];
  }
  const i = holding.indexOf(id);
  if (i >= 0) holding.splice(i, 1);
}
```

`BorderRush.svelte:60-83`（現状。掴む・ループ）

```ts
function grab(event: PointerEvent, orb: Orb, by: Player) {
  event.preventDefault();
  wake();
  if (orb.kind === 'hold') {
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // 合成イベントなどで捕捉できなくても長押し自体は成立させる
    }
    startHold(orb, by);
  } else {
    take(orb, by);
  }
}

// $effect だと tick() が game を読むぶん依存に入り、玉が出るたび interval が張り直される
onMount(() => {
  tick();
  const interval = setInterval(tick, SPAWN_MS);
  return () => {
    clearInterval(interval);
    for (const id of Object.keys(holdTimers)) endHold(Number(id));
  };
});
```

テンプレートは `<div class="field" style:--b={game.border} style:--hold="{HOLD_MS}ms" style:--life="{ORB_LIFE_MS}ms">` に
`<Orbs orbs={game.orbs} {holding} ongrab={grab} onrelease={endHold} />` を置く。`Orbs.svelte` は CSS の
`animation: life var(--life)` と `.holding .fill { animation: fill var(--hold) }` で寿命と長押しの見た目を出す。
つまり **`bornAt` は ms 単位の時刻** で、CSS アニメーションの長さと `ORB_LIFE_MS` が対応している。

`src/lib/audio.svelte.ts:75-84`（現状）

```ts
export const sfx = {
  tap: () => tone(660, 90),
  hold: () => {
    tone(520, 90);
    tone(780, 160, 'triangle', 0.14, 70);
  },
  contest: () => {
    tone(990, 120, 'square', 0.1);
    tone(1320, 180, 'square', 0.08, 90);
  },
  start: () => { ... },
  finish: () => { ... }
};
```

ほかのゲームの `sounds.ts` の形（例 `src/lib/games/hockey/sounds.ts`）— `import { noise, sweep, tone } from '$lib/audio.svelte'; export const sounds = { hit: (speed: number) => ..., wall: () => ..., goal: () => ... };`。

規約 — engine は DOM に依存しない。乱数は `rand: () => number = Math.random` を引数で受ける。
コメントは WHY だけ・日本語。`.svelte` は 200 行未満。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド                                     | 成功時     |
| ------ | -------------------------------------------- | ---------- |
| テスト | `pnpm test:run src/lib/games/border-rush`    | pass       |
| 型     | `pnpm check`                                 | `0 ERRORS` |
| lint   | `pnpm lint`                                  | exit 0     |
| vitals | `pnpm vitals --diff`                         | exit 0     |
| まとめ | `pnpm verify`                                | exit 0     |
| 目視   | `pnpm dev` → `/table-duel/games/border-rush` | 後述       |

## Scope

**In scope**

- `src/lib/games/border-rush/engine.ts`
- `src/lib/games/border-rush/engine.test.ts`
- `src/lib/games/border-rush/BorderRush.svelte`
- `src/lib/games/border-rush/sounds.ts`（新規）
- `src/lib/audio.svelte.ts`（`tap`/`hold`/`contest` を消すだけ）
- `plans/README.md`

**Out of scope**

- `Orbs.svelte` — 触らない（`ongrab`/`onrelease` の契約を保つ）
- `src/lib/board-input.ts` — border-rush は玉ごとのボタンで受けるので `BoardInput` には乗せない。
  `capture()` の共通化は 013 でやる
- 数値（340 ms、上限 3、0.16、0.28、700 ms、2600 ms）— 変えない
- README / CLAUDE.md — 003 で hockey を手本にしたので触らない

## Git workflow

- ブランチ: `advisor/012-border-rush-engine-step`
- コミットは「engine に step」「コンポーネントを載せ替え」「音を移す」の 3 つ。英語の命令形 1 文、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: engine に出現のルールと `step()` を足す

`engine.ts` を次のように変える。

- `GameState` に `nextId: number` と `spawnIn: number`（次の出現までの秒）と、長押し中の玉
  `holds: Record<number, number>`（玉の id → 押し始めてからの秒）を足す。`createState()` で
  `nextId: 1, spawnIn: 0, holds: {}` を返す
- モジュールの `let nextId` を消し、`spawnOrb` は `state.nextId++` を使う
- 定数を engine に移す — `export const MAX_PER_PLAYER = 3; export const SPAWN_S = 0.34; const CONTEST_CHANCE = 0.16; const HOLD_CHANCE = 0.28;`
- `BorderEvent` 型と `step()` を足す

```ts
export type BorderEvent = { type: 'pop'; kind: OrbKind } | { type: 'win'; player: Player };

/** 出現の周期ごとに、寿命切れを落とし、各陣地を上限まで埋め、境界の奪い合い玉をときどき出す */
function spawnWave(state: GameState, now: number, rand: () => number) {
  expire(state, now);
  for (const p of [1, 2] as const) {
    if (state.orbs.filter((o) => o.owner === p).length < MAX_PER_PLAYER)
      spawnOrb(state, rand() < HOLD_CHANCE ? 'hold' : 'tap', p, now, rand);
  }
  if (!state.orbs.some((o) => o.owner === null) && rand() < CONTEST_CHANCE) spawnOrb(state, 'contest', null, now, rand);
}

/** now は ms（CSS の寿命アニメーションと合わせる）、dt は秒 */
export function step(state: GameState, dt: number, now: number, rand: () => number = Math.random): BorderEvent[] {
  if (state.winner !== null) return [];
  const events: BorderEvent[] = [];
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    spawnWave(state, now, rand);
    state.spawnIn = SPAWN_S;
  }
  for (const key of Object.keys(state.holds)) {
    const id = Number(key);
    state.holds[id] += dt;
    if (state.holds[id] * 1000 < HOLD_MS) continue;
    const orb = state.orbs.find((o) => o.id === id);
    delete state.holds[id];
    if (orb && orb.owner !== null && pop(state, id, orb.owner)) events.push({ type: 'pop', kind: orb.kind });
    if (state.winner !== null) {
      events.push({ type: 'win', player: state.winner });
      break;
    }
  }
  return events;
}

/** 長押しの玉を押し始めた・離した */
export function beginHold(state: GameState, id: number): void {
  const orb = state.orbs.find((o) => o.id === id);
  if (orb?.kind === 'hold' && !(id in state.holds)) state.holds[id] = 0;
}

export function endHold(state: GameState, id: number): void {
  delete state.holds[id];
}
```

`pop()` の末尾に「取った玉が長押し中なら `holds` から外す」を足す（`delete state.holds[id];`）。
寿命切れで消えた玉の `holds` は `step` の `find` が `undefined` を返して外れる。

タップ玉と奪い合い玉は今までどおり `pop()` を直接呼ぶ（即時）。長押し玉だけが `step` で完了する。

確認 — `pnpm check` → `0 ERRORS`（`BorderRush.svelte` はまだ古い import で通る）

### Step 2: `step()` をテストする

`engine.test.ts` に足す。`seq(...)` ヘルパー（既存）で乱数を固定する。

```ts
it('出現の周期ごとに各陣地を上限まで埋め、上限を超えない', () => {
  const s = createState();
  step(s, 1, 0, seq(0.5));
  expect(s.orbs.filter((o) => o.owner === 1)).toHaveLength(1);
  for (let t = 0; t < 3; t += 1 / 60) step(s, 1 / 60, t * 1000, seq(0.5));
  expect(s.orbs.filter((o) => o.owner === 1).length).toBeLessThanOrEqual(MAX_PER_PLAYER);
  expect(s.orbs.filter((o) => o.owner === 2).length).toBeLessThanOrEqual(MAX_PER_PLAYER);
});

it('奪い合い玉は 1 つまでしか出ない', () => {
  const s = createState();
  for (let t = 0; t < 5; t += 1 / 60) step(s, 1 / 60, t * 1000, seq(0.1));
  expect(s.orbs.filter((o) => o.owner === null).length).toBeLessThanOrEqual(1);
});

it('長押しの玉は HOLD_MS 押し続けると取れ、途中で離すと取れない', () => {
  const s = createState();
  const orb = spawnOrb(s, 'hold', 1, 0, seq(0.5));
  beginHold(s, orb.id);
  expect(step(s, HOLD_MS / 1000 - 0.01, 0, seq(0.99))).toEqual([]);
  expect(step(s, 0.02, 0, seq(0.99))).toContainEqual({ type: 'pop', kind: 'hold' });
  expect(s.border).toBeCloseTo(0.5 - GAIN.hold);

  const t = createState();
  const other = spawnOrb(t, 'hold', 1, 0, seq(0.5));
  beginHold(t, other.id);
  step(t, 0.3, 0, seq(0.99));
  endHold(t, other.id);
  step(t, 1, 0, seq(0.99));
  expect(t.border).toBe(0.5);
});

it('id は state ごとに 1 から数える', () => {
  expect(spawnOrb(createState(), 'tap', 1, 0, seq(0.5)).id).toBe(1);
  expect(spawnOrb(createState(), 'tap', 1, 0, seq(0.5)).id).toBe(1);
});
```

`seq(0.99)` は `spawnWave` の `rand()` を 0.99 にして、新しい玉（`HOLD_CHANCE` や `CONTEST_CHANCE`）が
出にくいようにする。それでも出現する `tap` 玉は `border` に影響しない（取っていないので）。

確認 — `pnpm test:run src/lib/games/border-rush` → 既存 + 002 の 2 件 + 新規 4 件 pass

### Step 3: 音を border-rush の `sounds.ts` に移す

`src/lib/games/border-rush/sounds.ts` を新規に作る。

```ts
import { tone } from '$lib/audio.svelte';

export const sounds = {
  tap: () => tone(660, 90),
  hold: () => {
    tone(520, 90);
    tone(780, 160, 'triangle', 0.14, 70);
  },
  contest: () => {
    tone(990, 120, 'square', 0.1);
    tone(1320, 180, 'square', 0.08, 90);
  }
};
```

`src/lib/audio.svelte.ts` の `sfx` から `tap` / `hold` / `contest` を消す（`start` / `finish` は残す）。

確認 — `grep -rn "sfx.tap\|sfx.hold\|sfx.contest\|sfx\[" src/` が `BorderRush.svelte` の 1 件だけ（次のステップで消える）

### Step 4: コンポーネントを engine と `animate` に載せ替える

`BorderRush.svelte` の script を次の形にする。

```ts
import { onMount } from 'svelte';
import { sfx, wake } from '$lib/audio.svelte';
import { animate } from '$lib/loop';
import type { Player } from '$lib/player';
import Orbs from './Orbs.svelte';
import { beginHold, createState, endHold, HOLD_MS, ORB_LIFE_MS, pop, step, type Orb } from './engine';
import { sounds } from './sounds';

let { onfinish }: { onfinish: (winner: Player) => void } = $props();

const game = $state(createState());
const holding = $derived(Object.keys(game.holds).map(Number));

function take(orb: Orb, by: Player) {
  if (!pop(game, orb.id, by)) return;
  sounds[orb.kind]();
  if (game.winner !== null) {
    sfx.finish();
    onfinish(game.winner);
  }
}

function grab(event: PointerEvent, orb: Orb, by: Player) {
  event.preventDefault();
  wake();
  if (orb.kind !== 'hold') return take(orb, by);
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // 合成イベントなどで捕捉できなくても長押し自体は成立させる
  }
  beginHold(game, orb.id);
}

onMount(() =>
  animate((dt, now) => {
    for (const event of step(game, dt, now)) {
      if (event.type === 'pop') sounds[event.kind]();
      else {
        sfx.finish();
        onfinish(event.player);
      }
    }
  })
);
```

- `holdTimers` / `holding` の配列 / `tick` / `addOrb` / `startHold` / `endHold` / `setInterval` は消える
- テンプレートの `<Orbs ... onrelease={endHold} />` は `onrelease={(id) => endHold(game, id)}` にする
- `now` は `animate` が渡す `performance.now()`（ms）。`bornAt` と `expire` はこれまで `Date.now()` だったが、
  どちらも ms で差だけを使うので、同じ時計に揃えれば動く。`step` に渡す `now` と `spawnOrb` の `bornAt` が
  同じ `now` であることが大事（混ぜない）
- `$state(createState())` のまま。`step` が `game` を深く書き換えるので、Svelte の proxy 経由で
  `Orbs` の `{#each orbs as orb (orb.id)}` が追従する

確認 — `pnpm check` → `0 ERRORS`、`pnpm lint` → exit 0、`pnpm vitals --diff` → exit 0、
`wc -l src/lib/games/border-rush/BorderRush.svelte` が 200 未満

### Step 5: 目視

`pnpm dev` で `http://localhost:5173/table-duel/games/border-rush` を開き、マウスで片側を押して始める
（PC ではマウス 1 つで両方 ready になる）。

1. 玉が 340 ms ごとに出て、各陣地に 3 個までで止まる。寿命（2.6 秒）で縮んで消える
2. 二重の輪の玉を押し続けると輪が満ちて取れる。途中で離すと取れない
3. 金の玉がときどき境界に出る
4. 取ると境界が動き、押し切ると結果画面
5. 音が鳴る（タップ・長押し・奪い合いで違う音）

確認 — 上の 5 つ。`pnpm verify` → exit 0

## Test plan

- Step 2 の 4 件を `engine.test.ts` に追加
- 002 で足した 2P 勝利・境界端のテストが引き続き pass
- 見た目と手触りは目視

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -n "^let nextId" src/lib/games/border-rush/engine.ts` が 0 件、`export function step` が 1 件
- [ ] `grep -n "setInterval\|Date.now" src/lib/games/border-rush/BorderRush.svelte` が 0 件
- [ ] `grep -n "tap:\|hold:\|contest:" src/lib/audio.svelte.ts` が 0 件、`src/lib/games/border-rush/sounds.ts` が存在
- [ ] `grep -rn "sfx\[" src/` が 0 件
- [ ] `BorderRush.svelte` が 200 行未満
- [ ] Step 5 の目視 5 つ
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 012 の Status を更新した

## STOP conditions

- 002 が未実施（`engine.test.ts` に 2P 勝利のテストがない）
- Step 5 で手触りが明らかに違う（玉が出すぎる／出ない／長押しが完了しない）。`spawnIn` の単位（秒）と
  `HOLD_MS`（ms）の混在が疑わしい。直せなければ報告
- `Orbs.svelte` を変えないと動かない

## Maintenance notes

- `now` は ms、`dt` は秒。`bornAt` と `ORB_LIFE_MS` は CSS アニメーションと対なので ms のまま
- 出現のバランスを変えるときは `engine.ts` の定数だけ。`engine.test.ts` の周期・上限のテストが守る
- 013 で `capture()`（`setPointerCapture` の try/catch）を共通化するとき、`grab()` の try/catch はそれに置き換える
