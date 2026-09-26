# Plan 041: 場面に入るとき、シェーダーの準備が済むまで描かずに待つ

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4f6f07a..HEAD -- src/lib/games/pet-house/world3d.ts src/lib/games/pet-house/session.svelte.ts src/lib/games/pet-house/session.svelte.test.ts src/lib/games/pet-house/PetHouse.svelte`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                      |
| ---------- | --------------------------------------------------------------------------------------- |
| Priority   | P3                                                                                      |
| Effort     | S                                                                                       |
| Risk       | MED（描く順番を変える。準備が終わらないと「いどうちゅう」が残るので、1.5 秒で打ち切る） |
| Depends on | none                                                                                    |
| Category   | perf                                                                                    |
| Planned at | commit `4f6f07a`, 2026-09-26                                                            |

## Why this matters

headless Chrome で測ると、わんにゃんハウスで部屋を開くときに約 90ms、ふれあいひろばに入るときに約 45ms、three がシェーダーの
リンクの終わりを同期で待って画面が止まっていた（`getProgramParameter`）。three の `renderer.compileAsync(scene, camera)` は、
`KHR_parallel_shader_compile` がある環境では、シェーダーの準備を止まらずに待ってから Promise を返す（無ければ今と同じく
その場で準備し、すぐ返す）。場面を組み立てたあと、準備が済むまで描かずに「いどうちゅう…」（初めて開くときは
「よみこみちゅう…」）を出したまま待てば、止まりが画面を覆っているあいだの待ちに変わる。

iPad の Safari がこの拡張を持つかは実機で確かめる必要がある。持たなければ効かないが、今より悪くはならない。

## Current state

`src/lib/games/pet-house/world3d.ts:125` — `readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 60);`
`:522-524`

```ts
  render(): void {
    this.renderer.render(this.scene, this.camera);
  }
```

`node_modules/three/src/renderers/WebGLRenderer.js:1515` の `compileAsync(scene, camera, targetScene = null)` は
`this.compile(...)` のあと、`KHR_parallel_shader_compile` があれば 10ms ごとに `program.isReady()` を見て、全部そろったら resolve する。

`src/lib/games/pet-house/session.svelte.ts` の場面を移る仕組み（計画 036 のあと）

```ts
  #move: { run: (() => void) | null; wait: number; ready: boolean } | null = null;
...
  frame(dt: number): void {
    const m = this.#move;
    if (m && m.ready && --m.wait <= 0) {
      const run = m.run;
      [m.run, m.wait] = [null, 3];
      if (run) run();
      else [this.#move, this.moving] = [null, null];
    }
    ...
    this.#world.syncPets(cast ? [...shown, ...cast.pets] : shown);
    this.#world.update(cast?.actors ?? this.#actors, this.#view, step, this.#now, this.save.current, this.tool);
    this.#world.render();
```

`#go(label, run, ready?)` は `ready` があると `ready.then(done, done)` と 1.5 秒のタイマーで `move.ready = true` にする。

`src/lib/games/pet-house/PetHouse.svelte:65-69`（初めて開くときの「よみこみちゅう」を外す条件）

```ts
stop = animate((dt) => {
  s!.frame(dt);
  // 最初の数フレームはシェーダーの準備で止まりがちなので、落ち着いてから外す
  if (loading && !s!.moving && ++frames > 3) loading = false;
});
```

`src/lib/games/pet-house/session.svelte.test.ts:13-` が `./world3d` をモックしている（`PetWorld` の偽のクラスに `render()` などがある）。

## Commands you will need

| Purpose             | Command                                                               | Expected on success  |
| ------------------- | --------------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                      | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                                                       | all pass             |
| 型                  | `pnpm check`                                                          | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                           | exit 0               |
| ビルド              | `pnpm build`                                                          | exit 0               |

## Scope

In scope は Drift check に並べた 4 ファイルと `CLAUDE.md`（わんにゃんハウスの段落に 1 文）。

Out of scope は、雪原サバイバル（`snow-camp`）、three の設定（`checkShaderErrors` など）、ペットの組み立て（計画 042 が扱う）。

## Git workflow

- ステップごとにコミットしてよい。メッセージは英語の命令形 1 行（例 `Precompile pet-house shaders behind the loading screen`）。
  末尾に Co-Authored-By を 1 行
- push しない。git stash は使わない

## Steps

### Step 1: world3d に、準備を待つ口を足す

```ts
  /** 描く前にシェーダーを準備する。KHR_parallel_shader_compile があれば止まらずに待てる（無ければその場で準備して返る） */
  precompile(): Promise<unknown> {
    return this.renderer.compileAsync(this.scene, this.camera);
  }
```

**Verify**: `pnpm check` → 0 errors

### Step 2: Session で、場面を組み立てたら準備が済むまで描かない

- `#compiling = false` を足す
- `#precompile()` を足す。`#compiling = true` にし、`this.#world.precompile()` が片づくか 1.5 秒たったら `#compiling = false`
  （`then(done, done)` と `setTimeout(done, 1500)`。1.5 秒は `#go` の待ちと同じ長さ。止まったまま「いどうちゅう」が残らないように）
- `frame` で、場面を組み立てた直後（`if (run) run();` のあと）に `this.#compileNext = true` を立てる。コンストラクタでも立てる
  （初めて開くとき）
- `frame` の `this.#world.syncPets(...)` のあとで、`#compileNext` が立っていれば下ろして `#precompile()` を呼ぶ
  （ペットが場面に入ってから準備すると、毛の材質も一緒に準備できる）
- `this.#world.render()` の前に `if (this.#compiling) return;` を置く（準備が済むまで描かない。画面は「いどうちゅう」か
  「よみこみちゅう」で覆われている）
- 場面を移る仕組みが「いどうちゅう」を外すのを、準備が済むまで待たせる。`else [this.#move, this.moving] = [null, null];` を
  `else if (!this.#compiling) [this.#move, this.moving] = [null, null];` にする
- 初めて開くときの「よみこみちゅう」のために、`get busy(): boolean { return !!this.#move || this.#compiling; }` を足す

**Verify**: `pnpm check` → 0 errors

### Step 3: 初めて開くときの「よみこみちゅう」も準備を待つ

`PetHouse.svelte` の `if (loading && !s!.moving && ++frames > 3) loading = false;` を
`if (loading && !s!.busy && ++frames > 3) loading = false;` にする。

**Verify**: `pnpm check` → 0 errors

### Step 4: テストを書く

`session.svelte.test.ts` の world3d のモックに `precompile()` を足す（テストごとに解決を遅らせられるよう、モジュールの変数で
Promise を差し替えられる形にする。既定はすぐ解決する Promise）。2 本足す。

1. `precompile` が解決しないあいだは `render` が呼ばれず、`session.busy` が true。解決するとその次のフレームから `render` が呼ばれ、
   やがて `busy` が false
2. `precompile` がずっと解決しなくても、fake timers で 1.5 秒進めると `render` が呼ばれる

既存のテスト（描いた回数 `seen.renders` を数えるものなど）が、最初の準備のぶん描かないフレームが増えて落ちるときは、
既定の Promise がすぐ解決することを確かめ、テスト側で 1 フレーム多く進める直しにとどめる（期待する中身は変えない）。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts` → all pass（2 本増える）

### Step 5: CLAUDE.md に 1 文足す

わんにゃんハウスの段落の「場面の組み立ては数百 ms 止まるので、Session は「いどうちゅう…」を 1 度描かせてから組み立てる（`moving`）」の
あとに、「組み立てたあとは `compileAsync` でシェーダーの準備が済むまで描かずに待つ（最長 1.5 秒）」を足す。経緯は書かない。

**Verify**: `grep -c "compileAsync" CLAUDE.md` → 1 以上

### Step 6: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm build` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

`session.svelte.test.ts` に 2 本（Step 4）。止まりの時間はレビュー担当が headless Chrome で測り直す（部屋を開くときとひろばに入るときの
`getProgramParameter` の待ちが消えたか）。iPad の Safari で効くかは実機で見る。

## Done criteria

- [ ] `grep -n "compileAsync" src/lib/games/pet-house/world3d.ts` が 1 行
- [ ] `grep -n "busy" src/lib/games/pet-house/PetHouse.svelte` が 1 行
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm build` / `pnpm vitals --diff` が通る
- [ ] `git diff --name-only 4f6f07a` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- 抜粋と今のコードが違う
- 既存のテストの期待する中身を変えないと通らない
- `compileAsync` が three の型に無い

## Maintenance notes

- `#compiling` のあいだは描かない。長い準備を足すときは、画面が覆われているあいだにだけ呼ぶ
- 準備の待ちは 1.5 秒で打ち切る。打ち切ったあとの最初の描画で、今までどおりその場で準備する
