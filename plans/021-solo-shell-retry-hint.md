# Plan 021: ↻（やりなおし）と「いまやること」の吹き出しを SoloShell に移す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> `plans/README.md` は触らない（レビュー担当が管理する）。
>
> **Drift check（最初に実行）**:
> `git diff --stat 24e8c62..HEAD -- src/lib/games.ts src/lib/components/SoloShell.svelte src/lib/games/pin-rescue/PinRescue.svelte src/lib/games/dog-guard/DogGuard.svelte src/lib/games/dog-guard/Hud.svelte src/lib/games/snow-camp/SnowCamp.svelte src/lib/games/snow-camp/Hud.svelte src/lib/test/StubGame.svelte`
> `SoloShell.svelte` は 019 で変わっている **はず**（`savedLevel` / `saveLevel` を使う）。それ以外の差分は
> 「Current state」と見比べる。

## Status

| 項目       | 値                                                                   |
| ---------- | -------------------------------------------------------------------- |
| Priority   | P2                                                                   |
| Effort     | M                                                                    |
| Risk       | MED（4 ゲームの HUD を触る。配置は横向き回転をまたぐので目視が要る） |
| Depends on | 019                                                                  |
| Category   | direction                                                            |
| Planned at | commit `24e8c62`, 2026-09-23                                         |

## Why this matters

↻（やりなおし）は pin-rescue と dog-guard に同じ markup が 2 つあり、gate-run と snow-camp にはない。
ひとことのヒントも dog-guard（面ごとの `tip`）と snow-camp（生きた `objective()`）の 2 本だけ。
遊び手はひらがなを読む子どもで、詰まった面に ↻ がなく、何をすればいいかも出ないところで離れる。
シェルが ↻ と吹き出しを持てば、4 本とも同じ場所に同じ見た目で出て、5 本目の 1 人用ゲームも
自動で両方を持つ。README の「既存のゲームには触らない」契約も、シェルの部品なら守れる。

↻ はシェルの `round += 1` で `{#key round}` がゲームを作り直すだけでよい。各ゲームの `restart()` は
不要になる。

## Current state

`src/lib/games.ts:27-32`（現状）

```ts
export interface SoloProps {
  /** 1 から数える。ゲームはこの数で難しさや面を選ぶ（面の数より大きければ一周して難しくしてよい） */
  level: number;
  /** クリアかしっぱいが決まったら 1 回だけ呼ぶ */
  onfinish: (cleared: boolean) => void;
}
```

`src/lib/components/SoloShell.svelte`（019 のあと。要点）— `screen` / `round` / `level` / `best` の `$state`、
`start()` が `round += 1; screen = 'playing'`、テンプレートは

```svelte
  {#if screen === 'playing'}
    {#key round}
      <Game {level} onfinish={finish} />
    {/key}
    <!-- 遊んでいる途中でもやめられるよう、小さく隅に置く。一覧ではなくタイトルへ戻る -->
    <button class="round corner quit" onclick={() => (screen = 'title')} aria-label="やめる">✕</button>
  {:else}
```

CSS は `.corner { position: absolute; top: max(12px, env(safe-area-inset-top)); z-index: 5; }`、
`.back, .quit { left: max(12px, env(safe-area-inset-left)); }`、`.mute { right: max(12px, env(safe-area-inset-right)); }`、
`.settling .corner, .settling :global(.go) { pointer-events: none; }`。`.round` は `app.css` の共通クラス（48px の丸ボタン）。

`src/lib/games/pin-rescue/PinRescue.svelte`（現状の要点）— `restart()`（`:45-52`、`clearTimeout(finishTimer)` と
`game = fresh()` など）、`<button class="round retry" onpointerdown={(e) => e.stopPropagation()} onclick={restart} aria-label="やりなおし">↻</button>`（`:107-109`）、
`.retry { position: absolute; top: 12px; right: 12px; background: var(--gold); font-size: 24px; }`（`:165-170`）。
`onMount` の後始末に `clearTimeout(finishTimer)` がある（残す）。

`src/lib/games/dog-guard/DogGuard.svelte`（現状の要点）— `const tip = $derived(levelFor(level).tip);`（`:31`）、
`restart()`（`:138-143`、`if (game.phase === 'done') return;` で始まる）、`<Hud {level} {phase} {ink} {left} {tip} onretry={restart} />`（`:156`）。

`src/lib/games/dog-guard/Hud.svelte`（現状の全文は 87 行）— props `level / phase / ink / left / tip / onretry`。
`phase === 'draw'` のとき `<span class="tip">{tip}</span>` とインクのバー、それ以外はカウント。末尾に
`<button class="round retry" ... onclick={onretry} aria-label="やりなおし">↻</button>` と `.tip` / `.retry` の CSS。

`src/lib/games/snow-camp/SnowCamp.svelte`（現状の要点）— `let hint = $state('');`（`:29`）、`frame()` の中で
`const todo = objective(game); if (hint !== todo.text) hint = todo.text;`（`:90-91`）、`<Hud {level} {wallet} {goal} {hint} />`（`:128`）。

`src/lib/games/snow-camp/Hud.svelte`（現状の全文は 72 行）— props `level / wallet / goal / hint`。
`{#key hint}<p class="hint sticker" role="status">{hint}</p>{/key}` と `.hint` の CSS（`top: 62px; left: 50%; ... background: var(--gold); box-shadow: var(--lift); font-size: clamp(14px, min(2.6cqh, 4.6cqw), 24px); white-space: nowrap; translate: -50% 0; animation: pop 420ms var(--spring);`）、
`@keyframes pop { from { scale: 0.4; } }`、reduced-motion で `animation: none`。

`src/lib/test/StubGame.svelte`（009）— `let { level = 0, onfinish }: { level?: number; onfinish: (v: never) => void } = $props();`
を `untrack` の中で `hooks.level` / `hooks.solo` / `hooks.duel` に写す。`src/lib/test/hooks.ts` は
`{ level: number; solo?: ...; duel?: ... }`。

`src/lib/components/SoloShell.svelte.test.ts`（009 + 019）— `show()` / `start(target)` / `hooks`。

規約 — コメントは WHY だけ・日本語。`.svelte` は 200 行未満（`SoloShell` は 019 後で約 105 行）。prettier。

## Commands you will need

| 目的   | コマンド                                             | 成功時                |
| ------ | ---------------------------------------------------- | --------------------- |
| テスト | `pnpm test:run`                                      | pass                  |
| 型     | `pnpm check`                                         | `0 ERRORS 0 WARNINGS` |
| lint   | `pnpm lint`                                          | exit 0                |
| vitals | `pnpm vitals --diff`                                 | exit 0                |
| まとめ | `pnpm verify`                                        | exit 0                |
| 目視   | `pnpm dev --port <空きポート>` → 4 つの 1 人用ゲーム | 後述                  |

## Scope

**In scope**

- `src/lib/games.ts`（`SoloProps` に `onhint` を足すだけ）
- `src/lib/components/SoloShell.svelte`
- `src/lib/components/SoloShell.svelte.test.ts`（2 件追加）
- `src/lib/test/StubGame.svelte`、`src/lib/test/hooks.ts`
- `src/lib/games/pin-rescue/PinRescue.svelte`
- `src/lib/games/dog-guard/DogGuard.svelte`、`src/lib/games/dog-guard/Hud.svelte`
- `src/lib/games/snow-camp/SnowCamp.svelte`、`src/lib/games/snow-camp/Hud.svelte`

**Out of scope**

- `engine.ts` はどれも触らない
- gate-run と pin-rescue に新しいヒントの文言を足すこと（`onhint` を呼ばなければ吹き出しは出ない）
- 2 人用（`GameShell`）
- README（`SoloProps` の例は変わらない。`onhint` は任意）

## Git workflow

- コミットは「シェルに ↻ と吹き出し」「pin-rescue / dog-guard の ↻ を外す」「dog-guard / snow-camp のヒントを渡す」の 3 つ。
  英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: `SoloProps` に `onhint` を足す

```ts
export interface SoloProps {
  level: number;
  onfinish: (cleared: boolean) => void;
  /** 画面の上に出す「いまやること」。空文字で消す。呼ばなければ何も出ない */
  onhint?: (text: string) => void;
}
```

確認 — `pnpm check` → `0 ERRORS`

### Step 2: `SoloShell` に ↻ と吹き出しを足す

script に `let hint = $state('');` を足し、`start()` の先頭で `hint = '';` にする。`retry()` を足す。

```ts
/** 同じレベルをやり直す。ゲームは {#key round} で作り直され、演出中のタイマーは unmount で消える */
function retry() {
  hint = '';
  round += 1;
}
```

テンプレートの `playing` ブロックを次にする。

```svelte
  {#if screen === 'playing'}
    {#key round}
      <Game {level} onfinish={finish} onhint={(text) => (hint = text)} />
    {/key}
    {#if hint}
      {#key hint}
        <p class="hint sticker" role="status">{hint}</p>
      {/key}
    {/if}
    <!-- 遊んでいる途中でもやめられるよう、小さく隅に置く。一覧ではなくタイトルへ戻る -->
    <button class="round corner quit" onclick={() => (screen = 'title')} aria-label="やめる">✕</button>
    <button class="round corner retry" onclick={retry} aria-label="やりなおし">↻</button>
  {:else}
```

CSS — `.retry { right: max(12px, env(safe-area-inset-right)); background: var(--gold); font-size: 24px; }` と、
snow-camp の `Hud.svelte` から `.hint` / `@keyframes pop` / reduced-motion をそのまま移す（`top` は `62px` から
`max(72px, calc(env(safe-area-inset-top) + 60px))` にして、↻ と ✕ の下に出す）。`z-index: 5` を足す。

`.settling .corner` の並びに `.retry` は含まれる（`corner` クラスを付けているため）。

確認 — `pnpm check` → `0 ERRORS 0 WARNINGS`、`pnpm lint` → exit 0、`wc -l src/lib/components/SoloShell.svelte` が 200 未満

### Step 3: シェルのテスト

`StubGame.svelte` の props に `onhint` を足し、`hooks.hint = onhint` を写す。`hooks.ts` の型に `hint?: (text: string) => void` を足す。

`SoloShell.svelte.test.ts` に 2 件足す。

```ts
it('↻ で同じレベルをやり直す', () => {
  const { target, app } = show();
  start(target);
  const before = hooks.solo;
  (target.querySelector('button.retry') as HTMLButtonElement).click();
  flushSync();
  expect(hooks.level).toBe(1);
  expect(hooks.solo).not.toBe(before);
  expect(target.querySelector('[data-testid="game"]')).not.toBeNull();
  unmount(app);
});

it('onhint の文字が吹き出しに出て、空文字で消える', () => {
  const { target, app } = show();
  start(target);
  hooks.hint!('たき火へ はこぼう');
  flushSync();
  expect(target.querySelector('.hint')?.textContent).toBe('たき火へ はこぼう');
  hooks.hint!('');
  flushSync();
  expect(target.querySelector('.hint')).toBeNull();
  unmount(app);
});
```

確認 — `pnpm test:run --project dom src/lib/components/SoloShell.svelte.test.ts` → 9 件 pass（7 + 2）

### Step 4: pin-rescue と dog-guard の ↻ を外す

pin-rescue — `restart()` 関数、`<button class="round retry" ...>` の行、`.retry` の CSS を消す。`clearTimeout(finishTimer)`
は `onMount` の後始末に残す（`restart()` の中の分は関数ごと消える）。`done` フラグはそのまま。

dog-guard — `DogGuard.svelte` の `restart()` を消し、`<Hud ... onretry={restart} />` から `onretry` を外す。
`Hud.svelte` から `onretry` の prop、`<button class="round retry" ...>`、`.retry` の CSS を消す。

確認 — `grep -rn "やりなおし" src/lib/games/` が 0 件、`pnpm check` → `0 ERRORS 0 WARNINGS`

### Step 5: dog-guard と snow-camp のヒントをシェルに渡す

dog-guard — `DogGuard.svelte` の props を `let { level, onfinish, onhint }: SoloProps = $props();` にし、
`onMount` の先頭で `onhint?.(levelFor(level).tip);` を呼ぶ。線が固まって `defend` に入ったら消したいので、
`up` フックの `if (finishStroke(game)) { sounds.go(); onhint?.(''); }` にする。`const tip = $derived(...)` と
`<Hud ... {tip} />` の `tip` を外し、`Hud.svelte` から `tip` の prop・`<span class="tip">`・`.tip` の CSS を消す。

snow-camp — `SnowCamp.svelte` の props を `let { level, onfinish, onhint }: SoloProps = $props();` にし、
`let hint = $state('')` を消して、`frame()` の `if (hint !== todo.text) hint = todo.text;` を
`if (last !== todo.text) { last = todo.text; onhint?.(last); }`（`let last = '';` をモジュール側に）にする。
`<Hud {level} {wallet} {goal} />` にし、`Hud.svelte` から `hint` の prop・`{#key hint}…{/key}`・`.hint` の CSS・
`@keyframes pop`・reduced-motion のブロックを消す（`.hud` / `.chip` / `.wallet` は残す）。

確認 — `pnpm check` → `0 ERRORS 0 WARNINGS`、`pnpm lint` → exit 0、`pnpm vitals --diff` → exit 0、
`pnpm test:run` → 全部 pass

### Step 6: 目視

`pnpm dev --port <空きポート>` で 4 つの 1 人用ゲームを開く。

1. どのゲームも右上に金色の ↻、左上に ✕。↻ で同じレベルが最初から始まる
2. dog-guard — 線を引く前に「線で 犬を かこんで まもろう」のような吹き出しが上に出て、指を離して線が固まると消える
3. snow-camp — 「いまやること」の吹き出しが上に出て、状況で切り替わる（以前は Hud の中、いまはシェル）
4. pin-rescue / gate-run — 吹き出しは出ない（ヒントを渡していない）。↻ は効く
5. iPad の横向きエミュレーション（`resize_window` で横長 + タッチ）でも ↻・✕・吹き出しが盤面の上端に収まる

確認 — 上の 5 つ。`pnpm verify` → exit 0

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -rn "やりなおし" src/lib/games/` が 0 件、`grep -n "やりなおし" src/lib/components/SoloShell.svelte` が 1 件
- [ ] `grep -rn "onhint" src/lib/games/dog-guard/DogGuard.svelte src/lib/games/snow-camp/SnowCamp.svelte` がそれぞれ 1 件以上
- [ ] `grep -n "class=\"hint" src/lib/games/snow-camp/Hud.svelte src/lib/games/dog-guard/Hud.svelte` が 0 件
- [ ] `SoloShell.svelte.test.ts` が 9 件 pass
- [ ] すべての `.svelte` が 200 行未満
- [ ] `git status` で In scope 以外が変わっていない

## STOP conditions

- 019 が未実施（`SoloShell.svelte` に `savedLevel` がない）
- `restart()` を消すと、ほかから参照されていて消せない（参照元を報告）
- Step 6 の 5 で吹き出しが ↻ や ✕ と重なる（`top` の値を報告）

## Maintenance notes

- 新しい 1 人用ゲームは `onhint` を呼ぶだけで吹き出しが出る。呼ばなければ何も出ない
- ゲームが自前の ↻ を持つ必要はもうない。`round += 1` で作り直されるので、`createState` が冪等なら足りる

## 実行時の変更

- テスト「↻ で同じレベルをやり直す」は `hooks.solo` ではなく `hooks.hint` の同一性で作り直しを見る。`onfinish={finish}` は同じ関数を渡すので、`{#key round}` で作り直しても変わらない
