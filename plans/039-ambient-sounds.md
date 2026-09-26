# Plan 039: 音が止まっているあいだの足音や物音を溜めない

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4f6f07a..HEAD -- src/lib/games/pet-house/sounds.ts src/lib/audio.svelte.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                        |
| ---------- | ------------------------------------------------------------------------- |
| Priority   | P3                                                                        |
| Effort     | S                                                                         |
| Risk       | LOW（止まっているあいだに鳴らさない音が増えるだけ。動いているときは同じ） |
| Depends on | none                                                                      |
| Category   | bug                                                                       |
| Planned at | commit `4f6f07a`, 2026-09-26                                              |

## Why this matters

`src/lib/audio.svelte.ts` の `sink()` は、AudioContext が止まっている（suspended・iOS の interrupted）あいだも ctx を返す。
タッチから鳴らす音はこれでよい（iOS では `wake()` と同じタッチの音が、まだ suspended の ctx に届き、resume が済むと鳴る）。
ところがわんにゃんハウスは、触っていなくてもフレームの中から足音・食べる音・おもちゃの弾む音などを鳴らす。止まっている
あいだ（前面に戻ってから最初に触るまで、電話で音の出口を取られたあと）にこれらの予約が溜まり、resume した瞬間に全部が
同時に鳴る。resume に失敗し続けると、ノードと音のバッファが増え続ける。

フレームから鳴る音だけを、AudioContext が動いているとき（`bus()` が ctx を返すとき）に限る。

## Current state

`src/lib/audio.svelte.ts:34-45`

```ts
/**
 * 自分でノードを組む音（BGM・鳴き声）の出口。wake() の前・ミュート中・止まっているあいだは undefined。
 */
export function bus(): AudioContext | undefined {
  return ctx && !audio.muted && ctx.state === 'running' ? ctx : undefined;
}

/**
 * その場で鳴らす効果音の出口。bus() と違って止まっているあいだも返し、予約した音は resume() が済むと鳴る
 */
export function sink(): AudioContext | undefined {
  return ctx && !audio.muted ? ctx : undefined;
}
```

`src/lib/games/pet-house/sounds.ts:381-393`（効果音の表 `SFX` を、いまの ctx に鳴らす版に包む）

```ts
/** いまの AudioContext に鳴らす版。音がまだ使えない・ミュートのあいだは何もしない */
export const sounds = Object.fromEntries(
  Object.entries(SFX).map(([k, f]) => [
    k,
    (...a: unknown[]) => {
      const ctx = sink();
      if (ctx) (f as (o: At, ...a: unknown[]) => void)({ ctx, out: sfxOut(ctx), t: ctx.currentTime + 0.005 }, ...a);
      if (k === 'shower') armDrips();
    }
  ])
) as Live;
```

触っていなくてもフレームの中から鳴る音（監査で確かめた呼び出し）は次のとおり。

- `reactions.ts:163` `sounds.eat` / `sounds.drink`（ペットがお皿で食べる・飲む）
- `reactions.ts:193` `sounds.land`（ソファやベッドから降りる）
- `reactions.ts:201` `sounds.step`（足音）
- `toys.ts:139` `sounds.bounce`、`toys.ts:143` `sounds.rattle`（投げたおもちゃが弾む・転がる）
- `toys.ts:205` `sounds.rustle`（ねこじゃらしの羽根）

ほかの `sounds.*`（`pop`・`throw`・`catch`・`coin` など）はタッチか、タッチの直後の出来事から鳴る。

## Commands you will need

| Purpose             | Command                                                            | Expected on success  |
| ------------------- | ------------------------------------------------------------------ | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                   | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house/sounds-live.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                                                    | all pass             |
| 型                  | `pnpm check`                                                       | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                        | exit 0               |

## Scope

In scope は `src/lib/games/pet-house/sounds.ts` と `src/lib/games/pet-house/sounds-live.test.ts`（新規）。

Out of scope は `src/lib/audio.svelte.ts`（`sink` と `bus` の意味は変えない）、BGM・鳴き声、ほかのゲームの効果音、
既存の `sounds.test.ts`（音の中身のテスト。遅いので触らない）。

## Git workflow

- コミット 1 つ。メッセージ例 `Skip ambient pet sounds while audio is suspended`。末尾に Co-Authored-By を 1 行
- push しない。git stash は使わない

## Steps

### Step 1: フレームから鳴る音だけ、動いているときに限る

`sounds.ts` に次を足し、包む関数の ctx の取り方を分ける。

```ts
// 触っていなくてもフレームから鳴る音。止まっているあいだに予約すると、resume したときにまとめて鳴ってしまう
const AMBIENT = new Set<keyof typeof SFX>(['eat', 'drink', 'land', 'step', 'bounce', 'rattle', 'rustle']);
```

包む関数の `const ctx = sink();` を `const ctx = AMBIENT.has(k as keyof typeof SFX) ? bus() : sink();` にする。`bus` を
`$lib/audio.svelte` の import に足す。`SFX` に上の名前が無いものがあれば STOP（名前を報告する）。

**Verify**: `pnpm check` → 0 errors

### Step 2: テストを書く

`src/lib/games/pet-house/sounds-live.test.ts`（node の unit project）を作る。`vi.mock('$lib/audio.svelte', ...)` で `sink` と
`bus` を差し替え、ctx の偽物は使われたかどうかだけ分かればよい（`createGain` などを `vi.fn` で返す最小のもの。足りない
メソッドで落ちるなら、そのメソッドも足す）。2 本。

1. `bus()` が undefined・`sink()` が偽物のとき、`sounds.step('floor', false)` は偽物の ctx に何も作らない。`sounds.coin()` は作る
   （`createGain` などが 1 回以上呼ばれる）
2. `bus()` と `sink()` がどちらも偽物のとき、`sounds.step('floor', false)` も作る

`sounds.step` などの引数は `sounds.ts` の `SFX` の型に合わせる。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/sounds-live.test.ts` → 2 passed

### Step 3: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm lint` → exit 0

## Test plan

`sounds-live.test.ts` 2 本（Step 2）。音の聞こえ方は iPad の実機で、前面に戻した直後に物音がまとめて鳴らないかを見る
（レビュー担当が申し送る）。

## Done criteria

- [ ] `grep -n "AMBIENT" src/lib/games/pet-house/sounds.ts` が 2 行以上
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` が通る
- [ ] `git diff --name-only 4f6f07a` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- `SFX` に `AMBIENT` の名前が無いものがある
- 偽物の ctx が作れず、テストのために `sounds.ts` の作りを変える必要がある

## Maintenance notes

- フレームの中から鳴らす効果音を足すときは `AMBIENT` に入れる。タッチから鳴らす音は入れない（iOS で最初のタッチの音が消える）
