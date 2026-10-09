# やっぱりカメレオン 2b（ロビーの部屋・屋敷の 3 部屋・ダブル・見落としポイント） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2a のつないで遊ぶ試合に、本家にあって 2a で回したもの（HUNTER の台のあるロビーの部屋・書斎とキッチンとランドリー・試合ごとに変わる小物の置き方・ダブル・見落としポイント・ええやん・ハンターの三人称・埋まりすぎの警告・BGM）を足す。

**Architecture:** ルールは DOM と three を使わない .ts に置いて vitest で確かめる（`referee.ts` はダブル・ええやん・埋まりの時計・見落としポイントの足し算、`oversight.ts` は視野と遮りと距離、`embed.ts` は埋まりの判定、`mansion/props.ts` は種から決まる小物の置き方、`mansion/lobby.ts`・`mansion/rooms.ts` は部屋の並びと当たり）。親の `Host` は届いた体から台の上の人・埋まり・見落としポイントを毎フレーム決め、ダブルの残した体を的にして当たりを決める。各端末の `Session` は種で小物を動かし（3D は作り直さない）、ダブルの残した体を 2a の答え合わせの体（`Remote` の `pin`）と同じ作りで置き、三人称のハンター・埋まりの印・ええやん・順位表を出す。BGM は `$lib/music/loop.ts` の `Loop` でフェーズの曲を流す。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、three 0.186、WebRTC の DataChannel（`src/lib/net/` の `Handshake.svelte` と `Party`）、Web Audio（`$lib/music/` の `Loop` と楽器）、vitest 4（`unit` は node、`dom` は happy-dom）、playwright-core（headless Chrome で撮る）。

**Spec:** `docs/superpowers/specs/2026-10-09-yappari-chameleon-stage2b-design.md`（2a の決めごとは `docs/superpowers/specs/2026-10-09-yappari-chameleon-stage2a-design.md`、全体の設計は `docs/superpowers/specs/2026-10-08-yappari-chameleon-design.md`、本家の仕様は `docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md`）

## Global Constraints

- id は `yappari-chameleon`、フォルダは `src/lib/games/yappari-chameleon/` のまま。three はこのゲームの `load()` から読み込まれる本体の中でだけ import する。ゲームのフォルダの外のゲームを import しない。
- 知らせの形が変わるので `net.ts` の `CHAMELEON_VERSION` を 1 から 2 に上げる。
- 2a の決めごとは残す。隠れタイム（設定の「ハンター待機時間（秒）」）の既定は 120 秒、もうええよのボタンは「隠れタイムを飛ばす N/M」「ロビーへ戻る N/M」。
- ロビーの部屋は 16m 四方・高さ 6m（出口なし）。床は白黒の市松、壁と天井は白、壁に白いアーチと赤・黄・緑・紫の大きなペンキのしぶき。まん中に直径 2.4m・高さ 0.3m の赤い丸い台、上面に白いペンキの筆の字で「HUNTER」。台は乗れる箱として当たりに入れる。
- 台の上に立っている人（足もとが台の上面にあり、中心が台の円の内側）がハンター希望。親がロビーのあいだ届いた体の位置から決めて `phase` の `wishes` で配る。2a の「ハンター希望」ボタンと頭の上の赤い印はなくし、乗っている人がいるあいだ台の縁を明るく光らせる。
- 屋敷の 3 部屋は、書斎・図書室（大広間の東の壁の戸口から、x 7〜17）、キッチン（緑の廊下の北の壁の戸口から）、ランドリー（緑の廊下の南の壁の戸口から）。部屋は 8〜10m 四方・高さ 3.5〜4m、戸口は幅 1.5m・高さ 2.4m。点光源は部屋ごとに 1〜2 個。
- 動く物は、風船・椅子・丸テーブル・ソファ・ベンチ・洗濯カート・タオルの山・段ボール箱・本の山・バケツ。額の絵は試合ごとに絵柄を差し替える。壁に付いた大物（本棚・ピアノ・洗濯機・キッチンの台と棚・大階段）は動かさない。部屋ごとの置き場所の候補から、候補の数より少なく置く。
- 親が紹介に入るときに種を決めて `phase` で配り、各端末は種から同じ置き方を作る。ロビーへ戻ると既定の置き方。作り直しは紹介の 3 秒のあいだに済ませる。
- ダブルの紹介はマゼンタのモード名と「最初に全員で隠れる。」「その後全員で探索し、最初に全員見つければ勝利」。探索のあいだの言葉は全員「全員を見つけよう」、隠れタイムは「探索開始まで」。順位表は `#1 プレイヤー2 2/2`、上の人形は全員が赤、勝者の言葉は「勝者 プレイヤー2!」か「勝者なし」。
- 見落としポイントは、体の真ん中か頭がハンターの視野（縦 72 度、横は半角 52 度）の中にあり、目からその点までの線が屋敷の箱に遮られず、直前 0.2 秒の位置の変化が 0.05m 未満で、距離が 15m 以内のとき、1 秒あたり `10 × (1 − 距離 / 15)` 点。親が `phase` で 1 秒ごとに配る。
- 設定に「ハンターに見逃しランキングを表示」（既定オン）を足す。ハンターの画面の左に見出し「見落とした敵」と名前と点の順位、「隠す」のボタン。答え合わせでは「見落とされた場所」として点の順位と、いた場所を出す。
- ええやんは答え合わせのあいだ、隠れた人（ダブルでは全員）の自分以外の 1 人に 1 試合 1 回。数は親が数えて配り、名前の札の横に親指のアイコン（`src/lib/icons.ts` に足す）と数で出す。ボタンは画面の右の一覧に並べる。通算は持たない。
- ハンターの右端のボタンに「TPS視点」（三人称のあいだは「FPS視点」）。三人称は体の後ろ上からのカメラで自分の体（銃を構えたポーズ）を出し、十字は画面の中央、弾はカメラの位置から十字の向きへ飛ばす。控室と観戦のあいだは出さない。
- 埋まりすぎは、胴か頭のカプセルの軸の真ん中が屋敷の箱の中にあるとき。本人の画面の中央に赤みの字で「体が埋まりすぎている！この状態が続くと位置が公開されます」、5 秒続くとハンターの画面にその人の場所の赤い下向きの矢印（壁を透かして見える）。時計は親が持ち、隠れタイムと探索のあいだだけ数える。
- BGM はロビー・隠れタイム・探索の 3 曲を `$lib/music/loop.ts` の `Loop` と `tune.ts` の楽器で鳴らす（曲はこのゲームの `songs.ts`）。答え合わせはロビーの曲。共通のミュートで止まり、ペイントモードのあいだは小さくして流し続ける。
- 屋敷の部品を足したあとで iPad Air 相当の重さを headless で測り、描く回数が 2a の 1.5 倍を超えたら材質と形をまとめる。
- HUD と画面の字は白に黒い影の明朝（`font-family: 'Hiragino Mincho ProN', serif`）。大人向けの漢字まじりで、本家の言葉（ダブル・全員を見つけよう・見落とした敵・見落とされた場所・ええやん・TPS視点・FPS視点・勝者なし など）を使う。
- コンポーネントは 200 行未満。抑制コメントは使わない。
- 絵文字は使わない。アイコンは `src/lib/icons.ts` に SVG パスで足し、DOM では `Icon.svelte` で出す。
- コメントは非自明な WHY だけ（隠れた制約・workaround の理由・驚く挙動）を日本語で書く。WHAT・変更履歴・タスク番号は書かない。
- 指は `pointerdown` と `pointerId` で扱う。スティックの指を置いたまま押すボタンは `onpointerdown` で受ける。
- コミットの前に `pnpm format` で整える。各タスクの終わりに `pnpm lint`・`pnpm check`・`pnpm test:run` が通る。最後のタスクで `pnpm verify` を通す。
- コミットのメッセージは英語で、`Co-Authored-By` などの署名の行は付けない。
- ブラウザは built-in browser（`mcp__Claude_Browser__*`）だけを使い、Claude in Chrome は使わない。dev サーバーは `pnpm dev --port 5180` で起動し、`preview_start` には頼らない。
- 見た目と通しの確かめは headless Chrome（`playwright-core`、`channel: 'chrome'`、GPU は `--use-angle=metal`）で撮る。built-in browser は隠れると `requestAnimationFrame` が止まる。撮るスクリプトは scratchpad（`/private/tmp/claude-501/-Users-oekazuma-localRepo-asobibako--claude-worktrees-meccha-chameleon-clone-51ef75/ec70cc60-b8f6-4d7c-9a9d-7944e6622daa/scratchpad`、以下 `<scratchpad>`）に置き、リポジトリには入れない。

## Review Focus

1. ダブルの探索の途中で子が切れて戻る。戻った子の画面には全員の残した体が、隠れタイムの終わりの塗りとポーズのまま出て、戻った子はハンターの続きの場所から探し、見つけた数も引き継ぐ。親は残した体とそのときの塗りを別に控え、様子より先に `left` と `leftDabs` で送り直す（持ち主の列は探索で白に戻っているので、今の列では足りない）。Task 10 の「ダブルで戻った子へ」と、Task 12 の「ダブルで戻った子は」で確かめる。
2. 小物の種が 3D を作り終える前に届く。子は 3D を作るあいだの知らせを `Inbox` にためて Session へ渡すので、最初の様子でも種を当てる（フェーズの変わり目だけで当てると、戻った子と途中で来た子の小物と当たりが親とずれる）。親も種から当たりを作り直す。Task 10 の「始めると種から屋敷の当たりを作り直し」と、Task 12 の「3D を作るあいだに届いていた種も」で確かめる。
3. 隠れる人が HUNTER の台の縁に半分だけ乗る。当たりの八角形の箱と体の円の重なりで台の上面に立てても、中心が円の外ならハンター希望にしない。跳んでいる最中は台の上なら希望のまま（希望が跳ぶたびに切り替わると、様子が毎フレーム配られる）。Task 5 の「台の縁に半分だけ乗った人」と「跳んでいる最中も」で確かめる。
4. ハンターが三人称のあいだの見落としポイント。親は three を持たず、三人称のカメラは目より 2.4m 後ろにある。ハンターは動き（`me`）にカメラの位置（`eye`）を載せ、親はそこから視野と遮りを見る。目の位置で見ると、ハンターの背中と三人称のカメラのあいだにいる人に点が入らない。Task 10 の「三人称のハンターは、カメラの位置から見る」で確かめる。
5. 壁や天井に張り付いたままポーズを取る。張り付きの置き方は体を面に付けるので、寝そべる・丸まる・ブリッジなどで胴や頭の真ん中が張り付いた面の箱へ入る（scratch で確かめると、壁で 4 つ・天井で 2 つのポーズが入る）。張り付いている体は調べない。床で壁に向いて寝そべるのは埋まりに数える。Task 4 の「張り付いた体は、どのポーズでも埋まりに数えない」と「床で壁に向いて寝そべると埋まる」で確かめる。

---

## ファイルの地図

| ファイル                                                                                                                    | 持つもの                                                                                                                 | タスク         |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `yappari-chameleon/referee.ts`                                                                                              | ダブル（全員が隠れて全員が探す・見つけた体・勝者）・小物の種・隠れた人・ええやん・埋まりの時計・見落としポイントの足し算 | 1, 2           |
| `yappari-chameleon/match.svelte.ts`                                                                                         | モードの色・勝者の言葉・ダブルの言葉と順位表・見落とした敵・見落とされた場所                                             | 1, 11          |
| `yappari-chameleon/Reveal.svelte`                                                                                           | 勝者の言葉を受け取る                                                                                                     | 1              |
| `yappari-chameleon/prefs.ts`                                                                                                | 見逃しランキングの設定を読む                                                                                             | 2              |
| `yappari-chameleon/oversight.ts`                                                                                            | 見落としポイントの視野・遮り・距離・動き                                                                                 | 3              |
| `yappari-chameleon/embed.ts`                                                                                                | 埋まりの判定                                                                                                             | 4              |
| `yappari-chameleon/mansion/lobby.ts`                                                                                        | ロビーの部屋・台・台の当たり・席ごとの場所・台の上の判定                                                                 | 5              |
| `yappari-chameleon/mansion/layout.ts`                                                                                       | 材質と家具の種類・戸口・部屋の名前・`mansion(seed)`                                                                      | 5, 6, 7, 8     |
| `yappari-chameleon/textures-rooms.ts`                                                                                       | ロビーのしぶきの壁・HUNTER の字・書斎の床・白いタイル・青い六角タイル・れんが・額の絵 3 枚                               | 5, 6, 8        |
| `yappari-chameleon/mansion/shapes.ts`                                                                                       | 家具の部品（箱・筒・球・板）と色                                                                                         | 5              |
| `yappari-chameleon/mansion/room-furniture.ts`                                                                               | 台・水色の台と 3 部屋の家具の形                                                                                          | 5, 7           |
| `yappari-chameleon/mansion/build.ts`                                                                                        | 面の裏の材質・台の光・小物を動かす・額の絵を差し替える                                                                   | 5, 6, 8        |
| `yappari-chameleon/world3d.ts`                                                                                              | 台の光・小物の置き直し・日の影の範囲・三人称の体の銃                                                                     | 5, 6, 8, 13    |
| `yappari-chameleon/mansion/rooms.ts`                                                                                        | 書斎・キッチン・ランドリーの並びと当たり・戸口の通り道・明かり                                                           | 6, 7           |
| `yappari-chameleon/rng.ts`                                                                                                  | 種から作る乱数（`textures.ts` から移す）                                                                                 | 8              |
| `yappari-chameleon/mansion/props.ts`                                                                                        | 動く物と置き場所の候補・種から選ぶ置き方・額の絵柄                                                                       | 8              |
| `yappari-chameleon/net.ts`                                                                                                  | 版 2・`Me.eye`                                                                                                           | 10             |
| `yappari-chameleon/host.ts`                                                                                                 | 台の上の人・種の当たり・ダブルの残した体と的・ええやん・埋まり・見落としポイント・答え合わせの場所                       | 10             |
| `yappari-chameleon/Yappari.svelte`                                                                                          | 審判に種から当たりを作る口を渡す                                                                                         | 10             |
| `yappari-chameleon/session.svelte.ts`                                                                                       | 種で小物を動かす・ロビーの席・ダブルの残した体・台の光・三人称・ええやん・埋まりの印と警告                               | 10, 12, 13, 14 |
| `yappari-chameleon/play.svelte.ts`                                                                                          | ハンターの三人称のカメラ                                                                                                 | 13             |
| `yappari-chameleon/markers.ts`                                                                                              | 埋まりすぎた人の赤い下向きの矢印                                                                                         | 14             |
| `Hud.svelte`・`Intro.svelte`・`Settings.svelte`・`Plates.svelte`・`TopButtons.svelte`・`Ranking.svelte`・`src/lib/icons.ts` | ダブルの HUD と順位表・マゼンタの紹介・設定のダブルと見逃しランキング・札のええやんの数・親指のアイコン                  | 12, 15         |
| `Overlooked.svelte`・`Spotted.svelte`・`Iine.svelte`・`EmbedWarning.svelte`・`HunterButtons.svelte`・`Overlay.svelte`       | 見落とした敵・見落とされた場所・ええやんの一覧・埋まりの警告・三人称のボタン                                             | 16             |
| `yappari-chameleon/songs.ts`・`bgm.ts`・`Online.svelte`                                                                     | 3 曲・フェーズの曲・ペイントモードで小さく                                                                               | 17             |
| `CLAUDE.md`                                                                                                                 | ゲームの説明                                                                                                             | 19             |
| scratchpad の `perf-chameleon.mjs`・`room-sheet-2b.mjs`・`e2e-chameleon-2b.mjs`                                             | 描く重さ・部屋のシート・3 ページの通しの試合                                                                             | 5, 9, 18, 20   |

---

### Task 1: ダブルのルールと小物の種

**Files:**

- Modify: `src/lib/games/yappari-chameleon/referee.ts`
- Modify: `src/lib/games/yappari-chameleon/match.svelte.ts`（ダブルのモードと色・勝者の言葉）
- Modify: `src/lib/games/yappari-chameleon/Reveal.svelte`（勝者の言葉を受け取る）
- Modify: `src/lib/games/yappari-chameleon/Overlay.svelte`（`Reveal` に言葉を渡す）
- Test: `src/lib/games/yappari-chameleon/referee.test.ts`、`src/lib/games/yappari-chameleon/match.svelte.test.ts`

**Interfaces:**

- Produces: `GameMode` に `'double'`、`Winner` に `'double'`。`Match` と `View` に `hid: Seat[]`（試合の始めに隠れた人。ダブルでは全員）・`caught: Partial<Record<Seat, Seat[]>>`（探す人 → 見つけた体の持ち主）・`reached: Partial<Record<Seat, number>>`（見つけた数がいまの数になった `clock`）・`champ: Seat | null`（ダブルの勝者）・`seed: number | null`（小物の種。ロビーは null）。`spot(m, by, seat): boolean`（ダブルで by が seat の残した体を見つけた）。`hit` はダブルでは何もしない。
- Produces: `MODES[mode].color`（紹介と HUD のモード名の色）、`winnerText(v: View): string | null`。`Reveal.svelte` の props は `{ text: string }`。

ダブルでは全員が隠れる人で始まり、隠れタイムが終わると隠れる人の全員がハンターになる。見つけたものは `found`（2a の隠れる人の発見）とは別に `caught` に持つ（`found` に混ぜると、2a の観戦・光・増え鬼の答え合わせの体の分かれ道に入ってしまう）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/referee.test.ts` の import を次にする。

```ts
import {
  DEFAULTS,
  fit,
  hiding,
  hit,
  INTRO,
  join,
  leave,
  newMatch,
  pickHunters,
  ready,
  shoot,
  spot,
  start,
  tick,
  toot,
  view,
  wish,
  type Match,
  type Settings
} from './referee';
```

ファイルの最後に足す。

```ts
describe('ダブル', () => {
  /** 3 人のダブル。隠れタイムは 60 秒、探索は 300 秒 */
  function doubled(members: Seat[] = ALL): Match {
    const m = newMatch();
    start(m, members, { ...DEFAULTS, mode: 'double', hide: 60, search: 300 }, zero);
    return m;
  }

  function searching(): Match {
    const m = doubled();
    run(m, INTRO + 60);
    expect(m.phase).toBe('search');
    return m;
  }

  it('全員が隠れる人で始まり、最初のハンターも強制挑発の時計もない', () => {
    const m = doubled();
    expect(m.roles).toEqual({ 1: 'hider', 2: 'hider', 3: 'hider' });
    expect(m.first).toEqual([]);
    expect(m.hid).toEqual([1, 2, 3]);
    expect(m.taunts).toEqual({});
  });

  it('隠れタイムが終わると全員が探す人になり、途中で来た観戦の人はそのまま', () => {
    const m = doubled([1, 2]);
    join(m, 3);
    run(m, INTRO + 60);
    expect(m.roles).toEqual({ 1: 'hunter', 2: 'hunter', 3: 'out' });
    expect(hiding(m)).toEqual([]);
  });

  it('ほかの人の残した体だけを見つけられ、同じ体は 1 度だけ。探索の前は見つけられない', () => {
    expect(spot(doubled(), 1, 2)).toBe(false);
    const m = searching();
    expect(spot(m, 1, 1)).toBe(false);
    expect(spot(m, 1, 2)).toBe(true);
    expect(spot(m, 1, 2)).toBe(false);
    expect(m.caught).toEqual({ 1: [2] });
    expect(m.phase).toBe('search');
  });

  it('ほかの全員の体を最初に見つけた人の勝ちで、すぐ答え合わせへ入る', () => {
    const m = searching();
    spot(m, 2, 1);
    spot(m, 3, 1);
    spot(m, 3, 2);
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('double');
    expect(m.champ).toBe(3);
    expect(spot(m, 2, 3)).toBe(false);
  });

  it('時間切れは見つけた数の多い人、同じ数なら先にその数に届いた人の勝ち', () => {
    const m = searching();
    run(m, 1);
    spot(m, 2, 3);
    run(m, 1);
    spot(m, 1, 3);
    run(m, 300);
    expect(m.phase).toBe('reveal');
    expect(m.champ).toBe(2);
  });

  it('誰も見つけないまま時間切れなら勝者なし', () => {
    const m = searching();
    run(m, 300);
    expect(m).toMatchObject({ phase: 'reveal', winner: 'double', champ: null });
  });

  it('隠れタイムに人が抜けても続き、探索で探す人が全員抜けたら答え合わせへ（抜けた人の体は残る）', () => {
    const m = doubled();
    run(m, INTRO);
    leave(m, 3, [1, 2]);
    expect(m.phase).toBe('hide');
    run(m, 60);
    expect(m.roles[3]).toBe('hunter');
    expect(spot(m, 1, 3)).toBe(true);
    leave(m, 1, [2]);
    expect(m.phase).toBe('search');
    // 抜けても探す人のまま（戻ると続きから探す）
    expect(m.roles[1]).toBe('hunter');
    leave(m, 2, []);
    expect(m).toMatchObject({ phase: 'reveal', winner: 'double', champ: 1 });
  });

  it('ダブルでは hit で見つからない', () => {
    const m = searching();
    expect(hit(m, 2)).toBe(false);
    expect(m.found).toEqual([]);
  });

  it('試合を始めるたびに小物の種を決め、ロビーへ戻ると既定の置き方（null）に戻す', () => {
    const m = begun();
    expect(m.seed).toBe(1);
    const other = newMatch();
    start(other, ALL, DEFAULTS, () => 0.5);
    expect(other.seed).toBe(1 + Math.floor(0.5 * 0x7ffffffe));
    run(m, INTRO + 60 + 300 + 30);
    expect(m.phase).toBe('lobby');
    expect(m.seed).toBeNull();
  });

  it('view はダブルの隠れた人・見つけた体・届いた時刻・勝者・種を配る', () => {
    const m = searching();
    spot(m, 1, 2);
    expect(view(m)).toMatchObject({ hid: [1, 2, 3], caught: { 1: [2] }, champ: null, seed: 1 });
    expect(view(m).reached[1]).toBeCloseTo(m.clock);
  });

  it('マップの設定はダブルを受け付ける', () => {
    expect(fit({ ...DEFAULTS, mode: 'double' }, 2).mode).toBe('double');
  });
});
```

`src/lib/games/yappari-chameleon/match.svelte.test.ts` の import を `import { Match, MODES, winnerText } from './match.svelte';` にし、`describe('Match', ...)` の最後に足す。

```ts
it('勝者の言葉。ダブルは勝った人の名前か勝者なし', () => {
  const v = view(newMatch());
  expect(winnerText({ ...v, winner: 'chameleon' })).toBe('勝者カメレオン!');
  expect(winnerText({ ...v, winner: 'hunter' })).toBe('勝者ハンター!');
  expect(winnerText({ ...v, winner: 'double', champ: 2 })).toBe('勝者 プレイヤー2!');
  expect(winnerText({ ...v, winner: 'double', champ: null })).toBe('勝者なし');
  expect(winnerText(v)).toBeNull();
});

it('ダブルのモード名はマゼンタ、ほかは緑', () => {
  expect(MODES.double).toMatchObject({ name: 'ダブル', color: '#e8399c' });
  expect(MODES.double.lines).toEqual(['最初に全員で隠れる。', 'その後全員で探索し、最初に全員見つければ勝利']);
  expect(MODES.infect.color).toBe('#7cc243');
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/referee.test.ts src/lib/games/yappari-chameleon/match.svelte.test.ts`
Expected: 足したテストが FAIL（`spot` と `winnerText` が無い）。

- [ ] **Step 3: referee.ts を書き換える**

`src/lib/games/yappari-chameleon/referee.ts` の型と `fit` を次にする。

```ts
export type Phase = 'lobby' | 'intro' | 'hide' | 'search' | 'reveal';
export type GameMode = 'normal' | 'infect' | 'double';
/** out は試合から抜けたハンターと、試合の途中で来た人（観戦する） */
export type Role = 'hider' | 'hunter' | 'out';
/** double はダブルの決着。勝った人は Match.champ（null なら勝者なし） */
export type Winner = 'chameleon' | 'hunter' | 'double';
```

```ts
/** 小さな dt を足し重ねたずれで、0 になるはずの時計が 0 の手前に残らないようにする */
const EPS = 1e-6;
/** 小物の置き方の種の数。種は 1 から数え、既定の置き方（null）と取り違えないようにする */
const SEEDS = 0x7ffffffe;

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(v)));

export function fit(s: Settings, players: number): Settings {
  return {
    mode: s.mode === 'normal' || s.mode === 'double' ? s.mode : 'infect',
    hunters: clamp(s.hunters, [1, Math.max(1, players - 1)]),
    hide: clamp(s.hide, LIMITS.hide),
    search: clamp(s.search, LIMITS.search),
    reveal: clamp(s.reveal, LIMITS.reveal),
    taunt: s.taunt <= 0 ? 0 : clamp(s.taunt, LIMITS.taunt)
  };
}
```

`Match` の最後（`toots` のあと）に足す。

```ts
  /** 試合の始めに隠れた人（ダブルでは全員）。ダブルでは残した体の持ち主 */
  hid: Seat[];
  /** ダブルで、探す人ごとの見つけた体の持ち主 */
  caught: Partial<Record<Seat, Seat[]>>;
  /** ダブルで、見つけた数がいまの数になった時刻（clock）。同じ数なら早く届いた人が上 */
  reached: Partial<Record<Seat, number>>;
  /** ダブルの勝者。null は勝者なし（決着の前も null） */
  champ: Seat | null;
  /** 小物の置き方の種。ロビーでは null（既定の置き方） */
  seed: number | null;
```

`newMatch` の最後（`toots: {}` のあと）に `hid: [], caught: {}, reached: {}, champ: null, seed: null` を足す。

`start` を次にする。

```ts
export function start(m: Match, members: Seat[], settings: Settings, rand: () => number): void {
  const s = fit(settings, members.length);
  const double = s.mode === 'double';
  // ダブルは全員が隠れてから全員で探すので、最初のハンターはいない
  const hunters = double ? [] : pickHunters(m.wishes, members, s.hunters, rand);
  const hiders = members.filter((seat) => !hunters.includes(seat));
  Object.assign(m, {
    phase: 'intro',
    left: INTRO,
    settings: s,
    roles: Object.fromEntries(members.map((seat) => [seat, hunters.includes(seat) ? 'hunter' : 'hider'])),
    first: hunters,
    found: [],
    winner: null,
    ready: [],
    // 隠れタイムから答え合わせまで出し続ける（減るのは探索のあいだだけ）。間隔が 0 なら 0 のまま。
    // ダブルの探索では全員が探す人なので、強制挑発の時計を持たない
    taunts: double ? {} : Object.fromEntries(hiders.map((seat) => [seat, s.taunt])),
    shots: {},
    toots: {},
    hid: hiders,
    caught: {},
    reached: {},
    champ: null,
    seed: 1 + Math.floor(rand() * SEEDS)
  } satisfies Partial<Match>);
}
```

`enter` を次にする。

```ts
function enter(m: Match, phase: Phase): void {
  m.phase = phase;
  m.ready = [];
  if (phase === 'hide') m.left = m.settings.hide;
  else if (phase === 'search') {
    m.left = m.settings.search;
    // ダブルでは隠れた体を残して、隠れる人の全員が探す人になる（途中で来た観戦の人はそのまま）
    if (m.settings.mode === 'double') for (const s of seatsOf(m, 'hider')) m.roles[s] = 'hunter';
  } else if (phase === 'reveal') {
    m.left = m.settings.reveal;
    if (m.settings.mode === 'double') {
      m.winner = 'double';
      m.champ ??= leader(m);
    } else m.winner ??= hiding(m).length ? 'chameleon' : 'hunter';
  } else if (phase === 'lobby') {
    Object.assign(m, {
      left: 0,
      roles: {},
      first: [],
      found: [],
      winner: null,
      taunts: {},
      hid: [],
      caught: {},
      reached: {},
      champ: null,
      seed: null
    } satisfies Partial<Match>);
  }
}

/** 時間切れのダブルの勝者。見つけた数の多い人、同じ数なら先にその数に届いた人。誰も見つけていなければ null */
function leader(m: Match): Seat | null {
  let best: Seat | null = null;
  for (const [k, got] of Object.entries(m.caught)) {
    const seat = Number(k) as Seat;
    const n = got?.length ?? 0;
    if (!n) continue;
    const top = best === null ? 0 : (m.caught[best]?.length ?? 0);
    const earlier = (m.reached[seat] ?? Infinity) < (best === null ? Infinity : (m.reached[best] ?? Infinity));
    if (n > top || (n === top && earlier)) best = seat;
  }
  return best;
}
```

`leave` を次にする。

```ts
/** 切れた。通常と増え鬼のハンターは試合から抜け、いるハンターがいなくなったら答え合わせへ（通常と増え鬼は隠れる人の勝ち）。隠れる人の体はその場に残る */
export function leave(m: Match, seat: Seat, present: Seat[]): void {
  m.wishes = m.wishes.filter((s) => s !== seat);
  m.ready = m.ready.filter((s) => s !== seat);
  if (m.phase === 'lobby') return;
  // ダブルでは全員が探す人なので、抜けても役を残し、戻れば見つけた数を持ったまま探し続ける
  if (m.roles[seat] === 'hunter' && m.settings.mode !== 'double') m.roles[seat] = 'out';
  // ダブルの隠れタイムまでは、まだ誰も探す人ではない
  const hunting =
    ['intro', 'hide', 'search'].includes(m.phase) && (m.settings.mode !== 'double' || m.phase === 'search');
  if (hunting && !seatsOf(m, 'hunter').some((s) => present.includes(s))) {
    if (m.settings.mode !== 'double') m.winner = 'chameleon';
    enter(m, 'reveal');
    return;
  }
  settle(m, present);
}
```

`hit` の 1 行めを `if (m.settings.mode === 'double' || m.phase !== 'search' || m.roles[seat] !== 'hider' || m.found.includes(seat)) return false;` にし、`hit` のすぐ下に足す。

```ts
/** ダブルで、by が seat の残した体を見つけた。初めてなら true。ほかの全員の体を見つけたら by の勝ちで答え合わせへ */
export function spot(m: Match, by: Seat, seat: Seat): boolean {
  if (m.settings.mode !== 'double' || m.phase !== 'search' || by === seat || !m.hid.includes(seat)) return false;
  const got = m.caught[by] ?? [];
  if (got.includes(seat)) return false;
  m.caught[by] = [...got, seat];
  m.reached[by] = m.clock;
  if (m.hid.every((s) => s === by || m.caught[by]!.includes(s))) {
    m.champ = by;
    enter(m, 'reveal');
  }
  return true;
}
```

`View` の最後（`taunts` のあと）に足す。

```ts
  hid: Seat[];
  caught: Partial<Record<Seat, Seat[]>>;
  reached: Partial<Record<Seat, number>>;
  champ: Seat | null;
  seed: number | null;
```

`view` を次にする。

```ts
export function view(m: Match): View {
  const { phase, settings, roles, first, found, winner, ready, wishes, hid, caught, reached, champ, seed } = m;
  const taunts = Object.fromEntries(Object.entries(m.taunts).map(([s, v]) => [s, Math.ceil(v ?? 0)]));
  return {
    phase,
    left: m.left,
    settings,
    roles,
    first,
    found,
    winner,
    ready,
    wishes,
    taunts,
    hid,
    caught,
    reached,
    champ,
    seed
  };
}
```

- [ ] **Step 4: モードの色と勝者の言葉**

`src/lib/games/yappari-chameleon/match.svelte.ts` の `MODES` と `WINNER` を次にする。

```ts
export const MODES: Record<GameMode, { name: string; lines: [string, string]; color: string }> = {
  normal: { name: '通常', lines: ['鬼と人間に分かれて隠れる。', '1人でも最後まで隠れ切ると勝利'], color: '#7cc243' },
  infect: { name: '増え鬼', lines: ['捕まると鬼になる。', '最後まで隠れ切ると勝利'], color: '#7cc243' },
  // 本家の紹介では、ダブルだけモード名がマゼンタ
  double: {
    name: 'ダブル',
    lines: ['最初に全員で隠れる。', 'その後全員で探索し、最初に全員見つければ勝利'],
    color: '#e8399c'
  }
};

export const WINNER = { chameleon: '勝者カメレオン!', hunter: '勝者ハンター!' } as const;

/** 答え合わせの勝者の言葉。決着の前は null */
export function winnerText(v: View): string | null {
  if (!v.winner) return null;
  if (v.winner === 'double') return v.champ === null ? '勝者なし' : `勝者 ${nameOf(v.champ)}!`;
  return WINNER[v.winner];
}
```

- [ ] **Step 5: 答え合わせの言葉を受け取る**

`src/lib/games/yappari-chameleon/Reveal.svelte` の script の頭を次にし、`WINNER` と `Winner` の import と `const text = $derived(...)` を消す。

```ts
import { onMount } from 'svelte';

let { text }: { text: string } = $props();
let canvas: HTMLCanvasElement;
```

`src/lib/games/yappari-chameleon/Overlay.svelte` の script に `import { winnerText } from './match.svelte';` と `const won = $derived(winnerText(match.view));` を足し、`{#if phase === 'reveal' && match.view.winner}<Reveal winner={match.view.winner} />{/if}` を `{#if phase === 'reveal' && won}<Reveal text={won} />{/if}` にする。

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（2a のテストも通る。`hid` と `seed` は通常と増え鬼でも配るが、2a のテストは `toMatchObject` で見ているので崩れない）。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Add the double mode rules and a per-match prop seed to the referee"
```

---

### Task 2: ええやん・埋まりの時計・見落としポイントの足し算

**Files:**

- Modify: `src/lib/games/yappari-chameleon/referee.ts`
- Test: `src/lib/games/yappari-chameleon/referee.test.ts`、`src/lib/games/yappari-chameleon/prefs.test.ts`

**Interfaces:**

- Consumes: Task 1 の `hid`。
- Produces: `Settings.overlook: boolean`（既定 true）。`Match` に `likes: Partial<Record<Seat, Seat>>`（押した人 → 押された人）・`buried: Partial<Record<Seat, number>>`（埋まっている秒）・`overlook: Partial<Record<Seat, Partial<Record<Seat, number>>>>`（ハンター → 隠れる人 → 点）・`spots: Partial<Record<Seat, V3>>`（答え合わせで見せる、いた場所。親が答え合わせに入るときに入れる）。`EXPOSE = 5`、`like(m, from, to): boolean`、`bury(m, seat, on, dt)`、`overlooked(m, by, seat, pts)`。`View` に `likes: Partial<Record<Seat, number>>`（受けた数）・`liked: Seat[]`（押した人）・`buried: Seat[]`・`exposed: Seat[]`（`EXPOSE` 秒以上）・`overlook`（切り捨て）・`spots`。

- [ ] **Step 1: 落ちるテストを書く**

`referee.test.ts` の import に `bury`・`like`・`overlooked` を足し、`fit` のテストの 1 行めと 2 行めを次にする（`Settings` に `overlook` が入るので、渡す値と返る値にも入れる）。

```ts
const s = fit({ mode: 'normal', hunters: 5, hide: 10, search: 9999, reveal: 30, taunt: 3, overlook: false }, 3);
expect(s).toEqual({ mode: 'normal', hunters: 2, hide: 30, search: 600, reveal: 30, taunt: 5, overlook: false });
```

`describe('fit', ...)` の中に足す。

```ts
it('見逃しランキングの表示は既定でオン。読めない値もオン', () => {
  expect(DEFAULTS.overlook).toBe(true);
  expect(fit({ ...DEFAULTS, overlook: undefined as unknown as boolean }, 3).overlook).toBe(true);
});
```

ファイルの最後に足す。

```ts
describe('ええやん・埋まり・見落とし', () => {
  it('ええやんは答え合わせのあいだ、隠れた人へ 1 試合 1 回。自分と最初のハンターには押せない', () => {
    const m = begun();
    run(m, INTRO + 60);
    expect(like(m, 3, 1)).toBe(false);
    run(m, 300);
    expect(m.phase).toBe('reveal');
    expect(like(m, 1, 1)).toBe(false);
    expect(like(m, 1, 3)).toBe(false);
    expect(like(m, 3, 1)).toBe(true);
    expect(like(m, 3, 2)).toBe(false);
    expect(like(m, 2, 1)).toBe(true);
    expect(view(m)).toMatchObject({ likes: { 1: 2 }, liked: [2, 3] });
    run(m, 30);
    expect(view(m)).toMatchObject({ likes: {}, liked: [] });
  });

  it('埋まりは隠れタイムと探索のあいだだけ数え、5 秒で場所を知らせる。解けたら消え、答え合わせで止める', () => {
    const m = begun();
    bury(m, 1, true, 1);
    expect(view(m).buried).toEqual([]);
    run(m, INTRO);
    bury(m, 1, true, 4.9);
    expect(view(m)).toMatchObject({ buried: [1], exposed: [] });
    bury(m, 1, true, 0.1);
    expect(view(m).exposed).toEqual([1]);
    bury(m, 1, false, 0.1);
    expect(view(m)).toMatchObject({ buried: [], exposed: [] });
    bury(m, 2, true, 6);
    run(m, 60 + 300);
    expect(m.phase).toBe('reveal');
    expect(view(m).buried).toEqual([]);
    bury(m, 2, true, 1);
    expect(view(m).buried).toEqual([]);
  });

  it('見つかった人の埋まりは消す', () => {
    const m = begun();
    run(m, INTRO + 60);
    bury(m, 2, true, 6);
    hit(m, 2);
    expect(view(m).exposed).toEqual([]);
  });

  it('見落としポイントは探索のあいだだけ足し、配るときは切り捨てる。次の試合では 0 から', () => {
    const m = begun();
    run(m, INTRO);
    overlooked(m, 3, 1, 5);
    expect(view(m).overlook).toEqual({});
    run(m, 60);
    overlooked(m, 3, 1, 2.7);
    overlooked(m, 3, 1, 1.6);
    overlooked(m, 3, 2, 0.4);
    expect(view(m).overlook).toEqual({ 3: { 1: 4, 2: 0 } });
    run(m, 300 + 30);
    expect(m.phase).toBe('lobby');
    expect(view(m).overlook).toEqual({});
  });

  it('答え合わせで見せる場所は、ロビーに戻ると消す', () => {
    const m = begun();
    m.spots[1] = [1, 0, 2];
    expect(view(m).spots).toEqual({ 1: [1, 0, 2] });
    run(m, INTRO + 60 + 300 + 30);
    expect(view(m).spots).toEqual({});
  });
});
```

`prefs.test.ts` の `describe('マップの設定', ...)` の最後に足す。

```ts
it('ダブルと見逃しランキングの設定も覚え、前の版の保存は見逃しランキングをオンで読む', () => {
  saveSettings({ ...DEFAULTS, mode: 'double', overlook: false });
  expect(readSettings()).toMatchObject({ mode: 'double', overlook: false });
  // JSON は undefined の項目を書かないので、前の版の保存と同じく overlook の無い形になる
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULTS, overlook: undefined, v: 2 }));
  expect(readSettings().overlook).toBe(true);
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/referee.test.ts src/lib/games/yappari-chameleon/prefs.test.ts`
Expected: 足したテストが FAIL（`like` が無い、`overlook` が無い）。

- [ ] **Step 3: 書く**

`referee.ts` の頭に `import type { V3 } from '$lib/sculpt';` を足す。`Settings` の最後に足す。

```ts
/** ハンターの画面に「見落とした敵」の順位を出す */
overlook: boolean;
```

`DEFAULTS` を `{ mode: 'infect', hunters: 1, hide: 120, search: 300, reveal: 30, taunt: 0, overlook: true }` にし、`fit` の返す値の最後に `overlook: s.overlook !== false` を足す。`SHOT_SLACK` の下に足す。

```ts
/** 埋まったままこの秒たつと、ハンターに場所を知らせる */
export const EXPOSE = 5;
```

`Match` の最後に足す。

```ts
/** ええやん（押した人 → 押された人）。1 試合 1 回 */
likes: Partial<Record<Seat, Seat>>;
/** 体が埋まっている秒（隠れタイムと探索のあいだだけ数える） */
buried: Partial<Record<Seat, number>>;
/** 見落としポイント（ハンター → 隠れる人 → 点） */
overlook: Partial<Record<Seat, Partial<Record<Seat, number>>>>;
/** 答え合わせで見せる、隠れた人のいた場所（親が答え合わせに入るときに入れる） */
spots: Partial<Record<Seat, V3>>;
```

`newMatch` と `start` の `Object.assign` の最後、`enter` の `phase === 'lobby'` の `Object.assign` の最後に、それぞれ `likes: {}, buried: {}, overlook: {}, spots: {}` を足す。`enter` の `phase === 'reveal'` の枝の頭に `m.buried = {};` を足す。`hit` の `delete m.taunts[seat];` の下に `delete m.buried[seat];` を足す。`spot` の下に足す。

```ts
/** ええやん。答え合わせのあいだ、隠れた人（自分のほか）へ 1 試合 1 回 */
export function like(m: Match, from: Seat, to: Seat): boolean {
  if (m.phase !== 'reveal' || from === to || m.likes[from] !== undefined || !m.hid.includes(to)) return false;
  m.likes[from] = to;
  return true;
}

/** 体が埋まっているか。隠れタイムと探索のあいだだけ秒を足し、解けたら 0 に戻す */
export function bury(m: Match, seat: Seat, on: boolean, dt: number): void {
  if (m.phase !== 'hide' && m.phase !== 'search') return;
  if (on) m.buried[seat] = (m.buried[seat] ?? 0) + dt;
  else delete m.buried[seat];
}

/** ハンター by が隠れる人 seat を見落とした点を足す（探索のあいだだけ） */
export function overlooked(m: Match, by: Seat, seat: Seat, pts: number): void {
  if (m.phase !== 'search') return;
  const row = (m.overlook[by] ??= {});
  row[seat] = (row[seat] ?? 0) + pts;
}
```

`View` の最後に足す。

```ts
  /** ええやんを受けた数 */
  likes: Partial<Record<Seat, number>>;
  /** ええやんを押した人 */
  liked: Seat[];
  /** 体が埋まっている人 */
  buried: Seat[];
  /** 埋まったまま EXPOSE 秒たち、ハンターに場所を知らせる人 */
  exposed: Seat[];
  /** 見落としポイント（ハンター → 隠れる人 → 点、切り捨て） */
  overlook: Partial<Record<Seat, Partial<Record<Seat, number>>>>;
  spots: Partial<Record<Seat, V3>>;
```

`view` の `return` の前に足し、返す値の最後に `likes, liked, buried, exposed, overlook, spots: m.spots` を足す。

```ts
const likes: Partial<Record<Seat, number>> = {};
for (const to of Object.values(m.likes)) if (to) likes[to] = (likes[to] ?? 0) + 1;
const liked = Object.keys(m.likes).map(Number) as Seat[];
const buried = Object.keys(m.buried).map(Number) as Seat[];
const exposed = buried.filter((s) => (m.buried[s] ?? 0) >= EXPOSE - EPS);
const overlook = Object.fromEntries(
  Object.entries(m.overlook).map(([h, row]) => [
    h,
    Object.fromEntries(Object.entries(row ?? {}).map(([s, v]) => [s, Math.floor(v ?? 0)]))
  ])
) as View['overlook'];
```

`prefs.ts` は `fit` が `overlook` を直すので変えない（前の版の保存に `overlook` が無くても `fit` がオンにする）。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS（`Settings.svelte` の `bind:settings` は `overlook` を持ったまま渡すだけなので、型は通る）。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Count likes, buried seconds and overlook points in the referee"
```

---

### Task 3: 見落としポイントの視野と遮り

**Files:**

- Create: `src/lib/games/yappari-chameleon/oversight.ts`
- Test: `src/lib/games/yappari-chameleon/oversight.test.ts`

**Interfaces:**

- Consumes: `shots.ts` の `capsules`・`placement`・`rayLevel`、`poses.ts` の `poseById`、`net.ts` の `Me`（型だけ）。
- Produces: `HALF_V`・`HALF_H`・`REACH = 15`・`STILL = 0.05`・`STILL_MS = 200`、`interface Viewer { eye: V3; look: [number, number] }`、`forward(look): V3`、`inView(v, p): boolean`、`bodyPoints(b): V3[]`（胴の真ん中と頭の 2 点）、`sight(lv, v, points): number | null`（見えている点のいちばん近い距離）、`rate(dist): number`（1 秒の点）、`still(now, before): boolean`。

向きは world3d の `eye()` と同じく、yaw 0 が +z、pitch は下向きが正（2a の通しの試合の台本が `eyePitch = asin(−dy / len)` で狙っている）。親は three を持たないので、視野は yaw と pitch から作った前・右・上の向きで測る。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/oversight.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import type { Level } from './move';
import { bodyPoints, forward, inView, rate, REACH, sight, still, type Viewer } from './oversight';

const open: Level = { boxes: [{ min: [-40, -1, -40], max: [40, 0, 40] }], ramps: [], spawn: [0, 0, 0] };
const walled: Level = {
  boxes: [...open.boxes, { min: [-5, 0, 4], max: [5, 3, 4.3] }],
  ramps: [],
  spawn: [0, 0, 0]
};
const eye: Viewer = { eye: [0, 1, 0], look: [0, 0] };
const deg = (a: number) => (a * Math.PI) / 180;
/** 目から見て yaw・pitch（度）の向きに d 進んだ点 */
const toward = (yaw: number, pitch: number, d: number): V3 => {
  const f = forward([deg(yaw), deg(pitch)]);
  return [f[0] * d, 1 + f[1] * d, f[2] * d];
};

describe('見落としポイントの視野', () => {
  it('yaw 0 は +z、yaw 90 度は +x、pitch は下向きが正', () => {
    expect(forward([0, 0])[2]).toBeCloseTo(1);
    expect(forward([Math.PI / 2, 0])[0]).toBeCloseTo(1);
    expect(forward([0, 0.3])[1]).toBeLessThan(0);
  });

  it('横は半角 52 度、縦は半角 36 度の中だけ。後ろは見えない', () => {
    expect(inView(eye, toward(0, 0, 5))).toBe(true);
    expect(inView(eye, toward(50, 0, 5))).toBe(true);
    expect(inView(eye, toward(-50, 0, 5))).toBe(true);
    expect(inView(eye, toward(55, 0, 5))).toBe(false);
    expect(inView(eye, toward(0, 34, 5))).toBe(true);
    expect(inView(eye, toward(0, -38, 5))).toBe(false);
    expect(inView(eye, [0, 1, -5])).toBe(false);
  });

  it('見下ろしているハンターは、足もとの前の人を視野に入れ、目の高さの正面は外す', () => {
    const down: Viewer = { eye: [0, 2, 0], look: [0, deg(40)] };
    expect(inView(down, [0, 0, 2])).toBe(true);
    expect(inView(down, [0, 2, 6])).toBe(false);
  });

  it('壁の向こうと 15m より遠い所は見えず、見える点のうち近いほうの距離を返す', () => {
    expect(
      sight(open, eye, [
        [0, 1, 6],
        [0, 1, 5]
      ])
    ).toBeCloseTo(5);
    expect(sight(walled, eye, [[0, 1, 6]])).toBeNull();
    expect(sight(open, eye, [[0, 1, REACH + 0.5]])).toBeNull();
    expect(sight(open, eye, [[0, 1, -3]])).toBeNull();
  });

  it('点は 1 秒に 10 × (1 − 距離 / 15)。近いほど多い', () => {
    expect(rate(0)).toBe(10);
    expect(rate(7.5)).toBeCloseTo(5);
    expect(rate(15)).toBe(0);
    expect(rate(3)).toBeGreaterThan(rate(9));
  });

  it('直前 0.2 秒に 5cm より動いていなければ止まっている', () => {
    expect(still([0, 0, 0], [0.03, 0, 0.03])).toBe(true);
    expect(still([0, 0, 0], [0.06, 0, 0])).toBe(false);
  });

  it('体の点は胴の真ん中と頭で、立っていれば頭が上', () => {
    const [mid, head] = bodyPoints({ pos: [0, 0, 0], yaw: 0, cling: null, pose: 'stand' });
    expect(mid[1]).toBeCloseTo(0.7025, 3);
    expect(head[1]).toBeCloseTo(1.045, 3);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/oversight.test.ts`
Expected: FAIL（`./oversight` が無い）。

- [ ] **Step 3: 書く**

`src/lib/games/yappari-chameleon/oversight.ts`:

```ts
import type { V3 } from '$lib/sculpt';
import type { Level } from './move';
import type { Me } from './net';
import { poseById } from './poses';
import { capsules, placement, rayLevel } from './shots';

/** 一人称の縦の視野 72 度（world3d の EYE_FOV）の半分 */
export const HALF_V = (36 * Math.PI) / 180;
/** 本家の 16:9 の画面での横 105 度の半分 */
export const HALF_H = (52 * Math.PI) / 180;
/** ここより遠い隠れる人には点を入れない（m） */
export const REACH = 15;
/** 直前 STILL_MS ミリ秒の位置の変化がこれ未満なら止まっている（m） */
export const STILL = 0.05;
export const STILL_MS = 200;

export interface Viewer {
  eye: V3;
  /** [yaw, pitch]。yaw 0 が +z、pitch は下向きが正（world3d の eye と同じ） */
  look: [number, number];
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function forward([yaw, pitch]: [number, number]): V3 {
  return [Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
}

/** p がハンターの視野（横は半角 HALF_H、縦は半角 HALF_V の四角すい）の中にある */
export function inView(v: Viewer, p: V3): boolean {
  const f = forward(v.look);
  const side = cross(f, [0, 1, 0]);
  const len = Math.hypot(...side);
  const r: V3 = len < 1e-6 ? [1, 0, 0] : [side[0] / len, side[1] / len, side[2] / len];
  const u = cross(r, f);
  const d = sub(p, v.eye);
  const z = dot(d, f);
  if (z <= 0) return false;
  return Math.abs(Math.atan2(dot(d, r), z)) <= HALF_H && Math.abs(Math.atan2(dot(d, u), z)) <= HALF_V;
}

/** 体の真ん中（胴の 2 つめの円すいの中ほど）と頭の中心。dollShapes の並びは頭・胴 3 つ・腕と脚 */
export function bodyPoints(b: Pick<Me, 'pos' | 'yaw' | 'cling' | 'pose'>): V3[] {
  const c = capsules(poseById(b.pose), placement(b));
  const mid = c[2];
  return [[(mid.a[0] + mid.b[0]) / 2, (mid.a[1] + mid.b[1]) / 2, (mid.a[2] + mid.b[2]) / 2], c[0].a];
}

/** 見えている点のうちいちばん近い点までの距離。どれも見えなければ null。遮るのは弾と同じ屋敷の箱と坂 */
export function sight(lv: Level, v: Viewer, points: V3[]): number | null {
  let best: number | null = null;
  for (const p of points) {
    const d = sub(p, v.eye);
    const len = Math.hypot(...d);
    if (len > REACH || len < 1e-6 || !inView(v, p)) continue;
    if (rayLevel(lv, v.eye, [d[0] / len, d[1] / len, d[2] / len], len)) continue;
    best = best === null ? len : Math.min(best, len);
  }
  return best;
}

/** 1 秒あたりの点。本家は式を出していないので、遊んで直す */
export const rate = (dist: number): number => 10 * Math.max(0, 1 - dist / REACH);

export const still = (now: V3, before: V3): boolean =>
  Math.hypot(now[0] - before[0], now[1] - before[1], now[2] - before[2]) < STILL;
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/oversight.test.ts`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Measure the hunter's view cone, line of sight and stillness for overlook points"
```

---

### Task 4: 埋まりすぎの判定

**Files:**

- Create: `src/lib/games/yappari-chameleon/embed.ts`
- Test: `src/lib/games/yappari-chameleon/embed.test.ts`

**Interfaces:**

- Consumes: `shots.ts` の `capsules`・`placement`、`poses.ts` の `poseById`。
- Produces: `embedded(lv: Level, b: Pick<Me, 'pos' | 'yaw' | 'cling' | 'pose'>): boolean`。

頭の中心と、胴の 3 つの円すいの軸の真ん中のどれかが、屋敷の箱（家具を含む `Level.boxes`）の中にあれば埋まっている。張り付いている体は調べない。張り付きは体を面に付ける置き方で、寝そべる（壁）・丸まる（壁）・しゃがむ（壁）・前屈（壁）・ブリッジ（天井）・反る（天井）では胴か頭の真ん中が張り付いた面の箱へ入る（Review Focus 5）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/embed.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Cling, Level } from './move';
import { embedded } from './embed';
import { AIM, POSES, STAND } from './poses';

// 床（y = 0）・奥の壁（z = 5〜5.3）・天井（y = 3）・ソファくらいの箱
const level: Level = {
  boxes: [
    { min: [-10, -1, -10], max: [10, 0, 10] },
    { min: [-10, 0, 5], max: [10, 3, 5.3] },
    { min: [-10, 3, -10], max: [10, 3.3, 10] },
    { min: [-6, 0, -0.45], max: [-4, 0.85, 0.45] }
  ],
  ramps: [],
  spawn: [0, 0, 0]
};
const ALL = [STAND, AIM, ...POSES];
const at = (pos: [number, number, number], pose: string, yaw = 0, cling: Cling | null = null) => ({
  pos,
  yaw,
  cling,
  pose
});

describe('埋まりすぎ', () => {
  it('部屋のまん中では、どのポーズでも埋まらない', () => {
    for (const p of ALL) expect(embedded(level, at([0, 0, 0], p.id)), p.id).toBe(false);
  });

  it('床で壁に向いて立つだけなら埋まらず、寝そべる・丸まるで胴や頭が壁に入ると埋まる', () => {
    expect(embedded(level, at([0, 0, 4.8], 'stand'))).toBe(false);
    expect(embedded(level, at([0, 0, 4.8], 'lie'))).toBe(true);
    expect(embedded(level, at([0, 0, 4.8], 'curl'))).toBe(true);
  });

  it('家具の中に立てば埋まる', () => {
    expect(embedded(level, at([-5, 0, 0], 'stand'))).toBe(true);
  });

  it('張り付いた体は、どのポーズでも埋まりに数えない', () => {
    const wall: Cling = { kind: 'wall', nx: 0, nz: -1 };
    for (const p of ALL) {
      expect(embedded(level, at([0, 0.8, 4.8], p.id, 0, wall)), `壁 ${p.id}`).toBe(false);
      expect(embedded(level, at([0, 3, 0], p.id, 1.2, { kind: 'ceiling' })), `天井 ${p.id}`).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/embed.test.ts`
Expected: FAIL（`./embed` が無い）。

- [ ] **Step 3: 書く**

`src/lib/games/yappari-chameleon/embed.ts`:

```ts
import type { V3 } from '$lib/sculpt';
import type { Box, Level } from './move';
import type { Me } from './net';
import { poseById } from './poses';
import { capsules, placement } from './shots';

const inside = (p: V3, b: Box) =>
  p[0] > b.min[0] && p[0] < b.max[0] && p[1] > b.min[1] && p[1] < b.max[1] && p[2] > b.min[2] && p[2] < b.max[2];

/**
 * 体が物に深く埋まっている。頭の中心か、胴の 3 つの円すいの軸の真ん中が、家具まで含めた屋敷の箱の中にある。
 * 張り付いている体は調べない。張り付きは体を面にぴったり付ける置き方で、寝そべるなどのポーズでは胴が張り付いた面の箱へ入るが、
 * それは面に沿わせた形で、警告すると遊べるポーズが減るだけになる
 */
export function embedded(lv: Level, b: Pick<Me, 'pos' | 'yaw' | 'cling' | 'pose'>): boolean {
  if (b.cling) return false;
  const c = capsules(poseById(b.pose), placement(b));
  const points: V3[] = [
    c[0].a,
    ...c.slice(1, 4).map((k): V3 => [(k.a[0] + k.b[0]) / 2, (k.a[1] + k.b[1]) / 2, (k.a[2] + k.b[2]) / 2])
  ];
  return points.some((p) => lv.boxes.some((box) => inside(p, box)));
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/embed.test.ts`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Tell when a hider's head or torso sits inside the mansion's boxes"
```

---

### Task 5: ロビーの部屋と HUNTER の台

**Files:**

- Create（リポジトリに入れない）: `<scratchpad>/perf-chameleon.mjs`、`<scratchpad>/perf-2a.json`
- Create: `src/lib/games/yappari-chameleon/mansion/lobby.ts`
- Create: `src/lib/games/yappari-chameleon/mansion/shapes.ts`（`furniture.ts` の部品を移す）
- Create: `src/lib/games/yappari-chameleon/mansion/room-furniture.ts`
- Create: `src/lib/games/yappari-chameleon/textures-rooms.ts`
- Create: `src/lib/games/yappari-chameleon/rng.ts`（`textures.ts` の `rng` を移す）
- Modify: `src/lib/games/yappari-chameleon/mansion/layout.ts`、`mansion/furniture.ts`、`mansion/build.ts`、`textures.ts`、`effects.ts`、`world3d.ts`
- Test: `src/lib/games/yappari-chameleon/mansion/lobby.test.ts`、`mansion/layout.test.ts`

**Interfaces:**

- Produces: `LOBBY`（`{ min: [-8, 0, -68], max: [8, 6, -52] }`）、`PODIUM`（`{ at: [0, 0, -60], r: 1.2, h: 0.3 }`）、`lobbySlabs()`、`podiumBoxes(): Box[]`、`lobbyPieces()`、`lobbyLights()`、`LOBBY_SPAWNS`、`onPodium(b: { pos: V3; cling: Cling | null }): boolean`。
- Produces: `layout.ts` の `Mat` に `'splash'`、`Kind` に `'podium' | 'pedestal'`、`export interface Light`、`Mansion.solids: Box[]`（見えない当たり。殻に入れない）、`SPAWNS.lobby`。
- Produces: `World.podium(on: boolean)`、`Built.glow?: (on: boolean) => void`。`shapes.ts` の `box`・`cyl`・`ball`・`plane`・`variant`・`BLACK`・`GOLD`・`WHITE`・`WOOD`・`type Maker`。`textures.ts` の `make` を export。`rng.ts` の `rng`。

ロビーは屋敷（z −7〜17）と控室（z −32〜−28）から離した z −68〜−52 に置き、壁でほかの部屋が見えないようにする。日の影（`world3d.ts` の向きのある光）は屋敷だけを覆い、ロビーと控室は点光源と空の光で照らす。台は円の形で描き、当たりは乗れる高さ（`move.ts` の `STEP` と同じ 0.3m）の箱 3 つを重ねた八角形にする。

- [ ] **Step 1: 2a の描く重さを測っておく**

屋敷の部品を足す前に、今の 2a の重さを控える（Task 18 で比べる）。

Run（裏で）: `pnpm dev --port 5180`
Expected: `http://localhost:5180/asobibako/` が開ける。

`<scratchpad>/perf-chameleon.mjs`:

```js
// 実行: node <scratchpad>/perf-chameleon.mjs <repo の絶対パス> <書き出す json>
// ひとりで試すをフリーカメラにして、部屋ごとの視点で 1 コマに描く回数・三角形・点光源の数・1 コマの時間を測る。
// dev サーバーは 5180 で起動しておく。2a の屋敷に無い部屋の視点は、何も無い所を見るだけになる
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const [repo, out] = process.argv.slice(2);
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');
const PI = Math.PI;
const VIEWS = [
  ['lobby', [0, 0, -65], 0, 0.1],
  ['hall', [0, 0, 0.6], 0, -0.15],
  ['corridor', [-7.5, 0, 5], -PI / 2, 0],
  ['study', [7.6, 0, 6], PI / 2, 0],
  ['kitchen', [-16, 0, 7.6], 0, 0],
  ['laundry', [-15, 0, 2.6], PI, 0]
];
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5180/asobibako/games/yappari-chameleon', { waitUntil: 'networkidle' });
// ハイドレートが済むまで押しても拾われない
await page.waitForTimeout(1500);
await page.locator('button.solo').click();
await page.waitForFunction(() => !!window.__chameleon, null, { timeout: 120000 });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const p = window.__chameleon;
  if (p.mode !== 'eye') p.toggleEye();
});
const rows = [];
for (const [name, pos, yaw, pitch] of VIEWS) {
  await page.evaluate(
    ([pos, yaw, pitch]) => {
      const p = window.__chameleon;
      p.ghost = { pos: [...pos], vy: 0, yaw: 0, ground: true, cling: null };
      p.eyeYaw = yaw;
      p.eyePitch = pitch;
    },
    [pos, yaw, pitch]
  );
  await page.waitForTimeout(600);
  rows.push(
    await page.evaluate(async (name) => {
      const w = window.__chameleon.world;
      const frame = () => new Promise((r) => requestAnimationFrame(r));
      // 描画のループの rAF のあとで読むので、info はそのコマの数（影を描く分も入る）
      await frame();
      const { calls, triangles } = w.renderer.info.render;
      let lights = 0;
      w.scene.traverse((o) => {
        if (o.isPointLight) lights++;
      });
      const t0 = performance.now();
      for (let i = 0; i < 120; i++) await frame();
      return { name, calls, triangles, lights, ms: (performance.now() - t0) / 120 };
    }, name)
  );
}
await browser.close();
await writeFile(out, JSON.stringify(rows, null, 2));
console.log(JSON.stringify(rows));
```

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/perf-2a.json`
Expected: 6 行の数を出す（`hall` と `corridor` の `calls` は数百。`lights` は 9）。`<scratchpad>/perf-2a.json` は Task 18 で使う。

- [ ] **Step 2: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/mansion/lobby.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { idle, newBody, step, type Body, type Level } from '../move';
import { levelOf, mansion, SPAWNS } from './layout';
import { LOBBY, onPodium, PODIUM } from './lobby';

const lv: Level = levelOf(mansion());

function walk(b: Body, x: number, z: number) {
  for (let t = 0; t < 30; t += 1 / 60) {
    const dx = x - b.pos[0];
    const dz = z - b.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    step(b, { ...idle(), x: dx / Math.max(d, 1), z: dz / Math.max(d, 1) }, lv, 1 / 60);
  }
}

const settle = (b: Body) => {
  for (let i = 0; i < 60; i++) step(b, idle(), lv, 1 / 60);
};

describe('ロビーの部屋', () => {
  it('始める場所から台へ歩くと、台の上面に上がってハンター希望になる', () => {
    const b = newBody(SPAWNS.lobby[1]);
    settle(b);
    expect(onPodium(b)).toBe(false);
    walk(b, PODIUM.at[0], PODIUM.at[2]);
    expect(b.pos[1]).toBeCloseTo(PODIUM.h, 3);
    expect(onPodium(b)).toBe(true);
  });

  it('台の縁に半分だけ乗った人（上面に立っていても中心が円の外）はハンター希望にならない', () => {
    const edge = newBody([PODIUM.at[0] + 1.3, 0, PODIUM.at[2]]);
    settle(edge);
    expect(edge.pos[1]).toBeCloseTo(PODIUM.h, 3);
    expect(onPodium(edge)).toBe(false);
    const inner = newBody([PODIUM.at[0] + 1.1, 0, PODIUM.at[2]]);
    settle(inner);
    expect(onPodium(inner)).toBe(true);
  });

  it('跳んでいる最中も台の上なら希望のまま、張り付いていたら外す', () => {
    const [cx, , cz] = PODIUM.at;
    expect(onPodium({ pos: [cx, 1.2, cz], cling: null })).toBe(true);
    expect(onPodium({ pos: [cx, 0, cz + 3], cling: null })).toBe(false);
    expect(onPodium({ pos: [cx, 1.2, cz], cling: { kind: 'ceiling' } })).toBe(false);
  });

  it('ロビーからは出られず、壁を上っても天井に張り付くだけ', () => {
    const b = newBody(SPAWNS.lobby[2]);
    settle(b);
    walk(b, 0, 0);
    expect(b.pos[2]).toBeLessThan(LOBBY.max[2]);
    walk(b, -20, -60);
    expect(b.pos[0]).toBeGreaterThan(LOBBY.min[0]);
    step(b, { ...idle(), jump: true }, lv, 1 / 60);
    expect(b.cling?.kind).toBe('wall');
    for (let i = 0; i < 60 * 8; i++) step(b, { ...idle(), up: true }, lv, 1 / 60);
    expect(b.cling).toEqual({ kind: 'ceiling' });
    expect(b.pos[1]).toBeCloseTo(LOBBY.max[1], 2);
  });

  it('ロビーの壁はカメラの殻に入り、台の当たりは入らない', () => {
    const shell = lv.shell ?? [];
    expect(shell.some((b) => b.min[2] === LOBBY.min[2] - 0.3 && b.max[2] === LOBBY.min[2])).toBe(true);
    expect(shell.some((b) => b.max[1] === PODIUM.h)).toBe(false);
  });
});
```

`mansion/layout.test.ts` の import に `import { LOBBY } from './lobby';` を足し、「家具はどれも大広間か緑の廊下の中にある」を次にする。

```ts
it('家具はどれも大広間か緑の廊下かロビーの中にある', () => {
  for (const p of m.pieces) {
    const [x, , z] = p.at;
    const hall = x >= -7 && x <= 7 && z >= 0 && z <= 12;
    const corridor = x >= -23 && x <= -7 && z >= 3.25 && z <= 6.75;
    const lobby = x >= LOBBY.min[0] && x <= LOBBY.max[0] && z >= LOBBY.min[2] && z <= LOBBY.max[2];
    expect(hall || corridor || lobby, `${p.kind} ${p.at}`).toBe(true);
  }
});
```

同じファイルの「始める場所はどれも当たりの箱に入らず」の `for (const where of ['hall', 'room', 'entrance'] as const)` を `for (const where of ['hall', 'room', 'entrance', 'lobby'] as const)` にする。

- [ ] **Step 3: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion`
Expected: FAIL（`./lobby` が無い、`SPAWNS.lobby` が無い）。

- [ ] **Step 4: ロビーの並びと当たりを書く**

`src/lib/games/yappari-chameleon/mansion/lobby.ts`:

```ts
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import type { Box, Cling } from '../move';
import type { Light, Piece, Slab } from './layout';

/** 屋敷と控室から離した 16m 四方・高さ 6m のロビー。出口は無い */
export const LOBBY = { min: [-8, 0, -68] as V3, max: [8, 6, -52] as V3 };
/** まん中の赤い丸い台。乗るとハンター希望になる */
export const PODIUM = { at: [0, 0, -60] as V3, r: 1.2, h: 0.3 };
const T = 0.3;

export function lobbySlabs(): Slab[] {
  const [x0, , z0] = LOBBY.min;
  const [x1, h, z1] = LOBBY.max;
  return [
    { min: [x0, -1, z0], max: [x1, 0, z1], mat: 'checker', face: 'y+' },
    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'white', face: 'y-' },
    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'splash', face: 'z+' },
    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'splash', face: 'z-' },
    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'splash', face: 'x+' },
    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'splash', face: 'x-' }
  ];
}

/** 丸い台の当たり。乗れる高さ（STEP と同じ）の箱を 3 つ重ねて、半径 1.2m の円に近い八角形にする */
export function podiumBoxes(): Box[] {
  const [cx, , cz] = PODIUM.at;
  return [
    [1.2, 0.5],
    [0.5, 1.2],
    [0.85, 0.85]
  ].map(([w, d]) => ({ min: [cx - w, 0, cz - d], max: [cx + w, PODIUM.h, cz + d] }));
}

export function lobbyPieces(): Piece[] {
  return [
    { kind: 'podium', at: PODIUM.at, turn: 0 },
    // 本家のロビーの端の水色の台（本家はこのそばでマップの設定を開く。こちらは画面のボタンで開く）
    { kind: 'pedestal', at: [6.6, 0, -66.6], turn: 0 }
  ];
}

export const lobbyLights = (): Light[] => [{ at: [0, 5.4, -60], color: '#ffffff', power: 40, reach: 20 }];

/** 台の南に並び、北（+z）の台を向いて出る */
export const LOBBY_SPAWNS: Record<Seat, V3> = { 1: [0, 0, -64.5], 2: [-1.5, 0, -64.5], 3: [1.5, 0, -64.5] };

/**
 * 台の上にいる。足もとが台の上面より上（跳んでいる最中も）で、体の中心が台の円の内側。
 * 体の円は縁から少しはみ出しても上面に立てるので、立っている高さではなく中心で決める
 */
export function onPodium(b: { pos: V3; cling: Cling | null }): boolean {
  const [x, y, z] = b.pos;
  const [cx, , cz] = PODIUM.at;
  return !b.cling && y >= PODIUM.h - 0.05 && Math.hypot(x - cx, z - cz) < PODIUM.r;
}
```

`mansion/layout.ts` を次のように変える。import に足す。

```ts
import { LOBBY_SPAWNS, lobbyLights, lobbyPieces, lobbySlabs, podiumBoxes } from './lobby';
```

`Mat` に `| 'splash'` を、`Kind` に `| 'podium' | 'pedestal'` を足し、`SIZES` に `podium: null,`（当たりは `solids` の八角形）と `pedestal: [0.9, 1.0, 0.9],` を足す。`Mansion` を次にする。

```ts
export interface Light {
  at: V3;
  color: string;
  power: number;
  reach: number;
}

export interface Mansion {
  slabs: Slab[];
  pieces: Piece[];
  ramps: Ramp[];
  spawn: V3;
  /** 見えない当たり（丸い台の八角形）。カメラの殻には入れない */
  solids: Box[];
  lights: Light[];
}
```

`SPAWNS` の型を `Record<'hall' | 'room' | 'entrance' | 'lobby', Record<Seat, V3>>` にし、最後に `lobby: LOBBY_SPAWNS` を足す。`mansion()` の `slabs` を `[...hall(), ...corridor(), ...room(), ...lobbySlabs()]`、`pieces` を `[...pieces(), ...lobbyPieces()]` にして（`all` もこの並び）、`solids: podiumBoxes(),` を足し、`lights` の最後に `...lobbyLights()` を足す。`levelOf` の `for (const q of m.pieces)` のループのあとに `boxes.push(...m.solids);` を足す。

- [ ] **Step 5: 乱数を共用の場所へ移す**

`src/lib/games/yappari-chameleon/rng.ts` に、`textures.ts` の `rng` をそのまま移す（コメントは「種から作る乱数。模様と小物の置き方を、開くたびと端末ごとに同じにする」にする）。`textures.ts` は `rng` の定義を消して `import { rng } from './rng';` を足し、`function make(` を `export function make(` にする。`effects.ts` の `import { rng } from './textures';` を `import { rng } from './rng';` にする。

- [ ] **Step 6: ロビーの模様を書く**

`src/lib/games/yappari-chameleon/textures-rooms.ts`:

```ts
import { rng } from './rng';
import { make, type Pattern } from './textures';

/**
 * ロビーの壁。白地に白いアーチの浮き彫り（影とハイライトの線）と、本家のロビーの赤・黄・緑・紫の大きなペンキのしぶき。
 * 1 枚が 8m × 6m で、線は 3cm 以上
 */
export function splashWall(): Pattern {
  return make('splash-wall', 1024, 768, [8, 6], (g) => {
    const r = rng(83);
    g.fillStyle = '#f4f2ee';
    g.fillRect(0, 0, 1024, 768);
    for (const cx of [256, 768]) {
      for (const [color, dx] of [
        ['rgb(0 0 0 / 0.14)', 4],
        ['rgb(255 255 255 / 0.95)', -4]
      ] as const) {
        g.strokeStyle = color;
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(cx - 200 + dx, 768);
        g.lineTo(cx - 200 + dx, 330);
        g.arc(cx + dx, 330, 200, Math.PI, 0);
        g.lineTo(cx + 200 + dx, 768);
        g.stroke();
      }
    }
    const colors = ['#e2262b', '#f6c21c', '#3fae3a', '#8a3fc4'];
    for (let i = 0; i < 9; i++) {
      const cx = r() * 1024;
      const cy = r() * 768;
      const big = 50 + r() * 90;
      g.fillStyle = colors[i % colors.length];
      g.beginPath();
      g.arc(cx, cy, big, 0, Math.PI * 2);
      g.fill();
      // まわりに飛んだ粒と、下へ垂れたしずく
      for (let k = 0; k < 14; k++) {
        const a = r() * Math.PI * 2;
        const d = big * (0.8 + r() * 0.9);
        g.beginPath();
        g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 8 + r() * big * 0.35, 0, Math.PI * 2);
        g.fill();
      }
      for (let k = 0; k < 3; k++) g.fillRect(cx - big * 0.5 + r() * big, cy, 10 + r() * 8, big * (0.8 + r() * 1.4));
    }
  });
}

/** ロビーの台の上面。赤地に白いペンキの筆の字で HUNTER。1 枚が台の差し渡し 2.4m で、字の線は 4cm 以上 */
export function hunterSign(): Pattern {
  return make('hunter-sign', 512, 512, [2.4, 2.4], (g) => {
    const r = rng(71);
    g.fillStyle = '#c8231e';
    g.fillRect(0, 0, 512, 512);
    g.font = 'bold 104px "Hiragino Mincho ProN", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    // 少しずつずらして重ね、太い筆でこすったように見せる
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = `rgb(255 255 255 / ${0.35 + i * 0.12})`;
      g.lineWidth = 14 - i * 2;
      g.strokeText('HUNTER', 256 + (r() - 0.5) * 8, 256 + (r() - 0.5) * 8);
    }
    g.fillStyle = '#ffffff';
    g.fillText('HUNTER', 256, 256);
    for (let i = 0; i < 18; i++) g.fillRect(70 + r() * 372, 290 + r() * 10, 9, 14 + r() * 40);
  });
}
```

- [ ] **Step 7: 家具の部品を分け、台を作る**

`src/lib/games/yappari-chameleon/mansion/shapes.ts` へ、`furniture.ts` の `BLACK`・`GOLD`・`WHITE`・`WOOD`・`box`・`cyl`・`ball`・`plane`・`variant` を中身を変えずに移して export し、`Maker` の型を足す。

```ts
import * as THREE from 'three';
import { finish, type Finish } from '../textures';
import type { Piece } from './layout';

export type Maker = (g: THREE.Group, p: Piece) => void;

export const BLACK: Finish = { tint: '#141414', rough: 0.15 };
export const GOLD: Finish = { tint: '#d4af37', metal: 1, rough: 0.3 };
export const WHITE: Finish = { tint: '#f1ece2', rough: 0.5 };
export const WOOD: Finish = { tint: '#4a2e1a', rough: 0.55 };

// ここに furniture.ts の box・cyl・ball・plane・variant を、export を付けてそのまま置く
```

（上のコメントの行は残さず、移した 5 つの関数に置き換える。）`furniture.ts` は移したものの定義を消し、`import { ball, BLACK, box, cyl, GOLD, plane, variant, WHITE, WOOD, type Maker } from './shapes';` と `import { ROOM_MAKERS } from './room-furniture';` を足し、`MAKERS` を `const MAKERS: Record<Piece['kind'], Maker> = { ...今の並び..., ...ROOM_MAKERS };` にする。

`src/lib/games/yappari-chameleon/mansion/room-furniture.ts`:

```ts
import * as THREE from 'three';
import { finish } from '../textures';
import { hunterSign } from '../textures-rooms';
import type { Kind } from './layout';
import { box, cyl, type Maker } from './shapes';

/** ロビーの赤い丸い台。上面に HUNTER、縁は乗っている人がいるあいだ光る輪（userData.glow を build が拾う） */
function podium(g: THREE.Group) {
  cyl(g, [1.2, 1.2], 0.3, { tint: '#c8231e', rough: 0.55 }, [0, 0.15, 0], 64);
  const top = new THREE.Mesh(
    new THREE.CircleGeometry(1.19, 64),
    finish({ pattern: hunterSign(), rough: 0.6 }, [2.4, 2.4])
  );
  // 南（始める場所の側）から北を向いて読める向きにする。円の上は −z へ向くので z まわりにも回す
  top.rotation.set(-Math.PI / 2, 0, Math.PI);
  top.position.y = 0.302;
  top.receiveShadow = true;
  g.add(top);
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.035, 10, 96),
    new THREE.MeshStandardMaterial({ color: '#ff5a3c', emissive: '#ff3b1f', emissiveIntensity: 0.15 })
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.3;
  rim.userData.glow = true;
  g.add(rim);
}

/** 本家のロビーの端の水色の台。上に丸いボタン */
function pedestal(g: THREE.Group) {
  box(g, [0.9, 0.9, 0.9], { tint: '#7fd1e8', rough: 0.4 }, [0, 0.45, 0]);
  cyl(g, [0.22, 0.24], 0.1, { tint: '#2f9ec7', rough: 0.3 }, [0, 0.95, 0]);
}

export const ROOM_MAKERS = { podium, pedestal } satisfies Partial<Record<Kind, Maker>>;
```

- [ ] **Step 8: 組み立てと台の光**

`mansion/build.ts` の import に `import { splashWall } from '../textures-rooms';` を足し、`LOOKS` に `splash: () => ({ pattern: splashWall(), rough: 0.85 }),` を足す。`buildMansion` の `return` を次にする。

```ts
const rims: THREE.MeshStandardMaterial[] = [];
group.traverse((o) => {
  if (o.userData.glow) rims.push((o as THREE.Mesh).material as THREE.MeshStandardMaterial);
});
return {
  group,
  level: levelOf(m),
  glow: (on) => {
    for (const r of rims) r.emissiveIntensity = on ? 2.4 : 0.15;
  }
};
```

`world3d.ts` の `Built` を次にし、`#stage` の下に `#built: Built | null = null;` を足して `setStage` の頭で `this.#built = b;` を入れ、`holdBrush` の下に `podium` を足す。

```ts
export interface Built {
  group: THREE.Group;
  level: Level;
  /** ロビーの台の縁を光らせる */
  glow?: (on: boolean) => void;
}
```

```ts
  /** 台に誰かが乗っているあいだ、台の縁を明るくする */
  podium(on: boolean): void {
    this.#built?.glow?.(on);
  }
```

- [ ] **Step 9: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 10: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Build the paint-splashed lobby room with the HUNTER podium"
```

---

### Task 6: 屋敷の 3 部屋の壁と戸口

**Files:**

- Create: `src/lib/games/yappari-chameleon/mansion/rooms.ts`
- Modify: `src/lib/games/yappari-chameleon/mansion/layout.ts`（戸口・面の裏・部屋の名前）、`mansion/build.ts`（面の裏の材質）、`textures-rooms.ts`、`world3d.ts`（日の影の範囲）
- Test: `src/lib/games/yappari-chameleon/mansion/rooms.test.ts`、`mansion/layout.test.ts`

**Interfaces:**

- Produces: `STUDY`（`{ min: [7.3, 0, 1], max: [17.3, 4, 11] }`）・`KITCHEN`（`{ min: [-21, 0, 7.05], max: [-11, 3.5, 15.05] }`）・`LAUNDRY`（`{ min: [-20, 0, -5.05], max: [-10, 3.5, 2.95] }`）・`DOOR_H = 2.4`・`DOORWAYS: Box[]`（戸口と両側 1.2m の通り道）・`roomSlabs()`・`roomPieces()`・`roomLights()`。
- Produces: `Slab.back?: Mat`（面の裏の材質。大広間と廊下の壁の裏が部屋の壁になる）、`Mat` に `'planks' | 'whiteTile' | 'blueHex' | 'brick'`、`PLACES` と `placeOf(p: V3): string`。

部屋は 3 枚の壁と床と天井を `rooms.ts` が持ち、戸口のある 1 枚は大広間（東）と廊下（北・南）の壁を戸口で分けたものの裏を使う。床は戸口の下を通るよう、壁の厚み（0.3m）の下まで伸ばす。

| 部屋         | 中（床の上）              | 高さ | 戸口                           | 床                   | 壁            | 天井        | 明かり        |
| ------------ | ------------------------- | ---- | ------------------------------ | -------------------- | ------------- | ----------- | ------------- |
| 書斎・図書室 | x 7.3〜17.3、z 1〜11      | 4m   | 大広間の東の壁、z 5.25〜6.75   | `planks`（茶色の木） | `woodPanel`   | `coffer`    | 暖色 1 個     |
| キッチン     | x −21〜−11、z 7.05〜15.05 | 3.5m | 廊下の北の壁、x −16.75〜−15.25 | `blueHex`            | `whiteTile`   | `white`     | 白 1 個       |
| ランドリー   | x −20〜−10、z −5.05〜2.95 | 3.5m | 廊下の南の壁、x −15.75〜−14.25 | `checker`（白黒）    | `brick`（赤） | `woodPanel` | 少し暗い 1 個 |

廊下の北の壁の油絵は、キッチンの戸口の横に寄りすぎるので x −17.5 から −19 へ移す。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/mansion/rooms.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { idle, newBody, step, type Body, type Level } from '../move';
import { levelOf, mansion, placeOf } from './layout';
import { LOBBY } from './lobby';
import { KITCHEN, LAUNDRY, STUDY } from './rooms';

const m = mansion();
const lv: Level = levelOf(m);

function walk(b: Body, x: number, z: number) {
  for (let t = 0; t < 30; t += 1 / 60) {
    const dx = x - b.pos[0];
    const dz = z - b.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    step(b, { ...idle(), x: dx / Math.max(d, 1), z: dz / Math.max(d, 1) }, lv, 1 / 60);
  }
}

const settle = (b: Body) => {
  for (let i = 0; i < 60; i++) step(b, idle(), lv, 1 / 60);
};

const inside = (p: V3, r: { min: V3; max: V3 }) =>
  p[0] >= r.min[0] && p[0] <= r.max[0] && p[2] >= r.min[2] && p[2] <= r.max[2];

describe('屋敷の 3 部屋', () => {
  it('大広間の東の戸口から書斎へ入れる', () => {
    const b = newBody([5, 0, 6]);
    settle(b);
    walk(b, 9, 6);
    expect(b.pos[0]).toBeGreaterThan(8.9);
    expect(b.pos[1]).toBeCloseTo(0, 3);
  });

  it('廊下の北の戸口からキッチンへ、南の戸口からランドリーへ入れる', () => {
    const k = newBody([-16, 0, 5]);
    settle(k);
    walk(k, -16, 9.5);
    expect(k.pos[2]).toBeGreaterThan(9.4);
    const l = newBody([-15, 0, 5]);
    settle(l);
    walk(l, -15, 0);
    expect(l.pos[2]).toBeLessThan(0.1);
  });

  it('戸口の横の壁は抜けられず、部屋の奥の壁から外へ出られない', () => {
    const b = newBody([-13, 0, 5]);
    settle(b);
    walk(b, -13, 9);
    expect(b.pos[2]).toBeLessThan(6.75);
    const k = newBody([-16, 0, 10]);
    settle(k);
    walk(k, -16, 30);
    expect(k.pos[2]).toBeLessThan(KITCHEN.max[2]);
    const s = newBody([12, 0, 3]);
    settle(s);
    walk(s, 30, 3);
    expect(s.pos[0]).toBeLessThan(STUDY.max[0]);
    const l = newBody([-15, 0, 0]);
    settle(l);
    walk(l, -15, -20);
    expect(l.pos[2]).toBeGreaterThan(LAUNDRY.min[2]);
  });

  it('戸口の上は 2.4m の高さでふさがっている（戸口の上へは跳んで抜けられない）', () => {
    const lintel = lv.boxes.filter((b) => b.min[1] === 2.4);
    expect(lintel.length).toBeGreaterThanOrEqual(3);
  });

  it('点光源は部屋ごとに 1〜2 個', () => {
    for (const r of [STUDY, KITCHEN, LAUNDRY, LOBBY]) {
      const n = m.lights.filter((l) => inside(l.at, r)).length;
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(2);
    }
  });

  it('部屋の名前', () => {
    expect(placeOf([0, 0, 5])).toBe('大広間');
    expect(placeOf([0, 3.5, 10.5])).toBe('2階の回廊');
    expect(placeOf([-15, 0, 5])).toBe('緑の廊下');
    expect(placeOf([12, 0, 6])).toBe('書斎');
    expect(placeOf([-16, 0, 10])).toBe('キッチン');
    expect(placeOf([-15, 0, -1])).toBe('ランドリー');
    expect(placeOf([0, 0, -60])).toBe('ロビー');
    expect(placeOf([0, 0, -30])).toBe('控室');
  });
});
```

`mansion/layout.test.ts` の「家具はどれも大広間か緑の廊下かロビーの中にある」を次にする（`LOBBY` の import は消す）。

```ts
it('家具はどれも名前のある部屋の中にある', () => {
  for (const p of m.pieces) expect(placeOf(p.at), `${p.kind} ${p.at}`).not.toBe('屋敷');
});
```

import に `placeOf` を足す。

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion`
Expected: FAIL（`./rooms` と `placeOf` が無い）。

- [ ] **Step 3: 部屋を書く**

`src/lib/games/yappari-chameleon/mansion/rooms.ts`:

```ts
import type { V3 } from '$lib/sculpt';
import type { Box } from '../move';
import type { Light, Piece, Slab } from './layout';

/** 部屋の中（床の上の空き） */
export const STUDY = { min: [7.3, 0, 1] as V3, max: [17.3, 4, 11] as V3 };
export const KITCHEN = { min: [-21, 0, 7.05] as V3, max: [-11, 3.5, 15.05] as V3 };
export const LAUNDRY = { min: [-20, 0, -5.05] as V3, max: [-10, 3.5, 2.95] as V3 };
/** 戸口の高さ。幅は 1.5m（大広間と廊下の戸口と同じ） */
export const DOOR_H = 2.4;
/**
 * 戸口と、その両側 1.2m の通り道。動く物を置かない（props.test.ts が見る）。
 * 大広間の西（廊下へ）・東（書斎へ）、廊下の北（キッチンへ）・南（ランドリーへ）
 */
export const DOORWAYS: Box[] = [
  { min: [-8.5, 0, 4.25], max: [-5.8, DOOR_H, 5.75] },
  { min: [5.8, 0, 5.25], max: [8.5, DOOR_H, 6.75] },
  { min: [-16.75, 0, 5.55], max: [-15.25, DOOR_H, 8.25] },
  { min: [-15.75, 0, 1.75], max: [-14.25, DOOR_H, 4.45] }
];
const T = 0.3;

/** 西の壁は大広間の東の壁の裏。床は戸口の下（x 7〜7.3）まで伸ばす */
function study(): Slab[] {
  const [x0, , z0] = STUDY.min;
  const [x1, h, z1] = STUDY.max;
  return [
    { min: [x0 - T, -1, z0], max: [x1, 0, z1], mat: 'planks', face: 'y+' },
    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'coffer', face: 'y-' },
    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'woodPanel', face: 'z+' },
    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'woodPanel', face: 'z-' },
    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'woodPanel', face: 'x-' }
  ];
}

/** 南の壁は廊下の北の壁の裏 */
function kitchen(): Slab[] {
  const [x0, , z0] = KITCHEN.min;
  const [x1, h, z1] = KITCHEN.max;
  return [
    { min: [x0, -1, z0 - T], max: [x1, 0, z1], mat: 'blueHex', face: 'y+' },
    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'white', face: 'y-' },
    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'whiteTile', face: 'z-' },
    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'whiteTile', face: 'x+' },
    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'whiteTile', face: 'x-' }
  ];
}

/** 北の壁は廊下の南の壁の裏 */
function laundry(): Slab[] {
  const [x0, , z0] = LAUNDRY.min;
  const [x1, h, z1] = LAUNDRY.max;
  return [
    { min: [x0, -1, z0], max: [x1, 0, z1 + T], mat: 'checker', face: 'y+' },
    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'woodPanel', face: 'y-' },
    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'brick', face: 'z+' },
    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'brick', face: 'x+' },
    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'brick', face: 'x-' }
  ];
}

export const roomSlabs = (): Slab[] => [...study(), ...kitchen(), ...laundry()];

const p = (kind: Piece['kind'], at: V3, turn: Piece['turn'] = 0, span?: number): Piece => ({ kind, at, turn, span });

/** 動かない家具。書斎は北と東の壁一面の本棚と、南の壁の額 2 枚 */
export function roomPieces(): Piece[] {
  return [
    ...Array.from({ length: 8 }, (_, k) => p('bookshelf', [7.9 + 1.2 * k, 0, 10.8], 2)),
    ...Array.from({ length: 7 }, (_, k) => p('bookshelf', [17.1, 0, 1.9 + 1.2 * k], 3)),
    p('painting', [11.5, 1.8, 1.0]),
    p('painting', [14.0, 1.8, 1.0])
  ];
}

/** 書斎は机の上のランプの暖色、キッチンは白い天井灯、ランドリーは少し暗め */
export const roomLights = (): Light[] => [
  { at: [12.3, 2.4, 6], color: '#ffd59a', power: 12, reach: 12 },
  // 天井のダクト（x −16.3〜−15.7）の中に入らないよう、少し東へ寄せる
  { at: [-14, 3.1, 11], color: '#f2f6ff', power: 16, reach: 13 },
  { at: [-15, 3.2, -1], color: '#ffe2c4', power: 7, reach: 11 }
];
```

`mansion/layout.ts` を次のように変える。import に `import { roomLights, roomPieces, roomSlabs } from './rooms';` を足す。`Mat` に `| 'planks' | 'whiteTile' | 'blueHex' | 'brick'` を足し、`Slab` に足す。

```ts
  /** 面の裏（face の向きの反対）の材質。大広間と廊下の壁の裏が、となりの部屋の壁になる */
  back?: Mat;
```

`hall()` の東の壁の 1 行（`{ min: [7, 0, 0], max: [7 + T, HALL_H, 12], ... }`）を、書斎への戸口を空けた 3 枚にする。

```ts
    { min: [7, 0, 0], max: [7 + T, HALL_H, 5.25], mat: 'woodPanel', face: 'x-', back: 'woodPanel' },
    { min: [7, 0, 6.75], max: [7 + T, HALL_H, 12], mat: 'woodPanel', face: 'x-', back: 'woodPanel' },
    { min: [7, 2.4, 5.25], max: [7 + T, HALL_H, 6.75], mat: 'woodPanel', face: 'x-', back: 'woodPanel' },
```

`corridor()` を次にする。

```ts
/** 北の壁にキッチンへ、南の壁にランドリーへの戸口。壁は腰板とダマスクの 2 段で、裏はとなりの部屋の壁 */
function corridor(): Slab[] {
  const x0 = -23;
  const x1 = -7;
  const wall = (z0: number, face: Face, back: Mat, door: [number, number]): Slab[] => [
    ...[
      [x0, door[0]],
      [door[1], x1]
    ].flatMap(([a, b]): Slab[] => [
      { min: [a, 0, z0], max: [b, 1, z0 + T], mat: 'wainscot', face, back },
      { min: [a, 1, z0], max: [b, CORR_H, z0 + T], mat: 'greenDamask', face, back }
    ]),
    { min: [door[0], 2.4, z0], max: [door[1], CORR_H, z0 + T], mat: 'greenDamask', face, back }
  ];
  return [
    { min: [x0, -1, 3.25], max: [x1, 0, 6.75], mat: 'checker', face: 'y+' },
    { min: [x0, CORR_H, 3.25], max: [x1, CORR_H + T, 6.75], mat: 'cream', face: 'y-' },
    ...wall(6.75, 'z-', 'whiteTile', [-16.75, -15.25]),
    ...wall(3.25 - T, 'z+', 'brick', [-15.75, -14.25]),
    { min: [x0 - T, 0, 3.25], max: [x0, 1, 6.75], mat: 'wainscot', face: 'x+' },
    { min: [x0 - T, 1, 3.25], max: [x0, CORR_H, 6.75], mat: 'greenDamask', face: 'x+' }
  ];
}
```

`pieces()` の `p('painting', [-17.5, 1.7, 6.75], 2),` を `p('painting', [-19, 1.7, 6.75], 2),` にする。`mansion()` の `slabs` を `[...hall(), ...corridor(), ...room(), ...roomSlabs(), ...lobbySlabs()]`、`all` を `[...pieces(), ...roomPieces(), ...lobbyPieces()]` にし、`lights` の `...lobbyLights()` の前に `...roomLights(),` を足す。ファイルの最後に足す。

```ts
/** 答え合わせの「見落とされた場所」に出す部屋の名前。上から順に調べる（回廊は大広間の中の 2 階） */
export const PLACES: { name: string; min: V3; max: V3 }[] = [
  { name: '2階の回廊', min: [-7, 3, 9], max: [7, 7, 12] },
  { name: '大広間', min: [-7, -1, 0], max: [7, 7, 12] },
  { name: '緑の廊下', min: [-23, -1, 3.25], max: [-7, 4, 6.75] },
  { name: '書斎', min: [7, -1, 1], max: [17.3, 4.3, 11] },
  { name: 'キッチン', min: [-21, -1, 6.75], max: [-11, 3.8, 15.05] },
  { name: 'ランドリー', min: [-20, -1, -5.05], max: [-10, 3.8, 3.25] },
  { name: '控室', min: [ROOM.min[0], -1, ROOM.min[2]], max: [ROOM.max[0], ROOM.max[1] + 0.3, ROOM.max[2]] },
  { name: 'ロビー', min: [LOBBY.min[0], -1, LOBBY.min[2]], max: [LOBBY.max[0], LOBBY.max[1] + 0.3, LOBBY.max[2]] }
];

export function placeOf(at: V3): string {
  const hit = PLACES.find(({ min, max }) => at.every((v, i) => v >= min[i] && v <= max[i]));
  return hit?.name ?? '屋敷';
}
```

（`LOBBY` は `./lobby` の import に足す。`ROOM` は同じファイルの上で定義しているので、`PLACES` は `ROOM` の定義より下に置く。）

- [ ] **Step 4: 部屋の模様と面の裏**

`textures-rooms.ts` の最後に足す。

```ts
/** 書斎の茶色の木の床。幅 15cm の板を長さ方向にずらして張る。継ぎ目と木目は 2cm 以上 */
export function planks(): Pattern {
  return make('planks', 512, 512, [1.2, 1.2], (g) => {
    const r = rng(89);
    for (let i = 0; i < 8; i++) {
      const y = i * 64;
      let x = -r() * 200;
      while (x < 512) {
        const len = 180 + r() * 160;
        g.fillStyle = `hsl(26 ${40 + r() * 10}% ${26 + r() * 8}%)`;
        g.fillRect(x, y, len, 64);
        g.strokeStyle = 'rgb(255 230 200 / 0.07)';
        g.lineWidth = 9;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.moveTo(x, y + 14 + k * 16);
          g.lineTo(x + len, y + 16 + k * 16);
          g.stroke();
        }
        g.strokeStyle = 'rgb(0 0 0 / 0.35)';
        g.strokeRect(x, y, len, 64);
        x += len;
      }
    }
  });
}

/** キッチンの白いタイルの壁。15cm 角に灰色の目地（2.3cm） */
export function whiteTile(): Pattern {
  return make('white-tile', 256, 256, [0.6, 0.6], (g) => {
    const r = rng(97);
    g.fillStyle = '#b9bcbf';
    g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = `hsl(200 8% ${92 + r() * 5}%)`;
        g.fillRect(x * 64 + 5, y * 64 + 5, 54, 54);
      }
  });
}

/**
 * キッチンの青い六角タイルの床。差し渡し 20cm、目地 2.3cm。縦にとがった六角を、横 √3R・縦 3R の周期で
 * 2 周期ぶん描いて継ぎ目なく繰り返す（横の周期は 0.7 画素ずれるが、目に見えない）
 */
export function blueHex(): Pattern {
  const R = 46;
  const w = Math.sqrt(3) * R;
  return make('blue-hex', 160, 276, [0.348, 0.6], (g) => {
    const r = rng(101);
    g.fillStyle = '#e8eef2';
    g.fillRect(0, 0, 160, 276);
    for (let k = -1; k <= 4; k++)
      for (let i = -1; i <= 3; i++) {
        const cx = i * w + (k % 2 ? w / 2 : 0);
        const cy = k * 1.5 * R;
        g.fillStyle = `hsl(208 ${55 + r() * 15}% ${38 + r() * 10}%)`;
        g.beginPath();
        for (let s = 0; s < 6; s++) {
          const a = Math.PI / 6 + (s * Math.PI) / 3;
          g.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
        }
        g.fill();
      }
  });
}

/** ランドリーの赤いれんがの壁。25 × 7cm のれんがを半分ずつずらして積み、目地は 2cm */
export function brick(): Pattern {
  return make('brick', 256, 256, [1.08, 1.08], (g) => {
    const r = rng(103);
    g.fillStyle = '#8f8379';
    g.fillRect(0, 0, 256, 256);
    const course = 256 / 12;
    for (let j = 0; j < 12; j++)
      for (let i = -1; i <= 4; i++) {
        const x = i * 64 + (j % 2 ? 32 : 0);
        g.fillStyle = `hsl(${4 + r() * 10} ${55 + r() * 15}% ${32 + r() * 10}%)`;
        g.fillRect(x + 2.5, j * course + 2.5, 59, course - 5);
      }
  });
}
```

`mansion/build.ts` の import を `import { blueHex, brick, planks, splashWall, whiteTile } from '../textures-rooms';` にし、`LOOKS` に足す。

```ts
  planks: () => ({ pattern: planks(), rough: 0.55 }),
  whiteTile: () => ({ pattern: whiteTile(), rough: 0.3 }),
  blueHex: () => ({ pattern: blueHex(), rough: 0.35 }),
  brick: () => ({ pattern: brick(), rough: 0.9 }),
```

`ORDER` の下に足し、`slab()` の `mats` を次にする。

```ts
const OPPOSITE: Record<Face, Face> = { 'x+': 'x-', 'x-': 'x+', 'y+': 'y-', 'y-': 'y+', 'z+': 'z-', 'z-': 'z+' };
```

```ts
const look = (f: Face) =>
  f === s.face
    ? finish(LOOKS[s.mat](), faceSize(f))
    : s.back && f === OPPOSITE[s.face]
      ? finish(LOOKS[s.back](), faceSize(f))
      : plain;
const mats = ORDER.map(look);
```

- [ ] **Step 5: 日の影を 3 部屋まで広げる**

`world3d.ts` のコンストラクタの向きのある光を次にする（屋敷は x −24〜18、z −7〜17 になる）。

```ts
const top = new THREE.DirectionalLight('#fff1dc', 1.6);
// 屋敷の全体（x −24〜18、z −7〜17）を 1 枚の影で覆う。ロビーと控室は外れ、点光源と空の光だけで照らす
top.position.set(-3, 20, 5);
top.target.position.set(-3, 0, 5);
top.castShadow = true;
top.shadow.mapSize.set(2048, 2048);
top.shadow.camera.left = -21;
top.shadow.camera.right = 21;
top.shadow.camera.top = 12;
top.shadow.camera.bottom = -12;
```

（`near`・`far`・`bias`・`normalBias` の行と、そのコメントはそのまま残す。）

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（「大広間から出入口を通って、緑の廊下の奥の本棚の前まで歩ける」「カメラの殻は部屋の壁を含み」も、分けた壁で通る）。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Open doorways to a study, a kitchen and a laundry room"
```

---

### Task 7: 3 部屋の家具

**Files:**

- Modify: `src/lib/games/yappari-chameleon/mansion/layout.ts`（家具の種類と当たりの大きさ）、`mansion/rooms.ts`（動かない家具）、`mansion/room-furniture.ts`（形）
- Test: `src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

**Interfaces:**

- Produces: `Kind` に `'post' | 'desk' | 'globe' | 'bust' | 'folding-chair' | 'book-pile' | 'counter' | 'sink' | 'plates' | 'meat-rack' | 'gas' | 'duct' | 'caution' | 'box' | 'bucket' | 'washer' | 'clothesline' | 'towels' | 'cart'`。このうち `folding-chair`・`book-pile`・`box`・`bucket`・`towels`・`cart` は Task 8 の動く物で、ここでは形と当たりの大きさだけを作る。

| 種類              | 当たり（幅 × 高さ × 奥行、m） | 部屋                 | 形                                         |
| ----------------- | ----------------------------- | -------------------- | ------------------------------------------ |
| `post`            | 0.35 × 4 × 0.35               | 書斎                 | 天井までの木の柱                           |
| `desk`            | 1.6 × 0.76 × 0.8              | 書斎                 | 両袖の机と緑の笠のバンカーズランプ         |
| `globe`           | 0.6 × 1.1 × 0.6               | 書斎                 | 木の台と青い球と真鍮の輪                   |
| `bust`            | 0.45 × 1.6 × 0.45             | 書斎                 | 大理石の台と白い胸像                       |
| `folding-chair`   | 0.45 × 0.85 × 0.45            | 書斎                 | 脚を交差させた折りたたみ椅子               |
| `book-pile`       | 0.4 × 0.35 × 0.3              | 書斎                 | ずらして積んだ本 4 冊                      |
| `counter`・`sink` | 2.0 × 0.9 × 0.7               | キッチン             | ステンレスの台（シンクは流しと蛇口つき）   |
| `plates`          | なし                          | キッチン             | 台の上に積み上げた皿                       |
| `meat-rack`       | 1.6 × 2.0 × 0.5               | キッチン             | 金網の棚に並べた肉と、上の棒から吊るした肉 |
| `gas`             | 0.35 × 1.1 × 0.35             | キッチン             | ガスボンベ                                 |
| `duct`            | なし                          | キッチン             | 天井の銀色のダクト（6m）                   |
| `caution`         | なし                          | キッチン             | 島の台のまわりの床の黄色の注意線           |
| `box`             | 0.6 × 0.45 × 0.45             | キッチン             | 段ボール箱                                 |
| `bucket`          | 0.3 × 0.3 × 0.3               | キッチン・ランドリー | バケツ                                     |
| `washer`          | 0.65 × 0.85 × 0.65            | ランドリー           | 赤と黄色のドラム式洗濯機                   |
| `clothesline`     | なし                          | ランドリー           | 洗濯ひもに吊るした服                       |
| `towels`          | 0.5 × 0.5 × 0.4               | ランドリー           | たたんだタオルの山（白・青・黄）           |
| `cart`            | 0.8 × 0.9 × 0.55              | ランドリー           | 青い洗濯カート                             |

- [ ] **Step 1: 落ちるテストを書く**

`mansion/rooms.test.ts` の import に `import type { Box } from '../move';`、`import { SIZES, type Piece } from './layout';`、`import { DOORWAYS, roomPieces } from './rooms';` を足し（`KITCHEN`・`LAUNDRY`・`STUDY` の import と同じ行にまとめる）、`describe('屋敷の 3 部屋', ...)` の最後に足す。

```ts
const boxOf = (q: Piece): Box | null => {
  const s = SIZES[q.kind];
  if (!s) return null;
  const [w, h, d] = q.turn % 2 ? [s[2], s[1], s[0]] : s;
  return { min: [q.at[0] - w / 2, q.at[1], q.at[2] - d / 2], max: [q.at[0] + w / 2, q.at[1] + h, q.at[2] + d / 2] };
};
// 並べた本棚のようにぴったり付いた箱は重なりに数えない
const hits = (a: Box, b: Box) => [0, 1, 2].every((i) => a.min[i] < b.max[i] - 1e-6 && b.min[i] < a.max[i] - 1e-6);

it('3 部屋の動かない家具は、戸口の通り道をふさがず、互いに重ならない', () => {
  const boxes = roomPieces()
    .map(boxOf)
    .filter((b): b is Box => b !== null);
  for (const [i, a] of boxes.entries()) {
    for (const door of DOORWAYS) expect(hits(a, door), `${a.min}`).toBe(false);
    for (const b of boxes.slice(i + 1)) expect(hits(a, b), `${a.min} と ${b.min}`).toBe(false);
  }
});

it('本家の画面にある家具がそろう', () => {
  const kinds = (name: string) =>
    new Set(
      roomPieces()
        .filter((q) => placeOf(q.at) === name)
        .map((q) => q.kind)
    );
  expect([...kinds('書斎')]).toEqual(
    expect.arrayContaining(['bookshelf', 'desk', 'globe', 'bust', 'post', 'painting'])
  );
  expect([...kinds('キッチン')]).toEqual(
    expect.arrayContaining(['counter', 'sink', 'plates', 'meat-rack', 'gas', 'duct', 'caution'])
  );
  expect([...kinds('ランドリー')]).toEqual(expect.arrayContaining(['washer', 'clothesline']));
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/rooms.test.ts`
Expected: 「本家の画面にある家具がそろう」が FAIL。

- [ ] **Step 3: 種類と当たりを足す**

`mansion/layout.ts` の `Kind` に上の表の 19 種を足し、`SIZES` に足す。

```ts
  post: [0.35, 4, 0.35],
  desk: [1.6, 0.76, 0.8],
  globe: [0.6, 1.1, 0.6],
  bust: [0.45, 1.6, 0.45],
  'folding-chair': [0.45, 0.85, 0.45],
  'book-pile': [0.4, 0.35, 0.3],
  counter: [2.0, 0.9, 0.7],
  sink: [2.0, 0.9, 0.7],
  plates: null,
  'meat-rack': [1.6, 2.0, 0.5],
  gas: [0.35, 1.1, 0.35],
  duct: null,
  caution: null,
  box: [0.6, 0.45, 0.45],
  bucket: [0.3, 0.3, 0.3],
  washer: [0.65, 0.85, 0.65],
  clothesline: null,
  towels: [0.5, 0.5, 0.4],
  cart: [0.8, 0.9, 0.55],
```

`mansion/rooms.ts` の `roomPieces()` の並びの最後（2 枚めの額のあと）に足す。

```ts
    ...(
      [
        [10, 3.5],
        [14.5, 3.5],
        [10, 8.3],
        [14.5, 8.3]
      ] as const
    ).map(([x, z]) => p('post', [x, 0, z])),
    p('desk', [12.25, 0, 6]),
    p('globe', [15.8, 0, 2.2]),
    p('bust', [8.2, 0, 1.7]),
    // キッチン。北の壁に台とシンク、まん中に島の台、西の壁に肉の棚
    p('counter', [-19.9, 0, 14.7], 2),
    p('counter', [-17.9, 0, 14.7], 2),
    p('sink', [-15.9, 0, 14.7], 2),
    p('counter', [-15, 0, 10.8], 1),
    p('plates', [-15, 0.9, 10.4]),
    p('plates', [-17.9, 0.9, 14.7]),
    p('meat-rack', [-20.75, 0, 10], 1),
    p('meat-rack', [-20.75, 0, 12.2], 1),
    p('gas', [-11.4, 0, 14.5]),
    p('gas', [-11.85, 0, 14.6]),
    p('duct', [-16, 3.2, 11]),
    p('caution', [-15, 0, 10.8]),
    // ランドリー。南と東の壁に洗濯機、部屋を横切る 2 本の洗濯ひも
    ...[-19.3, -18.5, -17.7, -16.9].map((x) => p('washer', [x, 0, -4.7])),
    p('washer', [-10.4, 0, -2.5], 3),
    p('washer', [-10.4, 0, -1.7], 3),
    p('clothesline', [-15, 2.3, -1.5], 0, 9),
    p('clothesline', [-15, 2.3, 0.5], 0, 9)
```

- [ ] **Step 4: 形を作る**

`mansion/room-furniture.ts` の import を次にする。

```ts
import * as THREE from 'three';
import { finish, marble, type Finish } from '../textures';
import { hunterSign } from '../textures-rooms';
import type { Kind, Piece } from './layout';
import { ball, box, cyl, plane, variant, WHITE, WOOD, type Maker } from './shapes';
```

`pedestal` の下に足す。

```ts
const STEEL: Finish = { tint: '#c9ced3', metal: 0.8, rough: 0.35 };
const IRON: Finish = { tint: '#3b3f43', metal: 0.6, rough: 0.5 };
const BRASS: Finish = { tint: '#b8933a', metal: 0.9, rough: 0.35 };

function post(g: THREE.Group) {
  box(g, [0.35, 4, 0.35], WOOD, [0, 2, 0]);
  box(g, [0.45, 0.12, 0.45], WOOD, [0, 0.06, 0]);
  box(g, [0.45, 0.12, 0.45], WOOD, [0, 3.94, 0]);
}

/** 両袖の机と、緑の笠のバンカーズランプ（笠は横に寝かせた半分の筒） */
function desk(g: THREE.Group) {
  box(g, [1.6, 0.05, 0.8], WOOD, [0, 0.735, 0]);
  for (const x of [-0.6, 0.6]) box(g, [0.36, 0.71, 0.72], WOOD, [x, 0.355, 0]);
  cyl(g, [0.07, 0.08], 0.02, BRASS, [0.35, 0.77, -0.15]);
  cyl(g, [0.012, 0.012], 0.32, BRASS, [0.35, 0.93, -0.15]);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.36, 24, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({
      color: '#1f6b3a',
      emissive: '#2f8a4a',
      emissiveIntensity: 0.25,
      roughness: 0.3,
      side: THREE.DoubleSide
    })
  );
  shade.rotation.z = Math.PI / 2;
  shade.position.set(0.35, 1.1, -0.15);
  g.add(shade);
}

function globe(g: THREE.Group) {
  cyl(g, [0.16, 0.22], 0.06, WOOD, [0, 0.03, 0]);
  cyl(g, [0.03, 0.04], 0.55, WOOD, [0, 0.33, 0]);
  ball(g, 0.25, { tint: '#2f6fa8', rough: 0.5 }, [0, 0.85, 0]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 8, 48), finish(BRASS, [1, 1]));
  ring.position.y = 0.85;
  ring.rotation.z = 0.41;
  g.add(ring);
  // 大陸は平たくした緑の球を球の面に貼る
  for (const [a, b, s] of [
    [0.3, 0.2, 0.09],
    [1.6, -0.3, 0.12],
    [2.7, 0.5, 0.08],
    [4.2, 0.1, 0.1],
    [5.3, -0.5, 0.07]
  ]) {
    const land = ball(g, s, { tint: '#5d9a43', rough: 0.6 }, [
      Math.cos(a) * Math.cos(b) * 0.245,
      0.85 + Math.sin(b) * 0.245,
      Math.sin(a) * Math.cos(b) * 0.245
    ]);
    land.scale.set(1, 1, 0.25);
    land.lookAt(0, 0.85, 0);
  }
}

function bust(g: THREE.Group) {
  const stone: Finish = { tint: '#e9e4da', rough: 0.4 };
  box(g, [0.45, 1.15, 0.45], { pattern: marble(), rough: 0.25 }, [0, 0.575, 0]);
  box(g, [0.38, 0.2, 0.22], stone, [0, 1.25, 0]);
  cyl(g, [0.06, 0.07], 0.1, stone, [0, 1.38, 0]);
  ball(g, 0.13, stone, [0, 1.5, 0]);
}

function foldingChair(g: THREE.Group) {
  const seat: Finish = { tint: '#6b4a2e', rough: 0.6 };
  box(g, [0.42, 0.04, 0.4], seat, [0, 0.46, 0]);
  box(g, [0.42, 0.22, 0.03], seat, [0, 0.74, -0.2]);
  for (const x of [-0.19, 0.19])
    for (const tilt of [0.35, -0.35]) box(g, [0.025, 0.9, 0.025], IRON, [x, 0.42, 0]).rotation.x = tilt;
}

function bookPile(g: THREE.Group, p: Piece) {
  const colors = ['#7a1f2b', '#2f4f6f', '#3e5b3a', '#b87333', '#d8c39a'];
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const h = 0.07 + (i % 2) * 0.02;
    const book = box(g, [0.36 - i * 0.03, h, 0.26 - i * 0.015], { tint: colors[(variant(p) + i) % 5], rough: 0.7 }, [
      0,
      y + h / 2,
      0
    ]);
    book.rotation.y = i % 2 ? 0.12 : -0.08;
    y += h;
  }
}

/** ステンレスの台。前（+z）に扉 2 枚 */
function counter(g: THREE.Group) {
  box(g, [2.0, 0.84, 0.7], STEEL, [0, 0.42, 0]);
  box(g, [2.02, 0.04, 0.72], STEEL, [0, 0.88, 0]);
  for (const x of [-0.5, 0.5]) box(g, [0.95, 0.7, 0.01], { tint: '#aeb4b9', metal: 0.8, rough: 0.3 }, [x, 0.45, 0.355]);
}

function sink(g: THREE.Group) {
  counter(g);
  box(g, [0.9, 0.02, 0.5], { tint: '#596066', metal: 0.8, rough: 0.25 }, [0, 0.905, 0]);
  cyl(g, [0.02, 0.02], 0.35, STEEL, [0, 1.07, -0.28]);
  cyl(g, [0.015, 0.015], 0.22, STEEL, [0, 1.24, -0.18]).rotation.x = Math.PI / 2;
}

function plates(g: THREE.Group) {
  for (const [x, n] of [
    [-0.18, 9],
    [0.12, 6]
  ])
    for (let i = 0; i < n; i++) cyl(g, [0.12, 0.1], 0.016, WHITE, [x, 0.008 + i * 0.018, 0], 24);
}

/** 金網の棚。前（+z）の段に肉を並べ、上の棒から肉を吊るす */
function meatRack(g: THREE.Group) {
  const meat: Finish = { tint: '#b8434a', rough: 0.6 };
  const fat: Finish = { tint: '#f1e2d4', rough: 0.7 };
  for (const x of [-0.78, 0.78]) for (const z of [-0.23, 0.23]) box(g, [0.04, 2.0, 0.04], IRON, [x, 1.0, z]);
  for (const y of [0.35, 0.95, 1.55]) box(g, [1.6, 0.03, 0.5], IRON, [0, y, 0]);
  box(g, [1.6, 0.04, 0.04], IRON, [0, 1.98, 0.23]);
  for (const y of [0.35, 0.95])
    for (let i = 0; i < 3; i++) {
      ball(g, 0.13, meat, [-0.5 + i * 0.5, y + 0.09, 0]).scale.set(1.4, 0.6, 1);
      ball(g, 0.05, fat, [-0.38 + i * 0.5, y + 0.1, 0.05]);
    }
  for (let i = 0; i < 4; i++) {
    const x = -0.6 + i * 0.4;
    cyl(g, [0.005, 0.005], 0.12, IRON, [x, 1.9, 0.23]);
    ball(g, 0.11, meat, [x, 1.72, 0.23]).scale.set(0.8, 1.5, 0.7);
  }
}

function gas(g: THREE.Group) {
  const can: Finish = { tint: '#9aa3a8', metal: 0.6, rough: 0.4 };
  cyl(g, [0.17, 0.17], 0.9, can, [0, 0.45, 0]);
  ball(g, 0.17, can, [0, 0.9, 0]).scale.y = 0.6;
  cyl(g, [0.03, 0.03], 0.12, IRON, [0, 1.04, 0]);
}

/** 天井のダクト。置いた向きの z へ 6m 伸びる。当たらない */
function duct(g: THREE.Group) {
  box(g, [0.6, 0.4, 6], { tint: '#b9bec3', metal: 0.7, rough: 0.4 }, [0, 0, 0]);
  for (let k = -2; k <= 2; k++)
    box(g, [0.64, 0.44, 0.05], { tint: '#9aa0a6', metal: 0.7, rough: 0.4 }, [0, 0, k * 1.4]);
}

/** 島の台のまわりの床の黄色の注意線（1.4 × 2.8 の枠）。当たらない */
function caution(g: THREE.Group) {
  const yellow: Finish = { tint: '#f2c200', rough: 0.6 };
  for (const [w, d, x, z] of [
    [1.4, 0.08, 0, -1.36],
    [1.4, 0.08, 0, 1.36],
    [0.08, 2.8, -0.66, 0],
    [0.08, 2.8, 0.66, 0]
  ])
    plane(g, [w, d], yellow, [x, 0.004, z], -Math.PI / 2);
}

function cardboard(g: THREE.Group) {
  box(g, [0.6, 0.45, 0.45], { tint: '#b98a53', rough: 0.9 }, [0, 0.225, 0]);
  box(g, [0.6, 0.005, 0.07], { tint: '#d9c08a', rough: 0.6 }, [0, 0.453, 0]);
}

function bucket(g: THREE.Group, p: Piece) {
  const tint = variant(p) % 2 ? '#3f7ec7' : '#d9473b';
  const side = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.12, 0.3, 24, 1, true),
    finish({ tint, rough: 0.5 }, [0.9, 0.3])
  );
  side.material.side = THREE.DoubleSide;
  side.position.y = 0.15;
  side.castShadow = side.receiveShadow = true;
  g.add(side);
  cyl(g, [0.12, 0.12], 0.01, { tint, rough: 0.5 }, [0, 0.005, 0]);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.006, 6, 24, Math.PI), finish(STEEL, [1, 1]));
  handle.position.y = 0.3;
  g.add(handle);
}

/** ドラム式洗濯機。並べたときに赤と黄色が交互になるよう、置いた場所から色を決める。前（+z）に丸い扉 */
function washer(g: THREE.Group, p: Piece) {
  const yellow = Math.abs(Math.round((p.at[0] + p.at[2]) / 0.8)) % 2 === 1;
  box(g, [0.65, 0.85, 0.65], { tint: yellow ? '#e9b81f' : '#c9302c', rough: 0.35 }, [0, 0.425, 0]);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.03, 10, 40),
    finish({ tint: '#d9dde0', metal: 0.7, rough: 0.3 }, [1, 1])
  );
  ring.position.set(0, 0.42, 0.326);
  g.add(ring);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.19, 32),
    finish({ tint: '#2a3a46', metal: 0.2, rough: 0.1 }, [0.4, 0.4])
  );
  glass.position.set(0, 0.42, 0.327);
  g.add(glass);
  box(g, [0.6, 0.08, 0.02], { tint: '#f1ece2', rough: 0.5 }, [0, 0.78, 0.33]);
}

/** 洗濯ひもと吊るした服。x の向きに span の長さで張る。当たらない */
function clothesline(g: THREE.Group, p: Piece) {
  const span = p.span ?? 8;
  const line = cyl(g, [0.008, 0.008], span, { tint: '#f4f1ea', rough: 0.8 }, [0, 0, 0], 6);
  line.rotation.z = Math.PI / 2;
  line.castShadow = false;
  const colors = ['#3a6ea5', '#e8e2d4', '#c94f4f', '#5b8c5a', '#d9a441', '#7b5ea7'];
  for (let i = 0, x = -span / 2 + 0.4; x < span / 2 - 0.3; i++, x += 0.62) {
    const tall = i % 3 === 1;
    const cloth = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, tall ? 0.8 : 0.55),
      finish({ tint: colors[(i + variant(p)) % colors.length], rough: 0.9 }, [0.42, 0.6])
    );
    cloth.material.side = THREE.DoubleSide;
    cloth.position.set(x, tall ? -0.4 : -0.28, 0);
    cloth.castShadow = true;
    g.add(cloth);
  }
}

/** たたんだタオルの山。置いた場所で白・青・黄の並びを変える */
function towels(g: THREE.Group, p: Piece) {
  const colors = ['#f4f1ea', '#3f7ec7', '#f2c94c'];
  for (let i = 0; i < 5; i++)
    box(g, [0.48 - (i % 2) * 0.02, 0.09, 0.38], { tint: colors[(variant(p) + i) % 3], rough: 0.95 }, [
      0,
      0.045 + i * 0.095,
      0
    ]);
}

/** 青い洗濯カート。上の開いた箱に脚と車輪 */
function cart(g: THREE.Group) {
  const blue: Finish = { tint: '#2f6fb8', rough: 0.5 };
  box(g, [0.8, 0.04, 0.55], blue, [0, 0.32, 0]);
  for (const z of [0.26, -0.26]) box(g, [0.8, 0.55, 0.03], blue, [0, 0.6, z]);
  for (const x of [0.385, -0.385]) box(g, [0.03, 0.55, 0.55], blue, [x, 0.6, 0]);
  for (const x of [-0.36, 0.36])
    for (const z of [-0.24, 0.24]) {
      box(g, [0.03, 0.3, 0.03], STEEL, [x, 0.17, z]);
      cyl(g, [0.04, 0.04], 0.03, { tint: '#222222', rough: 0.6 }, [x, 0.04, z], 12).rotation.x = Math.PI / 2;
    }
}
```

`ROOM_MAKERS` を次にする。

```ts
export const ROOM_MAKERS = {
  podium,
  pedestal,
  post,
  desk,
  globe,
  bust,
  'folding-chair': foldingChair,
  'book-pile': bookPile,
  counter,
  sink,
  plates,
  'meat-rack': meatRack,
  gas,
  duct,
  caution,
  box: cardboard,
  bucket,
  washer,
  clothesline,
  towels,
  cart
} satisfies Partial<Record<Kind, Maker>>;
```

（`shapes.ts` の `box`・`cyl`・`ball`・`plane` は作った Mesh を返すので、回す・縮めるはその戻り値に行う。）

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（書斎・キッチン・ランドリーへ歩くテストも、家具を置いたあとで通る）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Furnish the study, the kitchen and the laundry room"
```

---

### Task 8: 小物の置き方の乱数と額の絵柄

**Files:**

- Create: `src/lib/games/yappari-chameleon/mansion/props.ts`
- Modify: `src/lib/games/yappari-chameleon/mansion/layout.ts`（動く物を固定の並びから外し、`mansion(seed)` で置く）、`mansion/furniture.ts`（額の絵の面に印）、`mansion/build.ts`（動かす・差し替える）、`textures-rooms.ts`（額の絵 3 枚）、`world3d.ts`（`arrange`）
- Test: `src/lib/games/yappari-chameleon/mansion/props.test.ts`

**Interfaces:**

- Produces: `type Turn`、`interface Slot { at: V3; turn: Turn }`、`interface PropSet { units: Piece[][]; slots: Slot[] }`、`SETS: PropSet[]`、`place(slot, piece): Piece`、`arrange(seed: number | null): Slot[][]`、`propPieces(seed): Piece[]`、`ART = 4`、`artOf(seed, n): number[]`。
- Produces: `mansion(seed: number | null = null)`、`Mansion.moving: number`（`pieces` の最後の動く物の数）・`Mansion.arts: number[]`（額の絵柄、`pieces` の `painting` の順）。`Built.arrange?: (seed: number | null) => Level`、`World.arrange(seed)`。`artwork(k: number): Pattern`。

3D は作り直さない。動く物の部品の数と並びは種によらず同じにして、建てるときに全部作っておき、種が変わったら位置と向きだけを入れ替える（紹介の 3 秒に新しい形・材質・シェーダーを作らない）。額の絵は 4 つの絵柄の材質を先に作り、面の材質を差し替える。

置き場所の候補（部屋ごとに 12 組）。候補どうし・壁・動かない家具・戸口の通り道（`DOORWAYS`）・始める場所に重ならないよう、どの組み合わせでもかぶらない位置に選んである（計画を書くときに、同じ数の台本で全部の組み合わせを確かめた）。

| 部屋       | 動く物                                               | 候補（x, z, 向き）                                                           |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| 大広間     | 白い丸テーブルと椅子 4 脚、赤い丸テーブルと椅子 2 脚 | (−4, 2.5)・(−4.5, 7)・(4.5, 7.2)・(−3.8, 10.6)                               |
| 大広間     | 風船の束 2 つ                                        | (−6.2, 0.8)・(6.2, 11.2)・(6.2, 0.8)・(−6.3, 11.3)                           |
| 大広間     | 風船 3 つ                                            | (1.8, 1.2)・(2.4, 1.5)・(−1.5, 10.5)・(3.2, 10.8)・(−2.4, 0.9)・(5.6, 9.6)   |
| 緑の廊下   | ソファ、ベンチ                                       | (−14, 6.3, 2)・(−20, 3.7, 0)・(−10.5, 6.3, 2)・(−19.5, 6.3, 2)               |
| 緑の廊下   | 風船 3 つ                                            | (−12, 4)・(−12.5, 4.3)・(−18, 5.8)・(−9.6, 4)・(−21.8, 3.8)                  |
| 書斎       | 折りたたみ椅子 2 脚                                  | (12.25, 6.85, 2)・(12.25, 5.15, 0)・(9, 2.1, 1)・(16.2, 6, 3)・(8.6, 9.4, 1) |
| 書斎       | 本の山 3 つ                                          | (9.4, 10.2)・(13, 10.25)・(16.3, 10.1)・(11, 1.4)・(15, 4.6)                 |
| キッチン   | 段ボール箱 3 つ                                      | (−12, 9)・(−12, 10)・(−19.9, 13.6)・(−13, 8)・(−18.3, 8)                     |
| キッチン   | バケツ 2 つ                                          | (−13.6, 14.6)・(−20.4, 8)・(−12.6, 12.4)・(−18.2, 12)                        |
| ランドリー | タオルの山 3 つ                                      | (−11, −4.6)・(−11, −3.6)・(−13, −4.6)・(−19.5, 1)・(−13.5, 1.6)              |
| ランドリー | 洗濯カート                                           | (−12.5, −2, 1)・(−17, 0.5, 0)・(−18.6, −2.4, 1)                              |
| ランドリー | バケツ 2 つ                                          | (−16, −4.6)・(−10.6, 1.8)・(−19.6, −3.2)・(−14, −1)                          |

既定の置き方（種が null）は候補の頭から順に置く。大広間と廊下の既定は 2a の置き方と同じで、ソファは z 6.25 から 6.3 へ、ベンチは z 3.5 から 3.7 へ寄せる（ソファの候補とベンチの候補を入れ替えても壁に入らないように）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/mansion/props.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { idle, newBody, step, type Body, type Box, type Level } from '../move';
import { levelOf, mansion, SIZES, SPAWNS, type Piece } from './layout';
import { ART, arrange, artOf, place, propPieces, SETS } from './props';
import { DOORWAYS } from './rooms';

const boxOf = (q: Piece): Box | null => {
  const s = SIZES[q.kind];
  if (!s) return null;
  const [w, h, d] = q.turn % 2 ? [s[2], s[1], s[0]] : s;
  return { min: [q.at[0] - w / 2, q.at[1], q.at[2] - d / 2], max: [q.at[0] + w / 2, q.at[1] + h, q.at[2] + d / 2] };
};
const hits = (a: Box, b: Box) => [0, 1, 2].every((i) => a.min[i] < b.max[i] - 1e-6 && b.min[i] < a.max[i] - 1e-6);
const SEEDS = [null, ...Array.from({ length: 200 }, (_, i) => i + 1)];

/** 種の置き方で、動く物 1 つずつの当たりの箱（同じ物の部品はまとめる） */
function units(seed: number | null): Box[][] {
  const slots = arrange(seed);
  return SETS.flatMap((set, k) =>
    set.units.map((unit, i) => unit.map((q) => boxOf(place(slots[k][i], q))).filter((b): b is Box => b !== null))
  );
}

describe('小物の置き方', () => {
  it('同じ種は同じ置き方で、種によって置き方が変わる', () => {
    expect(arrange(7)).toEqual(arrange(7));
    expect(SEEDS.slice(1, 20).some((s) => JSON.stringify(arrange(s)) !== JSON.stringify(arrange(null)))).toBe(true);
  });

  it('既定の置き方は候補の頭から順に置き、どの組も候補の数より少なく置く', () => {
    const slots = arrange(null);
    SETS.forEach((set, k) => {
      expect(set.slots.length).toBeGreaterThan(set.units.length);
      expect(slots[k]).toEqual(set.slots.slice(0, set.units.length));
    });
  });

  it('1 つの組の中で同じ候補を 2 回使わない', () => {
    for (const seed of SEEDS)
      for (const chosen of arrange(seed)) expect(new Set(chosen).size, `${seed}`).toBe(chosen.length);
  });

  it('置いた物は、壁・動かない家具・戸口の通り道・始める場所・ほかの動く物に重ならない', () => {
    const m = mansion();
    const fixed = levelOf({ ...m, pieces: m.pieces.slice(0, m.pieces.length - m.moving) }).boxes;
    const spawns: Box[] = Object.values(SPAWNS).flatMap((row) =>
      Object.values(row).map((at): Box => ({
        min: [at[0] - 0.3, 0, at[2] - 0.3],
        max: [at[0] + 0.3, 1.15, at[2] + 0.3]
      }))
    );
    for (const seed of SEEDS) {
      const all = units(seed);
      for (const [i, unit] of all.entries())
        for (const a of unit) {
          for (const b of [...fixed, ...DOORWAYS, ...spawns])
            expect(hits(a, b), `${seed} ${a.min} と ${b.min}`).toBe(false);
          for (const other of all.slice(i + 1))
            for (const b of other) expect(hits(a, b), `${seed} ${a.min}`).toBe(false);
        }
    }
  });

  it('動く物の部品の数と並びは、種が変わっても同じ（3D は作り直さずに動かす）', () => {
    const kinds = (s: number | null) => propPieces(s).map((q) => q.kind);
    expect(kinds(1)).toEqual(kinds(null));
    expect(kinds(99)).toEqual(kinds(null));
    const m = mansion(5);
    expect(m.pieces.slice(m.pieces.length - m.moving)).toEqual(propPieces(5));
  });

  it('候補の向きで、物の中の位置も回す', () => {
    const q: Piece = { kind: 'chair', at: [0, 0, -0.9], turn: 0 };
    expect(place({ at: [1, 0, 1], turn: 1 }, q)).toMatchObject({ at: [1 - 0.9, 0, 1], turn: 1 });
    expect(place({ at: [1, 0, 1], turn: 2 }, q).at).toEqual([1, 0, 1.9]);
  });

  it('額の絵柄は種で決まり、既定は 0, 1, 2… の順', () => {
    expect(artOf(null, 3)).toEqual([0, 1, 2]);
    expect(artOf(5, 3)).toEqual(artOf(5, 3));
    for (const k of artOf(8, 20)) expect(k >= 0 && k < ART).toBe(true);
    expect(mansion(5).arts).toEqual(artOf(5, 3));
  });

  it('同じ種なら、端末ごとに作る当たりが同じ', () => {
    expect(JSON.stringify(levelOf(mansion(42)))).toBe(JSON.stringify(levelOf(mansion(42))));
  });

  it('どの置き方でも、戸口から 3 部屋の中ほどまで歩ける', () => {
    for (const seed of SEEDS.slice(0, 30)) {
      const lv: Level = levelOf(mansion(seed));
      const go = (from: [number, number, number], x: number, z: number): Body => {
        const b = newBody(from);
        for (let i = 0; i < 60; i++) step(b, idle(), lv, 1 / 60);
        for (let t = 0; t < 30; t += 1 / 60) {
          const dx = x - b.pos[0];
          const dz = z - b.pos[2];
          const d = Math.hypot(dx, dz);
          if (d < 0.05) break;
          step(b, { ...idle(), x: dx / Math.max(d, 1), z: dz / Math.max(d, 1) }, lv, 1 / 60);
        }
        return b;
      };
      expect(go([5, 0, 6], 9.5, 6).pos[0], `${seed} 書斎`).toBeGreaterThan(9.4);
      expect(go([-16, 0, 5], -16, 9.5).pos[2], `${seed} キッチン`).toBeGreaterThan(9.4);
      expect(go([-15, 0, 5], -15, 0).pos[2], `${seed} ランドリー`).toBeLessThan(0.1);
    }
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/props.test.ts`
Expected: FAIL（`./props` が無い）。

- [ ] **Step 3: 置き方を書く**

`src/lib/games/yappari-chameleon/mansion/props.ts`:

```ts
import type { V3 } from '$lib/sculpt';
import { rng } from '../rng';
import type { Piece } from './layout';

export type Turn = Piece['turn'];

export interface Slot {
  at: V3;
  turn: Turn;
}

/** 動く物の組。units の 1 つずつを slots のどれかに置く（slots は units より多い）。物の部品は候補から見た位置と向き */
export interface PropSet {
  units: Piece[][];
  slots: Slot[];
}

const P = (kind: Piece['kind'], at: V3 = [0, 0, 0], turn: Turn = 0): Piece => ({ kind, at, turn });
const S = (x: number, z: number, turn: Turn = 0): Slot => ({ at: [x, 0, z], turn });
const one = (kind: Piece['kind']): Piece[] => [P(kind)];
const WHITE_TABLE = [
  P('table-white'),
  P('chair', [0, 0, -0.9]),
  P('chair', [0, 0, 0.9], 2),
  P('chair', [-0.9, 0, 0], 1),
  P('chair', [0.9, 0, 0], 3)
];
const RED_TABLE = [P('table-red'), P('chair', [0, 0, -0.9]), P('chair', [0, 0, 0.9], 2)];

/**
 * 部屋ごとの動く物と置き場所の候補。候補どうし・壁や動かない家具・戸口の通り道（rooms.ts の DOORWAYS）・
 * 始める場所に重ならない位置に選んであり、どの組み合わせで置いてもかぶらない（props.test.ts が見る）
 */
export const SETS: PropSet[] = [
  { units: [WHITE_TABLE, RED_TABLE], slots: [S(-4, 2.5), S(-4.5, 7), S(4.5, 7.2), S(-3.8, 10.6)] },
  { units: [one('balloons'), one('balloons')], slots: [S(-6.2, 0.8), S(6.2, 11.2), S(6.2, 0.8), S(-6.3, 11.3)] },
  {
    units: [one('balloon'), one('balloon'), one('balloon')],
    slots: [S(1.8, 1.2), S(2.4, 1.5), S(-1.5, 10.5), S(3.2, 10.8), S(-2.4, 0.9), S(5.6, 9.6)]
  },
  { units: [one('sofa'), one('bench')], slots: [S(-14, 6.3, 2), S(-20, 3.7), S(-10.5, 6.3, 2), S(-19.5, 6.3, 2)] },
  {
    units: [one('balloon'), one('balloon'), one('balloon')],
    slots: [S(-12, 4), S(-12.5, 4.3), S(-18, 5.8), S(-9.6, 4), S(-21.8, 3.8)]
  },
  {
    units: [one('folding-chair'), one('folding-chair')],
    slots: [S(12.25, 6.85, 2), S(12.25, 5.15), S(9, 2.1, 1), S(16.2, 6, 3), S(8.6, 9.4, 1)]
  },
  {
    units: [one('book-pile'), one('book-pile'), one('book-pile')],
    slots: [S(9.4, 10.2), S(13, 10.25), S(16.3, 10.1), S(11, 1.4), S(15, 4.6)]
  },
  {
    units: [one('box'), one('box'), one('box')],
    slots: [S(-12, 9), S(-12, 10), S(-19.9, 13.6), S(-13, 8), S(-18.3, 8)]
  },
  { units: [one('bucket'), one('bucket')], slots: [S(-13.6, 14.6), S(-20.4, 8), S(-12.6, 12.4), S(-18.2, 12)] },
  {
    units: [one('towels'), one('towels'), one('towels')],
    slots: [S(-11, -4.6), S(-11, -3.6), S(-13, -4.6), S(-19.5, 1), S(-13.5, 1.6)]
  },
  { units: [one('cart')], slots: [S(-12.5, -2, 1), S(-17, 0.5), S(-18.6, -2.4, 1)] },
  { units: [one('bucket'), one('bucket')], slots: [S(-16, -4.6), S(-10.6, 1.8), S(-19.6, -3.2), S(-14, -1)] }
];

/** slot に置いたときの piece。piece の位置と向きを slot の向きだけ回す（three の rotation.y と同じ回り方） */
export function place(slot: Slot, q: Piece): Piece {
  const [x, y, z] = q.at;
  const [dx, dz] = [
    [x, z],
    [z, -x],
    [-x, -z],
    [-z, x]
  ][slot.turn];
  return { ...q, at: [slot.at[0] + dx, slot.at[1] + y, slot.at[2] + dz], turn: ((q.turn + slot.turn) % 4) as Turn };
}

/** 組ごとに、units の i 番めを置く候補。種が null なら候補の頭から順に（既定の置き方） */
export function arrange(seed: number | null): Slot[][] {
  const rand = seed === null ? null : rng(seed);
  return SETS.map((set) => {
    const order = set.slots.map((_, i) => i);
    if (rand)
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
      }
    return set.units.map((_, i) => set.slots[order[i]]);
  });
}

/** 置いた動く物の部品。並びは組 → 物 → 部品の順で、種が変わっても数と並びは同じ */
export function propPieces(seed: number | null): Piece[] {
  const slots = arrange(seed);
  return SETS.flatMap((set, k) => set.units.flatMap((unit, i) => unit.map((q) => place(slots[k][i], q))));
}

/** 額の絵柄の数（textures-rooms.ts の artwork） */
export const ART = 4;

/** n 枚の額の絵柄。置き方とは別の乱数の流れで決め、種が null なら 0, 1, 2… の順 */
export function artOf(seed: number | null, n: number): number[] {
  const rand = seed === null ? null : rng(seed ^ 0x5bd1e995);
  return Array.from({ length: n }, (_, i) => (rand ? Math.floor(rand() * ART) : i % ART));
}
```

- [ ] **Step 4: 屋敷の並びに入れる**

`mansion/layout.ts` の import に `import { artOf, propPieces } from './props';` を足す。`pieces()` から、動く物になる次の 12 行を消す。

```ts
    p('table-white', [-4, 0, 2.5]),
    p('chair', [-4, 0, 1.6]),
    p('chair', [-4, 0, 3.4], 2),
    p('chair', [-4.9, 0, 2.5], 1),
    p('chair', [-3.1, 0, 2.5], 3),
    p('table-red', [-4.5, 0, 7]),
    p('chair', [-4.5, 0, 6.1]),
    p('chair', [-4.5, 0, 7.9], 2),
```

```ts
    p('balloons', [-6.2, 0, 0.8]),
    p('balloons', [6.2, 0, 11.2]),
```

（2 階の `p('balloons', [-6, FLOOR2, 11.2])` は残す。）

```ts
    p('balloon', [1.8, 0, 1.2]),
    p('balloon', [2.4, 0, 1.5]),
    p('balloon', [-1.5, 0, 10.5]),
```

```ts
    p('sofa', [-14, 0, 6.25], 2),
```

```ts
    p('bench', [-20, 0, 3.5]),
    p('balloon', [-12, 0, 4]),
    p('balloon', [-12.5, 0, 4.3]),
    p('balloon', [-18, 0, 5.8]),
```

`Mansion` に足す。

```ts
  /** pieces の最後の動く物の数（種で位置と向きだけが変わる） */
  moving: number;
  /** 額の絵柄（pieces の painting の順） */
  arts: number[];
```

`mansion()` を次にする。

```ts
/** seed が null なら既定の置き方（ロビーとひとりで試す）。試合では親が配った種で、どの端末も同じ置き方になる */
export function mansion(seed: number | null = null): Mansion {
  const moving = propPieces(seed);
  const all = [...pieces(), ...roomPieces(), ...lobbyPieces(), ...moving];
  return {
    slabs: [...hall(), ...corridor(), ...room(), ...roomSlabs(), ...lobbySlabs()],
    pieces: all,
    ramps: [STAIR],
    spawn: [0, 0, 1.5],
    solids: podiumBoxes(),
    moving: moving.length,
    arts: artOf(seed, all.filter((q) => q.kind === 'painting').length),
    lights: [
      { at: [0, 2.6, -30], color: '#fff4e0', power: 6, reach: 8 },
      ...all.filter((q) => q.kind === 'chandelier').map((q) => ({ at: q.at, color: '#ffd9a0', power: 14, reach: 14 })),
      ...all
        .filter((q) => q.kind === 'sconce')
        .map((q) => ({
          at: [q.at[0], q.at[1] + 0.2, q.at[2] + (q.turn === 2 ? -0.3 : 0.3)] as V3,
          color: '#ffcf8a',
          power: 3,
          reach: 7
        })),
      ...roomLights(),
      ...lobbyLights()
    ]
  };
}
```

- [ ] **Step 5: 額の絵を 3 枚足す**

`textures-rooms.ts` の import を `import { make, oilPainting, type Pattern } from './textures';` にし、最後に足す。

```ts
/** 額の油絵の筆の跡（色の薄い楕円を重ねる） */
function strokes(g: CanvasRenderingContext2D, r: () => number, hue: number, n = 220) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `hsl(${hue + r() * 25} ${15 + r() * 20}% ${20 + r() * 45}% / 0.12)`;
    g.beginPath();
    g.ellipse(r() * 512, r() * 384, 6 + r() * 14, 3 + r() * 6, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
}

/** 黒い上着に白い襟の人の胸から上（書斎の肖像画）。目と口は 2cm 以上 */
function portrait(): Pattern {
  return make('art-portrait', 512, 384, [1.2, 0.9], (g) => {
    const r = rng(107);
    const bg = g.createRadialGradient(256, 150, 30, 256, 190, 300);
    bg.addColorStop(0, '#5a4330');
    bg.addColorStop(1, '#1f1610');
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#16141a';
    g.beginPath();
    g.ellipse(256, 384, 170, 150, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#efe8dc';
    g.beginPath();
    g.moveTo(216, 250);
    g.lineTo(256, 320);
    g.lineTo(296, 250);
    g.fill();
    g.fillStyle = '#d6ac86';
    g.beginPath();
    g.ellipse(256, 165, 58, 74, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3a2a1e';
    g.beginPath();
    g.ellipse(256, 115, 64, 40, 0, Math.PI, 0);
    g.fill();
    g.fillStyle = '#2a1d14';
    for (const x of [234, 278]) {
      g.beginPath();
      g.arc(x, 165, 6, 0, Math.PI * 2);
      g.fill();
    }
    g.fillRect(244, 205, 24, 9);
    strokes(g, r, 25);
  });
}

/** 空と丘と川と 1 本の木の風景 */
function landscape(): Pattern {
  return make('art-landscape', 512, 384, [1.2, 0.9], (g) => {
    const r = rng(109);
    const sky = g.createLinearGradient(0, 0, 0, 230);
    sky.addColorStop(0, '#6f93b4');
    sky.addColorStop(1, '#e9dcb8');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#7f8f6a';
    g.beginPath();
    g.moveTo(0, 230);
    g.quadraticCurveTo(140, 150, 300, 220);
    g.quadraticCurveTo(420, 180, 512, 210);
    g.lineTo(512, 384);
    g.lineTo(0, 384);
    g.fill();
    g.fillStyle = '#4f6b3c';
    g.beginPath();
    g.moveTo(0, 300);
    g.quadraticCurveTo(220, 250, 512, 290);
    g.lineTo(512, 384);
    g.lineTo(0, 384);
    g.fill();
    g.fillStyle = '#9db7c9';
    g.beginPath();
    g.moveTo(180, 384);
    g.quadraticCurveTo(250, 320, 330, 300);
    g.lineTo(350, 304);
    g.quadraticCurveTo(280, 330, 250, 384);
    g.fill();
    g.fillStyle = '#3d2b1c';
    g.fillRect(392, 190, 14, 110);
    g.fillStyle = '#35502c';
    g.beginPath();
    g.arc(399, 180, 48, 0, Math.PI * 2);
    g.fill();
    strokes(g, r, 80);
  });
}

/** 机の上の青い花瓶と花と果物 */
function stillLife(): Pattern {
  return make('art-still-life', 512, 384, [1.2, 0.9], (g) => {
    const r = rng(113);
    g.fillStyle = '#2f3a2a';
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#5a3d26';
    g.fillRect(0, 280, 512, 104);
    g.strokeStyle = '#4f7a3a';
    g.lineWidth = 9;
    for (const [x, y] of [
      [190, 120],
      [235, 100],
      [265, 130],
      [210, 85],
      [255, 70]
    ]) {
      g.beginPath();
      g.moveTo(220, 170);
      g.lineTo(x, y);
      g.stroke();
    }
    for (const [x, y, c] of [
      [190, 120, '#c94f4f'],
      [235, 100, '#e7c95a'],
      [265, 130, '#e7e1d0'],
      [210, 85, '#c94f4f'],
      [255, 70, '#d98a3a']
    ] as const) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, 24, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#3c5f8a';
    g.fillRect(200, 150, 40, 60);
    g.beginPath();
    g.ellipse(220, 240, 52, 60, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#b8432f';
    for (const [x, y, s] of [
      [360, 300, 30],
      [410, 312, 26]
    ]) {
      g.beginPath();
      g.arc(x, y, s, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#e7c95a';
    g.beginPath();
    g.ellipse(318, 316, 30, 20, 0.3, 0, Math.PI * 2);
    g.fill();
    strokes(g, r, 60);
  });
}

/** 額の絵柄（mansion/props.ts の ART 枚）。0 は大広間からある油絵 */
export function artwork(k: number): Pattern {
  return [oilPainting, portrait, landscape, stillLife][k % 4]();
}
```

- [ ] **Step 6: 3D で動かし、絵柄を差し替える**

`mansion/furniture.ts` の `painting` の 2 行めを次にする。

```ts
// 絵柄は試合ごとに build.ts が材質ごと差し替える
plane(g, [1.2, 0.9], { pattern: oilPainting(), rough: 0.6 }, [0, 0, 0.062]).userData.art = true;
```

`mansion/build.ts` の import を次のように足す（`artwork` は Task 6 の `../textures-rooms` の行に、`type Piece` は今の `./layout` の行に並べる）。

```ts
import type { Level } from '../move';
import { artwork, blueHex, brick, planks, splashWall, whiteTile } from '../textures-rooms';
import { seeThrough } from '../xray';
import { levelOf, mansion, type Face, type Mat, type Piece, type Slab } from './layout';
import { ART } from './props';
```

`buildMansion` を次にする。

```ts
function put(o: THREE.Object3D, p: Piece) {
  o.position.set(...p.at);
  o.rotation.y = (p.turn * Math.PI) / 2;
}

export function buildMansion(): Built {
  const m = mansion();
  const group = new THREE.Group();
  for (const s of m.slabs) group.add(slab(s));
  const objects = m.pieces.map((p) => {
    const o = piece(p);
    put(o, p);
    group.add(o);
    return o;
  });
  for (const l of m.lights) {
    const light = new THREE.PointLight(l.color, l.power, l.reach, 2);
    light.position.set(...l.at);
    group.add(light);
  }
  const rims: THREE.MeshStandardMaterial[] = [];
  group.traverse((o) => {
    if (o.userData.glow) rims.push((o as THREE.Mesh).material as THREE.MeshStandardMaterial);
  });
  const frames: THREE.Mesh[] = [];
  m.pieces.forEach((p, i) => {
    if (p.kind === 'painting')
      objects[i].traverse((o) => {
        if (o.userData.art) frames.push(o as THREE.Mesh);
      });
  });
  // 絵柄は紹介の 3 秒に差し替えるので、材質を先に全部作り、透かしのシェーダーも先に当てて、差し替えでシェーダーを作り直させない
  const arts = Array.from({ length: ART }, (_, k) => {
    const mat = finish({ pattern: artwork(k), rough: 0.6 }, [1.2, 0.9]);
    seeThrough(mat);
    return mat;
  });
  const first = m.pieces.length - m.moving;
  const arrange = (seed: number | null): Level => {
    const next = mansion(seed);
    next.pieces.slice(first).forEach((p, i) => put(objects[first + i], p));
    next.arts.forEach((k, i) => {
      if (frames[i]) frames[i].material = arts[k];
    });
    return levelOf(next);
  };
  return {
    group,
    level: arrange(null),
    glow: (on) => {
      for (const r of rims) r.emissiveIntensity = on ? 2.4 : 0.15;
    },
    arrange
  };
}
```

`world3d.ts` の `Built` に `/** 試合の小物の置き方にする（3D は作り直さずに動かす）。新しい当たりを返す */ arrange?: (seed: number | null) => Level;` を足し、`podium` の下に足す。

```ts
  /** 小物を種の置き方へ動かし、当たりも入れ替える */
  arrange(seed: number | null): void {
    const a = this.#built?.arrange;
    if (a) this.level = a(seed);
  }
```

- [ ] **Step 7: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（layout.test.ts の「始めの場所は、どの当たりの箱にも入っていない」と「大広間から出入口を通って」も既定の置き方で通る）。

- [ ] **Step 8: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Move the mansion's props and swap framed art from a per-match seed"
```

---

### Task 9: 部屋のシートを撮る

**Files:**

- Create（リポジトリに入れない）: `<scratchpad>/room-sheet-2b.mjs`、`<scratchpad>/sheet-2b/*.png`

本家のスクショは `<scratchpad>/ss/` にある。キッチンは `ss/full2.jpg`（肉の棚とガスボンベ）、ランドリーは `ss/full5.jpg`（洗濯ひもの服とタオルの山）と `ss/full3.jpg`（赤いれんがの壁）、大広間は `ss/full8.jpg`、緑の廊下は `ss/full6.jpg`。ロビーと書斎のスクショは無いので、設計の言葉を添えて並べる。

- [ ] **Step 1: 撮る台本を置く**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

`<scratchpad>/room-sheet-2b.mjs`:

```js
// 実行: node <scratchpad>/room-sheet-2b.mjs <repo の絶対パス> <scratchpad>
// ひとりで試すをフリーカメラにして部屋ごとに撮り、本家のスクショと横に並べたシートと、小物の置き方を種で変えたシートを作る
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const [repo, pad] = process.argv.slice(2);
const out = `${pad}/sheet-2b`;
await mkdir(out, { recursive: true });
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');
const PI = Math.PI;
const ROOMS = [
  [
    'ロビー',
    'ペンキのしぶきの白い部屋、白黒の市松の床、白いアーチ、HUNTER の赤い丸い台',
    [],
    [
      [[0, 0, -66.5], 0, 0.15],
      [[5, 0, -54], -2.4, -0.05]
    ]
  ],
  ['大広間', '', ['ss/full8.jpg'], [[[0, 0, 0.6], 0, -0.15]]],
  ['緑の廊下', '', ['ss/full6.jpg'], [[[-7.5, 0, 5], -PI / 2, 0]]],
  [
    '書斎・図書室',
    '茶色の木の床、壁一面の本棚、緑の笠のランプの机、折りたたみ椅子、地球儀、肖像画、胸像、木の柱',
    [],
    [
      [[7.8, 0, 6], PI / 2, 0.05],
      [[16.5, 0, 9.5], -2.29, 0.1]
    ]
  ],
  [
    'キッチン',
    '',
    ['ss/full2.jpg'],
    [
      [[-16, 0, 7.6], 0, 0.05],
      [[-12, 0, 14.3], -2.13, 0.1]
    ]
  ],
  [
    'ランドリー',
    '',
    ['ss/full5.jpg', 'ss/full3.jpg'],
    [
      [[-15, 0, 2.5], PI, 0.05],
      [[-11, 0, -4.4], -1.07, 0.05]
    ]
  ]
];
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5180/asobibako/games/yappari-chameleon', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('button.solo').click();
await page.waitForFunction(() => !!window.__chameleon, null, { timeout: 120000 });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const p = window.__chameleon;
  if (p.mode !== 'eye') p.toggleEye();
});
async function view(pos, yaw, pitch, file) {
  await page.evaluate(
    ([pos, yaw, pitch]) => {
      const p = window.__chameleon;
      p.ghost = { pos: [...pos], vy: 0, yaw: 0, ground: true, cling: null };
      p.eyeYaw = yaw;
      p.eyePitch = pitch;
    },
    [pos, yaw, pitch]
  );
  await page.waitForTimeout(700);
  await page.locator('canvas').first().screenshot({ path: file });
  return file;
}
const rows = [];
for (const [i, [name, note, originals, views]] of ROOMS.entries()) {
  const shots = [];
  for (const [k, [pos, yaw, pitch]] of views.entries())
    shots.push(await view(pos, yaw, pitch, `${out}/room-${i}-${k}.png`));
  rows.push({ name, note, shots, originals: originals.map((f) => `${pad}/${f}`) });
}
const seeds = [];
for (const seed of [null, 11, 12]) {
  await page.evaluate((s) => window.__chameleon.world.arrange(s), seed);
  seeds.push([String(seed), await view([5.5, 0, 0.8], -0.81, 0.25, `${out}/props-${seed}.png`)]);
}
await browser.close();
const uri = async (f) =>
  `data:image/${f.endsWith('jpg') ? 'jpeg' : 'png'};base64,${(await readFile(f)).toString('base64')}`;
const sheet = await chromium.launch({ channel: 'chrome' });
const p2 = await sheet.newPage({ viewport: { width: 1900, height: 1000 } });
const cell = async (f, label) =>
  `<div style="color:#fff;font:14px sans-serif">${label}<br><img src="${await uri(f)}" width="440"></div>`;
let html = '';
for (const r of rows) {
  const cells = [
    ...(await Promise.all(r.shots.map((f) => cell(f, `${r.name}（こちら）`)))),
    ...(await Promise.all(r.originals.map((f) => cell(f, `${r.name}（本家）`))))
  ];
  html += `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:10px">${cells.join('')}${r.note ? `<p style="color:#ccc;font:14px sans-serif;width:300px">${r.note}</p>` : ''}</div>`;
}
await p2.setContent(`<body style="margin:0;padding:8px;background:#222">${html}</body>`);
await p2.waitForTimeout(600);
await p2.screenshot({ path: `${out}/rooms.png`, fullPage: true });
const seedCells = await Promise.all(seeds.map(([s, f]) => cell(f, `種 ${s}`)));
await p2.setContent(
  `<body style="margin:0;padding:8px;background:#222;display:flex;gap:6px">${seedCells.join('')}</body>`
);
await p2.waitForTimeout(600);
await p2.screenshot({ path: `${out}/props.png`, fullPage: true });
await sheet.close();
console.log('ok', `${out}/rooms.png`, `${out}/props.png`);
```

- [ ] **Step 2: 撮る**

Run: `node <scratchpad>/room-sheet-2b.mjs "$PWD" <scratchpad>`
Expected: `pageerror` が出ず、最後に `ok` と 2 枚のシートの場所を出す。

- [ ] **Step 3: シートを見て直す**

Read で `<scratchpad>/sheet-2b/rooms.png` と `props.png` を見て、次を確かめる。

| 見るところ   | 写っていること                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| ロビー       | 白い壁にアーチとしぶき、市松の床、まん中の赤い台に南から読める「HUNTER」、端の水色の台                               |
| 書斎         | 茶色の板の床、北と東の壁一面の本棚、机の上の緑の笠、柱 4 本、地球儀、胸像、南の壁の額 2 枚                           |
| キッチン     | 白いタイルの壁、青い六角の床、北の壁の台とシンクと皿、島の台と黄色の注意線、西の壁の肉の棚、ガスボンベ、天井のダクト |
| ランドリー   | 赤いれんがの壁、白黒の床、南と東の洗濯機（赤と黄色が交互）、2 本の洗濯ひもの服、タオルの山、青いカート               |
| 小物の置き方 | 種 null・11・12 で、大広間のテーブルと風船の場所が変わる。額の絵柄も変わる                                           |

浮いている・床に沈んでいる・前と後ろが逆（洗濯機の扉や台の扉が壁を向く）・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形（`room-furniture.ts`）か置き方（`rooms.ts`・`props.ts` の候補）の数値だけを直して撮り直す。候補を動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` が通ることも確かめる。

- [ ] **Step 4: 直したものがあればコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Tune the new rooms after comparing them with the original screenshots"
```

- [ ] **Step 5: シートをユーザーに見せる準備**

作業の担当へ、`<scratchpad>/sheet-2b/rooms.png` と `props.png` の場所と、本家と違って見える点（ロビーと書斎は本家のスクショが無く設計の言葉だけで作ったこと）を返す。

---

### Task 10: 知らせの形と親の審判

**Files:**

- Modify: `src/lib/games/yappari-chameleon/net.ts`（版 2・`Me.eye`）
- Modify: `src/lib/games/yappari-chameleon/host.ts`
- Modify: `src/lib/games/yappari-chameleon/Yappari.svelte`（審判に種から当たりを作る口を渡す）
- Modify: `src/lib/games/yappari-chameleon/session.svelte.ts`（`#me()` に `eye`）
- Test: `src/lib/games/yappari-chameleon/host.test.ts`、`net.test.ts`、`remote.test.ts`、`session.svelte.test.ts`（`Me` の形）

**Interfaces:**

- Consumes: Task 1・2 の `referee.ts`、Task 3 の `oversight.ts`、Task 4 の `embedded`、Task 5 の `onPodium`、Task 8 の `mansion(seed)`。
- Produces: `CHAMELEON_VERSION = 2`、`Me.eye: V3 | null`（ハンターは今のカメラの位置。一人称なら目、三人称なら体の後ろのカメラ。隠れる人は null）。
- Produces: `new Host(port, levelFor: (seed: number | null) => Level, now?, rand?)`。act に `iine`（`{ t: 'iine', to: Seat }`）を足し、`wish` をなくす。tell に `left`（`{ t: 'left', seat, body: Me }`、ダブルの残した体）と `leftDabs`（`dabs` と同じ形で、残した体の塗り）を足す。`found` はダブルでは `{ t: 'found', seat, by, at }`（seat は見つけた体の持ち主）。

親は毎フレーム、ロビーなら台の上の人を、隠れタイムと探索なら埋まりを、探索なら見落としポイントを、届いた体から決める。ダブルの探索に入るときは、全員の今の体と、そのときの塗りの列を控え（持ち主は探索の様子を受けると塗りを白に戻すので、今の列では足りない）、様子より先に `left` で全員へ配る。戻った子へは `left` と `leftDabs` を、様子より先に送り直す。

- [ ] **Step 1: 落ちるテストを書く**

`host.test.ts` の import に `vi` と `import { PODIUM } from './mansion/lobby';` を足し、`setup` を次にする（審判は種から当たりを作る口を受ける）。

```ts
function setup(members: Seat[] = [1, 2, 3], levelFor: (seed: number | null) => Level = () => floor) {
  const told: { to: Seat | 'all'; m: Message }[] = [];
  let listener: (m: Message, from: Seat) => void = () => {};
  const port: Port & { members: Seat[] } = {
    members,
    // Link と同じく JSON で渡す
    tell: (to, m) => told.push({ to, m: JSON.parse(JSON.stringify(m)) }),
    onAct: (l) => {
      listener = l;
      return () => {};
    }
  };
  const clock = { ms: 0 };
  const host = new Host(
    port,
    levelFor,
    () => clock.ms,
    () => 0
  );
  const act = (m: Message, from: Seat) => listener(m, from);
  for (const s of members) if (s !== 1) act({ t: 'hi', v: CHAMELEON_VERSION }, s);
  return { host, port, told, act, clock };
}
```

`me` の助けの `look: [0, 0],` の下に `eye: null,` を足す。`searching` を次にする（ハンター希望は台の上に立って出す）。

```ts
/** 3 人で始め（台の上の 3 番がハンター）、探索まで進める */
function searching(settings: Partial<Settings> = {}, levelFor?: (seed: number | null) => Level) {
  const s = setup([1, 2, 3], levelFor);
  s.act(me(0, [PODIUM.at[0], PODIUM.h, PODIUM.at[2]]), 3);
  s.host.tick(0.1);
  s.host.start({ ...DEFAULTS, hide: 60, ...settings });
  for (let i = 0; i < 64 * 10; i++) s.host.tick(0.1);
  expect(lastView(s.told).phase).toBe('search');
  return s;
}
```

ファイルの最後に足す。

```ts
/** 体を動かさずに secs 秒、0.1 秒ごとに全員の動きを送りながら進める */
function hold(s: ReturnType<typeof setup>, secs: number, bodies: [Seat, Message][]) {
  for (let t = 0; t < secs - 1e-9; t += 0.1) {
    s.clock.ms += 100;
    for (const [seat, m] of bodies) s.act({ ...m, ms: s.clock.ms }, seat);
    s.host.tick(0.1);
  }
}

describe('Host のロビー', () => {
  it('台の上に立っている人がハンター希望になり、降りると外れる', () => {
    const { act, told, host } = setup();
    act(me(0, [PODIUM.at[0] + 0.5, PODIUM.h, PODIUM.at[2]]), 2);
    host.tick(0.1);
    expect(lastView(told).wishes).toEqual([2]);
    act(me(100, [PODIUM.at[0], 0, PODIUM.at[2] - 4]), 2);
    host.tick(0.1);
    expect(lastView(told).wishes).toEqual([]);
  });

  it('始めると種から屋敷の当たりを作り直し、ロビーに戻ると既定の当たりに戻す', () => {
    const levelFor = vi.fn((_seed: number | null) => floor);
    const { host } = setup([1, 2, 3], levelFor);
    expect(levelFor).toHaveBeenLastCalledWith(null);
    host.start({ ...DEFAULTS, hide: 30, search: 60, reveal: 10 });
    expect(levelFor).toHaveBeenLastCalledWith(1);
    for (let i = 0; i < 1100; i++) host.tick(0.1);
    expect(host.match.phase).toBe('lobby');
    expect(levelFor).toHaveBeenLastCalledWith(null);
  });
});

describe('Host のダブル', () => {
  /** 1 は z 5、2 は z 8、3 は z 2 に隠れ、探索に入る。3 は原点に戻って +z を撃つ */
  function doubled() {
    const s = setup();
    s.host.start({ ...DEFAULTS, mode: 'double', hide: 60 });
    s.act(me(0, [0, 0, 5]), 1);
    s.act(me(0, [0, 0, 8]), 2);
    s.act(me(0, [0, 0, 2]), 3);
    for (let i = 0; i < 64 * 10; i++) s.host.tick(0.1);
    expect(lastView(s.told).phase).toBe('search');
    return s;
  }

  it('探索に入ると、残した体を様子より先に全員へ配る', () => {
    const { told } = doubled();
    const order = told.map((x) => (x.m.t === 'phase' ? `phase:${(x.m.view as View).phase}` : x.m.t));
    const search = order.indexOf('phase:search');
    const lefts = told.filter((x) => x.m.t === 'left');
    expect(lefts.map((x) => x.m.seat)).toEqual([1, 2, 3]);
    expect(lefts.every((x) => x.to === 'all')).toBe(true);
    expect(order.lastIndexOf('left')).toBeLessThan(search);
    expect((lefts[0].m.body as Me).pos).toEqual([0, 0, 5]);
  });

  it('自分の残した体と、もう見つけた体は弾を止めず、ほかの全員を見つけると勝つ', () => {
    const { act, told, host } = doubled();
    act(me(0, [0, 0, 0]), 3);
    act({ ...SHOT, ms: 0 }, 3);
    expect(of(told, 'found')).toEqual([{ t: 'found', seat: 1, by: 3, at: expect.any(Array) }]);
    expect(lastView(told).caught).toEqual({ 3: [1] });
    host.tick(2.1);
    act({ ...SHOT, ms: 2100 }, 3);
    expect(of(told, 'found').map((m) => m.seat)).toEqual([1, 2]);
    expect(lastView(told)).toMatchObject({ phase: 'reveal', winner: 'double', champ: 3 });
  });

  it('ダブルで戻った子へ、残した体とそのときの塗りを様子より先に送る（持ち主の今の列は白）', () => {
    const s = setup();
    s.host.start({ ...DEFAULTS, mode: 'double', hide: 60 });
    for (const seat of [1, 2, 3] as Seat[]) s.act(me(0, [seat, 0, 5]), seat);
    s.act({ t: 'dabs', at: 0, d: packDabs(paint(5)) }, 2);
    for (let i = 0; i < 64 * 10; i++) s.host.tick(0.1);
    // 持ち主は探す人になると塗りを白に戻して送り直す
    s.act({ t: 'dabs', at: 0, d: [] }, 2);
    s.act(me(100, [0, 0, 0.6], { pose: AIM.id }), 2);
    s.port.members = [1, 3];
    s.act({ t: 'leave' }, 2);
    s.told.length = 0;
    s.port.members = [1, 2, 3];
    s.act({ t: 'join' }, 2);
    const mine = s.told.filter((x) => x.to === 2).map((x) => x.m);
    const phase = mine.findIndex((m) => m.t === 'phase');
    expect(phase).toBe(mine.length - 1);
    expect(mine.filter((m) => m.t === 'left').map((m) => m.seat)).toEqual([1, 2, 3]);
    const left = mine.find((m) => m.t === 'left' && m.seat === 2)!;
    expect((left.body as Me).pos).toEqual([2, 0, 5]);
    const leftDabs = mine.filter((m) => m.t === 'leftDabs' && m.seat === 2);
    expect(leftDabs.reduce((n, m) => n + (m.d as number[]).length, 0)).toBe(5 * DAB_LEN);
    expect(mine.filter((m) => m.t === 'dabs' && m.seat === 2).every((m) => (m.d as number[]).length === 0)).toBe(true);
    expect((mine[phase].view as View).roles[2]).toBe('hunter');
  });
});

describe('Host の見落としポイント', () => {
  const wall: Level = {
    boxes: [...floor.boxes, { min: [-5, 0, 3], max: [5, 3, 3.3] }],
    ramps: [],
    spawn: [0, 0, 0]
  };
  const hunter = (eye: V3, look: [number, number] = [0, 0]) => me(0, [0, 0, 0], { pose: AIM.id, look, eye });

  it('視野の中で止まっている隠れる人に、近いほど多く入る', () => {
    const s = searching();
    hold(s, 1, [
      [2, me(0, [0, 0, 5])],
      [3, hunter([0, 1, 0])]
    ]);
    // 頭（高さ 1.045）まで 5m なので、1 秒で 10 × (1 − 5 / 15)
    expect(s.host.match.overlook[3]?.[2]).toBeCloseTo(6.67, 1);
    expect(s.host.match.overlook[3]?.[1]).toBeUndefined();
  });

  it('動いている人と、壁の向こうの人には入らない', () => {
    const moving = searching();
    // 最初の 2 つは、数え始める前から動いていた跡
    for (let t = -2; t < 10; t++) {
      moving.clock.ms += 100;
      moving.act(me(moving.clock.ms, [t * 0.1, 0, 5]), 2);
      moving.act({ ...hunter([0, 1, 0]), ms: moving.clock.ms }, 3);
      if (t >= 0) moving.host.tick(0.1);
    }
    expect(moving.host.match.overlook[3]?.[2] ?? 0).toBe(0);
    const hidden = searching({}, () => wall);
    hold(hidden, 1, [
      [2, me(0, [0, 0, 5])],
      [3, hunter([0, 1, 0])]
    ]);
    expect(hidden.host.match.overlook[3]?.[2] ?? 0).toBe(0);
  });

  it('三人称のハンターは、目ではなくカメラの位置から見る（背中とカメラのあいだの人にも入る）', () => {
    const tps = searching();
    // 体は原点で +z を向き、カメラは体の 2.4m 後ろの上。2 はその間（体の 1m 後ろ）にいる
    hold(tps, 1, [
      [2, me(0, [0, 0, -1])],
      [3, hunter([0.45, 1.9, -2.4], [0, 0.25])]
    ]);
    expect(tps.host.match.overlook[3]?.[2] ?? 0).toBeGreaterThan(0);
    const fps = searching();
    hold(fps, 1, [
      [2, me(0, [0, 0, -1])],
      [3, hunter([0, 1, 0])]
    ]);
    expect(fps.host.match.overlook[3]?.[2] ?? 0).toBe(0);
  });

  it('点は 1 秒ごとの様子で配り、点が増えるだけでは毎フレーム配らない', () => {
    const s = searching();
    s.told.length = 0;
    hold(s, 2, [
      [2, me(0, [0, 0, 5])],
      [3, hunter([0, 1, 0])]
    ]);
    const sent = views(s.told);
    expect(sent.length).toBeLessThanOrEqual(3);
    expect(sent.at(-1)!.overlook[3]?.[2]).toBeGreaterThan(0);
  });
});

describe('Host の埋まりとええやん', () => {
  const sofa: Level = {
    boxes: [...floor.boxes, { min: [-1, 0, 4.5], max: [1, 0.85, 5.5] }],
    ramps: [],
    spawn: [0, 0, 0]
  };

  it('家具に埋まった隠れる人は、5 秒たつとハンターに場所を知らせる', () => {
    const s = searching({}, () => sofa);
    hold(s, 4.5, [[2, me(0, [0, 0, 5])]]);
    expect(lastView(s.told)).toMatchObject({ buried: [2], exposed: [] });
    hold(s, 0.6, [[2, me(0, [0, 0, 5])]]);
    expect(lastView(s.told).exposed).toEqual([2]);
    hold(s, 0.1, [[2, me(0, [3, 0, 5])]]);
    expect(lastView(s.told)).toMatchObject({ buried: [], exposed: [] });
  });

  it('ええやんは答え合わせのあいだ 1 回だけ数え、答え合わせではいた場所も配る', () => {
    const { act, told, host } = searching();
    act(me(0, [2, 0, 7]), 1);
    host.tick(300);
    expect(lastView(told).phase).toBe('reveal');
    expect(lastView(told).spots[1]).toEqual([2, 0, 7]);
    act({ t: 'iine', to: 1 }, 3);
    act({ t: 'iine', to: 2 }, 3);
    act({ t: 'iine', to: 9 }, 2);
    expect(lastView(told)).toMatchObject({ likes: { 1: 1 }, liked: [3] });
  });
});
```

`host.test.ts` の import に `import { AIM } from './poses';` を足し、`import { CHAMELEON_VERSION, DAB_LEN, packDabs, splice, unpackDabs, type Me } from './net';` にする。`describe('Host の戻った子', ...)` の中の `paint` の助けは、ダブルのテストでも使うので `describe` の外（`SHOT` の下）へ移す。

`net.test.ts` の `lerpMe` の `me` と、`remote.test.ts` の `me`、`session.svelte.test.ts` の `body` の `look: ...,` の下に、それぞれ `eye: null,` を足す。`net.test.ts` に足す。

```ts
describe('知らせの版', () => {
  it('2b で形を変えたので 2', () => {
    expect(CHAMELEON_VERSION).toBe(2);
  });
});
```

（`net.test.ts` の import に `CHAMELEON_VERSION` を足す。）

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/host.test.ts src/lib/games/yappari-chameleon/net.test.ts`
Expected: 足したテストが FAIL（`Host` の 2 つめの引数が関数でない、`left` が無い、版が 1）。

- [ ] **Step 3: 知らせの形を変える**

`net.ts` の `CHAMELEON_VERSION` を `2` にし、`Me` の最後に足す。

```ts
/** ハンターの今のカメラの位置（一人称は目、三人称は体の後ろのカメラ）。親は見落としポイントの視野をここから測る。隠れる人は null */
eye: V3 | null;
```

`session.svelte.ts` の `#me()` のハンターの返す値に `eye: [cam.position.x, cam.position.y, cam.position.z],` を、隠れる人の返す値に `eye: null,` を足し、関数の頭で `const cam = this.play.world.camera;` を取る（Play の frame がカメラを動かしたあとに送るので、そのコマのカメラの位置になる）。

- [ ] **Step 4: 審判を書き換える**

`src/lib/games/yappari-chameleon/host.ts`:

```ts
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import { Timeline } from '$lib/net/timeline';
import type { V3 } from '$lib/sculpt';
import { embedded } from './embed';
import { onPodium } from './mansion/lobby';
import type { Level } from './move';
import { CHAMELEON_VERSION, DAB_LEN, dabMessages, lerpMe, splice, type Me } from './net';
import { bodyPoints, rate, sight, still, STILL_MS } from './oversight';
import { poseById } from './poses';
import * as rules from './referee';
import { capsules, fire, placement, type Target } from './shots';

export interface Port {
  readonly members: Seat[];
  tell(to: Seat | 'all', message: Message): void;
  onAct(listener: (message: Message, from: Seat) => void): () => void;
}

/** 撃った時刻からさかのぼって体を調べる時刻（ミリ秒）。撃つ側と隠れる側の見え方のずれを小さくする */
export const REWIND = [0, 50, 100];
/** 試合の様子を変わらなくても送り直す間隔（秒）。見落としポイントもこの間隔で配る */
const BEAT = 1;
/** 小さな dt を足し重ねたずれで、間隔の手前に残らないようにする */
const EPS = 1e-6;
/**
 * step が進める 1 回の上限（秒）。親のアプリが裏に回ると描画のループごと止まるので、戻ったときの空白で試合を飛ばさず、
 * 止まっていたことにする
 */
const MAX_GAP = 1;
const SEATS: readonly unknown[] = [1, 2, 3];

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const v3 = (v: unknown): v is V3 => Array.isArray(v) && v.length === 3 && v.every(num);
const isMe = (m: Message): boolean =>
  num(m.ms) &&
  v3(m.pos) &&
  num(m.yaw) &&
  typeof m.pose === 'string' &&
  Array.isArray(m.look) &&
  m.look.length === 2 &&
  (m.eye === undefined || m.eye === null || v3(m.eye));

/** いま隠れている体と、直前 STILL_MS のあいだ止まっていたか */
interface Hidden {
  seat: Seat;
  body: Me;
  still: boolean;
}

/**
 * 親の端末だけで動く審判。フェーズと時計を進め、全員の動きと吹き付けを中継し、撃った弾の当たりと、
 * 台の上の人・埋まり・見落としポイントを届いた体から決める。
 * 親自身の操作も act で同じ口から入るので（Party が手元で回す）、席 1 も子と同じに扱える
 */
export class Host {
  readonly match = rules.newMatch();
  readonly #port: Port;
  readonly #levelFor: (seed: number | null) => Level;
  #level: Level;
  #seed: number | null = null;
  readonly #now: () => number;
  readonly #rand: () => number;
  readonly #lines = new Map<Seat, Timeline<Me>>();
  /** 席ごとの吹き付けの列（数の列のまま）。戻った子へ全員の塗りを送り直すのに使う */
  readonly #logs = new Map<Seat, number[]>();
  readonly #greeted = new Set<Seat>([1]);
  /** 見つかったときの体。戻った子の答え合わせで、その場に戻して見せる */
  readonly #found = new Map<Seat, Me>();
  /** ダブルの残した体と、そのときの塗りの列。撃った弾の的にし、戻った子へ送り直す */
  readonly #left = new Map<Seat, { body: Me; log: number[] }>();
  #sent = '';
  #phase: rules.Phase = 'lobby';
  #beat = 0;
  #last: number | null = null;
  #stop: () => void;

  constructor(
    port: Port,
    levelFor: (seed: number | null) => Level,
    now: () => number = () => performance.now(),
    rand: () => number = Math.random
  ) {
    this.#port = port;
    this.#levelFor = levelFor;
    this.#level = levelFor(null);
    this.#now = now;
    this.#rand = rand;
    this.#stop = port.onAct((m, from) => this.#act(m, from));
  }

  start(settings: rules.Settings): void {
    if (this.match.phase !== 'lobby' || this.#port.members.length < 2) return;
    rules.start(this.match, [...this.#port.members], settings, this.#rand);
    this.#push(true);
  }

  /**
   * 描画のループから毎コマ呼ぶ。描画の dt は 0.05 秒で切られるので、それで進めると親の重いコマ（GC・体の組み立て）のぶん
   * 試合の時計が遅れ、子の残り秒が戻り、撃つ間隔の判定もずれる。前に呼ばれてからの実時間で進める
   */
  step(): void {
    const now = this.#now();
    const gap = this.#last === null ? 0 : Math.min(MAX_GAP, (now - this.#last) / 1000);
    this.#last = now;
    if (gap > 0) this.tick(gap);
  }

  tick(dt: number): void {
    for (const seat of rules.tick(this.match, dt)) this.#toot(seat);
    this.#watch(dt);
    this.#beat += dt;
    this.#push(this.#beat >= BEAT - EPS);
  }

  stop(): void {
    this.#stop();
  }

  #act(m: Message, from: Seat) {
    if (m.t === 'hi') {
      if (m.v === CHAMELEON_VERSION) this.#greeted.add(from);
      else this.#port.tell(from, { t: 'chameleon-mismatch' });
      return;
    }
    if (m.t === 'join') {
      rules.join(this.match, from);
      this.welcome(from);
      return this.#push(true);
    }
    if (m.t === 'leave') {
      this.#greeted.delete(from);
      rules.leave(this.match, from, this.#port.members);
      return this.#push(true);
    }
    if (!this.#greeted.has(from)) return;
    if (m.t === 'me') {
      if (!isMe(m)) return;
      const me = { eye: null, ...m } as unknown as Me;
      this.#line(from).push(me.ms, this.#now(), me);
      this.#relay(from, m);
    } else if (m.t === 'dabs') {
      const { at, d } = m;
      if (!Number.isInteger(at) || (at as number) < 0 || !Array.isArray(d) || d.length % DAB_LEN || !d.every(num))
        return;
      const log = this.#logs.get(from) ?? [];
      this.#logs.set(from, log);
      if (splice(log, (at as number) * DAB_LEN, d) !== null) this.#relay(from, m);
    } else if (m.t === 'ready') {
      rules.ready(this.match, from, this.#port.members);
      this.#push(true);
    } else if (m.t === 'taunt') {
      if (rules.toot(this.match, from)) this.#toot(from);
    } else if (m.t === 'iine') {
      if (SEATS.includes(m.to) && rules.like(this.match, from, m.to as Seat)) this.#push(true);
    } else if (m.t === 'shot') this.#shot(m, from);
  }

  #line(seat: Seat): Timeline<Me> {
    let line = this.#lines.get(seat);
    if (!line) this.#lines.set(seat, (line = new Timeline<Me>()));
    return line;
  }

  #relay(from: Seat, m: Message) {
    for (const seat of this.#port.members) if (seat !== from) this.#port.tell(seat, { ...m, seat: from });
  }

  /**
   * 来た・戻った人へ、全員の体・塗り・見つかったときの体・ダブルの残した体とその塗り・今の試合の様子を送る。
   * 様子は最後に送り、受けた人はそれを受けてから自分の動きを送り始める（残っていた自分の体を上書きしない）
   */
  welcome(to: Seat): void {
    for (const [seat, line] of this.#lines) {
      const me = line.last();
      if (me) this.#port.tell(to, { t: 'me', ...me, seat });
    }
    for (const [seat, log] of this.#logs) for (const m of dabMessages(seat, 0, log)) this.#port.tell(to, m);
    for (const seat of this.match.found) {
      const body = this.#found.get(seat);
      if (body) this.#port.tell(to, { t: 'found', seat, by: 0, at: body.pos, body, quiet: true });
    }
    for (const [seat, left] of this.#left) {
      this.#port.tell(to, { t: 'left', seat, body: left.body });
      for (const m of dabMessages(seat, 0, left.log)) this.#port.tell(to, { ...m, t: 'leftDabs' });
    }
    this.#port.tell(to, { t: 'phase', view: rules.view(this.match) });
  }

  #toot(seat: Seat) {
    const me = this.#lines.get(seat)?.last();
    if (me) this.#port.tell('all', { t: 'toot', seat, at: me.pos });
  }

  /** 台の上の人（ロビー）・埋まり（隠れタイムと探索）・見落としポイント（探索）を、届いた体から決める */
  #watch(dt: number) {
    const m = this.match;
    if (m.phase === 'lobby') {
      for (const seat of this.#port.members) {
        const me = this.#lines.get(seat)?.last();
        rules.wish(m, seat, !!me && onPodium(me));
      }
      return;
    }
    if (m.phase !== 'hide' && m.phase !== 'search') return;
    const bodies = this.#hidden();
    for (const b of bodies) rules.bury(m, b.seat, embedded(this.#level, b.body), dt);
    if (m.phase !== 'search') return;
    for (const hunter of rules.seatsOf(m, 'hunter')) {
      const eye = this.#port.members.includes(hunter) ? this.#lines.get(hunter)?.last() : undefined;
      if (!eye?.eye) continue;
      const viewer = { eye: eye.eye, look: eye.look };
      for (const b of bodies) {
        if (b.seat === hunter || !b.still || m.caught[hunter]?.includes(b.seat)) continue;
        const d = sight(this.#level, viewer, bodyPoints(b.body));
        if (d !== null) rules.overlooked(m, hunter, b.seat, rate(d) * dt);
      }
    }
  }

  /** いま隠れている体。ダブルの探索では残した体（動かない） */
  #hidden(): Hidden[] {
    const m = this.match;
    if (m.settings.mode === 'double' && m.phase === 'search')
      return [...this.#left].map(([seat, l]) => ({ seat, body: l.body, still: true }));
    const now = this.#now();
    const out: Hidden[] = [];
    for (const seat of rules.hiding(m)) {
      const line = this.#lines.get(seat);
      const a = line?.at(now, 0);
      const b = line?.at(now, STILL_MS);
      if (!a || !b) continue;
      const body = lerpMe(a.a, a.b, a.t);
      out.push({ seat, body, still: still(body.pos, lerpMe(b.a, b.b, b.t).pos) });
    }
    return out;
  }

  /**
   * 撃った弾の当たりを決める。通常と増え鬼は、撃った時刻（送った人の時計）を親の時計に直し、隠れる人の体をその時刻から
   * 0.1 秒前までさかのぼって調べる。的は隠れている人だけなので、撃った人やほかのハンター（見つかった人も）の体は弾を止めない。
   * ダブルの的は残した体で、撃った人の体と、撃った人がもう見つけた体は弾を止めない
   */
  #shot(m: Message, from: Seat) {
    const { o, d: dir, from: muzzle } = m;
    if (!v3(o) || !v3(dir) || !num(m.ms)) return;
    const len = Math.hypot(...dir);
    if (len < 1e-6 || !rules.shoot(this.match, from)) return;
    const d: V3 = [dir[0] / len, dir[1] / len, dir[2] / len];
    const double = this.match.settings.mode === 'double';
    const targets = double ? this.#leftTargets(from) : this.#liveTargets(m.ms + this.#line(from).offset());
    const rays = fire(this.#level, o, d, targets);
    this.#port.tell('all', {
      t: 'splat',
      by: from,
      // 筋は銃口から引く（当たりは十字の向き、つまりカメラの位置から見る）
      from: v3(muzzle) ? muzzle : o,
      ends: rays.map((r) => r.end),
      marks: rays.filter((r) => r.n).map((r) => ({ p: r.end, n: r.n }))
    });
    for (const r of rays) {
      const seat = r.seat as Seat | null;
      if (seat === null) continue;
      if (double) {
        if (rules.spot(this.match, from, seat)) this.#port.tell('all', { t: 'found', seat, by: from, at: r.end });
        continue;
      }
      if (!rules.hit(this.match, seat)) continue;
      const body = this.#lines.get(seat)?.last();
      if (body) this.#found.set(seat, body);
      this.#port.tell('all', { t: 'found', seat, by: from, at: r.end, body });
    }
    this.#push(true);
  }

  #liveTargets(at: number): Target[] {
    const targets: Target[] = [];
    for (const seat of rules.hiding(this.match)) {
      const line = this.#lines.get(seat);
      for (const back of REWIND) {
        const s = line?.at(at, back);
        if (!s) continue;
        const me = lerpMe(s.a, s.b, s.t);
        targets.push({ seat, caps: capsules(poseById(me.pose), placement(me)) });
      }
    }
    return targets;
  }

  #leftTargets(from: Seat): Target[] {
    const got = this.match.caught[from] ?? [];
    return [...this.#left]
      .filter(([seat]) => seat !== from && !got.includes(seat))
      .map(([seat, l]) => ({ seat, caps: capsules(poseById(l.body.pose), placement(l.body)) }));
  }

  /** フェーズに入ったときの手続き。様子より先に要るもの（ダブルの残した体）は、ここで配る */
  #entered(phase: rules.Phase) {
    const m = this.match;
    // 子は lobby と intro に入るとき塗りを全部消す。親も消さないと、いなかった席の古い列が戻ったとき送り直される
    if (phase === 'lobby' || phase === 'intro') {
      this.#logs.clear();
      this.#found.clear();
      this.#left.clear();
    }
    // 持ち主は探索の様子を受けると塗りを白に戻すので、残した体はその前に写させる
    if (phase === 'search' && m.settings.mode === 'double')
      for (const seat of m.hid) {
        const body = this.#lines.get(seat)?.last();
        if (!body) continue;
        this.#left.set(seat, { body, log: [...(this.#logs.get(seat) ?? [])] });
        this.#port.tell('all', { t: 'left', seat, body });
      }
    if (phase === 'reveal')
      for (const seat of m.hid) {
        const at = this.#left.get(seat)?.body ?? this.#found.get(seat) ?? this.#lines.get(seat)?.last();
        if (at) m.spots[seat] = at.pos;
      }
  }

  /**
   * 様子が変わったか、間隔が来たら全員へ配る。残り秒と見落としポイントは毎フレーム変わるので、変わったかどうかには数えず、
   * 間隔ごとの送り直しで配る
   */
  #push(force: boolean) {
    const phase = this.match.phase;
    if (phase !== this.#phase) this.#entered(phase);
    this.#phase = phase;
    const v = rules.view(this.match);
    if (v.seed !== this.#seed) {
      this.#seed = v.seed;
      this.#level = this.#levelFor(v.seed);
    }
    const key = JSON.stringify({ ...v, left: 0, overlook: null });
    if (!force && key === this.#sent) return;
    this.#sent = key;
    this.#beat = 0;
    this.#port.tell('all', { t: 'phase', view: v });
  }
}
```

`Yappari.svelte` の `const h = new Host(p, levelOf(mansion()));` を `const h = new Host(p, (seed) => levelOf(mansion(seed)));` にする。

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（2a の Host のテストも、ハンター希望を台の上に立って出す `searching` で通る）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Referee the podium, the double mode's left bodies, likes, burying and overlook points on the host"
```

---

### Task 11: 画面が持つ様子（ダブルの言葉・順位表・見落とし）

**Files:**

- Modify: `src/lib/games/yappari-chameleon/match.svelte.ts`
- Test: `src/lib/games/yappari-chameleon/match.svelte.test.ts`

**Interfaces:**

- Consumes: Task 1・2 の `View`、Task 6 の `placeOf`。
- Produces: `Match.double: boolean`、`Match.word`（ダブルの探索は全員「全員を見つけよう」）、`Match.ranking: { seat; got; need }[]`、`Match.overlooked: { seat; pts }[]`（自分が見落とした敵、1 点以上）、`Match.spotted: { seat; pts; place }[]`（隠れた人ごとの点の合計といた場所の名前）。

- [ ] **Step 1: 落ちるテストを書く**

`match.svelte.test.ts` の `describe('Match', ...)` の最後に足す。

```ts
const double = { ...DEFAULTS, mode: 'double' } as const;

it('ダブルでは、隠れタイムは探索開始まで、探索は全員が「全員を見つけよう」', () => {
  const roles = { 1: 'hunter', 2: 'hunter', 3: 'hunter' } as const;
  expect(at(1, { phase: 'hide', settings: double, roles: { 1: 'hider', 2: 'hider', 3: 'hider' } }).word).toBe(
    '探索開始まで'
  );
  expect(at(1, { phase: 'search', settings: double, roles }).word).toBe('全員を見つけよう');
  expect(at(2, { phase: 'search', settings: double, roles }).double).toBe(true);
});

it('順位表は見つけた数の多い順、同じ数なら先に届いた順で、見つける数はほかの人の数', () => {
  const m = at(1, {
    phase: 'search',
    settings: double,
    hid: [1, 2, 3],
    caught: { 2: [1], 3: [1] },
    reached: { 2: 40, 3: 12 }
  });
  expect(m.ranking).toEqual([
    { seat: 3, got: 1, need: 2 },
    { seat: 2, got: 1, need: 2 },
    { seat: 1, got: 0, need: 2 }
  ]);
});

it('見落とした敵は自分の点の多い順で、1 点に満たない人は出さない', () => {
  const m = at(3, { phase: 'search', overlook: { 3: { 1: 4, 2: 12 }, 2: { 1: 99 } } });
  expect(m.overlooked).toEqual([
    { seat: 2, pts: 12 },
    { seat: 1, pts: 4 }
  ]);
  expect(at(3, { phase: 'search', overlook: { 3: { 1: 0 } } }).overlooked).toEqual([]);
});

it('見落とされた場所は、隠れた人ごとの全ハンターの点の合計の順と、いた部屋の名前', () => {
  const m = at(1, {
    phase: 'reveal',
    hid: [1, 2],
    overlook: { 3: { 1: 4, 2: 12 }, 1: { 2: 3 } },
    spots: { 1: [-16, 0, 10], 2: [12, 0, 6] }
  });
  expect(m.spotted).toEqual([
    { seat: 2, pts: 15, place: '書斎' },
    { seat: 1, pts: 4, place: 'キッチン' }
  ]);
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/match.svelte.test.ts`
Expected: 足したテストが FAIL。

- [ ] **Step 3: 書く**

`match.svelte.ts` の import に `import { placeOf } from './mansion/layout';` を足し、`word` を次にする。

```ts
  get word(): string {
    if (this.phase === 'hide' || this.phase === 'intro') return '探索開始まで';
    if (this.phase === 'reveal') return '答え合わせ';
    if (this.double) return '全員を見つけよう';
    return this.hiding ? '隠れつづけよう' : '探索時間';
  }

  get double(): boolean {
    return this.view.settings.mode === 'double';
  }

  /** ダブルの順位表。見つけた数の多い順、同じ数なら先にその数に届いた順 */
  get ranking(): { seat: Seat; got: number; need: number }[] {
    const v = this.view;
    const need = Math.max(0, v.hid.length - 1);
    const at = (s: Seat) => v.reached[s] ?? Infinity;
    return v.hid
      .map((seat) => ({ seat, got: v.caught[seat]?.length ?? 0, need }))
      .sort((a, b) => b.got - a.got || (at(a.seat) === at(b.seat) ? a.seat - b.seat : at(a.seat) - at(b.seat)));
  }

  /** 自分（ハンター）の見落とした敵。点の多い順で、1 点に満たない人は出さない */
  get overlooked(): { seat: Seat; pts: number }[] {
    return (Object.entries(this.view.overlook[this.me] ?? {}) as [string, number][])
      .map(([s, pts]) => ({ seat: Number(s) as Seat, pts }))
      .filter((r) => r.pts > 0)
      .sort((a, b) => b.pts - a.pts || a.seat - b.seat);
  }

  /** 答え合わせの「見落とされた場所」。隠れた人ごとの全ハンターの点の合計と、いた部屋 */
  get spotted(): { seat: Seat; pts: number; place: string | null }[] {
    const v = this.view;
    return v.hid
      .map((seat) => {
        const spot = v.spots[seat];
        const pts = Object.values(v.overlook).reduce((n, row) => n + (row?.[seat] ?? 0), 0);
        return { seat, pts, place: spot ? placeOf(spot) : null };
      })
      .sort((a, b) => b.pts - a.pts || a.seat - b.seat);
  }
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/match.svelte.test.ts`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Give the match view the double mode's words, ranking and overlook lists"
```

---

### Task 12: ダブルの残した体と小物の種とロビーの席を 1 台で受ける

**Files:**

- Modify: `src/lib/games/yappari-chameleon/session.svelte.ts`
- Modify: `src/lib/games/yappari-chameleon/Plates.svelte`・`TopButtons.svelte`・`Buttons.svelte`（ハンター希望の印とボタンをなくす）
- Test: `src/lib/games/yappari-chameleon/session.svelte.test.ts`、`Overlay.svelte.test.ts`

**Interfaces:**

- Consumes: Task 8 の `World.arrange`、Task 5 の `World.podium` と `SPAWNS.lobby`、Task 10 の `left`・`leftDabs`・ダブルの `found`、Task 11 の `Match.double`。
- Produces: `Session.pinPaint(seat): number | null`（その人の残した体か撃たれた場所の体の塗りの数。headless の確かめが読む）。`Session.wish()` と `Plate.wish` をなくす。`Plate` は `{ seat, x, y }`（ええやんの数は Task 14 で足す）。

ダブルの残した体は、2a で増え鬼の答え合わせに使った撃たれた場所の体（`#pins` の `Remote` に、`Show.pin` で動きの代わりの体を渡す）と同じ作りにする。`#pin(seat, paint)` は作るときに渡した塗りを `Remote.log` へ写すので、作り直し（`restore`）と、戻った子が `leftDabs` で受ける塗りは `Remote` の列を使う。

| ダブルの体         | 自分の画面                   | ほかの人の画面             | 答え合わせ                                 |
| ------------------ | ---------------------------- | -------------------------- | ------------------------------------------ |
| 自分の残した体     | 出す（自分の弾は当たらない） | まだ見つけていなければ出す | 出す。誰かに見つかっていれば青、まだなら赤 |
| ほかの人の残した体 | 自分が見つけたら消す         | その人が見つけるまで出す   | 同上                                       |
| 探す人の体         | 一人称（三人称なら自分の体） | 白い体で銃を構える         | そのまま                                   |

- [ ] **Step 1: 落ちるテストを書く**

`session.svelte.test.ts` の偽の `Remote` に、最後の見せ方を覚える口を足す（`update` を次にし、`lastShow` を足す）。

```ts
    lastShow: { visible: boolean; pin?: Me | null; shine?: unknown } | null = null;
    update(_dt: number, _now: number, show: { visible: boolean; pin?: Me | null; shine?: unknown }) {
      this.lastShow = show;
      // 本物と同じく、見せる体の様子は更新のときに決まる
      this.shown = show.pin ?? this.last;
      this.rig.root.visible = !!this.shown && show.visible;
    }
```

`made.remotes` の型を `{ log: unknown[]; rig: { paint: { rebuild: unknown } }; dabs: unknown; lastShow: { visible: boolean; shine?: unknown } | null }[]` にする。`fakeWorld` に `arrange: vi.fn(),`・`podium: vi.fn(),` を足す。ファイルの最後に足す。

```ts
const double = { ...DEFAULTS, mode: 'double' } as const;
const hunters = { 1: 'hunter', 2: 'hunter', 3: 'hunter' } as const;
const hiders = { 1: 'hider', 2: 'hider', 3: 'hider' } as const;

describe('Session のロビーと小物', () => {
  it('ロビーではロビーの部屋の席の場所に出て、北の台を向く', () => {
    const { play, tell } = setup();
    play.camYaw = 2;
    tell(at('lobby'));
    expect(play.body.pos).toEqual([...SPAWNS.lobby[2]]);
    expect(play.camYaw).toBe(0);
  });

  it('種の入った様子で小物を置き直し、同じ種では置き直さない', () => {
    const { play, tell } = setup();
    tell(at('lobby'));
    tell(at('intro', { seed: 5 }));
    tell(at('hide', { seed: 5 }));
    tell(at('lobby', { seed: null }));
    expect(vi.mocked(play.world.arrange).mock.calls).toEqual([[null], [5], [null]]);
  });

  it('3D を作るあいだに届いていた種も、最初の様子で置く（戻った子と途中で来た子）', () => {
    const { play } = setup(2, { messages: [at('hide', { seed: 9 })], stop: vi.fn() });
    expect(play.world.arrange).toHaveBeenCalledWith(9);
  });

  it('台に誰かが乗っているあいだだけ、台の縁を光らせる', () => {
    const { s, play, tell } = setup();
    tell(at('lobby', { wishes: [3] }));
    s.frame(1 / 60, 0);
    expect(play.world.podium).toHaveBeenLastCalledWith(true);
    tell(at('lobby', { wishes: [] }));
    s.frame(1 / 60, 16);
    expect(play.world.podium).toHaveBeenLastCalledWith(false);
  });
});

describe('Session のダブル', () => {
  /** 2 の画面。1 と 3 の体と塗りが届き、自分も塗ってから、残した体の知らせと探索の様子が来る */
  function doubled() {
    const x = setup();
    x.tell(meMsg(1, { pos: [1, 0, 1] }));
    x.tell(meMsg(3, { pos: [3, 0, 3] }));
    x.tell(at('lobby'));
    x.tell(at('hide', { settings: double, roles: hiders, first: [], hid: [1, 2, 3] }));
    const live1 = made.remotes.find((r) => (r as unknown as { last: Me }).last?.pos[0] === 1)!;
    live1.log.push(dab(5));
    x.play.applyDabs([dab(0), dab(1)]);
    const before = made.remotes.length;
    for (const seat of [1, 2, 3] as Seat[]) x.tell({ t: 'left', seat, body: body({ pos: [seat, 0, 9], pose: 'lie' }) });
    x.tell(at('search', { settings: double, roles: hunters, first: [], hid: [1, 2, 3] }));
    const pins = made.remotes.slice(before);
    return { ...x, pins };
  }

  it('探索に入ると、全員の残した体をそのときの塗りで置き、自分は白い体で入口から探す', () => {
    const { play, pins } = doubled();
    expect(pins).toHaveLength(3);
    expect(pins[0].rig.paint.rebuild).toHaveBeenCalledWith([dab(5)]);
    expect(pins[1].rig.paint.rebuild).toHaveBeenCalledWith([dab(0), dab(1)]);
    expect(play.log.dabs).toHaveLength(0);
    expect(play.role).toBe('hunter');
    expect(play.ghost.pos).toEqual([...SPAWNS.entrance[2]]);
  });

  it('見つけた体は見つけた人の画面からだけ消え、答え合わせでは見つかった体を青、まだの体を赤で出す', () => {
    const { tell, frames, pins } = doubled();
    tell({ t: 'found', seat: 1, by: 3, at: [1, 1, 9] });
    tell(at('search', { settings: double, roles: hunters, first: [], hid: [1, 2, 3], caught: { 3: [1] } }));
    frames(0.1);
    expect(pins[0].lastShow?.visible).toBe(true);
    tell({ t: 'found', seat: 3, by: 2, at: [3, 1, 9] });
    tell(at('search', { settings: double, roles: hunters, first: [], hid: [1, 2, 3], caught: { 3: [1], 2: [3] } }));
    frames(0.1);
    expect(pins[2].lastShow?.visible).toBe(false);
    tell(
      at('reveal', {
        settings: double,
        roles: hunters,
        first: [],
        hid: [1, 2, 3],
        caught: { 3: [1], 2: [3] },
        winner: 'double'
      })
    );
    frames(0.1);
    expect(pins.map((p) => [p.lastShow?.visible, p.lastShow?.shine])).toEqual([
      [true, 'blue'],
      [true, 'red'],
      [true, 'blue']
    ]);
  });

  it('ダブルで戻った子は、残した体を leftDabs の塗りで作り直し、ハンターの続きの場所から探す', () => {
    const d = packDabs([dab(0), dab(1), dab(2)]);
    const messages = [
      meMsg(2, { pos: [7, 0, 5], yaw: 1.5, pose: AIM.id }),
      { t: 'dabs', seat: 2, at: 0, d: [] },
      { t: 'left', seat: 2, body: body({ pos: [2, 0, 9] }) },
      { t: 'leftDabs', seat: 2, at: 0, d },
      at('search', { settings: double, roles: hunters, first: [], hid: [1, 2, 3], seed: 4 })
    ] as Message[];
    const before = made.remotes.length;
    const { s, play } = setup(2, { messages, stop: vi.fn() });
    const pin = made.remotes[before];
    expect(pin.dabs).toHaveBeenCalledWith(0, d);
    expect(play.role).toBe('hunter');
    expect(play.ghost.pos).toEqual([7, 0, 5]);
    expect(play.world.arrange).toHaveBeenCalledWith(4);
    expect(s.pinPaint(2)).toBe(0);
  });
});
```

（偽の `Remote` の `dabs` は数えるだけの `vi.fn()` なので、`pinPaint` は作ったときに写した塗りの数 0 を返す。）

`session.svelte.test.ts` の「最後の隠れる人が撃たれて答え合わせに入っても」の `expect(play.ghost.pos).toEqual([...SPAWNS.hall[2]]);` を `expect(play.ghost.pos).toEqual([...SPAWNS.lobby[2]]);` にする（ロビーで置いた場所のまま探索の様子が来る台本なので）。

`Overlay.svelte.test.ts` の「ロビーでは右の列にハンター希望と挑発、上に親のマップの設定を出す」を次にする。

```ts
it('ロビーでは右の列に挑発、上に親のマップの設定を出し、ハンター希望のボタンは無い（台に乗る）', () => {
  const { labels, done } = show('hider', { phase: 'lobby' });
  expect(labels()).toEqual(expect.arrayContaining(['挑発', 'マップの設定']));
  expect(labels()).not.toContain('ハンター希望');
  done();
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts src/lib/games/yappari-chameleon/Overlay.svelte.test.ts`
Expected: 足したテストが FAIL。

- [ ] **Step 3: 種とロビーの席**

`session.svelte.ts` の `Session` に足す。

```ts
  /** 今の小物の置き方の種。最初の様子で必ず当てるよう、まだ当てていないあいだは undefined */
  #seed: number | null | undefined = undefined;
  /** ダブルの残した体（席 → 隠れタイムの終わりの体） */
  readonly #lefts = new SvelteMap<Seat, Me>();
```

`#phase` の頭に足す。

```ts
// 戻った子と途中で来た子は最初の様子で種を受けるので、フェーズの変わり目だけでなく、届くたびに見る
if (v.seed !== this.#seed) {
  this.#seed = v.seed;
  this.play.world.arrange(v.seed);
}
```

`#place` を次にする。

```ts
  /** 体を始める場所へ移す。ロビーはロビーの部屋、待っているハンターは控室、ほかは大広間 */
  #place() {
    const p = this.match.phase;
    const room = this.match.role === 'hunter' && (p === 'intro' || p === 'hide');
    this.play.placeAt(SPAWNS[p === 'lobby' ? 'lobby' : room ? 'room' : 'hall'][this.match.me]);
    // 始める場所はどれも北（+z）を向いている。ロビーなら台、大広間なら屋敷の奥が見える
    this.play.camYaw = 0;
  }
```

- [ ] **Step 4: ダブルの残した体**

`#receive` の `else if (m.t === 'toot') ...` の前に足す。

```ts
    else if (m.t === 'left') this.#onLeft(seat, m.body as Me);
    else if (m.t === 'leftDabs') this.#pins.get(seat)?.dabs(m.at as number, m.d as number[]);
```

`#pin` を次にし、`restore` の最後の行を `for (const r of this.#pins.values()) r.rig.paint.rebuild(r.log);` にする。

```ts
  /** 撃たれた場所（増え鬼の答え合わせ）か残した場所（ダブル）に置く 2 つめの体。作るときの塗りを写して塗る */
  #pin(seat: Seat, paint: readonly Dab[]): Remote {
    let r = this.#pins.get(seat);
    if (!r) {
      r = new Remote(this.#makeRig(), this.play.world.scene);
      r.log.push(...paint);
      r.rig.paint.rebuild(r.log);
      this.#pins.set(seat, r);
    }
    return r;
  }

  /**
   * ダブルの残した体。親は探索の様子より先にこれを送るので、まだ白に戻っていない今の塗り（自分の列か、その人の Remote の列）を写す。
   * 戻った子は塗りがもう白いので、あとから届く leftDabs で塗り直す
   */
  #onLeft(seat: Seat, body: Me) {
    if (this.#pins.has(seat)) return;
    this.#lefts.set(seat, body);
    this.#pin(seat, [...(seat === this.match.me ? this.play.log.dabs : this.#remote(seat).log)]);
  }

  /** ダブルで、自分がもう見つけた体（探索のあいだは自分の画面から消す） */
  #caught(seat: Seat): boolean {
    return this.match.phase !== 'reveal' && (this.match.view.caught[this.match.me] ?? []).includes(seat);
  }

  /** ダブルの答え合わせで、誰かに見つかった体は青、まだの体は赤 */
  #leftShine(seat: Seat): Shine {
    if (this.match.phase !== 'reveal') return null;
    return Object.values(this.match.view.caught).some((got) => got?.includes(seat)) ? 'blue' : 'red';
  }

  /** その人の残した体（ダブル）か撃たれた場所の体（増え鬼）の塗りの数。headless の確かめが読む */
  pinPaint(seat: Seat): number | null {
    return this.#pins.get(seat)?.log.length ?? null;
  }
```

`frame` の `for (const [seat, r] of this.#remotes) { ... }` の中の `if (body) this.#pin(seat, r).update(...)` を `if (body) this.#pin(seat, this.#snaps.get(seat) ?? r.log).update(dt, now, { pin: body, visible: true, armed: false, shine: 'blue' });` にし、そのループのすぐ下に足す。

```ts
for (const [seat, body] of this.#lefts)
  this.#pins
    .get(seat)
    ?.update(dt, now, { pin: body, visible: !this.#caught(seat), armed: false, shine: this.#leftShine(seat) });
```

`#enter` の `this.#fit(null);` の前に足す。

```ts
// ダブルの探す人は新しい白い体で入る（残した体は left の知らせで先に写してある）
if (p === 'search' && this.match.double) {
  this.play.interrupt();
  this.play.log.clear();
  this.play.rebuildPaint();
  this.play.canUndo = false;
}
```

`#reset` の `this.#pins.clear();` の下に `this.#lefts.clear();` を足す。

`#onFound` の頭に足す。

```ts
if (this.match.double) {
  // 見つけた体はその人の画面からだけ消えるので、ほかの人の画面では何も起きない
  const pin = this.#pins.get(seat);
  if (by !== this.match.me || quiet || !pin) return;
  const at = pin.center();
  if (at) this.#fx.shatter(at, pin.colors());
  sounds.shatter();
  sounds.found();
  return;
}
```

`shoot` の `targets` を作る `for` を次にする（手元の筋の当たりも親と同じ的にする）。

```ts
if (this.match.double) {
  for (const [seat, b] of this.#lefts)
    if (seat !== this.match.me && !this.#caught(seat))
      targets.push({ seat, caps: capsules(poseById(b.pose), placement(b)) });
} else
  for (const [seat, r] of this.#remotes)
    if (r.shown && r.rig.root.visible && this.match.roleOf(seat) === 'hider')
      targets.push({ seat, caps: capsules(poseById(r.shown.pose), placement(r.shown)) });
```

`frame` の `this.#glow.set(...)` の下に `w.podium(m.phase === 'lobby' && m.view.wishes.length > 0);` を足す。

`#plates` を次にする（ダブルの答え合わせは、探す人の体ではなく残した体の上に札を出す）。

```ts
  #plates() {
    const p = this.match.phase;
    if (p !== 'lobby' && p !== 'reveal') {
      if (this.plates.length) this.plates = [];
      return;
    }
    const w = this.play.world;
    const out: Plate[] = [];
    const add = (seat: Seat, head: V3 | null) => {
      const at = head && w.screen(head);
      if (at) out.push({ seat, ...at });
    };
    if (p === 'reveal' && this.match.double) {
      for (const [seat, r] of this.#pins) if (r.rig.root.visible) add(seat, r.head());
      this.plates = out;
      return;
    }
    if (w.rig.root.visible) {
      const h = w.rig.root.localToWorld(new THREE.Vector3(0, HEAD_Y, 0));
      add(this.match.me, [h.x, h.y, h.z]);
    }
    for (const [seat, r] of this.#remotes) if (r.rig.root.visible) add(seat, r.head());
    this.plates = out;
  }
```

`Plate` から `wish` を消し、`wish()` の関数を消す。import に `type Shine` を足す（`import { Glow, type Shine } from './glow';` はすでにある）。

- [ ] **Step 5: ハンター希望のボタンと印をなくす**

`TopButtons.svelte` から `wished` と `{#if match.phase === 'lobby'} ... ハンター希望 ... {/if}` の段と `.mark`・`.wish.on`・`.wish.on .mark` の style を消す（`match` を使わなくなったら `const match` も消す）。`Plates.svelte` から `{#if p.wish}...{/if}` と `.wish` の style を消す。`Buttons.svelte` の props のコメントの「（挑発・ハンター希望）」を「（挑発）」にする。

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Show the double mode's left bodies, apply the prop seed and seat everyone in the lobby room"
```

---

### Task 13: ハンターの三人称

**Files:**

- Modify: `src/lib/games/yappari-chameleon/play.svelte.ts`（`tps` とカメラ）
- Modify: `src/lib/games/yappari-chameleon/world3d.ts`（自分の体に銃を持たせる）
- Modify: `src/lib/games/yappari-chameleon/session.svelte.ts`（三人称の体・銃・弾の筋の始まり）
- Test: `src/lib/games/yappari-chameleon/play.svelte.test.ts`、`session.svelte.test.ts`

**Interfaces:**

- Produces: `Play.tps`（`$state`）、`Play.toggleTps()`（ハンターだけ）。`World.holdGun(on)`、`World.gunMuzzle(): V3`。

三人称のカメラは隠れる人の歩きのカメラと同じ `World.follow`（画角 60、距離 2.4m、壁の手前で止める）で、見る点は体の右肩の上（体の中心から右へ 0.45m、高さ 1.2m）。画面の中央の十字が自分の体に隠れないようにするため。弾は今のまま `Session.shoot` がカメラの位置から十字（カメラの向き）へ飛ばすので、三人称でも変えない。弾の筋は自分の体の銃口から引く。三人称のあいだは透かし窓（`xray`）を使わない（ハンターが自分のまわりの物を透かして隠れる人を見られてしまう）。ハンターになり直すと一人称から始める。

- [ ] **Step 1: 落ちるテストを書く**

`play.svelte.test.ts` の `describe('Play の役', ...)` の最後に足す（import に `AIM` を `import { AIM } from './poses';` で足す）。

```ts
it('ハンターの三人称は、体の右肩の上を見る歩きと同じ追い方のカメラで、もう一度押すと一人称に戻る', () => {
  const w = fakeWorld();
  const p = new Play(w, 70);
  p.hunt([2, 0, 1], 0.5);
  p.toggleTps();
  expect(p.tps).toBe(true);
  vi.mocked(w.follow).mockClear();
  vi.mocked(w.eye).mockClear();
  p.frame(1 / 60, 0);
  expect(w.eye).not.toHaveBeenCalled();
  const [target, yaw, , dist, fov] = vi.mocked(w.follow).mock.lastCall!;
  expect(target[0]).toBeCloseTo(2 - Math.cos(0.5) * 0.45);
  expect(target[1]).toBeCloseTo(1.2);
  expect(target[2]).toBeCloseTo(1 + Math.sin(0.5) * 0.45);
  expect([yaw, dist, fov]).toEqual([0.5, 2.4, 60]);
  p.toggleTps();
  vi.mocked(w.eye).mockClear();
  p.frame(1 / 60, 0);
  expect(w.eye).toHaveBeenCalled();
});

it('三人称のあいだは自分の体を目の場所に、銃を構えたポーズで置く', () => {
  const w = fakeWorld();
  const p = new Play(w, 70);
  p.hunt([2, 0, 1], 0.5);
  p.toggleTps();
  p.frame(1 / 60, 0);
  const placed = vi.mocked(w.placeDoll).mock.lastCall![0];
  expect(placed.pos).toEqual([2, 0, 1]);
  expect(placed.yaw).toBe(0.5);
  expect(w.poses.to).toHaveBeenLastCalledWith(AIM);
});

it('隠れる人と観戦では三人称に切り替わらず、ハンターになり直すと一人称から', () => {
  const p = new Play(fakeWorld(), 70);
  p.toggleTps();
  expect(p.tps).toBe(false);
  p.spectate();
  p.toggleTps();
  expect(p.tps).toBe(false);
  p.hunt([0, 0, 0], 0);
  p.toggleTps();
  p.hunt([0, 0, 0], 0);
  expect(p.tps).toBe(false);
});
```

`session.svelte.test.ts` の `fakeWorld` に `holdGun: vi.fn(),`・`gunMuzzle: () => [9, 9, 9],` を足し、`describe('Session の役の切り替え', ...)` の最後に足す。

```ts
it('ハンターの三人称では、一人称の手と銃を隠して自分の体と銃を出し、筋は体の銃口から引く', () => {
  const { s, play, tell, frames, acts } = setup(3);
  tell(at('lobby'));
  tell(at('search'));
  play.toggleTps();
  frames(0.1);
  expect(made.guns.at(-1)!.visible).toBe(false);
  expect(play.world.rig.root.visible).toBe(true);
  expect(play.world.holdGun).toHaveBeenLastCalledWith(true);
  s.shoot();
  expect(acts.find((m) => m.t === 'shot')!.from).toEqual([9, 9, 9]);
});

it('ハンターは動きにカメラの位置を載せ、隠れる人は載せない', () => {
  const hunter = setup(3);
  hunter.tell(at('lobby'));
  hunter.tell(at('search'));
  hunter.play.world.camera.position.set(1, 2, 3);
  hunter.s.frame(1 / 60, 1000);
  const me = hunter.acts.findLast((m) => m.t === 'me') as unknown as Me;
  expect(me.eye).toEqual([1, 2, 3]);
  const hider = setup(2);
  hider.tell(at('hide'));
  hider.frames(0.1);
  expect((hider.acts.findLast((m) => m.t === 'me') as unknown as Me).eye).toBeNull();
});
```

（偽の world の `eye` と `follow` は何もしないので、`Play.frame` のあとでもカメラは置いた位置のまま。）

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/play.svelte.test.ts src/lib/games/yappari-chameleon/session.svelte.test.ts`
Expected: 足したテストが FAIL（`toggleTps` が無い）。

- [ ] **Step 3: Play に三人称を足す**

`play.svelte.ts` の import に `import { AIM, poseById, STAND } from './poses';`（`AIM` を足す）を、定数に足す。

```ts
/**
 * ハンターの三人称のカメラが見る点。体の中心から右へ TPS_SIDE、高さ TPS_LIFT（肩の上）。
 * 画面の中央の十字が自分の体に隠れないように、体を左へずらして見る
 */
const TPS_SIDE = 0.45;
const TPS_LIFT = 1.2;
const TPS_DIST = 2.4;
```

`crouch = $state(false);` の下に足す。

```ts
/** ハンターの三人称。弾はカメラの位置から十字の向きへ飛ぶので、撃ち方は一人称と同じ */
tps = $state(false);
```

`hunt` と `spectate` と `unhunt` の中の `this.crouch = false;` の下に、それぞれ `this.tps = false;` を足す。`toggleEye` の下に足す。

```ts
  toggleTps(): void {
    if (this.role !== 'hunter') return;
    this.tps = !this.tps;
    this.eyePitch = Math.min(CAM_PITCH_MAX, Math.max(CAM_PITCH_MIN, this.eyePitch));
    this.world.snapCamera();
  }
```

`frame` の `else if (this.mode === 'eye') {` の枝の `const [lo, hi] = ...` を `const [lo, hi] = this.watch || this.tps ? [CAM_PITCH_MIN, CAM_PITCH_MAX] : [-1.3, 1.3];` にする（三人称は歩きのカメラの範囲で止める）。`w.placeDoll(this.body);` を次にする。

```ts
const tps = this.role === 'hunter' && this.tps;
if (tps) {
  const want = this.crouch ? 'crouch' : AIM.id;
  if (this.pose !== want) this.setPose(want);
}
w.placeDoll(tps ? { ...this.ghost, yaw: this.eyeYaw } : this.body);
```

カメラの分かれ道の `else if (this.watch) w.follow(...);` の下に足す。

```ts
    else if (tps) {
      const g = this.ghost.pos;
      const lift = TPS_LIFT - (this.crouch ? CROUCH : 0);
      const target: V3 = [g[0] - Math.cos(this.eyeYaw) * TPS_SIDE, g[1] + lift, g[2] + Math.sin(this.eyeYaw) * TPS_SIDE];
      w.follow(target, this.eyeYaw, this.eyePitch, TPS_DIST, 60, dt, [g[0], g[1] + 0.4, g[2]]);
    }
```

（画面の右は、向き (sin yaw, cos yaw) を右へ 90 度回した (−cos yaw, sin yaw)。`#input` のコメントと同じ。）

- [ ] **Step 4: 自分の体に銃を持たせる**

`world3d.ts` の import を `import { brushModel, disposeModel, gunModel, inHand, MUZZLE } from './gun';` にし、`#brush = brushModel();` の下に `#gun = gunModel();` を足す。コンストラクタの `inHand(this.rig.bones['forearm.r'], this.#brush, 'brush');` の下に `inHand(this.rig.bones['forearm.r'], this.#gun, 'gun');` を足し、`holdBrush` の下に足す。

```ts
  /** 三人称のハンターのあいだ、自分の体に銃を持たせる */
  holdGun(on: boolean): void {
    this.#gun.visible = on;
  }

  /** 自分の体の銃口（三人称の弾の筋の始まり） */
  gunMuzzle(): V3 {
    this.rig.root.updateMatrixWorld(true);
    const p = this.#gun.localToWorld(new THREE.Vector3(...MUZZLE));
    return [p.x, p.y, p.z];
  }
```

`dispose` の `disposeModel(this.#brush);` の下に `disposeModel(this.#gun);` を足す。

- [ ] **Step 5: Session に三人称をつなぐ**

`session.svelte.ts` の `frame` の 3 行を次にする。

```ts
const tps = this.play.role === 'hunter' && this.play.tps;
w.rig.root.visible = ((this.play.role === 'hider' || tps) && !this.#shatter.has(me)) || pinned;
this.#glow.set(w.rig.root.visible && !tps ? this.#shine(me) : null);
this.#gun.visible = this.play.role === 'hunter' && !this.play.tps;
w.holdGun(tps);
```

（元の `w.rig.root.visible = ...`・`this.#glow.set(...)`・`this.#gun.visible = ...` の 3 行を置き換える。）`shoot` の `const from = this.#gun.muzzle();` を `const from = this.play.tps ? this.play.world.gunMuzzle() : this.#gun.muzzle();` にする。

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Let hunters switch to a third-person camera that shows their own armed body"
```

---

### Task 14: ええやん・埋まりの印と警告を 1 台で受ける

**Files:**

- Create: `src/lib/games/yappari-chameleon/markers.ts`
- Modify: `src/lib/games/yappari-chameleon/session.svelte.ts`
- Test: `src/lib/games/yappari-chameleon/session.svelte.test.ts`

**Interfaces:**

- Produces: `Markers`（`set(points: V3[], dt)`・`dispose()`）。`Session.like(seat)`（act `{ t: 'iine', to }`）・`Session.buried`（自分が隠れていて埋まっている）・`Plate.likes: number`（答え合わせのええやんの数）。

埋まりすぎて 5 秒たった人の印は、探索のあいだハンターの画面だけに出す。印は頭の上 0.5m の赤い下向きの円すいで、深さを見ずに描く（壁を透かして見える）。上下にゆっくり揺らし、明滅はさせない（大群の中の点滅がチカチカに見えた、アニマルサバイバーの決めごとと同じ）。

- [ ] **Step 1: 落ちるテストを書く**

`session.svelte.test.ts` に偽の `Markers` を足す（`vi.mock('./glow', ...)` の下）。

```ts
const marks = vi.hoisted(() => ({ last: [] as number[][] }));
vi.mock('./markers', () => ({
  Markers: class {
    set(points: number[][]) {
      marks.last = points;
    }
    dispose = vi.fn();
  }
}));
```

偽の `Remote` の `head = () => null;` を `head = () => (this.shown ? [this.shown.pos[0], 1.35, this.shown.pos[2]] : null);` にする。ファイルの最後に足す。

```ts
describe('Session のええやんと埋まり', () => {
  it('ハンターには、埋まりすぎて場所を知らされた人の頭の上に印を出し、隠れる人には出さない', () => {
    const hunter = setup(3);
    hunter.tell(meMsg(1, { pos: [4, 0, 4] }));
    hunter.tell(at('lobby'));
    hunter.tell(at('search', { exposed: [1], buried: [1] }));
    hunter.frames(0.2);
    expect(marks.last).toEqual([[4, 1.35, 4]]);
    const hider = setup(2);
    hider.tell(meMsg(1, { pos: [4, 0, 4] }));
    hider.tell(at('search', { exposed: [1], buried: [1] }));
    hider.frames(0.2);
    expect(marks.last).toEqual([]);
  });

  it('埋まっているあいだ、隠れている本人にだけ警告を出す', () => {
    const { s, tell } = setup(2);
    tell(at('hide', { buried: [2] }));
    expect(s.buried).toBe(true);
    tell(at('hide', { buried: [] }));
    expect(s.buried).toBe(false);
    const hunter = setup(3);
    hunter.tell(at('search', { buried: [3] }));
    expect(hunter.s.buried).toBe(false);
  });

  it('ええやんは答え合わせのあいだ、自分以外の隠れた人に 1 回だけ送る', () => {
    const { s, tell, acts } = setup(3);
    s.like(1);
    tell(at('reveal', { hid: [1, 2], winner: 'chameleon' }));
    s.like(3);
    s.like(1);
    expect(acts.filter((m) => m.t === 'iine')).toEqual([{ t: 'iine', to: 1 }]);
    tell(at('reveal', { hid: [1, 2], winner: 'chameleon', liked: [3], likes: { 1: 1 } }));
    s.like(2);
    expect(acts.filter((m) => m.t === 'iine')).toHaveLength(1);
  });

  it('答え合わせの名前の札には、ええやんの数を載せる', () => {
    const { s, tell, frames } = setup(3);
    tell(meMsg(1, { pos: [4, 0, 4] }));
    tell(at('reveal', { hid: [1, 2], winner: 'chameleon', likes: { 1: 2 } }));
    frames(0.1);
    expect(s.plates.find((p) => p.seat === 1)?.likes).toBe(2);
  });
});
```

（偽の world の `screen` はどの点にも `{ x: 0, y: 0 }` を返すので、見えている体には札が出る。）

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts`
Expected: 足したテストが FAIL。

- [ ] **Step 3: 印を書く**

`src/lib/games/yappari-chameleon/markers.ts`:

```ts
import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';

/** 埋まりすぎた人の場所の印。赤い下向きの円すいを頭の上に浮かべ、深さを見ずに描いて壁を透かして見せる */
export class Markers {
  readonly #scene: THREE.Scene;
  readonly #geo = new THREE.ConeGeometry(0.16, 0.4, 16);
  readonly #mat = new THREE.MeshBasicMaterial({
    color: '#ff3b30',
    transparent: true,
    opacity: 0.9,
    depthTest: false,
    depthWrite: false
  });
  readonly #arrows: THREE.Mesh[] = [];
  #t = 0;

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
  }

  /** 頭の位置の並び。揺らすだけで明滅はさせない */
  set(points: V3[], dt: number): void {
    this.#t += dt;
    while (this.#arrows.length < points.length) {
      const m = new THREE.Mesh(this.#geo, this.#mat);
      m.rotation.x = Math.PI;
      m.renderOrder = 30;
      this.#scene.add(m);
      this.#arrows.push(m);
    }
    this.#arrows.forEach((m, i) => {
      const p = points[i];
      m.visible = !!p;
      if (p) m.position.set(p[0], p[1] + 0.5 + Math.sin(this.#t * 3) * 0.06, p[2]);
    });
  }

  dispose(): void {
    for (const m of this.#arrows) m.removeFromParent();
    this.#geo.dispose();
    this.#mat.dispose();
  }
}
```

- [ ] **Step 4: Session につなぐ**

`session.svelte.ts` の import に `import { Markers } from './markers';` を足し、`Plate` に足す。

```ts
/** 答え合わせで受けたええやんの数 */
likes: number;
```

`readonly #glow: Glow;` の下に `readonly #marks: Markers;` を、コンストラクタの `this.#glow = new Glow(w.rig);` の下に `this.#marks = new Markers(w.scene);` を足す。`frame` の `this.#fx.step(dt);` の上に足す。

```ts
this.#marks.set(this.#exposed(), dt);
```

`#plates` の `add` の中の `out.push({ seat, ...at })` を `out.push({ seat, ...at, likes: p === 'reveal' ? (this.match.view.likes[seat] ?? 0) : 0 })` にする。`ready()` の上に足す。

```ts
  /** 埋まりすぎて場所を知らされた人の頭。探索のあいだ、ハンターの画面だけに出す */
  #exposed(): V3[] {
    const m = this.match;
    if (this.play.role !== 'hunter' || m.phase !== 'search') return [];
    const out: V3[] = [];
    for (const seat of m.view.exposed) {
      if (seat === m.me) continue;
      const r = m.double ? (this.#caught(seat) ? undefined : this.#pins.get(seat)) : this.#remotes.get(seat);
      const head = r?.rig.root.visible ? r.head() : null;
      if (head) out.push(head);
    }
    return out;
  }

  /** 自分の体が埋まっている（隠れているあいだだけ警告を出す） */
  get buried(): boolean {
    return this.match.hiding && this.match.view.buried.includes(this.match.me);
  }

  /** ええやん。答え合わせのあいだ、自分以外の隠れた人に 1 試合 1 回 */
  like(seat: Seat): void {
    const m = this.match;
    if (m.phase !== 'reveal' || seat === m.me || !m.view.hid.includes(seat) || m.view.liked.includes(m.me)) return;
    if (this.#liked) return;
    this.#liked = true;
    this.party.act({ t: 'iine', to: seat });
  }
```

`#sent = -Infinity;` の上に足す。

```ts
  /** この答え合わせでええやんを送った。親の数が届く前に 2 回押しても、2 つめを送らない */
  #liked = false;
```

`#enter` の頭に `if (this.match.phase === 'reveal') this.#liked = false;` を足す。`dispose` の `this.#glow.dispose();` の下に `this.#marks.dispose();` を足す。

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS（`Plates.svelte` はまだ `likes` を出さないが、型は通る）。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Send likes, mark exposed hiders for hunters and flag a buried body to its owner"
```

---

### Task 15: ダブルの HUD と順位表・マゼンタの紹介・設定・札のええやん

**Files:**

- Create: `src/lib/games/yappari-chameleon/Ranking.svelte`
- Modify: `src/lib/games/yappari-chameleon/Hud.svelte`・`Intro.svelte`・`Settings.svelte`・`Plates.svelte`・`Overlay.svelte`
- Modify: `src/lib/icons.ts`（親指 `thumb`）
- Test: `src/lib/games/yappari-chameleon/Hud.svelte.test.ts`・`Lobby.svelte.test.ts`・`Overlay.svelte.test.ts`、`src/lib/games/yappari-chameleon/Plates.svelte.test.ts`（新しく作る）

**Interfaces:**

- Consumes: Task 1 の `MODES[mode].color`、Task 11 の `Match.double`・`ranking`、Task 14 の `Plate.likes`。
- Produces: `Ranking.svelte`（props `{ match: Match }`）。`Overlay.svelte` の左の列 `.side`（Task 16 が一覧を足す）。

| 画面         | ダブルのとき                                                                     |
| ------------ | -------------------------------------------------------------------------------- |
| 紹介         | モード名「ダブル」をマゼンタ（`#e8399c`）、説明 2 行                             |
| 上の HUD     | 白い人形を出さず、赤い人形を隠れた人の数だけ。残り人数は出さない                 |
| 左           | 探索と答え合わせのあいだ、順位表（`#1 プレイヤー2 2/2`、自分の行は黄色）         |
| マップの設定 | ゲームモードに「ダブル」。ダブルのあいだハンターの人数の段を薄くして押せなくする |

マップの設定に「ハンターに見逃しランキングを表示」（オン・オフ）の段を足す。札は、答え合わせでええやんを受けた数があれば、名前の右に親指と数を出す。

- [ ] **Step 1: 落ちるテストを書く**

`Hud.svelte.test.ts` の `describe('Hud', ...)` の最後に足す。

```ts
it('ダブルでは白い人形と残り人数を出さず、赤い人形を隠れた人の数だけ出し、モード名をマゼンタにする', () => {
  const roles = { 1: 'hunter', 2: 'hunter', 3: 'hunter' } as const;
  const settings = { ...DEFAULTS, mode: 'double' } as const;
  const { target, done } = show(1, { phase: 'search', settings, roles, hid: [1, 2, 3] }, { role: 'hunter' });
  expect(target.querySelector('.white')).toBeNull();
  expect(target.querySelectorAll('.red svg')).toHaveLength(3);
  expect(target.textContent).toContain('全員を見つけよう');
  // happy-dom は書いた色をそのまま返すことがあるので、どちらの書き方も受ける
  expect(['#e8399c', 'rgb(232, 57, 156)']).toContain(target.querySelector<HTMLElement>('.mode .name')?.style.color);
  done();
});
```

`Lobby.svelte.test.ts` の「親はマップの設定を開いて変え」の項目名の並びの最後に `'ハンターに見逃しランキングを表示'` を足し、`describe('Lobby', ...)` の最後に足す。

```ts
it('ダブルではハンターの人数を薄くして押せなくし、見逃しランキングはオフにできる', () => {
  const { target, start, button, done } = show(true, [1, 2, 3]);
  button('マップの設定')!.click();
  flushSync();
  button('ダブル')!.click();
  flushSync();
  expect(target.querySelector('.row.dim')?.textContent).toContain('ハンターの人数');
  expect(button('＋')!.disabled).toBe(true);
  button('オフ')!.click();
  flushSync();
  button('ゲームを始める')!.click();
  expect(start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'double', overlook: false }));
  done();
});
```

`src/lib/games/yappari-chameleon/Plates.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import Plates from './Plates.svelte';

describe('Plates', () => {
  it('名前の札に、ええやんを受けた数があれば親指と数を出す', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Plates, {
      target,
      props: {
        plates: [
          { seat: 1, x: 10, y: 20, likes: 2 },
          { seat: 2, x: 30, y: 20, likes: 0 }
        ]
      }
    });
    flushSync();
    const [one, two] = target.querySelectorAll('.plate');
    expect(one.textContent).toContain('プレイヤー1');
    expect(one.querySelector('.likes')?.textContent).toBe('2');
    expect(one.querySelector('.likes svg')).not.toBeNull();
    expect(two.querySelector('.likes')).toBeNull();
    unmount(app);
  });
});
```

`Overlay.svelte.test.ts` の `show` の `play` に `tps: false, toggleTps: vi.fn(),` を、`session` に `buried: false, like: vi.fn(),` を足し、`describe('Overlay', ...)` の最後に足す。

```ts
it('ダブルの探索と答え合わせでは、左に順位表を出す', () => {
  const settings = { ...DEFAULTS, mode: 'double' } as const;
  const roles = { 1: 'hunter', 2: 'hunter' } as const;
  const { target, done } = show('hunter', { phase: 'search', settings, roles, hid: [1, 2], caught: { 2: [1] } }, 1);
  const rows = [...target.querySelectorAll('.ranking li')].map((li) => li.textContent?.replace(/\s+/g, ''));
  expect(rows).toEqual(['#1プレイヤー21/1', '#2プレイヤー10/1']);
  done();
});

it('紹介のモード名は、ダブルのときマゼンタ', () => {
  const { target, done } = show('hider', { phase: 'intro', settings: { ...DEFAULTS, mode: 'double' } });
  expect(['#e8399c', 'rgb(232, 57, 156)']).toContain(target.querySelector<HTMLElement>('.intro .name')?.style.color);
  expect(target.textContent).toContain('その後全員で探索し、最初に全員見つければ勝利');
  done();
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: 足したテストが FAIL。

- [ ] **Step 3: 親指のアイコン**

`src/lib/icons.ts` の `hourglass` の下に足す。

```ts
  // ええやん。親指を立てた手
  thumb: [
    { d: 'M3 10.5h3.2v10H3z', fill: C },
    {
      d: 'M7.6 10.5h2.6l2.6-6.2a1.8 1.8 0 0 1 3.3 1.2l-.8 4.3h3.9a1.8 1.8 0 0 1 1.8 2.1l-1.2 6.6a2 2 0 0 1-2 1.7H7.6z',
      fill: C
    }
  ],
```

- [ ] **Step 4: 札・紹介・HUD**

`Plates.svelte`:

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { nameOf } from './match.svelte';
  import type { Plate } from './session.svelte';

  let { plates }: { plates: Plate[] } = $props();
</script>

{#each plates as p (p.seat)}
  <span class="plate" style:left="{p.x}px" style:top="{p.y}px">
    {nameOf(p.seat)}
    <!-- 本家は頭の上に親指と数を出す -->
    {#if p.likes}<span class="likes"><Icon name="thumb" size="14px" />{p.likes}</span>{/if}
  </span>
{/each}

<style>
  .plate {
    position: absolute;
    translate: -50% -100%;
    display: flex;
    align-items: center;
    gap: 4px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 14px;
    white-space: nowrap;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }

  .likes {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    color: #ffd23f;
  }
</style>
```

`Intro.svelte` の `<p class="name">{mode.name}</p>` を `<p class="name" style:color={mode.color}>{mode.name}</p>` にし、style の `.name` の `color: #7cc243;` の行を消す。

`Hud.svelte` の script に `const double = $derived(match.double);` を足し、上の段を次にする。

```svelte
<div class="top">
  {#if !painting && !double}
    <span class="dolls white">
      {#each { length: match.hiders }, i (i)}<Icon name="figure" size="22px" />{/each}
    </span>
  {/if}
  <span class="clock">
    <Icon name="hourglass" size="30px" />
    <span class="num">{Math.ceil(match.left)}</span>
    {#if !painting}<span class="word">{match.word}</span>{/if}
  </span>
  {#if !painting}
    {#if match.taunt !== null}
      <span class="taunt">{Math.ceil(match.taunt)}</span>
    {/if}
    <!-- ダブルは全員がハンターなので、上の人形は全員が赤 -->
    <span class="dolls red">
      {#each { length: double ? match.view.hid.length : match.hunters }, i (i)}<Icon name="figure" size="22px" />{/each}
    </span>
  {/if}
</div>
```

下の段の `<span class="name">{mode.name}</span>` を `<span class="name" style:color={mode.color}>{mode.name}</span>` にし、`{:else if match.hiding}` を `{:else if match.hiding && !double}` にする。style の `.name` の `color: #7cc243;` の行を消す。

- [ ] **Step 5: 順位表**

`src/lib/games/yappari-chameleon/Ranking.svelte`:

```svelte
<script lang="ts">
  import { nameOf, type Match } from './match.svelte';

  let { match }: { match: Match } = $props();
</script>

<!-- 本家のダブルの HUD の左の順位表（#1 名前 見つけた数/見つける数） -->
<ol class="ranking" aria-label="順位">
  {#each match.ranking as r, i (r.seat)}
    <li class:me={r.seat === match.me}>
      <span class="num">#{i + 1}</span>
      <span>{nameOf(r.seat)}</span>
      <span class="num">{r.got}/{r.need}</span>
    </li>
  {/each}
</ol>

<style>
  .ranking {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 17px;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }

  li {
    display: flex;
    gap: 10px;
  }

  .me {
    color: #ffd23f;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }
</style>
```

`Overlay.svelte` の import に `import Ranking from './Ranking.svelte';` を足し、`<Intro {match} />` の上に足す。

```svelte
{#if phase !== 'lobby'}
  <!-- 左上の ✕ の下に、順位表と見落としの一覧を縦に並べる -->
  <div class="side">
    {#if match.double && (phase === 'search' || phase === 'reveal')}<Ranking {match} />{/if}
  </div>
{/if}
```

style に足す。

```css
.side {
  position: absolute;
  top: calc(max(12px, env(safe-area-inset-top)) + 62px);
  left: max(14px, env(safe-area-inset-left));
  display: grid;
  justify-items: start;
  gap: 14px;
}
```

- [ ] **Step 6: マップの設定**

`Settings.svelte` のゲームモードの段に `<button class:on={settings.mode === 'double'} onclick={() => (settings.mode = 'double')}>ダブル</button>` を足す（増え鬼の右）。ハンターの人数の段を次にする。

```svelte
<!-- ダブルは全員が隠れて全員が探すので、ハンターの人数を使わない -->
<div class="row" class:dim={settings.mode === 'double'}>
  <span>ハンターの人数</span>
  <span class="pick">
    <button
      aria-label="減らす"
      disabled={settings.mode === 'double'}
      onclick={() => (settings.hunters = Math.max(1, hunters - 1))}>−</button
    >
    <span class="value">{hunters}</span>
    <button
      aria-label="増やす"
      disabled={settings.mode === 'double'}
      onclick={() => (settings.hunters = Math.min(most, hunters + 1))}>＋</button
    >
  </span>
</div>
```

範囲の段の `{/each}` の下に足す。

```svelte
<div class="row">
  <span>ハンターに見逃しランキングを表示</span>
  <span class="pick">
    <button class:on={settings.overlook} onclick={() => (settings.overlook = true)}>オン</button>
    <button class:on={!settings.overlook} onclick={() => (settings.overlook = false)}>オフ</button>
  </span>
</div>
```

style に足す。

```css
.dim {
  opacity: 0.4;
}
```

（`Lobby.svelte.test.ts` の `button('＋')` は `textContent` の「＋」で探すので、`aria-label` があっても見つかる。）

- [ ] **Step 7: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 8: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS（`Settings.svelte` は 160 行ほど、`Hud.svelte` は 130 行ほどで 200 行未満）。

```bash
git add src/lib src/lib/games/yappari-chameleon
git commit -m "Show the double mode's HUD, ranking and magenta intro, and add the double and overlook settings"
```

---

### Task 16: 見落とした敵・見落とされた場所・ええやんの一覧・埋まりの警告・三人称のボタン

**Files:**

- Create: `src/lib/games/yappari-chameleon/Overlooked.svelte`・`Spotted.svelte`・`Iine.svelte`・`EmbedWarning.svelte`
- Modify: `src/lib/games/yappari-chameleon/HunterButtons.svelte`・`Overlay.svelte`
- Test: `src/lib/games/yappari-chameleon/Overlay.svelte.test.ts`・`HunterButtons.svelte.test.ts`

**Interfaces:**

- Consumes: Task 11 の `Match.overlooked`・`spotted`、Task 13 の `Play.tps`・`toggleTps`、Task 14 の `Session.like`・`buried`。
- Produces: `Overlooked.svelte`（props `{ match }`）、`Spotted.svelte`（props `{ match }`）、`Iine.svelte`（props `{ session }`）、`EmbedWarning.svelte`（props なし）。

| 部品             | 出すとき                                                                                                   | 置き場所             |
| ---------------- | ---------------------------------------------------------------------------------------------------------- | -------------------- |
| 見落とした敵     | 探索のハンターで、設定の見逃しランキングがオン。「隠す」で畳み、畳んだあとは「見落とした敵」のボタンで開く | 左の列（順位表の下） |
| 見落とされた場所 | 答え合わせ。順位・名前・点・いた部屋                                                                       | 左の列               |
| ええやん         | 答え合わせ。隠れた人の名前・親指と数・自分以外に「ええやん」（押したあとは全部押せない）                   | 右上                 |
| 埋まりの警告     | 自分が隠れていて埋まっている                                                                               | 画面の中央           |
| TPS視点・FPS視点 | ハンターの右の列のいちばん上                                                                               | 右の列               |

- [ ] **Step 1: 落ちるテストを書く**

`Overlay.svelte.test.ts` の `describe('Overlay', ...)` の最後に足す。

```ts
it('探索のハンターには見落とした敵を出し、隠すと畳み、開き直せる。設定がオフなら出さない', () => {
  const v: Partial<View> = { phase: 'search', overlook: { 2: { 1: 12 } } };
  const { target, done } = show('hunter', v, 2);
  const list = () => target.querySelector('.overlooked');
  expect(list()?.textContent).toContain('見落とした敵');
  expect(list()?.textContent).toContain('プレイヤー1');
  expect(list()?.textContent).toContain('12');
  [...target.querySelectorAll('button')]
    .find((b) => b.textContent?.trim() === '隠す')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  flushSync();
  expect(list()).toBeNull();
  [...target.querySelectorAll('button')]
    .find((b) => b.textContent?.trim() === '見落とした敵')!
    .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  flushSync();
  expect(list()).not.toBeNull();
  done();
  const off = show('hunter', { ...v, settings: { ...DEFAULTS, overlook: false } }, 2);
  expect(off.target.querySelector('.overlooked')).toBeNull();
  off.done();
});

it('答え合わせでは、見落とされた場所と、ええやんの一覧を出す', () => {
  const { target, done } = show('hider', {
    phase: 'reveal',
    winner: 'chameleon',
    hid: [1],
    overlook: { 2: { 1: 7 } },
    spots: { 1: [-16, 0, 10] },
    likes: { 1: 2 }
  });
  expect(target.querySelector('.spotted')?.textContent).toContain('見落とされた場所');
  expect(target.querySelector('.spotted')?.textContent).toContain('キッチン');
  const row = target.querySelector('.iine li')!;
  expect(row.textContent).toContain('プレイヤー1');
  expect(row.textContent).toContain('2');
  // 自分（プレイヤー1）には押せない
  expect(target.querySelector('.iine button')).toBeNull();
  done();
});

it('ええやんを押すと、押した人を送る。押したあとは押せない', () => {
  const v: Partial<View> = { phase: 'reveal', winner: 'chameleon', hid: [1] };
  const { target, session, done } = show('hunter', v, 2);
  const button = target.querySelector<HTMLButtonElement>('.iine button[data-seat="1"]')!;
  button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  expect(session.like).toHaveBeenCalledWith(1);
  done();
  const pressed = show('hunter', { ...v, liked: [2] }, 2);
  expect(pressed.target.querySelector<HTMLButtonElement>('.iine button')!.disabled).toBe(true);
  pressed.done();
});

it('埋まっているあいだは、画面の中央に警告を出す', () => {
  const { target, done } = show('hider', { phase: 'hide' }, 1, { buried: true });
  expect(target.textContent).toContain('体が埋まりすぎている！この状態が続くと位置が公開されます');
  done();
});
```

`show` に 4 つめの引数 `extra: Partial<Record<string, unknown>> = {}` を足して `session` の最後に `...extra` を足し、返す値に `session` を足す（`return { target, labels, session, done: () => unmount(app) };`）。

`HunterButtons.svelte.test.ts` の `describe('HunterButtons', ...)` の最後に足す。

```ts
it('右の列のいちばん上に TPS視点、三人称のあいだは FPS視点', () => {
  const session = $state({
    cool: 0,
    play: { crouch: false, tps: false, jump: vi.fn(), toggleTps: () => (session.play.tps = !session.play.tps) },
    shoot: vi.fn(),
    toggleCrouch: vi.fn()
  });
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(HunterButtons, { target, props: { session: session as unknown as Session } });
  flushSync();
  const first = () => target.querySelector('.column button')!;
  expect(first().textContent).toContain('TPS視点');
  first().dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  flushSync();
  expect(first().textContent).toContain('FPS視点');
  unmount(app);
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/Overlay.svelte.test.ts src/lib/games/yappari-chameleon/HunterButtons.svelte.test.ts`
Expected: 足したテストが FAIL。

- [ ] **Step 3: 部品を書く**

`src/lib/games/yappari-chameleon/Overlooked.svelte`:

```svelte
<script lang="ts">
  import { nameOf, type Match } from './match.svelte';

  let { match }: { match: Match } = $props();
  /** 本家はキーで隠せる。この画面だけで畳み、覚えない */
  let folded = $state(false);
</script>

<!-- スティックの指を置いたまま押すので、pointerdown で受ける -->
{#if folded}
  <button class="toggle" onpointerdown={() => (folded = false)}>見落とした敵</button>
{:else}
  <section class="overlooked" aria-label="見落とした敵">
    <header>
      <h2>見落とした敵</h2>
      <button class="toggle" onpointerdown={() => (folded = true)}>隠す</button>
    </header>
    {#each match.overlooked as r (r.seat)}
      <p><span>{nameOf(r.seat)}</span><span class="pts">{r.pts}</span></p>
    {/each}
  </section>
{/if}

<style>
  .overlooked {
    display: grid;
    gap: 2px;
    min-width: 170px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
    text-shadow: 0 1px 3px #000;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: normal;
  }

  p {
    display: flex;
    justify-content: space-between;
    margin: 0;
  }

  .pts {
    font-variant-numeric: tabular-nums;
  }

  .toggle {
    padding: 2px 12px;
    border: 1px solid rgb(255 255 255 / 0.8);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 14px;
  }
</style>
```

`src/lib/games/yappari-chameleon/Spotted.svelte`:

```svelte
<script lang="ts">
  import { nameOf, type Match } from './match.svelte';

  let { match }: { match: Match } = $props();
</script>

<!-- 本家の答え合わせの「見落とされた場所」。見落としポイントの順位と、そのとき隠れていた部屋 -->
<section class="spotted" aria-label="見落とされた場所">
  <h2>見落とされた場所</h2>
  <ol>
    {#each match.spotted as r, i (r.seat)}
      <li>
        <span class="num">{i + 1}</span>
        <span>{nameOf(r.seat)}</span>
        <span class="num">{r.pts}</span>
        {#if r.place}<span class="place">{r.place}</span>{/if}
      </li>
    {/each}
  </ol>
</section>

<style>
  .spotted {
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }

  h2 {
    margin: 0 0 2px;
    font-size: 18px;
    font-weight: normal;
  }

  ol {
    display: grid;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: 10px;
  }

  .num {
    font-variant-numeric: tabular-nums;
  }

  .place {
    color: #ffd23f;
  }
</style>
```

`src/lib/games/yappari-chameleon/Iine.svelte`:

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { nameOf } from './match.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const match = $derived(session.match);
  const used = $derived(match.view.liked.includes(match.me));
</script>

<!-- 本家は頭の上の札の横に押す所があるが、札は 3D の体の上にあって押しにくいので、右に名前とボタンを並べる -->
<ul class="iine" aria-label="ええやん">
  {#each match.view.hid as seat (seat)}
    <li>
      <span>{nameOf(seat)}</span>
      <span class="count"><Icon name="thumb" size="18px" />{match.view.likes[seat] ?? 0}</span>
      {#if seat !== match.me}
        <button
          data-seat={seat}
          aria-label="{nameOf(seat)}にええやん"
          disabled={used}
          onpointerdown={() => session.like(seat)}>ええやん</button
        >
      {/if}
    </li>
  {/each}
</ul>

<style>
  .iine {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    right: max(14px, env(safe-area-inset-right));
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
    text-shadow: 0 1px 3px #000;
  }

  li {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }

  .count {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: #ffd23f;
    font-variant-numeric: tabular-nums;
  }

  button {
    padding: 4px 14px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.4);
    color: #fff;
    font: inherit;
  }

  button:disabled {
    opacity: 0.45;
  }
</style>
```

`src/lib/games/yappari-chameleon/EmbedWarning.svelte`:

```svelte
<p class="warn" role="alert">体が埋まりすぎている！この状態が続くと位置が公開されます</p>

<style>
  .warn {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    margin: 0;
    color: #ff6b5e;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: min(4cqh, 2.6cqw);
    white-space: nowrap;
    text-shadow: 0 2px 6px #000;
    pointer-events: none;
  }
</style>
```

- [ ] **Step 4: 三人称のボタン**

`HunterButtons.svelte` の `<div class="column">` のすぐ下に足す。

```svelte
<!-- 本家の告知の言葉。押すたびに一人称と三人称を切り替える -->
<button
  class="round-btn"
  class:on={session.play.tps}
  aria-pressed={session.play.tps}
  onpointerdown={() => session.play.toggleTps()}
>
  <Icon name={session.play.tps ? 'eye' : 'figure'} size="30px" />
  <span>{session.play.tps ? 'FPS視点' : 'TPS視点'}</span>
</button>
```

- [ ] **Step 5: Overlay につなぐ**

`Overlay.svelte` の import に `EmbedWarning`・`Iine`・`Overlooked`・`Spotted` を足し、`.side` の中を次にする。

```svelte
<div class="side">
  {#if match.double && (phase === 'search' || phase === 'reveal')}<Ranking {match} />{/if}
  {#if phase === 'search' && play.role === 'hunter' && match.view.settings.overlook}<Overlooked {match} />{/if}
  {#if phase === 'reveal'}<Spotted {match} />{/if}
</div>
```

`.side` の `{/if}` の下に足す。

```svelte
{#if phase === 'reveal'}<Iine {session} />{/if}
{#if session.buried}<EmbedWarning />{/if}
```

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS（`Overlay.svelte` は 130 行ほどで 200 行未満）。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "List overlooked hiders, overlook spots and likes, warn buried hiders and add the TPS button"
```

---

### Task 17: BGM

**Files:**

- Create: `src/lib/games/yappari-chameleon/songs.ts`・`bgm.ts`
- Modify: `src/lib/games/yappari-chameleon/Online.svelte`
- Test: `src/lib/games/yappari-chameleon/bgm.test.ts`

**Interfaces:**

- Consumes: `$lib/music/loop.ts` の `Loop`、`$lib/music/tune.ts` の `Song` と `score`、`$lib/audio.svelte` の `bus`。
- Produces: `type Track = 'lobby' | 'hide' | 'search'`、`trackOf(phase): Track`、`QUIET = 0.4`、`SONGS: Record<Track, { song; bpm; gain }>`。

曲は本家のものを使わず、ロビーは明るく弾む長調（鉄琴）、隠れタイムは軽い緊張の短調（フルートの行進）、探索は張りつめた短調の 8 ビート（ピコピコ音）で作る。アニマルサバイバーと同じく `Online.svelte` が `Loop` を 0.1 秒ごとに `tick()` し、フェーズとペイントモードから曲と大きさを選ぶ。`Loop` は `bus()` が音の口を返さないとき（wake の前・ミュート中）と画面が隠れているあいだは鳴らさない。ひとりで試すは今のまま BGM を流さない。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/bgm.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { score } from '$lib/music/tune';
import { QUIET, trackOf } from './bgm';
import { SONGS } from './songs';

describe('BGM', () => {
  it('フェーズで曲を変え、紹介は隠れタイムの曲、答え合わせはロビーの曲', () => {
    expect(trackOf('lobby')).toBe('lobby');
    expect(trackOf('intro')).toBe('hide');
    expect(trackOf('hide')).toBe('hide');
    expect(trackOf('search')).toBe('search');
    expect(trackOf('reveal')).toBe('lobby');
  });

  it('3 曲とも楽譜として読め（小節の長さとコードの数がそろう）、8 小節ある', () => {
    for (const t of Object.values(SONGS)) {
      const sc = score(t.song);
      expect(sc.chords).toHaveLength(8);
      expect(sc.notes).toHaveLength(8 * sc.perBar);
    }
  });

  it('ペイントモードのあいだは小さくして流し続ける', () => {
    expect(QUIET).toBeGreaterThan(0);
    expect(QUIET).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/bgm.test.ts`
Expected: FAIL（`./bgm` が無い）。

- [ ] **Step 3: 書く**

`src/lib/games/yappari-chameleon/bgm.ts`:

```ts
import type { Phase } from './referee';

export type Track = 'lobby' | 'hide' | 'search';

/** ペイントモードのあいだの BGM の大きさ。塗る音と口笛を聞きやすくして、曲は止めない */
export const QUIET = 0.4;

/** 答え合わせはロビーの曲（本家の答え合わせの曲は分からない） */
export function trackOf(phase: Phase): Track {
  if (phase === 'search') return 'search';
  if (phase === 'intro' || phase === 'hide') return 'hide';
  return 'lobby';
}
```

`src/lib/games/yappari-chameleon/songs.ts`:

```ts
import type { Song } from '$lib/music/tune';
import type { Track } from './bgm';

/** 本家の曲は使わず、雰囲気だけを寄せて作る。書き方は $lib/music/tune の Song。効果音が聞こえるよう gain は小さめ */
export const SONGS: Record<Track, { song: Song; bpm: number; gain: number }> = {
  /** ロビーと答え合わせ。明るく弾む */
  lobby: {
    bpm: 112,
    gain: 0.5,
    song: {
      beats: 4,
      lead: 'mallet',
      style: 'bounce',
      melody: `c5 . e5 . g5 . e5 . | f5 . a5 . g5 - . . | e5 . d5 . c5 . d5 . | e5 - g5 - . . . . |
        a5 . g5 . f5 . e5 . | d5 . f5 . e5 - c5 . | d5 . e5 . f5 . d5 . | c5 - - - . . . .`,
      chords: 'C F C C F Dm G C'
    }
  },
  /** 隠れタイム。足音のような行進に、短調の笛で軽い緊張 */
  hide: {
    bpm: 100,
    gain: 0.45,
    song: {
      beats: 4,
      lead: 'flute',
      style: 'march',
      melody: `a4 . c5 . e5 - d5 . | c5 . b4 . a4 - . . | f4 . a4 . c5 - b4 . | g#4 - b4 - e5 - . . |
        a4 . c5 . e5 . a5 . | g5 . f5 . e5 - . . | d5 . c5 . b4 . g#4 . | a4 - - - . . . .`,
      chords: 'Am Am F E Am C E Am'
    }
  },
  /** 探索。低い音から刻む短調の 8 ビートで張りつめる */
  search: {
    bpm: 136,
    gain: 0.5,
    song: {
      beats: 4,
      lead: 'chip',
      style: 'drive',
      melody: `d4 . d4 f4 a4 . d5 . | c5 . a4 . f4 - e4 . | d4 . f4 . a#4 - a4 g4 | a4 - - - c#5 - . . |
        d5 . c5 . a#4 . a4 . | g4 . a4 . f4 - d4 . | e4 . g4 . a#4 . c#5 . | d5 - - - . . . .`,
      chords: 'Dm Dm A# A Dm Gm A Dm'
    }
  }
};
```

`Online.svelte` の import に足す。

```ts
import { bus } from '$lib/audio.svelte';
import { Loop } from '$lib/music/loop';
import { QUIET, trackOf } from './bgm';
import { SONGS } from './songs';
```

`const radius = 70;` の下に足す。

```ts
const loop = new Loop(bus);

$effect(() => {
  const t = SONGS[trackOf(session?.match.phase ?? 'lobby')];
  loop.play(t.song, t.bpm, session?.play.mode === 'paint' ? t.gain * QUIET : t.gain);
});

onMount(() => {
  // 曲は AudioContext の時計で 0.5 秒先まで予約するので、描画とは別に 0.1 秒ごとに足せば足りる
  const id = setInterval(() => loop.tick(), 100);
  return () => {
    clearInterval(id);
    loop.stop();
  };
});
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/bgm.test.ts`
Expected: PASS。

- [ ] **Step 5: 鳴るか確かめる**

dev サーバー（`pnpm dev --port 5180`）で、built-in browser（`mcp__Claude_Browser__*`）で `http://localhost:5180/asobibako/games/yappari-chameleon` を開き、「なかまを呼ぶ」までは進めずに、ひとりで試すで BGM が流れないことを確かめる。つないだ試合の曲は Task 20 の通しの試合で、`window.__session` のフェーズが変わるたびに例外が出ないことで確かめる（headless では音を聞けない）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Play lobby, hide and search themes that follow the match phase"
```

---

### Task 18: 描く重さを測り、多ければまとめる

**Files:**

- Create（リポジトリに入れない）: `<scratchpad>/perf-2b.json`
- Create（描く回数が 2a の 1.5 倍を超えたときだけ）: `src/lib/games/yappari-chameleon/mansion/merge.ts`
- Modify（同じとき）: `src/lib/games/yappari-chameleon/mansion/build.ts`

Task 5 で控えた `<scratchpad>/perf-2a.json` と比べる。比べるのは、視点ごとの `calls` のいちばん多いもの同士（2a は大広間か廊下、2b はどの部屋でもよい）。影を描く分も `calls` に入るので、見ていない部屋の家具も数に効く。

- [ ] **Step 1: 2b を測る**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/perf-2b.json`
Expected: 6 行の数を出す。`lights` は 13（2a の 9 にロビーと 3 部屋で 4 を足す）。

- [ ] **Step 2: 比べる**

Run: `node -e "const a=require('<scratchpad>/perf-2a.json'),b=require('<scratchpad>/perf-2b.json');const m=(r)=>Math.max(...r.map((x)=>x.calls));console.log(m(a),m(b),(m(b)/m(a)).toFixed(2))"`
Expected: 3 つの数（2a の最多・2b の最多・比）。比が 1.5 以下なら Step 3〜5 を飛ばして Step 6 へ。

- [ ] **Step 3: （比が 1.5 を超えたら）壁と床の箱を 1 つの材質ずつに分ける**

壁と床の箱は 6 面の材質の配列で描くので、1 枚で 6 回描く。模様の面（と裏の面）と、残りの無地の面を別の Mesh にし、無地の材質を 1 つにする。`mansion/build.ts` の `slab` を次にする。

```ts
/** すべての箱の無地の面で同じ材質を使う（Step 4 で 1 つの Mesh にまとめられるように） */
const PLAIN = finish({ tint: '#3b2414', rough: 0.7 }, [1, 1]);

/** BoxGeometry の面（ORDER の順に 6 頂点ずつ）のうち、which の面だけの形 */
function facesOf(box: THREE.BufferGeometry, which: number[]): THREE.BufferGeometry {
  const flat = box.toNonIndexed();
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = flat.getAttribute(name);
    const size = a.itemSize;
    const data = new Float32Array(which.length * 6 * size);
    which.forEach((f, k) =>
      data.set((a.array as Float32Array).subarray(f * 6 * size, (f + 1) * 6 * size), k * 6 * size)
    );
    out.setAttribute(name, new THREE.BufferAttribute(data, size));
  }
  return out;
}

function slab(s: Slab): THREE.Mesh[] {
  const size = [0, 1, 2].map((i) => s.max[i] - s.min[i]) as [number, number, number];
  const faceSize = (f: Face): [number, number] =>
    f[0] === 'x' ? [size[2], size[1]] : f[0] === 'y' ? [size[0], size[2]] : [size[0], size[1]];
  const box = new THREE.BoxGeometry(...size);
  const looks: [Face, Mat][] = [[s.face, s.mat], ...(s.back ? [[OPPOSITE[s.face], s.back] as [Face, Mat]] : [])];
  const plain = ORDER.map((f, i) => (looks.some(([g]) => g === f) ? -1 : i)).filter((i) => i >= 0);
  const parts: [THREE.BufferGeometry, THREE.Material][] = [
    ...looks.map(([f, mat]): [THREE.BufferGeometry, THREE.Material] => [
      facesOf(box, [ORDER.indexOf(f)]),
      finish(LOOKS[mat](), faceSize(f))
    ]),
    [facesOf(box, plain), PLAIN]
  ];
  box.dispose();
  return parts.map(([geo, mat]) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set((s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2);
    o.receiveShadow = true;
    // 天井と壁は上からの 1 灯を遮らない（遮ると廊下が真っ暗になる）
    o.castShadow = s.shadow ?? false;
    return o;
  });
}
```

`buildMansion` の `for (const s of m.slabs) group.add(slab(s));` を `for (const s of m.slabs) group.add(...slab(s));` にする。

- [ ] **Step 4: （同じとき）同じ見た目の材質の Mesh を 1 つにまとめる**

`src/lib/games/yappari-chameleon/mansion/merge.ts`:

```ts
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const ids = new WeakMap<object, number>();
let next = 0;
const idOf = (o: object): number => {
  let id = ids.get(o);
  if (id === undefined) ids.set(o, (id = next++));
  return id;
};

/** 見た目が同じ材質なら同じ鍵。finish は呼ぶたびに材質を作るので、中身（色・つや・模様の絵と繰り返し・面の向き）で比べる */
function keyOf(m: THREE.MeshStandardMaterial): string {
  const map = m.map;
  const pattern = map ? `${idOf(map.image as object)}:${map.repeat.x.toFixed(4)}:${map.repeat.y.toFixed(4)}` : '-';
  return [
    m.color.getHex(),
    m.emissive.getHex(),
    m.emissiveIntensity,
    m.metalness,
    m.roughness,
    m.side,
    m.transparent,
    m.opacity,
    pattern
  ].join('|');
}

/**
 * 動かない Mesh を、同じ見た目の材質と影の付け方ごとに 1 つへまとめ、描く回数を減らす。keep が true の物（動く物・額の絵・台の縁）と
 * その子は残す。group は原点に置いたまま呼ぶ（Mesh の位置を形に焼き込む）
 */
export function mergeStatic(group: THREE.Group, keep: (o: THREE.Object3D) => boolean): void {
  group.updateMatrixWorld(true);
  const buckets = new Map<string, { mat: THREE.Material; meshes: THREE.Mesh[]; cast: boolean; receive: boolean }>();
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
    for (let p: THREE.Object3D | null = o; p && p !== group; p = p.parent) if (keep(p)) return;
    const k = `${keyOf(o.material)}|${o.castShadow}|${o.receiveShadow}`;
    let b = buckets.get(k);
    if (!b) buckets.set(k, (b = { mat: o.material, meshes: [], cast: o.castShadow, receive: o.receiveShadow }));
    b.meshes.push(o);
  });
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue;
    const geos = b.meshes.map((m) => {
      const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld);
      // まとめる形は属性をそろえる（どの形にも位置・法線・uv はある）
      for (const name of Object.keys(g.attributes))
        if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      return g;
    });
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    for (const m of b.meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    const one = new THREE.Mesh(merged, b.mat);
    one.castShadow = b.cast;
    one.receiveShadow = b.receive;
    group.add(one);
  }
}
```

`mansion/build.ts` の import に `import { mergeStatic } from './merge';` を足し、`buildMansion` の `const arts = ...` の下に足す。

```ts
const moving = new Set(objects.slice(m.pieces.length - m.moving));
mergeStatic(group, (o) => moving.has(o) || !!o.userData.art || !!o.userData.glow);
```

- [ ] **Step 5: （同じとき）測り直し、見た目が変わらないことを確かめる**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/perf-2b.json` と Step 2 の比べる 1 行
Expected: 比が 1.5 以下。超えたままなら、`calls` の多い視点で `renderer.info` と `scene.traverse` から材質ごとの Mesh の数を数え、多い順に、同じ形をくり返す部品（シャンデリアの灯りとしずく・階段のガーランド・リボン）を `THREE.InstancedMesh` にする。

Run: `node <scratchpad>/room-sheet-2b.mjs "$PWD" <scratchpad>`
Expected: Task 9 のシートと見た目が同じ（3D スポイトで取る色も同じ。まとめた Mesh も材質の `userData.pick` を持つ）。

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Merge the mansion's static meshes by material to keep draw calls near the 2a level"
```

- [ ] **Step 6: 数を控える**

作業の担当へ、2a と 2b の視点ごとの `calls`・`lights`・`ms` と比を返す（iPad Air での重さは、2 台で遊んでもらうときに聞く）。

---

### Task 19: CLAUDE.md の説明

**Files:**

- Modify: `CLAUDE.md`（やっぱりカメレオンの段落）

最新の仕様だけを書き、段の名前・経緯・変えた点は書かない。

- [ ] **Step 1: 屋敷の文を置き換える**

次の文を置き換える。

```markdown
屋敷（`mansion/`）は本家のかくれんぼ屋敷の大広間（2 階の回廊・大階段・3 段のシャンデリア・ピアノ・円柱・箔のリボン・風船）と緑の廊下（暗いオリーブに黄緑のダマスクの壁紙・市松の床・ソファ・油絵・本棚）で、並びと当たりは `layout.ts`、組み立ては `build.ts`、模様は `textures.ts` の canvas（線と目は 2cm 以上）。
```

を次にする。

```markdown
屋敷（`mansion/`）は本家のかくれんぼ屋敷の大広間（2 階の回廊・大階段・3 段のシャンデリア・ピアノ・円柱・箔のリボン・風船）と緑の廊下（暗いオリーブに黄緑のダマスクの壁紙・市松の床・ソファ・油絵・本棚）に、戸口（幅 1.5m・高さ 2.4m）でつながる書斎・図書室（大広間の東。壁一面の本棚・緑の笠のランプの机・地球儀・胸像・木の柱）・キッチン（廊下の北。白いタイル・青い六角タイル・ステンレスの台とシンク・肉の棚・ガスボンベ・ダクト・黄色の注意線）・ランドリー（廊下の南。赤いれんが・赤と黄色の洗濯機・洗濯ひもの服・タオルの山・洗濯カート）の 5 部屋で、点光源は部屋ごとに 1〜2 個。並びと当たりは `layout.ts`（3 部屋は `rooms.ts`。戸口のある壁は大広間と廊下の壁の裏を使う `Slab.back`）、組み立ては `build.ts`、形は `furniture.ts` と `room-furniture.ts`（部品は `shapes.ts`）、模様は `textures.ts` と `textures-rooms.ts` の canvas（線と目は 2cm 以上）。風船・椅子・丸テーブル・ソファ・ベンチ・洗濯カート・タオルの山・段ボール箱・本の山・バケツは動く物で、部屋ごとの置き場所の候補（`props.ts` の `SETS`。候補どうし・壁・動かない家具・戸口の通り道 `DOORWAYS`・始める場所にかぶらない）から、親が紹介に入るときに決めた種（`View.seed`。ロビーは null で既定の置き方）で選び、額の絵柄も 4 枚から差し替える。3D は作り直さず、建てるときに全部作っておいて位置と向きと額の材質だけを入れ替え（`World.arrange`）、当たりも種から作り直す（親は `Host` の `levelFor`）。子は最初の様子でも種を当てるので、戻った子と途中で来た子も同じ置き方になる。
```

- [ ] **Step 2: ロビーの文を足す**

次の文の前に足す。

```markdown
試合は紹介 3 秒・隠れタイム・探索・答え合わせで、
```

足す文。

```markdown
ロビーは屋敷と控室から離した 16m 四方・高さ 6m の出口の無い部屋（`mansion/lobby.ts`。白いアーチとペンキのしぶきの壁・市松の床・端の水色の台）で、つないだあとと試合のあとは席ごとの場所（`SPAWNS.lobby`）に出る。まん中の直径 2.4m・高さ 0.3m の赤い丸い台（上面に HUNTER、当たりは乗れる高さの箱 3 つの八角形）の上に立っている人（足もとが上面より上で、中心が円の内側）を、親が届いた体から決めてハンター希望にし、乗っている人がいるあいだ台の縁を光らせる。日の影は屋敷だけを覆い、ロビーと控室は点光源で照らす。
```

- [ ] **Step 3: 審判と迎え直しの文を直す**

`審判は試合のルール（`referee.ts`。フェーズ・残り秒・役決め・発見・勝敗・もうええよ・強制挑発の時計で、` を `審判は試合のルール（`referee.ts`。フェーズ・残り秒・役決め・発見・勝敗・もうええよ・強制挑発の時計・ダブル・ええやん・埋まりの時計・見落としポイントの足し算で、` にする。`来た・戻った子には、全員の体・塗り・見つかったときの体・試合の様子をこの順に送り` を `来た・戻った子には、全員の体・塗り・見つかったときの体・ダブルの残した体とその塗り・試合の様子をこの順に送り` にする。`探索で大広間の南の壁の前（`SPAWNS.entrance`）から一人称で入る。` を `探索で大広間の南の壁の前（`SPAWNS.entrance`）から一人称（右の列の「TPS視点」で三人称。体の右肩の上を見る歩きと同じ追い方のカメラで、自分の体に銃を持たせ、弾は今のままカメラの位置から十字へ飛ぶ）で入る。` にする。

- [ ] **Step 4: ダブル・見落としポイント・ええやん・埋まり・BGM の文を足す**

`人は席の番号で「プレイヤー1」〜「プレイヤー3」と呼び、ロビーと答え合わせだけ頭の上に札（`Plates.svelte`）を出す。` を `人は席の番号で「プレイヤー1」〜「プレイヤー3」と呼び、ロビーと答え合わせだけ頭の上に札（`Plates.svelte`。答え合わせではええやんの親指と数）を出す。` にし、その下に足す。

```markdown
ダブルは全員が隠れてから全員が探す人になり、隠れた体はその場に残す（`referee.ts` の `caught` と `spot`。最初にほかの全員の体を見つけた人の勝ち、時間切れは見つけた数の多い人、同じ数なら先に届いた人、誰も見つけていなければ勝者なし。抜けても探す人のまま）。親は探索に入るとき全員の体とそのときの塗りの列を控え、様子より先に `left` で配り（持ち主は探索の様子を受けると白い体になるので、その前に写させる）、戻った子へは `left` と `leftDabs` で送り直す。残した体は答え合わせの体と同じ `Session` の `#pins` に置き、見つけた人の画面からだけ消し、答え合わせでは誰かに見つかった体を青、まだの体を赤で光らせる。紹介のモード名はマゼンタ、探索の言葉は全員「全員を見つけよう」、上の人形は全員が赤、HUD の左に順位表（`Ranking.svelte`）。見落としポイントは、親が探索のあいだ毎フレーム、ハンターの今のカメラの位置（`Me.eye`。三人称なら体の後ろのカメラ）から、隠れる人の胴の真ん中か頭が縦 72 度・横の半角 52 度の視野に入り、屋敷の箱に遮られず、直前 0.2 秒に 0.05m 未満しか動かず、15m 以内のとき、1 秒に `10 × (1 − 距離 / 15)` 点を足す（`oversight.ts`。ダブルでは残した体）。点は毎フレーム増えるので様子の変わり目には数えず、1 秒ごとの送り直しで配る。マップの設定の「ハンターに見逃しランキングを表示」がオンなら、ハンターの左に「見落とした敵」（`Overlooked.svelte`、隠せる）を出し、答え合わせでは「見落とされた場所」（`Spotted.svelte`。点と、いた部屋の名前は `layout.ts` の `placeOf`）を出す。ええやんは答え合わせのあいだ、隠れた人の自分以外へ 1 試合 1 回（右の一覧 `Iine.svelte`、数は親が数える。通算は持たない）。埋まりすぎは、張り付いていない体の頭か胴の 3 つの円すいの軸の真ん中が屋敷の箱の中にあるとき（`embed.ts`。張り付きは体を面に付ける置き方なので数えない）で、親が隠れタイムと探索のあいだだけ時計を持ち、本人の画面の中央に警告（`EmbedWarning.svelte`）、5 秒でハンターの画面にその人の頭の上の赤い下向きの矢印（`markers.ts`。深さを見ずに描いて壁を透かす）を出す。
```

`口笛は吹いた人の向きと距離に合わせて `PannerNode` で鳴らす（`sounds.ts`）。効果音だけで声は無い。` を次にする。

```markdown
口笛は吹いた人の向きと距離に合わせて `PannerNode` で鳴らす（`sounds.ts`）。BGM はロビー・隠れタイム・探索の 3 曲（`songs.ts`。本家の曲は使わず雰囲気を寄せ、答え合わせはロビーの曲）を、`bgm.ts` の `trackOf` がフェーズから選び、`Online.svelte` が `$lib/music/loop.ts` の `Loop` で流す（ペイントモードのあいだは 0.4 倍）。声は無い。
```

- [ ] **Step 5: 確かめてコミットする**

Run: `pnpm format && pnpm lint`
Expected: PASS（CLAUDE.md は prettier の対象）。

```bash
git add CLAUDE.md
git commit -m "Describe the lobby room, the new rooms, props, double mode and overlook points in CLAUDE.md"
```

---

### Task 20: 3 ページの通しの試合と、全体の確かめ

**Files:**

- Create（リポジトリに入れない）: `<scratchpad>/e2e-chameleon-2b.mjs`、`<scratchpad>/e2e-2b/*.png`

偽のカメラでつなぐやり方は 2a と同じ（3 ページを 1 つの context で開き、`getUserMedia` を「本物を 1 度呼んで許可を取ってから、canvas の `captureStream` を返す」ものに替え、相手のページの `svg[data-code]` を node 側で `uqr` の `encode` にかけて `window.__show` で描く）。ダブルを 1 回（台の上の希望・マゼンタの紹介・小物の種・残した体・戻った子・見落としポイント・三人称の弾・勝者・ええやん）と、増え鬼を 1 回（埋まりすぎの警告と印）通す。

- [ ] **Step 1: dev サーバーを起動する**

Run（裏で）: `pnpm dev --port 5180`
Expected: `http://localhost:5180/asobibako/` が開ける。

- [ ] **Step 2: 通しの台本を置く**

`<scratchpad>/e2e-chameleon-2b.mjs`:

```js
// 実行: node <scratchpad>/e2e-chameleon-2b.mjs <repo の絶対パス> <撮った絵を置く dir>
// 3 ページを偽のカメラの QR でつなぎ、ダブル 1 回と増え鬼 1 回を headless の Chrome で通して撮る。dev サーバーは 5180 で起動しておく
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const [repo, out] = process.argv.slice(2);
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');
const { encode } = require('uqr');
const URL = 'http://localhost:5180/asobibako/games/yappari-chameleon';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(out, { recursive: true });
const errors = [];

function fakeCamera() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 720;
  const g = canvas.getContext('2d');
  let rows = null;
  const draw = () => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 720, 720);
    if (!rows) return;
    const s = 720 / rows.length;
    g.fillStyle = '#000';
    rows.forEach((row, y) => row.forEach((dark, x) => dark && g.fillRect(x * s, y * s, s, s)));
  };
  // 描き直さないと captureStream が新しいコマを出さない
  setInterval(draw, 100);
  window.__show = (next) => {
    rows = next;
    draw();
  };
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => {
    const s = await real(c);
    for (const t of s.getTracks()) t.stop();
    return canvas.captureStream(10);
  };
}

/** ダブル・隠れタイム 300 秒・探索 600 秒・答え合わせ 120 秒・見逃しランキングあり（よびなおすあいだに進まないように） */
function settings() {
  localStorage.setItem(
    'asobibako:yappari-chameleon:settings',
    JSON.stringify({ mode: 'double', hunters: 1, hide: 300, search: 600, reveal: 120, taunt: 0, overlook: true, v: 2 })
  );
}

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-angle=metal']
});
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
await context.grantPermissions(['camera']);
await context.addInitScript(fakeCamera);
await context.addInitScript(settings);

async function open(name) {
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && console.log(`[${name}]`, m.text()));
  await page.goto(URL);
  // ハイドレートが済むまで押しても拾われない
  await sleep(1500);
  return page;
}

const code = (page) => page.locator('svg[data-code]').getAttribute('data-code', { timeout: 20000 });
const show = (page, text) => page.evaluate((rows) => window.__show(rows), encode(text, { ecc: 'L', border: 4 }).data);
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const state = (page, fn, arg) => page.evaluate(fn, arg);
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000 });
const press = (page, selector) =>
  page.locator(selector).first().dispatchEvent('pointerdown', { bubbles: true, pointerId: 9 });

async function pair(host, guest, hostOpens, guestButton) {
  await guest.locator('button.go', { hasText: guestButton }).click();
  await hostOpens();
  await show(guest, await code(host));
  const answer = await code(guest);
  await host.getByRole('button', { name: 'よみとってもらったら つぎへ' }).click();
  await show(host, answer);
  await until(guest, () => window.__session?.match.synced);
}

/** 隠れる人の体を pos に置く（ポーズも） */
const hideAt = (page, pos, yaw = 0, pose = 'stand') =>
  page.evaluate(
    ([pos, yaw, pose]) => {
      const p = window.__chameleon;
      p.placeAt(pos, yaw);
      p.setPose(pose);
    },
    [pos, yaw, pose]
  );

/** ハンターの体を pos に置き、目（一人称）か三人称のカメラの十字を target へ向けて止める */
async function aim(page, pos, target) {
  for (let i = 0; i < 4; i++) {
    await page.evaluate(
      ([pos, target, first]) => {
        const p = window.__chameleon;
        if (first) p.ghost = { pos: [...pos], vy: 0, yaw: 0, ground: true, cling: null };
        // 三人称はカメラが体の後ろにあるので、今のカメラの位置から向け直す
        const c = p.world.camera.position;
        const from = p.tps ? [c.x, c.y, c.z] : [p.ghost.pos[0], p.ghost.pos[1] + 1, p.ghost.pos[2]];
        const d = [target[0] - from[0], target[1] - from[1], target[2] - from[2]];
        const len = Math.hypot(...d);
        p.eyeYaw = Math.atan2(d[0], d[2]);
        p.eyePitch = Math.asin(-d[1] / len);
      },
      [pos, target, i === 0]
    );
    await sleep(250);
  }
}

const shoot = async (page) => {
  await page.evaluate(() => window.__session.shoot());
  await sleep(2300);
};

try {
  const host = await open('host');
  const a = await open('a');
  const b = await open('b');
  await pair(host, a, () => host.locator('button.go', { hasText: 'なかまを呼ぶ' }).click(), 'なかまに入る');
  await until(host, () => window.__session?.match.synced);
  await pair(host, b, () => host.getByRole('button', { name: 'なかまを呼ぶ' }).click(), 'なかまに入る');
  await until(host, () => window.__session.party.members.length === 3);
  await sleep(1500);
  await shot(host, '01-lobby-room');
  const lobbyLevel = await state(a, () => JSON.stringify(window.__chameleon.world.level.boxes));

  // b が台に上がるとハンター希望になり、台の縁が光る
  await hideAt(b, [0, 0.3, -60]);
  await until(host, () => window.__session.match.view.wishes.includes(3));
  await sleep(500);
  await shot(a, '02-podium-lit');

  // ダブル（保存した設定のまま）で始める
  await host.getByRole('button', { name: 'マップの設定' }).click();
  await shot(host, '03-settings-double');
  await host.getByRole('button', { name: 'ゲームを始める' }).click();
  await until(a, () => window.__session.match.phase === 'intro');
  await shot(a, '04-intro-double');
  const levels = await Promise.all(
    [host, a, b].map((p) => state(p, () => JSON.stringify(window.__chameleon.world.level.boxes)))
  );
  console.log('seed', await state(a, () => window.__session.match.view.seed));
  if (new Set(levels).size !== 1 || levels[0] === lobbyLevel)
    throw new Error('小物の置き方が 3 台でそろっていないか、ロビーのまま');
  await until(a, () => window.__session.match.phase === 'hide');

  // 3 人が別々の部屋に隠れる。a は体の前を緑に塗る
  await hideAt(host, [-16.2, 0, 12.6]);
  await hideAt(a, [12.3, 0, 3]);
  await hideAt(b, [-14.6, 0, -2.8]);
  await a.evaluate(() => {
    const p = window.__chameleon;
    const { position: pos, normal: nrm } = p.world.rig.mesh.geometry.attributes;
    const dabs = [];
    for (let i = 0; i < pos.count; i += 7) {
      if (nrm.getZ(i) < 0.3) continue;
      dabs.push({
        p: [pos.getX(i), pos.getY(i), pos.getZ(i)],
        n: [nrm.getX(i), nrm.getY(i), nrm.getZ(i)],
        r: 0.05,
        c: [0.2, 0.7, 0.3],
        a: 0.9,
        m: 0,
        ro: 0.8
      });
    }
    p.log.begin();
    p.applyDabs(dabs);
  });
  await sleep(1200);
  const painted = await state(a, () => window.__chameleon.log.dabs.length);
  await shot(a, '05-hide-study');
  for (const p of [host, a, b]) await press(p, 'button.ready');
  await until(b, () => window.__session.match.phase === 'search');
  await sleep(1500);
  for (const [p, n] of [
    [host, 'host'],
    [a, 'a'],
    [b, 'b']
  ])
    await shot(p, `06-search-${n}`);
  const pins = await Promise.all([host, b].map((p) => state(p, () => window.__session.pinPaint(2))));
  console.log('pins of a', pins, 'painted', painted);
  if (pins.some((n) => n !== painted)) throw new Error('a の残した体の塗りがそろっていない');

  // a が切れて戻る。残した体の塗りと、探す人の続きが戻る
  await a.close();
  await until(host, () => window.__session.party.away.includes(2));
  const a2 = await open('a2');
  await pair(host, a2, () => host.getByRole('button', { name: 'よびなおす' }).click(), 'なかまに入る');
  await until(a2, () => window.__session.match.phase === 'search');
  await sleep(1500);
  const back = await state(a2, () => ({
    seat: window.__session.party.me,
    role: window.__chameleon.role,
    pin: window.__session.pinPaint(2)
  }));
  console.log('rejoined', back);
  if (back.seat !== 2 || back.role !== 'hunter' || back.pin !== painted)
    throw new Error('戻った子の残した体か役が戻っていない');
  await shot(a2, '07-rejoined-double');

  // b がキッチンで親の体を見つめて止まると、見落としポイントが入る
  await aim(b, [-16.2, 0, 8.6], [-16.2, 0.75, 12.6]);
  await until(host, () => (window.__session.match.view.overlook[3]?.[1] ?? 0) > 0);
  await sleep(500);
  await shot(b, '08-overlooked-list');
  await shoot(b);
  await until(host, () => window.__session.match.view.caught[3]?.includes(1));
  console.log('host still sees its own pin', await state(host, () => window.__session.pinPaint(1)));

  // b は三人称にして、書斎の a の体を撃つ。ほかの全員を見つけて勝つ
  await b.evaluate(() => window.__chameleon.toggleTps());
  // 柱と机を避けて、戸口の近くから南東を向く（三人称のカメラは大広間の壁の手前で止まる）
  await aim(b, [9, 0, 4.5], [12.3, 0.75, 3]);
  await shot(b, '09-tps');
  await shoot(b);
  await until(host, () => window.__session.match.phase === 'reveal');
  await sleep(1200);
  for (const [p, n] of [
    [host, 'host'],
    [a2, 'a2'],
    [b, 'b']
  ])
    await shot(p, `10-reveal-${n}`);
  const won = await state(host, () => document.body.textContent.includes('勝者 プレイヤー3!'));
  if (!won) throw new Error('ダブルの勝者の言葉が出ていない');

  // a2 が親にええやんを押す
  await press(a2, '.iine button[data-seat="1"]');
  await until(host, () => window.__session.match.view.likes[1] === 1);
  await sleep(500);
  await shot(a2, '11-iine');
  for (const p of [host, a2, b]) await press(p, 'button.ready');
  await until(host, () => window.__session.match.phase === 'lobby');
  await sleep(800);
  await shot(host, '12-lobby-again');

  // 増え鬼。b が台に上がってハンターになる
  await hideAt(b, [0, 0.3, -60]);
  await until(host, () => window.__session.match.view.wishes.includes(3));
  await host.getByRole('button', { name: 'マップの設定' }).click();
  await host.getByRole('button', { name: '増え鬼' }).click();
  await host.getByRole('button', { name: 'ゲームを始める' }).click();
  await until(a2, () => window.__session.match.phase === 'hide');
  console.log('roles', await state(host, () => window.__session.match.view.roles));

  // a2 は大広間の南の壁に向いて寝そべり、壁に胴を埋める
  await hideAt(a2, [3, 0, 0.2], Math.PI, 'lie');
  await until(a2, () => document.body.textContent.includes('体が埋まりすぎている'));
  await shot(a2, '13-buried-warning');
  await sleep(5500);
  for (const p of [host, a2, b]) await press(p, 'button.ready');
  await until(b, () => window.__session.match.phase === 'search');
  await until(b, () => window.__session.match.view.exposed.includes(2));
  await aim(b, [0.8, 0, 3], [3, 1.8, 0.2]);
  await shot(b, '14-exposed-marker');

  // a2 は起き上がって壁から出る。b が親と a2 を撃って勝つ
  await hideAt(a2, [3, 0, 1.2]);
  const hostAt = await state(host, () => window.__chameleon.body.pos);
  await aim(b, [0.8, 0, 3.5], [hostAt[0], 0.75, hostAt[2]]);
  await shoot(b);
  await until(host, () => window.__session.match.view.found.includes(1));
  await aim(b, [0.8, 0, 3.5], [3, 0.75, 1.2]);
  await shoot(b);
  await until(a2, () => window.__session.match.phase === 'reveal');
  await sleep(1200);
  await shot(b, '15-reveal-infect');
  if (!(await state(b, () => document.body.textContent.includes('勝者ハンター!'))))
    throw new Error('増え鬼の勝者の言葉が出ていない');
} finally {
  await browser.close();
}
if (errors.length) throw new Error(errors.join('\n'));
console.log('ok');
```

- [ ] **Step 3: 通しで動かす**

Run: `node <scratchpad>/e2e-chameleon-2b.mjs "$PWD" <scratchpad>/e2e-2b`
Expected: `seed` に 1 以上の数、`pins of a [ N, N ] painted N`、`rejoined { seat: 2, role: 'hunter', pin: N }`（N はどれも同じ）、`host still sees its own pin N`（N は 0 以上）、`roles { '1': 'hider', '2': 'hider', '3': 'hunter' }`、最後に `ok`。止まったら、止まった所の画面を撮り足して、どのページのどの知らせが届いていないかを `window.__session` から読む。まず見るのは、狙いの向き（`aim` のあとの `window.__chameleon.world.camera` の向きと、撃った弾の `splat` の `ends`）と、置いた体が家具に押し出されていないか（`window.__chameleon.body.pos`）。headless でページの `requestAnimationFrame` が止まるようなら、そのページを `bringToFront()` してから進める。

- [ ] **Step 4: 撮った絵を見る**

Read で `<scratchpad>/e2e-2b/*.png` を見て、次を確かめる。

| 絵                   | 写っていること                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `01-lobby-room`      | ペンキのしぶきの白い部屋、まん中の赤い台と HUNTER、ほかの 2 人の白い体と名前の札                                   |
| `02-podium-lit`      | 台の上の b と、明るく光る台の縁                                                                                    |
| `03-settings-double` | ゲームモードの「ダブル」が選ばれ、ハンターの人数が薄い。「ハンターに見逃しランキングを表示」の段                   |
| `04-intro-double`    | 上下の黒い帯のあいだにマゼンタの「ダブル」と説明 2 行                                                              |
| `05-hide-study`      | 書斎に隠れた a の緑の体と「探索開始まで」                                                                          |
| `06-search-*`        | 全員が入口から一人称、上に赤い人形 3 つ、「全員を見つけよう」、左に順位表 `#1 … 0/2`                               |
| `07-rejoined-double` | 戻った a2 も一人称で、順位表が出る                                                                                 |
| `08-overlooked-list` | b の左に「見落とした敵」とプレイヤー1 と点、キッチンに親の体                                                       |
| `09-tps`             | b の三人称。画面の左寄りに銃を構えた自分の体、中央に十字                                                           |
| `10-reveal-*`        | 「勝者 プレイヤー3!」、残した体が青く光る（a2 の画面で）、左に「見落とされた場所」と部屋の名前、右にええやんの一覧 |
| `11-iine`            | 親の札かええやんの一覧に親指と 1                                                                                   |
| `13-buried-warning`  | 画面の中央の赤い字の警告                                                                                           |
| `14-exposed-marker`  | 壁を透かして見える赤い下向きの矢印                                                                                 |
| `15-reveal-infect`   | 「勝者ハンター!」                                                                                                  |

三人称のカメラの見る点（`TPS_SIDE`・`TPS_LIFT`）や、矢印の大きさ（`Markers` の円すい）が不自然なら、数値だけを直して撮り直す。

- [ ] **Step 5: 全部を通す**

Run: `pnpm verify`
Expected: PASS（lint・check・test・vitals・build）。`svelte-vitals` が新しい部品に警告を出したら、規則に合わせて直す（抑制コメントは使わない）。直したら Step 3 を撮り直す。

- [ ] **Step 6: コミットする（直したものがあれば）**

```bash
git add -A src/lib/games/yappari-chameleon
git commit -m "Tune the third-person camera and markers after the three-device run"
```

- [ ] **Step 7: iPad で遊んでもらう準備**

作業の担当へ、撮った絵と、iPad 2 台で確かめてほしい点を返す。確かめてほしい点は、部屋の見た目（本家と並べたシート）・見落としポイントの効き方（`10 × (1 − 距離 / 15)` で多すぎないか）・BGM の大きさと曲調・三人称のカメラの見やすさ・ダブルで見つけた体を自分の画面からだけ消す決め（本家では残した体が撃たれると持ち主も脱落する仕組みの見込みがある）・5 部屋に増えたあとの重さ（カクつき・熱）。

---

## Self-Review

### 仕様の節と受け持つタスク

| 仕様の節           | タスク                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ロビーの部屋       | 5（部屋・台・当たり・席・水色の台・台の光）、10（台の上の人を希望にする）、12（ロビーの席・台の光・ハンター希望のボタンと印をなくす）、9（シート）                   |
| 屋敷の 3 部屋      | 6（壁・戸口・床・天井・明かり・部屋の名前）、7（家具）、9（本家のスクショと並べたシート）                                                                            |
| 小物の置き方の乱数 | 1（種）、8（候補・置き方・額の絵柄・3D を動かす）、10（親の当たりを種から）、12（子が種を当てる。最初の様子でも）                                                    |
| ダブル             | 1（ルール）、10（残した体・的・戻った子）、11（言葉・順位表）、12（残した体を置く・見つけた人の画面からだけ消す・答え合わせの光）、15（紹介の色・HUD・順位表・設定） |
| 見落としポイント   | 2（足し算）、3（視野・遮り・動き・距離）、10（毎フレーム親が足し、1 秒ごとに配る）、11（一覧の並び）、15（設定）、16（見落とした敵・見落とされた場所）               |
| ええやん           | 2（1 試合 1 回）、10（act）、14（送る・札の数）、15（親指のアイコン・札）、16（右の一覧）                                                                            |
| ハンターの三人称   | 10（`Me.eye`）、13（カメラ・自分の体の銃・筋の始まり）、16（TPS視点・FPS視点のボタン）                                                                               |
| 埋まりすぎの警告   | 2（時計）、4（判定）、10（親が数える）、14（印と警告の口）、16（警告の字）                                                                                           |
| BGM                | 17                                                                                                                                                                   |
| 通信で変わるもの   | 10（`phase` の中身・`iine`・`wish` をなくす・`shot` は今のままカメラの位置から）、12・14（受ける側）                                                                 |
| 仕組み             | ファイルの地図のとおり（`embed.ts`・`oversight.ts`・`props.ts`・`mansion/lobby.ts`・`mansion/rooms.ts`・`songs.ts`・`bgm.ts`）                                       |
| 重さ               | 5（2a を控える）、18（比べて、多ければまとめる）                                                                                                                     |
| 確かめ方           | 1〜8・10〜17 の vitest、9 のシート、20 の 3 ページの通しの試合（ダブル 1 回・増え鬼 1 回）                                                                           |

### このプランで決めたこと

| 決めたこと                                                                                                                                       | 理由                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 張り付いている体は埋まりに数えない                                                                                                               | 張り付きは体を面に付ける置き方で、scratch で確かめると寝そべる・丸まる・しゃがむ・前屈（壁）とブリッジ・反る（天井）で胴か頭の真ん中が面の箱に入る。遊べるポーズを警告しない |
| ダブルの探す人は切れても役を残す（2a の通常と増え鬼のハンターは観戦になる）                                                                      | 全員が探す人で、戻った子が見つけた数を持ったまま探し続けられるように                                                                                                         |
| 小物は 3D を作り直さず、全部作っておいて位置と向きだけ動かす。動く物の数は種によらず同じ                                                         | 紹介の 3 秒に形・材質・シェーダーを作らない。額の絵は 4 枚の材質を先に作り、透かしのシェーダーも先に当てる                                                                   |
| テーブルと椅子は 1 組で動く                                                                                                                      | 椅子だけ離れて置かれると、部屋の並びとして不自然                                                                                                                             |
| 部屋の寸法は、書斎 x 7.3〜17.3・z 1〜11・高さ 4m、キッチン x −21〜−11・z 7.05〜15.05・高さ 3.5m、ランドリー x −20〜−10・z −5.05〜2.95・高さ 3.5m | 仕様の 8〜10m 四方・高さ 3.5〜4m の中で、廊下の天井（3.5m）とそろえ、戸口の位置で廊下の飾りを避ける                                                                          |
| 点光源は新しい部屋とロビーに 1 個ずつ（全部で 13）                                                                                               | 仕様の 1〜2 個の下限。点光源はどの材質の画素にも効くので、2a の 9 から増やしすぎない                                                                                         |
| ロビーと控室は日の影の外                                                                                                                         | 1 枚の影の範囲を屋敷（x −24〜18、z −7〜17）に絞って細かさを保つ                                                                                                              |
| 台の上は、跳んでいる最中も希望のまま                                                                                                             | 跳ぶたびに希望が切り替わると、様子を毎フレーム配ってしまう                                                                                                                   |
| ダブルでは強制挑発の時計を持たない                                                                                                               | 探索のあいだ全員が探す人で、吹く隠れる人がいない                                                                                                                             |
| 三人称の見る点は体の右肩の上（右へ 0.45m、高さ 1.2m）。透かし窓は使わない                                                                        | 十字が自分の体に隠れないように。透かすとハンターが物の向こうを見られる                                                                                                       |
| 三人称の見落としポイントもカメラの位置（`Me.eye`）から縦 72 度・横の半角 52 度で測る                                                             | 仕様の視野の数で、親は three を持たない。三人称の画角 60 には合わせない                                                                                                      |
| 見落としポイントは様子の変わり目に数えず、1 秒ごとの送り直しで配る                                                                               | 毎フレーム増えるので、数えると毎フレーム配ってしまう                                                                                                                         |
| 「見落とされた場所」は、いた部屋の名前（大広間・2階の回廊・緑の廊下・書斎・キッチン・ランドリー）                                                | 答え合わせでは体そのものが光って全員に見えているので、一覧には場所の言葉を出す                                                                                               |
| ダブルの答え合わせの名前の札は、残した体の上に出す                                                                                               | 探す人の体と残した体で札が 2 枚になる                                                                                                                                        |
| ダブルの残した体は自分の画面にも出す（塗りの面は最大 6 体で約 240MB）                                                                            | 答え合わせで自分の隠れ場所の光り方を見られるように。2a の 5 体（約 200MB）と同じくらい                                                                                       |
| ダブルの残した体は動かないので、撃った弾はさかのぼらずに調べる                                                                                   | 隠れタイムの終わりで止まった体                                                                                                                                               |
| ダブルの探索でも、残した体の埋まりを数え続ける                                                                                                   | 仕様の「隠れタイムと探索のあいだだけ数える」。隠れタイムの終わりに埋まっていた体は、探索で 5 秒に届けば知らせる                                                              |
| ハンターになり直すと一人称から                                                                                                                   | 三人称のまま次の試合が始まると、控室から出たときの見え方が試合ごとに変わる                                                                                                   |
| ひとりで試すでは BGM を流さない                                                                                                                  | 仕様の 3 曲はつないで遊ぶ試合のフェーズの曲                                                                                                                                  |
| `Host` の 2 つめの引数を、種から当たりを作る口 `levelFor` にする                                                                                 | 親も種の置き方で弾と見落としポイントと埋まりを調べる                                                                                                                         |
| キッチンの点光源は天井のダクトをよけて x −14 に置き、廊下の油絵は x −19 へ移す                                                                   | ダクトの中の光は面を照らさない。油絵がキッチンの戸口の縁にかかる                                                                                                             |

### 型と名前のそろい

- `View` の足したもの（`hid`・`caught`・`reached`・`champ`・`seed`・`likes`・`liked`・`buried`・`exposed`・`overlook`・`spots`）は Task 1・2 で決め、Task 10 の `Host` が配り、Task 11 の `Match`（`double`・`ranking`・`overlooked`・`spotted`）と Task 12・14 の `Session`、Task 15・16 の部品が同じ名前で読む。
- `Winner` の `'double'` と `Match.champ` は Task 1 で決め、`winnerText` が「勝者 プレイヤーN!」か「勝者なし」にする（Task 1・15・20）。
- 知らせの名前は、act が `hi`・`me`・`dabs`・`ready`・`taunt`・`shot`・`iine`（`wish` はなくす）、tell が `phase`・`me`・`dabs`・`found`・`splat`・`toot`・`left`・`leftDabs`・`chameleon-mismatch` で、Task 10 と Task 12・14 で同じ。`left` は `{ seat, body: Me }`、`leftDabs` は `dabs` と同じ `{ seat, at, d }`。
- `Me.eye: V3 | null` は Task 10 で決め、`Host` の `#watch`（`oversight.ts` の `Viewer`）と `Session.#me` が使う。
- 屋敷の口は `mansion(seed: number | null)`・`Mansion.solids`・`Mansion.moving`・`Mansion.arts`・`levelOf`・`placeOf`・`SPAWNS.lobby`（Task 5・6・8）。3D の口は `Built.glow`・`Built.arrange` と `World.podium`・`World.arrange`・`World.holdGun`・`World.gunMuzzle`（Task 5・8・13）で、Task 12・13 の `Session` と Task 12 のテストの偽の world が同じ名前を持つ。
- `Play.tps`・`Play.toggleTps()`（Task 13）は `HunterButtons.svelte`（Task 16）と `Session.frame`・`shoot`（Task 13）が読む。`Session.like`・`buried`・`pinPaint`（Task 12・14）は `Iine.svelte`・`Overlay.svelte`（Task 16）と通しの試合（Task 20）が読む。
- `Plate` は `{ seat, x, y, likes }`（Task 12 で `wish` を外し、Task 14 で `likes` を足す）。`Plates.svelte`（Task 15）が読む。
- `Track`（`'lobby' | 'hide' | 'search'`）は `bgm.ts` で決め、`songs.ts` の `SONGS` の鍵と `Online.svelte` が同じ名前を使う（Task 17）。
