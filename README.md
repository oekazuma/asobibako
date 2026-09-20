# Table Duel

iPad をテーブルに置き、画面の上下から 2 人が同時に操作して遊ぶ対戦ゲーム集 (PWA)。

https://oekazuma.github.io/table-duel/

## 遊び方

iPad を 2 人の間に置き、両方のプレイヤーが自分側の画面を長押しするとゲームが始まる。手前が**プレイヤー 1**、向かいが**プレイヤー 2**。画面の上半分は 180 度回転しているので、どちらからでも読める。

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

## ゲームを追加する

`src/lib/games/<id>/` にコンポーネントを置き、`src/lib/games.ts` の配列に 1 行足す。

```svelte
<!-- src/lib/games/my-game/MyGame.svelte -->
<script lang="ts">
  import type { Player } from '$lib/games/border-rush/engine';

  // 勝者が決まったら onfinish(1 | 2) を呼ぶ。1 が手前、2 が向かい
  let { onfinish }: { onfinish: (winner: Player) => void } = $props();
</script>
```

```ts
// src/lib/games.ts
export const games: GameDef[] = [
  { id: 'border-rush', name: 'せめぎあい', component: BorderRush },
  { id: 'my-game', name: '表示名', component: MyGame }
];
```

画面の切り替えはルート (`src/routes/+page.svelte`) が持ち、タイトルと結果の見た目は `src/lib/components/` にある。上下 2 分割のレイアウト (`.board` / `.half`) は `src/app.css` の共通クラス。ゲーム側は自分の描画と入力だけを見ればよい。

ゲームロジックは DOM に依存しない純粋なモジュールに分け (`engine.ts`)、コンポーネントは描画と Pointer Events の処理だけを担当する。コンポーネントは 200 行未満に保つ (`architecture/component-size`)。

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
