# Plan 018: レベル選択の ◀ ▶ を長押しでリピートさせる

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> `plans/README.md` は触らない（レビュー担当が管理する）。
>
> **Drift check（最初に実行）**:
> `git diff --stat 24e8c62..HEAD -- src/lib/components/SoloTitle.svelte src/lib/components/SoloShell.svelte.test.ts vite.config.ts`
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

1 人用のゲームは 100 面あり、タイトルの ◀ ▶ で到達済みの面を選び直せる。ところがボタンは 1 回のタップで
±1 しか動かないので、レベル 60 の人が 5 面をもう一度遊ぶには 55 回タップする。100 面にした直近の投資が
生んだ摩擦で、直し方は「押しっぱなしで進む」だけでよい。グリッドで選ぶ案はタイトル画面に 2 枚目の
画面を足すことになるので、今回はやらない。

## Current state

`src/lib/components/SoloTitle.svelte:19-23`（現状）

```svelte
<span class="picker">
  <button class="step" onclick={() => (level -= 1)} disabled={level <= 1} aria-label="前のレベル">◀</button>
  <span class="level">レベル {level}</span>
  <button class="step" onclick={() => (level += 1)} disabled={level >= best} aria-label="次のレベル">▶</button>
</span>
```

`level` は `$bindable()` の prop、`best` はたどり着いた最大のレベル（`SoloShell` が渡す）。
コンポーネントは 119 行。

テスト基盤 — `vite.config.ts` の vitest には `unit`（node）と `dom`（happy-dom、`resolve.conditions: ['browser']`、
`include: ['src/**/*.svelte.test.ts', ...]`）の 2 project がある。`src/lib/components/SoloShell.svelte.test.ts` が
`mount` / `flushSync` / `vi.useFakeTimers()` を使う手本。テスト用の部品 `src/lib/test/StubHowto.svelte`（`<p>howto</p>`）
がある。

規約 — コメントは WHY だけ・日本語。`.svelte` は 200 行未満。prettier（`singleQuote`、`printWidth: 120`、
`trailingComma: none`）。markuplint が `.svelte` を検査する（`onpointer*` は許可済み）。

## Commands you will need

すべてリポジトリのルートで実行する。

| 目的   | コマンド                                                                  | 成功時                |
| ------ | ------------------------------------------------------------------------- | --------------------- |
| テスト | `pnpm test:run --project dom src/lib/components/SoloTitle.svelte.test.ts` | pass                  |
| 型     | `pnpm check`                                                              | `0 ERRORS 0 WARNINGS` |
| lint   | `pnpm lint`                                                               | exit 0                |
| まとめ | `pnpm verify`                                                             | exit 0                |

## Scope

**In scope**

- `src/lib/components/SoloTitle.svelte`
- `src/lib/components/SoloTitle.svelte.test.ts`（新規）

**Out of scope**

- `SoloShell.svelte`、`levels.ts` — `best` の意味は変えない
- グリッドや数値入力での選択 — やらない

## Git workflow

- コミット 1 つ。英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: 押しっぱなしで進むようにする

`SoloTitle.svelte` の script に足す。

```ts
let timer: ReturnType<typeof setTimeout> | undefined;
/** 長押しのリピートで動かしたあとは、指を離したときの click で余分に 1 つ動かさない */
let repeated = false;

function step(d: -1 | 1): boolean {
  const next = Math.min(best, Math.max(1, level + d));
  if (next === level) return false;
  level = next;
  return true;
}

function press(d: -1 | 1) {
  repeated = false;
  clearTimeout(timer);
  const tick = () => {
    repeated = true;
    // 端に着いたら止める（disabled になった button には pointerup が届かないことがある）
    if (step(d)) timer = setTimeout(tick, 90);
  };
  timer = setTimeout(tick, 400);
}

const release = () => clearTimeout(timer);

function click(d: -1 | 1) {
  if (repeated) repeated = false;
  else step(d);
}

$effect(() => release);
```

テンプレートの 2 つのボタンを次にする。

```svelte
<button
  class="step"
  onpointerdown={() => press(-1)}
  onpointerup={release}
  onpointercancel={release}
  onpointerleave={release}
  onclick={() => click(-1)}
  disabled={level <= 1}
  aria-label="前のレベル">◀</button
>
```

▶ も同じ形で `press(1)` / `click(1)` / `disabled={level >= best}`。

`onclick` を残すのはキーボード（Enter / Space）で動かせるようにするため。マウスやタッチでは pointerdown → 400 ms →
リピート → pointerup → click の順に来るので、リピートが 1 回でも走ったら click では動かさない。

確認 — `pnpm check` → `0 ERRORS 0 WARNINGS`、`pnpm lint` → exit 0、`wc -l src/lib/components/SoloTitle.svelte` が 200 未満

### Step 2: テストを書く

`src/lib/components/SoloTitle.svelte.test.ts` を新規に作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StubHowto from '$lib/test/StubHowto.svelte';
import SoloTitle from './SoloTitle.svelte';

const meta = {
  id: 'stub',
  name: 'スタブ',
  description: '',
  minutes: '1分',
  players: 1 as const,
  Thumb: StubHowto,
  load: async () => ({ Game: StubHowto, Howto: StubHowto })
};

function show(level: number, best: number) {
  const target = document.body.appendChild(document.createElement('div'));
  const props = $state({ meta, Howto: StubHowto, best, level, onstart: () => {} });
  const app = mount(SoloTitle, { target, props });
  flushSync();
  const button = (label: string) => target.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  const fire = (el: HTMLElement, type: string) => {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true }));
    flushSync();
  };
  return { app, props, button, fire };
}

describe('SoloTitle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('タップで 1 つ進む', () => {
    const { app, props, button, fire } = show(3, 10);
    fire(button('次のレベル'), 'pointerdown');
    fire(button('次のレベル'), 'pointerup');
    fire(button('次のレベル'), 'click');
    expect(props.level).toBe(4);
    unmount(app);
  });

  it('長押しすると 400ms 後から 90ms ごとに進み、離すと止まる', () => {
    const { app, props, button, fire } = show(1, 100);
    fire(button('次のレベル'), 'pointerdown');
    vi.advanceTimersByTime(399);
    flushSync();
    expect(props.level).toBe(1);
    vi.advanceTimersByTime(1 + 90 * 4);
    flushSync();
    expect(props.level).toBe(6);
    fire(button('次のレベル'), 'pointerup');
    fire(button('次のレベル'), 'click');
    vi.advanceTimersByTime(1000);
    flushSync();
    expect(props.level).toBe(6);
    unmount(app);
  });

  it('端に着いたら止まり、best より先へは行かない', () => {
    const { app, props, button, fire } = show(8, 10);
    fire(button('次のレベル'), 'pointerdown');
    vi.advanceTimersByTime(400 + 90 * 10);
    flushSync();
    expect(props.level).toBe(10);
    unmount(app);
  });
});
```

`$state` を `.ts` のテストで使うには、ファイル名が `.svelte.test.ts` である必要がある（Svelte のコンパイラを通す）。
`props` を `$state` にしておくと `bind:level` 相当の書き戻しを `props.level` で読める。もし `mount` の `props` に
`$state` オブジェクトを渡しても `level` の変更が `props.level` に反映されない場合は、代わりに
`target.querySelector('.level')!.textContent` で「レベル N」を読む形に変える（その旨を NOTES に書く）。

確認 — `pnpm test:run --project dom src/lib/components/SoloTitle.svelte.test.ts` → 3 件 pass

### Step 3: 検証

確認 — `pnpm verify` → exit 0

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -c "onpointerdown" src/lib/components/SoloTitle.svelte` が 2
- [ ] `src/lib/components/SoloTitle.svelte.test.ts` が存在し 3 件 pass
- [ ] `SoloTitle.svelte` が 200 行未満
- [ ] `git status` で In scope 以外が変わっていない

## STOP conditions

- 「Current state」の抜粋と一致しない
- markuplint が `onpointerleave` を拒む（`onpointer` 接頭辞は `.markuplintrc.jsonc` で許可済みのはずなので、
  拒まれたらエラー全文を報告）
- Step 2 のテストが `$state` の props では書けず、`.level` のテキストを読む形でも通らない

## Maintenance notes

- 加速（押し続けるほど速く）は入れていない。100 面なら 90 ms 間隔で 9 秒で端まで行く
- `release` は `pointerleave` でも呼ぶ。指が滑ってボタンから外れたまま離すと `pointerup` がボタンに届かないため

## 実行時の変更

- `$effect(() => release)` は svelte-vitals の `correctness/effect-as-onmount` に当たるので、`onMount(() => release)` にした
- テストの `meta.load` は `Game: StubGame`（`$lib/test/StubGame.svelte`）にした。`StubHowto` は `Component<SoloProps>` を満たさない
