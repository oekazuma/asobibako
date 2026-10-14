# Plan 067: 親が切れたと気づく前につなぎ直した子も、同じ端末なら前の番号で迎える

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/net/party.svelte.ts src/lib/net/party.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。
> `src/lib/games/oekaki-mori/CLAUDE.md` は毎日変わるので drift check に入れない。Step 4 の前に
> `grep -n "切れる前の番号・動物を" src/lib/games/oekaki-mori/CLAUDE.md` で直す文があることだけ確かめる。

## Status

| 項目       | 値                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| Priority   | P3                                                                                                           |
| Effort     | S                                                                                                            |
| Risk       | MED（3 本のゲームが共用する `Party` の席の決め方を変える。変えるのは「前の番号がまだ使われている」ときだけ） |
| Depends on | none                                                                                                         |
| Category   | bug                                                                                                          |
| Planned at | commit `ea56ff6`, 2026-10-14                                                                                 |

## Why this matters

2〜3 台の iPad を QR でつなぐゲーム（おえかきのもり・やっぱりカメレオン・アニマルサバイバーの協力プレイ）は、
`src/lib/net/party.svelte.ts` の `Party` を共用している。親は切れた子の番号を覚え（`Party.away`）、
戻ってきた子が `hello` で送る「切れる前の番号」（`was`）がその中にあれば、同じ番号で迎えて点数や役を引き継がせる。

ところが親が「切れた」と気づくのは、DataChannel の close か、接続の状態が `failed` になったときだけで、
iOS では 30 秒ほどかかることがある。そのあいだに子が先に切れたと気づいて「もう一度つなぐ」を押し、親が
「なかまを呼ぶ」（2 人のときだけ押せる）から QR を出してつなぎ直すと、前の番号はまだ古い管が持っているので空いておらず、
子は別の番号（3）で迎えられる。おえかきのもりなら点数と描く番を失い、やっぱりカメレオンなら途中から来た人として観戦に回る。
あとで古い管が閉じると、前の番号は誰も戻らない「切れた人」として残り続ける。

直したあとは、`hello` に端末の印を足し、前の番号を持つ古い管が同じ端末のものなら、その管を切れたものとして先に片づけ、
同じ番号で迎える。親が切れたと気づいたあとに戻ったときと同じ順（`leave` のあと `join`）でゲームのルールへ流れる。

## Current state

直すファイルは 2 つと、仕様の 1 文。

- `src/lib/net/party.svelte.ts` — 親を中心に 3 台までをつなぐ `Party`（181 行）
- `src/lib/net/party.svelte.test.ts` — そのテスト。手元でつないだ 2 本の管を作る `pipes()` と `trio()`・`settle()` がある
- `src/lib/games/oekaki-mori/CLAUDE.md` — `hello` で送るものを書いた 1 文（14 行目）

子は `Party.guest` で `hello` を送る（`src/lib/net/party.svelte.ts:56-75`）。

```ts
  /** was は切れる前の番号、look は動物。親は was が切れたまま空いていれば同じ番号で迎える */
  static guest(pipe: Pipe, hello: { was?: Seat; look?: string } = {}): Party {
    const party = new Party(false);
    party.#pipes.set(1, pipe);
    ...
    pipe.closed.then(() => (party.lost = true));
    pipe.send({ t: 'hello', v: PROTOCOL, was: hello.was ?? null, look: hello.look ?? null });
    return party;
  }
```

親は `add` で `hello` を待ち、`#seat` で番号を決める（`src/lib/net/party.svelte.ts:98-104` と `:112-129`）。

```ts
pipe.on((message) => {
  if (greeted || message.t !== 'hello') return;
  clearTimeout(timer);
  if (message.v !== PROTOCOL) return refuse();
  greeted = true;
  resolve(this.#seat(pipe, message.was as Seat | null, message.look as string | null));
});
```

```ts
  #seat(pipe: Pipe, was: Seat | null, look: string | null): Seat | null {
    const free = (s: Seat) => !this.#pipes.has(s);
    const back = was !== null && this.away.includes(was) && free(was) ? was : undefined;
    const seat = back ?? this.away.find(free) ?? ([2, 3] as const).find((s) => free(s) && !this.away.includes(s));
    if (!seat) {
      pipe.close();
      return null;
    }
    this.away = this.away.filter((s) => s !== seat);
    if (look) this.looks = { ...this.looks, [seat]: look };
    this.#pipes.set(seat, pipe);
    pipe.on((message) => this.#act(message, seat));
    pipe.closed.then(() => this.#drop(seat, pipe));
    pipe.send({ t: 'seat', seat });
    this.#setMembers([...this.members, seat]);
    this.#act({ t: 'join' }, seat);
    return seat;
  }
```

切れたときの片づけは `#drop`（`src/lib/net/party.svelte.ts:168-175`）。同じ番号に別の管が入ったあとに古い管が閉じても、
最初の行で何もしない。

```ts
  #drop(seat: Seat, pipe: Pipe) {
    // 閉じたあとに同じ番号へ別の子が入っていれば、それは消さない
    if (this.#pipes.get(seat) !== pipe) return;
    this.#pipes.delete(seat);
    this.away = [...this.away, seat].sort((a, b) => a - b);
    this.#setMembers(this.members.filter((s) => s !== seat));
    this.#act({ t: 'leave' }, seat);
  }
```

親が切れたと気づくのは `src/lib/net/link.ts:38-44` の 2 つだけ。

```ts
this.closed = new Promise((resolve) => {
  channel.addEventListener('close', () => resolve());
  // 相手が画面を閉じずに寝た・Wi-Fi から外れたときは channel の close が来ず、接続の状態だけが failed になる
  pc.addEventListener('connectionstatechange', () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') resolve();
  });
});
```

### 使っている側（影響の範囲）

- おえかきのもり `src/lib/games/oekaki-mori/Lobby.svelte:48` は `Party.guest(link, { was, look })`。`was` は自分の Party が
  `lost` になったときだけ入る（`OekakiMori.svelte:80`）。親は `Menu.svelte:42` で人数が 3 未満なら「なかまを よぶ」を出す
- やっぱりカメレオン `src/lib/games/yappari-chameleon/Entry.svelte:44` は `Party.guest(link, { was })`（`look` なし）。
  `was` は `Yappari.svelte:93-96` で Party が `lost` になったときだけ入る。親はロビーの「なかまを呼ぶ」（`Lobby.svelte:70`、人数が 3 未満）か、
  切れた人がいるときの「よびなおす」（`Invite.svelte:46-50`）から QR を出す
- CPU（`src/lib/games/yappari-chameleon/cpu/bot.ts:70`）は `Party.guest(pipe, { look: 'cpu' })` で `was` を送らない
- アニマルサバイバーの協力プレイ `src/lib/games/animal-survivors/CoopRoom.svelte:55` は `Party.guest(link)` で `was` を送らない

`was` を送らない 2 つは、この計画のあとも席の決め方が変わらない。

### 監査の指摘のうち、今は起きないこと

「3 人で遊んでいるときに戻ると、`#pipes.size >= 2`（`party.svelte.ts:83`）で断られる」という指摘は、画面からはたどれない。
3 人がつながっていて親がまだ気づいていないあいだは `away` が空で人数が 3 なので、どちらのゲームも QR を出すボタン
（「なかまを呼ぶ」「よびなおす」）を出さない。この計画では `add` の最初の満員の判定は変えない。

### 端末の印と、別の端末が前の番号を名乗る心配

`was` だけで古い管を切ると、困ることがある。子 A が番号 2 で切れ、親が気づいて新しい子 B を迎えると、B は切れた人の番号 2 を
もらう（`this.away.find(free)`）。そのあと A が `was: 2` で戻ると、つながっている B を切ってしまう。そこで `hello` にページを
開くたびに作る端末の印（`id`）を足し、親は番号ごとに迎えた子の印を覚えて、印が同じときだけ古い管を切る。
「もう一度つなぐ」は同じページで押すので印は同じで、ページを読み直した子は `was` も無くなる。

印は秘密ではない。QR を見せ合って目の前でつなぐ家族用のアプリで、親が自分で QR を出した相手しかつながらないので、
印を真似て人の番号を取る心配は考えなくてよい。`Math.random()` で足りる（`crypto.randomUUID()` は http の LAN の開発サーバーでは無い）。

`PROTOCOL`（`party.svelte.ts:15`、今は 5）は上げない。`id` は足すだけで、古い親は `id` を読まずに今までどおり迎え、新しい親は
`id` の無い古い子では古い管を切らない（今までどおり）。版を上げると、ほかのゲームを直していない端末どうしでもつなげなくなる。

### 規約

コメントは「コードから復元できない WHY」だけを日本語で書く。変更の経緯やチケット番号は書かない。テスト名は日本語の文にする。
テストの形は同じファイルの「2 人が切れても、それぞれが前の番号で戻る」（`party.svelte.test.ts:172-185`）と、
`hello` を手で送る「つなぎ方の版がちがう子は断り、…」（`:196-205`）にならう。

## Commands you will need

| Purpose        | Command                                                                                                         | Expected on success           |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| このテストだけ | `pnpm exec vitest run src/lib/net/party.svelte.test.ts`                                                         | すべて pass                   |
| 使う側のテスト | `pnpm exec vitest run src/lib/games/oekaki-mori src/lib/games/yappari-chameleon src/lib/games/animal-survivors` | すべて pass                   |
| 全テスト       | `pnpm test:run`                                                                                                 | exit 0                        |
| 型             | `pnpm check`                                                                                                    | `0 ERRORS 0 WARNINGS`、exit 0 |
| 全部           | `pnpm verify`                                                                                                   | exit 0                        |

## Scope

**In scope**

- `src/lib/net/party.svelte.ts`（`hello` に `id` を足す・番号ごとの印を覚える・`#seat` の最初で古い管を片づける・`close` で印を忘れる）
- `src/lib/net/party.svelte.test.ts`（テストを 2 つ足す）
- `src/lib/games/oekaki-mori/CLAUDE.md`（`hello` の 1 文に印のことを足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/net/link.ts` — 切れたと気づく速さ（ICE の見切り）は変えない
- `add` の最初の満員の判定（`#pipes.size >= 2`）— 画面から届かないので変えない
- `PROTOCOL` — 上げない（理由は Current state）
- 各ゲームの `Lobby.svelte` / `Entry.svelte` / `Invite.svelte` / `CoopRoom.svelte` / `cpu/` — 何も変えずに直る
- やっぱりカメレオンの `CHAMELEON_VERSION` — `Party` の知らせなので関係ない

## Git workflow

- ブランチは `advisor/067-party-fast-rejoin-same-seat`
- コミットは英語の命令形 1 文で、署名の行（Co-Authored-By など）は付けない（例 `Seat a quick rejoin from the same device in its old seat before the drop is noticed`）
- push しない（`main` への push は本番に自動デプロイされる）

## Steps

### Step 1: 落ちるテストを 2 つ足す

`src/lib/net/party.svelte.test.ts` の「2 人が切れても、それぞれが前の番号で戻る」の直後に、次の 2 つを足す。
`PROTOCOL` はすでに import してある。同じテストファイルの中の `Party.guest` は同じページなので、同じ端末の印を送る。

```ts
// iOS では親が切れたと気づくまで 30 秒ほどかかる。そのあいだに戻った子が別の番号になると、点数と番を失う
it('親が切れたと気づく前に同じ端末が前の番号でつなぎ直すと、古い管を切れたことにして同じ番号で迎える', async () => {
  const host = Party.host();
  const [a, a2] = pipes();
  Party.guest(a2);
  await host.add(a);
  const acts: [string, Seat][] = [];
  host.onAct((m, from) => acts.push([m.t, from]));
  let oldClosed = false;
  a2.closed.then(() => (oldClosed = true));
  const [c, c2] = pipes();
  const back = Party.guest(c2, { was: 2 });
  expect(await host.add(c)).toBe(2);
  await settle();
  expect(back.me).toBe(2);
  expect(oldClosed).toBe(true);
  expect(host.members).toEqual([1, 2]);
  expect(host.away).toEqual([]);
  expect(acts).toEqual([
    ['leave', 2],
    ['join', 2]
  ]);
});

// 切れた人の番号は次に来た別の子にも渡すので、前にその番号だった子が戻っても、今いる子を切らない
it('前の番号を名乗っても、端末の印がちがうか無ければ今の管を残し、空いた番号で迎える', async () => {
  for (const id of ['ほかの端末', undefined]) {
    const host = Party.host();
    const [a, a2] = pipes();
    Party.guest(a2);
    await host.add(a);
    let oldClosed = false;
    a2.closed.then(() => (oldClosed = true));
    const [c, c2] = pipes();
    c2.send({ t: 'hello', v: PROTOCOL, was: 2, look: null, ...(id ? { id } : {}) });
    expect(await host.add(c)).toBe(3);
    await settle();
    expect(oldClosed).toBe(false);
    expect(host.members).toEqual([1, 2, 3]);
  }
});
```

2 つめは、ほかの端末の印を送る子と、印を送らない古い版の子の両方を、それぞれ新しい親で確かめる。

**Verify**: `pnpm exec vitest run src/lib/net/party.svelte.test.ts` → 1 つめは `expect(await host.add(c)).toBe(2)` が 3 を受けて FAIL、
2 つめは直す前から pass、ほかはすべて pass。1 つめが直す前から pass したら STOP（読み違い）。

### Step 2: `hello` に端末の印を足す

`src/lib/net/party.svelte.ts` の定数（`CLOSE_AFTER_MS` の下）に足す。

```ts
/** ページを開くたびに作る端末の印。親が切れたと気づく前に戻った子が、前の番号の古い管と同じ端末かを見分ける（秘密ではない） */
const DEVICE = Math.random().toString(36).slice(2);
```

`Party.guest` の `pipe.send({ t: 'hello', … })` に `id: DEVICE` を足す。

```ts
pipe.send({ t: 'hello', v: PROTOCOL, was: hello.was ?? null, look: hello.look ?? null, id: DEVICE });
```

**Verify**: `pnpm exec vitest run src/lib/net/party.svelte.test.ts` → Step 1 と同じ結果（1 つめだけ FAIL）。

### Step 3: 同じ端末なら古い管を片づけてから番号を決める

1. `Party` のフィールド（`#tells` の下）に、番号ごとの印を足す。

   ```ts
     /** 親だけ。番号 → 迎えた子の端末の印 */
     readonly #ids = new Map<Seat, string>();
   ```

2. `add` の `resolve(this.#seat(…))` を、印も渡す形にする。

   ```ts
   resolve(
     this.#seat(
       pipe,
       message.was as Seat | null,
       message.look as string | null,
       typeof message.id === 'string' ? message.id : null
     )
   );
   ```

3. `#seat` の引数に `id: string | null` を足し、最初の `const free = …` の前に次を入れる。

   ```ts
   // 親が切れたと気づくまで iOS では 30 秒ほどかかる。そのあいだに同じ端末が戻ったら、前の管は切れたものとして片づける
   if (was !== null && id !== null && this.#ids.get(was) === id) {
     const old = this.#pipes.get(was);
     if (old) {
       this.#drop(was, old);
       old.close();
     }
   }
   ```

   `#drop` が番号を `away` へ入れ、顔ぶれから外して `leave` を流すので、続く `back` の行がそのまま前の番号を選ぶ。
   あとで古い管の `closed` が解決しても、`#drop` の最初の行（`this.#pipes.get(seat) !== pipe`）で何もしない。

4. 同じ `#seat` の `this.#pipes.set(seat, pipe);` の直後に、印を覚える行を足す。

   ```ts
   if (id === null) this.#ids.delete(seat);
   else this.#ids.set(seat, id);
   ```

5. `close()` の `this.away = [];` の直後に `this.#ids.clear();` を足す。

`#drop` と `add` の最初の満員の判定は変えない。

**Verify**: `pnpm exec vitest run src/lib/net/party.svelte.test.ts` → すべて pass（足した 2 つを含む 21 個）。

### Step 4: 仕様の 1 文を直す

`src/lib/games/oekaki-mori/CLAUDE.md` の次の文を探す。

```
子はつながると最初に、つなぎ方の版（`PROTOCOL`）・切れる前の番号・動物を `hello` で送る。
```

これを次にする（文の追加だけで、ほかの行は変えない）。

```
子はつながると最初に、つなぎ方の版（`PROTOCOL`）・切れる前の番号・動物・ページを開くたびに作る端末の印を `hello` で送る。
親がまだ切れたと気づいていない番号へ同じ端末の印の子が戻ったときは、古い管を切れたものとして片づけてから同じ番号で迎える（iOS では気づくまで 30 秒ほどかかる）。
```

**Verify**: `grep -c "端末の印" src/lib/games/oekaki-mori/CLAUDE.md` → `2`。

### Step 5: 使う側と全体の確かめ

**Verify**

- `pnpm exec vitest run src/lib/games/oekaki-mori src/lib/games/yappari-chameleon src/lib/games/animal-survivors` → すべて pass
- `pnpm verify` → exit 0

## Test plan

- 足すテストは Step 1 の 2 つ（同じ端末の早い戻りは前の番号・印がちがうか無ければ今の管を残す）
- もとからある「2 人が切れても、それぞれが前の番号で戻る」「切れた子の番号を覚え、次に迎える子へ先に渡す」
  「抜けた子の番号は、次に来た子に使う」が pass のままであること（親が気づいたあとの戻りは変えない）
- CPU が席に着く `src/lib/games/yappari-chameleon/cpu/bot.test.ts` と `crew` のテスト、おえかきのもりの `Lobby.svelte.test.ts` が pass のままであること

## Done criteria

- [ ] `pnpm exec vitest run src/lib/net/party.svelte.test.ts` が pass し、足した 2 つを含む
- [ ] `grep -n "PROTOCOL = 5" src/lib/net/party.svelte.ts` が 1 行出る（版を上げていない）
- [ ] `grep -c "this.#drop(was, old)" src/lib/net/party.svelte.ts` が `1`
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 067 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `party.svelte.ts` の `guest` / `add` / `#seat` / `#drop` が上の抜粋と違う
- Step 1 の 1 つめが直す前から pass する、または 2 つめが直す前から落ちる
- Step 3 のあと、もとからある Party のテストか、`cpu/` / `oekaki-mori` / `animal-survivors` のテストが落ちる
- `#drop` か `add` の満員の判定を変えないと直らないように見えた
- 直すのに各ゲームの `.svelte` を変えたくなった

## Maintenance notes

- 片づけた古い管には `leave`、新しい管には `join` が、親が気づいたあとに戻ったときと同じ順で流れる。各ゲームのルールが
  `leave` で役を変える（やっぱりカメレオンは探索中のハンターが抜けると `out` にする）のも、気づいたあとに戻ったときと同じになる
- 端末の印はページを開くたびに変わる。ページを読み直した子は `was` も無くなるので、印を保存して長く使う必要はない
- レビューでは、印がちがう・無い子が今の管を切らないこと（Step 1 の 2 つめ）を必ず見る。ここが崩れると、切れた人の番号を
  受け継いだ別の子が切られる
- 実機では 2 台で「子の Wi-Fi を切ってすぐ戻す → 子が『もう一度つなぐ』→ 親が『なかまを呼ぶ』から QR を出す」を、
  親の画面に切れた知らせが出る前に行い、子が前の番号（プレイヤー2）で戻ることを見る
