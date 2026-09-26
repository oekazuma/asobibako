# Plan 043: ペットの毛並み（毛の殻）と、3D の画質の設定をなくす

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 18b65e3..HEAD -- src/lib/graphics.svelte.ts src/lib/components/GraphicsSetting.svelte src/routes/about src/lib/backup.ts src/lib/games/pet-house CLAUDE.md`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                            |
| ---------- | ----------------------------------------------------------------------------- |
| Priority   | P1                                                                            |
| Effort     | M                                                                             |
| Risk       | MED（ペットの見た目が変わる。首輪などのアクセサリーの位置を地肌に合わせ直す） |
| Depends on | none                                                                          |
| Category   | perf / tech-debt                                                              |
| Planned at | commit `18b65e3`, 2026-09-26                                                  |

## Why this matters

利用者が、わんにゃんハウスのペットの毛並みの演出はいらないと判断した。毛並みは、体の面を少しずつ外へふくらませた殻を
何枚も重ねて描く（`fur.ts`）。1 匹あたり 30〜35 回の描画と 26〜43 万の三角形を使い、形の控えも殻のぶんだけ大きい。
3D の画質の設定（アプリについての「がしつ」、`graphics.svelte.ts`）は、主に殻の枚数を端末の力に合わせるためにあった。

この計画のあと、ペットは体そのもの（殻の 0 枚目）だけで描かれ、ぬれた・汚れた見た目（0 枚目の材質が持つ）はそのまま残る。
画質の設定はなくなり、遊ぶ端末（iPad Air）で使っていた「きれい」の値（画面の細かさ 1.5 倍まで、影 2048）に固定される。

## Current state

`src/lib/graphics.svelte.ts`（31 行）— `GRAPHICS_KEY = 'asobibako:graphics'`、`type Quality = 'high' | 'normal' | 'low'`、
`QUALITIES`、`graphics = $state({ quality: read() })`、`setQuality()`。使っているのは次のファイル（`grep -rlE "graphics\.svelte|Quality\b|GRAPHICS_KEY" src`）。

- `src/lib/backup.ts`（`EXCLUDED` に `GRAPHICS_KEY`）
- `src/lib/components/GraphicsSetting.svelte`（49 行、アプリについての「がしつ」のカードの中身）
- `src/routes/about/+page.svelte`（`<section class="card"><h2>がしつ</h2><GraphicsSetting /></section>`）と `src/routes/about/page.svelte.test.ts`（見出しの一覧を確かめている）
- `src/lib/games/pet-house/meta.ts`・`plaza.svelte.ts`・`walk.svelte.ts`（`loadShapes(..., graphics.quality)`、walk は `createPet(breed, graphics.quality)`）
- `src/lib/games/pet-house/world3d.ts`（`#applyQuality()`。画質で `renderer.setPixelRatio(Math.min({ high: 1.5, normal: 1.25, low: 1 }[q], devicePixelRatio))`、影の大きさ `q === 'low' ? 1024 : 2048`、各ペットの `model.setQuality(q)`）
- `src/lib/games/pet-house/models.ts`（下）と `models.test.ts`

`src/lib/games/pet-house/models.ts`

```ts
// :36-45
const QUALITY: Record<Quality, { layers: number; len: number; cell: number; h: number; shell: number }> = {
  high: { layers: 1.6, len: 1.12, cell: 0.85, h: 1, shell: 1.25 },
  normal: { layers: 1, len: 1, cell: 1, h: 1, shell: 1.5 },
  low: { layers: 0, len: 0.55, cell: 1.3, h: 1.3, shell: 2 }
};
const layersOf = (look: Look, q: Quality) => (q === 'low' ? 2 : Math.round(look.fur.layers * QUALITY[q].layers));
```

- `:81` `Body` の `shell: THREE.BufferGeometry`（殻に使う粗い面）
- `:109` `saved = new Map<string, { geo: Saved; shell: Saved }>()`、`:134` `loadShapes(ids, q)`、`:173` `keepShapes(key, geo, shell)`（IndexedDB の形の控え）
- `:318` `bodyOf(id, look, q)` が `g`（体の面、`dress(..., surf(Q.h), ..., Q.len)`）と `coarse`（殻の面、`surf(Q.h * Q.shell)`）を作る
- `:612` `build(look, id, q)`、`:639-649` の殻のループ（`for (let i = 0; i <= L; i++) new THREE.SkinnedMesh(i ? body.shell : body.geo, furMaterial(i, L, cell))`、`fur.push({ mesh: m, layer: i })`）
- `:759` あごの小さな形も `furMaterial(0, L, cell)` を使う
- `:1015` `createPet(breed, quality = 'normal')`、`:1041` `mount(q)`、`:1459` `setQuality(q)`（`PetModel` の口、`:32`）
- `:1071-1082` アクセサリーを付ける `wear()` が `accessory(worn, { look, key: fitKey, field: rig.body.plain, body: rig.body.shell, skeleton })` を呼ぶ
- `:1085` `coat()` が `rig.fur` の各層の材質を `furMaterial(f.layer, rig.layers, rig.cell, wet, dirty)` で差し替える（ぬれ・汚れ）

`src/lib/games/pet-house/fur.ts:110-` `furMaterial(layer, layers, cell, wet = 0, dirt = 0)`。`layer` が 0 のものが体そのもの
（`const shell = layer > 0`）。

`src/lib/games/pet-house/accessories.ts` は、首まわりを体の面（`body`）から測り、頂点の毛の長さ（`furLen`）の分だけ外へ
浮かせて付ける（`:128` `fur: body.attributes.furLen.getX(best)`、`:259` `s.fur * o.sink + o.t`、`:298`、`:608`、`:615`、`:637` など）。

`src/lib/games/pet-house/props.ts:392-397` の小物（10 枚の殻の毛の材質を使う）はペットではない。この計画では触らない。

## Commands you will need

| Purpose             | Command                                                                          | Expected on success  |
| ------------------- | -------------------------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                                 | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house src/routes src/lib/backup.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                                                                  | all pass             |
| 型                  | `pnpm check`                                                                     | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                                      | exit 0               |
| vitals              | `pnpm vitals --diff`                                                             | exit 0               |
| ビルド              | `pnpm build`                                                                     | exit 0               |

## Scope

In scope は次のとおり。

- 削除: `src/lib/graphics.svelte.ts`、`src/lib/components/GraphicsSetting.svelte`
- 変更: `src/lib/backup.ts`、`src/routes/about/+page.svelte`、`src/routes/about/page.svelte.test.ts`、
  `src/lib/games/pet-house/` の `models.ts`・`models.test.ts`・`accessories.ts`・`world3d.ts`・`meta.ts`・`plaza.svelte.ts`・`walk.svelte.ts`、
  `CLAUDE.md`
- 型を直すために要る最小の変更（`Quality` を import していたほかのファイル）

Out of scope は次のとおり。

- `fur.ts` の中身（0 枚目の材質は今のまま使う。殻のためのコードが残るのはかまわない）
- `props.ts` の小物の毛
- 雪原サバイバル（`snow-camp`）
- 顔の毛並みの描き方（面に描いた短い毛）

## Git workflow

- ステップごとにコミットしてよい。メッセージは英語の命令形 1 行（例 `Drop pet fur shells and the graphics setting`）。末尾に Co-Authored-By を 1 行
- push しない。git stash は使わない

## Steps

### Step 1: 画質の設定をなくし、値を固定する

- `models.ts` の `QUALITY` と `layersOf` を、画質なしの 1 組の値にする。体の面の細かさ `h` は 1、毛の長さ `len` と毛 1 本の間隔 `cell` は
  今の `high` の値（1.12 と 0.85）を使う（0 枚目の材質の見た目を今の標準と同じにするため）
- `models.ts` の `Quality` の引数（`loadShapes`・`bodyOf`・`build`・`createPet`・`mount`・`setQuality`）を取り除く。`PetModel` の口から
  `setQuality` を消す。形の控えの鍵（`${id}:${q}`）は `${id}` にする（`__PET_SHAPES__` がこのファイルの中身から作られるので、
  版は自動で変わり、古い控えは捨てられる）
- `world3d.ts` の `#applyQuality()` をなくし、renderer を作るところで `setPixelRatio(Math.min(1.5, devicePixelRatio))`、影の大きさ 2048 に
  固定する。`syncPets` などの `this.#applyQuality()` の呼び出しを消す
- `meta.ts`・`plaza.svelte.ts`・`walk.svelte.ts` から `graphics` の import と引数を消す
- `src/lib/graphics.svelte.ts` と `src/lib/components/GraphicsSetting.svelte` を削除する
- `src/routes/about/+page.svelte` の「がしつ」のカードを消し、`page.svelte.test.ts` の見出しの一覧から「がしつ」を消す
- `backup.ts` は `GRAPHICS_KEY` の import をやめ、`EXCLUDED` に文字列 `'asobibako:graphics'` を残す（前の版の端末ごとの設定が
  残っている端末や、それを含む書き出しがあるため）。コメントは「前の版の画質の設定。端末ごとの値なので持ち込まない」

**Verify**: `grep -rn "graphics.svelte\|GraphicsSetting\|Quality\b" src` → 0 行（`models.test.ts` は Step 3 で直すので、ここでは出てよい）。
`pnpm check` → テストファイル以外で 0 errors

### Step 2: ペットの毛の殻をなくす

- `build` の殻のループを、0 枚目（`body.geo` と `furMaterial(0, 0, cell)`）だけにする。`furMaterial(0, 0, cell)` が 0 で割るなどして
  壊れないことを `fur.ts` で確かめる（壊れるなら `layers` に 1 を渡す）。`rig.fur` は 1 要素になり、`coat()` はそのまま動く
- `Body` から `shell` をなくし、`bodyOf` で `coarse` を作らない。`saved`・`toSaved`・`fromSaved`・`keepShapes` も `geo` だけにする
- あごの形（`:759`）の `furMaterial(0, L, cell)` も同じ値にする
- アクセサリーは地肌に合わせる。`wear()` で `body: rig.body.geo` を渡し、`accessories.ts` の毛の長さで浮かせる分（`fur` を使う式）を
  0 にする。いちばん小さい変更は、`accessories.ts:128` の `nearest()` が返す `fur` を 0 にすること。そのうえで `fur` が
  どこでも 0 なら、`fur` の項目と `s.fur * ...` の項を消して式を簡単にしてよい（どちらかに揃える）
- `models.ts` のファイル先頭の説明（「…体・胸・しっぽに毛の殻（`fur.ts`）を重ねて組む」など）を今の作りに直す

**Verify**: `pnpm check` → テストファイル以外で 0 errors

### Step 3: テストを直す

- `models.test.ts` の画質ごとのテスト（`Quality` を使うもの、殻の枚数を数えるもの）を、画質なしの 1 通りに直す。毛の殻が無いこと
  （体の `SkinnedMesh` が 1 枚で、`rig.fur` の層が 0 枚目だけ）を確かめるテストを 1 本足す
- 期待を変えたテストは、変えた理由を報告の NOTES に 1 行ずつ書く（画質・殻に関するもの以外の期待は変えない）

**Verify**: `pnpm exec vitest run src/lib/games/pet-house src/routes src/lib/backup.test.ts` → all pass

### Step 4: CLAUDE.md を今の仕様にする

- 「ランタイム依存は three だけで…」の段落や `/about` の説明から「3D の画質（`GraphicsSetting.svelte`）」を消す
- 「アプリについて（`/about`）のバックアップは…端末ごとの控え（`asobibako:last-error` と `asobibako:gate` と `asobibako:graphics`）は書き出さず」は、
  graphics を「前の版の画質の設定」として残すか、文を今の状態に合わせる
- わんにゃんハウスの段落の「…体・胸・しっぽに毛の殻（`fur.ts`）を重ねて組む」「3D の画質は `src/lib/graphics.svelte.ts`（…）で…」を
  今の作り（殻を使わず体そのものに色と短い毛並みを描く、画質は固定）に直す

経緯は書かない。

**Verify**: `grep -n "graphics.svelte\|GraphicsSetting\|がしつ" CLAUDE.md` → 0 行。`pnpm lint` → exit 0

### Step 5: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0。`pnpm build` → exit 0

## Test plan

- `models.test.ts` を画質なしに直し、殻が無いことのテストを 1 本足す（Step 3）
- 見た目（ペットの毛の無い姿、首輪やリボンが首に沿って浮いていないか）は、レビュー担当が headless Chrome のスクリーンショットで
  前と見比べる

## Done criteria

- [ ] `test ! -e src/lib/graphics.svelte.ts && test ! -e src/lib/components/GraphicsSetting.svelte`
- [ ] `grep -rn "graphics.svelte\|GraphicsSetting\|Quality\b" src` → 0 行
- [ ] `grep -n "body.shell\|shell:" src/lib/games/pet-house/models.ts` → 0 行
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` / `pnpm build` が通る
- [ ] 触ったファイルが In scope のものだけ（+ `plans/README.md`）

## STOP conditions

- 抜粋と今のコードが違う
- 殻を使うほかの仕組みが見つかった（ブラシで毛を整える見た目、おふろの泡の位置、なでた場所の判定 `pickPart` が殻の面を使っている、など）。
  どこかを報告して聞く
- 画質・殻と関係のないテストの期待を変えないと通らない

## Maintenance notes

- 毛並みを戻したくなったら、`fur.ts` の殻の仕組みは残っているので、`build` の層の数を戻し、`Body` に殻の面を足せばよい
- 画質の設定を戻すときは、`asobibako:graphics` の保存名を使う（`backup.ts` の `EXCLUDED` に残してある）
