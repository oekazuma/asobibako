# Plan 047: カメレオンでポーズを変えているあいだ、体の真ん中を出すのに体全体を焼き直さない

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat b565b01..HEAD -- src/lib/games/yappari-chameleon/doll3d.ts src/lib/games/yappari-chameleon/doll3d.test.ts src/lib/games/yappari-chameleon/world3d.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                  |
| ---------- | ------------------------------------------------------------------- |
| Priority   | P1                                                                  |
| Effort     | S                                                                   |
| Risk       | LOW（真ん中の値は今と同じ。出し方だけ軽くする。テストで一致を見る） |
| Depends on | none                                                                |
| Category   | perf                                                                |
| Planned at | commit `b565b01`, 2026-10-14                                        |

## Why this matters

やっぱりカメレオンで隠れる人がポーズを変えると、骨が動いている約 0.5 秒（約 30 コマ）のあいだ、毎フレーム人形の全部の頂点
（最大約 6 万の角）を CPU で骨で曲げ直している。作者のコメントでは 1 回約 8ms で、iPad の 1 コマ 16.7ms の半分になり、
ポーズを変えるたびにカクつく。隠れる人はポーズをよく変える。

焼き直しの本来の目的は「指の当たり判定用の見えない体（`rig.pick`）」を今の形にすることで、これは塗る指やスポイトのときだけ要る。
ところが、毎フレーム呼ばれる `dollCenter()`（壁の向こうの自分を透かす丸い窓の位置と、ペイントのカメラが回る中心）も、
この焼き直しを通して真ん中を出している。真ん中だけなら、同じ位置にある角を 1 回ずつ曲げれば足りる（角は面ごとに
重なっていて、ちがう位置は約 6 分の 1）。そこで、真ん中は別の軽い関数で出し、焼き直しは当たり判定のときだけにする。

## Current state

関係するファイルは 3 つ。

- `src/lib/games/yappari-chameleon/doll3d.ts` — 人形の 3D（`makeDoll`・`bakePose`・`PoseAnimator`）
- `src/lib/games/yappari-chameleon/world3d.ts` — 屋敷と人形を描く `World`。`#body()` と `dollCenter()` がここにある
- `src/lib/games/yappari-chameleon/doll3d.test.ts` — `bakePose` のテスト。node で本物の人形を組み立てて試せる

`makeDoll` は、面の角ごとに頂点を持つ（角は共有しない）。`a.corner[k]` は角 k が体の面のどの頂点か（`doll3d.ts:20-32`）。

```ts
export function makeDoll(renderer: THREE.WebGLRenderer, s: DollSurface, a: Atlas): DollRig {
  const n = a.corner.length;
  const pos = new Float32Array(n * 3);
  ...
  for (let k = 0; k < n; k++) {
    const v = a.corner[k];
    pos.set(s.pos.subarray(v * 3, v * 3 + 3), k * 3);
    nrm.set(s.nrm.subarray(v * 3, v * 3 + 3), k * 3);
    skinIndex.set(s.skinIndex.subarray(v * 4, v * 4 + 4), k * 4);
    skinWeight.set(s.skinWeight.subarray(v * 4, v * 4 + 4), k * 4);
  }
```

同じ頂点の角は、位置も骨の重みも同じなので、骨で曲げた位置も同じになる。

`bakePose`（`doll3d.ts:88-103`）は全部の角を曲げて `rig.pick` に書き、外接球の中心（three の `computeBoundingSphere` は
外接の箱の中心を球の中心にする）を返す。

```ts
/** pick を今のポーズの形に焼き直し、メッシュの座標での体の真ん中を返す */
export function bakePose(rig: DollRig): THREE.Vector3 {
  // 骨の行列は描画のときに更新されるので、その前に呼ばれても今の骨で曲げる
  rig.root.updateMatrixWorld(true);
  const at = rig.pick.geometry.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < at.count; i++) {
    rig.mesh.getVertexPosition(i, v);
    at.setXYZ(i, v.x, v.y, v.z);
  }
  at.needsUpdate = true;
  // Mesh.raycast は外接の箱と球を作り直さず使い回すので、焼くたびに計算し直す
  rig.pick.geometry.computeBoundingBox();
  rig.pick.geometry.computeBoundingSphere();
  return rig.pick.geometry.boundingSphere!.center;
}
```

`DollRig`（`doll3d.ts:9-17`）の今の形は次のとおり（`paint` と `material` のあとに閉じる）。

```ts
export interface DollRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  /** 今のポーズに焼いた見えない体。塗る指の当たり判定と体の中心を、毎回骨で曲げ直さずに出す */
  pick: THREE.Mesh;
  bones: Record<Bone, THREE.Bone>;
  paint: PaintSurface;
  ...
```

`world3d.ts` の今のコード。`#baked` と `#center` は `world3d.ts:86-87` のフィールド。

```ts
  /** 今のポーズの当たり用の体。骨が動いたときだけ焼き直す（焼くのに 8ms ほどかかる） */
  #body(): THREE.Mesh {
    if (this.poses.version !== this.#baked) {
      this.#baked = this.poses.version;
      this.#center.copy(bakePose(this.rig));
    }
    return this.rig.pick;
  }

  /** 体の真ん中（ペイントのカメラが回る中心）。ポーズで変わるので骨で曲げた形から出す */
  dollCenter(): V3 {
    this.#body();
    const c = this.#center.clone().applyMatrix4(this.rig.mesh.matrixWorld);
    return [c.x, c.y, c.z];
  }
```

`#body()` を呼ぶのは `dollCenter()`（毎フレーム）、`pickBody()` と `spoit()`（指の操作のとき）。`dollCenter()` は
`xray()`（`world3d.ts:366`、歩いているあいだ毎フレーム）、`play.svelte.ts:487`（ペイントのあいだ毎フレーム）、
`session.svelte.ts:269`（見つかったとき）から呼ばれる。

`PoseAnimator.version`（`doll3d.ts:128`）は骨を動かすたびに 1 増え、止まっているあいだは増えない（テスト
「骨が動くたびに version が増え、止まっているあいだは増えない」が固めている）。

`bakePose` はほかに `cpu/senses3d.ts:99` も使う。これは変えない。

テストの道具（`doll3d.test.ts:1-18`）。`rig()` が本物の人形と `PoseAnimator` を返す。`poseById(id)` でポーズを引き、
`poses.snap(p)` ですぐそのポーズにする。全ポーズの表は `poses.ts` の `POSES`。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く。テストの名前は日本語の文にする。

## Commands you will need

| Purpose        | Command                                                               | Expected on success           |
| -------------- | --------------------------------------------------------------------- | ----------------------------- |
| このテストだけ | `pnpm exec vitest run src/lib/games/yappari-chameleon/doll3d.test.ts` | すべて pass                   |
| カメレオン全部 | `pnpm exec vitest run src/lib/games/yappari-chameleon/`               | すべて pass                   |
| 型             | `pnpm check`                                                          | `0 ERRORS 0 WARNINGS`、exit 0 |
| 全部           | `pnpm verify`                                                         | exit 0                        |

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/doll3d.ts`（`DollRig` に 1 項目、`makeDoll` で埋める、`poseCenter` を足す）
- `src/lib/games/yappari-chameleon/world3d.ts`（`#body()` と `dollCenter()` とフィールド 1 つ）
- `src/lib/games/yappari-chameleon/doll3d.test.ts`（テストを 2 つ足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `bakePose` の中身と、`cpu/senses3d.ts` の呼び方 — 当たり判定と CPU の目は今の焼き直しのまま
- `xray()` / `play.svelte.ts` / `session.svelte.ts` — `dollCenter()` の返す値が今と同じなので触らない
- 骨の位置から真ん中を見積もる方法 — 値が今と変わり、窓とカメラの中心がずれるので採らない
- CLAUDE.md — 仕様は変わらない

## Git workflow

- ブランチは `advisor/047-chameleon-pose-center-without-bake`
- コミットは英語の命令形 1 文（例 `Find the doll center from one corner per vertex instead of baking the pick mesh every frame`）
- push しない

## Steps

### Step 1: 一致を見るテストを先に足す（まだ関数が無いので落ちる）

`doll3d.test.ts` の import を `import { bakePose, makeDoll, PoseAnimator, poseCenter, restHit } from './doll3d';` にし、
`import { POSES, poseById } from './poses';` にする（`POSES` が `poses.ts` から export されていることを先に確かめる）。
`describe('bakePose', …)` の中の最後に、次の 2 つを足す。

```ts
it('poseCenter は、どのポーズでも焼き直した体の真ん中と同じ点を返す', () => {
  const { r, poses } = rig();
  for (const p of POSES) {
    poses.snap(p);
    const c = poseCenter(r).clone();
    const baked = bakePose(r);
    expect(c.x).toBeCloseTo(baked.x, 5);
    expect(c.y).toBeCloseTo(baked.y, 5);
    expect(c.z).toBeCloseTo(baked.z, 5);
  }
});

it('poseCenter は同じ位置の角を 1 回しか曲げない（角の数の 4 分の 1 より少ない）', () => {
  const { r } = rig();
  expect(r.reps.length).toBeGreaterThan(0);
  expect(r.reps.length).toBeLessThan(r.mesh.geometry.attributes.position.count / 4);
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/doll3d.test.ts` → 型か import のエラーで落ちる（`poseCenter` と
`reps` がまだ無い）。

### Step 2: `makeDoll` で「頂点ごとに 1 つの角」を作り、`poseCenter` を足す

`doll3d.ts` で次のようにする。

1. `DollRig` に項目を足す（`pick` の下あたり）。

   ```ts
   /** 体の面の頂点ごとに 1 つ選んだ角。角は面ごとに重なっているので、真ん中を出すにはこれだけ曲げれば足りる */
   reps: Uint32Array;
   ```

2. `makeDoll` の角のループのあとで、頂点ごとに最初の角を集める。`s.pos.length / 3` が頂点の数。

   ```ts
   const first = new Int32Array(s.pos.length / 3).fill(-1);
   for (let k = 0; k < n; k++) if (first[a.corner[k]] < 0) first[a.corner[k]] = k;
   const reps = Uint32Array.from(first.filter((k) => k >= 0));
   ```

   `makeDoll` の最後の `return { root, mesh, pick, bones, paint, material };` に `reps` を足す。

3. `bakePose` の下に `poseCenter` を足す。中心の出し方は `computeBoundingSphere` と同じ「外接の箱の中心」。

   ```ts
   /** 今のポーズの体の真ん中（メッシュの座標）。bakePose と同じ点を、頂点ごとに 1 つの角だけ曲げて出す */
   export function poseCenter(rig: DollRig): THREE.Vector3 {
     rig.root.updateMatrixWorld(true);
     const box = new THREE.Box3();
     const v = new THREE.Vector3();
     for (const i of rig.reps) box.expandByPoint(rig.mesh.getVertexPosition(i, v));
     return box.getCenter(new THREE.Vector3());
   }
   ```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/doll3d.test.ts` → すべて pass（足した 2 つを含む）。

### Step 3: `World` の真ん中を `poseCenter` で出し、焼き直しは当たり判定のときだけにする

`world3d.ts` で次のようにする。

1. import を `import { bakePose, PoseAnimator, poseCenter, type DollRig } from './doll3d';` にする
2. フィールド `#baked = -1;` の下に `#centered = -1;` を足す
3. `#body()` と `dollCenter()` を次の形にする

   ```ts
     /** 今のポーズの当たり用の体。骨が動いたときだけ焼き直す（焼くのに 8ms ほどかかるので、指で触れたときだけ） */
     #body(): THREE.Mesh {
       if (this.poses.version !== this.#baked) {
         this.#baked = this.poses.version;
         bakePose(this.rig);
       }
       return this.rig.pick;
     }

     /** 体の真ん中（ペイントのカメラが回る中心）。毎フレーム呼ばれるので、当たり用の体を焼かずに出す */
     dollCenter(): V3 {
       if (this.poses.version !== this.#centered) {
         this.#centered = this.poses.version;
         this.#center.copy(poseCenter(this.rig));
       }
       const c = this.#center.clone().applyMatrix4(this.rig.mesh.matrixWorld);
       return [c.x, c.y, c.z];
     }
   ```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass。
`grep -n "this.#body()" src/lib/games/yappari-chameleon/world3d.ts` → `pickBody` と `spoit` の 2 行だけ。
`grep -rn "rig\.pick" src/lib/games/yappari-chameleon | grep -v "\.test\.ts" | grep -v doll3d.ts` → `world3d.ts` の `#body()` と
`spoit` の行、`remote.ts` の後片付け（`dispose`）、`cpu/senses3d.ts` の自分で `bakePose` した直後の行だけ。ほかの場所が
`rig.pick` を読んでいたら STOP（ポーズが動くあいだ `pick` は次に触れるまで古いままになるので、その読み手が困る）。

### Step 4: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。

## Test plan

- 足すテストは Step 1 の 2 つ。全ポーズで `poseCenter` と `bakePose` の真ん中が 5 桁まで一致すること、選んだ角が全部の角の
  4 分の 1 より少ないこと
- 型にするテストは `doll3d.test.ts` の「ポーズを変えて焼き直すと、体の真ん中と当たりが今の形に移る」
- 既存の `glow.test.ts`・`remote.test.ts`・`cpu/senses3d.test.ts` は `makeDoll` を使うので、pass のままであることを見る

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/yappari-chameleon/doll3d.test.ts` が pass し、足した 2 つを含む
- [ ] `grep -n "this.#body()" src/lib/games/yappari-chameleon/world3d.ts` が `pickBody` と `spoit` の 2 行だけ
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 047 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `doll3d.ts` の `makeDoll` / `bakePose`、`world3d.ts` の `#body()` / `dollCenter()` が上の抜粋と違う
- `POSES` が `poses.ts` から export されていない
- Step 1 の一致のテストが、5 桁で一致しない（同じ頂点の角でも曲げた位置がちがう、という前提が崩れている）。桁を緩めずに報告する
- 2 つめのテストで `reps.length` が角の数の 4 分の 1 以上になる（角が思ったほど重なっていない）
- ほかのファイルが `DollRig` を手で組み立てていて、`reps` が無いと型が通らない（`grep -rn "pick:" src/lib/games/yappari-chameleon`
  で探す）。そのファイルを直すかは報告して決める

## Maintenance notes

- 体の面の作り方（`buildDoll` / `layAtlas`）を変えたら、Step 1 のテストが「同じ頂点の角は同じ位置に曲がる」を見張る
- 焼き直しの重さそのもの（約 8ms）は、指で触れたとき・CPU の目が測るときに残る。骨の行列を先に計算しておけば約 3ms に
  なる見込みがある（作者のメモ）が、この計画では扱わない
- 実機では、隠れる人で歩きながらポーズの輪から何度もポーズを変え、カクつかないことを見る。壁の向こうの自分を透かす窓と、
  ペイントのカメラの回る中心の位置が今と変わらないことも見る
