# Plan 049: 本番へのデプロイの前に型チェックを通す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat b565b01..HEAD -- .github/workflows/deploy.yml`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                          |
| ---------- | ----------------------------------------------------------- |
| Priority   | P1                                                          |
| Effort     | S                                                           |
| Risk       | LOW（デプロイが 30 秒ほど遅くなり、型エラーがあると止まる） |
| Depends on | none                                                        |
| Category   | dx                                                          |
| Planned at | commit `b565b01`, 2026-10-14                                |

## Why this matters

利用者はローカルで merge して `main` に直接 push している（PR を通さない）。`main` への push で
`.github/workflows/deploy.yml` が走り、テスト（`pnpm test:run`）とビルドだけを通して GitHub Pages（家族の iPad が開くアプリ）へ出す。
型チェック（`pnpm check`。svelte-check と scripts の tsc）は `ci.yml` で同じ push に並んで走るが、デプロイはその結果を待たない。
`vite build` は型を見ないので、型エラーのあるコードがテストに引っかからなければ、CI が赤くなるのと同時に本番に届く。
前の計画 025 でテストを 1 段足したのと同じやり方で、型チェックも 1 段足す。

lint（prettier・eslint・markuplint）は足さない。字の並びの崩れは遊ぶ人に届く不具合ではないので、それでデプロイを止めると
直接 push する運用で手間だけが増える。

## Current state

`.github/workflows/deploy.yml:18-43`（build の job）は次のとおり。

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

      - name: Run Vitest
        run: pnpm test:run

      - name: Run Build
        run: pnpm build
        env:
          BASE_PATH: /${{ github.event.repository.name }}

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: build/
```

`ci.yml` の check の job は `pnpm check` を 1 段で走らせている（step 名は `Run svelte-check`）。2026-10-12 の CI では check の job が
準備込みで約 40 秒、deploy の build の job が約 2 分 50 秒だった。`timeout-minutes: 10` のままで足りる。

`package.json` の `check` は `svelte-kit sync && svelte-check --tsconfig ./tsconfig.json && tsc -p tsconfig.scripts.json`。

CLAUDE.md の「規約」の節（81 行目あたり）に、デプロイの説明がある。

```text
CI（`.github/workflows/ci.yml`）は PR では lint（+ svelte-vitals 全体スキャン）/ check / test / build を並列に、`main` への push では build を除く 3 つを回す（ビルドと配信は `deploy.yml` で、ビルドの前に `pnpm test:run` を通す）。
```

CLAUDE.md はほぼ毎日変わるので、drift check には入れていない。見るのは上の 1 文だけで、
`grep -o "ビルドの前に[^）]*" CLAUDE.md` が「ビルドの前に `pnpm test:run` を通す」なら進む。

利用者の約束として、CLAUDE.md と docs は最新の仕様だけを書き、経緯や計画の番号は書かない。

## Commands you will need

| Purpose         | Command                              | Expected on success           |
| --------------- | ------------------------------------ | ----------------------------- |
| 型              | `pnpm check`                         | `0 ERRORS 0 WARNINGS`、exit 0 |
| YAML の字の並び | `pnpm exec prettier --check .github` | exit 0                        |
| 全部            | `pnpm verify`                        | exit 0                        |

## Scope

**In scope**

- `.github/workflows/deploy.yml`（step を 1 つ足す）
- `CLAUDE.md`（上の 1 文の括弧の中だけ）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `.github/workflows/ci.yml` — 変えない。main への push で check が 2 回走るのは受け入れる
- `workflow_run` で CI の成功を待つ作り — テストと型を 2 回走らせない代わりに、CI が落ちたときの再実行や手動のデプロイ
  （`workflow_dispatch`）の扱いが変わるので採らない
- lint をデプロイの前に足すこと（Why this matters のとおり）
- `setup-node` の composite action

## Git workflow

- ブランチは `advisor/049-deploy-runs-check`
- コミットは英語の命令形 1 文（例 `Type-check before deploying to GitHub Pages`）
- push しない。push すると本番へのデプロイが走る

## Steps

### Step 1: deploy の build の job に `pnpm check` を足す

`Setup Node.js and dependencies` と `Run Vitest` のあいだに次の step を足す（字下げは前後の step にそろえる）。

```yaml
- name: Run svelte-check
  run: pnpm check
```

テストより先に置く。型チェックのほうが速く終わるので、型エラーのときに早く止まる。

**Verify**: `pnpm exec prettier --check .github` → exit 0。
`grep -n "pnpm check" .github/workflows/deploy.yml` → 1 行出る。

### Step 2: CLAUDE.md の説明を今の手順に合わせる

CLAUDE.md の上の文の括弧の中を「ビルドと配信は `deploy.yml` で、ビルドの前に `pnpm check` と `pnpm test:run` を通す」にする。
ほかの字は変えない。

**Verify**: `grep -o "ビルドの前に[^）]*" CLAUDE.md` → 1 行出て、`pnpm check` と `pnpm test:run` の両方を含む。

### Step 3: 手元で同じ順に通ることを確かめる

**Verify**: `pnpm check` → `0 ERRORS 0 WARNINGS`、exit 0。続けて `pnpm verify` → exit 0。

## Test plan

- ワークフローは手元で動かせないので、上の 3 つの確かめで済ませる
- 利用者が main へ push したあと、GitHub の Actions で「Deploy to GitHub Pages」の build の job に「Run svelte-check」が
  出て緑になることを見る（実行担当は push しない。報告にこの確かめ方を書く）

## Done criteria

- [ ] `grep -n "pnpm check" .github/workflows/deploy.yml` が 1 行で、`Run Vitest` より前にある
- [ ] `pnpm exec prettier --check .github` が exit 0
- [ ] CLAUDE.md の差分が上の 1 文の括弧の中だけ（`git diff CLAUDE.md`）
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 049 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `deploy.yml` の build の job が上の抜粋と違う（step が増えた・減った）
- `pnpm check` が手元で赤い（先に直すべき型エラーがある。この計画では直さず報告する）
- CLAUDE.md に上の 1 文が見つからない

## Maintenance notes

- `pnpm check` が遅くなって deploy の build の job が 10 分に近づいたら、`timeout-minutes` を上げるか、`workflow_run` で
  CI を待つ作りを考える
- デプロイの前に何を通すかを変えたら、CLAUDE.md の同じ文も直す
