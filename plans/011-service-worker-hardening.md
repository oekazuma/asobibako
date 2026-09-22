# Plan 011: Service Worker の runtime cache を同一オリジンに絞り、書き込み失敗を握る

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 011 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/service-worker.ts src/lib/pwa.ts`
> 変わっていたら「Current state」の全文と見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Priority   | P2                                                                                               |
| Effort     | S                                                                                                |
| Risk       | LOW（キャッシュに入るものを減らす方向だけ。オフラインの範囲は install 時の precache で保たれる） |
| Depends on | none                                                                                             |
| Category   | security / perf                                                                                  |
| Planned at | commit `b4b0196`, 2026-09-22                                                                     |

## Why this matters

`src/service-worker.ts` の `fetch` ハンドラは、`GET` で 200 が返ったものを **何でも** `cache.put` する。
オリジンを見ず、クエリ付きの URL も別エントリになり、`void cache.put(...)` なので容量超過
（iPadOS は 1 オリジンの容量が小さい）は unhandled rejection になる。アプリ自身は外部へ通信しない
（CSP の `connect-src 'self'`）ので今すぐ困るわけではないが、`ASSETS.includes(url.pathname)` が
オリジンを見ない点も含め、「同一オリジンのアプリ資産だけを扱う」と明示しておくと、将来の変更で
静かに崩れない。

同じファイルに、監査で挙がったが **やらない** と決めたことも記録しておく。three のチャンク（gzip 145KB、
precache の約半分）を install 時の precache から外す案は、更新のたびに snow-camp を一度オンラインで
遊ぶ必要が出るので見送った。このアプリはオフライン優先で、`updateApp()` は precache の完了を待つ設計。

## Current state

`src/service-worker.ts`（現状の全文）

```ts
/// <reference types="@sveltejs/kit" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, prerendered, version } from '$service-worker';

const sw = globalThis.self as unknown as ServiceWorkerGlobalScope;

const CACHE = `table-duel-${version}`;
const ASSETS = [...build, ...files, ...prerendered];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const url = new URL(event.request.url);
      const cache = await caches.open(CACHE);

      // ビルド成果物はバージョン付きなので、キャッシュのものと必ず同一
      if (ASSETS.includes(url.pathname)) {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
      }

      try {
        const response = await fetch(event.request);
        if (response instanceof Response && response.status === 200) {
          void cache.put(event.request, response.clone());
        }
        return response;
      } catch (err) {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        throw err;
      }
    })()
  );
});
```

`ASSETS` の要素は `/table-duel/_app/immutable/...` のような base 付きのパス（`$service-worker` が
`paths.base` を含めて渡す）。ビルド後の数は 93。

CSP は `vite.config.ts` の `csp: { mode: 'hash' }` で `<meta http-equiv>` として **文書にだけ** 配られる。
Service Worker のスクリプトは GitHub Pages がヘッダを出せないので CSP の外で走る。今は
`$service-worker` 以外を import していないので実害はないが、そのことをファイルに書いておく。

`src/lib/pwa.ts:20` は `k.startsWith('table-duel-')` でキャッシュを消す。`CACHE` の接頭辞を変えるなら両方。

規約 — コメントは WHY だけ・日本語、prettier。テストは 009 の `dom` project があれば書けるが、
この計画では含めない（Maintenance notes に形を書いた）。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的          | コマンド                     | 成功時                              |
| ------------- | ---------------------------- | ----------------------------------- |
| 型            | `pnpm check`                 | `0 ERRORS`                          |
| lint          | `pnpm lint`                  | exit 0                              |
| ビルド + 確認 | `pnpm build && pnpm preview` | `http://localhost:4173/table-duel/` |
| まとめ        | `pnpm verify`                | exit 0                              |

Service Worker は `pnpm dev` では動かない。`pnpm build && pnpm preview` で確かめる。

## Scope

**In scope**

- `src/service-worker.ts`
- `plans/README.md`

**Out of scope**

- `src/lib/pwa.ts` — 変えない
- precache の中身（`ASSETS`）— 減らさない（上記の決定）
- `install` を `allSettled` にして部分的な失敗を許す案 — 一部だけ欠けたキャッシュでオフラインになるより、
  install が失敗して前の版が残るほうが安全。変えない

## Git workflow

- ブランチ: `advisor/011-service-worker-hardening`
- コミット 1 つ。英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: `ASSETS` を `Set` にし、同一オリジンだけ扱う

`fetch` ハンドラを次にする。

```ts
const ASSETS = [...build, ...files, ...prerendered];
const ASSET_PATHS = new Set(ASSETS);

sw.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // 扱うのは自分の配信物だけ。ほかのオリジンは素通しにして、キャッシュにも入れない
  if (url.origin !== sw.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);

      // ビルド成果物はバージョン付きなので、キャッシュのものと必ず同一
      if (ASSET_PATHS.has(url.pathname)) {
        const hit = await cache.match(url.pathname);
        if (hit) return hit;
      }

      try {
        const response = await fetch(event.request);
        // クエリ違いを別々に溜めない。容量超過は握って、次からネットワークだけで動く
        if (response.status === 200 && !url.search) cache.put(event.request, response.clone()).catch(() => {});
        return response;
      } catch (err) {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        throw err;
      }
    })()
  );
});
```

`response instanceof Response` の判定は、同一オリジンで `fetch` が返すものは必ず `Response` なので外す。
`ASSETS` は `install` の `cache.addAll(ASSETS)` でまだ使う。

`_app/version.json`（`?`なしのパス）は 5 分ごとに取りに行き 200 が返るので、これまでどおり 1 エントリが
上書きされ続ける（増えない）。

確認 — `pnpm check` → `0 ERRORS`、`pnpm lint` → exit 0

### Step 2: CSP の外で走ることをファイルに記す

ファイル先頭の `import` の上に 1 行コメントを足す。

```ts
// この worker は <meta> の CSP の外で走る（GitHub Pages はヘッダを出せない）。import は $service-worker だけに保つ
import { build, files, prerendered, version } from '$service-worker';
```

確認 — `grep -c "^import" src/service-worker.ts` が 1

### Step 3: ビルドして確かめる

`pnpm build && pnpm preview` で `http://localhost:4173/table-duel/` を開く。

1. DevTools → Application → Service Workers で activated になっていることを見る
2. Application → Cache Storage → `table-duel-<version>` の中身を見る。`_app/...`、`/table-duel/`、
   `manifest.webmanifest` などがある
3. Network を Offline にして読み直す。期待 — 一覧が出る。ゲームを開いて遊べる（snow-camp も含む）
4. Online に戻し、アドレスバーに `http://localhost:4173/table-duel/?x=1` を入れて読み直す。
   Cache Storage に `?x=1` のエントリが **増えない**

確認 — 上の 4 つ。`pnpm verify` → exit 0

## Test plan

この計画では書かない。009 のあとで `src/service-worker.test.ts` を `dom` project に足すなら、
`vi.mock('$service-worker', () => ({ build: ['/table-duel/_app/a.js'], files: [], prerendered: ['/table-duel/'], version: 'v' }))`、
`self.addEventListener` を記録する fake、`caches` の stub を用意し、次を見る。

- `ASSETS` にあるパスの GET はキャッシュから返り `fetch` を呼ばない
- 別オリジンの GET は `respondWith` されない
- クエリ付きの 200 は `cache.put` されない
- `fetch` が reject しキャッシュにあれば返る、なければ reject

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -n "url.origin !== sw.location.origin" src/service-worker.ts` が 1 件
- [ ] `grep -n "ASSET_PATHS.has" src/service-worker.ts` が 1 件、`ASSETS.includes` が 0 件
- [ ] `grep -n "\.catch(() => {})" src/service-worker.ts` が 1 件、`void cache.put` が 0 件
- [ ] Step 3 の 4 つ
- [ ] `git status` で `src/service-worker.ts` と `plans/README.md` 以外が変わっていない
- [ ] `plans/README.md` の 011 の Status を更新した

## STOP conditions

- 「Current state」の全文と一致しない
- `sw.location` が型に無い（`ServiceWorkerGlobalScope` の定義が変わっている。`self.location` で代用してよいが報告する）
- Step 3 の 3 でオフラインの一覧が出ない（precache が壊れている。変更前の状態でも同じかを確かめて報告）

## Maintenance notes

- `CACHE` の接頭辞 `table-duel-` は `src/lib/pwa.ts:20` と対。片方を変えたらもう片方も
- three のチャンクを precache から外す判断は索引の「considered and rejected」に記録してある。
  更新後にオフラインで snow-camp が遊べなくてよいと決めたら、`vite.config.ts` の `build.rollupOptions.output.manualChunks`
  で three を `three` という名前のチャンクにし、`install` の `addAll` からその名前を含むパスを除く
