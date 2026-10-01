# おえかきリレー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** おえかきのもりに、人数ぶんのリレーを同時に回して最後にめくって笑う遊び方「おえかきリレー」を足す。

**Architecture:** ルールは `relay.ts`（DOM を使わない）、親の審判は `relay-referee.ts`（知らせのやりとりと時間）、画面は `Relay.svelte`（知らせを受ける入口）・`RelayPlay.svelte`（描く・当てる・待つ）・`RelayReveal.svelte`（ふりかえり）、保存する 1 枚は `relay-album.ts`。`OekakiMori.svelte` は遊び方選びからリレーを始め、`sync.ts` の画面に `relay` を足す。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、vitest。

**Spec:** `docs/superpowers/specs/2026-10-01-oekaki-relay-design.md`

## Global Constraints

- コンポーネントは 200 行未満（`architecture/component-size`、抑制コメントは使わない）。
- コメントは非自明な WHY だけ。変更履歴やタスク番号は書かない。
- 絵文字は使わない。画面の文字はひらがな中心。
- DataChannel の 1 回の知らせに絵をまとめて載せない（絵は 1 枚ずつ）。
- 知らせの形を足すので、`src/lib/net/party.svelte.ts` の `PROTOCOL` を 5 に上げる。
- `pnpm verify` が通ること。
- commit の末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

- 受け持つ人がそのだんで何もしないまま時間が切れると、次の人が描く言葉が空になる。Task 1 のテストで、打ちかけの字を使い、無ければ新しいお題を配ることを固める。
- 描くだんの途中で受け持つ人が抜けると、そのリレーだけ止まって全員が待ち続ける。Task 1 のテストで、抜けたらそのこまを埋めて進めることを固める。
- ふりかえりの途中で戻った子の画面に、めくり終えたこまが無い。Task 2 のテストで、戻った子にいまのリレーのめくり終えたこまを送り直すことを固める。
- 親以外が「つぎ」を送ると、ふりかえりが勝手に進む。Task 2 のテストで、親（1 番）の `relayNext` だけを受けることを固める。
- 描いた線がほかのリレーのこまに入る。Task 1 のテストで、線が受け持ったリレーのこまにだけたまることを固める。

---

### Task 1: ルール（relay.ts）

**Files:**

- Create: `src/lib/games/oekaki-mori/relay.ts`、`relay.test.ts`

**Interfaces:**

- Consumes: `engine.ts` の `fit`、`LENGTHS`、`Chars`、`Length`。`strokes.ts` の `apply`、`Ink`、`Stroke`。
- Produces:
  - `STEPS: Record<Length, number>`（4 / 6 / 8）、`GUESS_S = 30`、`UNKNOWN = '（わからなかった）'`
  - `type Entry = { kind: 'prompt'; text: string } | { kind: 'draw'; by: Seat; strokes: Stroke[] } | { kind: 'guess'; by: Seat; text: string | null }`
  - `interface Chain { start: string; entries: Entry[] }`
  - `interface Relay { players: Seat[]; present: Seat[]; steps: number; step: number; left: number; draw: number; phase: 'play' | 'reveal' | 'done'; chains: Chain[]; done: Seat[]; used: string[]; chars: Chars; page: { chain: number; index: number } }`
  - `type Task = { kind: 'draw'; word: string } | { kind: 'guess'; strokes: Stroke[] } | { kind: 'wait' }`
  - `createRelay(players, rand, words, length, chars)`、`assignee(s, chain, step)`、`chainOf(s, seat)`、`taskOf(s, seat)`、`addInk(s, seat, ink)`、`finish(s, seat, text?)`、`tick(s, dt, rand, words, typed)`、`leave(s, seat)`、`rejoin(s, seat)`、`next(s)`、`pageOf(s)`（いまのページの `{ chain, index, entry, last }`。index 0 は最初のお題の `prompt`）

- [ ] **Step 1: 失敗するテストを書く**

`relay.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import {
  addInk,
  assignee,
  createRelay,
  finish,
  GUESS_S,
  leave,
  next,
  pageOf,
  rejoin,
  taskOf,
  tick,
  UNKNOWN,
  type Relay
} from './relay';

const WORDS = ['いぬ', 'ねこ', 'くま', 'うし', 'さる', 'たこ', 'かに', 'いか'];
const fixed = () => 0;
const relay = (players: Seat[] = [1, 2, 3]) => createRelay(players, fixed, WORDS, 'short', null);
/** 全員を「できた」にして、だんを進める */
const allDone = (s: Relay, text = 'くま') => {
  for (const seat of s.present) finish(s, seat, text);
  tick(s, 0, fixed, WORDS, {});
};

describe('relay', () => {
  it('人数ぶんのリレーを、ちがうお題で始める', () => {
    const s = relay();
    expect(s.chains).toHaveLength(3);
    expect(new Set(s.chains.map((c) => c.start)).size).toBe(3);
    expect(s.steps).toBe(4);
  });

  it('どのだんも、1 人がちょうど 1 本のリレーを受け持つ', () => {
    for (const players of [
      [1, 2],
      [1, 2, 3]
    ] as Seat[][]) {
      const s = relay(players);
      for (let step = 0; step < s.steps; step++) {
        const seats = s.chains.map((_, c) => assignee(s, c, step));
        expect(new Set(seats).size).toBe(players.length);
      }
    }
  });

  it('描くだんは言葉、当てるだんは前の絵を受け持つ人に渡す', () => {
    const s = relay([1, 2]);
    expect(taskOf(s, 1)).toEqual({ kind: 'draw', word: s.chains[0].start });
    addInk(s, 1, { k: 'start', color: '#000', size: 0.01, x: 0.1, y: 0.1 });
    allDone(s);
    const task = taskOf(s, 2);
    expect(task.kind).toBe('guess');
    expect(task.kind === 'guess' && task.strokes).toHaveLength(1);
  });

  it('線は受け持ったリレーのこまにだけたまる', () => {
    const s = relay([1, 2]);
    addInk(s, 2, { k: 'start', color: '#000', size: 0.01, x: 0.5, y: 0.5 });
    const drawn = s.chains.map((c) => (c.entries[0].kind === 'draw' ? c.entries[0].strokes.length : -1));
    expect(drawn).toEqual([0, 1]);
  });

  it('全員がそろうか時間が切れたら次のだんへ進み、最後のあとはふりかえりに入る', () => {
    const s = relay([1, 2]);
    finish(s, 1);
    tick(s, 0, fixed, WORDS, {});
    expect(s.step).toBe(0);
    finish(s, 2);
    tick(s, 0, fixed, WORDS, {});
    expect(s.step).toBe(1);
    tick(s, GUESS_S + 1, fixed, WORDS, {});
    expect(s.step).toBe(2);
    allDone(s);
    allDone(s);
    expect(s.phase).toBe('reveal');
  });

  it('当てる時間が切れたら打ちかけの字を答えにし、何も無ければわからなかったにして新しいお題を配る', () => {
    const s = relay([1, 2]);
    allDone(s);
    tick(s, GUESS_S + 1, fixed, WORDS, { 2: 'りん' });
    const guesses = s.chains.map((c) => c.entries[1]);
    expect(guesses[0]).toEqual({ kind: 'guess', by: 2, text: 'りん' });
    expect(guesses[1]).toEqual({ kind: 'guess', by: 1, text: null });
    expect(taskOf(s, 1)).toEqual({ kind: 'draw', word: 'りん' });
    const fresh = taskOf(s, 2);
    expect(fresh.kind === 'draw' && WORDS.includes(fresh.word)).toBe(true);
    expect(s.chains[1].entries[2].kind).toBe('prompt');
    expect(UNKNOWN).toContain('わからなかった');
  });

  it('抜けた人のこまは埋めて進め、1 人になったらふりかえりに入る', () => {
    const s = relay();
    finish(s, 1);
    finish(s, 2);
    leave(s, 3);
    tick(s, 0, fixed, WORDS, {});
    expect(s.step).toBe(1);
    leave(s, 2);
    expect(s.phase).toBe('reveal');
  });

  it('戻った人は次のだんから受け持ち、そのだんでは待つ', () => {
    const s = relay();
    leave(s, 3);
    rejoin(s, 3);
    expect(taskOf(s, 3)).toEqual({ kind: 'wait' });
    finish(s, 1);
    finish(s, 2);
    tick(s, 0, fixed, WORDS, {});
    expect(taskOf(s, 3).kind).toBe('guess');
  });

  it('ふりかえりは最初のお題からこまを順にめくり、全部のリレーのあとに done になる', () => {
    const s = relay([1, 2]);
    for (let i = 0; i < s.steps; i++) allDone(s);
    expect(pageOf(s)).toEqual({ chain: 0, index: 0, entry: { kind: 'prompt', text: s.chains[0].start }, last: false });
    for (let i = 0; i < 4; i++) next(s);
    expect(pageOf(s)?.last).toBe(true);
    next(s);
    expect(pageOf(s)?.chain).toBe(1);
    for (let i = 0; i < 5; i++) next(s);
    expect(s.phase).toBe('done');
  });
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/relay.test.ts`
Expected: FAIL（`./relay` が無い）。

- [ ] **Step 3: 実装する**

`relay.ts` を作る。

```ts
import type { Seat } from '$lib/net/party.svelte';
import { fit, LENGTHS, type Chars, type Length } from './engine';
import { apply, type Ink, type Stroke } from './strokes';

/** だんの数。偶数のだんは描く、奇数のだんは当てるので、最後は必ず当てる */
export const STEPS: Record<Length, number> = { short: 4, normal: 6, long: 8 };
export const GUESS_S = 30;
export const UNKNOWN = '（わからなかった）';

export type Entry =
  | { kind: 'prompt'; text: string }
  | { kind: 'draw'; by: Seat; strokes: Stroke[] }
  | { kind: 'guess'; by: Seat; text: string | null };

export interface Chain {
  start: string;
  entries: Entry[];
}

export interface Relay {
  /** 始めたときの並び。受け持ちはこの並びで回す */
  players: Seat[];
  /** いまつながっている人 */
  present: Seat[];
  steps: number;
  step: number;
  left: number;
  /** 描くだんの秒数 */
  draw: number;
  phase: 'play' | 'reveal' | 'done';
  chains: Chain[];
  /** いまのだんのこまを終えた人 */
  done: Seat[];
  used: string[];
  /** お題の字数の上限。最初のお題と、わからなかったあとに配り直すお題に効く */
  chars: Chars;
  page: { chain: number; index: number };
}

export type Task = { kind: 'draw'; word: string } | { kind: 'guess'; strokes: Stroke[] } | { kind: 'wait' };

const drawing = (step: number) => step % 2 === 0;

function pick(s: Relay, rand: () => number, words: readonly string[], chars: Chars): string {
  let pool = fit(words, chars).filter((w) => !s.used.includes(w));
  if (!pool.length) pool = [...fit(words, chars)];
  const word = pool[Math.floor(rand() * pool.length)];
  s.used.push(word);
  return word;
}

/** リレー c の k だん目を受け持つ人。自分のリレーを続けて受け持たないよう、だんごとに 1 人ずつずらす */
export function assignee(s: Relay, chain: number, step: number): Seat {
  return s.players[(chain + step) % s.players.length];
}

/** いまのだんでその人が受け持つリレー。受け持たないなら -1 */
export function chainOf(s: Relay, seat: Seat): number {
  return s.chains.findIndex((_, c) => assignee(s, c, s.step) === seat);
}

/** そのリレーで、次に描く言葉（最後の答えか、配り直したお題か、最初のお題） */
function wordOf(chain: Chain): string {
  for (let i = chain.entries.length - 1; i >= 0; i--) {
    const e = chain.entries[i];
    if (e.kind === 'prompt') return e.text;
    if (e.kind === 'guess' && e.text !== null) return e.text;
  }
  return chain.start;
}

/** だんを始める。いないの人のこまは、待たせないようにすぐ埋める */
function open(s: Relay, rand: () => number, words: readonly string[], chars: Chars) {
  s.done = [];
  s.left = drawing(s.step) ? s.draw : GUESS_S;
  s.chains.forEach((chain, c) => {
    const by = assignee(s, c, s.step);
    if (drawing(s.step)) {
      const last = chain.entries.at(-1);
      if (last?.kind === 'guess' && last.text === null)
        chain.entries.push({ kind: 'prompt', text: pick(s, rand, words, chars) });
      chain.entries.push({ kind: 'draw', by, strokes: [] });
    } else chain.entries.push({ kind: 'guess', by, text: null });
    if (!s.present.includes(by)) s.done.push(by);
  });
}

export function createRelay(
  players: Seat[],
  rand: () => number,
  words: readonly string[],
  length: Length,
  chars: Chars
): Relay {
  const s: Relay = {
    players: [...players],
    present: [...players],
    steps: STEPS[length],
    step: 0,
    left: 0,
    draw: LENGTHS[length].draw.hayaoshi,
    phase: 'play',
    chains: [],
    done: [],
    used: [],
    chars,
    page: { chain: 0, index: 0 }
  };
  s.chains = players.map(() => ({ start: pick(s, rand, words, chars), entries: [] }));
  open(s, rand, words, chars);
  return s;
}

export function taskOf(s: Relay, seat: Seat): Task {
  if (s.phase !== 'play' || s.done.includes(seat)) return { kind: 'wait' };
  const c = chainOf(s, seat);
  if (c < 0) return { kind: 'wait' };
  const chain = s.chains[c];
  if (drawing(s.step)) return { kind: 'draw', word: wordOf({ ...chain, entries: chain.entries.slice(0, -1) }) };
  const prev = chain.entries.at(-2);
  return { kind: 'guess', strokes: prev?.kind === 'draw' ? prev.strokes : [] };
}

export function addInk(s: Relay, seat: Seat, ink: Ink): void {
  if (s.phase !== 'play' || !drawing(s.step) || s.done.includes(seat)) return;
  const c = chainOf(s, seat);
  const entry = s.chains[c]?.entries.at(-1);
  if (entry?.kind === 'draw') entry.strokes = apply(entry.strokes, ink);
}

export function finish(s: Relay, seat: Seat, text?: string): void {
  if (s.phase !== 'play' || s.done.includes(seat)) return;
  const c = chainOf(s, seat);
  if (c < 0) return;
  const entry = s.chains[c].entries.at(-1);
  if (entry?.kind === 'guess') entry.text = text?.trim() || null;
  s.done.push(seat);
}

function advance(s: Relay, rand: () => number, words: readonly string[]) {
  s.step++;
  if (s.step >= s.steps) {
    s.phase = 'reveal';
    s.page = { chain: 0, index: 0 };
    return;
  }
  open(s, rand, words, s.chars);
}

/** 時間を進める。時間切れの当てるこまは、打ちかけの字（typed）を答えにする */
export function tick(
  s: Relay,
  dt: number,
  rand: () => number,
  words: readonly string[],
  typed: Record<number, string>
): void {
  if (s.phase !== 'play') return;
  s.left -= dt;
  if (s.left <= 0)
    s.chains.forEach((chain, c) => {
      const by = assignee(s, c, s.step);
      if (s.done.includes(by)) return;
      const entry = chain.entries.at(-1);
      if (entry?.kind === 'guess') entry.text = typed[by]?.trim() || null;
      s.done.push(by);
    });
  if (s.chains.every((_, c) => s.done.includes(assignee(s, c, s.step)))) advance(s, rand, words);
}

/** 抜けた人のいまのこまは、描きかけの線や打った答えのまま埋める。1 人になったらふりかえりへ */
export function leave(s: Relay, seat: Seat): void {
  s.present = s.present.filter((p) => p !== seat);
  if (s.phase === 'play' && chainOf(s, seat) >= 0 && !s.done.includes(seat)) s.done.push(seat);
  if (s.phase === 'play' && s.present.length < 2) {
    s.phase = 'reveal';
    s.page = { chain: 0, index: 0 };
  }
}

export function rejoin(s: Relay, seat: Seat): void {
  if (s.players.includes(seat) && !s.present.includes(seat)) s.present = [...s.present, seat];
}

export function pageOf(s: Relay): { chain: number; index: number; entry: Entry; last: boolean } | null {
  if (s.phase === 'play') return null;
  const { chain, index } = s.page;
  const c = s.chains[chain];
  if (!c) return null;
  const entry: Entry = index === 0 ? { kind: 'prompt', text: c.start } : c.entries[index - 1];
  return { chain, index, entry, last: index === c.entries.length };
}

export function next(s: Relay): void {
  if (s.phase !== 'reveal') return;
  const c = s.chains[s.page.chain];
  if (s.page.index < c.entries.length) s.page = { ...s.page, index: s.page.index + 1 };
  else if (s.page.chain < s.chains.length - 1) s.page = { chain: s.page.chain + 1, index: 0 };
  else s.phase = 'done';
}
```

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/relay.test.ts && pnpm check`
Expected: PASS。テストの期待と食い違ったら、テストの意図（spec の「1. 遊びの流れ」と「4.」）に合わせてコードを直す。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori/relay.ts src/lib/games/oekaki-mori/relay.test.ts
git commit -m "Add the relay rules: simultaneous chains, alternating draw and guess steps, timeouts, leaving, and the reveal"
```

---

### Task 2: 親の審判（relay-referee.ts）

**Files:**

- Create: `src/lib/games/oekaki-mori/relay-referee.ts`、`relay-referee.test.ts`
- Modify: `src/lib/net/party.svelte.ts`（`PROTOCOL = 5`）

**Interfaces:**

- Consumes: Task 1 の関数。
- Produces: `class RelayReferee { constructor(party: Party); start(length: Length, chars: Chars): void; stop(): void }`。知らせ `relayTask` / `relayView` / `relayPage`（spec の「親の審判」の形）。操作 `ink` / `typing` / `relayDone` / `relayNext` / `join` / `leave` を受ける。

- [ ] **Step 1: 失敗するテストを書く**

`relay-referee.test.ts`（node）を作る。`$lib/loop` の `animate` は差し替えて、フレームを手で回す。

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import { RelayReferee } from './relay-referee';

const frames = vi.hoisted(() => ({ list: [] as ((dt: number) => void)[] }));
vi.mock('$lib/loop', () => ({
  animate: (f: (dt: number) => void) => {
    frames.list.push(f);
    return () => {};
  }
}));
const frame = (dt = 0) => frames.list.forEach((f) => f(dt));

function fakeParty(members: Seat[]) {
  const acts = new Set<(m: Message, from: Seat) => void>();
  const told: [Seat, Message][] = [];
  const party = {
    host: true,
    members,
    onAct: (l: (m: Message, from: Seat) => void) => (acts.add(l), () => acts.delete(l)),
    tell: (to: Seat | 'all', m: Message) => {
      for (const seat of to === 'all' ? members : [to]) told.push([seat, m]);
    }
  } as unknown as Party;
  const act = (m: Message, from: Seat) => acts.forEach((l) => l(m, from));
  return { party, told, act };
}

const of = (told: [Seat, Message][], t: string) => told.filter(([, m]) => m.t === t);

describe('RelayReferee', () => {
  it('だんの頭に、受け持ちを 1 人 1 回だけ送る', () => {
    frames.list = [];
    const { party, told } = fakeParty([1, 2]);
    new RelayReferee(party).start('short', null);
    frame();
    frame();
    expect(of(told, 'relayTask').map(([seat]) => seat)).toEqual([1, 2]);
  });

  it('全員ができたら次のだんの受け持ちを送り、見え方は変わったときだけ送る', () => {
    frames.list = [];
    const { party, told, act } = fakeParty([1, 2]);
    new RelayReferee(party).start('short', null);
    frame();
    const views = of(told, 'relayView').length;
    frame();
    expect(of(told, 'relayView').length).toBe(views);
    act({ t: 'relayDone' }, 1);
    act({ t: 'relayDone' }, 2);
    frame();
    const tasks = of(told, 'relayTask').map(([, m]) => (m.task as { kind: string }).kind);
    expect(tasks).toEqual(['draw', 'draw', 'guess', 'guess']);
  });

  it('ふりかえりは親の「つぎ」だけで 1 こまずつ送り、戻った子にはめくり終えたこまを送り直す', () => {
    frames.list = [];
    const { party, told, act } = fakeParty([1, 2]);
    new RelayReferee(party).start('short', null);
    for (let i = 0; i < 4; i++) {
      act({ t: 'relayDone', text: 'くま' }, 1);
      act({ t: 'relayDone', text: 'くま' }, 2);
      frame();
    }
    told.length = 0;
    act({ t: 'relayNext' }, 2);
    expect(of(told, 'relayPage')).toEqual([]);
    act({ t: 'relayNext' }, 1);
    act({ t: 'relayNext' }, 1);
    expect(of(told, 'relayPage').filter(([seat]) => seat === 2)).toHaveLength(2);
    told.length = 0;
    act({ t: 'join' }, 2);
    const resent = of(told, 'relayPage').filter(([seat]) => seat === 2);
    expect(resent.map(([, m]) => m.index)).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/relay-referee.test.ts`
Expected: FAIL（`./relay-referee` が無い）。

- [ ] **Step 3: 実装する**

`relay-referee.ts` を作る。

```ts
import { animate } from '$lib/loop';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import type { Chars, Length } from './engine';
import { addInk, createRelay, finish, leave, next, pageOf, rejoin, taskOf, tick, type Relay } from './relay';
import type { Ink } from './strokes';
import { WORDS } from './words';

/**
 * 親の端末だけで動く。遊ぶ人の操作でリレーを進め、だんの頭に受け持ちを、変わったときに小さな見え方を、
 * ふりかえりでは 1 こまずつ絵を配る（絵をまとめると DataChannel の 1 回の上限を超えることがある）
 */
export class RelayReferee {
  readonly #party: Party;
  #state: Relay | null = null;
  #stop: (() => void)[] = [];
  /** 時間切れの当てるこまに使う、打ちかけの字 */
  #typed: Record<number, string> = {};
  #step = -1;
  #view = '';
  #page = '';

  constructor(party: Party) {
    this.#party = party;
  }

  start(length: Length, chars: Chars): void {
    this.#state = createRelay(this.#party.members, Math.random, WORDS, length, chars);
    this.#stop.push(
      this.#party.onAct((message, from) => this.#act(message, from)),
      animate((dt) => {
        if (!this.#state) return;
        tick(this.#state, dt, Math.random, WORDS, this.#typed);
        this.#push();
      })
    );
  }

  stop(): void {
    for (const stop of this.#stop.splice(0)) stop();
    this.#state = null;
  }

  #act(message: Message, from: Seat) {
    const s = this.#state;
    if (!s) return;
    if (message.t === 'ink') addInk(s, from, message.ink as Ink);
    else if (message.t === 'typing') this.#typed[from] = String(message.text);
    else if (message.t === 'relayDone') finish(s, from, message.text === undefined ? undefined : String(message.text));
    else if (message.t === 'relayNext' && from === 1) next(s);
    else if (message.t === 'leave') leave(s, from);
    else if (message.t === 'join') {
      rejoin(s, from);
      this.#catchUp(s, from);
    }
    this.#push();
  }

  /** 戻った子に、いまの見え方・受け持ち・いまのリレーのめくり終えたこまを送り直す */
  #catchUp(s: Relay, seat: Seat) {
    this.#party.tell(seat, { t: 'relayView', ...this.#viewOf(s) });
    if (s.phase === 'play') return this.#party.tell(seat, { t: 'relayTask', step: s.step, task: taskOf(s, seat) });
    const page = pageOf(s);
    if (!page) return;
    for (let index = 0; index <= page.index; index++) {
      const chain = s.chains[page.chain];
      const entry = index === 0 ? { kind: 'prompt', text: chain.start } : chain.entries[index - 1];
      this.#party.tell(seat, { t: 'relayPage', chain: page.chain, index, entry, last: index === chain.entries.length });
    }
  }

  #viewOf(s: Relay) {
    return { phase: s.phase, step: s.step, steps: s.steps, left: Math.max(0, Math.ceil(s.left)), done: [...s.done] };
  }

  #push() {
    const s = this.#state;
    if (!s) return;
    if (s.phase === 'play' && s.step !== this.#step) {
      this.#step = s.step;
      for (const seat of this.#party.members)
        this.#party.tell(seat, { t: 'relayTask', step: s.step, task: taskOf(s, seat) });
    }
    const view = JSON.stringify(this.#viewOf(s));
    if (view !== this.#view) {
      this.#view = view;
      this.#party.tell('all', { t: 'relayView', ...this.#viewOf(s) });
    }
    const page = pageOf(s);
    const key = page ? `${page.chain}:${page.index}` : '';
    if (page && key !== this.#page) {
      this.#page = key;
      this.#party.tell('all', { t: 'relayPage', ...page });
    }
  }
}
```

（ふりかえりの最初のページも `#push` が送る。戻った子への送り直しは `#catchUp` が送る。`relayPage` の `entry` に `prompt` を直接書いている所は、Task 1 の `pageOf` と同じ形になるようにする。）

`src/lib/net/party.svelte.ts` の `PROTOCOL` を 5 にする。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori src/lib/net && pnpm check`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori src/lib/net/party.svelte.ts
git commit -m "Add the relay referee: per-step tasks, small views, host-only page turns, and catch-up for returning devices"
```

---

### Task 3: リレーの画面と始め方

**Files:**

- Create: `src/lib/games/oekaki-mori/Relay.svelte`、`RelayPlay.svelte`、`RelayReveal.svelte`、`RelayPlay.svelte.test.ts`、`RelayReveal.svelte.test.ts`
- Modify: `ModeSelect.svelte`、`OekakiMori.svelte`、`sync.ts`、`round.svelte.ts`（`Screen` に `relay`）

**Interfaces:**

- Consumes: Task 2 の知らせと操作、`RelayReferee`。Task 1 の `Task`・`Entry`・`UNKNOWN`。
- Produces: `RelayPlay`（props `{ task: Task; view: RelayView; looks; onink: (ink: Ink) => void; ondone: (text?: string) => void; ontype: (text: string) => void }`）、`RelayReveal`（props `{ pages: Page[]; finished: boolean; host: boolean; looks; onnext: () => void; onagain: () => void; onsave: () => void }`）、`type Page = { chain: number; index: number; entry: Entry; last: boolean }`、`type RelayView = { phase; step; steps; left; done: Seat[] }`。

- [ ] **Step 1: 失敗するテストを書く**

`RelayPlay.svelte.test.ts` を作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RelayPlay from './RelayPlay.svelte';

vi.mock('$lib/audio.svelte', () => ({ wake: () => {} }));
const view = { phase: 'play', step: 0, steps: 4, left: 40, done: [] };

function show(task: unknown) {
  const ondone = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(RelayPlay, {
    target,
    props: { task, view, looks: {}, onink: () => {}, ondone, ontype: () => {} }
  });
  flushSync();
  return { app, target, ondone };
}

describe('RelayPlay', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('描くだんは言葉を見せ、できたで知らせる', () => {
    const { app, target, ondone } = show({ kind: 'draw', word: 'りんご' });
    expect(target.textContent).toContain('りんご');
    [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'できた')!.click();
    expect(ondone).toHaveBeenCalledWith();
    unmount(app);
  });

  it('当てるだんは 50 音盤の答えを知らせ、待つときは待つと出す', () => {
    const a = show({ kind: 'guess', strokes: [] });
    const press = (label: string) =>
      [...a.target.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!.click();
    press('い');
    flushSync();
    press('ぬ');
    flushSync();
    press('こたえる');
    expect(a.ondone).toHaveBeenCalledWith('いぬ');
    unmount(a.app);
    const b = show({ kind: 'wait' });
    expect(b.target.textContent).toContain('まっています');
    unmount(b.app);
  });
});
```

`RelayReveal.svelte.test.ts` を作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RelayReveal from './RelayReveal.svelte';

const pages = [
  { chain: 0, index: 0, entry: { kind: 'prompt', text: 'りんご' }, last: false },
  { chain: 0, index: 1, entry: { kind: 'draw', by: 1, strokes: [] }, last: false },
  { chain: 0, index: 2, entry: { kind: 'guess', by: 2, text: 'とまと' }, last: true }
];

function show(host: boolean, finished = false) {
  const onnext = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(RelayReveal, {
    target,
    props: { pages, finished, host, looks: {}, onnext, onagain: () => {}, onsave: () => {} }
  });
  flushSync();
  return { app, target, onnext };
}

describe('RelayReveal', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('リレーの最後で、最初と最後の言葉を大きく出し、親だけがつぎを押せる', () => {
    const host = show(true);
    expect(host.target.textContent).toContain('さいしょは「りんご」');
    expect(host.target.textContent).toContain('さいごは「とまと」');
    [...host.target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'つぎ')!.click();
    expect(host.onnext).toHaveBeenCalled();
    unmount(host.app);
    const guest = show(false);
    expect([...guest.target.querySelectorAll('button')].some((b) => b.textContent?.trim() === 'つぎ')).toBe(false);
    unmount(guest.app);
  });

  it('全部めくったら、しゃしんに ほぞん を出す', () => {
    const { app, target } = show(false, true);
    expect(target.textContent).toContain('しゃしんに ほぞん');
    unmount(app);
  });
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/RelayPlay.svelte.test.ts src/lib/games/oekaki-mori/RelayReveal.svelte.test.ts`
Expected: FAIL（部品が無い）。

- [ ] **Step 3: 実装する**

`RelayPlay.svelte` を作る。上に「{view.step + 1} / {view.steps}」と残り秒、中に盤面、下に道具か 50 音盤。描くだんは、自分の線を手元の `strokes` に `apply` しながら `onink` で親へ送る（`Board` の `onink`）。

```svelte
<script lang="ts">
  import Board from './Board.svelte';
  import KanaPad from './KanaPad.svelte';
  import type { Task } from './relay';
  import { apply, ERASER, PENS, SIZES, type Ink, type Stroke } from './strokes';
  import Tools from './Tools.svelte';

  let {
    task,
    view,
    onink,
    ondone,
    ontype
  }: {
    task: Task;
    view: { step: number; steps: number; left: number };
    looks?: Record<number, string>;
    onink: (ink: Ink) => void;
    ondone: (text?: string) => void;
    ontype: (text: string) => void;
  } = $props();

  let strokes = $state.raw<Stroke[]>([]);
  let color = $state<string>(PENS[0].hex);
  let size = $state(1);
  let erasing = $state(false);
  const pen = $derived(task.kind === 'draw' ? (erasing ? ERASER : { color, size: SIZES[size] }) : null);

  function ink(i: Ink) {
    strokes = apply(strokes, i);
    onink(i);
  }

  // だんが替わったら、前のだんの自分の線を消す
  $effect(() => {
    void task;
    strokes = [];
  });
</script>

<header class="bar">
  <p class="word">
    {#if task.kind === 'draw'}おだい <b>{task.word}</b>{:else if task.kind === 'guess'}なにの えかな？{:else}ほかの
      ひとを まっています{/if}
  </p>
  <p class="left">{view.step + 1} / {view.steps}　{view.left}</p>
</header>
<div class="middle">
  {#if task.kind === 'draw'}
    <Board {strokes} {pen} onink={ink} />
  {:else if task.kind === 'guess'}
    <Board strokes={task.strokes} />
  {:else}
    <p class="wait" role="status">ほかの ひとを まっています</p>
  {/if}
</div>
{#if task.kind === 'draw'}
  <Tools bind:color bind:size bind:erasing onundo={() => ink({ k: 'undo' })} onclear={() => ink({ k: 'clear' })} />
  <button class="pill gold done" onclick={() => ondone()}>できた</button>
{:else if task.kind === 'guess'}
  <KanaPad onsubmit={(text) => ondone(text)} {ontype} />
{/if}
```

style は `TopBar.svelte` の `.bar` / `.word` / `.left` と `Play.svelte` の `.middle` を写し、`.done { margin: 0 auto max(8px, env(safe-area-inset-bottom)); min-width: 50%; }`、`.wait { color: var(--line); font-weight: 800; }` を足す。

`RelayReveal.svelte` を作る。`pages` のうち、最後のページと同じ `chain` のページを順に並べ、最後のページが見えるように寄せる（`$effect` で `scrollIntoView({ block: 'end' })`）。

```svelte
<script lang="ts">
  import Board from './Board.svelte';
  import Face from './Face.svelte';
  import type { Entry } from './relay';
  import { UNKNOWN } from './relay';

  type Page = { chain: number; index: number; entry: Entry; last: boolean };
  let {
    pages,
    finished,
    host,
    looks = {},
    onnext,
    onagain,
    onsave
  }: {
    pages: Page[];
    finished: boolean;
    host: boolean;
    looks?: Record<number, string>;
    onnext: () => void;
    onagain: () => void;
    onsave: () => void;
  } = $props();

  const current = $derived(pages.at(-1));
  const shown = $derived(pages.filter((p) => p.chain === current?.chain));
  const first = $derived(shown.find((p) => p.index === 0)?.entry);
  const lastWord = $derived.by(() => {
    const e = current?.entry;
    return e?.kind === 'guess' ? (e.text ?? UNKNOWN) : '';
  });
  let end = $state<HTMLElement>();
  $effect(() => {
    void shown.length;
    end?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  });
</script>

<div class="reveal">
  <h2 class="yuru">ふりかえり</h2>
  <ol class="pages">
    {#each shown as p (p.index)}
      <li>
        {#if p.entry.kind === 'draw'}
          <span class="who"><Face seat={p.entry.by} look={looks[p.entry.by]} name /> が かいた</span>
          <div class="thumb"><Board strokes={p.entry.strokes} /></div>
        {:else if p.entry.kind === 'guess'}
          <p class="text"><Face seat={p.entry.by} look={looks[p.entry.by]} name />「{p.entry.text ?? UNKNOWN}」</p>
        {:else}
          <p class="text">{p.index === 0 ? 'さいしょの おだい' : 'あたらしい おだい'}「{p.entry.text}」</p>
        {/if}
      </li>
    {/each}
  </ol>
  {#if current?.last && first?.kind === 'prompt'}
    <p class="punch">さいしょは「{first.text}」→ さいごは「{lastWord}」</p>
  {/if}
  <div bind:this={end} class="actions">
    {#if finished}
      <button class="pill" onclick={onsave}>しゃしんに ほぞん</button>
      {#if host}<button class="pill gold" onclick={onagain}>あそびを えらぶ</button>{/if}
    {:else if host}
      <button class="pill gold" onclick={onnext}>つぎ</button>
    {:else}
      <p role="status">おやが めくるのを まってね</p>
    {/if}
  </div>
</div>
```

style は `Result.svelte` の `.result` と `.thumb`（幅 min(70cqw, 360px)）を写し、`.punch { font-size: clamp(22px, 4cqh, 32px); padding: 8px 20px; border: 3px solid var(--line); border-radius: 999px; background: var(--pastel-gold); }`、`.pages { list-style: none; display: grid; gap: 12px; justify-items: center; }` を足す。

`Relay.svelte` を作る。`Together.svelte` と同じく `onMount` で `party.onTell` を聞き、`relayTask` で `task`、`relayView` で `view`、`relayPage` で `pages`（同じ `chain` と `index` は置きかえ、それ以外は足す）を持つ。`view.phase === 'play'` なら `RelayPlay`、それ以外は `RelayReveal`（`finished` は `view.phase === 'done'`）。操作は `party.act` で送る（`onink` は `{ t: 'ink', ink }`、`ondone` は `{ t: 'relayDone', text }`、`ontype` は `{ t: 'typing', text }`、`onnext` は `{ t: 'relayNext' }`）。`onsave` は Task 4 で入れる（ここでは `() => {}`）。props は `{ party: Party; looks: Record<number, string>; onagain: () => void }`。

`ModeSelect.svelte` の `MODES` に `{ mode: 'relay', icon: 'arrow', name: 'おえかきリレー', note: 'えと ことばを じゅんばんに つなぐ' }` を足し、`onpick` の型を `(mode: Mode | 'together' | 'relay') => void` にする。

`sync.ts` の `Screen` に `'relay'` を足す（`catchUp` は `relay` なら `[{ t: 'screen', screen: 'relay' }]` を返す。今のままで `play` と `result` 以外はその形になる）。

`OekakiMori.svelte` は次のとおりにする。

- `referee` の型を `{ stop(): void } | null` にする。
- `begin` の最初の `together` の行の次に足す。

```ts
saveLength(length);
saveChars(chars);
if (mode === 'relay') {
  party?.tell('all', { t: 'screen', screen: 'relay' });
  const relay = new RelayReferee(party!);
  relay.start(length, chars);
  referee = relay;
  return;
}
```

（今の `saveLength` / `saveChars` の 2 行はこの位置へ移す。）

- 画面に `{:else if round.screen === 'relay'}<Relay {party} looks={party.looks} onagain={toMode} />` を足す。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori && pnpm check && pnpm lint && pnpm vitals --diff`
Expected: PASS。部品はすべて 200 行未満。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori
git commit -m "Add the relay screens: draw, guess, and wait steps, a host-paced reveal, and the mode card"
```

---

### Task 4: リレーの 1 枚を保存する

**Files:**

- Create: `src/lib/games/oekaki-mori/relay-album.ts`、`relay-album.test.ts`
- Modify: `Relay.svelte`（`onsave`）

**Interfaces:**

- Consumes: Task 3 の `pages`（全部のリレーのページ）。
- Produces: `relayLayout(columns: Entry[][]): { width: number; height: number; cells: { x: number; y: number; w: number; h: number }[][] }`、`relayAlbum(columns: Entry[][], looks): string`。

- [ ] **Step 1: 失敗するテストを書く**

`relay-album.test.ts`（node）を作る。

```ts
import { describe, expect, it } from 'vitest';
import type { Entry } from './relay';
import { relayLayout } from './relay-album';

const prompt: Entry = { kind: 'prompt', text: 'りんご' };
const draw: Entry = { kind: 'draw', by: 1, strokes: [] };
const guess: Entry = { kind: 'guess', by: 2, text: 'とまと' };

describe('relayLayout', () => {
  it('リレーごとに縦の列を作り、列どうしもこまどうしも重ならない', () => {
    const columns = [
      [prompt, draw, guess, draw, guess],
      [prompt, draw, guess, prompt, draw, guess]
    ];
    const { width, height, cells } = relayLayout(columns);
    expect(cells.map((c) => c.length)).toEqual([5, 6]);
    const all = cells.flat();
    for (const c of all) {
      expect(c.x + c.w).toBeLessThanOrEqual(width);
      expect(c.y + c.h).toBeLessThanOrEqual(height);
    }
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const [a, b] = [all[i], all[j]];
        expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
      }
  });
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/relay-album.test.ts`
Expected: FAIL。

- [ ] **Step 3: 実装する**

`relay-album.ts` を作る。列の幅 `COL = 360`、すき間 `GAP = 32`、外側 `PAD = 48`、見出し `HEAD = 140`。言葉のこまは高さ 80、絵のこまは `COL × COL`。`relayLayout` は列ごとに上から積み、`width = PAD * 2 + n * COL + (n - 1) * GAP`、`height = HEAD + 一番高い列 + PAD`。`relayAlbum` は `album.ts` と同じく canvas に、地 `#fffaf2`・見出し「おえかきリレー」・言葉のこま（`prompt` は「おだい『…』」、`guess` は動物の名前と「『…』」、`null` は `UNKNOWN`）・絵のこま（`strokes.ts` の `render` で別の canvas に描いて貼り、枠を描く）を描き、`toDataURL('image/png')` を返す。言葉の `fillText` には最大幅 `COL - 16` を渡す。

`Relay.svelte` の `onsave` は、`pages` をリレーごとに `index` の順で `entry` の列に並べて `saveImage(relayAlbum(columns, looks), 'oekaki-relay.png')` を呼ぶ（`import { saveImage } from '$lib/share';`）。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori && pnpm check && pnpm lint`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori
git commit -m "Save every relay chain side by side as one picture"
```

---

### Task 5: 通しで確かめて出す

**Files:**

- Scratch only（`$SCRATCHPAD/finish.mjs` を直して `relay.mjs` を作る）
- Modify: `CLAUDE.md`

- [ ] **Step 1: CLAUDE.md を書きかえる**

おえかきのもりの段落の「遊び方はエゴコロクイズ（…）とはやおし検定（…）とみんなでぬりえ（…）で」に、おえかきリレーを足す。足す文は「おえかきリレー（人数ぶんのリレーを同時に回し、描く・当てるを 1 だんごとにいっせいに進める。ルールは `relay.ts`、親の審判は `relay-referee.ts`、画面は `Relay.svelte`。だんの頭に受け持ち（`relayTask`）を 1 人 1 回、ふりかえりは親の「つぎ」で 1 こまずつ（`relayPage`）配る。時間切れの答えは打ちかけの字、無ければ「わからなかった」にして次の描く人へ新しいお題を配る。保存する 1 枚は `relay-album.ts`）」。

- [ ] **Step 2: 3 ページの通し**

`pnpm dev` を background で立て、`relay.mjs` で 3 台をつなぎ、「みじかめ」でおえかきリレーを始める。4 だんを回す（描くだんは各ページで線を 1 本引いて「できた」、当てるだんは 50 音盤で 2 字打って「こたえる」）。ふりかえりを親の「つぎ」で最後までめくり、途中で 1 枚、最後のリレーの終わり（最初と最後の言葉）で 1 枚、保存する 1 枚を撮る。

Expected: 3 本のリレーが 5 こまずつ（最初のお題・絵・答え・絵・答え）めくれ、保存する 1 枚に 3 列が並ぶ。

- [ ] **Step 3: 見直しと出す**

superpowers:executing-plans の Final Review を通し、Critical と Important を直してから、main を取り込み、`pnpm verify` を通して `git push origin HEAD:main` と `git push origin HEAD` をする。`gh run watch` で deploy と CI の成功を確かめる。開発サーバーと playwright を止める。
