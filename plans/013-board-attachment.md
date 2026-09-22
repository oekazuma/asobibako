# Plan 013: 盤面の配線を attachment 1 つに寄せ、feint-master を `BoardInput` に乗せる

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 013 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/board-input.ts src/lib/loop.ts src/lib/fingers.ts src/lib/components/GameShell.svelte src/lib/games/*/*.svelte`
> 001 / 004 / 012 で `.svelte` は変わっている **はず**。「Current state」の抜粋（配線の部分）が
> 各ファイルに残っていることを `grep` で確かめてから進む。

## Status

| 項目       | 値                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                                 |
| Effort     | M                                                                                                  |
| Risk       | MED（12 ファイルを機械的に触る。横向き回転の経路は自動テストがなく、実機かエミュレーションで目視） |
| Depends on | 012                                                                                                |
| Category   | tech-debt / bug                                                                                    |
| Planned at | commit `b4b0196`, 2026-09-22                                                                       |

> **実行時の変更（2026-09-23）**: markuplint 5.0.0 の svelte-parser は Svelte 5 の `{@attach}` を未知の属性として
> 拒む（計画の STOP 条件どおりに止まった）。同じ効果を持ち、markuplint も解する **`use:` アクション**
> （`use:input.board={onResize}`）で実装した。以下の本文で `{@attach input.attach(...)}` とある箇所は
> `use:input.board={...}`、`attach` プロパティは `board: Action<HTMLElement, ((aspect: number) => void) | undefined>`
> と読み替える。`svelte/attachments` は使っていない。

## Why this matters

指で操作する 10 ゲームは、盤面の `<div>` に同じ 4 つの Pointer Events を配線し、`onMount` で
`input.observe(board, …)` と `animate(frame)` を呼んで後始末する、同じ 25 行を持っている。
コピーは既にずれ始めていて、canvas の DPR は `devicePixelRatio || 1` で守っているのが bug-rush だけ。
`setPointerCapture` の try/catch（CLAUDE.md が規約として書いている）は `board-input.ts`・`GameShell.svelte`・
`BorderRush.svelte` の 3 か所に同じコメント付きである。

feint-master は `BoardInput` を使わず、盤面が回っているかを `Math.abs(box.width - board.offsetWidth) > 1`
だけで判定する。`board-input.ts:83-84` の判定は 2 条件で、幅と高さが 1px 以内で等しい（正方形に近い）
盤面では **どちらの判定も間違う**（回っているのに回っていないと判断し、指が逆のプレイヤーに付く）。
判定の根拠は CSS の `@media (orientation: landscape) and (pointer: coarse)` で `.stage` を回していることなので、
同じメディアクエリを `matchMedia` で聞くのが唯一の正しい信号になる。

この計画で、配線を Svelte 5 の attachment 1 つに寄せ、`capture()` を 1 つにし、回転の判定を
`matchMedia` にし、feint-master を `BoardInput` に乗せ、監査で挙がった小さな守り（高さ 0、負の dt、
`velocity()` の順序）を同じファイル群で片付ける。

## Current state

`src/lib/board-input.ts:52-91`（現状。`down`/`move`/`up`/`observe`）

```ts
  down = (event: PointerEvent) => {
    event.preventDefault();
    // iOS は操作イベントの中でしか音を鳴らし始められない
    wake();
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // 合成イベントでは捕捉できないが、指の追跡自体は続けられる
    }
    const [x, y] = this.#toBoard(event);
    this.fingers.down(event.pointerId, x, y, event.timeStamp);
    this.#hooks.down?.(event, x, y);
  };
  // move / up は省略
  observe(el: HTMLElement, onResize: (aspect: number) => void): () => void {
    const measure = () => {
      this.#box = el.getBoundingClientRect();
      this.#size = { width: el.offsetWidth, height: el.offsetHeight };
      // 画面上の幅が、盤面そのものの高さと一致していれば 90 度回っている
      this.#turned =
        Math.abs(this.#box.width - this.#size.width) > 1 && Math.abs(this.#box.width - this.#size.height) <= 1;
      onResize(this.#size.width / this.#size.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }
```

`src/app.css:176-186`（現状。回転の根拠）

```css
@media (orientation: landscape) and (pointer: coarse) {
  .stage {
    position: fixed;
    /* ... */
    transform: rotate(90deg) translateY(-100%);
  }
}
```

各ゲームの配線（10 ファイルで同じ。例 `src/lib/games/hockey/Hockey.svelte:63-84`）

```svelte
  onMount(() => {
    const unobserve = input.observe(board, (aspect) => (game.aspect = aspect));
    const stop = animate(frame);
    return () => {
      stop();
      unobserve();
    };
  });
</script>

<div
  class="board"
  bind:this={board}
  onpointerdown={input.down}
  onpointermove={input.move}
  onpointerup={input.up}
  onpointercancel={input.up}
  role="application"
  aria-label="ホッケーの盤面"
  style:--puck="{PUCK_R * 200}%"
  style:--mallet="{MALLET_R * 200}%"
>
```

同じ形のファイル — `pin-rescue/PinRescue.svelte`、`gate-run/GateRun.svelte`、`dog-guard/DogGuard.svelte`、
`snow-camp/SnowCamp.svelte`、`bomb-relay/BombRelay.svelte`、`bug-rush/BugRush.svelte`、`fish-pull/FishPull.svelte`、
`hockey/Hockey.svelte`、`lightning/Lightning.svelte`、`shield-break/ShieldBreak.svelte`。lightning と shield-break は
`input.observe(board, () => {})` と空の callback を渡している。001 で `onMount` の後始末に `clearTimeout(finishTimer)`
が増えたファイルがある（pin-rescue / gate-run / dog-guard / snow-camp）。

`src/lib/games/feint-master/FeintMaster.svelte:31-44`（現状）

```ts
  /** 押した位置だけ分かればよいので、指は追わない。盤面が 90 度回っていても陣地を正しく取る */
  function down(event: PointerEvent) {
    event.preventDefault();
    wake();
    const box = board.getBoundingClientRect();
    const turned = Math.abs(box.width - board.offsetWidth) > 1;
    const [, y] = toBoardPoint(event.clientX, event.clientY, box, turned);
    play(press(game, sideOf(y)));
  }

  onMount(() => animate((dt) => play(step(game, dt))));
</script>

<div class="board" bind:this={board} onpointerdown={down} role="application" aria-label="フェイントマスターの盤面">
```

`src/lib/components/GameShell.svelte:22-29`（現状の `capture`）と `src/lib/games/border-rush/BorderRush.svelte` の
`grab()` の try/catch（012 のあとも残っている）。

`src/lib/loop.ts:9` — `frame(Math.min(0.05, (now - last) / 1000), now);`。`last` は `performance.now()`、`now` は
rAF の timestamp で、初回は `now < last` になりうる（負の dt）。

`src/lib/fingers.ts:45-51`（現状）

```ts
export function velocity(trail: Sample[]): { vx: number; vy: number } {
  const first = trail[0];
  const last = trail[trail.length - 1];
  const dt = (last.t - first.t) / 1000;
  if (trail.length < 2 || dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}
```

Svelte 5 の attachment — `import type { Attachment } from 'svelte/attachments';`、要素に `{@attach fn}` と書くと
`fn(element)` が mount 時に呼ばれ、戻り値の関数が unmount 時に呼ばれる。`svelte` は `^5.57`（attachment は 5.29 から）。

テスト — `src/lib/board-input.test.ts` は `toBoardPoint` だけ、`src/lib/fingers.test.ts` は `velocity` を 2 件。
009 が済んでいれば `dom` project がある（この計画は依存しないが、あれば `matchMedia` の stub で `observe` をテストできる）。

規約 — コメントは WHY だけ・日本語。`.svelte` は 200 行未満。markuplint が `.svelte` を検査する。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド                                                         | 成功時                                     |
| ------ | ---------------------------------------------------------------- | ------------------------------------------ |
| テスト | `pnpm test:run`                                                  | pass                                       |
| 型     | `pnpm check`                                                     | `0 ERRORS`                                 |
| lint   | `pnpm lint`                                                      | exit 0（markuplint が `{@attach}` を通す） |
| vitals | `pnpm vitals --diff`                                             | exit 0                                     |
| まとめ | `pnpm verify`                                                    | exit 0                                     |
| 目視   | `pnpm dev` → DevTools のデバイスエミュレーション（iPad、横向き） | 後述                                       |

## Scope

**In scope**

- `src/lib/board-input.ts`、`src/lib/board-input.test.ts`
- `src/lib/loop.ts`
- `src/lib/fingers.ts`
- `src/lib/components/GameShell.svelte`
- `src/lib/games/{pin-rescue/PinRescue,gate-run/GateRun,dog-guard/DogGuard,snow-camp/SnowCamp,bomb-relay/BombRelay,bug-rush/BugRush,fish-pull/FishPull,hockey/Hockey,lightning/Lightning,shield-break/ShieldBreak,feint-master/FeintMaster,border-rush/BorderRush}.svelte`
- `plans/README.md`

**Out of scope**

- `engine.ts` はどれも触らない
- `animate(frame)` の呼び出しは各ゲームに残す（`frame` はゲームごとに違う）
- canvas の DPR 処理を共通化すること — `resize()` は各ゲームで違う（view の計算など）。`devicePixelRatio || 1` の
  守りだけ揃える
- `app.css` — 触らない

## Git workflow

- ブランチ: `advisor/013-board-attachment`
- コミットは「board-input に attach と capture」「10 ゲームを載せ替え」「feint-master」「守り」の 4 つ。
  英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: `board-input.ts` に `capture()`・`attach()`・`matchMedia` の判定を足す

```ts
import type { Attachment } from 'svelte/attachments';

/** app.css が .stage を回す条件と同じ。盤面が回っているかは、外接矩形から推し量るより CSS に聞くほうが確か */
export const TURNED_QUERY = '(orientation: landscape) and (pointer: coarse)';

/** 合成イベントや既に解放されたポインタでは失敗するが、掴み自体は続行してよい */
export function capture(event: PointerEvent): void {
  try {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  } catch {
    // noop
  }
}
```

`down` の try/catch を `capture(event);` に置き換える。

`observe` の `#turned` の計算を `this.#turned = matchMedia(TURNED_QUERY).matches;` にする。古いコメント
（「画面上の幅が、盤面そのものの高さと一致していれば…」）は消す。`onResize` は高さ 0 なら呼ばない。

```ts
if (this.#size.height === 0) return;
onResize(this.#size.width / this.#size.height);
```

`attach()` を足す。

```ts
/** 盤面の要素に {@attach input.attach(onResize)} と書けば、指の配線と大きさの見張りが付く */
attach =
  (onResize: (aspect: number) => void = () => {}): Attachment =>
  (el) => {
    const board = el as HTMLElement;
    board.addEventListener('pointerdown', this.down);
    board.addEventListener('pointermove', this.move);
    board.addEventListener('pointerup', this.up);
    board.addEventListener('pointercancel', this.up);
    const unobserve = this.observe(board, onResize);
    return () => {
      board.removeEventListener('pointerdown', this.down);
      board.removeEventListener('pointermove', this.move);
      board.removeEventListener('pointerup', this.up);
      board.removeEventListener('pointercancel', this.up);
      unobserve();
    };
  };
```

`observe` は残す（`attach` が使う）。

確認 — `pnpm check` → `0 ERRORS`

### Step 2: `GameShell` と `BorderRush` の try/catch を `capture()` に置き換える

`GameShell.svelte:22-29` の `capture` 関数を消し、`import { capture } from '$lib/board-input';` にする。
`BorderRush.svelte` の `grab()` の try/catch も `capture(event);` にする。

確認 — `grep -rn "setPointerCapture" src/` が `src/lib/board-input.ts` の 1 件だけ

### Step 3: 10 ゲームを attachment に載せ替える

各ファイルで次を機械的に行う。

1. テンプレートの `bind:this={board}` と `onpointerdown={input.down} onpointermove={input.move} onpointerup={input.up} onpointercancel={input.up}`
   を消し、代わりに `{@attach input.attach(resize)}` を書く（`resize` は今 `input.observe(board, …)` に渡している
   callback。名前はファイルごとに違う。`() => {}` を渡していた lightning と shield-break は `{@attach input.attach()}`）
2. `let board: HTMLDivElement;` を消す（ほかで `board` を使っていなければ。`grep -n "board" <file>` で確かめる）
3. `onMount` から `input.observe` と `unobserve()` を消す。残るのが `animate` だけなら
   `onMount(() => animate(frame));` の 1 行にできる（001 で `clearTimeout(finishTimer)` が増えたファイルはそのまま残す）
4. `resize()` の中の `devicePixelRatio` を `devicePixelRatio || 1` にする（bug-rush は既にそう）

hockey の例（載せ替え後）

```svelte
  onMount(() => animate(frame));
</script>

<div
  class="board"
  {@attach input.attach((aspect) => (game.aspect = aspect))}
  role="application"
  aria-label="ホッケーの盤面"
  style:--puck="{PUCK_R * 200}%"
  style:--mallet="{MALLET_R * 200}%"
>
```

`{@attach input.attach(fn)}` の `fn` がインラインの arrow だと、Svelte はその式が変わるたびに attachment を
付け直す。`game.aspect = aspect` のように `$state` を読まない arrow なら再評価は起きない。`$state` を読む
callback を渡すファイルがあれば、script で `const onResize = (aspect) => {...}` と定義して渡す。

確認 — ファイルごとに `pnpm check` → `0 ERRORS`。10 ファイル終えたら `pnpm lint` → exit 0（markuplint が
`{@attach}` を許すことの確認）、`pnpm vitals --diff` → exit 0

### Step 4: feint-master を `BoardInput` に乗せる

`FeintMaster.svelte` の `down()` と `board` を消し、次にする。

```ts
  import { BoardInput } from '$lib/board-input';
  import { sideOf } from '$lib/player';
  // ...
  /** 押した位置の陣地だけ分かればよい。指は追わないが、回転と座標の変換は BoardInput に任せる */
  const input = new BoardInput({ down: (_event, _x, y) => play(press(game, sideOf(y))) });

  onMount(() => animate((dt) => play(step(game, dt))));
</script>

<div class="board" {@attach input.attach()} role="application" aria-label="フェイントマスターの盤面">
```

`wake` と `toBoardPoint` の import は不要になる（`BoardInput.down` が `wake()` を呼ぶ）。`preventDefault()` も同じ。

確認 — `grep -n "getBoundingClientRect\|toBoardPoint\|offsetWidth" src/lib/games/feint-master/FeintMaster.svelte` が 0 件

### Step 5: 小さな守り

- `src/lib/loop.ts:9` を `frame(Math.max(0, Math.min(0.05, (now - last) / 1000)), now);` にする
- `src/lib/fingers.ts` の `velocity` で、`trail.length < 2` の判定を添字参照より前に出す

```ts
export function velocity(trail: Sample[]): { vx: number; vy: number } {
  if (trail.length < 2) return { vx: 0, vy: 0 };
  const first = trail[0];
  const last = trail[trail.length - 1];
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}
```

`src/lib/fingers.test.ts` に `expect(velocity([])).toEqual({ vx: 0, vy: 0 });` を 1 件足す。

確認 — `pnpm test:run` → pass

### Step 6: 目視（回転を含む）

`pnpm dev` を起動し、Chrome の DevTools でデバイスエミュレーションを iPad にして **横向き** にする
（`pointer: coarse` はタッチのエミュレーションで真になる）。

1. hockey を開く。画面は 90 度回って縦長の盤面になる。左（画面の左半分）に指を置くと **手前（1P、青）** の
   マレットが動き、右半分なら向かい（2P、赤）。指の位置にマレットが追従する（ずれない）
2. feint-master を開く。左半分を押すと 1P の押下として扱われる（`Hint`/`Pips` の 1P 側が反応する）
3. エミュレーションを外して PC（マウス）に戻す。回転せず、これまでどおり遊べる
4. bomb-relay、bug-rush、pin-rescue で指（マウス）の位置と盤面の反応がずれないことを見る

確認 — 上の 4 つ。`pnpm verify` → exit 0

## Test plan

- `fingers.test.ts` に 1 件（Step 5）
- 009 が済んでいれば、`src/lib/board-input.test.ts` を `dom` project に移し（`include` に足す）、
  `vi.stubGlobal('matchMedia', () => ({ matches: true }))` で `observe` が `turned` を真にすることを
  1 件足せる。済んでいなければ書かない
- 回転の経路は目視（Step 6）

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -rn "setPointerCapture" src/` が `src/lib/board-input.ts` の 1 件
- [ ] `grep -rln "onpointerdown={input.down}" src/lib/games/` が 0 件
- [ ] `grep -rln "{@attach input.attach" src/lib/games/` が 11 件（10 + feint-master）
- [ ] `grep -n "matchMedia(TURNED_QUERY)" src/lib/board-input.ts` が 1 件
- [ ] `grep -rn "devicePixelRatio" src/lib/games/*/*.svelte` のすべてが `devicePixelRatio || 1` か、`|| 1` 済みの変数経由
- [ ] `grep -n "Math.max(0, Math.min(0.05" src/lib/loop.ts` が 1 件
- [ ] Step 6 の目視 4 つ
- [ ] すべての `.svelte` が 200 行未満
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 013 の Status を更新した

## STOP conditions

- 012 が未実施（`BorderRush.svelte` に `setInterval` が残っている）
- markuplint が `{@attach}` を「不明な属性」として拒む（`.markuplintrc.jsonc` を触らず、エラー全文を報告する）
- `svelte/attachments` が解決できない（`node_modules/svelte/package.json` の version を報告）
- Step 6 の 1 で指の位置とマレットがずれる（`matchMedia` の判定と CSS の回転が食い違っている。
  エミュレーションの `pointer` の値と `app.css` の条件を報告）
- あるゲームで `board` 変数がほかの用途（例: `board.getBoundingClientRect()`）に使われている

## Maintenance notes

- 新しいゲームは `const input = new BoardInput({...})` と `{@attach input.attach(resize)}` だけで配線が済む。
  `onMount` は `animate` だけ
- `TURNED_QUERY` は `app.css` のメディアクエリと **同じ文字列** でなければならない。片方を変えたらもう片方も
- `capture()` は `board-input.ts` のもの 1 つ。新しい場所で `setPointerCapture` を直に呼ばない
