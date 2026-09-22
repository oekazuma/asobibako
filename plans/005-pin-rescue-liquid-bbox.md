# Plan 005: pin-rescue の液体描画を外接矩形だけに絞る

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 005 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/games/pin-rescue/liquid.ts src/lib/games/pin-rescue/paint.ts src/lib/games/pin-rescue/PinRescue.svelte`
> 変わっていたら「Current state」の抜粋と見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                              |
| ---------- | ------------------------------------------------------------------------------- |
| Priority   | P1                                                                              |
| Effort     | M                                                                               |
| Risk       | MED（`top[x]` の添字と `wx`/`wy` の座標を矩形基準に直す。間違えると絵が変わる） |
| Depends on | none                                                                            |
| Category   | perf                                                                            |
| Planned at | commit `b4b0196`, 2026-09-22                                                    |

## Why this matters

pin-rescue（ピンぬき）の水とマグマは、粒をぼかした玉として小さな canvas に重ね、濃いところだけを
残して色を塗る（メタボール）。その色塗りが `getImageData(0, 0, width, height)` で **canvas 全体** を
読み戻し、全画素をループし、`putImageData` で戻す。しかも水とマグマで 1 フレームに 2 回。

大きさを iPad（834×1194 CSS px、dpr 2）で見積もると、`view.scale ≈ 784`、`scale = 784 × 2 / 3 ≈ 523`
なので、canvas は 523 × 732 ≒ 38 万画素、読み戻しは 1.5 MB × 2、ループは 38 万回 × 2。
`getImageData` は GPU→CPU の同期転送で、iOS Safari ではこれだけで 16.7 ms の予算を超える。
液体そのものは面のプールで幅 0.38 × 高さ 0.2 程度（≒ 2 万画素）しかない。

外接矩形（その種類の粒の範囲 + ぼかし半径）だけを読み戻して塗れば、転送もループも 10 分の 1 以下になる。

## Current state

- `src/lib/games/pin-rescue/liquid.ts` — `LiquidLayer` クラス。142 行
- `src/lib/games/pin-rescue/paint.ts:227-228` — `liquid.draw(ctx, state.particles, 'water', now); liquid.draw(ctx, state.particles, 'lava', now);`
- `src/lib/games/pin-rescue/engine.ts` — `R = 0.02`（粒の半径）、`WORLD_H = 1.4`、`Particle { x, y, kind, ... }`

`liquid.ts:41-58`（現状。粒を描いて読み戻すまで）

```ts
  draw(ctx: CanvasRenderingContext2D, particles: Particle[], kind: Liquid, now: number) {
    const scale = ctx.getTransform().a / DOWN;
    const width = Math.max(1, Math.ceil(scale));
    const height = Math.max(1, Math.ceil(WORLD_H * scale));
    this.#setup(width, height);
    const c = this.#ctx!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, width, height);
    const d = R * 4.2 * scale;
    let any = false;
    for (const p of particles) {
      if (p.kind !== kind) continue;
      any = true;
      c.drawImage(this.#blob!, p.x * scale - d / 2, p.y * scale - d / 2, d, d);
    }
    if (!any) return;

    const image = c.getImageData(0, 0, width, height);
```

`liquid.ts:59-77`（現状。ループの頭。`top[x]` は列ごとの水面、`wx`/`wy` は雪原単位の座標）

```ts
    const px = image.data;
    // 列ごとに、いちばん上の液体の位置（水面）を覚えて、そこからの深さで色を変える
    const top = new Int32Array(width).fill(-1);
    const unit = 1 / scale;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4 + 3;
        const a = px[i];
        if (a < EDGE) {
          px[i] = 0;
          top[x] = -1;
          continue;
        }
        if (top[x] < 0) top[x] = y;
        // 水面からの深さ（雪原の単位）と、縁からの近さ
        const depth = (y - top[x]) * unit;
        const rim = Math.min(1, (a - EDGE) / 70);
        const wx = x * unit;
        const wy = y * unit;
```

`liquid.ts:118-120`（現状。書き戻しと本 canvas への転写）

```ts
c.putImageData(image, 0, 0);
ctx.imageSmoothingEnabled = true;
ctx.drawImage(this.#canvas!, 0, 0, width / scale, height / scale);
```

ループの中の色の計算（`liquid.ts:78-116`）は `depth`・`rim`・`wx`・`wy`・`now`・`kind` だけを使い、
`x`/`y` そのものは `top[x]` と `wx`/`wy` にしか出てこない。つまり、矩形の左上 `(x0, y0)` を足して
「絶対座標」を作ってから同じ式に渡せば、色は 1 ビットも変わらない。

`liquid.ts` にテストはない。`liquid.ts` は `document.createElement('canvas')` を使うので、テストは
純粋関数に切り出した部分だけを対象にする。

守るべき規約は、コメントは WHY だけ・日本語、prettier（`singleQuote`、`printWidth: 120`）。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド                                    | 成功時                           |
| ------ | ------------------------------------------- | -------------------------------- |
| テスト | `pnpm test:run src/lib/games/pin-rescue`    | pass                             |
| 型     | `pnpm check`                                | `0 ERRORS`                       |
| lint   | `pnpm lint`                                 | exit 0                           |
| まとめ | `pnpm verify`                               | exit 0                           |
| 目視   | `pnpm dev` → `/table-duel/games/pin-rescue` | 水面の光・マグマの筋が以前と同じ |

## Scope

**In scope**

- `src/lib/games/pin-rescue/liquid.ts`
- `src/lib/games/pin-rescue/liquid.test.ts`（新規。矩形の計算だけ）
- `plans/README.md`

**Out of scope**

- `paint.ts`、`PinRescue.svelte`、`engine.ts` — 呼び出しの形は変えない
- `DOWN`（解像度）や `EDGE`（しきい値）の値 — 見た目を変えない
- ぼかし玉の描き方（`#blob`）— 変えない

## Git workflow

- ブランチ: `advisor/005-pin-rescue-liquid-bbox`
- コミット 1〜2 つ。英語の命令形 1 文、末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: 外接矩形を計算する純粋関数を切り出す

`liquid.ts` に export 関数を足す。入力は粒の配列・種類・`scale`・ぼかしの直径 `d`（ピクセル）・
canvas の幅と高さ。出力は整数の矩形 `{ x0, y0, w, h }`、粒がなければ `null`。

```ts
/** その種類の粒がぼかし玉ごと収まる矩形（ピクセル、canvas の中に切り詰め）。粒がなければ null */
export function liquidBox(
  particles: Particle[],
  kind: Liquid,
  scale: number,
  d: number,
  width: number,
  height: number
): { x0: number; y0: number; w: number; h: number } | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of particles) {
    if (p.kind !== kind) continue;
    minX = Math.min(minX, p.x * scale - d / 2);
    minY = Math.min(minY, p.y * scale - d / 2);
    maxX = Math.max(maxX, p.x * scale + d / 2);
    maxY = Math.max(maxY, p.y * scale + d / 2);
  }
  if (minX === Infinity) return null;
  const x0 = Math.max(0, Math.floor(minX));
  const y0 = Math.max(0, Math.floor(minY));
  const x1 = Math.min(width, Math.ceil(maxX));
  const y1 = Math.min(height, Math.ceil(maxY));
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}
```

`type Liquid` は `export` にする（テストで使う）。

確認 — `pnpm check` → `0 ERRORS`

### Step 2: `draw()` を矩形だけ読み戻す形にする

`draw()` を次の手順に書き換える。粒を描くループは今のまま（全体に描いてよい。`clearRect` も全体のまま）。

1. 粒を描いたあと、`const box = liquidBox(particles, kind, scale, d, width, height); if (!box) return;`
   （`any` フラグは `box` が `null` かどうかに置き換わるので消す）
2. `const image = c.getImageData(box.x0, box.y0, box.w, box.h);`
3. `const top = new Int32Array(box.w).fill(-1);`
4. ループは `for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++)` にし、`i = (y * box.w + x) * 4 + 3`
5. 絶対座標を作る — `const ay = y + box.y0; const ax = x + box.x0;`。そして
   `top[x]` の比較・代入は相対の `x`/`y` のままでよいが、`depth` と `wx`/`wy` は絶対座標で計算する

   ```ts
   if (top[x] < 0) top[x] = y;
   const depth = (y - top[x]) * unit; // 差なので相対でも同じ
   const rim = Math.min(1, (a - EDGE) / 70);
   const wx = ax * unit;
   const wy = ay * unit;
   ```

   `depth` は `y - top[x]` の差なので相対のままで値が変わらない。`wx`/`wy` はノイズの位相なので
   絶対座標でないと模様が矩形に追従して動いてしまう（ここが間違えやすい）

6. `c.putImageData(image, box.x0, box.y0);`
7. 本 canvas への転写 `ctx.drawImage(this.#canvas!, 0, 0, width / scale, height / scale);` は今のまま
   （矩形の外は `clearRect` で透明）

`draw()` の先頭のコメント `/** ctx は engine の座標（幅 1）がそのまま描ける変換にしておく */` は残す。
矩形に絞る理由を 1 行足す — `// 読み戻しは canvas 全体だと iPad で 1 フレームの予算を超えるので、液体のある矩形だけにする`

確認 — `pnpm check` → `0 ERRORS`、`pnpm lint` → exit 0

### Step 3: 矩形の計算をテストする

`src/lib/games/pin-rescue/liquid.test.ts` を新規に作る（DOM は使わない）。

```ts
import { describe, expect, it } from 'vitest';
import type { Particle } from './engine';
import { liquidBox } from './liquid';

const p = (x: number, y: number, kind: Particle['kind']): Particle => ({ x, y, px: x, py: y, kind, cool: 0 });

describe('liquidBox', () => {
  it('その種類の粒がなければ null', () => {
    expect(liquidBox([p(0.5, 0.5, 'gold')], 'water', 100, 8, 100, 140)).toBeNull();
  });

  it('粒をぼかし玉ごと囲み、canvas の中に切り詰める', () => {
    const box = liquidBox(
      [p(0.02, 0.02, 'water'), p(0.5, 0.5, 'water'), p(0.9, 0.9, 'lava')],
      'water',
      100,
      8,
      100,
      140
    );
    expect(box).toEqual({ x0: 0, y0: 0, w: 54, h: 54 });
  });

  it('canvas の外にはみ出した粒だけなら null', () => {
    expect(liquidBox([p(2, 2, 'water')], 'water', 100, 8, 100, 140)).toBeNull();
  });
});
```

2 つ目の期待値の根拠 — `(0.02 × 100 − 4) = −2 → 0`、`(0.5 × 100 + 4) = 54`。

確認 — `pnpm test:run src/lib/games/pin-rescue` → pass（100 面 + 既存 + 新規 3 件）

### Step 4: 目視で絵が変わっていないことを確かめる

`pnpm dev` で `http://localhost:5173/table-duel/games/pin-rescue` を開く。

- レベル 1（金と… 水のある面まで進めるなら `localStorage.setItem('table-duel:level:pin-rescue', '30')` で
  水とマグマの両方がある面へ）でピンを抜き、水面の白い光の帯・水の中のゆらぎ・マグマの明るい筋と
  黒い皮が、以前と同じ雰囲気で動くことを見る
- 特に、液体が流れて矩形が動くときに **模様が液体と一緒に流れてしまわない**（ノイズは世界座標に
  固定されているので、液体が動いても模様は場所に留まる）ことを見る。流れてしまうなら Step 2 の
  `wx`/`wy` が相対座標になっている

確認 — 上の 2 点。加えて `pnpm verify` → exit 0

## Test plan

- `liquid.test.ts` の 3 件（Step 3）
- 色の計算は目視（Step 4）。canvas のピクセル比較はしない

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `grep -n "getImageData(0, 0, width, height)" src/lib/games/pin-rescue/liquid.ts` が 0 件
- [ ] `grep -n "getImageData(box.x0, box.y0, box.w, box.h)" src/lib/games/pin-rescue/liquid.ts` が 1 件
- [ ] `grep -n "putImageData(image, box.x0, box.y0)" src/lib/games/pin-rescue/liquid.ts` が 1 件
- [ ] `src/lib/games/pin-rescue/liquid.test.ts` が存在し pass
- [ ] Step 4 の目視で模様が世界座標に固定されている
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 005 の Status を更新した

## STOP conditions

- 「Current state」の抜粋と `liquid.ts` が一致しない
- Step 4 で絵が明らかに変わる（水面の帯が消える、マグマの筋が出ない）。矩形の外に液体の縁が
  はみ出している可能性（`d` の見積もりが `R * 4.2 * scale` より大きい）— 報告する
- `getImageData` の矩形が `width`/`height` を超えて例外になる（切り詰めが効いていない）

## Maintenance notes

- `#blob` の大きさ（`R * 4.2`）を変えるときは `liquidBox` の `d` も同じ式を通すこと（`draw()` の中で
  同じ `d` を渡しているので、`d` の計算を 1 か所に保つ）
- レビューでは、`wx`/`wy` が `ax`/`ay`（絶対座標）から作られていることを見る
- さらに速くするなら、水とマグマの 2 回の `draw()` で `clearRect` と粒の描画を 1 回にまとめられるが、
  種類ごとに別の色を塗るので `getImageData` は 2 回要る。まずはこの計画の効果を実機で見る
