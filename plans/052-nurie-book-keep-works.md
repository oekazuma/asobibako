# Plan 052: ぬりえちょうがあふれて古い作品を消したら、そのことを子どもに知らせ、数を見せる

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/coloring/book.ts src/lib/coloring/Picker.svelte src/lib/coloring/Picker.svelte.test.ts src/lib/games/nurie/Nurie.svelte src/lib/games/nurie/Nurie.svelte.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                          |
| ---------- | ----------------------------------------------------------- |
| Priority   | P2                                                          |
| Effort     | S                                                           |
| Risk       | LOW（消す決まりは変えない。消した数を返して画面に出すだけ） |
| Depends on | none                                                        |
| Category   | bug                                                         |
| Planned at | commit `36cc037`, 2026-10-14                                |

## Why this matters

ぬりえ（`nurie`）の作品は、ぬりえちょう（IndexedDB の `asobibako-nurie`）に 30 作品まで残る。31 作品めを保存すると、
いちばん古い作品が黙って消える。子どもは前に塗った絵が急に無くなったと感じ、なぜ消えたのかも分からない。
このアプリの持ち主は iOS に記録をまるごと消されたことがあり、記録が知らないうちに消えることを嫌う。

この計画では消す決まり（古いものから）は変えずに、次の 2 つを足す。

1. 保存で古い作品を消したら、えらぶ画面に 1 行「いちばん ふるい さくひんを けしたよ」を出す
2. ぬりえちょうの見出しの横に「N / 30」を出し、いっぱいに近いことが前もって分かるようにする

`Work` には ★（おきにいり）の印が無いので、らくがきパレードのずかんのように「★ の無い古い絵から落とす」形にはしない
（印を足すのは画面の作りが変わるので、この計画の外。Maintenance notes に残す）。

## Current state

- `src/lib/coloring/book.ts` は、ぬりえちょうの保存（IndexedDB）と、あふれた作品を選ぶ純粋な関数 `overflow` を持つ
- `src/lib/coloring/Picker.svelte` は、テンプレートとぬりえちょうの一覧を出す画面（140 行）。ひとりのぬりえと、
  おえかきのもりのみんなでぬりえの親が使う
- `src/lib/games/nurie/Nurie.svelte` は、ひとりのぬりえの根（176 行）。塗るたびに 0.8 秒後に自動で保存する

上限と、あふれた作品を選ぶ関数は `src/lib/coloring/book.ts:4` と `:35-40` にある。

```ts
export const LIMIT = 30;
```

```ts
export function overflow(works: { id: string; updated: number }[], limit = LIMIT): string[] {
  return [...works]
    .sort((a, b) => b.updated - a.updated)
    .slice(limit)
    .map((w) => w.id);
}
```

保存は `src/lib/coloring/book.ts:80-85` にある。保存したあとに全部を読み直し、あふれたぶんを消す。消した数は返さない。

```ts
export async function saveWork(work: Work): Promise<void> {
  await run('readwrite', (s) => void s.put(work));
  const all = await listWorks();
  const drop = overflow(all);
  if (drop.length) await run('readwrite', (s) => void drop.forEach((id) => s.delete(id)));
}
```

保存したばかりの作品は `updated` がいちばん新しいので、消されることはない。消えるのは、30 作品ある状態で
新しい絵を塗り始め、最初の自動保存が走ったとき（`できた！` を押す前）である。

ひとりのぬりえの保存は `src/lib/games/nurie/Nurie.svelte:67-77` にある。自動保存（`paint` の 0.8 秒のタイマー）、
戻す、線を直す、`できた！`、閉じるときの `flush` は、どれもこの `save()` を通る。

```ts
function save(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  const c = current;
  if (!c) return Promise.resolve();
  // 何も塗っていない（ぜんぶ戻した）作品は、ぬりえちょうに置かない
  if (!Object.keys(coloring.colors).length) return removeWork(c.id).catch(() => {});
  const thumb = snapshot(c.art, c.regions, coloring.colors, 200, 'image/jpeg');
  const { id, template, photo, lines } = c;
  return saveWork({ id, template, photo, lines, ...coloring, thumb, updated: Date.now() }).catch(() => {});
}
```

塗る画面を開く `open()` は `src/lib/games/nurie/Nurie.svelte:41-46` にある。

```ts
function open(next: Omit<Current, 'regions'>, start: Coloring, mask = next.art.mask) {
  const regions = label(mask);
  current = { ...next, regions: next.art.kind === 'template' ? hideCovered(regions, next.art.cover) : regions };
  coloring = start;
  screen = 'paint';
}
```

`Picker` へ渡しているところは `src/lib/games/nurie/Nurie.svelte:143-152` にある。

```svelte
<Picker
  {works}
  ontemplate={fromTemplate}
  onwork={fromWork}
  onphoto={() => (screen = 'photo')}
  onremove={async (w) => {
    await removeWork(w.id).catch(() => {});
    await refresh();
  }}
/>
```

`Picker` の props と、ぬりえちょうの見出しは `src/lib/coloring/Picker.svelte:5-20` と `:50-56` にある。
`onback` は「渡されたときだけ出す」任意の props で、足す props もこれにならう。

```ts
let {
  works,
  ontemplate,
  onwork,
  onphoto,
  onremove,
  onback
}: {
  works: Work[];
  ontemplate: (t: Template) => void;
  onwork: (w: Work) => void;
  onphoto: () => void;
  onremove: (w: Work) => void;
  /** 渡されたときだけ「あそびかたに もどる」を出す（みんなでぬりえの親） */
  onback?: () => void;
} = $props();
```

```svelte
  {#if works.length}
    <div class="book-head">
      <h2 class="yuru">ぬりえちょう</h2>
      <button class="pill" aria-pressed={erasing} onclick={() => (erasing = !erasing)}>
        {erasing ? 'けしおわる' : 'けす'}
      </button>
    </div>
```

テストの道具。`src/lib/games/nurie/Nurie.svelte.test.ts:7-18` は `$lib/coloring/book` を差し替えている。
`saveWork` は何も返さない（`undefined`）ので、Nurie で消した数を足すと `NaN` になる。0 を返すように直す。

```ts
const book = vi.hoisted(() => ({
  works: [] as Work[],
  saveWork: vi.fn(async () => {}),
  removeWork: vi.fn(async () => {})
}));
```

`beforeEach`（`:54-58`）は `book.saveWork.mockReset().mockResolvedValue(undefined);` としている。
`Nurie.svelte.test.ts` の `show()` は `press(label)` でボタンを押して待つ。`CanvasStub.svelte` は mount したときに場所 0 を
1 回塗るので、`press('りんご')` のあとには塗った作品がある。`Picker.svelte.test.ts` は `show()` で `Picker` を mount する型。

IndexedDB を node で試す道具（`fake-indexeddb`）は入っていない。あふれる作品を選ぶ決まりは純粋な `overflow` にすでに
分けてあり、`book.test.ts:13-22` が確かめている。`saveWork` に足すのは `return drop.length` の 1 行だけなので、
IndexedDB のテストは足さず、依存も足さない。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く。`.svelte` は 200 行未満
（svelte-vitals `architecture/component-size`。ファイル全体の行数で数える）。テストの名前は日本語の文にする。
ぬりえの画面の字は子ども向けのひらがなで、分かち書きにする（例 `どれを ぬる？`、`この さくひんを けす`）。

## Commands you will need

| Purpose       | Command                                                                                                | Expected on success           |
| ------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------- |
| 足すテスト    | `pnpm exec vitest run src/lib/coloring/Picker.svelte.test.ts src/lib/games/nurie/Nurie.svelte.test.ts` | すべて pass                   |
| book のテスト | `pnpm exec vitest run src/lib/coloring/book.test.ts`                                                   | すべて pass                   |
| 全テスト      | `pnpm test:run`                                                                                        | exit 0                        |
| 型            | `pnpm check`                                                                                           | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint          | `pnpm lint`                                                                                            | exit 0                        |
| svelte-vitals | `pnpm vitals --diff`                                                                                   | 警告 0                        |
| 全部          | `pnpm verify`                                                                                          | exit 0                        |

## Scope

**In scope**

- `src/lib/coloring/book.ts`
- `src/lib/coloring/Picker.svelte`
- `src/lib/coloring/Picker.svelte.test.ts`（テストを足す）
- `src/lib/games/nurie/Nurie.svelte`
- `src/lib/games/nurie/Nurie.svelte.test.ts`（差し替えを直し、テストを足す）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `LIMIT` の値を変えること、消す順番を変えること — 消す決まりはこのまま
- ★（おきにいり）の印を `Work` に足すこと — 画面の作りが変わるので別の計画にする
- `src/lib/games/oekaki-mori/Together.svelte` — みんなでぬりえの「できた！」も `saveWork` を呼んで古い作品を消しうるが、
  ファイルが 199 行で 1 行も足せず、`Picker` に `works={[]}` を渡していて数も出ない。戻り値を使わないので今のまま動く
- `src/lib/games/oekaki-mori/Together.svelte.test.ts` — 差し替えの `saveWork` が `undefined` を返しても、Together は戻り値を見ない
- `fake-indexeddb` を足すこと、`saveWork` の IndexedDB のテストを書くこと
- `CLAUDE.md` — ぬりえの段落に「30 作品まで残り」とあり、決まりは変わらないので直さない

## Git workflow

- ブランチは `advisor/052-nurie-book-keep-works`
- コミットは 1 つでよい。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない
  （例 `Tell kids when the coloring book drops its oldest work`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: `saveWork` が消した数を返すようにする

`src/lib/coloring/book.ts` の `saveWork` を次の形にする。

```ts
/** 上限を超えて消した作品の数を返す（画面で知らせるため） */
export async function saveWork(work: Work): Promise<number> {
  await run('readwrite', (s) => void s.put(work));
  const all = await listWorks();
  const drop = overflow(all);
  if (drop.length) await run('readwrite', (s) => void drop.forEach((id) => s.delete(id)));
  return drop.length;
}
```

**Verify**: `pnpm exec vitest run src/lib/coloring/book.test.ts` → すべて pass（中身は変わらない）。
`grep -n "Promise<number>" src/lib/coloring/book.ts` → `saveWork` の行が 1 つ出る。

### Step 2: `Picker` に数と知らせを出す（テストを先に書く）

`src/lib/coloring/Picker.svelte.test.ts` の `show()` を、props を足せる形にする。

```ts
function show(extra: { dropped?: number } = {}) {
  const props = { works: [work], ontemplate: vi.fn(), onwork: vi.fn(), onphoto: vi.fn(), onremove: vi.fn(), ...extra };
```

（残りの行はそのまま。）そして `describe('Picker', …)` の中に次の 2 つを足す。

```ts
it('ぬりえちょうに、いくつ入っているかと上限を出す', () => {
  const { app } = show();
  expect(document.body.textContent).toContain('1 / 30');
  unmount(app);
});

it('古い作品を消したときだけ、そのことを知らせる', () => {
  const quiet = show();
  expect(document.body.querySelector('[role="status"]')).toBeNull();
  unmount(quiet.app);
  document.body.innerHTML = '';
  const { app } = show({ dropped: 1 });
  expect(document.body.querySelector('[role="status"]')?.textContent?.trim()).toBe(
    'いちばん ふるい さくひんを けしたよ'
  );
  unmount(app);
});
```

**Verify**: `pnpm exec vitest run src/lib/coloring/Picker.svelte.test.ts` → 足した 2 つが落ちる（まだ作っていない）。

`src/lib/coloring/Picker.svelte` を次のように直す。

1. 1 行目の `import type { Work } from './book';` を `import { LIMIT, type Work } from './book';` にする
2. props に `dropped` を足す（分割代入にも型にも足す。既定は 0）

   ```ts
       /** さっき保存したときに、あふれて消した古い作品の数 */
       dropped?: number;
   ```

3. 見出しの `<h2 class="yuru">ぬりえちょう</h2>` のすぐ後ろに数を足す

   ```svelte
   <span class="count">{works.length} / {LIMIT}</span>
   ```

4. `<div class="book-head">…</div>` の閉じタグのすぐ後ろ（`<ul class="grid">` の前）に知らせを足す

   ```svelte
   {#if dropped}<p class="note" role="status">いちばん ふるい さくひんを けしたよ</p>{/if}
   ```

5. `<style>` に 2 つ足す。`.book-head` は `justify-content: space-between` なので、数は見出しのすぐ右に寄せる

   ```css
   .count {
     margin-right: auto;
     margin-left: 8px;
     font-weight: 800;
   }

   .note {
     font-weight: 800;
     color: var(--p2-deep);
   }
   ```

`--p2-deep` は `src/app.css:12` の `:root` にある赤（`Backup.svelte` のエラーの字と同じ）。

知らせは `{#if works.length}` の中に置くので、ぬりえちょうが空のときは出ない（消したなら必ず 30 作品ある）。

**Verify**: `pnpm exec vitest run src/lib/coloring/Picker.svelte.test.ts` → 4 つとも pass。
`wc -l src/lib/coloring/Picker.svelte` → 199 以下（今 140 行、足すのは 20 行ほど）。

### Step 3: ひとりのぬりえで消した数をためて `Picker` へ渡す（テストを先に書く）

`src/lib/games/nurie/Nurie.svelte.test.ts` の差し替えを、消した数を返す形に直す。

1. `:9` の `saveWork: vi.fn(async () => {}),` を `saveWork: vi.fn(async () => 0),` にする
2. `beforeEach` の `book.saveWork.mockReset().mockResolvedValue(undefined);` を
   `book.saveWork.mockReset().mockResolvedValue(0);` にする
3. `:65` の `book.saveWork.mockReturnValue(new Promise(() => {}));` は型が合わなくなったら
   `new Promise<number>(() => {})` にする

`describe('Nurie', …)` に次の 2 つを足す。

```ts
it('保存で古い作品を消したら、えらぶ画面でそのことを知らせる', async () => {
  // 知らせはぬりえちょうの見出しの下に出るので、ぬりえちょうに作品を置いておく
  book.works = [{ id: 'old', template: 'apple', colors: { 0: '#f00' }, history: [], thumb: '', updated: 1 }];
  book.saveWork.mockResolvedValue(1);
  const { app, target, press } = await show();
  await press('りんご');
  await press('できた！');
  expect(target.textContent).toContain('いちばん ふるい さくひんを けしたよ');
  unmount(app);
});

it('消さなかったときは知らせない', async () => {
  const { app, target, press } = await show();
  await press('りんご');
  await press('できた！');
  expect(target.textContent).not.toContain('さくひんを けしたよ');
  unmount(app);
});
```

`Picker` の知らせは `{#if works.length}` の中にあり、差し替えの `listWorks` は `book.works` を返す。そのため 1 つめのテストは
頭で `book.works` に作品を 1 つ置く。

**Verify**: `pnpm exec vitest run src/lib/games/nurie/Nurie.svelte.test.ts` → 1 つめが落ち、ほかは pass。

`src/lib/games/nurie/Nurie.svelte` を次のように直す。

1. `let timer …` の行の下に状態を 1 つ足す

   ```ts
   /** この絵を塗るあいだの保存で、あふれて消した古い作品の数。えらぶ画面に戻ったときに知らせる */
   let dropped = $state(0);
   ```

2. `open()` の中の `screen = 'paint';` の前に `dropped = 0;` を足す（新しく塗り始めたら前の知らせは消す）
3. `save()` の最後の行を次にする

   ```ts
   return saveWork({ id, template, photo, lines, ...coloring, thumb, updated: Date.now() }).then(
     (n) => void (dropped += n),
     () => {}
   );
   ```

4. `<Picker` に `{dropped}` を足す（`{works}` の次の行）

自動保存は 0.8 秒のタイマーなので、消すのはたいてい塗っている途中の保存である。`dropped` は塗っているあいだの保存の
ぶんを全部ためて、`できた！` で戻ったえらぶ画面に出す。

**Verify**: `pnpm exec vitest run src/lib/games/nurie/Nurie.svelte.test.ts` → すべて pass（もとの 4 つと足した 2 つ）。
`wc -l src/lib/games/nurie/Nurie.svelte` → 199 以下（今 176 行）。

### Step 4: 全体の確かめ

**Verify**: `pnpm verify` → exit 0（`pnpm check` は `0 ERRORS 0 WARNINGS`、svelte-vitals の 200 行の決まりを含む）。

## Test plan

- `Picker.svelte.test.ts` に 2 つ（数を出す・消したときだけ知らせる）
- `Nurie.svelte.test.ts` に 2 つ（消したら知らせる・消さなければ知らせない）。差し替えの `saveWork` は 0 を返す形に直す
- `overflow` の決まりは `book.test.ts` の既存の 2 つが確かめているので足さない
- `pnpm exec vitest run src/lib/coloring/ src/lib/games/nurie/ src/lib/games/oekaki-mori/Together.svelte.test.ts` → すべて pass

## Done criteria

- [ ] `grep -n "saveWork(work: Work): Promise<void>" src/lib/coloring/book.ts` が何も返さない
- [ ] Commands の「足すテスト」が pass し、足した 4 つを含む（`1 / 30` と `いちばん ふるい さくひんを けしたよ` を確かめる）
- [ ] `wc -l src/lib/coloring/Picker.svelte src/lib/games/nurie/Nurie.svelte` がどちらも 199 以下
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない（`package.json` と `pnpm-workspace.yaml` を含む）
- [ ] `plans/README.md` の 052 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- `book.ts` の `saveWork`・`overflow`・`LIMIT`、`Nurie.svelte` の `save()`・`open()` が上の抜粋と違う
- `Work` にすでに ★ やおきにいりの印がある（決める前提が変わるので報告する）
- `saveWork` を呼ぶところが `Nurie.svelte` と `Together.svelte` のほかにもある
  （`grep -rn "saveWork" src --include='*.svelte' --include='*.ts'` で確かめる）
- 型を合わせるために `Together.svelte` を変えたくなった
- どれかの `.svelte` が 200 行を超えた（行を詰めるために中身を変えない。報告する）
- テストのために `fake-indexeddb` などの依存を足したくなった

## Maintenance notes

- 30 作品を超えたら古いものから消す決まりは残っている。作品を守りたくなったら、らくがきパレードのずかん
  （`src/lib/games/doodle-worm/stock.ts`、★ のない古い絵から落とす）にならって `Work` に印を足すのが次の手
- みんなでぬりえ（`Together.svelte`）の「できた！」でも古い作品が消えうるが、知らせは出ない。Together に行の余裕ができたら、
  ひとりのぬりえと同じく知らせるかを考える
- 実機では、30 作品ある状態で新しい絵を塗って「できた！」を押し、えらぶ画面に知らせが出て「30 / 30」のままであることを見る
