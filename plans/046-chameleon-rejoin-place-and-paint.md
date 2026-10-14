# Plan 046: カメレオンでつなぎ直した子を、ロビーと紹介では席の場所に出し、自分の塗りを差分で塗る

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat b565b01..HEAD -- src/lib/games/yappari-chameleon/session.svelte.ts src/lib/games/yappari-chameleon/session.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                    |
| ---------- | ----------------------------------------------------- |
| Priority   | P1                                                    |
| Effort     | S                                                     |
| Risk       | LOW（戻った子の最初の様子の扱いと、塗りの受け方だけ） |
| Depends on | none                                                  |
| Category   | bug                                                   |
| Planned at | commit `b565b01`, 2026-10-14                          |

## Why this matters

やっぱりカメレオン（2〜3 台の iPad をつないで遊ぶ 3D のかくれんぼ）で起きる 2 つの不具合を直す。

1. 試合中に切れた子が、試合が終わってロビーに戻ってからつなぎ直すと、ロビーの部屋ではなく屋敷の中（切れる前の隠れ場所や
   探していた場所）に出る。ロビーは出口の無い別の部屋なので、次の紹介が始まるまでほかの人に会えず、ハンター希望の台にも乗れない。
   CLAUDE.md の仕様は「つないだあとと試合のあとは席ごとの場所（`SPAWNS.lobby`）に出る」。
2. 戻った子には、親に残っていた自分の塗りが約 32KB（約 360 筆）ずつの知らせで届く。今は届くたびに体の塗りを最初から全部
   塗り直しているので、2 万筆塗った体なら全部の塗り直しが約 55 回になり、戻った直後に数秒止まりうる。ほかの人の体を受ける
   `Remote.dabs` は、足しただけなら差分だけ塗っている。同じようにする。

## Current state

直すファイルは 2 つ。

- `src/lib/games/yappari-chameleon/session.svelte.ts` — 各端末で、親から届いた知らせを画面の状態へ写す `Session`
- `src/lib/games/yappari-chameleon/session.svelte.test.ts` — `Session` のテスト。3D は偽物（`fakeWorld()`）

### 1 つめ（ロビーに戻った子が屋敷に出る）の流れ

親（`host.ts`）は、各席の最後の体（`#lines`）をロビーに戻っても消さない。来た・戻った子には、その子自身の席の体も含めて
全員の最後の体を送る（`host.ts:187-191` の `welcome`）。

子の側では、まだ様子を受けていない（`!this.match.synced`）あいだに届いた自分の体を `#own` に入れて、その場所に置く
（`session.svelte.ts:150-155`）。

```ts
  /** 戻った子が、親に残っていた自分の体を受け取る */
  #ownBody(me: Me) {
    this.#own = me;
    this.#setBody(me);
  }
```

最初の様子では、`#own` があると席の場所へ置き直さない（`session.svelte.ts:163-180`）。

```ts
  #phase(v: View) {
    const first = !this.match.synced;
    const before = this.match.phase;
    // 戻った子と途中で来た子は最初の様子で種を受けるので、フェーズの変わり目だけでなく、届くたびに見る
    if (v.seed !== this.#seed) {
      this.#seed = v.seed;
      this.play.world.arrange(v.seed);
    }
    this.match.receive(v);
    // #place と #fit より前に入れ、置き直す体もハンターになる体もこの大きさで作る
    this.play.scale = liveScale(v, this.match.me);
    if (first) {
      if (!this.#own) this.#place();
      // 戻った子には親に残っていた探す前の塗りが届くことがあるが、ダブルの探す人は白い体なので消す（残した体は left で写してある）
      if (this.match.double && (v.phase === 'search' || v.phase === 'reveal')) this.#whiten();
      this.#fit(this.#own);
      if (v.phase === 'reveal') this.#reveal();
    } else if (before !== v.phase) this.#enter();
  }
```

ふつうにフェーズが変わるとき（`#enter`、`session.svelte.ts:183-196`）は、ロビーと紹介に入るたびに必ず置き直している。

```ts
  #enter() {
    const p = this.match.phase;
    if (p === 'reveal') this.#liked = false;
    if (p === 'lobby' || p === 'intro') {
      this.#reset();
      this.#place();
    }
```

`#place()`（`session.svelte.ts:224-230`）は、フェーズと役から `SPAWNS` の席の場所を選ぶ。

```ts
  #place() {
    const p = this.match.phase;
    const room = this.match.role === 'hunter' && (p === 'intro' || p === 'hide');
    this.play.placeAt(SPAWNS[p === 'lobby' ? 'lobby' : room ? 'room' : 'hall'][this.match.me]);
    // 始める場所はどれも北（+z）を向いている。ロビーなら台、大広間なら屋敷の奥が見える
    this.play.camYaw = 0;
  }
```

隠れタイム・探索・答え合わせに戻った子が `#own` の場所から続けるのは仕様どおりで、変えない
（テスト「親に残っていた自分の体と塗りを受け取り、様子が届いてから、その場の動きを送り始める」が固めている）。
直すのは、最初の様子がロビーか紹介のときだけ。

親の `#lines` を消す直し方は採らない。`#lines` は各席の `Timeline` で、時計のずれ（`offset()`）の見積もりも持っているので、
消すと撃った弾のさかのぼりがずれる。

### 2 つめ（戻った子の塗りを、届くたびに最初から塗る）

今のコード（`session.svelte.ts:157-161`）は次のとおり。

```ts
  #ownPaint(at: number, d: number[]) {
    if (splice(this.play.log.dabs, at, unpackDabs(d)) === null) return;
    this.play.rebuildPaint();
    this.#out.adopt(this.play.log);
  }
```

`splice`（`net.ts:87-93`）は、列の末尾に足しただけなら `'append'`、途中から差し替えたら `'rebuild'`、間が空くなら `null` を返す。

```ts
export function splice<T>(log: T[], at: number, add: readonly T[]): 'append' | 'rebuild' | null {
  if (at > log.length) return null;
  const cut = at < log.length;
  log.length = at;
  log.push(...add);
  return cut ? 'rebuild' : 'append';
}
```

お手本は、ほかの人の体の同じ処理（`remote.ts:56-61`）。

```ts
  dabs(at: number, d: number[]): void {
    const add = unpackDabs(d);
    const how = splice(this.log, at, add);
    if (how === 'rebuild') this.rig.paint.rebuild(this.log);
    else if (how === 'append') this.rig.paint.apply(add);
  }
```

自分の体の塗りの面は `this.play.world.rig.paint`（`PaintSurface`。`apply(dabs)` と `rebuild(dabs)` を持つ、`paint-gpu.ts:235,252`）。
`this.play.rebuildPaint()` は `this.world.rig.paint.rebuild(this.log.dabs)` を呼ぶだけ（`play.svelte.ts:284-286`）。

### テストの道具

`session.svelte.test.ts` の補助をそのまま使う。

- `setup(me)` が `{ s, play, acts, tell, frames }` を返す。`tell(m)` で親からの知らせを渡す
- `at(phase, extra)` が試合の様子の知らせ（2 が隠れる人、3 がハンター）
- `meMsg(seat, extra)` が体の知らせ、`dab(i)` が 1 筆、`packDabs` で知らせの形にする
- `fakeWorld()` の `rig.paint` は `{ rebuild: vi.fn(), apply: vi.fn() }`
- 型にするテストは「ロビーではロビーの部屋の席の場所に出て、北の台を向く」（`session.svelte.test.ts:604-610`）と
  「親に残っていた自分の体と塗りを受け取り、…」（`:319-335`）

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く。テストの名前は日本語の文にする。

## Commands you will need

| Purpose        | Command                                                                       | Expected on success           |
| -------------- | ----------------------------------------------------------------------------- | ----------------------------- |
| このテストだけ | `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts` | すべて pass                   |
| 全テスト       | `pnpm test:run`                                                               | exit 0                        |
| 型             | `pnpm check`                                                                  | `0 ERRORS 0 WARNINGS`、exit 0 |
| 全部           | `pnpm verify`                                                                 | exit 0                        |

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/session.svelte.ts`（`#phase` の 1 行と `#ownPaint`）
- `src/lib/games/yappari-chameleon/session.svelte.test.ts`（テストを 3 つ足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `host.ts` — 親の `#lines` は時計の見積もりも持つので消さない。`welcome` が送るものも変えない
- `remote.ts` / `paint-gpu.ts` / `net.ts` — お手本として読むだけ
- `CHAMELEON_VERSION` — 知らせの形は変えないので上げない
- CLAUDE.md — 仕様はすでに正しい（「つないだあとと試合のあとは席ごとの場所に出る」）

## Git workflow

- ブランチは `advisor/046-chameleon-rejoin-place-and-paint`
- コミットは英語の命令形 1 文（例 `Place a rejoining player at the lobby seat and paint their returned log incrementally`）
- push しない（`main` への push は本番に自動デプロイされる）

## Steps

### Step 1: 落ちるテストを 3 つ足す

`session.svelte.test.ts` の「親に残っていた自分の体と塗りを受け取り、…」のテストの直後に、次の 3 つを足す。
`SPAWNS` と `packDabs` と `dab` はこのファイルですでに import・定義されている。

```ts
it('試合のあとロビーに戻ってから戻った子は、親に残っていた屋敷の体ではなく、ロビーの席の場所に出る', () => {
  const { play, tell } = setup();
  tell(meMsg(2, { pos: [4, 0, 6], pose: 'curl' }));
  tell(at('lobby'));
  expect(play.body.pos).toEqual([...SPAWNS.lobby[2]]);
});

it('紹介のあいだに戻った子も、親に残っていた前の試合の体ではなく、紹介の席の場所に出る', () => {
  const { play, tell } = setup();
  tell(meMsg(2, { pos: [4, 0, 6] }));
  tell(at('intro'));
  expect(play.body.pos).toEqual([...SPAWNS.hall[2]]);
});

it('戻った子へ分けて届く自分の塗りは、足しただけなら足した筆だけを塗り、差し替えたときだけ塗り直す', () => {
  const { play, tell } = setup();
  const paint = play.world.rig.paint as unknown as {
    apply: ReturnType<typeof vi.fn>;
    rebuild: ReturnType<typeof vi.fn>;
  };
  paint.apply.mockClear();
  paint.rebuild.mockClear();
  tell({ t: 'dabs', seat: 2, at: 0, d: packDabs([dab(0), dab(1)]) });
  tell({ t: 'dabs', seat: 2, at: 2, d: packDabs([dab(2)]) });
  expect(paint.rebuild).not.toHaveBeenCalled();
  expect(paint.apply).toHaveBeenCalledTimes(2);
  expect(play.log.dabs).toHaveLength(3);
  tell({ t: 'dabs', seat: 2, at: 1, d: packDabs([dab(5)]) });
  expect(paint.rebuild).toHaveBeenCalledTimes(1);
  expect(play.log.dabs).toHaveLength(2);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts` → 足した 3 つのうち、1 つめと 2 つめは
体の位置が `[4, 0, 6]` のままで FAIL、3 つめは `expect(paint.rebuild).not.toHaveBeenCalled()` で FAIL する（`apply` の回数ではなく、ここで落ちることを見る）。ほかは pass。
3 つのどれかが直す前から pass したら STOP（読み違い）。

### Step 2: ロビーと紹介の最初の様子では、戻った子も席の場所へ置く

`#phase` の `if (!this.#own) this.#place();` を次のようにする（コメントも足す）。

```ts
// ロビーと紹介は #enter でも必ず置き直す。親に残っていた体は前の試合の屋敷の中のことがある
if (!this.#own || v.phase === 'lobby' || v.phase === 'intro') this.#place();
```

ほかの行は変えない。`this.#fit(this.#own)` はロビーと紹介では何もしない（銃を持つのは探索と答え合わせだけ）ので、そのままでよい。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts -t '席の場所に出る'` → 足した 2 つと、
もとからある「ロビーではロビーの部屋の席の場所に出て、北の台を向く」が pass。

### Step 3: 自分の塗りを、足しただけなら差分で塗る

`#ownPaint` を次の形にする。

```ts
  #ownPaint(at: number, d: number[]) {
    const add = unpackDabs(d);
    const how = splice(this.play.log.dabs, at, add);
    if (how === null) return;
    // 自分の列は 32KB ずつに分けて届くので、届くたびに塗り直すと長く塗った体ほど戻った直後に止まる
    if (how === 'append') this.play.world.rig.paint.apply(add);
    else this.play.rebuildPaint();
    this.#out.adopt(this.play.log);
  }
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts` → すべて pass（足した 3 つと、もとからある
「親に残っていた自分の体と塗りを受け取り、…」「3D を作るあいだに届いていた体・塗り・様子も受け取る…」を含む）。

### Step 4: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。

## Test plan

- 足すテストは Step 1 の 3 つ（ロビーに戻った子・紹介に戻った子・分けて届く塗り）
- 隠れタイム・探索・答え合わせに戻った子が続きの場所から始める既存のテスト（`:319`、`:351`、`:360`、`:693`、`:712`、`:726`）が
  pass のままであること
- `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/yappari-chameleon/session.svelte.test.ts` が pass し、足した 3 つを含む
- [ ] `git diff b565b01 -- src/lib/games/yappari-chameleon/session.svelte.ts` が `#phase` の 1 行（とコメント）と `#ownPaint` だけ
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 046 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `session.svelte.ts` の `#phase` / `#ownPaint` / `#place` / `#enter` が上の抜粋と違う
- Step 1 のテストのどれかが、直す前から pass する
- Step 2 のあと、隠れタイム・探索・答え合わせに戻る既存のテストが落ちる（ロビーと紹介以外の扱いを変えてしまっている）
- `play.world.rig.paint.apply` が無い、または `PaintSurface` の `apply` の引数が `readonly Dab[]` でない
- 直すのに `host.ts` か `net.ts` を変えたくなった

## Maintenance notes

- フェーズを足すときは、`#enter` で置き直すフェーズと、戻った子の最初の様子で置き直すフェーズ（Step 2 の条件）をそろえる
- 自分の列の受け方を変えるときは、`remote.ts` の `Remote.dabs` と同じ分け方（append は差分、rebuild は塗り直し）を保つ
- 実機では 2 台で「隠れタイムに子の Wi-Fi を切る → 試合が終わってロビーに戻る → 子が『もう一度つなぐ』」で、子がロビーの部屋に
  出ることを見る。たくさん塗ってから切ってつなぎ直し、戻った直後に止まらないことも見る
