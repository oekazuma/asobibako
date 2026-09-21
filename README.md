# Table Duel

iPad をテーブルに置き、画面の上下から 2 人が同時に操作して遊ぶ対戦ゲーム集 (PWA)。

https://oekazuma.github.io/table-duel/

## 遊び方

トップ (`/`) がゲームの一覧。遊びたいゲームを選ぶと、そのゲームのタイトル画面になる。

iPad を 2 人の間に置き、両方のプレイヤーが自分側の画面を長押しするとゲームが始まる。手前が**プレイヤー 1**、向かいが**プレイヤー 2**。画面の上半分は 180 度回転しているので、どちらからでも読める。タイトル画面と結果画面の左端の ✕ で一覧に戻る。

Safari の共有メニューから「ホーム画面に追加」するとフルスクリーンで起動し、オフラインでも動く。

## 収録ゲーム

### せめぎあい (border-rush)

画面中央の境界線が 2 人の陣地を分ける。自分の陣地に出る玉を消すと境界線が相手側へ押し込まれ、相手の端まで押し切ったら勝ち。

| 玉               | 操作                                             | 押し込む量 |
| ---------------- | ------------------------------------------------ | ---------- |
| 塗りつぶした丸   | タップ                                           | 小         |
| 二重の輪         | ゲージが溜まるまで長押し                         | 中         |
| 境界線上の金の丸 | どちらのプレイヤーでも取れる。先に触った方が取る | 大         |

境界線が動くと、相手側に取り残された玉は消える。負けている側は陣地が狭いぶん玉が密集するため、連打で押し返しやすい。

### ばくだんリレー (bomb-relay)

導火線の見えない爆弾を押しつけ合う。爆弾は必ずどちらかの陣地で爆発する。

- 自分の陣地にある爆弾は、指を置いてつかむ。飛んでくる途中でも、通り道に置いた指で受け止められる
- 持っているあいだだけ自分のメーターがたまり、満タンで勝ち
- 爆発した側はメーターが半分になり、次の爆弾はその側へ落ちる
- スワイプの勢いではじいて相手の陣地へ渡す。弱いと自分の陣地に残る
- 古い爆弾ほど赤く速く脈打ち、音も速くなる。そのぶんメーターも速くたまるので、危ない爆弾ほど持っていたくなる

### いろとり (color-grab)

中央の帯に色つきの玉が並ぶ。境界線の左右両端に出ている「お題」と同じ色の玉を、自分の陣地へドラッグする。

- お題と同じ色を自分の陣地に置くと +1、違う色だと −1。5 点で勝ち
- 誰がつかんだかは関係なく、置いた陣地のプレイヤーの点になる。違う色を相手の陣地に押し込んで、相手の点を減らしてもいい
- お題は数秒ごとに突然変わる。点線の縁の玉は、つかんでいるあいだも色が変わり続ける
- 色ごとに形が決まっている (あか ● / あお ■ / きいろ ▲ / みどり ★)

## ゲームを追加する

1 本のゲームは `src/lib/games/<id>/` に閉じる。既存のゲームのコードには触らない。

1. 対戦本体のコンポーネントを置く。勝者が決まったら `onfinish(1 | 2)` を 1 回呼ぶ (1 が手前、2 が向かい)

   ```svelte
   <script lang="ts">
     import type { GameProps } from '$lib/games';

     let { onfinish }: GameProps = $props();
   </script>
   ```

2. タイトル画面に上下それぞれ出す遊び方を `Howto.svelte` に書く。1 行のルールと凡例くらいに留める
3. `meta.ts` に一覧用の情報と読み込み方を書く

   ```ts
   import type { GameMeta } from '$lib/games';

   export default {
     id: 'my-game', // URL (/games/my-game) になるので kebab-case
     name: '表示名',
     description: '一覧のカードに出す 1 文',
     players: 2,
     minutes: '1分',
     load: async () => ({
       Game: (await import('./MyGame.svelte')).default,
       Howto: (await import('./Howto.svelte')).default
     })
   } satisfies GameMeta;
   ```

4. `src/lib/games.ts` の `games` 配列に 1 行足す

一覧のカードと `/games/<id>` のページはこれだけでできる (プリレンダーの対象も `games` 配列から作る)。ゲーム本体は遊ぶときに読み込むので、ゲームを増やしても一覧画面は重くならない。

タイトル画面 (両者の長押しでスタート)・結果画面・再戦・一覧へ戻る・ミュートは `src/lib/components/GameShell.svelte` が全ゲームぶん持つ。上下 2 分割のレイアウト (`.board` / `.half`) は `src/app.css` の共通クラス。

ゲームのルールは DOM に依存しない純粋なモジュールに分け (border-rush なら `engine.ts`)、コンポーネントは描画と Pointer Events の処理だけを担当する。コンポーネントは 200 行未満に保つ (`architecture/component-size`)。

## 開発

```bash
pnpm install
pnpm dev        # http://localhost:5173/table-duel/
```

| コマンド       | 内容                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| `pnpm dev`     | 開発サーバー                                                            |
| `pnpm build`   | 静的ビルド (`build/`)。`BASE_PATH` でサブパスを指定する                 |
| `pnpm preview` | ビルド結果の確認 (Service Worker はビルドでのみ有効)                    |
| `pnpm lint`    | prettier / eslint / markuplint                                          |
| `pnpm format`  | prettier --write                                                        |
| `pnpm check`   | svelte-check と scripts の型チェック                                    |
| `pnpm test`    | vitest の watch。`pnpm test:run` で一括実行                             |
| `pnpm vitals`  | svelte-vitals の全体スキャン                                            |
| `pnpm verify`  | lint / check / test:run / vitals / build をまとめて実行 (CI と同じ判定) |
| `pnpm icon`    | `static/icon-*.png` を再生成する                                        |

依存は `pnpm-workspace.yaml` の catalog で一元管理し、Renovate が minor/patch を自動マージする。

サブパス配下で配信するため、アセットは `$app/paths` 経由か `%sveltekit.assets%` で参照する。絶対パスを直書きすると 404 になる。GitHub Pages はヘッダを出せないので、CSP は `<meta http-equiv>` で配る (`vite.config.ts`)。

## 公開

`main` への push で GitHub Actions がビルドし、GitHub Pages へデプロイする (`BASE_PATH=/<リポジトリ名>`)。公開先を変えるときは `BASE_PATH=/other pnpm build` のように base を変え、`static/manifest.webmanifest` の `start_url` と `scope` を合わせる。
