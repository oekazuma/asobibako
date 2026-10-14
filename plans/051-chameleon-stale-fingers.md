# Plan 051: カメレオンで指を離した知らせが届かなくても、次にほかの指の無いタッチで指の状態を戻す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/yappari-chameleon/touch.ts src/lib/games/yappari-chameleon/touch.test.ts src/lib/games/yappari-chameleon/play.svelte.ts src/lib/games/yappari-chameleon/play.svelte.test.ts src/lib/games/yappari-chameleon/stage3d.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                     |
| ---------- | -------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                     |
| Effort     | S                                                                                      |
| Risk       | MED（指の扱いは手ざわりの芯。iPad の Safari がどう知らせるかはテストで確かめられない） |
| Depends on | none                                                                                   |
| Category   | bug                                                                                    |
| Planned at | commit `36cc037`, 2026-10-14                                                           |

## Why this matters

やっぱりカメレオン（iPad を横持ちで遊ぶ 3D のかくれんぼ）の盤面の指は `TouchPad`（`touch.ts`）が追う。iPad の Safari は、
離した指の `pointerup` を届けないことがある。今は見回しの指だけ、右に置いた新しい指が引き継ぐように直してある（commit `b565b01`）。
ほかの指は届かないと残ったままになり、次のことが起きる。

1. スティックの指が残ると、体が倒したままの向きに歩き続ける。左に新しく置いた指はスティックにならず見回しになるので、止める手が無い
2. ペイントモードで指が 1 本でも `#fingers` に残ると、次に置いた指はいつも 2 本めと数えられ、2 本指のカメラになって二度と塗れない
3. 塗っている指が残ると、筆が終わらないまま次の指を待つ

左に置いた新しい指にスティックを奪わせると、スティックを使いながら左にもう 1 本置いて見回す今の操作（`touch.test.ts:53-59`）が
壊れる。そこで、ブラウザが「ほかに押している指は無い」と分かっている指（`PointerEvent.isPrimary === true` の `pointerdown`）が
来たときだけ、残っている指を全部離れたものとして忘れ、そのあとで新しい指をふつうに扱う。押している指が別にあるときの
`pointerdown` は `isPrimary` が false なので、今の 2 本指の操作は変わらない。

## Current state

直すファイルは 3 つで、テストは 2 つ。

- `src/lib/games/yappari-chameleon/touch.ts` — 指の追跡（スティック・見回し・塗り・2 本指のカメラ）。DOM を使わない純粋なクラス
- `src/lib/games/yappari-chameleon/play.svelte.ts` — 遊ぶ状態 `Play`。`pointer()` が `TouchPad` へ指を渡し、出てきた塗りの出来事を `#paint` で処理する
- `src/lib/games/yappari-chameleon/stage3d.ts` — 盤面の `PointerEvent` を `Play.pointer` へ渡す口
- `src/lib/games/yappari-chameleon/touch.test.ts` — `TouchPad` のテスト（node の unit）
- `src/lib/games/yappari-chameleon/play.svelte.test.ts` — `Play` のテスト（happy-dom）。3D は偽物（`fakeWorld()`）

### `TouchPad.down` と歩くときの指

今のコードは `touch.ts:40-64` にある。`#reset()` は指の状態を全部忘れる（`setMode` から呼ぶ）。

```ts
  #reset() {
    this.#stickId = this.#lookId = this.#painting = null;
    this.#pending = null;
    this.#gesture = false;
    this.#fingers.clear();
    Object.assign(this.stick, { x: 0, y: 0, active: false });
    this.#look = { dx: 0, dy: 0 };
    this.#orbit = { dx: 0, dy: 0, zoom: 1 };
  }

  /** orbit は塗るモードで、指を置いた所が体の外のとき（その指は塗らずにカメラを回す） */
  down(id: number, x: number, y: number, width: number, now: number, orbit = false): PaintEvent[] {
    if (this.mode === 'paint') return this.#paintDown(id, x, y, now, orbit);
    const right = x >= width * STICK_AREA;
    if (this.#stickId === null && !right) {
      this.#stickId = id;
      Object.assign(this.stick, { x: 0, y: 0, active: true, ox: x, oy: y });
    } else if (this.#lookId === null || right) {
      // iPad の Safari は、離した指の pointerup を見回しへ届けないことがある（撃った直後に押せなくなる「うつ」の上で
      // 離したときなど）。残った見回しの指は二度と動かず、見回しが止まったままになるので、右に置いた新しい指が引き継ぐ
      this.#lookId = id;
      this.#lookAt = { x, y };
    }
    return [];
  }
```

スティックの指（`#stickId`）が残ると、左の新しい指は `#stickId === null` を満たさず、見回しになるか（`#lookId` が空のとき）、
どこにも入らない。スティックは `up(id)` で `#stickId` と同じ指が来たときにしか戻らない（`touch.ts:86-93`）。

### ペイントモードの指

今のコードは `touch.ts:133-150` にある。

```ts
  #paintDown(id: number, x: number, y: number, now: number, orbit: boolean): PaintEvent[] {
    this.#fingers.set(id, { x, y });
    if (this.#fingers.size === 1 && !this.#gesture) {
      if (orbit) {
        this.#lookId = id;
        this.#lookAt = { x, y };
      } else this.#pending = { id, x, y, t: now };
      return [];
    }
    this.#gesture = true;
    this.#pending = null;
    this.#lookId = null;
    if (this.#painting !== null) {
      this.#painting = null;
      return [{ kind: 'cancel' }];
    }
    return [];
  }
```

`#fingers` に離れた指が 1 本でも残ると `size === 1` にならず、`#gesture` も `#paintUp`（`touch.ts:185-189`）で `#fingers` が
空になるまで false に戻らない。`#painting` は塗っている指の番号で、`#fingers` にその指の最後の位置がある。

### `Play` が出来事をどう扱うか

今のコードは `play.svelte.ts:325-339` にある。

```ts
  pointer(kind: 'down' | 'move' | 'up' | 'cancel', id: number, x: number, y: number, width: number): void {
    const now = performance.now();
    // 体の外に置いた指は塗らずにカメラを回す。スポイトは外でも離した所で色を取るので塗る道を通す。測るのは置いたときの 1 回だけ
    const orbit = kind === 'down' && this.mode === 'paint' && !this.spoit && !this.world.pickBody(x, y);
    const events =
      kind === 'down'
        ? this.pad.down(id, x, y, width, now, orbit)
        : kind === 'move'
          ? this.pad.move(id, x, y, now)
          : kind === 'cancel'
            ? this.pad.cancel(id)
            : this.pad.up(id);
    for (const e of events) this.#paint(e);
    this.stick = { ...this.pad.stick };
  }
```

`#paint` の `cancel` は描きかけの筆を取り消し列から消す（`play.svelte.ts:350-358`。`this.log.cancel()` は
`paint.ts:112-118` で吹き付けの列をその筆の始めまで縮める）。`end` は最後の位置で吹き付けて筆を終える（`play.svelte.ts:385`）。
離した知らせが届かなかった筆は、遊ぶ人にとっては離した筆なので、忘れるときは `cancel` ではなく `end` を出す（`cancel` を出すと、
塗ったばかりの筆が消える）。

### 盤面の口

今のコードは `stage3d.ts:82-94` にある。`PointerEvent` を持っているのはここだけ。

```ts
/** 盤面の指を Play へ渡す。指を置いたときに音を起こす（iOS は操作の中でしか鳴らし始められない） */
export function touch(play: Play, box: HTMLElement, kind: 'down' | 'move' | 'up' | 'cancel', e: PointerEvent): void {
  if (kind === 'down') {
    wake();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // 合成イベントでは掴めないが、指の追跡は続けてよい
    }
  }
  const r = box.getBoundingClientRect();
  play.pointer(kind, e.pointerId, e.clientX - r.left, e.clientY - r.top, r.width);
}
```

`Play.pointer` を呼ぶのは、ほかにテスト（`play.svelte.test.ts` と `session.svelte.test.ts`）だけで、どれも 5 つの引数で呼ぶ。
`TouchPad.down` を呼ぶのは `Play.pointer` と `touch.test.ts` だけ。足す引数を最後に置いて既定を `false` にすれば、今の呼び出しは
どれも変わらない。

### 規約

コメントは「コードから復元できない WHY」だけを日本語で書く（変更の経緯や計画の番号は書かない）。テストの名前は日本語の文にする。
`.svelte` のファイルは触らない。

## Commands you will need

| Purpose        | Command                                                                                                                  | Expected on success           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 足すテスト     | `pnpm exec vitest run src/lib/games/yappari-chameleon/touch.test.ts src/lib/games/yappari-chameleon/play.svelte.test.ts` | すべて pass                   |
| カメレオン全体 | `pnpm exec vitest run src/lib/games/yappari-chameleon/`                                                                  | すべて pass                   |
| 型             | `pnpm check`                                                                                                             | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint           | `pnpm lint`                                                                                                              | exit 0                        |
| svelte-vitals  | `pnpm vitals --diff`                                                                                                     | 警告 0                        |
| 全部           | `pnpm verify`                                                                                                            | exit 0                        |

ブラウザの道具は使わない（この計画では要らない）。

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/touch.ts`
- `src/lib/games/yappari-chameleon/touch.test.ts`（テストを足す）
- `src/lib/games/yappari-chameleon/play.svelte.ts`（`pointer` の引数を 1 つ足すだけ）
- `src/lib/games/yappari-chameleon/play.svelte.test.ts`（テストを 1 つ足す）
- `src/lib/games/yappari-chameleon/stage3d.ts`（`e.isPrimary` を渡すだけ）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- 左に置いた新しい指にスティックを奪わせること。スティックを使いながら左にもう 1 本置くと見回しになる今の操作を壊す
- `b565b01` の「右に置いた新しい指が見回しを引き継ぐ」決まり（`touch.ts:57-61`）。そのまま残す
- `Buttons.svelte` などのボタンの指（盤面の外の要素で、`TouchPad` は追っていない）
- `session.svelte.test.ts` と、ほかの `Play.pointer` の呼び出し。既定の引数で今のまま動く
- 時間で指を忘れる仕組み（止まったまま押し続けている指と区別できない）

## Git workflow

- ブランチは `advisor/051-chameleon-stale-fingers`
- コミットは 1 つでよい。英語の命令形 1 文で、`Co-Authored-By` などの末尾の行は付けない（例 `Forget fingers whose pointerup never arrived when a primary touch lands`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 失敗するテストを先に書く

`touch.test.ts` の `describe('TouchPad 歩く', …)` の最後に次の 2 つを足す。

```ts
it('スティックの指を離した知らせが届かなくても、ほかの指の無いタッチを左に置けばその指がスティックになる', () => {
  const t = new TouchPad(100);
  t.down(1, 100, 500, W, 0, false, true);
  t.move(1, 100, 400, 10);
  t.down(2, 200, 500, W, 20, false, true);
  expect(t.stick).toMatchObject({ x: 0, y: 0, active: true, ox: 200, oy: 500 });
  t.move(2, 200, 450, 30);
  t.move(1, 100, 300, 40);
  expect(t.stick.y).toBeCloseTo(-0.5);
  expect(t.takeLook()).toEqual({ dx: 0, dy: 0 });
});

it('ほかの指を押しているときのタッチは、左に置いても今までどおり見回しになる', () => {
  const t = new TouchPad(100);
  t.down(1, 100, 500, W, 0, false, true);
  t.down(2, 200, 300, W, 10, false, false);
  t.move(2, 220, 300, 20);
  expect(t.takeLook().dx).toBe(20);
  expect(t.stick.active).toBe(true);
});
```

`describe('TouchPad 塗る', …)` の最後に次の 2 つを足す（`paint()` はその describe の中にある）。

```ts
it('2 本指のあと離した知らせが 1 本届かなくても、ほかの指の無いタッチなら塗れる', () => {
  const t = paint();
  t.down(1, 400, 500, W, 0, false, true);
  t.down(2, 600, 500, W, 10);
  t.up(2);
  expect(t.down(3, 500, 500, W, 500, false, true)).toEqual([]);
  expect(t.tick(600)).toEqual([{ kind: 'start', x: 500, y: 500 }]);
});

it('塗っている指を離した知らせが届かないまま次のタッチが来たら、描きかけは取り消さずに最後の位置で終える', () => {
  const t = paint();
  t.down(1, 500, 500, W, 0, false, true);
  t.tick(100);
  t.move(1, 520, 500, 110);
  expect(t.down(2, 300, 300, W, 500, false, true)).toEqual([{ kind: 'end', x: 520, y: 500 }]);
  expect(t.tick(600)).toEqual([{ kind: 'start', x: 300, y: 300 }]);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/touch.test.ts` → 足した 4 つのうち「今までどおり見回しになる」
以外の 3 つが落ちる（7 つめの引数をまだ受けないので）。もとからある 20 のテストは pass のまま。
`pnpm check` はこの時点では 7 つめの引数で型エラーになってよい（Step 2 で直る）。

### Step 2: `TouchPad.down` で、ほかの指の無いタッチなら残った指を忘れる

`touch.ts` を次のようにする。

1. `down` に最後の引数 `primary = false` を足し、doc コメントに「primary はブラウザがほかに押している指は無いと知っているタッチ
   （`PointerEvent.isPrimary`）」を足す
2. `down` の頭で、`primary` なら下の `#forget()` を呼んで出来事を受け、ペイントモードでもそうでなくても、その出来事を新しい指の
   出来事の前に並べて返す
3. `#reset()` の下に `#forget()` を足す。塗っている指があればその指の最後の位置で `end` を作り、`#reset()` を呼んでから返す
   （`#reset()` は見回しとカメラのたまった量も 0 にするが、毎フレーム取り出しているので 1 フレームぶんしか失わない）

できあがりは次の形になる。

```ts
  #forget(): PaintEvent[] {
    const f = this.#painting === null ? undefined : this.#fingers.get(this.#painting);
    this.#reset();
    // 届かなかったのは離した知らせなので、描きかけは取り消さずに終える（取り消すと塗ったばかりの筆が消える）
    return f ? [{ kind: 'end', x: f.x, y: f.y }] : [];
  }

  /**
   * orbit は塗るモードで、指を置いた所が体の外のとき（その指は塗らずにカメラを回す）。
   * primary はブラウザがほかに押している指は無いと知っているタッチ（PointerEvent.isPrimary）
   */
  down(id: number, x: number, y: number, width: number, now: number, orbit = false, primary = false): PaintEvent[] {
    // iPad の Safari は離した指の pointerup を届けないことがある。ほかに押している指が無いなら、残っている指はもう離れている
    const out = primary ? this.#forget() : [];
    if (this.mode === 'paint') return [...out, ...this.#paintDown(id, x, y, now, orbit)];
    const right = x >= width * STICK_AREA;
    // …（スティックと見回しの分かれ道は今のまま）
    return out;
  }
```

`// …（スティックと見回しの分かれ道は今のまま）` の行は省略のしるしで、写さない。そこには今の `right` から見回しの `}` までの行をそのまま残し、最後の `return [];` だけを `return out;` にする。

`#paintDown`・`#paintUp`・`up`・`cancel`・`move` は変えない。`#pending`（80ms を待っている指）が残っていた場合は点を打たずに
忘れる（`#paintUp` を流用すると点を 1 つ打つので使わない）。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/touch.test.ts` → すべて pass（24）。

### Step 3: `Play.pointer` と盤面の口から `isPrimary` を渡す

1. `play.svelte.ts` の `pointer` に最後の引数 `primary = false` を足し、`this.pad.down(id, x, y, width, now, orbit, primary)` に渡す。
   ほかの行は変えない
2. `stage3d.ts` の `touch` の最後の行を
   `play.pointer(kind, e.pointerId, e.clientX - r.left, e.clientY - r.top, r.width, e.isPrimary);` にする
   （`pointer` は `down` のときしか `primary` を使わない）

`play.svelte.test.ts` の `describe('Play の塗り', …)` の最後に次のテストを足す。

```ts
it('塗っている指の pointerup が届かないまま、ほかの指の無いタッチが来ても、塗った筆は消えない', () => {
  const w = fakeWorld(true);
  const p = new Play(w, 70);
  p.togglePaint();
  p.pointer('down', 1, 400, 300, 1000, true);
  p.frame(1 / 60, performance.now() + 200);
  p.pointer('move', 1, 410, 300, 1000);
  const dabs = p.log.dabs.length;
  expect(dabs).toBeGreaterThan(0);
  vi.mocked(w.rig.paint.rebuild).mockClear();
  p.pointer('down', 2, 600, 300, 1000, true);
  expect(p.log.dabs.length).toBeGreaterThanOrEqual(dabs);
  expect(w.rig.paint.rebuild).not.toHaveBeenCalled();
  expect(p.canUndo).toBe(true);
});
```

**Verify**:

- `pnpm exec vitest run src/lib/games/yappari-chameleon/touch.test.ts src/lib/games/yappari-chameleon/play.svelte.test.ts` → すべて pass
- `grep -n "e.isPrimary" src/lib/games/yappari-chameleon/stage3d.ts` → 1 行
- `pnpm check` → `0 ERRORS 0 WARNINGS`

### Step 4: 全体の確かめ

先に触ったファイルを整える。`Play.pointer` の 1 行は 120 字を超えるので、prettier が引数を折り返す。

`pnpm exec prettier --write src/lib/games/yappari-chameleon/touch.ts src/lib/games/yappari-chameleon/touch.test.ts src/lib/games/yappari-chameleon/play.svelte.ts src/lib/games/yappari-chameleon/play.svelte.test.ts src/lib/games/yappari-chameleon/stage3d.ts`

**Verify**:

- `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass（2 本指・スティック・見回しのもとからあるテストを含む）
- `pnpm verify` → exit 0

## Test plan

- `touch.test.ts` に 4 つ。残ったスティックがほかの指の無いタッチで戻る、ほかの指を押しているときの左の指は今までどおり見回しになる
  （今の `スティックを使っているとき、左にもう 1 本置くと見回しになる` と同じ守りを、引数を明示して足す）、2 本指のあと残った指が
  あっても塗れる、塗っていた指が残ったら `end` で終える
- `play.svelte.test.ts` に 1 つ。忘れた筆が取り消し列から消えず、塗りを作り直さない（`cancel` を出していないことの確かめ）
- 型にするテストは同じファイルの今のテスト（`touch.test.ts:43-59` と `play.svelte.test.ts:82-96`）
- もとからあるテストは引数を足さずに今のまま通ること自体が、2 本指の操作が変わっていないことの確かめになる

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/yappari-chameleon/touch.test.ts src/lib/games/yappari-chameleon/play.svelte.test.ts` が pass し、足した 5 つを含む
- [ ] `grep -n "primary = false" src/lib/games/yappari-chameleon/touch.ts src/lib/games/yappari-chameleon/play.svelte.ts` が 2 行
- [ ] `grep -n "e.isPrimary" src/lib/games/yappari-chameleon/stage3d.ts` が 1 行
- [ ] `git diff 36cc037 -- src/lib/games/yappari-chameleon/touch.test.ts src/lib/games/yappari-chameleon/play.svelte.test.ts` に、もとからあるテストの書き換え（`-` の行）が無い
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 051 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（`TouchPad.down`・`#reset`・`#paintDown`・`Play.pointer`・`stage3d.ts` の `touch`）が今のコードと違う
- もとからあるテスト（とくに `touch.test.ts` の 2 本指・スティック・見回しのテスト、`play.svelte.test.ts` と `session.svelte.test.ts` の
  指のテスト）が 1 つでも落ちる。今の 2 本指の操作が変わったしるしなので、テストを直さずに報告する
- 通すために、もとからあるテストへ引数を足したり期待を変えたりしたくなった
- `Play.pointer` か `TouchPad.down` のほかの呼び出し元（`grep -rn "\.pointer(\|pad\.down(" src` で、テストと `stage3d.ts` 以外）が見つかった
- 新しい指にスティックを奪わせる・時間で指を忘れるなど、この計画と別の直し方が要るように見えた

## Maintenance notes

- 実機での確かめは、作業する係ではなく持ち主が iPad で行う（テストではブラウザが `isPrimary` をどう出すかは確かめられない）。
  `pnpm dev` を HTTPS で開いた iPad の Safari を Mac の Web インスペクタにつなぎ、「ひとりで試す」で次を見る
  1. ふつうに歩く・見回す・スティックを使いながら左にもう 1 本置いて見回す・ペイントモードで塗る・2 本指で回してつまむが、今までどおりに動く
  2. 指が残る件が起きたとき（体が歩き続ける・塗れない）、ほかの指を全部離してから盤面を 1 回タップすると直る。dev では
     `window.__chameleon.pad.stick.active` を見て、タップの前に `true`、タップのあとに離せば `false` になる
  3. 2 で直らなければ、Safari はそのタップを `isPrimary === true` で出していない。そのときは別の直し方が要るので報告する（この計画の中で足さない）
- `isPrimary` は指・ペン・マウスの種類ごとに決まる。Apple Pencil で盤面に触れると、指でスティックを押していてもペンの最初の
  `pointerdown` は `isPrimary` が true になり、スティックの指を忘れる。ペンと指を同時に使う遊び方が出てきたら、
  `e.isPrimary && e.pointerType === 'touch'` にするかを考える
- 盤面の外のボタン（`Buttons.svelte` など）を押している指があるときは、盤面のタッチは `isPrimary` が false なので何も忘れない
- `TouchPad` に指の種類を足すときは、`#reset()` で忘れるものに入れれば、ほかの指の無いタッチでも忘れられる
