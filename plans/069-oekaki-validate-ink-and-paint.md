# Plan 069: おえかきのもりで、子から届いた線と塗りの形を確かめてから使う

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/games/oekaki-mori/strokes.ts src/lib/games/oekaki-mori/relay.ts src/lib/games/oekaki-mori/relay-referee.ts src/lib/games/oekaki-mori/referee.ts src/lib/games/oekaki-mori/round.svelte.ts src/lib/games/oekaki-mori/together.ts src/lib/games/oekaki-mori/Together.svelte src/lib/games/oekaki-mori/strokes.test.ts src/lib/games/oekaki-mori/relay.test.ts src/lib/games/oekaki-mori/referee.test.ts src/lib/games/oekaki-mori/round.svelte.test.ts src/lib/games/oekaki-mori/together.test.ts src/lib/games/oekaki-mori/Together.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------- |
| Priority   | P3                                                                                       |
| Effort     | S（形を確かめる関数を 2 か所に足し、受け取る 5 か所で使う）                              |
| Risk       | LOW（正しい知らせの扱いは変えない。既存のテストのうち 2 か所だけ、正しい色と番号に直す） |
| Depends on | none                                                                                     |
| Category   | bug（robustness）                                                                        |
| Planned at | commit `ea56ff6`, 2026-10-14                                                             |

## Why this matters

おえかきのもりは 2〜3 台の iPad を QR でつなぎ、親の端末が審判になって、子から届いた操作（`act`）を全員へ配る。
描く人の線（`ink`）と、みんなでぬりえの塗り（`paint`）は、形を確かめずにそのまま使っている。相手は同じアプリの
家族の端末なので、形の違う知らせが来るのは、版の食い違い（たとえば新しい版が線の命令の種類を足したとき）か送る側の
不具合のときだけ。ただし来たときの害が大きく、直らない。

1. 線の命令の `k` が知らないものだと、`strokes.ts` の `apply` の `switch` に `default` が無いので `undefined` を返す。
   おえかきリレーではそのこまの `strokes` が `undefined` になり、次のだんで当てる人の画面と、ふりかえりで全員の画面の
   描き直し（`render` の `for (const stroke of strokes)`）が例外で止まる
2. 塗りの番号が `NaN` だと `region < 0` を通り、親は `colors["NaN"]` に色を入れる。全員へ配る `painted` では
   `JSON.stringify` が `NaN` を `null` にするので、子は `Number(null)` で場所 0 を塗る。親と子の絵が食い違い、親の
   「できた！」で全員のぬりえちょう（IndexedDB）に食い違った色が残る。範囲外の番号や色でない文字も同じく残る

やっぱりカメレオンの審判は届いた体の形を確かめてから使う（`yappari-chameleon/host.ts` の `isMe`）。アニマルサバイバーの
協力プレイも同じ直しを入れた（計画 054）。同じ考え方で、親が受け取る口で形を確かめ、形の違う知らせは捨てる。子が親から
受け取る口でも同じ確かめを通す（親が古い版のときの守り）。

## Current state

### 線の命令（`strokes.ts`）

`src/lib/games/oekaki-mori/strokes.ts:28-48` にある。`k` が 4 つのどれでもなければ `undefined` を返し、`add` の `pts` が
配列でなければ広げるところで例外になる。

```ts
export type Ink =
  | { k: 'start'; color: string; size: number; x: number; y: number }
  | { k: 'add'; pts: number[] }
  | { k: 'undo' }
  | { k: 'clear' };

export function apply(strokes: Stroke[], ink: Ink): Stroke[] {
  switch (ink.k) {
    case 'start':
      return [...strokes, { color: ink.color, size: ink.size, pts: [ink.x, ink.y] }];
    case 'add': {
      const last = strokes.at(-1);
      if (!last) return strokes;
      return [...strokes.slice(0, -1), { ...last, pts: [...last.pts, ...ink.pts] }];
    }
    case 'undo':
      return strokes.slice(0, -1);
    case 'clear':
      return [];
  }
}
```

座標は 0..1 に収まるとは限らない。描く端末の `Board.svelte` は `down` で指を捕まえ（`src/lib/board-input.ts:71` の
`capture(event)`）、盤面の外へ指が出ても点を送り続ける。座標に直す `toBoardPoint`（`src/lib/board-input.ts:36-39`）は
丸めない。だから **座標の範囲は確かめず、有限の数であることだけを確かめる**（範囲を確かめると、盤面のふちからはみ出した
本物の線を捨ててしまう）。描く端末は 1 フレームぶんの点をまとめて送る（`Board.svelte:34-37` の `flush` を `animate` で
毎フレーム呼ぶ）。

### 線を受け取る 3 か所

`src/lib/games/oekaki-mori/relay.ts:124-129`（おえかきリレーの親）。`relay.ts:3` で `type Ink` を読む。

```ts
export function addInk(s: Relay, seat: Seat, ink: Ink): void {
  if (s.phase !== 'play' || !drawing(s.step) || s.done.includes(seat)) return;
  const c = chainOf(s, seat);
  const entry = s.chains[c]?.entries.at(-1);
  if (entry?.kind === 'draw') entry.strokes = apply(entry.strokes, ink);
}
```

`src/lib/games/oekaki-mori/relay-referee.ts:6` と `:47` がそれを呼ぶ。

```ts
import type { Ink } from './strokes';
// …
if (message.t === 'ink') addInk(s, from, message.ink as Ink);
```

`src/lib/games/oekaki-mori/referee.ts:66-69`（エゴコロクイズとはやおし検定の親）。描く人の `ink` を形を見ずにほかの全員へ
そのまま配る。この分岐は `return` で `#push()` を通らない（今も同じ）。

```ts
    else if (message.t === 'ink') {
      // 描く人の端末は自分で描いているので、ほかの人にだけ配る
      if (s.phase !== 'draw' || from !== drawer(s)) return;
      for (const seat of this.#party.members) if (seat !== from) this.#party.tell(seat, message);
```

`src/lib/games/oekaki-mori/round.svelte.ts:7` と `:54`（全員の端末。親から届いた `ink` を盤面に入れる）。

```ts
import { apply, type Ink, type Stroke } from './strokes';
// …
    else if (m.t === 'ink') this.strokes = apply(this.strokes, m.ink as Ink);
```

`Round` の `ink(i: Ink)`（`round.svelte.ts:83-85`）は自分の端末で描いた線なので、確かめなくてよい。

### 塗り（`together.ts` と `Together.svelte`）

`src/lib/games/oekaki-mori/together.ts:1-30` にある。番号は `region < 0` しか見ず、色は何でも通り、`dabs` は増え続ける。

```ts
import type { Seat } from '$lib/net/party.svelte';

/** 1 回の塗り。戻すときに、いまの色がこの塗りのままかを after で確かめる */
export interface Dab {
  seat: Seat;
  region: number;
  before: string | null;
  after: string;
}
// …
export const shared = (): Shared => ({ colors: {}, dabs: [] });

export function paintBy(s: Shared, seat: Seat, region: number, color: string): Change | null {
  if (region < 0 || s.colors[region] === color) return null;
  s.dabs.push({ seat, region, before: s.colors[region] ?? null, after: color });
  s.colors[region] = color;
  return { region, color };
}
```

`src/lib/games/oekaki-mori/Together.svelte` は今 **199 行**（上限は 200 未満）。行を増やせないので、確かめは `together.ts` に
置き、`.svelte` の行は減らす。親が子の塗りを受ける口は `Together.svelte:109-114`。

```ts
const change =
  m.t === 'paint'
    ? paintBy(host, from, Number(m.region), String(m.color))
    : m.t === 'unpaint'
      ? undoBy(host, from)
      : null;
```

全員が親から色の変化を受ける口は `Together.svelte:64-69`。

```ts
    } else if (m.t === 'painted') {
      const next = { ...colors };
      if (m.color === null) delete next[Number(m.region)];
      else next[Number(m.region)] = String(m.color);
      colors = next;
    } else if (m.t === 'undone') sounds.undo();
```

`Together.svelte:18` は `import { paintBy, shared, undoBy } from './together';`。場所の数は、線画を受け取ったときに作る
`sheet`（`Together.svelte:23` の `$state.raw<{ art: Art; regions: Regions; … } | null>`）の `sheet.regions.count`
（`src/lib/coloring/regions.ts:4-10` の `Regions.count`）。親も自分が配った `art` を同じ列（`queue`）で受け取って `sheet` を
作るので、子の塗りが届くころには親の `sheet` もある。

色はパレット（`src/lib/coloring/Palette.svelte:2-20` の `COLORS`）の `#rrggbb` の小文字 6 けたの 17 色だけ。`together.ts` は
node のテスト（`together.test.ts`）から読まれるので、`.svelte` の部品から `COLORS` を import しない。代わりに
`/^#[0-9a-f]{6}$/` の形だけを確かめる（ぬりえちょうの絵を描く `src/lib/coloring/art.ts:50` の `rgb` が読める形）。

ひとりのぬりえは戻す手順を `MAX_STEPS`（`src/lib/coloring/paint.ts:13-14`、200）までにしている。みんなでぬりえの `dabs` は
保存しないが、親が遊ぶあいだ持ち続けるので、同じ数で上限を付ける。`undoBy`（`together.ts:33-44`）は新しい順に探すので、
古いほうを捨てても変わらない。

### 規約

コメントは「コードから復元できない WHY」だけを日本語で書く。変更履歴やタスク番号は書かない。`.svelte` は 200 行未満
（svelte-vitals `architecture/component-size` がファイル全体を数える）。テストの名前は日本語の文にする。

## Commands you will need

| Purpose       | Command                                                                                                                                                                                       | Expected on success           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| node のテスト | `pnpm exec vitest run src/lib/games/oekaki-mori/strokes.test.ts src/lib/games/oekaki-mori/relay.test.ts src/lib/games/oekaki-mori/referee.test.ts src/lib/games/oekaki-mori/together.test.ts` | すべて pass                   |
| dom のテスト  | `pnpm exec vitest run src/lib/games/oekaki-mori/round.svelte.test.ts src/lib/games/oekaki-mori/Together.svelte.test.ts`                                                                       | すべて pass                   |
| 全テスト      | `pnpm test:run`                                                                                                                                                                               | exit 0                        |
| 型            | `pnpm check`                                                                                                                                                                                  | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                                                                                                                                   | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                                                                                                                          | 警告 0                        |
| 全部          | `pnpm verify`                                                                                                                                                                                 | exit 0                        |

`*.test.ts` は node、`*.svelte.test.ts` は happy-dom の project で動く（`vite.config.ts` の `test.projects`）。

## Scope

**In scope**

- `src/lib/games/oekaki-mori/strokes.ts`
- `src/lib/games/oekaki-mori/relay.ts`
- `src/lib/games/oekaki-mori/relay-referee.ts`
- `src/lib/games/oekaki-mori/referee.ts`
- `src/lib/games/oekaki-mori/round.svelte.ts`
- `src/lib/games/oekaki-mori/together.ts`
- `src/lib/games/oekaki-mori/Together.svelte`
- テスト（足す・直す）`strokes.test.ts`・`relay.test.ts`・`referee.test.ts`・`round.svelte.test.ts`・`together.test.ts`・`Together.svelte.test.ts`（すべて `src/lib/games/oekaki-mori/`）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/net/` の全部（`Party`・`Link`）— 知らせの中身を確かめるのはゲームの側
- `Board.svelte` と描く側の送り方 — 送る形は正しい
- `apply` の `add` が線の点を毎回まるごと写すこと — 1 本の線の点は数百で、測った遅さも無いので直さない
- 座標を 0..1 に丸めること — 上に書いたとおり、はみ出した点は本物の線
- 線の色と太さをペンの表（`PENS`・`SIZES`・`ERASER`）と照らすこと — 違う色や太さでも canvas が無視するか描くだけで、
  保存もされない。表と照らすと、ペンを足した新しい版の子の線を古い親が捨てるようになる
- `sync` と `drawing` の知らせ（親から届く絵のまとめ）を確かめること — 親が作るもので、子からは来ない
- `src/lib/games/oekaki-mori/CLAUDE.md` — 書いてある遊び方は変わらない

## Git workflow

- ブランチは `advisor/069-oekaki-validate-ink-and-paint`
- コミットは線と塗りで 2 つでもよい。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない（例 `Drop malformed ink before the oekaki referees apply it`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: `strokes.ts` に `isInk` を足し、`apply` に `default` を足す

先にテストを書く。`strokes.test.ts` の import を `import { apply, isInk, render, renderTail, snap, type Ink, type Stroke } from './strokes';`
にし、`describe('apply', …)` の中に 1 つ、その下に `describe('isInk', …)` を足す。

```ts
it('知らない命令は線をそのまま返す', () => {
  const s = apply([], start(0, 0));
  expect(apply(s, { k: 'fill' } as unknown as Ink)).toBe(s);
});
```

```ts
describe('isInk', () => {
  it('描く端末が送る 4 つの命令を通し、盤面の外へはみ出した座標も通す', () => {
    expect(isInk({ k: 'start', color: '#2b2d42', size: 0.018, x: -0.02, y: 1.03 })).toBe(true);
    expect(isInk({ k: 'add', pts: [0.1, 0.2, 1.2, -0.1] })).toBe(true);
    expect(isInk({ k: 'undo' })).toBe(true);
    expect(isInk({ k: 'clear' })).toBe(true);
  });

  it('知らない命令・欠けた値・数でない点・奇数個の点・多すぎる点は通さない', () => {
    for (const bad of [
      null,
      'start',
      { k: 'fill' },
      { k: 'start', color: '#2b2d42', size: 0.018, x: 0.1 },
      { k: 'start', color: 1, size: 0.018, x: 0.1, y: 0.1 },
      { k: 'add', pts: 'x' },
      { k: 'add', pts: [0.1, '0.2'] },
      { k: 'add', pts: [0.1, null] },
      { k: 'add', pts: [0.1] },
      { k: 'add', pts: new Array(4098).fill(0.5) }
    ])
      expect(isInk(bad)).toBe(false);
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/strokes.test.ts` → 足したテストが落ちる（`isInk` が無い）。

次に `strokes.ts` を直す。`Ink` の型の下に次を足す。

```ts
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 1 回の add の数の上限。描く端末は 1 フレームぶんの点を送るので、数秒引っかかってもここまでたまらない */
const MAX_ADD = 4096;

/** 子から届いた線の命令の形か。盤面のふちから指がはみ出しても線は続くので、座標は 0..1 に限らない */
export function isInk(v: unknown): v is Ink {
  if (typeof v !== 'object' || v === null) return false;
  const ink = v as Record<string, unknown>;
  if (ink.k === 'undo' || ink.k === 'clear') return true;
  if (ink.k === 'start') return typeof ink.color === 'string' && finite(ink.size) && finite(ink.x) && finite(ink.y);
  const { pts } = ink;
  return ink.k === 'add' && Array.isArray(pts) && pts.length % 2 === 0 && pts.length <= MAX_ADD && pts.every(finite);
}
```

`apply` の `switch` の最後（`case 'clear': return [];` の下）に `default:` と `return strokes;` を足す。コメントは
「新しい版の命令が届いても、線を消さずにそのまま返す」を `default` の上に 1 行。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/strokes.test.ts` → すべて pass。

### Step 2: 線を受け取る 3 か所で `isInk` を通す

先にテストを書く。

`relay.test.ts` の `describe('relay', …)` に足す。

```ts
it('形の違う線の命令は捨て、こまの線を壊さない', () => {
  const s = relay([1, 2]);
  addInk(s, 1, { k: 'start', color: '#000', size: 0.01, x: 0.1, y: 0.1 });
  addInk(s, 1, { k: 'fill' });
  addInk(s, 1, { k: 'add', pts: 'x' });
  allDone(s);
  const task = taskOf(s, 2);
  expect(task.kind === 'guess' && task.strokes).toEqual([{ color: '#000', size: 0.01, pts: [0.1, 0.1] }]);
});
```

`referee.test.ts` の `describe('Referee', …)` に足す（`act({ t: 'start' }, 1)` で 1 が描く人になり、描く時間に入る。
既存の「打っている字は…」のテストと同じ始め方）。

```ts
it('描く人の線は形を確かめてからほかの人へ配り、形の違うものは配らない', () => {
  const { party, told, act } = fakeParty([1, 2, 3]);
  new Referee(party).start('egokoro');
  act({ t: 'start' }, 1);
  told.length = 0;
  act({ t: 'ink', ink: { k: 'fill' } }, 1);
  act({ t: 'ink', ink: { k: 'add', pts: 'x' } }, 1);
  expect(told.filter(([, m]) => m.t === 'ink')).toEqual([]);
  act({ t: 'ink', ink: { k: 'undo' } }, 1);
  expect(told.filter(([, m]) => m.t === 'ink').map(([seat]) => seat)).toEqual([2, 3]);
});
```

`round.svelte.test.ts` の `describe('Round', …)` に足す。

```ts
it('形の違う線の命令は盤面に入れない', () => {
  const r = new Round();
  r.receive({ t: 'ink', ink: { k: 'start', color: '#000', size: 0.01, x: 0.1, y: 0.1 } });
  r.receive({ t: 'ink', ink: { k: 'fill' } });
  r.receive({ t: 'ink', ink: { k: 'add', pts: 'x' } });
  expect(r.strokes).toEqual([{ color: '#000', size: 0.01, pts: [0.1, 0.1] }]);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/relay.test.ts src/lib/games/oekaki-mori/referee.test.ts src/lib/games/oekaki-mori/round.svelte.test.ts`
→ 足した 3 つは、Step 1 の `default` があるので `{ k: 'fill' }` は通るが、`{ k: 'add', pts: 'x' }` で落ちる（例外か、配ってしまう）。
落ち方が違っても、足した 3 つのどれかが落ちていればよい。3 つとも通ったら STOP（`isInk` を通す前から守れていることになり、前提が違う）。

次にコードを直す。

1. `relay.ts` の import を `import { apply, isInk, type Stroke } from './strokes';` にし（`Ink` は使わなくなる）、`addInk` の
   引数を `ink: unknown` にして、最初の `if` に `!isInk(ink) ||` を足す。
   `if (!isInk(ink) || s.phase !== 'play' || !drawing(s.step) || s.done.includes(seat)) return;`
2. `relay-referee.ts` の `import type { Ink } from './strokes';`（6 行め）を消し、47 行めを
   `if (message.t === 'ink') addInk(s, from, message.ink);` にする
3. `referee.ts` に `import { isInk } from './strokes';` を足し、68 行めを
   `if (s.phase !== 'draw' || from !== drawer(s) || !isInk(message.ink)) return;` にする
4. `round.svelte.ts` の import を `import { apply, isInk, type Ink, type Stroke } from './strokes';` にし、54 行めを
   `else if (m.t === 'ink' && isInk(m.ink)) this.strokes = apply(this.strokes, m.ink);` にする。
   `pnpm check` が `m.ink` の型を狭められないと言ったら、`as Ink` を残さずに
   `else if (m.t === 'ink') { const ink = m.ink; if (isInk(ink)) this.strokes = apply(this.strokes, ink); }` の形にする
   （prettier が整える）

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/` → すべて pass。
`grep -n "as Ink" src/lib/games/oekaki-mori/*.ts | grep -v "\.test\.ts"` → 何も返さない（`strokes.test.ts` の
`as unknown as Ink` はテストなので数えない）。

### Step 3: `together.ts` に塗りの確かめと `dabs` の上限を足す

先にテストを書く。`together.test.ts` の import を次にする。

```ts
import { describe, expect, it } from 'vitest';
import { MAX_STEPS } from '$lib/coloring/paint';
import { paintBy, paintFrom, recolor, shared, undoBy } from './together';
```

そして次の 2 つの `describe` をファイルの末尾に足す（既存の `paintBy` と `undoBy` のテストは変えない。`paintBy` 自体は形を
確かめない関数のまま残すので、`'#f00'` のままで通る）。

```ts
describe('paintFrom', () => {
  it('配った線画にある番号とパレットの形の色だけを塗る', () => {
    const s = shared();
    expect(paintFrom(s, 2, { t: 'paint', region: 3, color: '#f04438' }, 4)).toEqual({ region: 3, color: '#f04438' });
    for (const [region, color] of [
      [NaN, '#f04438'],
      [1.5, '#f04438'],
      [-1, '#f04438'],
      [4, '#f04438'],
      ['2', '#f04438'],
      [2, '#f00'],
      [2, 'red'],
      [2, null]
    ])
      expect(paintFrom(s, 2, { t: 'paint', region, color }, 4)).toBeNull();
    expect(s.colors).toEqual({ 3: '#f04438' });
    expect(s.dabs).toHaveLength(1);
  });

  it('戻す手順は、ひとりのぬりえと同じ数までにする', () => {
    const s = shared();
    for (let i = 0; i < MAX_STEPS + 5; i++) paintBy(s, 2, 0, i % 2 ? '#f04438' : '#3bb54a');
    expect(s.dabs).toHaveLength(MAX_STEPS);
  });
});

describe('recolor', () => {
  it('色の変化を新しい表にして返し、白に戻す null も受ける', () => {
    const colors = { 1: '#f04438' };
    expect(recolor(colors, { t: 'painted', region: 2, color: '#3bb54a' }, 4)).toEqual({ 1: '#f04438', 2: '#3bb54a' });
    expect(recolor(colors, { t: 'painted', region: 1, color: null }, 4)).toEqual({});
    expect(colors).toEqual({ 1: '#f04438' });
  });

  it('形の違う変化は、表をそのまま返す', () => {
    const colors = { 1: '#f04438' };
    for (const [region, color] of [
      [null, '#3bb54a'],
      [4, '#3bb54a'],
      [2, 'red'],
      [2, undefined]
    ])
      expect(recolor(colors, { t: 'painted', region, color }, 4)).toBe(colors);
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/together.test.ts` → 足したテストが落ちる（`paintFrom` と `recolor` が無い）。

次に `together.ts` を直す。import を次の 3 行にする。

```ts
import { MAX_STEPS } from '$lib/coloring/paint';
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
```

`shared` の下に、2 つの確かめを置く。

```ts
/** 配った線画にある場所の番号か。NaN は JSON で null になり、子の端末では場所 0 を塗ってしまう */
const isRegion = (v: unknown, count: number): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < count;
/** パレットの色の形か。形の違う色は「できた！」で全員のぬりえちょうに残る */
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/.test(v);
```

`paintBy` の `s.dabs.push(…)` の次の行に、上限を足す。

```ts
// 親が遊ぶあいだ持ち続けるので、ひとりのぬりえと同じ数だけ戻せるようにして増え続けないようにする
if (s.dabs.length > MAX_STEPS) s.dabs.shift();
```

`paintBy` の下に 2 つの関数を足す。

```ts
/** 子から届いた塗りを、配った線画とパレットの形か確かめてから塗る */
export function paintFrom(s: Shared, seat: Seat, m: Message, count: number): Change | null {
  const { region, color } = m;
  return isRegion(region, count) && isColor(color) ? paintBy(s, seat, region, color) : null;
}

/** 親から届いた色の変化を入れた新しい表を返す。形が違えば表をそのまま返す */
export function recolor(colors: Record<number, string>, m: Message, count: number): Record<number, string> {
  const { region, color } = m;
  if (!isRegion(region, count) || (color !== null && !isColor(color))) return colors;
  const next = { ...colors };
  if (color === null) delete next[region];
  else next[region] = color;
  return next;
}
```

`pnpm check` が `recolor` の `color` を `string` に狭められないと言ったら、最後の 2 行を
`if (isColor(color)) next[region] = color; else delete next[region];` にする（`color` は `null` か色のどちらかしか残らない）。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/together.test.ts` → すべて pass。

### Step 4: `Together.svelte` を新しい 2 つの関数につなぎ、行を減らす

1. 18 行めを `import { paintFrom, recolor, shared, undoBy } from './together';` にする（`paintBy` は使わなくなる）
2. 64〜69 行めの `painted` の分岐（6 行）を、次の 2 行にする

```ts
    } else if (m.t === 'painted') colors = recolor(colors, m, sheet?.regions.count ?? 0);
    else if (m.t === 'undone') sounds.undo();
```

3. 111 行めを `? paintFrom(host, from, m, sheet?.regions.count ?? 0)` にする

**Verify**: `wc -l src/lib/games/oekaki-mori/Together.svelte` → 199 以下（4 行減って 195 前後）。
`grep -n "Number(m.region)\|String(m.color)" src/lib/games/oekaki-mori/Together.svelte` → 何も返さない。

### Step 5: `Together.svelte.test.ts` の塗りを、配った線画にある番号とパレットの色にする

テストの `templateArt` の偽物は全部 0 の線画を返すので、`label()` は場所を 1 つ（番号 0）だけ作る（`count === 1`）。
今のテストは番号 1 と色 `'#f00'` で塗っていて、確かめを入れると捨てられる。

1. 110 行め `party.act({ t: 'paint', region: 0, color: '#f00' });` を `party.act({ t: 'paint', region: 0, color: '#f04438' });` にする
   （「できた！のあとは受け付けない」を、確かめで捨てられるのではなく本当に閉じたことで確かめるため）
2. 155 行め `party.act({ t: 'paint', region: 1, color: '#f00' });` を `party.act({ t: 'paint', region: 0, color: '#f04438' });` にする

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/Together.svelte.test.ts` → すべて pass（「戻った子に、いまの線画と
塗った色を送り…」が `['art', 'painted', 'finished']` のまま通る）。

### Step 6: 全体の確かめ

`isRegion` や `isInk` の行は 120 字を超えるので、先に `pnpm format` で整える（整えたあとで `wc -l` をもう一度見る）。

**Verify**: `pnpm verify` → exit 0（svelte-vitals の 200 行の決まりを含む）。

## Test plan

- 足すテストは、`strokes.test.ts` に 3 つ（`apply` の知らない命令、`isInk` の通すもの・通さないもの）、`relay.test.ts` に 1 つ、
  `referee.test.ts` に 1 つ、`round.svelte.test.ts` に 1 つ、`together.test.ts` に 4 つ（`paintFrom` 2 つ、`recolor` 2 つ）
- 直すテストは `Together.svelte.test.ts` の 110 行めと 155 行め（番号と色だけ）
- 型にするテストは、それぞれのファイルの既存のテスト（`referee.test.ts` の `fakeParty`、`relay.test.ts` の `relay` と `allDone`、
  `round.svelte.test.ts` の `new Round()`）
- `pnpm exec vitest run src/lib/games/oekaki-mori/` → すべて pass

## Done criteria

- [ ] Commands の「node のテスト」と「dom のテスト」が pass し、足した 10 個を含む
- [ ] `grep -n "as Ink" src/lib/games/oekaki-mori/*.ts | grep -v "\.test\.ts"` が何も返さない
- [ ] `grep -n "default:" src/lib/games/oekaki-mori/strokes.ts` が 1 行返す
- [ ] `grep -n "Number(m.region)" src/lib/games/oekaki-mori/Together.svelte` が何も返さない
- [ ] `wc -l < src/lib/games/oekaki-mori/Together.svelte` が 199 以下
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 069 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（`apply`・`addInk`・`referee.ts` の `ink` の分岐・`round.svelte.ts:54`・`paintBy`・`Together.svelte` の 2 か所）が今のコードと違う
- Step 2 の最初の確かめで、足した 3 つのテストが直す前から全部通る
- `isInk` を足したあとで、既存のテスト（とくに `Board.svelte.test.ts`・`Play.svelte.test.ts`・`RelayPlay.svelte.test.ts`・
  `relay-referee.test.ts`）が落ちる。描く側が送る本物の形を捨てている恐れがあるので、条件をゆるめる前に報告する
- `Together.svelte` が 199 行を超える（行を詰めるために中身を変えない。報告する）
- `together.ts` から `$lib/coloring/paint` を import すると node のテストで読めない
- `src/lib/net/` を変えたくなった

## Maintenance notes

- 線の命令の種類（`Ink` の `k`）を足すときは、`isInk` にも足す。足し忘れると、その命令は親で捨てられ、描く人の画面にしか出ない
- `isInk` はわざと座標の範囲と色の表を見ない。ペンを足しても古い親が捨てないように、形だけを確かめる
- みんなでぬりえの色をパレットの外から選べるようにするときは、`together.ts` の `isColor` の形を合わせる
- 実機では、2〜3 台でおえかきリレーとみんなでぬりえを 1 回ずつ通し、線と塗りがこれまでどおり全員に出ること、盤面のふちから
  指をはみ出して描いた線がほかの人の画面でも切れないことを見る
