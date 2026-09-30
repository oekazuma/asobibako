# おえかきのもりの仕上げ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** おえかきのもりを抜けにくく、切れても戻れ、打っている答えが見え、Apple Pencil でなめらかに描けるようにする。

**Architecture:** 親の `Party` が切れた番号を覚えて同じ番号で迎え直し、`join` を審判と画面へ流す。審判は戻った人をルールに戻し（`rejoin`）、打っている字を描く人とほかの人で出し分けて配る。盤面は `pointermove` の間の点まで拾い、曲線で描き足し、ペンを指より優先する。画面は、つながったあとの ✕ を「≡」のメニューに替え、ロビーと遊び方選びをカードにする。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、vitest（node の unit と happy-dom の dom）、WebRTC DataChannel（`src/lib/net/`）。

**Spec:** `docs/superpowers/specs/2026-10-01-oekaki-mori-polish-design.md`

## Global Constraints

- コンポーネントは 200 行未満（`architecture/component-size`、抑制コメントは使わない）。
- コメントは非自明な WHY だけ。変更履歴やタスク番号は書かない。
- 入力は `pointerdown` と `pointerId` で扱う。絵文字は使わない。アイコンは `src/lib/icons.ts` と `Icon.svelte`。
- 共通の画面の見た目は `.pill` / `.round` / `.yuru` と `--line` / `--pastel-*` / `--paper` のトークン。
- 画面の文字はひらがな中心（子どもも遊ぶ）。
- `pnpm verify`（lint / check / test:run / vitals / build）が通ること。
- commit の末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

- 切れた人がいるあいだに別の人が来たら、切れた番号を渡してしまう（切れた人が戻れない）。Task 1 のテストで、切れた番号を先に渡すことを固め、そのうえで 3 人そろうと 4 人目は断ることを確かめる。
- ペンで描いているあいだに手のひらが離れると、ペンの線が終わる。Task 3 のテストで、別の pointerId の up を無視することを固める。
- 番が変わった直後に前の番の打っている字が届くと、新しい番に古い字が残る。Task 4 のテストで、番が変わったら打っている字を消すことを固める。
- みんなでぬりえで、親が「できた！」を押したあとに戻った子が塗れてしまう。Task 5 のテストで、戻った子に `finished` まで送ることを固める。
- 子が 2 人の遊びで抜けると、親の遊びは終わり、親は結果の画面で「よびなおす」を押せること。Task 5 の通しで確かめる。

---

### Task 1: Party が切れた番号を覚えて迎え直す

**Files:**

- Modify: `src/lib/net/party.svelte.ts`
- Test: `src/lib/net/party.svelte.test.ts`

**Interfaces:**

- Produces: `Party.away: Seat[]`（親だけ。つながりが切れた子の番号、昇順）。`add()` は `away` の番号を空いた番号より先に渡す。迎えるたびに親のルールへ `{ t: 'join' }` を、その番号から流す（`onAct` の listener が `(message, from)` で受ける）。`close()` は `away` も空にする。

- [ ] **Step 1: 失敗するテストを書く**

`party.svelte.test.ts` の `describe('Party')` の末尾に足す。

```ts
// 切れた人の番号を空けたままにすると、別の人が入って切れた人が戻れなくなる
it('切れた子の番号を覚え、次に迎える子へ先に渡す', async () => {
  const { host, a } = trio();
  a.close();
  await settle();
  expect(host.away).toEqual([2]);
  const [c, c2] = pipes();
  const g = Party.guest(c2);
  expect(host.add(c)).toBe(2);
  await settle();
  expect(g.me).toBe(2);
  expect(host.away).toEqual([]);
  expect(host.members).toEqual([1, 2, 3]);
});

it('迎えるたびに、その子の番号で join を親のルールへ流す', () => {
  const host = Party.host();
  const joined: Seat[] = [];
  host.onAct((m, from) => m.t === 'join' && joined.push(from));
  const [a] = pipes();
  host.add(a);
  expect(joined).toEqual([2]);
});

it('閉じたら、切れた子の番号も忘れる', async () => {
  const { host, a } = trio();
  a.close();
  await settle();
  host.close();
  expect(host.away).toEqual([]);
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/net/party.svelte.test.ts`
Expected: 3 つとも FAIL（`host.away` が undefined、join が流れない）。

- [ ] **Step 3: 実装する**

`party.svelte.ts` に次を入れる。

```ts
/** 親だけ。つながりが切れた子の番号。呼び直した子にはこの番号を先に渡し、点数と番を引き継がせる */
away = $state<Seat[]>([]);
```

`add()` を次にする。

```ts
  /** 親だけ。切れた子の番号か、空いている番号で子を迎える。満員なら閉じて null */
  add(pipe: Pipe): Seat | null {
    const free = (s: Seat) => !this.#pipes.has(s);
    const seat = this.away.find(free) ?? ([2, 3] as const).find((s) => free(s) && !this.away.includes(s));
    if (!this.host || !seat) {
      pipe.close();
      return null;
    }
    this.away = this.away.filter((s) => s !== seat);
    this.#pipes.set(seat, pipe);
    pipe.on((message) => this.#act(message, seat));
    pipe.closed.then(() => this.#drop(seat, pipe));
    pipe.send({ t: 'seat', seat });
    this.#setMembers([...this.members, seat]);
    this.#act({ t: 'join' }, seat);
    return seat;
  }
```

`close()` の `this.members = [this.me];` の次に `this.away = [];` を足す。`#drop()` の `this.#pipes.delete(seat);` の次に `this.away = [...this.away, seat].sort((a, b) => a - b);` を足す。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/net/party.svelte.test.ts`
Expected: 全部 PASS（既存の「4 人目は断る」も通る）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/net/party.svelte.ts src/lib/net/party.svelte.test.ts
git commit -m "Let the host remember dropped seats and welcome a returning player back to the same seat"
```

---

### Task 2: ルールと審判が戻った人を加え、打っている字を出し分ける

**Files:**

- Modify: `src/lib/games/oekaki-mori/engine.ts`
- Modify: `src/lib/games/oekaki-mori/referee.ts`
- Test: `src/lib/games/oekaki-mori/engine.test.ts`
- Create: `src/lib/games/oekaki-mori/referee.test.ts`

**Interfaces:**

- Consumes: Task 1 の `{ t: 'join' }`（`onAct` で `from` がその番号）。
- Produces: `rejoin(s: Quiz, seat: Seat): void`。審判は `{ t: 'typing', text }` の操作を受け、描く人へ `{ t: 'typing', seat, text }`、ほかの当てる人へ `{ t: 'typing', seat, text: '●' の字数ぶん }` を送る（打った本人には送らない）。

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts` の import に `rejoin` を足し、末尾に足す。

```ts
describe('rejoin', () => {
  it('抜けた人が戻ったら当てる人として加え、点数は抜ける前のまま、描く番は戻さない', () => {
    const s = game();
    const word = go(s);
    guess(s, 3, word);
    leave(s, 3, fixed, WORDS);
    const order = [...s.order];
    rejoin(s, 3);
    expect(s.players).toEqual([1, 2, 3]);
    expect(s.scores[3]).toBe(3);
    expect(s.order).toEqual(order);
  });

  it('終わった遊びや、いる人には何もしない', () => {
    const s = game([1, 2]);
    leave(s, 2, fixed, WORDS);
    rejoin(s, 2);
    expect(s.players).toEqual([1]);
    const t = game();
    rejoin(t, 2);
    expect(t.players).toEqual([1, 2, 3]);
  });

  it('遊びの途中から来た人は 0 点で加わる', () => {
    const s = game([1, 2]);
    rejoin(s, 3);
    expect(s.players).toEqual([1, 2, 3]);
    expect(s.scores[3]).toBe(0);
  });
});
```

`referee.test.ts` を作る。

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import { Referee } from './referee';

// 審判はフレームごとに時間を進めるが、このテストは操作への返事だけを見る
vi.mock('$lib/loop', () => ({ animate: () => () => {} }));

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

describe('Referee', () => {
  it('打っている字は、描く人にはそのまま、ほかの当てる人には字数だけ送り、本人には送らない', () => {
    const { party, told, act } = fakeParty([1, 2, 3]);
    new Referee(party).start('egokoro');
    act({ t: 'start' }, 1);
    told.length = 0;
    act({ t: 'typing', text: 'りん' }, 2);
    const typing = told.filter(([, m]) => m.t === 'typing');
    expect(typing).toEqual([
      [1, { t: 'typing', seat: 2, text: 'りん' }],
      [3, { t: 'typing', seat: 2, text: '●●' }]
    ]);
  });

  it('描いていないあいだや、描く人の打った字は配らない', () => {
    const { party, told, act } = fakeParty([1, 2, 3]);
    new Referee(party).start('egokoro');
    act({ t: 'typing', text: 'り' }, 2);
    act({ t: 'start' }, 1);
    act({ t: 'typing', text: 'り' }, 1);
    expect(told.filter(([, m]) => m.t === 'typing')).toEqual([]);
  });

  it('戻った人をルールに戻し、その人に見え方を送り直す', () => {
    const { party, told, act } = fakeParty([1, 2, 3]);
    new Referee(party).start('egokoro');
    act({ t: 'leave' }, 3);
    told.length = 0;
    act({ t: 'join' }, 3);
    const views = told.filter(([seat, m]) => seat === 3 && m.t === 'view');
    expect(views).toHaveLength(1);
    expect((views[0][1].view as { players: Seat[] }).players).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/engine.test.ts src/lib/games/oekaki-mori/referee.test.ts`
Expected: `rejoin` が無い import の失敗と、typing と join の referee テストの FAIL。

- [ ] **Step 3: 実装する**

`engine.ts` の `leave` の次に足す。

```ts
/** 抜けた人（か途中から来た人）を当てる人として加える。抜けたときに消した描く番は、終わる時間が読めなくなるので戻さない */
export function rejoin(s: Quiz, seat: Seat): void {
  if (s.phase === 'done' || s.players.includes(seat)) return;
  s.players = [...s.players, seat].sort((a, b) => a - b);
  s.scores[seat] ??= 0;
}
```

`referee.ts` の import に `rejoin` を足し、`#act` の `else if (message.t === 'leave') leave(s, from);` の前に足す。

```ts
    else if (message.t === 'join') {
      rejoin(s, from);
      // 戻った子の画面は何も持っていないので、前に送った見え方と同じでも送り直す
      this.#sent.delete(from);
    } else if (message.t === 'typing') return this.#typing(s, from, String(message.text));
```

`#push` の前に足す。

```ts
  /** 描く人には打っている字をそのまま、ほかの当てる人には字数だけ見せる（字が見えると答えがばれる） */
  #typing(s: Quiz, from: Seat, text: string) {
    if (s.mode !== 'egokoro' || s.phase !== 'draw' || from === drawer(s) || s.solved.includes(from)) return;
    const hidden = '●'.repeat([...text].length);
    for (const seat of this.#party.members) {
      if (seat === from) continue;
      this.#party.tell(seat, { t: 'typing', seat: from, text: seat === drawer(s) ? text : hidden });
    }
  }
```

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/engine.test.ts src/lib/games/oekaki-mori/referee.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori/engine.ts src/lib/games/oekaki-mori/engine.test.ts src/lib/games/oekaki-mori/referee.ts src/lib/games/oekaki-mori/referee.test.ts
git commit -m "Bring a returning player back into the quiz and relay typed answers, hidden from other guessers"
```

---

### Task 3: 盤面が間の点まで拾い、曲線で描き足し、ペンを優先する

**Files:**

- Modify: `src/lib/board-input.ts`（`move` の口と、任意のイベントを盤面座標に直す `at()`）
- Modify: `src/lib/games/oekaki-mori/strokes.ts`（曲線で描く `render` と、描き足す `renderTail`）
- Modify: `src/lib/games/oekaki-mori/Board.svelte`
- Test: `src/lib/games/oekaki-mori/strokes.test.ts`、`src/lib/games/oekaki-mori/Board.svelte.test.ts`

**Interfaces:**

- Produces: `BoardInput` の hooks に `move?: (event: PointerEvent, x: number, y: number) => void` と、public な `at(event: PointerEvent): [number, number]`。`renderTail(ctx, stroke: Stroke, from: number): void`（`from` は描き終えた点の数）。`Ink` の形は変えない。

- [ ] **Step 1: 失敗するテストを書く**

`strokes.test.ts` に足す（`render` と `renderTail` を import に足す）。

```ts
/** 描いた命令だけを記録する ctx */
function recorder() {
  const calls: [string, ...number[]][] = [];
  const ctx = {
    canvas: { width: 100, height: 100 },
    setTransform: () => {},
    fillRect: () => {},
    beginPath: () => calls.push(['begin']),
    moveTo: (x: number, y: number) => calls.push(['move', x, y]),
    lineTo: (x: number, y: number) => calls.push(['line', x, y]),
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => calls.push(['curve', cx, cy, x, y]),
    stroke: () => calls.push(['stroke'])
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const line = { color: '#000', size: 0.01, pts: [0, 0, 0.2, 0, 0.2, 0.2, 0, 0.2] };

describe('render', () => {
  // 点を直線でつなぐと、速く描いたときに角ばる
  it('点どうしの中点を通る曲線でつなぐ', () => {
    const { ctx, calls } = recorder();
    render(ctx, [line]);
    expect(calls).toEqual([
      ['begin'],
      ['move', 0, 0],
      ['curve', 0.2, 0, 0.2, 0.1],
      ['curve', 0.2, 0.2, 0.1, 0.2],
      ['line', 0, 0.2],
      ['stroke']
    ]);
  });
});

describe('renderTail', () => {
  // 1 点足すたびに絵を全部描き直すと、絵が混むほど遅れる
  it('描き終えたところの 1 つ前の中点から、足した点までだけを描く', () => {
    const { ctx, calls } = recorder();
    renderTail(ctx, line, 3);
    expect(calls).toEqual([['begin'], ['move', 0.2, 0.1], ['curve', 0.2, 0.2, 0.1, 0.2], ['line', 0, 0.2], ['stroke']]);
  });
});
```

`Board.svelte.test.ts` の既存のテストの次に足す。

```ts
function board(onink: (i: Ink) => void) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(BoardHarness, { target, props: { onink } });
  flushSync();
  const el = target.querySelector('.board')!;
  const fire = (type: string, id: number, kind: string, extra: PointerEvent[] = []) => {
    const e = new PointerEvent(type, { pointerId: id, pointerType: kind, clientX: 5, clientY: 5, bubbles: true });
    Object.defineProperty(e, 'getCoalescedEvents', { value: () => extra });
    el.dispatchEvent(e);
  };
  return { app, fire };
}

// 手のひらが先に触れると、手のひらが描く指になって Pencil で描けない
it('指で描いている途中にペンが触れたら、指の線を取り消してペンの線にする', () => {
  const inks: Ink[] = [];
  const { app, fire } = board((i) => inks.push(i));
  fire('pointerdown', 1, 'touch');
  fire('pointerdown', 2, 'pen');
  expect(inks.map((i) => i.k)).toEqual(['start', 'undo', 'start']);
  unmount(app);
});

it('一度ペンが触れたら、指では描かない。手のひらが離れてもペンの線は続く', () => {
  const inks: Ink[] = [];
  const { app, fire } = board((i) => inks.push(i));
  fire('pointerdown', 2, 'pen');
  fire('pointerdown', 1, 'touch');
  fire('pointerup', 1, 'touch');
  fire('pointermove', 2, 'pen');
  fire('pointerup', 2, 'pen');
  expect(inks.map((i) => i.k)).toEqual(['start', 'add']);
  unmount(app);
});

// Pencil は 1 秒に 240 回ほど位置を送るが、pointermove は 1 フレームに 1 回にまとめられる
it('pointermove にまとめられた間の点まで拾う', () => {
  const inks: Ink[] = [];
  const { app, fire } = board((i) => inks.push(i));
  fire('pointerdown', 2, 'pen');
  const at = (x: number) => new PointerEvent('pointermove', { pointerId: 2, clientX: x, clientY: 5 });
  fire('pointermove', 2, 'pen', [at(10), at(20), at(30)]);
  fire('pointerup', 2, 'pen');
  const added = inks.filter((i) => i.k === 'add');
  expect(added).toHaveLength(1);
  expect(added[0].k === 'add' && added[0].pts.length).toBe(8);
  unmount(app);
});
```

盤面の大きさは happy-dom では 0 なので、座標は NaN になる。点の数だけを見る。`add` は近すぎる点を落とす条件（`Math.hypot(...) < 0.003`）に NaN が引っかからないので、3 点と離した 1 点の 4 点ぶん（8 個の数）になる。

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/strokes.test.ts src/lib/games/oekaki-mori/Board.svelte.test.ts`
Expected: `renderTail` が無い import の失敗、曲線の FAIL、ペンと間の点の FAIL。

- [ ] **Step 3: 実装する**

`board-input.ts` の `Hooks` に `move?: (event: PointerEvent, x: number, y: number) => void;` を足す。`#toBoard` を public な `at` に改名し（`down` / `move` / `up` の中の呼び出しも替える）、doc を「画面上の点を盤面の 0..1 に直す。まとめられた間のイベントにも使う」にする。`move` を次にする。

```ts
move = (event: PointerEvent) => {
  const [x, y] = this.at(event);
  this.fingers.move(event.pointerId, x, y, event.timeStamp);
  this.#hooks.move?.(event, x, y);
};
```

`strokes.ts` の `render` を次の 3 つに置きかえる。

```ts
/**
 * 1 本の線を、from 番目の点（描き終えた点の数）から終わりまで描く。点どうしは中点を通る 2 次曲線でつなぐ。
 * 描き足すときは 1 つ前の中点から描き直し、前に描いた末端の直線と継ぎ目を曲線で覆う
 */
function trace(ctx: CanvasRenderingContext2D, { color, size, pts }: Stroke, from: number): void {
  const n = pts.length / 2;
  const mid = (i: number): [number, number] => [
    (pts[2 * i] + pts[2 * i + 2]) / 2,
    (pts[2 * i + 1] + pts[2 * i + 3]) / 2
  ];
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.beginPath();
  // 点 1 つだけの線（タップ）も丸く見せる
  if (n === 1) {
    ctx.moveTo(pts[0], pts[1]);
    ctx.lineTo(pts[0] + 0.0001, pts[1]);
    ctx.stroke();
    return;
  }
  const first = Math.max(1, from - 1);
  const [sx, sy] = first === 1 ? [pts[0], pts[1]] : mid(first - 1);
  ctx.moveTo(sx, sy);
  for (let i = first; i < n - 1; i++) {
    const [mx, my] = mid(i);
    ctx.quadraticCurveTo(pts[2 * i], pts[2 * i + 1], mx, my);
  }
  ctx.lineTo(pts[2 * n - 2], pts[2 * n - 1]);
  ctx.stroke();
}

/** 盤面の幅を 1 とする座標で描けるようにする。盤面は正方形なので高さも同じ */
function frame(ctx: CanvasRenderingContext2D): void {
  const w = ctx.canvas.width;
  ctx.setTransform(w, 0, 0, w, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

/** canvas の画素の幅を 1 として全部描き直す */
export function render(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  frame(ctx);
  for (const stroke of strokes) trace(ctx, stroke, 0);
}

/** 最後の線に足された点だけを描き足す。from は前に描き終えた点の数 */
export function renderTail(ctx: CanvasRenderingContext2D, stroke: Stroke, from: number): void {
  frame(ctx);
  trace(ctx, stroke, from);
}
```

`render` のテストは from = 0 で first = 1、始点は線の頭、i = 1, 2 の曲線、最後に直線。`renderTail(ctx, line, 3)` は first = 2、始点は mid(1) = (0.2, 0.1)、i = 2 の曲線、最後に直線。

`Board.svelte` の `<script>` を次にする（`<div class="board" ...>` と style は今のまま）。

```ts
import { onMount } from 'svelte';
import { BoardInput } from '$lib/board-input';
import { animate } from '$lib/loop';
import { render, renderTail, type Ink, type Stroke } from './strokes';

let {
  strokes,
  pen = null,
  onink
}: { strokes: Stroke[]; pen?: { color: string; size: number } | null; onink?: (ink: Ink) => void } = $props();

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D | null = null;
/** 描いているポインタ。描くのは 1 本だけ */
let pointer: number | null = null;
let kind = '';
/** 一度ペンが触れたら指では描かない（Pencil を持つ手のひらが線になる） */
let penSeen = false;
let last: [number, number] = [0, 0];
/** 送っていない点。1 フレームぶんをまとめて送る */
let pending: number[] = [];
/** 前に描いた線。足された点だけを描き足すのに使う */
let drawn: Stroke[] = [];

function add(x: number, y: number) {
  // 描く時間が終わっても指を置いたままだと、自分の絵にだけ線が足されてほかの人の絵と食い違う
  if (!pen) return;
  if (Math.hypot(x - last[0], y - last[1]) < 0.003) return;
  last = [x, y];
  pending.push(x, y);
}

function flush() {
  if (pending.length && pen) onink?.({ k: 'add', pts: pending });
  pending = [];
}

const input = new BoardInput({
  down: (event, x, y) => {
    if (!pen) return;
    const isPen = event.pointerType === 'pen';
    if (!isPen && penSeen) return;
    if (pointer !== null) {
      if (!isPen || kind === 'pen') return;
      flush();
      onink?.({ k: 'undo' });
    }
    if (isPen) penSeen = true;
    pointer = event.pointerId;
    kind = event.pointerType;
    last = [x, y];
    pending = [];
    onink?.({ k: 'start', color: pen.color, size: pen.size, x, y });
  },
  move: (event) => {
    if (event.pointerId !== pointer) return;
    const events = event.getCoalescedEvents?.() ?? [];
    for (const e of events.length ? events : [event]) add(...input.at(e));
  },
  up: (event, _finger, x, y) => {
    if (event.pointerId !== pointer) return;
    add(x, y);
    flush();
    pointer = null;
  }
});

/** 最後の線に点が足されただけなら、その点だけを描き足す */
function paint(next: Stroke[]) {
  if (!ctx) return;
  const prev = drawn;
  drawn = next;
  const a = prev.at(-1);
  const b = next.at(-1);
  const kept = (n: number) => prev.slice(0, n).every((s, i) => s === next[i]);
  if (
    a &&
    b &&
    next.length === prev.length &&
    kept(prev.length - 1) &&
    b.color === a.color &&
    b.pts[0] === a.pts[0] &&
    b.pts.length >= a.pts.length
  )
    renderTail(ctx, b, a.pts.length / 2);
  else if (b && next.length === prev.length + 1 && kept(prev.length)) renderTail(ctx, b, 0);
  else render(ctx, next);
}

function resize() {
  const [w, h] = input.px(1, 1);
  const dpr = devicePixelRatio || 1;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx = canvas.getContext('2d');
  if (!ctx) return;
  // 大きさを変えると canvas は消えるので、描き足しではなく全部描き直す
  render(ctx, strokes);
  drawn = strokes;
}

$effect(() => {
  // ctx より先に strokes を読む。ctx が無い最初の回に strokes を読まないと、この effect が何も追わなくなる
  const next = strokes;
  paint(next);
});

onMount(() => animate(flush));
```

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori src/lib/board-input.test.ts`
Expected: PASS（`board-input.test.ts` が無ければ oekaki-mori だけ）。`pnpm check` で型の失敗がないこと（`getCoalescedEvents` は lib.dom にある）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/board-input.ts src/lib/games/oekaki-mori/strokes.ts src/lib/games/oekaki-mori/strokes.test.ts src/lib/games/oekaki-mori/Board.svelte src/lib/games/oekaki-mori/Board.svelte.test.ts
git commit -m "Draw smooth curves from every coalesced point, add only the new part of a stroke, and let the pen win over a resting palm"
```

---

### Task 4: 打っている答えを帯に出す

**Files:**

- Modify: `src/lib/games/oekaki-mori/KanaPad.svelte`、`TopBar.svelte`、`Play.svelte`、`OekakiMori.svelte`
- Test: `KanaPad.svelte.test.ts`、`TopBar.svelte.test.ts`、`OekakiMori.svelte.test.ts`

**Interfaces:**

- Consumes: Task 2 の `{ t: 'typing', seat, text }` の知らせ。
- Produces: `KanaPad` の `ontype?: (text: string) => void`（字が変わるたび、送ったあとの空も）。`TopBar` の `typing?: Record<number, string>`。`Play` の `typing: Record<number, string>` と `ontype: (text: string) => void`。

- [ ] **Step 1: 失敗するテストを書く**

`KanaPad.svelte.test.ts` の `show` を `ontype` も渡して返すように直し（`const ontype = vi.fn();` を props に足し、戻り値に `ontype`）、次を足す。

```ts
it('字が変わるたびに ontype を呼び、こたえると空を知らせる', () => {
  const { app, press, ontype } = show();
  press('い');
  press('ぬ');
  press('こたえる');
  expect(ontype.mock.calls.map((c) => c[0])).toEqual(['い', 'いぬ', '']);
  unmount(app);
});
```

`TopBar.svelte.test.ts` に足す。

```ts
it('打っている字を、その人の丸に出す', () => {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(TopBar, { target, props: { view: { ...view, mode: 'egokoro' }, me: 1, typing: { 2: 'りん' } } });
  flushSync();
  const chips = [...target.querySelectorAll('.scores li')];
  expect(chips[1].querySelector('.typing')?.textContent).toBe('りん');
  expect(chips[2].querySelector('.typing')).toBeNull();
  unmount(app);
});
```

`OekakiMori.svelte.test.ts` は Party を直接つながないので、打っている字を持つ処理は `OekakiMori.svelte` から `typing.ts` の純粋な関数に出し、`typing.test.ts`（node）で確かめる。

```ts
import { describe, expect, it } from 'vitest';
import { typed } from './typing';

describe('typed', () => {
  it('知らせの字をその人の欄に入れ、空の字なら欄を消す', () => {
    expect(typed({}, 2, 'り')).toEqual({ 2: 'り' });
    expect(typed({ 2: 'り', 3: '●' }, 2, '')).toEqual({ 3: '●' });
  });
});
```

番が変わったら全部消すのは `show()` の中で `typing = {}` とする（Step 3）。

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/KanaPad.svelte.test.ts src/lib/games/oekaki-mori/TopBar.svelte.test.ts src/lib/games/oekaki-mori/typing.test.ts`
Expected: FAIL（`ontype` が呼ばれない、`.typing` が無い、`./typing` が無い）。

- [ ] **Step 3: 実装する**

`typing.ts` を作る。

```ts
/** 人ごとの打っている字に、届いた知らせを入れる。空の字（送った・消した）ならその人の欄を消す */
export function typed(all: Record<number, string>, seat: number, text: string): Record<number, string> {
  const next = { ...all };
  if (text) next[seat] = text;
  else delete next[seat];
  return next;
}
```

`KanaPad.svelte` は props に `ontype` を足し、字を変える所をすべて `set()` に通す。

```ts
let {
  disabled = false,
  onsubmit,
  ontype
}: { disabled?: boolean; onsubmit: (text: string) => void; ontype?: (text: string) => void } = $props();
const set = (next: string) => {
  text = next;
  ontype?.(next);
};
const put = (ch: string) => {
  if (!disabled && text.length < MAX) set(text + ch);
};
const turn = () => {
  if (!disabled && text) set(text.slice(0, -1) + cycle(text.slice(-1)));
};
function send() {
  if (disabled || !text) return;
  onsubmit(text);
  set('');
}
```

「1じ けす」の `onclick` は `() => set(text.slice(0, -1))` にする。

`TopBar.svelte` は props に `typing = {}` を足し、`{view.scores[seat]}` の次に `{#if typing[seat]}<span class="typing">{typing[seat]}</span>{/if}` を置く。style に足す。

```css
.typing {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 6px;
  background: #fff;
  letter-spacing: 0.08em;
}

.typing::after {
  content: '▍';
  animation: blink 1s steps(1) infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing::after {
    animation: none;
  }
}
```

`Play.svelte` は props に `typing: Record<number, string>` と `ontype: (text: string) => void` を足し、`<TopBar {view} {me} {typing} />`、`<KanaPad ... ontype={(text) => ontype(text)} />` とする。

`OekakiMori.svelte` は `import { typed } from './typing';` と `let typing = $state.raw<Record<number, string>>({});` を足す。`receive` に `else if (m.t === 'typing') typing = typed(typing, Number(m.seat), String(m.text));` を足す。`show()` の `if (prev && next.turn !== prev.turn) {` の中に `typing = {};` を足す。`<Play ...>` に `{typing} ontype={(text) => party?.act({ t: 'typing', text })}` を足す。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori`
Expected: PASS。`PlayHarness.svelte` が Play の必須 props 不足で型の失敗になるなら、`typing={{}} ontype={() => {}}` を足す（`pnpm check` で確かめる）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori
git commit -m "Show what each guesser is typing on the score bar: the words for the drawer, dots for everyone else"
```

---

### Task 5: ≡ のメニュー、ぬけるときの確かめ、呼び直しと戻った子への送り直し

**Files:**

- Create: `src/lib/games/oekaki-mori/Menu.svelte`、`Menu.svelte.test.ts`
- Create: `src/lib/games/oekaki-mori/Invite.svelte`
- Create: `src/lib/games/oekaki-mori/sync.ts`、`sync.test.ts`
- Modify: `src/lib/games/oekaki-mori/OekakiMori.svelte`、`Together.svelte`、`Together.svelte.test.ts`、`OekakiMori.svelte.test.ts`

**Interfaces:**

- Consumes: Task 1 の `party.away` と `{ t: 'join' }`。
- Produces: `Menu` の props `{ party: Party; oninvite: () => void }`。`Invite` の props `{ party: Party; open: boolean (bindable) }`。`sync.ts` の `catchUp(screen, strokes, gallery): Message`（戻った子へ送る 1 通）。

- [ ] **Step 1: 失敗するテストを書く**

`sync.test.ts`（node）を作る。

```ts
import { describe, expect, it } from 'vitest';
import { catchUp } from './sync';

describe('catchUp', () => {
  it('遊んでいるあいだは、いまの絵とこれまでの絵を送る', () => {
    const strokes = [{ color: '#000', size: 0.01, pts: [0, 0] }];
    expect(catchUp('play', strokes, [])).toEqual({ t: 'sync', strokes, gallery: [] });
  });

  it('ほかの画面では、その画面を知らせる', () => {
    expect(catchUp('mode', [], [])).toEqual({ t: 'screen', screen: 'mode' });
  });
});
```

`Menu.svelte.test.ts`（dom）を作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Party } from '$lib/net/party.svelte';
import Menu from './Menu.svelte';

const nav = vi.hoisted(() => ({ goto: vi.fn() }));
vi.mock('$app/navigation', () => nav);
vi.mock('$lib/audio.svelte', () => ({ audio: { muted: false }, toggleMute: () => {} }));

function show(host: boolean) {
  const party = { host, members: [1, 2], close: vi.fn() } as unknown as Party;
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Menu, { target, props: { party, oninvite: () => {} } });
  flushSync();
  const press = (label: string) => {
    [...target.querySelectorAll('button')].find((b) => b.textContent?.includes(label))!.click();
    flushSync();
  };
  return { app, target, party, press };
}

describe('Menu', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
  });

  // 押し間違いで抜けるとつながりが切れるので、確かめてから抜ける
  it('ぬける… で確かめを出し、ぬけるを押したときだけ閉じて一覧へ戻る', () => {
    const { app, target, party, press } = show(true);
    target.querySelector<HTMLButtonElement>('button[aria-label="メニュー"]')!.click();
    flushSync();
    press('ぬける…');
    expect(target.textContent).toContain('みんなの あそびが おわるよ');
    press('もどる');
    expect(party.close).not.toHaveBeenCalled();
    press('ぬける…');
    press('ぬける');
    expect(party.close).toHaveBeenCalled();
    expect(nav.goto).toHaveBeenCalled();
    unmount(app);
  });

  it('子の確かめは、親が呼び直せることを知らせる', () => {
    const { app, target, press } = show(false);
    target.querySelector<HTMLButtonElement>('button[aria-label="メニュー"]')!.click();
    flushSync();
    press('ぬける…');
    expect(target.textContent).toContain('おやが よびなおせるよ');
    unmount(app);
  });
});
```

`press('ぬける')` は「ぬける…」にも当たるので、確かめのシートの中の「ぬける」ボタンには `class="leave"` を付け、テストでは `target.querySelector<HTMLButtonElement>('.confirm .leave')!.click()` で押す（上の `press('ぬける')` をこれに置きかえる）。

`Together.svelte.test.ts` に、戻った子へ線画と色（と、できた！のあとなら `finished`）を送るテストを足す。`soloHost()` の `onAct` に届く `{ t: 'join' }` を `act` で起こせるよう、`soloHost` の戻り値に `join: (seat: Seat) => acts.forEach((l) => l({ t: 'join' }, seat))` を足し、`tell` は `sent` に `[to, m]` で積むように直す（既存のテストは `sent.map(([, m]) => m)` で読む）。

```ts
it('戻った子に、いまの線画と塗った色を送り、できた！のあとならそれも送る', async () => {
  const party = soloHost();
  const { app, target } = show(party);
  // 親がテンプレートを選んで配り、1 か所塗って「できた！」を押す
  pick(target);
  await settle();
  party.act({ t: 'paint', region: 1, color: '#f00' });
  await settle();
  pressDone(target);
  await settle();
  sent.length = 0;
  party.join(2);
  await settle();
  const toTwo = sent.filter(([to]) => to === 2).map(([, m]) => m.t);
  expect(toTwo).toEqual(['art', 'painted', 'finished']);
  unmount(app);
});
```

`show` / `pick` / `pressDone` は `Together.svelte.test.ts` にある手順（テンプレートを押す・「できた！」を押す）をそのまま使う。無ければ、既存のテストで同じ操作をしている行を関数に出す。

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/sync.test.ts src/lib/games/oekaki-mori/Menu.svelte.test.ts src/lib/games/oekaki-mori/Together.svelte.test.ts`
Expected: FAIL（`./sync` と `Menu.svelte` が無い、Together が join に答えない）。

- [ ] **Step 3: 実装する**

`sync.ts` を作る。

```ts
import type { Message } from '$lib/net/link';
import type { Drawing } from './Result.svelte';
import type { Stroke } from './strokes';

export type Screen = 'lobby' | 'mode' | 'play' | 'result' | 'together';

/**
 * 戻った子（途中から来た子）へ最初に送る 1 通。遊びの見え方は審判が送り直すので、ここでは絵だけを送る。
 * みんなでぬりえは Together が線画と色を送る
 */
export function catchUp(screen: Screen, strokes: Stroke[], gallery: Drawing[]): Message {
  if (screen === 'play' || screen === 'result') return { t: 'sync', strokes, gallery };
  return { t: 'screen', screen };
}
```

`Menu.svelte` を作る。

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { audio, toggleMute } from '$lib/audio.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import type { Party } from '$lib/net/party.svelte';

  let { party, oninvite }: { party: Party; oninvite: () => void } = $props();

  let open = $state(false);
  let asking = $state(false);

  function leave() {
    party.close();
    void goto(resolve('/'));
  }
</script>

<button class="round menu" aria-label="メニュー" aria-expanded={open} onclick={() => (open = !open)}>
  <Icon name="menu" size="26px" />
</button>
{#if open}
  <div class="sheet" role="dialog" aria-label="メニュー">
    {#if asking}
      <div class="confirm">
        <p>{party.host ? 'ぬけると みんなの あそびが おわるよ' : 'ぬけても おやが よびなおせるよ'}</p>
        <div class="row">
          <button class="pill" onclick={() => (asking = false)}>もどる</button>
          <button class="pill p2 leave" onclick={leave}>ぬける</button>
        </div>
      </div>
    {:else}
      <button class="pill" aria-pressed={audio.muted} onclick={toggleMute}>
        <Icon name={audio.muted ? 'mute' : 'speaker'} size="22px" />
        {audio.muted ? 'おとを だす' : 'おとを けす'}
      </button>
      {#if party.host && party.members.length < 3}
        <button
          class="pill"
          onclick={() => {
            open = false;
            oninvite();
          }}>なかまを よぶ</button
        >
      {/if}
      <button class="pill" onclick={() => (asking = true)}>ぬける…</button>
      <button class="pill gold" onclick={() => (open = false)}>とじる</button>
    {/if}
  </div>
{/if}

<style>
  .menu {
    position: absolute;
    top: max(10px, env(safe-area-inset-top));
    right: max(10px, env(safe-area-inset-right));
    z-index: 5;
  }

  .sheet {
    position: absolute;
    top: calc(max(10px, env(safe-area-inset-top)) + 64px);
    right: max(10px, env(safe-area-inset-right));
    z-index: 5;
    display: grid;
    gap: 10px;
    min-width: min(280px, 80cqw);
    padding: 16px;
    border: 3px solid var(--line);
    border-radius: 18px;
    background: var(--paper);
    box-shadow: var(--soft-shadow);
    color: var(--line);
    font-weight: 800;
    text-align: center;
  }

  .row {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .row .pill {
    flex: 1;
  }
</style>
```

`src/lib/icons.ts` に三本線の `menu` を足す（`undo` と同じ線の形式）。

```ts
  menu: [{ d: 'M5 7h14M5 12h14M5 17h14', stroke: INK, width: 2.4 }],
```

`Invite.svelte` を作る。

```svelte
<script lang="ts">
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Party } from '$lib/net/party.svelte';

  let { party, open = $bindable(false) }: { party: Party; open?: boolean } = $props();
  let failed = $state('');
</script>

{#if open}
  <!-- 遊びは止めずに、上に重ねて QR の手順を出す -->
  <div class="invite">
    <Handshake
      role="host"
      onlink={(link) => {
        party.add(link);
        open = false;
      }}
      onfail={(text) => (failed = text)}
    />
    {#if failed}<p role="alert">{failed}</p>{/if}
    <button
      class="pill"
      onclick={() => {
        open = false;
        failed = '';
      }}>とじる</button
    >
  </div>
{:else if party.away.length}
  <p class="lost" role="status">
    {party.away.map((s) => `${s}P`).join('と')} の つながりが きれました
    <button class="pill p2" onclick={() => (open = true)}>よびなおす</button>
  </p>
{/if}

<style>
  .invite {
    position: absolute;
    inset: 0;
    z-index: 6;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 16px;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 800;
    text-align: center;
  }

  .lost {
    position: absolute;
    top: calc(max(10px, env(safe-area-inset-top)) + 64px);
    left: 50%;
    translate: -50% 0;
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 8px 6px 16px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: var(--pastel-p2);
    color: var(--line);
    font-weight: 800;
    white-space: nowrap;
  }
</style>
```

`OekakiMori.svelte` を直す。

1. `Practice` の import と画面を消す（Task 6 で `Practice.svelte` を消す）。`screen` の型から `'practice'` を外し、`import type { Screen } from './sync';` の `Screen` を使う。
2. `import { catchUp } from './sync';`、`import Menu from './Menu.svelte';`、`import Invite from './Invite.svelte';`、`let inviting = $state(false);` を足す。
3. `joined(next)` の中で、親なら戻った子に追いつかせる。

```ts
if (next.host)
  next.onAct((m, from) => {
    if (m.t === 'join') next.tell(from, catchUp(screen, strokes, gallery));
  });
```

4. `receive` に `sync` を足す。

```ts
    else if (m.t === 'sync') {
      strokes = m.strokes as Stroke[];
      gallery = m.gallery as Drawing[];
    }
```

5. 画面の末尾の ✕ とミュートを、つながる前だけにし、つながったあとは `Menu` と（親なら）`Invite` を出す。

```svelte
{#if party}
  <Menu {party} oninvite={() => (inviting = true)} />
  {#if party.host}<Invite {party} bind:open={inviting} />{/if}
{:else}
  <a class="round back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
  <button class="round mute" onclick={toggleMute} aria-label="ミュート" aria-pressed={audio.muted}>
    <Icon name={audio.muted ? 'mute' : 'speaker'} size="26px" />
  </button>
{/if}
```

`TopBar` の右上に遊んでいる最中の「≡」が重なるので、`TopBar.svelte` の `.bar` の右の余白を `padding: max(8px, env(safe-area-inset-top)) 72px 8px 12px;` にする。

`Together.svelte` の親の `onAct` の中の先頭に足す。

```ts
if (m.t === 'join') return catchUpGuest(from);
```

`Together.svelte` の `<script>` に足す。

```ts
/** 戻った子（途中から来た子）に、いまの線画と塗った色を送る。「できた！」のあとならそれも送る */
async function catchUpGuest(seat: Seat) {
  const s = sheet;
  if (!s) return;
  party.tell(seat, { t: 'art', template: s.template ?? null, lines: await encodeLines(s.mask) });
  for (const [region, color] of Object.entries(colors))
    party.tell(seat, { t: 'painted', region: Number(region), color });
  if (closed) party.tell(seat, { t: 'finished' });
}
```

`Seat` の import を `import type { Party, Seat } from '$lib/net/party.svelte';` にする。`OekakiMori` の `catchUp('together', …)` は `{ t: 'screen', screen: 'together' }` を先に送り、子の画面に Together が出てから `art` が届く。`painted` を 1 通ずつ送るのは、`receive` がそれを順に色の表に入れる口をすでに持つため。色の数は多くても数百で、DataChannel の 1 通あたりの大きさの上限には届かない。

`OekakiMori.svelte.test.ts` の「ロビーにミュートのボタンがある」はそのまま通る（つながる前）。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori && pnpm check && pnpm lint`
Expected: PASS、型と lint の失敗なし。`OekakiMori.svelte` が 200 行以上になったら、`receive` と `show` を `screen.svelte.ts` のクラスに出す。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori src/lib/icons.ts
git commit -m "Hide leaving behind a menu with a confirmation, let the host call a dropped player back, and catch the returning device up"
```

---

### Task 6: ロビーと遊び方選びをカードにし、ひとりで れんしゅうを外す

**Files:**

- Modify: `src/lib/games/oekaki-mori/Lobby.svelte`、`ModeSelect.svelte`、`OekakiMori.svelte`、`Howto.svelte`（れんしゅうに触れていれば）
- Delete: `src/lib/games/oekaki-mori/Practice.svelte`
- Modify: `scripts/thumbs/scenes.ts`（oekaki-mori の場面を外す）
- Modify: `CLAUDE.md`（おえかきのもりの段落）
- Test: `src/lib/games/oekaki-mori/Lobby.svelte.test.ts`（新）

**Interfaces:**

- Consumes: Task 5 の `Menu`（なかまを よぶ）。
- Produces: `Lobby` の props は `{ party: Party | null; note?: string; retry?: boolean; onparty; onstart }`（`onpractice` を外し、切れた子のための `retry` を足す）。`ModeSelect` の props は `{ party; onpick }`（`onlobby` を外す）。

- [ ] **Step 1: 失敗するテストを書く**

`Lobby.svelte.test.ts` を作る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Lobby from './Lobby.svelte';

vi.mock('$lib/net/Handshake.svelte', async () => ({ default: (await import('./test/SheetStub.svelte')).default }));

function show(props: Record<string, unknown> = {}) {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Lobby, { target, props: { party: null, onparty: () => {}, onstart: () => {}, ...props } });
  flushSync();
  return { app, target };
}

describe('Lobby', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('よぶ・はいるのカードと、ひとりで ぬりえへの入り口を出し、れんしゅうは出さない', () => {
    const { app, target } = show();
    expect(target.textContent).toContain('なかまを よぶ');
    expect(target.textContent).toContain('なかまに はいる');
    expect(target.querySelector('a[href$="/games/nurie"]')?.textContent).toContain('ひとりで ぬりえ');
    expect(target.textContent).not.toContain('れんしゅう');
    unmount(app);
  });

  it('つながりが切れた子には、もういちど つなぐ を出す', () => {
    const { app, target } = show({ retry: true, note: 'つながりが きれました' });
    expect(target.textContent).toContain('もういちど つなぐ');
    unmount(app);
  });
});
```

`SheetStub.svelte` が props を受けない空の部品でなければ、`test/HandshakeStub.svelte`（中身は `<p>qr</p>`）を作って使う。

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/Lobby.svelte.test.ts`
Expected: FAIL（「なかまに はいる」「ひとりで ぬりえ」「もういちど つなぐ」が無い、れんしゅうがある）。

- [ ] **Step 3: 実装する**

`Lobby.svelte` のつながる前（`{:else if !party}`）を次にする。

```svelte
  {:else if !party}
    {#if retry}
      <p role="alert">{note}</p>
      <button class="pill p2 card" onclick={() => join('guest')}>
        もういちど つなぐ
        <small>おやに QR を だしてもらってね</small>
      </button>
    {:else}
      <p>2〜3にんで、ひとり 1だいずつ つかって あそぶよ</p>
      <button class="pill p1 card" onclick={() => join('host')}>
        なかまを よぶ
        <small>この たんまつに QR が でる</small>
      </button>
      <button class="pill p2 card" onclick={() => join('guest')}>
        なかまに はいる
        <small>おやの QR を よみとる</small>
      </button>
    {/if}
    <a class="pill solo" href={resolve('/games/[id]', { id: 'nurie' })}>ひとりで ぬりえ</a>
```

`import { resolve } from '$app/paths';` を足す。`{#if failed || note}` の行は `{#if failed || (note && !retry)}` にする。あつまった画面は、顔ぶれを丸で並べる。

```svelte
    <ul class="members">
      {#each [1, 2, 3] as seat (seat)}
        <li class="face p{seat}" class:empty={!party.members.includes(seat as 1 | 2 | 3)}>
          {party.members.includes(seat as 1 | 2 | 3) ? `${seat}P` : '＋'}
        </li>
      {/each}
    </ul>
    <p>あなたは {party.me}P{party.host ? '（おや）' : ''}</p>
    {#if party.host}
      {#if party.members.length < 3}
        <button class="pill" onclick={() => join('host')}>{party.members.length < 2 ? 'なかまを よぶ' : 'もうひとり よぶ'}</button>
      {/if}
      <button class="pill gold card" disabled={party.members.length < 2} onclick={onstart}>あそびを えらぶ</button>
    {:else}
      <p role="status">おやが えらぶのを まってね</p>
    {/if}
```

style に足す（`.pill.practice` の規則があれば消す）。

```css
.card {
  flex-direction: column;
  width: min(420px, 86cqw);
  padding: 18px 16px;
  font-size: clamp(22px, 3.6cqh, 30px);
}

.card small {
  font-size: 0.58em;
  font-weight: 700;
}

.solo {
  margin-top: 12px;
  border-style: dashed;
  background: transparent;
}

.face {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border: 3px solid var(--line);
  border-radius: 50%;
  font-size: 20px;
}

.face.p1 {
  background: var(--pastel-p1);
}

.face.p2 {
  background: var(--pastel-p2);
}

.face.p3 {
  background: var(--pastel-p3);
}

.face.empty {
  border-style: dashed;
  background: transparent;
  color: color-mix(in srgb, var(--line) 50%, transparent);
}
```

`ModeSelect.svelte` は `onlobby` と「なかまを よびなおす」を消し、3 つのボタンにアイコンを付けたカードにする（アイコンは `icons.ts` にある `pencil`（エゴコロクイズ）・`bolt`（はやおし検定）・`brush`（みんなでぬりえ））。

```svelte
<button class="pill gold choice" disabled={party.members.length < 2} onclick={() => onpick('egokoro')}>
  <Icon name="pencil" size="34px" />
  <span>エゴコロクイズ<small>ひとりが かいて、みんなで こたえを うつ</small></span>
</button>
```

`.choice` を横並び（`flex-direction: row; gap: 14px; text-align: left; width: min(460px, 88cqw);`）にし、`span` は `display: grid;` にする。

`OekakiMori.svelte` は `Lobby` に `retry={lostOnce}` を渡す（`let lostOnce = $state(false);` を足し、`party.lost` の effect で `lostOnce = true`、`joined()` で `false`）。`ModeSelect` の `onlobby` を外す。`Practice.svelte` を消す。`Howto.svelte` にれんしゅうの文があれば消す。

`scripts/thumbs/scenes.ts` の `id: 'oekaki-mori'` の場面をまるごと消す（一覧の絵は今の `static/thumbs/oekaki-mori.webp` のまま使う）。使われなくなった手助けの関数（`circle` など）が lint で未使用になれば、ほかの場面で使っていないものだけ消す。

`CLAUDE.md` のおえかきのもりの段落の最後の文「ロビーの「ひとりで れんしゅう」は 1 台で描いてみる画面で、一覧の絵もここで撮る。」を、次に置きかえる。

「つながる前のロビーは「なかまを よぶ」「なかまに はいる」と、今のぬりえを開く「ひとりで ぬりえ」を出す。つながったあとは ✕ を出さず、右上の「≡」（`Menu.svelte`）から確かめてから抜ける。親は切れた子の番号を覚え（`Party.away`）、上に「よびなおす」（`Invite.svelte`）を出し、同じ番号で迎え直す。戻った子には `sync.ts` の `catchUp` で絵を送り、審判が見え方を送り直す（ルールでは `rejoin`。点数は引き継ぎ、抜けたときに消えた描く番は戻さない）。エゴコロクイズでは当てる人の打っている字を、描く人にはそのまま、ほかの当てる人には字数だけ（●）で上の帯に出す（`typing.ts`）。盤面は `getCoalescedEvents()` の間の点まで拾って中点を通る曲線で描き足し（`strokes.ts` の `renderTail`）、ペンが触れたら指の線を取り消し、そのあとは指で描かない。一覧の絵は `static/thumbs/oekaki-mori.webp` をそのまま使う。」

同じ段落の「ロビー・遊び方選び・遊ぶ・結果の画面をゲームが持つ」はそのまま残す。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm verify`
Expected: 全部 PASS（`Lobby` の 200 行未満、markuplint、vitals も）。

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/games/oekaki-mori scripts/thumbs/scenes.ts CLAUDE.md
git commit -m "Turn the おえかきのもり lobby and mode picker into cards, add a solo coloring entry, drop practice, and offer reconnecting to a dropped guest"
```

---

### Task 7: 通しで確かめて出す

**Files:**

- Scratch only（`$SCRATCHPAD/party-play.mjs` と `$SCRATCHPAD/net-play.mjs` を直して使う。リポジトリには入れない）

- [ ] **Step 1: 3 ページの通し**

`pnpm dev` を別に立て（Bash の background）、scratchpad の `party-play.mjs`（3 ページ + 偽カメラ）を、ロビーのカードの文言（「なかまを よぶ」「なかまに はいる」「あそびを えらぶ」）に合わせて直す。次を撮る。

- エゴコロクイズで 2P が「りん」まで打ったときの、1P（描く人）と 3P の上の帯（1P は「りん」、3P は「●●」）。
- 描いている途中で 2P のページを閉じ、1P に「2P の つながりが きれました」が出ること。「よびなおす」から新しいページで QR を渡し、同じ 2P として戻り、上の帯の点数が前のままであること。
- 2P が「≡」から「ぬける…」を押したときの確かめの画面。

Expected: 3 枚とも期待どおり。ずれがあれば superpowers:systematic-debugging で原因を探し、テストを足して直す。

- [ ] **Step 2: WebKit でペンの線**

playwright の `webkit` で `Board` を 1 枚出し（`/asobibako/@fs<abs>/src/lib/games/oekaki-mori/test/BoardHarness.svelte` を読む試験ページか、エゴコロクイズの描く画面）、`pointerType: 'pen'` の down → 20 回の move → up を送って撮る。線が曲線で途切れずに描けること。

- [ ] **Step 3: 見直しと出す**

superpowers:executing-plans の Final Review（新しい係で全体を見直す）を通し、Critical と Important を直してから、`mcp__ccd_host__sync_with_base_branch` で main を取り込み、`pnpm verify` を通して `git push origin HEAD:main` と `git push origin HEAD` をする。`gh run watch` で deploy と CI の成功を確かめる。
