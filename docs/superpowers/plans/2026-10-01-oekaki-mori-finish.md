# おえかきのもりの仕上げ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** まちがい答え集・スタンプ・ヒントの時間・最後の 10 秒の音・お題 400 個と文字数の選択・残りの小さな点・ライセンス表記を入れる。

**Architecture:** ルール（`engine.ts`）はヒントを描く時間の割合で出し、お題とはやおしの候補を字数で絞る。審判（`referee.ts`）はスタンプの間隔を見て配る。親の画面の知らせを受けて状態を変える処理は `round.svelte.ts` の `Round` に出し、まちがい答え・スタンプ・最後の 10 秒の音をそこで扱う。画面は `Stamps.svelte` と結果・保存する 1 枚にまちがい答えを足す。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、vitest（node の unit と happy-dom の dom）。

**Spec:** `docs/superpowers/specs/2026-10-01-oekaki-mori-finish-design.md`

## Global Constraints

- コンポーネントは 200 行未満（`architecture/component-size`、抑制コメントは使わない）。
- コメントは非自明な WHY だけ。変更履歴やタスク番号は書かない。
- 絵文字は使わない。アイコンは `src/lib/icons.ts` と `Icon.svelte`。
- localStorage の保存名は `asobibako:` で始め、好みだけの保存名は `src/lib/backup.ts` の `NOT_RECORDS` に入れる。
- お題はひらがなと「ー」だけで書く。
- `pnpm verify` が通ること。
- commit の末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

- 字数で絞った候補が少ないと、はやおし検定の候補が 4 つに満たない。Task 1 のテストで、足りないときは全体から足して 4 つにすることを固める。
- スタンプを連打されると全員の画面が埋まる。Task 1 のテストで 1.5 秒の間隔、Task 3 のテストで同時に 6 つまでを固める。
- 番が変わったあとに前の番の外れた答えが入り、次の絵のまちがい答えに混ざる。Task 3 のテストで、番が変わると空になることを固める。
- 戻った子の結果の画面で、まちがい答えが消えている。Task 3 のテストで、`drawing` の知らせのまちがい答えがそのまま入ることを固める。
- 「みじかめ」でヒントが早すぎる・出ない。Task 1 のテストで、みじかめは残り 30 秒で 1 文字目を出すことを固める。

---

### Task 1: ヒントの割合・字数の絞り込み・スタンプの間隔

**Files:**

- Modify: `src/lib/games/oekaki-mori/engine.ts`、`referee.ts`、`prefs.ts`、`src/lib/backup.ts`
- Test: `engine.test.ts`、`referee.test.ts`、`prefs.test.ts`、`src/lib/backup.test.ts`

**Interfaces:**

- Produces: `type Chars = 3 | 4 | null`、`fit(words, chars): readonly string[]`、`create(players, rand, words, mode, length, chars = null)`、`Quiz.chars`、`Referee(party, now?)`、`Referee.start(mode, length, chars)`、知らせ `{ t: 'stamp', seat, id }`。`prefs.ts` の `CHARS_KEY`、`readChars(): Chars`、`saveChars(chars)`。

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts` の import に `fit` を足し、末尾に足す。

```ts
describe('chars', () => {
  it('3 もじまでなら、お題に 4 文字以上の言葉を出さない', () => {
    const s = create([1, 2], Math.random, WORDS, 'egokoro', 'long', 3);
    for (let i = 0; i < 6; i++) {
      expect([...s.word].length).toBeLessThanOrEqual(3);
      go(s);
      run(s, LENGTHS.long.draw.egokoro + REVEAL_S + 1);
      if (s.phase === 'done') break;
    }
  });

  it('はやおし検定の候補も字数で絞り、足りないときは全体から足して 4 つにする', () => {
    const words = ['ねこ', 'いぬ', 'らいおん', 'きりん', 'ぺんぎん'];
    const s = create([1, 2], fixed, words, 'hayaoshi', 'normal', 3);
    go(s);
    buzz(s, 2, fixed, words);
    expect(s.options).toHaveLength(4);
    expect(s.options).toContain(s.word);
  });

  it('絞ると空になるときは、絞らない', () => {
    expect(fit(['らいおん'], 3)).toEqual(['らいおん']);
    expect(fit(['ねこ', 'らいおん'], 3)).toEqual(['ねこ']);
    expect(fit(['ねこ', 'らいおん'], null)).toEqual(['ねこ', 'らいおん']);
  });
});

describe('hints by length', () => {
  it('みじかめは残り 30 秒で 1 文字目を見せる', () => {
    const s = create([1, 2], fixed, WORDS, 'egokoro', 'short');
    go(s);
    run(s, 60 - 30 - 0.5);
    expect(s.hints).toEqual([]);
    run(s, 1);
    expect(s.hints).toEqual([0]);
  });
});
```

`referee.test.ts` の `new Referee(party)` はそのまま通るように残し、末尾に足す。

```ts
it('スタンプは描く時間に当てる人のものだけを全員へ配り、同じ人の 1.5 秒以内の 2 つ目は配らない', () => {
  const { party, told, act } = fakeParty([1, 2, 3]);
  let now = 0;
  new Referee(party, () => now).start('egokoro');
  act({ t: 'stamp', id: 'like' }, 2);
  act({ t: 'start' }, 1);
  told.length = 0;
  act({ t: 'stamp', id: 'like' }, 2);
  now = 1000;
  act({ t: 'stamp', id: 'wow' }, 2);
  act({ t: 'stamp', id: 'wow' }, 1);
  now = 1600;
  act({ t: 'stamp', id: 'huh' }, 2);
  act({ t: 'stamp', id: 'nope' }, 3);
  const stamps = told.filter(([, m]) => m.t === 'stamp').map(([seat, m]) => [seat, m.seat, m.id]);
  expect(stamps).toEqual([
    [1, 2, 'like'],
    [2, 2, 'like'],
    [3, 2, 'like'],
    [1, 2, 'huh'],
    [2, 2, 'huh'],
    [3, 2, 'huh']
  ]);
});
```

`prefs.test.ts` に足す（import に `CHARS_KEY, readChars, saveChars`）。

```ts
describe('chars prefs', () => {
  beforeEach(() => store.clear());

  it('選んだ字数を覚え、知らない値や無いときは ぜんぶ', () => {
    expect(readChars()).toBeNull();
    saveChars(3);
    expect(store.get(CHARS_KEY)).toBe('3');
    expect(readChars()).toBe(3);
    saveChars(null);
    expect(readChars()).toBeNull();
    store.set(CHARS_KEY, '9');
    expect(readChars()).toBeNull();
  });
});
```

`backup.test.ts` の記録なしのテストに `localStorage.setItem('asobibako:oekaki-mori:chars', '3');` を足す。

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/engine.test.ts src/lib/games/oekaki-mori/referee.test.ts src/lib/games/oekaki-mori/prefs.test.ts src/lib/backup.test.ts`
Expected: FAIL（`fit` / `readChars` が無い、スタンプが配られない、みじかめのヒントが残り 45 秒で出る）。

- [ ] **Step 3: 実装する**

`engine.ts` の `HINTS` を次にする。

```ts
/** 描く時間に対するこの割合が残ったら 1 文字ずつ見せる（エゴコロクイズだけ）。ふつうの 90 秒では残り 45 秒と 20 秒 */
export const HINTS = [
  [1, 2],
  [2, 9]
] as const;
```

`tick` のヒントの 2 行を次にする（割り算を後にして、ふつうでぴったり 45 と 20 になるようにする）。

```ts
const draw = LENGTHS[s.length].draw[s.mode];
const at = ([n, d]: readonly [number, number]) => (draw * n) / d;
if (s.hints.length === 0 && s.left <= at(HINTS[0])) s.hints.push(0);
if (s.hints.length === 1 && s.left <= at(HINTS[1]) && n > 2) s.hints.push(1 + Math.floor(rand() * (n - 1)));
```

`Length` の型の下に足す。

```ts
/** お題の字数の上限。null は ぜんぶ。小さい字と「ー」も 1 字に数える */
export type Chars = 3 | 4 | null;

/** 字数で絞ったお題。絞ると 1 つも残らないときは絞らない */
export function fit(words: readonly string[], chars: Chars): readonly string[] {
  if (chars === null) return words;
  const kept = words.filter((w) => [...w].length <= chars);
  return kept.length ? kept : words;
}
```

`Quiz` に `chars: Chars;` を足し、`create` の引数の最後に `chars: Chars = null` を足して `chars,` を入れる。`pickWord` の最初の行を `const all = fit(words, s.chars);` と `let pool = all.filter((w) => !s.used.includes(w));` にし、`pool = [...words];` を `pool = [...all];` にする。`buzz` の候補を次にする。

```ts
// 字数で絞った中から選び、足りなければ全体から足す（候補が 4 つに満たないと、残った 1 つで答えが分かる）
const near = fit(words, s.chars).filter((w) => w !== s.word);
const far = words.filter((w) => w !== s.word && !near.includes(w));
const options = [s.word];
for (const pool of [near.slice(), far.slice()])
  while (options.length < 4 && pool.length) options.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
```

（今の `const pool = …` と `while` の 3 行をこれに替える。）

`referee.ts` は次のとおりにする。

- `constructor(party: Party, now: () => number = () => performance.now())` にし、`#now` に持つ。
- `#stamped = new Map<Seat, number>();` を足す。
- `start(mode: Mode, length: Length = 'normal', chars: Chars = null)` にし、`create(..., mode, length, chars)` を呼ぶ。
- `#act` の `typing` の行の次に `else if (message.t === 'stamp') return this.#stamp(s, from, String(message.id));` を足す。
- `#typing` の次に足す。

```ts
  /** 当てる人のスタンプを全員へ配る。小さい子の連打で画面が埋まらないよう、1 人 1.5 秒に 1 つまで */
  #stamp(s: Quiz, from: Seat, id: string) {
    if (s.phase !== 'draw' || from === drawer(s)) return;
    const now = this.#now();
    if (now - (this.#stamped.get(from) ?? -Infinity) < STAMP_MS) return;
    this.#stamped.set(from, now);
    this.#party.tell('all', { t: 'stamp', seat: from, id });
  }
```

ファイルの頭に `const STAMP_MS = 1500;` を置く。

`prefs.ts` に足す。

```ts
export const CHARS_KEY = 'asobibako:oekaki-mori:chars';

/** 前に選んだお題の字数の上限。読めないときは ぜんぶ */
export function readChars(): Chars {
  try {
    const v = localStorage.getItem(CHARS_KEY);
    return v === '3' ? 3 : v === '4' ? 4 : null;
  } catch {
    return null;
  }
}

export function saveChars(chars: Chars): void {
  try {
    localStorage.setItem(CHARS_KEY, String(chars ?? 'all'));
  } catch {
    // 覚えられなくても、選んだ字数で遊べる
  }
}
```

（`import type { Chars, Length } from './engine';`）`backup.ts` の `NOT_RECORDS` に `'asobibako:oekaki-mori:chars'` を足す。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori src/lib/backup.test.ts && pnpm check`
Expected: PASS。既存のヒントのテスト（ふつうで残り 45 秒と 20 秒）も通る。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori src/lib/backup.ts src/lib/backup.test.ts
git commit -m "Show hints by the share of drawing time, filter prompts by length, and relay stamps at most every 1.5 seconds"
```

---

### Task 2: お題を 400 個ほどにする

**Files:**

- Modify: `src/lib/games/oekaki-mori/words.ts`、`words.test.ts`

**Interfaces:**

- Produces: `WORDS`（380 個以上、3 字以下 200 個以上）。

- [ ] **Step 1: 失敗するテストを書く**

`words.test.ts` の「150 語以上ある」を次の 2 つに替える。

```ts
it('380 語以上あり、3 もじまでで 200 語以上残る', () => {
  expect(WORDS.length).toBeGreaterThanOrEqual(380);
  expect(WORDS.filter((w) => [...w].length <= 3).length).toBeGreaterThanOrEqual(200);
});

it('4 もじまでで 300 語以上残る', () => {
  expect(WORDS.filter((w) => [...w].length <= 4).length).toBeGreaterThanOrEqual(300);
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/words.test.ts`
Expected: FAIL（今は 160 語）。

- [ ] **Step 3: お題を足す**

`words.ts` の今のカテゴリのコメント（どうぶつ・むし、たべもの…）ごとに、子どもが知っていて 90 秒で絵にできる言葉を足す。ひらがなと「ー」で書き（カタカナの言葉も「ぺんぎん」「へりこぷたー」のようにひらがなで）、今ある言葉と重ねない。目安は、2〜3 字を 200 個以上、4 字を 100 個ほど、5 字以上を 80 個ほど。抽象的な言葉（ゆめ・あい など）、絵で区別しにくい言葉、人を傷つけうる言葉は入れない。足したあとに字数ごとの数を数える。

```bash
node -e "const s=require('fs').readFileSync('src/lib/games/oekaki-mori/words.ts','utf8');const w=[...s.matchAll(/'([ぁ-んー]+)'/g)].map(m=>m[1]);const c={};for(const x of w){const n=[...x].length;c[n]=(c[n]||0)+1}console.log(w.length,c)"
```

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/words.test.ts src/lib/games/oekaki-mori/engine.test.ts`
Expected: PASS（重なりなし、ひらがなと「ー」だけ）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori/words.ts src/lib/games/oekaki-mori/words.test.ts
git commit -m "Grow the prompt list to about 400 child-friendly words, weighted toward short ones"
```

---

### Task 3: 知らせを受ける処理を Round に出し、まちがい答え・スタンプ・最後の 10 秒の音を扱う

**Files:**

- Create: `src/lib/games/oekaki-mori/round.svelte.ts`、`round.svelte.test.ts`、`stamps.ts`
- Modify: `OekakiMori.svelte`、`Result.svelte`（`Drawing` に `misses`）、`sounds.ts`

**Interfaces:**

- Consumes: Task 1 の `{ t: 'stamp', seat, id }`。
- Produces: `Miss = { by: Seat; text: string }`、`Drawing.misses: Miss[]`、`STAMPS`（`{ id: 'like' | 'wow' | 'huh' | 'idea'; icon: IconName; name: string }[]`）、`class Round`（`screen`・`view`・`strokes`・`bubbles`・`gallery`・`typing`・`close`・`stamps: { key: number; seat: Seat; id: string }[]`、`reset()`・`receive(m)`・`ink(i)`）、`sounds.tick(high: boolean)`。

- [ ] **Step 1: 失敗するテストを書く**

`round.svelte.test.ts`（dom）を作る。

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { View } from './engine';
import { Round } from './round.svelte';

const sound = vi.hoisted(() => ({
  tick: vi.fn(),
  turn: vi.fn(),
  right: vi.fn(),
  wrong: vi.fn(),
  close: vi.fn(),
  buzz: vi.fn()
}));
vi.mock('./sounds', () => ({ sounds: sound }));

const view = (over: Partial<View>): View => ({
  mode: 'egokoro',
  phase: 'draw',
  turn: 0,
  turns: 4,
  drawer: 1,
  players: [1, 2, 3],
  scores: { 1: 0, 2: 0, 3: 0 },
  left: 80,
  word: 'ねこ',
  mask: '○○',
  solved: [],
  buzzer: null,
  answerLeft: 0,
  options: null,
  out: [],
  ...over
});

describe('Round', () => {
  afterEach(() => vi.clearAllMocks());

  it('外れた答えをその番の絵に付け、じかんぎれは入れず、番が変わると空にする', () => {
    const r = new Round();
    r.receive({ t: 'view', view: view({}) });
    r.receive({ t: 'bubble', seat: 2, text: 'たぬき' });
    r.receive({ t: 'bubble', seat: 3, text: 'じかんぎれ', note: true });
    r.receive({ t: 'view', view: view({ phase: 'reveal' }) });
    expect(r.gallery[0].misses).toEqual([{ by: 2, text: 'たぬき' }]);
    r.receive({ t: 'view', view: view({ turn: 1 }) });
    r.receive({ t: 'view', view: view({ turn: 1, phase: 'reveal' }) });
    expect(r.gallery[1].misses).toEqual([]);
  });

  it('戻った子に送られた絵のまちがい答えをそのまま残す', () => {
    const r = new Round();
    r.receive({ t: 'drawing', drawing: { word: 'ねこ', by: 1, strokes: [], misses: [{ by: 2, text: 'いぬ' }] } });
    expect(r.gallery[0].misses).toEqual([{ by: 2, text: 'いぬ' }]);
  });

  it('スタンプは同時に 6 つまでにし、古いものから消す', () => {
    const r = new Round();
    for (let i = 0; i < 8; i++) r.receive({ t: 'stamp', seat: 2, id: 'like' });
    expect(r.stamps).toHaveLength(6);
    expect(r.stamps[0].key).toBe(3);
  });

  it('描く時間の残り 10 秒からは 1 秒ごとに音を鳴らし、3 秒からは高い音にする', () => {
    const r = new Round();
    for (const left of [12, 11, 10, 10, 9, 3]) r.receive({ t: 'view', view: view({ left }) });
    expect(sound.tick.mock.calls).toEqual([[false], [false], [true]]);
  });
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/round.svelte.test.ts`
Expected: FAIL（`./round.svelte` が無い）。

- [ ] **Step 3: 実装する**

`stamps.ts` を作る。

```ts
import type { IconName } from '$lib/icons';

/** 当てる人が描く人へ送るスタンプ。字を打てない小さい子も参加できる */
export const STAMPS = [
  { id: 'like', icon: 'heart', name: 'いいね' },
  { id: 'wow', icon: 'star', name: 'すごい' },
  { id: 'huh', icon: 'help', name: 'わかんない' },
  { id: 'idea', icon: 'bolt', name: 'ひらめいた' }
] as const satisfies readonly { id: string; icon: IconName; name: string }[];

export const stampOf = (id: string) => STAMPS.find((s) => s.id === id);
```

`Result.svelte` の `Drawing` に `misses: Miss[];` を足し、`Miss` を同じ module script に `export interface Miss { by: Seat; text: string }` として置く。

`sounds.ts` に足す。

```ts
  tick: (high: boolean) => tone(high ? 1319 : 988, 60, 'square', 0.05),
```

`round.svelte.ts` を作る。`OekakiMori.svelte` の状態（`screen`・`view`・`strokes`・`bubbles`・`gallery`・`typing`・`close`）と `receive`・`show`・`ink` の中身をここへ移し、次を足す。

```ts
import type { Message } from '$lib/net/link';
import type { Seat } from '$lib/net/party.svelte';
import type { Bubble } from './Bubbles.svelte';
import type { View } from './engine';
import type { Drawing, Miss } from './Result.svelte';
import { sounds } from './sounds';
import { apply, type Ink, type Stroke } from './strokes';
import type { Screen } from './sync';
import { typed } from './typing';

/** 同時に浮かべるスタンプの数。あふれたら古いものから消す */
const MAX_STAMPS = 6;
const STAMP_MS = 2000;
/** 描く時間の残りがこれ以下になったら、1 秒ごとに音を鳴らす */
const TICK_FROM = 10;
const HIGH_FROM = 3;

/** 親から届いた知らせで変わる、遊んでいるあいだの画面の状態 */
export class Round {
  screen = $state<Screen>('lobby');
  view = $state.raw<View | null>(null);
  strokes = $state.raw<Stroke[]>([]);
  bubbles = $state.raw<Bubble[]>([]);
  gallery = $state.raw<Drawing[]>([]);
  /** 当てる人ごとの打っている字。描く人にはそのまま、ほかの人には字数だけ届く */
  typing = $state.raw<Record<number, string>>({});
  stamps = $state.raw<{ key: number; seat: Seat; id: string }[]>([]);
  close = $state(false);
  /** いまの番に外れた答え。答えを見せるときに絵と一緒に残す */
  #misses: Miss[] = [];
  #key = 0;

  /** つなぎ直すとき。前のつながりの見え方が残ると、番が変わったとみなして送り直された絵を消してしまう */
  reset() {
    this.view = null;
    this.strokes = [];
    this.gallery = [];
    this.typing = {};
    this.bubbles = [];
    this.stamps = [];
    this.#misses = [];
  }

  receive(m: Message) {
    // OekakiMori.svelte の receive の分岐をそのまま移し、bubble の分岐で note でなければ
    // this.#misses = [...this.#misses, { by: m.seat as Seat, text: String(m.text) }] を足す。
    // stamp を足す:
    if (m.t === 'stamp') {
      const stamp = { key: ++this.#key, seat: m.seat as Seat, id: String(m.id) };
      this.stamps = [...this.stamps, stamp].slice(-MAX_STAMPS);
      setTimeout(() => (this.stamps = this.stamps.filter((s) => s !== stamp)), STAMP_MS);
    }
  }

  ink(i: Ink) {
    this.strokes = apply(this.strokes, i);
  }

  #show(next: View) {
    const prev = this.view;
    if (prev && next.turn !== prev.turn) {
      this.strokes = [];
      this.typing = {};
      this.#misses = [];
      sounds.turn();
    }
    if (prev?.phase === 'draw' && next.phase === 'reveal')
      this.gallery = [
        ...this.gallery,
        { word: next.word ?? '', by: next.drawer, strokes: this.strokes, misses: this.#misses }
      ];
    if (next.phase === 'draw' && next.left <= TICK_FROM && next.left > 0 && next.left !== prev?.left)
      sounds.tick(next.left <= HIGH_FROM);
    if (prev && next.solved.length > prev.solved.length) sounds.right();
    if (prev && next.buzzer !== null && next.buzzer !== prev.buzzer) sounds.buzz();
    this.view = next;
    this.screen = next.phase === 'done' ? 'result' : 'play';
  }
}
```

（`receive` の本体は、上のコメントのとおり今の `OekakiMori.svelte` の `receive` を `this.` 付きで写し、`view` の分岐を `this.#show(...)` にする。`stamp` の分岐はその中に入れる。テストの `[12, 11, 10, 10, 9, 3]` で鳴るのは 10・9・3 の 3 回になる。）

`OekakiMori.svelte` は `const round = new Round();` を置き、状態の参照を `round.view` などに替える。`joined()` の先頭の消す処理は `round.reset();`、`next.onTell(receive)` は `next.onTell((m) => round.receive(m))`、`ink(i)` は `round.ink(i); party?.act({ t: 'ink', ink: i });`、親の `catchUp(screen, strokes, gallery)` は `catchUp(round.screen, round.strokes, round.gallery)` にする。`screen` を `lobby` や `mode` にしている所（lost の effect、`toMode` など）は `round.screen = …` にする。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori && pnpm check && pnpm lint`
Expected: PASS。`OekakiMori.svelte` が 200 行未満。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori
git commit -m "Move round state into Round, keep each drawing's wrong answers, float stamps, and tick through the last ten seconds"
```

---

### Task 4: スタンプのボタン・字数の列・まちがい答えを画面と保存する 1 枚に出す

**Files:**

- Create: `src/lib/games/oekaki-mori/Stamps.svelte`
- Modify: `Play.svelte`、`OekakiMori.svelte`、`ModeSelect.svelte`、`Result.svelte`、`album.ts`
- Test: `album.test.ts`、`Stamps.svelte.test.ts`（新）

**Interfaces:**

- Consumes: Task 1 の `Chars`・`readChars`・`saveChars`・`Referee.start(mode, length, chars)`、Task 3 の `Round.stamps`・`STAMPS`・`stampOf`・`Drawing.misses`。
- Produces: `Stamps.svelte`（props `{ stamps; looks; canSend: boolean; onsend: (id: string) => void }`）、`layout(n, lines = 0)`（`lines` は絵の下のまちがい答えの行数）。

- [ ] **Step 1: 失敗するテストを書く**

`album.test.ts` に足す。

```ts
it('まちがい答えの行があっても、絵とまちがい答えが重ならない', () => {
  const plain = layout(4);
  const tall = layout(4, 3);
  expect(tall.height).toBeGreaterThan(plain.height);
  expect(tall.cells[2].y - tall.cells[0].y).toBeGreaterThan(plain.cells[2].y - plain.cells[0].y);
});
```

`Stamps.svelte.test.ts` を作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Stamps from './Stamps.svelte';

describe('Stamps', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('送れるときだけボタンを出し、押すとそのスタンプを送る', () => {
    const onsend = vi.fn();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Stamps, { target, props: { stamps: [], looks: {}, canSend: true, onsend } });
    flushSync();
    target.querySelector<HTMLButtonElement>('button[aria-label="いいね"]')!.click();
    expect(onsend).toHaveBeenCalledWith('like');
    unmount(app);
    const app2 = mount(Stamps, { target, props: { stamps: [], looks: {}, canSend: false, onsend } });
    flushSync();
    expect(target.querySelector('button[aria-label="いいね"]')).toBeNull();
    unmount(app2);
  });
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/album.test.ts src/lib/games/oekaki-mori/Stamps.svelte.test.ts`
Expected: FAIL（`layout` が 2 つ目の引数を使わない、`Stamps.svelte` が無い）。

- [ ] **Step 3: 実装する**

`album.ts` の `layout` を `layout(n: number, lines = 0)` にし、絵の下の高さを `CAPTION + lines * MISS_LINE`（`const MISS_LINE = 40;`）にする。`album()` は `const lines = Math.min(3, Math.max(0, ...gallery.map((d) => d.misses.length)));` で `layout(gallery.length, lines)` を呼び、お題の `fillText` に最大幅 `size - 64` を渡す。お題の下に、最初の 3 つのまちがい答えを `` `${who(m.by, looks)}「${m.text}」` ``（`import { who } from './looks';`）で 1 行ずつ、`500 28px` の字、最大幅 `size` で書く。

`Stamps.svelte` を作る。

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Seat } from '$lib/net/party.svelte';
  import Face from './Face.svelte';
  import { STAMPS, stampOf } from './stamps';

  let {
    stamps,
    looks = {},
    canSend,
    onsend
  }: {
    stamps: { key: number; seat: Seat; id: string }[];
    looks?: Record<number, string>;
    canSend: boolean;
    onsend: (id: string) => void;
  } = $props();
</script>

<ul class="floating" aria-live="polite">
  {#each stamps as s (s.key)}
    {@const stamp = stampOf(s.id)}
    {#if stamp}
      <li style:left="{20 + ((s.key * 37) % 60)}%">
        <Face seat={s.seat} look={looks[s.seat]} size="28px" />
        <Icon name={stamp.icon} size="44px" />
      </li>
    {/if}
  {/each}
</ul>
{#if canSend}
  <div class="send">
    {#each STAMPS as stamp (stamp.id)}
      <button class="round" aria-label={stamp.name} onclick={() => onsend(stamp.id)}>
        <Icon name={stamp.icon} size="26px" />
      </button>
    {/each}
  </div>
{/if}

<style>
  .floating {
    position: absolute;
    inset: 0;
    list-style: none;
    pointer-events: none;
    overflow: hidden;
  }

  .floating li {
    position: absolute;
    bottom: 8%;
    display: flex;
    align-items: center;
    gap: 4px;
    animation: rise 2s ease-out forwards;
  }

  @keyframes rise {
    from {
      translate: 0 0;
      opacity: 1;
    }

    to {
      translate: 0 -40cqh;
      opacity: 0;
    }
  }

  .send {
    position: absolute;
    right: 12px;
    bottom: 12px;
    display: grid;
    gap: 6px;
  }

  .send .round {
    width: 44px;
    height: 44px;
  }

  @media (prefers-reduced-motion: reduce) {
    .floating li {
      animation: none;
    }
  }
</style>
```

`Play.svelte` は props に `stamps` と `onstamp: (id: string) => void` を足し、`.middle` の中の `<Bubbles … />` の次に置く。

```svelte
<Stamps {stamps} {looks} canSend={!drawing && view.phase === 'draw'} onsend={onstamp} />
```

`OekakiMori.svelte` の `<Play … />` に `stamps={round.stamps} onstamp={(id) => party?.act({ t: 'stamp', id })}` を足す。

`ModeSelect.svelte` は `chars = $bindable<Chars>(null)` を props に足し、長さの列の下に字数の列を置く（長さの列と同じ書き方、`aria-label="もじすう"`、`[[3, '3 もじまで'], [4, '4 もじまで'], [null, 'ぜんぶ']]`）。`OekakiMori.svelte` は `let chars = $state<Chars>(readChars());` を足し、`<ModeSelect … bind:chars />`、`begin` で `saveChars(chars);` と `referee.start(mode, length, chars);` にする。

`Result.svelte` の絵の下に、まちがい答えを並べる。

```svelte
{#if d.misses.length}
  <ul class="misses">
    {#each d.misses as m, i (i)}<li>{who(m.by, looks)}「{m.text}」</li>{/each}
  </ul>
{/if}
```

（`import { who } from './looks';`、style に `.misses { list-style: none; font-size: 12px; text-align: center; }`。Result が 200 行を超えるなら絵 1 枚ぶんを `GalleryItem.svelte` に出す。）

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori && pnpm check && pnpm lint && pnpm vitals --diff`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori
git commit -m "Add stamp buttons for guessers, a prompt-length picker, and wrong answers on the results screen and saved picture"
```

---

### Task 5: 残りの小さな点とライセンス表記

**Files:**

- Modify: `src/lib/games/oekaki-mori/Invite.svelte`、`Lobby.svelte`
- Modify: `src/routes/about/+page.svelte`
- Create: `static/licenses.txt`
- Test: `src/routes/about/page.svelte.test.ts`

**Interfaces:**

- Produces: `/about` の「つかわせて もらったもの」のカードと `licenses.txt` へのリンク。

- [ ] **Step 1: 失敗するテストを書く**

`page.svelte.test.ts` に足す（既存の mount の書き方に合わせる）。

```ts
it('つかわせて もらったものと、ライセンスの全文へのリンクを出す', () => {
  // 既存のテストと同じく mount したあと
  expect(target.textContent).toContain('つかわせて もらったもの');
  expect(target.textContent).toContain('Informative Drawings');
  expect(target.querySelector('a[href$="licenses.txt"]')).not.toBeNull();
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/routes/about`
Expected: FAIL。

- [ ] **Step 3: 実装する**

`Invite.svelte` は `let tries = $state(0);` を足し、`<Handshake …>` を `{#key tries}…{/key}` で包み、版ちがいのとき `failed = MISMATCH; tries++;` にする（使い終わった QR のかわりに新しい QR を出す）。

`Lobby.svelte` の顔ぶれは、来ている人の `li` から外側の輪と色を消す（`.face.here { border: 0; background: none; }` を足し、来ている人の `li` に `class:here={here}` を付ける）。

`static/licenses.txt` を作る。並びは onnxruntime-web・Informative Drawings・three.js・jsQR・uqr。それぞれ見出しの行（名前・作者・ライセンス・入手元の URL）のあとにライセンスの全文を置く。全文は `node_modules/three/LICENSE`、`node_modules/jsqr/LICENSE`、`node_modules/uqr/LICENSE` を写す。onnxruntime-web は `https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE`、Informative Drawings は `https://raw.githubusercontent.com/carolineec/informative-drawings/main/LICENSE` を取って写す。

`/about` の最後のカードの次に足す。

```svelte
<section class="card">
  <h2>つかわせて もらったもの</h2>
  <ul class="credits">
    <li>Informative Drawings（Caroline Chan ほか、MIT）… ぬりえの AI の線画</li>
    <li>onnxruntime-web（Microsoft、MIT）… AI を動かす</li>
    <li>three.js（three.js authors、MIT）… 3D の画面</li>
    <li>jsQR（Cosmo Wolfe、Apache-2.0）… QR を読む</li>
    <li>uqr（Anthony Fu、MIT）… QR を作る</li>
  </ul>
  <a href={asset('/licenses.txt')}>ライセンスの全文</a>
</section>
```

（`import { asset, resolve } from '$app/paths';`。作者の名前は各 `LICENSE` の著作権表示に合わせて直す。）

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/routes/about src/lib/games/oekaki-mori && pnpm verify`
Expected: PASS（`licenses.txt` は Service Worker の `files` に入り、GitHub Pages が配信する）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori src/routes/about static/licenses.txt
git commit -m "Show a fresh QR after a mismatch, drop the double ring in the lobby, and credit the libraries and model in About"
```

---

### Task 6: 通しで確かめて出す

**Files:**

- Scratch only（`$SCRATCHPAD/faces.mjs` を直して使う）
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md を書きかえる**

おえかきのもりの段落の最後に「当てる人は描く時間に盤面の右下からスタンプ（`stamps.ts`。いいね・すごい・わかんない・ひらめいた）を送れ、審判が 1 人 1.5 秒に 1 つまで全員へ配る。外れた答えは番ごとに絵と一緒に残し（`round.svelte.ts` の `Round`。親から届いた知らせで変わる画面の状態を持つ）、結果の画面と保存する 1 枚に出す。ヒントは描く時間の 1/2 と 2/9 が残ったときに出し、残り 10 秒からは 1 秒ごとに音を鳴らす。お題（`words.ts`、400 個ほど）は親が遊び方選びで字数の上限（3 もじまで・4 もじまで・ぜんぶ、`asobibako:oekaki-mori:chars`）を選べ、はやおし検定の候補も同じ範囲から選ぶ。」を足す。概要の段落の後ろか規約の段落に「使わせてもらったものとライセンスは `/about` の「つかわせて もらったもの」と `static/licenses.txt`。依存を足したら両方に足す」を足す。

- [ ] **Step 2: 3 ページの通し**

`pnpm dev` を background で立て、`faces.mjs` を直す。「3 もじまで」とエゴコロクイズで始め、次を撮る。

- 当てる人がスタンプを押したときの、描く人の盤面（スタンプが浮かぶ）。
- 当てる人が外れの答えを送ってから当て、3 番が終わった結果の画面（絵の下にまちがい答え）と、保存する 1 枚。
- 3 番のお題がすべて 3 字以下であること（ログに出す）。

Expected: 3 つとも期待どおり。

- [ ] **Step 3: 見直しと出す**

superpowers:executing-plans の Final Review を通し、Critical と Important を直してから、main を取り込み、`pnpm verify` を通して `git push origin HEAD:main` と `git push origin HEAD` をする。`gh run watch` で deploy と CI の成功を確かめる。開発サーバーと playwright を止める。
