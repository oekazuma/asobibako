# Plan 068: カメレオンの増え鬼で戻った子と来た子の塗りを正しくし、席を引き継いだ端末の時計を見積もり直す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/games/yappari-chameleon/host.ts src/lib/games/yappari-chameleon/host.test.ts src/lib/games/yappari-chameleon/session.svelte.ts src/lib/games/yappari-chameleon/session.svelte.test.ts src/lib/games/yappari-chameleon/net.ts src/lib/net/timeline.ts src/lib/net/timeline.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。
> `src/lib/games/yappari-chameleon/CLAUDE.md` は毎日変わるので drift check に入れない。Step 6 で直す文を grep で確かめる。

## Status

| 項目       | 値                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                              |
| Effort     | M                                                                                               |
| Risk       | LOW〜MED（知らせを 1 つ足して `CHAMELEON_VERSION` を 7 に上げる。古い端末とはつながらなくなる） |
| Depends on | none（plans/067 と同時に進めてよい。触るファイルが重ならない）                                  |
| Category   | bug                                                                                             |
| Planned at | commit `ea56ff6`, 2026-10-14                                                                    |

## Why this matters

やっぱりカメレオン（2〜3 台の iPad を QR でつなぐ 3D のかくれんぼ）の増え鬼モードでは、見つかった隠れる人は破片が消えたあと
白い体のハンターになる（仕様）。答え合わせでは、その人が撃たれた場所に「見つかったときの体」を塗りごと置いて青く光らせる。
試合の途中で来た子・切れて戻った子のまわりで、次の 3 つがずれている。

1. 答え合わせのあいだに来た・戻った子の画面では、増え鬼でハンターになった人の撃たれた場所の体が真っ白になる。
   親はその人の今の塗りの列（ハンターになって白に戻した列）しか持っておらず、見つかったときの塗りを送れないため
2. 増え鬼で、切れているあいだに撃たれた隠れる人が戻ると、白い体ではなく前の塗りのままのハンターになり、ほかの全員にもそう見える
3. 切れた人の席に別の端末（またはページを読み直した端末）が入ると、親がその席の「届くまでの間」の見積もり（`Timeline.offset()`）を
   前の端末の時計のまま最大 2 秒（40 回分）使う。そのあいだ、その席の隠れる人に撃った弾は、撃った時刻ではない体で当たりを決める

3 つとも、つなぎ直しが起きた試合でしか出ないが、1 と 2 は答え合わせで全員が見る画面がおかしくなる。

## Current state

### 関係するファイル

- `src/lib/games/yappari-chameleon/host.ts` — 親の端末だけで動く審判 `Host`（382 行）
- `src/lib/games/yappari-chameleon/host.test.ts` — そのテスト。`setup()`・`searching()`・`me()`・`of()`・`lastView()`・`paint()`・`SHOT` がある
- `src/lib/games/yappari-chameleon/session.svelte.ts` — 各端末で親の知らせを画面へ写す `Session`（684 行）
- `src/lib/games/yappari-chameleon/session.svelte.test.ts` — そのテスト。`setup(me, inbox)`・`at()`・`meMsg()`・`body()`・`dab()`・`made.remotes` がある
- `src/lib/games/yappari-chameleon/net.ts` — 知らせの形と `CHAMELEON_VERSION`（今は 6）
- `src/lib/net/timeline.ts` — 送った時刻つきの値の並び `Timeline`（40 行）。アニマルサバイバーの協力プレイ（`coop.ts`）も使う
- `src/lib/net/timeline.test.ts` — そのテスト
- `src/lib/games/yappari-chameleon/CLAUDE.md` — このゲームの仕様

### 1 つめ（答え合わせに来た子の画面で、撃たれた場所の体が白い）

親は見つかったときの体だけを覚える（`host.ts:68-69`）。

```ts
  /** 見つかったときの体。戻った子の答え合わせで、その場に戻して見せる */
  readonly #found = new Map<Seat, Me>();
```

撃って当たったときに入れる（`host.ts:303-307`）。

```ts
if (!rules.hit(this.match, seat, from)) continue;
struck = true;
const body = this.#lines.get(seat)?.last();
if (body) this.#found.set(seat, body);
this.#port.tell('all', { t: 'found', seat, by: from, at: r.end, body });
```

来た・戻った子へは `welcome` で、席ごとの今の塗りの列（`#logs`）のあとに、見つかったときの体を演出なし（`quiet`）で送る
（`host.ts:188-203`）。ダブルの残した体は、体（`left`）のあとにそのときの塗り（`leftDabs`）も送っている。

```ts
  welcome(to: Seat): void {
    for (const [seat, line] of this.#lines) {
      const me = line.last();
      if (me) this.#port.tell(to, { t: 'me', ...me, seat });
    }
    for (const [seat, log] of this.#logs) for (const m of dabMessages(seat, 0, log)) this.#port.tell(to, m);
    for (const seat of this.match.found) {
      const body = this.#found.get(seat);
      if (body) this.#port.tell(to, { t: 'found', seat, by: 0, at: body.pos, body, quiet: true });
    }
    for (const [seat, left] of this.#left) {
      this.#port.tell(to, { t: 'left', seat, body: left.body });
      for (const m of dabMessages(seat, 0, left.log)) this.#port.tell(to, { ...m, t: 'leftDabs' });
    }
    this.#port.tell(to, { t: 'phase', view: rules.view(this.match) });
  }
```

`#found` はほかに、ロビーと紹介で消し（`host.ts:343`、`this.#found.clear();`）、答え合わせに入るときにいた場所を決める
（`host.ts:358`）。

```ts
const at = left ?? this.#found.get(seat) ?? this.#lines.get(seat)?.last();
```

見つかった子は、増え鬼では破片が消えたあと `#turn` で自分の列を消す（`session.svelte.ts:290-298`）。列を消すと
`DabOutbox.take` が `{ at: 0, d: [] }` を送り、親の `#logs` のその席も空になる（`host.ts:152-158` の `splice`）。

```ts
  #turn() {
    const b = this.play.body;
    this.play.log.clear();
    this.play.rebuildPaint();
```

子の側では、見つかったときに、その人の体（`Remote`）の今の列を `#snaps` に写す（`session.svelte.ts:260-275`）。

```ts
  #onFound(seat: Seat, by: Seat, body: Me | undefined, quiet: boolean) {
    if (this.match.double) {
      ...
    }
    if (body) this.#found.set(seat, body);
    const me = this.match.me;
    const live = seat === me ? null : this.#remote(seat);
    if (live) this.#snaps.set(seat, [...live.log]);
    if (quiet) return;
```

答え合わせでは、増え鬼でハンターになった人の撃たれた場所の体（`#pins`）を `#snaps` の塗りで 1 度だけ作る
（`session.svelte.ts:440-449` と `:350-359`）。

```ts
    for (const [seat, r] of this.#remotes) {
      r.update(dt, now, this.#show(seat));
      const body = this.#infected(seat) ? this.#found.get(seat) : undefined;
      if (body)
        this.#pin(seat, this.#snaps.get(seat) ?? r.log).update(dt, now, {
```

```ts
  #pin(seat: Seat, paint: readonly Dab[]): Remote {
    let r = this.#pins.get(seat);
    if (!r) {
      r = new Remote(this.#makeRig(), this.play.world.scene);
      r.log.push(...paint);
      r.rig.paint.rebuild(r.log);
      this.#pins.set(seat, r);
    }
    return r;
  }
```

来た子では `#turn` のあとの空の列が先に届くので、`#snaps` は空になり、撃たれた場所の体は白くなる。

知らせの受け口は `session.svelte.ts:128-145` の `#receive`。ダブルの塗りは次の 1 行で受けている。

```ts
    else if (m.t === 'leftDabs') this.#pins.get(seat)?.dabs(m.at as number, m.d as number[]);
```

`splice` と `unpackDabs` は `session.svelte.ts:16` で `./net` から import 済み。`splice(log, at, add)` は足しただけなら
`'append'`、途中から差し替えたら `'rebuild'`、間が空くなら `null` を返して何もしない（`net.ts:87-93`）。

### 2 つめ（切れているあいだに撃たれた子が、塗りのままハンターで戻る）

親は切れた隠れる人の体もその場に残し、撃てば見つかる（`host.test.ts:332` のテスト「切れた隠れる人の体はその場に残り、撃てば見つかる」）。
増え鬼では `rules.hit` がその席をハンターにする（`referee.ts:454`、`if (m.settings.mode === 'infect') m.roles[seat] = 'hunter';`）。
その子が戻ると、親に残っていた体と塗りを受け、最初の様子で `#fit` が銃を持たせるが、塗りは消さない
（`session.svelte.ts:170-189` の `#phase`）。

```ts
if (first) {
  // ロビーと紹介は #enter でも必ず置き直す。親に残っていた体は前の試合の屋敷の中のことがある
  if (!this.#own || v.phase === 'lobby' || v.phase === 'intro') this.#place();
  // 戻った子には親に残っていた探す前の塗りが届くことがあるが、ダブルの探す人は白い体なので消す（残した体は left で写してある）
  if (this.match.double && (v.phase === 'search' || v.phase === 'reveal')) this.#whiten();
  this.#fit(this.#own);
  if (v.phase === 'reveal') this.#reveal();
} else if (before !== v.phase) this.#enter();
```

ダブルの探す人を白くする `#whiten`（`session.svelte.ts:218-224`）が、増え鬼でも同じ働きをする。列を消すと次に送るときに
`{ at: 0, d: [] }` が親へ行き、親の `#logs` もほかの人の画面の体も白に戻る（テスト「ダブルの探索や答え合わせの最中に戻ったハンターは、
親に残っていた塗りを消して白い体になる…」`session.svelte.test.ts:778-791` がこの流れを確かめている）。

```ts
  #whiten() {
    // 描きかけの筆を先に切る。白に戻したあとで取り消しや続きの吹き付けが届くと、消した列が食い違う
    this.play.interrupt();
    this.play.log.clear();
    this.play.rebuildPaint();
    this.play.canUndo = false;
  }
```

`Match` には `role`（自分の役）と `found(seat = this.me)` がある（`match.svelte.ts:81-85`）。

### 3 つめ（席を引き継いだ端末の時計）

親は席ごとの体の並びを `Timeline` で持ち、ロビーに戻っても消さない（`host.ts:64`、`readonly #lines = new Map<Seat, Timeline<Me>>();`）。
来た・戻った子の扱いは `host.ts:136-140`。

```ts
if (m.t === 'join') {
  rules.join(this.match, from);
  this.welcome(from);
  return this.#push(true);
}
```

`Timeline`（`src/lib/net/timeline.ts:2-39`）は届いた時刻と送った時刻の差を 40 回分覚え、いちばん小さいものを `offset()` にする。
値は 12 個まで。

```ts
export class Timeline<T> {
  #items: { src: number; v: T }[] = [];
  /** 届いた時刻 - 送った時刻。いちばん小さいものを、むらの無いときの届くまでの間とみなす（2 台の時計のずれも込み） */
  #gaps: number[] = [];

  push(src: number, local: number, v: T): void {
    this.#items.push({ src, v });
    if (this.#items.length > 12) this.#items.shift();
    this.#gaps.push(local - src);
    if (this.#gaps.length > 40) this.#gaps.shift();
  }
  ...
  clear(): void {
    this.#items = [];
    this.#gaps = [];
  }
```

撃った弾は `#liveTargets(m.ms + this.#line(from).offset())` で、隠れる人の並びを `line.at(at, back)` でさかのぼって調べる
（`host.ts:285` と `:313-325`）。`performance.now()` はページごとに 0 から数えるので、別の端末が同じ席に入ると、前の端末の差が
40 回分（1 秒に 20 回送るので 2 秒）残り、`at()` が前の端末の時刻の物差しで値を選ぶ。

同じページの「もう一度つなぐ」は時計が同じなので、今のままでも困らない。それでも親はどの端末が来たかを区別できないので、
`join` のたびに見積もり直す。最後の値（`last()`）は残す。`welcome` はその席の最後の体を戻った子へ送り（plans/046 の続きの場所）、
戻った子が自分の動きを送り始めるまで（3D を作る数秒）、切れていたあいだの体が撃てる的として残っているため。

ほかの端末の画面の体（`remote.ts:31` の `Remote.line`）も同じ並びを持つが、子には席に人が来た知らせ（`join`）が届かず、
ずれても見た目が最大 2 秒なめらかでなくなるだけなので、この計画では直さない。

### 規約

- コメントは「コードから復元できない WHY」だけを日本語で書く。変更の経緯やチケット番号は書かない
- テスト名は日本語の文にする
- `CHAMELEON_VERSION` は「知らせの形や、当たりのある家具を足すなど屋敷か体の当たりが変わるときに上げる」（仕様）。知らせを足すので 7 に上げる。
  版ごとに「前の子（版 N）は迎えない」テストを足す決まりがある（`host.test.ts:775-780` がお手本）

## Commands you will need

| Purpose        | Command                                                                               | Expected on success           |
| -------------- | ------------------------------------------------------------------------------------- | ----------------------------- |
| 親のテスト     | `pnpm exec vitest run src/lib/games/yappari-chameleon/host.test.ts`                   | すべて pass                   |
| 子のテスト     | `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts`         | すべて pass                   |
| Timeline       | `pnpm exec vitest run src/lib/net/timeline.test.ts`                                   | すべて pass                   |
| このゲーム全部 | `pnpm exec vitest run src/lib/games/yappari-chameleon src/lib/games/animal-survivors` | すべて pass                   |
| 型             | `pnpm check`                                                                          | `0 ERRORS 0 WARNINGS`、exit 0 |
| 全部           | `pnpm verify`                                                                         | exit 0                        |

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/host.ts`（`#found` に塗りを持たせる・`welcome` で `foundDabs` を送る・`join` で時計を見積もり直す）
- `src/lib/games/yappari-chameleon/host.test.ts`（テストを 3 つ足す）
- `src/lib/games/yappari-chameleon/session.svelte.ts`（`foundDabs` を受ける・増え鬼で戻ったハンターを白くする）
- `src/lib/games/yappari-chameleon/session.svelte.test.ts`（テストを 3 つ足す）
- `src/lib/games/yappari-chameleon/net.ts`（`CHAMELEON_VERSION` を 7 に）
- `src/lib/net/timeline.ts`（`restart()` を足す）
- `src/lib/net/timeline.test.ts`（テストを 1 つ足す）
- `src/lib/games/yappari-chameleon/CLAUDE.md`（版の数・`welcome` で送るもの・増え鬼で戻った人の 3 か所）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/net/party.svelte.ts` — 親が切れたと気づく前の戻りは plans/067 が扱う
- `remote.ts` の `Remote.line` — 見た目だけのずれで、子には席に人が来た知らせが無い
- `referee.ts` — 役と見つかった人の決め方は変えない
- `cpu/` — CPU は `found` と `foundDabs` を描かないので変えない
- `Timeline.clear()` と、`coop.ts`（アニマルサバイバー）の Timeline の使い方 — 足すだけで変えない

## Git workflow

- ブランチは `advisor/068-chameleon-rejoin-infect-paint-and-clock`
- コミットは英語の命令形 1 文で、署名の行（Co-Authored-By など）は付けない（例 `Keep the infect-mode found paint for late joiners and whiten hunters who return infected`）
- push しない（`main` への push は本番に自動デプロイされる）

## Steps

### Step 1: 落ちるテストを足す（親）

`src/lib/games/yappari-chameleon/host.test.ts` に 3 つ足す。

1. `describe('Host の戻った子', …)` の最後（「戻った子へ、全員の体・塗り・今の様子をこの順に送り、…」の後ろ）に足す。

   ```ts
   it('増え鬼で見つかった人の、見つかったときの塗りを覚え、来た子へ found のあとに foundDabs で送る（持ち主の今の列は白）', () => {
     const { act, told, host } = searching();
     act(me(0, [0, 0, 5]), 2);
     act({ t: 'dabs', at: 0, d: packDabs(paint(5)) }, 2);
     act(me(0, [0, 0, 0]), 3);
     act({ ...SHOT, ms: 0 }, 3);
     expect(of(told, 'found')).toHaveLength(1);
     // ハンターになった持ち主は列を白に戻して送り直す
     act({ t: 'dabs', at: 0, d: [] }, 2);
     told.length = 0;
     host.welcome(3);
     const mine = told.filter((x) => x.to === 3).map((x) => x.m);
     const sent = mine.filter((m) => m.t === 'foundDabs' && m.seat === 2);
     expect(sent.reduce((n, m) => n + (m.d as number[]).length, 0)).toBe(5 * DAB_LEN);
     expect(mine.findIndex((m) => m.t === 'found' && m.seat === 2)).toBeLessThan(
       mine.findIndex((m) => m.t === 'foundDabs')
     );
     expect(mine.findIndex((m) => m.t === 'phase')).toBe(mine.length - 1);
     expect(mine.filter((m) => m.t === 'dabs' && m.seat === 2).every((m) => (m.d as number[]).length === 0)).toBe(true);
   });

   // 前の端末の時計の差が残ると、2 秒ほど撃った時刻ではない体で当たりを決める
   it('切れた席に時計のちがう別の端末が来ても、撃った時刻の体で決める', () => {
     const { act, told, clock, port } = searching({ mode: 'normal' });
     const skew = 1_000_000;
     // 前の端末（時計が 1000 秒進んでいる）が席 2 で隠れていた
     for (let t = 0; t <= 300; t += 50) {
       clock.ms = t + 30;
       act(me(t + skew, [9, 0, 9]), 2);
     }
     port.members = [1, 3];
     act({ t: 'leave' }, 2);
     port.members = [1, 2, 3];
     act({ t: 'hi', v: CHAMELEON_VERSION }, 2);
     act({ t: 'join' }, 2);
     // 別の端末（親と同じ時計）が同じ席で続ける。親の時計で 1300ms に撃ち、2 はその直後に横へ 3m 動いた
     for (let t = 1000; t <= 1500; t += 50) {
       clock.ms = t + 30;
       act(me(t, t <= 1300 ? [0, 0, 5] : [3, 0, 5]), 2);
       act(me(t, [0, 0, 0]), 3);
     }
     clock.ms = 1540;
     act({ ...SHOT, ms: 1300 }, 3);
     expect(of(told, 'found')).toHaveLength(1);
   });
   ```

2. `describe('Host の逆算チキンレース', …)` の最後の「逆算チキンレースの前の子（版 5）は迎えない」の直後に足す。

   ```ts
   it('増え鬼の見つかったときの塗りを受けない前の子（版 6）は迎えない', () => {
     const { act, told } = setup([1, 2]);
     act({ t: 'leave' }, 2);
     act({ t: 'hi', v: 6 }, 2);
     expect(told.at(-1)).toEqual({ to: 2, m: { t: 'chameleon-mismatch' } });
   });
   ```

`CHAMELEON_VERSION`・`DAB_LEN`・`packDabs` はこのファイルですでに import してある。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/host.test.ts` → 足した 3 つがすべて FAIL
（1 つめは `foundDabs` が 0 個、2 つめは `found` が 0 個、3 つめは版 6 を迎えてしまう）。ほかはすべて pass。
どれかが直す前から pass したら STOP（読み違い）。

### Step 2: 親で見つかったときの塗りを覚えて送り、版を上げる

`src/lib/games/yappari-chameleon/host.ts` を次のようにする。

1. `#found` の型と説明（`host.ts:68-69`）を変える。

   ```ts
     /** 見つかったときの体と、そのときの塗りの列。戻った子の答え合わせで、その場に戻して見せる（増え鬼でハンターになった人の今の列は白） */
     readonly #found = new Map<Seat, { body: Me; log: number[] }>();
   ```

2. `#shot` の `if (body) this.#found.set(seat, body);`（`host.ts:306`）を次にする。

   ```ts
   if (body) this.#found.set(seat, { body, log: [...(this.#logs.get(seat) ?? [])] });
   ```

3. 答え合わせのいた場所（`host.ts:358`）の `this.#found.get(seat)` を `this.#found.get(seat)?.body` にする。

4. `welcome` の見つかったときの体のループ（`host.ts:194-197`）を次にする。

   ```ts
   for (const seat of this.match.found) {
     const found = this.#found.get(seat);
     if (!found) continue;
     this.#port.tell(to, { t: 'found', seat, by: 0, at: found.body.pos, body: found.body, quiet: true });
     // 増え鬼でハンターになった人の今の列は白いので、撃たれた場所の体はこの列で作らせる（found より後に送る。found が列を写し直すため）
     if (this.match.settings.mode === 'infect')
       for (const m of dabMessages(seat, 0, found.log)) this.#port.tell(to, { ...m, t: 'foundDabs' });
   }
   ```

5. `welcome` の上の説明（`host.ts:184-187`）の「見つかったときの体」を「見つかったときの体（増え鬼ではそのときの塗りも）」にする。

6. `src/lib/games/yappari-chameleon/net.ts` の `export const CHAMELEON_VERSION = 6;` を `7` にする。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/host.test.ts` → Step 1 の 1 つめと 3 つめが pass、2 つめ（時計）だけ FAIL。
もとからあるテストはすべて pass（とくに「戻った子へ、全員の体・塗り・今の様子をこの順に送り、…」は通常モードなので `foundDabs` を送らない）。

### Step 3: 席に人が来たら、その席の時計を見積もり直す

1. `src/lib/net/timeline.ts` の `clear()` の上に足す。

   ```ts
     /** 送る側の端末が替わったかもしれない（時計の起点がちがう）。最後の値は残し、届くまでの間は届く値から見積もり直す */
     restart(): void {
       this.#items = this.#items.slice(-1);
       this.#gaps = [];
     }
   ```

2. `src/lib/net/timeline.test.ts` の最後のテストの後ろに足す。

   ```ts
   it('送る端末が替わったら、最後の値は残し、届くまでの間を新しい時計で見積もり直す', () => {
     const line = new Timeline<number>();
     line.push(1_000_000, 50, 1);
     line.restart();
     expect(line.last()).toBe(1);
     expect(line.offset()).toBe(0);
     line.push(100, 130, 2);
     expect(line.offset()).toBe(30);
     expect(line.at(1000, 0)).toEqual({ a: 2, b: 2, t: 0 });
   });
   ```

3. `src/lib/games/yappari-chameleon/host.ts` の `if (m.t === 'join') {`（`host.ts:136`）の直後の行に足す。

   ```ts
   // 切れた席には別の端末やページを読み直した端末も入る。前の端末の時計で見積もった差を使うと、弾のさかのぼりがずれる
   this.#lines.get(from)?.restart();
   ```

   `welcome` は最後の体を `last()` で読むので、`restart` が最後の値を残していれば順はどちらでもよい。

**Verify**

- `pnpm exec vitest run src/lib/net/timeline.test.ts` → すべて pass（足した 1 つを含む）
- `pnpm exec vitest run src/lib/games/yappari-chameleon/host.test.ts` → すべて pass（「時計のずれた子の弾も、撃った時刻の体で決める…」を含む）

### Step 4: 落ちるテストを足す（子）

`src/lib/games/yappari-chameleon/session.svelte.test.ts` に 3 つ足す。

1. `describe('Session の戻った子', …)` の最後（「答え合わせの最中に戻ると、…」の後ろ）に足す。

   ```ts
   it('増え鬼で切れているあいだに見つかって戻った子は、親に残っていた塗りを消して白い体のハンターになる', () => {
     const messages = [
       meMsg(2, { pos: [4, 0, 6], pose: 'curl' }),
       { t: 'dabs', seat: 2, at: 0, d: packDabs([dab(0), dab(1)]) },
       { t: 'found', seat: 2, by: 3, at: [4, 1, 6], body: body({ pos: [4, 0, 6], pose: 'curl' }), quiet: true },
       at('search', { roles: { 1: 'hider', 2: 'hunter', 3: 'hunter' }, found: [2] })
     ] as Message[];
     const { play, frames, acts } = setup(2, { messages, stop: vi.fn() });
     expect(play.role).toBe('hunter');
     expect(play.log.dabs).toHaveLength(0);
     expect(play.canUndo).toBe(false);
     frames(0.1);
     expect(acts.find((m) => m.t === 'dabs')).toMatchObject({ at: 0, d: [] });
   });
   ```

2. `describe('Session の答え合わせの塗り', …)` の中の既存のテストの後ろに 2 つ足す。

   ```ts
   it('増え鬼の答え合わせに来た子は、ハンターになった人の撃たれた場所の体を foundDabs の塗りで作る（今の列は白）', () => {
     const messages = [
       meMsg(1, { pos: [6, 0, 6], pose: AIM.id }),
       { t: 'found', seat: 1, by: 3, at: [1, 1, 0], body: body({ pos: [1, 0, 0] }), quiet: true },
       { t: 'foundDabs', seat: 1, at: 0, d: packDabs([dab(0), dab(1)]) },
       at('reveal', { roles: { 1: 'hunter', 2: 'hider', 3: 'hunter' }, found: [1], winner: 'chameleon' })
     ] as Message[];
     const { frames } = setup(2, { messages, stop: vi.fn() });
     frames(0.1);
     const pin = made.remotes.at(-1)!;
     expect(pin.rig.paint.rebuild).toHaveBeenCalledWith([dab(0), dab(1)]);
   });

   it('撃たれた場所の体を作ったあとに届いた foundDabs は、その体へ足す', () => {
     const messages = [
       meMsg(1, { pos: [6, 0, 6], pose: AIM.id }),
       { t: 'found', seat: 1, by: 3, at: [1, 1, 0], body: body({ pos: [1, 0, 0] }), quiet: true },
       { t: 'foundDabs', seat: 1, at: 0, d: packDabs([dab(0)]) },
       at('reveal', { roles: { 1: 'hunter', 2: 'hider', 3: 'hunter' }, found: [1], winner: 'chameleon' })
     ] as Message[];
     const { frames, tell } = setup(2, { messages, stop: vi.fn() });
     frames(0.1);
     const pin = made.remotes.at(-1)!;
     const d = packDabs([dab(1)]);
     tell({ t: 'foundDabs', seat: 1, at: 1, d });
     expect(pin.dabs).toHaveBeenCalledWith(1, d);
   });
   ```

テストの `Remote` は偽物で（ファイル先頭の `vi.mock('./remote', …)`）、`dabs` は `vi.fn()`、`log` は空のままになる。
撃たれた場所の体は答え合わせの最初のコマで作られるので、`made.remotes.at(-1)` がそれになる（既存の
「増え鬼で見つかってハンターになった人の撃たれた場所の体は、見つかったときの塗りで作る」と同じ見方）。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts` → 足した 3 つがすべて FAIL
（1 つめは `play.log.dabs` が 2、2 つめは `rebuild` が `[]` で呼ばれる、3 つめは `pin.dabs` が呼ばれない）。ほかはすべて pass。
どれかが直す前から pass したら STOP。

### Step 5: 子で foundDabs を受け、増え鬼で戻ったハンターを白くする

`src/lib/games/yappari-chameleon/session.svelte.ts` を次のようにする。

1. `#receive` の `leftDabs` の行（`session.svelte.ts:142`）の直後に足す。

   ```ts
       else if (m.t === 'foundDabs') this.#foundPaint(seat, m.at as number, m.d as number[]);
   ```

2. `#onFound` の直前に、メソッドを足す。

   ```ts
     /**
      * 増え鬼の見つかったときの塗り。来た・戻った子へ found のあとに分けて届く。持ち主はハンターになって列を白に戻しているので、
      * 撃たれた場所の体はこの列で作る。体を作ったあとに届いた分は、その体へ足す
      */
     #foundPaint(seat: Seat, at: number, d: number[]) {
       const pin = this.#pins.get(seat);
       if (pin) return pin.dabs(at, d);
       const snap = this.#snaps.get(seat) ?? [];
       if (splice(snap, at, unpackDabs(d)) !== null) this.#snaps.set(seat, snap);
     }
   ```

3. `#phase` の `if (first) {` の中、ダブルの `#whiten()` の行（`session.svelte.ts:185`）の直後に足す。

   ```ts
   // 増え鬼で切れているあいだに撃たれた子は、#turn を通らずにハンターで戻るので、親に残っていた塗りをここで消す
   if (v.settings.mode === 'infect' && this.match.role === 'hunter' && this.match.found()) this.#whiten();
   ```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts` → すべて pass（足した 3 つを含む）。

### Step 6: 仕様を直す

`src/lib/games/yappari-chameleon/CLAUDE.md` の 3 か所を直す。まず直す文があることを確かめる。

- `grep -c "CHAMELEON_VERSION.、6" src/lib/games/yappari-chameleon/CLAUDE.md` → `1`
- `grep -c "全員の体・塗り・見つかったときの体・ダブルの残した体とその塗り・試合の様子をこの順に送り" src/lib/games/yappari-chameleon/CLAUDE.md` → `1`
- `grep -c "増え鬼では破片が消えたあと白い体のハンターになり、" src/lib/games/yappari-chameleon/CLAUDE.md` → `1`

どれかが `0` なら STOP。直し方は次の 3 つ。

1. `` `CHAMELEON_VERSION`、6 `` を `` `CHAMELEON_VERSION`、7 `` にする
2. 「全員の体・塗り・見つかったときの体・ダブルの残した体とその塗り」を
   「全員の体・塗り・見つかったときの体（増え鬼ではそのときの塗りも `foundDabs` で）・ダブルの残した体とその塗り」にする
3. 「増え鬼では破片が消えたあと白い体のハンターになり、」を
   「増え鬼では破片が消えたあと白い体のハンターになり（切れているあいだに見つかった人も、戻ると白い体のハンターになる）、」にする

**Verify**: `grep -c "foundDabs" src/lib/games/yappari-chameleon/CLAUDE.md` → `1` 以上、かつ
`grep -c "CHAMELEON_VERSION.、7" src/lib/games/yappari-chameleon/CLAUDE.md` → `1`。

### Step 7: 全体の確かめ

**Verify**

- `pnpm exec vitest run src/lib/games/yappari-chameleon src/lib/games/animal-survivors src/lib/net` → すべて pass
- `pnpm verify` → exit 0

## Test plan

- 足すテストは、親 3 つ（`foundDabs` を送る・別の端末の時計・版 6 を迎えない）、子 3 つ（増え鬼で戻ったハンターは白い・
  `foundDabs` で撃たれた場所の体を作る・作ったあとの分は足す）、`Timeline` 1 つ
- もとからある次のテストが pass のままであること
  - `host.test.ts` の「時計のずれた子の弾も、撃った時刻の体で決める…」「切れた隠れる人の体はその場に残り、撃てば見つかる」
    「戻った子へ、全員の体・塗り・今の様子をこの順に送り、…」「ダブルで戻った子へ、残した体とそのときの塗りを…」
  - `session.svelte.test.ts` の「増え鬼で見つかると、破片が消えたあと白い体のハンターになり、銃を持つ」
    「増え鬼で見つかってハンターになった人の撃たれた場所の体は、見つかったときの塗りで作る」
    「ダブルの探索や答え合わせの最中に戻ったハンターは、…白い体になる…」「戻ったハンターは、親に残っていた続きの場所から銃を持つ」
  - `src/lib/games/animal-survivors` の協力プレイのテスト（`Timeline` を共用している）

## Done criteria

- [ ] 足した 7 つのテストが pass する（上の 3 つのファイルと `timeline.test.ts`）
- [ ] `grep -n "CHAMELEON_VERSION = 7" src/lib/games/yappari-chameleon/net.ts` が 1 行出る
- [ ] `grep -n "foundDabs" src/lib/games/yappari-chameleon/host.ts src/lib/games/yappari-chameleon/session.svelte.ts` が両方のファイルで出る
- [ ] `grep -n "restart()" src/lib/games/yappari-chameleon/host.ts` が 1 行出る
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 068 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `host.ts` の `#found` / `welcome` / `#shot` / `join`、`session.svelte.ts` の `#receive` / `#phase` / `#onFound` / `#pin`、
  `timeline.ts` の `Timeline` が上の抜粋と違う
- `CHAMELEON_VERSION` がすでに 7 以上（ほかの計画が先に上げた）。そのときは「前の子（版 6）」のテストと Step 6 の数を今の版に合わせてよいか報告して待つ
- Step 1 か Step 4 のテストのどれかが、直す前から pass する
- Step 3 のあと、もとからある「時計のずれた子の弾も…」が落ちる（`restart` が最後の値まで消している、または `join` 以外で呼んでいる）
- Step 5 の白くする条件で、もとからある「戻ったハンターは、親に残っていた続きの場所から銃を持つ」か、増え鬼で見つからずに戻った隠れる人の
  テストが落ちる（見つかっていない人まで白くしている）
- 直すのに `referee.ts`・`remote.ts`・`party.svelte.ts` を変えたくなった

## Maintenance notes

- 戻った子へ送るもの（`Host.welcome`）を増やすときは、受ける側の順に気をつける。`found` は `#snaps` を写し直すので、
  `foundDabs` はかならずその後に送る
- `foundDabs` を送るのは増え鬼だけにしている。通常と逆算チキンレースは見つかった人の今の列が白に戻らないので、送ると同じ塗りを 2 回送る
- `Timeline.restart` は `join` のたびに呼ぶ。同じ端末の戻りでも見積もりを捨てるが、1 秒に 20 回届くので次の値からすぐ見積もり直る
- ほかの端末の画面の体（`Remote.line`）は、別の端末が席に入っても見積もりを持ち越す（見た目が最大 2 秒なめらかでなくなるだけ）。
  気になったら、子が顔ぶれ（`Party.members`）から席が抜けて戻ったのを見て `restart` する
- 版を 7 に上げるので、Pages に出したあと、遊ぶ iPad はすべて最新版に更新してからつなぐ
- 実機では 3 台で、増え鬼の探索のあいだに隠れる人の Wi-Fi を切り、切れているあいだにその人を撃ってから戻し、白い体のハンターで
  戻ること、答え合わせで別の子がつなぎ直したとき、撃たれた場所の体が塗りのまま出ることを見る
