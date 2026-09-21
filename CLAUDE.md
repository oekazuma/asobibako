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

`/` はゲーム一覧、`/games/[id]` は動的ルート 1 つで全ゲームを受ける（`+page.ts` の `entries` が `src/lib/games.ts` の `games` から全ゲームをプリレンダーする）。ゲーム 1 本は `src/lib/games/<id>/` に閉じ、対戦本体・`Howto.svelte`（タイトル画面の遊び方）・`meta.ts`（一覧用の情報と `load()`）を持つ。本体は `load()` の動的 import で遊ぶときに読み込み、一覧画面には載せない。追加は `games` 配列に 1 行足すだけで、既存のゲームには触らない。

タイトル（両者の長押しでスタート）・結果・再戦・一覧へ戻る・ミュートは `src/lib/components/GameShell.svelte` が全ゲーム共通で持ち、ゲームは `onfinish(1 | 2)` を呼ぶだけでよい。プレイヤー番号の型は `src/lib/player.ts`（1 が手前、2 が向かい）で、特定のゲームには依存しない。ルールは DOM に依存しない純粋なモジュール（border-rush なら `engine.ts`）に閉じて vitest で検証し、`.svelte` は描画と Pointer Events の配線だけを持つ。

コンポーネントは 200 行未満に保つ（`architecture/component-size`、抑制コメントは使っていない）。上下 2 分割のレイアウト（`.board` / `.half` と向かい側の 180 度回転）は画面をまたぐので `src/app.css` の共通クラスに置く。全体に `touch-action: none` をかけているので、スクロールが要る一覧画面は自分をスクロール領域にして `touch-action: pan-y` を許す。

border-rush の盤面は、境界線の移動を `transform` だけで表現し、レイアウトを毎フレーム起こさない。玉の寿命はタイマーを持たず、スポーンの周期で `expire()` が落とす。

盤面の上を指で操作するゲームは、共通の `src/lib/board-input.ts`（指の追跡・盤面座標への変換・リサイズ監視。中で `src/lib/fingers.ts` を使う）と `src/lib/loop.ts`（dt を抑えた `requestAnimationFrame` ループ）に載せる。得点の丸表示は `src/lib/components/Pips.svelte`。

bomb-relay と hockey は物理があるのでループで動かす。ルールと物理はそれぞれの `engine.ts` に閉じ、はじく速さは `fingers.ts` の `velocity()` で出す。hockey は速いパックと速く振ったマレットがすり抜けないよう、動く量に応じて 1 フレームを細かく分けて当たり判定し、そのあいだのマレット位置は前のフレームから補間する。爆弾の位置・脈・熱はループが DOM に直接書き、Svelte の状態にはメーター・持ち主・爆発のように変化が少ないものだけを載せる。座標は盤面の幅・高さに対する 0..1 で、距離と速さは高さを 1 とした単位に揃えている（縦向き・横向きで手触りを変えないため）。

## 更新

新版の検知は SvelteKit の `version.pollInterval`（5 分）と、画面が前面に戻ったときの `updated.check()`（`+layout.svelte`、1 分に 1 回まで）で行う。ホーム画面のアプリはページ遷移が少なくポーリングも止まりがちなため。一覧の `AppUpdate.svelte` は、新版があるときだけ「最新版に更新」を出し、`src/lib/pwa.ts` の `updateApp()` が新しい Service Worker の取り込みを待ってから読み直す（30 秒で見切る）。

## 入力

2 人が同時に触るので、入力は必ず `pointerdown` と `pointerId` で扱う。長押しは `setPointerCapture`（合成イベントでは失敗しうるので try/catch）。`touch-action: none` と `user-select: none` を全体にかけ、iOS の長押しメニュー・選択・ダブルタップズームを封じる。

決着した指を離した位置に結果画面のボタンが現れると、iOS Safari はそこへ合成 `click` を飛ばす。`preventDefault()` では止まらず、リンクは SvelteKit のルーターが先に拾う。そこで決着後は、画面上の指がすべて離れてから 350ms（取りこぼしに備えて最長 3 秒）経つまで、結果画面と端のボタンを `pointer-events: none` にして当たり判定ごと消す（`GameShell.svelte` の `settling`）。爆弾を握ったまま勝つゲームもあるので、決着の時刻からではなく指が離れた時刻から数える。

机に置いて遊ぶため Wake Lock で画面を保つ。`AudioContext` は iOS では操作イベント内で `resume()` しないと無音のままなので、最初のタッチで `wake()` を呼ぶ。

## 規約

svelte-vitals は `svelte-vitals.config.ts` の方針（個人用・noindex なので共有向け SEO 規則はオフ、`src/lib/*` は kebab-case、全ページに `<main>`、`failOn: 'warning'`）で動く。markuplint は `pnpm lint` の中で `src/**/*.svelte` と `src/app.html` を検査する（警告も失敗扱い）。外している規則とその理由は `.markuplintrc.jsonc` のコメントにある。

依存は `pnpm-workspace.yaml` の catalog で一元管理し（`minimumReleaseAge` あり）、Renovate が minor/patch を自動マージする。CI（`.github/workflows/ci.yml`）は PR では lint（+ svelte-vitals 全体スキャン）/ check / test / build を並列に、`main` への push では build を除く 3 つを回す（ビルドと配信は `deploy.yml`）。

GitHub Pages のサブパス配下で動かすため、アセットは `$app/paths` 経由か `%sveltekit.assets%` で参照する。CSP はヘッダを出せないぶん `vite.config.ts` の `csp`（`mode: 'hash'`）が `<meta http-equiv>` で配る。Service Worker は `build` / `files` / `prerendered` をまとめてキャッシュする（GitHub Pages が配信しないファイルを `files` に入れると `addAll` ごと失敗してインストールされない）。
