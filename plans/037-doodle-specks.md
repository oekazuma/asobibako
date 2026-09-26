# Plan 037: 外したタップの点だけの子を、ずかんに入れない

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4f6f07a..HEAD -- src/lib/games/doodle-worm/engine.ts src/lib/games/doodle-worm/engine.test.ts src/lib/games/doodle-worm/DoodleWorm.svelte`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                    |
| ---------- | ----------------------------------------------------- |
| Priority   | P1                                                    |
| Effort     | S                                                     |
| Risk       | LOW（画面の動きは変えず、ずかんに残すものだけを絞る） |
| Depends on | none                                                  |
| Category   | bug                                                   |
| Planned at | commit `4f6f07a`, 2026-09-26                          |

## Why this matters

らくがきパレードでは、動いている子を指で押すと跳ねる（`poke`）。押しそこねて子の外を叩くと、そのタップは 1 点だけの
線として描きかけの線（`lines`）に入る。次に「うごけ！」を押すと、離れて描いた線は別々の子になる（`groups`）ので、
その点は「点だけの小さな子」になり、ずかん（48 枚まで、あふれたら古い絵から落ちる）の 1 枠を使う。子どもが本当に
描いた絵がそのぶん押し出される。

目や模様のように絵のそばに打った点は、絵と同じまとまりになるので影響しない。まとまり全体がタップ程度の大きさしか
ないものだけを、動かしはするがずかんには入れない。

## Current state

`src/lib/games/doodle-worm/DoodleWorm.svelte:44-51`

```ts
/** 離れて描いた絵はそれぞれ別の子になる */
function go() {
  const kids = groups(lines);
  if (!kids.length) return;
  for (const strokes of kids) add(world, hatch(strokes)!);
  stock = saveStock([...kids.map((strokes) => pack(strokes)).reverse(), ...stock], kids.length);
  lines = [];
  sounds.hatch();
}
```

`saveStock(list, fresh)` の `fresh` は先頭に足したばかりの絵の数（★ の絵より先に落とさない）。

`src/lib/games/doodle-worm/engine.ts`

- `:98` `export function bounds(pts: Point[]): [number, number, number, number]`（左・上・右・下）
- `:263` `export function groups(strokes: Stroke[]): Stroke[][]`
- `:377` `const TAP = 0.015;`（指をほとんど動かさずに離したとみなす距離。座標は盤面の高さを 1 とした単位）
- `:383-397` `poke(world, lines, stroke)`。押した点から `TAP` より動いていればタップではない

テストは `src/lib/games/doodle-worm/engine.test.ts`（`describe('poke', ...)`・`describe('groups', ...)` と、`tap(x, y)`・
`ring(...)`・`line(...)`・`s(...)` の小さな作り手がある）。

## Commands you will need

| Purpose             | Command                                          | Expected on success  |
| ------------------- | ------------------------------------------------ | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                 | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/doodle-worm` | all pass             |
| 全テスト            | `pnpm test:run`                                  | all pass             |
| 型                  | `pnpm check`                                     | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                      | exit 0               |

## Scope

In scope は `src/lib/games/doodle-worm/engine.ts`、`src/lib/games/doodle-worm/engine.test.ts`、
`src/lib/games/doodle-worm/DoodleWorm.svelte`、`CLAUDE.md`（らくがきパレードの段落に 1 文）。

Out of scope は `poke` の判定、`groups` のまとめ方、`stock.ts`。

## Git workflow

- コミット 1〜2 つ。メッセージは英語の命令形 1 行（例 `Keep stray taps out of the picture book`）。末尾に Co-Authored-By を 1 行
- push しない。git stash は使わない

## Steps

### Step 1: 点だけのまとまりを見分ける関数を足す

`engine.ts` の `TAP` の近くに次を足す。

```ts
/** まとまり全体がタップ程度の大きさしかない（押しそこねた指の跡）。動かしはするが、ずかんには残さない */
export function speck(strokes: Stroke[]): boolean {
  const [l, t, r, b] = bounds(strokes.flatMap((s) => s.pts));
  return Math.max(r - l, b - t) <= TAP * 2;
}
```

`engine.test.ts` に `describe('speck', ...)` を足して 3 本。

1. `[tap(0.5, 0.5)]` は true
2. 近くに打った 2 つのタップ `[tap(0.5, 0.5), tap(0.51, 0.5)]` は true
3. `[s(ring(0.5, 0.5, 0.05))]`（小さな輪）は false

**Verify**: `pnpm exec vitest run src/lib/games/doodle-worm/engine.test.ts` → all pass（3 本増える）

### Step 2: 「うごけ！」で、点だけの子はずかんに入れない

`DoodleWorm.svelte` の `go()` を、全部の子は今までどおり `add` し、ずかんには `speck` でない子だけを入れる形にする。
残す子が 0 なら `saveStock` を呼ばない（`stock` はそのまま）。`fresh` には残す子の数を渡す。

```ts
const kept = kids.filter((strokes) => !speck(strokes));
if (kept.length) stock = saveStock([...kept.map((strokes) => pack(strokes)).reverse(), ...stock], kept.length);
```

`speck` を import に足す。

**Verify**: `pnpm check` → 0 errors。`wc -l src/lib/games/doodle-worm/DoodleWorm.svelte` → 200 未満

### Step 3: CLAUDE.md に今の仕様を 1 文足す

らくがきパレードの段落の「動かした絵はずかん（…）に新しい順で 48 枚まで残り」の直後あたりに、「まとまり全体がタップ程度の
大きさしかない子（押しそこねた指の跡）は動かすがずかんには入れない（`engine.ts` の `speck`）」を足す。経緯は書かない。

**Verify**: `grep -c "speck" CLAUDE.md` → 1 以上

### Step 4: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

`engine.test.ts` に 3 本（Step 1）。`go()` の配線は 3 行なので、コンポーネントのテストは書かない。

## Done criteria

- [ ] `grep -n "speck" src/lib/games/doodle-worm/engine.ts src/lib/games/doodle-worm/DoodleWorm.svelte` が両ファイルで出る
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` が通る
- [ ] `git diff --name-only 4f6f07a` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- 抜粋と今のコードが違う
- 既存のテストで、点だけのまとまりをずかんに入れることを期待しているものがある

## Maintenance notes

- `TAP` を変えると、点とみなす大きさも変わる（`TAP * 2` まで）
