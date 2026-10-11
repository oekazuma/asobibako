# やっぱりカメレオン プチカメレオン Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 隠れる人が体を 0.5 倍（プチカメレオン）にできるようにする。親がマップの設定で許したときだけ使え、体型はロビーで選ぶ。CPU と遊ぶでは CPU の設定で許すと隠れる CPU が全員プチになる。

**Architecture:** 体型（`normal`・`petit`）は試合の様子（`View.bodies`）に席ごとに親が持ち、子は新しい知らせ `body` で選んだ体型を送る。体の動きの知らせ（`me`）には大きさを載せず、親と各端末は席の体型を様子から引いて、`referee.ts` の `scaleOf`（体型 → 倍率）と `liveScale`（ロビーと隠れる役のあいだだけ体型、ほかは 1）で倍率にする。倍率は `Body.scale`（歩きのカプセル）と `Placeable.scale`（`placement` → 撃たれる当たり・埋まり・見落としの体の点・3D の根元の `scale`）の 1 本の値で流す。吹き付けは骨で曲げる前の体の座標に置くので、筆の半径を倍率で割って屋敷の中の大きさをそろえる。CPU の隠れ場所は同じ表を体型ごとに置き直し（壁の候補だけ壁へ寄せる）、見えにくさの表は体型ごとに測る。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、three 0.186、`src/lib/net/` の `Party`、vitest 4（`unit` は node、`dom` は happy-dom）、playwright-core（headless Chrome で撮る）。

**Spec:** `docs/superpowers/specs/2026-10-12-yappari-chameleon-petit-design.md`（全体の設計は `docs/superpowers/specs/2026-10-08-yappari-chameleon-design.md`、本家の仕様は `docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md`、CPU と遊ぶは `docs/superpowers/specs/2026-10-10-yappari-chameleon-cpu-design.md`）

## Global Constraints

- id は `yappari-chameleon`、フォルダは `src/lib/games/yappari-chameleon/` のまま。ゲームのフォルダの外のゲームを import しない。
- 体型は `normal`（通常）と `petit`（プチカメレオン）の 2 つ。プチの倍率は `PETIT = 0.5`（背 0.575m、歩きの半径 0.1m）。体型 → 倍率は `referee.ts` の `scaleOf` の 1 か所だけで決める。
- 体型は `View.bodies` に席ごとの値として親が持ち、子は知らせ `{ t: 'body', body }` で送る。親はロビーのあいだだけ受ける。許可（`Settings.petit`）がオフのあいだは全員 `normal` として配る。
- 体の動きの知らせ（`me`）には大きさを載せない。親と各端末はその席の体型を様子から引く。
- `net.ts` の `CHAMELEON_VERSION` を 3 から 4 に上げる。`src/lib/net/party.svelte.ts` の `PROTOCOL` は変えない。
- 体型が効くのは、ロビーと隠れる役のあいだだけ（`liveScale`）。ハンターと観戦は通常の体で、増え鬼で見つかってハンターになったら通常の体に戻る。答え合わせの見つかったときの体と、ダブルの残した体は、隠れたときの体型の大きさ（`scaleOf(view.bodies[seat])`）。
- プチの体で 0.5 倍にするのは、見た目（人形の根元の `scale`）・撃たれる当たり（骨ごとのカプセル）・埋まりの判定・見落としの体の点・歩きのカプセルの半径と高さ・張り付きの置き方（`placement` と `sink`）・歩きのカメラの見る中心の高さと距離・ペイントのカメラの距離の範囲。
- 段を上れる高さ（`STEP` 0.3m）・壁際とみなす距離（`NEAR` 0.12m）・歩く速さ・跳ぶ高さ・よじ登りの速さは通常と同じ。埋まりの深さ（`CLING_DEPTH` 0.1m）は屋敷の中の長さなので変えない。
- 塗る筆は屋敷の中で通常と同じ大きさにする。吹き付け（`Dab`）の位置と半径は骨で曲げる前の体の座標なので、プチでは半径を倍率で割る（人の塗りは `Play` の `Stroke`、隠れる CPU は `HiderBrain`）。体の上に出す筆の輪は屋敷の中の大きさのまま。
- マップの設定に「プチカメレオンを許可」（既定はオフ）を足し、`asobibako:yappari-chameleon:settings` に覚える。CPU と遊ぶでは、マップの設定にこの行を出さず、CPU の設定の「プチカメレオン」（許可しない・許可する）で決め、`asobibako:yappari-chameleon:cpu` に覚える。
- ロビーの上の帯に「体型」のボタンを足し、押すたびに「通常」と「プチカメレオン」を切り替える。許可がオフのあいだは押せない形（「体型 通常」）で出す。CPU の設定の画面にも「体型」（通常・プチカメレオン）を置く。選んだ体型は `asobibako:yappari-chameleon:body`（`prefs.ts` の `BODY_KEY`）に覚え、好みなので `src/lib/backup.ts` の「記録あり」に数えない。
- CPU と遊ぶで許可すると、隠れる CPU は全員プチ。CPU の体型は `Host.start` の 3 つめの引数で決め打つ（CPU が送るのは `Bot.step` の中だけなので、`body` の知らせでは始めるのに間に合わない）。探す CPU（`cpu/hunter.ts`）は、小さい体を同じ大きさの体が遠くにいるのと同じ見え方として扱う。怪しさの足し方に使う距離と、届き 30m（`SEARCH_REACH`）の判定を、実効の距離「距離 ÷ その席の倍率」で見る（プチは同じ場所の通常の体の 2 倍遠くにいる扱い）。目立ちの測り方（体の画素のうち色の違う割合）は変えない。
- 隠れる CPU の候補（`cpu/spots.ts` の表）は体型によらず同じで、プチでは壁の候補だけ壁へ半径の差（0.1m）寄せる。見えにくさの表（`cpu/spot-seen.ts` の `SEEN`）は体型ごとに `pnpm spots --body normal|petit` で測り、強さごとの選び方（強い 25%・普通 60%・弱い全部）は同じ。
- 頭脳（`cpu/` の `senses3d.ts` 以外）は DOM と three を import しない。
- 画面の言葉は漢字まじり。「体型」「通常」「プチカメレオン」「プチカメレオンを許可」「許可しない」「許可する」。
- ひとりで試す（`Chameleon.svelte`）は変えない（仕様に無い。`Play.scale` は既定の 1 のまま。`pnpm spots` だけが、測るときに `Play.scale` を直に入れる）。
- コンポーネントは 200 行未満。抑制コメントは使わない。絵文字は使わない。
- コメントは非自明な WHY だけ（隠れた制約・workaround の理由・驚く挙動）を日本語で書く。WHAT・変更履歴・タスク番号は書かない。
- 指は `pointerdown` と `pointerId` で扱う。ロビーの帯と設定の画面のように止まって押すボタンは、今のボタンと同じ `onclick` のまま。
- 各タスクの終わりに `pnpm format` で整えてから `pnpm lint`・`pnpm check`・`pnpm test:run` を通す。最後のタスクで `pnpm verify` を通す。
- コミットのメッセージは英語で、`Co-Authored-By` などの署名の行は付けない。
- ブラウザは built-in browser（`mcp__Claude_Browser__*`）か headless Chrome だけを使い、Claude in Chrome は使わない。dev サーバーは `pnpm dev --port 5180` で起動する。
- 3D の見た目と通しの試合は headless Chrome（`playwright-core`、`channel: 'chrome'`、`--use-angle=metal`）で撮る。撮るスクリプトは scratchpad の `petit/` に置き、リポジトリに入れない。以下 `<scratch>` は `/private/tmp/claude-501/-Users-oekazuma-localRepo-asobibako--claude-worktrees-meccha-chameleon-clone-51ef75/c5be8fad-3695-4b09-b9f3-fe81ce298364/scratchpad`、`<old>` は前のセッションの `/private/tmp/claude-501/-Users-oekazuma-localRepo-asobibako--claude-worktrees-meccha-chameleon-clone-51ef75/ec70cc60-b8f6-4d7c-9a9d-7944e6622daa/scratchpad`。

## Review Focus

1. 端末に覚えた体型と親の様子がずれる。子は `petit` を覚えていても、親が許していなければ親の当たり（弾・埋まり・見落とし）は通常の体で決まる。子が自分の体を覚えた体型で小さくすると、0.1m の半径で壁ぎわに寄れて、親の当たりでは壁に埋まる。`Play.scale` は `Session` が届いた様子から `liveScale` で入れるだけにし、`prefs` から入れない。Task 6 の「許可のない様子では、端末にプチを覚えていても自分の体は 1」で確かめる。
2. 隠れる CPU の体の表面を聞くとき、`Senses3d.surface` は 3D の体の根元が `placement(body).at` から 0.01m 以内かで「体が届いた」とみなす。壁に張り付いたプチの根元は通常より 0.04m 壁寄りなので、大きさを渡さないと null を返し続け、CPU は塗らず、「隠れタイムを飛ばす」も押さず、隠れタイムが終わるまで進まない。床の候補では位置がそろってしまうので、根元の `scale` も比べる。Task 9 の「3D の体が渡した大きさで置かれていれば点を返し、前の大きさのままなら null」で確かめる。
3. 増え鬼で見つかってハンターになったプチの人は、今の体（銃を持つハンター）は 1 で、答え合わせの撃たれた場所の体は 0.5 のまま。ダブルの残した体も、探索で全員が探す人になったあと 0.5 のままで、親の弾の的もその大きさ。役から大きさを引くと、撃たれた場所の体と残した体が大きくなる。Task 4 の「ダブルの残した体もプチの大きさで当たりを決める」と、Task 6 の「増え鬼でハンターになったプチの人は、今の体は 1 で、撃たれた場所の体はプチのまま見せる」で確かめる。
4. 筆の大きさ。吹き付けの位置と半径は骨で曲げる前の体の座標なので、割らずに置くとプチの体の上では屋敷の中の半分の太さになる。人の筆（`Play`）と隠れる CPU の筆（`HiderBrain` の半径と点の間引き）の両方で倍率で割る。Task 5 の「筆は屋敷の中で同じ大きさにするため」と、Task 9 の「プチカメレオンの体は、骨で曲げる前の座標で筆を 2 倍にして」と、Task 10 の通しの試合の吹き付けの半径で確かめる。
5. CPU と遊ぶでプチを許可して始める。CPU が送るのは `Bot.step` の中だけで、`Crew.play` は席に着け終えるとすぐ `Host.start` を呼ぶので、CPU が `body` を送っても届くのは試合が始まったあとで、親は受けない。体型は `Host.start` の 3 つめの引数で決め打つ。あわせて、壁の候補はプチでは壁へ 0.1m 寄せないと面から浮く。Task 10 の「プチカメレオンを許可した探すでは、隠れる CPU は全員プチ」と、Task 9 の「プチの候補は通常と同じ並びで、壁の候補だけ半径の差だけ壁へ寄せ、人形は壁に付く」で確かめる。

---

## ファイルの地図

| ファイル                                                                                                                         | 持つもの                                                                                                                                                         | タスク |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `yappari-chameleon/referee.ts`                                                                                                   | `BodyType`・`BODY_TYPES`・`PETIT`・`Settings.petit`・`Match.bodies`・`View.bodies`・`allow`・`dress`・`bodyIn`・`scaleOf`・`liveScale`・`start` の体型の決め打ち | 1      |
| `yappari-chameleon/move.ts`                                                                                                      | `Body.scale`・`newBody(at, scale)`、半径と高さに大きさを掛ける                                                                                                   | 2      |
| `yappari-chameleon/cpu/paths.test.ts`                                                                                            | プチの体で網の全部の辺を歩ける                                                                                                                                   | 2      |
| `yappari-chameleon/shots.ts`・`embed.ts`・`oversight.ts`                                                                         | `Placeable.scale`・`Placement.scale`、大きさで置く・曲げる・当たりを作る                                                                                         | 3      |
| `yappari-chameleon/host.ts`・`net.ts`                                                                                            | 知らせ `body`・`Host.allow`・`Host.start(settings, hunters?, bodies?)`・当たりに体型の大きさ、版 4                                                               | 4      |
| `yappari-chameleon/play.svelte.ts`・`world3d.ts`                                                                                 | `Play.scale`（体・カメラ・筆）、`placeRoot` の `scale`・張り付きの輪・透かしの窓                                                                                 | 5      |
| `yappari-chameleon/remote.ts`・`session.svelte.ts`                                                                               | `Show.scale`、自分とほかの人の体の大きさ、撃つ的、`Session.dress`・`Session.allow`                                                                               | 6      |
| `yappari-chameleon/prefs.ts`・`cpu/levels.ts`・`src/lib/backup.ts`・`Settings.svelte`                                            | `BODY_KEY`・`readBody`・`saveBody`、`CpuChoice.petit`、記録ありに数えない、「プチカメレオンを許可」の行                                                          | 7      |
| `CpuSetup.svelte`・`Lobby.svelte`・`Entry.svelte`・`Online.svelte`                                                               | 「プチカメレオン」と「体型」の行、ロビーの「体型」のボタン、許可と体型を親へ渡す                                                                                 | 8      |
| `yappari-chameleon/cpu/spots.ts`・`cpu/spot-seen.ts`・`cpu/hider.ts`・`cpu/senses.ts`・`cpu/senses3d.ts`・`scripts/cpu-spots.ts` | `SPOTS_OF`・`pickSpot` の体型、体型ごとの見えにくさの表、CPU の筆の大きさ、体の表面の大きさの照合、`pnpm spots --body`                                           | 9      |
| `yappari-chameleon/cpu/hunter.ts`・`cpu/bot.ts`・`cpu/crew.ts`                                                                   | 探す CPU の体の点と実効の距離、隠れる CPU の体型の候補、CPU の体型の決め打ち                                                                                     | 10     |
| `<scratch>/petit/e2e-petit-2b.mjs`・`<scratch>/petit/e2e-petit-cpu.mjs`                                                          | 3 台の通しの試合・CPU と遊ぶの通しの試合・人形とカメラの絵                                                                                                       | 11     |
| `CLAUDE.md`                                                                                                                      | ゲームの説明                                                                                                                                                     | 12     |

設計で決めたところと、その理由。

- 体型を選んだ記録（`Match.bodies`）は許可がオフでも覚え、配る様子（`View.bodies`）でだけ通常にする。仕様の「オンのときだけ petit を受け付け」は、配る体型がオンのときだけ `petit` になることで満たす。受けた時点で捨てると、親が許可をオンにしたとき、ロビーのボタンでプチを選んでいた子が選び直して送るまで通常のままになり、ボタンの表示と体がずれる。オフに戻すと配る体型は全員 `normal` になる（仕様の確かめ方のとおり）。
- 許可は「始める」で初めて審判へ渡すのではなく、ロビーで選ぶあいだも `Host.allow` で渡す。ロビーの「体型」のボタンが押せるかと、選んだ体型の人形を、始める前から出すため。試合のあいだは `allow` も `dress` も受けない（仕様の「試合のあいだは変えない」）。
- 倍率を掛けるのは `frames`（骨の位置）と `capsules`（形の位置と半径）と `basePlacement`（張り付きのずらし）で、`sink` は通常の体で 1 度測った深さに倍率を掛ける。深さは根元からの長さだけでできているので倍率に比例する。
- 歩きのカメラは見る中心の高さと距離を倍率どおりに縮め、画面の中の体の大きさを通常の体とそろえる（仕様の「体が画面で小さくなりすぎないように」を、いちばん単純な「体に合わせて縮める」で満たす）。観戦のカメラ（ほかの人の体を見る）は今のまま。
- 3D の透かしの窓（`xray`）の半径と深さも倍率を掛ける。カメラの距離が半分になるので、掛けないと窓が画面で 2 倍に開く。
- 探す CPU の体の点（`bodyPoints`）は体型の大きさで測る。通常の体で測ると、プチの頭の 0.5m 上の空中を「見えた」とみなして撃ってしまう。目立ちは体の画素のうち色の違う割合なので、小さい体でも下がらない（Task 9 で測った表の平均は通常 0.409・プチ 0.403）。そこで、小さい体は同じ大きさの体が遠くにいるのと同じ見え方とみなし、怪しさの足し方の距離と届きの判定を「距離 ÷ 倍率」の実効の距離で見る（目立ちの測り方は変えない）。
- 書斎の本棚の上の壁の候補（`wall(17.1, 2.4, 8.95, -1, 0, 'curl')`）は、プチの体が丸まると足が本棚の天板（2.2m）より下へ出て、下へ 0.25m ずらすと当たりの軸が本棚の中に入る。`slack` を 0.2 に下げる（キーは位置とポーズで作るので、表は測り直さなくてよい）。
- 計画を書くときに、Task 1〜10 のコードとテスト（Task 9 の `pnpm spots --body petit` の実測も）を `<scratch>/petit/plan-run/` の写しに当てて通してある（svelte-check・`tsc -p tsconfig.scripts.json`・eslint・markuplint・prettier も）。プチの表は 75 候補すべてで塗れて、目立ちの平均は通常 0.409・プチ 0.403 だった。Task 11 の 2 つの通しの試合のスクリプトは、まだ回していない。
- 計画の中のコードの断片（クラスの中の 1 行・関数の途中の数行など）は、prettier が行の頭の字下げを外している。置く所のまわりのコードの字下げに合わせて入れる。関数・`describe`・`it` を丸ごと書いたものは、そのまま足せる形になっている。
- タスクの並びは、型が先に要る順にした。`Body.scale`（Task 2）が無いと `shots.test.ts` の `body(..., { scale })` が型で落ちるので、歩きを当たりより先にする。`Show.scale` を足すと `Session` が `Show` を作る所が型で落ちるので、`Remote` と `Session` は同じタスク（Task 6）にする。`CpuSetup` の `body` を足すと呼ぶ側が型で落ちるので、`CpuSetup`・`Lobby`・`Entry` は同じタスク（Task 8）にする。

---

### Task 1: 審判の体型と許可

**Files:**

- Modify: `src/lib/games/yappari-chameleon/referee.ts`
- Test: `src/lib/games/yappari-chameleon/referee.test.ts`

**Interfaces:**

- Produces: `type BodyType = 'normal' | 'petit'`、`BODY_TYPES: readonly BodyType[]`、`PETIT = 0.5`。
- Produces: `Settings.petit: boolean`（`DEFAULTS.petit` は false、`fit` は `s.petit === true`）。
- Produces: `Match.bodies: Partial<Record<Seat, BodyType>>`（選んだ記録。許可がオフでも残す）、`View.bodies: Partial<Record<Seat, BodyType>>`（許可がオフなら `{}`）。
- Produces: `allow(m: Match, on: boolean): void`、`dress(m: Match, seat: Seat, body: BodyType): void`（どちらもロビーのあいだだけ効く）、`bodyIn(m: Pick<Match, 'settings' | 'bodies'>, seat: Seat): BodyType`、`scaleOf(body: BodyType | undefined): number`、`liveScale(v: Pick<View, 'phase' | 'roles' | 'bodies'>, seat: Seat): number`。
- Produces: `start(m, members, settings, rand, hunters?, bodies?: Partial<Record<Seat, BodyType>>): void`（`bodies` は選んだ記録に上書きする）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/referee.test.ts` の `./referee` の import を次にする。

```ts
import {
  allow,
  bury,
  DEFAULTS,
  dress,
  fit,
  hiding,
  hit,
  INTRO,
  join,
  leave,
  like,
  liveScale,
  newMatch,
  overlooked,
  PETIT,
  pickHunters,
  ready,
  scaleOf,
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

`describe('fit', ...)` の最初の `it` の 2 行を、`petit` を含めた形にする（`Settings` に `petit` が増えるので、書き並べた設定にも要る）。

```ts
const s = fit(
  { mode: 'normal', hunters: 5, hide: 10, search: 9999, reveal: 30, taunt: 3, overlook: false, petit: false },
  3
);
expect(s).toEqual({
  mode: 'normal',
  hunters: 2,
  hide: 30,
  search: 600,
  reveal: 30,
  taunt: 5,
  overlook: false,
  petit: false
});
```

ファイルの最後に足す。

```ts
describe('体型', () => {
  it('プチカメレオンの許可は既定でオフ。読めない値もオフ', () => {
    expect(DEFAULTS.petit).toBe(false);
    expect(fit({ ...DEFAULTS, petit: 'yes' as unknown as boolean }, 3).petit).toBe(false);
    expect(fit({ ...DEFAULTS, petit: true }, 3).petit).toBe(true);
  });

  it('許可がオフなら petit を配らず、オンにすると配り、オフに戻すと全員 normal', () => {
    const m = newMatch();
    dress(m, 2, 'petit');
    expect(view(m).bodies).toEqual({});
    allow(m, true);
    expect(view(m).bodies).toEqual({ 2: 'petit' });
    dress(m, 3, 'petit');
    dress(m, 2, 'normal');
    expect(view(m).bodies).toEqual({ 2: 'normal', 3: 'petit' });
    allow(m, false);
    expect(view(m).bodies).toEqual({});
  });

  it('体型と許可はロビーのあいだだけ変えられ、試合では始めたときの設定で配る。ロビーへ戻っても選んだ体型は残る', () => {
    const m = newMatch();
    allow(m, true);
    dress(m, 2, 'petit');
    start(m, ALL, { ...DEFAULTS, petit: true }, zero);
    dress(m, 2, 'normal');
    dress(m, 1, 'petit');
    allow(m, false);
    expect(view(m).bodies).toEqual({ 2: 'petit' });
    run(m, 999);
    expect(m.phase).toBe('lobby');
    expect(view(m).bodies).toEqual({ 2: 'petit' });
  });

  it('始めるときの設定で許可がオフなら、ロビーで選んでいても全員 normal で配る', () => {
    const m = newMatch();
    allow(m, true);
    dress(m, 2, 'petit');
    start(m, ALL, { ...DEFAULTS, petit: false }, zero);
    expect(view(m).bodies).toEqual({});
  });

  it('始めるときに渡した体型（CPU の席）は、選んだものより先に効く', () => {
    const m = newMatch();
    dress(m, 2, 'normal');
    start(m, ALL, { ...DEFAULTS, petit: true }, zero, [1], { 2: 'petit', 3: 'petit' });
    expect(view(m).bodies).toEqual({ 2: 'petit', 3: 'petit' });
  });

  it('生きている体の大きさは、ロビーと隠れる役のあいだだけ体型で、ハンターと観戦は 1', () => {
    expect(scaleOf('petit')).toBe(PETIT);
    expect(scaleOf('normal')).toBe(1);
    expect(scaleOf(undefined)).toBe(1);
    const bodies = { 1: 'petit', 2: 'petit', 3: 'petit' } as const;
    expect(liveScale({ phase: 'lobby', roles: {}, bodies }, 1)).toBe(PETIT);
    const roles = { 1: 'hider', 2: 'hunter', 3: 'out' } as const;
    expect(liveScale({ phase: 'search', roles, bodies }, 1)).toBe(PETIT);
    expect(liveScale({ phase: 'search', roles, bodies }, 2)).toBe(1);
    expect(liveScale({ phase: 'search', roles, bodies }, 3)).toBe(1);
    expect(liveScale({ phase: 'search', roles, bodies: {} }, 1)).toBe(1);
  });

  it('増え鬼で見つかってハンターになると通常の体、ダブルの探索では全員が探す人なので通常の体', () => {
    const m = begun({ mode: 'infect', petit: true }, [3]);
    m.bodies = { 1: 'petit', 2: 'petit' };
    run(m, INTRO + 60);
    expect(m.phase).toBe('search');
    expect(liveScale(view(m), 1)).toBe(PETIT);
    hit(m, 1);
    expect(liveScale(view(m), 1)).toBe(1);
    expect(view(m).bodies[1]).toBe('petit');
    const d = begun({ mode: 'double', petit: true }, []);
    d.bodies = { 1: 'petit' };
    expect(liveScale(view(d), 1)).toBe(PETIT);
    run(d, INTRO + 60);
    expect(d.phase).toBe('search');
    expect(liveScale(view(d), 1)).toBe(1);
    expect(view(d).bodies[1]).toBe('petit');
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/referee.test.ts`
Expected: FAIL（`allow`・`dress`・`liveScale`・`PETIT`・`scaleOf` が無く、`fit` が `petit` を返さない）。

- [ ] **Step 3: 体型と許可を referee.ts に足す**

`type Winner` の下に足す。

```ts
/** 体型。petit（プチカメレオン）は人形をそのまま 0.5 倍にした体 */
export type BodyType = 'normal' | 'petit';
export const BODY_TYPES: readonly BodyType[] = ['normal', 'petit'];
export const PETIT = 0.5;
```

`Settings` の `overlook` の下に足す。

```ts
/** プチカメレオンを許可する */
petit: boolean;
```

`DEFAULTS` の `overlook: true` を `overlook: true,` にして、次の行に `petit: false` を足す。`fit` の戻り値の `overlook: s.overlook !== false` を `overlook: s.overlook !== false,` にして、次の行に `petit: s.petit === true` を足す。

`Match` の `spots` の下に足す。

```ts
/**
 * 席ごとに選んだ体型。許可がオフのあいだも選んだものは覚え、配るときに通常にする（許可をオンに戻したとき、
 * 子が選び直して送らなくても選んだ体型に戻る）。ロビーの選びなので、試合と切れた人をまたいで残す
 */
bodies: Partial<Record<Seat, BodyType>>;
```

`newMatch` の最後の `spots: {}` を `spots: {},` にして、次の行に `bodies: {}` を足す。`enter` の `lobby` の `Object.assign` と `start` の `Object.assign` には `bodies` を足さない（ロビーで選んだ体型を試合のあとも残す）。

`start` の頭を次にする（`const double = ...` から下は今のまま）。

```ts
export function start(
  m: Match,
  members: Seat[],
  settings: Settings,
  rand: () => number,
  hunters?: Seat[],
  bodies?: Partial<Record<Seat, BodyType>>
): void {
  const s = fit(settings, members.length);
  Object.assign(m.bodies, bodies);
```

`toot` の前に足す。

```ts
/** プチカメレオンの許可。ロビーのあいだだけ変えられ、試合のあいだは始めたときの設定のまま */
export function allow(m: Match, on: boolean): void {
  if (m.phase === 'lobby') m.settings = { ...m.settings, petit: on };
}

/** 体型を選ぶ。ロビーのあいだだけ受け、試合のあいだは変えない */
export function dress(m: Match, seat: Seat, body: BodyType): void {
  if (m.phase === 'lobby') m.bodies[seat] = body;
}

/** 配る体型。許可がオフなら全員通常 */
export const bodyIn = (m: Pick<Match, 'settings' | 'bodies'>, seat: Seat): BodyType =>
  (m.settings.petit && m.bodies[seat]) || 'normal';

export const scaleOf = (body: BodyType | undefined): number => (body === 'petit' ? PETIT : 1);

/** 席の生きている体の大きさ。体型はロビーと隠れる役のあいだだけ効き、ハンターと観戦（増え鬼でハンターになった人も）は通常の体 */
export const liveScale = (v: Pick<View, 'phase' | 'roles' | 'bodies'>, seat: Seat): number =>
  v.phase === 'lobby' || v.roles[seat] === 'hider' ? scaleOf(v.bodies[seat]) : 1;
```

`View` の `spots` の下に足す。

```ts
/** 体型（許可がオフなら空）。体の動きの知らせには大きさを載せないので、各端末はここから引く */
bodies: Partial<Record<Seat, BodyType>>;
```

`view` の戻り値の `spots: m.spots` を `spots: m.spots,` にして、次の行に足す。

```ts
bodies: m.settings.petit ? { ...m.bodies } : {};
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（今の試合は体型を選ばないので、ほかのテストは変わらない）。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/referee.ts src/lib/games/yappari-chameleon/referee.test.ts
git commit -m "Let the referee keep body types per seat behind a petit permission"
```

---

### Task 2: 歩きの体の大きさ

**Files:**

- Modify: `src/lib/games/yappari-chameleon/move.ts`
- Test: `src/lib/games/yappari-chameleon/move.test.ts`、`src/lib/games/yappari-chameleon/cpu/paths.test.ts`

**Interfaces:**

- Consumes: Task 1 の `PETIT`（テストだけ）。
- Produces: `Body.scale?: number`（無ければ 1）、`newBody(at: V3, scale = 1): Body`（`scale` をいつも入れる）。`step`・`wallNear` は `b.scale` を見る。`floorBelow` は今のまま（体を持たないので通常の半径で床の幅を見る）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/move.test.ts` の `./move` の import に `wallNear` を足す（`thickRayDistance,` の次の行）。

```ts
  thickRayDistance,
  wallNear,
```

ファイルの最後に足す。

```ts
describe('プチカメレオンの体', () => {
  const P = 0.5;

  it('壁の手前で 0.1m 離れて止まり、壁のほうへは通常より 0.1m 近く寄れる', () => {
    const b = newBody([0, 0, 3], P);
    go(b, { z: 1 }, 3);
    expect(b.pos[2]).toBeCloseTo(5 - RADIUS * P, 2);
  });

  it('段を上れる高さは通常と同じで、歩く速さも同じ', () => {
    const b = newBody([-2.5, 0, -4], P);
    go(b, { z: 1 }, 0.8);
    expect(b.pos[1]).toBeCloseTo(0.2, 2);
    const fast = newBody([0, 0, -8], P);
    const slow = newBody([0, 0, -8]);
    go(fast, { x: 1 }, 1);
    go(slow, { x: 1 }, 1);
    expect(fast.pos[0]).toBeCloseTo(slow.pos[0], 5);
  });

  it('通常の体が頭をぶつける低い天井の下にも入れる', () => {
    const low: Level = {
      boxes: [
        { min: [-10, -1, -10], max: [10, 0, 10] },
        { min: [-1, 0.8, 2], max: [1, 1, 4] }
      ],
      ramps: [],
      spawn: [0, 0, 0]
    };
    const walk = (b: ReturnType<typeof newBody>) => {
      for (let t = 0; t < 3; t += 1 / 60) step(b, { ...idle(), z: 1 }, low, 1 / 60);
    };
    const petit = newBody([0, 0, 0], P);
    const full = newBody([0, 0, 0]);
    walk(petit);
    walk(full);
    expect(petit.pos[2]).toBeGreaterThan(4);
    expect(full.pos[2]).toBeCloseTo(2 - RADIUS, 2);
  });

  it('壁に張り付き、上がり続けると天井に張り付き、はなすと床へ戻る', () => {
    const b = newBody([0, 0, 5 - RADIUS * P - 0.05], P);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    expect(b.cling).toEqual({ kind: 'wall', nx: 0, nz: -1 });
    expect(wallNear(b, level, { nx: 0, nz: -1 })).not.toBeNull();
    go(b, {}, 1);
    expect(b.cling?.kind).toBe('wall');
    go(b, { up: true }, 4);
    expect(b.cling).toEqual({ kind: 'ceiling' });
    expect(b.pos[1]).toBeCloseTo(3, 3);
    expect(b.pos[2] + Math.cos(b.yaw) * HEIGHT * P).toBeLessThan(5 - 0.1);
    step(b, { ...idle(), release: true }, level, 1 / 60);
    go(b, {}, 2);
    expect(b.cling).toBe(null);
    expect(b.pos[1]).toBeCloseTo(0, 3);
  });

  it('天井から落ちるとき、下ろす高さはプチの背の高さ', () => {
    const b = { ...newBody([0, 3, 0], P), cling: { kind: 'ceiling' } as const };
    step(b, { ...idle(), release: true }, level, 1 / 60);
    expect(b.pos[1]).toBeCloseTo(3 - HEIGHT * P, 5);
  });
});
```

`src/lib/games/yappari-chameleon/cpu/paths.test.ts` の import に足す（`../move` の次の行）。

```ts
import { PETIT } from '../referee';
```

`walk` を、体の大きさを受けるようにする。

```ts
function walk(lv: Level, from: V3, to: V3, scale = 1): Body {
  const b = newBody(from, scale);
```

`it('どの種の置き方でも、全部の辺を両向きに歩ける', () => {` を次にし、中の `walk(lv, NODES[p], NODES[q])` を `walk(lv, NODES[p], NODES[q], scale)` にする。

```ts
  it.each([
    ['通常', 1],
    ['プチカメレオン', PETIT]
  ])('%sの体で、どの種の置き方でも、全部の辺を両向きに歩ける', (_, scale) => {
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/move.test.ts src/lib/games/yappari-chameleon/cpu/paths.test.ts`
Expected: `プチカメレオンの体` のうち「壁の手前で 0.1m」「低い天井の下」「天井から落ちる」の 3 つが FAIL（`newBody` が大きさを見ず、0.2m で止まる・低い天井の下に入れない・下ろす高さが 1.15m）。ほかの 2 つと網の辺は、今は通常の体で歩くので通る。

- [ ] **Step 3: move.ts の半径と高さに体の大きさを掛ける**

`Body` の `cling` の下に足す。

```ts
  /** 体の大きさ（プチカメレオンは 0.5）。半径と背の高さに掛ける。段を上れる高さ・壁際とみなす距離・速さは変えない */
  scale?: number;
```

`newBody` を次にし、その下に 2 つ足す。

```ts
export const newBody = (at: V3, scale = 1): Body => ({
  pos: [at[0], at[1], at[2]],
  vy: 0,
  yaw: 0,
  ground: false,
  cling: null,
  scale
});

const radiusOf = (b: Body) => RADIUS * (b.scale ?? 1);
const heightOf = (b: Body) => HEIGHT * (b.scale ?? 1);
```

`blocks` の `b.pos[1] + HEIGHT` を `b.pos[1] + heightOf(b)` にする。

`pushOut` の頭に `const r = radiusOf(b);` を足し、中の `RADIUS` の 5 か所（`d >= RADIUS`・`(dx / d) * RADIUS`・`(dz / d) * RADIUS`・`out[0] + RADIUS` の 2 つ）を `r` にする。

`wallNear` の頭に `const r = radiusOf(b);` を足し、`HEIGHT * 0.6` を `heightOf(b) * 0.6` に、`d > RADIUS + NEAR` を `d > r + NEAR` にする。

`groundAt` を、体の半径の 7 割を引数で受けるようにする（`floorBelow` は体を持たないので既定の通常の値のまま）。

```ts
/** 足もとより STEP までの高さにある、いちばん高い床。e は体の半径の 7 割（床の箱のふちから外へ出ても乗っていられる幅） */
function groundAt(lv: Level, x: number, z: number, below: number, e = RADIUS * 0.7): number {
  let g = -Infinity;
```

（`const e = RADIUS * 0.7;` の行は消す。）

`ceilingAt` の `const e = RADIUS * 0.7;` を `const e = radiusOf(b) * 0.7;` にする。

`stepWall` の床を探す行を次の 2 行にし、続きの `HEIGHT` と `RADIUS` を体の大きさにする。

```ts
const r = radiusOf(b);
const floor = groundAt(lv, b.pos[0], b.pos[2], b.pos[1] + 0.01, r * 0.7);
```

```ts
  if (b.pos[1] + heightOf(b) >= ceil) {
```

```ts
b.pos[0] += c.nx * r * 0.5;
b.pos[2] += c.nz * r * 0.5;
```

```ts
b.pos[0] -= c.nx * (r + NEAR + 0.05);
b.pos[2] -= c.nz * (r + NEAR + 0.05);
```

`stepCeiling` の頭に `const h = heightOf(b);` を足し、`b.pos[1] -= HEIGHT;` と、`hang` と `checkHang` の `b.pos[1] - HEIGHT - 0.01` の `HEIGHT` を `h` にする。

`step` の `const parts = ...` の前に `const r = radiusOf(b);` を足し、`parts` の `RADIUS * 0.5` を `r * 0.5` に、ループの中と下の `groundAt(lv, b.pos[0], b.pos[2], b.pos[1] + STEP)` の 2 か所を `groundAt(lv, b.pos[0], b.pos[2], b.pos[1] + STEP, r * 0.7)` にする。天井で止める 2 行を次にする。

```ts
  if (b.pos[1] + heightOf(b) > ceil) {
    b.pos[1] = ceil - heightOf(b);
```

`move.ts` の中で `RADIUS` と `HEIGHT` が残るのは、定数の定義・`radiusOf`・`heightOf`・`groundAt` の既定値だけになる（`grep -n 'RADIUS\|HEIGHT' src/lib/games/yappari-chameleon/move.ts` で確かめる）。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（`newBody` は `scale: 1` を入れるだけなので、今の体は変わらない）。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/move.ts src/lib/games/yappari-chameleon/move.test.ts src/lib/games/yappari-chameleon/cpu/paths.test.ts
git commit -m "Scale the walking capsule by the body size, keeping step height and speed"
```

---

### Task 3: 撃たれる当たり・埋まり・見落としの体の点を体の大きさで

**Files:**

- Modify: `src/lib/games/yappari-chameleon/shots.ts`、`src/lib/games/yappari-chameleon/embed.ts`、`src/lib/games/yappari-chameleon/oversight.ts`
- Test: `src/lib/games/yappari-chameleon/shots.test.ts`、`src/lib/games/yappari-chameleon/embed.test.ts`、`src/lib/games/yappari-chameleon/oversight.test.ts`

**Interfaces:**

- Consumes: Task 2 の `Body.scale`（`Body` はそのまま `Placeable` として渡る）。
- Produces: `Placeable.scale?: number`（無ければ 1）、`Placement.scale: number`。`placement(b)` は張り付きのずらしと `sink` の深さに大きさを掛ける。`frames(pose, place)` と `capsules(pose, place)` は `place.scale` で骨の位置・形の位置・半径を縮める。`sink(pose, kind)` は通常の体の深さのまま。
- Produces: `embedded(lv, b: Pick<Me, 'pos' | 'yaw' | 'cling' | 'pose'> & { scale?: number })`、`bodyPoints(b: Pick<Me, 'pos' | 'yaw' | 'cling' | 'pose'> & { scale?: number })`。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/shots.test.ts` の `describe('frames', ...)` の `places` の並びの最後に、プチの体を 3 つ足し、three の根元にも大きさを入れる。

```ts
      body([2, 3, 1], { yaw: -1.2, cling: { kind: 'ceiling' } }),
      body([1, 0, 2], { yaw: 0.7, scale: 0.5 }),
      body([0, 1.5, 4.9], { yaw: Math.PI, cling: { kind: 'wall', nx: 0, nz: -1 }, scale: 0.5 }),
      body([2, 3, 1], { yaw: -1.2, cling: { kind: 'ceiling' }, scale: 0.5 })
    ];
```

```ts
rig.root.rotation.set(p.tilt, p.yaw, 0);
rig.root.scale.setScalar(p.scale);
rig.root.position.set(...p.at);
```

ファイルの最後に足す。

```ts
describe('プチカメレオンの当たり', () => {
  const P = 0.5;
  const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

  it('骨ごとのカプセルは、根元から見た位置も半径も通常の 0.5 倍', () => {
    for (const b of [
      body([1, 0, 2], { yaw: 0.7 }),
      body([0, 1.5, 4.9], { yaw: Math.PI, cling: { kind: 'wall', nx: 0, nz: -1 } }),
      body([2, 3, 1], { yaw: -1.2, cling: { kind: 'ceiling' } })
    ])
      for (const pose of [STAND, poseById('lie'), poseById('curl')]) {
        const full = placement({ ...b, pose: pose.id });
        const petit = placement({ ...b, pose: pose.id, scale: P });
        const a = capsules(pose, full);
        const c = capsules(pose, petit);
        a.forEach((k, i) => {
          expect(c[i].r).toBeCloseTo(k.r * P, 9);
          const want = sub(k.a, full.at).map((v) => v * P);
          sub(c[i].a, petit.at).forEach((v, j) => expect(v).toBeCloseTo(want[j], 9));
        });
      }
  });

  it('張り付いた体を面から離す量も 0.5 倍で、どのポーズでもプチの立つ体より 0.01m を超えて面の奥へ出ない', () => {
    const wall: Cling = { kind: 'wall', nx: 0, nz: -1 };
    const lie = poseById('lie');
    const pos: V3 = [0, 0.8, 5 - RADIUS * P];
    const moved = placement({ pos, yaw: 0, cling: wall, pose: 'lie', scale: P });
    const plain = placement({ pos, yaw: 0, cling: wall, scale: P });
    expect(plain.at[2]).toBeCloseTo(5 - RADIUS * P + (RADIUS - 0.12) * P, 9);
    expect(plain.at[2] - moved.at[2]).toBeCloseTo((sink(lie, 'wall') - sink(STAND, 'wall')) * P, 9);
    const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const pose of [STAND, AIM, ...POSES]) {
      const caps = capsules(pose, placement({ pos, yaw: 0, cling: wall, pose: pose.id, scale: P }));
      const past = Math.max(0, ...caps.flatMap((c) => [c.a, c.b].map((q) => c.r - dot(sub(q, [0, 0, 5]), [0, 0, -1]))));
      expect(past, pose.id).toBeLessThanOrEqual(sink(STAND, 'wall') * P + 0.01);
    }
  });

  it('通常の体なら胸に当たる高さの弾が、同じ所のプチには当たらず、プチの胸の高さなら当たる', () => {
    const full = [target(2, body([0, 0, 0]))];
    const petit = [target(2, body([0, 0, 0], { scale: P }))];
    expect(hitSeats(room, [0, 0.75, -5], [0, 0.75, 0], full)).toContain(2);
    expect(hitSeats(room, [0, 0.75, -5], [0, 0.75, 0], petit)).toEqual([]);
    expect(hitSeats(room, [0, 0.35, -5], [0, 0.35, 0], petit)).toContain(2);
  });
});
```

`src/lib/games/yappari-chameleon/embed.test.ts` の最後に足す。

```ts
describe('プチカメレオンの埋まり', () => {
  it('0.5 倍の体で調べる。通常の体の頭が入る低い棚の下でも、プチは埋まらない', () => {
    const shelf: Level = { ...level, boxes: [...level.boxes, { min: [-1, 0.8, -1], max: [1, 1.3, 1] }] };
    expect(embedded(shelf, at([0, 0, 0], 'stand'))).toBe(true);
    expect(embedded(shelf, { ...at([0, 0, 0], 'stand'), scale: 0.5 })).toBe(false);
  });

  it('プチが壁や天井に張り付いても、どのポーズでも埋まらない', () => {
    for (const p of ALL) {
      expect(embedded(level, { ...at([0, 0.8, 4.9], p.id, 0, wall), scale: 0.5 }), `壁 ${p.id}`).toBe(false);
      expect(embedded(level, { ...at([0, 3, 0], p.id, 1.2, ceiling), scale: 0.5 }), `天井 ${p.id}`).toBe(false);
    }
  });
});
```

`src/lib/games/yappari-chameleon/oversight.test.ts` の最後の `describe` の中の最後（`体の点は胴の真ん中と頭で、立っていれば頭が上` の次）に足す。

```ts
it('プチカメレオンの体の点は、足もとから 0.5 倍の高さ', () => {
  const [mid, head] = bodyPoints({ pos: [0, 0, 0], yaw: 0, cling: null, pose: 'stand', scale: 0.5 });
  expect(mid[1]).toBeCloseTo(0.7025 / 2, 3);
  expect(head[1]).toBeCloseTo(1.045 / 2, 3);
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/shots.test.ts src/lib/games/yappari-chameleon/embed.test.ts src/lib/games/yappari-chameleon/oversight.test.ts`
Expected: `frames` のプチの置き方と、`プチカメレオンの当たり`・`プチカメレオンの埋まり` の棚・`プチカメレオンの体の点` が FAIL（`placement` が大きさを見ない）。

- [ ] **Step 3: shots.ts に体の大きさを通す**

`Placement` を次にする。

```ts
/** tilt は天井で寝かせる角度（x 軸まわり）。scale は体の大きさ（根元から全体に掛ける） */
export interface Placement {
  at: V3;
  yaw: number;
  tilt: number;
  scale: number;
}
```

`Placeable` の `pose` の下に足す。

```ts
  /** 体の大きさ（プチカメレオンは 0.5）。無ければ 1 */
  scale?: number;
```

`basePlacement` を次にする（このファイルには `scale(a, k)` の関数があるので、変数は `size` にする）。

```ts
function basePlacement(b: Placeable): Placement {
  const [x, y, z] = b.pos;
  const size = b.scale ?? 1;
  if (b.cling?.kind === 'wall') {
    const k = (RADIUS - HALF_DEPTH) * size;
    return { at: [x - b.cling.nx * k, y, z - b.cling.nz * k], yaw: b.yaw, tilt: 0, scale: size };
  }
  // 背中を天井に付け、前を下へ向ける
  if (b.cling?.kind === 'ceiling')
    return { at: [x, y - HALF_DEPTH * size, z], yaw: b.yaw, tilt: Math.PI / 2, scale: size };
  return { at: [x, y, z], yaw: b.yaw, tilt: 0, scale: size };
}
```

`placement` の `const d = ...` を次にする（上のコメントは 2 行にする）。

```ts
// カプセルは見た目より太く、立って張り付いた体でも面の奥へ出るので、立つときの深さを引いて立つ体は面に付けたままにする。
// 深さは体の大きさに比例する（面の上の点も根元のずらしも半径も同じ倍率で縮む）
const d = Math.max(0, sink(poseById(b.pose), b.cling.kind) - sink(STAND, b.cling.kind)) * p.scale;
```

`frames` のループの `out[b] = ...` を次にする。

```ts
out[b] = {
  p: add(from.p, apply(from.r, scale(local, place.scale))),
  r: mul(from.r, mul(rx(e[0]), mul(ry(e[1]), rz(e[2]))))
};
```

`capsules` を次にする。

```ts
export function capsules(pose: Pose, place: Placement): Capsule[] {
  const f = frames(pose, place);
  const k = place.scale;
  const at = (bone: Bone, p: V3) => add(f[bone].p, apply(f[bone].r, scale(sub(p, JOINTS[bone]), k)));
  return SHAPES.map((s) => {
    const bone = s.bone as Bone;
    if (s.cone) return { a: at(bone, s.a), b: at(bone, s.cone.b), r: Math.max(s.cone.ra, s.cone.rb) * k };
    const p = at(bone, s.a);
    return { a: p, b: p, r: Math.max(...(s.ell ?? [0.1, 0.1, 0.1])) * k };
  });
}
```

`sink` は変えない（`basePlacement` に大きさを渡さないので通常の体で測り、控えも通常の体の深さ）。

- [ ] **Step 4: embed.ts と oversight.ts の引数に大きさを足す**

`src/lib/games/yappari-chameleon/embed.ts` の `embedded` の引数を次にする（中は今のまま。`placement(b)` が大きさを見る）。

```ts
export function embedded(lv: Level, b: Pick<Me, 'pos' | 'yaw' | 'cling' | 'pose'> & { scale?: number }): boolean {
```

`src/lib/games/yappari-chameleon/oversight.ts` の `bodyPoints` の引数を次にする。

```ts
export function bodyPoints(b: Pick<Me, 'pos' | 'yaw' | 'cling' | 'pose'> & { scale?: number }): V3[] {
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（大きさを渡さない体は 1 なので、今の当たりと 3D の置き方は変わらない）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/shots.ts src/lib/games/yappari-chameleon/embed.ts src/lib/games/yappari-chameleon/oversight.ts src/lib/games/yappari-chameleon/shots.test.ts src/lib/games/yappari-chameleon/embed.test.ts src/lib/games/yappari-chameleon/oversight.test.ts
git commit -m "Scale hit capsules, cling offsets, embed points and sight points by the body size"
```

---

### Task 4: 審判の口（知らせ body・許可・体型の大きさの当たり）と版 4

**Files:**

- Modify: `src/lib/games/yappari-chameleon/host.ts`、`src/lib/games/yappari-chameleon/net.ts`
- Test: `src/lib/games/yappari-chameleon/host.test.ts`

**Interfaces:**

- Consumes: Task 1 の `allow`・`dress`・`bodyIn`・`scaleOf`・`BODY_TYPES`・`BodyType`・`start` の 6 つめの引数、Task 3 の `Placeable.scale`・`embedded`・`bodyPoints` の `scale`。
- Produces: 知らせ `{ t: 'body', body: BodyType }`（子 → 親。`BODY_TYPES` に無い値は捨てる。ロビーのあいだだけ効く）。
- Produces: `Host.allow(on: boolean): void`、`Host.start(settings: rules.Settings, hunters?: Seat[], bodies?: Partial<Record<Seat, rules.BodyType>>): void`。
- Produces: `CHAMELEON_VERSION = 4`。
- 親の当たり（`#liveTargets`・`#leftTargets`）・埋まり・見落としは、届いた体に `scaleOf(bodyIn(match, seat))` の大きさを付けて調べる（`#sized`）。どれも隠れる人か残した体だけを調べるので、役は見なくてよい。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/host.test.ts` の `describe('Host の中継', ...)` の `it('版のちがう子には知らせ、その子の動きは配らない', ...)` の前に足す。

```ts
it('プチカメレオンの前の子（版 3）は迎えない', () => {
  const { act, told } = setup([1, 2]);
  act({ t: 'leave' }, 2);
  act({ t: 'hi', v: 3 }, 2);
  expect(told.at(-1)).toEqual({ to: 2, m: { t: 'chameleon-mismatch' } });
});
```

ファイルの最後に足す。

```ts
/** 2 がプチカメレオンを選び、台の上の 3 がハンターで、探索まで進める */
function petitSearch(levelFor?: (seed: number | null) => Level) {
  const s = setup([1, 2, 3], levelFor);
  s.host.allow(true);
  s.act({ t: 'body', body: 'petit' }, 2);
  s.act(me(0, [PODIUM.at[0], PODIUM.h, PODIUM.at[2]]), 3);
  s.host.tick(0.1);
  s.host.start({ ...DEFAULTS, mode: 'normal', hide: 60, petit: true });
  for (let i = 0; i < 64 * 10; i++) s.host.tick(0.1);
  expect(lastView(s.told)).toMatchObject({ phase: 'search', bodies: { 2: 'petit' } });
  return s;
}

describe('Host の体型', () => {
  it('許可がオフなら petit を配らず、オンにするとすぐ配り、オフに戻すと全員 normal。知らない体型は捨てる', () => {
    const { act, told, host } = setup();
    act({ t: 'body', body: 'petit' }, 2);
    expect(lastView(told).bodies).toEqual({});
    host.allow(true);
    expect(lastView(told).bodies).toEqual({ 2: 'petit' });
    act({ t: 'body', body: 'giant' }, 3);
    act({ t: 'body', body: 'petit' }, 1);
    expect(lastView(told).bodies).toEqual({ 1: 'petit', 2: 'petit' });
    host.allow(false);
    expect(lastView(told).bodies).toEqual({});
  });

  it('試合のあいだは体型も許可も変わらず、来た子には様子で体型を送る', () => {
    const { act, told, host } = petitSearch();
    act({ t: 'body', body: 'normal' }, 2);
    host.allow(false);
    expect(lastView(told).bodies).toEqual({ 2: 'petit' });
    told.length = 0;
    host.welcome(3);
    const mine = told.filter((x) => x.to === 3 && x.m.t === 'phase');
    expect((mine.at(-1)!.m.view as View).bodies).toEqual({ 2: 'petit' });
  });

  it('始めるときに渡した体型（CPU の席）で配る', () => {
    const { told, host } = setup();
    host.start({ ...DEFAULTS, mode: 'normal', petit: true }, [1], { 2: 'petit', 3: 'petit' });
    expect(lastView(told).bodies).toEqual({ 2: 'petit', 3: 'petit' });
  });

  it('通常の体なら胸に当たる高さの弾は、プチには当たらず、プチの胸の高さなら当たる', () => {
    const { act, told, host } = petitSearch();
    act(me(0, [0, 0, 5]), 2);
    act(me(0, [0, 0, 0]), 3);
    act({ ...SHOT, ms: 0 }, 3);
    expect(of(told, 'found')).toEqual([]);
    host.tick(2.1);
    act({ ...SHOT, o: [0, 0.35, 0], ms: 2100 }, 3);
    expect(of(told, 'found')[0]).toMatchObject({ seat: 2, by: 3 });
  });

  it('埋まりはプチの体で調べる（通常の体の頭が入る棚の下でも埋まらない）', () => {
    const shelf: Level = {
      boxes: [...floor.boxes, { min: [-1, 0.8, 4.5], max: [1, 1.3, 5.5] }],
      ramps: [],
      spawn: [0, 0, 0]
    };
    const s = petitSearch(() => shelf);
    hold(s, 1, [[2, me(0, [0, 0, 5])]]);
    expect(lastView(s.told).buried).toEqual([]);
    const full = searching({ mode: 'normal' }, () => shelf);
    hold(full, 1, [[2, me(0, [0, 0, 5])]]);
    expect(lastView(full.told).buried).toEqual([2]);
  });

  it('見落としポイントはプチの体の点で測る（低い壁の向こうのプチの頭は見えない）', () => {
    const low: Level = {
      boxes: [...floor.boxes, { min: [-5, 0, 3], max: [5, 0.8, 3.3] }],
      ramps: [],
      spawn: [0, 0, 0]
    };
    const hunter = me(0, [0, 0, 0], { pose: AIM.id, look: [0, 0], eye: [0, 1, 0] });
    const s = petitSearch(() => low);
    hold(s, 1, [
      [2, me(0, [0, 0, 5])],
      [3, hunter]
    ]);
    expect(s.host.match.overlook[3]?.[2] ?? 0).toBe(0);
    const full = searching({ mode: 'normal' }, () => low);
    hold(full, 1, [
      [2, me(0, [0, 0, 5])],
      [3, hunter]
    ]);
    expect(full.host.match.overlook[3]?.[2] ?? 0).toBeGreaterThan(0);
  });

  it('ダブルの残した体もプチの大きさで当たりを決める（胸の高さの弾はプチの上を抜けて奥の体に当たる）', () => {
    const s = setup();
    s.host.allow(true);
    s.act({ t: 'body', body: 'petit' }, 1);
    s.host.start({ ...DEFAULTS, mode: 'double', hide: 60, petit: true });
    s.act(me(0, [0, 0, 5]), 1);
    s.act(me(0, [0, 0, 8]), 2);
    s.act(me(0, [0, 0, 2]), 3);
    for (let i = 0; i < 64 * 10; i++) s.host.tick(0.1);
    s.act(me(0, [0, 0, 0]), 3);
    s.act({ ...SHOT, ms: 0 }, 3);
    expect(of(s.told, 'found').map((m) => m.seat)).toEqual([2]);
    s.host.tick(2.1);
    s.act({ ...SHOT, o: [0, 0.35, 0], ms: 2100 }, 3);
    expect(of(s.told, 'found').map((m) => m.seat)).toEqual([2, 1]);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/host.test.ts`
Expected: FAIL（`Host.allow` が無く、`body` の知らせを受けず、版 3 を迎える）。

- [ ] **Step 3: 版を 4 にする**

`src/lib/games/yappari-chameleon/net.ts` の `export const CHAMELEON_VERSION = 3;` を `export const CHAMELEON_VERSION = 4;` にする。

- [ ] **Step 4: host.ts に知らせ body と許可と体型の大きさを足す**

`start` を次にし、その下に `allow` を足す。

```ts
  /** bodies は始めるときに決め打つ体型（CPU の席）。子が送る body の知らせより先に効く */
  start(settings: rules.Settings, hunters?: Seat[], bodies?: Partial<Record<Seat, rules.BodyType>>): void {
    if (this.match.phase !== 'lobby' || this.#port.members.length < 2) return;
    rules.start(this.match, [...this.#port.members], settings, this.#rand, hunters, bodies);
    this.#push(true);
  }

  /** プチカメレオンの許可（親のマップの設定）。ロビーのあいだに変えると、すぐ全員の体型に効く */
  allow(on: boolean): void {
    rules.allow(this.match, on);
    this.#push(false);
  }
```

`#act` の `} else if (m.t === 'taunt') {` の前に足す（`#greeted` の確かめより下なので、迎えていない子の体型は受けない）。

```ts
    } else if (m.t === 'body') {
      if (rules.BODY_TYPES.includes(m.body as rules.BodyType)) {
        rules.dress(this.match, from, m.body as rules.BodyType);
        this.#push(false);
      }
```

`#watch` の 2 か所を、大きさを付けた体で調べるようにする。

```ts
for (const b of bodies)
  rules.bury(m, b.seat, this.#port.members.includes(b.seat) && embedded(this.#level, this.#sized(b)), dt);
```

```ts
const d = sight(this.#level, viewer, bodyPoints(this.#sized(b)));
```

`#hidden` の前に足す。

```ts
  /** 隠れている体に、その人の体型の大きさを付ける（届いた体の様子には大きさが無い） */
  #sized(b: { seat: Seat; body: Me }): Me & { scale: number } {
    return { ...b.body, scale: rules.scaleOf(rules.bodyIn(this.match, b.seat)) };
  }
```

`#liveTargets` の `const me = lerpMe(s.a, s.b, s.t);` を次にする。

```ts
const me = this.#sized({ seat, body: lerpMe(s.a, s.b, s.t) });
```

`#leftTargets` の `.map(...)` を次にする。

```ts
      .map(([seat, l]) => ({
        seat,
        caps: capsules(poseById(l.body.pose), placement(this.#sized({ seat, body: l.body })))
      }));
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（版を送るテストは `CHAMELEON_VERSION` を読むので、版 4 でも通る）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/host.ts src/lib/games/yappari-chameleon/net.ts src/lib/games/yappari-chameleon/host.test.ts
git commit -m "Accept body messages in the lobby, relay the petit permission, and hit-test hiders at their body size"
```

---

### Task 5: 自分の体と 3D の人形の大きさ

**Files:**

- Modify: `src/lib/games/yappari-chameleon/play.svelte.ts`、`src/lib/games/yappari-chameleon/world3d.ts`
- Test: `src/lib/games/yappari-chameleon/play.svelte.test.ts`、`src/lib/games/yappari-chameleon/shots.test.ts`

**Interfaces:**

- Consumes: Task 2 の `newBody(at, scale)`・`Body.scale`、Task 3 の `Placement.scale`。
- Produces: `Play.scale: number`（getter と setter。既定 1。入れると `body.scale` も変える。`placeAt` は今の大きさで体を作る）。`Play` は大きさを、歩き（`step`）・人形の置き方（`placeDoll`）・歩きのカメラ（見る中心の高さ 0.85・天井では −0.4 と、距離 2.4 と、部屋の中の点の ±0.4 に掛ける）・ペイントのカメラの距離の範囲（0.5〜3.5 と入るときの下限 1.2 に掛ける）・筆（`Stroke` の半径を割る）に使う。ハンターの一人称と三人称・観戦・フリーカメラの体（`ghost`）は 1 のまま。
- Produces: `placeRoot(root, b)` は根元に `root.scale.setScalar(placement(b).scale)` を入れる。`World.placeDoll` の張り付きの輪は大きさで縮めて体の真ん中の高さ（0.58 × 大きさ）に置き、`World.xray` の窓の半径と深さに根元の大きさを掛ける。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/play.svelte.test.ts` の最後に足す（`RADIUS` と `stroke` と `secs` はこのファイルにすでにある）。

```ts
describe('Play のプチカメレオン', () => {
  const follows = (w: World) => vi.mocked(w.follow).mock.calls;

  it('体の大きさを体と人形の置き方に付け、置き直しても保つ', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.scale = 0.5;
    expect(p.body.scale).toBe(0.5);
    p.placeAt([1, 0, 1]);
    expect(p.body.scale).toBe(0.5);
    secs(p, 0.1);
    expect(vi.mocked(w.placeDoll).mock.calls.at(-1)![0]).toMatchObject({ scale: 0.5 });
    p.scale = 1;
    expect(p.body.scale).toBe(1);
  });

  it('壁の手前では、プチの半径だけ離れて止まる', () => {
    const p = new Play(fakeWorld(), 70);
    p.scale = 0.5;
    p.placeAt([0, 0, 3]);
    p.pad.stick.y = -1;
    secs(p, 3);
    expect(p.body.pos[2]).toBeCloseTo(5 - RADIUS * 0.5, 2);
  });

  it('歩きのカメラは、見る中心の高さと距離を体の大きさに合わせて縮める', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.scale = 0.5;
    secs(p, 1);
    const [target, , , dist, , , inside] = follows(w).at(-1)!;
    expect(target[1]).toBeCloseTo(0.85 * 0.5, 2);
    expect(dist).toBeCloseTo(2.4 * 0.5, 5);
    expect(inside![1]).toBeCloseTo(0.4 * 0.5, 5);
  });

  it('ペイントのカメラの距離の範囲も体の大きさに合わせる', () => {
    const w = fakeWorld();
    (w as unknown as { dist: number }).dist = 0.3;
    const p = new Play(w, 70);
    p.scale = 0.5;
    p.togglePaint();
    expect(p.orbitDist).toBeCloseTo(1.2 * 0.5, 5);
  });

  it('筆は屋敷の中で同じ大きさにするため、骨で曲げる前の座標の半径を体の大きさで割る', () => {
    const w = fakeWorld(true);
    const p = new Play(w, 70);
    p.scale = 0.5;
    p.togglePaint();
    stroke(p);
    expect(p.log.dabs.length).toBeGreaterThan(0);
    expect(p.log.dabs.every((d) => d.r === p.brush.radius / 0.5)).toBe(true);
    expect(p.brush.radius).toBe(0.05);
  });
});
```

`src/lib/games/yappari-chameleon/shots.test.ts` の `describe('frames', ...)` を、three の根元を `placeRoot` で置くようにする（`placeRoot` が大きさを根元に入れることも、ここで確かめる）。import に `import { placeRoot } from './world3d';` を足し（`./shots` の次の行）、`it` の名前とループの中を次にする。

```ts
  it('骨の置き方は、three の骨（PoseAnimator と placeRoot。小さい体も）と同じ所に来る', () => {
```

```ts
poses.snap(pose);
placeRoot(rig.root, b);
const f = frames(pose, placement(b));
```

（Task 3 で足した `rig.root.rotation.order = ...` から `rig.root.updateMatrixWorld(true);` までの 5 行と `const p = placement(b);` は消す。）

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/play.svelte.test.ts src/lib/games/yappari-chameleon/shots.test.ts`
Expected: `Play のプチカメレオン` の 5 つと `frames` が FAIL（`Play.scale` が無い。`placeRoot` が大きさを入れず、プチの骨の位置がずれる）。

- [ ] **Step 3: Play に体の大きさを足す**

`src/lib/games/yappari-chameleon/play.svelte.ts` の `PAINT_DIST_MIN` の下に足す。

```ts
/** ペイントのカメラの距離の範囲 */
const PAINT_DIST: [number, number] = [0.5, 3.5];
/** 歩きのカメラの、見る中心の足もとからの高さ（天井では天井から下へ）と距離 */
const WALK_LIFT = 0.85;
const CEILING_LIFT = -0.4;
const WALK_DIST = 2.4;
```

`#snapSide = true;` の下に `#scale = 1;` を足す。constructor の下（`hold` の前）に足す。

```ts
  /**
   * 自分の体の大きさ（プチカメレオンは 0.5）。Session が親から届いた様子で入れる。端末に覚えた体型からは入れない
   * （親が許していないのに小さく歩くと、親の弾と埋まりの当たりとずれる）。歩きのカメラの高さと距離・塗りの筆も合わせる
   */
  get scale(): number {
    return this.#scale;
  }

  set scale(v: number) {
    this.#scale = v;
    this.body.scale = v;
  }
```

`togglePaint` の `this.orbitDist = Math.min(3.5, Math.max(PAINT_DIST_MIN, this.world.dist));` を次にする。

```ts
const s = this.#scale;
this.orbitDist = Math.min(PAINT_DIST[1] * s, Math.max(PAINT_DIST_MIN * s, this.world.dist));
```

`placeAt` の `this.body = newBody(at);` を `this.body = newBody(at, this.#scale);` にする。

`#paint` の筆を始める行を次にする。

```ts
// 吹き付けは骨で曲げる前の体の上に置くので、小さい体では半径を大きさで割り、屋敷の中で同じ大きさの筆にする
if (e.kind === 'start')
  this.#stroke = new Stroke({
    ...this.brush,
    radius: this.brush.radius / this.#scale,
    color: [...this.brush.color]
  });
```

`frame` のペイントの `this.orbitDist = Math.min(3.5, Math.max(0.5, this.orbitDist / o.zoom));` を次にする。

```ts
this.orbitDist = Math.min(PAINT_DIST[1] * this.#scale, Math.max(PAINT_DIST[0] * this.#scale, this.orbitDist / o.zoom));
```

`frame` の `const inside: V3 = [...]` から歩きの `w.follow(...)` までを次にする（ペイントから下は今のまま）。

```ts
    const s = this.#scale;
    const ceiling = this.body.cling?.kind === 'ceiling';
    const inside: V3 = [this.body.pos[0], this.body.pos[1] + (ceiling ? -0.4 : 0.4) * s, this.body.pos[2]];
    if (this.mode === 'walk') {
      // 小さい体は見る中心の高さも距離も体に合わせて縮め、画面の中の体の大きさを通常の体とそろえる
      const lift = (ceiling ? CEILING_LIFT : WALK_LIFT) * s;
      const t: V3 = [this.body.pos[0], this.body.pos[1] + lift, this.body.pos[2]];
      w.follow(this.#focus(t, dt), this.camYaw, this.camPitch, WALK_DIST * s, 60, dt, inside);
```

- [ ] **Step 4: world3d.ts の根元・張り付きの輪・透かしの窓に大きさを入れる**

`placeRoot` を次にする。

```ts
/** 体の根元を、張り付き（壁から離す・天井で寝かせる）と大きさも込みで置く。ほかの人の体も同じ置き方にする */
export function placeRoot(root: THREE.Object3D, b: Placeable): void {
  const p = placement(b);
  root.rotation.order = 'YXZ';
  root.rotation.set(p.tilt, p.yaw, 0);
  root.scale.setScalar(p.scale);
  root.position.set(...p.at);
  root.updateMatrixWorld(true);
}
```

`placeDoll` の `const ring = this.#ring;` から壁の輪の位置までを次にする（天井の輪は根元から測るので今のまま）。

```ts
    const ring = this.#ring;
    const s = b.scale ?? 1;
    ring.visible = !!b.cling;
    ring.scale.setScalar(s);
    if (b.cling?.kind === 'wall') {
      // ポーズで面から離した根元ではなく、面に付けたときの位置に出す。輪は張り付いた面の印
      const [x, , z] = placement({ pos: b.pos, yaw: b.yaw, cling: b.cling, scale: s }).at;
      ring.position.set(x, b.pos[1] + 0.58 * s, z);
```

`xray` の最後の 2 行を次にする（`s` はこの関数では画面の位置なので、大きさは `size`）。

```ts
const size = this.rig.root.scale.x;
XRAY.radius.value = 0.7 * size * perMeter;
XRAY.depth.value = dist - 0.3 * size;
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（`Play.scale` は 1 のままなので、今のカメラと筆は変わらない）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/play.svelte.ts src/lib/games/yappari-chameleon/world3d.ts src/lib/games/yappari-chameleon/play.svelte.test.ts src/lib/games/yappari-chameleon/shots.test.ts
git commit -m "Give the player a body size that scales the doll, walking camera and brush"
```

---

### Task 6: ほかの人の体と Session の大きさ

**Files:**

- Modify: `src/lib/games/yappari-chameleon/remote.ts`、`src/lib/games/yappari-chameleon/session.svelte.ts`
- Test: `src/lib/games/yappari-chameleon/remote.test.ts`、`src/lib/games/yappari-chameleon/session.svelte.test.ts`

**Interfaces:**

- Consumes: Task 1 の `liveScale`・`scaleOf`・`BodyType`・`View.bodies`、Task 4 の `Host.allow`、Task 5 の `Play.scale`・`placeRoot` の `scale`。
- Produces: `Show.scale: number`（`Remote.update` が `placeRoot(root, { ...me, scale: show.scale })` で置く）。
- Produces: `Session` は様子を受けるたびに `play.scale = liveScale(view, me)` を入れる。ほかの人の生きている体は `liveScale(view, seat)`、答え合わせの見つかったときの体・増え鬼の撃たれた場所の体・ダブルの残した体は `scaleOf(view.bodies[seat])`（`#pinScale`）。撃つ的（`shoot` の `Target`）も同じ大きさ。
- Produces: `Session.dress(body: BodyType): void`（`{ t: 'body', body }` を親へ送る）、`Session.allow(on: boolean): void`（親だけ。`host.allow(on)`）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/remote.test.ts` の `show` を、大きさの既定を入れる形にする。

```ts
const show = (extra: Partial<Show> = {}): Show => ({
  pin: null,
  visible: true,
  armed: false,
  shine: null,
  scale: 1,
  ...extra
});
```

`describe('paintColors', ...)` の前に足す。

```ts
describe('Remote のプチカメレオン', () => {
  it('見せる大きさで体を置き、頭の上と真ん中もその大きさで測る。張り付いた体もその大きさで面から離す', () => {
    const r = remote();
    r.push(me(0, 0), 0);
    r.update(1 / 60, 500, show({ scale: 0.5 }));
    expect(r.rig.root.scale.x).toBeCloseTo(0.5);
    expect(r.head()![1]).toBeCloseTo(1.35 * 0.5);
    expect(r.center()![1]).toBeCloseTo(0.6 * 0.5);
    const wall = remote();
    wall.push(me(0, 0, { pos: [0, 1, 4.9], cling: { kind: 'wall', nx: 0, nz: -1 } }), 0);
    wall.update(1 / 60, 500, show({ scale: 0.5 }));
    expect(wall.rig.root.position.z).toBeCloseTo(4.9 + (0.2 - 0.12) * 0.5);
    r.update(1 / 60, 500, show({ scale: 1 }));
    expect(r.rig.root.scale.x).toBeCloseTo(1);
  });
});
```

`src/lib/games/yappari-chameleon/session.svelte.test.ts` の `made` と `vi.mock('./remote', ...)` の `lastShow` の型に `scale?: number` を足す（3 か所）。

```ts
    lastShow: { visible: boolean; shine?: unknown; scale?: number } | null;
```

```ts
    lastShow: { visible: boolean; pin?: Me | null; shine?: unknown; scale?: number } | null = null;
    update(_dt: number, _now: number, show: { visible: boolean; pin?: Me | null; shine?: unknown; scale?: number }) {
```

ファイルの最後に足す。

```ts
describe('Session のプチカメレオン', () => {
  const petit = { ...DEFAULTS, mode: 'infect', petit: true } as const;
  const seatOf = (seat: Seat) =>
    made.remotes.findLast((r) => (r as unknown as { last: Me | null }).last?.pos[0] === seat)!;

  it('自分の体の大きさは届いた様子の体型で決め、ロビーと隠れる役のあいだだけ小さく、ハンターになると 1', () => {
    const { play, tell, frames } = setup();
    tell(at('lobby'));
    expect(play.scale).toBe(1);
    tell(at('lobby', { bodies: { 2: 'petit' } }));
    expect(play.scale).toBe(0.5);
    tell(at('hide', { settings: petit, bodies: { 2: 'petit' } }));
    expect(play.scale).toBe(0.5);
    expect(play.body.scale).toBe(0.5);
    tell(at('search', { settings: petit, bodies: { 2: 'petit' } }));
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0], body: body({ pos: [0, 0, 1.5] }) });
    tell(
      at('search', {
        settings: petit,
        roles: { 1: 'hider', 2: 'hunter', 3: 'hunter' },
        found: [2],
        bodies: { 2: 'petit' }
      })
    );
    expect(play.scale).toBe(1);
    frames(SHATTER_SECS + 0.1);
    expect(play.role).toBe('hunter');
  });

  it('許可のない様子では、端末にプチを覚えていても自分の体は 1（大きさは親の様子からだけ決める）', () => {
    localStorage.setItem('asobibako:yappari-chameleon:body', 'petit');
    const { play, tell } = setup();
    tell(at('lobby'));
    tell(at('hide'));
    expect(play.scale).toBe(1);
    localStorage.clear();
  });

  it('ほかの人の体は、隠れる人ならその人の体型で、ハンターなら 1 で見せ、撃つ的もその大きさ', () => {
    const { s, tell, frames } = setup(3);
    tell(meMsg(1, { pos: [1, 0, 5] }));
    tell(meMsg(2, { pos: [2, 0, 5] }));
    tell(at('lobby'));
    tell(at('search', { settings: petit, bodies: { 1: 'petit', 3: 'petit' } }));
    frames(0.2);
    expect(seatOf(1).lastShow?.scale).toBe(0.5);
    expect(seatOf(2).lastShow?.scale).toBe(1);
    vi.mocked(fire).mockClear();
    s.shoot();
    const targets = vi.mocked(fire).mock.calls[0][3];
    const one = targets.find((t) => t.seat === 1)!;
    const want = capsules(STAND, placement({ ...body({ pos: [1, 0, 5] }), scale: 0.5 }));
    expect(one.caps[0].r).toBeCloseTo(want[0].r, 9);
    expect(one.caps[0].a[1]).toBeCloseTo(want[0].a[1], 9);
  });

  it('増え鬼でハンターになったプチの人は、今の体は 1 で、撃たれた場所の体はプチのまま見せる', () => {
    const { tell, frames } = setup();
    tell(meMsg(1, { pos: [1, 0, 0] }));
    tell(at('lobby'));
    tell(at('search', { settings: petit, bodies: { 1: 'petit' } }));
    tell({ t: 'found', seat: 1, by: 3, at: [4, 1, 4], body: body({ pos: [4, 0, 4] }) });
    frames(SHATTER_SECS + 0.1);
    const before = made.remotes.length;
    tell(
      at('reveal', {
        settings: petit,
        roles: { 1: 'hunter', 2: 'hider', 3: 'hunter' },
        found: [1],
        winner: 'chameleon',
        bodies: { 1: 'petit' }
      })
    );
    frames(0.1);
    expect(seatOf(1).lastShow?.scale).toBe(1);
    expect(made.remotes.slice(before)[0].lastShow).toMatchObject({ scale: 0.5, shine: 'blue' });
  });

  it('自分の体型を親へ送り、親は許可を審判へ渡す', () => {
    const host = { welcome: vi.fn(), allow: vi.fn() } as unknown as Host;
    const { s, acts } = setup(1, undefined, host);
    s.dress('petit');
    expect(acts).toEqual([{ t: 'body', body: 'petit' }]);
    s.allow(true);
    expect(host.allow).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/remote.test.ts src/lib/games/yappari-chameleon/session.svelte.test.ts`
Expected: FAIL（`Remote` が `show.scale` を見ず、`Session` が `play.scale` を入れず、`dress` と `allow` が無い）。`許可のない様子では` は今も 1 なので通る（あとで大きさを端末の好みから入れる変更をしたときに落ちる見張り）。

- [ ] **Step 3: Remote が見せる大きさで置く**

`src/lib/games/yappari-chameleon/remote.ts` の `Show` の `shine` の下に足す。

```ts
/** 体の大きさ（プチカメレオンは 0.5）。届いた体の様子には大きさが無いので、見せる側が試合の様子から入れる */
scale: number;
```

`update` の `placeRoot(this.rig.root, me);` を `placeRoot(this.rig.root, { ...me, scale: show.scale });` にする。

- [ ] **Step 4: Session が様子から大きさを入れる**

`src/lib/games/yappari-chameleon/session.svelte.ts` の `./referee` の import を次にする。

```ts
import {
  COOLDOWN,
  liveScale,
  scaleOf,
  SHATTER_SECS,
  TOOT_GAP,
  type BodyType,
  type Settings,
  type View
} from './referee';
```

`#phase` の `this.match.receive(v);` の次の行に足す（`#place` と `#fit` より前に入れるので、置き直す体もハンターになる体もその大きさで作る）。

```ts
this.play.scale = liveScale(v, this.match.me);
```

`#show` の戻り値を次にし、その下に `#pinScale` を足す。

```ts
    return {
      pin,
      visible: !gone,
      armed: !pin && role === 'hunter' && (p === 'search' || p === 'reveal'),
      shine: infected ? null : this.#shine(seat),
      scale: pin ? this.#pinScale(seat) : liveScale(m.view, seat)
    };
  }

  /** 見つかったときの体とダブルの残した体は、隠れたときの体型の大きさ（増え鬼でハンターになっても） */
  #pinScale(seat: Seat): number {
    return scaleOf(this.match.view.bodies[seat]);
```

`frame` の増え鬼の撃たれた場所の体とダブルの残した体の `update` を次にする。

```ts
this.#pin(seat, this.#snaps.get(seat) ?? r.log).update(dt, now, {
  pin: body,
  visible: true,
  armed: false,
  shine: 'blue',
  scale: this.#pinScale(seat)
});
```

```ts
for (const [seat, body] of this.#lefts)
  this.#pins.get(seat)?.update(dt, now, {
    pin: body,
    visible: !this.#caught(seat),
    armed: false,
    shine: this.#leftShine(seat),
    scale: this.#pinScale(seat)
  });
```

`shoot` の的を作る所を次にする。

```ts
if (this.match.double) {
  for (const [seat, b] of this.#lefts)
    if (seat !== this.match.me && !this.#caught(seat))
      targets.push({ seat, caps: capsules(poseById(b.pose), placement({ ...b, scale: this.#pinScale(seat) })) });
} else
  for (const [seat, r] of this.#remotes)
    if (r.shown && r.rig.root.visible && this.match.roleOf(seat) === 'hider') {
      const scale = liveScale(this.match.view, seat);
      targets.push({ seat, caps: capsules(poseById(r.shown.pose), placement({ ...r.shown, scale })) });
    }
```

`start` の下に足す。

```ts
  /** 自分の体型を親へ送る。親はロビーのあいだだけ受け、許可されていれば全員へ配る */
  dress(body: BodyType): void {
    this.party.act({ t: 'body', body });
  }

  /** 親だけ。プチカメレオンの許可を審判へ渡す（ロビーのあいだに変えると、すぐ全員の体型に効く） */
  allow(on: boolean): void {
    this.host?.allow(on);
  }
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/remote.ts src/lib/games/yappari-chameleon/session.svelte.ts src/lib/games/yappari-chameleon/remote.test.ts src/lib/games/yappari-chameleon/session.svelte.test.ts
git commit -m "Size the player's own and other bodies from the view's body types"
```

---

### Task 7: 覚える体型・CPU の設定の許可・マップの設定の許可の行

**Files:**

- Modify: `src/lib/games/yappari-chameleon/prefs.ts`、`src/lib/games/yappari-chameleon/cpu/levels.ts`、`src/lib/backup.ts`、`src/lib/games/yappari-chameleon/Settings.svelte`
- Test: `src/lib/games/yappari-chameleon/prefs.test.ts`、`src/lib/games/yappari-chameleon/cpu/levels.test.ts`、`src/lib/backup.test.ts`、`src/lib/games/yappari-chameleon/Settings.svelte.test.ts`、`src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts`、`src/lib/games/yappari-chameleon/Entry.svelte.test.ts`、`src/lib/games/yappari-chameleon/Lobby.svelte.test.ts`

**Interfaces:**

- Consumes: Task 1 の `BodyType`・`BODY_TYPES`・`Settings.petit`。
- Produces: `prefs.ts` の `BODY_KEY = 'asobibako:yappari-chameleon:body'`、`readBody(): BodyType`（知らない値と読めないときは `'normal'`）、`saveBody(b: BodyType): void`。`readCpu()` は `petit: s.petit === true` を足して返す。
- Produces: `CpuChoice.petit: boolean`、`CPU_DEFAULT.petit = false`。
- Produces: `Settings.svelte` の「プチカメレオンを許可」の行（オン・オフ。`cpu` のときは出さない）。

- [ ] **Step 1: 落ちるテストを書き、選んだものの形が増えるテストを直す**

`src/lib/games/yappari-chameleon/prefs.test.ts` の `./prefs` の import を次にする。

```ts
import {
  BODY_KEY,
  CPU_KEY,
  readBody,
  readCpu,
  readSettings,
  saveBody,
  saveCpu,
  saveSettings,
  SETTINGS_KEY
} from './prefs';
```

`describe('CPU の設定', ...)` の中の 3 行を、`petit` を含めた形にする。

```ts
saveCpu({ side: 'seek', count: 2, mode: 'infect', strength: 'strong', petit: true });
expect(readCpu()).toEqual({ side: 'seek', count: 2, mode: 'infect', strength: 'strong', petit: true });
```

```ts
expect(readCpu()).toEqual({ side: 'hide', count: 2, mode: 'normal', strength: 'weak', petit: false });
localStorage.setItem(CPU_KEY, JSON.stringify({ side: 'x', count: 3, mode: 'double', strength: 'max', petit: 1 }));
```

ファイルの最後に足す。

```ts
describe('自分の体型', () => {
  it('覚えた体型を読み、無ければ通常。知らない値も通常', () => {
    expect(readBody()).toBe('normal');
    saveBody('petit');
    expect(localStorage.getItem(BODY_KEY)).toBe('petit');
    expect(readBody()).toBe('petit');
    localStorage.setItem(BODY_KEY, 'giant');
    expect(readBody()).toBe('normal');
  });
});

describe('プチカメレオンの許可', () => {
  it('マップの設定に覚え、前の版の保存は許可しないで読む', () => {
    saveSettings({ ...DEFAULTS, petit: true });
    expect(readSettings().petit).toBe(true);
    const old: Partial<typeof DEFAULTS> = { ...DEFAULTS };
    delete old.petit;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...old, v: 2 }));
    expect(readSettings().petit).toBe(false);
  });
});
```

`src/lib/games/yappari-chameleon/cpu/levels.test.ts` の既定の行を次にする。

```ts
expect(CPU_DEFAULT).toEqual({ side: 'hide', count: 1, mode: 'normal', strength: 'normal', petit: false });
```

`src/lib/backup.test.ts` の `it('最近のゲーム・タブ・ミュート・絵柄だけなら記録なしとみなす', ...)` の `asobibako:yappari-chameleon:cpu` の行の次に足す。

```ts
localStorage.setItem('asobibako:yappari-chameleon:body', 'petit');
```

`src/lib/games/yappari-chameleon/Settings.svelte.test.ts` の `show` が `settings` も返すようにする（`return { target, settings, done: () => unmount(app) };`）。`describe('Settings', ...)` の最後に足す。

```ts
it('プチカメレオンを許可の行は既定でオフで、オンを押すと許可する。CPU と遊ぶでは出さない（CPU の設定で決める）', () => {
  const { target, settings, done } = show(false);
  const row = [...target.querySelectorAll('.row')].find((r) => r.textContent?.includes('プチカメレオンを許可'))!;
  const pick = (text: string) => [...row.querySelectorAll('button')].find((b) => b.textContent === text)!;
  expect(pick('オフ').classList.contains('on')).toBe(true);
  pick('オン').click();
  flushSync();
  expect(settings.petit).toBe(true);
  expect(pick('オン').classList.contains('on')).toBe(true);
  done();
  const cpu = show(true);
  expect(cpu.target.textContent).not.toContain('プチカメレオンを許可');
  cpu.done();
});
```

選んだ CPU の設定に `petit` が増えるので、そのまま比べている 3 つのテストを直す。

`src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts` の `選んだものを choice に書き、…` の比べる行。

```ts
expect({ ...choice }).toEqual({ side: 'seek', count: 2, mode: 'normal', strength: 'strong', petit: false });
```

`src/lib/games/yappari-chameleon/Entry.svelte.test.ts` の `CPU と遊ぶを押すと CPU の設定を出し、…` の `want`。

```ts
const want = { side: 'seek', count: 2, mode: 'infect', strength: 'strong', petit: false };
```

`src/lib/games/yappari-chameleon/Lobby.svelte.test.ts` の `CPU の設定で選んで始めると、…` の `play` の 1 つめの引数。

```ts
      { side: 'seek', count: 1, mode: 'infect', strength: 'strong', petit: false },
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/prefs.test.ts src/lib/games/yappari-chameleon/cpu/levels.test.ts src/lib/backup.test.ts src/lib/games/yappari-chameleon/Settings.svelte.test.ts src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts src/lib/games/yappari-chameleon/Entry.svelte.test.ts src/lib/games/yappari-chameleon/Lobby.svelte.test.ts`
Expected: FAIL（`readBody`・`saveBody`・`BODY_KEY` が無い。`CpuChoice` に `petit` が無い。体型の保存を記録ありに数える。許可の行が無い）。

- [ ] **Step 3: 覚える体型と CPU の設定の許可を足す**

`src/lib/games/yappari-chameleon/cpu/levels.ts` の `CpuChoice` と `CPU_DEFAULT` を次にする。

```ts
export interface CpuChoice {
  side: 'hide' | 'seek';
  count: 1 | 2;
  mode: 'normal' | 'infect';
  strength: Strength;
  /** プチカメレオンを許可する。許可すると隠れる CPU は全員プチカメレオン */
  petit: boolean;
}

export const CPU_DEFAULT: CpuChoice = { side: 'hide', count: 1, mode: 'normal', strength: 'normal', petit: false };
```

`src/lib/games/yappari-chameleon/prefs.ts` の `./referee` の import を次にする。

```ts
import { BODY_TYPES, DEFAULTS, fit, type BodyType, type Settings } from './referee';
```

`readCpu` の戻り値の `strength: ...` の行の最後にコンマを足し、次の行に足す。

```ts
petit: s.petit === true;
```

ファイルの最後に足す。

```ts
export const BODY_KEY = 'asobibako:yappari-chameleon:body';

/** 前に選んだ自分の体型。知らない値は通常 */
export function readBody(): BodyType {
  try {
    return one(localStorage.getItem(BODY_KEY), BODY_TYPES, 'normal');
  } catch {
    return 'normal';
  }
}

export function saveBody(b: BodyType): void {
  try {
    localStorage.setItem(BODY_KEY, b);
  } catch {
    // 覚えられなくても、選んだ体型で遊べる
  }
}
```

`readSettings` は変えない（前の保存は `{ ...DEFAULTS, ...saved }` で `petit: false` になり、`fit` が `true` 以外をオフにする）。

`src/lib/backup.ts` の `NOT_RECORDS` の上のコメントの「CPU の設定（やっぱりカメレオン）」を「CPU の設定と体型（やっぱりカメレオン）」にし、`'asobibako:yappari-chameleon:cpu'` の行の最後にコンマを足して、次の行に足す。

```ts
'asobibako:yappari-chameleon:body';
```

- [ ] **Step 4: マップの設定に許可の行を足す**

`src/lib/games/yappari-chameleon/Settings.svelte` の「ハンターに見逃しランキングを表示」の行の `</div>` の次に足す（見逃しランキングの行のオン・オフより下に置き、ほかのテストが最初の「オフ」を見逃しランキングのものとして押せるようにする）。

```svelte
<!-- CPU と遊ぶでは、CPU の設定のプチカメレオンで決める -->
{#if !cpu}
  <div class="row">
    <span>プチカメレオンを許可</span>
    <span class="pick">
      <button class:on={settings.petit} onclick={() => (settings.petit = true)}>オン</button>
      <button class:on={!settings.petit} onclick={() => (settings.petit = false)}>オフ</button>
    </span>
  </div>
{/if}
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon src/lib/backup.test.ts`
Expected: PASS。`wc -l src/lib/games/yappari-chameleon/Settings.svelte` が 200 未満（170 ほど）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/prefs.ts src/lib/games/yappari-chameleon/cpu/levels.ts src/lib/backup.ts src/lib/games/yappari-chameleon/Settings.svelte src/lib/games/yappari-chameleon/prefs.test.ts src/lib/games/yappari-chameleon/cpu/levels.test.ts src/lib/backup.test.ts src/lib/games/yappari-chameleon/Settings.svelte.test.ts src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts src/lib/games/yappari-chameleon/Entry.svelte.test.ts src/lib/games/yappari-chameleon/Lobby.svelte.test.ts
git commit -m "Remember the chosen body type and add petit permission to map and CPU settings"
```

---

### Task 8: 体型を選ぶ画面（ロビーと CPU の設定）

**Files:**

- Modify: `src/lib/games/yappari-chameleon/CpuSetup.svelte`、`src/lib/games/yappari-chameleon/Lobby.svelte`、`src/lib/games/yappari-chameleon/Entry.svelte`、`src/lib/games/yappari-chameleon/Online.svelte`
- Test: `src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts`、`src/lib/games/yappari-chameleon/Lobby.svelte.test.ts`、`src/lib/games/yappari-chameleon/Overlay.svelte.test.ts`

**Interfaces:**

- Consumes: Task 6 の `Session.dress`・`Session.allow`、Task 7 の `readBody`・`saveBody`・`CpuChoice.petit`、`View.settings.petit`（許可が配られているか）。
- Produces: `CpuSetup` の props に `body: BodyType`（`$bindable`）。行「プチカメレオン」（許可しない・許可する）と行「体型」（通常・プチカメレオン。許可しないあいだは押せず、通常を選んでいる形）。
- Produces: ロビーの上の帯の「体型 通常」「体型 プチカメレオン」のボタン（押すたびに切り替える。届いた様子の許可がオフのあいだは押せず「体型 通常」）。選んだ体型は `saveBody` で覚えて `session.dress` で送る。親のロビーは、選んでいる許可（つないで遊ぶならマップの設定の `settings.petit`、CPU と遊ぶなら `choice.petit`）を始める前から `session.allow` で渡す。
- Produces: `Online` は `Session` を作った直後に `s.dress(readBody())` を送る（CPU と遊ぶはロビーを通らずに始まるため）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts` の import に `import type { BodyType } from './referee';` を足し、`show` の mount を、`body` を書き戻せる props にする。行の中のボタンを引く口も足す（「通常」はゲームモードと体型の両方にある）。

```ts
const props = $state({ choice, body: 'normal' as BodyType, onstart, onclose });
const app = mount(CpuSetup, { target, props });
```

```ts
/** 行の見出しの行の中のボタン（「通常」はゲームモードと体型の両方にある） */
const inRow = (row: string, text: string) => {
  const r = [...target.querySelectorAll('.row')].find((r) => r.querySelector('span')?.textContent?.trim() === row)!;
  return [...r.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
};
return { target, choice, props, onstart, onclose, button, click, inRow, done: () => unmount(app) };
```

`describe('CpuSetup', ...)` の最後に足す。

```ts
it('プチカメレオンは既定で許可しないで、そのあいだは体型を通常のまま押せない。許可すると体型を選べる', () => {
  const { choice, props, click, inRow, done } = show();
  expect(inRow('プチカメレオン', '許可しない').getAttribute('aria-pressed')).toBe('true');
  expect(inRow('体型', 'プチカメレオン').disabled).toBe(true);
  expect(inRow('体型', '通常').getAttribute('aria-pressed')).toBe('true');
  click('許可する');
  expect(choice.petit).toBe(true);
  inRow('体型', 'プチカメレオン').click();
  flushSync();
  expect(props.body).toBe('petit');
  expect(inRow('体型', 'プチカメレオン').getAttribute('aria-pressed')).toBe('true');
  click('許可しない');
  expect(choice.petit).toBe(false);
  expect(inRow('体型', '通常').getAttribute('aria-pressed')).toBe('true');
  done();
});
```

`src/lib/games/yappari-chameleon/Lobby.svelte.test.ts` の import を次にする。

```ts
import { BODY_KEY, CPU_KEY, SETTINGS_KEY } from './prefs';
import { DEFAULTS, newMatch, view } from './referee';
```

`show` を次にする（`Session` の口に `allow` と `dress` を足し、親が許可を配った様子を入れる口を足す）。

```ts
function show(host: boolean, members = [1, 2]) {
  const start = vi.fn();
  const allow = vi.fn();
  const dress = vi.fn();
  const match = new Match(() => 1);
  const session = { party: { host, members }, match, start, allow, dress } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Lobby, { target, props: { session, oninvite: vi.fn() } });
  flushSync();
  const button = (text: string) => [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  /** 親が許可を配った様子が届く */
  const permit = (on: boolean) => {
    match.receive({ ...view(newMatch()), settings: { ...DEFAULTS, petit: on } });
    flushSync();
  };
  return { target, start, allow, dress, button, permit, done: () => unmount(app) };
}
```

`describe('CPU と遊ぶのロビー', ...)` の前に足す。

```ts
describe('ロビーの体型', () => {
  it('許可がオフのあいだは「体型 通常」を押せず、覚えた体型は親へ送る', () => {
    localStorage.setItem(BODY_KEY, 'petit');
    const { button, dress, done } = show(false);
    expect(button('体型 通常')!.disabled).toBe(true);
    expect(dress).toHaveBeenLastCalledWith('petit');
    done();
  });

  it('許可が届くと押せ、押すたびに通常とプチカメレオンが切り替わり、覚えて親へ送る', () => {
    const { button, dress, permit, done } = show(false);
    permit(true);
    button('体型 通常')!.click();
    flushSync();
    expect(button('体型 プチカメレオン')).toBeDefined();
    expect(localStorage.getItem(BODY_KEY)).toBe('petit');
    expect(dress).toHaveBeenLastCalledWith('petit');
    button('体型 プチカメレオン')!.click();
    flushSync();
    expect(localStorage.getItem(BODY_KEY)).toBe('normal');
    expect(dress).toHaveBeenLastCalledWith('normal');
    permit(false);
    expect(button('体型 通常')!.disabled).toBe(true);
    done();
  });

  it('親はマップの設定の「プチカメレオンを許可」を、始める前から審判へ渡す。子は渡さない', () => {
    const { target, button, allow, done } = show(true);
    expect(allow).toHaveBeenLastCalledWith(false);
    button('マップの設定')!.click();
    flushSync();
    const row = [...target.querySelectorAll('.row')].find((r) => r.textContent?.includes('プチカメレオンを許可'))!;
    [...row.querySelectorAll('button')].find((b) => b.textContent === 'オン')!.click();
    flushSync();
    expect(allow).toHaveBeenLastCalledWith(true);
    done();
    const child = show(false);
    expect(child.allow).not.toHaveBeenCalled();
    child.done();
  });
});
```

`showCpu` の中に `const allow = vi.fn();` を足し（`const start = vi.fn();` の次の行）、`session` の `start` の次に `allow,` と `dress: vi.fn()` を足して、戻り値に `allow` を足す。

```ts
      start,
      allow,
      dress: vi.fn()
    } as unknown as Session;
```

```ts
return { target, play, start, allow, button, click, done: () => unmount(app) };
```

`describe('CPU と遊ぶのロビー', ...)` の最後に足す。

```ts
it('CPU と遊ぶでは、CPU の設定のプチカメレオンを審判へ渡し、マップの設定には許可の行を出さない', () => {
  const { target, click, allow, done } = showCpu();
  expect(allow).toHaveBeenLastCalledWith(false);
  click('マップの設定');
  expect(target.textContent).not.toContain('プチカメレオンを許可');
  click('閉じる');
  click('CPU の設定');
  click('許可する');
  expect(allow).toHaveBeenLastCalledWith(true);
  done();
});
```

`src/lib/games/yappari-chameleon/Overlay.svelte.test.ts` の `show` の `session` の `like: vi.fn(),` の次に足す（ロビーの Overlay が Lobby を出すので）。

```ts
    allow: vi.fn(),
    dress: vi.fn(),
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts src/lib/games/yappari-chameleon/Lobby.svelte.test.ts src/lib/games/yappari-chameleon/Overlay.svelte.test.ts`
Expected: 足したテストが FAIL（「プチカメレオン」「体型」の行とロビーの「体型」のボタンが無く、`allow` と `dress` を呼ばない）。

- [ ] **Step 3: CPU の設定にプチカメレオンと体型の行を足す**

`src/lib/games/yappari-chameleon/CpuSetup.svelte` の script を次にする（`COUNTS` から下は今のまま）。

```svelte
<script lang="ts">
  import { STRENGTHS, type CpuChoice } from './cpu/levels';
  import type { BodyType } from './referee';

  let {
    choice = $bindable(),
    body = $bindable(),
    onstart,
    onclose
  }: { choice: CpuChoice; body: BodyType; onstart: () => void; onclose: () => void } = $props();
  // 許可しないあいだは選べないので、通常を選んでいる形で出す
  const petit = $derived(choice.petit && body === 'petit');
```

強さの行の `</div>` と `<p class="note">` のあいだに足す。

```svelte
<div class="row">
  <span>プチカメレオン</span>
  <span class="pick">
    <button class:on={!choice.petit} aria-pressed={!choice.petit} onclick={() => (choice.petit = false)}
      >許可しない</button
    >
    <button class:on={choice.petit} aria-pressed={choice.petit} onclick={() => (choice.petit = true)}>許可する</button>
  </span>
</div>
<div class="row body" class:dim={!choice.petit}>
  <span>体型</span>
  <span class="pick">
    <button class:on={!petit} aria-pressed={!petit} disabled={!choice.petit} onclick={() => (body = 'normal')}
      >通常</button
    >
    <button class:on={petit} aria-pressed={petit} disabled={!choice.petit} onclick={() => (body = 'petit')}
      >プチカメレオン</button
    >
  </span>
</div>
```

- [ ] **Step 4: ロビーに体型のボタンを足し、許可と体型を親へ渡す**

`src/lib/games/yappari-chameleon/Lobby.svelte` の script の頭を次にする（`begin` から下は今のまま）。

```svelte
<script lang="ts">
  import { untrack } from 'svelte';
  import CpuSetup from './CpuSetup.svelte';
  import type { Crew } from './cpu/crew';
  import { readBody, readCpu, readSettings, saveBody, saveCpu, saveSettings } from './prefs';
  import type { Session } from './session.svelte';
  import Settings from './Settings.svelte';

  let { session, crew = null, oninvite }: { session: Session; crew?: Crew | null; oninvite: () => void } = $props();
  let open = $state(false);
  let picking = $state(false);
  let settings = $state(readSettings());
  let choice = $state(readCpu());
  let body = $state(readBody());
  const party = $derived(session.party);
  const allowed = $derived(session.match.view.settings.petit);
  const petit = $derived(allowed && body === 'petit');
  // CPU は始めるときに席へ着け直すので、着き終わる前でも CPU の席を数える
  const players = $derived(crew ? choice.count + 1 : party.members.length);

  // 親は選んでいる許可を、始める前から審判へ渡す（ロビーの体型のボタンと、選んだ体型の人形にすぐ効かせる）
  $effect(() => {
    const on = crew ? choice.petit : settings.petit;
    if (party.host) untrack(() => session.allow(on));
  });

  // 選んだ体型は端末に覚え、親へ送る。親は許可がオンのときだけ全員の体型に出す
  $effect(() => {
    const b = body;
    untrack(() => {
      saveBody(b);
      session.dress(b);
    });
  });
```

（`session.allow` と `session.dress` は親の手元で審判を回し、様子を受けて `Match` の状態を書き換えるので、`untrack` の中で呼んで、その状態を読み直しても effect が回り直さないようにする。）

帯の `<p>` の次の行に足す。

```svelte
<button disabled={!allowed} onclick={() => (body = body === 'petit' ? 'normal' : 'petit')}
  >体型 {petit ? 'プチカメレオン' : '通常'}</button
>
```

CPU の設定の行を次にする。

```svelte
{#if picking}<CpuSetup bind:choice bind:body onstart={startCpu} onclose={() => (picking = false)} />{/if}
```

style の最後に足す。

```css
button:disabled {
  opacity: 0.45;
}
```

- [ ] **Step 5: 入口の CPU の設定と、つないだ画面の最初の体型**

`src/lib/games/yappari-chameleon/Entry.svelte` の `./prefs` の import を `import { readBody, readCpu, saveBody, saveCpu } from './prefs';` にし、`let choice = $state(readCpu());` の次に `let body = $state(readBody());` を、`startCpu` の `saveCpu(choice);` の次に `saveBody(body);` を足して、CPU の設定の行を次にする。

```svelte
{#if picking}<CpuSetup bind:choice bind:body onstart={startCpu} onclose={() => (picking = false)} />{/if}
```

`src/lib/games/yappari-chameleon/Online.svelte` の import に `import { readBody } from './prefs';` を足し（`./play.svelte` の次の行）、`ready` の `session = s;` の次に足す。

```ts
// CPU と遊ぶはロビーを通らずに始まるので、ロビーの体型のボタンを待たずに送る（親は試合の前のロビーでだけ受ける）
s.dress(readBody());
```

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。`wc -l src/lib/games/yappari-chameleon/{CpuSetup,Lobby,Entry,Online}.svelte` がどれも 200 未満（CpuSetup 171・Lobby 109 ほど）。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS（markuplint は `pnpm lint` に入っている）。

```bash
git add src/lib/games/yappari-chameleon/CpuSetup.svelte src/lib/games/yappari-chameleon/Lobby.svelte src/lib/games/yappari-chameleon/Entry.svelte src/lib/games/yappari-chameleon/Online.svelte src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts src/lib/games/yappari-chameleon/Lobby.svelte.test.ts src/lib/games/yappari-chameleon/Overlay.svelte.test.ts
git commit -m "Let players pick a body type in the lobby and in CPU settings"
```

---

### Task 9: プチの隠れ場所と CPU の筆、体型ごとの見えにくさの表

**Files:**

- Modify: `src/lib/games/yappari-chameleon/cpu/spots.ts`、`src/lib/games/yappari-chameleon/cpu/spot-seen.ts`（`pnpm spots` が書き直す）、`src/lib/games/yappari-chameleon/cpu/hider.ts`、`src/lib/games/yappari-chameleon/cpu/senses.ts`、`src/lib/games/yappari-chameleon/cpu/senses3d.ts`、`scripts/cpu-spots.ts`
- Test: `src/lib/games/yappari-chameleon/cpu/spots.test.ts`、`src/lib/games/yappari-chameleon/cpu/hider.test.ts`、`src/lib/games/yappari-chameleon/cpu/senses3d.test.ts`

**Interfaces:**

- Consumes: Task 1 の `PETIT`・`BodyType`、Task 2 の `newBody(at, scale)`、Task 3 の `Placeable.scale`、Task 5 の `Play.scale` と `placeRoot` の `scale`（`pnpm spots` が使う）。
- Produces: `Spot.scale?: number`（無ければ 1）。`SPOTS_OF: Record<BodyType, Spot[]>`（どちらも同じ並び。プチは壁の候補だけ壁へ `RADIUS × (1 − PETIT)` 寄せ、`scale: 0.5`）、`SPOTS = SPOTS_OF.normal`。
- Produces: `pickSpot(seed, index, skill, rand, body: BodyType = 'normal'): Spot`（その体型の候補と目立ちで選ぶ）。
- Produces: `SEEN: Record<BodyType, Record<string, number>>`（キーはどちらも通常の体の候補の `spotKey`）。
- Produces: `Senses.surface(seat: Seat, body: Me, scale: number): SurfacePoint[] | null`。`Senses3d.surface` は 3D の根元が `placement({ ...body, scale }).at` から 0.01m 以内で、根元の大きさが `scale` のときだけ点を返す。
- Produces: `HiderBrain` は `spot.scale` で筆の半径と点の間引きの升目を割り（骨で曲げる前の座標）、`surface` に `spot.scale ?? 1` を渡す。
- Produces: `pnpm spots --body normal|petit`（既定 `normal`）。測った体型の表だけを書き直し、ほかの体型の表は今のまま書く。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/cpu/spots.test.ts` の import を直す。

```ts
import { EYE_HEIGHT, idle, newBody, RADIUS, rampHeight, step, wallNear, type Box } from '../move';
```

```ts
import { PETIT } from '../referee';
import { pickSpot, shifted, SHIFT, spotKey, SPOTS, SPOTS_OF, viewOf, type Spot } from './spots';
```

`const ALL = ...` を次にする。

```ts
const shifts = (list: Spot[]) => list.flatMap((s) => STEPS.flatMap((a) => STEPS.map((b) => shifted(s, a, b))));
const ALL = shifts(SPOTS);
/** プチカメレオンの体で置いた候補とずらし（壁の候補は壁へ寄せてある） */
const PETITS = shifts(SPOTS_OF.petit);
```

今の 4 つのテスト（埋まらない・動く物にかからない・軸が入らない・置いても動かない）を、通常とプチの両方で回すようにする。

```ts
  // 候補 × ずらし 25 通り × 種 31 通りを調べるので、ほかのテストと並んで走ると数秒かかる
  it.each([
    ['通常', ALL],
    ['プチ', PETITS]
  ])(
    '%sの体で、どの種の置き方でも、どれだけずらしても埋まらない',
    (_, list) => {
      const bad: string[] = [];
      for (const seed of SEEDS) {
        const lv = levelOf(mansion(seed));
        for (const s of list) if (embedded(lv, s)) bad.push(`${seed} ${name(s)}`);
      }
      expect(bad).toEqual([]);
    },
    30_000
  );

  it.each([
    ['通常', ALL],
    ['プチ', PETITS]
  ])('%sの体で、ずらしても、動く物の置き場所の候補のどれにもかからない', (_, list) => {
    const boxes = SETS.flatMap((set) =>
      set.slots.flatMap((slot) => set.units.flatMap((unit) => unit.map((q) => boxOf(place(slot, q)))))
    ).filter((b): b is Box => b !== null);
    const bad = list
      .filter((s) => {
        const h = hull(s);
        return boxes.some((b) => hits(h, b));
      })
      .map(name);
    expect(bad).toEqual([]);
  });

  it.each([
    ['通常', ALL],
    ['プチ', PETITS]
  ])('%sの体で、ずらしても、壁や動かない家具の中と階段の坂の下に体の当たりの軸が入らない', (_, list) => {
    const bad: string[] = [];
    for (const s of list)
```

（このテストの残りは今のまま。）

```ts
  it.each([
    ['通常', ALL],
    ['プチ', PETITS]
  ])('%sの体で、置いてもその場から動かず、張り付きはそのまま。壁の張り付きは壁を向く', (_, list) => {
    const lv = levelOf(mansion());
    const bad: string[] = [];
    for (const s of list) {
      const b = { ...newBody(s.pos, s.scale), yaw: s.yaw, cling: s.cling, ground: !s.cling };
```

（このテストの残りは今のまま。）

`it('どの候補にも pnpm spots で測った目立ち（0..1）があり、表に候補の無い行は無い', ...)` を次の 3 つにする。

```ts
it.each(['normal', 'petit'] as const)(
  '%s の体のどの候補にも pnpm spots で測った目立ち（0..1）があり、表に候補の無い行は無い',
  (body) => {
    SPOTS_OF[body].forEach((s, i) => {
      const key = spotKey(SPOTS[i]);
      expect(SEEN[body][key], name(s)).toBeTypeOf('number');
      expect(s.seen).toBe(SEEN[body][key]);
      expect(s.seen).toBeGreaterThanOrEqual(0);
      expect(s.seen).toBeLessThanOrEqual(1);
    });
    expect(Object.keys(SEEN[body]).sort()).toEqual(SPOTS.map(spotKey).sort());
  }
);

it('プチの候補は通常と同じ並びで、壁の候補だけ半径の差だけ壁へ寄せ、人形は壁に付く', () => {
  const lv = levelOf(mansion());
  SPOTS_OF.petit.forEach((s, i) => {
    const n = SPOTS[i];
    expect(s.scale).toBe(PETIT);
    expect({ ...s, pos: n.pos, seen: n.seen, scale: n.scale }).toEqual(n);
    if (n.cling?.kind !== 'wall') return expect(s.pos).toEqual(n.pos);
    const k = RADIUS * (1 - PETIT);
    expect(s.pos[0]).toBeCloseTo(n.pos[0] - n.cling.nx * k, 9);
    expect(s.pos[2]).toBeCloseTo(n.pos[2] - n.cling.nz * k, 9);
    // 体の真ん中から壁の向きへ、プチの体の半径ほどで壁に当たる
    const t = rayLevel(lv, [s.pos[0], s.pos[1] + 0.3, s.pos[2]], s.back, 1)?.t;
    expect(t, name(s)).toBeCloseTo(RADIUS * PETIT, 2);
  });
});

it('プチを選ぶと、プチの表の目立ちで選び、壁の候補は壁へ寄せた位置からずらす', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = pickSpot(seed, 0, SKILLS.strong, () => 0.5, 'petit');
    expect(s.scale).toBe(PETIT);
    const near = (o: Spot) => o.pose === s.pose && o.pos.every((v, i) => Math.abs(v - s.pos[i]) <= o.slack + 1e-9);
    expect(SPOTS_OF.petit.some(near), name(s)).toBe(true);
  }
  expect(pickSpot(3, 0, SKILLS.weak, () => 0.5).scale).toBe(1);
});
```

`src/lib/games/yappari-chameleon/cpu/hider.test.ts` の `it('弱いは大きな筆で数が少なく、色がずれ、塗り残す', ...)` の前に足す。

```ts
it('プチカメレオンの体は、骨で曲げる前の座標で筆を 2 倍にして（屋敷の中で同じ大きさ）、体の大きさを付けて表面を聞く', () => {
  const petit: Spot = { ...open, scale: 0.5 };
  const asked: number[] = [];
  const senses: Senses = {
    ...canvas(() => null),
    surface: (_seat, _body, scale) => {
      asked.push(scale);
      return tube(petit, 3000, 0.075, 0.575).map((p) => ({
        ...p,
        rest: [p.rest[0] * 2, p.rest[1] * 2, p.rest[2] * 2] as V3
      }));
    }
  };
  const small = brain('normal', petit);
  run(small, ctx(senses), 25);
  expect(small.done).toBe(true);
  expect(asked).toEqual([0.5]);
  expect(small.log.dabs.every((d) => d.r === SKILLS.normal.brush * 2)).toBe(true);
  const full = brain('normal');
  run(full, ctx(canvas(() => tube(open))), 25);
  // 体の面は 4 分の 1 で、筆の升目は休みの形で 2 倍なので、吹く数は通常の体の 4 分の 1 ほど
  expect(small.log.dabs.length).toBeLessThan(full.log.dabs.length / 2.5);
});
```

`src/lib/games/yappari-chameleon/cpu/senses3d.test.ts` の頭を次にし（体の表面を three の人形で調べるので、`remote.test.ts` と同じ何もしない描画器と模様を使う）、`eyeType` のテストの `HalfFloatType` と `UnsignedByteType` を `THREE.HalfFloatType` と `THREE.UnsignedByteType` にする。

```ts
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { layAtlas } from '../atlas';
import { buildDoll } from '../doll';
import { makeDoll } from '../doll3d';
import type { Me } from '../net';
import { eyeType, placeRoot, type World } from '../world3d';
import { Senses3d, standout } from './senses3d';

// 塗りの描き先と模様は GPU と canvas に作るので、ここでは何もしない描画器と模様で足りる
const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;
vi.mock('../textures', async (orig) => ({
  ...(await orig<typeof import('../textures')>()),
  rainbowMottle: () => undefined
}));
```

ファイルの最後に足す。

```ts
describe('Senses3d の体の表面', () => {
  const surface = buildDoll(0.02);
  const atlas = layAtlas(surface.pos, surface.idx, 2048);
  const wall: Me = {
    ms: 0,
    pos: [0, 1, 4.9],
    yaw: Math.PI,
    cling: { kind: 'wall', nx: 0, nz: -1 },
    pose: 'stand',
    crouch: false,
    paint: false,
    look: [0, 0],
    eye: null
  };

  it('3D の体が渡した大きさで置かれていれば点を返し、前の大きさのままなら null（床の体は位置だけでは見分けられない）', () => {
    const rig = makeDoll(renderer, surface, atlas);
    const world = { renderedAt: Infinity } as unknown as World;
    const eye = new Senses3d(world, () => rig);
    placeRoot(rig.root, { ...wall, scale: 0.5 });
    expect(eye.surface(2, wall, 0.5)?.length).toBeGreaterThan(100);
    expect(eye.surface(2, wall, 1)).toBeNull();
    const floor: Me = { ...wall, pos: [0, 0, 0], cling: null };
    placeRoot(rig.root, floor);
    expect(eye.surface(2, floor, 1)?.length).toBeGreaterThan(100);
    expect(eye.surface(2, floor, 0.5)).toBeNull();
    placeRoot(rig.root, { ...floor, scale: 0.5 });
    const top = Math.max(...eye.surface(2, floor, 0.5)!.map((p) => p.world[1]));
    expect(top).toBeGreaterThan(0.5);
    expect(top).toBeLessThan(0.62);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/spots.test.ts src/lib/games/yappari-chameleon/cpu/hider.test.ts src/lib/games/yappari-chameleon/cpu/senses3d.test.ts`
Expected: FAIL（`SPOTS_OF` が無い。`SEEN` が体型ごとでない。`HiderBrain` が筆を割らず `surface` に大きさを渡さない。`Senses3d.surface` が大きさを見ない）。

- [ ] **Step 3: 候補を体型ごとに置き直す**

`src/lib/games/yappari-chameleon/cpu/spots.ts` の import を次にする。

```ts
import { EYE_HEIGHT, RADIUS, type Cling } from '../move';
import { PETIT, type BodyType } from '../referee';
```

`Spot` の `seen` のコメントと、その下を次にする。

```ts
  /** その部屋の網の点から強い CPU の目で見た目立ちの平均（0..1、pnpm spots が体型ごとに測った spot-seen.ts の値） */
  seen: number;
  /** 体の大きさ（プチカメレオンは 0.5）。無ければ 1 */
  scale?: number;
}

type Row = Omit<Spot, 'seen' | 'scale'>;
```

書斎の本棚の上の壁の候補の行を次にする（プチは丸まると足が本棚の天板 2.2m より下へ出て、下へ 0.25m ずらすと当たりの軸が本棚の中に入る。キーは位置とポーズで作るので表は変わらない）。

```ts
  wall(17.1, 2.4, 8.95, -1, 0, 'curl', 0.2), // 本棚の上の壁に張り付いて丸まる。プチは足が本棚の天板より下へ出るので、ずらすのは 0.2m まで
```

`export const SPOTS: Spot[] = ...` の行とその上のコメントを次にする。

```ts
/**
 * 小さい体で置き直した候補。壁の候補は通常の体の半径だけ壁から離れているので、半径の差だけ壁へ寄せる（離れたままだと面から浮く）。
 * 床と天井の候補はそのまま
 */
function fit(row: Row, scale: number): Row {
  if (row.cling?.kind !== 'wall') return row;
  const k = RADIUS * (1 - scale);
  const [x, y, z] = row.pos;
  return { ...row, pos: [x - row.cling.nx * k, y, z - row.cling.nz * k] };
}

// 測っていない候補は、いちばん目立つものとして扱う（spots.test.ts が測り忘れを見る）。表のキーは体型によらず通常の体の候補
const spotsOf = (body: BodyType, scale: number): Spot[] =>
  ROWS.map((r) => ({ ...fit(r, scale), seen: SEEN[body][spotKey(r)] ?? 1, scale }));

/** 体型ごとの候補。どちらも ROWS と同じ並び */
export const SPOTS_OF: Record<BodyType, Spot[]> = { normal: spotsOf('normal', 1), petit: spotsOf('petit', PETIT) };
export const SPOTS = SPOTS_OF.normal;
```

`pickSpot` の上のコメントの「強さの段の候補を目立たないほうから」を「強さの段の候補を体型の表で目立たないほうから」にし、頭を次にする（下は今のまま）。

```ts
export function pickSpot(
  seed: number,
  index: number,
  skill: Pick<Skill, 'tiers' | 'pick'>,
  rand: () => number,
  body: BodyType = 'normal'
): Spot {
  const ok = SPOTS_OF[body].filter((s) => skill.tiers.includes(s.tier));
```

`src/lib/games/yappari-chameleon/cpu/spot-seen.ts` を体型ごとの表にする。1 行めのコメントを次にし、その下に import を足し、今の表の中身をそのまま `normal` の中へ入れて、`petit` の空の表を足す（`petit` は Step 6 で `pnpm spots` が書く）。

```ts
// pnpm spots が書く表。手で直さず、spots.ts の候補・強い CPU の筆と目・部屋の形や模様・体の形を変えたら測り直す

import type { BodyType } from '../referee';

/** 体型ごと・候補（通常の体の候補の spotKey）ごとの、その部屋の網の点から強い CPU の目で見た目立ちの平均（0..1） */
export const SEEN: Record<BodyType, Record<string, number>> = {
  normal: {
    '-6.50,0.00,3.20 stand floor -1,0,0': 0.41,
```

（`normal` の中は今の 75 行のまま。最後は次で閉じる。）

```ts
    '-19.80,1.20,-3.10 stand wall 1,0 -1,0,0': 0.136
  },
  petit: {}
};
```

- [ ] **Step 4: 隠れる CPU の筆と体の表面に大きさを通す**

`src/lib/games/yappari-chameleon/cpu/senses.ts` の `surface` を次にする。

```ts
  /** seat の体の表面の点。3D の体がまだ body の場所と大きさ（scale）に無ければ null */
  surface(seat: Seat, body: Me, scale: number): SurfacePoint[] | null;
```

`src/lib/games/yappari-chameleon/cpu/senses3d.ts` の `surface` の頭を次にする（下は今のまま）。

```ts
  surface(seat: Seat, body: Me, scale: number): SurfacePoint[] | null {
    const rig = this.#rigOf(seat);
    if (!this.#fresh() || !rig?.root.visible) return null;
    const want = placement({ ...body, scale }).at;
    const p = rig.root.position;
    // 3D の体がまだ前の大きさのまま（様子を受けて置き直す前）なら、床の候補でも位置だけでは見分けられない
    if (Math.hypot(p.x - want[0], p.y - want[1], p.z - want[2]) > 0.01 || Math.abs(rig.root.scale.x - scale) > 1e-6)
      return null;
```

`src/lib/games/yappari-chameleon/cpu/hider.ts` の `HiderBrain` の `#mood` の下に足す。

```ts
  /**
   * 吹き付けの半径と点の間引きの升目（骨で曲げる前の座標）。吹き付けは体の休みの形の上に置くので、小さい体では
   * 体の大きさで割って、屋敷の中で通常の体と同じ大きさの筆にする
   */
  readonly #brush: number;
```

constructor の `this.#cell = 2 * skill.brush;` の次の行に `this.#brush = skill.brush / (spot.scale ?? 1);` を足す（`#cell` は屋敷の中の升目なので割らない）。`step` の 3 か所を次にする。

```ts
const points = senses.surface(ctx.me, this.me(ctx.now), this.spot.scale ?? 1);
if (!points) return;
this.#plan = thin(points, this.#brush * 0.8).filter(() => this.#rand() >= this.#skill.skip);
```

```ts
          r: this.#brush,
```

- [ ] **Step 5: pnpm spots を体型ごとに測れるようにする**

`scripts/cpu-spots.ts` の頭のコメントの 3 行を次にする（`--skill` の行と端末の Chrome の行は今のまま）。

```ts
// 実行: pnpm spots [--body normal|petit]
// やっぱりカメレオンの隠れる CPU の候補（cpu/spots.ts の SPOTS_OF の体型の並び）を 1 つずつ置いて CPU と同じ塗り方で塗り、
// その部屋の網の点の目の高さから強い CPU の目で描いた目立ちの平均を cpu/spot-seen.ts のその体型の表に書く（ほかの体型の表は残す）。
```

`import type { Spot } ...` の前に `import { SEEN } from '../src/lib/games/yappari-chameleon/cpu/spot-seen.ts';` を足す（`spot-seen.ts` は型のほかを import しないので、node がそのまま読める）。`parseArgs` を次にする。

```ts
const { values: args } = parseArgs({
  options: {
    skill: { type: 'string', default: 'strong' },
    from: { type: 'string' },
    out: { type: 'string' },
    body: { type: 'string', default: 'normal' }
  }
});
if ((args.skill !== 'strong' || args.from) && !args.out) throw new Error('--skill と --from は --out といっしょに使う');
const body = args.body;
if (body !== 'normal' && body !== 'petit') throw new Error('--body は normal か petit');
```

`setup` を次の形にする（変えるのは引数・`Play` の型・`list`・`measure` の引数と中の 3 か所・戻り値）。

```ts
async function setup([base, kind]: [string, 'normal' | 'petit']): Promise<number> {
```

```ts
  interface Play {
    mode: string;
    scale: number;
```

```ts
  const list: Spot[] = spots.SPOTS_OF[kind];
  (window as unknown as { __spots: unknown }).__spots = {
    list,
    async measure(spot: Spot, skill: string, i: number): Promise<Row> {
```

```ts
play.ghost = move.newBody([eyes[0][0], eyes[0][1] - H, eyes[0][2]]);
play.scale = spot.scale ?? 1;
play.body = { ...move.newBody([...spot.pos], play.scale), yaw: spot.yaw, cling: spot.cling, ground: !spot.cling };
```

（`me` は `play.body` を広げて作るので、`bodyPoints(me)` は今のままで体の大きさを見る。）

```ts
      // 表のキーは体型によらず通常の体の候補（プチの壁の候補は壁へ寄せてあり、位置がちがう）
      return {
        key: spots.spotKey(spots.SPOTS[i] ?? spot),
```

```ts
  return list.length;
}
```

ページで呼ぶ所を次にする。

```ts
const count = await page.evaluate(setup, [BASE, body] as [string, 'normal' | 'petit']);
```

```ts
      ([i, spot, skill]) => {
        const s = (
          window as unknown as {
            __spots: { list: unknown[]; measure(s: unknown, k: string, i: number): Promise<Row> };
          }
        ).__spots;
        return s.measure(spot ?? s.list[i], skill, spot ? -1 : i);
      },
```

表を書く `else { ... }` の中を次にする。

```ts
const table = { ...SEEN, [body]: Object.fromEntries(rows.map((r) => [r.key, Number(r.seen.toFixed(3))])) };
// prettier の形（最後の行にコンマを付けない）で書く
const block = (kind: 'normal' | 'petit') =>
  `  ${kind}: {\n${Object.entries(table[kind])
    .map(([k, v]) => `    '${k}': ${v}`)
    .join(',\n')}\n  }`;
await writeFile(
  OUT,
  [
    '// pnpm spots が書く表。手で直さず、spots.ts の候補・強い CPU の筆と目・部屋の形や模様・体の形を変えたら測り直す',
    '',
    "import type { BodyType } from '../referee';",
    '',
    '/** 体型ごと・候補（通常の体の候補の spotKey）ごとの、その部屋の網の点から強い CPU の目で見た目立ちの平均（0..1） */',
    'export const SEEN: Record<BodyType, Record<string, number>> = {',
    `${block('normal')},`,
    block('petit'),
    '};',
    ''
  ].join('\n')
);
console.log(OUT);
```

`package.json` の `spots` は `node scripts/cpu-spots.ts` のままで、引数は `pnpm spots --body petit` で渡る。

- [ ] **Step 6: プチの表を測る**

Run: `pnpm spots --body petit`
Expected: 75 行の `<番号> <部屋> <キー> seen 0.xxx max 0.xxx rays N` を出し、最後に `src/lib/games/yappari-chameleon/cpu/spot-seen.ts`。どの行も `rays` が 10 以上（体の表面が取れて塗れた。0 の行があれば、その候補の 3D の体が届いた場所と大きさに置かれていない）。書き直した `spot-seen.ts` の `normal` は前と同じ数で、`petit` に 75 行が入る。計画を書くときに写しで測った値は、平均が通常 0.409・プチ 0.403 だった（目立ちは体の画素のうち色の違う割合なので、小さい体でも下がらない）。

- [ ] **Step 7: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（`spots.test.ts` はプチの 4 つの確かめで数秒延びる）。

- [ ] **Step 8: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS（`tsc -p tsconfig.scripts.json` が `scripts/cpu-spots.ts` も見る）。

```bash
git add src/lib/games/yappari-chameleon/cpu scripts/cpu-spots.ts
git commit -m "Place petit hiding spots against walls, size the CPU brush, and measure spot visibility per body type"
```

---

### Task 10: 探す CPU の体の点と、CPU と遊ぶのプチ

**Files:**

- Modify: `src/lib/games/yappari-chameleon/cpu/hunter.ts`、`src/lib/games/yappari-chameleon/cpu/bot.ts`、`src/lib/games/yappari-chameleon/cpu/crew.ts`
- Test: `src/lib/games/yappari-chameleon/cpu/hunter.test.ts`、`src/lib/games/yappari-chameleon/cpu/crew.test.ts`

**Interfaces:**

- Consumes: Task 1 の `liveScale`・`View.bodies`、Task 3 の `bodyPoints` の `scale`、Task 4 の `Host.start` の 3 つめの引数、Task 7 の `CpuChoice.petit`、Task 9 の `pickSpot` の `body`。
- Produces: `HunterBrain` は隠れている体の点を `bodyPoints({ ...body, scale })`（`scale = liveScale(ctx.view, seat)`）で測る（視野・遮り・狙う点がプチの体になる）。届きは `sight(..., SEARCH_REACH * scale)`、怪しさの足し方の距離は「見えた点までの距離 ÷ `scale`」（実効の距離。プチは 2 倍遠くにいる扱い）。目立ちの測り方は変えない。
- Produces: `Bot` は隠れタイムの始めに `pickSpot(seed, index, skill, rand, view.bodies[me])` で選ぶ。
- Produces: `cpuSettings(s, c)` は `petit: c.petit` を返す。`Crew.play` は `Host.start(cpuSettings(...), cpuHunters(...), bodies)` で CPU の席の体型を決め打つ（探すなら全員 `petit`、隠れるなら全員 `normal`。許可が無ければ審判が全員 `normal` で配る）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/cpu/hunter.test.ts` の `miss` を、体の大きさを受けるようにする。

```ts
function miss(shot: Message, target: Me, scale = 1): number {
  const o = shot.o as V3;
  const [mid] = bodyPoints({ ...target, scale });
```

`it('撃つと決めてから撃つまで、強さの段のぶん迷う', ...)` の前に足す。

```ts
it('プチカメレオンの体は、プチの体の点（胴の真ん中）を狙う', () => {
  const { c, target, run } = hunt('normal', eyes(0.6));
  c.view = { ...search, settings: { ...search.settings, petit: true }, bodies: { 1: 'petit' } };
  run(4);
  expect(c.shots.length).toBeGreaterThan(0);
  expect(miss(c.shots[0], target, 0.5)).toBeCloseTo(SKILLS.normal.aim, 1);
});
```

その次に、実効の距離の 2 つを足す。`../move` の import に `type Level` を足す（`import { CROUCH, EYE_HEIGHT, type Level } from '../move';`）。

```ts
it('小さい体は同じ大きさの体が遠くにいるのと同じ見え方で、同じ場所・同じ目立ちでも怪しさのたまり方が遅い', () => {
  const reach = (petit: boolean) => {
    const { b, c, run } = hunt('normal', eyes(0.6));
    if (petit) c.view = { ...search, settings: { ...search.settings, petit: true }, bodies: { 1: 'petit' } };
    let at: number | null = null;
    run(15, (t) => {
      if (at === null && (b.suspicion.get(1) ?? 0) >= SHOOT_AT) at = t;
    });
    return at;
  };
  const full = reach(false);
  const small = reach(true);
  expect(full).not.toBeNull();
  expect(small).not.toBeNull();
  expect(small!).toBeGreaterThan(full! * 1.2);
});

it('届き 30m も実効の距離で見る。20m 先の通常の体は見えるが、同じ所のプチは実効 40m で見えない', () => {
  const open: Level = { boxes: [{ min: [-60, -1, -60], max: [60, 0, 60] }], ramps: [], spawn: [0, 0, 0] };
  const asked = (petit: boolean) => {
    const calls: Seat[] = [];
    const b = brain('normal');
    const [x, , z] = b.eye();
    const target = body([x, 0, z + 20]);
    const c = ctx({ senses: eyes(0, calls), level: open, bodies: new Map<Seat, Me>([[1, target]]) });
    if (petit) c.view = { ...search, settings: { ...search.settings, petit: true }, bodies: { 1: 'petit' } };
    for (let t = 0; t < 1; t += 0.05) {
      // 向きを +z に留めて、まっすぐ前の体だけを見る
      b.look = [0, 0];
      c.now += 50;
      b.step(c, 0.05);
    }
    return calls.length;
  };
  expect(asked(false)).toBeGreaterThan(0);
  expect(asked(true)).toBe(0);
});
```

`src/lib/games/yappari-chameleon/cpu/crew.test.ts` の import を直す。

```ts
import { DAB_LEN, unpackDabs, type Me } from '../net';
```

```ts
import { DEFAULTS, INTRO, PETIT, SHATTER_SECS, type Settings } from '../referee';
```

```ts
import { CPU_DEFAULT, SKILLS, type CpuChoice } from './levels';
```

`table` の `shoot` を、体の大きさを受けるようにする。

```ts
  const shoot = (seat: Seat, scale = 1) => {
    const [mid] = bodyPoints({ ...body(seat), scale });
```

`it('隠れるは通常で CPU 全員をハンターに、…', ...)` の `cpuHunters` の 2 行の前に足す。

```ts
expect(cpuSettings(s, choice({ petit: true })).petit).toBe(true);
expect(cpuSettings({ ...s, petit: true }, choice({ petit: false })).petit).toBe(false);
```

`describe('CPU との通しの試合', ...)` の最後に足す。

```ts
it('プチカメレオンを許可した探すでは、隠れる CPU は全員プチで、屋敷の中で同じ大きさの筆で塗り、プチの胴を撃てば見つかる', async () => {
  const t = table();
  await t.crew.play(choice({ side: 'seek', count: 2, petit: true }), SET);
  expect(t.host.match.settings.petit).toBe(true);
  expect(t.host.match.bodies).toMatchObject({ 2: 'petit', 3: 'petit' });
  t.setPlayer(t.hunterMe);
  t.run(INTRO + 0.1);
  expect(t.until(() => [2, 3].every((s) => t.host.match.ready.includes(s as 2 | 3)), 25)).toBe(true);
  const dabs = t.of('dabs', 2).flatMap((m) => unpackDabs(m.d as number[]));
  expect(dabs.length).toBeGreaterThan(0);
  expect(dabs.every((d) => Math.abs(d.r - SKILLS.normal.brush / PETIT) < 1e-3)).toBe(true);
  t.party.act({ t: 'ready' });
  expect(t.host.match.phase).toBe('search');
  t.shoot(2, PETIT);
  expect(t.host.match.found).toEqual([2]);
});

it('許可しないか、CPU が探す側なら、CPU は通常の体', async () => {
  const off = table();
  await off.crew.play(choice({ side: 'seek', count: 1, petit: false }), SET);
  expect(off.host.match.settings.petit).toBe(false);
  const hide = table();
  await hide.crew.play(choice({ side: 'hide', count: 2, petit: true }), SET);
  expect(hide.host.match.bodies).toMatchObject({ 2: 'normal', 3: 'normal' });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/hunter.test.ts src/lib/games/yappari-chameleon/cpu/crew.test.ts`
Expected: FAIL（探す CPU が通常の体の胴を狙い、プチでも怪しさが同じ速さでたまり、20m 先のプチを見る。`cpuSettings` が許可を返さず、CPU の体型を決め打たない）。

- [ ] **Step 3: 探す CPU の体の点と実効の距離**

`src/lib/games/yappari-chameleon/cpu/hunter.ts` の `../referee` の import を `import { COOLDOWN, liveScale, type View } from '../referee';` にし、`#notice` の `const points = ...` と `const hits = ...` の 2 行を次にする。

```ts
// 小さい体は、同じ大きさの体が遠くにいるのと同じ見え方なので、距離を体の大きさで割った実効の距離で届きと怪しさを測る
const scale = liveScale(ctx.view, seat);
const points = bodyPoints({ ...body, scale });
const hits = points.map((p) => sight(ctx.level, viewer, [p], SEARCH_REACH * scale));
```

同じ `#notice` の `const d = Math.min(...hits.filter((h) => h !== null));` を次にする（`s += ... * (1 - d / SEARCH_REACH) * CHECK;` はそのまま。`d` が実効の距離になる）。

```ts
const d = Math.min(...hits.filter((h) => h !== null)) / scale;
```

- [ ] **Step 4: 隠れる CPU の候補を体型で選び、CPU の体型を決め打つ**

`src/lib/games/yappari-chameleon/cpu/bot.ts` の `#enter` の `pickSpot(...)` を次にする。

```ts
        pickSpot(m.view.seed ?? 1, this.#index, skill, this.#rand, m.view.bodies[m.me]),
```

`src/lib/games/yappari-chameleon/cpu/crew.ts` の `cpuSettings` を次にする。

```ts
export function cpuSettings(s: Settings, c: CpuChoice): Settings {
  return {
    ...s,
    mode: c.side === 'hide' ? 'normal' : c.mode,
    hunters: c.side === 'hide' ? c.count : 1,
    petit: c.petit
  };
}
```

`play` の `if (!this.#stopped) this.#host.start(...)` の行を次にする。

```ts
if (this.#stopped) return;
// CPU が送る知らせは step の中だけなので、体型の知らせでは始めるのに間に合わない。始めるときに決め打つ
const body = c.side === 'seek' ? 'petit' : 'normal';
const bodies = Object.fromEntries(this.bots.map((b) => [b.party.me, body] as const));
this.#host.start(cpuSettings(settings, c), cpuHunters(c, this.#party.members), bodies);
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（`cpu/guard.test.ts` も通る。`crew.ts` は three を読まない）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/cpu
git commit -m "Make hiding CPUs petit when permitted, and let seeking CPUs treat small bodies as farther away"
```

---

### Task 11: 本物の 3D で通しの試合と人形・カメラを確かめる

**Files:**

- Create（リポジトリに入れない）: `<scratch>/petit/e2e-petit-2b.mjs`（`<old>/2b/task20/e2e-chameleon-2b.mjs` を写して直す）、`<scratch>/petit/e2e-petit-cpu.mjs`、`<scratch>/petit/2b/*.png`、`<scratch>/petit/cpu/*.png`、`<scratch>/petit/cpu/result.json`
- 直すものが出たら、そのファイルを Modify

**Interfaces:**

- Consumes: Task 1〜10 の全部。dev の `window.__chameleon`（`Play`）・`window.__session`（`Session`）・`window.__crew`（`Crew`）。

確かめることは 4 つ。3 台の通しの試合（ダブルと増え鬼）にプチを混ぜて最後まで回せること、通常とプチの人形を並べた絵でプチが半分の高さに見えること、プチの歩きのカメラで体が画面の中で通常の体と同じくらいの大きさに見えること、CPU と遊ぶでプチを許すと隠れる CPU が小さくなって塗り、撃てば見つかること。

- [ ] **Step 1: 3 台の通しの試合のスクリプトを写して直す**

dev サーバーを `pnpm dev --port 5180` で起動しておく。`<old>/2b/task20/e2e-chameleon-2b.mjs` を `<scratch>/petit/e2e-petit-2b.mjs` へ写す（無ければ、`<old>/2b/task20/` の前のセッションの台本を探し、見つからなければこのステップの直しを、3 ページを偽のカメラの QR でつなぐ同じ形の台本に書く）。写したファイルを次のとおり直す。3 ページは 1 つの context なので localStorage を共有する。a が「体型」を押すと保存も 3 ページで共有されるので、押したあとに保存を通常へ書き戻し、ほかのページが次のロビーで読む体型を通常のままにする。

`settings()` の保存に `petit: true` を足す。

```js
JSON.stringify({
  mode: 'double',
  hunters: 1,
  hide: 300,
  search: 600,
  reveal: 120,
  taunt: 0,
  overlook: true,
  petit: true,
  v: 2
});
```

`const boxes = ...` の次の行に、人形の画面の高さを測る口と、2 つの確かめを足す。

```js
/** 人形の足もとから背の高さ（1.15 × 大きさ）までの画面の高さ（画素）。three の Vector3 は root.position の型から作る */
const dollPx = (page, seat) =>
  state(
    page,
    (seat) => {
      const root = window.__session.rigOf(seat).root;
      const w = window.__chameleon.world;
      const V = root.position.constructor;
      const top = root.localToWorld(new V(0, 1.15, 0));
      const foot = root.localToWorld(new V(0, 0, 0));
      return w.project([foot.x, foot.y, foot.z]).y - w.project([top.x, top.y, top.z]).y;
    },
    seat
  );

/** プチ（a、席 2）と通常（b、席 3）の人形を、親の一人称の画面の同じ遠さに並べて撮り、画面の高さの比を測る */
async function twoDolls(host, a, b) {
  await hideAt(a, [-0.6, 0, -61.5]);
  await hideAt(b, [0.6, 0, -61.5]);
  await host.evaluate(() => {
    const p = window.__chameleon;
    if (p.mode !== 'eye') p.toggleEye();
    p.ghost = { pos: [0, 0, -64.5], vy: 0, yaw: 0, ground: true, cling: null };
    p.eyeYaw = 0;
    p.eyePitch = 0.1;
  });
  await sleep(1200);
  await shot(host, '01c-lobby-two-dolls');
  const ratio = (await dollPx(host, 2)) / (await dollPx(host, 3));
  log('two dolls ratio', ratio);
  if (ratio < 0.45 || ratio > 0.55) throw new Error(`プチの人形が通常の半分の高さに見えない（${ratio}）`);
  await host.evaluate(() => {
    const p = window.__chameleon;
    if (p.mode === 'eye') p.toggleEye();
  });
}

/** 歩きのカメラの画面で、自分の人形が占める高さ。プチ（a）と通常（b）で 15% より違わない */
async function cameras(a, b) {
  for (const p of [a, b])
    await p.evaluate(() => {
      const c = window.__chameleon;
      c.camYaw = 0;
      c.camPitch = 0.25;
    });
  await sleep(1500);
  await shot(a, '01d-walk-camera-petit');
  await shot(b, '01e-walk-camera-normal');
  const fa = await dollPx(a, 2);
  const fb = await dollPx(b, 3);
  log('walk camera heights', fa, fb);
  if (fa / fb < 0.85 || fa / fb > 1.15)
    throw new Error(`プチの歩きのカメラで体の大きさが通常とずれる（${fa} / ${fb}）`);
}
```

`log('3 joined');` の次の `await sleep(1500);` のあとに足す（`await shot(host, '01-lobby-room');` の前）。

```js
// a がロビーの「体型」でプチカメレオンを選ぶ。許可はマップの設定（保存の petit: true）から親が配る
await until(a, () => window.__session.match.view.settings.petit);
await a.getByRole('button', { name: '体型 通常' }).click();
for (const p of [host, a, b]) await until(p, () => window.__session.match.view.bodies[2] === 'petit');
await host.evaluate(() => localStorage.setItem('asobibako:yappari-chameleon:body', 'normal'));
const sizes = await Promise.all([host, a, b].map((p) => state(p, () => window.__session.rigOf(2).root.scale.x)));
log('seat 2 sizes', sizes);
if (sizes.some((s) => Math.abs(s - 0.5) > 1e-6)) throw new Error('プチの体が 3 台で 0.5 倍になっていない');
await twoDolls(host, a, b);
await cameras(a, b);
```

ダブルで a（プチ）を見る・撃つ所の狙う高さを、プチの胴の高さ（0.35）にする（2 か所）。

```js
await aim(b, [10.5, 0, 4.2], [12.3, 0.35, 3]);
```

```js
await aim(b, [9, 0, 4.5], [12.3, 0.35, 3]);
```

a が切れて戻った所の `back` に体型を足し、確かめに入れる（戻った子の `body` は試合のあいだなので親が受けず、前の体型のまま届く）。

```js
const back = await state(a2, () => ({
  seat: window.__session.party.me,
  role: window.__chameleon.role,
  pin: window.__session.pinPaint(2),
  own: window.__chameleon.log.dabs.length,
  body: window.__session.match.view.bodies[2],
  scale: window.__chameleon.scale
}));
log('rejoined', back);
if (back.seat !== 2 || back.role !== 'hunter' || back.pin !== painted || back.body !== 'petit' || back.scale !== 1)
  throw new Error('戻った子の残した体・役・体型が戻っていない');
```

増え鬼の前、`await shot(host, '12-lobby-again');` の次に足す（a2 は新しいページで、書き戻した通常を読んでロビーに入る）。

```js
await a2.getByRole('button', { name: '体型 通常' }).click();
await until(host, () => window.__session.match.view.bodies[2] === 'petit');
```

増え鬼で b が a2 を撃つ所の狙う高さを 0.35 にし、見つかったあとに a2 の体の大きさを確かめる。

```js
await aim(b, [0.8, 0, 3.5], [3, 0.35, 1.2]);
```

```js
log(
  'a2 role after last found',
  await state(a2, () => ({ play: window.__chameleon.role, match: window.__session.match.role }))
);
if ((await state(a2, () => window.__chameleon.scale)) !== 1)
  throw new Error('ハンターになったプチの体が通常に戻っていない');
```

- [ ] **Step 2: 3 台の通しの試合を回して、合格を確かめる**

Run: `node <scratch>/petit/e2e-petit-2b.mjs <scratch>/petit/2b`
Expected: 最後に `ok` を出し、`FAILED` と `page errors` を出さず、終了コード 0。ログの `two dolls ratio` が 0.45〜0.55、`walk camera heights` の比が 0.85〜1.15。

Read で次の絵を見る。`01c-lobby-two-dolls.png` は白い人形が 2 つ並び、左（プチ）が右の半分ほどの背で、形は同じ。`01d-walk-camera-petit.png` と `01e-walk-camera-normal.png` は、人形が画面の中でほぼ同じ大きさで、プチの画面ではロビーの壁と台が大きく見える。`06d-left-body-study-from-b.png` に書斎の a の緑の小さな体がある。`13-buried-warning.png` に a2 の画面の埋まりの警告がある。`15-reveal-infect.png` に、撃たれた場所の a2 の小さな体が青く光る。

壁ぎわの埋まりの確かめ（`13-buried-warning`）が出ないときは、プチの半径（0.1m）で押し出される量が通常と違うので、押し込む深さ `zIn` を `wall.max[2] - 0.1` にして回し直す。

- [ ] **Step 3: CPU と遊ぶの通しの試合のスクリプトを書く**

`<scratch>/petit/e2e-petit-cpu.mjs` を作る。

```js
// 実行: node <scratch>/petit/e2e-petit-cpu.mjs [撮った絵を置く dir]
// CPU と遊ぶにプチカメレオンを混ぜて headless の Chrome で通す。dev サーバーは 5180 で起動しておく
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const repo = '/Users/oekazuma/localRepo/asobibako/.claude/worktrees/meccha-chameleon-clone-51ef75';
const out = process.argv[2] ?? `${import.meta.dirname}/cpu`;
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');
const URL = 'http://localhost:5180/asobibako/games/yappari-chameleon';
const BASE = '/asobibako/src/lib/games/yappari-chameleon';
/** 入口から 5m ほど先の大広間の床（crew.test.ts の OPEN と同じ）。入口と大広間の見回す点から見える */
const SPOT = [3.5, 0, 5.2];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required']
});
const errors = [];
const result = { seek: null, hide: [] };

/** CPU と遊ぶを、CPU の設定と自分の体型を覚えた状態で始める */
async function open(choice, body) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  await context.addInitScript(
    ([choice, body]) => {
      localStorage.setItem('asobibako:yappari-chameleon:cpu', JSON.stringify(choice));
      localStorage.setItem('asobibako:yappari-chameleon:body', body);
      localStorage.setItem(
        'asobibako:yappari-chameleon:settings',
        JSON.stringify({ mode: 'normal', hunters: 1, hide: 60, search: 90, reveal: 10, taunt: 0, overlook: true, v: 2 })
      );
    },
    [choice, body]
  );
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'CPU と遊ぶ' }).click();
  await page.getByRole('button', { name: 'ゲームを始める' }).click();
  await page.waitForFunction(() => window.__session?.match.synced, null, { timeout: 120000 });
  return { page, context };
}

const phase = (page, p, timeout = 30000) =>
  page.waitForFunction((p) => window.__session.match.phase === p, p, { timeout });

/** プレイヤーの一人称を at に置いて target を見て撮る（CPU の目と同じ所から） */
async function look(page, at, target, name) {
  await page.evaluate(
    ([at, target]) => {
      const p = window.__chameleon;
      if (p.mode !== 'eye' && p.role === 'hider') p.toggleEye();
      p.ghost = { pos: [...at], vy: 0, yaw: 0, ground: true, cling: null };
      const d = [target[0] - at[0], target[1] - at[1] - 1, target[2] - at[2]];
      const len = Math.hypot(...d);
      p.eyeYaw = Math.atan2(d[0], d[2]);
      p.eyePitch = Math.asin(-d[1] / len);
    },
    [at, target]
  );
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png` });
}

/** 隠れタイムを飛ばし、探索の始めから見つかるまでの秒（試合の時計）。limit 秒で見つからなければ null */
async function caught(page, limit) {
  await page.evaluate(() => window.__session.ready());
  await phase(page, 'search', 10000);
  try {
    await page.waitForFunction(
      () => {
        const m = window.__session.match;
        if (m.phase === 'search') window.__searched = m.view.settings.search - m.left;
        return m.found(1) || m.phase !== 'search';
      },
      null,
      { timeout: limit * 1000 }
    );
  } catch {
    return null;
  }
  return page.evaluate(() => (window.__session.match.found(1) ? +window.__searched.toFixed(2) : null));
}

try {
  // 探す（CPU 2 人が隠れる・プチを許可）
  const seek = await open({ side: 'seek', count: 2, mode: 'normal', strength: 'normal', petit: true }, 'normal');
  await phase(seek.page, 'hide');
  await seek.page.waitForFunction(() => [2, 3].every((s) => window.__session.match.view.ready.includes(s)), null, {
    timeout: 40000
  });
  result.seek = await seek.page.evaluate(() => ({
    bodies: window.__session.match.view.bodies,
    sizes: [2, 3].map((s) => window.__session.rigOf(s).root.scale.x),
    dabs: window.__crew.bots.map((b) => b.hider.log.dabs.length),
    r: window.__crew.bots.map((b) => b.hider.log.dabs[0]?.r ?? null)
  }));
  const spots = await seek.page.evaluate(async (base) => {
    const { viewOf } = await import(`${base}/cpu/spots.ts`);
    return window.__crew.bots.map((b) => ({ spot: b.hider.spot, view: viewOf(b.hider.spot) }));
  }, BASE);
  await seek.page.evaluate(() => window.__session.ready());
  await phase(seek.page, 'search', 10000);
  for (const [i, s] of spots.entries())
    await look(seek.page, [s.view[0], s.view[1] - 1, s.view[2]], s.spot.pos, `petit-cpu${i + 1}`);
  // CPU 1 のプチの胴を真上から撃つ知らせを親の審判へ直に送る（spot は scale 0.5 を持つ）
  await seek.page.evaluate(
    async ([base, spot]) => {
      const { bodyPoints } = await import(`${base}/oversight.ts`);
      const [mid] = bodyPoints(spot);
      const o = [mid[0], mid[1] + 0.6, mid[2]];
      window.__session.party.act({ t: 'shot', o, d: [0, -1, 0], from: o, ms: performance.now() });
    },
    [BASE, spots[0].spot]
  );
  await seek.page.waitForFunction(() => window.__session.match.found(2), null, { timeout: 5000 });
  result.seek.found = true;
  await seek.context.close();

  // 隠れる（CPU のハンター 1 人）。白いまま大広間の床に立ち、通常とプチで見つかるまでの秒を比べる
  for (const body of ['normal', 'petit']) {
    const hide = await open({ side: 'hide', count: 1, mode: 'normal', strength: 'normal', petit: true }, body);
    await phase(hide.page, 'hide');
    const scale = await hide.page.evaluate(() => window.__chameleon.scale);
    await hide.page.evaluate((spot) => window.__chameleon.placeAt(spot, Math.PI / 2), SPOT);
    await hide.page.waitForTimeout(1000);
    await hide.page.screenshot({ path: `${out}/hide-${body}.png` });
    result.hide.push({ body, scale, secs: await caught(hide.page, 60) });
    await hide.context.close();
  }
} finally {
  await writeFile(`${out}/result.json`, JSON.stringify({ ...result, errors }, null, 2));
  console.log(JSON.stringify({ ...result, errors }));
  await browser.close();
}
if (errors.length) process.exitCode = 1;
```

- [ ] **Step 4: CPU と遊ぶの通しの試合を回して、合格を確かめる**

Run: `node <scratch>/petit/e2e-petit-cpu.mjs <scratch>/petit/cpu`
Expected: 合格の条件は次のとおり。

| 項目              | 合格                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `seek.bodies`     | `{ "2": "petit", "3": "petit" }`                                                                                      |
| `seek.sizes`      | `[0.5, 0.5]`                                                                                                          |
| `seek.dabs`       | 2 人とも 60 以上（体の面が 4 分の 1 で、筆の升目が骨で曲げる前の座標で 2 倍なので、通常の 300 以上のおよそ 4 分の 1） |
| `seek.r`          | 2 人とも 0.14（普通の筆 0.07 ÷ 0.5）                                                                                  |
| `seek.found`      | true                                                                                                                  |
| `hide` の `scale` | `normal` が 1、`petit` が 0.5                                                                                         |
| `hide` の `secs`  | `normal` は 60 秒以内に見つかる。`petit` は `normal` より遅い（60 秒で見つからない null も遅いに数える）              |
| `errors`          | 空                                                                                                                    |

Read で `petit-cpu1.png` と `petit-cpu2.png` を見て、CPU の小さな体が見られる位置から見てまわりの色に寄っていること、`hide-petit.png` で自分の人形が小さく、歩きのカメラが体に寄っていることを確かめる。

`hide` の通常とプチの秒は並べて報告に書く。プチが通常より早く見つかるか同じなら合格にせず、条件も緩めない。`cpu/hunter.ts` の実効の距離（届きと怪しさの足し方）が `liveScale` の倍率で効いているかを、Task 10 のテストと合わせて見直す。

- [ ] **Step 5: 今の CPU と遊ぶが今のまま通ることを確かめる**

Run: `node <old>/cpu/e2e-cpu.mjs <scratch>/petit/cpu-old`
Expected: 前の合格の条件（`intro` が 2.0 以上・白い体は 20 秒以内・`seek.turned` と `again` が true・`errors` が空）を満たす。保存の CPU の設定に `petit` が無いので、`readCpu` が許可しないで読み、体はみな通常。

- [ ] **Step 6: 直したらコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

直したときだけ、直したファイルを `git add` して次でコミットする（直さなかったらこのステップは飛ばす）。

```bash
git commit -m "Fix petit issues found in headless matches"
```

---

### Task 12: CLAUDE.md と pnpm verify

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: Task 1〜11 の名前。

- [ ] **Step 1: CLAUDE.md を今のコードに合わせる**

`CLAUDE.md` の次の 6 か所を直す（今のコードの名前と合わないところがあれば、コードに合わせて直す。経緯やタスクの番号は書かない）。

コマンドの `pnpm spots` の行を次にする。

```bash
pnpm spots [--body petit]     # やっぱりカメレオンの隠れる CPU の候補の目立ちを体型ごとに測り直して cpu/spot-seen.ts に書く（端末の Chrome）
```

「やっぱりカメレオンの CPU の設定だけの状態は」を「やっぱりカメレオンの CPU の設定と体型だけの状態は」にする。

「このゲームの版（`CHAMELEON_VERSION`、3。当たりのある家具を足すなど屋敷の当たりが変わるときに上げる。古い端末が混じると、弾の遮りと埋まりの判定が親とずれる）」を「このゲームの版（`CHAMELEON_VERSION`、4。知らせの形や、当たりのある家具を足すなど屋敷か体の当たりが変わるときに上げる。古い端末が混じると、弾の遮りと埋まりの判定が親とずれる）」にする。

「「ハンターに見逃しランキングを表示」は初めからオン。」を「「ハンターに見逃しランキングを表示」は初めからオン、「プチカメレオンを許可」は初めからオフ。」にする。

「強さ（弱い・普通・強い）を選び、」を「強さ（弱い・普通・強い）・プチカメレオン（許可しない・許可する）と自分の体型を選び、」にする。

「入口の「CPU と遊ぶ」は、」の文の前に、次の文を足す。

```markdown
隠れる人は体をプチカメレオン（人形をそのまま 0.5 倍、`referee.ts` の `PETIT`）にできる。体型（`normal`・`petit`）は試合の様子の `View.bodies` に席ごとに親が持ち、子はロビーの上の帯の「体型」のボタン（押すたびに「通常」と「プチカメレオン」）で選んで知らせ `body` を送る。親はロビーのあいだだけ受け、選んだ記録（`Match.bodies`）は許可がオフでも覚え、マップの設定の「プチカメレオンを許可」（`Settings.petit`）がオフのあいだは全員 `normal` として配る（そのあいだボタンは押せない「体型 通常」）。親の許可は、始める前のロビーで選ぶあいだも `Host.allow` で審判へ渡す。選んだ体型は `asobibako:yappari-chameleon:body`（`prefs.ts` の `BODY_KEY`）に覚え、つないだときにも送る。体の動きの知らせ（`me`）には大きさを載せず、親と各端末は様子から `scaleOf`（体型 → 倍率）と `liveScale`（ロビーと隠れる役のあいだだけ体型、ハンターと観戦は 1。増え鬼でハンターになると通常の体）で倍率を引き、`Body.scale`（歩きのカプセルの半径と高さ。段を上れる高さ・速さ・跳ぶ高さは通常と同じ）と `Placeable.scale`（`placement` の張り付きのずらしと `sink` の深さ・`frames` と `capsules` の撃たれる当たり・埋まり・見落としの体の点・`placeRoot` の人形の根元）に流す。答え合わせの見つかったときの体とダブルの残した体は、隠れたときの体型の大きさ（`Session` の `#pinScale`）。歩きのカメラは見る中心の高さと距離を倍率どおりに縮め、画面の中の体の大きさを通常とそろえる（ペイントのカメラの距離の範囲と透かしの窓も同じ）。吹き付けは骨で曲げる前の体の座標なので、筆の半径を倍率で割って屋敷の中で通常と同じ大きさにする（人の `Stroke` と隠れる CPU）。ひとりで試すは通常の体のまま。
```

「強さの数字は `cpu/levels.ts` の `SKILLS`。」の文の前に、次の文を足す。

```markdown
CPU と遊ぶでプチカメレオンを許すと隠れる CPU は全員プチになり（CPU が送るのは `Bot.step` の中だけなので、体型は `Crew.play` が `Host.start` の 3 つめの引数で決め打つ）、候補は同じ表から壁の候補だけ壁へ 0.1m 寄せて置き（`cpu/spots.ts` の `SPOTS_OF`）、目立ちの表（`cpu/spot-seen.ts` の `SEEN`）は体型ごとに `pnpm spots --body petit` で測る。探す CPU は視野と遮りと狙う点を体の大きさの体の点で測り、小さい体は同じ大きさの体が遠くにいるのと同じ見え方として、怪しさの足し方と届き 30m の判定を「距離 ÷ 倍率」の実効の距離で見る（目立ちは描いた絵の色の違う割合で、測り方は体型によらない）。
```

- [ ] **Step 2: 全体を通す**

Run: `pnpm verify`
Expected: PASS（lint・check・test:run・vitals・build）。`pnpm vitals --diff` で警告が出たら、指された所を直してから回し直す。

- [ ] **Step 3: コミットする**

```bash
git add CLAUDE.md
git commit -m "Describe the petit chameleon body type in CLAUDE.md"
```
