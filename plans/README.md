# Implementation Plans

improve skill（deep）が 2026-09-22 に commit `b4b0196` を監査して書いた実装計画。
下の順に実行する（依存関係の節に従う）。実行者は計画を最後まで読んでから始め、
STOP 条件を守り、終わったら自分の行の Status を更新する。

各計画に共通する前提を、索引にもまとめておく。

- リポジトリのルートは `/Users/oekazuma/localRepo/table-duel`。コマンドはすべてそこで実行する
- 検証ゲートは `pnpm lint` / `pnpm check` / `pnpm test:run` / `pnpm vitals --diff` / 最後に `pnpm verify`
- **push はしない**。`main` への push は `deploy.yml` で本番（GitHub Pages）へ自動デプロイされる
- 散文・コメントは日本語。コメントは「コードから復元できない WHY」だけ（WHAT・変更履歴・チケット番号は書かない）
- `.svelte` は 200 行未満（svelte-vitals `architecture/component-size`、`failOn: 'warning'`）
- `plans/` も `prettier --check .` の対象。下の表の Status を書き換えたら `pnpm exec prettier --write plans/README.md` を実行してから
  コミットする（表の列幅がずれると `pnpm lint` が赤くなる）

## Execution order & status

| Plan | Title                                                                                           | Priority | Effort | Depends on | Status                                                                           |
| ---- | ----------------------------------------------------------------------------------------------- | -------- | ------ | ---------- | -------------------------------------------------------------------------------- |
| 001  | 1 人用ゲームの `onfinish` タイマーを片付け、シェルの `finish` を冪等にする                      | P1       | S      | —          | DONE（`52f07b8`、main に merge 済み）                                            |
| 002  | 対戦エンジンの 2P 勝利・aspect・未検証分岐と、100 面テストの assertion を固める                 | P1       | M      | —          | DONE（`71fa53f`、main に merge 済み）                                            |
| 003  | README / CLAUDE.md / コメントの誤りを直す                                                       | P1       | S      | —          | DONE（`b9ce3e0`、main に merge 済み）                                            |
| 004  | dog-guard の毎フレーム `ctx.filter` と線分の再構築をなくす                                      | P1       | S      | —          | DONE（`9069b4f`、main に merge 済み）                                            |
| 005  | pin-rescue の液体描画を外接矩形だけに絞る                                                       | P1       | M      | —          | DONE（`c6e71cb`、main に merge 済み）                                            |
| 006  | snow-camp の geometry 共有・影の絞り込み・DPR・破棄                                             | P1       | M      | —          | DONE（`21aec9f`、main に merge 済み）                                            |
| 007  | Renovate 設定を整理する                                                                         | P2       | S      | —          | DONE（`1659ef5`、main に merge 済み）                                            |
| 008  | `main` に required status checks を付ける（リポジトリ設定。利用者が実行）                       | P2       | S      | —          | TODO                                                                             |
| 009  | テスト基盤を node + dom の 2 project にし、Settle / pwa / シェルのテストを足す                  | P2       | M      | 001        | DONE（`1686386`、main に merge 済み）                                            |
| 010  | 更新確認の失敗を正しく出し、iPad 上の実行時エラーを見えるようにする                             | P2       | S      | —          | DONE（`d83af18`、main に merge 済み）                                            |
| 011  | Service Worker の runtime cache を同一オリジンに絞り、書き込み失敗を握る                        | P2       | S      | —          | DONE（`5a9c9b4`、main に merge 済み）                                            |
| 012  | border-rush のルールを engine の `step()` に移す                                                | P2       | M      | 002        | DONE（`cf1a2b9`、main に merge 済み）                                            |
| 013  | 盤面の配線を attachment 1 つに寄せ、feint-master を `BoardInput` に乗せる                       | P2       | M      | 012        | DONE（`2726082`、main に merge 済み。attachment ではなく use: アクションで実装） |
| 014  | 小さな毎フレームコスト（bomb-relay の glow / bug-rush のスプライト / snow-camp の measureText） | P3       | S      | —          | DONE（`cba2403`、main に merge 済み）                                            |
| 015  | gate-run の描画リストと pin-rescue のサブステップ・hiss を落ち着かせる                          | P3       | S      | 002        | DONE（`7271712`、main に merge 済み）                                            |
| 016  | ESLint の `projectService` を外して lint を速くする                                             | P3       | S      | —          | DONE（`076d0a2`、main に merge 済み）                                            |
| 017  | 丸ボタン・`bob`・コンフェッティ配色の重複をまとめる                                             | P3       | S      | 001        | DONE（`37502e5`、main に merge 済み）                                            |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (理由 1 行) | REJECTED (理由 1 行)

## Dependency notes

- 009 は 001 のあと。001 で直したシェルの `finish` を、009 で作るコンポーネントテストが回帰テストとして固定する
- 012 は 002 のあと。002 が border-rush の既存 engine（`pop` / `zone` / `expire`）に 2P 勝利のテストを足し、012 はその上に `step()` を足す
- 013 は 012 のあと。012 で border-rush が `animate` に乗り、013 はそのあと 10 ゲームの配線を 1 か所に寄せる
- 015 は 002 のあと。pin-rescue のサブステップを触るので、002 で固めた 100 面テストが安全網になる
- 017 は 001 のあと。001 が pin-rescue の `restart()` を触るので、同じファイルの CSS を先に動かさない

## 実行中に見つかった追加の課題

計画の実行中に実行エージェントが見つけたもの。どれも小さいので新しい計画は作らず、ここに残す。

- `src/lib/games/snow-camp/world3d.ts` の `THREE.PCFSoftShadowMap` は three 0.186 で削除済みで、`CampWorld` を作るたびに
  「PCFSoftShadowMap has been removed. Using PCFShadowMap instead.」の警告が出る。`PCFShadowMap` に書き換えれば警告は消え、
  見た目は今と同じ（既にフォールバックされている）
- 統合確認（008 を除く 16 本を `b4b0196` に番号順に merge → `pnpm verify`）は衝突なしで緑（24 ファイル / 441 tests、
  svelte-check の warning 0）。`main` に取り込むときも索引の番号順に `git merge` すればよい
- markuplint 5.0.0 の svelte-parser は Svelte 5 の `{@attach}` を属性として拒む（013 で判明）。attachment を使いたくなったら
  `@markuplint/svelte-parser` の更新を待つか、`.markuplintrc.jsonc` に例外を足す

## Findings considered and rejected

監査で挙がったが計画にしなかったものを、次回の監査で蒸し返さないために記録しておく。

- `pwa.ts` の `updateApp()` が 30 秒ハングする — `installing ?? waiting` の読み取りと `statechange` の登録のあいだに `await` がなく、競合は起きない
- svelte-vitals の `minimumReleaseAge` 除外 — 自作ツールで意図的。`@svelte-vitals/vite` はビルド時に走るが、公開者本人が最速で気づける
- `svelte-vitals.yml` が `ci.yml` の全体スキャンと重複 — 自作 action の dogfooding として残す
- `svelte-vitals.yml` の `pull-requests: write` — fork PR には read-only トークンしか渡らない
- `cookie` の low advisory（GHSA-pxg6-pf52-xh8x） — adapter-static で到達不能
- `frame-ancestors` / clickjacking — 守るものがない
- vitest 4 → 5 — Renovate の major PR が来たときに `pnpm test:run` で判断する
- Service Worker から three のチャンクを precache 除外（gzip 145KB） — オフライン優先が方針で、`updateApp()` は precache 完了を待つ設計。更新のたびに snow-camp を一度オンラインで遊ぶ必要が出るので見送り
- `fx.ts` / `levels.ts` の god module 疑い — 凝集していて分割は churn
- `GameMeta = DuelMeta | SoloMeta` の判別 — クリーン
- `.editorconfig` / `.nvmrc` — prettier と `devEngines` が単一の真実
- `Rng.pick` が空配列で `undefined` — 到達不能
- `nextId` がモジュール変数で round をまたぐ — id は一意であればよい（012 で state に移す）
- 方向性（一覧カードに到達レベル / 再戦の勝敗タリー / レベル選択の長押しリピート / ↻ とヒントを SoloShell へ / 対戦側の結果画面の演出） — 改善ではなく選択肢。要望があれば `plan <description>` で個別に計画する
