# Table Duel

iPad をテーブルに置き、画面の上下から 2 人が同時に操作して遊ぶ対戦ゲーム集 (PWA)。

https://oekazuma.github.io/table-duel/

## 遊び方

iPad を 2 人の間に置き、両方のプレイヤーが自分側の画面を長押しするとゲームが始まる。手前が**プレイヤー 1**、向かいが**プレイヤー 2**。画面の上半分は 180 度回転しているので、どちらからでも読める。

Safari の共有メニューから「ホーム画面に追加」するとフルスクリーンで起動し、オフラインでも動く。

## 収録ゲーム

### せめぎあい (border-rush)

画面中央の境界線が 2 人の陣地を分ける。自分の陣地に出る玉を消すと境界線が相手側へ押し込まれ、相手の端まで押し切ったら勝ち。

| 玉 | 操作 | 押し込む量 |
| --- | --- | --- |
| 塗りつぶした丸 | タップ | 小 |
| 二重の輪 | ゲージが溜まるまで長押し | 中 |
| 境界線上の金の丸 | どちらのプレイヤーでも取れる。先に触った方が取る | 大 |

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
	{ id: 'my-game', name: '表示名', component: MyGame },
];
```

タイトル画面・スタート導線・結果表示・再戦はルート (`src/routes/+page.svelte`) が持つ。ゲーム側は自分の描画と入力だけを見ればよい。

ゲームロジックは DOM に依存しない純粋なモジュールに分け (`engine.ts`)、コンポーネントは描画と Pointer Events の処理だけを担当する。

## 開発

```bash
npm install
npm run dev
```

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 静的ビルド (`build/`)。`BASE_PATH` でサブパスを指定する |
| `npm run preview` | ビルド結果の確認 |
| `npm run check` | svelte-check による型チェック |
| `npm test` | ゲームルールの単体テスト |

サブパス配下で配信するため、アセットは `$app/paths` 経由か `%sveltekit.assets%` で参照する。絶対パスを直書きすると 404 になる。

## 公開

`main` への push で GitHub Actions がビルドし、GitHub Pages へデプロイする。Pages のソースは GitHub Actions に設定してある。
