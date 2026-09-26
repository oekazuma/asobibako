# Plan 033: 写真とずかんの絵を iPad の「写真」に保存できるようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 22c2720..HEAD -- src/lib/games/pet-house/Album.svelte src/lib/games/doodle-worm/Stock.svelte src/lib/games/doodle-worm/paint.ts src/lib/components/Backup.svelte`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                        |
| ---------- | --------------------------------------------------------- |
| Priority   | P1                                                        |
| Effort     | S                                                         |
| Risk       | LOW（見る・書き出すだけの機能を足す。保存の形は変えない） |
| Depends on | none                                                      |
| Category   | direction                                                 |
| Planned at | commit `22c2720`, 2026-09-26                              |

## Why this matters

2026-09-26、iPad のホーム画面アプリで localStorage が丸ごと消え、子どもが描いたらくがきパレードのずかんも失った。
いま子どもの作品（わんにゃんハウスの写真 6 枚まで、ずかんの絵 48 枚まで）の置き場所は、localStorage とその控え
（IndexedDB）だけで、アプリの外へ出す道がない。`src/app.css` が全体に `-webkit-touch-callout: none` をかけているので、
iOS の「画像を長押しして保存」も使えない。

共有シート（`navigator.share({ files })`）に画像を渡せば、iPad では「画像を保存」で写真アプリへ入り、AirDrop もできる。
写真アプリに逃がした作品は、アプリの記録が消えても残る。この計画のあと、アルバムの大きな写真と、ずかんの絵の
それぞれに「ほぞん」ができる。

## Current state

- `src/lib/games/pet-house/Album.svelte`（120 行）— しゃしん・スタンプのタブ。写真を押すと `big` に番号が入り、
  大きな写真と「もどる」を出す（`:24-28`）

```svelte
{:else if big !== null && shots[big]}
  <div class="big">
    <img src={shots[big]} width="480" height="640" alt="{big + 1}まいめの しゃしん" />
    <button class="pill" onclick={() => (big = null)}>もどる</button>
  </div>
```

写真は `world3d.ts` の `snapshot()` が作る JPEG の data URL（`c.toDataURL('image/jpeg', 0.8)`、長い辺 512px まで）。

- `src/lib/games/doodle-worm/Stock.svelte`（151 行）— ずかんのシート。`erasing` のあいだは絵を押すと消え、ふだんは呼ぶ

```text
  /** 押し間違えて消さないよう、「けす」を押したあいだだけ絵を押すと消える */
  let erasing = $state(false);
...
    <button class="pill" class:p2={erasing} aria-pressed={erasing} onclick={() => (erasing = !erasing)}>
      {erasing ? 'けしおわる' : 'けす'}
    </button>
...
          <button
            class="card"
            class:erasing
            aria-label={erasing ? 'この えを けす' : 'この えを よぶ'}
            onclick={() => (erasing ? onremove(d) : oncall(d))}
          >
            <img src={portrait(d.strokes)} width="160" height="160" alt="" />
          </button>
```

CSS の `.card.erasing::after` が赤い ✕ を重ねる（`:104-118`）。props は 7 つ（svelte-vitals が info で「多い」と言うので、
props は増やさない）。

- `src/lib/games/doodle-worm/paint.ts:130-157` — `portrait(strokes)` が 160px の透明な PNG の data URL を作り、
  strokes 配列ごとに WeakMap に覚える。中身は `hatch(strokes)` → `c.age = 1` → 枠に合わせた `setTransform` →
  `creature(ctx, c)` → `canvas.toDataURL()`。

- 共有の見本は `src/lib/components/Backup.svelte:29-36`

```ts
function share() {
  error = '';
  // Safari はユーザー操作のハンドラ内で同期に呼ばれた share() しか通さないため、await を挟まない
  navigator.share({ files: [backupFile(version)], title: 'あそびばこ の記録' }).then(done, (e: unknown) => {
    if (e instanceof Error && e.name === 'AbortError') return;
    error = '共有できませんでした。「記録を書き出す」をお使いください。';
  });
}
```

共有できない端末の書き出しは同じファイルの `save()`（`URL.createObjectURL` → `<a download>` → `click()`）。

- アイコンは `src/lib/icons.ts` に `download` と `share` がある。DOM では `<Icon name="download" size="20px" />`。
- 画面の文字は子ども向けのひらがなと分かち書き（例「この えを けす」）。絵文字は使わない。コメントは日本語で WHY だけ。
- テストの置き場所は `vite.config.ts` の 2 project。`src/**/*.svelte.test.ts` は happy-dom の `dom`、それ以外の
  `src/**/*.test.ts` は node の `unit`。happy-dom の canvas は `getContext('2d')` が null を返すので、絵を作る関数は
  テストでは `vi.mock` で差し替える。

## Commands you will need

| Purpose             | Command                                                                                                                                  | Expected on success  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                                                                                                         | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/share.test.ts src/lib/games/pet-house/Album.svelte.test.ts src/lib/games/doodle-worm/Stock.svelte.test.ts` | all pass             |
| 全テスト            | `pnpm test:run`                                                                                                                          | all pass             |
| 型                  | `pnpm check`                                                                                                                             | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                                                                                              | exit 0               |
| vitals              | `pnpm vitals --diff`                                                                                                                     | exit 0               |

## Scope

In scope は次のファイル。

- `src/lib/share.ts`（新規）、`src/lib/share.test.ts`（新規）
- `src/lib/games/pet-house/Album.svelte`、`src/lib/games/pet-house/Album.svelte.test.ts`（新規）
- `src/lib/games/doodle-worm/Stock.svelte`、`src/lib/games/doodle-worm/Stock.svelte.test.ts`（新規）
- `src/lib/games/doodle-worm/paint.ts`（`portrait` の中身を大きさを選べる関数に分けるだけ）
- `CLAUDE.md`（らくがきパレードとわんにゃんハウスの段落に 1 文ずつ）

Out of scope は次のとおり。

- `src/app.css` の `-webkit-touch-callout: none`（長押しメニューを封じるのはアプリ全体の方針）
- `Backup.svelte` の共有（書き出しの流れは変えない。新しい `share.ts` へ寄せ直すこともしない）
- 写真とずかんの保存の形（localStorage のキーと中身）

## Git workflow

- ステップごとにコミットしてよい。メッセージは英語の命令形 1 行（例 `Save pet photos and doodles to the iPad's Photos`）。
  末尾に Co-Authored-By を 1 行
- push しない

## Steps

### Step 1: 画像を共有シートへ渡す小さな関数を作る

`src/lib/share.ts` に 2 つの関数を置く。

```ts
/** data URL を File にする。共有シートは同期に呼ばないと通らないので、fetch などの await を使わずに組み立てる */
export function dataUrlFile(url: string, name: string): File;

/**
 * 画像を端末へ出す。共有シートを使える端末では「画像を保存」で写真アプリへ入れられ、無ければダウンロードする。
 * Safari はユーザー操作のハンドラ内で同期に呼ばれた share() しか通さないので、押したときの処理の中でそのまま呼ぶ
 */
export function saveImage(url: string, name: string): void;
```

- `dataUrlFile`: `url` を `,` で頭と中身に分け、頭の `data:` と `;base64` のあいだを型にし、`atob` で中身をバイト列にして
  `new File([bytes], name, { type })` を返す
- `saveImage`: `url` が空なら何もしない。`dataUrlFile` で File を作り、`navigator.canShare?.({ files: [file] })` が true なら
  `navigator.share({ files: [file] }).catch(() => {})`（やめた・失敗は黙る。子どもの画面にエラーは出さない）。
  そうでなければ `Backup.svelte` の `save()` と同じく `URL.createObjectURL(file)` → `<a download={name}>` → `click()` →
  1 秒後に `revokeObjectURL`

`src/lib/share.test.ts`（node の unit project）に 3 本。

1. `dataUrlFile('data:image/png;base64,iVBORw0KGgo=', 'a.png')` の `type` が `image/png`、`name` が `a.png`、
   `size` が 8（`iVBORw0KGgo=` は 8 バイト）
2. `vi.stubGlobal('navigator', { canShare: () => true, share: vi.fn(async () => {}) })` で `saveImage(url, 'a.png')` を呼ぶと
   `share` が 1 回、`files[0].name === 'a.png'` で呼ばれる
3. `saveImage('', 'a.png')` は `share` を呼ばない

**Verify**: `pnpm exec vitest run src/lib/share.test.ts` → 3 passed

### Step 2: ずかんの絵を大きく描けるようにする

`paint.ts` の `portrait` の中身を `function draw(strokes: Stroke[], size: number, background?: string): string` に移し、
`portrait(strokes)` は WeakMap の覚えごとを残したまま `draw(strokes, 160)` を呼ぶ。`background` があれば、
`setTransform` の前に `ctx.fillStyle = background; ctx.fillRect(0, 0, size, size)` で塗る。

新しく `export const picture = (strokes: Stroke[]) => draw(strokes, 1024, '#fff');` を足す。JSDoc に
「写真アプリに入れる絵。透けていると写真アプリで黒く見えるので白く塗る。保存するときだけ作るので覚えない」と書く。

**Verify**: `pnpm check` → 0 errors。`pnpm exec vitest run src/lib/games/doodle-worm` → all pass

### Step 3: アルバムの大きな写真に「ほぞん」を足す

`Album.svelte` の `.big` の中で「もどる」の前に次のボタンを足す（`.big` は縦並びなので、2 つのボタンを横に並べる
`<div class="row">` で包み、CSS に `.row { display: flex; gap: 10px; }` を足す）。

```svelte
<button class="pill" onclick={() => saveImage(shots[big!], `asobibako-pet-${big! + 1}.jpg`)}>
  <Icon name="download" size="20px" />ほぞん
</button>
```

（`big` は `{:else if big !== null && shots[big]}` の中なので null ではない。`!` を使わずに済む書き方があればそちらでよい。）
`saveImage` は `$lib/share` から import する。

`src/lib/games/pet-house/Album.svelte.test.ts` を作る（見本は `src/lib/components/Backup.svelte.test.ts` の mount と後片付け）。
`vi.mock('$lib/share', () => ({ saveImage: vi.fn() }))`。`save` は `{ photos: ['data:image/jpeg;base64,AAAA'] }` を含む
最小の形（型は `as unknown as Save` でよい。`Stamps` が読む項目で落ちるなら、`newSave(Date.now())` に photos を入れたものにする）。
写真のボタン（`.thumb`）を押す → 「ほぞん」を押す → `saveImage` が `('data:image/jpeg;base64,AAAA', 'asobibako-pet-1.jpg')` で
呼ばれる、を確かめる。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/Album.svelte.test.ts` → pass。`wc -l src/lib/games/pet-house/Album.svelte` → 200 未満

### Step 4: ずかんに「ほぞん」のモードを足す

`Stock.svelte` の `erasing` を `let mode = $state<'call' | 'erase' | 'save'>('call');` に置き換え、次のようにする。

- ツールの列の「けす」の隣に、同じ形のトグルを足す。`mode === 'save'` のとき `class:gold`、文字は
  `mode === 'save' ? 'ほぞんおわる' : 'えを ほぞん'`、押すと `mode = mode === 'save' ? 'call' : 'save'`。
  「けす」のトグルも `mode` で書き直す（`'erase'` と `'call'` を行き来する）
- 絵のボタンは `onclick` で `mode` に応じて `onremove(d)` / `saveImage(picture(d.strokes), name)` /
  `oncall(d)` を呼ぶ。`name` は `asobibako-doodle-${i + 1}.png`（テンプレート文字列）。`aria-label` は「この えを けす」「この えを ほぞん」「この えを よぶ」。`{#each}` に添え字 `i` を足す
- `class:erasing` は `class:erasing={mode === 'erase'}` にする。保存のモードの印に `class:saving={mode === 'save'}` を足し、
  CSS で `.card.saving` に金色のふち（`outline: 3px solid var(--gold); outline-offset: 2px;`）を付ける
- props は増やさない（`saveImage` と `picture` は Stock の中で import する）

`src/lib/games/doodle-worm/Stock.svelte.test.ts` を作る。`vi.mock('$lib/share', () => ({ saveImage: vi.fn() }))` と
`vi.mock('./paint', () => ({ portrait: () => 'data:image/png;base64,AA==', picture: () => 'data:image/png;base64,BB==' }))`。
2 本。

1. 「えを ほぞん」を押してから絵を押すと、`saveImage('data:image/png;base64,BB==', 'asobibako-doodle-1.png')` が呼ばれ、
   `oncall` は呼ばれない
2. ふだん（何も押さない）は絵を押すと `oncall` が呼ばれ、`saveImage` は呼ばれない

**Verify**: `pnpm exec vitest run src/lib/games/doodle-worm/Stock.svelte.test.ts` → 2 passed。
`wc -l src/lib/games/doodle-worm/Stock.svelte` → 200 未満

### Step 5: CLAUDE.md に今の仕様を 1 文ずつ足す

- らくがきパレードの段落の「ずかんのシート（…）から絵を呼ぶ・消す・…」の列に「写真アプリへ保存する（`src/lib/share.ts` の
  `saveImage`。白地に描き直した大きな絵を共有シートへ渡す）」を加える
- わんにゃんハウスの段落の写真の説明（「保存は `asobibako:pet-house`（写真は `asobibako:pet-house:photos`）」のあたり）に
  「アルバムの大きな写真は「ほぞん」で共有シートから写真アプリへ入れられる」を加える

経緯は書かない。

**Verify**: `grep -c "saveImage" CLAUDE.md` → 1 以上。`pnpm lint` → exit 0

### Step 6: 全体の確認

**Verify**: `pnpm test:run` → all pass。`pnpm check` → 0 errors。`pnpm lint` → exit 0。`pnpm vitals --diff` → exit 0

## Test plan

- `src/lib/share.test.ts` 3 本（Step 1）
- `src/lib/games/pet-house/Album.svelte.test.ts` 1 本（Step 3）
- `src/lib/games/doodle-worm/Stock.svelte.test.ts` 2 本（Step 4）
- 共有シートそのものは iPad の実機でしか確かめられない。レビュー担当が「実機で 写真 → ほぞん → 画像を保存 → 写真アプリに入る」を
  利用者に申し送る

## Done criteria

- [ ] 対象テストの 6 本が pass
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm vitals --diff` が通る
- [ ] `Album.svelte` と `Stock.svelte` がどちらも 200 行未満で、Stock の props は 7 つのまま
- [ ] `git diff --name-only 22c2720` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- 抜粋と今のコードが違う
- happy-dom で `Album.svelte` を mount できない（`Stamps` などの子が three や canvas を要する）。そのときはテストの作り方を報告して聞く
- Stock の props を増やさないとできない
- markuplint が新しいボタンの組み方で落ち、`.markuplintrc.jsonc` を変えないと通らない

## Maintenance notes

- 作品を足すとき（新しいゲームの絵など）は `saveImage` を使えば同じ流れで写真アプリへ出せる
- `saveImage` は押したときの処理の中で同期に呼ぶこと。間に `await` を挟むと Safari が共有シートを出さない
- 1024px の絵は保存のたびに作る（覚えない）。ずかんの一覧の 160px の絵とは別もの
