# Plan 019: 一覧のカードに到達レベルを出し、100 面クリアを保存できるようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> `plans/README.md` は触らない（レビュー担当が管理する）。
>
> **Drift check（最初に実行）**:
> `git diff --stat 24e8c62..HEAD -- src/lib/levels.ts src/lib/components/SoloShell.svelte src/routes/+page.svelte src/lib/components/SoloShell.svelte.test.ts`
> 変わっていたら「Current state」の抜粋と見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                  |
| ---------- | ----------------------------------------------------------------------------------- |
| Priority   | P2                                                                                  |
| Effort     | S                                                                                   |
| Risk       | LOW〜MED（`+page.svelte` からカードを切り出す。見た目が変わらないことを目視で見る） |
| Depends on | none                                                                                |
| Category   | direction                                                                           |
| Planned at | commit `24e8c62`, 2026-09-23                                                        |

## Why this matters

1 人用ゲームの到達レベルは `localStorage` の `table-duel:level:<id>` に保存されるが、読むのは `SoloShell` だけ。
一覧の 4 枚の 1 人用カードは全部同じ見た目で、「レベル 37 まで来た」が入口で見えない。100 面という直近最大の
投資を、ホーム画面（一覧）に見せる。

もう 1 つ、`SoloShell.finish()` は `won && !complete` のときだけ保存するので、レベル 100 をクリアしても
保存値は 100 のままで、「100 に到達した」と「100 をクリアした」を区別できない。`MAX_LEVEL + 1`（101）を
「ぜんぶクリア」の印として保存する。

`+page.svelte` は 198 行で、svelte-vitals の 200 行制限まで 2 行しかない。チップを足すには、カード 1 枚を
`GameCard.svelte` に切り出す必要がある。

## Current state

`src/lib/levels.ts`（現状の全文は 41 行。`MAX_LEVEL = 100`、`difficulty`、`lerp`、`Rng`）。

`src/lib/components/SoloShell.svelte:14`、`:32-48`、`:50-57`（現状）

```ts
const key = $derived(`table-duel:level:${meta.id}`);
// ...
function finish(won: boolean) {
  // 演出中に ✕ で抜けたあとに届く遅れた onfinish は捨てる
  if (screen !== 'playing') return;
  cleared = won;
  complete = won && level >= MAX_LEVEL;
  if (won && !complete) {
    level += 1;
    best = Math.max(best, level);
    try {
      localStorage.setItem(key, String(best));
    } catch {
      // 保存できなくても、この場では次のレベルへ進める
    }
  }
  screen = 'result';
  settle.begin();
}

onMount(() => {
  try {
    best = level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number(localStorage.getItem(key))) || 1));
  } catch {
    // プライベートブラウズでは 1 から
  }
  return settle.listen();
});
```

`src/routes/+page.svelte:24-45`（現状。カードの markup）

```svelte
{#each sections as section (section.title)}
  <section>
    <h2 class="section sticker">{section.title}</h2>
    <ul class="cards">
      {#each section.list as game, i (game.id)}
        <li style:--delay="{i * 70}ms">
          <a class="card" href={resolve('/games/[id]', { id: game.id })}>
            <div class="thumb"><game.Thumb /></div>
            <div class="body">
              <h3>{game.name}</h3>
              <p class="desc">{game.description}</p>
              <p class="meta">
                <span class="chip">{game.players}人</span>
                <span class="chip">{game.minutes}</span>
              </p>
            </div>
          </a>
        </li>
      {/each}
    </ul>
  </section>
{/each}
```

同 `:113-180` に `.card`、`.card:active`、`.thumb`、`.body`、`.body h3`、`.desc`、`.meta`、`.chip` の CSS がある
（`li` の `rise` アニメーションと `.cards` のグリッドは `+page.svelte` に残す）。

`src/lib/components/SoloShell.svelte.test.ts`（009 で作成）— `it.each([['5.5', 5], ['abc', 1], ['9999', 100], ['0', 1]])`
で保存値の丸めを見ている。`hooks` / `StubGame` / `StubHowto` は `src/lib/test/` にある。

このアプリはプリレンダーされる（`+layout.ts` の `prerender = true`）。localStorage はサーバーにないので、
mount 後に読む。`AppUpdate.svelte` が同じ理由で `onMount(() => (lastError = recall()))` としている。

規約 — コメントは WHY だけ・日本語。`.svelte` は 200 行未満。`src/lib/*` のディレクトリは kebab-case。prettier。

## Commands you will need

| 目的   | コマンド                                        | 成功時                              |
| ------ | ----------------------------------------------- | ----------------------------------- |
| テスト | `pnpm test:run --project dom`                   | pass                                |
| 型     | `pnpm check`                                    | `0 ERRORS 0 WARNINGS`               |
| lint   | `pnpm lint`                                     | exit 0                              |
| vitals | `pnpm vitals --diff`                            | exit 0                              |
| まとめ | `pnpm verify`                                   | exit 0                              |
| 目視   | `pnpm dev --port <空きポート>` → `/table-duel/` | カードの見た目が以前と同じ + チップ |

## Scope

**In scope**

- `src/lib/levels.ts`
- `src/lib/components/SoloShell.svelte`
- `src/lib/components/SoloShell.svelte.test.ts`（1 件追加）
- `src/routes/+page.svelte`
- `src/lib/components/GameCard.svelte`（新規）
- `src/lib/components/GameCard.svelte.test.ts`（新規）

**Out of scope**

- `SoloResult.svelte`、`SoloTitle.svelte`
- 各ゲーム
- 一覧の並びやセクション分け

## Git workflow

- コミットは「保存の形」「カードの切り出しとチップ」の 2 つ。英語の命令形 1 文、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: 保存の読み書きを `levels.ts` に置く

`levels.ts` の末尾に足す。

```ts
/** 到達レベルの保存先。ゲームごと */
export const levelKey = (id: string) => `table-duel:level:${id}`;

/** MAX_LEVEL をクリアしたことの印として保存する値 */
export const ALL_CLEAR = MAX_LEVEL + 1;

/** 保存された到達レベル（1..ALL_CLEAR）。壊れていたり読めなければ 1 */
export function savedLevel(id: string): number {
  try {
    return Math.min(ALL_CLEAR, Math.max(1, Math.floor(Number(localStorage.getItem(levelKey(id)))) || 1));
  } catch {
    return 1;
  }
}

export function saveLevel(id: string, level: number): void {
  try {
    localStorage.setItem(levelKey(id), String(level));
  } catch {
    // プライベートブラウズでは保存できない。その場では進めてよい
  }
}
```

確認 — `pnpm check` → `0 ERRORS 0 WARNINGS`

### Step 2: `SoloShell` を載せ替え、100 面クリアで `ALL_CLEAR` を保存する

`SoloShell.svelte` を次のように変える。

- `import { ALL_CLEAR, MAX_LEVEL, saveLevel, savedLevel } from '$lib/levels';`
- `const key = $derived(...)` を消す
- `finish()` の `if (won && !complete) { ... }` を次にする

```ts
if (won) {
  // 100 をクリアしたら ALL_CLEAR を残し、一覧で「ぜんぶクリア」と出せるようにする
  saveLevel(meta.id, Math.max(savedLevel(meta.id), complete ? ALL_CLEAR : level + 1));
  if (!complete) {
    level += 1;
    best = Math.max(best, level);
  }
}
```

- `onMount` の読み取りを `best = level = Math.min(MAX_LEVEL, savedLevel(meta.id));` にする（try/catch は
  `savedLevel` の中にあるので不要）

確認 — `pnpm test:run --project dom src/lib/components/SoloShell.svelte.test.ts` → 既存 6 件 pass（`'9999'` は
`savedLevel` が 101 に丸め、`Math.min(MAX_LEVEL)` で 100 になる）

### Step 3: 100 面クリアのテストを足す

`SoloShell.svelte.test.ts` に 1 件足す（既存の `show()` / `start()` / `hooks` を使う）。

```ts
it('レベル 100 をクリアすると ALL_CLEAR を保存し、ぜんぶクリアと出す', () => {
  localStorage.setItem('table-duel:level:stub', '100');
  const { target, app } = show();
  start(target);
  hooks.solo!(true);
  flushSync();
  expect(localStorage.getItem('table-duel:level:stub')).toBe('101');
  expect(target.textContent).toContain('ぜんぶクリア');
  unmount(app);
});
```

確認 — `pnpm test:run --project dom src/lib/components/SoloShell.svelte.test.ts` → 7 件 pass

### Step 4: カードを `GameCard.svelte` に切り出し、チップを足す

`src/lib/components/GameCard.svelte` を新規に作る。`+page.svelte` の `<a class="card">…</a>` の markup と、
`.card` / `.card:active` / `.thumb` / `.body` / `.body h3` / `.desc` / `.meta` / `.chip` の CSS と、
`@media (prefers-reduced-motion: reduce)` の `.card { transition: none }` をそのまま移す。

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import type { GameMeta } from '$lib/games';
  import { ALL_CLEAR, savedLevel } from '$lib/levels';

  let { game }: { game: GameMeta } = $props();

  /** 到達レベル。プリレンダーでは分からないので mount 後に読む */
  let reached = $state<number | null>(null);
  onMount(() => {
    if (game.players === 1) reached = savedLevel(game.id);
  });
</script>

<a class="card" href={resolve('/games/[id]', { id: game.id })}>
  <div class="thumb"><game.Thumb /></div>
  <div class="body">
    <h3>{game.name}</h3>
    <p class="desc">{game.description}</p>
    <p class="meta">
      <span class="chip">{game.players}人</span>
      <span class="chip">{game.minutes}</span>
      {#if reached !== null && reached > 1}
        <span class="chip reached" class:done={reached >= ALL_CLEAR}>
          {reached >= ALL_CLEAR ? 'ぜんぶクリア' : `レベル ${reached}`}
        </span>
      {/if}
    </p>
  </div>
</a>
```

`reached > 1` のときだけ出すのは、遊んだことのないゲームに「レベル 1」を出しても意味がないため。

チップの色は `.chip.reached { background: var(--p1-soft); color: var(--p1-deep); }`、
`.chip.done { background: var(--gold); color: var(--ink); }`。

`+page.svelte` は `{#each section.list as game, i (game.id)}` の中を `<li style:--delay="{i * 70}ms"><GameCard {game} /></li>`
にし、移した CSS を消す。`resolve` の import は `+page.svelte` で不要になれば消す。

確認 — `pnpm check` → `0 ERRORS 0 WARNINGS`、`pnpm lint` → exit 0、`pnpm vitals --diff` → exit 0、
`wc -l src/routes/+page.svelte src/lib/components/GameCard.svelte` がどちらも 200 未満

### Step 5: カードのテスト

`src/lib/components/GameCard.svelte.test.ts` を新規に作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import StubHowto from '$lib/test/StubHowto.svelte';
import GameCard from './GameCard.svelte';

const solo = {
  id: 'stub',
  name: 'スタブ',
  description: '',
  minutes: '1分',
  players: 1 as const,
  Thumb: StubHowto,
  load: async () => ({ Game: StubHowto, Howto: StubHowto })
};

function show(game = solo) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(GameCard, { target, props: { game } });
  flushSync();
  return { target, app };
}

describe('GameCard', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('遊んだことがなければ到達レベルは出さない', () => {
    const { target, app } = show();
    expect(target.querySelector('.reached')).toBeNull();
    unmount(app);
  });

  it('到達レベルを出す', () => {
    localStorage.setItem('table-duel:level:stub', '37');
    const { target, app } = show();
    expect(target.querySelector('.reached')?.textContent?.trim()).toBe('レベル 37');
    unmount(app);
  });

  it('100 をクリアしていれば ぜんぶクリア', () => {
    localStorage.setItem('table-duel:level:stub', '101');
    const { target, app } = show();
    expect(target.querySelector('.reached')?.textContent?.trim()).toBe('ぜんぶクリア');
    expect(target.querySelector('.reached')?.classList.contains('done')).toBe(true);
    unmount(app);
  });

  it('2 人用のカードには出さない', () => {
    localStorage.setItem('table-duel:level:stub', '37');
    const { target, app } = show({ ...solo, players: 2 as const });
    expect(target.querySelector('.reached')).toBeNull();
    unmount(app);
  });
});
```

`resolve()`（`$app/paths`）が test project で解決できなければ `vi.mock('$app/paths', () => ({ resolve: (p: string) => p }))`
を先頭に足す（`SoloShell.svelte.test.ts` では不要だった）。

確認 — `pnpm test:run --project dom src/lib/components/GameCard.svelte.test.ts` → 4 件 pass

### Step 6: 目視と検証

`pnpm dev --port <空きポート>` で `/table-duel/` を開く。カードの見た目（枠・影・押し込み・サムネ）が以前と同じで、
1 人用のカードに `localStorage.setItem('table-duel:level:pin-rescue', '37')` して読み直すと「レベル 37」の青いチップ、
`'101'` なら金の「ぜんぶクリア」が出る。2 人用のカードには出ない。

確認 — `pnpm verify` → exit 0

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -n "savedLevel\|saveLevel\|ALL_CLEAR" src/lib/levels.ts` が 3 つとも export されている
- [ ] `grep -n "localStorage" src/lib/components/SoloShell.svelte` が 0 件（読み書きは `levels.ts` 経由）
- [ ] `src/lib/components/GameCard.svelte` が存在し、`+page.svelte` が `<GameCard` を使う
- [ ] `+page.svelte` と `GameCard.svelte` が 200 行未満
- [ ] 新規テスト 5 件（SoloShell 1 + GameCard 4）が pass
- [ ] `git status` で In scope 以外が変わっていない

## STOP conditions

- 「Current state」の抜粋と一致しない
- `pnpm vitals --diff` が `GameCard.svelte` に警告を出す（内容を報告）
- 既存の `SoloShell` テストが Step 2 のあとで落ちる

## Maintenance notes

- 保存値の意味は `levels.ts` に集約した。`ALL_CLEAR` を変えるなら `SoloShell` と `GameCard` の両方が追従する
- `GameCard` の `reached` は mount 時に 1 回読むだけ。一覧に戻ったときは `+page` が作り直されるので最新になる

## 実行時の変更

- `GameCard.svelte.test.ts` のスタブは `Game: StubGame`（`$lib/test/StubGame.svelte`）にし、`show(game: GameMeta = solo)` と型を付けた。`StubHowto` は `Component<SoloProps>` を満たさない
