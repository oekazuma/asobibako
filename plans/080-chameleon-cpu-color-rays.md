# Plan 080: 屋敷の面の色を聞く線 1 本を、まとめた Mesh を升目に分けた当たりで調べて 10 倍ほど軽くする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 982455c..HEAD -- src/lib/games/yappari-chameleon/mansion/merge.ts src/lib/games/yappari-chameleon/mansion/merge.test.ts src/lib/games/yappari-chameleon/mansion/build.test.ts src/lib/games/yappari-chameleon/cpu/hider.ts src/lib/games/yappari-chameleon/cpu/hider.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。
> `src/lib/games/yappari-chameleon/CLAUDE.md` は毎日変わるので diff では見ない。代わりに
> `grep -c '1 本 4〜5ms なので 1 コマに 1 本で' src/lib/games/yappari-chameleon/CLAUDE.md` が `1` で、
> ``grep -c '動かない Mesh は `mansion/merge.ts` の `mergeStatic` が' src/lib/games/yappari-chameleon/CLAUDE.md`` が `1` であることを確かめる。

## Status

| 項目       | 値                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Priority   | P3（計画を書いたときに測ると、1 コマの重さはコメントの値の 4 分の 1 ほどだった。下の「Why this matters」）                                 |
| Effort     | M（直すのは `merge.ts` の 30 行ほど。前後を測る道具を動かす手間がある）                                                                    |
| Risk       | LOW（当たりの探し方だけを変える。返す面が 1 本も変わらないことを、node のテストと実際の屋敷の 900 本で同じページの元の道と比べて確かめる） |
| Depends on | none                                                                                                                                       |
| Category   | perf                                                                                                                                       |
| Planned at | commit `982455c`, 2026-10-14                                                                                                               |

## Why this matters

やっぱりカメレオンの「CPU と遊ぶ」では、隠れる CPU が体の点ごとに背の面の色を 3D に聞いて塗る。1 本の線は `World.pickStage` が
`Raycaster.intersectObject` で屋敷の全部に当てる。屋敷の動かない Mesh は `mergeStatic` が材質ごとに屋敷じゅうで 1 つにまとめているので、
three の外接の球と箱で何も飛ばせず、線 1 本ごとに屋敷の三角形（約 15 万）をほとんど全部調べる。3D スポイト（`World.spoit`）も同じ道を通る。

計画を書いたときに headless Chrome（Apple M4、ANGLE Metal）で測った値は次の表のとおり。コードのコメント（`hider.ts:16`）と
ゲームの仕様（CLAUDE.md）は「1 本 4〜5ms」と書くが、この機械では平均約 1ms、いちばん重い線で約 5ms だった。

| 測ったもの                                              | 今         | 升目に分けた試作 |
| ------------------------------------------------------- | ---------- | ---------------- |
| 隠れ場所の候補から引いた 900 本の線の平均（続けて引く） | 1.0〜1.2ms | 0.074ms          |
| 同じ 900 本のうちいちばん重い線                         | 4.9ms      | 0.66ms           |
| 試合の中の 1 本（強い CPU 2 人の隠れタイム 8 秒、平均） | 1.1〜2.3ms | 約 0.4ms         |
| 試合の中で、1 コマに線にかかった時間の最大              | 3〜7ms     | 約 1.5ms         |
| 返した面（色・艶・法線の y）が元の道と同じだった線の数  | —          | 900 / 900        |

隠れる CPU は升目ごとに 1 回しか聞かず、1 コマに 1 本までなので、重いのは隠れタイムの初めの数秒だけになる（普通の CPU 2 人は 3.3 秒と
4.7 秒で塗り終えた）。それでも 1 コマに数 ms 足すのは、iPad で親の端末が 3D を描きながら審判と CPU を回す隠れタイムには痛い。
試作では、まとめた Mesh の三角形を 2m の升目ごとの見えない Mesh に分け、当たりだけをそちらで調べた。返す面は 1 本も変わらず、
線 1 本は 10 倍以上速くなった。この計画はこれを入れ、前後を同じ道具で測って確かめる。新しい依存は足さない。

## Current state

### 触るファイル

- `src/lib/games/yappari-chameleon/mansion/merge.ts` — `mergeStatic` が動かない Mesh を材質ごとにまとめる。ここに升目に分ける当たりを足す
- `src/lib/games/yappari-chameleon/mansion/merge.test.ts` — `mergeStatic` のテスト（あり）。2 つ足す
- `src/lib/games/yappari-chameleon/mansion/build.test.ts` — node で屋敷を組み立てるテスト（あり）。1 つ足す
- `src/lib/games/yappari-chameleon/cpu/hider.ts` — 隠れる CPU。古い「1 本 4〜5ms」のコメントを 2 か所直す（動きは変えない）
- `src/lib/games/yappari-chameleon/cpu/hider.test.ts` — テストの名前の「1 本 4〜5ms」を外す（中身は変えない）
- `src/lib/games/yappari-chameleon/CLAUDE.md` — ゲームの仕様。1 文を足し、1 か所の数を外す

### 面の色を聞く道（`world3d.ts`、触らない）

隠れる CPU の `senses.colorAt` は `cpu/senses3d.ts:87-89` で `World.pickStage` をそのまま呼ぶ。

```ts
  colorAt(o: V3, d: V3): (Paint & { up: number }) | null {
    return this.#world.pickStage(o, d);
  }
```

`world3d.ts:304-315` の `pickStage` は、屋敷の全体（`#stage`、`setStage` で受けた `Built.group`）へ線を当て、いちばん近い Mesh の材質と UV から色を読む。

```ts
  pickStage(o: V3, d: V3): { color: RGB; metal: number; rough: number; up: number } | null {
    if (!this.#stage) return null;
    this.#ray.set(new THREE.Vector3(...o), new THREE.Vector3(...d));
    const hit = this.#ray.intersectObject(this.#stage, true).find((h) => (h.object as THREE.Mesh).isMesh);
    if (!hit) return null;
    const m = (hit.object as THREE.Mesh).material;
    const pick = readPick(Array.isArray(m) ? m[hit.face?.materialIndex ?? 0] : m, hit.uv);
    if (!pick || !hit.face) return null;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    // 両面を描く材質は裏から当たることがある
    return { ...pick, up: n.dot(this.#ray.ray.direction) > 0 ? -n.y : n.y };
  }
```

使うのは当たった物の `material`・`matrixWorld`、`hit.uv`・`hit.face.normal`・`hit.face.materialIndex` だけで、`hit.faceIndex` は使わない。
3D スポイトの `spoit`（`world3d.ts:291-298`）も同じ物を見る。

### まとめ方（`mansion/merge.ts`）

`merge.ts:4` が `const ATTRS = ['position', 'normal', 'uv'];`。`mergeStatic` の最後（`merge.ts:108-129`）が、材質の組ごとに
1 つの Mesh を作って `root` に足し、元の Mesh を外す。まとめた形は、どの組でも `g.setIndex(…)` を付けてから `mergeGeometries` に渡すので
必ず index を持ち、groups は持たない。

```ts
    // 属性の型や数がそろわないとまとめられず null が返るので、その組は元の Mesh のまま残す
    const merged = mergeGeometries(geos);
    if (!merged) continue;
    // clone は userData を JSON で写し、スポイトの画素（ImageData）を壊すので、値から作り直す
    const one = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        color: mat.color,
        emissive: mat.emissive,
        emissiveIntensity: mat.emissiveIntensity,
        metalness: mat.metalness,
        roughness: mat.roughness,
        side: mat.side,
        map
      })
    );
    if (mat.userData.pick) one.material.userData.pick = mat.userData.pick;
    one.castShadow = mesh.castShadow;
    one.receiveShadow = mesh.receiveShadow;
    root.add(one);
    for (const p of parts) p.mesh.removeFromParent();
  }
}
```

`mergeStatic` を呼ぶのは `mansion/build.ts` の 2 か所だけ。`build.ts:116` が動く物（風船・椅子など）の中の部品を物ごとにまとめ、
`build.ts:144` が屋敷とロビーの残りをまとめる。

```ts
if (i >= first) mergeStatic(o, () => false);
```

```ts
for (const g of [house, lobby]) mergeStatic(g, (o) => moving.has(o) || !!o.userData.art || !!o.userData.glow);
```

動く物は、試合の種で `arrange` が置き直す（`build.ts:145-152`）。物の中でまとめた Mesh は物ごと動き、three が描く前に `matrixWorld` を
その場で書き換える（`Matrix4` の中身を書き換え、別の物に差し替えない）。

### three の当たりの調べ方（`node_modules/three/src/objects/Mesh.js`）

`Mesh.raycast` は、形の外接の球（無ければ `computeBoundingSphere()` で作る）で線が届かなければ返り、届けば形の外接の箱（あれば）で
もう一度見て、通れば `index` の三角形を全部調べる。`computeBoundingSphere()` と `computeBoundingBox()` は `index` を見ず、
`position` の頂点を全部囲む。だから位置の属性を共有して `index` だけ分けた形では、外接の箱と球を自分で作らないと何も飛ばせない。
`Raycaster.intersectObject` は子を全部たどって、物ごとに `object.raycast(raycaster, intersects)` を呼び、最後に距離で並べる。
物の `raycast` を差し替えるのは three の決まった使い方で、ほかの物にはかからない。

### 隠れる CPU が聞く数（`cpu/hider.ts`）

`hider.ts:13-19` にある。

```ts
/** 塗り終えるまでの上限（秒）。隠れタイムの最短 30 秒から、置いて落ち着くまでと余裕を引いた長さ */
export const PAINT_SECS = 20;
/**
 * 面の色を聞くのは 1 コマにこれだけ（1 回ごとに屋敷の面を全部の三角形で調べ、4〜5ms かかる）。
 * 聞く升目は 1 人 100 ほどなので 1 本でも数秒で済む。増やすとコマが延び、延びたぶん吹く点が増えてさらに聞く
 */
export const RAYS_PER_STEP = 1;
```

`hider.ts:145-148` にもう 1 か所ある。

```ts
    while (this.#budget >= 1 && this.#next < plan.length) {
      const p = plan[this.#next];
      // 同じ升目の点は背の面の同じあたりに写るので、色は升目ごとに 1 回だけ聞く（1 本 4〜5ms）
      const cell = `${Math.floor(dot(p.world, u) / this.#cell)}:${Math.floor(dot(p.world, v) / this.#cell)}`;
```

`hider.test.ts:195` のテストの名前は `'面の色は 1 コマに 1 本だけ聞き、コマが延びても増やさない（1 本 4〜5ms で、増やすとさらにコマが延びる）'`。

`RAYS_PER_STEP` は 1 のままにする。計画を書いたときに測ると、強い CPU 2 人でも線は 2 人で 1 秒に 30 本ほどで、1 人 1 秒 60 本の上限に
届かず、吹く点は 1 人 1 秒に約 150（`RATE`）ずつ増えた。塗り終わる速さは `RATE` で決まり、線の上限では決まっていない。

### ゲームの仕様（`src/lib/games/yappari-chameleon/CLAUDE.md`、1 文 1 行）

まとめ方の文はこの行で始まる。

```text
動かない Mesh は `mansion/merge.ts` の `mergeStatic` が材質と影の付け方ごとに 1 つへまとめて描く回数を減らす（動く物・額の絵・台の縁の光る輪は残し、ロビーと屋敷は別々にまとめる。まとめた 1 つがまたぐと、どちらにいても両方を描くため）。
```

隠れる CPU の聞き方の文は次の行。

```text
色は背の向きに直角な面の上の筆の直径の升目ごとに 1 回だけ聞き（1 本 4〜5ms なので 1 コマに 1 本で、体の表面を調べたコマでは聞かない）、20 秒以内に塗り終える（体の表面を調べるのは 2 人めを 0.25 秒遅らせて同じコマに重ねない）。
```

### テストの形

`merge.test.ts:5-18` に、スポイトの印を持つ材質を作る `mat()` と、Mesh を集める `meshes()` がある。`build.test.ts:35-48` は、
`beforeAll` で偽の canvas を差して `buildMansion()` を `built` に入れ、`meshes()` で `built.group` の Mesh を集める。
three の `Raycaster` は node でも動く（`doll3d.test.ts:22` が使っている）。隠れ場所の候補は `cpu/spots.ts` の `SPOTS` と `viewOf`
（node で読める。`cpu/spots.test.ts:16` が使っている）。

### 規約

- コメントは「コードから復元できない WHY」だけを日本語で書く。変更履歴やタスク番号は書かない
- テストの名前は日本語の文にする
- ブラウザの道具（`mcp__Claude_Browser__*` も Claude in Chrome も）は使わない。測るのは下の node のスクリプトで、端末の
  Google Chrome を headless で動かす（built-in browser は隠れていると `requestAnimationFrame` が止まるので向かない）
- `CHAMELEON_VERSION`（`net.ts`）は上げない。弾の当たりは `shots.ts` の `rayLevel`（箱と坂の計算）で、3D の Mesh を使わない

## Commands you will need

| Purpose                | Command                                                                                                                            | Expected on success                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 測る用の dev サーバー  | `pnpm dev --port 5196 --strictPort`（Bash の `run_in_background` で動かす）                                                        | `Local: http://localhost:5196/asobibako` |
| サーバーが動いているか | `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5196/asobibako/`                                                        | `200`                                    |
| 線を測る               | `B="${TMPDIR:-/tmp}/chameleon-rays"; node "$B/chameleon-rays.mjs" "$PWD" rays "$B/<名前>"`（リポジトリの直下で）                   | JSON が 1 行と `wrote …`                 |
| 試合の中で測る         | `B="${TMPDIR:-/tmp}/chameleon-rays"; node "$B/chameleon-rays.mjs" "$PWD" live "$B/<名前>"`                                         | JSON が 1 行と `wrote …`                 |
| サーバーを止める       | `lsof -ti :5196 \| xargs kill`                                                                                                     | `lsof -i :5196` が何も出さない           |
| まとめのテスト         | `pnpm exec vitest run src/lib/games/yappari-chameleon/mansion/merge.test.ts src/lib/games/yappari-chameleon/mansion/build.test.ts` | すべて pass                              |
| カメレオン全部         | `pnpm exec vitest run src/lib/games/yappari-chameleon/`                                                                            | すべて pass                              |
| 型                     | `pnpm check`                                                                                                                       | `0 ERRORS 0 WARNINGS`、exit 0            |
| 全部                   | `pnpm verify`                                                                                                                      | exit 0                                   |

5173 番は使わない（利用者の dev サーバーとぶつかる）。5196 番がふさがっていたら STOP。

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/mansion/merge.ts`（`splitPick` を足し、`mergeStatic` がまとめた Mesh の `raycast` を差し替える）
- `src/lib/games/yappari-chameleon/mansion/merge.test.ts`（テストを 2 つ足す）
- `src/lib/games/yappari-chameleon/mansion/build.test.ts`（テストを 1 つ足す）
- `src/lib/games/yappari-chameleon/cpu/hider.ts`（コメント 2 か所だけ）
- `src/lib/games/yappari-chameleon/cpu/hider.test.ts`（テストの名前 1 つだけ）
- `src/lib/games/yappari-chameleon/CLAUDE.md`（1 行足し、1 か所の数を外す）
- `plans/README.md`（自分の行の Status だけ）

測るスクリプト（`${TMPDIR:-/tmp}/chameleon-rays/chameleon-rays.mjs`）と測った結果はリポジトリの外に置き、コミットしない。

**Out of scope**

- `world3d.ts`（`pickStage`・`spoit`）・`build.ts`・`senses3d.ts`。当たりの差し替えは `merge.ts` の中で済むので、呼ぶ側は変えない
- `RAYS_PER_STEP`・`PAINT_SECS`・`RATE` の値。塗り終わる速さは `RATE` で決まっている（Current state）
- `three-mesh-bvh` などの新しい依存。Step 5 の判定で届かなければ足さずに STOP する
- 線の行き先を `rayLevel`（`shots.ts`）の箱で先に絞る案。当たりの箱は描いた面と一致しない（椅子の脚のあいだ・壁の額など）ので、返す面が変わりうる
- CPU の目（`Senses3d.visible` の `readRenderTargetPixels`）を非同期にすること。Maintenance notes に測った値を残す
- `cpu/spot-seen.ts` の測り直し（`pnpm spots`）。返す色が変わらないので要らない
- `CHAMELEON_VERSION`（`net.ts`）

## Git workflow

- ブランチは `advisor/080-chameleon-cpu-color-rays`
- コミットは 2 つ。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない
  - Step 4 のあと `Raycast merged mansion meshes through cell-sized pick parts`
  - Step 6 のあと `Drop the stale ray cost from the hiding CPU notes`
- push しない（`main` への push は本番に自動デプロイされる）

## Steps

### Step 1: 測る道具を置き、今の値と今の答えを控える

ブランチを切る。

```bash
git switch -c advisor/080-chameleon-cpu-color-rays
```

測るスクリプトを、リポジトリの外の `${TMPDIR:-/tmp}/chameleon-rays/chameleon-rays.mjs` に作る。次のコマンドをそのまま 1 回で実行する
（区切りの `'EOF'` を引用符で囲んでいるので、中の `${…}` はシェルに展開されない）。

`rays` はひとりで試すを開き、隠れ場所の候補（`SPOTS`）から隠れる CPU と同じ 2 種類の線を 900 本作って `World.pickStage` に聞き、
平均（5 回通した平均）といちばん重い線の時間を測って、答えを `picks.json` に書く。さらに、自分の `raycast` を持つ物（この計画で
差し替える Mesh）の `raycast` を一度外して元の道（三角形を全部調べる）に戻し、同じページで同じ 900 本を聞き直して、答えが同じだった
本数を `same` に出す（今のコードでは差し替えた物が無いので `split` は 0）。`live` は CPU と遊ぶで「探す・CPU 2 人・強い」を選んで
始め、隠れタイムの 8 秒のあいだ `pickStage` の時間を数える。

```bash
B="${TMPDIR:-/tmp}/chameleon-rays"; mkdir -p "$B"; cat > "$B/chameleon-rays.mjs" <<'EOF'
// 使い方: node chameleon-rays.mjs <リポジトリの絶対パス> <rays|live> <書き出すフォルダ>
// dev サーバーが http://localhost:5196/asobibako で動いていること
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const [repo, mode, out] = process.argv.slice(2);
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto('http://localhost:5196/asobibako/games/yappari-chameleon', { waitUntil: 'networkidle' });
  await mkdir(out, { recursive: true });
  if (mode === 'rays') {
    await page.getByRole('button', { name: 'ひとりで試す' }).click();
    await page.waitForFunction(() => 'world' in (window.__chameleon ?? {}));
    await page.waitForTimeout(1500);
    const { picks, ...summary } = await page.evaluate(async () => {
      const { SPOTS, viewOf } = await import('/asobibako/src/lib/games/yappari-chameleon/cpu/spots.ts');
      const world = window.__chameleon.world;
      const gl = world.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      // 隠れる CPU と同じ 2 種類の線。体のあたりから背の面へ向かう線と、見られる位置から体のあたりを通る線
      let s = 1;
      const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
      const rays = [];
      for (const sp of SPOTS) {
        const eye = viewOf(sp);
        for (let k = 0; k < 6; k++) {
          const p = [sp.pos[0] + (rand() - 0.5) * 0.4, sp.pos[1] + 0.1 + rand(), sp.pos[2] + (rand() - 0.5) * 0.4];
          rays.push([p, sp.back]);
          const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
          const l = Math.hypot(...d);
          rays.push([eye, d.map((v) => v / l)]);
        }
      }
      const pick = () => rays.map(([o, d]) => world.pickStage(o, d));
      const mean = () => {
        pick();
        const t = performance.now();
        for (let k = 0; k < 5; k++) pick();
        return (performance.now() - t) / rays.length / 5;
      };
      const worst = () =>
        Math.max(
          ...rays.map(([o, d]) => {
            const t = performance.now();
            for (let k = 0; k < 10; k++) world.pickStage(o, d);
            return (performance.now() - t) / 10;
          })
        );
      const picks = pick();
      const ms = mean();
      const max = worst();
      // 自分の raycast を持つ Mesh（升目に分けた当たり）を外し、三角形を全部調べる元の道と同じページで比べる
      const split = [];
      world.scene.traverse((o) => {
        if (Object.hasOwn(o, 'raycast')) split.push([o, o.raycast]);
      });
      for (const [o] of split) delete o.raycast;
      const full = pick();
      const fullMean = mean();
      for (const [o, f] of split) o.raycast = f;
      const same = picks.filter((x, i) => JSON.stringify(x) === JSON.stringify(full[i])).length;
      return {
        gpu,
        n: rays.length,
        hits: picks.filter(Boolean).length,
        mean: +ms.toFixed(3),
        max: +max.toFixed(2),
        fullMean: +fullMean.toFixed(3),
        split: split.length,
        same,
        picks
      };
    });
    console.log(JSON.stringify(summary));
    await writeFile(`${out}/picks.json`, JSON.stringify(picks));
    await writeFile(`${out}/rays.json`, JSON.stringify(summary, null, 2));
  } else if (mode === 'live') {
    // CPU と遊ぶで、プレイヤーが探し、強い CPU 2 人が隠れる
    await page.getByRole('button', { name: 'CPU と遊ぶ' }).click();
    await page.getByRole('button', { name: '探す', exact: true }).click();
    await page.getByRole('button', { name: '2', exact: true }).click();
    await page.getByRole('button', { name: '強い', exact: true }).click();
    await page.getByRole('button', { name: 'ゲームを始める' }).click();
    await page.waitForFunction(
      () => window.__crew && window.__chameleon?.world && window.__session?.match?.view?.phase === 'hide',
      null,
      { timeout: 60000 }
    );
    const summary = await page.evaluate(async () => {
      const world = window.__chameleon.world;
      const pick = world.pickStage.bind(world);
      let rays = 0;
      let rayMs = 0;
      let frame = 0;
      let frameMax = 0;
      world.pickStage = (o, d) => {
        const t = performance.now();
        const x = pick(o, d);
        const e = performance.now() - t;
        rays++;
        rayMs += e;
        frame += e;
        return x;
      };
      const gaps = [];
      let last = performance.now();
      const end = last + 8000;
      await new Promise((ok) => {
        const tick = () => {
          const t = performance.now();
          gaps.push(t - last);
          last = t;
          frameMax = Math.max(frameMax, frame);
          frame = 0;
          if (t < end) requestAnimationFrame(tick);
          else ok();
        };
        requestAnimationFrame(tick);
      });
      world.pickStage = pick;
      gaps.sort((a, b) => a - b);
      return {
        rays,
        rayMs: +rayMs.toFixed(1),
        perRay: +(rayMs / Math.max(rays, 1)).toFixed(3),
        frameMax: +frameMax.toFixed(2),
        gap50: +gaps[gaps.length >> 1].toFixed(1),
        gap95: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1),
        dabs: window.__crew.bots.map((b) => b.hider?.log.dabs.length ?? null)
      };
    });
    console.log(JSON.stringify(summary));
    await writeFile(`${out}/live.json`, JSON.stringify(summary, null, 2));
  } else throw new Error('mode は rays か live');
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
EOF
```

次に dev サーバーを 5196 番でバックグラウンドに立て（Bash の `run_in_background`）、`curl` で `200` を待ってから、
リポジトリの直下で今のコードを測る。

```bash
B="${TMPDIR:-/tmp}/chameleon-rays"; node "$B/chameleon-rays.mjs" "$PWD" rays "$B/before" && node "$B/chameleon-rays.mjs" "$PWD" live "$B/before"
```

出た 2 行の JSON を報告用に控える。計画を書いたときの値は次のとおりで、機械が違えば数は違ってよい（`live` は回ごとに 2 倍ほどぶれる）。

```text
{"gpu":"ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)","n":900,"hits":864,"mean":1.217,"max":4.9,"fullMean":1.066,"split":0,"same":900}
{"rays":235,"rayMs":541.5,"perRay":2.304,"frameMax":7.2,"gap50":16.7,"gap95":21,"dabs":[1052,1014]}
```

**Verify**

- どちらも最後の行が `wrote …/chameleon-rays/before`、`pageerror` の行が出ない
- `gpu` に `SwiftShader`・`llvmpipe`・`Software` のどれも入っていない（入っていたら GPU で描いていないので STOP）
- `rays` の行が `"n":900`、`"split":0`、`"same":900`、`hits` が 800 以上
- `live` の行の `rays` が 50 以上で、`dabs` の 2 つがどちらも 0 より大きい（2 人とも塗っている）
- `ls "${TMPDIR:-/tmp}/chameleon-rays/before"` に `picks.json`・`rays.json`・`live.json`

### Step 2: 升目に分ける当たりのテストを書く（先に失敗させる）

`src/lib/games/yappari-chameleon/mansion/merge.test.ts` の import を `import { mergeStatic, splitPick } from './merge';` に変え、
ファイルの最後に足す。

```ts
/** 8 つの箱を 20m ほどに散らして 1 つにまとめる */
function spread() {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1, 3, 3, 3), mat());
    o.position.set(i * 2.5, 0, (i % 3) * 3);
    o.rotation.y = i * 0.3;
    g.add(o);
  }
  mergeStatic(g, () => false);
  const [one] = meshes(g);
  return { g, one };
}

describe('splitPick', () => {
  it('三角形を升目ごとに 1 度ずつ分け、どの升目も属性と材質を元と共有し、自分の三角形の頂点だけを外接の箱に入れる', () => {
    const { one } = spread();
    const parts = splitPick(one);
    expect(parts.length).toBeGreaterThan(1);
    const tris = (a: ArrayLike<number>) => {
      const out: string[] = [];
      for (let i = 0; i < a.length; i += 3) out.push(`${a[i]},${a[i + 1]},${a[i + 2]}`);
      return out.sort();
    };
    expect(tris(parts.flatMap((p) => Array.from(p.geometry.index!.array)))).toEqual(tris(one.geometry.index!.array));
    const pos = one.geometry.getAttribute('position');
    const v = new THREE.Vector3();
    for (const p of parts) {
      expect(p.geometry.getAttribute('position')).toBe(pos);
      expect(p.material).toBe(one.material);
      const box = p.geometry.boundingBox!;
      for (const i of p.geometry.index!.array) expect(box.containsPoint(v.fromBufferAttribute(pos, i))).toBe(true);
      expect(p.geometry.boundingSphere).not.toBeNull();
    }
  });

  it('まとめた Mesh に当てると、三角形を全部調べたときと同じ所に当たり、置き直しても付いていく', () => {
    const { g, one } = spread();
    const ray = new THREE.Raycaster();
    let hits = 0;
    const check = () => {
      g.updateMatrixWorld(true);
      for (let x = -2; x < 20; x += 0.37)
        for (let z = -2; z < 9; z += 0.53) {
          ray.set(new THREE.Vector3(x, 5, z), new THREE.Vector3(0.1, -1, 0.05).normalize());
          const now = ray.intersectObject(g, true)[0];
          const full: THREE.Intersection[] = [];
          THREE.Mesh.prototype.raycast.call(one, ray, full);
          full.sort((a, b) => a.distance - b.distance);
          expect(now?.distance).toBe(full[0]?.distance);
          expect(now?.point).toEqual(full[0]?.point);
          expect(now?.uv).toEqual(full[0]?.uv);
          expect(now?.object).toBe(full[0] ? one : undefined);
          if (now) hits++;
        }
    };
    check();
    g.position.set(3, -1, 2);
    g.rotation.y = 0.4;
    check();
    expect(hits).toBeGreaterThan(200);
  });
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/mansion/merge.test.ts` → 足した 2 つが FAIL（`splitPick` が無い）、
もとからあるテストは pass。

### Step 3: `splitPick` を足し、まとめた Mesh の当たりを升目の Mesh で調べる

`src/lib/games/yappari-chameleon/mansion/merge.ts` を変える。

1. `const ATTRS = ['position', 'normal', 'uv'];`（`merge.ts:4`）のすぐ下に足す。

```ts
/** 当たりを分ける升目（m）。屋敷で 0.5〜2m を測って、線 1 本がいちばん速かった大きさ */
const PICK_CELL = 2;
```

2. `mergeStatic` の定義（`/**` で始まるコメントごと）のすぐ上に、関数を足す。

```ts
/**
 * まとめた Mesh の三角形を、重心のある升目ごとの見えない Mesh に分ける。位置・法線・UV と材質は元と共有する。
 * 外接の箱と球は升目の三角形の頂点だけから作る（computeBoundingBox と computeBoundingSphere は index を見ずに共有の頂点を全部囲み、何も飛ばせない）
 */
export function splitPick(one: THREE.Mesh, cell = PICK_CELL): THREE.Mesh[] {
  const g = one.geometry;
  const pos = g.getAttribute('position');
  const index = g.index!.array;
  const cells = new Map<string, number[]>();
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t], index[t + 1], index[t + 2]];
    const key = [
      Math.floor((pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3 / cell),
      Math.floor((pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3 / cell),
      Math.floor((pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3 / cell)
    ].join(',');
    const tris = cells.get(key);
    if (tris) tris.push(a, b, c);
    else cells.set(key, [a, b, c]);
  }
  const v = new THREE.Vector3();
  return [...cells.values()].map((tris) => {
    const part = new THREE.BufferGeometry();
    for (const name of ATTRS) part.setAttribute(name, g.getAttribute(name));
    part.setIndex(tris);
    part.boundingBox = new THREE.Box3();
    for (const i of tris) part.boundingBox.expandByPoint(v.fromBufferAttribute(pos, i));
    part.boundingSphere = part.boundingBox.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(part, one.material);
    // 元の Mesh の行列をそのまま持つので、動く物の中でまとめた Mesh を置き直しても、同じ所に当たる
    mesh.matrixWorld = one.matrixWorld;
    return mesh;
  });
}
```

3. `mergeStatic` の中、`root.add(one);` と `for (const p of parts) p.mesh.removeFromParent();` のあいだに足す（`parts` は
   すぐ外のループの変数なので、名前を `pieces` にする）。

```ts
// まとめた 1 つは屋敷じゅうに広がり、外接の球で線を飛ばせず、線 1 本ごとに全部の三角形を調べてしまう。
// 当たりは升目に分けた Mesh で調べ、当たった物は描いている元の Mesh として返す
const pieces = splitPick(one);
one.raycast = (ray, hits) => {
  const from = hits.length;
  for (const p of pieces) p.raycast(ray, hits);
  for (let i = from; i < hits.length; i++) hits[i].object = one;
};
```

`hits[i].faceIndex` は升目の中の番号になる（`pickStage` と `spoit` は使わない）。升目の Mesh は場面に入れないので、描く回数と
`build.test.ts` の Mesh の数（450 以下）は変わらない。GPU へ送らないので片付けも要らない。

**Verify**

- `pnpm exec vitest run src/lib/games/yappari-chameleon/mansion/merge.test.ts` → すべて pass
- `grep -c 'export function splitPick' src/lib/games/yappari-chameleon/mansion/merge.ts` → `1`
- `pnpm check` → `0 ERRORS 0 WARNINGS`

### Step 4: 組み立てた屋敷で、元の道と同じ面に当たることをテストで見る

`src/lib/games/yappari-chameleon/mansion/build.test.ts` の import の並びに足す（`import type { Built } from '../world3d';` の下）。

```ts
import { SPOTS, viewOf } from '../cpu/spots';
```

`describe('組み立てた屋敷', …)` の中、「まとめたあとの Mesh の数と…」のテストのあとに足す。

```ts
it('まとめた Mesh を升目に分けて当てても、隠れる CPU の線は三角形を全部調べたときと同じ面に当たる', () => {
  const split = meshes().filter((m) => Object.hasOwn(m, 'raycast'));
  expect(split.length).toBeGreaterThan(0);
  const ray = new THREE.Raycaster();
  const first = () => ray.intersectObject(built.group, true).find((h) => h.object instanceof THREE.Mesh);
  let hits = 0;
  for (const sp of SPOTS) {
    const body = new THREE.Vector3(sp.pos[0], sp.pos[1] + 0.6, sp.pos[2]);
    const eye = new THREE.Vector3(...viewOf(sp));
    for (const [o, d] of [
      [body, new THREE.Vector3(...sp.back)],
      [eye, body.clone().sub(eye).normalize()]
    ]) {
      ray.set(o, d);
      const now = first();
      const kept = split.map((m) => m.raycast);
      for (const m of split) delete (m as { raycast?: unknown }).raycast;
      const full = first();
      split.forEach((m, i) => (m.raycast = kept[i]));
      expect(now?.object).toBe(full?.object);
      expect(now?.distance).toBe(full?.distance);
      expect(now?.uv).toEqual(full?.uv);
      expect(now?.face?.normal).toEqual(full?.face?.normal);
      expect(now?.face?.materialIndex).toBe(full?.face?.materialIndex);
      if (now) hits++;
    }
  }
  expect(hits).toBeGreaterThan(SPOTS.length);
});
```

**Verify**

- `pnpm exec vitest run src/lib/games/yappari-chameleon/mansion/merge.test.ts src/lib/games/yappari-chameleon/mansion/build.test.ts` → すべて pass
- `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass
- `pnpm check` → `0 ERRORS 0 WARNINGS`
- 1 つめのコミットをする

```bash
git add src/lib/games/yappari-chameleon/mansion/merge.ts src/lib/games/yappari-chameleon/mansion/merge.test.ts src/lib/games/yappari-chameleon/mansion/build.test.ts
git commit -m "Raycast merged mansion meshes through cell-sized pick parts"
```

### Step 5: 測り直し、速さと答えを確かめる

dev サーバーが動いていることを `curl` で確かめ（止まっていたら立て直す）、測る。

```bash
B="${TMPDIR:-/tmp}/chameleon-rays"; node "$B/chameleon-rays.mjs" "$PWD" rays "$B/after" && node "$B/chameleon-rays.mjs" "$PWD" live "$B/after"
cmp "$B/before/picks.json" "$B/after/picks.json" && echo same
```

計画を書いたときの試作の値は次のとおり（`split` は屋敷とロビーの 113 だけを分けた試作の数で、この計画では動く物の中の Mesh も
分けるので多くなる）。

```text
{"gpu":"ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)","n":900,"hits":864,"mean":0.074,"max":0.66,"fullMean":1.426,"split":113,"same":900}
```

**Verify**

- `pageerror` の行が出ない
- `cmp` の行が `same`（Step 1 の答えと 1 本も違わない）
- `rays` の行が `"n":900`、`"same":900`、`split` が 0 より大きい
- `rays` の `mean` が Step 1 の `mean` の 25% 以下で、0.5 以下
- `rays` の `max` が Step 1 の `max` の 40% 以下
- `live` の `perRay` が Step 1 の `live` の `perRay` より小さい（ぶれが大きいので比べるのは大小だけ。小さくなければ 1 度だけ両方を測り直す）
- `live` の `dabs` の 2 つがどちらも 0 より大きい

`mean` が 25% か 0.5ms に届かないときは、`PICK_CELL` や分け方をいじらずに STOP し、Step 1 と Step 5 の JSON を `gpu` の文字列ごと
報告する（依存を足す案の判断はレビュー担当がする。Maintenance notes）。

### Step 6: 古い「1 本 4〜5ms」を直す

`src/lib/games/yappari-chameleon/cpu/hider.ts` の `RAYS_PER_STEP` の上のコメント（`hider.ts:15-18` の 4 行）を、次の 1 行に置き換える。
値（`export const RAYS_PER_STEP = 1;`）は変えない。

```ts
/** 面の色を聞くのは 1 コマにこれだけ。聞く升目は 1 人 100 ほどなので 1 本でも数秒で済み、塗り終わる速さは RATE のほうで決まる */
```

同じファイルの `// 同じ升目の点は背の面の同じあたりに写るので、色は升目ごとに 1 回だけ聞く（1 本 4〜5ms）` から `（1 本 4〜5ms）` を消す。

`src/lib/games/yappari-chameleon/cpu/hider.test.ts` のテストの名前
`'面の色は 1 コマに 1 本だけ聞き、コマが延びても増やさない（1 本 4〜5ms で、増やすとさらにコマが延びる）'` を
`'面の色は 1 コマに 1 本だけ聞き、コマが延びても増やさない'` にする（中身は変えない）。

`src/lib/games/yappari-chameleon/CLAUDE.md` を 2 か所変える（このファイルは 1 文 1 行）。

1. 「色は背の向きに直角な面の上の筆の直径の升目ごとに 1 回だけ聞き（1 本 4〜5ms なので 1 コマに 1 本で、」の `1 本 4〜5ms なので ` を消し、
   「（1 コマに 1 本で、体の表面を調べたコマでは聞かない）」にする。
2. 「動かない Mesh は `mansion/merge.ts` の `mergeStatic` が」で始まる行のすぐ下に、次の 1 行を足す。

```text
まとめた Mesh は屋敷じゅうに広がって外接の球で線を飛ばせないので、`mergeStatic` は三角形を 2m の升目ごとに分けた見えない Mesh（`splitPick`。位置・法線・UV・材質・`matrixWorld` を元と共有する）を作り、元の Mesh の `raycast` はそちらを調べる（3D スポイトと隠れる CPU の面の色が、線 1 本ごとに屋敷じゅうの三角形を調べない）。
```

**Verify**

- `grep -c '4〜5ms' src/lib/games/yappari-chameleon/cpu/hider.ts src/lib/games/yappari-chameleon/cpu/hider.test.ts src/lib/games/yappari-chameleon/CLAUDE.md` → 3 行とも `:0`
- `grep -c 'export const RAYS_PER_STEP = 1;' src/lib/games/yappari-chameleon/cpu/hider.ts` → `1`
- ``grep -c '`splitPick`。位置・法線・UV・材質' src/lib/games/yappari-chameleon/CLAUDE.md`` → `1`
- `~/.claude/textlint/node_modules/.bin/textlint --config ~/.claude/textlint/.textlintrc.json src/lib/games/yappari-chameleon/CLAUDE.md` の指摘が、
  変えた 2 行に無い（変えた行に出たら、意味を変えずにその行だけ直す。ほかの行の指摘は直さない）
- `pnpm exec prettier --check src/lib/games/yappari-chameleon/CLAUDE.md` → exit 0
- `pnpm exec vitest run src/lib/games/yappari-chameleon/cpu/hider.test.ts` → すべて pass
- 2 つめのコミットをする

```bash
git add src/lib/games/yappari-chameleon/cpu/hider.ts src/lib/games/yappari-chameleon/cpu/hider.test.ts src/lib/games/yappari-chameleon/CLAUDE.md
git commit -m "Drop the stale ray cost from the hiding CPU notes"
```

### Step 7: 全体の確かめと片付け

dev サーバーを止める。

```bash
lsof -ti :5196 | xargs kill
```

**Verify**

- `lsof -i :5196` → 何も出ない
- `pnpm verify` → exit 0
- `git status --short -- . ':!plans'` → 何も出ない（2 つのコミットに全部入っている）

## Test plan

- `merge.test.ts` に 2 つ。升目への分け方（三角形を 1 度ずつ、属性と材質を共有、外接の箱と球が自分の頂点を囲む）と、
  分けた当たりが三角形を全部調べたときと同じ所・同じ UV・同じ物を返し、親を動かしても付いていくこと
- `build.test.ts` に 1 つ。組み立てた屋敷で、隠れ場所の候補から引いた 2 種類の線が、元の道と同じ物・距離・UV・法線・材質の番号に当たる
- 計画を書いたときの試作では、`merge.test.ts` と同じ形の 2520 本と、実際の屋敷の 900 本が、どれも元の道と同じだった
- 速さと実際の答えは Step 1 と Step 5 の道具で見る（`cmp` で 900 本の答えが前と同じ、同じページの元の道とも同じ）

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/yappari-chameleon/` がすべて pass し、足した 3 つのテストがある
- [ ] Step 5 の `cmp` が `same`、`rays` の `same` が `900`
- [ ] Step 5 の `rays` の `mean` が Step 1 の 25% 以下かつ 0.5 以下、`max` が Step 1 の 40% 以下
- [ ] Step 5 の `live` の `perRay` が Step 1 より小さく、`dabs` が 2 つとも 0 より大きい
- [ ] `grep -c 'export const RAYS_PER_STEP = 1;' src/lib/games/yappari-chameleon/cpu/hider.ts` が `1`
- [ ] `git diff 982455c..HEAD --stat -- src/lib/games/yappari-chameleon/world3d.ts src/lib/games/yappari-chameleon/mansion/build.ts src/lib/games/yappari-chameleon/net.ts package.json pnpm-workspace.yaml` が何も出さない
- [ ] `pnpm verify` が exit 0
- [ ] `git log --format=%B -2` がこの計画の 2 つのコミットのメッセージで、どちらも trailer が無い
- [ ] `git diff --stat HEAD~2..HEAD` に出るのが In scope のファイルだけ
- [ ] 5196 番のサーバーを止めた
- [ ] 報告に Step 1 と Step 5 の測った JSON（4 行）を書いた
- [ ] `plans/README.md` の 080 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `merge.ts` の `mergeStatic` の最後（`root.add(one);` と `p.mesh.removeFromParent()`）、`world3d.ts:304-315` の `pickStage`、
  `hider.ts:13-19` が、上の抜粋と違う
- `grep -rn "mergeStatic(" src --include='*.ts' | grep -v test` の出力が、`merge.ts` の定義と `build.ts` の 116 行・144 行の 3 行でない
  （まとめた Mesh を描く以外の使い方が増えていると、当たりの差し替えが思わぬ所に効く）
- Step 2 を始める前に `grep -rn "intersectObject\|\.raycast" src/lib/games/yappari-chameleon --include='*.ts' | grep -v test` を実行し、`world3d.ts` の 273 行・307 行と
  `doll3d.ts:105` のコメントのほかの行が出る（`faceIndex` を使う当たりが増えていたら、升目の中の番号で壊れうる）
- 5196 番がふさがっている、または `chromium.launch({ channel: 'chrome' })` が Chrome を見つけられない（ほかの番号やブラウザを試さずに報告する）
- Step 1 の `gpu` がソフトウェアの描画（SwiftShader など）、または `split` が 0 でない（今のコードに自分の `raycast` を持つ物がある）
- Step 4 か Step 5 で、元の道と答えが 1 本でも違う。同じ距離の三角形の並びが変わったことが考えられる。升目の大きさや比べ方をゆるめて
  合わせない
- Step 5 の速さが Verify の比に届かない（`three-mesh-bvh` を足さない）
- `pnpm check` が `one.raycast = …` か `mesh.matrixWorld = …` の代入を型で拒む

## Maintenance notes

- 升目の当たりは、まとめた形の `position`・`normal`・`uv` の属性をそのまま共有する。まとめたあとで形の属性を差し替える・頂点を
  動かすコードを足したら、`splitPick` の外接の箱と球を作り直す
- 升目の Mesh は元の `matrixWorld` の `Matrix4` を共有する。three は描く前にこの中身を書き換えるので動く物にも付いていくが、
  元の Mesh の `matrixWorld` を別の `Matrix4` に差し替えるコードを足すと、升目が古い行列のまま残る
- 当たった物は元の Mesh として返すが、`faceIndex` は升目の中の番号。当たった三角形の番号で元の形を引くコードを足すときは、
  升目ごとの三角形の並び（`tris`）から元の番号へ戻す
- 屋敷を組み立てるときに升目へ分ける時間が足される（計画を書いたときの機械で 20ms ほど）。`pnpm spots`（`scripts/cpu-spots.ts`）も
  同じ `colorAt` を通るので速くなり、返す色は同じなので `cpu/spot-seen.ts` の測り直しは要らない
- `RAYS_PER_STEP` は 1 のまま。線が軽くなっても、塗り終わる速さは `RATE` で決まっている（計画を書いたときに、強い CPU 2 人の線は
  2 人で 1 秒に 30 本ほどで、上限の 1 人 1 秒 60 本に届かなかった）
- Step 5 で速さが届かなかったときの次の案は `three-mesh-bvh`（MIT、three 0.159 以上。計画を書いたときの最新は 0.9.16 で 2026-10-08 公開、
  `minimumReleaseAge` の 3 日を越えている）。足すときは `pnpm-workspace.yaml` の catalog と `package.json` の `dependencies`（`catalog:`）、
  `static/licenses.txt` と `src/routes/about/+page.svelte` の「つかわせて もらったもの」の両方への記載、カメレオンの chunk にだけ入ることの
  確かめが要る。別の計画で決める
- 探す CPU の目（`Senses3d.visible`）も重い。計画を書いたときに測ると、`World.look` 1 回（96 × 96 を描いて同期で読む）が約 3ms で、
  見る判定の 1 回は体ありと体なしの 2 回なので 1 コマ 6〜9ms、探索の初めの 1 回は 122ms だった（`Senses3d.warm()` を済ませたあとなので、
  ほかの人の体などの材質の shader が先に作れていない見込み）。`readRenderTargetPixelsAsync` で 1 コマ遅れて読む案と、`warm()` で
  ほかの人の体も描く案は、測ってから別の計画にする
- レビューでは、Step 1 と Step 5 の JSON と `cmp` の `same` を PR の説明に貼ってもらう。実機（iPad）では、CPU 2 人が隠れる隠れタイムの
  初めの数秒にコマ落ちが減ったこと、3D スポイトが前と同じ色を取ることを見る
