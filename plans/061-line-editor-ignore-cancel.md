# Plan 061: 線を直す画面で、iOS が取り消した指では線を足したり消したりしない

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/coloring/LineEditor.svelte src/lib/coloring/LineEditor.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                  |
| ---------- | ------------------------------------------------------------------- |
| Priority   | P3                                                                  |
| Effort     | S                                                                   |
| Risk       | LOW（`LineEditor.svelte` の中だけ。共通の `BoardInput` は触らない） |
| Depends on | none                                                                |
| Category   | bug                                                                 |
| Planned at | commit `36cc037`, 2026-10-14                                        |

## Why this matters

ぬりえで写真から線画を作るとき、「これで ぬる」の前に指で線を足したり消したりできる（`LineEditor.svelte`）。
共通の指の部品 `BoardInput` は `pointercancel` も `up` に渡すので、iOS が指を取り消したとき（画面の端からのジェスチャー、
手のひらが触れたときなど）も、その指でなぞった線がそのまま直しとして入る。子どもは描くつもりのない線が増えたり、
大事な線が消えたりする。

塗る画面（`Canvas.svelte`）は同じ理由で `pointercancel` を見て塗らないようにしてある。線を直す画面も同じにし、
取り消された指でなぞって見せていた跡も消す。

## Current state

- `src/lib/board-input.ts` は盤面の指を 0..1 の座標で追う共通の部品。19 のファイルが使っていて、`pointercancel` を
  `up` として扱う決まりにほかのゲームが頼っているので変えない
- `src/lib/coloring/LineEditor.svelte` は線を直す画面（113 行）。`LineFix.svelte` と `PhotoMaker.svelte` が使う
- `src/lib/coloring/Canvas.svelte` は塗る画面。取り消された指を捨てる書き方のお手本

`BoardInput` が `pointercancel` を `up` に渡すところは `src/lib/board-input.ts:105-109` にある。

```ts
  board: Action<HTMLElement, ((aspect: number) => void) | undefined> = (el, onResize = () => {}) => {
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
```

`up` の口は `up?: (event: PointerEvent, finger: Finger, x: number, y: number) => void`（`src/lib/board-input.ts:8`）で、
`event.type` を見れば `pointerup` か `pointercancel` かが分かる。

お手本の `src/lib/coloring/Canvas.svelte:59-64` は、離した指が取り消されたものなら塗らない。

```ts
    up: (event, _finger, x, y) => {
      if (pinching?.ids.includes(event.pointerId)) pair();
      if (!tap || event.pointerId !== tap.id) return;
      const start = tap;
      tap = null;
      // iOS が取り消した指（端からのジェスチャーや手のひら）は、塗るつもりで触れた指ではない
      if (event.type === 'pointercancel' || Math.hypot(x - start.x, y - start.y) > TAP) return;
```

直す `src/lib/coloring/LineEditor.svelte:23-51` は、なぞっているあいだ線をその場で canvas に描いて見せ（`move`）、
離したときに `onedit` で直しを知らせる（`up`）。`up` は `event.type` を見ていない。

```ts
const input = new BoardInput({
  down: (event, x, y) => {
    if (tool && !stroke) stroke = { id: event.pointerId, pts: [x, y] };
  },
  move: (event, x, y) => {
    if (!stroke || !tool || event.pointerId !== stroke.id) return;
    const { pts } = stroke;
    // なぞっているあいだは、その場で描いて見せる（線画を作り直すのは離したとき）
    const g = canvas?.getContext('2d');
    if (g) {
      g.strokeStyle = tool === 'add' ? `rgb(${INK})` : '#fff';
      g.lineWidth = WIDTH[tool];
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(pts[pts.length - 2] * SIZE, pts[pts.length - 1] * SIZE);
      g.lineTo(x * SIZE, y * SIZE);
      g.stroke();
    }
    pts.push(x, y);
  },
  up: (event, _finger, x, y) => {
    if (!stroke || event.pointerId !== stroke.id) return;
    const { pts } = stroke;
    stroke = null;
    if (!tool) return;
    pts.push(x, y);
    onedit({ kind: tool, pts, width: WIDTH[tool] });
  }
});
```

線画を canvas に描くのは `src/lib/coloring/LineEditor.svelte:53-66` の `$effect` で、`mask` が変わったときだけ描き直す。

```ts
$effect(() => {
  const g = canvas?.getContext('2d');
  if (!g) return;
  const img = g.createImageData(SIZE, SIZE);
  const d = img.data;
  for (let i = 0; i < mask.length; i++) {
    const line = mask[i] === 1;
    d[i * 4] = line ? INK[0] : 255;
    d[i * 4 + 1] = line ? INK[1] : 255;
    d[i * 4 + 2] = line ? INK[2] : 255;
    d[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
});
```

ふつうに離したときは `onedit` を受けた親が線画（`mask`）を作り直すので、この `$effect` が描き直してなぞった跡が本物の線に
置き換わる。取り消された指で `onedit` を呼ばずに返すだけだと `mask` は変わらず、`move` で描いた跡が次の直しまで画面に残る
（線があるように見えるのに、塗る場所は分かれない）。そこで、取り消されたときは線画を描き直して跡を消す。

テストは `src/lib/coloring/LineEditor.svelte.test.ts` にある。`show()` が `fire(type, x, id = 1)` で盤面へ指のイベントを送り、
`press(label)` で道具のボタンを押す。happy-dom の canvas は 2D の描画を持たない（`getContext('2d')` が描けない）ので、
跡を消したかは画素では確かめない。`if (g)` / `if (!g) return` の守りがあるので、テストでは描く処理が飛ばされる。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く。`.svelte` は 200 行未満
（svelte-vitals `architecture/component-size`）。テストの名前は日本語の文にする。

## Commands you will need

| Purpose       | Command                                                           | Expected on success           |
| ------------- | ----------------------------------------------------------------- | ----------------------------- |
| 足すテスト    | `pnpm exec vitest run src/lib/coloring/LineEditor.svelte.test.ts` | すべて pass                   |
| 使う側        | `pnpm exec vitest run src/lib/coloring/`                          | すべて pass                   |
| 全テスト      | `pnpm test:run`                                                   | exit 0                        |
| 型            | `pnpm check`                                                      | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                       | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                              | 警告 0                        |
| 全部          | `pnpm verify`                                                     | exit 0                        |

## Scope

**In scope**

- `src/lib/coloring/LineEditor.svelte`
- `src/lib/coloring/LineEditor.svelte.test.ts`（テストを足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/board-input.ts` — `pointercancel` を `up` に渡す決まりに、ほかのゲーム（`BoardInput` を使う 19 ファイルのうち
  `Canvas.svelte` と `BombRelay.svelte` 以外の 16）が頼っている。指を取り消されても、離したのと同じに後始末したいため
- `BoardInput` を使うほかのファイル — 取り消しで困るかは別に調べる（Maintenance notes）
- `LineFix.svelte`・`PhotoMaker.svelte`・`edits.ts` — 直しの受け方は変わらない

## Git workflow

- ブランチは `advisor/061-line-editor-ignore-cancel`
- コミットは 1 つでよい。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない
  （例 `Ignore cancelled touches in the line editor`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 取り消された指のテストを書き、落ちることを見る

`src/lib/coloring/LineEditor.svelte.test.ts` の `describe('LineEditor', …)` の最後に次を足す。

```ts
// iOS が取り消した指（端からのジェスチャーや手のひら）は、線を直すつもりで触れた指ではない
it('取り消された指では直さず、次になぞった線はふつうに直す', () => {
  const { app, onedit, fire, press } = show();
  press('せんを けす');
  fire('pointerdown', 0.2);
  fire('pointermove', 0.5);
  fire('pointercancel', 0.6);
  expect(onedit).not.toHaveBeenCalled();
  fire('pointerdown', 0.3);
  fire('pointerup', 0.4);
  expect(onedit).toHaveBeenCalledTimes(1);
  expect(onedit.mock.lastCall![0].pts[0]).toBeCloseTo(0.3);
  unmount(app);
});
```

後半の 2 行は、取り消しで `stroke` が空になり、次の指で新しい線が始まることを確かめる（空にしないと次の指が線を始めない）。

**Verify**: `pnpm exec vitest run src/lib/coloring/LineEditor.svelte.test.ts` → 足したテストが
`expect(onedit).not.toHaveBeenCalled()` で落ち、もとの 3 つは pass。

### Step 2: 取り消された指を捨て、なぞった跡を消す

`src/lib/coloring/LineEditor.svelte` を次のように直す。

1. `$effect` の中身を関数 `redraw()` に出し、`$effect` からはそれを呼ぶ。`redraw()` は `$effect` の中で同期に呼ばれ、
   `canvas` と `mask` を読むので、今と同じくそれらが変わったときに描き直る

   ```ts
   /** 線画を描く。取り消された指でなぞって見せていた跡を消すときにも呼ぶ */
   function redraw() {
     const g = canvas?.getContext('2d');
     if (!g) return;
     const img = g.createImageData(SIZE, SIZE);
     const d = img.data;
     for (let i = 0; i < mask.length; i++) {
       const line = mask[i] === 1;
       d[i * 4] = line ? INK[0] : 255;
       d[i * 4 + 1] = line ? INK[1] : 255;
       d[i * 4 + 2] = line ? INK[2] : 255;
       d[i * 4 + 3] = 255;
     }
     g.putImageData(img, 0, 0);
   }

   $effect(redraw);
   ```

   `redraw` は `const input = new BoardInput(…)` より前に置いても後ろに置いてもよい（`up` が呼ばれるのは mount のあと）。
   `$effect(redraw)` の形で `svelte-check` か eslint が文句を言うときは `$effect(() => redraw());` にする

2. `up` を次の形にする。`stroke = null;` は今のまま先に行う（取り消された指でも、なぞっていた線は終わらせる）

   ```ts
   up: (event, _finger, x, y) => {
     if (!stroke || event.pointerId !== stroke.id) return;
     const { pts } = stroke;
     stroke = null;
     // iOS が取り消した指（端からのジェスチャーや手のひら）は、線を直すつもりで触れた指ではない。なぞって見せた跡も消す
     if (event.type === 'pointercancel') return redraw();
     if (!tool) return;
     pts.push(x, y);
     onedit({ kind: tool, pts, width: WIDTH[tool] });
   };
   ```

**Verify**: `pnpm exec vitest run src/lib/coloring/LineEditor.svelte.test.ts` → 4 つとも pass。
`wc -l src/lib/coloring/LineEditor.svelte` → 199 以下（今 113 行）。
`grep -n "pointercancel" src/lib/coloring/LineEditor.svelte` → `up` の中の 1 行が出る。

### Step 3: 全体の確かめ

**Verify**: `pnpm exec vitest run src/lib/coloring/` → すべて pass（`LineFix` と `PhotoMaker` のテストを含む）。
`pnpm verify` → exit 0。`git diff --stat` → `src/lib/board-input.ts` が出ない。

## Test plan

- `LineEditor.svelte.test.ts` に 1 つ（取り消された指では直さず、次の指はふつうに直す）
- なぞった跡を消したか（`redraw()` を呼んだか）は、happy-dom に 2D の canvas が無いので画素では確かめない。
  コードを読んで、`pointercancel` の分かれ道が `redraw()` を呼んでいることを確かめる
- `pnpm exec vitest run src/lib/coloring/` → すべて pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/coloring/LineEditor.svelte.test.ts` が pass し、足した 1 つを含む
- [ ] `grep -n "pointercancel" src/lib/coloring/LineEditor.svelte` が `up` の中の行を返す
- [ ] `git diff --stat 36cc037..HEAD -- src/lib/board-input.ts` が何も返さない
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 061 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `LineEditor.svelte` の `BoardInput` の `up` と、線画を描く `$effect` が上の抜粋と違う
- `board-input.ts` が `pointercancel` をもう `up` に渡していない（直す必要が無くなっている）
- `$effect` を `redraw()` に出したら、`LineFix` か `PhotoMaker` のテストが落ちた
- 直すために `board-input.ts` かほかのゲームのファイルを変えたくなった

## Maintenance notes

- `BoardInput` の `up` は `pointercancel` でも呼ばれる。離したときに何かを決める（塗る・描く・投げる）部品は、
  `event.type === 'pointercancel'` を見て捨てるかを決める。今そうしているのは `Canvas.svelte`・`BombRelay.svelte` と、
  この計画のあとの `LineEditor.svelte`
- ほかの `BoardInput` を使うゲームで取り消しが困るかは、この計画では調べていない。気になるなら
  `grep -rln "new BoardInput" src` の 19 ファイルの `up` を見る
- 実機では、写真から作る画面の線を直すところで、指でなぞりながら画面の端から戻るジェスチャーをして、線が増えず、
  なぞった跡も消えることを見る
