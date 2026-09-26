# Plan 040: ひらめきナゾを好きな順に解けるようにし、解いたナゾを 1 問ずつ覚える

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4f6f07a..HEAD -- src/lib/games.ts src/lib/levels.ts src/lib/components/SoloShell.svelte src/lib/components/SoloShell.svelte.test.ts src/lib/components/LevelSelect.svelte src/lib/games/hirameki/meta.ts src/lib/games/hirameki/puzzles/index.ts src/lib/games/hirameki/puzzles.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                  |
| ---------- | ----------------------------------------------------------------------------------- |
| Priority   | P1                                                                                  |
| Effort     | M                                                                                   |
| Risk       | MED（1 人用の共通シェルを触る。印の無いゲームの動きは変えないことをテストで固める） |
| Depends on | none                                                                                |
| Category   | direction                                                                           |
| Planned at | commit `4f6f07a`, 2026-09-26                                                        |

## Why this matters

ひらめきナゾ（`hirameki`）は大人 1 人（利用者の妻）が遊ぶレイトン風のナゾ解きで、100 問ある。並びは難しさの順ではなく、
同じジャンルが隣り合わない順（`puzzles/index.ts` の `ORDER`）。ところが 1 人用の共通シェルは「何番目まで進んだか」の数字
1 つしか持たず、勝ったときしか先へ進まない。解けないナゾが 1 問あると、残り全部に進めない。ナゾを選ぶ画面も、100 マスを
6 列（17 行）に並べるので、iPad で 1 マスが約 35px と押しにくい。

この計画のあと、ひらめきナゾ（印 `anyOrder` を付けた 1 人用ゲーム）では次が成り立つ。

- 遊んでいる途中に「とばす」で、まだ解いていない次のナゾへ進める
- ナゾを選ぶ画面で、どのナゾでも選べる。解いたナゾには ★ が付き、いまのナゾが光る
- 解いたナゾを番号の集合で覚える（`asobibako:solved:<id>`）。今までの「何番目まで」は、そこまでを解いたことにして引き継ぐ
- 100 問のときはマスを 10 列にし、1 マスを iPad で約 60px にする
- ナゾを足すときは `ORDER` の末尾へ足す（途中に差しこむと、覚えた番号が別のナゾを指す）。テストで固める

印の無いほかの 1 人用ゲームの動きは変えない。

## Current state

`src/lib/games.ts` の `SoloMeta`（`:57` あたりから）は `levels`・`levelName?`・`ownResult?` などを持つ。JSDoc の書き方を見本にする。

`src/lib/levels.ts:40-65`

```ts
/** 到達レベルの保存先。ゲームごと。最後のレベルをクリアしたら levels + 1 を保存する */
export const levelKey = (id: string) => `asobibako:reached:${id}`;
...
/** 保存された到達レベル（1..levels + 1）。壊れていたり読めなければ 1 */
export function savedLevel(id: string, levels: number): number { ... }

export function saveLevel(id: string, level: number): void { ... }
```

`src/lib/components/SoloShell.svelte`（172 行）の要点

```ts
let screen = $state<'title' | 'levels' | 'playing' | 'result'>('title');
let cleared = $state(false);
let complete = $state(false);
let round = $state(0);
let level = $state(1);
let best = $state(1);
let hint = $state('');
const settle = new Settle();

function start() {
  wake();
  sfx.start();
  hint = '';
  round += 1;
  screen = 'playing';
}
function retry() {
  hint = '';
  round += 1;
}

function finish(won: boolean) {
  if (screen !== 'playing') return;
  cleared = won;
  complete = won && level >= meta.levels;
  if (won) {
    best = Math.max(best, level + 1);
    saveLevel(meta.id, best);
    if (!complete) level += 1;
  }
  if (meta.ownResult && !complete) {
    start();
    return;
  }
  screen = 'result';
  settle.begin();
}

onMount(() => {
  best = savedLevel(meta.id, meta.levels);
  level = Math.min(meta.levels, best);
  return settle.listen();
});
```

テンプレートは、遊んでいるあいだ `<button class="round corner quit" ...>✕</button>` と
`<button class="round corner retry" onclick={retry} aria-label="やりなおし">↻</button>` を出す。
`<SoloTitle {meta} {Howto} {best} bind:level onlevels=... onstart={start} />`、
`<LevelSelect levels={meta.levels} name={meta.levelName} {best} onpick={(n) => { level = n; start(); }} />`。
CSS は `.corner { position: absolute; top: max(12px, env(safe-area-inset-top)); z-index: 5; }`、
`.mute, .retry { right: max(12px, env(safe-area-inset-right)); }`、`.retry { background: var(--pastel-gold); font-size: 24px; }`。

`src/lib/components/SoloTitle.svelte` は `best` までの面を ◀ ▶ で選べる（`const last = $derived(Math.min(meta.levels, best));`）。

`src/lib/components/LevelSelect.svelte`（110 行）

```svelte
  let { levels, best, name = 'レベル', onpick }: { levels: number; best: number; name?: string; onpick: (level: number) => void } = $props();
  // 50 面を 5 列にすると 10 行になり、縦に合わせたマスが iPad では小さすぎる
  const columns = $derived(levels > 30 ? 6 : 5);
...
      <button class="cell" class:cleared={n < best} class:next={n === best} disabled={n > best} onclick={() => onpick(n)} aria-label="{name} {n}">
        {n}
        {#if n < best}<span class="star"><Icon name="star" size="100%" /></span>{/if}
      </button>
```

マスの大きさは CSS で `--cell: min(calc(90cqw / var(--cols) - 12px), 96px, calc(68cqh / var(--rows) - 12px));`。

`src/lib/games/hirameki/meta.ts` は `levels: 100, levelName: 'ナゾ', ownResult: true`。
`src/lib/games/hirameki/puzzles/index.ts:44-47` の `ORDER` の JSDoc は「ナゾを足すときは、題と一緒にここへ差しこむ」。
`puzzles.test.ts` は `ORDER` を import している（ジャンルが隣り合わないことを確かめるテストがある）。

アイコンは `src/lib/icons.ts` に `arrow`（向きは中身で確かめる）がある。DOM では `<Icon name="arrow" size="26px" />`。

テストの見本は `src/lib/components/SoloShell.svelte.test.ts`（`show(extra)` で meta を差し替えて mount、`start(target)`、
`hooks.solo!(true)` で勝たせる。`hooks.level` で今のレベルが分かる）。

## Commands you will need

| Purpose             | Command                                                                                 | Expected on success  |
| ------------------- | --------------------------------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                                        | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/levels.test.ts src/lib/components src/lib/games/hirameki` | all pass             |
| 全テスト            | `pnpm test:run`                                                                         | all pass             |
| 型                  | `pnpm check`                                                                            | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                                             | exit 0               |
| vitals              | `pnpm vitals --diff`                                                                    | exit 0               |

## Scope

In scope は Drift check に並べた 8 ファイル、`src/lib/levels.test.ts`（新規）、`CLAUDE.md`（1 人用シェルの説明とひらめきナゾの
段落に 1 文ずつ）。

Out of scope は次のとおり。

- `SoloTitle.svelte`（`best` の渡し方をシェルで変えるだけで足りる）
- ひらめきナゾの中身（`Hirameki.svelte` など。とばすのはシェルが持つ）
- 一覧のカードの到達表示（`GameCard.svelte`）。`reached` は今までどおり保存する
- バックアップ（`asobibako:solved:` は `asobibako:` で始まるので自動で書き出しに入る）

## Git workflow

- ステップごとにコミットしてよい。メッセージは英語の命令形 1 行（例 `Let hirameki puzzles be solved in any order`）。
  末尾に Co-Authored-By を 1 行
- push しない。git stash は使わない

## Steps

### Step 1: 解いた面の集合を保存する関数を足す

`levels.ts` に次を足す（JSDoc は日本語で、何を返すかを書く）。

- `export const solvedKey = (id: string) => ...`（`levelKey` と同じ形で、保存名は `asobibako:solved:<id>`）
- `export function savedSolved(id: string, levels: number, best: number): Set<number>`
  - `solvedKey(id)` に JSON の数の配列があれば、1..levels の整数だけの Set
  - 無い・壊れているときは、今までの到達 `best` から `1..best-1` を解いたことにした Set（引き継ぎ）
  - localStorage が使えなければ空の Set
- `export function saveSolved(id: string, solved: ReadonlySet<number>): void`（小さい順の配列で書く。書けなくても投げない）
- `export function nextOpen(from: number, solved: ReadonlySet<number>, levels: number): number`
  - `from + 1` から順に 1..levels を一周して、最初の解いていない面。全部解いていれば `from`（`from` が 0 なら 1）

`src/lib/levels.test.ts`（先頭に `// @vitest-environment happy-dom`）に 4 本。

1. 何も無いとき、`savedSolved('x', 10, 4)` は `{1, 2, 3}`
2. `saveSolved` → `savedSolved` で同じ集合が戻る。範囲外の数や文字は捨てる
3. `nextOpen(3, {4, 5}, 10)` は 6、`nextOpen(9, {10, 1}, 10)` は 2、`nextOpen(0, {}, 10)` は 1
4. 全部解いていると `nextOpen(3, {1..10}, 10)` は 3

**Verify**: `pnpm exec vitest run src/lib/levels.test.ts` → 4 passed

### Step 2: 印と、ナゾを選ぶ画面

- `games.ts` の `SoloMeta` に `/** 面を好きな順に選べ、とばせる。解いた面を 1 つずつ覚える（難しさの順に並ばないナゾ解きなど） */ anyOrder?: boolean;` を足す
- `LevelSelect.svelte` に任意の props `solved?: ReadonlySet<number>` と `current?: number` を足す
  - `solved` があるときは、どのマスも押せる（`disabled` にしない）。★ と `cleared` は `solved.has(n)`、`next` は `n === current`
  - `solved` が無いときは今までどおり（`best` で決める）
  - 列の数を `levels > 60 ? 10 : levels > 30 ? 6 : 5` にし、コメントを「100 面を 6 列にすると 17 行になり、iPad でマスが 35px ほどに
    なる。行を 10 までに抑える」のように今の理由に直す

**Verify**: `pnpm check` → 0 errors。`pnpm exec vitest run src/lib/components` → all pass（印の無いゲームは変わらない）

### Step 3: シェルで、解いた面を覚え、とばせるようにする

`SoloShell.svelte` を次のようにする。印の無いゲームの動きは変えない。

- `let solved = $state<ReadonlySet<number>>(new Set());`
- `onMount` で、`meta.anyOrder` なら `solved = savedSolved(meta.id, meta.levels, best)`、`level = nextOpen(0, solved, meta.levels)`
  （全部解いていれば 1）。印が無ければ今までどおり
- `finish(won)` で、`meta.anyOrder` かつ `won` のときは、`best` の保存は今までどおりにしたうえで、`solved` に `level` を足した
  新しい Set を作って `saveSolved`。`complete = solved.size >= meta.levels`。完了でなければ `level = nextOpen(level, solved, meta.levels)`
  （`level += 1` の代わり）
- `function skip() { level = nextOpen(level, solved, meta.levels); retry(); }`
- 遊んでいるあいだ、`meta.anyOrder` のときだけ ↻ の下に「とばす」の丸ボタンを出す。
  `<button class="round corner skip" onclick={skip} aria-label="とばす"><Icon name="arrow" size="26px" /></button>`
  （`arrow` が右向きでなければ `style:rotate` で右へ向ける）。CSS は `.skip { top: calc(max(12px, env(safe-area-inset-top)) + 60px); right: max(12px, env(safe-area-inset-right)); }`
- `<SoloTitle ... best={meta.anyOrder ? meta.levels : best} .../>`（◀ ▶ でどのナゾでも選べる）
- `<LevelSelect ... solved={meta.anyOrder ? solved : undefined} current={level} .../>`

`savedSolved`・`saveSolved`・`nextOpen` は `$lib/levels` から import する。

**Verify**: `pnpm check` → 0 errors。`wc -l src/lib/components/SoloShell.svelte` → 200 未満

### Step 4: ひらめきナゾに印を付け、ナゾの並びを固める

- `hirameki/meta.ts` に `anyOrder: true` を足す
- `puzzles/index.ts` の `ORDER` の JSDoc の「ナゾを足すときは、題と一緒にここへ差しこむ」を「ナゾを足すときは末尾へ足す。
  解いたナゾは番号で覚えているので、途中に差しこんだり並べ替えたりすると、覚えた番号が別のナゾを指す」にする
- `puzzles.test.ts` に 1 本足す。いまの `ORDER` の先頭 100 問の題を改行でつないだ文字列の sha1（`node:crypto` の `createHash`）が、
  いまの値と一致すること。値は実行して求め、テストに書く。テストの名前は「ナゾの並びは末尾に足すだけ（先頭 100 問は動かさない）」

**Verify**: `pnpm exec vitest run src/lib/games/hirameki` → all pass（1 本増える）

### Step 5: シェルのテストを書く

`SoloShell.svelte.test.ts` に 4 本（`show({ anyOrder: true })` のように印を渡す。`show` の引数の型に `anyOrder?: boolean` を足す）。

1. 印があると、遊んでいるあいだ「とばす」が出て、押すとレベルが 2 になる（`hooks.level`）。印が無いと出ない
2. 印があるとき、2 を解いてから（レベル選びで 2 を選ぶ → `hooks.solo!(true)`）ナゾを選ぶ画面を開くと、2 に ★ があり、10 も押せる
3. 印があるとき、`asobibako:reached:stub` が `'4'` なら、開いたときのレベルは 4（1〜3 は解いたことになる）
4. 印があるとき、勝つと `asobibako:solved:stub` に解いた番号が入る

**Verify**: `pnpm exec vitest run src/lib/components/SoloShell.svelte.test.ts` → all pass（4 本増える）

### Step 6: CLAUDE.md に今の仕様を書く

- 1 人用のシェルの説明（「1 人用（`meta.players` が 1）は `SoloShell.svelte` が受け、…」の段落）に、「`meta.anyOrder` のゲームは
  どの面でも選べ、遊んでいるあいだ「とばす」で次の解いていない面へ進める。解いた面は `asobibako:solved:<id>` に番号の集合で
  覚える」を足す
- ひらめきナゾの段落の「遊ぶ順とジャンルは `puzzles/index.ts` の `ORDER` が決め、…」に、「ナゾは末尾に足す（解いたナゾを番号で
  覚えるので、途中に差しこまない。先頭 100 問の並びはテストが固める）」を足す

経緯は書かない。

**Verify**: `grep -c "anyOrder" CLAUDE.md` → 1 以上。`pnpm lint` → exit 0

### Step 7: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

- `src/lib/levels.test.ts` 4 本（Step 1）
- `SoloShell.svelte.test.ts` 4 本（Step 5）
- `puzzles.test.ts` 1 本（Step 4）
- 既存の SoloShell・LevelSelect・SoloTitle のテストが変えずに通ること（印の無いゲームの動きが変わらない）

## Done criteria

- [ ] 上のテストがすべて pass し、既存のテストの期待を変えていない（`git diff 4f6f07a -- src/lib/components/SoloShell.svelte.test.ts` は足した行だけ）
- [ ] `SoloShell.svelte` と `LevelSelect.svelte` がどちらも 200 行未満
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` が通る
- [ ] `git diff --name-only 4f6f07a` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- 抜粋と今のコードが違う
- `SoloShell.svelte` が 200 行を超え、CSS を詰めても収まらない（どこを分けるかを報告して聞く）
- 既存のテストの期待を変えないと通らない
- `hooks.level` など、テストの道具が印のあるときの動きを確かめるのに足りない

## Maintenance notes

- 面の数を減らすと、覚えた番号のうち範囲外のものは読むときに捨てられる
- ひらめきナゾにナゾを足したら、先頭 100 問の sha1 のテストはそのまま通る（末尾に足すだけなら先頭は変わらない）。
  101 問め以降の並びも固めたくなったら、テストの範囲を広げる
- 印のあるゲームでは、`reached`（一覧のカードの「ナゾ N」）は解いたいちばん大きな番号 + 1 のまま。解いた数とは違う
