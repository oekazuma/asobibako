# Plan 027: ずかんと写真を容量不足で消さず、保存できないときは知らせる

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4c06cf0..HEAD -- src/lib/games/doodle-worm/stock.ts src/lib/games/doodle-worm/stock.test.ts src/lib/games/doodle-worm/DoodleWorm.svelte src/lib/games/pet-house/engine.ts src/lib/games/pet-house/engine.test.ts src/lib/games/pet-house/session.svelte.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                        |
| ---------- | ----------------------------------------- |
| Priority   | P1                                        |
| Effort     | S                                         |
| Risk       | LOW（消す処理を減らし、知らせを足すだけ） |
| Depends on | none                                      |
| Category   | bug                                       |
| Planned at | commit `4c06cf0`, 2026-09-26              |

## Why this matters

子どもの作品（らくがきパレードのずかん、わんにゃんハウスの写真）とペットの記録は、同じ localStorage（オリジン全体で
数 MB）を分け合う。いまのコードには作品を黙って失う経路が 3 つある。

1. ずかんが ★ 付きの絵 48 枚で埋まっていると、「うごけ！」で描いたばかりの絵がずかんに入らない。`keep()` が
   「★ のない絵」を古い順に落とすとき、先頭の新しい絵も対象にしてしまうため（★ 48 枚 + 新 1 枚 → 新しい絵が消える。
   監査で再現済み）。仕様（CLAUDE.md）は「あふれたら ★ のない古い絵から落とす」
2. 容量が足りず 1 枚でも書けないとき、`saveStock` と `writePhotos` は最後に `removeItem` して **保存済みの全部** を消す
   （写真はメモリの `save.photos` も空にする）
3. わんにゃんハウス本体の `writeSave` は容量超過を握りつぶすので、ペット・コイン・芸の進みが保存されないまま遊び続け、
   閉じると戻る。誰も気づけない

この計画のあと、新しい絵は ★ の絵に押し出されず、容量が足りないときは「新しいものを諦める」だけで保存済みのものは
消さず、保存に失敗したら 1 度だけ画面と `asobibako:last-error` に知らせる。

## Current state

`src/lib/games/doodle-worm/stock.ts:57-77`

```ts
/** n 枚に減らす。★のない古い絵から落とし、それでも多ければ ★の古い絵を落とす */
function keep(list: Doodle[], n: number): Doodle[] {
  const out = [...list];
  for (let i = out.length - 1; out.length > n && i >= 0; i--) if (!out[i].star) out.splice(i, 1);
  return out.slice(0, n);
}

/** 入りきらなければ古い絵から落とす（★の絵はあとまで残す）。実際に残せたぶんを返す */
export function saveStock(list: Doodle[]): Doodle[] {
  for (let n = Math.min(list.length, MAX); n >= 0; n--) {
    const kept = keep(list, n);
    try {
      if (n === 0) localStorage.removeItem(STOCK_KEY);
      else localStorage.setItem(STOCK_KEY, JSON.stringify(kept));
      return kept;
    } catch {
      // 容量が足りない。1 枚減らして試す
    }
  }
  return keep(list, MAX);
}
```

リストは新しい順（先頭が最新）。`saveStock` の呼び出しは `src/lib/games/doodle-worm/DoodleWorm.svelte` の 3 か所。

```ts
// :44-52 go()  離れて描いた絵はそれぞれ別の子になる
const kids = groups(lines);
if (!kids.length) return;
for (const strokes of kids) add(world, hatch(strokes)!);
stock = saveStock([...kids.map((strokes) => pack(strokes)).reverse(), ...stock]);
// :67 ★の付け外し
stock = saveStock(stock.map((other) => (other === d ? { ...d, star: !d.star } : other)));
// :71 消す（最後の 1 枚を消すと空のリストが来る）
stock = saveStock(stock.filter((other) => other !== d));
```

`src/lib/games/pet-house/engine.ts:243-265`

```ts
/** 写真を除いた本体を書く。写真は writePhotos で撮ったときだけ書く */
export function writeSave(save: Save): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...save, photos: undefined }));
  } catch {
    // プライベートブラウズでは残せない。遊ぶのには困らない
  }
}

/** 容量が足りなければ古い写真から減らし、残せたぶんに save.photos もそろえる（読み直して枚数が変わらないように） */
export function writePhotos(save: Save): void {
  for (let n = save.photos.length; n >= 0; n--) {
    try {
      if (n === 0) localStorage.removeItem(PHOTOS_KEY);
      else localStorage.setItem(PHOTOS_KEY, JSON.stringify(save.photos.slice(0, n)));
      if (n < save.photos.length) save.photos = save.photos.slice(0, n);
      return;
    } catch {
      // 1 枚減らしてもう一度
    }
  }
}
```

写真を消す機能はない。`writePhotos` を呼ぶのは `session.svelte.ts:729-731`（`addPhoto` で先頭に足した直後）だけ。
読み戻しは `engine.ts` の `loadPhotos()`（`loadSave` の中で使われている）。

`src/lib/games/pet-house/session.svelte.ts:353-358`

```ts
  #write(stamp = true) {
    if (stamp) this.#stamps.add(...check(this.save));
    writeSave($state.snapshot(this.save));
    this.#dirty = false;
    this.#wrote = this.#now;
  }
```

Session は `this.#say(text, seconds?)` で子ども向けの吹き出し（ひらがなと分かち書き）を出す
（例 `this.#say('きょうも あそぼうね')`）。最後のエラーを残すのは
`src/lib/last-error.ts`の`remember(message)`（一覧の画面に出る）。

既存テストは `stock.test.ts`（容量の偽物は `vi.stubGlobal('localStorage', {...})`）と `engine.test.ts:133-157`
（写真の容量、偽物の localStorage は Map で 12000 字を超えると投げる）。

## Commands you will need

| Purpose             | Command                                                                                                                                              | Expected on success  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                                                                                                     | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/doodle-worm/stock.test.ts src/lib/games/pet-house/engine.test.ts src/lib/games/pet-house/session.svelte.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                                                                                                                                      | all pass             |
| 型                  | `pnpm check`                                                                                                                                         | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                                                                                                          | exit 0               |

## Scope

In scope は次のファイル。

- `src/lib/games/doodle-worm/stock.ts`、`src/lib/games/doodle-worm/stock.test.ts`
- `src/lib/games/doodle-worm/DoodleWorm.svelte`（`go()` の `saveStock` 呼び出しに引数を 1 つ足すだけ）
- `src/lib/games/pet-house/engine.ts`（`writeSave` と `writePhotos` だけ）、`src/lib/games/pet-house/engine.test.ts`
- `src/lib/games/pet-house/session.svelte.ts`（`#write` と、1 度だけ知らせるためのフィールド 1 つ）

Out of scope は次のとおり。

- らくがきの点の間引き・上限（見た目が変わるので別の判断）
- ほかのゲームの保存（`levels.ts` など）
- 記録の控え（`mirror.ts`）。計画 023 が扱う

## Git workflow

- ステップごとにコミットしてよい。メッセージ例 `Keep new doodles when the picture book is full of stars` /
  `Never wipe saved doodles or photos when storage is full`。末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- push しない

## Steps

### Step 1: 新しい絵を ★ の絵に押し出させない

`keep(list, n, fresh = 0)` にし、★ のない絵を落とすループは先頭の `fresh` 枚を対象から外す
（`i >= fresh`）。それでも `n` を超えるぶんは今までどおり `slice(0, n)` で古い方（★ の古い絵）から落ちる。
`saveStock(list, fresh = 0)` も受け取って `keep` へ渡す。JSDoc に「fresh は先頭に足したばかりの絵の数。★ の絵より先に
落とさない」と 1 行足す。

`DoodleWorm.svelte` の `go()` は `saveStock([...], kids.length)` にする。★ の付け外しと消すは今のまま（fresh = 0）。

**Verify**: `pnpm exec vitest run src/lib/games/doodle-worm/stock.test.ts` → 既存 4 本 pass

### Step 2: 容量が足りないとき、保存済みのずかんを消さない

`saveStock` を次の振る舞いにする。

- `list` が空なら `removeItem(STOCK_KEY)` して `[]` を返す（最後の 1 枚を消したとき）
- そうでなければ `n` を `Math.min(list.length, MAX)` から **1 まで** 減らしながら書く。書けたらそれを返す
- 1 枚でも書けなかったら、何も消さず、`remember('らくがきパレードのずかんを保存できませんでした（容量）')` を呼び、
  保存されている今のずかん `loadStock()` を返す（画面の一覧が本当に残っているものと一致する）

`remember` は `$lib/last-error` から import する。

**Verify**: `pnpm exec vitest run src/lib/games/doodle-worm/stock.test.ts` → pass

### Step 3: 写真も消さず、本体の保存の失敗を返す

- `writePhotos`: ループの下限を 1 にし、`removeItem` の分岐を消す。1 枚も書けなかったら `save.photos = loadPhotos()`
  （保存済みの写真に戻す）にして `false` を返す。書けたら `true`（戻り値の型は `boolean`）
- `writeSave`: 成功で `true`、失敗で `false` を返す。catch のコメントを「プライベートブラウズや容量不足で残せない。
  知らせるのは呼び出し側」にする

`loadPhotos` が `engine.ts` の中にあることを確かめる（無ければ STOP）。

**Verify**: `pnpm check` → 0 errors

### Step 4: わんにゃんハウスで保存に失敗したら 1 度だけ知らせる

`session.svelte.ts` に `#full = false` を足し、`#write` を次の形にする。

```ts
  #write(stamp = true) {
    if (stamp) this.#stamps.add(...check(this.save));
    if (!writeSave($state.snapshot(this.save)) && !this.#full) {
      // 閉じると進みが戻ってしまうので、遊んでいるうちに大人が気づけるようにする
      this.#full = true;
      this.#say('きろくが いっぱいで のこせないよ。おうちの ひとに みせてね');
      remember('わんにゃんハウスの記録を保存できませんでした（容量）');
    }
    this.#dirty = false;
    this.#wrote = this.#now;
  }
```

写真を撮る所（`:729-731`）でも `writePhotos(this.save)` が `false` なら同じ知らせ方をする（同じ `#full` を使ってよい。
メッセージは写真用に「しゃしんが いっぱいで のこせないよ」）。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/session.svelte.test.ts src/lib/games/pet-house/engine.test.ts` → pass

### Step 5: テストを足す

`stock.test.ts` に 3 本（見本は同じファイルの「あふれたときは ★のない古い絵から落とし、★の絵は残す」）。

1. ★ 付き 48 枚の先頭に新しい 1 枚を足して `saveStock(list, 1)` → 新しい絵が先頭に残り、48 枚、いちばん古い ★ の絵が落ちる
2. 保存済みのずかんがある状態で `setItem` が常に投げる偽物に差し替え、新しい絵を足して `saveStock` → 保存の中身は
   変わらず（`removeItem` されない）、戻り値は保存済みの一覧と同じ
3. `saveStock([])` → キーが消える

`engine.test.ts` に 2 本（見本は「写真は別のキーに置き、容量があふれたら…」）。

1. 写真が保存済みの状態で `setItem` が常に投げる偽物にし、`addPhoto` → `writePhotos` が false、`PHOTOS_KEY` の中身は
   保存済みのまま、`save.photos` も保存済みと同じ
2. `writeSave` は成功で true、`setItem` が投げると false

**Verify**: `pnpm exec vitest run src/lib/games/doodle-worm/stock.test.ts src/lib/games/pet-house/engine.test.ts` → all pass（5 本増える）。
Step 1 の `i >= fresh` を `i >= 0` に戻すとテスト 1 が落ちることを確かめてから戻す

### Step 6: 全体の確認

**Verify**: `pnpm test:run` → all pass（ノミのテストが乱数でまれに落ちるのは既知。落ちたらもう一度流す）。
`pnpm check` → 0 errors。`pnpm lint` → exit 0

## Test plan

Step 5 の 5 本。どれも既存の偽物の localStorage の書き方（`vi.stubGlobal`）に合わせる。

## Done criteria

- [ ] `grep -n "removeItem" src/lib/games/doodle-worm/stock.ts` が「空のリスト」の 1 か所だけ
- [ ] `grep -n "removeItem(PHOTOS_KEY)" src/lib/games/pet-house/engine.ts` が 0 行
- [ ] `grep -n "#full" src/lib/games/pet-house/session.svelte.ts` が宣言と参照で出る
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` が通る
- [ ] `git diff --name-only 4c06cf0` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- `session.svelte.ts` の `#say` や `writePhotos` の呼び出しが抜粋と違う
- `DoodleWorm.svelte` が 200 行以上になる（svelte-vitals の `architecture/component-size`）
- 既存のテストの期待を変えないと通らない（仕様の読み違いの可能性。どのテストか報告する）

## Maintenance notes

- 作品や記録を保存する処理を足すときは、容量不足で「保存済みのものを消す」経路を作らない。諦めるのは新しいものだけにする
- 容量不足の知らせは 1 回の起動で 1 度だけ。直すには大人が写真やずかんを減らすか、アプリについてで書き出して整理する
