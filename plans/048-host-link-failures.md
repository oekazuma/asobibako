# Plan 048: おえかきのもりと協力プレイで、子を迎えそこねたときに成功したように見せない

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat b565b01..HEAD -- src/lib/games/oekaki-mori/Invite.svelte src/lib/games/oekaki-mori/Lobby.svelte src/lib/games/oekaki-mori/OekakiMori.svelte src/lib/games/oekaki-mori/Lobby.svelte.test.ts src/lib/games/animal-survivors/CoopRoom.svelte src/lib/games/animal-survivors/coop-room.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                               |
| ---------- | -------------------------------------------------------------------------------- |
| Priority   | P1                                                                               |
| Effort     | M                                                                                |
| Risk       | LOW〜MED（つなぐ画面の分かれ道を 3 か所直す。`Party` と `Handshake` は触らない） |
| Depends on | none                                                                             |
| Category   | bug                                                                              |
| Planned at | commit `b565b01`, 2026-10-14                                                     |

## Why this matters

2〜3 台の iPad を QR でつなぐゲームは 3 本あり、つなぐ部品（`src/lib/net/` の `Handshake` と `Party`）は共用している。
親が子を迎える `Party.add(link)` は、迎えた席の番号（2 か 3）、版ちがいで断った `'mismatch'`、迎えられなかった `null`
（満員、または hello の前に子の管が閉じた）のどれかを返す。

やっぱりカメレオンは、番号でなければ失敗として扱い、理由を出して QR を作り直すように直してある。おえかきのもりと
アニマルサバイバーの協力プレイは `'mismatch'` しか見ておらず、`null` を成功として扱っている。そのため次のことが起きる。

1. おえかきのもりの遊んでいる最中の「よびなおす」（`Invite.svelte`）で迎えそこねると、成功したように画面が閉じ、切れた子は戻らず、
   何も知らされない。`onfail` で失敗しても使い終わった QR を作り直さない
2. おえかきのもりのロビーで最初の子を迎えそこねると、誰もいない `Party` でロビーへ進む（`Lobby.svelte`）。迎えるのを待つあいだに
   「やめる」を押しても、あとから `onparty` が呼ばれる
3. 協力プレイで最初の子を迎えそこねると（版ちがいでも `null` でも）、親は動物選びに進み、誰もいない「なかまが 子を えらぶのを
   まっています」の画面に残る。抜けるには「もどる」しかない（`CoopRoom.svelte`）

カメレオンの直し方（`yappari-chameleon/Entry.svelte:41-57` と `yappari-chameleon/Invite.svelte:16-40`）を、
新しい共通部品を作らずに 3 か所へ写す。

## Current state

### お手本（カメレオン、直してある）

`yappari-chameleon/Entry.svelte:41-57`。番号でなければ親の `Party` を閉じ、やめていなければ理由を出す。

```ts
async function linked(link: Link) {
  if (joining !== 'host') {
    joining = null;
    onparty(Party.guest(link, { was }));
    return;
  }
  const p = Party.host();
  const stop = onhost(p);
  // hello を待つあいだも QR の手順の画面のままにする。戻すと、もう一度呼べて親が 2 つできる
  const seat = await p.add(link);
  const cancelled = joining !== 'host';
  joining = null;
  if (typeof seat === 'number' && !cancelled) return onparty(p);
  stop();
  p.close();
  if (!cancelled) failed = seat === 'mismatch' ? MISMATCH : 'つながりませんでした。もう一度試してください';
}
```

`yappari-chameleon/Invite.svelte:16-40`。番号でなければ失敗として理由を出し、`tries` を進めて QR を作り直す。閉じたあとに
届いた結果は捨てる。

```svelte
  function close() {
    open = false;
    failed = '';
  }

  /** 閉じたあとに届いた結果は、次に開いた手順のものではないので捨てる */
  function fail(text: string) {
    if (!open) return;
    failed = text;
    tries++;
  }
</script>

{#if open}
  <!-- 試合は止めずに、上に重ねて QR の手順を出す。戻った子は同じ番号で迎える（Party.away） -->
  <div class="invite">
    {#key tries}
      <Handshake
        role="host"
        onlink={async (link) => {
          const seat = await onlink(link);
          if (typeof seat === 'number') return close();
          fail(seat === 'mismatch' ? MISMATCH : 'つながりませんでした。もう一度試してください');
        }}
        onfail={fail}
      />
    {/key}
```

`Party.add` の型は `add(pipe: Pipe): Promise<Seat | null | 'mismatch'>`（`src/lib/net/party.svelte.ts:82`）。

### 1. おえかきのもりの `Invite.svelte`（直す）

`src/lib/games/oekaki-mori/Invite.svelte:7-44`

```svelte
  let {
    away,
    onlink,
    looks = {},
    open = $bindable(false)
  }: {
    away: Seat[];
    onlink: (link: Link) => Promise<unknown>;
    looks?: Record<number, string>;
    open?: boolean;
  } = $props();
  let failed = $state('');
  /** 版ちがいで断った QR は使い終わっているので、数を進めて手順を作り直す */
  let tries = $state(0);

  function close() {
    open = false;
    failed = '';
  }
</script>

{#if open}
  <!-- 遊びは止めずに、上に重ねて QR の手順を出す -->
  <div class="invite">
    {#key tries}
      <Handshake
        role="host"
        onlink={async (link) => {
          if ((await onlink(link)) !== 'mismatch') return close();
          failed = MISMATCH;
          tries++;
        }}
        onfail={(text) => (failed = text)}
      />
    {/key}
```

呼ぶ側は `src/lib/games/oekaki-mori/OekakiMori.svelte:131-134`。`party` が無いと `undefined` を返す。

```svelte
    {#if party.host}<Invite
        ...
        onlink={async (link) => party?.add(link)}
```

### 2. おえかきのもりの `Lobby.svelte`（直す）

`src/lib/games/oekaki-mori/Lobby.svelte:35-48`

```ts
async function linked(link: Link) {
  if (joining === 'host') {
    const p = party ?? Party.host(look);
    // hello を待つあいだも QR の手順の画面のままにする。ロビーに戻すと、もう一度よべて親が 2 つできる
    const seat = await p.add(link);
    joining = null;
    if (seat === 'mismatch') failed = MISMATCH;
    // 最初の子を断ったら、誰もいない Party でロビーを進めない
    else if (!party) onparty(p);
  } else {
    joining = null;
    onparty(Party.guest(link, { was, look }));
  }
}
```

`party` はロビーにすでにある `Party`（2 人目・3 人目を呼ぶとき）か `null`（最初の子を呼ぶとき）。ロビーの画面には
QR の手順のあいだ「やめる」（`joining = null`）がある（`Lobby.svelte:67`）。`failed` は画面に出る（ファイルの後ろのほうで
`{#if failed}` を確かめる）。おえかきのもりの画面の字は、子ども向けにひらがな中心（例 `'つながりませんでした。おなじ Wi-Fi に いるか たしかめてね'`）。

### 3. アニマルサバイバーの `CoopRoom.svelte`（直す）

`src/lib/games/animal-survivors/CoopRoom.svelte:40-53`

```ts
async function linked(link: Link) {
  if (joining === 'host') {
    const p = Party.host();
    // 子の最初の知らせ（hi と pick）を聞き逃さないよう、迎え入れる前に聞き手を付ける
    host = new CoopHost(p);
    party = p;
    const seat = await p.add(link);
    if (seat === 'mismatch') failed = MISMATCH;
  } else {
    party = Party.guest(link);
    guest = new CoopGuest(party);
  }
  joining = null;
}
```

画面の分かれ道（`CoopRoom.svelte:115-144`）は `host` が入っていると動物選び（`CoopPick`）か「なかまが 子を えらぶのを
まっています」になり、「なかまを よぶ」「なかまに はいる」は `host` も `guest` も無いときだけ出る。`mismatch` は子の側の旗で、
親では立たない。`failed` は `{#if failed}<p class="warn">{failed}</p>{/if}` で出る。`party` は `$state` ではないただの変数、
`host` は `$state.raw`。協力プレイの QR の手順には「やめる」のボタンは無い（「もどる」で画面ごと抜ける）。
`onDestroy` で `party?.close()` する。

### テストの道具

- カメレオンの `yappari-chameleon/Invite.svelte.test.ts` が、`Handshake` を「渡された口を控えるだけの関数」に差し替えて
  `onlink` / `onfail` を直接呼ぶ型。おえかきのもりの `Invite` のテストはこれを写す
- おえかきのもりの `Lobby.svelte.test.ts` は `./test/HandshakeStub.svelte` と `./test/handshake-hold` で `handshake.onlink` を
  呼ぶ型。`Party.add` は、渡した管の `closed` が解決すると `null` を返す（`party.svelte.ts:107-110`）ので、
  `closed: Promise.resolve()` の管を渡せば「迎えそこねた」を作れる
- 協力プレイの `coop-room.svelte.test.ts` は `CoopRoom` を mount して「なかまを よぶ」を探す型。`Handshake` の差し替えは
  カメレオンの `Invite.svelte.test.ts` と同じ書き方をこのファイルに書く（ほかのゲームのフォルダのスタブは import しない）

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く。`.svelte` は 200 行未満
（svelte-vitals `architecture/component-size`）。テストの名前は日本語の文にする。

## Commands you will need

| Purpose       | Command                                                                                                                                                                       | Expected on success           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 足すテスト    | `pnpm exec vitest run src/lib/games/oekaki-mori/Invite.svelte.test.ts src/lib/games/oekaki-mori/Lobby.svelte.test.ts src/lib/games/animal-survivors/coop-room.svelte.test.ts` | すべて pass                   |
| 全テスト      | `pnpm test:run`                                                                                                                                                               | exit 0                        |
| 型            | `pnpm check`                                                                                                                                                                  | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                                                                                                                   | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                                                                                                          | 警告 0                        |
| 全部          | `pnpm verify`                                                                                                                                                                 | exit 0                        |

## Scope

**In scope**

- `src/lib/games/oekaki-mori/Invite.svelte`
- `src/lib/games/oekaki-mori/Invite.svelte.test.ts`（作る）
- `src/lib/games/oekaki-mori/Lobby.svelte`
- `src/lib/games/oekaki-mori/Lobby.svelte.test.ts`（テストを足す）
- `src/lib/games/animal-survivors/CoopRoom.svelte`
- `src/lib/games/animal-survivors/coop-room.svelte.test.ts`（テストを足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/net/` の全部（`Party`・`Handshake`・`link.ts`）— 共用部品の決まりは正しい。直すのは呼ぶ側の受け方
- やっぱりカメレオンのファイル — お手本として読むだけ
- `OekakiMori.svelte` — `onlink={async (link) => party?.add(link)}` のままでよい（`undefined` も失敗として扱う）
- 共通の `HostInvite` 部品を `src/lib/net/` に作ること — ゲームごとに字の書き方と名前の出し方がちがうので、写すほうが小さい
- 協力プレイの QR の画面に「やめる」を足すこと

## Git workflow

- ブランチは `advisor/048-host-link-failures`
- コミットは場所ごとに 3 つでもよい。英語の命令形 1 文（例 `Treat an unseated guest as a failed link in the oekaki-mori invite`）
- push しない

## Steps

### Step 1: おえかきのもりの `Invite` をカメレオンと同じ受け方にする

`oekaki-mori/Invite.svelte` を次のようにする。

1. `onlink` の型を `(link: Link) => Promise<Seat | null | 'mismatch' | undefined>` にする
2. `tries` のコメントを「断った・つなげなかった QR は使い終わっているので、数を進めて手順を作り直す」にする
3. `close()` の下に、カメレオンと同じ `fail(text)` を足す（`if (!open) return; failed = text; tries++;`、コメント
   「閉じたあとに届いた結果は、次に開いた手順のものではないので捨てる」も写す）
4. `Handshake` の `onlink` を、番号なら `close()`、そうでなければ
   `fail(seat === 'mismatch' ? MISMATCH : 'つながりませんでした。もういちど ためしてね')` にする。`onfail={fail}` にする

`oekaki-mori/Invite.svelte.test.ts` を作り、カメレオンの `Invite.svelte.test.ts` の 2 つのテストを写す（`show()` の props に
`looks: {}` を足す。`.pill` のボタンが「とじる」であることを確かめてから使う）。さらに次の 1 つを足す。

```ts
it('迎えられなかった（null）ときは閉じずに理由を出し、手順を作り直す', async () => {
  const { props, alert, done } = show(vi.fn(async () => null));
  await shakes[0].onlink({} as Link);
  flushSync();
  expect(props.open).toBe(true);
  expect(alert()).toBe('つながりませんでした。もういちど ためしてね');
  expect(shakes).toHaveLength(2);
  done();
});
```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/Invite.svelte.test.ts` → 3 つとも pass。
（順番を確かめたいときは、先にテストだけ書いて今のコードで 3 つめと 1 つめが落ちることを見てから直す。）

### Step 2: おえかきのもりのロビーで、迎えそこねたら進まず、やめたら進まない

`oekaki-mori/Lobby.svelte` は今 196 行で、200 行の上限まで 3 行しかない。`linked` の親の側を次の形にする
（もとの 8 行が 10 行になり、198 行に収まる）。`if` の中身を `{ … }` で広げると上限を超えるので、この形のまま書く。`eslint.config.js` に型つきの規則（`no-confusing-void-expression` など）は無いので、`return party || onparty(p)` は lint を通る。

```ts
    if (joining === 'host') {
      const p = party ?? Party.host(look);
      // hello を待つあいだも QR の手順の画面のままにする。ロビーに戻すと、もう一度よべて親が 2 つできる
      const seat = await p.add(link);
      const cancelled = joining !== 'host';
      joining = null;
      // 最初の子を迎えそこねた・待つあいだに「やめる」を押したなら、誰もいない Party でロビーを進めない
      if (typeof seat === 'number' && !cancelled) return party || onparty(p);
      if (!party) p.close();
      if (!cancelled) failed = seat === 'mismatch' ? MISMATCH : 'つながりませんでした。もういちど ためしてね';
    } else {
```

ロビーにすでに `party` があるとき（2 人目・3 人目を呼ぶとき）は、迎えた子はもう仲間に入っているので何もしない。
`party` が無いのに番号が返ったあとで「やめる」が押されていたら、`p.close()` で迎えた子ごと閉じる。

**Verify**: `wc -l src/lib/games/oekaki-mori/Lobby.svelte` → 199 以下。

`Lobby.svelte.test.ts` に次の 2 つを足す（`settle` は `() => new Promise((r) => setTimeout(r))` をファイルの上に定義する）。

```ts
it('最初の子を迎えそこねたら、誰もいない仲間でロビーを進めず、理由を出して よぶ・はいる に戻る', async () => {
  const onparty = vi.fn();
  const { app, target } = show({ onparty });
  [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('なかまを よぶ'))!.click();
  flushSync();
  const gone = { send: () => {}, on: () => () => {}, closed: Promise.resolve(), close: () => {} };
  handshake.onlink!(gone as unknown as Link);
  await settle();
  flushSync();
  expect(onparty).not.toHaveBeenCalled();
  expect(target.textContent).toContain('つながりませんでした');
  expect(target.textContent).toContain('なかまを よぶ');
  unmount(app);
});

it('子の hello を待つあいだに やめる を押したら、あとから迎えても進まない', async () => {
  const onparty = vi.fn();
  const { app, target } = show({ onparty });
  [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('なかまを よぶ'))!.click();
  flushSync();
  let hello: (m: unknown) => void = () => {};
  const pipe = {
    send: () => {},
    on: (l: (m: unknown) => void) => ((hello = l), () => {}),
    closed: new Promise(() => {}),
    close: () => {}
  };
  handshake.onlink!(pipe as unknown as Link);
  [...target.querySelectorAll('button')].find((b) => b.textContent?.includes('やめる'))!.click();
  flushSync();
  hello({ t: 'hello', v: PROTOCOL, was: null, look: null });
  await settle();
  expect(onparty).not.toHaveBeenCalled();
  unmount(app);
});
```

2 つめのテストは `import { PROTOCOL } from '$lib/net/party.svelte';` が要る。`PROTOCOL` がその名前で export されていなければ
`party.svelte.ts` で hello の版の名前を確かめて合わせる（`message.v !== PROTOCOL` を見ている、`party.svelte.ts:101`）。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/Lobby.svelte.test.ts` → すべて pass（もとからある
「つながった子の hello を待つあいだは、QR の手順の画面のままにする」を含む）。

### Step 3: 協力プレイで、迎えそこねたら親を片付けて よぶ・はいる に戻す

`animal-survivors/CoopRoom.svelte` の `linked` の親の側を次の形にする。

```ts
    if (joining === 'host') {
      const p = Party.host();
      // 子の最初の知らせ（hi と pick）を聞き逃さないよう、迎え入れる前に聞き手を付ける
      host = new CoopHost(p);
      party = p;
      const seat = await p.add(link);
      if (typeof seat !== 'number') {
        // 誰もいないまま動物選びへ進めると、来ない子を待つ画面から「もどる」でしか抜けられない
        p.close();
        host = null;
        party = null;
        failed = seat === 'mismatch' ? MISMATCH : 'つながりませんでした。もう一度試してください';
      }
    } else {
```

`coop-room.svelte.test.ts` の先頭に、カメレオンの `Invite.svelte.test.ts` と同じ `Handshake` の差し替えを書く。

```ts
type Shake = { onlink: (link: Link) => Promise<void>; onfail: (text: string) => void };
const shakes = vi.hoisted(() => [] as Shake[]);
// QR とカメラの手順は描かず、渡された口だけを控える
vi.mock('$lib/net/Handshake.svelte', () => ({ default: (_: unknown, props: Shake) => void shakes.push(props) }));
```

そして次のテストを足す。

```ts
it('最初の子を迎えそこねたら、動物選びへ進まず、理由を出して よぶ・はいる に戻る', async () => {
  shakes.length = 0;
  const target = document.body.appendChild(document.createElement('div'));
  const room = mount(CoopRoom, { target, props: { onback: () => {} } });
  flushSync();
  [...target.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'なかまを よぶ')!.click();
  flushSync();
  const gone = { send: () => {}, on: () => () => {}, closed: Promise.resolve(), close: () => {} };
  await shakes[0].onlink(gone as unknown as Link);
  flushSync();
  expect(target.querySelector('[data-animal]')).toBeNull();
  expect(target.textContent).toContain('つながりませんでした');
  expect([...target.querySelectorAll('button')].map((b) => b.textContent?.trim())).toContain('なかまを よぶ');
  unmount(room);
});
```

`Link` の型は `import type { Link } from '$lib/net/link';` で読む。このファイルにある既存の 2 つのテストは `Handshake` を
描かないので、差し替えても変わらない。

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/coop-room.svelte.test.ts` → すべて pass。

### Step 4: 全体の確かめ

**Verify**: `pnpm verify` → exit 0（svelte-vitals の 200 行の決まりを含む）。

## Test plan

- 足すテストは、おえかきのもりの `Invite` で 3 つ（理由を出して作り直す・閉じたあとの結果を捨てる・null で閉じない）、
  ロビーで 2 つ（迎えそこねたら進まない・やめたら進まない）、協力プレイで 1 つ（迎えそこねたら戻る）
- 型にするテストは `yappari-chameleon/Invite.svelte.test.ts` と `oekaki-mori/Lobby.svelte.test.ts`
- `pnpm exec vitest run src/lib/games/oekaki-mori/ src/lib/games/animal-survivors/` → すべて pass

## Done criteria

- [ ] Commands の「足すテスト」が pass し、足した 6 つを含む
- [ ] `grep -n "!== 'mismatch') return close" src/lib/games/oekaki-mori/Invite.svelte` が何も返さない
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない（`src/lib/net/` を含む）
- [ ] `plans/README.md` の 048 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（3 つの `linked` / `Invite` と、カメレオンのお手本）が今のコードと違う
- `Party.add` の戻り値の型が `Seat | null | 'mismatch'` でない
- 協力プレイの親で `host = null` にすると、すでに始まっている遊ぶ画面に影響しそうに見える（`linked` は QR の手順の画面でしか
  呼ばれない前提。違えば報告）
- どれかの `.svelte` が 200 行を超えて svelte-vitals が落ちる（行を詰めるために中身を変えない。報告する）
- テストのために `src/lib/net/` を変えたくなった

## Maintenance notes

- QR でつなぐゲームを足すときは、`Party.add` の戻り値を「番号なら成功、それ以外は失敗」で受ける。成功の分岐を
  `!== 'mismatch'` で書かない
- 3 か所が同じ形になったので、4 本目のゲームで同じものを書くなら、そのとき `src/lib/net/` に寄せるかを考える
- 実機では、親が QR を出し、子が読み取った直後に子のアプリを閉じて、親の画面が「つながりませんでした」を出して QR を
  作り直すこと（おえかきのもりのロビー・よびなおす、協力プレイ）を見る
