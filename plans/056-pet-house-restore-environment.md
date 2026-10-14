# Plan 056: わんにゃんハウスで WebGL が戻ったら、映り込みの環境の画像を作り直す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/pet-house/world3d.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------ |
| Priority   | P3                                                                                                                 |
| Effort     | S                                                                                                                  |
| Risk       | LOW（環境の画像の作り方を関数に出し、文脈が戻ったときにもう 1 度呼ぶだけ）                                         |
| Depends on | none                                                                                                               |
| Category   | bug（確からしさは MED。やっぱりカメレオンで iOS で見た症状からの推定で、わんにゃんハウスの実機ではまだ見ていない） |
| Planned at | commit `36cc037`, 2026-10-14                                                                                       |

## Why this matters

わんにゃんハウス（`pet-house`、開発を終えた 3D のペットのゲーム）は、three の `PMREMGenerator` で `RoomEnvironment` を焼いた
画像を `scene.environment` に入れ、ステンレスのお皿のつやと布の映り込みを出している。この画像は GPU の上でだけ作る
render target なので、iOS がアプリを裏に回して WebGL の文脈を失い、戻ってきたとき、three は形や絵の画像を CPU の元から
上げ直せても、環境の画像は空のまま戻る。同じ作りのやっぱりカメレオンは、この症状を見て `webglcontextrestored` で作り直すように
してある。わんにゃんハウスは作り直さないので、裏から戻ったあと、お皿が黒っぽく沈み、部屋の映り込みが消えたままになると見込まれる。
カメレオンと同じ形で、戻ったときに作り直す。

## Current state

直すファイルは 1 つ。

- `src/lib/games/pet-house/world3d.ts`（666 行）— 部屋と公園の 3D を描く `PetWorld`。ルールは持たず、`Session` が作って使う

環境の画像は constructor の中で作っている。`src/lib/games/pet-house/world3d.ts:160-179` にある（間の行は省いた）。

```ts
  constructor(canvas: HTMLCanvasElement) {
    const c = now();
    this.#day = daylight(c.hour, c.weather);
    this.#sunDir.set(...this.#day.sun.dir);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    // …
    this.scene.background = new THREE.Color('#bfe0fb');
    // 金属のお皿や布のつやに映り込む部屋の明るさ。強いと日なたと日かげの差が消えるので控えめにする
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    env.dispose();
    pmrem.dispose();
    this.scene.add(this.#hemi);
```

`environmentIntensity` は時間帯ごとに `src/lib/games/pet-house/world3d.ts:294-295` で書き直している。作り直すときに 0.35 へ戻さないこと。

```ts
// 映り込みの RoomEnvironment も部屋を照らすので、夜と明かりをつけた部屋では弱めて暗さを残す
this.scene.environmentIntensity = 0.35 * (1 - 0.45 * (out ? d.night : d.lamps));
```

片付けは `src/lib/games/pet-house/world3d.ts:620-632` の `dispose()`。最後に `forceContextLoss()` で文脈を手放す。

```ts
  dispose(): void {
    this.#built?.dispose();
    this.#sky.dispose();
    for (const view of this.#pets.values()) view.model.dispose();
    this.#ring.geometry.dispose();
    this.#ring.material.dispose();
    this.#blob.map?.dispose();
    this.#blob.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    // dispose() だけではコンテキストが残り、Safari は十数個で古いものを失う
    this.renderer.forceContextLoss();
  }
```

`webglcontextlost` / `webglcontextrestored` を聞いているところは、わんにゃんハウスには無い（`grep -rn "webglcontext" src/lib/games/pet-house` が何も返さない）。
環境の画像のほかに render target は無い（`grep -rn "RenderTarget\|PMREM" src/lib/games/pet-house` は `world3d.ts:174` だけ）。

### お手本（やっぱりカメレオン、直してある）

`src/lib/games/yappari-chameleon/world3d.ts:102-109` は、three の後に聞き手を付けて、戻ったら作り直す。

```ts
this.#buildEnvironment();
// iOS が裏に回したときに失うと、環境光の画像も塗りのテクスチャも空になる。戻ったら作り直す
canvas.addEventListener('webglcontextrestored', () => {
  // 古い画像の GL の物は文脈ごと消えているので、片付けずに手放す（片付けると別の文脈の物を消そうとして警告が出る）
  this.#environment = null;
  this.#buildEnvironment();
  onRestore();
});
```

`src/lib/games/yappari-chameleon/world3d.ts:142-151` の `#buildEnvironment()` にある。

```ts
  #buildEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.#environment?.dispose();
    this.#environment = pmrem.fromScene(env, 0.04);
    this.scene.environment = this.#environment.texture;
    this.scene.environmentIntensity = DAY.env;
    env.dispose();
    pmrem.dispose();
  }
```

three の `WebGLRenderer` は constructor の中で canvas に `webglcontextlost`（`preventDefault()` して戻れるようにする）と
`webglcontextrestored`（文脈の状態を作り直す）を付ける。こちらの聞き手はそのあとに付くので、呼ばれたときには three の作り直しが
済んでいて、新しい文脈で PMREM を焼ける。

カメレオンとちがい、わんにゃんハウスは render target を持たずに `.texture` だけを `scene.environment` に置いているので、
作り直しでは古い画像を片付けずに `scene.environment` を新しい画像に置き換えるだけにする（片付けない理由はお手本のコメントと同じ）。
カメレオンは聞き手を外していないが、わんにゃんハウスは場面を出入りするたびに `PetWorld` を作らず、`dispose()` で `forceContextLoss()`
するので、外しておかないと片付けたあとに戻る道が残る。ここでは名前のある関数にして `dispose()` で外す。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く（変更履歴やチケット番号は書かない）。

## Commands you will need

| Purpose    | Command                                         | Expected on success           |
| ---------- | ----------------------------------------------- | ----------------------------- |
| 型         | `pnpm check`                                    | `0 ERRORS 0 WARNINGS`、exit 0 |
| 近いテスト | `pnpm exec vitest run src/lib/games/pet-house/` | すべて pass                   |
| 全テスト   | `pnpm test:run`                                 | exit 0                        |
| lint       | `pnpm lint`                                     | exit 0                        |
| 全部       | `pnpm verify`                                   | exit 0                        |

## Scope

**In scope**

- `src/lib/games/pet-house/world3d.ts`
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/games/yappari-chameleon/world3d.ts` — お手本として読むだけ。聞き手を外していないのも変えない
- 2 つのゲームで共用する環境の部品を作ること — 中身は 5 行で、片方は render target を持ち、片方は強さを毎回書き直すので、共用すると引数が増えて長くなる
- `session.svelte.ts` に戻ったときの合図を渡すこと — わんにゃんハウスには塗りのような GPU だけの中身がほかに無い
- 単体テスト — `PetWorld` の constructor は `WebGLRenderer` と canvas の 2D を使い、node でも happy-dom でも作れない。偽物を並べるテストは直す行より長くなるので書かず、型と下の手での確かめにする

## Git workflow

- ブランチは `advisor/056-pet-house-restore-environment`
- コミットは 1 つ。英語の命令形 1 文（例 `Rebuild the pet-house environment map when the WebGL context comes back`）。Co-Authored-By などの trailer は付けない
- push しない（`main` への push は本番に配信される）

## Steps

### Step 1: 環境の画像を作る口を出し、戻ったときにも呼ぶ

`src/lib/games/pet-house/world3d.ts` を次のようにする。

1. constructor の 6 行（`const pmrem = …` から `pmrem.dispose();` まで）を、次の 3 行に置き換える。上にあるコメント
   「金属のお皿や布のつやに…」は `#buildEnvironment()` の上へ移す

```ts
this.#buildEnvironment();
this.scene.environmentIntensity = 0.35;
canvas.addEventListener('webglcontextrestored', this.#onRestored);
```

2. constructor のすぐ後ろ（`resize` の前）に次を足す

```ts
  /** 金属のお皿や布のつやに映り込む部屋の明るさ。強いと日なたと日かげの差が消えるので控えめにする（強さは時間帯ごとに書く） */
  #buildEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const env = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(env, 0.04).texture;
    env.dispose();
    pmrem.dispose();
  }

  // GPU の上でだけ作った画像なので、iOS が裏に回して文脈を失うと空のまま戻り、お皿のつやが消える。
  // 古い画像は文脈ごと消えているので片付けずに手放す（片付けると別の文脈の物を消そうとして警告が出る）
  readonly #onRestored = () => this.#buildEnvironment();
```

3. `dispose()` の `this.renderer.dispose();` の前に、聞き手を外す 1 行を足す

```ts
this.renderer.domElement.removeEventListener('webglcontextrestored', this.#onRestored);
```

`#onRestored` はクラスのフィールドなので、constructor の本体より先にできている。constructor で使ってよい。

**Verify**: `pnpm check` → `0 ERRORS 0 WARNINGS`。
`grep -c "webglcontextrestored" src/lib/games/pet-house/world3d.ts` → `2`（付けると外す）。
`grep -c "environmentIntensity = 0.35;" src/lib/games/pet-house/world3d.ts` → `1`（constructor だけ。作り直しでは書かない）。

### Step 2: テストと lint を通す

`world3d.ts` は `session.svelte.test.ts` では `vi.mock('./world3d', …)` で差し替えられ、`petting.test.ts` は `bodyMarks` と
`partOnRay` だけを読む。どちらも変わらないはず。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/` → すべて pass。`pnpm verify` → exit 0。

### Step 3: 手で確かめる（ブラウザを使うのはここだけ）

ブラウザは built-in browser（`mcp__Claude_Browser__*`）だけを使い、Claude in Chrome は使わない。dev server は 5173 ではなく
空いているポートを明示して起動する（例 `pnpm dev --port 5391 --strictPort`）。built-in browser では
`http://localhost:5391/asobibako/games/pet-house` を開き、タイトルの「タップで スタート」で部屋に入る
（はじめてならペットを 1 匹むかえる）。お皿（部屋の床の銀色の 2 つ）が画面に入っている状態で、開発者の console で次を実行する。

```js
const c = [...document.querySelectorAll('canvas')].find((el) => el.getContext('webgl2'));
const ext = c.getContext('webgl2').getExtension('WEBGL_lose_context');
ext.loseContext();
setTimeout(() => ext.restoreContext(), 1000);
```

`getContext('webgl2')` は three がすでに作った文脈を返す（2D の canvas では null なので飛ばされる）。

見ることは次の 3 つ。

1. 失ってから戻るまでの 1 秒は絵が止まり、戻ると部屋がまた描かれる
2. 戻ったあとも、お皿のふちと内側に部屋の明るさの映り込み（白っぽいつや）がある。直す前の版で同じことをすると、お皿が
   一様に暗くなる見込み（比べるのは必須ではない）
3. console に `WebGL: INVALID_OPERATION` などの警告やエラーが新しく出ていない

built-in browser が使えないとき、または絵が比べられないときは、この手順と結果を「実機で見ること」として報告に書き、
Step 1・2 の確かめだけで終えてよい。終わったら dev server を止める。

**Verify**: 上の 1〜3 を見たこと（または見られなかった理由）を報告に書く。

## Test plan

- 単体テストは足さない（Scope の Out of scope のとおり）
- 型と既存のテストで、constructor と `dispose()` の書き換えが壊れていないことを見る（`pnpm check`、`pnpm exec vitest run src/lib/games/pet-house/`）
- 手での確かめは Step 3。実機（iPad）では、部屋を出したままホーム画面へ戻り、ほかの重いアプリを開いてからわんにゃんハウスへ
  戻って、お皿のつやが残ることを見る

## Done criteria

- [ ] `grep -c "webglcontextrestored" src/lib/games/pet-house/world3d.ts` が `2`
- [ ] `grep -c "#buildEnvironment()" src/lib/games/pet-house/world3d.ts` が `3`（定義・constructor・`#onRestored`）
- [ ] `pnpm check` が `0 ERRORS 0 WARNINGS`
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で `src/lib/games/pet-house/world3d.ts` と `plans/README.md` のほかが変わっていない
- [ ] 報告に Step 3 の結果（または見られなかった理由）がある
- [ ] `plans/README.md` の 056 の行を更新した

## STOP 条件

- 上の抜粋（constructor の 6 行、`environmentIntensity` を書き直す行、`dispose()`）が今のコードと違う
- `grep -rn "RenderTarget\|PMREM\|webglcontext" src/lib/games/pet-house` が `world3d.ts:174` のほかを返す（作り直す物がほかにもある）
- Step 3 で、戻ったあとに部屋そのものが描かれない、または console に three のエラーが出る（環境の画像のほかの問題なので、直さずに報告する）
- 直すために `session.svelte.ts` やカメレオンのファイルを変えたくなった

## Maintenance notes

- わんにゃんハウスに、GPU の上でだけ作る画像（render target・PMREM・canvas から焼いて捨てる元の無い画像）を足すときは、
  `#onRestored` から作り直す
- `environmentIntensity` を作り直しで書かないのは、時間帯の更新（`world3d.ts:295` の行）が毎回書くため。強さを固定に戻すなら constructor の 1 行も合わせて見直す
- 確からしさは MED。実機で直す前の版の症状を見たわけではない。レビューでは、お手本のカメレオンと同じ順（three の聞き手のあとに
  付く・古い画像を片付けない）になっているかを見る
