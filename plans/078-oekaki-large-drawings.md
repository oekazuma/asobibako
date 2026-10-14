# Plan 078: 描きこんだ絵でも、端末どうしの知らせが上限を超えて止まらないようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/net/link.ts src/lib/net/link.test.ts src/lib/games/oekaki-mori/sync.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                                                           |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                                                           |
| Effort     | M                                                                                                                            |
| Risk       | MED（3 本のゲームが共用する `Link` の送り方を変える。変えるのは、今は送れずに止まる大きさの知らせと、send が投げたときだけ） |
| Depends on | none（`src/lib/net/party.svelte.ts` は触らないので plan 067 と重ならない）                                                   |
| Category   | bug                                                                                                                          |
| Planned at | commit `ea56ff6`, 2026-10-14                                                                                                 |

## Why this matters

おえかきのもりは、描いた線を盤面に対する 0..1 の座標の数の列で送る。描く人の端末は 1 フレームごとに増えた点だけを送るので
ふだんの知らせは小さいが、絵を丸ごと送る知らせが 4 つある。戻った子への送り直し（`sync` と `drawing`）、おえかきリレーの
当てる人への受け持ち（`relayTask`。前の人の絵が入る）、ふりかえりの 1 こま（`relayPage`）。

WebRTC の DataChannel は 1 通の大きさに上限があり（Chrome は接続のときに 256KiB と伝え、ほかの端末が伝える値は接続から読める）、超えると
`RTCDataChannel.send` が例外を投げる。子どもが 1〜2 分ぬりつぶすように描くと、1 枚の絵が上限を超える（下の測った数）。
`Link.send` は大きさを見ず、例外も受け止めないので、投げた例外が呼んだ側の途中の処理を止める。

1. 戻った子を迎えるとき、親の `Party` は迎えた番号を返す前に `join` をゲームへ流す。そこで絵の送り直しが投げると、
   あとの聞き手（審判の `rejoin`）が呼ばれず、`Party.add` の Promise が解決しないまま「よびなおす」の画面が残る
2. おえかきリレーでは、だんの頭に人ごとに受け持ちを送るループの途中で投げ、あとの人に受け持ちが届かない。
   同じだんでは送り直さないので、その人は次のだんまで何もできない
3. ふりかえりのこまが届かず、保存する 1 枚から抜ける

直したあとは、`Link.send` が上限を超える知らせだけを上限より小さい何通かに分けて送り、受けた側の `Link` が元の 1 通に戻して
聞き手へ渡す。`send` は例外を投げず、最後のエラーとして残す。上限より小さい知らせは今までと同じ 1 通のまま送るので、
今つながっている端末どうしのやりとりは何も変わらない。

## Current state

### 測った大きさ

`Board.svelte` は指が盤面の幅の 0.003 以上動いたときだけ点を足し（`src/lib/games/oekaki-mori/Board.svelte:29`）、送る座標を
小数 4 けたに丸める（`src/lib/games/oekaki-mori/strokes.ts:19` の `snap`）。この形の点を作って `sync` の知らせにすると、
JSON の大きさはおよそ 1 点 14 字になる（計画を書くときに node で測った値）。

| 点の数 | `JSON.stringify({ t: 'sync', strokes, misses: [] }).length` |
| ------ | ----------------------------------------------------------- |
| 18000  | 250503                                                      |
| 20000  | 278342                                                      |
| 30000  | 417478                                                      |

20000 点は線の長さで盤面の幅のおよそ 60 倍で、描く時間（エゴコロクイズのながめは 120 秒、リレーは 45〜80 秒）に
ぬりつぶすように描けば届く。

### `Link`（直すところ）

`src/lib/net/link.ts:22-61`。受けた文字列をそのまま JSON にして聞き手へ渡し、送るときは大きさを見ずに 1 通で送る。

```ts
export class Link {
  readonly #pc: RTCPeerConnection;
  readonly #channel: RTCDataChannel;
  readonly #listeners = new Set<(message: Message) => void>();
  /** つながった直後に届いた知らせ。受け取る側の部品ができる前に来ても落とさないよう、最初の聞き手が付くまでためる */
  readonly #queue: Message[] = [];
  readonly closed: Promise<void>;

  constructor(pc: RTCPeerConnection, channel: RTCDataChannel) {
    this.#pc = pc;
    this.#channel = channel;
    channel.onmessage = (event) => {
      const message = JSON.parse(event.data) as Message;
      if (!this.#listeners.size) this.#queue.push(message);
      for (const listener of this.#listeners) listener(message);
    };
    ...
  }

  send(message: Message): void {
    if (this.#channel.readyState === 'open') this.#channel.send(JSON.stringify(message));
  }
```

DataChannel は `pc.createDataChannel('game')`（`link.ts:111`）で、指定が無いので順を守り、落とさない（ordered・reliable）。
1 回の `send` の中で続けて送った何通かは、そのまま続けて相手に届き、あいだに別の知らせは入らない。

`Link` を使うのは `Party`（`src/lib/net/party.svelte.ts`）だけで、`Party` を使うのはおえかきのもり・やっぱりカメレオン・
アニマルサバイバーの協力プレイの 3 本。ほかの 2 本は自分で知らせを小さく保っている（カメレオンの吹き付けは 32KB ごとに分ける
`src/lib/games/yappari-chameleon/net.ts:11`、協力プレイの様子は重いときでも 200000 字未満 `src/lib/games/animal-survivors/snap-size.test.ts:53-57`）。
上限より小さい知らせの送り方を変えなければ、この 2 本の動きは変わらない。

### 投げた例外が止める処理

親が子を迎える `#seat` は、番号を返す前に `join` を流す（`src/lib/net/party.svelte.ts:122-128`）。`add` はこの戻り値で
Promise を解決する（`:103`）。

```ts
this.#pipes.set(seat, pipe);
pipe.on((message) => this.#act(message, seat));
pipe.closed.then(() => this.#drop(seat, pipe));
pipe.send({ t: 'seat', seat });
this.#setMembers([...this.members, seat]);
this.#act({ t: 'join' }, seat);
return seat;
```

`#act` は聞き手を順に呼ぶだけ（`party.svelte.ts:164-166`）。おえかきのもりの最初の聞き手は、戻った子へ絵を送り直す
（`src/lib/games/oekaki-mori/OekakiMori.svelte:39-44` が `catchUp`（`sync.ts:12-15`）の知らせを `next.tell(from, message)` で送る）。

```ts
if (next.host)
  next.onAct((m, from) => {
    if (m.t !== 'join') return;
    for (const message of catchUp(round.screen, round.strokes, round.gallery, round.misses)) next.tell(from, message);
  });
```

リレーの審判は、だんの頭に人ごとに受け持ちを送る（`src/lib/games/oekaki-mori/relay-referee.ts:85-91`）。当てる人の受け持ちには
前の人の絵が丸ごと入る（`relay.ts:120-121` の `{ kind: 'guess', strokes: prev.strokes }`）。

```ts
if (s.phase === 'play' && s.step !== this.#step) {
  this.#step = s.step;
  // 前のだんの打ちかけの字が、何も打たなかった人の答えにならないようにする
  this.#typed = {};
  for (const seat of this.#party.members)
    this.#party.tell(seat, { t: 'relayTask', step: s.step, task: taskOf(s, seat) });
}
```

`#push` は `animate` から毎フレーム呼ばれ、`animate` は投げた例外を受け止めて次のフレームも回す（`src/lib/loop.ts:11-25`）。
ただし `#step` はもう進んでいるので、受け持ちは送り直されない。

### 上限の値

接続が決めた 1 通の上限は `RTCPeerConnection.sctp.maxMessageSize`（バイト）で読める。Firefox は `Infinity` を返し、
つながる前やテストの偽物では `sctp` が無い。上限は UTF-8 のバイトで数える。お題などの日本語は 1 字 3 バイトなので、
字数（`text.length`）だけでは決められない。

### テストの道具

`src/lib/net/link.test.ts:31-50` に、偽の channel と pc で `Link` を作るテストがある。`channel.onmessage` を手で呼べば
受けた知らせを起こせる。最後のエラーを残す関数は `src/lib/last-error.ts:9` の `remember(message)`（`localStorage` が無い
node のテストでも投げない）。`src/lib/loop.ts:1` が同じものを使っている。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書き、変更の経緯やチケット番号は書かない。テストの名前は日本語の文にする。

## Commands you will need

| Purpose       | Command                                                                                | Expected on success           |
| ------------- | -------------------------------------------------------------------------------------- | ----------------------------- |
| 足すテスト    | `pnpm exec vitest run src/lib/net/link.test.ts src/lib/games/oekaki-mori/sync.test.ts` | すべて pass                   |
| つなぐ部品    | `pnpm exec vitest run src/lib/net/`                                                    | すべて pass                   |
| 全テスト      | `pnpm test:run`                                                                        | exit 0                        |
| 型            | `pnpm check`                                                                           | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                            | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                   | 警告 0                        |
| 全部          | `pnpm verify`                                                                          | exit 0                        |

ブラウザは使わない（偽の channel で確かめる）。

## Scope

**In scope**

- `src/lib/net/link.ts`（`Link.send` と `channel.onmessage`、定数と分ける関数を足す）
- `src/lib/net/link.test.ts`（テストを足す）
- `src/lib/games/oekaki-mori/sync.test.ts`（描きこんだ絵の大きさと、分けて届くことのテストを足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/net/party.svelte.ts` — `#act` の聞き手を 1 つずつ try/catch で包むことはしない。投げる元は `channel.send` だけで、
  `Link.send` が投げなくなれば止まる処理は無くなる。plan 067 がこのファイルを直す
- おえかきのもりのゲームのファイル（`sync.ts`・`referee.ts`・`relay-referee.ts`・`relay.ts`・`round.svelte.ts`・`Relay.svelte`・
  `OekakiMori.svelte`）— 知らせの形は変えない。ゲームの側で分けたり詰めたりしない（`Link` で分ければ 4 つの知らせ全部に効く）
- 座標の詰め方を変えること（整数の差分など）— 半分ほどにしかならず、上限は無くならない
- `PROTOCOL`（`party.svelte.ts:15`）を上げること — 分けるのは今は送れない大きさの知らせだけなので、古い版の端末とのやりとりで
  今届いている知らせは今までどおり届く
- カメレオンの `net.ts` の 32KB ごとの分け方と、協力プレイの `SNAP_ROWS` — 今のまま残す（毎フレームの知らせを小さく保つ役もある）

## Git workflow

- ブランチは `advisor/078-oekaki-large-drawings`
- ブランチを作る前に `git rev-parse HEAD` を控える（以下 `BASE`。Done criteria で、このブランチの変更だけを見るのに使う）
- コミットは 1 つでよい。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない
  （例 `Split DataChannel messages over the negotiated size and keep Link.send from throwing`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 落ちるテストを書く（`link.test.ts`）

`describe('Link')` の中、既存のテストのあとに次の道具とテストを足す。偽の channel は、Chrome と同じく上限を超える 1 通で
投げるようにする（今の `Link` がそこで落ちることを確かめるため）。

```ts
const LIMIT = 256 * 1024;
const bytes = (text: string) => new TextEncoder().encode(text).byteLength;

/** 送る側の Link。送った 1 通ずつを sent に残す。上限を超える 1 通は、Chrome の channel と同じく投げる */
function sender(maxMessageSize?: number) {
  const sent: string[] = [];
  const channel = {
    readyState: 'open',
    onmessage: null as ((e: { data: string }) => void) | null,
    addEventListener() {},
    send(data: string) {
      if (bytes(data) > (maxMessageSize ?? LIMIT)) throw new TypeError('message too large');
      sent.push(data);
    }
  };
  const pc = { addEventListener() {}, close() {}, sctp: maxMessageSize === undefined ? undefined : { maxMessageSize } };
  return { link: new Link(pc as unknown as RTCPeerConnection, channel as unknown as RTCDataChannel), sent };
}

/** 受ける側の Link。届けた 1 通ずつから聞き手が受けた知らせを got に残す */
function receiver() {
  const channel = {
    readyState: 'open',
    onmessage: null as ((e: { data: string }) => void) | null,
    addEventListener() {},
    send() {}
  };
  const pc = { addEventListener() {}, close() {} };
  const link = new Link(pc as unknown as RTCPeerConnection, channel as unknown as RTCDataChannel);
  const got: Message[] = [];
  link.on((m) => got.push(m));
  return { got, deliver: (data: string) => channel.onmessage!({ data }) };
}

const big = (n: number) => ({
  t: 'sync',
  strokes: [{ color: '#2b2d42', size: 0.018, pts: Array.from({ length: n }, (_, i) => (i % 9973) / 1e4) }]
});
```

テストは次の 6 つ。

```ts
// 古い版の端末は分けた知らせを読めないので、今送れている大きさの知らせは今までと同じ 1 通で送る
it('上限より小さい知らせは、今までどおり 1 通のまま送る', () => {
  const { link, sent } = sender();
  const message = { t: 'ink', ink: { k: 'add', pts: [0.1, 0.2] } };
  link.send(message);
  expect(sent).toEqual([JSON.stringify(message)]);
});

it('上限を超える知らせは、上限より小さい何通かに分けて送り、受けた側では元の 1 通として渡す', () => {
  const { link, sent } = sender();
  const message = big(60000);
  expect(bytes(JSON.stringify(message))).toBeGreaterThan(LIMIT);
  link.send(message);
  expect(sent.length).toBeGreaterThan(1);
  const { got, deliver } = receiver();
  sent.forEach(deliver);
  expect(got).toEqual([message]);
});

// お題などの日本語は UTF-8 で 1 字 3 バイトなので、字数では上限を測れない
it('日本語の多い知らせも、1 通ずつが上限に収まる', () => {
  const { link, sent } = sender();
  const message = { t: 'relayPage', entry: { kind: 'guess', text: 'あ'.repeat(100000) } };
  link.send(message);
  expect(sent.every((s) => bytes(s) <= LIMIT)).toBe(true);
  const { got, deliver } = receiver();
  sent.forEach(deliver);
  expect(got).toEqual([message]);
});

it('接続が決めた上限が小さければそれに合わせ、上限が無い（Infinity）ときは 256KiB で分ける', () => {
  for (const [max, limit] of [
    [64 * 1024, 64 * 1024],
    [Infinity, LIMIT]
  ]) {
    const { link, sent } = sender(max);
    const message = big(60000);
    link.send(message);
    expect(sent.every((s) => bytes(s) <= limit)).toBe(true);
    const { got, deliver } = receiver();
    sent.forEach(deliver);
    expect(got).toEqual([message]);
  }
});

// channel は順を守り、分けた何通かは 1 回の send の中で続けて送るので、ふつうはあいだに別の知らせは入らない。入っても壊さない
it('分けた知らせのあいだに別の知らせが届いても、どちらも元のまま渡す', () => {
  const { link, sent } = sender();
  const message = big(60000);
  link.send(message);
  const ink = { t: 'ink', ink: { k: 'add', pts: [0.5, 0.5] } };
  const { got, deliver } = receiver();
  deliver(sent[0]);
  deliver(JSON.stringify(ink));
  sent.slice(1).forEach(deliver);
  expect(got).toEqual([ink, message]);
});

// 投げると、親が子を迎える途中（席を返す前の join）や、人ごとに送るループの途中で止まる
it('channel が投げても send は投げない', () => {
  const channel = {
    readyState: 'open',
    onmessage: null as ((e: { data: string }) => void) | null,
    addEventListener() {},
    send() {
      throw new Error('closing');
    }
  };
  const pc = { addEventListener() {}, close() {} };
  const link = new Link(pc as unknown as RTCPeerConnection, channel as unknown as RTCDataChannel);
  expect(() => link.send({ t: 'seat', seat: 2 })).not.toThrow();
});
```

`for (const [max, limit] of …)` の型が `number` に広がらず `pnpm check` が言うときは、配列に `as [number, number][]` を付ける。

**Verify**: `pnpm exec vitest run src/lib/net/link.test.ts` → 1 つめ（1 通のまま）は pass、ほかの 5 つは FAIL
（`message too large` か `closing` が投げられる）。既存の 4 つは pass。1 つめが落ちたら道具の作りが違うので STOP。

### Step 2: `Link` で分けて送り、受けた側で戻す

`src/lib/net/link.ts` を直す。

1. 先頭の import に `import { remember } from '$lib/last-error';` を足す。
2. `OPEN_MS` の下に定数を足す。

   ```ts
   /** 1 通の上限が分からないときの値で、上限の上限。Chrome は接続のときに 256KiB と伝え、Firefox は Infinity を返すので、これを超えない */
   const MAX_BYTES = 256 * 1024;
   /** 上限を超える知らせを分けたものの印。古い版の端末は知らない知らせとして読み飛ばすが、分けるのは今は送れない大きさの知らせだけ */
   const PART = '~part';
   ```

3. `Link` に `#parts: string[] = [];` を足し、`channel.onmessage` を次にする。

   ```ts
   channel.onmessage = (event) => {
     let message = JSON.parse(event.data) as Message;
     if (message.t === PART) {
       if (message.i === 0) this.#parts = [];
       this.#parts.push(String(message.s));
       if (this.#parts.length < Number(message.n)) return;
       message = JSON.parse(this.#parts.join('')) as Message;
       this.#parts = [];
     }
     if (!this.#listeners.size) this.#queue.push(message);
     for (const listener of this.#listeners) listener(message);
   };
   ```

4. `send` を次にする。

   ```ts
   send(message: Message): void {
     if (this.#channel.readyState !== 'open') return;
     const text = JSON.stringify(message);
     const max = Math.min(this.#pc.sctp?.maxMessageSize || MAX_BYTES, MAX_BYTES);
     try {
       // UTF-8 は 1 字 3 バイトまでなので、字数の 3 倍が上限以下なら測らずに 1 通で送る
       if (text.length * 3 <= max || new TextEncoder().encode(text).byteLength <= max) this.#channel.send(text);
       else for (const part of split(text, max)) this.#channel.send(part);
     } catch (e) {
       // 送れなかった 1 通のせいで、呼んだ側の残り（ほかの人への知らせ・迎えた子の番号を返すこと）まで止めない
       remember(e instanceof Error ? e.message : String(e));
     }
   }
   ```

5. `class Link` の下（`function opened` の前）に、分ける関数を足す。

   ```ts
   /** 包んだ JSON が 1 字 3 バイトでも上限に収まる字数で切る。切り口の片割れのサロゲートは \uXXXX になるので、少し余らせる */
   function split(text: string, max: number): string[] {
     const size = Math.floor(max / 3) - 64;
     const n = Math.ceil(text.length / size);
     return Array.from({ length: n }, (_, i) =>
       JSON.stringify({ t: PART, i, n, s: text.slice(i * size, (i + 1) * size) })
     );
   }
   ```

`pnpm format` で整えてから確かめる。

**Verify**: `pnpm exec vitest run src/lib/net/` → すべて pass（Step 1 の 6 つと、`party.svelte.test.ts`・`timeline.test.ts`・
`Handshake.svelte.test.ts` の既存のテストを含む）。`pnpm check` → `0 ERRORS 0 WARNINGS`。

### Step 3: おえかきのもりの描きこんだ絵が、分けて届くことを確かめる（`sync.test.ts`）

`src/lib/games/oekaki-mori/sync.test.ts` に、上の表の大きさを作る道具とテストを足す。import に
`import { Link, type Message } from '$lib/net/link';` と `import { PENS, SIZES, snap, type Stroke } from './strokes';` を足す。

```ts
const frac = (v: number) => v - Math.floor(v);

/** Board と同じく 4 けたに丸めた点を n 個、300 点ずつの線にする。描きこんだ子の絵の大きさを作る */
function scribble(n: number): Stroke[] {
  const strokes: Stroke[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 300 === 0) strokes.push({ color: PENS[0].hex, size: SIZES[1], pts: [] });
    strokes.at(-1)!.pts.push(snap(0.1 + 0.8 * frac(i * 0.6180339887)), snap(0.1 + 0.8 * frac(i * 0.7548776662)));
  }
  return strokes;
}
```

```ts
// 1〜2 分ぬりつぶすように描くと 2 万点を超え、絵 1 枚の知らせが DataChannel の 1 通の上限（256KiB）を超える
it('描きこんだ絵の送り直しは上限を超えるが、分けて送れば元の絵のまま届く', () => {
  const [sync] = catchUp('play', scribble(30000), [], []);
  const text = JSON.stringify(sync);
  expect(text.length).toBeGreaterThan(256 * 1024);
  const sent: string[] = [];
  const got: Message[] = [];
  const to = {
    readyState: 'open',
    onmessage: null as ((e: { data: string }) => void) | null,
    addEventListener() {},
    send() {}
  };
  new Link({ addEventListener() {}, close() {} } as unknown as RTCPeerConnection, to as unknown as RTCDataChannel).on(
    (m) => got.push(m)
  );
  const from = { readyState: 'open', onmessage: null, addEventListener() {}, send: (data: string) => sent.push(data) };
  new Link(
    { addEventListener() {}, close() {} } as unknown as RTCPeerConnection,
    from as unknown as RTCDataChannel
  ).send(sync);
  expect(sent.every((s) => s.length <= 256 * 1024)).toBe(true);
  sent.forEach((data) => to.onmessage!({ data }));
  expect(got).toEqual([sync]);
});
```

このテストは Step 2 のあとなので、はじめから pass する（Step 1 の `link.test.ts` で落ちることは確かめてある）。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/sync.test.ts` → すべて pass。

### Step 4: 全体を通してコミットする

**Verify**: `pnpm verify` → exit 0。`git status` → In scope の 3 ファイルと `plans/README.md` のほかに変更が無い。

コミットする。`Split DataChannel messages over the negotiated size and keep Link.send from throwing`

## Test plan

- `src/lib/net/link.test.ts` に 6 つ（小さい知らせは 1 通のまま、大きい知らせは分けて戻る、日本語の多い知らせのバイト数、
  接続の上限が小さいときと Infinity のとき、分けたあいだに別の知らせが入っても壊れない、channel が投げても send は投げない）
- `src/lib/games/oekaki-mori/sync.test.ts` に 1 つ（3 万点の絵の送り直しが上限を超え、分けて元の絵のまま届く）
- 形は `link.test.ts` の「聞き手が付く前に届いた知らせをためておき、最初の聞き手に渡す」（偽の channel と pc）にならう
- 確かめは `pnpm exec vitest run src/lib/net/ src/lib/games/oekaki-mori/` → すべて pass

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `link.test.ts` に新しいテストが 6 つ、`sync.test.ts` に 1 つあり pass する
- [ ] `grep -c "remember(" src/lib/net/link.ts` が `1`
- [ ] `grep -n "PROTOCOL = 5" src/lib/net/party.svelte.ts` が 1 行出る（版を上げていない）
- [ ] `git diff --stat BASE..HEAD -- src/lib/net/party.svelte.ts src/lib/games/oekaki-mori/ ':!src/lib/games/oekaki-mori/sync.test.ts'` が空（`BASE` は Git workflow で控えた値）
- [ ] `git status` で In scope の外のファイルが変わっていない

## STOP 条件

- 「Current state」の `Link` の抜粋（`send` と `channel.onmessage`）が今のコードと違う
- Step 1 の 1 つめ（1 通のまま送る）が直す前に落ちる、またはほかの 5 つのどれかが直す前から pass する
- `this.#pc.sctp?.maxMessageSize` が `pnpm check` で型エラーになる（`lib.dom` に `sctp` が無い）。型を足して通そうとせず報告する
- `party.svelte.test.ts` や、カメレオン・協力プレイのテストが Step 2 のあとで落ちる（上限より小さい知らせの送り方が変わった疑い）
- 直すために `party.svelte.ts` やゲームのファイルを変える必要が出てくる
- 確かめのコマンドが、手直しを 2 回しても通らない

## Maintenance notes

- 分けた知らせを戻すのは「1 回の send の中で続けて送る」「channel が順を守る」の 2 つに頼っている。`createDataChannel` に
  `ordered: false` や `maxRetransmits` を付けるときは、分けた知らせに番号の束（どの知らせの何通めか）を付け直す
- 上限は `sctp.maxMessageSize` を送るたびに読む。端末が伝える値が 256KiB より小さくても合わせて分ける
- 古い版の端末は分けた知らせ（`~part`）を知らない知らせとして読み飛ばす。分けるのは今は送れずに例外になる大きさだけなので、
  古い端末から見て前より悪くなることはない
- `send` が投げなくなったので、送れなかった知らせは相手に届かないまま進む。残るのは最後のエラー（アプリについての画面）だけ
- 実機では、iPad 2 台でおえかきリレーを遊び、1 枚をぬりつぶすように描いてから、次のだんで当てる人の画面に絵が出ることを見る
- アニマルサバイバーの `CLAUDE.md` の「データチャンネルの 1 回の上限 256KB を超えると 2 台が切れる」は、`Link` が分けるように
  なったあとも様子を小さく保つ理由（毎秒 20 回送る重さ）として残る。書き直すかは協力プレイを触るときに決める
