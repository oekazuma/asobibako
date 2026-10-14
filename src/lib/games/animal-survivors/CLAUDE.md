# アニマルサバイバー

アニマルサバイバー（`animal-survivors`）は、動物を 1 匹選び、面（森・夜の墓地・雪山・火山）を選んで、押し寄せる大群を 10 分生き延びるサバイバル（`levels: 1`。キャラ選択・ステージを選ぶ画面（`StageSelect.svelte`。ボスの名前は出さず、出てきたときに分かる）・プレイ・リザルトをゲームが持ち、シェルの `onfinish` は呼ばない）。

## 全体の決まり

ルールは DOM を使わない `world.ts`（移動・出現・敵の動き・押し合い・接触・時計）・`arms.ts`（武器の動き方）・`drops.ts`（経験値の曲線・玉・肉・磁石）・`choices.ts`（レベルアップの 3 択）で、動物・武器（Lv2〜5 の上げ幅）・パッシブ・敵・ステージの出現表はそれぞれの表（`animals.ts`・`weapons.ts`・`passives.ts`・`enemies.ts`・`stages/forest.ts`）に 1 項目足せば加わる。
乱数は種から作る（`rng.ts`）。
武器は進む向きではなくいちばん近い敵へ向けて撃つ（逃げながら当てるため）。
遠すぎる敵は消さずに進む先の画面の外へ置き直し、玉が 400 個を超えたら新しく作らず自分からいちばん遠い玉に値を足す。
ドット絵は 1 文字 = 1 色の格子（`art/*.ts`、色は `art/palette.ts`）で、`pixels.ts` の `bake()` が初回に 1 ドット = 1 画素の canvas へ焼いて控える。
座標は仮想画面（幅 260 ドット前後、`draw.ts` の `viewSize()` が盤面そのものの大きさから整数の倍率を決める）のドットで持ち、端末の画素の canvas に倍率を掛けてぼかさずに描く。
カメラと絵の位置は仮想のドットではなく端末の画素に丸める（`devicePx`）。
ドットに丸めると iPad では 3pt 刻みで不規則に進み、カクついて酔うと言われた。
被弾で画面は揺らさず、縁を赤く光らせる。
大群の中では点滅がチカチカに見えるので、1 フレームごとに消したり切り替えたりはしない（当たったあとの無敵は消さずに薄く、敵に当たったときの白は半分重ね、予告と時計の終わりは `draw-boss.ts` の `pulse` でなめらかに明滅させる）。
HUD は英数字だけなので同じ canvas に 3×5 のドット字（`font.ts`）で描き（`hud.ts`）、日本語が要るキャラ選択・3 択・リザルトは HTML で `retro.css` の `as-` の枠を使い、先へ進むボタン（出発・はじめる・挑戦する・つづける・もう一度・延長戦へ）だけを黄色（`.as-go`）にする。
キャラ選択より奥の画面（ステージ・釜・パワーアップ・実績・図鑑・装備・ガチャ・お題）は、左上の「‹ もどる」（`Back.svelte`。スクロールする `.as-screen` の外の帯に置き、一覧を下へ送っても見える）で戻る。
リザルトの「もう一度」「キャラ選択へ」も `.as-screen` の外の下の帯に置き、達成した実績はいくつ取っても 1 つの枠にまとめる（`Trophy.svelte`。仲間になった子の帯も持ち、パワーアップの画面と共用）。
3 択とリザルトは移動の指の下に出るので、出た直後の合成 click を防ぐ。
リザルトは `Survivors.svelte` が最初から聞いている `Settle` で、3 択は `lock.svelte.ts` の `Lock` で止める（出てから 350ms と、出たときに残っていた移動の指が離れてから 350ms。親指をスティックに置いたまま別の指で選べるよう、全部の指が離れるのは待たない）。
3 択は盤面の外に置く（盤面の中だと pointerdown で盤面が指をつかみ、click がカードに届かない）。
画面が隠れているあいだは時計を進めない。
記録（いちばん長い生存・撃破の合計・倒したボス・クリア・クリアした動物・開けた宝箱・コイン・店の段・達成した実績・解放した動物・図鑑）は `records.ts` が `asobibako:animal-survivors` に持ち、`record()` が決着したとき（リザルトを待たずに）記録を足して、その回に達成した実績を返す（解放は取り消さない。古い保存は足した項目を 0 と空で読み、壊れた保存や使えない保存でも空の記録で続ける）。
知らせの版は `COOP_VERSION`（ちがえば `coop-mismatch`。`Party` が `mismatch` を自分の版ちがいに使うので名前を分ける）。
遊んでいる最中は左上の「Ⅱ」（PC では Esc か P）で一時停止のメニュー（`Pause.svelte`）を開き、画面が隠れたときも開く（3 択・宝箱の画面のあいだは開かない、`pause.ts`）。
一時停止のメニューには持っている札を、うれしい効き目と引き換え（「ただし …」）まで出す（`ArcanaRow.svelte` の `detail`）。
「やめる」と「最初からやり直す」は確かめの画面を出し（出てから 350ms は `Lock` で押せない）、倒れたときと同じに記録してから、やめるはリザルトへ、やり直すは同じ動物・同じ面ですぐ始める（リザルトの「もう一度」も同じ）。

## 話題ごとの文書

次の話題は、このフォルダの `docs/` の文書に書いてある。`docs/` の文書は Claude Code が自動では読み込まないので、かっこの中のファイルを直す前に、その話題の文書を開く。

- 面・障害物・遺物・祠・吹雪・噴火・出来事は `docs/stages.md`（`stages/`・`obstacles.ts`・`relics.ts`・`shrines.ts`・`storm.ts`・`eruption.ts`・`events.ts`・`carry.ts`・`draw-obstacles.ts`・`draw-storm.ts`・`draw-volcano.ts`・`draw-events.ts`・`draw-carry.ts`）
- ボス・ヌシ・強化個体・きらきらハリネズミは `docs/bosses.md`（`bosses.ts`・`bosses-forest.ts`・`bosses-snow.ts`・`bosses-volcano.ts`・`enemies.ts`・`draw-boss.ts`・`BossIntro.svelte`・`BossWarning.svelte`）
- 武器・宝箱・限界突破・落とし物・能力・進化・合体は `docs/weapons.md`（`weapons.ts`・`arms.ts`・`zones.ts`・`chest.ts`・`limit.ts`・`choices.ts`・`choice-view.ts`・`drops.ts`・`passives.ts`・`evolutions.ts`・`unions.ts`・`draw-arms.ts`・`LevelUp.svelte`・`ChestOpen.svelte`・`Evolutions.svelte`・`DamageTable.svelte`）
- 動物と育ちは `docs/animals.md`（`animals.ts`・`specials.ts`・`grow.ts`・`art/animals.ts`・`art/grown.ts`・`GrowPlate.svelte`）
- 店・コイン・実績・図鑑・BGM・延長戦は `docs/progress.md`（`upgrades.ts`・`achievements.ts`・`trophy-groups.ts`・`book.ts`・`book-view.ts`・`songs.ts`・`overtime.ts`・`Shop.svelte`・`Trophies.svelte`・`Trophy.svelte`・`Book.svelte`・`OvertimeAsk.svelte`）
- キャラ選択・今日のお題・まじょの釜・アルカナは `docs/menus.md`（`CharSelect.svelte`・`AnimalCard.svelte`・`MenuLinks.svelte`・`daily.ts`・`cauldron.ts`・`arcana.ts`・`Daily.svelte`・`DailyCard.svelte`・`Cauldron.svelte`・`ArcanaPick.svelte`・`ArcanaRow.svelte`）
- 装備・ガチャは `docs/gear.md`（`gear.ts`・`gacha.ts`・`gacha-show.ts`・`gacha-sounds.ts`・`gacha3d.ts`・`gacha3d-parts.ts`・`Gear.svelte`・`GearDetail.svelte`・`GearIcon.svelte`・`Bag.svelte`・`GachaRoom.svelte`・`Gacha.svelte`・`Gacha3D.svelte`・`GachaList.svelte`・`GachaOdds.svelte`・`RunKit.svelte`）
- ふたりで遊ぶ（協力プレイ）は `docs/coop.md`（`coop.ts`・`coop-run.ts`・`coop-stats.ts`・`coop-quit.ts`・`heroes.ts`・`snap.ts`・`link.ts`・`link-halves.ts`・`draw-link.ts`・`CoopRoom.svelte`・`CoopPick.svelte`・`CoopPlay.svelte`・`CoopOverlay.svelte`・`CoopStats.svelte`・`CoopBook.svelte`・`LinkButton.svelte`・`LinkCutIn.svelte`）
