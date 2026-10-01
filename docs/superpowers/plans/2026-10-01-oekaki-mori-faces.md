# おえかきのもりの動物・保存・長さ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 版ちがいの知らせ、みんなでぬりえの戻りの取りこぼしの修正、動物のアイコン、結果の 1 枚保存、遊ぶ長さの選択を入れる。

**Architecture:** 子の最初の知らせ `hello` に、つなぎ方の版（`PROTOCOL`）と動物を載せる。親は版を確かめ、動物を `Party.looks` に持って `members` と一緒に配る。画面は番号のかわりに `Face.svelte` と `who()` で動物を出す。長さは `engine.ts` の表で、描く順番の回数と描く時間を決める。結果の 1 枚は `album.ts` が canvas に描いて `saveImage` に渡す。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、vitest（node の unit と happy-dom の dom）、WebRTC DataChannel（`src/lib/net/`）。

**Spec:** `docs/superpowers/specs/2026-10-01-oekaki-mori-faces-design.md`

## Global Constraints

- コンポーネントは 200 行未満（`architecture/component-size`、抑制コメントは使わない）。
- コメントは非自明な WHY だけ。変更履歴やタスク番号は書かない。
- 絵文字は使わない。アイコンは `src/lib/icons.ts` と `Icon.svelte`（canvas では `fx.ts` の `icon()`）。
- localStorage の保存名は `asobibako:` で始める。好みだけの保存名は `src/lib/backup.ts` の `NOT_RECORDS` に入れる（記録ありに数えない）。
- 画面の文字はひらがな中心。
- `pnpm verify`（lint / check / test:run / vitals / build）が通ること。
- commit の末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。

## Review Focus

- 版ちがいで断ったあと、親のロビーに誰もいない Party が残り「あそびを えらぶ」へ進めてしまう。Task 1 のテストで、最初の子を断ったときは Party を作らず、知らせを出すことを固める。
- 古い版の子が来て `hello` が来ないまま待ち続ける。Task 1 のテストで、3 秒で見切って `mismatch` を返すことを固める。
- 動物の保存名が「記録あり」に数えられ、localStorage が消えたあとの起動で控えから戻らない。Task 3 のテストで `hasRecords()` が動物と長さだけでは false のままであることを固める。
- 戻った子の画面で、切れる前の番号の人の動物が出ない（`looks` が届かない）。Task 1 のテストで、`members` と一緒に `looks` が届くことを固める。
- みんなでぬりえで、親が絵を配る前に戻った子が「おやが えを えらんでいます…」のまま止まる。Task 4 のテストで、配り終えたあとに線画が届くことを固める。

---

### Task 1: つなぎ方の版と動物を hello で受け渡す

**Files:**

- Modify: `src/lib/net/party.svelte.ts`、`src/lib/games/oekaki-mori/Lobby.svelte`、`Invite.svelte`、`OekakiMori.svelte`
- Test: `src/lib/net/party.svelte.test.ts`

**Interfaces:**

- Produces: `PROTOCOL = 3`、`MISMATCH`（知らせの文）、`Party.host(look?: string)`、`Party.guest(pipe, hello?: { was?: Seat; look?: string })`、`add(pipe): Promise<Seat | null | 'mismatch'>`、`Party.looks: Record<number, string>`、`Party.mismatch: boolean`。`members` の知らせは `{ t: 'members', members, looks }`。

- [ ] **Step 1: 失敗するテストを書く**

`party.svelte.test.ts` の import を `import { MISMATCH, Party, PROTOCOL, type Pipe, type Seat } from './party.svelte';` にし、`vi` を vitest の import に足す。`Party.guest(c2, 3)` の呼び出しを `Party.guest(c2, { was: 3 })`、`Party.guest(d2, 2)` を `Party.guest(d2, { was: 2 })` にする。末尾に足す。

```ts
// 古い版の子は知らせの形がちがうので、つないでも遊べない。理由を出して切る
it('つなぎ方の版がちがう子は断り、mismatch を返して知らせる', async () => {
  const host = Party.host();
  const [a, a2] = pipes();
  const seen: Message[] = [];
  a2.on((m) => seen.push(m));
  a2.send({ t: 'hello', v: PROTOCOL - 1, was: null, look: null });
  expect(await host.add(a)).toBe('mismatch');
  expect(seen).toContainEqual({ t: 'mismatch' });
  expect(host.members).toEqual([1]);
});

it('hello を送らない古い版の子は、3 秒で見切る', async () => {
  vi.useFakeTimers();
  const host = Party.host();
  const [a] = pipes();
  const result = host.add(a);
  vi.advanceTimersByTime(3000);
  expect(await result).toBe('mismatch');
  vi.useRealTimers();
});

it('子は mismatch を受け取ったら mismatch を立てる', () => {
  const [a, a2] = pipes();
  const g = Party.guest(a2);
  a.send({ t: 'mismatch' });
  expect(g.mismatch).toBe(true);
  expect(MISMATCH).toContain('さいしん');
});

it('動物を hello で受け取り、顔ぶれと一緒に全員へ配る', async () => {
  const host = Party.host('cat');
  const [a, a2] = pipes();
  const g = Party.guest(a2, { look: 'rabbit' });
  await host.add(a);
  expect(host.looks).toEqual({ 1: 'cat', 2: 'rabbit' });
  expect(g.looks).toEqual({ 1: 'cat', 2: 'rabbit' });
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/net/party.svelte.test.ts`
Expected: 新しい 4 つが FAIL（`PROTOCOL` / `MISMATCH` が無い、`looks` / `mismatch` が無い）。

- [ ] **Step 3: 実装する**

`party.svelte.ts` に足す（class の外）。

```ts
/** 端末どうしの知らせの形の版。形を変えたら 1 上げる。アプリの版とは別なので、ほかのゲームを直しただけでは更新を求めない */
export const PROTOCOL = 3;
export const MISMATCH = 'アプリの はんが ちがうよ。どちらも さいしんに してね';
/** 子の hello を待つ長さ。古い版の子は hello を送らない */
const HELLO_MS = 3000;
```

class に足す。

```ts
/** 番号 → 動物。親が持ち、顔ぶれと一緒に配る */
looks = $state<Record<number, string>>({});
/** 子で、親とつなぎ方の版がちがった */
mismatch = $state(false);
```

`static host()` を `static host(look?: string): Party` にし、`look` があれば `party.looks = { 1: look }` を入れて返す。

`static guest` を次にする。

```ts
  /** was は切れる前の番号、look は動物。親は was が切れたまま空いていれば同じ番号で迎える */
  static guest(pipe: Pipe, hello: { was?: Seat; look?: string } = {}): Party {
    const party = new Party(false);
    party.#pipes.set(1, pipe);
    pipe.on((message) => {
      if (message.t === 'seat') party.me = message.seat as Seat;
      else if (message.t === 'members') {
        party.members = message.members as Seat[];
        party.looks = (message.looks ?? {}) as Record<number, string>;
      } else if (message.t === 'mismatch') party.mismatch = true;
      else for (const listener of party.#tells) listener(message);
    });
    pipe.closed.then(() => (party.lost = true));
    pipe.send({ t: 'hello', v: PROTOCOL, was: hello.was ?? null, look: hello.look ?? null });
    return party;
  }
```

`add()` を次にする。

```ts
  add(pipe: Pipe): Promise<Seat | null | 'mismatch'> {
    if (!this.host || this.#pipes.size >= 2) {
      pipe.close();
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      let greeted = false;
      const refuse = () => {
        greeted = true;
        pipe.send({ t: 'mismatch' });
        pipe.close();
        resolve('mismatch');
      };
      const timer = setTimeout(() => !greeted && refuse(), HELLO_MS);
      // Link はためていた知らせを on の中で渡すので、ここで外すと外す口がまだ無い。hello のあとは聞き流す
      pipe.on((message) => {
        if (greeted || message.t !== 'hello') return;
        clearTimeout(timer);
        if (message.v !== PROTOCOL) return refuse();
        greeted = true;
        resolve(this.#seat(pipe, message.was as Seat | null, message.look as string | null));
      });
      pipe.closed.then(() => {
        clearTimeout(timer);
        resolve(null);
      });
    });
  }
```

`#seat(pipe, was, look)` は番号を決めたあと、`this.#pipes.set(...)` の前に `if (look) this.looks = { ...this.looks, [seat]: look };` を足す。`#setMembers` の送る知らせを `{ t: 'members', members: this.members, looks: this.looks }` にする。`close()` の `this.away = [];` は残し、`looks` は消さない（切れた人の知らせに動物を出すため）。

`Lobby.svelte` の `linked` を次にする（`MISMATCH` を import）。

```ts
async function linked(link: Link) {
  const as = joining;
  joining = null;
  if (as === 'host') {
    const p = party ?? Party.host(look);
    if ((await p.add(link)) === 'mismatch') failed = MISMATCH;
    // 最初の子を断ったら、誰もいない Party でロビーを進めない
    else if (!party) onparty(p);
  } else onparty(Party.guest(link, { was, look }));
}
```

`Lobby` の props に `look?: string` を足す（Task 3 で選べるようにする）。

`Invite.svelte` の `onlink` の型を `(link: Link) => Promise<unknown>` にし、`Handshake` の `onlink` を次にする。

```svelte
onlink={async (link) => {
  if ((await onlink(link)) === 'mismatch') failed = MISMATCH;
  else close();
}}
```

`OekakiMori.svelte` の lost の effect を次にする（`MISMATCH` を import）。

```ts
$effect(() => {
  if (!party?.lost) return;
  // 版ちがいで切られた子は、同じ番号で戻っても遊べないので、もういちど つなぐ を出さない
  was = party.mismatch ? undefined : party.me;
  note = party.mismatch ? MISMATCH : 'つながりが きれました';
  party = null;
  screen = 'lobby';
});
```

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/net src/lib/games/oekaki-mori && pnpm check`
Expected: PASS、型の失敗なし。

- [ ] **Step 5: Commit**

```bash
git add src/lib/net src/lib/games/oekaki-mori
git commit -m "Check the connection protocol version in the guest's hello, refuse mismatched or silent devices with a reason, and carry each device's animal"
```

---

### Task 2: 遊ぶ長さ

**Files:**

- Modify: `src/lib/games/oekaki-mori/engine.ts`、`referee.ts`、`ModeSelect.svelte`、`OekakiMori.svelte`
- Create: `src/lib/games/oekaki-mori/prefs.ts`、`prefs.test.ts`
- Modify: `src/lib/backup.ts`、`src/lib/backup.test.ts`
- Test: `engine.test.ts`

**Interfaces:**

- Produces: `type Length = 'short' | 'normal' | 'long'`、`LENGTHS: Record<Length, { rounds: number; draw: Record<Mode, number> }>`、`create(players, rand, words, mode, length = 'normal')`、`Quiz.length`、`Referee.start(mode, length)`。`prefs.ts` の `LENGTH_KEY`、`LOOK_KEY`、`readLength(): Length`、`saveLength(length)`。

- [ ] **Step 1: 失敗するテストを書く**

`engine.test.ts` の import の `DRAW_S` を `LENGTHS` にし、本文の `DRAW_S.egokoro` を `LENGTHS.normal.draw.egokoro`、`DRAW_S.hayaoshi` を `LENGTHS.normal.draw.hayaoshi` に置きかえる（`sed -i '' 's/DRAW_S\./LENGTHS.normal.draw./g'`）。末尾に足す。

```ts
describe('length', () => {
  it('みじかめは 1 回ずつ 60 秒、ながめは 3 回ずつ 120 秒', () => {
    const short = create([1, 2], fixed, WORDS, 'egokoro', 'short');
    expect(short.order).toEqual([1, 2]);
    go(short);
    expect(short.left).toBe(60);
    const long = create([1, 2], fixed, WORDS, 'hayaoshi', 'long');
    expect(long.order).toEqual([1, 2, 1, 2, 1, 2]);
    go(long);
    expect(long.left).toBe(80);
  });

  // 描く時間が長さで変わるので、はやおしの点は残り秒ではなく描く時間に対する割合で決める
  it('はやおし検定の点は、描く時間の 2/3 以上残っていれば 3 点、1/3 以上なら 2 点', () => {
    const s = create([1, 2], fixed, WORDS, 'hayaoshi', 'long');
    go(s);
    run(s, 80 / 3 + 1);
    buzz(s, 2, fixed, WORDS);
    answer(s, 2, s.options.indexOf(s.word));
    expect(s.scores[2]).toBe(2);
  });
});
```

`prefs.test.ts`（node、`localStorage` は無いので差し替える）を作る。

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LENGTH_KEY, readLength, saveLength } from './prefs';

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v)
});

describe('length prefs', () => {
  beforeEach(() => store.clear());

  it('選んだ長さを覚え、知らない値や無いときは ふつう', () => {
    expect(readLength()).toBe('normal');
    saveLength('short');
    expect(store.get(LENGTH_KEY)).toBe('short');
    expect(readLength()).toBe('short');
    store.set(LENGTH_KEY, 'forever');
    expect(readLength()).toBe('normal');
  });
});
```

`backup.test.ts` の「最近のゲーム・タブ・ミュート・絵柄だけなら記録なしとみなす」に、`localStorage.setItem('asobibako:oekaki-mori:look', 'cat');` と `localStorage.setItem('asobibako:oekaki-mori:length', 'short');` を足す（`hasRecords()` の最初の確かめの前）。

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/engine.test.ts src/lib/games/oekaki-mori/prefs.test.ts src/lib/backup.test.ts`
Expected: `LENGTHS` / `./prefs` が無い失敗と、記録なしのテストの FAIL。

- [ ] **Step 3: 実装する**

`engine.ts` の `DRAW_S` と `ROUNDS` を消し、次を置く。

```ts
export type Length = 'short' | 'normal' | 'long';
/** ひとりが描く回数と描く時間。はやおし検定は早く押すほど点が高く、長く描かせる必要がない */
export const LENGTHS: Record<Length, { rounds: number; draw: Record<Mode, number> }> = {
  short: { rounds: 1, draw: { egokoro: 60, hayaoshi: 45 } },
  normal: { rounds: 2, draw: { egokoro: 90, hayaoshi: 60 } },
  long: { rounds: 3, draw: { egokoro: 120, hayaoshi: 80 } }
};
```

`BUZZ_POINTS` を描く時間に対する割合にする。

```ts
/** はやおし検定で、押したときの描く残り時間が描く時間のこの割合以上ならこの点 */
export const BUZZ_POINTS = [
  [2 / 3, 3],
  [1 / 3, 2],
  [0, 1]
] as const;
```

`Quiz` に `length: Length;` を足す。`create` の引数の最後に `length: Length = 'normal'` を足し、`length,` を入れ、`order: Array.from({ length: LENGTHS[length].rounds }, () => players).flat(),` にする（`length` という名前が `Array.from` の `{ length }` と重なるので、`{ length: LENGTHS[length].rounds }` と明示して書く）。`start` の `s.left = DRAW_S[s.mode];` を `s.left = LENGTHS[s.length].draw[s.mode];` にする。`answer` の点を次にする。

```ts
const ratio = s.buzzedAt / LENGTHS[s.length].draw[s.mode];
s.scores[by] += BUZZ_POINTS.find(([at]) => ratio >= at)![1];
```

`referee.ts` の `start(mode: Mode)` を `start(mode: Mode, length: Length = 'normal')` にし、`create(this.#party.members, Math.random, WORDS, mode, length)` にする（`Length` を import）。

`prefs.ts` を作る。

```ts
import type { Length } from './engine';

export const LENGTH_KEY = 'asobibako:oekaki-mori:length';
export const LOOK_KEY = 'asobibako:oekaki-mori:look';

const LENGTH_IDS: readonly Length[] = ['short', 'normal', 'long'];

/** 前に選んだ遊ぶ長さ。読めないときは ふつう */
export function readLength(): Length {
  try {
    const v = localStorage.getItem(LENGTH_KEY);
    return LENGTH_IDS.find((id) => id === v) ?? 'normal';
  } catch {
    return 'normal';
  }
}

export function saveLength(length: Length): void {
  try {
    localStorage.setItem(LENGTH_KEY, length);
  } catch {
    // 覚えられなくても、選んだ長さで遊べる
  }
}
```

`backup.ts` の `NOT_RECORDS` に `'asobibako:oekaki-mori:look'` と `'asobibako:oekaki-mori:length'` を足し、上のコメントに「おえかきのもりの動物と遊ぶ長さ」も好みとして名前で持つことを足す。

`ModeSelect.svelte` は `length = $bindable<Length>('normal')` を props に足し、見出しの下（親だけ）に置く。

```svelte
    <div class="lengths" role="group" aria-label="ながさ">
      {#each [['short', 'みじかめ'], ['normal', 'ふつう'], ['long', 'ながめ']] as const as [id, name] (id)}
        <button class="pill" aria-pressed={length === id} onclick={() => (length = id)}>{name}</button>
      {/each}
    </div>
```

style に足す。

```css
.lengths {
  display: flex;
  gap: 8px;
}

.lengths [aria-pressed='true'] {
  --face: var(--pastel-gold);
}
```

`OekakiMori.svelte` は `import { readLength, saveLength } from './prefs';`、`let length = $state<Length>(readLength());` を足す。`<ModeSelect {party} onpick={begin} bind:length />` にし、`begin` で `saveLength(length);` のあと `referee.start(mode, length);` にする。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori src/lib/backup.test.ts && pnpm check`
Expected: PASS。既存のはやおしの点のテスト（ふつう）も通る。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori src/lib/backup.ts src/lib/backup.test.ts
git commit -m "Let the host pick a short, normal, or long game, and score はやおし by the share of drawing time left"
```

---

### Task 3: 動物のアイコンで人を表す

**Files:**

- Create: `src/lib/games/oekaki-mori/looks.ts`、`looks.test.ts`、`Face.svelte`
- Modify: `prefs.ts`（動物の読み書き）、`prefs.test.ts`、`src/lib/icons.ts`（`rabbit`）
- Modify: `Lobby.svelte`、`TopBar.svelte`、`Bubbles.svelte`、`Play.svelte`、`Buzzer.svelte`、`Invite.svelte`、`Result.svelte`、`OekakiMori.svelte`
- Test: `TopBar.svelte.test.ts`、`Bubbles.svelte.test.ts`

**Interfaces:**

- Consumes: Task 1 の `Party.host(look)`、`Party.guest(pipe, { was, look })`、`Party.looks`。Task 2 の `LOOK_KEY`。
- Produces: `LOOKS`（`{ id: IconName; name: string }[]`）、`type Look`、`lookOf(id?: string)`、`who(seat, looks): string`、`readLook(rand?): Look`、`saveLook(look)`、`Face.svelte`（props `{ seat: Seat; look?: string; size?: string; name?: boolean }`）。各画面の props に `looks?: Record<number, string>`（既定 `{}`）。

- [ ] **Step 1: 失敗するテストを書く**

`looks.test.ts` を作る。

```ts
import { describe, expect, it } from 'vitest';
import { LOOKS, lookOf, who } from './looks';

describe('looks', () => {
  it('動物は 8 つで、名前はひらがな', () => {
    expect(LOOKS).toHaveLength(8);
    expect(lookOf('rabbit')?.name).toBe('うさぎ');
    expect(lookOf('dragon')).toBeUndefined();
  });

  it('who は動物の名前を返し、届いていない番号には番号を返す', () => {
    expect(who(2, { 2: 'cat' })).toBe('ねこ');
    expect(who(3, { 2: 'cat' })).toBe('3P');
  });
});
```

`prefs.test.ts` に足す（import に `LOOK_KEY, readLook, saveLook`）。

```ts
describe('look prefs', () => {
  beforeEach(() => store.clear());

  it('はじめてはランダムに選んで覚え、知らない名前なら選び直す', () => {
    expect(readLook(() => 0)).toBe('rabbit');
    expect(store.get(LOOK_KEY)).toBe('rabbit');
    saveLook('bear');
    expect(readLook()).toBe('bear');
    store.set(LOOK_KEY, 'dragon');
    expect(readLook(() => 0)).toBe('rabbit');
  });
});
```

`TopBar.svelte.test.ts` に足す。

```ts
it('点数の丸に、番号のかわりに動物の名前を出す', () => {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(TopBar, { target, props: { view, me: 1, looks: { 1: 'cat', 2: 'rabbit' } } });
  flushSync();
  const chips = [...target.querySelectorAll('.scores li')].map((li) => li.textContent);
  expect(chips[0]).toContain('ねこ');
  expect(chips[1]).toContain('うさぎ');
  expect(chips[2]).toContain('3P');
  unmount(app);
});
```

`Bubbles.svelte.test.ts` に足す（既存の mount の書き方に合わせる）。

```ts
it('吹き出しに動物の名前を出す', () => {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Bubbles, { target, props: { bubbles: [{ id: 1, seat: 2, text: 'いぬ' }], looks: { 2: 'cat' } } });
  flushSync();
  expect(target.textContent).toContain('ねこ「いぬ」');
  unmount(app);
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/looks.test.ts src/lib/games/oekaki-mori/prefs.test.ts src/lib/games/oekaki-mori/TopBar.svelte.test.ts src/lib/games/oekaki-mori/Bubbles.svelte.test.ts`
Expected: FAIL（`./looks` が無い、`readLook` が無い、名前が出ない）。

- [ ] **Step 3: 実装する**

`src/lib/icons.ts` の `bee` の前に `rabbit` を足す（`ellipse` / `circle` / `INK` はファイルにある）。

```ts
  rabbit: [
    { d: ellipse(9, 6, 2.2, 5) + ellipse(15, 6, 2.2, 5), fill: '#fff', stroke: INK, width: 0.8 },
    { d: ellipse(9, 6.5, 0.9, 3.4) + ellipse(15, 6.5, 0.9, 3.4), fill: '#ffb3c1' },
    { d: ellipse(12, 15, 7, 6), fill: '#fff', stroke: INK, width: 0.8 },
    { d: circle(9.5, 14, 1.2) + circle(14.5, 14, 1.2), fill: INK },
    { d: ellipse(12, 16.6, 1, 0.7), fill: '#ff8fa3' }
  ],
```

`looks.ts` を作る。

```ts
import type { IconName } from '$lib/icons';
import type { Seat } from '$lib/net/party.svelte';

/** 端末ごとに選ぶ動物。字を打たずに選べるので、小さい子もすぐ自分が分かる */
export const LOOKS = [
  { id: 'rabbit', name: 'うさぎ' },
  { id: 'cat', name: 'ねこ' },
  { id: 'dog', name: 'いぬ' },
  { id: 'bear', name: 'くま' },
  { id: 'mouse', name: 'ねずみ' },
  { id: 'sheep', name: 'ひつじ' },
  { id: 'wolf', name: 'おおかみ' },
  { id: 'bee', name: 'はち' }
] as const satisfies readonly { id: IconName; name: string }[];

export type Look = (typeof LOOKS)[number]['id'];

export const lookOf = (id?: string) => LOOKS.find((look) => look.id === id);

/** 番号の人の動物の名前。動物がまだ届いていない番号は番号で呼ぶ */
export const who = (seat: Seat, looks: Record<number, string>): string => lookOf(looks[seat])?.name ?? `${seat}P`;
```

`prefs.ts` に足す（`import { LOOKS, type Look } from './looks';`）。

```ts
/** この端末の動物。はじめてのときや読めないときは、ランダムに選んで覚える */
export function readLook(rand = Math.random): Look {
  try {
    const found = LOOKS.find((look) => look.id === localStorage.getItem(LOOK_KEY));
    if (found) return found.id;
  } catch {
    // 読めなければ選び直す
  }
  const picked = LOOKS[Math.floor(rand() * LOOKS.length)].id;
  saveLook(picked);
  return picked;
}

export function saveLook(look: Look): void {
  try {
    localStorage.setItem(LOOK_KEY, look);
  } catch {
    // 覚えられなくても、この回は選んだ動物で遊べる
  }
}
```

`Face.svelte` を作る。

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { Seat } from '$lib/net/party.svelte';
  import { lookOf } from './looks';

  let {
    seat,
    look,
    size = '1.5em',
    name = false
  }: { seat: Seat; look?: string; size?: string; name?: boolean } = $props();

  const found = $derived(lookOf(look));
</script>

<!-- 同じ動物を選んだ人どうしも、番号の色の丸で見分ける -->
<span class="face">
  <span class="disc p{seat}" style:width={size} style:height={size}>
    {#if found}<Icon name={found.id} size="80%" />{:else}{seat}P{/if}
  </span>
  {#if name && found}<span>{found.name}</span>{/if}
</span>

<style>
  .face {
    display: inline-flex;
    align-items: center;
    gap: 0.25em;
    vertical-align: middle;
  }

  .disc {
    display: inline-grid;
    place-items: center;
    border: 2px solid var(--line);
    border-radius: 50%;
    font-size: 0.7em;
  }

  .disc.p1 {
    background: var(--pastel-p1);
  }

  .disc.p2 {
    background: var(--pastel-p2);
  }

  .disc.p3 {
    background: var(--pastel-p3);
  }
</style>
```

`Icon.svelte` の `size` が `%` を受けない場合は、`Face` の `size` から em の数を出して渡す（`Icon` の props を読んで合わせる）。

画面を直す（各部品の props に `looks = {}`（型 `Record<number, string>`）を足し、`import Face from './Face.svelte';` と `import { who } from './looks';` を必要な所に足す）。

- `TopBar.svelte` の 12 行目「`${view.drawer}P が じゅんびしています`」を `` `${who(view.drawer, looks)} が じゅんびしています` `` に、31 行目「`{seat}P{seat === me ? '（あなた）' : ''}`」を `<Face {seat} look={looks[seat]} name />{seat === me ? '（あなた）' : ''}` にする。
- `Bubbles.svelte` の吹き出しを ``{b.note ? `${who(b.seat, looks)} ${b.text}` : `${who(b.seat, looks)}「${b.text}」`}`` にする。
- `Play.svelte` は props に `looks` を足し、`<TopBar {view} {me} {typing} {looks} />`、`<Bubbles {bubbles} {looks} />`、`<Buzzer {view} {me} {act} {looks} />`、53 行目を `<p>{who(view.drawer, looks)} が じゅんびしています</p>` にする。
- `Buzzer.svelte` の 33 行目を `<p class="wait" role="status">{who(view.buzzer, looks)} が こたえています</p>` にする。
- `Invite.svelte` は props に `looks` を足し、35 行目を `{away.map((s) => who(s, looks)).join('と')} の つながりが きれました` にする。
- `Result.svelte` は props に `looks` を足し、順位を `{rank(r.points)}い <Face seat={r.seat} look={looks[r.seat]} name />{r.seat === me ? '（あなた）' : ''} {r.points}てん`、絵の下を `<span><Face seat={d.by} look={looks[d.by]} />「{d.word}」</span>` にする。
- `Lobby.svelte` は props に `onlook: (look: Look) => void` を足す。つながる前（`{:else if !party}` の中、カードの上）に動物の列を置く。

```svelte
<div class="looks" role="group" aria-label="あなたの どうぶつ">
  {#each LOOKS as l (l.id)}
    <button class="look" aria-pressed={look === l.id} aria-label={l.name} onclick={() => onlook(l.id)}>
      <Icon name={l.id} size="34px" />
    </button>
  {/each}
</div>
```

あつまった画面の丸を `<li class="face p{seat}" class:empty={!here}>{#if here}<Face {seat} look={party.looks[seat]} size="52px" />{:else}＋{/if}</li>`、「あなたは」の行を `<p>あなたは {who(party.me, party.looks)}{party.host ? '（おや）' : ''}</p>` にする。style に足す。

```css
.looks {
  display: grid;
  grid-template-columns: repeat(4, 52px);
  gap: 8px;
}

.look {
  display: grid;
  place-items: center;
  height: 52px;
  border: 2px solid var(--line);
  border-radius: 14px;
  background: #fff;
}

.look[aria-pressed='true'] {
  background: var(--pastel-gold);
  outline: 3px solid var(--line);
}
```

`Lobby.svelte` が 200 行以上になったら、動物の列を `LookPicker.svelte`（props `{ look; onlook }`）に出す。

- `OekakiMori.svelte` は `import { readLook, saveLook } from './prefs';` と `let look = $state(readLook());` を足し、`<Lobby ... {look} onlook={(l) => { look = l; saveLook(l); }} />`、`<Play ... looks={party.looks} />`、`<Result ... looks={party.looks} />`、`<Invite ... looks={party.looks} />` にする。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori && pnpm check && pnpm lint`
Expected: PASS、型と lint の失敗なし。

- [ ] **Step 5: Commit**

```bash
git add src/lib/icons.ts src/lib/games/oekaki-mori
git commit -m "Let each device pick an animal and show players by animal instead of 1P, 2P, 3P"
```

---

### Task 4: みんなでぬりえで、配り終えてから戻った子に送る

**Files:**

- Create: `src/lib/games/oekaki-mori/catch-up.ts`
- Modify: `Together.svelte`
- Test: `Together.svelte.test.ts`

**Interfaces:**

- Produces: `catchUpTogether(tell: (m: Message) => void, dealt: Promise<Message> | null, colors: () => Record<number, string>, finished: () => boolean): Promise<void>`。

- [ ] **Step 1: 失敗するテストを書く**

`Together.svelte.test.ts` に足す。

```ts
// 親の画面に線画が出る前に戻った子は、配り終えるのを待たないと何も受け取れない
it('配り終える前に戻った子にも、配り終えたあとで線画を送る', async () => {
  const { app, button, party } = show();
  button('りんご')!.click();
  (party as unknown as { join: (seat: Seat) => void }).join(2);
  await settle();
  expect(sentTo.filter(([to]) => to === 2).map(([, m]) => m.t)).toEqual(['art']);
  unmount(app);
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/Together.svelte.test.ts`
Expected: 新しいテストが FAIL（子へ何も送られない）。

- [ ] **Step 3: 実装する**

`catch-up.ts` を作る。

```ts
import type { Message } from '$lib/net/link';

/**
 * みんなでぬりえに戻った子（途中から来た子）へ、線画・塗った色・「できた！」を送る。
 * 線画は配る知らせを作り終えるのを待ってから送る（親の画面に絵が出る前に戻った子も取りこぼさない）。
 * 色は待ったあとで読む。待つあいだに塗られた色も送るため
 */
export async function catchUpTogether(
  tell: (m: Message) => void,
  dealt: Promise<Message> | null,
  colors: () => Record<number, string>,
  finished: () => boolean
): Promise<void> {
  if (!dealt) return;
  tell(await dealt);
  for (const [region, color] of Object.entries(colors())) tell({ t: 'painted', region: +region, color });
  if (finished()) tell({ t: 'finished' });
}
```

`Together.svelte` は `let dealt: Promise<Message> | null = null;` を足し、`send` を次にする。

```ts
async function send(mask: Uint8Array, template?: Template) {
  // 配り終えるまでに別の絵を押されると 2 枚配られ、親の塗り手順と画面の色が食い違うので、すぐ待つ画面にする
  phase = 'wait';
  host = shared();
  dealt = encodeLines(mask).then((lines) => ({ t: 'art', template: template?.id ?? null, lines }));
  party.tell('all', await dealt);
}
```

`catchUpGuest` を消し、`onAct` の中を `if (m.t === 'join') return void catchUpTogether((msg) => party.tell(from, msg), dealt, () => colors, () => closed);` にする（`import { catchUpTogether } from './catch-up';`）。`Seat` の import が使われなくなれば外す。

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/Together.svelte.test.ts`
Expected: PASS（既存の「戻った子に、いまの線画と塗った色を送り、できた！のあとならそれも送る」も通る）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori
git commit -m "Wait for the coloring art to be dealt before catching a returning guest up"
```

---

### Task 5: 結果の絵を 1 枚にまとめて保存する

**Files:**

- Create: `src/lib/games/oekaki-mori/album.ts`、`album.test.ts`
- Modify: `Result.svelte`

**Interfaces:**

- Consumes: Task 3 の `lookOf` と `looks`。
- Produces: `layout(n: number): { width: number; height: number; cells: { x: number; y: number; size: number }[] }`、`album(gallery: Drawing[], ranking: { seat: Seat; points: number; rank: number }[], looks: Record<number, string>): string`（PNG の data URL）。

- [ ] **Step 1: 失敗するテストを書く**

`album.test.ts`（node）を作る。

```ts
import { describe, expect, it } from 'vitest';
import { layout } from './album';

const overlap = (a: { x: number; y: number; size: number }, b: { x: number; y: number; size: number }) =>
  a.x < b.x + b.size && b.x < a.x + a.size && a.y < b.y + b.size && b.y < a.y + a.size;

describe('layout', () => {
  it('3 枚以下は 1 列、4 枚からは 2 列で、重ならずに画像の中に並べる', () => {
    expect(new Set(layout(3).cells.map((c) => c.x)).size).toBe(1);
    expect(new Set(layout(4).cells.map((c) => c.x)).size).toBe(2);
    for (const n of [1, 2, 3, 4, 6, 9]) {
      const { width, height, cells } = layout(n);
      expect(cells).toHaveLength(n);
      for (const c of cells) {
        expect(c.x + c.size).toBeLessThanOrEqual(width);
        expect(c.y + c.size).toBeLessThanOrEqual(height);
      }
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(cells[i], cells[j])).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 失敗を見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori/album.test.ts`
Expected: FAIL（`./album` が無い）。

- [ ] **Step 3: 実装する**

`album.ts` を作る。

```ts
import { icon } from '$lib/fx';
import type { Seat } from '$lib/net/party.svelte';
import { lookOf } from './looks';
import type { Drawing } from './Result.svelte';
import { render } from './strokes';

const WIDTH = 1080;
const PAD = 48;
const GAP = 32;
/** 上の見出しと順位の高さ */
const HEAD = 300;
/** 絵の下のお題と描いた人の高さ */
const CAPTION = 64;
const COLORS: Record<number, string> = { 1: '#cfe6ff', 2: '#ffd6dc', 3: '#d4f2d9' };

/** 絵の数に合わせた画像の大きさと、絵を置く位置（3 枚以下は 1 列、4 枚からは 2 列） */
export function layout(n: number): { width: number; height: number; cells: { x: number; y: number; size: number }[] } {
  const cols = n <= 3 ? 1 : 2;
  const size = (WIDTH - PAD * 2 - GAP * (cols - 1)) / cols;
  const rows = Math.ceil(n / cols);
  const cells = Array.from({ length: n }, (_, i) => ({
    x: PAD + (i % cols) * (size + GAP),
    y: HEAD + Math.floor(i / cols) * (size + CAPTION + GAP),
    size
  }));
  return { width: WIDTH, height: HEAD + rows * (size + CAPTION + GAP) + PAD, cells };
}

function face(ctx: CanvasRenderingContext2D, seat: Seat, look: string | undefined, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = COLORS[seat];
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#5b4636';
  ctx.stroke();
  const found = lookOf(look);
  if (found) icon(ctx, found.id, x, y, r * 1.5);
}

/** その回の順位と絵を 1 枚に描き、PNG の data URL で返す */
export function album(
  gallery: Drawing[],
  ranking: { seat: Seat; points: number; rank: number }[],
  looks: Record<number, string>
): string {
  const { width, height, cells } = layout(gallery.length);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#fff8ee';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#5b4636';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '800 64px "Hiragino Maru Gothic ProN", sans-serif';
  ctx.fillText('おえかきのもり', width / 2, 80);
  ctx.font = '800 40px "Hiragino Maru Gothic ProN", sans-serif';
  const step = width / (ranking.length + 1);
  ranking.forEach((r, i) => {
    const x = step * (i + 1);
    face(ctx, r.seat, looks[r.seat], x, 175, 44);
    ctx.fillStyle = '#5b4636';
    ctx.fillText(`${r.rank}い ${r.points}てん`, x, 255);
  });
  const sheet = document.createElement('canvas');
  gallery.forEach((d, i) => {
    const { x, y, size } = cells[i];
    sheet.width = sheet.height = Math.round(size);
    const g = sheet.getContext('2d');
    if (g) render(g, d.strokes);
    ctx.drawImage(sheet, x, y, size, size);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#5b4636';
    ctx.strokeRect(x, y, size, size);
    face(ctx, d.by, looks[d.by], x + 30, y + size + 34, 26);
    ctx.fillStyle = '#5b4636';
    ctx.textAlign = 'left';
    ctx.fillText(`「${d.word}」`, x + 64, y + size + 36);
    ctx.textAlign = 'center';
  });
  return canvas.toDataURL('image/png');
}
```

色の値は `src/app.css` の `--pastel-p1` / `--pastel-p2` / `--pastel-p3` / `--line` / `--paper` と同じ値にそろえる（`app.css` を読んで写す）。

`Result.svelte` は `import { saveImage } from '$lib/share';` と `import { album } from './album';` を足し、`ranking` の各要素に `rank` を足して渡す。

```svelte
{#if gallery.length}
  <button
    class="pill"
    onclick={() =>
      saveImage(
        album(
          gallery,
          ranking.map((r) => ({ ...r, rank: rank(r.points) })),
          looks
        ),
        'oekaki-mori.png'
      )}>しゃしんに ほぞん</button
  >
{/if}
```

（「あそびを えらぶ」の前に置く。）

- [ ] **Step 4: 通るのを見る**

Run: `pnpm vitest run src/lib/games/oekaki-mori && pnpm check && pnpm lint`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/oekaki-mori
git commit -m "Save the round's rankings and drawings as one picture from the results screen"
```

---

### Task 6: 通しで確かめて出す

**Files:**

- Scratch only（`$SCRATCHPAD/polish.mjs` を直して使う。リポジトリには入れない）
- Modify: `CLAUDE.md`（おえかきのもりの段落）

- [ ] **Step 1: CLAUDE.md を書きかえる**

おえかきのもりの段落の「子はつながると最初に切れる前の番号を `hello` で送り」の文を、「子はつながると最初に、つなぎ方の版（`PROTOCOL`）・切れる前の番号・動物を `hello` で送る。親は版がちがうか 3 秒で届かなければ理由（`MISMATCH`）を出して切り、そうでなければ番号を決めるので、2 人が同時に切れても戻る順によらず同じ番号に戻る」に替える。段落の最後に「人は端末ごとに選んだ動物（`looks.ts`、`Face.svelte`。保存名 `asobibako:oekaki-mori:look`）で表し、親が `Party.looks` を顔ぶれと一緒に配る。遊ぶ長さ（`engine.ts` の `LENGTHS`。みじかめ・ふつう・ながめ）は親が遊び方選びで選び、`asobibako:oekaki-mori:length` に覚える。結果の画面の「しゃしんに ほぞん」は、`album.ts` が順位とその回の絵を 1 枚に描いて共有シートへ渡す。」を足す。

- [ ] **Step 2: 3 ページの通し**

`pnpm dev` を background で立て、scratchpad の `polish.mjs` を直す。各ページで、ロビーの動物の列から別の動物（1 台目はうさぎ、2 台目はねこ、3 台目はくま）を押してからつなぐ。遊び方選びで「みじかめ」を押してエゴコロクイズを始め、次を撮る。

- あつまった画面の顔ぶれ（動物の丸）。
- 描く画面の上の帯（動物と名前）。
- 3 人が 1 回ずつ描き終えたあとの結果の画面（みじかめなので 3 番で終わる）と、「しゃしんに ほぞん」が作る画像（ページの中で `album()` を呼ぶ代わりに、ボタンを押す前に `saveImage` を差し替えて data URL を受け取り、PNG に書き出す）。

Expected: 動物が 3 台とも同じに見え、みじかめで 3 番目のあとに結果になり、保存する 1 枚に順位と 3 枚の絵が並ぶ。

- [ ] **Step 3: 見直しと出す**

superpowers:executing-plans の Final Review（新しい係で全体を見直す）を通し、Critical と Important を直してから、`mcp__ccd_host__sync_with_base_branch` で main を取り込み、`pnpm verify` を通して `git push origin HEAD:main` と `git push origin HEAD` をする。`gh run watch` で deploy と CI の成功を確かめる。開発サーバーと playwright を止める。
