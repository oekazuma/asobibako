# Plan 055: QR でつなぐ手順をやめたら、カメラと作りかけの接続を必ず閉じる

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/net/Handshake.svelte src/lib/net/Handshake.svelte.test.ts src/lib/net/link.ts src/lib/net/link.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                         |
| ---------- | -------------------------------------------------------------------------- |
| Priority   | P2                                                                         |
| Effort     | S                                                                          |
| Risk       | LOW（閉じる口を 1 つ足し、やめたときにだけ呼ぶ。つながったあとは触らない） |
| Depends on | none                                                                       |
| Category   | bug                                                                        |
| Planned at | commit `36cc037`, 2026-10-14                                               |

## Why this matters

2 台以上の iPad を QR でつなぐ手順は `src/lib/net/Handshake.svelte` 1 つで、2 台対戦（`Pairing.svelte`）・おえかきのもり・
アニマルサバイバーの協力プレイ・やっぱりカメレオンが共用している。手順の途中で「やめる」「とじる」「もどる」を押すと
`Handshake` が消えるが、次の 2 つが残る。

1. 「カメラを きりかえ」を押してカメラが開くのを待っているあいだに消えると、あとから開いたカメラが止まらない。撮影中の印が
   点いたままになり、カメラを使い続ける
2. 親の `host()` と子の `join()`（`src/lib/net/link.ts`）が作る `RTCPeerConnection` は、つながって `Link` を渡したあと
   （`Link.close`）か、相手の QR を読んで 15 秒待って見切ったとき（`opened()`）にしか閉じない。QR を見せたまま、または子が
   読み取ったあと親が読む前にやめると、接続は閉じずに残る。やり直すたびに 1 つずつ増える（失敗したあとに `{#key tries}` で
   `Handshake` を作り直す画面もある）

`link.ts` の `host()`・`join()` の戻り値に `close()` を足し、`Handshake` がまだ `Link` を渡していないうちに消えるときだけ呼ぶ。
カメラは `onMount` と同じく、開くのを待ったあとに `alive` を見る。

## Current state

直すファイルは 2 つで、テストは 2 つ。

- `src/lib/net/link.ts` — WebRTC の接続。`host()` と `join()` が QR に載せる接続情報と、つながったときの `Link` を返す
- `src/lib/net/Handshake.svelte` — QR を見せる・カメラで読む手順の画面（139 行。200 行の上限まで余裕がある）
- `src/lib/net/link.test.ts` — node の unit のテスト。`RTCPeerConnection` は無い（`vite.config.ts:79-80` の `environment: 'node'`）
- `src/lib/net/Handshake.svelte.test.ts` — happy-dom のテスト。`./camera` と `./link` を差し替えている

### `host()` と `join()`

今のコードは `link.ts:103-130` にある。

```ts
export async function host(): Promise<{ code: string; accept: (answer: string) => Promise<Link> }> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  // offer を作る前に開かないと、SDP にデータ用の行が入らない
  const channel = pc.createDataChannel('game');
  await pc.setLocalDescription();
  return {
    code: await describe(pc, OFFER),
    accept: async (answer) => {
      await pc.setRemoteDescription({ type: 'answer', sdp: await unpack(answer.slice(ANSWER.length)) });
      return opened(pc, channel);
    }
  };
}

/** 子になる。親の QR を渡し、返ってきた code を親に見せる。link は親が読み取るとつながる */
export async function join(offer: string): Promise<{ code: string; link: Promise<Link> }> {
  const pc = new RTCPeerConnection({ iceServers: [] });
  const channel = new Promise<RTCDataChannel>((resolve) =>
    pc.addEventListener('datachannel', (event) => resolve(event.channel), { once: true })
  );
  await pc.setRemoteDescription({ type: 'offer', sdp: await unpack(offer.slice(OFFER.length)) });
  await pc.setLocalDescription();
  return { code: await describe(pc, ANSWER), link: channel.then((c) => opened(pc, c)) };
}
```

`pc` を閉じるのは `Link.close()`（`link.ts:58-60`）と、`opened()` の 15 秒の見切り（`link.ts:63-76`）だけ。子の `opened()` は
`datachannel` が来てから始まるので、親が子の QR を読まないうちは見切りも始まらない。

`host()` と `join()` を呼ぶのは `Handshake.svelte` だけ（`grep -rn "host()\|join(" src/lib/net` で確かめる。テストの差し替えを除く）。

### `Handshake.svelte`

今のコードは `Handshake.svelte:27-89` にある（抜粋）。

```ts
  /** やめたあとにカメラが開いたり、つながったりしても、拾わずに閉じる */
  let alive = true;

  …

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
    if (alive) onlink(link);
    else link.close();
  }

  onMount(async () => {
    try {
      // 接続情報を作る前にカメラを開く。許可がないと自分のアドレスが伏せられ、つながらないことがある
      const opened = await openCamera(facing);
      if (!alive) return closeCamera(opened);
      stream = opened;
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

  onDestroy(() => {
    alive = false;
    closeCamera(stream);
  });
```

`turn()` は待ったあとに `alive` を見ない。`connect(text).catch` は、やめたあと（15 秒の見切りで `accept` が失敗したとき）にも
`onfail` を呼ぶ。`onfail` を受けた画面はもう次の手順に移っているので、古い失敗の字が出ることがある（例 おえかきのもりのロビーの
`failed`）。同じ「やめたあとに拾わない」の抜けなので、ここで一緒に直す。

### 今のテストの差し替え

今のコードは `Handshake.svelte.test.ts:5-45` にある（抜粋）。`openCamera` は呼ばれるたびに `hooks.camera` へ解決の口を入れる。

```ts
const hooks = vi.hoisted(() => ({
  stop: () => {},
  camera: null as null | ((stream: unknown) => void),
  read: null as null | ((text: string) => void),
  accept: null as null | ((link: unknown) => void)
}));

…

vi.mock('./link', () => ({
  host: async () => ({ code: 'O:test', accept: () => new Promise((resolve) => (hooks.accept = resolve)) }),
  join: async () => ({ code: 'A:test', link: new Promise(() => {}) }),
  isAnswer: () => true,
  isOffer: () => true
}));

…

function show() {
  const stop = vi.fn();
  hooks.stop = stop;
  const onlink = vi.fn();
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Handshake, { target, props: { role: 'host', onlink, onfail: vi.fn() } });
  flushSync();
  // video.srcObject は MediaStream しか受けないので、本物に止める口だけ差し替える
  const stream = Object.assign(new MediaStream(), { getTracks: () => [{ stop }] });
  return { app, target, onlink, stop, stream };
}
```

この差し替えには `close` が無い。`Handshake` が `close()` を呼ぶようにすると、今の 2 つめのテスト（読み取ったあとにやめる）が
`offer.close is not a function` で落ちるので、差し替えにも `close` を足す。

### 規約

コメントは「コードから復元できない WHY」だけを日本語で書く（変更の経緯や計画の番号は書かない）。テストの名前は日本語の文にする。
`.svelte` は 200 行未満（svelte-vitals `architecture/component-size`）。

## Commands you will need

| Purpose       | Command                                                                              | Expected on success           |
| ------------- | ------------------------------------------------------------------------------------ | ----------------------------- |
| 足すテスト    | `pnpm exec vitest run src/lib/net/link.test.ts src/lib/net/Handshake.svelte.test.ts` | すべて pass                   |
| 全テスト      | `pnpm test:run`                                                                      | exit 0                        |
| 型            | `pnpm check`                                                                         | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                          | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                 | 警告 0                        |
| 全部          | `pnpm verify`                                                                        | exit 0                        |

ブラウザの道具は使わない（この計画では要らない）。

## Scope

**In scope**

- `src/lib/net/link.ts`（`host()` と `join()` の戻り値に `close` を足すだけ）
- `src/lib/net/link.test.ts`（テストを足す）
- `src/lib/net/Handshake.svelte`
- `src/lib/net/Handshake.svelte.test.ts`（差し替えに `close` を足し、テストを足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `Link` クラスと `opened()`・`gathered()`。つながったあとの閉じ方は正しい
- `Handshake` を使う画面（`Pairing.svelte`・各ゲームの `Invite.svelte`・`Lobby.svelte`・`Entry.svelte`・`CoopRoom.svelte`）。`Handshake` の props は変えない
- `host()` 自体が失敗したとき（`setLocalDescription` が投げたとき）の後片付けと、`turn()` でカメラが開けなかったときの知らせ。別の件
- `camera.ts`

## Git workflow

- ブランチは `advisor/055-handshake-close-on-cancel`
- コミットは 1 つでよい。英語の命令形 1 文で、`Co-Authored-By` などの末尾の行は付けない（例 `Close the camera and the pending peer connection when the QR handshake is left`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: `host()` と `join()` に `close()` を足す

`link.ts` を次のようにする。

1. `host()` の戻り値の型を `Promise<{ code: string; accept: (answer: string) => Promise<Link>; close: () => void }>` にし、返す物に
   `close: () => pc.close()` を足す
2. `join()` の戻り値の型を `Promise<{ code: string; link: Promise<Link>; close: () => void }>` にし、返す物に
   `close: () => pc.close()` を足す
3. `host()` の doc コメントの最後に「close はつながる前にやめるときに呼ぶ。Link を受け取ったあとは Link.close で閉じる」を足す
   （`join()` の doc コメントにも同じ 1 文を足す）

`link.test.ts` の import を `import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';` と
`import { host, join, Link, pack, slim, unpack, type Message } from './link';` にし、ファイルの最後に次を足す。node のテストなので
`RTCPeerConnection` は偽物を `vi.stubGlobal` で置く。

```ts
describe('host と join', () => {
  class FakePc {
    static made: FakePc[] = [];
    iceGatheringState = 'complete';
    localDescription = { sdp: 'v=0\r\n' };
    close = vi.fn();
    constructor() {
      FakePc.made.push(this);
    }
    createDataChannel() {
      return {};
    }
    async setLocalDescription() {}
    async setRemoteDescription() {}
    addEventListener() {}
  }

  beforeEach(() => {
    FakePc.made = [];
    vi.stubGlobal('RTCPeerConnection', FakePc);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('親の close は、子の QR が届く前でも接続を閉じる', async () => {
    const offer = await host();
    expect(FakePc.made[0].close).not.toHaveBeenCalled();
    offer.close();
    expect(FakePc.made[0].close).toHaveBeenCalled();
  });

  it('子の close は、親が読み取る前でも接続を閉じる', async () => {
    const answer = await join('O:' + (await pack('v=0\r\n')));
    answer.close();
    expect(FakePc.made[0].close).toHaveBeenCalled();
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/net/link.test.ts` → すべて pass（もとの 3 つと足した 2 つ）。

### Step 2: 先に `Handshake` の失敗するテストを書く

`Handshake.svelte.test.ts` を次のようにする。

1. `hooks` に `closed: 0` と `reject: null as null | ((error: unknown) => void)` を足す
2. `./link` の差し替えを次にする（`close` は呼ばれた回数を数える。`accept` は失敗もさせられるようにする）

```ts
vi.mock('./link', () => ({
  host: async () => ({
    code: 'O:test',
    accept: () =>
      new Promise((resolve, reject) => {
        hooks.accept = resolve;
        hooks.reject = reject;
      }),
    close: () => hooks.closed++
  }),
  join: async () => ({ code: 'A:test', link: new Promise(() => {}), close: () => hooks.closed++ }),
  isAnswer: () => true,
  isOffer: () => true
}));
```

3. `show()` を `show(role: 'host' | 'guest' = 'host')` にし、`onfail` も `vi.fn()` で作って返す（`props: { role, onlink, onfail }`、
   戻り値に `onfail` を足す）
4. `afterEach` の片付けに `hooks.reject = null;` と `hooks.closed = 0;` を足す
5. `describe('Handshake', …)` の最後に次の 5 つを足す

```ts
it('親の QR を見せたままやめたら、つながる前の接続を閉じる', async () => {
  const { app, stream } = show();
  hooks.camera!(stream);
  await settle();
  expect(hooks.closed).toBe(0);
  unmount(app);
  expect(hooks.closed).toBe(1);
});

it('子が読み取ったあと、親が読む前にやめたら、子の接続を閉じる', async () => {
  const { app, stream } = show('guest');
  hooks.camera!(stream);
  await settle();
  hooks.read!('O:offer');
  await settle();
  unmount(app);
  expect(hooks.closed).toBe(1);
});

it('つながって渡した接続は、そのあとやめても閉じない', async () => {
  const { app, target, onlink, stream } = show();
  hooks.camera!(stream);
  await settle();
  target.querySelector<HTMLButtonElement>('button.gold')!.click();
  await settle();
  hooks.read!('A:answer');
  await settle();
  const link = { close: vi.fn() };
  hooks.accept!(link);
  await settle();
  expect(onlink).toHaveBeenCalledWith(link);
  unmount(app);
  expect(hooks.closed).toBe(0);
  expect(link.close).not.toHaveBeenCalled();
});

it('カメラを切り替えているあいだにやめたら、あとから開いたカメラを閉じる', async () => {
  const { app, target, stream } = show();
  hooks.camera!(stream);
  await settle();
  target.querySelector<HTMLButtonElement>('button.gold')!.click();
  await settle();
  [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('カメラを きりかえ'))!.click();
  await settle();
  unmount(app);
  const stop = vi.fn();
  hooks.camera!(Object.assign(new MediaStream(), { getTracks: () => [{ stop }] }));
  await settle();
  expect(stop).toHaveBeenCalled();
});

it('やめたあとに読み取りが失敗しても、失敗を知らせない', async () => {
  const { app, target, onfail, stream } = show();
  hooks.camera!(stream);
  await settle();
  target.querySelector<HTMLButtonElement>('button.gold')!.click();
  await settle();
  hooks.read!('A:answer');
  await settle();
  unmount(app);
  hooks.reject!(new Error('timeout'));
  await settle();
  expect(onfail).not.toHaveBeenCalled();
});
```

カメラを切り替えるテストでは、2 回めの `openCamera` のために別の止める口（`stop`）を作る。`show()` の `stop` は 1 回めのカメラの
もので、切り替えたときにすでに止まっている。

**Verify**: `pnpm exec vitest run src/lib/net/Handshake.svelte.test.ts` → 足した 5 つのうち「つながって渡した接続は、そのあとやめても
閉じない」以外の 4 つが落ちる。もとからある 2 つは pass のまま。

### Step 3: `Handshake` でやめたときに閉じる

`Handshake.svelte` を次のようにする。

1. `alive` の宣言の下に次を足す

```ts
/** QR を見せ合っているあいだの接続。Link を渡すまではこちらが持ち、やめたら閉じる（閉じないと待ち受けが残り続ける） */
let peer: { close: () => void } | undefined;
```

2. `done()` の最初の行に `peer = undefined;` を足す（ここから先は `Link` の持ち主が閉じる。消すのを `onlink` より後にすると、
   やめたときに渡した接続まで閉じうる）
3. `onMount` の親の分かれ道を次にする

```ts
    if (role === 'host') {
      const offer = await host();
      if (!alive) return offer.close();
      peer = offer;
      code = offer.code;
```

4. 子の `connect` を次にする

```ts
connect: async (text) => {
  const answer = await join(text);
  if (!alive) return answer.close();
  peer = answer;
  code = answer.code;
  done(await answer.link);
};
```

5. `turn()` を次にする（`onMount` のカメラと同じ形）

```ts
async function turn() {
  facing = facing === 'user' ? 'environment' : 'user';
  closeCamera(stream);
  const opened = await openCamera(facing);
  if (!alive) return closeCamera(opened);
  // 開くのを待つあいだにもう一度押されていたら、先に開いたほうが stream に入っている
  closeCamera(stream);
  stream = opened;
}
```

6. `$effect` の中の `connect(text).catch(…)` の `onfail(…)` を `if (alive) onfail(…);` にする（`closeCamera(stream)` はそのまま）
7. `onDestroy` の最後に `peer?.close();` を足す

**Verify**:

- `pnpm exec vitest run src/lib/net/link.test.ts src/lib/net/Handshake.svelte.test.ts` → すべて pass（link 5、Handshake 7）
- `wc -l src/lib/net/Handshake.svelte` → 199 以下

### Step 4: 全体の確かめ

先に触ったファイルを整える。

`pnpm exec prettier --write src/lib/net/link.ts src/lib/net/link.test.ts src/lib/net/Handshake.svelte src/lib/net/Handshake.svelte.test.ts`

**Verify**:

- `pnpm check` → `0 ERRORS 0 WARNINGS`
- `pnpm verify` → exit 0（`Handshake` を差し替えているほかのゲームのテストも含む）

## Test plan

- `link.test.ts` に 2 つ。親と子の `close()` が、つながる前の接続を閉じる
- `Handshake.svelte.test.ts` に 5 つ。親の QR を見せたままやめる、子が読み取ったあとにやめる、渡した接続はやめても閉じない
  （閉じすぎの守り）、カメラの切り替え中にやめる、やめたあとの失敗を知らせない
- 型にするテストは同じファイルの今の 2 つ（`Handshake.svelte.test.ts:53-75`）
- `pnpm exec vitest run src/lib/net/` → すべて pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/net/link.test.ts src/lib/net/Handshake.svelte.test.ts` が pass し、足した 7 つを含む
- [ ] `grep -c "close: () => pc.close()" src/lib/net/link.ts` が `2`
- [ ] `grep -n "peer?.close()" src/lib/net/Handshake.svelte` が 1 行
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 055 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（`host()`・`join()`・`Handshake` の `onMount`・`done`・`turn`・`onDestroy`・テストの差し替え）が今のコードと違う
- `host()` か `join()` を `Handshake.svelte` のほかから呼んでいる（テストの差し替えを除く）
- 「つながって渡した接続は、そのあとやめても閉じない」が落ちる。つながったあとの 2 台を切ってしまう直し方になっているので、
  `done()` の `peer = undefined` の位置を確かめ、それでも落ちれば報告する
- ほかのゲームのテスト（`Handshake` を差し替えているもの）が落ち、直すのに `Handshake` の props を変えたくなった
- `pnpm check` が `close` の型で落ち、`Handshake` か `link.ts` の外を直したくなった

## Maintenance notes

- `host()`・`join()` の戻り値は「`Link` を受け取るまでは呼んだ側が `close()` する」決まりになった。`Handshake` 以外から呼ぶときも同じにする
- やめたあとに届くもの（カメラ・接続・失敗）はどれも `alive` を見てから拾う。`Handshake` に待つ処理を足すときも、待ったあとに `alive` を見る
- 実機では、親が QR を出したまま「やめる」を何度か押し直しても、カメラの印がすぐ消えること、子が読み取ったあと親が読む前に
  やめても、子の画面が次の手順で同じように動くことを見る
