# Plan 066: ぬりえちょうの作品をバックアップに入れるかの設計メモを書く（コードは書かない）

> **Executor instructions**: この計画を上から順に実行する。各ステップの確認コマンドを実行し、期待どおりの結果を
> 確かめてから次へ進む。「STOP 条件」のどれかに当たったら止めて報告する。終わったら `plans/README.md` の
> 自分の行の Status を更新する（レビュー担当に「索引は触らない」と言われたときは触らない）。
>
> **Drift check（最初に実行）**
> `git diff --stat 36cc037..HEAD -- src/lib/coloring/book.ts src/lib/backup.ts src/lib/mirror.ts src/lib/components/Backup.svelte src/lib/components/BackupConfirm.svelte src/lib/components/MirrorRestore.svelte docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md`
> 書くのは設計メモ 1 つだが、メモが引くコードの行が動いていないかを見る。何か出たら「Current state」の抜粋と今のコードを
> 見比べ、食い違えば STOP。設計メモがもうあれば STOP。

## Status

| 項目       | 値                                               |
| ---------- | ------------------------------------------------ |
| Priority   | P3                                               |
| Effort     | M                                                |
| Risk       | LOW（設計メモを 1 つ書くだけ。ソースは変えない） |
| Depends on | none                                             |
| Category   | direction                                        |
| Planned at | commit `36cc037`, 2026-10-14                     |

## Why this matters

ぬりえの作品（ぬりえちょう）は IndexedDB の `asobibako-nurie` にあり、アプリについての「バックアップ」の書き出し・読み込みは
localStorage の `asobibako:` で始まるキーしか扱わない。iPad を買い替えて記録をファイルで移しても、ぬりえちょうは全部置いていかれる。

`CLAUDE.md` のぬりえの段落には次の 1 文がある。

> 写真から作った線画は大きいので、アプリのバックアップと控えには入れない。

この文は写真の作品だけを外したように読めるが、実際にはテンプレートの作品も含めてぬりえちょうはまるごとバックアップに入っていない。
しかも作品の線画は 1 画素 1 ビットに詰めてあり、写真の作品もテンプレートの作品も同じ 73,728 バイトである。「大きい」という
理由は詰める前の 590KB の話で、今の作品の形には当てはまらないかもしれない。

入れるかを決める前に、作品の本当の大きさを測り、バックアップの JSON の形・読み込みの順番・書き出しの順番・控え（mirror）との
関係を設計メモにまとめ、持ち主に決めてもらうことを並べる。この計画ではコードを書かない。

## Current state

ぬりえちょうの形は `src/lib/coloring/book.ts:4-21` にある。上限は 30 作品。

```ts
export const LIMIT = 30;

/** randomUUID は安全な接続（https）でしか使えないので、http で開いた開発の画面のために代わりを用意する */
export const newId = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export interface Work {
  id: string;
  template?: string;
  /** テンプレートの作品の、塗る場所を分けた線画（1 画素 1 ビット）。テンプレートのパスを直しても、保存した作品の場所の番号がずれないようにする */
  lines?: Uint8Array;
  /** 写真から作った線画。1 画素 1 ビットに詰める（そのままだと 1 作品 590KB になる） */
  photo?: Uint8Array;
  colors: Record<number, string>;
  history: Step[];
  /** ぬりえちょうに並べる小さな見本（data URL） */
  thumb: string;
  updated: number;
}
```

線画は `SIZE`（768、`src/lib/coloring/regions.ts:2`）の 2 乗の画素を 1 ビットずつ詰めるので 768 × 768 ÷ 8 = 73,728 バイト。
`history` は `{ region: number; before: string | null }` の並びで、最大 200（`MAX_STEPS`、`src/lib/coloring/paint.ts:14`）。
`thumb` は `snapshot(..., 200, 'image/jpeg')` が作る 200 画素四方の JPEG の data URL（品質 0.85、`src/lib/coloring/art.ts:100-106`）。
IndexedDB の名前と入れ物は `book.ts:42-43` の `DB = 'asobibako-nurie'` と `STORE = 'works'`（`keyPath: 'id'`）。

`Uint8Array` は `JSON.stringify` に渡すと `{"0":12,"1":0,…}` の形になり、10 倍ほど（73,728 バイトが 80 万字前後）にふくらむ。バックアップに入れるなら
base64 などの書き方を決める必要がある。

バックアップの形と上限は `src/lib/backup.ts:9` と `:17-20` にある。

```ts
export type Backup = { app: 'asobibako'; version: string; at: string; data: Record<string, string> };
```

```ts
// 常識外のファイルを弾く上限。わんにゃんハウスの写真やらくがきパレードのずかんで 1MB を超えるが、
// localStorage そのものが数 MB までなので、それより大きな正規の書き出しはない。キーはゲーム数 + 数個
const MAX_KEYS = 400;
const MAX_CHARS = 16 * 1024 * 1024;
```

書き出しは同期で、localStorage だけを読む（`backup.ts:64-69`）。

```ts
export function exportAll(version: string): string {
  const data: Record<string, string> = {};
  for (const k of keys()) data[k] = localStorage.getItem(k) ?? '';
  const b: Backup = { app: 'asobibako', version, at: today(), data };
  return JSON.stringify(b);
}
```

読み込みの形の確かめは `backup.ts:78-92` の `parseBackup` で、返すときに `{ app, version, at, data }` だけで作り直す。
そのため、今の版の `parseBackup` は知らない項目（たとえば `works`）を黙って捨てる。読み込みは `backup.ts:94-117` の
`importAll` で、いまの記録を控えてから全部置き換え、途中で容量を超えたら控えを戻す（どちらも同期の localStorage）。
確認画面の数は `backup.ts:119-123` の `summarize` が出す。

```ts
export function summarize(b: Backup): { games: number; keys: number; at: string } {
  const ids = Object.keys(b.data).flatMap((k) => k.match(/^asobibako:(?:reached|level):(.+)$/)?.[1] ?? []);
  return { games: new Set(ids).size, keys: Object.keys(b.data).length, at: b.at };
}
```

読み込みの確認は `src/lib/components/BackupConfirm.svelte:18-23` にある。保護者ゲート（掛け算）を通ったら、同期の
`importAll` のすぐあとに読み直す。

```ts
function submit(e: SubmitEvent) {
  e.preventDefault();
  if (!gate.submit(ans)) return void (ans = '');
  if (importAll(pending)) return location.reload();
  onfail('読み込めませんでした（保存できる容量を超えています）。いまの記録は元のままです。');
}
```

確認画面は `BackupConfirm.svelte:27` で `{sum.games} 本のゲームの記録・{sum.keys} 件` を出す。同じ部品を、控えから戻す
`src/lib/components/MirrorRestore.svelte`（`peek()` で読んだ控え）も使う。

書き出しの共有は `src/lib/components/Backup.svelte:30-37` にある。Safari は押したときの処理の中で同期に呼んだ `share()` しか
通さないので、書き出しの中身（`backupFile(version)`）は同期に作る必要がある。IndexedDB の作品を入れるなら、読む時刻を
押す前（画面を開いたとき）に移す必要がある。

```ts
function share() {
  error = '';
  // Safari はユーザー操作のハンドラ内で同期に呼ばれた share() しか通さないため、await を挟まない
  navigator.share({ files: [backupFile(version)], title: 'あそびばこ の記録' }).then(done, (e: unknown) => {
```

控え（mirror）は `src/lib/mirror.ts:1-4` の説明のとおり、localStorage の記録をバックアップと同じ JSON で別のファイルの
IndexedDB（`asobibako-mirror`）へ写す。iOS のホーム画面アプリで localStorage がまるごと空になったことがあり、その対策である。
`snapshot`（`mirror.ts:71-81`）は同期の `exportAll` を呼び、見えているあいだ 30 秒ごとに走る（`mirror.ts:129-139`）。
控えは IndexedDB が localStorage の消え方に巻き込まれない前提で作られている。ぬりえちょうも同じ IndexedDB なので、
その消え方ではぬりえちょうは残る見込みが高い。困るのはおもに端末を替えるときである。

`vite.config.ts:61` の CSP は `'img-src': ['self', 'data:']` なので、読み込んだ `thumb` の data URL はそのまま `<img>` に出せる。

## Commands you will need

| Purpose      | Command                                                                                             | Expected on success                       |
| ------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 見積もり     | Step 1 の `node -e` の 1 行                                                                         | 大きさの数が出る                          |
| 開発サーバー | `pnpm dev --port 5187 --strictPort`（Bash の `run_in_background`）                                  | `http://localhost:5187/asobibako/` が開く |
| 文の検査     | `~/.claude/textlint/node_modules/.bin/textlint --config ~/.claude/textlint/.textlintrc.json <file>` | 何も出ない、exit 0                        |
| 整形         | `pnpm exec prettier --write <file>`                                                                 | exit 0                                    |
| 整形の確かめ | `pnpm exec prettier --check docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md`         | exit 0                                    |

## Scope

**In scope**

- `docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md`（作る）
- `plans/README.md`（自分の行の Status だけ）

**Out of scope**

- `src/` の全部 — この計画はコードを書かない。測るための一時の道具も `src/` やテストに置かない（使うなら scratchpad に置く）
- `CLAUDE.md` — 1 文が実際の範囲とずれていることはメモに書くが、直すのは実装を決めたとき
- `fake-indexeddb` などの依存を足すこと
- Claude in Chrome — ブラウザを使うときは built-in browser（`mcp__Claude_Browser__*`）だけ

## Git workflow

- ブランチは `advisor/066-nurie-works-in-backup-design`
- コミットは 1 つ。英語の命令形 1 文で、Co-Authored-By などの trailer は付けない
  （例 `Add a design note for backing up coloring book works`）
- push しない（`main` への push は本番に出る）

## Steps

### Step 1: 作品 1 つの大きさを見積もる

ブラウザを使わずに、決まった部分の大きさを出す。次の 1 行を repo の根で実行する（書くのは数を出すだけで、ファイルは作らない）。

```bash
node -e '
const bits = new Uint8Array(768 * 768 / 8).map(() => Math.random() * 256);
const b64 = Buffer.from(bits).toString("base64").length;
const asJson = JSON.stringify(bits).length;
const history = JSON.stringify(Array.from({ length: 200 }, (_, i) => ({ region: i * 37, before: i % 3 ? "#ffcc00" : null }))).length;
const colors = JSON.stringify(Object.fromEntries(Array.from({ length: 300 }, (_, i) => [i * 11, "#ffcc00"]))).length;
console.log({ bytes: bits.length, b64, asJson, history, colors });
'
```

**Verify**: `bytes: 73728`、`b64: 98304` が出る。`asJson` は 80 万字前後（`b64` の 8 倍以上）。数をメモの「大きさ」に写す。

### Step 2: 本物の作品の大きさを測る（できる範囲で）

`thumb` の JPEG の大きさと、塗った場所の数は、本物の作品でしか分からない。built-in browser（`mcp__Claude_Browser__*`）だけを使い、
Claude in Chrome は使わない。

1. `pnpm dev --port 5187 --strictPort` を Bash の `run_in_background` で起こす（5173 は使わない）
2. built-in browser で `http://localhost:5187/asobibako/games/nurie` を開き、タイトルから始めて、テンプレートを 1 つ選び、
   線画の中を何か所か押して塗り、「できた！」を押す。これを 2 回（ちがうテンプレートで）
3. built-in browser の JavaScript で次を実行し、出た表をメモに写す

```js
const db = await new Promise((ok, ng) => {
  const q = indexedDB.open('asobibako-nurie');
  q.onsuccess = () => ok(q.result);
  q.onerror = () => ng(q.error);
});
const all = await new Promise((ok) => {
  const q = db.transaction('works').objectStore('works').getAll();
  q.onsuccess = () => ok(q.result);
});
db.close();
// JSC は 1 回の呼び出しに渡せる引数の数に上限があるので、区切って文字にする
const b64 = (u) => {
  if (!u) return 0;
  let s = '';
  for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode(...u.subarray(i, i + 8192));
  return btoa(s).length;
};
all.map((w) => ({
  kind: w.template ? 'template' : 'photo',
  bits: b64(w.lines ?? w.photo),
  thumb: w.thumb.length,
  colors: Object.keys(w.colors).length,
  history: w.history.length,
  total: JSON.stringify({ ...w, lines: undefined, photo: undefined }).length + b64(w.lines ?? w.photo)
}));
```

写真の作品は写真を選ぶ手順が要るので測らなくてよい。線画の大きさはテンプレートと同じ 73,728 バイトで、ちがうのは塗った場所の数だけ、
とメモに書く。持ち主が iPad の Safari の Web インスペクタで同じ式を流せば、写真の作品も測れる、とも書く。

この Step で 20 回ほど操作しても塗った作品を作れないときは、測るのをあきらめ、Step 1 の数と「thumb は 200 画素の JPEG の data URL で
10〜30KB ほどの見込み（測っていない）」をメモに書いて先へ進む。サーバーは止める。

**Verify**: 測れたときは、`kind: 'template'` の行が 2 つあり、`bits` が `98304` である。測れなかったときは、メモにその旨が書いてある。

### Step 3: 設計メモを書く

`docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md` を作る。見出しは次の順にし、ほかの設計メモ
（例 `docs/superpowers/specs/2026-10-12-yappari-chameleon-petit-design.md`）と同じく、日本語で、表と箇条書きを使ってよい。
メモは最新の考えだけを書き、経緯や issue の番号は書かない。コードは書かない（型の形を示す数行は書いてよい）。

1. `# ぬりえちょうの作品のバックアップ 設計`
2. `## 目的` — 端末を替えるときに、ぬりえちょうも記録のファイルで移せるようにするかを決める。今はぬりえちょうがまるごと
   バックアップと控えに入っていないこと
3. `## いまの決まりと、当てはまらないところ` — `CLAUDE.md` の 1 文をそのまま引き、(a) 実際はテンプレートの作品も入っていない、
   (b) 線画は写真もテンプレートも詰めて 73,728 バイトで、「大きい」は詰める前の 590KB の話、の 2 点を書く。テンプレートの作品には
   この理由が当てはまらないこと、写真の作品にも当てはまらないかもしれないこと
4. `## 大きさ` — Step 1 と Step 2 の数の表（作品 1 つ・30 作品）と、`MAX_CHARS`（16MB）・localStorage の数 MB との比べ。
   base64 にしない `JSON.stringify` は 10 倍ほどになること
5. `## 消える場面` — iOS が localStorage を消した件では IndexedDB は残る前提で控えが作られていること。ぬりえちょうが失われるのは
   おもに端末を替えるとき（と、Safari がサイトのデータを消すとき）。バックアップのファイルがそこを埋める
6. `## バックアップの形` — 案は `Backup` に任意の `works` の並びを足す（`data` とは別。`data` の `MAX_KEYS` は効かないので、
   並びの長さに自分の上限を持つ。たとえば `LIMIT` の 30）。1 つの作品は `id`・`template`・線画（base64）・`colors`・`history`・
   `thumb`・`updated`。入れるのはテンプレートの作品だけにする案と、写真の作品も入れる案を並べる。`parseBackup` で確かめること
   （`id` は文字、線画は base64 をほどいて 73,728 バイト、`colors` の値は色の文字、`history` は 200 以下、`thumb` は
   `data:image/jpeg;base64,` で始まる、`updated` は数）。もう無いテンプレートの id の作品をどうするか
7. `## 版のちがい` — 今の版の `parseBackup` は `works` を捨てるので、新しいファイルを古いアプリで読んでも壊れない（作品は入らない）。
   新しいアプリで `works` の無いファイル（今までのファイル・控え）を読んだときは、ぬりえちょうに触らない案を推す。
   `MirrorRestore.svelte` も同じ `BackupConfirm` を通るので、控えから戻すたびにぬりえちょうが空になるのを防げる
8. `## 読み込みの順番` — 今は保護者ゲートを通ったら同期の `importAll` のすぐあとに `location.reload()`。作品は IndexedDB なので
   非同期になる。案は「作品を先に、1 つの `readwrite` の取引（全部消して全部入れる）で入れる。取引は全部か無しかなので、
   失敗したら何も変わらない。成功したら今の `importAll` を呼ぶ。`importAll` が失敗したら、先に読んでおいた今の作品を書き戻すのを
   試みる」。localStorage と IndexedDB をまたいで全部か無しかにはできないこと。iOS の IndexedDB は開くところで止まることがあるので
   （`book.ts` と `mirror.ts` のコメント）、待つ上限を決めて、待ちきれなければ localStorage にも触らずに失敗にすること。
   置き換えるか、`id` で合わせて足すかも並べる
9. `## 書き出しの順番` — `share()` は同期に呼ぶ必要があるので、アプリについてを開いたときにぬりえちょうを読んでおき、
   押したときはそれを使う。`exportAll` は控えも使うので、作品を足すのは書き出しの口だけにする案
10. `## 確認画面の数` — `summarize` に作品の数を足し、`BackupConfirm` に「ぬりえ N さくひん」を 1 行足す案
11. `## 控えに入れるか` — 推す案は入れない。理由は (5) と、`snapshot` が 30 秒ごとに同期で走り、3MB 前後の作品を毎回読むのは
    別の設計になること
12. `## 持ち主に決めてほしいこと` — 少なくとも次を並べる。端末の買い替えのためにぬりえちょうを運びたいか。写真の作品も入れるか。
    読み込みは置き換えか足すか。`works` の無いファイルを読んだときにぬりえちょうに触らないでよいか。もう無いテンプレートの作品を
    どうするか。バックアップのファイルが数 MB に増えてよいか（AirDrop・メールで送るとき）。線画を入れずにテンプレートから
    作り直す案（ファイルは小さいが、テンプレートのパスを直すと塗った場所がずれる。`book.ts:12` のコメントが防いでいること）を採るか

**Verify**: `test -f docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md && grep -c "^## " docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md`
→ `11` 以上。`grep -n "写真から作った線画は大きいので" docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md` → 1 行以上。

### Step 4: 文の検査と整形

```bash
~/.claude/textlint/node_modules/.bin/textlint --config ~/.claude/textlint/.textlintrc.json docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md
pnpm exec prettier --write docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md
```

textlint は、太字とコロンを組み合わせた箇条書き（`- **X**: y`）と、述語の後ろにコロンを置いて終わる行を落とす。抜粋の前置きは
`。` で終わる文にする。落ちたら直して通るまで繰り返す。

**Verify**: textlint が何も出さずに exit 0。`pnpm exec prettier --check docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md` → exit 0。
`git status --short` → 新しいメモ 1 つ（と `plans/README.md`）だけ。

## Test plan

- コードを書かないのでテストは足さない
- Step 1 の数（`bytes: 73728`、`b64: 98304`）と、測れたときは Step 2 の表がメモにあることを、Step 3 の Verify と目で確かめる

## Done criteria

- [ ] `docs/superpowers/specs/2026-10-14-nurie-works-backup-design.md` があり、`grep -c "^## "` が 11 以上
- [ ] メモに `98304` と `73,728`（または `73728`）が出てくる
- [ ] メモに `CLAUDE.md` の 1 文「写真から作った線画は大きいので」が引いてある
- [ ] textlint が exit 0、`pnpm exec prettier --check` が exit 0
- [ ] `git status --short` で `src/`・`package.json`・`CLAUDE.md` が変わっていない
- [ ] 開発サーバーを起こしたなら止めてある
- [ ] `plans/README.md` の 066 の行を更新し、`pnpm exec prettier --write plans/README.md` を通した

## STOP 条件

- Current state の抜粋（`Work` の形、`Backup` の形、`exportAll`、`parseBackup` が作り直すこと、`BackupConfirm` の `submit`、
  `Backup.svelte` の `share`）が今のコードと違う
- `Work` の線画がもう詰めていない（73,728 バイトでない）、またはぬりえちょうがもうバックアップに入っている
- メモを書くために `src/` を変えたくなった、またはテストや依存を足したくなった
- built-in browser が使えない（Claude in Chrome に切り替えない。Step 2 のあきらめる道へ進む）

## Maintenance notes

- このメモは決めるための材料で、実装の計画ではない。持ち主が「持ち主に決めてほしいこと」に答えたら、それをもとに実装の計画を別に作る
- 実装するときは `CLAUDE.md` のぬりえの 1 文と、アプリについての「データの扱い」の文（`src/routes/about/+page.svelte:59`）も
  合わせて直す
- 実装の要は、`share()` を同期に保つこと、`works` の無いファイル（今までのファイルと控え）でぬりえちょうを消さないこと、
  IndexedDB が止まったときに localStorage も触らずに失敗にすること
