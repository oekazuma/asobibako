# Plan 029: 描画ループが 1 度の例外で止まらないようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4c06cf0..HEAD -- src/lib/loop.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                  |
| ---------- | ------------------------------------------------------------------- |
| Priority   | P2                                                                  |
| Effort     | S                                                                   |
| Risk       | LOW（例外のあとも次のフレームを回すだけ。正常時の動きは変わらない） |
| Depends on | none                                                                |
| Category   | bug                                                                 |
| Planned at | commit `4c06cf0`, 2026-09-26                                        |

## Why this matters

`src/lib/loop.ts` の `animate()` は、14 本のゲームすべての `requestAnimationFrame` ループの土台。いまは `frame()` を
呼んだあとで次のフレームを予約するので、`frame()` が 1 度でも投げると次が予約されず、ゲームは固まったまま戻らない。
わんにゃんハウスは場面の組み立て（three）や 1 秒ごとの自動保存もこのループの中で行う。メモリが足りず canvas の
`getContext` が null を返すような一時的な失敗でも、子どもには「アプリが壊れた」と見え、自動保存も止まる。
ホーム画面のアプリには DevTools がないので、最初の例外は `asobibako:last-error` に残して一覧で見えるようにする。

## Current state

`src/lib/loop.ts`（全文）

```ts
/**
 * requestAnimationFrame で frame(dt 秒, now) を回す。戻り値で止める。
 * タブが裏に回った復帰直後などに物体が一気にワープしないよう、dt は 0.05 秒までに抑える
 */
export function animate(frame: (dt: number, now: number) => void): () => void {
  let raf = 0;
  let last = performance.now();
  const tick = (now: number) => {
    frame(Math.max(0, Math.min(0.05, (now - last) / 1000)), now);
    last = now;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
```

`src/lib/last-error.ts` の `remember(message: string)` が最後のエラーを 1 件だけ localStorage に残す（使えない環境では
何もしない）。テストは `src/lib/*.test.ts` に置き、`vite.config.ts` の `unit` project（node 環境）で走る。
node には `requestAnimationFrame` がないので、テストでは `vi.stubGlobal` で差し替える。

## Commands you will need

| Purpose             | Command                                     | Expected on success  |
| ------------------- | ------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`            | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/loop.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                             | all pass             |
| 型                  | `pnpm check`                                | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                 | exit 0               |

## Scope

In scope は `src/lib/loop.ts` と `src/lib/loop.test.ts`（新規）。

Out of scope は各ゲームの `frame` の中身と、わんにゃんハウスの「いどうちゅう…」の後始末（組み立て中に投げたら部屋へ
戻すなど）。まずループが止まらないことだけを直す。

## Git workflow

- コミット 1 つ。メッセージ例 `Keep the frame loop running after an exception`。末尾に
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- push しない

## Steps

### Step 1: 先に次のフレームを予約し、最初の例外だけ残す

`tick` を次の形にする。

```ts
let failed = false;
const tick = (now: number) => {
  // 先に予約しておく。frame が投げても次のフレームは回り、ゲームが固まったままにならない
  raf = requestAnimationFrame(tick);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;
  try {
    frame(dt, now);
  } catch (e) {
    // 毎フレーム投げ続けることもあるので、残すのは最初の 1 回だけ
    if (failed) return;
    failed = true;
    console.error(e);
    remember(e instanceof Error ? e.message : String(e));
  }
};
```

`remember` は `./last-error` から import する。止める関数（`cancelAnimationFrame(raf)`）は今のままで、frame の中から
止めても予約済みの `raf` が消える。

**Verify**: `pnpm check` → 0 errors

### Step 2: テストを書く

`src/lib/loop.test.ts` を作る。`requestAnimationFrame` を、コールバックを配列に溜めて id を返す偽物に
`vi.stubGlobal` で差し替え、`cancelAnimationFrame` も差し替える。溜めたコールバックを手で 1 つずつ呼ぶ。

1. 最初の frame が投げても、次のフレームで frame がもう一度呼ばれる。`console.error` は（`vi.spyOn` で黙らせて）1 回だけ
2. 投げ続けても `console.error` は 1 回だけ
3. 戻り値で止めたあとは、予約済みのコールバックが取り消される（`cancelAnimationFrame` が最後の id で呼ばれる）
4. dt は 0.05 秒までに抑えられる（100ms あけて呼ぶと 0.05）

**Verify**: `pnpm exec vitest run src/lib/loop.test.ts` → 4 passed。Step 1 の予約を `frame` のあとへ戻すとテスト 1 が
落ちることを確かめてから戻す

### Step 3: 全体の確認

**Verify**: `pnpm test:run` → all pass（ノミのテストが乱数でまれに落ちるのは既知。落ちたらもう一度流す）。
`pnpm lint` → exit 0

## Test plan

`src/lib/loop.test.ts` の 4 本（Step 2）。見本の書き方は `src/lib/fingers.test.ts`（node 環境の小さなテスト）。

## Done criteria

- [ ] `src/lib/loop.test.ts` があり 4 本 pass
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` が通る
- [ ] `git diff --name-only 4c06cf0` が `src/lib/loop.ts` と `src/lib/loop.test.ts`（+ `plans/README.md`）だけ

## STOP conditions

- どこかのゲームが「frame が投げたらループが止まる」ことに頼っている（例: 投げて終わらせる）と分かった
- 抜粋と今のコードが違う

## Maintenance notes

- 例外は握りつぶさず、最初の 1 件を一覧の画面（`last-error`）に出す。固まったと聞いたら、まずそこを見る
- 毎フレーム投げ続ける不具合はループが回るぶん電池を使う。見つけたら元を直す
