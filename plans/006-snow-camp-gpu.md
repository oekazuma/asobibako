# Plan 006: snow-camp の geometry 共有・影の絞り込み・DPR・破棄

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、
> 期待どおりの結果を確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。
> 終わったら `plans/README.md` の 006 の行の Status を更新する。
>
> **Drift check（最初に実行）**:
> `git -C /Users/oekazuma/localRepo/table-duel diff --stat b4b0196..HEAD -- src/lib/games/snow-camp/models.ts src/lib/games/snow-camp/world3d.ts src/lib/games/snow-camp/details.ts src/lib/games/snow-camp/SnowCamp.svelte`
> 変わっていたら「Current state」の抜粋と見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------ |
| Priority   | P1                                                                                         |
| Effort     | M                                                                                          |
| Risk       | LOW〜MED（見た目だけの変更。破棄はキャッシュ済みの material に触ると次の面が真っ黒になる） |
| Depends on | none                                                                                       |
| Category   | perf                                                                                       |
| Planned at | commit `b4b0196`, 2026-09-22                                                               |

## Why this matters

雪原サバイバル（snow-camp）は three.js で描く唯一のゲームで、いちばん重い。理由は 3 つある。

1. **メッシュがすべて影を落とす**。`models.ts` の `mesh()` が無条件に `castShadow = true` を付けるので、
   奥の森 24 本 × 7 メッシュ、山 14 個、吹きだまり 26 個まで影のパスに乗る。メッシュは合計で
   450〜550 個あり、iPad では三角形の数より描画呼び出しの数が効く
2. **geometry を共有していない**。`mat()` は material をキャッシュするが geometry は毎回 `new`。
   松の木 1 本で 7 個、54 本で 378 個の geometry が GPU に上がる
3. **面ごとに WebGL コンテキストを漏らす**。`SoloShell` は `{#key round}` で毎面 `<Game>` を作り直し、
   `SnowCamp.svelte` は `onMount` で `new CampWorld()`、破棄で `dispose()` を呼ぶが、`dispose()` は
   `renderer.dispose()` だけで、コンテキストも geometry も解放しない。Safari は同時に持てる
   コンテキストが十数個で、超えると古いものが失われて 3D が真っ黒になる。10 面遊べば 10 個

さらに `setPixelRatio(Math.min(2, devicePixelRatio))` + `antialias: true` は、iPad（dpr 2）では
2732×2048 の MSAA バッファになる。平面的なローポリの絵なので、比率を 1.5 に落として MSAA を
外しても見た目はほとんど変わらない。

## Current state

- `src/lib/games/snow-camp/models.ts` — 3D の部品。`mat()`（material キャッシュ）、`mesh()`、
  `sphere()`、`cyl()`、`person()`、`bear()`、`rabbit()`、`meat()`、`coin()`、`pine()`、`fire()`、
  `badge()`、`axe()`、`marker()`、`pointer()`
- `src/lib/games/snow-camp/world3d.ts` — `CampWorld`。`scenery()` が地面・吹きだまり・デッキ・木・
  奥の森・山・柵・机を置く。`dispose()` は末尾
- `src/lib/games/snow-camp/details.ts` — `Details`。足あと 48 個・煙 10 個・飛ぶ肉/お金。
  material をメッシュごとに `new`
- `src/lib/games/snow-camp/SnowCamp.svelte:113-122` — `onMount` で `new CampWorld(gl, game)`、
  後始末で `world?.dispose()`

`models.ts:8-28`（現状）

```ts
const materials = new Map<string, THREE.MeshStandardMaterial>();

export function mat(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
  const key = color + JSON.stringify(extra);
  let m = materials.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    materials.set(key, m);
  }
  return m;
}

function mesh(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, extra = {}) {
  const m = new THREE.Mesh(geometry, mat(color, extra));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const sphere = (r: number) => new THREE.SphereGeometry(r, 20, 14);
const cyl = (r1: number, r2: number, h: number, seg = 16) => new THREE.CylinderGeometry(r1, r2, h, seg);
```

`models.ts:100-114`（現状。松の木。`.scale(1, 0.85, 1.2)` のように geometry を **その場で変形** している
呼び出しが `bear()`/`rabbit()`/`meat()` にある点に注意）

```ts
export function pine(size: number) {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.012, 0.016, 0.06), '#7a4e2e', 0, 0.03, 0));
  const tiers = [
    [0.1, 0.34, 0.07],
    [0.08, 0.26, 0.13],
    [0.055, 0.18, 0.19]
  ];
  for (const [r, h, y] of tiers) {
    g.add(mesh(new THREE.ConeGeometry(r, h * 0.45, 10), '#2f8f5b', 0, y + h * 0.2, 0, { flatShading: true }));
    g.add(mesh(new THREE.ConeGeometry(r * 0.55, h * 0.2, 10), '#ffffff', 0, y + h * 0.36, 0, { flatShading: true }));
  }
  g.scale.setScalar(size / 0.12);
  return g;
}
```

`world3d.ts:73-93`（現状。木・奥の森・山）

```ts
  for (const t of trees) {
    const tree = pine(t.s);
    tree.position.set(t.x, 0, t.y);
    tree.rotation.y = t.x * 9;
    scene.add(tree);
  }
  // 画面の奥に見える、雪原の外の森と山
  for (let i = 0; i < 24; i++) {
    const tree = pine(0.11 + (i % 4) * 0.02);
    tree.position.set(-0.3 + i * 0.1, 0, -0.1 - (i % 3) * 0.1);
    scene.add(tree);
  }
  for (let i = 0; i < 7; i++) {
    const h = 0.9 + (i % 3) * 0.4;
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 6), mat('#a9c4e6', { flatShading: true }));
    // ...
```

`world3d.ts:167-171`（現状。renderer の設定）

```ts
  constructor(canvas: HTMLCanvasElement, state: GameState) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

`world3d.ts:387-389`（現状）

```ts
  dispose(): void {
    this.renderer.dispose();
  }
```

`world3d.ts:22-40` の `planks()` は `CanvasTexture` を作り、`:65-68` で
`new THREE.MeshStandardMaterial({ map: planks(), roughness: 0.85 })` として **キャッシュを通さず** deck に使う。
`details.ts:33` と `:43` は足あと・煙の material を **メッシュごとに `new`** する。
`models.ts:188-191` の `marker()` の ring と `:209-218` の `pointer()` も `new THREE.MeshBasicMaterial`。
これら「キャッシュを通していない material」は面ごとに作られるので、破棄の対象になる。
一方 `mat()` が返す material はモジュール変数の `Map` にあり、次の面でも使うので **破棄してはいけない**。

テスト — `src/lib/games/snow-camp/engine.test.ts` と `guide.test.ts` はある。`models.ts`/`world3d.ts` に
テストはない。three は node で import でき（`import * as THREE from 'three'`）、`Group`/`Mesh`/
`BufferGeometry` は WebGL なしで作れる。`WebGLRenderer` は canvas が要るのでテストしない。

守るべき規約は、コメントは WHY だけ・日本語、prettier、engine と描画の分離。

## Commands you will need

すべて `/Users/oekazuma/localRepo/table-duel` で実行する。

| 目的   | コマンド                                   | 成功時                           |
| ------ | ------------------------------------------ | -------------------------------- |
| テスト | `pnpm test:run src/lib/games/snow-camp`    | pass                             |
| 型     | `pnpm check`                               | `0 ERRORS`                       |
| lint   | `pnpm lint`                                | exit 0                           |
| まとめ | `pnpm verify`                              | exit 0                           |
| 目視   | `pnpm dev` → `/table-duel/games/snow-camp` | 5 面続けて遊んでも 3D が消えない |

## Scope

**In scope**

- `src/lib/games/snow-camp/models.ts`
- `src/lib/games/snow-camp/world3d.ts`
- `src/lib/games/snow-camp/details.ts`
- `src/lib/games/snow-camp/models.test.ts`（新規）
- `plans/README.md`

**Out of scope**

- `engine.ts`、`guide.ts`、`SnowCamp.svelte`、`Hud.svelte` — 触らない
- `CampWorld` を `{#key round}` の外に出して面ごとに使い回す再設計 — 効くが `SoloShell` の構造に
  踏み込む。破棄が正しくなればまず足りる
- 影の解像度（1024）や `PCFSoftShadowMap` — 変えない

## Git workflow

- ブランチ: `advisor/006-snow-camp-gpu`
- コミットは「geometry 共有 + 影」「DPR」「破棄」の 3 つ。英語の命令形 1 文、
  末尾に `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
- **push しない**

## Steps

### Step 1: geometry をキャッシュし、影を opt-in にする

`models.ts` に `mat()` と同じ形の geometry キャッシュを足す。鍵は「種類 + 引数」。

```ts
const geometries = new Map<string, THREE.BufferGeometry>();

/** 同じ形の geometry は 1 つを使い回す。木 1 本で 7 個、面全体で数百個になるので GPU に上げる回数を減らす */
function geo(key: string, make: () => THREE.BufferGeometry) {
  let g = geometries.get(key);
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}

const sphere = (r: number) => geo(`sphere:${r}`, () => new THREE.SphereGeometry(r, 20, 14));
const cyl = (r1: number, r2: number, h: number, seg = 16) =>
  geo(`cyl:${r1}:${r2}:${h}:${seg}`, () => new THREE.CylinderGeometry(r1, r2, h, seg));
```

注意点が 2 つある。

- `bear()`/`rabbit()`/`meat()` の `sphere(0.05).scale(1, 0.85, 1.2)` は geometry を **その場で変形** する。
  共有すると 2 回目以降に二重に潰れる。これらは `.scale(...)` を消し、代わりに `mesh` の戻り値に
  `m.scale.set(1, 0.85, 1.2)` を当てる（`mesh()` の戻り値は `THREE.Mesh` なので `scale` を持つ）。
  `grep -n "\.scale(" src/lib/games/snow-camp/models.ts` で全部拾う（`g.scale.setScalar` は Group の
  スケールで別物。geometry の `.scale(` だけ直す）
- `pine()` の `ConeGeometry`、`badge()`/`axe()` の `BoxGeometry`、`person()` の `CapsuleGeometry`/
  `TorusGeometry` も `geo()` を通す。鍵は引数を `:` で繋ぐ

次に `mesh()` の `castShadow` を引数にする。

```ts
function mesh(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0, extra = {}, shadow = true) {
```

呼び出しが多いので、既定は `true` のままにし、影の要らないものだけ `false` を渡す方針でもよい。
ただし `scenery()`（`world3d.ts`）の奥の森 24 本と山 14 個は `pine()`/`new THREE.Mesh` で作られるので、
`scene.add` の前に `tree.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = false; })` で
落とす。吹きだまり 26 個は `receiveShadow` だけで `castShadow` は付いていない（そのまま）。
`fire()` の炎（`f.castShadow = false` 済み）、`marker()` の矢印（`arrow.castShadow = false` 済み）は既に落ちている。

確認 — `pnpm check` → `0 ERRORS`

### Step 2: geometry の共有と影の設定をテストで固定する

`src/lib/games/snow-camp/models.test.ts` を新規に作る。

```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bear, pine } from './models';

const meshes = (g: THREE.Object3D) => {
  const list: THREE.Mesh[] = [];
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) list.push(o);
  });
  return list;
};

describe('snow-camp models', () => {
  it('同じ部品は geometry を使い回す', () => {
    const [a, b] = [meshes(pine(0.1)), meshes(pine(0.1))];
    expect(a).toHaveLength(7);
    a.forEach((m, i) => expect(m.geometry).toBe(b[i].geometry));
  });

  it('潰した球は geometry ではなく mesh の scale で潰す', () => {
    const body = meshes(bear())[0];
    expect(body.scale.toArray()).not.toEqual([1, 1, 1]);
    expect(meshes(bear())[0].geometry).toBe(body.geometry);
  });
});
```

`bear()` の最初の mesh が胴（`sphere(0.05)` を潰したもの）であることは `models.ts:51` で確かめる。

確認 — `pnpm test:run src/lib/games/snow-camp` → pass

### Step 3: DPR を 1.5 に抑え、MSAA を外す

`world3d.ts:168-169` を次にする。

```ts
// 平面的なローポリなので、iPad の dpr 2 + MSAA は見た目に効かず描画だけ重い
this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
this.renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
```

`SnowCamp.svelte` の 2D オーバーレイ（文字・粒）は別の canvas で dpr そのままなので、文字はにじまない。

確認 — `pnpm check` → `0 ERRORS`

### Step 4: `dispose()` で面ごとに作ったものを解放する

`world3d.ts` の `dispose()` を次にする。`mat()` の material は **触らない**。

```ts
  dispose(): void {
    // mat() の material はモジュールで共有していて次の面でも使うので、ここで作った texture と material だけ捨てる
    this.#deckMaterial.map?.dispose();
    this.#deckMaterial.dispose();
    this.#details.dispose();
    (this.#marker.ring.material as THREE.Material).dispose();
    this.#pointer.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
    });
    this.renderer.dispose();
    // dispose() だけではコンテキストが残り、Safari は十数個で古いものを失う
    this.renderer.forceContextLoss();
  }
```

そのために次の変更が要る。

- `scenery()` の deck の material をフィールドに持つ。`scenery(scene, trees)` は自由関数なので、
  戻り値で `{ deckMaterial }` を返すか、`CampWorld` のコンストラクタで `const deck = scenery(...)` と受ける。
  最小の変更は `scenery` が `THREE.MeshStandardMaterial` を返す形
- `Details` に `dispose()` を足す（`details.ts`）— 足あと 48 個と煙 10 個の material を `dispose()`、
  `CircleGeometry`（`:31` の `geo`、48 個で共有）と煙の `SphereGeometry`（10 個それぞれ `new`）を `dispose()`。
  飛んでいる肉/お金は `models.ts` の共有部品なので触らない
- geometry は Step 1 でモジュールのキャッシュに移したので、`dispose()` しない（次の面で使う）

確認 — `pnpm check` → `0 ERRORS`、`pnpm lint` → exit 0

### Step 5: 目視で 5 面続けて遊ぶ

`pnpm dev` で `http://localhost:5173/table-duel/games/snow-camp` を開き、DevTools の Console を出す。

- 1 面クリア → 「つぎへ」→ 2 面… を 5 回繰り返す。期待 — 毎面 3D が描かれ、Console に
  `WebGL: CONTEXT_LOST_WEBGL` や three の warning が出ない
- 途中で ✕ → タイトル → スタート を挟んでも同じ
- 木・熊・ウサギ・肉の形が以前と同じ（潰した球が二重に潰れていない、木の段が揃っている）
- 主人公と動物の影は落ち、奥の森と山の影は落ちない（画面の奥は影がなくても気づかない）

確認 — 上の 4 点。`pnpm verify` → exit 0

## Test plan

- Step 2 の `models.test.ts` 2 件（node で three を使う。`WebGLRenderer` は使わない）
- コンテキストの解放は目視（Step 5）。happy-dom には WebGL がない

## Done criteria

- [ ] `pnpm verify` が exit 0
- [ ] `src/lib/games/snow-camp/models.test.ts` が存在し pass
- [ ] `grep -n "forceContextLoss" src/lib/games/snow-camp/world3d.ts` が 1 件
- [ ] `grep -n "antialias: false" src/lib/games/snow-camp/world3d.ts` が 1 件、`Math.min(1.5, devicePixelRatio)` が 1 件
- [ ] `grep -n "\.scale(" src/lib/games/snow-camp/models.ts` に geometry の `.scale(` が残っていない
      （`g.scale.setScalar` / `m.scale.set` のような Object3D の scale は残ってよい）
- [ ] `grep -n "materials.clear\|materials.delete\|geometries.clear\|geometries.delete" src/lib/games/snow-camp/` が 0 件
      （共有キャッシュを捨てていない）
- [ ] Step 5 の目視 4 点
- [ ] `git status` で In scope 以外が変わっていない
- [ ] `plans/README.md` の 006 の Status を更新した

## STOP conditions

- 「Current state」の抜粋と一致しない
- Step 5 で 2 面目以降が真っ黒になる（共有 material を捨てている、または geometry を捨てている）
- three の型で `forceContextLoss` が見つからない（バージョンが変わっている。`node_modules/three/package.json` の
  `version` を報告する）
- `world3d.ts` の変更が `SnowCamp.svelte` の変更を要求する

## Maintenance notes

- 新しい部品を `models.ts` に足すときは `sphere()`/`cyl()`/`geo()` を通し、geometry の `.scale()`/`.translate()`
  は使わない（共有されるので）。変形は mesh の `scale`/`position` で
- 面ごとに `new` した material/texture は `dispose()` に足す。`mat()` を通したものは足さない
- `CampWorld` を面をまたいで使い回す設計にするなら、この `dispose()` はアンマウント時だけになる
