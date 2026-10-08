# やっぱりカメレオン 1 段め（1 台の試作） Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本家『めっちゃカメレオン』の「真っ白な人形の体にエアブラシで色を吹き付け、屋敷に溶け込む」ところを、iPad 1 台で触れる試作として作る。

**Architecture:** ゲームは `src/lib/games/yappari-chameleon/` に閉じる。人形の形・UV の升目・塗りの列・色・動きと当たり・ポーズの表・指の振り分け・屋敷の並びは DOM と three を使わない `.ts` に置いて vitest で確かめる。three の側は、人形（`SkinnedMesh`）、塗りのテクスチャへ吹き付けを描くシェーダー、屋敷の組み立て、描画とカメラを持つ。画面は `Chameleon.svelte` が束ね、ボタン・スティック・ポーズの輪・色のパネルを小さな部品に分ける。

**Tech Stack:** SvelteKit（Svelte 5 runes、TypeScript）、three 0.186（WebGL2、`RawShaderMaterial` の GLSL3）、vitest 4（`unit` は node、`dom` は happy-dom）、playwright-core（headless Chrome で撮る）。

**Spec:** `docs/superpowers/specs/2026-10-08-yappari-chameleon-design.md`（本家の仕様は `docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md`）

## Global Constraints

- id は `yappari-chameleon`、名前は「やっぱりカメレオン」。フォルダは `src/lib/games/yappari-chameleon/`。
- three はこのゲームの `load()` から読み込まれる本体の中でだけ import する。一覧画面の import に入れない。
- 1 段めは `SoloMeta`（`players: 1`、`levels: 1`、`ownMenu: true`）で、新しく足す `landscape: true` を付ける。
- 横持ちで遊ぶ。縦持ちのあいだは描画を止めて「よこむきに してね」を出す。
- 一人称（鬼の目）の three の `fov` は縦 72 度に固定する。
- 人形の背の高さは 1.15m。y が上、足もとが y = 0、正面は +z。長さの単位は m。
- 塗りの色のテクスチャは 2048²（sRGB）、メタリックとラフネスのテクスチャは 1024²（linear、G がラフネス、B がメタリック）。白の初期値は色 (1, 1, 1)、ラフネス 0.85、メタリック 0。
- 描画は pet-house に合わせ、`setPixelRatio(Math.min(1.5, devicePixelRatio))`、`antialias: true`、影は 2048² の固定。
- コンポーネントは 200 行未満。抑制コメントは使わない。
- 絵文字は使わない。アイコンは `src/lib/icons.ts` に SVG パスで足し、DOM では `Icon.svelte` で出す。
- コメントは非自明な WHY だけ（隠れた制約・workaround の理由・驚く挙動）。WHAT・変更履歴・タスク番号は書かない。
- HUD と画面の字は白に黒い影の明朝（`font-family: 'Hiragino Mincho ProN', serif`）。漢字まじりで書く。
- 外の素材（画像・モデル・フォント）は使わない。模様は canvas で描く。
- 2 人が同時に触るゲームではないが、指は必ず `pointerdown` と `pointerId` で扱う（スティックと見回しとボタンを同時に使うため）。
- コミットの前に `pnpm format` で整える。計画のコードは読みやすさのために行が長いところがある。
- 各タスクの終わりに `pnpm lint`・`pnpm check`・`pnpm test:run` が通る。最後のタスクで `pnpm verify` を通す。
- ブラウザは built-in browser（`mcp__Claude_Browser__*`）だけを使い、Claude in Chrome は使わない。dev サーバーは `pnpm dev --port 5180` で起動し、`preview_start` には頼らない（5173 はメインの checkout の別プロセスが使っていることがある）。
- 見た目の確かめは headless Chrome（`playwright-core`、`channel: 'chrome'`）で撮る。built-in browser は隠れると `requestAnimationFrame` が止まる。撮るスクリプトは scratchpad に置き、リポジトリには入れない。

## Review Focus

1. 遊んでいる途中で縦持ちと横持ちを行き来する。縦で止まり、横に戻すと canvas の大きさを直して同じところから続く。
2. スティックの指を置いたまま、別の指で見回す・ボタンを押す・指が画面の外へ出る（`pointercancel`）。スティックが戻らずに歩き続けたり、ボタンの指が見回しに化けたりしない。
3. ペイントモードで 1 本めの指を置いた直後に 2 本めを置く。1 本めの指の跡が体に残らない（2 本指はカメラだけを動かす）。
4. iOS がアプリを裏に回して WebGL のコンテキストを失ったあと戻る。塗った体が白に戻らず、塗りの列から作り直される。
5. 張り付いたまま・天井にいるままポーズを変える、ペイントモードに入る、鬼の目に切り替える。体が壁や天井から外れて落ちたり、床に埋まったりしない。

それぞれの確かめは、持ち主のタスクに入れてある（1 と 4 は Task 9 の headless の確かめ、2 と 3 は Task 8 のテスト、5 は Task 6 と Task 11 のテスト）。

---

## ファイルの地図

| ファイル                                   | 持つもの                                                                                                 | タスク |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------ |
| `src/lib/games.ts`                         | `SoloMeta.landscape` と、ゲームの登録                                                                    | 1      |
| `src/lib/components/SoloShell.svelte`      | `landscape` のゲームでは `.stage` に `wide` を付ける                                                     | 1      |
| `src/app.css`                              | 横向きで回す規則から `.wide` を外す                                                                      | 1      |
| `yappari-chameleon/meta.ts`・`Howto.svelte` | 一覧とタイトルの情報                                                                                     | 1      |
| `yappari-chameleon/Chameleon.svelte`       | 画面の束ね（縦持ちの知らせ・読み込み中・遊ぶ画面の部品）                                                 | 1, 9   |
| `yappari-chameleon/doll.ts`                | 人形の形の表・骨・関節・骨の重さ（three なし）                                                           | 2      |
| `yappari-chameleon/atlas.ts`               | 三角形を升に並べた UV と、吹き付け用に広げた三角形（three なし）                                         | 3      |
| `yappari-chameleon/paint.ts`               | 吹き付けの形・筆の運び・塗りの列ともどす（three なし）                                                   | 4      |
| `yappari-chameleon/color.ts`               | HSV と RGB・sRGB と linear・最近使った色・見本の格子                                                     | 4      |
| `yappari-chameleon/paint-gpu.ts`           | 塗りのテクスチャ 2 枚と、吹き付けを描くシェーダー・1 画素の読み出し                                       | 5      |
| `yappari-chameleon/doll3d.ts`              | 人形の `SkinnedMesh`・骨・ポーズを当てる                                                                 | 5, 7   |
| `yappari-chameleon/move.ts`                | 箱と坂の当たり・歩く・走る・ジャンプ・張り付き・向きロック・カメラの線の当たり（three なし）             | 6      |
| `yappari-chameleon/poses.ts`               | ポーズの表（three なし）                                                                                 | 7      |
| `yappari-chameleon/touch.ts`               | 指の振り分け（スティック・見回し・塗る・2 本指のカメラ）（DOM なし）                                     | 8      |
| `yappari-chameleon/world3d.ts`             | three の場面・光・カメラ・描画・ピック                                                                   | 9, 12  |
| `yappari-chameleon/play.svelte.ts`         | 遊ぶ状態（モード・筆・ポーズ・ロック・時計）と 1 フレームの進め方                                         | 9–11   |
| `yappari-chameleon/test-room.ts`           | 受け入れを試す 1 部屋（柄の壁・市松の床・額）                                                            | 9      |
| `yappari-chameleon/Buttons.svelte`         | 右側のボタン                                                                                             | 9, 11  |
| `yappari-chameleon/StickView.svelte`       | スティックの見た目                                                                                       | 9      |
| `yappari-chameleon/PaintPanel.svelte` ほか | 色のパネル（`HueRing.svelte`・`ColorSliders.svelte`・`Swatches.svelte`・`BrushSize.svelte`）             | 10     |
| `yappari-chameleon/PoseWheel.svelte`       | ポーズの輪                                                                                               | 11     |
| `yappari-chameleon/xray.ts`                | 物の陰の自分を丸く透かす材質の書き足し                                                                   | 12     |
| `yappari-chameleon/textures.ts`            | canvas の模様（ダマスク・市松・菱形・木目・羽目板・格天井・絨毯・背表紙・油絵・ポスター・革）と画素の控え | 13     |
| `yappari-chameleon/mansion/layout.ts`      | 大広間と緑の廊下の壁・床・家具の並びと当たりの箱（three なし）                                           | 14     |
| `yappari-chameleon/mansion/build.ts`       | 並びから three の場面を組み立てる                                                                        | 14     |
| `yappari-chameleon/mansion/furniture.ts`   | 家具の形                                                                                                 | 14     |
| `yappari-chameleon/sounds.ts`              | 吹き付け・張り付き・ボタン・時計の音                                                                     | 15     |
| `src/lib/icons.ts`                         | `eye`・`dropper`・`figure`・`lock`・`spin`・`shadow`                                                     | 9      |
| `scripts/thumbs/scenes.ts`・`static/thumbs/yappari-chameleon.webp` | 一覧のカード                                                                     | 1, 15  |
| `CLAUDE.md`                                | ゲームの説明                                                                                             | 15     |

---

### Task 1: ゲームの登録と、横持ちのシェル

**Files:**
- Modify: `src/lib/games.ts`（`SoloMeta` に `landscape` を足し、ゲームを登録する）
- Modify: `src/lib/components/SoloShell.svelte:80`（`<main>` に `class:wide`）
- Modify: `src/app.css:220-230`（横向きで回す規則から `.wide` を外す）
- Modify: `src/lib/components/SoloShell.svelte.test.ts`（`landscape` のテスト）
- Create: `src/lib/games/yappari-chameleon/meta.ts`
- Create: `src/lib/games/yappari-chameleon/Howto.svelte`
- Create: `src/lib/games/yappari-chameleon/Chameleon.svelte`（仮の中身。Task 9 で作り直す）
- Create: `static/thumbs/yappari-chameleon.webp`（仮の絵。Task 15 で撮り直す）

**Interfaces:**
- Produces: `SoloMeta.landscape?: true`。`SoloShell` は `meta.landscape` のとき `<main class="stage solo wide">` にする。
- Produces: `meta.ts` の default export（`id: 'yappari-chameleon'`）。`Chameleon.svelte` は `SoloProps` を受ける。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/components/SoloShell.svelte.test.ts` の `show()` の引数の型に `landscape?: true` を足し、`describe('SoloShell', ...)` の中に次を足す。

```ts
  it('横持ちのゲームでは枠に wide を付け、横向きで回さない', () => {
    const { target, app } = show({ landscape: true });
    expect(target.querySelector('main.stage')?.classList.contains('wide')).toBe(true);
    unmount(app);
  });

  it('ふつうのゲームの枠には wide を付けない', () => {
    const { target, app } = show();
    expect(target.querySelector('main.stage')?.classList.contains('wide')).toBe(false);
    unmount(app);
  });
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/components/SoloShell.svelte.test.ts`
Expected: 1 つめのテストが FAIL（`wide` が付かない）。型の誤りで落ちる場合も、この時点では正しい。

- [ ] **Step 3: `SoloMeta` と `SoloShell` と `app.css` を直す**

`src/lib/games.ts` の `SoloMeta` の `ownMenu?: boolean;` の下に足す。

```ts
  /** 横持ちで遊ぶ。シェルの枠を横向きのタッチ端末で 90 度回さない（端末を手に持って 3D を見回すゲーム） */
  landscape?: true;
```

`src/lib/components/SoloShell.svelte` の `<main class="stage solo" class:settling={settle.active}>` を次にする。

```svelte
<main class="stage solo" class:wide={meta.landscape} class:settling={settle.active}>
```

`src/app.css` の `@media (orientation: landscape) and (pointer: coarse) {` の中の `.stage {` を `.stage:not(.wide) {` にする。

- [ ] **Step 4: ゲームの 3 つのファイルを作る**

`src/lib/games/yappari-chameleon/meta.ts`:

```ts
import type { GameMeta } from '$lib/games';

export default {
  id: 'yappari-chameleon',
  name: 'やっぱりカメレオン',
  description: '真っ白な 体に ペンキを ふきつけて、屋敷に とけこむ かくれんぼ。いまは ひとりで ためせる 試作',
  players: 1,
  levels: 1,
  ownMenu: true,
  landscape: true,
  minutes: 'すきなだけ',
  load: async () => ({
    Game: (await import('./Chameleon.svelte')).default,
    Howto: (await import('./Howto.svelte')).default
  })
} satisfies GameMeta;
```

`src/lib/games/yappari-chameleon/Howto.svelte`:

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
</script>

<span class="howto-rule">体に 色を ふきつけて、屋敷の 模様に とけこもう</span>
<span class="howto-legend">
  <span class="howto-item"><span class="howto-mark"><Icon name="brush" /></span>ペイントで 体を ぬる</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="magnifier" /></span>鬼の目で 見え方を たしかめる</span>
  <span class="howto-item"><span class="howto-mark"><Icon name="devices" /></span>iPad を よこに もって あそぶ</span>
</span>
```

`src/lib/games/yappari-chameleon/Chameleon.svelte`（Task 9 で作り直す仮の中身）:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { SoloProps } from '$lib/games';

  let { onquit }: SoloProps = $props();
  let portrait = $state(false);

  onMount(() => {
    const mq = matchMedia('(orientation: portrait)');
    const sync = () => (portrait = mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  });
</script>

<div class="chameleon">
  {#if portrait}
    <p class="notice">よこむきに してね</p>
  {:else}
    <p class="notice">じゅんびちゅう</p>
  {/if}
  <button class="quit" onclick={() => onquit?.()} aria-label="タイトルへ">✕</button>
</div>

<style>
  .chameleon {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: #1d1a17;
  }

  .notice {
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 28px;
    text-shadow: 0 2px 4px #000;
  }

  .quit {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    width: 48px;
    height: 48px;
    border: 2px solid #fff;
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-size: 22px;
  }
</style>
```

- [ ] **Step 5: 登録して仮の絵を置く**

`src/lib/games.ts` に `import yappariChameleon from './games/yappari-chameleon/meta';` を（アルファベット順の位置に）足し、`games` 配列の先頭に `yappariChameleon,` を足す。

仮のカードの絵（`games.test.ts` が全ゲームに絵を求める）を置く。Task 15 で実際の画面から撮り直す。

```bash
cp static/thumbs/doodle-worm.webp static/thumbs/yappari-chameleon.webp
```

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm vitest run src/lib/components/SoloShell.svelte.test.ts src/lib/games.test.ts && pnpm check && pnpm lint`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add src/lib/games.ts src/lib/components/SoloShell.svelte src/lib/components/SoloShell.svelte.test.ts src/app.css src/lib/games/yappari-chameleon static/thumbs/yappari-chameleon.webp
git commit -m "Add Yappari Chameleon as a landscape solo game"
```

### Task 2: 人形の形と骨

本家の人形（真っ白・頭は球・首はほぼ無し・顔なし・先のすぼまったソーセージの手足・ミトンの手・約 4 頭身）を、`$lib/sculpt.ts` の形の表で 1 枚の面にし、頂点ごとに骨の重さを付ける。three は使わない。

**Files:**
- Create: `src/lib/games/yappari-chameleon/doll.ts`
- Test: `src/lib/games/yappari-chameleon/doll.test.ts`

**Interfaces:**
- Consumes: `$lib/sculpt` の `bounds`・`field`・`mesh`・`Shape`・`V3`・`Surface`。
- Produces:
  - `BONES`（12 本の骨の名前の配列。親が先に並ぶ）と `type Bone`。
  - `JOINTS: Record<Bone, V3>`（骨の付け根の位置）、`PARENT: Record<Bone, Bone | null>`。
  - `HEIGHT = 1.15`、`dollShapes(): Shape[]`。
  - `interface DollSurface extends Surface { skinIndex: Uint16Array; skinWeight: Float32Array }`。
  - `buildDoll(h = 0.011): DollSurface`（`h` は面の細かさ m）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/doll.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BONES, buildDoll, HEIGHT, JOINTS, PARENT } from './doll';

describe('doll', () => {
  // 細かい面は 1 秒ほどかかるので、形を見るテストは粗い面で足りる
  const d = buildDoll(0.02);
  const n = d.pos.length / 3;
  const ys = Array.from({ length: n }, (_, i) => d.pos[i * 3 + 1]);
  const xs = Array.from({ length: n }, (_, i) => d.pos[i * 3]);

  it('背の高さは 1.15m ほどで、足の裏は y = 0 にある', () => {
    expect(Math.min(...ys)).toBeCloseTo(0, 1);
    expect(Math.max(...ys)).toBeGreaterThan(HEIGHT - 0.03);
    expect(Math.max(...ys)).toBeLessThan(HEIGHT + 0.03);
  });

  it('左右が対称', () => {
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs), 2);
  });

  it('どの頂点も骨の重さの和が 1 で、骨の番号は BONES の中にある', () => {
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += d.skinWeight[i * 4 + k];
        expect(d.skinIndex[i * 4 + k]).toBeLessThan(BONES.length);
      }
      expect(sum).toBeCloseTo(1, 4);
    }
  });

  const heaviest = (i: number) => {
    let best = 0;
    for (let k = 1; k < 4; k++) if (d.skinWeight[i * 4 + k] > d.skinWeight[i * 4 + best]) best = k;
    return BONES[d.skinIndex[i * 4 + best]];
  };

  it('頭のてっぺんは head、足の裏は shin、手の先は forearm にいちばん重く付く', () => {
    const top = ys.indexOf(Math.max(...ys));
    const sole = ys.indexOf(Math.min(...ys));
    const tip = xs.indexOf(Math.max(...xs));
    expect(heaviest(top)).toBe('head');
    expect(heaviest(sole)).toMatch(/^shin\./);
    expect(heaviest(tip)).toBe('forearm.l');
  });

  it('骨の親は自分より前に並ぶ', () => {
    BONES.forEach((b, i) => {
      const p = PARENT[b];
      if (p) expect(BONES.indexOf(p)).toBeLessThan(i);
      expect(JOINTS[b]).toHaveLength(3);
    });
  });

  it('遊ぶときの細かさでは 6 千〜2 万の三角形になる', () => {
    const fine = buildDoll();
    const tris = fine.idx.length / 3;
    expect(tris).toBeGreaterThan(6000);
    expect(tris).toBeLessThan(20000);
  }, 20_000);
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/doll.test.ts`
Expected: FAIL（`./doll` が無い）。

- [ ] **Step 3: 作る**

`src/lib/games/yappari-chameleon/doll.ts`:

```ts
import { bounds, field, mesh, type Shape, type Surface, type V3 } from '$lib/sculpt';

/**
 * 本家の白い人形。頭は球で顔は描かず、首はほぼ無く頭が肩にめり込む。手足は先のすぼまったソーセージで、
 * 継ぎ目を見せないよう 1 枚の面にして骨で曲げる。約 4 頭身で背は 1.15m（ダイニングの椅子の背より少し高い）
 */
export const BONES = [
  'hips',
  'spine',
  'chest',
  'head',
  'upperarm.l',
  'forearm.l',
  'upperarm.r',
  'forearm.r',
  'thigh.l',
  'shin.l',
  'thigh.r',
  'shin.r'
] as const;
export type Bone = (typeof BONES)[number];

export const HEIGHT = 1.15;

/** 腕は水平から 35 度下げた形で作る。真横に伸ばした形だと、下ろしたときに肩の面がつぶれる */
export const JOINTS: Record<Bone, V3> = {
  hips: [0, 0.5, 0],
  spine: [0, 0.6, 0],
  chest: [0, 0.72, 0],
  head: [0, 0.88, 0],
  'upperarm.l': [0.15, 0.84, 0],
  'forearm.l': [0.289, 0.743, 0],
  'upperarm.r': [-0.15, 0.84, 0],
  'forearm.r': [-0.289, 0.743, 0],
  'thigh.l': [0.085, 0.47, 0],
  'shin.l': [0.085, 0.26, 0],
  'thigh.r': [-0.085, 0.47, 0],
  'shin.r': [-0.085, 0.26, 0]
};

export const PARENT: Record<Bone, Bone | null> = {
  hips: null,
  spine: 'hips',
  chest: 'spine',
  head: 'chest',
  'upperarm.l': 'chest',
  'forearm.l': 'upperarm.l',
  'upperarm.r': 'chest',
  'forearm.r': 'upperarm.r',
  'thigh.l': 'hips',
  'shin.l': 'thigh.l',
  'thigh.r': 'hips',
  'shin.r': 'thigh.r'
};

const DEPTH: V3 = [1, 1, 0.78];

function side(s: 1 | -1): Shape[] {
  const l = s === 1 ? 'l' : 'r';
  return [
    { a: [0.15 * s, 0.84, 0], cone: { b: [0.289 * s, 0.743, 0], ra: 0.056, rb: 0.05 }, k: 0.04, bone: `upperarm.${l}`, tag: 'arm' },
    { a: [0.289 * s, 0.743, 0], cone: { b: [0.412 * s, 0.657, 0], rb: 0.042, ra: 0.05 }, k: 0.035, bone: `forearm.${l}`, tag: 'arm' },
    { a: [0.445 * s, 0.633, 0], ell: [0.05, 0.055, 0.04], turn: [0, 0, -0.61 * s], k: 0.025, bone: `forearm.${l}`, tag: 'hand' },
    { a: [0.085 * s, 0.5, 0], cone: { b: [0.085 * s, 0.26, 0], ra: 0.072, rb: 0.058 }, k: 0.04, bone: `thigh.${l}`, tag: 'leg' },
    { a: [0.085 * s, 0.26, 0], cone: { b: [0.085 * s, 0.07, 0], ra: 0.058, rb: 0.05 }, k: 0.035, bone: `shin.${l}`, tag: 'leg' },
    { a: [0.085 * s, 0.05, 0.025], ell: [0.055, 0.05, 0.075], k: 0.025, bone: `shin.${l}`, tag: 'foot' }
  ];
}

export function dollShapes(): Shape[] {
  return [
    { a: [0, 1.005, 0], ell: [0.145, 0.145, 0.145], k: 0.04, bone: 'head', tag: 'head' },
    { a: [0, 0.52, 0], ell: [0.15, 0.11, 0.12], k: 0.05, bone: 'hips', tag: 'body' },
    { a: [0, 0.56, 0], cone: { b: [0, 0.68, 0], ra: 0.135, rb: 0.14 }, squash: DEPTH, k: 0.05, bone: 'spine', tag: 'body' },
    { a: [0, 0.68, 0], cone: { b: [0, 0.76, 0], ra: 0.14, rb: 0.14 }, squash: DEPTH, k: 0.05, bone: 'chest', tag: 'body' },
    ...side(1),
    ...side(-1)
  ];
}

export interface DollSurface extends Surface {
  skinIndex: Uint16Array;
  skinWeight: Float32Array;
}

/** 形ごとの距離から骨の重さを決める（pet-house の models.ts と同じ式）。近い形ほど重く、上位 4 本の骨に付ける */
export function buildDoll(h = 0.011): DollSurface {
  const shapes = dollShapes();
  const f = field(shapes);
  const s = mesh(f, bounds(shapes, h * 2), h);
  const n = s.pos.length / 3;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const d = new Float64Array(f.count);
  const perBone = new Float64Array(BONES.length);
  const boneOf = shapes.map((sh) => BONES.indexOf(sh.bone as Bone));
  for (let v = 0; v < n; v++) {
    f.each(s.pos[v * 3], s.pos[v * 3 + 1], s.pos[v * 3 + 2], d);
    let dmin = Infinity;
    for (let i = 0; i < shapes.length; i++) dmin = Math.min(dmin, d[i]);
    perBone.fill(0);
    for (let i = 0; i < shapes.length; i++) {
      const w = Math.max(0, 1 - (d[i] - dmin) / Math.max(shapes[i].k, 0.02)) ** 2;
      perBone[boneOf[i]] += w;
    }
    const top = [...perBone.keys()].sort((a, b) => perBone[b] - perBone[a]).slice(0, 4);
    const total = top.reduce((t, i) => t + perBone[i], 0);
    top.forEach((b, k) => {
      skinIndex[v * 4 + k] = b;
      skinWeight[v * 4 + k] = perBone[b] / total;
    });
  }
  return { ...s, skinIndex, skinWeight };
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/doll.test.ts`
Expected: PASS。手の先のテストが落ちるときは、手の楕円体（`0.445, 0.633`）が前腕の円すいの先より外に出ているかを確かめ、楕円体の位置を前腕の向きに 1cm ずつ外へ出す。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/yappari-chameleon/doll.ts src/lib/games/yappari-chameleon/doll.test.ts
git commit -m "Shape the white doll for Yappari Chameleon"
```

### Task 3: 体の UV の升目

`sculpt.ts` の面には UV が無い。三角形を 2 つずつ 1 つの正方形の升に入れて（升の左下と右上の直角二等辺三角形）、テクスチャに並べる。見せる三角形は升のふちから `GAP` 画素内側へ縮め、吹き付けを描く三角形はそこから `GROW` 画素外へ広げる。広げた分は、骨で曲げる前の 3D の位置も同じ割合で外へ伸ばす（三角形の中の対応は 1 次なので、内心のまわりの拡大は 3D でも同じ拡大になる）。こうすると、バイリニアで読んだときに升のふちの白い画素が混ざらない。

**Files:**
- Create: `src/lib/games/yappari-chameleon/atlas.ts`
- Test: `src/lib/games/yappari-chameleon/atlas.test.ts`

**Interfaces:**
- Consumes: なし（`Float32Array` の位置と `Uint32Array` の三角形の並び）。
- Produces:
  - `GAP = 2`、`GROW = 1.5`（画素）。
  - `interface Atlas { corner: Uint32Array; uv: Float32Array; paintUv: Float32Array; paintPos: Float32Array; cell: number }`。どれも三角形の角ごと（三角形 t の角 k は `t * 3 + k`）。`corner` は元の頂点の番号、`uv`・`paintUv` は 0..1 の 2 つ組、`paintPos` は 3 つ組、`cell` は升の大きさ（画素）。
  - `layAtlas(pos: Float32Array, idx: Uint32Array, size: number): Atlas`。升が 12 画素より小さくなるときは投げる。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/atlas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GAP, GROW, layAtlas } from './atlas';

function fake(tris: number) {
  const pos = new Float32Array(tris * 9);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 0.1;
  for (let i = 0; i < pos.length; i++) pos[i] = rnd();
  const idx = Uint32Array.from({ length: tris * 3 }, (_, i) => i);
  return { pos, idx };
}

const SIZE = 512;

describe('layAtlas', () => {
  const { pos, idx } = fake(301);
  const a = layAtlas(pos, idx, SIZE);
  const tris = idx.length / 3;

  it('どの角もテクスチャの中にある', () => {
    for (const v of a.uv) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThan(1);
    }
    for (const v of a.paintUv) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  // 升の中の座標（画素）と、升の 4 辺・対角線からの距離のいちばん小さいもの
  const margin = (uv: Float32Array, t: number) => {
    const c = t >> 1;
    const per = Math.round(SIZE / a.cell);
    const ox = (c % per) * a.cell;
    const oy = Math.floor(c / per) * a.cell;
    let m = Infinity;
    for (let k = 0; k < 3; k++) {
      const x = uv[(t * 3 + k) * 2] * SIZE - ox;
      const y = uv[(t * 3 + k) * 2 + 1] * SIZE - oy;
      const diag = (t & 1 ? x + y - a.cell : a.cell - x - y) / Math.SQRT2;
      m = Math.min(m, x, y, a.cell - x, a.cell - y, diag);
    }
    return m;
  };

  it('見せる三角形は升のふちと対角線から GAP 画素離れる', () => {
    for (let t = 0; t < tris; t++) expect(margin(a.uv, t)).toBeGreaterThan(GAP - 1e-3);
  });

  it('吹き付けの三角形は隣とは重ならない（GAP − GROW 画素残る）', () => {
    for (let t = 0; t < tris; t++) expect(margin(a.paintUv, t)).toBeGreaterThan(GAP - GROW - 1e-3);
  });

  it('吹き付けの角の 3D の位置は、見せる三角形の上の同じ点を元の三角形へ写したもの', () => {
    for (let t = 0; t < tris; t += 17) {
      const u = (k: number) => [a.uv[(t * 3 + k) * 2], a.uv[(t * 3 + k) * 2 + 1]];
      const [p0, p1, p2] = [u(0), u(1), u(2)];
      const det = (p1[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (p1[1] - p0[1]);
      for (let k = 0; k < 3; k++) {
        const q = [a.paintUv[(t * 3 + k) * 2], a.paintUv[(t * 3 + k) * 2 + 1]];
        const b1 = ((q[0] - p0[0]) * (p2[1] - p0[1]) - (p2[0] - p0[0]) * (q[1] - p0[1])) / det;
        const b2 = ((p1[0] - p0[0]) * (q[1] - p0[1]) - (q[0] - p0[0]) * (p1[1] - p0[1])) / det;
        const b0 = 1 - b1 - b2;
        for (let j = 0; j < 3; j++) {
          const want =
            b0 * pos[a.corner[t * 3] * 3 + j] + b1 * pos[a.corner[t * 3 + 1] * 3 + j] + b2 * pos[a.corner[t * 3 + 2] * 3 + j];
          expect(a.paintPos[(t * 3 + k) * 3 + j]).toBeCloseTo(want, 5);
        }
      }
    }
  });

  it('角の頂点の番号は元の並びのまま', () => {
    expect(Array.from(a.corner)).toEqual(Array.from(idx));
  });

  it('升が小さすぎるときは投げる', () => {
    const big = fake(8000);
    expect(() => layAtlas(big.pos, big.idx, 256)).toThrow();
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/atlas.test.ts`
Expected: FAIL（`./atlas` が無い）。

- [ ] **Step 3: 作る**

`src/lib/games/yappari-chameleon/atlas.ts`:

```ts
/** 見せる三角形を升のふちから縮める画素と、吹き付けの三角形をそこから広げる画素 */
export const GAP = 2;
export const GROW = 1.5;

export interface Atlas {
  corner: Uint32Array;
  uv: Float32Array;
  paintUv: Float32Array;
  paintPos: Float32Array;
  cell: number;
}

/** 直角二等辺三角形の内心の重み。角 0 が直角で、向かいの辺の長さ（√2 : 1 : 1）に比例する */
const W = [Math.SQRT2, 1, 1].map((w) => w / (2 + Math.SQRT2));

/**
 * 三角形を 2 つずつ正方形の升に入れて並べる。升の中の形は元の三角形の形によらず同じなので、
 * 画素の細かさは三角形ごとに少し違うが、吹き付けは 3D の距離で描くので模様はゆがまない
 */
export function layAtlas(pos: Float32Array, idx: Uint32Array, size: number): Atlas {
  const tris = idx.length / 3;
  const per = Math.ceil(Math.sqrt(Math.ceil(tris / 2)));
  const cell = size / per;
  if (cell < 12) throw new Error(`atlas cell ${cell.toFixed(1)}px is too small`);
  const inr = (cell * (2 - Math.SQRT2)) / 2;
  const show = (inr - GAP) / inr;
  const paint = (inr - GAP + GROW) / inr;
  const out: Atlas = {
    corner: new Uint32Array(idx),
    uv: new Float32Array(tris * 6),
    paintUv: new Float32Array(tris * 6),
    paintPos: new Float32Array(tris * 9),
    cell
  };
  for (let t = 0; t < tris; t++) {
    const c = t >> 1;
    const ox = (c % per) * cell;
    const oy = Math.floor(c / per) * cell;
    const base =
      t & 1
        ? [
            [cell, cell],
            [0, cell],
            [cell, 0]
          ]
        : [
            [0, 0],
            [cell, 0],
            [0, cell]
          ];
    const ix = W[0] * base[0][0] + W[1] * base[1][0] + W[2] * base[2][0];
    const iy = W[0] * base[0][1] + W[1] * base[1][1] + W[2] * base[2][1];
    const i3 = [0, 1, 2].map((j) => W.reduce((s, w, k) => s + w * pos[idx[t * 3 + k] * 3 + j], 0));
    for (let k = 0; k < 3; k++) {
      const at = t * 3 + k;
      const [bx, by] = base[k];
      out.uv[at * 2] = (ox + ix + (bx - ix) * show) / size;
      out.uv[at * 2 + 1] = (oy + iy + (by - iy) * show) / size;
      out.paintUv[at * 2] = (ox + ix + (bx - ix) * paint) / size;
      out.paintUv[at * 2 + 1] = (oy + iy + (by - iy) * paint) / size;
      for (let j = 0; j < 3; j++)
        out.paintPos[at * 3 + j] = i3[j] + (pos[idx[at] * 3 + j] - i3[j]) * (paint / show);
    }
  }
  return out;
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/atlas.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/yappari-chameleon/atlas.ts src/lib/games/yappari-chameleon/atlas.test.ts
git commit -m "Lay the doll's triangles out in a paint atlas"
```

### Task 4: 吹き付けの列と色

塗りは「どこに・どの大きさで・どの色で・どの濃さで・どの艶で」の吹き付けの列で持つ。列があれば、いつでも白から作り直せる（もどす・WebGL のコンテキストが戻ったとき・2 段めで相手の端末）。three は使わない。

**Files:**
- Create: `src/lib/games/yappari-chameleon/color.ts`
- Create: `src/lib/games/yappari-chameleon/paint.ts`
- Test: `src/lib/games/yappari-chameleon/color.test.ts`
- Test: `src/lib/games/yappari-chameleon/paint.test.ts`

**Interfaces:**
- Produces（`color.ts`）:
  - `type RGB = [number, number, number]`（sRGB の 0..1）。
  - `hsvToRgb(h: number, s: number, v: number): RGB`（h は 0..360、s と v は 0..1）、`rgbToHsv(c: RGB): [number, number, number]`。
  - `srgbToLinear(v: number): number`、`toHex(c: RGB): string`（`#rrggbb`）、`fromHex(hex: string): RGB`。
  - `pushRecent(list: RGB[], c: RGB): RGB[]`（同じ色は先頭へ移し、8 色まで）。
  - `SWATCHES: string[]`（14 × 3 = 42 色の `#rrggbb`）。
- Produces（`paint.ts`）:
  - `interface Brush { radius: number; color: RGB; opacity: number; metal: number; rough: number }`。
  - `interface Hit { p: V3; n: V3 }`（骨で曲げる前の体の上の点と法線）。
  - `interface Dab { p: V3; n: V3; r: number; c: RGB; a: number; m: number; ro: number }`。
  - `FLOW = 0.3`、`UNDO = 30`、`RADIUS: readonly [0.005, 0.25]`、`spacing(r: number): number`。
  - `dab(h: Hit, b: Brush): Dab`、`class Stroke { constructor(brush: Brush); to(h: Hit): Dab[] }`。
  - `class PaintLog { dabs: Dab[]; begin(): void; add(list: Dab[]): void; get canUndo(): boolean; undo(): boolean; cancel(): boolean; clear(): void }`。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/color.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { fromHex, hsvToRgb, pushRecent, rgbToHsv, srgbToLinear, SWATCHES, toHex, type RGB } from './color';

describe('color', () => {
  it('HSV と RGB を行き来しても色が変わらない', () => {
    for (const c of [[1, 0, 0], [0.2, 0.5, 0.9], [0.95, 0.95, 0.95], [0, 0, 0], [0.3, 0.3, 0.1]] as RGB[]) {
      const back = hsvToRgb(...rgbToHsv(c));
      back.forEach((v, i) => expect(v).toBeCloseTo(c[i], 6));
    }
  });

  it('色相の 0・120・240 は赤・緑・青', () => {
    expect(hsvToRgb(0, 1, 1)).toEqual([1, 0, 0]);
    expect(hsvToRgb(120, 1, 1)).toEqual([0, 1, 0]);
    expect(hsvToRgb(240, 1, 1)).toEqual([0, 0, 1]);
  });

  it('sRGB の 0.5 は linear の 0.214 ほど', () => {
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214, 3);
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 6);
  });

  it('16 進と行き来できる', () => {
    expect(toHex([1, 0.5, 0])).toBe('#ff8000');
    expect(fromHex('#ff8000')[1]).toBeCloseTo(128 / 255, 6);
  });

  it('最近使った色は同じ色を先頭へ移し、8 色まで', () => {
    let list: RGB[] = [];
    for (let i = 0; i < 10; i++) list = pushRecent(list, [i / 10, 0, 0]);
    expect(list).toHaveLength(8);
    expect(list[0][0]).toBeCloseTo(0.9);
    list = pushRecent(list, [0.5, 0, 0]);
    expect(list[0][0]).toBeCloseTo(0.5);
    expect(list).toHaveLength(8);
  });

  it('見本は 42 色の #rrggbb', () => {
    expect(SWATCHES).toHaveLength(42);
    for (const s of SWATCHES) expect(s).toMatch(/^#[0-9a-f]{6}$/);
  });
});
```

`src/lib/games/yappari-chameleon/paint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dab, FLOW, PaintLog, spacing, Stroke, UNDO, type Brush, type Hit } from './paint';

const brush: Brush = { radius: 0.02, color: [1, 0, 0], opacity: 0.8, metal: 0, rough: 0.85 };
const at = (x: number): Hit => ({ p: [x, 1, 0], n: [0, 0, 1] });

describe('Stroke', () => {
  it('最初の点に 1 つ置き、そのあとは間隔ごとに置く', () => {
    const s = new Stroke(brush);
    const out = [...s.to(at(0)), ...s.to(at(0.1))];
    expect(out).toHaveLength(Math.floor(0.1 / spacing(0.02)) + 1);
    expect(out[1].p[0]).toBeCloseTo(spacing(0.02), 6);
  });

  it('細かく分けてなぞっても、一度になぞったのと同じ場所に置く', () => {
    const a = new Stroke(brush);
    const one = [...a.to(at(0)), ...a.to(at(0.1))].map((d) => d.p[0]);
    const b = new Stroke(brush);
    const many = [...b.to(at(0))];
    for (let i = 1; i <= 50; i++) many.push(...b.to(at(i * 0.002)));
    expect(many.map((d) => d.p[0])).toHaveLength(one.length);
    many.forEach((d, i) => expect(d.p[0]).toBeCloseTo(one[i], 6));
  });

  it('遠くへ飛んだら、あいだを埋めずにそこへ 1 つ置く', () => {
    const s = new Stroke(brush);
    s.to(at(0));
    const out = s.to(at(0.5));
    expect(out).toHaveLength(1);
    expect(out[0].p[0]).toBeCloseTo(0.5);
  });

  it('1 回の濃さは不透明度の FLOW 倍で、色と艶は筆のまま', () => {
    const d = dab(at(0), brush);
    expect(d.a).toBeCloseTo(0.8 * FLOW);
    expect(d.c).toEqual([1, 0, 0]);
    expect(d.ro).toBe(0.85);
    expect(d.r).toBe(0.02);
  });
});

describe('PaintLog', () => {
  const stroke = (log: PaintLog, n: number) => {
    log.begin();
    log.add(Array.from({ length: n }, () => dab(at(0), brush)));
  };

  it('もどすで最後のひと筆の前に戻る', () => {
    const log = new PaintLog();
    stroke(log, 3);
    stroke(log, 5);
    expect(log.undo()).toBe(true);
    expect(log.dabs).toHaveLength(3);
    expect(log.undo()).toBe(true);
    expect(log.dabs).toHaveLength(0);
    expect(log.undo()).toBe(false);
  });

  it('もどせるのは新しい 30 本まで', () => {
    const log = new PaintLog();
    for (let i = 0; i < UNDO + 5; i++) stroke(log, 1);
    let n = 0;
    while (log.undo()) n++;
    expect(n).toBe(UNDO);
    expect(log.dabs).toHaveLength(5);
  });

  it('描きかけの取り消しは、もどせる本数を減らさない', () => {
    const log = new PaintLog();
    for (let i = 0; i < UNDO; i++) stroke(log, 1);
    stroke(log, 4);
    expect(log.cancel()).toBe(true);
    expect(log.dabs).toHaveLength(UNDO);
    let n = 0;
    while (log.undo()) n++;
    expect(n).toBe(UNDO);
  });

  it('消すと何も残らない', () => {
    const log = new PaintLog();
    stroke(log, 2);
    log.clear();
    expect(log.dabs).toHaveLength(0);
    expect(log.canUndo).toBe(false);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/color.test.ts src/lib/games/yappari-chameleon/paint.test.ts`
Expected: FAIL（モジュールが無い）。

- [ ] **Step 3: `color.ts` を作る**

```ts
export type RGB = [number, number, number];

export function hsvToRgb(h: number, s: number, v: number): RGB {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

export function rgbToHsv([r, g, b]: RGB): [number, number, number] {
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}

export function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function toHex(c: RGB): string {
  return '#' + c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const same = (a: RGB, b: RGB) => a.every((v, i) => Math.abs(v - b[i]) < 0.5 / 255);

export function pushRecent(list: RGB[], c: RGB): RGB[] {
  return [c, ...list.filter((x) => !same(x, c))].slice(0, 8);
}

/** 本家のパレットの見本の格子（14 色 × 3 段）。1 段めは白黒と木と金、2 段めは強い色、3 段めは淡い色と屋敷の壁紙の色 */
export const SWATCHES = [
  '#ffffff', '#e6e6e6', '#bdbdbd', '#8f8f8f', '#5e5e5e', '#333333', '#111111',
  '#5a3a22', '#8b5a2b', '#c08a4a', '#e8c89a', '#f3e6c8', '#d4af37', '#b87333',
  '#c62828', '#e65100', '#f9a825', '#fdd835', '#7cb342', '#2e7d32', '#00897b',
  '#00acc1', '#1e88e5', '#283593', '#5e35b1', '#8e24aa', '#d81b60', '#f06292',
  '#f8bbd0', '#ffccbc', '#ffe0b2', '#fff9c4', '#dcedc8', '#a5d6a7', '#80cbc4',
  '#b2ebf2', '#bbdefb', '#c5cae9', '#d1c4e9', '#3e5b3a', '#2f4f6f', '#7a1f2b'
];
```

- [ ] **Step 4: `paint.ts` を作る**

```ts
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';

export interface Brush {
  radius: number;
  color: RGB;
  opacity: number;
  metal: number;
  rough: number;
}

export interface Hit {
  p: V3;
  n: V3;
}

export interface Dab {
  p: V3;
  n: V3;
  r: number;
  c: RGB;
  a: number;
  m: number;
  ro: number;
}

/** 1 回の吹き付けの濃さ（不透明度に掛ける）。重ねて吹くほど濃くなるエアブラシにする */
export const FLOW = 0.3;
export const UNDO = 30;
export const RADIUS = [0.005, 0.25] as const;

export const spacing = (r: number) => Math.max(0.002, r * 0.3);

export function dab(h: Hit, b: Brush): Dab {
  return { p: h.p, n: h.n, r: b.radius, c: b.color, a: b.opacity * FLOW, m: b.metal, ro: b.rough };
}

/** 体の別のところ（腕から胴など）へ指が飛んだとみなす距離。あいだの空中を塗らない */
const JUMP = 0.3;

/** 1 本の筆の運び。前の吹き付けから一定の間隔で置くので、速くなぞっても遅くなぞっても同じ濃さになる */
export class Stroke {
  #last: Hit | null = null;
  #carry = 0;

  constructor(readonly brush: Brush) {}

  to(h: Hit): Dab[] {
    const last = this.#last;
    this.#last = h;
    const d = last ? Math.hypot(h.p[0] - last.p[0], h.p[1] - last.p[1], h.p[2] - last.p[2]) : 0;
    if (!last || d > JUMP) {
      this.#carry = 0;
      return [dab(h, this.brush)];
    }
    const step = spacing(this.brush.radius);
    const out: Dab[] = [];
    let s = step - this.#carry;
    for (; s <= d; s += step) {
      const t = s / d;
      const n = [0, 1, 2].map((i) => last.n[i] + (h.n[i] - last.n[i]) * t);
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      out.push(
        dab(
          {
            p: [0, 1, 2].map((i) => last.p[i] + (h.p[i] - last.p[i]) * t) as unknown as V3,
            n: [n[0] / len, n[1] / len, n[2] / len]
          },
          this.brush
        )
      );
    }
    this.#carry = d - (s - step);
    return out;
  }
}

export class PaintLog {
  dabs: Dab[] = [];
  #starts: number[] = [];
  /** あと何本もどせるか。描きかけを取り消したときに戻せるよう、筆を始める前の値も持つ */
  #budget = 0;
  #before = 0;

  begin(): void {
    this.#starts.push(this.dabs.length);
    this.#before = this.#budget;
    this.#budget = Math.min(UNDO, this.#budget + 1);
  }

  add(list: Dab[]): void {
    for (const d of list) this.dabs.push(d);
  }

  get canUndo(): boolean {
    return this.#budget > 0 && this.#starts.length > 0;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    this.dabs.length = this.#starts.pop()!;
    this.#budget--;
    return true;
  }

  cancel(): boolean {
    if (!this.#starts.length) return false;
    this.dabs.length = this.#starts.pop()!;
    this.#budget = this.#before;
    return true;
  }

  clear(): void {
    this.dabs = [];
    this.#starts = [];
    this.#budget = this.#before = 0;
  }
}
```

- [ ] **Step 5: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/color.test.ts src/lib/games/yappari-chameleon/paint.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/yappari-chameleon/color.ts src/lib/games/yappari-chameleon/paint.ts src/lib/games/yappari-chameleon/*.test.ts
git commit -m "Record airbrush dabs with undo and color helpers"
```

### Task 5: 塗りのテクスチャと three の人形

体の色を 2048² の sRGB のテクスチャに、メタリックとラフネスを 1024² のテクスチャに持つ。吹き付けは、体の面を UV の位置に描くシェーダーで、画素の 3D の位置と吹き付けの中心の距離から色を混ぜる（16 個ずつまとめて 1 回で描く）。人形は `SkinnedMesh` で、角ごとに分けた面（三角形ごとに UV が違うので頂点を共有できない）に塗りのテクスチャを貼る。

**Files:**
- Create: `src/lib/games/yappari-chameleon/paint-gpu.ts`
- Create: `src/lib/games/yappari-chameleon/doll3d.ts`
- Create（リポジトリに入れない）: `<scratchpad>/gpu-check.mjs`

**Interfaces:**
- Consumes: `buildDoll`・`DollSurface`・`BONES`・`JOINTS`・`PARENT`・`Bone`（Task 2）、`layAtlas`・`Atlas`（Task 3）、`Dab`・`Hit`（Task 4）、`srgbToLinear`・`RGB`（Task 4）。
- Produces（`paint-gpu.ts`）:
  - `COLOR_SIZE = 2048`、`GLOSS_SIZE = 1024`、`WHITE_ROUGH = 0.85`。
  - `class PaintSurface { readonly color: THREE.WebGLRenderTarget; readonly gloss: THREE.WebGLRenderTarget; constructor(renderer: THREE.WebGLRenderer, geo: THREE.BufferGeometry); reset(): void; apply(dabs: readonly Dab[]): void; rebuild(dabs: readonly Dab[]): void; read(uv: { x: number; y: number }): { color: RGB; metal: number; rough: number }; dispose(): void }`。`geo` は `puv`（vec2）・`ppos`（vec3）・`pnrm`（vec3）の属性を持つ。
- Produces（`doll3d.ts`）:
  - `interface DollRig { root: THREE.Group; mesh: THREE.SkinnedMesh; bones: Record<Bone, THREE.Bone>; paint: PaintSurface; material: THREE.MeshStandardMaterial }`。
  - `makeDoll(renderer: THREE.WebGLRenderer, s: DollSurface, a: Atlas): DollRig`。`root` の原点が足もと（y = 0）で、正面は +z。
  - `restHit(rig: DollRig, hit: THREE.Intersection): Hit | null`（体の上の当たりを、骨で曲げる前の点と法線にする）。

- [ ] **Step 1: `paint-gpu.ts` を作る**

```ts
import * as THREE from 'three';
import { srgbToLinear, type RGB } from './color';
import type { Dab } from './paint';

export const COLOR_SIZE = 2048;
export const GLOSS_SIZE = 1024;
export const WHITE_ROUGH = 0.85;
const BATCH = 16;

const VERTEX = `
precision highp float;
in vec2 puv;
in vec3 ppos;
in vec3 pnrm;
out vec3 vPos;
out vec3 vNrm;
void main() {
  vPos = ppos;
  vNrm = pnrm;
  gl_Position = vec4(puv * 2.0 - 1.0, 0.0, 1.0);
}`;

// 16 個の吹き付けを古い順に重ね、前乗算のアルファで出す。描く先とは ONE, ONE_MINUS_SRC_ALPHA で混ぜる
const FRAGMENT = `
precision highp float;
uniform int uCount;
uniform vec4 uP[${BATCH}];
uniform vec4 uN[${BATCH}];
uniform vec4 uC[${BATCH}];
in vec3 vPos;
in vec3 vNrm;
out vec4 outColor;
void main() {
  vec3 n = normalize(vNrm);
  vec3 c = vec3(0.0);
  float a = 0.0;
  for (int i = 0; i < ${BATCH}; i++) {
    if (i >= uCount) break;
    float r = uP[i].w;
    float d = distance(vPos, uP[i].xyz);
    // 裏を向いた面（腕の向こう側など）には付けない
    float k = uC[i].a * (1.0 - smoothstep(r * 0.35, r, d)) * smoothstep(0.0, 0.35, dot(n, uN[i].xyz));
    c = c * (1.0 - k) + uC[i].rgb * k;
    a = a * (1.0 - k) + k;
  }
  outColor = vec4(c, a);
}`;

const FILL_VERTEX = `
precision highp float;
in vec2 fpos;
void main() { gl_Position = vec4(fpos, 0.0, 1.0); }`;

const FILL_FRAGMENT = `
precision highp float;
uniform vec4 uFill;
out vec4 outColor;
void main() { outColor = uFill; }`;

const target = (size: number, colorSpace: THREE.ColorSpace) =>
  new THREE.WebGLRenderTarget(size, size, {
    colorSpace,
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter
  });

/**
 * 人形の塗り。色の先は sRGB の 8 bit にするので、シェーダーは linear の色を書き、
 * 混ぜるのも linear で行われる（WebGL2 の sRGB の描き先）。読み出すと sRGB の値が返る
 */
export class PaintSurface {
  readonly color = target(COLOR_SIZE, THREE.SRGBColorSpace);
  readonly gloss = target(GLOSS_SIZE, THREE.NoColorSpace);
  readonly #renderer: THREE.WebGLRenderer;
  readonly #camera = new THREE.Camera();
  readonly #paint = new THREE.Scene();
  readonly #fill = new THREE.Scene();
  readonly #u = {
    uCount: { value: 0 },
    uP: { value: Array.from({ length: BATCH }, () => new THREE.Vector4()) },
    uN: { value: Array.from({ length: BATCH }, () => new THREE.Vector4()) },
    uC: { value: Array.from({ length: BATCH }, () => new THREE.Vector4()) }
  };
  readonly #fillColor = { value: new THREE.Vector4() };
  readonly #pixel = new Uint8Array(4);

  constructor(renderer: THREE.WebGLRenderer, geo: THREE.BufferGeometry) {
    this.#renderer = renderer;
    const paint = new THREE.Mesh(
      geo,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        uniforms: this.#u,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor
      })
    );
    paint.frustumCulled = false;
    this.#paint.add(paint);
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('fpos', new THREE.BufferAttribute(new Float32Array([-1, -1, 3, -1, -1, 3]), 2));
    const fill = new THREE.Mesh(
      tri,
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: FILL_VERTEX,
        fragmentShader: FILL_FRAGMENT,
        uniforms: { uFill: this.#fillColor },
        depthTest: false,
        depthWrite: false,
        blending: THREE.NoBlending
      })
    );
    fill.frustumCulled = false;
    this.#fill.add(fill);
    this.reset();
  }

  #draw(to: THREE.WebGLRenderTarget, scene: THREE.Scene) {
    const r = this.#renderer;
    const before = r.getRenderTarget();
    const auto = r.autoClear;
    // autoClear のままだと、描くたびに今までの塗りを消してしまう
    r.autoClear = false;
    r.setRenderTarget(to);
    r.render(scene, this.#camera);
    r.setRenderTarget(before);
    r.autoClear = auto;
  }

  reset(): void {
    this.#fillColor.value.set(1, 1, 1, 1);
    this.#draw(this.color, this.#fill);
    this.#fillColor.value.set(0, WHITE_ROUGH, 0, 1);
    this.#draw(this.gloss, this.#fill);
  }

  apply(dabs: readonly Dab[]): void {
    const u = this.#u;
    for (let at = 0; at < dabs.length; at += BATCH) {
      const list = dabs.slice(at, at + BATCH);
      u.uCount.value = list.length;
      list.forEach((d, i) => {
        u.uP.value[i].set(d.p[0], d.p[1], d.p[2], d.r);
        u.uN.value[i].set(d.n[0], d.n[1], d.n[2], 0);
        u.uC.value[i].set(srgbToLinear(d.c[0]), srgbToLinear(d.c[1]), srgbToLinear(d.c[2]), d.a);
      });
      this.#draw(this.color, this.#paint);
      list.forEach((d, i) => u.uC.value[i].set(0, d.ro, d.m, d.a));
      this.#draw(this.gloss, this.#paint);
    }
  }

  rebuild(dabs: readonly Dab[]): void {
    this.reset();
    this.apply(dabs);
  }

  read(uv: { x: number; y: number }): { color: RGB; metal: number; rough: number } {
    const px = this.#pixel;
    const at = (size: number, v: number) => Math.min(size - 1, Math.max(0, Math.floor(v * size)));
    this.#renderer.readRenderTargetPixels(this.color, at(COLOR_SIZE, uv.x), at(COLOR_SIZE, uv.y), 1, 1, px);
    const color: RGB = [px[0] / 255, px[1] / 255, px[2] / 255];
    this.#renderer.readRenderTargetPixels(this.gloss, at(GLOSS_SIZE, uv.x), at(GLOSS_SIZE, uv.y), 1, 1, px);
    return { color, rough: px[1] / 255, metal: px[2] / 255 };
  }

  dispose(): void {
    this.color.dispose();
    this.gloss.dispose();
    for (const s of [this.#paint, this.#fill])
      s.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
  }
}
```

- [ ] **Step 2: `doll3d.ts` を作る**

```ts
import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import type { Atlas } from './atlas';
import { BONES, JOINTS, PARENT, type Bone, type DollSurface } from './doll';
import type { Hit } from './paint';
import { PaintSurface } from './paint-gpu';

export interface DollRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: Record<Bone, THREE.Bone>;
  paint: PaintSurface;
  material: THREE.MeshStandardMaterial;
}

/** 三角形ごとに UV が違うので、頂点を共有せず角ごとに分けた面にする（法線は元の頂点のままなので丸く見える） */
export function makeDoll(renderer: THREE.WebGLRenderer, s: DollSurface, a: Atlas): DollRig {
  const n = a.corner.length;
  const pos = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  for (let k = 0; k < n; k++) {
    const v = a.corner[k];
    pos.set(s.pos.subarray(v * 3, v * 3 + 3), k * 3);
    nrm.set(s.nrm.subarray(v * 3, v * 3 + 3), k * 3);
    skinIndex.set(s.skinIndex.subarray(v * 4, v * 4 + 4), k * 4);
    skinWeight.set(s.skinWeight.subarray(v * 4, v * 4 + 4), k * 4);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(a.uv, 2));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));

  const paintGeo = new THREE.BufferGeometry();
  paintGeo.setAttribute('puv', new THREE.BufferAttribute(a.paintUv, 2));
  paintGeo.setAttribute('ppos', new THREE.BufferAttribute(a.paintPos, 3));
  paintGeo.setAttribute('pnrm', new THREE.BufferAttribute(nrm, 3));
  const paint = new PaintSurface(renderer, paintGeo);

  const root = new THREE.Group();
  const bones = Object.fromEntries(BONES.map((b) => [b, new THREE.Bone()])) as Record<Bone, THREE.Bone>;
  for (const b of BONES) {
    const p = PARENT[b];
    const at = JOINTS[b];
    bones[b].name = b;
    if (p) {
      const pa = JOINTS[p];
      bones[b].position.set(at[0] - pa[0], at[1] - pa[1], at[2] - pa[2]);
      bones[p].add(bones[b]);
    } else {
      bones[b].position.set(...at);
      root.add(bones[b]);
    }
  }
  root.updateMatrixWorld(true);
  const material = new THREE.MeshStandardMaterial({
    map: paint.color.texture,
    roughnessMap: paint.gloss.texture,
    metalnessMap: paint.gloss.texture,
    roughness: 1,
    metalness: 1
  });
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.bind(new THREE.Skeleton(BONES.map((b) => bones[b])), new THREE.Matrix4());
  // 骨で曲げた形は元の外接球からはみ出すので、画面の端で消えないよう切り捨てない
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return { root, mesh, bones, paint, material };
}

export function restHit(rig: DollRig, hit: THREE.Intersection): Hit | null {
  if (hit.object !== rig.mesh || !hit.face || !hit.barycoord) return null;
  const { a, b, c } = hit.face;
  const w = hit.barycoord;
  const pos = rig.mesh.geometry.attributes.position;
  const nrm = rig.mesh.geometry.attributes.normal;
  const mix = (attr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, j: number) =>
    attr.getComponent(a, j) * w.x + attr.getComponent(b, j) * w.y + attr.getComponent(c, j) * w.z;
  const p: V3 = [mix(pos, 0), mix(pos, 1), mix(pos, 2)];
  const nv = new THREE.Vector3(mix(nrm, 0), mix(nrm, 1), mix(nrm, 2)).normalize();
  return { p, n: [nv.x, nv.y, nv.z] };
}
```

- [ ] **Step 3: 型と lint を通す**

Run: `pnpm format && pnpm check && pnpm lint`
Expected: PASS。

- [ ] **Step 4: headless Chrome で塗りを確かめるスクリプトを書く**

scratchpad に `gpu-check.mjs` を書く（リポジトリには入れない）。dev サーバーを `pnpm dev --port 5180` で起動しておく。three は、ゲームの部品が読んでいるのと同じ URL を、Vite が書き換えた部品のソースから探して読む（別の URL で読むと three が 2 つになる）。

```js
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const REPO = '/Users/oekazuma/localRepo/asobibako/.claude/worktrees/meccha-chameleon-clone-51ef75';
const OUT = process.argv[2] ?? '.';
const require = createRequire(`${REPO}/package.json`);
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
const ctx = await browser.newContext({ bypassCSP: true, viewport: { width: 1180, height: 820 } });
const page = await ctx.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
await page.goto('http://localhost:5180/asobibako/', { waitUntil: 'networkidle' });
const result = await page.evaluate(async () => {
  const base = '/asobibako/src/lib/games/yappari-chameleon/';
  const src = await (await fetch(base + 'paint-gpu.ts')).text();
  const threeUrl = src.match(/from\s+"([^"]*three[^"]*)"/)[1];
  const THREE = await import(threeUrl);
  const { buildDoll } = await import(base + 'doll.ts');
  const { layAtlas } = await import(base + 'atlas.ts');
  const { COLOR_SIZE } = await import(base + 'paint-gpu.ts');
  const { makeDoll, restHit } = await import(base + 'doll3d.ts');
  const { Stroke, PaintLog } = await import(base + 'paint.ts');
  const canvas = document.createElement('canvas');
  canvas.width = 1180;
  canvas.height = 820;
  document.body.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.shadowMap.enabled = true;
  const surf = buildDoll();
  const atlas = layAtlas(surf.pos, surf.idx, COLOR_SIZE);
  const rig = makeDoll(renderer, surf, atlas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#6b6f78');
  scene.add(new THREE.HemisphereLight('#ffffff', '#887766', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 2);
  sun.position.set(2, 4, 3);
  scene.add(sun, rig.root);
  const camera = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 20);
  // 胸の正面を狙って 1 筆塗る
  rig.mesh.computeBoundingSphere();
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 0.7, 2), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(rig.mesh)[0];
  const front = restHit(rig, hit);
  const log = new PaintLog();
  const s = new Stroke({ radius: 0.06, color: [1, 0, 0], opacity: 1, metal: 0, rough: 0.85 });
  log.begin();
  for (let i = 0; i < 12; i++) log.add(s.to({ p: [front.p[0] + (i - 6) * 0.004, front.p[1], front.p[2]], n: front.n }));
  rig.paint.apply(log.dabs);
  const red = rig.paint.read(hit.uv);
  // 背中は塗られていない
  const back = new THREE.Raycaster(new THREE.Vector3(0, 0.7, -2), new THREE.Vector3(0, 0, 1)).intersectObject(rig.mesh)[0];
  const white = rig.paint.read(back.uv);
  // 同じ列から作り直すと同じ画素になる
  const pixels = () => {
    const buf = new Uint8Array(COLOR_SIZE * COLOR_SIZE * 4);
    renderer.readRenderTargetPixels(rig.paint.color, 0, 0, COLOR_SIZE, COLOR_SIZE, buf);
    return buf;
  };
  const first = pixels();
  rig.paint.rebuild(log.dabs);
  const second = pixels();
  let diff = 0;
  for (let i = 0; i < first.length; i++) diff += first[i] !== second[i] ? 1 : 0;
  // 4 方向から撮る
  const shots = [];
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 4]) {
    camera.position.set(Math.sin(yaw) * 3.2, 0.75, Math.cos(yaw) * 3.2);
    camera.lookAt(0, 0.58, 0);
    renderer.render(scene, camera);
    shots.push(canvas.toDataURL('image/png'));
  }
  return { red, white, diff, shots };
});
console.log(JSON.stringify({ red: result.red, white: result.white, diff: result.diff }));
for (const [i, s] of result.shots.entries()) await writeFile(`${OUT}/doll-${i}.png`, Buffer.from(s.split(',')[1], 'base64'));
await browser.close();
```

- [ ] **Step 5: 確かめる**

Run: `node <scratchpad>/gpu-check.mjs <scratchpad>`
Expected:
- `red.color` が `[1, 0, 0]` に近い（どれも 0.03 以内）、`white.color` が `[1, 1, 1]`、`diff` が `0`。
- `doll-0.png`〜`doll-3.png` に、白い丸い人形（球の頭・顔なし・首はほぼ無し・ソーセージの手足・ミトンの手）と胸の赤い吹き付けが写る。継ぎ目の白い線（升のふち）が赤の中に見えない。

赤の中に白い格子の線が見えるときは、`GROW` が足りない。`atlas.ts` の `GROW` を 1.8 にして撮り直す（`GAP` との差が 0.2 画素以上残ること）。

- [ ] **Step 6: 人形の見た目を確かめてもらう**

`doll-0.png`〜`doll-3.png` を作業の担当（このタスクを渡した人）へ返す。担当はユーザーに見せ、本家の人形との違いを聞く。形の直しは `doll.ts` の数字だけで行う。

- [ ] **Step 7: Commit**

```bash
git add src/lib/games/yappari-chameleon/paint-gpu.ts src/lib/games/yappari-chameleon/doll3d.ts
git commit -m "Paint the doll on a GPU atlas with metal and roughness"
```

### Task 6: 動きと当たり

体を縦のカプセル（半径 0.2m、高さ 1.15m）、屋敷を箱と坂の集まりにして、自前の小さな計算で解く。本家の隠れる側の動き（歩く・走る・ジャンプ・壁際のジャンプで張り付く・張り付いたまま上がる下がる・天井に張り付く・回転ロックとその場で回転）を持つ。three も DOM も使わない。

**Files:**
- Create: `src/lib/games/yappari-chameleon/move.ts`
- Test: `src/lib/games/yappari-chameleon/move.test.ts`

**Interfaces:**
- Consumes: `HEIGHT`（Task 2）、`V3`（`$lib/sculpt`）。
- Produces:
  - `interface Box { min: V3; max: V3 }`、`interface Ramp { min: V3; max: V3; rise: 'x+' | 'x-' | 'z+' | 'z-' }`、`interface Level { boxes: Box[]; ramps: Ramp[]; spawn: V3 }`。
  - `type Cling = { kind: 'wall'; nx: number; nz: number } | { kind: 'ceiling' }`。
  - `interface Body { pos: [number, number, number]; vy: number; yaw: number; ground: boolean; cling: Cling | null }`。`pos` は足もとの中心。天井に張り付いているときの `pos[1]` は天井の高さ。`yaw` は 0 で +z を向き、正で +x へ回る（向きのベクトルは `[sin(yaw), cos(yaw)]`）。
  - `interface Input { x: number; z: number; run: boolean; jump: boolean; up: boolean; down: boolean; release: boolean; lock: boolean; turn: number }`。`x`・`z` は世界の向きの移動（長さ 1 まで）。`jump` と `release` は押した瞬間だけ true。`turn` は −1..1。
  - `RADIUS = 0.2`、`STEP = 0.3`、`WALK = 2.0`、`RUN = 3.8`、`CLIMB = 1.0`。
  - `newBody(at: V3): Body`、`idle(): Input`、`step(b: Body, inp: Input, lv: Level, dt: number): void`。
  - `rayDistance(lv: Level, o: V3, d: V3, max: number): number`（カメラの線が箱に当たるまでの距離。当たらなければ `max`）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/move.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { idle, newBody, rayDistance, RADIUS, step, type Input, type Level } from './move';

// 床（y = 0）・奥の壁（z = 5）・天井（y = 3）・低い台（高さ 1）・段（高さ 0.2）・坂（z が増えると 0 → 1.5）
const level: Level = {
  boxes: [
    { min: [-10, -1, -10], max: [10, 0, 10] },
    { min: [-10, 0, 5], max: [10, 3, 5.3] },
    { min: [-10, 3, -10], max: [10, 3.3, 10] },
    { min: [3, 0, -3], max: [5, 1, -1] },
    { min: [-3, 0, -3], max: [-2, 0.2, -2] }
  ],
  ramps: [{ min: [-8, 0, -6], max: [-6, 1.5, -2], rise: 'z+' }],
  spawn: [0, 0, 0]
};

const go = (b: ReturnType<typeof newBody>, inp: Partial<Input>, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) step(b, { ...idle(), ...inp }, level, 1 / 60);
};

describe('move', () => {
  it('床に立つ', () => {
    const b = newBody([0, 0.5, 0]);
    go(b, {}, 1);
    expect(b.pos[1]).toBeCloseTo(0, 3);
    expect(b.ground).toBe(true);
  });

  it('壁に向かって歩くと、壁の手前で半径だけ離れて止まる', () => {
    const b = newBody([0, 0, 3]);
    go(b, { z: 1 }, 3);
    expect(b.pos[2]).toBeCloseTo(5 - RADIUS, 2);
  });

  it('低い段は上れ、高い台は上れない', () => {
    const b = newBody([-2.5, 0, -4]);
    go(b, { z: 1 }, 0.8);
    expect(b.pos[1]).toBeCloseTo(0.2, 2);
    const c = newBody([4, 0, -4.5]);
    go(c, { z: 1 }, 2);
    expect(c.pos[1]).toBeCloseTo(0, 2);
    expect(c.pos[2]).toBeCloseTo(-3 - RADIUS, 2);
  });

  it('坂を上ると高くなる', () => {
    const b = newBody([-7, 0, -6.5]);
    go(b, { z: 1 }, 2);
    expect(b.pos[1]).toBeGreaterThan(1.2);
  });

  it('跳んで、また床に降りる', () => {
    const b = newBody([0, 0, 0]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    go(b, {}, 0.15);
    expect(b.pos[1]).toBeGreaterThan(0.3);
    go(b, {}, 1.5);
    expect(b.pos[1]).toBeCloseTo(0, 3);
  });

  it('壁際で跳ぶと壁に張り付き、壁のほうを向く', () => {
    const b = newBody([0, 0, 5 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    expect(b.cling).toEqual({ kind: 'wall', nx: 0, nz: -1 });
    expect(Math.sin(b.yaw)).toBeCloseTo(0, 3);
    expect(Math.cos(b.yaw)).toBeCloseTo(1, 3);
  });

  it('張り付いたまま何もしなければ落ちず、上がり続けると天井に張り付く', () => {
    const b = newBody([0, 0, 5 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    go(b, {}, 2);
    expect(b.cling?.kind).toBe('wall');
    go(b, { up: true }, 0.5);
    const y = b.pos[1];
    go(b, {}, 1);
    expect(b.pos[1]).toBeCloseTo(y, 5);
    go(b, { up: true }, 4);
    expect(b.cling).toEqual({ kind: 'ceiling' });
    expect(b.pos[1]).toBeCloseTo(3, 3);
  });

  it('天井から「はなす」で床へ落ちる', () => {
    const b = newBody([0, 0, 5 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    go(b, { up: true }, 4);
    step(b, { ...idle(), release: true }, level, 1 / 60);
    expect(b.cling).toBe(null);
    go(b, {}, 2);
    expect(b.pos[1]).toBeCloseTo(0, 3);
  });

  it('低い台の側面に張り付いて上がり切ると、台の上に立つ', () => {
    const b = newBody([4, 0, -3 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    expect(b.cling?.kind).toBe('wall');
    go(b, { up: true }, 2);
    go(b, {}, 0.5);
    expect(b.cling).toBe(null);
    expect(b.pos[1]).toBeCloseTo(1, 2);
  });

  it('張り付いたまま「さがる」で床まで下りると、張り付きが外れる', () => {
    const b = newBody([0, 0, 5 - RADIUS - 0.05]);
    go(b, {}, 0.2);
    step(b, { ...idle(), jump: true }, level, 1 / 60);
    go(b, { up: true }, 0.5);
    go(b, { down: true }, 1.5);
    expect(b.cling).toBe(null);
    expect(b.pos[1]).toBeCloseTo(0, 3);
  });

  it('向きロックのあいだは横へ歩いても向きが変わらず、回るボタンで向きだけ変わる', () => {
    const b = newBody([0, 0, 0]);
    go(b, { lock: true, x: 1 }, 1);
    expect(b.yaw).toBeCloseTo(0, 5);
    expect(b.pos[0]).toBeGreaterThan(1);
    go(b, { lock: true, turn: 1 }, 0.5);
    expect(b.yaw).toBeGreaterThan(0.5);
  });

  it('ロックしていなければ、歩く向きへ体が向く', () => {
    const b = newBody([0, 0, 0]);
    go(b, { x: 1 }, 1);
    expect(Math.sin(b.yaw)).toBeCloseTo(1, 2);
  });

  it('カメラの線は壁で止まる', () => {
    expect(rayDistance(level, [0, 1, 0], [0, 0, 1], 10)).toBeCloseTo(5, 5);
    expect(rayDistance(level, [0, 1, 0], [1, 0, 0], 2)).toBe(2);
  });

  it('外へ落ちたら始めの場所へ戻る', () => {
    const b = newBody([0, -20, 0]);
    go(b, {}, 0.1);
    expect(b.pos).toEqual([0, 0, 0]);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/move.test.ts`
Expected: FAIL（`./move` が無い）。

- [ ] **Step 3: 作る**

`src/lib/games/yappari-chameleon/move.ts`:

```ts
import type { V3 } from '$lib/sculpt';
import { HEIGHT } from './doll';

export interface Box {
  min: V3;
  max: V3;
}

/** 坂（階段の上り）。rise の向きへ min.y から max.y まで上がる。坂の横の壁は箱で別に置く */
export interface Ramp {
  min: V3;
  max: V3;
  rise: 'x+' | 'x-' | 'z+' | 'z-';
}

export interface Level {
  boxes: Box[];
  ramps: Ramp[];
  spawn: V3;
}

export type Cling = { kind: 'wall'; nx: number; nz: number } | { kind: 'ceiling' };

export interface Body {
  pos: [number, number, number];
  vy: number;
  yaw: number;
  ground: boolean;
  cling: Cling | null;
}

export interface Input {
  x: number;
  z: number;
  run: boolean;
  jump: boolean;
  up: boolean;
  down: boolean;
  release: boolean;
  lock: boolean;
  turn: number;
}

export const RADIUS = 0.2;
export const STEP = 0.3;
export const WALK = 2.0;
export const RUN = 3.8;
export const CLIMB = 1.0;
const JUMP = 4.2;
const GRAVITY = 12;
const TURN = 2.5;
const FACE = 10;
/** 壁際とみなす、体のふちから壁までの距離 */
const NEAR = 0.12;

export const newBody = (at: V3): Body => ({ pos: [at[0], at[1], at[2]], vy: 0, yaw: 0, ground: false, cling: null });

export const idle = (): Input => ({
  x: 0,
  z: 0,
  run: false,
  jump: false,
  up: false,
  down: false,
  release: false,
  lock: false,
  turn: 0
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** 体の高さの範囲に掛かる箱（足もとの段は STEP まで上れるので除く） */
const blocks = (b: Body, box: Box) => box.max[1] > b.pos[1] + STEP && box.min[1] < b.pos[1] + HEIGHT;

/** 体の円を箱の外へ押し出し、押した向き（壁の法線）を返す */
function pushOut(b: Body, lv: Level): { nx: number; nz: number } | null {
  let normal: { nx: number; nz: number } | null = null;
  for (let pass = 0; pass < 2; pass++)
    for (const box of lv.boxes) {
      if (!blocks(b, box)) continue;
      const [x, , z] = b.pos;
      const cx = clamp(x, box.min[0], box.max[0]);
      const cz = clamp(z, box.min[2], box.max[2]);
      const dx = x - cx;
      const dz = z - cz;
      const d = Math.hypot(dx, dz);
      if (d >= RADIUS) continue;
      if (d > 1e-6) {
        b.pos[0] = cx + (dx / d) * RADIUS;
        b.pos[2] = cz + (dz / d) * RADIUS;
        normal = { nx: dx / d, nz: dz / d };
      } else {
        // 中心が箱の中に入った（速く当たった）ときは、いちばん浅い面から出す
        const out = [
          [x - box.min[0], -1, 0],
          [box.max[0] - x, 1, 0],
          [z - box.min[2], 0, -1],
          [box.max[2] - z, 0, 1]
        ].sort((p, q) => p[0] - q[0])[0];
        b.pos[0] += out[1] * (out[0] + RADIUS);
        b.pos[2] += out[2] * (out[0] + RADIUS);
        normal = { nx: out[1], nz: out[2] };
      }
    }
  return normal;
}

/** 体のふちから NEAR 以内にある壁の法線（張り付けるか、まだ張り付いていられるか） */
function wallNear(b: Body, lv: Level, want?: { nx: number; nz: number }): { nx: number; nz: number; top: number } | null {
  let best: { nx: number; nz: number; top: number; d: number } | null = null;
  for (const box of lv.boxes) {
    if (!(box.max[1] > b.pos[1] + 0.05 && box.min[1] < b.pos[1] + HEIGHT * 0.6)) continue;
    const [x, , z] = b.pos;
    const cx = clamp(x, box.min[0], box.max[0]);
    const cz = clamp(z, box.min[2], box.max[2]);
    const d = Math.hypot(x - cx, z - cz);
    if (d > RADIUS + NEAR || d < 1e-6) continue;
    const nx = Math.round((x - cx) / d);
    const nz = Math.round((z - cz) / d);
    if (Math.abs(nx) + Math.abs(nz) !== 1) continue;
    if (want && (nx !== want.nx || nz !== want.nz)) continue;
    if (!best || d < best.d) best = { nx, nz, top: box.max[1], d };
  }
  return best && { nx: best.nx, nz: best.nz, top: best.top };
}

function rampHeight(r: Ramp, x: number, z: number): number | null {
  if (x < r.min[0] || x > r.max[0] || z < r.min[2] || z > r.max[2]) return null;
  const t =
    r.rise === 'x+'
      ? (x - r.min[0]) / (r.max[0] - r.min[0])
      : r.rise === 'x-'
        ? (r.max[0] - x) / (r.max[0] - r.min[0])
        : r.rise === 'z+'
          ? (z - r.min[2]) / (r.max[2] - r.min[2])
          : (r.max[2] - z) / (r.max[2] - r.min[2]);
  return r.min[1] + (r.max[1] - r.min[1]) * t;
}

/** 足もとより STEP までの高さにある、いちばん高い床 */
function groundAt(lv: Level, x: number, z: number, below: number): number {
  let g = -Infinity;
  const e = RADIUS * 0.7;
  for (const box of lv.boxes)
    if (x > box.min[0] - e && x < box.max[0] + e && z > box.min[2] - e && z < box.max[2] + e && box.max[1] <= below)
      g = Math.max(g, box.max[1]);
  for (const r of lv.ramps) {
    const h = rampHeight(r, x, z);
    if (h !== null && h <= below) g = Math.max(g, h);
  }
  return g;
}

/** 頭の上の、いちばん低い天井（箱の下の面） */
function ceilingAt(lv: Level, b: Body): number {
  let c = Infinity;
  const e = RADIUS * 0.7;
  for (const box of lv.boxes) {
    const [x, y, z] = b.pos;
    if (x > box.min[0] - e && x < box.max[0] + e && z > box.min[2] - e && z < box.max[2] + e && box.min[1] >= y + STEP)
      c = Math.min(c, box.min[1]);
  }
  return c;
}

function turnToward(b: Body, x: number, z: number, dt: number) {
  const want = Math.atan2(x, z);
  let d = want - b.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  b.yaw += clamp(d, -FACE * dt, FACE * dt);
}

function stepWall(b: Body, c: { nx: number; nz: number }, inp: Input, lv: Level, dt: number) {
  const vy = (inp.up ? CLIMB : 0) - (inp.down ? CLIMB : 0);
  const tx = -c.nz;
  const tz = c.nx;
  const side = (inp.x * tx + inp.z * tz) * CLIMB * 0.8;
  b.pos[0] += tx * side * dt;
  b.pos[2] += tz * side * dt;
  b.pos[1] += vy * dt;
  const ceil = ceilingAt(lv, b);
  if (b.pos[1] + HEIGHT >= ceil) {
    b.cling = { kind: 'ceiling' };
    b.pos[1] = ceil;
    return;
  }
  // 床の高さで張り付いたまま待てるよう、外すのは「さがる」で床まで下りたときだけ
  const floor = groundAt(lv, b.pos[0], b.pos[2], b.pos[1] + 0.01);
  if (inp.down && b.pos[1] <= floor) {
    b.pos[1] = floor;
    b.cling = null;
    b.ground = true;
    return;
  }
  const wall = wallNear(b, lv, c);
  if (wall) return;
  // 壁の上まで上がり切った（台の上へ乗る）か、横へはみ出した（落ちる）
  b.cling = null;
  b.vy = 0;
  const top = wallNear({ ...b, pos: [b.pos[0], b.pos[1] - 0.3, b.pos[2]] }, lv, c);
  if (top && inp.up) {
    b.pos[1] = top.top;
    b.pos[0] -= c.nx * (RADIUS + NEAR + 0.05);
    b.pos[2] -= c.nz * (RADIUS + NEAR + 0.05);
    b.ground = true;
  }
}

function stepCeiling(b: Body, inp: Input, lv: Level, dt: number) {
  if (inp.release || inp.down) {
    b.cling = null;
    b.vy = 0;
    b.pos[1] -= HEIGHT;
    return;
  }
  const px = b.pos[0];
  const pz = b.pos[2];
  b.pos[0] += inp.x * CLIMB * dt;
  b.pos[2] += inp.z * CLIMB * dt;
  const hang = { ...b, pos: [b.pos[0], b.pos[1] - HEIGHT, b.pos[2]] as [number, number, number] };
  if (Math.abs(ceilingAt(lv, hang) - b.pos[1]) > 0.01) {
    b.pos[0] = px;
    b.pos[2] = pz;
  }
}

export function step(b: Body, inp: Input, lv: Level, dt: number): void {
  if (b.pos[1] < -10) {
    b.pos = [...lv.spawn] as [number, number, number];
    b.vy = 0;
    b.cling = null;
    return;
  }
  if (inp.lock) b.yaw += inp.turn * TURN * dt;
  if (b.cling?.kind === 'ceiling') return stepCeiling(b, inp, lv, dt);
  if (b.cling?.kind === 'wall') {
    if (inp.release) {
      b.cling = null;
      b.vy = 0;
    } else return stepWall(b, b.cling, inp, lv, dt);
  }

  const len = Math.hypot(inp.x, inp.z);
  if (!inp.lock && len > 0.1) turnToward(b, inp.x, inp.z, dt);
  const speed = inp.run ? RUN : WALK;
  // 速く歩いても箱を抜けないよう、半径の半分ずつに分けて動かす
  const dist = speed * Math.min(1, len) * dt;
  const parts = Math.max(1, Math.ceil(dist / (RADIUS * 0.5)));
  const wasGround = b.ground;
  for (let i = 0; i < parts; i++) {
    b.pos[0] += (inp.x * speed * dt) / parts;
    b.pos[2] += (inp.z * speed * dt) / parts;
    // 段の上へ乗れるよう、横に動いたあとで床の高さへ持ち上げてから押し出す
    const g = groundAt(lv, b.pos[0], b.pos[2], b.pos[1] + STEP);
    if (b.ground && g > b.pos[1]) b.pos[1] = g;
    pushOut(b, lv);
  }

  if (inp.jump) {
    const wall = wallNear(b, lv);
    if (wall) {
      b.cling = { kind: 'wall', nx: wall.nx, nz: wall.nz };
      b.vy = 0;
      b.yaw = Math.atan2(-wall.nx, -wall.nz);
      return;
    }
    if (b.ground) {
      b.vy = JUMP;
      b.ground = false;
    }
  }

  b.vy -= GRAVITY * dt;
  b.pos[1] += b.vy * dt;
  const ceil = ceilingAt(lv, b);
  if (b.pos[1] + HEIGHT > ceil) {
    b.pos[1] = ceil - HEIGHT;
    b.vy = Math.min(0, b.vy);
  }
  const g = groundAt(lv, b.pos[0], b.pos[2], b.pos[1] + STEP);
  if (b.pos[1] <= g || (wasGround && b.vy <= 0 && b.pos[1] - g < STEP)) {
    b.pos[1] = g;
    b.vy = 0;
    b.ground = true;
  } else b.ground = false;
}

/** カメラの線（o から向き d、長さ max）が箱に当たるまでの距離 */
export function rayDistance(lv: Level, o: V3, d: V3, max: number): number {
  let best = max;
  for (const box of lv.boxes) {
    let t0 = 0;
    let t1 = best;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) {
        if (o[i] < box.min[i] || o[i] > box.max[i]) t0 = Infinity;
        continue;
      }
      let a = (box.min[i] - o[i]) / d[i];
      let c = (box.max[i] - o[i]) / d[i];
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
    }
    if (t0 <= t1 && t0 < best) best = t0;
  }
  return best;
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/move.test.ts`
Expected: PASS。落ちるテストがあれば、テストの数字（壁・台・坂の位置）ではなく `move.ts` を直す。テストの意図は本家の隠れる側の動きなので、テストは変えない。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/yappari-chameleon/move.ts src/lib/games/yappari-chameleon/move.test.ts
git commit -m "Move the doll with walls, stairs, wall cling and rotation lock"
```

### Task 7: ポーズの表と、ポーズを当てる

本家のポーズの輪から 12 種（丸まる・寝そべる・しゃがむ・あぐら・ブリッジ・T ポーズ・片足立ち・寄りかかる・開脚・前屈・ワシ・のけぞり）と、立ち姿を骨ごとの角度の表にする。角度は形を作った向き（腕は水平から 35 度下げた形）からの回り。数字は初めの見当で、Step 6 のシートを見て直す。

骨の回りの向きの覚え書き（形を作った向きの骨は回っていないので、骨の軸は世界の軸と同じ）:
- 太ももの x を負に回すと脚が前へ上がる（−π/2 で座った形）。すねの x を正に回すとひざが曲がる。
- 背骨の x を正に回すと前へかがむ。
- 左の上腕（`upperarm.l`、+x 側）の z を正に回すと腕が上がり、負で下がる。右は逆。
- 腰（`hips`）の回りは体全体を回す（寝そべるは x を +π/2 で、前を下にして倒れる）。`drop` は腰の高さ（形を作ったときの 0.5m）からのずれ。

**Files:**
- Create: `src/lib/games/yappari-chameleon/poses.ts`
- Test: `src/lib/games/yappari-chameleon/poses.test.ts`
- Modify: `src/lib/games/yappari-chameleon/doll3d.ts`（`PoseAnimator` を足す）
- Create（リポジトリに入れない）: `<scratchpad>/pose-sheet.mjs`

**Interfaces:**
- Consumes: `BONES`・`Bone`（Task 2）、`DollRig`（Task 5）。
- Produces（`poses.ts`）: `interface Pose { id: string; label: string; drop?: number; bones: Partial<Record<Bone, V3>> }`、`STAND: Pose`、`POSES: Pose[]`（12 種。輪の 1 ページめが先頭の 6 種）、`poseById(id: string): Pose`（無ければ `STAND`）。
- Produces（`doll3d.ts`）: `class PoseAnimator { constructor(rig: DollRig); to(p: Pose): void; snap(p: Pose): void; step(dt: number): boolean; get pose(): Pose }`。`step` は動いているあいだ true を返す（止まったら当たり判定の外接球を作り直すため）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/poses.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BONES } from './doll';
import { poseById, POSES, STAND } from './poses';

describe('poses', () => {
  it('本家の輪から選んだ 12 種がある', () => {
    expect(POSES.map((p) => p.label)).toEqual([
      '丸まる', '寝そべる', 'しゃがむ', 'あぐら', 'ブリッジ', 'Tポーズ',
      '片足立ち', '寄りかかる', '開脚', '前屈', 'ワシ', 'のけぞり'
    ]);
  });

  it('id は重ならず、骨の名前はどれも人形の骨', () => {
    const all = [STAND, ...POSES];
    expect(new Set(all.map((p) => p.id)).size).toBe(all.length);
    for (const p of all)
      for (const [b, a] of Object.entries(p.bones)) {
        expect(BONES).toContain(b);
        for (const v of a!) expect(Math.abs(v)).toBeLessThanOrEqual(Math.PI);
      }
  });

  it('腰は下がるだけで、0.45m より下げない', () => {
    for (const p of POSES) {
      expect(p.drop ?? 0).toBeLessThanOrEqual(0);
      expect(p.drop ?? 0).toBeGreaterThanOrEqual(-0.45);
    }
  });

  it('知らない id は立ち姿になる', () => {
    expect(poseById('nope')).toBe(STAND);
    expect(poseById('curl').label).toBe('丸まる');
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/poses.test.ts`
Expected: FAIL（`./poses` が無い）。

- [ ] **Step 3: `poses.ts` を作る**

```ts
import type { V3 } from '$lib/sculpt';
import type { Bone } from './doll';

export interface Pose {
  id: string;
  label: string;
  drop?: number;
  bones: Partial<Record<Bone, V3>>;
}

const ARMS_DOWN: Partial<Record<Bone, V3>> = {
  'upperarm.l': [0, 0, -0.75],
  'upperarm.r': [0, 0, 0.75],
  'forearm.l': [0, 0, -0.15],
  'forearm.r': [0, 0, 0.15]
};

export const STAND: Pose = { id: 'stand', label: '立つ', bones: ARMS_DOWN };

export const POSES: Pose[] = [
  {
    id: 'curl',
    label: '丸まる',
    drop: -0.24,
    bones: {
      spine: [0.9, 0, 0],
      chest: [0.6, 0, 0],
      head: [0.5, 0, 0],
      'thigh.l': [-2.3, 0, 0.12],
      'thigh.r': [-2.3, 0, -0.12],
      'shin.l': [2.4, 0, 0],
      'shin.r': [2.4, 0, 0],
      'upperarm.l': [-1.3, 0, -0.6],
      'upperarm.r': [-1.3, 0, 0.6],
      'forearm.l': [0, -1.2, 0],
      'forearm.r': [0, 1.2, 0]
    }
  },
  { id: 'lie', label: '寝そべる', drop: -0.38, bones: { hips: [Math.PI / 2, 0, 0], ...ARMS_DOWN } },
  {
    id: 'crouch',
    label: 'しゃがむ',
    drop: -0.22,
    bones: {
      spine: [0.35, 0, 0],
      'thigh.l': [-1.7, 0, 0.12],
      'thigh.r': [-1.7, 0, -0.12],
      'shin.l': [2.1, 0, 0],
      'shin.r': [2.1, 0, 0],
      'upperarm.l': [-0.8, 0, -0.6],
      'upperarm.r': [-0.8, 0, 0.6]
    }
  },
  {
    id: 'cross',
    label: 'あぐら',
    drop: -0.36,
    bones: {
      'thigh.l': [-1.45, 0, 0.9],
      'thigh.r': [-1.45, 0, -0.9],
      'shin.l': [0, 0, -2.4],
      'shin.r': [0, 0, 2.4],
      'upperarm.l': [-0.5, 0, -0.6],
      'upperarm.r': [-0.5, 0, 0.6]
    }
  },
  {
    id: 'bridge',
    label: 'ブリッジ',
    drop: -0.05,
    bones: {
      hips: [-0.4, 0, 0],
      spine: [-0.7, 0, 0],
      chest: [-0.7, 0, 0],
      head: [-0.5, 0, 0],
      'upperarm.l': [2.4, 0, 0.3],
      'upperarm.r': [2.4, 0, -0.3],
      'thigh.l': [0.6, 0, 0.1],
      'thigh.r': [0.6, 0, -0.1],
      'shin.l': [-0.9, 0, 0],
      'shin.r': [-0.9, 0, 0]
    }
  },
  { id: 't', label: 'Tポーズ', bones: { 'upperarm.l': [0, 0, 0.61], 'upperarm.r': [0, 0, -0.61] } },
  {
    id: 'one-leg',
    label: '片足立ち',
    bones: {
      'thigh.r': [-1.4, 0, 0],
      'shin.r': [1.7, 0, 0],
      'upperarm.l': [0, 0, 0.35],
      'upperarm.r': [0, 0, -0.35]
    }
  },
  {
    id: 'lean',
    label: '寄りかかる',
    bones: {
      hips: [0, 0, 0.22],
      spine: [0, 0, 0.1],
      'upperarm.l': [0, 0, 1.2],
      'forearm.l': [0, 0, 1.3],
      'upperarm.r': [0, 0, 0.75],
      'thigh.r': [0, 0, -0.3],
      'shin.r': [0.6, 0, 0]
    }
  },
  {
    id: 'split',
    label: '開脚',
    drop: -0.42,
    bones: { 'thigh.l': [0, 0, 1.5], 'thigh.r': [0, 0, -1.5], 'upperarm.l': [0, 0, 0.3], 'upperarm.r': [0, 0, -0.3] }
  },
  {
    id: 'bend',
    label: '前屈',
    bones: {
      spine: [1.0, 0, 0],
      chest: [0.6, 0, 0],
      head: [0.3, 0, 0],
      'upperarm.l': [-1.2, 0, -0.75],
      'upperarm.r': [-1.2, 0, 0.75]
    }
  },
  {
    id: 'eagle',
    label: 'ワシ',
    bones: {
      'upperarm.l': [0, 0, 1.15],
      'upperarm.r': [0, 0, -1.15],
      'forearm.l': [0, 0, 0.25],
      'forearm.r': [0, 0, -0.25],
      'thigh.l': [0, 0, 0.25],
      'thigh.r': [0, 0, -0.25]
    }
  },
  {
    id: 'arch',
    label: 'のけぞり',
    bones: {
      spine: [-0.45, 0, 0],
      chest: [-0.4, 0, 0],
      head: [-0.45, 0, 0],
      'upperarm.l': [0.9, 0, -0.4],
      'upperarm.r': [0.9, 0, 0.4],
      'shin.l': [0.3, 0, 0],
      'shin.r': [0.3, 0, 0]
    }
  }
];

export const poseById = (id: string): Pose => POSES.find((p) => p.id === id) ?? STAND;
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/poses.test.ts`
Expected: PASS。

- [ ] **Step 5: `doll3d.ts` に `PoseAnimator` を足す**

`doll3d.ts` の先頭の import に `import { STAND, type Pose } from './poses';` を足し、末尾に足す。

```ts
const rest = new THREE.Quaternion();
const euler = new THREE.Euler();

/** ポーズのあいだを 0.25 秒ほどでなめらかにつなぐ。角度の表は回っていない骨からの回り */
export class PoseAnimator {
  readonly #rig: DollRig;
  #target: Pose = STAND;
  #want = new Map<Bone, THREE.Quaternion>();
  #moving = true;

  constructor(rig: DollRig) {
    this.#rig = rig;
    this.snap(STAND);
  }

  get pose(): Pose {
    return this.#target;
  }

  to(p: Pose): void {
    this.#target = p;
    this.#want = new Map(
      BONES.map((b) => {
        const a = p.bones[b];
        return [b, a ? new THREE.Quaternion().setFromEuler(euler.set(a[0], a[1], a[2])) : rest.clone()];
      })
    );
    this.#moving = true;
  }

  snap(p: Pose): void {
    this.to(p);
    this.#apply(1);
  }

  step(dt: number): boolean {
    if (!this.#moving) return false;
    return this.#apply(1 - Math.exp(-12 * dt));
  }

  #apply(k: number): boolean {
    let far = 0;
    for (const b of BONES) {
      const q = this.#rig.bones[b].quaternion;
      const w = this.#want.get(b)!;
      q.slerp(w, k);
      far = Math.max(far, q.angleTo(w));
    }
    const hips = this.#rig.bones.hips;
    const wantY = JOINTS.hips[1] + (this.#target.drop ?? 0);
    hips.position.y += (wantY - hips.position.y) * k;
    far = Math.max(far, Math.abs(wantY - hips.position.y));
    this.#moving = far > 1e-3;
    return true;
  }
}
```

- [ ] **Step 6: ポーズのシートを撮って数字を直す**

scratchpad に `pose-sheet.mjs` を書く。中身は Task 5 の `gpu-check.mjs` と同じ起動と three の読み方で、`page.evaluate` の中で人形を作ったあと、`STAND` と `POSES` の 13 種を順に `new PoseAnimator(rig).snap(pose)` で当て、それぞれ斜め前（yaw = π/5、距離 3m、高さ 0.9m）と横（yaw = π/2）から 400 × 400 で撮って、1 枚の canvas（13 列 × 2 段）に並べて PNG にする。床の代わりに y = 0 に灰色の板（`PlaneGeometry(4, 4)`）を置く。

Run: `node <scratchpad>/pose-sheet.mjs <scratchpad>`
Expected: `poses.png` に 13 のポーズが写る。

次を満たすまで `poses.ts` の数字を直して撮り直す（1 回ごとに数字だけを変える）。
- 丸まるは、横から見てほぼ丸い塊（本家で風船に化ける形）。
- 寝そべるは前を下にして床にべったり付き、体が床の板に沈まない（沈むなら `drop` を上げる）。
- しゃがむ・あぐら・開脚は、お尻か足が床の板に付き、深く沈まない。
- どのポーズも、腕や脚がつぶれて体の中に埋まらない。

- [ ] **Step 7: 型・lint・テストを通す**

Run: `pnpm format && pnpm check && pnpm lint && pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add src/lib/games/yappari-chameleon/poses.ts src/lib/games/yappari-chameleon/poses.test.ts src/lib/games/yappari-chameleon/doll3d.ts
git commit -m "Add the twelve poses from the original's pose wheel"
```

`poses.png` を作業の担当へ返す（担当がユーザーに見せる）。

### Task 8: 指の振り分け

歩くときと鬼の目では、左の 45% に置いた指がスティック（置いた所が中心）、それ以外の 1 本が見回しになる。ペイントモードでは 1 本指で塗り、2 本指でカメラを回してつまんでズームする。2 本指の 1 本めで体に跡が付かないよう、1 本めは 80ms たつか 6px 動くまで塗り始めない。そのあとで 2 本めが来たら、描きかけの筆を取り消す知らせを出す。DOM を使わず、座標と時刻を受け取るだけにする。

**Files:**
- Create: `src/lib/games/yappari-chameleon/touch.ts`
- Test: `src/lib/games/yappari-chameleon/touch.test.ts`

**Interfaces:**
- Produces:
  - `type Mode = 'walk' | 'paint' | 'eye'`。
  - `type PaintEvent = { kind: 'start' | 'move' | 'end'; x: number; y: number } | { kind: 'cancel' }`。
  - `class TouchPad { constructor(radius: number); mode: Mode; readonly stick: { x: number; y: number; active: boolean; ox: number; oy: number }; setMode(m: Mode): PaintEvent[]; down(id: number, x: number, y: number, width: number, now: number): PaintEvent[]; move(id: number, x: number, y: number, now: number): PaintEvent[]; up(id: number): PaintEvent[]; tick(now: number): PaintEvent[]; takeLook(): { dx: number; dy: number }; takeOrbit(): { dx: number; dy: number; zoom: number } }`。座標は canvas の左上からの CSS px。`stick.x`・`stick.y` は −1..1（y は画面の下が正）、`ox`・`oy` は指を置いた所。`radius` はスティックを倒し切る距離（px）。`zoom` は 2 本の指の間の長さの比（1 で変わらず）。`up` は `pointercancel` でも呼ぶ。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/touch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TouchPad } from './touch';

const W = 1000;

describe('TouchPad 歩く', () => {
  it('左の指はスティック、右の指は見回しになり、同時に使える', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0);
    t.down(2, 800, 500, W, 0);
    t.move(1, 100, 450, 10);
    t.move(2, 830, 490, 10);
    expect(t.stick.y).toBeCloseTo(-0.5);
    expect(t.stick.active).toBe(true);
    expect(t.takeLook()).toEqual({ dx: 30, dy: -10 });
    expect(t.takeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it('スティックは半径で倒し切り、それ以上は 1 のまま', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0);
    t.move(1, 400, 500, 10);
    expect(t.stick.x).toBeCloseTo(1);
  });

  it('スティックの指を離すか取り消されると止まる', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0);
    t.move(1, 150, 500, 10);
    t.up(1);
    expect(t.stick).toMatchObject({ x: 0, y: 0, active: false });
  });

  it('見回しの指が使われているとき、3 本めは何もしない', () => {
    const t = new TouchPad(100);
    t.down(2, 800, 500, W, 0);
    t.down(3, 900, 500, W, 0);
    t.move(3, 950, 500, 10);
    expect(t.takeLook()).toEqual({ dx: 0, dy: 0 });
  });

  it('スティックを使っているとき、左にもう 1 本置くと見回しになる', () => {
    const t = new TouchPad(100);
    t.down(1, 100, 500, W, 0);
    t.down(2, 200, 300, W, 0);
    t.move(2, 220, 300, 10);
    expect(t.takeLook().dx).toBe(20);
  });
});

describe('TouchPad 塗る', () => {
  const paint = () => {
    const t = new TouchPad(100);
    t.setMode('paint');
    return t;
  };

  it('1 本指は 80ms たつと塗り始め、動かすと塗り、離すと終わる', () => {
    const t = paint();
    expect(t.down(1, 500, 500, W, 0)).toEqual([]);
    expect(t.tick(50)).toEqual([]);
    expect(t.tick(80)).toEqual([{ kind: 'start', x: 500, y: 500 }]);
    expect(t.move(1, 510, 500, 90)).toEqual([{ kind: 'move', x: 510, y: 500 }]);
    expect(t.up(1)).toEqual([{ kind: 'end', x: 510, y: 500 }]);
  });

  it('6px 動けば 80ms を待たずに塗り始める', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    expect(t.move(1, 507, 500, 20)).toEqual([
      { kind: 'start', x: 500, y: 500 },
      { kind: 'move', x: 507, y: 500 }
    ]);
  });

  it('80ms のうちに 2 本めが来たら塗らず、2 本指でカメラを回す', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    expect(t.down(2, 600, 500, W, 40)).toEqual([]);
    expect(t.tick(200)).toEqual([]);
    t.move(1, 520, 500, 210);
    t.move(2, 620, 500, 210);
    const o = t.takeOrbit();
    expect(o.dx).toBeCloseTo(20);
    expect(o.zoom).toBeCloseTo(1);
  });

  it('塗り始めたあとで 2 本めが来たら、描きかけを取り消す', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    t.tick(100);
    expect(t.down(2, 600, 500, W, 150)).toEqual([{ kind: 'cancel' }]);
  });

  it('つまむとズームの比が出る', () => {
    const t = paint();
    t.down(1, 400, 500, W, 0);
    t.down(2, 600, 500, W, 10);
    t.move(1, 300, 500, 20);
    t.move(2, 700, 500, 20);
    expect(t.takeOrbit().zoom).toBeCloseTo(2);
  });

  it('2 本指のあと 1 本だけ離しても、残った指では塗らない', () => {
    const t = paint();
    t.down(1, 400, 500, W, 0);
    t.down(2, 600, 500, W, 10);
    t.up(2);
    expect(t.move(1, 450, 500, 300)).toEqual([]);
    expect(t.tick(400)).toEqual([]);
    t.up(1);
    t.down(3, 500, 500, W, 500);
    expect(t.tick(600)).toEqual([{ kind: 'start', x: 500, y: 500 }]);
  });

  it('モードを変えると指を全部忘れ、描きかけは取り消す', () => {
    const t = paint();
    t.down(1, 500, 500, W, 0);
    t.tick(100);
    expect(t.setMode('walk')).toEqual([{ kind: 'cancel' }]);
    expect(t.move(1, 600, 500, 200)).toEqual([]);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/touch.test.ts`
Expected: FAIL（`./touch` が無い）。

- [ ] **Step 3: 作る**

`src/lib/games/yappari-chameleon/touch.ts`:

```ts
export type Mode = 'walk' | 'paint' | 'eye';
export type PaintEvent = { kind: 'start' | 'move' | 'end'; x: number; y: number } | { kind: 'cancel' };

/** 2 本指で触るつもりの 1 本めで塗ってしまわないよう、塗り始めるまで待つ時間と動き */
const HOLD_MS = 80;
const HOLD_PX = 6;
const STICK_AREA = 0.45;

interface Finger {
  x: number;
  y: number;
}

export class TouchPad {
  mode: Mode = 'walk';
  readonly stick = { x: 0, y: 0, active: false, ox: 0, oy: 0 };
  readonly #radius: number;
  #stickId: number | null = null;
  #lookId: number | null = null;
  #lookAt: Finger = { x: 0, y: 0 };
  #look = { dx: 0, dy: 0 };
  #fingers = new Map<number, Finger>();
  #pending: { id: number; x: number; y: number; t: number } | null = null;
  #painting: number | null = null;
  /** 2 本指のあと、全部の指が離れるまでは塗らない */
  #gesture = false;
  #orbit = { dx: 0, dy: 0, zoom: 1 };

  constructor(radius: number) {
    this.#radius = radius;
  }

  setMode(m: Mode): PaintEvent[] {
    const out: PaintEvent[] = this.#painting !== null ? [{ kind: 'cancel' }] : [];
    this.mode = m;
    this.#reset();
    return out;
  }

  #reset() {
    this.#stickId = this.#lookId = this.#painting = null;
    this.#pending = null;
    this.#gesture = false;
    this.#fingers.clear();
    Object.assign(this.stick, { x: 0, y: 0, active: false });
    this.#look = { dx: 0, dy: 0 };
    this.#orbit = { dx: 0, dy: 0, zoom: 1 };
  }

  down(id: number, x: number, y: number, width: number, now: number): PaintEvent[] {
    if (this.mode === 'paint') return this.#paintDown(id, x, y, now);
    if (this.#stickId === null && x < width * STICK_AREA) {
      this.#stickId = id;
      Object.assign(this.stick, { x: 0, y: 0, active: true, ox: x, oy: y });
    } else if (this.#lookId === null) {
      this.#lookId = id;
      this.#lookAt = { x, y };
    }
    return [];
  }

  move(id: number, x: number, y: number, now: number): PaintEvent[] {
    if (this.mode === 'paint') return this.#paintMove(id, x, y, now);
    if (id === this.#stickId) {
      let dx = (x - this.stick.ox) / this.#radius;
      let dy = (y - this.stick.oy) / this.#radius;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      this.stick.x = dx;
      this.stick.y = dy;
    } else if (id === this.#lookId) {
      this.#look.dx += x - this.#lookAt.x;
      this.#look.dy += y - this.#lookAt.y;
      this.#lookAt = { x, y };
    }
    return [];
  }

  up(id: number): PaintEvent[] {
    if (this.mode === 'paint') return this.#paintUp(id);
    if (id === this.#stickId) {
      this.#stickId = null;
      Object.assign(this.stick, { x: 0, y: 0, active: false });
    } else if (id === this.#lookId) this.#lookId = null;
    return [];
  }

  tick(now: number): PaintEvent[] {
    const p = this.#pending;
    if (!p || now - p.t < HOLD_MS) return [];
    this.#pending = null;
    this.#painting = p.id;
    return [{ kind: 'start', x: p.x, y: p.y }];
  }

  takeLook(): { dx: number; dy: number } {
    const l = this.#look;
    this.#look = { dx: 0, dy: 0 };
    return l;
  }

  takeOrbit(): { dx: number; dy: number; zoom: number } {
    const o = this.#orbit;
    this.#orbit = { dx: 0, dy: 0, zoom: 1 };
    return o;
  }

  #paintDown(id: number, x: number, y: number, now: number): PaintEvent[] {
    this.#fingers.set(id, { x, y });
    if (this.#fingers.size === 1 && !this.#gesture) {
      this.#pending = { id, x, y, t: now };
      return [];
    }
    this.#gesture = true;
    this.#pending = null;
    if (this.#painting !== null) {
      this.#painting = null;
      return [{ kind: 'cancel' }];
    }
    return [];
  }

  #paintMove(id: number, x: number, y: number, now: number): PaintEvent[] {
    const f = this.#fingers.get(id);
    if (!f) return [];
    if (this.#gesture && this.#fingers.size >= 2) {
      // Map の値は同じ物なので、動く前の座標を写しておく
      const [a, b] = [...this.#fingers.values()].map((p) => ({ ...p }));
      f.x = x;
      f.y = y;
      const [c, d] = [...this.#fingers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const after = Math.hypot(c.x - d.x, c.y - d.y) || 1;
      this.#orbit.dx += (c.x + d.x - a.x - b.x) / 2;
      this.#orbit.dy += (c.y + d.y - a.y - b.y) / 2;
      this.#orbit.zoom *= after / before;
      return [];
    }
    f.x = x;
    f.y = y;
    const out: PaintEvent[] = [];
    const p = this.#pending;
    if (p && p.id === id && (now - p.t >= HOLD_MS || Math.hypot(x - p.x, y - p.y) >= HOLD_PX)) {
      out.push(...this.tick(Infinity));
    }
    if (this.#painting === id) out.push({ kind: 'move', x, y });
    return out;
  }

  #paintUp(id: number): PaintEvent[] {
    const f = this.#fingers.get(id);
    this.#fingers.delete(id);
    if (!this.#fingers.size) this.#gesture = false;
    if (this.#pending?.id === id) {
      // 動かさずに離したタップも 1 回は吹き付ける（点を打つ）
      this.#pending = null;
      return [
        { kind: 'start', x: f!.x, y: f!.y },
        { kind: 'end', x: f!.x, y: f!.y }
      ];
    }
    if (this.#painting === id && f) {
      this.#painting = null;
      return [{ kind: 'end', x: f.x, y: f.y }];
    }
    return [];
  }
}
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/touch.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/yappari-chameleon/touch.ts src/lib/games/yappari-chameleon/touch.test.ts
git commit -m "Route fingers to the stick, looking, painting and two-finger orbit"
```

### Task 9: 試しの部屋で歩く・塗る・スポイト・鬼の目

人形・塗り・動き・指を three の場面と画面につなぐ。屋敷を作る前に、緑のダマスクの壁・白黒の市松の床・金の額の油絵だけの試しの部屋で、受け入れの 1 枚め（壁の色を全身に吹いて張り付くと、鬼の目でほぼ見えない）を撮る。

**Files:**
- Modify: `src/lib/icons.ts`（`currentColor` で描くアイコンを 9 つ足す）
- Create: `src/lib/games/yappari-chameleon/textures.ts`（ダマスク・市松・油絵と、模様を貼った材質・スポイトで読む画素）
- Create: `src/lib/games/yappari-chameleon/test-room.ts`
- Create: `src/lib/games/yappari-chameleon/world3d.ts`
- Create: `src/lib/games/yappari-chameleon/play.svelte.ts`
- Create: `src/lib/games/yappari-chameleon/Buttons.svelte`
- Create: `src/lib/games/yappari-chameleon/StickView.svelte`
- Create: `src/lib/games/yappari-chameleon/BrushSize.svelte`
- Modify: `src/lib/games/yappari-chameleon/Chameleon.svelte`（作り直す）
- Test: `src/lib/games/yappari-chameleon/Buttons.svelte.test.ts`
- Create（リポジトリに入れない）: `<scratchpad>/accept.mjs`

**Interfaces:**
- Consumes: Task 2〜8 の全部。`animate`（`$lib/loop`）、`wake`（`$lib/audio.svelte`）。
- Produces（`textures.ts`）:
  - `interface PickInfo { image: ImageData | null; tint: RGB; metal: number; rough: number }`、`interface Pattern { canvas: HTMLCanvasElement; image: ImageData; meters: [number, number] }`。
  - `damask(ground: string, ink: string): Pattern`、`checker(): Pattern`、`oilPainting(): Pattern`。
  - `interface Finish { pattern?: Pattern; tint?: string; metal?: number; rough?: number }`、`finish(f: Finish, size: [number, number]): THREE.MeshStandardMaterial`（`material.userData.pick` に `PickInfo` を入れる）。
  - `readPick(m: THREE.Material, uv: THREE.Vector2 | undefined): { color: RGB; metal: number; rough: number } | null`。
- Produces（`world3d.ts`）:
  - `EYE_FOV = 72`、`interface Built { group: THREE.Group; level: Level }`。
  - `class World { renderer; scene; camera; rig: DollRig; poses: PoseAnimator; level: Level; constructor(canvas: HTMLCanvasElement, rig: (r: THREE.WebGLRenderer) => DollRig, onRestore: () => void); setStage(b: Built): void; resize(w: number, h: number): void; placeDoll(b: Body): void; follow(target: V3, yaw: number, pitch: number, dist: number, fov: number): void; eye(pos: V3, yaw: number, pitch: number): void; dollCenter(): V3; pickBody(x: number, y: number): THREE.Intersection | null; spoit(x: number, y: number): { color: RGB; metal: number; rough: number } | null; project(p: V3): { x: number; y: number }; render(): void; dispose(): void }`。`x`・`y` は canvas の CSS px。
- Produces（`play.svelte.ts`）:
  - `class Play`。画面から読む `$state`: `mode`・`brush`・`spoit`・`shadow`・`canUndo`・`cling`（`'wall' | 'ceiling' | null`）。ボタンの口: `jump()`・`release()`・`held`（`{ up: boolean; down: boolean }`）・`togglePaint()`・`toggleEye()`・`toggleSpoit()`・`toggleShadow()`・`undo()`・`setColor(c: RGB)`。指の口: `pointer(kind: 'down' | 'move' | 'up', id: number, x: number, y: number, width: number)`。描く口: `frame(dt: number, now: number)`。headless の確かめから使う口: `body`・`ghost`・`log`・`world`・`spoitAt(x, y)`・`applyDabs(dabs: Dab[])`。

- [ ] **Step 1: アイコンを足す**

`src/lib/icons.ts` の `const LINE = ...` の下に `const C = 'currentColor';` を足し、`ICONS` の最後の項目のあとに足す（ボタンの白い字の色をそのまま使うため、どれも `currentColor` で描く）。

```ts
  eye: [
    { d: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z', stroke: C, width: 2 },
    { d: circle(12, 12, 3), fill: C }
  ],
  dropper: [
    { d: 'M14.5 6.5l3 3M9 12l-4.5 4.5v3h3L12 15M10.5 10.5l3 3', stroke: C, width: 2 },
    { d: 'M13 5l1.8-1.8a2.3 2.3 0 0 1 3.3 0l1.7 1.7a2.3 2.3 0 0 1 0 3.3L18 10z', fill: C }
  ],
  figure: [
    { d: circle(12, 4.5, 2.3), fill: C },
    { d: 'M5 9.5l7 1.2 7-1.2M12 10.7v4.8M12 15.5l-3.6 5.5M12 15.5l3.6 5.5', stroke: C, width: 2 }
  ],
  lock: [
    { d: 'M8 11V8a4 4 0 0 1 8 0v3', stroke: C, width: 2 },
    { d: 'M5.5 11h13v9.5h-13z', fill: C }
  ],
  spin: [{ d: 'M19 12a7 7 0 1 1-2.05-4.95M19 4.5V8h-3.5', stroke: C, width: 2 }],
  shadow: [
    { d: circle(12, 12, 8.5), stroke: C, width: 2 },
    { d: 'M12 3.5a8.5 8.5 0 0 1 0 17z', fill: C }
  ],
  lift: [{ d: 'M12 20V5M6 11l6-6 6 6', stroke: C, width: 2.4 }],
  spray: [
    { d: 'M8 9h7v11.5H8z', fill: C },
    { d: 'M9.5 9V6.5h4V9', stroke: C, width: 2 },
    { d: 'M17 4.5h.01M19.5 6h.01M17.5 7.5h.01M20 3.5h.01', stroke: C, width: 2.2 }
  ],
  rewind: [{ d: 'M5 10h9.5a5 5 0 0 1 0 10H10M9 5.5L4.5 10 9 14.5', stroke: C, width: 2.2 }]
```

- [ ] **Step 2: `textures.ts` を作る**

```ts
import * as THREE from 'three';
import { fromHex, type RGB } from './color';

export interface PickInfo {
  image: ImageData | null;
  tint: RGB;
  metal: number;
  rough: number;
}

export interface Pattern {
  canvas: HTMLCanvasElement;
  image: ImageData;
  /** 模様 1 枚が覆う大きさ（m）。面の大きさで割った回数だけ繰り返す */
  meters: [number, number];
}

const made = new Map<string, Pattern>();

function make(key: string, w: number, h: number, meters: [number, number], draw: (g: CanvasRenderingContext2D) => void): Pattern {
  const old = made.get(key);
  if (old) return old;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  draw(g);
  const p = { canvas, image: g.getImageData(0, 0, w, h), meters };
  made.set(key, p);
  return p;
}

/** 種から作る乱数。模様は開くたびに同じにする（スポイトで取った色が変わらないように） */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * ダマスク柄（本家の屋敷の緑・青・赤の壁紙）。左右対称の飾りを、半分を描いて左右に写して作る。
 * 線は 2cm 以上の太さにして、体に写せるようにする
 */
export function damask(ground: string, ink: string): Pattern {
  return make(`damask:${ground}:${ink}`, 256, 384, [0.5, 0.75], (g) => {
    g.fillStyle = ground;
    g.fillRect(0, 0, 256, 384);
    const half = (cx: number, cy: number, s: number) => {
      for (const flip of [1, -1]) {
        g.save();
        g.translate(cx, cy);
        g.scale(flip * s, s);
        g.fillStyle = ink;
        g.strokeStyle = ink;
        g.lineWidth = 11;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(0, -150);
        g.bezierCurveTo(60, -120, 90, -60, 40, -20);
        g.bezierCurveTo(90, 10, 100, 80, 30, 120);
        g.bezierCurveTo(15, 135, 6, 145, 0, 160);
        g.stroke();
        g.beginPath();
        g.moveTo(40, -20);
        g.bezierCurveTo(70, -40, 105, -25, 100, 5);
        g.bezierCurveTo(95, 30, 70, 25, 72, 8);
        g.stroke();
        g.beginPath();
        g.ellipse(0, 10, 26, 46, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(0, -95);
        g.quadraticCurveTo(34, -70, 0, -40);
        g.fill();
        g.beginPath();
        g.moveTo(30, 120);
        g.quadraticCurveTo(70, 150, 50, 185);
        g.stroke();
        g.restore();
      }
    };
    half(128, 192, 1);
    // 隣の飾りと合わせるため、四隅に半分ずつ小さな花を置く
    for (const [x, y] of [
      [0, 0],
      [256, 0],
      [0, 384],
      [256, 384]
    ]) {
      g.beginPath();
      g.fillStyle = ink;
      g.arc(x, y, 24, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 白黒の市松の床（1 枡 0.3m）。目地の線と、少しのむらを入れる */
export function checker(): Pattern {
  return make('checker', 256, 256, [0.6, 0.6], (g) => {
    const r = rng(11);
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        g.fillStyle = (i + j) % 2 ? '#1d1c1b' : '#efebe2';
        g.fillRect(i * 128, j * 128, 128, 128);
        for (let k = 0; k < 40; k++) {
          g.fillStyle = (i + j) % 2 ? 'rgb(255 255 255 / 0.03)' : 'rgb(0 0 0 / 0.03)';
          g.fillRect(i * 128 + r() * 128, j * 128 + r() * 128, 6 + r() * 18, 6 + r() * 18);
        }
      }
    g.strokeStyle = '#8a8580';
    g.lineWidth = 2;
    g.strokeRect(0, 0, 128, 128);
    g.strokeRect(128, 128, 128, 128);
    g.strokeRect(128, 0, 128, 128);
    g.strokeRect(0, 128, 128, 128);
  });
}

/** 金の額に入れる、階段のある広間の油絵（本家のトレーラーで体に写していた絵に寄せる） */
export function oilPainting(): Pattern {
  return make('oil', 512, 384, [1.2, 0.9], (g) => {
    const r = rng(23);
    const sky = g.createLinearGradient(0, 0, 0, 384);
    sky.addColorStop(0, '#3b2a1d');
    sky.addColorStop(0.55, '#8a6a3e');
    sky.addColorStop(1, '#2a1f17');
    g.fillStyle = sky;
    g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#d8c39a';
    g.fillRect(300, 40, 120, 170);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 2 ? '#6e4a2a' : '#a77b4a';
      g.beginPath();
      g.moveTo(40 + i * 28, 360 - i * 30);
      g.lineTo(360 + i * 6, 360 - i * 30);
      g.lineTo(360 + i * 6, 330 - i * 30);
      g.lineTo(40 + i * 28, 330 - i * 30);
      g.fill();
    }
    g.strokeStyle = '#2b1a10';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(30, 330);
    g.lineTo(290, 80);
    g.stroke();
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `hsl(${30 + r() * 20} ${30 + r() * 30}% ${20 + r() * 50}% / 0.18)`;
      g.beginPath();
      g.ellipse(r() * 512, r() * 384, 6 + r() * 16, 3 + r() * 6, r() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export interface Finish {
  pattern?: Pattern;
  tint?: string;
  metal?: number;
  rough?: number;
}

/** 面の大きさ（m）に合わせて模様を繰り返した材質。スポイトで読むための画素を userData.pick に持たせる */
export function finish(f: Finish, size: [number, number]): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: f.tint ?? '#ffffff',
    metalness: f.metal ?? 0,
    roughness: f.rough ?? 0.8
  });
  if (f.pattern) {
    const t = new THREE.CanvasTexture(f.pattern.canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(size[0] / f.pattern.meters[0], size[1] / f.pattern.meters[1]);
    t.anisotropy = 4;
    m.map = t;
  }
  const pick: PickInfo = { image: f.pattern?.image ?? null, tint: fromHex(f.tint ?? '#ffffff'), metal: f.metal ?? 0, rough: f.rough ?? 0.8 };
  m.userData.pick = pick;
  return m;
}

const frac = (v: number) => v - Math.floor(v);

/** 光が当たる前の物の色（模様の画素 × 材質の色）。体にも同じ光が当たるので、同じ場所では同じに見える */
export function readPick(m: THREE.Material, uv: THREE.Vector2 | undefined): { color: RGB; metal: number; rough: number } | null {
  const pick = m.userData.pick as PickInfo | undefined;
  if (!pick) return null;
  let color: RGB = [...pick.tint];
  const map = (m as THREE.MeshStandardMaterial).map;
  if (pick.image && uv && map) {
    const { width: w, height: h, data } = pick.image;
    const x = Math.min(w - 1, Math.floor(frac(uv.x * map.repeat.x + map.offset.x) * w));
    const y = Math.min(h - 1, Math.floor((1 - frac(uv.y * map.repeat.y + map.offset.y)) * h));
    const i = (y * w + x) * 4;
    color = [(data[i] / 255) * color[0], (data[i + 1] / 255) * color[1], (data[i + 2] / 255) * color[2]];
  }
  return { color, metal: pick.metal, rough: pick.rough };
}
```

- [ ] **Step 3: `test-room.ts` を作る**

```ts
import * as THREE from 'three';
import type { V3 } from '$lib/sculpt';
import type { Box } from './move';
import { checker, damask, finish, oilPainting } from './textures';
import type { Built } from './world3d';

const W = 8;
const D = 8;
const H = 3.2;

function plane(size: [number, number], m: THREE.Material, at: V3, rot: V3): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), m);
  mesh.position.set(...at);
  mesh.rotation.set(...rot);
  mesh.receiveShadow = true;
  return mesh;
}

/** 受け入れを試す 1 部屋。奥の壁が緑のダマスクで、金の額の油絵が掛かり、床は白黒の市松 */
export function testRoom(): Built {
  const group = new THREE.Group();
  const green = finish({ pattern: damask('#3f5e3a', '#5f8255') }, [W, H]);
  const plain = finish({ tint: '#d9cdb4' }, [W, H]);
  group.add(plane([W, D], finish({ pattern: checker(), rough: 0.35 }, [W, D]), [0, 0, 0], [-Math.PI / 2, 0, 0]));
  group.add(plane([W, D], finish({ tint: '#efe6d2' }, [W, D]), [0, H, 0], [Math.PI / 2, 0, 0]));
  group.add(plane([W, H], green, [0, H / 2, D / 2], [0, Math.PI, 0]));
  group.add(plane([W, H], plain, [0, H / 2, -D / 2], [0, 0, 0]));
  group.add(plane([D, H], plain, [W / 2, H / 2, 0], [0, -Math.PI / 2, 0]));
  group.add(plane([D, H], plain, [-W / 2, H / 2, 0], [0, Math.PI / 2, 0]));
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.06), finish({ tint: '#d4af37', metal: 1, rough: 0.35 }, [1.5, 1.2]));
  frame.position.set(-1.5, 1.5, D / 2 - 0.03);
  frame.castShadow = true;
  group.add(frame);
  group.add(plane([1.2, 0.9], finish({ pattern: oilPainting(), rough: 0.6 }, [1.2, 0.9]), [-1.5, 1.5, D / 2 - 0.061], [0, Math.PI, 0]));
  const t = 0.3;
  const boxes: Box[] = [
    { min: [-W / 2, -1, -D / 2], max: [W / 2, 0, D / 2] },
    { min: [-W / 2, H, -D / 2], max: [W / 2, H + t, D / 2] },
    { min: [-W / 2, 0, D / 2], max: [W / 2, H, D / 2 + t] },
    { min: [-W / 2, 0, -D / 2 - t], max: [W / 2, H, -D / 2] },
    { min: [W / 2, 0, -D / 2], max: [W / 2 + t, H, D / 2] },
    { min: [-W / 2 - t, 0, -D / 2], max: [-W / 2, H, D / 2] }
  ];
  return { group, level: { boxes, ramps: [], spawn: [0, 0, 0] } };
}
```

- [ ] **Step 4: `world3d.ts` を作る**

```ts
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { PoseAnimator, type DollRig } from './doll3d';
import { rayDistance, RADIUS, type Body, type Level } from './move';
import { readPick } from './textures';

/** 一人称の縦の視野。本家の 16:9 の画面での横 105 度と同じ見え方 */
export const EYE_FOV = 72;

export interface Built {
  group: THREE.Group;
  level: Level;
}

/** 体の厚みの半分。張り付いたときに壁や天井と体の間を空けない */
const HALF_DEPTH = 0.12;

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 80);
  readonly rig: DollRig;
  readonly poses: PoseAnimator;
  level: Level = { boxes: [], ramps: [], spawn: [0, 0, 0] };
  #stage: THREE.Group | null = null;
  #ray = new THREE.Raycaster();
  #w = 1;
  #h = 1;

  constructor(canvas: HTMLCanvasElement, rig: (r: THREE.WebGLRenderer) => DollRig, onRestore: () => void) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    // 遊ぶ端末（iPad Air 2025）の力に合わせた固定値
    this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // iOS が裏に回したときに失うと塗りのテクスチャが空になるので、戻ったら塗りの列から作り直す
    canvas.addEventListener('webglcontextrestored', onRestore);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    env.dispose();
    pmrem.dispose();
    this.scene.background = new THREE.Color('#1d1a17');
    this.scene.add(new THREE.HemisphereLight('#fff4e0', '#5a4a3a', 1.1));
    const top = new THREE.DirectionalLight('#fff1dc', 1.6);
    top.position.set(3, 10, 2);
    top.castShadow = true;
    top.shadow.mapSize.set(2048, 2048);
    top.shadow.camera.left = top.shadow.camera.bottom = -14;
    top.shadow.camera.right = top.shadow.camera.top = 14;
    top.shadow.bias = -0.0004;
    top.shadow.normalBias = 0.02;
    this.scene.add(top, top.target);
    this.rig = rig(this.renderer);
    this.poses = new PoseAnimator(this.rig);
    this.scene.add(this.rig.root);
  }

  setStage(b: Built): void {
    this.#stage?.removeFromParent();
    this.#stage = b.group;
    this.level = b.level;
    this.scene.add(b.group);
  }

  resize(w: number, h: number): void {
    this.#w = w;
    this.#h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  placeDoll(b: Body): void {
    const root = this.rig.root;
    root.rotation.order = 'YXZ';
    root.rotation.set(0, b.yaw, 0);
    root.position.set(b.pos[0], b.pos[1], b.pos[2]);
    if (b.cling?.kind === 'wall') {
      root.position.x -= b.cling.nx * (RADIUS - HALF_DEPTH);
      root.position.z -= b.cling.nz * (RADIUS - HALF_DEPTH);
    } else if (b.cling?.kind === 'ceiling') {
      // 背中を天井に付け、前を下へ向ける
      root.rotation.x = Math.PI / 2;
      root.position.y = b.pos[1] - HALF_DEPTH;
    }
    root.updateMatrixWorld(true);
  }

  /** 体の真ん中（ペイントのカメラが回る中心）。ポーズで変わるので骨の外接球から出す */
  dollCenter(): V3 {
    const m = this.rig.mesh;
    m.computeBoundingSphere();
    const c = m.boundingSphere!.center.clone().applyMatrix4(m.matrixWorld);
    return [c.x, c.y, c.z];
  }

  /** target のまわりを回る三人称のカメラ。壁の向こうへ行かないよう、手前で止める */
  follow(target: V3, yaw: number, pitch: number, dist: number, fov: number): void {
    const dir: V3 = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
    const d = Math.max(0.3, Math.min(dist, rayDistance(this.level, target, dir, dist) - 0.15));
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(target[0] + dir[0] * d, target[1] + dir[1] * d, target[2] + dir[2] * d);
    this.camera.lookAt(target[0], target[1], target[2]);
  }

  eye(pos: V3, yaw: number, pitch: number): void {
    this.camera.fov = EYE_FOV;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(...pos);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(-pitch, yaw + Math.PI, 0);
  }

  #cast(x: number, y: number, list: THREE.Object3D[]): THREE.Intersection | null {
    this.#ray.setFromCamera(new THREE.Vector2((x / this.#w) * 2 - 1, -(y / this.#h) * 2 + 1), this.camera);
    return this.#ray.intersectObjects(list, true)[0] ?? null;
  }

  pickBody(x: number, y: number): THREE.Intersection | null {
    return this.#cast(x, y, [this.rig.mesh]);
  }

  spoit(x: number, y: number): { color: RGB; metal: number; rough: number } | null {
    const hit = this.#cast(x, y, [this.rig.mesh, ...(this.#stage ? [this.#stage] : [])]);
    if (!hit) return null;
    if (hit.object === this.rig.mesh) return hit.uv ? this.rig.paint.read(hit.uv) : null;
    const m = (hit.object as THREE.Mesh).material;
    return readPick(Array.isArray(m) ? m[0] : m, hit.uv);
  }

  project(p: V3): { x: number; y: number } {
    const v = new THREE.Vector3(...p).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.#w, y: ((1 - v.y) / 2) * this.#h };
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.rig.paint.dispose();
    this.renderer.dispose();
  }
}
```

`eye()` の回り（`yaw + Math.PI`）は、three のカメラが −z を向くことと、このゲームの向き（`yaw = 0` で +z）を合わせるため。`pitch` は正で下を向く。

- [ ] **Step 5: `play.svelte.ts` を作る**

```ts
import type { V3 } from '$lib/sculpt';
import type { RGB } from './color';
import { pushRecent } from './color';
import { restHit } from './doll3d';
import { idle, newBody, step, type Body } from './move';
import { PaintLog, Stroke, type Brush, type Dab } from './paint';
import { TouchPad, type Mode, type PaintEvent } from './touch';
import type { World } from './world3d';

const LOOK = 0.005;
const ORBIT = 0.006;
const EYE_HEIGHT = 1.0;

export class Play {
  mode = $state<Mode>('walk');
  brush = $state<Brush>({ radius: 0.05, color: [1, 1, 1], opacity: 1, metal: 0, rough: 0.85 });
  previous = $state<RGB>([1, 1, 1]);
  recent = $state<RGB[]>([]);
  spoit = $state(false);
  shadow = $state(true);
  canUndo = $state(false);
  cling = $state<'wall' | 'ceiling' | null>(null);
  stick = $state({ x: 0, y: 0, active: false, ox: 0, oy: 0 });
  readonly held = { up: false, down: false };
  readonly world: World;
  readonly pad: TouchPad;
  readonly log = new PaintLog();
  body: Body;
  ghost: Body;
  camYaw = 0;
  camPitch = 0.25;
  eyeYaw = 0;
  eyePitch = 0;
  orbitYaw = Math.PI;
  orbitPitch = 0.15;
  orbitDist = 1.6;
  #stroke: Stroke | null = null;
  #jump = false;
  #release = false;

  constructor(world: World, stickRadius: number) {
    this.world = world;
    this.pad = new TouchPad(stickRadius);
    this.body = newBody(world.level.spawn);
    this.ghost = newBody(world.level.spawn);
    world.placeDoll(this.body);
  }

  jump(): void {
    this.#jump = true;
  }

  release(): void {
    this.#release = true;
  }

  togglePaint(): void {
    this.#setMode(this.mode === 'paint' ? 'walk' : 'paint');
    if (this.mode === 'paint') {
      this.orbitYaw = this.body.yaw + Math.PI;
      this.orbitDist = 1.6;
    }
  }

  toggleEye(): void {
    if (this.mode === 'eye') return this.#setMode('walk');
    // 三人称のカメラのいる所から歩き出す（壁の外へは出ない位置）
    const c = this.world.camera.position;
    this.ghost = newBody([c.x, this.body.pos[1], c.z]);
    this.eyeYaw = this.camYaw;
    this.eyePitch = 0;
    this.#setMode('eye');
  }

  toggleSpoit(): void {
    this.spoit = !this.spoit;
  }

  toggleShadow(): void {
    this.shadow = !this.shadow;
    this.world.rig.mesh.receiveShadow = this.shadow;
  }

  undo(): void {
    if (this.log.undo()) this.world.rig.paint.rebuild(this.log.dabs);
    this.canUndo = this.log.canUndo;
  }

  setColor(c: RGB): void {
    this.previous = this.brush.color;
    this.brush.color = c;
  }

  rebuildPaint(): void {
    this.world.rig.paint.rebuild(this.log.dabs);
  }

  applyDabs(dabs: Dab[]): void {
    if (!dabs.length) return;
    this.log.add(dabs);
    this.world.rig.paint.apply(dabs);
  }

  spoitAt(x: number, y: number): void {
    const got = this.world.spoit(x, y);
    this.spoit = false;
    if (!got) return;
    this.setColor(got.color);
    this.brush.metal = got.metal;
    this.brush.rough = got.rough;
  }

  #setMode(m: Mode) {
    for (const e of this.pad.setMode(m)) this.#paint(e);
    this.mode = m;
    this.stick = { ...this.pad.stick };
  }

  pointer(kind: 'down' | 'move' | 'up', id: number, x: number, y: number, width: number): void {
    const now = performance.now();
    const events =
      kind === 'down' ? this.pad.down(id, x, y, width, now) : kind === 'move' ? this.pad.move(id, x, y, now) : this.pad.up(id);
    for (const e of events) this.#paint(e);
    this.stick = { ...this.pad.stick };
  }

  #paint(e: PaintEvent) {
    if (e.kind === 'cancel') {
      this.#stroke = null;
      if (this.log.cancel()) this.rebuildPaint();
      this.canUndo = this.log.canUndo;
      return;
    }
    if (this.spoit) {
      if (e.kind === 'end') this.spoitAt(e.x, e.y);
      return;
    }
    if (e.kind === 'start') {
      this.log.begin();
      this.#stroke = new Stroke({ ...this.brush, color: [...this.brush.color] });
    }
    const hit = this.#stroke && this.world.pickBody(e.x, e.y);
    const rest = hit && restHit(this.world.rig, hit);
    if (this.#stroke && rest) this.applyDabs(this.#stroke.to(rest));
    if (e.kind === 'end') {
      if (this.#stroke) this.recent = pushRecent(this.recent, this.#stroke.brush.color);
      this.#stroke = null;
      this.canUndo = this.log.canUndo;
    }
  }

  #input(yaw: number) {
    const s = this.pad.stick;
    const len = Math.hypot(s.x, s.y);
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    // 画面の右は、カメラの向き (sin, cos) を右へ 90 度回した (−cos, sin)
    return {
      ...idle(),
      x: fx * -s.y + -fz * s.x,
      z: fz * -s.y + fx * s.x,
      run: len > 0.85,
      jump: this.#jump,
      release: this.#release,
      up: this.held.up,
      down: this.held.down
    };
  }

  frame(dt: number, now: number): void {
    for (const e of this.pad.tick(now)) this.#paint(e);
    const w = this.world;
    if (this.mode === 'walk') {
      const look = this.pad.takeLook();
      this.camYaw -= look.dx * LOOK;
      this.camPitch = Math.min(1.2, Math.max(-0.5, this.camPitch + look.dy * LOOK));
      step(this.body, this.#input(this.camYaw), w.level, dt);
    } else if (this.mode === 'eye') {
      const look = this.pad.takeLook();
      this.eyeYaw -= look.dx * LOOK;
      this.eyePitch = Math.min(1.3, Math.max(-1.3, this.eyePitch + look.dy * LOOK));
      step(this.ghost, { ...this.#input(this.eyeYaw), jump: false }, w.level, dt);
    } else {
      const o = this.pad.takeOrbit();
      this.orbitYaw -= o.dx * ORBIT;
      this.orbitPitch = Math.min(1.3, Math.max(-1.0, this.orbitPitch + o.dy * ORBIT));
      this.orbitDist = Math.min(3.5, Math.max(0.5, this.orbitDist / o.zoom));
    }
    this.#jump = this.#release = false;
    this.cling = this.body.cling?.kind ?? null;
    w.placeDoll(this.body);
    w.poses.step(dt);
    if (this.mode === 'walk') {
      const lift = this.body.cling?.kind === 'ceiling' ? -0.4 : 0.85;
      const t: V3 = [this.body.pos[0], this.body.pos[1] + lift, this.body.pos[2]];
      w.follow(t, this.camYaw, this.camPitch, 2.4, 60);
    } else if (this.mode === 'paint') w.follow(w.dollCenter(), this.orbitYaw, this.orbitPitch, this.orbitDist, 45);
    else w.eye([this.ghost.pos[0], this.ghost.pos[1] + EYE_HEIGHT, this.ghost.pos[2]], this.eyeYaw, this.eyePitch);
    w.render();
  }
}
```

- [ ] **Step 6: 画面の部品を作る**

`src/lib/games/yappari-chameleon/StickView.svelte`:

```svelte
<script lang="ts">
  /** ox・oy は指を置いた所（CSS px）、x・y は −1..1 の倒し具合、r は倒し切る距離（px） */
  let { ox, oy, x, y, r }: { ox: number; oy: number; x: number; y: number; r: number } = $props();
</script>

<span class="ring" style:left="{ox}px" style:top="{oy}px" style:width="{r * 2}px" style:height="{r * 2}px">
  <span class="knob" style:translate="{x * r}px {y * r}px"></span>
</span>

<style>
  .ring {
    position: absolute;
    translate: -50% -50%;
    border: 3px solid rgb(255 255 255 / 0.55);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.18);
    pointer-events: none;
  }

  .knob {
    position: absolute;
    inset: 28%;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.65);
  }
</style>
```

`src/lib/games/yappari-chameleon/BrushSize.svelte`:

```svelte
<script lang="ts">
  import { RADIUS } from './paint';

  let { value = $bindable() }: { value: number } = $props();
</script>

<label class="size">
  <span class="dot" style:width="{8 + (value / RADIUS[1]) * 56}px" style:height="{8 + (value / RADIUS[1]) * 56}px"></span>
  <input type="range" min={RADIUS[0]} max={RADIUS[1]} step="0.005" bind:value aria-label="ブラシの大きさ" />
  <span class="label">{Math.round(value * 200)} cm</span>
</label>

<style>
  .size {
    position: absolute;
    right: max(96px, calc(env(safe-area-inset-right) + 84px));
    top: 50%;
    translate: 0 -50%;
    display: grid;
    justify-items: center;
    gap: 10px;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 1px 3px #000;
  }

  .dot {
    border: 2px solid #fff;
    border-radius: 50%;
  }

  input {
    writing-mode: vertical-lr;
    direction: rtl;
    height: 46vh;
    accent-color: #fff;
  }
</style>
```

ラベルは吹き付けの直径（半径 × 2、cm）。

`src/lib/games/yappari-chameleon/Buttons.svelte`:

```svelte
<script lang="ts">
  import Icon from '$lib/components/Icon.svelte';
  import type { IconName } from '$lib/icons';
  import type { Play } from './play.svelte';

  let { play, onquit }: { play: Play; onquit: () => void } = $props();

  const hold = (key: 'up' | 'down', on: boolean) => (play.held[key] = on);
</script>

{#snippet button(icon: IconName, label: string, onclick: () => void, on = false, rotate = 0)}
  <button class="btn" class:on {onclick}>
    <Icon name={icon} size="30px" {rotate} />
    <span>{label}</span>
  </button>
{/snippet}

{#snippet holder(icon: IconName, label: string, key: 'up' | 'down', rotate = 0)}
  <button
    class="btn"
    onpointerdown={() => hold(key, true)}
    onpointerup={() => hold(key, false)}
    onpointercancel={() => hold(key, false)}
    onpointerleave={() => hold(key, false)}
  >
    <Icon name={icon} size="30px" {rotate} />
    <span>{label}</span>
  </button>
{/snippet}

<button class="quit" onclick={onquit} aria-label="タイトルへ">✕</button>

<div class="column">
  {#if play.mode === 'paint'}
    {@render button('dropper', 'スポイト', () => play.toggleSpoit(), play.spoit)}
    {@render button('rewind', 'もどす', () => play.undo())}
    {@render button('shadow', '影', () => play.toggleShadow(), play.shadow)}
    {@render button('spray', 'おわる', () => play.togglePaint(), true)}
  {:else if play.mode === 'eye'}
    {@render button('lift', 'ジャンプ', () => play.jump())}
    {@render button('eye', 'もどる', () => play.toggleEye(), true)}
  {:else if play.cling}
    {@render holder('lift', '上がる', 'up')}
    {@render holder('lift', 'さがる', 'down', 180)}
    <button class="btn" onclick={() => play.release()}><span>はなす</span></button>
    {@render button('spray', 'ペイント', () => play.togglePaint())}
  {:else}
    {@render button('lift', 'ジャンプ', () => play.jump())}
    {@render button('spray', 'ペイント', () => play.togglePaint())}
    {@render button('eye', '鬼の目', () => play.toggleEye())}
  {/if}
</div>

<style>
  .quit {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: max(12px, env(safe-area-inset-left));
    width: 48px;
    height: 48px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-size: 22px;
  }

  .column {
    position: absolute;
    right: max(14px, env(safe-area-inset-right));
    bottom: max(14px, env(safe-area-inset-bottom));
    display: grid;
    gap: 10px;
  }

  .btn {
    display: grid;
    justify-items: center;
    align-content: center;
    width: 72px;
    height: 72px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.35);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 12px;
    text-shadow: 0 1px 2px #000;
  }

  .btn.on {
    background: rgb(255 255 255 / 0.9);
    color: #1d1a17;
    text-shadow: none;
  }
</style>
```

- [ ] **Step 7: `Chameleon.svelte` を作り直す**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { wake } from '$lib/audio.svelte';
  import type { SoloProps } from '$lib/games';
  import { animate } from '$lib/loop';
  import { layAtlas } from './atlas';
  import BrushSize from './BrushSize.svelte';
  import Buttons from './Buttons.svelte';
  import { buildDoll } from './doll';
  import { makeDoll } from './doll3d';
  import { COLOR_SIZE } from './paint-gpu';
  import { Play } from './play.svelte';
  import StickView from './StickView.svelte';
  import { testRoom } from './test-room';
  import { World } from './world3d';

  let { onquit }: SoloProps = $props();
  let canvas: HTMLCanvasElement;
  let box: HTMLDivElement;
  let portrait = $state(false);
  let play = $state.raw<Play | null>(null);
  const radius = 70;

  onMount(() => {
    const mq = matchMedia('(orientation: portrait)');
    let stop: (() => void) | null = null;
    let world: World | null = null;
    const size = () => world?.resize(box.clientWidth, box.clientHeight);
    const run = () => {
      stop?.();
      stop = null;
      portrait = mq.matches;
      if (portrait || !play) return;
      size();
      const p = play;
      stop = animate((dt, now) => p.frame(dt, now));
    };
    // 人形の面と升目を作るのに数百 ms 止まるので、「じゅんびちゅう」を 1 度描かせてから作る
    const raf = requestAnimationFrame(() =>
      setTimeout(() => {
        const s = buildDoll();
        const atlas = layAtlas(s.pos, s.idx, COLOR_SIZE);
        world = new World(canvas, (r) => makeDoll(r, s, atlas), () => play?.rebuildPaint());
        world.setStage(testRoom());
        size();
        play = new Play(world, radius);
        if (import.meta.env.DEV) (window as unknown as { __chameleon?: Play }).__chameleon = play;
        run();
      })
    );
    mq.addEventListener('change', run);
    const ro = new ResizeObserver(size);
    ro.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener('change', run);
      ro.disconnect();
      stop?.();
      world?.dispose();
    };
  });

  function pointer(kind: 'down' | 'move' | 'up', e: PointerEvent) {
    if (!play) return;
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
</script>

<div class="chameleon" bind:this={box}>
  <canvas bind:this={canvas}></canvas>
  <div
    class="pad"
    role="presentation"
    onpointerdown={(e) => pointer('down', e)}
    onpointermove={(e) => pointer('move', e)}
    onpointerup={(e) => pointer('up', e)}
    onpointercancel={(e) => pointer('up', e)}
  ></div>
  {#if play}
    {#if play.stick.active}
      <StickView ox={play.stick.ox} oy={play.stick.oy} x={play.stick.x} y={play.stick.y} r={radius} />
    {/if}
    {#if play.mode === 'paint'}
      <BrushSize bind:value={play.brush.radius} />
    {/if}
    <Buttons {play} onquit={() => onquit?.()} />
  {:else}
    <p class="notice">じゅんびちゅう…</p>
  {/if}
  {#if portrait}
    <p class="notice cover">よこむきに してね</p>
  {/if}
</div>

<style>
  .chameleon {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #1d1a17;
  }

  canvas,
  .pad {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .notice {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 28px;
    text-shadow: 0 2px 4px #000;
    pointer-events: none;
  }

  .cover {
    background: #1d1a17;
    pointer-events: auto;
  }
</style>
```

- [ ] **Step 8: ボタンの DOM テストを書く**

`src/lib/games/yappari-chameleon/Buttons.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import Buttons from './Buttons.svelte';
import type { Play } from './play.svelte';

function fake(over: Partial<Play> = {}) {
  return {
    mode: 'walk',
    cling: null,
    spoit: false,
    shadow: true,
    held: { up: false, down: false },
    jump: vi.fn(),
    release: vi.fn(),
    togglePaint: vi.fn(),
    toggleEye: vi.fn(),
    toggleSpoit: vi.fn(),
    toggleShadow: vi.fn(),
    undo: vi.fn(),
    ...over
  } as unknown as Play;
}

const labels = (t: HTMLElement) => [...t.querySelectorAll('.column button')].map((b) => b.textContent?.trim());

describe('Buttons', () => {
  it('歩くときはジャンプ・ペイント・鬼の目', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play: fake(), onquit: () => {} } });
    flushSync();
    expect(labels(target)).toEqual(['ジャンプ', 'ペイント', '鬼の目']);
    unmount(app);
  });

  it('張り付いているあいだは、上がる・さがるを押しているあいだだけ held が立つ', () => {
    const play = fake({ cling: 'wall' });
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play, onquit: () => {} } });
    flushSync();
    expect(labels(target)).toEqual(['上がる', 'さがる', 'はなす', 'ペイント']);
    const up = target.querySelectorAll('.column button')[0];
    up.dispatchEvent(new PointerEvent('pointerdown'));
    expect(play.held.up).toBe(true);
    up.dispatchEvent(new PointerEvent('pointerleave'));
    expect(play.held.up).toBe(false);
    unmount(app);
  });

  it('ペイント中はスポイト・もどす・影・おわる', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(Buttons, { target, props: { play: fake({ mode: 'paint' }), onquit: () => {} } });
    flushSync();
    expect(labels(target)).toEqual(['スポイト', 'もどす', '影', 'おわる']);
    unmount(app);
  });
});
```

Run: `pnpm vitest run src/lib/games/yappari-chameleon/Buttons.svelte.test.ts`
Expected: PASS（部品を作ったあとなので、はじめから通る。落ちるなら Buttons を直す）。

- [ ] **Step 9: 型・lint・テストを通す**

Run: `pnpm format && pnpm check && pnpm lint && pnpm test:run`
Expected: PASS。

- [ ] **Step 10: headless Chrome で受け入れの 1 枚めを撮る**

dev サーバー（`pnpm dev --port 5180`）を起動したまま、scratchpad に `accept.mjs` を書く。[[headless-play-harness]] の形（`chromium.launch({ channel: 'chrome' })`、`newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true })`）で `http://localhost:5180/asobibako/games/yappari-chameleon` を開き、タイトルの「はじめる」（`button.go`）を押して、`window.__chameleon` が出るまで待つ。そのあと `page.evaluate` で次を行う。

1. 体を壁の前（`body.pos = [0.5, 0, 3.75]`、`camYaw = 0`）に置き、数フレーム待つ。
2. `play.world.project([0.5, 1.6, 3.99])`（壁の上の点）で画面の位置を出し、`play.spoitAt(x, y)` で壁の色を取る。`play.brush.color` が緑（G が R と B より大きい）になっていることを確かめる。
3. 全身に吹く。人形の形を `buildDoll()` で作り直し（`/asobibako/src/lib/games/yappari-chameleon/doll.ts` を import）、頂点を 30 個おきに取って、`{ p, n, r: 0.08, c: play.brush.color, a: 0.9, m: 0, ro: 0.8 }` の吹き付けを `play.applyDabs(list)` で当てる。
4. `play.jump()` で壁に張り付かせ、0.5 秒待つ。`play.cling` が `'wall'` であることを確かめる。
5. `play.toggleEye()` で鬼の目に替え、`play.ghost.pos = [0.5, 0, 0.75]`、`play.eyeYaw = 0`、`play.eyePitch = 0.1` にして 0.5 秒待ち、`accept-1.png` を撮る。
6. 比べるため、`play.log.clear(); play.rebuildPaint();` で白に戻して同じ場所から `accept-1-white.png` を撮る。
7. WebGL のコンテキストを失って戻る場合（Review Focus 4）を確かめる。もう一度 3 の吹き付けを当ててから、`const ext = play.world.renderer.getContext().getExtension('WEBGL_lose_context'); ext.loseContext();` のあと 0.5 秒待って `ext.restoreContext();`、1 秒待って `accept-1-restored.png` を撮る。

8. 縦持ちと横持ちの行き来を確かめる（Review Focus 1）。`page.setViewportSize({ width: 820, height: 1180 })` で縦にして 0.5 秒待ち、「よこむきに してね」が出ていることを撮る（`accept-1-portrait.png`）。`page.setViewportSize({ width: 1180, height: 820 })` で横に戻して 1 秒待ち、`play.body.pos` が縦にする前と同じで、画面が引きのばされずに描かれていることを撮る（`accept-1-back.png`）。

Run: `node <scratchpad>/accept.mjs <scratchpad>`
Expected:
- `accept-1.png` で、人形が緑のダマスクの壁にほぼ溶け込み、輪郭と影のほかはほとんど見えない。`accept-1-white.png` では白い人形がはっきり見える。
- `accept-1-restored.png` が `accept-1.png` と同じ見え方（体が白に戻っていない）。
- `accept-1-portrait.png` に「よこむきに してね」が出て、`accept-1-back.png` が引きのばされずに続きを描いている。

溶け込まないときの見どころ。
- 体だけ暗い・明るいなら、材質の差（体はラフネス 0.8 前後、壁は `finish` の既定 0.8）と、体の `receiveShadow` を確かめる。
- 色がずれるなら、スポイトの色（`readPick`）と、塗りのテクスチャの sRGB の扱い（`PaintSurface` の色の先が `SRGBColorSpace`）を確かめる。
- 模様の細かさが足りないのは、全身を 1 色で吹いたため（模様は手で写す。受け入れの 2 枚めと 3 枚めは Task 14 で撮る）。

- [ ] **Step 11: Commit**

```bash
git add src/lib/icons.ts src/lib/games/yappari-chameleon
git commit -m "Walk, paint, sample colors and check with the seeker's eye in a test room"
```

`accept-1.png`・`accept-1-white.png` を作業の担当へ返す（担当がユーザーに見せる）。

### Task 10: 色のパネル

本家のペイントの左上のパネルの並び（色相の輪・明るさと不透明度の縦のスライダー・今の色と前の色・H/S/V と R/G/B のスライダー・メタリックとラフネス・最近使った色・14 × 3 の見本）を、ペイントモードの左に出す。塗る場所を空けられるよう、パネルはたためる。

**Files:**
- Create: `src/lib/games/yappari-chameleon/PaintPanel.svelte`
- Create: `src/lib/games/yappari-chameleon/HueRing.svelte`
- Create: `src/lib/games/yappari-chameleon/ColorSliders.svelte`
- Create: `src/lib/games/yappari-chameleon/Swatches.svelte`
- Modify: `src/lib/games/yappari-chameleon/Chameleon.svelte`（ペイント中に `PaintPanel` を出す）
- Test: `src/lib/games/yappari-chameleon/PaintPanel.svelte.test.ts`

**Interfaces:**
- Consumes: `Play`（`brush`・`previous`・`recent`・`setColor`、Task 9）、`hsvToRgb`・`rgbToHsv`・`toHex`・`fromHex`・`SWATCHES`（Task 4）。
- Produces: `PaintPanel.svelte`（props `{ play: Play }`）。スライダーで動かした色は `play.brush.color` に直接入れ、見本・最近の色・前の色を押したときは `play.setColor()`（前の色を入れ替える）を呼ぶ。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/PaintPanel.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import PaintPanel from './PaintPanel.svelte';
import type { Play } from './play.svelte';

function fake() {
  const play = {
    brush: { radius: 0.05, color: [1, 0, 0], opacity: 1, metal: 0, rough: 0.85 },
    previous: [0, 0, 1],
    recent: [[0, 1, 0]],
    setColor: vi.fn()
  };
  return play as unknown as Play;
}

const show = (play: Play) => {
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(PaintPanel, { target, props: { play } });
  flushSync();
  return { target, app };
};

describe('PaintPanel', () => {
  it('見本を押すと、その色で setColor を呼ぶ', () => {
    const play = fake();
    const { target, app } = show(play);
    (target.querySelector('[data-swatch="#c62828"]') as HTMLButtonElement).click();
    expect(play.setColor).toHaveBeenCalledWith([198 / 255, 40 / 255, 40 / 255]);
    unmount(app);
  });

  it('前の色を押すと、前の色を今の色にする', () => {
    const play = fake();
    const { target, app } = show(play);
    (target.querySelector('button.previous') as HTMLButtonElement).click();
    expect(play.setColor).toHaveBeenCalledWith([0, 0, 1]);
    unmount(app);
  });

  it('R のスライダーを動かすと、筆の色が変わる', () => {
    const play = fake();
    const { target, app } = show(play);
    const r = target.querySelector('input[aria-label="R"]') as HTMLInputElement;
    r.value = '0.5';
    r.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(play.brush.color[0]).toBeCloseTo(0.5);
    unmount(app);
  });

  it('メタリックとラフネスのスライダーは筆の艶を変える', () => {
    const play = fake();
    const { target, app } = show(play);
    const m = target.querySelector('input[aria-label="メタリック"]') as HTMLInputElement;
    m.value = '1';
    m.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(play.brush.metal).toBe(1);
    unmount(app);
  });

  it('たたむと中身を隠す', () => {
    const { target, app } = show(fake());
    (target.querySelector('button.fold') as HTMLButtonElement).click();
    flushSync();
    expect(target.querySelector('[data-swatch]')).toBe(null);
    unmount(app);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/PaintPanel.svelte.test.ts`
Expected: FAIL（`./PaintPanel.svelte` が無い）。

- [ ] **Step 3: 部品を作る**

`src/lib/games/yappari-chameleon/HueRing.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let {
    hue,
    value,
    opacity,
    color,
    onhue,
    onvalue,
    onopacity
  }: {
    hue: number;
    value: number;
    opacity: number;
    color: string;
    onhue: (h: number) => void;
    onvalue: (v: number) => void;
    onopacity: (o: number) => void;
  } = $props();

  const SIZE = 150;
  let canvas: HTMLCanvasElement;

  onMount(() => {
    const g = canvas.getContext('2d')!;
    canvas.width = canvas.height = SIZE * 2;
    const grad = g.createConicGradient(-Math.PI / 2, SIZE, SIZE);
    for (let i = 0; i <= 12; i++) grad.addColorStop(i / 12, `hsl(${i * 30} 100% 50%)`);
    g.fillStyle = grad;
    g.beginPath();
    g.arc(SIZE, SIZE, SIZE, 0, Math.PI * 2);
    g.arc(SIZE, SIZE, SIZE * 0.72, 0, Math.PI * 2, true);
    g.fill();
  });

  function pick(e: PointerEvent) {
    if (e.type === 'pointerdown') (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    else if (!e.buttons && e.pointerType === 'mouse') return;
    const r = canvas.getBoundingClientRect();
    const a = Math.atan2(e.clientY - r.top - r.height / 2, e.clientX - r.left - r.width / 2);
    onhue((((a * 180) / Math.PI + 90) % 360 + 360) % 360);
  }
</script>

<div class="ring-row">
  <div class="ring">
    <canvas bind:this={canvas} onpointerdown={pick} onpointermove={(e) => e.buttons && pick(e)} aria-label="色相"></canvas>
    <span class="mark" style:rotate="{hue}deg"></span>
    <span class="now" style:background={color} style:opacity></span>
  </div>
  <input class="tall" type="range" min="0" max="1" step="0.01" value={value} oninput={(e) => onvalue(+e.currentTarget.value)} aria-label="明るさ" />
  <input class="tall" type="range" min="0.05" max="1" step="0.01" value={opacity} oninput={(e) => onopacity(+e.currentTarget.value)} aria-label="不透明度" />
</div>

<style>
  .ring-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .ring {
    position: relative;
    width: 150px;
    height: 150px;
  }

  canvas {
    width: 100%;
    height: 100%;
    touch-action: none;
  }

  .mark {
    position: absolute;
    left: 50%;
    top: 0;
    width: 6px;
    height: 50%;
    margin-left: -3px;
    transform-origin: 50% 100%;
    pointer-events: none;
    background: linear-gradient(#fff 0 22%, transparent 22%);
    filter: drop-shadow(0 0 2px #000);
  }

  .now {
    position: absolute;
    inset: 24%;
    border: 2px solid #fff;
    border-radius: 50%;
    pointer-events: none;
  }

  .tall {
    writing-mode: vertical-lr;
    direction: rtl;
    height: 140px;
    accent-color: #fff;
  }
</style>
```

`src/lib/games/yappari-chameleon/ColorSliders.svelte`:

```svelte
<script lang="ts">
  import type { RGB } from './color';

  let {
    hsv,
    rgb,
    metal,
    rough,
    onhsv,
    onrgb,
    onmetal,
    onrough
  }: {
    hsv: [number, number, number];
    rgb: RGB;
    metal: number;
    rough: number;
    onhsv: (v: [number, number, number]) => void;
    onrgb: (c: RGB) => void;
    onmetal: (v: number) => void;
    onrough: (v: number) => void;
  } = $props();

  const rows = $derived([
    { label: 'H', value: hsv[0], max: 360, set: (v: number) => onhsv([v, hsv[1], hsv[2]]) },
    { label: 'S', value: hsv[1], max: 1, set: (v: number) => onhsv([hsv[0], v, hsv[2]]) },
    { label: 'V', value: hsv[2], max: 1, set: (v: number) => onhsv([hsv[0], hsv[1], v]) },
    { label: 'R', value: rgb[0], max: 1, set: (v: number) => onrgb([v, rgb[1], rgb[2]]) },
    { label: 'G', value: rgb[1], max: 1, set: (v: number) => onrgb([rgb[0], v, rgb[2]]) },
    { label: 'B', value: rgb[2], max: 1, set: (v: number) => onrgb([rgb[0], rgb[1], v]) },
    { label: 'メタリック', value: metal, max: 1, set: onmetal },
    { label: 'ラフネス', value: rough, max: 1, set: onrough }
  ]);
</script>

<div class="rows">
  {#each rows as row (row.label)}
    <label class="row">
      <span class="name">{row.label}</span>
      <input
        type="range"
        min="0"
        max={row.max}
        step={row.max === 360 ? 1 : 0.01}
        value={row.value}
        oninput={(e) => row.set(+e.currentTarget.value)}
        aria-label={row.label}
      />
      <span class="num">{row.max === 360 ? Math.round(row.value) : row.value.toFixed(2)}</span>
    </label>
  {/each}
</div>

<style>
  .rows {
    display: grid;
    gap: 4px;
  }

  .row {
    display: grid;
    grid-template-columns: 5.5em 1fr 3em;
    align-items: center;
    gap: 6px;
    font-size: 13px;
  }

  input {
    accent-color: #fff;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
```

`src/lib/games/yappari-chameleon/Swatches.svelte`:

```svelte
<script lang="ts">
  import { fromHex, SWATCHES, toHex, type RGB } from './color';

  let {
    color,
    previous,
    recent,
    onpick
  }: { color: RGB; previous: RGB; recent: RGB[]; onpick: (c: RGB) => void } = $props();
</script>

<div class="pair">
  <span class="current" style:background={toHex(color)} aria-label="今の色"></span>
  <button class="previous" style:background={toHex(previous)} onclick={() => onpick(previous)} aria-label="前の色"></button>
</div>
{#if recent.length}
  <div class="line" aria-label="最近使った色">
    {#each recent as c, i (i)}
      <button class="chip" style:background={toHex(c)} onclick={() => onpick(c)} aria-label="最近の色 {i + 1}"></button>
    {/each}
  </div>
{/if}
<div class="grid">
  {#each SWATCHES as hex (hex)}
    <button class="chip" data-swatch={hex} style:background={hex} onclick={() => onpick(fromHex(hex))} aria-label={hex}></button>
  {/each}
</div>

<style>
  .pair {
    display: flex;
    gap: 6px;
  }

  .current,
  .previous {
    width: 44px;
    height: 28px;
    border: 2px solid #fff;
    border-radius: 6px;
  }

  .line {
    display: flex;
    gap: 4px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(14, 1fr);
    gap: 3px;
  }

  .chip {
    aspect-ratio: 1;
    min-width: 0;
    padding: 0;
    border: 1px solid rgb(255 255 255 / 0.6);
    border-radius: 4px;
  }

  .line .chip {
    width: 26px;
  }
</style>
```

`src/lib/games/yappari-chameleon/PaintPanel.svelte`:

```svelte
<script lang="ts">
  import { hsvToRgb, rgbToHsv, toHex, type RGB } from './color';
  import ColorSliders from './ColorSliders.svelte';
  import HueRing from './HueRing.svelte';
  import type { Play } from './play.svelte';
  import Swatches from './Swatches.svelte';

  let { play }: { play: Play } = $props();
  let open = $state(true);
  /** 色相は持っておく。彩度が 0（白・黒・灰色）になると RGB からは色相が戻らない */
  let hsv = $state<[number, number, number]>(rgbToHsv(play.brush.color));

  $effect.pre(() => {
    const c = play.brush.color;
    const mine = hsvToRgb(...hsv);
    if (c.every((v, i) => Math.abs(v - mine[i]) < 0.5 / 255)) return;
    const [h, s, v] = rgbToHsv(c);
    hsv = [s > 0 ? h : hsv[0], s, v];
  });

  function setHsv(next: [number, number, number]) {
    hsv = next;
    play.brush.color = hsvToRgb(...next);
  }

  function setRgb(c: RGB) {
    play.brush.color = c;
  }
</script>

<section class="panel" class:open aria-label="パレット">
  <button class="fold" onclick={() => (open = !open)}>{open ? 'パレットを とじる' : 'パレット'}</button>
  {#if open}
    <HueRing
      hue={hsv[0]}
      value={hsv[2]}
      opacity={play.brush.opacity}
      color={toHex(play.brush.color)}
      onhue={(h) => setHsv([h, hsv[1] || 1, hsv[2] || 1])}
      onvalue={(v) => setHsv([hsv[0], hsv[1], v])}
      onopacity={(o) => (play.brush.opacity = o)}
    />
    <Swatches color={play.brush.color} previous={play.previous} recent={play.recent} onpick={(c) => play.setColor(c)} />
    <ColorSliders
      {hsv}
      rgb={play.brush.color}
      metal={play.brush.metal}
      rough={play.brush.rough}
      onhsv={setHsv}
      onrgb={setRgb}
      onmetal={(v) => (play.brush.metal = v)}
      onrough={(v) => (play.brush.rough = v)}
    />
  {/if}
</section>

<style>
  .panel {
    position: absolute;
    top: max(70px, calc(env(safe-area-inset-top) + 58px));
    left: max(12px, env(safe-area-inset-left));
    display: grid;
    gap: 10px;
    width: 300px;
    max-height: calc(100% - 90px);
    overflow-y: auto;
    padding: 12px;
    border-radius: 14px;
    background: rgb(20 18 16 / 0.72);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    text-shadow: 0 1px 2px #000;
    touch-action: pan-y;
  }

  .panel:not(.open) {
    width: auto;
  }

  .fold {
    justify-self: start;
    padding: 6px 12px;
    border: 1px solid rgb(255 255 255 / 0.8);
    border-radius: 999px;
    background: transparent;
    color: #fff;
    font: inherit;
  }
</style>
```

色相の輪を回したとき、白や黒（彩度か明るさが 0）のままでは色が変わって見えないので、0 なら 1 にして色を出す（`onhue` の `|| 1`）。

`Chameleon.svelte` の `{#if play.mode === 'paint'}` の中に `<PaintPanel {play} />` を足し、`import PaintPanel from './PaintPanel.svelte';` を足す。

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/PaintPanel.svelte.test.ts && pnpm format && pnpm check && pnpm lint`
Expected: PASS。happy-dom に `createConicGradient` が無くて落ちるときは、`HueRing.svelte` の `onMount` の描画を `if (!g || !('createConicGradient' in g)) return;` で守る（コメントに「テストの DOM には無い」と書く）。

- [ ] **Step 5: 画面で確かめる**

`accept.mjs` と同じ起動で、ペイントモードに入った画面を撮る（`play.togglePaint()` のあと 0.5 秒待つ）。パネル・ブラシの大きさ・右のボタンが重ならず、人形が画面の真ん中に見えることを確かめる。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Add the color panel from the original's paint mode"
```

### Task 11: ポーズの輪と、向きロック・その場で回る

本家の R 長押しの輪をタッチにする。「ポーズ」ボタンに指を置いたまま項目へ滑らせて離すと決まり、ボタンを軽く押しただけなら輪が開いたままになって項目を押して選べる。輪の左右の矢印でページ（6 種ずつ）を替え、下の × で立ち姿に戻す。本家の回転ロック（向きを変えずに横や後ろへ歩く）とその場で回転を「向きロック」と左右の回るボタンにする。

**Files:**
- Create: `src/lib/games/yappari-chameleon/PoseWheel.svelte`
- Modify: `src/lib/games/yappari-chameleon/play.svelte.ts`（`pose`・`lock`・`held.turn`・`setPose()`・`toggleLock()`・`wheel`）
- Modify: `src/lib/games/yappari-chameleon/Buttons.svelte`（ポーズ・向きロック・回るボタン）
- Modify: `src/lib/games/yappari-chameleon/Chameleon.svelte`（輪を出す）
- Modify: `src/lib/games/yappari-chameleon/Buttons.svelte.test.ts`
- Test: `src/lib/games/yappari-chameleon/play.svelte.test.ts`
- Test: `src/lib/games/yappari-chameleon/PoseWheel.svelte.test.ts`

**Interfaces:**
- Consumes: `POSES`・`STAND`・`poseById`（Task 7）、`World.poses`（Task 9）。
- Produces（`Play` に足す）: `pose = $state('stand')`、`lock = $state(false)`、`wheel = $state<{ id: number } | { id: null } | null>(null)`（開いた輪と、開いた指。軽く押して開いたら `id: null`）、`held.turn: number`（−1・0・1）、`setPose(id: string): void`、`toggleLock(): void`、`openWheel(id: number | null): void`、`closeWheel(): void`。
- Produces: `PoseWheel.svelte`（props `{ play: Play }`）。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/play.svelte.test.ts`（three を使わない偽の World で、張り付いたままのポーズ・ペイント・鬼の目と、向きロックを確かめる）:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { Level } from './move';
import { RADIUS } from './move';
import { Play } from './play.svelte';
import type { World } from './world3d';

const level: Level = {
  boxes: [
    { min: [-10, -1, -10], max: [10, 0, 10] },
    { min: [-10, 0, 5], max: [10, 3, 5.3] },
    { min: [-10, 3, -10], max: [10, 3.3, 10] }
  ],
  ramps: [],
  spawn: [0, 0, 0]
};

function fakeWorld() {
  return {
    level,
    placeDoll: vi.fn(),
    poses: { step: vi.fn(), to: vi.fn() },
    follow: vi.fn(),
    eye: vi.fn(),
    render: vi.fn(),
    dollCenter: () => [0, 0.6, 0],
    camera: { position: { x: 0, y: 1, z: -2 } },
    rig: { mesh: { receiveShadow: true }, paint: { rebuild: vi.fn(), apply: vi.fn() } }
  } as unknown as World;
}

const run = (p: Play, secs: number) => {
  for (let t = 0; t < secs; t += 1 / 60) p.frame(1 / 60, performance.now());
};

function clinging() {
  const p = new Play(fakeWorld(), 70);
  p.body.pos = [0, 0, 5 - RADIUS - 0.05];
  run(p, 0.2);
  p.jump();
  run(p, 0.1);
  return p;
}

describe('Play', () => {
  it('壁に張り付いたままポーズを変えても、壁から外れない', () => {
    const p = clinging();
    p.held.up = true;
    run(p, 0.5);
    p.held.up = false;
    const y = p.body.pos[1];
    p.setPose('curl');
    run(p, 1);
    expect(p.body.cling?.kind).toBe('wall');
    expect(p.body.pos[1]).toBeCloseTo(y, 5);
    expect(p.pose).toBe('curl');
  });

  it('張り付いたままペイントと鬼の目に出入りしても、張り付いたまま', () => {
    const p = clinging();
    p.togglePaint();
    run(p, 1);
    p.togglePaint();
    p.toggleEye();
    run(p, 1);
    p.toggleEye();
    run(p, 0.2);
    expect(p.body.cling?.kind).toBe('wall');
  });

  it('天井にいるまま鬼の目に出入りしても、天井にいる', () => {
    const p = clinging();
    p.held.up = true;
    run(p, 4);
    p.held.up = false;
    expect(p.body.cling?.kind).toBe('ceiling');
    p.toggleEye();
    run(p, 1);
    p.toggleEye();
    run(p, 0.2);
    expect(p.body.cling?.kind).toBe('ceiling');
  });

  it('向きロックのあいだは、回るボタンで向きだけが変わる', () => {
    const p = new Play(fakeWorld(), 70);
    run(p, 0.2);
    p.toggleLock();
    p.held.turn = 1;
    run(p, 0.5);
    p.held.turn = 0;
    expect(p.body.yaw).toBeGreaterThan(0.5);
    const yaw = p.body.yaw;
    p.pointer('down', 1, 100, 400, 1000);
    p.pointer('move', 1, 170, 400, 1000);
    run(p, 0.5);
    expect(p.body.yaw).toBeCloseTo(yaw, 5);
  });

  it('輪で選んだポーズを人形に当てる', () => {
    const w = fakeWorld();
    const p = new Play(w, 70);
    p.setPose('lie');
    expect(w.poses.to).toHaveBeenCalledWith(expect.objectContaining({ id: 'lie' }));
    p.setPose('stand');
    expect(p.pose).toBe('stand');
  });
});
```

`src/lib/games/yappari-chameleon/PoseWheel.svelte.test.ts`:

```ts
import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import PoseWheel from './PoseWheel.svelte';
import type { Play } from './play.svelte';

function fake() {
  return { pose: 'stand', wheel: { id: null }, setPose: vi.fn(), closeWheel: vi.fn() } as unknown as Play;
}

describe('PoseWheel', () => {
  it('1 ページめに 6 種、矢印で次の 6 種が出る', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PoseWheel, { target, props: { play: fake() } });
    flushSync();
    const names = () => [...target.querySelectorAll('.item')].map((b) => b.textContent?.trim());
    expect(names()).toEqual(['丸まる', '寝そべる', 'しゃがむ', 'あぐら', 'ブリッジ', 'Tポーズ']);
    (target.querySelector('button.next') as HTMLButtonElement).click();
    flushSync();
    expect(names()).toEqual(['片足立ち', '寄りかかる', '開脚', '前屈', 'ワシ', 'のけぞり']);
    unmount(app);
  });

  it('項目を押すとそのポーズにして閉じ、× で立ち姿に戻す', () => {
    const play = fake();
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PoseWheel, { target, props: { play } });
    flushSync();
    (target.querySelectorAll('.item')[0] as HTMLButtonElement).click();
    expect(play.setPose).toHaveBeenCalledWith('curl');
    expect(play.closeWheel).toHaveBeenCalled();
    (target.querySelector('button.clear') as HTMLButtonElement).click();
    expect(play.setPose).toHaveBeenCalledWith('stand');
    unmount(app);
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/play.svelte.test.ts src/lib/games/yappari-chameleon/PoseWheel.svelte.test.ts`
Expected: FAIL（`setPose`・`toggleLock`・`PoseWheel.svelte` が無い）。

- [ ] **Step 3: `Play` に足す**

`play.svelte.ts` の import に `import { poseById, STAND } from './poses';` を足し、クラスに足す。

```ts
  pose = $state('stand');
  lock = $state(false);
  wheel = $state<{ id: number | null } | null>(null);
```

`readonly held = { up: false, down: false };` を `readonly held = { up: false, down: false, turn: 0 };` にする。メソッドを足す。

```ts
  setPose(id: string): void {
    const p = id === STAND.id ? STAND : poseById(id);
    this.pose = p.id;
    this.world.poses.to(p);
  }

  toggleLock(): void {
    this.lock = !this.lock;
    this.held.turn = 0;
  }

  openWheel(id: number | null): void {
    this.wheel = { id };
  }

  closeWheel(): void {
    this.wheel = null;
  }
```

`#input` の返り値に `lock: this.lock, turn: this.held.turn,` を足す。

- [ ] **Step 4: `PoseWheel.svelte` を作る**

輪の中心は画面の真ん中。項目は 6 つを輪の上から時計回りに並べる。指を置いたまま開いたとき（`play.wheel.id` が数）は、その指の動きを window で聞き、中心から 50px より外で指した項目を光らせ、離したらそれに決めて閉じる。中心の近くで離したら、選ばずに開いたままにする（項目を押して選べる）。

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Play } from './play.svelte';
  import { POSES, STAND } from './poses';

  let { play }: { play: Play } = $props();
  let page = $state(0);
  let lit = $state<number | null>(null);
  let wheel: HTMLDivElement;
  const PER = 6;
  const items = $derived(POSES.slice(page * PER, page * PER + PER));

  function choose(id: string) {
    play.setPose(id);
    play.closeWheel();
  }

  function aim(e: PointerEvent) {
    const r = wheel.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    if (Math.hypot(dx, dy) < 50) return (lit = null);
    const a = (Math.atan2(dx, -dy) + Math.PI * 2) % (Math.PI * 2);
    lit = Math.round(a / ((Math.PI * 2) / PER)) % PER;
  }

  onMount(() => {
    const move = (e: PointerEvent) => {
      if (play.wheel?.id === e.pointerId) aim(e);
    };
    const up = (e: PointerEvent) => {
      if (play.wheel?.id !== e.pointerId) return;
      if (lit !== null) choose(items[lit].id);
      else play.openWheel(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  });
</script>

<div class="veil" role="presentation" onpointerdown={(e) => e.target === e.currentTarget && play.closeWheel()}>
  <div class="wheel" bind:this={wheel}>
    {#each items as p, i (p.id)}
      <button
        class="item"
        class:lit={lit === i}
        class:now={play.pose === p.id}
        style:rotate="{(i * 360) / PER}deg"
        onclick={() => choose(p.id)}
      >
        <span style:rotate="{(-i * 360) / PER}deg">{p.label}</span>
      </button>
    {/each}
    <button class="arrow prev" onclick={() => (page = (page + 1) % 2)} aria-label="前のページ">‹</button>
    <button class="arrow next" onclick={() => (page = (page + 1) % 2)} aria-label="次のページ">›</button>
    <button class="clear" onclick={() => choose(STAND.id)} aria-label="ポーズを解く">×</button>
  </div>
</div>

<style>
  .veil {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgb(0 0 0 / 0.25);
  }

  .wheel {
    position: relative;
    width: 340px;
    height: 340px;
    border-radius: 50%;
    background: rgb(20 18 16 / 0.6);
    font-family: 'Hiragino Mincho ProN', serif;
  }

  .item {
    position: absolute;
    left: 50%;
    top: 0;
    width: 96px;
    height: 170px;
    margin-left: -48px;
    padding-top: 22px;
    transform-origin: 50% 100%;
    border: 0;
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 17px;
    text-shadow: 0 1px 3px #000;
  }

  .item span {
    display: inline-block;
    padding: 8px 10px;
    border: 2px solid rgb(255 255 255 / 0.7);
    border-radius: 12px;
    background: rgb(0 0 0 / 0.35);
  }

  .item.lit span {
    border-color: #6ec6ff;
    background: rgb(40 130 220 / 0.85);
  }

  .item.now span {
    border-color: #fff;
  }

  .arrow,
  .clear {
    position: absolute;
    width: 48px;
    height: 48px;
    border: 2px solid rgb(255 255 255 / 0.85);
    border-radius: 50%;
    background: rgb(0 0 0 / 0.45);
    color: #fff;
    font-size: 26px;
  }

  .prev {
    left: -64px;
    top: calc(50% - 24px);
  }

  .next {
    right: -64px;
    top: calc(50% - 24px);
  }

  .clear {
    left: calc(50% - 24px);
    bottom: -64px;
  }
</style>
```

前のページの矢印も 2 ページを行き来するだけなので、`(page + 1) % 2` でよい（ページを増やしたら `(page - 1 + pages) % pages` にする）。

- [ ] **Step 5: ボタンと画面に足す**

`Buttons.svelte` の歩くときの並びを、ジャンプ・ポーズ・ペイント・鬼の目・向きロックにする。張り付いているときは、上がる・さがる・はなす・ポーズ・ペイントにする。ポーズのボタンは、押した指で輪を開く。

```svelte
<button
  class="btn"
  class:on={play.pose !== 'stand'}
  onpointerdown={(e) => play.openWheel(e.pointerId)}
>
  <Icon name="figure" size="30px" />
  <span>ポーズ</span>
</button>
```

これを `{#snippet pose()}` にして、歩くときと張り付いているときの並びの 2 か所で `{@render pose()}` する。向きロックは `{@render button('lock', '向きロック', () => play.toggleLock(), play.lock)}`。ロック中は、列の左に回るボタンを 2 つ並べる（押しているあいだだけ `play.held.turn` を −1 / 1 にする）。

```svelte
{#if play.lock && play.mode === 'walk' && !play.cling}
  <div class="spin">
    <button
      class="btn"
      onpointerdown={() => (play.held.turn = 1)}
      onpointerup={() => (play.held.turn = 0)}
      onpointercancel={() => (play.held.turn = 0)}
      onpointerleave={() => (play.held.turn = 0)}
      aria-label="左へ回る"
    >
      <span class="mirror"><Icon name="spin" size="30px" /></span>
    </button>
    <button
      class="btn"
      onpointerdown={() => (play.held.turn = -1)}
      onpointerup={() => (play.held.turn = 0)}
      onpointercancel={() => (play.held.turn = 0)}
      onpointerleave={() => (play.held.turn = 0)}
      aria-label="右へ回る"
    >
      <Icon name="spin" size="30px" />
    </button>
  </div>
{/if}
```

```css
  .spin {
    position: absolute;
    right: calc(max(14px, env(safe-area-inset-right)) + 86px);
    bottom: max(14px, env(safe-area-inset-bottom));
    display: flex;
    gap: 10px;
  }

  .mirror {
    display: inline-flex;
    scale: -1 1;
  }
```

`yaw` は正で左（+x）へ回るので、左へ回るボタンが `turn = 1`。

`Chameleon.svelte` の `<Buttons ... />` の前に `{#if play.wheel}<PoseWheel {play} />{/if}` を足し、`import PoseWheel from './PoseWheel.svelte';` を足す。

`Buttons.svelte.test.ts` の期待する並びを直す。歩くときは `['ジャンプ', 'ポーズ', 'ペイント', '鬼の目', '向きロック']`、張り付いているときは `['上がる', 'さがる', 'はなす', 'ポーズ', 'ペイント']`。偽の `Play` に `pose: 'stand'`・`lock: false`・`openWheel: vi.fn()`・`toggleLock: vi.fn()`・`held.turn: 0` を足す。

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm format && pnpm check && pnpm lint && pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 7: 画面で確かめる**

`accept.mjs` と同じ起動で、`play.openWheel(null)` のあと 0.3 秒待って輪を撮り、`play.setPose('curl')` のあと 0.5 秒待って丸まった人形を撮る。輪の項目の字が読め、丸まった人形が球のように見えることを確かめる。

- [ ] **Step 8: Commit**

```bash
git add src/lib/games/yappari-chameleon
git commit -m "Add the pose wheel, rotation lock and turning in place"
```

### Task 12: 物の陰の自分を透かす・カメラを壁の手前で止める

本家の「貫通描画」（物の陰にいる自分のまわりだけを丸く透かして見せる）を、屋敷の材質のシェーダーに足す。画面上の自分の位置から半径の中で、自分より手前にある物の画素を、4 × 4 の点々で抜く（中ほど多く抜き、ふちへ向かって少なくする）。影を描くパスは変えないので、影は抜けない。鬼の目では透かさない。三人称のカメラは、壁で縮むときはすぐ、伸びるときはゆっくり戻す。

**Files:**
- Create: `src/lib/games/yappari-chameleon/xray.ts`
- Modify: `src/lib/games/yappari-chameleon/world3d.ts`（`setStage` で屋敷の材質に `seeThrough` を当てる・`xray(on)`・カメラの距離をなめらかにする）
- Modify: `src/lib/games/yappari-chameleon/play.svelte.ts`（毎フレーム `world.xray(this.mode !== 'eye')`）
- Modify: `src/lib/games/yappari-chameleon/test-room.ts`（白い柱を 1 本足す）

**Interfaces:**
- Produces（`xray.ts`）: `XRAY`（4 つの uniform `center`・`radius`・`depth`・`on`）、`seeThrough(m: THREE.Material): void`。
- Produces（`World` に足す）: `xray(on: boolean): void`（`render()` の前に呼ぶ。自分の画面の位置と深さを uniform に入れる）。

- [ ] **Step 1: `xray.ts` を作る**

```ts
import * as THREE from 'three';

export const XRAY = {
  center: { value: new THREE.Vector2() },
  radius: { value: 0 },
  depth: { value: 0 },
  on: { value: 0 }
};

const HEAD = /* glsl */ `
uniform vec2 uXrayCenter;
uniform float uXrayRadius;
uniform float uXrayDepth;
uniform float uXrayOn;
float xrayBayer(vec2 p) {
  ivec2 i = ivec2(mod(p, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i.x + i.y * 4]) + 0.5) / 16.0;
}`;

const CUT = /* glsl */ `
if (uXrayOn > 0.5) {
  float xd = distance(gl_FragCoord.xy, uXrayCenter);
  if (xd < uXrayRadius && -vViewPosition.z < uXrayDepth) {
    float edge = smoothstep(uXrayRadius * 0.55, uXrayRadius, xd);
    if (xrayBayer(gl_FragCoord.xy) > edge) discard;
  }
}`;

/** 屋敷の材質に、自分のまわりを透かす処理を足す。同じ材質に 2 度は足さない */
export function seeThrough(m: THREE.Material): void {
  if (!(m instanceof THREE.MeshStandardMaterial) || m.userData.xray) return;
  m.userData.xray = true;
  m.onBeforeCompile = (s) => {
    s.uniforms.uXrayCenter = XRAY.center;
    s.uniforms.uXrayRadius = XRAY.radius;
    s.uniforms.uXrayDepth = XRAY.depth;
    s.uniforms.uXrayOn = XRAY.on;
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEAD}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${CUT}`);
  };
  m.customProgramCacheKey = () => 'chameleon-xray';
}
```

- [ ] **Step 2: `World` に足す**

`world3d.ts` に `import { seeThrough, XRAY } from './xray';` を足す。`setStage` で、組み立てた屋敷の材質に当てる。

```ts
    b.group.traverse((o) => {
      const m = (o as THREE.Mesh).material;
      if (m) for (const one of Array.isArray(m) ? m : [m]) seeThrough(one);
    });
```

`xray` を足す。

```ts
  /** 自分の画面の位置（描画の画素、左下が原点）と、自分までの深さを入れる */
  xray(on: boolean): void {
    XRAY.on.value = on ? 1 : 0;
    if (!on) return;
    const c = new THREE.Vector3(...this.dollCenter());
    const view = c.clone().applyMatrix4(this.camera.matrixWorldInverse);
    const dist = -view.z;
    const pr = this.renderer.getPixelRatio();
    const s = this.project([c.x, c.y, c.z]);
    const perMeter = (this.#h * pr) / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) / Math.max(dist, 0.1);
    XRAY.center.value.set(s.x * pr, (this.#h - s.y) * pr);
    XRAY.radius.value = 0.7 * perMeter;
    XRAY.depth.value = dist - 0.3;
  }
```

`follow` の距離をなめらかにする。クラスに `#dist = 2.4;` を足し、`follow` の `const d = ...` を次にする。

```ts
    const want = Math.max(0.3, Math.min(dist, rayDistance(this.level, target, dir, dist) - 0.15));
    // 壁で縮むときは壁の向こうが見えないようすぐ寄せ、離れるときはゆっくり戻す
    this.#dist = want < this.#dist ? want : this.#dist + (want - this.#dist) * 0.08;
    const d = this.#dist;
```

`play.svelte.ts` の `frame` の `w.render();` の前に `w.xray(this.mode !== 'eye');` を足す。カメラの位置は `follow`・`eye` が決めたあとなので、`camera.updateMatrixWorld()` を `xray` の先頭で呼ぶ。

- [ ] **Step 3: 試しの部屋に柱を足す**

`test-room.ts` の `testRoom()` の中、`const t = 0.3;` の前に足す。当たりの箱も `boxes` に足す。

```ts
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, H, 0.6), finish({ tint: '#f1ece2', rough: 0.5 }, [0.6, H]));
  pillar.position.set(2, H / 2, 1);
  pillar.castShadow = pillar.receiveShadow = true;
  group.add(pillar);
```

```ts
    { min: [1.7, 0, 0.7], max: [2.3, H, 1.3] }
```

- [ ] **Step 4: 通ることを確かめる**

Run: `pnpm format && pnpm check && pnpm lint && pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS（`play.svelte.test.ts` の偽の World に `xray: vi.fn()` を足す）。

- [ ] **Step 5: 画面で確かめる**

`accept.mjs` と同じ起動で、体を柱の向こう（`body.pos = [2, 0, 2]`）に置き、`camYaw = 0`・`camPitch = 0.15` で柱越しに見る位置から撮る（カメラは体の後ろ −z 側、柱は体とカメラのあいだ）。柱の自分のまわりが丸く点々に抜けて人形が見え、柱の影は抜けていないことを確かめる。鬼の目（`play.toggleEye()`）では抜けないことも撮って確かめる。

- [ ] **Step 6: Commit**

```bash
git add src/lib/games/yappari-chameleon
git commit -m "See the doll through things in front of it and ease the camera off walls"
```

### Task 13: 屋敷の模様

本家のかくれんぼ屋敷の模様を canvas で描く。濃い茶の板張りの壁・腰の羽目板・木の格天井・クリームの大理石に黒い菱形の床・赤い柄の絨毯・本棚の背表紙（3〜6cm 幅の色の帯）・古いポスター・茶色の革。どの模様も、線と目を 2cm 以上にして体に写せるようにする。組み立てる前に、模様を並べた 1 枚のシートを見せて、雰囲気が本家から外れていないかを確かめる。

**Files:**
- Modify: `src/lib/games/yappari-chameleon/textures.ts`（模様を 8 つ足す）
- Create（リポジトリに入れない）: `<scratchpad>/texture-sheet.mjs`

**Interfaces:**
- Produces: `woodPanel()`・`wainscot()`・`coffer()`・`marble()`・`rug()`・`books()`・`poster()`・`leather()`。どれも引数なしで `Pattern` を返す（同じ模様は 1 度だけ描く）。`meters` はそれぞれ `[0.6, 1.2]`・`[1.2, 1.0]`・`[1.5, 1.5]`・`[1.2, 1.2]`・`[2.4, 3.6]`・`[1.2, 0.47]`・`[0.5, 0.75]`・`[0.4, 0.4]`。

- [ ] **Step 1: 模様を足す**

`textures.ts` の末尾（`Finish` の前）に足す。

```ts
/** 大広間の濃い茶の板張り。縦の板 4 枚（1 枚 15cm）に木目と板の継ぎ目 */
export function woodPanel(): Pattern {
  return make('wood-panel', 256, 512, [0.6, 1.2], (g) => {
    const r = rng(5);
    for (let i = 0; i < 4; i++) {
      const base = 22 + r() * 8;
      g.fillStyle = `hsl(24 45% ${base}%)`;
      g.fillRect(i * 64, 0, 64, 512);
      for (let k = 0; k < 12; k++) {
        g.strokeStyle = `hsl(22 40% ${base - 7 + r() * 6}% / 0.7)`;
        g.lineWidth = 2 + r() * 3;
        g.beginPath();
        const x0 = i * 64 + 6 + r() * 52;
        g.moveTo(x0, 0);
        for (let y = 0; y <= 512; y += 32) g.lineTo(x0 + Math.sin(y / 70 + k) * 4, y);
        g.stroke();
      }
      g.fillStyle = '#1a0f08';
      g.fillRect(i * 64, 0, 4, 512);
    }
  });
}

/** 緑の廊下の腰の羽目板（高さ 1m）。木の枠に、一段下がった鏡板 */
export function wainscot(): Pattern {
  return make('wainscot', 512, 427, [1.2, 1.0], (g) => {
    g.fillStyle = '#5a3a22';
    g.fillRect(0, 0, 512, 427);
    g.fillStyle = '#3e2615';
    g.fillRect(0, 0, 512, 34);
    for (const x of [26, 282]) {
      g.fillStyle = '#4a2e1a';
      g.fillRect(x, 64, 204, 320);
      g.strokeStyle = '#7a5434';
      g.lineWidth = 6;
      g.strokeRect(x + 14, 78, 176, 292);
      g.strokeStyle = '#2a190c';
      g.lineWidth = 4;
      g.strokeRect(x + 4, 68, 196, 312);
    }
  });
}

/** 大広間の木の格天井。梁の格子と、くぼんだ升の真ん中に金の花 */
export function coffer(): Pattern {
  return make('coffer', 512, 512, [1.5, 1.5], (g) => {
    g.fillStyle = '#5a3a22';
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#3b2414';
    g.fillRect(48, 48, 416, 416);
    g.strokeStyle = '#7a5434';
    g.lineWidth = 10;
    g.strokeRect(80, 80, 352, 352);
    g.fillStyle = '#c9a227';
    g.beginPath();
    g.arc(256, 256, 40, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8a6a1a';
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.ellipse(256 + Math.cos((i * Math.PI) / 4) * 58, 256 + Math.sin((i * Math.PI) / 4) * 58, 18, 9, (i * Math.PI) / 4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 大広間の床。クリームの大理石（1 枚 60cm）に灰色の筋と、目地の交わりに黒い菱形 */
export function marble(): Pattern {
  return make('marble', 512, 512, [1.2, 1.2], (g) => {
    const r = rng(17);
    g.fillStyle = '#e9e0cf';
    g.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 14; k++) {
      g.strokeStyle = `rgb(120 110 100 / ${0.15 + r() * 0.2})`;
      g.lineWidth = 1.5 + r() * 2.5;
      g.beginPath();
      let x = r() * 512;
      let y = r() * 512;
      g.moveTo(x, y);
      for (let s = 0; s < 12; s++) {
        x += (r() - 0.3) * 60;
        y += (r() - 0.5) * 50;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = '#b8ad9a';
    g.lineWidth = 3;
    for (const v of [0, 256, 512]) {
      g.beginPath();
      g.moveTo(v, 0);
      g.lineTo(v, 512);
      g.moveTo(0, v);
      g.lineTo(512, v);
      g.stroke();
    }
    g.fillStyle = '#151311';
    for (const x of [0, 256, 512])
      for (const y of [0, 256, 512]) {
        g.beginPath();
        g.moveTo(x, y - 34);
        g.lineTo(x + 34, y);
        g.lineTo(x, y + 34);
        g.lineTo(x - 34, y);
        g.fill();
      }
  });
}

/** ピアノの下の赤い柄の絨毯（2.4m × 3.6m を 1 枚で） */
export function rug(): Pattern {
  return make('rug', 512, 768, [2.4, 3.6], (g) => {
    g.fillStyle = '#8e1b1b';
    g.fillRect(0, 0, 512, 768);
    g.strokeStyle = '#1f2a4d';
    g.lineWidth = 34;
    g.strokeRect(17, 17, 478, 734);
    g.strokeStyle = '#c9a227';
    g.lineWidth = 10;
    g.strokeRect(46, 46, 420, 676);
    g.fillStyle = '#1f2a4d';
    g.beginPath();
    g.ellipse(256, 384, 130, 200, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c9a227';
    g.beginPath();
    g.ellipse(256, 384, 70, 110, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8e1b1b';
    g.beginPath();
    g.ellipse(256, 384, 30, 50, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c9a227';
    for (const [x, y] of [
      [110, 140],
      [402, 140],
      [110, 628],
      [402, 628]
    ]) {
      g.beginPath();
      g.arc(x, y, 26, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 本棚の 1 段（幅 1.2m、高さ 47cm）。背表紙は 3〜6cm 幅で、上下に金の帯 */
export function books(): Pattern {
  return make('books', 512, 200, [1.2, 0.47], (g) => {
    const r = rng(31);
    const colors = ['#7a1f2b', '#2f4f6f', '#3e5b3a', '#b87333', '#d8c39a', '#1d1a17', '#6b2d5c', '#c9a227', '#8b5a2b', '#efe6d2'];
    g.fillStyle = '#24160c';
    g.fillRect(0, 0, 512, 200);
    let x = 4;
    while (x < 500) {
      const w = Math.min(500 - x, 13 + Math.floor(r() * 13));
      const h = 120 + Math.floor(r() * 54);
      const c = colors[Math.floor(r() * colors.length)];
      g.fillStyle = c;
      g.fillRect(x, 184 - h, w - 2, h);
      g.fillStyle = '#d4af37';
      g.fillRect(x, 184 - h + 10, w - 2, 3);
      g.fillRect(x, 184 - 16, w - 2, 3);
      if (r() < 0.4) {
        g.fillStyle = 'rgb(0 0 0 / 0.35)';
        g.fillRect(x + 3, 184 - h + 30, w - 8, 18);
      }
      x += w;
    }
    g.fillStyle = '#5a3a22';
    g.fillRect(0, 184, 512, 16);
  });
}

/** 緑の廊下の古いポスター（人物の絵と文字の帯） */
export function poster(): Pattern {
  return make('poster', 256, 384, [0.5, 0.75], (g) => {
    const r = rng(43);
    g.fillStyle = '#d9c9a3';
    g.fillRect(0, 0, 256, 384);
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgb(120 90 50 / ${r() * 0.12})`;
      g.beginPath();
      g.arc(r() * 256, r() * 384, 10 + r() * 40, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#5b3a24';
    g.fillRect(28, 26, 200, 26);
    g.beginPath();
    g.arc(128, 150, 46, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(128, 270, 90, 70, 0, Math.PI, 0);
    g.fill();
    g.fillRect(48, 300, 160, 14);
    g.fillRect(70, 326, 116, 10);
    g.strokeStyle = '#5b3a24';
    g.lineWidth = 6;
    g.strokeRect(10, 10, 236, 364);
  });
}

/** チェスターフィールドのソファの茶色の革。菱形に並んだ鋲のくぼみ */
export function leather(): Pattern {
  return make('leather', 256, 256, [0.4, 0.4], (g) => {
    const r = rng(53);
    g.fillStyle = '#6b3f22';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgb(${r() < 0.5 ? '40 20 10' : '140 90 55'} / 0.08)`;
      g.fillRect(r() * 256, r() * 256, 3, 3);
    }
    for (const [x, y] of [
      [0, 0],
      [128, 128],
      [256, 0],
      [0, 256],
      [256, 256]
    ]) {
      const grad = g.createRadialGradient(x, y, 2, x, y, 60);
      grad.addColorStop(0, 'rgb(20 10 5 / 0.7)');
      grad.addColorStop(1, 'rgb(20 10 5 / 0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, 60, 0, Math.PI * 2);
      g.fill();
    }
  });
}
```

- [ ] **Step 2: 型と lint を通す**

Run: `pnpm format && pnpm check && pnpm lint`
Expected: PASS。

- [ ] **Step 3: 模様のシートを撮る**

scratchpad に `texture-sheet.mjs` を書く。Task 5 の起動の形で、`page.evaluate` の中で `textures.ts` を import し、`damask('#3f5e3a', '#5f8255')`・`damask('#2f4f6f', '#4a6f94')`・`damask('#7a1f2b', '#9c3a46')`・`checker()`・`oilPainting()` と Step 1 の 8 つの `canvas` を、1 枚の canvas に 5 列で並べ（どれも 1m を 200px にそろえ、模様を 2 回ずつ繰り返して継ぎ目が見えるように）、名前を添えて PNG にする。

Run: `node <scratchpad>/texture-sheet.mjs <scratchpad>`
Expected: `textures.png` に 13 の模様が写る。次を確かめる。
- 繰り返しの継ぎ目で、模様が切れて見えない（ダマスクの四隅の花・市松・大理石の菱形・板の継ぎ目）。
- どの線も、1m = 200px の大きさで 4px（2cm）より細くない。

- [ ] **Step 4: 雰囲気を確かめてもらう**

`textures.png` を作業の担当へ返す。担当はユーザーに見せ、本家の屋敷の雰囲気との違いを聞いてから Task 14 へ進む。直すのは `textures.ts` の色と形だけ。

- [ ] **Step 5: Commit**

```bash
git add src/lib/games/yappari-chameleon/textures.ts
git commit -m "Draw the mansion's patterns on canvas"
```

### Task 14: 屋敷の大広間と緑の廊下

本家のかくれんぼ屋敷の 2 部屋を作る。大広間は 2 階まで吹き抜け（14m × 12m、高さ 7m）で、奥に 2 階の回廊（奥行 3m、高さ 3.5m）、真ん中に回廊へ上がる大階段、木の格天井と金のシャンデリア 3 つ、黒いグランドピアノと赤い柄の絨毯、丸テーブルと椅子、回廊を支える白い円柱 4 本、リボンのすだれ、風船の房、三角旗、2 階に白い馬の像と布の飾り。大広間の西の壁の出入口（幅 1.5m）から緑の廊下（16m × 3.5m、高さ 3.5m）へつながり、緑のダマスクの壁紙・腰の羽目板・白黒の市松の床・パステルの三角旗・壁の燭台・大理石の花瓶・古いポスター・茶色の革のソファ・金の額の油絵・ベンチ・床の風船・突き当たりの本棚を置く。並び（壁・床・家具の位置と当たり）は three を使わない `layout.ts` に持ち、組み立ては `build.ts`、家具の形は `furniture.ts` に置く。試しの部屋は使わなくなるので消す。

座標は大広間の南西の角の床を基準にせず、大広間の南の壁の真ん中の床を原点にする（x は東が正、z は北が正）。大広間は x −7〜7・z 0〜12、緑の廊下は x −23〜−7・z 3.25〜6.75。

**Files:**
- Create: `src/lib/games/yappari-chameleon/mansion/layout.ts`
- Create: `src/lib/games/yappari-chameleon/mansion/furniture.ts`
- Create: `src/lib/games/yappari-chameleon/mansion/build.ts`
- Test: `src/lib/games/yappari-chameleon/mansion/layout.test.ts`
- Modify: `src/lib/games/yappari-chameleon/Chameleon.svelte`（`testRoom()` を `buildMansion()` にする）
- Delete: `src/lib/games/yappari-chameleon/test-room.ts`
- Create（リポジトリに入れない）: `<scratchpad>/room-sheet.mjs`、`<scratchpad>/accept.mjs` を直す

**Interfaces:**
- Consumes: `Box`・`Level`・`Ramp`・`step`・`newBody`・`idle`（Task 6）、`finish`・模様（Task 9・13）、`Built`（Task 9）、`seeThrough` は `World.setStage` が当てる（Task 12）。
- Produces（`layout.ts`）:
  - `type Mat = 'woodPanel' | 'marble' | 'coffer' | 'checker' | 'greenDamask' | 'wainscot' | 'cream' | 'rail'`、`type Face = 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-'`。
  - `interface Slab { min: V3; max: V3; mat: Mat; face: Face; shadow?: boolean }`（壁・床・天井・手すりの板。どれも当たる）。
  - `type Kind`（家具の種類 21 個）、`interface Piece { kind: Kind; at: V3; turn: 0 | 1 | 2 | 3; span?: number }`（`turn` は 90 度ずつ。0 で正面が +z）。
  - `SIZES: Record<Kind, V3 | null>`（当たりの幅・高さ・奥行。null は当たらない飾り）。
  - `interface Mansion { slabs: Slab[]; pieces: Piece[]; ramps: Ramp[]; spawn: V3; lights: { at: V3; color: string; power: number; reach: number }[] }`。
  - `mansion(): Mansion`、`levelOf(m: Mansion): Level`。
- Produces（`furniture.ts`）: `piece(p: Piece): THREE.Group`（原点が足もとで正面が +z の形。置くのは `build.ts`）。
- Produces（`build.ts`）: `buildMansion(): Built`。

- [ ] **Step 1: 落ちるテストを書く**

`src/lib/games/yappari-chameleon/mansion/layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { idle, newBody, RADIUS, step, type Body, type Level } from '../move';
import { levelOf, mansion } from './layout';

const m = mansion();
const lv: Level = levelOf(m);

/** 目的の場所（x, z）へまっすぐ歩く。着くか 30 秒たったら止める */
function walk(b: Body, x: number, z: number) {
  for (let t = 0; t < 30; t += 1 / 60) {
    const dx = x - b.pos[0];
    const dz = z - b.pos[2];
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    step(b, { ...idle(), x: dx / Math.max(d, 1), z: dz / Math.max(d, 1) }, lv, 1 / 60);
  }
}

const settle = (b: Body) => {
  for (let i = 0; i < 60; i++) step(b, idle(), lv, 1 / 60);
};

describe('mansion', () => {
  it('始めの場所は、どの当たりの箱にも入っていない', () => {
    const [x, , z] = m.spawn;
    for (const box of lv.boxes)
      if (box.max[1] > 0.3 && box.min[1] < 1.15)
        expect(x > box.min[0] - RADIUS && x < box.max[0] + RADIUS && z > box.min[2] - RADIUS && z < box.max[2] + RADIUS).toBe(false);
  });

  it('大広間から出入口を通って、緑の廊下の奥の本棚の前まで歩ける', () => {
    const b = newBody(m.spawn);
    settle(b);
    walk(b, -2, 1.5);
    walk(b, -2, 5);
    walk(b, -21, 5);
    expect(b.pos[0]).toBeLessThan(-20.9);
    walk(b, -24, 5);
    expect(b.pos[0]).toBeGreaterThan(-22.6);
  });

  it('大階段を上ると 2 階の回廊に立つ', () => {
    const b = newBody([0, 0, 3]);
    settle(b);
    walk(b, 0, 10);
    expect(b.pos[1]).toBeCloseTo(3.5, 1);
    expect(b.pos[2]).toBeGreaterThan(9.8);
  });

  it('回廊の手すりは越えられない', () => {
    const b = newBody([3, 3.5, 10.5]);
    settle(b);
    walk(b, 3, 7);
    expect(b.pos[2]).toBeGreaterThan(9.2);
    expect(b.pos[1]).toBeCloseTo(3.5, 1);
  });

  it('大階段の横からは入れず、階段の下にももぐれない', () => {
    const b = newBody([-3, 0, 6]);
    settle(b);
    walk(b, 0, 6);
    expect(b.pos[0]).toBeLessThan(-1.4);
  });

  it('家具はどれも大広間か緑の廊下の中にある', () => {
    for (const p of m.pieces) {
      const [x, , z] = p.at;
      const hall = x >= -7 && x <= 7 && z >= 0 && z <= 12;
      const corridor = x >= -23 && x <= -7 && z >= 3.25 && z <= 6.75;
      expect(hall || corridor, `${p.kind} ${p.at}`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/layout.test.ts`
Expected: FAIL（`./layout` が無い）。

- [ ] **Step 3: `layout.ts` を作る**

```ts
import type { V3 } from '$lib/sculpt';
import type { Box, Level, Ramp } from '../move';

export type Mat = 'woodPanel' | 'marble' | 'coffer' | 'checker' | 'greenDamask' | 'wainscot' | 'cream' | 'rail';
export type Face = 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';

export interface Slab {
  min: V3;
  max: V3;
  mat: Mat;
  face: Face;
  shadow?: boolean;
}

export type Kind =
  | 'piano'
  | 'rug'
  | 'table-white'
  | 'table-red'
  | 'chair'
  | 'column'
  | 'sofa'
  | 'bench'
  | 'bookshelf'
  | 'vase'
  | 'balloons'
  | 'balloon'
  | 'horse'
  | 'chandelier'
  | 'sconce'
  | 'painting'
  | 'poster'
  | 'ribbons'
  | 'bunting'
  | 'banner'
  | 'stairs';

export interface Piece {
  kind: Kind;
  at: V3;
  turn: 0 | 1 | 2 | 3;
  span?: number;
}

/** 当たりの幅（x）・高さ（y）・奥行（z）。turn が奇数なら幅と奥行を入れ替える。null は当たらない飾り */
export const SIZES: Record<Kind, V3 | null> = {
  piano: [1.5, 1.0, 2.0],
  rug: null,
  'table-white': [1.2, 0.76, 1.2],
  'table-red': [1.2, 0.76, 1.2],
  chair: [0.45, 0.95, 0.45],
  column: [0.5, 3.3, 0.5],
  sofa: [2.0, 0.85, 0.9],
  bench: [1.6, 0.46, 0.45],
  bookshelf: [1.2, 2.2, 0.4],
  vase: [0.6, 1.1, 0.6],
  balloons: [0.8, 1.7, 0.8],
  balloon: [0.45, 0.45, 0.45],
  horse: [1.4, 1.7, 0.6],
  chandelier: null,
  sconce: null,
  painting: null,
  poster: null,
  ribbons: null,
  bunting: null,
  banner: null,
  stairs: null
};

export interface Mansion {
  slabs: Slab[];
  pieces: Piece[];
  ramps: Ramp[];
  spawn: V3;
  lights: { at: V3; color: string; power: number; reach: number }[];
}

const HALL_H = 7;
const FLOOR2 = 3.5;
const CORR_H = 3.5;
const T = 0.3;
const STAIR: Ramp = { min: [-1.25, 0, 3.5], max: [1.25, FLOOR2, 9], rise: 'z+' };

function hall(): Slab[] {
  const s: Slab[] = [
    { min: [-7, -1, 0], max: [7, 0, 12], mat: 'marble', face: 'y+' },
    { min: [-7, HALL_H, 0], max: [7, HALL_H + T, 12], mat: 'coffer', face: 'y-' },
    { min: [-7, 0, -T], max: [7, HALL_H, 0], mat: 'woodPanel', face: 'z+' },
    { min: [-7, 0, 12], max: [7, HALL_H, 12 + T], mat: 'woodPanel', face: 'z-' },
    { min: [7, 0, 0], max: [7 + T, HALL_H, 12], mat: 'woodPanel', face: 'x-' },
    { min: [-7 - T, 0, 0], max: [-7, HALL_H, 4.25], mat: 'woodPanel', face: 'x+' },
    { min: [-7 - T, 0, 5.75], max: [-7, HALL_H, 12], mat: 'woodPanel', face: 'x+' },
    { min: [-7 - T, 2.4, 4.25], max: [-7, HALL_H, 5.75], mat: 'woodPanel', face: 'x+' },
    // 2 階の回廊の床。下に影を落とす
    { min: [-7, FLOOR2 - 0.2, 9], max: [7, FLOOR2, 12], mat: 'woodPanel', face: 'y+', shadow: true },
    { min: [-7, FLOOR2, 8.95], max: [-1.3, FLOOR2 + 0.9, 9.05], mat: 'rail', face: 'z-', shadow: true },
    { min: [1.3, FLOOR2, 8.95], max: [7, FLOOR2 + 0.9, 9.05], mat: 'rail', face: 'z-', shadow: true }
  ];
  // 大階段の横の板。坂の高さに手すりの 0.9m を足した段々にし、横から入れず下にももぐれなくする
  const parts = 10;
  const len = (STAIR.max[2] - STAIR.min[2]) / parts;
  for (let k = 0; k < parts; k++) {
    const z0 = STAIR.min[2] + k * len;
    const top = (FLOOR2 * (k + 1)) / parts + 0.9;
    s.push({ min: [-1.4, 0, z0], max: [-1.25, top, z0 + len], mat: 'rail', face: 'x-', shadow: true });
    s.push({ min: [1.25, 0, z0], max: [1.4, top, z0 + len], mat: 'rail', face: 'x+', shadow: true });
  }
  return s;
}

function corridor(): Slab[] {
  const x0 = -23;
  const x1 = -7;
  return [
    { min: [x0, -1, 3.25], max: [x1, 0, 6.75], mat: 'checker', face: 'y+' },
    { min: [x0, CORR_H, 3.25], max: [x1, CORR_H + T, 6.75], mat: 'cream', face: 'y-' },
    { min: [x0, 0, 6.75], max: [x1, 1, 6.75 + T], mat: 'wainscot', face: 'z-' },
    { min: [x0, 1, 6.75], max: [x1, CORR_H, 6.75 + T], mat: 'greenDamask', face: 'z-' },
    { min: [x0, 0, 3.25 - T], max: [x1, 1, 3.25], mat: 'wainscot', face: 'z+' },
    { min: [x0, 1, 3.25 - T], max: [x1, CORR_H, 3.25], mat: 'greenDamask', face: 'z+' },
    { min: [x0 - T, 0, 3.25], max: [x0, 1, 6.75], mat: 'wainscot', face: 'x+' },
    { min: [x0 - T, 1, 3.25], max: [x0, CORR_H, 6.75], mat: 'greenDamask', face: 'x+' }
  ];
}

const p = (kind: Kind, at: V3, turn: Piece['turn'] = 0, span?: number): Piece => ({ kind, at, turn, span });

function pieces(): Piece[] {
  return [
    p('stairs', [0, 0, 3.5]),
    p('rug', [4, 0, 3]),
    p('piano', [4, 0, 3], 1),
    p('table-white', [-4, 0, 2.5]),
    p('chair', [-4, 0, 1.6]),
    p('chair', [-4, 0, 3.4], 2),
    p('chair', [-4.9, 0, 2.5], 1),
    p('chair', [-3.1, 0, 2.5], 3),
    p('table-red', [-4.5, 0, 7]),
    p('chair', [-4.5, 0, 6.1]),
    p('chair', [-4.5, 0, 7.9], 2),
    p('column', [-5, 0, 8.75]),
    p('column', [-2.2, 0, 8.75]),
    p('column', [2.2, 0, 8.75]),
    p('column', [5, 0, 8.75]),
    p('ribbons', [-3.6, 0, 8.9]),
    p('ribbons', [3.6, 0, 8.9]),
    p('balloons', [-6.2, 0, 0.8]),
    p('balloons', [6.2, 0, 11.2]),
    p('balloons', [-6, FLOOR2, 11.2]),
    p('balloon', [1.8, 0, 1.2]),
    p('balloon', [2.4, 0, 1.5]),
    p('balloon', [-1.5, 0, 10.5]),
    p('chandelier', [-4, 5.6, 5]),
    p('chandelier', [0, 5.6, 6]),
    p('chandelier', [4, 5.6, 5]),
    p('bunting', [0, 5, 4], 1, 14),
    p('horse', [5.2, FLOOR2, 11], 2),
    p('banner', [-3, FLOOR2 + 1.1, 11.95], 2),
    p('banner', [3, FLOOR2 + 1.1, 11.95], 2),
    p('sconce', [-10, 2, 6.75], 2),
    p('sconce', [-15, 2, 6.75], 2),
    p('sconce', [-20, 2, 6.75], 2),
    p('sconce', [-12.5, 2, 3.25]),
    p('sconce', [-17.5, 2, 3.25]),
    p('vase', [-8.2, 0, 6.3]),
    p('poster', [-11, 1.6, 6.75], 2),
    p('sofa', [-14, 0, 6.25], 2),
    p('painting', [-17.5, 1.7, 6.75], 2),
    p('bench', [-20, 0, 3.5]),
    p('balloon', [-12, 0, 4]),
    p('balloon', [-12.5, 0, 4.3]),
    p('balloon', [-18, 0, 5.8]),
    p('bookshelf', [-22.75, 0, 5], 1),
    p('bunting', [-15, 3, 5], 0, 16)
  ];
}

export function mansion(): Mansion {
  const all = pieces();
  return {
    slabs: [...hall(), ...corridor()],
    pieces: all,
    ramps: [STAIR],
    spawn: [0, 0, 1.5],
    lights: [
      ...all.filter((q) => q.kind === 'chandelier').map((q) => ({ at: q.at, color: '#ffd9a0', power: 14, reach: 14 })),
      ...all
        .filter((q) => q.kind === 'sconce')
        .map((q) => ({ at: [q.at[0], q.at[1] + 0.2, q.at[2] + (q.turn === 2 ? -0.3 : 0.3)] as V3, color: '#ffcf8a', power: 3, reach: 7 }))
    ]
  };
}

export function levelOf(m: Mansion): Level {
  const boxes: Box[] = m.slabs.map((s) => ({ min: s.min, max: s.max }));
  for (const q of m.pieces) {
    const size = SIZES[q.kind];
    if (!size) continue;
    const [w, h, d] = q.turn % 2 ? [size[2], size[1], size[0]] : size;
    boxes.push({ min: [q.at[0] - w / 2, q.at[1], q.at[2] - d / 2], max: [q.at[0] + w / 2, q.at[1] + h, q.at[2] + d / 2] });
  }
  return { boxes, ramps: m.ramps, spawn: m.spawn };
}
```

- [ ] **Step 4: 並びのテストを通す**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/mansion/layout.test.ts`
Expected: PASS。歩くテストが家具で止まるときは、家具の位置を通り道（z = 5 の東西の線と、x = −2 の南北の線）から外す。テストの道は変えない。

- [ ] **Step 5: `furniture.ts` を作る**

どの家具も `finish()` の材質で作る（スポイトで色を取れるように）。原点が足もとで、正面が +z。

```ts
import * as THREE from 'three';
import type { Piece } from './layout';
import { books, finish, leather, marble, oilPainting, poster, rug, type Finish } from '../textures';

const BLACK: Finish = { tint: '#141414', rough: 0.15 };
const GOLD: Finish = { tint: '#d4af37', metal: 1, rough: 0.3 };
const WHITE: Finish = { tint: '#f1ece2', rough: 0.5 };
const WOOD: Finish = { tint: '#4a2e1a', rough: 0.55 };
const BALLOONS = ['#d6312b', '#2f6fd1', '#3a9a4a', '#f2c230'];

function box(g: THREE.Group, size: [number, number, number], f: Finish, at: [number, number, number], face: [number, number] = [size[0], size[1]]) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(...size), finish(f, face));
  o.position.set(...at);
  o.castShadow = o.receiveShadow = true;
  g.add(o);
  return o;
}

function cyl(g: THREE.Group, r: [number, number], h: number, f: Finish, at: [number, number, number], seg = 24) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(r[0], r[1], h, seg), finish(f, [Math.PI * 2 * r[0], h]));
  o.position.set(...at);
  o.castShadow = o.receiveShadow = true;
  g.add(o);
  return o;
}

function ball(g: THREE.Group, r: number, f: Finish, at: [number, number, number]) {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), finish(f, [r * 3, r * 3]));
  o.position.set(...at);
  o.castShadow = o.receiveShadow = true;
  g.add(o);
  return o;
}

function plane(g: THREE.Group, size: [number, number], f: Finish, at: [number, number, number], rotX = 0) {
  const o = new THREE.Mesh(new THREE.PlaneGeometry(...size), finish(f, size));
  o.position.set(...at);
  o.rotation.x = rotX;
  o.receiveShadow = true;
  g.add(o);
  return o;
}

const variant = (p: Piece) => Math.abs(Math.round(p.at[0] * 7 + p.at[2] * 13));

function piano(g: THREE.Group) {
  box(g, [1.5, 0.32, 2.0], BLACK, [0, 0.84, 0]);
  for (const [x, z] of [
    [-0.6, 0.8],
    [0.6, 0.8],
    [0, -0.8]
  ])
    cyl(g, [0.06, 0.05], 0.7, BLACK, [x, 0.35, z]);
  const lid = box(g, [1.45, 0.03, 1.9], BLACK, [0, 1.3, -0.25]);
  lid.rotation.x = -0.45;
  box(g, [1.3, 0.06, 0.18], WHITE, [0, 0.86, 1.08]);
  box(g, [1.3, 0.03, 0.08], BLACK, [0, 0.9, 1.04]);
}

function table(g: THREE.Group, cloth: string) {
  cyl(g, [0.6, 0.6], 0.04, { tint: cloth, rough: 0.9 }, [0, 0.74, 0], 32);
  cyl(g, [0.61, 0.68], 0.7, { tint: cloth, rough: 0.9 }, [0, 0.38, 0], 32);
}

function chair(g: THREE.Group) {
  box(g, [0.45, 0.05, 0.45], WOOD, [0, 0.45, 0]);
  for (const [x, z] of [
    [-0.19, -0.19],
    [0.19, -0.19],
    [-0.19, 0.19],
    [0.19, 0.19]
  ])
    box(g, [0.04, 0.45, 0.04], WOOD, [x, 0.225, z]);
  box(g, [0.45, 0.5, 0.04], WOOD, [0, 0.72, -0.2]);
}

function column(g: THREE.Group) {
  box(g, [0.6, 0.15, 0.6], WHITE, [0, 0.075, 0]);
  cyl(g, [0.22, 0.25], 3.0, WHITE, [0, 1.65, 0], 32);
  box(g, [0.6, 0.15, 0.6], WHITE, [0, 3.225, 0]);
}

function sofa(g: THREE.Group) {
  const L: Finish = { pattern: leather(), rough: 0.45 };
  box(g, [2.0, 0.42, 0.9], L, [0, 0.21, 0]);
  box(g, [2.0, 0.55, 0.2], L, [0, 0.62, -0.35]);
  box(g, [0.2, 0.62, 0.9], L, [-0.9, 0.31, 0], [0.9, 0.62]);
  box(g, [0.2, 0.62, 0.9], L, [0.9, 0.31, 0], [0.9, 0.62]);
  box(g, [1.6, 0.12, 0.7], L, [0, 0.48, 0.05]);
}

function bench(g: THREE.Group) {
  box(g, [1.6, 0.06, 0.45], WOOD, [0, 0.43, 0]);
  for (const x of [-0.7, 0.7]) box(g, [0.06, 0.4, 0.4], WOOD, [x, 0.2, 0]);
}

function bookshelf(g: THREE.Group) {
  box(g, [0.05, 2.2, 0.4], WOOD, [-0.575, 1.1, 0]);
  box(g, [0.05, 2.2, 0.4], WOOD, [0.575, 1.1, 0]);
  box(g, [1.2, 0.05, 0.4], WOOD, [0, 2.175, 0]);
  box(g, [1.2, 2.2, 0.03], WOOD, [0, 1.1, -0.185]);
  plane(g, [1.1, 2.12], { pattern: books(), rough: 0.7 }, [0, 1.08, 0.17]);
}

function vase(g: THREE.Group) {
  const pts = [
    [0.18, 0],
    [0.24, 0.1],
    [0.3, 0.45],
    [0.22, 0.8],
    [0.14, 0.95],
    [0.2, 1.1]
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const o = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), finish({ pattern: marble(), rough: 0.25 }, [1.6, 1.1]));
  o.castShadow = o.receiveShadow = true;
  g.add(o);
}

function balloons(g: THREE.Group, p: Piece) {
  const v = variant(p);
  const spots: [number, number, number][] = [
    [0, 1.55, 0],
    [0.22, 1.4, 0.1],
    [-0.2, 1.38, 0.12],
    [0.08, 1.3, -0.22],
    [-0.12, 1.62, -0.15]
  ];
  spots.forEach((at, i) => {
    ball(g, 0.2, { tint: BALLOONS[(v + i) % 4], rough: 0.25 }, at);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, at[1], 4), finish({ tint: '#ffffff' }, [0.01, at[1]]));
    s.position.set(at[0] / 2, at[1] / 2, at[2] / 2);
    s.lookAt(at[0], at[1], at[2]);
    s.rotateX(Math.PI / 2);
    g.add(s);
  });
  box(g, [0.12, 0.08, 0.12], GOLD, [0, 0.04, 0]);
}

function balloon(g: THREE.Group, p: Piece) {
  ball(g, 0.22, { tint: BALLOONS[variant(p) % 4], rough: 0.25 }, [0, 0.22, 0]);
}

function horse(g: THREE.Group) {
  const S: Finish = { tint: '#f4f1ea', rough: 0.4 };
  box(g, [1.0, 0.5, 0.5], { tint: '#3b2414', rough: 0.5 }, [0, 0.25, 0]);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 8, 16), finish(S, [1, 1]));
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 1.1, 0);
  body.castShadow = true;
  g.add(body);
  for (const [x, z] of [
    [-0.3, -0.1],
    [-0.3, 0.1],
    [0.3, -0.1],
    [0.3, 0.1]
  ])
    cyl(g, [0.05, 0.04], 0.45, S, [x, 0.72, z]);
  const neck = cyl(g, [0.09, 0.12], 0.45, S, [0.45, 1.35, 0]);
  neck.rotation.z = -0.6;
  box(g, [0.32, 0.16, 0.16], S, [0.62, 1.58, 0]);
}

function chandelier(g: THREE.Group) {
  cyl(g, [0.02, 0.02], 1.4, GOLD, [0, 0.7, 0], 8);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 8, 48), finish(GOLD, [1, 1]));
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 12, 8),
      new THREE.MeshStandardMaterial({ color: '#fff3d0', emissive: '#ffe2a0', emissiveIntensity: 2 })
    );
    bulb.position.set(Math.cos(a) * 0.6, 0.08, Math.sin(a) * 0.6);
    g.add(bulb);
  }
  ball(g, 0.12, GOLD, [0, -0.1, 0]);
}

function sconce(g: THREE.Group) {
  box(g, [0.06, 0.25, 0.04], GOLD, [0, 0, 0.02]);
  box(g, [0.04, 0.04, 0.25], GOLD, [0, 0.1, 0.14]);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.14, 0.18, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: '#f3e3c0', emissive: '#ffcf8a', emissiveIntensity: 0.8, side: THREE.DoubleSide })
  );
  shade.position.set(0, 0.22, 0.27);
  g.add(shade);
}

function painting(g: THREE.Group) {
  box(g, [1.5, 1.2, 0.06], GOLD, [0, 0, 0.03]);
  plane(g, [1.2, 0.9], { pattern: oilPainting(), rough: 0.6 }, [0, 0, 0.062]);
}

function posterPiece(g: THREE.Group) {
  plane(g, [0.5, 0.75], { pattern: poster(), rough: 0.9 }, [0, 0, 0.01]);
}

function ribbons(g: THREE.Group, p: Piece) {
  const colors = ['#e53950', '#f6a623', '#f7e14a', '#4cc36f', '#3a8ee6', '#9b59d0'];
  for (let i = 0; i < 12; i++) {
    const strip = plane(g, [0.12, 2.8], { tint: colors[(i + variant(p)) % colors.length], rough: 0.6 }, [-0.9 + i * 0.165, 1.9, (i % 3) * 0.02]);
    (strip.material as THREE.Material).side = THREE.DoubleSide;
  }
}

function bunting(g: THREE.Group, p: Piece) {
  const span = p.span ?? 10;
  const colors = ['#f8bbd0', '#b2ebf2', '#fff9c4', '#c5e1a5', '#d1c4e9'];
  const sag = (x: number) => -0.35 * (1 - (2 * x / span) ** 2);
  const shape = new THREE.Shape([new THREE.Vector2(-0.14, 0), new THREE.Vector2(0.14, 0), new THREE.Vector2(0, -0.3)]);
  let i = 0;
  for (let x = -span / 2 + 0.2; x < span / 2; x += 0.4) {
    const m = finish({ tint: colors[i++ % colors.length], rough: 0.7 }, [0.3, 0.3]);
    m.side = THREE.DoubleSide;
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(shape), m);
    flag.position.set(x, sag(x), 0);
    g.add(flag);
  }
  const pts = Array.from({ length: 41 }, (_, k) => {
    const x = -span / 2 + (k / 40) * span;
    return new THREE.Vector3(x, sag(x), 0);
  });
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffffff' })));
}

function banner(g: THREE.Group, p: Piece) {
  const tints = ['#c9a227', '#a3262f', '#2c5aa0', '#e0b83a'];
  const m = finish({ tint: tints[variant(p) % 4], rough: 0.8 }, [1.2, 2]);
  m.side = THREE.DoubleSide;
  const o = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2), m);
  o.position.z = 0.02;
  g.add(o);
}

/** 大広間の大階段。坂の当たりに合わせて段を積み、赤い敷物と緑のガーランドを載せる */
function stairs(g: THREE.Group) {
  const n = 10;
  for (let k = 0; k < n; k++) {
    const h = (3.5 * (k + 1)) / n;
    box(g, [2.5, h, 0.55], WOOD, [0, h / 2, k * 0.55 + 0.275], [2.5, 0.55]);
    box(g, [1.4, 0.02, 0.55], { tint: '#8e1b1b', rough: 0.9 }, [0, h + 0.01, k * 0.55 + 0.275]);
  }
  for (const x of [-1.33, 1.33]) {
    for (let k = 0; k <= 22; k++) {
      const z = (k / 22) * 5.5;
      const y = (3.5 * z) / 5.5 + 0.95;
      ball(g, 0.07, { tint: '#2f6b35', rough: 0.8 }, [x, y, z]);
      if (k % 3 === 0) ball(g, 0.05, { tint: '#ffffff', rough: 0.6 }, [x, y + 0.06, z]);
    }
  }
}

function rugPiece(g: THREE.Group) {
  plane(g, [2.4, 3.6], { pattern: rug(), rough: 0.95 }, [0, 0.005, 0], -Math.PI / 2);
}

const MAKERS: Record<Piece['kind'], (g: THREE.Group, p: Piece) => void> = {
  piano,
  rug: rugPiece,
  'table-white': (g) => table(g, '#f4f1ea'),
  'table-red': (g) => table(g, '#7a3324'),
  chair,
  column,
  sofa,
  bench,
  bookshelf,
  vase,
  balloons,
  balloon,
  horse,
  chandelier,
  sconce,
  painting,
  poster: posterPiece,
  ribbons,
  bunting,
  banner,
  stairs
};

export function piece(p: Piece): THREE.Group {
  const g = new THREE.Group();
  MAKERS[p.kind](g, p);
  return g;
}
```

- [ ] **Step 6: `build.ts` を作る**

```ts
import * as THREE from 'three';
import { checker, coffer, damask, finish, marble, wainscot, woodPanel, type Finish } from '../textures';
import type { Built } from '../world3d';
import { piece } from './furniture';
import { levelOf, mansion, type Face, type Mat, type Slab } from './layout';

const LOOKS: Record<Mat, () => Finish> = {
  woodPanel: () => ({ pattern: woodPanel(), rough: 0.6 }),
  marble: () => ({ pattern: marble(), rough: 0.25 }),
  coffer: () => ({ pattern: coffer(), rough: 0.7 }),
  checker: () => ({ pattern: checker(), rough: 0.35 }),
  greenDamask: () => ({ pattern: damask('#3f5e3a', '#5f8255'), rough: 0.8 }),
  wainscot: () => ({ pattern: wainscot(), rough: 0.55 }),
  cream: () => ({ tint: '#efe6d2', rough: 0.85 }),
  rail: () => ({ tint: '#3b2414', rough: 0.5 })
};

/** BoxGeometry の材質の並び（+x, −x, +y, −y, +z, −z） */
const ORDER: Face[] = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'];

function slab(s: Slab): THREE.Mesh {
  const size = [0, 1, 2].map((i) => s.max[i] - s.min[i]) as [number, number, number];
  const faceSize = (f: Face): [number, number] =>
    f[0] === 'x' ? [size[2], size[1]] : f[0] === 'y' ? [size[0], size[2]] : [size[0], size[1]];
  const plain = finish({ tint: '#3b2414', rough: 0.7 }, [1, 1]);
  const mats = ORDER.map((f) => (f === s.face ? finish(LOOKS[s.mat](), faceSize(f)) : plain));
  const o = new THREE.Mesh(new THREE.BoxGeometry(...size), mats);
  o.position.set((s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2);
  o.receiveShadow = true;
  // 天井と壁は上からの 1 灯を遮らない（遮ると廊下が真っ暗になる）
  o.castShadow = s.shadow ?? false;
  return o;
}

export function buildMansion(): Built {
  const m = mansion();
  const group = new THREE.Group();
  for (const s of m.slabs) group.add(slab(s));
  for (const p of m.pieces) {
    const o = piece(p);
    o.position.set(...p.at);
    o.rotation.y = (p.turn * Math.PI) / 2;
    group.add(o);
  }
  for (const l of m.lights) {
    const light = new THREE.PointLight(l.color, l.power, l.reach, 2);
    light.position.set(...l.at);
    group.add(light);
  }
  return { group, level: levelOf(m) };
}
```

`World` の上からの 1 灯の影のカメラを、屋敷の全体（x −24〜8、z −1〜13）に合わせて直す。`top.position.set(-8, 20, 6)`、`top.target.position.set(-8, 0, 6)`、`top.shadow.camera.left = -17`・`right = 17`・`top = 8`・`bottom = -8`。

`Chameleon.svelte` の `import { testRoom } from './test-room';` を `import { buildMansion } from './mansion/build';` にし、`world.setStage(testRoom());` を `world.setStage(buildMansion());` にする。`test-room.ts` を消す。

- [ ] **Step 7: 型・lint・テストを通す**

Run: `pnpm format && pnpm check && pnpm lint && pnpm test:run`
Expected: PASS（`play.svelte.test.ts` は偽の World を使うので屋敷に依らない）。

- [ ] **Step 8: 部屋のシートを撮る**

scratchpad に `room-sheet.mjs` を書く。`accept.mjs` と同じ起動でゲームを開き、`window.__chameleon` の鬼の目で次の 6 か所から撮って、1 枚に 3 列 × 2 段で並べる。
1. 大広間の入口から北を見る（`ghost.pos = [0, 0, 0.6]`、`eyeYaw = 0`、`eyePitch = -0.15`）。
2. 2 階の回廊から南を見下ろす（`[3, 3.5, 11]`、`eyeYaw = π`、`eyePitch = 0.35`）。
3. ピアノと絨毯（`[1.5, 0, 1]`、`eyeYaw = 1.2`、`eyePitch = 0.2`）。
4. 緑の廊下を出入口から西へ見る（`[-7.5, 0, 5]`、`eyeYaw = -π / 2`、`eyePitch = 0`）。
5. ソファと油絵（`[-15.5, 0, 4]`、`eyeYaw = 0.2`、`eyePitch = 0`）。
6. 突き当たりの本棚（`[-20, 0, 5]`、`eyeYaw = -π / 2`、`eyePitch = 0.05`）。

Run: `node <scratchpad>/room-sheet.mjs <scratchpad>`
Expected: `rooms.png` に 6 枚が写る。真っ暗な場所・真っ白に飛んだ場所が無く、家具が床に浮いたり沈んだりしていないこと。

`rooms.png` を作業の担当へ返す（担当がユーザーに見せる）。

- [ ] **Step 9: 受け入れの 3 枚を撮る**

`accept.mjs` を屋敷に合わせて直す。
1. 壁の色（受け入れの 1 枚め）は、緑の廊下の北の壁の前（`body.pos = [-10.8, 0, 6.5]`）で行い、鬼の目は `[-10.8, 0, 3.5]` から北（`eyeYaw = 0`）を見て撮る（`accept-1.png`）。
2. 油絵を写す（受け入れの 2 枚め）。体を油絵の前（`[-17.5, 0, 6.5]`）で壁に張り付かせ、上がるで 0.6 秒上げて、体の中心を絵の中心の高さに合わせる。体の頂点を 2 つおきに取り、骨で曲げたあとの位置（`rig.mesh.getVertexPosition(i, v)` に `rig.mesh.matrixWorld` を掛けたもの）を壁の面へまっすぐ写して、その点の油絵の画素の色（絵の外なら金の額の色）で、半径 1.2cm・濃さ 1 の吹き付けを作り、`play.applyDabs()` で当てる（体の前ではなく、壁から離れた側の面の頂点だけ。法線を世界の向きに直して壁の法線と同じ向きのもの）。鬼の目で 2.5m 離れて撮る（`accept-2.png`）。
3. 市松の床に寝そべる（受け入れの 3 枚め）。体を廊下の床（`[-9.5, 0, 4.5]`）に置き、`play.setPose('lie')` で寝そべらせて 1 秒待つ。上を向いた面の頂点を床へまっすぐ写して、市松の画素の色で 2 と同じように吹き付け、鬼の目で 3m 離れて斜め上から撮る（`accept-3.png`）。

Run: `node <scratchpad>/accept.mjs <scratchpad>`
Expected: 3 枚とも、人形が背景の模様に紛れて、輪郭と影のほかはほぼ見えない。2 枚めは額の中の絵の一部に見える。写した模様がにじんで見分けられないときは、塗りの細かさが足りないので、作業の担当へ「細かさが足りない」と返す（直し方は担当が決める）。

`accept-1.png`・`accept-2.png`・`accept-3.png` を作業の担当へ返す（担当がユーザーに見せる）。

- [ ] **Step 10: Commit**

```bash
git add -A src/lib/games/yappari-chameleon
git commit -m "Build the mansion's great hall and green corridor"
```

### Task 15: 60 秒の時計・音・一覧のカード・説明

本家の隠れタイム（既定 60 秒）を、指でどこまで塗れるかを測る時計として上の真ん中に出す。押すと 60 秒から数え、残り 10 秒から 1 秒ごとに音を鳴らし、0 で知らせる（試合はまだ無いので、知らせるだけ）。本家に声は無いので、音は効果音だけ。一覧のカードの絵を実際の画面から撮り、`CLAUDE.md` にゲームの説明を足す。

**Files:**
- Create: `src/lib/games/yappari-chameleon/sounds.ts`
- Create: `src/lib/games/yappari-chameleon/HideTimer.svelte`
- Modify: `src/lib/games/yappari-chameleon/play.svelte.ts`（`timer`・`startTimer()`・`stopTimer()` と、音を鳴らす所）
- Modify: `src/lib/games/yappari-chameleon/Chameleon.svelte`（`HideTimer` を出す）
- Modify: `src/lib/games/yappari-chameleon/play.svelte.test.ts`（時計のテスト）
- Modify: `scripts/thumbs.ts`（場面ごとの画面の大きさ）
- Modify: `scripts/thumbs/scenes.ts`（`yappari-chameleon` の場面）
- Modify: `static/thumbs/yappari-chameleon.webp`（撮り直す）
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `tone`・`sweep`・`noise`・`sfx`（`$lib/audio.svelte`）。
- Produces（`sounds.ts`）: `sounds = { spray(): void; cling(): void; pick(): void; tick(): void; done(): void; button(): void }`。
- Produces（`Play` に足す）: `timer = $state<number | null>(null)`（残り秒）、`startTimer(): void`、`stopTimer(): void`。
- Produces（`scripts/thumbs/scenes.ts` の `Scene`）: `viewport?: { width: number; height: number }`（横持ちのゲームの場面）。

- [ ] **Step 1: 落ちるテストを書く**

`play.svelte.test.ts` に足す（`$lib/audio.svelte` は `vi.mock` で音を鳴らさない偽にする。ファイルの先頭に置く）。

```ts
vi.mock('$lib/audio.svelte', () => ({
  tone: vi.fn(),
  sweep: vi.fn(),
  noise: vi.fn(),
  sfx: { start: vi.fn(), finish: vi.fn() }
}));
```

```ts
  it('隠れタイムの時計は 60 秒から減り、0 で止まって知らせる', async () => {
    const { sfx, tone } = await import('$lib/audio.svelte');
    const p = new Play(fakeWorld(), 70);
    p.startTimer();
    vi.mocked(tone).mockClear();
    vi.mocked(sfx.finish).mockClear();
    expect(p.timer).toBe(60);
    run(p, 49.5);
    expect(p.timer).toBeGreaterThan(10);
    expect(tone).not.toHaveBeenCalled();
    run(p, 5);
    expect(tone).toHaveBeenCalled();
    run(p, 6);
    expect(p.timer).toBe(null);
    expect(sfx.finish).toHaveBeenCalledTimes(1);
  });

  it('時計は止められる', () => {
    const p = new Play(fakeWorld(), 70);
    p.startTimer();
    run(p, 1);
    p.stopTimer();
    expect(p.timer).toBe(null);
  });
```

- [ ] **Step 2: 落ちることを確かめる**

Run: `pnpm vitest run src/lib/games/yappari-chameleon/play.svelte.test.ts`
Expected: FAIL（`startTimer` が無い）。

- [ ] **Step 3: `sounds.ts` を作る**

```ts
import { noise, sfx, sweep, tone } from '$lib/audio.svelte';

/** 本家に声は無いので、効果音だけにする */
export const sounds = {
  spray: () => noise(120, 0.05),
  cling: () => tone(140, 70, 'sine', 0.2),
  pick: () => sweep(500, 1100, 120, 0.1),
  tick: () => tone(880, 60, 'square', 0.06),
  done: () => sfx.finish(),
  button: () => tone(660, 40, 'triangle', 0.08)
};
```

- [ ] **Step 4: `Play` に時計と音を足す**

`play.svelte.ts` に `import { sounds } from './sounds';` を足し、クラスに足す。

```ts
  timer = $state<number | null>(null);
  #lastTick = 0;

  startTimer(): void {
    this.timer = 60;
    this.#lastTick = 60;
    sounds.button();
  }

  stopTimer(): void {
    this.timer = null;
  }
```

`frame` の先頭（`pad.tick` の前）に足す。

```ts
    if (this.timer !== null) {
      this.timer = Math.max(0, this.timer - dt);
      const whole = Math.ceil(this.timer);
      if (whole < this.#lastTick && whole <= 10 && whole > 0) sounds.tick();
      this.#lastTick = whole;
      if (this.timer === 0) {
        this.timer = null;
        sounds.done();
      }
    }
```

音を鳴らす所を足す。
- `#paint` の `e.kind === 'start'` で筆を作ったところで `sounds.spray()`。
- `spoitAt` で色を取れたら `sounds.pick()`。
- `frame` で `this.cling` が `null` から `'wall'` か `'ceiling'` に変わったら `sounds.cling()`（前の値と比べる）。

- [ ] **Step 5: `HideTimer.svelte` を作って出す**

```svelte
<script lang="ts">
  import type { Play } from './play.svelte';

  let { play }: { play: Play } = $props();
  const shown = $derived(play.timer === null ? null : Math.ceil(play.timer));
</script>

<button class="timer" class:running={shown !== null} onclick={() => (shown === null ? play.startTimer() : play.stopTimer())}>
  {#if shown === null}
    隠れタイムを はかる
  {:else}
    <span class="word">隠れタイム</span>
    <span class="num" class:last={shown <= 10}>{shown}</span>
  {/if}
</button>

<style>
  .timer {
    position: absolute;
    top: max(12px, env(safe-area-inset-top));
    left: 50%;
    translate: -50% 0;
    display: grid;
    justify-items: center;
    padding: 6px 16px;
    border: 0;
    border-radius: 12px;
    background: rgb(0 0 0 / 0.3);
    color: #fff;
    font-family: 'Hiragino Mincho ProN', serif;
    font-size: 15px;
    text-shadow: 0 1px 3px #000;
  }

  .num {
    font-size: 40px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .num.last {
    color: #ffd54a;
  }
</style>
```

`Chameleon.svelte` の `{#if play}` の中（`Buttons` の前）に `{#if play.mode !== 'eye'}<HideTimer {play} />{/if}` を足す。ペイント中も出す（本家もペイント中は上の残り秒だけを出す）。

- [ ] **Step 6: 通ることを確かめる**

Run: `pnpm format && pnpm check && pnpm lint && pnpm vitest run src/lib/games/yappari-chameleon`
Expected: PASS。

- [ ] **Step 7: 一覧のカードの絵を撮る**

`scripts/thumbs/scenes.ts` の `Scene` に `viewport?: { width: number; height: number };` を足し（説明のコメント「横持ちのゲームは横長の画面で撮る」）、`scripts/thumbs.ts` の `newContext` の `viewport` を `scene.viewport ?? { width: 768, height: 1024 }` にする。

`SCENES` に場面を足す。横長の画面（1024 × 768）で開き、緑の廊下の壁に半身だけ壁の色を塗った人形が張り付いている所を、少し斜めの三人称から撮る（塗った半分は壁に溶け、塗っていない半分が白く見えて、遊び方が 1 枚で分かる）。

```ts
  {
    // 半身だけ壁の色を塗って張り付き、塗った側が壁に溶ける様子で遊び方を見せる
    id: 'yappari-chameleon',
    viewport: { width: 1024, height: 768 },
    clip: { x: 172, y: 184, width: 680, height: 400 },
    play: async (s) => {
      await s.startSolo();
      await s.wait(2500);
      await s.page.evaluate(() => {
        interface Attr {
          count: number;
          getX(i: number): number;
          getY(i: number): number;
          getZ(i: number): number;
        }
        interface Chameleon {
          body: { pos: number[] };
          camYaw: number;
          camPitch: number;
          jump(): void;
          applyDabs(d: unknown[]): void;
          world: {
            project(p: number[]): { x: number; y: number };
            spoit(x: number, y: number): { color: number[] } | null;
            rig: { mesh: { geometry: { attributes: { position: Attr; normal: Attr } } } };
          };
        }
        const play = (window as unknown as { __chameleon: Chameleon }).__chameleon;
        play.body.pos = [-10.8, 0, 6.5];
        play.camYaw = 0.45;
        play.camPitch = 0.12;
        play.jump();
        const at = play.world.project([-10.2, 1.8, 6.74]);
        const color = play.world.spoit(at.x, at.y)?.color ?? [0.25, 0.37, 0.23];
        // 人形の面の、骨で曲げる前の位置と法線（左半身 x > 0 だけ）に吹く
        const { position: pos, normal: nrm } = play.world.rig.mesh.geometry.attributes;
        const dabs = [];
        for (let i = 0; i < pos.count; i += 9) {
          if (pos.getX(i) < 0) continue;
          dabs.push({
            p: [pos.getX(i), pos.getY(i), pos.getZ(i)],
            n: [nrm.getX(i), nrm.getY(i), nrm.getZ(i)],
            r: 0.06,
            c: color,
            a: 0.9,
            m: 0,
            ro: 0.8
          });
        }
        play.applyDabs(dabs);
      });
      await s.wait(1500);
    }
  },
```

Run: `pnpm thumbs yappari-chameleon`
Expected: `static/thumbs/yappari-chameleon.webp` が、屋敷の壁と半身の溶けた人形の絵で書き換わる。カメラの向き（`camYaw`）は、人形と壁が両方入るように直してよい。

- [ ] **Step 8: `CLAUDE.md` に説明を足す**

`CLAUDE.md` の「## 見た目」の前、ゲームの説明の段落の並び（アニマルサバイバーの段落のあと）に、次の段落を足す。今の仕様だけを書き、経緯は書かない。

```markdown
やっぱりカメレオン（`yappari-chameleon`）は、Steam の『めっちゃカメレオン』に寄せたかくれんぼで、今は 1 台で塗る・隠れる・見え方を確かめる試作（`levels: 1`、`ownMenu`）。本家の仕様は `docs/superpowers/specs/2026-10-08-yappari-chameleon-original.md` にまとめてある。横持ちで遊ぶゲームなので、`SoloMeta.landscape` で共通の `.stage` を横向きで回さず（`.wide`）、縦持ちのあいだは描画を止めて「よこむきに してね」を出す。人形（`doll.ts`、白い丸い 4 頭身、背 1.15m）は `$lib/sculpt.ts` の 1 枚の面を骨で曲げ、塗りは体のテクスチャに持つ。三角形を 2 つずつ升に並べた UV（`atlas.ts`。見せる三角形は升のふちから 2 画素縮め、吹き付けの三角形は 1.5 画素広げて 3D の位置も伸ばす）に、吹き付けを描くシェーダー（`paint-gpu.ts`）で、画素の骨で曲げる前の 3D の位置と吹き付けの中心の距離から色を混ぜる（裏を向いた面には付けない）。色は 2048² の sRGB、メタリックとラフネスは 1024²。塗った操作は吹き付けの列（`paint.ts` の `PaintLog`、もどすは新しい 30 筆まで）で持ち、もどすと WebGL のコンテキストが戻ったときは白から列を当て直す。3D スポイトは光が当たる前の色（模様の canvas の画素 × 材質の色、`textures.ts` の `readPick`、人形なら塗りのテクスチャ）を取る。動き（`move.ts`）は体を半径 0.2m のカプセル、屋敷を箱と坂にした自前の計算で、壁際のジャンプで張り付き（上がる・さがる・はなす）、上がり切ると天井に張り付き、向きロックのあいだは向きを変えずに歩いて回るボタンで向きだけ変える。指（`touch.ts`）は左の 45% がスティック、ほかが見回しで、ペイント中は 1 本指で塗り（2 本指のつもりの 1 本めで塗らないよう 80ms か 6px 待つ）、2 本指で回してつまんでズームする。ポーズは本家の輪から 12 種（`poses.ts` の骨ごとの角度、`PoseWheel.svelte` は指を置いたまま滑らせて離すか、開いて押す）。鬼の目は体を置いたまま一人称（縦 72 度、本家の 16:9 での横 105 度と同じ見え方）で歩く。物の陰の自分は、屋敷の材質のシェーダー（`xray.ts`）が自分のまわりを点々に抜いて見せる（鬼の目では抜かない）。屋敷（`mansion/`）は本家のかくれんぼ屋敷の大広間（2 階の回廊・大階段・シャンデリア・ピアノ・円柱・リボン・風船）と緑の廊下（ダマスクの壁紙・市松の床・ソファ・油絵・本棚）で、並びと当たりは `layout.ts`、模様は `textures.ts` の canvas（線と目は 2cm 以上）。上の「隠れタイムを はかる」は 60 秒を数えるだけ。dev では `window.__chameleon` に遊ぶ状態を出し、headless の確かめとカードの撮影が使う。
```

- [ ] **Step 9: 全部を通す**

Run: `pnpm verify`
Expected: PASS（lint・check・test・vitals・build）。`svelte-vitals` が新しい部品に警告を出したら、規則に合わせて直す（抑制コメントは使わない）。

- [ ] **Step 10: Commit**

```bash
git add -A scripts src/lib/games/yappari-chameleon static/thumbs/yappari-chameleon.webp CLAUDE.md
git commit -m "Time the hiding minute, add sounds, the card picture and the docs"
```

- [ ] **Step 11: iPad で触ってもらう準備**

作業の担当へ、受け入れの 3 枚・人形のシート・ポーズのシート・模様と部屋のシートと、iPad で確かめてほしい点を返す。確かめてほしい点は次のとおり。
- 塗り心地（1 本指の吹き付け・ブラシの大きさ・スポイト・もどす）。
- スティックと見回しの手ざわり。
- 張り付き・ポーズ・向きロックで、壁や物に合わせられるか。
- 鬼の目で見て、溶け込むのが楽しいか。
- 60 秒でどこまで塗れたか。
- 横持ちで「よこむきに してね」が出ずに遊べるか（ホーム画面のアプリで、manifest の縦固定に縛られないか）。
- 重さ（カクつき・熱）。
