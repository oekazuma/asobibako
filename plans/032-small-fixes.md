# Plan 032: 小さな直し 3 つ（影の種類・紙吹雪の距離・Backup.svelte の行数）

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4c06cf0..HEAD -- src/lib/games/snow-camp/world3d.ts src/lib/components/Confetti.svelte src/lib/components/SoloTitle.svelte src/lib/components/Backup.svelte src/lib/components/Backup.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                      |
| ---------- | ----------------------------------------------------------------------- |
| Priority   | P3                                                                      |
| Effort     | S                                                                       |
| Risk       | LOW（見た目は同じか、横向きで正しくなるだけ。分割は振る舞いを変えない） |
| Depends on | none                                                                    |
| Category   | tech-debt                                                               |
| Planned at | commit `4c06cf0`, 2026-09-26                                            |

## Why this matters

1. 雪原サバイバルが three で廃止された `THREE.PCFSoftShadowMap` を使っていて、`CampWorld` を作るたびに console に
   「PCFSoftShadowMap has been removed. Using PCFShadowMap instead.」の警告が出る（three が既に PCF で描いているので、
   書き換えても見た目は変わらない）。わんにゃんハウスは既に `PCFShadowMap` にしてある
2. 紙吹雪（`Confetti.svelte`）の落ちる距離の既定値が `110dvh`。1 人用の結果画面（`SoloResult.svelte`）はこの既定値のまま
   使う。横向きのタッチ端末では `.stage` を 90 度回すので `dvh` は盤面の **幅** を指し、紙吹雪が盤面の途中で消えて
   降り直す。CLAUDE.md は「盤面の中の大きさは `dvh` ではなく `%` か `cqh` / `cqw` で指定する」と決めている。
   対戦の結果画面は既に `fall="120cqh"` を渡している。同じ理由で `SoloTitle.svelte` の `78vw` も `cqw` にそろえる
3. `Backup.svelte` が 202 行で、CLAUDE.md の「コンポーネントは 200 行未満」を超えている（svelte-vitals は info として
   報告するだけで、CI は通ってしまう）

## Current state

`src/lib/games/snow-camp/world3d.ts:175` — `this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;`

`src/lib/games/pet-house/world3d.ts:168-169`（見本）

```ts
// この版の PCF は shadow.radius の円盤でぼかす（PCFSoft は廃止された）
this.renderer.shadowMap.type = THREE.PCFShadowMap;
```

`src/lib/components/Confetti.svelte:4-5`

```ts
/** 落ちる距離。半分の画面では枠の外へ出れば十分なので、使う側が指定する */
let { count = 36, fall = '110dvh' }: { count?: number; fall?: string } = $props();
```

`src/lib/components/ResultScreen.svelte:12` — `<Confetti count={24} fall="120cqh" />`。
`src/lib/components/SoloResult.svelte:16` — `<Confetti />`（既定値）。どちらも `.stage`（`src/app.css:170-179`、
`container-type: size`）の中で描かれる。

`src/lib/components/SoloTitle.svelte:113-116`

```css
  .art {
    display: block;
    /* 背の低い画面ではタイトルとボタンに高さを譲るため、高さ 24cqh ぶんの幅までに抑える */
    width: min(78vw, 420px, 41cqh);
```

`src/lib/components/Backup.svelte`（202 行）— 書き出し（`save` / `share` / `done`）、読み込むファイルを選ぶ `pick`、
読み込みの確認フォーム（`submit`、保護者ゲート `Gate`、`.confirm` / `.gate` / `.agree` の CSS）を 1 つに持つ。
確認フォームのマークアップは `:105-124`、その CSS は `:154-201`。テストは `src/lib/components/Backup.svelte.test.ts`
（クラス名 `.confirm` / `.gate b` / `.gate input` / `.agree input` / `.err` と、`button[type=submit]` を見る）。

## Commands you will need

| Purpose             | Command                                   | Expected on success  |
| ------------------- | ----------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`          | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/components` | all pass             |
| 全テスト            | `pnpm test:run`                           | all pass             |
| 型                  | `pnpm check`                              | 0 errors, 0 warnings |
| lint                | `pnpm lint`                               | exit 0               |
| vitals              | `pnpm vitals --diff`                      | exit 0               |

## Scope

In scope は次のファイル。

- `src/lib/games/snow-camp/world3d.ts`（1 行とコメント）
- `src/lib/components/Confetti.svelte`（既定値だけ）
- `src/lib/components/SoloTitle.svelte`（`78vw` だけ）
- `src/lib/components/Backup.svelte`
- `src/lib/components/BackupConfirm.svelte`（新規）

Out of scope は次のとおり。

- `ResultScreen.svelte`（既に `cqh`）
- バックアップの振る舞い（文言・ゲート・読み込み）。分割だけで、画面に出るものは 1 文字も変えない
- `Backup.svelte.test.ts`（クラス名を保てば変えずに通るはず。変える必要が出たら STOP）

## Git workflow

- 3 コミットに分ける。例 `Use PCFShadowMap in snow-camp` / `Measure confetti and the title art by the stage` /
  `Split the backup confirm form out of Backup.svelte`。末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- push しない

## Steps

### Step 1: 雪原サバイバルの影

`snow-camp/world3d.ts:175` を `THREE.PCFShadowMap` にする。見本のようなコメントは要らない（見た目が変わらないため）。

**Verify**: `grep -rn "PCFSoftShadowMap" src` → 0 行。`pnpm exec vitest run src/lib/games/snow-camp` → all pass

### Step 2: 紙吹雪とタイトルの額

- `Confetti.svelte` の既定値を `fall = '110cqh'` にする
- `SoloTitle.svelte` の `min(78vw, 420px, 41cqh)` を `min(78cqw, 420px, 41cqh)` にする

**Verify**: `grep -rn "dvh\|[0-9]vw" src/lib/components/Confetti.svelte src/lib/components/SoloTitle.svelte` → 0 行。
`pnpm exec vitest run src/lib/components` → all pass

### Step 3: 読み込みの確認フォームを部品に分ける

`src/lib/components/BackupConfirm.svelte` を作り、`Backup.svelte` の `{#if pending && gate && sum}` の中身（`<form class="confirm" ...>`
全体）と、`submit`・`ans`・`agreed`、`.confirm` / `.gate` / `.gate input` / `.agree` / `.agree input` の CSS を移す。

- props は `pending: Backup`、`oncancel: () => void`、`onfail: (message: string) => void` の 3 つにする。
  `gate` と `sum` は `BackupConfirm` の中で作る（`const gate = new Gate()` は部品が mount されるたび、つまりファイルを
  選ぶたびに新しくなるので、今の `pick` で `gate = new Gate()` しているのと同じ）
- 読み込みに失敗したとき（`importAll` が false）は `onfail('読み込めませんでした（保存できる容量を超えています）。いまの記録は元のままです。')`、
  「やめる」は `oncancel()`。親はどちらでも `pending = null` にし、`onfail` では `error` に文言を入れる
- 親の `pick` から `gate = new Gate()` / `ans = ''` / `agreed = false` を消し、親に残った使わない import と state を消す
- `.pill` / `.row` / `.warn` / `.err` / `p` の CSS はフォームでも使うので、`BackupConfirm.svelte` にも必要なぶんを置く
  （Svelte の CSS は部品ごとに閉じるため）。見た目は変えない

**Verify**: `wc -l src/lib/components/Backup.svelte src/lib/components/BackupConfirm.svelte` → どちらも 200 未満。
`pnpm exec vitest run src/lib/components/Backup.svelte.test.ts` → all pass（テストは変えない）。`pnpm check` → 0 errors

### Step 4: 全体の確認

**Verify**: `pnpm test:run` → all pass（ノミのテストが乱数でまれに落ちるのは既知。落ちたらもう一度流す）。
`pnpm lint` → exit 0（markuplint を含む）。`pnpm vitals --diff` → exit 0

## Test plan

新しいテストは書かない。`Backup.svelte.test.ts` の 2 本が、分割のあとも読み込み・ゲート・失敗の表示が同じであることを
確かめる。紙吹雪と影は見た目だけの変更で、既存のテストが通ればよい。

## Done criteria

- [ ] `grep -rn "PCFSoftShadowMap" src` が 0 行
- [ ] `grep -n "110cqh" src/lib/components/Confetti.svelte` と `grep -n "78cqw" src/lib/components/SoloTitle.svelte` が 1 行ずつ
- [ ] `Backup.svelte` と `BackupConfirm.svelte` がどちらも 200 行未満
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` が通る
- [ ] `git diff --name-only 4c06cf0` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- `Backup.svelte.test.ts` を変えないと通らない（振る舞いが変わった可能性）
- markuplint が新しい部品の `<form>` や `<label>` の組み方で落ち、`.markuplintrc.jsonc` を変えないと通らない

## Maintenance notes

- 盤面（`.stage`）の中で大きさを決めるときは `cqh` / `cqw` か `%`。`dvh` / `vw` は横向きで盤面の幅を指してしまう
- バックアップの画面に手を入れるときは、書き出し（`Backup.svelte`）と読み込みの確認（`BackupConfirm.svelte`）のどちらか
  片方だけを触ればよいように分けてある
