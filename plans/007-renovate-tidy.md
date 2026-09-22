# Plan 007: Renovate 設定を整理する

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 007 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- renovate.json pnpm-workspace.yaml`
> 変わっていたら「Current state」の全文と見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                    |
| ---------- | ----------------------------------------------------- |
| Priority   | P2                                                    |
| Effort     | S                                                     |
| Risk       | LOW（設定だけ。動作の確認は次の Renovate 実行を待つ） |
| Depends on | none                                                  |
| Category   | deps                                                  |
| Planned at | commit `b4b0196`, 2026-09-22                          |

## Why this matters

`renovate.json` は別リポジトリ（kakikaki）から写したもので、このリポジトリに合わない行が残っている。
放置すると次のことが起きる。

- `three` は 0.x なので `0.186 → 0.187` が **minor** 扱いになり自動マージされる。three は毎リリース API を
  消すのに、`@types/three` は別の PR で数日〜数週間遅れるので、古い型で `pnpm check` が通ったまま
  実行時に snow-camp が壊れる。しかもコードは `dist` に出ないので `pnpm build` も気づかない
- `typescript` は 6.0.3 が 6 系の終端で、7 系は `typescript-eslint`（peer `<6.1.0`）と `svelte-check`
  （peer `^5 || ^6`）が受け付けない。`@types/node` は Node 24 に合わせて 24 系に固定しているのに
  最新は 26。どちらも Renovate が毎回 major の PR を開き、手で閉じ続けることになる
- `video/**` を無効にする規則は、存在しないディレクトリを指している。`:disablePeerDependencies` は
  peerDependencies を宣言していないので何もしない
- `markuplint` 3 点、`vite` + `vitest`、`prettier` + `prettier-plugin-svelte` は一緒に動かさないと
  lint / test が赤くなるが、グループになっていない

## Current state

`renovate.json`（現状の全文）

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":disablePeerDependencies"],
  "minimumReleaseAge": "3 days",
  "labels": ["renovate"],
  "lockFileMaintenance": {
    "enabled": true,
    "automerge": true
  },
  "rangeStrategy": "bump",
  "platformAutomerge": true,
  "packageRules": [
    {
      "description": "自分のツールは pnpm 側の minimumReleaseAgeExclude と同じく待たずに取り込む",
      "matchPackageNames": ["svelte-vitals{/,}**", "@svelte-vitals{/,}**"],
      "minimumReleaseAge": null
    },
    {
      "description": "Auto-merge everything except major updates (those need review) — CI still has to pass first.",
      "matchUpdateTypes": ["minor", "patch", "pin", "digest"],
      "automerge": true
    },
    {
      "groupName": "devDependencies",
      "matchDepTypes": ["devDependencies"]
    },
    {
      "groupName": "linters",
      "matchPackageNames": ["eslint{/,}**", "@eslint{/,}**", "typescript-eslint{/,}**", "globals{/,}**"]
    },
    {
      "groupName": "typescript",
      "matchPackageNames": ["typescript"]
    },
    {
      "groupName": "Svelte",
      "matchPackageNames": ["@sveltejs/{/,}**", "svelte{/,}**"]
    },
    {
      "description": "video/（README の紹介動画を作る Remotion プロジェクト）は CI が検査しないので更新 PR を出さない",
      "matchFileNames": ["video/**"],
      "enabled": false
    }
  ]
}
```

`pnpm-workspace.yaml` のバージョンは catalog に集約されている（`package.json` は `catalog:` 参照だけ）。
関係する行は `three: ^0.186.0`、`'@types/three': ^0.186.0`、`typescript: ^6.0.3`、`'@types/node': ^24.0.0`、
`markuplint: ^5.0.0`、`'@markuplint/svelte-parser': ^5.0.0`、`'@markuplint/svelte-spec': ^5.0.0`、
`vite: ^8.3.0`、`vitest: ^4.1.11`、`prettier: ^3.9.6`、`prettier-plugin-svelte: ^4.1.1`。

`package.json` の `devEngines.runtime.version` は `24.18.1`。

このリポジトリはまだ Renovate の PR を 1 つも受けていない（2 日前に作られた）。`devDependencies`
グループが catalog の depType（Renovate は `pnpm.catalog.default` と報告するはず）に効くかは
**未確認**なので、この計画では触らず、最初の Dependency Dashboard で確かめる。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的               | コマンド                                                                   | 成功時                            |
| ------------------ | -------------------------------------------------------------------------- | --------------------------------- |
| JSON の妥当性      | `node -e "JSON.parse(require('fs').readFileSync('renovate.json','utf8'))"` | 出力なし・exit 0                  |
| 整形               | `pnpm lint`                                                                | exit 0（prettier が JSON も見る） |
| 設定の検証（任意） | `npx --yes renovate-config-validator renovate.json`                        | `Config validated successfully`   |

`renovate-config-validator` はネットワークからパッケージを取る。使えない環境なら省略してよい（JSON の妥当性と
`pnpm lint` で足りる）。

## Scope

**In scope**

- `renovate.json`
- `plans/README.md`

**Out of scope**

- `pnpm-workspace.yaml` — バージョンも `minimumReleaseAge` も変えない
- `package.json` — 変えない
- svelte-vitals の `minimumReleaseAge` 除外 — 意図的なので残す
- `platformAutomerge` — 008（ruleset）で扱う。ここでは触らない

## Git workflow

- ブランチ: `advisor/007-renovate-tidy`
- コミット 1 つ。英語の命令形 1 文（例: `Tidy the Renovate rules for this repo`）、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: 死んだ設定を消す

- `"extends"` から `":disablePeerDependencies"` を消し、`["config:recommended"]` にする
- `packageRules` の最後（`video/**` の規則）を丸ごと消す

確認 — `grep -c "video\|disablePeerDependencies" renovate.json` が 0

### Step 2: `three` と `@types/three` を 1 つの PR にまとめ、自動マージから外す

`packageRules` に足す（場所は `"Svelte"` グループの次）。

```json
{
  "description": "three は 0.x で minor でも API が消える。型と同じ PR にして、手で確かめてから入れる",
  "groupName": "three",
  "matchPackageNames": ["three", "@types/three"],
  "automerge": false
}
```

`automerge: true` の規則（`matchUpdateTypes`）より **後ろ** に置くこと。Renovate は後の規則が勝つ。

確認 — `grep -n '"groupName": "three"' renovate.json` が 1 件で、`"automerge": true` の規則より下の行にある

### Step 3: 上げられない major を明示的に止める

`packageRules` に足す（three の次）。

```json
    {
      "description": "typescript 7 は typescript-eslint（peer <6.1）と svelte-check（peer ^5 || ^6）が未対応。両方が広がったら外す",
      "matchPackageNames": ["typescript"],
      "matchUpdateTypes": ["major"],
      "enabled": false
    },
    {
      "description": "@types/node は package.json の devEngines.runtime（Node 24）に合わせる。Node を上げるときに一緒に上げる",
      "matchPackageNames": ["@types/node"],
      "matchUpdateTypes": ["major"],
      "enabled": false
    }
```

確認 — `grep -c '"matchUpdateTypes": \["major"\]' renovate.json` が 2

### Step 4: 一緒に動かすべきパッケージをグループにする

`packageRules` に足す（`"linters"` の隣）。

```json
    {
      "groupName": "markuplint",
      "matchPackageNames": ["markuplint", "@markuplint{/,}**"]
    },
    {
      "groupName": "vite",
      "matchPackageNames": ["vite", "vitest"]
    },
    {
      "groupName": "prettier",
      "matchPackageNames": ["prettier", "prettier-plugin-svelte"]
    }
```

確認 — `grep -c '"groupName"' renovate.json` が 8（devDependencies / linters / typescript / Svelte / three / markuplint / vite / prettier）

### Step 5: `devDependencies` グループに確認の印を付ける

`"groupName": "devDependencies"` の規則に `description` を足す。

```json
{
  "description": "catalog の depType に効いているかは最初の Dependency Dashboard で確かめる。効いていなければ matchDepTypes を pnpm.catalog.default にし、three を除外する",
  "groupName": "devDependencies",
  "matchDepTypes": ["devDependencies"]
}
```

確認 — `node -e "JSON.parse(require('fs').readFileSync('renovate.json','utf8'))"` が exit 0、`pnpm lint` → exit 0

### Step 6: 任意 — 設定を検証する

ネットワークが使えるなら `npx --yes renovate-config-validator renovate.json` を実行し、
`Config validated successfully` を確かめる。使えなければ省略。

## Test plan

自動テストはない。設定の効果は次の Renovate 実行（Dependency Dashboard の issue）で確かめる。
利用者向けのチェックリストを `Maintenance notes` に書いた。

## Done criteria

- [ ] `node -e "JSON.parse(...)"` が exit 0、`pnpm lint` が exit 0
- [ ] `grep -c "video\|disablePeerDependencies" renovate.json` が 0
- [ ] `grep -c '"groupName"' renovate.json` が 8
- [ ] `"groupName": "three"` の規則が `"automerge": true` の規則より後ろにある
- [ ] `git status` で `renovate.json` と `plans/README.md` 以外が変わっていない
- [ ] `plans/README.md` の 007 の Status を更新した

## STOP conditions

- `renovate.json` が「Current state」の全文と一致しない
- `renovate-config-validator` がエラーを返す（メッセージを報告する）

## Maintenance notes

最初の Dependency Dashboard で見ること（利用者向け）。

- `three` と `@types/three` が 1 つの PR になっているか
- `typescript` 7 / `@types/node` 26 の PR が **出ていない** か
- ungrouped の devDependencies の PR が個別に並んでいないか。並んでいれば Step 5 の description どおり
  `matchDepTypes` を直す
- Node 24.x のパッチが `devEngines.runtime.version` に届くか（届かなければ Renovate の npm manager が
  `devEngines` を読んでいない。`.node-version` を足すか、手で上げる）

`typescript-eslint` と `svelte-check` の peer が TS 7 を受け付けたら、Step 3 の規則を外す。
