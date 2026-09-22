# Plan 009: テスト基盤を node + dom の 2 project にし、Settle / pwa / シェルのテストを足す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 009 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- vite.config.ts src/lib/settle.svelte.ts src/lib/pwa.ts src/lib/components/SoloShell.svelte src/lib/components/GameShell.svelte src/lib/audio.svelte.ts`
> `SoloShell.svelte` / `GameShell.svelte` は 001 で変わっている **はず**（`finish` の先頭に
> `if (screen !== 'playing') return;`、localStorage の読み口に `Math.floor`）。それ以外の差分があれば
> 「Current state」と見比べる。001 が未実施なら STOP。

## Status

| 項目       | 値                                                                                      |
| ---------- | --------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                      |
| Effort     | M                                                                                       |
| Risk       | MED（vitest の project 設定を触る。既存の 18 ファイルが今までどおり走ることが最初の門） |
| Depends on | 001                                                                                     |
| Category   | tests                                                                                   |
| Planned at | commit `b4b0196`, 2026-09-22                                                            |

## Why this matters

いまの vitest は project が `unit` 1 つで、環境は happy-dom。ところが 18 のテストファイルは 1 つも
DOM を使わない（`grep -ln "document\|window\|PointerEvent\|localStorage" src/**/*.test.ts` は 0 件）。
happy-dom の起動に 24 秒中 12 秒を使っている。

一方で、このアプリでいちばん危ない振る舞いはコンポーネントとブラウザ API の中にある。

- `src/lib/settle.svelte.ts` — iOS の合成 click 対策。350 ms / 3 秒の状態機械で、指の数を数える。
  デスクトップでは絶対に壊れて見えず、CI にも載っていない
- `src/lib/pwa.ts` — 壊れたビルドから抜け出す唯一の経路（「最新版に更新」）
- `SoloShell` の `finish` — 001 で足した「遊んでいる最中だけ受け付ける」守りと、レベル保存
- `GameShell` の 2 つのパッドで始める門 — 8 本の対戦ゲームすべての入口

これらはどれも happy-dom + Svelte 5 の `mount()` + `vi.useFakeTimers()` でテストできる。ブラウザも
`@testing-library/svelte` も要らない。必要なのは、DOM 用の第 2 project に `resolve.conditions: ['browser']`
を付けて Svelte のクライアントビルドを解決させることだけ。

この計画で、`unit` を `node` にして速くし、`dom` project を足し、4 つのテストを書く。

## Current state

`vite.config.ts:55-67`（現状）

```ts
test: {
  projects: [
    {
      // ゲームルールなど、DOM に依存しないモジュールのテスト
      extends: true,
      test: {
        name: 'unit',
        environment: 'happy-dom',
        include: ['src/**/*.test.ts']
      }
    }
  ];
}
```

`src/lib/settle.svelte.ts`（現状の全文は 40 行。要点）— `class Settle { active = $state(false); #touching = 0; begin() { this.active = true; this.#after(this.#touching === 0 ? 350 : 3000); } listen = () => { addEventListener('pointerdown', press, true); addEventListener('pointerup', lift, true); addEventListener('pointercancel', lift, true); return () => {...} } }`。
`lift` は `#touching` を 0 で止め、`active` かつ `#touching === 0` なら 350 ms で戻す。

`src/lib/pwa.ts`（現状の全文）

```ts
export async function updateApp(): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) {
    await registration.update();
    const worker = registration.installing ?? registration.waiting;
    if (worker) {
      await new Promise<void>((done) => {
        // 取り込みが終わらないまま待ち続けないよう、30 秒で見切って読み直す
        const timer = setTimeout(done, 30_000);
        worker.addEventListener('statechange', () => {
          if (worker.state !== 'activated' && worker.state !== 'redundant') return;
          clearTimeout(timer);
          done();
        });
      });
    }
  } else {
    const keys = (await caches?.keys()) ?? [];
    await Promise.all(keys.filter((k) => k.startsWith('table-duel-')).map((k) => caches.delete(k)));
  }
  location.reload();
}
```

`src/lib/components/SoloShell.svelte`（001 のあと）— props は `{ meta, Game, Howto }: { meta: SoloMeta } & SoloModule`。
`key = 'table-duel:level:' + meta.id`。`finish(won)` の先頭に `if (screen !== 'playing') return;`。
`onMount` で localStorage を読み `settle.listen()` を返す。`start()` が `wake(); sfx.start(); round += 1; screen = 'playing';`。
テンプレートは `{#if screen === 'playing'} {#key round} <Game {level} onfinish={finish} /> {/key} <button class="corner quit" ...>` /
`{:else} {#if screen === 'title'} <SoloTitle {meta} {Howto} {best} bind:level onstart={start} /> {:else} <SoloResult ... /> {/if}`。
`import { resolve } from '$app/paths'` で戻るリンクを作る。`import { audio, sfx, toggleMute, wake } from '$lib/audio.svelte'`。

`src/lib/components/GameShell.svelte`（001 のあと）— `padDown(event, player)` が `wake(); capture(event); pads[player].add(event.pointerId); ready[player] = true;`、
`pointerType === 'mouse'` なら両方 ready。`padUp` で `pads[player].delete(...)`、`ready[player] = pads[player].size > 0`。
`$effect` が `screen === 'title' && ready[1] && ready[2]` のとき `setTimeout(start, 550)`。
`TitleScreen.svelte` は `{#each [2, 1] as const as player} <button class="half p{player}" onpointerdown={(e) => onpaddown(e, player)} onpointerup=... onpointercancel=...>`。

`src/lib/audio.svelte.ts:25-28` の `wake()` は `new AudioContext()` を作る。happy-dom に `AudioContext` はない。

`src/lib/games.ts` の型 — `SoloMeta { id, name, description, minutes, players: 1, Thumb: Component, load }`、
`SoloModule { Game: Component<SoloProps>, Howto: Component }`、`SoloProps { level, onfinish }`。

規約 — `src/lib/*` のディレクトリ名は kebab-case（svelte-vitals）。テストの説明は日本語。
prettier（`singleQuote`、`printWidth: 120`）。コメントは WHY だけ。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的      | コマンド                       | 成功時                           |
| --------- | ------------------------------ | -------------------------------- |
| 全テスト  | `pnpm test:run`                | 2 つの project が走り、全部 pass |
| unit だけ | `pnpm test:run --project unit` | 18 ファイル pass                 |
| dom だけ  | `pnpm test:run --project dom`  | 新規 4 ファイル pass             |
| 型        | `pnpm check`                   | `0 ERRORS`                       |
| lint      | `pnpm lint`                    | exit 0                           |
| vitals    | `pnpm vitals --diff`           | exit 0                           |
| まとめ    | `pnpm verify`                  | exit 0                           |

## Scope

**In scope**

- `vite.config.ts`（`test.projects` だけ）
- `src/lib/settle.svelte.test.ts`（新規）
- `src/lib/pwa.test.ts`（新規）
- `src/lib/components/SoloShell.svelte.test.ts`（新規）
- `src/lib/components/GameShell.svelte.test.ts`（新規）
- `src/lib/test/StubGame.svelte`、`src/lib/test/StubHowto.svelte`、`src/lib/test/hooks.ts`（新規。テスト用の差し替え部品）
- `plans/README.md`

**Out of scope**

- `SoloShell.svelte` / `GameShell.svelte` / `settle.svelte.ts` / `pwa.ts` の実装 — テストが落ちたら STOP
- 新しい依存の追加（`@testing-library/svelte` など）— 足さない。`minimumReleaseAge` の門もある
- `happy-dom` を消すこと — `dom` project で使う
- ゲーム本体（`src/lib/games/**`）のコンポーネントテスト

## Git workflow

- ブランチ: `advisor/009-test-infrastructure`
- コミットは「project 分割」「Settle / pwa」「シェル」の 3 つ。英語の命令形 1 文、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: `unit` を node にし、`dom` project を足す

`vite.config.ts` の `test.projects` を次にする。

```ts
test: {
  projects: [
    {
      // ゲームルールなど、DOM に依存しないモジュールのテスト
      extends: true,
      test: {
        name: 'unit',
        environment: 'node',
        include: ['src/**/*.test.ts'],
        exclude: ['src/**/*.svelte.test.ts', 'src/lib/settle.svelte.test.ts', 'src/lib/pwa.test.ts']
      }
    },
    {
      // コンポーネントとブラウザ API のテスト。browser 条件で Svelte のクライアント版を解決させないと mount() が動かない
      extends: true,
      resolve: { conditions: ['browser'] },
      test: {
        name: 'dom',
        environment: 'happy-dom',
        include: ['src/**/*.svelte.test.ts', 'src/lib/settle.svelte.test.ts', 'src/lib/pwa.test.ts']
      }
    }
  ];
}
```

`unit` の `include` は `*.svelte.test.ts` にもマッチするので、`exclude` を必ず付ける（付けないと dom のテストが
node でも走って落ちる）。

確認 — `pnpm test:run --project unit` → 18 ファイル / 387 件以上 pass。所要時間が以前（約 24 秒）より短い

### Step 2: `Settle` の状態機械をテストする

`src/lib/settle.svelte.test.ts` を新規に作る。

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Settle } from './settle.svelte';

const fire = (type: string) => window.dispatchEvent(new Event(type, { bubbles: true }));

describe('Settle', () => {
  let stop: () => void;
  let settle: Settle;

  beforeEach(() => {
    vi.useFakeTimers();
    settle = new Settle();
    stop = settle.listen();
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('指が触れていなければ 350ms で戻る', () => {
    settle.begin();
    expect(settle.active).toBe(true);
    vi.advanceTimersByTime(349);
    expect(settle.active).toBe(true);
    vi.advanceTimersByTime(1);
    expect(settle.active).toBe(false);
  });

  it('指が残っていれば 350ms では戻らず、離れてから 350ms、遅くとも 3 秒で戻る', () => {
    fire('pointerdown');
    settle.begin();
    vi.advanceTimersByTime(1000);
    expect(settle.active).toBe(true);
    fire('pointerup');
    vi.advanceTimersByTime(349);
    expect(settle.active).toBe(true);
    vi.advanceTimersByTime(1);
    expect(settle.active).toBe(false);

    fire('pointerdown');
    settle.begin();
    vi.advanceTimersByTime(3000);
    expect(settle.active).toBe(false);
  });

  it('対になっていない pointerup で指の数が負にならない', () => {
    fire('pointerup');
    fire('pointerup');
    fire('pointerdown');
    settle.begin();
    vi.advanceTimersByTime(350);
    expect(settle.active).toBe(true);
  });

  it('listen の戻り値で見張りをやめる', () => {
    stop();
    fire('pointerdown');
    settle.begin();
    vi.advanceTimersByTime(350);
    expect(settle.active).toBe(false);
    stop = () => {};
  });
});
```

`settle.svelte.ts` は `addEventListener` を引数なしの関数として呼ぶ（`window` のもの）。happy-dom では
`window.dispatchEvent` で届く。`Settle` の `active` は `$state` なので、`.svelte.ts` は Svelte の
コンパイラを通る（既存の `vite.config.ts` の `runes: true` で有効）。

確認 — `pnpm test:run --project dom src/lib/settle.svelte.test.ts` → 4 件 pass

### Step 3: `updateApp` の流れをテストする

`src/lib/pwa.test.ts` を新規に作る。`navigator.serviceWorker` と `caches` と `location.reload` を差し替える。

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { updateApp } from './pwa';

class FakeWorker extends EventTarget {
  state = 'installing';
  become(state: string) {
    this.state = state;
    this.dispatchEvent(new Event('statechange'));
  }
}

const reload = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('location', { ...location, reload });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  reload.mockClear();
});

describe('updateApp', () => {
  it('新しい worker が activated になったら読み直す', async () => {
    const worker = new FakeWorker();
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: async () => ({ update: async () => {}, installing: worker, waiting: null }) }
    });
    const done = updateApp();
    await vi.advanceTimersByTimeAsync(0);
    expect(reload).not.toHaveBeenCalled();
    worker.become('activated');
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('30 秒たっても状態が変わらなければ見切って読み直す', async () => {
    const worker = new FakeWorker();
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistration: async () => ({ update: async () => {}, installing: worker, waiting: null }) }
    });
    const done = updateApp();
    await vi.advanceTimersByTimeAsync(30_000);
    await done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('Service Worker がなければ table-duel- のキャッシュだけ消して読み直す', async () => {
    const deleted: string[] = [];
    vi.stubGlobal('navigator', { serviceWorker: undefined });
    vi.stubGlobal('caches', {
      keys: async () => ['table-duel-a', 'other', 'table-duel-b'],
      delete: async (k: string) => {
        deleted.push(k);
        return true;
      }
    });
    await updateApp();
    expect(deleted).toEqual(['table-duel-a', 'table-duel-b']);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
```

`vi.stubGlobal('location', ...)` が happy-dom で効かない（`reload` が呼ばれず本物が走る）場合は、
`Object.defineProperty(window, 'location', { value: { reload }, configurable: true })` を試す。それでも
無理なら `reload` の assertion を外し、`done` が resolve することだけを見る（その旨を計画の Status に書く）。

確認 — `pnpm test:run --project dom src/lib/pwa.test.ts` → 3 件 pass

### Step 4: テスト用の差し替え部品を作る

`src/lib/test/hooks.ts`

```ts
import type { Player } from '$lib/player';

/** テストから、シェルが Game に渡した onfinish を呼ぶための受け皿 */
export const hooks: { level: number; solo?: (cleared: boolean) => void; duel?: (winner: Player) => void } = {
  level: 0
};
```

`src/lib/test/StubGame.svelte`

```svelte
<script lang="ts">
  import { hooks } from './hooks';

  let { level = 0, onfinish }: { level?: number; onfinish: ((cleared: boolean) => void) & ((winner: 1 | 2) => void) } =
    $props();

  hooks.level = level;
  hooks.solo = onfinish;
  hooks.duel = onfinish;
</script>

<div data-testid="game"></div>
```

`src/lib/test/StubHowto.svelte`

```svelte
<p>howto</p>
```

`onfinish` の型は `SoloProps` と `GameProps` の両方に合うよう交差型にしてある。型が通らなければ
`onfinish: (v: never) => void` にし、`hooks.solo = onfinish as (cleared: boolean) => void` のように
テスト側で絞る。

svelte-vitals の `a11y/required-element`（`<main>` 必須）はルート（`src/routes`）にだけ効くはずだが、
`pnpm vitals --diff` が `src/lib/test/*.svelte` に警告を出したら、`svelte-vitals.config.ts` は触らず、
STOP して報告する。

確認 — `pnpm check` → `0 ERRORS`

### Step 5: `SoloShell` をテストする

`src/lib/components/SoloShell.svelte.test.ts` を新規に作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hooks } from '$lib/test/hooks';
import StubGame from '$lib/test/StubGame.svelte';
import StubHowto from '$lib/test/StubHowto.svelte';
import SoloShell from './SoloShell.svelte';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  sfx: { start: () => {}, finish: () => {} },
  toggleMute: () => {},
  wake: () => {}
}));

const meta = {
  id: 'stub',
  name: 'スタブ',
  description: '',
  minutes: '1分',
  players: 1 as const,
  Thumb: StubHowto,
  load: async () => ({ Game: StubGame, Howto: StubHowto })
};

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(SoloShell, { target, props: { meta, Game: StubGame, Howto: StubHowto } });
  flushSync();
  return { target, app };
}

const start = (target: HTMLElement) => {
  (target.querySelector('button.go') as HTMLButtonElement).click();
  flushSync();
};

describe('SoloShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('onfinish(true) を 2 回呼んでもレベルは 1 つしか進まない', () => {
    const { target, app } = show();
    start(target);
    expect(hooks.level).toBe(1);
    hooks.solo!(true);
    hooks.solo!(true);
    flushSync();
    expect(localStorage.getItem('table-duel:level:stub')).toBe('2');
    expect(target.textContent).toContain('つぎは レベル 2');
    unmount(app);
  });

  it('遊んでいる最中でなければ onfinish は無視される', () => {
    const { target, app } = show();
    start(target);
    const finish = hooks.solo!;
    (target.querySelector('button.quit') as HTMLButtonElement).click();
    flushSync();
    finish(true);
    flushSync();
    expect(localStorage.getItem('table-duel:level:stub')).toBeNull();
    expect(target.querySelector('button.go')).not.toBeNull();
    unmount(app);
  });

  it.each([
    ['5.5', 5],
    ['abc', 1],
    ['9999', 100],
    ['0', 1]
  ])('保存された値 %s は 1..100 の整数 %i に直す', (stored, level) => {
    localStorage.setItem('table-duel:level:stub', stored);
    const { target, app } = show();
    expect(target.textContent).toContain(`レベル ${level}`);
    unmount(app);
  });
});
```

`SoloTitle.svelte` の「タップで スタート」は `button.pill.p1.go`、`SoloShell` の ✕ は `button.corner.quit`。
`resolve()`（`$app/paths`）が test project で解決できず import エラーになったら、テストの先頭に
`vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));` を足す。

確認 — `pnpm test:run --project dom src/lib/components/SoloShell.svelte.test.ts` → 6 件 pass

### Step 6: `GameShell` の 2 つのパッドをテストする

`src/lib/components/GameShell.svelte.test.ts` を新規に作る。`PointerEvent` が happy-dom にない場合の
逃げ道を最初から入れておく。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StubGame from '$lib/test/StubGame.svelte';
import StubHowto from '$lib/test/StubHowto.svelte';
import GameShell from './GameShell.svelte';

vi.mock('$lib/audio.svelte', () => ({
  audio: { muted: false },
  sfx: { start: () => {}, finish: () => {} },
  toggleMute: () => {},
  wake: () => {}
}));

const meta = {
  id: 'stub',
  name: 'スタブ',
  description: '',
  minutes: '1分',
  players: 2 as const,
  Thumb: StubHowto,
  load: async () => ({ Game: StubGame, Howto: StubHowto })
};

/** happy-dom に PointerEvent がなければ MouseEvent に pointerId を生やす */
function pointer(type: string, pointerId: number, pointerType = 'touch') {
  const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  const e = new Ctor(type, { bubbles: true });
  Object.defineProperty(e, 'pointerId', { value: pointerId });
  Object.defineProperty(e, 'pointerType', { value: pointerType });
  return e;
}

function show() {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(GameShell, { target, props: { meta, Game: StubGame, Howto: StubHowto } });
  flushSync();
  const pad = (p: 1 | 2) => target.querySelector(`button.half.p${p}`) as HTMLButtonElement;
  const playing = () => target.querySelector('[data-testid="game"]') !== null;
  return { app, pad, playing };
}

describe('GameShell', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('片方だけでは始まらず、両方が押して 550ms で始まる', () => {
    const { app, pad, playing } = show();
    pad(1).dispatchEvent(pointer('pointerdown', 1));
    flushSync();
    vi.advanceTimersByTime(1000);
    flushSync();
    expect(playing()).toBe(false);
    pad(2).dispatchEvent(pointer('pointerdown', 2));
    flushSync();
    vi.advanceTimersByTime(549);
    flushSync();
    expect(playing()).toBe(false);
    vi.advanceTimersByTime(1);
    flushSync();
    expect(playing()).toBe(true);
    unmount(app);
  });

  it('550ms のあいだに片方が離すと始まらない', () => {
    const { app, pad, playing } = show();
    pad(1).dispatchEvent(pointer('pointerdown', 1));
    pad(2).dispatchEvent(pointer('pointerdown', 2));
    flushSync();
    vi.advanceTimersByTime(300);
    pad(2).dispatchEvent(pointer('pointerup', 2));
    flushSync();
    vi.advanceTimersByTime(1000);
    flushSync();
    expect(playing()).toBe(false);
    unmount(app);
  });

  it('同じパッドに 2 本置いて 1 本離しても、押したままと数える', () => {
    const { app, pad, playing } = show();
    pad(1).dispatchEvent(pointer('pointerdown', 1));
    pad(1).dispatchEvent(pointer('pointerdown', 2));
    pad(2).dispatchEvent(pointer('pointerdown', 3));
    flushSync();
    pad(1).dispatchEvent(pointer('pointerup', 1));
    flushSync();
    vi.advanceTimersByTime(550);
    flushSync();
    expect(playing()).toBe(true);
    unmount(app);
  });

  it('マウスなら片方だけで始まる', () => {
    const { app, pad, playing } = show();
    pad(1).dispatchEvent(pointer('pointerdown', 1, 'mouse'));
    flushSync();
    vi.advanceTimersByTime(550);
    flushSync();
    expect(playing()).toBe(true);
    unmount(app);
  });
});
```

`GameShell` の `$effect` は `setTimeout(start, 550)` で、`ready` が変わると `clearTimeout` して張り直す。
`flushSync()` を挟むのは `$effect` を走らせるため。`setPointerCapture` は try/catch で守られているので
happy-dom で無くても落ちない。

確認 — `pnpm test:run --project dom src/lib/components/GameShell.svelte.test.ts` → 4 件 pass

### Step 7: 全体の検証

確認 — `pnpm test:run` → 2 project、22 ファイル、全部 pass。`pnpm verify` → exit 0

## Test plan

この計画そのものがテスト。新規は `settle` 4 件、`pwa` 3 件、`SoloShell` 6 件、`GameShell` 4 件。

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `pnpm test:run --project unit` が 18 ファイル pass で、`environment` が `node`
- [ ] `pnpm test:run --project dom` が 4 ファイル pass
- [ ] `grep -n "environment: 'node'" vite.config.ts` が 1 件、`conditions: \['browser'\]` が 1 件
- [ ] `grep -rn "from '@testing-library" src/` が 0 件（新しい依存なし）、`package.json` が変わっていない
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 009 の Status を更新した

## STOP conditions

- 001 が未実施（`SoloShell.svelte` に `screen !== 'playing'` がない）
- Step 1 で `unit` project の既存テストが落ちる（node で動かないテストがある。どれかを報告）
- Step 5 で `mount()` が「lifecycle_function_unavailable」や「mount is not available on the server」で落ち、
  `resolve.conditions: ['browser']` を付けても直らない（Svelte のクライアント版が解決できていない。
  `node_modules/svelte/package.json` の `exports` を報告する）
- Step 5 のテストが落ち、原因が `SoloShell.svelte` 側（001 の守りが効いていない）
- `pnpm vitals --diff` が `src/lib/test/*.svelte` に警告を出す

## Maintenance notes

- DOM を使うテストは `*.svelte.test.ts` か、`dom` project の `include` に列挙する。`unit` の `exclude` も
  合わせて更新する（両方の project で走らせない）
- `src/lib/test/` はテスト専用。アプリのコードから import しない
- 011（Service Worker）のテストを書くなら `dom` project に `src/service-worker.test.ts` を足し、
  `$service-worker` を `vi.mock` する。この計画には含めない
