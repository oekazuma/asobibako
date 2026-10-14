# Plan 074: iPad を回したら、盤面の大きさが変わらなくても指の座標の向きを測り直す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/board-input.ts src/lib/board-input.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。
> `CLAUDE.md` は毎日のように変わるので drift check に入れていない。Step 3 の前に、直す 1 文があるかを grep で確かめる。

## Status

| 項目       | 値                                                                     |
| ---------- | ---------------------------------------------------------------------- |
| Priority   | P2                                                                     |
| Effort     | S                                                                      |
| Risk       | LOW（`observe()` の中だけを直す。指の追跡と座標の式は変えない）        |
| Depends on | none（plan 075 も同じ 2 ファイルを触るので、こちらを先に入れるとよい） |
| Category   | bug                                                                    |
| Planned at | commit `ea56ff6`, 2026-10-14                                           |

## Why this matters

盤面の上を指で操作するゲーム（ホッケー・ばくだんリレー・はいしゃさん・雪原サバイバルなど 15 ほど）は、共通の
`BoardInput`（`src/lib/board-input.ts`）で指の画面上の座標を盤面の 0..1 に直す。そのとき使う盤面の外接矩形（`#box`）・
盤面そのものの大きさ（`#size`）・盤面が回っているか（`#turned`）は、`observe()` が付けたときと ResizeObserver が
知らせたときにしか測らない。

横向きのタッチ端末では、`app.css` が `.stage` を時計回りに 90 度回す。縦向きの `.stage` は幅が画面の幅で高さが `100dvh`、
横向きは幅 `100dvh`・高さ `100dvw` なので、ホーム画面から開いたアプリ（ブラウザの帯が無く `dvh` が動かない）で iPad を
回すと、`.stage` の中身の大きさは縦と横が入れ替わる前とまったく同じになる。ResizeObserver は transform を見ないので
何も知らせず、`#turned` と `#box` が回す前のまま残る。そのあいだ指は盤面の別の場所に当たり、ゲームを開き直すまで直らない。

向きが変わったことは、`.stage` を回す条件と同じメディアクエリ（`TURNED_QUERY`）の `change` で分かる。そこでも測り直す。
ついでに、幅が 0 のときも `onResize` を呼ばないようにする（今は高さ 0 だけを除いている。幅 0 で呼ぶと縦横比 0 が
ばくだんリレーの `BOMB_R / state.aspect` などの割り算に入る。雪原サバイバルは `px(1, 1)` の幅 0 で
`world3d.ts:226` の `this.camera.aspect = w / h` が 0 になる。どちらも `onResize` を呼ばなければ起きない）。

## Current state

直すファイルは 1 つで、テストは 1 つ。

- `src/lib/board-input.ts` — 盤面の指の追跡と座標の変換（`BoardInput`）。`observe()` が大きさを測る
- `src/lib/board-input.test.ts` — 今は `toBoardPoint` の 2 つのテストだけ。vitest の `unit`（node）の project で動く
- `src/app.css` — `.stage` を回す CSS（読むだけ。触らない）
- `CLAUDE.md`（リポジトリ直下）の「横向き」の節 — 回転の見つけ方の説明が今のコードと違うので 1 文を直す

### `observe()` と `board` のアクション

今のコードは `src/lib/board-input.ts:89-120` にある。

```ts
  /** el の大きさを測り、変わるたびに onResize(幅 / 高さ) を呼ぶ。戻り値で見張りをやめる */
  observe(el: HTMLElement, onResize: (aspect: number) => void): () => void {
    const measure = () => {
      this.#box = el.getBoundingClientRect();
      this.#size = { width: el.offsetWidth, height: el.offsetHeight };
      this.#turned = matchMedia(TURNED_QUERY).matches;
      if (this.#size.height === 0) return;
      onResize(this.#size.width / this.#size.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }

  /** 盤面の要素に use:input.board={onResize} と書けば、指の配線と大きさの見張りが付く */
  board: Action<HTMLElement, ((aspect: number) => void) | undefined> = (el, onResize = () => {}) => {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    const unobserve = this.observe(el, onResize);
    return {
      destroy: () => {
        el.removeEventListener('pointerdown', this.down);
        el.removeEventListener('pointermove', this.move);
        el.removeEventListener('pointerup', this.up);
        el.removeEventListener('pointercancel', this.up);
        unobserve();
      }
    };
  };
```

`TURNED_QUERY` は同じファイルの `src/lib/board-input.ts:11-12` にある。

```ts
/** app.css が .stage を回す条件と同じ。盤面が回っているかは、外接矩形から推し量るより CSS に聞くほうが確か */
export const TURNED_QUERY = '(orientation: landscape) and (pointer: coarse)';
```

座標の変換は `at()`（`src/lib/board-input.ts:62-65`）で、`toBoardPoint(event.clientX, event.clientY, this.#box, this.#turned)` を返す。
`#box` の初期値は `{ left: 0, top: 0, right: 1, width: 1, height: 1 }`（`board-input.ts:47`）。

### `.stage` を回す CSS

縦向きは `src/app.css:177-187`（幅は指定なしで画面の幅、高さは `100dvh`）。横向きは `src/app.css:220-229` にある。

```css
@media (orientation: landscape) and (pointer: coarse) {
  .stage:not(.wide) {
    position: fixed;
    top: 0;
    left: 0;
    width: 100dvh;
    height: 100dvw;
    transform-origin: top left;
    transform: rotate(90deg) translateY(-100%);
  }
}
```

### `onResize` を受ける側

`onResize` を受ける関数はどれも、同じ大きさで何度呼ばれても描き直すだけで済む（例 `src/lib/games/dentist/Dentist.svelte:94-102`、
`src/lib/games/oekaki-mori/Board.svelte:83-93` は canvas を作り直して全部描き直す）。向きの知らせでもう 1 回呼んでよい。

### 規約

- コードのコメントは、コードから読み取れない WHY だけを日本語で書く。変更の経緯や計画の番号は書かない
- テストの名前は日本語の文にする
- `.svelte` のファイルは触らない

## Commands you will need

| Purpose       | Command                                            | Expected on success           |
| ------------- | -------------------------------------------------- | ----------------------------- |
| 足すテスト    | `pnpm exec vitest run src/lib/board-input.test.ts` | すべて pass                   |
| 全部のテスト  | `pnpm test:run`                                    | すべて pass                   |
| 型            | `pnpm check`                                       | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                        | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                               | 警告 0                        |
| 全部          | `pnpm verify`                                      | exit 0                        |

ブラウザの道具は使わない（この計画では要らない）。

## Scope

**In scope**

- `src/lib/board-input.ts`（`observe()` だけ）
- `src/lib/board-input.test.ts`（テストを足す）
- `CLAUDE.md`（「横向き」の節の 1 文だけ）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `BoardInput` の `down` / `move` / `up` と `fingers.ts`（plan 075 が扱う）
- `src/lib/games/hirameki/` の `Ice.svelte`・`Memo.svelte`・`Slide.svelte`・`cell.ts` と `animal-survivors/Gacha3D.svelte`。
  どれも指を置くたびに `matchMedia(TURNED_QUERY)` と外接矩形を測り直しているので、この不具合は無い
- `yappari-chameleon`（`.stage.wide` で回さない）
- `app.css` の回し方

## Git workflow

- ブランチは `advisor/074-board-remeasure-on-rotate`
- コミットは 1 つでよい。英語の命令形 1 文で、`Co-Authored-By` などの末尾の行は付けない（例 `Remeasure the board when the screen turns without changing its size`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 失敗するテストを先に書く

`src/lib/board-input.test.ts` の 1 行目の import を
`import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';` にし、2 行目を
`import { BoardInput, toBoardPoint } from './board-input';` にする。ファイルの最後に次の `describe` を足す。

```ts
/** 画面上の点だけを持つ指。座標の変換は clientX と clientY しか見ない */
const point = (clientX: number, clientY: number) => ({ clientX, clientY }) as PointerEvent;

describe('BoardInput の大きさの見張り', () => {
  let box: { left: number; top: number; right: number; width: number; height: number };
  let change: (() => void) | undefined;
  const stubMedia = () => ({
    matches: false,
    addEventListener: vi.fn((_type: string, f: () => void) => (change = f)),
    removeEventListener: vi.fn()
  });
  let media: ReturnType<typeof stubMedia>;
  /** 回しても大きさの変わらない盤面。外接矩形だけが回る */
  const board = (offsetWidth = 600, offsetHeight = 800) =>
    ({ getBoundingClientRect: () => box, offsetWidth, offsetHeight }) as unknown as HTMLElement;

  beforeEach(() => {
    box = { left: 0, top: 0, right: 600, width: 600, height: 800 };
    change = undefined;
    media = stubMedia();
    vi.stubGlobal('matchMedia', () => media);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('盤面の大きさが変わらなくても、横向きに回したら測り直して指の座標を回す', () => {
    const input = new BoardInput();
    const onResize = vi.fn();
    input.observe(board(), onResize);
    expect(input.at(point(150, 200))).toEqual([0.25, 0.25]);
    // 回すと外接矩形は横長になり、盤面の上辺が画面の右に来る
    box = { left: 0, top: 0, right: 800, width: 800, height: 600 };
    media.matches = true;
    change?.();
    expect(input.at(point(600, 150))).toEqual([0.25, 0.25]);
    expect(onResize).toHaveBeenCalledTimes(2);
  });

  it('見張りをやめたら、向きの知らせも外す', () => {
    const stop = new BoardInput().observe(board(), () => {});
    stop();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', change);
  });

  it('幅か高さが 0 のあいだは onResize を呼ばない', () => {
    const onResize = vi.fn();
    new BoardInput().observe(board(0, 800), onResize);
    new BoardInput().observe(board(600, 0), onResize);
    expect(onResize).not.toHaveBeenCalled();
  });
});
```

1 つめのテストの数字は `toBoardPoint`（`board-input.ts:36-39`）の式どおりで、回す前は `[150 / 600, 200 / 800]`、回したあとは
`[(150 - 0) / 600, (800 - 600) / 800]` になる。

**Verify**: `pnpm exec vitest run src/lib/board-input.test.ts` → 足した 3 つが全部落ちる（向きの知らせを聞いていない、
外していない、幅 0 で `onResize` を呼んでいる）。もとからある `toBoardPoint` の 2 つは pass のまま。
`pnpm check` → `0 ERRORS 0 WARNINGS`（テストの型の誤りはここで見つける）。

### Step 2: `observe()` で向きの知らせを聞き、幅 0 も除く

`src/lib/board-input.ts` の `observe()` を次の形にする。`board` のアクションは変えない（`unobserve()` が新しい後始末も呼ぶ）。

```ts
  /** el の大きさを測り、変わるたびに onResize(幅 / 高さ) を呼ぶ。戻り値で見張りをやめる */
  observe(el: HTMLElement, onResize: (aspect: number) => void): () => void {
    const turned = matchMedia(TURNED_QUERY);
    const measure = () => {
      this.#box = el.getBoundingClientRect();
      this.#size = { width: el.offsetWidth, height: el.offsetHeight };
      this.#turned = turned.matches;
      if (this.#size.width === 0 || this.#size.height === 0) return;
      onResize(this.#size.width / this.#size.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // iPad を回しても .stage は幅と高さが入れ替わるだけで、盤面の大きさが変わらず ResizeObserver は知らせない
    turned.addEventListener('change', measure);
    return () => {
      observer.disconnect();
      turned.removeEventListener('change', measure);
    };
  }
```

`#box`・`#size`・`#turned` を先に入れてから 0 を除く順は変えない（大きさが 0 でも指の座標の変換は最新にしておく）。

**Verify**:

- `pnpm exec vitest run src/lib/board-input.test.ts` → すべて pass（5）
- `grep -n "addEventListener('change', measure)\|removeEventListener('change', measure)" src/lib/board-input.ts` → 2 行
- `pnpm check` → `0 ERRORS 0 WARNINGS`

### Step 3: `CLAUDE.md` の「横向き」の説明を今のコードに合わせる

まず `grep -n "外接矩形と盤面そのものの大きさの食い違いから回転を見つけて直し" CLAUDE.md` を実行し、1 行出ることを確かめる
（出なければ STOP）。その文の
「指の座標は `BoardInput` が外接矩形と盤面そのものの大きさの食い違いから回転を見つけて直し、」を
「指の座標は `BoardInput` が `.stage` を回す条件と同じメディアクエリ（`TURNED_QUERY`）で回っているかを知って直し（iPad を回しても盤面の大きさは変わらないことがあるので、向きが変わるたびにも測り直す）、」に置き換える。
文の残り（「描画の位置は盤面そのものの大きさ…」から先）は変えない。

**Verify**: `grep -c "TURNED_QUERY" CLAUDE.md` → 1 以上、`grep -c "食い違いから回転を見つけて" CLAUDE.md` → 0

### Step 4: 全体の確かめ

`pnpm exec prettier --write src/lib/board-input.ts src/lib/board-input.test.ts CLAUDE.md` を実行してから確かめる。

**Verify**:

- `pnpm test:run` → すべて pass
- `pnpm verify` → exit 0

## Test plan

- `src/lib/board-input.test.ts` に 3 つ足す。大きさが変わらないまま向きの知らせが来たら座標の変換が回る（`onResize` も 2 回め
  が呼ばれる）、後始末で向きの知らせを外す、幅か高さが 0 なら `onResize` を呼ばない
- 偽の `matchMedia` と `ResizeObserver` は `vi.stubGlobal` で入れる（同じ書き方は `src/lib/pwa.test.ts:70-102`）。盤面の要素は
  `getBoundingClientRect`・`offsetWidth`・`offsetHeight` だけを持つ素のオブジェクトでよい
- もとからある `toBoardPoint` の 2 つのテストは変えない

## Done criteria

- [ ] `pnpm exec vitest run src/lib/board-input.test.ts` が pass し、足した 3 つを含む 5 つが通る
- [ ] `grep -n "turned.removeEventListener('change', measure)" src/lib/board-input.ts` が 1 行
- [ ] `grep -n "this.#size.width === 0 || this.#size.height === 0" src/lib/board-input.ts` が 1 行
- [ ] `grep -c "食い違いから回転を見つけて" CLAUDE.md` が 0
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 074 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の `observe()`・`board`・`TURNED_QUERY` の抜粋が今のコードと違う（plan 075 が先に入って `down` / `up` のまわりだけが
  変わっているのはよい。`observe()` が違えば STOP）
- `pnpm test:run` で、盤面を使うゲームや `coloring` のテスト（`Canvas.svelte.test.ts` など）が 1 つでも落ちる。
  向きの知らせで余分に呼ぶ `onResize` が何かを壊したしるしなので、テストを直さずに報告する
- happy-dom の project のテストで `matchMedia(...).addEventListener is not a function` のような失敗が出る
  （happy-dom の `matchMedia` が `addEventListener` を持たないしるし。`?.` で逃がしたくなっても、そうせずに報告する）
- `CLAUDE.md` の Step 3 の文が見つからない

## Maintenance notes

- 実機での確かめは、作業する係ではなく持ち主が iPad で行う。ホーム画面から開いたアプリでホッケーかばくだんリレーを
  縦向きで始め、遊んでいる最中に横向きへ回して、指を置いた場所にマレットや爆弾がついてくるかを見る。直す前は回したあと
  指とマレットがずれる
- 向きの知らせのあとの `getBoundingClientRect()` は、ブラウザが新しい CSS でレイアウトし直した矩形を返す（読んだ時点で
  レイアウトを確定させる）。もし iPad で、回した直後だけずれて少し待つと直るようなら、回転のアニメーションの途中の矩形を
  測っているしるしなので、`requestAnimationFrame` で 1 コマ待ってから測るかを考える
- ほかに盤面の大きさを見張る仕組みを足すときも、回転は ResizeObserver では分からないことを前提にする
