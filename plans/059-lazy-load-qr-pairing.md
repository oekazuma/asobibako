# Plan 059: ゲームの画面を開くたびに QR の読み取り（jsqr）を読み込まないようにする

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- "src/routes/games/[id]/+page.svelte" "src/routes/games/[id]/page.svelte.test.ts"`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP。

## Status

| 項目       | 値                                                                    |
| ---------- | --------------------------------------------------------------------- |
| Priority   | P3                                                                    |
| Effort     | S                                                                     |
| Risk       | LOW（1 つのページで、2 台で遊ぶ画面の部品を押したときに読み込むだけ） |
| Depends on | none                                                                  |
| Category   | perf                                                                  |
| Planned at | commit `36cc037`, 2026-10-14                                          |

## Why this matters

ゲームの画面（`/games/[id]`、全ゲームが 1 つの動的ルート）は、2 台で遊ぶときの手順の画面 `Pairing.svelte` を静的に import している。
`Pairing` → `Handshake.svelte` → `camera.ts` → `jsqr`（QR の読み取り）とつながるので、ひとりで遊ぶゲームを含む全部のゲームの画面で、
QR の部品をまとめたチャンクを読み込んで解析する。`36cc037` のビルドでは、このチャンクは 148,658 バイト（gzip で 53,980 バイト）で、
中身は jsqr・`Handshake`・`camera.ts`・`link.ts`・QR を描く `uqr` と `Qr.svelte`。2 台で遊べるゲームでも「2だいで あそぶ」を
押す人は一部なので、押したときに読み込めば足りる。

直し方は 2 つ考えられる。

1. ルートで `Pairing` を押したときに動的 import する。1 ファイルの変更で、チャンクがまるごとルートから外れる
2. `camera.ts` の中で jsqr だけを動的 import する。外れるのは jsqr だけで、`Handshake` などはルートに残る。読み取りの間隔の処理も変わる

1 を選ぶ。ファイルは同じページの中だけで、外れる量も多い。ページはすでに変数に入れた部品を描いていて（`<data.play.Game />`）、
ゲームの `meta.ts` も `(await import(…)).default` で部品を読むので、同じ書き方で足りる。Service Worker はビルドしたファイルを全部
キャッシュするので、あとから読むチャンクもオフラインで開ける。

## Current state

直すファイルは 1 つで、テストを 1 つ作る。

- `src/routes/games/[id]/+page.svelte` — ゲームの画面。種類（solo・party・duel）で分かれ、duel で `pairing` のときだけ `Pairing` を描く（59 行）
- `src/routes/games/[id]/page.svelte.test.ts`（作る）— happy-dom のテスト。`src/routes/page.svelte.test.ts` と同じ置き方

今のコードは `src/routes/games/[id]/+page.svelte:1-59` にある（抜粋）。

```svelte
<script lang="ts">
  import GameShell from '$lib/components/GameShell.svelte';
  import SoloShell from '$lib/components/SoloShell.svelte';
  import type { Net } from '$lib/net/link';
  import Pairing from '$lib/net/Pairing.svelte';
  import { rememberGame } from '$lib/recent';

  let { data } = $props();

  let pairing = $state(false);
  // 抜けたときに今のつながりと同じものかを比べるので、proxy にしない
  let net = $state.raw<Net>();
  // （中略）
  function linked(next: Net) {
    pairing = false;
    net = next;
    // （中略）
  }
</script>

<!-- （中略） -->
{#key data.play.meta.id}
  {#if data.play.kind === 'solo'}
    <SoloShell meta={data.play.meta} Game={data.play.Game} Howto={data.play.Howto} />
  {:else if data.play.kind === 'party'}
    <data.play.Game />
  {:else if pairing}
    <Pairing name={data.play.meta.name} onlink={linked} onback={() => (pairing = false)} />
  {:else}
    {#key net}
      <GameShell
        meta={data.play.meta}
        Game={data.play.Game}
        Howto={data.play.Howto}
        {net}
        onpair={data.play.meta.net ? () => (pairing = true) : undefined}
      />
    {/key}
  {/if}
{/key}
```

`import type { Net } from '$lib/net/link'` は型だけなので、ビルドでは消える。`GameShell.svelte` も `$lib/net/link` を型だけで
import している（`GameShell.svelte:8`）。「2だいで あそぶ」のボタンは `GameShell.svelte:107-111` の `button.pair` で、`onpair` を
呼ぶ。

ゲームの `meta.ts` の読み方の例は `src/lib/games/hirameki/meta.ts:14` にある。

```ts
    Game: (await import('./Hirameki.svelte')).default,
```

`36cc037` でのビルドでは、ゲームの画面のノード（`_app/immutable/nodes/4.*.js`）が QR のチャンクを静的に import している。
下の Step 3 の確かめのスクリプトで、変更の前は `jsqr in static graph` に 1 つ出る。

規約として、コメントは「コードから復元できない WHY」だけを日本語で書く（変更の経緯や計画の番号は書かない）。`.svelte` は 200 行未満
（svelte-vitals `architecture/component-size`）。テストの名前は日本語の文にする。

## Commands you will need

| Purpose       | Command                                                            | Expected on success                                                                 |
| ------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| 足すテスト    | `pnpm exec vitest run "src/routes/games/[id]/page.svelte.test.ts"` | pass                                                                                |
| 全テスト      | `pnpm test:run`                                                    | exit 0                                                                              |
| 型            | `pnpm check`                                                       | `0 ERRORS 0 WARNINGS`、exit 0                                                       |
| lint          | `pnpm lint`                                                        | exit 0                                                                              |
| svelte-vitals | `pnpm vitals --diff`                                               | 警告 0                                                                              |
| ビルド        | `pnpm build`                                                       | exit 0（`vite build`。`build/` と `.svelte-kit/output/` を書く。どちらも git の外） |
| 全部          | `pnpm verify`                                                      | exit 0                                                                              |

ブラウザの道具は使わない（この計画では要らない）。

## Scope

**In scope**

- `src/routes/games/[id]/+page.svelte`
- `src/routes/games/[id]/page.svelte.test.ts`（作る）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/lib/net/` の全部（`Pairing`・`Handshake`・`camera.ts`・`link.ts`）。jsqr を `camera.ts` の中で遅らせる直し方は選ばない
- おえかきのもり・アニマルサバイバー・やっぱりカメレオンが `Handshake` を静的に import していること。どれもゲームの本体で、`load()` で
  遊ぶときに読むチャンクに入っている
- `GameShell.svelte`。`onpair` の受け方は変えない
- 読み込むあいだの「よみこみちゅう」などの表示。Service Worker のキャッシュから読むのですぐ終わる

## Git workflow

- ブランチは `advisor/059-lazy-load-qr-pairing`
- コミットは 1 つでよい。英語の命令形 1 文で、`Co-Authored-By` などの末尾の行は付けない（例 `Load the QR pairing screen only when two-device play is chosen`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 今のビルドで、ゲームの画面が jsqr を静的に読むことを確かめる

`pnpm build` を実行し、リポジトリの根で次のスクリプトを実行する。ゲームの画面のノードは、`<svelte:window onpagehide>` から入る
`pagehide` の字で見つける（ノードの番号とハッシュはビルドごとに変わりうる）。jsqr の目印は `attemptBoth`（jsqr の中にしかない字。
`camera.ts` にある `dontInvert` は目印にしない）。

```bash
node -e '
const fs = require("fs");
const dir = ".svelte-kit/output/client/";
const m = JSON.parse(fs.readFileSync(dir + ".vite/manifest.json", "utf8"));
const read = (f) => fs.readFileSync(dir + f, "utf8");
const [key] = Object.keys(m).filter((k) => m[k].file.includes("/nodes/") && read(m[k].file).includes("pagehide"));
const seen = new Set();
const walk = (k) => { if (seen.has(k)) return; seen.add(k); for (const i of m[k].imports ?? []) walk(i); };
walk(key);
const hits = [...seen].filter((k) => read(m[k].file).includes("attemptBoth")).map((k) => m[k].file);
const all = Object.values(m).filter((v) => v.file.endsWith(".js") && read(v.file).includes("attemptBoth")).map((v) => v.file);
console.log("route node:", m[key].file);
console.log("jsqr in static graph:", hits);
console.log("jsqr chunks anywhere:", all);
'
```

**Verify**: 出力の `jsqr in static graph:` に `_app/immutable/chunks/<hash>.js` が 1 つあり、`jsqr chunks anywhere:` と同じファイル。
`route node:` が 1 つに決まらない（`undefined` になる）ときは STOP。

### Step 2: `Pairing` を押したときに読み込む

`+page.svelte` を次のようにする。

1. `import Pairing from '$lib/net/Pairing.svelte';` の行を消す
2. `let pairing = $state(false);` の下に次の 2 行を足す

```ts
// QR の読み取り（jsqr）が大きいので、2 台で遊ぶと決めたときに初めて読み込む
let Pairing = $state.raw<typeof import('$lib/net/Pairing.svelte').default>();
```

3. `function linked` の上に次を足す

```ts
async function pair() {
  Pairing ??= (await import('$lib/net/Pairing.svelte')).default;
  pairing = true;
}
```

4. `{:else if pairing}` を `{:else if pairing && Pairing}` にする
5. `onpair={data.play.meta.net ? () => (pairing = true) : undefined}` を `onpair={data.play.meta.net ? pair : undefined}` にする

`<Pairing name=… onlink={linked} onback={() => (pairing = false)} />` の行は変えない。

`src/routes/games/[id]/page.svelte.test.ts` を次の内容で作る。2 台で遊べるゲーム（`meta.net` が true）を本物の `load` で読み、
「2だいで あそぶ」を押すと手順の画面（「さきに QR を だす」）が出ることを見る。

```ts
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { games } from '$lib/games';
import { load } from './+page';
import Page from './+page.svelte';

afterEach(() => {
  document.body.innerHTML = '';
});

it('2だいで あそぶ を押すと、QR でつなぐ画面を読み込んで出す', async () => {
  const meta = games.find((game) => 'net' in game && game.net)!;
  const data = await load({ params: { id: meta.id } } as never);
  const target = document.body.appendChild(document.createElement('div'));
  const app = mount(Page, { target, props: { data } as never });
  flushSync();
  expect(target.textContent).not.toContain('さきに QR を だす');
  target.querySelector<HTMLButtonElement>('button.pair')!.click();
  await vi.waitFor(() => {
    flushSync();
    expect(target.textContent).toContain('さきに QR を だす');
  });
  unmount(app);
});
```

このテストは「押すと今までどおり手順の画面が出る」ことの守りで、読み込みを遅らせたことは Step 3 のビルドで確かめる。

**Verify**:

- `pnpm exec vitest run "src/routes/games/[id]/page.svelte.test.ts"` → 1 つ pass
- `grep -n "import Pairing" "src/routes/games/[id]/+page.svelte"` → 何も出ない
- `pnpm check` → `0 ERRORS 0 WARNINGS`

### Step 3: ビルドで、ゲームの画面から jsqr が外れたことを確かめる

`pnpm build` をもう一度実行し、Step 1 と同じスクリプトを実行する。

**Verify**: `jsqr in static graph: []`（空）。`jsqr chunks anywhere:` には 1 つ残る（押したときと、ほかのゲームの本体が読む）。

### Step 4: 全体の確かめ

先に触ったファイルを整える。

`pnpm exec prettier --write "src/routes/games/[id]/+page.svelte" "src/routes/games/[id]/page.svelte.test.ts"`

**Verify**:

- `pnpm lint` → exit 0（markuplint を含む）
- `pnpm vitals --diff` → 警告 0
- `pnpm verify` → exit 0

## Test plan

- 作るテストは `src/routes/games/[id]/page.svelte.test.ts` の 1 つ。「2だいで あそぶ」を押すと手順の画面が出る
- 型にするテストは `src/routes/page.svelte.test.ts`（ページを `mount` して `textContent` とボタンで見る）
- 読み込みを遅らせたことはテストではなくビルドの静的な import のたどりで見る（Step 1 と Step 3 のスクリプト）

## Done criteria

- [ ] `pnpm exec vitest run "src/routes/games/[id]/page.svelte.test.ts"` が pass
- [ ] Step 3 のスクリプトの出力が `jsqr in static graph: []`
- [ ] `grep -n "import Pairing" "src/routes/games/[id]/+page.svelte"` が何も返さない
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない（`build/` と `.svelte-kit/` は git の外）
- [ ] `plans/README.md` の 059 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- 上の抜粋（`+page.svelte` の `Pairing` の import と描き方、`onpair`）が今のコードと違う
- Step 1 で `jsqr in static graph:` が最初から空（すでに直っている）か、`route node:` が決まらない
- Step 3 で `jsqr in static graph:` が空にならない。ほかに `$lib/net` の値をルートへ静的に持ち込む import があるしるしなので、
  どの import かを書いて報告する（`GameShell` などを直しに行かない）
- テストの `mount` が、`Pairing` と関係のない理由（音・Wake Lock・ゲームの本体の読み込みなど）で落ちる。そのときはテストを
  消さずに、落ちた理由を書いて報告する
- `pnpm check` か `pnpm lint` が `typeof import(…)` の書き方で落ちる（計画を書いたときに svelte-check・eslint・prettier を通して確かめてある）。書き換えずに報告する

## Maintenance notes

- ルートに部品を足すときは、`$lib/net` の値（`Link` クラスなど）を静的に import しない。型だけなら `import type` にする。
  入れると QR のチャンクがまたゲームの画面に戻る。Step 1 のスクリプトで `jsqr in static graph: []` を見れば確かめられる
- 「2だいで あそぶ」を押してから手順の画面が出るまで、チャンクを読むぶん一瞬待つ。Service Worker のキャッシュから読むので、
  ふだんは気づかない。初めて開いた直後で SW がまだ入っていないときだけ、ネットワークから読む
- 実機では、2 台対戦のゲームで「2だいで あそぶ」を押して手順の画面が出ること、機内モードでも同じく出ることを見る
