# Implementation Plans

improve skill（deep）が 2026-09-22 に commit `b4b0196` を、2026-09-26 に commit `4c06cf0` を監査して書いた実装計画。
001〜022 は 1 回目、023〜032 は 2 回目の監査のもの。下の順に実行する（依存関係の節に従う）。実行者は計画を最後まで読んでから始め、
STOP 条件を守り、終わったら自分の行の Status を更新する。

各計画に共通する前提を、索引にもまとめておく。

- リポジトリのルートは `/Users/oekazuma/localRepo/asobibako`（001〜022 の本文にある `table-duel` は改名前のパス）。コマンドはすべてそこで実行する
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
| 008  | `main` に required status checks を付ける（リポジトリ設定。利用者が実行）                       | P2       | S      | —          | DONE（ruleset `23843675` を 2026-09-23 に作成）                                  |
| 009  | テスト基盤を node + dom の 2 project にし、Settle / pwa / シェルのテストを足す                  | P2       | M      | 001        | DONE（`1686386`、main に merge 済み）                                            |
| 010  | 更新確認の失敗を正しく出し、iPad 上の実行時エラーを見えるようにする                             | P2       | S      | —          | DONE（`d83af18`、main に merge 済み）                                            |
| 011  | Service Worker の runtime cache を同一オリジンに絞り、書き込み失敗を握る                        | P2       | S      | —          | DONE（`5a9c9b4`、main に merge 済み）                                            |
| 012  | border-rush のルールを engine の `step()` に移す                                                | P2       | M      | 002        | DONE（`cf1a2b9`、main に merge 済み）                                            |
| 013  | 盤面の配線を attachment 1 つに寄せ、feint-master を `BoardInput` に乗せる                       | P2       | M      | 012        | DONE（`2726082`、main に merge 済み。attachment ではなく use: アクションで実装） |
| 014  | 小さな毎フレームコスト（bomb-relay の glow / bug-rush のスプライト / snow-camp の measureText） | P3       | S      | —          | DONE（`cba2403`、main に merge 済み）                                            |
| 015  | gate-run の描画リストと pin-rescue のサブステップ・hiss を落ち着かせる                          | P3       | S      | 002        | DONE（`7271712`、main に merge 済み）                                            |
| 016  | ESLint の `projectService` を外して lint を速くする                                             | P3       | S      | —          | DONE（`076d0a2`、main に merge 済み）                                            |
| 017  | 丸ボタン・`bob`・コンフェッティ配色の重複をまとめる                                             | P3       | S      | 001        | DONE（`37502e5`、main に merge 済み）                                            |
| 018  | レベル選択の ◀ ▶ を長押しでリピートさせる                                                       | P2       | S      | —          | DONE（`worktree-agent-ade2d1681f3753017` `b1dd28b`、レビュー済み）               |
| 019  | 一覧のカードに到達レベルを出し、100 面クリアを保存できるようにする                              | P2       | S      | —          | DONE（`worktree-agent-ab671249f8e0c955f` `41b72dc`、レビュー済み）               |
| 020  | 再戦の勝敗タリーを結果画面に出す                                                                | P2       | S      | —          | DONE（`worktree-agent-ac5e52f4f4be1820d` `5729694`、レビュー済み）               |
| 021  | ↻ と「いまやること」の吹き出しを SoloShell に移す                                               | P2       | M      | 019        | DONE（`worktree-agent-a28e41283be911963` `496a165`、レビュー済み）               |
| 022  | 対戦の結果画面に紙吹雪と光線を出し、紙吹雪を 1 人用と共有する                                   | P3       | S      | 020        | DONE（`worktree-agent-a81a6c98aa8588412` `1c2ebc5`、レビュー済み）               |
| 023  | 記録の控え（IndexedDB）を、読み切れていない起動で上書きしない                                   | P1       | M      | —          | DONE（`worktree-agent-af6a7d726d3ba7dad` `fc6e9ab`、レビュー済み）               |
| 024  | ノミのテストを乱数で落ちないようにする                                                          | P1       | S      | —          | DONE（`worktree-agent-a93c2bdcca2abbef1` `03aa0e6`、レビュー済み）               |
| 025  | 本番へのデプロイの前にテストを通す                                                              | P1       | S      | 024        | DONE（`worktree-agent-a932ed89e792d729c` `88e7612`、レビュー済み）               |
| 026  | ペットの形の控えを、止まらず・デプロイのたびに捨てないようにする                                | P1       | S      | —          | DONE（`worktree-agent-a8bb40e8a11f65725` `f1fb493`、レビュー済み）               |
| 027  | ずかんと写真を容量不足で消さず、保存できないときは知らせる                                      | P1       | S      | —          | DONE（`worktree-agent-a6dcda3cf73e60c8b` `be5678d`、レビュー済み）               |
| 028  | Service Worker が消すキャッシュを自分のものだけにする                                           | P2       | S      | —          | DONE（`worktree-agent-a0c8726840b1d2c7d` `b5a5f60`、レビュー済み）               |
| 029  | 描画ループが 1 度の例外で止まらないようにする                                                   | P2       | S      | —          | DONE（`worktree-agent-a2ecc26a3b8549d8a` `7de394b`、レビュー済み）               |
| 030  | Renovate が asobibako で動いているか確かめる（利用者が画面で行う）                              | P2       | S      | 025        | TODO                                                                             |
| 031  | 声の機能の残りを消し、CLAUDE.md のずれを直す                                                    | P3       | S      | 027        | DONE（`worktree-agent-a99dbdd069481a5bd` `cbefef5`、027 を含む、レビュー済み）   |
| 032  | 小さな直し 3 つ（影の種類・紙吹雪の距離・Backup.svelte の行数）                                 | P3       | S      | —          | DONE（`worktree-agent-a46a79e47f1b910ce` `c77f875`、レビュー済み）               |
| 033  | 写真とずかんの絵を iPad の「写真」に保存できるようにする                                        | P1       | S      | —          | DONE（`a4368ab`、main に merge 済み）                                            |
| 034  | アプリについて（/about）から、端末の控えで記録を戻せるようにする                                | P1       | S      | —          | DONE（`5df6f74`、main に merge 済み）                                            |
| 035  | ペットの外接を先に渡し、ひろばや部屋に入るたびの止まりをなくす                                  | P1       | S      | —          | TODO                                                                             |
| 036  | 飼っていない種類の形は、使う場面に入る前に読む                                                  | P2       | S      | 035        | TODO                                                                             |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (理由 1 行) | REJECTED (理由 1 行)

## Dependency notes

- 009 は 001 のあと。001 で直したシェルの `finish` を、009 で作るコンポーネントテストが回帰テストとして固定する
- 012 は 002 のあと。002 が border-rush の既存 engine（`pop` / `zone` / `expire`）に 2P 勝利のテストを足し、012 はその上に `step()` を足す
- 013 は 012 のあと。012 で border-rush が `animate` に乗り、013 はそのあと 10 ゲームの配線を 1 か所に寄せる
- 015 は 002 のあと。pin-rescue のサブステップを触るので、002 で固めた 100 面テストが安全網になる
- 017 は 001 のあと。001 が pin-rescue の `restart()` を触るので、同じファイルの CSS を先に動かさない
- 021 は 019 のあと。両方が `SoloShell.svelte` を触るので、019 の保存の形の上に ↻ と吹き出しを載せる
- 022 は 020 のあと。両方が `ResultScreen.svelte` を触る
- 023〜032 はそれぞれ `4c06cf0` から別の worktree で実行し、番号順に `main` へ merge する。CLAUDE.md は 023・025・031 が
  別々の行を触る
- 025 は 024 のあと。揺らぐテストが残ったままデプロイをテストで止めると、本番へのデプロイがときどき止まる
- 030 は 025 のあと。Renovate の自動マージが動き出す前に、デプロイの門を入れておく
- 031 は 027 のあと。`session.svelte.ts` の `flush()`（031 が消す）と `#write`（027 が変える）が隣り合うので、031 の
  実行担当は 027 のブランチを取り込んでから始める

## 実行中に見つかった追加の課題

計画の実行中に実行エージェントが見つけたもの。どれも小さいので新しい計画は作らず、ここに残す。

- `src/lib/games/snow-camp/world3d.ts` の `THREE.PCFSoftShadowMap` は three 0.186 で削除済みで、`CampWorld` を作るたびに
  「PCFSoftShadowMap has been removed. Using PCFShadowMap instead.」の警告が出る。`PCFShadowMap` に書き換えれば警告は消え、
  見た目は今と同じ（既にフォールバックされている）
- 統合確認（008 を除く 16 本を `b4b0196` に番号順に merge → `pnpm verify`）は衝突なしで緑（24 ファイル / 441 tests、
  svelte-check の warning 0）。`main` に取り込むときも索引の番号順に `git merge` すればよい
- 023〜032 の統合確認（030 を除く 9 本のブランチを `4c06cf0` に番号順に merge → `pnpm verify`）は衝突なしで緑
  （61 ファイル / 968 tests、svelte-check の warning 0）。031 のブランチは 027 を含むので、027 を先に merge しておけば
  031 はそのまま入る
- 計画 029 の Step 2 の「予約を frame のあとへ戻すとテスト 1 が落ちる」は不正確だった。try/catch があると 1 回目の例外は
  通り抜けるので、順番が効くのは例外が続くとき。実行担当はテスト 2 に呼び出し回数の確認を足して、そちらで確かめた
- markuplint 5.0.0 の svelte-parser は Svelte 5 の `{@attach}` を属性として拒む（013 で判明）。attachment を使いたくなったら
  `@markuplint/svelte-parser` の更新を待つか、`.markuplintrc.jsonc` に例外を足す

## Findings considered and rejected

監査で挙がったが計画にしなかったものを、次回の監査で蒸し返さないために記録しておく。

2026-09-26（`4c06cf0`）の監査で見送ったもの

- 控えを 30 秒ごとに約 1MB 書く負担 — 計測で JSON 化 0.4ms・比較 0.06ms。差分で書くと復元の形式を変えることになり、壊しやすい
- 控えを何世代も持つ — 戻すときに「どの世代が正しいか」を決める問題がまた出る。023 の「読み終えるまで書かない」で足りる
- Settle の指の数え方のずれ — シェルを mount し直すたびに数え直すので、残るのはそのゲームを出るまで
- 環境音が AudioContext の停止中に溜まって一度に鳴る — iOS で起きる頻度が不明。実機で聞こえたら直す
- わんにゃんハウスの小さな片付け漏れ（おふろのしずくの Points、Skeleton）と、ひろばでむかえたときの 8 匹の組み直し — 1 回数 KB で溜まらない
- タイトルで全 15 種類の形（約 45MB）を読む — ひろばの組み立ても控えを読む作りへ変える必要があり、落ちやすくなる根拠がない
- canvas の resize・枠合わせの重複（7 か所）と、ペットの向きを変える計算の重複 — 直す価値に対して触る範囲が広い
- 書き出しで保存できたか分からないまま「書き出した日」を付ける — ホーム画面アプリでの `a.download` の挙動を実機で確かめてから
- 写真の文字列を `<img src>` に入れる前の形の確認 — CSP の `img-src 'self' data:` が外部 URL を止めている
- ひらめきナゾの進み具合を ORDER の番号で持つ — ナゾを足すときに解いた集合で持つ作りへ変える（方向性の C）
- 方向性のうち、写真・ずかんを iPad へ保存（033）と、アプリについてから控えを戻す（034）は計画した。ひらめきナゾの解いた記録・
  読み込みのまぜる・ペットのうちに来た日は選択肢のまま。要望があれば `plan <description>` で計画する
- タイトルで全 15 種類の形を読む件は、headless Chrome での計測（使わない約 37MB）を受けて 036 で計画した

2026-09-22（`b4b0196`）の監査で見送ったもの

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

2026-09-26 の実行時の計測（headless Chrome、Apple M4 の GPU、iPad Air 相当の画面）で見送ったもの

- ひろばに初めて入るときの数秒の止まり（形の組み立て） — 端末と版ごとに 1 回だけで、組み立てを分けても合計は変わらない
- 組み立てた形（`bodies`）を場面を出るときに捨てる — GPU の側の後始末が要り、全種類でも約 74MB で頭打ちになる
- 部屋を開くときの canvas のテクスチャ生成（約 110ms、推定） — 何を描いているかの切り分けが済んでいない
- ハイドレート前にタイトルのボタンを押すと無視される（×4 で約 0.2 秒） — iPad Air では気づけない長さ
