# Plan 025: 本番へのデプロイの前にテストを通す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4c06cf0..HEAD -- .github/workflows/deploy.yml CLAUDE.md`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                            |
| ---------- | ------------------------------------------------------------- |
| Priority   | P1                                                            |
| Effort     | S                                                             |
| Risk       | LOW（デプロイが 30 秒ほど遅くなり、テストが赤いと止まる）     |
| Depends on | 024（揺らぐテストを先に直さないと、デプロイがときどき止まる） |
| Category   | dx                                                            |
| Planned at | commit `4c06cf0`, 2026-09-26                                  |

## Why this matters

利用者はローカルで merge して `main` に直接 push している（PR は 0 件）。`main` への push で
`.github/workflows/deploy.yml` が走り、`pnpm build` だけでそのまま GitHub Pages（家族の iPad が開くアプリ）へ出す。
CI（`ci.yml`）も同じ push で走るが、deploy はその結果を待たない。ruleset の required checks には管理者の bypass が
付いているので、直接 push では効かない。記録の保存のような壊れると取り返しのつかないコードが、テストの落ちたまま
数分で本番に届く。deploy の build job にテストを 1 段足せば、テストが赤いときは出さなくなる。

## Current state

`.github/workflows/deploy.yml:19-40`

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup Node.js and dependencies
        uses: ./.github/workflows/setup-node

      - name: Run Build
        run: pnpm build
        env:
          BASE_PATH: /${{ github.event.repository.name }}

      - name: Upload Pages artifact
```

`ci.yml` の test job は `- name: Run Vitest` / `run: pnpm test:run` という名前と書き方。これに合わせる。
`pnpm test:run` は手元で約 25 秒（957 本）。

CLAUDE.md の「規約」の節に「CI（`.github/workflows/ci.yml`）は PR では lint（+ svelte-vitals 全体スキャン）/ check / test / build を
並列に、`main` への push では build を除く 3 つを回す（ビルドと配信は `deploy.yml`）。」とある。

## Commands you will need

| Purpose | Command                                                   | Expected on success |
| ------- | --------------------------------------------------------- | ------------------- |
| 書式    | `pnpm exec prettier --check .github/workflows/deploy.yml` | exit 0              |
| lint    | `pnpm lint`                                               | exit 0              |

## Scope

In scope は `.github/workflows/deploy.yml` と `CLAUDE.md`（上の 1 文だけ）。

Out of scope は次のとおり。

- `ci.yml` と ruleset。bypass を外すと利用者の直接 push が止まるので触らない
- `workflow_run` で CI の完了を待つ作り。`paths-ignore` と並列性の扱いが変わるので採らない
- deploy に `pnpm check` や `pnpm lint` を足すこと。本番を壊すのはテストで見つかる類いなので、テストだけにする

## Git workflow

- コミット 1 つ。メッセージ例 `Run the tests before deploying to Pages`。末尾に
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- push しない（push すると本番にデプロイされる）

## Steps

### Step 1: build job にテストの段を足す

`Setup Node.js and dependencies` と `Run Build` のあいだに、次の段を足す。

```yaml
- name: Run Vitest
  run: pnpm test:run
```

`timeout-minutes: 10` はそのままでよい（ci.yml の test job も 10 分）。

**Verify**: `pnpm exec prettier --check .github/workflows/deploy.yml` → exit 0。
`grep -n "pnpm test:run" .github/workflows/deploy.yml` → 1 行。
`awk '/Run Vitest/{v=NR} /Run Build/{b=NR} END{print (v && v<b) ? "ok" : "ng"}' .github/workflows/deploy.yml` → `ok`

### Step 2: CLAUDE.md の説明を合わせる

上の 1 文の「（ビルドと配信は `deploy.yml`）」を「（ビルドと配信は `deploy.yml` で、ビルドの前に `pnpm test:run` を通す）」にする。

**Verify**: `grep -n "ビルドの前に" CLAUDE.md` → 1 行。`pnpm lint` → exit 0

## Test plan

ワークフローはローカルで動かせない。確認は書式と段の順番（Step 1）まで。push 後の初回の Actions で
`Run Vitest` が緑になることを利用者が見る（レビュー担当が申し送る）。

## Done criteria

- [ ] Step 1 の 3 つの Verify が期待どおり
- [ ] `pnpm lint` が exit 0
- [ ] `git diff --name-only 4c06cf0` が `.github/workflows/deploy.yml` と `CLAUDE.md`（+ `plans/README.md`）だけ

## STOP conditions

- deploy.yml の build job の段が抜粋と違う
- `.github/workflows/setup-node` が依存をインストールしていない（`pnpm test:run` が動かない）と分かった

## Maintenance notes

- テストが遅い CI で時間切れになったら、`timeout-minutes` を延ばす前に遅いテスト（pet-house の `sounds.test.ts` と
  `models.test.ts` が各 15 秒以上）を見る
- 揺らぐテストが入ると本番へのデプロイが止まる。揺らぎは見つけたらすぐ直す
