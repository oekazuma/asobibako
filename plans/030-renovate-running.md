# Plan 030: Renovate が asobibako で動いているか確かめる（利用者が画面で行う）

> **この計画は実行エージェントには渡さない。** GitHub App のインストール範囲はトークンから読めず、変えるには
> 利用者本人の操作が要る。利用者が読んで、自分で確かめる。
>
> **Drift check**: `gh pr list --repo oekazuma/asobibako --state all --author "app/renovate" --limit 5` が 1 件でも
> 出たら、Renovate はもう動いている。この計画は REJECTED（動いていた）にして終わる。

## Status

| 項目       | 値                                                  |
| ---------- | --------------------------------------------------- |
| Priority   | P2                                                  |
| Effort     | S                                                   |
| Risk       | LOW                                                 |
| Depends on | 025（テストの門を先に入れてから自動マージを動かす） |
| Category   | migration                                           |
| Planned at | commit `4c06cf0`, 2026-09-26                        |

## Why this matters

CLAUDE.md には「Renovate が minor/patch を自動マージする」とあり、`renovate.json` もその設定になっている。ところが
監査時点（2026-09-26）で、このリポジトリには Renovate の PR も issue も 0 件で、オンボーディングの PR も
Dependency Dashboard もない。同じ時期の姉妹リポジトリ（hitoiki）には `renovate[bot]` の PR が来ている。
`pnpm outdated` では typescript-eslint・eslint・svelte・markuplint などの更新が止まったままになっている。
依存の更新やセキュリティ修正が、誰も気づかないまま止まっているおそれがある。

`renovate.json` の `platformAutomerge: true` に対してリポジトリの `allow_auto_merge` は `false` だが、計画 008 の
調べどおり、この組み合わせでは Renovate が CI の緑を待って自分でマージするので、これは直さなくてよい。

## Current state

- `renovate.json` — `extends: ["config:recommended"]`、minor/patch/pin/digest を automerge、three は手動
- `gh api repos/oekazuma/asobibako --jq .allow_auto_merge` → `false`
- ruleset `main: CI must pass`（id 23843675）が有効
- リポジトリは PUBLIC

## Steps（利用者が行う）

### Step 1: Renovate App の対象にこのリポジトリが入っているか見る

ブラウザで https://github.com/settings/installations を開き、Renovate の「Configure」を押す。
「Repository access」が「Only select repositories」なら、一覧に `asobibako` があるか見る。無ければ足して保存する。

**Verify**: 数分〜1 時間ほどで、リポジトリに「Dependency Dashboard」という issue か、Renovate の PR が現れる。
`gh issue list --repo oekazuma/asobibako --search "Dependency Dashboard"` で確かめる

### Step 2: 入っていたのに動いていない場合

https://developer.mend.io/ にサインインし、`oekazuma/asobibako` のジョブの記録を開いて、失敗の理由を読む
（設定の誤りなら `renovate.json` の直しを別の計画にする）。

### Step 3: 最初の Dependency Dashboard で catalog の扱いを確かめる

`renovate.json` の packageRules に「catalog の depType に効いているかは最初の Dependency Dashboard で確かめる」とある。
Dashboard の依存の一覧で、`pnpm-workspace.yaml` の catalog の依存が `devDependencies` のグループに入っているか見る。
入っていなければ、その packageRule を `matchDepTypes: ["pnpm.catalog.default"]` にする（three を除く）直しを
別の計画にする。

## Done criteria

- [ ] Dependency Dashboard の issue がある、または Renovate の PR が 1 件以上ある
- [ ] `plans/README.md` のこの行を DONE にする

## STOP conditions

- mend.io のジョブ記録が「リポジトリに入れない」以外の理由で失敗している（設定を直す計画が別に要る）

## Maintenance notes

- Renovate が動き出すと、最初に溜まっていた更新の PR がまとめて来る。自動マージは CI の緑が条件なので、
  計画 024（揺らぐテスト）と 025 を先に入れておく
