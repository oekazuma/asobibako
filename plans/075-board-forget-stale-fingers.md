# Plan 075: 盤面・タイトルのパッド・結果画面の守りで、離した知らせが届かなかった指を次のタッチで忘れる

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/board-input.ts src/lib/board-input.test.ts src/lib/settle.svelte.ts src/lib/settle.svelte.test.ts src/lib/components/GameShell.svelte src/lib/components/GameShell.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。
> plan 074 が先に入っていると `board-input.ts` の `observe()` と `board-input.test.ts` の import と末尾の `describe` が
> 変わっている。それはよい。`down` / `up` / フィールドの抜粋が同じなら続ける。
> `CLAUDE.md` は毎日のように変わるので drift check に入れていない。Step 5 の前に、足す場所の文を grep で確かめる。

## Status

| 項目       | 値                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                                       |
| Effort     | S〜M                                                                                                     |
| Risk       | MED（15 ほどのゲームが通る指の芯を直す。iPad の Safari がどう知らせるかはテストで確かめられない）        |
| Depends on | none（plan 074 と同じ `board-input.ts` と `board-input.test.ts` を触る。074 を先に入れるとぶつからない） |
| Category   | bug                                                                                                      |
| Planned at | commit `ea56ff6`, 2026-10-14                                                                             |

## Why this matters

iPad の Safari は、離した指の `pointerup` を届けないことがある（やっぱりカメレオンでは plan 051 で直した。
`src/lib/games/yappari-chameleon/touch.ts` の `#forget()`）。盤面の指を追う共通の `BoardInput`（`src/lib/board-input.ts`）は、
`pointerup` か `pointercancel` が来ない指を `fingers.all` から消さず、各ゲームの `up` の hook も呼ばない。そのため次のことが起きる。

1. 雪原サバイバル: スティックの指（`stick`）が残り、体が倒したままの向きに歩き続ける。新しい指はスティックにならない
2. はいしゃさん: 道具を当てている指（`finger`）が残り、二度と道具を使えない（その面を終えられない）
3. 線を引いて守る: 描いている指（`drawing`）が残り、線を引き終えられず、新しい線も引けない
4. ホッケー: 先に置いた指がマレットになるので、残った指の場所でマレットが止まり、新しい指は無視される
5. ネコとネズミ: 同じく、残った指がスティックを持ったまま
6. ばくだんリレー: 持っている指（`holder`）が残り、爆弾が指から離れない
7. ライトニング: 残った指が 550ms たつと長押しの答えを 1 回出す（そのあとは無視されるので、止まりはしない）

タイトル画面のパッド（`GameShell.svelte`）は、残った指のぶん「押している」が続き、相手が押しただけで始まる。
結果画面の押し間違いの守り（`Settle`）は、残った指を数え続けて、それからずっと 350ms ではなく 3 秒待つ。

plan 051 と同じく、ブラウザが「ほかに押している指は無い」と分かっているタッチ（`pointerType === 'touch'` で
`isPrimary === true` の `pointerdown`）が来たら、残っている指を全部離れたものとして忘れる。`BoardInput` では、忘れる指を
各ゲームの `up` の hook へ `pointercancel` として渡す。各ゲームの指の状態（`stick`・`finger`・`drawing`・`holder` など）は、
今ある `up` の道でそのまま片付く。

## Current state

### `BoardInput`

今のコードは `src/lib/board-input.ts:5-9` と `src/lib/board-input.ts:45-87` にある。

```ts
interface Hooks {
  down?: (event: PointerEvent, x: number, y: number) => void;
  move?: (event: PointerEvent, x: number, y: number) => void;
  up?: (event: PointerEvent, finger: Finger, x: number, y: number) => void;
}
```

```ts
export class BoardInput {
  readonly fingers = new Fingers();
  #box: Box = { left: 0, top: 0, right: 1, width: 1, height: 1 };
  /** 回転する前の、盤面そのものの大きさ。描画の位置はこの座標系で書く */
  #size = { width: 1, height: 1 };
  #turned = false;
  readonly #hooks: Hooks;
  // …（constructor・px・at は省略）
  down = (event: PointerEvent) => {
    event.preventDefault();
    // iOS は操作イベントの中でしか音を鳴らし始められない
    wake();
    capture(event);
    const [x, y] = this.at(event);
    this.fingers.down(event.pointerId, x, y, event.timeStamp);
    this.#hooks.down?.(event, x, y);
  };

  move = (event: PointerEvent) => {
    const [x, y] = this.at(event);
    this.fingers.move(event.pointerId, x, y, event.timeStamp);
    this.#hooks.move?.(event, x, y);
  };

  up = (event: PointerEvent) => {
    const [x, y] = this.at(event);
    const finger = this.fingers.up(event.pointerId, x, y, event.timeStamp);
    if (finger) this.#hooks.up?.(event, finger, x, y);
  };
```

`// …（constructor・px・at は省略）` の行は省略のしるしで、実際のファイルには `board-input.ts:53-65` がある。`pointercancel` も
`up` に渡る（`board-input.ts:109`）。`Fingers.up`（`src/lib/fingers.ts:36-41`）は最後の位置を足してから消し、消した指を返す。

### 各ゲームの `up` の hook

どの hook も `event.pointerId` で自分の指かを見る。`event.type`（`pointercancel` か）を見るのは 3 つ、`event.timeStamp` を
見るのは 1 つだけで、ほかのプロパティは読まない（`grep -n "up: (" -A12` で確かめた）。

雪原サバイバルの例は `src/lib/games/snow-camp/SnowCamp.svelte:37-46` にある。

```ts
const input = new BoardInput({
  down: (event, x, y) => {
    if (stick) return;
    const [px, py] = input.px(x, y);
    stick = { id: event.pointerId, x: px, y: py };
  },
  up: (event) => {
    if (stick?.id === event.pointerId) stick = null;
  }
});
```

はいしゃさんは `src/lib/games/dentist/Dentist.svelte:63-74` で、`finger` が残ると `down` が `if (finger !== null) return;` で
新しい指を捨てる。線を引いて守るは `src/lib/games/dog-guard/DogGuard.svelte:42-56` で、`drawing` が残ると同じく捨てる。
ホッケーとネコとネズミは hook を持たず、毎フレーム `input.fingers.all` を読み、陣地ごとに先の指だけを使う
（`src/lib/games/hockey/engine.ts:106`、`src/lib/games/cat-mouse/engine.ts:160`）。

`pointercancel` を見分ける 3 つは次のとおり。どれも「OS に取り上げられた指」として、離した位置や速さで決まることをしない。

- `src/lib/games/bomb-relay/BombRelay.svelte:30-37` — `up` で `holder` を空にし、`pointercancel` なら速さ 0 で爆弾を落とす
- `src/lib/coloring/LineEditor.svelte:43-52` — `pointercancel` なら直しの線を捨てて描き直す
- `src/lib/coloring/Canvas.svelte:59-69` — `pointercancel` なら塗らない

`event.timeStamp` を見るのはライトニング（`src/lib/games/lightning/Lightning.svelte:25`、`gestures.up(event.pointerId, x, y, event.timeStamp)`）。

### ペンを使うゲーム

おえかきのもりの盤面（`src/lib/games/oekaki-mori/Board.svelte:39-66`）は Apple Pencil で描け、ペンで描いているあいだの指
（手のひら）は無視する。`isPrimary` は指・ペン・マウスの種類ごとに決まるので、ペンで描いている最中に手のひらが触れると、
その指のタッチは `isPrimary === true` になる。種類を見ずに全部を忘れると、ペンの線が途中で切れる。忘れるのは指（touch）だけにする。
`Fingers` は指の種類を持たないので、`BoardInput` に指の `pointerId` の集合を持つ。

### すでに自分で忘れているところ

ぬりえの `src/lib/coloring/Canvas.svelte:42-45` は、自分の `down` の hook で `isPrimary` の指が来たら `input.fingers.all` から
ほかの指を消している（`up` は呼ばない）。直したあとも、指の残りはこの hook より先に `BoardInput` が片付けるので、
そのまま残してよい（ペンとマウスの残りにだけ効く）。テストは `src/lib/coloring/Canvas.svelte.test.ts:134-142`。

### `Settle`

今のコードは `src/lib/settle.svelte.ts:6-40` にある。

```ts
export class Settle {
  active = $state(false);
  /** 画面に触れている指の数。爆弾を握ったまま勝つゲームもあるので、決着の時点ではまだ指が残っていることがある */
  #touching = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;

  /** 指がすべて離れていれば 350ms 後に、残っていても取りこぼしに備えて 3 秒後には必ず戻す */
  #after(ms: number) {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.active = false), ms);
  }

  begin(): void {
    this.active = true;
    this.#after(this.#touching === 0 ? 350 : 3000);
  }

  /** onMount に渡す。戻り値で見張りをやめる */
  listen = (): (() => void) => {
    const press = () => (this.#touching += 1);
    const lift = () => {
      this.#touching = Math.max(0, this.#touching - 1);
      if (this.active && this.#touching === 0) this.#after(350);
    };
    addEventListener('pointerdown', press, true);
    addEventListener('pointerup', lift, true);
    addEventListener('pointercancel', lift, true);
    return () => {
      removeEventListener('pointerdown', press, true);
      removeEventListener('pointerup', lift, true);
      removeEventListener('pointercancel', lift, true);
      clearTimeout(this.#timer);
    };
  };
}
```

`pointerup` が 1 つ届かないと `#touching` は 1 より下に戻らず、それから先は `begin()` がいつも 3000ms を選ぶ。
テスト（`src/lib/settle.svelte.test.ts`）は `new Event(type)` を投げていて、`pointerId` は `undefined` になる。

### `GameShell` のパッド

今のコードは `src/lib/components/GameShell.svelte:25-46` にある（ファイルは 156 行）。

```ts
const ready = $state<Record<Player, boolean>>({ 1: false, 2: false });
const pads: Record<Player, Set<number>> = { 1: new Set(), 2: new Set() };

function padDown(event: PointerEvent, player: Player) {
  event.preventDefault();
  if (net && player !== net.me) return;
  wake();
  capture(event);
  pads[player].add(event.pointerId);
  ready[player] = true;
  net?.link.send({ t: 'ready', on: true });
  // マウスは同時に1点しか置けないので、PC では片側を押しただけで始められるようにする
  if (!net && event.pointerType === 'mouse') ready[1] = ready[2] = true;
}

function padUp(event: PointerEvent, player: Player) {
  if (net && player !== net.me) return;
  pads[player].delete(event.pointerId);
  ready[player] = pads[player].size > 0;
  net?.link.send({ t: 'ready', on: ready[player] });
  if (!net && event.pointerType === 'mouse') ready[1] = ready[2] = false;
}
```

すでに `pointerId` の集合で持っているが、残った番号を消す道が無い。`start()`（`GameShell.svelte:48-56`）は両方の集合を空にするので、
残るのはタイトル画面のあいだだけ。2 台で遊ぶとき（`net`）は、相手の `ready` は相手の端末からの知らせ（`GameShell.svelte:74`）で決まり、
自分の端末の `pads` には自分の側の番号しか入らない。テスト（`src/lib/components/GameShell.svelte.test.ts:25-31`）の
`pointer()` は happy-dom の `PointerEvent` に `pointerId` と `pointerType` を `Object.defineProperty` で生やす。happy-dom の
`PointerEvent` の `isPrimary` は、指定しなければ `false`。

### 規約

- コードのコメントは、コードから読み取れない WHY だけを日本語で書く。変更の経緯や計画の番号は書かない
- テストの名前は日本語の文にする
- `.svelte` のファイルは 200 行未満に保つ（svelte-vitals の `architecture/component-size`。ファイル全体の行数）。
  触る `.svelte` は `GameShell.svelte`（156 行）だけで、6 行ほど増える

## Commands you will need

| Purpose       | Command                                                                                                                      | Expected on success           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 足すテスト    | `pnpm exec vitest run src/lib/board-input.test.ts src/lib/settle.svelte.test.ts src/lib/components/GameShell.svelte.test.ts` | すべて pass                   |
| 盤面を使う側  | `pnpm exec vitest run src/lib/coloring/ src/lib/games/`                                                                      | すべて pass                   |
| 全部のテスト  | `pnpm test:run`                                                                                                              | すべて pass                   |
| 型            | `pnpm check`                                                                                                                 | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                                                                  | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                                                         | 警告 0                        |
| 全部          | `pnpm verify`                                                                                                                | exit 0                        |

ブラウザの道具は使わない（この計画では要らない）。

## Scope

**In scope**

- `src/lib/board-input.ts`（フィールドを 1 つ、`down` と `up` に 1 行ずつ、`#forget()` を足す）
- `src/lib/board-input.test.ts`（テストを足す）
- `src/lib/settle.svelte.ts`
- `src/lib/settle.svelte.test.ts`（テストを足す）
- `src/lib/components/GameShell.svelte`（`padDown` だけ）
- `src/lib/components/GameShell.svelte.test.ts`（`pointer()` に引数を 1 つ足し、テストを 1 つ足す）
- `CLAUDE.md`（「入力」の節に 1 文）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- 各ゲームの `.svelte` と `engine.ts`。直すのは共通の層だけで、ゲームの hook は今の `up` の道で片付く
- `src/lib/coloring/Canvas.svelte:42-45` の自前の忘れ方。そのまま残す
- `src/lib/fingers.ts`。指の種類は `BoardInput` の側で持つ
- やっぱりカメレオン（`touch.ts`、plan 051 で直してある）と、`BoardInput` を使わない画面（`hirameki` の `Memo.svelte` など、`border-rush` の玉のボタン）
- `SoloShell.svelte` と、ほかの長押しのボタン
- 時間で指を忘れる仕組み（止まったまま押し続けている指と区別できない）
- 2 人で同時に遊ぶ盤面で、相手が触れているあいだも残った指を忘れること。ブラウザはそのタッチを `isPrimary` にしないので、
  この計画では誰も触れていないときに次に置いた指で直る

## Git workflow

- ブランチは `advisor/075-board-forget-stale-fingers`
- コミットは 1 つでよい。英語の命令形 1 文で、`Co-Authored-By` などの末尾の行は付けない（例 `Forget board fingers whose pointerup never arrived when a primary touch lands`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: `BoardInput` の失敗するテストを先に書く

`src/lib/board-input.test.ts` の import を、`vitest` から `afterEach, beforeEach, describe, expect, it, vi` を
（plan 074 が入っていなければ `describe, expect, it, vi` だけでもよい）、`./board-input` から `BoardInput, toBoardPoint` を
読む形にする。import の下に次を足す。

```ts
// wake() は AudioContext を作るが、node には無い
vi.mock('./audio.svelte', () => ({ wake: () => {} }));

/** 盤面の指の知らせ。#box の初期値は 1 x 1 なので、clientX と clientY がそのまま盤面の 0..1 になる */
function finger(type: string, pointerId: number, x: number, y: number, pointerType = 'touch', isPrimary = false) {
  return {
    type,
    pointerId,
    clientX: x,
    clientY: y,
    timeStamp: 0,
    pointerType,
    isPrimary,
    preventDefault() {},
    currentTarget: null
  } as unknown as PointerEvent;
}
```

`currentTarget` が `null` だと `capture()` の `setPointerCapture` が投げるが、`capture()` は try/catch で逃がす
（`board-input.ts:15-21`）。ファイルの最後に次の `describe` を足す。

```ts
describe('BoardInput の残った指', () => {
  function make() {
    const up = vi.fn();
    /** down の hook が呼ばれた時点の指の数 */
    const sizes: number[] = [];
    const input: BoardInput = new BoardInput({ down: () => sizes.push(input.fingers.all.size), up });
    return { input, up, sizes };
  }

  it('pointerup が届かなかった指は、ほかの指の無いタッチが来たら pointercancel として up に渡して忘れる', () => {
    const { input, up, sizes } = make();
    input.down(finger('pointerdown', 1, 0.2, 0.8, 'touch', true));
    input.move(finger('pointermove', 1, 0.3, 0.8));
    input.down(finger('pointerdown', 2, 0.5, 0.5, 'touch', true));
    expect(up).toHaveBeenCalledTimes(1);
    const [event, last, x, y] = up.mock.calls[0];
    expect(event).toMatchObject({ type: 'pointercancel', pointerId: 1 });
    expect(last.x).toBe(0.3);
    expect([x, y]).toEqual([0.3, 0.8]);
    expect([...input.fingers.all.keys()]).toEqual([2]);
    expect(sizes).toEqual([1, 1]);
  });

  it('ほかの指が触れているあいだのタッチでは、残っている指を忘れない', () => {
    const { input, up } = make();
    input.down(finger('pointerdown', 1, 0.2, 0.8, 'touch', true));
    input.down(finger('pointerdown', 2, 0.5, 0.5, 'touch', false));
    expect(up).not.toHaveBeenCalled();
    expect([...input.fingers.all.keys()]).toEqual([1, 2]);
  });

  it('ペンで描いているあいだに手のひらが触れても、ペンの指は忘れない', () => {
    const { input, up } = make();
    input.down(finger('pointerdown', 1, 0.2, 0.8, 'pen', true));
    input.down(finger('pointerdown', 2, 0.5, 0.5, 'touch', true));
    expect(up).not.toHaveBeenCalled();
    expect([...input.fingers.all.keys()]).toEqual([1, 2]);
  });

  it('ふつうに離した指は、次のタッチで二度 up に渡さない', () => {
    const { input, up } = make();
    input.down(finger('pointerdown', 1, 0.2, 0.8, 'touch', true));
    input.up(finger('pointerup', 1, 0.2, 0.8));
    input.down(finger('pointerdown', 2, 0.5, 0.5, 'touch', true));
    expect(up).toHaveBeenCalledTimes(1);
    expect(up.mock.calls[0][0]).toMatchObject({ type: 'pointerup', pointerId: 1 });
  });
});
```

1 つめのテストの `sizes` が `[1, 1]` なのは、残った指を忘れてから新しい指の `down` の hook を呼ぶことの確かめ
（`if (stick) return;` のような hook が、片付いたあとの状態を見る）。

**Verify**: `pnpm exec vitest run src/lib/board-input.test.ts` → 足した 4 つのうち 1 つめだけが落ちる。ほかの 3 つと、
もとからあるテストは pass。

### Step 2: `BoardInput` で、ほかの指の無いタッチなら残った指を忘れる

`src/lib/board-input.ts` を次のようにする。

1. `readonly #hooks: Hooks;` の上に、指の集合を足す

   ```ts
     /** 指（touch）の pointerId。ペンで描いているあいだに手のひらが触れても、ペンの指は忘れない */
     readonly #touches = new Set<number>();
   ```

2. `down` を次の形にする（`capture(event);` までは今のまま）

   ```ts
   down = (event: PointerEvent) => {
     event.preventDefault();
     // iOS は操作イベントの中でしか音を鳴らし始められない
     wake();
     capture(event);
     // iPad の Safari は離した指の pointerup を届けないことがある。ほかに触れている指が無いなら、残っている指はもう離れている
     if (event.pointerType === 'touch' && event.isPrimary) this.#forget(event.timeStamp);
     const [x, y] = this.at(event);
     this.fingers.down(event.pointerId, x, y, event.timeStamp);
     if (event.pointerType === 'touch') this.#touches.add(event.pointerId);
     this.#hooks.down?.(event, x, y);
   };
   ```

3. `up` の頭に `this.#touches.delete(event.pointerId);` を足す（ほかの行は変えない）
4. `up` の下に `#forget()` を足す

   ```ts
     /**
      * いつどこで離したか分からない指なので、OS に取り上げられた指と同じ pointercancel として各ゲームの up へ渡す。
      * はじく速さや離した位置で決まることをさせない
      */
     #forget(t: number) {
       for (const id of this.#touches) {
         this.#touches.delete(id);
         const f = this.fingers.all.get(id);
         if (!f) continue;
         this.fingers.up(id, f.x, f.y, t);
         const event = { type: 'pointercancel', pointerId: id, pointerType: 'touch', timeStamp: t } as PointerEvent;
         this.#hooks.up?.(event, f, f.x, f.y);
       }
     }
   ```

hook へ渡す `event` は、hook が読む `type`・`pointerId`・`timeStamp`（と `pointerType`）だけを持つ。新しい指の `pointerdown`
をそのまま渡してはいけない（`pointerId` が新しい指のものなので、どの hook も自分の指と見なさない）。
`Set` を回しながら今の要素を消すのは JavaScript では安全。`if (!f) continue;` は、ぬりえの `Canvas.svelte:44-45` のように
hook が `fingers.all` から先に消した指のため。

**Verify**:

- `pnpm exec vitest run src/lib/board-input.test.ts` → すべて pass
- `pnpm exec vitest run src/lib/coloring/ src/lib/games/` → すべて pass（とくに `Canvas.svelte.test.ts` の
  「新しく 1 本目の指が触れたら、残っていた指を忘れる」は、残った指が `pointercancel` になり塗らないので、今の期待のまま通る）
- `pnpm check` → `0 ERRORS 0 WARNINGS`

### Step 3: `Settle` を指の番号の集合にし、ほかの指の無いタッチで空にする

先に `src/lib/settle.svelte.test.ts` の `describe('Settle', …)` の最後に次の 2 つを足す。

```ts
const touch = (type: string, pointerId: number, isPrimary = false) =>
  window.dispatchEvent(new PointerEvent(type, { pointerId, pointerType: 'touch', isPrimary, bubbles: true }));

it('離した知らせが届かなかった指は、ほかの指の無いタッチで忘れ、350ms で戻る', () => {
  touch('pointerdown', 1, true);
  touch('pointerdown', 2, true);
  touch('pointerup', 2);
  settle.begin();
  vi.advanceTimersByTime(350);
  expect(settle.active).toBe(false);
});

it('ほかの指が触れているあいだのタッチでは、残っている指を忘れない', () => {
  touch('pointerdown', 1, true);
  touch('pointerdown', 2);
  touch('pointerup', 2);
  settle.begin();
  vi.advanceTimersByTime(350);
  expect(settle.active).toBe(true);
});
```

`const touch` はファイルの上の `fire` の下に置き、2 つの `it` は `describe` の最後に置く。`pnpm exec vitest run src/lib/settle.svelte.test.ts` で、1 つめだけが落ちることを確かめる。

次に `src/lib/settle.svelte.ts` を直す。

1. `#touching = 0;` を `readonly #touching = new Set<number>();` にし、その doc コメントの「指の数」を「指の pointerId」にする
2. `begin()` の `this.#touching === 0` を `this.#touching.size === 0` にする
3. `listen` の中の `press` と `lift` を次の形にする（`addEventListener` と後始末の行は変えない）

   ```ts
   const press = (event: PointerEvent) => {
     // iPad の Safari は離した指の pointerup を届けないことがある。ほかに触れている指が無いなら、残っている指はもう離れている
     if (event.pointerType === 'touch' && event.isPrimary) this.#touching.clear();
     this.#touching.add(event.pointerId);
   };
   const lift = (event: PointerEvent) => {
     this.#touching.delete(event.pointerId);
     if (this.active && this.#touching.size === 0) this.#after(350);
   };
   ```

もとからあるテストは `new Event(type)` で `pointerId` が `undefined` になるが、`undefined` を 1 つの番号として出し入れするので、
期待は変わらずに通る。

**Verify**:

- `pnpm exec vitest run src/lib/settle.svelte.test.ts` → すべて pass（もとからある 4 つと足した 2 つ）
- `pnpm check` → `0 ERRORS 0 WARNINGS`

### Step 4: タイトルのパッドで、ほかの指の無いタッチなら残った指を忘れる

先に `src/lib/components/GameShell.svelte.test.ts` の `pointer()` に最後の引数 `isPrimary = false` を足し、
`Object.defineProperty(e, 'pointerType', …)` の次の行に `Object.defineProperty(e, 'isPrimary', { value: isPrimary });` を足す。
`describe('GameShell', …)` の中、「マウスなら片方だけで始まる」の後ろに次のテストを足す。

```ts
it('パッドの指を離した知らせが届かなくても、ほかの指の無いタッチが来たら押していないと数える', () => {
  const { app, pad, playing } = show();
  pad(1).dispatchEvent(pointer('pointerdown', 1, 'touch', true));
  pad(2).dispatchEvent(pointer('pointerdown', 2, 'touch', true));
  flushSync();
  vi.advanceTimersByTime(1000);
  flushSync();
  expect(playing()).toBe(false);
  pad(1).dispatchEvent(pointer('pointerdown', 3, 'touch', false));
  flushSync();
  vi.advanceTimersByTime(550);
  flushSync();
  expect(playing()).toBe(true);
  unmount(app);
});
```

指 1 の `pointerup` は届かなかったことにしている。指 2 は `isPrimary` なので、ブラウザは指 1 が離れていると知っている。
`pnpm exec vitest run src/lib/components/GameShell.svelte.test.ts` で、このテストだけが落ちる（今は 550ms で始まってしまう）ことを確かめる。

次に `src/lib/components/GameShell.svelte` の `padDown` で、`capture(event);` と `pads[player].add(event.pointerId);` のあいだに次を足す。

```ts
// iPad の Safari は離した指の pointerup を届けないことがある。ほかに触れている指が無いなら、パッドに残っている指はもう離れている
if (event.pointerType === 'touch' && event.isPrimary) {
  pads[1].clear();
  pads[2].clear();
  // 2 台で遊ぶときの相手の ready は、相手の端末からの知らせで決まる
  if (!net) ready[1] = ready[2] = false;
}
```

**Verify**:

- `pnpm exec vitest run src/lib/components/GameShell.svelte.test.ts` → すべて pass
- `wc -l src/lib/components/GameShell.svelte` → 200 未満（162 前後）
- `pnpm check` → `0 ERRORS 0 WARNINGS`

### Step 5: `CLAUDE.md` の「入力」に 1 文足す

`grep -n "ダブルタップズームを封じる。" CLAUDE.md` で 1 行出ることを確かめる（出なければ STOP）。その段落の最後
（「…ダブルタップズームを封じる。」のすぐ後ろ、同じ行）に次の文を足す。

「iPad の Safari は離した指の `pointerup` を届けないことがあるので、`BoardInput`・`Settle`・`GameShell` のパッドは、ほかに触れている指の無いタッチ（`pointerType` が `touch` で `isPrimary`）が来たら、残っている指を離れたものとして忘れる（`BoardInput` は各ゲームの `up` へ `pointercancel` として渡し、ペンの指は忘れない）。」

**Verify**: `grep -c "として渡し、ペンの指は忘れない" CLAUDE.md` → 1

### Step 6: 全体の確かめ

`pnpm exec prettier --write src/lib/board-input.ts src/lib/board-input.test.ts src/lib/settle.svelte.ts src/lib/settle.svelte.test.ts src/lib/components/GameShell.svelte src/lib/components/GameShell.svelte.test.ts CLAUDE.md`
を実行してから確かめる。

**Verify**:

- `pnpm test:run` → すべて pass
- `pnpm verify` → exit 0

## Test plan

- `src/lib/board-input.test.ts` に 4 つ。残った指が `pointercancel` として最後の位置で `up` に渡り、新しい指の `down` の hook より
  先に片付く。ほかの指が触れているあいだは忘れない。ペンの指は手のひらのタッチで忘れない。ふつうに離した指を二度渡さない
- `src/lib/settle.svelte.test.ts` に 2 つ。残った指を忘れて 350ms で戻る。ほかの指が触れているあいだは忘れない
- `src/lib/components/GameShell.svelte.test.ts` に 1 つ。残ったパッドの指で、相手が押しただけでは始まらない
- ゲームごとの確かめは、`BoardInput` のテストで「残った指の `pointerId` が `up` の hook に届く」ことと「`fingers.all` から消える」
  ことを見ることで代える。雪原サバイバル・はいしゃさん・線を引いて守る・ばくだんリレーは hook の中で `event.pointerId` を
  比べて片付けるだけ、ホッケーとネコとネズミは `fingers.all` を読むだけなので、この 2 つが確かなら同じ道で直る。
  これらの画面は canvas や three を使い、組み立てて試すには描くところを全部差し替える必要があるので、この計画では足さない
- もとからあるテストの `it(...)` の中身は変えない。変えたくなったら STOP

## Done criteria

- [ ] `pnpm exec vitest run src/lib/board-input.test.ts src/lib/settle.svelte.test.ts src/lib/components/GameShell.svelte.test.ts` が pass し、足した 7 つを含む
- [ ] `grep -n "#forget(event.timeStamp)" src/lib/board-input.ts` が 1 行
- [ ] `grep -n "type: 'pointercancel'" src/lib/board-input.ts` が 1 行
- [ ] `grep -n "new Set<number>()" src/lib/settle.svelte.ts` が 1 行
- [ ] `grep -c "event.isPrimary" src/lib/components/GameShell.svelte` が 1
- [ ] `wc -l < src/lib/components/GameShell.svelte` が 200 未満
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 075 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（`BoardInput` の `down` / `up` / フィールド、`Settle`、`GameShell` の `padDown` / `padUp`）が今のコードと違う
- `pnpm exec vitest run src/lib/coloring/ src/lib/games/` か `pnpm test:run` で、もとからあるテストが 1 つでも落ちる
  （とくに `Canvas.svelte.test.ts`・`LineEditor` のテスト・`animal-survivors` の指のテスト）。共通の層の変更がゲームの
  ふるまいを変えたしるしなので、テストを直さずに報告する
- どれかのゲームの `up` の hook が、`type`・`pointerId`・`pointerType`・`timeStamp` のほかに `event` のプロパティ
  （`clientX`・`currentTarget`・`getCoalescedEvents` など）を読んでいるのを見つけた。偽の `event` では足りないので報告する
- `Hooks.up` の型や呼び方を変えたくなった、または各ゲームの `.svelte` を直したくなった
- 時間で指を忘れる・2 本め以降のタッチでも忘れるなど、この計画と別の直し方が要るように見えた

## Maintenance notes

- 実機での確かめは、作業する係ではなく持ち主が iPad で行う（テストではブラウザが `isPrimary` をどう出すかは確かめられない）。
  ホーム画面から開いたアプリで、雪原サバイバルかはいしゃさんを遊び、指が残る件が起きたとき（体が歩き続ける・道具が使えない）、
  指を全部離してから盤面を 1 回タップすると直るかを見る。直らなければ、Safari はそのタップを `isPrimary === true` で
  出していない。plan 051 のカメレオンと同じ前提なので、そちらで確かめた結果もあわせて見る。直らないときは別の直し方が要るので報告する
- 2 人で同時に遊ぶ盤面（ホッケー・ネコとネズミ・ばくだんリレーなど）では、相手が触れているあいだのタッチは `isPrimary` に
  ならないので、残った指は 2 人とも手を離した次のタッチまで残る。点が入ったあとなど、2 人とも手を離す間で直る
- 忘れた指を各ゲームへ `pointercancel` として渡すので、ばくだんリレーは爆弾をはじかずにその場へ落とし、ぬりえの直しの線
  （`LineEditor.svelte`）は描いた線を捨てる。指は本当は離れていたので線を残すほうが正しいこともあるが、いつどこで離したか
  分からない指で、はじく・塗る・線を確かめるのは避けた。線を残したくなったら、そのときに `LineEditor` だけで見分ける
- `Settle` は種類を見ずに番号を全部空にするので、ペンを押したまま指で触れると、ペンの番号も消える。結果画面の守りが
  早めに外れるだけで、3 秒の見切りもあるので、そのままにしている
- `Canvas.svelte:42-45` の自前の忘れ方は、直したあとはペンとマウスの残りにだけ効く。消すなら、ペンとマウスの残りをどうするかを決めてから
- 新しく `BoardInput` の `up` の hook を書くときは、`event` は本物の `PointerEvent` とは限らない（忘れた指では `type`・`pointerId`・
  `pointerType`・`timeStamp` だけ）ことを前提にする
