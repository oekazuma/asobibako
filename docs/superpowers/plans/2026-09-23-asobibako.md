# あそびばこ（名前の変更とデザインの見直し）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロダクト名を「あそびばこ」（リポジトリ名 `asobibako`）に変え、ロゴ・アプリのアイコン・共通の画面をゆるかわのデザインにそろえる。

**Architecture:** ロゴは SVG の Svelte 部品にし、アプリのアイコンは同じ絵を `playwright-core` で PNG にして書き出す。共通の画面（一覧・タイトル・結果・隅のボタン・吹き出し・更新の案内・エラー）は、ゆるかわ用のトークンを `app.css` に足して使う。各ゲームの中の絵は変えない。

**Tech Stack:** SvelteKit（Svelte 5）、SVG、`playwright-core`（`channel: 'chrome'`、既に devDependencies にある）。

## 決まっていること（利用者の決定）

| 項目                 | 決定                                                                                                                                                                                                                                                                                         |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 名前                 | あそびばこ（英字は `asobibako`）                                                                                                                                                                                                                                                             |
| ロゴ                 | 案 1「おもちゃばこからのぞく」。ふたの開いたピンクの箱から、くま・うさぎ・バイキンがのぞき、星が 1 つ。下に 5 色（ピンク・きいろ・みどり・みずいろ・むらさき）の「あそびばこ」をこげ茶のふちで。見本は `.superpowers/sdd/logos.html` と、それを作った `.superpowers/sdd/logos.py` の `logo1` |
| デザインの範囲       | ロゴ・アプリのアイコン・一覧・ゲームのタイトル画面・結果画面・共通のボタンや文字をゆるかわにそろえる。各ゲームの中の絵はいまのまま                                                                                                                                                           |
| ゆるかわの決まり     | 線はやわらかいこげ茶 `#5b4a42` の細い 1 本、パステル、影は薄く、角は丸い（はいしゃさんの見た目と同じ）                                                                                                                                                                                       |
| リポジトリ名         | コードを変え終えてから、コントローラーが `gh repo rename asobibako` で変える                                                                                                                                                                                                                 |
| 古い URL             | 転送ページは置かない                                                                                                                                                                                                                                                                         |
| 遊んだ記録の保存名   | `table-duel:` のまま（同じ `github.io` の中なので、名前を変えなければ新しい URL でも進み具合が引き継がれる）                                                                                                                                                                                 |
| 手元のディレクトリ名 | 最後にコントローラーが `asobibako` に変える                                                                                                                                                                                                                                                  |

## Global Constraints

- リポジトリのルートは `/Users/oekazuma/localRepo/table-duel`。作業ブランチは `asobibako`。**push しない**（コントローラーが行う）
- 各ゲームの中の見た目を変えない。共通のクラスやトークン（`--p1` / `--p2` / `--zone-1` / `--zone-2` / `--dots` / `.pill` / `.sticker` など）をゲームが使っている場合は、そのクラスの見た目を変えずに、共通の画面用のクラスやトークンを新しく足して使う。触る前に `src/lib/games/` で使われているかを grep で確かめる
- 絵文字は使わない。`.svelte` は 200 行未満。markuplint・svelte-vitals の警告も失敗扱い。コメントは日本語で WHY だけ。README / CLAUDE.md は今の仕様だけを書く（textlint の hook あり）
- 検証は `pnpm verify`。画面の確認は内蔵ブラウザ（`mcp__Claude_Browser__*`）だけで、http://localhost:5173 の dev サーバーを使う（base の変更後は `/asobibako/`）
- コミットは英語で、末尾に空行と `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

---

### Task 1: ロゴとアプリのアイコン

**Files:**

- Create: `src/lib/components/Logo.svelte`（ロゴの SVG。`size` か `width` を受けて大きさを変えられる）
- Modify: `scripts/make-icon.ts`（`playwright-core` で SVG を描いて `static/icon-180.png` / `icon-192.png` / `icon-512.png` を書き出す）
- Modify: `static/icon-*.png`

- [ ] Step 1. 見本の `logo1` を土台に、ロゴを作り込む。箱のふたが自然に開いている、キャラクターの顔がはっきりしている、文字の太さとふちの太さがそろっている、小さく出しても（高さ 80px 程度）つぶれない、を満たすまで内蔵ブラウザで見て直す。文字は SVG の `<text>` で `'Hiragino Maru Gothic ProN'` を使ってよい（iPad にある）。`aria-label="あそびばこ"` と `role="img"` をつける
- [ ] Step 2. アプリのアイコンを作る。正方形で、クリーム色の地にロゴの箱とキャラクターを大きく（文字は入れない）。iOS の角丸で切られても欠けない余白をとる。`pnpm icon` で 3 つの PNG を書き出す（`playwright-core` で SVG を開いて撮る。依存は増やさない）
- [ ] Step 3. `pnpm check`・`pnpm lint` を通してコミットする

### Task 2: 共通の画面をゆるかわにする

**Files:**

- Modify: `src/app.css`（ゆるかわ用のトークンと、共通の画面用のクラスを足す）
- Modify: `src/routes/+page.svelte`（ロゴ、タブ、「さいきん あそんだ」、タイル、背景）、`src/lib/components/GameCard.svelte`、`AppUpdate.svelte`
- Modify: `src/lib/components/TitleScreen.svelte`、`SoloTitle.svelte`、`ResultScreen.svelte`、`SoloResult.svelte`、`GameShell.svelte` / `SoloShell.svelte` の隅のボタンと吹き出し、`src/routes/+error.svelte`

- [ ] Step 1. 触る前に、共通のクラスとトークンがゲームの中で使われていないかを確かめ、使われているものは変えずに新しいものを足す方針を決めてレポートに書く
- [ ] Step 2. 一覧を直す。ロゴ（Task 1 の `Logo`）を上に置き、背景・タブ・タイル・最近の段・更新の案内を、線 `#5b4a42`・パステル・薄い影・丸い角にそろえる
- [ ] Step 3. タイトル画面・結果画面・隅のボタン・吹き出し・エラー画面を同じ決まりにそろえる。結果画面の紙吹雪や勝敗の文字など、動きのある演出はそのまま残し、色と線だけ合わせる
- [ ] Step 4. 内蔵ブラウザで、iPad 縦（768 × 1024）とスマホ（375 × 812）の一覧、1 人用と 2 人用のタイトル画面と結果画面を見て、崩れがないことと、各ゲームの中の見た目が変わっていないことを確かめる（変更前後で 2 人用のゲーム画面を 1 つ見比べる）
- [ ] Step 5. `pnpm verify` を通してコミットする

### Task 3: 名前を変える

**Files:**

- Modify: `static/manifest.webmanifest`（`name` と `short_name` を「あそびばこ」）、`src/app.html`（`apple-mobile-web-app-title`）、`src/routes/+page.svelte` / `+error.svelte` / `games/[id]/+page.svelte` の `<title>`、`package.json` の `name`、`vite.config.ts` の base の既定値を `/asobibako`、`src/service-worker.ts` のキャッシュ名の頭を `asobibako-`、`src/lib/pwa.ts`（古い `table-duel-` と新しい `asobibako-` の両方のキャッシュを消す）とそのテスト、`scripts/thumbs.ts` のコメント
- Modify: `README.md`（題名、URL `https://oekazuma.github.io/asobibako/`、`pnpm dev` の URL）、`CLAUDE.md`（概要の名前、`pnpm dev` の URL）
- 変えない: `localStorage` の保存名 `table-duel:`（`levels.ts`・`recent.ts`・`audio.svelte.ts`・`last-error.ts`）。変えない理由を `levels.ts` の保存名の近くに 1 行だけコメントで書く

- [ ] Step 1. 上の各所を書き換える。一覧の説明文（lead）も新しい名前に合う言い回しにする（例「すきな あそびを えらんでね」）
- [ ] Step 2. `git grep -n -i "table duel\|tableduel"` と `git grep -n "table-duel"` で残りを確かめ、保存名と docs/superpowers・plans 以外に残っていないことを確かめる
- [ ] Step 3. `pnpm verify` を通し、内蔵ブラウザで http://localhost:5173/asobibako/ が開けることを確かめてコミットする

### Task 4: 公開と名前の変更（コントローラー）

- [ ] Step 1. 利用者に一覧・タイトル・結果画面のスクリーンショットを見せて了承をもらう
- [ ] Step 2. `main` にマージして push し、CI とデプロイが通ることを確かめる（この時点のデプロイ先は旧名の URL）
- [ ] Step 3. `gh repo rename asobibako` でリポジトリ名を変え、`git remote set-url origin` を新しい URL に直す。デプロイを 1 回走らせ（`gh workflow run deploy.yml` か空のコミット）、`https://oekazuma.github.io/asobibako/` が開けることを確かめる
- [ ] Step 4. 手元のディレクトリを `~/localRepo/asobibako` に変え、メモリのディレクトリ（`~/.claude/projects/-Users-oekazuma-localRepo-table-duel/`）を新しいパスに合う名前へ移す
