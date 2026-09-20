# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

iPad 1 台をテーブルに置き、画面の上下から 2 人が同時に操作して遊ぶ対戦ゲーム集 PWA。SvelteKit（Svelte 5 runes、TypeScript）+ adapter-static で、`main` への push で GitHub Pages（`/table-duel/`）へ自動デプロイされる。ランタイム依存はゼロで、効果音は Web Audio のオシレータ合成、アイコンは `scripts/make-icon.ts` の自前 PNG 生成。

## コマンド

```bash
pnpm dev                      # http://localhost:5173/table-duel/
pnpm test:run                 # vitest 一括実行（unit プロジェクト、happy-dom）。pnpm test で watch
pnpm lint                     # prettier --check と eslint と markuplint（CI と同じ）
pnpm check                    # svelte-check と tsconfig.scripts.json の型チェック
pnpm vitals                   # svelte-vitals の全体スキャン。編集後は `pnpm vitals --diff`
pnpm verify                   # lint / check / test:run / vitals / build をまとめて実行（CI と同じ判定）
pnpm format                   # prettier --write
pnpm build && pnpm preview    # 静的ビルドと確認（Service Worker は build でのみ有効）
pnpm icon                     # static/icon-180/192/512.png を再生成
```

## 構成

ゲーム 1 本は `src/lib/games/<id>/` にまとめ、`src/lib/games.ts` の配列に登録する。ルールは DOM に依存しない `engine.ts` に閉じて vitest で検証し、`.svelte` は描画と Pointer Events の配線だけを持つ。画面の切り替えは `src/routes/+page.svelte`、タイトルと結果の見た目は `src/lib/components/` にあり、ゲームは `onfinish(1 | 2)` を呼ぶだけでよい。プレイヤー番号の型は `src/lib/player.ts`（1 が手前、2 が向かい）で、特定のゲームの engine には依存しない。

コンポーネントは 200 行未満に保つ（`architecture/component-size`、抑制コメントは使っていない）。上下 2 分割のレイアウト（`.board` / `.half` と向かい側の 180 度回転）は画面をまたぐので `src/app.css` の共通クラスに置く。

盤面は上下 2 分割で、上半分を `rotate(180deg)` する。境界線の移動は `transform` だけで表現し、レイアウトを毎フレーム起こさない。玉の寿命はタイマーを持たず、スポーンの周期で `expire()` が落とす。

## 入力

2 人が同時に触るので、入力は必ず `pointerdown` と `pointerId` で扱う。長押しは `setPointerCapture`（合成イベントでは失敗しうるので try/catch）。`touch-action: none` と `user-select: none` を全体にかけ、iOS の長押しメニュー・選択・ダブルタップズームを封じる。

`pointerdown` で決着させた直後は、指を離した位置に現れたボタンへ iOS Safari が合成 `click` を飛ばす。`preventDefault()` では止まらないので、画面を描画してから 350ms はボタン入力を捨てる（`src/routes/+page.svelte` の `shownAt`）。

机に置いて遊ぶため Wake Lock で画面を保つ。`AudioContext` は iOS では操作イベント内で `resume()` しないと無音のままなので、最初のタッチで `wake()` を呼ぶ。

## 規約

svelte-vitals は `svelte-vitals.config.ts` の方針（個人用・noindex なので共有向け SEO 規則はオフ、`src/lib/*` は kebab-case、全ページに `<main>`、`failOn: 'warning'`）で動く。markuplint は `pnpm lint` の中で `src/**/*.svelte` と `src/app.html` を検査する（警告も失敗扱い）。外している規則とその理由は `.markuplintrc.jsonc` のコメントにある。

依存は `pnpm-workspace.yaml` の catalog で一元管理し（`minimumReleaseAge` あり）、Renovate が minor/patch を自動マージする。CI（`.github/workflows/ci.yml`）は PR では lint（+ svelte-vitals 全体スキャン）/ check / test / build を並列に、`main` への push では build を除く 3 つを回す（ビルドと配信は `deploy.yml`）。

GitHub Pages のサブパス配下で動かすため、アセットは `$app/paths` 経由か `%sveltekit.assets%` で参照する。CSP はヘッダを出せないぶん `vite.config.ts` の `csp`（`mode: 'hash'`）が `<meta http-equiv>` で配る。Service Worker は `build` / `files` / `prerendered` をまとめてキャッシュする（GitHub Pages が配信しないファイルを `files` に入れると `addAll` ごと失敗してインストールされない）。
