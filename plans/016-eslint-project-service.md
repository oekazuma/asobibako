# Plan 016: ESLint の `projectService` を外して lint を速くする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 016 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- eslint.config.js`
> 変わっていたら「Current state」の全文と見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                      |
| ---------- | ------------------------------------------------------- |
| Priority   | P3                                                      |
| Effort     | S                                                       |
| Risk       | LOW（設定を減らすだけ。`pnpm lint` が緑のままなら成功） |
| Depends on | none                                                    |
| Category   | dx                                                      |
| Planned at | commit `b4b0196`, 2026-09-22                            |

## Why this matters

`eslint.config.js` は `.svelte` ファイルに `parserOptions.projectService: true` を付けている。これは
型情報を使う規則（`no-floating-promises` など）のために TypeScript のプログラムを組む設定だが、有効な
規則は `js.configs.recommended` / `ts.configs.recommended` / `svelte.configs.recommended` だけで、
型情報を使う規則は 1 つもない。つまりプログラムを組んで、何も聞かずに捨てている。

計測では `eslint 'src/**/*.svelte'`（約 70 ファイル）が 9.4 秒、`eslint 'src/**/*.ts'`（約 60 ファイル、
`projectService` なし）が 4.3 秒で、`pnpm lint` 全体 16 秒のうち 13 秒が ESLint。`projectService` を外すと
`.svelte` の lint は `.ts` 並みになる見込み。

型情報を使う規則を採用する道もある（`recommendedTypeChecked`）が、それは今の緑のリポジトリに新しい
失敗を持ち込み、`.ts` の engine にも `projectService` を広げることになる。この計画は外す側を取る。
採用したくなったら、そのときに `projectService` を `.ts` にも付けて戻せばよい。

## Current state

`eslint.config.js`（現状の全文）

```js
import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import { includeIgnoreFile } from '@eslint/compat';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-eslint';
const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default ts.config(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser
      }
    }
  }
);
```

`parser: ts.parser` は `<script lang="ts">` を読むために **必要**。`extraFileExtensions` も同じ。外すのは
`projectService: true` の 1 行だけ。

`package.json` の `lint` は `prettier --check . && eslint . && markuplint -p --no-allow-warnings "src/**/*.svelte" src/app.html`。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的       | コマンド                  | 成功時       |
| ---------- | ------------------------- | ------------ |
| 計測（前） | `time pnpm exec eslint .` | 秒数を控える |
| lint       | `pnpm lint`               | exit 0       |
| 計測（後） | `time pnpm exec eslint .` | 前より短い   |
| まとめ     | `pnpm verify`             | exit 0       |

## Scope

**In scope**

- `eslint.config.js`
- `plans/README.md`

**Out of scope**

- 規則の追加・変更 — しない
- `.markuplintrc.jsonc`、`.prettierrc` — 触らない
- `package.json` の `lint` スクリプト — 触らない

## Git workflow

- ブランチ: `advisor/016-eslint-project-service`
- コミット 1 つ。英語の命令形 1 文（例: `Stop building a TypeScript program for ESLint rules that never use it`）、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: 変更前の時間を控える

```bash
time pnpm exec eslint .
```

`real` の秒数を控える（目安 13 秒前後）。

### Step 2: `projectService` を外す

`eslint.config.js` の最後のブロックを次にする。

```js
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        // 型情報を使う規則は有効にしていないので、TypeScript のプログラムは組まない（lint が倍近く速い）
        extraFileExtensions: ['.svelte'],
        parser: ts.parser
      }
    }
  }
```

確認 — `pnpm lint` → exit 0（警告も 0。ESLint が `.svelte` の TS を読めなくなっていれば parse error が出る）

### Step 3: 変更後の時間を控える

```bash
time pnpm exec eslint .
```

Step 1 より短いことを確かめる（目安 半分程度）。短くなっていなければ、`projectService` が原因ではなかった
ということなので STOP して両方の数字を報告する（変更は戻す）。

### Step 4: 検証

確認 — `pnpm verify` → exit 0

## Test plan

自動テストはない。`pnpm lint` が緑で、時間が短くなっていれば完了。

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -n "projectService" eslint.config.js` が 0 件
- [ ] `grep -n "parser: ts.parser" eslint.config.js` が 1 件（残っている）
- [ ] Step 3 の時間が Step 1 より短い（両方の数字を Status の更新時に索引の行の隣に書いてよい）
- [ ] `git status` で `eslint.config.js` と `plans/README.md` 以外が変わっていない
- [ ] `plans/README.md` の 016 の Status を更新した

## STOP conditions

- `pnpm lint` が `projectService` を外したことで新しいエラーを出す（`eslint-plugin-svelte` の規則が型情報を
  要求している。エラー全文を報告し、変更を戻す）
- Step 3 で時間が短くならない

## Maintenance notes

- 型情報を使う規則（`no-floating-promises`、`no-misused-promises`、`await-thenable`）を入れたくなったら、
  `ts.configs.recommendedTypeChecked` に替え、`projectService: true` を **`**/*.ts` を含む** ブロックに付ける
  （engine の `.ts` にも効かせないと意味がない）。そのときは `pnpm lint` が遅くなることを受け入れる
