# おえかきのもり 第 1 弾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2〜3 台の端末を QR でつなぎ、エゴコロクイズ（1 人が描いて、ほかの人が 50 音盤で当てる）を遊べる「おえかきのもり」を、一覧の「ふたりで」タブに足す。

**Architecture:** 親の端末が中心になり、子ごとの WebRTC の `Link` を `Party` が束ねる。遊ぶ人の操作（act）は親のルール（`Referee` が `engine.ts` を進める）へ、ルールの知らせ（tell）は全員の画面へ流れ、親の端末では両方を手元で回す。ルール・判定・線の記録・お題は DOM にも接続にも依存しない純粋なモジュールにして vitest で確かめ、`.svelte` は描画と入力の配線だけを持つ。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、WebRTC DataChannel（`src/lib/net/link.ts`）、canvas 2D、vitest（node の unit と happy-dom の dom）、playwright-core（通しの確認）。

**Spec:** `docs/superpowers/specs/2026-09-30-oekaki-mori-design.md`（この計画は第 1 弾だけ。スピードおえかきとおえかきリレーは入れない）

## Global Constraints

- ゲームの id は `oekaki-mori`、名前は「おえかきのもり」。一覧は `players: 2` のタブに入れ、カードに「2〜3にん」を出す。
- 1 人 1 台。上下 2 分割の `GameShell` は使わず、ゲームがロビー・遊び方選び・遊ぶ・結果の画面を持つ。タイトルの長押しはない。
- 親は 1P。子はつないだ順に 2P・3P。3 人までで、4 人目は断る。
- 色は 1P 青 `--p1`、2P 赤 `--p2`、3P 緑 `--p3`（`app.css` の `:root` に足す）。
- 描く時間 90 秒、ヒントは残り 45 秒で 1 文字目、残り 20 秒でもう 1 文字（2 文字目以降からランダム、2 文字のお題は出さない）、答えを見せる時間 3 秒、全員が 2 回ずつ描く。
- 点は 1 番目に当てた人 3、2 番目 2、描いた人は当ててもらった 1 人につき 2。
- 判定は、同じ並びならせいかい、濁点・半濁点を外して小さい字を大きい字にそろえると同じならおしい、それ以外ははずれ。「おしい！」は本人にだけ出し、はずれた答えは全員に吹き出しで 3 秒出す。
- お題はひらがな（と「ー」）だけで 150 語以上、2 文字以上、重ならない。同じゲームの中で同じお題を出さない。
- 盤面は正方形、線は盤面に対する 0..1 の座標。道具は 8 色・太さ 3 段・消しゴム・1 つ戻す・ぜんぶ消す。
- 子が抜けても残りが 2 人以上なら続け、抜けた人の描く番は飛ばす。1 人になったら結果へ。親が抜けたら子はロビーに戻り「つながりが きれました」を出す。
- 絵文字は使わない。外部のフォントや依存は足さない（`jsqr` と `uqr` は入っている）。
- `.svelte` は 200 行未満（`pnpm vitals` の `architecture/component-size`）。コメントは非自明な WHY だけ、日本語で書く。
- 設計書にない決めごととして、お題を選ぶ時間を 15 秒にし、選ばなければ 1 つ目の候補にする（子どもが止まったままにならないように）。

## Review Focus

1. 描く人でも当てた人でもない端末に、お題が届かないこと（`view()` がお題を入れない）。これが崩れると遊びが成り立たない。Task 6 のテストで固める。
2. 子がつながった直後に親が送る番号の知らせを取りこぼさないこと（`Link` に聞き手が付く前に届いた知らせをためておく）。Task 1 のテストで固める。
3. 描く人が描いている途中に抜けたとき、ターンが止まらずに次の人へ移ること。Task 6 のテストで固める。
4. 当てる人が全員当てた瞬間にターンが終わり、そのあとの答えを受け付けないこと。Task 6 のテストで固める。
5. 50 音盤の「゛゜小」が、変えられない字（「ん」など）で何も起きず、空のときも落ちないこと。Task 3 と Task 7 のテストで固める。

---

### Task 1: 3 台までをつなぐ `Party`

**Files:**

- Modify: `src/lib/net/link.ts`（聞き手が付く前に届いた知らせをためる）
- Create: `src/lib/net/party.svelte.ts`
- Test: `src/lib/net/party.svelte.test.ts`

**Interfaces:**

- Consumes: `Link`（`send` / `on` / `closed` / `close`）と `Message`（`src/lib/net/link.ts`）
- Produces:
  - `type Seat = 1 | 2 | 3`
  - `interface Pipe { send(message: Message): void; on(listener: (message: Message) => void): () => void; readonly closed: Promise<void>; close(): void }`（`Link` はこれを満たす）
  - `class Party`：`static host(): Party`、`static guest(pipe: Pipe): Party`、`me: Seat`（$state）、`members: Seat[]`（$state、昇順）、`lost: boolean`（$state、子で親とのつながりが切れた）、`readonly host: boolean`、`add(pipe: Pipe): Seat | null`、`act(message: Message): void`、`onAct(listener: (message: Message, from: Seat) => void): () => void`、`tell(to: Seat | 'all', message: Message): void`、`onTell(listener: (message: Message) => void): () => void`、`close(): void`
  - 親は子が抜けると、`onAct` に `{ t: 'leave' }` をその子の番号で流す

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/net/party.svelte.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Message } from './link';
import { Party, type Pipe, type Seat } from './party.svelte';

/** 手元でつないだ 2 本の管。close はどちらの端からでも両方を閉じる */
function pipes(): [Pipe, Pipe] {
  const listeners = [new Set<(m: Message) => void>(), new Set<(m: Message) => void>()];
  let open = true;
  let close!: () => void;
  const closed = new Promise<void>((resolve) => (close = resolve));
  const end = (me: 0 | 1): Pipe => ({
    send: (m) => {
      if (open) for (const l of listeners[1 - me]) l(structuredClone(m));
    },
    on: (l) => {
      listeners[me].add(l);
      return () => listeners[me].delete(l);
    },
    closed,
    close: () => {
      open = false;
      close();
    }
  });
  return [end(0), end(1)];
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

function trio() {
  const host = Party.host();
  const [a, a2] = pipes();
  const [b, b2] = pipes();
  const g2 = Party.guest(a2);
  const g3 = Party.guest(b2);
  host.add(a);
  host.add(b);
  return { host, g2, g3, a, b };
}

describe('Party', () => {
  it('親は子を 2P・3P の順に迎え、4 人目は断って閉じる', async () => {
    const { host, g2, g3 } = trio();
    const [c, c2] = pipes();
    expect(host.add(c)).toBeNull();
    await settle();
    let refused = false;
    c2.closed.then(() => (refused = true));
    await settle();
    expect(refused).toBe(true);
    expect([host.me, g2.me, g3.me]).toEqual([1, 2, 3]);
    expect(host.members).toEqual([1, 2, 3]);
    expect(g2.members).toEqual([1, 2, 3]);
    expect(g3.members).toEqual([1, 2, 3]);
  });

  it('子の操作は送った子の番号付きで、親の操作は 1 番で親のルールに届く', () => {
    const { host, g3 } = trio();
    const got: [Message, Seat][] = [];
    host.onAct((m, from) => got.push([m, from]));
    g3.act({ t: 'guess', text: 'いぬ' });
    host.act({ t: 'pick', index: 1 });
    expect(got).toEqual([
      [{ t: 'guess', text: 'いぬ' }, 3],
      [{ t: 'pick', index: 1 }, 1]
    ]);
  });

  it('知らせは all なら親の画面と全員の子に、番号なら その 1 人にだけ届く', () => {
    const { host, g2, g3 } = trio();
    const seen: Record<number, Message[]> = { 1: [], 2: [], 3: [] };
    host.onTell((m) => seen[1].push(m));
    g2.onTell((m) => seen[2].push(m));
    g3.onTell((m) => seen[3].push(m));
    host.tell('all', { t: 'screen', screen: 'mode' });
    host.tell(3, { t: 'close' });
    host.tell(1, { t: 'close' });
    expect(seen[1]).toEqual([{ t: 'screen', screen: 'mode' }, { t: 'close' }]);
    expect(seen[2]).toEqual([{ t: 'screen', screen: 'mode' }]);
    expect(seen[3]).toEqual([{ t: 'screen', screen: 'mode' }, { t: 'close' }]);
  });

  it('子が抜けると、親のルールに leave が届き、残りの全員の顔ぶれから消える', async () => {
    const { host, g3, a } = trio();
    const left: Seat[] = [];
    host.onAct((m, from) => m.t === 'leave' && left.push(from));
    a.close();
    await settle();
    expect(left).toEqual([2]);
    expect(host.members).toEqual([1, 3]);
    expect(g3.members).toEqual([1, 3]);
  });

  it('抜けた子の番号は、次に来た子に使う', async () => {
    const { host, a } = trio();
    a.close();
    await settle();
    const [c, c2] = pipes();
    const g = Party.guest(c2);
    expect(host.add(c)).toBe(2);
    expect(g.me).toBe(2);
  });

  it('親が閉じると、子は lost になる', async () => {
    const { host, g2 } = trio();
    host.close();
    await settle();
    expect(g2.lost).toBe(true);
  });

  it('子の Party を作る前に届いていた番号の知らせも受け取る', () => {
    const host = Party.host();
    const [a, a2] = pipes();
    const early: Message[] = [];
    // 管そのものは受け取りを取りこぼすので、Link と同じく最初の聞き手が付くまでためる管にする
    const buffered: Pipe = {
      ...a2,
      on: (l) => {
        for (const m of early.splice(0)) l(m);
        return a2.on(l);
      }
    };
    const stop = a2.on((m) => early.push(m));
    host.add(a);
    stop();
    const g = Party.guest(buffered);
    expect(g.me).toBe(2);
    expect(g.members).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/net/party.svelte.test.ts`
Expected: FAIL（`./party.svelte` が無い）

- [ ] **Step 3: `Link` に、聞き手が付く前の知らせをためる仕組みを入れる**

`src/lib/net/link.ts` の `Link` クラスを次のように変える（`#queue` を足し、`onmessage` と `on` を差し替える）。

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
    // closed の組み立てはいまのまま
  }

  on(listener: (message: Message) => void): () => void {
    this.#listeners.add(listener);
    for (const message of this.#queue.splice(0)) listener(message);
    return () => this.#listeners.delete(listener);
  }
  // send と close はいまのまま
}
```

- [ ] **Step 4: `Party` を書く**

`src/lib/net/party.svelte.ts`

```ts
import type { Message } from './link';

export type Seat = 1 | 2 | 3;

/** Link と同じ口。テストでは手元でつないだ管に差し替える */
export interface Pipe {
  send(message: Message): void;
  on(listener: (message: Message) => void): () => void;
  readonly closed: Promise<void>;
  close(): void;
}

type ActListener = (message: Message, from: Seat) => void;
type TellListener = (message: Message) => void;

/**
 * 親を中心に 3 台までをつなぐ。子どうしはつながず、親が中継する。
 * 遊ぶ人の操作（act）は親のルールへ、ルールの知らせ（tell）は遊ぶ人の画面へ流れる。
 * 親の端末では両方を手元で回し、子から届いたものと同じ口で受けるので、ルールの処理は 1 本で済む
 */
export class Party {
  me = $state<Seat>(1);
  members = $state<Seat[]>([1]);
  /** 子で、親とのつながりが切れた */
  lost = $state(false);
  readonly host: boolean;
  readonly #pipes = new Map<Seat, Pipe>();
  readonly #acts = new Set<ActListener>();
  readonly #tells = new Set<TellListener>();

  private constructor(host: boolean) {
    this.host = host;
  }

  static host(): Party {
    return new Party(true);
  }

  static guest(pipe: Pipe): Party {
    const party = new Party(false);
    party.#pipes.set(1, pipe);
    pipe.on((message) => {
      if (message.t === 'seat') party.me = message.seat as Seat;
      else if (message.t === 'members') party.members = message.members as Seat[];
      else for (const listener of party.#tells) listener(message);
    });
    pipe.closed.then(() => (party.lost = true));
    return party;
  }

  /** 親だけ。空いている番号で子を迎える。満員なら閉じて null */
  add(pipe: Pipe): Seat | null {
    const seat = ([2, 3] as const).find((s) => !this.#pipes.has(s));
    if (!this.host || !seat) {
      pipe.close();
      return null;
    }
    this.#pipes.set(seat, pipe);
    pipe.on((message) => this.#act(message, seat));
    pipe.closed.then(() => this.#drop(seat, pipe));
    pipe.send({ t: 'seat', seat });
    this.#setMembers([...this.members, seat]);
    return seat;
  }

  act(message: Message): void {
    if (this.host) this.#act(message, 1);
    else this.#pipes.get(1)?.send(message);
  }

  onAct(listener: ActListener): () => void {
    this.#acts.add(listener);
    return () => this.#acts.delete(listener);
  }

  /** 親だけ。1 番（親自身）への知らせは手元の画面へ回す */
  tell(to: Seat | 'all', message: Message): void {
    if (!this.host) return;
    for (const seat of to === 'all' ? this.members : [to]) {
      if (seat === 1) for (const listener of this.#tells) listener(message);
      else this.#pipes.get(seat)?.send(message);
    }
  }

  onTell(listener: TellListener): () => void {
    this.#tells.add(listener);
    return () => this.#tells.delete(listener);
  }

  close(): void {
    const pipes = [...this.#pipes.values()];
    this.#pipes.clear();
    for (const pipe of pipes) pipe.close();
  }

  #act(message: Message, from: Seat) {
    for (const listener of this.#acts) listener(message, from);
  }

  #drop(seat: Seat, pipe: Pipe) {
    // 閉じたあとに同じ番号へ別の子が入っていれば、それは消さない
    if (this.#pipes.get(seat) !== pipe) return;
    this.#pipes.delete(seat);
    this.#setMembers(this.members.filter((s) => s !== seat));
    this.#act({ t: 'leave' }, seat);
  }

  #setMembers(members: Seat[]) {
    this.members = [...members].sort((a, b) => a - b);
    for (const pipe of this.#pipes.values()) pipe.send({ t: 'members', members: this.members });
  }
}
```

- [ ] **Step 5: テストを通す**

Run: `pnpm vitest run src/lib/net`
Expected: PASS（`link.test.ts` も含めて）

- [ ] **Step 6: せめぎあいの 2 台対戦が崩れていないことを確かめる**

dev サーバー（`preview_start` の `dev`）を起動し、scratchpad の `net-play.mjs`（前回の 2 ページの通し）を回す。

Run: `node <scratchpad>/net-play.mjs <scratchpad>/shots`
Expected: `linked in … ms`、`rematch started on both`、`host back to local after guest left` が出る

- [ ] **Step 7: コミット**

```bash
git add src/lib/net/link.ts src/lib/net/party.svelte.ts src/lib/net/party.svelte.test.ts
git commit -m "Add Party to link up to three devices through the host, and queue link messages until a listener attaches"
```

### Task 2: QR の手順を `Handshake.svelte` に切り出す

**Files:**

- Create: `src/lib/net/Handshake.svelte`
- Modify: `src/lib/net/Pairing.svelte`

**Interfaces:**

- Consumes: `host` / `join` / `isAnswer` / `isOffer` / `Link`（`link.ts`）、`openCamera` / `closeCamera` / `scan`（`camera.ts`）、`Qr.svelte`
- Produces: `<Handshake role={'host' | 'guest'} onlink={(link: Link) => void} onfail={(note: string) => void} />`。mount した時点でカメラを開いて手順を始める。親は QR を見せてから「よみとってもらったら つぎへ」でカメラ、子はカメラで読んでから自分の QR を見せる

- [ ] **Step 1: `Handshake.svelte` を書く**

いまの `Pairing.svelte` の手順の部分を移す。役割は props で受け、始めるのは mount のとき。

```svelte
<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { closeCamera, openCamera, scan, type Facing } from './camera';
  import { host, isAnswer, isOffer, join, type Link } from './link';
  import Qr from './Qr.svelte';

  let {
    role,
    onlink,
    onfail
  }: { role: 'host' | 'guest'; onlink: (link: Link) => void; onfail: (note: string) => void } = $props();

  interface Wanted {
    match: (text: string) => boolean;
    connect: (text: string) => Promise<void>;
  }

  /** 自分が見せる QR の中身 */
  let code = $state('');
  /** QR とカメラを同時に出すと、どちらに向ければよいか迷うので、どちらか一方だけを出す */
  let looking = $state(false);
  let linking = $state(false);
  let facing = $state<Facing>('user');
  let stream = $state<MediaStream>();
  let video = $state<HTMLVideoElement>();
  let wanted = $state.raw<Wanted>();

  const step = $derived(role === 'host' ? (looking ? 2 : 1) : looking ? 1 : 2);

  // カメラの映像が画面に出ているあいだだけ読む
  $effect(() => {
    if (!video || !wanted) return;
    const { match, connect } = wanted;
    video.srcObject = stream ?? null;
    return scan(video, match, (text) => {
      looking = false;
      linking = true;
      connect(text).catch(() => {
        closeCamera(stream);
        onfail('つながりませんでした。おなじ Wi-Fi に いるか たしかめてね');
      });
    });
  });

  function done(link: Link) {
    closeCamera(stream);
    onlink(link);
  }

  onMount(async () => {
    try {
      // 接続情報を作る前にカメラを開く。許可がないと自分のアドレスが伏せられ、つながらないことがある
      stream = await openCamera(facing);
    } catch {
      onfail('カメラを つかえませんでした');
      return;
    }
    if (role === 'host') {
      const offer = await host();
      code = offer.code;
      wanted = { match: isAnswer, connect: async (text) => done(await offer.accept(text)) };
    } else {
      looking = true;
      wanted = {
        match: isOffer,
        connect: async (text) => {
          const answer = await join(text);
          code = answer.code;
          done(await answer.link);
        }
      };
    }
  });

  async function turn() {
    facing = facing === 'user' ? 'environment' : 'user';
    closeCamera(stream);
    stream = await openCamera(facing);
  }

  onDestroy(() => closeCamera(stream));
</script>

{#if looking}
  <p class="step">{step}. あいての QR を うつしてね</p>
  <video class:mirror={facing === 'user'} bind:this={video} autoplay muted playsinline></video>
  <button class="pill" onclick={turn}>カメラを きりかえ</button>
  {#if role === 'host'}
    <button class="pill" onclick={() => (looking = false)}>じぶんの QR に もどる</button>
  {/if}
{:else if code && !(role === 'host' && linking)}
  <p class="step">{step}. この QR を あいてに よみとってもらってね</p>
  <div class="code"><Qr text={code} /></div>
  {#if role === 'host'}
    <button class="pill gold" onclick={() => (looking = true)}>よみとってもらったら つぎへ</button>
  {:else}
    <p role="status">よみとってもらうと はじまるよ</p>
  {/if}
{:else}
  <p role="status">{linking ? 'つないでいます…' : 'じゅんびちゅう…'}</p>
{/if}

<style>
  .step {
    font-size: clamp(17px, 3vmin, 24px);
    font-weight: 800;
  }

  .code {
    width: min(86vw, 52dvh);
    aspect-ratio: 1;
    padding: 8px;
    border: 3px solid var(--line);
    border-radius: 16px;
    background: #fff;
  }

  video {
    width: min(80vw, 50dvh);
    aspect-ratio: 4 / 3;
    border: 3px solid var(--line);
    border-radius: 16px;
    background: #000;
    object-fit: cover;
  }

  /* 前のカメラは鏡に映したほうが向きを合わせやすい。読み取りは映像そのものを使うので影響しない */
  video.mirror {
    scale: -1 1;
  }
</style>
```

- [ ] **Step 2: `Pairing.svelte` を `Handshake` を使う形にする**

```svelte
<script lang="ts">
  import Handshake from './Handshake.svelte';
  import type { Net } from './link';

  let { name, onlink, onback }: { name: string; onlink: (net: Net) => void; onback: () => void } = $props();

  let role = $state<'host' | 'guest' | null>(null);
  let note = $state('');

  function begin(as: 'host' | 'guest') {
    note = '';
    role = as;
  }
</script>

<main class="pair">
  <h1 class="yuru">{name}<br />2だいで あそぶ</h1>
  {#if !role}
    <p>おなじ Wi-Fi の 2だいを QR で つなぎます</p>
    <button class="pill p1" onclick={() => begin('host')}>さきに QR を だす</button>
    <button class="pill p2" onclick={() => begin('guest')}>QR を よみとる</button>
  {:else}
    <Handshake
      {role}
      onlink={(link) => onlink({ me: role === 'host' ? 1 : 2, link })}
      onfail={(text) => {
        note = text;
        role = null;
      }}
    />
  {/if}
  {#if note}<p role="alert">{note}</p>{/if}
  <button class="pill" onclick={onback}>もどる</button>
</main>

<style>
  .pair {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 100dvh;
    padding: max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom));
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 700;
    text-align: center;
  }

  h1 {
    font-size: clamp(22px, 4vmin, 36px);
  }
</style>
```

`.markuplintrc.jsonc` の `src/lib/net/Pairing.svelte` の上書きを `src/lib/net/Handshake.svelte` に付け替える（video を置くのが `Handshake` になるため）。

- [ ] **Step 3: 検査と通しの確認**

Run: `pnpm lint && pnpm check && pnpm build`
Expected: エラーなし

Run: `node <scratchpad>/net-play.mjs <scratchpad>/shots`（dev サーバーで）
Expected: Task 1 と同じ 3 行が出る

- [ ] **Step 4: コミット**

```bash
git add src/lib/net .markuplintrc.jsonc
git commit -m "Split the QR steps out of Pairing into Handshake so other games can reuse them"
```

### Task 3: 50 音盤の並びと判定 `kana.ts`

**Files:**

- Create: `src/lib/games/oekaki-mori/kana.ts`
- Test: `src/lib/games/oekaki-mori/kana.test.ts`

**Interfaces:**

- Produces:
  - `COLUMNS: string[][]`（あ行からわ行の 10 列、各 5 マス、空きは `''`）
  - `plain(text: string): string`（濁点・半濁点を外し、小さい字を大きい字にする）
  - `cycle(ch: string): string`（もとの字→濁点→半濁点→小さい字→もとの字。変えられない字はそのまま）
  - `type Verdict = 'right' | 'close' | 'wrong'`
  - `judge(word: string, text: string): Verdict`

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { COLUMNS, cycle, judge, plain } from './kana';

describe('COLUMNS', () => {
  it('10 列 5 マスで、清音 45 字と を・ん がある', () => {
    expect(COLUMNS).toHaveLength(10);
    for (const column of COLUMNS) expect(column).toHaveLength(5);
    const keys = COLUMNS.flat().filter(Boolean);
    expect(keys).toHaveLength(46);
    expect(keys).toContain('を');
    expect(keys).toContain('ん');
  });
});

describe('cycle', () => {
  it('か行は濁点と行き来する', () => {
    expect(cycle('か')).toBe('が');
    expect(cycle('が')).toBe('か');
  });

  it('は行は濁点、半濁点、もとの字の順', () => {
    expect(cycle('は')).toBe('ば');
    expect(cycle('ば')).toBe('ぱ');
    expect(cycle('ぱ')).toBe('は');
  });

  it('つは濁点、小さい字、もとの字の順', () => {
    expect(cycle('つ')).toBe('づ');
    expect(cycle('づ')).toBe('っ');
    expect(cycle('っ')).toBe('つ');
  });

  it('や行とあ行は小さい字と行き来する', () => {
    expect(cycle('や')).toBe('ゃ');
    expect(cycle('ゃ')).toBe('や');
    expect(cycle('あ')).toBe('ぁ');
  });

  it('変えられない字と「ー」はそのまま', () => {
    expect(cycle('ん')).toBe('ん');
    expect(cycle('ま')).toBe('ま');
    expect(cycle('ー')).toBe('ー');
  });
});

describe('plain', () => {
  it('濁点・半濁点を外し、小さい字を大きくする', () => {
    expect(plain('ぎゅうにゅう')).toBe('きゆうにゆう');
    expect(plain('ぱんだ')).toBe('はんた');
    expect(plain('けーき')).toBe('けーき');
  });
});

describe('judge', () => {
  it('同じ並びはせいかい', () => {
    expect(judge('ぞう', 'ぞう')).toBe('right');
  });

  it('濁点や小さい字だけが違うのはおしい', () => {
    expect(judge('ぞう', 'そう')).toBe('close');
    expect(judge('しょうぼうしゃ', 'しようほうしや')).toBe('close');
  });

  it('それ以外ははずれ', () => {
    expect(judge('ぞう', 'きりん')).toBe('wrong');
    expect(judge('ぞう', '')).toBe('wrong');
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/oekaki-mori/kana.test.ts`
Expected: FAIL（`./kana` が無い）

- [ ] **Step 3: 書く**

```ts
/** 50 音表の列。あ行から順に、各列の上から 5 マス。空きは '' */
export const COLUMNS: string[][] = [
  'あいうえお',
  'かきくけこ',
  'さしすせそ',
  'たちつてと',
  'なにぬねの',
  'はひふへほ',
  'まみむめも',
  'や_ゆ_よ',
  'らりるれろ',
  'わ_を_ん'
].map((column) => [...column].map((ch) => (ch === '_' ? '' : ch)));

/** 濁点が付く字。Unicode では濁点付きがすぐ次、は行の半濁点はその次に並ぶ */
const VOICED = 'かきくけこさしすせそたちつてとはひふへほ';
const SEMI = 'はひふへほ';
/** 小さい字が付く字。Unicode では小さい字がすぐ前に並ぶ */
const SMALLABLE = 'あいうえおつやゆよわ';
const SMALLS = 'ぁぃぅぇぉっゃゅょゎ';

const shift = (ch: string, by: number) => String.fromCharCode(ch.charCodeAt(0) + by);

export function plain(text: string): string {
  return [...text.normalize('NFD').replace(/[゙゚]/g, '')]
    .map((ch) => (SMALLS.includes(ch) ? shift(ch, 1) : ch))
    .join('');
}

function variants(base: string): string[] {
  const list = [base];
  if (VOICED.includes(base)) list.push(shift(base, 1));
  if (SEMI.includes(base)) list.push(shift(base, 2));
  if (SMALLABLE.includes(base)) list.push(shift(base, -1));
  return list;
}

export function cycle(ch: string): string {
  const list = variants(plain(ch));
  const i = list.indexOf(ch);
  return i < 0 ? ch : list[(i + 1) % list.length];
}

export type Verdict = 'right' | 'close' | 'wrong';

export function judge(word: string, text: string): Verdict {
  if (!text) return 'wrong';
  if (text === word) return 'right';
  return plain(text) === plain(word) ? 'close' : 'wrong';
}
```

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run src/lib/games/oekaki-mori/kana.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/oekaki-mori/kana.ts src/lib/games/oekaki-mori/kana.test.ts
git commit -m "Add the おえかきのもり kana board layout, the dakuten/small cycle and the answer judge"
```

### Task 4: お題 `words.ts`

**Files:**

- Create: `src/lib/games/oekaki-mori/words.ts`
- Test: `src/lib/games/oekaki-mori/words.test.ts`

**Interfaces:**

- Produces: `WORDS: readonly string[]`

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { WORDS } from './words';

describe('WORDS', () => {
  it('150 語以上ある', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(150);
  });

  it('ひらがなと「ー」だけで、2 文字以上', () => {
    for (const word of WORDS) {
      expect(word, word).toMatch(/^[ぁ-んー]+$/);
      expect([...word].length, word).toBeGreaterThanOrEqual(2);
    }
  });

  it('重なりがない', () => {
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/oekaki-mori/words.test.ts`
Expected: FAIL

- [ ] **Step 3: 書く**

子どもが知っていて、絵で描ける言葉だけにする。

```ts
/** 子どもが知っていて、絵にできる言葉。ひらがなで持ち、答えもひらがなで比べる */
export const WORDS: readonly string[] = [
  // どうぶつ・むし
  'いぬ',
  'ねこ',
  'うさぎ',
  'ぞう',
  'きりん',
  'らいおん',
  'ぱんだ',
  'さる',
  'くま',
  'かば',
  'ぶた',
  'うし',
  'うま',
  'ひつじ',
  'やぎ',
  'にわとり',
  'ひよこ',
  'あひる',
  'ぺんぎん',
  'かえる',
  'かめ',
  'へび',
  'わに',
  'たこ',
  'いか',
  'かに',
  'くじら',
  'いるか',
  'さかな',
  'ねずみ',
  'りす',
  'きつね',
  'たぬき',
  'ふくろう',
  'からす',
  'はと',
  'ちょうちょ',
  'とんぼ',
  'せみ',
  'かぶとむし',
  'てんとうむし',
  'あり',
  'はち',
  'かたつむり',
  'くらげ',
  'ひとで',
  'こあら',
  'かんがるー',
  'しまうま',
  'ごりら',
  'あざらし',
  'はりねずみ',
  'くわがた',
  // たべもの
  'りんご',
  'みかん',
  'ばなな',
  'いちご',
  'ぶどう',
  'すいか',
  'めろん',
  'もも',
  'さくらんぼ',
  'れもん',
  'ぱいなっぷる',
  'にんじん',
  'だいこん',
  'とまと',
  'きゅうり',
  'なす',
  'かぼちゃ',
  'たまねぎ',
  'じゃがいも',
  'とうもろこし',
  'きのこ',
  'おにぎり',
  'ぱん',
  'けーき',
  'あいす',
  'どーなつ',
  'ぷりん',
  'ぴざ',
  'らーめん',
  'すし',
  'たまご',
  'はんばーがー',
  'おだんご',
  'ちょこれーと',
  'くっきー',
  'えびふらい',
  'ぎょうざ',
  // もの・のりもの
  'かさ',
  'くつ',
  'ぼうし',
  'めがね',
  'とけい',
  'でんわ',
  'てれび',
  'えんぴつ',
  'はさみ',
  'ほん',
  'かばん',
  'いす',
  'つくえ',
  'べっど',
  'まくら',
  'はぶらし',
  'こっぷ',
  'おさら',
  'すぷーん',
  'ふぉーく',
  'かぎ',
  'ふうせん',
  'たいこ',
  'ぴあの',
  'ぎたー',
  'ぼーる',
  'ろけっと',
  'ひこうき',
  'でんしゃ',
  'くるま',
  'じてんしゃ',
  'ふね',
  'ばす',
  'きゅうきゅうしゃ',
  'しょうぼうしゃ',
  'へりこぷたー',
  'くれよん',
  'ろうそく',
  'まど',
  'てがみ',
  // しぜん・ばしょ・ほか
  'たいよう',
  'つき',
  'ほし',
  'くも',
  'にじ',
  'あめ',
  'ゆき',
  'かみなり',
  'やま',
  'うみ',
  'かわ',
  'はな',
  'さくら',
  'ひまわり',
  'ちゅーりっぷ',
  'いえ',
  'おしろ',
  'がっこう',
  'こうえん',
  'すべりだい',
  'ぶらんこ',
  'ゆきだるま',
  'おばけ',
  'ろぼっと',
  'にんじゃ',
  'おうさま',
  'かいじゅう',
  'はなび',
  'かざん',
  'こおり'
];
```

prettier が 1 行 1 語に崩すなら、そのままでよい。

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run src/lib/games/oekaki-mori/words.test.ts`
Expected: PASS（160 語）

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/oekaki-mori/words.ts src/lib/games/oekaki-mori/words.test.ts
git commit -m "Add 160 kid-friendly hiragana prompts for おえかきのもり"
```

### Task 5: 線の記録と描画 `strokes.ts`

**Files:**

- Create: `src/lib/games/oekaki-mori/strokes.ts`
- Test: `src/lib/games/oekaki-mori/strokes.test.ts`

**Interfaces:**

- Produces:
  - `PENS: readonly { hex: string; name: string }[]`（8 色）
  - `SIZES: readonly number[]`（盤面の幅に対する太さ 3 段）
  - `ERASER: { color: string; size: number }`（地と同じ白で塗る）
  - `interface Stroke { color: string; size: number; pts: number[] }`（x, y を交互に並べる）
  - `type Ink = { k: 'start'; color: string; size: number; x: number; y: number } | { k: 'add'; pts: number[] } | { k: 'undo' } | { k: 'clear' }`
  - `apply(strokes: Stroke[], ink: Ink): Stroke[]`（元の配列は変えずに新しい配列を返す）
  - `render(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void`（白で塗ってから、盤面の幅を 1 として描く）

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import { apply, type Stroke } from './strokes';

const start = (x: number, y: number) => ({ k: 'start' as const, color: '#000', size: 0.01, x, y });

describe('apply', () => {
  it('start で線を始め、add で最後の線に点を足す', () => {
    let s: Stroke[] = [];
    s = apply(s, start(0.1, 0.2));
    s = apply(s, { k: 'add', pts: [0.3, 0.4, 0.5, 0.6] });
    expect(s).toEqual([{ color: '#000', size: 0.01, pts: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] }]);
  });

  it('元の配列と線を書き換えない', () => {
    const before = apply([], start(0, 0));
    const after = apply(before, { k: 'add', pts: [1, 1] });
    expect(before[0].pts).toEqual([0, 0]);
    expect(after).not.toBe(before);
  });

  it('線が無いときの add は何もしない', () => {
    expect(apply([], { k: 'add', pts: [1, 1] })).toEqual([]);
  });

  it('undo は最後の線だけを消し、clear は全部消す', () => {
    let s = apply(apply([], start(0, 0)), start(1, 1));
    s = apply(s, { k: 'undo' });
    expect(s.map((x) => x.pts)).toEqual([[0, 0]]);
    expect(apply(s, { k: 'clear' })).toEqual([]);
    expect(apply([], { k: 'undo' })).toEqual([]);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/oekaki-mori/strokes.test.ts`
Expected: FAIL

- [ ] **Step 3: 書く**

```ts
export const PENS = [
  { hex: '#2b2d42', name: 'くろ' },
  { hex: '#f04438', name: 'あか' },
  { hex: '#63a8f7', name: 'あお' },
  { hex: '#3bb54a', name: 'みどり' },
  { hex: '#ffd84d', name: 'きいろ' },
  { hex: '#f5913e', name: 'オレンジ' },
  { hex: '#f25ea6', name: 'ピンク' },
  { hex: '#8a5a3c', name: 'ちゃいろ' }
] as const;

/** 盤面の幅に対する線の太さ（ほそい・ふつう・ふとい） */
export const SIZES = [0.008, 0.018, 0.04] as const;

/** 盤面の地は白なので、消しゴムは白い太い線で塗る */
export const ERASER = { color: '#ffffff', size: 0.06 };

export interface Stroke {
  color: string;
  size: number;
  /** 盤面に対する 0..1 の x, y を交互に並べる。送る量を減らすため組にしない */
  pts: number[];
}

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

/** canvas の画素の幅を 1 として描く。盤面は正方形なので高さも同じ */
export function render(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  const w = ctx.canvas.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, ctx.canvas.height);
  ctx.setTransform(w, 0, 0, w, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const { color, size, pts } of strokes) {
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    // 点 1 つだけの線（タップ）も丸く見せる
    if (pts.length === 2) ctx.lineTo(pts[0] + 0.0001, pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  }
}
```

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run src/lib/games/oekaki-mori/strokes.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/oekaki-mori/strokes.ts src/lib/games/oekaki-mori/strokes.test.ts
git commit -m "Add the おえかきのもり stroke log with undo and clear, and its canvas renderer"
```

### Task 6: エゴコロクイズのルール `engine.ts`

**Files:**

- Create: `src/lib/games/oekaki-mori/engine.ts`
- Test: `src/lib/games/oekaki-mori/engine.test.ts`

**Interfaces:**

- Consumes: `Seat`（`$lib/net/party.svelte`、型だけ）、`judge` / `Verdict`（`./kana`）、`WORDS`（`./words`）
- Produces:
  - 定数 `DRAW_S = 90`、`PICK_S = 15`、`REVEAL_S = 3`、`ROUNDS = 2`、`HINTS = [45, 20]`、`POINTS = { first: 3, second: 2, drawer: 2 }`
  - `type Phase = 'pick' | 'draw' | 'reveal' | 'done'`
  - `interface Egokoro`（下のコードのとおり）
  - `create(players: Seat[], rand?: () => number, words?: readonly string[]): Egokoro`
  - `drawer(s: Egokoro): Seat`
  - `pick(s: Egokoro, by: Seat, index: number): boolean`
  - `guess(s: Egokoro, by: Seat, text: string): Verdict | null`（受け付けないときは null）
  - `tick(s: Egokoro, dt: number, rand?: () => number, words?: readonly string[]): void`
  - `leave(s: Egokoro, seat: Seat, rand?: () => number, words?: readonly string[]): void`
  - `interface View { phase: Phase; turn: number; turns: number; drawer: Seat; players: Seat[]; scores: Record<number, number>; left: number; choices: string[] | null; word: string | null; mask: string; solved: Seat[] }`
  - `view(s: Egokoro, seat: Seat): View`（`mask` はヒントで見せた字だけを出し、ほかは「○」）

- [ ] **Step 1: 失敗するテストを書く**

```ts
import { describe, expect, it } from 'vitest';
import type { Seat } from '$lib/net/party.svelte';
import { create, drawer, DRAW_S, guess, leave, pick, PICK_S, REVEAL_S, tick, view, type Egokoro } from './engine';

const WORDS = ['ぞう', 'きりん', 'らいおん', 'ねこ', 'いぬ', 'さる', 'くま', 'かば', 'うし', 'うま', 'ぶた', 'やぎ'];
/** 決まった順に出る乱数（お題の選び方とヒントの位置を固定する） */
const fixed = () => 0;

function game(players: Seat[] = [1, 2, 3]): Egokoro {
  return create(players, fixed, WORDS);
}

/** いまの描く人にお題 index を選ばせ、そのお題を返す */
function choose(s: Egokoro, index = 0): string {
  expect(pick(s, drawer(s), index)).toBe(true);
  return s.word;
}

const run = (s: Egokoro, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.25) tick(s, 0.25, fixed, WORDS);
};

describe('create', () => {
  it('1P から描き、全員が 2 回ずつ描く順番を作る', () => {
    const s = game();
    expect(s.order).toEqual([1, 2, 3, 1, 2, 3]);
    expect(drawer(s)).toBe(1);
    expect(s.phase).toBe('pick');
    expect(s.choices).toHaveLength(2);
    expect(s.scores).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});

describe('pick', () => {
  it('描く人だけが、お題を選ぶ時間にだけ選べる', () => {
    const s = game();
    expect(pick(s, 2, 0)).toBe(false);
    expect(pick(s, 1, 5)).toBe(false);
    expect(pick(s, 1, 1)).toBe(true);
    expect(s.word).toBe(s.choices[1]);
    expect(s.phase).toBe('draw');
    expect(s.left).toBe(DRAW_S);
    expect(pick(s, 1, 0)).toBe(false);
  });

  it('選ばないまま時間が過ぎたら 1 つ目の候補にする', () => {
    const s = game();
    run(s, PICK_S + 0.5);
    expect(s.phase).toBe('draw');
    expect(s.word).toBe(s.choices[0]);
  });
});

describe('guess', () => {
  it('当てた順に 3 点・2 点、描いた人は 1 人につき 2 点', () => {
    const s = game();
    const word = choose(s);
    expect(guess(s, 3, word)).toBe('right');
    expect(s.scores).toEqual({ 1: 2, 2: 0, 3: 3 });
    expect(guess(s, 2, word)).toBe('right');
    expect(s.scores).toEqual({ 1: 4, 2: 2, 3: 3 });
  });

  it('全員が当てたらすぐ答えを見せる時間になり、そのあとの答えは受け付けない', () => {
    const s = game([1, 2]);
    const word = choose(s);
    expect(guess(s, 2, word)).toBe('right');
    expect(s.phase).toBe('reveal');
    expect(s.left).toBe(REVEAL_S);
    expect(guess(s, 2, word)).toBeNull();
  });

  it('描く人・当てた人・遊んでいない人・描く時間の外の答えは受け付けない', () => {
    const s = game();
    expect(guess(s, 2, 'ぞう')).toBeNull();
    const word = choose(s);
    expect(guess(s, 1, word)).toBeNull();
    expect(guess(s, 3 as Seat, word)).toBe('right');
    expect(guess(s, 3, word)).toBeNull();
    const two = game([1, 2]);
    choose(two);
    expect(guess(two, 3, 'ぞう')).toBeNull();
  });

  it('おしい・はずれでは点も順番も変わらない', () => {
    const s = game();
    const word = choose(s);
    const near = word === 'ぞう' ? 'そう' : 'x';
    expect(guess(s, 2, 'はずれ')).toBe('wrong');
    if (word === 'ぞう') expect(guess(s, 2, near)).toBe('close');
    expect(s.solved).toEqual([]);
    expect(s.scores).toEqual({ 1: 0, 2: 0, 3: 0 });
  });
});

describe('tick', () => {
  it('残り 45 秒で 1 文字目、残り 20 秒でもう 1 文字を見せる', () => {
    const s = create([1, 2], fixed, ['らいおん', 'きりん']);
    choose(s);
    run(s, DRAW_S - 45 - 0.5);
    expect(s.hints).toEqual([]);
    run(s, 1);
    expect(s.hints).toEqual([0]);
    run(s, 25);
    expect(s.hints).toHaveLength(2);
    expect(s.hints[1]).toBeGreaterThan(0);
  });

  it('2 文字のお題は 2 つ目のヒントを出さない', () => {
    const s = create([1, 2], fixed, ['ねこ', 'いぬ']);
    choose(s);
    run(s, DRAW_S - 1);
    expect(s.hints).toEqual([0]);
  });

  it('時間切れで答えを見せ、3 秒後に次の人の番になる', () => {
    const s = game();
    choose(s);
    run(s, DRAW_S + 0.5);
    expect(s.phase).toBe('reveal');
    run(s, REVEAL_S);
    expect(s.phase).toBe('pick');
    expect(s.turn).toBe(1);
    expect(drawer(s)).toBe(2);
    expect(s.solved).toEqual([]);
    expect(s.hints).toEqual([]);
  });

  it('全員が 2 回描いたら done になり、同じお題は出さない', () => {
    const s = game([1, 2]);
    const seen: string[] = [];
    while (s.phase !== 'done') {
      seen.push(...s.choices);
      choose(s);
      run(s, DRAW_S + REVEAL_S + 1);
    }
    expect(s.turn).toBe(4);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('leave', () => {
  it('描いている人が抜けたら、答えを見せずに次の人の番へ移り、その人の番は飛ばす', () => {
    const s = game();
    choose(s);
    leave(s, 1, fixed, WORDS);
    expect(s.players).toEqual([2, 3]);
    expect(s.phase).toBe('pick');
    expect(drawer(s)).toBe(2);
    expect(s.order.slice(s.turn)).toEqual([2, 3, 2, 3]);
  });

  it('当てる人が抜けて残りが全員当てていたら、答えを見せる', () => {
    const s = game();
    const word = choose(s);
    guess(s, 2, word);
    leave(s, 3, fixed, WORDS);
    expect(s.phase).toBe('reveal');
  });

  it('1 人になったら done。抜けた人の点は残す', () => {
    const s = game([1, 2]);
    const word = choose(s);
    guess(s, 2, word);
    leave(s, 2, fixed, WORDS);
    expect(s.phase).toBe('done');
    expect(s.scores[2]).toBe(3);
  });
});

describe('view', () => {
  it('当てていない人にはお題を渡さず、字数の○とヒントの字だけを渡す', () => {
    const s = create([1, 2, 3], fixed, ['らいおん', 'きりん']);
    const word = choose(s);
    expect(view(s, 1).word).toBe(word);
    expect(view(s, 2).word).toBeNull();
    expect(view(s, 2).mask).toBe('○○○○');
    expect(JSON.stringify(view(s, 2))).not.toContain(word);
    run(s, DRAW_S - 44);
    expect(view(s, 3).mask).toBe('ら○○○');
    guess(s, 2, word);
    expect(view(s, 2).word).toBe(word);
    expect(view(s, 3).word).toBeNull();
  });

  it('お題を選ぶあいだ、候補は描く人にだけ渡す', () => {
    const s = game();
    expect(view(s, 1).choices).toEqual(s.choices);
    expect(view(s, 2).choices).toBeNull();
    expect(JSON.stringify(view(s, 2))).not.toContain(s.choices[0]);
  });

  it('答えを見せる時間は全員にお題を渡し、残り秒は切り上げる', () => {
    const s = game();
    choose(s);
    run(s, DRAW_S + 0.5);
    expect(view(s, 3).word).toBe(s.word);
    expect(Number.isInteger(view(s, 3).left)).toBe(true);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/oekaki-mori/engine.test.ts`
Expected: FAIL

- [ ] **Step 3: 書く**

```ts
import type { Seat } from '$lib/net/party.svelte';
import { judge, type Verdict } from './kana';
import { WORDS } from './words';

export const DRAW_S = 90;
/** 子どもが選べずに止まったままにならないよう、過ぎたら 1 つ目の候補にする */
export const PICK_S = 15;
export const REVEAL_S = 3;
export const ROUNDS = 2;
/** 残り秒がこれを切ったら 1 文字ずつ見せる */
export const HINTS = [45, 20] as const;
export const POINTS = { first: 3, second: 2, drawer: 2 } as const;

export type Phase = 'pick' | 'draw' | 'reveal' | 'done';

/** 親だけが持つ。子へは view() で人ごとに見せる分だけを渡す */
export interface Egokoro {
  players: Seat[];
  /** 抜けた人の点も結果に残すので、players とは別に持つ */
  scores: Record<number, number>;
  /** 描く人の並び。抜けた人のこれからの番は消す */
  order: Seat[];
  turn: number;
  phase: Phase;
  /** いまの段階の残り秒 */
  left: number;
  choices: string[];
  word: string;
  /** 見せた字の位置 */
  hints: number[];
  /** 当てた人を当てた順に */
  solved: Seat[];
  used: string[];
}

export function drawer(s: Egokoro): Seat {
  return s.order[Math.min(s.turn, s.order.length - 1)];
}

const guessers = (s: Egokoro) => s.players.filter((p) => p !== drawer(s));

function draw2(s: Egokoro, rand: () => number, words: readonly string[]): string[] {
  let pool = words.filter((w) => !s.used.includes(w));
  if (pool.length < 2) {
    s.used = [];
    pool = [...words];
  }
  const a = pool.splice(Math.floor(rand() * pool.length), 1)[0];
  const b = pool.splice(Math.floor(rand() * pool.length), 1)[0];
  return [a, b];
}

function begin(s: Egokoro, turn: number, rand: () => number, words: readonly string[]) {
  s.turn = turn;
  s.word = '';
  s.hints = [];
  s.solved = [];
  if (turn >= s.order.length) {
    s.phase = 'done';
    s.choices = [];
    return;
  }
  s.phase = 'pick';
  s.left = PICK_S;
  s.choices = draw2(s, rand, words);
  s.used.push(...s.choices);
}

export function create(players: Seat[], rand = Math.random, words: readonly string[] = WORDS): Egokoro {
  const s: Egokoro = {
    players: [...players],
    scores: Object.fromEntries(players.map((p) => [p, 0])),
    order: Array.from({ length: ROUNDS }, () => players).flat(),
    turn: 0,
    phase: 'pick',
    left: 0,
    choices: [],
    word: '',
    hints: [],
    solved: [],
    used: []
  };
  begin(s, 0, rand, words);
  return s;
}

export function pick(s: Egokoro, by: Seat, index: number): boolean {
  if (s.phase !== 'pick' || by !== drawer(s) || !s.choices[index]) return false;
  s.word = s.choices[index];
  s.phase = 'draw';
  s.left = DRAW_S;
  return true;
}

function reveal(s: Egokoro) {
  s.phase = 'reveal';
  s.left = REVEAL_S;
}

export function guess(s: Egokoro, by: Seat, text: string): Verdict | null {
  if (s.phase !== 'draw' || by === drawer(s) || !s.players.includes(by) || s.solved.includes(by)) return null;
  const verdict = judge(s.word, text);
  if (verdict !== 'right') return verdict;
  s.solved.push(by);
  s.scores[by] += s.solved.length === 1 ? POINTS.first : POINTS.second;
  s.scores[drawer(s)] += POINTS.drawer;
  if (guessers(s).every((p) => s.solved.includes(p))) reveal(s);
  return verdict;
}

export function tick(s: Egokoro, dt: number, rand = Math.random, words: readonly string[] = WORDS): void {
  if (s.phase === 'done') return;
  s.left -= dt;
  if (s.phase === 'pick') {
    if (s.left <= 0) pick(s, drawer(s), 0);
    return;
  }
  if (s.phase === 'reveal') {
    if (s.left <= 0) begin(s, s.turn + 1, rand, words);
    return;
  }
  const n = [...s.word].length;
  if (s.hints.length === 0 && s.left <= HINTS[0]) s.hints.push(0);
  if (s.hints.length === 1 && s.left <= HINTS[1] && n > 2) s.hints.push(1 + Math.floor(rand() * (n - 1)));
  if (s.left <= 0) reveal(s);
}

export function leave(s: Egokoro, seat: Seat, rand = Math.random, words: readonly string[] = WORDS): void {
  if (!s.players.includes(seat)) return;
  const wasDrawing = drawer(s) === seat && (s.phase === 'pick' || s.phase === 'draw');
  s.players = s.players.filter((p) => p !== seat);
  s.order = s.order.filter((p, i) => i <= s.turn || p !== seat);
  if (s.phase === 'done') return;
  if (s.players.length < 2) {
    s.phase = 'done';
    return;
  }
  if (wasDrawing) begin(s, s.turn + 1, rand, words);
  else if (s.phase === 'draw' && guessers(s).every((p) => s.solved.includes(p))) reveal(s);
}

export interface View {
  phase: Phase;
  turn: number;
  turns: number;
  drawer: Seat;
  players: Seat[];
  scores: Record<number, number>;
  /** 切り上げた残り秒 */
  left: number;
  /** お題を選ぶあいだの描く人にだけ */
  choices: string[] | null;
  /** 描く人・当てた人・答えを見せる時間の全員にだけ */
  word: string | null;
  /** 当てる人に見せる字数とヒント。見せていない字は「○」 */
  mask: string;
  solved: Seat[];
}

export function view(s: Egokoro, seat: Seat): View {
  const mine = drawer(s) === seat;
  const knows = s.phase === 'reveal' || (s.phase === 'draw' && (mine || s.solved.includes(seat)));
  return {
    phase: s.phase,
    turn: s.turn,
    turns: s.order.length,
    drawer: drawer(s),
    players: [...s.players],
    scores: { ...s.scores },
    left: Math.max(0, Math.ceil(s.left)),
    choices: s.phase === 'pick' && mine ? [...s.choices] : null,
    word: knows ? s.word : null,
    mask: [...s.word].map((ch, i) => (s.hints.includes(i) ? ch : '○')).join(''),
    solved: [...s.solved]
  };
}
```

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run src/lib/games/oekaki-mori/engine.test.ts`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/lib/games/oekaki-mori/engine.ts src/lib/games/oekaki-mori/engine.test.ts
git commit -m "Add the エゴコロクイズ rules: turns, hints, judging, scoring, leaving players and per-player views"
```

### Task 7: 盤面・道具・50 音盤・れんしゅう

**Files:**

- Create: `src/lib/games/oekaki-mori/Board.svelte`
- Create: `src/lib/games/oekaki-mori/Tools.svelte`
- Create: `src/lib/games/oekaki-mori/KanaPad.svelte`
- Create: `src/lib/games/oekaki-mori/Practice.svelte`
- Create: `src/lib/games/oekaki-mori/sounds.ts`
- Test: `src/lib/games/oekaki-mori/KanaPad.svelte.test.ts`

**Interfaces:**

- Consumes: `apply` / `render` / `PENS` / `SIZES` / `ERASER` / `Ink` / `Stroke`（Task 5）、`COLUMNS` / `cycle`（Task 3）、`BoardInput`（`$lib/board-input`）、`animate`（`$lib/loop`）、`tone` / `sweep`（`$lib/audio.svelte`）
- Produces:
  - `<Board strokes={Stroke[]} pen={{ color: string; size: number } | null} onink={(ink: Ink) => void} />`（pen が null なら見るだけ）
  - `<Tools bind:color bind:size bind:erasing onundo onclear />`（size は `SIZES` の添え字）
  - `<KanaPad disabled={boolean} onsubmit={(text: string) => void} />`
  - `<Practice onback={() => void} />`
  - `sounds`：`right()` / `close()` / `wrong()` / `turn()`

- [ ] **Step 1: 50 音盤の失敗するテストを書く**

`KanaPad.svelte.test.ts`

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KanaPad from './KanaPad.svelte';

function show(disabled = false) {
  const onsubmit = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(KanaPad, { target, props: { disabled, onsubmit } });
  flushSync();
  const press = (label: string) => {
    const key = [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === label);
    if (!key) throw new Error(`no key ${label}`);
    key.click();
    flushSync();
  };
  const typed = () => target.querySelector('.typed')?.textContent;
  return { app, onsubmit, press, typed };
}

describe('KanaPad', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('押した字をつなげ、゛゜小で最後の字を変え、こたえるで送って空にする', () => {
    const { app, onsubmit, press, typed } = show();
    press('そ');
    press('゛゜小');
    press('う');
    expect(typed()).toBe('ぞう');
    press('こたえる');
    expect(onsubmit).toHaveBeenCalledWith('ぞう');
    expect(typed()).not.toBe('ぞう');
    unmount(app);
  });

  it('空のときの゛゜小と 1じ けす は何もせず、こたえるは送らない', () => {
    const { app, onsubmit, press } = show();
    press('゛゜小');
    press('1じ けす');
    press('こたえる');
    expect(onsubmit).not.toHaveBeenCalled();
    unmount(app);
  });

  it('使えないあいだは送らない', () => {
    const { app, onsubmit, press } = show(true);
    press('い');
    press('こたえる');
    expect(onsubmit).not.toHaveBeenCalled();
    unmount(app);
  });
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `pnpm vitest run src/lib/games/oekaki-mori/KanaPad.svelte.test.ts`
Expected: FAIL

- [ ] **Step 3: `KanaPad.svelte` を書く**

50 音表のポスターと同じく、あ行を右端に置いて左へ並べる。

```svelte
<script lang="ts">
  import { COLUMNS, cycle } from './kana';

  let { disabled = false, onsubmit }: { disabled?: boolean; onsubmit: (text: string) => void } = $props();

  const MAX = 10;
  let text = $state('');

  const put = (ch: string) => {
    if (!disabled && text.length < MAX) text += ch;
  };
  const turn = () => {
    if (!disabled && text) text = text.slice(0, -1) + cycle(text.slice(-1));
  };
  function send() {
    if (disabled || !text) return;
    onsubmit(text);
    text = '';
  }
</script>

<div class="pad">
  <p class="typed" aria-live="polite">{text || 'こたえを いれてね'}</p>
  <div class="keys">
    {#each COLUMNS as column, x (x)}
      {#each column as ch, y (y)}
        {#if ch}
          <button
            class="key"
            style:grid-column={COLUMNS.length - x}
            style:grid-row={y + 1}
            {disabled}
            onclick={() => put(ch)}>{ch}</button
          >
        {/if}
      {/each}
    {/each}
  </div>
  <div class="row">
    <button class="key wide" {disabled} aria-label="だくてん・はんだくてん・ちいさいじ" onclick={turn}>゛゜小</button>
    <button class="key" {disabled} onclick={() => put('ー')}>ー</button>
    <button class="key wide" {disabled} onclick={() => (text = text.slice(0, -1))}>1じ けす</button>
    <button class="pill gold send" disabled={disabled || !text} onclick={send}>こたえる</button>
  </div>
</div>

<style>
  .pad {
    display: grid;
    gap: 6px;
    padding: 8px max(8px, env(safe-area-inset-left)) max(8px, env(safe-area-inset-bottom));
    background: var(--paper);
    border-top: 3px solid var(--line);
  }

  .typed {
    min-height: 1.6em;
    font-size: clamp(20px, 3.4cqh, 30px);
    font-weight: 800;
    color: var(--line);
    text-align: center;
    letter-spacing: 0.1em;
  }

  .keys {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 4px;
  }

  .row {
    display: flex;
    gap: 6px;
  }

  .key {
    min-height: clamp(34px, 5.2cqh, 54px);
    border: 2px solid var(--line);
    border-radius: 10px;
    background: #fff;
    color: var(--line);
    font-size: clamp(16px, 2.6cqh, 24px);
    font-weight: 800;
    box-shadow: var(--soft-press);
    cursor: pointer;
  }

  .key:active {
    translate: 0 2px;
    box-shadow: none;
  }

  .key.wide {
    flex: 1;
    font-size: clamp(14px, 2.2cqh, 20px);
  }

  .send {
    flex: 1.4;
    padding: 8px 12px;
  }

  button:disabled {
    opacity: 0.45;
  }
</style>
```

- [ ] **Step 4: テストを通す**

Run: `pnpm vitest run src/lib/games/oekaki-mori/KanaPad.svelte.test.ts`
Expected: PASS

- [ ] **Step 5: `Board.svelte` を書く**

指は `BoardInput` で読み、らくがきパレードと同じくフレームごとに指の位置を拾う。描く人の端末では 1 本目の指だけで描く（2 本目は手のひらのことが多い）。

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { BoardInput } from '$lib/board-input';
  import { animate } from '$lib/loop';
  import { render, type Ink, type Stroke } from './strokes';

  let {
    strokes,
    pen = null,
    onink
  }: { strokes: Stroke[]; pen?: { color: string; size: number } | null; onink?: (ink: Ink) => void } = $props();

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D | null = null;
  /** 描いている指。手のひらが先に触れても、描くのは最初の 1 本だけ */
  let finger: number | null = null;
  let last: [number, number] = [0, 0];

  function add(x: number, y: number) {
    if (Math.hypot(x - last[0], y - last[1]) < 0.003) return;
    last = [x, y];
    onink?.({ k: 'add', pts: [x, y] });
  }

  const input = new BoardInput({
    down: (event, x, y) => {
      if (!pen || finger !== null) return;
      finger = event.pointerId;
      last = [x, y];
      onink?.({ k: 'start', color: pen.color, size: pen.size, x, y });
    },
    up: (event, _finger, x, y) => {
      if (event.pointerId !== finger) return;
      add(x, y);
      finger = null;
    }
  });

  function resize() {
    const [w, h] = input.px(1, 1);
    const dpr = devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx = canvas.getContext('2d');
    if (ctx) render(ctx, strokes);
  }

  $effect(() => {
    // ctx より先に strokes を読む。ctx が無い最初の回に strokes を読まないと、この effect が何も追わなくなる
    const next = strokes;
    if (ctx) render(ctx, next);
  });

  onMount(() =>
    animate(() => {
      if (finger === null) return;
      const f = input.fingers.all.get(finger);
      if (f) add(f.x, f.y);
    })
  );
</script>

<div class="board" class:live={pen} use:input.board={resize}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .board {
    position: relative;
    width: min(100cqw, 100cqh);
    aspect-ratio: 1;
    border: 3px solid var(--line);
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    touch-action: none;
  }

  .board.live {
    cursor: crosshair;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
```

`ctx` は `$state` にしない。大きさが変わったときは `resize` が描き直すので、effect は `strokes` の変化だけを追えばよい。

- [ ] **Step 6: `Tools.svelte` を書く**

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import { PENS, SIZES } from './strokes';

  let {
    color = $bindable(),
    size = $bindable(),
    erasing = $bindable(),
    onundo,
    onclear
  }: { color: string; size: number; erasing: boolean; onundo: () => void; onclear: () => void } = $props();

  const NAMES = ['ほそい', 'ふつう', 'ふとい'];
</script>

<div class="tools">
  <div class="pens">
    {#each PENS as p (p.hex)}
      <button
        class="swatch"
        style:background={p.hex}
        aria-label={p.name}
        aria-pressed={!erasing && color === p.hex}
        onclick={() => {
          color = p.hex;
          erasing = false;
        }}
      ></button>
    {/each}
  </div>
  <div class="row">
    {#each SIZES as _, i (i)}
      <button
        class="tool"
        aria-label={NAMES[i]}
        aria-pressed={!erasing && size === i}
        onclick={() => {
          size = i;
          erasing = false;
        }}><span class="dot" style:width="{6 + i * 8}px" style:background={color}></span></button
      >
    {/each}
    <button class="tool text" aria-pressed={erasing} onclick={() => (erasing = true)}>けしごむ</button>
    <button class="tool" aria-label="1つ もどす" onclick={onundo}><Icon name="undo" size="70%" /></button>
    <button class="tool text" onclick={onclear}>ぜんぶ けす</button>
  </div>
</div>

<style>
  .tools {
    --size: clamp(34px, min(5.4cqh, 9cqw), 52px);
    display: grid;
    gap: 8px;
    justify-items: center;
    padding: 8px 8px max(8px, env(safe-area-inset-bottom));
    border-top: 3px solid var(--line);
    background: var(--paper);
  }

  .pens,
  .row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: clamp(4px, 1.4cqw, 10px);
  }

  .swatch,
  .tool {
    display: grid;
    place-items: center;
    min-width: var(--size);
    height: var(--size);
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-weight: 800;
    cursor: pointer;
  }

  .tool.text {
    padding: 0 12px;
    font-size: clamp(13px, 2cqh, 17px);
  }

  [aria-pressed='true'] {
    outline: 4px solid var(--pastel-gold);
    outline-offset: 2px;
  }

  .dot {
    aspect-ratio: 1;
    border-radius: 50%;
  }
</style>
```

- [ ] **Step 7: `sounds.ts` と `Practice.svelte` を書く**

`sounds.ts`

```ts
import { sweep, tone } from '$lib/audio.svelte';

export const sounds = {
  right: () => {
    tone(784, 120);
    tone(1047, 220, 'triangle', 0.14, 110);
  },
  close: () => tone(523, 160, 'sine', 0.12),
  wrong: () => tone(247, 110, 'square', 0.05),
  turn: () => sweep(440, 880, 220)
};
```

`Practice.svelte`（ひとりで描いてみる画面。一覧の絵もここで撮る）

```svelte
<script lang="ts">
  import Board from './Board.svelte';
  import { apply, ERASER, PENS, SIZES, type Stroke } from './strokes';
  import Tools from './Tools.svelte';

  let { onback }: { onback: () => void } = $props();

  let strokes = $state.raw<Stroke[]>([]);
  let color = $state<string>(PENS[0].hex);
  let size = $state(1);
  let erasing = $state(false);
  const pen = $derived(erasing ? ERASER : { color, size: SIZES[size] });
</script>

<header class="bar">
  <button class="pill" onclick={onback}>もどる</button>
  <p class="title">ひとりで れんしゅう</p>
</header>
<div class="middle">
  <Board {strokes} {pen} onink={(ink) => (strokes = apply(strokes, ink))} />
</div>
<Tools
  bind:color
  bind:size
  bind:erasing
  onundo={() => (strokes = apply(strokes, { k: 'undo' }))}
  onclear={() => (strokes = [])}
/>

<style>
  .bar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: max(8px, env(safe-area-inset-top)) 12px 8px;
  }

  .title {
    font-weight: 800;
    color: var(--line);
  }

  .middle {
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    padding: 8px;
    container-type: size;
  }
</style>
```

- [ ] **Step 8: 検査**

Run: `pnpm check && pnpm lint && pnpm vitest run src/lib/games/oekaki-mori`
Expected: エラーなし・PASS

- [ ] **Step 9: コミット**

```bash
git add src/lib/games/oekaki-mori
git commit -m "Add the おえかきのもり board, drawing tools, kana pad and practice sheet"
```

### Task 8: ロビー・遊ぶ画面・結果と、親のルール係 `Referee`

**Files:**

- Create: `src/lib/games/oekaki-mori/referee.ts`
- Create: `src/lib/games/oekaki-mori/Lobby.svelte`
- Create: `src/lib/games/oekaki-mori/ModeSelect.svelte`
- Create: `src/lib/games/oekaki-mori/TopBar.svelte`
- Create: `src/lib/games/oekaki-mori/Bubbles.svelte`
- Create: `src/lib/games/oekaki-mori/Play.svelte`
- Create: `src/lib/games/oekaki-mori/Result.svelte`
- Create: `src/lib/games/oekaki-mori/OekakiMori.svelte`
- Modify: `src/app.css`（`--p3` 系と `.pill.p3`）

**Interfaces:**

- Consumes: `Party` / `Seat`（Task 1）、`Handshake`（Task 2）、`create` / `pick` / `guess` / `tick` / `leave` / `view` / `View`（Task 6）、`apply` / `Ink` / `Stroke` / `ERASER` / `PENS` / `SIZES`（Task 5）、`Board` / `Tools` / `KanaPad` / `Practice` / `sounds`（Task 7）
- Produces:
  - 操作（act）：`{ t: 'pick', index }`、`{ t: 'ink', ink: Ink }`、`{ t: 'guess', text }`
  - 知らせ（tell）：`{ t: 'screen', screen: 'lobby' | 'mode' }`、`{ t: 'view', view: View }`、`{ t: 'ink', ink: Ink }`、`{ t: 'bubble', seat: Seat, text: string }`、`{ t: 'close' }`
  - `class Referee { constructor(party: Party); start(): void; stop(): void }`
  - `OekakiMori.svelte`（props なし。Task 9 の `load()` が返す `Game`）

- [ ] **Step 1: `app.css` に 3P の色を足す**

`:root` の `--p2-soft` の次に足す。

```css
--p3: #2fb24a;
--p3-soft: #dcf5df;
```

`--pastel-p2` の次に足す。

```css
--pastel-p3: #9fe0a6;
```

`.pill.p2` の次に足す。

```css
.pill.p3 {
  --face: var(--pastel-p3);
}
```

- [ ] **Step 2: `referee.ts` を書く**

```ts
import { animate } from '$lib/loop';
import type { Message } from '$lib/net/link';
import type { Party, Seat } from '$lib/net/party.svelte';
import { create, drawer, guess, leave, pick, tick, view, type Egokoro } from './engine';

/**
 * 親の端末だけで動く。遊ぶ人の操作を受けてルールを進め、人ごとの見え方を配る。
 * 見え方は前に送ったものと変わったときだけ送る（残り秒が 1 秒変わるたびに 1 回ほど）
 */
export class Referee {
  readonly #party: Party;
  #state: Egokoro | null = null;
  #sent = new Map<Seat, string>();
  #stop: (() => void)[] = [];

  constructor(party: Party) {
    this.#party = party;
  }

  start(): void {
    this.#state = create(this.#party.members);
    this.#stop.push(
      this.#party.onAct((message, from) => this.#act(message, from)),
      animate((dt) => {
        if (!this.#state) return;
        tick(this.#state, dt);
        this.#push();
      })
    );
    this.#push();
  }

  stop(): void {
    for (const stop of this.#stop.splice(0)) stop();
    this.#state = null;
  }

  #act(message: Message, from: Seat) {
    const s = this.#state;
    if (!s) return;
    if (message.t === 'pick') pick(s, from, Number(message.index));
    else if (message.t === 'ink') {
      // 描く人の端末は自分で描いているので、ほかの人にだけ配る
      if (s.phase !== 'draw' || from !== drawer(s)) return;
      for (const seat of this.#party.members) if (seat !== from) this.#party.tell(seat, message);
    } else if (message.t === 'guess') {
      const text = String(message.text);
      const verdict = guess(s, from, text);
      if (verdict === 'wrong') this.#party.tell('all', { t: 'bubble', seat: from, text });
      else if (verdict === 'close') this.#party.tell(from, { t: 'close' });
    } else if (message.t === 'leave') leave(s, from);
    this.#push();
  }

  #push() {
    const s = this.#state;
    if (!s) return;
    for (const seat of this.#party.members) {
      const next = view(s, seat);
      const key = JSON.stringify(next);
      if (this.#sent.get(seat) === key) continue;
      this.#sent.set(seat, key);
      this.#party.tell(seat, { t: 'view', view: next });
    }
  }
}
```

- [ ] **Step 3: `Lobby.svelte` を書く**

```svelte
<script lang="ts">
  import Handshake from '$lib/net/Handshake.svelte';
  import type { Link } from '$lib/net/link';
  import { Party } from '$lib/net/party.svelte';

  let {
    party,
    note = '',
    onparty,
    onstart,
    onpractice
  }: {
    party: Party | null;
    note?: string;
    onparty: (party: Party) => void;
    onstart: () => void;
    onpractice: () => void;
  } = $props();

  let joining = $state<'host' | 'guest' | null>(null);
  let failed = $state('');

  function linked(link: Link) {
    if (joining === 'host') {
      const p = party ?? Party.host();
      p.add(link);
      if (!party) onparty(p);
    } else onparty(Party.guest(link));
    joining = null;
  }

  function join(as: 'host' | 'guest') {
    failed = '';
    joining = as;
  }
</script>

<div class="lobby">
  <h1 class="yuru">おえかきのもり</h1>
  {#if joining}
    <Handshake
      role={joining}
      onlink={linked}
      onfail={(text) => {
        failed = text;
        joining = null;
      }}
    />
    <button class="pill" onclick={() => (joining = null)}>やめる</button>
  {:else if !party}
    <p>2〜3にんで、ひとり 1だいずつ つかって あそぶよ</p>
    <button class="pill p1" onclick={() => join('host')}>なかまを よぶ（QR を だす）</button>
    <button class="pill p2" onclick={() => join('guest')}>QR を よみとる</button>
    <button class="pill practice" onclick={onpractice}>ひとりで れんしゅう</button>
  {:else}
    <ul class="members">
      {#each party.members as seat (seat)}
        <li class="pill p{seat}">{seat}P{seat === party.me ? '（あなた）' : ''}</li>
      {/each}
    </ul>
    {#if party.host}
      {#if party.members.length < 3}
        <button class="pill p1" onclick={() => join('host')}>
          {party.members.length < 2 ? 'なかまを よぶ' : 'もうひとり よぶ'}
        </button>
      {/if}
      <button class="pill gold" disabled={party.members.length < 2} onclick={onstart}>はじめる</button>
    {:else}
      <p role="status">おやが はじめるのを まってね</p>
    {/if}
  {/if}
  {#if failed || note}<p role="alert">{failed || note}</p>{/if}
</div>

<style>
  .lobby {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 16px;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 700;
    text-align: center;
  }

  h1 {
    font-size: clamp(28px, min(6cqh, 9cqw), 52px);
  }

  .members {
    display: flex;
    gap: 10px;
    list-style: none;
  }
</style>
```

- [ ] **Step 4: `ModeSelect.svelte` を書く**

```svelte
<script lang="ts">
  import type { Party } from '$lib/net/party.svelte';

  let { party, onpick, onlobby }: { party: Party; onpick: () => void; onlobby: () => void } = $props();
</script>

<div class="mode">
  <h2 class="yuru">あそびかた</h2>
  {#if party.host}
    <button class="pill gold choice" disabled={party.members.length < 2} onclick={onpick}>
      エゴコロクイズ
      <small>ひとりが おだいを かいて、みんなで あてる</small>
    </button>
    {#if party.members.length < 2}<p role="alert">なかまが いなくなりました</p>{/if}
    <button class="pill" onclick={onlobby}>なかまを よびなおす</button>
  {:else}
    <p role="status">おやが あそびかたを えらんでいます…</p>
  {/if}
</div>

<style>
  .mode {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 700;
    text-align: center;
  }

  h2 {
    font-size: clamp(26px, min(5cqh, 8cqw), 44px);
  }

  .choice {
    flex-direction: column;
    font-size: clamp(20px, 3.2cqh, 28px);
  }

  .choice small {
    font-size: 0.6em;
  }
</style>
```

- [ ] **Step 5: `TopBar.svelte` と `Bubbles.svelte` を書く**

`TopBar.svelte`

```svelte
<script lang="ts">
  import type { Seat } from '$lib/net/party.svelte';
  import type { View } from './engine';

  let { view, me }: { view: View; me: Seat } = $props();
  const drawing = $derived(view.drawer === me);
</script>

<header class="bar">
  <p class="word" aria-live="polite">
    {#if view.phase === 'pick'}
      {drawing ? 'かく ものを えらんでね' : `${view.drawer}P が えらんでいます`}
    {:else if view.word}
      {drawing ? 'おだい' : 'こたえ'} <b>{view.word}</b>
    {:else}
      <b class="mask">{view.mask}</b> {[...view.mask].length}もじ
    {/if}
  </p>
  <p class="left" class:hurry={view.phase === 'draw' && view.left <= 10}>{view.left}</p>
  <ul class="scores">
    {#each view.players as seat (seat)}
      <li class="p{seat}" class:drawer={seat === view.drawer} class:solved={view.solved.includes(seat)}>
        {seat}P{seat === me ? '（あなた）' : ''}
        {view.scores[seat]}
      </li>
    {/each}
  </ul>
</header>

<style>
  .bar {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    align-items: center;
    padding: max(8px, env(safe-area-inset-top)) 12px 8px;
    border-bottom: 3px solid var(--line);
    background: var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .word {
    font-size: clamp(18px, 3cqh, 28px);
  }

  .mask {
    letter-spacing: 0.15em;
  }

  .left {
    font-size: clamp(22px, 4cqh, 36px);
  }

  .left.hurry {
    color: var(--p2);
  }

  .scores {
    grid-column: 1 / -1;
    display: flex;
    gap: 8px;
    list-style: none;
  }

  .scores li {
    padding: 2px 10px;
    border: 2px solid var(--line);
    border-radius: 999px;
    font-size: clamp(13px, 2cqh, 17px);
  }

  .scores .p1 {
    background: var(--pastel-p1);
  }

  .scores .p2 {
    background: var(--pastel-p2);
  }

  .scores .p3 {
    background: var(--pastel-p3);
  }

  .scores .drawer {
    outline: 3px solid var(--line);
  }

  .scores .solved::after {
    content: ' ○';
  }
</style>
```

`Bubbles.svelte`

```svelte
<script module lang="ts">
  import type { Seat } from '$lib/net/party.svelte';

  export interface Bubble {
    id: number;
    seat: Seat;
    text: string;
  }
</script>

<script lang="ts">
  let { bubbles }: { bubbles: Bubble[] } = $props();
</script>

<ul class="bubbles" aria-live="polite">
  {#each bubbles as b (b.id)}
    <li class="bubble p{b.seat}">{b.seat}P「{b.text}」</li>
  {/each}
</ul>

<style>
  .bubbles {
    position: absolute;
    top: 8px;
    left: 8px;
    right: 8px;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    list-style: none;
    pointer-events: none;
  }

  .bubble {
    padding: 4px 12px;
    border: 2px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-weight: 800;
    animation: pop 240ms var(--spring) both;
  }

  .bubble.p1 {
    background: var(--pastel-p1);
  }

  .bubble.p2 {
    background: var(--pastel-p2);
  }

  .bubble.p3 {
    background: var(--pastel-p3);
  }

  @media (prefers-reduced-motion: reduce) {
    .bubble {
      animation: none;
    }
  }
</style>
```

`pop` の keyframes が `app.css` に無ければ、`Bubbles.svelte` の中に `@keyframes pop { from { scale: 0.6; opacity: 0 } }` を足す。

- [ ] **Step 6: `Play.svelte` を書く**

```svelte
<script lang="ts">
  import type { Seat } from '$lib/net/party.svelte';
  import Board from './Board.svelte';
  import Bubbles, { type Bubble } from './Bubbles.svelte';
  import type { View } from './engine';
  import KanaPad from './KanaPad.svelte';
  import { ERASER, PENS, SIZES, type Ink, type Stroke } from './strokes';
  import Tools from './Tools.svelte';
  import TopBar from './TopBar.svelte';

  let {
    view,
    me,
    strokes,
    bubbles,
    close,
    onink,
    onguess,
    onpick
  }: {
    view: View;
    me: Seat;
    strokes: Stroke[];
    bubbles: Bubble[];
    close: boolean;
    onink: (ink: Ink) => void;
    onguess: (text: string) => void;
    onpick: (index: number) => void;
  } = $props();

  let color = $state<string>(PENS[0].hex);
  let size = $state(1);
  let erasing = $state(false);
  const drawing = $derived(view.drawer === me);
  const pen = $derived(drawing && view.phase === 'draw' ? (erasing ? ERASER : { color, size: SIZES[size] }) : null);
  const solved = $derived(view.solved.includes(me));
</script>

<TopBar {view} {me} />
<div class="middle">
  <Board {strokes} {pen} {onink} />
  <Bubbles {bubbles} />
  {#if view.phase === 'pick'}
    <div class="cover">
      {#if view.choices}
        <p>どっちを かく？</p>
        {#each view.choices as word, i (word)}
          <button class="pill gold" onclick={() => onpick(i)}>{word}</button>
        {/each}
      {:else}
        <p>{view.drawer}P が かくものを えらんでいます</p>
      {/if}
    </div>
  {:else if view.phase === 'reveal'}
    <div class="cover"><p>こたえは「{view.word}」</p></div>
  {/if}
  {#if close}<p class="flash">おしい！</p>{/if}
  {#if solved && view.phase === 'draw'}<p class="flash right">せいかい！</p>{/if}
</div>
{#if drawing}
  <Tools bind:color bind:size bind:erasing onundo={() => onink({ k: 'undo' })} onclear={() => onink({ k: 'clear' })} />
{:else}
  <KanaPad disabled={view.phase !== 'draw' || solved} onsubmit={onguess} />
{/if}

<style>
  .middle {
    position: relative;
    flex: 1;
    display: grid;
    place-items: center;
    min-height: 0;
    padding: 8px;
    container-type: size;
  }

  .cover {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgb(255 250 244 / 0.9);
    color: var(--line);
    font-size: clamp(20px, 4cqh, 32px);
    font-weight: 800;
  }

  .cover .pill {
    min-width: 50%;
    font-size: clamp(22px, 5cqh, 36px);
  }

  .flash {
    position: absolute;
    bottom: 12px;
    padding: 6px 18px;
    border: 3px solid var(--line);
    border-radius: 999px;
    background: #fff;
    color: var(--line);
    font-size: clamp(18px, 3.4cqh, 28px);
    font-weight: 800;
    pointer-events: none;
  }

  .flash.right {
    background: var(--pastel-gold);
  }
</style>
```

- [ ] **Step 7: `Result.svelte` を書く**

```svelte
<script module lang="ts">
  import type { Seat } from '$lib/net/party.svelte';
  import type { Stroke } from './strokes';

  export interface Drawing {
    word: string;
    by: Seat;
    strokes: Stroke[];
  }
</script>

<script lang="ts">
  import Board from './Board.svelte';
  import type { View } from './engine';

  let {
    view,
    me,
    gallery,
    host,
    onagain
  }: { view: View; me: Seat; gallery: Drawing[]; host: boolean; onagain: () => void } = $props();

  const ranking = $derived(
    Object.entries(view.scores)
      .map(([seat, points]) => ({ seat: Number(seat) as Seat, points }))
      .sort((a, b) => b.points - a.points)
  );
  const rank = (points: number) => 1 + ranking.filter((r) => r.points > points).length;
</script>

<div class="result">
  <h2 class="yuru">けっか</h2>
  <ol class="ranking">
    {#each ranking as r (r.seat)}
      <li class="pill p{r.seat}">{rank(r.points)}い {r.seat}P{r.seat === me ? '（あなた）' : ''} {r.points}てん</li>
    {/each}
  </ol>
  <ul class="gallery">
    {#each gallery as d, i (i)}
      <li>
        <div class="thumb"><Board strokes={d.strokes} /></div>
        <span class="p{d.by}">{d.by}P「{d.word}」</span>
      </li>
    {/each}
  </ul>
  {#if host}
    <button class="pill gold" onclick={onagain}>もういちど</button>
  {:else}
    <p role="status">おやが つぎを えらぶのを まってね</p>
  {/if}
</div>

<style>
  .result {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px;
    overflow-y: auto;
    touch-action: pan-y;
    background: var(--paper-dots), var(--paper);
    color: var(--line);
    font-weight: 800;
  }

  .ranking {
    display: grid;
    gap: 8px;
    list-style: none;
  }

  .gallery {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    width: min(100%, 560px);
    list-style: none;
  }

  .gallery li {
    display: grid;
    gap: 4px;
    justify-items: center;
    font-size: 14px;
  }

  .thumb {
    width: 100%;
    aspect-ratio: 1;
    container-type: size;
  }
</style>
```

- [ ] **Step 8: `OekakiMori.svelte` を書く**

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { resolve } from '$app/paths';
  import type { Message } from '$lib/net/link';
  import type { Party, Seat } from '$lib/net/party.svelte';
  import type { Bubble } from './Bubbles.svelte';
  import type { View } from './engine';
  import Lobby from './Lobby.svelte';
  import ModeSelect from './ModeSelect.svelte';
  import Play from './Play.svelte';
  import Practice from './Practice.svelte';
  import { Referee } from './referee';
  import Result, { type Drawing } from './Result.svelte';
  import { sounds } from './sounds';
  import { apply, type Ink, type Stroke } from './strokes';

  let party = $state.raw<Party | null>(null);
  let screen = $state<'lobby' | 'mode' | 'play' | 'result' | 'practice'>('lobby');
  let view = $state.raw<View | null>(null);
  let strokes = $state.raw<Stroke[]>([]);
  let bubbles = $state.raw<Bubble[]>([]);
  let gallery = $state.raw<Drawing[]>([]);
  let close = $state(false);
  let note = $state('');
  let referee: Referee | null = null;
  let bubbleId = 0;

  function joined(next: Party) {
    note = '';
    party = next;
    next.onTell(receive);
  }

  function receive(m: Message) {
    if (m.t === 'screen') {
      screen = m.screen as 'lobby' | 'mode';
      view = null;
      strokes = [];
      gallery = [];
    } else if (m.t === 'view') show(m.view as View);
    else if (m.t === 'ink') strokes = apply(strokes, m.ink as Ink);
    else if (m.t === 'bubble') {
      const b: Bubble = { id: ++bubbleId, seat: m.seat as Seat, text: String(m.text) };
      bubbles = [...bubbles.slice(-4), b];
      setTimeout(() => (bubbles = bubbles.filter((x) => x !== b)), 3000);
      sounds.wrong();
    } else if (m.t === 'close') {
      close = true;
      setTimeout(() => (close = false), 1500);
      sounds.close();
    }
  }

  function show(next: View) {
    const prev = view;
    if (prev && next.turn !== prev.turn) {
      strokes = [];
      sounds.turn();
    }
    if (prev?.phase === 'draw' && next.phase === 'reveal')
      gallery = [...gallery, { word: next.word ?? '', by: next.drawer, strokes }];
    if (prev && next.solved.length > prev.solved.length) sounds.right();
    view = next;
    screen = next.phase === 'done' ? 'result' : 'play';
  }

  function ink(i: Ink) {
    strokes = apply(strokes, i);
    party?.act({ t: 'ink', ink: i });
  }

  function begin() {
    referee?.stop();
    referee = new Referee(party!);
    referee.start();
  }

  function toMode() {
    referee?.stop();
    referee = null;
    party?.tell('all', { t: 'screen', screen: 'mode' });
  }

  // 親とのつながりが切れた子は、ロビーからつなぎ直す
  $effect(() => {
    if (!party?.lost) return;
    party = null;
    screen = 'lobby';
    note = 'つながりが きれました';
  });

  onDestroy(() => {
    referee?.stop();
    party?.close();
  });
</script>

<svelte:window onpagehide={() => party?.close()} />

<main class="stage mori">
  {#if screen === 'practice'}
    <Practice onback={() => (screen = 'lobby')} />
  {:else if screen === 'lobby' || !party}
    <Lobby {party} {note} onparty={joined} onstart={toMode} onpractice={() => (screen = 'practice')} />
  {:else if screen === 'mode'}
    <ModeSelect {party} onpick={begin} onlobby={() => party?.tell('all', { t: 'screen', screen: 'lobby' })} />
  {:else if screen === 'play' && view}
    <Play
      {view}
      me={party.me}
      {strokes}
      {bubbles}
      {close}
      onink={ink}
      onguess={(text) => party?.act({ t: 'guess', text })}
      onpick={(index) => party?.act({ t: 'pick', index })}
    />
  {:else if screen === 'result' && view}
    <Result {view} me={party.me} {gallery} host={party.host} onagain={toMode} />
  {/if}
  {#if screen !== 'play' && screen !== 'practice'}
    <a class="round back" href={resolve('/')} aria-label="ゲーム選択へ戻る">✕</a>
  {/if}
</main>

<style>
  .mori {
    background: var(--paper);
  }

  .back {
    position: absolute;
    top: max(10px, env(safe-area-inset-top));
    left: max(10px, env(safe-area-inset-left));
  }
</style>
```

- [ ] **Step 9: 検査**

Run: `pnpm check && pnpm lint && pnpm vitest run src/lib/games/oekaki-mori && pnpm vitals --diff`
Expected: エラーなし。vitals の `component-size` が出たら、その部品の `<style>` を分けるか、部品を分けて 200 行未満にする

- [ ] **Step 10: コミット**

```bash
git add src/app.css src/lib/games/oekaki-mori
git commit -m "Add the おえかきのもり lobby, mode select, play and result screens and the host-side referee"
```

### Task 9: 一覧に載せる（1 人 1 台の種類・ページ・カード・一覧の絵）

**Files:**

- Modify: `src/lib/games.ts`（`PartyMeta` と登録）
- Create: `src/lib/games/oekaki-mori/meta.ts`
- Modify: `src/routes/games/[id]/+page.ts`
- Modify: `src/routes/games/[id]/+page.svelte`
- Modify: `src/lib/components/GameCard.svelte`
- Modify: `src/lib/components/GameCard.svelte.test.ts`
- Modify: `src/lib/games.test.ts`
- Modify: `scripts/thumbs/scenes.ts`
- Create: `static/thumbs/oekaki-mori.webp`（`pnpm thumbs oekaki-mori` で撮る）

**Interfaces:**

- Consumes: `OekakiMori.svelte`（Task 8）、`Practice.svelte` の「ひとりで れんしゅう」ボタン（`button.practice`、Task 8 の Lobby）と道具の `aria-label`（Task 7）
- Produces:
  - `interface PartyMeta extends BaseMeta { players: 2; party: true; load: () => Promise<{ Game: Component }> }`
  - `type GameMeta = DuelMeta | SoloMeta | PartyMeta`
  - ページの `data.play.kind: 'solo' | 'duel' | 'party'`

- [ ] **Step 1: カードとゲーム一覧のテストを先に直す**

`GameCard.svelte.test.ts` に足す。

```ts
it('1 人 1 台で遊ぶゲームには「2〜3にん」を出す', () => {
  const party = {
    id: 'stub',
    name: 'スタブ',
    description: '',
    minutes: '10分',
    players: 2 as const,
    party: true as const,
    load: async () => ({ Game: StubGame })
  };
  const { target, app } = show(party);
  expect(target.querySelector('.people')?.textContent).toBe('2〜3にん');
  unmount(app);
});
```

`games.test.ts` の「どのゲームも本体と遊び方を読み込める」を、1 人 1 台のゲームは遊び方を持たない形に直す。

```ts
it('どのゲームも本体を読み込め、タイトル画面のあるゲームは遊び方も読み込める', async () => {
  for (const game of games) {
    const loaded = await game.load();
    expect(loaded.Game, game.id).toBeTypeOf('function');
    if (!('party' in game)) expect('Howto' in loaded && loaded.Howto, game.id).toBeTypeOf('function');
  }
}, 20_000);
```

Run: `pnpm vitest run src/lib/components/GameCard.svelte.test.ts src/lib/games.test.ts`
Expected: FAIL（`.people` が無い、型が合わない）

- [ ] **Step 2: `PartyMeta` を足して登録する**

`src/lib/games.ts`

```ts
/** 1 人 1 台の端末で遊ぶ。共通のシェルを通さず、ロビーから結果までの画面をゲームが持つ */
export interface PartyMeta extends BaseMeta {
  players: 2;
  party: true;
  load: () => Promise<{ Game: Component }>;
}

export type GameMeta = DuelMeta | SoloMeta | PartyMeta;
```

`import oekakiMori from './games/oekaki-mori/meta';` を足し、`games` の `doodleWorm` の次（`borderRush` の前）に `oekakiMori` を入れる。

`src/lib/games/oekaki-mori/meta.ts`

```ts
import type { GameMeta } from '$lib/games';

export default {
  id: 'oekaki-mori',
  name: 'おえかきのもり',
  description: 'ひとりが おだいを えで かいて、みんなで あてる。2〜3にんが ひとり 1だいずつ つかって あそぶ',
  players: 2,
  party: true,
  minutes: '1かい 10ぷん',
  load: async () => ({ Game: (await import('./OekakiMori.svelte')).default })
} satisfies GameMeta;
```

- [ ] **Step 3: ページで種類を分ける**

`+page.ts` の `play` を次にする。

```ts
// meta と本体の組を 1 つにまとめて、画面側で種類による絞り込みが本体の型にも効くようにする
const play =
  meta.players === 1
    ? { kind: 'solo' as const, meta, ...(await meta.load()) }
    : 'party' in meta
      ? { kind: 'party' as const, meta, ...(await meta.load()) }
      : { kind: 'duel' as const, meta, ...(await meta.load()) };
```

`+page.svelte` の `{#if data.play.solo}` の分岐を次にする（`Pairing` と `net` の部分はそのまま）。

```svelte
{#key data.play.meta.id}
  {#if data.play.kind === 'solo'}
    <SoloShell meta={data.play.meta} Game={data.play.Game} Howto={data.play.Howto} />
  {:else if data.play.kind === 'party'}
    <data.play.Game />
  {:else if pairing}
    <!-- いまの Pairing の行 -->
  {:else}
    <!-- いまの {#key net} <GameShell … /> {/key} -->
  {/if}
{/key}
```

`data.play.meta.net` を読んでいるところは `data.play.kind === 'duel'` の分岐の中なので、型はそのまま通る。

- [ ] **Step 4: カードに「2〜3にん」を出す**

`GameCard.svelte` の `.frame` の中、`reached` の `{#if}` の次に足す。

```svelte
{#if 'party' in game}<span class="people">2〜3にん</span>{/if}
```

`<style>` に足す（`.reached` の反対側の左上に置く）。

```css
.people {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 0.15em 0.8em;
  border: 2px solid var(--line);
  border-radius: 999px;
  background: var(--pastel-p3);
  color: var(--line);
  font-size: 13px;
  font-weight: 800;
}
```

Run: `pnpm vitest run src/lib/components/GameCard.svelte.test.ts src/lib/games.test.ts`
Expected: 「一覧のカードの画像がある」以外は PASS（画像は次の Step で作る）

- [ ] **Step 5: 一覧の絵を撮る**

`scripts/thumbs/scenes.ts` の `doodle-worm` の次に足す。座標は 768 × 1024 の画面で、れんしゅうの盤面の中に収まるように置く。1 回撮って、りんごが盤面の真ん中に来ていなければ中心と `band` の y を直す。

```ts
  {
    id: 'oekaki-mori',
    clip: band(250),
    play: async (s) => {
      await s.press('button.practice');
      await s.press('button[aria-label="ふとい"]');
      await s.press('button[aria-label="あか"]');
      await stroke(s, circle(384, 470, 110), 500);
      await stroke(s, circle(384, 470, 70), 400);
      await s.press('button[aria-label="ちゃいろ"]');
      await stroke(s, [[384, 360], [392, 320], [404, 296]], 200);
      await s.press('button[aria-label="みどり"]');
      await stroke(s, circle(440, 320, 26), 250);
      await s.press('button[aria-label="くろ"]');
      await s.press('button[aria-label="ふつう"]');
      await stroke(s, wave(180, 640, 400), 400);
    }
  },
```

Run: `pnpm thumbs oekaki-mori`
Expected: `static/thumbs/oekaki-mori.webp` ができる。Read で開いて、りんごと線が枠に収まっているか見る

- [ ] **Step 6: 全体の検査**

Run: `pnpm verify`
Expected: lint / check / test / vitals / build がすべて通る

- [ ] **Step 7: コミット**

```bash
git add src/lib/games.ts src/lib/games/oekaki-mori/meta.ts 'src/routes/games/[id]' src/lib/components/GameCard.svelte src/lib/components/GameCard.svelte.test.ts src/lib/games.test.ts scripts/thumbs/scenes.ts static/thumbs/oekaki-mori.webp
git commit -m "List おえかきのもり under ふたりで with a 2〜3にん badge and a practice-sheet thumbnail"
```

### Task 10: 3 台の通しの確認と CLAUDE.md

**Files:**

- Create: `<scratchpad>/party-play.mjs`（リポジトリには入れない）
- Modify: `CLAUDE.md`

**Interfaces:**

- Consumes: ここまでの全部。`svg[data-code]`（`Qr.svelte`）、ロビーのボタンの文言、`.typed`、`.board canvas`

- [ ] **Step 1: 3 ページの確認を書く**

前回の `net-play.mjs` と同じ偽カメラ（本物の許可を取ってから canvas の映像に差し替える）を使い、親 1 枚と子 2 枚をつなぐ。

```js
// 親と子 2 人を QR でつなぎ、エゴコロクイズを 1 ターン回す
import { createRequire } from 'node:module';
const repo = '/Users/oekazuma/localRepo/asobibako/.claude/worktrees/level-selection-ui-a6f9e5';
const require = createRequire(repo + '/package.json');
const { chromium } = require('playwright-core');
const { encode } = await import(repo + '/node_modules/uqr/dist/index.mjs');
const out = process.argv[2] ?? '.';
const URL = process.env.URL ?? 'http://localhost:5173/asobibako/games/oekaki-mori';

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
});
const ctx = await browser.newContext({
  viewport: { width: 600, height: 900 },
  hasTouch: true,
  ignoreHTTPSErrors: true
});
await ctx.grantPermissions(['camera'], { origin: new globalThis.URL(URL).origin });
await ctx.addInitScript(() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 480;
  const g = canvas.getContext('2d');
  window.__show = (rows) => {
    const cell = Math.floor(440 / rows.length);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 480, 480);
    g.fillStyle = '#000';
    rows.forEach((row, y) => row.forEach((d, x) => d && g.fillRect(20 + x * cell, 20 + y * cell, cell, cell)));
  };
  const stream = canvas.captureStream(10);
  const real = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (c) => (await real(c), stream);
});
const pages = [await ctx.newPage(), await ctx.newPage(), await ctx.newPage()];
for (const p of pages) {
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(URL);
  await p.waitForTimeout(1500);
}
const [host, g2, g3] = pages;
const feed = async (from, to) => {
  const code = await from.locator('svg[data-code]').getAttribute('data-code', { timeout: 10000 });
  await to.evaluate((rows) => window.__show(rows), encode(code, { ecc: 'L', border: 2 }).data);
};
async function link(guest, first) {
  await host.getByRole('button', { name: first ? 'なかまを よぶ（QR を だす）' : 'もうひとり よぶ' }).click();
  await guest.getByRole('button', { name: 'QR を よみとる' }).click();
  await feed(host, guest);
  await guest.locator('svg[data-code]').waitFor();
  await host.getByRole('button', { name: 'よみとってもらったら つぎへ' }).click();
  await feed(guest, host);
  await guest.getByText('おやが はじめるのを まってね').waitFor({ timeout: 20000 });
}
await link(g2, true);
await link(g3, false);
console.log('members', await host.locator('.members li').allTextContents());
await host.getByRole('button', { name: 'はじめる' }).click();
await host.getByRole('button', { name: /エゴコロクイズ/ }).click();

// 1P が描く。候補の 1 つ目を選び、盤面に線を引く
await host.getByText('どっちを かく？').waitFor();
const word = (await host.locator('.cover .pill').first().textContent()).trim();
await host.locator('.cover .pill').first().click();
const box = await host.locator('.board').boundingBox();
await host.evaluate(
  ([x, y, w]) => {
    const el = document.querySelector('.board');
    const fire = (type, px, py) =>
      el.dispatchEvent(
        new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: px, clientY: py, bubbles: true })
      );
    fire('pointerdown', x + w * 0.2, y + w * 0.5);
    let i = 0;
    const t = setInterval(() => {
      fire('pointermove', x + w * (0.2 + i * 0.03), y + w * (0.5 + Math.sin(i / 3) * 0.1));
      if (++i > 20) {
        clearInterval(t);
        fire('pointerup', x + w * 0.8, y + w * 0.5);
      }
    }, 30);
  },
  [box.x, box.y, box.width]
);
await host.waitForTimeout(1500);
const inked = await Promise.all(
  [g2, g3].map((p) =>
    p.evaluate(() => {
      const c = document.querySelector('.board canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let dark = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
      return dark;
    })
  )
);
console.log('ink pixels on guests', inked);
console.log('guest word hidden', !(await g2.locator('.bar').textContent()).includes(word));

// 2P ははずれ、3P は正解を 50 音盤で入れる
const type = async (p, text) => {
  for (const ch of text) {
    const key = p.locator('.keys .key', { hasText: new RegExp(`^${ch}$`) });
    if (await key.count()) await key.first().click();
    else {
      // 濁点・小さい字は清音を押してから切り替える
      const base = ch.normalize('NFD')[0];
      const small = 'ぁぃぅぇぉっゃゅょゎ'.includes(ch) ? String.fromCharCode(ch.charCodeAt(0) + 1) : base;
      await p
        .locator('.keys .key', { hasText: new RegExp(`^${small}$`) })
        .first()
        .click();
      for (let i = 0; i < 3 && !(await p.locator('.typed').textContent()).endsWith(ch); i++)
        await p.getByRole('button', { name: 'だくてん・はんだくてん・ちいさいじ' }).click();
    }
  }
  await p.getByRole('button', { name: 'こたえる' }).click();
};
await type(g2, 'あ');
await type(g3, word);
await host.waitForTimeout(800);
console.log('bubble on host', await host.locator('.bubble').allTextContents());
console.log('scores on host', await host.locator('.scores li').allTextContents());
await pages[0].screenshot({ path: `${out}/mori-host.png` });
await g3.screenshot({ path: `${out}/mori-g3.png` });

// 子が 1 人抜けても続き、親が抜けたら子はロビーに戻る
await g3.close();
await host.waitForTimeout(16000);
console.log('members after 3P left', await host.locator('.scores li').allTextContents());
await host.close();
await g2.getByText('つながりが きれました').waitFor({ timeout: 30000 });
console.log('guest back to lobby after host left');
await browser.close();
```

- [ ] **Step 2: 回す**

dev サーバー（`preview_start` の `dev`）で回す。

Run: `node <scratchpad>/party-play.mjs <scratchpad>/shots`
Expected:

- `members` が `1P（あなた）`・`2P`・`3P` の 3 つ
- `ink pixels on guests` が両方とも 0 より大きい
- `guest word hidden true`
- `bubble on host` に `2P「あ」`
- `scores on host` で 1P が 2、3P が 3
- `members after 3P left` に 3P が無い
- `guest back to lobby after host left`

撮った 2 枚を Read で開き、描く人と当てる人の画面が崩れていないか見る。ずれていれば直して回し直す。

- [ ] **Step 3: CLAUDE.md に足す**

「構成」の節の、らくがきパレードの段落の次に 1 段落足す（経緯は書かず、いまの仕様だけ）。

```markdown
おえかきのもり（`oekaki-mori`）は、2〜3 人がそれぞれ自分の端末を持って遊ぶお絵かきクイズ（`meta.party`、共通のシェルを通さず、ロビー・遊び方選び・遊ぶ・結果の画面をゲームが持つ。一覧では「ふたりで」に入り、カードに「2〜3にん」を出す）。端末は `src/lib/net/` の QR の手順（`Handshake.svelte`、せめぎあいの 2 台対戦と共用）でつなぎ、親を中心に `party.svelte.ts` の `Party` が 3 台までを束ねる（子どうしはつながず、親が中継する）。遊ぶ人の操作（`act`）は親のルールへ、ルールの知らせ（`tell`）は全員の画面へ流れ、親の端末では両方を手元で回す。ルールは親の `referee.ts` が `engine.ts`（エゴコロクイズ。描く順番・時間・ヒント・判定・点数・抜けた人、人ごとの見せ方）を進め、描く人と当てた人にだけお題を渡す。答えは 50 音盤（`kana.ts`、濁点や小さい字だけの違いは「おしい」）、線は盤面に対する 0..1 の座標で `strokes.ts` が持ち、描く人の端末が 1 フレームごとに増えた点を送る。お題は `words.ts`。ロビーの「ひとりで れんしゅう」は 1 台で描いてみる画面で、一覧の絵もここで撮る。
```

- [ ] **Step 4: 全体の検査とコミット**

Run: `pnpm verify`
Expected: すべて通る

```bash
git add CLAUDE.md
git commit -m "Document おえかきのもり and the party link in CLAUDE.md"
```

- [ ] **Step 5: 実機で試してもらう準備**

`pnpm build` し直し、前回の HTTPS 配信（`https://192.168.0.80:8443/asobibako/games/oekaki-mori`）が動いていることを確かめて、試し方を伝える。
