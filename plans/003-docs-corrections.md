# Plan 003: README / CLAUDE.md / コメントの誤りを直す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 003 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- README.md CLAUDE.md src/lib/board-input.ts src/lib/games/hockey/Hockey.svelte src/lib/games.ts`
> 変わっていたら、各ステップの「現状」の文言が実際に存在するか `grep` で確かめてから進む。

## Status

| 項目       | 値                           |
| ---------- | ---------------------------- |
| Priority   | P1                           |
| Effort     | S                            |
| Risk       | LOW                          |
| Depends on | none                         |
| Category   | docs                         |
| Planned at | commit `b4b0196`, 2026-09-22 |

## Why this matters

README と CLAUDE.md は、人と AI エージェントがこのリポジトリで作業するときの唯一の手引き。
その中の「ゲームを追加する」手順は、書かれたとおりに `meta.ts` を書くと型エラーになる
（必須の `Thumb` が抜けている）。ほかにも、ピンぬきのクリア条件の数字が本文と食い違い、
公開先を変えるときに直す必要のないファイルを直せと書いてあり、CLAUDE.md が engine 分離の手本として
挙げる border-rush は実際には手本になっていない。コード側にも古いコメントが 2 つある。
どれも小さいが、間違った手引きは手引きがないより悪い。

## Current state

### README.md

`README.md:26`（現状）

```
- 男の子のいる床に金貨が 6 割届けばクリア。マグマに触れるとしっぱい
```

実際は `src/lib/games/pin-rescue/levels.ts:227` の `need: lerp(0.5, 0.75, difficulty(level))` で、
レベル 1 の 5 割からレベル 100 の 7 割半まで上がる。`README.md:28` には正しく
「要る金の割合 (5 割 → 7 割半) が少しずつ上がる」と書いてある。

`README.md:154-168`（現状の `meta.ts` の例）

```ts
import type { GameMeta } from '$lib/games';

export default {
  id: 'my-game', // URL (/games/my-game) になるので kebab-case
  name: '表示名',
  description: '一覧のカードに出す 1 文',
  players: 2, // 1 人用は 1
  minutes: '1分',
  load: async () => ({
    Game: (await import('./MyGame.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
```

`src/lib/games.ts:39-47` の `BaseMeta` は `Thumb: Component` を必須にしている。実際の
`src/lib/games/border-rush/meta.ts` は `import Thumb from './Thumb.svelte';` して `Thumb,` を渡している。
手順の 1〜4（`README.md:141-170`）に `Thumb.svelte` を書くステップがない。

`README.md:204`（現状）

```
`main` への push で GitHub Actions がビルドし、GitHub Pages へデプロイする (`BASE_PATH=/<リポジトリ名>`)。公開先を変えるときは `BASE_PATH=/other pnpm build` のように base を変え、`static/manifest.webmanifest` の `start_url` と `scope` を合わせる。
```

`static/manifest.webmanifest` の `start_url` と `scope` は `"./"`（相対）で、`src/app.html:11` が
`%sveltekit.assets%/manifest.webmanifest` で配信するので、`BASE_PATH` を変えても直す必要はない。
むしろ絶対パスに書き換えると次の変更で壊れる。

### CLAUDE.md

`CLAUDE.md` の「構成」節（現状の一部）

```
ゲーム 1 本は `src/lib/games/<id>/` に閉じ、対戦本体・`Howto.svelte`（タイトル画面の遊び方）・`meta.ts`（一覧用の情報と `load()`）を持つ。
```

`Thumb.svelte` が抜けている（「見た目」節には「一覧のカードの絵は各ゲームの `Thumb.svelte`」とある）。

同じ節の末尾（現状）

```
ルールは DOM に依存しない純粋なモジュール（border-rush なら `engine.ts`）に閉じて vitest で検証し、`.svelte` は描画と Pointer Events の配線だけを持つ。
```

border-rush は出現周期・上限・contest の確率・長押しの完了を `BorderRush.svelte:10-31,42-58` に持ち、
`engine.ts` に `step()` がない。手本としては hockey（`src/lib/games/hockey/engine.ts` に `step()`、
`Hockey.svelte` は描画と配線だけ）のほうが正しい。012 で border-rush も同じ形になる予定だが、
それまでの間も手引きは正しくあるべきなので、例を hockey に差し替える。

### コード内の古いコメント

`src/lib/board-input.ts:19`（現状）

```ts
 * turned は盤面が時計回りに 90 度回っているとき（app.css の .board.shell）。
```

`app.css` に `.board.shell` はない。回すのは `.stage`（`app.css:176-186` の
`@media (orientation: landscape) and (pointer: coarse)`）。

`src/lib/games/hockey/Hockey.svelte:17`（現状）

```ts
/** マレットの要素は 1 人ぶん 2 個ずつ先に置いておき、毎フレーム位置と表示だけ書き換える */
```

`MALLETS_PER_PLAYER = 1`（`hockey/engine.ts:56`）。要素の数は `{#each Array.from({ length: MALLETS_PER_PLAYER }...` で
定数に従うので、コメントの「2 個ずつ」が古い。

### 文章の規約

- README・CLAUDE.md は「最新仕様のスナップショット」だけを書く。経緯・変更履歴・issue 参照は書かない
- 日本語。半角英数と日本語の間にスペース（既存の書き方に合わせる）
- Markdown は prettier が整形する（`pnpm lint` で検査される）

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド      | 成功時                                    |
| ------ | ------------- | ----------------------------------------- |
| lint   | `pnpm lint`   | exit 0（prettier が README の整形も見る） |
| 型     | `pnpm check`  | `0 ERRORS`                                |
| まとめ | `pnpm verify` | exit 0                                    |

## Scope

**In scope**

- `README.md`
- `CLAUDE.md`
- `src/lib/board-input.ts`（コメント 1 行だけ）
- `src/lib/games/hockey/Hockey.svelte`（コメント 1 行だけ）
- `plans/README.md`（Status の行だけ）

**Out of scope**

- `src/lib/games.ts` の型 — `Thumb` を任意にする変更はしない（一覧の絵は全ゲーム必須）
- border-rush のコード — 012 でやる
- README の各ゲームの説明（数字は監査で照合済みで、pin-rescue の 6 割以外は正しい）

## Git workflow

- ブランチ: `advisor/003-docs-corrections`
- コミット 1 つ。英語の命令形 1 文（例: `Fix the game-adding recipe and stale notes in the docs`）、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: README の `meta.ts` の例と手順に `Thumb` を足す

`README.md` の手順を次のようにする。

- 手順 2 のあとに新しい手順を挿す — 「一覧のカードに出す小さな絵を `Thumb.svelte` に書く。一覧に
  全ゲームぶん載るので、軽い CSS だけで描く（画像・canvas・three は使わない）」。番号は 1〜5 に振り直す
- `meta.ts` の例に `import Thumb from './Thumb.svelte';` を足し、`minutes: '1分',` の次の行に `Thumb,` を足す

期待する例の形

```ts
import type { GameMeta } from '$lib/games';
import Thumb from './Thumb.svelte';

export default {
  id: 'my-game', // URL (/games/my-game) になるので kebab-case
  name: '表示名',
  description: '一覧のカードに出す 1 文',
  players: 2, // 1 人用は 1
  minutes: '1分',
  Thumb,
  load: async () => ({
    Game: (await import('./MyGame.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
```

確認 — `grep -n "Thumb" README.md` が 3 件以上（手順、import、プロパティ）

### Step 2: README のピンぬきの数字と公開の注意を直す

- `README.md:26` を「男の子のいる床に、決まった割合の金貨が届けばクリア。マグマに触れるとしっぱい」にする
  （割合の数字は 2 行下の「5 割 → 7 割半」に任せる）
- `README.md:204` の後半を「`static/manifest.webmanifest` の `start_url` と `scope` は相対パス（`./`）なので
  `BASE_PATH` に自動で追従する。絶対パスにはしない」という趣旨に書き換える

確認 — `grep -n "6 割" README.md` が 0 件、`grep -n "start_url" README.md` が 1 件で「相対」を含む

### Step 3: CLAUDE.md を直す

- 「構成」節の「対戦本体・`Howto.svelte`（タイトル画面の遊び方）・`meta.ts`（一覧用の情報と `load()`）を持つ」を
  「対戦本体・`Howto.svelte`（タイトル画面の遊び方）・`Thumb.svelte`（一覧のカードの絵）・`meta.ts`（一覧用の情報と `load()`）を持つ」にする
- 同じ節の「（border-rush なら `engine.ts`）」を「（hockey なら `engine.ts` の `step()`）」にする

確認 — `grep -n "border-rush なら" CLAUDE.md` が 0 件、`grep -n "Thumb.svelte" CLAUDE.md` が 2 件

### Step 4: コード内の古いコメントを直す

- `src/lib/board-input.ts:19` の `（app.css の .board.shell）` を `（app.css の .stage を landscape で回す）` にする
- `src/lib/games/hockey/Hockey.svelte:17` を
  `/** マレットの要素は 1 人ぶん MALLETS_PER_PLAYER 個を先に置いておき、毎フレーム位置と表示だけ書き換える */` にする

確認 — `grep -rn "board.shell" src/` が 0 件、`grep -n "2 個ずつ" src/lib/games/hockey/Hockey.svelte` が 0 件

### Step 5: 検証

確認 — `pnpm verify` → exit 0（prettier が Markdown を通し、svelte-check がコメント変更で壊れていないことを見る）

## Test plan

自動テストは足さない（文章の変更）。`pnpm lint` の prettier チェックが Markdown の整形を保証する。

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] Step 1〜4 の `grep` がすべて期待どおり
- [ ] README の手順が 5 つで、`Thumb.svelte` のステップがある
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 003 の Status を更新した

## STOP conditions

- 「現状」の文言が `grep` で見つからない（既に誰かが直している）
- prettier が README の表を整形し直して差分が大きくなる（その場合は整形後の差分をそのまま受け入れてよいが、
  内容が変わっていないことを目で確かめる。内容が変わって見えるなら STOP）

## Maintenance notes

- 012 で border-rush が `step()` を持ったら、CLAUDE.md の例は hockey のままでよい（どちらも手本になる）
- README の「収録ゲーム」の数字は各 `engine.ts` の定数と対応する。定数を変えたら README も見る
