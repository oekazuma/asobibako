# やっぱりカメレオン 部屋の作り込み（キッチン・ランドリー・書斎・ロビー） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2b で足したロビーと屋敷の 3 部屋（キッチン・ランドリー・書斎・図書室）を、本家の画面に近い見た目へ作り込む。部屋ごとの暗さと色、模様、家具の形と数を本家に寄せ、遊び方・知らせの形・`CHAMELEON_VERSION` は変えない。

**Architecture:** 部屋の明るさは、カメラのいる部屋で決まる表（`mansion/moods.ts` の `MOODS`。日・半球の光・映り込み・露出）を `world3d.ts` が毎フレーム 0.3 秒ほどでなめらかに寄せる。どれも shader の uniform なので、光の数を変えず材質も作り直さない。家具は部屋ごとのファイル（`mansion/kitchen.ts`・`laundry.ts`・`study.ts`）に形と模様を持ち、`furniture.ts` の `MAKERS` に足す。動かない部品は今の `mergeStatic` がまとめる。並びと当たりは `rooms.ts`・`lobby.ts`・`layout.ts` の表に足し、`rooms.test.ts`・`props.test.ts`・`layout.test.ts` が戸口・人の出る場所・動く物の候補との重なりを見る。新しい `mansion/build.test.ts` は node で canvas を偽物にして屋敷を組み立て、材質（透かし窓とスポイトの印）・Mesh の数・模様の画素の量・模様の線の太さを見る。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、three 0.186、vitest 4（`unit` は node）、playwright-core（headless Chrome で撮る）、ffmpeg（撮った絵の平均の明るさ）。

**Spec:** `docs/superpowers/specs/2026-10-10-yappari-chameleon-rooms-polish-design.md`（2b の決めごとは `docs/superpowers/specs/2026-10-09-yappari-chameleon-stage2b-design.md`、本家の仕様は `docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md`）。本家の画面から拾った色・大きさ・物の並びと差の上位 10 は `<scratchpad>/ref/rooms-reference.md`（コマは `<scratchpad>/ref/frames/`、本家の画面は `<scratchpad>/ss/`）。

## Global Constraints

- 描く回数は、どの視点でも 2a の大広間の 1.5 倍（1354 回）を超えない（作り込みの前の最悪はロビーの 284 回）。足した動かない部品は `mergeStatic` がまとめる形（`position`・`normal`・`uv` を持つ Mesh と、透けない `MeshStandardMaterial`）で作る。
- 点光源は部屋ごとに 1〜2 個で、数は屋敷を建てるときに決まり、遊ぶあいだ増やしも減らしもしない（光を足し引きすると材質の shader を作り直して止まる）。部屋の暗さは強さと色だけで変える。
- 足した材質はどれも `finish()` から作り、`userData.pick` を持つ（3D スポイト）。光る材質は `shapes.ts` の `glowing()` で作る。透かし窓（`xray.ts`）は `setStage` が組み立てた屋敷の材質すべてに当てるので、`MeshStandardMaterial` なら足した物にも効く。
- 模様は canvas で描き、線と目は 2cm 以上。同じ模様は `make()` の鍵で 1 枚の canvas を共有し、テクスチャの画素は全体で 32MB 以下（`build.test.ts` が見る）。外の素材は使わない。
- 動く物（`props.ts` の `SETS`）の大きさと当たりと候補は変えない（見た目だけ作り込む）。当たりのある大物の家具は、戸口の通り道（`DOORWAYS`）・人の出る場所（`SPAWNS`）・動く物のどの候補とも重ならない（`rooms.test.ts`・`props.test.ts`・`layout.test.ts`）。
- ひとりで試す・2a・2b の遊び方と知らせの形は変えない。`CHAMELEON_VERSION` は 2 のまま。
- コメントは非自明な WHY だけを日本語で書く。WHAT・変更履歴・タスク番号は書かない。コンポーネントは 200 行未満（この計画では `.svelte` を変えない）。絵文字は使わない。
- 各タスクの終わりに `pnpm format` で整えてから `pnpm lint`・`pnpm check`・`pnpm test:run` を通す。最後のタスクで `pnpm verify` と 2b の 3 ページの通しの試合（`<scratchpad>/2b/task20/e2e-chameleon-2b.mjs`）を通す。
- コミットのメッセージは英語で、`Co-Authored-By` などの署名の行は付けない。
- ブラウザは headless Chrome（`playwright-core`、`channel: 'chrome'`、`--use-angle=metal`）だけを使い、Claude in Chrome は使わない。dev サーバーは `pnpm dev --port 5180` で起動する。撮る台本は scratchpad（`/private/tmp/claude-501/-Users-oekazuma-localRepo-asobibako--claude-worktrees-meccha-chameleon-clone-51ef75/ec70cc60-b8f6-4d7c-9a9d-7944e6622daa/scratchpad`、以下 `<scratchpad>`）に置き、リポジトリには入れない。
- コードは、新しいファイルを「**新しいファイル**」の全文で、今のファイルの変更を「**差分**」の unified diff で書く。差分はリポジトリの根で `git apply` しても、手で直してもよい（どちらでも同じ中身になる）。

## Review Focus

1. 部屋の明るさはカメラの場所で決まる。三人称のカメラは人形の後ろ 2.4m にあるので、戸口のそばでは体が部屋の中でもカメラは廊下の明るさになる。表を引くのは `placeOf`（`PLACES` の上から順）で、ロビーだけは今までどおり壁の厚みまで含めた `inLobby` で見る。`setStage` で寄せ方の時計を戻し、屋敷を建てた最初の 1 コマは寄せずにその部屋の値にする（Task 1 の `#light`）。
2. 当たりのある家具を足すので、歩ける場所が狭くなる。種 200 個の置き方で動く物と重ならない（`props.test.ts`）、選ばれなかった候補も含めてどの候補とも重ならない（Task 4 で足す `rooms.test.ts` のテスト）、どの置き方でも戸口から 3 部屋の中ほどまで歩ける（`props.test.ts`）の 3 つで確かめる。
3. 両面を描く材質（服・流しの槽・ランプの笠・ボウル）と光る材質（蛍光灯・水色の台の輪・ランプの笠）は、`mergeStatic` の鍵（`side`・`emissive`・`emissiveIntensity`）が同じものどうしでまとまる。透ける材質は使わない。`build.test.ts` が Mesh の数（450 以下）と、どの材質も透けず印を持つことを見る。
4. `ShapeGeometry` の uv は形の座標（m）そのままなので、服の模様は `finish(look, [1, 1])` で 1 / 模様の大きさの繰り返しにする（スポイトの `readPick` も同じ繰り返しで読む）。
5. 線と目の 2cm。`build.test.ts` の偽の canvas が `lineWidth` に入れた値を覚え、模様ごとにいちばん細い線を m に直して見る。塗りの面で描く目地（六角タイル・格子柄・ポスター）は、作る式の数（`HEX.grout` など）で見る。

## 決めたこと

| 決めたこと                                                                                                                                                                                                  | 理由                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| キッチンの六角タイルは差し渡し 7.7cm（本家は 5〜6cm）                                                                                                                                                       | 目地を 2cm にすると、5〜6cm のタイルでは目地が半分を占める。目地の暗さで本家の `#2a6073` 前後の暗さには寄る                                                                                                                    |
| キッチンの壁のタイルは 20cm 角（本家は 15cm）                                                                                                                                                               | 溝の輪 1 つと面取り 1 つをどちらも 2cm で入れるには、15cm では足りない                                                                                                                                                         |
| 点光源は全部で 13 個から 14 個（ランドリーだけ 2 個、ほかの部屋は 1 個）                                                                                                                                    | 本家のランドリーは蛍光灯の列ごとに光が溜まる。ほかの部屋は 1 個で本家の明暗に届いた                                                                                                                                            |
| 明るさはカメラの場所で選ぶ（人形の場所ではない）                                                                                                                                                            | 画面に映るのはカメラの見ている部屋で、フリーカメラとハンターにも同じ口で効く                                                                                                                                                   |
| 部屋でも日を 0 にしない                                                                                                                                                                                     | 影を落とすのは日だけで、0 にすると家具の影が消える                                                                                                                                                                             |
| 当たりのある家具（レンジ・針金の棚・タオルの台・洗濯機・木の棚・消火器・掃除機・携行缶・ひじ掛け椅子・床置きのランプ・置いたままの折りたたみ椅子、移したガスボンベ）を足し、`CHAMELEON_VERSION` は 2 のまま | spec が大物の家具を足すことと版を上げないことの両方を決めている。どの端末も同じ配信から同じ当たりを作る。古い版のままの端末が混じると、新しい家具のまわりで埋まりの判定と弾の遮りが親とずれる。混ぜたくなければ版を 3 に上げる |
| 階段・カーテン・壁の板の布・灰緑のタイルの柱・金属のバケツは作らない                                                                                                                                        | 階段は行き先の無い坂になり、ほかは本家の印象への効きが小さい                                                                                                                                                                   |
| 書斎の天井はランドリーと同じ暗い板張り                                                                                                                                                                      | 本家の画面に天井が無い。大広間の格天井の写しには根拠が無く、同じ canvas を共有すれば GPU のメモリも増えない                                                                                                                    |
| シャンデリアの電球・燭台の笠・HUNTER の台の縁も `glowing()` で作り直す                                                                                                                                      | 「どの材質もスポイトの印を持つ」をテストで固めるため。スポイトがその色を取れるようになるだけで、見た目は同じ                                                                                                                   |
| ロビーの描く回数は 281 回から 380 回ほどに増える                                                                                                                                                            | ロビーから北を向くと屋敷が視野に入り、壁の向こうの屋敷も描く。増えた家具のぶんで、上限の 1354 回には遠い                                                                                                                       |

## ファイルの地図

| ファイル                                                                    | 持つもの                                                                                                   | タスク              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------- |
| `yappari-chameleon/mansion/build.test.ts`                                   | 偽の canvas で組み立てた屋敷の材質・Mesh の数・模様の画素・線の太さ・肉と服の置き方                        | 1, 2, 3, 5, 6, 8    |
| `yappari-chameleon/mansion/moods.ts`                                        | 部屋ごとの明るさの表と、場所から引く `moodAt`                                                              | 1                   |
| `yappari-chameleon/world3d.ts`                                              | `Built.mood` と、カメラの部屋の明るさへ寄せる `#light`                                                     | 1                   |
| `yappari-chameleon/mansion/shapes.ts`                                       | 光る材質 `glowing`                                                                                         | 1                   |
| `yappari-chameleon/mansion/furniture.ts`・`room-furniture.ts`               | 光る材質の作り直し、部屋ごとの家具の口、胸像・折りたたみ椅子・水色の台・ロビーのアーチ                     | 1, 2, 5, 8, 9       |
| `yappari-chameleon/mansion/rooms.ts`                                        | 部屋の点光源・壁と天井の材質・家具の並び                                                                   | 1, 2, 3, 4, 5, 7, 8 |
| `yappari-chameleon/textures-rooms.ts`                                       | 浮き模様の白いタイル・六角タイル・暗い板張り・細い板の床・しぶきの壁                                       | 2, 5, 8, 9          |
| `yappari-chameleon/mansion/kitchen.ts`                                      | 排水溝・換気口・肉の棚と霜降りの肉・ガスボンベ・ステンレスの台と流し・レンジ・針金の棚・台の上の物・まな板 | 2, 3, 4             |
| `yappari-chameleon/mansion/laundry.ts`                                      | 梁・蛍光灯・洗濯ひもの服・タオルの山と台・木の棚・消火器・掃除機・携行缶・青いポスター                     | 5, 6, 7             |
| `yappari-chameleon/mansion/study.ts`                                        | 付け柱・アーチの窓・赤い革のひじ掛け椅子・橙のランプ                                                       | 8                   |
| `yappari-chameleon/textures.ts`                                             | 背の高さのばらつく本                                                                                       | 8                   |
| `yappari-chameleon/mansion/layout.ts`                                       | 材質と家具の種類・当たりの大きさ・`Slab.shift` と `Slab.flip`                                              | 2, 4, 5, 7, 8, 9    |
| `yappari-chameleon/mansion/build.ts`                                        | `mood` を渡す・材質の表・模様のずらしと裏返し                                                              | 1, 5, 9             |
| `yappari-chameleon/mansion/lobby.ts`                                        | 壁ごとの模様のずらし・白いアーチの並び                                                                     | 9                   |
| `yappari-chameleon/mansion/rooms.test.ts`・`lobby.test.ts`・`moods.test.ts` | 部屋の家具の種類・候補との重なり・ガスボンベの場所・ロビーの壁とアーチ・明るさの表                         | 1, 3, 4, 5, 7, 8, 9 |
| `CLAUDE.md`                                                                 | 屋敷の部屋と明るさの説明                                                                                   | 10                  |
| `<scratchpad>/polish/shots.mjs`（リポジトリに入れない）                     | 部屋ごとに撮って、描く回数・三角形・平均の明るさを書き、作り込みの前と本家と並べたシート                   | 1〜10               |

## 撮り方と測り方

部屋ごとの絵は Task 1 で置く `<scratchpad>/polish/shots.mjs` で撮る。ひとりで試すをフリーカメラにして、キッチン・ランドリー・書斎・ロビーを 3 つずつ、大広間と緑の廊下を 1 つずつの向きから撮り、`<scratchpad>/polish/<tag>/` に絵と `stats.json`（1 枚ごとの描く回数・三角形・平均の明るさ）と、部屋ごとに「今」「作り込みの前（`before`）」「本家」を並べた `sheet-<部屋>.png` を書く。キッチンとランドリーは本家の画面（`ss/full2.jpg`・`ref/frames/t21.3.jpg`、`ss/full5.jpg`・`ref/frames/t20.7.jpg`）と並べ、書斎は `ref/frames/t15.0.jpg` と並べる。

明るさは撮った絵を ffmpeg で 1 画素に縮めた灰色の値（0〜255）で、本家の画面も同じ式で測る。部屋ごとの 3 枚の平均を次の帯に入れる。

| 部屋             | 本家の明るさ               | 作り込みの前 | 目標の帯（3 枚の平均）          |
| ---------------- | -------------------------- | ------------ | ------------------------------- |
| キッチン         | 21（暗い角）・71（中ほど） | 177〜194     | 70〜95                          |
| ランドリー       | 69・63                     | 113〜134     | 55〜80                          |
| 書斎             | 59                         | 77〜84       | 55〜75                          |
| ロビー           | 本家の画面なし             | 144〜152     | 作り込みの前から ±10            |
| 大広間・緑の廊下 | 85・98                     | 79・112      | 作り込みの前から ±3（変えない） |

描く回数と三角形は、2b の重さを測った `<scratchpad>/perf-chameleon.mjs`（6 つの視点。作り込みの前の値は `<scratchpad>/perf-2b.json`）をそのまま使い、タスクごとに `<scratchpad>/polish/perf-task<N>.json` に書く。

---

### Task 1: 組み立ての見張りと、部屋ごとの明るさ

**Files:**

- Create: `src/lib/games/yappari-chameleon/mansion/moods.ts`
- Create: `src/lib/games/yappari-chameleon/mansion/build.test.ts`、`src/lib/games/yappari-chameleon/mansion/moods.test.ts`
- Modify: `src/lib/games/yappari-chameleon/world3d.ts`（`Built.mood` と `#light`）、`src/lib/games/yappari-chameleon/mansion/build.ts`（`mood` を渡す）、`src/lib/games/yappari-chameleon/mansion/rooms.ts`（部屋の点光源）
- Modify: `src/lib/games/yappari-chameleon/mansion/shapes.ts`（`glowing`）、`src/lib/games/yappari-chameleon/mansion/furniture.ts`・`src/lib/games/yappari-chameleon/mansion/room-furniture.ts`（光る材質を `glowing` で作る）
- Create（リポジトリに入れない）: `<scratchpad>/polish/shots.mjs`

**Interfaces:**

- Produces: `shapes.ts` の `glowing(tint, glow, strength, rough = 0.8): MeshStandardMaterial`（`finish()` から作るので `userData.pick` を持つ）。
- Produces: `moods.ts` の `Mood`（`sun`・`sky`・`ground`・`fill`・`env`・`exposure`）、`DAY`（大広間と廊下の今の値）、`MOODS`（部屋の名前 → 値）、`moodAt(at: V3): Mood`。
- Produces: `world3d.ts` の `Built.sunless` を `Built.mood?: (at: V3) => Mood` に置き換える（ロビーの日を消すのも `moodAt` が返す）。

本家との差のいちばん目（部屋が明るく平らで、色も暗さの差も無い）を直す。部屋の天井は日を遮らない（遮ると廊下が真っ暗になる）ので、部屋の暗さは日と半球の光と映り込みと露出の強さで作る。数字は、Task 2〜9 の模様と家具を入れたあとに撮って決めた最後の値で、Task 10 でもう一度確かめる。あわせて、残りのタスクが守る決まり（どの材質も `MeshStandardMaterial` で透けず、スポイトの印を持つ。Mesh の数と模様の画素の量）を見張るテストを置く。今の屋敷では、シャンデリアの電球・燭台の笠・HUNTER の台の縁の 3 つが `finish()` を通らずに印を持たないので、`glowing()` で作り直す。

- [ ] **Step 0: 撮る台本を置き、作り込みの前を撮る**

コードを変える前に撮る。dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

**新しいファイル** `<scratchpad>/polish/shots.mjs`

```js
// 実行: node <scratchpad>/polish/shots.mjs <repo の絶対パス> <scratchpad> <tag> [port]
// ひとりで試すをフリーカメラにして部屋ごとに撮り、1 枚ごとの描く回数・三角形・平均の明るさ（0..255）を stats.json に書き、
// 部屋ごとに <tag>・before・本家を並べたシートを作る。dev サーバーは port（既定 5180）で起動しておく
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const [repo, pad, tag, port = '5180'] = process.argv.slice(2);
const out = `${pad}/polish/${tag}`;
await mkdir(out, { recursive: true });
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');
const PI = Math.PI;
// [id, 名前, [[ラベル, pos, yaw, pitch]], [本家の画像]]。yaw 0 が +z、π/2 が +x。pitch は正で下を向く
const ROOMS = [
  [
    'kitchen',
    'キッチン',
    [
      ['肉の棚とガスボンベ', [-18.3, 0.6, 10.9], -PI / 2 - 0.5, 0.35],
      ['レンジとシンク', [-13.4, 0.4, 9.6], 0.75, 0.3],
      ['入口から', [-16, 0, 6.9], 0, 0.1]
    ],
    ['ss/full2.jpg', 'ref/frames/t21.3.jpg']
  ],
  [
    'laundry',
    'ランドリー',
    [
      ['入口から', [-15, 0.2, 2.6], PI, 0.12],
      ['タオルの台と洗濯ひも', [-11.3, 0.2, 1.8], -2.5, 0.12],
      ['西の壁', [-12.5, 0.2, -1], -PI / 2, 0.05]
    ],
    ['ss/full5.jpg', 'ref/frames/t20.7.jpg']
  ],
  [
    'study',
    '書斎・図書室',
    [
      ['入口から', [7.6, 0, 6], PI / 2, 0.05],
      ['中から北東へ', [8.5, 0, 2], 0.8, 0.1],
      ['南の壁', [12.25, 0, 9.6], PI, 0.05]
    ],
    ['ref/frames/t15.0.jpg']
  ],
  [
    'lobby',
    'ロビー',
    [
      ['台を南から', [0, 0, -66.5], 0, 0.15],
      ['南西の隅', [-6.5, 2.2, -66.5], 0.75, -0.12],
      ['水色の台', [3.5, 0, -63.5], 2.2, 0.1]
    ],
    []
  ],
  [
    'hall',
    '大広間と廊下（変えない）',
    [
      ['大広間', [0, 0, 0.6], 0, -0.15],
      ['緑の廊下', [-7.5, 0, 5], -PI / 2, 0]
    ],
    ['ss/full8.jpg', 'ss/full6.jpg']
  ]
];
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/asobibako/games/yappari-chameleon`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('button.solo').click({ force: true });
await page.waitForFunction(() => !!window.__chameleon, null, { timeout: 120000 });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const p = window.__chameleon;
  p.placeAt([0, 0, -30], 0);
  p.toggleEye();
});
const set = (pos, yaw, pitch) =>
  page.evaluate(
    ([pos, yaw, pitch]) => {
      const p = window.__chameleon;
      p.ghost = { pos: [...pos], vy: 0, yaw: 0, ground: true, cling: null };
      p.eyeYaw = yaw;
      p.eyePitch = pitch;
    },
    [pos, yaw, pitch]
  );
const luma = (f) =>
  execFileSync('ffmpeg', ['-v', 'error', '-i', f, '-vf', 'format=gray,scale=1:1:flags=area', '-f', 'rawvideo', '-'])[0];
const stats = [];
for (const [id, , views] of ROOMS)
  for (const [k, [label, pos, yaw, pitch]] of views.entries()) {
    // 部屋の明かりはカメラの場所でなめらかに移るので、移り終えるまで待つ
    await set(pos, yaw, pitch);
    await page.waitForTimeout(900);
    await set(pos, yaw, pitch);
    await page.waitForTimeout(600);
    const file = `${out}/${id}-${k}.png`;
    await page.locator('canvas').first().screenshot({ path: file });
    const { calls, triangles } = await page.evaluate(async () => {
      await new Promise((r) => requestAnimationFrame(r));
      return { ...window.__chameleon.world.renderer.info.render };
    });
    stats.push({ view: `${id}-${k}`, label, calls, triangles, luma: luma(file) });
  }
await browser.close();
await writeFile(`${out}/stats.json`, JSON.stringify(stats, null, 2));
console.table(stats);
const uri = async (f) =>
  `data:image/${f.endsWith('jpg') ? 'jpeg' : 'png'};base64,${(await readFile(f)).toString('base64')}`;
const cell = async (f, label) =>
  `<div style="color:#fff;font:14px sans-serif;width:460px">${label}<br><img src="${await uri(f)}" width="460"></div>`;
const sb = await chromium.launch({ channel: 'chrome' });
const p2 = await sb.newPage({ viewport: { width: 1900, height: 1000 } });
for (const [id, name, views, originals] of ROOMS) {
  const row = async (t) =>
    `<div style="display:flex;gap:6px;margin-bottom:8px">${(
      await Promise.all(
        views.map(async ([label], k) => {
          const f = `${pad}/polish/${t}/${id}-${k}.png`;
          const s = JSON.parse(await readFile(`${pad}/polish/${t}/stats.json`, 'utf8')).find(
            (x) => x.view === `${id}-${k}`
          );
          return existsSync(f) ? cell(f, `${t}: ${label}（明るさ ${s?.luma}・${s?.calls} 回）`) : '';
        })
      )
    ).join('')}</div>`;
  const before = tag !== 'before' && existsSync(`${pad}/polish/before/stats.json`) ? await row('before') : '';
  const orig = (
    await Promise.all(originals.map((f) => cell(`${pad}/${f}`, `本家 ${f}（明るさ ${luma(`${pad}/${f}`)}）`)))
  ).join('');
  await p2.setContent(
    `<body style="margin:0;padding:8px;background:#222"><h3 style="color:#fff;font:bold 18px sans-serif">${name}</h3>${await row(tag)}${before}<div style="display:flex;gap:6px">${orig}</div></body>`
  );
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: `${out}/sheet-${id}.png`, fullPage: true });
}
await sb.close();
console.log('ok', out);
```

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> before`
Expected: 14 行の表（`kitchen-0` 〜 `hall-1`）と `ok`。キッチンの明るさは 177・194・183、ランドリーは 134・130・113、書斎は 77・84・82、ロビーは 144・151・152、大広間と緑の廊下は 79・112 前後。

- [ ] **Step 1: 落ちるテストを書く**

**新しいファイル** `src/lib/games/yappari-chameleon/mansion/build.test.ts`

```ts
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Built } from '../world3d';

/**
 * node には canvas が無いので、描く命令を捨てて空の画素を返す 2D の文脈を渡す。
 * 模様の中身ではなく、材質の種類・スポイトの印・Mesh と模様の数を見る
 */
function fakeCanvas() {
  const canvas = { width: 0, height: 0, getContext: () => context };
  const context: object = new Proxy(
    {},
    {
      get: (_, key) => {
        if (key === 'canvas') return canvas;
        if (key === 'getImageData')
          return (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4)
          });
        if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
        return () => {};
      },
      set: () => true
    }
  );
  return canvas;
}

let built: Built;
beforeAll(async () => {
  vi.stubGlobal('document', { createElement: fakeCanvas });
  const { buildMansion } = await import('./build');
  built = buildMansion();
});

function meshes(): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  built.group.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}
const materials = () => meshes().flatMap((m) => (Array.isArray(m.material) ? m.material : [m.material]));

describe('組み立てた屋敷', () => {
  it('どの材質も透かし窓の効く MeshStandardMaterial で、透けず、スポイトの印を持つ', () => {
    for (const m of materials()) {
      expect(m).toBeInstanceOf(THREE.MeshStandardMaterial);
      // 透ける材質は mergeStatic がまとめず、描く回数が増える
      expect(m.transparent).toBe(false);
      expect(m.userData.pick, (m as THREE.MeshStandardMaterial).color.getHexString()).toBeDefined();
    }
  });

  it('まとめたあとの Mesh の数と模様の画素の量が上限を超えない', () => {
    // 1 枚の Mesh は画面と日の影で 2 回ほど描くので、描く回数の上限（1354 回）の 3 分の 1 を Mesh の上限にする
    expect(meshes().length).toBeLessThanOrEqual(450);
    const canvases = new Set(
      materials()
        .map((m) => (m as THREE.MeshStandardMaterial).map?.image as { width: number; height: number } | undefined)
        .filter((c) => !!c)
    );
    const bytes = [...canvases].reduce((n, c) => n + c!.width * c!.height * 4, 0);
    expect(bytes).toBeLessThanOrEqual(32e6);
  });
});
```

**新しいファイル** `src/lib/games/yappari-chameleon/mansion/moods.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { DAY, moodAt, MOODS } from './moods';
import { PLACES, SPAWNS } from './layout';

describe('部屋ごとの明るさ', () => {
  it('キッチン・ランドリー・書斎は大広間より暗く、日を消さない（影を落とすのは日だけ）', () => {
    for (const name of ['キッチン', 'ランドリー', '書斎']) {
      const m = MOODS[name];
      expect(PLACES.some((p) => p.name === name)).toBe(true);
      expect(m.sun, name).toBeGreaterThan(0);
      expect(m.sun, name).toBeLessThan(DAY.sun);
      expect(m.fill, name).toBeLessThan(DAY.fill);
    }
  });

  it('カメラのいる部屋の値を返し、大広間・廊下・控室は今のまま、ロビーは日を消す', () => {
    expect(moodAt([-16, 1.5, 11])).toBe(MOODS['キッチン']);
    expect(moodAt([-15, 1.5, -1])).toBe(MOODS['ランドリー']);
    expect(moodAt([12, 1.5, 6])).toBe(MOODS['書斎']);
    expect(moodAt([0, 1.5, 5])).toBe(DAY);
    expect(moodAt([-15, 1.5, 5])).toBe(DAY);
    expect(moodAt(SPAWNS.room[1])).toBe(DAY);
    expect(moodAt([0, 1.5, -66])).toEqual({ ...DAY, sun: 0 });
  });
});
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/build.test.ts src/lib/games/yappari-chameleon/mansion/moods.test.ts`
Expected: FAIL。`moods.test.ts` は `./moods` が無くて落ちる。`build.test.ts` は 1 つめのテストが、印の無い材質（`fff3d0`）で落ちる。2 つめのテストは今のままで通る。

- [ ] **Step 3: 実装する**

**差分** `src/lib/games/yappari-chameleon/mansion/build.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/build.ts b/src/lib/games/yappari-chameleon/mansion/build.ts
--- a/src/lib/games/yappari-chameleon/mansion/build.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.ts
@@ -9,6 +9,7 @@ import { piece } from './furniture';
 import { levelOf, mansion, type Face, type Mat, type Piece, type Slab } from './layout';
 import { inLobby } from './lobby';
 import { mergeStatic } from './merge';
+import { moodAt } from './moods';
 import { ART } from './props';

 const LOOKS: Record<Mat, () => Finish> = {
@@ -138,7 +139,7 @@ export function buildMansion(): Built {
     glow: (on) => {
       for (const r of rims) r.emissiveIntensity = on ? 3 : 0;
     },
-    sunless: inLobby,
+    mood: moodAt,
     arrange
   };
 }
```

**差分** `src/lib/games/yappari-chameleon/mansion/furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/furniture.ts b/src/lib/games/yappari-chameleon/mansion/furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/furniture.ts
@@ -1,7 +1,7 @@
 import * as THREE from 'three';
 import type { Piece } from './layout';
 import { ROOM_MAKERS } from './room-furniture';
-import { ball, BLACK, box, cyl, GOLD, plane, variant, WHITE, WOOD, type Maker } from './shapes';
+import { ball, BLACK, box, cyl, glowing, GOLD, plane, variant, WHITE, WOOD, type Maker } from './shapes';
 import { books, finish, leather, marble, oilPainting, poster, rug, type Finish } from '../textures';

 /** 本家の床の風船（黄緑・ピンク・黄・青緑・マゼンタ）。つやを写さないと丸まっても化けられない */
@@ -143,10 +143,7 @@ function chandelier(g: THREE.Group) {
     g.add(ring);
     for (let i = 0; i < n; i++) {
       const a = (i * Math.PI * 2) / n;
-      const bulb = new THREE.Mesh(
-        new THREE.SphereGeometry(0.045, 12, 8),
-        new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffe2a0', emissiveIntensity: 2 })
-      );
+      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), glowing('#fff3d0', '#ffe2a0', 2));
       bulb.position.set(Math.cos(a) * r, y + 0.07, Math.sin(a) * r);
       g.add(bulb);
       const drop = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), finish(crystal, [0.1, 0.1]));
@@ -161,15 +158,9 @@ function chandelier(g: THREE.Group) {
 function sconce(g: THREE.Group) {
   box(g, [0.06, 0.25, 0.04], GOLD, [0, 0, 0.02]);
   box(g, [0.04, 0.04, 0.25], GOLD, [0, 0.1, 0.14]);
-  const shade = new THREE.Mesh(
-    new THREE.CylinderGeometry(0.08, 0.14, 0.18, 20, 1, true),
-    new THREE.MeshStandardMaterial({
-      color: '#f3e3c0',
-      emissive: '#ffcf8a',
-      emissiveIntensity: 0.8,
-      side: THREE.DoubleSide
-    })
-  );
+  const glass = glowing('#f3e3c0', '#ffcf8a', 0.8);
+  glass.side = THREE.DoubleSide;
+  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 0.18, 20, 1, true), glass);
   shade.position.set(0, 0.22, 0.27);
   g.add(shade);
 }
```

**新しいファイル** `src/lib/games/yappari-chameleon/mansion/moods.ts`

```ts
import type { V3 } from '$lib/sculpt';
import { placeOf } from './layout';
import { inLobby } from './lobby';

/** カメラのいる部屋の明るさ。どれも shader の uniform なので、部屋を移っても材質を作り直さない */
export interface Mood {
  /** 上からの日。影を落とすのはこの光だけで、部屋の天井は日を遮らないので、部屋ごとの暗さはこの強さで作る */
  sun: number;
  /** 半球の光の空の色・床の色・強さ */
  sky: string;
  ground: string;
  fill: number;
  /** 映り込みの環境の強さ */
  env: number;
  exposure: number;
}

/** 大広間・緑の廊下・控室 */
export const DAY: Mood = { sun: 1.6, sky: '#fff4e0', ground: '#5a4a3a', fill: 1.1, env: 0.45, exposure: 1 };

/** 本家の画面の明るさに寄せた部屋ごとの値。隠れる・探すが見えなくならないよう、本家より少し明るくしてある */
export const MOODS: Record<string, Mood> = {
  キッチン: { sun: 0.4, sky: '#c4d2cc', ground: '#26332f', fill: 0.45, env: 0.3, exposure: 0.72 },
  ランドリー: { sun: 0.3, sky: '#d8c8c0', ground: '#2a1814', fill: 0.42, env: 0.2, exposure: 0.95 },
  書斎: { sun: 0.5, sky: '#ffd9b0', ground: '#3a2214', fill: 0.6, env: 0.4, exposure: 1.15 }
};

// 日の影は屋敷だけを覆うので、影の外のロビーでは上を向いた面が日で白く飛ぶ
const LOBBY_MOOD: Mood = { ...DAY, sun: 0 };

export const moodAt = (at: V3): Mood => (inLobby(at) ? LOBBY_MOOD : (MOODS[placeOf(at)] ?? DAY));
```

**差分** `src/lib/games/yappari-chameleon/mansion/room-furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
@@ -2,7 +2,7 @@ import * as THREE from 'three';
 import { finish, type Finish } from '../textures';
 import { hunterSign } from '../textures-rooms';
 import type { Kind, Piece } from './layout';
-import { ball, box, copy, cyl, plane, variant, WHITE, WOOD, type Maker } from './shapes';
+import { ball, box, copy, cyl, glowing, plane, variant, WHITE, WOOD, type Maker } from './shapes';

 /** 縁は乗っている人がいるあいだ光る輪で、build が userData.glow で拾う */
 function podium(g: THREE.Group) {
@@ -16,11 +16,8 @@ function podium(g: THREE.Group) {
   top.position.y = 0.302;
   top.receiveShadow = true;
   g.add(top);
-  const rim = new THREE.Mesh(
-    new THREE.TorusGeometry(1.2, 0.05, 10, 96),
-    // 消えているときは台と同じ赤にして、点いたときの黄色い光との差で乗っているのが分かるようにする
-    new THREE.MeshStandardMaterial({ color: '#c8231e', roughness: 0.55, emissive: '#ffd36b', emissiveIntensity: 0 })
-  );
+  // 消えているときは台と同じ赤にして、点いたときの黄色い光との差で乗っているのが分かるようにする
+  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 10, 96), glowing('#c8231e', '#ffd36b', 0, 0.55));
   rim.rotation.x = Math.PI / 2;
   rim.position.y = 0.3;
   rim.userData.glow = true;
@@ -49,10 +46,7 @@ function desk(g: THREE.Group) {
   for (const x of [-0.6, 0.6]) box(g, [0.36, 0.71, 0.72], WOOD, [x, 0.355, 0]);
   cyl(g, [0.07, 0.08], 0.02, BRASS, [0.35, 0.77, -0.15]);
   cyl(g, [0.012, 0.012], 0.32, BRASS, [0.35, 0.93, -0.15]);
-  // スポイトは finish の材質に付く userData.pick しか読めない
-  const glass = finish({ tint: '#1f6b3a', rough: 0.3 }, [0.36, 0.36]);
-  glass.emissive.set('#2f8a4a');
-  glass.emissiveIntensity = 0.25;
+  const glass = glowing('#1f6b3a', '#2f8a4a', 0.25, 0.3);
   glass.side = THREE.DoubleSide;
   const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.36, 24, 1, true, 0, Math.PI), glass);
   shade.rotation.z = Math.PI / 2;
```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.ts b/src/lib/games/yappari-chameleon/mansion/rooms.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.ts
@@ -104,10 +104,14 @@ export function roomPieces(): Piece[] {
   ];
 }

-/** 書斎は机の上のランプの暖色、キッチンは白い天井灯、ランドリーは少し暗め */
+/**
+ * 書斎は机のランプの暖色、キッチンは少し青緑の白い天井灯、ランドリーは 2 列の蛍光灯の少し青い白。
+ * 部屋の暗さは moods.ts の日と半球の光で作り、点光源は光の溜まりを作る
+ */
 export const roomLights = (): Light[] => [
-  { at: [12.3, 2.4, 6], color: '#ffd59a', power: 12, reach: 12 },
+  { at: [12.3, 1.6, 6], color: '#ffc58a', power: 7, reach: 9 },
   // 天井のダクト（x −16.3〜−15.7）の中に入らないよう、少し東へ寄せる
-  { at: [-14, 3.1, 11], color: '#f2f6ff', power: 8, reach: 13 },
-  { at: [-15, 3.2, -1], color: '#ffe2c4', power: 7, reach: 11 }
+  { at: [-14, 3.1, 11], color: '#dfe8e4', power: 7, reach: 11 },
+  { at: [-16.5, 3.1, -2.1], color: '#f2f4ff', power: 4, reach: 7 },
+  { at: [-13.5, 3.1, 0.9], color: '#f2f4ff', power: 4, reach: 7 }
 ];
```

**差分** `src/lib/games/yappari-chameleon/mansion/shapes.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/shapes.ts b/src/lib/games/yappari-chameleon/mansion/shapes.ts
--- a/src/lib/games/yappari-chameleon/mansion/shapes.ts
+++ b/src/lib/games/yappari-chameleon/mansion/shapes.ts
@@ -56,4 +56,12 @@ export function copy(g: THREE.Group, o: THREE.Mesh, at: [number, number, number]
   return c;
 }

+/** 光る材質。スポイトは finish の材質に付く userData.pick しか読めないので、finish から作る */
+export function glowing(tint: string, glow: string, strength: number, rough = 0.8): THREE.MeshStandardMaterial {
+  const m = finish({ tint, rough }, [1, 1]);
+  m.emissive.set(glow);
+  m.emissiveIntensity = strength;
+  return m;
+}
+
 export const variant = (p: Piece) => Math.abs(Math.round(p.at[0] * 7 + p.at[2] * 13));
```

**差分** `src/lib/games/yappari-chameleon/world3d.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/world3d.ts b/src/lib/games/yappari-chameleon/world3d.ts
--- a/src/lib/games/yappari-chameleon/world3d.ts
+++ b/src/lib/games/yappari-chameleon/world3d.ts
@@ -5,6 +5,7 @@ import type { RGB } from './color';
 import { bakePose, PoseAnimator, type DollRig } from './doll3d';
 import { cameraReach, settleDist, type Body, type DistState, type Level } from './move';
 import { brushModel, disposeModel, gunModel, inHand, MUZZLE } from './gun';
+import { DAY, type Mood } from './mansion/moods';
 import { placement, type Placeable } from './shots';
 import { readPick } from './textures';
 import { seeThrough, XRAY } from './xray';
@@ -16,7 +17,8 @@ export interface Built {
   group: THREE.Group;
   level: Level;
   glow?: (on: boolean) => void;
-  sunless?: (at: V3) => boolean;
+  /** カメラのいる場所の明るさ */
+  mood?: (at: V3) => Mood;
   /** 試合の小物の置き方にする（3D は作り直さずに動かす）。新しい当たりを返す */
   arrange?: (seed: number | null) => Level;
 }
@@ -25,7 +27,7 @@ export interface Built {
  * カメラの線の太さ。体は壁から RADIUS 離れて歩くので、同じ太さにすると壁ぎわを歩くあいだ縁の線がずっと壁をかすめて、距離が潰れる
  */
 const CAM_RADIUS = 0.12;
-const SUN = 1.6;
+const TINT = new THREE.Color();

 /** 体の根元を、張り付き（壁から離す・天井で寝かせる）も込みで置く。ほかの人の体も同じ置き方にする */
 export function placeRoot(root: THREE.Object3D, b: Placeable): void {
@@ -49,7 +51,9 @@ export class World {
   level: Level = { boxes: [], ramps: [], spawn: [0, 0, 0] };
   #stage: THREE.Group | null = null;
   #built: Built | null = null;
-  #sun = new THREE.DirectionalLight('#fff1dc', SUN);
+  #sun = new THREE.DirectionalLight('#fff1dc', DAY.sun);
+  #fill = new THREE.HemisphereLight(DAY.sky, DAY.ground, DAY.fill);
+  #lit = 0;
   #environment: THREE.WebGLRenderTarget | null = null;
   #ray = new THREE.Raycaster();
   #cursor = new THREE.Mesh(
@@ -91,7 +95,7 @@ export class World {
       onRestore();
     });
     this.scene.background = new THREE.Color('#1d1a17');
-    this.scene.add(new THREE.HemisphereLight('#fff4e0', '#5a4a3a', 1.1));
+    this.scene.add(this.#fill);
     const top = this.#sun;
     // 屋敷の全体（x −24〜18、z −7〜17）を 1 枚の影で覆う
     top.position.set(-3, 20, 5);
@@ -128,13 +132,14 @@ export class World {
     this.#environment?.dispose();
     this.#environment = pmrem.fromScene(env, 0.04);
     this.scene.environment = this.#environment.texture;
-    this.scene.environmentIntensity = 0.45;
+    this.scene.environmentIntensity = DAY.env;
     env.dispose();
     pmrem.dispose();
   }

   setStage(b: Built): void {
     this.#built = b;
+    this.#lit = 0;
     this.#stage?.removeFromParent();
     this.#stage = b.group;
     this.level = b.level;
@@ -300,12 +305,28 @@ export class World {
     XRAY.depth.value = dist - 0.3;
   }

+  /**
+   * カメラのいる部屋の明るさへ寄せる。光を足し引きすると材質の shader を作り直して止まるので、強さと色だけを変える。
+   * 戸口をまたいだ瞬間に跳ぶと目立つので 0.3 秒ほどで移す
+   */
+  #light(): void {
+    const c = this.camera.position;
+    const m = this.#built?.mood?.([c.x, c.y, c.z]) ?? DAY;
+    const now = performance.now();
+    const k = this.#lit ? 1 - Math.exp(-(now - this.#lit) / 300) : 1;
+    this.#lit = now;
+    const ease = (a: number, b: number) => a + (b - a) * k;
+    this.#sun.intensity = ease(this.#sun.intensity, m.sun);
+    this.#fill.intensity = ease(this.#fill.intensity, m.fill);
+    this.#fill.color.lerp(TINT.set(m.sky), k);
+    this.#fill.groundColor.lerp(TINT.set(m.ground), k);
+    this.scene.environmentIntensity = ease(this.scene.environmentIntensity, m.env);
+    this.renderer.toneMappingExposure = ease(this.renderer.toneMappingExposure, m.exposure);
+  }
+
   render(): void {
     this.rig.paint.flush();
-    // 日の影は屋敷だけを覆うので、影の外のロビーでは上を向いた面が日で白く飛ぶ。ロビーにカメラがあるあいだは日を消す
-    // （光を足し引きすると材質の shader を作り直して止まるので、強さで消す）
-    const c = this.camera.position;
-    this.#sun.intensity = this.#built?.sunless?.([c.x, c.y, c.z]) ? 0 : SUN;
+    this.#light();
     this.renderer.render(this.scene, this.camera);
     if (!this.overlay.visible) return;
     this.hand.position.copy(this.camera.position);
```

- [ ] **Step 4: 通るのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（408 tests）。

- [ ] **Step 5: 撮って、作り込みの前と本家と並べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task1`
Expected: `pageerror` が出ず、最後に `ok` と書いた場所を出す。

Read で `<scratchpad>/polish/task1/sheet-kitchen.png`、`<scratchpad>/polish/task1/sheet-laundry.png`、`<scratchpad>/polish/task1/sheet-study.png`、`<scratchpad>/polish/task1/sheet-lobby.png` を見て、次を確かめる。

| 見るところ               | 写っていること                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------- |
| キッチン                 | 白いタイルと淡い青の床のまま、全体が灰緑がかって暗くなる（模様と家具は Task 2〜4） |
| ランドリー               | 赤れんがと四角い布のまま、壁と天井が沈み、天井の 2 か所に光の溜まり                |
| 書斎                     | 暖色で暗くなり、机のランプのまわりが明るい                                         |
| ロビー・大広間・緑の廊下 | 作り込みの前と同じ明るさ（帯の表の ±10 と ±3）                                     |

明るさ（`<scratchpad>/polish/task1/stats.json` の `luma`）は、計画を試したときに次の値だった。キッチンは床と壁が白いままなので 110〜125 で、Task 2 で帯に入る。ここでは `MOODS` を動かさない（帯と比べるのは Task 10）。

| 部屋             | 1 枚ずつ      | 平均 |
| ---------------- | ------------- | ---- |
| キッチン         | 111・125・116 | 117  |
| ランドリー       | 82・79・64    | 75   |
| 書斎             | 65・73・72    | 70   |
| ロビー           | 144・151・152 | 149  |
| 大広間・緑の廊下 | 78・111       | ―    |

浮いている・床に沈んでいる・前と後ろが逆・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形か並びの数値だけを直して撮り直す（並びを動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` も通す）。

- [ ] **Step 6: 描く回数と三角形を測る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task1.json`
Expected: 6 行の数を出し、`calls` はどれも 1354 以下、`lights` はどれも 14。計画を試したときの値は次のとおり（作り込みの前は `<scratchpad>/perf-2b.json`）。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 284      | 270,851    | 270,851    |
| hall     | 183      | 183      | 223,407    | 223,407    |
| corridor | 177      | 177      | 179,017    | 179,017    |
| study    | 142      | 142      | 150,890    | 150,890    |
| kitchen  | 147      | 147      | 172,197    | 172,197    |
| laundry  | 166      | 166      | 153,939    | 153,939    |

- [ ] **Step 7: 確かめてコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Light each room by where the camera is and guard the built mansion materials"
```

---

### Task 2: キッチンの床と壁

**Files:**

- Create: `src/lib/games/yappari-chameleon/mansion/kitchen.ts`（排水溝・換気口）
- Modify: `src/lib/games/yappari-chameleon/textures-rooms.ts`（`whiteTile`・`blueHex`・`HEX`）、`src/lib/games/yappari-chameleon/mansion/layout.ts`（`drain`・`vent`）、`src/lib/games/yappari-chameleon/mansion/furniture.ts`（`KITCHEN_MAKERS`）、`src/lib/games/yappari-chameleon/mansion/rooms.ts`（並び）
- Test: `src/lib/games/yappari-chameleon/mansion/build.test.ts`

**Interfaces:**

- Produces: `textures-rooms.ts` の `HEX = { r: 0.05, grout: 0.02 }`（六角の中心から角までの周期の半径と目地の幅、m）。
- Produces: `kitchen.ts` の `KITCHEN_MAKERS`（このタスクでは `drain`・`vent`）。`Kind` に `drain`・`vent`（どちらも当たらない）。

差の 2 つめ（床の六角が大きく淡く、目地が白く太い）と 8 つめ（壁が平らな白い格子）を直す。床は暗い目地にティールからコバルトの色むらの小さな六角、壁は溝の輪と面取りの浮き模様のタイルにする。本家の画面にある台ぞいの排水溝の格子と、壁の金属の換気口も足す。

- [ ] **Step 1: 落ちるテストを書く**

**差分** `src/lib/games/yappari-chameleon/mansion/build.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/build.test.ts b/src/lib/games/yappari-chameleon/mansion/build.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/build.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.test.ts
@@ -1,13 +1,14 @@
 import * as THREE from 'three';
 import { beforeAll, describe, expect, it, vi } from 'vitest';
+import type { Pattern } from '../textures';
 import type { Built } from '../world3d';

 /**
  * node には canvas が無いので、描く命令を捨てて空の画素を返す 2D の文脈を渡す。
- * 模様の中身ではなく、材質の種類・スポイトの印・Mesh と模様の数を見る
+ * 模様の中身ではなく、材質の種類・スポイトの印・Mesh と模様の数と、線の太さ（lineWidth に入れた値）を見る
  */
 function fakeCanvas() {
-  const canvas = { width: 0, height: 0, getContext: () => context };
+  const canvas = { width: 0, height: 0, widths: [] as number[], getContext: () => context };
   const context: object = new Proxy(
     {},
     {
@@ -22,7 +23,10 @@ function fakeCanvas() {
         if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
         return () => {};
       },
-      set: () => true
+      set: (_, key, value) => {
+        if (key === 'lineWidth') canvas.widths.push(value);
+        return true;
+      }
     }
   );
   return canvas;
@@ -66,3 +70,24 @@ describe('組み立てた屋敷', () => {
     expect(bytes).toBeLessThanOrEqual(32e6);
   });
 });
+
+/** 模様の中でいちばん細い線（m）。線を引かない模様は Infinity */
+const thinnest = (p: Pattern) =>
+  Math.min(...(p.canvas as unknown as { widths: number[] }).widths) * (p.meters[0] / p.canvas.width);
+
+describe('作り込んだ模様', () => {
+  it('線は 2cm 以上（体に写せる太さ）', async () => {
+    const rooms = await import('../textures-rooms');
+    for (const [name, p] of Object.entries({ whiteTile: rooms.whiteTile() }))
+      expect(thinnest(p), name).toBeGreaterThanOrEqual(0.0199);
+  });
+
+  it('六角タイルの目地は 2cm で、模様は周期の整数倍で継ぎ目なく繰り返す', async () => {
+    const { blueHex, HEX } = await import('../textures-rooms');
+    const p = blueHex();
+    expect(HEX.grout).toBeGreaterThanOrEqual(0.02);
+    expect(p.meters[0] / (Math.sqrt(3) * HEX.r)).toBeCloseTo(8, 6);
+    expect(p.meters[1] / (3 * HEX.r)).toBeCloseTo(4, 6);
+    expect(p.canvas.width / p.meters[0]).toBeCloseTo(p.canvas.height / p.meters[1], -1);
+  });
+});
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/build.test.ts`
Expected: FAIL。`HEX` が `textures-rooms.ts` に無いので、六角タイルのテストが落ちる。

- [ ] **Step 3: 実装する**

**差分** `src/lib/games/yappari-chameleon/mansion/furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/furniture.ts b/src/lib/games/yappari-chameleon/mansion/furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/furniture.ts
@@ -1,5 +1,6 @@
 import * as THREE from 'three';
 import type { Piece } from './layout';
+import { KITCHEN_MAKERS } from './kitchen';
 import { ROOM_MAKERS } from './room-furniture';
 import { ball, BLACK, box, cyl, glowing, GOLD, plane, variant, WHITE, WOOD, type Maker } from './shapes';
 import { books, finish, leather, marble, oilPainting, poster, rug, type Finish } from '../textures';
@@ -263,7 +264,8 @@ const MAKERS: Record<Piece['kind'], Maker> = {
   bunting,
   banner,
   stairs,
-  ...ROOM_MAKERS
+  ...ROOM_MAKERS,
+  ...KITCHEN_MAKERS
 };

 export function piece(p: Piece): THREE.Group {
```

**新しいファイル** `src/lib/games/yappari-chameleon/mansion/kitchen.ts`

```ts
import * as THREE from 'three';
import { make, type Finish, type Pattern } from '../textures';
import type { Kind } from './layout';
import { box, copy, plane, type Maker } from './shapes';

/** 台の前の床の排水溝の格子。黒い鉄の棒と隙間はどちらも 2cm */
function grate(): Pattern {
  return make('grate', 64, 256, [0.08, 0.32], (g) => {
    g.fillStyle = '#050607';
    g.fillRect(0, 0, 64, 256);
    g.fillStyle = '#2a2f33';
    g.fillRect(0, 0, 32, 256);
    g.fillRect(0, 0, 64, 26);
  });
}

const IRON: Finish = { tint: '#3b3f43', metal: 0.6, rough: 0.5 };

/** 置いた向きの x へ span の長さに伸びる */
function drain(g: THREE.Group, p: { span?: number }) {
  const span = p.span ?? 4;
  plane(g, [span, 0.25], { pattern: grate(), metal: 0.6, rough: 0.45 }, [0, 0.004, 0], -Math.PI / 2);
}

/** 前（+z）が部屋の側 */
function vent(g: THREE.Group) {
  box(g, [0.42, 0.32, 0.06], IRON, [0, 0, 0.03]);
  box(g, [0.36, 0.26, 0.02], { tint: '#111315', rough: 0.8 }, [0, 0, 0.061]);
  const slat = box(g, [0.36, 0.025, 0.04], IRON, [0, -0.1, 0.07]);
  slat.rotation.x = 0.6;
  for (let k = 1; k < 5; k++) copy(g, slat, [0, -0.1 + k * 0.05, 0.07]).rotation.x = 0.6;
}

export const KITCHEN_MAKERS = { drain, vent } satisfies Partial<Record<Kind, Maker>>;
```

**差分** `src/lib/games/yappari-chameleon/mansion/layout.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/layout.ts b/src/lib/games/yappari-chameleon/mansion/layout.ts
--- a/src/lib/games/yappari-chameleon/mansion/layout.ts
+++ b/src/lib/games/yappari-chameleon/mansion/layout.ts
@@ -76,7 +76,9 @@ export type Kind =
   | 'washer'
   | 'clothesline'
   | 'towels'
-  | 'cart';
+  | 'cart'
+  | 'drain'
+  | 'vent';

 export interface Piece {
   kind: Kind;
@@ -129,7 +131,9 @@ export const SIZES: Record<Kind, V3 | null> = {
   washer: [0.65, 0.85, 0.65],
   clothesline: null,
   towels: [0.5, 0.5, 0.4],
-  cart: [0.8, 0.9, 0.55]
+  cart: [0.8, 0.9, 0.55],
+  drain: null,
+  vent: null
 };

 export interface Light {
```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.ts b/src/lib/games/yappari-chameleon/mansion/rooms.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.ts
@@ -93,6 +93,8 @@ export function roomPieces(): Piece[] {
     p('meat-rack', [-20.75, 0, 12.2], 1),
     p('gas', [-11.4, 0, 14.5]),
     p('gas', [-11.85, 0, 14.6]),
+    p('drain', [-17.9, 0, 14.1], 0, 6),
+    p('vent', [-13.2, 2.3, 15.05], 2),
     p('duct', [-16, 3.2, 11]),
     p('caution', [-15, 0, 10.8]),
     // ランドリー。南と東の壁に洗濯機、部屋を横切る 2 本の洗濯ひも
```

**差分** `src/lib/games/yappari-chameleon/textures-rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/textures-rooms.ts b/src/lib/games/yappari-chameleon/textures-rooms.ts
--- a/src/lib/games/yappari-chameleon/textures-rooms.ts
+++ b/src/lib/games/yappari-chameleon/textures-rooms.ts
@@ -241,40 +241,70 @@ export function planks(): Pattern {
   });
 }

-/** キッチンの白いタイルの壁。15cm 角に灰色の目地（2.3cm） */
+/**
+ * キッチンの白いタイルの壁。20cm 角のタイルに、溝の輪と、面取りした真ん中の四角の浮き模様（本家の暗い角の壁）。
+ * 目地・溝・面取りはどれも 2cm（屋敷の線は 2cm 以上）。本家の 15cm 角では溝と面取りが収まらないので大きくした
+ */
 export function whiteTile(): Pattern {
-  return make('white-tile', 256, 256, [0.6, 0.6], (g) => {
+  return make('white-tile', 512, 512, [0.6, 0.6], (g) => {
     const r = rng(97);
-    g.fillStyle = '#b9bcbf';
-    g.fillRect(0, 0, 256, 256);
-    for (let y = 0; y < 4; y++)
-      for (let x = 0; x < 4; x++) {
-        g.fillStyle = `hsl(200 8% ${92 + r() * 5}%)`;
-        g.fillRect(x * 64 + 5, y * 64 + 5, 54, 54);
+    const cm = 512 / 60;
+    const t = 20 * cm;
+    g.fillStyle = '#9aa09a';
+    g.fillRect(0, 0, 512, 512);
+    g.lineWidth = 2 * cm;
+    for (let j = 0; j < 3; j++)
+      for (let i = 0; i < 3; i++) {
+        const [x0, y0] = [i * t + cm, j * t + cm];
+        const side = t - 2 * cm;
+        g.fillStyle = `hsl(80 ${4 + r() * 4}% ${83 + r() * 4}%)`;
+        g.fillRect(x0, y0, side, side);
+        g.strokeStyle = 'rgb(60 70 60 / 0.16)';
+        g.strokeRect(x0 + 3 * cm, y0 + 3 * cm, side - 6 * cm, side - 6 * cm);
+        // 真ん中の四角の面取り。上と左は明るく、下と右は暗い
+        const [a, b] = [x0 + 6 * cm, x0 + side - 6 * cm];
+        const [c, d] = [y0 + 6 * cm, y0 + side - 6 * cm];
+        for (const [path, color] of [
+          [[a, d, a, c, b, c], 'rgb(255 255 255 / 0.25)'],
+          [[b, c, b, d, a, d], 'rgb(40 50 40 / 0.16)']
+        ] as const) {
+          g.strokeStyle = color;
+          g.beginPath();
+          g.moveTo(path[0], path[1]);
+          g.lineTo(path[2], path[3]);
+          g.lineTo(path[4], path[5]);
+          g.stroke();
+        }
       }
   });
 }

 /**
- * キッチンの青い六角タイルの床。差し渡し 20cm、目地 2.3cm。縦にとがった六角を、横 √3R・縦 3R の周期で
- * 2 周期ぶん描いて継ぎ目なく繰り返す（横の周期は 0.7 画素ずれるが、目に見えない）
+ * キッチンの六角のモザイクタイルの床。タイルの差し渡し 7.7cm で、目地は暗く 2cm（屋敷の線は 2cm 以上。
+ * 本家の 5〜6cm にすると目地が半分を占めるので、少し大きくした）。色はティールからコバルトまでむらがある。
+ * 縦にとがった六角を横 √3R・縦 3R の周期で 8 × 4 周期描き、色は周期の中の位置で決めて継ぎ目でも同じ色にする
  */
+export const HEX = { r: 0.05, grout: 0.02 };
 export function blueHex(): Pattern {
-  const R = 46;
+  const px = 640;
+  const R = HEX.r * px;
   const w = Math.sqrt(3) * R;
-  return make('blue-hex', 160, 276, [0.348, 0.6], (g) => {
-    const r = rng(101);
-    g.fillStyle = '#e8eef2';
-    g.fillRect(0, 0, 160, 276);
-    for (let k = -1; k <= 4; k++)
-      for (let i = -1; i <= 3; i++) {
+  const tile = R - (HEX.grout * px) / Math.sqrt(3);
+  const colors = ['#1f6f8f', '#2f86a8', '#3a9cc0', '#25708a', '#2a5f7a', '#253942'];
+  const r = rng(101);
+  const pick = Array.from({ length: 64 }, () => colors[Math.floor(r() * colors.length)]);
+  return make('blue-hex', Math.round(8 * w), 8 * 1.5 * R, [8 * Math.sqrt(3) * HEX.r, 12 * HEX.r], (g) => {
+    g.fillStyle = '#24414b';
+    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
+    for (let k = -1; k <= 8; k++)
+      for (let i = -1; i <= 8; i++) {
         const cx = i * w + (k % 2 ? w / 2 : 0);
         const cy = k * 1.5 * R;
-        g.fillStyle = `hsl(208 ${55 + r() * 15}% ${38 + r() * 10}%)`;
+        g.fillStyle = pick[(((k % 8) + 8) % 8) * 8 + (((i % 8) + 8) % 8)];
         g.beginPath();
         for (let s = 0; s < 6; s++) {
           const a = Math.PI / 6 + (s * Math.PI) / 3;
-          g.lineTo(cx + Math.cos(a) * (R - 6), cy + Math.sin(a) * (R - 6));
+          g.lineTo(cx + Math.cos(a) * tile, cy + Math.sin(a) * tile);
         }
         g.fill();
       }
```

- [ ] **Step 4: 通るのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（410 tests）。

- [ ] **Step 5: 撮って、作り込みの前と本家と並べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task2`
Expected: `pageerror` が出ず、最後に `ok` と書いた場所を出す。

Read で `<scratchpad>/polish/task2/sheet-kitchen.png` を見て、次を確かめる。

| 見るところ | 写っていること                                                       |
| ---------- | -------------------------------------------------------------------- |
| 床         | 暗い目地に、色むらのある小さな六角（近くで差し渡し 7〜8cm に見える） |
| 壁         | 1 枚ごとに溝の輪と面取りした四角の浮き模様。継ぎ目で模様が切れない   |
| 台の前     | 北の台と流しに沿った黒い格子の帯                                     |
| 北の壁     | 流しの右上の換気口                                                   |

明るさ（`<scratchpad>/polish/task2/stats.json` の `luma`）は、計画を試したときに次の値だった。目標の帯（「撮り方と測り方」の表）から外れたら、Task 1 の `MOODS` の値ではなく、このタスクの模様と色の数字を見直す。

| 部屋     | 1 枚ずつ   | 平均 |
| -------- | ---------- | ---- |
| キッチン | 77・94・90 | 87   |

浮いている・床に沈んでいる・前と後ろが逆・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形か並びの数値だけを直して撮り直す（並びを動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` も通す）。

- [ ] **Step 6: 描く回数と三角形を測る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task2.json`
Expected: 6 行の数を出し、`calls` はどれも 1354 以下、`lights` はどれも 14。計画を試したときの値は次のとおり（作り込みの前は `<scratchpad>/perf-2b.json`）。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 287      | 270,851    | 271,021    |
| hall     | 183      | 186      | 223,407    | 223,577    |
| corridor | 177      | 179      | 179,017    | 179,175    |
| study    | 142      | 143      | 150,890    | 150,974    |
| kitchen  | 147      | 150      | 172,197    | 172,367    |
| laundry  | 166      | 167      | 153,939    | 154,023    |

- [ ] **Step 7: 確かめてコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Give the kitchen embossed wall tiles, a dark mosaic floor, a drain and a vent"
```

---

### Task 3: キッチンの肉の棚とガスボンベ

**Files:**

- Modify: `src/lib/games/yappari-chameleon/mansion/kitchen.ts`（肉の棚・霜降りの肉・ガスボンベ）、`src/lib/games/yappari-chameleon/mansion/room-furniture.ts`（古い肉の棚とガスボンベを消す）、`src/lib/games/yappari-chameleon/mansion/rooms.ts`（ガスボンベを棚の横へ）
- Test: `src/lib/games/yappari-chameleon/mansion/build.test.ts`、`src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

**Interfaces:**

- Produces: `KITCHEN_MAKERS` に `meat-rack`・`gas`（当たりの大きさは今のまま）。

差の 6 つめ（肉が赤い楕円の玉、棚が梯子のような枠）と 9 つめ（ガスボンベが細く背の高い筒）を直す。棚は 3cm の四角の管の柱と黒い金属の板の 4 段、肉は向きの関数で凹凸させた球に霜降りの模様と骨の切り口、ボンベは直径 35cm・高さ 1m のプロパンの形で、上に窓の抜けた持ち手と弁を付ける。ボンベは本家の画面と同じく肉の棚の横に 2 本並べる。

- [ ] **Step 1: 落ちるテストを書く**

**差分** `src/lib/games/yappari-chameleon/mansion/build.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/build.test.ts b/src/lib/games/yappari-chameleon/mansion/build.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/build.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.test.ts
@@ -39,9 +39,9 @@ beforeAll(async () => {
   built = buildMansion();
 });

-function meshes(): THREE.Mesh[] {
+function meshes(root: THREE.Object3D = built.group): THREE.Mesh[] {
   const out: THREE.Mesh[] = [];
-  built.group.traverse((o) => {
+  root.traverse((o) => {
     if (o instanceof THREE.Mesh) out.push(o);
   });
   return out;
@@ -91,3 +91,22 @@ describe('作り込んだ模様', () => {
     expect(p.canvas.width / p.meters[0]).toBeCloseTo(p.canvas.height / p.meters[1], -1);
   });
 });
+
+describe('キッチンの肉の棚', () => {
+  it('霜降りの肉の塊は下の 3 段に 2〜4 個ずつ、浮かず沈まずに棚板の上に載る', async () => {
+    const { piece } = await import('./furniture');
+    const rack = piece({ kind: 'meat-rack', at: [-20.75, 0, 10], turn: 1 });
+    rack.updateMatrixWorld(true);
+    // 棚の中で模様を持つのは霜降りの肉だけ
+    const lumps = meshes(rack).filter((m) => !!(m.material as THREE.MeshStandardMaterial).map);
+    const tops = [0.15, 0.7, 1.25].map((y) => y + 0.0125);
+    const counts = tops.map(() => 0);
+    for (const m of lumps) {
+      const bottom = new THREE.Box3().setFromObject(m).min.y;
+      const k = tops.findIndex((t) => Math.abs(bottom - t) < 0.01);
+      expect(k, `${bottom}`).toBeGreaterThanOrEqual(0);
+      counts[k]++;
+    }
+    for (const n of counts) expect(n >= 2 && n <= 4, `${counts}`).toBe(true);
+  });
+});
```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
@@ -88,6 +88,15 @@ describe('屋敷の 3 部屋', () => {
     expect(placeOf([0, 0, -30])).toBe('控室');
   });

+  it('ガスボンベは 2 本並べて、肉の棚の横に置く', () => {
+    const q = roomPieces();
+    const racks = q.filter((r) => r.kind === 'meat-rack');
+    const gas = q.filter((g) => g.kind === 'gas');
+    expect(gas).toHaveLength(2);
+    for (const g of gas)
+      expect(Math.min(...racks.map((r) => Math.hypot(g.at[0] - r.at[0], g.at[2] - r.at[2])))).toBeLessThan(1.6);
+  });
+
   const boxOf = (q: Piece): Box | null => {
     const s = SIZES[q.kind];
     if (!s) return null;
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/build.test.ts src/lib/games/yappari-chameleon/mansion/rooms.test.ts`
Expected: FAIL。古い肉は模様の無い玉なので肉の塊が 0 個と数えられて落ち、ガスボンベは東の壁の隅にあって棚から遠いので落ちる。

- [ ] **Step 3: 実装する**

**差分** `src/lib/games/yappari-chameleon/mansion/kitchen.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/kitchen.ts b/src/lib/games/yappari-chameleon/mansion/kitchen.ts
--- a/src/lib/games/yappari-chameleon/mansion/kitchen.ts
+++ b/src/lib/games/yappari-chameleon/mansion/kitchen.ts
@@ -1,7 +1,8 @@
 import * as THREE from 'three';
-import { make, type Finish, type Pattern } from '../textures';
-import type { Kind } from './layout';
-import { box, copy, plane, type Maker } from './shapes';
+import { rng } from '../rng';
+import { finish, make, type Finish, type Pattern } from '../textures';
+import type { Kind, Piece } from './layout';
+import { ball, box, copy, cyl, plane, type Maker } from './shapes';

 /** 台の前の床の排水溝の格子。黒い鉄の棒と隙間はどちらも 2cm */
 function grate(): Pattern {
@@ -31,4 +32,106 @@ function vent(g: THREE.Group) {
   for (let k = 1; k < 5; k++) copy(g, slat, [0, -0.1 + k * 0.05, 0.07]).rotation.x = 0.6;
 }

-export const KITCHEN_MAKERS = { drain, vent } satisfies Partial<Record<Kind, Maker>>;
+/** 生の肉の霜降り。赤桃色に白い脂の筋（2cm 以上）と、暗い赤のむら */
+function marbled(): Pattern {
+  return make('marbled', 256, 256, [0.3, 0.3], (g) => {
+    const r = rng(131);
+    g.fillStyle = '#c0625f';
+    g.fillRect(0, 0, 256, 256);
+    for (let i = 0; i < 18; i++) {
+      g.fillStyle = `rgb(${120 + r() * 40} 30 35 / 0.25)`;
+      g.beginPath();
+      g.ellipse(r() * 256, r() * 256, 20 + r() * 30, 10 + r() * 16, r() * Math.PI, 0, Math.PI * 2);
+      g.fill();
+    }
+    g.strokeStyle = 'rgb(246 232 222 / 0.7)';
+    g.lineCap = 'round';
+    for (let i = 0; i < 7; i++) {
+      g.lineWidth = 18 + r() * 10;
+      g.beginPath();
+      let [x, y] = [r() * 256, r() * 256];
+      g.moveTo(x, y);
+      for (let k = 0; k < 4; k++) {
+        x += (r() - 0.5) * 90;
+        y += (r() - 0.5) * 90;
+        g.lineTo(x, y);
+      }
+      g.stroke();
+    }
+  });
+}
+
+const BONE: Finish = { tint: '#efe6d8', rough: 0.6 };
+const SHELF: Finish = { tint: '#0a0b0b', metal: 0.5, rough: 0.35 };
+
+/** ふぞろいな肉の塊。球を向きの関数で凹凸させるので、継ぎ目の頂点も同じだけ動き、面が裂けない */
+function lump(g: THREE.Group, seed: number, size: [number, number, number], at: [number, number, number]) {
+  const r = rng(seed);
+  const [a, b, c] = [r() * 6, r() * 6, r() * 6];
+  const geo = new THREE.SphereGeometry(1, 12, 8);
+  const pos = geo.getAttribute('position');
+  const v = new THREE.Vector3();
+  for (let i = 0; i < pos.count; i++) {
+    v.fromBufferAttribute(pos, i);
+    const k = 1 + 0.16 * Math.sin(3 * v.x + a) * Math.sin(2 * v.y + b) + 0.1 * Math.sin(4 * v.z + c);
+    pos.setXYZ(i, v.x * k * size[0], Math.max(v.y * k, -0.55) * size[1], v.z * k * size[2]);
+  }
+  geo.computeVertexNormals();
+  const o = new THREE.Mesh(geo, finish({ pattern: marbled(), rough: 0.35 }, [0.3, 0.3]));
+  o.position.set(...at);
+  o.rotation.y = r() * Math.PI;
+  o.castShadow = o.receiveShadow = true;
+  g.add(o);
+  if (r() < 0.5)
+    cyl(g, [0.035, 0.035], 0.02, BONE, [at[0] + size[0] * 0.6, at[1], at[2] + size[2] * 0.7], 12).rotation.x =
+      Math.PI / 2;
+}
+
+/** 本家の棚板は網ではなく黒い金属の板 */
+function meatRack(g: THREE.Group, p: Piece) {
+  const post = box(g, [0.03, 2.0, 0.03], SHELF, [-0.785, 1.0, -0.235]);
+  for (const [x, z] of [
+    [0.785, -0.235],
+    [-0.785, 0.235],
+    [0.785, 0.235]
+  ])
+    copy(g, post, [x, 1.0, z]);
+  const shelf = box(g, [1.6, 0.025, 0.5], SHELF, [0, 0.15, 0]);
+  for (const y of [0.7, 1.25, 1.8]) copy(g, shelf, [0, y, 0]);
+  const seed = Math.round(p.at[2] * 10);
+  for (const [k, y] of [0.15, 0.7, 1.25].entries())
+    for (let i = 0; i < 2 + ((seed + k) % 3); i++) {
+      const s = 0.13 + ((seed + i * 7 + k) % 5) * 0.02;
+      lump(
+        g,
+        seed * 31 + k * 7 + i,
+        [s * 1.3, s * 0.75, s],
+        [-0.55 + i * 0.36, y + 0.0125 + s * 0.4, ((i % 2) - 0.5) * 0.12]
+      );
+    }
+}
+
+function gas(g: THREE.Group) {
+  const can: Finish = { tint: '#b8bcb8', metal: 0.4, rough: 0.45 };
+  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.06, 24, 1, true), finish(can, [1, 0.06]));
+  ring.material.side = THREE.DoubleSide;
+  ring.position.y = 0.03;
+  g.add(ring);
+  cyl(g, [0.175, 0.175], 0.72, can, [0, 0.42, 0]);
+  ball(g, 0.175, can, [0, 0.78, 0]).scale.y = 0.55;
+  // 持ち手は 120 度ずつの 2 枚の板で、あいだが窓に抜ける
+  for (const start of [0, Math.PI]) {
+    const arc = new THREE.Mesh(
+      new THREE.CylinderGeometry(0.11, 0.11, 0.16, 12, 1, true, start, (Math.PI * 2) / 3),
+      finish(can, [0.25, 0.16])
+    );
+    arc.material.side = THREE.DoubleSide;
+    arc.position.y = 0.95;
+    arc.castShadow = true;
+    g.add(arc);
+  }
+  cyl(g, [0.03, 0.035], 0.08, { tint: '#8a8f8a', metal: 0.7, rough: 0.35 }, [0, 0.9, 0], 12);
+  box(g, [0.08, 0.025, 0.025], { tint: '#3a3d40', metal: 0.6, rough: 0.4 }, [0.03, 0.95, 0]);
+}
+
+export const KITCHEN_MAKERS = { drain, vent, 'meat-rack': meatRack, gas } satisfies Partial<Record<Kind, Maker>>;
```

**差分** `src/lib/games/yappari-chameleon/mansion/room-furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
@@ -137,43 +137,6 @@ function plates(g: THREE.Group) {
     for (let i = x === -0.18 ? 1 : 0; i < n; i++) copy(g, plate, [x, 0.008 + i * 0.018, 0]);
 }

-/** 金網の棚。前（+z）の段に肉を並べ、上の棒から肉を吊るす */
-function meatRack(g: THREE.Group) {
-  const leg = box(g, [0.04, 2.0, 0.04], IRON, [-0.78, 1.0, -0.23]);
-  for (const [x, z] of [
-    [0.78, -0.23],
-    [-0.78, 0.23],
-    [0.78, 0.23]
-  ])
-    copy(g, leg, [x, 1.0, z]);
-  const shelf = box(g, [1.6, 0.03, 0.5], IRON, [0, 0.35, 0]);
-  for (const y of [0.95, 1.55]) copy(g, shelf, [0, y, 0]);
-  box(g, [1.6, 0.04, 0.04], IRON, [0, 1.98, 0.23]);
-  const meat = ball(g, 0.13, { tint: '#b8434a', rough: 0.6 }, [-0.5, 0.44, 0]);
-  meat.scale.set(1.4, 0.6, 1);
-  const fat = ball(g, 0.05, { tint: '#f1e2d4', rough: 0.7 }, [-0.38, 0.45, 0.05]);
-  for (const y of [0.35, 0.95])
-    for (let i = 0; i < 3; i++) {
-      if (y !== 0.35 || i) {
-        copy(g, meat, [-0.5 + i * 0.5, y + 0.09, 0]);
-        copy(g, fat, [-0.38 + i * 0.5, y + 0.1, 0.05]);
-      }
-    }
-  const hook = cyl(g, [0.005, 0.005], 0.12, IRON, [-0.6, 1.9, 0.23]);
-  for (let i = 0; i < 4; i++) {
-    const x = -0.6 + i * 0.4;
-    if (i) copy(g, hook, [x, 1.9, 0.23]);
-    copy(g, meat, [x, 1.72, 0.23]).scale.set(0.8, 1.5, 0.7);
-  }
-}
-
-function gas(g: THREE.Group) {
-  const can: Finish = { tint: '#9aa3a8', metal: 0.6, rough: 0.4 };
-  cyl(g, [0.17, 0.17], 0.9, can, [0, 0.45, 0]);
-  ball(g, 0.17, can, [0, 0.9, 0]).scale.y = 0.6;
-  cyl(g, [0.03, 0.03], 0.12, IRON, [0, 1.04, 0]);
-}
-
 /** 天井のダクト。置いた向きの z へ 6m 伸びる。当たらない */
 function duct(g: THREE.Group) {
   box(g, [0.6, 0.4, 6], { tint: '#b9bec3', metal: 0.7, rough: 0.4 }, [0, 0, 0]);
@@ -289,8 +252,6 @@ export const ROOM_MAKERS = {
   counter,
   sink,
   plates,
-  'meat-rack': meatRack,
-  gas,
   duct,
   caution,
   box: cardboard,
```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.ts b/src/lib/games/yappari-chameleon/mansion/rooms.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.ts
@@ -91,8 +91,8 @@ export function roomPieces(): Piece[] {
     p('plates', [-17.9, 0.9, 14.7]),
     p('meat-rack', [-20.75, 0, 10], 1),
     p('meat-rack', [-20.75, 0, 12.2], 1),
-    p('gas', [-11.4, 0, 14.5]),
-    p('gas', [-11.85, 0, 14.6]),
+    p('gas', [-20.75, 0, 8.85]),
+    p('gas', [-20.35, 0, 8.55]),
     p('drain', [-17.9, 0, 14.1], 0, 6),
     p('vent', [-13.2, 2.3, 15.05], 2),
     p('duct', [-16, 3.2, 11]),
```

- [ ] **Step 4: 通るのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（412 tests）。

- [ ] **Step 5: 撮って、作り込みの前と本家と並べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task3`
Expected: `pageerror` が出ず、最後に `ok` と書いた場所を出す。

Read で `<scratchpad>/polish/task3/sheet-kitchen.png` を見て、次を確かめる。

| 見るところ | 写っていること                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| 肉の棚     | 黒い板の棚が 4 段。下の 3 段に、白い脂の筋の入ったふぞろいな塊が 2〜4 個ずつ重なり、ところどころに骨の切り口 |
| ガスボンベ | 棚の南の端に太い灰色のボンベが 2 本。上に窓の抜けた持ち手の筒と弁                                            |
| 浮き・沈み | 肉が棚板から浮かず、沈まない                                                                                 |

明るさ（`<scratchpad>/polish/task3/stats.json` の `luma`）は、計画を試したときに次の値だった。目標の帯（「撮り方と測り方」の表）から外れたら、Task 1 の `MOODS` の値ではなく、このタスクの模様と色の数字を見直す。

| 部屋     | 1 枚ずつ   | 平均 |
| -------- | ---------- | ---- |
| キッチン | 78・95・91 | 88   |

浮いている・床に沈んでいる・前と後ろが逆・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形か並びの数値だけを直して撮り直す（並びを動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` も通す）。

- [ ] **Step 6: 描く回数と三角形を測る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task3.json`
Expected: 6 行の数を出し、`calls` はどれも 1354 以下、`lights` はどれも 14。計画を試したときの値は次のとおり（作り込みの前は `<scratchpad>/perf-2b.json`）。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 296      | 270,851    | 230,365    |
| hall     | 183      | 189      | 223,407    | 200,417    |
| corridor | 177      | 188      | 179,017    | 140,079    |
| study    | 142      | 147      | 150,890    | 130,598    |
| kitchen  | 147      | 154      | 172,197    | 129,767    |
| laundry  | 166      | 171      | 153,939    | 133,647    |

- [ ] **Step 7: 確かめてコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Rebuild the kitchen meat racks with marbled meat and propane cylinders"
```

---

### Task 4: キッチンの物の多さ

**Files:**

- Modify: `src/lib/games/yappari-chameleon/mansion/kitchen.ts`（ステンレスの台・深い流し・レンジ・針金の棚・台の上の物・まな板）、`src/lib/games/yappari-chameleon/mansion/room-furniture.ts`（古い台と流しを消す）、`src/lib/games/yappari-chameleon/mansion/layout.ts`（`range`・`pot-rack`・`pots`・`board`）、`src/lib/games/yappari-chameleon/mansion/rooms.ts`（並び）
- Test: `src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

**Interfaces:**

- Produces: `Kind` に `range`（1.0 × 0.9 × 0.8m）・`pot-rack`（0.6 × 1.8 × 0.4m）・`pots`・`board`（どちらも当たらない）。
- Produces: `KITCHEN_MAKERS` に `counter`・`sink`（当たりの大きさは今のまま）。

差の 7 つめ（白い部屋に島の台と棚 2 台だけ）を直す。東の壁にレンジとオーブン（つまみ 6 個と青い輪）と黒い針金の棚、北の壁の流しは脚の付いた深い槽と長い蛇口とまるめた緑のホース、奥の台に鍋・ボウル・野菜、島の台にまな板を置く。台と流しとレンジはヘアラインのステンレスの模様にする。当たりのある家具を足すので、選ばれなかった候補も含めて動く物のどの候補とも重ならないことをテストに足す。

- [ ] **Step 1: 落ちるテストを書く**

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
@@ -3,6 +3,7 @@ import type { V3 } from '$lib/sculpt';
 import { idle, newBody, step, type Body, type Box, type Level } from '../move';
 import { levelOf, mansion, placeOf, SIZES, type Piece } from './layout';
 import { LOBBY } from './lobby';
+import { place, SETS } from './props';
 import { DOORWAYS, KITCHEN, LAUNDRY, roomPieces, STUDY } from './rooms';

 const m = mansion();
@@ -116,6 +117,21 @@ describe('屋敷の 3 部屋', () => {
     }
   });

+  it('3 部屋の動かない家具は、動く物のどの置き場所の候補にも重ならない（選ばれなかった候補も）', () => {
+    const fixed = roomPieces()
+      .map(boxOf)
+      .filter((b): b is Box => b !== null);
+    const bad: string[] = [];
+    for (const set of SETS)
+      for (const slot of set.slots)
+        for (const unit of set.units)
+          for (const q of unit) {
+            const a = boxOf(place(slot, q));
+            if (a) for (const b of fixed) if (hits(a, b)) bad.push(`${q.kind} ${slot.at} と ${b.min}`);
+          }
+    expect(bad).toEqual([]);
+  });
+
   it('本家の画面にある家具がそろう', () => {
     const kinds = (name: string) =>
       new Set(
@@ -127,7 +143,21 @@ describe('屋敷の 3 部屋', () => {
       expect.arrayContaining(['bookshelf', 'desk', 'globe', 'bust', 'post', 'painting'])
     );
     expect([...kinds('キッチン')]).toEqual(
-      expect.arrayContaining(['counter', 'sink', 'plates', 'meat-rack', 'gas', 'duct', 'caution'])
+      expect.arrayContaining([
+        'counter',
+        'sink',
+        'plates',
+        'meat-rack',
+        'gas',
+        'duct',
+        'caution',
+        'drain',
+        'vent',
+        'range',
+        'pot-rack',
+        'pots',
+        'board'
+      ])
     );
     expect([...kinds('ランドリー')]).toEqual(expect.arrayContaining(['washer', 'clothesline']));
   });
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/rooms.test.ts`
Expected: FAIL。キッチンの家具の種類に `range`・`pot-rack`・`pots`・`board` が無いので落ちる（候補との重なりのテストは今のままで通る）。

- [ ] **Step 3: 実装する**

**差分** `src/lib/games/yappari-chameleon/mansion/kitchen.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/kitchen.ts b/src/lib/games/yappari-chameleon/mansion/kitchen.ts
--- a/src/lib/games/yappari-chameleon/mansion/kitchen.ts
+++ b/src/lib/games/yappari-chameleon/mansion/kitchen.ts
@@ -17,6 +17,42 @@ function grate(): Pattern {

 const IRON: Finish = { tint: '#3b3f43', metal: 0.6, rough: 0.5 };

+/** ヘアラインのステンレス。横に流れる磨きの筋（2cm 以上）の明るさのむら */
+function hairline(): Pattern {
+  return make('hairline', 256, 64, [0.6, 0.15], (g) => {
+    const r = rng(137);
+    g.fillStyle = '#c9ced3';
+    g.fillRect(0, 0, 256, 64);
+    g.lineWidth = 9;
+    for (let y = 4; y < 64; y += 9) {
+      g.strokeStyle = `rgb(${r() < 0.5 ? '255 255 255' : '70 76 82'} / ${0.06 + r() * 0.1})`;
+      g.beginPath();
+      g.moveTo(0, y);
+      g.lineTo(256, y);
+      g.stroke();
+    }
+  });
+}
+
+const steel = (): Finish => ({ pattern: hairline(), metal: 0.8, rough: 0.35 });
+const DARK_STEEL: Finish = { tint: '#596066', metal: 0.8, rough: 0.3 };
+const BLACK_IRON: Finish = { tint: '#151617', metal: 0.5, rough: 0.45 };
+
+/** 上の面の無い箱（深い流しの槽）。両面を描くので、外からも中からも壁が見える */
+function tub(g: THREE.Group, size: [number, number, number], at: [number, number, number]) {
+  const geo = new THREE.BoxGeometry(...size);
+  // 面の並びは +x, −x, +y, −y, +z, −z で、1 面に 6 個の頂点の番号
+  const index = Array.from(geo.index!.array);
+  geo.setIndex([...index.slice(0, 12), ...index.slice(18)]);
+  geo.clearGroups();
+  const m = finish(steel(), [size[0], size[1]]);
+  m.side = THREE.DoubleSide;
+  const o = new THREE.Mesh(geo, m);
+  o.position.set(...at);
+  o.castShadow = o.receiveShadow = true;
+  g.add(o);
+}
+
 /** 置いた向きの x へ span の長さに伸びる */
 function drain(g: THREE.Group, p: { span?: number }) {
   const span = p.span ?? 4;
@@ -134,4 +170,133 @@ function gas(g: THREE.Group) {
   box(g, [0.08, 0.025, 0.025], { tint: '#3a3d40', metal: 0.6, rough: 0.4 }, [0.03, 0.95, 0]);
 }

-export const KITCHEN_MAKERS = { drain, vent, 'meat-rack': meatRack, gas } satisfies Partial<Record<Kind, Maker>>;
+/** ステンレスの台。前（+z）に扉 2 枚 */
+function counter(g: THREE.Group) {
+  box(g, [2.0, 0.84, 0.7], steel(), [0, 0.42, 0]);
+  box(g, [2.02, 0.04, 0.72], steel(), [0, 0.88, 0]);
+  const door = box(g, [0.95, 0.7, 0.01], { tint: '#aeb4b9', metal: 0.8, rough: 0.3 }, [-0.5, 0.45, 0.355]);
+  copy(g, door, [0.5, 0.45, 0.355]);
+}
+
+/** 前は +z で、蛇口は後ろの立ち上がりに付く */
+function sink(g: THREE.Group) {
+  const leg = box(g, [0.04, 0.6, 0.04], steel(), [-0.96, 0.3, -0.31]);
+  for (const [x, z] of [
+    [0.96, -0.31],
+    [-0.96, 0.31],
+    [0.96, 0.31]
+  ])
+    copy(g, leg, [x, 0.3, z]);
+  box(g, [1.96, 0.025, 0.64], steel(), [0, 0.18, 0]);
+  tub(g, [2.0, 0.32, 0.7], [0, 0.74, 0]);
+  box(g, [1.96, 0.02, 0.66], DARK_STEEL, [0, 0.59, 0]);
+  box(g, [2.0, 0.25, 0.03], steel(), [0, 1.025, -0.335]);
+  cyl(g, [0.018, 0.018], 0.45, steel(), [0.3, 1.2, -0.29], 12);
+  const spout = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 8, 16, Math.PI), finish(steel(), [0.4, 0.05]));
+  spout.position.set(0.3, 1.42, -0.17);
+  spout.rotation.y = Math.PI / 2;
+  spout.castShadow = true;
+  g.add(spout);
+  const coil = new THREE.CatmullRomCurve3(
+    Array.from({ length: 41 }, (_, k) => {
+      const a = k * 0.6;
+      return new THREE.Vector3(-0.5 + Math.cos(a) * 0.12, 0.22 + k * 0.006, Math.sin(a) * 0.12);
+    })
+  );
+  const hose = new THREE.Mesh(
+    new THREE.TubeGeometry(coil, 120, 0.022, 6),
+    finish({ tint: '#3fbf3a', rough: 0.4 }, [1, 1])
+  );
+  hose.castShadow = true;
+  g.add(hose);
+}
+
+/** 前（+z）がつまみとオーブンの扉 */
+function range(g: THREE.Group) {
+  box(g, [1.0, 0.86, 0.8], steel(), [0, 0.43, 0]);
+  box(g, [1.0, 0.04, 0.8], BLACK_IRON, [0, 0.88, 0]);
+  const burner = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24), finish(BLACK_IRON, [0.6, 0.1]));
+  burner.rotation.x = Math.PI / 2;
+  for (const [x, z] of [
+    [-0.25, -0.18],
+    [0.25, -0.18],
+    [-0.25, 0.18],
+    [0.25, 0.18]
+  ]) {
+    const b = burner.clone();
+    b.position.set(x, 0.91, z);
+    g.add(b);
+  }
+  box(g, [0.86, 0.5, 0.02], DARK_STEEL, [0, 0.33, 0.405]);
+  cyl(g, [0.015, 0.015], 0.7, steel(), [0, 0.62, 0.44], 12).rotation.z = Math.PI / 2;
+  const knob = cyl(g, [0.03, 0.03], 0.04, { tint: '#1a1b1d', rough: 0.5 }, [-0.375, 0.76, 0.42], 16);
+  knob.rotation.x = Math.PI / 2;
+  const ring = new THREE.Mesh(
+    new THREE.TorusGeometry(0.038, 0.008, 6, 20),
+    finish({ tint: '#3a5bd8', rough: 0.4 }, [0.2, 0.02])
+  );
+  ring.position.set(-0.375, 0.76, 0.402);
+  g.add(ring);
+  for (let i = 1; i < 6; i++) {
+    copy(g, knob, [-0.375 + i * 0.15, 0.76, 0.42]);
+    const r = ring.clone();
+    r.position.x = -0.375 + i * 0.15;
+    g.add(r);
+  }
+}
+
+function potRack(g: THREE.Group) {
+  const post = box(g, [0.02, 1.8, 0.02], BLACK_IRON, [-0.29, 0.9, -0.19]);
+  for (const [x, z] of [
+    [0.29, -0.19],
+    [-0.29, 0.19],
+    [0.29, 0.19]
+  ])
+    copy(g, post, [x, 0.9, z]);
+  const shelf = box(g, [0.6, 0.012, 0.4], BLACK_IRON, [0, 0.35, 0]);
+  for (const y of [0.8, 1.25, 1.7]) copy(g, shelf, [0, y, 0]);
+  const pot = cyl(g, [0.14, 0.13], 0.2, DARK_STEEL, [-0.1, 0.46, 0]);
+  copy(g, pot, [0.12, 1.36, 0]).scale.set(0.8, 0.9, 0.8);
+  cyl(g, [0.12, 0.11], 0.05, BLACK_IRON, [0.05, 0.835, 0]);
+  box(g, [0.18, 0.02, 0.03], BLACK_IRON, [-0.17, 0.85, 0]);
+}
+
+function pots(g: THREE.Group) {
+  cyl(g, [0.16, 0.15], 0.3, DARK_STEEL, [-0.6, 0.15, 0]);
+  const bowl = new THREE.Mesh(
+    new THREE.SphereGeometry(0.13, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
+    finish({ tint: '#f1ece2', rough: 0.4 }, [0.4, 0.2])
+  );
+  bowl.material.side = THREE.DoubleSide;
+  bowl.position.set(-0.15, 0.13, 0.05);
+  bowl.castShadow = true;
+  g.add(bowl);
+  const blue = bowl.clone();
+  blue.material = finish({ tint: '#3f7ec7', rough: 0.4 }, [0.4, 0.2]);
+  blue.material.side = THREE.DoubleSide;
+  blue.position.set(0.2, 0.13, -0.08);
+  g.add(blue);
+  for (const [x, z, s] of [
+    [0.55, 0.05, 0.09],
+    [0.68, -0.08, 0.08],
+    [0.6, -0.14, 0.07]
+  ])
+    ball(g, s, { tint: '#5d9a43', rough: 0.6 }, [x, s, z]);
+}
+
+function board(g: THREE.Group) {
+  box(g, [1.0, 0.04, 0.6], { tint: '#c9a777', rough: 0.7 }, [0, 0.02, 0]);
+}
+
+export const KITCHEN_MAKERS = {
+  drain,
+  vent,
+  'meat-rack': meatRack,
+  gas,
+  counter,
+  sink,
+  range,
+  'pot-rack': potRack,
+  pots,
+  board
+} satisfies Partial<Record<Kind, Maker>>;
```

**差分** `src/lib/games/yappari-chameleon/mansion/layout.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/layout.ts b/src/lib/games/yappari-chameleon/mansion/layout.ts
--- a/src/lib/games/yappari-chameleon/mansion/layout.ts
+++ b/src/lib/games/yappari-chameleon/mansion/layout.ts
@@ -78,7 +78,11 @@ export type Kind =
   | 'towels'
   | 'cart'
   | 'drain'
-  | 'vent';
+  | 'vent'
+  | 'range'
+  | 'pot-rack'
+  | 'pots'
+  | 'board';

 export interface Piece {
   kind: Kind;
@@ -133,7 +137,11 @@ export const SIZES: Record<Kind, V3 | null> = {
   towels: [0.5, 0.5, 0.4],
   cart: [0.8, 0.9, 0.55],
   drain: null,
-  vent: null
+  vent: null,
+  range: [1.0, 0.9, 0.8],
+  'pot-rack': [0.6, 1.8, 0.4],
+  pots: null,
+  board: null
 };

 export interface Light {
```

**差分** `src/lib/games/yappari-chameleon/mansion/room-furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
@@ -113,21 +113,6 @@ function bookPile(g: THREE.Group, p: Piece) {
   }
 }

-/** ステンレスの台。前（+z）に扉 2 枚 */
-function counter(g: THREE.Group) {
-  box(g, [2.0, 0.84, 0.7], STEEL, [0, 0.42, 0]);
-  box(g, [2.02, 0.04, 0.72], STEEL, [0, 0.88, 0]);
-  const door = box(g, [0.95, 0.7, 0.01], { tint: '#aeb4b9', metal: 0.8, rough: 0.3 }, [-0.5, 0.45, 0.355]);
-  copy(g, door, [0.5, 0.45, 0.355]);
-}
-
-function sink(g: THREE.Group) {
-  counter(g);
-  box(g, [0.9, 0.02, 0.5], { tint: '#596066', metal: 0.8, rough: 0.25 }, [0, 0.905, 0]);
-  cyl(g, [0.02, 0.02], 0.35, STEEL, [0, 1.07, -0.28]);
-  cyl(g, [0.015, 0.015], 0.22, STEEL, [0, 1.24, -0.18]).rotation.x = Math.PI / 2;
-}
-
 function plates(g: THREE.Group) {
   const plate = cyl(g, [0.12, 0.1], 0.016, WHITE, [-0.18, 0.008, 0], 24);
   for (const [x, n] of [
@@ -249,8 +234,6 @@ export const ROOM_MAKERS = {
   bust,
   'folding-chair': foldingChair,
   'book-pile': bookPile,
-  counter,
-  sink,
   plates,
   duct,
   caution,
```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.ts b/src/lib/games/yappari-chameleon/mansion/rooms.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.ts
@@ -82,13 +82,17 @@ export function roomPieces(): Piece[] {
     p('desk', [12.25, 0, 6]),
     p('globe', [15.8, 0, 2.2]),
     p('bust', [8.2, 0, 1.7]),
-    // キッチン。北の壁に台とシンク、まん中に島の台、西の壁に肉の棚
+    // キッチン。北の壁に台と流し、まん中に島の台、西の壁に肉の棚とガスボンベ、東の壁にレンジと針金の棚
     p('counter', [-19.9, 0, 14.7], 2),
     p('counter', [-17.9, 0, 14.7], 2),
     p('sink', [-15.9, 0, 14.7], 2),
     p('counter', [-15, 0, 10.8], 1),
     p('plates', [-15, 0.9, 10.4]),
     p('plates', [-17.9, 0.9, 14.7]),
+    p('pots', [-19.9, 0.9, 14.7], 2),
+    p('board', [-15, 0.9, 11.3], 1),
+    p('range', [-11.4, 0, 11.2], 3),
+    p('pot-rack', [-11.2, 0, 13.3], 3),
     p('meat-rack', [-20.75, 0, 10], 1),
     p('meat-rack', [-20.75, 0, 12.2], 1),
     p('gas', [-20.75, 0, 8.85]),
```

- [ ] **Step 4: 通るのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（413 tests）。

- [ ] **Step 5: 撮って、作り込みの前と本家と並べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task4`
Expected: `pageerror` が出ず、最後に `ok` と書いた場所を出す。

Read で `<scratchpad>/polish/task4/sheet-kitchen.png` を見て、次を確かめる。

| 見るところ | 写っていること                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 東の壁     | ステンレスのレンジ（上に黒い鉄板とこんろ 4 口、前につまみ 6 個と青い輪とオーブンの扉）と、鍋とフライパンを載せた黒い針金の棚 |
| 北の壁     | 脚の付いた深い流し（中の壁と底が見える）、長い蛇口、下の棚の緑のらせんのホース。奥の台に鍋・白と青のボウル・緑の野菜         |
| 島の台     | 明るい木のまな板と皿の山                                                                                                     |
| ステンレス | 横に流れる磨きの筋                                                                                                           |

明るさ（`<scratchpad>/polish/task4/stats.json` の `luma`）は、計画を試したときに次の値だった。目標の帯（「撮り方と測り方」の表）から外れたら、Task 1 の `MOODS` の値ではなく、このタスクの模様と色の数字を見直す。

| 部屋     | 1 枚ずつ   | 平均 |
| -------- | ---------- | ---- |
| キッチン | 78・88・90 | 85   |

浮いている・床に沈んでいる・前と後ろが逆・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形か並びの数値だけを直して撮り直す（並びを動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` も通す）。

- [ ] **Step 6: 描く回数と三角形を測る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task4.json`
Expected: 6 行の数を出し、`calls` はどれも 1354 以下、`lights` はどれも 14。計画を試したときの値は次のとおり（作り込みの前は `<scratchpad>/perf-2b.json`）。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 314      | 270,851    | 243,737    |
| hall     | 183      | 202      | 223,407    | 213,413    |
| corridor | 177      | 202      | 179,017    | 151,791    |
| study    | 142      | 155      | 150,890    | 137,956    |
| kitchen  | 147      | 172      | 172,197    | 145,203    |
| laundry  | 166      | 180      | 153,939    | 144,605    |

- [ ] **Step 7: 確かめてコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Fill the kitchen with a range, a deep sink, a wire shelf and countertop clutter"
```

---

### Task 5: ランドリーの壁・天井・蛍光灯

**Files:**

- Create: `src/lib/games/yappari-chameleon/mansion/laundry.ts`（梁・蛍光灯）
- Modify: `src/lib/games/yappari-chameleon/textures-rooms.ts`（`brick` を `darkPlanks` に替える）、`src/lib/games/yappari-chameleon/mansion/layout.ts`（`Mat` の `redDamask`・`darkPlanks`、`Kind` の `beam`・`tube-light`、廊下の南の壁の裏）、`src/lib/games/yappari-chameleon/mansion/build.ts`（材質の表）、`src/lib/games/yappari-chameleon/mansion/furniture.ts`（`LAUNDRY_MAKERS`）、`src/lib/games/yappari-chameleon/mansion/rooms.ts`（壁と天井の材質・並び）
- Test: `src/lib/games/yappari-chameleon/mansion/build.test.ts`、`src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

**Interfaces:**

- Produces: `Mat` から `brick` を消し、`redDamask`（`damask('#5a1612', '#8a2a20')`）と `darkPlanks`（`textures-rooms.ts` の `darkPlanks()`）を足す。
- Produces: `laundry.ts` の `LAUNDRY_MAKERS`（このタスクでは `beam`・`tube-light`）。`Kind` に `beam`・`tube-light`（どちらも当たらない。置く場所は天井の面で、下へ付く）。

差の 3 つめ（明るい赤れんがの壁、明るい天井、蛍光灯が無い）を直す。壁は廊下と同じ型の暗い赤のダマスク、天井は暗い木の板張りにこげ茶の梁 3 本、梁のあいだに金属の受け皿の付いた蛍光灯を 2 列 3 台ずつ下げる。蛍光灯の光る管は `glowing()` で作り、Task 1 の点光源 2 個が列の下に光の溜まりを作る。れんがは使うところが無くなるので、模様ごと消す。

- [ ] **Step 1: 落ちるテストを書く**

**差分** `src/lib/games/yappari-chameleon/mansion/build.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/build.test.ts b/src/lib/games/yappari-chameleon/mansion/build.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/build.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.test.ts
@@ -78,7 +78,7 @@ const thinnest = (p: Pattern) =>
 describe('作り込んだ模様', () => {
   it('線は 2cm 以上（体に写せる太さ）', async () => {
     const rooms = await import('../textures-rooms');
-    for (const [name, p] of Object.entries({ whiteTile: rooms.whiteTile() }))
+    for (const [name, p] of Object.entries({ whiteTile: rooms.whiteTile(), darkPlanks: rooms.darkPlanks() }))
       expect(thinnest(p), name).toBeGreaterThanOrEqual(0.0199);
   });

```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
@@ -159,6 +159,6 @@ describe('屋敷の 3 部屋', () => {
         'board'
       ])
     );
-    expect([...kinds('ランドリー')]).toEqual(expect.arrayContaining(['washer', 'clothesline']));
+    expect([...kinds('ランドリー')]).toEqual(expect.arrayContaining(['washer', 'clothesline', 'beam', 'tube-light']));
   });
 });
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/build.test.ts src/lib/games/yappari-chameleon/mansion/rooms.test.ts`
Expected: FAIL。ランドリーの家具の種類に `beam`・`tube-light` が無いので落ち、`darkPlanks` が `textures-rooms.ts` に無いので線の太さのテストが落ちる。

- [ ] **Step 3: 実装する**

**差分** `src/lib/games/yappari-chameleon/mansion/build.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/build.ts b/src/lib/games/yappari-chameleon/mansion/build.ts
--- a/src/lib/games/yappari-chameleon/mansion/build.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.ts
@@ -2,7 +2,16 @@ import * as THREE from 'three';
 import type { V3 } from '$lib/sculpt';
 import { checker, coffer, damask, finish, marble, wainscot, woodPanel, type Finish } from '../textures';
 import type { Level } from '../move';
-import { artwork, blueHex, brick, planks, splashCeiling, splashFloor, splashWall, whiteTile } from '../textures-rooms';
+import {
+  artwork,
+  blueHex,
+  darkPlanks,
+  planks,
+  splashCeiling,
+  splashFloor,
+  splashWall,
+  whiteTile
+} from '../textures-rooms';
 import type { Built } from '../world3d';
 import { seeThrough } from '../xray';
 import { piece } from './furniture';
@@ -28,7 +37,8 @@ const LOOKS: Record<Mat, () => Finish> = {
   planks: () => ({ pattern: planks(), rough: 0.55 }),
   whiteTile: () => ({ pattern: whiteTile(), rough: 0.3 }),
   blueHex: () => ({ pattern: blueHex(), rough: 0.5 }),
-  brick: () => ({ pattern: brick(), rough: 0.9 })
+  redDamask: () => ({ pattern: damask('#5a1612', '#8a2a20'), rough: 0.85 }),
+  darkPlanks: () => ({ pattern: darkPlanks(), rough: 0.7 })
 };

 /** BoxGeometry の材質の並び（+x, −x, +y, −y, +z, −z） */
```

**差分** `src/lib/games/yappari-chameleon/mansion/furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/furniture.ts b/src/lib/games/yappari-chameleon/mansion/furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/furniture.ts
@@ -1,6 +1,7 @@
 import * as THREE from 'three';
 import type { Piece } from './layout';
 import { KITCHEN_MAKERS } from './kitchen';
+import { LAUNDRY_MAKERS } from './laundry';
 import { ROOM_MAKERS } from './room-furniture';
 import { ball, BLACK, box, cyl, glowing, GOLD, plane, variant, WHITE, WOOD, type Maker } from './shapes';
 import { books, finish, leather, marble, oilPainting, poster, rug, type Finish } from '../textures';
@@ -265,7 +266,8 @@ const MAKERS: Record<Piece['kind'], Maker> = {
   banner,
   stairs,
   ...ROOM_MAKERS,
-  ...KITCHEN_MAKERS
+  ...KITCHEN_MAKERS,
+  ...LAUNDRY_MAKERS
 };

 export function piece(p: Piece): THREE.Group {
```

**新しいファイル** `src/lib/games/yappari-chameleon/mansion/laundry.ts`

```ts
import * as THREE from 'three';
import type { Kind } from './layout';
import { box, glowing, type Maker } from './shapes';

/** 置いた場所は天井の面で、梁はその下に付く */
function beam(g: THREE.Group) {
  box(g, [10, 0.22, 0.2], { tint: '#2a1a12', rough: 0.7 }, [0, -0.11, 0]);
}

/** 置いた場所は天井の面で、下へ付く */
function tubeLight(g: THREE.Group) {
  box(g, [1.24, 0.05, 0.15], { tint: '#c9ccd0', metal: 0.6, rough: 0.4 }, [0, -0.045, 0]);
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.16, 12), glowing('#f6f5f6', '#ffffff', 1.6));
  tube.position.y = -0.09;
  tube.rotation.z = Math.PI / 2;
  g.add(tube);
}

export const LAUNDRY_MAKERS = { beam, 'tube-light': tubeLight } satisfies Partial<Record<Kind, Maker>>;
```

**差分** `src/lib/games/yappari-chameleon/mansion/layout.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/layout.ts b/src/lib/games/yappari-chameleon/mansion/layout.ts
--- a/src/lib/games/yappari-chameleon/mansion/layout.ts
+++ b/src/lib/games/yappari-chameleon/mansion/layout.ts
@@ -21,7 +21,8 @@ export type Mat =
   | 'planks'
   | 'whiteTile'
   | 'blueHex'
-  | 'brick';
+  | 'redDamask'
+  | 'darkPlanks';
 export type Face = 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';

 export interface Slab {
@@ -79,6 +80,8 @@ export type Kind =
   | 'cart'
   | 'drain'
   | 'vent'
+  | 'beam'
+  | 'tube-light'
   | 'range'
   | 'pot-rack'
   | 'pots'
@@ -138,6 +141,8 @@ export const SIZES: Record<Kind, V3 | null> = {
   cart: [0.8, 0.9, 0.55],
   drain: null,
   vent: null,
+  beam: null,
+  'tube-light': null,
   range: [1.0, 0.9, 0.8],
   'pot-rack': [0.6, 1.8, 0.4],
   pots: null,
@@ -219,7 +224,7 @@ function corridor(): Slab[] {
     { min: [x0, -1, 3.25], max: [x1, 0, 6.75], mat: 'checker', face: 'y+' },
     { min: [x0, CORR_H, 3.25], max: [x1, CORR_H + T, 6.75], mat: 'cream', face: 'y-' },
     ...wall(6.75, 'z-', 'whiteTile', [-16.75, -15.25]),
-    ...wall(3.25 - T, 'z+', 'brick', [-15.75, -14.25]),
+    ...wall(3.25 - T, 'z+', 'redDamask', [-15.75, -14.25]),
     { min: [x0 - T, 0, 3.25], max: [x0, 1, 6.75], mat: 'wainscot', face: 'x+' },
     { min: [x0 - T, 1, 3.25], max: [x0, CORR_H, 6.75], mat: 'greenDamask', face: 'x+' }
   ];
```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.ts b/src/lib/games/yappari-chameleon/mansion/rooms.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.ts
@@ -46,16 +46,16 @@ function kitchen(): Slab[] {
   ];
 }

-/** 北の壁は廊下の南の壁の裏 */
+/** 北の壁は廊下の南の壁の裏。壁は暗い赤のダマスクの壁紙、天井は暗い木の板張り */
 function laundry(): Slab[] {
   const [x0, , z0] = LAUNDRY.min;
   const [x1, h, z1] = LAUNDRY.max;
   return [
     { min: [x0, -1, z0], max: [x1, 0, z1 + T], mat: 'checker', face: 'y+' },
-    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'woodPanel', face: 'y-' },
-    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'brick', face: 'z+' },
-    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'brick', face: 'x+' },
-    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'brick', face: 'x-' }
+    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'darkPlanks', face: 'y-' },
+    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'redDamask', face: 'z+' },
+    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'redDamask', face: 'x+' },
+    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'redDamask', face: 'x-' }
   ];
 }

@@ -106,7 +106,9 @@ export function roomPieces(): Piece[] {
     p('washer', [-10.4, 0, -2.5], 3),
     p('washer', [-10.4, 0, -1.7], 3),
     p('clothesline', [-15, 2.3, -1.5], 0, 9),
-    p('clothesline', [-15, 2.3, 0.5], 0, 9)
+    p('clothesline', [-15, 2.3, 0.5], 0, 9),
+    ...[-3.6, -0.6, 2.2].map((z) => p('beam', [-15, LAUNDRY.max[1], z])),
+    ...[-2.1, 0.9].flatMap((z) => [-18, -15, -12].map((x) => p('tube-light', [x, LAUNDRY.max[1], z])))
   ];
 }

```

**差分** `src/lib/games/yappari-chameleon/textures-rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/textures-rooms.ts b/src/lib/games/yappari-chameleon/textures-rooms.ts
--- a/src/lib/games/yappari-chameleon/textures-rooms.ts
+++ b/src/lib/games/yappari-chameleon/textures-rooms.ts
@@ -311,19 +311,26 @@ export function blueHex(): Pattern {
   });
 }

-/** ランドリーの赤いれんがの壁。25 × 7cm のれんがを半分ずつずらして積み、目地は 2cm */
-export function brick(): Pattern {
-  return make('brick', 256, 256, [1.08, 1.08], (g) => {
+/** ランドリーの暗い木の天井。幅 15cm の板に強い木目（2cm 以上）と板の継ぎ目 */
+export function darkPlanks(): Pattern {
+  return make('dark-planks', 512, 512, [1.2, 1.2], (g) => {
     const r = rng(103);
-    g.fillStyle = '#8f8379';
-    g.fillRect(0, 0, 256, 256);
-    const course = 256 / 12;
-    for (let j = 0; j < 12; j++)
-      for (let i = -1; i <= 4; i++) {
-        const x = i * 64 + (j % 2 ? 32 : 0);
-        g.fillStyle = `hsl(${4 + r() * 10} ${55 + r() * 15}% ${32 + r() * 10}%)`;
-        g.fillRect(x + 2.5, j * course + 2.5, 59, course - 5);
+    for (let i = 0; i < 8; i++) {
+      const base = 15 + r() * 6;
+      g.fillStyle = `hsl(20 18% ${base}%)`;
+      g.fillRect(i * 64, 0, 64, 512);
+      for (let k = 0; k < 4; k++) {
+        g.strokeStyle = `hsl(18 20% ${base - 6 + r() * 4}% / 0.8)`;
+        g.lineWidth = 9 + r() * 6;
+        g.beginPath();
+        const x0 = i * 64 + 8 + r() * 48;
+        g.moveTo(x0, 0);
+        for (let y = 0; y <= 512; y += 32) g.lineTo(x0 + Math.sin(y / 60 + k * 2) * 6, y);
+        g.stroke();
       }
+      g.fillStyle = '#0e0907';
+      g.fillRect(i * 64, 0, 9, 512);
+    }
   });
 }

```

- [ ] **Step 4: 通るのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（413 tests）。

- [ ] **Step 5: 撮って、作り込みの前と本家と並べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task5`
Expected: `pageerror` が出ず、最後に `ok` と書いた場所を出す。

Read で `<scratchpad>/polish/task5/sheet-laundry.png` を見て、次を確かめる。

| 見るところ | 写っていること                                                               |
| ---------- | ---------------------------------------------------------------------------- |
| 壁         | 暗い赤の地に少し明るい赤の鳥と葉のダマスク。緑の廊下から見た南の壁の裏も同じ |
| 天井       | 暗いこげ茶の板張りと、横切る梁                                               |
| 蛍光灯     | 受け皿に白く光る管が 2 列 3 台ずつ。床に光の溜まり                           |

明るさ（`<scratchpad>/polish/task5/stats.json` の `luma`）は、計画を試したときに次の値だった。目標の帯（「撮り方と測り方」の表）から外れたら、Task 1 の `MOODS` の値ではなく、このタスクの模様と色の数字を見直す。

| 部屋       | 1 枚ずつ   | 平均 |
| ---------- | ---------- | ---- |
| ランドリー | 73・69・52 | 65   |

浮いている・床に沈んでいる・前と後ろが逆・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形か並びの数値だけを直して撮り直す（並びを動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` も通す）。

- [ ] **Step 6: 描く回数と三角形を測る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task5.json`
Expected: 6 行の数を出し、`calls` はどれも 1354 以下、`lights` はどれも 14。計画を試したときの値は次のとおり（作り込みの前は `<scratchpad>/perf-2b.json`）。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 320      | 270,851    | 244,241    |
| hall     | 183      | 204      | 223,407    | 213,519    |
| corridor | 177      | 208      | 179,017    | 152,295    |
| study    | 142      | 157      | 150,890    | 138,062    |
| kitchen  | 147      | 173      | 172,197    | 145,279    |
| laundry  | 166      | 186      | 153,939    | 145,109    |

- [ ] **Step 7: 確かめてコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Turn the laundry into dark red damask under a plank ceiling with fluorescent tubes"
```

---

### Task 6: ランドリーの洗濯ひもの服

**Files:**

- Modify: `src/lib/games/yappari-chameleon/mansion/laundry.ts`（格子柄・虹色のしま・服の形・洗濯ひも）、`src/lib/games/yappari-chameleon/mansion/room-furniture.ts`（古い洗濯ひもを消す）
- Test: `src/lib/games/yappari-chameleon/mansion/build.test.ts`

**Interfaces:**

- Produces: `LAUNDRY_MAKERS` に `clothesline`（当たらない。並べ方と span は今のまま）。

差の 4 つめ（四角い色の布を三角旗のように並べている）を直す。T シャツ・長袖（格子柄のシャツ、黒い上着）・ズボンの形を `ShapeGeometry` で作り、真ん中で 8cm たるむより合わせた縄に、木の洗濯ばさみ 2 つずつで留める。服の裾は人形の頭より上に収め、下を歩いても体に重ならない。

- [ ] **Step 1: 落ちるテストを書く**

**差分** `src/lib/games/yappari-chameleon/mansion/build.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/build.test.ts b/src/lib/games/yappari-chameleon/mansion/build.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/build.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.test.ts
@@ -110,3 +110,21 @@ describe('キッチンの肉の棚', () => {
     for (const n of counts) expect(n >= 2 && n <= 4, `${counts}`).toBe(true);
   });
 });
+
+describe('ランドリーの洗濯ひも', () => {
+  it('縄 1 本に形のある服を 5〜8 枚、洗濯ばさみ 2 つずつで留め、服の裾は人形の頭より上', async () => {
+    const { piece } = await import('./furniture');
+    const line = piece({ kind: 'clothesline', at: [-15, 2.3, -1.5], turn: 0, span: 9 });
+    line.position.y = 2.3;
+    line.updateMatrixWorld(true);
+    const clothes = meshes(line).filter((m) => m.geometry instanceof THREE.ShapeGeometry);
+    expect(clothes.length).toBeGreaterThanOrEqual(5);
+    expect(clothes.length).toBeLessThanOrEqual(8);
+    const pegs = meshes(line).filter(
+      (m) => (m.material as THREE.MeshStandardMaterial).color.getHexString() === 'c9a54a'
+    );
+    expect(pegs).toHaveLength(clothes.length * 2);
+    // 人形の背は 1.15m で、下を歩いても頭が服に重ならない
+    for (const c of clothes) expect(new THREE.Box3().setFromObject(c).min.y).toBeGreaterThan(1.45);
+  });
+});
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/build.test.ts`
Expected: FAIL。古い洗濯ひもは四角い板（`PlaneGeometry`）なので、形のある服が 0 枚と数えられて落ちる。

- [ ] **Step 3: 実装する**

**差分** `src/lib/games/yappari-chameleon/mansion/laundry.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/laundry.ts b/src/lib/games/yappari-chameleon/mansion/laundry.ts
--- a/src/lib/games/yappari-chameleon/mansion/laundry.ts
+++ b/src/lib/games/yappari-chameleon/mansion/laundry.ts
@@ -1,6 +1,8 @@
 import * as THREE from 'three';
-import type { Kind } from './layout';
-import { box, glowing, type Maker } from './shapes';
+import { rng } from '../rng';
+import { finish, make, type Finish, type Pattern } from '../textures';
+import type { Kind, Piece } from './layout';
+import { box, glowing, variant, type Maker } from './shapes';

 /** 置いた場所は天井の面で、梁はその下に付く */
 function beam(g: THREE.Group) {
@@ -16,4 +18,122 @@ function tubeLight(g: THREE.Group) {
   g.add(tube);
 }

-export const LAUNDRY_MAKERS = { beam, 'tube-light': tubeLight } satisfies Partial<Record<Kind, Maker>>;
+/** 格子柄のシャツの布。赤と灰の太い帯（4cm）に細い帯（2cm）を重ねる */
+function plaid(): Pattern {
+  return make('plaid', 128, 128, [0.24, 0.24], (g) => {
+    g.fillStyle = '#d9d4cc';
+    g.fillRect(0, 0, 128, 128);
+    g.fillStyle = 'rgb(176 52 48 / 0.75)';
+    g.fillRect(0, 16, 128, 22);
+    g.fillRect(16, 0, 22, 128);
+    g.fillStyle = 'rgb(70 70 78 / 0.55)';
+    g.fillRect(0, 80, 128, 11);
+    g.fillRect(80, 0, 11, 128);
+  });
+}
+
+function rainbowStripes(): Pattern {
+  return make('rainbow-stripes', 32, 256, [0.06, 0.48], (g) => {
+    ['#e53950', '#f6a623', '#f7e14a', '#4cc36f', '#3a8ee6', '#9b59d0'].forEach((c, i) => {
+      g.fillStyle = c;
+      g.fillRect(0, (i * 256) / 6, 32, 256 / 6 + 1);
+    });
+  });
+}
+
+type Cut = 'tee' | 'long' | 'pants';
+
+/** 吊るした服の形。上の辺（y = 0）が洗濯ひもで、下へ垂れる（m） */
+function cut(kind: Cut): THREE.Shape {
+  const pts: [number, number][] =
+    kind === 'pants'
+      ? [
+          [-0.2, 0],
+          [0.2, 0],
+          [0.23, -0.75],
+          [0.04, -0.75],
+          [0, -0.26],
+          [-0.04, -0.75],
+          [-0.23, -0.75]
+        ]
+      : kind === 'tee'
+        ? [
+            [-0.08, 0],
+            [-0.24, -0.02],
+            [-0.39, -0.13],
+            [-0.32, -0.25],
+            [-0.21, -0.19],
+            [-0.22, -0.6],
+            [0.22, -0.6],
+            [0.21, -0.19],
+            [0.32, -0.25],
+            [0.39, -0.13],
+            [0.24, -0.02],
+            [0.08, 0]
+          ]
+        : [
+            [-0.08, 0],
+            [-0.25, -0.02],
+            [-0.38, -0.46],
+            [-0.28, -0.5],
+            [-0.21, -0.22],
+            [-0.23, -0.66],
+            [0.23, -0.66],
+            [0.21, -0.22],
+            [0.28, -0.5],
+            [0.38, -0.46],
+            [0.25, -0.02],
+            [0.08, 0]
+          ];
+  return new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
+}
+
+/** 本家の洗濯ひもの服（T シャツ・格子柄のシャツ・黒いフード付きの上着・虹色のしま・ズボン） */
+const CLOTHES: [Cut, () => Finish][] = [
+  ['tee', () => ({ tint: '#8a5ab8', rough: 0.9 })],
+  ['long', () => ({ pattern: plaid(), rough: 0.9 })],
+  ['tee', () => ({ tint: '#e07a9a', rough: 0.9 })],
+  ['long', () => ({ tint: '#1e1e22', rough: 0.85 })],
+  ['tee', () => ({ tint: '#eeeeea', rough: 0.9 })],
+  ['pants', () => ({ tint: '#3a4f7a', rough: 0.9 })],
+  ['tee', () => ({ pattern: rainbowStripes(), rough: 0.9 })],
+  ['tee', () => ({ tint: '#3f9a4a', rough: 0.9 })],
+  ['long', () => ({ tint: '#a8c43a', rough: 0.9 })]
+];
+
+/**
+ * より合わせた縄に木の洗濯ばさみで留めた服。x の向きに span の長さで張る。当たらない。
+ * 縄は真ん中で 8cm たるみ、服はたるみに合わせて吊るす
+ */
+function clothesline(g: THREE.Group, p: Piece) {
+  const span = p.span ?? 8;
+  const sag = (x: number) => -0.08 * (1 - ((2 * x) / span) ** 2);
+  const rope = new THREE.CatmullRomCurve3(
+    Array.from({ length: 9 }, (_, k) => {
+      const x = -span / 2 + (k / 8) * span;
+      return new THREE.Vector3(x, sag(x), 0);
+    })
+  );
+  const line = new THREE.Mesh(
+    new THREE.TubeGeometry(rope, 48, 0.012, 6),
+    finish({ tint: '#b89a6a', rough: 0.9 }, [1, 1])
+  );
+  g.add(line);
+  const r = rng(variant(p));
+  const peg: Finish = { tint: '#c9a54a', rough: 0.7 };
+  const n = Math.floor(span / 1.1);
+  for (let i = 0; i < n; i++) {
+    const x = -span / 2 + (span / n) * (i + 0.5) + (r() - 0.5) * 0.2;
+    const [kind, look] = CLOTHES[(i + variant(p)) % CLOTHES.length];
+    const m = finish(look(), [1, 1]);
+    m.side = THREE.DoubleSide;
+    const cloth = new THREE.Mesh(new THREE.ShapeGeometry(cut(kind)), m);
+    cloth.position.set(x, sag(x) - 0.01, 0);
+    cloth.rotation.y = (r() - 0.5) * 0.3;
+    cloth.castShadow = cloth.receiveShadow = true;
+    g.add(cloth);
+    for (const dx of [-0.16, 0.16]) box(g, [0.02, 0.07, 0.03], peg, [x + dx, sag(x + dx) - 0.02, 0]);
+  }
+}
+
+export const LAUNDRY_MAKERS = { beam, 'tube-light': tubeLight, clothesline } satisfies Partial<Record<Kind, Maker>>;
```

**差分** `src/lib/games/yappari-chameleon/mansion/room-furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
@@ -181,26 +181,6 @@ function washer(g: THREE.Group, p: Piece) {
   box(g, [0.6, 0.08, 0.02], { tint: '#f1ece2', rough: 0.5 }, [0, 0.78, 0.33]);
 }

-/** 洗濯ひもと吊るした服。x の向きに span の長さで張る。当たらない */
-function clothesline(g: THREE.Group, p: Piece) {
-  const span = p.span ?? 8;
-  const line = cyl(g, [0.008, 0.008], span, { tint: '#f4f1ea', rough: 0.8 }, [0, 0, 0], 6);
-  line.rotation.z = Math.PI / 2;
-  line.castShadow = false;
-  const colors = ['#3a6ea5', '#e8e2d4', '#c94f4f', '#5b8c5a', '#d9a441', '#7b5ea7'];
-  for (let i = 0, x = -span / 2 + 0.4; x < span / 2 - 0.3; i++, x += 0.62) {
-    const tall = i % 3 === 1;
-    const cloth = new THREE.Mesh(
-      new THREE.PlaneGeometry(0.42, tall ? 0.8 : 0.55),
-      finish({ tint: colors[(i + variant(p)) % colors.length], rough: 0.9 }, [0.42, 0.6])
-    );
-    cloth.material.side = THREE.DoubleSide;
-    cloth.position.set(x, tall ? -0.4 : -0.28, 0);
-    cloth.castShadow = true;
-    g.add(cloth);
-  }
-}
-
 /** たたんだタオルの山。置いた場所で白・青・黄の並びを変える */
 function towels(g: THREE.Group, p: Piece) {
   const colors = ['#f4f1ea', '#3f7ec7', '#f2c94c'];
@@ -240,7 +220,6 @@ export const ROOM_MAKERS = {
   box: cardboard,
   bucket,
   washer,
-  clothesline,
   towels,
   cart
 } satisfies Partial<Record<Kind, Maker>>;
```

- [ ] **Step 4: 通るのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（414 tests）。

- [ ] **Step 5: 撮って、作り込みの前と本家と並べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task6`
Expected: `pageerror` が出ず、最後に `ok` と書いた場所を出す。

Read で `<scratchpad>/polish/task6/sheet-laundry.png` を見て、次を確かめる。

| 見るところ     | 写っていること                                                                                |
| -------------- | --------------------------------------------------------------------------------------------- |
| 服             | 紫・ピンク・白・緑の T シャツ、格子柄と黒と黄緑の長袖、ズボン、虹色のしま。少しずつ向きが違う |
| 縄と洗濯ばさみ | 真ん中でたるむ茶色の縄と、肩の 2 か所の黄土色の洗濯ばさみ                                     |

明るさ（`<scratchpad>/polish/task6/stats.json` の `luma`）は、計画を試したときに次の値だった。目標の帯（「撮り方と測り方」の表）から外れたら、Task 1 の `MOODS` の値ではなく、このタスクの模様と色の数字を見直す。

| 部屋       | 1 枚ずつ   | 平均 |
| ---------- | ---------- | ---- |
| ランドリー | 72・65・51 | 63   |

浮いている・床に沈んでいる・前と後ろが逆・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形か並びの数値だけを直して撮り直す（並びを動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` も通す）。

- [ ] **Step 6: 描く回数と三角形を測る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task6.json`
Expected: 6 行の数を出し、`calls` はどれも 1354 以下、`lights` はどれも 14。計画を試したときの値は次のとおり（作り込みの前は `<scratchpad>/perf-2b.json`）。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 328      | 270,851    | 246,301    |
| hall     | 183      | 208      | 223,407    | 213,997    |
| corridor | 177      | 215      | 179,017    | 154,345    |
| study    | 142      | 161      | 150,890    | 138,540    |
| kitchen  | 147      | 177      | 172,197    | 145,757    |
| laundry  | 166      | 193      | 153,939    | 147,159    |

- [ ] **Step 7: 確かめてコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Hang shaped clothes with pegs on twisted laundry lines"
```

---

### Task 7: ランドリーのタオルの台と物の多さ

**Files:**

- Modify: `src/lib/games/yappari-chameleon/mansion/laundry.ts`（タオルの山・タオルの台・木の棚・消火器・掃除機・携行缶・青いポスター）、`src/lib/games/yappari-chameleon/mansion/room-furniture.ts`（古いタオルの山を消す）、`src/lib/games/yappari-chameleon/mansion/layout.ts`（種類と当たり）、`src/lib/games/yappari-chameleon/mansion/rooms.ts`（並び）
- Test: `src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

**Interfaces:**

- Produces: `Kind` に `towel-table`（1.6 × 1.3 × 0.75m）・`wood-shelf`（0.5 × 1.1 × 0.4m）・`extinguisher`（0.2 × 0.55 × 0.2m）・`vacuum`（0.4 × 0.45 × 0.4m）・`jerrycan`（0.3 × 0.35 × 0.15m）・`poster-blue`（当たらない）。
- Produces: 動く物の `towels` は形だけを 1 枚ずつずらして積む山に替える（当たりの 0.5 × 0.5 × 0.4m と候補はそのまま）。

差の 5 つめ（小さな四角い山と壁ぞいの洗濯機 4 台だけで、床ががらんとしている）を直す。部屋のまん中に、白・灰・青・黄色のタオルを 1 枚ずつ少し回してずらしながら高く積んだ木の台を 3 台、東の壁に洗濯機を 5 台、西の壁に 1 台足す（赤と黄色の交互は場所から決まる今の式のまま）。西の壁に木の棚とポリタンク・消火器・掃除機 2 台（片方に青いらせんのホース）・ポスター 2 枚、南の壁に赤い携行缶 2 つを置く。

- [ ] **Step 1: 落ちるテストを書く**

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
@@ -159,6 +159,19 @@ describe('屋敷の 3 部屋', () => {
         'board'
       ])
     );
-    expect([...kinds('ランドリー')]).toEqual(expect.arrayContaining(['washer', 'clothesline', 'beam', 'tube-light']));
+    expect([...kinds('ランドリー')]).toEqual(
+      expect.arrayContaining([
+        'washer',
+        'clothesline',
+        'beam',
+        'tube-light',
+        'towel-table',
+        'wood-shelf',
+        'extinguisher',
+        'vacuum',
+        'jerrycan',
+        'poster-blue'
+      ])
+    );
   });
 });
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/rooms.test.ts`
Expected: FAIL。ランドリーの家具の種類に `towel-table` などが無いので落ちる。

- [ ] **Step 3: 実装する**

**差分** `src/lib/games/yappari-chameleon/mansion/laundry.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/laundry.ts b/src/lib/games/yappari-chameleon/mansion/laundry.ts
--- a/src/lib/games/yappari-chameleon/mansion/laundry.ts
+++ b/src/lib/games/yappari-chameleon/mansion/laundry.ts
@@ -2,7 +2,7 @@ import * as THREE from 'three';
 import { rng } from '../rng';
 import { finish, make, type Finish, type Pattern } from '../textures';
 import type { Kind, Piece } from './layout';
-import { box, glowing, variant, type Maker } from './shapes';
+import { ball, box, copy, cyl, glowing, plane, variant, type Maker } from './shapes';

 /** 置いた場所は天井の面で、梁はその下に付く */
 function beam(g: THREE.Group) {
@@ -136,4 +136,145 @@ function clothesline(g: THREE.Group, p: Piece) {
   }
 }

-export const LAUNDRY_MAKERS = { beam, 'tube-light': tubeLight, clothesline } satisfies Partial<Record<Kind, Maker>>;
+/** 本家のタオルの色（白か灰・青・黄色から橙） */
+const TOWELS = ['#d8d8d0', '#3a46c8', '#e0a020', '#efefe8', '#4a56d8'];
+
+/** たたんだタオルを 1 枚ずつ少し回してずらしながら積む。積んだ高さを返す */
+function stack(g: THREE.Group, seed: number, n: number, at: [number, number, number]): number {
+  const r = rng(seed);
+  const tint = TOWELS[seed % TOWELS.length];
+  let y = at[1];
+  for (let i = 0; i < n; i++) {
+    const h = 0.04 + r() * 0.01;
+    const t = box(g, [0.48, h, 0.34], { tint: r() < 0.8 ? tint : TOWELS[(seed + 1) % 5], rough: 0.95 }, [
+      at[0] + (r() - 0.5) * 0.04,
+      y + h / 2,
+      at[2] + (r() - 0.5) * 0.04
+    ]);
+    t.rotation.y = (r() - 0.5) * 0.16;
+    y += h;
+  }
+  return y;
+}
+
+/** 動く物のタオルの山（当たりは 0.5 × 0.5 × 0.4 のまま） */
+function towels(g: THREE.Group, p: Piece) {
+  stack(g, variant(p), 10, [0, 0, 0]);
+}
+
+const TABLE: Finish = { tint: '#59402a', rough: 0.6 };
+
+/** 木の台に高く積んだタオルの山 4 つ。当たりは山の上まで */
+function towelTable(g: THREE.Group, p: Piece) {
+  box(g, [1.6, 0.05, 0.75], TABLE, [0, 0.775, 0]);
+  const leg = box(g, [0.06, 0.75, 0.06], TABLE, [-0.75, 0.375, -0.32]);
+  for (const [x, z] of [
+    [0.75, -0.32],
+    [-0.75, 0.32],
+    [0.75, 0.32]
+  ])
+    copy(g, leg, [x, 0.375, z]);
+  box(g, [1.5, 0.03, 0.65], TABLE, [0, 0.2, 0]);
+  [-0.55, -0.15, 0.25, 0.6].forEach((x, i) =>
+    stack(g, variant(p) + i * 3, 6 + ((variant(p) + i) % 5), [x, 0.8, i % 2 ? 0.12 : -0.12])
+  );
+}
+
+function woodShelf(g: THREE.Group) {
+  const wood: Finish = { tint: '#b98a5a', rough: 0.6 };
+  const post = box(g, [0.04, 1.1, 0.04], wood, [-0.23, 0.55, -0.18]);
+  for (const [x, z] of [
+    [0.23, -0.18],
+    [-0.23, 0.18],
+    [0.23, 0.18]
+  ])
+    copy(g, post, [x, 0.55, z]);
+  const shelf = box(g, [0.5, 0.03, 0.4], wood, [0, 0.1, 0]);
+  for (const y of [0.55, 1.08]) copy(g, shelf, [0, y, 0]);
+  box(g, [0.18, 0.26, 0.12], { tint: '#f2f2ee', rough: 0.5 }, [0.05, 1.225, 0]);
+  cyl(g, [0.025, 0.025], 0.04, { tint: '#3a6ee6', rough: 0.4 }, [0.1, 1.375, 0], 12);
+}
+
+function extinguisher(g: THREE.Group) {
+  cyl(g, [0.075, 0.075], 0.44, { tint: '#c8231e', rough: 0.35 }, [0, 0.22, 0], 20);
+  ball(g, 0.075, { tint: '#c8231e', rough: 0.35 }, [0, 0.44, 0]).scale.y = 0.5;
+  cyl(g, [0.02, 0.02], 0.07, { tint: '#222222', rough: 0.5 }, [0, 0.5, 0], 10);
+  box(g, [0.09, 0.012, 0.025], { tint: '#222222', rough: 0.5 }, [0.03, 0.54, 0]);
+  const hose = box(g, [0.018, 0.3, 0.018], { tint: '#1a1a1a', rough: 0.6 }, [0.06, 0.36, 0.04]);
+  hose.rotation.z = -0.15;
+  plane(g, [0.08, 0.12], { tint: '#f2f2ee', rough: 0.6 }, [0, 0.24, 0.076]);
+}
+
+function vacuum(g: THREE.Group, p: Piece) {
+  cyl(g, [0.17, 0.16], 0.26, { tint: '#c9ced3', metal: 0.7, rough: 0.35 }, [0, 0.15, 0]);
+  ball(g, 0.17, { tint: '#c8231e', rough: 0.35 }, [0, 0.28, 0]).scale.y = 0.45;
+  const handle = new THREE.Mesh(
+    new THREE.TorusGeometry(0.07, 0.012, 6, 16, Math.PI),
+    finish({ tint: '#222222' }, [1, 1])
+  );
+  handle.position.y = 0.35;
+  g.add(handle);
+  for (const [x, z] of [
+    [0.12, 0.08],
+    [-0.12, 0.08],
+    [0, -0.14]
+  ])
+    cyl(g, [0.025, 0.025], 0.03, { tint: '#222222', rough: 0.6 }, [x, 0.015, z], 10);
+  // 床のホースは 2 台のうち片方だけ
+  if (variant(p) % 2) return;
+  const coil = new THREE.CatmullRomCurve3(
+    Array.from({ length: 30 }, (_, k) => {
+      const a = k * 0.5;
+      const d = 0.08 + k * 0.006;
+      return new THREE.Vector3(0.35 + Math.cos(a) * d, 0.02, Math.sin(a) * d);
+    })
+  );
+  const hose = new THREE.Mesh(
+    new THREE.TubeGeometry(coil, 90, 0.018, 6),
+    finish({ tint: '#3a8ee6', rough: 0.4 }, [1, 1])
+  );
+  hose.receiveShadow = true;
+  g.add(hose);
+}
+
+function jerrycan(g: THREE.Group) {
+  box(g, [0.3, 0.33, 0.15], { tint: '#b8231e', rough: 0.45 }, [0, 0.165, 0]);
+  box(g, [0.14, 0.04, 0.04], { tint: '#b8231e', rough: 0.45 }, [-0.04, 0.35, 0]);
+  cyl(g, [0.025, 0.025], 0.05, { tint: '#d9b21f', rough: 0.4 }, [0.1, 0.355, 0], 12);
+}
+
+/** 青いポスター（本家の「ISONAL」）。字は太い白い帯（4cm 以上） */
+function isonal(): Pattern {
+  return make('isonal', 256, 342, [0.6, 0.8], (g) => {
+    g.fillStyle = '#e9edf2';
+    g.fillRect(0, 0, 256, 342);
+    g.fillStyle = '#1f4fb0';
+    g.fillRect(16, 16, 224, 250);
+    g.fillStyle = '#f4f6fa';
+    g.beginPath();
+    g.moveTo(40, 240);
+    g.lineTo(150, 40);
+    g.lineTo(190, 60);
+    g.lineTo(90, 250);
+    g.fill();
+    g.fillStyle = '#1f4fb0';
+    g.fillRect(28, 284, 200, 34);
+  });
+}
+
+function posterBlue(g: THREE.Group) {
+  plane(g, [0.6, 0.8], { pattern: isonal(), rough: 0.9 }, [0, 0, 0.01]);
+}
+
+export const LAUNDRY_MAKERS = {
+  beam,
+  'tube-light': tubeLight,
+  clothesline,
+  towels,
+  'towel-table': towelTable,
+  'wood-shelf': woodShelf,
+  extinguisher,
+  vacuum,
+  jerrycan,
+  'poster-blue': posterBlue
+} satisfies Partial<Record<Kind, Maker>>;
```

**差分** `src/lib/games/yappari-chameleon/mansion/layout.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/layout.ts b/src/lib/games/yappari-chameleon/mansion/layout.ts
--- a/src/lib/games/yappari-chameleon/mansion/layout.ts
+++ b/src/lib/games/yappari-chameleon/mansion/layout.ts
@@ -82,6 +82,12 @@ export type Kind =
   | 'vent'
   | 'beam'
   | 'tube-light'
+  | 'towel-table'
+  | 'wood-shelf'
+  | 'extinguisher'
+  | 'vacuum'
+  | 'jerrycan'
+  | 'poster-blue'
   | 'range'
   | 'pot-rack'
   | 'pots'
@@ -143,6 +149,12 @@ export const SIZES: Record<Kind, V3 | null> = {
   vent: null,
   beam: null,
   'tube-light': null,
+  'towel-table': [1.6, 1.3, 0.75],
+  'wood-shelf': [0.5, 1.1, 0.4],
+  extinguisher: [0.2, 0.55, 0.2],
+  vacuum: [0.4, 0.45, 0.4],
+  jerrycan: [0.3, 0.35, 0.15],
+  'poster-blue': null,
   range: [1.0, 0.9, 0.8],
   'pot-rack': [0.6, 1.8, 0.4],
   pots: null,
```

**差分** `src/lib/games/yappari-chameleon/mansion/room-furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
@@ -181,17 +181,6 @@ function washer(g: THREE.Group, p: Piece) {
   box(g, [0.6, 0.08, 0.02], { tint: '#f1ece2', rough: 0.5 }, [0, 0.78, 0.33]);
 }

-/** たたんだタオルの山。置いた場所で白・青・黄の並びを変える */
-function towels(g: THREE.Group, p: Piece) {
-  const colors = ['#f4f1ea', '#3f7ec7', '#f2c94c'];
-  for (let i = 0; i < 5; i++)
-    box(g, [0.48 - (i % 2) * 0.02, 0.09, 0.38], { tint: colors[(variant(p) + i) % 3], rough: 0.95 }, [
-      0,
-      0.045 + i * 0.095,
-      0
-    ]);
-}
-
 /** 青い洗濯カート。上の開いた箱に脚と車輪 */
 function cart(g: THREE.Group) {
   const blue: Finish = { tint: '#2f6fb8', rough: 0.5 };
@@ -220,6 +209,5 @@ export const ROOM_MAKERS = {
   box: cardboard,
   bucket,
   washer,
-  towels,
   cart
 } satisfies Partial<Record<Kind, Maker>>;
```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.ts b/src/lib/games/yappari-chameleon/mansion/rooms.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.ts
@@ -101,10 +101,21 @@ export function roomPieces(): Piece[] {
     p('vent', [-13.2, 2.3, 15.05], 2),
     p('duct', [-16, 3.2, 11]),
     p('caution', [-15, 0, 10.8]),
-    // ランドリー。南と東の壁に洗濯機、部屋を横切る 2 本の洗濯ひも
+    // ランドリー。南・東・西の壁に洗濯機、部屋を横切る 2 本の洗濯ひも
     ...[-19.3, -18.5, -17.7, -16.9].map((x) => p('washer', [x, 0, -4.7])),
-    p('washer', [-10.4, 0, -2.5], 3),
-    p('washer', [-10.4, 0, -1.7], 3),
+    p('washer', [-19.675, 0, -3.9], 1),
+    ...[-3.3, -2.5, -1.7, -0.9, -0.1].map((z) => p('washer', [-10.4, 0, z], 3)),
+    p('towel-table', [-16.1, 0, -2.8]),
+    p('towel-table', [-14.5, 0, -2.8]),
+    p('towel-table', [-16.6, 0, -0.6]),
+    p('wood-shelf', [-19.8, 0, -1.2], 1),
+    p('extinguisher', [-19.85, 0, -0.5]),
+    p('vacuum', [-19.7, 0, 0.1]),
+    p('vacuum', [-19.2, 0, 0.0], 1),
+    p('poster', [-19.99, 1.6, -2.4], 1),
+    p('poster-blue', [-19.99, 1.5, 0.9], 1),
+    p('jerrycan', [-12.0, 0, -4.8]),
+    p('jerrycan', [-12.35, 0, -4.8]),
     p('clothesline', [-15, 2.3, -1.5], 0, 9),
     p('clothesline', [-15, 2.3, 0.5], 0, 9),
     ...[-3.6, -0.6, 2.2].map((z) => p('beam', [-15, LAUNDRY.max[1], z])),
```

- [ ] **Step 4: 通るのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（414 tests）。

- [ ] **Step 5: 撮って、作り込みの前と本家と並べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task7`
Expected: `pageerror` が出ず、最後に `ok` と書いた場所を出す。

Read で `<scratchpad>/polish/task7/sheet-laundry.png` を見て、次を確かめる。

| 見るところ | 写っていること                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| まん中     | 木の台 3 台に、ずれて重なるタオルの高い山が 4 つずつ                                                                                                   |
| 壁ぞい     | 東の壁を埋める洗濯機 5 台（赤と黄色が交互）、西の壁の木の棚と白いポリタンク、赤い消火器、赤と銀の掃除機と青いホース、ポスター 2 枚、南の壁の赤い携行缶 |
| 通り道     | 戸口から部屋の奥へ歩ける幅が残る                                                                                                                       |

明るさ（`<scratchpad>/polish/task7/stats.json` の `luma`）は、計画を試したときに次の値だった。目標の帯（「撮り方と測り方」の表）から外れたら、Task 1 の `MOODS` の値ではなく、このタスクの模様と色の数字を見直す。

| 部屋       | 1 枚ずつ   | 平均 |
| ---------- | ---------- | ---- |
| ランドリー | 74・66・50 | 63   |

浮いている・床に沈んでいる・前と後ろが逆・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形か並びの数値だけを直して撮り直す（並びを動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` も通す）。

- [ ] **Step 6: 描く回数と三角形を測る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task7.json`
Expected: 6 行の数を出し、`calls` はどれも 1354 以下、`lights` はどれも 14。計画を試したときの値は次のとおり（作り込みの前は `<scratchpad>/perf-2b.json`）。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 358      | 270,851    | 260,387    |
| hall     | 183      | 221      | 223,407    | 218,689    |
| corridor | 177      | 246      | 179,017    | 168,107    |
| study    | 142      | 174      | 150,890    | 143,232    |
| kitchen  | 147      | 191      | 172,197    | 150,453    |
| laundry  | 166      | 213      | 153,939    | 156,983    |

- [ ] **Step 7: 確かめてコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Pile towels on wooden tables and fill the laundry walls with washers and clutter"
```

---

### Task 8: 書斎・図書室

**Files:**

- Create: `src/lib/games/yappari-chameleon/mansion/study.ts`（付け柱・アーチの窓・ひじ掛け椅子・床置きのランプ）
- Modify: `src/lib/games/yappari-chameleon/textures-rooms.ts`（細い板の床）、`src/lib/games/yappari-chameleon/mansion/build.ts`（床のつや）、`src/lib/games/yappari-chameleon/textures.ts`（本の背の高さ）、`src/lib/games/yappari-chameleon/mansion/room-furniture.ts`（胸像・黒い折りたたみ椅子）、`src/lib/games/yappari-chameleon/mansion/layout.ts`（種類と当たり）、`src/lib/games/yappari-chameleon/mansion/furniture.ts`（`STUDY_MAKERS`）、`src/lib/games/yappari-chameleon/mansion/rooms.ts`（天井の材質・並び）
- Test: `src/lib/games/yappari-chameleon/mansion/build.test.ts`、`src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

**Interfaces:**

- Produces: `study.ts` の `STUDY_MAKERS`（`pilaster`・`arch-window` は当たらない、`armchair` は 0.9 × 1.0 × 0.9m、`floor-lamp` は 0.4 × 1.6 × 0.4m）と `tufted()`（赤い革のボタン留めの模様）。
- Produces: 動く物の `folding-chair` は黒い管と黒い座面に替える（当たりと候補はそのまま）。置いたままの折りたたみ椅子を 4 脚足す（当たりは同じ大きさ）。

差の 10 位（縦じまの木の壁、大広間と同じ金の太陽の格天井、幅の広い明るい板の床）と、spec の書斎の項目（本の背の高さと色のばらつき・胸像の頭と肩・じゅうたん・ひじ掛け椅子）を直す。南の壁に黒い桟のアーチの窓 2 つと付け柱 3 本、戸口の両側にも付け柱、床は磨いた赤茶の細い板、天井は Task 5 の暗い板張りを共有する。黒い折りたたみ椅子を壁ぞいに散らし、東の壁の前に赤い革のひじ掛け椅子、南東の隅に橙のしまのランプを置く。

- [ ] **Step 1: 落ちるテストを書く**

**差分** `src/lib/games/yappari-chameleon/mansion/build.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/build.test.ts b/src/lib/games/yappari-chameleon/mansion/build.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/build.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.test.ts
@@ -78,7 +78,15 @@ const thinnest = (p: Pattern) =>
 describe('作り込んだ模様', () => {
   it('線は 2cm 以上（体に写せる太さ）', async () => {
     const rooms = await import('../textures-rooms');
-    for (const [name, p] of Object.entries({ whiteTile: rooms.whiteTile(), darkPlanks: rooms.darkPlanks() }))
+    const { books } = await import('../textures');
+    const { tufted } = await import('./study');
+    for (const [name, p] of Object.entries({
+      whiteTile: rooms.whiteTile(),
+      darkPlanks: rooms.darkPlanks(),
+      planks: rooms.planks(),
+      books: books(),
+      tufted: tufted()
+    }))
       expect(thinnest(p), name).toBeGreaterThanOrEqual(0.0199);
   });

```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.test.ts
@@ -140,7 +140,20 @@ describe('屋敷の 3 部屋', () => {
           .map((q) => q.kind)
       );
     expect([...kinds('書斎')]).toEqual(
-      expect.arrayContaining(['bookshelf', 'desk', 'globe', 'bust', 'post', 'painting'])
+      expect.arrayContaining([
+        'bookshelf',
+        'desk',
+        'globe',
+        'bust',
+        'post',
+        'painting',
+        'rug',
+        'arch-window',
+        'pilaster',
+        'folding-chair',
+        'armchair',
+        'floor-lamp'
+      ])
     );
     expect([...kinds('キッチン')]).toEqual(
       expect.arrayContaining([
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/build.test.ts src/lib/games/yappari-chameleon/mansion/rooms.test.ts`
Expected: FAIL。書斎の家具の種類に `arch-window` などが無いので落ち、`./study` が無いので線の太さのテストが落ちる。

- [ ] **Step 3: 実装する**

**差分** `src/lib/games/yappari-chameleon/mansion/build.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/build.ts b/src/lib/games/yappari-chameleon/mansion/build.ts
--- a/src/lib/games/yappari-chameleon/mansion/build.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.ts
@@ -34,7 +34,7 @@ const LOOKS: Record<Mat, () => Finish> = {
   splash: () => ({ pattern: splashWall(), rough: 0.85 }),
   splashFloor: () => ({ pattern: splashFloor(), rough: 0.8 }),
   splashCeiling: () => ({ pattern: splashCeiling(), rough: 0.85 }),
-  planks: () => ({ pattern: planks(), rough: 0.55 }),
+  planks: () => ({ pattern: planks(), rough: 0.35 }),
   whiteTile: () => ({ pattern: whiteTile(), rough: 0.3 }),
   blueHex: () => ({ pattern: blueHex(), rough: 0.5 }),
   redDamask: () => ({ pattern: damask('#5a1612', '#8a2a20'), rough: 0.85 }),
```

**差分** `src/lib/games/yappari-chameleon/mansion/furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/furniture.ts b/src/lib/games/yappari-chameleon/mansion/furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/furniture.ts
@@ -3,6 +3,7 @@ import type { Piece } from './layout';
 import { KITCHEN_MAKERS } from './kitchen';
 import { LAUNDRY_MAKERS } from './laundry';
 import { ROOM_MAKERS } from './room-furniture';
+import { STUDY_MAKERS } from './study';
 import { ball, BLACK, box, cyl, glowing, GOLD, plane, variant, WHITE, WOOD, type Maker } from './shapes';
 import { books, finish, leather, marble, oilPainting, poster, rug, type Finish } from '../textures';

@@ -267,7 +268,8 @@ const MAKERS: Record<Piece['kind'], Maker> = {
   stairs,
   ...ROOM_MAKERS,
   ...KITCHEN_MAKERS,
-  ...LAUNDRY_MAKERS
+  ...LAUNDRY_MAKERS,
+  ...STUDY_MAKERS
 };

 export function piece(p: Piece): THREE.Group {
```

**差分** `src/lib/games/yappari-chameleon/mansion/layout.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/layout.ts b/src/lib/games/yappari-chameleon/mansion/layout.ts
--- a/src/lib/games/yappari-chameleon/mansion/layout.ts
+++ b/src/lib/games/yappari-chameleon/mansion/layout.ts
@@ -88,6 +88,10 @@ export type Kind =
   | 'vacuum'
   | 'jerrycan'
   | 'poster-blue'
+  | 'pilaster'
+  | 'arch-window'
+  | 'armchair'
+  | 'floor-lamp'
   | 'range'
   | 'pot-rack'
   | 'pots'
@@ -155,6 +159,10 @@ export const SIZES: Record<Kind, V3 | null> = {
   vacuum: [0.4, 0.45, 0.4],
   jerrycan: [0.3, 0.35, 0.15],
   'poster-blue': null,
+  pilaster: null,
+  'arch-window': null,
+  armchair: [0.9, 1.0, 0.9],
+  'floor-lamp': [0.4, 1.6, 0.4],
   range: [1.0, 0.9, 0.8],
   'pot-rack': [0.6, 1.8, 0.4],
   pots: null,
```

**差分** `src/lib/games/yappari-chameleon/mansion/room-furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
@@ -31,7 +31,6 @@ function pedestal(g: THREE.Group) {
 }

 const STEEL: Finish = { tint: '#c9ced3', metal: 0.8, rough: 0.35 };
-const IRON: Finish = { tint: '#3b3f43', metal: 0.6, rough: 0.5 };
 const BRASS: Finish = { tint: '#b8933a', metal: 0.9, rough: 0.35 };

 function post(g: THREE.Group) {
@@ -84,18 +83,37 @@ function globe(g: THREE.Group) {
 function bust(g: THREE.Group) {
   const stone: Finish = { tint: '#e9e4da', rough: 0.4 };
   // marble() は床の模様で目地の黒い菱形が台の角に出るので、無地の石にする
-  box(g, [0.45, 1.15, 0.45], { tint: '#ddd5c8', rough: 0.25 }, [0, 0.575, 0]);
-  box(g, [0.38, 0.2, 0.22], stone, [0, 1.25, 0]);
-  cyl(g, [0.06, 0.07], 0.1, stone, [0, 1.38, 0]);
-  ball(g, 0.13, stone, [0, 1.5, 0]);
+  box(g, [0.45, 1.1, 0.45], { tint: '#ddd5c8', rough: 0.25 }, [0, 0.55, 0]);
+  box(g, [0.36, 0.05, 0.36], { tint: '#cfc6b8', rough: 0.25 }, [0, 1.125, 0]);
+  const chest = new THREE.Mesh(
+    new THREE.LatheGeometry(
+      [
+        [0.09, 0],
+        [0.16, 0.06],
+        [0.19, 0.16],
+        [0.17, 0.22],
+        [0.06, 0.25]
+      ].map(([x, y]) => new THREE.Vector2(x, y)),
+      20
+    ),
+    finish(stone, [1, 0.25])
+  );
+  chest.position.y = 1.15;
+  chest.scale.z = 0.6;
+  chest.castShadow = chest.receiveShadow = true;
+  g.add(chest);
+  cyl(g, [0.05, 0.06], 0.1, stone, [0, 1.43, 0]);
+  ball(g, 0.11, stone, [0, 1.55, 0]).scale.set(0.85, 1.05, 0.95);
+  box(g, [0.03, 0.05, 0.04], stone, [0, 1.54, 0.105]);
 }

 function foldingChair(g: THREE.Group) {
-  const seat: Finish = { tint: '#6b4a2e', rough: 0.6 };
+  const seat: Finish = { tint: '#151515', metal: 0.3, rough: 0.4 };
+  const tube: Finish = { tint: '#1c1c1e', metal: 0.6, rough: 0.35 };
   box(g, [0.42, 0.04, 0.4], seat, [0, 0.46, 0]);
   box(g, [0.42, 0.22, 0.03], seat, [0, 0.74, -0.2]);
   for (const x of [-0.19, 0.19])
-    for (const tilt of [0.35, -0.35]) box(g, [0.025, 0.9, 0.025], IRON, [x, 0.42, 0]).rotation.x = tilt;
+    for (const tilt of [0.35, -0.35]) box(g, [0.025, 0.9, 0.025], tube, [x, 0.42, 0]).rotation.x = tilt;
 }

 function bookPile(g: THREE.Group, p: Piece) {
```

**差分** `src/lib/games/yappari-chameleon/mansion/rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/rooms.ts b/src/lib/games/yappari-chameleon/mansion/rooms.ts
--- a/src/lib/games/yappari-chameleon/mansion/rooms.ts
+++ b/src/lib/games/yappari-chameleon/mansion/rooms.ts
@@ -20,13 +20,13 @@ export const DOORWAYS: Box[] = [
 ];
 const T = 0.3;

-/** 西の壁は大広間の東の壁の裏。床は戸口の下（x 7〜7.3）まで伸ばす */
+/** 西の壁は大広間の東の壁の裏。床は戸口の下（x 7〜7.3）まで伸ばす。本家の画面に無い天井は、ランドリーと同じ暗い板張り */
 function study(): Slab[] {
   const [x0, , z0] = STUDY.min;
   const [x1, h, z1] = STUDY.max;
   return [
     { min: [x0 - T, -1, z0], max: [x1, 0, z1], mat: 'planks', face: 'y+' },
-    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'coffer', face: 'y-' },
+    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'darkPlanks', face: 'y-' },
     { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'woodPanel', face: 'z+' },
     { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'woodPanel', face: 'z-' },
     { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'woodPanel', face: 'x-' }
@@ -79,9 +79,22 @@ export function roomPieces(): Piece[] {
         [14.5, 8.3]
       ] as const
     ).map(([x, z]) => p('post', [x, 0, z])),
+    p('rug', [12.25, 0, 6], 1),
     p('desk', [12.25, 0, 6]),
     p('globe', [15.8, 0, 2.2]),
     p('bust', [8.2, 0, 1.7]),
+    p('arch-window', [9.0, 0, 1.0]),
+    p('arch-window', [16.2, 0, 1.0]),
+    ...[10.4, 12.75, 15.1].map((x) => p('pilaster', [x, 0, 1.0])),
+    p('pilaster', [7.3, 0, 4.85], 1),
+    p('pilaster', [7.3, 0, 7.15], 1),
+    // 本家の書斎は、黒い折りたたみ椅子が壁ぞいに散らばる
+    p('folding-chair', [8.0, 0, 3.0], 1),
+    p('folding-chair', [8.0, 0, 8.2], 1),
+    p('folding-chair', [16.3, 0, 9.6], 3),
+    p('folding-chair', [13.5, 0, 9.9], 2),
+    p('armchair', [16.2, 0, 7.6], 3),
+    p('floor-lamp', [16.6, 0, 1.35]),
     // キッチン。北の壁に台と流し、まん中に島の台、西の壁に肉の棚とガスボンベ、東の壁にレンジと針金の棚
     p('counter', [-19.9, 0, 14.7], 2),
     p('counter', [-17.9, 0, 14.7], 2),
```

**新しいファイル** `src/lib/games/yappari-chameleon/mansion/study.ts`

```ts
import * as THREE from 'three';
import { finish, make, type Finish, type Pattern } from '../textures';
import type { Kind } from './layout';
import { box, copy, cyl, type Maker } from './shapes';

const PILLAR: Finish = { tint: '#693016', rough: 0.5 };
const MULLION: Finish = { tint: '#141414', metal: 0.5, rough: 0.4 };

/** 壁から 12cm 出るだけなので当たらない */
function pilaster(g: THREE.Group) {
  box(g, [0.4, 3.3, 0.12], PILLAR, [0, 1.85, 0.06]);
  box(g, [0.5, 0.3, 0.16], PILLAR, [0, 0.15, 0.08]);
  box(g, [0.52, 0.22, 0.18], PILLAR, [0, 3.6, 0.09]);
}

/** 壁に貼るだけなので当たらない。桟は 2cm */
function archWindow(g: THREE.Group) {
  const [w, top] = [1.3, 2.4];
  const r = w / 2;
  const glass = new THREE.Shape();
  glass.moveTo(-r, 0.5);
  glass.lineTo(r, 0.5);
  glass.lineTo(r, top);
  glass.absarc(0, top, r, 0, Math.PI, false);
  glass.lineTo(-r, 0.5);
  const pane = new THREE.Mesh(new THREE.ShapeGeometry(glass, 16), finish({ tint: '#2b0f0f', rough: 0.2 }, [1, 1]));
  pane.position.z = 0.01;
  pane.receiveShadow = true;
  g.add(pane);
  for (const x of [-r / 2, 0, r / 2]) {
    const y = top + r * Math.sqrt(1 - (x / r) ** 2);
    box(g, [0.02, y - 0.5, 0.03], MULLION, [x, (y + 0.5) / 2, 0.025]);
  }
  for (const y of [0.95, 1.45, 1.95, top]) box(g, [w, 0.02, 0.03], MULLION, [0, y, 0.025]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 8, 24, Math.PI), finish(PILLAR, [1, 1]));
  ring.position.set(0, top, 0.04);
  ring.castShadow = true;
  g.add(ring);
  const side = box(g, [0.1, top - 0.45, 0.08], PILLAR, [-r, (top + 0.45) / 2, 0.04]);
  copy(g, side, [r, (top + 0.45) / 2, 0.04]);
  box(g, [w + 0.2, 0.08, 0.14], PILLAR, [0, 0.46, 0.07]);
}

/** 赤い革のボタン留め。ボタンを結ぶひし形のしわ（2cm）と、ボタンのくぼみ */
export function tufted(): Pattern {
  return make('tufted', 128, 128, [0.24, 0.24], (g) => {
    g.fillStyle = '#7a1d20';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgb(40 6 8 / 0.5)';
    g.lineWidth = 11;
    g.beginPath();
    g.moveTo(0, 64);
    g.lineTo(64, 0);
    g.lineTo(128, 64);
    g.lineTo(64, 128);
    g.closePath();
    g.stroke();
    g.fillStyle = 'rgb(30 4 6 / 0.7)';
    for (const [x, y] of [
      [0, 64],
      [64, 0],
      [128, 64],
      [64, 128]
    ]) {
      g.beginPath();
      g.arc(x, y, 7, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 赤い革のひじ掛け椅子。前（+z）が座る側 */
function armchair(g: THREE.Group) {
  const red: Finish = { pattern: tufted(), rough: 0.45 };
  box(g, [0.9, 0.42, 0.85], red, [0, 0.21, 0.02]);
  box(g, [0.9, 0.62, 0.18], red, [0, 0.69, -0.34]);
  for (const x of [-0.39, 0.39]) box(g, [0.14, 0.26, 0.8], red, [x, 0.55, 0.03]);
  box(g, [0.64, 0.1, 0.62], red, [0, 0.47, 0.08]);
  for (const [x, z] of [
    [-0.38, 0.38],
    [0.38, 0.38],
    [-0.38, -0.38],
    [0.38, -0.38]
  ])
    cyl(g, [0.025, 0.02], 0.08, { tint: '#2a1a10', rough: 0.5 }, [x, 0.04, z], 10);
}

function stripes(): Pattern {
  return make('lamp-stripes', 64, 64, [0.12, 0.12], (g) => {
    g.fillStyle = '#f2a03a';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#c4580a';
    g.fillRect(0, 0, 24, 64);
  });
}

function floorLamp(g: THREE.Group) {
  const brass: Finish = { tint: '#b8933a', metal: 0.9, rough: 0.35 };
  cyl(g, [0.16, 0.18], 0.04, brass, [0, 0.02, 0]);
  cyl(g, [0.015, 0.015], 1.3, brass, [0, 0.67, 0], 10);
  const m = finish({ pattern: stripes(), rough: 0.6 }, [1.1, 0.3]);
  m.emissive.set('#da710a');
  m.emissiveIntensity = 0.6;
  m.side = THREE.DoubleSide;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.3, 24, 1, true), m);
  shade.position.y = 1.42;
  g.add(shade);
}

export const STUDY_MAKERS = {
  pilaster,
  'arch-window': archWindow,
  armchair,
  'floor-lamp': floorLamp
} satisfies Partial<Record<Kind, Maker>>;
```

**差分** `src/lib/games/yappari-chameleon/textures-rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/textures-rooms.ts b/src/lib/games/yappari-chameleon/textures-rooms.ts
--- a/src/lib/games/yappari-chameleon/textures-rooms.ts
+++ b/src/lib/games/yappari-chameleon/textures-rooms.ts
@@ -214,27 +214,28 @@ export function hunterSign(): Pattern {
   });
 }

-/** 書斎の茶色の木の床。幅 15cm の板を長さ方向にずらして張る。継ぎ目と木目は 2cm 以上 */
+/** 書斎の磨いた赤茶の床。幅 10cm の細い板を長さをふぞろいにずらして張る。継ぎ目と木目は 2cm 以上 */
 export function planks(): Pattern {
   return make('planks', 512, 512, [1.2, 1.2], (g) => {
     const r = rng(89);
-    for (let i = 0; i < 8; i++) {
-      const y = i * 64;
+    const h = 512 / 12;
+    for (let i = 0; i < 12; i++) {
+      const y = i * h;
       let x = -r() * 200;
       while (x < 512) {
-        const len = 180 + r() * 160;
-        g.fillStyle = `hsl(26 ${40 + r() * 10}% ${26 + r() * 8}%)`;
-        g.fillRect(x, y, len, 64);
-        g.strokeStyle = 'rgb(255 230 200 / 0.07)';
+        const len = 150 + r() * 200;
+        // 本家の床は、ところどころに影のような濃い板が混じる
+        const dark = r() < 0.15;
+        g.fillStyle = `hsl(14 ${40 + r() * 12}% ${dark ? 18 + r() * 4 : 30 + r() * 9}%)`;
+        g.fillRect(x, y, len, h);
+        g.strokeStyle = 'rgb(255 220 190 / 0.08)';
         g.lineWidth = 9;
-        for (let k = 0; k < 3; k++) {
-          g.beginPath();
-          g.moveTo(x, y + 14 + k * 16);
-          g.lineTo(x + len, y + 16 + k * 16);
-          g.stroke();
-        }
-        g.strokeStyle = 'rgb(0 0 0 / 0.35)';
-        g.strokeRect(x, y, len, 64);
+        g.beginPath();
+        g.moveTo(x, y + h * 0.4);
+        g.lineTo(x + len, y + h * 0.45);
+        g.stroke();
+        g.strokeStyle = 'rgb(20 6 2 / 0.45)';
+        g.strokeRect(x, y, len, h);
         x += len;
       }
     }
```

**差分** `src/lib/games/yappari-chameleon/textures.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/textures.ts b/src/lib/games/yappari-chameleon/textures.ts
--- a/src/lib/games/yappari-chameleon/textures.ts
+++ b/src/lib/games/yappari-chameleon/textures.ts
@@ -354,7 +354,12 @@ export function books(): Pattern {
     let x = 4;
     while (x < 500) {
       const w = Math.min(500 - x, 13 + Math.floor(r() * 13));
-      const h = 120 + Math.floor(r() * 54);
+      // 本家の書斎の本は背の高さがばらつく。ところどころに隙間を空ける
+      if (r() < 0.06) {
+        x += w;
+        continue;
+      }
+      const h = 80 + Math.floor(r() * 96);
       const c = colors[Math.floor(r() * colors.length)];
       g.fillStyle = c;
       g.fillRect(x, 184 - h, w - 2, h);
```

- [ ] **Step 4: 通るのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（414 tests）。

- [ ] **Step 5: 撮って、作り込みの前と本家と並べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task8`
Expected: `pageerror` が出ず、最後に `ok` と書いた場所を出す。

Read で `<scratchpad>/polish/task8/sheet-study.png` を見て、次を確かめる。

| 見るところ | 写っていること                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 南の壁     | 暗い外と黒い桟の格子のアーチの窓 2 つ、木の付け柱 3 本、額 2 枚                                                  |
| 床と天井   | 細い赤茶の板（ところどころ濃い板）と、暗い板張りの天井                                                           |
| 家具       | 机の下のじゅうたん、黒い折りたたみ椅子、東の壁の前の赤い革のひじ掛け椅子、隅の橙のしまのランプ、頭と肩のある胸像 |
| 本棚       | 背の高さがばらつき、ところどころ隙間のある本                                                                     |

明るさ（`<scratchpad>/polish/task8/stats.json` の `luma`）は、計画を試したときに次の値だった。目標の帯（「撮り方と測り方」の表）から外れたら、Task 1 の `MOODS` の値ではなく、このタスクの模様と色の数字を見直す。

| 部屋 | 1 枚ずつ   | 平均 |
| ---- | ---------- | ---- |
| 書斎 | 61・75・66 | 67   |

浮いている・床に沈んでいる・前と後ろが逆・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形か並びの数値だけを直して撮り直す（並びを動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` も通す）。

- [ ] **Step 6: 描く回数と三角形を測る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task8.json`
Expected: 6 行の数を出し、`calls` はどれも 1354 以下、`lights` はどれも 14。計画を試したときの値は次のとおり（作り込みの前は `<scratchpad>/perf-2b.json`）。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 376      | 270,851    | 264,511    |
| hall     | 183      | 233      | 223,407    | 221,237    |
| corridor | 177      | 253      | 179,017    | 170,109    |
| study    | 142      | 192      | 150,890    | 147,186    |
| kitchen  | 147      | 200      | 172,197    | 152,461    |
| laundry  | 166      | 221      | 153,939    | 158,989    |

- [ ] **Step 7: 確かめてコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Dress the study with arched windows, pilasters, a glossy floor and armchairs"
```

---

### Task 9: ロビーのアーチ・しぶき・水色の台

**Files:**

- Modify: `src/lib/games/yappari-chameleon/textures-rooms.ts`（しぶきの壁を 1 面 16m に）、`src/lib/games/yappari-chameleon/mansion/layout.ts`（`Slab.shift`・`Slab.flip`、`lobby-arch`）、`src/lib/games/yappari-chameleon/mansion/build.ts`（模様のずらしと裏返し）、`src/lib/games/yappari-chameleon/mansion/lobby.ts`（壁ごとのずらし・アーチの並び）、`src/lib/games/yappari-chameleon/mansion/room-furniture.ts`（水色の台・アーチ）
- Test: `src/lib/games/yappari-chameleon/mansion/lobby.test.ts`

**Interfaces:**

- Produces: `Slab` に `shift?: number`（`face` の模様を横へずらす量。模様 1 枚を 1 とする）と `flip?: boolean`（左右の裏返し）。`mergeStatic` は模様のずらしと繰り返しを uv に焼くので、ずらした壁どうしもまとまる。
- Produces: `Kind` に `lobby-arch`（当たらない）。`lobbyPieces()` の頭に壁 1 面 4 つずつ、16 個のアーチ。

spec のロビーの項目を直す。白いアーチは壁の模様の線をやめて、壁から 6cm 浮き出した白い帯と、右下へずらした薄い灰色の帯（ロビーは日を消すので、影は形で描く）にする。しぶきは 1 面ぶん（16m × 6m）の模様にして壁ごとにずらし裏返し、同じしぶきが並ばないようにする（canvas は 1 枚のまま）。水色の台は濃い台座と上のふち、白い丸いボタンと、いつも光る水色の輪で、白い壁の前でもはっきり見せる（当たりは今のまま）。

- [ ] **Step 1: 落ちるテストを書く**

**差分** `src/lib/games/yappari-chameleon/mansion/lobby.test.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/lobby.test.ts b/src/lib/games/yappari-chameleon/mansion/lobby.test.ts
--- a/src/lib/games/yappari-chameleon/mansion/lobby.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/lobby.test.ts
@@ -1,7 +1,7 @@
 import { describe, expect, it } from 'vitest';
 import { idle, newBody, step, type Body, type Level } from '../move';
 import { levelOf, mansion, SPAWNS } from './layout';
-import { inLobby, LOBBY, onPodium, PODIUM, podiumBoxes } from './lobby';
+import { inLobby, LOBBY, lobbyPieces, lobbySlabs, onPodium, PODIUM, podiumBoxes } from './lobby';

 const lv: Level = levelOf(mansion());

@@ -73,6 +73,16 @@ describe('ロビーの部屋', () => {
         for (const z of [b.min[2], b.max[2]]) expect(Math.hypot(x - cx, z - cz)).toBeLessThan(PODIUM.r + 0.01);
   });

+  it('しぶきの壁は 4 面とも模様のずらし方か裏返しが違い、どの面にも白いアーチが 4 つ並ぶ', () => {
+    const walls = lobbySlabs().filter((s) => s.mat === 'splash');
+    expect(walls).toHaveLength(4);
+    expect(new Set(walls.map((s) => `${s.shift ?? 0}:${!!s.flip}`)).size).toBe(4);
+    const arches = lobbyPieces().filter((q) => q.kind === 'lobby-arch');
+    expect(arches).toHaveLength(16);
+    for (const turn of [0, 1, 2, 3]) expect(arches.filter((q) => q.turn === turn)).toHaveLength(4);
+    for (const q of arches) expect(inLobby(q.at)).toBe(true);
+  });
+
   it('日を消すのはロビーの中だけ', () => {
     expect(inLobby([0, 1.5, -66])).toBe(true);
     expect(inLobby(SPAWNS.hall[1])).toBe(false);
```

- [ ] **Step 2: 落ちるのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/lobby.test.ts`
Expected: FAIL。しぶきの壁に `shift` が無く、アーチも無いので落ちる。

- [ ] **Step 3: 実装する**

**差分** `src/lib/games/yappari-chameleon/mansion/build.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/build.ts b/src/lib/games/yappari-chameleon/mansion/build.ts
--- a/src/lib/games/yappari-chameleon/mansion/build.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.ts
@@ -76,6 +76,10 @@ function slab(s: Slab): THREE.Mesh {
     const m = finish(LOOKS[mat](), faceSize(f));
     // 合わせるのは裏のある（戸口で分けた）壁だけ。1 枚で張った面には継ぎ目が無いので、部屋の端から模様を始める
     if (s.back) anchor(m, f, s);
+    if (m.map && f === s.face) {
+      m.map.offset.x += s.shift ?? 0;
+      if (s.flip) m.map.repeat.x *= -1;
+    }
     return m;
   };
   const mats = ORDER.map(look);
```

**差分** `src/lib/games/yappari-chameleon/mansion/layout.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/layout.ts b/src/lib/games/yappari-chameleon/mansion/layout.ts
--- a/src/lib/games/yappari-chameleon/mansion/layout.ts
+++ b/src/lib/games/yappari-chameleon/mansion/layout.ts
@@ -33,6 +33,9 @@ export interface Slab {
   /** 面の裏（face の向きの反対）の材質。大広間と廊下の壁の裏が、となりの部屋の壁になる */
   back?: Mat;
   shadow?: boolean;
+  /** face の模様を横へずらす量（模様 1 枚を 1 とする）と、左右の裏返し。同じ模様の壁を別の見え方にする */
+  shift?: number;
+  flip?: boolean;
 }

 export type Kind =
@@ -92,6 +95,7 @@ export type Kind =
   | 'arch-window'
   | 'armchair'
   | 'floor-lamp'
+  | 'lobby-arch'
   | 'range'
   | 'pot-rack'
   | 'pots'
@@ -163,6 +167,7 @@ export const SIZES: Record<Kind, V3 | null> = {
   'arch-window': null,
   armchair: [0.9, 1.0, 0.9],
   'floor-lamp': [0.4, 1.6, 0.4],
+  'lobby-arch': null,
   range: [1.0, 0.9, 0.8],
   'pot-rack': [0.6, 1.8, 0.4],
   pots: null,
```

**差分** `src/lib/games/yappari-chameleon/mansion/lobby.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/lobby.ts b/src/lib/games/yappari-chameleon/mansion/lobby.ts
--- a/src/lib/games/yappari-chameleon/mansion/lobby.ts
+++ b/src/lib/games/yappari-chameleon/mansion/lobby.ts
@@ -16,9 +16,9 @@ export function lobbySlabs(): Slab[] {
     { min: [x0, -1, z0], max: [x1, 0, z1], mat: 'splashFloor', face: 'y+' },
     { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'splashCeiling', face: 'y-' },
     { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'splash', face: 'z+' },
-    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'splash', face: 'z-' },
-    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'splash', face: 'x+' },
-    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'splash', face: 'x-' }
+    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'splash', face: 'z-', shift: 0.25, flip: true },
+    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'splash', face: 'x+', shift: 0.5 },
+    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'splash', face: 'x-', shift: 0.75, flip: true }
   ];
 }

@@ -37,8 +37,21 @@ export function podiumBoxes(): Box[] {
   ].map(([w, d]) => ({ min: [cx - w, 0, cz - d], max: [cx + w, PODIUM.h, cz + d] }));
 }

+/** 壁 1 面に 4 つずつの白いアーチ。壁の内側の面に、部屋の中を向けて置く */
+function arches(): Piece[] {
+  const [x0, , z0] = LOBBY.min;
+  const [x1, , z1] = LOBBY.max;
+  return [2, 6, 10, 14].flatMap((d): Piece[] => [
+    { kind: 'lobby-arch', at: [x0 + d, 0, z0], turn: 0 },
+    { kind: 'lobby-arch', at: [x0 + d, 0, z1], turn: 2 },
+    { kind: 'lobby-arch', at: [x0, 0, z0 + d], turn: 1 },
+    { kind: 'lobby-arch', at: [x1, 0, z0 + d], turn: 3 }
+  ]);
+}
+
 export function lobbyPieces(): Piece[] {
   return [
+    ...arches(),
     { kind: 'podium', at: PODIUM.at, turn: 0 },
     // 本家のロビーの端の水色の台（本家はこのそばでマップの設定を開く。こちらは画面のボタンで開く）
     { kind: 'pedestal', at: [6.6, 0, -66.6], turn: 0 }
```

**差分** `src/lib/games/yappari-chameleon/mansion/room-furniture.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
--- a/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
+++ b/src/lib/games/yappari-chameleon/mansion/room-furniture.ts
@@ -24,10 +24,39 @@ function podium(g: THREE.Group) {
   g.add(rim);
 }

-/** 本家のロビーの端の水色の台 */
+/**
+ * 本家のロビーの端の水色の台。白い壁の前で埋もれないよう、濃い台座と、上の丸いボタンのまわりに
+ * いつも光る輪を付ける
+ */
 function pedestal(g: THREE.Group) {
-  box(g, [0.9, 0.9, 0.9], { tint: '#7fd1e8', rough: 0.4 }, [0, 0.45, 0]);
-  cyl(g, [0.22, 0.24], 0.1, { tint: '#2f9ec7', rough: 0.3 }, [0, 0.95, 0]);
+  box(g, [0.96, 0.12, 0.96], { tint: '#1f6f8f', rough: 0.4 }, [0, 0.06, 0]);
+  box(g, [0.9, 0.82, 0.9], { tint: '#5fd0f0', rough: 0.35 }, [0, 0.53, 0]);
+  box(g, [0.96, 0.06, 0.96], { tint: '#1f6f8f', rough: 0.4 }, [0, 0.97, 0]);
+  cyl(g, [0.26, 0.28], 0.06, { tint: '#ffffff', rough: 0.3 }, [0, 1.03, 0], 32);
+  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 8, 48), glowing('#7fe6ff', '#4fd8ff', 1.2));
+  ring.rotation.x = Math.PI / 2;
+  ring.position.y = 1.03;
+  g.add(ring);
+}
+
+/**
+ * ロビーの白いアーチ（幅 3.1m、上の半円の中心は 3.4m）。壁から 6cm 浮き出した白い帯と、右下へずらした
+ * 薄い灰色の帯を影にする（ロビーは日を消すので、影は形で描く）。壁に貼るだけなので当たらない
+ */
+function lobbyArch(g: THREE.Group) {
+  const [r, top] = [1.56, 3.42];
+  // [色, 右へ, 下へ, 壁からの位置, 帯の厚みの倍率]
+  for (const [tint, dx, dy, z, depth] of [
+    ['#d6d2cb', 0.05, -0.05, 0.01, 0.15],
+    ['#ffffff', 0, 0, 0.03, 0.6]
+  ] as const) {
+    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 8, 32, Math.PI), finish({ tint, rough: 0.6 }, [1, 1]));
+    band.position.set(dx, top + dy, z);
+    band.scale.z = depth;
+    g.add(band);
+    const leg = box(g, [0.14, top, 0.06], { tint, rough: 0.6 }, [-r + dx, top / 2 + dy, z]);
+    copy(g, leg, [r + dx, top / 2 + dy, z]);
+  }
 }

 const STEEL: Finish = { tint: '#c9ced3', metal: 0.8, rough: 0.35 };
@@ -215,6 +244,7 @@ function cart(g: THREE.Group) {
 export const ROOM_MAKERS = {
   podium,
   pedestal,
+  'lobby-arch': lobbyArch,
   post,
   desk,
   globe,
```

**差分** `src/lib/games/yappari-chameleon/textures-rooms.ts`

```diff
diff --git a/src/lib/games/yappari-chameleon/textures-rooms.ts b/src/lib/games/yappari-chameleon/textures-rooms.ts
--- a/src/lib/games/yappari-chameleon/textures-rooms.ts
+++ b/src/lib/games/yappari-chameleon/textures-rooms.ts
@@ -44,29 +44,14 @@ function splats(g: CanvasRenderingContext2D, seed: number, w: number, h: number,
 }

 /**
- * ロビーの壁。白地に白いアーチの浮き彫り（影とハイライトの線）と、ペンキのしぶき。
- * 1 枚が 8m × 6m で、線は 3cm 以上
+ * ロビーの壁。白地にペンキのしぶき。1 枚が壁 1 面の 16m × 6m で、線は 3cm 以上。
+ * 白いアーチは浮き出させた形で別に置く（lobby.ts）。壁ごとに模様をずらし裏返して、同じしぶきが並ばないようにする
  */
 export function splashWall(): Pattern {
-  return make('splash-wall', 1024, 768, [8, 6], (g) => {
+  return make('splash-wall', 2048, 768, [16, 6], (g) => {
     g.fillStyle = '#f4f2ee';
-    g.fillRect(0, 0, 1024, 768);
-    for (const cx of [256, 768]) {
-      for (const [color, dx] of [
-        ['rgb(0 0 0 / 0.14)', 4],
-        ['rgb(255 255 255 / 0.95)', -4]
-      ] as const) {
-        g.strokeStyle = color;
-        g.lineWidth = 5;
-        g.beginPath();
-        g.moveTo(cx - 200 + dx, 768);
-        g.lineTo(cx - 200 + dx, 330);
-        g.arc(cx + dx, 330, 200, Math.PI, 0);
-        g.lineTo(cx + 200 + dx, 768);
-        g.stroke();
-      }
-    }
-    splats(g, 83, 1024, 768, 9, true);
+    g.fillRect(0, 0, 2048, 768);
+    splats(g, 83, 2048, 768, 18, true);
   });
 }

```

- [ ] **Step 4: 通るのを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（415 tests）。

- [ ] **Step 5: 撮って、作り込みの前と本家と並べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task9`
Expected: `pageerror` が出ず、最後に `ok` と書いた場所を出す。

Read で `<scratchpad>/polish/task9/sheet-lobby.png` を見て、次を確かめる。

| 見るところ | 写っていること                                              |
| ---------- | ----------------------------------------------------------- |
| 壁         | 4 面とも違うしぶきの並び。1 面の中でも同じ形が 2 回並ばない |
| アーチ     | 壁から浮き出した白い帯と、その右下の薄い灰色の影            |
| 水色の台   | 濃い台座、白い丸いボタン、光る水色の輪                      |

明るさ（`<scratchpad>/polish/task9/stats.json` の `luma`）は、計画を試したときに次の値だった。目標の帯（「撮り方と測り方」の表）から外れたら、Task 1 の `MOODS` の値ではなく、このタスクの模様と色の数字を見直す。

| 部屋   | 1 枚ずつ      | 平均 |
| ------ | ------------- | ---- |
| ロビー | 148・157・162 | 156  |

浮いている・床に沈んでいる・前と後ろが逆・面が欠けている・同じ面がちらつく、のどれかがあれば、その家具の形か並びの数値だけを直して撮り直す（並びを動かしたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion` も通す）。

- [ ] **Step 6: 描く回数と三角形を測る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task9.json`
Expected: 6 行の数を出し、`calls` はどれも 1354 以下、`lights` はどれも 14。計画を試したときの値は次のとおり（作り込みの前は `<scratchpad>/perf-2b.json`）。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 380      | 270,851    | 281,663    |
| hall     | 183      | 233      | 223,407    | 221,237    |
| corridor | 177      | 253      | 179,017    | 170,109    |
| study    | 142      | 192      | 150,890    | 147,186    |
| kitchen  | 147      | 200      | 172,197    | 152,461    |
| laundry  | 166      | 227      | 153,939    | 176,965    |

- [ ] **Step 7: 確かめてコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Raise the lobby arches off the walls, vary the splashes and mark the pedestal"
```

---

### Task 10: 明るさの確かめ・重さの表・CLAUDE.md・全体の確かめ

**Files:**

- Modify: `CLAUDE.md`（屋敷の部屋と明るさの説明）
- Create（リポジトリに入れない）: `<scratchpad>/polish/task10/`、`<scratchpad>/polish/perf-task10.json`

- [ ] **Step 1: 最後の姿を撮り、明るさを帯と比べる**

dev サーバー（`pnpm dev --port 5180`）が動いていなければ裏で起動する。

Run: `node <scratchpad>/polish/shots.mjs "$PWD" <scratchpad> task10`
Expected: `pageerror` が出ず `ok`。計画を試したときの明るさは次のとおりで、どの部屋も目標の帯に入った。

| 部屋             | 作り込みの前  | 今            | 今の平均 |
| ---------------- | ------------- | ------------- | -------- |
| キッチン         | 177・194・183 | 78・88・90    | 85       |
| ランドリー       | 134・130・113 | 74・66・50    | 63       |
| 書斎             | 77・84・82    | 61・75・66    | 67       |
| ロビー           | 144・151・152 | 148・157・162 | 156      |
| 大広間・緑の廊下 | 79・112       | 78・111       | 94       |

帯から外れた部屋があれば、`src/lib/games/yappari-chameleon/mansion/moods.ts` の `MOODS` のその部屋の `exposure` を 0.05 刻みで動かして撮り直す（暗すぎるときは `fill` も 0.05 ずつ上げる）。大広間・緑の廊下・ロビーは `DAY` のままなので動かさない。値を変えたら `pnpm vitest run src/lib/games/yappari-chameleon/mansion/moods.test.ts` も通す。

- [ ] **Step 2: 描く回数と三角形の表を作る**

Run: `node <scratchpad>/perf-chameleon.mjs "$PWD" <scratchpad>/polish/perf-task10.json`
Expected: `calls` はどれも 1354 以下、`lights` は 14。計画を試したときの値は次のとおり。

| 視点     | 前の回数 | 今の回数 | 前の三角形 | 今の三角形 |
| -------- | -------- | -------- | ---------- | ---------- |
| lobby    | 284      | 380      | 270,851    | 281,663    |
| hall     | 183      | 233      | 223,407    | 221,237    |
| corridor | 177      | 253      | 179,017    | 170,109    |
| study    | 142      | 192      | 150,890    | 147,186    |
| kitchen  | 147      | 200      | 172,197    | 152,461    |
| laundry  | 166      | 227      | 153,939    | 176,965    |

この表と Step 1 の表を、作業の担当への報告に入れる。

- [ ] **Step 3: CLAUDE.md の説明を今の姿にする**

**差分** `CLAUDE.md`

```diff
diff --git a/CLAUDE.md b/CLAUDE.md
--- a/CLAUDE.md
+++ b/CLAUDE.md
@@ -49,7 +49,7 @@ bomb-relay と hockey は物理があるのでループで動かす。ルール

 アニマルサバイバー（`animal-survivors`）は、動物を 1 匹選び、面（森・夜の墓地・雪山・火山）を選んで、押し寄せる大群を 10 分生き延びるサバイバル（`levels: 1`。キャラ選択・ステージを選ぶ画面（`StageSelect.svelte`。ボスの名前は出さず、出てきたときに分かる）・プレイ・リザルトをゲームが持ち、シェルの `onfinish` は呼ばない）。面の表は `stages/` に面ごとのファイルで持ち（`stages/index.ts` の `STAGES` と `stageOf`）、面は地面と飾りの絵（`art`）・コインの倍率（`coin`、墓地は 1.5、雪山は 2）・曲（`song`）を持つ。面には通れない障害物（`obstacles.ts`。森は大岩と倒木、墓地は大きな墓石と崩れた柵、雪山は氷の岩と雪の積もった木、火山は黒い溶岩の岩と湯気の出る岩、絵は `art/obstacles.ts`）が 160 ドットの区画におよそ 4 つに 1 つ、位置のハッシュで毎回同じ場所に出る（協力プレイの 2 台でもそろう。始めの位置から 80 ドットには置かない）。当たりは種類ごとの丸の並び（`SHAPES`）を斜めに見下ろす絵に合わせて縦につぶしたもの（`SQUASH`）で、自分（子の端末の `move` も）と、ボス・群れ・ランタン・大ヘビの体・きらきらハリネズミでない敵を `pushOut()` で外へ出す（敵は押し合いのあとに出す。前だと群れに押し込まれて毎フレーム出入りする。ヌシは体が大きく狭いすき間で引っかかるので、押し出す丸を半径 16 までにする、`CHIEF_PUSH`）。武器は通り抜ける。敵の出る位置・落ちる玉と品・宝の地図の宝箱は中に来たら外へずらし、重なる飾りは描かない。障害物は敵と足もとの高さの順に混ぜて描き（`byFeet`）、自分は敵より上に描くので、自分の絵に重なる手前の障害物（`covers`）だけを自分のあとにもう一度描き、自分がほとんど隠れたらその障害物を薄くする（`draw-obstacles.ts`）。出来事で灯すランタンも置くときに外へ出す。ステージには遺物（`relics.ts` の 8 つ。ステージごとに 2 つを、始めの位置から 700 と 1500 ドットほどの決まった場所に、まだ持っていなければ品として置く）があり、歩いて拾うとその回からすぐ効き（`World.relics` と `hasRelic()`）、`Prompts` が拾った出来事で記録の `relics` へすぐ書く（倒れた回・アプリが閉じた回でも残る。回の終わりの `record()` も回のまとめの `relics` を足す）。遺物から 400 ドットに入るか古い地図を持っていると、画面の端に矢印を出す。図鑑の遺物のタブは、まだ拾っていない遺物に `relicHint()` の手がかり（ステージ・画面の上を北とした 8 方位・遠さ）を出す。合体・遺物・祠・限界突破が初めて起きたときだけ、`Prompts` が帯にひとこと説明を足す（出したかは記録の `tips`、端末ごと）。野原には祠（`shrines.ts`。160 ドットの区画 10 個に 1 つほど、位置のハッシュで毎回同じ。障害物の上と始めの位置のまわりには置かない）があり、触れた動物にだけご利益（`Hero.blessing` の 30 秒の時計。力・風・知恵と、宝箱・全快）があって、使った祠は `World.shrinesUsed` に覚えてその回は戻さない（祠めぐりの実績は、祠を使った動物ごとの `Hero.shrineCount` で見る）。協力プレイの snap は、品の行の遺物の番号・持っている遺物・使った祠・動物ごとのご利益を運ぶ。夜の墓地は森の時刻の流れのまま、敵をおばけ・ガイコツ・ゾンビにした面で（顔ぶれの敵が森の敵より 1.3〜2 倍硬いので、面の倍率 `HARDER` は 0.9 にして雪山と同じくらいの難しさにする）、森をクリアすると選べる。雪山（`stages/snow.ts`）は敵 7 種を雪の顔ぶれ（ペンギン・雪ん子・アザラシ・雪だるま・トナカイ・雪ウサギ・シロクマ。動き方は入れ替える前と同じ）にして 1.2 倍強くした面で、墓地をクリアすると選べる（面の `after`。記録の `stages`、前に遊んだ面は `stage`）。雪山には吹雪（面の `storms`、`storm.ts`）が 4 回来て、3 秒前に帯を出し、20 秒のあいだ自分が風下へふつうの速さの 2 割で流され、敵は風に乗ると速く、逆らうと遅くなる（最大 4 割。ボス・ランタン・群れは変わらない）。吹雪の時計は step の中で進むので、3 択や一時停止のあいだは減らず、時計の品で止まっているあいだは流されない。かすみと流れる雪は `draw-storm.ts`。火山（`stages/volcano.ts`）は敵 7 種を火山の顔ぶれ（トカゲ・火の玉・溶岩ヘビ・岩ムシ・火イノシシ・炎グモ・岩ワニ。動き方は入れ替える前と同じ）にして 1.4 倍強くした面で、雪山をクリアすると選べる（コイン 2.5 倍）。火山には噴火（面の `eruptions`、`eruption.ts`）が吹雪と同じ時刻に 4 回来て、3 秒前に帯を出し、20 秒のあいだ 1 秒ほどごとに自分のまわりに割れ目の予告を置き、1.2 秒で溶岩の池（`World.lava`、24 個まで）になる。池は 6 秒残り、中の自分とふつうの敵に 0.5 秒ごとに当たる（ボス・ランタン・大ヘビの体・ハリネズミには当てない。倒した数は `World.lavaKills` と記録の `lavaKills`）。噴火の時計は step の中で進み、3 択・一時停止・時計の品で止まる。自分が倒れたフレームでは、それより後の予告と池は当てない。池と割れ目は大きさが毎回ちがうので、`draw-volcano.ts` が大きさごとにドット絵を作って控える。火山のボスは溶岩の巨人（地ならしと、自分のまわりへの岩。当たったところに池を残す。予告の `Hazard.lava`）と不死鳥（大ワシと同じく空へ上がって急降下し、それと交互に火の羽根の予告を降らせる。体力が尽きると一度だけ体力半分でよみがえり、そのあいだは当たらない。`bosses-volcano.ts` の `rebirth()` を `damageEnemy` が倒す手前で見る）。ボスは敵の表の `ai`（巨大ベア型の突進と地ならし、女王グモ型の飛び道具と手下、雪山の大雪男と氷の竜、1 面の大イノシシ・大ワシ・大木のおばけ・大ヘビ）で動き方を選び、手下（`minion`）と飛び道具の絵（`shot`）も表に持つので、墓地のかぼちゃ大王とガイコツの騎士は今の動きを使い回す。ルールは DOM を使わない `world.ts`（移動・出現・敵の動き・押し合い・接触・時計）・`arms.ts`（武器の動き方）・`drops.ts`（経験値の曲線・玉・肉・磁石）・`choices.ts`（レベルアップの 3 択）で、動物・武器（Lv2〜5 の上げ幅）・パッシブ・敵・ステージの出現表はそれぞれの表（`animals.ts`・`weapons.ts`・`passives.ts`・`enemies.ts`・`stages/forest.ts`）に 1 項目足せば加わる。乱数は種から作る（`rng.ts`）。武器は進む向きではなくいちばん近い敵へ向けて撃つ（逃げながら当てるため）。遠すぎる敵は消さずに進む先の画面の外へ置き直し、玉が 400 個を超えたら新しく作らず自分からいちばん遠い玉に値を足す。ドット絵は 1 文字 = 1 色の格子（`art/*.ts`、色は `art/palette.ts`）で、`pixels.ts` の `bake()` が初回に 1 ドット = 1 画素の canvas へ焼いて控える。座標は仮想画面（幅 260 ドット前後、`draw.ts` の `viewSize()` が盤面そのものの大きさから整数の倍率を決める）のドットで持ち、端末の画素の canvas に倍率を掛けてぼかさずに描く。カメラと絵の位置は仮想のドットではなく端末の画素に丸める（`devicePx`）。ドットに丸めると iPad では 3pt 刻みで不規則に進み、カクついて酔うと言われた。被弾で画面は揺らさず、縁を赤く光らせる。大群の中では点滅がチカチカに見えるので、1 フレームごとに消したり切り替えたりはしない（当たったあとの無敵は消さずに薄く、敵に当たったときの白は半分重ね、予告と時計の終わりは `draw-boss.ts` の `pulse` でなめらかに明滅させる）。HUD は英数字だけなので同じ canvas に 3×5 のドット字（`font.ts`）で描き（`hud.ts`）、日本語が要るキャラ選択・3 択・リザルトは HTML で `retro.css` の `as-` の枠を使い、先へ進むボタン（出発・はじめる・挑戦する・つづける・もう一度・延長戦へ）だけを黄色（`.as-go`）にする。キャラ選択より奥の画面（ステージ・釜・パワーアップ・実績・図鑑・装備・ガチャ・お題）は、左上の「‹ もどる」（`Back.svelte`。スクロールする `.as-screen` の外の帯に置き、一覧を下へ送っても見える）で戻る。リザルトの「もう一度」「キャラ選択へ」も `.as-screen` の外の下の帯に置き、達成した実績はいくつ取っても 1 つの枠にまとめる（`Trophy.svelte`。仲間になった子の帯も持ち、パワーアップの画面と共用）。パワーアップは残りのコインを上に留め、足りない品に「あと N」を、最大の品に MAX を出す。実績の画面は `trophy-groups.ts` の6 つの見出し（「生き延びる」「ステージ」「倒す」「ボス」「育てる」「お店・図鑑・お題」）ごとに達成の数を出し、仲間がもらえる実績に顔（まだの子は灰色の影）を付ける。3 択とリザルトは移動の指の下に出るので、出た直後の合成 click を防ぐ。リザルトは `Survivors.svelte` が最初から聞いている `Settle` で、3 択は `lock.svelte.ts` の `Lock` で止める（出てから 350ms と、出たときに残っていた移動の指が離れてから 350ms。親指をスティックに置いたまま別の指で選べるよう、全部の指が離れるのは待たない）。3 択は盤面の外に置く（盤面の中だと pointerdown で盤面が指をつかみ、click がカードに届かない）。画面が隠れているあいだは時計を進めない。ボスは墓地・雪山・火山では 2:00 と 4:00 に面の 2 体が出て、6:00 と 8:00 に同じ 2 体が攻撃の間を短くして（`rage`）また出る（`stages/forest.ts` の `bossRun()` が作る `bosses`、3 秒前に WARNING）。1 面だけは 6 体が順に出る（2:00 巨大ベア・4:00 女王グモ・6:00 大イノシシ・8:00 大ワシ、面の主は大木のおばけと大ヘビ）。1 面の新しい 4 体の動きは `bosses-forest.ts` で、絵は `art/bosses-forest.ts`（今のボスより大きい）。大イノシシは予告の矢印のあと画面を端から端まで 3 回続けて突進して休み、通ったあとに中で遅くなる土ぼこり（`Hazard` の `mud`）を残す。大ワシは影の予告を出して空へ上がり（`airborne()`、そのあいだは当たらない）、予告の場所へ急降下して羽根（`feather`）を 8 方向にばらまく。大木のおばけはゆっくり近づき、自分の近くに根っこ（`root`）を生やし、2 回に 1 回おばけの手下を出す。大ヘビの体の節は敵の表の `part`（`snakeSeg`）で、敵の入れ物に入れて武器が狙えるようにし、頭が通った道（`Enemy.trail`）の上に並ぶ。節に当たった分は頭の体力を減らし（範囲の一撃が頭と節にまとめて当たっても 1 回、`Enemy.bitten`）、節は倒れず、押し合い・遠くの敵の置き直し・十字架・枠の使い回し・倒した数・図鑑から外す。頭を倒すと節も消える。今の `Enemy` に攻撃の状態を足したもの。2:00〜8:00 のボスと面の主が出ると（延長戦のボスでは出さない）、World の `bossIntro` を `Prompts.intro` が受けてゲームを 2.4 秒止め（`busy`。3 択・宝箱・一時停止も待たせ、時間は端末の dt で進める）、`Prompts.focus()` が返す寄る先へ `draw()` がカメラを動かし（0.6 秒で寄り、1.8 秒から戻る）、足もとの土ぼこりの輪と画面の縁の赤い光（`draw-boss.ts` の `introDust`・`introEdge`）、地響きの音、二つ名（敵の表の `epithet`）と名前の札（`BossIntro.svelte`）を出す。面の主の 2 体は同じ場所の左右に並べて出し（`bosses.ts` の `PAIR_GAP`）、カメラは 2 体のあいだへ寄り、札は「森の主」などの `title` と 2 体の名前を 2 行に出す。登場のあいだも移動の指は置ける。画面は揺らさない。動きを減らす設定ではカメラを動かさず、札だけを 1.2 秒出す。ヌシが出るとゲームは止めず、王冠の上にきらめきを散らし、大きな帯（「ヌシ出現！」、`Prompts.chief`）を出し、画面の外にいるあいだは画面の端に王冠つきの矢印（`draw-events.ts` の `chiefArrows`。宝の地図の矢印と描き方を共用）を出す。動き方と攻撃は `bosses.ts`（雪山の 2 体は `bosses-snow.ts`）にあり、予告（地ならしの輪・突進の矢印・飛びかかりの円・氷の柱の円・息の扇）と飛び道具（糸の玉・転がるほど大きくなる雪玉）は `World.hazards` に置いて、予告が終わってから当たる。大雪男は雪玉と飛びかかりを交互に使い、飛びかかりは自分のいた位置に 1 秒予告してから落ちて、ちび雪だるまを 3 匹出す。宙にいるあいだ（`airborne()`）は武器も体当たりも当たらない。氷の竜は離れて回り込み、自分のまわり 5 か所の氷の柱と、正面の扇の冷たい息（当たると遅くなる）を交互に使う。予告は持ち主が倒れたら消え、息は持ち主の竜の番号で見る。ボスは吹き飛ばされず、押し合いでも押されない。体力は表の値に、その行の `hp`（2:00 は 0.6、4:00 は墓地・雪山・火山が 0.6・1 面が 0.8）と、出る時刻の `toughness` を 1.2 倍にしたもの（`bosses.ts` の `BOSS_HP`）を掛ける（後半のボスが一瞬で溶けないように、遅く出るほど硬い）。倒すと赤い玉と宝箱を落とし、宝箱は吸い寄せずに歩いて拾う。中身は `chest.ts` が持っているものを 1・3・5 つ上げる（釜 2.0 で 8.5・1.3・0.2 割）。武器もパッシブも全部埋まると、3 択と宝箱の中身は限界突破（`limit.ts`）になる。持っている武器（進化形・合体武器・専用進化形も）1 つ × 能力 1 つ（ダメージ +20%・待ち時間 −7% の掛け算・大きさ +10%・速さ +12%（動く攻撃）・時間 +12%（羽根・炎・ツタ）・数 +1（出にくい））を上げ、回数は武器の枠の `limit` に持って、撃つときと合わせ技の数値に `limitStats()` で掛ける。上げるほど伸びが小さくなり（`limitCount` が n 回を n / (1 + (n − 1) / `LIMIT_SOFT`) 回ぶんにする。1 回めは丸ごと効き、`LIMIT_SOFT` 回ぶんを超えない。延長戦で上限なく強くならないように。数だけは 1 回 1 つずつで `AMOUNT_CAP` の 5 まで、上限の武器には数の札を出さない）、札の文は次の 1 回で実際に上がるぶん（`limitGain`。回る武器の待ち時間は「回り終えてからの待ち時間」）を出す（合体武器は 2 つの部品の両方）。上がり幅は 1 つの武器にしか効かないぶん大きめにし、延長戦の伸びをボットで測って決めた。合体するときは 2 つの武器の回数を能力ごとに足して合体武器へ渡す。「最大 HP +10 と全回復」（肉が出ない回は全回復なし。`World.boost` に足すので、パッシブや育ちで能力を作り直しても残る）も同じ候補から引く。限界突破の札は引き直す・飛ばすが使え、除外は出さない。札の文は 3 択と宝箱で共用の `choice-view.ts`、一時停止の武器の並びに上げた回数の合計（`summary` の `lb`）を出し、協力プレイの snap は武器の行に能力ごとの回数を運ぶ。宝箱と 3 択の出し入れは `prompts.svelte.ts` の `Prompts` で、宝箱を先に開ける。武器の種類には、全方向に撃つ `nova`（どんぐり）、足もとに炎を残す `trail`、敵の足もとにツタを生やす `snare` があり、炎とツタは `zones.ts` が中の敵へ 0.5 秒ごとに当て（当たりの時計は武器の枠ごとに、弾と炎で分ける。`Enemy.hit` の後ろ半分、`ZONE_HIT`）、ツタの中の敵を足止めする（`Enemy.root`。ボスも止まるが、攻撃の時計は進む）。爪とダッシュアタックは今の引っかきと弾を数値違いで使い、描き方だけ武器ごとに分ける（`draw-arms.ts`）。強化個体は 2:40 から出る敵の 2% で、`eliteOf()` が表を写して強くし、`bake()` の金色の版を 2 倍で描く。動物は 10 匹で、強さの段（`Animal.tier`、キャラ選択に★の数で出す）が基本・中・強・最強に分かれ、先の面へ進むほど強い仲間が増える。基本の犬・猫・狼は最初から、中のキツネ（森をクリア）・クマ（森の面の主を倒す。記録の `finales`）・ウサギ（合計 20000 体）、強のパンダ（夜の墓地をクリア）・トラ（雪山の大雪男を倒す）、最強の竜の子（id は `drake`、雪山をクリア）・火の鳥のひな（id は `chick`、火山をクリア）は実績のごほうびで仲間になる（実績の id は変えずに条件と動物を書き換えてきたので、古い id の実績にも動物の付かないものがある）。動物ごとの特別な強みは `Animal.bonus` で `stats()` が足す。火の鳥のひなは倒れても一度だけその場で HP 半分でよみがえる（`Animal.rebirths` を `World.rebirths` に写し、`hurtPlayer` が店の復活より先に使う。押し返しはせず 2 秒の無敵）。トラの爪（前後を裂く引っかき）・火の羽根（ブーメランの動き方で、折り返すところに炎を 1 回置く。武器の `flameTurn`）と竜の息（扇型 `cone`。いちばん近い敵の向きへ扇形に吐き、中の敵へまとめて当てる）はその動物だけの武器（`WeaponDef.exclusive`）で、ほかの動物の 3 択に出ず、ふつうの進化も無い。3 段階めに育っていて最初の武器（ふつうの進化形も）が Lv5 になると、その枠が動物ごとの専用進化形（`Animal.special`、`weapons.ts` の `special` と `from`）に入れ替わる。育つとき・武器が上がるとき・ふつうに進化したときに `specials.ts` の `trySpecial()` が見るので、どれが先でも 1 回だけ起きる。専用進化形は段が上の動物ほど強く（同じ型のふつうの進化形のおよそ 1.2・1.35・1.5 倍）、アイコンは金色に赤い王冠、HUD の Lv は ^ の王冠の字になり、作ったものは記録の `evolved` に残る。レベルに要る経験値は Lv10・20・30・40 ごとに伸びを大きくし（`drops.ts` の `xpNeed`）、ボットが店を半分で 9 分ほどで全部埋まるくらいにしている。動物は Lv10 と Lv25 で育ち（`drops.ts` の `GROW_AT`、`World.form`）、絵が `art/animals.ts` の `forms`（16・20・24 ドット。2・3 段階めは `art/grown.ts`）の次の段階に変わって、HP が全快し、段階ごとに攻撃 +10% と最大 HP +20 が `stats()` の 4 つめの引数で入る。名前は `Animal.forms` で、リザルトはその回にいちばん育った姿を出す。育つ瞬間は World の `grow` を `Prompts.evolve` が受けてゲームを 2.6 秒止め（ボスの登場のあと、3 択と宝箱の前。経験値の袋や宝箱で育ったときは、開いている画面を閉じてから。1 フレームで 2 段育てば 1 回で最後の姿まで）、`grow.ts` の `growFrame()` が時間から見せる姿・白い影・まわりの暗さ・はじける光を決め、`draw()` が描く（前の姿と新しい姿の白い影がだんだん速く入れ替わり、1.4 秒で光がはじける）。札（`GrowPlate.svelte`）は「前の姿 → 新しい姿」と強くなったこと。動きを減らす設定では新しい姿と札だけを 1.2 秒出す。大きくなっても足もとの高さはそろえる。遊ぶたびにコインが貯まり、店（パワーアップ、`upgrades.ts`）で 16 品を段ごとに買って永久に強くなる。能力の品は `stats()` の `boost` として動物の基本の値に足し（パッシブを取って作り直すときも `World.boost` を足す）、強欲はその回のコインの合計に、リロールは 3 択の引き直しに、復活は倒れたときに 1 回だけ HP 半分で起き上がるのに使う。コインは床に落ちる品（`coin` と、ボスの大袋 `purse`。どちらの動物からも画面の対角線 3 つぶん以上離れた品は消し、宝箱・券・遺物・大袋は残す）で、ふつうの敵が 3%、強化個体が必ず 5 枚落とし、宝箱とクリアでも入る。1 回が 10 分と短いぶん、1 回のコイン（`coinsOf`、延長戦のぶんも）には `COIN_RATE`（1.5）を掛ける（図鑑・お題・実績のごほうびには掛けない）。実績は `achievements.ts` の 58 個の表で、1 行が条件（記録とその回のまとめを見る純粋な関数。店で買ったときは回のまとめが無い）・コイン・動物を持つ。`grant()` はごほうびの動物で次の実績が満ちることがあるので、増えなくなるまで見る。図鑑（`Book.svelte`。キャラ選択の「図鑑」から開く）は敵・ボス・動物の姿・品のタブで、載せるものの表とごほうびは `book.ts`（`BOOK`。敵は `prop`・`boss`・`metal` でない敵、ボスは `boss` を持つ敵ときらきらハリネズミ）、札の絵と記録の文は `book-view.ts` が作る。その回に倒した敵（強化個体とヌシは元の id で数え、倒した印も付ける）・出てから倒すまでのボスの秒（`Enemy.born`）・育った段階・拾った品（宝箱は拾ったとき、経験値の袋は選んだとき）を World が数えてまとめの `book` に入れ、`record()` が `addBook()` で記録の `book` へ足す。新しく載るたびにコイン（敵と品 10・姿 30・ボス 50）が入ってリザルトに「図鑑 +N」を出し、種類ごとにそろうと実績になる。図鑑の無い古い記録は、倒したボスと仲間の動物の 1 段階めを読むときに載せ、そのぶんのコインは出さない（あとから急にコインが増えないように）。まだ載っていないものは黒い影と「？？？」で出す。記録（いちばん長い生存・撃破の合計・倒したボス・クリア・クリアした動物・開けた宝箱・コイン・店の段・達成した実績・解放した動物・図鑑）は `records.ts` が `asobibako:animal-survivors` に持ち、`record()` が決着したとき（リザルトを待たずに）記録を足して、その回に達成した実績を返す（解放は取り消さない。古い保存は足した項目を 0 と空で読み、壊れた保存や使えない保存でも空の記録で続ける）。自分の周りには壊せるランタン（敵の表の `prop`。狙われず、数えず、動かず押されず、遠くへ離れたら消える。`spawnProps` が 3 秒ごとに画面の外の進む先へ 5 個まで足す）があり、1 回当てると肉・コインの小袋・磁石（経験値の玉を引き寄せる）・金の磁石（3%。強化個体も 5% で落とす。画面のコインを全部引き寄せ、15 秒のコインラッシュのあいだは倒した敵の 1 割がコインを落として勝手に集まる。`World.rush`）・十字架（画面の中のボスとランタン以外を倒す）・時計（6 秒間、敵と予告が止まり、当たっても痛くない。`World.freeze`）のどれかを落とす（`drops.ts` の `dropLoot`。十字架・時計・金の磁石は運で出やすくなる）。10 分で 8000 体ほど倒すので、ふつうの敵が肉を落とすのは 0.3% にとどめ、回復はおもにランタンを壊して取りに行くものにしている。能力には数（`amount`、武器の弾・攻撃の数に足す。遠吠えは前の輪が広がり終えてから次の輪を続けて出し（当たりは輪の生まれた時刻で見るので、続く輪は年齢を負から始める）、炎は足もとのまわりに並べて置く）・時間（`duration`、効く時間に掛ける）・運（`luck`、その確率で 3 択が 4 択になり、コインが落ちやすくなる）があり、パッシブのふたごの毛玉・ながいしっぽ・四つ葉と店が足す（パッシブの最大 Lv は `max`。ふたごの毛玉は 2）。レベルアップの画面の道具は、引き直す・飛ばす（取らずに閉じる）・除外（選んだ札をその回の候補から消して引き直す。`World.banished`）で、回数は店で買い、残りは `Prompts.tools` が画面に写す。Lv5 の武器と対のパッシブ（`evolutions.ts` の 12 組）を持って宝箱を開けると、1 つめの中身が進化になり、同じ枠の武器が進化形（`weapons.ts` の `evolved`。同じ動き方で数値の強い武器で、それ以上は上がらない）に入れ替わる。進化した元の武器と進化形は 3 択に出ない。一部の進化形は当たると HP が戻り（`drain`）、戻せる量は 1 秒に最大 HP の 3% まで（`World.drainLeft`）。進化形の絵は `art/evolved.ts` の `itemArt()` が元の絵を金色にして右上に星を重ね、弾や炎は `goldArt()` の金色で描く。HUD の Lv は ★ になる。作った進化形は記録の `evolved` に残り、実績の画面の進化の表で組み合わせと一緒に見せる。決まった 2 つの武器（`unions.ts` の 6 組。ふつうの 12 種が 1 つずつ入る）がどちらも Lv5（進化形でもよい。専用進化形は除く）で宝箱を開けると、進化のあとに中身の 1 つがまとめになり、1 つめの武器の枠に合体武器（`weapons.ts` の `union`）が入って 2 つめの枠が空く（まとめた 2 つの枠の弾と効果は消し、うしろの枠の番号を詰める）。合体武器は 2 つの武器の進化形を `UNION_BOOST` 倍にした部品（`partDef`）を 1 つの枠から別々の待ち時間（`cd`・`cd2`）で撃ち、2 つめの部品の弾と効果は枠の番号に `PART_B` を足して当たりの時計を分ける。組ごとの合わせ技（`twist`）は、弾や効果が生まれる・当たる・戻るところで `twistAt()` が枠の番号から引いて起こす（芽吹きの森のツタと炎の疾走の炎は、合体武器 1 つにつき 24 個まで。`TWIST_ZONES`。地面に残る炎とツタは、どの武器も枠 1 つにつき 48 個までで、超えたら古いものから消す。`zones.ts` の `ZONE_CAP`）。元の 2 つの武器は 3 択に出さず、HUD の Lv は「+」、作ったものは記録の `evolved` に残して実績の画面の合体の表に出す。面には出来事（`stages/forest.ts` の `events`。墓地は森の表の敵を入れ替えたもの）・ヌシ・ボスのどれかが 45 秒ごとに起き、群れが画面を横切り（`drift` の敵は追わずにまっすぐ進み、抜けたら消えて数えない。遠くの敵の置き直しからも外す）、敵が輪になって迫り、強化個体が片側からまとまって来て（`elites`）、自分の周りにランタンが 8 個灯る（`lanterns`）。危なさと引き換えの出来事もあり（`events.ts`、続く時間は step の中で進めるので 3 択・一時停止・時計では止まる）、宝の地図（`treasure`）は 350〜450 ドット先に 30 秒で消える宝箱を置き、2 行の帯で拾い方を言い、画面の外なら端の矢印に宝箱と残り秒、画面の中なら宝箱の上にはずむ矢印と残り秒を出し（残り 10 秒から明滅。`World.treasure`・`Item.life`、`draw-events.ts`）、間に合わなければ「宝箱が消えてしまった…」の帯を出し、協力プレイで 2 匹がそろっているときは、宝の地図の代わりに重い宝箱（`carry.ts` の `World.carry`）を 2 匹のまん中から 120〜160 ドット先に、祭壇をそこからさらに 250〜300 ドット先に置き、2 匹とも立っていて宝箱から 36 ドット以内にいるあいだだけ宝箱が 2 匹のまん中へ歩く速さの 5.5 割で動く（障害物には入らない）。祭壇に届くと 2 匹それぞれに中身 3 つの宝箱（動物ごとの `big` を `openChest` が見る）とコイン 50 枚、60 秒で間に合わなければ沈んで消える（時計の品では減らない）。絵は `draw-carry.ts`（今の宝箱の 2 倍と地面の光る輪、寄っている動物ごとに半分光る輪）と、画面の端の `carryArrows`。流れ星（`meteor`）は 10 秒のあいだ自分の近くへ予告の円を出して星を落とし、円の中の自分と敵に当てて跡に経験値の玉を残し（`Hazard` の `meteor`）、お祭り（`festival`）は 20 秒のあいだ拾う経験値の玉とコイン 1 枚を 2 倍にし、ふつうの敵の出る数も 2 倍にする（`World.festival`、縁に紙ふぶき）。出来事は同時に出せる数の上限とは別に出し、入れ物の 400 体を越えない。始まると上に小さな帯を出す（`Prompts.notice`）。1:00・3:00・5:00・7:00 には面の表の `chiefs` のヌシ（`chiefOf()` がふつうの敵を 3 倍の大きさにし、王冠を頭のいちばん上に載せて描く。体力は表の値、経験値 20 倍、押されず十字架で消えず、倒すと宝箱）が出る。9:00 は面の主で、その面の 2 体のボスが攻撃を速めていっしょに出る（墓地・雪山・火山は体力 1.5 倍、1 面の新しい 2 体は表の体力のまま。`bossRun()` の最後の 2 行。同じ時刻の行は WARNING を 1 回だけ出し、名前は行の `title` の「森の主」「墓地の主」「雪山の主」）。3 割の回には 2〜8 分のどこかにきらきらハリネズミ（敵の表の `metal`）が 1 匹出る。出るかと時刻は別の乱数で決め（`World.metalAt`。同じ種の回の流れを変えない）、どんな攻撃でも 1 しか減らず（十字架も 1）、逃げて、ゲームの時間で 20 秒たつと去る。倒すと大きな経験値の玉とコインの大袋 2 つを落とし、実績になる。`damageEnemy` に武器の id を渡して武器ごとのダメージと倒した数を数え（`World.dealt`。クリアの一掃は数えない）、リザルトの `DamageTable.svelte` に多い順で出す。BGM は `songs.ts` の 5 曲（キャラ選択などの画面・森・夜の墓地・雪山・ボス戦）を `Survivors.svelte` が `$lib/music/loop.ts` の `Loop` で 0.1 秒ごとに予約して流し、WARNING から予告したボスを全部倒すまで（`Prompts.boss`。予告した数と倒した数で決める）はボス戦の曲、一時停止のあいだは小さくして流し続ける。ボス戦の曲の音は `Loop.warm()` で面の曲のあいだに 1 つずつ作っておく（初めての高さの音の計算が WARNING の瞬間に重ならないように）。10:00 のクリアのあとは「生存成功！」の画面（`OvertimeAsk.svelte`。3 択と同じく `Prompts` が出し入れし、`Lock` で止める）で延長戦へ進むかを選べる。延長戦は `overtime.ts` の `startOvertime()` が World の面の表を写して終わりの時刻を外し、10:00 で終わる出現の行を終わる直前の速さのまま続け、`toughness` と `fury` を `otScale` で強め（1 分ごとに `OT_EARLY` を足す伸びと `OT_GROW` を掛ける伸びの速いほう。序盤は足すほう、27 分ほどから掛けるほうになり、全部そろえたうまいボットでも延長戦 20〜30 分ほどで倒れる）、11:00 から 1 分ごとにその面のボスを出た順に繰り返し出す行（体力 1.5 倍で攻撃を速める。1 面は 6 体、墓地・雪山・火山は 2 体）を足す。出来事・ヌシ・きらきらハリネズミは出ない。コインはすべて `drops.ts` の `addCoins()` を通り、延長戦のあいだは拾った時刻の倍率（`overtimeRate`、1 分ごとに +0.5 で `OVERTIME_MAX` の 4 倍まで、HUD のコインの左に出す）を掛けて `World.overtime.coins` に貯める。倒れると延長戦のぶんは半分になり、一時停止の「引き上げる」（延長戦での「やめる」）と「最初からやり直す」は自分で終えたので全部もらえる（`World.overtime.retreat`、`overtimeCoins`）。HUD のコインは半分にしない数を出す。記録は 10:00 のクリアで 1 回、延長戦の終わりに `overtimeRun()` が作る延長戦の差（宝箱・図鑑。クリアは数えない。倒した数は「1 回で N 体」の実績が回の合計を見るので合計のまま渡し、`killsBefore` を引いて記録に足す）でもう 1 回取り、面ごとの延長戦のいちばん長い秒（記録の `overtime`）を面を選ぶ画面の札とリザルトに出す。キャラ選択は 10 匹の顔のタイル（5 列 × 2 段、まだの子は黒い影）と、選んだ子の詳しい札（`AnimalCard.svelte`。能力の棒・最初の武器・とくい。選び替えても下のボタンが動かないよう、とくいの無い子にも 2 行ぶんの場所を空け、まだの子は同じ行を隠して条件を重ねる）で、タイルを押すと選ぶだけで、札の下の「この子で出発」で進む。どこから押せばよいか迷わないよう、黄色く塗るボタンは出発だけにする（選んでいるタイルの淡い黄色は印）。開いたときは最後に遊んだ動物（記録の `animal`）を選んでいる。記録の `byAnimal` に動物ごとのいちばん長い秒とクリアしたいちばん高い釜の強さを覚え（前の版でクリアしていた子は強さが分からないので「クリア済み」とだけ出す）、クリアした子のタイルにトロフィーの印を、札に「クリア 釜 3.5・最長 10:00」を 1 行で出す。その下のメニュー（`MenuLinks.svelte`）は、よく開くものほど大きく上に置く（色はどれも同じ）。いちばん上に大きくガチャ（券の数と天井までの回数）、次の段にパワーアップと装備、いちばん下に小さく実績と図鑑で、アイコンは `art/menu.ts`。出発のボタンの下には今日のお題を短く出す（`DailyCard.svelte`。動物・ステージ・釜とごほうびだけで、しばりと今日の札は押すと開く `Daily.svelte` で見せる）。お題は `daily.ts` の `makeDaily()` が端末の日付から作った乱数で、仲間の動物 1 匹・選べる面 1 つ・しばり 2 つ（`MODS`。1 つめはうれしい変化でないもの、店の強化なしと武器 1 つだけは重ねない）、そのあとに今日の釜と今日の札を選び（釜と札は動物・面・しばりのあとに引く。釜と札の無いお題は 2.0・札なしで読む）、Survivors には `dailyPick()` が組を作る。その日に初めてキャラ選択を開いたときに `records.ts` の `ensureDaily()` が記録の `daily` に残す（同じ日に仲間や面が増えても変えない）。しばりは `createWorld` の 6 つめの引数（`Challenge`）で受け、面の表を変えるもの（硬さ・攻撃・出る速さ・ボスの体力）は `modStage()` が写した表で、自分にかかるもの（店の強化なし・HP 半分・経験値・攻撃・道具なし）は `modPerks()` で、肉が出ない・武器 1 つだけは `World.mods` を見て `drops.ts`・`chest.ts`・`choices.ts` が効かせる。お題の回は「もう一度」とやり直しも同じお題で、キャラ選択から選んだ回はしばりなし。ごほうびは `dailyBonus()`（`(200 + しばりのコイン) × 面のコインの倍率 × 今日の釜のコインの倍率`、200 以上）で、`record()` がクリアした回のまとめの `daily` を見て、記録のお題と日付が同じでまだクリアしていなければ足し、`paid` を立てる（リザルトに「お題クリア +N」）。クリアした日の数は `dailyDays`。しばりのコインは、ボットで夜の墓地のクリアの割合を比べて決めた。ステージを選ぶと「まじょの釜」（`Cauldron.svelte`、絵は `art/cauldron.ts` で火の色の 3 コマ）で強さ 0.0〜9.0（0.1 刻み、2.0 が表のまま）を選んでから始める。強さから敵の体力（ヌシの体力も）・攻撃（自分が受けるダメージに `hurtPlayer` が掛けるので、ボスの攻撃にも効く）・コインの倍率・宝箱の 3 つ以上の割合・賭けるコインを `cauldron.ts` が出し、`createWorld` の 6 つめの引数（`Options` の `heat`。お題の `challenge`・札の `arcana` と同じまとめで、`Survivors` の選んだ組をそのまま渡す）で受けて `heatStage()` が面の表を写す（コインは面の `coin` に掛けるので延長戦のぶんにも効き、図鑑・お題・実績のごほうびには掛からない）。2.0 より上は賭けがあり（最低 10 枚、9.0 で `MAX_BET` の 6000 枚）、持っているコインを超えては上げられない。「はじめる」で `records.ts` の `payHeat()` が賭けを引いて保存し（足りなければ払える強さまで下げる。もう一度とやり直しも同じ強さで賭け直す）、クリアを記録するときに戻す（倒れた・やめた・アプリが閉じたときは戻らない）。ステージごとのクリアしたいちばん高い強さ（記録の `heat`。2.0 より上ならステージの札に「釜 6.5」）と最後に選んだ強さ（`heatLast`。コインが足りずに下げて始めても、選んだ強さのまま）を覚える。下げて始めた回は、始めに帯「コインが足りないので 釜 X で始めます」を出し（`createWorld` の `note` を `Prompts` が作るときに帯へ写す）、もう一度とやり直しも選んだ強さで払おうとする。お題の回は釜の画面を通らず、日付で決まる今日の釜（2.5・3.0・3.5、賭けなし。ボットでは 3.5 以上が厳しく出たが、遊ぶと 3.0 までは簡単だった）で遊ぶ。つまみはふつうの range で、横向きでは盤面ごと回る。釜ではじめた回は、その回だけルールを変える札（アルカナ、`arcana.ts` の 16 枚。うれしい札 8 枚と、大きく効くかわりに悪いところのある引き換えの札 8 枚。印は `art/arcana.ts`）を、遊び始める前と、4:00・8:00 のボス（面の表の行の `arcana` の印）を倒したときに 3 枚から 1 枚選ぶ（3 枚まで。候補は持っていない開いた札から引き、引き換えが残っていれば 1 枚は引き換え。画面は `ArcanaPick.svelte` を `Prompts.cards` が宝箱より先に出す）。8 枚は実績で開き、開いているかは記録に残さず達成済みの実績から `openArcana()` が決める（前に達成した実績の札ははじめから開いている）。能力の札は `World.boost` に足し、最大 HP 半分は `hpScaleOf()`、肉が出ないは `noMeat()`、回復の倍率は `regenRate()`・`healRate()`、背水の陣は `desperate()` が攻撃に掛け、敵を増やす札は面の表を写す。敵が多いほど経験値とコインが増えるので、敵の数を増やすだけでは悪いところにならない（ボットで確かめた）。持っている札は一時停止とリザルトに並べ（`ArcanaRow.svelte`）、図鑑に札のタブがある。延長戦では出さない。お題の回は、その日に初めてお題を残すときに開いていた札から日付で決まる今日の札を始めの 3 枚選びの代わりに持って始め（`createWorld` が `Challenge.card` を `takeArcana` する）、4:00・8:00 のボスではふつうの回と同じく選ぶ。装備（`gear.ts`）は、あたま・からだ・おまもりに 6 種ずつの 18 品にレア度（ふつう・レア・伝説）が付いたもので、3 か所に 1 つずつつけ、10 匹で共通に効く。能力を 1 つ上げ（伝説が店のその品の最大の半分、レアは 0.65 倍、ふつうは 0.4 倍）、レア以上は特別な効き目（伝説はレアの 2 倍）を持つ。`createWorld` が `Options.gear` を `gearOf()` で能力（`World.boost` に足す）・コイン（`greed`）・効き目の数（`World.fx`）にし、効き目は `damageEnemy`（ボスとヌシへの攻撃）・`hurtPlayer`（出どころ `Hurt` を見てよろい・甲羅・マントが軽くし、当たったあとの無敵、店の復活のあとの不死鳥の羽根）・`power`（鬼のツノ・会心のダメージ）・`drops.ts`（ランタンの品の重み・玉を拾う範囲・肉・時計・育つ Lv）・`openChest`・`choices` の 4 択・吹雪の流され方が読む。お題のしばり「店の強化なし」の日は装備も外す。装備はガチャ（`gacha.ts`）で手に入れ、持ち物（記録の `bag`、品とレア度の組ごとの数、40 個まで）・つけている品（`worn`）・券（`tickets`、銅・銀・金）・天井までの回数（`pity`）を記録に持つ。ガチャは券 1 枚かコイン 500 枚（10 連 4500 枚、1 つ以上はレア以上）で引き、伝説が出ないまま 50 回めは伝説になる。入りきらない引き方は何も払わずに断る。同じ組 3 つで 1 段上へ合成でき、売ると 50・200・800 枚になり、つけている品の数が 0 になればその場所は空く。券はステージの主（2 体の先に倒したほう）が毎回、ほかのボスとヌシが 1/4 で落とし（`drops.ts` の `dropTicket`。乱数はふつうの流れを変えないよう `World.loot`）、種類は釜の強さで決まる（2.0 以下は銅だけ、9.0 で銅 3・銀 5・金 2 割）。宝箱と同じく歩いて拾い（10:00 のクリアで地面に残っている券も持ち帰る）、`summary` と `overtimeRun` が持ち帰る券（クリアと延長戦の引き上げ）と失う券（倒れた・やめた・やり直した）に分け、`record()` が持ち帰る券を足す。延長戦で倒れても、クリアで持ち帰った券は残る。装備の画面（`Gear.svelte`。枠・持ち物の格子 `Bag.svelte`・詳しい札 `GearDetail.svelte`）とガチャの画面（`GachaRoom.svelte`。引き方は `Gacha.svelte` のカードで、天井までのゲージの下に券 3 枚（色・枚数・伝説の確率）とコインの 1 回・10 連を並べ、引けないカードは暗くして `gacha.ts` の `whyNot()` の理由を中に出す）はキャラ選択の別々の口から開く。ガチャの画面の「かくりつ」（`GachaOdds.svelte`）は、券ごとのレア度の割合と 18 種の品 1 つずつの割合を `gacha.ts` の `oddsTable()` から出す（引くときと同じ `ODDS` の表なので、見せる数字と食い違わない）。絵は `art/gear.ts`、レア度は枠の色（`GearIcon.svelte`）。一時停止につけている装備を、リザルト（`RunKit.svelte`）に装備と持ち帰った券・持ち帰れなかった券を出し、一時停止の「やめる」「やり直す」の確かめでは拾った券を持ち帰れないことを言う。売るのは同じ品で 2 回押したときだけ。「最強装備をつける」（`gacha.ts` の `equipBest`）は場所ごとにいちばん高いレア度の品をつけ、同じレア度なら今の品を残す。品には鍵（記録の `locks`。品とレア度の組ごと、数が 0 になれば外れる）をかけられ、鍵つきは売るでもまとめて売るでも売らず、まとめて売るの合成にも使わない（手での合成はできる）。「まとめて売る」（`tidy`）は、3 つそろった品をそろわなくなるまで合成してから（つけていた品を合成したら上がった品をつける）、場所ごとに持っている中でいちばん高いレア度より低い品を売り（つけている品は 1 つ残す）、1 回めに `tidyPreview` の数を見せてもう一度押すと売る。引いたあとは（10 連も）、ガチャガチャの機械の 3D の演出（`Gacha3D.svelte`。ガチャの画面の枠の外に置いて全画面に広げる）を開く。段取りは `gacha-show.ts`（ハンドルを時計回りに 4 分の 3 回すと 1 回転し、カプセルが転がり出て、押すと割れて品を見せる。10 連は 2 段に並び、押すと左から順に割れていき、最後に `GachaList.svelte` で並べる。押した直後は次の押しを受けず、押すと今のカプセルだけを早送りする）。確定演出も段取りが決める。レア以上のカプセルは転がり出たときに光り、伝説があれば回し終えたあとに暗転と金の稲妻（`storm`）。伝説の 4 回に 1 回は昇格（`upgrade`。ひびが入るまで青く光り、稲妻と揺れにはレアとして数える `cue`）。割れ方はレア度の段（`gacha3d-parts.ts` の `TIER`。光の柱・筋・暗い幕・金の粒）で豪華になり、伝説は画面が一瞬白く光る（`GachaHint.svelte`）。音は段取りの出来事（`events`）を `gacha-sounds.ts` が鳴らす。場面は `gacha3d.ts` の `GachaScene`（three は開くときに読み込む。画面の 3 分の 1 の細かさで描いてぼかさずに拡大し、明滅はなめらかに強めて弱める）。指は 1 本だけ追い、ほとんど動かさずに離したら押したことにする。WebGL が作れないときと動きを減らす設定では 2D の並びで見せる。ふたりで遊ぶ（`CoopRoom.svelte`。メニューの「ふたりで遊ぶ」）は、2 人がそれぞれの端末を QR でつなぎ（おえかきのもりと同じ `Handshake.svelte` と `Party`）、つながったあとに 2 人がそれぞれ自分の仲間の動物を選び（`CoopPick.svelte`）、親が今のステージ選びと釜で始める（賭けは親だけ。始めのアルカナも親が選ぶ）。自分の動物にかかわる World の項目（`heroes.ts` の `HERO_KEYS`）は `Hero` にまとめて `World.heroes` に持ち、`w.player` などの今の読み口は `heroes[cur]` への読み書き（`bindHeroes`）なので、1 人のときは今と同じに動く。動物ごとの処理は `eachHero` で `cur` を切り替えて回し、抜けたら元の `cur` に戻す（自分で `cur` を切り替えるループは、終わりで 0 に戻す）。敵・品・玉は近いほうの動物（`nearestHero`）を相手にし、ふつうの敵は出る位置を動物ごとに順に回す。弾と効果の枠の番号は動物をまたいで通しの番号（`cur * HERO_SLOTS + 枠`、武器は `weaponAt`）なので、2 匹の同じ武器が同じ敵の当たりの時計を取り合わない。動物ごとの出来事（被弾・回復・拾った数・育つ・起き上がる）には持ち主（`hero`、`tagged` の並び）が付き、効果と演出は自分の動物のものだけを見せる（`ownEvent`）。経験値・レベル・コイン・ガチャ券は共通で、3 択（`Hero.pending`）と宝箱（`Hero.chests`。拾った動物のもの）は動物ごとにたまり、どちらかに残っているあいだは止まる。2 匹以上のときに HP が尽きた動物は `down` になって動かず撃たず、そばに相棒が 3 秒（`RAISE_SECS`）いると HP 半分で起き上がり（`raise`。倒れた子のまわりに満ちていく輪）、全員が倒れたら終わる。相棒が起こすと 2 匹とも力と風のご利益が 10 秒（`RAISE_BLESS`）増え（自分で起き上がった店の復活・よみがえり・不死鳥の羽根では増えない）、起こしているあいだは 1 秒ごとに高くなる音（出来事 `raising`）、起き上がると両方の画面で粒と「復活！」の帯（`raised`。持ち主を付けないので両方に届き、白く光るのは起きた本人の画面だけ）を出す。相棒の HP が 3 割（`PINCH`）を切るか倒れているあいだは、画面の外なら端の矢印と顔のうしろ、画面の中なら足もとに赤をなめらかに明滅させ（`draw-events.ts` の `partnerArrows`・`pinchRing`）、HUD の HP と連携のゲージの下に相棒の顔と HP の行を出す（ボスの体力バーはそのぶん下げる、`draw-boss.ts` の `barsTop`）。親の端末だけが World を進め（`coop.ts` の `CoopHost`）、子は自分の動物を自分の端末で動かして位置を送り（`CoopGuest.move`。遅さと吹雪は親と同じ式で、遅さは親から届いた値）、親から 1 秒に 20 回届く様子（`snap.ts` の `Snap`。生きているものを親の配列の番号つきの数の列にする。データチャンネルの 1 回の上限 256KB を超えると 2 台が切れるので、弾・効果・玉・品は子の動物のまわり（画面の対角線ぶんの余白）だけを近い順に種類ごと `SNAP_ROWS` まで、ダメージの数字は `SNAP_HITS` の 60 個まで送る）を描く。届いた様子と子の位置は、届いた時刻ではなく送った時刻（`ms`）で少し遅らせてつなぐ（`$lib/net/timeline.ts` の `Timeline`）。子の 3 択と宝箱は親が `cur = 1` で作って送り（`offer`・`rewards`）、子の端末の `Prompts`（`remote`。World を書き換えずに選んだものを親へ送る）が出す。ボスの登場と育つ瞬間は子の端末でも見せる。画面が隠れたら一時停止を頼み、子は選ぶ画面（`Prompts.picking`）のあいだだけ自分の動きを止める（育つ演出とボスの登場のあいだは動ける）。親の ✕ は延長戦を聞く画面では進まないを選ぶ（`coop-quit.ts`）。一時停止はどちらが押しても 2 人とも止まり（`pause`・`resume`。相手には「なかまが とめています」）、止めた人の「つづける」で再開する（止まっていたあいだの子の位置は捨てる）。終わったときは、親が自分の動物のぶんを記録し、子の動物のぶんのまとめ（`coop-run.ts` の `heroRun`。子のまとめでは賭けを戻さない）を送って子が自分の記録に入れ（`recordRun`。延長戦の 2 回めの差も 1 人用と同じ並び）、2 台ともリザルトを出す（`CoopOverlay.svelte`。子の「もう一度」は押せず、親の「もう一度」で 2 人とも同じ動物・ステージ・釜で始める）。延長戦は親が選ぶ。子が「やめる」と親から自分のぶんのまとめが届いてから抜け、子が抜けたり切れたりすると親は子の動物を `gone` にして 1 人で続ける。親が切れたら、子は 10 秒ごとに届く自分のぶんのまとめ（`keep`）の最後を記録して終わる。画面の外に出た相棒は、画面の端に向きの矢印と相棒の顔を出す（`draw-events.ts` の `partnerArrows`）。2 匹が近く（80 ドット以内、`link.ts` の `LINK_NEAR`）で倒した敵で共通のゲージ（`World.link`、HUD の HP の下）がたまり（ヌシ・ボスは多め。技で倒した敵と、片方が倒れている・抜けたときは入らない）、満タンで両方の端末の右端に「いっしょに！」（`LinkButton.svelte`。PC はスペースキー）を出す。指が触れた瞬間に数え、2 人の押しがゲームの時刻で 1.5 秒以内にそろうと（決めるのは親の World の `pressLink`、子は `{ t: 'link' }` を送る。親が止めているあいだの子の押しは数えない）、World が自分で 1 秒止まって（`stepLink`。押しは step の外で起きるので、出来事 `link` は次の step で積む）2 匹の顔の帯（`LinkCutIn.svelte`）を出し、2 匹の半分（`link-halves.ts` の `HALVES`。動物ごとの輪・帯・扇の形）を同時に当てる。ふつうの敵とヌシは倒れ、ボスは最大 HP の 1 割（2 つの半分が両方当たっても 1 回、大ヘビの節は数えない）。出したあと 2 匹とも 2 秒は当たらず、次に要る量は `LINK_GROW` 倍、45 秒は使えない。技の絵は最初の武器の絵を金色で大きく描く（`draw-link.ts`）。協力プレイの回のまとめには `RunSummary.coop`（2 匹それぞれの倒した数・ダメージは `dealt` の合計、相棒を起こした回数 `Hero.raises`、2 人で共通の連携の技の回数と運んだ重い宝箱の数 `World.carried`）が入り、リザルトに「ふたりの活躍」（`CoopStats.svelte`。多いほうに「いちばん倒した」などの称号、`coop-stats.ts`）を出す。2 人とも残って 10:00 をクリアした回だけ、その回のコインに 2 割（`DUO_BONUS`。強欲を掛けたあとの、その端末の動物のコイン）と銅の券 1 枚を足す（延長戦のぶんには掛けない）。記録の `coop`（遊んだ回数・クリア・最長・起こした回数・連携・運んだ数・組み合わせ `pairKey`）は端末ごとに `record()` が足し（60 秒より短い回は数えない、`COOP_MIN_SECS`。延長戦の 2 回めは回とクリアを数えず、`overtimeRun` が延長戦のぶんの差だけを持つ）、ふたりで遊ぶ画面のつなぐ前に記録帳（`CoopBook.svelte`）として出す。実績の見出し「ふたりで」に 5 つ。知らせの版は `COOP_VERSION`（ちがえば `coop-mismatch`。`Party` が `mismatch` を自分の版ちがいに使うので名前を分ける）。遊んでいる最中は左上の「Ⅱ」（PC では Esc か P）で一時停止のメニュー（`Pause.svelte`）を開き、画面が隠れたときも開く（3 択・宝箱の画面のあいだは開かない、`pause.ts`）。一時停止のメニューには持っている札を、うれしい効き目と引き換え（「ただし …」）まで出す（`ArcanaRow.svelte` の `detail`）。「やめる」と「最初からやり直す」は確かめの画面を出し（出てから 350ms は `Lock` で押せない）、倒れたときと同じに記録してから、やめるはリザルトへ、やり直すは同じ動物・同じ面ですぐ始める（リザルトの「もう一度」も同じ）。

-やっぱりカメレオン（`yappari-chameleon`）は、Steam の『めっちゃカメレオン』に寄せたかくれんぼで、2〜3 人がそれぞれの iPad を QR でつないで遊ぶ（`meta.party`、一覧では「ふたりで」に入り、カードに「2〜3にん」を出す）。本家の仕様は `docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md` にまとめてあり、画面の言葉（ペイントモード・3D スポイト・回転ロック・その場で回転・よじ登り・張り付き解除・フリーカメラ など）と大人向けの漢字まじりの字も本家に合わせる。横持ちで遊ぶゲームなので、ゲームの根（`Yappari.svelte`）が自分の `<main class="stage wide">` を持って共通の `.stage` を横向きで回さず、縦持ちのあいだは描画を止めて「横向きにしてください」を出す。入口（`Entry.svelte`）は「なかまを呼ぶ」「なかまに入る」「ひとりで試す」で、ひとりで試すは 1 台で塗る・隠れる・見え方を確かめる画面（`Chameleon.svelte`）を開く。屋敷と人形の 3D を作り、横持ちのあいだだけ描く土台は、その画面とつないで遊ぶ画面（`Online.svelte`）で `stage3d.ts` の `mount3d` を共用し、見た目は `stage3d.css`。人形（`doll.ts`、白い丸い約 5.5 頭身、小さな頭と太い胴と手足、足は丸い先だけ、背 1.15m）は `$lib/sculpt.ts` の 1 枚のなめらかな面を骨で曲げ、部品どうしは同じ軸でつなぐので `FLUSH` は 0。ペイントモードのあいだは右手に虹色のまだらの絵筆を持つ。塗りは体のテクスチャに持つ。三角形を 2 つずつ升に並べた UV（`atlas.ts`。升のふちの外へ色をにじませ、継ぎ目に白い筋が出ないようにする）に、吹き付けを描くシェーダー（`paint-gpu.ts` の `PaintSurface`。`World.render` が毎フレーム `flush()` する。three は `position` の数から描く数を決めるので、吹き付けの UV を `position` に入れる）で、画素の骨で曲げる前の 3D の位置と吹き付けの中心の距離から色を混ぜる（裏を向いた面には付けない）。色は 2048² の sRGB、メタリックとラフネスは 1024²。塗った操作は吹き付けの列（`paint.ts` の `PaintLog`、元に戻すは新しい 30 筆まで）で持ち、元に戻すと WebGL のコンテキストが戻ったときは白から列を当て直す。色のパネル（`PaintPanel.svelte`）は本家の並び（色相と彩度の円盤と彩度・明るさの縦の 2 本、RGBA と HSV、見本、メタリックとラフネス、3D スポイト）で、指が体に触れているあいだは体の表面に筆の半径の輪を出す。指の下の当たりと体の真ん中は、骨で曲げた体を毎回調べずに、ポーズが動いたとき（`PoseAnimator.version` が変わったとき）だけ見えない Mesh（`DollRig.pick`。面の並びが体と同じなので、当たった面から休みの形の位置を引ける）へ焼き直して（`bakePose`）調べる。取り消しの列の 1 本は最初に体へ当たったときに始めるので、体を外した指は何も残さず、取り消しの 2 本めの指も前の筆を消さない。3D スポイトは光が当たる前の色（模様の canvas の画素 × 材質の色。`textures.ts` の `readPick` が `Texture.transformUv` を通した UV で読み、箱は当たった面の材質を面の番号で選ぶ。人形なら塗りのテクスチャ）を取る。動き（`move.ts`）は体を半径 0.2m のカプセル、屋敷を箱と坂にした自前の計算で、壁際のよじ登りで張り付き（上がる・下がる・張り付き解除、壁に沿った赤い輪）、壁を上り切ると天井に張り付き、そのとき体は部屋のほうを向く。向きを変える操作は回転ロックと別にいつでも使え、ロックのあいだは向きを変えずに歩く。カメラの線だけが当たる殻（`Level.shell`）を柱や家具と分け、人形が家具の陰に入ってもカメラは部屋の中に残る（`floorBelow` は天井や壁の高い所からカメラの真下の床を返す）。カメラは三人称で、見る中心からの線（`move.ts` の `thickRayDistance`。中心と、向きに直角な上下左右へ半径 0.12m ずらした 4 本の最短。体は壁から 0.2m 離れて歩くので同じ太さにすると壁ぎわで潰れる。縁の線は始点が壁の中のとき数えない）と、部屋の中と分かっている点からの線の両方で距離の目標を決め、`easeDist` で 1 つの距離にしてなめらかに寄せる（縮むときは速く、壁に最後に押さえられて 0.35 秒たってからゆっくり伸びる。指の手ぶれで戸口の縁に当たったり外れたりしても寄り引きを繰り返さない）。ペイントモードに入っても向き・高さ・距離・画角（60）は歩きのままで、見る中心だけが歩きの位置から体の真ん中へ 0.3 秒ほどでなめらかに移り（`Play` の `#focus`）、出るときも向きと高さを引き継ぐ。距離を飛ばすのはフリーカメラへの出入りだけ。天井に張り付いているあいだは見る中心が天井の 0.4m 下で、上から見ると殻に当たって距離がつぶれるので、歩きのカメラの高さを下向きの範囲（−1.2〜−0.25）に収め（張り付いた瞬間は範囲へなめらかに寄せる）、ペイントに入るときの距離は 1.2m を下限にする。指（`touch.ts`）は左の 45% がスティック、ほかが見回しで、ペイント中は 1 本指で塗り（2 本指のつもりの 1 本めで塗らないよう 80ms か 6px 待ち、2 本めが触れたら 1 本めの跡を取り消す）、置いた所が体の外の 1 本指は塗らずにカメラを回し（歩きの見回しと同じ向きと速さ。体の上か外かは `Play` が置いたときに 1 回だけ `pickBody` で測り、3D スポイトのあいだは外でも離した所で色を取る）、2 本指で回してつまんでズームする。左上の ✕ は確かめ（`QuitConfirm.svelte`。出てから 350ms は押せず、出ているあいだは押していた指を捨てる）を挟み、ひとりで試すでは「戻る」でだけ入口へ戻り（塗った体は消える）、つないで遊ぶあいだは ✕（`Overlay.svelte`）の確かめから「抜ける」で入口へ戻る（親が抜けると全員の試合が終わる）。`pointercancel` はスティックと塗りを戻す。ポーズは本家の輪から 12 種（`poses.ts` の骨ごとの角度、`PoseWheel.svelte` は指を置いたまま滑らせて離すか、開いて押す。指が輪の円盤に入るまで選ばない）。フリーカメラは体を置いたまま一人称（縦 72 度、本家の 16:9 での横 105 度と同じ見え方）で歩き、跳んでも壁には張り付かない。物の陰の自分は、屋敷の材質のシェーダー（`xray.ts`、本家の貫通描画）が自分のまわりを丸い窓で抜いて見せる（ふちだけ点々でぼかす。フリーカメラと張り付いているあいだは抜かない）。屋敷（`mansion/`）は本家のかくれんぼ屋敷の大広間（2 階の回廊・大階段・3 段のシャンデリア・ピアノ・円柱・箔のリボン・風船）と緑の廊下（暗いオリーブに黄緑のダマスクの壁紙・市松の床・ソファ・油絵・本棚）と、戸口（幅 1.5m・高さ 2.4m）でつながる書斎・図書室（大広間の東。北と東の壁一面の本棚・緑の笠のランプの机・地球儀・胸像・木の柱）・キッチン（廊下の北。白いタイル・青い六角タイルの床・ステンレスの台とシンク・肉の棚・ガスボンベ・ダクト・島の台のまわりの黄色い注意線）・ランドリー（廊下の南。赤いれんが・赤と黄色が交互の洗濯機・洗濯ひもの服）の 5 部屋で、書斎・キッチン・ランドリーの点光源は 1 個ずつ（書斎は暖色、キッチンは白、ランドリーは少し暗い）。並びと当たりは `layout.ts`（3 部屋は `rooms.ts`。戸口のある壁は大広間と廊下の壁の裏面 `Slab.back` を部屋の壁に使う）、組み立ては `build.ts`、形は `furniture.ts` と `room-furniture.ts`（部品は `shapes.ts`）、模様は `textures.ts` と `textures-rooms.ts` の canvas（線と目は 2cm 以上）。動かない Mesh は `mansion/merge.ts` の `mergeStatic` が材質と影の付け方ごとに 1 つへまとめて描く回数を減らす（動く物・額の絵・台の縁の光る輪は残し、ロビーと屋敷は別々にまとめる。まとめた 1 つがまたぐと、どちらにいても両方を描くため）。風船・椅子・丸テーブル・ソファ・ベンチ・折りたたみ椅子・本の山・段ボール箱・バケツ・タオルの山・洗濯カートは動く物で、部屋ごとの置き場所の候補（`props.ts` の `SETS`。候補どうし・壁・動かない家具・戸口の通り道 `DOORWAYS`・始める場所にかぶらない）から、親が紹介に入るときに決めた種（`View.seed`。ロビーは null で既定の置き方）で選び、額の絵柄も 4 枚から差し替える。3D は作り直さず、建てるときに全部作っておいて位置と向きと額の材質だけを入れ替え（`World.arrange`）、当たりも種から作り直す（親は `Host` の `levelFor`、中身は `levelOf(mansion(seed))`）。子は最初の様子でも種を当てるので、戻った子と途中で来た子も同じ置き方になる。ひとりで試すの上の「隠れタイム計測」（`HideTimer.svelte`）は本家の HUD の見た目（緑の砂の砂時計・大きな残り秒・「探索開始まで」。ペイントモードは残り秒だけ）で 60 秒を数え、始めたときに画面の中央へ「隠れタイム」を 1 度出し、0 で知らせるだけ。つないで遊ぶときは `src/lib/net/` の `Handshake.svelte` と `Party`（3 台まで、親が中継）でつなぎ、親は子を迎える前に審判（`host.ts` の `Host`）を作り、描画とは別のループ（`Yappari.svelte` の `hosting`）で回す（親が縦持ちにしても試合の時計は進む）。このゲームの版（`CHAMELEON_VERSION`、2）は子が `hi` で送り、ちがえば親が `chameleon-mismatch` で知らせて子が抜ける（`hello` と `mismatch` は `Party` が使う）。審判は試合のルール（`referee.ts`。フェーズ・残り秒・役決め・発見・勝敗・もうええよ・強制挑発の時計・ダブル・ええやん・埋まりの時計・見落としポイントの足し算で、DOM と three を使わない。撃つ間は 2 秒で、親の時計の揺れで間が少し短く見えても `SHOT_SLACK`（0.15 秒）だけ捨てない）を進め、全員の動き（`me`、1 秒に 20 回）と吹き付けの列（`dabs`、0.05 秒ごと。1 つを 13 の数にして 32KB ごとに分ける、`net.ts`）を送った人のほかの全員へ中継する。撃った弾（`shot`）の当たりは親が決める（`shots.ts`）。撃った人の時計を親の時計に直し（`Timeline.offset()`）、隠れる人の体をその時刻から 0.1 秒前までさかのぼって、十字の向きの半角 2 度に開いた 5 本の線と、体の形の表（`dollShapes()`）から作った骨ごとのカプセルと、家具まで含めた屋敷の箱（カメラの殻ではない）と、表面より下を中身とみなした坂（階段は 1 段ずつの塊として描かれるので、弾は段の下へ抜けない）で調べる。カプセルはポーズと張り付きを three なしでたどる（`frames()` と `placement()`。world3d の `placeRoot` も同じ置き方を使う）。来た・戻った子には、全員の体・塗り・見つかったときの体・ダブルの残した体とその塗り・試合の様子をこの順に送り（`Host.welcome`）、子は様子が届くまで自分の動きを送らない（親に残っていた自分の体と塗りを上書きしない）。3D を作るあいだに届いた知らせは、つないだときから `Yappari.svelte` がためて `Session` へ渡す。親は切れた子の番号を覚え（`Party.away`）、上の「よびなおす」（`Invite.svelte`。props は `away`・`open`・`onlink`、ロビーのボタンからも開く）から同じ番号で迎え直す。子は切れると入口に戻り、「もう一度つなぐ」で同じ番号に戻る。各端末では `session.svelte.ts` の `Session` が、届いた様子（`match.svelte.ts` の `Match`）で自分の役（`Play.role` の hider・hunter・watch。ハンターと観戦はフリーカメラの作りを使い、ハンターはしゃがむと目を 0.45m 下げる）を切り替え、ほかの人の体（`remote.ts`。人形と塗りの面を自分の端末に作り、その人の列で塗り直し、送った時刻から 0.1 秒遅らせて動かす）・弾の虹色の筋としぶき（1 試合 60 枚）と砕けた破片と口笛の ♪（`effects.ts`）・一人称の手と銃（`hunter.ts`。`World.overlay` に、屋敷の深さを消してから重ねて描く。銃の握りは `poses.ts` の `AIM` の腕に焼いた位置で、`AIM` を変えたら `gun.ts` も合わせ直す）を出す。答え合わせでは見つかっていない人を赤、見つかった人を青で光らせ（`glow.ts`。体の輪郭をステンシルで抜いた外側のふちと、壁より奥のところだけを描く透かしの 2 枚）、見つかった人の体は見つかった瞬間の姿のまま塗りも含めて置く（`Session` の `#pins`）。ロビーは屋敷と控室から離した 16m 四方・高さ 6m の出口の無い部屋（`mansion/lobby.ts`。白地にアーチの浮き彫りとペンキのしぶきの壁、市松にしぶきの床、しぶきの天井、端の水色の台、天井灯 1 個）で、つないだあとと試合のあとは席ごとの場所（`SPAWNS.lobby`）に出る。まん中の直径 2.4m・高さ 0.3m の赤い丸い台（上面に HUNTER。当たりは乗れる高さの箱 5 つを重ねた多角形）の上に立っている人（`onPodium`。足もとが上面より上で、体の中心が円の内側）を、親（`Host` の `#watch`）が届いた体から決めてハンター希望にし、希望者がいるあいだ台の縁を光らせる。日の光（影は屋敷の全体だけを覆う）はカメラがロビーにあるあいだ強さを 0 にして（`Built.sunless`）、ロビーは天井灯で照らす。試合は紹介 3 秒・隠れタイム・探索・答え合わせで、ロビーと試合の始めは全員の塗りを白に戻し、隠れる人は大広間、ハンターは控室（`mansion/layout.ts` の `ROOM`、屋敷から離した 4m 四方の出口の無い小部屋）へ移り、探索で大広間の南の壁の前（`SPAWNS.entrance`）から一人称で入る。ハンターの「TPS視点」のボタン（押すと「FPS視点」。`HunterButtons.svelte`）で三人称になり、体の右肩の上（`play.svelte.ts` の `TPS_SIDE`・`TPS_LIFT`）を歩きと同じ追い方で見て、自分の体に銃を持たせる（`holdGun`）。右肩の点は壁に寄ると内側へ縮め、カメラの線が家具や壁の中から始まらないようにする。三人称では弾と視野の始まりを、カメラの位置ではなく、十字の線に沿って右肩の点の深さまで進めた点にする（カメラが家具の中に入っても弾が家具の中で止まらず、体の後ろの人にも当たらない。`Session` の `#aim`。筋だけは銃口から引く）。見つかった人は砕け、通常では観戦（`Spectate.svelte`）、増え鬼では破片が消えたあと白い体のハンターになり、ペイントモードのあいだに見つかったらペイントモードを抜ける。マップの設定（`Settings.svelte`）は親の端末の `asobibako:yappari-chameleon:settings`（`prefs.ts`）に覚える。モードは通常・増え鬼・ダブルで、隠れタイムは 120 秒が既定、「ハンターに見逃しランキングを表示」は初めからオン。隠れタイムと答え合わせの下には、全員が押すとすぐ次へ進む「隠れタイムを飛ばす N/M」「ロビーへ戻る N/M」のボタン（`Ready.svelte`。N は押した人数、M はいる人数。ペイントモードのあいだは出さない）を出す。人は席の番号で「プレイヤー1」〜「プレイヤー3」と呼び、ロビーと答え合わせだけ頭の上に札（`Plates.svelte`。答え合わせではええやんの親指と数）を出す。ダブルは最初のハンターがおらず、全員が大広間に隠れてから全員が探す人になり、隠れた体はその場に残す（`referee.ts` の `spot()`・`caught`・`reached`・`champ`。最初にほかの全員の体を見つけた人の勝ち、時間切れは見つけた数の多い人、同じ数なら先にその数に届いた人、誰も見つけていなければ勝者なし。抜けても探す人のままで、戻れば見つけた数を持って続ける。強制挑発は無い）。親は探索に入るとき全員の体とそのときの塗りの列を控え、様子より先に `left` で配る（持ち主は探索の様子を受けると白い体になるので、その前に写させる）。戻った子へは `left` と `leftDabs` で送り直す。残した体は `Session` の `#pins` に置き、撃った弾の的にもする（撃った人の体と、撃った人がもう見つけた体は止めない）。見つけた人の画面からは探索のあいだ消し、答え合わせでは誰かに見つかった体を青、まだの体を赤で光らせる。紹介のモード名はマゼンタ、探索の言葉は全員「全員を見つけよう」、上の人形は全員が赤、探索と答え合わせは左に順位表（`Ranking.svelte`）を出す。見落としポイントは、親が探索のあいだ毎フレーム（`Host` の `#watch`、計算は `oversight.ts`）、ハンターが送る目の位置（`Me.eye`。弾の始まりと同じ点で、三人称でもカメラではなく右肩の点の深さ）から、隠れる人の胴の真ん中か頭が縦 72 度・横の半角 52 度の視野に入り、屋敷の箱に遮られず（弾と同じ `rayLevel`）、直前 0.2 秒に 0.05m 未満しか動かず、15m 以内のとき、1 秒に `10 × (1 − 距離 / 15)` 点を足す（ダブルでは残した体で、自分とすでに見つけた体は数えない）。点は毎フレーム増えるので様子の変わり目には数えず、1 秒ごとの送り直しで配る。マップの設定がオンなら、ハンターの左に「見落とした敵」（`Overlooked.svelte`。点の多い順で、「隠す」で畳める）を出し、答え合わせでは全ハンターの点の合計とその人のいた部屋の名前（`layout.ts` の `placeOf`）を「見落とされた場所」（`Spotted.svelte`）に出す。ええやんは答え合わせのあいだ、隠れた人の自分以外へ 1 試合 1 回（右の一覧 `Iine.svelte`。数は親が数え、通算は持たない）。埋まりすぎは、体の頭か胴の 3 つの円すいの軸の真ん中が屋敷の箱の中にあるとき（`embed.ts`）で、親が隠れタイムと探索のあいだだけ時計を持つ。張り付いた体は、立つ姿より深く面の奥へ出るポーズのぶん（`shots.ts` の `sink`）だけ `placement` が面から離して置くので、張り付いた面から 0.1m 以上入ったときだけ埋まりにする。本人の画面には警告（`EmbedWarning.svelte`）を出し、5 秒続くとハンターの画面にその人の頭の上の赤い下向きの矢印（`markers.ts`。深さを見ずに描いて壁を透かし、揺らすだけで明滅はさせない）を出す。口笛は吹いた人の向きと距離に合わせて `PannerNode` で鳴らす（`sounds.ts`）。BGM はロビー・隠れタイム・探索の 3 曲（`songs.ts`。本家の曲は使わず雰囲気を寄せ、答え合わせはロビーの曲）を、`bgm.ts` の `trackOf` がフェーズから選び、`Online.svelte` が `$lib/music/loop.ts` の `Loop` で流す（ペイントモードのあいだは 0.4 倍）。声は無い。dev では `window.__chameleon` に遊ぶ状態（`Play`）を、つないで遊ぶときは `window.__session` に `Session` も出し、headless の確かめとカードの撮影が使う。
+やっぱりカメレオン（`yappari-chameleon`）は、Steam の『めっちゃカメレオン』に寄せたかくれんぼで、2〜3 人がそれぞれの iPad を QR でつないで遊ぶ（`meta.party`、一覧では「ふたりで」に入り、カードに「2〜3にん」を出す）。本家の仕様は `docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md` にまとめてあり、画面の言葉（ペイントモード・3D スポイト・回転ロック・その場で回転・よじ登り・張り付き解除・フリーカメラ など）と大人向けの漢字まじりの字も本家に合わせる。横持ちで遊ぶゲームなので、ゲームの根（`Yappari.svelte`）が自分の `<main class="stage wide">` を持って共通の `.stage` を横向きで回さず、縦持ちのあいだは描画を止めて「横向きにしてください」を出す。入口（`Entry.svelte`）は「なかまを呼ぶ」「なかまに入る」「ひとりで試す」で、ひとりで試すは 1 台で塗る・隠れる・見え方を確かめる画面（`Chameleon.svelte`）を開く。屋敷と人形の 3D を作り、横持ちのあいだだけ描く土台は、その画面とつないで遊ぶ画面（`Online.svelte`）で `stage3d.ts` の `mount3d` を共用し、見た目は `stage3d.css`。人形（`doll.ts`、白い丸い約 5.5 頭身、小さな頭と太い胴と手足、足は丸い先だけ、背 1.15m）は `$lib/sculpt.ts` の 1 枚のなめらかな面を骨で曲げ、部品どうしは同じ軸でつなぐので `FLUSH` は 0。ペイントモードのあいだは右手に虹色のまだらの絵筆を持つ。塗りは体のテクスチャに持つ。三角形を 2 つずつ升に並べた UV（`atlas.ts`。升のふちの外へ色をにじませ、継ぎ目に白い筋が出ないようにする）に、吹き付けを描くシェーダー（`paint-gpu.ts` の `PaintSurface`。`World.render` が毎フレーム `flush()` する。three は `position` の数から描く数を決めるので、吹き付けの UV を `position` に入れる）で、画素の骨で曲げる前の 3D の位置と吹き付けの中心の距離から色を混ぜる（裏を向いた面には付けない）。色は 2048² の sRGB、メタリックとラフネスは 1024²。塗った操作は吹き付けの列（`paint.ts` の `PaintLog`、元に戻すは新しい 30 筆まで）で持ち、元に戻すと WebGL のコンテキストが戻ったときは白から列を当て直す。色のパネル（`PaintPanel.svelte`）は本家の並び（色相と彩度の円盤と彩度・明るさの縦の 2 本、RGBA と HSV、見本、メタリックとラフネス、3D スポイト）で、指が体に触れているあいだは体の表面に筆の半径の輪を出す。指の下の当たりと体の真ん中は、骨で曲げた体を毎回調べずに、ポーズが動いたとき（`PoseAnimator.version` が変わったとき）だけ見えない Mesh（`DollRig.pick`。面の並びが体と同じなので、当たった面から休みの形の位置を引ける）へ焼き直して（`bakePose`）調べる。取り消しの列の 1 本は最初に体へ当たったときに始めるので、体を外した指は何も残さず、取り消しの 2 本めの指も前の筆を消さない。3D スポイトは光が当たる前の色（模様の canvas の画素 × 材質の色。`textures.ts` の `readPick` が `Texture.transformUv` を通した UV で読み、箱は当たった面の材質を面の番号で選ぶ。人形なら塗りのテクスチャ）を取る。動き（`move.ts`）は体を半径 0.2m のカプセル、屋敷を箱と坂にした自前の計算で、壁際のよじ登りで張り付き（上がる・下がる・張り付き解除、壁に沿った赤い輪）、壁を上り切ると天井に張り付き、そのとき体は部屋のほうを向く。向きを変える操作は回転ロックと別にいつでも使え、ロックのあいだは向きを変えずに歩く。カメラの線だけが当たる殻（`Level.shell`）を柱や家具と分け、人形が家具の陰に入ってもカメラは部屋の中に残る（`floorBelow` は天井や壁の高い所からカメラの真下の床を返す）。カメラは三人称で、見る中心からの線（`move.ts` の `thickRayDistance`。中心と、向きに直角な上下左右へ半径 0.12m ずらした 4 本の最短。体は壁から 0.2m 離れて歩くので同じ太さにすると壁ぎわで潰れる。縁の線は始点が壁の中のとき数えない）と、部屋の中と分かっている点からの線の両方で距離の目標を決め、`easeDist` で 1 つの距離にしてなめらかに寄せる（縮むときは速く、壁に最後に押さえられて 0.35 秒たってからゆっくり伸びる。指の手ぶれで戸口の縁に当たったり外れたりしても寄り引きを繰り返さない）。ペイントモードに入っても向き・高さ・距離・画角（60）は歩きのままで、見る中心だけが歩きの位置から体の真ん中へ 0.3 秒ほどでなめらかに移り（`Play` の `#focus`）、出るときも向きと高さを引き継ぐ。距離を飛ばすのはフリーカメラへの出入りだけ。天井に張り付いているあいだは見る中心が天井の 0.4m 下で、上から見ると殻に当たって距離がつぶれるので、歩きのカメラの高さを下向きの範囲（−1.2〜−0.25）に収め（張り付いた瞬間は範囲へなめらかに寄せる）、ペイントに入るときの距離は 1.2m を下限にする。指（`touch.ts`）は左の 45% がスティック、ほかが見回しで、ペイント中は 1 本指で塗り（2 本指のつもりの 1 本めで塗らないよう 80ms か 6px 待ち、2 本めが触れたら 1 本めの跡を取り消す）、置いた所が体の外の 1 本指は塗らずにカメラを回し（歩きの見回しと同じ向きと速さ。体の上か外かは `Play` が置いたときに 1 回だけ `pickBody` で測り、3D スポイトのあいだは外でも離した所で色を取る）、2 本指で回してつまんでズームする。左上の ✕ は確かめ（`QuitConfirm.svelte`。出てから 350ms は押せず、出ているあいだは押していた指を捨てる）を挟み、ひとりで試すでは「戻る」でだけ入口へ戻り（塗った体は消える）、つないで遊ぶあいだは ✕（`Overlay.svelte`）の確かめから「抜ける」で入口へ戻る（親が抜けると全員の試合が終わる）。`pointercancel` はスティックと塗りを戻す。ポーズは本家の輪から 12 種（`poses.ts` の骨ごとの角度、`PoseWheel.svelte` は指を置いたまま滑らせて離すか、開いて押す。指が輪の円盤に入るまで選ばない）。フリーカメラは体を置いたまま一人称（縦 72 度、本家の 16:9 での横 105 度と同じ見え方）で歩き、跳んでも壁には張り付かない。物の陰の自分は、屋敷の材質のシェーダー（`xray.ts`、本家の貫通描画）が自分のまわりを丸い窓で抜いて見せる（ふちだけ点々でぼかす。フリーカメラと張り付いているあいだは抜かない）。屋敷（`mansion/`）は本家のかくれんぼ屋敷の大広間（2 階の回廊・大階段・3 段のシャンデリア・ピアノ・円柱・箔のリボン・風船）と緑の廊下（暗いオリーブに黄緑のダマスクの壁紙・市松の床・ソファ・油絵・本棚）と、戸口（幅 1.5m・高さ 2.4m）でつながる書斎・図書室（大広間の東。北と東の壁一面の本棚・付け柱と黒い桟のアーチの窓・磨いた赤茶の細い板の床・暗い板張りの天井・緑の笠のランプの机・じゅうたん・地球儀・胸像・木の柱・黒い折りたたみ椅子・赤い革のひじ掛け椅子・橙のしまのランプ）・キッチン（廊下の北。浮き模様の白いタイル・暗い目地の青い六角タイルの床と排水溝・ヘアラインのステンレスの台と脚付きの深い流し・黒い金属の板の棚に置いた霜降りの肉・プロパンのボンベ・レンジ・針金の棚・ダクト・島の台のまわりの黄色い注意線）・ランドリー（廊下の南。暗い赤のダマスクの壁・暗い板張りの天井と梁と 2 列の蛍光灯・壁を埋める赤と黄色が交互の洗濯機・縄と洗濯ばさみで吊るした形のある服・木の台に高く積んだタオル・消火器・掃除機・木の棚・ポスター）の 5 部屋。部屋ごとの暗さと色は `mansion/moods.ts` の表（日・半球の光・映り込み・露出）で、`world3d.ts` がカメラのいる部屋の値へ 0.3 秒ほどで寄せる（どれも uniform なので光の数は変えず、材質も作り直さない。影を落とすのは日だけなので、部屋でも日を 0 にしない）。点光源は書斎とキッチンが 1 個、ランドリーが蛍光灯の列ごとに 2 個。並びと当たりは `layout.ts`（3 部屋は `rooms.ts`。戸口のある壁は大広間と廊下の壁の裏面 `Slab.back` を部屋の壁に使う）、組み立ては `build.ts`、形は `furniture.ts`・`room-furniture.ts`（ロビーと動く物）・部屋ごとの `kitchen.ts`・`laundry.ts`・`study.ts`（部品は `shapes.ts`。光る材質も `shapes.ts` の `glowing` で作り、スポイトの印を持たせる）、模様は `textures.ts` と `textures-rooms.ts` の canvas（線と目は 2cm 以上）。動かない Mesh は `mansion/merge.ts` の `mergeStatic` が材質と影の付け方ごとに 1 つへまとめて描く回数を減らす（動く物・額の絵・台の縁の光る輪は残し、ロビーと屋敷は別々にまとめる。まとめた 1 つがまたぐと、どちらにいても両方を描くため）。`mansion/build.test.ts` は node で canvas を偽物にして屋敷を組み立て、どの材質も透かし窓の効く `MeshStandardMaterial` でスポイトの印を持つこと・まとめたあとの Mesh の数・模様の画素の量・模様の線の太さを見る。風船・椅子・丸テーブル・ソファ・ベンチ・折りたたみ椅子・本の山・段ボール箱・バケツ・タオルの山・洗濯カートは動く物で、部屋ごとの置き場所の候補（`props.ts` の `SETS`。候補どうし・壁・動かない家具・戸口の通り道 `DOORWAYS`・始める場所にかぶらない）から、親が紹介に入るときに決めた種（`View.seed`。ロビーは null で既定の置き方）で選び、額の絵柄も 4 枚から差し替える。3D は作り直さず、建てるときに全部作っておいて位置と向きと額の材質だけを入れ替え（`World.arrange`）、当たりも種から作り直す（親は `Host` の `levelFor`、中身は `levelOf(mansion(seed))`）。子は最初の様子でも種を当てるので、戻った子と途中で来た子も同じ置き方になる。ひとりで試すの上の「隠れタイム計測」（`HideTimer.svelte`）は本家の HUD の見た目（緑の砂の砂時計・大きな残り秒・「探索開始まで」。ペイントモードは残り秒だけ）で 60 秒を数え、始めたときに画面の中央へ「隠れタイム」を 1 度出し、0 で知らせるだけ。つないで遊ぶときは `src/lib/net/` の `Handshake.svelte` と `Party`（3 台まで、親が中継）でつなぎ、親は子を迎える前に審判（`host.ts` の `Host`）を作り、描画とは別のループ（`Yappari.svelte` の `hosting`）で回す（親が縦持ちにしても試合の時計は進む）。このゲームの版（`CHAMELEON_VERSION`、2）は子が `hi` で送り、ちがえば親が `chameleon-mismatch` で知らせて子が抜ける（`hello` と `mismatch` は `Party` が使う）。審判は試合のルール（`referee.ts`。フェーズ・残り秒・役決め・発見・勝敗・もうええよ・強制挑発の時計・ダブル・ええやん・埋まりの時計・見落としポイントの足し算で、DOM と three を使わない。撃つ間は 2 秒で、親の時計の揺れで間が少し短く見えても `SHOT_SLACK`（0.15 秒）だけ捨てない）を進め、全員の動き（`me`、1 秒に 20 回）と吹き付けの列（`dabs`、0.05 秒ごと。1 つを 13 の数にして 32KB ごとに分ける、`net.ts`）を送った人のほかの全員へ中継する。撃った弾（`shot`）の当たりは親が決める（`shots.ts`）。撃った人の時計を親の時計に直し（`Timeline.offset()`）、隠れる人の体をその時刻から 0.1 秒前までさかのぼって、十字の向きの半角 2 度に開いた 5 本の線と、体の形の表（`dollShapes()`）から作った骨ごとのカプセルと、家具まで含めた屋敷の箱（カメラの殻ではない）と、表面より下を中身とみなした坂（階段は 1 段ずつの塊として描かれるので、弾は段の下へ抜けない）で調べる。カプセルはポーズと張り付きを three なしでたどる（`frames()` と `placement()`。world3d の `placeRoot` も同じ置き方を使う）。来た・戻った子には、全員の体・塗り・見つかったときの体・ダブルの残した体とその塗り・試合の様子をこの順に送り（`Host.welcome`）、子は様子が届くまで自分の動きを送らない（親に残っていた自分の体と塗りを上書きしない）。3D を作るあいだに届いた知らせは、つないだときから `Yappari.svelte` がためて `Session` へ渡す。親は切れた子の番号を覚え（`Party.away`）、上の「よびなおす」（`Invite.svelte`。props は `away`・`open`・`onlink`、ロビーのボタンからも開く）から同じ番号で迎え直す。子は切れると入口に戻り、「もう一度つなぐ」で同じ番号に戻る。各端末では `session.svelte.ts` の `Session` が、届いた様子（`match.svelte.ts` の `Match`）で自分の役（`Play.role` の hider・hunter・watch。ハンターと観戦はフリーカメラの作りを使い、ハンターはしゃがむと目を 0.45m 下げる）を切り替え、ほかの人の体（`remote.ts`。人形と塗りの面を自分の端末に作り、その人の列で塗り直し、送った時刻から 0.1 秒遅らせて動かす）・弾の虹色の筋としぶき（1 試合 60 枚）と砕けた破片と口笛の ♪（`effects.ts`）・一人称の手と銃（`hunter.ts`。`World.overlay` に、屋敷の深さを消してから重ねて描く。銃の握りは `poses.ts` の `AIM` の腕に焼いた位置で、`AIM` を変えたら `gun.ts` も合わせ直す）を出す。答え合わせでは見つかっていない人を赤、見つかった人を青で光らせ（`glow.ts`。体の輪郭をステンシルで抜いた外側のふちと、壁より奥のところだけを描く透かしの 2 枚）、見つかった人の体は見つかった瞬間の姿のまま塗りも含めて置く（`Session` の `#pins`）。ロビーは屋敷と控室から離した 16m 四方・高さ 6m の出口の無い部屋（`mansion/lobby.ts`。白地にペンキのしぶきの壁（1 面 16m の模様を、壁ごとにずらし裏返して貼る。`Slab.shift`・`Slab.flip`）と壁から浮き出した白いアーチ、市松にしぶきの床、しぶきの天井、光る輪の付いた端の水色の台、天井灯 1 個）で、つないだあとと試合のあとは席ごとの場所（`SPAWNS.lobby`）に出る。まん中の直径 2.4m・高さ 0.3m の赤い丸い台（上面に HUNTER。当たりは乗れる高さの箱 5 つを重ねた多角形）の上に立っている人（`onPodium`。足もとが上面より上で、体の中心が円の内側）を、親（`Host` の `#watch`）が届いた体から決めてハンター希望にし、希望者がいるあいだ台の縁を光らせる。日の光（影は屋敷の全体だけを覆う）はカメラがロビーにあるあいだ強さを 0 にして（`moods.ts`）、ロビーは天井灯で照らす。試合は紹介 3 秒・隠れタイム・探索・答え合わせで、ロビーと試合の始めは全員の塗りを白に戻し、隠れる人は大広間、ハンターは控室（`mansion/layout.ts` の `ROOM`、屋敷から離した 4m 四方の出口の無い小部屋）へ移り、探索で大広間の南の壁の前（`SPAWNS.entrance`）から一人称で入る。ハンターの「TPS視点」のボタン（押すと「FPS視点」。`HunterButtons.svelte`）で三人称になり、体の右肩の上（`play.svelte.ts` の `TPS_SIDE`・`TPS_LIFT`）を歩きと同じ追い方で見て、自分の体に銃を持たせる（`holdGun`）。右肩の点は壁に寄ると内側へ縮め、カメラの線が家具や壁の中から始まらないようにする。三人称では弾と視野の始まりを、カメラの位置ではなく、十字の線に沿って右肩の点の深さまで進めた点にする（カメラが家具の中に入っても弾が家具の中で止まらず、体の後ろの人にも当たらない。`Session` の `#aim`。筋だけは銃口から引く）。見つかった人は砕け、通常では観戦（`Spectate.svelte`）、増え鬼では破片が消えたあと白い体のハンターになり、ペイントモードのあいだに見つかったらペイントモードを抜ける。マップの設定（`Settings.svelte`）は親の端末の `asobibako:yappari-chameleon:settings`（`prefs.ts`）に覚える。モードは通常・増え鬼・ダブルで、隠れタイムは 120 秒が既定、「ハンターに見逃しランキングを表示」は初めからオン。隠れタイムと答え合わせの下には、全員が押すとすぐ次へ進む「隠れタイムを飛ばす N/M」「ロビーへ戻る N/M」のボタン（`Ready.svelte`。N は押した人数、M はいる人数。ペイントモードのあいだは出さない）を出す。人は席の番号で「プレイヤー1」〜「プレイヤー3」と呼び、ロビーと答え合わせだけ頭の上に札（`Plates.svelte`。答え合わせではええやんの親指と数）を出す。ダブルは最初のハンターがおらず、全員が大広間に隠れてから全員が探す人になり、隠れた体はその場に残す（`referee.ts` の `spot()`・`caught`・`reached`・`champ`。最初にほかの全員の体を見つけた人の勝ち、時間切れは見つけた数の多い人、同じ数なら先にその数に届いた人、誰も見つけていなければ勝者なし。抜けても探す人のままで、戻れば見つけた数を持って続ける。強制挑発は無い）。親は探索に入るとき全員の体とそのときの塗りの列を控え、様子より先に `left` で配る（持ち主は探索の様子を受けると白い体になるので、その前に写させる）。戻った子へは `left` と `leftDabs` で送り直す。残した体は `Session` の `#pins` に置き、撃った弾の的にもする（撃った人の体と、撃った人がもう見つけた体は止めない）。見つけた人の画面からは探索のあいだ消し、答え合わせでは誰かに見つかった体を青、まだの体を赤で光らせる。紹介のモード名はマゼンタ、探索の言葉は全員「全員を見つけよう」、上の人形は全員が赤、探索と答え合わせは左に順位表（`Ranking.svelte`）を出す。見落としポイントは、親が探索のあいだ毎フレーム（`Host` の `#watch`、計算は `oversight.ts`）、ハンターが送る目の位置（`Me.eye`。弾の始まりと同じ点で、三人称でもカメラではなく右肩の点の深さ）から、隠れる人の胴の真ん中か頭が縦 72 度・横の半角 52 度の視野に入り、屋敷の箱に遮られず（弾と同じ `rayLevel`）、直前 0.2 秒に 0.05m 未満しか動かず、15m 以内のとき、1 秒に `10 × (1 − 距離 / 15)` 点を足す（ダブルでは残した体で、自分とすでに見つけた体は数えない）。点は毎フレーム増えるので様子の変わり目には数えず、1 秒ごとの送り直しで配る。マップの設定がオンなら、ハンターの左に「見落とした敵」（`Overlooked.svelte`。点の多い順で、「隠す」で畳める）を出し、答え合わせでは全ハンターの点の合計とその人のいた部屋の名前（`layout.ts` の `placeOf`）を「見落とされた場所」（`Spotted.svelte`）に出す。ええやんは答え合わせのあいだ、隠れた人の自分以外へ 1 試合 1 回（右の一覧 `Iine.svelte`。数は親が数え、通算は持たない）。埋まりすぎは、体の頭か胴の 3 つの円すいの軸の真ん中が屋敷の箱の中にあるとき（`embed.ts`）で、親が隠れタイムと探索のあいだだけ時計を持つ。張り付いた体は、立つ姿より深く面の奥へ出るポーズのぶん（`shots.ts` の `sink`）だけ `placement` が面から離して置くので、張り付いた面から 0.1m 以上入ったときだけ埋まりにする。本人の画面には警告（`EmbedWarning.svelte`）を出し、5 秒続くとハンターの画面にその人の頭の上の赤い下向きの矢印（`markers.ts`。深さを見ずに描いて壁を透かし、揺らすだけで明滅はさせない）を出す。口笛は吹いた人の向きと距離に合わせて `PannerNode` で鳴らす（`sounds.ts`）。BGM はロビー・隠れタイム・探索の 3 曲（`songs.ts`。本家の曲は使わず雰囲気を寄せ、答え合わせはロビーの曲）を、`bgm.ts` の `trackOf` がフェーズから選び、`Online.svelte` が `$lib/music/loop.ts` の `Loop` で流す（ペイントモードのあいだは 0.4 倍）。声は無い。dev では `window.__chameleon` に遊ぶ状態（`Play`）を、つないで遊ぶときは `window.__session` に `Session` も出し、headless の確かめとカードの撮影が使う。

 ## 見た目

```

Run: `pnpm format && pnpm lint`
Expected: PASS（`.md` の textlint の hook も通る）。

- [ ] **Step 4: 全体を確かめる**

Run: `pnpm verify`
Expected: PASS（lint・check・test:run・vitals・build）。

- [ ] **Step 5: 3 ページの通しの試合を通す**

dev サーバー（5180）が動いたままで、Run: `node <scratchpad>/2b/task20/e2e-chameleon-2b.mjs <scratchpad>/polish/e2e`
Expected: 最後に `ok`。ダブル 1 回と増え鬼 1 回が通り、`pageerror` が出ない。

- [ ] **Step 6: コミットする**

```bash
git add CLAUDE.md src/lib/games/yappari-chameleon
git commit -m "Describe the polished rooms and per-room lighting in CLAUDE.md"
```

- [ ] **Step 7: シートを渡す準備**

作業の担当へ、`<scratchpad>/polish/task10/sheet-kitchen.png`・`sheet-laundry.png`・`sheet-study.png`・`sheet-lobby.png` の場所と、Step 1・Step 2 の表と、本家と違って見える点（「決めたこと」の表の六角タイルと壁のタイルの大きさ、作らなかった物、書斎の天井とロビーは本家の画面が無いこと）を返す。ユーザーが戻ったら、シートを見てもらい、iPad で遊んでもらう。

---

## Self-Review

| 見たこと                  | 結果                                                                                                                                                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| spec の部屋ごとの作り込み | キッチン（Task 2〜4）・ランドリー（Task 5〜7）・書斎（Task 8）・ロビー（Task 9）で、spec の表の項目をすべて扱う。ロビーの「しぶきの配置を壁ごとに変える」は模様のずらしと裏返しで、canvas は 1 枚のまま                                  |
| 本家との差の上位 10       | 1 は Task 1 と Task 10、2 と 8 は Task 2、3 は Task 5、4 は Task 6、5 は Task 7、6 と 9 は Task 3、7 は Task 4、10 は Task 8                                                                                                             |
| spec の守ること           | 描く回数（各タスクの測る手順と Task 10 の表）、点光源の数（`rooms.test.ts` の 1〜2 個と Task 10 の 14 個）、スポイトと透かし窓（`build.test.ts`）、遊び方と版（変えない。e2e で確かめる）、テクスチャのメモリ（`build.test.ts` の 32MB） |
| 確かめ方                  | 部屋ごとのシート（各タスクの撮る手順）、描く回数と三角形の表（Task 10）、e2e と `pnpm verify`（Task 10）                                                                                                                                 |
| 計画の試し                | 各タスクの差分を作り込みの前の版（`7c2e4dd`）へ順に当て、タスクごとに落ちるテスト・通るテスト・`pnpm check`・eslint・prettier を確かめた。最後に `pnpm verify` と e2e が通った。数字はそのときの値                                       |
