# Plan 079: おえかきのもりを 2 人で遊んでいて 1 人が切れても、呼び直すまで待つ

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/games/oekaki-mori/engine.ts src/lib/games/oekaki-mori/engine.test.ts src/lib/games/oekaki-mori/relay.ts src/lib/games/oekaki-mori/relay.test.ts src/lib/games/oekaki-mori/relay-referee.ts src/lib/games/oekaki-mori/relay-referee.test.ts src/lib/games/oekaki-mori/round.svelte.ts src/lib/games/oekaki-mori/round.svelte.test.ts src/lib/games/oekaki-mori/Invite.svelte src/lib/games/oekaki-mori/Invite.svelte.test.ts src/lib/games/oekaki-mori/OekakiMori.svelte`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。
> ただし次の差は別の計画によるもので想定どおりなので、先へ進んでよい。plan 069 の線の確かめ
> （`relay.ts` の import と `addInk`、`relay-referee.ts` の 6 行めと 47 行め、`round.svelte.ts` の import と `ink` の分岐）、
> plan 077 のつなぎ直しの直し（`OekakiMori.svelte` の `joined` と切れたときの `$effect`）。行番号はずれるので、下の抜粋は記号で探す。
> 仕様の文は `grep -n "抜けたときに消えた描く番は戻さない" src/lib/games/oekaki-mori/CLAUDE.md` で 1 行出ることを確かめる。

## Status

| 項目       | 値                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Priority   | P2                                                                                                                 |
| Effort     | M                                                                                                                  |
| Risk       | MED（遊びの終わり方を変える。変えるのは「2 人で遊んでいて 1 人になった」ときだけで、3 人の遊びの抜け方は今のまま） |
| Depends on | none（plan 069・077 と同じファイルを触るが、触る行は重ならない）                                                   |
| Category   | bug                                                                                                                |
| Planned at | commit `ea56ff6`, 2026-10-14                                                                                       |

## Why this matters

おえかきのもりは、子のつながりが切れても親が「よびなおす」で同じ番号に迎え直せ、点数を引き継ぐ。子のメニューも
「ぬけても おやが よびなおせるよ」と言う。ところが 2 人で遊んでいるときに 1 人が切れると、その瞬間に遊びが終わる。
エゴコロクイズとはやおし検定は結果の画面へ、おえかきリレーはふりかえりへ進むので、呼び直しても戻る遊びが無い。
iPad は画面が消えたり Wi-Fi が揺れたりで切れやすく、家族 2 人で遊ぶことがいちばん多い。

直したあとは、2 人で遊んでいて 1 人になったら、番も描く順も残したまま時計を止め、60 秒（`GRACE_S`）待つ。
そのあいだに呼び直して戻れば、止めたところから続ける。戻らなければ今と同じに終える。親の画面の「よびなおす」の帯には、
終えるまでの残りの秒を出す。

## Current state

### ルール（直すところ）

`src/lib/games/oekaki-mori/engine.ts` の `leave`（240-258 行め）は、人数が 2 未満になるとすぐ `done` にする。

```ts
export function leave(s: Quiz, seat: Seat, rand = Math.random, words: readonly string[] = WORDS): void {
  if (!s.players.includes(seat)) return;
  const wasDrawing = drawer(s) === seat && (s.phase === 'ready' || s.phase === 'draw');
  s.players = s.players.filter((p) => p !== seat);
  s.order = s.order.filter((p, i) => i <= s.turn || p !== seat);
  if (s.phase === 'done') return;
  if (s.players.length < 2) {
    s.phase = 'done';
    return;
  }
  if (wasDrawing) return begin(s, s.turn + 1, rand, words);
  ...
}
```

`rejoin`（260-265 行め）は `done` のあとは何もしない。抜けた人の、これからの描く番（`order`）は 244 行めで消え、戻っても戻さない。

```ts
/** 抜けた人（か途中から来た人）を当てる人として加える。抜けたときに消した描く番は、終わる時間が読めなくなるので戻さない */
export function rejoin(s: Quiz, seat: Seat): void {
  if (s.phase === 'done' || s.players.includes(seat)) return;
  s.players = [...s.players, seat].sort((a, b) => a - b);
  s.scores[seat] ??= 0;
}
```

時計は `tick`（210-238 行め）で進む。最初の 2 行で `done` なら何もせず、そうでなければ `s.left -= dt` する。

```ts
export function tick(s: Quiz, dt: number, rand = Math.random, words: readonly string[] = WORDS): Seat | null {
  if (s.phase === 'done') return null;
  s.left -= dt;
```

`Quiz` の形は 44-71 行め、`create` は 108-138 行め、見え方の `View` は 267-287 行め、`view()` は 289-310 行め。
定数は先頭（`LENGTHS`・`READY_S`・`REVEAL_S`・`ANSWER_S` など、18-27 行め）に並ぶ。

おえかきリレーは `src/lib/games/oekaki-mori/relay.ts`。`leave`（171-179 行め）は 1 人になるとふりかえりへ進め、`tick`（151-169 行め）は
`play` のあいだ時計を進め、全員のこまが埋まると次のだんへ進む（`advance`）。`rejoin`（181-183 行め）は始めたときの人だけを戻す。

```ts
/** 抜けた人のいまのこまは、描きかけの線のまま、答えはわからなかったとして埋める。1 人になったらふりかえりへ */
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
```

```ts
): void {
  if (s.phase !== 'play') return;
  s.left -= dt;
```

`Relay` の形は 20-38 行め、`createRelay` は 88-112 行め。`relay.ts:2` は `import { fit, LENGTHS, type Chars, type Length } from './engine';`。

### 審判と画面

親の審判は、ルールの `leave` と `rejoin` を `Party` の `leave` / `join` の知らせで呼ぶ（`referee.ts:80-91`、`relay-referee.ts:54-58`）。
親の `Party` は切れた子を必ず `away` に入れてから `leave` を流す（`src/lib/net/party.svelte.ts:168-175` の `#drop`）。
親（番号 1）は抜けることがなく、`players` が 1 人になったとき、つながっている端末は親だけになる。
そのため、待つあいだの知らせは親の画面にだけ出せばよい。

リレーの見え方は `relay-referee.ts:78-80` の `#viewOf` で作り、変わったときだけ `relayView` で全員に送る（`:92-96`）。

```ts
  #viewOf(s: Relay) {
    return { phase: s.phase, step: s.step, steps: s.steps, left: Math.max(0, Math.ceil(s.left)), done: [...s.done] };
  }
```

クイズの見え方は `view()` の結果を `view` の知らせで人ごとに送る（`referee.ts:118-128`。変わったときだけ）。

全員の端末の `Round`（`src/lib/games/oekaki-mori/round.svelte.ts`）は、親からの知らせを `receive` で受ける。`relayView` は
`Relay.svelte` が自分で受けるので、今の `Round` は読み飛ばす。`reset()` は 34-42 行め、`receive` は 44-76 行め、
`#show(next: View)` は 87-108 行め。`OekakiMori.svelte:38` で `next.onTell((m) => round.receive(m))` しているので、
`relayView` も `Round.receive` に届く。

親の画面には、切れた子がいるあいだ「よびなおす」の帯がもう出ている（`src/lib/games/oekaki-mori/Invite.svelte:52-56`）。

```svelte
{:else if away.length}
  <p class="lost" role="status">
    {away.map((s) => who(s, looks)).join('と')} の つながりが きれました
    <button class="pill p2" onclick={() => (open = true)}>よびなおす</button>
  </p>
{/if}
```

`Invite` の props は 7-17 行め（`away`・`onlink`・`looks`・`open`）。呼ぶ側は `OekakiMori.svelte:131-136`。

```svelte
{#if party.host}<Invite
    away={party.away}
    looks={party.looks}
    onlink={async (link) => party?.add(link)}
    bind:open={inviting}
  />{/if}
```

`Invite.svelte` は 100 行、`OekakiMori.svelte` は 163 行で、200 行未満の上限まで余裕がある。

### テスト（今の決まりを書いているもの）

今の「すぐ終わる」決まりを書いたテストが 3 つある。どれも新しい決まりに合わせて、わざと書き直す。

- `engine.test.ts:318-325`「1 人になったら done。抜けた人の点は残す」（2 人で 1 人が抜けると `done`）
- `engine.test.ts:372-380`「終わった遊びや、いる人には何もしない」（2 人で 1 人が抜けたあと `rejoin` しても戻らない、を `done` で確かめている）
- `relay.test.ts:105-114`「抜けた人のこまは埋めて進め、1 人になったらふりかえりに入る」

`engine.test.ts` の道具は `game(players)`（`create(players, fixed, WORDS)`）・`go(s)`（描き始めてお題を返す）・
`run(s, seconds)`（0.25 秒ずつ `tick`）。`relay.test.ts` の道具は `relay(players)` と `fixed`・`WORDS`。
`relay-referee.test.ts` の道具は `fakeParty(members)`・`frame(dt)`・`of(told, t)`（ファイルの先頭）。
`round.svelte.test.ts` の `view(over)` は `Partial<View>` から `View` を作る。`Invite.svelte.test.ts` は `Handshake` を差し替え、
`$state` の props で mount する（13-19 行め）。

`View` に足す欄は省略できる形（`wait?: number`）にする。必須にすると、`View` を手で作っているテストの道具
（`Buzzer.svelte.test.ts`・`TopBar.svelte.test.ts`・`round.svelte.test.ts`・`OekakiMori.svelte.test.ts`・`test/PlayHarness.svelte`）が
型エラーになる。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書き、変更の経緯やチケット番号は書かない。テストの名前は日本語の文にする。
ルールのファイル（`engine.ts`・`relay.ts`）は DOM と Svelte を使わない純粋な関数のまま保つ。

## Commands you will need

| Purpose       | Command                                                                                                                                                 | Expected on success           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| ルール        | `pnpm exec vitest run src/lib/games/oekaki-mori/engine.test.ts src/lib/games/oekaki-mori/relay.test.ts src/lib/games/oekaki-mori/relay-referee.test.ts` | すべて pass                   |
| 画面          | `pnpm exec vitest run src/lib/games/oekaki-mori/round.svelte.test.ts src/lib/games/oekaki-mori/Invite.svelte.test.ts`                                   | すべて pass                   |
| 全テスト      | `pnpm test:run`                                                                                                                                         | exit 0                        |
| 型            | `pnpm check`                                                                                                                                            | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                                                                                             | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                                                                                    | 警告 0                        |
| 全部          | `pnpm verify`                                                                                                                                           | exit 0                        |

ブラウザは使わない。

## Scope

**In scope**

- `src/lib/games/oekaki-mori/engine.ts`（`GRACE_S`・`Quiz.wait`・`View.wait`・`create`・`tick`・`leave`・`rejoin`・`view`）
- `src/lib/games/oekaki-mori/engine.test.ts`
- `src/lib/games/oekaki-mori/relay.ts`（`Relay.wait`・`createRelay`・`tick`・`leave`・`rejoin`）
- `src/lib/games/oekaki-mori/relay.test.ts`
- `src/lib/games/oekaki-mori/relay-referee.ts`（`#viewOf` だけ）
- `src/lib/games/oekaki-mori/relay-referee.test.ts`
- `src/lib/games/oekaki-mori/round.svelte.ts`（`wait` を持つ）
- `src/lib/games/oekaki-mori/round.svelte.test.ts`
- `src/lib/games/oekaki-mori/Invite.svelte`（帯に残りの秒を出す）
- `src/lib/games/oekaki-mori/Invite.svelte.test.ts`
- `src/lib/games/oekaki-mori/OekakiMori.svelte`（`Invite` に `wait` を渡す 1 行）
- `src/lib/games/oekaki-mori/CLAUDE.md`（戻った子の決まりの文に 1 文足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- 3 人の遊びで 1 人が抜けたときの決まり（描く番を消す・残りで続ける）— 今のまま
- `src/lib/net/` の全部 — 待つかどうかはルールが人数で決める。`Party.away` をルールへ渡さない（切れた子は必ず `away` に入る）
- 待つあいだに親が自分で遊びを終えるボタン — 今は無い。60 秒で終わる。要るなら別の計画にする
- 子の画面に「まっています」を出すこと — 1 人になったとき、つながっている端末は親だけ
- `Play.svelte`・`TopBar.svelte`・`RelayPlay.svelte` — 止まった時計はそのまま出る。待つ知らせは親の帯に出す
- `Menu.svelte`（plan 070 が直す）
- `Relay.svelte` — `relayView` を自分の `View` の型に読み替えるだけなので、足した `wait` は読み飛ばされる。帯は `Round` から出す

## Git workflow

- ブランチは `advisor/079-oekaki-two-player-grace`
- ブランチを作る前に `git rev-parse HEAD` を控える（以下 `BASE`。Done criteria で、このブランチの変更だけを見るのに使う）
- コミットは 2 つ。ルール（Step 1〜3）と、画面と仕様（Step 4〜5）。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない
  （例 `Pause a two-player oekaki game while the host calls the dropped player back` と
  `Show the remaining wait on the host's call-back banner`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: クイズのルールのテストを、新しい決まりで書く（落ちる）

`engine.test.ts` の import に `GRACE_S` を足す（アルファベット順の並びに合わせ、`fit` の次あたりに入れる）。

1. `describe('leave')` の「1 人になったら done。抜けた人の点は残す」を、次の 3 つに置き換える。

   ```ts
   // 2 人のときに切れてすぐ終えると、親が呼び直しても戻る遊びが無い
   it('2 人で 1 人が抜けたら、時計を止めて GRACE_S 秒待ち、戻らなければ done。抜けた人の点は残す', () => {
     const s = game([1, 2]);
     const word = go(s);
     guess(s, 2, word);
     leave(s, 2, fixed, WORDS);
     expect(s.phase).toBe('reveal');
     expect(view(s, 1).wait).toBe(GRACE_S);
     const left = s.left;
     run(s, GRACE_S - 1);
     expect(s.phase).toBe('reveal');
     expect(s.left).toBe(left);
     expect(view(s, 1).wait).toBe(1);
     run(s, 2);
     expect(s.phase).toBe('done');
     expect(s.scores[2]).toBe(3);
   });

   it('待つあいだに戻ったら、止めたところから続け、抜けた人の描く番も消さない', () => {
     const s = game([1, 2]);
     go(s);
     const order = [...s.order];
     leave(s, 2, fixed, WORDS);
     run(s, 5);
     rejoin(s, 2);
     expect(s.players).toEqual([1, 2]);
     expect(s.order).toEqual(order);
     expect(view(s, 1).wait).toBe(0);
     const left = s.left;
     run(s, 1);
     expect(s.phase).toBe('draw');
     expect(s.left).toBeLessThan(left);
   });

   it('2 人で描いている人が抜けても、次の番へ移らずに待つ', () => {
     const s = game([1, 2]);
     go(s);
     leave(s, 1, fixed, WORDS);
     expect(s.phase).toBe('draw');
     expect(drawer(s)).toBe(1);
     rejoin(s, 1);
     expect(drawer(s)).toBe(1);
     expect(view(s, 2).wait).toBe(0);
   });
   ```

2. `describe('rejoin')` の「終わった遊びや、いる人には何もしない」の最初の 4 行（`const s = game([1, 2]);` から
   `expect(s.players).toEqual([1]);` まで）を、待ち切って終わったあとで確かめる形にする。

   ```ts
   const s = game([1, 2]);
   leave(s, 2, fixed, WORDS);
   run(s, GRACE_S + 1);
   rejoin(s, 2);
   expect(s.players).toEqual([1]);
   ```

   後半（`const t = game(); rejoin(t, 2); …`）はそのまま。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/engine.test.ts` → 無い名前の import は読み込みでは落ちず
`undefined` になるので、足した 3 つと書き直した 1 つが FAIL する（`expected 'done' to be 'reveal'` や `undefined` との
比べで）。ほかのテストは pass。

### Step 2: クイズのルールを直す（`engine.ts`）

1. `ANSWER_S` の近くに定数を足す。

   ```ts
   /** 2 人で遊んでいて 1 人が切れたとき、親が呼び直すのを待つ秒。過ぎたら遊びを終える */
   export const GRACE_S = 60;
   ```

2. `Quiz` に欄を足す（`out: Seat[];` の下）。

   ```ts
   /** 2 人で遊んでいて 1 人が切れたあと、遊びを終えるまでの残り秒。0 なら待っていない */
   wait: number;
   ```

3. `create` の初めの値に `wait: 0` を足す（`out: []` を `out: [],` にして次の行）。
4. `tick` の `if (s.phase === 'done') return null;` の次に足す。

   ```ts
   // 待つあいだは時計を止める。戻った人が、止めたところから同じ番を続けられるように
   if (s.wait > 0) {
     s.wait -= dt;
     if (s.wait <= 0) s.phase = 'done';
     return null;
   }
   ```

5. `leave` を、`players` を減らした直後に待つ形にする。描く順を消す行より前に置き、今の `if (s.players.length < 2) { … }` の 4 行は消す。

   ```ts
   s.players = s.players.filter((p) => p !== seat);
   // 2 人のときは呼び直せば戻れるので、番も描く順も残して待つ。戻らなければ tick が終える
   if (s.phase !== 'done' && s.players.length < 2) {
     s.wait = GRACE_S;
     return;
   }
   s.order = s.order.filter((p, i) => i <= s.turn || p !== seat);
   if (s.phase === 'done') return;
   if (wasDrawing) return begin(s, s.turn + 1, rand, words);
   ```

6. `rejoin` の `s.scores[seat] ??= 0;` の次に `s.wait = 0;` を足し、関数の JSDoc を
   「抜けた人（か途中から来た人）を当てる人として加え、待っていればやめる。3 人の遊びで抜けたときに消した描く番は、終わる時間が読めなくなるので戻さない」にする。
7. `View` の `out: Seat[];` の下に足す。

   ```ts
   /** 2 人で遊んでいて 1 人が切れたとき、遊びを終えるまでの残り秒（切り上げ）。待っていなければ 0 */
   wait?: number;
   ```

8. `view()` の返す値の `out: [...s.out]` を `out: [...s.out],` にし、次の行に `wait: Math.max(0, Math.ceil(s.wait))` を足す。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/engine.test.ts` → すべて pass（3 人の `leave` のテストと
「抜けた人が戻ったら当てる人として加え、…描く番は戻さない」を含む）。

### Step 3: リレーのルールを同じ決まりにする（`relay.ts`）

先にテストを書く。`relay.test.ts` の import に `import { GRACE_S } from './engine';` を足す。

1. 「抜けた人のこまは埋めて進め、1 人になったらふりかえりに入る」を次に置き換える。

   ```ts
   it('抜けた人のこまは埋めて進め、1 人になったら GRACE_S 秒待ってからふりかえりに入る', () => {
     const s = relay();
     finish(s, 1);
     finish(s, 2);
     leave(s, 3);
     tick(s, 0, fixed, WORDS, {});
     expect(s.step).toBe(1);
     leave(s, 2);
     expect(s.phase).toBe('play');
     const left = s.left;
     tick(s, GRACE_S - 1, fixed, WORDS, {});
     expect(s.phase).toBe('play');
     expect(s.left).toBe(left);
     tick(s, 2, fixed, WORDS, {});
     expect(s.phase).toBe('reveal');
   });
   ```

2. そのすぐ下に足す。

   ```ts
   it('1 人で待つあいだはだんを進めず、戻ったら続ける', () => {
     const s = relay([1, 2]);
     leave(s, 2);
     finish(s, 1);
     tick(s, 0, fixed, WORDS, {});
     expect(s.step).toBe(0);
     rejoin(s, 2);
     expect(s.wait).toBe(0);
     tick(s, 0, fixed, WORDS, {});
     expect(s.step).toBe(1);
     expect(taskOf(s, 2).kind).toBe('guess');
   });
   ```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/relay.test.ts` → 足した・置き換えた 2 つが FAIL、ほかは pass。

次に `relay.ts` を直す。

1. 2 行めの import を `import { fit, GRACE_S, LENGTHS, type Chars, type Length } from './engine';` にする。
2. `Relay` の `page: { chain: number; index: number };` の下に足す。

   ```ts
   /** 1 人になったあと、ふりかえりへ進むまでの残り秒。0 なら待っていない */
   wait: number;
   ```

3. `createRelay` の初めの値の `page: { chain: 0, index: 0 }` を `page: { chain: 0, index: 0 },` にし、次の行に `wait: 0` を足す。
4. `tick` の `if (s.phase !== 'play') return;` の次に足す。

   ```ts
   // 待つあいだは時計もだんも止める。戻った人が同じだんから続けられるように
   if (s.wait > 0) {
     s.wait -= dt;
     if (s.wait > 0) return;
     s.phase = 'reveal';
     s.page = { chain: 0, index: 0 };
     return;
   }
   ```

5. `leave` の JSDoc の「1 人になったらふりかえりへ」を「1 人になったら、呼び直すのを待ってからふりかえりへ」にし、
   最後の `if (s.phase === 'play' && s.present.length < 2) { … }` の 4 行を次の 1 行にする。

   ```ts
   if (s.phase === 'play' && s.present.length < 2) s.wait = GRACE_S;
   ```

6. `rejoin` を次にする。

   ```ts
   export function rejoin(s: Relay, seat: Seat): void {
     if (!s.players.includes(seat) || s.present.includes(seat)) return;
     s.present = [...s.present, seat];
     s.wait = 0;
   }
   ```

7. `relay-referee.ts` の `#viewOf` の返す値に `wait: Math.max(0, Math.ceil(s.wait))` を足す（`done: [...s.done]` のあと）。
   `pnpm format` で 120 字に合わせて整える。

`relay-referee.test.ts` の import に `import { GRACE_S } from './engine';` を足し、`describe('RelayReferee')` の最後に足す。

```ts
it('1 人で待つあいだは、リレーの見え方に遊びを終えるまでの残り秒を載せる', () => {
  frames.list = [];
  const { party, told, act } = fakeParty([1, 2]);
  new RelayReferee(party).start('short', null);
  frame();
  act({ t: 'leave' }, 2);
  frame(1);
  expect(of(told, 'relayView').at(-1)![1]).toMatchObject({ phase: 'play', wait: GRACE_S - 1 });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/engine.test.ts src/lib/games/oekaki-mori/relay.test.ts src/lib/games/oekaki-mori/relay-referee.test.ts src/lib/games/oekaki-mori/referee.test.ts`
→ すべて pass。`pnpm check` → `0 ERRORS 0 WARNINGS`。

コミットする。`Pause a two-player oekaki game while the host calls the dropped player back`

### Step 4: 親の「よびなおす」の帯に、終えるまでの残りの秒を出す

先にテストを書く。

1. `round.svelte.test.ts` の `describe` の最後に足す（`view(over)` の道具を使う）。

   ```ts
   it('待つ残り秒を、クイズとリレーの見え方から受け取り、画面が替わったら 0 にする', () => {
     const r = new Round();
     r.receive({ t: 'view', view: view({ wait: 42 }) });
     expect(r.wait).toBe(42);
     r.receive({ t: 'screen', screen: 'relay' });
     expect(r.wait).toBe(0);
     r.receive({ t: 'relayView', phase: 'play', step: 0, steps: 4, left: 30, done: [], wait: 7 });
     expect(r.wait).toBe(7);
   });
   ```

2. `Invite.svelte.test.ts` の `describe('Invite')` の最後に足す。

   ```ts
   it('待っているあいだは、帯に遊びを終えるまでの残りの秒を出す', () => {
     const props = $state({ away: [2] as Seat[], open: false, onlink: vi.fn(), looks: {}, wait: 42 });
     const target = document.body.appendChild(document.createElement('div'));
     const app = mount(Invite, { target, props });
     flushSync();
     const band = () => target.querySelector('.lost')?.textContent ?? '';
     expect(band()).toContain('あと 42 びょう');
     props.wait = 0;
     flushSync();
     expect(band()).not.toContain('びょう');
     unmount(app);
   });
   ```

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/round.svelte.test.ts src/lib/games/oekaki-mori/Invite.svelte.test.ts`
→ 足した 2 つが FAIL、ほかは pass。

次に直す。

1. `round.svelte.ts` の `close = $state(false);` の下に足す。

   ```ts
   /** 2 人で遊んでいて 1 人が切れたとき、遊びを終えるまでの残り秒。親の「よびなおす」の帯に出す */
   wait = $state(0);
   ```

   `reset()` の中と、`receive` の `m.t === 'screen'` の分岐の中に `this.wait = 0;` を足す。`receive` の
   `else if (m.t === 'view') this.#show(m.view as View);` の次に
   `else if (m.t === 'relayView') this.wait = Number(m.wait) || 0;` を足す。`#show` の `this.view = next;` の前に
   `this.wait = next.wait ?? 0;` を足す。

2. `Invite.svelte` の props に `wait = 0` を足す（分割代入と型の両方。型は `wait?: number;`、JSDoc は
   「遊びを終えるまでの残り秒。2 人で遊んでいて 1 人が切れたときだけ 0 より大きい」）。帯の文を次にする。

   ```svelte
   {away.map((s) => who(s, looks)).join('と')} の つながりが きれました{wait ? `。あと ${wait} びょう まつよ` : ''}
   ```

3. `OekakiMori.svelte` の `<Invite` に `wait={round.wait}` を足す（`looks={party.looks}` の次の行）。

**Verify**: `pnpm exec vitest run src/lib/games/oekaki-mori/` → すべて pass。`wc -l src/lib/games/oekaki-mori/Invite.svelte src/lib/games/oekaki-mori/OekakiMori.svelte`
→ どちらも 199 以下。

### Step 5: 仕様の文を直し、全体を通す

`src/lib/games/oekaki-mori/CLAUDE.md` の次の 1 行を探す（`grep -n "抜けたときに消えた描く番は戻さない"` で出る行）。

```text
戻った子には `sync.ts` の `catchUp` で絵を送り、審判が見え方を送り直す（ルールでは `rejoin`。点数は引き継ぎ、抜けたときに消えた描く番は戻さない）。
```

この行を、次の 2 行に置き換える（もとの文の決まりを 3 人のときに絞り、2 人のときの決まりを足す）。

```text
戻った子には `sync.ts` の `catchUp` で絵を送り、審判が見え方を送り直す（ルールでは `rejoin`。点数は引き継ぐ。3 人で遊んでいて抜けたときに消えた描く番は戻さない）。
2 人で遊んでいて 1 人が切れたときは、番も描く順も残したまま時計を止めて 60 秒（`GRACE_S`）待ち、親の「よびなおす」の帯に残りの秒を出す。戻らなければエゴコロクイズとはやおし検定は終わり、おえかきリレーはふりかえりへ進む。
```

**Verify**: `grep -c "GRACE_S" src/lib/games/oekaki-mori/CLAUDE.md` → `1`。`pnpm verify` → exit 0。

コミットする。`Show the remaining wait on the host's call-back banner`

## Test plan

- `engine.test.ts` で 1 つ置き換え・2 つ足し・1 つ書き直す（待って終わる、戻れば続けて描く順も残る、描く人が抜けても番を移さない、待ち切ったあとの `rejoin` は何もしない）
- `relay.test.ts` で 1 つ置き換え・1 つ足す（待ってからふりかえり、待つあいだはだんを進めず戻れば続ける）
- `relay-referee.test.ts` に 1 つ（リレーの見え方に残り秒を載せる）
- `round.svelte.test.ts` に 1 つ、`Invite.svelte.test.ts` に 1 つ（帯に残りの秒）
- 3 人の遊びのテスト（`engine.test.ts` の `describe('leave')` の 4 つ、`relay.test.ts` の「戻った人は次のだんから受け持ち、…」、
  `referee.test.ts` の `leave` を使う 2 つ）は変えずに pass すること
- 確かめは `pnpm exec vitest run src/lib/games/oekaki-mori/` → すべて pass

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] 上の Test plan のテストがあり pass する
- [ ] `grep -n "1 人になったら done" src/lib/games/oekaki-mori/engine.test.ts` が何も返さない
- [ ] `grep -c "export const GRACE_S = 60" src/lib/games/oekaki-mori/engine.ts` が `1`
- [ ] `grep -c "GRACE_S" src/lib/games/oekaki-mori/relay.ts` が `2` 以上（import と `leave`）
- [ ] `grep -c "GRACE_S" src/lib/games/oekaki-mori/CLAUDE.md` が `1`
- [ ] `git diff --stat BASE..HEAD -- src/lib/net/` が空（`BASE` は Git workflow で控えた値）
- [ ] `git status` で In scope の外のファイルが変わっていない

## STOP 条件

- 「Current state」の `leave`・`rejoin`・`tick`（`engine.ts` と `relay.ts`）が今のコードと違う（plan 069 の想定どおりの差は除く）
- 3 人の遊びのテスト（Test plan に挙げたもの）が落ちる。3 人の抜け方は変えない決まりなので、テストを直さず報告する
- `View` に `wait?: number` を足したあと、`pnpm check` が `View` を作っているテストの道具で型エラーを出す
- 待つあいだに `start`・`guess`・`buzz`・`answer` を親が押すと壊れるテストが見つかる（このときは止める範囲を広げず報告する）
- 直すために `src/lib/net/` や `Menu.svelte`・`Play.svelte`・`RelayPlay.svelte` を変える必要が出てくる
- 確かめのコマンドが、手直しを 2 回しても通らない

## Maintenance notes

- 待つあいだ、親（描く人のとき）は「かきはじめる」を押して描けるが、時計は止まったまま。戻らなければ 60 秒で終わる
- はやおし検定で答えている人が切れたとき、2 人なら答える時間ごと止まり、戻ればそのまま答えられる。3 人なら今のまま答える権利を消す
- 子が自分で「ぬける」を押しても親からは切れたのと同じに見えるので、2 人なら 60 秒待ってから終わる。待たずに終えたいという声が出たら、
  帯に「おわりにする」を足す（親の審判へ `leave` と同じ知らせで終える）
- `GRACE_S` は `engine.ts` にあり、リレーも同じ値を使う。2 つの遊び方で長さを変えたくなったら定数を分ける
- 3 人で遊んで 2 人が続けて切れたときは、1 人めは今の決まり（描く番を消す）、2 人めで待つ。戻った 1 人めの描く番は戻らない
- 実機では iPad 2 台で、描いている途中に子の端末の Wi-Fi を切り、親の帯の秒が減ること、呼び直すと同じ絵の続きから描けることを見る
