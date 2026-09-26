# Plan 026: ペットの形の控えを、止まらず・デプロイのたびに捨てないようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 4c06cf0..HEAD -- vite.config.ts src/app.d.ts src/lib/games/pet-house/models.ts src/lib/games/pet-house/meta.ts src/lib/games/pet-house/models.test.ts`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                                    |
| ---------- | ------------------------------------------------------------------------------------- |
| Priority   | P1                                                                                    |
| Effort     | S                                                                                     |
| Risk       | MED（版の決め方を誤ると古い形のまま描かれる。形を作るファイルは全部ハッシュに入れる） |
| Depends on | none                                                                                  |
| Category   | bug / perf                                                                            |
| Planned at | commit `4c06cf0`, 2026-09-26                                                          |

## Why this matters

わんにゃんハウスは、組み立てに 1 種類あたり数百 ms かかるペットの形を IndexedDB（`asobibako-pet-house`）へ控え、
ゲームを開くときにタイトルのあいだに読む。これに 2 つの問題がある。

1. 読む処理に時間切れがない。`src/routes/games/[id]/+page.ts` の load が `meta.load()` を await し、その中の
   `warmShapes()` が IndexedDB を開くのを待つ。iOS の IndexedDB は開くところで止まることがある（`src/lib/mirror.ts` は
   同じ理由で 1.5 秒で見切っている）。止まると、一覧でわんにゃんハウスを押しても画面が移らない。開く途中の promise を
   覚えているので、アプリを終わらせるまで直らない。その「終わらせる」が、記録が消えた事故の引き金と同じ操作になる
2. 控えの鍵にアプリの版（`version`、ビルドの時刻 + git hash）を使っている。ほかのゲームを直してデプロイしただけでも
   控えが全部捨てられ、次に開いたとき飼っている子（1 匹 平均 0.36 秒、最大 0.6 秒）とふれあいひろばの 8 種類
   （約 2.8 秒）を組み直す。そのあいだ「いどうちゅう…」で止まる

この計画のあと、控えは 1.5 秒待っても読めなければ諦めて組み立てに回り、鍵は「形を作るコードと three の版」が
変わったときだけ変わる。

## Current state

`src/lib/games/pet-house/meta.ts:10-24`

```ts
  load: async () => {
    const [game, howto] = await Promise.all([import('./PetHouse.svelte'), import('./Howto.svelte'), warmShapes()]);
    return { Game: game.default, Howto: howto.default };
  }
} satisfies GameMeta;

/** 前に作ったペットの形の控え（IndexedDB）を、タイトルのあいだに読んでおく。無ければ遊ぶときに作る */
async function warmShapes() {
  const [{ loadShapes }, { BREED_IDS }, { graphics }] = await Promise.all([
    import('./models'),
    import('./breeds'),
    import('$lib/graphics.svelte')
  ]);
  await loadShapes(BREED_IDS, graphics.quality);
}
```

`src/lib/games/pet-house/models.ts:1-2` は `import { version } from '$app/environment';`。

`src/lib/games/pet-house/models.ts:112-126`

```ts
let opened: Promise<IDBDatabase | null> | undefined;

function shapeDb() {
  return (opened ??= new Promise((ok) => {
    try {
      const req = indexedDB.open('asobibako-pet-house', 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => ok(req.result);
      req.onerror = req.onblocked = () => ok(null);
    } catch {
      // 使えない所（プライベートブラウズ・テスト）では毎回作る
      ok(null);
    }
  }));
}
```

`version` を使うのは `models.ts:138`（`${version}:` で始まらない控えを消す）、`:143`（`${version}:${key}` を読む）、
`:173`（`${version}:${key}` へ書く）の 3 か所。

`vite.config.ts:11-20,34` は版の名前 `${process.env.TD_BUILD}-${gitHash}` を作る（Service Worker のキャッシュ名にもなるので
これは変えない）。

形を作る入力はすべて `src/lib/games/pet-house/` の中にある（`looks.ts`・`pose.ts`・`sculpt.ts`・`models.ts`・
`accessories.ts` の `hit`・`breeds.ts`・`fur.ts` など）。画質ごとの値 `QUALITY` も `models.ts:41` にある。
形は three の `BufferGeometry` の配列で控える。

`src/app.d.ts` は `declare global { namespace App { ... } }` だけ。

## Commands you will need

| Purpose             | Command                                                       | Expected on success  |
| ------------------- | ------------------------------------------------------------- | -------------------- |
| Install（worktree） | `pnpm install --frozen-lockfile`                              | exit 0               |
| 対象テスト          | `pnpm exec vitest run src/lib/games/pet-house/models.test.ts` | all pass（約 15 秒） |
| 全テスト            | `pnpm test:run`                                               | all pass             |
| 型                  | `pnpm check`                                                  | 0 errors, 0 warnings |
| lint                | `pnpm lint`                                                   | exit 0               |
| ビルド              | `pnpm build`                                                  | exit 0               |

## Scope

In scope は次のファイル。

- `vite.config.ts`
- `src/app.d.ts`
- `src/lib/games/pet-house/models.ts`（`shapeDb` と `version` の 3 か所だけ）
- `src/lib/games/pet-house/meta.ts`
- `src/lib/games/pet-house/models.test.ts`（テストを 1 本足すだけ）

Out of scope は次のとおり。

- SvelteKit の `version.name` と Service Worker のキャッシュ名
- `warmShapes` が全 15 種類を読む点（遊ばない種類も 40MB 前後メモリに持つ）。ひろばの組み立ても控えを読むよう
  変える必要があり、別の判断にする
- `models.ts` のほかの部分

## Git workflow

- ステップごとにコミットしてよい。メッセージ例 `Stop waiting on a stuck pet shape cache` /
  `Key pet shapes by their own code, not the app build`。末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- push しない

## Steps

### Step 1: 控えを読むのを 1.5 秒で見切る

`meta.ts` の `warmShapes` の最後を次にする。

```ts
// iOS の IndexedDB は開くところで止まることがある。控えは速くするためだけのものなので、待ちきれなければ遊ぶときに作る
await Promise.race([loadShapes(BREED_IDS, graphics.quality), new Promise((ok) => setTimeout(ok, 1500))]);
```

`models.ts` の `shapeDb` は、開けなかった結果（`null`）を覚え続けないようにする。

```ts
function shapeDb() {
  opened ??= new Promise(...今と同じ...);
  // 開けなかったときは次に開いたとき試しなおす
  void opened.then((db) => {
    if (!db) opened = undefined;
  });
  return opened;
}
```

**Verify**: `pnpm check` → 0 errors。`pnpm exec vitest run src/lib/games/pet-house/models.test.ts` → all pass

### Step 2: 形のコードの中身から版を作り、ビルドに埋める

`vite.config.ts` の `gitHash` の下に次を足す（`node:crypto` と `node:fs` を import する）。

```ts
// ペットの形の控え（IndexedDB）の版。形を作るコードと three が変わったときだけ変え、ほかのゲームのデプロイで組み直させない
const petShapes = (() => {
  const dir = 'src/lib/games/pet-house';
  const hash = createHash('sha1');
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .sort())
    hash.update(f).update(readFileSync(`${dir}/${f}`));
  hash.update(readFileSync('node_modules/three/package.json'));
  return hash.digest('hex').slice(0, 12);
})();
```

`defineConfig({ ... })` の最上位に `define: { __PET_SHAPES__: JSON.stringify(petShapes) },` を足す（vitest でも効く）。

`src/app.d.ts` の `declare global { ... }` の中に、`namespace App` と並べて次を足す。

```ts
/** ペットの形の控えの版（vite.config.ts が形のコードの中身から作る） */
const __PET_SHAPES__: string;
```

`models.ts` は `import { version } from '$app/environment';` を消し、`const shapesVersion = __PET_SHAPES__;` を
控えの節（`// ---- 形の控え ----` のあたり）に置いて、3 か所の `version` を `shapesVersion` にする。

**Verify**: `grep -n "\$app/environment" src/lib/games/pet-house/models.ts` → 0 行。
`grep -n "shapesVersion" src/lib/games/pet-house/models.ts` → 4 行（宣言 + 3 か所）。`pnpm check` → 0 errors

### Step 3: テストを 1 本足す

`models.test.ts` の `describe('pet-house models', ...)` の中に、版がビルド時刻や git に依存しない 12 桁の 16 進であることを
確かめるテストを足す（`expect(__PET_SHAPES__).toMatch(/^[0-9a-f]{12}$/)`）。define が vitest に届いていることの確認になる。

**Verify**: `pnpm exec vitest run src/lib/games/pet-house/models.test.ts` → all pass（1 本増える）

### Step 4: 全体の確認

**Verify**: `pnpm test:run` → all pass（ノミのテストが乱数でまれに落ちるのは既知。落ちたらもう一度流す）。
`pnpm lint` → exit 0。`pnpm build` → exit 0 のあと、`grep -rl "__PET_SHAPES__" build/ | wc -l` → 0（すべて置き換え済み）

## Test plan

- `models.test.ts` に 1 本（Step 3）
- IndexedDB の読み書きそのものは happy-dom に無いのでテストしない（今もしていない）

## Done criteria

- [ ] `grep -n "setTimeout(ok, 1500)" src/lib/games/pet-house/meta.ts` が 1 行
- [ ] `grep -n "__PET_SHAPES__" vite.config.ts src/app.d.ts src/lib/games/pet-house/models.ts` が 3 ファイルで出る
- [ ] `pnpm test:run` / `pnpm check` / `pnpm lint` / `pnpm build` が通る
- [ ] `git diff --name-only 4c06cf0` が In scope のファイルだけ（+ `plans/README.md`）

## STOP conditions

- 形を作るコードが `src/lib/games/pet-house/` の外（`$lib/...`）の値を使っていると分かった（ハッシュに入れる範囲を広げる
  必要がある。どこを足すか報告する）
- `define` の置き換えが `.ts` で効かず、`pnpm check` か vitest で `__PET_SHAPES__` が未定義になる
- ESLint が `__PET_SHAPES__` を未定義として落とし、`eslint.config.js` を変えないと通らない

## Maintenance notes

- 形を作る入力を `pet-house/` の外へ移したら、`vite.config.ts` のハッシュの範囲も広げる。広げ忘れると、その入力を
  変えても古い形のまま描かれる
- pet-house のどのファイルを変えても控えは捨てられる（形に関係しない変更でも）。開発を終えたゲームなので、細かく分けない
