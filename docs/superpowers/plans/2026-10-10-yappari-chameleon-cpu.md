# やっぱりカメレオン CPU と遊ぶ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** iPad 1 台だけで、CPU 1〜2 人を相手に 1 試合を最後まで遊べるようにする。隠れる（CPU が探す）と探す（CPU が隠れる）の 2 つの遊び方、通常と増え鬼、強さ 3 段。

**Architecture:** CPU は「手元でつないだ見えない子」として親の端末の席 2・3 に座る。`cpu/pipe.ts` の手元の管を `Party.add` に渡し、`cpu/bot.ts` の `Bot` が `Party.guest` で子と同じ手順（`hello` に `look: 'cpu'`、席が決まったら `hi`）で入る。審判の `Host`・各端末の `Session`・ほかの人の体の `Remote`・知らせの形は変えず、足すのは `Host.start` の決め打ちのハンターと `Host.podium`、`Session.rigOf` だけ。頭脳（`cpu/hunter.ts`・`cpu/hider.ts`）は DOM と three を使わず、歩きは `move.ts` の `step`、視野と遮りは `oversight.ts` の `sight` と `rayLevel`、屋敷の当たりは `levelOf(mansion(seed))` で決める。3D に聞くこと（目立ち・面の色・体の表面）は `cpu/senses.ts` の `Senses` の口だけを通し、アプリでは `cpu/senses3d.ts` が親の端末の 3D で答え、テストでは決め打ちの偽物を差す。`cpu/crew.ts` の `Crew` が CPU を席に着け、`Yappari.svelte` の審判のループ（`hosting`）で CPU も進める。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、three 0.186、`src/lib/net/` の `Party`（手元の管でつなぐ）、vitest 4（`unit` は node、`dom` は happy-dom）、playwright-core（headless Chrome で撮る）。

**Spec:** `docs/superpowers/specs/2026-10-10-yappari-chameleon-cpu-design.md`（全体の設計は `docs/superpowers/specs/2026-10-08-yappari-chameleon-design.md`、本家の仕様は `docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md`、試合の決めごとは 2a・2b の設計）

## Global Constraints

- id は `yappari-chameleon`、フォルダは `src/lib/games/yappari-chameleon/` のまま。新しい頭脳は `src/lib/games/yappari-chameleon/cpu/` に置く。three はこのゲームの `load()` から読み込まれる本体の中でだけ import する。ゲームのフォルダの外のゲームを import しない。
- `net.ts` の `CHAMELEON_VERSION` は 3 のまま、`src/lib/net/party.svelte.ts` の `PROTOCOL` は 5 のまま変えない（知らせの形も屋敷の当たりも変えないため）。
- CPU は親の端末の席 2・3 に座る。`Party.add` は子を 2 つまで受けるので CPU は 2 人まで。CPU と遊ぶでは自分がいつも席 1。
- CPU の印は `hello` の `look: 'cpu'`。`Party.looks` が顔ぶれと一緒に配り、呼び名は席 2 が「CPU 1」、席 3 が「CPU 2」。
- `Host`・`Session`・`Remote`・知らせの形は変えない。足すのは `Host.start(settings, hunters?)`・`Host.podium`・`Session.rigOf(seat)` だけ。CPU の体は人の子と同じく `Remote` で描く。
- `Host.start` に渡すハンターの席は `rules.start` の `pickHunters` より先に効く。CPU と遊ぶでは、隠れるなら CPU 全員を、探すならプレイヤー（席 1）だけをハンターにする。ふつうのつないだ試合は今のまま台の希望で決める。
- 頭脳（`cpu/` の `senses3d.ts` 以外）は DOM と three を import しない。`cpu/guard.test.ts` が three を読み込めなくしてから `cpu/crew.ts` を読み込んで確かめる。three を使うのは `cpu/senses3d.ts` だけ。
- CPU が送るものは子と同じ。`me` は止まっていても 50ms（`SEND_MS`）ごと、ハンターは目の位置（`eye`）を付け、隠れる人は `eye: null`。`dabs` は隠れる CPU が隠れタイムに送る。`shot` の始まりは目の位置、筋（`from`）は銃口から。撃つ間の 2 秒（`COOLDOWN`）は CPU も自分で守る。
- `ready` は CPU が自分から押す。探す CPU は隠れタイムの始めに、隠れる CPU は場所に着いて塗りを送り終えてから、答え合わせは 5 秒（`REVEAL_READY`）たってから押す。見つかって観戦になった CPU も答え合わせで押す。
- CPU は知らせを受けた中では何も送らない。送るのは `Bot.step` の中だけ（親の `Host` の手続きの途中に割り込んで、古い様子を後から配らせないため）。手元の管は知らせを同じ呼び出しの中で渡す。
- 強さは「弱い」「普通」「強い」の 3 段で、値は `cpu/levels.ts` の `SKILLS`。撃つまでの迷いは 1.5・0.8・0.4 秒、狙いのずれは 3・1.5・0.5 度。目は弱いがはっきり違う色だけ（`diff` 0.25）、普通が少し違えば（0.12）、強いがわずかな違いも（0.05）。歩きは弱いがゆっくり（`pace` 0.6）で同じ所も見に行き、普通は決まった順、強いは走ってまだ見ていない部屋を先に回り、机や台の下をのぞける部屋（書斎・キッチン・ランドリー。`ROOMS` の `low`）の見回しでだけしゃがむ。隠れ場所は弱いが床に立つ・座る（段 0）、普通が壁ぎわ・家具の陰（段 1）、強いは壁や天井の張り付きも使う（段 1・2）。塗りは弱いが大きな筆（半径 0.12m）で色がずれて塗り残し、普通は色が合うが粗く（0.07m）、強いは細かく正確（0.035m）。
- 探す CPU は 0.25 秒（`CHECK`）ごとに、隠れている体が視野（縦 72 度・横は半角 52 度、`oversight.ts` の `inView`）・届き 30m（`SEARCH_REACH`、見落としポイントの 15m とは別）・遮り（`rayLevel`）を通るかを見る。通った体だけ `Senses.visible` に聞くので、1 体につき 1 秒に 4 回まで。
- 探す CPU が使う体の位置は、最後に視野・届き・遮りを通ったときのものだけ（`ctx.bodies` は親が中継した全員の本当の位置なので、見えないあいだに読むと透視になる）。追う先も狙う先もその位置で、撃つのは見えている体にだけ。見失ったら最後に見えた所まで行き、着いても見えなければそちらを向いて見回してから見回りに戻る。
- 目立ちは、CPU の目から 96 × 96 の絵を体ありと体なしで 2 枚描き、色が `diff` より違う画素の割合。体が絵の高さのおよそ 9 割に収まる画角で描く（遠さは頭脳が別に数える）。
- 口笛（`toot`）を聞いた探す CPU は、口笛の場所から遠いほど・強さが低いほど大きくずらした先へ向かう。ずらす量は `stray.base + stray.far × 距離` の半分から全部で、強いでも 0.5m を下回らない。
- 答え合わせでは CPU は撃たず、その場で見回すだけ。
- 隠れる CPU は隠れタイムの始めに、歩かずに選んだ場所へ置く。2 人なら別々の部屋。候補は試合の種で候補ごとの `slack`（0.25m まで）だけずらして置き、ずらしたどこでもどの種でも埋まらず（`embedded`）、動く物の置き場所の候補のどれにもかからない。塗りは部屋の戸口あたりの目の高さ（`spots.ts` の `viewOf`）から体を通した先の面の色で吹き、20 秒（`PAINT_SECS`）以内に塗り終える（隠れタイムの最短 30 秒に収める）。
- 増え鬼で見つかった隠れる CPU は、破片が消える 1.5 秒（`SHATTER_SECS`）のあと、隠れていた場所の真下の床から探す CPU になる。
- 画面の言葉は漢字まじり。入口に「CPU と遊ぶ」、選ぶ画面は「CPU の設定」で「役」（隠れる・探す）・「CPU の人数」（1・2）・「ゲームモード」（通常・増え鬼）・「強さ」（弱い・普通・強い）と「ゲームを始める」。隠れるでは増え鬼を選べず、ダブルは CPU と遊ぶでは選べない。
- CPU と遊ぶは、始めるとロビーに出ずに紹介へ進む。紹介の 3 秒を 3D を作るあいだに過ぎさせないよう、試合は `Session` ができてから始める（`Crew.queue` と `Crew.go`）。答え合わせのあとはふつうと同じくロビーへ戻り、ロビーの上の帯の「マップの設定」の横に「CPU の設定」を出す。CPU と遊ぶでは「なかまを呼ぶ」と「よびなおす」を出さず、ロビーの台はハンター希望に使わない（`Host.podium = false`）。左上の ✕ の確かめは今のまま「抜ける」で入口へ戻る。
- 選んだものは `asobibako:yappari-chameleon:cpu`（`prefs.ts` の `CPU_KEY`）に覚える。好みなので `src/lib/backup.ts` の「記録あり」には数えない。
- コンポーネントは 200 行未満。抑制コメントは使わない。絵文字は使わない。
- コメントは非自明な WHY だけ（隠れた制約・workaround の理由・驚く挙動）を日本語で書く。WHAT・変更履歴・タスク番号は書かない。
- 指は `pointerdown` と `pointerId` で扱う。スティックの指を置いたまま押すボタンは `onpointerdown` で受ける（設定の画面のように止まって押すものは今の `onclick` のまま）。
- 各タスクの終わりに `pnpm format` で整えてから `pnpm lint`・`pnpm check`・`pnpm test:run` を通す。最後のタスクで `pnpm verify` を通す。
- コミットのメッセージは英語で、`Co-Authored-By` などの署名の行は付けない。
- ブラウザは built-in browser（`mcp__Claude_Browser__*`）だけを使い、Claude in Chrome は使わない。dev サーバーは `pnpm dev --port 5180` で起動し、`preview_start` には頼らない。
- 見た目と通しの確かめは headless Chrome（`playwright-core`、`channel: 'chrome'`、GPU は `--use-angle=metal`）で撮る。built-in browser は隠れると `requestAnimationFrame` が止まる。撮るスクリプトは scratchpad（`/private/tmp/claude-501/-Users-oekazuma-localRepo-asobibako--claude-worktrees-meccha-chameleon-clone-51ef75/ec70cc60-b8f6-4d7c-9a9d-7944e6622daa/scratchpad`、以下 `<scratchpad>`）に置き、リポジトリには入れない。

## Review Focus

1. 隠れタイムを最短の 30 秒にする。隠れる CPU の塗りが隠れタイムより長いと、CPU が「隠れタイムを飛ばす」を押さず、探索に入っても塗り続ける。`HiderBrain` は塗りの速さを `PAINT_SECS`（20 秒）に収まるよう上げ、隠れタイムでなくなったら塗るのをやめる。Task 9 の「点が多くても 20 秒で塗り終える」「隠れタイムでなくなったら塗るのをやめる」と、Task 10 の「隠れタイムが最短の 30 秒でも」で確かめる。
2. CPU と遊ぶのロビーで「マップの設定」から「ゲームを始める」を押す。ここで `session.start(settings)` を呼ぶと、決め打ちのハンターが渡らず `pickHunters` に落ち、隠れるを選んだのにプレイヤーがハンターになることがある。マップの設定でダブルを選べても困る。Lobby は CPU と遊ぶではどちらから始めても `crew.play` に渡し、マップの設定のモードとハンターの人数の行を出さない。`cpuSettings` がモードを決め直す。Task 10 の `cpuSettings` のテストと、Task 13 の「マップの設定から始めても」で確かめる。
3. 試合のあとで CPU の人数を 2 から 1 に減らして始める。閉じた管の席は `Party.away` に入り、`Party` の `#drop` はマイクロタスクで走るので、待たずに `host.start` すると抜ける途中の席が顔ぶれに残る。`Crew.seat` は閉じた管の `gone` を待ってから進め、Overlay は CPU と遊ぶでは `Invite` を出さない（出すと「CPU 2の接続が切れました」と「よびなおす」が出る）。Task 10 の「人数を 2 → 1 → 2 と変えても」と、Task 13 の「よびなおすを出さない」で確かめる。
4. 試合の途中で ✕ の「抜ける」を押す、ページを閉じる。`Crew.stop` が CPU の管を閉じて審判のループからも外し、閉じたあとの `step` は何も送らない。ページを閉じたとき（`party.close()` が先に管を閉じる）も、`Bot.step` は `party.lost` を見て止まる。Task 10 の「抜けると CPU も止まる」と、Task 14 の「抜けてからもう一度 CPU と遊ぶ」で確かめる。
5. 縦持ちにして描くのを止めているあいだ。審判と CPU は進むが `Session.frame` が止まるので、親の端末の 3D の体は古い場所とポーズのまま残る。`Senses3d` は最後に描いてから 250ms たつと `null` を返し、隠れる CPU は塗るのを待ち、探す CPU は目立ちを 0 とみなして動いた体にだけ気づく。Task 7 の「3D が描けていないあいだも、動く体には気づく」、Task 9 の「3D の体がまだ無いあいだは待つ」、Task 11 の「描くのを止めると null」で確かめる。

---

## ファイルの地図

| ファイル                                                                                                                                     | 持つもの                                                                             | タスク |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ |
| `yappari-chameleon/referee.ts`                                                                                                               | `start` の決め打ちのハンター・`SHATTER_SECS`                                         | 1, 10  |
| `yappari-chameleon/host.ts`                                                                                                                  | `start(settings, hunters?)`・`podium`                                                | 1      |
| `yappari-chameleon/match.svelte.ts`                                                                                                          | `nameOf(seat, looks)`・`Match.name`・`winnerText(v, looks)`                          | 2      |
| `Lobby.svelte`・`Plates.svelte`・`Ranking.svelte`・`Overlooked.svelte`・`Spotted.svelte`・`Iine.svelte`・`Spectate.svelte`・`Overlay.svelte` | CPU の呼び名                                                                         | 2      |
| `yappari-chameleon/cpu/pipe.ts`                                                                                                              | 手元の管 2 本の組                                                                    | 3      |
| `yappari-chameleon/cpu/bot.ts`                                                                                                               | CPU の子（入る手順・役とフェーズ・体を送る・押す・頭脳の載せ替え・増え鬼で探す側へ） | 3, 10  |
| `yappari-chameleon/cpu/guard.test.ts`                                                                                                        | 頭脳が three と DOM を使わないこと                                                   | 3, 10  |
| `yappari-chameleon/cpu/paths.ts`                                                                                                             | 道順の網の点と辺・部屋ごとの見回す点・近い点・最短の道                               | 4      |
| `yappari-chameleon/cpu/walker.ts`                                                                                                            | 網に沿って `step` で歩く・詰まったらひとつ前の点へ戻る                               | 5      |
| `yappari-chameleon/move.ts`・`play.svelte.ts`                                                                                                | 目の高さ `EYE_HEIGHT` としゃがむ深さ `CROUCH` を three の無い所へ                    | 6      |
| `yappari-chameleon/cpu/levels.ts`                                                                                                            | 強さの表 `SKILLS`・`STRENGTHS`・`CpuChoice`・`CPU_DEFAULT`                           | 6      |
| `yappari-chameleon/cpu/senses.ts`                                                                                                            | 頭脳が 3D に聞く口 `Senses` と、頭脳に渡す `Ctx`                                     | 6      |
| `yappari-chameleon/cpu/hunter.ts`                                                                                                            | 探す頭脳（見回り・口笛・埋まりの矢印・気づく・撃つ・試し撃ち）                       | 6, 7   |
| `yappari-chameleon/oversight.ts`                                                                                                             | `sight` の届きを渡せるように                                                         | 7      |
| `yappari-chameleon/cpu/spots.ts`                                                                                                             | 隠れ場所の候補・見られる位置・場所選び                                               | 8      |
| `yappari-chameleon/cpu/hider.ts`                                                                                                             | 隠れる頭脳（置く・まわりの色で塗る）                                                 | 9      |
| `yappari-chameleon/cpu/crew.ts`                                                                                                              | CPU を席に着ける・試合を始める・ループで進める・止める                               | 10     |
| `yappari-chameleon/session.svelte.ts`                                                                                                        | `SHATTER_SECS` を referee から・`rigOf`                                              | 10, 11 |
| `yappari-chameleon/world3d.ts`                                                                                                               | `renderedAt`・CPU の目で描く `look`・屋敷の面の色 `pickStage`                        | 11     |
| `yappari-chameleon/cpu/senses3d.ts`                                                                                                          | 親の端末の 3D で `Senses` に答える                                                   | 11     |
| `yappari-chameleon/prefs.ts`・`src/lib/backup.ts`                                                                                            | CPU の設定を覚える・記録ありに数えない                                               | 12     |
| `CpuSetup.svelte`・`Settings.svelte`                                                                                                         | CPU の設定の画面・マップの設定の CPU 向けの形                                        | 12     |
| `Entry.svelte`・`Yappari.svelte`・`Online.svelte`・`Overlay.svelte`・`Lobby.svelte`                                                          | 入口の「CPU と遊ぶ」・CPU の試合の始まり・ロビーの「CPU の設定」                     | 13     |
| scratchpad の `cpu/senses-check.mjs`・`cpu/e2e-cpu.mjs`・`cpu/perf-cpu.mjs`                                                                  | 本物の 3D の目と筆・通しの試合・重さ                                                 | 11, 14 |
| `CLAUDE.md`                                                                                                                                  | ゲームの説明                                                                         | 15     |

想定のタスクの並びから直したところ。

- 道順の網は「ロビー・控室から全部屋へ」を確かめない。ロビーと控室は出口の無い部屋で、人のハンターも探索の始めに入口（`SPAWNS.entrance`）へ移されるので、CPU も同じく入口から歩き出す。網のテストは入口の 3 席から全部屋へ行けることを見る。
- 「どの種でも通れる」は、種ごとに歩かせる代わりに、動く物を置き場所の候補の全部へ同時に置いた屋敷で 1 度歩かせて確かめる（どの種の置き方もこの屋敷の一部なので、ここで歩ければどの種でも歩ける。種ごとより速い）。
- 気づきと撃つは見回りと分けて 2 つのタスクにし（Task 6・7）、CPU の子に頭脳を載せるのは `Crew` と通しの試合と同じタスクにした（Task 10）。どちらも差し戻しの単位を小さくするため。
- 計画を書くときに、網・歩く・探す・隠れ場所・隠れる・CPU の子・通しの試合のコードとテスト（Task 3・4・5・6・7・8・9・10。Task 2 の `Match.name` を見る 1 行を除く）を scratchpad の `cpuplan/` で今のコードに当てて通してある（審判は Task 1 の変更を写したもの）。網の点と隠れ場所の候補は、この形で通った値。
- 呼び名は `nameOf` の呼び出しごとに `looks` を渡す代わりに、`Match.name(seat)` を足して部品からはそれを呼ぶ（`Match` は顔ぶれの `Party` を見られる）。

---

### Task 1: 審判の決め打ちのハンターと、台の希望を切る口

**Files:**

- Modify: `src/lib/games/yappari-chameleon/referee.ts`
- Modify: `src/lib/games/yappari-chameleon/host.ts`
- Test: `src/lib/games/yappari-chameleon/referee.test.ts`、`src/lib/games/yappari-chameleon/host.test.ts`

**Interfaces:**

- Produces: `start(m: Match, members: Seat[], settings: Settings, rand: () => number, hunters?: Seat[]): void`。`hunters` のうち `members` にいる席を、ハンターと隠れる人の両方が残るときだけそのままハンターにし、ほかは今の `pickHunters`。ダブルでは使わない。
- Produces: `Host.start(settings: rules.Settings, hunters?: Seat[]): void`、`Host.podium: boolean`（既定 true。false ならロビーで台に乗った人をハンター希望にしない）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/referee.test.ts` の最後に足す。

```ts
describe('決め打ちのハンター', () => {
  it('渡した席をハンターにし、台の希望は使わない', () => {
    const m = newMatch();
    wish(m, 1, true);
    start(m, ALL, { ...DEFAULTS, mode: 'normal', hunters: 1 }, zero, [3, 2]);
    expect(m.roles).toEqual({ 1: 'hider', 2: 'hunter', 3: 'hunter' });
    expect(m.first).toEqual([2, 3]);
    expect(m.hid).toEqual([1]);
    expect(m.taunts).toEqual({ 1: 0 });
  });

  it('いない席は外し、全員か誰も残らなければ台の希望で選ぶ', () => {
    const a = newMatch();
    start(a, [1, 2], DEFAULTS, zero, [2, 3]);
    expect(a.first).toEqual([2]);
    const b = newMatch();
    wish(b, 3, true);
    start(b, ALL, DEFAULTS, zero, [1, 2, 3]);
    expect(b.first).toEqual([3]);
    const c = newMatch();
    wish(c, 3, true);
    start(c, ALL, DEFAULTS, zero, []);
    expect(c.first).toEqual([3]);
  });

  it('ダブルでは渡しても最初のハンターはいない', () => {
    const m = newMatch();
    start(m, ALL, { ...DEFAULTS, mode: 'double' }, zero, [2]);
    expect(m.first).toEqual([]);
    expect(m.roles).toEqual({ 1: 'hider', 2: 'hider', 3: 'hider' });
  });
});
```

`src/lib/games/yappari-chameleon/host.test.ts` の `describe('Host の試合', ...)` の最後に足す。

```ts
it('決め打ちのハンターで始め、台に乗った人がいても使わない', () => {
  const { host, act, told } = setup();
  act(me(0, [PODIUM.at[0], PODIUM.h, PODIUM.at[2]]), 3);
  host.tick(0.1);
  host.start({ ...DEFAULTS, mode: 'normal' }, [2]);
  expect(lastView(told).roles).toEqual({ 1: 'hider', 2: 'hunter', 3: 'hider' });
});

it('podium を切ると、ロビーで台に乗ってもハンター希望にしない', () => {
  const { host, act, told } = setup();
  host.podium = false;
  act(me(0, [PODIUM.at[0], PODIUM.h, PODIUM.at[2]]), 3);
  host.tick(0.1);
  host.tick(1);
  expect(lastView(told).wishes).toEqual([]);
  host.podium = true;
  host.tick(0.1);
  expect(lastView(told).wishes).toEqual([3]);
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/referee.test.ts src/lib/games/yappari-chameleon/host.test.ts`
Expected: 足したテストが FAIL（`start` が 5 つめの引数を見ず台の希望で選ぶ。`podium` が無い）。

- [ ] **Step 3: referee.ts の start に決め打ちのハンターを足す**

`src/lib/games/yappari-chameleon/referee.ts` の `start` の頭を次にする（`Object.assign` から下は今のまま）。

```ts
/**
 * 試合を始める。hunters を渡すと、そのうち members にいる席をハンターにする（CPU と遊ぶ）。
 * ハンターと隠れる人の両方が残らないときは、渡さなかったときと同じく台の希望で選ぶ
 */
export function start(m: Match, members: Seat[], settings: Settings, rand: () => number, hunters?: Seat[]): void {
  const s = fit(settings, members.length);
  const double = s.mode === 'double';
  const chosen = (hunters ?? []).filter((seat) => members.includes(seat)).sort((a, b) => a - b);
  const fixed = chosen.length > 0 && chosen.length < members.length;
  // ダブルは全員が隠れてから全員で探すので、最初のハンターはいない
  const picked = double ? [] : fixed ? chosen : pickHunters(m.wishes, members, s.hunters, rand);
  const hiders = members.filter((seat) => !picked.includes(seat));
```

続く `Object.assign` の中の `hunters` を `picked` にする（`roles` の `hunters.includes(seat)` と `first: hunters`）。

```ts
  Object.assign(m, {
    phase: 'intro',
    left: INTRO,
    settings: s,
    roles: Object.fromEntries(members.map((seat) => [seat, picked.includes(seat) ? 'hunter' : 'hider'])),
    first: picked,
```

- [ ] **Step 4: host.ts に hunters と podium を足す**

`src/lib/games/yappari-chameleon/host.ts` の `class Host` の `#stop: () => void;` の下に足す。

```ts
/** ロビーで台に乗った人をハンター希望にする。CPU と遊ぶではハンターを CPU の設定で決めるので切る */
podium = true;
```

`start` を次にする。

```ts
  start(settings: rules.Settings, hunters?: Seat[]): void {
    if (this.match.phase !== 'lobby' || this.#port.members.length < 2) return;
    rules.start(this.match, [...this.#port.members], settings, this.#rand, hunters);
    this.#push(true);
  }
```

`#watch` のロビーの行を次にする。

```ts
rules.wish(m, seat, this.podium && !!me && onPodium(me));
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（ふつうの試合は `hunters` を渡さないので、今のテストは変わらない）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Let the referee start with fixed hunters and turn off podium wishes"
```

---

### Task 2: CPU の呼び名

**Files:**

- Modify: `src/lib/games/yappari-chameleon/match.svelte.ts`
- Modify: `src/lib/games/yappari-chameleon/session.svelte.ts`（`Match` に顔ぶれの動物を渡す）
- Modify: `src/lib/games/yappari-chameleon/Lobby.svelte`、`Plates.svelte`、`Ranking.svelte`、`Overlooked.svelte`、`Spotted.svelte`、`Iine.svelte`、`Spectate.svelte`、`Overlay.svelte`
- Test: `src/lib/games/yappari-chameleon/match.svelte.test.ts`、`src/lib/games/yappari-chameleon/Plates.svelte.test.ts`、`src/lib/games/yappari-chameleon/Lobby.svelte.test.ts`、`src/lib/games/yappari-chameleon/Spotted.svelte.test.ts`（新しく作る）

**Interfaces:**

- Produces: `nameOf(seat: Seat, looks?: Record<number, string>): string`（`looks[seat] === 'cpu'` なら `CPU ${seat - 1}`、ほかは `プレイヤー${seat}`）。`new Match(me: () => Seat, looks?: () => Record<number, string>)`、`Match.name(seat: Seat): string`。`winnerText(v: View, looks?: Record<number, string>)`。
- Produces: `Plates.svelte` の props に `name?: (seat: Seat) => string`（既定 `nameOf`）。

CPU と遊ぶでは自分がいつも席 1 なので、席の番号から 1 を引くと CPU の何人めかになる。`Invite.svelte` は CPU と遊ぶでは出さない（Task 13）ので `nameOf` のまま。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/match.svelte.test.ts` の import を `import { Match, MODES, nameOf, winnerText } from './match.svelte';` にし（`Seat` の型の import が無ければ `import type { Seat } from '$lib/net/party.svelte';` も足す）、`describe('Match', ...)` の最後に足す。

```ts
it('CPU の席は CPU 1・CPU 2、ほかはプレイヤー N と呼ぶ（席 2 が CPU 1）', () => {
  const looks = { 2: 'cpu', 3: 'cpu' };
  const m = new Match(
    () => 1,
    () => looks
  );
  expect(([1, 2, 3] as Seat[]).map((s) => m.name(s))).toEqual(['プレイヤー1', 'CPU 1', 'CPU 2']);
  expect(nameOf(2)).toBe('プレイヤー2');
  expect(nameOf(3, { 3: 'cat' })).toBe('プレイヤー3');
  expect(new Match(() => 1).name(2)).toBe('プレイヤー2');
});

it('ダブルの勝者の言葉も CPU の名前で呼ぶ', () => {
  const v = view(newMatch());
  expect(winnerText({ ...v, winner: 'double', champ: 2 }, { 2: 'cpu' })).toBe('勝者 CPU 1!');
});
```

`src/lib/games/yappari-chameleon/Plates.svelte.test.ts` の `describe('Plates', ...)` の最後に足す。

```ts
it('名前を渡せば、その名前で札を出す', () => {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Plates, {
    target,
    props: { plates: [{ seat: 2, x: 0, y: 0, likes: 0 }], name: (seat: number) => `CPU ${seat - 1}` }
  });
  flushSync();
  expect(target.querySelector('.plate')?.textContent).toContain('CPU 1');
  unmount(app);
});
```

`src/lib/games/yappari-chameleon/Spotted.svelte.test.ts` を作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import { Match } from './match.svelte';
import { DEFAULTS, newMatch, view } from './referee';
import Spotted from './Spotted.svelte';

describe('Spotted', () => {
  it('見落とされた場所の名前は、CPU なら CPU N で出す', () => {
    const match = new Match(
      () => 1,
      () => ({ 2: 'cpu' })
    );
    match.receive({
      ...view(newMatch()),
      phase: 'reveal',
      settings: DEFAULTS,
      hid: [1, 2],
      roles: { 1: 'hunter', 2: 'hider' }
    });
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Spotted, { target, props: { match } });
    flushSync();
    expect(target.textContent).toContain('CPU 1');
    expect(target.textContent).toContain('プレイヤー1');
    unmount(app);
  });
});
```

`src/lib/games/yappari-chameleon/Lobby.svelte.test.ts` の `show` で作る `session` に `match` を足す（import に `import { Match } from './match.svelte';` を足す）。

```ts
const session = { party: { host, members }, match: new Match(() => 1), start } as unknown as Session;
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/match.svelte.test.ts src/lib/games/yappari-chameleon/Plates.svelte.test.ts src/lib/games/yappari-chameleon/Spotted.svelte.test.ts`
Expected: FAIL（`Match.name` が無い。`Plates` が `name` を使わない。`Spotted` が `プレイヤー2` と出す）。

- [ ] **Step 3: match.svelte.ts に呼び名を足す**

`src/lib/games/yappari-chameleon/match.svelte.ts` の `nameOf` と `winnerText` を次にする。

```ts
/** 席の呼び名。CPU と遊ぶでは自分がいつも席 1 なので、CPU は席 2 から順に CPU 1・CPU 2 */
export const nameOf = (seat: Seat, looks: Record<number, string> = {}) =>
  looks[seat] === 'cpu' ? `CPU ${seat - 1}` : `プレイヤー${seat}`;

/** 答え合わせの勝者の言葉。決着の前は null */
export function winnerText(v: View, looks: Record<number, string> = {}): string | null {
  if (!v.winner) return null;
  if (v.winner === 'double') return v.champ === null ? '勝者なし' : `勝者 ${nameOf(v.champ, looks)}!`;
  return WINNER[v.winner];
}
```

`class Match` の `readonly #me: () => Seat;` の下に足し、constructor を次にする。

```ts
  // 動物（CPU の印）は顔ぶれと一緒に Party へ届くので、値ではなく関数で受ける
  readonly #looks: () => Record<number, string>;

  constructor(me: () => Seat, looks: () => Record<number, string> = () => ({})) {
    this.#me = me;
    this.#looks = looks;
  }

  name(seat: Seat): string {
    return nameOf(seat, this.#looks());
  }
```

- [ ] **Step 4: Session と部品を呼び名に替える**

`src/lib/games/yappari-chameleon/session.svelte.ts` の constructor の `this.match = new Match(() => party.me);` を次にする（テストの偽の Party は `looks` を持たない）。

```ts
this.match = new Match(
  () => party.me,
  () => party.looks ?? {}
);
```

`src/lib/games/yappari-chameleon/Plates.svelte` の script を次にし、本文の `{nameOf(p.seat)}` を `{name(p.seat)}` にする。

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Seat } from '$lib/net/party.svelte';
  import { nameOf } from './match.svelte';
  import type { Plate } from './session.svelte';

  let { plates, name = nameOf }: { plates: Plate[]; name?: (seat: Seat) => string } = $props();
</script>
```

`src/lib/games/yappari-chameleon/Overlay.svelte` の `<Plates plates={session.plates} />` を `<Plates plates={session.plates} name={(seat) => match.name(seat)} />` に、`const won = $derived(winnerText(match.view));` を `const won = $derived(winnerText(match.view, session.party.looks));` にする。

`Ranking.svelte`・`Overlooked.svelte`・`Spotted.svelte` は `{nameOf(r.seat)}` を `{match.name(r.seat)}` にし、import を `import type { Match } from './match.svelte';` にする。

`Iine.svelte` は本文の `nameOf(seat)`（2 か所）を `match.name(seat)` にし、`import { nameOf } from './match.svelte';` を消す。`Spectate.svelte` は `nameOf(watching)` を `session.match.name(watching)` にし、同じ import を消す。

`Lobby.svelte` の `<p>{party.members.map(nameOf).join('・')}…` を次にし、`import { nameOf } from './match.svelte';` を消す。

```svelte
<p>{party.members.map((seat) => session.match.name(seat)).join('・')}（{party.members.length}/3人）</p>
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（`Overlay.svelte.test.ts` の偽の Party は `looks` を持たないが、`winnerText` の既定の `{}` で読む）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Call CPU seats CPU 1 and CPU 2 on plates, rankings and the lobby bar"
```

---

### Task 3: 手元の管と CPU の子の土台

**Files:**

- Create: `src/lib/games/yappari-chameleon/cpu/pipe.ts`
- Create: `src/lib/games/yappari-chameleon/cpu/bot.ts`
- Test: `src/lib/games/yappari-chameleon/cpu/pipe.test.ts`、`src/lib/games/yappari-chameleon/cpu/bot.test.ts`、`src/lib/games/yappari-chameleon/cpu/guard.test.ts`

**Interfaces:**

- Consumes: Task 1 の `Host.start(settings, hunters)`。Task 2 の `Match.name`。
- Produces: `pipes(): [Pipe, Pipe]`（2 端の手元の管。`send` は JSON で写して相手の聞き手へ同じ呼び出しの中で渡し、聞き手が付くまでためる。どちらの端の `close` でも両方の `closed` が済み、閉じたあとは送らない）。
- Produces: `class Bot { constructor(pipe: Pipe); readonly party: Party; readonly match: Match; readonly bodies: Map<Seat, Me>; readonly gone: Promise<void>; step(dt: number, now: number): void; close(): void }`、`REVEAL_READY = 5`。

`Party.add` の手順は、子の `hello` を受けると `seat` → `members` → 親の手元の `join` → `Host.welcome`（全員の体・塗り・試合の様子）の順に送る。CPU はここまでを受けるだけで、`hi` と体は次の `step` で送る。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/cpu/pipe.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import { pipes } from './pipe';

describe('手元の管', () => {
  it('送った知らせは JSON で写して相手へ渡し、聞き手が付くまでためる', () => {
    const [a, b] = pipes();
    const box = { n: [1] };
    a.send({ t: 'x', box });
    box.n.push(2);
    const got: Message[] = [];
    b.on((m) => got.push(m));
    expect(got).toEqual([{ t: 'x', box: { n: [1] } }]);
    a.send({ t: 'y' });
    expect(got.map((m) => m.t)).toEqual(['x', 'y']);
  });

  it('どちらの端から閉じても両方が閉じ、閉じたあとは送らない', async () => {
    const [a, b] = pipes();
    const got: Message[] = [];
    a.on((m) => got.push(m));
    b.close();
    await a.closed;
    b.send({ t: 'x' });
    expect(got).toEqual([]);
  });
});
```

`src/lib/games/yappari-chameleon/cpu/bot.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import { Party, type Seat } from '$lib/net/party.svelte';
import { Host } from '../host';
import { levelOf, mansion, SPAWNS } from '../mansion/layout';
import type { Me } from '../net';
import { DEFAULTS, INTRO } from '../referee';
import { Bot, REVEAL_READY } from './bot';
import { pipes } from './pipe';

/** 親の Party と審判に、手元の管で CPU を n 人座らせる。審判と CPU は同じ時計で 0.05 秒ずつ進める */
async function table(n: number) {
  const clock = { ms: 0 };
  const party = Party.host();
  const host = new Host(
    party,
    (seed) => levelOf(mansion(seed)),
    () => clock.ms,
    () => 0
  );
  const told: Message[] = [];
  party.onTell((m) => told.push(m));
  const bots: Bot[] = [];
  /** CPU ごとの、親へ送った知らせの種類 */
  const sends: string[][] = [];
  for (let i = 0; i < n; i++) {
    const [a, b] = pipes();
    const sent: string[] = [];
    const send = b.send;
    b.send = (m) => {
      sent.push(m.t);
      send(m);
    };
    sends.push(sent);
    bots.push(new Bot(b));
    await party.add(a);
  }
  const run = (secs: number) => {
    for (let t = 0; t < secs - 1e-9; t += 0.05) {
      clock.ms += 50;
      host.tick(0.05);
      for (const b of bots) b.step(0.05, clock.ms);
    }
  };
  const bodies = (seat: Seat) => told.filter((m) => m.t === 'me' && m.seat === seat) as unknown as Me[];
  return { party, host, bots, told, run, bodies, sends };
}

describe('CPU の子', () => {
  it('cpu の印を付けて入り、席 2・3 を受け、CPU の名前で顔ぶれに並ぶ', async () => {
    const { party, bots } = await table(2);
    expect(party.members).toEqual([1, 2, 3]);
    expect(party.looks).toEqual({ 2: 'cpu', 3: 'cpu' });
    expect(bots.map((b) => b.party.me)).toEqual([2, 3]);
    expect(bots[0].match.name(3)).toBe('CPU 2');
    expect(bots[0].match.synced).toBe(true);
  });

  it('知らせを受けた中では hello のほかに何も送らず、step で版を送ってから体を送る', async () => {
    const { sends, run, bodies } = await table(1);
    expect(sends[0]).toEqual(['hello']);
    run(0.05);
    expect(sends[0]).toEqual(['hello', 'hi', 'me']);
    expect(bodies(2).at(-1)!.pos).toEqual(SPAWNS.lobby[2]);
  });

  it('止まっていても 50ms ごとに体を送る', async () => {
    const { run, bodies } = await table(1);
    run(1);
    expect(bodies(2).length).toBeGreaterThanOrEqual(19);
    expect(bodies(2).length).toBeLessThanOrEqual(21);
    expect(bodies(2).at(-1)!.eye).toBeNull();
  });

  it('紹介ではハンターは控室、隠れる人は大広間に立つ', async () => {
    const { host, run, bodies } = await table(2);
    host.start({ ...DEFAULTS, mode: 'normal' }, [2]);
    run(0.1);
    expect(bodies(2).at(-1)!.pos).toEqual(SPAWNS.room[2]);
    expect(bodies(3).at(-1)!.pos).toEqual(SPAWNS.hall[3]);
  });

  it('ハンターの CPU は隠れタイムの始めに押し、答え合わせでは 5 秒たってから押す', async () => {
    const { host, party, run } = await table(2);
    host.start({ ...DEFAULTS, mode: 'normal', hide: 60, search: 60, reveal: 30 }, [2, 3]);
    run(INTRO + 0.1);
    expect(host.match.phase).toBe('hide');
    expect(host.match.ready).toEqual([2, 3]);
    party.act({ t: 'ready' });
    expect(host.match.phase).toBe('search');
    run(60);
    expect(host.match.phase).toBe('reveal');
    run(REVEAL_READY - 0.2);
    expect(host.match.ready).toEqual([]);
    run(0.4);
    expect(host.match.ready).toEqual([2, 3]);
  });

  it('閉じると親の顔ぶれから外れ、版ちがいを知らされても抜ける', async () => {
    const { party, bots } = await table(2);
    bots[1].close();
    await bots[1].gone;
    expect(party.members).toEqual([1, 2]);
    party.tell(2, { t: 'chameleon-mismatch' });
    await bots[0].gone;
    expect(party.members).toEqual([1]);
  });
});
```

`src/lib/games/yappari-chameleon/cpu/guard.test.ts` を作る。

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// 頭脳から先で three を読み込むと、ここで投げて import が失敗する
vi.mock('three', () => {
  throw new Error('three を読み込んだ');
});

describe('CPU の頭脳', () => {
  it('three を読み込まない', async () => {
    await expect(import('./bot')).resolves.toBeDefined();
  });

  it('DOM を使わない（3D に聞くのは senses3d.ts だけ）', () => {
    // vitest はリポジトリの根で走る（games.test.ts の static/thumbs と同じ読み方）
    const dir = 'src/lib/games/yappari-chameleon/cpu';
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'senses3d.ts');
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(readFileSync(`${dir}/${f}`, 'utf8'), f).not.toMatch(/\bdocument\.|\bwindow\./);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu`
Expected: FAIL（`./pipe` と `./bot` が無い）。

- [ ] **Step 3: 手元の管を書く**

`src/lib/games/yappari-chameleon/cpu/pipe.ts` を作る。

```ts
import type { Message } from '$lib/net/link';
import type { Pipe } from '$lib/net/party.svelte';

/**
 * 手元でつないだ 2 本の管。Link と同じく JSON で写して渡し（$state の配列を相手に持たせない）、最初の聞き手が付くまで
 * 届いた知らせをためる。知らせは送った呼び出しの中で渡すので、受けた側はその中で送り返さない（CPU は step でだけ送る）
 */
export function pipes(): [Pipe, Pipe] {
  const listeners = [new Set<(m: Message) => void>(), new Set<(m: Message) => void>()];
  const early: Message[][] = [[], []];
  let open = true;
  let close!: () => void;
  const closed = new Promise<void>((resolve) => (close = resolve));
  const end = (me: 0 | 1): Pipe => ({
    send: (m) => {
      if (!open) return;
      const copy = JSON.parse(JSON.stringify(m)) as Message;
      if (!listeners[1 - me].size) early[1 - me].push(copy);
      for (const l of listeners[1 - me]) l(copy);
    },
    on: (l) => {
      listeners[me].add(l);
      for (const m of early[me].splice(0)) l(m);
      return () => listeners[me].delete(l);
    },
    closed,
    close: () => {
      open = false;
      close();
    }
  });
  return [end(0), end(1)];
}
```

- [ ] **Step 4: CPU の子の土台を書く**

`src/lib/games/yappari-chameleon/cpu/bot.ts` を作る。

```ts
import type { Message } from '$lib/net/link';
import { Party, type Pipe, type Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { SPAWNS } from '../mansion/layout';
import { Match } from '../match.svelte';
import { CHAMELEON_VERSION, SEND_MS, type Me } from '../net';
import type { Phase, View } from '../referee';

/** 答え合わせで結果を見る間（秒）。CPU が押さないと、1 人では「ロビーへ戻る」が答え合わせの終わりまで進まない */
export const REVEAL_READY = 5;

/**
 * CPU の子。手元の管で親の Party に子と同じ手順で入り（hello に cpu の印、席が決まったら hi）、届いた試合の様子で
 * 役とフェーズを持ち、止まっていても 50ms ごとに体を送る（親は止まっているかの判定と、撃った時刻へのさかのぼりに体の列を使う）。
 * 知らせは管の送った呼び出しの中で届くので、受けた中で送ると親の手続きの途中に割り込む。送るのは step の中だけ
 */
export class Bot {
  readonly party: Party;
  readonly match: Match;
  /** ほかの人の最後の体（親が中継する） */
  readonly bodies = new Map<Seat, Me>();
  /** 管が閉じた。Party が閉じた管の席を外す手続きより後に済むので、待てば顔ぶれから外れている */
  readonly gone: Promise<void>;
  #hi = false;
  #phase: Phase | null = null;
  /** 今のフェーズに入ってからの秒 */
  #since = 0;
  #pressed = false;
  #sent = -Infinity;
  #rest: { pos: V3; yaw: number } | null = null;

  constructor(pipe: Pipe) {
    this.party = Party.guest(pipe, { look: 'cpu' });
    this.match = new Match(
      () => this.party.me,
      () => this.party.looks
    );
    this.gone = pipe.closed;
    this.party.onTell((m) => this.#receive(m));
  }

  #receive(m: Message) {
    if (m.t === 'phase') this.match.receive(m.view as View);
    else if (m.t === 'me' && m.seat !== this.party.me) this.bodies.set(m.seat as Seat, m as unknown as Me);
    else if (m.t === 'chameleon-mismatch') this.party.close();
  }

  step(dt: number, now: number): void {
    // 席が届くまで Party.me は 1 のまま（CPU は席 2 か 3 に座る）
    if (this.party.lost || this.party.me === 1) return;
    if (!this.#hi) {
      this.#hi = true;
      this.party.act({ t: 'hi', v: CHAMELEON_VERSION });
    }
    if (!this.match.synced) return;
    if (this.match.phase !== this.#phase) this.#enter(this.match.phase);
    this.#since += dt;
    if (!this.#pressed && this.#wantReady()) {
      this.#pressed = true;
      this.party.act({ t: 'ready' });
    }
    if (now - this.#sent < SEND_MS) return;
    this.#sent = now;
    const me = this.#me(now);
    if (me) this.party.act({ t: 'me', ...me });
  }

  #enter(p: Phase) {
    const m = this.match;
    this.#phase = p;
    this.#since = 0;
    this.#pressed = false;
    if (p === 'lobby') this.#rest = { pos: SPAWNS.lobby[m.me], yaw: 0 };
    // 人の子の Session と同じく、待っているハンターは控室、ほかは大広間で始める
    else if (p === 'intro') this.#rest = { pos: SPAWNS[m.role === 'hunter' ? 'room' : 'hall'][m.me], yaw: 0 };
  }

  #wantReady(): boolean {
    const m = this.match;
    if (m.view.ready.includes(m.me)) return false;
    if (m.phase === 'hide') return m.role === 'hunter';
    return m.phase === 'reveal' && this.#since >= REVEAL_READY;
  }

  #me(now: number): Me | null {
    const r = this.#rest;
    if (!r) return null;
    return {
      ms: now,
      pos: [...r.pos],
      yaw: r.yaw,
      cling: null,
      pose: 'stand',
      crouch: false,
      paint: false,
      look: [r.yaw, 0],
      eye: null
    };
  }

  close(): void {
    this.party.close();
  }
}
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu`
Expected: PASS。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/cpu
git commit -m "Seat CPU guests through an in-memory pipe with the same join steps as a device"
```

---

### Task 4: 道順の網

**Files:**

- Create: `src/lib/games/yappari-chameleon/cpu/paths.ts`
- Test: `src/lib/games/yappari-chameleon/cpu/paths.test.ts`

**Interfaces:**

- Produces: `NODES`（点の名前 → `V3`。床の高さに置く）、`type Node = keyof typeof NODES`、`EDGES: [Node, Node][]`、`ROOMS: { name: string; look: Node; toward: V3; low: boolean }[]`（見回る順の 6 部屋。`name` は `PLACES` の名前、`look` は見回す点、`toward` は見回すときに向く奥、`low` は机や台の下をのぞける部屋）。
- Produces: `nearest(at: V3): Node`（同じ部屋の点から近いもの。高さの差は 3 倍に数える）、`route(from: Node, to: Node, blocked?: ReadonlySet<string>): Node[]`（両端を含む最短の道。`blocked` は通れない辺 `"a>b"`。着けなければ `[]`）。

点は部屋の真ん中・戸口の前後・大階段の上下・回廊・家具のすき間に手で置く。動く物の置き場所の候補（`props.ts` の `SETS`）の全部に同時に物を置いた屋敷で、全部の辺を `step` で実際に歩けることを確かめる。どの種の置き方もこの屋敷の一部なので、ここで歩ければどの種でも歩ける。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/cpu/paths.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { levelOf, mansion, placeOf, PLACES, SPAWNS } from '../mansion/layout';
import { place, SETS } from '../mansion/props';
import { idle, newBody, step, WALK, type Body, type Level } from '../move';
import { EDGES, NODES, nearest, ROOMS, route } from './paths';

/** 動く物を、どの種でも置かれうる候補の全部に同時に置いた屋敷。ここを歩ければ、どの種の置き方でも歩ける */
function worst(): Level {
  const m = mansion();
  const fixed = m.pieces.slice(0, m.pieces.length - m.moving);
  const every = SETS.flatMap((set) =>
    set.slots.flatMap((slot) => set.units.flatMap((unit) => unit.map((q) => place(slot, q))))
  );
  return levelOf({ ...m, pieces: [...fixed, ...every] });
}

const DT = 1 / 30;
const flat = (b: Body, to: V3) => Math.hypot(to[0] - b.pos[0], to[2] - b.pos[2]);

/** from から to へまっすぐ歩かせる。歩く速さで掛かる時間に 3 秒足しても着かなければ、着いていない体のまま返す */
function walk(lv: Level, from: V3, to: V3): Body {
  const b = newBody(from);
  for (let i = 0; i < 5; i++) step(b, idle(), lv, DT);
  const limit = Math.hypot(to[0] - from[0], to[2] - from[2]) / WALK + 3;
  for (let t = 0; t < limit && flat(b, to) >= 0.2; t += DT) {
    const dx = to[0] - b.pos[0];
    const dz = to[2] - b.pos[2];
    const d = Math.hypot(dx, dz);
    step(b, { ...idle(), x: dx / d, z: dz / d }, lv, DT);
  }
  return b;
}

describe('道順の網', () => {
  const lv = worst();

  it('どの点も、置いた体が押されず床に立てる', () => {
    const bad: string[] = [];
    for (const [name, at] of Object.entries(NODES)) {
      const b = newBody(at);
      for (let i = 0; i < 10; i++) step(b, idle(), lv, DT);
      if (Math.hypot(b.pos[0] - at[0], b.pos[1] - at[1], b.pos[2] - at[2]) > 0.02) bad.push(name);
    }
    expect(bad).toEqual([]);
  });

  it('どの種の置き方でも、全部の辺を両向きに歩ける', () => {
    const bad: string[] = [];
    for (const [a, b] of EDGES)
      for (const [p, q] of [
        [a, b],
        [b, a]
      ] as const) {
        const body = walk(lv, NODES[p], NODES[q]);
        if (flat(body, NODES[q]) > 0.25 || Math.abs(body.pos[1] - NODES[q][1]) > 0.35) bad.push(`${p} → ${q}`);
      }
    expect(bad).toEqual([]);
  });

  it('探索の入口の 3 席から、入口の点へ歩ける', () => {
    for (const at of Object.values(SPAWNS.entrance))
      expect(flat(walk(lv, at, NODES.entrance), NODES.entrance)).toBeLessThan(0.25);
  });

  it('入口から屋敷の全部の部屋へ道があり、部屋ごとに見回す点を部屋の中に持つ', () => {
    const rooms = PLACES.map((p) => p.name).filter((n) => n !== '控室' && n !== 'ロビー');
    expect(ROOMS.map((r) => r.name).sort()).toEqual([...rooms].sort());
    for (const r of ROOMS) {
      expect(placeOf(NODES[r.look]), r.name).toBe(r.name);
      const path = route('entrance', r.look);
      expect(path[0]).toBe('entrance');
      expect(path.at(-1)).toBe(r.look);
      for (let i = 1; i < path.length; i++)
        expect(
          EDGES.some(([a, b]) => (a === path[i - 1] && b === path[i]) || (b === path[i - 1] && a === path[i])),
          `${path[i - 1]} → ${path[i]}`
        ).toBe(true);
    }
  });

  it('通れない辺を避けて道を選び、着けなければ空。同じ点なら 1 つ', () => {
    expect(route('hall', 'kitchen', new Set(['corridor>kitchenDoor']))).toEqual([]);
    expect(route('hall', 'hall')).toEqual(['hall']);
    expect(route('studySouth', 'studyEast', new Set(['studySouth>studyEast']))).toEqual([
      'studySouth',
      'studyDoor',
      'studyNorth',
      'studyEast'
    ]);
  });

  it('近い点は同じ部屋から選ぶ（壁の向こうの点を選ばない）', () => {
    expect(nearest([-16, 0, 7.3])).toBe('kitchen');
    expect(nearest([0, 3.5, 11.5])).toMatch(/^(stairTop|galleryWest|galleryEast)$/);
    expect(nearest(SPAWNS.entrance[2])).toBe('entrance');
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/paths.test.ts`
Expected: FAIL（`./paths` が無い）。

- [ ] **Step 3: 網を書く**

`src/lib/games/yappari-chameleon/cpu/paths.ts` を作る。

```ts
import type { V3 } from '$lib/sculpt';
import { placeOf } from '../mansion/layout';

/**
 * 探す CPU の歩く網の点。動く物の置き場所の候補（props.ts の SETS）のどれにもかからない所に置き、どの 2 点のあいだも
 * まっすぐ歩けるものだけを辺にする（paths.test.ts が候補の全部に物を置いた屋敷で歩かせて見る）
 */
export const NODES = {
  entrance: [0, 0, 0.6],
  hall: [0, 0, 2.2],
  hallWest: [-2, 0, 2.2],
  hallWestMid: [-2, 0, 5],
  westDoor: [-6.6, 0, 5],
  eastDoor: [6.2, 0, 6],
  stairTop: [0, 3.5, 9.6],
  galleryWest: [-4, 3.5, 10.5],
  galleryEast: [4, 3.5, 10.5],
  corridorEast: [-8.5, 0, 5],
  corridor: [-15.5, 0, 5],
  corridorWest: [-21.5, 0, 5],
  kitchenDoor: [-16, 0, 6.2],
  kitchen: [-16, 0, 8],
  kitchenWest: [-17.5, 0, 11],
  kitchenEast: [-13, 0, 11],
  kitchenNorth: [-15, 0, 13.2],
  laundryDoor: [-15, 0, 4],
  laundry: [-15, 0, 2.2],
  laundryEast: [-12, 0, 0],
  laundrySouthEast: [-11.8, 0, -3.4],
  laundryWest: [-18.6, 0, 1.6],
  laundrySouthWest: [-18, 0, -1.6],
  studyDoor: [8, 0, 6],
  studySouth: [12.25, 0, 4.2],
  studyNorth: [12.25, 0, 7.6],
  studyEast: [15.2, 0, 6]
} satisfies Record<string, V3>;

export type Node = keyof typeof NODES;

export const EDGES: [Node, Node][] = [
  ['entrance', 'hall'],
  ['hall', 'hallWest'],
  ['hallWest', 'hallWestMid'],
  ['hallWestMid', 'westDoor'],
  ['westDoor', 'corridorEast'],
  ['hall', 'eastDoor'],
  ['eastDoor', 'studyDoor'],
  ['hall', 'stairTop'],
  ['stairTop', 'galleryWest'],
  ['stairTop', 'galleryEast'],
  ['corridorEast', 'corridor'],
  ['corridor', 'corridorWest'],
  ['corridor', 'kitchenDoor'],
  ['kitchenDoor', 'kitchen'],
  ['kitchen', 'kitchenWest'],
  ['kitchen', 'kitchenEast'],
  ['kitchenWest', 'kitchenNorth'],
  ['kitchenEast', 'kitchenNorth'],
  ['corridor', 'laundryDoor'],
  ['laundryDoor', 'laundry'],
  ['laundry', 'laundryEast'],
  ['laundryEast', 'laundrySouthEast'],
  ['laundry', 'laundryWest'],
  ['laundryWest', 'laundrySouthWest'],
  ['studyDoor', 'studySouth'],
  ['studyDoor', 'studyNorth'],
  ['studySouth', 'studyEast'],
  ['studyNorth', 'studyEast']
];

/**
 * 見回る順の部屋。toward は見回すときに向く奥（左右へ振る中心）。low は机・台・棚の下をのぞける部屋
 * （強い CPU は、この部屋の見回しでだけしゃがむ）
 */
export const ROOMS: { name: string; look: Node; toward: V3; low: boolean }[] = [
  { name: '大広間', look: 'hall', toward: [0, 1, 7], low: false },
  { name: '2階の回廊', look: 'stairTop', toward: [0, 4, 11], low: false },
  { name: '書斎', look: 'studySouth', toward: [12.25, 1, 8], low: true },
  { name: '緑の廊下', look: 'corridor', toward: [-21, 1, 5], low: false },
  { name: 'キッチン', look: 'kitchen', toward: [-16, 1, 12], low: true },
  { name: 'ランドリー', look: 'laundry', toward: [-15, 1, -2], low: true }
];

// 回廊の下の床と回廊の上の点を取り違えないよう、高さの差は大きく数える
const far = (a: V3, b: V3) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 3, a[2] - b[2]);
const ALL = Object.keys(NODES) as Node[];

/** at にいちばん近い点。同じ部屋の点を先に見る（壁ぎわでは壁の向こうの点のほうが近いことがある） */
export function nearest(at: V3): Node {
  const place = placeOf(at);
  const same = ALL.filter((n) => placeOf(NODES[n]) === place);
  return (same.length ? same : ALL).reduce((a, b) => (far(NODES[a], at) <= far(NODES[b], at) ? a : b));
}

export function route(from: Node, to: Node, blocked: ReadonlySet<string> = new Set()): Node[] {
  const best = new Map<Node, number>([[from, 0]]);
  const back = new Map<Node, Node>();
  const open: Node[] = [from];
  while (open.length) {
    open.sort((a, b) => best.get(a)! - best.get(b)!);
    const n = open.shift()!;
    if (n === to) break;
    for (const [a, b] of EDGES)
      for (const [p, q] of [
        [a, b],
        [b, a]
      ] as const) {
        if (p !== n || blocked.has(`${p}>${q}`)) continue;
        const d = best.get(n)! + far(NODES[p], NODES[q]);
        if (d >= (best.get(q) ?? Infinity)) continue;
        best.set(q, d);
        back.set(q, n);
        if (!open.includes(q)) open.push(q);
      }
  }
  if (!best.has(to)) return [];
  const out: Node[] = [to];
  while (out[0] !== from) out.unshift(back.get(out[0])!);
  return out;
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/paths.test.ts`
Expected: PASS。「どの点も」か「全部の辺を」が名前を出して落ちたら、その点を部屋の中へ 0.2m ずつ動かすか、落ちた辺の途中の障りの手前に点を 1 つ足して辺を 2 本に分ける（点の名前は部屋と場所が分かるものにする）。`ROOMS` の `look` と、Task 8 の `spots.ts` の `VIEWS` が指す点は消さない。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/cpu
git commit -m "Lay a walkable path graph through the mansion for CPU hunters"
```

---

### Task 5: 網の上を歩く

**Files:**

- Create: `src/lib/games/yappari-chameleon/cpu/walker.ts`
- Test: `src/lib/games/yappari-chameleon/cpu/walker.test.ts`

**Interfaces:**

- Consumes: Task 4 の `NODES`・`nearest`・`route`。
- Produces: `class Walker { constructor(at: V3); readonly body: Body; path: Node[]; pace: number; run: boolean; go(to: Node): void; step(lv: Level, dt: number): number | null }`。`step` は進む向きの yaw（`atan2(x, z)`）を返し、歩いていなければ `null`。止まっていても `move.ts` の `step` で重力と床を回す。

止まって進めない（1 秒のあいだに 0.1m も近づかない）ときは、その辺を通れない辺として覚え、ひとつ前の点へ戻ってから選び直す。ほかに道が無ければ戻った点で止まる。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/cpu/walker.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { levelOf, mansion } from '../mansion/layout';
import type { Level } from '../move';
import { NODES } from './paths';
import { Walker } from './walker';

const lv = levelOf(mansion());
const DT = 1 / 30;
const flat = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** 道が尽きるまで歩かせ、掛かった秒を返す */
function run(w: Walker, secs: number, level: Level = lv): number {
  let t = 0;
  for (; t < secs && w.path.length; t += DT) w.step(level, DT);
  return t;
}

describe('Walker', () => {
  it('網の上の最短の道で、階段も上って行き先まで歩く', () => {
    const w = new Walker(NODES.entrance);
    w.go('kitchenNorth');
    run(w, 60);
    expect(flat(w.body.pos, NODES.kitchenNorth)).toBeLessThan(0.3);
    const up = new Walker(NODES.entrance);
    up.go('galleryEast');
    run(up, 30);
    expect(flat(up.body.pos, NODES.galleryEast)).toBeLessThan(0.3);
    expect(up.body.pos[1]).toBeCloseTo(3.5, 1);
  });

  it('歩くあいだは進む向きを返し、着いたら null', () => {
    const w = new Walker(NODES.hall);
    w.go('eastDoor');
    const yaw = w.step(lv, DT);
    expect(yaw).toBeCloseTo(Math.atan2(6.2, 3.8), 1);
    run(w, 10);
    expect(w.step(lv, DT)).toBeNull();
  });

  it('pace で遅く歩き、run で走る', () => {
    const time = (pace: number, fast: boolean) => {
      const w = new Walker(NODES.entrance);
      w.pace = pace;
      w.run = fast;
      w.go('corridorWest');
      return run(w, 120);
    };
    const walk = time(1, false);
    expect(time(0.6, false)).toBeGreaterThan(walk * 1.4);
    expect(time(1, true)).toBeLessThan(walk * 0.7);
  });

  it('進めない辺はひとつ前の点へ戻って選び直し、ほかに道が無ければ戻った点で止まる', () => {
    // 廊下を壁でふさぐ。キッチンへはこの廊下を通るほかに道が無い
    const shut: Level = { ...lv, boxes: [...lv.boxes, { min: [-12, 0, 3.25], max: [-11.8, 3.5, 6.75] }] };
    const w = new Walker(NODES.corridorEast);
    w.go('kitchen');
    run(w, 30, shut);
    expect(w.path).toEqual([]);
    expect(flat(w.body.pos, NODES.corridorEast)).toBeLessThan(0.3);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/walker.test.ts`
Expected: FAIL（`./walker` が無い）。

- [ ] **Step 3: 書く**

`src/lib/games/yappari-chameleon/cpu/walker.ts` を作る。

```ts
import type { V3 } from '$lib/sculpt';
import { idle, newBody, step as move, type Body, type Level } from '../move';
import { NODES, nearest, route, type Node } from './paths';

/** 点に着いたとみなす距離（m） */
const ARRIVE = 0.3;
/** この秒のあいだに STUCK_GAIN も近づかなければ、止まって進めない */
const STUCK_SECS = 1;
const STUCK_GAIN = 0.1;

/** 網の点から点へ move.ts の step で歩く体 */
export class Walker {
  readonly body: Body;
  /** これから通る点。頭が次の行き先 */
  path: Node[] = [];
  /** 歩く速さ（入力の強さ。1 で WALK） */
  pace = 1;
  run = false;
  #prev: Node | null = null;
  #best = Infinity;
  #stuck = 0;
  readonly #blocked = new Set<string>();

  constructor(at: V3) {
    this.body = newBody(at);
  }

  go(to: Node): void {
    this.path = route(nearest(this.body.pos), to, this.#blocked);
    this.#reset();
  }

  step(lv: Level, dt: number): number | null {
    const next = this.path[0];
    if (next === undefined) {
      move(this.body, idle(), lv, dt);
      return null;
    }
    const at = NODES[next];
    const dx = at[0] - this.body.pos[0];
    const dz = at[2] - this.body.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < ARRIVE) {
      this.#prev = this.path.shift()!;
      this.#reset();
      move(this.body, idle(), lv, dt);
      // 着いたコマも、まだ道が残っていれば次の点の向きを返す（見回りが着いたと取り違えない）
      const then = this.path[0];
      if (then === undefined) return null;
      return Math.atan2(NODES[then][0] - this.body.pos[0], NODES[then][2] - this.body.pos[2]);
    }
    if (d < this.#best - STUCK_GAIN) {
      this.#best = d;
      this.#stuck = 0;
    } else if ((this.#stuck += dt) > STUCK_SECS) this.#unstick(next);
    move(this.body, { ...idle(), x: (dx / d) * this.pace, z: (dz / d) * this.pace, run: this.run }, lv, dt);
    return Math.atan2(dx, dz);
  }

  /** 進めない辺を覚え、ひとつ前の点へ戻ってから道を選び直す */
  #unstick(next: Node) {
    const goal = this.path.at(-1)!;
    const back = this.#prev ?? nearest(this.body.pos);
    this.#blocked.add(`${back}>${next}`);
    this.#blocked.add(`${next}>${back}`);
    this.path = [back, ...route(back, goal, this.#blocked).slice(1)];
    this.#reset();
  }

  #reset() {
    this.#best = Infinity;
    this.#stuck = 0;
  }
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/walker.test.ts`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/cpu
git commit -m "Walk CPU bodies along the path graph and back off from blocked edges"
```

---

### Task 6: 強さの表・頭脳の口・探す CPU の見回り

**Files:**

- Modify: `src/lib/games/yappari-chameleon/move.ts`（`EYE_HEIGHT` と `CROUCH` を置く）
- Modify: `src/lib/games/yappari-chameleon/play.svelte.ts`（`EYE_HEIGHT` と `CROUCH` を move.ts から読む）
- Modify: `src/lib/games/yappari-chameleon/play.svelte.test.ts`（`CROUCH` の import 先）
- Create: `src/lib/games/yappari-chameleon/cpu/levels.ts`
- Create: `src/lib/games/yappari-chameleon/cpu/senses.ts`
- Create: `src/lib/games/yappari-chameleon/cpu/hunter.ts`
- Test: `src/lib/games/yappari-chameleon/cpu/levels.test.ts`、`src/lib/games/yappari-chameleon/cpu/hunter.test.ts`

**Interfaces:**

- Consumes: Task 5 の `Walker`。Task 4 の `ROOMS`・`nearest`・`route`。
- Produces: move.ts の `EYE_HEIGHT = 1.0`・`CROUCH = 0.45`。
- Produces: `type Strength = 'weak' | 'normal' | 'strong'`、`interface Skill`、`SKILLS: Record<Strength, Skill>`、`STRENGTHS: { id: Strength; name: string }[]`、`interface CpuChoice { side: 'hide' | 'seek'; count: 1 | 2; mode: 'normal' | 'infect'; strength: Strength }`、`CPU_DEFAULT: CpuChoice`。
- Produces: `interface SurfacePoint { rest: V3; normal: V3; world: V3 }`、`interface Paint { color: RGB; metal: number; rough: number }`、`interface Senses { visible(seat, by, eye, at, diff): number | null; colorAt(o, d): Paint | null; surface(seat, body: Me): SurfacePoint[] | null }`、`interface Ctx { me: Seat; view: View; level: Level; bodies: ReadonlyMap<Seat, Me>; senses: Senses | null; now: number; act(m: Message): void }`。
- Produces: `class HunterBrain { constructor(at: V3, yaw: number, skill: Skill, index: number, rand: () => number); readonly walker: Walker; look: [number, number]; crouch: boolean; scanning: string | null; goal: V3 | null; eye(): V3; me(now: number): Me; heard(at: V3): void; step(ctx: Ctx, dt: number): void }`、`hidingSeats(v: View): Seat[]`、`LOOK_SECS = 4`。

頭脳は three を読み込めないので、目の高さとしゃがむ深さを three の無い move.ts へ移す（play.svelte.ts は doll3d を通して three を読み込む）。このタスクの `HunterBrain` は見回り・口笛・埋まりの矢印・答え合わせの見回しまでで、気づいて撃つのは Task 7 で足す。しゃがむのは強いだけで、`ROOMS` の `low` の部屋（書斎・キッチン・ランドリー）の見回しの後半（残り `LOOK_SECS / 2` 秒）だけ。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/cpu/levels.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import { CPU_DEFAULT, SKILLS, STRENGTHS } from './levels';

describe('強さの表', () => {
  it('撃つまでの迷いと狙いのずれは、弱い 1.5 秒 3 度・普通 0.8 秒 1.5 度・強い 0.4 秒 0.5 度', () => {
    expect([SKILLS.weak, SKILLS.normal, SKILLS.strong].map((s) => [s.wait, s.aim])).toEqual([
      [1.5, 3],
      [0.8, 1.5],
      [0.4, 0.5]
    ]);
  });

  it('強いほど、わずかな色の違いに気づき、口笛のずれが小さく、筆が細かい', () => {
    const list = [SKILLS.weak, SKILLS.normal, SKILLS.strong];
    for (let i = 1; i < 3; i++) {
      expect(list[i].diff).toBeLessThan(list[i - 1].diff);
      expect(list[i].stray.base).toBeLessThan(list[i - 1].stray.base);
      expect(list[i].stray.far).toBeLessThan(list[i - 1].stray.far);
      expect(list[i].brush).toBeLessThan(list[i - 1].brush);
      expect(list[i].jitter).toBeLessThan(list[i - 1].jitter);
    }
    expect(SKILLS.strong.stray.base).toBeGreaterThanOrEqual(1);
  });

  it('隠れ場所は、弱いが床だけ、普通が壁ぎわと家具の陰、強いは張り付きも使う', () => {
    expect([SKILLS.weak.tiers, SKILLS.normal.tiers, SKILLS.strong.tiers]).toEqual([[0], [1], [1, 2]]);
  });

  it('歩きは、弱いがゆっくり同じ所も見に行き、普通が決まった順、強いが走ってまだ見ていない部屋から', () => {
    expect(SKILLS.weak).toMatchObject({ pace: 0.6, run: false, order: 'random', crouch: false });
    expect(SKILLS.normal).toMatchObject({ pace: 1, run: false, order: 'loop', crouch: false });
    expect(SKILLS.strong).toMatchObject({ pace: 1, run: true, order: 'fresh', crouch: true });
  });

  it('画面の言葉と、選ぶ画面の既定', () => {
    expect(STRENGTHS.map((s) => s.name)).toEqual(['弱い', '普通', '強い']);
    expect(CPU_DEFAULT).toEqual({ side: 'hide', count: 1, mode: 'normal', strength: 'normal' });
  });
});
```

`src/lib/games/yappari-chameleon/cpu/hunter.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { levelOf, mansion } from '../mansion/layout';
import { CROUCH, EYE_HEIGHT } from '../move';
import type { Me } from '../net';
import { DEFAULTS, newMatch, view, type View } from '../referee';
import { rng } from '../rng';
import { HunterBrain, LOOK_SECS } from './hunter';
import { SKILLS, type Strength } from './levels';
import { nearest, NODES, ROOMS } from './paths';
import type { Ctx } from './senses';

const lv = levelOf(mansion());
const search: View = {
  ...view(newMatch()),
  phase: 'search',
  settings: { ...DEFAULTS, mode: 'normal' },
  roles: { 1: 'hider', 2: 'hunter' }
};

const body = (pos: V3): Me => ({
  ms: 0,
  pos,
  yaw: 0,
  cling: null,
  pose: 'stand',
  crouch: false,
  paint: false,
  look: [0, 0],
  eye: null
});

function ctx(over: Partial<Ctx> = {}): Ctx & { shots: Message[] } {
  const shots: Message[] = [];
  return {
    me: 2,
    view: search,
    level: lv,
    bodies: new Map(),
    senses: null,
    now: 0,
    act: (m) => shots.push(m),
    shots,
    ...over
  };
}

const brain = (s: Strength, index = 0, rand = rng(3)) => new HunterBrain(NODES.entrance, 0, SKILLS[s], index, rand);

/** secs 秒進め、見回しを始めた部屋を順に集める（同じ部屋を続けて見たら 2 回数える） */
function patrol(b: HunterBrain, c: Ctx, secs: number): string[] {
  const rooms: string[] = [];
  let last: string | null = null;
  for (let t = 0; t < secs; t += 0.05) {
    c.now += 50;
    b.step(c, 0.05);
    if (b.scanning && b.scanning !== last) rooms.push(b.scanning);
    last = b.scanning;
  }
  return rooms;
}

describe('探す CPU の見回り', () => {
  it('入口から入り、2 人なら別々の部屋から回り始める', () => {
    expect(brain('normal', 0).walker.path.at(-1)).toBe(ROOMS[0].look);
    expect(brain('normal', 1).walker.path.at(-1)).toBe(ROOMS[3].look);
  });

  it('部屋に着くと左右と上下に首を振る（見上げて天井と回廊、見下ろして家具の上）', () => {
    const b = brain('normal');
    const c = ctx();
    const pitch: number[] = [];
    const yaw: number[] = [];
    for (let t = 0; t < 30 && pitch.length < LOOK_SECS / 0.05; t += 0.05) {
      b.step(c, 0.05);
      if (b.scanning) {
        pitch.push(b.look[1]);
        yaw.push(b.look[0]);
      }
    }
    expect(Math.min(...pitch)).toBeLessThan(-0.4);
    expect(Math.max(...pitch)).toBeGreaterThan(0.2);
    expect(Math.max(...yaw) - Math.min(...yaw)).toBeGreaterThan(2);
  });

  it('強いは、机や台の下をのぞける部屋（書斎・キッチン・ランドリー）の見回しでだけしゃがみ、普通はしゃがまない', () => {
    const where = (s: Strength) => {
      const b = brain(s);
      const c = ctx();
      const rooms = new Set<string>();
      for (let t = 0; t < 150; t += 0.05) {
        b.step(c, 0.05);
        if (!b.crouch) continue;
        rooms.add(b.scanning ?? '歩くあいだ');
        expect(b.eye()[1]).toBeCloseTo(b.walker.body.pos[1] + EYE_HEIGHT - CROUCH);
        expect(b.me(0).pose).toBe('crouch');
      }
      return [...rooms].sort();
    };
    expect(where('strong')).toEqual(
      ROOMS.filter((r) => r.low)
        .map((r) => r.name)
        .sort()
    );
    expect(where('normal')).toEqual([]);
  });

  it('普通は決まった順、強いはまだ見ていない部屋から、弱いは同じ部屋も見に行く', () => {
    expect(patrol(brain('normal'), ctx(), 150).slice(0, 6)).toEqual(ROOMS.map((r) => r.name));
    expect(new Set(patrol(brain('strong'), ctx(), 150).slice(0, 6)).size).toBe(6);
    expect(
      patrol(
        brain('weak', 0, () => 0),
        ctx(),
        40
      ).slice(0, 3)
    ).toEqual(['大広間', '大広間', '大広間']);
  });

  it('歩く速さは強さの段のぶん', () => {
    expect(brain('weak').walker).toMatchObject({ pace: 0.6, run: false });
    expect(brain('strong').walker).toMatchObject({ pace: 1, run: true });
  });

  it('口笛を聞いたら、ずらした先へ向かう。遠いほど・弱いほど大きく、強いでも 0.5m より離す', () => {
    const at: V3 = [-16, 0, 12];
    const off = (s: Strength, from: V3 = NODES.entrance) => {
      const b = new HunterBrain(from, 0, SKILLS[s], 0, () => 0.5);
      b.heard(at);
      expect(b.walker.path.at(-1)).toBe(nearest(b.goal!));
      return Math.hypot(b.goal![0] - at[0], b.goal![2] - at[2]);
    };
    expect(off('weak')).toBeGreaterThan(off('normal'));
    expect(off('normal')).toBeGreaterThan(off('strong'));
    expect(off('strong')).toBeGreaterThan(0.5);
    expect(off('normal', NODES.kitchen)).toBeLessThan(off('normal'));
  });

  it('口笛の先に着くと、口笛のほうを向いて見回し、そのあと途中だった見回りに戻る', () => {
    const b = brain('normal');
    b.heard([4, 0, 3]);
    const c = ctx();
    for (let t = 0; t < 10 && !b.scanning; t += 0.05) b.step(c, 0.05);
    expect(b.scanning).toBe('大広間');
    expect(b.goal).not.toBeNull();
    for (let t = 0; t < LOOK_SECS + 1 && b.goal; t += 0.05) b.step(c, 0.05);
    expect(b.goal).toBeNull();
    for (let t = 0; t < 10 && !b.scanning; t += 0.05) b.step(c, 0.05);
    expect(b.scanning).toBe(ROOMS[0].name);
  });

  it('埋まりの矢印が出た人の場所へ向かう', () => {
    const b = brain('normal');
    const at: V3 = [-18, 0, -1.6];
    b.step(ctx({ view: { ...search, exposed: [1] }, bodies: new Map<Seat, Me>([[1, body(at)]]) }), 0.05);
    expect(b.goal).toEqual(at);
    expect(b.walker.path.at(-1)).toBe(nearest(at));
  });

  it('答え合わせでは歩かずにその場で見回す', () => {
    const b = brain('normal');
    const c = ctx({ view: { ...search, phase: 'reveal' } });
    const from = [...b.walker.body.pos];
    const yaws = new Set<number>();
    for (let t = 0; t < 3; t += 0.05) {
      b.step(c, 0.05);
      yaws.add(Math.round(b.look[0] * 10));
    }
    expect(b.walker.body.pos[0]).toBeCloseTo(from[0]);
    expect(b.walker.body.pos[2]).toBeCloseTo(from[2]);
    expect(yaws.size).toBeGreaterThan(3);
  });

  it('体は構えたポーズで、目の位置を付けて送る', () => {
    const m = brain('normal').me(123);
    expect(m).toMatchObject({ ms: 123, pose: 'aim', crouch: false, cling: null, paint: false });
    expect(m.eye).toEqual([NODES.entrance[0], NODES.entrance[1] + EYE_HEIGHT, NODES.entrance[2]]);
    expect(m.look).toEqual([0, 0]);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu`
Expected: FAIL（`./levels` と `./hunter` が無い。move.ts に `EYE_HEIGHT` が無い）。

- [ ] **Step 3: 目の高さとしゃがむ深さを move.ts へ移す**

`src/lib/games/yappari-chameleon/move.ts` の `export const CLIMB = 1.0;` の下に足す。

```ts
/** 一人称の目の高さと、しゃがんだときに下げる量（m）。親の見落としポイントと CPU の目も同じ高さから見る */
export const EYE_HEIGHT = 1.0;
export const CROUCH = 0.45;
```

`src/lib/games/yappari-chameleon/play.svelte.ts` の `const EYE_HEIGHT = 1.0;` と `export const CROUCH = 0.45;` の 2 行を消し、move.ts の import を `import { CROUCH, EYE_HEIGHT, floorBelow, idle, newBody, step, wallNear, type Body } from './move';` にする。`src/lib/games/yappari-chameleon/play.svelte.test.ts` の `import { CROUCH, Play } from './play.svelte';` を `import { Play } from './play.svelte';` と `import { CROUCH } from './move';` にする（すでに `./move` から import していればそこへ足す）。

- [ ] **Step 4: 強さの表と頭脳の口を書く**

`src/lib/games/yappari-chameleon/cpu/levels.ts` を作る。

```ts
export type Strength = 'weak' | 'normal' | 'strong';

/** 強さの段ごとの CPU の動き。数字は通しの試合と headless の確かめで直し、iPad で遊んでさらに直す */
export interface Skill {
  /** 目立ちとして数える色の違い（0..1）。小さいほどわずかな違いや塗り残しにも気づく */
  diff: number;
  /** 撃つと決めてから撃つまでの秒 */
  wait: number;
  /** 狙いのずれ（度） */
  aim: number;
  /** 歩く速さ（1 で WALK）と、走るか */
  pace: number;
  run: boolean;
  /** 次の部屋の選び方。random は同じ所にも行き、loop は決まった順、fresh はまだ見ていない近い部屋から */
  order: 'random' | 'loop' | 'fresh';
  /** 見回しでしゃがんで、机や台の下ものぞく */
  crouch: boolean;
  /** 口笛の場所からずらす量（m）。base + far × 口笛までの距離 */
  stray: { base: number; far: number };
  /** 隠れ場所の段。0 は床に立つ・座る、1 は壁ぎわ・家具の陰、2 は壁や天井の張り付き */
  tiers: number[];
  /** 筆の半径（m）・色のずれ（0..1）・塗り残す割合・吹き付けの濃さ */
  brush: number;
  jitter: number;
  skip: number;
  alpha: number;
}

export const SKILLS: Record<Strength, Skill> = {
  weak: {
    diff: 0.25,
    wait: 1.5,
    aim: 3,
    pace: 0.6,
    run: false,
    order: 'random',
    crouch: false,
    stray: { base: 3, far: 0.3 },
    tiers: [0],
    brush: 0.12,
    jitter: 0.15,
    skip: 0.25,
    alpha: 0.6
  },
  normal: {
    diff: 0.12,
    wait: 0.8,
    aim: 1.5,
    pace: 1,
    run: false,
    order: 'loop',
    crouch: false,
    stray: { base: 2, far: 0.2 },
    tiers: [1],
    brush: 0.07,
    jitter: 0.04,
    skip: 0.05,
    alpha: 0.8
  },
  strong: {
    diff: 0.05,
    wait: 0.4,
    aim: 0.5,
    pace: 1,
    run: true,
    order: 'fresh',
    crouch: true,
    stray: { base: 1, far: 0.1 },
    tiers: [1, 2],
    brush: 0.035,
    jitter: 0.01,
    skip: 0,
    alpha: 0.95
  }
};

export const STRENGTHS: { id: Strength; name: string }[] = [
  { id: 'weak', name: '弱い' },
  { id: 'normal', name: '普通' },
  { id: 'strong', name: '強い' }
];

/** CPU の設定の画面で選ぶもの。side はプレイヤーの役（hide は CPU が探し、seek は CPU が隠れる） */
export interface CpuChoice {
  side: 'hide' | 'seek';
  count: 1 | 2;
  mode: 'normal' | 'infect';
  strength: Strength;
}

export const CPU_DEFAULT: CpuChoice = { side: 'hide', count: 1, mode: 'normal', strength: 'normal' };
```

`src/lib/games/yappari-chameleon/cpu/senses.ts` を作る。

```ts
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import type { RGB } from '../color';
import type { Level } from '../move';
import type { Me } from '../net';
import type { View } from '../referee';

/** 体の表面の点。rest と normal は骨で曲げる前（吹き付けの Dab と同じ座標）、world はいまの屋敷の座標 */
export interface SurfacePoint {
  rest: V3;
  normal: V3;
  world: V3;
}

/** 光が当たる前の色（3D スポイトと同じ） */
export interface Paint {
  color: RGB;
  metal: number;
  rough: number;
}

/**
 * 頭脳が 3D に聞く口。アプリでは親の端末の 3D が答え、テストでは決め打ちの偽物を差す。
 * 3D が描けていない（縦持ちで描くのを止めている）あいだは null を返す
 */
export interface Senses {
  /** seat の体が eye から見て、まわりと diff より違う色に見える画素の割合（0..1）。by は見ている CPU（その体は描かない） */
  visible(seat: Seat, by: Seat, eye: V3, at: V3, diff: number): number | null;
  /** o から向き d（長さ 1）の先で最初に当たる屋敷の面の色 */
  colorAt(o: V3, d: V3): Paint | null;
  /** seat の体の表面の点。3D の体がまだ body の場所に無ければ null */
  surface(seat: Seat, body: Me): SurfacePoint[] | null;
}

/** 頭脳に毎コマ渡すもの */
export interface Ctx {
  me: Seat;
  view: View;
  level: Level;
  /** ほかの人の最後の体（親が中継する） */
  bodies: ReadonlyMap<Seat, Me>;
  senses: Senses | null;
  /** 体と弾に付ける時刻（ミリ秒） */
  now: number;
  act(m: Message): void;
}
```

- [ ] **Step 5: 探す頭脳の見回りを書く**

`src/lib/games/yappari-chameleon/cpu/hunter.ts` を作る。

```ts
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { placeOf } from '../mansion/layout';
import { CROUCH, EYE_HEIGHT } from '../move';
import type { Me } from '../net';
import { AIM } from '../poses';
import type { View } from '../referee';
import type { Skill } from './levels';
import { nearest, ROOMS, route } from './paths';
import type { Ctx } from './senses';
import { Walker } from './walker';

/** 1 つの部屋で見回す秒 */
export const LOOK_SECS = 4;
/** 見回しで左右へ振る幅（rad）。視野の半角 52 度と合わせて、部屋のほぼ全部を見る */
const SWAY = 1.5;

export const hidingSeats = (v: View): Seat[] =>
  (Object.keys(v.roles).map(Number) as Seat[]).filter((s) => v.roles[s] === 'hider' && !v.found.includes(s));

const yawTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/**
 * 探す CPU。入口から網の上で部屋を順に回り、部屋に着くと左右と上下に首を振る。口笛を聞くとずらした先へ、
 * 埋まりの矢印が出た人の場所へ向かう
 */
export class HunterBrain {
  readonly walker: Walker;
  /** [yaw, pitch]。pitch は下向きが正（oversight の forward と同じ） */
  look: [number, number];
  crouch = false;
  /** 見回している部屋（歩いているあいだは null） */
  scanning: string | null = null;
  /** 口笛と矢印で向かう先。着いたらそちらを向いて見回す */
  goal: V3 | null = null;
  readonly #skill: Skill;
  readonly #rand: () => number;
  #room: number;
  readonly #seen = new Set<number>();
  #scan = 0;
  /** 今の見回しでしゃがむか */
  #low = false;
  #t = 0;
  #base = 0;
  readonly #exposed = new Set<Seat>();

  constructor(at: V3, yaw: number, skill: Skill, index: number, rand: () => number) {
    this.walker = new Walker(at);
    this.walker.body.yaw = yaw;
    this.walker.pace = skill.pace;
    this.walker.run = skill.run;
    this.look = [yaw, 0];
    this.#skill = skill;
    this.#rand = rand;
    // 2 人なら、部屋の並びの反対側から回り始める
    this.#room = (index * 3) % ROOMS.length;
    this.walker.go(ROOMS[this.#room].look);
  }

  eye(): V3 {
    const [x, y, z] = this.walker.body.pos;
    return [x, y + EYE_HEIGHT - (this.crouch ? CROUCH : 0), z];
  }

  me(now: number): Me {
    return {
      ms: now,
      pos: [...this.walker.body.pos],
      yaw: this.look[0],
      cling: null,
      pose: this.crouch ? 'crouch' : AIM.id,
      crouch: this.crouch,
      paint: false,
      look: [...this.look],
      eye: this.eye()
    };
  }

  /** 口笛。本家の ♪ も近いか遠いかが分かる程度なので、遠いほど・強さが低いほど大きくずらした先へ向かう */
  heard(at: V3): void {
    const eye = this.eye();
    const r = this.#skill.stray.base + this.#skill.stray.far * Math.hypot(at[0] - eye[0], at[2] - eye[2]);
    const a = this.#rand() * Math.PI * 2;
    // 半分より近くへはずらさないので、強いでも隠れる人の上へまっすぐは行かない
    const k = r * (0.5 + 0.5 * this.#rand());
    this.#head([at[0] + Math.cos(a) * k, at[1], at[2] + Math.sin(a) * k]);
  }

  step(ctx: Ctx, dt: number): void {
    this.#t += dt;
    if (ctx.view.phase === 'reveal') {
      this.#low = false;
      this.walker.path = [];
      this.walker.step(ctx.level, dt);
      this.#sweep();
      return;
    }
    if (ctx.view.phase === 'search') this.#arrows(ctx);
    this.#patrol(ctx, dt);
  }

  #head(goal: V3) {
    this.goal = goal;
    this.scanning = null;
    this.walker.go(nearest(goal));
  }

  /** 埋まりすぎて場所を知らされた人へ向かう（人のハンターに見える矢印と同じ情報） */
  #arrows(ctx: Ctx) {
    const exposed = ctx.view.exposed.filter((s) => hidingSeats(ctx.view).includes(s));
    for (const s of [...this.#exposed]) if (!exposed.includes(s)) this.#exposed.delete(s);
    for (const s of exposed) {
      const body = ctx.bodies.get(s);
      if (this.#exposed.has(s) || !body) continue;
      this.#exposed.add(s);
      this.#head(body.pos);
    }
  }

  #patrol(ctx: Ctx, dt: number) {
    const heading = this.walker.step(ctx.level, dt);
    if (heading !== null) {
      this.scanning = null;
      this.crouch = false;
      this.look = [heading, 0];
      return;
    }
    if (this.scanning === null) {
      const pos = this.walker.body.pos;
      this.#base = yawTo(pos, this.goal ?? ROOMS[this.#room].toward);
      this.scanning = this.goal ? placeOf(pos) : ROOMS[this.#room].name;
      this.#scan = LOOK_SECS;
      this.#low = this.#skill.crouch && !!ROOMS.find((r) => r.name === this.scanning)?.low;
    }
    this.#sweep();
    if ((this.#scan -= dt) > 0) return;
    if (this.goal) this.goal = null;
    else {
      this.#seen.add(this.#room);
      this.#room = this.#next();
    }
    this.scanning = null;
    this.crouch = false;
    this.walker.go(ROOMS[this.#room].look);
  }

  /**
   * 左右に加えて上下にも振り、天井・回廊・家具の上を見る（pitch は −0.6 で見上げ、0.4 で見下ろす）。
   * 強いは、机や台の下をのぞける部屋の見回しの後半だけしゃがむ
   */
  #sweep() {
    const t = this.#t;
    this.look = [this.#base + SWAY * Math.sin(t * 1.1), 0.5 * Math.sin(t * 1.7) - 0.1];
    this.crouch = this.#low && this.#scan < LOOK_SECS / 2;
  }

  #next(): number {
    const order = this.#skill.order;
    if (order === 'random') return Math.floor(this.#rand() * ROOMS.length);
    if (order === 'loop') return (this.#room + 1) % ROOMS.length;
    if (this.#seen.size >= ROOMS.length) {
      this.#seen.clear();
      this.#seen.add(this.#room);
    }
    const from = nearest(this.walker.body.pos);
    let best = this.#room;
    let len = Infinity;
    ROOMS.forEach((r, i) => {
      const n = route(from, r.look).length;
      if (!this.#seen.has(i) && n < len) {
        len = n;
        best = i;
      }
    });
    return best;
  }
}
```

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（`play.svelte.test.ts` のしゃがむ深さのテストも通る）。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Add the CPU strength table and a patrolling hunter brain"
```

---

### Task 7: 探す CPU の気づきと撃つ

**Files:**

- Modify: `src/lib/games/yappari-chameleon/oversight.ts`（`sight` の届きを渡せるように）
- Modify: `src/lib/games/yappari-chameleon/cpu/hunter.ts`
- Test: `src/lib/games/yappari-chameleon/oversight.test.ts`、`src/lib/games/yappari-chameleon/cpu/hunter.test.ts`

**Interfaces:**

- Consumes: Task 6 の `HunterBrain`・`Ctx`・`Senses`・`SKILLS`。
- Produces: `sight(lv: Level, v: Viewer, points: V3[], reach = REACH): number | null`。
- Produces: `HunterBrain.suspicion: Map<Seat, number>`、`SEARCH_REACH = 30`、`CHECK = 0.25`、`SHOOT_AT = 1`、`PROBE_AT = 0.4`、`toLook(d: V3): [number, number]`、`deviate(d: V3, deg: number, rand: () => number): V3`。撃つと `ctx.act({ t: 'shot', o: eye, d, from: muzzle, ms: ctx.now })`。

怪しさは 0.25 秒ごとに、いつも `LEAK × CHECK` だけ減り、視野・届き・遮りを通った体だけ `(目立ち × 4 + 動いていれば 2) × (1 − 距離 / 30) × CHECK` を足す。`SHOOT_AT` を超えた体へ向いて近づき（10m より遠ければ網の上で近くの点へ）、`wait` 秒迷ってから `aim` 度ずらして撃つ。外しても怪しさは残して続けて狙い、見つかるか `PROBE_AT` を下回るまで続ける。追う先と狙う先は、最後に見えたときの体の位置（`#last`）だけ。見えなくなったら、最後に見えた所の近くの網の点まで歩き、着いても見えなければそちらを向いて見回してから見回りに戻る。見えないあいだは撃たず、`ctx.bodies` の今の位置を使わない（使うと透視になる）。動いたかも、続けて見えた 2 回の位置でだけ比べる。`PROBE_AT` と `SHOOT_AT` のあいだの見えている体へは、見るたびに 1 割の確率で `aim` の 2 倍ずらして試し撃ちする。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/oversight.test.ts` の `describe('見落としポイントの視野', ...)` の最後に足す。

```ts
it('届きは既定で 15m、渡せば延ばせる', () => {
  expect(sight(open, eye, [toward(0, 0, 20)])).toBeNull();
  expect(sight(open, eye, [toward(0, 0, 20)], 30)).toBeCloseTo(20);
});
```

`src/lib/games/yappari-chameleon/cpu/hunter.test.ts` の import を次にする。

```ts
import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { levelOf, mansion, placeOf, SPAWNS } from '../mansion/layout';
import { CROUCH, EYE_HEIGHT } from '../move';
import type { Me } from '../net';
import { bodyPoints, sight } from '../oversight';
import { COOLDOWN, DEFAULTS, newMatch, view, type View } from '../referee';
import { rng } from '../rng';
import { CHECK, deviate, HunterBrain, LOOK_SECS, SEARCH_REACH, SHOOT_AT, toLook } from './hunter';
import { SKILLS, type Strength } from './levels';
import { nearest, NODES, ROOMS } from './paths';
import type { Ctx, Senses } from './senses';
```

ファイルの最後に足す。

```ts
/** 決め打ちの目。visible は vis を返し、聞かれた席を calls に入れる */
function eyes(vis: number | null, calls: Seat[] = []): Senses {
  return {
    visible: (seat) => {
      calls.push(seat);
      return vis;
    },
    colorAt: () => null,
    surface: () => null
  };
}

/**
 * 大広間の床の点。入口の 3 席と大広間の見回す点から、大階段の横板（最初の段で高さ 1.25m）の手前を通って見え、
 * どの種の置き方でも動く物が間に入らない（下の「的の点は」のテストが見る）
 */
const OPEN: V3 = [3.5, 0, 5.2];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: V3): V3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
/** 弾の向きと、目から体の胴の真ん中への向きのあいだの角度（度） */
function miss(shot: Message, target: Me): number {
  const o = shot.o as V3;
  const [mid] = bodyPoints(target);
  const want = norm([mid[0] - o[0], mid[1] - o[1], mid[2] - o[2]]);
  return (Math.acos(Math.min(1, dot(shot.d as V3, want))) * 180) / Math.PI;
}

function hunt(s: Strength, senses: Senses | null, at: V3 = OPEN, rand = rng(5)) {
  const b = brain(s, 0, rand);
  const target = body(at);
  const c = ctx({ senses, bodies: new Map<Seat, Me>([[1, target]]) });
  const run = (secs: number, each?: (t: number) => void) => {
    for (let t = 0; t < secs - 1e-9; t += 0.05) {
      c.now += 50;
      b.step(c, 0.05);
      each?.(t);
    }
  };
  return { b, c, target, run };
}

describe('探す CPU の気づきと撃つ', () => {
  it('的の点は、どの種の置き方でも入口の 3 席と大広間の見回す点から胴が見える', () => {
    const [mid] = bodyPoints(body(OPEN));
    for (const seed of [null, ...Array.from({ length: 50 }, (_, i) => i + 1)]) {
      const level = levelOf(mansion(seed));
      for (const f of [NODES.hall, ...Object.values(SPAWNS.entrance)]) {
        const eye: V3 = [f[0], f[1] + EYE_HEIGHT, f[2]];
        const look: [number, number] = [Math.atan2(mid[0] - eye[0], mid[2] - eye[2]), 0];
        expect(sight(level, { eye, look }, [mid], SEARCH_REACH), `${seed} ${f}`).not.toBeNull();
      }
    }
  });

  it('目立つ体は見つけて、狙いを強さの段の度数だけずらして撃つ', () => {
    const { c, target, run } = hunt('normal', eyes(0.6));
    run(4);
    expect(c.shots.length).toBeGreaterThan(0);
    const shot = c.shots[0];
    expect(miss(shot, target)).toBeCloseTo(SKILLS.normal.aim, 1);
    expect(shot.ms).toBeGreaterThan(0);
    // 筋は目より少し下の銃口から
    expect((shot.from as V3)[1]).toBeLessThan((shot.o as V3)[1]);
  });

  it('撃つと決めてから撃つまで、強さの段のぶん迷う', () => {
    const waited = (s: Strength) => {
      const { b, c, run } = hunt(s, eyes(1));
      let decided: number | null = null;
      let shot: number | null = null;
      run(10, (t) => {
        if (decided === null && (b.suspicion.get(1) ?? 0) >= SHOOT_AT) decided = t;
        if (shot === null && c.shots.length) shot = t;
      });
      return shot! - decided!;
    };
    expect(waited('strong')).toBeCloseTo(SKILLS.strong.wait, 0);
    expect(waited('weak')).toBeCloseTo(SKILLS.weak.wait, 0);
    expect(waited('weak') - waited('strong')).toBeGreaterThan(0.9);
  });

  it('目立たない体は、止まっていれば見落とす', () => {
    const { b, c, run } = hunt('strong', eyes(0));
    run(30);
    expect(c.shots).toEqual([]);
    expect(b.suspicion.get(1)).toBe(0);
  });

  it('目立たない体でも、動けば気づいて撃つ', () => {
    const { c, target, run } = hunt('normal', eyes(0));
    let k = 0;
    run(8, () => {
      if (!c.shots.length) target.pos = [OPEN[0] + 0.1 * (k++ % 2), 0, OPEN[2]];
    });
    expect(c.shots.length).toBeGreaterThan(0);
  });

  it('3D が描けていない（目立ちが null）あいだも、動く体には気づき、止まった体は見落とす', () => {
    const still = hunt('normal', eyes(null));
    still.run(15);
    expect(still.c.shots).toEqual([]);
    const moving = hunt('normal', null);
    let k = 0;
    moving.run(8, () => {
      if (!moving.c.shots.length) moving.target.pos = [OPEN[0] + 0.1 * (k++ % 2), 0, OPEN[2]];
    });
    expect(moving.c.shots.length).toBeGreaterThan(0);
  });

  it('目立ちは 1 体につき 1 秒に 4 回までしか聞かない', () => {
    const calls: Seat[] = [];
    const { run } = hunt('normal', eyes(0, calls));
    run(10);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.length).toBeLessThanOrEqual(10 / CHECK + 1);
  });

  it('壁の向こうの体には目立ちを聞かない', () => {
    const calls: Seat[] = [];
    const { c, run } = hunt('strong', eyes(1, calls), [-18, 0, 12]);
    run(5);
    expect(calls).toEqual([]);
    expect(c.shots).toEqual([]);
  });

  it('撃つ間の 2 秒は自分で守る', () => {
    const { c, run } = hunt('strong', eyes(1));
    run(10);
    expect(c.shots.length).toBeGreaterThan(2);
    for (let i = 1; i < c.shots.length; i++)
      expect((c.shots[i].ms as number) - (c.shots[i - 1].ms as number)).toBeGreaterThanOrEqual(COOLDOWN * 1000 - 1);
  });

  it('答え合わせでは撃たない', () => {
    const { c, run } = hunt('strong', eyes(1));
    c.view = { ...search, phase: 'reveal' };
    run(5);
    expect(c.shots).toEqual([]);
  });

  it('壁の向こうへ逃げた体は、最後に見えた所までは追うが、その先の本当の位置へは行かず、見えないあいだは撃たない', () => {
    const { b, c, target, run } = hunt('normal', eyes(1));
    let fled = false;
    // 撃つと決めたらすぐ、大広間からは壁で見えないキッチンへ逃げる
    run(3, () => {
      if (fled || (b.suspicion.get(1) ?? 0) < SHOOT_AT) return;
      fled = true;
      target.pos = [-18, 0, 12];
    });
    expect(fled).toBe(true);
    const last = nearest(OPEN);
    const places = new Set<string>();
    let reached = false;
    let faced = false;
    run(10, () => {
      places.add(placeOf(b.walker.body.pos));
      for (const n of b.walker.path) places.add(placeOf(NODES[n]));
      if (Math.hypot(b.walker.body.pos[0] - NODES[last][0], b.walker.body.pos[2] - NODES[last][2]) < 0.3)
        reached = true;
      if (b.goal && Math.hypot(b.goal[0] - OPEN[0], b.goal[2] - OPEN[2]) < 0.3) faced = true;
    });
    expect(c.shots).toEqual([]);
    expect(reached).toBe(true);
    expect(faced).toBe(true);
    expect([...places]).toEqual(['大広間']);
  });

  it('見つかった体は狙うのをやめる', () => {
    const { c, run } = hunt('strong', eyes(1));
    run(4);
    const n = c.shots.length;
    expect(n).toBeGreaterThan(0);
    c.view = { ...search, found: [1] };
    run(6);
    expect(c.shots.length).toBe(n);
  });

  it('半端に怪しい見えている体へは、ときどき試し撃ちする（ずれは 2 倍）', () => {
    const { b, c, target, run } = hunt('normal', eyes(0), OPEN, () => 0);
    b.suspicion.set(1, 0.6);
    run(0.3);
    expect(c.shots).toHaveLength(1);
    expect(miss(c.shots[0], target)).toBeCloseTo(SKILLS.normal.aim * 2, 1);
  });

  it('toLook は弾の向きの yaw と pitch（下向きが正）、deviate はちょうどその度数だけずらす', () => {
    const [yaw, pitch] = toLook([0, 0, 1]);
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
    expect(toLook(norm([1, -1, 0]))).toEqual([expect.closeTo(Math.PI / 2), expect.closeTo(Math.PI / 4)]);
    const d = deviate([0, 0, 1], 3, () => 0.3);
    expect((Math.acos(d[2]) * 180) / Math.PI).toBeCloseTo(3, 5);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/oversight.test.ts src/lib/games/yappari-chameleon/cpu/hunter.test.ts`
Expected: FAIL（`sight` が届きを受けない。`HunterBrain` が撃たず、`suspicion`・`toLook`・`deviate` が無い）。

- [ ] **Step 3: sight に届きを渡せるようにする**

`src/lib/games/yappari-chameleon/oversight.ts` の `sight` を次にする。

```ts
/** 見えている点のうちいちばん近い点までの距離。どれも見えなければ null。遮るのは弾と同じ屋敷の箱と坂 */
export function sight(lv: Level, v: Viewer, points: V3[], reach = REACH): number | null {
  let best: number | null = null;
  for (const p of points) {
    const d = sub(p, v.eye);
    const len = Math.hypot(...d);
    if (len > reach || len < 1e-6 || !inView(v, p)) continue;
    if (rayLevel(lv, v.eye, [d[0] / len, d[1] / len, d[2] / len], len)) continue;
    best = best === null ? len : Math.min(best, len);
  }
  return best;
}
```

- [ ] **Step 4: 探す頭脳に気づきと撃つを足す**

`src/lib/games/yappari-chameleon/cpu/hunter.ts` を次の全体にする。

```ts
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { placeOf } from '../mansion/layout';
import { CROUCH, EYE_HEIGHT } from '../move';
import type { Me } from '../net';
import { bodyPoints, sight, still } from '../oversight';
import { AIM } from '../poses';
import { COOLDOWN, type View } from '../referee';
import type { Skill } from './levels';
import { nearest, ROOMS, route } from './paths';
import type { Ctx } from './senses';
import { Walker } from './walker';

/** 1 つの部屋で見回す秒 */
export const LOOK_SECS = 4;
/** 見回しで左右へ振る幅（rad）。視野の半角 52 度と合わせて、部屋のほぼ全部を見る */
const SWAY = 1.5;
/** 大広間の端から端まで見える届き（m）。見落としポイントの点の足し算の 15m とは別 */
export const SEARCH_REACH = 30;
/** 気づくかを見る間隔（秒）。目立ちを聞くのは 1 体につきこの間隔に 1 回まで */
export const CHECK = 0.25;
/** 怪しさの増え方（1 秒あたり。目立ち 1 のときと、動いている体に足す量）と、いつも減る量 */
const GAIN = 4;
const MOVE_GAIN = 2;
const LEAK = 0.15;
/** ここを超えたら撃ちに行く。PROBE_AT より下は試し撃ちもしない */
export const SHOOT_AT = 1;
export const PROBE_AT = 0.4;
/** 半端に怪しい体へ、見るたびに試し撃ちする確率 */
const PROBE_CHANCE = 0.1;
/** これより遠ければ近づいてから撃つ（m） */
const APPROACH = 10;

export const hidingSeats = (v: View): Seat[] =>
  (Object.keys(v.roles).map(Number) as Seat[]).filter((s) => v.roles[s] === 'hider' && !v.found.includes(s));

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v: V3): V3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const yawTo = (from: V3, to: V3) => Math.atan2(to[0] - from[0], to[2] - from[2]);

/** 向き d（長さ 1）の [yaw, pitch]。pitch は下向きが正 */
export const toLook = (d: V3): [number, number] => [
  Math.atan2(d[0], d[2]),
  -Math.asin(Math.max(-1, Math.min(1, d[1])))
];

/** d（長さ 1）を、乱数で選んだ向きへちょうど deg 度ずらす */
export function deviate(d: V3, deg: number, rand: () => number): V3 {
  const side = cross(d, [0, 1, 0]);
  const r: V3 = Math.hypot(...side) < 1e-6 ? [1, 0, 0] : norm(side);
  const u = cross(r, d);
  const phi = rand() * Math.PI * 2;
  const w: V3 = [0, 1, 2].map((i) => r[i] * Math.cos(phi) + u[i] * Math.sin(phi)) as V3;
  const a = (deg * Math.PI) / 180;
  return norm([0, 1, 2].map((i) => d[i] * Math.cos(a) + w[i] * Math.sin(a)) as V3);
}

/**
 * 探す CPU。入口から網の上で部屋を順に回り、部屋に着くと左右と上下に首を振る。0.25 秒ごとに隠れている体が視野・届き・遮りを
 * 通るかを見て、通った体だけ Senses に目立ちを聞いて怪しさをためる。体の位置は見えたときのものだけを使う（ctx.bodies は
 * 親が中継した全員の本当の位置なので、見えないあいだに読むと透視になる）。口笛を聞くとずらした先へ、埋まりの矢印が出た人の場所へ向かう
 */
export class HunterBrain {
  readonly walker: Walker;
  /** [yaw, pitch]。pitch は下向きが正（oversight の forward と同じ） */
  look: [number, number];
  crouch = false;
  /** 見回している部屋（歩いているあいだは null） */
  scanning: string | null = null;
  /** 口笛と矢印で向かう先。着いたらそちらを向いて見回す */
  goal: V3 | null = null;
  /** 隠れる人ごとの怪しさ（SHOOT_AT で撃ちに行く） */
  readonly suspicion = new Map<Seat, number>();
  readonly #skill: Skill;
  readonly #rand: () => number;
  #room: number;
  readonly #seen = new Set<number>();
  #scan = 0;
  /** 今の見回しでしゃがむか */
  #low = false;
  #t = 0;
  #base = 0;
  #check = 0;
  #cool = 0;
  /** 撃つと決めた体。lost は見失って、最後に見えた所へ向かっている */
  #aim: { seat: Seat; wait: number; lost: boolean } | null = null;
  /** 前に見たときの体の位置（動いたかを見る） */
  readonly #before = new Map<Seat, V3>();
  /** 最後に視野・届き・遮りを通ったときの体の位置と胴の真ん中。追うのも撃つのもここへ向ける */
  readonly #last = new Map<Seat, { pos: V3; mid: V3 }>();
  /** いちばん新しい見るときに見えていた体 */
  #sees = new Set<Seat>();
  readonly #exposed = new Set<Seat>();

  constructor(at: V3, yaw: number, skill: Skill, index: number, rand: () => number) {
    this.walker = new Walker(at);
    this.walker.body.yaw = yaw;
    this.walker.pace = skill.pace;
    this.walker.run = skill.run;
    this.look = [yaw, 0];
    this.#skill = skill;
    this.#rand = rand;
    // 2 人なら、部屋の並びの反対側から回り始める
    this.#room = (index * 3) % ROOMS.length;
    this.walker.go(ROOMS[this.#room].look);
  }

  eye(): V3 {
    const [x, y, z] = this.walker.body.pos;
    return [x, y + EYE_HEIGHT - (this.crouch ? CROUCH : 0), z];
  }

  me(now: number): Me {
    return {
      ms: now,
      pos: [...this.walker.body.pos],
      yaw: this.look[0],
      cling: null,
      pose: this.crouch ? 'crouch' : AIM.id,
      crouch: this.crouch,
      paint: false,
      look: [...this.look],
      eye: this.eye()
    };
  }

  /** 口笛。本家の ♪ も近いか遠いかが分かる程度なので、遠いほど・強さが低いほど大きくずらした先へ向かう */
  heard(at: V3): void {
    const eye = this.eye();
    const r = this.#skill.stray.base + this.#skill.stray.far * Math.hypot(at[0] - eye[0], at[2] - eye[2]);
    const a = this.#rand() * Math.PI * 2;
    // 半分より近くへはずらさないので、強いでも隠れる人の上へまっすぐは行かない
    const k = r * (0.5 + 0.5 * this.#rand());
    this.#head([at[0] + Math.cos(a) * k, at[1], at[2] + Math.sin(a) * k]);
  }

  step(ctx: Ctx, dt: number): void {
    this.#t += dt;
    this.#cool = Math.max(0, this.#cool - dt);
    const v = ctx.view;
    if (v.phase === 'reveal') {
      // 撃たずにその場で見回すだけ
      this.#aim = null;
      this.#low = false;
      this.walker.path = [];
      this.walker.step(ctx.level, dt);
      this.#sweep();
      return;
    }
    if (v.phase !== 'search' || v.roles[ctx.me] !== 'hunter') return this.#patrol(ctx, dt);
    this.#arrows(ctx);
    if ((this.#check += dt) >= CHECK - 1e-9) {
      this.#check = 0;
      this.#notice(ctx);
    }
    if (this.#aim) this.#chase(ctx, dt);
    else this.#patrol(ctx, dt);
  }

  #sus(seat: Seat): number {
    return this.suspicion.get(seat) ?? 0;
  }

  #notice(ctx: Ctx) {
    const eye = this.eye();
    const viewer = { eye, look: this.look };
    const seen: Seat[] = [];
    for (const seat of hidingSeats(ctx.view)) {
      const body = ctx.bodies.get(seat);
      if (!body) continue;
      const before = this.#before.get(seat);
      let s = this.#sus(seat) - LEAK * CHECK;
      const points = bodyPoints(body);
      const d = sight(ctx.level, viewer, points, SEARCH_REACH);
      // 動いたかは、続けて見えた 2 回の位置でだけ比べる
      if (d === null) this.#before.delete(seat);
      else {
        this.#before.set(seat, body.pos);
        seen.push(seat);
        this.#last.set(seat, { pos: [...body.pos], mid: points[0] });
        // 3D が描けていないあいだ（null）は目立ちを 0 とみなし、動いた体にだけ気づく
        const loud = ctx.senses?.visible(seat, ctx.me, eye, points[0], this.#skill.diff) ?? 0;
        const moving = !!before && !still(body.pos, before);
        s += (loud * GAIN + (moving ? MOVE_GAIN : 0)) * (1 - d / SEARCH_REACH) * CHECK;
      }
      this.suspicion.set(seat, Math.max(0, s));
    }
    this.#sees = new Set(seen);
    if (this.#aim) return;
    const top = seen.reduce<Seat | null>((a, s) => (a === null || this.#sus(s) > this.#sus(a) ? s : a), null);
    if (top === null) return;
    if (this.#sus(top) >= SHOOT_AT) this.#aim = { seat: top, wait: this.#skill.wait, lost: false };
    else if (this.#sus(top) >= PROBE_AT && this.#cool === 0 && this.#rand() < PROBE_CHANCE)
      this.#fire(ctx, top, this.#skill.aim * 2);
  }

  /**
   * 撃つと決めた体へ向いて近づき、強さの段のぶん迷ってから撃つ。外しても怪しさは残して続けて狙う。
   * 追う先と狙う先は最後に見えたときの位置で、見えないあいだの本当の位置は使わない（使うと壁の向こうが透けて見える）。
   * 見失ったら最後に見えた所まで行き、着いても見えなければ、そちらを向いて見回してから見回りに戻る
   */
  #chase(ctx: Ctx, dt: number) {
    const aim = this.#aim!;
    const last = this.#last.get(aim.seat);
    if (!last || !hidingSeats(ctx.view).includes(aim.seat) || this.#sus(aim.seat) < PROBE_AT) return this.#drop(null);
    if (!this.#sees.has(aim.seat)) {
      if (!aim.lost) {
        aim.lost = true;
        this.walker.go(nearest(last.pos));
      }
      const heading = this.walker.step(ctx.level, dt);
      if (heading === null) return this.#drop(last.mid);
      this.crouch = false;
      this.look = [heading, 0];
      return;
    }
    aim.lost = false;
    if (Math.hypot(...sub(last.mid, this.eye())) > APPROACH) {
      const to = nearest(last.mid);
      if (this.walker.path.at(-1) !== to) this.walker.go(to);
    } else this.walker.path = [];
    this.walker.step(ctx.level, dt);
    this.crouch = false;
    this.look = toLook(norm(sub(last.mid, this.eye())));
    if ((aim.wait -= dt) > 0 || this.#cool > 0) return;
    this.#fire(ctx, aim.seat, this.#skill.aim);
    aim.wait = this.#skill.wait;
  }

  /** 狙うのをやめる。at を渡せば、そちらを向いて見回してから見回りに戻る */
  #drop(at: V3 | null) {
    this.#aim = null;
    this.scanning = null;
    if (at) this.#head(at);
    else this.walker.go(ROOMS[this.#room].look);
  }

  #fire(ctx: Ctx, seat: Seat, deg: number) {
    const last = this.#last.get(seat);
    if (!last) return;
    const o = this.eye();
    const d = deviate(norm(sub(last.mid, o)), deg, this.#rand);
    this.look = toLook(d);
    const yaw = this.look[0];
    // 筋は目の右下の前（銃口）から引く。当たりは目から見る
    const from: V3 = [
      o[0] - Math.cos(yaw) * 0.18 + Math.sin(yaw) * 0.3,
      o[1] - 0.15,
      o[2] + Math.sin(yaw) * 0.18 + Math.cos(yaw) * 0.3
    ];
    ctx.act({ t: 'shot', o, d, from, ms: ctx.now });
    this.#cool = COOLDOWN;
  }

  #head(goal: V3) {
    this.goal = goal;
    this.scanning = null;
    this.walker.go(nearest(goal));
  }

  /** 埋まりすぎて場所を知らされた人へ向かう（人のハンターに見える矢印と同じ情報） */
  #arrows(ctx: Ctx) {
    const exposed = ctx.view.exposed.filter((s) => hidingSeats(ctx.view).includes(s));
    for (const s of [...this.#exposed]) if (!exposed.includes(s)) this.#exposed.delete(s);
    for (const s of exposed) {
      const body = ctx.bodies.get(s);
      if (this.#exposed.has(s) || !body) continue;
      this.#exposed.add(s);
      this.#head(body.pos);
    }
  }

  #patrol(ctx: Ctx, dt: number) {
    const heading = this.walker.step(ctx.level, dt);
    if (heading !== null) {
      this.scanning = null;
      this.crouch = false;
      this.look = [heading, 0];
      return;
    }
    if (this.scanning === null) {
      const pos = this.walker.body.pos;
      this.#base = yawTo(pos, this.goal ?? ROOMS[this.#room].toward);
      this.scanning = this.goal ? placeOf(pos) : ROOMS[this.#room].name;
      this.#scan = LOOK_SECS;
      this.#low = this.#skill.crouch && !!ROOMS.find((r) => r.name === this.scanning)?.low;
    }
    this.#sweep();
    if ((this.#scan -= dt) > 0) return;
    if (this.goal) this.goal = null;
    else {
      this.#seen.add(this.#room);
      this.#room = this.#next();
    }
    this.scanning = null;
    this.crouch = false;
    this.walker.go(ROOMS[this.#room].look);
  }

  /**
   * 左右に加えて上下にも振り、天井・回廊・家具の上を見る（pitch は −0.6 で見上げ、0.4 で見下ろす）。
   * 強いは、机や台の下をのぞける部屋の見回しの後半だけしゃがむ
   */
  #sweep() {
    const t = this.#t;
    this.look = [this.#base + SWAY * Math.sin(t * 1.1), 0.5 * Math.sin(t * 1.7) - 0.1];
    this.crouch = this.#low && this.#scan < LOOK_SECS / 2;
  }

  #next(): number {
    const order = this.#skill.order;
    if (order === 'random') return Math.floor(this.#rand() * ROOMS.length);
    if (order === 'loop') return (this.#room + 1) % ROOMS.length;
    if (this.#seen.size >= ROOMS.length) {
      this.#seen.clear();
      this.#seen.add(this.#room);
    }
    const from = nearest(this.walker.body.pos);
    let best = this.#room;
    let len = Infinity;
    ROOMS.forEach((r, i) => {
      const n = route(from, r.look).length;
      if (!this.#seen.has(i) && n < len) {
        len = n;
        best = i;
      }
    });
    return best;
  }
}
```

`[0, 1, 2].map(...) as V3` が型で通らなければ、`deviate` の 2 行を 3 つの成分を並べた配列の式に書き直す。

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（Task 6 の見回りのテストも通る）。「迷う」のテストが外れたら、`decided` と `shot` の記録の位置を見る前に、`#notice` が `#aim` を決めたコマで `#chase` も回っていること（決めた直後のコマから `wait` が減ること）を確かめる。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Let CPU hunters build suspicion from sight and shoot with strength-based aim"
```

---

### Task 8: 隠れ場所の候補

**Files:**

- Create: `src/lib/games/yappari-chameleon/cpu/spots.ts`
- Test: `src/lib/games/yappari-chameleon/cpu/spots.test.ts`

**Interfaces:**

- Consumes: Task 4 の `NODES`・`ROOMS`。Task 6 の `EYE_HEIGHT`。
- Produces: `interface Spot { pos: V3; yaw: number; cling: Cling | null; pose: string; tier: 0 | 1 | 2; slack: number }`（`pos`・`yaw`・`cling` は move.ts の `Body` と同じ意味。壁なら壁の面から 0.2m で壁を向き、天井なら天井の高さ。`slack` は試合ごとにずらしてよい量）、`SPOTS: Spot[]`、`SHIFT = 0.25`、`shifted(spot: Spot, a: number, b: number): Spot`（a・b は −1〜1。床と天井は x と z、壁は壁に沿った横と高さへ `slack` 倍ずらす）、`viewOf(spot: Spot): V3`（その部屋の「見られる位置」。戸口あたりの網の点の目の高さ）、`pickSpot(seed: number, index: number, tiers: readonly number[], rand: () => number): Spot`。

候補は本家の定番の隠れ方に寄せる（本棚の前で立つ、天井で丸まる、壁の隅で寝そべる、ピアノや島の台の陰で丸まる、壁に張り付いて寄りかかる）。候補ごとに何の前・横かを 1 行のコメントで付ける。部屋の順は試合の種で並べ替え、CPU の何人めか（`index`）で別々の部屋を取るので、2 人が話し合わなくても同じ部屋にならない。選んだ候補は、種と `index` から決めたずれで、候補ごとの `slack`（壁や家具のすぐそばは小さく、広い所は 0.25m）だけずらす。テストは `slack` の半分の刻み（最大 0.125m）でずらした全部を調べる。体を包む箱はどの向きにも 0.3m より大きく、この刻みより大きいので、刻みのあいだのずれで初めてかかる箱は無い。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/cpu/spots.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { embedded } from '../embed';
import { levelOf, mansion, placeOf, SIZES, type Piece } from '../mansion/layout';
import { place, SETS } from '../mansion/props';
import { EYE_HEIGHT, idle, newBody, step, wallNear, type Box } from '../move';
import { poseById } from '../poses';
import { capsules, placement } from '../shots';
import { SKILLS } from './levels';
import { NODES, ROOMS } from './paths';
import { pickSpot, shifted, SHIFT, SPOTS, viewOf, type Spot } from './spots';

const boxOf = (q: Piece): Box | null => {
  const s = SIZES[q.kind];
  if (!s) return null;
  const [w, h, d] = q.turn % 2 ? [s[2], s[1], s[0]] : s;
  return { min: [q.at[0] - w / 2, q.at[1], q.at[2] - d / 2], max: [q.at[0] + w / 2, q.at[1] + h, q.at[2] + d / 2] };
};
const hits = (a: Box, b: Box) => [0, 1, 2].every((i) => a.min[i] < b.max[i] - 1e-6 && b.min[i] < a.max[i] - 1e-6);
const inside = (p: V3, b: Box) => [0, 1, 2].every((i) => p[i] > b.min[i] && p[i] < b.max[i]);
const SEEDS = [null, ...Array.from({ length: 30 }, (_, i) => i + 1)];
const name = (s: Spot) => `${placeOf(s.pos)} ${s.pos.map((v) => v.toFixed(2)).join(',')} ${s.pose}`;
const caps = (s: Spot) => capsules(poseById(s.pose), placement(s));
/**
 * 候補と、slack の半分の刻み（SHIFT でも 0.125m）でずらした全部の置き方。体を包む箱はどの向きにも 0.3m より大きいので、
 * この刻みで調べれば、刻みのあいだのずれで初めてかかる箱は無い
 */
const STEPS = [-1, -0.5, 0, 0.5, 1];
const ALL = SPOTS.flatMap((s) => STEPS.flatMap((a) => STEPS.map((b) => shifted(s, a, b))));

/** 体の当たりの円すいを包む箱 */
function hull(s: Spot): Box {
  const min: V3 = [Infinity, Infinity, Infinity];
  const max: V3 = [-Infinity, -Infinity, -Infinity];
  for (const k of caps(s))
    for (const p of [k.a, k.b])
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], p[i] - k.r);
        max[i] = Math.max(max[i], p[i] + k.r);
      }
  return { min, max };
}

describe('隠れ場所の候補', () => {
  const m = mansion();
  const fixed = levelOf({ ...m, pieces: m.pieces.slice(0, m.pieces.length - m.moving) });

  it('屋敷の 6 部屋にあり、どの部屋にも段 0 と段 1 の候補がある。ポーズは本家の輪のもの', () => {
    const rooms = ROOMS.map((r) => r.name);
    for (const s of SPOTS) {
      expect(rooms, name(s)).toContain(placeOf(s.pos));
      expect(poseById(s.pose).id, name(s)).toBe(s.pose);
    }
    for (const r of rooms)
      for (const tier of [0, 1])
        expect(
          SPOTS.some((s) => placeOf(s.pos) === r && s.tier === tier),
          `${r} ${tier}`
        ).toBe(true);
    expect(SPOTS.filter((s) => s.tier === 2).every((s) => s.cling)).toBe(true);
    expect(SPOTS.filter((s) => s.tier < 2).every((s) => !s.cling)).toBe(true);
    expect(SPOTS.filter((s) => s.cling?.kind === 'ceiling').every((s) => s.pose === 'curl')).toBe(true);
    expect(SPOTS.every((s) => s.slack >= 0 && s.slack <= SHIFT)).toBe(true);
  });

  it('ずらしても同じ部屋にある', () => {
    for (const s of SPOTS)
      for (const a of STEPS) for (const b of STEPS) expect(placeOf(shifted(s, a, b).pos), name(s)).toBe(placeOf(s.pos));
  });

  it('どの種の置き方でも、どれだけずらしても埋まらない', () => {
    const bad: string[] = [];
    for (const seed of SEEDS) {
      const lv = levelOf(mansion(seed));
      for (const s of ALL) if (embedded(lv, s)) bad.push(`${seed} ${name(s)}`);
    }
    expect(bad).toEqual([]);
  });

  it('ずらしても、動く物の置き場所の候補のどれにもかからない', () => {
    const boxes = SETS.flatMap((set) =>
      set.slots.flatMap((slot) => set.units.flatMap((unit) => unit.map((q) => boxOf(place(slot, q)))))
    ).filter((b): b is Box => b !== null);
    const bad = ALL.filter((s) => boxes.some((b) => hits(hull(s), b))).map(name);
    expect(bad).toEqual([]);
  });

  it('ずらしても、壁や動かない家具の中に体の当たりの軸が入らない', () => {
    const bad: string[] = [];
    for (const s of ALL)
      for (const k of caps(s)) {
        const mid: V3 = [(k.a[0] + k.b[0]) / 2, (k.a[1] + k.b[1]) / 2, (k.a[2] + k.b[2]) / 2];
        if ([k.a, k.b, mid].some((p) => fixed.boxes.some((b) => inside(p, b)))) bad.push(name(s));
      }
    expect([...new Set(bad)]).toEqual([]);
  });

  it('置いてもその場から動かず、張り付きはそのまま。壁の張り付きは壁を向く', () => {
    const lv = levelOf(mansion());
    const bad: string[] = [];
    for (const s of ALL) {
      const b = { ...newBody(s.pos), yaw: s.yaw, cling: s.cling, ground: !s.cling };
      for (let i = 0; i < 10; i++) step(b, idle(), lv, 1 / 30);
      const moved = Math.hypot(b.pos[0] - s.pos[0], b.pos[1] - s.pos[1], b.pos[2] - s.pos[2]);
      if (moved > 0.01 || b.cling?.kind !== s.cling?.kind) bad.push(name(s));
      if (s.cling?.kind === 'wall') {
        expect(wallNear(b, lv, s.cling), name(s)).not.toBeNull();
        expect(s.yaw).toBeCloseTo(Math.atan2(-s.cling.nx, -s.cling.nz));
      }
    }
    expect(bad).toEqual([]);
  });

  it('見られる位置は、その部屋の戸口あたりの網の点の目の高さ', () => {
    for (const s of SPOTS) {
      const v = viewOf(s);
      const node = Object.values(NODES).find((n) => n[0] === v[0] && n[2] === v[2]);
      expect(node, name(s)).toBeDefined();
      expect(v[1]).toBeCloseTo(node![1] + EYE_HEIGHT);
    }
  });

  it('同じ種なら同じ置き方、CPU の 1 人めと 2 人めは別々の部屋で、強さの段の候補を slack までずらして選ぶ', () => {
    for (const skill of [SKILLS.weak, SKILLS.normal, SKILLS.strong])
      for (let seed = 1; seed <= 50; seed++) {
        const a = pickSpot(seed, 0, skill.tiers, () => 0.3);
        const b = pickSpot(seed, 1, skill.tiers, () => 0.3);
        expect(pickSpot(seed, 0, skill.tiers, () => 0.3)).toEqual(a);
        expect(placeOf(a.pos)).not.toBe(placeOf(b.pos));
        for (const s of [a, b]) {
          expect(skill.tiers).toContain(s.tier);
          // どれかの候補から、どの向きにも slack までしかずれていない
          const near = (o: Spot) =>
            o.pose === s.pose && o.pos.every((v, i) => Math.abs(v - s.pos[i]) <= o.slack + 1e-9);
          expect(SPOTS.some(near), name(s)).toBe(true);
        }
      }
    const moved = new Set(Array.from({ length: 20 }, (_, i) => pickSpot(i + 1, 0, [0], () => 0).pos.join(',')));
    expect(moved.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/spots.test.ts`
Expected: FAIL（`./spots` が無い）。

- [ ] **Step 3: 書く**

`src/lib/games/yappari-chameleon/cpu/spots.ts` を作る。

```ts
import type { V3 } from '$lib/sculpt';
import { placeOf } from '../mansion/layout';
import { EYE_HEIGHT, type Cling } from '../move';
import { rng } from '../rng';
import { NODES, type Node } from './paths';

/** 隠れる CPU の置き場所。pos・yaw・cling は Body と同じ（壁なら面から RADIUS の 0.2m で壁を向き、天井なら天井の高さ） */
export interface Spot {
  pos: V3;
  yaw: number;
  cling: Cling | null;
  pose: string;
  /** 0 は床に立つ・座る、1 は壁ぎわ・家具の陰、2 は壁や天井の張り付き */
  tier: 0 | 1 | 2;
  /** 試合ごとにずらしてよい量（m）。壁や家具のすぐそばの候補は小さい */
  slack: number;
}

/** ずらす量の上限（m） */
export const SHIFT = 0.25;

const PI = Math.PI;
const floor = (x: number, y: number, z: number, yaw: number, pose: string, tier: 0 | 1, slack = SHIFT): Spot => ({
  pos: [x, y, z],
  yaw,
  cling: null,
  pose,
  tier,
  slack
});
const wall = (x: number, y: number, z: number, nx: number, nz: number, pose = 'stand'): Spot => ({
  pos: [x, y, z],
  yaw: Math.atan2(-nx, -nz),
  cling: { kind: 'wall', nx, nz },
  pose,
  tier: 2,
  slack: SHIFT
});
const ceiling = (x: number, y: number, z: number): Spot => ({
  pos: [x, y, z],
  yaw: 0,
  cling: { kind: 'ceiling' },
  pose: 'curl',
  tier: 2,
  slack: SHIFT
});

/**
 * 部屋ごとの候補。本家の定番の隠れ方に寄せ、本棚の前で立ち、天井で丸まり、壁の隅で寝そべり、家具の陰で丸まる。
 * どの種の置き方でも、slack までずらしても、埋まらず動く物の置き場所の候補にかからない（spots.test.ts が見る）
 */
export const SPOTS: Spot[] = [
  // 大広間
  floor(-6.5, 0, 3.2, PI / 2, 'stand', 0), // 西の壁ぎわ、廊下への戸口の南
  floor(6.4, 0, 10.3, -PI / 2, 'cross', 0, 0.05), // 回廊の下の北東の隅
  floor(5.6, 0, 3.0, -PI / 2, 'curl', 1, 0.2), // ピアノの東の陰
  floor(-5.6, 0, 9.3, PI, 'stand', 1, 0.15), // 回廊の下、西の円柱のうしろ
  wall(-3.0, 1.5, 0.2, 0, 1, 'lean'), // 入口の南の壁
  wall(6.8, 2.0, 2.0, -1, 0), // 東の壁、ピアノの南
  ceiling(2.5, 7, 6.0), // 大階段の東の天井
  // 2 階の回廊
  floor(3.0, 3.5, 11.6, PI, 'stand', 0, 0.2), // 東の垂れ幕の下の壁ぎわ
  floor(-5.0, 3.5, 11.5, PI, 'curl', 1), // 西の奥の隅
  floor(-2.5, 3.5, 11.6, PI / 2, 'lie', 1, 0.15), // 北の壁ぎわで寝そべる
  // 緑の廊下
  floor(-11.0, 0, 3.6, 0, 'stand', 0, 0.15), // 南の壁ぎわ、ランドリーの戸口の東
  floor(-21.8, 0, 6.3, PI / 2, 'crouch', 0, 0.1), // 西の端の北の隅
  floor(-22.3, 0, 5.0, PI / 2, 'stand', 1, 0.05), // 西の端の本棚の前
  floor(-8.9, 0, 6.3, PI, 'curl', 1, 0.2), // 東の端の花瓶の横
  wall(-12.5, 1.6, 6.55, 0, -1), // 北の壁、ポスターの西
  ceiling(-19.0, 3.5, 5.0), // 西よりの天井
  // 書斎
  floor(9.0, 0, 4.6, 0, 'stand', 0), // 南西の柱の西
  floor(15.6, 0, 3.2, PI, 'cross', 0), // 地球儀の北
  floor(11.0, 0, 10.35, PI, 'stand', 1, 0.05), // 北の壁の本棚の前
  floor(16.5, 0, 8.6, PI, 'curl', 1, 0.15), // 肘掛け椅子の北の陰
  wall(13.0, 1.6, 1.2, 0, 1), // 南の壁、2 つの窓のあいだ
  ceiling(12.25, 4, 3.0), // 机の南の天井
  // キッチン
  floor(-12.0, 0, 14.6, PI, 'stand', 0), // 北東の隅、鍋の棚の北
  floor(-19.0, 0, 9.5, PI / 2, 'crouch', 0), // 肉の棚の東
  floor(-14.2, 0, 11.0, PI / 2, 'curl', 1), // 島の台の東の陰
  floor(-20.25, 0, 11.1, PI / 2, 'stand', 1, 0.1), // 2 つの肉の棚のあいだ
  wall(-11.2, 1.5, 8.5, -1, 0, 'lean'), // 東の壁、レンジの南
  ceiling(-18.5, 3.5, 11.5), // 流しの南の天井
  // ランドリー
  floor(-11.4, 0, 2.4, PI, 'stand', 0), // 北東の隅、廊下の壁の下
  floor(-13.4, 0, -1.8, 0, 'cross', 0, 0.2), // タオルの台の東
  floor(-18.1, 0, -4.1, 0, 'curl', 1, 0.05), // 南の洗濯機の前の隅
  floor(-14.5, 0, -3.7, 0, 'stand', 1), // タオルの台の南
  wall(-19.8, 1.6, -2.0, 1, 0), // 西の壁、木の棚の南
  ceiling(-15.0, 3.5, -3.6) // 洗濯ひもの南の天井
];

/** spot を a・b（−1〜1）× spot.slack だけずらす。床と天井は x と z、壁は壁に沿った横と高さ（面からの距離は変えない） */
export function shifted(spot: Spot, a: number, b: number): Spot {
  const [x, y, z] = spot.pos;
  const k = spot.slack;
  if (spot.cling?.kind === 'wall') {
    const { nx, nz } = spot.cling;
    return { ...spot, pos: [x - nz * a * k, y + b * k, z + nx * a * k] };
  }
  return { ...spot, pos: [x + a * k, y, z + b * k] };
}

/** 部屋ごとの「見られる位置」。ハンターが入ってくる戸口あたり（大広間は探索の入口） */
const VIEWS: Record<string, Node> = {
  大広間: 'entrance',
  '2階の回廊': 'stairTop',
  緑の廊下: 'corridorEast',
  書斎: 'studyDoor',
  キッチン: 'kitchen',
  ランドリー: 'laundry'
};

export function viewOf(spot: Spot): V3 {
  const [x, y, z] = NODES[VIEWS[placeOf(spot.pos)]];
  return [x, y + EYE_HEIGHT, z];
}

/**
 * 試合の種で部屋の順を決め、CPU の何人めか（index）でその順の別々の部屋を取り、部屋の中の候補は rand で選ぶ。
 * ずれは種と index から決める
 */
export function pickSpot(seed: number, index: number, tiers: readonly number[], rand: () => number): Spot {
  const ok = SPOTS.filter((s) => tiers.includes(s.tier));
  const rooms = [...new Set(ok.map((s) => placeOf(s.pos)))];
  const r = rng(seed);
  for (let i = rooms.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [rooms[i], rooms[j]] = [rooms[j], rooms[i]];
  }
  const here = ok.filter((s) => placeOf(s.pos) === rooms[index % rooms.length]);
  const spot = here[Math.floor(rand() * here.length)];
  const k = rng(seed + 7919 * (index + 1));
  return shifted(spot, k() * 2 - 1, k() * 2 - 1);
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/spots.test.ts`
Expected: PASS（計画を書くときに、ここの候補と `slack` の値で通してある）。名前を出して落ちた候補は、先にその候補の `slack` を 0.05m ずつ下げ、0 でも落ちるなら部屋の中へ 0.2m ずつ寄せる。寝そべる・丸まる・あぐらの候補が家具や動く物にかかるときは、先に `yaw` を π 回してみる（体が伸びる向きが反対になる）。張り付きの候補は面からの距離 0.2m を変えず、面に沿って動かす。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/cpu
git commit -m "List per-room hiding spots with poses for CPU hiders"
```

---

### Task 9: 隠れる CPU

**Files:**

- Create: `src/lib/games/yappari-chameleon/cpu/hider.ts`
- Test: `src/lib/games/yappari-chameleon/cpu/hider.test.ts`

**Interfaces:**

- Consumes: Task 8 の `Spot`・`viewOf`。Task 6 の `Skill`・`Ctx`・`Senses`・`SurfacePoint`・`Paint`。
- Produces: `class HiderBrain { constructor(spot: Spot, skill: Skill, rand: () => number); readonly spot: Spot; readonly log: PaintLog; painting: boolean; get done(): boolean; me(now: number): Me; step(ctx: Ctx, dt: number): void }`、`thin(points: readonly SurfacePoint[], gap: number): SurfacePoint[]`、`SETTLE = 1`、`PAINT_SECS = 20`、`RAYS_PER_STEP = 6`。

置いてから `SETTLE` 秒待つ（親の端末の 3D の体が、届いた体の場所とポーズに落ち着くまで）。そのあと `Senses.surface` で体の表面の点を受け、骨で曲げる前の座標で筆の半径の 8 割の升目に 1 点へ間引き、強さの段の割合だけ塗り残す。点ごとに、見られる位置から体の点を通した向きの先の面の色を `Senses.colorAt` で取り（向きを 0.75 度の升目にまとめ、升目ごとに 1 度だけ聞く。1 コマに `RAYS_PER_STEP` 回まで）、強さの段のずれを足して吹く。吹く速さは 1 秒 150 点、点が多いときは `PAINT_SECS` で終わる速さに上げる。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/cpu/hider.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { levelOf, mansion, placeOf } from '../mansion/layout';
import { DEFAULTS, newMatch, view, type View } from '../referee';
import { rng } from '../rng';
import { HiderBrain, PAINT_SECS, RAYS_PER_STEP, SETTLE, thin } from './hider';
import { SKILLS, type Strength } from './levels';
import type { Ctx, Senses, SurfacePoint } from './senses';
import { SPOTS, viewOf, type Spot } from './spots';

const lv = levelOf(mansion());
const open = SPOTS.find((s) => s.tier === 0 && placeOf(s.pos) === '大広間')!;
const clung = SPOTS.find((s) => s.cling?.kind === 'wall')!;

/** spot の体のまわりの、背 h・半径 r の筒の点 */
function tube(spot: Spot, n = 3000, r = 0.15, h = 1.15): SurfacePoint[] {
  return Array.from({ length: n }, (_, i) => {
    const a = i * 2.39996;
    const rest: V3 = [r * Math.cos(a), (i / n) * h, r * Math.sin(a)];
    return {
      rest,
      normal: [Math.cos(a), 0, Math.sin(a)],
      world: [spot.pos[0] + rest[0], spot.pos[1] + rest[1], spot.pos[2] + rest[2]]
    };
  });
}

/** 見られる位置より上を向く線の先は赤、下は青の面。聞かれた数を rays に数える */
function canvas(points: () => SurfacePoint[] | null, rays = { n: 0 }): Senses {
  return {
    visible: () => 0,
    colorAt: (_o, d) => {
      rays.n++;
      return { color: d[1] > 0 ? [1, 0, 0] : [0, 0, 1], metal: 0.1, rough: 0.7 };
    },
    surface: points
  };
}

function ctx(senses: Senses | null, phase: View['phase'] = 'hide'): Ctx {
  return {
    me: 2,
    view: { ...view(newMatch()), phase, settings: DEFAULTS, roles: { 1: 'hunter', 2: 'hider' } },
    level: lv,
    bodies: new Map(),
    senses,
    now: 0,
    act: () => {}
  };
}

function run(b: HiderBrain, c: Ctx, secs: number, each?: () => void) {
  for (let t = 0; t < secs - 1e-9; t += 1 / 60) {
    c.now += 1000 / 60;
    b.step(c, 1 / 60);
    each?.();
  }
}

const brain = (s: Strength, spot: Spot = open) => new HiderBrain(spot, SKILLS[s], rng(4));

describe('隠れる CPU', () => {
  it('置いてから SETTLE 秒は塗らず、そのあと塗り終えて done になる', () => {
    const b = brain('normal');
    const c = ctx(canvas(() => tube(open)));
    run(b, c, SETTLE - 0.1);
    expect(b.log.dabs).toEqual([]);
    run(b, c, 25);
    expect(b.done).toBe(true);
    expect(b.log.dabs.length).toBeGreaterThan(100);
    expect(b.painting).toBe(false);
  });

  it('見られる位置から体を通した先の面の色で、強さの段の筆で吹く', () => {
    const b = brain('strong');
    run(b, ctx(canvas(() => tube(open))), 25);
    expect(viewOf(open)[1]).toBeCloseTo(1);
    const high = b.log.dabs.filter((d) => d.p[1] > 1.1);
    const low = b.log.dabs.filter((d) => d.p[1] < 0.9);
    expect(high.length).toBeGreaterThan(0);
    expect(high.every((d) => d.c[0] > 0.95 && d.c[2] < 0.05)).toBe(true);
    expect(low.every((d) => d.c[2] > 0.95 && d.c[0] < 0.05)).toBe(true);
    expect(b.log.dabs[0]).toMatchObject({ r: SKILLS.strong.brush, a: SKILLS.strong.alpha, m: 0.1, ro: 0.7 });
  });

  it('弱いは大きな筆で数が少なく、色がずれ、塗り残す', () => {
    const points = tube(open);
    const weak = brain('weak');
    const strong = brain('strong');
    run(weak, ctx(canvas(() => points)), 25);
    run(strong, ctx(canvas(() => points)), 25);
    expect(weak.log.dabs.length).toBeLessThan(strong.log.dabs.length / 4);
    expect(weak.log.dabs.length).toBeLessThan(thin(points, SKILLS.weak.brush * 0.8).length);
    const off = (b: HiderBrain) => {
      const list = b.log.dabs.map((d) => Math.min(Math.abs(d.c[0] - 1) + d.c[2], d.c[0] + Math.abs(d.c[2] - 1)));
      return list.reduce((a, v) => a + v, 0) / list.length;
    };
    expect(off(weak)).toBeGreaterThan(0.04);
    expect(off(strong)).toBeLessThan(0.02);
  });

  it('3D の体がまだ無いあいだ（surface が null）と、目の口が無いあいだは待つ', () => {
    let ready = false;
    const b = brain('normal');
    const c = ctx(canvas(() => (ready ? tube(open) : null)));
    run(b, c, 3);
    expect(b.log.dabs).toEqual([]);
    ready = true;
    run(b, c, 25);
    expect(b.done).toBe(true);
    const blind = brain('normal');
    run(blind, ctx(null), 5);
    expect(blind.log.dabs).toEqual([]);
  });

  it('面の色は 1 コマに RAYS_PER_STEP 回までしか聞かない', () => {
    const rays = { n: 0 };
    const b = brain('strong');
    const c = ctx(canvas(() => tube(open), rays));
    let before = 0;
    let most = 0;
    run(b, c, 15, () => {
      most = Math.max(most, rays.n - before);
      before = rays.n;
    });
    expect(rays.n).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(RAYS_PER_STEP);
  });

  it('点が多くても、置いてから SETTLE + PAINT_SECS 秒で塗り終える（隠れタイムの最短 30 秒に収める）', () => {
    const b = brain('strong');
    const big = tube(open, 40000, 0.5, 3);
    run(b, ctx(canvas(() => big)), SETTLE + PAINT_SECS + 0.5);
    expect(b.done).toBe(true);
    expect(b.log.dabs.length).toBeGreaterThan(150 * PAINT_SECS);
  });

  it('隠れタイムでなくなったら塗るのをやめる', () => {
    const b = brain('strong');
    const c = ctx(canvas(() => tube(open)));
    run(b, c, SETTLE + 1);
    const n = b.log.dabs.length;
    expect(n).toBeGreaterThan(0);
    c.view = { ...c.view, phase: 'search' };
    run(b, c, 5);
    expect(b.log.dabs.length).toBe(n);
    expect(b.painting).toBe(false);
  });

  it('体は場所のポーズと張り付きのまま送り、塗るあいだは筆を持つ', () => {
    const b = brain('normal', clung);
    const c = ctx(canvas(() => tube(clung)));
    expect(b.me(5)).toMatchObject({
      ms: 5,
      pos: clung.pos,
      yaw: clung.yaw,
      cling: clung.cling,
      pose: clung.pose,
      eye: null
    });
    run(b, c, SETTLE + 0.5);
    expect(b.me(0).paint).toBe(true);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/hider.test.ts`
Expected: FAIL（`./hider` が無い）。

- [ ] **Step 3: 書く**

`src/lib/games/yappari-chameleon/cpu/hider.ts` を作る。

```ts
import type { V3 } from '$lib/sculpt';
import type { RGB } from '../color';
import type { Me } from '../net';
import { PaintLog, type Dab } from '../paint';
import type { Skill } from './levels';
import type { Ctx, Paint, SurfacePoint } from './senses';
import { viewOf, type Spot } from './spots';

/** 置いてから塗り始めるまで（秒）。親の端末の 3D の体が、届いた体の場所とポーズに落ち着くのを待つ */
export const SETTLE = 1;
/** 塗り終えるまでの上限（秒）。隠れタイムの最短 30 秒から、置いて落ち着くまでと余裕を引いた長さ */
export const PAINT_SECS = 20;
/** 面の色を聞くのは 1 コマにこれだけ（1 回ごとに屋敷の面を全部の三角形で調べるので重い） */
export const RAYS_PER_STEP = 6;
/** 1 秒に吹く点の数。点が多ければ PAINT_SECS で終わる速さに上げる */
const RATE = 150;
/** 見られる位置からの向きをまとめる升目（rad）。戸口から数 m 先で 10cm ほど */
const CELL = (0.75 * Math.PI) / 180;

/** 骨で曲げる前の座標で gap の升目に 1 点ずつ残す */
export function thin(points: readonly SurfacePoint[], gap: number): SurfacePoint[] {
  const seen = new Set<string>();
  const out: SurfacePoint[] = [];
  for (const p of points) {
    const k = p.rest.map((v) => Math.floor(v / gap)).join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (v: V3): V3 => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * 隠れる CPU。隠れタイムの始めに選んだ場所へ歩かずに置かれ、見られる位置から見て体の向こうにある面の色で自分を塗る。
 * 光が当たる前の色で吹くので、体にも同じ光が当たり、その位置から見るとまわりに溶け込む
 */
export class HiderBrain {
  readonly spot: Spot;
  readonly log = new PaintLog();
  painting = false;
  readonly #skill: Skill;
  readonly #rand: () => number;
  #wait = SETTLE;
  #plan: SurfacePoint[] | null = null;
  #next = 0;
  #budget = 0;
  #rate = RATE;
  readonly #colors = new Map<string, Paint | null>();

  constructor(spot: Spot, skill: Skill, rand: () => number) {
    this.spot = spot;
    this.#skill = skill;
    this.#rand = rand;
  }

  get done(): boolean {
    return this.#plan !== null && this.#next >= this.#plan.length;
  }

  me(now: number): Me {
    const s = this.spot;
    return {
      ms: now,
      pos: [...s.pos],
      yaw: s.yaw,
      cling: s.cling,
      pose: s.pose,
      crouch: false,
      paint: this.painting,
      look: [s.yaw, 0],
      eye: null
    };
  }

  step(ctx: Ctx, dt: number): void {
    this.painting = false;
    const senses = ctx.senses;
    if (ctx.view.phase !== 'hide' || this.done || !senses) return;
    if ((this.#wait -= dt) > 0) return;
    if (!this.#plan) {
      // 3D の体がまだこの場所に無い（縦持ちで描くのを止めている・体が届いたばかり）なら、次のコマに聞き直す
      const points = senses.surface(ctx.me, this.me(ctx.now));
      if (!points) return;
      this.#plan = thin(points, this.#skill.brush * 0.8).filter(() => this.#rand() >= this.#skill.skip);
      this.#rate = Math.max(RATE, this.#plan.length / PAINT_SECS);
    }
    this.painting = true;
    this.#budget += this.#rate * dt;
    const eye = viewOf(this.spot);
    const plan = this.#plan;
    const out: Dab[] = [];
    let rays = RAYS_PER_STEP;
    while (this.#budget >= 1 && this.#next < plan.length) {
      const p = plan[this.#next];
      const d = norm(sub(p.world, eye));
      const key = `${Math.round(Math.atan2(d[0], d[2]) / CELL)}:${Math.round(Math.asin(d[1]) / CELL)}`;
      if (!this.#colors.has(key)) {
        if (rays === 0) break;
        rays--;
        this.#colors.set(key, senses.colorAt(eye, d));
      }
      const c = this.#colors.get(key);
      this.#next++;
      this.#budget--;
      if (c)
        out.push({
          p: p.rest,
          n: p.normal,
          r: this.#skill.brush,
          c: this.#shift(c.color),
          a: this.#skill.alpha,
          m: c.metal,
          ro: c.rough
        });
    }
    if (out.length) this.log.add(out);
  }

  #shift(c: RGB): RGB {
    const j = this.#skill.jitter;
    const one = (v: number) => Math.min(1, Math.max(0, v + (this.#rand() * 2 - 1) * j));
    return [one(c[0]), one(c[1]), one(c[2])];
  }
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu/hider.test.ts`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/cpu
git commit -m "Let CPU hiders paint themselves with the colors seen behind them"
```

---

### Task 10: CPU の子に頭脳を載せ、Crew で通しの試合

**Files:**

- Modify: `src/lib/games/yappari-chameleon/referee.ts`（`SHATTER_SECS` を置く）
- Modify: `src/lib/games/yappari-chameleon/session.svelte.ts`（`SHATTER_SECS` を referee から読む）
- Modify: `src/lib/games/yappari-chameleon/session.svelte.test.ts`（`SHATTER_SECS` の import 先）
- Modify: `src/lib/games/yappari-chameleon/cpu/bot.ts`
- Create: `src/lib/games/yappari-chameleon/cpu/crew.ts`
- Modify: `src/lib/games/yappari-chameleon/cpu/guard.test.ts`
- Test: `src/lib/games/yappari-chameleon/cpu/bot.test.ts`、`src/lib/games/yappari-chameleon/cpu/crew.test.ts`

**Interfaces:**

- Consumes: Task 3 の `Bot` と `pipes`。Task 7 の `HunterBrain`。Task 9 の `HiderBrain`。Task 8 の `pickSpot`。Task 1 の `Host.start(settings, hunters)` と `Host.podium`。
- Produces: referee.ts の `SHATTER_SECS = 1.5`。
- Produces: `new Bot(pipe: Pipe, o: BotOptions)`、`interface BotOptions { strength: Strength; index: number; rand?: () => number; senses?: () => Senses | null }`、`Bot.strength`（書き換えてよい）、`Bot.hunter: HunterBrain | null`、`Bot.hider: HiderBrain | null`、`turnAt(spot: Spot, lv: Level): V3`。
- Produces: `class Crew { constructor(party: Party, host: Host, rand?: () => number); readonly bots: Bot[]; senses: Senses | null; seat(c: CpuChoice): Promise<void>; play(c: CpuChoice, settings: Settings): Promise<void>; queue(c: CpuChoice, settings: Settings): void; go(): void; step(dt: number, now: number): void; stop(): void }`、`cpuSettings(s: Settings, c: CpuChoice): Settings`、`cpuHunters(c: CpuChoice, members: readonly Seat[]): Seat[]`。

`Bot` はフェーズに入るときに頭脳を載せ替える。ロビーと紹介は頭脳なし（ロビーの席・控室・大広間に立つ）、隠れタイムの隠れる人は `HiderBrain`（場所は `pickSpot(seed, index, tiers, rand)`）、探索のハンターは入口から `HunterBrain`。増え鬼で見つかった隠れる CPU は、`SHATTER_SECS` のあいだ体を送らず、そのあと `turnAt` から `HunterBrain` になる。体と吹き付けは 50ms ごとに送り、吹き付けを送り終えてから `ready` を押す。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/cpu/guard.test.ts` の 1 つめの `it` を次にする。

```ts
it('three を読み込まない', async () => {
  await expect(import('./crew')).resolves.toBeDefined();
});
```

`src/lib/games/yappari-chameleon/cpu/bot.test.ts` の `new Bot(b)` を `new Bot(b, { strength: 'normal', index: i })` にし、import に `import { Bot, REVEAL_READY, turnAt } from './bot';` と `import { levelOf, mansion, SPAWNS } from '../mansion/layout';`（すでにある）を合わせ、最後に足す。

```ts
describe('turnAt', () => {
  it('増え鬼でハンターになる場所は、天井や壁に張り付いていたら真下の床、床ならその場', () => {
    const lv = levelOf(mansion());
    expect(
      turnAt({ pos: [2.5, 7, 6], yaw: 0, cling: { kind: 'ceiling' }, pose: 'stand', tier: 2, slack: 0 }, lv)
    ).toEqual([2.5, 0, 6]);
    expect(
      turnAt(
        { pos: [-3, 1.5, 0.2], yaw: Math.PI, cling: { kind: 'wall', nx: 0, nz: 1 }, pose: 'stand', tier: 2, slack: 0 },
        lv
      )
    ).toEqual([-3, 0, 0.2]);
    expect(turnAt({ pos: [3, 3.5, 11.6], yaw: 0, cling: null, pose: 'stand', tier: 0, slack: 0 }, lv)).toEqual([
      3, 3.5, 11.6
    ]);
  });
});
```

`src/lib/games/yappari-chameleon/cpu/crew.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import { Party, type Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { Host } from '../host';
import { levelOf, mansion, SPAWNS } from '../mansion/layout';
import { EYE_HEIGHT } from '../move';
import { DAB_LEN, type Me } from '../net';
import { bodyPoints, sight } from '../oversight';
import { DEFAULTS, INTRO, SHATTER_SECS, type Settings } from '../referee';
import { rng } from '../rng';
import { REVEAL_READY } from './bot';
import { cpuHunters, cpuSettings, Crew } from './crew';
import { SEARCH_REACH } from './hunter';
import { CPU_DEFAULT, type CpuChoice } from './levels';
import { NODES } from './paths';
import type { Senses, SurfacePoint } from './senses';

const settle = () => new Promise((resolve) => setTimeout(resolve));
const SET: Settings = { ...DEFAULTS, hide: 30, search: 120, reveal: 10, taunt: 0 };
/** 隠れるプレイヤーを置く大広間の床の点。どの種の置き方でも入口と大広間の見回す点から見える（hunter.test.ts の OPEN と同じ） */
const OPEN: V3 = [3.5, 0, 5.2];

/** 体の表面の代わりの、背 1.15m・半径 0.15m の筒の点（向きを決めるだけなので、場所は原点のまわり） */
function tube(n = 3000): SurfacePoint[] {
  return Array.from({ length: n }, (_, i) => {
    const a = i * 2.39996;
    const rest: V3 = [0.15 * Math.cos(a), (i / n) * 1.15, 0.15 * Math.sin(a)];
    return { rest, normal: [Math.cos(a), 0, Math.sin(a)], world: rest };
  });
}

/** 決め打ちの目と筆。プレイヤー（席 1）の体だけが目立ち、CPU の体は目立たない */
const fake: Senses = {
  visible: (seat) => (seat === 1 ? 0.8 : 0),
  colorAt: () => ({ color: [0.4, 0.3, 0.2], metal: 0, rough: 0.8 }),
  surface: () => tube()
};

/** 親の端末。審判と CPU を同じ時計で 0.05 秒ずつ進め、プレイヤーの体を決め打ちで送る */
function table() {
  const clock = { ms: 0 };
  const party = Party.host();
  const rand = rng(11);
  const host = new Host(
    party,
    (seed) => levelOf(mansion(seed)),
    () => clock.ms,
    rand
  );
  const crew = new Crew(party, host, rand);
  crew.senses = fake;
  const told: Message[] = [];
  party.onTell((m) => told.push(m));
  let player: Partial<Me> | null = null;
  const run = (secs: number) => {
    for (let t = 0; t < secs - 1e-9; t += 0.05) {
      clock.ms += 50;
      if (player)
        party.act({
          t: 'me',
          ms: clock.ms,
          pos: [0, 0, 0],
          yaw: 0,
          cling: null,
          pose: 'stand',
          crouch: false,
          paint: false,
          look: [0, 0],
          eye: null,
          ...player
        });
      host.tick(0.05);
      crew.step(0.05, clock.ms);
    }
  };
  const until = (done: () => boolean, secs: number) => {
    for (let t = 0; t < secs && !done(); t += 0.05) run(0.05);
    return done();
  };
  const of = (t: string, seat: Seat) => told.filter((m) => m.t === t && m.seat === seat);
  const body = (seat: Seat) => of('me', seat).at(-1) as unknown as Me;
  /** プレイヤーのハンターが、seat の体の胴を真上から撃つ（天井に張り付いた体は天井の中から撃つ。中から始まる線は天井に止められない） */
  const shoot = (seat: Seat) => {
    const [mid] = bodyPoints(body(seat));
    party.act({ t: 'shot', o: [mid[0], mid[1] + 0.6, mid[2]], d: [0, -1, 0], ms: clock.ms });
  };
  const hunterMe: Partial<Me> = { pos: SPAWNS.room[1], pose: 'aim', eye: [SPAWNS.room[1][0], 1, SPAWNS.room[1][2]] };
  return {
    party,
    host,
    crew,
    told,
    run,
    until,
    of,
    body,
    shoot,
    hunterMe,
    setPlayer: (p: Partial<Me> | null) => (player = p)
  };
}

const choice = (c: Partial<CpuChoice>): CpuChoice => ({ ...CPU_DEFAULT, ...c });

describe('CPU と遊ぶの設定', () => {
  it('隠れるは通常で CPU 全員をハンターに、探すは選んだモードでプレイヤーだけをハンターに', () => {
    const s = { ...DEFAULTS, mode: 'double' } as const;
    expect(cpuSettings(s, choice({ side: 'hide', count: 2, mode: 'infect' }))).toMatchObject({
      mode: 'normal',
      hunters: 2
    });
    expect(cpuSettings(s, choice({ side: 'seek', count: 2, mode: 'infect' }))).toMatchObject({
      mode: 'infect',
      hunters: 1
    });
    expect(cpuHunters(choice({ side: 'hide' }), [1, 2, 3])).toEqual([2, 3]);
    expect(cpuHunters(choice({ side: 'seek' }), [1, 2, 3])).toEqual([1]);
  });

  it('CPU と遊ぶでは、ロビーの台をハンター希望に使わない', () => {
    expect(table().host.podium).toBe(false);
  });

  it('人数を 2 → 1 → 2 と変えても、閉じた席が抜け終わってから進め、CPU の印で座る', async () => {
    const t = table();
    await t.crew.seat(choice({ count: 2 }));
    expect(t.party.members).toEqual([1, 2, 3]);
    await t.crew.seat(choice({ count: 1 }));
    expect(t.party.members).toEqual([1, 2]);
    await t.crew.seat(choice({ count: 2, strength: 'strong' }));
    expect(t.party.members).toEqual([1, 2, 3]);
    expect(t.party.looks[3]).toBe('cpu');
    expect(t.crew.bots.map((b) => b.strength)).toEqual(['strong', 'strong']);
    await t.crew.seat(choice({ count: 1 }));
    await t.crew.play(choice({ side: 'seek', count: 1 }), SET);
    expect(Object.keys(t.host.match.roles)).toEqual(['1', '2']);
  });

  it('queue した試合は go で 1 度だけ始める', async () => {
    const t = table();
    await t.crew.seat(CPU_DEFAULT);
    t.crew.queue(CPU_DEFAULT, SET);
    expect(t.host.match.phase).toBe('lobby');
    t.crew.go();
    await settle();
    expect(t.host.match.phase).toBe('intro');
    t.crew.go();
    await settle();
    expect(t.host.match.phase).toBe('intro');
  });
});

describe('CPU との通しの試合', () => {
  it('的の点は、試合の種の置き方でも入口の 3 席と大広間の見回す点から胴が見える', () => {
    const [mid] = bodyPoints({ pos: OPEN, yaw: 0, cling: null, pose: 'stand' });
    for (let seed = 1; seed <= 50; seed++) {
      const level = levelOf(mansion(seed));
      for (const f of [NODES.hall, ...Object.values(SPAWNS.entrance)]) {
        const eye: V3 = [f[0], f[1] + EYE_HEIGHT, f[2]];
        const look: [number, number] = [Math.atan2(mid[0] - eye[0], mid[2] - eye[2]), 0];
        expect(sight(level, { eye, look }, [mid], SEARCH_REACH), `${seed}`).not.toBeNull();
      }
    }
  });

  it('隠れる（CPU のハンター 1 人・通常）は、目立つプレイヤーを見つけて決着し、ロビーへ戻る', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'hide', count: 1, strength: 'strong' }), SET);
    expect(t.host.match.roles).toEqual({ 1: 'hider', 2: 'hunter' });
    t.setPlayer({ pos: OPEN });
    t.run(INTRO + 0.1);
    expect(t.host.match.ready).toEqual([2]);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('search');
    expect(t.until(() => t.host.match.phase === 'reveal', 60)).toBe(true);
    expect(t.host.match.winner).toBe('hunter');
    expect(t.told.some((m) => m.t === 'splat' && m.by === 2)).toBe(true);
    t.run(REVEAL_READY + 0.1);
    expect(t.host.match.ready).toContain(2);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('lobby');
  });

  it('隠れる（CPU のハンター 2 人）も決着する', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'hide', count: 2, strength: 'normal' }), SET);
    expect(t.host.match.roles).toEqual({ 1: 'hider', 2: 'hunter', 3: 'hunter' });
    t.setPlayer({ pos: OPEN });
    t.run(INTRO + 0.1);
    expect(t.host.match.ready).toEqual([2, 3]);
    t.party.act({ t: 'ready' });
    expect(t.until(() => t.host.match.phase === 'reveal', 90)).toBe(true);
    expect(t.host.match.winner).toBe('hunter');
  });

  it('探す（CPU の隠れる人 1 人・通常）は、CPU が塗って押し、プレイヤーが撃って決着する', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'seek', count: 1 }), SET);
    expect(t.host.match.roles).toEqual({ 1: 'hunter', 2: 'hider' });
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    expect(t.until(() => t.host.match.ready.includes(2), 25)).toBe(true);
    expect(t.host.match.phase).toBe('hide');
    expect(t.of('dabs', 2).length).toBeGreaterThan(0);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('search');
    t.shoot(2);
    expect(t.host.match.found).toEqual([2]);
    expect(t.host.match).toMatchObject({ phase: 'reveal', winner: 'hunter' });
  });

  it('探す（2 人・増え鬼）で見つかった CPU は、破片の間をおいて探す側になり、試合は最後まで進む', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'seek', count: 2, mode: 'infect' }), SET);
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    expect(t.until(() => [2, 3].every((s) => t.host.match.ready.includes(s as Seat)), 25)).toBe(true);
    t.party.act({ t: 'ready' });
    t.shoot(2);
    expect(t.host.match.roles[2]).toBe('hunter');
    expect(t.host.match.phase).toBe('search');
    const before = t.of('me', 2).length;
    t.run(SHATTER_SECS - 0.2);
    expect(t.of('me', 2).length).toBe(before);
    t.run(0.4);
    const turned = t.body(2);
    expect(turned.eye).not.toBeNull();
    expect(turned.cling).toBeNull();
    expect(t.until(() => t.host.match.phase === 'reveal', 130)).toBe(true);
    t.run(REVEAL_READY + 0.1);
    t.party.act({ t: 'ready' });
    expect(t.host.match.phase).toBe('lobby');
  });

  it('隠れタイムが最短の 30 秒でも、強い CPU 2 人は塗りを送り終えてから押す', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'seek', count: 2, strength: 'strong' }), { ...SET, hide: 30 });
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    expect(t.until(() => [2, 3].every((s) => t.host.match.ready.includes(s as Seat)), 29)).toBe(true);
    expect(t.host.match.phase).toBe('hide');
    for (const bot of t.crew.bots) {
      const sent = t.of('dabs', bot.party.me).reduce((n, m) => n + (m.d as number[]).length / DAB_LEN, 0);
      expect(sent).toBe(bot.hider!.log.dabs.length);
      expect(sent).toBeGreaterThan(500);
    }
  });

  it('見つかって観戦になった CPU も、答え合わせで 5 秒たつと押す', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'seek', count: 2 }), SET);
    t.setPlayer(t.hunterMe);
    t.run(INTRO + 0.1);
    t.until(() => [2, 3].every((s) => t.host.match.ready.includes(s as Seat)), 25);
    t.party.act({ t: 'ready' });
    t.shoot(2);
    t.run(2.1);
    t.shoot(3);
    expect(t.host.match.phase).toBe('reveal');
    t.run(REVEAL_READY + 0.1);
    expect(t.host.match.ready).toEqual(expect.arrayContaining([2, 3]));
  });

  it('抜けると CPU も止まり、閉じたあとは何も送らない', async () => {
    const t = table();
    await t.crew.play(choice({ side: 'hide', count: 2 }), SET);
    t.run(1);
    t.crew.stop();
    await settle();
    expect(t.party.members).toEqual([1]);
    const n = t.told.length;
    t.crew.step(0.05, 1e9);
    expect(t.told.length).toBe(n);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/cpu`
Expected: FAIL（`./crew` と `turnAt` が無い。`SHATTER_SECS` が referee に無い）。

- [ ] **Step 3: SHATTER_SECS を referee へ移す**

`src/lib/games/yappari-chameleon/referee.ts` の `export const EXPOSE = 5;` の下に足す。

```ts
/** 撃たれた人の破片が消えるまで（秒）。増え鬼では、そのあとハンターになる（CPU も同じ間をおく） */
export const SHATTER_SECS = 1.5;
```

`src/lib/games/yappari-chameleon/session.svelte.ts` の `export const SHATTER_SECS = 1.5;` とその上のコメントを消し、referee の import を `import { COOLDOWN, SHATTER_SECS, TOOT_GAP, type Settings, type View } from './referee';` にする。`session.svelte.test.ts` の `import { Session, SHATTER_SECS, type Inbox } from './session.svelte';` を `import { Session, type Inbox } from './session.svelte';` にし、referee の import に `SHATTER_SECS` を足す。

- [ ] **Step 4: CPU の子に頭脳を載せる**

`src/lib/games/yappari-chameleon/cpu/bot.ts` を次の全体にする。

```ts
import type { Message } from '$lib/net/link';
import { Party, type Pipe, type Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { HEIGHT } from '../doll';
import { levelOf, mansion, SPAWNS } from '../mansion/layout';
import { Match } from '../match.svelte';
import { floorBelow, type Level } from '../move';
import { CHAMELEON_VERSION, dabMessages, DabOutbox, SEND_MS, type Me } from '../net';
import { SHATTER_SECS, type Phase, type View } from '../referee';
import { HiderBrain } from './hider';
import { HunterBrain } from './hunter';
import { SKILLS, type Strength } from './levels';
import type { Ctx, Senses } from './senses';
import { pickSpot, type Spot } from './spots';

/** 答え合わせで結果を見る間（秒）。CPU が押さないと、1 人では「ロビーへ戻る」が答え合わせの終わりまで進まない */
export const REVEAL_READY = 5;

export interface BotOptions {
  strength: Strength;
  /** CPU の何人めか（0 か 1）。2 人のとき、別々の部屋から回り、別々の部屋に隠れる */
  index: number;
  rand?: () => number;
  /** 親の端末の 3D。3D ができるまでは null */
  senses?: () => Senses | null;
}

/** 増え鬼で見つかった隠れる CPU が、ハンターとして歩き出す所。張り付いていたら真下の床（天井の裏から立つと天井の上に出る） */
export function turnAt(spot: Spot, lv: Level): V3 {
  const [x, y, z] = spot.pos;
  if (!spot.cling) return [x, y, z];
  return [x, floorBelow(lv, x, z, spot.cling.kind === 'ceiling' ? y - HEIGHT : y), z];
}

/**
 * CPU の子。手元の管で親の Party に子と同じ手順で入り（hello に cpu の印、席が決まったら hi）、届いた試合の様子で
 * 役とフェーズを持ち、止まっていても 50ms ごとに体を送る（親は止まっているかの判定と、撃った時刻へのさかのぼりに体の列を使う）。
 * 知らせは管の送った呼び出しの中で届くので、受けた中で送ると親の手続きの途中に割り込む。送るのは step の中だけ
 */
export class Bot {
  readonly party: Party;
  readonly match: Match;
  /** ほかの人の最後の体（親が中継する） */
  readonly bodies = new Map<Seat, Me>();
  /** 管が閉じた。Party が閉じた管の席を外す手続きより後に済むので、待てば顔ぶれから外れている */
  readonly gone: Promise<void>;
  strength: Strength;
  hunter: HunterBrain | null = null;
  hider: HiderBrain | null = null;
  readonly #index: number;
  readonly #rand: () => number;
  readonly #senses: () => Senses | null;
  #hi = false;
  #phase: Phase | null = null;
  /** 今のフェーズに入ってからの秒 */
  #since = 0;
  #pressed = false;
  #sent = -Infinity;
  #rest: { pos: V3; yaw: number } | null = null;
  #out = new DabOutbox();
  /** 送り終えた吹き付けの数 */
  #flushed = 0;
  /** 増え鬼で見つかってからの秒 */
  #broken = 0;
  readonly #toots: V3[] = [];
  #level: Level | null = null;
  #seed: number | null | undefined = undefined;

  constructor(pipe: Pipe, o: BotOptions) {
    this.party = Party.guest(pipe, { look: 'cpu' });
    this.match = new Match(
      () => this.party.me,
      () => this.party.looks
    );
    this.gone = pipe.closed;
    this.strength = o.strength;
    this.#index = o.index;
    this.#rand = o.rand ?? Math.random;
    this.#senses = o.senses ?? (() => null);
    this.party.onTell((m) => this.#receive(m));
  }

  /** 今の試合の小物の置き方の当たり（親と同じく種から作る） */
  get level(): Level {
    const seed = this.match.view.seed;
    if (!this.#level || seed !== this.#seed) {
      this.#seed = seed;
      this.#level = levelOf(mansion(seed));
    }
    return this.#level;
  }

  #receive(m: Message) {
    if (m.t === 'phase') this.match.receive(m.view as View);
    else if (m.t === 'me' && m.seat !== this.party.me) this.bodies.set(m.seat as Seat, m as unknown as Me);
    else if (m.t === 'toot' && m.seat !== this.party.me) this.#toots.push(m.at as V3);
    else if (m.t === 'chameleon-mismatch') this.party.close();
  }

  step(dt: number, now: number): void {
    // 席が届くまで Party.me は 1 のまま（CPU は席 2 か 3 に座る）
    if (this.party.lost || this.party.me === 1) return;
    if (!this.#hi) {
      this.#hi = true;
      this.party.act({ t: 'hi', v: CHAMELEON_VERSION });
    }
    if (!this.match.synced) return;
    const m = this.match;
    if (m.phase !== this.#phase) this.#enter(m.phase);
    this.#since += dt;
    this.#turn(dt);
    const ctx: Ctx = {
      me: m.me,
      view: m.view,
      level: this.level,
      bodies: this.bodies,
      senses: this.#senses(),
      now,
      act: (x) => this.party.act(x)
    };
    for (const at of this.#toots.splice(0)) this.hunter?.heard(at);
    this.hunter?.step(ctx, dt);
    this.hider?.step(ctx, dt);
    if (now - this.#sent >= SEND_MS) {
      this.#sent = now;
      this.#post(now);
    }
    if (!this.#pressed && this.#wantReady()) {
      this.#pressed = true;
      this.party.act({ t: 'ready' });
    }
  }

  #enter(p: Phase) {
    const m = this.match;
    this.#phase = p;
    this.#since = 0;
    this.#pressed = false;
    if (p === 'lobby' || p === 'intro') {
      this.hunter = this.hider = null;
      this.#broken = 0;
      // 人の子の Session と同じく、待っているハンターは控室、ほかは大広間で始める
      const where = p === 'lobby' ? 'lobby' : m.role === 'hunter' ? 'room' : 'hall';
      this.#rest = { pos: SPAWNS[where][m.me], yaw: 0 };
    } else if (p === 'hide' && m.role === 'hider') {
      const skill = SKILLS[this.strength];
      this.hider = new HiderBrain(pickSpot(m.view.seed ?? 1, this.#index, skill.tiers, this.#rand), skill, this.#rand);
      this.#out = new DabOutbox();
      this.#flushed = 0;
    } else if (p === 'search' && m.role === 'hunter' && !m.found() && !this.hunter) {
      // 増え鬼で、探索に入ったコマのうちに見つかった隠れる CPU は、入口からではなく #turn で隠れていた場所から探す
      const [x, y, z] = SPAWNS.entrance[m.me];
      this.hunter = new HunterBrain(
        [x, floorBelow(this.level, x, z, y), z],
        0,
        SKILLS[this.strength],
        this.#index,
        this.#rand
      );
    }
  }

  /** 増え鬼で見つかったら、人の子と同じく破片が消える間をおいて、隠れていた場所から探し始める */
  #turn(dt: number) {
    const m = this.match;
    if (!this.hider || !m.found() || m.view.settings.mode !== 'infect' || m.role !== 'hunter') return;
    if ((this.#broken += dt) < SHATTER_SECS) return;
    const spot = this.hider.spot;
    this.hunter = new HunterBrain(turnAt(spot, this.level), spot.yaw, SKILLS[this.strength], this.#index, this.#rand);
    this.hider = null;
  }

  #post(now: number) {
    const me = this.#me(now);
    if (me) this.party.act({ t: 'me', ...me });
    if (!this.hider) return;
    const d = this.#out.take(this.hider.log);
    if (d) for (const msg of dabMessages(this.match.me, d.at, d.d)) this.party.act(msg);
    this.#flushed = this.hider.log.dabs.length;
  }

  #wantReady(): boolean {
    const m = this.match;
    if (m.view.ready.includes(m.me)) return false;
    if (m.phase === 'hide')
      return m.role === 'hunter' || (!!this.hider?.done && this.#flushed === this.hider.log.dabs.length);
    // 見つかって観戦になった CPU も押す（押さないと、1 人では「ロビーへ戻る」が進まない）
    return m.phase === 'reveal' && this.#since >= REVEAL_READY;
  }

  #me(now: number): Me | null {
    // 見つかった体は、通常では観戦、増え鬼では破片が消えるまで送らない（人の子と同じ）
    if (this.match.found() && !this.hunter) return null;
    if (this.hunter) return this.hunter.me(now);
    if (this.hider) return this.hider.me(now);
    const r = this.#rest;
    if (!r) return null;
    return {
      ms: now,
      pos: [...r.pos],
      yaw: r.yaw,
      cling: null,
      pose: 'stand',
      crouch: false,
      paint: false,
      look: [r.yaw, 0],
      eye: null
    };
  }

  close(): void {
    this.party.close();
  }
}
```

- [ ] **Step 5: Crew を書く**

`src/lib/games/yappari-chameleon/cpu/crew.ts` を作る。

```ts
import type { Party, Seat } from '$lib/net/party.svelte';
import type { Host } from '../host';
import type { Settings } from '../referee';
import { Bot } from './bot';
import type { CpuChoice } from './levels';
import { pipes } from './pipe';
import type { Senses } from './senses';

/** 隠れるときはプレイヤー 1 人が隠れ、見つかった時点で終わるので通常にする。ダブルは CPU と遊ぶでは選べない */
export function cpuSettings(s: Settings, c: CpuChoice): Settings {
  return { ...s, mode: c.side === 'hide' ? 'normal' : c.mode, hunters: c.side === 'hide' ? c.count : 1 };
}

export const cpuHunters = (c: CpuChoice, members: readonly Seat[]): Seat[] =>
  c.side === 'hide' ? members.filter((s) => s !== 1) : [1];

/** CPU と遊ぶ。CPU を手元の管で親の Party に座らせ、審判のループで進める */
export class Crew {
  readonly bots: Bot[] = [];
  /** 親の端末の 3D。つないだ画面が 3D を作ってから入れる */
  senses: Senses | null = null;
  readonly #party: Party;
  readonly #host: Host;
  readonly #rand: () => number;
  #queued: { choice: CpuChoice; settings: Settings } | null = null;
  #stopped = false;

  constructor(party: Party, host: Host, rand: () => number = Math.random) {
    this.#party = party;
    this.#host = host;
    this.#rand = rand;
    // ハンターは CPU の設定の役で決めるので、ロビーの台はハンター希望に使わない
    host.podium = false;
  }

  /** CPU の人数と強さを合わせる。減らすときは、閉じた席が顔ぶれから抜け終わるまで待つ */
  async seat(c: CpuChoice): Promise<void> {
    while (this.bots.length > c.count) {
      const bot = this.bots.pop()!;
      bot.close();
      await bot.gone;
    }
    while (this.bots.length < c.count && !this.#stopped) {
      const [a, b] = pipes();
      const bot = new Bot(b, {
        strength: c.strength,
        index: this.bots.length,
        rand: this.#rand,
        senses: () => this.senses
      });
      this.bots.push(bot);
      // 抜けたあとは Party が管を閉じて席を返さない。そこでやめる
      if (typeof (await this.#party.add(a)) !== 'number') return;
    }
    for (const bot of this.bots) bot.strength = c.strength;
  }

  async play(c: CpuChoice, settings: Settings): Promise<void> {
    await this.seat(c);
    if (!this.#stopped) this.#host.start(cpuSettings(settings, c), cpuHunters(c, this.#party.members));
  }

  /** 試合を始めるのを、つないだ画面が 3D を作り終えるまで待たせる（紹介の 3 秒を作るあいだに過ぎさせない） */
  queue(c: CpuChoice, settings: Settings): void {
    this.#queued = { choice: c, settings };
  }

  go(): void {
    const q = this.#queued;
    this.#queued = null;
    if (q) void this.play(q.choice, q.settings);
  }

  step(dt: number, now: number): void {
    if (!this.#stopped) for (const bot of this.bots) bot.step(dt, now);
  }

  stop(): void {
    this.#stopped = true;
    for (const bot of this.bots.splice(0)) bot.close();
  }
}
```

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。通しの試合のテストは 1 本が数秒かかる。「隠れる」の 2 本が決着しないときは、先に「的の点は」のテストが通っているか（`OPEN` が入口と大広間の見回す点から見えるか）を見る。「最短の 30 秒」が落ちたら、`HiderBrain` の `PAINT_SECS` の速さが効いているか（`#rate`）を見る。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Run hunter and hider brains on CPU guests and play whole matches against them"
```

---

### Task 11: 親の端末の目と筆

**Files:**

- Modify: `src/lib/games/yappari-chameleon/world3d.ts`
- Modify: `src/lib/games/yappari-chameleon/session.svelte.ts`
- Create: `src/lib/games/yappari-chameleon/cpu/senses3d.ts`
- Test: `src/lib/games/yappari-chameleon/session.svelte.test.ts`
- Create（リポジトリに入れない）: `<scratchpad>/cpu/senses-check.mjs`、`<scratchpad>/cpu/senses/*.png`

**Interfaces:**

- Consumes: Task 6 の `Senses`・`SurfacePoint`・`Paint`。Task 9 の `HiderBrain`（headless の確かめで使う）。
- Produces: `World.renderedAt: number`（最後に `render` した `performance.now()`）、`World.look(cam: THREE.Camera, rt: THREE.WebGLRenderTarget, out: Uint8Array): void`、`World.pickStage(o: V3, d: V3): Paint | null`。
- Produces: `Session.rigOf(seat: Seat): DollRig | null`（自分は `play.world.rig`、ほかの人は `Remote` の `rig`、まだ体が届いていなければ null）。
- Produces: `class Senses3d implements Senses { constructor(world: World, rigOf: (seat: Seat) => DollRig | null); dispose(): void }`。

`visible` は CPU の目から体の胴の真ん中へ向けたカメラで、体ありと体なしの 2 枚を 96 × 96 に描き、色の差が `diff` を超える画素の割合を返す。描くあいだは、見ている CPU 自身の体と、自分の印（張り付きの赤い輪・筆の輪）と透かしの窓を消し、影は描き直さない（日は動かないので前のコマの影で足りる。毎回描き直すと 2048² の影を 1 回ごとに 2 度描く）。`colorAt` は屋敷の面だけを `Raycaster` で調べ、三角旗のひもの `Line`（当たりを 1m 広く取る）は飛ばし、`readPick` で光の前の色を読む。`surface` は親の端末の体がその場所に来ているときだけ、ポーズに焼き直した見えない体（`bakePose`）の点を、骨で曲げる前の点と法線と一緒に返す。最後に描いてから 250ms たったら（縦持ちで描くのを止めている）、`visible` と `surface` は null を返す。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/session.svelte.test.ts` の `describe('Session のつなぎ方', ...)` の最後に足す。

```ts
it('席の体の 3D を引ける（自分は自分の人形、ほかの人は届いた体の Remote）', () => {
  const { s, play, tell } = setup(2);
  expect(s.rigOf(2)).toBe(play.world.rig);
  expect(s.rigOf(3)).toBeNull();
  tell(meMsg(3));
  expect(s.rigOf(3)).toBe(made.remotes.at(-1)!.rig);
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts`
Expected: FAIL（`rigOf` が無い）。

- [ ] **Step 3: Session に rigOf を足す**

`src/lib/games/yappari-chameleon/session.svelte.ts` の `pinPaint` の下に足す。

```ts
  /** 席の体の 3D。CPU の目と筆（Senses3d）が、体ありと体なしで描き分け、体の表面を読む */
  rigOf(seat: Seat): DollRig | null {
    return seat === this.match.me ? this.play.world.rig : (this.#remotes.get(seat)?.rig ?? null);
  }
```

- [ ] **Step 4: World に CPU の目の口を足す**

`src/lib/games/yappari-chameleon/world3d.ts` の `class World` の `level: Level = …` の下に足す。

```ts
/** 最後に描いた時刻。縦持ちで描くのを止めているあいだ、CPU の目と筆は古い体を見ない */
renderedAt = -Infinity;
```

`render()` の頭に `this.renderedAt = performance.now();` を足し、`spoit` の下に足す。

```ts
  /** 屋敷の面の、光が当たる前の色。o から向き d（長さ 1）の先で最初に当たる面。三角旗のひもの線は当たりを 1m 広く取るので飛ばす */
  pickStage(o: V3, d: V3): { color: RGB; metal: number; rough: number } | null {
    if (!this.#stage) return null;
    this.#ray.set(new THREE.Vector3(...o), new THREE.Vector3(...d));
    const hit = this.#ray.intersectObject(this.#stage, true).find((h) => (h.object as THREE.Mesh).isMesh);
    if (!hit) return null;
    const m = (hit.object as THREE.Mesh).material;
    return readPick(Array.isArray(m) ? m[hit.face?.materialIndex ?? 0] : m, hit.uv);
  }

  /**
   * CPU の目。cam から rt へ描き、画素を out へ読む。自分の印（張り付きの赤い輪・筆の輪）と透かしの窓は消して描く。
   * 影は描き直さない（日は動かないので前のコマの影で足りる。描き直すと 2048² の影を目の 1 枚ごとに描く）
   */
  look(cam: THREE.Camera, rt: THREE.WebGLRenderTarget, out: Uint8Array): void {
    const r = this.renderer;
    const xray = XRAY.on.value;
    const ring = this.#ring.visible;
    const cursor = this.#cursor.visible;
    XRAY.on.value = 0;
    this.#ring.visible = this.#cursor.visible = false;
    r.shadowMap.autoUpdate = false;
    r.setRenderTarget(rt);
    r.render(this.scene, cam);
    r.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, out);
    r.setRenderTarget(null);
    r.shadowMap.autoUpdate = true;
    XRAY.on.value = xray;
    this.#ring.visible = ring;
    this.#cursor.visible = cursor;
  }
```

- [ ] **Step 5: Senses3d を書く**

`src/lib/games/yappari-chameleon/cpu/senses3d.ts` を作る。

```ts
import * as THREE from 'three';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { bakePose, type DollRig } from '../doll3d';
import type { Me } from '../net';
import { placement } from '../shots';
import type { World } from '../world3d';
import type { Paint, Senses, SurfacePoint } from './senses';

/** CPU の目の絵の大きさ（画素） */
const SIZE = 96;
/** 体が絵の高さのおよそ 9 割に収まる画角で描く。遠い体も同じ細かさで比べ、遠さは頭脳が別に数える */
const FRAME = 0.9;
/** 最後に描いてからこれだけたった 3D は古い（縦持ちで描くのを止めている）ので答えない */
const STALE_MS = 250;
/** 体の点は三角形の角ごとに並び、隣どうしが同じ点なので、間引いて渡す */
const STRIDE = 3;

/** 親の端末の 3D で、CPU の頭脳に目立ち・面の色・体の表面を答える */
export class Senses3d implements Senses {
  readonly #world: World;
  readonly #rigOf: (seat: Seat) => DollRig | null;
  readonly #rt = new THREE.WebGLRenderTarget(SIZE, SIZE);
  readonly #cam = new THREE.PerspectiveCamera(30, 1, 0.05, 40);
  readonly #with = new Uint8Array(SIZE * SIZE * 4);
  readonly #without = new Uint8Array(SIZE * SIZE * 4);

  constructor(world: World, rigOf: (seat: Seat) => DollRig | null) {
    this.#world = world;
    this.#rigOf = rigOf;
    // 画面と同じく sRGB で比べる（色の違いの閾値を、見た目の違いに合わせる）
    this.#rt.texture.colorSpace = THREE.SRGBColorSpace;
  }

  #fresh(): boolean {
    return performance.now() - this.#world.renderedAt < STALE_MS;
  }

  visible(seat: Seat, by: Seat, eye: V3, at: V3, diff: number): number | null {
    const rig = this.#rigOf(seat);
    if (!this.#fresh() || !rig?.root.visible) return null;
    const cam = this.#cam;
    const far = Math.hypot(at[0] - eye[0], at[1] - eye[1], at[2] - eye[2]);
    cam.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(FRAME / Math.max(far, 0.1))), 4, 72);
    cam.updateProjectionMatrix();
    cam.position.set(...eye);
    cam.lookAt(...at);
    cam.updateMatrixWorld();
    // 見ている CPU 自身の体（目の高さに頭と銃がある）は描かない
    const self = this.#rigOf(by);
    const shown = self?.root.visible ?? false;
    if (self) self.root.visible = false;
    this.#world.look(cam, this.#rt, this.#with);
    rig.root.visible = false;
    this.#world.look(cam, this.#rt, this.#without);
    rig.root.visible = true;
    if (self) self.root.visible = shown;
    const k = 255 * diff;
    const a = this.#with;
    const b = this.#without;
    let n = 0;
    for (let i = 0; i < a.length; i += 4)
      if (Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2])) > k) n++;
    return n / (SIZE * SIZE);
  }

  colorAt(o: V3, d: V3): Paint | null {
    return this.#world.pickStage(o, d);
  }

  surface(seat: Seat, body: Me): SurfacePoint[] | null {
    const rig = this.#rigOf(seat);
    if (!this.#fresh() || !rig?.root.visible) return null;
    const want = placement(body).at;
    const p = rig.root.position;
    if (Math.hypot(p.x - want[0], p.y - want[1], p.z - want[2]) > 0.01) return null;
    bakePose(rig);
    const baked = rig.pick.geometry.attributes.position;
    const rest = rig.mesh.geometry.attributes.position;
    const nrm = rig.mesh.geometry.attributes.normal;
    const m = rig.mesh.matrixWorld;
    const v = new THREE.Vector3();
    const out: SurfacePoint[] = [];
    for (let i = 0; i < baked.count; i += STRIDE) {
      v.fromBufferAttribute(baked, i).applyMatrix4(m);
      out.push({
        rest: [rest.getX(i), rest.getY(i), rest.getZ(i)],
        normal: [nrm.getX(i), nrm.getY(i), nrm.getZ(i)],
        world: [v.x, v.y, v.z]
      });
    }
    return out;
  }

  dispose(): void {
    this.#rt.dispose();
  }
}
```

- [ ] **Step 6: テストが通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon && pnpm check`
Expected: PASS。`cpu/guard.test.ts` は `senses3d.ts` を読まないので通る。

- [ ] **Step 7: 本物の 3D で目と筆を確かめる**

dev サーバーを `pnpm dev --port 5180` で起動しておく。`<scratchpad>/cpu/senses-check.mjs` を作る。

```js
// 実行: node <scratchpad>/cpu/senses-check.mjs <repo の絶対パス> <撮った絵を置く dir>
// ひとりで試すの 3D で Senses3d を作り、白い体と塗った体の目立ち・面の色・体の表面の点・描くのを止めたときの null を確かめる
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const [repo, out] = process.argv.slice(2);
await mkdir(out, { recursive: true });
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');
const BASE = '/asobibako/src/lib/games/yappari-chameleon';
const SPOT = [3.5, 0, 5.2];
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:5180/asobibako/games/yappari-chameleon', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.locator('button.solo').click();
await page.waitForFunction(() => !!window.__chameleon, null, { timeout: 120000 });
await page.waitForTimeout(2000);

/** 入口の目の高さから体を見る一人称の絵を撮る（CPU の目と同じ所から） */
async function fromEntrance(name) {
  await page.evaluate((spot) => {
    const p = window.__chameleon;
    if (p.mode !== 'eye') p.toggleEye();
    p.ghost = { pos: [0, 0, 0.6], vy: 0, yaw: 0, ground: true, cling: null };
    p.eyeYaw = Math.atan2(spot[0], spot[2] - 0.6);
    p.eyePitch = 0.05;
  }, SPOT);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.evaluate(() => window.__chameleon.mode === 'eye' && window.__chameleon.toggleEye());
}

await page.evaluate((spot) => window.__chameleon.placeAt(spot, Math.PI / 2), SPOT);
await page.waitForTimeout(800);
await fromEntrance('white');
const result = await page.evaluate(async (base) => {
  const { Senses3d } = await import(`${base}/cpu/senses3d.ts`);
  const { HiderBrain } = await import(`${base}/cpu/hider.ts`);
  const { SKILLS } = await import(`${base}/cpu/levels.ts`);
  const { bodyPoints } = await import(`${base}/oversight.ts`);
  const p = window.__chameleon;
  const w = p.world;
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const s = new Senses3d(w, (seat) => (seat === 1 ? w.rig : null));
  const b = p.body;
  const me = {
    ms: 0,
    pos: [...b.pos],
    yaw: b.yaw,
    cling: null,
    pose: p.pose,
    crouch: false,
    paint: false,
    look: [0, 0],
    eye: null
  };
  const [mid] = bodyPoints(me);
  const eye = [0, 1, 0.6];
  const white = s.visible(1, 2, eye, mid, 0.12);
  const len = Math.hypot(mid[0] - eye[0], mid[1] - eye[1], mid[2] - eye[2]);
  const wall = s.colorAt(eye, [(mid[0] - eye[0]) / len, (mid[1] - eye[1]) / len, (mid[2] - eye[2]) / len]);
  const points = s.surface(1, me);
  const brain = new HiderBrain(
    { pos: me.pos, yaw: me.yaw, cling: null, pose: me.pose, tier: 0 },
    SKILLS.strong,
    Math.random
  );
  const ctx = { me: 1, view: { phase: 'hide' }, level: w.level, bodies: new Map(), senses: s, now: 0, act: () => {} };
  for (let i = 0; i < 3000 && !brain.done; i++) {
    ctx.now += 16;
    brain.step(ctx, 1 / 60);
    if (i % 4 === 0) await frame();
  }
  p.log.add(brain.log.dabs);
  p.rebuildPaint();
  for (let i = 0; i < 10; i++) await frame();
  const painted = s.visible(1, 2, eye, mid, 0.12);
  const sharp = s.visible(1, 2, eye, mid, 0.05);
  w.renderedAt = -Infinity;
  const stale = [s.visible(1, 2, eye, mid, 0.12), s.surface(1, me)];
  s.dispose();
  return {
    white,
    painted,
    sharp,
    wall,
    points: points?.length ?? null,
    done: brain.done,
    dabs: brain.log.dabs.length,
    stale
  };
}, BASE);
await fromEntrance('painted');
await writeFile(`${out}/result.json`, JSON.stringify({ ...result, errors }, null, 2));
console.log(JSON.stringify({ ...result, errors }));
await browser.close();
```

Run: `node <scratchpad>/cpu/senses-check.mjs "$PWD" <scratchpad>/cpu/senses`
Expected: 合格の条件は次のとおり。

| 項目      | 合格                                                   |
| --------- | ------------------------------------------------------ |
| `white`   | 0.2 以上（白い体は大広間の木の壁の前ではっきり違う）   |
| `painted` | `white` の半分以下                                     |
| `sharp`   | `painted` 以上（閾値を下げると、わずかな違いも数える） |
| `wall`    | null でなく、`color` の 3 つが 0〜1                    |
| `points`  | 500 以上                                               |
| `done`    | true、`dabs` は 500 以上                               |
| `stale`   | `[null, null]`                                         |
| `errors`  | 空                                                     |

Read で `<scratchpad>/cpu/senses/white.png` と `painted.png` を見て、塗った体が入口から見て壁の色に寄っていること、どちらの絵にも透かしの穴や影の崩れが出ていないことを確かめる。`painted` が半分を切らないときは、`HiderBrain` の見られる位置（`viewOf`）と `fromEntrance` の目が同じ点か、`Senses3d.surface` の `world` が体の上にあるか（`points` の 1 つめを体の `pos` と比べる）を先に見る。

- [ ] **Step 8: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Answer CPU sight, surface colors and body points from the host device's 3D"
```

---

### Task 12: CPU の設定の画面と、選んだものを覚える

**Files:**

- Modify: `src/lib/games/yappari-chameleon/prefs.ts`
- Modify: `src/lib/backup.ts`
- Create: `src/lib/games/yappari-chameleon/CpuSetup.svelte`
- Modify: `src/lib/games/yappari-chameleon/Settings.svelte`
- Test: `src/lib/games/yappari-chameleon/prefs.test.ts`、`src/lib/backup.test.ts`、`src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts`、`src/lib/games/yappari-chameleon/Settings.svelte.test.ts`（新しく作る）

**Interfaces:**

- Consumes: Task 6 の `CpuChoice`・`CPU_DEFAULT`・`STRENGTHS`。
- Produces: `CPU_KEY = 'asobibako:yappari-chameleon:cpu'`、`readCpu(): CpuChoice`、`saveCpu(c: CpuChoice): void`。
- Produces: `CpuSetup.svelte` の props `{ choice: CpuChoice（$bindable）; onstart: () => void; onclose: () => void }`。`Settings.svelte` の props に `cpu?: boolean`（true ならゲームモードとハンターの人数の行を出さない）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/prefs.test.ts` の import を `import { CPU_KEY, readCpu, readSettings, saveCpu, saveSettings, SETTINGS_KEY } from './prefs';` にし、`import { CPU_DEFAULT } from './cpu/levels';` を足して、最後に足す。

```ts
describe('CPU の設定', () => {
  it('覚えた設定を読み、無ければ既定', () => {
    expect(readCpu()).toEqual(CPU_DEFAULT);
    saveCpu({ side: 'seek', count: 2, mode: 'infect', strength: 'strong' });
    expect(readCpu()).toEqual({ side: 'seek', count: 2, mode: 'infect', strength: 'strong' });
  });

  it('隠れるでは増え鬼を読まず、知らない値や壊れた値は既定に戻す', () => {
    localStorage.setItem(CPU_KEY, JSON.stringify({ side: 'hide', count: 2, mode: 'infect', strength: 'weak' }));
    expect(readCpu()).toEqual({ side: 'hide', count: 2, mode: 'normal', strength: 'weak' });
    localStorage.setItem(CPU_KEY, JSON.stringify({ side: 'x', count: 3, mode: 'double', strength: 'max' }));
    expect(readCpu()).toEqual(CPU_DEFAULT);
    localStorage.setItem(CPU_KEY, 'null');
    expect(readCpu()).toEqual(CPU_DEFAULT);
    localStorage.setItem(CPU_KEY, '{');
    expect(readCpu()).toEqual(CPU_DEFAULT);
  });
});
```

`src/lib/backup.test.ts` の「最近のゲーム・タブ・ミュート・絵柄だけなら記録なしとみなす」の `localStorage.setItem('asobibako:oekaki-mori:chars', '3');` の下に足す。

```ts
localStorage.setItem('asobibako:yappari-chameleon:cpu', '{"side":"seek"}');
```

`src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts` を作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import CpuSetup from './CpuSetup.svelte';
import { CPU_DEFAULT, type CpuChoice } from './cpu/levels';

function show() {
  const choice = $state<CpuChoice>({ ...CPU_DEFAULT });
  const onstart = vi.fn();
  const onclose = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(CpuSetup, { target, props: { choice, onstart, onclose } });
  flushSync();
  const button = (text: string) =>
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
  const click = (text: string) => {
    button(text).click();
    flushSync();
  };
  return { target, choice, onstart, onclose, button, click, done: () => unmount(app) };
}

describe('CpuSetup', () => {
  it('役・CPU の人数・モード・強さを漢字まじりの言葉で出す', () => {
    const { target, done } = show();
    expect(target.querySelector('[aria-label="CPU の設定"]')).not.toBeNull();
    for (const word of [
      'CPU の設定',
      '役',
      '隠れる',
      '探す',
      'CPU の人数',
      'ゲームモード',
      '通常',
      '増え鬼',
      '強さ',
      '弱い',
      '普通',
      '強い',
      'ゲームを始める'
    ])
      expect(target.textContent).toContain(word);
    done();
  });

  it('隠れるでは増え鬼を押せず、探すにすると押せる。隠れるへ戻すと通常に戻す', () => {
    const { choice, button, click, done } = show();
    expect(button('増え鬼').disabled).toBe(true);
    click('探す');
    expect(button('増え鬼').disabled).toBe(false);
    click('増え鬼');
    expect(choice.mode).toBe('infect');
    click('隠れる');
    expect(choice).toMatchObject({ side: 'hide', mode: 'normal' });
    done();
  });

  it('選んだものを choice に書き、ゲームを始めるで onstart、閉じるで onclose', () => {
    const { choice, click, onstart, onclose, done } = show();
    click('探す');
    click('2');
    click('強い');
    expect({ ...choice }).toEqual({ side: 'seek', count: 2, mode: 'normal', strength: 'strong' });
    click('ゲームを始める');
    expect(onstart).toHaveBeenCalledTimes(1);
    click('閉じる');
    expect(onclose).toHaveBeenCalledTimes(1);
    done();
  });
});
```

`src/lib/games/yappari-chameleon/Settings.svelte.test.ts` を作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULTS, type Settings as S } from './referee';
import Settings from './Settings.svelte';

function show(cpu: boolean) {
  const settings = $state<S>({ ...DEFAULTS });
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Settings, { target, props: { settings, players: 2, cpu, onstart: vi.fn(), onclose: vi.fn() } });
  flushSync();
  return { target, done: () => unmount(app) };
}

describe('Settings', () => {
  it('CPU と遊ぶでは、ゲームモードとハンターの人数の行を出さない（CPU の設定で決める）', () => {
    const cpu = show(true);
    expect(cpu.target.textContent).not.toContain('ゲームモード');
    expect(cpu.target.textContent).not.toContain('ハンターの人数');
    expect(cpu.target.textContent).toContain('ハンター待機時間（秒）');
    cpu.done();
    const plain = show(false);
    expect(plain.target.textContent).toContain('ゲームモード');
    plain.done();
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/prefs.test.ts src/lib/backup.test.ts src/lib/games/yappari-chameleon/CpuSetup.svelte.test.ts src/lib/games/yappari-chameleon/Settings.svelte.test.ts`
Expected: FAIL（`readCpu` と `CpuSetup.svelte` が無い。CPU の設定が記録ありに数えられる。`Settings` が `cpu` を見ない）。

- [ ] **Step 3: 覚える口を書く**

`src/lib/games/yappari-chameleon/prefs.ts` の import に `import { CPU_DEFAULT, type CpuChoice } from './cpu/levels';` を足し、最後に足す。

```ts
export const CPU_KEY = 'asobibako:yappari-chameleon:cpu';

const one = <T>(v: unknown, list: readonly T[], or: T): T => (list.includes(v as T) ? (v as T) : or);

/** 前に選んだ CPU の設定。知らない値は既定に戻す */
export function readCpu(): CpuChoice {
  try {
    const s = JSON.parse(localStorage.getItem(CPU_KEY) ?? '{}') as Record<string, unknown>;
    const side = one(s.side, ['hide', 'seek'] as const, CPU_DEFAULT.side);
    return {
      side,
      count: one(s.count, [1, 2] as const, CPU_DEFAULT.count),
      // 隠れるときはプレイヤー 1 人が隠れ、見つかった時点で終わるので、増え鬼にしない
      mode: side === 'hide' ? 'normal' : one(s.mode, ['normal', 'infect'] as const, CPU_DEFAULT.mode),
      strength: one(s.strength, ['weak', 'normal', 'strong'] as const, CPU_DEFAULT.strength)
    };
  } catch {
    return { ...CPU_DEFAULT };
  }
}

export function saveCpu(c: CpuChoice): void {
  try {
    localStorage.setItem(CPU_KEY, JSON.stringify(c));
  } catch {
    // 覚えられなくても、選んだ設定で始められる
  }
}
```

`src/lib/backup.ts` の `NOT_RECORDS` の `'asobibako:oekaki-mori:chars'` の下に `'asobibako:yappari-chameleon:cpu'` を足し、上のコメントの「絵柄（らくがきパレード）と動物・遊ぶ長さ（おえかきのもり）も好みなので数えない。」を「絵柄（らくがきパレード）と動物・遊ぶ長さ（おえかきのもり）と CPU の設定（やっぱりカメレオン）も好みなので数えない。」にする。

- [ ] **Step 4: CPU の設定の画面を書く**

`src/lib/games/yappari-chameleon/CpuSetup.svelte` を作る。

```svelte
<script lang="ts">
  import { STRENGTHS, type CpuChoice } from './cpu/levels';

  let {
    choice = $bindable(),
    onstart,
    onclose
  }: { choice: CpuChoice; onstart: () => void; onclose: () => void } = $props();
  const COUNTS = [1, 2] as const;
  const hide = $derived(choice.side === 'hide');

  // 隠れるときはプレイヤー 1 人が隠れ、見つかった時点で終わるので、増え鬼にしない
  function hiding() {
    choice.side = 'hide';
    choice.mode = 'normal';
  }
</script>

<div class="sheet" role="dialog" aria-label="CPU の設定">
  <h2>CPU の設定</h2>
  <div class="row">
    <span>役</span>
    <span class="pick">
      <button class:on={hide} aria-pressed={hide} onclick={hiding}>隠れる</button>
      <button class:on={!hide} aria-pressed={!hide} onclick={() => (choice.side = 'seek')}>探す</button>
    </span>
  </div>
  <div class="row">
    <span>CPU の人数</span>
    <span class="pick">
      {#each COUNTS as n (n)}
        <button class:on={choice.count === n} aria-pressed={choice.count === n} onclick={() => (choice.count = n)}
          >{n}</button
        >
      {/each}
    </span>
  </div>
  <div class="row" class:dim={hide}>
    <span>ゲームモード</span>
    <span class="pick">
      <button class:on={choice.mode === 'normal'} onclick={() => (choice.mode = 'normal')}>通常</button>
      <button class:on={choice.mode === 'infect'} disabled={hide} onclick={() => (choice.mode = 'infect')}
        >増え鬼</button
      >
    </span>
  </div>
  <div class="row">
    <span>強さ</span>
    <span class="pick">
      {#each STRENGTHS as s (s.id)}
        <button
          class:on={choice.strength === s.id}
          aria-pressed={choice.strength === s.id}
          onclick={() => (choice.strength = s.id)}>{s.name}</button
        >
      {/each}
    </span>
  </div>
  <p class="note">{hide ? 'CPU のハンターから隠れる。見つかったら終わり' : '隠れた CPU を探して撃つ'}</p>
  <div class="actions">
    <button onclick={onclose}>閉じる</button>
    <button class="go" onclick={onstart}>ゲームを始める</button>
  </div>
</div>

<style>
  .sheet {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    display: grid;
    gap: 12px;
    width: min(560px, 92cqw);
    padding: 20px 26px;
    border-radius: 14px;
    background: rgb(20 18 16 / 0.92);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
    text-shadow: none;
  }

  h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: normal;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .dim {
    opacity: 0.4;
  }

  .pick {
    display: flex;
    gap: 8px;
  }

  .note {
    margin: 0;
    text-align: right;
    font-size: 14px;
  }

  button {
    padding: 6px 16px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
  }

  button.on {
    background: rgb(255 255 255 / 0.9);
    color: #1d1a17;
  }

  button:disabled {
    opacity: 0.45;
  }

  .actions {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
  }

  .go {
    border-color: #7cc243;
    background: #3f8a2a;
  }
</style>
```

- [ ] **Step 5: マップの設定に CPU 向けの形を足す**

`src/lib/games/yappari-chameleon/Settings.svelte` の props を次にする。

```ts
let {
  settings = $bindable(),
  players,
  cpu = false,
  onstart,
  onclose
}: { settings: Settings; players: number; cpu?: boolean; onstart: () => void; onclose: () => void } = $props();
```

本文の「ゲームモード」の `<div class="row">` から「ハンターの人数」の `</div>` までを `{#if !cpu}` と `{/if}` で囲み、`{#if !cpu}` の上にコメントを 1 行置く。

```svelte
<!-- CPU と遊ぶでは、モードとハンターは CPU の設定の役で決める -->
```

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon src/lib/backup.test.ts`
Expected: PASS。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS（`CpuSetup.svelte` は 200 行未満）。

```bash
git add src/lib/games/yappari-chameleon src/lib/backup.ts src/lib/backup.test.ts
git commit -m "Add the CPU setup sheet and remember the chosen CPU match"
```

---

### Task 13: 入口とロビーから CPU と遊ぶ

**Files:**

- Modify: `src/lib/games/yappari-chameleon/Entry.svelte`
- Modify: `src/lib/games/yappari-chameleon/Yappari.svelte`
- Modify: `src/lib/games/yappari-chameleon/Online.svelte`
- Modify: `src/lib/games/yappari-chameleon/Overlay.svelte`
- Modify: `src/lib/games/yappari-chameleon/Lobby.svelte`
- Test: `src/lib/games/yappari-chameleon/Entry.svelte.test.ts`、`src/lib/games/yappari-chameleon/Lobby.svelte.test.ts`、`src/lib/games/yappari-chameleon/Overlay.svelte.test.ts`

**Interfaces:**

- Consumes: Task 10 の `Crew`（`seat`・`queue`・`go`・`play`・`step`・`stop`・`senses`）。Task 11 の `Senses3d` と `Session.rigOf`。Task 12 の `CpuSetup.svelte`・`readCpu`・`saveCpu`・`Settings` の `cpu`。
- Produces: `Entry.svelte` の props に `oncpu: (choice: CpuChoice) => void`。`Online.svelte` の props に `crew?: Crew | null`。`Overlay.svelte` の props に `crew?: Crew | null`。`Lobby.svelte` の props に `crew?: Crew | null`。
- Produces: dev のあいだ `window.__crew`（headless の確かめが CPU の頭脳と目を読む）。

始まりの順は、入口の「ゲームを始める」→ `Yappari` が親の `Party` と審判を作り（`hosting`）、`Crew.seat` で CPU を座らせ、`Crew.queue` で試合を待たせてからつないだ画面へ移る → `Online` が 3D と `Session` を作り終えたら `crew.senses` に `Senses3d` を入れて `crew.go()`。こうして紹介の 3 秒を 3D を作るあいだに過ぎさせない。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/Entry.svelte.test.ts` を次にする。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Entry from './Entry.svelte';
import { CPU_KEY } from './prefs';

function show(props: Record<string, unknown> = {}) {
  const target = document.body.appendChild(document.createElement('div'));
  const onsolo = vi.fn();
  const oncpu = vi.fn();
  const app = mount(Entry, { target, props: { onhost: vi.fn(), onparty: vi.fn(), onsolo, oncpu, ...props } });
  flushSync();
  const buttons = () => [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
  const click = (text: string) => {
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!.click();
    flushSync();
  };
  return { target, onsolo, oncpu, buttons, click, done: () => unmount(app) };
}

afterEach(() => localStorage.clear());

describe('Entry', () => {
  it('なかまを呼ぶ・なかまに入る・CPU と遊ぶ・ひとりで試すの 4 つと、短い遊び方を出す', () => {
    const { target, buttons, onsolo, done } = show();
    const [call, join, cpu, solo] = buttons();
    expect(call).toMatch(/^なかまを呼ぶ/);
    expect(join).toMatch(/^なかまに入る/);
    expect(cpu).toBe('CPU と遊ぶ');
    expect(solo).toBe('ひとりで試す');
    expect(target.textContent).toContain('自分の iPad の画面は見せないでね');
    target.querySelector<HTMLButtonElement>('.solo')!.click();
    expect(onsolo).toHaveBeenCalledTimes(1);
    done();
  });

  it('切れた子には理由と「もう一度つなぐ」を出す', () => {
    const { target, buttons, done } = show({ note: 'ホストとの接続が切れました', was: 2 });
    expect(target.textContent).toContain('ホストとの接続が切れました');
    expect(buttons()[0]).toContain('もう一度つなぐ');
    // 親が戻らなくても、ほかの人と遊び直せる
    expect(buttons().slice(1)).toEqual([
      expect.stringMatching(/^なかまを呼ぶ/),
      expect.stringMatching(/^なかまに入る/),
      'CPU と遊ぶ',
      'ひとりで試す'
    ]);
    done();
  });

  it('CPU と遊ぶを押すと CPU の設定を出し、選んで始めると覚えて oncpu に渡す', () => {
    const { target, click, oncpu, done } = show();
    click('CPU と遊ぶ');
    expect(target.querySelector('[aria-label="CPU の設定"]')).not.toBeNull();
    click('探す');
    click('増え鬼');
    click('2');
    click('強い');
    click('ゲームを始める');
    const want = { side: 'seek', count: 2, mode: 'infect', strength: 'strong' };
    expect(oncpu).toHaveBeenCalledWith(want);
    expect(JSON.parse(localStorage.getItem(CPU_KEY)!)).toEqual(want);
    expect(target.querySelector('[aria-label="CPU の設定"]')).toBeNull();
    done();
  });

  it('CPU の設定は閉じるで閉じ、前に選んだものを出す', () => {
    localStorage.setItem(CPU_KEY, JSON.stringify({ side: 'seek', count: 2, mode: 'normal', strength: 'weak' }));
    const { target, click, oncpu, done } = show();
    click('CPU と遊ぶ');
    expect(target.querySelector('button.on')?.textContent?.trim()).toBe('探す');
    click('閉じる');
    expect(target.querySelector('[aria-label="CPU の設定"]')).toBeNull();
    expect(oncpu).not.toHaveBeenCalled();
    done();
  });
});
```

`src/lib/games/yappari-chameleon/Lobby.svelte.test.ts` の import に `import type { Crew } from './cpu/crew';` と `import { CPU_KEY } from './prefs';`（`SETTINGS_KEY` の import に並べる）を足し、最後に足す。

```ts
describe('CPU と遊ぶのロビー', () => {
  function showCpu() {
    const play = vi.fn();
    const start = vi.fn();
    const looks = { 2: 'cpu' };
    const session = {
      party: { host: true, members: [1, 2], looks },
      match: new Match(
        () => 1,
        () => looks
      ),
      start
    } as unknown as Session;
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Lobby, { target, props: { session, crew: { play } as unknown as Crew, oninvite: vi.fn() } });
    flushSync();
    const button = (text: string) =>
      [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement;
    const click = (text: string) => {
      button(text).click();
      flushSync();
    };
    return { target, play, start, button, click, done: () => unmount(app) };
  }

  it('顔ぶれを CPU の名前で出し、CPU の設定を出して、なかまを呼ぶを出さない', () => {
    const { target, button, done } = showCpu();
    expect(target.textContent).toContain('プレイヤー1・CPU 1（2/3人）');
    expect(button('CPU の設定')).toBeDefined();
    expect(button('なかまを呼ぶ')).toBeUndefined();
    done();
  });

  it('CPU の設定で選んで始めると、覚えて crew.play に渡す（session.start は使わない）', () => {
    const { click, play, start, done } = showCpu();
    click('CPU の設定');
    click('探す');
    click('増え鬼');
    click('強い');
    click('ゲームを始める');
    expect(play).toHaveBeenCalledWith(
      { side: 'seek', count: 1, mode: 'infect', strength: 'strong' },
      expect.objectContaining({ hide: 120 })
    );
    expect(start).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem(CPU_KEY)!).side).toBe('seek');
    done();
  });

  it('マップの設定から始めても crew.play に渡し、ゲームモードとハンターの人数の行を出さない', () => {
    const { target, click, play, start, done } = showCpu();
    click('マップの設定');
    expect(target.textContent).not.toContain('ゲームモード');
    expect(target.textContent).not.toContain('ハンターの人数');
    click('ゲームを始める');
    expect(play).toHaveBeenCalledWith(
      expect.objectContaining({ side: 'hide' }),
      expect.objectContaining({ hide: 120 })
    );
    expect(start).not.toHaveBeenCalled();
    done();
  });
});
```

`src/lib/games/yappari-chameleon/Overlay.svelte.test.ts` の `show` に 5 つめの引数 `props: Record<string, unknown> = {}` を足して `mount(Overlay, { target, props: { session, radius: 70, center: () => [0, 0], onleave: vi.fn(), ...props } })` にし、`describe('Overlay', ...)` の最後に足す。

```ts
it('CPU と遊ぶでは「よびなおす」を出さず、ロビーに CPU の設定を出す', () => {
  const party = { host: true, members: [1, 2], away: [3], looks: { 2: 'cpu' } };
  const cpu = show('hider', { phase: 'lobby' }, 1, { party }, { crew: { play: vi.fn() } });
  expect(cpu.labels()).toContain('CPU の設定');
  expect(cpu.labels()).not.toContain('よびなおす');
  expect(cpu.labels()).not.toContain('なかまを呼ぶ');
  cpu.done();
  const plain = show('hider', { phase: 'lobby' }, 1, { party });
  expect(plain.labels()).toContain('よびなおす');
  plain.done();
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/Entry.svelte.test.ts src/lib/games/yappari-chameleon/Lobby.svelte.test.ts src/lib/games/yappari-chameleon/Overlay.svelte.test.ts`
Expected: FAIL（「CPU と遊ぶ」と「CPU の設定」が無い。CPU と遊ぶでも「よびなおす」が出る）。

- [ ] **Step 3: 入口に CPU と遊ぶを足す**

`src/lib/games/yappari-chameleon/Entry.svelte` の script の import に足す。

```ts
import CpuSetup from './CpuSetup.svelte';
import type { CpuChoice } from './cpu/levels';
import { readCpu, saveCpu } from './prefs';
```

props に `oncpu` を足す（型の行は `oncpu: (choice: CpuChoice) => void;`）。`let failed = $state('');` の下に足す。

```ts
let picking = $state(false);
let choice = $state(readCpu());

function startCpu() {
  saveCpu(choice);
  picking = false;
  oncpu($state.snapshot(choice));
}
```

本文の `<button class="solo" onclick={onsolo}>ひとりで試す</button>` を次にし、`{#if failed || note}` の上に CPU の設定を足す。

```svelte
<div class="row">
  <button class="cpu" onclick={() => (picking = true)}>CPU と遊ぶ</button>
  <button class="solo" onclick={onsolo}>ひとりで試す</button>
</div>
```

```svelte
{#if picking}<CpuSetup bind:choice onstart={startCpu} onclose={() => (picking = false)} />{/if}
```

style の `.go, .solo` を `.go, .solo, .cpu` に、`.solo { padding…; border-style: dashed; font-size: 18px; }` を次にする。

```css
.solo,
.cpu {
  padding: 8px 24px;
  font-size: 18px;
}

.solo {
  border-style: dashed;
}
```

- [ ] **Step 4: Yappari で CPU の試合を始める**

`src/lib/games/yappari-chameleon/Yappari.svelte` の script を次にする（本文の `<main>` から下は、`<Online …>` と `<Entry …>` の 2 行を書き換える）。

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { animate } from '$lib/loop';
  import type { Message } from '$lib/net/link';
  import { MISMATCH, Party, type Seat } from '$lib/net/party.svelte';
  import Chameleon from './Chameleon.svelte';
  import { Crew } from './cpu/crew';
  import type { CpuChoice } from './cpu/levels';
  import Entry from './Entry.svelte';
  import { Host } from './host';
  import { levelOf, mansion } from './mansion/layout';
  import Online from './Online.svelte';
  import { readSettings } from './prefs';
  import type { Inbox } from './session.svelte';

  let screen = $state<'entry' | 'solo' | 'online'>('entry');
  let party = $state.raw<Party | null>(null);
  let host = $state.raw<Host | null>(null);
  let crew = $state.raw<Crew | null>(null);
  let note = $state('');
  /** 親とのつながりが切れた子の、切れる前の番号。入口で「もう一度つなぐ」を出し、同じ番号で戻る */
  let was = $state<Seat>();
  let stopHost: (() => void) | null = null;
  let inbox = $state.raw<Inbox | null>(null);

  function unhost() {
    stopHost?.();
    stopHost = null;
    host = null;
    crew?.stop();
    crew = null;
  }

  /** 審判は描画と別に回す。親が縦持ちにして描くのを止めても、試合の時計と CPU は進める */
  function hosting(p: Party) {
    unhost();
    const h = new Host(p, (seed) => levelOf(mansion(seed)));
    const stop = animate((dt, now) => {
      h.step();
      crew?.step(dt, now);
    });
    host = h;
    stopHost = () => {
      stop();
      h.stop();
    };
    return () => host === h && unhost();
  }

  /** CPU と遊ぶ。CPU を席に着けてからつないだ画面へ移り、試合は 3D ができてから始める（Online が crew.go を呼ぶ） */
  async function cpu(choice: CpuChoice) {
    const p = Party.host();
    hosting(p);
    const c = new Crew(p, host!);
    crew = c;
    await c.seat(choice);
    // 待つあいだに入口へ戻った
    if (crew !== c) return;
    c.queue(choice, readSettings());
    joined(p);
  }

  function joined(p: Party) {
    // 親は迎えてすぐ全員の体と塗りを送る。3D を作り終えるまで落とさないよう、ここからためる
    inbox?.stop();
    const messages: Message[] = [];
    inbox = { messages, stop: p.onTell((m) => messages.push(m)) };
    note = '';
    was = undefined;
    party = p;
    screen = 'online';
  }

  function leave(text = '', seat?: Seat) {
    inbox?.stop();
    inbox = null;
    party?.close();
    party = null;
    unhost();
    note = text;
    was = seat;
    screen = 'entry';
  }

  // 子で親とのつながりが切れたら、入口から同じ番号でつなぎ直せるようにする（版ちがいで切られたら戻れない）
  $effect(() => {
    if (!party?.lost) return;
    if (party.mismatch) leave(MISMATCH);
    else leave('ホストとの接続が切れました', party.me);
  });

  onDestroy(() => leave());
</script>
```

本文の 2 行を次にする。

```svelte
<Online {party} {host} {inbox} {crew} onleave={(text) => leave(text)} />
```

```svelte
<Entry {note} {was} onhost={hosting} onparty={joined} onsolo={() => (screen = 'solo')} oncpu={cpu} />
```

- [ ] **Step 5: Online で目を入れて試合を始め、Overlay と Lobby に Crew を渡す**

`src/lib/games/yappari-chameleon/Online.svelte` の import に `import type { Crew } from './cpu/crew';` と `import { Senses3d } from './cpu/senses3d';` を足し、props を次にする。

```ts
let {
  party,
  host,
  inbox,
  crew = null,
  onleave
}: {
  party: Party;
  host: Host | null;
  inbox: Inbox | null;
  crew?: Crew | null;
  onleave: (note?: string) => void;
} = $props();
```

`let session = $state.raw<Session | null>(null);` の下に `let senses: Senses3d | null = null;` を足し、`mount3d` の `ready` と `dispose` を次にする。

```ts
      ready: (world, makeRig) => {
        const s = new Session(party, new Play(world, radius), makeRig, host, inbox ?? undefined);
        session = s;
        if (crew) {
          senses = new Senses3d(world, (seat) => s.rigOf(seat));
          crew.senses = senses;
          crew.go();
        }
        if (import.meta.env.DEV) {
          const w = window as unknown as { __chameleon?: Play; __session?: Session; __crew?: Crew | null };
          w.__chameleon = s.play;
          w.__session = s;
          w.__crew = crew;
        }
      },
```

```ts
dispose: () => {
  if (crew) crew.senses = null;
  senses?.dispose();
  session?.dispose();
};
```

本文の `<Overlay {session} … />` に `{crew}` を足す。

`src/lib/games/yappari-chameleon/Overlay.svelte` の import に `import type { Crew } from './cpu/crew';` を足し、props を `{ session, radius, center, onleave, crew = null }: { session: Session; radius: number; center: () => [number, number]; onleave: () => void; crew?: Crew | null }` にする。`<Lobby {session} oninvite={() => (inviting = true)} />` を `<Lobby {session} {crew} oninvite={() => (inviting = true)} />` に、`{#if session.party.host}` の `<Invite …>` の行を次にする。

```svelte
<!-- CPU と遊ぶで人数を減らすと、閉じた CPU の席が切れた席として残るので、呼び直しを出さない -->
{#if session.party.host && !crew}
```

`src/lib/games/yappari-chameleon/Lobby.svelte` の script を次にする（style は今のまま）。

```svelte
<script lang="ts">
  import CpuSetup from './CpuSetup.svelte';
  import type { Crew } from './cpu/crew';
  import { readCpu, readSettings, saveCpu, saveSettings } from './prefs';
  import type { Session } from './session.svelte';
  import Settings from './Settings.svelte';

  let { session, crew = null, oninvite }: { session: Session; crew?: Crew | null; oninvite: () => void } = $props();
  let open = $state(false);
  let picking = $state(false);
  let settings = $state(readSettings());
  let choice = $state(readCpu());
  const party = $derived(session.party);

  /** CPU と遊ぶでは、マップの設定から始めても、ハンターとモードは CPU の設定の役で決める */
  function begin() {
    if (crew) void crew.play($state.snapshot(choice), $state.snapshot(settings));
    else session.start(settings);
  }

  function start() {
    saveSettings(settings);
    open = false;
    begin();
  }

  function startCpu() {
    saveCpu(choice);
    picking = false;
    begin();
  }
</script>

<div class="bar">
  <p>{party.members.map((seat) => session.match.name(seat)).join('・')}（{party.members.length}/3人）</p>
  {#if party.host}
    <button onclick={() => (open = true)}>マップの設定</button>
    {#if crew}
      <button onclick={() => (picking = true)}>CPU の設定</button>
    {:else if party.members.length < 3}
      <button onclick={oninvite}>なかまを呼ぶ</button>
    {/if}
  {:else}
    <p role="status">ホストが始めるのを待っています</p>
  {/if}
</div>
{#if open}
  <Settings bind:settings players={party.members.length} cpu={!!crew} onstart={start} onclose={() => (open = false)} />
{/if}
{#if picking}<CpuSetup bind:choice onstart={startCpu} onclose={() => (picking = false)} />{/if}
```

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（今のロビーのテストは `crew` を渡さないので、マップの設定から `session.start` に渡る）。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS（`Entry.svelte`・`Lobby.svelte`・`Overlay.svelte`・`Online.svelte`・`Yappari.svelte` はどれも 200 行未満）。`Entry.svelte` は 190 行ほどになる。`pnpm format` のあとで 200 行を超えたら、「CPU と遊ぶ」のボタン・`CpuSetup` を出す部分・`startCpu` を `EntryCpu.svelte`（props は `oncpu`）へ分け、`Entry.svelte` の行の中にはそれを置く。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Start CPU matches from the entry and the lobby once the 3D is ready"
```

---

### Task 14: 本物の 3D で通しの試合を確かめ、重さを測る

**Files:**

- Create（リポジトリに入れない）: `<scratchpad>/cpu/e2e-cpu.mjs`、`<scratchpad>/cpu/perf-cpu.mjs`、`<scratchpad>/cpu/e2e/*.png`、`<scratchpad>/cpu/e2e/result.json`、`<scratchpad>/cpu/perf.json`
- 直すものが出たら、そのファイルを Modify（数字は `cpu/levels.ts` の `SKILLS` と `cpu/hunter.ts` の `GAIN`・`MOVE_GAIN`・`LEAK`）

**Interfaces:**

- Consumes: Task 13 の `window.__crew`・`window.__session`・`window.__chameleon`、Task 9 の `HiderBrain`、Task 8 の `viewOf`。

確かめることは 4 つ。CPU と遊ぶが紹介から始まること、白いまま隠れた体は数秒で見つかり、まわりの色で塗った体は見つかりにくいこと（強さの段ごと）、探すの増え鬼で CPU が塗って隠れ、見つかった CPU がハンターになること、抜けてからもう一度 CPU と遊べること。重さは CPU の目の描き足しの分を測る。今の 2 台・3 台の試合は 2b の e2e で確かめる。

- [ ] **Step 1: 通しの試合のスクリプトを書く**

dev サーバーを `pnpm dev --port 5180` で起動しておく。`<scratchpad>/cpu/e2e-cpu.mjs` を作る。

```js
// 実行: node <scratchpad>/cpu/e2e-cpu.mjs [撮った絵を置く dir]
// 1 ページで CPU と遊ぶを headless の Chrome で通す。dev サーバーは 5180 で起動しておく
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const repo = '/Users/oekazuma/localRepo/asobibako/.claude/worktrees/meccha-chameleon-clone-51ef75';
const out = process.argv[2] ?? `${import.meta.dirname}/e2e`;
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');
const URL = 'http://localhost:5180/asobibako/games/yappari-chameleon';
const BASE = '/asobibako/src/lib/games/yappari-chameleon';
/** 入口から 5m ほど先の大広間の床（crew.test.ts の OPEN と同じ）。入口と大広間の見回す点から、どの種の置き方でも見える */
const SPOT = [3.5, 0, 5.2];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-angle=metal', '--autoplay-policy=no-user-gesture-required']
});
const errors = [];
const result = { intro: [], hide: [], seek: {}, again: false };

function prefs(choice) {
  localStorage.setItem('asobibako:yappari-chameleon:cpu', JSON.stringify(choice));
  localStorage.setItem(
    'asobibako:yappari-chameleon:settings',
    JSON.stringify({ mode: 'normal', hunters: 1, hide: 60, search: 90, reveal: 10, taunt: 0, overlook: true, v: 2 })
  );
}

/** CPU と遊ぶ → ゲームを始める。Session ができた直後に紹介が残り 2 秒以上あれば、3D を作るあいだに紹介を飛ばしていない */
async function start(page) {
  await page.getByRole('button', { name: 'CPU と遊ぶ' }).click();
  await page.getByRole('button', { name: 'ゲームを始める' }).click();
  await page.waitForFunction(() => window.__session?.match.synced, null, { timeout: 120000 });
  await page.waitForFunction(() => window.__session.match.phase === 'intro', null, { timeout: 5000 });
  return page.evaluate(() => window.__session.match.left);
}

async function open(choice) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  await context.addInitScript(prefs, choice);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  result.intro.push(await start(page));
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
  await page.evaluate(() => {
    const p = window.__chameleon;
    if (p.mode === 'eye' && p.role === 'hider') p.toggleEye();
  });
}

/** 本物の 3D の目と筆で、プレイヤーの体を強いの塗り方で塗る（CPU の隠れる人と同じ塗り方） */
const camouflage = (page) =>
  page.evaluate(async (base) => {
    const { HiderBrain } = await import(`${base}/cpu/hider.ts`);
    const { SKILLS } = await import(`${base}/cpu/levels.ts`);
    const p = window.__chameleon;
    const b = p.body;
    const brain = new HiderBrain(
      { pos: [...b.pos], yaw: b.yaw, cling: b.cling, pose: p.pose, tier: 0 },
      SKILLS.strong,
      Math.random
    );
    const ctx = {
      me: 1,
      view: window.__session.match.view,
      level: p.world.level,
      bodies: new Map(),
      senses: window.__crew.senses,
      now: 0,
      act: () => {}
    };
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    for (let i = 0; i < 4000 && !brain.done; i++) {
      ctx.now += 16;
      brain.step(ctx, 1 / 60);
      if (i % 4 === 0) await frame();
    }
    p.log.add(brain.log.dabs);
    p.rebuildPaint();
    return brain.log.dabs.length;
  }, BASE);

/** 隠れタイムを飛ばし、探索の始めから見つかるまでの秒。limit 秒で見つからなければ null */
async function caught(page, limit) {
  await page.evaluate(() => window.__session.ready());
  await phase(page, 'search', 10000);
  const t0 = Date.now();
  try {
    await page.waitForFunction(
      () => window.__session.match.found(1) || window.__session.match.phase !== 'search',
      null,
      {
        timeout: limit * 1000
      }
    );
  } catch {
    return null;
  }
  return (await page.evaluate(() => window.__session.match.found(1))) ? (Date.now() - t0) / 1000 : null;
}

try {
  for (const strength of ['weak', 'normal', 'strong'])
    for (const painted of [false, true]) {
      const { page, context } = await open({ side: 'hide', count: 1, mode: 'normal', strength });
      await phase(page, 'hide');
      await page.evaluate((spot) => window.__chameleon.placeAt(spot, Math.PI / 2), SPOT);
      await page.waitForTimeout(800);
      const dabs = painted ? await camouflage(page) : 0;
      await page.waitForTimeout(1000);
      await look(page, [0, 0, 0.6], [SPOT[0], 0.6, SPOT[2]], `hide-${strength}-${painted ? 'painted' : 'white'}`);
      const secs = await caught(page, 60);
      result.hide.push({ strength, painted, dabs, secs });
      console.log(JSON.stringify(result.hide.at(-1)));
      await context.close();
    }

  const { page, context } = await open({ side: 'seek', count: 2, mode: 'infect', strength: 'normal' });
  await phase(page, 'hide');
  await page.waitForFunction(() => [2, 3].every((s) => window.__session.match.view.ready.includes(s)), null, {
    timeout: 40000
  });
  result.seek.dabs = await page.evaluate(() => window.__crew.bots.map((b) => b.hider.log.dabs.length));
  await page.evaluate(() => window.__session.ready());
  await phase(page, 'search', 10000);
  const spots = await page.evaluate(async (base) => {
    const { viewOf } = await import(`${base}/cpu/spots.ts`);
    return window.__crew.bots.map((b) => ({ spot: b.hider.spot, view: viewOf(b.hider.spot) }));
  }, BASE);
  for (const [i, s] of spots.entries())
    await look(page, [s.view[0], s.view[1] - 1, s.view[2]], s.spot.pos, `seek-cpu${i + 1}`);
  // CPU 1 の胴を真上から撃つ知らせを、親の審判へ直に送る（隠れ場所は家具の陰なので、見られる位置からは当たらないことがある。
  // 撃つボタンからの道は 2b の e2e が通す）
  await page.evaluate(
    async ([base, spot]) => {
      const { bodyPoints } = await import(`${base}/oversight.ts`);
      const [mid] = bodyPoints(spot);
      const o = [mid[0], mid[1] + 0.6, mid[2]];
      window.__session.party.act({ t: 'shot', o, d: [0, -1, 0], from: o, ms: performance.now() });
    },
    [BASE, spots[0].spot]
  );
  await page.waitForFunction(() => window.__session.match.found(2), null, { timeout: 5000 });
  await page.waitForTimeout(2500);
  result.seek.turned = await page.evaluate(
    () => !!window.__crew.bots[0].hunter && window.__session.match.roleOf(2) === 'hunter'
  );
  const hunterAt = await page.evaluate(() => window.__crew.bots[0].hunter.walker.body.pos);
  const v0 = spots[0].view;
  await look(page, [v0[0], v0[1] - 1, v0[2]], [hunterAt[0], hunterAt[1] + 0.8, hunterAt[2]], 'seek-turned');

  // 抜けて入口へ戻り、もう一度 CPU と遊べる（✕ の aria-label も「抜ける」なので、確かめの画面の中のボタンを押す）
  await page.locator('button.quit').click();
  await page.getByRole('dialog').getByRole('button', { name: '抜ける' }).click({ timeout: 2000 });
  await page.getByRole('button', { name: 'CPU と遊ぶ' }).waitFor({ timeout: 5000 });
  result.intro.push(await start(page));
  result.again = true;
  await page.screenshot({ path: `${out}/again.png` });
  await context.close();
} finally {
  await writeFile(`${out}/result.json`, JSON.stringify({ ...result, errors }, null, 2));
  console.log(JSON.stringify({ ...result, errors }));
  await browser.close();
}
if (errors.length) process.exitCode = 1;
```

`look` の `p.eyePitch` は下向きが正（2b の e2e の `aim` と同じ）。`QuitConfirm` の「抜ける」は出てから 350ms 押せないので、`click` の `timeout` で待つ。

- [ ] **Step 2: 通しの試合を回して、合格を確かめる**

Run: `node <scratchpad>/cpu/e2e-cpu.mjs <scratchpad>/cpu/e2e`
Expected: 合格の条件は次のとおり。

| 項目              | 合格                                                                                |
| ----------------- | ----------------------------------------------------------------------------------- |
| `intro`           | どれも 2.0 以上（3D を作るあいだに紹介を飛ばしていない）                            |
| `hide` の白い体   | 3 段とも 20 秒以内に見つかる                                                        |
| `hide` の塗った体 | 弱いと普通は 60 秒見つからない（null）か白い体の 2 倍より遅い。強いは白い体より遅い |
| `seek.dabs`       | 2 人とも 300 以上                                                                   |
| `seek.turned`     | true                                                                                |
| `again`           | true                                                                                |
| `errors`          | 空                                                                                  |

Read で `hide-*-white.png` と `hide-*-painted.png` を見比べ、塗った体が壁と床に溶け込んでいること、`seek-cpu1.png` と `seek-cpu2.png` で CPU の体が見られる位置から見てまわりの色に寄っていること、`seek-turned.png` に銃を構えた白い CPU が立っていることを確かめる。

白い体が 20 秒で見つからない段があれば、先に `cpu/hunter.ts` の `GAIN` を上げる（`SKILLS` の `diff` は塗った体の見つかりにくさにも効くので、先に動かさない）。塗った体がすぐ見つかるなら、その段の `diff` を上げる。直したら `pnpm vitest run src/lib/games/yappari-chameleon/cpu` を通してから回し直す。

- [ ] **Step 3: 重さを測るスクリプトを書いて回す**

`<scratchpad>/cpu/perf-cpu.mjs` を作る。`<scratchpad>/perf-chameleon.mjs` と同じく、120 コマの `requestAnimationFrame` の間を平均して 1 コマの時間にする。

```js
// 実行: node <scratchpad>/cpu/perf-cpu.mjs <書き出す json>
// CPU と遊ぶ（隠れる・CPU 2 人）の隠れタイムに、CPU の目の描き足し（1 秒 8 回、2 人 × 1 体 × 1 秒 4 回）を入れた 1 コマの時間を測る
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const repo = '/Users/oekazuma/localRepo/asobibako/.claude/worktrees/meccha-chameleon-clone-51ef75';
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');
const [outFile] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
await context.addInitScript(() => {
  localStorage.setItem(
    'asobibako:yappari-chameleon:cpu',
    JSON.stringify({ side: 'hide', count: 2, mode: 'normal', strength: 'strong' })
  );
  localStorage.setItem(
    'asobibako:yappari-chameleon:settings',
    JSON.stringify({ mode: 'normal', hunters: 1, hide: 300, search: 300, reveal: 10, taunt: 0, overlook: true, v: 2 })
  );
});
const page = await context.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://localhost:5180/asobibako/games/yappari-chameleon', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.getByRole('button', { name: 'CPU と遊ぶ' }).click();
await page.getByRole('button', { name: 'ゲームを始める' }).click();
await page.waitForFunction(() => window.__session?.match.phase === 'hide', null, { timeout: 120000 });
await page.evaluate(() => window.__chameleon.placeAt([3.5, 0, 5.2], Math.PI / 2));
await page.waitForTimeout(1500);
const row = await page.evaluate(async () => {
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const s = window.__crew.senses;
  const eye = [0, 1, 0.6];
  const at = [3.5, 0.6, 5.2];
  const measure = async (on) => {
    const id = on ? setInterval(() => s.visible(1, 2, eye, at, 0.05), 125) : 0;
    await frame();
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) await frame();
    clearInterval(id);
    return (performance.now() - t0) / 120;
  };
  const off = await measure(false);
  const on = await measure(true);
  const t = performance.now();
  for (let i = 0; i < 20; i++) s.visible(1, 2, eye, at, 0.05);
  return { off, on, perCall: (performance.now() - t) / 20 };
});
await browser.close();
await writeFile(outFile, JSON.stringify(row, null, 2));
console.log(JSON.stringify(row));
```

Run: `node <scratchpad>/cpu/perf-cpu.mjs <scratchpad>/cpu/perf.json`
Expected: `on - off` が 4ms 以下、`perCall` が 6ms 以下（Mac の headless の数字。iPad Air では重くなるので、数字を報告に書いて、iPad で遊んだ感想と一緒に見る）。超えたら `cpu/senses3d.ts` の `SIZE` を 64 に下げ、合格の条件の数を回し直す。

- [ ] **Step 4: 今の 2 台・3 台の試合が今のまま通ることを確かめる**

Run: `node <scratchpad>/2b/task20/e2e-chameleon-2b.mjs <scratchpad>/cpu/2b`
Expected: 終わりに `page errors` を出さず、終了コード 0（`button.solo` と、入口とロビーの「なかまを呼ぶ」は今のまま）。

- [ ] **Step 5: 数字を直したらコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

数字を直したときだけ、次でコミットする（直さなかったらこのステップは飛ばす）。

```bash
git add src/lib/games/yappari-chameleon/cpu
git commit -m "Tune CPU strength numbers from headless matches"
```

---

### Task 15: CLAUDE.md と pnpm verify

**Files:**

- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: Task 1〜14 の名前。

- [ ] **Step 1: CLAUDE.md に CPU と遊ぶの段落を足す**

`CLAUDE.md` の「やっぱりカメレオン」の段落の終わり（「dev では `window.__chameleon` に…」の文）の前に、次の文を足す（今のコードの名前と合わないところがあれば、コードに合わせて直す）。

```markdown
入口の「CPU と遊ぶ」は、iPad 1 台で CPU 1〜2 人と 1 試合を遊ぶ（`CpuSetup.svelte` で役（隠れる・探す）・CPU の人数・ゲームモード（通常・増え鬼。隠れるでは見つかった時点で終わるので通常だけ、ダブルは選べない）・強さ（弱い・普通・強い）を選び、`prefs.ts` の `asobibako:yappari-chameleon:cpu` に覚える。好みなので記録ありには数えない）。CPU は手元でつないだ見えない子として親の端末の席 2・3 に座る（`cpu/pipe.ts` の 2 端の管を `Party.add` に渡し、`cpu/bot.ts` の `Bot` が `Party.guest` で子と同じ手順で入る。`hello` の `look` が `cpu` なので、札・順位表・見落とした敵では席 2 が「CPU 1」、席 3 が「CPU 2」になる。`Match.name`）。`Host`・`Session`・`Remote`・知らせの形は変えず、CPU の体も `Remote` で描く。`cpu/crew.ts` の `Crew` が CPU を座らせ、`Host.start` に決め打ちのハンター（隠れるなら CPU 全員、探すならプレイヤーだけ）を渡し、ロビーの台はハンター希望に使わない（`Host.podium`）。始めるとロビーに出ずに紹介へ進むが、試合は `Online` が 3D と `Session` を作り終えてから始める（`Crew.queue` と `Crew.go`。作るあいだに紹介の 3 秒が過ぎないように）。CPU は `Yappari.svelte` の審判のループ（`hosting`）で進み、送るのは `Bot.step` の中だけ（管は同じ呼び出しの中で知らせを渡すので、受けた中で送ると親の手続きに割り込む）。止まっていても 50ms ごとに体を送り、探す CPU は隠れタイムの始めに、隠れる CPU は塗りを送り終えてから、答え合わせは 5 秒たってから「もうええよ」を押す。答え合わせのあとはロビーへ戻り、上の帯の「マップの設定」の横に「CPU の設定」を出す（マップの設定から始めても役とモードは CPU の設定で決め、ゲームモードとハンターの人数の行は出さない）。CPU と遊ぶでは「なかまを呼ぶ」と「よびなおす」を出さない。頭脳（`cpu/` の `senses3d.ts` のほか）は DOM と three を使わない（`cpu/guard.test.ts`）。探す CPU（`cpu/hunter.ts` の `HunterBrain`）は入口から、手で置いた道順の網（`cpu/paths.ts`。動く物の置き場所の候補の全部に物を置いた屋敷で、全部の辺を `step` で歩けることをテストが見る）の上を `cpu/walker.ts` の `Walker` で歩いて部屋を回り（弱いはゆっくり同じ所も、普通は決まった順、強いは走ってまだ見ていない部屋から。2 人なら別々の部屋から）、部屋では左右と上下に首を振る（強いは、机や台の下をのぞける書斎・キッチン・ランドリーの見回しでだけしゃがむ。`cpu/paths.ts` の `ROOMS` の `low`）。0.25 秒ごとに、隠れている体が視野（見落としポイントと同じ `inView`）・届き 30m・遮り（`rayLevel`）を通るかを見て、通った体だけ `Senses.visible` に目立ちを聞き、目立ち・距離・動いたかで怪しさをためる。体の位置は最後に見えたときのものだけを使う（`ctx.bodies` は全員の本当の位置なので、見えないあいだに読むと透視になる）。怪しさが 1 を超えたら最後に見えた位置へ向いて近づき、強さの段のぶん迷ってから狙いをずらして撃ち（弱い 1.5 秒 3 度・普通 0.8 秒 1.5 度・強い 0.4 秒 0.5 度、撃つ間の 2 秒は自分で守る）、半端に怪しい体へはときどき試し撃ちする。撃つのは見えている体にだけで、見失ったら最後に見えた所まで行き、着いても見えなければそちらを向いて見回してから見回りに戻る。口笛を聞くと、遠いほど・強さが低いほど大きくずらした先へ向かい、埋まりの矢印が出た人の場所へ向かう。答え合わせでは撃たない。隠れる CPU（`cpu/hider.ts` の `HiderBrain`）は隠れタイムの始めに、部屋ごとの候補（`cpu/spots.ts`。本棚の前で立つ・天井で丸まる・壁の隅で寝そべるなど、候補ごとに何の前か横かをコメントに書く）から試合の種と CPU の何人めかで別々の部屋を選び、種から決めたずれを候補ごとの `slack`（0.25m まで）だけ足して、歩かずに置く（ずらしたどこでもどの種でも埋まらず動く物の候補にかからないことをテストが見る。弱いは床、普通は壁ぎわと家具の陰、強いは壁や天井の張り付きも）。部屋の戸口あたりの目の高さ（`viewOf`）から体の点を通した先の面の、光の前の色で自分を塗り、20 秒以内に塗り終える。増え鬼で見つかると、破片の間（`SHATTER_SECS`）のあと真下の床から探す CPU になる。強さの数字は `cpu/levels.ts` の `SKILLS`。頭脳が 3D に聞く口は `cpu/senses.ts` の `Senses` で、アプリでは `cpu/senses3d.ts` の `Senses3d` が親の端末の 3D で答える（目立ちは CPU の目から 96 × 96 の絵を体ありと体なしで描き、色の差が段の閾値を超える画素の割合。描くあいだは張り付きの輪と透かしを消し、影は描き直さない。面の色は `World.pickStage`、体の表面は `Session.rigOf` の体を `bakePose` で焼いた点。縦持ちで描くのを止めて 250ms たつと null を返し、隠れる CPU は待ち、探す CPU は動いた体にだけ気づく）。dev では `window.__crew` に `Crew` も出す。
```

あわせて、「最近開いたゲーム・タブ・ミュート・らくがきパレードの絵柄だけの状態は「記録あり」に数えない。」の文を「最近開いたゲーム・タブ・ミュート・らくがきパレードの絵柄・やっぱりカメレオンの CPU の設定だけの状態は「記録あり」に数えない。」にする。

- [ ] **Step 2: 全体を通す**

Run: `pnpm verify`
Expected: PASS（lint・check・test:run・vitals・build）。`pnpm vitals --diff` で警告が出たら、指された所を直してから回し直す。

- [ ] **Step 3: コミットする**

```bash
git add CLAUDE.md
git commit -m "Describe playing against CPU hunters and hiders in CLAUDE.md"
```
