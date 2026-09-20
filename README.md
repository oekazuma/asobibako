# Table Duel

iPad をテーブルに置き、画面の上下から 2 人が同時に操作して遊ぶ対戦ゲーム集 (PWA)。

## 遊び方

1. ブラウザで開く
2. iPad を 2 人の間に縦向きで置く
3. どちらかがゲームを選ぶ (メニューは上下どちらからも読める向きで出る)

手前が**プレイヤー 1**、向かいが**プレイヤー 2**。上半分は CSS で 180 度回転している。

Safari の共有メニューから「ホーム画面に追加」するとフルスクリーンで起動し、オフラインでも動く。

## 収録ゲーム

| ゲーム | 内容 |
| --- | --- |
| 反射タップ | 画面が緑に光ったら先にタップ。光る前に押すとお手つきで負け |

## ゲームを追加する

`games/` に 1 ファイル追加し、`games/index.js` の配列に足すだけ。

```js
// games/my-game.js
export default {
  id: 'my-game',
  name: '表示名',
  desc: 'メニューに出る1行説明',

  mount({ top, bottom, finish }) {
    // top / bottom は各プレイヤーの領域 (DOM 要素)。中身は自由に構築する。
    // finish(winner, note) で決着。winner は 1 (手前) / 2 (向かい) / 0 (引き分け)、
    // note は結果画面に出る補足文字列 (省略可)。
    // クリーンアップ関数を返すと、画面遷移時に呼ばれる。
    return () => {};
  },
};
```

```js
// games/index.js
import tapDuel from './tap-duel.js';
import myGame from './my-game.js';

export const games = [tapDuel, myGame];
```

`top` / `bottom` の CSS クラスは画面遷移のたびに `half top` / `half bottom` にリセットされるので、ゲーム側で付けたクラスを自分で消す必要はない。

2 人同時タッチは `pointerdown` を各領域に登録すれば動く (`touch-action: none` を全体にかけてある)。

## 開発

ビルド不要。静的ファイルだけ。

```bash
npx serve .
```

Service Worker はネットワーク優先・キャッシュフォールバック。ファイルを追加したら `sw.js` の `ASSETS` と `CACHE` のバージョンを更新する。

## 公開

`main` ブランチのルートを GitHub Pages が配信する。
