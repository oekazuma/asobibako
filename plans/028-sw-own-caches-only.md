# Plan 028: Service Worker が消すキャッシュを自分のものだけにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4c06cf0..HEAD -- src/service-worker.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                           |
| ---------- | ---------------------------- |
| Priority   | P2                           |
| Effort     | S                            |
| Risk       | LOW（消す対象が減るだけ）    |
| Depends on | none                         |
| Category   | bug                          |
| Planned at | commit `4c06cf0`, 2026-09-26 |

## Why this matters

`caches`（Cache Storage）はパスではなくオリジン単位で共有される。このアプリは `oekazuma.github.io/asobibako/` にあり、
同じオリジンには利用者の別のアプリ（kakikaki・hitoiki など）の Pages も同居している。新版の Service Worker が
有効になるたびに、自分以外のキャッシュ（姉妹アプリのオフライン用の控え）まで消してしまう。消されたアプリは、
次に開いたときネットワークがないと白い画面になる。姉妹アプリの側は `kk-` などの接頭辞で自分のものだけを消している。

## Current state

`src/service-worker.ts:10`

```ts
const CACHE = `asobibako-${version}`;
```

`src/service-worker.ts:27-34`

```ts
sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});
```

このファイルの先頭のコメントにあるとおり、worker の import は `$service-worker` だけに保つ（別モジュールへ出さない）。
`src/lib/pwa.ts` の `pwaStatus()` は `asobibako-` で始まるキャッシュを数えている（接頭辞はこれで揃っている）。

## Commands you will need

| Purpose             | Command                          | Expected on success  |
| ------------------- | -------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile` | exit 0               |
| 型                  | `pnpm check`                     | 0 errors, 0 warnings |
| lint                | `pnpm lint`                      | exit 0               |
| ビルド              | `pnpm build`                     | exit 0               |

## Scope

In scope は `src/service-worker.ts` だけ。Out of scope は install と fetch の処理、`src/lib/pwa.ts`。

## Git workflow

- コミット 1 つ。メッセージ例 `Leave sibling apps' caches alone on activate`。末尾に
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- push しない

## Steps

### Step 1: 消す対象を接頭辞で絞る

`CACHE` の定義を次の 2 行に分ける。

```ts
const PREFIX = 'asobibako-';
const CACHE = `${PREFIX}${version}`;
```

activate の filter は `(k) => k.startsWith(PREFIX) && k !== CACHE` にし、その直前に WHY を 1 行置く
（例 `// caches はオリジンで共有され、同じ github.io に別のアプリのキャッシュもある。自分の古い版だけを消す`）。

**Verify**: `grep -n "startsWith(PREFIX)" src/service-worker.ts` → 1 行。`pnpm check` → 0 errors。`pnpm lint` → exit 0。
`pnpm build` → exit 0

## Test plan

Service Worker は自動テストを持たない（ビルドが要る。既存の方針）。1 行の条件なので、ビルドが通ることと grep で足りる。

## Done criteria

- [ ] Step 1 の Verify がすべて期待どおり
- [ ] `git diff --name-only 4c06cf0` が `src/service-worker.ts`（+ `plans/README.md`）だけ

## STOP conditions

- `CACHE` の名前が `asobibako-` で始まっていない（`pwa.ts` の数え方と食い違う）

## Maintenance notes

- キャッシュ名の接頭辞を変えるときは、`src/lib/pwa.ts` の `pwaStatus()` の数え方も合わせる。変えた最初の版では
  古い接頭辞のキャッシュが消えずに残るので、その版だけ古い接頭辞も消す
