# Plan 034: アプリについて（/about）から、端末の控えで記録を戻せるようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 22c2720..HEAD -- src/lib/mirror.ts src/lib/mirror.test.ts src/lib/components/BackupConfirm.svelte src/routes/about/+page.svelte`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                            |
| ---------- | ----------------------------------------------------------------------------- |
| Priority   | P1                                                                            |
| Effort     | S                                                                             |
| Risk       | LOW（控えを読むだけの口と、既存の保護者ゲート付きの読み込みを使う画面を足す） |
| Depends on | none                                                                          |
| Category   | direction                                                                     |
| Planned at | commit `22c2720`, 2026-09-26                                                  |

## Why this matters

`src/lib/mirror.ts` は、localStorage の記録を IndexedDB（`asobibako-mirror` の `latest`）へ写しておき、起動したとき記録が
空なら自動で戻す。けれども、自動で戻らなかったとき（たとえば一部のキーだけ残って「空」とみなされなかった、戻したあとで
別の不具合が起きた）に、保護者が控えを見て手で戻す道がない。控えはあっても、使えないまま次の 30 秒ごとの写しで
今の状態に置き換わってしまう。

この計画のあと、アプリについてに「この端末の控え」のカードが出て、控えがいつの記録か・何本のゲームの記録かが見え、
保護者ゲート（掛け算）を通せば控えで全部を置き換えられる。読み込みの確認には、ファイルの読み込みと同じ部品
（`BackupConfirm.svelte`）を使う。

## Current state

- `src/lib/mirror.ts` — 控えの読み書き。export は `Store`・`idb`・`snapshot`・`restoreIfEmpty`・`watch`。
  控えの中身は `exportAll` と同じ JSON で、`parseBackup` で `Backup` に戻せる。IndexedDB は iOS で開くところで止まることが
  あるので、起動時の読みは `RESTORE_WAIT`（1.5 秒）で見切っている

```ts
// src/lib/mirror.ts（抜粋）
const RESTORE_WAIT = 1500;
export const idb: Store = { async get() { ... }, async set(text) { ... } };
const LATE = Symbol('late');
export async function restoreIfEmpty(store = idb, wait = RESTORE_WAIT): Promise<boolean> {
  ...
    const reading = store.get();
    const text = await Promise.race([reading, new Promise<typeof LATE>((r) => setTimeout(() => r(LATE), wait))]);
  ...
}
```

- `src/lib/components/BackupConfirm.svelte`（112 行）— 読み込みの確認フォーム。props は
  `{ pending: Backup; oncancel: () => void; onfail: (message: string) => void }`。中で `new Gate()`（保護者の掛け算、
  1 日 3 回まで）を作り、通ったら `importAll(pending)` → 成功なら `location.reload()`、失敗なら `onfail(...)`。
  1 行目の文は

```svelte
<p><b>{sum.games} 本</b>のゲームの記録・{sum.keys} 件（{sum.at} に書き出し）</p>
```

- `src/lib/components/Backup.svelte` の使い方が見本（`{#if pending}{#key pending}<BackupConfirm {pending} oncancel=… onfail=… />{/key}{/if}`）。
  mount 後に端末の値を読む書き方（`onMount(() => { canShare = ...; lastAt = backedUpAt(); })`）も同じファイルにある
- `src/routes/about/+page.svelte`（145 行）— カードは `<section class="card"><h2>…</h2>…</section>` を縦に並べる。
  最後が「バックアップ」（`<Backup />`）
- `summarize(b)`（`src/lib/backup.ts`）は `{ games, keys, at }` を返す。`at` は控えを取った日（`YYYY-MM-DD`）
- テスト: `src/lib/components/Backup.svelte.test.ts` が mount・`vi.stubGlobal('location', { ...location, reload })`・
  ゲートの答えの入れ方（`.gate b` の `a × b` を読んで `.gate input` に入れ、`.agree input` を押す）の見本。
  `src/lib/mirror.test.ts` は `Store` の偽物（`{ get, set }`）と、テストごとに `vi.resetModules()` してから
  `await import('./mirror')` する書き方
- 画面の文は保護者向けなので漢字まじりでよい（アプリについての他のカードと同じ）。コメントは日本語で WHY だけ

## Commands you will need

| Purpose             | Command                                                                                                                                | Expected on success  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                                                                                       | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/mirror.test.ts src/lib/components/MirrorRestore.svelte.test.ts src/lib/components/Backup.svelte.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                                                                                                                        | all pass             |
| 型                  | `pnpm check`                                                                                                                           | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                                                                                            | exit 0               |
| vitals              | `pnpm vitals --diff`                                                                                                                   | exit 0               |

## Scope

In scope は次のファイル。

- `src/lib/mirror.ts`（読むだけの関数を 1 つ足す）、`src/lib/mirror.test.ts`
- `src/lib/components/MirrorRestore.svelte`（新規）、`src/lib/components/MirrorRestore.svelte.test.ts`（新規）
- `src/lib/components/BackupConfirm.svelte`（文の「書き出し」を差し替えられる prop を 1 つ足すだけ）
- `src/routes/about/+page.svelte`（カードを 1 つ足す）
- `CLAUDE.md`（アプリについての説明に 1 文）

Out of scope は次のとおり。

- `restoreIfEmpty`・`snapshot`・`watch` の振る舞い（起動時の自動復元と控えの取り方は変えない）
- 控えを何世代も持つこと
- `Backup.svelte`（ファイルの書き出しと読み込み）

## Git workflow

- ステップごとにコミットしてよい。メッセージは英語の命令形 1 行（例 `Let parents restore records from the device mirror`）。
  末尾に Co-Authored-By を 1 行
- push しない

## Steps

### Step 1: 控えを読むだけの関数を足す

`src/lib/mirror.ts` に次を足す。

```ts
/** いまの控え。無い・壊れている・待ちきれないときは null。アプリについてで見せて、保護者が手で戻すのに使う */
export async function peek(store = idb, wait = RESTORE_WAIT): Promise<Backup | null>;
```

`Promise.race([store.get(), 待ち時間で undefined])` の結果が文字列なら `parseBackup` して返し、それ以外や例外は `null`。
`verified` や `RESTORE_PENDING_KEY` には触らない（読むだけ）。`Backup` 型は `./backup` から import する。

`src/lib/mirror.test.ts` に 3 本足す（既存の `file()` と `m`（読み直したモジュール）を使う）。

1. 控えがあれば `Backup` を返し、`data` が控えの中身と同じ
2. 控えが壊れている（`get` が `'{'` を返す）なら null
3. `get` が止まったままなら、`peek(stuck, 50)` が 1 秒以内に null を返す

**Verify**: `pnpm exec vitest run src/lib/mirror.test.ts` → all pass（3 本増える）

### Step 2: 確認フォームの文を差し替えられるようにする

`BackupConfirm.svelte` の props に `from = '書き出し'` を足し、1 行目の `（{sum.at} に書き出し）` を `（{sum.at} に{from}）` にする。
ファイルの読み込み（`Backup.svelte`）からは渡さないので、今の表示は変わらない。

**Verify**: `pnpm exec vitest run src/lib/components/Backup.svelte.test.ts` → pass（テストは変えない。「2026-09-01 に書き出し」の
文を見ているテストがそのまま通ること）

### Step 3: 控えのカードを作る

`src/lib/components/MirrorRestore.svelte` を作る。

- `onMount` で `peek()` を呼び、結果を `found`（`Backup | null`）に入れる。読むあいだは `loading = true`
- 表示は 3 通り
  - 読んでいるあいだ「控えを読んでいます…」
  - 控えが無い（null）「この端末にはまだ控えがありません。遊んだ記録は、画面を閉じるときなどに自動で控えます。」
  - 控えがある「{at} 時点の控えがあります（{games} 本のゲームの記録・{keys} 件）。記録が消えて自動で戻らなかったときは、
    ここから戻せます。」と、ボタン「控えから戻す」（`class="pill"`、アイコンは `upload`）。数字は `summarize(found)`
- 「控えから戻す」を押すと `pending = found`。`{#if pending}<BackupConfirm {pending} from="控え" oncancel={() => (pending = null)} onfail={(m) => ((pending = null), (error = m))} />{/if}`
- `error` があれば `<p class="err" role="alert">{error}</p>`
- CSS は `Backup.svelte` の `p` / `.row` / `.pill` / `.err` に合わせる（部品ごとに閉じるので必要なぶんを書く）

`src/routes/about/+page.svelte` の「バックアップ」のカードの前に次を足す。

```svelte
<section class="card">
  <h2>この端末の控え</h2>
  <MirrorRestore />
</section>
```

**Verify**: `pnpm check` → 0 errors。`wc -l src/lib/components/MirrorRestore.svelte src/routes/about/+page.svelte` → どちらも 200 未満

### Step 4: 控えのカードのテストを書く

`src/lib/components/MirrorRestore.svelte.test.ts` を作る（見本は `Backup.svelte.test.ts`）。
`vi.mock('$lib/mirror', () => ({ peek: vi.fn() }))` にして、テストごとに `peek` の返り値を決める。3 本。

1. 控えが無い（`peek` が null）と「まだ控えがありません」が出て、「控えから戻す」は無い
2. 控えがある（`asobibako:reached:maze` を含む `Backup`）と、日付とゲームの本数が出る。「控えから戻す」→ ゲートに答える →
   確認のチェック → 「読み込む」で `location.reload` が呼ばれ、localStorage の `asobibako:reached:maze` が控えの値になる。
   確認の文に「に控え）」が入っている
3. 「控えから戻す」→「やめる」で確認のフォームが消え、localStorage は変わらない

`peek` の解決を待つには `await vi.waitFor(() => expect(target.textContent).toContain(...))` を使う。

**Verify**: `pnpm exec vitest run src/lib/components/MirrorRestore.svelte.test.ts` → 3 passed

### Step 5: CLAUDE.md に今の仕様を 1 文足す

「更新」の節の `/about` のカードの並び（「…データの扱い・バックアップ（`Backup.svelte`）のカードを縦に並べる」）に
「この端末の控え（`MirrorRestore.svelte`。`mirror.ts` の `peek()` で控えの日付と本数を見せ、保護者ゲートを通して控えで全部を置き換える）」を、
バックアップの前に加える。経緯は書かない。

**Verify**: `grep -c "MirrorRestore" CLAUDE.md` → 1 以上。`pnpm lint` → exit 0

### Step 6: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

- `src/lib/mirror.test.ts` に 3 本（Step 1）
- `src/lib/components/MirrorRestore.svelte.test.ts` 3 本（Step 4）
- `src/lib/components/Backup.svelte.test.ts` は変えずに通ること（Step 2）

## Done criteria

- [ ] 対象テストがすべて pass し、`git diff --stat 22c2720 -- src/lib/components/Backup.svelte.test.ts` が空
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` が通る
- [ ] 新しい部品とアプリについてのページがどちらも 200 行未満
- [ ] `git diff --name-only 22c2720` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- 抜粋と今のコードが違う
- `peek` を足すのに `restoreIfEmpty` や `snapshot` の振る舞いを変える必要が出た
- `BackupConfirm.svelte` に `from` 以外の変更が要る

## Maintenance notes

- 控えで戻すと、そのあと自動の控え（30 秒ごと・画面が隠れるとき）が戻した中身で `latest` を取り直す。戻す前の記録は残らない
  （確認フォームが「すべて置き換わります。元に戻せません」と出すのはそのため）
- 控えの日付は `exportAll` の `at`（控えを取った日）。同じ日のうちの時刻は持たない
