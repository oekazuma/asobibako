# Plan 082: CSP の説明を正し、読み込むファイルと戻す圧縮に上限を付け、AI の実行部分のライセンスを載せる

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 982455c..HEAD -- vite.config.ts src/lib/backup.ts src/lib/components/Backup.svelte src/lib/components/Backup.svelte.test.ts src/lib/inflate.ts src/lib/inflate.test.ts src/lib/coloring/wire.ts src/lib/coloring/wire.test.ts src/lib/net/link.ts src/lib/net/link.test.ts static/licenses.txt src/routes/about/+page.svelte`
> 何か出たら「Current state」の抜粋と今のコードを見比べ、食い違えば STOP（`src/lib/inflate.ts` と `src/lib/inflate.test.ts` はまだ無い）。

## Status

| 項目       | 値                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------- |
| Priority   | P3                                                                                        |
| Effort     | S                                                                                         |
| Risk       | LOW（コメント・上限の追加・文書の追記。ふつうの大きさの入力では動きが変わらない）         |
| Depends on | none（078 で `link.ts` に大きな知らせを分ける処理が入っている。この計画はそれに触らない） |
| Category   | security / tech-debt                                                                      |
| Planned at | commit `982455c`, 2026-10-14                                                              |

## Why this matters

小さな守りの穴と説明のずれを 4 つ片づける。どれも 1 つずつ独立していて、1 つにつき 1 コミットにする。

1. `vite.config.ts` の CSP のコメントは「依存パッケージ経由で混入したコードが外へ通信するのを connect-src で止める」と言うが、
   `<meta http-equiv>` の CSP が効くのはページ（文書）の中だけ。ぬりえの AI を動かす Web Worker（`coloring/ai-worker.ts` と、その中の
   onnxruntime-web）と Service Worker には効かない。読む人が「worker の中も止まっている」と思い込まないよう、効く範囲を正しく書く
2. アプリについての「記録を読み込む」は、ファイルを全部文字にしてから（`f.text()`）大きさを見る。数百 MB のファイルを選ぶと、
   断る前に iPad のメモリを使い切りうる。ファイルの大きさ（`f.size`）を先に見て、読む前に断る
3. みんなでぬりえの線画（`coloring/wire.ts` の `decodeLines`）と QR の接続情報（`net/link.ts` の `unpack`）は、縮めたデータを
   `DecompressionStream` で全部戻してから使う。小さな入力が 1000 倍ほどに膨らむデータを相手の端末や QR から渡されると、
   要らない大きさまで確保する。戻すのを要る大きさで打ち切る
4. ビルドには onnxruntime-web の WebAssembly（ONNX Runtime の C++ をまとめたもの、約 14MB）が入る。その中には protobuf・ONNX・Eigen・
   abseil・RE2 などが組み込まれているが、`static/licenses.txt` には onnxruntime-web（MIT）しか載っていない。Apache-2.0 や BSD は
   機械語の形で配るときもライセンスの文を添えることを求めるので、ONNX Runtime 自身が配っている ThirdPartyNotices から該当する項を写す

## Current state

### 1. CSP のコメント

`vite.config.ts:52-69`

```ts
      // GitHub Pages はヘッダを出せないので <meta http-equiv> で CSP を出す（プリレンダーなので hash）。
      // 依存パッケージ経由で混入したコードが外へ通信するのを connect-src で止めるのが目的。
      // style は style:--b={} などのインライン style 属性を使うので unsafe-inline
      csp: {
        mode: 'hash',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:'],
          'font-src': ['self'],
          'connect-src': ['self'],
          'worker-src': ['self'],
          'manifest-src': ['self'],
          'object-src': ['none'],
          'base-uri': ['self']
        }
      }
```

Service Worker の側は、すでに `src/service-worker.ts:5` で同じことを書いている。

```ts
// この worker は <meta> の CSP の外で走る（GitHub Pages はヘッダを出せない）。import は $service-worker だけに保つ
```

ぬりえの AI の worker は `src/lib/coloring/ai-run.ts:26` で、ページとは別のファイルから作る。

```ts
worker = new Worker(new URL('./ai-worker.ts', import.meta.url), { type: 'module' });
```

CSP Level 3 では、別のファイル（`http(s):` の URL）から作った Web Worker は、そのファイルの応答ヘッダの CSP に従い、ページの CSP を
受け継がない。GitHub Pages はヘッダを出せないので、worker の中には CSP が無い。`worker-src 'self'` は、ページが作れる worker のファイルを
同じ origin に限るだけ。

### 2. 記録を読み込むときの大きさ

`src/lib/components/Backup.svelte:44-56`（ファイルは 120 行）

```ts
async function pick(e: Event) {
  const input = e.currentTarget as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  error = '';
  pending = null;
  try {
    pending = parseBackup(await f.text());
  } catch {
    error = '読み込めませんでした。「記録を書き出す」で保存したファイルを選んでください。';
  }
}
```

`src/lib/backup.ts:17-20` と `:82-84`。上限は文字数（UTF-16 の単位の数）で、export されていない。

```ts
// 常識外のファイルを弾く上限。わんにゃんハウスの写真やらくがきパレードのずかんで 1MB を超えるが、
// localStorage そのものが数 MB までなので、それより大きな正規の書き出しはない。キーはゲーム数 + 数個
const MAX_KEYS = 400;
const MAX_CHARS = 16 * 1024 * 1024;
```

```ts
/** 形が違えば throw する（呼び出し側が「読み込めません」と出す） */
export function parseBackup(text: string): Backup {
  if (text.length > MAX_CHARS) throw new Error('backup');
```

UTF-8 は UTF-16 の 1 単位あたり最大 3 バイト（4 バイトの字は 2 単位になる）なので、`MAX_CHARS * 3` バイトを超えるファイルは、
読んで文字にすると必ず `MAX_CHARS` を超える。先に `f.size > MAX_CHARS * 3` で断っても、今は読めるファイルを断ることはない。

`parseBackup` のほかの呼び手（`src/lib/mirror.ts:112` と `:122`）は IndexedDB に控えた文字を読むもので、この計画では触らない。

`src/lib/components/Backup.svelte.test.ts:7-14` の `choose(target, text)` は、文字から `File` を作って `input` の `files` に入れ、
`change` を起こす型。このファイルは happy-dom で動く（`*.svelte.test.ts`）。

### 3. 縮めたデータを戻すところ

`src/lib/coloring/wire.ts:13-17`。親が配った線画（768 × 768 を 1 画素 1 ビットに詰めたもの）を戻す。

```ts
export async function decodeLines(text: string): Promise<Uint8Array> {
  const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return unpack(new Uint8Array(await new Response(stream).arrayBuffer()));
}
```

`src/lib/coloring/book.ts:29-33`。`unpack` は `n = SIZE * SIZE` 画素ぶんのビット（`SIZE * SIZE / 8` バイト = 73,728 バイト）だけを読む。
それより長いデータの残りは使われず、短いデータの足りないところは 0（線でない）になる。`SIZE` は `src/lib/coloring/regions.ts` の 768。

```ts
export function unpack(bits: Uint8Array, n = SIZE * SIZE): Uint8Array {
  const mask = new Uint8Array(n);
  for (let i = 0; i < n; i++) mask[i] = (bits[i >> 3] >> (i & 7)) & 1;
  return mask;
}
```

`decodeLines` を呼ぶのは `src/lib/games/oekaki-mori/Together.svelte:51` だけで、`try` で囲んでいない（194 行で、200 行の上限まで
5 行しかない）。なので `decodeLines` は大きすぎるデータで throw せず、要る長さで打ち切って返す形にする（呼ぶ側は変えない）。

`src/lib/net/link.ts:179-182`。QR から読んだ接続情報（SDP）を戻す。

```ts
export async function unpack(code: string): Promise<string> {
  const bytes = Uint8Array.from(atob(code.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
}
```

`unpack` は `host().accept`（`link.ts:148`）と `join`（`link.ts:164`）の中で呼ばれ、どちらも `Handshake.svelte:39-45` の
`connect(text).catch(...)` の中で走る。打ち切った SDP は `setRemoteDescription` が断るので、今の「つながりませんでした」の道に入る。
`pack` で縮める SDP は `slim` で行を落としたもので数百バイトから 1〜2KB ほど、QR に入るのは 3KB ほどまで。

戻すのを打ち切る部品は 2 か所で同じなので、`src/lib/inflate.ts` に 1 つ置く（`coloring` から `net` を読む、またはその逆は、層が
ちぐはぐになるので避ける）。node の `DecompressionStream` と `CompressionStream` は vitest の node の project でそのまま使える
（`src/lib/coloring/wire.test.ts` がすでに使っている）。

### 4. ライセンス

`static/licenses.txt`（313 行）は 1 項ごとに次の形の見出しを持つ（1〜8 行め）。

```text
あそびばこ が つかわせて もらったもの

========================================================================
onnxruntime-web — Microsoft Corporation — MIT — https://github.com/microsoft/onnxruntime
========================================================================

MIT License
```

項は onnxruntime-web・Informative Drawings・three.js・jsQR・uqr の 5 つ。`src/routes/about/+page.svelte:73-83` の「つかわせて もらったもの」に
同じ 5 つが並ぶ（ファイルは 157 行）。

```svelte
<section class="card">
  <h2>つかわせて もらったもの</h2>
  <ul class="credits">
    <li>Informative Drawings（Caroline Chan、MIT）… ぬりえの AI の線画</li>
    <li>onnxruntime-web（Microsoft、MIT）… AI を動かす</li>
    <li>three.js（three.js authors、MIT）… 3D の画面</li>
    <li>jsQR（Cosmo Wolfe ほか、Apache-2.0）… QR を読む</li>
    <li>uqr（Project Nayuki、Anthony Fu、MIT）… QR を作る</li>
  </ul>
  <a href={asset('/licenses.txt')}>ライセンスの全文</a>
</section>
```

リポジトリの決まり（ルートの `CLAUDE.md` の「規約」）は「使わせてもらったものとライセンスは `/about` の「つかわせて もらったもの」と
`static/licenses.txt` に書く。依存やモデルを足したら両方に足す」。`src/routes/about/page.svelte.test.ts:34-35` は
`onnxruntime-web` の字と `licenses.txt` へのリンクがあることを見る。

入っている onnxruntime-web は 1.30.0（`node_modules/onnxruntime-web/package.json`）。ぬりえの AI の worker は
`onnxruntime-web/wasm`（`dist/ort.wasm.bundle.min.mjs`、ONNX Runtime Web 自身の MIT の見出しだけ）と、
`dist/ort-wasm-simd-threaded.wasm`・`.mjs` を読む。npm のパッケージには ThirdPartyNotices が入っていない。

計画を書くときに、`ort-wasm-simd-threaded.wasm` の中の文字列（`strings`）を見て、組み込まれているものを確かめた。

| 見つけたもの                           | 中の文字列の例                                       |
| -------------------------------------- | ---------------------------------------------------- |
| protobuf（`protocolbuffers/protobuf`） | `_deps/protobuf-src/src/google/protobuf/arena.h`     |
| ONNX（`onnx`）                         | `_deps/onnx-src`（28 か所）                          |
| abseil（`abseil-cpp`）                 | `_deps/abseil_cpp-src/absl/synchronization/mutex.cc` |
| RE2（`google/re2`）                    | `_deps/re2-src/re2/regexp.cc`                        |
| Eigen（`Eigen`）                       | `Eigen::ThreadPoolInterface`                         |
| flatbuffers（`google/flatbuffers`）    | `onnxruntime/core/flatbuffers/flatbuffers_utils.cc`  |
| nlohmann/json（`nlohmann/json`）       | `N8nlohmann16json_abi_v3_11_36detail9exceptionE`     |
| SafeInt（`dcleblanc/SafeInt`）         | `SafeInt`                                            |
| Microsoft GSL（`Microsoft GSL`）       | `gsl::narrow`                                        |
| Emscripten の実行部分（`emsdk`）       | `.wasm` と `.mjs` は Emscripten で作られている       |

見つからなかったもの（`zlib`・`inflate`・`date::`・`kai_`・`xnn_`・`cpuinfo`・`pthreadpool`・`mimalloc`）は載せない。Boost（`mp11` は
ヘッダだけの部品）は Boost Software License が機械語だけで配るときは文を求めないので載せない。

写す元は ONNX Runtime の `v1.30.0` のタグの `ThirdPartyNotices.txt`（6369 行、sha256 は
`143764b952fdb1a7c69ce653bfba74a7744d6a8a573bfb73e235fba356c83de3`）。項は `_____` だけの行で区切られ、区切りの次の空でない行が名前。
上の表のかっこの中が、その名前（1 字もちがわない）。

### 規約

- コメントは「コードから復元できない WHY」だけを日本語で書く。変更の経緯やプランの番号は書かない
- テストの名前は日本語の文にする
- `.svelte` は 200 行未満（svelte-vitals の `architecture/component-size` はファイル全体を数える）。この計画で触る `.svelte` は
  `Backup.svelte`（120 行）と `about/+page.svelte`（157 行）で、どちらも 1〜3 行しか増えない
- 計画の中のコード例は、整形のためにインデントを省いてある。書くときは周りのコードのインデントに合わせ、最後に
  `pnpm exec prettier --write <file>` で整える

## Commands you will need

| Purpose        | Command                                                                                                                                        | Expected on success           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| 足すテスト     | `pnpm exec vitest run src/lib/inflate.test.ts src/lib/coloring/wire.test.ts src/lib/net/link.test.ts src/lib/components/Backup.svelte.test.ts` | すべて pass                   |
| about のテスト | `pnpm exec vitest run src/routes/about/`                                                                                                       | すべて pass                   |
| 全テスト       | `pnpm test:run`                                                                                                                                | exit 0                        |
| 型             | `pnpm check`                                                                                                                                   | `0 ERRORS 0 WARNINGS`、exit 0 |
| lint           | `pnpm lint`                                                                                                                                    | exit 0                        |
| svelte-vitals  | `pnpm vitals --diff`                                                                                                                           | 警告 0                        |
| 全部           | `pnpm verify`                                                                                                                                  | exit 0                        |

## Scope

**In scope**

- `vite.config.ts`（CSP のコメントだけ）
- `src/lib/backup.ts`
- `src/lib/components/Backup.svelte`
- `src/lib/components/Backup.svelte.test.ts`（テストを足す）
- `src/lib/inflate.ts`（作る）
- `src/lib/inflate.test.ts`（作る）
- `src/lib/coloring/wire.ts`
- `src/lib/coloring/wire.test.ts`（テストを足す）
- `src/lib/net/link.ts`（`unpack` だけ）
- `src/lib/net/link.test.ts`（テストを足す）
- `static/licenses.txt`（末尾に足す）
- `src/routes/about/+page.svelte`（onnxruntime-web の行だけ）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- CSP の値そのもの（`directives`）— この計画は説明を正すだけ。worker の中の通信を止めたいなら別の計画で考える
- `src/service-worker.ts` — すでに正しく書いてある
- `src/lib/mirror.ts` の `parseBackup` の呼び方 — 読むのは自分の端末の IndexedDB で、外から来るファイルではない
- `Together.svelte` に `try` を足すこと（200 行の上限に近く、`decodeLines` が throw しない形にするので要らない）
- `link.ts` の `Link` が分けた知らせ（`~part`）をつなぐ数に上限を付けること — 相手の端末が送り続けられるのは別の話で、この計画では扱わない
- `package.json` の依存を変えること、onnxruntime-web の版を変えること

## Git workflow

- ブランチは `advisor/082-small-hardening`
- コミットは Step 1〜4 で 1 つずつ（4 つ）。英語の命令形 1 文で、`Co-Authored-By` などの署名の行は付けない。
  例 `Say which contexts the meta CSP actually covers`、`Reject oversized backup files before reading them`、
  `Cap how far compressed lines and SDP are inflated`、`Credit the components built into the ONNX Runtime wasm`
- push しない（`main` への push は本番へ出る）

## Steps

### Step 1: CSP のコメントを、効く範囲どおりに書き直す

`vite.config.ts:52-54` の 3 行を次の 5 行にする（`csp: {` から下は変えない）。

```ts
// GitHub Pages はヘッダを出せないので <meta http-equiv> で CSP を出す（プリレンダーなので hash）。
// 依存パッケージ経由で混入したコードが外へ通信するのを connect-src で止めるのが目的だが、効くのはページの中だけ。
// Web Worker（ぬりえの AI の coloring/ai-worker.ts と onnxruntime-web）と Service Worker は自分のファイルの応答ヘッダの CSP に従い、
// <meta> を受け継がないので、その中の通信は止まらない。worker-src は、ページが作れる worker のファイルを限るだけ
// style は style:--b={} などのインライン style 属性を使うので unsafe-inline
```

**Verify**: `grep -c "依存パッケージ経由で混入したコードが外へ通信するのを connect-src で止めるのが目的。" vite.config.ts` → `0`。
`grep -c "その中の通信は止まらない" vite.config.ts` → `1`。`git diff --numstat` → `3	1	vite.config.ts` の 1 行だけ（足すのが 3 行、消すのが 1 行で、`directives` の中は変わらない）。行の折り返しで数が変わったら、`git diff vite.config.ts` で `directives` が変わっていないことだけ確かめればよい。`pnpm lint` → exit 0。

コミットする。

### Step 2: 大きすぎる記録のファイルを読む前に断る

まず `Backup.svelte.test.ts` の `describe('バックアップ', ...)` の中に落ちるテストを足す。先頭の import に
`import { MAX_BYTES } from '$lib/backup';` を足す（Step 2 の直す前は export が無いので、型の上でも落ちる）。

```ts
// 数百 MB のファイルを文字にすると、断る前に端末のメモリを使い切りうる
it('大きすぎるファイルは中身を読まずに、読み込めないと伝える', async () => {
  const input = target.querySelector<HTMLInputElement>('input[type=file]')!;
  const file = new File(['{}'], 'big.json', { type: 'application/json' });
  Object.defineProperty(file, 'size', { value: MAX_BYTES + 1 });
  const text = vi.spyOn(file, 'text');
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await vi.waitFor(() => expect(target.querySelector('.err')).not.toBeNull());
  expect(target.querySelector('.err')?.textContent).toContain('読み込めませんでした');
  expect(text).not.toHaveBeenCalled();
});
```

**Verify**: `pnpm exec vitest run src/lib/components/Backup.svelte.test.ts` → 足したテストが落ちる（`MAX_BYTES` が `undefined` で、
`text` が呼ばれる）。

次に直す。

1. `src/lib/backup.ts` の `const MAX_CHARS = 16 * 1024 * 1024;` の下に足す。

   ```ts
   /** UTF-8 は UTF-16 の 1 単位あたり 3 バイトまでなので、これより大きいファイルは文字にすると必ず MAX_CHARS を超える */
   export const MAX_BYTES = MAX_CHARS * 3;
   ```

2. `src/lib/components/Backup.svelte` の import を `import { backedUpAt, backupFile, backupName, markBackedUp, MAX_BYTES, parseBackup, type Backup } from '$lib/backup';`
   にし（prettier が折り返したらそれに従う）、`pick` の `try` の中を次にする。

   ```ts
       try {
         // 文字にしてから大きさを見ると、断る前に大きなファイルを全部メモリに読む
         if (f.size > MAX_BYTES) throw new Error('backup');
         pending = parseBackup(await f.text());
       } catch {
   ```

**Verify**: `pnpm exec vitest run src/lib/components/Backup.svelte.test.ts src/lib/backup.test.ts` → すべて pass。
`wc -l src/lib/components/Backup.svelte` → 199 以下（今は 120 行）。`pnpm check` → `0 ERRORS 0 WARNINGS`。

コミットする。

### Step 3: 縮めたデータを戻すのを、要る大きさで打ち切る

1. `src/lib/inflate.ts` を作る。

   ```ts
   /**
    * deflate-raw を戻す。戻すのは先頭の max バイトまでで、そこで読むのをやめる。
    * 相手の端末や QR から来るデータは、小さくても 1000 倍ほどに膨らむことがあるので、要る大きさより先を確保しない
    */
   export async function inflate(bytes: Uint8Array<ArrayBuffer>, max: number): Promise<Uint8Array<ArrayBuffer>> {
     const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
     const out = new Uint8Array(max);
     let length = 0;
     while (length < max) {
       const { done, value } = await reader.read();
       if (done) return out.slice(0, length);
       const n = Math.min(value.length, max - length);
       out.set(value.subarray(0, n), length);
       length += n;
     }
     await reader.cancel();
     return out;
   }
   ```

   形の壊れたデータは、今と同じく `reader.read()` が reject して呼び手へ伝わる。

2. `src/lib/inflate.test.ts` を作る（node の project で走る）。

   ```ts
   import { describe, expect, it } from 'vitest';
   import { inflate } from './inflate';

   const deflate = async (data: Uint8Array<ArrayBuffer>) =>
     new Uint8Array(
       await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()
     );

   describe('inflate', () => {
     it('上限より小さいデータは、そのまま戻す', async () => {
       const data = new TextEncoder().encode('あいうえお'.repeat(100));
       expect(await inflate(await deflate(data), 16 * 1024)).toEqual(data);
     });

     it('大きく膨らむデータは、上限のバイトで打ち切る', async () => {
       const bomb = await deflate(new Uint8Array(8 * 1024 * 1024).fill(7));
       expect(bomb.length).toBeLessThan(64 * 1024);
       const out = await inflate(bomb, 1024);
       expect(out).toHaveLength(1024);
       expect(out.every((b) => b === 7)).toBe(true);
     });

     it('形の壊れたデータは reject する', async () => {
       await expect(inflate(new Uint8Array([1, 2, 3, 255, 255]), 100)).rejects.toThrow();
     });
   });
   ```

   **Verify**: `pnpm exec vitest run src/lib/inflate.test.ts` → 3 つとも pass。

3. `src/lib/coloring/wire.ts` を、`inflate` で要る長さまでだけ戻す形にする。import に `import { inflate } from '$lib/inflate';` と
   `import { SIZE } from './regions';` を足し、`decodeLines` を次にする。

   ```ts
   /** 線画のビットは SIZE * SIZE / 8 バイト。unpack はそれより先を読まないので、そこで打ち切っても同じ線画になる */
   export async function decodeLines(text: string): Promise<Uint8Array> {
     const bytes = Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
     return unpack(await inflate(bytes, Math.ceil((SIZE * SIZE) / 8)));
   }
   ```

   `wire.test.ts` の `describe('encodeLines と decodeLines', ...)` の中にテストを足す。

   ```ts
   it('線画より大きく膨らむデータは、線画の大きさで打ち切って戻す', async () => {
     const huge = new Uint8Array(8 * 1024 * 1024).fill(255);
     const packed = new Uint8Array(
       await new Response(new Blob([huge]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer()
     );
     const mask = await decodeLines(btoa(String.fromCharCode(...packed)));
     expect(mask).toHaveLength(SIZE * SIZE);
     expect(mask.every((v) => v === 1)).toBe(true);
   });
   ```

   `String.fromCharCode(...packed)` は引数の数に上限があるので、`packed.length` が 60,000 を超えたら STOP（8MB の同じ値なら 10KB ほど）。

4. `src/lib/net/link.ts` の `unpack` を次にする。import に `import { inflate } from '$lib/inflate';` を足し、`MAX_BYTES` の定義の近くに上限を置く。

   ```ts
   /** QR から読んだ SDP を戻す上限。縮める前の SDP は数百バイトから 2KB ほどで、これを超えるものは SDP ではない */
   const MAX_SDP = 16 * 1024;
   ```

   ```ts
   export async function unpack(code: string): Promise<string> {
     const bytes = Uint8Array.from(atob(code.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0));
     return new TextDecoder().decode(await inflate(bytes, MAX_SDP));
   }
   ```

   `link.test.ts` の `describe('pack', ...)` の中にテストを足す。

   ```ts
   it('大きく膨らむ code は、SDP の上限で打ち切って戻す', async () => {
     expect(await unpack(await pack('a'.repeat(4 * 1024 * 1024)))).toHaveLength(16 * 1024);
   });
   ```

**Verify**: Commands の「足すテスト」→ すべて pass（もとからある `pack` の往復のテストと `wire.test.ts` の 2 つを含む）。
`pnpm exec vitest run src/lib/net/ src/lib/coloring/ src/lib/games/oekaki-mori/` → すべて pass。`pnpm check` → `0 ERRORS 0 WARNINGS`
（`Uint8Array<ArrayBuffer>` の型で言われたら、渡す側を `new Uint8Array(bytes)` で包む。`encodeLines` が同じことをしている）。

コミットする。

### Step 4: onnxruntime-web の WebAssembly に組み込まれているもののライセンスを載せる

この Step だけネットにつなぐ（GitHub から 1 ファイル）。ブラウザの道具は使わない。

1. 写す元を取ってきて、中身が計画のときと同じことを確かめる（作業用のフォルダはリポジトリの外に作る）。

   ```bash
   work=$(mktemp -d)
   curl -sSfL -o "$work/tpn.txt" https://raw.githubusercontent.com/microsoft/onnxruntime/v1.30.0/ThirdPartyNotices.txt
   shasum -a 256 "$work/tpn.txt"
   ```

   **Verify**: sha256 が `143764b952fdb1a7c69ce653bfba74a7744d6a8a573bfb73e235fba356c83de3`。違えば STOP。

2. 表の 10 項を、区切りの行ごと抜き出す。`$work/pick.awk` に次を書く。

   ```awk
   BEGIN { n = split(names, list, "|"); for (i = 1; i <= n; i++) want[list[i]] = 1 }
   /^_____$/ { flush(); buf = $0 "\n"; title = ""; next }
   { buf = buf $0 "\n"; if (title == "" && $0 != "") title = $0 }
   END { flush() }
   function flush() { if (title in want) printf "%s", buf }
   ```

   ```bash
   awk -v names='protocolbuffers/protobuf|onnx|Eigen|Microsoft GSL|google/re2|google/flatbuffers|abseil-cpp|nlohmann/json|dcleblanc/SafeInt|emsdk' \
     -f "$work/pick.awk" "$work/tpn.txt" > "$work/picked.txt"
   grep -c '^_____$' "$work/picked.txt"
   awk '/^_____$/{getline; getline; print}' "$work/picked.txt"
   ```

   **Verify**: 1 つめの `grep -c` が `10`。2 つめが、protocolbuffers/protobuf・onnx・Eigen・Microsoft GSL・google/re2・google/flatbuffers・
   abseil-cpp・nlohmann/json・dcleblanc/SafeInt・emsdk の 10 行をこの順に出す。`wc -l < "$work/picked.txt"` が `1194`（計画のときに同じ手順で数えた）。

3. `static/licenses.txt` の末尾に、空行 1 つ・見出し・空行・抜き出したものをこの順で足す。見出しはほかの項と同じ形にする。

   ```bash
   {
     printf '\n========================================================================\n'
     printf 'onnxruntime-web の WebAssembly に組み込まれているもの — ONNX Runtime ThirdPartyNotices.txt（v1.30.0）から抜粋 — https://github.com/microsoft/onnxruntime/blob/v1.30.0/ThirdPartyNotices.txt\n'
     printf '========================================================================\n\n'
     cat "$work/picked.txt"
   } >> static/licenses.txt
   ```

   足す前に `tail -c 1 static/licenses.txt | xxd` で、ファイルが改行で終わっていることを確かめる（終わっていなければ STOP）。

4. `src/routes/about/+page.svelte` の onnxruntime-web の行を次にする。

   ```svelte
   <li>onnxruntime-web（Microsoft、MIT。中に入っている ONNX・protobuf・Eigen ほか）… AI を動かす</li>
   ```

**Verify**: `grep -c '^_____$' static/licenses.txt` → `10`（もとのファイルにこの行は無い。計画のときに 0 を確かめた）。
`grep -c "ONNX Runtime ThirdPartyNotices.txt（v1.30.0）から抜粋" static/licenses.txt` → `1`。
`pnpm exec vitest run src/routes/about/` → すべて pass。`pnpm lint` → exit 0。

コミットする。

### Step 5: 全体の確かめ

**Verify**: `pnpm verify` → exit 0。

## Test plan

- 足すテストは 6 つ。`inflate.test.ts` に 3 つ（小さいデータはそのまま・膨らむデータは上限で打ち切る・壊れたデータは reject）、
  `wire.test.ts` に 1 つ（線画の大きさで打ち切る）、`link.test.ts` に 1 つ（SDP の上限で打ち切る）、`Backup.svelte.test.ts` に 1 つ
  （大きすぎるファイルは読まずに断る）
- 型にするテストは `wire.test.ts`（node で `CompressionStream` を使う）と `Backup.svelte.test.ts` の `choose`
- コメントとライセンスは grep で確かめる（Step 1 と Step 4 の Verify）

## Done criteria

- [ ] Commands の「足すテスト」が pass し、足した 6 つを含む
- [ ] `grep -c "その中の通信は止まらない" vite.config.ts` が `1`
- [ ] `grep -n "f.size > MAX_BYTES" src/lib/components/Backup.svelte` が 1 行返す
- [ ] `grep -rl "DecompressionStream" src/lib` が `src/lib/inflate.ts` だけを返す（今は `link.ts` と `wire.ts` が返る）
- [ ] `grep -c '^_____$' static/licenses.txt` が `10`
- [ ] `pnpm verify` が exit 0
- [ ] `git status` で in scope 以外のファイルが変わっていない
- [ ] `plans/README.md` の 082 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した（レビュー担当が索引を持つと言われたら触らない）

## STOP 条件

- Current state の抜粋（`vite.config.ts` のコメント、`Backup.svelte` の `pick`、`backup.ts` の `MAX_CHARS`、`wire.ts` の `decodeLines`、
  `link.ts` の `unpack`、`licenses.txt` の見出しの形、about の行）が今のコードと違う
- `node_modules/onnxruntime-web/package.json` の `version` が `1.30.0` でない（版が変わると wasm の中身と写す元のタグが変わる。
  そのときは Step 4 をせず報告する）
- Step 4 の sha256 が違う、`curl` が取れない、抜き出した項が 10 でない
- `inflate` のテストで、打ち切ったあとに unhandled rejection の警告が出る（`reader.cancel()` の扱いを変えたくなったら報告）
- `decodeLines` や `unpack` を変えるのに `Together.svelte` や `Handshake.svelte` を変えたくなった
- `.svelte` のどれかが 200 行を超えて svelte-vitals が落ちる
- どれかの確認が 2 回直しても通らない

## Maintenance notes

- onnxruntime-web は Renovate が minor と patch を自動で上げる。上がったら、その版のタグの `ThirdPartyNotices.txt` と wasm の中の文字列で、
  組み込まれているものが変わっていないかを見直す（Step 4 の awk の名前の表を直して作り直す）
- `inflate` の上限は呼び手が決める。線画の大きさ（`SIZE`）を変えたら `decodeLines` は自動でついてくる。QR の SDP の形を大きく変えたら
  `MAX_SDP` を見直す
- 記録のファイルの上限を変えるときは `MAX_CHARS` だけを変えれば、`MAX_BYTES` もついてくる
- CSP で worker の中の通信まで止めたくなったら、worker のファイルの応答ヘッダを出せる配信先に移すか、worker の中で `fetch` を包むしかない。
  今の GitHub Pages ではできない
- `link.ts` の分けた知らせをつなぐ数（`#parts`）には上限が無い。相手の端末が大きな知らせを送り続けたときの守りは、必要になったら別の計画にする
