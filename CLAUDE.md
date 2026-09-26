# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

iPad 1 台をテーブルに置き、画面の上下から 2 人が同時に操作して遊ぶ対戦ゲーム集 PWA。画面全体を 1 人で使い、レベルを順にクリアする 1 人用のゲームもある。SvelteKit（Svelte 5 runes、TypeScript）+ adapter-static で、`main` への push で GitHub Pages（`/asobibako/`）へ自動デプロイされる。ランタイム依存は three だけで（雪原サバイバルとわんにゃんハウスの 3D 表示が使い、そのゲームを遊ぶときに読み込む）、効果音は Web Audio のオシレータ合成、アプリのアイコンは `scripts/make-icon.ts` がロゴ（`Logo.svelte`）を端末の Chrome で撮って作る。

## コマンド

```bash
pnpm dev                      # http://localhost:5173/asobibako/
pnpm test:run                 # vitest 一括実行（node の unit と happy-dom の dom の 2 project）。pnpm test で watch
pnpm lint                     # prettier --check と eslint と markuplint（CI と同じ）
pnpm check                    # svelte-check と tsconfig.scripts.json の型チェック
pnpm vitals                   # svelte-vitals の全体スキャン。編集後は `pnpm vitals --diff`
pnpm verify                   # lint / check / test:run / vitals / build をまとめて実行（CI と同じ判定）
pnpm format                   # prettier --write
pnpm build && pnpm preview    # 静的ビルドと確認（Service Worker は build でのみ有効）
pnpm icon                     # static/icon-180/192/512.png と README のロゴ（.github/logo.png）を再生成
pnpm thumbs [id...]           # static/thumbs/<id>.webp を実際のゲーム画面から撮り直す（端末の Chrome）
```

## 構成

`/` はゲーム一覧、`/games/[id]` は動的ルート 1 つで全ゲームを受ける（`+page.ts` の `entries` が `src/lib/games.ts` の `games` から全ゲームをプリレンダーする）。ゲーム 1 本は `src/lib/games/<id>/` に閉じ、対戦本体・`Howto.svelte`（タイトル画面の遊び方）・`meta.ts`（一覧用の情報と `load()`）を持つ。本体は `load()` の動的 import で遊ぶときに読み込み、一覧画面には載せない。追加は `games` 配列に 1 行足すだけで、既存のゲームには触らない。一覧は「ひとりで」「ふたりで」のタブと画像のタイルで、最後に選んだタブと最近開いたゲーム（3 本まで、`/games/[id]` を開いたときに入れる）は `src/lib/recent.ts` が localStorage に覚える。localStorage の保存名はすべて `asobibako:` で始め、改名前の `table-duel:` の記録は `src/hooks.client.ts` の `init` で `src/lib/storage-migrate.ts` が起動のたびに残りを移す（新しい名前がすでにあれば上書きしない）。アプリについて（`/about`）のバックアップは、`src/lib/backup.ts` が `asobibako:` で始まるキーを 1 つの JSON に書き出し、読み込むときは保護者ゲート（`src/lib/gate.svelte.ts` の掛け算、間違いは 1 日 3 回まで）を通してから全部置き換える。端末ごとの控え（`asobibako:last-error` と `asobibako:gate` と `asobibako:graphics`）は書き出さず、読み込みではそのキーを読み飛ばす（他のキーは読み込む。除くキーを増やしても、前に書き出したファイルや控えは読める）。iOS のホーム画面アプリは固まって終わらされたあとに localStorage がまるごと空になることがある（固まったアプリを終わらせたら、全部のゲームの記録が消えたことがある）。そこで `src/lib/mirror.ts` がバックアップと同じ JSON を IndexedDB（`asobibako-mirror`、localStorage とは別のファイル）へ写し、`hooks.client.ts` の `init` が、記録が 1 つもなく控えがあれば全部戻す（控えが開けなくても 1.5 秒で見切って起動する。見切ったあと遅れて控えが読めたら、控えから戻してページを読み直す）。最近開いたゲーム・タブ・ミュートだけの状態は「記録あり」に数えない。控えを読み終える前と、読み切れなかった起動の直後（`asobibako:restore-pending`、次の起動でも記録の有無にかかわらず控えから戻す）は上書きせず、それ以外は画面が隠れるとき・ページを移るとき・見えているあいだ 30 秒ごとに取る。`init` は `navigator.storage.persist()` も頼む。iPad ごと記録を失ったときのために、最後の書き出しから 7 日を過ぎると一覧の「？」に印を付けて書き出しを勧める（`asobibako:backup-at`）。

タイトル（両者の長押しでスタート）・結果・再戦・一覧へ戻る・ミュートは `src/lib/components/GameShell.svelte` が全ゲーム共通で持ち、ゲームは `onfinish(1 | 2)` を呼ぶだけでよい。1 人用（`meta.players` が 1）は `SoloShell.svelte` が受け、ゲームは `level` を受け取って `onfinish(true | false)` を呼ぶ。レベルはゲームごとに localStorage へ保存し、タイトルの「レベル N」を押すと、たどり着いた面までを四角の一覧（`LevelSelect.svelte`）から選んで始められる。`meta.levels` が 1 ならタイトルにレベル選びを出さないので、`onfinish` を呼ばないクリアのない自由あそびにもできる（らくがきパレード）。難しさの順に並ばないゲームは `meta.levelName` で面を「レベル」以外の名前で呼ぶ（ひらめきナゾは「ナゾ」）。正解の説明などを自分で見せるゲームは `meta.ownResult` で共通の結果画面を飛ばし、クリアなら次の面、しっぱいなら同じ面をすぐ始める（最後の面をクリアしたときだけ結果画面を出す）。決着後の合成 click 対策（`settling`）は両方のシェルが `src/lib/settle.svelte.ts` を使う。プレイヤー番号の型は `src/lib/player.ts`（1 が手前、2 が向かい）で、特定のゲームには依存しない。ルールは DOM に依存しない純粋なモジュール（hockey なら `engine.ts` の `step()`）に閉じて vitest で検証し、`.svelte` は描画と Pointer Events の配線だけを持つ。

コンポーネントは 200 行未満に保つ（`architecture/component-size`、抑制コメントは使っていない）。上下 2 分割のレイアウト（`.stage` / `.half` と向かい側の 180 度回転）は画面をまたぐので `src/app.css` の共通クラスに置く。全体に `touch-action: none` をかけているので、スクロールが要る一覧画面は自分をスクロール領域にして `touch-action: pan-y` を許す。

border-rush の盤面は、境界線の移動を `transform` だけで表現し、レイアウトを毎フレーム起こさない。玉の寿命はタイマーを持たず、スポーンの周期で `expire()` が落とす。

盤面の上を指で操作するゲームは、共通の `src/lib/board-input.ts`（指の追跡・盤面座標への変換・リサイズ監視。中で `src/lib/fingers.ts` を使う）と `src/lib/loop.ts`（dt を抑えた `requestAnimationFrame` ループ）に載せる。得点の丸表示は `src/lib/components/Pips.svelte`。

粒・群れ・動物など多数の動くものは DOM ではなく canvas 1 枚に描く（影付きの DOM を大量に動かすと iPad で 10 倍以上遅くなった）。絵文字は使わない（端末で見た目が変わり、チープに見えるため）。アイコンは `src/lib/icons.ts` に SVG パスで定義し、DOM では `src/lib/components/Icon.svelte`、canvas では `src/lib/fx.ts` の `icon()` で描く（パーティクル・浮かぶ文字・画面の揺れ・絵のキャッシュも `fx.ts` にある）。雪原サバイバルは three で描き、人や動物は球・円柱などの組み合わせで作る（`snow-camp/models.ts`）。線分との当たり判定は `src/lib/segments.ts`。

bomb-relay と hockey は物理があるのでループで動かす。ルールと物理はそれぞれの `engine.ts` に閉じ、bomb-relay のはじく速さは `fingers.ts` の `velocity()`、hockey のマレットの速さは `engine.ts` の `updateMallets` が前のフレームの位置から出す。hockey は速いパックと速く振ったマレットがすり抜けないよう、動く量に応じて 1 フレームを細かく分けて当たり判定し、そのあいだのマレット位置は前のフレームから補間する。爆弾の位置・脈・熱はループが DOM に直接書き、Svelte の状態にはメーター・持ち主・爆発のように変化が少ないものだけを載せる。座標は盤面の幅・高さに対する 0..1 で、距離と速さは高さを 1 とした単位に揃えている（縦向き・横向きで手触りを変えないため）。

わんにゃんハウス（`pet-house`）は子犬 8 種・子猫 7 種と触れ合う自由あそび（`levels: 1`）で、three で描く。ステータス・コイン・おみせ・芸・保存は `engine.ts`、ペットの行動とおもちゃの物理は `behavior.ts` が DOM も three も使わずに持ち、`session.svelte.ts` が両者と 3D（`world3d.ts`）・画面をつなぐ。Session 本体は画面から見える状態・ボタンと指の口・場面の出入りだけを持ち、投げるおもちゃとねこじゃらし（`toys.ts`）・なでるとブラシ（`rubbing.ts`）・芸のボタンとほめる（`training.ts`）・ペットの出来事の演出と公園のプレゼント（`reactions.ts`）・お皿（`bowls.ts`）・スタンプを押す列（`stamp-queue.ts`）・遊びのモードの出入り（`modes.ts`）は部品に分けてある。部品は Session の中身を `core.ts` の `Core`（actors・view・world・fx・say など、場面が変わっても今のものを返す口）で受け取る。部屋と公園の範囲・お皿・ベッド・カメラは `layout.ts` の 1 か所で、行動と 3D が同じ数字を使う。コンテスト・おふろ・リードのおさんぽ・ふれあいひろば（ペットを選ぶ 3D の広場）・しつけのリズムあそびは「遊びのモード」として `activity.ts` の口に挿し、それぞれ自分の場面（`scene-*.ts`）と HUD を持つ（挿し方は `activity.ts` の先頭のコメント）。ふれあいひろばは全種類を一度に組み立てると重いので、飼っていない種類から犬と猫を 4 匹ずつ出し、「ほかの子たち」で入れ替える（`plaza.svelte.ts` の `roster`）。場面の組み立ては数百 ms 止まるので、Session は「いどうちゅう…」を 1 度描かせてから組み立てる（`moving`）。部屋の模様替えは `decor.ts`（テーマと部位・値段・持ちもの）と `scene-room.ts` / `room-furniture.ts` / `room-textures.ts` で、部位ごとに作り直す。アクセサリーは `accessories.ts` がペットごとに首や頭の形を測って合わせ、体と同じ骨で曲げる。ねこじゃらしのひもと羽根の揺れは `wand.ts` の質点ばね。BGM は `bgm.ts`（曲は `songs.ts`）が場面ごとのループを AudioContext の時計で先読みして鳴らし、鳴き声は `cries.ts` がフォルマントで種類ごとに合成する。どちらも `$lib/audio.svelte` の `bus()`（wake 前・ミュート中は無い）から出す。ソファとベッドは `layout.ts` の `roomPerches()` が返す「乗る場所」で、ペットは高さ（`Actor.y`）を持って飛び乗る。なでた場所（頭・あご・おなか・しっぽなど）は `world3d.ts` の `pickPart` が骨を覆う丸で決め、場所ごとの好き嫌いと反応は `petting.ts` の表にある。しつけの「おしえる」はリズムあそび（`rhythm-play.svelte.ts`）で、曲に合わせて流れてくるノーツを芸ごとの指の動き（タップ・スワイプ・ぐるっと・長押し）で叩き、1 曲の成績で覚えた回数が進む。譜面・判定・成績・曲の時計は `rhythm.ts`、レーンの絵は `rhythm-draw.ts` で、曲は `bgm.ts` の `Tune` が同じ時計に合わせて鳴らす。時計は音が鳴っていれば AudioContext の時刻から出力の遅れを引いたもの、ミュート中は performance の時刻で進め、切り替わっても飛ばない。このモードは `smooth` で描く回数を 60 に保つ。スタンプ帳の条件とごほうびは `stamps.ts`（数える値は Save の `counters`）。組み立てたペットの形は重いので、版ごとに IndexedDB（`asobibako-pet-house`）へ控え、タイトルのあいだに読む。ペットのモデル（`models.ts`）は種類ごとの寸法の表（`looks.ts`）と action ごとの目標のかっこう（`pose.ts`）から、なめらかな 1 枚の体（`sculpt.ts`）を骨で曲げ、体・胸・しっぽに毛の殻（`fur.ts`）を重ねて組む。顔は殻を使わず短い毛並みを面に描く。足の短い種類（コーギー・ダックス・マンチカン）は `looks.ts` の `lower()` が胴の下の足だけを縦に縮め、`models.ts` の `shorten()` がかっこうの腰の下げ方を浅くし、おすわりでは胸から上を起こして床に沈まないようにする。3D の画質は `src/lib/graphics.svelte.ts`（`asobibako:graphics`、端末ごとの設定なのでバックアップに入れない）で、アプリについての「がしつ」から選ぶ。保存は `asobibako:pet-house`（写真は `asobibako:pet-house:photos`）で、閉じていたあいだの減りは開いたときと前面に戻ったときだけ `catchUp()` でまとめて入れ、下限より下げない。`save` は深い `$state` なので、ゆっくり変わるステータスはループの中で 0.25 秒ごとにまとめて進める。時間帯と天気は `daytime.ts`（端末の時計と日付から決まる）が光・空・窓の外を決め、雨・雪・星は `sky3d.ts` が描く。ペット同士の交流（あいさつ・じゃれ合い・毛づくろい・くっつき寝）と体の押しのけは `social.ts` が種類ごとの体の形で決める。

らくがきパレード（`doodle-worm`）は、描きためた線を「うごけ！」で子にする。線は指ごとに持つので 2 人で同時に描け、外枠が重なるか近い線どうしを 1 匹にまとめ（`engine.ts` の `groups`）、離れて描いた絵は別々の子になる。1 匹の中では（`hatch`）いちばん大きな輪が体で、ほかの線は半分以上が体の中なら顔（顔があれば目を足さない）、外なら体の中心から見た向きで足・はね・触角・しっぽ（片側だけに長く伸びた線）になる。体から離れた線や下へ長く伸びた線（棒人間の胴や足）は振るとつないだ線が外れて見えるので `still` として体といっしょに動かすだけにする。動き方は手足で決まり、しっぽなら這い、足なら歩き、はねなら飛び、何もなければ跳ねる。輪のない絵は全体をくねらせて這う。動かした絵はずかん（`stock.ts`、`asobibako:doodle-worm:stock`）に新しい順で 48 枚まで残り、あふれたら ★（おきにいり）のない古い絵から落とす。ずかんのシート（共通の `src/lib/components/Sheet.svelte`）から絵を呼ぶ・消す・画面の絵をかたづける・パレード（`parade`。新しい 12 枚が足もとをそろえて 1 列で右へ行進し、右へ抜けた子は列のうしろへ回る）ができ、消すのは「けす」を押しているあいだだけにして押し間違いを防ぐ。画面に出す自由な子は 12 匹までで、あふれたら古い子から下がるが、パレードの列の子は数えず下げない（`add`）。画面の子は指をほとんど動かさずに離すと跳ねる（`poke`）。描きかけの絵のそばでは目などの点を打てるよう、跳ねさせない。

ひらめきナゾ（`hirameki`）は 1 面 1 問のナゾ解きで、問題は `puzzles/*.ts` のデータに持つ（図は `fig.ts` の部品で組み、`{@html}` は使わない）。遊ぶ順とジャンルは `puzzles/index.ts` の `ORDER` が決め、難しさの順ではなく同じジャンルが隣り合わないように並べる。答え方は数字・タップ・マッチ棒・川渡り・注ぐ・一筆の直線・かなタイル・スライド・駒の配置・氷の上を滑る・線でつなぐ・等分割・回転タイル・数を入れる、で、当てずっぽうで当たる選択式は置かない。`puzzles.test.ts` は、マッチ棒・一筆・スライド・川渡り・注ぐ・氷が用意した手数で解けること、線でつなぐ・等分割・回転タイルが解けること（分割と回転は `example` の正解で）、タップ・配置・数を入れるが当てずっぽうで当たる割合が 1/10 以下であること、ジャンルが隣り合わないことを確かめる。ウミガメのスープ風の物語のナゾは `questions` に、はい・いいえで答える質問を持ち、「質問する」で答えを開きながら真相をかなで答える。答えたあとは探偵が考えこむ間を置いてから「ナゾ解明！」か「残念…」を出す（`Verdict.svelte`）。間違えたときは答えの入力だけを作り直し、図のメモ・開いたヒント・質問の答えは残して同じナゾを続ける。メモは線を盤面に対する 0..1 の座標で持ち、大きさが変わるたびに描き直す。

## 見た目

明るいパーティーゲームの見た目に揃える。色・影・模様・書体は `src/app.css` の `:root` にまとめてあり、各ゲームはそれを使う（地は `--bg`、1P は青 `--p1`、2P は赤 `--p2`、陣地は淡い `--zone-1` / `--zone-2` に水玉 `--dots` を重ねる）。ゲームの中の部品は白いふちと下に厚みのある影を持ち（`--lift`）、押すと沈む。太い文字は `.sticker`。一覧・タイトル・結果・隅のボタン・吹き出し・エラーの共通の画面は、ロゴ（`Logo.svelte`）に合わせたゆるかわで、こげ茶の細い線 `--line`・パステル（`--pastel-p1` / `--pastel-p2` / `--pastel-gold`）・薄い影 `--soft-shadow`・紙の地 `--paper` と `--paper-dots` を使う。ボタンは `.pill`（`.p1` / `.p2` / `.gold`）、隅の丸いボタンは `.round`、見出しと勝敗の文字は `.yuru`（塗りは `--fill`）。ゲームの中で使うトークンと `.sticker` は共通の画面のために変えない。書体は端末のヒラギノ丸ゴを使い、外部フォントは読み込まない（CSP とオフラインのため）。出てくる動きには `--spring` のばねを使い、`prefers-reduced-motion` では止める。一覧のカードの絵は `pnpm thumbs` で実際の画面から撮った `static/thumbs/<id>.webp`（台本は `scripts/thumbs/scenes.ts`）で、1 人用のタイトル画面の額にも同じ画像を使う。

## 横向き

横向きのタッチ端末では、ゲーム画面の外枠（`.stage`）だけを CSS で時計回りに 90 度回し、盤面を縦長に保つ（`app.css` の `@media (orientation: landscape) and (pointer: coarse)`）。各ゲームは縦長の盤面だけを前提にしてよい。指の座標は `BoardInput` が外接矩形と盤面そのものの大きさの食い違いから回転を見つけて直し、描画の位置は盤面そのものの大きさ（`offsetWidth` / `offsetHeight`）で書く。盤面の中の大きさは画面基準の `dvh` ではなく、盤面の高さに対する `%` か、`.stage` を基準にしたコンテナ単位（`cqh` / `cqw`）で指定する（回すと `dvh` は盤面の幅を指してしまうため）。大きな見出しは `min(…cqh, …cqw)` で幅にも合わせ、iPhone のような細長い画面でも折り返さないようにする。

外枠のクラスを `.board` にすると各ゲームの盤面（`.board`）にも効いて高さが潰れるので、共通のクラスはゲームで使わない名前にする。

## 更新

新版の検知は SvelteKit の `version.pollInterval`（5 分）と、画面が前面に戻ったときの `updated.check()`（`+layout.svelte`、1 分に 1 回まで）で行う。ホーム画面のアプリはページ遷移が少なくポーリングも止まりがちなため。一覧の右上の「？」（`.round`）は `/about`（アプリについて）へのリンクで、新版があるとき（`updated.current`）は赤い点を付ける。`/about` は更新（`AppUpdate.svelte`）・アプリの状態・3D の画質（`GraphicsSetting.svelte`）・データの扱い・バックアップ（`Backup.svelte`）のカードを縦に並べる。`AppUpdate.svelte` は新版があるときだけ「最新版に更新」を出し、`src/lib/pwa.ts` の `updateApp()` が新しい Service Worker の取り込みを待ってから読み直す（30 秒で見切る）。アプリの状態（ホーム画面からの起動・Service Worker・`asobibako-` のキャッシュ）は同じファイルの `pwaStatus()` が mount 後に読む。

## 入力

2 人が同時に触るので、入力は必ず `pointerdown` と `pointerId` で扱う。長押しは `setPointerCapture`（合成イベントでは失敗しうるので try/catch）。`touch-action: none` と `user-select: none` を全体にかけ、iOS の長押しメニュー・選択・ダブルタップズームを封じる。

決着した指を離した位置に結果画面のボタンが現れると、iOS Safari はそこへ合成 `click` を飛ばす。`preventDefault()` では止まらず、リンクは SvelteKit のルーターが先に拾う。そこで決着後は、画面上の指がすべて離れてから 350ms（取りこぼしに備えて最長 3 秒）経つまで、結果画面と端のボタンを `pointer-events: none` にして当たり判定ごと消す（`GameShell.svelte` の `settling`）。爆弾を握ったまま勝つゲームもあるので、決着の時刻からではなく指が離れた時刻から数える。

机に置いて遊ぶため Wake Lock で画面を保つ。`AudioContext` は iOS では操作イベント内で `resume()` しないと無音のままなので、最初のタッチで `wake()` を呼ぶ。

## 規約

svelte-vitals は `svelte-vitals.config.ts` の方針（個人用・noindex なので共有向け SEO 規則はオフ、`src/lib/*` は kebab-case、全ページに `<main>`、`failOn: 'warning'`）で動く。markuplint は `pnpm lint` の中で `src/**/*.svelte` と `src/app.html` を検査する（警告も失敗扱い）。外している規則とその理由は `.markuplintrc.jsonc` のコメントにある。

依存は `pnpm-workspace.yaml` の catalog で一元管理し（`minimumReleaseAge` あり）、Renovate が minor/patch を自動マージする。CI（`.github/workflows/ci.yml`）は PR では lint（+ svelte-vitals 全体スキャン）/ check / test / build を並列に、`main` への push では build を除く 3 つを回す（ビルドと配信は `deploy.yml` で、ビルドの前に `pnpm test:run` を通す）。

GitHub Pages のサブパス配下で動かすため、アセットは `$app/paths` 経由か `%sveltekit.assets%` で参照する。CSP はヘッダを出せないぶん `vite.config.ts` の `csp`（`mode: 'hash'`）が `<meta http-equiv>` で配る。Service Worker は `build` / `files` / `prerendered` をまとめてキャッシュする（GitHub Pages が配信しないファイルを `files` に入れると `addAll` ごと失敗してインストールされない）。
