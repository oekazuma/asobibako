# Plan 071: カメレオンの塗りを、吹き付けの届く三角形だけ描き、すき間の広げ直しを表引きにして軽くする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat ea56ff6..HEAD -- src/lib/games/yappari-chameleon/paint-gpu.ts src/lib/games/yappari-chameleon/paint-gpu.test.ts src/lib/games/yappari-chameleon/atlas.ts src/lib/games/yappari-chameleon/atlas.test.ts src/lib/games/yappari-chameleon/doll3d.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。
> `src/lib/games/yappari-chameleon/CLAUDE.md` は毎日変わるので diff では見ない。代わりに
> ``grep -c '吹き付けを描くシェーダー（`paint-gpu.ts` の `PaintSurface`。' src/lib/games/yappari-chameleon/CLAUDE.md`` が `1` であることを確かめる。

## Status

| 項目       | 値                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| Priority   | P3                                                                                                        |
| Effort     | M                                                                                                         |
| Risk       | LOW（シェーダーを 2 つ変える。描いた塗りの画素が変わらないことを、前後の画素の全部を `cmp` で比べて見る） |
| Depends on | none                                                                                                      |
| Category   | perf                                                                                                      |
| Planned at | commit `ea56ff6`, 2026-10-14                                                                              |

## Why this matters

やっぱりカメレオン（iPad をつないで遊ぶ 3D のかくれんぼ）では、人形の塗りを GPU の描き先（色 2048²・艶 1024²）に持つ。
吹き付け 16 個ごとに体の三角形を全部描き、どの画素も 16 個ぶんの距離を測る。描くたびに `flush()` がすき間の画素ごとに
まわり 81 画素を読んで色を広げ直す。

計画を書いたときに headless Chrome（Apple M4、ANGLE Metal）で測った値は次の表のとおり。

| 測ったもの                                   | 時間      |
| -------------------------------------------- | --------- |
| 塗っているあいだの 1 コマ（16 個と広げ直し） | 11〜17ms  |
| そのうち広げ直しだけ                         | 8.6〜13ms |
| 1000 個の塗り直し（`rebuild`）               | 約 131ms  |
| 3000 個の塗り直し                            | 約 375ms  |

塗っている体ごとに 1 コマ 10ms 以上かかるので、隠れタイムに CPU が 2 人塗ると、それだけで 60 コマを保てない。もどす・
取り消し・答え合わせで体を置く（`#pin`）・ほかの人のもどすを受けるたびに、数百 ms 止まる。

試作では、吹き付けの届かない三角形を頂点シェーダーで飛ばし、すき間ごとの「いちばん近い塗りの画素へのずれ」を
1 度だけ表にして広げ直しを表引きにした。描いた画素は前とすべて同じで、1 コマは約 2.5ms、3000 個の塗り直しは約 40ms に
なった。この計画はこの 2 つを入れ、前後を同じ道具で測って確かめる。

## Current state

### 触るファイル

- `src/lib/games/yappari-chameleon/paint-gpu.ts` — 塗りの面 `PaintSurface`。吹き付けを描き、`flush()` ですき間へ色を広げ直す
- `src/lib/games/yappari-chameleon/paint-gpu.test.ts` — 何もしない描画器で、どの描き先へ描いたかを見るテスト（あり）
- `src/lib/games/yappari-chameleon/atlas.ts` — 三角形を升に並べる `layAtlas`（node で動く純粋な関数）
- `src/lib/games/yappari-chameleon/atlas.test.ts` — `layAtlas` のテスト（あり）
- `src/lib/games/yappari-chameleon/doll3d.ts` — `makeDoll` が塗りの面の形（`paintGeo`）を作る
- `src/lib/games/yappari-chameleon/CLAUDE.md` — ゲームの仕様。1 文を足す

### 吹き付けの描き方（`paint-gpu.ts`）

`paint-gpu.ts:8` が `const BATCH = 16;`。頂点シェーダーは `paint-gpu.ts:10-21` にあり、吹き付けの面と白で覆う面（`cover`）の両方が使う。

```ts
const VERTEX = `
precision highp float;
in vec2 position;
in vec3 ppos;
in vec3 pnrm;
out vec3 vPos;
out vec3 vNrm;
void main() {
  vPos = ppos;
  vNrm = pnrm;
  gl_Position = vec4(position * 2.0 - 1.0, 0.0, 1.0);
}`;
```

フラグメントシェーダーは `paint-gpu.ts:24-47` にある。吹き付けごとの濃さ `k` は、`smoothstep(r * 0.35, r, d)` が `d ≥ r` で 1 になるので、
画素の位置 `vPos` が吹き付けの中心から半径 `r` 以上離れていれば 0 になる。全部の `k` が 0 なら出力は `vec4(0.0)` で、
混ぜ方（`ONE, ONE_MINUS_SRC_ALPHA`、`paint-gpu.ts:169-171`）では描き先がそのまま残る。

```ts
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
```

吹き付けの面の材質は `paint-gpu.ts:159-173`（`vertexShader: VERTEX` と `fragmentShader: FRAGMENT`）、白で覆う面は
`paint-gpu.ts:197-211`（`vertexShader: VERTEX` と `fragmentShader: FILL_FRAGMENT`）。`apply()`（`paint-gpu.ts:255-270`）は 16 個ずつ
色（`this.color`）と艶（`this.gloss`）へ吹き付けの面を全部描く。`rebuild()`（`paint-gpu.ts:272-275`）は `reset()` のあと全部を `apply()` する。

### すき間の広げ直し（`paint-gpu.ts`）

`paint-gpu.ts:60-91` の `DILATE_FRAGMENT` は、すき間（alpha 0.5 以下）の画素ごとに `DILATE`（4）画素四方の 81 画素を読み、
いちばん近い塗りの画素（同じ距離なら `dy`、`dx` の順に先に見つかったもの）の色を alpha 0 で書く。近くに無ければ自分の色のまま。

```ts
const DILATE = 4;
const DILATE_FRAGMENT = `
precision highp float;
precision highp sampler2D;
uniform sampler2D uSrc;
out vec4 outColor;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 here = texelFetch(uSrc, p, 0);
  if (here.a > 0.5) {
    outColor = here;
    return;
  }
  ivec2 lim = textureSize(uSrc, 0) - 1;
  float best = 1e9;
  vec4 pick = here;
  for (int dy = -${DILATE}; dy <= ${DILATE}; dy++) {
    for (int dx = -${DILATE}; dx <= ${DILATE}; dx++) {
      ivec2 q = p + ivec2(dx, dy);
      if (q.x < 0 || q.y < 0 || q.x > lim.x || q.y > lim.y) continue;
      vec4 c = texelFetch(uSrc, q, 0);
      float d = float(dx * dx + dy * dy);
      if (c.a > 0.5 && d < best) {
        best = d;
        pick = c;
      }
    }
  }
  outColor = vec4(pick.rgb, 0.0);
}`;
```

どの画素が塗り（alpha 1）でどれがすき間（alpha 0）かは、`reset()`（`paint-gpu.ts:227-237`）が白で覆う面を描いたときに決まり、
そのあと変わらない。吹き付けの面は覆う面と同じ形なので塗りの画素にしか描かず、混ぜても alpha は 1 のまま。広げ直しは
すき間に alpha 0 を書く。だから「すき間ごとのいちばん近い塗りの画素へのずれ」は形だけで決まり、塗るたびに探し直す必要がない。

作業用の描き先は描画器ごとに 1 組で、`scratchFor`（`paint-gpu.ts:109-128`）が返す。

```ts
const scratches = new WeakMap<
  THREE.WebGLRenderer,
  { color: THREE.WebGLRenderTarget; gloss: THREE.WebGLRenderTarget }
>();

export function scratchFor(renderer: THREE.WebGLRenderer) {
  let s = scratches.get(renderer);
  if (!s) {
    s = {
      color: target(COLOR_SIZE, THREE.SRGBColorSpace),
      gloss: target(GLOSS_SIZE, THREE.NoColorSpace)
    };
    scratches.set(renderer, s);
  }
  return s;
}
```

`flush()` は `paint-gpu.ts:239-253` にある。

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

画面いっぱいの三角形を描く場面は `paint-gpu.ts:194-196` で作る（`full(this.#dilate, raw(DILATE_FRAGMENT, { uSrc: this.#src }));` など）。
`raw()` は `blending: THREE.NoBlending` の材質なので、描き先の全部の画素を上書きする。

### 升の並び（`atlas.ts`）と、塗りの面の形（`doll3d.ts`）

`atlas.ts:5-11` の `Atlas` は `corner`・`uv`・`paintUv`・`paintPos`・`cell` を持つ。`paintPos` は吹き付けの三角形（升の中で少し広げた形）の
角ごとの 3D の位置で、三角形 `t` の角 `k` の成分 `j` は `paintPos[(t * 3 + k) * 3 + j]`（`atlas.ts:55` と `atlas.ts:61`）。

`doll3d.ts:45-50` が塗りの面の形を作る。三角形は角を共有しない（`doll3d.ts:21` のコメント）ので、角ごとに同じ値を持たせれば、
頂点シェーダーが三角形まるごとを飛ばせる。

```ts
const paintGeo = new THREE.BufferGeometry();
// three は position の数から描く数を決めるので、UV の位置を position に入れる
paintGeo.setAttribute('position', new THREE.BufferAttribute(a.paintUv, 2));
paintGeo.setAttribute('ppos', new THREE.BufferAttribute(a.paintPos, 3));
paintGeo.setAttribute('pnrm', new THREE.BufferAttribute(nrm, 3));
const paint = new PaintSurface(renderer, paintGeo);
```

升の並びはアプリに 1 つだけで、`stage3d.ts:44` の `const atlas = layAtlas(s.pos, s.idx, COLOR_SIZE);` を、`stage3d.ts:48` と `stage3d.ts:59` の
`makeDoll` がどの体にも渡す。だから同じ描画器の面は、どれも同じ塗りとすき間の並びを持つ。

### 塗り直し（`rebuild`）を呼ぶ所

- `play.svelte.ts:269`（もどす）・`play.svelte.ts:285`（`rebuildPaint`。取り消し・白に戻す・コンテキストが戻ったとき）
- `remote.ts:59`（ほかの人のもどす・取り消しを受けた）・`remote.ts:65`（白に戻す）
- `session.svelte.ts:355`（答え合わせとダブルで体を置く `#pin`）・`session.svelte.ts:670-674`（`restore()`。全員の面を塗り直す）
- `Chameleon.svelte:29`（ひとりで試すの `restore: () => play?.rebuildPaint()`）

WebGL のコンテキストが失われて戻ると、`world3d.ts:104-108` の `webglcontextrestored` から `onRestore()` が呼ばれ、上の `restore` の道で
全部の面が `rebuild` を通る。`rebuild` は必ず `reset()` を通るので、`reset()` で作り直すものはコンテキストが戻っても正しくなる。

### テストの描画器

GPU の無い node のテストは、何もしない描画器を差す（`paint-gpu.test.ts:6-14`）。シェーダーの計算は node では試せない。
node で見られるのは、`atlas.ts` の数の計算と、`PaintSurface` がどの描き先へ描いたかだけ。

```ts
function recorder() {
  const drawn: unknown[] = [];
  const renderer = new Proxy(
    {},
    { get: (_, key) => (key === 'setRenderTarget' ? (t: unknown) => drawn.push(t) : () => null) }
  ) as unknown as THREE.WebGLRenderer;
  return { renderer, drawn };
}
```

### 規約

- コメントは「コードから復元できない WHY」だけを日本語で書く。変更履歴やタスク番号は書かない
- テストの名前は日本語の文にする
- ブラウザの道具（`mcp__Claude_Browser__*` も Claude in Chrome も）は使わない。測るのは下の node のスクリプトで、端末の
  Google Chrome を headless で動かす（built-in browser は隠れていると `requestAnimationFrame` が止まるので向かない）

## Commands you will need

| Purpose                | Command                                                                                                                | Expected on success                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 測る用の dev サーバー  | `pnpm dev --port 5191 --strictPort`（バックグラウンドで動かす）                                                        | `Local: http://localhost:5191/asobibako` |
| サーバーが動いているか | `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5191/asobibako/`                                            | `200`                                    |
| 測る                   | `B="${TMPDIR:-/tmp}/paint-bench"; node "$B/paint-bench.mjs" "$PWD" "$B/<名前>"`（リポジトリの直下で）                  | JSON が 2 行と `wrote …`                 |
| サーバーを止める       | `lsof -ti :5191 \| xargs kill`                                                                                         | `lsof -i :5191` が何も出さない           |
| 塗りのテスト           | `pnpm exec vitest run src/lib/games/yappari-chameleon/paint-gpu.test.ts src/lib/games/yappari-chameleon/atlas.test.ts` | すべて pass                              |
| カメレオン全部         | `pnpm exec vitest run src/lib/games/yappari-chameleon/`                                                                | すべて pass                              |
| 型                     | `pnpm check`                                                                                                           | `0 ERRORS 0 WARNINGS`、exit 0            |
| 全部                   | `pnpm verify`                                                                                                          | exit 0                                   |

5173 番は使わない（利用者の dev サーバーとぶつかる）。5191 番がふさがっていたら STOP。

## Scope

**In scope**

- `src/lib/games/yappari-chameleon/atlas.ts`（三角形ごとの球 `paintBound` を足す）
- `src/lib/games/yappari-chameleon/atlas.test.ts`（テストを 1 つ足す）
- `src/lib/games/yappari-chameleon/doll3d.ts`（`pbound` の属性を 1 行足す）
- `src/lib/games/yappari-chameleon/paint-gpu.ts`（吹き付けの頂点シェーダーで飛ばす。近さの表を作って広げ直しで引く）
- `src/lib/games/yappari-chameleon/paint-gpu.test.ts`（テストを 2 つ足し、1 つを少し広げる）
- `src/lib/games/yappari-chameleon/CLAUDE.md`（1 文を足す）
- `plans/README.md`（自分の行の Status だけ）

測るスクリプト（`${TMPDIR:-/tmp}/paint-bench/paint-bench.mjs`）と測った結果はリポジトリの外に置き、コミットしない。

**Out of scope**

- 塗り直しの途中の状態を控えて、もどすときにそこから塗る仕組み（チェックポイント）。Step 5 の判定で要ると出たら作らずに STOP する
- `BATCH`（16）・`COLOR_SIZE`・`GLOSS_SIZE`・`DILATE`・`atlas.ts` の `GAP` と `GROW` の値。見た目か手ざわりが変わる
- `FRAGMENT` の計算そのもの（`precision highp int;` の 1 行を足すほかは変えない）、`FILL_FRAGMENT`・`COPY_FRAGMENT`・`VERTEX`
- `play.svelte.ts`・`remote.ts`・`session.svelte.ts`・`world3d.ts`・`stage3d.ts`。呼び方は変えない
- `CHAMELEON_VERSION`（`net.ts`）。知らせの形も当たりも変わらない
- `scripts/` への測る道具の追加

## Git workflow

- ブランチは `advisor/071-chameleon-paint-cost`
- コミットは 2 つ。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない
  - Step 3 のあと `Skip paint triangles that no dab in the batch can reach`
  - Step 4 と Step 6 のあと `Fill paint gutters from a shared nearest-texel map`
- push しない（`main` への push は本番に自動デプロイされる）

## Steps

### Step 1: 測る道具を置き、今の値と今の塗りの画素を控える

ブランチを切る。

```bash
git switch -c advisor/071-chameleon-paint-cost
```

測るスクリプトを、リポジトリの外の `${TMPDIR:-/tmp}/paint-bench/paint-bench.mjs` に作る。次のコマンドをそのまま 1 回で実行する
（区切りの `'EOF'` を引用符で囲んでいるので、中の `${…}` はシェルに展開されない）。スクリプトはひとりで試すを開き、`window.__chameleon`
（dev のときだけ出る `Play`）の体の面を直接呼んで、1 画素を読む `paint.read()` で GPU の仕事が終わるのを待ちながら時間を測る。
最後に、決まった吹き付けの列で塗った色と艶の全画素を書き出し、WebGL のコンテキストを一度失わせて戻したあとの画素とも比べる
（`restoreDiff` は違った画素の成分の数）。

```bash
B="${TMPDIR:-/tmp}/paint-bench"; mkdir -p "$B"; cat > "$B/paint-bench.mjs" <<'EOF'
// 使い方: node paint-bench.mjs <リポジトリの絶対パス> <書き出すフォルダ>
// dev サーバーが http://localhost:5191/asobibako で動いていること
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';

const [repo, out] = process.argv.slice(2);
const require = createRequire(`${repo}/package.json`);
const { chromium } = require('playwright-core');

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  page.on('pageerror', (e) => console.error(e.message));
  await page.goto('http://localhost:5191/asobibako/games/yappari-chameleon', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'ひとりで試す' }).click();
  await page.waitForFunction(() => 'world' in (window.__chameleon ?? {}));
  const times = await page.evaluate(() => {
    const play = window.__chameleon;
    const world = play.world;
    const paint = world.rig.paint;
    const gl = world.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const g = world.rig.mesh.geometry;
    const pos = g.attributes.position;
    const nrm = g.attributes.normal;
    // 隠れる CPU と同じく、体の表面の点を筆の大きさの升目で間引き、頂点の並びの順に吹く
    const dabsOf = (r, count) => {
      const seen = new Set();
      const one = [];
      for (let i = 0; i < pos.count; i += 3) {
        const p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
        const k = p.map((v) => Math.floor(v / (r * 0.8))).join(',');
        if (seen.has(k)) continue;
        seen.add(k);
        const j = one.length;
        one.push({
          p,
          n: [nrm.getX(i), nrm.getY(i), nrm.getZ(i)],
          r,
          c: [((j * 37) % 256) / 255, ((j * 91) % 256) / 255, ((j * 53) % 256) / 255],
          a: 0.95,
          m: (j % 5) / 4,
          ro: ((j * 7) % 11) / 10
        });
      }
      const list = [];
      while (list.length < count) list.push(...one.slice(0, count - list.length));
      return list;
    };
    // 1 画素を読むと GPU の仕事が終わるまで待つので、前後で読んで GPU の時間まで測る
    const sync = () => paint.read({ x: 0, y: 0 });
    const time = (f) => {
      sync();
      const t0 = performance.now();
      f();
      sync();
      return performance.now() - t0;
    };
    const median = (f, n) => {
      const a = Array.from({ length: n }, f).sort((x, y) => x - y);
      return Math.round(a[n >> 1] * 10) / 10;
    };
    const d16 = dabsOf(0.035, 16);
    const d1000 = dabsOf(0.035, 1000);
    const d3000 = dabsOf(0.035, 3000);
    const human = dabsOf(0.05, 3000);
    const big = dabsOf(0.12, 3000);
    const result = {
      gpu,
      batch16: median(() => time(() => (paint.apply(d16), paint.flush())), 9),
      flushOnly: median(() => time(() => (paint.apply([]), paint.flush())), 9),
      rebuild1000: median(() => time(() => (paint.rebuild(d1000), paint.flush())), 5),
      rebuild3000: median(() => time(() => (paint.rebuild(d3000), paint.flush())), 5),
      rebuild3000human: median(() => time(() => (paint.rebuild(human), paint.flush())), 5),
      rebuild3000big: median(() => time(() => (paint.rebuild(big), paint.flush())), 3)
    };
    // 見た目の比べ用。列に入れて Play から塗り直すので、コンテキストが戻ったときも同じ列から作り直される
    play.log.clear();
    play.log.add([...dabsOf(0.12, 300), ...d3000]);
    play.rebuildPaint();
    paint.flush();
    return result;
  });
  console.log(JSON.stringify(times));
  const dump = () =>
    page.evaluate(() => {
      const world = window.__chameleon.world;
      const paint = world.rig.paint;
      paint.flush();
      const read = (t) => {
        const size = t.width;
        const buf = new Uint8Array(size * size * 4);
        world.renderer.readRenderTargetPixels(t, 0, 0, size, size, buf);
        let s = '';
        for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        return btoa(s);
      };
      return { color: read(paint.color), gloss: read(paint.gloss) };
    });
  const first = await dump();
  // WebGL のコンテキストを一度失わせて戻し、列から作り直した塗りが同じになるかを見る
  await page.evaluate(async () => {
    const renderer = window.__chameleon.world.renderer;
    const back = new Promise((ok) => renderer.domElement.addEventListener('webglcontextrestored', ok, { once: true }));
    renderer.forceContextLoss();
    await new Promise((ok) => setTimeout(ok, 200));
    renderer.forceContextRestore();
    await back;
    for (let i = 0; i < 3; i++) await new Promise((ok) => requestAnimationFrame(ok));
  });
  const second = await dump();
  const diff = (a, b) => {
    const x = Buffer.from(a, 'base64');
    const y = Buffer.from(b, 'base64');
    let n = 0;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) n++;
    return n;
  };
  console.log(JSON.stringify({ restoreDiff: diff(first.color, second.color) + diff(first.gloss, second.gloss) }));
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/color.bin`, Buffer.from(first.color, 'base64'));
  await writeFile(`${out}/gloss.bin`, Buffer.from(first.gloss, 'base64'));
  await writeFile(`${out}/times.json`, JSON.stringify(times, null, 2));
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
EOF
```

次に dev サーバーを 5191 番でバックグラウンドに立て（Bash の `run_in_background`）、`curl` で `200` を待ってから、
リポジトリの直下で今のコードを測る。

```bash
B="${TMPDIR:-/tmp}/paint-bench"; node "$B/paint-bench.mjs" "$PWD" "$B/before"
```

1 行目の JSON の数（ms）を報告用に控える。計画を書いたときの値は次のとおりで、機械が違えば数は違ってよい。

```text
{"gpu":"ANGLE (Apple, ANGLE Metal Renderer: Apple M4, Unspecified Version)","batch16":11,"flushOnly":8.7,"rebuild1000":132.1,"rebuild3000":379.3,"rebuild3000human":378.4,"rebuild3000big":383.3}
{"restoreDiff":0}
```

**Verify**

- 最後の行が `wrote …/paint-bench/before`
- `gpu` に `SwiftShader`・`llvmpipe`・`Software` のどれも入っていない（入っていたら GPU で描いていないので STOP）
- 2 行目が `{"restoreDiff":0}`
- `rebuild3000` が `rebuild1000` の 2 倍以上（塗り直しが吹き付けの数に比例して重い。そうでなければこの計画の前提が違うので STOP）
- `ls "${TMPDIR:-/tmp}/paint-bench/before"` に `color.bin`・`gloss.bin`・`times.json`

### Step 2: 三角形ごとに、角を全部含む球を升の並びに持たせる（テストから）

`src/lib/games/yappari-chameleon/atlas.test.ts` の `describe('layAtlas', …)` の中、「吹き付けの角の 3D の位置は…」のテストのあとに足す。

```ts
it('吹き付けの三角形の 3 つの角は同じ球を持ち、どの角もその球の中にある', () => {
  for (let t = 0; t < tris; t++) {
    const b = Array.from(a.paintBound.subarray(t * 12, t * 12 + 4));
    expect(b[3]).toBeGreaterThan(0);
    for (let k = 0; k < 3; k++) {
      const at = t * 3 + k;
      expect(Array.from(a.paintBound.subarray(at * 4, at * 4 + 4))).toEqual(b);
      const p = a.paintPos.subarray(at * 3, at * 3 + 3);
      expect(Math.hypot(p[0] - b[0], p[1] - b[1], p[2] - b[2])).toBeLessThanOrEqual(b[3]);
    }
  }
});
```

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/atlas.test.ts` → 足したテストだけ FAIL（`a.paintBound` が無い）。

次に `src/lib/games/yappari-chameleon/atlas.ts` を変える。

1. `export const GROW = 1.5;` の下に足す。

```ts
/** 三角形を囲む球の半径に足す余白（m）。float の丸めで角が球のふちからはみ出しても、届く吹き付けを飛ばさない */
const BOUND_PAD = 0.001;
```

2. `Atlas` に 1 つ足す。

```ts
/** 吹き付けの三角形ごとの、角を全部含む球（中心の xyz と半径）。頂点シェーダーが三角形ごと飛ばせるよう 3 つの角に同じ値を持つ */
paintBound: Float32Array;
```

3. `out` に `paintBound: new Float32Array(tris * 12),` を足す（`paintPos` の行の下）。
4. 三角形のループ（`for (let t = 0; t < tris; t++) {`）の中、角のループ（`for (let k = 0; k < 3; k++) { … }`）が閉じたすぐあとに足す。

```ts
const pp = (k: number, j: number) => out.paintPos[(t * 3 + k) * 3 + j];
const mid = [0, 1, 2].map((j) => (pp(0, j) + pp(1, j) + pp(2, j)) / 3);
let r = 0;
for (let k = 0; k < 3; k++) r = Math.max(r, Math.hypot(pp(k, 0) - mid[0], pp(k, 1) - mid[1], pp(k, 2) - mid[2]));
for (let k = 0; k < 3; k++) out.paintBound.set([mid[0], mid[1], mid[2], r + BOUND_PAD], (t * 3 + k) * 4);
```

三角形のループにはすでに `const c = t >> 1;`（升の番号）が、角のループには `const at = t * 3 + k;` があるので、名前が重ならないよう `pp` と `mid` を使う。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/atlas.test.ts` → すべて pass。

### Step 3: 吹き付けの頂点シェーダーで、届かない三角形を描かずに飛ばす

`src/lib/games/yappari-chameleon/doll3d.ts` の `paintGeo.setAttribute('pnrm', …);` の行の下に 1 行足す。

```ts
paintGeo.setAttribute('pbound', new THREE.BufferAttribute(a.paintBound, 4));
```

`src/lib/games/yappari-chameleon/paint-gpu.ts` を変える。

1. `VERTEX` の定義のすぐ下に、吹き付けの面だけが使う頂点シェーダーを足す。`VERTEX` は白で覆う面がそのまま使う。

```ts
// 三角形の 3 つの角は同じ球（pbound）を持つので、どの吹き付けも届かない三角形は 3 つの角とも画面の外へ出て、まるごと描かれない。
// 球の中の点はどれも吹き付けの中心から半径以上離れ、FRAGMENT の k は 0 になるので、飛ばしても描き先の画素は変わらない
const PAINT_VERTEX = `
precision highp float;
precision highp int;
uniform int uCount;
uniform vec4 uP[${BATCH}];
in vec2 position;
in vec3 ppos;
in vec3 pnrm;
in vec4 pbound;
out vec3 vPos;
out vec3 vNrm;
void main() {
  vPos = ppos;
  vNrm = pnrm;
  bool near = false;
  for (int i = 0; i < ${BATCH}; i++) {
    if (i >= uCount) break;
    if (distance(pbound.xyz, uP[i].xyz) < pbound.w + uP[i].w) {
      near = true;
      break;
    }
  }
  gl_Position = near ? vec4(position * 2.0 - 1.0, 0.0, 1.0) : vec4(2.0, 2.0, 2.0, 1.0);
}`;
```

2. `FRAGMENT` の `precision highp float;` の次の行に `precision highp int;` を足す（`uCount` を頂点シェーダーと共有するので、
   精度をそろえないと WebGL がシェーダーをつなげない）。コメントは足さない（上の `PAINT_VERTEX` のコメントで足りる）。
3. 吹き付けの面の材質（`new THREE.RawShaderMaterial({ … vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms: this.#u, …`）の
   `vertexShader: VERTEX` を `vertexShader: PAINT_VERTEX` に変える。白で覆う面（`fragmentShader: FILL_FRAGMENT` のほう）は `VERTEX` のまま。

**Verify**

- `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass
- `grep -c 'vertexShader: PAINT_VERTEX' src/lib/games/yappari-chameleon/paint-gpu.ts` → `1`、`grep -c 'vertexShader: VERTEX' src/lib/games/yappari-chameleon/paint-gpu.ts` → `1`
- dev サーバーが動いていることを `curl` で確かめ（止まっていたら立て直す）、測る。

```bash
B="${TMPDIR:-/tmp}/paint-bench"; node "$B/paint-bench.mjs" "$PWD" "$B/after-cull"
cmp "$B/before/color.bin" "$B/after-cull/color.bin" && cmp "$B/before/gloss.bin" "$B/after-cull/gloss.bin" && echo same
```

- 測った出力にシェーダーのエラー（`THREE.WebGLProgram: Shader Error` など）が出ない
- `cmp` の行が `same`（1 画素でも違えば STOP。届く吹き付けを飛ばしている）
- `{"restoreDiff":0}`
- `rebuild3000` が Step 1 の値の 25% 以下（計画を書いたときは 379 → 約 40）、`rebuild3000human` も 25% 以下

ここで 1 つめのコミットをする。

```bash
git add src/lib/games/yappari-chameleon/atlas.ts src/lib/games/yappari-chameleon/atlas.test.ts src/lib/games/yappari-chameleon/doll3d.ts src/lib/games/yappari-chameleon/paint-gpu.ts
git commit -m "Skip paint triangles that no dab in the batch can reach"
```

### Step 4: すき間ごとのいちばん近い塗りの画素を表にし、広げ直しは表を引く（テストから）

`src/lib/games/yappari-chameleon/paint-gpu.test.ts` の最後に足す。

```ts
describe('PaintSurface のすき間の近さの表', () => {
  it('塗りを白に戻すたびに、描画器で共有する近さの表を作り直す', () => {
    const { renderer, drawn } = recorder();
    const a = new PaintSurface(renderer, new THREE.BufferGeometry());
    const s = scratchFor(renderer);
    drawn.length = 0;
    a.rebuild([]);
    expect(drawn).toContain(s.nearColor);
    expect(drawn).toContain(s.nearGloss);
  });

  it('すき間へ広げ直すときは近さの表を読むだけで、描き直さない', () => {
    const { renderer, drawn } = recorder();
    const a = new PaintSurface(renderer, new THREE.BufferGeometry());
    const s = scratchFor(renderer);
    drawn.length = 0;
    a.apply([]);
    a.flush();
    expect(drawn).toContain(s.color);
    expect(drawn).not.toContain(s.nearColor);
    expect(drawn).not.toContain(s.nearGloss);
  });
});
```

あわせて、今ある「面を捨てても、ほかの面が使う共有の作業用の描き先は捨てない」のテストで、`scratch.color` と `scratch.gloss` と同じように
`scratch.nearColor` と `scratch.nearGloss` の `dispose` も `vi.spyOn` で見て、`not.toHaveBeenCalled()` を確かめる 2 つずつの行を足す。

**Verify**: `pnpm exec vitest run src/lib/games/yappari-chameleon/paint-gpu.test.ts` → 「塗りを白に戻すたびに…」が FAIL（`nearColor` が無い）。

次に `src/lib/games/yappari-chameleon/paint-gpu.ts` を変える。

1. `DILATE_FRAGMENT` を次の 2 つに置き換える。`DILATE_FRAGMENT` の上の 2 行のコメントと `const DILATE = 4;` は残す。
   `NEAR_FRAGMENT` は今の `DILATE_FRAGMENT` と同じ順に同じ条件で探し、色の代わりにずれを書く（近くに無ければ 0）。

```ts
// すき間の画素ごとの、いちばん近い塗りの画素へのずれを RG に dx と dy に DILATE + 1 を足して書く（0 は近くに塗りが無い）。
// 塗りとすき間の並びは升の形だけで決まるので、塗るたびに 81 画素を探さず、塗りを白に戻すときに 1 度だけ作る
const NEAR_FRAGMENT = `
precision highp float;
precision highp sampler2D;
uniform sampler2D uSrc;
out vec4 outColor;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  if (texelFetch(uSrc, p, 0).a > 0.5) {
    outColor = vec4(0.0);
    return;
  }
  ivec2 lim = textureSize(uSrc, 0) - 1;
  float best = 1e9;
  vec2 pick = vec2(0.0);
  for (int dy = -${DILATE}; dy <= ${DILATE}; dy++) {
    for (int dx = -${DILATE}; dx <= ${DILATE}; dx++) {
      ivec2 q = p + ivec2(dx, dy);
      if (q.x < 0 || q.y < 0 || q.x > lim.x || q.y > lim.y) continue;
      float d = float(dx * dx + dy * dy);
      if (texelFetch(uSrc, q, 0).a > 0.5 && d < best) {
        best = d;
        pick = vec2(dx + ${DILATE + 1}, dy + ${DILATE + 1});
      }
    }
  }
  outColor = vec4(pick / 255.0, 0.0, 0.0);
}`;

const DILATE_FRAGMENT = `
precision highp float;
precision highp sampler2D;
uniform sampler2D uSrc;
uniform sampler2D uNear;
out vec4 outColor;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 here = texelFetch(uSrc, p, 0);
  if (here.a > 0.5) {
    outColor = here;
    return;
  }
  ivec2 o = ivec2(round(texelFetch(uNear, p, 0).rg * 255.0));
  outColor = vec4(o.x == 0 ? here.rgb : texelFetch(uSrc, p + o - ${DILATE + 1}, 0).rgb, 0.0);
}`;
```

2. `scratchFor` の 1 組に近さの表を 2 枚足す。`target` の定義の下に表の描き先を作る関数を足す（RG の 8 bit は WebGL2 で必ず描き先にできる形式）。

```ts
const nearTarget = (size: number) =>
  new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RGFormat,
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter
  });
```

`scratches` の型に `nearColor: THREE.WebGLRenderTarget; nearGloss: THREE.WebGLRenderTarget` を足し、`scratchFor` で作る 1 組に
`nearColor: nearTarget(COLOR_SIZE),` と `nearGloss: nearTarget(GLOSS_SIZE)` を足す。`scratches` の上のコメント（今は 2 行）の最後に、
次の 1 文を足す。

```text
近さの表も同じ描画器の面で 1 組を使う。升の並びはアプリに 1 つ（stage3d.ts の layAtlas）なので、どの面から作っても同じ表になる
```

3. `PaintSurface` に場面と uniform を 1 つずつ足す（`readonly #copy = new THREE.Scene();` の下と `readonly #src = …` の下）。

```ts
  readonly #near = new THREE.Scene();
```

```ts
  readonly #nearMap = { value: null as THREE.Texture | null };
```

4. コンストラクタの `full(this.#dilate, raw(DILATE_FRAGMENT, { uSrc: this.#src }));` を次の 2 行に変える。

```ts
full(this.#near, raw(NEAR_FRAGMENT, { uSrc: this.#src }));
full(this.#dilate, raw(DILATE_FRAGMENT, { uSrc: this.#src, uNear: this.#nearMap }));
```

5. `reset()` の最後（`this.#draw(this.gloss, this.#cover);` のあと）に足す。

```ts
// コンテキストが戻ったときの塗り直しもここを通るので、失われた表もここで作り直る
const s = scratchFor(this.#renderer);
for (const [from, near] of [
  [this.color, s.nearColor],
  [this.gloss, s.nearGloss]
] as const) {
  this.#src.value = from.texture;
  this.#draw(near, this.#near);
}
```

6. `flush()` のループを、近さの表を渡す形にする（描く順と描き先は今と同じ）。

```ts
for (const [to, tmp, near] of [
  [this.color, scratch.color, scratch.nearColor],
  [this.gloss, scratch.gloss, scratch.nearGloss]
] as const) {
  this.#src.value = to.texture;
  this.#nearMap.value = near.texture;
  this.#draw(tmp, this.#dilate);
  this.#src.value = tmp.texture;
  this.#draw(to, this.#copy);
}
```

7. `dispose()` の場面の並び `[this.#paint, this.#fill, this.#cover, this.#dilate, this.#copy]` に `this.#near` を足す。共有の表は捨てない
   （作業用の描き先と同じく、`World.dispose` が描画器ごと返す）。

**Verify**

- `pnpm exec vitest run src/lib/games/yappari-chameleon/` → すべて pass
- `grep -c 'NEAR_FRAGMENT' src/lib/games/yappari-chameleon/paint-gpu.ts` → `2`
- 測る。

```bash
B="${TMPDIR:-/tmp}/paint-bench"; node "$B/paint-bench.mjs" "$PWD" "$B/after"
cmp "$B/before/color.bin" "$B/after/color.bin" && cmp "$B/before/gloss.bin" "$B/after/gloss.bin" && echo same
```

- シェーダーのエラーが出ない
- `cmp` の行が `same`
- `{"restoreDiff":0}`（コンテキストを失って戻したあとも、作り直した表で同じ塗りになる）
- `flushOnly` が Step 1 の値の 40% 以下（計画を書いたときは 8.7 → 約 2）
- `batch16` が Step 1 の値の 40% 以下（11 → 約 2.5）
- `rebuild3000` が Step 1 の値の 20% 以下（379 → 約 41。表を作る約 8ms が `reset()` に移るぶん、Step 3 より少し増えてよい）

### Step 5: チェックポイントが要るかを決める

Step 4 の `after/times.json` を見る。

- `rebuild3000`（隠れる強い CPU と同じ小さい筆、3000 個）と `rebuild3000human`（人の筆の初めの大きさ 0.05、3000 個）が
  どちらも 100ms 以下なら、チェックポイントは作らない。次へ進む
- どちらかが 100ms を超えたら STOP し、Step 1・3・4 の JSON を `gpu` の文字列ごと報告する（遅い機械なのか、計画の直しが効いていないのかを
  レビュー担当が見分ける。チェックポイントは Maintenance notes の形で別の計画にする）

`rebuild3000big`（筆 0.12 で 3000 個）は判定に使わない。弱い CPU の筆は 0.12 だが、間引くと体の全部で約 190 個にしかならず、
3000 個の大きな筆の列は実際の試合では出ない。計画を書いたときの試作で約 150ms だった。値は報告に書く。

**Verify**: 報告用のメモに、Step 1・3・4 の 1 行目の JSON と「チェックポイントは作らない」がある。

### Step 6: ゲームの CLAUDE.md に 1 文を足す

`src/lib/games/yappari-chameleon/CLAUDE.md` で、「三角形を 2 つずつ升に並べた UV（`atlas.ts`。」で始まる行のすぐ下に、次の 1 行を足す
（このファイルは 1 文 1 行）。

```text
吹き付けの面は、16 個のどれも届かない三角形を頂点シェーダーで描かずに飛ばし（`atlas.ts` の `paintBound`。三角形を囲む球）、すき間へ広げ直す色は、すき間ごとのいちばん近い塗りの画素へのずれの表（描画器ごとに 1 組、`reset()` で作り直す）から引く。
```

**Verify**

- ``grep -c 'paintBound`。三角形を囲む球' src/lib/games/yappari-chameleon/CLAUDE.md`` → `1`
- `~/.claude/textlint/node_modules/.bin/textlint --config ~/.claude/textlint/.textlintrc.json src/lib/games/yappari-chameleon/CLAUDE.md` の指摘が、足した行に無い
  （足した行に出たら、意味を変えずにその行だけ直す。ほかの行の指摘は直さない）
- `pnpm exec prettier --check src/lib/games/yappari-chameleon/CLAUDE.md` → exit 0

2 つめのコミットをする。

```bash
git add src/lib/games/yappari-chameleon/paint-gpu.ts src/lib/games/yappari-chameleon/paint-gpu.test.ts src/lib/games/yappari-chameleon/CLAUDE.md
git commit -m "Fill paint gutters from a shared nearest-texel map"
```

### Step 7: 全体の確かめと片付け

dev サーバーを止める。

```bash
lsof -ti :5191 | xargs kill
```

**Verify**

- `lsof -i :5191` → 何も出ない
- `pnpm verify` → exit 0
- `git status --short -- . ':!plans'` → 何も出ない（2 つのコミットに全部入っている）

## Test plan

- `atlas.test.ts` に 1 つ。3 つの角が同じ球を持ち、どの角も球の中にある（頂点シェーダーが三角形まるごとを正しく飛ばす前提）
- `paint-gpu.test.ts` に 2 つと 1 つの拡張。塗りを白に戻すと共有の近さの表へ描く・広げ直しは表へ描かない・面を捨てても表は捨てない
- シェーダーの計算は node では試せないので、Step 1 の測る道具で前後の色と艶の全画素を `cmp` で比べる（1 画素も変わらない）。
  コンテキストを失って戻したあとの画素も同じであることを `restoreDiff` で見る
- 速さは同じ道具の前後の値の比で見る（Step 3・4 の Verify）

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/yappari-chameleon/` がすべて pass し、足した 3 つのテストがある
- [ ] Step 3 と Step 4 の `cmp` がどちらも `same`
- [ ] Step 4 の測った結果が `{"restoreDiff":0}`
- [ ] Step 4 の `flushOnly`・`batch16` が Step 1 の 40% 以下、`rebuild3000` が 20% 以下
- [ ] Step 4 の `rebuild3000` と `rebuild3000human` がどちらも 100 以下
- [ ] `grep -c 'vertexShader: PAINT_VERTEX' src/lib/games/yappari-chameleon/paint-gpu.ts` が `1`
- [ ] `pnpm verify` が exit 0
- [ ] `git log --format=%B -2` がこの計画の 2 つのコミットのメッセージで、どちらも trailer が無い
- [ ] `git diff --stat HEAD~2..HEAD` に出るのが In scope のファイルだけ
- [ ] 5191 番のサーバーを止めた
- [ ] 報告に Step 1・3・4 の測った JSON を書いた
- [ ] `plans/README.md` の 071 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `paint-gpu.ts` の `VERTEX`・`FRAGMENT`・`DILATE_FRAGMENT`・`flush()`・`reset()`・`scratchFor`、`atlas.ts` の `Atlas`・`paintPos` の並び、
  `doll3d.ts:45-50` が、上の抜粋と違う
- 5191 番がふさがっている、または `chromium.launch({ channel: 'chrome' })` が Chrome を見つけられない（ほかの番号やブラウザを試さずに報告する）
- Step 1 の `gpu` がソフトウェアの描画（SwiftShader など）、または `restoreDiff` が 0 でない（今のコードで道具が正しく測れていない）
- Step 3 か Step 4 の `cmp` が違うと言う。直そうとして余白（`BOUND_PAD`）を大きくしたり、比べ方をゆるめたりしない
- Step 3 か Step 4 の速さが Verify の比に届かない
- Step 5 で `rebuild3000` か `rebuild3000human` が 100ms を超えた
- `stage3d.ts` 以外で `layAtlas` か `makeDoll` を呼ぶ所が増えている。`grep -rn "layAtlas(\|makeDoll(" src scripts --include='*.ts' | grep -v test`
  の出力が、`atlas.ts` と `doll3d.ts` の定義の 2 行と `stage3d.ts` の 44・48・59 行の 3 行の、合わせて 5 行でない。升の並びが 2 つあると、
  共有の近さの表が別の面の並びになる
- `pnpm check` が `precision` や uniform の型で落ち、直すのに `FRAGMENT` の計算を変えたくなった

## Maintenance notes

- 近さの表は「同じ描画器の面はどれも同じ升の並び」に頼る。升の大きさや体型ごとの形を面ごとに変える日が来たら、表を面ごとに持つか、
  並びの配列を鍵にする
- `PAINT_VERTEX` の飛ばし方は、`FRAGMENT` の `k` が `d ≥ r` で 0 になることに頼る。吹き付けの形（`smoothstep` の外側の半径）を
  広げたら、頂点シェーダーの `uP[i].w` も同じだけ広げる
- `FRAGMENT` の中で `vPos` を球の外へずらす計算（法線で押し出すなど）を足したら、`atlas.ts` の `paintBound` の半径も合わせる
- 近さの表を作る 81 画素の探し（計画を書いたときの機械で約 8ms）は、塗るたびの `flush()` から `reset()` へ移った。面を作るとき・
  `rebuild([])` で白に戻すとき・答え合わせで体を置くときも、この時間がかかる。塗っているあいだの 1 コマからは消えるので全体では
  大きく軽くなるが、白に戻すのが 10ms ほどかかる理由はここにある
- 大きな筆で長く塗った人がもどすと、まだ 100ms を超えうる（計画を書いたときの試作で、筆 0.12 の 3000 個が約 150ms）。
  遊んで気になったら、次の形のチェックポイントを別の計画で入れる。描画器ごとに控えの描き先を 1 組だけ持ち（色と艶で約 20MB）、
  控えた面と列の長さを `{ surface, at }` で覚える。自分の体（`play.svelte.ts` の筆の始め）だけが控え、`rebuild(dabs)` は控えの持ち主が自分で、
  列が `at` より長く前の `at` 個が控えたときと同じ吹き付けのときだけ、控えを `#copy` で写してから残りを `apply` する。
  コンテキストが戻ったときは控えを捨てる。持ち主と `at` の帳尻は node で試せる
- レビューでは、Step 1・3・4 の JSON と `cmp` の `same` を PR の説明に貼ってもらう。実機（iPad）では、CPU 2 人と遊んで
  隠れタイムにコマ落ちが減ったこと、遠くから見た体の三角形のつなぎ目に白い点が出ないことを見る
