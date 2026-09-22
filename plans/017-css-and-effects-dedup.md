# Plan 017: 丸ボタン・`bob`・コンフェッティ配色の重複をまとめる

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 017 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/app.css src/lib/fx.ts src/lib/components/GameShell.svelte src/lib/components/SoloShell.svelte src/lib/components/TitleScreen.svelte src/lib/components/SoloTitle.svelte src/lib/components/SoloResult.svelte src/lib/games/pin-rescue/PinRescue.svelte src/lib/games/dog-guard/Hud.svelte src/lib/games/gate-run/GateRun.svelte src/lib/games/dog-guard/DogGuard.svelte src/lib/games/pin-rescue/effects.ts src/lib/games/snow-camp/effects.ts`
> 001 / 004 / 013 で `.svelte` は変わっている **はず**。「Current state」の CSS と定数が各ファイルに残っていることを
> `grep` で確かめてから進む。

## Status

| 項目       | 値                                                              |
| ---------- | --------------------------------------------------------------- |
| Priority   | P3                                                              |
| Effort     | S                                                               |
| Risk       | LOW（見た目だけ。1 か所にまとめた値が今の値と同じなら変化なし） |
| Depends on | 001                                                             |
| Category   | tech-debt                                                       |
| Planned at | commit `b4b0196`, 2026-09-22                                    |

## Why this matters

CLAUDE.md は「画面をまたぐ見た目は `src/app.css` の共通クラス（`.pill`、`.sticker`、`.half`）に置く」と言う。
ところが 48px の白いふちの丸ボタンは、`GameShell` の `.edge`、`SoloShell` の `.corner`、`PinRescue` の `.retry`、
dog-guard `Hud` の `.retry` の 4 か所に同じ 14 行がある。`@keyframes bob`（ボタンがふわっと膨らむ）は
`TitleScreen` / `SoloTitle` / `SoloResult` の 3 か所にあり、Svelte はコンポーネントの keyframes をスコープするので
3 つとも配信される。コンフェッティの配色は 5 か所に定数があり、gate-run と `SoloResult` だけ紫（`#b27bff`）が
入っていて、ほかの 3 つは 4 色。同じ「クリア！」の演出が場所によって色数が違う。

どれも小さいが、次にボタンの見た目を変えるとき 4 ファイルを開くことになる。まとめる。

## Current state

`src/lib/components/GameShell.svelte:92-109`（現状。`.edge`。001 のあとも同じ）

```css
.edge {
  position: absolute;
  top: 50%;
  translate: 0 -50%;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--card);
  box-shadow: var(--lift);
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}
```

`src/lib/components/SoloShell.svelte:79-96` の `.corner` は `top: max(12px, env(safe-area-inset-top)); z-index: 5;` 以外同じ。
`src/lib/games/pin-rescue/PinRescue.svelte:172-185` の `.retry` と `src/lib/games/dog-guard/Hud.svelte:78-91` の `.retry` は
`position: absolute; top: 12px; right: 12px;` + 同じ箱 + `background: var(--gold); font-size: 24px;`。
`display: grid; place-items: center;` は `.retry` にはない（`↻` 1 文字なので中央に見える）。

`@keyframes bob { 50% { scale: 1.05; } }` — `TitleScreen.svelte:96-100`、`SoloTitle.svelte:113-117`、`SoloResult.svelte:175-179`。
それぞれ `.cta` / `.go` / `.go` に `animation: bob 1.6s ease-in-out infinite;`（`SoloResult` は `grep` で確かめる）。
`app.css` の `.pill` は `bob` を使っていない。

コンフェッティ配色

- `src/lib/games/gate-run/GateRun.svelte:27` — `const CONFETTI = ['#ffc233', '#1f9bff', '#ff4d5e', '#58c46b', '#b27bff'];`
- `src/lib/games/dog-guard/DogGuard.svelte:35` — `['#ffc233', '#1f9bff', '#ff4d5e', '#58c46b']`
- `src/lib/games/pin-rescue/effects.ts:6` — 同上 4 色
- `src/lib/games/snow-camp/effects.ts:4` — 4 色（`grep -n "CONFETTI\|'#58c46b'" src/lib/games/snow-camp/effects.ts` で行を確かめる）
- `src/lib/components/SoloResult.svelte:10` — `const COLORS = ['#ffc233', '#1f9bff', '#ff4d5e', '#58c46b', '#b27bff'];`

`src/lib/fx.ts` は canvas の演出（`Particles` / `Floaters` / `Shake` / `sprite` / `label` など）を持つ。配色の定数はまだない。

Svelte の keyframes — コンポーネントの `<style>` に `@keyframes bob` があると `bob` は `svelte-xxxx-bob` に
書き換えられる。コンポーネントに宣言がなく `animation: bob …` だけあれば、名前はそのまま残り、`app.css` の
グローバルな `@keyframes bob` を参照する。

規約 — `app.css` の共通クラスは、ゲームの中で使う名前（`.board` など）と衝突しない名前にする。
`.svelte` は 200 行未満（`SoloResult.svelte` は 191 行。減る方向）。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド             | 成功時                                     |
| ------ | -------------------- | ------------------------------------------ |
| lint   | `pnpm lint`          | exit 0                                     |
| 型     | `pnpm check`         | `0 ERRORS`                                 |
| vitals | `pnpm vitals --diff` | exit 0                                     |
| まとめ | `pnpm verify`        | exit 0                                     |
| 目視   | `pnpm dev`           | ボタンの見た目・膨らみ・紙吹雪が以前と同じ |

## Scope

**In scope**

- `src/app.css`
- `src/lib/fx.ts`
- `src/lib/components/{GameShell,SoloShell,TitleScreen,SoloTitle,SoloResult}.svelte`
- `src/lib/games/pin-rescue/PinRescue.svelte`、`src/lib/games/pin-rescue/effects.ts`
- `src/lib/games/dog-guard/Hud.svelte`、`src/lib/games/dog-guard/DogGuard.svelte`
- `src/lib/games/gate-run/GateRun.svelte`
- `src/lib/games/snow-camp/effects.ts`
- `plans/README.md`

**Out of scope**

- `@keyframes pop` — 7 か所にあるが `from` の scale が 0.3 / 0.4 / 0.5 と違う。偶然の一致なので触らない
- 紙吹雪を撒く関数（4 列に burst するループ）の共通化 — 座標系（world 単位 / px）が違う。配色だけ
- ↻ を `SoloShell` に移すこと — 方向性の話（索引の rejected を参照）

## Git workflow

- ブランチ: `advisor/017-css-and-effects-dedup`
- コミットは「丸ボタン」「bob」「配色」の 3 つ。英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: `app.css` に `.round` を足す

`.pill:active` の下に足す。

```css
/* 画面の隅や端に置く 48px の丸いボタン（戻る・ミュート・やりなおし）。置く位置と色は使う側が決める */
.round {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--card);
  box-shadow: var(--lift);
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}
```

確認 — `pnpm lint` → exit 0

### Step 2: 4 か所を `.round` に載せ替える

- `GameShell.svelte` — `<a class="edge back" …>` と `<button class="edge mute" …>` を `class="round edge back"` /
  `class="round edge mute"` にし、`.edge` の CSS は `position: absolute; top: 50%; translate: 0 -50%;` の 3 行だけ残す
- `SoloShell.svelte` — 3 つの `.corner` に `round` を足し、`.corner` の CSS は `position: absolute; top: max(12px, env(safe-area-inset-top)); z-index: 5;` だけ残す
- `PinRescue.svelte` — `<button class="round retry" …>`、`.retry` は `position: absolute; top: 12px; right: 12px; background: var(--gold); font-size: 24px;` だけ残す
- `dog-guard/Hud.svelte` — 同上

`.settling .edge` / `.settling .corner` のセレクタ（`pointer-events: none`）はそのまま効く（クラスは残っている）。

確認 — `pnpm lint` → exit 0、`pnpm vitals --diff` → exit 0。`pnpm dev` で対戦ゲームのタイトル（✕ とミュート）、
1 人用のタイトル（✕ とミュート）、pin-rescue と dog-guard の ↻ が以前と同じ見た目

### Step 3: `@keyframes bob` を `app.css` に上げる

`app.css` の `.round` の下に足す。

```css
/* ボタンがふわっと膨らむ。タイトルの「スタート」と結果の「つぎへ」が使う */
@keyframes bob {
  50% {
    scale: 1.05;
  }
}
```

`TitleScreen.svelte` / `SoloTitle.svelte` / `SoloResult.svelte` から `@keyframes bob { … }` のブロックを消す。
`animation: bob …` の行と `@media (prefers-reduced-motion: reduce)` の中の `animation: none` はそのまま。

確認 — `grep -rn "@keyframes bob" src/` が `src/app.css` の 1 件だけ。`pnpm dev` でタイトルの「長押しで スタート」と
「タップで スタート」が膨らみ続けている

### Step 4: 配色を `fx.ts` に置く

`fx.ts` の `Projector` 型の上に足す。

```ts
/** クリアの紙吹雪の色。canvas でも DOM でも同じ 5 色を使う */
export const CONFETTI = ['#ffc233', '#1f9bff', '#ff4d5e', '#58c46b', '#b27bff'] as const;
```

5 か所の定数を消して `import { CONFETTI } from '$lib/fx';` にする。`SoloResult.svelte` は `COLORS` を `CONFETTI` に
置き換える（`COLORS[i % COLORS.length]` → `CONFETTI[i % CONFETTI.length]`）。`Particles.burst` の `color` は
`string | string[]` なので、`as const` の readonly タプルをそのまま渡せない場合は `[...CONFETTI]` にするか、
`BurstOptions.color` を `string | readonly string[]` に広げる（後者が 1 か所で済む）。

4 色だった 3 か所（dog-guard / pin-rescue / snow-camp）は紫が増える。これは意図した統一。

確認 — `grep -rn "'#58c46b'" src/` が `src/lib/fx.ts` の 1 件だけ。`pnpm check` → `0 ERRORS`

### Step 5: 検証

確認 — `pnpm verify` → exit 0

## Test plan

自動テストは足さない（CSS と定数）。目視は各ステップに書いた。

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -rn "width: 48px" src/lib/` が 0 件（`app.css` の `.round` だけ）
- [ ] `grep -rn "@keyframes bob" src/` が 1 件（`app.css`）
- [ ] `grep -rn "'#58c46b'" src/` が 1 件（`fx.ts`）
- [ ] すべての `.svelte` が 200 行未満
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 017 の Status を更新した

## STOP conditions

- 001 が未実施（`PinRescue.svelte` の `restart()` に `clearTimeout` がない — 同じファイルを触るので順序を守る）
- `.round` という名前が既にどこかのゲームで使われている（`grep -rn "\.round\b\|class=\"round\|round " src/lib/games` で確かめ、
  あれば `.knob` にする）
- Step 3 のあとでボタンの膨らみが止まる（Svelte が `bob` を書き換えている。コンポーネントに `@keyframes bob` が
  残っていないか確かめる）

## Maintenance notes

- 新しい丸ボタンは `class="round …"` で、位置と色だけを自分の CSS に書く
- 紙吹雪の色を変えるなら `fx.ts` の `CONFETTI` だけ
