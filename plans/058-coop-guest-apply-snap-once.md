# Plan 058: 協力プレイの子の端末で、届いた様子を 1 回だけ World に書き、あいだのフレームは位置をつなぐだけにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/animal-survivors/coop.ts src/lib/games/animal-survivors/snap.ts src/lib/games/animal-survivors/coop.test.ts src/lib/games/animal-survivors/snap.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。計画 054 も `coop.ts` と `coop.test.ts` を触る。
> 054 が先に入っていて、ちがいが受け取りの確かめ（`runOf`・`meOf`・`isMove`）だけなら続けてよい。

## Status

| 項目       | 値                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------- |
| Priority   | P3                                                                                        |
| Effort     | S                                                                                         |
| Risk       | LOW（見え方は変えない。技の絵の進み具合の式を、足し込みから a と b の値で決める形に直す） |
| Depends on | none                                                                                      |
| Category   | perf                                                                                      |
| Planned at | commit `36cc037`, 2026-10-14                                                              |

## Why this matters

アニマルサバイバーの協力プレイでは、親の端末が 1 秒に 20 回、World の様子（`Snap`）を子へ送る。子の端末は描くフレームごと
（iPad で 60 回）に、届いた様子を送った時刻で 100ms 遅らせて前後の 2 つ（`a` と `b`）のあいだをつなぐ。今は毎フレーム
`applySnap(view, a)` で World を丸ごと書き直してから、`b` へ位置を寄せている。同じ `a` が 3 フレームほど続くので、
書き直しの 3 回に 2 回は同じ結果を作り直しているだけになる。`applySnap` は敵・弾・効果・玉・品の行（種類ごとに最大 600）を
1 行ずつ書き、動物ごとに武器の文字列を割って新しい配列を作り、技の絵の写しを作る。大群の後半に子の端末だけが重くなる
原因の 1 つで、描く時間を食う。`a` が変わったときだけ書き、あいだのフレームは位置をつなぐだけにすれば、見え方を変えずに
この仕事を 3 分の 1 にできる。

## Current state

`src/lib/games/animal-survivors/coop.ts:434-445` は子の端末で描く前に毎フレーム呼ばれる（`CoopPlay.svelte:106`）。

```ts
  /** 描く前に呼ぶ。届いた様子を送った時刻で DELAY_MS 遅らせ、前後の 2 つのあいだをつなぐ */
  frame(now: number): void {
    if (this.#party.lost && !this.done) this.#give();
    const v = this.view;
    const r = this.#snaps.at(now, DELAY_MS);
    if (!v || !r) return;
    if (r.a !== r.b) lerpSnap(v, r.a, r.b, r.t);
    else applySnap(v, r.a);
    // 出来事（倒した・拾った・レベルアップ）は、その様子を初めて見せたときに 1 回だけ渡す
    v.events = r.a === this.#shown ? [] : r.a.events;
    this.#shown = r.a;
  }
```

ふだんは `r.a !== r.b`（2 つのあいだ）なので `lerpSnap` の道を通る。`else` は、いちばん新しい様子より先の時刻を
見ているときだけ。`#shown` は `coop.ts:316` の `#shown: Snap | null = null;` で、最後に見せた `a`。

`src/lib/games/animal-survivors/snap.ts:342-375` の `lerpSnap` は、頭で `applySnap` を呼ぶ。

```ts
/** a を書いたあと、敵・弾・玉・ほかの動物の位置を b へ t だけ寄せる（番号と種類が同じものだけ） */
export function lerpSnap(view: World, a: Snap, b: Snap, t: number): void {
  applySnap(view, a);
  const mix = (o: { x: number; y: number }, ra: Row | undefined, rb: Row | undefined, at: number, kind: boolean) => {
    if (!ra || !rb || (kind && ra[1] !== rb[1])) return;
    o.x = (ra[at] as number) + ((rb[at] as number) - (ra[at] as number)) * t;
    o.y = (ra[at + 1] as number) + ((rb[at + 1] as number) - (ra[at + 1] as number)) * t;
  };
  ...
  // 技の絵の進み具合は 1 秒に 20 回しか届かないので、ほかの位置と同じく 2 つのあいだをつなぐ
  view.link.shows.forEach((s, i) => {
    const sb = b.link.shows[i];
    if (sb && sb.hero === s.hero && sb.animal === s.animal) s.t += (sb.t - s.t) * t;
  });
  if (view.carry && a.carry && b.carry) {
    view.carry.x = a.carry.x + (b.carry.x - a.carry.x) * t;
    view.carry.y = a.carry.y + (b.carry.y - a.carry.y) * t;
  }
  b.heroes.forEach((rb, i) => {
    const ra = a.heroes[i];
    if (i === view.cur || !ra || ra[0] !== rb[0]) return;
    const p = view.heroes[i].player;
    p.x = (ra[2] as number) + ((rb[2] as number) - (ra[2] as number)) * t;
    p.y = (ra[3] as number) + ((rb[3] as number) - (ra[3] as number)) * t;
  });
}
```

敵・弾・玉・宝箱・ほかの動物の位置は、`a` と `b` の行の値から書くので、同じ `a` のまま何度呼んでも同じになる。
技の絵の進み具合（`s.t += (sb.t - s.t) * t`、`snap.ts:362`）だけは今の値に足し込む形で、毎フレーム `applySnap` が
`view.link` を `a` の写しに戻している（`snap.ts:336-337`）から正しくなっている。`applySnap` を飛ばすなら、この式を
`a` の値から決める形にしないと、フレームごとに進み具合がずれていく。

`applySnap`（`snap.ts:234-340`）は、`Object.assign(view, { time, level, xp, kills, coins, freeze, festival })`、動物ごとの
`h.weapons = parsedWeapons(...)`、`place(...)` で敵・弾・効果・玉・品、`view.link = { ...s.link, shows: ... }` などを書く。
子の端末で描くまでのあいだに、この値を書き換えるものは無い。

- 子の自分の動物の位置は `CoopGuest.move()`（`coop.ts:404-432`）が動かし、`applySnap` は書かない（`i !== view.cur`）
- 描画（`draw.ts`）は `w.cur` を一時的に変えて戻すだけ（`draw.ts:451-463`）
- 効果（`effects.ts:89` の `take`）は `w.events` を読むだけ
- 子の `Prompts` は `remote` で、選んだものを親へ送り、World は書き換えない

`lerpSnap` と `applySnap` を呼ぶのは `coop.ts` と、テストの `snap.test.ts`・`snap-size.test.ts` だけ
（`grep -rn "lerpSnap\|applySnap" src` で確かめられる）。

`snap.test.ts:16-28` は、`applySnap` を呼ばずに `lerpSnap` を 2 回呼び、技の絵の進み具合が 2 回とも 0.2 になることを見る。
`snap.test.ts:122-132` も、`applySnap` を呼ばずに `lerpSnap` を呼んで敵の位置を見る。

```ts
  it('子の画面の技の絵は、届いた 2 つの様子のあいだで進み具合をつなぐ', () => {
    ...
    const view = guestView();
    lerpSnap(view, a, b, 0.5);
    expect(view.link.shows[0].t).toBeCloseTo(0.2);
    lerpSnap(view, a, b, 0.5);
    expect(view.link.shows[0].t).toBeCloseTo(0.2);
  });
```

```ts
  it('2 つの様子のあいだを、番号の同じ敵の位置でつなぐ', () => {
    ...
    const view = guestView();
    lerpSnap(view, a, b, 0.5);
    expect(view.enemies[0].x).toBe(5);
  });
```

`coop.test.ts` には `started()`（つないで「はじめる」まで進め、`{ host, guest, w, h, g, told, pipe }` を返す）と `settle()`
がある。`h.after(0.06)` で様子を 1 つ送れる（`SNAP_EVERY` が 0.05 秒）。様子の時刻（`ms`）は `performance.now()`。

規約は次のとおり。

- コメントは「コードから復元できない WHY」だけを日本語で書く。WHAT・変更履歴・チケット番号は書かない
- テストの名前は日本語の文にする

## Commands you will need

| Purpose    | Command                                                                                                        | Expected on success           |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 足すテスト | `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts src/lib/games/animal-survivors/snap.test.ts` | すべて pass                   |
| 全テスト   | `pnpm test:run`                                                                                                | exit 0                        |
| 型         | `pnpm check`                                                                                                   | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint       | `pnpm lint`                                                                                                    | exit 0                        |
| 全部       | `pnpm verify`                                                                                                  | exit 0                        |

## Scope

**In scope**

- `src/lib/games/animal-survivors/coop.ts`（`CoopGuest.frame` と、フィールドを 1 つ）
- `src/lib/games/animal-survivors/snap.ts`（`lerpSnap` の頭の `applySnap` を外し、技の絵の式を直す）
- `src/lib/games/animal-survivors/coop.test.ts`（テストを 2 つ足す）
- `src/lib/games/animal-survivors/snap.test.ts`（2 つのテストに `applySnap(view, a);` を 1 行ずつ足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `lerpSnap` の中で毎フレーム作る `Map`（`byIndex`）— 種類ごとに 2 つで、`applySnap` よりずっと軽い。測ってから考える
- `makeSnap` と送る形、`COOP_VERSION` — 送るものは変えない
- `applySnap` の中身 — 呼ぶ回数だけを減らす
- 親の端末（`CoopHost`）と、`CoopPlay.svelte`

## Git workflow

- ブランチは `advisor/058-coop-guest-apply-snap-once`
- コミットは 1 つ。英語の命令形 1 文（例 `Apply each coop snapshot once on the guest and only interpolate between frames`）。
  Co-Authored-By などの trailer は付けない
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 落ちるテストを先に書く

`coop.test.ts` の `describe('協力プレイのつなぎ', ...)` の中、`子の画面の出来事は、新しい snap を見せたときに 1 回だけ渡す` の
下に次の 2 つを足す。`ENEMIES` と `makeEnemy` はこのファイルですでに import している。

```ts
it('子の画面は、同じ様子を 2 回目からは書き直さない', async () => {
  const { h, g } = await started();
  h.after(0.06);
  await settle();
  const now = performance.now() + 1000;
  g.frame(now);
  // 書き直せば time が様子の値に戻る
  g.view!.time = -1;
  g.frame(now + 16);
  expect(g.view!.time).toBe(-1);
});

it('子の画面は、2 つの様子のあいだを書き直さずにつなぎ、敵はフレームごとに b へ寄る', async () => {
  const { w, h, g } = await started();
  w.enemies.push(makeEnemy(ENEMIES.caterpillar, 40, 0, 50));
  const clock = vi.spyOn(performance, 'now').mockReturnValue(1000);
  // 落ちても時計を戻す（戻さないと、このあとのテストの時刻がすべて 1050 になる）
  try {
    h.after(0.06);
    await settle();
    w.enemies[0].x = 50;
    clock.mockReturnValue(1050);
    h.after(0.06);
    await settle();
    // 100ms 遅らせて見るので、1125 は 2 つの様子のちょうどまん中
    g.frame(1125);
    expect(g.view!.enemies[0].x).toBe(45);
    g.view!.time = -1;
    g.frame(1137.5);
    expect(g.view!.enemies[0].x).toBe(47.5);
    expect(g.view!.time).toBe(-1);
  } finally {
    clock.mockRestore();
  }
});
```

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts` → 足した 2 つが落ちる（1 つめは
`expected +0 to be -1`、2 つめは最後の `time` の行で `expected +0 to be -1`。敵の 45 と 47.5 は今のコードでも通る）。
ほかは pass。

### Step 2: `lerpSnap` を「a を書いたあとに呼ぶ、つなぐだけの関数」にする

`snap.ts:342-344` の doc コメントと頭を次の形にする（`applySnap(view, a);` の行を消す）。

```ts
/**
 * applySnap(view, a) のあとに呼ぶ。敵・弾・玉・ほかの動物の位置を b へ t だけ寄せる（番号と種類が同じものだけ）。
 * a と b の値から書くので、同じ a のまま何度呼んでも同じになる
 */
export function lerpSnap(view: World, a: Snap, b: Snap, t: number): void {
  const mix = ...
```

技の絵の式（`snap.ts:359-363`）を `a` の値から決める形にする。`view.link.shows` は `applySnap` が `a.link.shows` を同じ並びで
写したものなので、`a.link.shows[i]` はいつもある。

```ts
// 技の絵の進み具合は 1 秒に 20 回しか届かないので、ほかの位置と同じく 2 つのあいだをつなぐ
view.link.shows.forEach((s, i) => {
  const sa = a.link.shows[i];
  const sb = b.link.shows[i];
  if (sa && sb && sb.hero === s.hero && sb.animal === s.animal) s.t = sa.t + (sb.t - sa.t) * t;
});
```

`snap.test.ts` の 2 つのテストに、`const view = guestView();` の次の行として `applySnap(view, a);` を足す。

- `子の画面の技の絵は、届いた 2 つの様子のあいだで進み具合をつなぐ`（`snap.test.ts:16-28`）
- `2 つの様子のあいだを、番号の同じ敵の位置でつなぐ`（`snap.test.ts:122-132`）

1 つめは、`applySnap` を 1 回だけ呼んで `lerpSnap` を 2 回呼ぶ形になり、技の絵の式が足し込みのままだと 2 回めが 0.25 になって
落ちる。このテストが式の直しを守る。

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/snap.test.ts` → すべて pass。

### Step 3: 子の `frame` で、新しい `a` のときだけ書く

`coop.ts:316` の `#shown: Snap | null = null;` の下にフィールドを足す。

```ts
  /** 前のフレームで 2 つのあいだをつないだ（a を書き直さないと、a だけを見せるときに寄せた位置が残る） */
  #mixed = false;
```

`frame` の 2 行（`coop.ts:440-441`）を次の 4 行にする。

```ts
// 様子は 1 秒に 20 回しか届かないので、同じ a は書き直さず、あいだのフレームは位置をつなぐだけにする
if (r.a !== this.#shown || (r.a === r.b && this.#mixed)) applySnap(v, r.a);
this.#mixed = r.a !== r.b;
if (this.#mixed) lerpSnap(v, r.a, r.b, r.t);
```

その下の `v.events = r.a === this.#shown ? [] : r.a.events;` と `this.#shown = r.a;` はそのまま残す（`#shown` を
書くのは、出来事を決めたあと）。`lerpSnap` と `applySnap` の import はそのまま使う。

親から `start` が届くと `view` は新しい World になり、`#snaps` も空になる。次に届く様子は新しいオブジェクトなので
`#shown` と等しくならず、必ず書かれる。`start` で `#shown` や `#mixed` を戻す必要はない。

**Verify**: `pnpm exec vitest run src/lib/games/animal-survivors/coop.test.ts src/lib/games/animal-survivors/snap.test.ts`
→ すべて pass（Step 1 の 2 つ、`子の画面の出来事は、新しい snap を見せたときに 1 回だけ渡す`、
`子の hi で 2 匹めが入り、子の位置が親の World に届き、snap で子の画面に敵が出る` を含む）。

### Step 4: 全体の確かめ

**Verify**: `grep -n "applySnap(view, a)" src/lib/games/animal-survivors/snap.ts` → doc コメントの 1 行だけ（関数の本体には無い）。
`pnpm verify` → exit 0。

## Test plan

- `coop.test.ts` に 2 つ（同じ様子だけのときは書き直さない・2 つのあいだは書き直さずに敵を寄せる）
- `snap.test.ts` の 2 つのテストを「`applySnap` のあとに `lerpSnap`」の形にし、技の絵の進み具合が `lerpSnap` を 2 回呼んでも
  0.2 のままであることで、式の直しを守る
- 型にするのは `coop.test.ts` の `子の画面の出来事は、新しい snap を見せたときに 1 回だけ渡す`

## Done criteria

- [ ] Commands の「足すテスト」が pass し、足した 2 つを含む
- [ ] `grep -n "s.t += (sb.t - s.t)" src/lib/games/animal-survivors/snap.ts` が何も返さない
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 058 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（`frame`、`lerpSnap` の頭と技の絵の式）が今のコードと違う
- `lerpSnap` か `applySnap` を、`coop.ts` とテストのほかから呼んでいるところがある
- 子の端末で描くまでのあいだに、`applySnap` が書く値（`time`・動物の `hp`・`weapons`・敵の `hp` など）を書き換えるコードが
  見つかった（`CoopPlay.svelte:103-111` の子の道、`draw.ts`、`effects.ts`、`prompts.svelte.ts`）。その値は書き直さないと
  戻らなくなる
- Step 1 の 2 つめのテストで、今のコードの敵の位置が 45 と 47.5 にならない（時刻の作り方が想定と違う。時刻の数字を変えて
  合わせず、報告する）
- `CoopPlay.svelte` や送る形（`makeSnap`）を変えたくなった

## Maintenance notes

- `applySnap` が書く値を、子の端末で描くまでのあいだに書き換えるコードを足すときは、この計画の前提が崩れる。そのときは
  `frame` で毎フレーム書き直す形に戻すか、その値を `lerpSnap` で `a` から書き直す
- `lerpSnap` に新しくつなぐ値を足すときは、今の値に足し込まず、`a` と `b` の値から決める（同じ `a` で何度も呼ばれる）
- 実機では、協力プレイの子の端末で、大群の後半に敵・弾・相棒・連携の技の絵の動きが前と同じになめらかなことを見る
