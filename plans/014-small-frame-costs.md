# Plan 014: 小さな毎フレームコスト（bomb-relay の glow / bug-rush のスプライト / snow-camp の measureText）

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 014 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/games/bomb-relay/Bomb.svelte src/lib/games/bomb-relay/BombRelay.svelte src/lib/games/bug-rush/paint.ts src/lib/games/snow-camp/overlay.ts`
> 変わっていたら「Current state」の抜粋と見比べ、食い違えば STOP。

## Status

| 項目       | 値                                      |
| ---------- | --------------------------------------- |
| Priority   | P3                                      |
| Effort     | S（3 つとも独立。1 つずつコミットする） |
| Risk       | LOW（見た目だけ。ルールに触らない）     |
| Depends on | none                                    |
| Category   | perf                                    |
| Planned at | commit `b4b0196`, 2026-09-22            |

## Why this matters

実機で測った数字はない（監査は静的読解）が、iOS Safari で確実に高くつく描画パターンが 3 つある。
どれも既にこのリポジトリにある仕組み（`fx.sprite()`、compositor だけで済む `opacity`）で置き換えられる。

1. bomb-relay は毎フレーム `--heat` を書き、CSS がそれを `box-shadow` の **ぼかし半径と広がり**
   （最大 44px）に使う。ぼかしの再ラスタライズは iOS でいちばん重い paint の 1 つで、`will-change: transform`
   のレイヤーを毎フレーム無効にする。`opacity` だけを動かせば compositor で済む
2. bug-rush は虫 36 匹を毎フレーム 8 個のパスと `clip()` で描く。`clip` は 2D コンテキストの状態を作り直す。
   ほかの canvas ゲームは `fx.sprite()` で 1 回描いてから `drawImage` している
3. snow-camp は `overlay.ts` の `tag()` が毎フレーム `ctx.font` を組み立てて `measureText` する。文字は
   固定（「たき火」など 7 つ）なので、幅は 1 回測れば足りる

## Current state

### bomb-relay

`src/lib/games/bomb-relay/Bomb.svelte:20-44`（現状）

```css
.bomb {
  --heat: 0;
  position: absolute;
  left: 0;
  top: 0;
  height: var(--size);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 4px solid #fff;
  background: radial-gradient(circle at 35% 30%, #6d7390, #2b2d42 62%);
  box-shadow: 0 0 calc(8px + var(--heat) * 36px) calc(var(--heat) * 12px)
    rgb(255 90 40 / calc(0.25 + var(--heat) * 0.6));
  pointer-events: none;
  will-change: transform;
}

/* 熱いほど赤く染まる */
.bomb::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #ff4b2b;
  opacity: calc(var(--heat) * 0.65);
}
```

`src/lib/games/bomb-relay/BombRelay.svelte:81-82` が毎フレーム `bombEl.style.transform = ...` と
`bombEl.style.setProperty('--heat', h.toFixed(3))` を書く（そのまま）。`.spark`（`:46-54`）は `::before` と
別の子要素。

### bug-rush

`src/lib/games/bug-rush/paint.ts`（現状の全文は 76 行）。`paint(ctx, bugs, width, height)` が虫ごとに
`save/translate/scale/rotate` して `drawBody(ctx, bug, r)`、カブトムシは `drawHp`。`drawBody` は
頭の円・角・白ふちの楕円・甲羅の楕円・`save/clip` で右半分と合わせ目・`restore`。色は
`bug` が緑（`#3b9d4a` / `#2c7d39`）、`beetle` が茶（`#8a4b2a` / `#6e3a1f`）。`r = radius(bug) * height`。

`src/lib/fx.ts:162-179` — `sprite(key, size, draw)` は `draw` に 0..1 の正方形に描ける ctx を渡す。
`stamp(ctx, img, x, y, d)` は中心 `(x, y)`、幅高さ `d` で描く。

### snow-camp

`src/lib/games/snow-camp/overlay.ts:6-19`（現状）

```ts
/** 場所の名札。地面の少し手前に、小さく出す */
function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, k: number) {
  const size = k * 0.028;
  ctx.font = `800 ${size}px 'Hiragino Maru Gothic ProN', system-ui`;
  const w = ctx.measureText(text).width + size;
  ctx.fillStyle = 'rgb(43 45 66 / 0.72)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - size * 0.75, w, size * 1.5, size * 0.75);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
```

`size` はカメラの投影 `k` に比例して毎フレーム連続的に変わるので、`text@size` を鍵にしたキャッシュは
効かない（鍵が無限に増える）。文字の幅はフォントサイズに比例するので、**100px で 1 回測った幅** を
`size / 100` 倍すれば同じ値になる。

規約 — コメントは WHY だけ・日本語。prettier。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド        | 成功時                       |
| ------ | --------------- | ---------------------------- |
| 型     | `pnpm check`    | `0 ERRORS`                   |
| lint   | `pnpm lint`     | exit 0                       |
| テスト | `pnpm test:run` | pass                         |
| まとめ | `pnpm verify`   | exit 0                       |
| 目視   | `pnpm dev`      | 各ゲームの見た目が以前と同じ |

## Scope

**In scope**

- `src/lib/games/bomb-relay/Bomb.svelte`
- `src/lib/games/bug-rush/paint.ts`
- `src/lib/games/snow-camp/overlay.ts`
- `plans/README.md`

**Out of scope**

- `BombRelay.svelte`（`--heat` の書き込みはそのまま）
- `fx.ts`
- gate-run と pin-rescue の毎フレームコスト — 015

## Git workflow

- ブランチ: `advisor/014-small-frame-costs`
- コミットはゲームごとに 3 つ。英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: bomb-relay の glow を `opacity` だけで動かす

`Bomb.svelte` の `.bomb` から `box-shadow` を消し、glow を `::after` に移す。ぼかしと広がりは最大値で固定し、
`opacity` だけが `--heat` に従う。

```css
.bomb {
  /* ...（box-shadow の行を消す。ほかはそのまま） */
}

/* 熱いほど強く光る。ぼかしの大きさを毎フレーム変えると iOS で描き直しが重いので、大きさは固定して opacity だけ動かす */
.bomb::after {
  content: '';
  position: absolute;
  inset: -4px;
  z-index: -1;
  border-radius: 50%;
  box-shadow: 0 0 44px 12px rgb(255 90 40 / 0.85);
  opacity: calc(0.3 + var(--heat) * 0.7);
  will-change: opacity;
}
```

`.bomb` には `position: absolute` があるので `::after` の `z-index: -1` は `.bomb` の背景の下、
親（`.board`）の上に落ちる。`.bomb::before`（赤く染まる面）はそのまま。

確認 — `pnpm lint` → exit 0。`pnpm dev` で bomb-relay を開き、爆弾が古くなるほど光が強くなる（大きさは変わらない）

### Step 2: bug-rush の虫をスプライトにする

`paint.ts` の `drawBody` を `fx.sprite()` に包む。虫の絵は「上向き（`-y` が頭）で 0..1 の正方形に収まる」
形で 1 回描き、`stamp` で回転・拡大して置く。

```ts
import { sprite, stamp } from '$lib/fx';

/** 1 回描いた虫の絵。iPad では 1 匹が 120px 前後になるので、縮小だけで済むよう 192px で描く */
const body = (kind: BugKind) =>
  sprite(`bug:${kind}`, 192, (c) => {
    c.translate(0.5, 0.5);
    drawBody(c, kind, 0.36);
  });
```

`drawBody(ctx, bug, r)` の署名を `drawBody(ctx, kind: BugKind, r: number)` にし、中身は今のまま（`bug.kind === 'beetle'`
を `kind === 'beetle'` に）。`r = 0.36` は、絵の最大半径が `r * 1.25`（カブトムシの角）なので 0.5 に収まる値。

`paint()` の虫ごとの処理は次にする。

```ts
ctx.save();
ctx.translate(bug.x * width, bug.y * height);
ctx.scale(lift, lift);
if (flying) {
  /* 影はそのまま */
}
ctx.rotate(bug.heading + Math.PI / 2);
stamp(ctx, body(bug.kind), 0, 0, (r / 0.36) * 1);
ctx.restore();
```

`stamp` の大きさは、スプライトの `r = 0.36` が 1（正方形の 1 辺）に対応するので、実際の `r` に合わせて
`d = r / 0.36`。`BugKind` は `./engine` から import。

`drawHp` はそのまま（カブトムシだけ、文字）。

確認 — `pnpm check` → `0 ERRORS`。`pnpm dev` で bug-rush を開き、虫の向き（頭が進行方向）・大きさ・色が以前と同じ

### Step 3: snow-camp の文字幅をキャッシュする

`overlay.ts` の `tag()` を次にする。

```ts
const widths = new Map<string, number>();
const FONT = "800 100px 'Hiragino Maru Gothic ProN', system-ui";

/** 文字の幅はフォントの大きさに比例するので、100px で 1 回測って縮める。名札は毎フレーム描くが文字は変わらない */
function widthOf(ctx: CanvasRenderingContext2D, text: string): number {
  let w = widths.get(text);
  if (w === undefined) {
    ctx.font = FONT;
    w = ctx.measureText(text).width;
    widths.set(text, w);
  }
  return w;
}

function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, k: number) {
  const size = k * 0.028;
  const w = widthOf(ctx, text) * (size / 100) + size;
  ctx.fillStyle = 'rgb(43 45 66 / 0.72)';
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - size * 0.75, w, size * 1.5, size * 0.75);
  ctx.fill();
  ctx.font = `800 ${size}px 'Hiragino Maru Gothic ProN', system-ui`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}
```

`ctx.font` の設定は `fillText` に要るので残る（設定 1 回）。`measureText` は文字ごとに 1 回だけになる。

確認 — `pnpm check` → `0 ERRORS`。`pnpm dev` で snow-camp を開き、「たき火」「おかね」などの名札の幅が文字に合っている

### Step 4: 検証

確認 — `pnpm verify` → exit 0

## Test plan

自動テストは足さない（すべて描画）。目視は各ステップに書いた。

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -n "box-shadow" src/lib/games/bomb-relay/Bomb.svelte` が `::after` の中の 1 件だけ
- [ ] `grep -n "ctx.clip()\|c.clip()" src/lib/games/bug-rush/paint.ts` が `sprite` の draw の中（1 回描くとき）だけ
- [ ] `grep -c "measureText" src/lib/games/snow-camp/overlay.ts` が 1
- [ ] 3 つの目視
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 014 の Status を更新した

## STOP conditions

- 「Current state」の抜粋と一致しない
- Step 2 で虫の向きが 90 度ずれる／裏返る（スプライトの向きと `rotate(bug.heading + Math.PI / 2)` の関係が
  違う。`drawBody` の座標系（`-y` が頭）を確かめて報告）
- `Bomb.svelte` の `::after` が `.board` の背景の下に隠れる（`z-index` の文脈。`.bomb` に `isolation: isolate` を
  足して直るならそれでよい。直らなければ報告）

## Maintenance notes

- canvas に同じ絵を毎フレーム描くゲームを足すときは、最初から `fx.sprite()` で描く
- `Bomb.svelte` の glow の強さは `::after` の `opacity` の式で調整する。`box-shadow` の大きさは触らない
