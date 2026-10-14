# Plan 057: カメレオンの塗りの面が、すき間へ広げ直す作業用の描き先を描画器ごとに 1 組だけ使う

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/yappari-chameleon/paint-gpu.ts src/lib/games/yappari-chameleon/paint-gpu.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                |
| ---------- | ----------------------------------------------------------------- |
| Priority   | P3                                                                |
| Effort     | S                                                                 |
| Risk       | LOW（`flush()` の中の描き先を共有にするだけ。描く手順は変えない） |
| Depends on | none                                                              |
| Category   | perf                                                              |
| Planned at | commit `36cc037`, 2026-10-14                                      |

## Why this matters

やっぱりカメレオン（2〜3 台の iPad をつないで遊ぶ 3D のかくれんぼ）では、人形の体ごとに塗りの面 `PaintSurface` を 1 つ作る。
自分の体、ほかの人の体（1 人 1 つ）、答え合わせやダブルで置く 2 つめの体（`#pins`）がそれぞれ持つ。

面は塗りそのもの（2048² の色と 1024² の艶）のほかに、同じ大きさの「作業用の描き先」を 1 組ずつ持つ。これは `flush()` の中で
すき間へ色を広げ直すときだけ一瞬使い、すぐ元の描き先へ写し終える。それでも面ごとに 1 組あるので、塗った体 1 つにつき
約 20MB（16MB + 4MB）の GPU メモリが余分に要る。3 人の試合の答え合わせなら体が 5 つ前後になり、約 100MB が使い回せる。

`flush()` は同期で走り、作業用の描き先を毎回全面描き直してから写すので、中身を面どうしで持ち越さない。描画器（WebGL の文脈）
ごとに 1 組を共有しても、描かれる絵は変わらない。iPad Air の WebGL のメモリに余裕を作る。

## Current state

直すファイルは 1 つ、足すテストは 1 つ。

- `src/lib/games/yappari-chameleon/paint-gpu.ts` — 塗りの面 `PaintSurface`。吹き付けをシェーダーで描き、`flush()` ですき間へ色を広げ直す
- `src/lib/games/yappari-chameleon/paint-gpu.test.ts` — 新しく作る

### 面ごとに作業用の描き先を持っている

描き先を作る関数と、面の持ち物は次のとおり（`paint-gpu.ts:100-107`）。

```ts
const target = (size: number, colorSpace: THREE.ColorSpace) =>
  new THREE.WebGLRenderTarget(size, size, {
    colorSpace,
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter
  });
```

`paint-gpu.ts:113-135` の抜粋（作業用は 129-130 行）。

```ts
export class PaintSurface {
  readonly color = target(COLOR_SIZE, THREE.SRGBColorSpace);
  readonly gloss = target(GLOSS_SIZE, THREE.NoColorSpace);
  readonly #renderer: THREE.WebGLRenderer;
  ...
  readonly #scratchColor = target(COLOR_SIZE, THREE.SRGBColorSpace);
  readonly #scratchGloss = target(GLOSS_SIZE, THREE.NoColorSpace);
  readonly #src = { value: null as THREE.Texture | null };
```

作業用を使うのは `flush()` の中だけ（`paint-gpu.ts:220-233`）。

```ts
  /** 塗ったあとの、すき間への色の広げ直し。塗りの変更をまとめて、描く前に 1 回だけ行う */
  flush(): void {
    if (!this.#dirty) return;
    this.#dirty = false;
    for (const [to, scratch] of [
      [this.color, this.#scratchColor],
      [this.gloss, this.#scratchGloss]
    ] as const) {
      this.#src.value = to.texture;
      this.#draw(scratch, this.#dilate);
      this.#src.value = scratch.texture;
      this.#draw(to, this.#copy);
    }
  }
```

`#dilate` は画面いっぱいの三角形 1 枚を `THREE.NoBlending` で描く（`paint-gpu.ts:160-176`）ので、作業用の描き先は毎回すべての画素が
上書きされる。前の中身は結果に効かない。

面を捨てるとき、作業用も捨てている（`paint-gpu.ts:266-270`）。

```ts
  dispose(): void {
    this.color.dispose();
    this.gloss.dispose();
    this.#scratchColor.dispose();
    this.#scratchGloss.dispose();
```

### 面を作る所と捨てる所

- 面は `doll3d.ts:50` の `makeDoll` が 1 体に 1 つ作る（`const paint = new PaintSurface(renderer, paintGeo);`）
- 自分の体は `world3d.ts` の `World` が持ち、毎フレーム `this.rig.paint.flush()`（`world3d.ts:402`）、捨てるのは `World.dispose`（`:421`）
- ほかの人の体と 2 つめの体は `remote.ts` の `Remote` が持ち、`update` の最後で `flush()`（`remote.ts:85`）、`Remote.dispose` で
  `this.rig.paint.dispose()`（`remote.ts:116`）。`Remote.dispose` は試合の途中（ロビーに戻ったときの `#pins` の片付けなど）にも呼ばれ、
  そのあとも同じ描画器でほかの面が描き続ける。だから共有した作業用の描き先は、面の `dispose()` では捨ててはいけない
- 描画器は `World` が 1 つ作り（`world3d.ts:96`）、`World.dispose` の最後で `this.renderer.dispose()` と
  `this.renderer.forceContextLoss()`（`world3d.ts:429-431`）を呼ぶ。文脈ごと失わせるので、その描画器で作った描き先の GPU メモリは
  ここで返る。共有の 1 組を別に捨てる処理は足さない

three の描き先は、初めて `setRenderTarget` で描いたときに GPU の領域を取る。塗っていない体は `flush()` が走らない（`#dirty` が
立たない）ので、今も作業用の領域は取っていない。減るのは塗った体のぶん。

### テストの描画器

GPU の無い node のテストは、何もしない描画器を差す（`doll3d.test.ts:8`）。

```ts
const renderer = new Proxy({}, { get: () => () => ({}) }) as unknown as THREE.WebGLRenderer;
```

`PaintSurface` の `#draw` は `getRenderTarget`・`setRenderTarget`・`render` と `autoClear` の読み書きしか使わないので、
`setRenderTarget` に渡された描き先を記録する同じ形の Proxy で、`flush()` がどの描き先へ描いたかを見られる。

### 規約

コメントは「コードから復元できない WHY」だけを日本語で書く（変更履歴やタスク番号は書かない）。テストの名前は日本語の文にする。

## Commands you will need

| Purpose        | Command                                                                  | Expected on success           |
| -------------- | ------------------------------------------------------------------------ | ----------------------------- |
| このテストだけ | `pnpm exec vitest run src/lib/games/yappari-chameleon/paint-gpu.test.ts` | すべて pass                   |
| カメレオン全部 | `pnpm exec vitest run src/lib/games/yappari-chameleon/`                  | すべて pass                   |
| 型             | `pnpm check`                                                             | `0 ERRORS 0 WARNINGS`、exit 0 |
| 全部           | `pnpm verify`                                                            | exit 0                        |

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/paint-gpu.ts`（作業用の描き先を描画器ごとに共有し、`dispose()` から外す）
- `src/lib/games/yappari-chameleon/paint-gpu.test.ts`（作る）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `world3d.ts` — 描画器を捨てると文脈ごと失われ、共有の描き先の GPU メモリもそこで返るので、捨てる処理を足さない
- `doll3d.ts` / `remote.ts` / `session.svelte.ts` — 面の作り方・捨て方は変えない
- 塗りそのもの（`color` / `gloss`）の大きさや形式。見た目が変わる
- `CHAMELEON_VERSION`（`net.ts`）— 知らせの形も当たりも変わらないので上げない
- CLAUDE.md — `PaintSurface` の仕様の文（`World.render` が毎フレーム `flush()` する）はそのまま正しい

## Git workflow

- ブランチは `advisor/057-chameleon-share-paint-scratch`
- コミットは英語の命令形 1 文で、Co-Authored-By などの trailer は付けない（例 `Share the paint dilation scratch targets per renderer`）
- push しない（`main` への push は本番に自動デプロイされる）

## Steps

### Step 1: 落ちるテストを書く

`src/lib/games/yappari-chameleon/paint-gpu.test.ts` を次の内容で作る。`scratchFor` はまだ無いので、型と import で落ちる。

```ts
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { PaintSurface, scratchFor } from './paint-gpu';

/** 描き先を記録するだけの描画器。GPU が無くても、flush がどの描き先へ描いたかを見られる */
function recorder() {
  const drawn: unknown[] = [];
  const renderer = new Proxy(
    {},
    { get: (_, key) => (key === 'setRenderTarget' ? (t: unknown) => drawn.push(t) : () => null) }
  ) as unknown as THREE.WebGLRenderer;
  return { renderer, drawn };
}

describe('PaintSurface の作業用の描き先', () => {
  it('同じ描画器の 2 つの面は、すき間へ広げ直すときに同じ作業用の描き先へ描く', () => {
    const { renderer, drawn } = recorder();
    const a = new PaintSurface(renderer, new THREE.BufferGeometry());
    const b = new PaintSurface(renderer, new THREE.BufferGeometry());
    const scratch = scratchFor(renderer);
    for (const s of [a, b]) {
      drawn.length = 0;
      s.apply([]);
      s.flush();
      expect(drawn).toContain(scratch.color);
      expect(drawn).toContain(scratch.gloss);
    }
    expect(scratchFor(renderer)).toBe(scratch);
  });

  it('描画器がちがえば、作業用の描き先も別に作る', () => {
    expect(scratchFor(recorder().renderer)).not.toBe(scratchFor(recorder().renderer));
  });

  it('面を捨てても、ほかの面が使う共有の作業用の描き先は捨てない', () => {
    const { renderer } = recorder();
    const a = new PaintSurface(renderer, new THREE.BufferGeometry());
    const scratch = scratchFor(renderer);
    const color = vi.spyOn(scratch.color, 'dispose');
    const gloss = vi.spyOn(scratch.gloss, 'dispose');
    a.dispose();
    expect(color).not.toHaveBeenCalled();
    expect(gloss).not.toHaveBeenCalled();
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/paint-gpu.test.ts` → `scratchFor` が export されていないので FAIL
（`scratchFor is not a function` か import のエラー）。ほかのテストファイルは触っていない。

### Step 2: 作業用の描き先を描画器ごとに 1 組にする

`paint-gpu.ts` を次のように変える。

1. `const target = ...`（100-107 行）のすぐ下に、描画器ごとの 1 組を返す関数を足す。

```ts
/**
 * すき間へ広げ直すときだけ使う作業用の描き先。flush は同期で全面を描き直してからすぐ写すので、中身を持ち越さない。
 * 同じ描画器の面どうしで 1 組を使い回し、体ごとに約 20MB を持たせない。GPU の領域は World が描画器を捨てるときに文脈ごと返る
 */
const scratches = new WeakMap<
  THREE.WebGLRenderer,
  { color: THREE.WebGLRenderTarget; gloss: THREE.WebGLRenderTarget }
>();

export function scratchFor(renderer: THREE.WebGLRenderer) {
  let s = scratches.get(renderer);
  if (!s) {
    s = { color: target(COLOR_SIZE, THREE.SRGBColorSpace), gloss: target(GLOSS_SIZE, THREE.NoColorSpace) };
    scratches.set(renderer, s);
  }
  return s;
}
```

2. `PaintSurface` の `readonly #scratchColor = ...;` と `readonly #scratchGloss = ...;`（129-130 行）を消す。
3. `flush()` を次の形にする（描く手順は同じで、描き先だけ共有のものにする）。

```ts
  flush(): void {
    if (!this.#dirty) return;
    this.#dirty = false;
    const scratch = scratchFor(this.#renderer);
    for (const [to, tmp] of [
      [this.color, scratch.color],
      [this.gloss, scratch.gloss]
    ] as const) {
      this.#src.value = to.texture;
      this.#draw(tmp, this.#dilate);
      this.#src.value = tmp.texture;
      this.#draw(to, this.#copy);
    }
  }
```

4. `dispose()` から `this.#scratchColor.dispose();` と `this.#scratchGloss.dispose();` の 2 行を消す。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/paint-gpu.test.ts` → 3 つとも pass。
`grep -n "scratchColor\|scratchGloss" src/lib/games/yappari-chameleon/paint-gpu.ts` → 何も出ない。

### Step 3: カメレオンのテストと全体の確かめ

塗りの面を使うテスト（`doll3d.test.ts`・`remote.test.ts`・`glow.test.ts`・`gun.test.ts`・`shots.test.ts`・`cpu/senses3d.test.ts`）が
今までどおり通ることを見る。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass。続けて `pnpm verify` → exit 0。

## Test plan

- 足すのは `paint-gpu.test.ts` の 3 つ（同じ描画器の面は同じ作業用の描き先へ描く・描画器ごとに別・面を捨てても共有のものは捨てない）
- 絵が変わらないことは、`flush()` の描く手順（`#dilate` を作業用へ、`#copy` を元へ）を変えないことで保つ。node では GPU の画素を
  読めないので、実機の見た目は Maintenance notes の確かめで見る
- `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/yappari-chameleon/paint-gpu.test.ts` が 3 つ pass
- [ ] `grep -n "scratchColor\|scratchGloss" src/lib/games/yappari-chameleon/paint-gpu.ts` が何も出さない
- [ ] `grep -n "export function scratchFor" src/lib/games/yappari-chameleon/paint-gpu.ts` が 1 行出す
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 057 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `paint-gpu.ts` の `flush()` / `dispose()` / 129-130 行の作業用の描き先が、上の抜粋と違う
- `#dilate` か `#copy` の材質が `THREE.NoBlending` でなくなっている（作業用に前の中身が残り、共有すると面どうしで色が混ざる）
- `flush()` が `await` を含むなど、同期でなくなっている（2 つの面の広げ直しが重なりうる）
- 塗りの面を使う既存のテストが落ち、直すのに `doll3d.ts`・`remote.ts`・`world3d.ts` を変えたくなった
- 複数の `THREE.WebGLRenderer` が同じ WebGL の文脈を共有している所を見つけた（WeakMap の鍵が描画器なので、同じ文脈で 2 組できる。害は無いが計画の前提とずれる）

## Maintenance notes

- 作業用の描き先は描画器ごとに 1 組なので、`flush()` を非同期にしたり、広げ直しの途中でほかの面の `flush()` を呼んだりすると
  色が混ざる。広げ直しを複数のコマに分けるときは、面ごとの作業用に戻す
- `COLOR_SIZE` / `GLOSS_SIZE` を面ごとに変える日が来たら、`scratchFor` の鍵に大きさを足す（今は定数なので描画器だけで足りる）
- 実機（iPad）では、3 人で答え合わせまで遊び、体の塗りの縁に白い点や他人の色が出ないこと、Safari の Web インスペクタの
  「グラフィックス」で WebGL のメモリが体の数ぶん 20MB ずつ増えなくなったことを見る
