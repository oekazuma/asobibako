# Plan 053: わんにゃんハウスの読めない保存を、新しく始める前に別のキーへ残す

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/games/pet-house/engine.ts src/lib/games/pet-house/engine.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。`CLAUDE.md` は毎日変わるので drift check に
> 含めない。Step 3 の前に、直す文がそのまま残っているかを grep で確かめる。

## Status

| 項目       | 値                                                                        |
| ---------- | ------------------------------------------------------------------------- |
| Priority   | P2                                                                        |
| Effort     | S                                                                         |
| Risk       | LOW（`loadSave()` が null を返す道に、写しを 1 回書くだけ。形は変えない） |
| Depends on | none                                                                      |
| Category   | bug                                                                       |
| Planned at | commit `36cc037`, 2026-10-14                                              |

## Why this matters

わんにゃんハウス（`pet-house`、開発は終えたゲーム）は、ペット・コイン・持ちものを localStorage の `asobibako:pet-house` に
1 つの JSON で持つ。保存が読めない（JSON が壊れている、中身が物でない、直す途中で例外が出る）と `loadSave()` は null を返し、
`Session` はそのまま新しい保存で始める。`Session` は始めてから 1 秒ほどで新しい保存を書くので、壊れた中身は消える。
さらに自動バックアップ（`src/lib/mirror.ts`）が新しい中身で IndexedDB の控えを上書きするので、控えからも戻せなくなる。
つまり 1 度読めなかっただけで、全部のペットとコインが取り戻せなくなる。

読めなかった中身を、新しく始める前に `asobibako:pet-house:broken` へ 1 つだけ写しておけば、大人がバックアップの書き出しから
取り出して直せる。アプリについての「さいごのエラー」にも 1 行残し、何が起きたかに気づけるようにする。

## Current state

直すファイルは次の 2 つ（と CLAUDE.md の 1 文）。

- `src/lib/games/pet-house/engine.ts` — 保存の読み書きとステータスの計算。`loadSave()` が保存を読む
- `src/lib/games/pet-house/engine.test.ts` — engine のテスト。先頭に `// @vitest-environment happy-dom` があり localStorage が使える

保存のキーは `src/lib/games/pet-house/engine.ts:80-85` にある。

```ts
export const STORAGE_KEY = 'asobibako:pet-house';
/**
 * 写真は本体と別のキーに置く。本体は操作のたびに書くので軽く保ち、
 * 写真で容量があふれてもペットとお金の保存は巻き添えにしない
 */
export const PHOTOS_KEY = 'asobibako:pet-house:photos';
```

`loadSave()` は `src/lib/games/pet-house/engine.ts:193-240`。読めないときは 3 か所で null を返す（中ほどは省いた）。

```ts
/** 読めない・壊れているときは null。形が古いだけなら足りない項目を補って返す */
export function loadSave(): Save | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    if (text === null) return null;
    const raw: unknown = JSON.parse(text);
    if (!isObj(raw)) return null;
    const now = Date.now();
    // …（項目ごとに補って Save を組み立てて return する）
  } catch {
    return null;
  }
}
```

`loadSave()` を呼ぶのは 2 か所。

- `src/lib/games/pet-house/meta.ts:18-19` の `warmShapes()`（タイトルのあいだに、飼っている種類の形を先に読む）
- `src/lib/games/pet-house/session.svelte.ts:68` の `save: Save = $state(loadSave() ?? newSave(Date.now()));`

同じ起動で 2 回呼ばれるので、写しは「まだ無いときだけ書く」にしないと、2 回めが 1 回めと同じ中身を書くだけでなく、
次の起動で別の壊れ方をしたときに最初の写しを上書きしてしまう。

新しい保存が書かれる時刻は次のとおり。`Session` の constructor の終わりで `this.#dirty = true`
（`session.svelte.ts:186`）にし、フレームごとの `src/lib/games/pet-house/session.svelte.ts:434` で書く。

```ts
if ((this.#dirty && this.#now - this.#wrote > 1) || this.#now - this.#wrote > 30) this.#write();
```

画面が隠れたとき（`session.svelte.ts:243-244` の `#onVisibility`）と閉じるとき（`dispose()` の `this.#write(false)`）にも書く。

### バックアップと控えへの影響（決めたこと）

`src/lib/backup.ts` は `asobibako:` で始まるキーを全部書き出し、`EXCLUDED`（端末ごとの控え）だけを除く。`NOT_RECORDS` に
入っていないキーは「記録がある」と数える（`hasRecords()`）。`src/lib/backup.ts:13-14` と `src/lib/backup.ts:40-45` にある。

```ts
const EXCLUDED = new Set([LAST_ERROR_KEY, GATE_KEY, 'asobibako:graphics', RESTORE_PENDING_KEY]);
```

```ts
const backedUp = (k: string) => k.startsWith(PREFIX) && !EXCLUDED.has(k);
const keys = () => Object.keys(localStorage).filter(backedUp);

/** 書き出して残す記録が 1 つでもあるか */
export const hasRecords = () => keys().some((k) => !NOT_RECORDS.has(k));
```

`asobibako:pet-house:broken` は `backup.ts` を変えずに、書き出しにも控えにも入れ、記録として数える。理由は次の 3 つ。

1. 書き出しと IndexedDB の控え（`mirror.ts` の `snapshot()` は `exportAll()` の JSON を写す）に入るので、大人がファイルから取り出せ、
   iOS が localStorage を空にしても控えから戻る
2. 写しを書くときは、1 秒ほどで新しい `asobibako:pet-house` も書かれる。どちらも記録なので、`hasRecords()` の答えはこのキーが
   あっても無くても変わらず、`mirror.ts` の「記録が 1 つもなければ控えから戻す」の判断にも影響しない
3. 「さいごのエラー」の `asobibako:last-error` は `EXCLUDED` なので書き出されないが、写しそのものは書き出されるので失われない

### 使う道具

`src/lib/last-error.ts` の `remember(message)` は、最後のエラーを 1 件だけ localStorage に残し、アプリについて
（`AppUpdate.svelte`）に「さいごのエラー」として出す。中で try/catch しているので、どこから呼んでも投げない。
`session.svelte.ts` も容量不足のときに `remember('わんにゃんハウスの記録を保存できませんでした（容量）')` を使っている。

既存のテスト `src/lib/games/pet-house/engine.test.ts:72-92` の最後は、読めない JSON で null を返すことを見ている。

```ts
localStorage.setItem(STORAGE_KEY, '{oops');
expect(loadSave()).toBeNull();
```

このテストの describe（`engine.test.ts:46-47`）は `beforeEach(() => localStorage.clear())` なので、足すテストもこの describe に入れる。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く（変更履歴やチケット番号は書かない）。テストの名前は日本語の文にする。

## Commands you will need

| Purpose    | Command                                                       | Expected on success           |
| ---------- | ------------------------------------------------------------- | ----------------------------- |
| 足すテスト | `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts` | すべて pass                   |
| 全テスト   | `pnpm test:run`                                               | exit 0                        |
| 型         | `pnpm check`                                                  | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint       | `pnpm lint`                                                   | exit 0                        |
| 全部       | `pnpm verify`                                                 | exit 0                        |

## Scope

**In scope**

- `src/lib/games/pet-house/engine.ts`
- `src/lib/games/pet-house/engine.test.ts`（テストを足す）
- `CLAUDE.md`（わんにゃんハウスの段落の保存の 1 文だけ）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/backup.ts` と `src/lib/mirror.ts` — 上の「決めたこと」のとおり変えない。`NOT_RECORDS` や `EXCLUDED` に足さない
- `src/lib/games/pet-house/session.svelte.ts` と `meta.ts` — 直すのは共通の `loadSave()` だけ。呼ぶ側は変えない
- 写しから自動で戻す仕組みや、写しを見せる画面 — 開発を終えたゲームなので作らない
- `loadPhotos()` — 写真は別のキーで、読めなくても写真が空になるだけ（書くまで元のキーは残る）

## Git workflow

- ブランチは `advisor/053-pet-house-keep-unreadable-save`
- コミットは 1 つでよい。英語の命令形 1 文（例 `Keep an unreadable pet-house save under its own key before starting over`）。Co-Authored-By などの trailer は付けない
- push しない（`main` への push は本番に配信される）

## Steps

### Step 1: 失敗するテストを先に書く

`src/lib/games/pet-house/engine.test.ts` の import に `BROKEN_KEY` を足し（`./engine` から。並びは大文字小文字を見ないアルファベット順なので、
`bathe` と `brush` のあいだに置く）、describe `'pet-house engine'` の中、`'保存を往復でき、壊れた値は補い、読めない JSON は null'` の
すぐ後ろに次の 2 つを足す。

```ts
it('読めない保存は新しく始める前に broken のキーへ写し、次に読めなくても最初の写しを残す', () => {
  localStorage.setItem(STORAGE_KEY, '{oops');
  expect(loadSave()).toBeNull();
  expect(localStorage.getItem(BROKEN_KEY)).toBe('{oops');
  expect(localStorage.getItem(STORAGE_KEY)).toBe('{oops');

  localStorage.setItem(STORAGE_KEY, '"text"');
  expect(loadSave()).toBeNull();
  expect(localStorage.getItem(BROKEN_KEY)).toBe('{oops');
});

it('保存が無いときと読める保存のときは broken のキーを作らない', () => {
  expect(loadSave()).toBeNull();
  const { save } = withPet();
  writeSave(save);
  expect(loadSave()).not.toBeNull();
  expect(localStorage.getItem(BROKEN_KEY)).toBeNull();
});
```

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts` → `BROKEN_KEY` がまだ無いので型か値で落ちる
（`'読めない保存は…'` が fail）。ほかのテストは pass のまま。

### Step 2: `loadSave()` が null を返す前に写しを残す

`src/lib/games/pet-house/engine.ts` を次のようにする。

1. 先頭の import に `import { remember } from '$lib/last-error';` を足す
2. `PHOTOS_KEY` の下に次を足す

```ts
/** 読めなかった保存の写し。新しく始めると 1 秒ほどで本体が上書きされ、自動バックアップの控えも新しい中身になるので、大人が直せるよう残す */
export const BROKEN_KEY = 'asobibako:pet-house:broken';
```

3. `loadSave()` を次の形にする（中ほどの組み立ては今のまま）。`text` を `try` の外で宣言し、読めない 2 か所と `catch` で
   `keepBroken(text)` を返す

```ts
export function loadSave(): Save | null {
  let text: string | null = null;
  try {
    text = localStorage.getItem(STORAGE_KEY);
    if (text === null) return null;
    const raw: unknown = JSON.parse(text);
    if (!isObj(raw)) return keepBroken(text);
    const now = Date.now();
    // …（今のまま）
  } catch {
    return keepBroken(text);
  }
}

/** 最初に読めなかった中身だけを残す。写しがあるときに上書きすると、直せたかもしれない古いほうを失う */
function keepBroken(text: string | null): null {
  try {
    if (text === null || localStorage.getItem(BROKEN_KEY) !== null) return null;
    localStorage.setItem(BROKEN_KEY, text);
    remember(`わんにゃんハウスの記録が読めなかったので ${BROKEN_KEY} に残しました`);
  } catch {
    // 写せなくても、新しく始めるのは止めない
  }
  return null;
}
```

`keepBroken` は `loadSave` の直後に置く。`localStorage.getItem` そのものが投げたとき（使えない端末）は `text` が null のまま
なので、何も書かずに null を返す。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts` → すべて pass（足した 2 つを含む）。
`pnpm check` → `0 ERRORS 0 WARNINGS`。

### Step 3: CLAUDE.md の保存の文に写しを足す

まず次の grep が 1 行を返すことを確かめる。返さなければ STOP。

```bash
grep -c '（写真は `asobibako:pet-house:photos`）で、閉じていたあいだの減りは' CLAUDE.md
```

期待する出力は `1`。

その文の「（写真は `asobibako:pet-house:photos`）で、」の直後に次を差し込む（文の残りは変えない）。

```text
読めない保存は新しく始める前に `asobibako:pet-house:broken` へ 1 つだけ写して（すでに写しがあれば残す。書き出しと控えにも入る）、
```

差し込んだあとの文は「保存は `asobibako:pet-house`（写真は `asobibako:pet-house:photos`）で、読めない保存は新しく始める前に
`asobibako:pet-house:broken` へ 1 つだけ写して（すでに写しがあれば残す。書き出しと控えにも入る）、閉じていたあいだの減りは…」となる。
CLAUDE.md の段落は 1 行が長いので、改行を足さずに同じ行の中で差し込む。

**Verify**: `grep -c 'asobibako:pet-house:broken' CLAUDE.md` → `1`。`pnpm lint` → exit 0。

### Step 4: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。`git status --short` → in scope のファイルだけが変わっている。

## Test plan

- `engine.test.ts` に 2 つ足す。読めない JSON と物でない JSON の両方で写しを作り、2 度めは最初の写しを上書きしないこと、
  保存が無いときと読める保存のときは写しを作らないこと
- 型にするのは同じファイルの `'保存を往復でき、壊れた値は補い、読めない JSON は null'`
- 直す途中の例外（`repairPet` などが投げる）で `catch` に入る道は、上の 2 つと同じ `keepBroken` を通るので別のテストは書かない
- `pnpm exec vitest run src/lib/games/pet-house/` → すべて pass

## Done criteria

- [ ] `pnpm exec vitest run src/lib/games/pet-house/engine.test.ts` が pass し、足した 2 つを含む
- [ ] `grep -c "keepBroken(text)" src/lib/games/pet-house/engine.ts` が `2`（`loadSave` の中の物でないときと `catch`）
- [ ] `grep -c 'asobibako:pet-house:broken' CLAUDE.md` が `1`
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない（`src/lib/backup.ts`・`src/lib/mirror.ts`・`session.svelte.ts` を含む）
- [ ] `plans/README.md` の 053 の行を更新した

## STOP 条件

- `loadSave()` の抜粋（3 か所の `return null` と `catch`）が今のコードと違う
- `loadSave()` を呼ぶ場所が `meta.ts` と `session.svelte.ts` のほかにもある（`grep -rn "loadSave" src` で確かめる。テストは除く）
- `src/lib/backup.ts` の `EXCLUDED` か `NOT_RECORDS` に、すでに `pet-house` を含むキーがある（決めたことの前提が変わる）
- 足したテスト以外の既存テストが落ち、直すには既存テストの期待を変える必要がある
- Step 3 の grep が `1` を返さない

## Maintenance notes

- 写しはアプリの中からは消さない。大人がバックアップのファイルの `data["asobibako:pet-house:broken"]` を取り出して直したら、
  直した中身を `asobibako:pet-house` に入れたファイルで読み込み直す。写しのキーは読み込みで上書き・削除される（`importAll` は全部置き換え）
- 写しがある端末でまた読めなくなっても、2 つめは残らない。最初の壊れ方のほうが、遊んだ記録が多く残っている見込みが高いため
- ほかのゲームの保存にも同じ「読めなければ新しく始める」形がある。同じことをするなら、そのゲームの読み込みの関数に同じ形で足す
  （共通部品にはしない。ゲームごとにキーと読み方がちがう）
