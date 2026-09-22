# Plan 004: dog-guard の毎フレーム `ctx.filter` と線分の再構築をなくす

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 004 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/games/dog-guard/paint.ts src/lib/games/dog-guard/engine.ts src/lib/games/dog-guard/engine.test.ts`
> 変わっていたら「Current state」の抜粋と見比べ、食い違えば STOP。

## Status

| 項目       | 値                           |
| ---------- | ---------------------------- |
| Priority   | P1                           |
| Effort     | S                            |
| Risk       | LOW                          |
| Depends on | none                         |
| Category   | perf                         |
| Planned at | commit `b4b0196`, 2026-09-22 |

## Why this matters

dog-guard（線を引いて守る）は、レベルが上がるとハチが最大 34 匹、そのうち最大 45% が「速いハチ」になる。
速いハチは毎フレーム `ctx.filter = 'hue-rotate(-25deg) saturate(1.6)'` を付けて描いているが、
canvas 2D の `filter` は 1 回の描画ごとに別の面へ描いて戻す高コストな操作で、iOS Safari では
フレームを落とす原因になる。しかも Safari 18 より前は canvas の `filter` に対応していないので、
古い iPad では速いハチが普通のハチと同じ色に見え、面の設計が頼りにしている「見分け」が消える。

engine 側では、固まった線（`state.stroke`）から線分の配列を `strokeSegs()` で **毎 step 作り直して**
いる。線は `finishStroke()` のあと変わらないので、この配列は 1 回作れば足りる。レベル 100 では
34 匹 × 3 サブステップ × 最大 150 線分 ≒ 1 フレーム 1.5 万回の距離計算に、150 個の配列の
生成が毎フレーム乗っている。

どちらも、このリポジトリで既に使われている仕組み（`fx.sprite()` のキャッシュ、engine の state）で
片付く。

## Current state

- `src/lib/games/dog-guard/paint.ts` — canvas の描画。`bee(frame)` が `sprite()` でハチの絵をキャッシュ
- `src/lib/games/dog-guard/engine.ts` — ルール。`strokeSegs()` と `step()`
- `src/lib/games/dog-guard/engine.test.ts` — 100 面が用意した線でクリアできることを検証
- `src/lib/fx.ts:162-174` — `sprite(key, size, draw)`。`key@size` でキャッシュし、`draw` には 0..1 の正方形に
  描ける ctx が渡る

`paint.ts:5-45`（現状。ハチのスプライト。`c.fillStyle = body` の `body` が黄色→橙のグラデーション）

```ts
const bee = (frame: 0 | 1) =>
  sprite(`bee:${frame}`, 96, (c) => {
    // 右向き。羽は 2 枚の絵を入れ替えて羽ばたかせる
    c.fillStyle = 'rgb(220 240 255 / 0.85)';
    // ...（羽）
    const body = c.createRadialGradient(0.45, 0.5, 0.05, 0.5, 0.56, 0.3);
    body.addColorStop(0, '#fff07a');
    body.addColorStop(1, '#f2a900');
    c.fillStyle = body;
    // ...（胴・縞・針・目）
  });
```

`paint.ts:210-223`（現状。毎フレームのハチの描画）

```ts
for (const b of state.bees) {
  const frame = Math.floor(now * 30 + b.x * 40) % 2 === 0 ? 0 : 1;
  ctx.save();
  ctx.translate(b.x, b.y);
  // 左へ飛ぶときは裏返して、上下さかさまにならないようにする
  if (b.vx < 0) ctx.scale(-1, 1);
  ctx.rotate(Math.atan2(b.vy, Math.abs(b.vx)) * 0.6);
  const look = BEE_LOOK[b.kind];
  // 速いハチはオレンジに色を変えて、見分けられるようにする
  if (b.kind === 'fast') ctx.filter = 'hue-rotate(-25deg) saturate(1.6)';
  stamp(ctx, bee(frame), 0, 0, BEE_R * 3.4 * look.r);
  ctx.filter = 'none';
  ctx.restore();
}
```

`engine.ts:112-120` と `:167`（現状）

```ts
export function strokeSegs(state: GameState): Seg[] {
  const segs: Seg[] = [];
  for (let i = 1; i < state.stroke.length; i++) {
    const a = state.stroke[i - 1];
    const b = state.stroke[i];
    segs.push([a.x, a.y, b.x, b.y]);
  }
  return segs;
}
// ...
const segs = strokeSegs(state); // step() の中、毎回
```

`engine.ts:102-110`（現状。線が固まる瞬間）

```ts
export function finishStroke(state: GameState): boolean {
  if (state.phase !== 'draw') return false;
  if (state.stroke.length < 2) {
    state.stroke = [];
    return false;
  }
  state.phase = 'defend';
  return true;
}
```

`GameState`（`engine.ts:60-69`）は `level / phase / stroke / ink / bees / spawned / time / result`。
`strokeSegs` を import しているのは `engine.ts` 自身と `paint.ts`（線を描くのに使う）。
`grep -rn "strokeSegs" src/` で確かめること。

`BeeKind` は `'normal' | 'fast' | 'big'`（`engine.ts:22`）。

守るべき規約は、コメントは WHY だけ・日本語、prettier（`singleQuote`、`printWidth: 120`）、
engine は DOM に依存しない。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド                                   | 成功時                |
| ------ | ------------------------------------------ | --------------------- |
| テスト | `pnpm test:run src/lib/games/dog-guard`    | pass（100 面 + 4 件） |
| 型     | `pnpm check`                               | `0 ERRORS`            |
| lint   | `pnpm lint`                                | exit 0                |
| まとめ | `pnpm verify`                              | exit 0                |
| 目視   | `pnpm dev` → `/table-duel/games/dog-guard` | 速いハチが橙          |

## Scope

**In scope**

- `src/lib/games/dog-guard/paint.ts`
- `src/lib/games/dog-guard/engine.ts`
- `src/lib/games/dog-guard/engine.test.ts`（1 件追加）
- `plans/README.md`

**Out of scope**

- `src/lib/fx.ts` — `sprite()` はそのまま使う
- `DogGuard.svelte`、`levels.ts` — 触らない
- 線分の空間分割（格子で近傍だけ見る）— 効くのは確かだが、線を外れた判定漏れが手触りに直結する。
  この計画は「作り直しをやめる」までで、分割は別途測ってから

## Git workflow

- ブランチ: `advisor/004-dog-guard-frame-cost`
- コミットは paint と engine で 2 つ。英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: 速いハチを別のスプライトにして `ctx.filter` を消す

`paint.ts` の `bee` を種類も鍵に含める形にする。色は `hue-rotate(-25deg) saturate(1.6)` を
黄色（`#fff07a`）→橙（`#f2a900`）に当てたときの見た目に近い値を直接置く。目安は
`#ffd27a` → `#f27200`（暗い橙）。目視で「普通のハチと一目で違う橙」になっていればよい。

```ts
const bee = (frame: 0 | 1, fast: boolean) =>
  sprite(`bee:${frame}:${fast ? 'fast' : 'normal'}`, 96, (c) => {
    // ...（羽はそのまま）
    const body = c.createRadialGradient(0.45, 0.5, 0.05, 0.5, 0.56, 0.3);
    // 速いハチは橙にして見分けられるようにする。canvas の filter は iOS で重く、古い Safari では効かない
    body.addColorStop(0, fast ? '#ffd27a' : '#fff07a');
    body.addColorStop(1, fast ? '#f27200' : '#f2a900');
    // ...
  });
```

描画ループは `ctx.filter` の 2 行を消し、`stamp(ctx, bee(frame, b.kind === 'fast'), 0, 0, BEE_R * 3.4 * look.r);` にする。
`// 速いハチはオレンジに…` のコメントはスプライト側に移したので、ループからは消す。

`paint.ts` に `bee(` を呼ぶ場所がほかにないか `grep -n "bee(" src/lib/games/dog-guard/paint.ts` で確かめ、
あれば引数を合わせる。

確認 — `grep -n "ctx.filter" src/lib/games/dog-guard/paint.ts` が 0 件、`pnpm check` → `0 ERRORS`

### Step 2: 線分の配列を `finishStroke()` で 1 回作り、state に持つ

`engine.ts` を次のように変える。

- `GameState` に `segs: Seg[]` を足す（`Seg` は `$lib/segments` から既に import されている）
- `createState()` の戻り値に `segs: []` を足す
- `finishStroke()` で `state.phase = 'defend';` の直前に `state.segs = strokeSegs(state);` を足す
- `step()` の `const segs = strokeSegs(state);` を消し、`collide(bee, state.segs, r)` にする
- `strokeSegs` は `paint.ts` が線を描くのに使っているなら export のまま残す。使っていなければ
  `function` に格下げ（export を外す）

`state.segs` の宣言に 1 行コメントを付ける — `/** 固まった線の線分。線は defend の間は変わらないので finishStroke で 1 回だけ作る */`

確認 — `pnpm test:run src/lib/games/dog-guard` → 100 面すべて pass（線の当たり判定が変わっていない証拠）

### Step 3: 「線は固まったら変わらない」をテストで固定する

`engine.test.ts` に 1 件足す。

```ts
it('線が固まると線分ができ、そのあと点を足しても変わらない', () => {
  const state = createState(levelFor(1));
  addPoint(state, 0.2, 0.5);
  addPoint(state, 0.4, 0.5);
  expect(state.segs).toEqual([]);
  expect(finishStroke(state)).toBe(true);
  expect(state.segs).toEqual([[0.2, 0.5, 0.4, 0.5]]);
  expect(addPoint(state, 0.6, 0.5)).toBe(false);
  expect(state.segs).toHaveLength(1);
});
```

`addPoint` は `phase !== 'draw'` なら `false` を返す（`engine.ts:81`）。座標 `(0.2, 0.5)` などが
レベル 1 の `drawable` に引っかかる（犬の近くや雲の中）ならテストが落ちるので、そのときは
`levelFor(1).dogs` と `noDraw` を見て離れた座標に変える。

確認 — `pnpm test:run src/lib/games/dog-guard` → pass

### Step 4: 目視と検証

`pnpm dev` で `http://localhost:5173/table-duel/games/dog-guard` を開き、タイトルの ▶ でレベルを
30 以上に上げ（`best` がそこまで無ければ DevTools で `localStorage.setItem('table-duel:level:dog-guard', '40')`
してから読み直す）、線を引いてハチを出す。期待 — 橙のハチと黄色のハチが混ざって見える。

確認 — `pnpm verify` → exit 0

## Test plan

- Step 3 の 1 件を追加。既存の `it.each(levels)` 100 面が当たり判定の回帰テスト
- 描画（色）は目視。canvas のピクセルをテストしない（見た目の調整で壊れるテストは負債）

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -rn "ctx.filter" src/lib/games/dog-guard/` が 0 件
- [ ] `grep -n "strokeSegs(state)" src/lib/games/dog-guard/engine.ts` が `finishStroke` の中の 1 件だけ
- [ ] `grep -n "segs: Seg\[\]" src/lib/games/dog-guard/engine.ts` が 1 件
- [ ] Step 4 の目視で速いハチが橙
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 004 の Status を更新した

## STOP conditions

- Step 2 のあとで 100 面テストのどれかが落ちる（線分の作り方が `step` の途中で変わる前提を
  見落としている可能性がある）
- `paint.ts` が `strokeSegs` を `state.stroke` 以外の入力で呼んでいる
- `paint.ts` が 250 行を大きく超える（`.ts` に行数制限はないが、スプライトの分岐で膨らみすぎるなら
  やり方を見直す）

## Maintenance notes

- `state.segs` は `finishStroke()` 以外で更新しない。線を引き直せる機能（draw に戻す）を足すなら
  そこで `segs = []` に戻す
- ハチの種類を増やす（`BeeKind`）ときは、色の違いをスプライトの鍵に含める。`ctx.filter` は使わない
- 線分の空間分割は、実機で lv90 以上を測って必要なら別計画で
