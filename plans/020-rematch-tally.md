# Plan 020: 再戦の勝敗タリーを結果画面に出す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> `plans/README.md` は触らない（レビュー担当が管理する）。
>
> **Drift check（最初に実行）**:
> `git diff --stat 24e8c62..HEAD -- src/lib/components/GameShell.svelte src/lib/components/ResultScreen.svelte src/lib/components/GameShell.svelte.test.ts`
> 変わっていたら「Current state」の抜粋と見比べ、食い違えば STOP。

## Status

| 項目       | 値                           |
| ---------- | ---------------------------- |
| Priority   | P2                           |
| Effort     | S                            |
| Risk       | LOW                          |
| Depends on | none                         |
| Category   | direction                    |
| Planned at | commit `24e8c62`, 2026-09-23 |

## Why this matters

2 人で「もう一度」を繰り返すと、そのセッションの勝敗は 2 人の頭の中にしかない。`GameShell` の `round` は
`{#key round}` でゲームを作り直すためだけに使われ、勝者を数えていない。シェルで勝ち数を数えて結果画面に
出せば、エンジンには一切触れずに「いま 3 勝 2 敗」が画面に残る。3 本勝負のようなモードはタイトル画面に
選択 UI が増えるので、今回はタリーだけ。

タイトルに戻る経路は ✕（一覧へ）しかなく、一覧から戻るとコンポーネントごと作り直されるので、
リセットの処理は要らない。

## Current state

`src/lib/components/GameShell.svelte:15-18`、`:48-53`、`:70-74`（現状）

```ts
  let screen = $state<'title' | 'playing' | 'result'>('title');
  let winner = $state<Player>(1);
  let round = $state(0);
  const settle = new Settle();
  // ...
  function finish(won: Player) {
    if (screen !== 'playing') return;
    winner = won;
    screen = 'result';
    settle.begin();
  }
  // ...
    {#if screen === 'title'}
      <TitleScreen name={meta.name} {Howto} {ready} onpaddown={padDown} onpadup={padUp} />
    {:else}
      <ResultScreen {winner} onagain={start} />
    {/if}
```

`src/lib/components/ResultScreen.svelte`（現状の全文は 61 行）

```svelte
<script lang="ts">
  import type { Player } from '$lib/player';

  let { winner, onagain }: { winner: Player; onagain: () => void } = $props();
</script>

{#each [2, 1] as const as player (player)}
  <div class="half result p{player}" class:won={winner === player}>
    <span class="outcome sticker" role="status">{winner === player ? 'WIN!' : 'LOSE'}</span>
    <span class="sub">{winner === player ? 'あなたの かち！' : 'あなたの まけ'}</span>
    <button class="pill p{player} again" onclick={onagain}>もう一度</button>
  </div>
{/each}
```

`.sub` は `font-size: clamp(15px, 2.6cqh, 22px); font-weight: 800;`。`.half.p2` は `app.css` で 180 度回る。

`src/lib/components/GameShell.svelte.test.ts`（009 で作成）— `show()` が `GameShell` を `StubGame` で mount し、
`pad(p)` / `playing()` を返す。`pointer(type, id, pointerType)` で合成イベントを作る。`src/lib/test/hooks.ts` の
`hooks.duel` に `StubGame` が受け取った `onfinish` が入る。

`src/lib/player.ts` に `Player = 1 | 2`。相手は `player === 1 ? 2 : 1`。

規約 — コメントは WHY だけ・日本語。`.svelte` は 200 行未満。prettier。

## Commands you will need

| 目的   | コマンド                                                                  | 成功時                |
| ------ | ------------------------------------------------------------------------- | --------------------- |
| テスト | `pnpm test:run --project dom src/lib/components/GameShell.svelte.test.ts` | pass                  |
| 型     | `pnpm check`                                                              | `0 ERRORS 0 WARNINGS` |
| lint   | `pnpm lint`                                                               | exit 0                |
| まとめ | `pnpm verify`                                                             | exit 0                |
| 目視   | `pnpm dev --port <空きポート>` → `/table-duel/games/hockey`               | 後述                  |

## Scope

**In scope**

- `src/lib/components/GameShell.svelte`
- `src/lib/components/ResultScreen.svelte`
- `src/lib/components/GameShell.svelte.test.ts`（1 件追加）

**Out of scope**

- `TitleScreen.svelte`、各ゲーム、`Pips.svelte`
- 3 本勝負・先取モード
- localStorage への保存（セッション内だけ）

## Git workflow

- コミット 1 つ。英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: `GameShell` で勝ち数を数える

```ts
/** このセッションの勝ち数。一覧に戻るとコンポーネントごと作り直されるので、リセットは要らない */
const wins = $state<Record<Player, number>>({ 1: 0, 2: 0 });

function finish(won: Player) {
  if (screen !== 'playing') return;
  winner = won;
  wins[won] += 1;
  screen = 'result';
  settle.begin();
}
```

`<ResultScreen {winner} {wins} onagain={start} />` にする。

確認 — `pnpm check` → 型エラーが `ResultScreen` の props で 1 件出る（次のステップで消える）

### Step 2: `ResultScreen` にタリーを出す

props に `wins: Record<Player, number>` を足し、`.sub` の下に 1 行足す。

```svelte
<span class="sub">{winner === player ? 'あなたの かち！' : 'あなたの まけ'}</span>
<span class="tally">{wins[player]}かち {wins[player === 1 ? 2 : 1]}まけ</span>
```

CSS は `.sub` に倣う。

```css
.tally {
  padding: 4px 16px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.7);
  font-size: clamp(13px, 2.2cqh, 18px);
  font-weight: 800;
}
```

確認 — `pnpm check` → `0 ERRORS 0 WARNINGS`、`pnpm lint` → exit 0

### Step 3: テスト

`GameShell.svelte.test.ts` に 1 件足す。既存の `show()` は `{ app, pad, playing }` を返すので、`target` も返すように
広げる（`return { app, pad, playing, target }`）。

```ts
it('もう一度を繰り返すと勝ち数が積み上がる', () => {
  const { app, pad, target } = show();
  pad(1).dispatchEvent(pointer('pointerdown', 1, 'mouse'));
  flushSync();
  vi.advanceTimersByTime(550);
  flushSync();
  hooks.duel!(1);
  flushSync();
  expect(target.querySelector('.half.p1 .tally')?.textContent).toBe('1かち 0まけ');
  expect(target.querySelector('.half.p2 .tally')?.textContent).toBe('0かち 1まけ');
  (target.querySelector('.half.p1 .again') as HTMLButtonElement).click();
  flushSync();
  hooks.duel!(2);
  flushSync();
  expect(target.querySelector('.half.p1 .tally')?.textContent).toBe('1かち 1まけ');
  unmount(app);
});
```

`hooks` を `$lib/test/hooks` から import する（まだなら）。「もう一度」の click は `settle` の `pointer-events: none`
とは無関係（DOM の `click()` は CSS を見ない）。

確認 — `pnpm test:run --project dom src/lib/components/GameShell.svelte.test.ts` → 5 件 pass

### Step 4: 目視と検証

`pnpm dev --port <空きポート>` で `/table-duel/games/hockey` を開き、マウスで始めて 1 点も入れずに…は時間がかかるので、
`/table-duel/games/lightning` か `feint-master` で決着させ、結果画面の「あなたの かち！」の下に「1かち 0まけ」が
出ること、「もう一度」で 2 回目を終えると数が増えることを見る。向かい側（上半分、180 度回転）でも読める位置にある。

確認 — `pnpm verify` → exit 0

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -n "wins\[won\] += 1" src/lib/components/GameShell.svelte` が 1 件
- [ ] `grep -n "class=\"tally\"" src/lib/components/ResultScreen.svelte` が 1 件
- [ ] `GameShell.svelte.test.ts` が 5 件 pass
- [ ] `git status` で In scope 以外が変わっていない

## STOP conditions

- 「Current state」の抜粋と一致しない
- `GameShell.svelte.test.ts` の `show()` の形が計画と違う（返り値に `target` がなく、足せない事情がある）

## Maintenance notes

- 022（結果画面の演出）が同じ `ResultScreen.svelte` を触る。022 はこの計画のあとに実行する
- 3 本勝負を足すなら、`wins` を見て `Math.max(...) >= n` でシリーズの決着を出す。タイトルの UI が要る
