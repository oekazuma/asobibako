# Plan 022: 対戦の結果画面に紙吹雪と光線を出し、紙吹雪を 1 人用と共有する

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> `plans/README.md` は触らない（レビュー担当が管理する）。
>
> **Drift check（最初に実行）**:
> `git diff --stat 24e8c62..HEAD -- src/lib/components/ResultScreen.svelte src/lib/components/SoloResult.svelte`
> `ResultScreen.svelte` は 020 で変わっている **はず**（`wins` と `.tally`）。それ以外の差分は「Current state」と見比べる。

## Status

| 項目       | 値                           |
| ---------- | ---------------------------- |
| Priority   | P3                           |
| Effort     | S                            |
| Risk       | LOW（見た目だけ）            |
| Depends on | 020                          |
| Category   | direction                    |
| Planned at | commit `24e8c62`, 2026-09-23 |

## Why this matters

`SoloResult` は紙吹雪・回る光線・星で祝うのに、対戦の `ResultScreen` は「WIN!」の文字と静止した放射模様だけ。
アプリ名が Table Duel で、2 人で同じ画面を見る側が一世代古い。`SoloResult` の紙吹雪をそのまま
`Confetti.svelte` に切り出して両方で使い、勝った側の半分に回る光線を足す。

`.half.p2` は 180 度回っているので、紙吹雪が「下へ落ちる」動きは向かい側の人から見ても自分のほうへ落ちる。

## Current state

`src/lib/components/SoloResult.svelte:11-19`、`:23-35`、`:82-89`、`:161-166`（現状。紙吹雪）

```ts
/** 紙吹雪の位置・色・速さは毎回ばらつかせる */
const confetti = Array.from({ length: 36 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 1.2,
  duration: 2.2 + Math.random() * 1.6,
  color: CONFETTI[i % CONFETTI.length],
  tilt: Math.random() * 360
}));
```

```svelte
{#each confetti as c (c.id)}
  <span
    class="confetti"
    aria-hidden="true"
    style:left="{c.left}%"
    style:background={c.color}
    style:animation-delay="{c.delay}s"
    style:animation-duration="{c.duration}s"
    style:rotate="{c.tilt}deg"
  ></span>
{/each}
```

```css
.confetti {
  position: absolute;
  top: -20px;
  width: 12px;
  height: 18px;
  border-radius: 3px;
  animation: fall linear infinite;
}
@keyframes fall {
  to {
    translate: 0 110dvh;
    rotate: 720deg;
  }
}
```

`.rays`（`:71-80`）は `position: absolute; top: 50%; left: 50%; width: 180vmax; aspect-ratio: 1; background: repeating-conic-gradient(...); translate: -50% -50%; animation: spin 24s linear infinite;`、`@keyframes spin { to { rotate: 360deg } }`。
reduced-motion で `.rays, .confetti, ...` が `animation: none`。`CONFETTI` は `$lib/fx` から import。

`src/lib/components/ResultScreen.svelte`（020 のあと）— `{#each [2, 1] as const as player (player)} <div class="half result p{player}" class:won={winner === player}> ... </div>`、
`.half.result.won` の背景に静止した `repeating-conic-gradient` と `radial-gradient`。`.outcome` に `pop`。約 75 行。

`.half` は `app.css` で `position: relative; flex: 1; display: flex; ... overflow` 指定なし。

テスト — `dom` project がある。`GameShell.svelte.test.ts` が `ResultScreen` を間接的に mount する。

規約 — コメントは WHY だけ・日本語。`.svelte` は 200 行未満。prettier。markuplint。

## Commands you will need

| 目的   | コマンド                                                                         | 成功時                |
| ------ | -------------------------------------------------------------------------------- | --------------------- |
| テスト | `pnpm test:run --project dom`                                                    | pass                  |
| 型     | `pnpm check`                                                                     | `0 ERRORS 0 WARNINGS` |
| lint   | `pnpm lint`                                                                      | exit 0                |
| vitals | `pnpm vitals --diff`                                                             | exit 0                |
| まとめ | `pnpm verify`                                                                    | exit 0                |
| 目視   | `pnpm dev --port <空きポート>` → `/table-duel/games/lightning` と 1 人用のどれか | 後述                  |

## Scope

**In scope**

- `src/lib/components/Confetti.svelte`（新規）
- `src/lib/components/ResultScreen.svelte`
- `src/lib/components/SoloResult.svelte`
- `src/lib/components/ResultScreen.svelte.test.ts`（新規）

**Out of scope**

- `GameShell.svelte`、`TitleScreen.svelte`、各ゲーム
- canvas のパーティクル（`fx.ts`）を対戦ゲームの盤面に足すこと — オーバーレイ canvas が要る別の話
- 星（`SoloResult` の `.stars`）— 対戦側には出さない（WIN! の文字で足りる）

## Git workflow

- コミットは「Confetti に切り出し」「対戦の結果画面に足す」の 2 つ。英語の命令形 1 文、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: `Confetti.svelte` を切り出す

`src/lib/components/Confetti.svelte` を新規に作る。

```svelte
<script lang="ts">
  import { CONFETTI } from '$lib/fx';

  /** 落ちる距離。半分の画面では枠の外へ出れば十分なので、使う側が指定する */
  let { count = 36, fall = '110dvh' }: { count?: number; fall?: string } = $props();

  /** 紙吹雪の位置・色・速さは毎回ばらつかせる */
  const pieces = Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2.2 + Math.random() * 1.6,
    color: CONFETTI[i % CONFETTI.length],
    tilt: Math.random() * 360
  }));
</script>

{#each pieces as c (c.id)}
  <span
    class="confetti"
    aria-hidden="true"
    style:--fall={fall}
    style:left="{c.left}%"
    style:background={c.color}
    style:animation-delay="{c.delay}s"
    style:animation-duration="{c.duration}s"
    style:rotate="{c.tilt}deg"
  ></span>
{/each}

<style>
  .confetti {
    position: absolute;
    top: -20px;
    width: 12px;
    height: 18px;
    border-radius: 3px;
    animation: fall linear infinite;
  }

  @keyframes fall {
    to {
      translate: 0 var(--fall);
      rotate: 720deg;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .confetti {
      animation: none;
    }
  }
</style>
```

`SoloResult.svelte` は `confetti` の配列・`{#each confetti ...}`・`.confetti` の CSS・`@keyframes fall`・reduced-motion の
`.confetti` を消し、`{#if cleared}` の中で `<Confetti />` を呼ぶ。`CONFETTI` の import が不要になれば消す。

確認 — `pnpm check` → `0 ERRORS 0 WARNINGS`、`pnpm lint` → exit 0。`pnpm dev` で 1 人用のどれかをクリアし、紙吹雪が以前と同じに降る

### Step 2: 対戦の結果画面に紙吹雪と光線を足す

`ResultScreen.svelte` の勝った側に足す。

```svelte
  <div class="half result p{player}" class:won={winner === player}>
    {#if winner === player}
      <div class="rays" aria-hidden="true"></div>
      <Confetti count={24} fall="120cqh" />
    {/if}
    <span class="outcome sticker" role="status">…</span>
```

CSS — `.half.result { overflow: hidden; }` を足す（紙吹雪と光線を半分の中に閉じ込める）。`.rays` は `SoloResult` と同じ
（`width: 180vmax` は半分の中でも十分大きい）。`.outcome` / `.sub` / `.tally` / `.again` に `position: relative;` を足して
光線の上に出す。`@keyframes spin` と reduced-motion の `.rays` を足す。`.half.result.won` の背景の静止した
`repeating-conic-gradient` は、回る `.rays` と重なるので消し、`radial-gradient(circle, #fff3c4, var(--gold) 70%)` だけ残す。

`120cqh` は `.stage`（コンテナ）の高さの 1.2 倍。半分の高さの 2.4 倍落ちるので必ず外へ出る。

確認 — `pnpm check` → `0 ERRORS 0 WARNINGS`、`pnpm lint` → exit 0、`pnpm vitals --diff` → exit 0、
`wc -l src/lib/components/ResultScreen.svelte src/lib/components/SoloResult.svelte` が 200 未満

### Step 3: テスト

`src/lib/components/ResultScreen.svelte.test.ts` を新規に作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import ResultScreen from './ResultScreen.svelte';

describe('ResultScreen', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('勝った側にだけ紙吹雪と光線が出る', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(ResultScreen, { target, props: { winner: 2, wins: { 1: 0, 2: 1 }, onagain: () => {} } });
    flushSync();
    expect(target.querySelectorAll('.half.p2 .confetti')).toHaveLength(24);
    expect(target.querySelector('.half.p2 .rays')).not.toBeNull();
    expect(target.querySelectorAll('.half.p1 .confetti')).toHaveLength(0);
    expect(target.querySelector('.half.p1 .rays')).toBeNull();
    unmount(app);
  });
});
```

確認 — `pnpm test:run --project dom src/lib/components/ResultScreen.svelte.test.ts` → 1 件 pass

### Step 4: 目視と検証

`pnpm dev --port <空きポート>` で `/table-duel/games/lightning` を開き、マウスで始めて決着させる。勝った側の半分に
光線が回り、紙吹雪がその人のほうへ落ちる。負けた側は今までどおり灰色。向かい側（上半分）が勝ったときも、
紙吹雪が画面の上端（向かいの人の手前）へ向かって落ちる。`SoloResult` の紙吹雪も以前と同じ。

確認 — `pnpm verify` → exit 0

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `src/lib/components/Confetti.svelte` が存在し、`SoloResult.svelte` と `ResultScreen.svelte` の両方が `<Confetti` を使う
- [ ] `grep -rn "@keyframes fall" src/lib/components/` が `Confetti.svelte` の 1 件だけ
- [ ] `ResultScreen.svelte.test.ts` が pass
- [ ] `ResultScreen.svelte` と `SoloResult.svelte` が 200 行未満
- [ ] `git status` で In scope 以外が変わっていない

## STOP conditions

- 020 が未実施（`ResultScreen.svelte` に `wins` がない）
- `.half` の `overflow: hidden` で ✕ / ミュートの `.edge` ボタンが隠れる（`.edge` は `GameShell` の `main` 直下で
  `.half` の外にあるはずだが、隠れたら報告）

## Maintenance notes

- 紙吹雪の枚数と落下距離は使う側が指定する。1 人用は 36 枚 / `110dvh`、対戦は半分なので 24 枚 / `120cqh`
- 星（`.stars`）を対戦側にも出したくなったら、`SoloResult` から同じように切り出す

## 実行時の変更

- `Confetti.svelte` の `Array.from({ length: count }, …)` は svelte-check の `state_referenced_locally` に当たるので、`// svelte-ignore state_referenced_locally` を付けた（`count` は初期値だけ使う）
