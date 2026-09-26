# Plan 035: ペットの外接を先に渡し、ひろばや部屋に入るたびの止まりをなくす

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 12aa152..HEAD -- src/lib/games/pet-house/models.ts src/lib/games/pet-house/accessories.ts src/lib/games/pet-house/world3d.ts src/lib/games/pet-house/models.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                          |
| ---------- | --------------------------------------------------------------------------- |
| Priority   | P1                                                                          |
| Effort     | S                                                                           |
| Risk       | LOW（見た目は変えない。外接は影の大きさと描く順番の目安にしか使っていない） |
| Depends on | none                                                                        |
| Category   | perf                                                                        |
| Planned at | commit `12aa152`, 2026-09-26                                                |

## Why this matters

headless Chrome（Apple M4 の GPU、iPad Air 相当の画面）で遊ばせて測ったところ、わんにゃんハウスのふれあいひろばに
入るたびに約 470ms（CPU を 4 倍遅くすると約 2 秒）画面が止まった。形がすべて控えから読めていて、組み立てがいらない
2 回目以降でも毎回止まる。CPU プロファイルでは、この止まりの約 8 割が次の 2 つだった。

- `world3d.ts:333` の `new THREE.Box3().setFromObject(model.group)` が、体と毛の `SkinnedMesh` ごとに
  `computeBoundingBox()` を呼ぶ（234ms）。three の SkinnedMesh は、骨で曲げた全頂点（毛の殻は層の数だけ）から外接を測り直す
- 描画の中で three が透明なものの並べ替えのために `SkinnedMesh.computeBoundingSphere()` を呼ぶ（225ms）。
  `frustumCulled = false` にしてあっても、並べ替えのための外接球は初回に測られる

どちらも、メッシュに `boundingBox` / `boundingSphere` が入っていれば測り直さない。立ち姿の形（geometry）の外接で目的
（影の丸の大きさと、描く順番のおおよその位置）には足りる。部屋を開くときも同じ計算で約 130ms かかっていた。

あわせて、部屋を開くときの 358ms のうち約 90ms は、three がシェーダーをコンパイルしたあとに `getProgramInfoLog` で
エラーを確かめるための同期待ちだった。本番ではこの確かめを切る（three の `renderer.debug.checkShaderErrors`）。

## Current state

`src/lib/games/pet-house/models.ts:627-638`（体と毛の殻。`body.geo` と `body.shell` は種類と画質ごとに共有される geometry）

```ts
for (let i = 0; i <= L; i++) {
  const m = new THREE.SkinnedMesh(i ? body.shell : body.geo, furMaterial(i, L, cell));
  fur.push({ mesh: m, layer: i });
  m.bind(skeleton, new THREE.Matrix4());
  // 骨で曲げた形は元の外接球からはみ出すので、画面の端で消えないよう切り捨てない
  m.frustumCulled = false;
  m.castShadow = i === 0;
  m.receiveShadow = true;
  root.add(m);
}
```

`src/lib/games/pet-house/accessories.ts:303-315`（首輪などのアクセサリー。体と同じ骨で曲げる）

```ts
function mesh(key: string, fit: Fit, make: () => THREE.BufferGeometry[], materials: THREE.Material[]) {
  const k = `${key}:${fit.key}`;
  let list = shapes.get(k);
  if (!list) shapes.set(k, (list = make()));
  return list.map((g, i) => {
    const m = new THREE.SkinnedMesh(g, materials[i]);
    m.bind(fit.skeleton, new THREE.Matrix4());
    // 骨で曲げた形は元の外接球からはみ出すので切り捨てない
    m.frustumCulled = false;
    m.castShadow = true;
    return m;
  });
}
```

`src/lib/games/pet-house/world3d.ts:331-334`

```ts
      if (!view) {
        const model = createPet(pet.breed, quality);
        const size = new THREE.Box3().setFromObject(model.group).getSize(this.#v);
        const blob = new THREE.Mesh(blobGeometry, this.#blob);
```

`src/lib/games/pet-house/world3d.ts:164` — `this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });`

three r186 の仕様（`node_modules/three/src/objects/SkinnedMesh.js` と `src/math/Box3.js` で確かめられる）

- `Box3.expandByObject` は、`object.boundingBox !== undefined` のものは `object.boundingBox` を使い、null なら
  `object.computeBoundingBox()` を呼ぶ。SkinnedMesh の `computeBoundingBox` は全頂点に `applyBoneTransform` をかける
- `WebGLRenderer` の並べ替えは、`object.boundingSphere !== undefined` のものは `object.boundingSphere` を使い、null なら
  `object.computeBoundingSphere()` を呼ぶ
- `BufferGeometry.computeBoundingBox()` / `computeBoundingSphere()` は骨を使わず、geometry に 1 度だけ覚える

SvelteKit では `import { dev } from '$app/environment';` で開発中かどうかが分かる（`models.ts` は以前 `$app/environment` を
使っていたので、vitest でも解決できる）。

## Commands you will need

| Purpose             | Command                                                       | Expected on success  |
| ------------------- | ------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                              | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house/models.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                                               | all pass             |
| 型                  | `pnpm check`                                                  | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                   | exit 0               |
| ビルド              | `pnpm build`                                                  | exit 0               |

## Scope

In scope は `src/lib/games/pet-house/models.ts`、`src/lib/games/pet-house/accessories.ts`、
`src/lib/games/pet-house/world3d.ts`、`src/lib/games/pet-house/models.test.ts`。

Out of scope は次のとおり。

- `frustumCulled` の値（切り捨てないままにする）
- ほかの場面のメッシュ（部屋の家具など。骨で曲げないものは geometry の外接を使うので安い）
- 雪原サバイバル（`snow-camp/world3d.ts`）の renderer

## Git workflow

- ステップごとにコミットしてよい。メッセージは英語の命令形 1 行（例 `Give pet skinned meshes their bounds up front`）。
  末尾に Co-Authored-By を 1 行
- push しない

## Steps

### Step 1: 骨で曲げるメッシュに、形の外接を先に入れる

`models.ts` に小さな関数を足し、体と毛の殻の `SkinnedMesh` を作ったところ（`m.bind(...)` のあと）で呼ぶ。

```ts
/**
 * 骨で曲げたメッシュは、外接を聞かれるたびに全頂点を骨で動かして測り直す（ひろばの 8 匹で 0.5 秒止まった）。
 * 影の大きさと描く順番の目安にしか使わないので、立ち姿の形の外接で足りる
 */
export function restBounds(m: THREE.SkinnedMesh): void {
  const g = m.geometry;
  if (!g.boundingBox) g.computeBoundingBox();
  if (!g.boundingSphere) g.computeBoundingSphere();
  m.boundingBox = g.boundingBox!.clone();
  m.boundingSphere = g.boundingSphere!.clone();
}
```

（`!` を使わずに書けるならそのほうがよい。）`accessories.ts` の `mesh()` でも、`m.bind(...)` のあとに同じ関数を呼ぶ
（`models.ts` から import する。循環 import になるなら、`accessories.ts` に同じ 4 行を置き、JSDoc は `models.ts` 側だけに書く）。

**Verify**: `pnpm check` → 0 errors

### Step 2: テストで固める

`models.test.ts` の `describe('pet-house models', ...)` に 1 本足す。

- `createPet('shiba')` と `createPet` に首輪などのアクセサリーを付けたもの（`setAccessory` に `accessories.ts` の
  ACCESSORIES から 1 つ）を作り、`group.traverse` で見つかる `THREE.SkinnedMesh` がすべて `boundingBox` と
  `boundingSphere` を持つ（null でない）
- `vi.spyOn(THREE.SkinnedMesh.prototype, 'computeBoundingBox')` と `computeBoundingSphere` を仕込んでから
  `new THREE.Box3().setFromObject(pet.group)` を呼んでも、どちらも 1 回も呼ばれない
- 外接箱の高さが 0 より大きい（`getSize().y > 0.1`）

`vi` を import に足す。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/models.test.ts` → all pass（1 本増える）。Step 1 の呼び出しを
一時的に消すとこのテストが落ちることを確かめてから戻す

### Step 3: 本番ではシェーダーのエラー確かめを切る

`world3d.ts` の renderer を作った直後に次を足す。

```ts
// コンパイルのたびに結果を同期で待つので、部屋を開くときに 90ms ほど止まる。直すべきシェーダーの誤りは開発中に出る
this.renderer.debug.checkShaderErrors = dev;
```

`dev` は `$app/environment` から import する。

**Verify**: `pnpm check` → 0 errors。`pnpm build` → exit 0

### Step 4: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

`models.test.ts` に 1 本（Step 2）。止まる時間そのものはレビュー担当が headless Chrome で測り直す（ひろば入りが 470ms から
どこまで下がったか）。

## Done criteria

- [ ] `grep -n "restBounds" src/lib/games/pet-house/models.ts src/lib/games/pet-house/accessories.ts` が両ファイルで出る
      （accessories に同じ 4 行を置いた場合は `boundingSphere =` が出る）
- [ ] `grep -n "checkShaderErrors" src/lib/games/pet-house/world3d.ts` が 1 行
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm build` / `pnpm vitals --diff` が通る
- [ ] `git diff --name-only 12aa152` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- three の `Box3.expandByObject` や `WebGLRenderer` が、上に書いた仕様と違う（`boundingBox` / `boundingSphere` を見ない）
- テストで `setFromObject` のあとに `computeBoundingBox` が呼ばれてしまい、原因が分からない
- 外接を入れたことで、既存のテスト（足が床に着く、背の高さなど）が落ちる

## Maintenance notes

- 新しく `SkinnedMesh` を作るときは `restBounds` を呼ぶ。忘れると、その形のぶんだけ初回の描画で止まる
- 外接は立ち姿のもの。大きく曲げたかっこうで外接を使う処理（当たり判定など）を足すときは、別に測る
