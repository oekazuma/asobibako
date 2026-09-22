# Plan 010: 更新確認の失敗を正しく出し、iPad 上の実行時エラーを見えるようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 010 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/components/AppUpdate.svelte src/routes/+layout.svelte src/hooks.client.ts`
> `src/hooks.client.ts` が既にあれば STOP（誰かが先に作っている）。

## Status

| 項目       | 値                                  |
| ---------- | ----------------------------------- |
| Priority   | P2                                  |
| Effort     | S                                   |
| Risk       | LOW（足すだけ。描画には影響しない） |
| Depends on | none                                |
| Category   | bug / dx                            |
| Planned at | commit `b4b0196`, 2026-09-22        |

## Why this matters

2 つの小さな穴を、同じ画面（一覧の `AppUpdate`）でふさぐ。

1. 「あたらしいバージョンがないか確認する」を押すと `updated.check()` を待って `checked = true` にする。
   SvelteKit の `check()` はネットワークに失敗すると **例外を投げず `false` を返す** ので、オフラインの
   iPad でも「確認しました（最新版です）」と出る。壊れたビルドから逃げたい人に、自信たっぷりの
   間違いを見せる
2. ホーム画面に追加したアプリ（`display: standalone`）には URL バーも DevTools もない。ゲームの
   rAF ループの中で例外が起きると盤面が止まるだけで、何が起きたかを知る手段が「Mac とケーブルで
   Web Inspector」しかない。一覧には既にビルド時刻と git hash が出ているので、その横に「最後に起きた
   エラー」を出せば、実機での再現報告が一気に楽になる

## Current state

`src/lib/components/AppUpdate.svelte:15-23`（現状）

```ts
async function check() {
  checking = true;
  try {
    await updated.check();
  } finally {
    checking = false;
    checked = true;
  }
}
```

`src/lib/components/AppUpdate.svelte:44`（現状）

```svelte
<p class="state">{checking ? '確認しています…' : checked ? '確認しました（最新版です）' : '最新版です'}</p>
```

同 `:47-48`

```svelte
{#if error}<small class="error">{error}</small>{/if}
<small class="version">いまのバージョン: {built}（{hash || version}）</small>
```

`updated.check()` の実体は `node_modules/@sveltejs/kit/src/runtime/client/utils.js:271-295`（kit 2.70.3）で、
`fetch` を `try { ... } catch { return false }` で包み、新版があれば `true`、なければ `false` を返す。
つまり「ネットワーク失敗」と「新版なし」は戻り値で区別できず、`navigator.onLine` で補う。

`src/routes/+layout.svelte`（現状の全文）

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { updated } from '$app/state';
  import '../app.css';
  import { keepScreenAwake } from '$lib/wake-lock.svelte';

  let { children } = $props();

  onMount(keepScreenAwake);

  // ホーム画面のアプリはページ遷移が少なくポーリングも止まりがちなので、前面に戻ったときに新版を確認する（1 分に 1 回まで）
  let lastCheck = 0;
  function onVisible() {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < 60_000) return;
    lastCheck = Date.now();
    void updated.check();
  }
</script>

<svelte:document onvisibilitychange={onVisible} />
```

`src/hooks.client.ts` は存在しない。SvelteKit の `handleError`（クライアント）は、ナビゲーション・`load`・
レンダリング中の例外を受ける。rAF のコールバックや `setTimeout` の中の例外は受けないので、
`window` の `error` / `unhandledrejection` も拾う。

localStorage のキーは `table-duel:` で始める（既存は `table-duel:muted`、`table-duel:level:<id>`）。

`AppUpdate.svelte` は 112 行。200 行の制限まで余裕がある。

規約 — コメントは WHY だけ・日本語、prettier、CSP は `script-src 'self'`（インラインスクリプトは書けない。
`hooks.client.ts` はビルドに含まれるので問題ない）。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド                    | 成功時                      |
| ------ | --------------------------- | --------------------------- |
| 型     | `pnpm check`                | `0 ERRORS`                  |
| lint   | `pnpm lint`                 | exit 0（markuplint も通す） |
| vitals | `pnpm vitals --diff`        | exit 0                      |
| まとめ | `pnpm verify`               | exit 0                      |
| 目視   | `pnpm dev` → `/table-duel/` | 後述                        |

## Scope

**In scope**

- `src/lib/components/AppUpdate.svelte`
- `src/routes/+layout.svelte`
- `src/hooks.client.ts`（新規）
- `src/lib/last-error.ts`（新規。読み書きの小さな関数）
- `plans/README.md`

**Out of scope**

- `src/lib/pwa.ts` — 変えない
- エラーの送信先（サーバー・分析）— ない。localStorage に最後の 1 件だけ
- `+error.svelte` — 変えない

## Git workflow

- ブランチ: `advisor/010-update-check-and-error-surface`
- コミットは 2 つ（更新確認 / エラー表示）。英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: `check()` で失敗を区別する

`AppUpdate.svelte` の `check()` を次にする。

```ts
async function check() {
  checking = true;
  error = '';
  try {
    // check() はネットワークに失敗しても false を返すだけなので、オフラインは自分で見分ける
    const fresh = await updated.check();
    if (!fresh && !navigator.onLine) error = 'インターネットに接続してから確認してください';
    else checked = true;
  } finally {
    checking = false;
  }
}
```

`checked` はオンラインで確認できたときだけ `true` にする。`error` の表示は既存の `{#if error}` がある。

確認 — `pnpm check` → `0 ERRORS`

### Step 2: 最後のエラーを覚える小さなモジュール

`src/lib/last-error.ts` を新規に作る。

```ts
const KEY = 'table-duel:last-error';

export interface LastError {
  message: string;
  at: number;
}

/** ホーム画面のアプリには DevTools がないので、最後に起きたエラーを 1 件だけ残して一覧に出す */
export function remember(message: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ message: message.slice(0, 300), at: Date.now() } satisfies LastError));
  } catch {
    // 保存できなければ諦める
  }
}

export function recall(): LastError | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LastError) : null;
  } catch {
    return null;
  }
}

export function forget(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // noop
  }
}

/** window の error / unhandledrejection を拾う。戻り値で外す */
export function watch(): () => void {
  const onError = (e: ErrorEvent) => remember(`${e.message} (${e.filename?.split('/').pop() ?? ''}:${e.lineno})`);
  const onReject = (e: PromiseRejectionEvent) => remember(String(e.reason?.message ?? e.reason));
  addEventListener('error', onError);
  addEventListener('unhandledrejection', onReject);
  return () => {
    removeEventListener('error', onError);
    removeEventListener('unhandledrejection', onReject);
  };
}
```

確認 — `pnpm check` → `0 ERRORS`

### Step 3: `hooks.client.ts` と `+layout.svelte` で拾う

`src/hooks.client.ts` を新規に作る。

```ts
import type { HandleClientError } from '@sveltejs/kit';
import { remember } from '$lib/last-error';

export const handleError: HandleClientError = ({ error, message }) => {
  remember(error instanceof Error ? error.message : message);
};
```

`+layout.svelte` の `onMount(keepScreenAwake);` を次にする。

```ts
onMount(() => {
  const unwatch = watch();
  const release = keepScreenAwake();
  return () => {
    unwatch();
    release();
  };
});
```

`import { watch } from '$lib/last-error';` を足す。

確認 — `pnpm check` → `0 ERRORS`、`pnpm lint` → exit 0

### Step 4: 一覧に出す

`AppUpdate.svelte` の `<small class="version">` の下に足す。

```svelte
{#if lastError}
  <small class="last-error">
    さいごのエラー: {new Date(lastError.at).toLocaleString('ja-JP')}
    {lastError.message}
    <button class="clear" onclick={clearError}>けす</button>
  </small>
{/if}
```

script 側

```ts
import { forget, recall, type LastError } from '$lib/last-error';
let lastError = $state<LastError | null>(null);
onMount(() => (lastError = recall()));
function clearError() {
  forget();
  lastError = null;
}
```

`onMount` を `svelte` から import する。プリレンダーされるので、localStorage は mount 後に読む
（サーバーでは `null`）。

CSS は `.error` に倣って `.last-error { flex-basis: 100%; color: var(--ink-soft); font-size: 11px; }`、
`.clear` は `.check` と同じ形の小さいボタン。`aria-label` は不要（文字がある）。

確認 — `pnpm lint` → exit 0（markuplint）、`pnpm vitals --diff` → exit 0

### Step 5: 目視

`pnpm dev` で `http://localhost:5173/table-duel/` を開く。

1. DevTools の Network を Offline にして「あたらしいバージョンがないか確認する」を押す。
   期待 — 「インターネットに接続してから確認してください」が出て、「確認しました（最新版です）」は出ない
2. Online に戻して押す。期待 — 「確認しました（最新版です）」
3. Console で `setTimeout(() => { throw new Error('test') })` を実行し、ページを読み直す。
   期待 — 「さいごのエラー: … test (…)」が出る。「けす」で消える

確認 — 上の 3 つ。`pnpm verify` → exit 0

## Test plan

- `last-error.ts` は 009 の `dom` project があれば `src/lib/last-error.test.ts` で `remember`/`recall`/`forget` を
  3 件テストできる（localStorage を使う）。009 が未実施なら書かない（`unit` は node なので localStorage がない）
- `AppUpdate` の表示は目視

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `src/hooks.client.ts` と `src/lib/last-error.ts` が存在する
- [ ] `grep -n "navigator.onLine" src/lib/components/AppUpdate.svelte` が 2 件（既存の `update()` と `check()`）
- [ ] `grep -n "table-duel:last-error" src/lib/last-error.ts` が 1 件
- [ ] Step 5 の目視 3 つ
- [ ] `AppUpdate.svelte` が 200 行未満
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 010 の Status を更新した

## STOP conditions

- `src/hooks.client.ts` が既にある
- `updated.check()` の戻り値が boolean でない（kit のバージョンが変わっている。`node_modules/@sveltejs/kit/package.json` の version を報告）
- `AppUpdate.svelte` が 200 行に近づく（表示を別コンポーネントに分ける必要があるなら STOP して相談）

## Maintenance notes

- エラーの文字列は 300 文字で切る。スタックは残さない（localStorage を汚さない）
- 将来エラーを外に送るなら、`remember()` の中だけを変える。CSP の `connect-src 'self'` も変えることになる
