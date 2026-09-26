# Plan 042: 初めて組み立てるペットを 1 フレームに 1 匹ずつにし、長く固まらないようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4f6f07a..HEAD -- src/lib/games/pet-house/world3d.ts src/lib/games/pet-house/session.svelte.ts src/lib/games/pet-house/session.svelte.test.ts src/lib/games/pet-house/plaza.svelte.ts`
> 計画 041 のブランチを取り込んだあとなので、`world3d.ts`・`session.svelte.ts`・`session.svelte.test.ts` は 041 の分だけ変わっている **はず**。
> それ以外の差分は「Current state」と見比べる。

## Status

| 項目       | 値                                                                                          |
| ---------- | ------------------------------------------------------------------------------------------- |
| Priority   | P2                                                                                          |
| Effort     | M                                                                                           |
| Risk       | MED（組み立て前のペットは描かれない。場面の覆いが外れる前に全員そろうことをテストで固める） |
| Depends on | 041（`busy` と、場面を移る仕組みが覆いを外す条件を使う）                                    |
| Category   | perf                                                                                        |
| Planned at | commit `4f6f07a`, 2026-09-26                                                                |

## Why this matters

わんにゃんハウスのペットの形は、その端末で初めて使う種類だと組み立てに 1 種類 数百 ms かかる（2 回目からは IndexedDB の控えを
読む）。いまは場面に出るペットを 1 フレームでまとめて組み立てるので、ふれあいひろばに初めて入るとき（8 匹）は 1 つの処理で
2.5 秒、CPU を 4 倍遅くすると 9.9 秒画面が固まった（headless Chrome での計測）。「ほかの子たち」でも 1.6 秒 / 6.4 秒。
iOS は長く応答しないページを終わらせることがあり、終わらされたあとに localStorage がまるごと消えたことがある。
わんにゃんハウスを更新するたびに形の控えは作り直しになるので、この止まりは更新のたびに起きる。

組み立てを 1 フレームに 1 匹までにすれば、1 つの処理は 1 種類ぶん（数百 ms）で区切られる。合計の時間は変わらないが、
あいだにブラウザへ戻るので、覆いの画面の足あとのアニメーションも進み、長時間の無応答にならない。覆いは全員そろうまで外さない。

## Current state

`src/lib/games/pet-house/world3d.ts:322-360` の `syncPets(pets: Pet[]): void` — `pets` のうちまだ見た目（view）の無い子を
その場で全部 `createPet(pet.breed, quality)` し、要らなくなった子を片づける。

```ts
  syncPets(pets: Pet[]): void {
    const quality = this.#applyQuality();
    for (const pet of pets) {
      let view = this.#pets.get(pet.id);
      if (view && view.breed !== pet.breed) { ...作り直すために捨てる... }
      if (!view) {
        const model = createPet(pet.breed, quality);
        ...
        this.#pets.set(pet.id, view);
        this.scene.add(model.group, blob);
      }
      ...アクセサリーと汚れ...
    }
    for (const [id, view] of this.#pets) { ...pets に無い子を片づける... }
  }
```

`update(actors, ...)`（`:372-383`）は `this.#pets` にある view だけを回すので、まだ組み立てていない子は描かれないだけで落ちない。
`model(petId)` は無ければ `undefined` を返す（呼ぶ側は `?.` で扱っている）。

`src/lib/games/pet-house/session.svelte.ts` の `frame` は毎回 `this.#world.syncPets(cast ? [...shown, ...cast.pets] : shown);` を呼ぶ。
計画 041 のあと、場面を移る仕組みは `else if (!this.#compiling) [this.#move, this.moving] = [null, null];` で覆いを外し、
`get busy()` が初めて開くときの「よみこみちゅう」を外す条件になっている。

`src/lib/games/pet-house/plaza.svelte.ts` の「ほかの子たち」は `swapping` のあいだ `PlazaHud.svelte` が「ほかの子たちを よんでいるよ…」を
出し、`frame` の `if (this.swapping && --this.#swapIn <= 0) { if (this.#swapIn === 0) this.#fill(...); else this.swapping = false; }` で
入れ替えてから外す。`host.world` は `PetWorld`（world3d のクラス）。

テストは `session.svelte.test.ts`（world3d をモックしている。モックの `syncPets(pets)` は `seen.pets = pets` するだけ）。

## Commands you will need

| Purpose             | Command                                        | Expected on success  |
| ------------------- | ---------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`               | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house` | all pass             |
| 全テスト            | `pnpm test:run`                                | all pass             |
| 型                  | `pnpm check`                                   | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                    | exit 0               |
| ビルド              | `pnpm build`                                   | exit 0               |

## Scope

In scope は Drift check に並べた 4 ファイルと `CLAUDE.md`（わんにゃんハウスの段落に 1 文）。

Out of scope は、形の組み立てそのもの（`models.ts`・`sculpt.ts`。Worker に移すなどはしない）、おさんぽで出会う犬（1 匹だけで、
`prepare()` で形を先に読む）、`PlazaHud.svelte`（`swapping` を見るだけなので変えない）。

## Git workflow

- ステップごとにコミットしてよい。メッセージは英語の命令形 1 行（例 `Build at most one new pet per frame`）。末尾に Co-Authored-By を 1 行
- push しない。git stash は使わない

## Steps

### Step 1: world3d は 1 回に 1 匹まで組み立て、残りの数を持つ

- `syncPets(pets: Pet[])` の中で、新しく `createPet` するのを 1 回の呼び出しにつき 1 匹までにする。2 匹目からは作らずに飛ばし、
  飛ばした数を `pending`（`get pending(): number` か読み取り専用のフィールド）に入れる。作れた子のアクセサリーと汚れは今までどおり
- 種類が変わって作り直す子（`view.breed !== pet.breed`）も、新しく作る 1 匹に数える
- 片づけ（`pets` に無い子の dispose）は今までどおり全部その場で行う

**Verify**: `pnpm check` → 0 errors

### Step 2: Session は、全員そろうまで覆いを外さない

- 場面を移る仕組みが覆いを外す条件を `else if (!this.#compiling && !this.#world.pending) [this.#move, this.moving] = [null, null];` にする
- `busy` を `!!this.#move || this.#compiling || this.#world.pending > 0` にする（初めて開くときの「よみこみちゅう」）
- シェーダーの準備（041 の `#compileNext`）は、全員そろってから行う。`#compileNext` を下ろして `#precompile()` を呼ぶ条件に
  `!this.#world.pending` を足す

**Verify**: `pnpm check` → 0 errors

### Step 3: 「ほかの子たち」も全員そろうまで知らせを出したままにする

`plaza.svelte.ts` の `else this.swapping = false;` を `else if (!this.#host.world.pending) this.swapping = false;` にする
（`#host` の名前は実物に合わせる）。

**Verify**: `pnpm check` → 0 errors

### Step 4: テストを書く

`session.svelte.test.ts` の world3d のモックに `pending` を足す（モジュールの変数で差し替えられる形。既定は 0）。2 本足す。

1. `pending` が 2 のあいだは、場面を移る覆い（`session.moving`）が外れず `busy` が true。0 にすると数フレームで `moving` が null、`busy` が false
2. `pending` が 0 でないあいだは `precompile` が呼ばれず、0 になってから呼ばれる

world3d の `syncPets` そのもの（1 匹ずつ作る）は three と canvas が要るので、ここではテストしない。代わりにレビュー担当が
headless Chrome で、初めてひろばに入るときの長いタスクが 1 種類ぶんずつに分かれることを測る。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts` → all pass（2 本増える）

### Step 5: CLAUDE.md に 1 文足す

わんにゃんハウスの段落の場面の組み立ての説明に、「初めて使う種類のペットは組み立てに数百 ms かかるので、world3d は 1 フレームに 1 匹まで
作り（`pending` に残りの数）、Session とひろばは全員そろうまで覆いを外さない」を足す。経緯は書かない。

**Verify**: `grep -c "pending" CLAUDE.md` → 1 以上

### Step 6: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm build` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

`session.svelte.test.ts` に 2 本（Step 4）。1 匹ずつ組み立てることと長いタスクの長さは、レビュー担当が headless Chrome で測る。

## Done criteria

- [ ] `grep -n "pending" src/lib/games/pet-house/world3d.ts src/lib/games/pet-house/session.svelte.ts src/lib/games/pet-house/plaza.svelte.ts` が 3 ファイルで出る
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm build` / `pnpm vitals --diff` が通る
- [ ] 自分のコミットで触ったファイルが In scope のものだけ（+ `plans/README.md`）

## STOP conditions

- 抜粋と今のコードが違う（041 を取り込んでいない、など）
- まだ組み立てていない子があると落ちる処理が見つかった（`model(petId)` の戻り値を `?.` なしで使っている所など）。その所を報告する
- 既存のテストの期待する中身を変えないと通らない

## Maintenance notes

- ペットを一度にたくさん出す場面を足すときも、覆いは `busy` / `pending` が 0 になるまで外さない
- 形の組み立てそのものを軽くする（Worker に移すなど）ときは、この 1 匹ずつの仕組みはそのまま使える
