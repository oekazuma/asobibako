# やっぱりカメレオン 2a（つないで遊ぶ試合） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1 段めの試作を、2〜3 人がそれぞれの iPad を QR でつなぎ、かくれんぼの試合（ロビー → 紹介 → 隠れタイム → 探索 → 答え合わせ → ロビー）を通しで遊べるようにする。「ひとりで試す」は今の試作のまま残す。

**Architecture:** ルールは DOM と three を使わない .ts に置いて vitest で確かめる（`referee.ts` は試合の進み、`shots.ts` は散弾の当たり、`net.ts` は知らせの形と吹き付けの数の列）。親の端末だけが `host.ts` の `Host` で審判を回し、全員の動きと塗りを中継して当たりを決める。各端末では `session.svelte.ts` の `Session` が、届いた様子（`match.svelte.ts` の `Match`）で自分の役（隠れる・ハンター・観戦）を切り替え、ほかの人の体（`remote.ts`）・弾の筋としぶきと破片（`effects.ts`）・一人称の手と銃（`hunter.ts`）を出す。ゲームの根 `Yappari.svelte` が入口・ひとりで試す・つないで遊ぶを切り替え、3D の土台（`stage3d.ts`）はひとりで試す画面と共用する。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、three 0.186、WebRTC の DataChannel（`src/lib/net/` の `Handshake.svelte` と `Party`）、Web Audio の `PannerNode`、vitest 4（`unit` は node、`dom` は happy-dom）、playwright-core（headless Chrome で撮る）。

**Spec:** `docs/superpowers/specs/2026-10-09-yappari-chameleon-stage2a-design.md`（全体の設計は `docs/superpowers/specs/2026-10-08-yappari-chameleon-design.md`、本家の仕様は `docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md`）

## Global Constraints

- id は `yappari-chameleon`、フォルダは `src/lib/games/yappari-chameleon/` のまま。three はこのゲームの `load()` から読み込まれる本体の中でだけ import する。
- `meta.ts` は `PartyMeta`（`players: 2`、`party: true`）。共通のシェルを通らないので、ゲームが自分の `<main class="stage wide">` を持ち、`.stage` を横向きで回さない。縦持ちのあいだは描画を止めて「横向きにしてください」を出す。
- 「ひとりで試す」は今の `Chameleon.svelte`（隠れタイム計測とフリーカメラつき）を開き、遊び方を変えない。
- マップの設定の既定と範囲は、ゲームモード 増え鬼（通常・増え鬼）、ハンターの人数 1（1〜人数−1）、ハンター待機時間 60 秒（30〜300）、探索時間 300 秒（60〜600）、答え合わせ時間 30 秒（10〜120）、強制挑発間隔 0（0 か 5〜120）。親の端末の `asobibako:yappari-chameleon:settings` に覚える。
- 紹介は 3 秒。撃つ間隔は 2.0 秒。散弾は十字の向きを中心に半角 2 度の 5 本（中心と上下左右に 2 度）。弾の筋は 0.3 秒、しぶきは 1 試合 60 枚まで（古いものから消す）、破片は 20 個で 1.5 秒。口笛は吹いたあと 1 秒は吹けず、♪ は吹いた人から水平に 2m 以内にずらして 2 秒浮かべる。
- 動き（`me`）は 1 秒に 20 回、吹き付け（`dabs`）は 0.05 秒ごとにまとめ、1 回の知らせは 32KB まで。相手の動きは送った時刻から 0.1 秒遅らせてつなぎ、親は撃った時刻から 0.1 秒前まで体をさかのぼって当たりを調べる。
- 一人称（ハンターとフリーカメラ）の three の `fov` は縦 72 度。控室は 4m 四方、白い壁と木の床、出口なし。
- 人の名前は席の番号で「プレイヤー1」〜「プレイヤー3」。勝者の言葉は「勝者カメレオン!」と「勝者ハンター!」。モードの説明は、通常が「鬼と人間に分かれて隠れる。」「1人でも最後まで隠れ切ると勝利」、増え鬼が「捕まると鬼になる。」「最後まで隠れ切ると勝利」。
- HUD と画面の字は白に黒い影の明朝（`font-family: 'Hiragino Mincho ProN', serif`）。大人向けの漢字まじりで、本家の言葉（挑発・ポーズ・ペイントモード・回転ロック・フリーカメラ・もうええよ・観戦中・探索開始まで・隠れつづけよう・探索時間・答え合わせ・残り人数・マップの設定・ゲームを始める・ハンター希望）を使う。
- `Party` が `hello` と `mismatch` を使うので、このゲームの版は子が `{ t: 'hi', v: CHAMELEON_VERSION }` で送り、親は `chameleon-mismatch` で知らせる。3 秒の締め切りは `Party` の `hello` が持つ。
- ゲームのフォルダの外のゲームを import しない。`Timeline` は `src/lib/net/timeline.ts` へ移して共用する。
- コンポーネントは 200 行未満。抑制コメントは使わない。
- 絵文字は使わない。アイコンは `src/lib/icons.ts` に SVG パスで足し、DOM では `Icon.svelte` で出す。
- コメントは非自明な WHY だけ（隠れた制約・workaround の理由・驚く挙動）を日本語で書く。WHAT・変更履歴・タスク番号は書かない。
- 指は `pointerdown` と `pointerId` で扱う。スティックの指を置いたまま押すボタンは `onpointerdown` で受ける（2 本めの指では iOS が click を出さないことがある）。
- コミットの前に `pnpm format` で整える。各タスクの終わりに `pnpm lint`・`pnpm check`・`pnpm test:run` が通る。最後のタスクで `pnpm verify` を通す。
- コミットのメッセージは英語で、`Co-Authored-By` などの署名の行は付けない。
- ブラウザは built-in browser（`mcp__Claude_Browser__*`）だけを使い、Claude in Chrome は使わない。dev サーバーは `pnpm dev --port 5180` で起動し、`preview_start` には頼らない。
- 見た目と通しの確かめは headless Chrome（`playwright-core`、`channel: 'chrome'`）で撮る。built-in browser は隠れると `requestAnimationFrame` が止まる。撮るスクリプトは scratchpad に置き、リポジトリには入れない。

## Review Focus

1. 試合の途中で子が切れる。隠れる人の体はその場に残って撃てば見つかり、ハンターは試合から抜け、ハンターが全員抜けたら隠れる人の勝ちで答え合わせへ入る。もうええよの分母から外れ、残りがそろっていればすぐ進む。Task 2 の「切れた人」と「切れた人はもうええよの数から外れ」、Task 6 の「切れた隠れる人の体はその場に残り」と「ハンターが全員切れると」で確かめる。
2. 同じフレームに 2 つの弾が届く（2 人のハンターが同じ人を撃つ、同じハンターが続けて撃つ）。見つかるのは 1 度だけで、増え鬼のハンターへの切り替えも 1 度だけ。2 秒より早い撃ちは捨てる。Task 2 の「撃つ間隔」と、Task 6 の「同じ時刻に 2 人のハンターが同じ人を撃っても」と「2 秒以内の次の弾は捨てる」で確かめる。
3. 親と子の時計がずれている。撃った時刻を親の時計に直してから体をさかのぼるので、撃ったあとに動いた体にも当たる。Task 1 の `offset()` のテストと、Task 6 の「時計のずれた子の弾も」で確かめる。
4. ペイントモードのあいだに見つかる。ペイントモードを抜け、描きかけの筆を残さず、通常では観戦、増え鬼では 1.5 秒後に白い体のハンターになる。Task 11 の「ペイントモードのあいだに見つかったら」と「増え鬼で見つかると」で確かめる。
5. 答え合わせのあいだに子が戻る・3D を作るあいだに親の知らせが届く。全員の体・塗り・見つかったときの体・今のフェーズが戻り、親に残っていた自分の体を上書きしない。Task 6 の「戻った子へ」、Task 11 の「3D を作るあいだに届いていた」と「答え合わせの最中に戻ると」、Task 18 の通しの確かめで確かめる。

---

## ファイルの地図

| ファイル                                                                                                                                                                  | 持つもの                                                                            | タスク |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| `src/lib/net/timeline.ts`                                                                                                                                                 | 送った時刻でつなぐ値の並び（`animal-survivors` から移す）・`offset()`・`last()`     | 1      |
| `src/lib/games/animal-survivors/coop.ts`                                                                                                                                  | `Timeline` の import 先                                                             | 1      |
| `yappari-chameleon/referee.ts`                                                                                                                                            | フェーズ・時計・役決め・発見・勝敗・もうええよ・強制挑発の時計（DOM と three なし） | 2      |
| `yappari-chameleon/shots.ts`                                                                                                                                              | 体の置き方・骨ごとのカプセル・散弾の 5 本の線・壁と家具との当たり（three なし）     | 3      |
| `yappari-chameleon/poses.ts`                                                                                                                                              | ハンターが銃を構えるポーズ `AIM`                                                    | 3      |
| `yappari-chameleon/net.ts`                                                                                                                                                | 知らせの版・`Me`・吹き付けの数の列・32KB に分ける・まだ送っていない分               | 4      |
| `yappari-chameleon/paint.ts`                                                                                                                                              | `PaintLog.low`（もどすで縮んだ長さ）                                                | 4      |
| `yappari-chameleon/mansion/layout.ts`・`build.ts`                                                                                                                         | 控室 `ROOM` と席ごとの始める場所 `SPAWNS`・白い壁の材質                             | 5      |
| `yappari-chameleon/host.ts`                                                                                                                                               | 親の審判（版・中継・塗りの控え・当たり・戻った人へ送る）                            | 6      |
| `yappari-chameleon/match.svelte.ts`                                                                                                                                       | 届いた試合の様子・モードと勝者の言葉・名前                                          | 7      |
| `yappari-chameleon/gun.ts`                                                                                                                                                | ペイント銃と絵筆の形・手に持たせる                                                  | 8      |
| `yappari-chameleon/glow.ts`                                                                                                                                               | 答え合わせの赤と青の光                                                              | 8      |
| `yappari-chameleon/remote.ts`                                                                                                                                             | ほかの人の体（人形・塗りの面・`Timeline`）                                          | 8      |
| `yappari-chameleon/world3d.ts`                                                                                                                                            | `placeRoot`・一人称の手と銃の場面 `overlay`・`screen()`                             | 8      |
| `yappari-chameleon/effects.ts`                                                                                                                                            | 弾の筋・しぶき・破片・♪                                                             | 9      |
| `yappari-chameleon/sounds.ts`                                                                                                                                             | 銃声・口笛（方向つき）・砕ける音・紹介とフェーズの音・見つけた音                    | 9      |
| `yappari-chameleon/hunter.ts`                                                                                                                                             | 一人称の手と銃・撃つと跳ねる                                                        | 10     |
| `yappari-chameleon/play.svelte.ts`                                                                                                                                        | `role`（hider・hunter・watch）・しゃがむ・観戦のカメラ                              | 10     |
| `yappari-chameleon/session.svelte.ts`                                                                                                                                     | 1 台ぶんの進め方（役の切り替え・送る・受ける・撃つ・観戦）                          | 11     |
| `yappari-chameleon/stage3d.ts`・`Chameleon.svelte`                                                                                                                        | 3D の土台（ひとりで試すと共用）                                                     | 12     |
| `Hud.svelte`・`Intro.svelte`・`Reveal.svelte`・`Ready.svelte`・`Plates.svelte`                                                                                            | HUD・紹介・勝者の言葉とペンキの飾り文字・もうええよ・名前の札                       | 13     |
| `HunterButtons.svelte`・`Spectate.svelte`・`TopButtons.svelte`・`Lobby.svelte`・`Settings.svelte`・`prefs.ts`・`Buttons.svelte`・`QuitConfirm.svelte`・`src/lib/icons.ts` | ハンターと観戦のボタン・挑発とハンター希望・ロビーとマップの設定                    | 14     |
| `Entry.svelte`・`Invite.svelte`・`Online.svelte`・`Overlay.svelte`・`Yappari.svelte`                                                                                      | 入口・よびなおす・つないで遊ぶ画面・ゲームの根                                      | 15     |
| `meta.ts`・`src/lib/games.ts`・`SoloShell.svelte`・`scripts/thumbs/scenes.ts`                                                                                             | PartyMeta に切り替え、使わなくなった `landscape` と `Howto.svelte` を外す           | 16     |
| `CLAUDE.md`                                                                                                                                                               | ゲームの説明                                                                        | 17     |
| scratchpad の `e2e-chameleon.mjs`                                                                                                                                         | 3 ページの通しの試合                                                                | 18     |

---

### Task 1: Timeline を共用の場所へ移し、時計の差と最後の値を出す

**Files:**

- Move: `src/lib/games/animal-survivors/timeline.ts` → `src/lib/net/timeline.ts`
- Move: `src/lib/games/animal-survivors/timeline.test.ts` → `src/lib/net/timeline.test.ts`
- Modify: `src/lib/games/animal-survivors/coop.ts:13`（import 先）

**Interfaces:**

- Produces: `Timeline<T>.offset(): number`（届いた時刻 − 送った時刻のいちばん小さい値。何も無ければ 0）、`Timeline<T>.last(): T | null`。`at()` の中身は `offset()` を使うだけで、動きは変えない。

- [ ] **Step 1: 移す**

```bash
git mv src/lib/games/animal-survivors/timeline.ts src/lib/net/timeline.ts
git mv src/lib/games/animal-survivors/timeline.test.ts src/lib/net/timeline.test.ts
```

`src/lib/games/animal-survivors/coop.ts` の `import { Timeline } from './timeline';` を `import { Timeline } from '$lib/net/timeline';` にする。

- [ ] **Step 2: 落ちるテストを足す**

`src/lib/net/timeline.test.ts` の `describe('Timeline', ...)` の最後に足す。

```diff
--- a/src/lib/net/timeline.test.ts
+++ b/src/lib/net/timeline.test.ts
@@ -24,4 +24,15 @@
     line.push(50, 1050, 8);
     expect(line.at(5000, 100)).toEqual({ a: 8, b: 8, t: 0 });
   });
+
+  it('送った側の時刻を受けた側の時刻に直す差（いちばん小さい、届いた時刻 - 送った時刻）と、いちばん新しい値を出す', () => {
+    const line = new Timeline<number>();
+    expect(line.offset()).toBe(0);
+    expect(line.last()).toBeNull();
+    // 送った側の時計は 1000 秒進んでいて、届くまで 50ms と 30ms かかった
+    line.push(1_000_000, 50, 1);
+    line.push(1_000_050, 80, 2);
+    expect(line.offset()).toBe(80 - 1_000_050);
+    expect(line.last()).toBe(2);
+  });
 });
```

- [ ] **Step 3: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/net/timeline.test.ts`
Expected: 足したテストが FAIL（`line.offset is not a function`）。

- [ ] **Step 4: `offset()` と `last()` を足す**

```diff
--- a/src/lib/net/timeline.ts
+++ b/src/lib/net/timeline.ts
@@ -11,11 +11,16 @@
     if (this.#gaps.length > 40) this.#gaps.shift();
   }

+  /** 送った側の時刻を、受けた側の時刻に直す差（届くまでの間と 2 台の時計のずれの和）。まだ何も無ければ 0 */
+  offset(): number {
+    return this.#gaps.length ? Math.min(...this.#gaps) : 0;
+  }
+
   /** local の時刻から delay ミリ秒遅らせた時刻の、前後の値と寄せる割合 */
   at(local: number, delay: number): { a: T; b: T; t: number } | null {
     const list = this.#items;
     if (!list.length) return null;
-    const want = local - Math.min(...this.#gaps) - delay;
+    const want = local - this.offset() - delay;
     let k = list.length - 1;
     while (k > 0 && list[k].src > want) k--;
     const a = list[k];
@@ -24,6 +29,11 @@
     return { a: a.v, b: b.v, t: Math.min(1, (want - a.src) / (b.src - a.src)) };
   }

+  /** いちばん新しい値 */
+  last(): T | null {
+    return this.#items.at(-1)?.v ?? null;
+  }
+
   clear(): void {
     this.#items = [];
     this.#gaps = [];
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/net/timeline.test.ts src/lib/games/animal-survivors`
Expected: PASS（アニマルサバイバーの協力プレイのテストも移した `Timeline` で通る）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add -A src/lib/net src/lib/games/animal-survivors
git commit -m "Move Timeline to the shared net folder and expose its clock offset and last value"
```

---

### Task 2: 試合のルール

**Files:**

- Create: `src/lib/games/yappari-chameleon/referee.ts`
- Test: `src/lib/games/yappari-chameleon/referee.test.ts`

**Interfaces:**

- Consumes: `Seat`（`$lib/net/party.svelte`）。
- Produces: `type Phase = 'lobby' | 'intro' | 'hide' | 'search' | 'reveal'`、`type GameMode = 'normal' | 'infect'`、`type Role = 'hider' | 'hunter' | 'out'`、`type Winner = 'chameleon' | 'hunter'`、`interface Settings { mode; hunters; hide; search; reveal; taunt }`、`DEFAULTS`、`LIMITS`、`INTRO = 3`、`COOLDOWN = 2`、`TOOT_GAP = 1`、`fit(s, players)`、`interface Match`、`newMatch()`、`pickHunters(wishes, members, n, rand)`、`seatsOf(m, role)`、`hiding(m)`、`start(m, members, settings, rand)`、`tick(m, dt): Seat[]`（強制挑発で吹く人）、`ready(m, seat, present)`、`wish(m, seat, on)`、`leave(m, seat, present)`、`join(m, seat)`、`shoot(m, seat): boolean`、`hit(m, seat): boolean`、`toot(m, seat): boolean`、`interface View` と `view(m): View`。時刻は `tick` の `dt`（秒）だけで進め、`Match.clock` で撃つ間隔と口笛の間隔を測る。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/referee.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import {
  DEFAULTS,
  fit,
  hiding,
  hit,
  join,
  leave,
  newMatch,
  pickHunters,
  ready,
  shoot,
  start,
  tick,
  toot,
  view,
  wish,
  type Match,
  type Settings
} from './referee';

const ALL: Seat[] = [1, 2, 3];
/** 乱数は 0 に寄せる（並べ替えで最後の人が先頭に来る） */
const zero = () => 0;

function begun(settings: Partial<Settings> = {}, wishes: Seat[] = [3]): Match {
  const m = newMatch();
  for (const s of wishes) wish(m, s, true);
  start(m, ALL, { ...DEFAULTS, ...settings }, zero);
  return m;
}

/** dt を小さく刻んで secs 秒進め、吹いた人を集める */
function run(m: Match, secs: number): Seat[] {
  const toots: Seat[] = [];
  for (let t = 0; t < secs - 1e-9; t += 0.1) toots.push(...tick(m, 0.1));
  return toots;
}

describe('fit', () => {
  it('範囲の外の値を収め、ハンターは人数−1 まで、強制挑発は 0 か 5〜120', () => {
    const s = fit({ mode: 'normal', hunters: 5, hide: 10, search: 9999, reveal: 30, taunt: 3 }, 3);
    expect(s).toEqual({ mode: 'normal', hunters: 2, hide: 30, search: 600, reveal: 30, taunt: 5 });
    expect(fit({ ...DEFAULTS, hunters: 2, taunt: 0 }, 2)).toMatchObject({ hunters: 1, taunt: 0 });
  });
});

describe('pickHunters', () => {
  it('希望した人から選び、足りなければ残りから足す', () => {
    expect(pickHunters([3], ALL, 1, Math.random)).toEqual([3]);
    const two = pickHunters([2], ALL, 2, Math.random);
    expect(two).toContain(2);
    expect(two).toHaveLength(2);
    expect(pickHunters([], ALL, 1, zero)).toHaveLength(1);
  });
});

describe('フェーズの流れ', () => {
  it('紹介 3 秒 → 隠れタイム → 探索 → 答え合わせ → ロビーと時計どおりに進む', () => {
    const m = begun({ hide: 30, search: 60, reveal: 10 });
    expect(m.phase).toBe('intro');
    expect(m.roles).toEqual({ 1: 'hider', 2: 'hider', 3: 'hunter' });
    run(m, 3);
    expect(m.phase).toBe('hide');
    expect(m.left).toBe(30);
    run(m, 30);
    expect(m.phase).toBe('search');
    run(m, 60);
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('chameleon');
    run(m, 10);
    expect(m.phase).toBe('lobby');
    expect(m.roles).toEqual({});
  });

  it('もうええよは、いる人の全員がそろうと隠れタイムと答え合わせを飛ばす。探索中は数えない', () => {
    const m = begun();
    run(m, 3);
    ready(m, 1, ALL);
    ready(m, 2, ALL);
    ready(m, 2, ALL);
    expect(m.ready).toEqual([1, 2]);
    expect(m.phase).toBe('hide');
    ready(m, 3, ALL);
    expect(m.phase).toBe('search');
    expect(m.ready).toEqual([]);
    ready(m, 1, ALL);
    expect(m.ready).toEqual([]);
  });

  it('切れた人はもうええよの数から外れ、残りがそろっていればすぐ飛ぶ', () => {
    const m = begun();
    run(m, 3);
    ready(m, 1, ALL);
    ready(m, 3, ALL);
    leave(m, 2, [1, 3]);
    expect(m.phase).toBe('search');
  });
});

describe('発見と勝ち負け', () => {
  it('通常では全員見つかればハンターの勝ちで、見つかった人は観戦（隠れる人のまま）', () => {
    const m = begun({ mode: 'normal' });
    run(m, 3 + 60);
    expect(hit(m, 1)).toBe(true);
    expect(hit(m, 1)).toBe(false);
    expect(m.roles[1]).toBe('hider');
    expect(m.phase).toBe('search');
    hit(m, 2);
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('hunter');
  });

  it('通常では 1 人でも残って時間切れならカメレオンの勝ち', () => {
    const m = begun({ mode: 'normal', search: 60 });
    run(m, 3 + 60);
    hit(m, 1);
    run(m, 60);
    expect(m.winner).toBe('chameleon');
  });

  it('増え鬼では見つかった人がその場でハンターになり、全員見つかれば最初のハンターの勝ち', () => {
    const m = begun({ mode: 'infect' });
    run(m, 3 + 60);
    hit(m, 2);
    expect(m.roles[2]).toBe('hunter');
    expect(m.first).toEqual([3]);
    hit(m, 1);
    expect(m.winner).toBe('hunter');
  });

  it('探索中でなければ発見にならない（答え合わせで撃ってもしぶきだけ）', () => {
    const m = begun();
    run(m, 3);
    expect(hit(m, 1)).toBe(false);
  });
});

describe('切れた人', () => {
  it('ハンターが全員抜けると、隠れタイムでも隠れる人の勝ちで答え合わせへ', () => {
    const m = begun();
    run(m, 4);
    leave(m, 3, [1, 2]);
    expect(m.roles[3]).toBe('out');
    expect(m.phase).toBe('reveal');
    expect(m.winner).toBe('chameleon');
  });

  it('切れた隠れる人は役を残し（体は撃てば見つかる）、戻っても隠れる人のまま。途中で来た人は観戦', () => {
    const m = begun({ mode: 'normal' });
    run(m, 3 + 60);
    leave(m, 2, [1, 3]);
    expect(m.roles[2]).toBe('hider');
    expect(hit(m, 2)).toBe(true);
    join(m, 2);
    expect(m.roles[2]).toBe('hider');
    const n = begun({}, [3]);
    delete n.roles[2];
    join(n, 2);
    expect(n.roles[2]).toBe('out');
  });
});

describe('撃つ間隔', () => {
  it('2.0 秒より早い撃ちと、ハンターでない人の撃ちを捨てる', () => {
    const m = begun();
    run(m, 3 + 60);
    expect(shoot(m, 1)).toBe(false);
    expect(shoot(m, 3)).toBe(true);
    run(m, 1.9);
    expect(shoot(m, 3)).toBe(false);
    run(m, 0.1);
    expect(shoot(m, 3)).toBe(true);
  });

  it('同じ時刻に 2 人のハンターが撃っても、それぞれの間隔で数える', () => {
    const m = begun({ hunters: 2 }, [2, 3]);
    run(m, 3 + 60);
    expect([shoot(m, 2), shoot(m, 3)]).toEqual([true, true]);
  });
});

describe('口笛と強制挑発', () => {
  it('強制挑発は間隔ごとに見つかっていない隠れる人の全員が吹き、自分で吹くとその人の時計が巻き戻る', () => {
    const m = begun({ taunt: 10 });
    run(m, 3 + 60);
    expect(run(m, 7)).toEqual([]);
    expect(toot(m, 1)).toBe(true);
    expect(run(m, 3).sort()).toEqual([2]);
    expect(run(m, 7).sort()).toEqual([1]);
    hit(m, 2);
    expect(view(m).taunts[2]).toBeUndefined();
    expect(run(m, 10)).toEqual([1]);
  });

  it('隠れタイムと答え合わせでは強制挑発の時計が進まない', () => {
    const m = begun({ taunt: 5 });
    expect(run(m, 3 + 60)).toEqual([]);
    expect(view(m).taunts).toEqual({ 1: 5, 2: 5 });
  });

  it('口笛は 1 秒あけて吹け、ハンターと見つかった人は吹けない。ロビーでは全員が吹ける', () => {
    const lobby = newMatch();
    expect(toot(lobby, 3)).toBe(true);
    const m = begun();
    run(m, 3);
    expect(toot(m, 1)).toBe(true);
    expect(toot(m, 1)).toBe(false);
    run(m, 1);
    expect(toot(m, 1)).toBe(true);
    expect(toot(m, 3)).toBe(false);
  });

  it('隠れている人の数は見つかった人を除く', () => {
    const m = begun();
    run(m, 63);
    hit(m, 1);
    expect(hiding(m)).toEqual([2]);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/referee.test.ts`
Expected: FAIL（`./referee` が無い）。

- [ ] **Step 3: ルールを書く**

`src/lib/games/yappari-chameleon/referee.ts`:

```ts
import type { Seat } from '$lib/net/party.svelte';

export type Phase = 'lobby' | 'intro' | 'hide' | 'search' | 'reveal';
/** 通常（normal）と増え鬼（infect） */
export type GameMode = 'normal' | 'infect';
/** out は試合から抜けたハンターと、試合の途中で来た人（観戦する） */
export type Role = 'hider' | 'hunter' | 'out';
export type Winner = 'chameleon' | 'hunter';

export interface Settings {
  mode: GameMode;
  hunters: number;
  /** ハンター待機時間（隠れる時間）・探索時間・答え合わせ時間・強制挑発間隔（0 はなし）。秒 */
  hide: number;
  search: number;
  reveal: number;
  taunt: number;
}

export const DEFAULTS: Settings = { mode: 'infect', hunters: 1, hide: 60, search: 300, reveal: 30, taunt: 0 };
export const LIMITS = { hide: [30, 300], search: [60, 600], reveal: [10, 120], taunt: [5, 120] } as const;
export const INTRO = 3;
/** 撃ったあと次を撃てるまで */
export const COOLDOWN = 2;
/** 口笛を吹いたあと次を吹けるまで */
export const TOOT_GAP = 1;

/** 小さな dt を足し重ねたずれで、0 になるはずの時計が 0 の手前に残らないようにする */
const EPS = 1e-6;

const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, Math.round(v)));

/** 人数と範囲に収める。2 人ならハンターは 1 人 */
export function fit(s: Settings, players: number): Settings {
  return {
    mode: s.mode === 'normal' ? 'normal' : 'infect',
    hunters: clamp(s.hunters, [1, Math.max(1, players - 1)]),
    hide: clamp(s.hide, LIMITS.hide),
    search: clamp(s.search, LIMITS.search),
    reveal: clamp(s.reveal, LIMITS.reveal),
    taunt: s.taunt <= 0 ? 0 : clamp(s.taunt, LIMITS.taunt)
  };
}

export interface Match {
  phase: Phase;
  /** 今のフェーズの残り秒 */
  left: number;
  settings: Settings;
  roles: Partial<Record<Seat, Role>>;
  /** 最初のハンター（増え鬼で全員見つかったときの勝者） */
  first: Seat[];
  found: Seat[];
  winner: Winner | null;
  /** もうええよを押した人 */
  ready: Seat[];
  /** ハンター希望 */
  wishes: Seat[];
  /** 次の強制挑発までの秒（隠れる人ごと、探索のあいだだけ減る） */
  taunts: Partial<Record<Seat, number>>;
  /** 審判の時計（秒）。撃つ間隔と口笛の間隔を測る */
  clock: number;
  shots: Partial<Record<Seat, number>>;
  toots: Partial<Record<Seat, number>>;
}

export const newMatch = (): Match => ({
  phase: 'lobby',
  left: 0,
  settings: DEFAULTS,
  roles: {},
  first: [],
  found: [],
  winner: null,
  ready: [],
  wishes: [],
  taunts: {},
  clock: 0,
  shots: {},
  toots: {}
});

function shuffle<T>(list: T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 希望した人から乱数で n 人を選び、足りなければ残りから乱数で足す */
export function pickHunters(wishes: Seat[], members: Seat[], n: number, rand: () => number): Seat[] {
  const keen = shuffle(
    members.filter((s) => wishes.includes(s)),
    rand
  );
  const rest = shuffle(
    members.filter((s) => !wishes.includes(s)),
    rand
  );
  return [...keen, ...rest].slice(0, n).sort((a, b) => a - b);
}

export const seatsOf = (m: Match, role: Role): Seat[] =>
  (Object.keys(m.roles).map(Number) as Seat[]).filter((s) => m.roles[s] === role);

/** まだ見つかっていない隠れる人 */
export const hiding = (m: Match): Seat[] => seatsOf(m, 'hider').filter((s) => !m.found.includes(s));

export function start(m: Match, members: Seat[], settings: Settings, rand: () => number): void {
  const s = fit(settings, members.length);
  const hunters = pickHunters(m.wishes, members, s.hunters, rand);
  Object.assign(m, {
    phase: 'intro',
    left: INTRO,
    settings: s,
    roles: Object.fromEntries(members.map((seat) => [seat, hunters.includes(seat) ? 'hunter' : 'hider'])),
    first: hunters,
    found: [],
    winner: null,
    ready: [],
    taunts: {},
    shots: {},
    toots: {}
  } satisfies Partial<Match>);
}

function enter(m: Match, phase: Phase): void {
  m.phase = phase;
  m.ready = [];
  if (phase === 'hide') m.left = m.settings.hide;
  else if (phase === 'search') {
    m.left = m.settings.search;
    if (m.settings.taunt) m.taunts = Object.fromEntries(hiding(m).map((s) => [s, m.settings.taunt]));
  } else if (phase === 'reveal') {
    m.left = m.settings.reveal;
    m.taunts = {};
    m.winner ??= hiding(m).length ? 'chameleon' : 'hunter';
  } else if (phase === 'lobby') {
    Object.assign(m, { left: 0, roles: {}, first: [], found: [], winner: null, taunts: {} } satisfies Partial<Match>);
  }
}

const NEXT: Record<Phase, Phase> = { lobby: 'lobby', intro: 'hide', hide: 'search', search: 'reveal', reveal: 'lobby' };

/** 時計を進める。探索のあいだ、強制挑発の時計が 0 になった隠れる人を返す（その人が吹く） */
export function tick(m: Match, dt: number): Seat[] {
  m.clock += dt;
  if (m.phase === 'lobby') return [];
  const toots: Seat[] = [];
  if (m.phase === 'search' && m.settings.taunt)
    for (const seat of hiding(m)) {
      const left = (m.taunts[seat] ?? m.settings.taunt) - dt;
      m.taunts[seat] = left;
      if (left > EPS) continue;
      m.taunts[seat] = left + m.settings.taunt;
      m.toots[seat] = m.clock;
      toots.push(seat);
    }
  m.left = m.left - dt > EPS ? m.left - dt : 0;
  if (m.left === 0) enter(m, NEXT[m.phase]);
  return toots;
}

/** もうええよ。いる人の全員が押したら、隠れタイムか答え合わせをすぐ終える */
export function ready(m: Match, seat: Seat, present: Seat[]): void {
  if (m.phase !== 'hide' && m.phase !== 'reveal') return;
  if (!m.ready.includes(seat)) m.ready = [...m.ready, seat];
  settle(m, present);
}

function settle(m: Match, present: Seat[]): void {
  if ((m.phase === 'hide' || m.phase === 'reveal') && present.every((s) => m.ready.includes(s)))
    enter(m, NEXT[m.phase]);
}

export function wish(m: Match, seat: Seat, on: boolean): void {
  m.wishes = on ? [...new Set([...m.wishes, seat])] : m.wishes.filter((s) => s !== seat);
}

/** 切れた。ハンターは試合から抜け、ハンターが全員抜けたら隠れる人の勝ちで答え合わせへ。隠れる人の体はその場に残る */
export function leave(m: Match, seat: Seat, present: Seat[]): void {
  m.wishes = m.wishes.filter((s) => s !== seat);
  m.ready = m.ready.filter((s) => s !== seat);
  if (m.phase === 'lobby') return;
  if (m.roles[seat] === 'hunter') m.roles[seat] = 'out';
  const live = ['intro', 'hide', 'search'].includes(m.phase);
  if (live && !seatsOf(m, 'hunter').some((s) => present.includes(s))) {
    m.winner = 'chameleon';
    enter(m, 'reveal');
    return;
  }
  settle(m, present);
}

/** 戻った・途中で来た。役を持っていた隠れる人はそのまま、持っていない人は観戦 */
export function join(m: Match, seat: Seat): void {
  if (m.phase !== 'lobby' && !m.roles[seat]) m.roles[seat] = 'out';
}

/** 撃てるか（撃てるなら撃った時刻を覚える）。2 秒より早い撃ちと、ハンターでない人の撃ちは捨てる */
export function shoot(m: Match, seat: Seat): boolean {
  if (m.roles[seat] !== 'hunter' || (m.phase !== 'search' && m.phase !== 'reveal')) return false;
  if (m.clock - (m.shots[seat] ?? -Infinity) < COOLDOWN - EPS) return false;
  m.shots[seat] = m.clock;
  return true;
}

/** 発見。見つけたら true。増え鬼ではその場でハンターになり、隠れる人が残らなければ答え合わせへ */
export function hit(m: Match, seat: Seat): boolean {
  if (m.phase !== 'search' || m.roles[seat] !== 'hider' || m.found.includes(seat)) return false;
  m.found = [...m.found, seat];
  if (m.settings.mode === 'infect') m.roles[seat] = 'hunter';
  // 見つかった人は挑発できない
  delete m.taunts[seat];
  if (!hiding(m).length) enter(m, 'reveal');
  return true;
}

/** 口笛。ロビーでは全員、試合中は見つかっていない隠れる人だけが、1 秒あけて吹ける。自分で吹くと強制挑発の時計が巻き戻る */
export function toot(m: Match, seat: Seat): boolean {
  const may = m.phase === 'lobby' || (m.roles[seat] === 'hider' && !m.found.includes(seat));
  if (!may || m.clock - (m.toots[seat] ?? -Infinity) < TOOT_GAP - EPS) return false;
  m.toots[seat] = m.clock;
  if (m.phase === 'search' && m.settings.taunt) m.taunts[seat] = m.settings.taunt;
  return true;
}

/** 全員の画面へ配る形 */
export interface View {
  phase: Phase;
  left: number;
  settings: Settings;
  roles: Partial<Record<Seat, Role>>;
  first: Seat[];
  found: Seat[];
  winner: Winner | null;
  ready: Seat[];
  wishes: Seat[];
  /** 次の強制挑発までの秒（切り上げ） */
  taunts: Partial<Record<Seat, number>>;
}

export function view(m: Match): View {
  const { phase, settings, roles, first, found, winner, ready, wishes } = m;
  const taunts = Object.fromEntries(Object.entries(m.taunts).map(([s, v]) => [s, Math.ceil(v ?? 0)]));
  return { phase, left: m.left, settings, roles, first, found, winner, ready, wishes, taunts };
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/referee.test.ts`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/referee.ts src/lib/games/yappari-chameleon/referee.test.ts
git commit -m "Add the match rules: phases, hunter picks, finds, winners, skip votes and forced taunts"
```

---

### Task 3: 散弾の当たりと体の置き方

**Files:**

- Create: `src/lib/games/yappari-chameleon/shots.ts`
- Modify: `src/lib/games/yappari-chameleon/poses.ts`（`AIM` と、`poseById` が `AIM` も引けるように）
- Test: `src/lib/games/yappari-chameleon/shots.test.ts`

**Interfaces:**

- Consumes: `BONES`・`JOINTS`・`PARENT`・`dollShapes()`（`doll.ts`）、`RADIUS`・`Cling`・`Level`（`move.ts`）、`Pose`（`poses.ts`）。
- Produces: `SPREAD`（2 度）、`RANGE = 60`、`HALF_DEPTH = 0.12`、`interface Placeable { pos: V3; yaw: number; cling: Cling | null }`（`Body` も `Me` も渡せる）、`interface Placement { at; yaw; tilt }`、`placement(b)`、`frames(pose, place): Record<Bone, { p: V3; r: M3 }>`、`interface Capsule { a; b; r }`、`capsules(pose, place)`、`rayCapsule(o, d, c)`、`rayLevel(lv, o, d, max): { t; n } | null`（`lv.boxes` を見る。カメラの殻 `shell` は見ない）、`rays(d): V3[]`（5 本）、`interface Target { seat; caps }`、`interface Ray { end; seat; n }`、`fire(lv, o, d, targets): Ray[]`。`poses.ts` は `AIM: Pose`（id `'aim'`）を足し、`poseById('aim')` が `AIM` を返す。

親は three を持たないので、`PoseAnimator`（骨の角度は x → y → z の Euler、腰は `drop` だけ下げる）と `placeDoll`（根元は y → x の順に回し、壁では `RADIUS − HALF_DEPTH` だけ壁へ寄せ、天井では寝かせて `HALF_DEPTH` 下げる）と同じ鎖を `frames()` がたどる。テストで three の骨と同じ所に来ることを全部のポーズと張り付きで確かめる。親はポーズの切り替えの途中ではなく、送られてきたポーズ（目標の形）で当たりを見る。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/shots.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { V3 } from '$lib/sculpt';
import { layAtlas } from './atlas';
import { BONES, buildDoll } from './doll';
import { makeDoll, PoseAnimator } from './doll3d';
import { levelOf, mansion } from './mansion/layout';
import { newBody, type Body, type Level } from './move';
import { AIM, POSES, poseById, STAND } from './poses';
import { capsules, fire, frames, placement, rayCapsule, rayLevel, rays, SPREAD, type Target } from './shots';

const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;
const surface = buildDoll(0.02);
const atlas = layAtlas(surface.pos, surface.idx, 2048);

/** 床（y = 0）と、z = 2〜2.3 の壁だけの部屋 */
const room: Level = {
  boxes: [
    { min: [-10, -1, -10], max: [10, 0, 10] },
    { min: [-10, 0, 2], max: [10, 3, 2.3] }
  ],
  ramps: [],
  spawn: [0, 0, 0]
};

const body = (pos: V3, extra: Partial<Body> = {}): Body => ({ ...newBody(pos), ...extra });
const target = (seat: number, b: Body, pose = STAND): Target => ({ seat, caps: capsules(pose, placement(b)) });
const toward = (o: V3, p: V3): V3 => {
  const v: V3 = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const hitSeats = (lv: Level, o: V3, at: V3, t: Target[]) =>
  fire(lv, o, toward(o, at), t)
    .map((r) => r.seat)
    .filter((s) => s !== null);

describe('frames', () => {
  it('骨の置き方は、three の骨（PoseAnimator と placeDoll）と同じ所に来る', () => {
    const rig = makeDoll(renderer, surface, atlas);
    const poses = new PoseAnimator(rig);
    const places = [
      body([1, 0, 2], { yaw: 0.7 }),
      body([0, 1.5, 4.8], { yaw: Math.PI, cling: { kind: 'wall', nx: 0, nz: -1 } }),
      body([2, 3, 1], { yaw: -1.2, cling: { kind: 'ceiling' } })
    ];
    for (const pose of [STAND, AIM, ...POSES])
      for (const b of places) {
        poses.snap(pose);
        const p = placement(b);
        rig.root.rotation.order = 'YXZ';
        rig.root.rotation.set(p.tilt, p.yaw, 0);
        rig.root.position.set(...p.at);
        rig.root.updateMatrixWorld(true);
        const f = frames(pose, p);
        for (const bone of BONES) {
          const want = rig.bones[bone].getWorldPosition(new THREE.Vector3());
          expect(f[bone].p[0], `${pose.id} ${bone}`).toBeCloseTo(want.x, 5);
          expect(f[bone].p[1], `${pose.id} ${bone}`).toBeCloseTo(want.y, 5);
          expect(f[bone].p[2], `${pose.id} ${bone}`).toBeCloseTo(want.z, 5);
        }
      }
  });
});

describe('rayCapsule', () => {
  it('筒の横・端の丸み・球に当たり、外れた線と後ろの体には当たらない', () => {
    const cap = { a: [0, 0, 0] as V3, b: [0, 1, 0] as V3, r: 0.1 };
    expect(rayCapsule([-1, 0.5, 0], [1, 0, 0], cap)).toBeCloseTo(0.9);
    expect(rayCapsule([0, 2, 0], [0, -1, 0], cap)).toBeCloseTo(0.9);
    expect(rayCapsule([-1, 0.5, 0.2], [1, 0, 0], cap)).toBeNull();
    expect(rayCapsule([1, 0.5, 0], [1, 0, 0], cap)).toBeNull();
    expect(rayCapsule([0, 0, -1], [0, 0, 1], { a: [0, 0, 0], b: [0, 0, 0], r: 0.1 })).toBeCloseTo(0.9);
  });
});

describe('rayLevel', () => {
  it('入った面の向きを返し、立っている床（始点を含む箱）は数えない', () => {
    expect(rayLevel(room, [0, 1, 0], [0, 0, 1], 60)).toEqual({ t: 2, n: [0, 0, -1] });
    expect(rayLevel(room, [0, 1, 0], [0, -1, 0], 60)).toEqual({ t: 1, n: [0, 1, 0] });
    expect(rayLevel({ ...room, boxes: [{ min: [-1, -1, -1], max: [1, 1, 1] }] }, [0, 0, 0], [0, 0, 1], 60)).toBeNull();
  });
});

describe('fire', () => {
  it('5 本は十字の向きと、上下左右へ 2 度ずつ開いた線', () => {
    const d = rays([0, 0, 1]);
    expect(d).toHaveLength(5);
    for (const v of d.slice(1)) expect(Math.acos(v[2])).toBeCloseTo(SPREAD, 6);
  });

  it('立った体の胸を撃てば当たり、頭の上を撃てば外れる', () => {
    const t = [target(2, body([0, 0, 0]))];
    expect(hitSeats(room, [0, 1, -5], [0, 0.7, 0], t)).toContain(2);
    expect(hitSeats(room, [0, 1, -5], [0, 1.45, 0], t)).toEqual([]);
  });

  it('5 本のうち 1 本でも当たれば当たる（中心の線は外れ、横の線だけが入る）', () => {
    // 5m 先で 2 度の開きは 0.17m。中心の線は細い柱の 0.2m 横を抜け、左へ開いた線が柱に入る
    const pole: Target = { seat: 2, caps: [{ a: [0, 0, 0], b: [0, 2, 0], r: 0.1 }] };
    const rs = fire(room, [0.2, 1, -5], [0, 0, 1], [pole]);
    expect(rs[0].seat).toBeNull();
    expect(rs.filter((r) => r.seat === 2)).toHaveLength(1);
  });

  it('壁の向こうの体には当たらず、壁にしぶきの向きを返す', () => {
    const t = [target(2, body([0, 0, 4]))];
    const rs = fire(room, [0, 1, 0], toward([0, 1, 0], [0, 0.7, 4]), t);
    expect(rs.every((r) => r.seat === null)).toBe(true);
    expect(rs[0].n).toEqual([0, 0, -1]);
    expect(rs[0].end[2]).toBeCloseTo(2);
  });

  it('家具（ピアノ）の陰の体には当たらない。カメラの殻にない家具も弾は止める', () => {
    const lv = levelOf(mansion());
    const t = [target(2, body([4, 0, 4.4]), poseById('curl'))];
    expect(hitSeats(lv, [4, 1, 0.6], [4, 0.3, 4.4], t)).toEqual([]);
    // 同じ体を、ピアノの上から見下ろせば当たる
    expect(hitSeats(lv, [4, 2.6, 6.5], [4, 0.3, 4.4], t)).toContain(2);
  });

  it('寝そべった体は低い所で当たり、立ったときの頭の高さには何も無い', () => {
    const lie = poseById('lie');
    const b = body([0, 0, 0]);
    const t = [target(2, b, lie)];
    const mid = frames(lie, placement(b)).spine.p;
    expect(mid[1]).toBeLessThan(0.3);
    expect(hitSeats(room, [0, 2.5, mid[2]], [mid[0], 0, mid[2]], t)).toContain(2);
    expect(hitSeats(room, [0, 1.05, -5], [0, 1.05, 0], t)).toEqual([]);
  });

  it('壁や天井に張り付いた体にも当たる', () => {
    const wall = body([0, 1.2, 1.8 - 0.2], { yaw: Math.PI, cling: { kind: 'wall', nx: 0, nz: -1 } });
    const chest = frames(STAND, placement(wall)).chest.p;
    expect(hitSeats(room, [0, 1.5, -3], chest, [target(2, wall)])).toContain(2);
    const ceiling = body([0, 3, 0], { cling: { kind: 'ceiling' } });
    const c = frames(STAND, placement(ceiling)).chest.p;
    expect(c[1]).toBeGreaterThan(2.6);
    expect(hitSeats(room, [0, 0.5, -3], c, [target(3, ceiling)])).toContain(3);
  });

  it('手前の人に当たった線は、後ろの人に届かない', () => {
    const t = [target(2, body([0, 0, 0])), target(3, body([0, 0, 1]))];
    const rs = fire(room, [0, 0.7, -3], [0, 0, 1], t);
    expect(rs[0].seat).toBe(2);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/shots.test.ts`
Expected: FAIL（`./shots` が無く、`poses.ts` に `AIM` が無い）。

- [ ] **Step 3: `AIM` を足す**

```diff
--- a/src/lib/games/yappari-chameleon/poses.ts
+++ b/src/lib/games/yappari-chameleon/poses.ts
@@ -153,4 +153,18 @@
   }
 ];

-export const poseById = (id: string): Pose => POSES.find((p) => p.id === id) ?? STAND;
+/** ハンターが銃を両手で前に構える形。輪には出さず、ほかの人から見えるハンターの体に使う */
+export const AIM: Pose = {
+  id: 'aim',
+  label: '構える',
+  bones: {
+    'upperarm.l': [-1.35, 0, -0.55],
+    'upperarm.r': [-1.45, 0, 0.75],
+    'forearm.l': [0, 0.5, -0.15],
+    'forearm.r': [0, 0, 0.15]
+  }
+};
+
+const ALL = [AIM, ...POSES];
+
+export const poseById = (id: string): Pose => ALL.find((p) => p.id === id) ?? STAND;
```

- [ ] **Step 4: 当たりを書く**

`src/lib/games/yappari-chameleon/shots.ts`:

```ts
import type { V3 } from '$lib/sculpt';
import { BONES, dollShapes, JOINTS, PARENT, type Bone } from './doll';
import { RADIUS, type Cling, type Level } from './move';
import type { Pose } from './poses';

/** 散弾の 5 本の線の、中心からの開き（半角 2 度） */
export const SPREAD = (2 * Math.PI) / 180;
/** 弾が届く長さ。屋敷の端から端より長い */
export const RANGE = 60;
/** 体の厚みの半分。張り付いたときに壁や天井と体の間を空けない */
export const HALF_DEPTH = 0.12;

/** 体の根元（足もと）の置き方。tilt は天井で寝かせる角度（x 軸まわり） */
export interface Placement {
  at: V3;
  yaw: number;
  tilt: number;
}

/** 置ける体。Body と、ほかの人から届いた体の様子（net.ts の Me）のどちらも渡せる */
export interface Placeable {
  pos: V3;
  yaw: number;
  cling: Cling | null;
}

export function placement(b: Placeable): Placement {
  const [x, y, z] = b.pos;
  if (b.cling?.kind === 'wall') {
    const k = RADIUS - HALF_DEPTH;
    return { at: [x - b.cling.nx * k, y, z - b.cling.nz * k], yaw: b.yaw, tilt: 0 };
  }
  // 背中を天井に付け、前を下へ向ける
  if (b.cling?.kind === 'ceiling') return { at: [x, y - HALF_DEPTH, z], yaw: b.yaw, tilt: Math.PI / 2 };
  return { at: [x, y, z], yaw: b.yaw, tilt: 0 };
}

/** 3 × 3 の回転（行ごと） */
type M3 = readonly [number, number, number, number, number, number, number, number, number];

const mul = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6],
  a[0] * b[1] + a[1] * b[4] + a[2] * b[7],
  a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6],
  a[3] * b[1] + a[4] * b[4] + a[5] * b[7],
  a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6],
  a[6] * b[1] + a[7] * b[4] + a[8] * b[7],
  a[6] * b[2] + a[7] * b[5] + a[8] * b[8]
];
const apply = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
];
const rx = (a: number): M3 => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const ry = (a: number): M3 => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rz = (a: number): M3 => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];

interface Frame {
  p: V3;
  r: M3;
}

/**
 * ポーズの骨ごとの置き方（屋敷の座標）。doll3d の PoseAnimator と同じく、骨の角度は x → y → z の Euler（three の 'XYZ'）、
 * 腰は drop だけ下げ、根元は y → x の順（placeDoll の 'YXZ'）で回す。親の審判は three を持たないので、ここで同じ鎖をたどる
 */
export function frames(pose: Pose, place: Placement): Record<Bone, Frame> {
  const root: Frame = { p: place.at, r: mul(ry(place.yaw), rx(place.tilt)) };
  const out = {} as Record<Bone, Frame>;
  for (const b of BONES) {
    const parent = PARENT[b];
    const from = parent ? out[parent] : root;
    const local = parent ? sub(JOINTS[b], JOINTS[parent]) : add(JOINTS[b], [0, pose.drop ?? 0, 0]);
    const e = pose.bones[b] ?? [0, 0, 0];
    out[b] = { p: add(from.p, apply(from.r, local)), r: mul(from.r, mul(rx(e[0]), mul(ry(e[1]), rz(e[2])))) };
  }
  return out;
}

export interface Capsule {
  a: V3;
  b: V3;
  r: number;
}

const SHAPES = dollShapes();

/** 体の形の表（doll.ts）の円すいと頭の球を、骨ごとのカプセルにして屋敷の座標へ置く */
export function capsules(pose: Pose, place: Placement): Capsule[] {
  const f = frames(pose, place);
  const at = (bone: Bone, p: V3) => add(f[bone].p, apply(f[bone].r, sub(p, JOINTS[bone])));
  return SHAPES.map((s) => {
    const bone = s.bone as Bone;
    if (s.cone) return { a: at(bone, s.a), b: at(bone, s.cone.b), r: Math.max(s.cone.ra, s.cone.rb) };
    const p = at(bone, s.a);
    return { a: p, b: p, r: Math.max(...(s.ell ?? [0.1, 0.1, 0.1])) };
  });
}

function raySphere(o: V3, d: V3, c: V3, r: number): number | null {
  const oc = sub(o, c);
  const b = dot(d, oc);
  const h = b * b - (dot(oc, oc) - r * r);
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t >= 0 ? t : null;
}

/** 線（o から長さ 1 の向き d）がカプセルに入る距離。当たらなければ null */
export function rayCapsule(o: V3, d: V3, c: Capsule): number | null {
  const ba = sub(c.b, c.a);
  const oa = sub(o, c.a);
  const baba = dot(ba, ba);
  const bard = dot(ba, d);
  const qa = baba - bard * bard;
  if (baba < 1e-12 || qa < 1e-12) {
    const ts = [raySphere(o, d, c.a, c.r), raySphere(o, d, c.b, c.r)].filter((t) => t !== null);
    return ts.length ? Math.min(...ts) : null;
  }
  const baoa = dot(ba, oa);
  const qb = baba * dot(d, oa) - baoa * bard;
  const qc = baba * dot(oa, oa) - baoa * baoa - c.r * c.r * baba;
  const h = qb * qb - qa * qc;
  if (h < 0) return null;
  const t = (-qb - Math.sqrt(h)) / qa;
  const y = baoa + t * bard;
  if (y > 0 && y < baba) return t >= 0 ? t : null;
  return raySphere(o, d, y <= 0 ? c.a : c.b, c.r);
}

/** 線が屋敷の箱（壁・床・天井・家具）に入る距離と、入った面の向き。カメラの殻（shell）ではなく家具まで含めた boxes で見る */
export function rayLevel(lv: Level, o: V3, d: V3, max: number): { t: number; n: V3 } | null {
  let best: { t: number; n: V3 } | null = null;
  for (const box of lv.boxes) {
    let t0 = 0;
    let t1 = best?.t ?? max;
    let n: V3 = [0, 0, 0];
    let miss = false;
    for (let i = 0; i < 3 && !miss; i++) {
      if (Math.abs(d[i]) < 1e-12) {
        miss = o[i] < box.min[i] || o[i] > box.max[i];
        continue;
      }
      let a = (box.min[i] - o[i]) / d[i];
      let c = (box.max[i] - o[i]) / d[i];
      // 小さいほうの面から入る。入る面の向きは線と逆
      const face: [number, number, number] = [0, 0, 0];
      face[i] = d[i] > 0 ? -1 : 1;
      if (a > c) [a, c] = [c, a];
      if (a > t0) {
        t0 = a;
        n = face;
      }
      t1 = Math.min(t1, c);
      miss = t0 > t1;
    }
    // 始点が箱の中（t0 = 0）の箱は、撃った人の立つ床などなので数えない
    if (!miss && t0 > 0) best = { t: t0, n };
  }
  return best;
}

/** 十字の向き d（長さ 1）を中心に、上下左右へ SPREAD 開いた 4 本と中心の 5 本 */
export function rays(d: V3): V3[] {
  const ref: V3 = Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0];
  const r = norm(cross(d, ref));
  const u = cross(r, d);
  const c = Math.cos(SPREAD);
  const s = Math.sin(SPREAD);
  return [d, ...[r, scale(r, -1), u, scale(u, -1)].map((side) => norm(add(scale(d, c), scale(side, s))))];
}

const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v: V3): V3 => scale(v, 1 / Math.hypot(...v));

export interface Target {
  seat: number;
  caps: Capsule[];
}

/** 1 本の線の行き先。seat は当たった人、n は体に当たらず面に当たったときの面の向き（しぶきを置く） */
export interface Ray {
  end: V3;
  seat: number | null;
  n: V3 | null;
}

/** 5 本の線を撃ち、それぞれ壁や家具より手前で体に当たったかを見る */
export function fire(lv: Level, o: V3, d: V3, targets: readonly Target[]): Ray[] {
  return rays(d).map((dir) => {
    const wall = rayLevel(lv, o, dir, RANGE);
    let t = wall?.t ?? RANGE;
    let seat: number | null = null;
    for (const target of targets)
      for (const cap of target.caps) {
        const hit = rayCapsule(o, dir, cap);
        if (hit !== null && hit < t) {
          t = hit;
          seat = target.seat;
        }
      }
    return { end: add(o, scale(dir, t)), seat, n: seat === null && wall ? wall.n : null };
  });
}
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/shots.test.ts src/lib/games/yappari-chameleon/poses.test.ts`
Expected: PASS。`frames` のテストが落ちたら、骨の角度の順（`rx · ry · rz`）か根元の回し方（`ry · rx`）が three と食い違っている。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/shots.ts src/lib/games/yappari-chameleon/shots.test.ts src/lib/games/yappari-chameleon/poses.ts
git commit -m "Judge shotgun rays against posed bone capsules and furniture without three"
```

---

### Task 4: 知らせの形と吹き付けの数の列

**Files:**

- Create: `src/lib/games/yappari-chameleon/net.ts`
- Modify: `src/lib/games/yappari-chameleon/paint.ts`（`PaintLog.low`）
- Test: `src/lib/games/yappari-chameleon/net.test.ts`

**Interfaces:**

- Consumes: `Message`（`$lib/net/link`）、`Seat`、`Cling`、`Dab`・`PaintLog`（`paint.ts`）。
- Produces: `CHAMELEON_VERSION = 1`、`SEND_MS = 50`、`DELAY_MS = 100`、`CHUNK = 32 * 1024`、`DAB_LEN = 13`、`interface Me { ms; pos; yaw; cling; pose; crouch; paint; look: [number, number] }`、`packDabs(dabs): number[]`、`unpackDabs(flat): Dab[]`、`chunks(flat, limit?)`、`dabMessages(seat, at, flat): Message[]`（`{ t: 'dabs', seat, at, d }` を `at` が続くように分ける）、`splice(log, at, add): 'append' | 'rebuild' | null`、`class DabOutbox { take(log): { at; d } | null; adopt(log) }`、`lerpMe(a, b, t)`。`PaintLog.low` は前に送ってから列がいちばん短くなった長さ（`undo`・`cancel` で縮め、`clear` で 0）。

吹き付けの列の知らせは「`at` 番めから先を `d` に替える」の 1 つの形にまとめ、足す・もどす・白に戻すを同じ形で送る。もどしたあとすぐ同じ長さまで塗り足しても縮んだことが伝わるよう、長さではなく `low` を見る。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/net.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { chunks, DAB_LEN, dabMessages, DabOutbox, lerpMe, packDabs, splice, unpackDabs, type Me } from './net';
import { PaintLog, type Dab } from './paint';

const dabAt = (i: number): Dab => ({
  p: [i * 0.0123, 1.23456, -0.5],
  n: [0, 0.6, 0.8],
  r: 0.05,
  c: [0.25, (i % 10) / 10, 1],
  a: 0.3,
  m: 0,
  ro: 0.85
});
const many = (n: number) => Array.from({ length: n }, (_, i) => dabAt(i));

describe('吹き付けの数の列', () => {
  it('詰めて戻すと同じ列になる（位置は 0.1mm、色は 1/1000 まで）', () => {
    const dabs = many(5);
    const back = unpackDabs(packDabs(dabs));
    expect(back).toHaveLength(5);
    back.forEach((d, i) => {
      expect(d.p[0]).toBeCloseTo(dabs[i].p[0], 4);
      expect(d.p[1]).toBeCloseTo(1.2346, 4);
      expect(d.c).toEqual(dabs[i].c);
      expect(d.ro).toBe(0.85);
    });
    expect(packDabs(dabs)).toHaveLength(5 * DAB_LEN);
  });

  it('32KB ごとに分けても、つなげれば元の列に戻り、吹き付けの途中では切らない', () => {
    const flat = packDabs(many(3000));
    const parts = chunks(flat);
    expect(parts.length).toBeGreaterThan(2);
    for (const p of parts) {
      expect(JSON.stringify({ t: 'dabs', seat: 3, at: 99999, d: p }).length).toBeLessThanOrEqual(32 * 1024);
      expect(p.length % DAB_LEN).toBe(0);
    }
    expect(parts.flat()).toEqual(flat);
  });

  it('分けた知らせは at が続き、順に入れると元の列になる', () => {
    const dabs = many(3000);
    const log: Dab[] = [];
    for (const m of dabMessages(2, 0, packDabs(dabs))) splice(log, m.at as number, unpackDabs(m.d as number[]));
    expect(log).toHaveLength(3000);
    expect(log[2999].c).toEqual(dabs[2999].c);
  });

  it('空の列は 1 つの知らせで、相手の列を at の長さまで縮める', () => {
    expect(dabMessages(2, 0, [])).toEqual([{ t: 'dabs', seat: 2, at: 0, d: [] }]);
  });
});

describe('splice', () => {
  it('足すだけなら append、縮めたら rebuild、先へ飛んだ知らせは捨てる', () => {
    const log = [1, 2, 3];
    expect(splice(log, 3, [4])).toBe('append');
    expect(splice(log, 2, [9])).toBe('rebuild');
    expect(log).toEqual([1, 2, 9]);
    expect(splice(log, 5, [7])).toBeNull();
    expect(log).toEqual([1, 2, 9]);
  });
});

describe('DabOutbox', () => {
  it('増えた分だけを送り、もどすで縮んだら縮んだ所から送り直す', () => {
    const log = new PaintLog();
    const out = new DabOutbox();
    log.begin();
    log.add(many(3));
    expect(out.take(log)).toMatchObject({ at: 0 });
    expect(out.take(log)).toBeNull();
    log.begin();
    log.add(many(2));
    expect(out.take(log)?.at).toBe(3);
    // もどしてすぐ同じ長さまで塗り足しても、縮んだことは伝わる
    log.undo();
    log.begin();
    log.add(many(2));
    const sent = out.take(log)!;
    expect(sent.at).toBe(3);
    expect(sent.d).toHaveLength(2 * DAB_LEN);
    log.clear();
    expect(out.take(log)).toEqual({ at: 0, d: [] });
  });

  it('親から受け取った列は送り直さない', () => {
    const log = new PaintLog();
    const out = new DabOutbox();
    log.dabs = many(4);
    out.adopt(log);
    expect(out.take(log)).toBeNull();
  });
});

describe('lerpMe', () => {
  const me = (x: number, yaw: number, pose: string): Me => ({
    ms: 0,
    pos: [x, 0, 0],
    yaw,
    cling: null,
    pose,
    crouch: false,
    paint: false,
    look: [yaw, 0]
  });

  it('位置と向きはあいだを取り、ポーズは近いほう。向きは近い回り方でつなぐ', () => {
    const m = lerpMe(me(0, 3, 'stand'), me(2, -3, 'lie'), 0.75);
    expect(m.pos[0]).toBeCloseTo(1.5);
    expect(m.pose).toBe('lie');
    expect(Math.abs(Math.atan2(Math.sin(m.yaw), Math.cos(m.yaw)))).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/net.test.ts`
Expected: FAIL（`./net` が無い）。

- [ ] **Step 3: `PaintLog.low` を足す**

```diff
--- a/src/lib/games/yappari-chameleon/paint.ts
+++ b/src/lib/games/yappari-chameleon/paint.ts
@@ -77,6 +77,8 @@

 export class PaintLog {
   dabs: Dab[] = [];
+  /** 前に相手へ送ってから列がいちばん短くなった長さ。もどす・取り消しで縮んだところから送り直す */
+  low = Infinity;
   #starts: number[] = [];
   /** あと何本もどせるか。描きかけを取り消したときに戻せるよう、筆を始める前の値も持つ */
   #budget = 0;
@@ -99,6 +101,7 @@
   undo(): boolean {
     if (!this.canUndo) return false;
     this.dabs.length = this.#starts.pop()!;
+    this.low = Math.min(this.low, this.dabs.length);
     this.#budget--;
     return true;
   }
@@ -106,12 +109,14 @@
   cancel(): boolean {
     if (!this.#starts.length) return false;
     this.dabs.length = this.#starts.pop()!;
+    this.low = Math.min(this.low, this.dabs.length);
     this.#budget = this.#before;
     return true;
   }

   clear(): void {
     this.dabs = [];
+    this.low = 0;
     this.#starts = [];
     this.#budget = this.#before = 0;
   }
```

- [ ] **Step 4: 知らせの形を書く**

`src/lib/games/yappari-chameleon/net.ts`:

```ts
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import type { Cling } from './move';
import type { Dab, PaintLog } from './paint';

/** このゲームの知らせの形の版。形を変えたら 1 上げる（Party の PROTOCOL とは別） */
export const CHAMELEON_VERSION = 1;
/** 動きと吹き付けを送る間隔 */
export const SEND_MS = 50;
/** 相手の動きを遅らせてつなぐ長さ */
export const DELAY_MS = 100;
/** 1 回の知らせの上限。DataChannel の上限（256KB）より十分小さく */
export const CHUNK = 32 * 1024;
/** 吹き付け 1 つの数（位置 3・向き 3・半径・色 4・艶 2） */
export const DAB_LEN = 13;

/** 自分の体の様子。ハンターは一人称の足もと（pos）と見る向き（yaw）を送る */
export interface Me {
  ms: number;
  pos: V3;
  yaw: number;
  cling: Cling | null;
  pose: string;
  crouch: boolean;
  paint: boolean;
  /** カメラの向き（観戦で同じ向きから見る） */
  look: [number, number];
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const r3 = (v: number) => Math.round(v * 1e3) / 1e3;

export function packDabs(dabs: readonly Dab[]): number[] {
  const out: number[] = [];
  for (const d of dabs) out.push(...d.p.map(r4), ...d.n.map(r4), r4(d.r), ...d.c.map(r3), r3(d.a), r3(d.m), r3(d.ro));
  return out;
}

export function unpackDabs(flat: readonly number[]): Dab[] {
  const out: Dab[] = [];
  for (let i = 0; i + DAB_LEN <= flat.length; i += DAB_LEN) {
    const f = flat.slice(i, i + DAB_LEN);
    out.push({
      p: [f[0], f[1], f[2]],
      n: [f[3], f[4], f[5]],
      r: f[6],
      c: [f[7], f[8], f[9]],
      a: f[10],
      m: f[11],
      ro: f[12]
    });
  }
  return out;
}

/** 吹き付けの数の列を、JSON にして limit を超えない長さごとに分ける（吹き付けの途中では切らない） */
export function chunks(flat: readonly number[], limit = CHUNK): number[][] {
  const out: number[][] = [];
  let part: number[] = [];
  // 知らせの名前などの分を空けておく
  let size = 64;
  for (let i = 0; i < flat.length; i += DAB_LEN) {
    const one = flat.slice(i, i + DAB_LEN);
    const len = one.reduce((n, v) => n + String(v).length + 1, 0);
    if (part.length && size + len > limit) {
      out.push(part);
      part = [];
      size = 64;
    }
    part.push(...one);
    size += len;
  }
  out.push(part);
  return out;
}

/** 吹き付けの列の at 番めから先を d に替える知らせ。大きければ分ける */
export function dabMessages(seat: Seat, at: number, flat: readonly number[]): Message[] {
  let from = at;
  return chunks(flat).map((d) => {
    const m = { t: 'dabs', seat, at: from, d };
    from += d.length / DAB_LEN;
    return m;
  });
}

/**
 * 受けた吹き付けを列へ入れる。at が今の長さより長ければ取りこぼしなので捨てる（null）。
 * 縮めた（もどす・塗り直し）なら 'rebuild'、足しただけなら 'append'
 */
export function splice<T>(log: T[], at: number, add: readonly T[]): 'append' | 'rebuild' | null {
  if (at > log.length) return null;
  const cut = at < log.length;
  log.length = at;
  log.push(...add);
  return cut ? 'rebuild' : 'append';
}

/** 自分の塗りの列のうち、まだ送っていない分 */
export class DabOutbox {
  #sent = 0;

  take(log: PaintLog): { at: number; d: number[] } | null {
    const at = Math.min(this.#sent, log.low);
    log.low = Infinity;
    if (at === this.#sent && at === log.dabs.length) return null;
    this.#sent = log.dabs.length;
    return { at, d: packDabs(log.dabs.slice(at)) };
  }

  /** 親から自分の列を受け取った（戻ったとき）。送り直さない */
  adopt(log: PaintLog): void {
    this.#sent = log.dabs.length;
    log.low = Infinity;
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpAngle = (a: number, b: number, t: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

/** Timeline の前後の値のあいだ。ポーズと張り付きのような段のある値は近いほうを取る */
export function lerpMe(a: Me, b: Me, t: number): Me {
  const near = t < 0.5 ? a : b;
  return {
    ...near,
    ms: lerp(a.ms, b.ms, t),
    pos: [lerp(a.pos[0], b.pos[0], t), lerp(a.pos[1], b.pos[1], t), lerp(a.pos[2], b.pos[2], t)],
    yaw: lerpAngle(a.yaw, b.yaw, t),
    look: [lerpAngle(a.look[0], b.look[0], t), lerp(a.look[1], b.look[1], t)]
  };
}
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/net.test.ts src/lib/games/yappari-chameleon/paint.test.ts`
Expected: PASS。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/net.ts src/lib/games/yappari-chameleon/net.test.ts src/lib/games/yappari-chameleon/paint.ts
git commit -m "Pack paint dabs into number rows, split them into 32KB messages and track what is unsent"
```

---

### Task 5: 控室と始める場所

**Files:**

- Modify: `src/lib/games/yappari-chameleon/mansion/layout.ts`（`ROOM`・`room()`・`SPAWNS`・控室の明かり・`Mat` に `white`）
- Modify: `src/lib/games/yappari-chameleon/mansion/build.ts`（`white` の見た目）
- Test: `src/lib/games/yappari-chameleon/mansion/layout.test.ts`

**Interfaces:**

- Produces: `ROOM = { min: [-2, 0, -32], max: [2, 3, -28] }`、`SPAWNS: Record<'hall' | 'room' | 'entrance', Record<Seat, V3>>`。大広間は `[0, 0, 1.5]`・`[-1, 0, 1.5]`・`[1, 0, 1.5]`、控室は `[0, 0, -30.8]`・`[-0.9, 0, -29.3]`・`[0.9, 0, -29.3]`、屋敷の入口は大広間の南の壁の前の `[0, 0, 0.6]`・`[-0.8, 0, 0.6]`・`[0.8, 0, 0.6]`（北を向く、yaw 0）。控室の床・天井・壁は `slabs` に入るので、動きの当たり（`boxes`）とカメラの殻（`shell`）の両方に入る。

屋敷に扉の形は無いので、探索でハンターが入る「屋敷の入口（大広間の扉の前）」は、大広間の南の壁の前から部屋の中を向いて立つ所とする。

- [ ] **Step 1: 落ちるテストを足す**

```diff
--- a/src/lib/games/yappari-chameleon/mansion/layout.test.ts
+++ b/src/lib/games/yappari-chameleon/mansion/layout.test.ts
@@ -1,6 +1,6 @@
 import { describe, expect, it } from 'vitest';
 import { idle, newBody, RADIUS, step, type Body, type Box, type Level } from '../move';
-import { levelOf, mansion } from './layout';
+import { levelOf, mansion, ROOM, SPAWNS } from './layout';

 const m = mansion();
 const lv: Level = levelOf(m);
@@ -94,4 +94,37 @@
     expect(b.pos[1]).toBeCloseTo(3.3, 2);
     expect(b.pos[2] + Math.cos(b.yaw) * 1.15).toBeLessThan(12 - 0.3);
   });
+
+  it('始める場所はどれも当たりの箱に入らず、控室の場所は控室の中', () => {
+    for (const where of ['hall', 'room', 'entrance'] as const)
+      for (const at of Object.values(SPAWNS[where])) {
+        const b = newBody(at);
+        settle(b);
+        expect(b.pos[0], `${where} ${at}`).toBeCloseTo(at[0], 3);
+        expect(b.pos[2], `${where} ${at}`).toBeCloseTo(at[2], 3);
+        expect(b.pos[1], `${where} ${at}`).toBeCloseTo(0, 3);
+      }
+    for (const at of Object.values(SPAWNS.room)) {
+      expect(at[0] > ROOM.min[0] && at[0] < ROOM.max[0] && at[2] > ROOM.min[2] && at[2] < ROOM.max[2]).toBe(true);
+    }
+  });
+
+  it('控室からは出られず、壁を上っても天井に張り付くだけ', () => {
+    const b = newBody(SPAWNS.room[1]);
+    settle(b);
+    walk(b, 0, 0);
+    expect(b.pos[2]).toBeLessThan(ROOM.max[2]);
+    walk(b, 9, -30);
+    expect(b.pos[0]).toBeLessThan(ROOM.max[0]);
+    step(b, { ...idle(), jump: true }, lv, 1 / 60);
+    expect(b.cling?.kind).toBe('wall');
+    for (let i = 0; i < 60 * 5; i++) step(b, { ...idle(), up: true }, lv, 1 / 60);
+    expect(b.cling).toEqual({ kind: 'ceiling' });
+    expect(b.pos[1]).toBeCloseTo(ROOM.max[1], 2);
+  });
+
+  it('控室の壁はカメラの殻に入る（控室の中から屋敷は見えない）', () => {
+    const shell = lv.shell ?? [];
+    expect(shell.some((b) => b.min[2] === ROOM.min[2] - 0.3 && b.max[2] === ROOM.min[2])).toBe(true);
+  });
 });
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/layout.test.ts`
Expected: FAIL（`ROOM` と `SPAWNS` が無い）。

- [ ] **Step 3: 控室を足す**

```diff
--- a/src/lib/games/yappari-chameleon/mansion/layout.ts
+++ b/src/lib/games/yappari-chameleon/mansion/layout.ts
@@ -1,7 +1,9 @@
+import type { Seat } from '$lib/net/party.svelte';
 import type { V3 } from '$lib/sculpt';
 import type { Box, Level, Ramp } from '../move';

-export type Mat = 'woodPanel' | 'marble' | 'coffer' | 'checker' | 'greenDamask' | 'wainscot' | 'cream' | 'rail';
+export type Mat =
+  'woodPanel' | 'marble' | 'coffer' | 'checker' | 'greenDamask' | 'wainscot' | 'cream' | 'rail' | 'white';
 export type Face = 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';

 export interface Slab {
@@ -123,6 +125,31 @@
   ];
 }

+/**
+ * 控室。隠れタイムのあいだハンターが待つ 4m 四方の小部屋で、出口は無い。屋敷から 28m 離し、壁で屋敷が見えない
+ */
+export const ROOM = { min: [-2, 0, -32] as V3, max: [2, 3, -28] as V3 };
+
+function room(): Slab[] {
+  const [x0, , z0] = ROOM.min;
+  const [x1, h, z1] = ROOM.max;
+  return [
+    { min: [x0, -1, z0], max: [x1, 0, z1], mat: 'woodPanel', face: 'y+' },
+    { min: [x0, h, z0], max: [x1, h + T, z1], mat: 'white', face: 'y-' },
+    { min: [x0, 0, z0 - T], max: [x1, h, z0], mat: 'white', face: 'z+' },
+    { min: [x0, 0, z1], max: [x1, h, z1 + T], mat: 'white', face: 'z-' },
+    { min: [x0 - T, 0, z0], max: [x0, h, z1], mat: 'white', face: 'x+' },
+    { min: [x1, 0, z0], max: [x1 + T, h, z1], mat: 'white', face: 'x-' }
+  ];
+}
+
+/** 席ごとの始める場所。隠れる人は大広間、ハンターは控室、探索になったハンターは大広間の南の壁の前（屋敷の入口）から北を向いて入る */
+export const SPAWNS: Record<'hall' | 'room' | 'entrance', Record<Seat, V3>> = {
+  hall: { 1: [0, 0, 1.5], 2: [-1, 0, 1.5], 3: [1, 0, 1.5] },
+  room: { 1: [0, 0, -30.8], 2: [-0.9, 0, -29.3], 3: [0.9, 0, -29.3] },
+  entrance: { 1: [0, 0, 0.6], 2: [-0.8, 0, 0.6], 3: [0.8, 0, 0.6] }
+};
+
 const p = (kind: Kind, at: V3, turn: Piece['turn'] = 0, span?: number): Piece => ({ kind, at, turn, span });

 function pieces(): Piece[] {
@@ -182,11 +209,12 @@
 export function mansion(): Mansion {
   const all = pieces();
   return {
-    slabs: [...hall(), ...corridor()],
+    slabs: [...hall(), ...corridor(), ...room()],
     pieces: all,
     ramps: [STAIR],
     spawn: [0, 0, 1.5],
     lights: [
+      { at: [0, 2.6, -30], color: '#fff4e0', power: 6, reach: 8 },
       ...all.filter((q) => q.kind === 'chandelier').map((q) => ({ at: q.at, color: '#ffd9a0', power: 14, reach: 14 })),
       ...all
         .filter((q) => q.kind === 'sconce')
```

```diff
--- a/src/lib/games/yappari-chameleon/mansion/build.ts
+++ b/src/lib/games/yappari-chameleon/mansion/build.ts
@@ -12,7 +12,8 @@
   greenDamask: () => ({ pattern: damask('#26330a', '#86a63a'), rough: 0.8 }),
   wainscot: () => ({ pattern: wainscot(), rough: 0.55 }),
   cream: () => ({ tint: '#efe6d2', rough: 0.85 }),
-  rail: () => ({ tint: '#3b2414', rough: 0.5 })
+  rail: () => ({ tint: '#3b2414', rough: 0.5 }),
+  white: () => ({ tint: '#f2efe9', rough: 0.85 })
 };

 /** BoxGeometry の材質の並び（+x, −x, +y, −y, +z, −z） */
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/mansion
git commit -m "Add the hunters' waiting room and per-seat start spots for the hall, the room and the entrance"
```

---

### Task 6: 親の審判

**Files:**

- Create: `src/lib/games/yappari-chameleon/host.ts`
- Test: `src/lib/games/yappari-chameleon/host.test.ts`

**Interfaces:**

- Consumes: `Message`、`Seat`、`Timeline`（`$lib/net/timeline`）、`Level`、`net.ts` の `CHAMELEON_VERSION`・`DAB_LEN`・`dabMessages`・`lerpMe`・`splice`・`Me`、`poseById`、`referee.ts` の全部、`shots.ts` の `capsules`・`fire`・`placement`・`Target`。
- Produces: `interface Port { readonly members: Seat[]; tell(to, m): void; onAct(l): () => void }`（`Party` がそのまま渡せる）、`REWIND = [0, 50, 100]`、`class Host { readonly match; constructor(port, level, now?, rand?); start(settings); tick(dt); welcome(to: Seat); stop() }`。

受ける act と配る tell は次のとおり。

| act（子 → 親）          | 親がすること                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `hi`                    | `v` が `CHAMELEON_VERSION` ならその席の知らせを受け始め、ちがえば `chameleon-mismatch` を返す                      |
| `join`（Party が出す）  | `rules.join` のあと `welcome(from)`                                                                                |
| `leave`（Party が出す） | `rules.leave`。体の `Timeline` と塗りの列は残す（隠れる人の体はその場に残る）                                      |
| `me`                    | 席の `Timeline` に入れ、ほかの全員へ席を付けて配る                                                                 |
| `dabs`                  | 席の塗りの列（数の列）に入れ、ほかの全員へ席を付けて配る                                                           |
| `wish`・`ready`         | ルールに入れて、様子を配る                                                                                         |
| `taunt`                 | 吹けるなら `toot`（席といる所）を全員へ                                                                            |
| `shot`                  | 当たりを決め、`splat`（筋の始まり `from`・5 本の行き先 `ends`・しぶき `marks`）と見つけた人ごとの `found` を全員へ |

`welcome(to)` は、全員の最後の体（`me`）、全員の塗り（`at: 0` からの `dabs`）、見つかった人の体（`found` に `quiet: true`）、試合の様子（`phase`）をこの順に送る。仕様の表の `paint`（戻った子へ全員の塗りと今のフェーズ）は、この並びで送る。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/host.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import { Host, type Port } from './host';
import type { Level } from './move';
import { CHAMELEON_VERSION, packDabs, splice, unpackDabs, type Me } from './net';
import type { Dab } from './paint';
import { DEFAULTS, type Settings, type View } from './referee';

/** 床だけの部屋 */
const floor: Level = { boxes: [{ min: [-20, -1, -20], max: [20, 0, 20] }], ramps: [], spawn: [0, 0, 0] };

function setup(members: Seat[] = [1, 2, 3]) {
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
    floor,
    () => clock.ms,
    () => 0
  );
  const act = (m: Message, from: Seat) => listener(m, from);
  for (const s of members) if (s !== 1) act({ t: 'hi', v: CHAMELEON_VERSION }, s);
  return { host, port, told, act, clock };
}

const me = (ms: number, pos: V3, extra: Partial<Me> = {}): Message =>
  ({
    t: 'me',
    ms,
    pos,
    yaw: 0,
    cling: null,
    pose: 'stand',
    crouch: false,
    paint: false,
    look: [0, 0],
    ...extra
  }) as Message;

const views = (told: { m: Message }[]) => told.filter((x) => x.m.t === 'phase').map((x) => x.m.view as View);
const lastView = (told: { m: Message }[]) => views(told).at(-1)!;
const of = (told: { m: Message }[], t: string) => told.filter((x) => x.m.t === t).map((x) => x.m);

/** 3 人で始め（3 番がハンター）、探索まで進める */
function searching(settings: Partial<Settings> = {}) {
  const s = setup();
  s.act({ t: 'wish', on: true }, 3);
  s.host.start({ ...DEFAULTS, ...settings });
  for (let i = 0; i < 64 * 10; i++) s.host.tick(0.1);
  expect(lastView(s.told).phase).toBe('search');
  return s;
}

/** 隠れる人 2 は z = 5 に立ち、ハンター 3 は原点から +z を向いて撃つ */
const SHOT = { t: 'shot', o: [0, 0.75, 0], d: [0, 0, 1] };

describe('Host の中継', () => {
  it('動きと吹き付けは、送った人のほかの全員へ席を付けて配る', () => {
    const { act, told } = setup();
    act(me(0, [1, 0, 1]), 2);
    const relayed = of(told, 'me');
    expect(told.filter((x) => x.m.t === 'me').map((x) => x.to)).toEqual([1, 3]);
    expect(relayed[0].seat).toBe(2);
  });

  it('版のちがう子には知らせ、その子の動きは配らない', () => {
    const { act, told } = setup([1, 2]);
    act({ t: 'leave' }, 2);
    act({ t: 'hi', v: CHAMELEON_VERSION + 1 }, 2);
    expect(told.at(-1)).toEqual({ to: 2, m: { t: 'chameleon-mismatch' } });
    act(me(0, [1, 0, 1]), 2);
    expect(of(told, 'me')).toEqual([]);
  });
});

describe('Host の試合', () => {
  it('始めると紹介を配り、3 秒で隠れタイムになる。2 人そろわないと始めない', () => {
    const lone = setup([1]);
    lone.host.start(DEFAULTS);
    expect(views(lone.told)).toEqual([]);
    const { host, told } = setup();
    host.start(DEFAULTS);
    expect(lastView(told).phase).toBe('intro');
    for (let i = 0; i < 30; i++) host.tick(0.1);
    expect(lastView(told).phase).toBe('hide');
  });

  it('残り秒しか変わらないあいだは 1 秒ごとに配る', () => {
    const { host, told } = setup();
    host.start({ ...DEFAULTS, hide: 60 });
    for (let i = 0; i < 40; i++) host.tick(0.1);
    const n = views(told).length;
    for (let i = 0; i < 20; i++) host.tick(0.1);
    expect(views(told).length - n).toBe(2);
  });
});

describe('Host の当たり', () => {
  it('隠れる人に当たれば found と splat を全員へ配り、2 秒以内の次の弾は捨てる', () => {
    const { act, told, host } = searching();
    act(me(0, [0, 0, 5]), 2);
    act(me(0, [0, 0, 0]), 3);
    act({ ...SHOT, ms: 0 }, 3);
    const found = of(told, 'found');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ seat: 2, by: 3 });
    expect((found[0].body as Me).pos).toEqual([0, 0, 5]);
    expect(of(told, 'splat')).toHaveLength(1);
    expect(lastView(told).found).toEqual([2]);
    host.tick(1);
    act({ ...SHOT, ms: 1000 }, 3);
    expect(of(told, 'splat')).toHaveLength(1);
  });

  it('外れた線は面に当たった所としぶきの向きを返す', () => {
    const { act, told } = searching();
    act(me(0, [0, 0, 0]), 3);
    act({ t: 'shot', o: [0, 1, 0], d: [0, -1, 0], ms: 0 }, 3);
    const splat = of(told, 'splat')[0];
    expect((splat.marks as { n: V3 }[])[0].n).toEqual([0, 1, 0]);
    // 銃口が届いていなければ、筋は撃った所から引く
    expect(splat.from).toEqual([0, 1, 0]);
    expect((splat.ends as V3[]).length).toBe(5);
  });

  it('同じ時刻に 2 人のハンターが同じ人を撃っても、見つかるのは 1 度だけ', () => {
    const { act, told } = searching({ mode: 'infect', hunters: 2 });
    const hunters = (Object.entries(lastView(told).roles) as [string, string][])
      .filter(([, r]) => r === 'hunter')
      .map(([s]) => Number(s) as Seat);
    const hider = ([1, 2, 3] as Seat[]).find((s) => !hunters.includes(s))!;
    act(me(0, [0, 0, 5]), hider);
    for (const h of hunters) act(me(0, [0, 0, 0]), h);
    for (const h of hunters) act({ ...SHOT, ms: 0 }, h);
    expect(of(told, 'found')).toHaveLength(1);
    expect(of(told, 'splat')).toHaveLength(2);
    expect(lastView(told).phase).toBe('reveal');
    expect(lastView(told).winner).toBe('hunter');
  });

  it('時計のずれた子の弾も、撃った時刻の体で決める（撃ったあとに動いた体にも当たる）', () => {
    const { act, told, clock } = searching();
    // 子 3 の時計は親より 1000 秒進んでいる。届くまで 30ms
    const skew = 1_000_000;
    for (let t = 0; t <= 300; t += 50) {
      clock.ms = t + 30;
      act(me(t + skew, [0, 0, 0]), 3);
      act(me(t, [0, 0, 5]), 2);
    }
    // 親の時計で 300ms に撃った。2 はその直後に横へ 3m 動いた
    for (let t = 350; t <= 500; t += 50) {
      clock.ms = t + 30;
      act(me(t, [3, 0, 5]), 2);
    }
    clock.ms = 540;
    act({ ...SHOT, ms: 300 + skew }, 3);
    expect(of(told, 'found')).toHaveLength(1);
  });

  it('切れた隠れる人の体はその場に残り、撃てば見つかる', () => {
    const { act, told, port } = searching({ mode: 'normal' });
    act(me(0, [0, 0, 5]), 2);
    port.members = [1, 3];
    act({ t: 'leave' }, 2);
    act(me(0, [0, 0, 0]), 3);
    act({ ...SHOT, ms: 0 }, 3);
    expect(of(told, 'found')[0]).toMatchObject({ seat: 2 });
  });

  it('ハンターが全員切れると、隠れる人の勝ちで答え合わせへ', () => {
    const { act, told, port } = searching();
    port.members = [1, 2];
    act({ t: 'leave' }, 3);
    expect(lastView(told)).toMatchObject({ phase: 'reveal', winner: 'chameleon' });
  });

  it('強制挑発は、吹いた人のいる所を全員へ配る', () => {
    const { act, told, host } = searching({ taunt: 5 });
    act(me(0, [2, 0, 3]), 1);
    for (let i = 0; i < 50; i++) host.tick(0.1);
    expect(of(told, 'toot')).toContainEqual({ t: 'toot', seat: 1, at: [2, 0, 3] });
  });
});

describe('Host の戻った子', () => {
  const paint = (n: number): Dab[] =>
    Array.from({ length: n }, (_, i) => ({
      p: [i / 100, 1, 0],
      n: [0, 0, 1],
      r: 0.05,
      c: [1, 0, 0],
      a: 0.3,
      m: 0,
      ro: 0.8
    }));

  it('戻った子へ、全員の体・塗り・今の様子をこの順に送り、塗りは作り直せる', () => {
    const { act, told, port, host } = searching({ mode: 'normal' });
    act(me(0, [0, 0, 5]), 2);
    act({ t: 'dabs', at: 0, d: packDabs(paint(3000)) }, 2);
    act({ t: 'dabs', at: 2990, d: packDabs(paint(5)) }, 2);
    act({ t: 'dabs', at: 0, d: packDabs(paint(4)) }, 1);
    act(me(0, [0, 0, 0]), 3);
    act({ ...SHOT, ms: 0 }, 3);
    host.tick(300);
    expect(lastView(told).phase).toBe('reveal');
    port.members = [1, 3];
    act({ t: 'leave' }, 2);
    told.length = 0;
    port.members = [1, 2, 3];
    act({ t: 'join' }, 2);
    const mine = told.filter((x) => x.to === 2).map((x) => x.m);
    expect(mine[0]).toMatchObject({ t: 'me', seat: 2, pos: [0, 0, 5] });
    expect(mine.filter((m) => m.t === 'me').map((m) => m.seat)).toEqual([2, 3]);
    expect(mine.findIndex((m) => m.t === 'phase')).toBe(mine.length - 1);
    const logs = new Map<number, Dab[]>();
    for (const m of mine.filter((m) => m.t === 'dabs')) {
      const log = logs.get(m.seat as number) ?? [];
      logs.set(m.seat as number, log);
      expect(splice(log, m.at as number, unpackDabs(m.d as number[]))).not.toBeNull();
    }
    expect(logs.get(2)).toHaveLength(2995);
    expect(logs.get(1)).toHaveLength(4);
    const v = mine.at(-1)!.view as View;
    expect(v).toMatchObject({ phase: 'reveal', winner: 'chameleon', found: [2] });
    // 見つかったときの体も、演出なしで送り直す
    expect(mine.find((m) => m.t === 'found')).toMatchObject({ seat: 2, quiet: true, body: { pos: [0, 0, 5] } });
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/host.test.ts`
Expected: FAIL（`./host` が無い）。

- [ ] **Step 3: 審判を書く**

`src/lib/games/yappari-chameleon/host.ts`:

```ts
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import { Timeline } from '$lib/net/timeline';
import type { V3 } from '$lib/sculpt';
import type { Level } from './move';
import { CHAMELEON_VERSION, DAB_LEN, dabMessages, lerpMe, splice, type Me } from './net';
import { poseById } from './poses';
import * as rules from './referee';
import { capsules, fire, placement, type Target } from './shots';

/** Party の親の口。テストでは手元の偽物に差し替える */
export interface Port {
  readonly members: Seat[];
  tell(to: Seat | 'all', message: Message): void;
  onAct(listener: (message: Message, from: Seat) => void): () => void;
}

/** 撃った時刻からさかのぼって体を調べる時刻（ミリ秒）。撃つ側と隠れる側の見え方のずれを小さくする */
export const REWIND = [0, 50, 100];
/** 試合の様子を変わらなくても送り直す間隔（秒） */
const BEAT = 1;

/**
 * 親の端末だけで動く審判。フェーズと時計を進め、全員の動きと吹き付けを中継し、撃った弾の当たりを決める。
 * 親自身の操作も act で同じ口から入るので（Party が手元で回す）、席 1 も子と同じに扱える
 */
export class Host {
  readonly match = rules.newMatch();
  readonly #port: Port;
  readonly #level: Level;
  readonly #now: () => number;
  readonly #rand: () => number;
  readonly #lines = new Map<Seat, Timeline<Me>>();
  /** 席ごとの吹き付けの列（数の列のまま）。戻った子へ全員の塗りを送り直すのに使う */
  readonly #logs = new Map<Seat, number[]>();
  readonly #greeted = new Set<Seat>([1]);
  /** 見つかったときの体。戻った子の答え合わせで、その場に戻して見せる */
  readonly #found = new Map<Seat, Me>();
  #sent = '';
  #beat = 0;
  #stop: () => void;

  constructor(port: Port, level: Level, now: () => number = () => performance.now(), rand: () => number = Math.random) {
    this.#port = port;
    this.#level = level;
    this.#now = now;
    this.#rand = rand;
    this.#stop = port.onAct((m, from) => this.#act(m, from));
  }

  /** マップの設定で「ゲームを始める」 */
  start(settings: rules.Settings): void {
    if (this.match.phase !== 'lobby' || this.#port.members.length < 2) return;
    rules.start(this.match, [...this.#port.members], settings, this.#rand);
    this.#push(true);
  }

  tick(dt: number): void {
    for (const seat of rules.tick(this.match, dt)) this.#toot(seat);
    this.#beat += dt;
    this.#push(this.#beat >= BEAT);
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
      const me = m as unknown as Me;
      this.#line(from).push(me.ms, this.#now(), me);
      this.#relay(from, m);
    } else if (m.t === 'dabs') {
      const log = this.#logs.get(from) ?? [];
      this.#logs.set(from, log);
      if (splice(log, (m.at as number) * DAB_LEN, m.d as number[]) !== null) this.#relay(from, m);
    } else if (m.t === 'wish') {
      if (this.match.phase === 'lobby') rules.wish(this.match, from, m.on === true);
      this.#push(true);
    } else if (m.t === 'ready') {
      rules.ready(this.match, from, this.#port.members);
      this.#push(true);
    } else if (m.t === 'taunt') {
      if (rules.toot(this.match, from)) this.#toot(from);
    } else if (m.t === 'shot') this.#shot(m, from);
  }

  #line(seat: Seat): Timeline<Me> {
    let line = this.#lines.get(seat);
    if (!line) this.#lines.set(seat, (line = new Timeline<Me>()));
    return line;
  }

  /** 送った人のほかの全員へ、送った人の席を付けて配る */
  #relay(from: Seat, m: Message) {
    for (const seat of this.#port.members) if (seat !== from) this.#port.tell(seat, { ...m, seat: from });
  }

  /**
   * 来た・戻った人へ、全員の体・塗り・見つかったときの体・今の試合の様子を送る。
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
    this.#port.tell(to, { t: 'phase', view: rules.view(this.match) });
  }

  #toot(seat: Seat) {
    const me = this.#lines.get(seat)?.last();
    if (me) this.#port.tell('all', { t: 'toot', seat, at: me.pos });
  }

  /**
   * 撃った弾の当たりを決める。撃った時刻（送った人の時計）を親の時計に直し、隠れる人の体をその時刻から 0.1 秒前まで
   * さかのぼって調べる。同じ人が 2 つの弾で 2 度見つからないよう、見つかった人は当たりから外してある
   */
  #shot(m: Message, from: Seat) {
    if (!rules.shoot(this.match, from)) return;
    const o = m.o as V3;
    const d = m.d as V3;
    const at = (m.ms as number) + this.#line(from).offset();
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
    const rays = fire(this.#level, o, d, targets);
    this.#port.tell('all', {
      t: 'splat',
      by: from,
      // 筋は銃口から引く（当たりは十字の向き、つまり目の位置から見る）
      from: (m.from as V3 | undefined) ?? o,
      ends: rays.map((r) => r.end),
      marks: rays.filter((r) => r.n).map((r) => ({ p: r.end, n: r.n }))
    });
    for (const r of rays) {
      const seat = r.seat as Seat | null;
      if (seat === null || !rules.hit(this.match, seat)) continue;
      const body = this.#lines.get(seat)?.last();
      if (body) this.#found.set(seat, body);
      this.#port.tell('all', { t: 'found', seat, by: from, at: r.end, body });
    }
    this.#push(true);
  }

  /** 様子が変わったか、間隔が来たら全員へ配る。残り秒は毎フレーム変わるので、変わったかどうかには数えない */
  #push(force: boolean) {
    const v = rules.view(this.match);
    const key = JSON.stringify({ ...v, left: 0 });
    if (!force && key === this.#sent) return;
    this.#sent = key;
    this.#beat = 0;
    this.#port.tell('all', { t: 'phase', view: v });
  }
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/host.test.ts`
Expected: PASS。「時計のずれた子の弾も」が落ちたら、撃った時刻を `offset()` で親の時計に直していない。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/host.ts src/lib/games/yappari-chameleon/host.test.ts
git commit -m "Run the referee on the host: relay moves and paint, judge shots with rewind and welcome rejoiners"
```

---

### Task 7: 画面が持つ試合の様子

**Files:**

- Create: `src/lib/games/yappari-chameleon/match.svelte.ts`
- Test: `src/lib/games/yappari-chameleon/match.svelte.test.ts`

**Interfaces:**

- Consumes: `Seat`、`referee.ts` の `newMatch`・`view`・`GameMode`・`Role`・`View`。
- Produces: `MODES: Record<GameMode, { name; lines: [string, string] }>`、`WINNER`、`nameOf(seat)`（「プレイヤーN」）、`class Match { view; left; taunt; synced; constructor(me: () => Seat); me; phase; receive(v); advance(dt); roleOf(seat); role; found(seat?); watching(seat?); hiders; hunters; hiding; word }`。`me` は関数で受ける（子の席の番号は、つないだあとに `Party` へ届く）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/match.svelte.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import { Match } from './match.svelte';
import { DEFAULTS, newMatch, view, type View } from './referee';

const at = (me: Seat, v: Partial<View>) => {
  const m = new Match(() => me);
  m.receive({ ...view(newMatch()), settings: DEFAULTS, roles: { 1: 'hider', 2: 'hider', 3: 'hunter' }, ...v });
  return m;
};

describe('Match', () => {
  it('残り秒は次の知らせまで手元で減らし、強制挑発の秒は探索のあいだだけ減らす', () => {
    const m = at(1, { phase: 'hide', left: 10, taunts: { 1: 5 } });
    m.advance(0.5);
    expect(m.left).toBeCloseTo(9.5);
    expect(m.taunt).toBe(5);
    m.receive({ ...m.view, phase: 'search', left: 300 });
    m.advance(1);
    expect(m.taunt).toBe(4);
    expect(m.left).toBeCloseTo(299);
  });

  it('白い人形は見つかっていない隠れる人、赤い人形はハンターの数', () => {
    const m = at(1, { phase: 'search', found: [2] });
    expect(m.hiders).toBe(1);
    expect(m.hunters).toBe(1);
  });

  it('フェーズの言葉は役で変わる', () => {
    expect(at(1, { phase: 'hide' }).word).toBe('探索開始まで');
    expect(at(3, { phase: 'hide' }).word).toBe('探索開始まで');
    expect(at(1, { phase: 'search' }).word).toBe('隠れつづけよう');
    expect(at(3, { phase: 'search' }).word).toBe('探索時間');
    expect(at(1, { phase: 'reveal' }).word).toBe('答え合わせ');
  });

  it('観戦するのは、通常で見つかった人と、試合の途中から来た人', () => {
    expect(at(1, { phase: 'search', found: [1], settings: { ...DEFAULTS, mode: 'normal' } }).watching()).toBe(true);
    expect(at(1, { phase: 'search', found: [1], roles: { 1: 'hunter', 3: 'hunter' } }).watching()).toBe(false);
    expect(at(2, { phase: 'search', roles: { 1: 'hider', 2: 'out', 3: 'hunter' } }).watching()).toBe(true);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/match.svelte.test.ts`
Expected: FAIL（`./match.svelte` が無い）。

- [ ] **Step 3: 試合の様子を書く**

`src/lib/games/yappari-chameleon/match.svelte.ts`:

```ts
import type { Seat } from '$lib/net/party.svelte';
import { newMatch, view, type GameMode, type Role, type View } from './referee';

/** モードの名前と説明 2 行（紹介の黒い帯と、ハンターの右下に出し続ける） */
export const MODES: Record<GameMode, { name: string; lines: [string, string] }> = {
  normal: { name: '通常', lines: ['鬼と人間に分かれて隠れる。', '1人でも最後まで隠れ切ると勝利'] },
  infect: { name: '増え鬼', lines: ['捕まると鬼になる。', '最後まで隠れ切ると勝利'] }
};

export const WINNER = { chameleon: '勝者カメレオン!', hunter: '勝者ハンター!' } as const;

export const nameOf = (seat: Seat) => `プレイヤー${seat}`;

/** 親から届いた試合の様子を、画面が読む形で持つ。残り秒は次の知らせまで手元で減らす */
export class Match {
  view = $state.raw<View>(view(newMatch()));
  left = $state(0);
  /** 自分の次の強制挑発までの秒。探索中の隠れる人で、強制挑発があるときだけ */
  taunt = $state<number | null>(null);
  /** 親から最初の様子が届いた（戻った子は、それまで自分の動きを送らない） */
  synced = $state(false);
  readonly #me: () => Seat;

  constructor(me: () => Seat) {
    this.#me = me;
  }

  get me(): Seat {
    return this.#me();
  }

  get phase(): View['phase'] {
    return this.view.phase;
  }

  receive(v: View): void {
    this.view = v;
    this.left = v.left;
    this.taunt = v.taunts[this.me] ?? null;
    this.synced = true;
  }

  advance(dt: number): void {
    if (this.phase === 'lobby') return;
    this.left = Math.max(0, this.left - dt);
    if (this.taunt !== null && this.phase === 'search') this.taunt = Math.max(0, this.taunt - dt);
  }

  roleOf(seat: Seat): Role | null {
    return this.view.roles[seat] ?? null;
  }

  get role(): Role | null {
    return this.roleOf(this.me);
  }

  found(seat: Seat = this.me): boolean {
    return this.view.found.includes(seat);
  }

  /** 観戦する人（通常で見つかった人と、途中から来た人・抜けて戻ったハンター） */
  watching(seat: Seat = this.me): boolean {
    return this.roleOf(seat) === 'out' || (this.view.settings.mode === 'normal' && this.found(seat));
  }

  /** まだ見つかっていない隠れる人の数（HUD の白い人形と残り人数） */
  get hiders(): number {
    return (Object.entries(this.view.roles) as [string, Role][]).filter(
      ([s, r]) => r === 'hider' && !this.view.found.includes(Number(s) as Seat)
    ).length;
  }

  get hunters(): number {
    return Object.values(this.view.roles).filter((r) => r === 'hunter').length;
  }

  /** 自分が今、見つかっていない隠れる人か（挑発できる・残り人数を出す） */
  get hiding(): boolean {
    return this.role === 'hider' && !this.found();
  }

  /** 砂時計の下のフェーズの言葉 */
  get word(): string {
    if (this.phase === 'hide' || this.phase === 'intro') return '探索開始まで';
    if (this.phase === 'reveal') return '答え合わせ';
    return this.hiding ? '隠れつづけよう' : '探索時間';
  }
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/match.svelte.test.ts`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/match.svelte.ts src/lib/games/yappari-chameleon/match.svelte.test.ts
git commit -m "Hold the match view on each device with the phase words, mode texts and player names"
```

---

### Task 8: 銃と絵筆の形・答え合わせの光・ほかの人の体

**Files:**

- Create: `src/lib/games/yappari-chameleon/gun.ts`
- Create: `src/lib/games/yappari-chameleon/glow.ts`
- Create: `src/lib/games/yappari-chameleon/remote.ts`
- Modify: `src/lib/games/yappari-chameleon/world3d.ts`（`placeRoot`、絵筆を `gun.ts` から、`overlay` と `hand`、`screen()`）
- Test: `src/lib/games/yappari-chameleon/remote.test.ts`

**Interfaces:**

- Consumes: `finish`・`rainbowMottle`（`textures.ts`）、`DollRig`・`PoseAnimator`（`doll3d.ts`）、`Timeline`、`net.ts` の `DELAY_MS`・`lerpMe`・`splice`・`unpackDabs`・`Me`、`poseById`、`placement`・`Placeable`（`shots.ts`）。
- Produces: `gunModel()`（銃口は −z）、`MUZZLE`、`brushModel()`、`inHand(forearm, o, 'brush' | 'gun')`、`disposeModel(root)`、`type Shine = 'red' | 'blue' | null`、`class Glow { constructor(rig); set(kind); dispose() }`、`interface Show { pin: Me | null; visible; armed; shine }`、`class Remote { line; log; rig; shown; constructor(rig, scene); push(me, now); dabs(at, d); clearPaint(); update(dt, now, show); center(); head(); colors(); dispose() }`、`paintColors(log, n?)`、`world3d.ts` の `placeRoot(root, b)`・`World.overlay`・`World.hand`・`World.screen(p)`。

ほかの人の体は、自分の体を作ったときの面と升目（`buildDoll()` と `layAtlas()` の結果）を使い回して `makeDoll` で作る（Task 12 の `mount3d` が `makeRig` として渡す）。塗りの面（`PaintSurface`）は 1 人ぶん約 40MB で、3 人ぶんでも iPad Air に収まる。ほかの人の体には当たりの体（`pick`）は要らないので焼かない。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/remote.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { layAtlas } from './atlas';
import { buildDoll } from './doll';
import { makeDoll } from './doll3d';
import { packDabs, type Me } from './net';
import type { Dab } from './paint';
import { paintColors, Remote, type Show } from './remote';

// 塗りの描き先と模様は GPU と canvas に作るので、ここでは何もしない描画器と模様で足りる
const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;
vi.mock('./textures', async (orig) => ({
  ...(await orig<typeof import('./textures')>()),
  rainbowMottle: () => undefined
}));

const surface = buildDoll(0.02);
const atlas = layAtlas(surface.pos, surface.idx, 2048);

const me = (ms: number, x: number, extra: Partial<Me> = {}): Me => ({
  ms,
  pos: [x, 0, 0],
  yaw: 0,
  cling: null,
  pose: 'stand',
  crouch: false,
  paint: false,
  look: [0, 0],
  ...extra
});
const show = (extra: Partial<Show> = {}): Show => ({ pin: null, visible: true, armed: false, shine: null, ...extra });
const dab = (i: number): Dab => ({ p: [i / 100, 1, 0], n: [0, 0, 1], r: 0.05, c: [0, 1, 0], a: 0.3, m: 0, ro: 0.8 });

function remote() {
  const rig = makeDoll(renderer, surface, atlas);
  vi.spyOn(rig.paint, 'apply').mockImplementation(() => {});
  vi.spyOn(rig.paint, 'rebuild').mockImplementation(() => {});
  vi.spyOn(rig.paint, 'flush').mockImplementation(() => {});
  return new Remote(rig, new THREE.Scene());
}

describe('Remote', () => {
  it('届いた動きを 0.1 秒遅らせてつなぎ、まだ何も届いていなければ描かない', () => {
    const r = remote();
    r.update(1 / 60, 0, show());
    expect(r.rig.root.visible).toBe(false);
    r.push(me(0, 0), 1000);
    r.push(me(50, 1), 1050);
    r.update(1 / 60, 1125, show());
    expect(r.rig.root.visible).toBe(true);
    expect(r.rig.root.position.x).toBeCloseTo(0.5);
  });

  it('答え合わせでは撃たれたときの体に戻し、見せないときは描かない', () => {
    const r = remote();
    r.push(me(0, 4), 0);
    r.update(1 / 60, 500, show({ pin: me(0, -2) }));
    expect(r.rig.root.position.x).toBeCloseTo(-2);
    r.update(1 / 60, 500, show({ visible: false }));
    expect(r.rig.root.visible).toBe(false);
  });

  it('吹き付けは足すだけなら足し、縮んだら列から塗り直す', () => {
    const r = remote();
    r.dabs(0, packDabs([dab(0), dab(1)]));
    expect(r.rig.paint.apply).toHaveBeenCalledTimes(1);
    r.dabs(1, packDabs([dab(5)]));
    expect(r.rig.paint.rebuild).toHaveBeenCalledTimes(1);
    expect(r.log).toHaveLength(2);
  });
});

describe('paintColors', () => {
  it('塗った量が少なければ破片の多くは白く、塗りの色を混ぜる', () => {
    expect(paintColors([])).toEqual(Array(20).fill([1, 1, 1]));
    const some = paintColors(Array.from({ length: 1000 }, (_, i) => dab(i)));
    expect(some.filter((c) => c[1] === 1 && c[0] === 0)).toHaveLength(10);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/remote.test.ts`
Expected: FAIL（`./remote` が無い）。

- [ ] **Step 3: 銃と絵筆の形を書く**

`src/lib/games/yappari-chameleon/gun.ts`:

```ts
import * as THREE from 'three';
import { finish, rainbowMottle } from './textures';

function part(geo: THREE.BufferGeometry, mat: THREE.Material, at: [number, number, number], rotX = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(...at);
  o.rotation.x = rotX;
  o.castShadow = true;
  return o;
}

/** 本家のハンターのショットガン型のペイント銃。木の銃床と先台、虹色のまだらの機関部と銃身。銃口は -z（前）を向く */
export function gunModel(): THREE.Group {
  const wood = finish({ tint: '#8a5a2e', rough: 0.55 }, [0.1, 0.3]);
  const paint = finish({ pattern: rainbowMottle(), rough: 0.45 }, [0.12, 0.4]);
  const dark = finish({ tint: '#2b2420', metal: 0.6, rough: 0.4 }, [0.05, 0.1]);
  const g = new THREE.Group();
  g.add(
    part(new THREE.BoxGeometry(0.05, 0.08, 0.26), wood, [0, -0.025, 0.21], 0.12),
    part(new THREE.BoxGeometry(0.06, 0.075, 0.2), paint, [0, 0, 0]),
    part(new THREE.CylinderGeometry(0.022, 0.022, 0.42, 14), paint, [0, 0.016, -0.3], Math.PI / 2),
    part(new THREE.CylinderGeometry(0.03, 0.03, 0.13, 14), wood, [0, -0.024, -0.2], Math.PI / 2),
    part(new THREE.BoxGeometry(0.035, 0.085, 0.045), dark, [0, -0.07, 0.075], -0.35)
  );
  return g;
}

/** 銃口の位置（gunModel の座標） */
export const MUZZLE: [number, number, number] = [0, 0.016, -0.51];

/** 隠れる側がペイントモードのあいだ右手に持つ絵筆。虹色のまだらの柄に金の口金と黒い穂先 */
export function brushModel(): THREE.Group {
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.014, 0.36, 12),
    finish({ pattern: rainbowMottle(), rough: 0.5 }, [0.08, 0.36])
  );
  const ferrule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.014, 0.05, 12),
    finish({ tint: '#c9a227', metal: 1, rough: 0.35 }, [0.1, 0.05])
  );
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.018, 0.07, 12),
    finish({ tint: '#2b2420', rough: 0.9 }, [0.1, 0.07])
  );
  ferrule.position.y = 0.2;
  tip.position.y = 0.26;
  const g = new THREE.Group();
  g.add(handle, ferrule, tip);
  return g;
}

/**
 * 体の右手（前腕の骨の子）に絵筆か銃を持たせる。手の楕円体（doll.ts の [-0.538, 0.616, 0]）を、
 * 前腕の骨の付け根 [-0.354, 0.745, 0] からの差で指す
 */
export function inHand(forearm: THREE.Bone, o: THREE.Object3D, kind: 'brush' | 'gun'): void {
  o.position.set(-0.184, -0.129, 0.03);
  if (kind === 'brush') {
    // 穂先を下にして腰のわきへ垂らす（横へ寝かせると床に付く）
    o.rotation.set(Math.PI - 0.5, 0, 0.2);
  } else {
    // 銃口（-z）を前腕の伸びる向き（ひじから手首）へ向ける。構えたポーズでは前腕が前を向く
    const along = new THREE.Vector3(-0.184, -0.129, 0).normalize();
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), along);
  }
  o.visible = false;
  forearm.add(o);
}

/** 部品の形・材質・模様のテクスチャを片付ける */
export function disposeModel(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      (m as THREE.MeshStandardMaterial).map?.dispose();
      m.dispose();
    }
  });
}
```

- [ ] **Step 4: 答え合わせの光を書く**

`src/lib/games/yappari-chameleon/glow.ts`:

```ts
import * as THREE from 'three';
import type { DollRig } from './doll3d';

export type Shine = 'red' | 'blue' | null;

const COLORS = { red: '#ff3b30', blue: '#2f7bff' };

/**
 * 答え合わせで体を光らせる。見つかっていない人は赤、見つかった人は青。
 * 外へ少し膨らませた裏面（ふち）と、壁より奥にあるところだけを描く影（壁を透かした体）の 2 枚で、骨は体と同じものを使う
 */
export class Glow {
  readonly #rim: THREE.SkinnedMesh;
  readonly #ghost: THREE.SkinnedMesh;
  readonly #rimMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  readonly #ghostMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    // 手前の物に隠れたところだけを描く。見えているところは体そのものを見せる
    depthFunc: THREE.GreaterDepth
  });

  constructor(rig: DollRig) {
    this.#rimMat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace(
        '#include <skinning_vertex>',
        '#include <skinning_vertex>\ntransformed += normalize(objectNormal) * 0.025;'
      );
    };
    this.#rim = this.#mesh(rig, this.#rimMat);
    this.#ghost = this.#mesh(rig, this.#ghostMat);
    this.#ghost.renderOrder = 20;
  }

  #mesh(rig: DollRig, m: THREE.Material): THREE.SkinnedMesh {
    const o = new THREE.SkinnedMesh(rig.mesh.geometry, m);
    o.bind(rig.mesh.skeleton, rig.mesh.bindMatrix);
    o.frustumCulled = false;
    o.visible = false;
    rig.root.add(o);
    return o;
  }

  set(kind: Shine): void {
    this.#rim.visible = this.#ghost.visible = kind !== null;
    if (!kind) return;
    this.#rimMat.color.set(COLORS[kind]);
    this.#ghostMat.color.set(COLORS[kind]);
  }

  dispose(): void {
    this.#rim.removeFromParent();
    this.#ghost.removeFromParent();
    this.#rimMat.dispose();
    this.#ghostMat.dispose();
  }
}
```

- [ ] **Step 5: `world3d.ts` を直す**

体の置き方を `shots.ts` の `placement()` にまとめ（親の当たりと見える体が同じ置き方になる）、絵筆を `gun.ts` から作り、一人称の手と銃の場面と、名前の札の画面の位置を足す。

```diff
--- a/src/lib/games/yappari-chameleon/world3d.ts
+++ b/src/lib/games/yappari-chameleon/world3d.ts
@@ -3,8 +3,10 @@
 import type { V3 } from '$lib/sculpt';
 import type { RGB } from './color';
 import { bakePose, PoseAnimator, type DollRig } from './doll3d';
-import { cameraReach, settleDist, RADIUS, type Body, type DistState, type Level } from './move';
-import { finish, rainbowMottle, readPick } from './textures';
+import { brushModel, disposeModel, inHand } from './gun';
+import { cameraReach, settleDist, type Body, type DistState, type Level } from './move';
+import { placement, type Placeable } from './shots';
+import { readPick } from './textures';
 import { seeThrough, XRAY } from './xray';

 /** 一人称の縦の視野。本家の 16:9 の画面での横 105 度と同じ見え方 */
@@ -20,8 +22,14 @@
  */
 const CAM_RADIUS = 0.12;

-/** 体の厚みの半分。張り付いたときに壁や天井と体の間を空けない */
-const HALF_DEPTH = 0.12;
+/** 体の根元を、張り付き（壁から離す・天井で寝かせる）も込みで置く。ほかの人の体も同じ置き方にする */
+export function placeRoot(root: THREE.Object3D, b: Placeable): void {
+  const p = placement(b);
+  root.rotation.order = 'YXZ';
+  root.rotation.set(p.tilt, p.yaw, 0);
+  root.position.set(...p.at);
+  root.updateMatrixWorld(true);
+}

 export class World {
   readonly renderer: THREE.WebGLRenderer;
@@ -29,6 +37,10 @@
   readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
   readonly rig: DollRig;
   readonly poses: PoseAnimator;
+  /** 一人称の手と銃の場面。屋敷の深さを消してから重ねて描くので、壁に近づいても銃が壁に埋まらない */
+  readonly overlay = new THREE.Scene();
+  /** overlay の中で、描く直前にカメラへ合わせる枠 */
+  readonly hand = new THREE.Group();
   level: Level = { boxes: [], ramps: [], spawn: [0, 0, 0] };
   #stage: THREE.Group | null = null;
   #environment: THREE.WebGLRenderTarget | null = null;
@@ -47,7 +59,7 @@
       depthWrite: false
     })
   );
-  #brush = new THREE.Group();
+  #brush = brushModel();
   #baked = -1;
   #center = new THREE.Vector3();
   #ease: DistState = { dist: 2.4, wait: 0 };
@@ -96,26 +108,9 @@
     this.scene.add(this.#cursor);
     this.#ring.visible = false;
     this.scene.add(this.#ring);
-    const handle = new THREE.Mesh(
-      new THREE.CylinderGeometry(0.012, 0.014, 0.36, 12),
-      finish({ pattern: rainbowMottle(), rough: 0.5 }, [0.08, 0.36])
-    );
-    const ferrule = new THREE.Mesh(
-      new THREE.CylinderGeometry(0.016, 0.014, 0.05, 12),
-      finish({ tint: '#c9a227', metal: 1, rough: 0.35 }, [0.1, 0.05])
-    );
-    const tip = new THREE.Mesh(
-      new THREE.ConeGeometry(0.018, 0.07, 12),
-      finish({ tint: '#2b2420', rough: 0.9 }, [0.1, 0.07])
-    );
-    ferrule.position.y = 0.2;
-    tip.position.y = 0.26;
-    this.#brush.add(handle, ferrule, tip);
-    // 手の楕円体（doll.ts の [-0.538, 0.616, 0]）を、前腕の骨の付け根 [-0.354, 0.745, 0] からの差で指す。穂先を下にして腰のわきへ垂らす（横へ寝かせると床に付く）
-    this.#brush.position.set(-0.184, -0.129, 0.03);
-    this.#brush.rotation.set(Math.PI - 0.5, 0, 0.2);
-    this.#brush.visible = false;
-    this.rig.bones['forearm.r'].add(this.#brush);
+    inHand(this.rig.bones['forearm.r'], this.#brush, 'brush');
+    this.overlay.visible = false;
+    this.overlay.add(new THREE.HemisphereLight('#fff4e0', '#5a4a3a', 2), this.hand);
   }

   #buildEnvironment(): void {
@@ -150,18 +145,7 @@

   placeDoll(b: Body): void {
     const root = this.rig.root;
-    root.rotation.order = 'YXZ';
-    root.rotation.set(0, b.yaw, 0);
-    root.position.set(b.pos[0], b.pos[1], b.pos[2]);
-    if (b.cling?.kind === 'wall') {
-      root.position.x -= b.cling.nx * (RADIUS - HALF_DEPTH);
-      root.position.z -= b.cling.nz * (RADIUS - HALF_DEPTH);
-    } else if (b.cling?.kind === 'ceiling') {
-      // 背中を天井に付け、前を下へ向ける
-      root.rotation.x = Math.PI / 2;
-      root.position.y = b.pos[1] - HALF_DEPTH;
-    }
-    root.updateMatrixWorld(true);
+    placeRoot(root, b);
     const ring = this.#ring;
     ring.visible = !!b.cling;
     if (b.cling?.kind === 'wall') {
@@ -262,6 +246,12 @@
     return { x: ((v.x + 1) / 2) * this.#w, y: ((1 - v.y) / 2) * this.#h };
   }

+  /** 画面の位置。カメラの後ろなら null（名前の札を出さない） */
+  screen(p: V3): { x: number; y: number } | null {
+    const v = new THREE.Vector3(...p).applyMatrix4(this.camera.matrixWorldInverse);
+    return v.z < -this.camera.near ? this.project(p) : null;
+  }
+
   // 自分の画面の位置（描画の画素、左下が原点）と、自分までの深さ
   xray(on: boolean): void {
     XRAY.on.value = on ? 1 : 0;
@@ -280,6 +270,14 @@
   render(): void {
     this.rig.paint.flush();
     this.renderer.render(this.scene, this.camera);
+    if (!this.overlay.visible) return;
+    this.hand.position.copy(this.camera.position);
+    this.hand.quaternion.copy(this.camera.quaternion);
+    const r = this.renderer;
+    r.autoClear = false;
+    r.clearDepth();
+    r.render(this.overlay, this.camera);
+    r.autoClear = true;
   }

   dispose(): void {
@@ -298,12 +296,8 @@
     this.#cursor.material.dispose();
     this.#ring.geometry.dispose();
     this.#ring.material.dispose();
-    this.#brush.traverse((o) => {
-      if (!(o instanceof THREE.Mesh)) return;
-      o.geometry.dispose();
-      (o.material as THREE.MeshStandardMaterial).map?.dispose();
-      o.material.dispose();
-    });
+    disposeModel(this.#brush);
+    disposeModel(this.overlay);
     this.renderer.dispose();
     // iOS は WebGL の文脈の数に上限があり、ゲームを開閉するたびに残すと古いものから失われていく
     this.renderer.forceContextLoss();
```

- [ ] **Step 6: ほかの人の体を書く**

`src/lib/games/yappari-chameleon/remote.ts`:

```ts
import * as THREE from 'three';
import { Timeline } from '$lib/net/timeline';
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { PoseAnimator, type DollRig } from './doll3d';
import { Glow, type Shine } from './glow';
import { brushModel, disposeModel, gunModel, inHand } from './gun';
import { DELAY_MS, lerpMe, splice, unpackDabs, type Me } from './net';
import type { Dab } from './paint';
import { poseById } from './poses';
import { placeRoot } from './world3d';

export interface Show {
  /** 答え合わせで、撃たれたときの体をその場に戻して見せる */
  pin: Me | null;
  visible: boolean;
  /** ハンターとして銃を構える */
  armed: boolean;
  shine: Shine;
}

/**
 * ほかの人の体。届いた動きを送った時刻から少し遅らせてつなぎ、その人の吹き付けの列を自分の端末の塗りの面で塗り直す
 */
export class Remote {
  readonly line = new Timeline<Me>();
  readonly log: Dab[] = [];
  readonly rig: DollRig;
  /** 今置いている体の様子。まだ動きが届いていなければ null */
  shown: Me | null = null;
  readonly #poses: PoseAnimator;
  readonly #glow: Glow;
  readonly #gun = gunModel();
  readonly #brush = brushModel();
  #pose = '';

  constructor(rig: DollRig, scene: THREE.Scene) {
    this.rig = rig;
    this.#poses = new PoseAnimator(rig);
    this.#glow = new Glow(rig);
    inHand(rig.bones['forearm.r'], this.#brush, 'brush');
    inHand(rig.bones['forearm.r'], this.#gun, 'gun');
    rig.root.visible = false;
    scene.add(rig.root);
  }

  push(me: Me, now: number): void {
    this.line.push(me.ms, now, me);
  }

  dabs(at: number, d: number[]): void {
    const add = unpackDabs(d);
    const how = splice(this.log, at, add);
    if (how === 'rebuild') this.rig.paint.rebuild(this.log);
    else if (how === 'append') this.rig.paint.apply(add);
  }

  clearPaint(): void {
    this.log.length = 0;
    this.rig.paint.rebuild([]);
  }

  update(dt: number, now: number, show: Show): void {
    const s = this.line.at(now, DELAY_MS);
    const me = show.pin ?? (s ? lerpMe(s.a, s.b, s.t) : null);
    this.shown = me;
    this.rig.root.visible = !!me && show.visible;
    this.#glow.set(this.rig.root.visible ? show.shine : null);
    if (!me) return;
    placeRoot(this.rig.root, me);
    if (me.pose !== this.#pose) {
      // 初めて見えたときはポーズの途中から動かさない
      if (this.#pose) this.#poses.to(poseById(me.pose));
      else this.#poses.snap(poseById(me.pose));
      this.#pose = me.pose;
    }
    this.#gun.visible = show.armed;
    this.#brush.visible = me.paint && !show.armed;
    this.#poses.step(dt);
    this.rig.paint.flush();
  }

  /** 体の真ん中（観戦で見る所・砕ける所）。天井では寝ているので、根元から体の軸に沿って測る */
  center(): V3 | null {
    if (!this.shown) return null;
    const c = this.rig.root.localToWorld(new THREE.Vector3(0, 0.6, 0));
    return [c.x, c.y, c.z];
  }

  /** 頭の上（名前の札を出す所） */
  head(): V3 | null {
    if (!this.shown) return null;
    const c = this.rig.root.localToWorld(new THREE.Vector3(0, 1.35, 0));
    return [c.x, c.y, c.z];
  }

  colors(): RGB[] {
    return paintColors(this.log);
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.#glow.dispose();
    disposeModel(this.#gun);
    disposeModel(this.#brush);
    this.rig.mesh.geometry.dispose();
    this.rig.pick.geometry.dispose();
    this.rig.material.dispose();
    this.rig.paint.dispose();
  }
}

/** 砕けた破片の色。塗った量が多いほど塗りの色が増え、少なければ白が多い */
export function paintColors(log: readonly Dab[], n = 20): RGB[] {
  const share = Math.min(1, log.length / 2000);
  return Array.from({ length: n }, (_, i) =>
    log.length && (i + 0.5) / n < share ? log[Math.floor(((i * 7919) % n) * (log.length / n))].c : [1, 1, 1]
  );
}
```

- [ ] **Step 7: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（ひとりで試すの `play.svelte.test.ts` と `doll3d.test.ts` も通る）。

- [ ] **Step 8: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/gun.ts src/lib/games/yappari-chameleon/glow.ts src/lib/games/yappari-chameleon/remote.ts src/lib/games/yappari-chameleon/remote.test.ts src/lib/games/yappari-chameleon/world3d.ts
git commit -m "Draw other players' bodies with their own paint, the paint gun model and the reveal glow"
```

---

### Task 9: 弾の筋・しぶき・破片・♪ と効果音

**Files:**

- Create: `src/lib/games/yappari-chameleon/effects.ts`
- Modify: `src/lib/games/yappari-chameleon/sounds.ts`（全体を置き換える）
- Test: `src/lib/games/yappari-chameleon/effects.test.ts`

**Interfaces:**

- Consumes: `rng`（`textures.ts`）、`bus`・`noise`・`sfx`・`sweep`・`tone`（`$lib/audio.svelte`）。
- Produces: `SPLATS = 60`、`class Effects { constructor(scene); trail(o, ends); splat(p, n); splats; shatter(at, colors); note(at); clear(); step(dt); dispose() }`、`sounds.shot`・`sounds.shatter`・`sounds.found`・`sounds.intro`・`sounds.phase`・`sounds.whistle(rel: V3)`（`rel` は聞く人のカメラから見た位置。右が +x、前が −z）。1 段めの `spray`・`cling`・`pick`・`done`・`button` はそのまま。

口笛は `bus()` の AudioContext に `PannerNode` を挟んで鳴らし、`bus()` が無い（wake 前・ミュート中）ときは鳴らさない。

- [ ] **Step 1: 落ちるテストを書く**

canvas の模様を作るので、テストは happy-dom で動かす。

`src/lib/games/yappari-chameleon/effects.test.ts`:

```ts
// @vitest-environment happy-dom
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Effects, SPLATS } from './effects';

describe('Effects', () => {
  it('しぶきは 1 試合で 60 枚まで残し、超えたら古いものから消す。試合の始めに消す', () => {
    const scene = new THREE.Scene();
    const fx = new Effects(scene);
    for (let i = 0; i < SPLATS + 5; i++) fx.splat([i, 1, 0], [0, 0, 1]);
    expect(fx.splats).toBe(SPLATS);
    expect(scene.children).toHaveLength(SPLATS);
    fx.clear();
    expect(scene.children).toHaveLength(0);
  });

  it('弾の筋は 0.3 秒、破片は 1.5 秒、♪ は 2 秒で消える', () => {
    const scene = new THREE.Scene();
    const fx = new Effects(scene);
    fx.trail([0, 1, 0], [[0, 1, 5]]);
    fx.shatter([0, 1, 0], Array(20).fill([1, 1, 1]));
    fx.note([0, 0, 0]);
    expect(scene.children).toHaveLength(1 + 20 + 1);
    fx.step(0.31);
    expect(scene.children).toHaveLength(21);
    fx.step(1.2);
    expect(scene.children).toHaveLength(1);
    fx.step(0.5);
    expect(scene.children).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/effects.test.ts`
Expected: FAIL（`./effects` が無い）。

- [ ] **Step 3: 演出を書く**

`src/lib/games/yappari-chameleon/effects.ts`:

```ts
import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { rng } from './textures';

/** 1 試合で残すしぶきの数。超えたら古いものから消す */
export const SPLATS = 60;
const TRAIL_SECS = 0.3;
const BITS_SECS = 1.5;
const NOTE_SECS = 2;
const TRAIL_POINTS = 28;

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 白とカラフルの飛び散り。まん中の大きなしみのまわりに小さな粒を散らす */
function splatTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (g) => {
    const r = rng(17);
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2;
      const d = i < 6 ? r() * 40 : 50 + r() * 70;
      g.fillStyle = i % 3 ? '#ffffff' : `hsl(${Math.floor(r() * 360)} 90% 58%)`;
      g.beginPath();
      g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, i < 6 ? 30 + r() * 30 : 4 + r() * 10, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 白い ♪ に黒いふち */
function noteTexture(): THREE.CanvasTexture {
  return canvasTexture(128, (g) => {
    g.font = 'bold 100px "Hiragino Mincho ProN", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeStyle = '#000';
    g.fillStyle = '#fff';
    g.strokeText('♪', 64, 68);
    g.fillText('♪', 64, 68);
  });
}

interface Aging<T> {
  o: T;
  age: number;
}

/** 弾の虹色の粒の筋・しぶき・砕けた破片・口笛の ♪。どれも全員の画面に出る */
export class Effects {
  readonly #scene: THREE.Scene;
  readonly #splatMat = new THREE.MeshBasicMaterial({
    map: splatTexture(),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4
  });
  readonly #splatGeo = new THREE.PlaneGeometry(0.45, 0.45);
  readonly #bitGeo = new THREE.IcosahedronGeometry(0.045, 0);
  readonly #noteMat = new THREE.SpriteMaterial({ map: noteTexture(), transparent: true, depthTest: false });
  #trails: Aging<THREE.Points>[] = [];
  #splats: THREE.Mesh[] = [];
  #bits: Aging<{ mesh: THREE.Mesh; v: THREE.Vector3 }[]>[] = [];
  #notes: Aging<{ sprite: THREE.Sprite; y: number }>[] = [];

  constructor(scene: THREE.Scene) {
    this.#scene = scene;
  }

  /** 撃った所から 5 本の線の行き先まで、虹色の粒を並べる */
  trail(o: V3, ends: V3[]): void {
    const pos = new Float32Array(ends.length * TRAIL_POINTS * 3);
    const col = new Float32Array(pos.length);
    const c = new THREE.Color();
    let k = 0;
    for (const end of ends)
      for (let i = 0; i < TRAIL_POINTS; i++, k += 3) {
        const t = (i + Math.random() * 0.5) / TRAIL_POINTS;
        for (let a = 0; a < 3; a++) pos[k + a] = o[a] + (end[a] - o[a]) * t + (Math.random() - 0.5) * 0.04;
        c.setHSL(Math.random(), 0.9, 0.6);
        col.set([c.r, c.g, c.b], k);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, depthWrite: false })
    );
    this.#scene.add(points);
    this.#trails.push({ o: points, age: 0 });
  }

  /** 外れた線が当たった面に、しぶきの板を残す */
  splat(p: V3, n: V3): void {
    const m = new THREE.Mesh(this.#splatGeo, this.#splatMat);
    m.position.set(p[0] + n[0] * 0.004, p[1] + n[1] * 0.004, p[2] + n[2] * 0.004);
    m.lookAt(p[0] + n[0], p[1] + n[1], p[2] + n[2]);
    m.rotateZ(Math.random() * Math.PI * 2);
    m.scale.setScalar(0.7 + Math.random() * 0.6);
    this.#scene.add(m);
    this.#splats.push(m);
    if (this.#splats.length > SPLATS) this.#splats.shift()!.removeFromParent();
  }

  get splats(): number {
    return this.#splats.length;
  }

  /** 撃たれた人が 20 個ほどの破片に砕けて飛び散る */
  shatter(at: V3, colors: RGB[]): void {
    const bits = colors.map((c) => {
      const mesh = new THREE.Mesh(
        this.#bitGeo,
        new THREE.MeshStandardMaterial({ color: new THREE.Color(...c), roughness: 0.6, transparent: true })
      );
      mesh.position.set(
        at[0] + (Math.random() - 0.5) * 0.3,
        at[1] + (Math.random() - 0.3) * 0.6,
        at[2] + (Math.random() - 0.5) * 0.3
      );
      mesh.scale.setScalar(0.6 + Math.random() * 0.9);
      this.#scene.add(mesh);
      const a = Math.random() * Math.PI * 2;
      const v = new THREE.Vector3(Math.cos(a) * 2.2, 1.5 + Math.random() * 2.5, Math.sin(a) * 2.2).multiplyScalar(
        0.5 + Math.random() * 0.7
      );
      return { mesh, v };
    });
    this.#bits.push({ o: bits, age: 0 });
  }

  /** 口笛を吹いた人のだいたいの位置（水平に 2m 以内でずらす）に ♪ を浮かべる */
  note(at: V3): void {
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * 2;
    const sprite = new THREE.Sprite(this.#noteMat.clone());
    sprite.position.set(at[0] + Math.cos(a) * d, at[1] + 1.3, at[2] + Math.sin(a) * d);
    sprite.scale.setScalar(0.45);
    sprite.renderOrder = 30;
    this.#scene.add(sprite);
    this.#notes.push({ o: { sprite, y: sprite.position.y }, age: 0 });
  }

  /** 試合の始めとロビーに戻ったとき、しぶきを消す */
  clear(): void {
    for (const m of this.#splats) m.removeFromParent();
    this.#splats = [];
  }

  step(dt: number): void {
    this.#trails = this.#trails.filter((t) => {
      t.age += dt;
      (t.o.material as THREE.PointsMaterial).opacity = 1 - t.age / TRAIL_SECS;
      if (t.age < TRAIL_SECS) return true;
      t.o.removeFromParent();
      t.o.geometry.dispose();
      (t.o.material as THREE.Material).dispose();
      return false;
    });
    this.#bits = this.#bits.filter((b) => {
      b.age += dt;
      for (const { mesh, v } of b.o) {
        v.y -= 9.8 * dt;
        mesh.position.addScaledVector(v, dt);
        mesh.rotation.x += dt * 6;
        (mesh.material as THREE.MeshStandardMaterial).opacity = Math.min(1, (BITS_SECS - b.age) * 3);
      }
      if (b.age < BITS_SECS) return true;
      for (const { mesh } of b.o) {
        mesh.removeFromParent();
        (mesh.material as THREE.Material).dispose();
      }
      return false;
    });
    this.#notes = this.#notes.filter((n) => {
      n.age += dt;
      n.o.sprite.position.y = n.o.y + n.age * 0.25;
      n.o.sprite.material.opacity = Math.min(1, (NOTE_SECS - n.age) * 2);
      if (n.age < NOTE_SECS) return true;
      n.o.sprite.removeFromParent();
      n.o.sprite.material.dispose();
      return false;
    });
  }

  dispose(): void {
    this.step(Infinity);
    this.clear();
    this.#splatMat.map?.dispose();
    this.#splatMat.dispose();
    this.#splatGeo.dispose();
    this.#bitGeo.dispose();
    this.#noteMat.map?.dispose();
    this.#noteMat.dispose();
  }
}
```

- [ ] **Step 4: 効果音を足す**

`src/lib/games/yappari-chameleon/sounds.ts` を次に置き換える。

```ts
import { bus, noise, sfx, sweep, tone } from '$lib/audio.svelte';
import type { V3 } from '$lib/sculpt';

/** 口笛の上がる 2 音。rel は聞く人のカメラから見た位置（右が +x、前が −z）で、PannerNode が左右と大きさを変える */
function whistle(rel: V3): void {
  const ctx = bus();
  if (!ctx) return;
  const pan = new PannerNode(ctx, {
    panningModel: 'equalpower',
    distanceModel: 'inverse',
    refDistance: 2,
    maxDistance: 40,
    rolloffFactor: 1,
    positionX: rel[0],
    positionY: rel[1],
    positionZ: rel[2]
  });
  pan.connect(ctx.destination);
  for (const [i, [from, to]] of [
    [1100, 1500],
    [1400, 1900]
  ].entries()) {
    const at = ctx.currentTime + i * 0.16;
    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: from });
    const amp = new GainNode(ctx, { gain: 0 });
    osc.frequency.exponentialRampToValueAtTime(to, at + 0.14);
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(0.18, at + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + 0.15);
    osc.connect(amp).connect(pan);
    osc.start(at);
    osc.stop(at + 0.16);
  }
}

/** 本家に声は無いので、効果音だけにする */
export const sounds = {
  spray: () => noise(120, 0.05),
  cling: () => tone(140, 70, 'sine', 0.2),
  pick: () => sweep(500, 1100, 120, 0.1),
  done: () => sfx.finish(),
  button: () => tone(660, 40, 'triangle', 0.08),
  // 本家は銃声を小さくした版がある（「銃声怖っ」）。短く小さめに
  shot: () => noise(90, 0.12),
  shatter: () => {
    noise(260, 0.16);
    sweep(900, 220, 300, 0.07);
  },
  found: () => sweep(500, 1300, 220, 0.1),
  intro: () => sfx.start(),
  phase: () => tone(523, 180, 'triangle', 0.1),
  whistle
};
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。`play.svelte.test.ts` は `$lib/audio.svelte` を `bus` 抜きで mock しているが、`bus` は口笛を鳴らすときにしか読まないので通る。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/effects.ts src/lib/games/yappari-chameleon/effects.test.ts src/lib/games/yappari-chameleon/sounds.ts
git commit -m "Add rainbow shot trails, capped paint splats, shatter bits, whistle notes and their sounds"
```

---

### Task 10: ハンターと観戦の一人称

**Files:**

- Create: `src/lib/games/yappari-chameleon/hunter.ts`
- Modify: `src/lib/games/yappari-chameleon/play.svelte.ts`（`role`・`crouch`・`watch`・`placeAt`・`hunt`・`spectate`・`freeCam`・`unhunt`）
- Test: `src/lib/games/yappari-chameleon/play.svelte.test.ts`（役のテストを足す）

**Interfaces:**

- Consumes: `gunModel`・`MUZZLE`（`gun.ts`）、`World.overlay`・`World.hand`・`World.camera`。
- Produces: `class HunterView { constructor(world); visible; fire(); muzzle(): V3; step(dt) }`、`play.svelte.ts` の `CROUCH = 0.45`・`type PlayRole = 'hider' | 'hunter' | 'watch'`・`Play.role`・`Play.crouch`・`Play.watch: V3 | null`・`Play.placeAt(at, yaw?)`・`Play.hunt(at, yaw)`・`Play.spectate()`・`Play.freeCam()`・`Play.unhunt()`。

ハンターと観戦は、1 段めのフリーカメラ（`mode: 'eye'`、`ghost` の体で歩く、跳んでも壁に張り付かない）をそのまま使い、`toggleEye` では抜けない。観戦で `watch` が入っているあいだは、その人の体の真ん中のまわりを三人称で回る。ひとりで試す（`role` が `hider` のまま）の動きは変えない。

- [ ] **Step 1: 落ちるテストを足す**

```diff
--- a/src/lib/games/yappari-chameleon/play.svelte.test.ts
+++ b/src/lib/games/yappari-chameleon/play.svelte.test.ts
@@ -3,7 +3,7 @@
 import type { Level } from './move';
 import { RADIUS } from './move';
 import type { Dab } from './paint';
-import { Play } from './play.svelte';
+import { CROUCH, Play } from './play.svelte';
 import type { World } from './world3d';

 vi.mock('./doll3d', () => ({
@@ -514,5 +514,47 @@
     const p = new Play(w, 70);
     p.togglePaint();
     expect(p.orbitDist).toBe(1.2);
+  });
+});
+
+describe('Play の役', () => {
+  it('ハンターになると、その場所から一人称で歩き、フリーカメラのボタンでは抜けない', () => {
+    const w = fakeWorld();
+    const p = new Play(w, 70);
+    p.hunt([2, 0, 1], 0.5);
+    expect(p.role).toBe('hunter');
+    expect(p.mode).toBe('eye');
+    expect(p.ghost.pos).toEqual([2, 0, 1]);
+    expect(p.eyeYaw).toBe(0.5);
+    p.toggleEye();
+    expect(p.mode).toBe('eye');
+    p.unhunt();
+    expect(p.role).toBe('hider');
+    expect(p.mode).toBe('walk');
+  });
+
+  it('しゃがむと目の高さを下げる', () => {
+    const w = fakeWorld();
+    const p = new Play(w, 70);
+    p.hunt([0, 0, 0], 0);
+    secs(p, 0.5);
+    const stand = vi.mocked(w.eye).mock.lastCall![0][1];
+    p.crouch = true;
+    p.frame(1 / 60, 0);
+    expect(vi.mocked(w.eye).mock.lastCall![0][1]).toBeCloseTo(stand - CROUCH, 5);
   });
+
+  it('観戦では見ている人のまわりを回り、その人がいなければフリーカメラで歩く', () => {
+    const w = fakeWorld();
+    const p = new Play(w, 70);
+    p.spectate();
+    p.watch = [3, 0.6, 2];
+    vi.mocked(w.follow).mockClear();
+    p.frame(1 / 60, 0);
+    expect(vi.mocked(w.follow).mock.lastCall![0]).toEqual([3, 0.6, 2]);
+    p.freeCam();
+    vi.mocked(w.eye).mockClear();
+    p.frame(1 / 60, 0);
+    expect(w.eye).toHaveBeenCalled();
+  });
 });
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/play.svelte.test.ts`
Expected: FAIL（`CROUCH` と `hunt` が無い）。

- [ ] **Step 3: `Play` に役を足す**

```diff
--- a/src/lib/games/yappari-chameleon/play.svelte.ts
+++ b/src/lib/games/yappari-chameleon/play.svelte.ts
@@ -12,6 +12,8 @@
 const LOOK = 0.005;
 const ORBIT = 0.006;
 const EYE_HEIGHT = 1.0;
+/** ハンターがしゃがんだときに目を下げる高さ */
+export const CROUCH = 0.45;
 const CAM_PITCH_MIN = -0.5;
 const CAM_PITCH_MAX = 1.2;
 /** 天井では見る中心が天井の 0.4m 下なので、上から見ると天井にぶつかって距離がつぶれる。人形の下から見上げる範囲に収める */
@@ -22,8 +24,15 @@
 /** 見る中心が切り替わったときのずれが 1/e になる時間。0.3 秒でほぼ収まる */
 const SLIDE_SECS = 0.1;

+/** hider は隠れる人（1 人で試すときも）。hunter と watch（観戦）は一人称の作りで歩き、フリーカメラのボタンでは抜けない */
+export type PlayRole = 'hider' | 'hunter' | 'watch';
+
 export class Play {
   mode = $state<Mode>('walk');
+  role = $state<PlayRole>('hider');
+  crouch = $state(false);
+  /** 観戦で見ている人の体の真ん中。毎フレーム入れ直す。null ならフリーカメラで歩く */
+  watch: V3 | null = null;
   brush = $state<Brush>({ radius: 0.05, color: [1, 1, 1], opacity: 1, metal: 0, rough: 0.85 });
   previous = $state<RGB>([1, 1, 1]);
   recent = $state<RGB[]>([]);
@@ -120,16 +129,61 @@
   }

   toggleEye(): void {
+    if (this.role !== 'hider') return;
     if (this.mode === 'eye') return this.#setMode('walk');
-    // 三人称のカメラのいる所から歩き出す（壁の外へは出ない位置）
+    this.#ghostFromCamera();
+    this.eyeYaw = this.camYaw;
+    this.eyePitch = 0;
+    this.#setMode('eye');
+  }
+
+  /** 三人称のカメラのいる所から歩き出す（壁の外へは出ない位置）。天井や壁の高い所にいても、カメラの真下の床から */
+  #ghostFromCamera() {
     const c = this.world.camera.position;
-    // 天井や壁の高い所にいても、カメラの真下の床から歩き出す
     this.ghost = newBody([c.x, floorBelow(this.world.level, c.x, c.z, c.y), c.z]);
-    this.eyeYaw = this.camYaw;
+  }
+
+  /** 体をそこへ移す（試合の始めと、戻ったときの続きの場所） */
+  placeAt(at: V3, yaw = 0): void {
+    this.body = newBody(at);
+    this.body.yaw = yaw;
+  }
+
+  /** ハンターになる。at から一人称で歩き、体は描かない。置いてきた体も同じ所へ移す（張り付いたまま残さない） */
+  hunt(at: V3, yaw: number): void {
+    this.role = 'hunter';
+    this.crouch = false;
+    this.watch = null;
+    this.placeAt(at, yaw);
+    this.ghost = newBody(at);
+    this.eyeYaw = yaw;
     this.eyePitch = 0;
     this.#setMode('eye');
   }

+  /** 観戦に入る。見る人は毎フレーム watch に入れる */
+  spectate(): void {
+    this.role = 'watch';
+    this.crouch = false;
+    this.#ghostFromCamera();
+    this.eyeYaw = this.mode === 'eye' ? this.eyeYaw : this.camYaw;
+    this.#setMode('eye');
+  }
+
+  /** 観戦のフリーカメラ。今のカメラの真下の床から歩き出す */
+  freeCam(): void {
+    this.watch = null;
+    this.#ghostFromCamera();
+  }
+
+  /** 隠れる人に戻る（ロビーと試合の始め） */
+  unhunt(): void {
+    this.role = 'hider';
+    this.crouch = false;
+    this.watch = null;
+    if (this.mode !== 'walk') this.#setMode('walk');
+  }
+
   setPose(id: string): void {
     const p = id === STAND.id ? STAND : poseById(id);
     this.pose = p.id;
@@ -331,7 +385,7 @@
       this.eyePitch = Math.min(1.3, Math.max(-1.3, this.eyePitch + look.dy * LOOK));
       // 壁際で跳ぶと張り付いてしまうので、ふつうの跳び上がりのときだけ通す
       const jump = this.#jump && wallNear(this.ghost, w.level) === null;
-      step(this.ghost, { ...this.#input(this.eyeYaw), jump }, w.level, dt);
+      if (!this.watch) step(this.ghost, { ...this.#input(this.eyeYaw), jump }, w.level, dt);
     } else {
       const o = this.pad.takeOrbit();
       const look = this.pad.takeLook();
@@ -362,7 +416,20 @@
       w.follow(this.#focus(t, dt), this.camYaw, this.camPitch, 2.4, 60, dt, inside);
     } else if (this.mode === 'paint')
       w.follow(this.#focus(w.dollCenter(), dt), this.orbitYaw, this.orbitPitch, this.orbitDist, 60, dt, inside);
-    else w.eye([this.ghost.pos[0], this.ghost.pos[1] + EYE_HEIGHT, this.ghost.pos[2]], this.eyeYaw, this.eyePitch);
+    else if (this.watch)
+      w.follow(
+        this.watch,
+        this.eyeYaw,
+        Math.min(CAM_PITCH_MAX, Math.max(CAM_PITCH_MIN, this.eyePitch)),
+        2.4,
+        60,
+        dt,
+        this.watch
+      );
+    else {
+      const eye = EYE_HEIGHT - (this.crouch ? CROUCH : 0);
+      w.eye([this.ghost.pos[0], this.ghost.pos[1] + eye, this.ghost.pos[2]], this.eyeYaw, this.eyePitch);
+    }
     if (this.mode !== 'paint' || (!this.#stroke && now > this.#cursorUntil)) w.cursor(null, 0);
     // 張り付いているあいだは体が面に載っているので、その面を透かすと穴があくだけになる
     w.xray(this.mode !== 'eye' && !this.body.cling);
```

- [ ] **Step 4: 一人称の手と銃を書く**

`src/lib/games/yappari-chameleon/hunter.ts`:

```ts
import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import { gunModel, MUZZLE } from './gun';
import type { World } from './world3d';

/** 撃ったときに銃が跳ねて戻るまで */
const KICK_SECS = 0.25;
const REST: V3 = [0.17, -0.17, -0.38];

/** ハンターの一人称の手と銃。画面の右下に白い丸い手と銃を出し、撃つと少し跳ねる */
export class HunterView {
  readonly #world: World;
  readonly #gun = gunModel();
  #kick = 0;

  constructor(world: World) {
    this.#world = world;
    const hand = new THREE.MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.85 });
    const right = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), hand);
    const left = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), hand);
    right.position.set(0.005, -0.075, 0.08);
    left.position.set(-0.01, -0.05, -0.2);
    this.#gun.add(right, left);
    this.#gun.position.set(...REST);
    this.#gun.rotation.y = 0.05;
    world.hand.add(this.#gun);
  }

  set visible(on: boolean) {
    this.#world.overlay.visible = on;
  }

  get visible(): boolean {
    return this.#world.overlay.visible;
  }

  fire(): void {
    this.#kick = KICK_SECS;
  }

  /** 銃口の位置（弾の筋を、画面の右下の銃口から引く）。カメラの今の向きで測る */
  muzzle(): V3 {
    const cam = this.#world.camera;
    const p = new THREE.Vector3(...MUZZLE)
      .applyEuler(this.#gun.rotation)
      .add(this.#gun.position)
      .applyQuaternion(cam.quaternion)
      .add(cam.position);
    return [p.x, p.y, p.z];
  }

  step(dt: number): void {
    this.#kick = Math.max(0, this.#kick - dt);
    const k = this.#kick / KICK_SECS;
    this.#gun.rotation.x = k * 0.35;
    this.#gun.position.z = REST[2] + k * 0.05;
  }
}
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（1 段めの `Play` のテストも全部通る）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/hunter.ts src/lib/games/yappari-chameleon/play.svelte.ts src/lib/games/yappari-chameleon/play.svelte.test.ts
git commit -m "Let Play act as a first-person hunter with crouch or a spectator, and add the hands and gun view"
```

---

### Task 11: 1 台ぶんの進め方

**Files:**

- Create: `src/lib/games/yappari-chameleon/session.svelte.ts`
- Test: `src/lib/games/yappari-chameleon/session.svelte.test.ts`

**Interfaces:**

- Consumes: `Party`・`Seat`、`DollRig`、`Effects`、`Glow`・`Shine`、`Host`、`HunterView`、`SPAWNS`、`Match`、`net.ts` の `CHAMELEON_VERSION`・`dabMessages`・`DabOutbox`・`SEND_MS`・`splice`・`unpackDabs`・`Me`、`Play`、`AIM`・`poseById`・`STAND`、`COOLDOWN`・`TOOT_GAP`・`Settings`・`View`、`paintColors`・`Remote`・`Show`、`capsules`・`fire`・`placement`・`Target`、`sounds`。
- Produces: `interface Plate { seat; x; y; wish }`、`interface Inbox { messages: Message[]; stop: () => void }`、`SHATTER_SECS = 1.5`、`class Session { party; play; match; host; cool; tootWait; watching; plates; mismatch; constructor(party, play, makeRig, host?, inbox?); next(dir); free(); frame(dt, now); wish(); ready(); canTaunt; taunt(); toggleCrouch(); shoot(); start(settings); restore(); dispose() }`。

役の切り替えは次のとおり。

| とき                     | 自分の端末ですること                                                                                     |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| 最初の様子が届いた       | 親から自分の体が届いていなければ始める場所へ移し、役に合わせる（戻ったハンターは続きの場所から）         |
| ロビー・紹介に入った     | 全員の塗りを白に戻し、しぶきを消し、隠れる人に戻して、大広間（紹介のハンターは控室）へ移す               |
| 探索に入った（ハンター） | 屋敷の入口（`SPAWNS.entrance`）から一人称と銃                                                            |
| 自分が見つかった         | 砕ける。ペイントモードなら抜ける。通常は観戦、増え鬼は 1.5 秒後に塗りを白に戻してハンター                |
| 答え合わせに入った       | 見つかった人は撃たれたときの体に戻して青く、見つかっていない隠れる人は赤く光る。観戦の人はフリーカメラへ |

ほかの人の体を描くか・銃を持つか・光るかは毎フレーム試合の様子から決める（`#show`）。自分の動きと塗りは、親から最初の様子が届いてから送る（戻った子が、親に残っていた自分の体を始める場所で上書きしない）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/session.svelte.test.ts`:

```ts
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import { SPAWNS } from './mansion/layout';
import type { Level } from './move';
import { DAB_LEN, packDabs, type Me } from './net';
import type { Dab } from './paint';
import { Play } from './play.svelte';
import { DEFAULTS, newMatch, view, type View } from './referee';
import { Session, SHATTER_SECS, type Inbox } from './session.svelte';
import type { World } from './world3d';

vi.mock('./doll3d', () => ({ restHit: () => ({ p: [0, 1, 0], n: [0, 0, 1] }) }));
vi.mock('$lib/audio.svelte', () => ({
  tone: vi.fn(),
  sweep: vi.fn(),
  noise: vi.fn(),
  bus: () => undefined,
  sfx: { start: vi.fn(), finish: vi.fn() }
}));
// 3D の部品は描かないので、何もしない物に替える
vi.mock('./effects', () => ({
  Effects: class {
    trail = vi.fn();
    splat = vi.fn();
    shatter = vi.fn();
    note = vi.fn();
    clear = vi.fn();
    step = vi.fn();
    dispose = vi.fn();
  }
}));
vi.mock('./hunter', () => ({
  HunterView: class {
    visible = false;
    fire = vi.fn();
    step = vi.fn();
    muzzle = () => [0, 1, 0];
  }
}));
vi.mock('./glow', () => ({
  Glow: class {
    set = vi.fn();
    dispose = vi.fn();
  }
}));
vi.mock('./remote', () => ({
  paintColors: () => [],
  Remote: class {
    rig = { root: new THREE.Group(), paint: { rebuild: vi.fn() } };
    log = [];
    shown: Me | null = null;
    push(me: Me) {
      this.shown = me;
    }
    dabs = vi.fn();
    clearPaint = vi.fn();
    update(_dt: number, _now: number, show: { visible: boolean }) {
      this.rig.root.visible = !!this.shown && show.visible;
    }
    center = () => (this.shown ? [...this.shown.pos] : null);
    head = () => null;
    colors = () => [];
    dispose = vi.fn();
  }
}));

/** 床と天井だけの広い部屋（大広間と控室の始める場所を含む） */
const level: Level = {
  boxes: [
    { min: [-40, -1, -40], max: [40, 0, 40] },
    { min: [-40, 6, -40], max: [40, 6.3, 40] }
  ],
  ramps: [],
  spawn: [0, 0, 1.5]
};

function fakeWorld() {
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
  return {
    level,
    camera,
    scene: new THREE.Scene(),
    rig: { root: new THREE.Group(), mesh: { receiveShadow: true }, paint: { rebuild: vi.fn(), apply: vi.fn() } },
    poses: { step: vi.fn(), to: vi.fn() },
    placeDoll: vi.fn(),
    follow: vi.fn(),
    eye: vi.fn(),
    render: vi.fn(),
    xray: vi.fn(),
    snapCamera: vi.fn(),
    holdBrush: vi.fn(),
    dollCenter: () => [0, 1, 0],
    pickBody: () => ({ object: {}, point: {}, normal: {} }),
    cursor: vi.fn(),
    screen: () => ({ x: 0, y: 0 }),
    dist: 2.25
  } as unknown as World;
}

function setup(me: Seat = 2, inbox?: Inbox) {
  let listener: (m: Message) => void = () => {};
  const acts: Message[] = [];
  const party = {
    me,
    host: false,
    members: [1, 2, 3],
    act: (m: Message) => acts.push(JSON.parse(JSON.stringify(m))),
    onTell: (l: (m: Message) => void) => {
      listener = l;
      return () => {};
    }
  } as unknown as Party;
  const play = new Play(fakeWorld(), 70);
  const s = new Session(party, play, () => ({}) as never, null, inbox);
  const tell = (m: Message) => listener(JSON.parse(JSON.stringify(m)));
  let clock = 0;
  const frames = (secs: number) => {
    for (let i = 0; i < Math.round(secs * 60); i++) s.frame(1 / 60, (clock += 1000 / 60));
  };
  return { s, play, acts, tell, frames };
}

/** 2 が隠れる人、3 がハンターの試合の様子 */
function at(phase: View['phase'], extra: Partial<View> = {}): Message {
  const v = view(newMatch());
  return {
    t: 'phase',
    view: { ...v, phase, settings: DEFAULTS, roles: { 1: 'hider', 2: 'hider', 3: 'hunter' }, first: [3], ...extra }
  };
}

const dab = (i: number): Dab => ({ p: [i / 100, 1, 0], n: [0, 0, 1], r: 0.05, c: [1, 0, 0], a: 0.3, m: 0, ro: 0.8 });

describe('Session の見つかった人', () => {
  it('ペイントモードのあいだに見つかったら、ペイントモードを抜けて観戦になる（通常）', () => {
    const { s, play, tell } = setup();
    tell(at('lobby'));
    tell(at('search', { settings: { ...DEFAULTS, mode: 'normal' } }));
    play.togglePaint();
    expect(play.mode).toBe('paint');
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0], body: undefined });
    expect(play.mode).toBe('eye');
    expect(play.role).toBe('watch');
    expect(s.play.world.rig.root.visible).toBe(true);
    s.frame(1 / 60, 0);
    expect(s.play.world.rig.root.visible).toBe(false);
  });

  it('増え鬼で見つかると、破片が消えたあと白い体のハンターになり、銃を持つ', () => {
    const { play, tell, frames } = setup();
    tell(at('lobby'));
    tell(at('search'));
    play.applyDabs([dab(0), dab(1)]);
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0] });
    tell(at('search', { roles: { 1: 'hider', 2: 'hunter', 3: 'hunter' }, found: [2] }));
    frames(SHATTER_SECS - 0.1);
    expect(play.role).toBe('hider');
    frames(0.2);
    expect(play.role).toBe('hunter');
    expect(play.log.dabs).toHaveLength(0);
  });
});

describe('Session の戻った子', () => {
  it('親に残っていた自分の体と塗りを受け取り、様子が届いてから、その場の動きを送り始める', () => {
    const { play, tell, frames, acts } = setup();
    tell({
      t: 'me',
      seat: 2,
      ms: 0,
      pos: [4, 0, 6],
      yaw: 1,
      cling: null,
      pose: 'curl',
      crouch: false,
      paint: false,
      look: [0, 0]
    });
    tell({ t: 'dabs', seat: 2, at: 0, d: packDabs([dab(0), dab(1), dab(2)]) });
    frames(0.2);
    expect(acts.filter((m) => m.t === 'me')).toEqual([]);
    tell(at('search'));
    expect(play.body.pos).toEqual([4, 0, 6]);
    expect(play.log.dabs).toHaveLength(3);
    frames(0.1);
    const me = acts.find((m) => m.t === 'me') as unknown as Me;
    expect(me.pos).toEqual([4, 0, 6]);
    expect(me.pose).toBe('curl');
    // 受け取った塗りは送り返さない
    expect(acts.filter((m) => m.t === 'dabs')).toEqual([]);
  });

  it('3D を作るあいだに届いていた体・塗り・様子も受け取る（つないだときからためておいた知らせ）', () => {
    const stop = vi.fn();
    const messages = [
      {
        t: 'me',
        seat: 2,
        ms: 0,
        pos: [5, 0, 2],
        yaw: 0,
        cling: null,
        pose: 'lie',
        crouch: false,
        paint: false,
        look: [0, 0]
      },
      { t: 'dabs', seat: 2, at: 0, d: packDabs([dab(0), dab(1)]) },
      at('search')
    ] as Message[];
    const { s, play } = setup(2, { messages, stop });
    expect(stop).toHaveBeenCalled();
    expect(s.match.synced).toBe(true);
    expect(play.body.pos).toEqual([5, 0, 2]);
    expect(play.log.dabs).toHaveLength(2);
  });

  it('答え合わせの最中に戻ると、見つかったときの体をその場に戻して見せる', () => {
    const { play, tell, frames } = setup();
    const body = { ms: 0, pos: [3, 0, 3], yaw: 0, cling: null, pose: 'lie', crouch: false, paint: false, look: [0, 0] };
    tell({ t: 'found', seat: 2, by: 0, at: [3, 0, 3], body, quiet: true });
    tell(at('reveal', { found: [2], winner: 'chameleon', settings: { ...DEFAULTS, mode: 'normal' } }));
    frames(0.1);
    expect(play.body.pos).toEqual([3, 0, 3]);
    expect(play.world.rig.root.visible).toBe(true);
  });
});

describe('Session の役の切り替え', () => {
  it('ハンターは紹介で控室へ、探索で屋敷の入口から一人称になる', () => {
    const { play, tell } = setup(3);
    tell(at('lobby'));
    tell(at('intro'));
    expect(play.body.pos).toEqual([...SPAWNS.room[3]]);
    tell(at('hide'));
    expect(play.role).toBe('hider');
    tell(at('search'));
    expect(play.role).toBe('hunter');
    expect(play.ghost.pos).toEqual([...SPAWNS.entrance[3]]);
  });

  it('ロビーに戻ると自分の塗りを白に戻し、相手の列も 0 から送り直す', () => {
    const { play, tell, frames, acts } = setup();
    tell(at('lobby'));
    play.applyDabs([dab(0)]);
    frames(0.1);
    tell(at('intro'));
    expect(play.log.dabs).toHaveLength(0);
    acts.length = 0;
    frames(0.1);
    expect(acts.find((m) => m.t === 'dabs')).toMatchObject({ at: 0, d: [] });
  });

  it('撃つと 2 秒は次を撃てず、隠れる人には撃てない', () => {
    const { s, tell, frames, acts } = setup(3);
    s.shoot();
    expect(acts.filter((m) => m.t === 'shot')).toHaveLength(0);
    tell(at('lobby'));
    tell(at('search'));
    s.shoot();
    s.shoot();
    expect(acts.filter((m) => m.t === 'shot')).toHaveLength(1);
    frames(2.05);
    s.shoot();
    expect(acts.filter((m) => m.t === 'shot')).toHaveLength(2);
    expect((acts.find((m) => m.t === 'shot')!.d as number[]).length).toBe(3);
  });

  it('観戦で見ている人が見えなくなったら次の人へ移り、誰もいなければフリーカメラ', () => {
    const { s, tell, frames } = setup();
    const me = (seat: Seat, x: number) => ({
      t: 'me',
      seat,
      ms: 0,
      pos: [x, 0, 0],
      yaw: 0,
      cling: null,
      pose: 'stand',
      crouch: false,
      paint: false,
      look: [0, 0]
    });
    tell(me(1, 1));
    tell(me(3, 3));
    tell(at('lobby'));
    tell(at('search', { settings: { ...DEFAULTS, mode: 'normal' } }));
    tell({ t: 'found', seat: 2, by: 3, at: [0, 1, 0] });
    frames(0.1);
    expect(s.watching).toBe(1);
    tell({ t: 'found', seat: 1, by: 3, at: [0, 1, 0] });
    tell(at('search', { settings: { ...DEFAULTS, mode: 'normal' }, found: [2, 1] }));
    frames(0.1);
    expect(s.watching).toBe(3);
    expect(s.play.watch).toEqual([3, 0, 0]);
  });
});

describe('Session の送る量', () => {
  it('動きと塗りは 0.05 秒ごとにまとめて送る', () => {
    const { tell, frames, acts, play } = setup();
    tell(at('lobby'));
    for (let i = 0; i < 6; i++) {
      play.applyDabs([dab(i)]);
      frames(1 / 60);
    }
    frames(0.05);
    const sent = acts.filter((m) => m.t === 'dabs');
    expect(sent.length).toBeLessThanOrEqual(3);
    expect(sent.reduce((n, m) => n + (m.d as number[]).length, 0)).toBe(6 * DAB_LEN);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts`
Expected: FAIL（`./session.svelte` が無い）。

- [ ] **Step 3: 進め方を書く**

`src/lib/games/yappari-chameleon/session.svelte.ts`:

```ts
import { SvelteMap } from 'svelte/reactivity';
import * as THREE from 'three';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import type { V3 } from '$lib/sculpt';
import type { DollRig } from './doll3d';
import { Effects } from './effects';
import { Glow, type Shine } from './glow';
import type { Host } from './host';
import { HunterView } from './hunter';
import { SPAWNS } from './mansion/layout';
import { Match } from './match.svelte';
import { CHAMELEON_VERSION, dabMessages, DabOutbox, SEND_MS, splice, unpackDabs, type Me } from './net';
import type { Play } from './play.svelte';
import { AIM, poseById, STAND } from './poses';
import { COOLDOWN, TOOT_GAP, type Settings, type View } from './referee';
import { paintColors, Remote, type Show } from './remote';
import { capsules, fire, placement, type Target } from './shots';
import { sounds } from './sounds';

/** 頭の上の名前の札（ロビーと答え合わせ） */
export interface Plate {
  seat: Seat;
  x: number;
  y: number;
  /** ハンター希望の赤い印 */
  wish: boolean;
}

/**
 * つないでから Session ができるまでに届いた知らせ。親は迎えてすぐ全員の体と塗りを送るが、3D を作るあいだはまだ聞く口が無いので、
 * つないだときからためておき、Session が受け継ぐ
 */
export interface Inbox {
  messages: Message[];
  stop: () => void;
}

/** 撃たれた人の破片が消えるまで。増え鬼では、そのあとハンターになる */
export const SHATTER_SECS = 1.5;

/**
 * つないで遊ぶ 1 台ぶん。親から届いた試合の様子で自分の役（隠れる・ハンター・観戦）を切り替え、
 * 自分の動きと塗りを送り、ほかの人の体・弾・しぶき・口笛を出す
 */
export class Session {
  readonly party: Party;
  readonly play: Play;
  readonly match: Match;
  readonly host: Host | null;
  /** 次を撃てるまでの残り秒 */
  cool = $state(0);
  /** 次の口笛を吹けるまでの残り秒 */
  tootWait = $state(0);
  /** 観戦で見ている人。null はフリーカメラ */
  watching = $state<Seat | null>(null);
  plates = $state.raw<Plate[]>([]);
  /** 親とこのゲームの版がちがった */
  mismatch = $state(false);
  readonly #makeRig: () => DollRig;
  readonly #remotes = new SvelteMap<Seat, Remote>();
  readonly #fx: Effects;
  readonly #gun: HunterView;
  readonly #glow: Glow;
  readonly #out = new DabOutbox();
  /** 見つかったときの体（答え合わせで、その場に戻して光らせる） */
  readonly #found = new SvelteMap<Seat, Me>();
  /** 砕けて見えない残り秒 */
  readonly #shatter = new SvelteMap<Seat, number>();
  #sent = -Infinity;
  /** 親から自分の体を受け取った（戻った子は、その場から続ける） */
  #own = false;
  readonly #stop: () => void;

  constructor(party: Party, play: Play, makeRig: () => DollRig, host: Host | null = null, inbox?: Inbox) {
    this.party = party;
    this.play = play;
    this.host = host;
    this.#makeRig = makeRig;
    this.match = new Match(() => party.me);
    const w = play.world;
    this.#fx = new Effects(w.scene);
    this.#gun = new HunterView(w);
    this.#glow = new Glow(w.rig);
    // ためていた口を外して、ためた知らせを順に入れてから聞き始める（間に知らせは割り込まない）
    inbox?.stop();
    this.#stop = party.onTell((m) => this.#receive(m));
    for (const m of inbox?.messages ?? []) this.#receive(m);
    // 親は自分の画面へも、子と同じ手順で全員の体と今の様子を送る
    if (host) host.welcome(party.me);
    else party.act({ t: 'hi', v: CHAMELEON_VERSION });
  }

  #remote(seat: Seat): Remote {
    let r = this.#remotes.get(seat);
    if (!r) this.#remotes.set(seat, (r = new Remote(this.#makeRig(), this.play.world.scene)));
    return r;
  }

  #receive(m: Message) {
    const seat = m.seat as Seat;
    const mine = seat === this.match.me;
    if (m.t === 'phase') this.#phase(m.view as View);
    else if (m.t === 'me') {
      if (!mine) this.#remote(seat).push(m as unknown as Me, performance.now());
      else if (!this.match.synced) this.#ownBody(m as unknown as Me);
    } else if (m.t === 'dabs') {
      if (!mine) this.#remote(seat).dabs(m.at as number, m.d as number[]);
      else if (!this.match.synced) this.#ownPaint(m.at as number, m.d as number[]);
    } else if (m.t === 'found') this.#onFound(seat, m.by as Seat, m.body as Me | undefined, m.quiet === true);
    else if (m.t === 'splat') this.#onSplat(m);
    else if (m.t === 'toot') this.#onToot(seat, m.at as V3);
    else if (m.t === 'chameleon-mismatch') this.mismatch = true;
  }

  /** 戻った子が、親に残っていた自分の体を受け取る */
  #ownBody(me: Me) {
    this.#own = true;
    this.play.placeAt(me.pos, me.yaw);
    this.play.body.cling = me.cling;
    this.play.setPose(me.pose === AIM.id ? STAND.id : me.pose);
  }

  #ownPaint(at: number, d: number[]) {
    if (splice(this.play.log.dabs, at, unpackDabs(d)) === null) return;
    this.play.rebuildPaint();
    this.#out.adopt(this.play.log);
  }

  #phase(v: View) {
    const first = !this.match.synced;
    const before = this.match.phase;
    this.match.receive(v);
    if (first) {
      if (!this.#own) this.#place();
      this.#fit(this.#own ? (this.play.body.pos as V3) : null);
      if (v.phase === 'reveal') this.#reveal();
    } else if (before !== v.phase) this.#enter();
  }

  #enter() {
    const p = this.match.phase;
    if (p === 'lobby' || p === 'intro') {
      this.#reset();
      this.#place();
    }
    if (p === 'intro') sounds.intro();
    else sounds.phase();
    this.#fit(null);
    if (p === 'reveal') this.#reveal();
  }

  /** 試合の始めとロビーに戻ったとき。全員の塗りを白に戻し、しぶきを消す */
  #reset() {
    this.play.log.clear();
    this.play.rebuildPaint();
    this.play.canUndo = false;
    for (const r of this.#remotes.values()) r.clearPaint();
    this.#fx.clear();
    this.#found.clear();
    this.#shatter.clear();
    this.watching = null;
    this.play.unhunt();
    this.play.setPose(STAND.id);
  }

  /** 体を始める場所へ移す。待っているハンターは控室、ほかは大広間 */
  #place() {
    const p = this.match.phase;
    const room = this.match.role === 'hunter' && (p === 'intro' || p === 'hide');
    this.play.placeAt(SPAWNS[room ? 'room' : 'hall'][this.match.me]);
  }

  /** 試合の様子に合わせて、ハンター（一人称と銃）か観戦に切り替える。at は戻った子のハンターの続きの場所 */
  #fit(at: V3 | null) {
    const m = this.match;
    const armed = m.role === 'hunter' && (m.phase === 'search' || m.phase === 'reveal');
    if (armed && this.play.role !== 'hunter' && !this.#shatter.has(m.me))
      this.play.hunt(at ?? SPAWNS.entrance[m.me], 0);
    else if (!armed && m.phase !== 'lobby' && m.watching() && this.play.role !== 'watch') this.#watch();
  }

  #reveal() {
    const f = this.#found.get(this.match.me);
    if (f) {
      this.play.placeAt(f.pos, f.yaw);
      this.play.body.cling = f.cling;
      this.play.setPose(f.pose === AIM.id ? STAND.id : f.pose);
    }
    if (this.play.role === 'watch') this.free();
  }

  #onFound(seat: Seat, by: Seat, body: Me | undefined, quiet: boolean) {
    if (body) this.#found.set(seat, body);
    if (quiet) return;
    const me = this.match.me;
    const infect = this.match.view.settings.mode === 'infect';
    const r = seat === me ? null : this.#remote(seat);
    const at = r ? r.center() : this.play.world.dollCenter();
    if (at) this.#fx.shatter(at, r ? r.colors() : paintColors(this.play.log.dabs));
    sounds.shatter();
    if (by === me) sounds.found();
    this.#shatter.set(seat, SHATTER_SECS);
    if (seat !== me) return;
    // ペイントモードのあいだに見つかったら、ペイントモードを抜ける（本家 v1.4.0）
    if (this.play.mode === 'paint') this.play.togglePaint();
    this.play.interrupt();
    if (!infect) this.#watch();
  }

  /** 増え鬼で見つかった自分が、破片が消えたあと白い体のハンターになる */
  #turn() {
    this.play.log.clear();
    this.play.rebuildPaint();
    this.play.hunt(this.play.body.pos as V3, this.play.body.yaw);
  }

  #onSplat(m: Message) {
    if (m.by !== this.match.me) {
      this.#fx.trail(m.from as V3, m.ends as V3[]);
      sounds.shot();
    }
    for (const k of m.marks as { p: V3; n: V3 }[]) this.#fx.splat(k.p, k.n);
  }

  #onToot(seat: Seat, at: V3) {
    if (seat === this.match.me) return sounds.whistle([0, 0, -1]);
    this.#fx.note(at);
    const v = new THREE.Vector3(...at).applyMatrix4(this.play.world.camera.matrixWorldInverse);
    sounds.whistle([v.x, v.y, v.z]);
  }

  #watchable(): Seat[] {
    return [...this.#remotes]
      .filter(([, r]) => r.rig.root.visible)
      .map(([s]) => s)
      .sort((a, b) => a - b);
  }

  #watch() {
    this.play.spectate();
    this.watching = this.#watchable()[0] ?? null;
    if (this.watching === null) this.play.freeCam();
  }

  /** 観戦で、ほかの人を順に見る */
  next(dir: 1 | -1): void {
    const list = this.#watchable();
    if (!list.length) return this.free();
    const i = this.watching === null ? -1 : list.indexOf(this.watching);
    this.watching = list[(i + dir + list.length) % list.length];
  }

  /** 観戦のフリーカメラ */
  free(): void {
    this.watching = null;
    this.play.freeCam();
  }

  #show(seat: Seat): Show {
    const m = this.match;
    const p = m.phase;
    const role = m.roleOf(seat);
    const found = m.found(seat);
    const pin = p === 'reveal' && found ? (this.#found.get(seat) ?? null) : null;
    const away = !this.party.members.includes(seat) && (p === 'lobby' || role !== 'hider');
    const gone =
      away || role === 'out' || (found && !pin && (m.view.settings.mode === 'normal' || this.#shatter.has(seat)));
    return {
      pin,
      visible: !gone,
      armed: !pin && role === 'hunter' && (p === 'search' || p === 'reveal'),
      shine: this.#shine(seat)
    };
  }

  #shine(seat: Seat): Shine {
    if (this.match.phase !== 'reveal') return null;
    if (this.match.found(seat)) return 'blue';
    return this.match.roleOf(seat) === 'hider' ? 'red' : null;
  }

  frame(dt: number, now: number): void {
    const m = this.match;
    const me = m.me;
    const w = this.play.world;
    m.advance(dt);
    this.cool = Math.max(0, this.cool - dt);
    this.tootWait = Math.max(0, this.tootWait - dt);
    for (const [seat, left] of this.#shatter) {
      if (left > dt) {
        this.#shatter.set(seat, left - dt);
        continue;
      }
      this.#shatter.delete(seat);
      if (seat === me && m.view.settings.mode === 'infect' && m.phase === 'search') this.#turn();
    }
    for (const [seat, r] of this.#remotes) r.update(dt, now, this.#show(seat));
    if (this.play.role === 'watch' && this.watching !== null) {
      const r = this.#remotes.get(this.watching);
      if (!r?.rig.root.visible) this.next(1);
    }
    this.play.watch =
      this.play.role === 'watch' && this.watching !== null ? this.#remotes.get(this.watching)!.center() : null;
    const pinned = m.phase === 'reveal' && m.found() && this.#found.has(me);
    w.rig.root.visible = (this.play.role === 'hider' && !this.#shatter.has(me)) || pinned;
    this.#glow.set(w.rig.root.visible ? this.#shine(me) : null);
    this.#gun.visible = this.play.role === 'hunter';
    this.#fx.step(dt);
    this.#gun.step(dt);
    this.play.frame(dt, now);
    this.#plates();
    if (m.synced && now - this.#sent >= SEND_MS) {
      this.#sent = now;
      this.#post(now);
    }
  }

  #me(now: number): Me | null {
    const p = this.play;
    if (p.role === 'watch' || this.#shatter.has(this.match.me)) return null;
    if (p.role === 'hunter')
      return {
        ms: now,
        pos: [...p.ghost.pos],
        yaw: p.eyeYaw,
        cling: null,
        pose: p.crouch ? 'crouch' : AIM.id,
        crouch: p.crouch,
        paint: false,
        look: [p.eyeYaw, p.eyePitch]
      };
    return {
      ms: now,
      pos: [...p.body.pos],
      yaw: p.body.yaw,
      cling: p.body.cling,
      pose: p.pose,
      crouch: false,
      paint: p.mode === 'paint',
      look: [p.camYaw, p.camPitch]
    };
  }

  #post(now: number) {
    const me = this.#me(now);
    if (me) this.party.act({ t: 'me', ...me });
    const d = this.#out.take(this.play.log);
    if (d) for (const msg of dabMessages(this.match.me, d.at, d.d)) this.party.act(msg);
  }

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
      if (at) out.push({ seat, ...at, wish: p === 'lobby' && this.match.view.wishes.includes(seat) });
    };
    if (w.rig.root.visible) {
      const h = w.rig.root.localToWorld(new THREE.Vector3(0, 1.35, 0));
      add(this.match.me, [h.x, h.y, h.z]);
    }
    for (const [seat, r] of this.#remotes) if (r.rig.root.visible) add(seat, r.head());
    this.plates = out;
  }

  /** ハンター希望を切り替える（ロビーだけ） */
  wish(): void {
    if (this.match.phase !== 'lobby') return;
    this.party.act({ t: 'wish', on: !this.match.view.wishes.includes(this.match.me) });
  }

  /** もうええよ（隠れタイムと答え合わせ） */
  ready(): void {
    const m = this.match;
    if ((m.phase === 'hide' || m.phase === 'reveal') && !m.view.ready.includes(m.me)) this.party.act({ t: 'ready' });
  }

  /** 挑発できるか（ロビーでは全員、試合中は見つかっていない隠れる人） */
  get canTaunt(): boolean {
    return this.match.phase === 'lobby' || this.match.hiding;
  }

  taunt(): void {
    if (this.tootWait > 0 || !this.canTaunt) return;
    this.tootWait = TOOT_GAP;
    this.party.act({ t: 'taunt' });
  }

  toggleCrouch(): void {
    if (this.play.role === 'hunter') this.play.crouch = !this.play.crouch;
  }

  /** 十字の向きへ撃つ。当たりは親が決め、ここでは筋を引いて、当たったと見た人を参考に送る */
  shoot(): void {
    if (this.cool > 0 || this.play.role !== 'hunter') return;
    this.cool = COOLDOWN;
    const cam = this.play.world.camera;
    const dir = cam.getWorldDirection(new THREE.Vector3());
    const o: V3 = [cam.position.x, cam.position.y, cam.position.z];
    const d: V3 = [dir.x, dir.y, dir.z];
    const targets: Target[] = [];
    for (const [seat, r] of this.#remotes)
      if (r.shown && r.rig.root.visible && this.match.roleOf(seat) === 'hider')
        targets.push({ seat, caps: capsules(poseById(r.shown.pose), placement(r.shown)) });
    const rays = fire(this.play.world.level, o, d, targets);
    const from = this.#gun.muzzle();
    this.#fx.trail(
      from,
      rays.map((r) => r.end)
    );
    this.#gun.fire();
    sounds.shot();
    const saw = rays.find((r) => r.seat !== null)?.seat ?? null;
    this.party.act({ t: 'shot', o, d, from, ms: performance.now(), saw });
  }

  start(settings: Settings): void {
    this.host?.start(settings);
  }

  /** WebGL のコンテキストが戻った。全員の塗りを列から作り直す */
  restore(): void {
    this.play.rebuildPaint();
    for (const r of this.#remotes.values()) r.rig.paint.rebuild(r.log);
  }

  dispose(): void {
    this.#stop();
    for (const r of this.#remotes.values()) r.dispose();
    this.#fx.dispose();
    this.#glow.dispose();
  }
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts`
Expected: PASS。

- [ ] **Step 5: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/session.svelte.ts src/lib/games/yappari-chameleon/session.svelte.test.ts
git commit -m "Drive one device in a match: switch roles from the host's view, send moves and paint, shoot and spectate"
```

---

### Task 12: 3D の土台を分ける

**Files:**

- Create: `src/lib/games/yappari-chameleon/stage3d.ts`
- Modify: `src/lib/games/yappari-chameleon/Chameleon.svelte`（`<script>` を `mount3d` と `touch` に置き換え、props を `onquit` だけにする）

**Interfaces:**

- Consumes: `World`、`makeDoll`、`buildDoll`、`layAtlas`、`buildMansion`、`COLOR_SIZE`、`animate`、`wake`、`Play`。
- Produces: `interface Hooks { ready(world, makeRig); frame(dt, now); interrupt(); restore(); fail(); portrait(on); dispose?() }`、`mount3d(canvas, box, hooks): () => void`、`touch(play, box, kind, e)`。`Chameleon.svelte` の props は `{ onquit?: () => void }`。

今の `Chameleon.svelte` の `onMount`（縦持ちで止める・大きさを合わせる・準備中を 1 度描かせてから作る・裏に回ったら指を捨てる・WebGL のコンテキストが戻ったら塗り直す・作れなければ理由を出す）を、そのまま `mount3d` へ移す。つないで遊ぶ画面（Task 15）が同じものを使う。

- [ ] **Step 1: テストが今のまま通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/Chameleon.svelte.test.ts`
Expected: PASS（3D を作れない端末で理由とタイトルへ戻る口を出す）。このテストを移したあとの確かめに使う。

- [ ] **Step 2: 土台を書く**

`src/lib/games/yappari-chameleon/stage3d.ts`:

```ts
import { wake } from '$lib/audio.svelte';
import { animate } from '$lib/loop';
import { layAtlas } from './atlas';
import { buildDoll } from './doll';
import { makeDoll, type DollRig } from './doll3d';
import { buildMansion } from './mansion/build';
import { COLOR_SIZE } from './paint-gpu';
import type { Play } from './play.svelte';
import { World } from './world3d';

export interface Hooks {
  /** 3D ができた。makeRig はほかの人の体を、自分と同じ面と升目で作る */
  ready(world: World, makeRig: () => DollRig): void;
  frame(dt: number, now: number): void;
  /** 縦持ちになった・裏に回った。押している指とボタンを捨てる */
  interrupt(): void;
  /** WebGL のコンテキストが戻った。塗りを列から作り直す */
  restore(): void;
  /** 3D を作れなかった */
  fail(): void;
  portrait(on: boolean): void;
  /** 3D を捨てる前に、上に載せた物を外す */
  dispose?(): void;
}

/**
 * 屋敷と人形の 3D を canvas に作り、横持ちのあいだだけ描く。1 人で試す画面とつないで遊ぶ画面が同じものを使う。
 * 戻り値で片付ける
 */
export function mount3d(canvas: HTMLCanvasElement, box: HTMLElement, h: Hooks): () => void {
  const mq = matchMedia('(orientation: portrait)');
  let stop: (() => void) | null = null;
  let world: World | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const size = () => world?.resize(box.clientWidth, box.clientHeight);
  const run = () => {
    stop?.();
    stop = null;
    h.portrait(mq.matches);
    if (mq.matches) h.interrupt();
    if (mq.matches || !world) return;
    size();
    stop = animate(h.frame);
  };
  const build = () => {
    const s = buildDoll();
    const atlas = layAtlas(s.pos, s.idx, COLOR_SIZE);
    try {
      world = new World(
        canvas,
        (r) => makeDoll(r, s, atlas),
        () => h.restore()
      );
    } catch {
      // WebGL2 が作れない端末やメモリ不足では、準備中のまま固まらず理由を見せる
      h.fail();
      return;
    }
    const w = world;
    w.setStage(buildMansion());
    size();
    h.ready(w, () => makeDoll(w.renderer, s, atlas));
    run();
  };
  // 人形の面と升目を作るのに数百 ms 止まるので、「準備中」を 1 度描かせてから作る
  const raf = requestAnimationFrame(() => (timer = setTimeout(build)));
  mq.addEventListener('change', run);
  // 裏に回ると pointerup が届かないことがあるので、押している指とボタンを捨てる
  const hide = () => document.hidden && h.interrupt();
  document.addEventListener('visibilitychange', hide);
  const ro = new ResizeObserver(size);
  ro.observe(box);
  return () => {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
    mq.removeEventListener('change', run);
    document.removeEventListener('visibilitychange', hide);
    ro.disconnect();
    stop?.();
    h.dispose?.();
    world?.dispose();
  };
}

/** 盤面の指を Play へ渡す。指を置いたときに音を起こし（iOS は操作の中でしか鳴らし始められない）、指を掴む */
export function touch(play: Play, box: HTMLElement, kind: 'down' | 'move' | 'up' | 'cancel', e: PointerEvent): void {
  if (kind === 'down') {
    wake();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // 合成イベントでは掴めないが、指の追跡は続けてよい
    }
  }
  const r = box.getBoundingClientRect();
  play.pointer(kind, e.pointerId, e.clientX - r.left, e.clientY - r.top, r.width);
}
```

- [ ] **Step 3: `Chameleon.svelte` を土台に載せる**

`src/lib/games/yappari-chameleon/Chameleon.svelte` を次に置き換える（`<div class="chameleon">` から下は今のまま）。

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import BrushSize from './BrushSize.svelte';
  import Buttons from './Buttons.svelte';
  import HideTimer from './HideTimer.svelte';
  import PaintPanel from './PaintPanel.svelte';
  import { Play } from './play.svelte';
  import PoseWheel from './PoseWheel.svelte';
  import { mount3d, touch } from './stage3d';
  import StickView from './StickView.svelte';

  let { onquit }: { onquit?: () => void } = $props();
  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let portrait = $state(false);
  let failed = $state(false);
  let play = $state.raw<Play | null>(null);
  const radius = 70;

  onMount(() =>
    mount3d(canvas, box, {
      ready: (world) => {
        play = new Play(world, radius);
        if (import.meta.env.DEV) (window as unknown as { __chameleon?: Play }).__chameleon = play;
      },
      frame: (dt, now) => play?.frame(dt, now),
      interrupt: () => play?.interrupt(),
      restore: () => play?.rebuildPaint(),
      fail: () => (failed = true),
      portrait: (on) => (portrait = on)
    })
  );

  function pointer(kind: 'down' | 'move' | 'up' | 'cancel', e: PointerEvent) {
    if (play) touch(play, box, kind, e);
  }
</script>

<div class="chameleon" bind:this={box}>
  <canvas bind:this={canvas}></canvas>
  <div
    class="pad"
    role="presentation"
    onpointerdown={(e) => pointer('down', e)}
    onpointermove={(e) => pointer('move', e)}
    onpointerup={(e) => pointer('up', e)}
    onpointercancel={(e) => pointer('cancel', e)}
  ></div>
  {#if play}
    {#if play.stick.active}
      <StickView ox={play.stick.ox} oy={play.stick.oy} x={play.stick.x} y={play.stick.y} r={radius} />
    {/if}
    {#if play.mode === 'paint'}
      <PaintPanel {play} />
      <BrushSize
        bind:value={play.brush.radius}
        onchange={() => play?.showCursor(box.clientWidth / 2, box.clientHeight / 2)}
      />
    {/if}
    {#if play.wheel}
      <PoseWheel {play} />
    {/if}
    {#if play.mode !== 'eye'}<HideTimer {play} />{/if}
    <Buttons {play} onquit={() => onquit?.()} />
  {:else if failed}
    <div class="notice failed">
      <p>この端末では 3D を表示できません</p>
      <button onclick={() => onquit?.()}>タイトルへ</button>
    </div>
  {:else}
    <p class="notice">準備中…</p>
  {/if}
  {#if portrait}
    <p class="notice cover">横向きにしてください</p>
  {/if}
</div>

<style>
  .chameleon {
    position: absolute;
    inset: 0;
    overflow: hidden;
    container-type: size;
    background: #1d1a17;
  }

  canvas,
  .pad {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .notice {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 28px;
    text-shadow: 0 2px 4px #000;
    pointer-events: none;
  }

  .failed {
    align-content: center;
    gap: 16px;
    pointer-events: auto;
  }

  .failed p {
    margin: 0;
  }

  .failed button {
    padding: 8px 24px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 24px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
    font-size: 18px;
  }

  .cover {
    background: #1d1a17;
    pointer-events: auto;
  }
</style>
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（`Chameleon.svelte.test.ts` の mock は `./world3d` などをそのまま差し替える）。

- [ ] **Step 5: ひとりで試すが今のまま動くことを撮って確かめる**

`pnpm dev --port 5180` を裏で起動し、scratchpad に次の `solo.mjs` を置いて `node <scratchpad>/solo.mjs "$PWD" <scratchpad>/solo` で撮る（この時点の meta はまだ `SoloMeta` なので、タイトルの「はじめる」から入る）。

```js
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const [repo, out] = process.argv.slice(2);
const { chromium } = createRequire(`${repo}/package.json`)('playwright-core');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5180/asobibako/games/yappari-chameleon');
await new Promise((r) => setTimeout(r, 1500));
await page.locator('button.go').click();
await page.waitForFunction(() => window.__chameleon, null, { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${out}/solo.png` });
await page.evaluate(() => window.__chameleon.togglePaint());
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${out}/solo-paint.png` });
await browser.close();
```

Expected: `pageerror` が出ず、`solo.png` に大広間と人形、`solo-paint.png` に色のパネルと絵筆を持った人形が写る（Task 12 の前と同じ見た目）。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/stage3d.ts src/lib/games/yappari-chameleon/Chameleon.svelte
git commit -m "Share the 3D mount between the solo screen and the coming online screen"
```

---

### Task 13: HUD・紹介・答え合わせ・もうええよ・名前の札

**Files:**

- Create: `src/lib/games/yappari-chameleon/Hud.svelte`
- Create: `src/lib/games/yappari-chameleon/Intro.svelte`
- Create: `src/lib/games/yappari-chameleon/Reveal.svelte`
- Create: `src/lib/games/yappari-chameleon/Ready.svelte`
- Create: `src/lib/games/yappari-chameleon/Plates.svelte`
- Test: `src/lib/games/yappari-chameleon/Hud.svelte.test.ts`

**Interfaces:**

- Consumes: `Session`（`match`・`play`・`party`・`ready()`）、`Match`、`MODES`・`WINNER`・`nameOf`、`Plate`、`Winner`、`Icon` の `figure`・`hourglass`。
- Produces: `Hud.svelte`（props `{ session }`）、`Intro.svelte`（`{ match }`）、`Reveal.svelte`（`{ winner }`）、`Ready.svelte`（`{ session }`）、`Plates.svelte`（`{ plates }`）。

本家の HUD の並び（上の中央に緑の砂の砂時計と残り秒とフェーズの言葉、左に隠れている人の白い人形、右にハンターの赤い人形、砂時計の右に次の強制挑発までの黄色の秒、隠れる人の右下に大きく「残り人数 N」、ハンターの右下にモード名と説明 2 行）。ペイントモードのあいだは上の残り秒だけを出す。答え合わせの画面いっぱいの緑のペンキの飾り文字は始めの 3 秒だけ見せて薄くし、白い字の「勝者…!」は出し続ける（飾り文字が答え合わせの 30 秒ずっと画面をふさぐと、全員の場所を見て回れない）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/Hud.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import Hud from './Hud.svelte';
import { Match } from './match.svelte';
import { DEFAULTS, newMatch, view, type View } from './referee';
import type { Session } from './session.svelte';

function show(me: Seat, v: Partial<View>, play: { mode?: string; role?: string } = {}) {
  const match = new Match(() => me);
  match.receive({ ...view(newMatch()), settings: DEFAULTS, roles: { 1: 'hider', 2: 'hider', 3: 'hunter' }, ...v });
  const session = { match, play: { mode: 'walk', role: 'hider', ...play } } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Hud, { target, props: { session } });
  flushSync();
  return { target, done: () => unmount(app) };
}

describe('Hud', () => {
  it('隠れる人には、残り秒・フェーズの言葉・人形・残り人数・強制挑発の秒を出す', () => {
    const { target, done } = show(1, { phase: 'search', left: 42.2, taunts: { 1: 7 } });
    expect(target.querySelector('.num')?.textContent).toBe('43');
    expect(target.textContent).toContain('隠れつづけよう');
    expect(target.querySelectorAll('.white svg')).toHaveLength(2);
    expect(target.querySelectorAll('.red svg')).toHaveLength(1);
    expect(target.querySelector('.left')?.textContent).toContain('残り人数 2');
    expect(target.querySelector('.taunt')?.textContent).toBe('7');
    done();
  });

  it('ハンターには残り人数の代わりに、モード名と説明 2 行を出す', () => {
    const { target, done } = show(3, { phase: 'search' }, { role: 'hunter' });
    expect(target.querySelector('.left')).toBeNull();
    expect(target.querySelector('.mode')?.textContent).toContain('増え鬼');
    expect(target.textContent).toContain('探索時間');
    done();
  });

  it('ペイントモードのあいだは上の残り秒だけ', () => {
    const { target, done } = show(1, { phase: 'hide', left: 30 }, { mode: 'paint' });
    expect(target.querySelector('.num')?.textContent).toBe('30');
    expect(target.querySelector('.word')).toBeNull();
    expect(target.querySelector('.dolls')).toBeNull();
    expect(target.querySelector('.left')).toBeNull();
    done();
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/Hud.svelte.test.ts`
Expected: FAIL（`./Hud.svelte` が無い）。

- [ ] **Step 3: HUD を書く**

`src/lib/games/yappari-chameleon/Hud.svelte`:

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { MODES } from './match.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const match = $derived(session.match);
  const play = $derived(session.play);
  const painting = $derived(play.mode === 'paint');
  const mode = $derived(MODES[match.view.settings.mode]);
</script>

<!-- 本家の HUD の並び。上の中央に砂時計と残り秒、左に隠れている人の白い人形、右にハンターの赤い人形 -->
<div class="top">
  {#if !painting}
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
    <span class="dolls red">
      {#each { length: match.hunters }, i (i)}<Icon name="figure" size="22px" />{/each}
    </span>
    {#if match.taunt !== null && match.phase === 'search'}
      <span class="taunt">{Math.ceil(match.taunt)}</span>
    {/if}
  {/if}
</div>

{#if !painting && match.phase !== 'intro'}
  {#if play.role === 'hunter'}
    <div class="mode">
      <span class="name">{mode.name}</span>
      <span>{mode.lines[0]}</span>
      <span>{mode.lines[1]}</span>
    </div>
  {:else if match.hiding}
    <p class="left">残り人数 <span class="big">{match.hiders}</span></p>
  {/if}
{/if}

<style>
  .top {
    position: absolute;
    top: max(8px, env(safe-area-inset-top));
    left: 50%;
    translate: -50% 0;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 1px 3px #000;
    pointer-events: none;
  }

  .clock {
    display: grid;
    justify-items: center;
    font-size: 15px;
  }

  .num {
    font-size: 40px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .dolls {
    display: flex;
    gap: 2px;
    margin-top: 6px;
  }

  .dolls.white {
    color: #fff;
  }

  .dolls.red {
    color: #ff3b30;
  }

  /* 本家の砂時計の右の黄色の小さな数字。次の強制挑発までの残り秒 */
  .taunt {
    margin-top: 8px;
    color: #ffd23f;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
  }

  .left,
  .mode {
    position: absolute;
    right: calc(max(14px, env(safe-area-inset-right)) + 110px);
    bottom: max(14px, env(safe-area-inset-bottom));
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 2px 4px #000;
    pointer-events: none;
  }

  .left {
    font-size: 22px;
  }

  .big {
    font-size: 64px;
    line-height: 1;
  }

  .mode {
    display: grid;
    justify-items: end;
    font-size: 15px;
  }

  .name {
    color: #7cc243;
    font-size: 26px;
  }
</style>
```

- [ ] **Step 4: 紹介・答え合わせ・もうええよ・名前の札を書く**

`src/lib/games/yappari-chameleon/Intro.svelte`:

```svelte
<script lang="ts">
  import { MODES, type Match } from './match.svelte';

  let { match }: { match: Match } = $props();
  const mode = $derived(MODES[match.view.settings.mode]);
</script>

{#if match.phase === 'intro'}
  <!-- 本家のモード紹介の黒い帯 -->
  <div class="band" role="status">
    <p class="name">{mode.name}</p>
    <p>{mode.lines[0]}</p>
    <p>{mode.lines[1]}</p>
  </div>
{:else if match.phase === 'hide'}
  <p class="splash">隠れタイム</p>
{/if}

<style>
  .band {
    position: absolute;
    top: 50%;
    right: 0;
    left: 0;
    translate: 0 -50%;
    display: grid;
    justify-items: center;
    gap: 4px;
    padding: 22px 0;
    background: rgb(0 0 0 / 0.78);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 20px;
    pointer-events: none;
  }

  .band p {
    margin: 0;
  }

  .name {
    color: #7cc243;
    font-size: min(9cqh, 7cqw);
  }

  .splash {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: min(12cqh, 9cqw);
    text-shadow: 0 3px 10px #000;
    pointer-events: none;
    animation: splash 1.8s forwards;
  }

  @keyframes splash {
    0%,
    60% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .splash {
      animation-duration: 0.01s;
      animation-delay: 1.2s;
    }
  }
</style>
```

`src/lib/games/yappari-chameleon/Reveal.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { WINNER } from './match.svelte';
  import type { Winner } from './referee';

  let { winner }: { winner: Winner } = $props();
  let canvas: HTMLCanvasElement;
  const text = $derived(WINNER[winner]);

  /** 同じ言葉を、緑のペンキを太い筆で塗ったような飾り文字にする。少しずつずらして重ね、下へ垂れを描く */
  function paint(g: CanvasRenderingContext2D, w: number, h: number) {
    const size = Math.min(h * 0.32, (w * 0.95) / [...text].length);
    g.font = `bold ${size}px "Hiragino Mincho ProN", serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    for (let i = 0; i < 6; i++) {
      g.strokeStyle = i % 2 ? '#3f9c2f' : '#5cbf3c';
      g.lineWidth = size * (0.16 - i * 0.015);
      g.strokeText(text, w / 2 + (Math.random() - 0.5) * size * 0.08, h / 2 + (Math.random() - 0.5) * size * 0.08);
    }
    g.fillStyle = '#4caf35';
    g.fillText(text, w / 2, h / 2);
    for (let i = 0; i < 26; i++) {
      const x = w / 2 + (Math.random() - 0.5) * size * [...text].length * 0.9;
      const y = h / 2 + size * 0.3;
      g.fillRect(x, y, size * 0.04, size * (0.2 + Math.random() * 0.7));
    }
  }

  onMount(() => {
    const r = canvas.getBoundingClientRect();
    canvas.width = r.width;
    canvas.height = r.height;
    const g = canvas.getContext('2d');
    if (g) paint(g, r.width, r.height);
  });
</script>

<!-- 画面いっぱいのペンキの飾り文字は始めの 3 秒だけ見せて薄くし、答え合わせの体を見て回れるようにする -->
<canvas class="paint" bind:this={canvas} aria-hidden="true"></canvas>
<p class="winner" role="status">{text}</p>

<style>
  .paint {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    animation: fade 4s forwards;
  }

  @keyframes fade {
    0%,
    75% {
      opacity: 0.9;
    }
    100% {
      opacity: 0;
    }
  }

  .winner {
    position: absolute;
    top: calc(max(8px, env(safe-area-inset-top)) + 84px);
    left: 50%;
    translate: -50% 0;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 30px;
    white-space: nowrap;
    text-shadow: 0 2px 6px #000;
    pointer-events: none;
  }
</style>
```

`src/lib/games/yappari-chameleon/Ready.svelte`:

```svelte
<script lang="ts">
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const match = $derived(session.match);
  const pressed = $derived(match.view.ready.includes(match.me));
</script>

<!-- 本家と同じく画面の下の中央。いる人の全員が押すと、隠れタイムか答え合わせを飛ばす -->
<button class="ready" class:on={pressed} aria-pressed={pressed} onpointerdown={() => session.ready()}>
  もうええよ {match.view.ready.length}/{session.party.members.length}
</button>

<style>
  .ready {
    position: absolute;
    bottom: max(14px, env(safe-area-inset-bottom));
    left: 50%;
    translate: -50% 0;
    padding: 10px 26px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.4);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 18px;
    text-shadow: 0 1px 3px #000;
  }

  .ready.on {
    background: rgb(255 255 255 / 0.9);
    color: #1d1a17;
    text-shadow: none;
  }
</style>
```

`src/lib/games/yappari-chameleon/Plates.svelte`:

```svelte
<script lang="ts">
  import { nameOf } from './match.svelte';
  import type { Plate } from './session.svelte';

  let { plates }: { plates: Plate[] } = $props();
</script>

<!-- 頭の上の名前の札（ロビーと答え合わせ）。ハンター希望の人には小さな赤い印 -->
{#each plates as p (p.seat)}
  <span class="plate" style:left="{p.x}px" style:top="{p.y}px">
    {#if p.wish}<span class="wish" role="img" aria-label="ハンター希望"></span>{/if}
    {nameOf(p.seat)}
  </span>
{/each}

<style>
  .plate {
    position: absolute;
    translate: -50% -100%;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgb(0 0 0 / 0.45);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 13px;
    white-space: nowrap;
    pointer-events: none;
  }

  .wish {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #ff3b30;
  }
</style>
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/Hud.svelte.test.ts`
Expected: PASS。

- [ ] **Step 6: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon/{Hud,Intro,Reveal,Ready,Plates}.svelte src/lib/games/yappari-chameleon/Hud.svelte.test.ts
git commit -m "Add the match HUD, mode intro, winner reveal, skip vote button and name plates"
```

---

### Task 14: ハンターと観戦のボタン・挑発とハンター希望・ロビーとマップの設定

**Files:**

- Create: `src/lib/games/yappari-chameleon/HunterButtons.svelte`
- Create: `src/lib/games/yappari-chameleon/Spectate.svelte`
- Create: `src/lib/games/yappari-chameleon/TopButtons.svelte`
- Create: `src/lib/games/yappari-chameleon/Lobby.svelte`
- Create: `src/lib/games/yappari-chameleon/Settings.svelte`
- Create: `src/lib/games/yappari-chameleon/prefs.ts`
- Modify: `src/lib/games/yappari-chameleon/Buttons.svelte`（`onquit` を任意にし、列の上に足す `top` を受ける）
- Modify: `src/lib/games/yappari-chameleon/QuitConfirm.svelte`（文と「戻る」の言葉を受ける）
- Modify: `src/lib/icons.ts`（`note`・`aim`・`crouch`）
- Test: `src/lib/games/yappari-chameleon/HunterButtons.svelte.test.ts`
- Test: `src/lib/games/yappari-chameleon/Lobby.svelte.test.ts`
- Test: `src/lib/games/yappari-chameleon/prefs.test.ts`

**Interfaces:**

- Consumes: `Session`（`cool`・`play.crouch`・`play.jump()`・`shoot()`・`toggleCrouch()`・`watching`・`next()`・`free()`・`wish()`・`canTaunt`・`tootWait`・`taunt()`・`party`・`start()`）、`COOLDOWN`、`LIMITS`・`Settings`・`DEFAULTS`・`fit`、`nameOf`。
- Produces: `HunterButtons.svelte`・`Spectate.svelte`・`TopButtons.svelte`（`{ session }`）、`Lobby.svelte`（`{ session, oninvite }`）、`Settings.svelte`（`{ settings (bindable), players, onstart, onclose }`）、`prefs.ts` の `SETTINGS_KEY`・`readSettings()`・`saveSettings(s)`、`Buttons.svelte` の props `{ play; onquit?; top?: Snippet }`（`onquit` が無ければ ✕ を出さない。`top` はペイントモードのあいだ出さない）、`QuitConfirm.svelte` の props `{ onstay; onleave; text?; leave? }`（既定はひとりで試すの文と「戻る」）。

ハンター希望は本家では赤い台に乗るが、台のあるロビーの部屋を作るまでは右の列のボタンで代える。挑発は本家のキー案内の言葉で、ボタンを黄色にする。しゃがむは本家の Ctrl（押しているあいだ）を、指がふさがらないよう押すたびに切り替えるボタンにする。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/HunterButtons.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import HunterButtons from './HunterButtons.svelte';
import type { Session } from './session.svelte';

describe('HunterButtons', () => {
  it('撃ったあとの待ちのあいだは「うつ」を押せず、しゃがむは押すたびに切り替わる', () => {
    const session = $state({ cool: 0, play: { crouch: false, jump: vi.fn() }, shoot: vi.fn(), toggleCrouch: () => {} });
    session.toggleCrouch = () => (session.play.crouch = !session.play.crouch);
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(HunterButtons, { target, props: { session: session as unknown as Session } });
    flushSync();
    const shoot = target.querySelector<HTMLButtonElement>('.shoot')!;
    expect(shoot.disabled).toBe(false);
    shoot.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(session.shoot).toHaveBeenCalledTimes(1);
    session.cool = 1;
    flushSync();
    expect(shoot.disabled).toBe(true);
    const crouch = [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('しゃがむ'))!;
    crouch.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    flushSync();
    expect(crouch.getAttribute('aria-pressed')).toBe('true');
    unmount(app);
  });
});
```

`src/lib/games/yappari-chameleon/Lobby.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Lobby from './Lobby.svelte';
import { SETTINGS_KEY } from './prefs';
import type { Session } from './session.svelte';

function show(host: boolean, members = [1, 2]) {
  const start = vi.fn();
  const session = { party: { host, members }, start } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Lobby, { target, props: { session, oninvite: vi.fn() } });
  flushSync();
  const button = (text: string) => [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  return { target, start, button, done: () => unmount(app) };
}

afterEach(() => localStorage.clear());

describe('Lobby', () => {
  it('子には「ホストが始めるのを待っています」だけを出す', () => {
    const { target, button, done } = show(false);
    expect(target.textContent).toContain('ホストが始めるのを待っています');
    expect(button('マップの設定')).toBeUndefined();
    done();
  });

  it('親はマップの設定を開いて変え、ゲームを始めると設定を覚えて始める', () => {
    const { target, start, button, done } = show(true);
    button('マップの設定')!.click();
    flushSync();
    expect(target.querySelector('[aria-label="マップの設定"]')).not.toBeNull();
    button('通常')!.click();
    flushSync();
    button('ゲームを始める')!.click();
    expect(start).toHaveBeenCalledWith(expect.objectContaining({ mode: 'normal', hide: 60, search: 300 }));
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).mode).toBe('normal');
    done();
  });

  it('1 人のあいだはゲームを始められない', () => {
    const { button, done } = show(true, [1]);
    button('マップの設定')!.click();
    flushSync();
    expect(button('ゲームを始める')!.disabled).toBe(true);
    done();
  });
});
```

`src/lib/games/yappari-chameleon/prefs.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { readSettings, saveSettings, SETTINGS_KEY } from './prefs';
import { DEFAULTS } from './referee';

afterEach(() => localStorage.clear());

describe('マップの設定', () => {
  it('覚えた設定を読み、無ければ既定', () => {
    expect(readSettings()).toEqual(DEFAULTS);
    saveSettings({ ...DEFAULTS, mode: 'normal', hide: 120, taunt: 30 });
    expect(readSettings()).toMatchObject({ mode: 'normal', hide: 120, taunt: 30 });
  });

  it('壊れた値や範囲の外の値は、既定か範囲の中に直す', () => {
    localStorage.setItem(SETTINGS_KEY, '{');
    expect(readSettings()).toEqual(DEFAULTS);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ hide: 5, search: 'x' }));
    expect(readSettings()).toEqual(DEFAULTS);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ hide: 5, reveal: 999 }));
    expect(readSettings()).toMatchObject({ hide: 30, reveal: 120 });
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/HunterButtons.svelte.test.ts src/lib/games/yappari-chameleon/Lobby.svelte.test.ts src/lib/games/yappari-chameleon/prefs.test.ts`
Expected: FAIL（部品と `./prefs` が無い）。

- [ ] **Step 3: アイコンを足す**

```diff
--- a/src/lib/icons.ts
+++ b/src/lib/icons.ts
@@ -620,6 +620,22 @@
     { d: 'M17 4.5h.01M19.5 6h.01M17.5 7.5h.01M20 3.5h.01', stroke: C, width: 2.2 }
   ],
   rewind: [{ d: 'M5 10h9.5a5 5 0 0 1 0 10H10M9 5.5L4.5 10 9 14.5', stroke: C, width: 2.2 }],
+  // 挑発（口笛）。♪ の形
+  note: [
+    { d: 'M9 17.5V5.5l9-2v11.5', stroke: C, width: 2 },
+    { d: circle(7, 17.5, 2.6), fill: C },
+    { d: circle(16, 15, 2.6), fill: C }
+  ],
+  // うつ。銃の照準
+  aim: [
+    { d: circle(12, 12, 6.5), stroke: C, width: 2 },
+    { d: 'M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5', stroke: C, width: 2 }
+  ],
+  // しゃがむ。ひざを曲げた人
+  crouch: [
+    { d: circle(12, 6, 2.3), fill: C },
+    { d: 'M12 9.5v5l-4 1.5 1.5 4.5M12 14.5l4 1.5-1.5 4.5M7 12h10', stroke: C, width: 2 }
+  ],
   // 本家の HUD の、緑の砂の砂時計
   hourglass: [
     { d: 'M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9', stroke: '#ffffff', width: 1.8 },
```

- [ ] **Step 4: 1 段めのボタンと確かめを、つないで遊ぶ画面でも使えるようにする**

```diff
--- a/src/lib/games/yappari-chameleon/Buttons.svelte
+++ b/src/lib/games/yappari-chameleon/Buttons.svelte
@@ -1,10 +1,12 @@
 <script lang="ts">
+  import type { Snippet } from 'svelte';
   import Icon from '$lib/components/Icon.svelte';
   import type { IconName } from '$lib/icons';
   import type { Play } from './play.svelte';
   import QuitConfirm from './QuitConfirm.svelte';

-  let { play, onquit }: { play: Play; onquit: () => void } = $props();
+  /** top はつないで遊ぶときに列の上に足すボタン（挑発・ハンター希望）。onquit が無ければ ✕ を出さない（上の画面が持つ） */
+  let { play, onquit, top }: { play: Play; onquit?: () => void; top?: Snippet } = $props();
   let asking = $state(false);

   function ask() {
@@ -62,9 +64,10 @@
   </button>
 {/snippet}

-<button class="quit" onclick={ask} aria-label="タイトルへ">✕</button>
+{#if onquit}<button class="quit" onclick={ask} aria-label="タイトルへ">✕</button>{/if}

 <div class="column">
+  {#if play.mode !== 'paint'}{@render top?.()}{/if}
   {#if play.mode === 'paint'}
     {@render button('dropper', '3D スポイト', () => play.toggleSpoit(), play.spoit)}
     {@render button('rewind', '元に戻す', () => play.undo())}
@@ -95,7 +98,7 @@
   </div>
 {/if}

-{#if asking}
+{#if asking && onquit}
   <QuitConfirm onstay={() => (asking = false)} onleave={onquit} />
 {/if}

```

```diff
--- a/src/lib/games/yappari-chameleon/QuitConfirm.svelte
+++ b/src/lib/games/yappari-chameleon/QuitConfirm.svelte
@@ -1,7 +1,12 @@
 <script lang="ts">
   import { onMount } from 'svelte';

-  let { onstay, onleave }: { onstay: () => void; onleave: () => void } = $props();
+  let {
+    onstay,
+    onleave,
+    text = 'タイトルへ戻ると、塗った体は消えます。',
+    leave = '戻る'
+  }: { onstay: () => void; onleave: () => void; text?: string; leave?: string } = $props();
   let ready = $state(false);

   // ✕ を押した指を離した位置にこのボタンが現れると、iOS が合成 click を当てる。出てすぐは押せなくする
@@ -13,9 +18,9 @@

 <div class="back" role="dialog" aria-modal="true" aria-label="タイトルへ戻る確かめ">
   <div class="box">
-    <p>タイトルへ戻ると、塗った体は消えます。</p>
+    <p>{text}</p>
     <div class="row">
-      <button disabled={!ready} onclick={onleave}>戻る</button>
+      <button disabled={!ready} onclick={onleave}>{leave}</button>
       <button disabled={!ready} onclick={onstay}>つづける</button>
     </div>
   </div>
```

- [ ] **Step 5: ハンターのボタン・観戦・挑発とハンター希望を書く**

`src/lib/games/yappari-chameleon/HunterButtons.svelte`:

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { COOLDOWN } from './referee';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  /** 次を撃てるまでを、ボタンのふちを時計のように埋めて見せる（0 で撃てる、1 で撃った直後） */
  const wait = $derived(session.cool / COOLDOWN);
</script>

<span class="cross" aria-hidden="true"></span>

<!-- スティックと見回しの指を置いたまま押すので、pointerdown で受ける -->
<div class="column">
  <button class="btn" onpointerdown={() => session.play.jump()}>
    <Icon name="lift" size="30px" />
    <span>ジャンプ</span>
  </button>
  <button
    class="btn"
    class:on={session.play.crouch}
    aria-pressed={session.play.crouch}
    onpointerdown={() => session.toggleCrouch()}
  >
    <Icon name="crouch" size="30px" />
    <span>しゃがむ</span>
  </button>
  <button class="btn shoot" style:--wait={wait} disabled={wait > 0} onpointerdown={() => session.shoot()}>
    <Icon name="aim" size="44px" />
    <span>うつ</span>
  </button>
</div>

<style>
  /* 画面の中央の細い十字 */
  .cross {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 26px;
    height: 26px;
    translate: -50% -50%;
    background:
      linear-gradient(#fff, #fff) center / 2px 100% no-repeat,
      linear-gradient(#fff, #fff) center / 100% 2px no-repeat;
    filter: drop-shadow(0 0 1px #000);
    pointer-events: none;
  }

  .column {
    position: absolute;
    right: max(14px, env(safe-area-inset-right));
    bottom: max(14px, env(safe-area-inset-bottom));
    display: grid;
    justify-items: end;
    gap: 10px;
  }

  .btn {
    display: grid;
    justify-items: center;
    align-content: center;
    width: 88px;
    height: 88px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 10px;
    line-height: 1.15;
    text-shadow: 0 1px 2px #000;
  }

  .btn.on {
    background: rgb(255 255 255 / 0.9);
    color: #1d1a17;
    text-shadow: none;
  }

  .shoot {
    width: 128px;
    height: 128px;
    border-width: 0;
    background:
      radial-gradient(closest-side, rgb(0 0 0 / 0.4) 92%, transparent 93%),
      conic-gradient(rgb(255 255 255 / 0.25) calc(var(--wait) * 360deg), #fff 0);
    font-size: 16px;
  }
</style>
```

`src/lib/games/yappari-chameleon/Spectate.svelte`:

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { nameOf } from './match.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
</script>

<!-- 本家の観戦は左下に「観戦中」と見ている人。左右の矢印でほかの人を順に見るか、フリーカメラで見て回る -->
<div class="spectate">
  <p class="label">観戦中</p>
  <p class="who">{session.watching === null ? 'フリーカメラ' : nameOf(session.watching)}</p>
  <div class="row">
    <button class="btn" aria-label="前の人" onpointerdown={() => session.next(-1)}>
      <Icon name="arrow" size="26px" rotate={-90} />
    </button>
    <button class="btn" aria-label="次の人" onpointerdown={() => session.next(1)}>
      <Icon name="arrow" size="26px" rotate={90} />
    </button>
    <button
      class="btn free"
      class:on={session.watching === null}
      aria-pressed={session.watching === null}
      onpointerdown={() => (session.watching === null ? session.next(1) : session.free())}
    >
      <Icon name="eye" size="26px" />
      <span>フリーカメラ</span>
    </button>
  </div>
</div>

<style>
  .spectate {
    position: absolute;
    bottom: max(14px, env(safe-area-inset-bottom));
    left: max(14px, env(safe-area-inset-left));
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 2px 4px #000;
  }

  p {
    margin: 0;
  }

  .label {
    font-size: 26px;
  }

  .who {
    margin-bottom: 8px;
    font-size: 16px;
  }

  .row {
    display: flex;
    gap: 10px;
  }

  .btn {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-family: inherit;
    font-size: 9px;
  }

  .free {
    width: 88px;
    height: 88px;
  }

  .btn.on {
    background: rgb(255 255 255 / 0.9);
    color: #1d1a17;
  }
</style>
```

`src/lib/games/yappari-chameleon/TopButtons.svelte`:

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Session } from './session.svelte';

  let { session }: { session: Session } = $props();
  const match = $derived(session.match);
  const wished = $derived(match.view.wishes.includes(match.me));
</script>

<!-- 右の列の上に足す。スティックの指を置いたまま押すので、pointerdown で受ける -->
{#if match.phase === 'lobby'}
  <button class="btn wish" class:on={wished} aria-pressed={wished} onpointerdown={() => session.wish()}>
    <span class="mark"></span>
    <span>ハンター希望</span>
  </button>
{/if}
{#if session.canTaunt}
  <button class="btn taunt" disabled={session.tootWait > 0} onpointerdown={() => session.taunt()}>
    <Icon name="note" size="30px" />
    <span>挑発</span>
  </button>
{/if}

<style>
  .btn {
    display: grid;
    justify-items: center;
    align-content: center;
    width: 88px;
    height: 88px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 10px;
    white-space: nowrap;
    line-height: 1.15;
    text-shadow: 0 1px 2px #000;
  }

  /* 本家のキー案内で、挑発だけは黄色 */
  .taunt {
    border-color: #ffd23f;
    color: #ffd23f;
  }

  .taunt:disabled {
    opacity: 0.5;
  }

  .mark {
    width: 22px;
    height: 22px;
    margin-bottom: 4px;
    border: 2px solid #fff;
    border-radius: 50%;
  }

  .wish.on {
    border-color: #ff4a3d;
    background: rgb(160 20 10 / 0.6);
  }

  .wish.on .mark {
    border-color: #ff4a3d;
    background: #ff4a3d;
  }
</style>
```

- [ ] **Step 6: マップの設定とロビーを書く**

`src/lib/games/yappari-chameleon/prefs.ts`:

```ts
import { DEFAULTS, fit, type Settings } from './referee';

export const SETTINGS_KEY = 'asobibako:yappari-chameleon:settings';
const NUMBERS = ['hunters', 'hide', 'search', 'reveal', 'taunt'] as const;

/** 親が前に選んだマップの設定。読めない値は既定に戻し、範囲に収める（人数は始めるときに合わせる） */
export function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<Settings>;
    const merged = { ...DEFAULTS, ...saved };
    if (NUMBERS.some((k) => !Number.isFinite(merged[k]))) return DEFAULTS;
    return fit(merged, 3);
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // 覚えられなくても、選んだ設定で始められる
  }
}
```

`src/lib/games/yappari-chameleon/Settings.svelte`:

```svelte
<script lang="ts">
  import { LIMITS, type Settings } from './referee';

  let {
    settings = $bindable(),
    players,
    onstart,
    onclose
  }: { settings: Settings; players: number; onstart: () => void; onclose: () => void } = $props();

  const rows = [
    { key: 'hide', label: 'ハンター待機時間（隠れる時間）', step: 10, range: LIMITS.hide },
    { key: 'search', label: '探索時間', step: 30, range: LIMITS.search },
    { key: 'reveal', label: '答え合わせ時間', step: 5, range: LIMITS.reveal },
    { key: 'taunt', label: '強制挑発間隔', step: 5, range: [0, LIMITS.taunt[1]] }
  ] as const;
  const most = $derived(Math.max(1, players - 1));
</script>

<!-- 本家のホストの「マップの設定」。親だけが開く -->
<div class="sheet" role="dialog" aria-label="マップの設定">
  <h2>マップの設定</h2>
  <div class="row">
    <span>ゲームモード</span>
    <span class="pick">
      <button class:on={settings.mode === 'normal'} onclick={() => (settings.mode = 'normal')}>通常</button>
      <button class:on={settings.mode === 'infect'} onclick={() => (settings.mode = 'infect')}>増え鬼</button>
    </span>
  </div>
  <div class="row">
    <span>ハンターの人数</span>
    <span class="pick">
      <button aria-label="減らす" onclick={() => (settings.hunters = Math.max(1, settings.hunters - 1))}>−</button>
      <span class="value">{Math.min(settings.hunters, most)}人</span>
      <button aria-label="増やす" onclick={() => (settings.hunters = Math.min(2, settings.hunters + 1))}>＋</button>
    </span>
  </div>
  {#each rows as r (r.key)}
    <label class="row">
      <span>{r.label}</span>
      <input type="range" min={r.range[0]} max={r.range[1]} step={r.step} bind:value={settings[r.key]} />
      <span class="value">{r.key === 'taunt' && settings.taunt === 0 ? 'なし' : `${settings[r.key]}秒`}</span>
    </label>
  {/each}
  <div class="actions">
    <button onclick={onclose}>閉じる</button>
    <button class="go" disabled={players < 2} onclick={onstart}>ゲームを始める</button>
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
  }

  h2 {
    margin: 0 0 4px;
    font-size: 22px;
    font-weight: normal;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: center;
    gap: 12px;
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 8px;
    grid-column: 2 / 4;
    justify-self: end;
  }

  .value {
    min-width: 4.5em;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  input {
    width: min(200px, 30cqw);
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

  .actions {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
  }

  .go {
    border-color: #7cc243;
    background: #3f8a2a;
  }

  .go:disabled {
    opacity: 0.45;
  }
</style>
```

`src/lib/games/yappari-chameleon/Lobby.svelte`:

```svelte
<script lang="ts">
  import { nameOf } from './match.svelte';
  import { readSettings, saveSettings } from './prefs';
  import type { Session } from './session.svelte';
  import Settings from './Settings.svelte';

  let { session, oninvite }: { session: Session; oninvite: () => void } = $props();
  let open = $state(false);
  let settings = $state(readSettings());
  const party = $derived(session.party);

  function start() {
    saveSettings(settings);
    open = false;
    session.start(settings);
  }
</script>

<div class="bar">
  <p class="who">{party.members.map(nameOf).join('・')}（{party.members.length}/3人）</p>
  {#if party.host}
    <button onclick={() => (open = true)}>マップの設定</button>
    {#if party.members.length < 3}<button onclick={oninvite}>なかまを呼ぶ</button>{/if}
  {:else}
    <p role="status">ホストが始めるのを待っています</p>
  {/if}
</div>
{#if open}
  <Settings bind:settings players={party.members.length} onstart={start} onclose={() => (open = false)} />
{/if}

<style>
  .bar {
    position: absolute;
    top: max(10px, env(safe-area-inset-top));
    left: 50%;
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 12px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 16px;
    text-shadow: 0 1px 3px #000;
    white-space: nowrap;
  }

  p {
    margin: 0;
  }

  button {
    padding: 6px 16px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
    text-shadow: inherit;
  }
</style>
```

- [ ] **Step 7: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（`Buttons.svelte.test.ts` も、`onquit` を渡すので ✕ と確かめは今のまま）。

- [ ] **Step 8: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/icons.ts src/lib/games/yappari-chameleon
git commit -m "Add hunter and spectator controls, taunt and hunter wish buttons, the lobby and map settings"
```

---

### Task 15: つなぐ・よびなおす・つないで遊ぶ画面

**Files:**

- Create: `src/lib/games/yappari-chameleon/Entry.svelte`
- Create: `src/lib/games/yappari-chameleon/Invite.svelte`
- Create: `src/lib/games/yappari-chameleon/Overlay.svelte`
- Create: `src/lib/games/yappari-chameleon/Online.svelte`
- Create: `src/lib/games/yappari-chameleon/Yappari.svelte`
- Test: `src/lib/games/yappari-chameleon/Entry.svelte.test.ts`
- Test: `src/lib/games/yappari-chameleon/Overlay.svelte.test.ts`

**Interfaces:**

- Consumes: `Handshake.svelte`、`Party`・`MISMATCH`・`Seat`、`Link`・`Message`、`Host`、`levelOf`・`mansion`、`animate`、`Session`・`Inbox`、`Play`、`mount3d`・`touch`、Task 13 と 14 の部品、`Chameleon.svelte`、`PaintPanel`・`BrushSize`・`PoseWheel`・`StickView`・`QuitConfirm`。
- Produces: `Yappari.svelte`（ゲームの根。props なし。`<main class="stage wide">`）、`Entry.svelte`（`{ note?, was?, onhost, onparty, onsolo }`）、`Invite.svelte`（`{ party, open (bindable) }`）、`Online.svelte`（`{ party, host, inbox, onleave }`）、`Overlay.svelte`（`{ session, radius, center, onleave }`）。dev では `window.__chameleon`（`Play`）と `window.__session`（`Session`）を出す。

つなぐ流れは次のとおり。

| 場面                                  | すること                                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 親が最初の子を迎える                  | `Entry` が `Party.host()` を作り、`add` の前に `onhost` で審判を作らせる（最初の子の `join` と `hi` を落とさない）。審判は描画と別の `animate` で回す |
| 子がつながる                          | `Party.guest(link, { was })`。`Yappari` はつないだときから知らせをためて（`Inbox`）、3D ができた `Session` へ渡す                                     |
| 親が 2 人めを呼ぶ・切れた子を呼び直す | ロビーの「なかまを呼ぶ」と、切れた子がいるときの「よびなおす」が `Invite` の QR の手順を出し、`party.add` で同じ番号に迎える                          |
| 子で親とのつながりが切れた            | 入口へ戻り「ホストとの接続が切れました」と「もう一度つなぐ」（同じ番号で戻る）を出す。`Party` の版ちがいなら `MISMATCH` を出す                        |
| このゲームの版がちがった              | 子は `chameleon-mismatch` を受けて入口へ戻り「アプリの版が違います。どちらも最新版にしてください」を出す                                              |
| ✕ で抜ける                            | 確かめ（親は「ホストが抜けると、全員の試合が終わります。」）のあと入口へ戻る                                                                          |

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/Entry.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Entry from './Entry.svelte';

function show(props: Record<string, unknown> = {}) {
  const target = document.body.appendChild(document.createElement('div'));
  const onsolo = vi.fn();
  const app = mount(Entry, { target, props: { onhost: vi.fn(), onparty: vi.fn(), onsolo, ...props } });
  flushSync();
  const buttons = () => [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
  return { target, onsolo, buttons, done: () => unmount(app) };
}

describe('Entry', () => {
  it('なかまを呼ぶ・なかまに入る・ひとりで試すの 3 つと、短い遊び方を出す', () => {
    const { target, buttons, onsolo, done } = show();
    const [call, join, solo] = buttons();
    expect(call).toMatch(/^なかまを呼ぶ/);
    expect(join).toMatch(/^なかまに入る/);
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
    done();
  });
});
```

`src/lib/games/yappari-chameleon/Overlay.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import { Match } from './match.svelte';
import Overlay from './Overlay.svelte';
import type { PlayRole } from './play.svelte';
import { DEFAULTS, newMatch, view, type View } from './referee';
import type { Session } from './session.svelte';

function show(role: PlayRole, v: Partial<View>, me: Seat = 1) {
  const match = new Match(() => me);
  match.receive({ ...view(newMatch()), settings: DEFAULTS, roles: { 1: 'hider', 2: 'hunter' }, ...v });
  const play = {
    role,
    mode: role === 'hider' ? 'walk' : 'eye',
    crouch: false,
    stick: { active: false, x: 0, y: 0, ox: 0, oy: 0 },
    wheel: null,
    cling: null,
    nearWall: false,
    pose: 'stand',
    lock: false,
    interrupt: vi.fn()
  };
  const session = {
    match,
    play,
    party: { host: me === 1, members: [1, 2], away: [] },
    plates: [],
    cool: 0,
    tootWait: 0,
    watching: 2,
    canTaunt: match.phase === 'lobby' || match.hiding
  } as unknown as Session;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Overlay, { target, props: { session, radius: 70, center: () => [0, 0], onleave: vi.fn() } });
  flushSync();
  const labels = () => [...target.querySelectorAll('button')].map((b) => b.textContent?.trim());
  return { target, labels, done: () => unmount(app) };
}

describe('Overlay', () => {
  it('ロビーでは右の列にハンター希望と挑発、上に親のマップの設定を出す', () => {
    const { labels, done } = show('hider', { phase: 'lobby' });
    expect(labels()).toEqual(expect.arrayContaining(['ハンター希望', '挑発', 'マップの設定']));
    done();
  });

  it('隠れタイムの隠れる人には挑発ともうええよ、ハンターには撃つボタンと十字', () => {
    const hider = show('hider', { phase: 'hide' });
    expect(hider.labels()).toEqual(expect.arrayContaining(['挑発', 'もうええよ 0/2']));
    hider.done();
    const hunter = show('hunter', { phase: 'search' }, 2);
    expect(hunter.labels()).toEqual(expect.arrayContaining(['うつ', 'しゃがむ', 'ジャンプ']));
    expect(hunter.labels()).not.toContain('挑発');
    expect(hunter.target.querySelector('.cross')).not.toBeNull();
    hunter.done();
  });

  it('観戦中は左下に観戦中と見ている人を出す', () => {
    const { target, done } = show('watch', { phase: 'search', found: [1], settings: { ...DEFAULTS, mode: 'normal' } });
    expect(target.textContent).toContain('観戦中');
    expect(target.textContent).toContain('プレイヤー2');
    done();
  });

  it('答え合わせでは勝者の言葉を出す', () => {
    const { target, done } = show('hider', { phase: 'reveal', winner: 'chameleon' });
    expect(target.textContent).toContain('勝者カメレオン!');
    done();
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/Entry.svelte.test.ts src/lib/games/yappari-chameleon/Overlay.svelte.test.ts`
Expected: FAIL（`./Entry.svelte` と `./Overlay.svelte` が無い）。

- [ ] **Step 3: 入口とよびなおすを書く**

`src/lib/games/yappari-chameleon/Entry.svelte`:

```svelte
<script lang="ts">
  import { resolve } from '$app/paths';
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { MISMATCH, Party, type Seat } from '$lib/net/party.svelte';

  let {
    note = '',
    was,
    onhost,
    onparty,
    onsolo
  }: {
    note?: string;
    /** 親とのつながりが切れた子の、切れる前の番号。親が同じ番号で呼び直せるので、すぐ QR を読みに行けるようにする */
    was?: Seat;
    /** 親になった。最初の子の知らせ（join と hi）を受けるため、迎える前に審判を作らせる */
    onhost: (party: Party) => void;
    onparty: (party: Party) => void;
    onsolo: () => void;
  } = $props();

  let joining = $state<'host' | 'guest' | null>(null);
  let failed = $state('');

  async function linked(link: Link) {
    if (joining === 'host') {
      const p = Party.host();
      onhost(p);
      // hello を待つあいだも QR の手順の画面のままにする。戻すと、もう一度呼べて親が 2 つできる
      const seat = await p.add(link);
      joining = null;
      if (seat === 'mismatch') failed = MISMATCH;
      else if (seat !== null) onparty(p);
    } else {
      joining = null;
      onparty(Party.guest(link, { was }));
    }
  }

  function join(as: 'host' | 'guest') {
    failed = '';
    joining = as;
  }
</script>

<div class="entry">
  <h1>やっぱりカメレオン</h1>
  {#if joining}
    <div class="shake">
      <Handshake
        role={joining}
        onlink={linked}
        onfail={(text) => {
          failed = text;
          joining = null;
        }}
      />
      <button class="pill" onclick={() => (joining = null)}>やめる</button>
    </div>
  {:else}
    <p class="rule">体を塗って屋敷に溶け込み、ハンターから隠れる。ハンターはペイント銃で撃って探す。</p>
    <p class="rule">自分の iPad の画面は見せないでね</p>
    {#if was !== undefined}
      <button class="go" onclick={() => join('guest')}>もう一度つなぐ<small>ホストに QR を出してもらう</small></button>
    {:else}
      <div class="row">
        <button class="go" onclick={() => join('host')}>なかまを呼ぶ<small>この iPad に QR が出る</small></button>
        <button class="go" onclick={() => join('guest')}>なかまに入る<small>ホストの QR を読み取る</small></button>
      </div>
    {/if}
    <button class="solo" onclick={onsolo}>ひとりで試す</button>
  {/if}
  {#if failed || note}<p role="alert">{failed || note}</p>{/if}
  <a class="back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
</div>

<style>
  .entry {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 16px;
    overflow: auto;
    background: #1d1a17;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-align: center;
    text-shadow: 0 2px 4px #000;
  }

  h1 {
    margin: 0;
    font-size: min(9cqh, 7cqw);
    font-weight: normal;
  }

  .rule {
    margin: 0;
    font-size: 17px;
  }

  .row {
    display: flex;
    gap: 16px;
  }

  button {
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 18px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
  }

  .go {
    display: grid;
    gap: 4px;
    width: min(300px, 40cqw);
    padding: 16px;
    font-size: 24px;
  }

  .go small {
    font-size: 13px;
  }

  .solo {
    padding: 8px 24px;
    border-style: dashed;
    font-size: 18px;
  }

  /* QR の手順の部品はふだんの紙の地の色で描くので、白い札に載せる */
  .shake {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 14px;
    border-radius: 18px;
    background: var(--paper);
    color: var(--line);
    font-family: inherit;
    text-shadow: none;
  }

  .back {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    color: #fff;
    font-size: 22px;
    text-decoration: none;
  }
</style>
```

`src/lib/games/yappari-chameleon/Invite.svelte`:

```svelte
<script lang="ts">
  import Handshake from '$lib/net/Handshake.svelte';
  import { MISMATCH, type Party } from '$lib/net/party.svelte';
  import { nameOf } from './match.svelte';

  let { party, open = $bindable(false) }: { party: Party; open?: boolean } = $props();
  let failed = $state('');
  /** 版ちがいで断った QR は使い終わっているので、数を進めて手順を作り直す */
  let tries = $state(0);

  function close() {
    open = false;
    failed = '';
  }
</script>

{#if open}
  <!-- 試合は止めずに、上に重ねて QR の手順を出す。戻った子は同じ番号で迎える（Party.away） -->
  <div class="invite">
    {#key tries}
      <Handshake
        role="host"
        onlink={async (link) => {
          if ((await party.add(link)) !== 'mismatch') return close();
          failed = MISMATCH;
          tries++;
        }}
        onfail={(text) => (failed = text)}
      />
    {/key}
    {#if failed}<p role="alert">{failed}</p>{/if}
    <button class="pill" onclick={close}>とじる</button>
  </div>
{:else if party.away.length}
  <p class="lost" role="status">
    {party.away.map(nameOf).join('と')}の接続が切れました
    <button onclick={() => (open = true)}>よびなおす</button>
  </p>
{/if}

<style>
  .invite {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 800;
    text-align: center;
  }

  .lost {
    position: absolute;
    top: calc(max(10px, env(safe-area-inset-top)) + 110px);
    left: 50%;
    translate: -50% 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    padding: 6px 8px 6px 16px;
    border-radius: 999px;
    background: rgb(0 0 0 / 0.55);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    white-space: nowrap;
  }

  .lost button {
    padding: 4px 14px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 999px;
    background: #b3261e;
    color: #fff;
    font: inherit;
  }
</style>
```

- [ ] **Step 4: つないで遊ぶ画面を書く**

`src/lib/games/yappari-chameleon/Overlay.svelte`:

```svelte
<script lang="ts">
  import BrushSize from './BrushSize.svelte';
  import Buttons from './Buttons.svelte';
  import Hud from './Hud.svelte';
  import HunterButtons from './HunterButtons.svelte';
  import Intro from './Intro.svelte';
  import Invite from './Invite.svelte';
  import Lobby from './Lobby.svelte';
  import PaintPanel from './PaintPanel.svelte';
  import Plates from './Plates.svelte';
  import PoseWheel from './PoseWheel.svelte';
  import QuitConfirm from './QuitConfirm.svelte';
  import Ready from './Ready.svelte';
  import Reveal from './Reveal.svelte';
  import type { Session } from './session.svelte';
  import Spectate from './Spectate.svelte';
  import StickView from './StickView.svelte';
  import TopButtons from './TopButtons.svelte';

  let {
    session,
    radius,
    center,
    onleave
  }: { session: Session; radius: number; center: () => [number, number]; onleave: () => void } = $props();
  let inviting = $state(false);
  let asking = $state(false);
  const play = $derived(session.play);
  const match = $derived(session.match);
  const phase = $derived(match.phase);

  function ask() {
    // 確かめが出ているあいだは、押していた指の続きを操作にしない
    play.interrupt();
    asking = true;
  }
</script>

{#snippet top()}<TopButtons {session} />{/snippet}

<Plates plates={session.plates} />
{#if play.stick.active}
  <StickView ox={play.stick.ox} oy={play.stick.oy} x={play.stick.x} y={play.stick.y} r={radius} />
{/if}
{#if play.mode === 'paint'}
  <PaintPanel {play} />
  <BrushSize bind:value={play.brush.radius} onchange={() => play.showCursor(...center())} />
{/if}
{#if play.wheel}<PoseWheel {play} />{/if}
{#if phase === 'lobby'}
  <Lobby {session} oninvite={() => (inviting = true)} />
{:else}
  <Hud {session} />
{/if}
{#if play.role === 'hunter'}
  <HunterButtons {session} />
{:else if play.role === 'watch'}
  <Spectate {session} />
{:else}
  <Buttons {play} {top} />
{/if}
{#if (phase === 'hide' || phase === 'reveal') && play.mode !== 'paint'}<Ready {session} />{/if}
<Intro {match} />
{#if phase === 'reveal' && match.view.winner}<Reveal winner={match.view.winner} />{/if}
<button class="quit" onclick={ask} aria-label="抜ける">✕</button>
{#if session.party.host}<Invite party={session.party} bind:open={inviting} />{/if}
{#if asking}
  <QuitConfirm
    text={session.party.host ? 'ホストが抜けると、全員の試合が終わります。' : '抜けると、この試合から外れます。'}
    leave="抜ける"
    onstay={() => (asking = false)}
    {onleave}
  />
{/if}

<style>
  .quit {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    width: 48px;
    height: 48px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-size: 22px;
  }
</style>
```

`src/lib/games/yappari-chameleon/Online.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Party } from '$lib/net/party.svelte';
  import type { Host } from './host';
  import Overlay from './Overlay.svelte';
  import { Play } from './play.svelte';
  import { Session, type Inbox } from './session.svelte';
  import { mount3d, touch } from './stage3d';

  let {
    party,
    host,
    inbox,
    onleave
  }: { party: Party; host: Host | null; inbox: Inbox | null; onleave: (note?: string) => void } = $props();
  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let portrait = $state(false);
  let failed = $state(false);
  let session = $state.raw<Session | null>(null);
  const radius = 70;

  onMount(() =>
    mount3d(canvas, box, {
      ready: (world, makeRig) => {
        session = new Session(party, new Play(world, radius), makeRig, host, inbox ?? undefined);
        if (import.meta.env.DEV) {
          const w = window as unknown as { __chameleon?: Play; __session?: Session };
          w.__chameleon = session.play;
          w.__session = session;
        }
      },
      frame: (dt, now) => session?.frame(dt, now),
      interrupt: () => session?.play.interrupt(),
      restore: () => session?.restore(),
      fail: () => (failed = true),
      portrait: (on) => (portrait = on),
      dispose: () => session?.dispose()
    })
  );

  $effect(() => {
    if (session?.mismatch) onleave('アプリの版が違います。どちらも最新版にしてください');
  });

  function pointer(kind: 'down' | 'move' | 'up' | 'cancel', e: PointerEvent) {
    if (session) touch(session.play, box, kind, e);
  }
</script>

<div class="chameleon" bind:this={box}>
  <canvas bind:this={canvas}></canvas>
  <div
    class="pad"
    role="presentation"
    onpointerdown={(e) => pointer('down', e)}
    onpointermove={(e) => pointer('move', e)}
    onpointerup={(e) => pointer('up', e)}
    onpointercancel={(e) => pointer('cancel', e)}
  ></div>
  {#if session}
    <Overlay {session} {radius} center={() => [box.clientWidth / 2, box.clientHeight / 2]} onleave={() => onleave()} />
  {:else if failed}
    <div class="notice failed">
      <p>この端末では 3D を表示できません</p>
      <button onclick={() => onleave()}>入口へ</button>
    </div>
  {:else}
    <p class="notice">準備中…</p>
  {/if}
  {#if portrait}
    <p class="notice cover">横向きにしてください</p>
  {/if}
</div>

<style>
  .chameleon {
    position: absolute;
    inset: 0;
    overflow: hidden;
    container-type: size;
    background: #1d1a17;
  }

  canvas,
  .pad {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .notice {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 28px;
    text-shadow: 0 2px 4px #000;
    pointer-events: none;
  }

  .failed {
    align-content: center;
    gap: 16px;
    pointer-events: auto;
  }

  .failed p {
    margin: 0;
  }

  .failed button {
    padding: 8px 24px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 24px;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font: inherit;
    font-size: 18px;
  }

  .cover {
    background: #1d1a17;
    pointer-events: auto;
  }
</style>
```

- [ ] **Step 5: ゲームの根を書く**

`src/lib/games/yappari-chameleon/Yappari.svelte`:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { animate } from '$lib/loop';
  import type { Message } from '$lib/net/link';
  import { MISMATCH, type Party, type Seat } from '$lib/net/party.svelte';
  import Chameleon from './Chameleon.svelte';
  import Entry from './Entry.svelte';
  import { Host } from './host';
  import { levelOf, mansion } from './mansion/layout';
  import Online from './Online.svelte';
  import type { Inbox } from './session.svelte';

  let screen = $state<'entry' | 'solo' | 'online'>('entry');
  let party = $state.raw<Party | null>(null);
  let host = $state.raw<Host | null>(null);
  let note = $state('');
  /** 親とのつながりが切れた子の、切れる前の番号。入口で「もう一度つなぐ」を出し、同じ番号で戻る */
  let was = $state<Seat>();
  let stopHost: (() => void) | null = null;
  let inbox = $state.raw<Inbox | null>(null);

  /** 審判は描画と別に回す。親が縦持ちにして描くのを止めても、試合の時計は進める */
  function hosting(p: Party) {
    stopHost?.();
    host?.stop();
    const h = new Host(p, levelOf(mansion()));
    host = h;
    stopHost = animate((dt) => h.tick(dt));
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
    stopHost?.();
    stopHost = null;
    host?.stop();
    host = null;
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

<svelte:window onpagehide={() => party?.close()} />

<!-- 横持ちで遊ぶので、共通の .stage を横向きで回さない（.wide） -->
<main class="stage wide">
  {#if screen === 'solo'}
    <Chameleon onquit={() => (screen = 'entry')} />
  {:else if screen === 'online' && party}
    <Online {party} {host} {inbox} onleave={(text) => leave(text)} />
  {:else}
    <Entry {note} {was} onhost={hosting} onparty={joined} onsolo={() => (screen = 'solo')} />
  {/if}
</main>
```

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 7: 全体を通してコミットする**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS。

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Connect devices from the entry screen, rejoin dropped players and render the online match screen"
```

---

### Task 16: 一覧の「ふたりで」へ移す

**Files:**

- Modify: `src/lib/games/yappari-chameleon/meta.ts`（`PartyMeta` にする）
- Delete: `src/lib/games/yappari-chameleon/Howto.svelte`（`PartyMeta` は遊び方の部品を持たず、入口の画面に出す）
- Modify: `src/lib/games.ts`（`SoloMeta.landscape` を外す。使うゲームが無くなる）
- Modify: `src/lib/components/SoloShell.svelte:80`（`class:wide` を外す）
- Modify: `src/lib/components/SoloShell.svelte.test.ts`（`landscape` のテスト 2 つと引数の型を外す）
- Modify: `scripts/thumbs/scenes.ts`（入口の「ひとりで試す」から撮る）

**Interfaces:**

- Produces: `meta.ts` の default export（`players: 2`、`party: true`、`load` は `Yappari.svelte` だけを返す）。一覧のカードは `GameCard.svelte` が `party` を見て「2〜3にん」を出す。`static/thumbs/yappari-chameleon.webp` は撮り直さず、今の絵（半身を塗って壁に溶けた人形）を使う。

- [ ] **Step 1: meta を書き換える**

`src/lib/games/yappari-chameleon/meta.ts` を次に置き換え、`Howto.svelte` を消す。

```ts
import type { GameMeta } from '$lib/games';

export default {
  id: 'yappari-chameleon',
  name: 'やっぱりカメレオン',
  description:
    '真っ白な体にペンキを吹き付けて屋敷に溶け込み、ペイント銃のハンターから隠れる。1人1台の iPad を横に持って遊ぶ',
  players: 2,
  party: true,
  minutes: '1試合 7分',
  load: async () => ({ Game: (await import('./Yappari.svelte')).default })
} satisfies GameMeta;
```

```bash
git rm src/lib/games/yappari-chameleon/Howto.svelte
```

- [ ] **Step 2: 使わなくなった `landscape` を外す**

`src/lib/games.ts` の `SoloMeta` から次の 2 行を消す。

```ts
  /** 横持ちで遊ぶ。シェルの枠を横向きのタッチ端末で 90 度回さない（端末を手に持って 3D を見回すゲーム） */
  landscape?: true;
```

`src/lib/components/SoloShell.svelte` の `<main class="stage solo" class:wide={meta.landscape} class:settling={settle.active}>` を `<main class="stage solo" class:settling={settle.active}>` にする。`src/app.css` の `.stage:not(.wide)` はこのゲームの根の `<main class="stage wide">` が使うので残す。

`src/lib/components/SoloShell.svelte.test.ts` の `show()` の引数の型から `; landscape?: true` を消し、次の 2 つのテストを消す。

```ts
it('横持ちのゲームでは枠に wide を付け、横向きで回さない', () => {
  const { target, app } = show({ landscape: true });
  expect(target.querySelector('main.stage')?.classList.contains('wide')).toBe(true);
  unmount(app);
});

it('ふつうのゲームの枠には wide を付けない', () => {
  const { target, app } = show();
  expect(target.querySelector('main.stage')?.classList.contains('wide')).toBe(false);
  unmount(app);
});
```

- [ ] **Step 3: カードを撮る台本を入口から入るようにする**

`scripts/thumbs/scenes.ts` の `yappari-chameleon` の場面の `await s.startSolo();` を次の 2 行にする（タイトルの「はじめる」が無くなり、入口の「ひとりで試す」から入る）。

```ts
await s.press('button.solo');
await s.wait(600);
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm format && pnpm lint && pnpm check && pnpm test:run`
Expected: PASS（`pnpm check` は `tsconfig.scripts.json` で `scenes.ts` も見る）。

- [ ] **Step 5: 一覧・入口・ひとりで試すを撮って確かめる**

dev サーバー（`pnpm dev --port 5180`）を起動したまま、scratchpad に次の `entry.mjs` を置いて `node <scratchpad>/entry.mjs "$PWD" <scratchpad>/entry` で撮る。

```js
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const [repo, out] = process.argv.slice(2);
const { chromium } = createRequire(`${repo}/package.json`)('playwright-core');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5180/asobibako/');
await sleep(1500);
await page.getByText('ふたりで', { exact: true }).first().click();
await sleep(500);
await page.screenshot({ path: `${out}/list.png` });
await page.goto('http://localhost:5180/asobibako/games/yappari-chameleon');
await sleep(1500);
await page.screenshot({ path: `${out}/entry.png` });
await page.locator('button.solo').click();
await page.waitForFunction(() => window.__chameleon, null, { timeout: 30000 });
await sleep(2500);
await page.screenshot({ path: `${out}/solo.png` });
await browser.close();
```

Expected: `pageerror` が出ない。`list.png` の「ふたりで」にやっぱりカメレオンのカードが「2〜3にん」付きで出る。`entry.png` に「やっぱりカメレオン」・遊び方 2 行・「なかまを呼ぶ」「なかまに入る」「ひとりで試す」が、横長の画面に回らずに出る。`solo.png` は Task 12 の `solo.png` と同じ見た目。

- [ ] **Step 6: コミットする**

```bash
git add -A src/lib/games.ts src/lib/components/SoloShell.svelte src/lib/components/SoloShell.svelte.test.ts src/lib/games/yappari-chameleon scripts/thumbs/scenes.ts
git commit -m "List the game under two players as a party game and drop the unused solo landscape flag"
```

---

### Task 17: CLAUDE.md の説明

**Files:**

- Modify: `CLAUDE.md`（アニマルサバイバーの段落の `Timeline` の場所、やっぱりカメレオンの段落）

最新の仕様だけを書き、段の名前・経緯・変えた点は書かない。

- [ ] **Step 1: `Timeline` の場所を直す**

`CLAUDE.md` のアニマルサバイバーの段落の `（`timeline.ts`の`Timeline`）` を `（`$lib/net/timeline.ts`の`Timeline`）` にする。

- [ ] **Step 2: やっぱりカメレオンの段落を直す**

次の 4 か所を置き換える。

1 か所め。

```markdown
今は 1 台で塗る・隠れる・見え方を確かめる試作（`levels: 1`、`ownMenu`）。
```

を次にする。

```markdown
2〜3 人がそれぞれの iPad を QR でつないで遊ぶ（`meta.party`、一覧では「ふたりで」に入る）。
```

2 か所め。

```markdown
横持ちで遊ぶゲームなので、`SoloMeta.landscape` で共通の `.stage` を横向きで回さず（`.wide`）、縦持ちのあいだは描画を止めて「横向きにしてください」を出す。
```

を次にする。

```markdown
横持ちで遊ぶゲームなので、ゲームの根（`Yappari.svelte`）が自分の `<main class="stage wide">` を持って共通の `.stage` を横向きで回さず、縦持ちのあいだは描画を止めて「横向きにしてください」を出す。入口（`Entry.svelte`）は「なかまを呼ぶ」「なかまに入る」「ひとりで試す」で、ひとりで試すは 1 台で塗る・隠れる・見え方を確かめる画面（`Chameleon.svelte`）を開く。屋敷と人形の 3D を作り、横持ちのあいだだけ描く土台は、2 つの画面で `stage3d.ts` の `mount3d` を共用する。
```

3 か所め。

```markdown
を挟み、「戻る」でだけタイトルへ戻る（塗った体は消える）。
```

を次にする。

```markdown
を挟み、ひとりで試すでは「戻る」でだけ入口へ戻り（塗った体は消える）、つないで遊ぶあいだは「抜ける」で入口へ戻る（親が抜けると全員の試合が終わる）。
```

4 か所め（段落の最後の 3 文）。

```markdown
上の「隠れタイム計測」（`HideTimer.svelte`）は本家の HUD の見た目（緑の砂の砂時計・大きな残り秒・「探索開始まで」。ペイントモードは残り秒だけ）で 60 秒を数え、始めたときに画面の中央へ「隠れタイム」を 1 度出し、0 で知らせるだけ。効果音（`sounds.ts`）だけで声は無い。dev では `window.__chameleon` に遊ぶ状態（`Play`）を出し、headless の確かめとカードの撮影が使う。
```

を次にする。

```markdown
ひとりで試すの上の「隠れタイム計測」（`HideTimer.svelte`）は本家の HUD の見た目（緑の砂の砂時計・大きな残り秒・「探索開始まで」。ペイントモードは残り秒だけ）で 60 秒を数え、始めたときに画面の中央へ「隠れタイム」を 1 度出し、0 で知らせるだけ。つないで遊ぶときは `src/lib/net/` の `Handshake.svelte` と `Party`（3 台まで、親が中継）でつなぎ、親は最初の子を迎える前に審判（`host.ts` の `Host`）を作って描画と別のループで回す（親が縦持ちにしても試合の時計は進む）。このゲームの版（`CHAMELEON_VERSION`）は子が `hi` で送り、ちがえば親が `chameleon-mismatch` で知らせて子が抜ける（`hello` と `mismatch` は `Party` が使う）。審判は試合のルール（`referee.ts`。フェーズ・残り秒・役決め・発見・勝敗・もうええよ・強制挑発の時計で、DOM と three を使わない）を進め、全員の動き（`me`、1 秒に 20 回）と吹き付けの列（`dabs`、0.05 秒ごと。1 つを 13 の数にして 32KB ごとに分ける、`net.ts`）を送った人のほかの全員へ中継する。撃った弾（`shot`）の当たりは親が決める（`shots.ts`）。撃った人の時計を親の時計に直し（`$lib/net/timeline.ts` の `Timeline.offset()`）、隠れる人の体をその時刻から 0.1 秒前までさかのぼって、十字の向きの半角 2 度に開いた 5 本の線と、体の形の表（`dollShapes()`）から作った骨ごとのカプセルと、家具まで含めた屋敷の箱（カメラの殻ではない）で調べる。カプセルはポーズと張り付きを three なしでたどる（`frames()` と `placement()`。world3d の `placeRoot` も同じ置き方を使う）。来た・戻った子には、全員の体・塗り・見つかったときの体・試合の様子をこの順に送り（`Host.welcome`）、子は様子が届くまで自分の動きを送らない（親に残っていた自分の体と塗りを上書きしない）。3D を作るあいだに届いた知らせは、つないだときから `Yappari.svelte` がためて `Session` へ渡す。各端末では `session.svelte.ts` の `Session` が、届いた様子（`match.svelte.ts` の `Match`）で自分の役（`Play.role` の hider・hunter・watch。ハンターと観戦はフリーカメラの作りを使い、ハンターはしゃがむと目を 0.45m 下げる）を切り替え、ほかの人の体（`remote.ts`。人形と塗りの面を自分の端末に作り、その人の列で塗り直し、送った時刻から 0.1 秒遅らせて動かす）・弾の虹色の筋としぶき（1 試合 60 枚）と砕けた破片と口笛の ♪（`effects.ts`）・一人称の手と銃（`hunter.ts`。`World.overlay` に、屋敷の深さを消してから重ねて描く）・答え合わせの赤と青の光（`glow.ts`）を出す。試合は紹介 3 秒・隠れタイム・探索・答え合わせで、ロビーと試合の始めは全員の塗りを白に戻し、隠れる人は大広間、ハンターは控室（`mansion/layout.ts` の `ROOM`、屋敷から離した 4m 四方の出口の無い小部屋）へ移り、探索で大広間の南の壁の前（`SPAWNS.entrance`）から一人称で入る。見つかった人は砕け、通常では観戦（`Spectate.svelte`）、増え鬼では破片が消えたあと白い体のハンターになり、ペイントモードのあいだに見つかったらペイントモードを抜ける。マップの設定（`Settings.svelte`）は親の端末の `asobibako:yappari-chameleon:settings`（`prefs.ts`）に覚える。人は席の番号で「プレイヤー1」〜「プレイヤー3」と呼び、ロビーと答え合わせだけ頭の上に札（`Plates.svelte`）を出す。口笛は吹いた人の向きと距離に合わせて `PannerNode` で鳴らす（`sounds.ts`）。効果音だけで声は無い。dev では `window.__chameleon` に遊ぶ状態（`Play`）を、つないで遊ぶときは `window.__session` に `Session` も出し、headless の確かめとカードの撮影が使う。
```

- [ ] **Step 3: 通ることを確かめてコミットする**

Run: `pnpm format && pnpm lint`
Expected: PASS（Markdown の textlint の hook が止めたら、言われた文だけを直す）。

```bash
git add CLAUDE.md
git commit -m "Describe the connected match in CLAUDE.md"
```

---

### Task 18: 3 ページの通しの試合と、全体の確かめ

**Files:**

- Create（リポジトリに入れない）: `<scratchpad>/e2e-chameleon.mjs`

偽のカメラでつなぐ。3 ページを 1 つの context で開き、`getUserMedia` を「本物を 1 度呼んで許可を取ってから（許可がないと WebRTC が自分の LAN のアドレスを伏せる）、canvas の `captureStream` を返す」ものに替える。相手のページの `svg[data-code]` を読み、node 側で `uqr` の `encode` にかけ、`window.__show` で canvas に描く。Chrome は `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` で起動し、context に `grantPermissions(['camera'])` を与える。`goto` のあと 1.5 秒待ってから押す（ハイドレートの前の click は拾われない）。

- [ ] **Step 1: dev サーバーを起動する**

Run（裏で）: `pnpm dev --port 5180`
Expected: `http://localhost:5180/asobibako/` が開ける。

- [ ] **Step 2: 通しの台本を scratchpad に置く**

`<scratchpad>/e2e-chameleon.mjs`:

```js
// 実行: node <scratchpad>/e2e-chameleon.mjs <repo の絶対パス> <撮った絵を置く dir>
// 3 ページを偽のカメラの QR でつなぎ、通しの試合（ロビー → 設定 → 紹介 → 隠れタイム → 探索で 2 人を撃つ → 答え合わせ
// → 切れた子のよびなおし → ロビー → 親が切れる）を headless の Chrome で進めて撮る。dev サーバーは 5180 で起動しておく
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const [repo, out] = process.argv.slice(2);
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');
const { encode } = require('uqr');
const URL = 'http://localhost:5180/asobibako/games/yappari-chameleon';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(out, { recursive: true });

/** 本物のカメラで許可を取ってから（許可がないと WebRTC が自分のアドレスを伏せる）、QR を描く canvas の映像を返す */
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

/** マップの設定を通常・探索 600 秒・答え合わせ 120 秒・強制挑発 10 秒にしておく（よびなおすあいだに答え合わせが終わらないように） */
function settings() {
  localStorage.setItem(
    'asobibako:yappari-chameleon:settings',
    JSON.stringify({ mode: 'normal', hunters: 1, hide: 300, search: 600, reveal: 120, taunt: 10 })
  );
}

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
});
const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
await context.grantPermissions(['camera']);
await context.addInitScript(fakeCamera);
await context.addInitScript(settings);

async function open(name) {
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message));
  page.on('console', (m) => m.type() === 'error' && console.log(`[${name}]`, m.text()));
  await page.goto(URL);
  // ハイドレートが済むまで押しても拾われない
  await sleep(1500);
  return page;
}

const code = (page) => page.locator('svg[data-code]').getAttribute('data-code', { timeout: 20000 });
const show = (page, text) => page.evaluate((rows) => window.__show(rows), encode(text, { ecc: 'L', border: 4 }).data);
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const state = (page, fn) => page.evaluate(fn);
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000 });
const press = (page, selector) =>
  page.locator(selector).first().dispatchEvent('pointerdown', { bubbles: true, pointerId: 9 });

/** host が QR を出す操作のあと、guest が読み、guest の QR を host が読む */
async function pair(host, guest, hostOpens, guestButton) {
  await guest.locator('button.go', { hasText: guestButton }).click();
  await hostOpens();
  await show(guest, await code(host));
  const answer = await code(guest);
  await host.getByRole('button', { name: 'よみとってもらったら つぎへ' }).click();
  await show(host, answer);
  await until(guest, () => window.__session?.match.synced);
}

// ひとりで試すは 1 台の試作のまま
const solo = await open('solo');
await solo.locator('button.solo').click();
await solo.waitForFunction(() => window.__chameleon, null, { timeout: 30000 });
await sleep(2500);
await shot(solo, '00-solo');
await solo.close();

const host = await open('host');
const a = await open('a');
const b = await open('b');

// つなぐ（親 → 子 a、ロビーの「なかまを呼ぶ」から子 b）
await pair(host, a, () => host.locator('button.go', { hasText: 'なかまを呼ぶ' }).click(), 'なかまに入る');
await until(host, () => window.__session?.match.synced);
await pair(host, b, () => host.getByRole('button', { name: 'なかまを呼ぶ' }).click(), 'なかまに入る');
await until(host, () => window.__session.party.members.length === 3);
await sleep(1500);
for (const [p, n] of [
  [host, 'host'],
  [a, 'a'],
  [b, 'b']
])
  await shot(p, `01-lobby-${n}`);

// b がハンター希望。親がマップの設定から始める
await press(b, 'button.wish');
await until(host, () => window.__session.match.view.wishes.includes(3));
await host.getByRole('button', { name: 'マップの設定' }).click();
await shot(host, '02-settings');
await host.getByRole('button', { name: 'ゲームを始める' }).click();
await until(a, () => window.__session.match.phase === 'intro');
await shot(a, '03-intro');
await until(a, () => window.__session.match.phase === 'hide');
console.log('roles', await state(host, () => window.__session.match.view.roles));

// a が体の前を緑に塗る（戻ったときに塗りが戻るかを見る）
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
await sleep(800);
await shot(a, '04-hide-a');
await shot(b, '04-hide-b-room');
const painted = await state(a, () => window.__chameleon.log.dabs.length);

// 全員のもうええよで探索へ
for (const p of [host, a, b]) await press(p, 'button.ready');
await until(b, () => window.__session.match.phase === 'search');
await sleep(1500);
await shot(b, '05-search-hunter');
// 親（隠れる人）のカメラをハンターへ向け、銃を両手で構えた体を撮る
const hunterAt = await state(b, () => window.__chameleon.ghost.pos);
await host.evaluate(([x, , z]) => {
  const p = window.__chameleon;
  p.camYaw = Math.atan2(x - p.body.pos[0], z - p.body.pos[2]);
  p.camPitch = 0.1;
}, hunterAt);
await sleep(800);
await shot(host, '05-search-host-sees-hunter');

/** b（ハンター）の十字を seat の体の胸へ向けて撃つ */
async function aimAndShoot(seat) {
  const at = await state(seat === 1 ? host : a, () => window.__chameleon.body.pos);
  await b.evaluate(([x, y, z]) => {
    const p = window.__chameleon;
    const g = p.ghost.pos;
    const d = [x - g[0], y + 0.75 - (g[1] + 1), z - g[2]];
    const len = Math.hypot(...d);
    p.eyeYaw = Math.atan2(d[0], d[2]);
    p.eyePitch = Math.asin(-d[1] / len);
  }, at);
  await sleep(400);
  await b.evaluate(() => window.__session.shoot());
  await sleep(300);
}

await aimAndShoot(1);
await shot(b, '06-shot-host');
await until(host, () => window.__session.match.view.found.includes(1));
await shot(host, '07-host-watching');
await sleep(2200);
await aimAndShoot(2);
await until(a, () => window.__session.match.phase === 'reveal');
await sleep(1200);
for (const [p, n] of [
  [host, 'host'],
  [a, 'a'],
  [b, 'b']
])
  await shot(p, `08-reveal-${n}`);
const foundBody = await state(host, () => window.__session.match.view.found);
console.log('found', foundBody);

// a が切れて、新しいページで戻る。親の「よびなおす」から同じ番号（2）で迎え、塗りと答え合わせが戻る
await a.close();
await until(host, () => window.__session.party.away.includes(2));
await shot(host, '09-host-away');
const a2 = await open('a2');
await pair(host, a2, () => host.getByRole('button', { name: 'よびなおす' }).click(), 'なかまに入る');
await until(a2, () => window.__session.match.phase === 'reveal');
await sleep(1500);
const back = await state(a2, () => ({
  seat: window.__session.party.me,
  dabs: window.__chameleon.log.dabs.length,
  visible: window.__chameleon.world.rig.root.visible
}));
console.log('rejoined', back, 'painted before', painted);
if (back.seat !== 2 || back.dabs !== painted) throw new Error('戻った子の番号か塗りが戻っていない');
await shot(a2, '10-rejoined-reveal');

// 全員のもうええよでロビーへ。塗りが白に戻る
for (const p of [host, a2, b]) await press(p, 'button.ready');
await until(host, () => window.__session.match.phase === 'lobby');
await sleep(800);
const white = await Promise.all([host, a2, b].map((p) => state(p, () => window.__chameleon.log.dabs.length)));
console.log('dabs after lobby', white);
if (white.some((n) => n !== 0)) throw new Error('ロビーで塗りが白に戻っていない');
await shot(a2, '11-lobby-again');

// 親が切れたら、子は入口へ戻り理由を出す
await host.close();
await until(b, () => document.body.textContent.includes('ホストとの接続が切れました'));
await shot(b, '12-host-gone');

await browser.close();
console.log('ok');
```

- [ ] **Step 3: 通しで動かす**

Run: `node <scratchpad>/e2e-chameleon.mjs "$PWD" <scratchpad>/e2e`
Expected: `pageerror` が出ず、`roles { '1': 'hider', '2': 'hider', '3': 'hunter' }`、`found [ 1, 2 ]`、`rejoined { seat: 2, dabs: N, visible: true } painted before N`（2 つの N が同じ）、`dabs after lobby [ 0, 0, 0 ]`、最後に `ok` を出す。止まったら、止まった所の画面を撮り足して、どのページのどの知らせが届いていないかを `window.__session` から読む。まず見るのは、親のロビーの「なかまを呼ぶ」（入口の同じ名前のボタンはもう無い）と、答え合わせで観戦の親にも出る `button.ready` の 2 つの押す先。headless でページの `requestAnimationFrame` が止まるようなら、そのページを `bringToFront()` してから進める。

- [ ] **Step 4: 撮った絵を見る**

Read で `<scratchpad>/e2e/*.png` を見て、次を確かめる。

| 絵                            | 写っていること                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `00-solo`                     | ひとりで試すの大広間と人形・右の列のボタン・上の「隠れタイム計測」（1 段めと同じ）                     |
| `01-lobby-*`                  | 大広間にほかの 2 人の白い体と頭の上の「プレイヤーN」、上に顔ぶれ、親に「マップの設定」「なかまを呼ぶ」 |
| `02-settings`                 | マップの設定の 6 項目と「ゲームを始める」                                                              |
| `03-intro`                    | 黒い帯に緑の「通常」と説明 2 行                                                                        |
| `04-hide-a`・`04-hide-b-room` | a は前を緑に塗った体と「探索開始まで」と「もうええよ 0/3」、b は白い控室                               |
| `05-search-hunter`            | 右下の白い手とペイント銃、中央の細い十字、うつ・しゃがむ・ジャンプ、右下の「通常」と説明 2 行          |
| `05-search-host-sees-hunter`  | 銃を両手で構えたハンターの体                                                                           |
| `06-shot-host`                | 虹色の粒の筋と、砕けて飛ぶ破片                                                                         |
| `07-host-watching`            | 左下の「観戦中」と見ている人の名前、矢印とフリーカメラ                                                 |
| `08-reveal-*`                 | 「勝者ハンター!」、壁を透かして青く光る体、しぶき                                                      |
| `09-host-away`                | 「プレイヤー2の接続が切れました」と「よびなおす」                                                      |
| `10-rejoined-reveal`          | 戻った a に答え合わせの続き（撃たれた場所の自分の体が青く光る）                                        |
| `11-lobby-again`              | 塗りが白に戻ったロビー                                                                                 |
| `12-host-gone`                | 入口の画面と「ホストとの接続が切れました」と「もう一度つなぐ」                                         |

構えた銃の向き（`AIM` の角度と `inHand` の向き）や手と銃の位置（`HunterView` の `REST` と手の位置）が不自然なら、数値だけを直して撮り直す。

- [ ] **Step 5: 全部を通す**

Run: `pnpm verify`
Expected: PASS（lint・check・test・vitals・build）。`svelte-vitals` が新しい部品に警告を出したら、規則に合わせて直す（抑制コメントは使わない）。直したら Step 3 を撮り直す。

- [ ] **Step 6: コミットする（直したものがあれば）**

```bash
git add -A src/lib/games/yappari-chameleon
git commit -m "Tune the hunter's gun pose after the three-device run"
```

- [ ] **Step 7: iPad で遊んでもらう準備**

作業の担当へ、撮った絵と、iPad 2 台で確かめてほしい点を返す。確かめてほしい点は、散弾の広がり（半角 2 度に 5 本）・隠れる時間の既定（60 秒）・観戦の画面の見やすさ・口笛の方向の分かりやすさ・3 人ぶんの体を描いたときの重さ（カクつき・熱）。

---

## Self-Review

### 仕様の節と受け持つタスク

| 仕様の節               | タスク                                                                                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 入口                   | 15（入口・遊び方・ひとりで試す）、16（`PartyMeta`・「2〜3にん」）                                                                                           |
| ロビー                 | 5（大広間の始める場所）、11（名前の札の位置）、13（名前の札）、14（ハンター希望・マップの設定・待つ言葉）、2（希望から選ぶ）                                |
| 試合の流れ・紹介の言葉 | 2（フェーズと時計）、6（配る）、7（言葉）、11（白に戻す・移す）、13（紹介・隠れタイム・もうええよ）                                                         |
| 控室                   | 5（`ROOM`）、11（控室へ移し、探索で入口へ）                                                                                                                 |
| ハンター               | 3（5 本の線・カプセル・ポーズと張り付き）、8（銃の形・構えた体）、9（筋・しぶき・破片）、10（一人称・しゃがむ）、14（うつ・しゃがむ・ジャンプ・間隔のふち） |
| 当たりの決め方         | 1（時計の差）、3（当たり）、6（2.0 秒・さかのぼり・`found`・`splat`）、11（参考に見た人）                                                                   |
| 見つかった人           | 2（増え鬼でハンター）、11（観戦・増え鬼の切り替え・ペイントモードを抜ける・挑発できない）、14（観戦の画面）                                                 |
| 勝ち負け               | 2                                                                                                                                                           |
| 答え合わせ             | 8（光）、11（撃たれた場所に体を戻す・フリーカメラ）、13（勝者の言葉と飾り文字）、6（答え合わせのしぶき）                                                    |
| 口笛と強制挑発         | 2（時計と巻き戻し）、6（`toot`）、9（♪ と方向つきの音）、13（黄色の秒）、14（黄色の挑発ボタン）                                                             |
| HUD                    | 13、14（右端のボタン）                                                                                                                                      |
| 音                     | 9                                                                                                                                                           |
| 通信                   | 4（形・数の列・32KB）、6（中継・版・`welcome`）、8（0.1 秒遅らせる）、11（送る間隔）、15（よびなおす・親が切れた・版ちがい）                                |
| 仕組み                 | ファイルの地図のとおり                                                                                                                                      |
| 本家と変える点         | 14（ハンター希望のボタン・しゃがむの切り替え）、5（ロビーは大広間）、3（半角 2 度）、7（勝者ハンター・通常の説明）、11（名前の札はロビーと答え合わせだけ）  |
| 確かめ方               | 2・3・4・6・11 の vitest、18 の通しの試合                                                                                                                   |

### このプランで決めたこと

| 決めたこと                                                                                                                               | 理由                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 仕様の `hello` は `hi`、版ちがいは `chameleon-mismatch`。3 秒の締め切りは `Party` の `hello`                                             | `Party` がすでに `hello` と `mismatch` を使っている                                      |
| 仕様の `paint` は `welcome` の並び（`me` → `dabs at: 0` → 見つかった体 → `phase`）で送る                                                 | 塗りは 32KB に分けて送るので、1 つの知らせにならない。同じ形の `dabs` を使い回せる       |
| `Timeline` を `src/lib/net/` へ移す                                                                                                      | ゲームのフォルダの外のゲームを import しない                                             |
| 屋敷の入口は大広間の南の壁の前（北を向く）                                                                                               | 屋敷に扉の形が無い                                                                       |
| 弾の筋は撃った人の一人称の銃口から引き、ほかの人の画面でも同じ所から引く                                                                 | ハンターの体が持つ銃の銃口の粒をこれで兼ねる                                             |
| 増え鬼で見つかった人は、ハンターになるときに塗りを白に戻す                                                                               | 仕様の「白い体のまま一人称と銃に替わり」                                                 |
| 答え合わせの緑のペンキの飾り文字は始めの 3 秒だけ見せて消す                                                                              | 30 秒ずっと画面をふさぐと、全員の場所を見て回れない                                      |
| 光るのは隠れる人の体だけ（最初のハンターは光らない）                                                                                     | 仕様の赤と青は隠れる人の見つかった・見つかっていないを分ける色                           |
| 観戦の人は答え合わせでフリーカメラへ移り、見つかっていない隠れる人は自分で切り替える                                                     | 仕様の「全員がフリーカメラで見て回れる」を、隠れる人の操作を奪わずに満たす               |
| 試合の途中で来た人と、切れて戻ったハンターは観戦（役 `out`）                                                                             | 本家の途中参加は観戦から始まる                                                           |
| 当たりは送られてきたポーズ（目標の形）で見る                                                                                             | ポーズの切り替えは 0.25 秒で終わり、親は three を持たない                                |
| 階段の坂は弾の当たりに入れない                                                                                                           | 階段の下と横は手すりの箱でふさがっていて、坂の裏から撃てる所が無い                       |
| 審判の時計は親の端末の `animate` で進むので、親がアプリを裏に回すと試合の時計・撃つ間隔・強制挑発の時計が止まる（2a ではそのままにする） | 親が縦持ちにしても止まらないよう描画とは分けてあり、裏に回すのは遊ぶ人が自分で止めたとき |
| 切れた人の番号に別の端末が入ると、その番号に残っていた体と塗りを受け継ぐ（2a ではそのままにする）                                        | `Party` は空いた番号を先に使い、親は番号ごとに体と塗りを控えている                       |

### 型と名前のそろい

- `Me` は Task 4 で決め、Task 6（`Timeline<Me>`・`found` の `body`）、Task 8（`Remote.push`・`Show.pin`）、Task 11（`#me()`・`#ownBody`）が同じ形を使う。`Placeable` は `Body` と `Me` の両方を受ける（Task 3）。
- `Host` の act の名前（`hi`・`me`・`dabs`・`wish`・`ready`・`taunt`・`shot`）と tell の名前（`phase`・`me`・`dabs`・`found`・`splat`・`toot`・`chameleon-mismatch`）は Task 6 と Task 11 で同じ。`splat` の `from`・`ends`・`marks` と `found` の `seat`・`by`・`at`・`body`・`quiet` も同じ。
- `View` は Task 2 で決め、Task 6 が `phase` の `view` として配り、Task 7 の `Match.receive` が受ける。
- `Session` の公開する名前（`match`・`play`・`party`・`host`・`cool`・`tootWait`・`watching`・`plates`・`mismatch`・`canTaunt`・`wish()`・`ready()`・`taunt()`・`toggleCrouch()`・`shoot()`・`next()`・`free()`・`start()`・`restore()`・`dispose()`・`frame()`）は、Task 13〜15 の部品とテストの偽物が同じ名前で読む。
- `Play.role` の値（`hider`・`hunter`・`watch`）と、試合の役 `Role`（`hider`・`hunter`・`out`）は別のもの。前者は自分の端末の操作とカメラ、後者は親が決める試合の役で、`Session.#fit` がつなぐ。
